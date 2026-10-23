/**
 * Medição agregada da busca da plataforma (server-only; docs/observatorios/MEDICAO_DE_USO.md). Cada busca feita soma 1 no
 * contador do dia, do termo normalizado e da presença de conta (uso_busca_dia). Nada que identifique pessoa é gravado: nem
 * conta, nem sessão, nem IP, nem navegador. As regras de coleta são as das páginas (coleta.ts): Do Not Track e Global Privacy
 * Control nunca contam; sem conta, só com USO_ANONIMO_ATIVO=1.
 *
 * O termo é o que o leitor digitou e pode trazer dado pessoal (um nome, um endereço). Por isso o texto só é gravado quando
 * cada palavra dele começa uma palavra do próprio índice da busca (títulos, resumos, termos, nomes de lugares e de coleções),
 * depois de normalizado (normalizar.ts); números de até quatro algarismos (anos) passam. Qualquer outro termo, inclusive o que
 * traz email, cinco algarismos seguidos ou nove no total (CPF, telefone, CEP), mais de seis palavras ou mais de 60 letras, soma
 * num contador único, FORA_DO_INDICE, sem o texto.
 *
 * Ciclo 2 da busca (23/10/2026, decisões do dono registradas no PR do bloco 4; MEDICAO_DE_USO.md §8a):
 *  - a busca da barra que não acha resultado completo também conta, uma vez por termo, com o evento "sem_resultado";
 *  - com conta, o termo com uma palavra fora do vocabulário do índice passa a ser gravado com o texto, marcado
 *    fora_do_vocabulario e apagado depois de 30 dias, quando passa pelo filtro de dado pessoal acima e tem no máximo uma
 *    palavra desconhecida (duas ou mais, como "Maria Silva", podem ser o nome de alguém e continuam no contador sem texto).
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { normalizar } from "@/lib/busca/normalizar";
import { indiceDeBusca } from "@/lib/busca/indice";
import { diaDeBrasilia } from "./coleta";

export const TAMANHO_MAXIMO_TERMO = 60;
export const PALAVRAS_MAXIMAS = 6;

/** Contador das buscas cujo texto não é gravado; "#" nunca sai de normalizar(), então não colide com termo real. */
export const FORA_DO_INDICE = "#fora-do-indice";

let vocabulario: string[] | null = null;
let vocabularioSemNomes: string[] | null = null;
/** As palavras do índice da busca, normalizadas, em ordem: a mesma origem dos resultados que o leitor vê. */
function palavrasDoIndice(): string[] {
  if (vocabulario) return vocabulario;
  const i = indiceDeBusca();
  const textos = [
    ...i.entradas.flatMap((e) => [e.titulo, e.resumo, ...e.termos]),
    ...Object.values(i.lugares).flat(),
    ...i.observatorios.map((o) => o.nome),
    ...i.colecoes.map((c) => c.nome),
  ];
  vocabulario = Array.from(new Set(textos.flatMap((t) => normalizar(t).split(" ")).filter(Boolean))).sort();
  return vocabulario;
}

/**
 * O vocabulário do índice sem as listas de lugares e nomes (capitais, estados, distribuidoras, bancos): é contra ele que se conta
 * a palavra desconhecida do termo que vai com o texto, para um sobrenome ou um nome de lugar ("Maria", de Santa Maria) não
 * passar por palavra conhecida e deixar um nome de pessoa entrar como "uma palavra só".
 */
function palavrasSemNomes(): string[] {
  if (vocabularioSemNomes) return vocabularioSemNomes;
  const i = indiceDeBusca();
  const textos = [...i.entradas.flatMap((e) => [e.titulo, e.resumo, ...e.termos]), ...i.observatorios.map((o) => o.nome), ...i.colecoes.map((c) => c.nome)];
  vocabularioSemNomes = Array.from(new Set(textos.flatMap((t) => normalizar(t).split(" ")).filter(Boolean))).sort();
  return vocabularioSemNomes;
}

/** A palavra começa alguma palavra do índice (busca binária na lista ordenada). */
function noIndice(palavra: string, v: string[] = palavrasDoIndice()): boolean {
  let lo = 0;
  let hi = v.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (v[m] < palavra) lo = m + 1;
    else hi = m;
  }
  return lo < v.length && v[lo].startsWith(palavra);
}

/**
 * Como a busca entra no contador: o termo normalizado, quando é vocabulário do índice; FORA_DO_INDICE, sem o texto, quando
 * não é ou parece dado de alguém; null quando não há termo.
 */
export function termoParaContagem(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const termo = normalizar(bruto);
  if (termo.length < 2) return null;
  if (bruto.includes("@") || termo.length > TAMANHO_MAXIMO_TERMO) return FORA_DO_INDICE;
  // CEP e telefone trazem cinco algarismos seguidos; CPF e telefone com pontuação, nove ou mais no total ("2023 2024" passa)
  if (/\d{5}/.test(termo) || (termo.match(/\d/g)?.length ?? 0) >= 9) return FORA_DO_INDICE;
  const palavras = termo.split(" ");
  if (palavras.length > PALAVRAS_MAXIMAS) return FORA_DO_INDICE;
  return palavras.every((w) => /^\d{1,4}$/.test(w) || noIndice(w)) ? termo : FORA_DO_INDICE;
}

export type EventoBusca = "abriu" | "sem_resultado";
export const EVENTOS_BUSCA: readonly EventoBusca[] = ["abriu", "sem_resultado"];

/** Quantos dias o texto de termo fora do vocabulário fica no banco. */
export const RETENCAO_FORA_DO_VOCABULARIO_DIAS = 30;

/**
 * Como a busca entra no contador, sabendo se há conta: o termo do vocabulário vai com o texto; com conta, o termo que passa pelo
 * filtro de dado pessoal e tem no máximo uma palavra fora do vocabulário também, marcado `foraDoVocabulario`; o resto soma em
 * FORA_DO_INDICE, sem o texto. null quando não há termo.
 */
export function contagemDoTermo(bruto: unknown, comConta: boolean): { termo: string; foraDoVocabulario: boolean } | null {
  const termo = termoParaContagem(bruto);
  if (termo === null) return null;
  if (termo !== FORA_DO_INDICE) return { termo, foraDoVocabulario: false };
  if (!comConta || typeof bruto !== "string" || bruto.includes("@")) return { termo: FORA_DO_INDICE, foraDoVocabulario: false };
  const normal = normalizar(bruto);
  if (normal.length > TAMANHO_MAXIMO_TERMO || /\d{5}/.test(normal) || (normal.match(/\d/g)?.length ?? 0) >= 9) return { termo: FORA_DO_INDICE, foraDoVocabulario: false };
  const palavras = normal.split(" ");
  const desconhecidas = palavras.filter((w) => !/^\d{1,4}$/.test(w) && !noIndice(w, palavrasSemNomes()));
  if (palavras.length > PALAVRAS_MAXIMAS || desconhecidas.length > 1) return { termo: FORA_DO_INDICE, foraDoVocabulario: false };
  return { termo: normal, foraDoVocabulario: true };
}

/**
 * Apaga o texto de termo fora do vocabulário com mais de 30 dias. Não há rotina de retenção em uso_paginas_dia (só contadores
 * sem texto), então a limpeza roda a cada escrita no contador e a cada leitura do painel do admin, qualquer que seja o termo: a
 * linha vencida some mesmo que nenhuma palavra nova apareça depois dela. A tabela é agregada por dia e a chave começa pelo dia,
 * então o DELETE é barato.
 */
async function limparForaDoVocabulario(db: Awaited<ReturnType<typeof getDb>>, agora: Date): Promise<void> {
  const limite = diaDeBrasilia(new Date(agora.getTime() - RETENCAO_FORA_DO_VOCABULARIO_DIAS * 86_400_000));
  const t = schema.usoBuscaDia;
  await db.delete(t).where(and(eq(t.foraDoVocabulario, true), lt(t.dia, limite)));
}

/** A mesma limpeza, para o painel do admin chamar antes de ler. Falha de banco não derruba a leitura. */
export async function apagarTermosVencidos(agora = new Date()): Promise<void> {
  try {
    await limparForaDoVocabulario(await getDb(), agora);
  } catch {
    // a leitura segue; a próxima escrita tenta de novo
  }
}

/** Soma uma busca ao contador agregado. Falha de banco nunca derruba a requisição: devolve false. */
export async function registrarBusca(
  termo: string,
  comConta: boolean,
  agora = new Date(),
  { evento = "abriu" as EventoBusca }: { evento?: EventoBusca } = {},
): Promise<boolean> {
  if (!EVENTOS_BUSCA.includes(evento)) return false;
  // o termo é conferido de novo aqui: quem chama não decide sozinho o que vai para o banco
  const conta = termo === FORA_DO_INDICE ? { termo, foraDoVocabulario: false } : contagemDoTermo(termo, comConta);
  if (!conta || conta.termo !== termo) return false;
  try {
    const db = await getDb();
    const t = schema.usoBuscaDia;
    await db
      .insert(t)
      .values({ dia: diaDeBrasilia(agora), termo, comConta, evento, foraDoVocabulario: conta.foraDoVocabulario, buscas: 1 })
      .onConflictDoUpdate({ target: [t.dia, t.termo, t.comConta, t.evento], set: { buscas: sql`${t.buscas} + 1` } });
    await limparForaDoVocabulario(db, agora);
    return true;
  } catch {
    return false;
  }
}
