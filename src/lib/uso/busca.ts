/**
 * Medição agregada da busca da plataforma (server-only; docs/observatorios/MEDICAO_DE_USO.md). Cada busca feita soma 1 no
 * contador do dia, do termo normalizado e da presença de conta (uso_busca_dia). Nada que identifique pessoa é gravado: nem
 * conta, nem sessão, nem IP, nem navegador. As regras de coleta são as das páginas (coleta.ts): Do Not Track e Global Privacy
 * Control nunca contam; sem conta, só com USO_ANONIMO_ATIVO=1.
 *
 * O termo é o que o leitor digitou e pode trazer dado pessoal; antes de gravar, ele é normalizado (normalizar.ts) e recusado
 * quando parece dado de alguém: endereço de email, cinco algarismos seguidos ou nove no total (CPF, telefone, CEP, conta), mais
 * de seis palavras ou mais de 60 letras.
 */
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { normalizar } from "@/lib/busca/normalizar";
import { diaDeBrasilia } from "./coleta";

export const TAMANHO_MAXIMO_TERMO = 60;
export const PALAVRAS_MAXIMAS = 6;

/** Termo como entra no contador, ou null quando não deve ser gravado. */
export function termoParaContagem(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  if (bruto.includes("@")) return null;
  const termo = normalizar(bruto);
  if (termo.length < 2 || termo.length > TAMANHO_MAXIMO_TERMO) return null;
  // CEP e telefone trazem cinco algarismos seguidos; CPF e telefone com pontuação, nove ou mais no total ("2023 2024" passa)
  if (/\d{5}/.test(termo) || (termo.match(/\d/g)?.length ?? 0) >= 9) return null;
  if (termo.split(" ").length > PALAVRAS_MAXIMAS) return null;
  return termo;
}

/** Soma uma busca ao contador agregado. Falha de banco nunca derruba a requisição: devolve false. */
export async function registrarBusca(termo: string, comConta: boolean, agora = new Date()): Promise<boolean> {
  if (termoParaContagem(termo) !== termo) return false;
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
