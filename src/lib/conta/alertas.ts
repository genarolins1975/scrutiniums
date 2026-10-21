/**
 * Alerta de atualização por fonte de dados (domínio de src/lib/frescor/limiares.json).
 *
 * Ciclo:
 * - a conta assina um domínio; a linha guarda a referência publicada naquele
 *   momento (`referenciaAvisada`), para que o primeiro aviso só saia quando
 *   houver dado novo de fato;
 * - o disparo diário (/api/alertas/enviar, chamado pelo workflow
 *   alertas-atualizacao.yml) lê a referência publicada neste deploy e envia um
 *   e-mail a cada assinatura cuja referência avançou. A reserva é atômica:
 *   dois disparos em paralelo não mandam o mesmo aviso duas vezes; envio que
 *   falha devolve a reserva;
 * - a conta cancela na página da conta ou em um clique pelo próprio cliente de
 *   e-mail (List-Unsubscribe-Post, RFC 8058).
 */
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDb, newId, schema } from "@/lib/db";
import { BASE } from "@/lib/boletim";
import { assinarToken, verificarToken } from "@/lib/tokenAssinado";
import { cadenciaDe, dataPublicacao, rotuloReferencia, textosDominio, type DadosFrescor, type DominioFrescorId } from "@/lib/frescor";
import { ENTRADA_DO_DOMINIO } from "./origens";
import { frescorAgora, type Leitor, lerDoDisco } from "./metadados";

export type Alerta = typeof schema.alertasAtualizacao.$inferSelect;

export async function listarAlertas(userId: string): Promise<Alerta[]> {
  const db = await getDb();
  const t = schema.alertasAtualizacao;
  return db.select().from(t).where(eq(t.userId, userId)).orderBy(asc(t.criadoEm), asc(t.dominio));
}

/** Assina (idempotente): a referência de partida é a publicada agora. */
export async function assinarAlerta(userId: string, dominio: DominioFrescorId, agora = new Date(), ler: Leitor = lerDoDisco): Promise<Alerta> {
  const db = await getDb();
  const t = schema.alertasAtualizacao;
  await db
    .insert(t)
    .values({ id: newId(), userId, dominio, referenciaAvisada: frescorAgora(dominio, ler).referencia, criadoEm: agora })
    .onConflictDoNothing({ target: [t.userId, t.dominio] });
  const [a] = await db.select().from(t).where(and(eq(t.userId, userId), eq(t.dominio, dominio))).limit(1);
  return a;
}

/** Cancela; devolve false quando a conta não assinava o domínio. */
export async function cancelarAlerta(userId: string, dominio: string): Promise<boolean> {
  const db = await getDb();
  const t = schema.alertasAtualizacao;
  const r = await db.delete(t).where(and(eq(t.userId, userId), eq(t.dominio, dominio))).returning({ id: t.id });
  return r.length > 0;
}

/** A referência publicada avançou em relação à que a pessoa conhece? Sem referência publicada, nunca. */
export function referenciaAvancou(conhecida: string | null, atual: string | null): boolean {
  if (!atual) return false;
  return conhecida === null || atual > conhecida;
}

/* ---------------- disparo ---------------- */

/** Janela em que uma verificação registrada vale como prova de que o disparo diário está funcionando. */
export const JANELA_VERIFICACAO_DIAS = 3;

/**
 * O envio está ligado de fato? Só quando há provedor de e-mail configurado E o disparo diário rodou autorizado nos
 * últimos três dias (evento "alertas_verificacao", gravado pela rota de disparo). Sem isso, a interface diz que a
 * assinatura fica registrada e que nenhum e-mail sai ainda: em 19/10/2026 o segredo do disparo agendado
 * (BOLETIM_SECRET) faltava no GitHub Actions e os envios do resumo falhavam antes de chamar a rota.
 */
export async function envioLigado(agora = new Date()): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const db = await getDb();
    const t = schema.productEvents;
    const desde = new Date(agora.getTime() - JANELA_VERIFICACAO_DIAS * 86_400_000);
    const [e] = await db.select({ id: t.id }).from(t).where(and(eq(t.name, "alertas_verificacao"), gt(t.createdAt, desde))).limit(1);
    return !!e;
  } catch {
    return false;
  }
}

type AlvoAlerta = Pick<Alerta, "id" | "userId" | "dominio" | "referenciaAvisada" | "ultimoEnvioEm"> & { email: string };

export async function assinaturasComEmail(): Promise<AlvoAlerta[]> {
  const db = await getDb();
  const t = schema.alertasAtualizacao;
  return db
    .select({
      id: t.id,
      userId: t.userId,
      dominio: t.dominio,
      referenciaAvisada: t.referenciaAvisada,
      ultimoEnvioEm: t.ultimoEnvioEm,
      email: schema.users.email,
    })
    .from(t)
    .innerJoin(schema.users, eq(schema.users.id, t.userId))
    .orderBy(asc(t.dominio), asc(t.criadoEm));
}

/**
 * Reserva atômica antes do envio: só pega a linha se ela ainda conhece a mesma
 * referência lida antes (outro disparo não a avançou no meio do caminho).
 */
export async function reservarAviso(a: Pick<Alerta, "id" | "referenciaAvisada">, atual: string, agora: Date): Promise<boolean> {
  const db = await getDb();
  const t = schema.alertasAtualizacao;
  const mesma = a.referenciaAvisada === null ? isNull(t.referenciaAvisada) : eq(t.referenciaAvisada, a.referenciaAvisada);
  const r = await db
    .update(t)
    .set({ referenciaAvisada: atual, ultimoEnvioEm: agora })
    .where(and(eq(t.id, a.id), mesma))
    .returning({ id: t.id });
  return r.length > 0;
}

/** Envio que falhou devolve a reserva: o aviso volta a ser elegível no próximo disparo. */
export async function liberarAviso(a: Pick<Alerta, "id" | "referenciaAvisada" | "ultimoEnvioEm">): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.alertasAtualizacao)
    .set({ referenciaAvisada: a.referenciaAvisada, ultimoEnvioEm: a.ultimoEnvioEm })
    .where(eq(schema.alertasAtualizacao.id, a.id));
}

/** Referência publicada de cada domínio com assinatura, lida uma vez por disparo. */
export function referenciasPublicadas(dominios: Iterable<string>, ler: Leitor = lerDoDisco): Map<string, DadosFrescor> {
  const m = new Map<string, DadosFrescor>();
  for (const d of dominios) if (!m.has(d) && d in ENTRADA_DO_DOMINIO) m.set(d, frescorAgora(d as DominioFrescorId, ler));
  return m;
}

/* ---------------- conteúdo ---------------- */

const P_SAIR = "alerta-sair";
export const tokenSaidaAlerta = (id: string) => assinarToken(P_SAIR, id);
export const lerTokenSaidaAlerta = (token: string) => verificarToken(P_SAIR, token);
export const urlSaidaUmClique = (id: string) => `${BASE}/api/alertas/sair?token=${encodeURIComponent(tokenSaidaAlerta(id))}`;

/** Cancela pelo token do e-mail (descadastro em um clique). Idempotente; token inválido devolve false. */
export async function cancelarPorToken(token: string): Promise<boolean> {
  const id = lerTokenSaidaAlerta(token);
  if (!id) return false;
  const db = await getDb();
  await db.delete(schema.alertasAtualizacao).where(eq(schema.alertasAtualizacao.id, id));
  return true;
}

/** E-mail do aviso (texto puro): o domínio, a referência anterior e a nova, a publicação e o caminho do painel. */
export function emailAlerta(dominio: DominioFrescorId, anterior: string | null, f: DadosFrescor): { subject: string; text: string } {
  const t = textosDominio(dominio);
  const nova = rotuloReferencia(f.referencia) ?? "não informada";
  const antes = rotuloReferencia(anterior);
  const pub = dataPublicacao(f.publicadoEm);
  return {
    subject: `Dados novos: ${t.nome} · referência ${nova}`,
    text: [
      `Os dados de ${t.nome} na Scrutiniums foram atualizados.`,
      "",
      `${t.rotulo}.`,
      `Referência mais recente (${t.referencia}): ${nova}${antes ? ` (antes: ${antes})` : ""}.`,
      ...(pub ? [`Publicado na plataforma em ${pub} (calendário de Brasília).`] : []),
      `Cadência esperada desta fonte: ${cadenciaDe(dominio).rotulo}.`,
      "",
      `Painel: ${BASE}${ENTRADA_DO_DOMINIO[dominio]}`,
    ].join("\n"),
  };
}

export function rodapeAlerta(dominio: DominioFrescorId): string {
  return [
    "",
    "---",
    `Você recebe este aviso porque pediu, na sua conta da Scrutiniums, para ser avisado quando os dados de ${textosDominio(dominio).nome} forem atualizados.`,
    `Para cancelar este ou outros avisos: ${BASE}/app/conta#alertas`,
    "Tratamento dos dados: https://scrutiniums.com/privacidade",
  ].join("\n");
}

export function cabecalhosSaidaAlerta(id: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${urlSaidaUmClique(id)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
