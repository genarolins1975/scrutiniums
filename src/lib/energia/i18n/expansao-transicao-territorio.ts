import type { Idioma } from "@/lib/idioma";
import type { ColunaTabela } from "../tabela";

/**
 * Tabelas de tradução (português → inglês) dos módulos Expansão, Transição e Território do Setor Elétrico: rótulos de categoria
 * que vêm da gold (situação, viabilidade, justificativa, estágio), unidades de coluna e cabeçalhos de tabela. A gold e o pipeline
 * não mudam: a página inglesa troca o rótulo pela entrada exata desta tabela; valor sem entrada sai como veio, e o componente que
 * o exibe o marca como trecho só em português (TrechoPortugues).
 */

/** Valor da tabela no idioma; sem entrada, null (quem chama decide: devolve o original ou o marca como português). */
export function daTabela(valor: string | null | undefined, tabela: Readonly<Record<string, string>>, idioma: Idioma): string | null {
  if (valor === null || valor === undefined) return null;
  if (idioma !== "en") return valor;
  return tabela[valor] ?? null;
}

/** Valor da tabela no idioma, ou o próprio valor quando não há entrada (para célula de tabela, que não aceita marca). */
export function rotuloDado(valor: string, tabela: Readonly<Record<string, string>>, idioma: Idioma): string {
  return idioma === "en" ? (tabela[valor] ?? valor) : valor;
}

/** Unidades de coluna e de medida usadas nas tabelas dos três módulos. */
export const UNIDADES_EN: Readonly<Record<string, string>> = {
  "MW outorgado": "granted MW",
  "MW das unidades": "MW of generating units",
  "km de circuito": "circuit km",
  "km de traçado": "route km",
  dias: "days",
  "% do MW": "% of MW",
  "R$ milhões nominais": "nominal R$ million",
  "R$ milhões nominais por ano": "nominal R$ million per year",
  "R$ bilhões": "R$ billion",
  "t CO2/MWh": "t CO2/MWh",
  "kg CO2/MWh": "kg CO2/MWh",
  "MWmédio": "MWavg",
  "MWmed": "MWavg",
  "MW médios": "MWavg",
  "milhões de t CO2": "million t CO2",
  "mil t CO2": "thousand t CO2",
  "t CO2": "t CO2",
  sistemas: "systems",
  "unidades consumidoras": "consumer units",
  "% da potência": "% of capacity",
  "% da carga": "% of load",
  "% da geração": "% of generation",
  "pontos percentuais": "percentage points",
  "p.p.": "p.p.",
  "R$/MWh": "R$/MWh",
  habitantes: "inhabitants",
  usinas: "plants",
  municípios: "municipalities",
  conjuntos: "consumer sets",
  horas: "hours",
  meses: "months",
  "UC por mil habitantes": "consumer units per thousand inhabitants",
  "kW por mil habitantes": "kW per thousand inhabitants",
  "W por habitante": "W per inhabitant",
  "% das UC": "% of consumer units",
};

/**
 * Colunas no idioma: o rótulo vem da tabela inglesa (pela id da coluna) e a unidade de UNIDADES_EN; em português, as colunas
 * saem como estão. Coluna sem entrada inglesa mantém o rótulo (a tabela inglesa é conferida pelo verificador de pendências).
 */
export function colunasNoIdioma(colunas: readonly ColunaTabela[], rotulosEn: Readonly<Record<string, string>>, idioma: Idioma): ColunaTabela[] {
  if (idioma !== "en") return [...colunas];
  return colunas.map((c) => ({
    ...c,
    rotulo: rotulosEn[c.id] ?? c.rotulo,
    ...(c.unidade ? { unidade: UNIDADES_EN[c.unidade] ?? c.unidade } : {}),
  }));
}

/** Mensagens da cópia de link (MENSAGEM_COPIA de evidencia.ts) em inglês, pela mesma chave. */
export const MENSAGEM_COPIA_EN: Readonly<Record<"copiado" | "selecionado" | "falhou", string>> = {
  copiado: "Copied to the clipboard.",
  selecionado: "Text selected: use Ctrl+C (or Copy, in the menu) to copy.",
  falhou: "Could not copy: select the text of the block and copy it.",
};

/** "sim"/"não" das colunas categóricas. */
export const SIM_NAO_EN: Readonly<Record<string, string>> = { sim: "yes", "não": "no" };

/* ================================================================ Expansão */

/** Estágio do SIGA (rótulo publicado na gold e o das constantes). */
export const ESTAGIO_EN: Readonly<Record<string, string>> = {
  "Em operação": "In operation",
  "Em construção": "Under construction",
  "Outorgado, construção não iniciada": "Granted, construction not started",
  "Obra não iniciada": "Construction not started",
  "Outra fase": "Other phase",
  "Construção não iniciada": "Construction not started",
  "Construção": "Construction",
  "Operação": "Operation",
  "ausente do SIGA": "absent from SIGA",
};

/** Nome do tipo de geração no cadastro (o mesmo que a gold publica em estagios.por_tipo[].nome). */
export const NOME_TIPO_EN: Readonly<Record<string, string>> = {
  UHE: "Hydropower plant",
  PCH: "Small hydropower plant",
  CGH: "Mini hydropower plant",
  EOL: "Wind power plant",
  UFV: "Solar photovoltaic plant",
  UTE: "Thermal power plant",
  UTN: "Nuclear power plant",
  CGU: "Wave power plant",
};
export const TIPO_EM_FRASE_EN: Readonly<Record<string, string>> = {
  UHE: "hydropower plants",
  PCH: "small hydropower plants",
  CGH: "mini hydropower plants",
  EOL: "wind power plants",
  UFV: "solar photovoltaic plants",
  UTE: "thermal power plants",
  UTN: "nuclear power",
  CGU: "wave power plants",
};
export const NOME_TIPO_CURTO_EN: Readonly<Record<string, string>> = {
  UHE: "Hydropower",
  PCH: "Small hydropower",
  CGH: "Mini hydropower",
  EOL: "Wind",
  UFV: "Solar photovoltaic",
  UTE: "Thermal",
  UTN: "Nuclear",
  CGU: "Wave",
};
/** Nome do tipo publicado pela gold (por extenso) para o inglês. */
export const NOME_TIPO_GOLD_EN: Readonly<Record<string, string>> = {
  "Usina hidrelétrica": "Hydropower plant",
  "Pequena central hidrelétrica": "Small hydropower plant",
  "Central geradora hidrelétrica": "Mini hydropower plant",
  "Central geradora eólica": "Wind power plant",
  "Central geradora solar fotovoltaica": "Solar photovoltaic plant",
  "Usina termelétrica": "Thermal power plant",
  "Usina termonuclear": "Nuclear power plant",
  "Central geradora undi-elétrica": "Wave power plant",
};

/** Situação da obra no RALIE. */
export const OBRA_RALIE_EN: Readonly<Record<string, string>> = {
  "Em andamento": "In progress",
  Paralisada: "Halted",
  "Não Iniciada": "Not started",
};
/** Viabilidade atribuída pela fiscalização no RALIE. */
export const VIABILIDADE_EN: Readonly<Record<string, string>> = { Alta: "High", "Média": "Medium", Baixa: "Low" };
/** Situação do cronograma no RALIE. */
export const SITUACAO_CRONOGRAMA_EN: Readonly<Record<string, string>> = { Normal: "On schedule", Atrasado: "Delayed", Adiantado: "Ahead of schedule" };
/** Justificativa da previsão (fiscalização do RALIE). */
export const JUSTIFICATIVA_EN: Readonly<Record<string, string>> = {
  "Sem Licença de Instalação - LI": "No installation license (LI)",
  "Acesso a rede não contratado - CUST/CUSD": "Grid access not contracted (CUST/CUSD)",
  "Ausência de informações obrigatórias": "Mandatory information missing",
  "Revogação da outorga em avaliação": "Grant revocation under review",
  "Estágio das obras da usina": "Stage of the plant's construction",
  "Acesso a rede contratado - CUST/CUSD": "Grid access contracted (CUST/CUSD)",
  "Nenhuma licença ambiental válida": "No valid environmental license",
  "Paralisação de obras": "Construction halted",
  "Compromisso de venda de energia - PPA": "Energy sale commitment (PPA)",
  "Sem RAPEEL": "No RAPEEL",
  "Pendências em procedimentos de rede": "Pending grid procedures",
  "Demandas judiciais": "Lawsuits",
  "Estágio das obras da conexão associada": "Stage of the associated connection works",
  "Inviabilidade da implantação da usina": "Plant implementation not feasible",
  "Sem Licença de Operação - LO": "No operating license (LO)",
  "Documentos de Segurança de Barragens": "Dam safety documents",
};
/** Forma da outorga no SIGA. */
export const OUTORGA_SIGA_EN: Readonly<Record<string, string>> = { Registro: "Registration", "Autorização": "Authorization", "Concessão": "Concession" };
/** Situação do empreendimento de transmissão no SIGET. */
export const SITUACAO_SIGET_EN: Readonly<Record<string, string>> = {
  "Em Operação": "In operation",
  "Em operação": "In operation",
  "Em andamento": "In progress",
  "Concluído": "Completed",
  Planejado: "Planned",
  "(vazio)": "(blank)",
};
/** Motivo de lote de transmissão sem vencedor (rótulo da ANEEL). */
export const SEM_VENCEDOR_EN: Readonly<Record<string, string>> = {
  "NÃO LEILOADO": "not auctioned",
  "SEM INSCRITO APTO": "no eligible bidder",
  "SEM LANCE": "no bid",
};
/** Origem da série anual de MW liberados (texto da gold). */
export const FONTE_MW_LIBERADA_EN: Readonly<Record<string, string>> = {
  "resumo anual oficial (campo em kW), igual à soma do arquivo detalhado": "official annual summary (field in kW), equal to the sum of the detailed file",
  "resumo anual oficial (campo em MW)": "official annual summary (field in MW)",
};
/** Correspondência entre a categoria do PDE e o cadastro da ANEEL. */
export const CORRESPONDENCIA_EN: Readonly<Record<string, string>> = {
  direta: "direct",
  parcial: "partial",
  "sem correspondência verificada": "no verified match",
  "fora do universo do SIGA e do RALIE": "outside the SIGA and RALIE universe",
  "não é geração": "not generation",
};
/** Categoria do PDE (rótulo da camada). */
export const CAMADA_PDE_EN: Readonly<Record<string, string>> = {
  "Hidrelétricas (UHE)": "Hydropower plants (UHE)",
  "Pequenas centrais hidrelétricas e centrais geradoras hidrelétricas (PCH e CGH)": "Small and mini hydropower plants (PCH and CGH)",
  "Eólicas": "Wind",
  "Solar centralizada": "Utility-scale solar",
  Biomassa: "Biomass",
  "Termelétricas (PDE)": "Thermal power plants (PDE)",
  "Micro e minigeração distribuída": "Distributed micro and mini generation (MMGD)",
  Baterias: "Batteries",
  "Resposta da demanda": "Demand response",
};
/** Título das figuras do PDE 2035 (como a EPE as intitula). */
export const TITULO_FIGURA_EN: Readonly<Record<string, string>> = {
  "Evolução da capacidade instalada existente e contratada do SIN": "Evolution of existing and contracted installed capacity in the SIN",
  "Expansão indicativa acumulada no horizonte de 2026 a 2035": "Cumulative indicative expansion over the 2026 to 2035 horizon",
  "Participação das fontes na matriz elétrica nacional em 2025 e 2035": "Share of sources in the national power mix in 2025 and 2035",
  "Cenários de expansão do sistema de transmissão": "Transmission system expansion scenarios",
  "Cenários de referência: Expansão física de LTs": "Reference scenarios: physical expansion of transmission lines",
  "Cenários de referência: expansão física de SEs": "Reference scenarios: physical expansion of substations",
  "Geração total de eletricidade por fonte no horizonte decenal": "Total electricity generation by source over the ten-year horizon",
};
/** Colunas das figuras do PDE 2035 (rótulos da planilha da EPE). */
export const COLUNA_FIGURA_EN: Readonly<Record<string, string>> = {
  BIOMASSA: "BIOMASS",
  CARVAO: "COAL",
  "DIESEL / ÓLEO": "DIESEL / OIL",
  EOLICA: "WIND",
  Solar: "Solar",
  GAS: "GAS",
  NUCLEAR: "NUCLEAR",
  PCH: "PCH",
  PCT: "PCT",
  UHE: "UHE",
  "Hidro (MW)": "Hydro (MW)",
  "Eólica (MW)": "Wind (MW)",
  "Solar (MW)": "Solar (MW)",
  "UTE Flex (MW)": "Flexible thermal (MW)",
  "UTE Inflex (MW)": "Inflexible thermal (MW)",
  "UTE Bio (MW)": "Biomass thermal (MW)",
  "Nuclear (MW)": "Nuclear (MW)",
  "Armazenamento (MW)": "Storage (MW)",
  "RD (MW)": "Demand response (MW)",
  "Total (MW)": "Total (MW)",
  "UHE (GW)": "UHE (GW)",
  "PCH (GW)": "PCH (GW)",
  "Biomassa (GW)": "Biomass (GW)",
  "Eólica (GW)": "Wind (GW)",
  "Solar fotovoltaica (GW)": "Solar photovoltaic (GW)",
  "MMGD (GW)": "MMGD (GW)",
  "UTE (GW)": "Thermal (GW)",
  "Baterias (GW)": "Batteries (GW)",
  "RD (GW)": "Demand response (GW)",
  "Otimista (R$ bilhões)": "Optimistic (R$ billion)",
  "Referência (R$ bilhões)": "Reference (R$ billion)",
  "Pessimista (R$ bilhões)": "Pessimistic (R$ billion)",
  "Autoprodução & Geração Distribuída - Biomassa (biogás, bagaço de cana, lixívia e lenha) (TWh)":
    "Self-production & distributed generation - Biomass (biogas, sugarcane bagasse, black liquor and firewood) (TWh)",
  "Autoprodução & Geração Distribuída - Eólica (TWh)": "Self-production & distributed generation - Wind (TWh)",
  "Autoprodução & Geração Distribuída - Hidráulica (TWh)": "Self-production & distributed generation - Hydro (TWh)",
  "Autoprodução & Geração Distribuída - Não renováveis (TWh)": "Self-production & distributed generation - Non-renewables (TWh)",
  "Autoprodução & Geração Distribuída - Solar (TWh)": "Self-production & distributed generation - Solar (TWh)",
  "Geração centralizada - Biomassa (TWh)": "Centralized generation - Biomass (TWh)",
  "Geração centralizada - Carvão (TWh)": "Centralized generation - Coal (TWh)",
  "Geração centralizada - Eólica (TWh)": "Centralized generation - Wind (TWh)",
  "Geração centralizada - Gás Natural (TWh)": "Centralized generation - Natural gas (TWh)",
  "Geração centralizada - Hidráulica (TWh)": "Centralized generation - Hydro (TWh)",
  "Geração centralizada - Nuclear (TWh)": "Centralized generation - Nuclear (TWh)",
  "Geração centralizada - Outros (TWh)": "Centralized generation - Other (TWh)",
  "Geração centralizada - Solar (centralizada) (TWh)": "Centralized generation - Solar (utility-scale) (TWh)",
};

/** Linhas do Anexo I-3 do PDE 2035 citadas na conferência com as figuras. */
export const LINHA_ANEXO_EN: Readonly<Record<string, string>> = {
  "Biomassa + Biogás + RSU": "Biomass + Biogas + MSW",
  "PCH E CGH": "PCH AND CGH",
  "Hidrelétrica": "Hydropower",
  "Itaipu 50 Hz": "Itaipu 50 Hz",
  "Eólica": "Wind",
  "Biocombustível": "Biofuel",
  "Fotovoltaica centralizada": "Utility-scale photovoltaic",
};
/** Resultado e escopo das conferências do PDE publicadas pela gold. */
export const CONFERENCIA_PDE_EN: Readonly<Record<string, string>> = {
  aprovada: "approved",
  reprovada: "failed",
  "valor e universo": "value and universe",
  "valor (não de universo)": "value (not universe)",
};
/** Descrição do cenário e do universo do PDE 2035 (texto da gold). */
export const CENARIO_PDE_EN: Readonly<Record<string, string>> = {
  "Cenário de Referência (expansão indicativa) e Caso Base (existente e contratado)": "Reference Scenario (indicative expansion) and Base Case (existing and contracted)",
  "Figura 3-25: matriz elétrica nacional, incluindo MMGD, baterias e resposta da demanda; Figura 3-6: SIN, existente e contratado; Figuras 4-19, 4-24 e 4-27: expansão da Rede Básica.":
    "Figure 3-25: national power mix, including MMGD, batteries and demand response; Figure 3-6: SIN, existing and contracted; Figures 4-19, 4-24 and 4-27: expansion of the Basic Grid.",
  "CENÁRIO": "SCENARIO",
  "Anexo I-3 - Geração Centralizada: Evolução da Capacidade Instalada por Fonte de Geração para a Expansão de Referência":
    "Annex I-3 - Centralized generation: evolution of installed capacity by generation source for the reference expansion",
};

/** Órgãos por extenso que a gold publica (autoria do PDE). */
export const ORGAO_EN: Readonly<Record<string, string>> = {
  "EPE e Ministério de Minas e Energia": "EPE and the Ministry of Mines and Energy (MME)",
};

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "janeiro de 2025" → "January 2025"; outro texto volta como veio. */
export function mesPorExtensoEn(texto: string): string {
  return texto.replace(
    /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})\b/g, // i18n: dado
    (_, m: string, a: string) => `${MONTHS_EN[MESES_PT.indexOf(m)]} ${a}`,
  );
}

/** "Portaria MME n° 923, de 30 de junho de 2026" → "MME Ordinance No. 923 of June 30, 2026"; outro texto volta como veio. */
export function atoNormativoEn(texto: string): string {
  const m = /^Portaria (\w+) n[°º] ([\d.]+), de (\d{1,2}) de (\w+) de (\d{4})$/.exec(texto); // i18n: dado
  if (!m || MESES_PT.indexOf(m[4]) < 0) return texto;
  return `${m[1]} Ordinance No. ${m[2]} of ${MONTHS_EN[MESES_PT.indexOf(m[4])]} ${Number(m[3])}, ${m[5]}`;
}

/** Hipóteses do PDE 2035 publicadas pela gold (texto e ressalva), na tradução de trabalho do observatório. */
export const HIPOTESE_PDE_EN: Readonly<Record<string, string>> = {
  "Data-base das premissas: janeiro de 2025.": "Base date of the assumptions: January 2025.",
  "Horizonte do plano: 2026 a 2035.": "Plan horizon: 2026 to 2035.",
  "Caso Base: sistema existente em janeiro de 2025, oferta contratada em leilões regulados até janeiro de 2025 e entrada pelo ambiente livre só de empreendimentos com alta viabilidade, sem expansão indicativa.":
    "Base Case: the system existing in January 2025, supply contracted in regulated auctions up to January 2025 and entry through the free market only of projects with high feasibility, with no indicative expansion.",
  "Retirada do Caso Base de cerca de 11.200 MW de termelétricas existentes com fim de contrato regulado, fim de benefício da CDE/PPT ou sem contrato, por incerteza sobre sua disponibilidade futura.":
    "Removal from the Base Case of about 11,200 MW of existing thermal power plants whose regulated contract or CDE/PPT benefit ends, or that have no contract, due to uncertainty about their future availability.",
  "Cerca de 14.300 MW de retrofit de termelétricas descontratadas oferecidos ao modelo de decisão de investimentos de forma escalonada.":
    "About 14,300 MW of retrofit of uncontracted thermal power plants offered to the investment decision model in stages.",
  "Crescimento médio da carga global do SIN (sem abatimento da MMGD) de cerca de 3,2% ao ano no horizonte.":
    "Average growth of the SIN's gross load (without netting MMGD) of about 3.2% a year over the horizon.",
  "Micro e minigeração distribuída projetada para cerca de 78 GW em 2035 no Cenário de Referência.":
    "Distributed micro and mini generation (MMGD) projected at about 78 GW in 2035 in the Reference Scenario.",
  "Cenário de Referência considera a Lei nº 14.182/2021 (8.000 MW de termelétricas a gás com inflexibilidade de pelo menos 70%, contratação de centrais hidrelétricas de até 50 MW até 2.000 MW e prorrogação do PROINFA) e a Lei nº 14.299/2022 (manutenção do Complexo Jorge Lacerda).":
    "The Reference Scenario considers Law No. 14.182/2021 (8,000 MW of gas-fired thermal plants with at least 70% inflexibility, contracting of hydropower plants of up to 50 MW up to 2,000 MW and extension of PROINFA) and Law No. 14.299/2022 (continued operation of the Jorge Lacerda Complex).",
  "Legislação vigente na data-base (janeiro de 2025). Depois dela, segundo o próprio relatório, entrou em vigor a Medida Provisória nº 1.304/2025 e, a partir dela, foi sancionada a Lei nº 15.269/2025, que alteraram esses artigos (nota 17).":
    "Legislation in force on the base date (January 2025). After that date, according to the report itself, Provisional Measure No. 1.304/2025 came into force and, from it, Law No. 15.269/2025 was enacted, which amended these articles (note 17).",
  "Angra 3 com início de operação comercial em 2033, adotado após consulta ao MME.": "Angra 3 starting commercial operation in 2033, adopted after consulting the MME.",
  "Expansão indicativa escolhida pelo menor custo total que atende aos critérios de suprimento de energia e potência.":
    "Indicative expansion chosen by the lowest total cost that meets the energy and capacity supply criteria.",
};
