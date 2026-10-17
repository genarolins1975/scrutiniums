import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Nome por extenso das siglas que mais aparecem no texto do leitor sem explicação (rodada r4 da avaliação).
 * São os nomes oficiais dos órgãos, sistemas e instrumentos; a definição de cada conceito fica no Aprenda,
 * que só publica o que foi conferido na fonte. Sigla fora desta lista não é expandida.
 */
function montarSiglas(tx: TxIdioma): Record<string, string> {
  return {
    ANEEL: tx("Agência Nacional de Energia Elétrica", "Brazilian Electricity Regulatory Agency"),
    ONS: tx("Operador Nacional do Sistema Elétrico", "National Electric System Operator"),
    CCEE: tx("Câmara de Comercialização de Energia Elétrica", "Electric Energy Trading Chamber"),
    EPE: tx("Empresa de Pesquisa Energética", "Energy Research Office"),
    CVM: tx("Comissão de Valores Mobiliários", "Securities and Exchange Commission of Brazil"),
    IBGE: tx("Instituto Brasileiro de Geografia e Estatística", "Brazilian Institute of Geography and Statistics"),
    CADE: tx("Conselho Administrativo de Defesa Econômica", "Administrative Council for Economic Defense"),
    SIN: tx("Sistema Interligado Nacional", "National Interconnected System"),
    CNPJ: tx("Cadastro Nacional da Pessoa Jurídica", "National Register of Legal Entities"),
    ATLS: tx("Atendimento aos Limites Sistêmicos", "Compliance with System Limits"),
    SAMP: tx("Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica, da ANEEL", "Market Information Monitoring System for Economic Regulation, from ANEEL"),
    SIGA: tx("Sistema de Informações de Geração da ANEEL", "ANEEL Generation Information System"),
    RALIE: tx("Relatório de Acompanhamento da Expansão da Oferta de Geração de Energia Elétrica", "Generation Supply Expansion Monitoring Report"),
    PDE: tx("Plano Decenal de Expansão de Energia", "Ten-Year Energy Expansion Plan"),
    DEC: tx("Duração Equivalente de Interrupção por Unidade Consumidora", "Equivalent interruption duration per consumer unit"),
    FEC: tx("Frequência Equivalente de Interrupção por Unidade Consumidora", "Equivalent interruption frequency per consumer unit"),
    TE: tx("Tarifa de Energia", "Energy Tariff"),
    TUSD: tx("Tarifa de Uso do Sistema de Distribuição", "Distribution System Use Tariff"),
    CDE: tx("Conta de Desenvolvimento Energético", "Energy Development Account"),
    PRODIST: tx("Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional", "Electricity Distribution Procedures in the National Electric System"),
    REN: tx("Resolução Normativa da ANEEL", "ANEEL Normative Resolution"),
    REH: tx("Resolução Homologatória da ANEEL", "ANEEL Ratifying Resolution"),
    DOU: tx("Diário Oficial da União", "Official Gazette of the Union"),
    UC: tx("unidade consumidora", "consumer unit"),
    BPC: tx("Benefício de Prestação Continuada", "Continuous Cash Benefit"),
    CEG: tx("Código Único de Empreendimentos de Geração", "Unique Code of Generation Projects"),
    PLD: tx("Preço de Liquidação das Diferenças", "Settlement Price for Differences (spot price)"),
    CMO: tx("Custo Marginal de Operação", "Marginal Operating Cost"),
    EAR: tx("Energia Armazenada", "Stored Energy"),
    ENA: tx("Energia Natural Afluente", "Natural Inflow Energy"),
    MLT: tx("média de longo termo", "long-term average"),
    REE: tx("Reservatório Equivalente de Energia", "Equivalent Energy Reservoir"),
    MMGD: tx("micro e minigeração distribuída", "distributed micro and mini generation"),
    HHI: tx("índice de concentração Herfindahl-Hirschman", "Herfindahl-Hirschman concentration index"),
    CR4: tx("participação das quatro maiores empresas", "share of the four largest companies"),
    CR10: tx("participação das dez maiores empresas", "share of the ten largest companies"),
    DFP: tx("Demonstrações Financeiras Padronizadas, da CVM", "Standardized Financial Statements, from the CVM"),
    ITR: tx("Informações Trimestrais, da CVM", "Quarterly Information, from the CVM"),
    PDO: tx("Programa Diário de Operação", "Daily Operation Program"),
    MWmed: tx("megawatt médio", "average megawatt"),
    ACL: tx("Ambiente de Contratação Livre", "Free Contracting Environment"),
    ACR: tx("Ambiente de Contratação Regulada", "Regulated Contracting Environment"),
    MRE: tx("Mecanismo de Realocação de Energia", "Energy Reallocation Mechanism"),
    ESS: tx("Encargos de Serviços do Sistema", "System Service Charges"),
    EER: tx("Encargo de Energia de Reserva", "Reserve Energy Charge"),
    GSF: tx("Generation Scaling Factor, o fator de ajuste do MRE", "Generation Scaling Factor, the MRE adjustment factor"),
    MCP: tx("Mercado de Curto Prazo", "Short-Term Market"),
    CVU: tx("Custo Variável Unitário", "Unit Variable Cost"),
    RAP: tx("Receita Anual Permitida", "Permitted Annual Revenue"),
    TSEE: tx("Tarifa Social de Energia Elétrica", "Social Electricity Tariff"),
    DIC: tx("Duração de Interrupção Individual por Unidade Consumidora", "Individual interruption duration per consumer unit"),
    FIC: tx("Frequência de Interrupção Individual por Unidade Consumidora", "Individual interruption frequency per consumer unit"),
    MME: tx("Ministério de Minas e Energia", "Ministry of Mines and Energy"),
    CCEAR: tx("Contrato de Comercialização de Energia Elétrica no Ambiente Regulado", "Electricity Trading Contract in the Regulated Environment"),
    LEN: tx("Leilão de Energia Nova", "New Energy Auction"),
    LER: tx("Leilão de Energia de Reserva", "Reserve Energy Auction"),
    LFA: tx("Leilão de Fontes Alternativas", "Alternative Sources Auction"),
    ICB: tx("Índice de Custo Benefício", "Cost-Benefit Index"),
    CER: tx("Contrato de Energia de Reserva", "Reserve Energy Contract"),
    UHE: tx("Usina Hidrelétrica", "Hydropower Plant"),
    PCH: tx("Pequena Central Hidrelétrica", "Small Hydropower Plant"),
    CGH: tx("Central Geradora Hidrelétrica", "Mini Hydropower Plant"),
    MCTI: tx("Ministério da Ciência, Tecnologia e Inovação", "Ministry of Science, Technology and Innovation"),
    // acrescentadas na r7: nomes que o próprio observatório já traz por extenso nas fontes e fichas (não vêm de memória)
    POF: tx("Pesquisa de Orçamentos Familiares, do IBGE", "Household Budget Survey, from the IBGE"),
    SIDRA: tx("Sistema IBGE de Recuperação Automática", "IBGE Automatic Retrieval System"),
    IPCA: tx("Índice Nacional de Preços ao Consumidor Amplo", "Broad National Consumer Price Index"),
    PMO: tx("Programa Mensal de Operação", "Monthly Operation Program"),
    SCEE: tx("Sistema de Compensação de Energia Elétrica", "Electric Energy Compensation System"),
    PRORET: tx("Procedimentos de Regulação Tarifária", "Tariff Regulation Procedures"),
    BDGD: tx("Base de Dados Geográfica da Distribuidora", "Distribution Utility Geographic Database"),
    CCC: tx("Conta de Consumo de Combustíveis", "Fuel Consumption Account"),
    MPV: tx("Medida Provisória", "Provisional Measure"),
    MDL: tx("Mecanismo de Desenvolvimento Limpo", "Clean Development Mechanism"),
    DVA: tx("Demonstração do Valor Adicionado", "Statement of Value Added"),
    UF: tx("unidade da federação", "federative unit (state)"),
    SIGET: tx("Sistema de Gestão da Transmissão", "Transmission Management System"),
    SCS: tx("Sistema de Controle de Subvenções e Programas Sociais", "Subsidies and Social Programs Control System"),
    DMR: tx("Diferença Mensal de Receita", "Monthly Revenue Difference"),
    // acrescentadas no redesenho: nomes que as páginas de Inclusão e Território já escrevem por extenso (pedido da família Inclusão)
    PNAD: tx("Pesquisa Nacional por Amostra de Domicílios, do IBGE", "National Household Sample Survey, from the IBGE"),
    PASI: tx("Portal de Acompanhamento e Informações dos Sistemas Isolados, da EPE", "Isolated Systems Monitoring and Information Portal, from the EPE"),
    MDS: tx("Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome", "Ministry of Development and Social Assistance, Family and Fight against Hunger"),
    CV: tx("coeficiente de variação", "coefficient of variation"),
  };
}
export const SIGLAS_IDIOMAS = montarNosDoisIdiomas(montarSiglas);
export const SIGLAS: Record<string, string> = SIGLAS_IDIOMAS.pt;

/** Padrão que reconhece cada sigla como palavra inteira no texto. */
export const PADRAO_SIGLA = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${s}(?![\\p{L}\\p{N}_])`, "u");

/** Siglas da lista que aparecem no texto, na ordem da primeira aparição e sem as que o próprio texto já expande. */
export function siglasNoTexto(texto: string, maximo = 6, idioma: Idioma = idiomaEnergia()): string[] {
  const achadas: { sigla: string; i: number }[] = [];
  for (const [sigla, nome] of Object.entries(SIGLAS_IDIOMAS[idioma])) {
    const m = PADRAO_SIGLA(sigla).exec(texto);
    if (!m) continue;
    if (texto.toLowerCase().includes(nome.toLowerCase().split(",")[0])) continue;
    achadas.push({ sigla, i: m.index });
  }
  return achadas.sort((a, b) => a.i - b.i).slice(0, maximo).map((a) => a.sigla);
}

/** Pares que a legenda junta numa só entrada, porque o nome por extenso divide quase tudo. */
function montarPares(tx: TxIdioma): [string, string, string, string][] {
  return [
    ["DEC", "FEC", tx("DEC e FEC", "DEC and FEC"), tx("Duração e Frequência Equivalentes de Interrupção por Unidade Consumidora", "Equivalent interruption duration and frequency per consumer unit")],
    ["TE", "TUSD", tx("TE e TUSD", "TE and TUSD"), tx("Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição", "Energy Tariff and Distribution System Use Tariff")],
  ];
}
const PARES_IDIOMAS = montarNosDoisIdiomas(montarPares);

/** Texto da legenda: "DEC e FEC, Duração e Frequência ...; PLD, Preço de Liquidação das Diferenças". Sigla desconhecida sai. */
export function legendaDeSiglas(siglas: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  const nomes = SIGLAS_IDIOMAS[idioma];
  const conhecidas = siglas.filter((s) => s in nomes);
  const usadas = new Set<string>();
  const itens: string[] = [];
  for (const s of conhecidas) {
    if (usadas.has(s)) continue;
    const par = PARES_IDIOMAS[idioma].find(([a, b]) => (s === a || s === b) && conhecidas.includes(a) && conhecidas.includes(b));
    if (par) {
      usadas.add(par[0]);
      usadas.add(par[1]);
      itens.push(`${par[2]}, ${par[3]}`);
    } else {
      usadas.add(s);
      itens.push(`${s}, ${nomes[s]}`);
    }
  }
  return itens.join("; ");
}
