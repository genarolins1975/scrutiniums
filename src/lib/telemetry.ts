import { getDb, newId, schema } from "./db";

/**
 * Telemetria de navegação da área logada — SEM PII.
 * Registramos apenas QUAL seção foi aberta e QUANDO, associada ao id
 * interno do usuário (nunca e-mail/telefone). A lista de seções é fechada
 * (allowlist): qualquer valor fora dela é descartado silenciosamente,
 * impedindo gravação de caminhos arbitrários no banco.
 */

export const VIEW_SECTIONS = [
  // Observatório (abas da SPA)
  "obs:mapa",
  "obs:overview",
  "obs:panorama",
  "obs:pulse",
  "obs:antecedentes",
  "obs:leading",
  "obs:trends",
  "obs:sectors",
  "obs:sector",
  "obs:rj",
  "obs:institutions",
  "obs:inst",
  "obs:products",
  "obs:product",
  "obs:compare",
  "obs:market",
  "obs:openfinance",
  "obs:scenarios",
  "obs:alerts",
  "obs:research",
  "obs:method",
  "obs:bets",
  "obs:fraudes",
  "obs:juros",
  "obs:operacional",
  "obs:rural",
  "obs:ampliado",
  "obs:bndes",
  "obs:estados",
  "obs:estado",
  "obs:sfn",
  "obs:conduta",
  "obs:emprego",
  "obs:funding",
  "obs:consorcios",
  "obs:cobranca",
  "obs:sugestoes",
  // Plataforma (páginas Next)
  "app:conta",
] as const;

export type ViewSection = (typeof VIEW_SECTIONS)[number];

const SECTIONS = new Set<string>(VIEW_SECTIONS);

/** Rótulos exibidos no painel de administração. */
export const SECTION_LABELS: Record<ViewSection, string> = {
  "obs:mapa": "Observatório · Mapa do Observatório",
  "obs:overview": "Observatório · Visão geral",
  "obs:panorama": "Observatório · Quem toma crédito e onde",
  "obs:pulse": "Observatório · Pulso do crédito",
  "obs:antecedentes": "Observatório · Ciclo & Antecedentes",
  "obs:leading": "Observatório · Radar de Sinais",
  "obs:trends": "Observatório · Buscas no Google",
  "obs:sectors": "Observatório · Risco setorial",
  "obs:sector": "Observatório · Setor (detalhe)",
  "obs:rj": "Observatório · Recuperações e falências",
  "obs:institutions": "Observatório · Instituições",
  "obs:inst": "Observatório · Instituição (detalhe)",
  "obs:products": "Observatório · Produtos de crédito",
  "obs:product": "Observatório · Produto (detalhe)",
  "obs:compare": "Observatório · Comparar instituições",
  "obs:market": "Observatório · Bancos na bolsa",
  "obs:openfinance": "Observatório · Open Finance",
  "obs:scenarios": "Observatório · Cenários",
  "obs:alerts": "Observatório · Central de alertas",
  "obs:research": "Observatório · Perguntas rápidas",
  "obs:method": "Observatório · Metodologia e fontes",
  "obs:bets": "Observatório · Apostas e crédito das famílias",
  "obs:fraudes": "Observatório · Golpes e fraudes",
  "obs:juros": "Observatório · Juros por instituição",
  "obs:operacional": "Observatório · Rede, pessoas e auditoria",
  "obs:rural": "Observatório · Crédito rural",
  "obs:ampliado": "Observatório · Bancos e mercado de capitais",
  "obs:bndes": "Observatório · Crédito direcionado e BNDES",
  "obs:estados": "Observatório · Estados",
  "obs:estado": "Observatório · Página de UF",
  "obs:sfn": "Observatório · Quem entra e quem sai do SFN",
  "obs:conduta": "Observatório · Sanções e reclamações",
  "obs:emprego": "Observatório · Emprego formal",
  "obs:funding": "Observatório · Captação dos bancos",
  "obs:consorcios": "Observatório · Consórcios",
  "obs:cobranca": "Observatório · Bancos cobrando na Justiça",
  "obs:sugestoes": "Observatório · Sugestões",
  "app:conta": "Plataforma · Conta",
};

export function isViewSection(value: string): value is ViewSection {
  return SECTIONS.has(value);
}

export function sectionLabel(section: string): string {
  return isViewSection(section) ? SECTION_LABELS[section] : section;
}

/** Prefixo do nome do evento de visita em product_events. */
export const VIEW_EVENT_PREFIX = "view:";

/**
 * Registra a visita a uma seção. Seção fora da allowlist é ignorada
 * (retorna false) e telemetria nunca derruba o fluxo principal.
 */
export async function trackView(section: string, userId: string): Promise<boolean> {
  if (!isViewSection(section)) return false;
  try {
    const db = await getDb();
    await db.insert(schema.productEvents).values({
      id: newId(),
      name: `${VIEW_EVENT_PREFIX}${section}`,
      userId,
      createdAt: new Date(),
    });
    return true;
  } catch {
    return false;
  }
}
