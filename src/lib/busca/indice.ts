/**
 * Índice único da busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026), montado no build a partir do registro e
 * dos catálogos que já existem, sem lista de destinos escrita à mão:
 *
 *  - observatórios, coleções e páginas: o registro (lista.ts) e o inventário (inventario.ts), com a situação de cada página;
 *  - perguntas: as seis portas abertas de "O Brasil em perguntas" (portas.ts) e as perguntas dos caminhos delas;
 *  - consultas pessoais: as do bloco "Para você" (paraVoce.ts), as abertas da leva 1 e as aprovadas da leva 2
 *    (rotasPublicas.ts), com os lugares que levam a elas (capitais, estados, distribuidoras, bancos);
 *  - verbetes: os glossários do Crédito, do Aprenda do Setor Elétrico, das Contas Federais e do Agronegócio;
 *  - método, dados e glossário de cada coleção: os atalhos da navegação da coleção (navegacaoColecao.ts).
 *
 * `aberta` vem de ehRotaPublica. Os sinônimos vêm de um único arquivo (sinonimos.json). Destino novo entra na busca pelo
 * registro ou pelo catálogo, nunca por aqui. O índice não leva número, série nem arquivo: só títulos, resumos, endereços,
 * situação e termos. A rota src/app/busca/indice.json/route.ts (force-static) o grava no build e o serve em
 * /busca/indice.json, aberto sem conta pelo endereço exato (ARQUIVOS_DAS_CONSULTAS).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OBSERVATORIOS, type ObservatorioId } from "@/lib/observatorios/lista";
import { donoDaRota } from "@/lib/observatorios/registro";
import { inventario } from "@/lib/observatorios/inventario";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { todasAsPerguntas } from "@/lib/observatorios/paraVoce";
import { CONSULTAS, portas } from "@/lib/perguntas/portas";
import { APERITIVOS, LEVA_2, ehRotaPublica, itemAprovado } from "@/lib/rotasPublicas";
import { GLOSSARIO as GLOSSARIO_CREDITO } from "@/lib/data/glossario";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { GLOSSARIO as GLOSSARIO_CONTAS } from "@/lib/contas-publicas/glossario";
import { GLOSSARIO_AGRO, ancoraConceitoAgro } from "@/lib/agro/aprendizagem";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { NOME_UF } from "@/lib/energia/expansao";
import capitais from "@/lib/eficiencia/contornos-capitais.json";
import sinonimos from "./sinonimos.json";
import { EXEMPLOS_BUSCA } from "./exemplos";
import { sinonimosDe } from "@/lib/energia/busca-sinonimos";
import { normalizar } from "./normalizar";
import type { EntradaBusca, IndiceBusca, SituacaoEntrada, TipoEntrada, TipoLugar, VersaoAberta } from "./tipos";

/** Resumo de uma linha: o índice viaja ao navegador e deve ficar leve. */
const LIMITE_RESUMO = 140;
const curto = (s: string | undefined, limite = LIMITE_RESUMO) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  return `${corte.slice(0, corte.lastIndexOf(" "))}…`;
};
const semAncora = (href: string) => href.split(/[?#]/)[0] || "/";

/** Prioridade de quem fica com o título quando dois catálogos apontam o mesmo endereço. */
const PRIORIDADE: Record<TipoEntrada, number> = { consulta: 0, pergunta: 1, colecao: 2, metodo: 3, pagina: 4, verbete: 5, observatorio: 6 };

type Rascunho = Omit<EntradaBusca, "id" | "aberta" | "termos" | "lugares"> & { termos: Set<string>; lugares: Set<TipoLugar> };

class Montagem {
  /** Uma entrada por endereço e família: a consulta pessoal e a coleção convivem com a página do mesmo endereço. */
  private porChave = new Map<string, Rascunho>();
  private ordem: string[] = [];

  add(r: Omit<Rascunho, "termos" | "lugares"> & { termos?: (string | undefined)[]; lugares?: TipoLugar[] }) {
    const familia = r.tipo === "consulta" ? "consulta" : r.tipo === "colecao" ? "colecao" : r.tipo === "observatorio" ? "observatorio" : "destino";
    const chave = r.href ? `${familia}:${r.href}` : `${familia}:previsto:${r.observatorio}/${r.colecao}/${r.titulo}`;
    const termos = new Set((r.termos ?? []).filter((t): t is string => !!t && t.trim().length > 0));
    const lugares = new Set(r.lugares ?? []);
    const ja = this.porChave.get(chave);
    if (!ja) {
      // o verbete mostra só o começo da definição: o resto está a um clique, no glossário
      this.porChave.set(chave, { ...r, resumo: curto(r.resumo, r.tipo === "verbete" ? 100 : LIMITE_RESUMO), termos, lugares });
      this.ordem.push(chave);
      return;
    }
    // o mesmo destino visto por outro catálogo: o título fica com o de maior prioridade e o outro vira termo
    if (PRIORIDADE[r.tipo] < PRIORIDADE[ja.tipo]) {
      ja.termos.add(ja.titulo);
      ja.titulo = r.titulo;
      ja.tipo = r.tipo;
    } else if (r.titulo !== ja.titulo) ja.termos.add(r.titulo);
    if (!ja.resumo && r.resumo) ja.resumo = curto(r.resumo);
    for (const t of termos) ja.termos.add(t);
    for (const l of lugares) ja.lugares.add(l);
  }

  entradas(): EntradaBusca[] {
    return this.ordem.map((chave, n) => {
      const r = this.porChave.get(chave)!;
      const termos = comSinonimos([r.titulo, ...r.termos]).filter((t) => t !== r.titulo);
      return {
        // identificador curto e estável dentro de uma publicação (o endereço já está em href)
        id: `${r.tipo.slice(0, 2)}${n}`,
        tipo: r.tipo,
        titulo: r.titulo,
        resumo: r.resumo,
        href: r.href,
        observatorio: r.observatorio,
        colecao: r.colecao,
        situacao: r.situacao,
        aberta: r.href ? ehRotaPublica(semAncora(r.href)) : false,
        termos: Array.from(new Set(termos)),
        ...(r.lugares.size ? { lugares: Array.from(r.lugares) } : {}),
      };
    });
  }
}

/* ------------------------------------------------------------------ sinônimos */

const GRUPOS = Object.entries(sinonimos as Record<string, unknown>)
  .filter(([chave]) => !chave.startsWith("_"))
  .map(([chave, lista]) => [chave, ...(lista as string[])]);

/** Apelidos de nomes próprios das listas de bancos e distribuidoras: o nome como está na lista e os apelidos ("Neoenergia PE" é a Celpe). */
const NOMES = Object.entries((sinonimos as { _nomes: Record<string, string[]> })._nomes);

/** Contém a expressão inteira (palavras completas), já normalizada. */
const contem = (texto: string, expressao: string) => ` ${texto} `.includes(` ${expressao} `);

/** Acrescenta os grupos de sinônimos que o destino já menciona (no título ou nos termos). */
function comSinonimos(termos: string[]): string[] {
  const texto = normalizar(termos.join(" "));
  const extra: string[] = [];
  for (const grupo of GRUPOS) if (grupo.some((s) => contem(texto, normalizar(s)))) extra.push(...grupo);
  return [...termos, ...extra];
}

/**
 * As listas de nomes recebem só os apelidos de `_nomes`, nunca os grupos temáticos: uma palavra comum dentro de uma razão social
 * ("Safra", "Amazônia", "Fibra") anexava o grupo inteiro e levava "pecuária" ou "Anatel" à consulta de bancos (diagnóstico da
 * busca de 23/10/2026, achado A3).
 */
function comApelidos(nomes: string[]): string[] {
  const presentes = new Set(nomes.map(normalizar));
  const extra = NOMES.filter(([nome]) => presentes.has(normalizar(nome))).flatMap(([, apelidos]) => apelidos);
  return [...nomes, ...extra];
}

/* ------------------------------------------------------------------ lugares */

/** Lê um arquivo de public/ no build; ausente, a lista fica vazia (os termos de lugar somem, a busca continua). */
function lerPublico<T>(caminho: string, ler: (json: unknown) => T, vazio: T): T {
  try {
    return ler(JSON.parse(readFileSync(join(process.cwd(), "public", caminho), "utf-8")));
  } catch {
    return vazio;
  }
}

/** Nomes das 26 capitais (malha do IBGE usada pelo retrato das capitais). */
const nomesCapitais = (): string[] => capitais.capitais.map((c) => c.nome);
const nomesUf = (): string[] => Object.values(NOME_UF);

/** Distribuidoras com tarifa vigente (sigla e razão social da ANEEL), as mesmas da Conta de luz. */
/**
 * Razão social sem o que ninguém digita (S.A., LTDA, "DISTRIBUIDORA DE ENERGIA", "COOPERATIVA DE ELETRIFICAÇÃO RURAL DA REGIÃO
 * DE"): sobram o nome de fantasia e o lugar. O índice desce inteiro no primeiro foco e tem peso alvo de 150 KB (bloco 3 do ciclo
 * 2 da busca, 23/10/2026: com o resumo e os termos de cada página, encurtar os nomes vem antes de subir o teto).
 */
export function encurtarRazaoSocial(nome: string): string {
  return nome
    .replace(/\bCOOPERATIVA( REGIONAL)? DE (ELETRIFICACAO|ELETRIFICAO|ELETRIF|DISTRIBUICAO|ELETRICIDADE|ENERGIA|ELETR\.)( E GERACAO)?( RURAL)?( E (DESENVOLVIMENTO|DESENV\.)( RURAL)?)?( DE ENERGIA)?( ELETRICA)?( DA REGIAO)?( D[AEO]S?)?\b/gi, "COOPERATIVA ")
    .replace(/\b(S\.?\/?A\.?|S A|LTDA\.?|LTD)(?=\s|$|-)/gi, " ")
    .replace(/-?\s*\b(DISTRIBUIDORA|DISTRIBUICAO)( E GERACAO)?( DE (ENERGIA|ELETRICIDADE)( ELETRICA)?)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.\-]+|[\s.\-]+$/g, "")
    .trim();
}

const distribuidoras = (): string[] =>
  lerPublico(
    "energia/gold/conta.json",
    (j) =>
      ((j as { tarifas: { vigentes: { sigla: string; nome: string }[] } }).tarifas.vigentes ?? []).flatMap((d) => {
        const nome = encurtarRazaoSocial(d.nome);
        return normalizar(nome) === normalizar(d.sigla) ? [d.sigla] : [d.sigla, nome];
      }),
    [] as string[],
  );

/**
 * Instituições com taxa publicada pelo Banco Central, as mesmas da consulta "Quanto meu banco cobra?", sem as abreviaturas da razão
 * social e com "BCO" por extenso ("BANCO DO BRASIL", "BANCO DA AMAZONIA": quem digita o nome do banco o acha inteiro).
 */
const bancos = (): string[] =>
  lerPublico(
    "obs/data/gold/juros.json",
    (j) =>
      ((j as { perfis_if: { nome: string }[] }).perfis_if ?? []).map((b) =>
        b.nome
          .replace(/\bBCO\b/gi, "BANCO")
          .replace(/\b(S\.?\/?A\.?|LTDA\.?|CFI|SCFI|DTVM|CCTVM)(?=\s|$)/gi, " ")
          .replace(/(\s+\.)+(?=\s|$)/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    [] as string[],
  );

/** As listas de nomes como vêm das bases, antes dos apelidos (para o teste conferir que cada apelido aponta para um nome que existe). */
export function nomesDasListas(): { banco: string[]; distribuidora: string[] } {
  return { banco: bancos(), distribuidora: distribuidoras() };
}

/** As listas de lugares e nomes que levam a cada consulta pessoal, pelo padrão da pergunta ("minha cidade", "meu estado"...). */
function lugaresDaConsulta(titulo: string, href: string): TipoLugar[] {
  const t = normalizar(titulo);
  const l: TipoLugar[] = [];
  if (/\b(capital|cidade|municipio|regiao)\b/.test(t)) l.push("capital");
  if (/\bestado\b/.test(t)) l.push("uf");
  const destino = semAncora(href);
  if (destino === "/setor-eletrico/conta-de-luz") l.push("distribuidora");
  if (destino === "/observatorio-do-credito/quanto-meu-banco-cobra") l.push("banco");
  return l;
}

/* ------------------------------------------------------------------ montagem */

/**
 * O vocabulário leigo do Setor Elétrico ("preço da luz", "apagão", "congestionamento"), que a busca própria da coleção usava
 * (src/lib/energia/busca-sinonimos.ts), entra nos termos das páginas a que ele aponta: a busca da plataforma acha o que a antiga
 * achava, sem uma segunda lista.
 */
function comVocabularioDoSetorEletrico(entradas: EntradaBusca[]): EntradaBusca[] {
  for (const e of entradas) {
    if (!e.href || e.colecao !== "setor-eletrico") continue;
    for (const t of sinonimosDe(e.href, "pt")) if (!e.termos.includes(t)) e.termos.push(t);
  }
  return entradas;
}

/** Observatório e coleção donos de um endereço; quando o registro não o conhece, o dono dado pelo catálogo. */
function dono(href: string, padrao: { observatorio: ObservatorioId; colecao: string | null }) {
  const p = donoDaRota(semAncora(href));
  return p ? { observatorio: p.observatorio, colecao: p.colecao } : padrao;
}

let cache: IndiceBusca | null = null;

export function indiceDeBusca(): IndiceBusca {
  if (cache) return cache;
  const m = new Montagem();
  const obs = inventario();
  const lugares: Record<TipoLugar, string[]> = { capital: nomesCapitais(), uf: nomesUf(), distribuidora: distribuidoras(), banco: bancos() };

  // consultas pessoais: o "Para você", as abertas da leva 1 e as aprovadas da leva 2
  const consultas: { pergunta: string; resumo: string; href: string }[] = [
    ...todasAsPerguntas().map((p) => ({ pergunta: p.pergunta, resumo: p.resposta, href: p.href })),
    ...Object.values(CONSULTAS),
    ...LEVA_2.filter((i) => itemAprovado(i) && i.forma === "consulta" && i.rotas[0]).map((i) => ({ pergunta: i.pergunta, resumo: i.resumo, href: i.rotas[0] })),
  ];
  for (const c of consultas) {
    const d = dono(c.href, { observatorio: "familias", colecao: null });
    m.add({ tipo: "consulta", titulo: c.pergunta, resumo: c.resumo, href: c.href, ...d, situacao: "publicado", lugares: lugaresDaConsulta(c.pergunta, c.href) });
  }

  // observatórios, coleções e páginas
  const energia = new Map(DESTINOS_NAVEGACAO.map((d) => [d.href, d]));
  for (const o of obs) {
    const reg = OBSERVATORIOS.find((x) => x.id === o.id)!;
    m.add({ tipo: "observatorio", titulo: o.nome, resumo: o.pergunta, href: o.entrada ?? `/perguntas/${o.id}`, observatorio: o.id, colecao: null, situacao: "publicado", termos: [o.nomeCurto] });
    if (reg.metodo) m.add({ tipo: "metodo", titulo: `Método do observatório ${o.nomeCurto}`, resumo: "", href: reg.metodo, observatorio: o.id, colecao: null, situacao: "publicado", termos: ["metodologia", "fontes"] });
    for (const c of o.colecoes) {
      const publicadas = c.paginas.filter((p) => p.situacao !== "previsto").length;
      m.add({
        tipo: "colecao",
        titulo: c.nome,
        resumo: `Coleção do observatório ${o.nomeCurto}${publicadas ? `, com ${publicadas} ${publicadas === 1 ? "página" : "páginas"} além da entrada` : ""}.`,
        href: c.href,
        observatorio: o.id,
        colecao: c.id,
        situacao: "publicado",
        termos: [o.nomeCurto, ...c.termos.split(/\s+/)],
      });
      for (const p of c.paginas) {
        const destino = p.rota ? energia.get(p.rota) : undefined;
        m.add({
          tipo: "pagina",
          titulo: p.titulo,
          // o Setor Elétrico tem resumo próprio no catálogo da navegação, mais descritivo que a pergunta
          resumo: destino?.resumo ?? p.resumo ?? (p.situacao === "previsto" ? (p.pendencia ?? "") : ""),
          href: p.rota,
          observatorio: o.id,
          colecao: c.id,
          situacao: p.situacao as SituacaoEntrada,
          termos: [...(p.termos ?? []), destino?.pergunta, destino?.rotulo],
        });
      }
      // método, dados e glossário da coleção: os atalhos da navegação única
      const nav = navegacaoDaColecao(c.id);
      const atalhos: [string | undefined, string, TipoEntrada, string[]][] = [
        [nav.atalhos.metodo, `Método: ${c.nome}`, "metodo", ["metodologia", "fontes", "como é calculado"]],
        [nav.atalhos.glossario, `Glossário: ${c.nome}`, "metodo", ["glossário", "conceitos", "definições"]],
        [nav.atalhos.dados, `Dados: ${c.nome}`, "pagina", ["dados abertos", "download", "catálogo"]],
      ];
      for (const [href, titulo, tipo, termos] of atalhos) {
        if (!href) continue;
        m.add({ tipo, titulo, resumo: "", href, observatorio: o.id, colecao: c.id, situacao: "publicado", termos: [c.nome, ...termos] });
      }
      // páginas do Setor Elétrico que o inventário não lista (subpáginas de grupo) entram pelo catálogo da Energia
      if (c.id === "setor-eletrico") {
        for (const d of DESTINOS_NAVEGACAO) {
          if (!d.publicado || d.href === c.href) continue;
          m.add({ tipo: "pagina", titulo: d.rotulo, resumo: d.resumo, href: d.href, observatorio: o.id, colecao: c.id, situacao: "publicado", termos: [d.pergunta] });
        }
      }
    }
  }

  // as seis portas abertas e as perguntas dos seus caminhos
  for (const p of portas()) {
    m.add({ tipo: "pergunta", titulo: p.pergunta, resumo: p.resumo, href: `/perguntas/${p.id}`, observatorio: p.id, colecao: null, situacao: "publicado", termos: [p.nome, p.nomeCompleto, "o brasil em perguntas"] });
    for (const c of p.caminhos) {
      const d = dono(c.href, { observatorio: p.id, colecao: null });
      m.add({ tipo: "pergunta", titulo: c.pergunta, resumo: c.resumo, href: c.href, ...d, situacao: "publicado", termos: [c.colecao] });
    }
    for (const met of p.metodos) {
      const d = dono(met.href, { observatorio: p.id, colecao: null });
      m.add({ tipo: "metodo", titulo: met.rotulo, resumo: "", href: met.href, ...d, situacao: "publicado", termos: ["metodologia"] });
    }
  }
  for (const i of LEVA_2) {
    if (!itemAprovado(i) || i.forma !== "metodo" || !i.rotas[0]) continue;
    const d = dono(i.rotas[0], { observatorio: "economia", colecao: null });
    m.add({ tipo: "metodo", titulo: i.pergunta, resumo: i.resumo, href: i.rotas[0], ...d, situacao: "publicado", termos: ["metodologia"] });
  }

  // verbetes dos glossários
  for (const g of GLOSSARIO_CREDITO) {
    m.add({ tipo: "verbete", titulo: g.nome, resumo: g.definicao, href: `/glossario#${g.slug}`, observatorio: "economia", colecao: "credito", situacao: "publicado", termos: ["glossário"] });
  }
  for (const c of CONCEITOS) {
    m.add({
      tipo: "verbete",
      titulo: c.nome,
      resumo: c.emUmaFrase ?? "",
      href: `/setor-eletrico/aprenda/${c.slug}`,
      observatorio: "energia-e-infraestrutura",
      colecao: "setor-eletrico",
      situacao: "publicado",
      termos: [c.sigla, "aprenda"],
    });
  }
  for (const [id, t] of Object.entries(GLOSSARIO_CONTAS)) {
    m.add({ tipo: "verbete", titulo: t.termo, resumo: t.definicao, href: `/contas-publicas/glossario#${id}`, observatorio: "contas-publicas", colecao: "federais", situacao: "publicado", termos: ["glossário"] });
  }
  for (const g of GLOSSARIO_AGRO) {
    m.add({ tipo: "verbete", titulo: g.termo, resumo: g.definicao, href: `/agronegocio/glossario#${ancoraConceitoAgro(g.termo)}`, observatorio: "economia", colecao: "agro", situacao: "publicado", termos: ["glossário"] });
  }

  const entradas = comVocabularioDoSetorEletrico(m.entradas());
  const abertas = versoesAbertas(entradas);
  const colecoes = obs.flatMap((o) =>
    o.colecoes.map((c) => {
      const aberta = abertas.get(`${o.id}/${c.id}`);
      return { id: c.id, observatorio: o.id, nome: c.nome, href: c.href, ...(aberta ? { aberta } : {}) };
    }),
  );
  cache = {
    versao: 1,
    observatorios: obs.map((o) => ({ id: o.id, nome: o.nomeCurto })),
    colecoes,
    exemplos: [...EXEMPLOS_BUSCA],
    // nomes com apelido (NU FINANCEIRA → Nubank, Neoenergia PE → Celpe) levam o apelido junto: a lista do cabeçalho já sai expandida
    lugares: Object.fromEntries(Object.entries(lugares).map(([k, v]) => [k, Array.from(new Set(comApelidos(v)))])) as Record<TipoLugar, string[]>,
    entradas,
  };
  return cache;
}

/**
 * A versão aberta de cada tema, presa à coleção (decisão do dono de 23/10/2026, achado A7 do diagnóstico da busca): a página
 * que o princípio do aperitivo deixa aberta (APERITIVOS em rotasPublicas.ts), na coleção da entrada que a serve; sem entrada
 * aberta no índice (a apresentação do Crédito), na coleção do painel completo, com o nome do tema.
 */
function versoesAbertas(entradas: EntradaBusca[]): Map<string, VersaoAberta> {
  const m = new Map<string, VersaoAberta>();
  for (const a of APERITIVOS) {
    if (!ehRotaPublica(a.rota)) continue;
    const propria = entradas.find((e) => e.href === a.rota && e.aberta && e.colecao);
    const dona = propria ?? entradas.find((e) => e.href === a.painelCompleto && e.colecao);
    if (!dona) continue;
    const chave = `${dona.observatorio}/${dona.colecao}`;
    if (!m.has(chave)) m.set(chave, { titulo: propria?.titulo ?? a.tema, href: a.rota });
  }
  return m;
}
