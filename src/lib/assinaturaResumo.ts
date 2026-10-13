/**
 * Assinatura do resumo do crédito por e-mail, sem conta.
 *
 * Ciclo: o formulário de /resumo cria a assinatura PENDENTE (com o consentimento
 * marcado) e envia um link de confirmação; só o clique no link a deixa ATIVA.
 * Todo e-mail do resumo traz descadastro em um clique (link no rodapé e
 * List-Unsubscribe-Post, RFC 8058); o descadastro apaga a linha. Respostas do
 * formulário são sempre genéricas: nada revela se um endereço já assina.
 *
 * Periodicidade:
 * - diária: um e-mail a cada NOVA publicação do crédito (edição = `gerado_em`
 *   do meta.json). Sem publicação nova, nada é enviado: o resumo não se repete.
 * - semanal: um e-mail às segundas-feiras (horário de Brasília) com a última
 *   publicação, com aviso de atraso quando ela tem 2 dias ou mais.
 */
import { and, eq, lt } from "drizzle-orm";
import { getDb, newId, schema } from "./db";
import { BASE } from "./boletim";
import { assinarToken, verificarToken } from "./tokenAssinado";
import { fmtPercentil, fmtRefMes, fmtValor, geradoEmPublicado, indicadoresPublicos, resumoDiario } from "./dadosPublicos";
import { situacaoFrescor } from "./frescor";

export const PERIODICIDADES = ["diaria", "semanal"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];
export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  diaria: "diária (a cada nova publicação)",
  semanal: "semanal (às segundas-feiras)",
};

/** Resposta única do formulário, exista ou não assinatura para o endereço. */
export const RESPOSTA_GENERICA =
  "Se o endereço for válido, enviamos um link de confirmação. A assinatura só começa depois do clique nesse link.";

/** Validade do link de confirmação; pendências mais velhas que isso são apagadas no envio. */
export const VALIDADE_CONFIRMACAO_DIAS = 7;
const DIA_MS = 86_400_000;

const P_CONFIRMAR = "resumo-confirmar";
const P_SAIR = "resumo-sair";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

export function tokenConfirmacao(id: string, periodicidade: Periodicidade, agora: Date): string {
  const expira = Math.floor(agora.getTime() / 1000) + VALIDADE_CONFIRMACAO_DIAS * 86_400;
  return assinarToken(P_CONFIRMAR, `${id}~${periodicidade}~${expira}`);
}

export function lerTokenConfirmacao(token: string, agora: Date): { id: string; periodicidade: Periodicidade } | null {
  const payload = verificarToken(P_CONFIRMAR, token);
  if (!payload) return null;
  const [id, periodicidade, expira] = payload.split("~");
  if (!id || !PERIODICIDADES.includes(periodicidade as Periodicidade)) return null;
  if (!Number.isFinite(Number(expira)) || Number(expira) * 1000 < agora.getTime()) return null;
  return { id, periodicidade: periodicidade as Periodicidade };
}

export const tokenSaida = (id: string) => assinarToken(P_SAIR, id);
export const lerTokenSaida = (token: string) => verificarToken(P_SAIR, token);

export const urlConfirmacao = (token: string) => `${BASE}/resumo/assinatura/confirmar?token=${encodeURIComponent(token)}`;
export const urlSaidaPagina = (id: string) => `${BASE}/resumo/assinatura/sair?token=${encodeURIComponent(tokenSaida(id))}`;
export const urlSaidaUmClique = (id: string) => `${BASE}/api/resumo/assinatura/sair?token=${encodeURIComponent(tokenSaida(id))}`;

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

export type Assinatura = typeof schema.assinaturasResumo.$inferSelect;

/**
 * Registra o pedido e devolve o link de confirmação a enviar. Assinatura já
 * ATIVA continua ativa: a troca de periodicidade também passa pelo link, para
 * que ninguém mude a assinatura de outra pessoa sem acesso à caixa dela.
 */
export async function pedirAssinatura(email: string, periodicidade: Periodicidade, agora: Date): Promise<{ id: string; token: string }> {
  const db = await getDb();
  const endereco = email.trim().toLowerCase();
  const [existente] = await db.select().from(schema.assinaturasResumo).where(eq(schema.assinaturasResumo.email, endereco)).limit(1);
  let id: string;
  if (existente) {
    id = existente.id;
    if (existente.status !== "ATIVA") {
      await db
        .update(schema.assinaturasResumo)
        .set({ periodicidade, consentimentoEm: agora })
        .where(eq(schema.assinaturasResumo.id, id));
    }
  } else {
    id = newId();
    await db.insert(schema.assinaturasResumo).values({
      id,
      email: endereco,
      periodicidade,
      status: "PENDENTE",
      consentimentoEm: agora,
      createdAt: agora,
    });
  }
  return { id, token: tokenConfirmacao(id, periodicidade, agora) };
}

export async function confirmarAssinatura(token: string, agora: Date): Promise<boolean> {
  const t = lerTokenConfirmacao(token, agora);
  if (!t) return false;
  const db = await getDb();
  const r = await db
    .update(schema.assinaturasResumo)
    .set({ status: "ATIVA", periodicidade: t.periodicidade, confirmadaEm: agora })
    .where(eq(schema.assinaturasResumo.id, t.id))
    .returning({ id: schema.assinaturasResumo.id });
  return r.length > 0;
}

/** Descadastro: apaga a assinatura. Idempotente; token inválido devolve false. */
export async function cancelarAssinatura(token: string): Promise<boolean> {
  const id = lerTokenSaida(token);
  if (!id) return false;
  const db = await getDb();
  await db.delete(schema.assinaturasResumo).where(eq(schema.assinaturasResumo.id, id));
  return true;
}

/** Pendências não confirmadas dentro da validade do link são apagadas. */
export async function purgarPendentes(agora: Date): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.assinaturasResumo)
    .where(
      and(
        eq(schema.assinaturasResumo.status, "PENDENTE"),
        lt(schema.assinaturasResumo.consentimentoEm, new Date(agora.getTime() - VALIDADE_CONFIRMACAO_DIAS * DIA_MS)),
      ),
    );
}

/* ------------------------------------------------------------------ */
/* Quem recebe                                                         */
/* ------------------------------------------------------------------ */

function diaDaSemanaBrasilia(d: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nome);
}

export function deveReceber(
  a: Pick<Assinatura, "status" | "periodicidade" | "ultimaEdicao" | "ultimoEnvioEm">,
  edicao: string,
  agora: Date,
): boolean {
  if (a.status !== "ATIVA") return false;
  if (a.periodicidade === "diaria") return a.ultimaEdicao !== edicao;
  if (a.periodicidade === "semanal") {
    if (diaDaSemanaBrasilia(agora) !== 1) return false;
    return !a.ultimoEnvioEm || agora.getTime() - a.ultimoEnvioEm.getTime() >= 6 * DIA_MS;
  }
  return false;
}

export async function registrarEnvio(id: string, edicao: string, agora: Date): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.assinaturasResumo)
    .set({ ultimaEdicao: edicao, ultimoEnvioEm: agora })
    .where(eq(schema.assinaturasResumo.id, id));
}

export async function assinaturasAtivas(): Promise<Assinatura[]> {
  const db = await getDb();
  return db.select().from(schema.assinaturasResumo).where(eq(schema.assinaturasResumo.status, "ATIVA"));
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

const nbr = (v: number, dec = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function emailConfirmacao(periodicidade: Periodicidade, token: string): { subject: string; text: string } {
  return {
    subject: "Confirme a assinatura do resumo do crédito",
    text: [
      `Recebemos um pedido de assinatura ${ROTULO_PERIODICIDADE[periodicidade]} do resumo do crédito da Scrutiniums para este endereço.`,
      "",
      "Para confirmar, abra o link e clique em Confirmar:",
      urlConfirmacao(token),
      "",
      `O link vale por ${VALIDADE_CONFIRMACAO_DIAS} dias. Se você não fez o pedido, ignore esta mensagem: sem a confirmação, nada será enviado e o pedido é apagado.`,
      "",
      "Scrutiniums · 100% gratuito · sem assinatura paga · sem cobrança",
    ].join("\n"),
  };
}

/**
 * Corpo do resumo (texto puro, igual para todos os destinatários) a partir do
 * gold publicado. Devolve null sem diagnóstico: o resumo nunca sai vazio.
 */
export function montarResumoEmail(agora: Date): { edicao: string; subject: string; corpo: string } | null {
  const r = resumoDiario();
  const edicao = geradoEmPublicado();
  if (!r || !edicao) return null;
  const f = situacaoFrescor(edicao, agora);
  const inds = indicadoresPublicos();
  const mudanca = (m: { indicador: string; anterior: number; atual: number; unidade: string; fonte: string; serie: string }) => {
    const mi = m.unidade === "R$ milhões";
    const v = (x: number) => (mi ? (x >= 1e6 ? `R$ ${nbr(x / 1e6)} tri` : `R$ ${nbr(x / 1e3, 1)} bi`) : nbr(x));
    return `- ${m.indicador}: ${v(m.anterior)} → ${v(m.atual)} (${m.fonte} ${m.serie})`;
  };
  const corpo = [
    "Resumo do crédito no Brasil · Scrutiniums",
    `Publicação de ${f?.publicadoEm ?? edicao} (Brasília) · referência ${fmtRefMes(r.refDiagnostico)} · confiança ${r.confianca}`,
    ...(f?.atrasado
      ? ["", `ATENÇÃO: esta é a última publicação disponível, feita ${f.idade}. O processamento diário não publicou dados novos desde então.`]
      : []),
    "",
    "DIAGNÓSTICO (dado calculado, frase montada por regras)",
    r.frase,
    `IBCC ${nbr(r.ibcc.atual, 1)}, percentil histórico ${fmtPercentil(r.ibcc.percentil)}. Método: ${r.metodo}`,
    "",
    "PRINCIPAIS DETERIORAÇÕES DO MÊS",
    ...r.deterioracoes.map(mudanca),
    "",
    "PRINCIPAIS MELHORAS DO MÊS",
    ...r.melhoras.map(mudanca),
    "",
    "NÚMEROS CENTRAIS (dado observado)",
    ...inds.map((i) => `- ${i.tituloCurto}: ${fmtValor(i, i.valor)} (ref. ${fmtRefMes(i.ref)}; ${i.fonte} ${i.serieCodigo})`),
    "",
    `Página completa, com séries e métodos: ${BASE}/resumo`,
    `Índice de condições de crédito (IBCC): ${BASE}/dados/ibcc`,
  ].join("\n");
  const subject = `Resumo do crédito · ${f?.publicadoEm.slice(0, 10) ?? edicao.slice(0, 10)} · IBCC ${nbr(r.ibcc.atual, 1)}`;
  return { edicao, subject, corpo };
}

export function rodapeResumo(a: Pick<Assinatura, "id" | "periodicidade">): string {
  const p = (PERIODICIDADES.includes(a.periodicidade as Periodicidade) ? a.periodicidade : "diaria") as Periodicidade;
  return [
    "",
    "---",
    `Você recebe este e-mail porque confirmou a assinatura ${ROTULO_PERIODICIDADE[p]} do resumo do crédito em scrutiniums.com.`,
    `Para deixar de receber, em um clique: ${urlSaidaPagina(a.id)}`,
    "Tratamento dos dados: https://scrutiniums.com/privacidade",
  ].join("\n");
}

/** Cabeçalhos de descadastro em um clique pelo próprio cliente de e-mail (RFC 2369 e RFC 8058). */
export function cabecalhosSaida(id: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${urlSaidaUmClique(id)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
