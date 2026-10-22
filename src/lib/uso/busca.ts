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
 */
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { normalizar } from "@/lib/busca/normalizar";
import { indiceDeBusca } from "@/lib/busca/indice";
import { diaDeBrasilia } from "./coleta";

export const TAMANHO_MAXIMO_TERMO = 60;
export const PALAVRAS_MAXIMAS = 6;

/** Contador das buscas cujo texto não é gravado; "#" nunca sai de normalizar(), então não colide com termo real. */
export const FORA_DO_INDICE = "#fora-do-indice";

let vocabulario: string[] | null = null;
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

/** A palavra começa alguma palavra do índice (busca binária na lista ordenada). */
function noIndice(palavra: string): boolean {
  const v = palavrasDoIndice();
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

/** Soma uma busca ao contador agregado. Falha de banco nunca derruba a requisição: devolve false. */
export async function registrarBusca(termo: string, comConta: boolean, agora = new Date()): Promise<boolean> {
  if (termo !== FORA_DO_INDICE && termoParaContagem(termo) !== termo) return false;
  try {
    const db = await getDb();
    const t = schema.usoBuscaDia;
    await db
      .insert(t)
      .values({ dia: diaDeBrasilia(agora), termo, comConta, buscas: 1 })
      .onConflictDoUpdate({ target: [t.dia, t.termo, t.comConta], set: { buscas: sql`${t.buscas} + 1` } });
    return true;
  } catch {
    return false;
  }
}
