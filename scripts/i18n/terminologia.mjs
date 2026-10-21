/** Contratos de terminologia offline; não executa nem modifica os consumidores. */
import { createHash } from "node:crypto";
import ts from "typescript";
import { z } from "zod";

/** @typedef {ReturnType<typeof import("./catalogo.mjs").lerCatalogo>} Catalogo */
/** @typedef {ReturnType<typeof import("./glossario.mjs").lerGlossario>} Glossario */
/** @typedef {{ inicio: number, fim: number }} Intervalo */
/** @typedef {{ id: string, forma: string, ocorrencias: number, tipo: "termo" | "nome", pt: string, en: string, explicacao?: string, modo?: "na_mensagem" | "no_glossario" }} Referencia */
/** @typedef {{ schema_version: 1, mensagens: number, mensagens_vinculadas: number, mensagens_sem_termos_tecnicos: number, referencias: number, ids_distintos: number, formas_contextuais_usadas: number, referencias_pt_verificadas: number, referencias_en_verificadas: number, referencias_en_pendentes: number, uso_na_interface_verificado: false }} ResumoTerminologia */

const texto = z.string().refine((valor) => valor.trim().length > 0, "Texto vazio.");
const referencia = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  forma: z.string().regex(/^[a-z][a-z0-9_]*$/),
  ocorrencias: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  explicacao: z.enum(["na_mensagem", "no_glossario"]).optional(),
});
const comum = { sha256_revisado: z.string().regex(/^[a-f0-9]{64}$/) };
const mensagem = z.discriminatedUnion("classificacao", [
  z.strictObject({ classificacao: z.literal("sem_termos_tecnicos"), ...comum, justificativa: texto }),
  z.strictObject({ classificacao: z.literal("vinculada"), ...comum, referencias: z.array(referencia).min(1) }),
]);
const contrato = z.strictObject({ schema_version: z.literal(1), mensagens: z.record(texto, mensagem) });

/** @param {string} pt @param {import("./catalogo.mjs").EntradaEn} en */
export function assinaturaMensagem(pt, en) {
  const valorEn = en.estado === "traduzido" ? en.texto : en.motivo;
  return createHash("sha256").update(JSON.stringify([pt, en.estado, valorEn]), "utf8").digest("hex");
}

/** A AST retém as chaves duplicadas; JSON.parse continua exigindo sintaxe JSON estrita. */
function lerContrato(conteudo) {
  if (typeof conteudo !== "string") throw new Error("Contrato de terminologia deve ser texto JSON.");
  const arvore = ts.parseJsonText("i18n-terminologia.json", conteudo);
  if (arvore.parseDiagnostics.length) throw new Error("Contrato de terminologia contém JSON inválido.");
  function visitar(no) {
    if (ts.isObjectLiteralExpression(no)) {
      const vistas = new Set();
      for (const propriedade of no.properties) {
        if (!ts.isPropertyAssignment(propriedade) || !ts.isStringLiteral(propriedade.name)) {
          throw new Error("Contrato de terminologia exige propriedades JSON literais.");
        }
        const chave = propriedade.name.text;
        if (vistas.has(chave)) throw new Error(`Chave JSON duplicada ${JSON.stringify(chave)} no contrato de terminologia.`);
        vistas.add(chave);
      }
    }
    ts.forEachChild(no, visitar);
  }
  visitar(arvore);
  return contrato.parse(JSON.parse(conteudo));
}

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Inclui candidatos sobrepostos, sem normalizar o texto ou consumir a fronteira. */
function localizar(conteudo, valor) {
  const padrao = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?=${escapar(valor)}(?![\\p{L}\\p{M}\\p{N}_]))`, "gu");
  return [...conteudo.matchAll(padrao)].map((m) => ({ inicio: m.index, fim: m.index + valor.length }));
}
const cruza = (a, b) => a.inicio < b.fim && b.inicio < a.fim;
const contem = (externo, interno) => externo.inicio <= interno.inicio && interno.fim <= externo.fim;

/** @param {Intervalo[]} intervalos */
function exigirSemSobreposicao(intervalos, chave, idioma) {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  for (let i = 1; i < ordenados.length; i++) {
    if (cruza(ordenados[i - 1], ordenados[i])) {
      throw new Error(`Sobreposição de referências em ${chave} (${idioma}).`);
    }
  }
}

function exigirQuantidade(intervalos, ref, chave, idioma) {
  if (intervalos.length !== ref.ocorrencias) {
    throw new Error(`Quantidade de ocorrências divergente em ${chave} (${idioma}): ${ref.id}/${ref.forma}; esperadas ${ref.ocorrencias}, encontradas ${intervalos.length}.`);
  }
}

/** @param {string} conteudo @param {Referencia[]} referencias @param {"pt" | "en"} idioma */
function conferirTexto(conteudo, referencias, idioma, chave) {
  const nomes = referencias.filter((ref) => ref.tipo === "nome").map((ref) => {
    const intervalos = localizar(conteudo, ref[idioma]);
    const blocos = idioma === "en"
      ? localizar(conteudo, `${ref.en} (${ref.explicacao})`).map((bloco) => ({
        ...bloco, explicacao: { inicio: bloco.inicio + ref.en.length + 2, fim: bloco.fim - 1 },
      })) : [];
    return { ref, intervalos, blocos };
  });
  // Resolver os nomes juntos torna a decisão independente da ordem das referências.
  exigirSemSobreposicao(nomes.flatMap((nome) => nome.blocos), chave, idioma);
  const reservados = nomes.flatMap(({ ref, intervalos, blocos }) => {
    // Um nome repetido dentro da própria explicação não é outra ocorrência autônoma.
    const elegiveis = intervalos.filter((intervalo) => !blocos.some((b) => contem(b.explicacao, intervalo)));
    exigirQuantidade(elegiveis, ref, chave, idioma);
    if (idioma === "en" && ref.modo === "na_mensagem"
      && !blocos.some((b) => b.inicio === elegiveis[0].inicio)) {
      throw new Error(`Explicação ausente na primeira ocorrência de ${ref.id} em ${chave}.`);
    }
    return elegiveis.map((intervalo) => blocos.find((b) => b.inicio === intervalo.inicio) ?? intervalo);
  });
  exigirSemSobreposicao(reservados, chave, idioma);
  const explicacoes = nomes.flatMap((nome) => nome.blocos.map((b) => b.explicacao));
  const termos = referencias.filter((ref) => ref.tipo === "termo").flatMap((ref) => {
    const elegiveis = localizar(conteudo, ref[idioma]).filter((intervalo) => {
      // Somente o interior literal da explicação validada deixa de ser termo independente.
      if (explicacoes.some((explicacao) => contem(explicacao, intervalo))) return false;
      if (reservados.some((reservado) => cruza(reservado, intervalo))) {
        throw new Error(`Sobreposição de referências em ${chave} (${idioma}): ${ref.id}/${ref.forma}.`);
      }
      return true;
    });
    exigirQuantidade(elegiveis, ref, chave, idioma);
    return elegiveis;
  });
  exigirSemSobreposicao([...reservados, ...termos], chave, idioma);
}

/**
 * Recebe catálogo e glossário já validados, sem I/O, imports da aplicação ou tradução.
 * @param {string} conteudo
 * @param {Catalogo} catalogo
 * @param {Glossario} glossario
 * @returns {ResumoTerminologia}
 */
export function lerTerminologia(conteudo, catalogo, glossario) {
  const declarado = lerContrato(conteudo);
  const chaves = Object.keys(catalogo.pt).sort();
  const declaradas = Object.keys(declarado.mensagens).sort();
  if (chaves.length !== declaradas.length || chaves.some((chave, i) => chave !== declaradas[i])) {
    throw new Error("Contrato de terminologia e catálogo devem ter as mesmas chaves.");
  }
  /** @type {ResumoTerminologia} */
  const resumo = {
    schema_version: 1, mensagens: chaves.length, mensagens_vinculadas: 0, mensagens_sem_termos_tecnicos: 0,
    referencias: 0, ids_distintos: 0, formas_contextuais_usadas: 0, referencias_pt_verificadas: 0,
    referencias_en_verificadas: 0, referencias_en_pendentes: 0, uso_na_interface_verificado: false,
  };
  const ids = new Set();
  const formas = new Set();
  for (const chave of chaves) {
    const item = declarado.mensagens[chave];
    const pt = catalogo.pt[chave], en = catalogo.en[chave];
    if (item.sha256_revisado !== assinaturaMensagem(pt, en)) {
      throw new Error(`Assinatura de mensagem desatualizada: ${chave}.`);
    }
    if (item.classificacao === "sem_termos_tecnicos") {
      resumo.mensagens_sem_termos_tecnicos++;
      continue;
    }
    resumo.mensagens_vinculadas++;
    const vistas = new Set();
    /** @type {Referencia[]} */
    const referencias = item.referencias.map((ref) => {
      const par = JSON.stringify([ref.id, ref.forma]);
      if (vistas.has(par)) throw new Error(`Referência terminológica duplicada em ${chave}: ${ref.id}/${ref.forma}.`);
      vistas.add(par);
      if (!Object.hasOwn(glossario.entradas, ref.id)) throw new Error(`ID de glossário ausente: ${ref.id}.`);
      const entrada = glossario.entradas[ref.id];
      ids.add(ref.id);
      if (entrada.tipo === "termo") {
        if (Object.hasOwn(ref, "explicacao")) throw new Error(`Termo não admite explicacao: ${ref.id}.`);
        /** @type {{ pt: string, en: string }} */
        let forma = entrada;
        if (ref.forma !== "canonica") {
          if (!entrada.formas_contextuais || !Object.hasOwn(entrada.formas_contextuais, ref.forma)) {
            throw new Error(`Forma contextual inexistente: ${ref.id}/${ref.forma}.`);
          }
          forma = entrada.formas_contextuais[ref.forma];
          formas.add(par);
        }
        return { id: ref.id, forma: ref.forma, ocorrencias: ref.ocorrencias, tipo: "termo", pt: forma.pt, en: forma.en };
      }
      if (ref.forma !== "canonica" || !Object.hasOwn(ref, "explicacao")) {
        throw new Error(`Nome próprio exige forma canonica e explicacao: ${ref.id}.`);
      }
      return {
        id: ref.id, forma: ref.forma, ocorrencias: ref.ocorrencias, tipo: "nome", pt: entrada.pt, en: entrada.en,
        explicacao: entrada.explicacao_en, modo: ref.explicacao,
      };
    });
    conferirTexto(pt, referencias, "pt", chave);
    resumo.referencias += referencias.length;
    resumo.referencias_pt_verificadas += referencias.length;
    if (en.estado === "traduzido") {
      conferirTexto(en.texto, referencias, "en", chave);
      resumo.referencias_en_verificadas += referencias.length;
    } else resumo.referencias_en_pendentes += referencias.length;
  }
  resumo.ids_distintos = ids.size;
  resumo.formas_contextuais_usadas = formas.size;
  return resumo;
}
