/**
 * Nome por extenso das siglas que mais aparecem no texto do leitor sem explicação (rodada r4 da avaliação).
 * São os nomes oficiais dos órgãos, sistemas e instrumentos; a definição de cada conceito fica no Aprenda,
 * que só publica o que foi conferido na fonte. Sigla fora desta lista não é expandida.
 */
export const SIGLAS: Record<string, string> = {
  ANEEL: "Agência Nacional de Energia Elétrica",
  ONS: "Operador Nacional do Sistema Elétrico",
  CCEE: "Câmara de Comercialização de Energia Elétrica",
  EPE: "Empresa de Pesquisa Energética",
  CVM: "Comissão de Valores Mobiliários",
  IBGE: "Instituto Brasileiro de Geografia e Estatística",
  CADE: "Conselho Administrativo de Defesa Econômica",
  SIN: "Sistema Interligado Nacional",
  SAMP: "Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica, da ANEEL",
  SIGA: "Sistema de Informações de Geração da ANEEL",
  RALIE: "Relatório de Acompanhamento da Expansão da Oferta de Geração de Energia Elétrica",
  PDE: "Plano Decenal de Expansão de Energia",
  DEC: "Duração Equivalente de Interrupção por Unidade Consumidora",
  FEC: "Frequência Equivalente de Interrupção por Unidade Consumidora",
  TE: "Tarifa de Energia",
  TUSD: "Tarifa de Uso do Sistema de Distribuição",
  CDE: "Conta de Desenvolvimento Energético",
  PRODIST: "Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional",
  REN: "Resolução Normativa da ANEEL",
  REH: "Resolução Homologatória da ANEEL",
  DOU: "Diário Oficial da União",
  UC: "unidade consumidora",
  BPC: "Benefício de Prestação Continuada",
  CEG: "Código Único de Empreendimentos de Geração",
  PLD: "Preço de Liquidação das Diferenças",
  CMO: "Custo Marginal de Operação",
  EAR: "Energia Armazenada",
  ENA: "Energia Natural Afluente",
  MLT: "média de longo termo",
  REE: "Reservatório Equivalente de Energia",
  MMGD: "micro e minigeração distribuída",
  HHI: "índice de concentração Herfindahl-Hirschman",
  CR4: "participação das quatro maiores empresas",
  CR10: "participação das dez maiores empresas",
  DFP: "Demonstrações Financeiras Padronizadas, da CVM",
  ITR: "Informações Trimestrais, da CVM",
  PDO: "Programa Diário de Operação",
  MWmed: "megawatt médio",
  ACL: "Ambiente de Contratação Livre",
  ACR: "Ambiente de Contratação Regulada",
  MRE: "Mecanismo de Realocação de Energia",
  ESS: "Encargos de Serviços do Sistema",
  EER: "Encargo de Energia de Reserva",
  GSF: "Generation Scaling Factor, o fator de ajuste do MRE",
  MCP: "Mercado de Curto Prazo",
  CVU: "Custo Variável Unitário",
  RAP: "Receita Anual Permitida",
  TSEE: "Tarifa Social de Energia Elétrica",
  DIC: "Duração de Interrupção Individual por Unidade Consumidora",
  FIC: "Frequência de Interrupção Individual por Unidade Consumidora",
  MME: "Ministério de Minas e Energia",
  MCTI: "Ministério da Ciência, Tecnologia e Inovação",
};

/** Padrão que reconhece cada sigla como palavra inteira no texto. */
export const PADRAO_SIGLA = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${s}(?![\\p{L}\\p{N}_])`, "u");

/** Siglas da lista que aparecem no texto, na ordem da primeira aparição e sem as que o próprio texto já expande. */
export function siglasNoTexto(texto: string, maximo = 6): string[] {
  const achadas: { sigla: string; i: number }[] = [];
  for (const [sigla, nome] of Object.entries(SIGLAS)) {
    const m = PADRAO_SIGLA(sigla).exec(texto);
    if (!m) continue;
    if (texto.toLowerCase().includes(nome.toLowerCase().split(",")[0])) continue;
    achadas.push({ sigla, i: m.index });
  }
  return achadas.sort((a, b) => a.i - b.i).slice(0, maximo).map((a) => a.sigla);
}

/** Pares que a legenda junta numa só entrada, porque o nome por extenso divide quase tudo. */
const PARES: [string, string, string, string][] = [
  ["DEC", "FEC", "DEC e FEC", "Duração e Frequência Equivalentes de Interrupção por Unidade Consumidora"],
  ["TE", "TUSD", "TE e TUSD", "Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição"],
];

/** Texto da legenda: "DEC e FEC, Duração e Frequência ...; PLD, Preço de Liquidação das Diferenças". Sigla desconhecida sai. */
export function legendaDeSiglas(siglas: readonly string[]): string {
  const conhecidas = siglas.filter((s) => s in SIGLAS);
  const usadas = new Set<string>();
  const itens: string[] = [];
  for (const s of conhecidas) {
    if (usadas.has(s)) continue;
    const par = PARES.find(([a, b]) => (s === a || s === b) && conhecidas.includes(a) && conhecidas.includes(b));
    if (par) {
      usadas.add(par[0]);
      usadas.add(par[1]);
      itens.push(`${par[2]}, ${par[3]}`);
    } else {
      usadas.add(s);
      itens.push(`${s}, ${SIGLAS[s]}`);
    }
  }
  return itens.join("; ");
}
