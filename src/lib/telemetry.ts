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
  // Plataforma (páginas Next)
  "app:paineis",
  "app:atividade",
  "app:risco",
  "app:regulatorio",
  "app:conta",
] as const;

export type ViewSection = (typeof VIEW_SECTIONS)[number];

const SECTIONS = new Set<string>(VIEW_SECTIONS);

/** Rótulos exibidos no painel de administração. */
export const SECTION_LABELS: Record<ViewSection, string> = {
  "obs:overview": "Observatório · Visão geral",
  "obs:panorama": "Observatório · Panorama do Crédito",
  "obs:pulse": "Observatório · Pulso do crédito",
  "obs:antecedentes": "Observatório · Ciclo & Antecedentes",
  "obs:leading": "Observatório · Radar de Sinais",
  "obs:trends": "Observatório · Tendências de Busca",
  "obs:sectors": "Observatório · Risco setorial",
  "obs:sector": "Observatório · Setor (detalhe)",
  "obs:rj": "Observatório · Recuperações & Falências",
  "obs:institutions": "Observatório · Instituições",
  "obs:inst": "Observatório · Instituição (detalhe)",
  "obs:products": "Observatório · Produtos de Crédito",
  "obs:product": "Observatório · Produto (detalhe)",
  "obs:compare": "Observatório · Comparador",
  "obs:market": "Observatório · Mercado & Valor",
  "obs:openfinance": "Observatório · Open Finance",
  "obs:scenarios": "Observatório · Cenários",
  "obs:alerts": "Observatório · Alertas",
  "obs:research": "Observatório · Relatórios",
  "obs:method": "Observatório · Metodologia & Fontes",
  "app:paineis": "Plataforma · Painéis Scrutiniums",
  "app:atividade": "Plataforma · Atividade setorial",
  "app:risco": "Plataforma · Risco de crédito",
  "app:regulatorio": "Plataforma · Regulatório",
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
