import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { getDb, schema } from "./db";
import { ABAS_OBSERVATORIO } from "./data/observatorioAbas";

/**
 * Boletim mensal por e-mail — o mecanismo de retorno do usuário cadastrado.
 * O conteúdo vem da central de alertas do Observatório (camada gold, texto
 * puro, sem PII); o envio respeita o consentimento de comunicações dado no
 * cadastro (marketingOptIn) e todo e-mail carrega link de saída de um
 * clique, assinado por HMAC — sem login, sem expor e-mail na URL.
 */

const BASE = "https://scrutiniums.com";

/* ------------------------------------------------------------------ */
/* Conteúdo (função sobre o gold; nada de texto livre por usuário)     */
/* ------------------------------------------------------------------ */

type AlertaCentral = {
  familia: string;
  nivel: string;
  titulo: string;
  fonte?: string;
  link?: { view?: string };
  ordem?: number;
};

type CentralAlertas = {
  gerado_em: string;
  total: number;
  familias: { id: string; nome: string }[];
  alertas: AlertaCentral[];
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
function lerGold(nome: string): any {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"),
    );
  } catch {
    return null;
  }
}

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function rotuloMes(data: Date): string {
  return `${MESES_PT[data.getMonth()]} de ${data.getFullYear()}`;
}

function urlDaView(view?: string): string {
  const aba = view ? ABAS_OBSERVATORIO.find((a) => a.view === view) : null;
  return `${BASE}/observatorio${aba ? aba.caminho : "/alerts"}`;
}

const NIVEL_ROTULO: Record<string, string> = {
  critico: "CRÍTICO",
  relevante: "relevante",
  atencao: "atenção",
  informativo: "informativo",
};

/** Quantos alertas entram na lista detalhada do e-mail. */
const MAX_ALERTAS = 8;

export type Boletim = { subject: string; corpo: string };

/**
 * Monta assunto e corpo (sem rodapé por destinatário) a partir da central
 * de alertas e das data-bases do meta.json. Retorna null se o gold não
 * estiver disponível — o boletim nunca é enviado vazio.
 */
export function montarBoletim(agora: Date): Boletim | null {
  const central = lerGold("alertas_central") as CentralAlertas | null;
  if (!central?.alertas?.length) return null;
  const meta = lerGold("meta");

  const porFamilia = new Map<string, number>();
  for (const a of central.alertas) {
    porFamilia.set(a.familia, (porFamilia.get(a.familia) ?? 0) + 1);
  }
  const nomesFamilia = new Map((central.familias ?? []).map((f) => [f.id, f.nome]));
  const resumoFamilias = Array.from(porFamilia.entries())
    .map(([id, n]) => `${nomesFamilia.get(id) ?? id}: ${n}`)
    .join(" · ");

  // A ordenação é a da própria central (campo `ordem`); o boletim não
  // inventa ranking de severidade próprio.
  const destaque = [...central.alertas]
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
    .slice(0, MAX_ALERTAS);

  const linhasAlertas = destaque.map((a) => {
    const nivel = NIVEL_ROTULO[a.nivel] ?? a.nivel;
    const fonte = a.fonte ? ` (${a.fonte})` : "";
    return `- [${nivel}] ${a.titulo}${fonte}\n  ${urlDaView(a.link?.view)}`;
  });

  const vintages: Record<string, string> = meta?.vintages ?? {};
  const linhasVintages = [
    ["sgs", "Banco Central (séries mensais)"],
    ["scr", "SCR (crédito por estado)"],
    ["ifdata", "IF.data (instituições)"],
  ]
    .filter(([k]) => vintages[k])
    .map(([k, rotulo]) => `- ${rotulo}: dados até ${vintages[k]}`);

  const total = central.total ?? central.alertas.length;
  const subject = `Boletim Scrutiniums · ${rotuloMes(agora)} — ${total} alertas ativos no crédito`;

  const corpo = [
    "Boletim mensal do Observatório Brasileiro de Crédito.",
    "",
    `ALERTAS ATIVOS: ${total}`,
    resumoFamilias ? `Por família — ${resumoFamilias}.` : "",
    "",
    "Os primeiros da central, na ordenação dela:",
    "",
    ...linhasAlertas,
    "",
    `Central completa (com regra, limiar e evidência de persistência de cada alerta):`,
    `${BASE}/observatorio/alerts`,
    "",
    ...(linhasVintages.length > 0 ? ["DATA-BASE DAS FONTES", ...linhasVintages, ""] : []),
    "Todo o Observatório é aberto, sem cadastro:",
    `- Visão geral: ${BASE}/observatorio`,
    `- Bets e risco financeiro: ${BASE}/observatorio/bets-financial-risk`,
    `- Fraudes financeiras: ${BASE}/observatorio/financial-fraud`,
    `- Números citáveis para a imprensa: ${BASE}/imprensa`,
    "",
    "Alertas são sinais determinísticos sobre séries oficiais — nunca recomendação",
    "de investimento nem previsão. Cada número declara fonte e data-base.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, corpo };
}

/** Rodapé por destinatário: consentimento declarado + saída de um clique. */
export function rodapeBoletim(urlSair: string): string {
  return [
    "",
    "—",
    "Você recebe este boletim porque aceitou comunicações da Scrutiniums no cadastro.",
    `Para deixar de receber: ${urlSair}`,
    "Scrutiniums · 100% gratuito · sem assinatura · sem cobrança",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Link de saída assinado (sem login, sem PII na URL)                  */
/* ------------------------------------------------------------------ */

function segredo(): string {
  const s = process.env.COOKIE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-cookie-secret-inseguro";
}

const PROPOSITO = "boletim-sair";

export function assinarSaidaBoletim(userId: string): string {
  const mac = createHmac("sha256", segredo()).update(`${PROPOSITO}.${userId}`).digest("hex");
  return `${userId}.${mac}`;
}

export function verificarSaidaBoletim(token: string): string | null {
  if (!segredo()) return null;
  const separador = token.lastIndexOf(".");
  if (separador <= 0) return null;
  const userId = token.slice(0, separador);
  const mac = token.slice(separador + 1);
  const esperado = createHmac("sha256", segredo()).update(`${PROPOSITO}.${userId}`).digest("hex");
  if (mac.length !== esperado.length) return null;
  if (!timingSafeEqual(Buffer.from(mac, "utf-8"), Buffer.from(esperado, "utf-8"))) return null;
  return userId;
}

export function urlSaidaBoletim(userId: string): string {
  return `${BASE}/boletim/sair?token=${encodeURIComponent(assinarSaidaBoletim(userId))}`;
}

/* ------------------------------------------------------------------ */
/* Destinatários e guarda de reenvio                                   */
/* ------------------------------------------------------------------ */

/** Quem recebe: onboarding completo E consentimento de comunicações. */
export async function destinatariosBoletim(): Promise<{ id: string; email: string }[]> {
  const db = await getDb();
  return db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.onboardingStatus, "COMPLETE"),
        eq(schema.users.marketingOptIn, true),
      ),
    );
}

/** Um envio por mês-calendário: evita duplicar disparo (cron + manual). */
export async function boletimEnviadoNoMes(agora: Date): Promise<boolean> {
  const db = await getDb();
  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const rows = await db
    .select({ id: schema.productEvents.id })
    .from(schema.productEvents)
    .where(
      and(
        eq(schema.productEvents.name, "boletim_enviado"),
        gte(schema.productEvents.createdAt, inicioDoMes),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
