/**
 * Recortes salvos pela conta: o endereço interno da página com a consulta e a
 * âncora, um título e o observatório de origem. Cada operação filtra pelo dono:
 * uma conta nunca lê, renomeia nem apaga recorte de outra.
 */
import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb, newId, schema } from "@/lib/db";
import { safeInternalPath } from "@/lib/onboarding";
import { ehOrigem } from "./origens";

/** Limite por conta. */
export const LIMITE_RECORTES = 50;
export const TITULO_MAX = 120;
export const CAMINHO_MAX = 2000;

export type Recorte = typeof schema.recortesSalvos.$inferSelect;

/** Título aparado, numa linha, de 1 a 120 caracteres; fora disso, nulo. */
export function tituloValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= TITULO_MAX ? t : null;
}

/**
 * Caminho interno da plataforma (começa com uma barra, sem domínio, sem /api) e
 * de até 2.000 caracteres; é o próprio link compartilhável. A área da conta
 * (/app) fica de fora: não é recorte de dado.
 */
export function caminhoValido(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > CAMINHO_MAX) return null;
  const c = safeInternalPath(valor);
  if (!c) return null;
  if (c === "/app" || c.startsWith("/app/") || c.startsWith("/app?") || c.startsWith("/app#")) return null;
  return c;
}

export async function listarRecortes(userId: string): Promise<Recorte[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.recortesSalvos)
    .where(eq(schema.recortesSalvos.userId, userId))
    .orderBy(desc(schema.recortesSalvos.criadoEm), asc(schema.recortesSalvos.id));
}

export type ResultadoCriar =
  | { tipo: "criado"; recorte: Recorte }
  | { tipo: "existente"; recorte: Recorte }
  | { tipo: "limite" }
  | { tipo: "invalido"; campo: "titulo" | "caminho" | "observatorio" };

/** Salva o recorte. O mesmo caminho salvo de novo devolve o existente; acima do limite, nada é gravado. */
export async function criarRecorte(
  userId: string,
  dados: { titulo: unknown; caminho: unknown; observatorio: unknown },
  agora = new Date(),
): Promise<ResultadoCriar> {
  const titulo = tituloValido(dados.titulo);
  if (!titulo) return { tipo: "invalido", campo: "titulo" };
  const caminho = caminhoValido(dados.caminho);
  if (!caminho) return { tipo: "invalido", campo: "caminho" };
  if (!ehOrigem(dados.observatorio)) return { tipo: "invalido", campo: "observatorio" };
  const db = await getDb();
  const t = schema.recortesSalvos;
  const [existente] = await db.select().from(t).where(and(eq(t.userId, userId), eq(t.caminho, caminho))).limit(1);
  if (existente) return { tipo: "existente", recorte: existente };
  const [{ n }] = await db.select({ n: count() }).from(t).where(eq(t.userId, userId));
  if (Number(n) >= LIMITE_RECORTES) return { tipo: "limite" };
  const [recorte] = await db
    .insert(t)
    .values({ id: newId(), userId, titulo, caminho, observatorio: dados.observatorio, criadoEm: agora })
    .returning();
  return { tipo: "criado", recorte };
}

/** Renomeia; devolve nulo quando o recorte não existe ou é de outra conta. */
export async function renomearRecorte(userId: string, id: string, titulo: unknown): Promise<Recorte | null | "invalido"> {
  const novo = tituloValido(titulo);
  if (!novo) return "invalido";
  const db = await getDb();
  const t = schema.recortesSalvos;
  const [r] = await db.update(t).set({ titulo: novo }).where(and(eq(t.id, id), eq(t.userId, userId))).returning();
  return r ?? null;
}

/** Apaga; devolve false quando o recorte não existe ou é de outra conta. */
export async function apagarRecorte(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const t = schema.recortesSalvos;
  const r = await db.delete(t).where(and(eq(t.id, id), eq(t.userId, userId))).returning({ id: t.id });
  return r.length > 0;
}
