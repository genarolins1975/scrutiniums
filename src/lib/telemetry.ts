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
  "obs:prazo",
  "obs:fidc",
  "obs:subnacional",
  "obs:sugestoes",
  // Abas da SPA que já enviavam visita e ficavam fora da allowlist (descartadas em
  // silêncio até 28/09/2026, auditoria dos dois observatórios)
  "obs:pix",
  "obs:judicial",
  "obs:pgfn",
  "obs:desenrola",
  "obs:penetracao",
  "obs:moradia",
  "obs:consignado",
  "obs:presmun",
  "obs:regulacao",
  "obs:sobre",
  // Observatório Brasileiro do Setor Elétrico (páginas Next, domínio energia)
  "energia:visao-geral",
  "energia:pld",
  "energia:pld-previsoes",
  "energia:pld-modelos",
  "energia:agua-e-clima",
  "energia:geracao",
  "energia:carga",
  "energia:rede",
  "energia:mercado",
  "energia:empresas",
  "energia:expansao",
  "energia:regulacao",
  "energia:aprenda",
  "energia:dados",
  "energia:metodologia",
  // Plataforma (páginas Next)
  "app:conta",
  "app:observatorios",
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
  "obs:prazo": "Observatório · Prazo da carteira",
  "obs:fidc": "Observatório · FIDCs por lastro e cota",
  "obs:subnacional": "Observatório · Crédito a estados e municípios",
  "obs:sugestoes": "Observatório · Sugestões",
  "obs:pix": "Observatório · Pix e pagamentos",
  "obs:judicial": "Observatório · Clientes contra bancos na Justiça",
  "obs:pgfn": "Observatório · Dívida com a União",
  "obs:desenrola": "Observatório · Desenrola Brasil",
  "obs:penetracao": "Observatório · Crédito por município",
  "obs:moradia": "Observatório · Crédito imobiliário e moradia",
  "obs:consignado": "Observatório · Consignado e aposentados",
  "obs:presmun": "Observatório · Presença bancária por município",
  "obs:regulacao": "Observatório · Marcos regulatórios",
  "obs:sobre": "Observatório · Sobre",
  "energia:visao-geral": "Setor Elétrico · Visão geral",
  "energia:pld": "Setor Elétrico · PLD",
  "energia:pld-previsoes": "Setor Elétrico · Histórico de previsões",
  "energia:pld-modelos": "Setor Elétrico · Modelos do PLD",
  "energia:agua-e-clima": "Setor Elétrico · Água e clima",
  "energia:geracao": "Setor Elétrico · Geração",
  "energia:carga": "Setor Elétrico · Carga e consumo",
  "energia:rede": "Setor Elétrico · Rede",
  "energia:mercado": "Setor Elétrico · Mercado",
  "energia:empresas": "Setor Elétrico · Empresas e ativos",
  "energia:expansao": "Setor Elétrico · Expansão",
  "energia:regulacao": "Setor Elétrico · Regulação",
  "energia:aprenda": "Setor Elétrico · Aprenda",
  "energia:dados": "Setor Elétrico · Dados e catálogo",
  "energia:metodologia": "Setor Elétrico · Metodologia",
  "app:conta": "Plataforma · Conta",
  "app:observatorios": "Plataforma · Escolha do observatório",
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
