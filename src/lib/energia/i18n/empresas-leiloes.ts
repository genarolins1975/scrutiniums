/**
 * Tabelas de tradução dos rótulos que chegam das golds de Empresas, Listadas e Leilões
 * (public/energia/gold/empresas.json, listadas.json e leiloes.json). Cada tabela vai do texto
 * português exato publicado pela gold para o inglês; valor sem entrada volta como veio (em
 * português), e o componente que o exibe o marca com <TrechoPortugues> quando pode.
 *
 * Nenhuma tabela muda número, data ou nome próprio: só a forma inglesa do mesmo rótulo.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "../idioma";
import { dataBR } from "../formato";

export type Tabela = Readonly<Record<string, string>>;

/** Forma inglesa do rótulo publicado pela gold, ou o próprio texto quando a tabela não o tem (ou a página é portuguesa). */
export function traduzir(tabela: Tabela, texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  return tabela[texto] ?? texto;
}

/** Se a página inglesa tem a forma inglesa do rótulo (sem ela, o componente marca o trecho como só em português). */
export function temTraducao(tabela: Tabela, texto: string | null | undefined): boolean {
  return !!texto && Object.prototype.hasOwnProperty.call(tabela, texto);
}

/* ---------------------------------------------------------------- Empresas: cadastro (SIGA) */

/** Fases do SIGA. */
export const FASE_SIGA_EN: Tabela = {
  Operação: "Operation",
  Construção: "Construction",
  "Construção não iniciada": "Construction not started",
};

/** Estado do vínculo das usinas, como a gold o descreve (cadastro.ativos.estados[].rotulo). */
export const ESTADO_VINCULO_GOLD_EN: Tabela = {
  "Todos os proprietários com CNPJ e participações somando 100%": "All owners with CNPJ and stakes adding up to 100%",
  "Participações somam 100%, com algum proprietário sem CNPJ (pessoa física)": "Stakes add up to 100%, with some owner without CNPJ (individual)",
  "Participações publicadas não somam 100% (ex.: matriz e filial com 100% cada)": "Published stakes do not add up to 100% (e.g. head office and branch with 100% each)",
  "Proprietário não informado no SIGA": "Owner not reported in SIGA",
};

/** Regimes de exploração do SIGA (cadastro.ativos.por_regime[].rotulo). */
export const REGIME_EN: Tabela = {
  "Produção Independente de Energia": "Independent power production",
  "Serviço Público": "Public service",
  "Autoprodução de Energia": "Self-production of energy",
  Registro: "Registration",
};

/** Notas curtas da gold de Empresas. */
export const NOTA_EMPRESAS_EN: Tabela = {
  "CNPJ diferente nas duas fontes; causa não verificada (troca de proprietário entre as datas dos arquivos ou divergência de cadastro): cada fonte tem uma única captura.":
    "Different CNPJ in the two sources; cause not verified (change of owner between the file dates or a registry discrepancy): each source has a single capture.",
  "Cobertura das companhias abertas; não é o setor inteiro.": "Coverage of publicly held companies; not the whole sector.",
  "usinas de todas as fases do SIGA (operação, construção e construção não iniciada)": "plants in all SIGA phases (operation, construction and construction not started)",
};

/** Rótulos dos downloads da gold de Empresas (downloads[].rotulo). */
export const DOWNLOAD_EMPRESAS_EN: Tabela = {
  "Usinas e proprietários (CSV)": "Plants and owners (CSV)",
  "Proprietários diretos (CSV)": "Direct owners (CSV)",
  "Grupos de controle (CSV)": "Controlling groups (CSV)",
  "Cadeia societária vigente (CSV)": "Current shareholding chain (CSV)",
  "Cadastro de agentes (CSV)": "Agent registry (CSV)",
  "Transmissão por CNPJ, SIGET (CSV)": "Transmission by CNPJ, SIGET (CSV)",
  "Distribuidoras (CSV)": "Distribution utilities (CSV)",
  "Companhias abertas do universo (CSV)": "Publicly held companies in the universe (CSV)",
  "Demonstrações anuais, DFP (CSV)": "Annual financial statements, DFP (CSV)",
  "Informações trimestrais, ITR (CSV)": "Quarterly information, ITR (CSV)",
};

/** Limitações e bloqueios publicados pela gold de Empresas (proveniencia.*.limitacoes, bloqueios[]). */
export const LIMITACAO_EMPRESAS_EN: Tabela = {
  "O SIGA registra a propriedade direta (a empresa titular da outorga, em geral uma sociedade de propósito específico); o grupo econômico vem da Composição Societária declarada à ANEEL, com as regras de controle publicadas neste módulo.":
    // i18n: dado (inglês com nome próprio da base)
    "SIGA records direct ownership (the company holding the grant, usually a special purpose company); the economic group comes from the Composição Societária (shareholding structure) declared to ANEEL, with the control rules published in this module.",
  "Potência fiscalizada é a capacidade instalada em operação conforme a fiscalização da ANEEL; usina fora de operação não tem potência fiscalizada e entra pela outorgada só nas contagens de carteira.":
    "Inspected capacity is the installed capacity in operation according to ANEEL inspection; a plant out of operation has no inspected capacity and enters through its granted capacity only in portfolio counts.",
  "Micro e minigeração distribuída não está no SIGA e fica fora de todas as medidas de capacidade deste módulo.":
    "Distributed micro and mini generation (MMGD) is not in SIGA and is left out of all capacity measures in this module.",
  "Micro e minigeração distribuída não está no SIGA e fica fora das medidas de capacidade.": "Distributed micro and mini generation (MMGD) is not in SIGA and is left out of the capacity measures.",
  "Demonstrações regulatórias das distribuidoras (Balancete Mensal Padronizado e base de dados da sustentabilidade econômico-financeira) não integradas.":
    "Regulatory financial statements of the distribution utilities (Balancete Mensal Padronizado and the economic and financial sustainability database) not integrated.",
  "Em 30/09/2026, git.aneel.gov.br respondeu HTTP 403 com cf-mitigated: challenge (desafio do Cloudflare) para os arquivos da base de sustentabilidade (2026_1T_base_dados_sustentabilidade.zip) e para a listagem da pasta; http://informacoesbmp.aneel.gov.br/ respondeu HTTP 503. Nenhum conjunto equivalente no portal de dados abertos da ANEEL (buscas: balancete, econômico-financeiro, demonstrações). O acesso não foi contornado.":
    // i18n: dado (inglês com termos de busca literais da fonte)
    "On Sep 30, 2026, git.aneel.gov.br responded HTTP 403 with cf-mitigated: challenge (Cloudflare challenge) for the sustainability database files (2026_1T_base_dados_sustentabilidade.zip) and for the folder listing; http://informacoesbmp.aneel.gov.br/ responded HTTP 503. No equivalent dataset on ANEEL's open data portal (searches: balancete, econômico-financeiro, demonstrações). Access was not circumvented.",
  "Demonstrações societárias da CVM (DFP e ITR), rotuladas como societárias; as regulatórias ficam como pendência.":
    "Corporate financial statements from CVM (DFP and ITR), labeled as corporate; the regulatory ones remain pending.",
  "Participação econômica indireta dos grupos (look-through) não calculada.": "Indirect economic interest of the groups (look-through) not calculated.",
  "O Polímero publica o percentual em relação ao agente declarante e há caminhos múltiplos; o módulo publica a capacidade sob controle e a capacidade proporcional das participações diretas das controladas, métricas sem dupla contagem.":
    // i18n: dado (inglês com nome próprio da base)
    "Polímero publishes the percentage relative to the declaring agent and there are multiple paths; the module publishes the capacity under control and the proportional capacity of the subsidiaries' direct stakes, measures without double counting.",
  "Árvore societária com percentuais diretos quando definidos (CSV da cadeia).": "Shareholding tree with direct percentages when defined (chain CSV).",
};

/** Definições e regras publicadas pela gold de Empresas (definicoes.*, cadastro.transmissao.definicoes.*, regra_vinculo, ramos_universo). */
export const DEFINICAO_EMPRESAS_EN: Tabela = {
  "Vínculo provado = CNPJ publicado pela fonte oficial no mesmo registro do ativo. Nenhum vínculo por semelhança de nome.":
    "Proven link = CNPJ published by the official source in the same record as the asset. No link by name similarity.",
  "Potência fiscalizada da usina × participação do proprietário ÷ soma das participações publicadas (100% dentro da tolerância de arredondamento), somada sobre as usinas em operação com participações válidas.":
    "Inspected capacity of the plant × the owner's stake ÷ sum of the published stakes (100% within the rounding tolerance), summed over the plants in operation with valid stakes.",
  "Potência fiscalizada das usinas em operação em que o proprietário tem mais de 50% (maioria da propriedade do ativo).":
    "Inspected capacity of the plants in operation in which the owner holds more than 50% (majority ownership of the asset).",
  // i18n: dado (inglês com o nome próprio da base, Composição Societária)
  "Topo da cadeia de controladores únicos declarada à ANEEL (Composição Societária): sobe-se de sócio controlador em sócio controlador enquanto há um único controlador com CNPJ.":
    // i18n: dado (inglês com o nome próprio da base, Composição Societária)
    "Top of the chain of single controlling shareholders declared to ANEEL (Composição Societária): the chain goes up from controlling shareholder to controlling shareholder while there is a single controlling shareholder with CNPJ.",
  "Potência das usinas em operação cujo proprietário majoritário pertence ao grupo (está na cadeia de controle que termina nele).":
    "Capacity of the plants in operation whose majority owner belongs to the group (is in the control chain that ends in it).",
  "Soma das participações diretas detidas pelas empresas do grupo (potência × participação); cada parcela pertence a um só grupo, por isso as parcelas somam a fronteira sem dupla contagem.":
    "Sum of the direct stakes held by the group's companies (capacity × stake); each part belongs to a single group, so the parts add up to the boundary without double counting.",
  "Índice Herfindahl-Hirschman: soma dos quadrados das cotas em % (0 a 10.000).": "Herfindahl-Hirschman Index: sum of the squares of the shares in % (0 to 10,000).",
  "Soma da extensão (NumEtnLinTms) dos módulos de linha ativos cujo módulo tem obra em operação ou concluída. Cada módulo de linha é um circuito: linha de circuito duplo conta duas vezes (km de circuito, não km de traçado).":
    "Sum of the length (NumEtnLinTms) of the active line modules whose module has works in operation or completed. Each line module is a circuit: a double-circuit line counts twice (circuit km, not route km).",
  "Subestações distintas em que o CNPJ tem módulo de equipamento em operação. O SIGET aberto liga à subestação só os módulos de equipamento; a mesma subestação pode ter módulos de mais de um CNPJ.":
    "Distinct substations in which the CNPJ has an equipment module in operation. The open SIGET links only equipment modules to the substation; the same substation can have modules from more than one CNPJ.",
  "Potência dos transformadores de potência principais em operação (o reserva não acrescenta capacidade).": "Capacity of the main power transformers in operation (the spare adds no capacity).",
  "Módulo → contrato proprietário (IdeCcdProprietario) → CNPJ publicado no recurso 'SIGET - Contrato Agente'; nenhum vínculo por nome.":
    "Module → owner contract (IdeCcdProprietario) → CNPJ published in the 'SIGET - Contrato Agente' resource; no link by name.",
  "agentes ativos (situação A no cadastro) por ramo declarado": "active agents (status A in the registry) by declared line of business",
};

/** Universo da taxa nacional de perdas (gold de Perdas, "51 concessionárias com os 12 meses de 2025 e sem alerta"), no idioma da página. */
export function universoPerdas(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const m = /^(\d+) concessionárias com os 12 meses de (\d{4}) e sem alerta$/.exec(texto);
  return m ? `${m[1]} concession holders with all 12 months of ${m[2]} and no warning` : texto;
}

/* ---------------------------------------------------------------- Empresas: controle */

/** Motivo da parada da cadeia de controle, como a gold o explica (controle.cobertura.motivos_parada[].rotulo). */
export const MOTIVO_PARADA_GOLD_EN: Tabela = {
  "o agente não aparece na composição societária declarada à ANEEL na janela vigente": "the agent does not appear in the shareholding structure declared to ANEEL in the current window",
  "mais de um sócio marcado como controlador (controle compartilhado)": "more than one shareholder marked as controlling (shared control)",
  "declarações do mesmo trimestre discordam sobre quem é o controlador": "declarations for the same quarter disagree on who the controlling shareholder is",
  "nenhum sócio marcado como controlador": "no shareholder marked as controlling",
  "controlador único sem CNPJ publicado (empresa estrangeira, governo, fundo ou sócio declarado sem documento)":
    "single controlling shareholder without a published CNPJ (foreign company, government, fund or shareholder declared without a document)",
  "controlador único é pessoa física (CPF mascarado pela fonte)": "single controlling shareholder is an individual (CPF masked by the source)",
  "a cadeia de controladores volta a um nó já visitado": "the chain of controlling shareholders returns to a node already visited",
};

/** Nomes genéricos que o arquivo da cadeia põe no lugar de sócio sem identificação publicável (arestas.nome). */
export const SOCIO_GENERICO_EN: Tabela = {
  "pessoa física": "individual",
  "sócio sem documento": "shareholder without a document",
};

/** Estudo documental da Copel (public/energia/estudos/copel-2025.json): segmentos e limites. */
export const ESTUDO_COPEL_EN: Tabela = {
  "Geração e transmissão": "Generation and transmission",
  Geração: "Generation",
  Transmissão: "Transmission",
  Distribuição: "Distribution",
  Comercialização: "Trading",
  Serviços: "Services",
  Holding: "Holding",
  "Holding e serviços": "Holding and services",
  "EBITDA reportado não ajustado, medida não contábil conciliada pela companhia. Investimentos reportados têm definição própria e não são o fluxo líquido de investimento da DFC. Dados de 2025 não descrevem resultados correntes de 2026.":
    "Unadjusted reported EBITDA, a non-accounting measure reconciled by the company. Reported investments have their own definition and are not the net investing cash flow of the cash flow statement (DFC). 2025 data do not describe current 2026 results.",
};

/* ---------------------------------------------------------------- Empresas: finanças (CVM) */

/** Contas padronizadas da CVM (financas.contas[].rotulo). */
export const CONTA_CVM_EN: Tabela = {
  "Receita de venda de bens e/ou serviços": "Net revenue from sales of goods and/or services",
  "Resultado antes do resultado financeiro e dos tributos": "Earnings before financial result and taxes (EBIT)",
  "Lucro ou prejuízo do período": "Net income or loss for the period",
  "Lucro atribuído aos sócios da controladora": "Net income attributable to owners of the parent",
  "Ativo total": "Total assets", // i18n: dado
  "Caixa e equivalentes de caixa": "Cash and cash equivalents",
  "Empréstimos e financiamentos no passivo circulante": "Current loans and financing",
  "Empréstimos e financiamentos no passivo não circulante": "Non-current loans and financing",
  "Patrimônio líquido": "Shareholders' equity",
  "Caixa líquido das atividades operacionais": "Net cash from operating activities",
  "Caixa líquido das atividades de investimento": "Net cash from investing activities",
  "Empréstimos, financiamentos e debêntures (circulante + não circulante)": "Loans, financing and debentures (current + non-current)",
};

/** Definição de cada conta (financas.contas[].definicao). */
export const DEFINICAO_CONTA_EN: Tabela = {
  "Receita líquida da DRE (conta 3.01). Nas distribuidoras inclui a receita de construção da infraestrutura da concessão (ICPC 01), que tem custo equivalente na conta 3.02.":
    "Net revenue in the income statement (DRE, account 3.01). For distribution utilities it includes revenue from building the concession infrastructure (ICPC 01), which has an equivalent cost in account 3.02.",
  "Conta 3.05 da DRE (resultado operacional depois da equivalência patrimonial). Não é EBITDA: depreciação e amortização não são somadas de volta.":
    "Account 3.05 of the income statement (operating result after equity method results). It is not EBITDA: depreciation and amortization are not added back.",
  "Conta 3.11 da DRE. No consolidado inclui a parcela dos sócios não controladores (3.11.02).":
    "Account 3.11 of the income statement. In the consolidated statements it includes the share of non-controlling interests (3.11.02).",
  "Conta 3.11.01 da DRE consolidada. No individual a conta não existe (o lucro inteiro é da companhia).":
    "Account 3.11.01 of the consolidated income statement. In the individual statements the account does not exist (all net income belongs to the company).",
  "Conta 1 do balanço patrimonial ativo, no fim do período.": "Account 1 of the balance sheet (assets), at the end of the period.",
  "Conta 1.01.01 do balanço, no fim do período.": "Account 1.01.01 of the balance sheet, at the end of the period.",
  "Conta 2.01.04 (inclui debêntures e, no modelo vigente, arrendamentos quando a companhia os classifica ali).":
    "Account 2.01.04 (includes debentures and, in the current template, leases when the company classifies them there).",
  "Conta 2.02.01 (inclui debêntures).": "Account 2.02.01 (includes debentures).",
  "Conta 2.03. No consolidado inclui a participação dos não controladores (2.03.09).": "Account 2.03. In the consolidated statements it includes non-controlling interests (2.03.09).",
  "Conta 6.01 da demonstração dos fluxos de caixa (método direto ou indireto).": "Account 6.01 of the cash flow statement (direct or indirect method).",
  "Conta 6.02 da DFC. É a medida padronizada mais próxima de investimento: inclui imobilizado e intangível (ativo de concessão), mas também aquisições, aplicações financeiras e resgates; o investimento em ativos da concessão não tem conta fixa própria.":
    "Account 6.02 of the cash flow statement (DFC). It is the standardized measure closest to investment: it includes property, plant and equipment and intangible assets (concession assets), but also acquisitions, financial investments and redemptions; investment in concession assets has no fixed account of its own.",
  "Soma das contas 2.01.04 e 2.02.01 do mesmo escopo e da mesma data; calculada pelo observatório.":
    "Sum of accounts 2.01.04 and 2.02.01 for the same scope and date; calculated by the observatory.",
};

/** Situação do registro na CVM. */
export const SITUACAO_CVM_EN: Tabela = {
  ATIVO: "ACTIVE",
  CANCELADA: "CANCELLED",
  "SUSPENSO(A) - DECISÃO ADM": "SUSPENDED - ADMINISTRATIVE DECISION",
};

/** Setor declarado à CVM. */
export const SETOR_CVM_EN: Tabela = {
  "Energia Elétrica": "Electric power",
  "Emp. Adm. Part. - Energia Elétrica": "Holding companies - Electric power",
};

/* ---------------------------------------------------------------- Empresas: tarifa */

/**
 * Motivo da falta de tarifa vigente, publicado pela gold de Distribuidoras como frase com datas e CNPJ. Os dois padrões
 * conhecidos são reescritos em inglês com as mesmas datas, CNPJ, siglas e atos; outro texto volta como veio.
 */
export function motivoTarifa(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const data = (d: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    return m ? dataBR(`${m[3]}-${m[2]}-${m[1]}`, "en") : d;
  };
  let m = /^vigência encerrada em (\d{2}\/\d{2}\/\d{4}); a tarifa seguinte ainda não consta no arquivo gerado pela ANEEL em (\d{2}\/\d{2}\/\d{4})$/.exec(texto);
  if (m) return `validity ended on ${data(m[1])}; the next tariff is not yet in the file generated by ANEEL on ${data(m[2])}`;
  m = /^incorporada pela distribuidora de CNPJ (\d{14}) \(sigla atual ([^)]+)\), REA nº ([\d./]+)( \(provável\))?; a tarifa unificada começa em (\d{2}\/\d{2}\/\d{4})$/.exec(texto);
  if (m) return `merged into the distribution utility with CNPJ ${m[1]} (current acronym ${m[2]}), REA No. ${m[3]}${m[4] ? " (probable)" : ""}; the unified tariff starts on ${data(m[5])}`;
  m = /^sem tarifa publicada desde (\d{2}\/\d{2}\/\d{4}); o conjunto não informa o motivo \(incorporação, extinção ou troca de CNPJ\)$/.exec(texto);
  if (m) return `no tariff published since ${data(m[1])}; the dataset does not state the reason (merger, extinction or change of CNPJ)`;
  return texto;
}

/** Se o motivo tem forma inglesa (para o componente marcar o resto como só em português). */
export function motivoTarifaTraduzido(texto: string): boolean {
  return motivoTarifa(texto, "en") !== texto;
}

/* ---------------------------------------------------------------- Listadas (IEE) */

/** Espécie de controle declarada no FCA (controle.especie_fca). */
export const ESPECIE_CONTROLE_EN: Tabela = {
  Privado: "Private",
  "Privado Holding": "Private holding",
  Estatal: "State-owned",
  "Estatal Holding": "State-owned holding",
  Estrangeiro: "Foreign",
  "Estrangeiro Holding": "Foreign holding",
  "não declarada": "not declared",
};

/** Fonte energética das usinas no SIGA (geracao.maiores[].fonte). */
export const FONTE_SIGA_EN: Tabela = {
  "Potencial hidráulico": "Hydraulic potential",
  "Cinética do vento": "Wind kinetics",
  "Radiação solar": "Solar radiation",
  "Gás natural": "Natural gas",
  Petróleo: "Oil",
  "Carvão mineral": "Coal",
  Agroindustriais: "Agro-industrial",
  Nuclear: "Nuclear",
  "Biomassa": "Biomass",
};

/** País declarado do acionista no FRE (controle.fre.acionistas[].nacionalidade). */
export const PAIS_EN: Tabela = {
  Brasil: "Brazil",
  "Estados Unidos": "United States",
  Canadá: "Canada",
};

/** Unidade das finanças das listadas. */
export const UNIDADE_LISTADAS_EN: Tabela = {
  "R$ milhões nominais": "nominal R$ million",
};

/** Regras e definições da gold de Listadas (universo.regra, universo.nota, definicoes.*). */
export const DEFINICAO_LISTADAS_EN: Tabela = {
  "Papéis da carteira do dia do Índice de Energia Elétrica (IEE) da B3, ligados à companhia pelo código CVM publicado pela B3 e conferido no código de negociação declarado no FCA da CVM.":
    "Stocks in the day's portfolio of the B3 Electric Power Index (IEE), linked to the company by the CVM code published by B3 and checked against the ticker declared in the company's CVM registration form (FCA).",
  "O IEE é uma carteira teórica da B3 revista a cada quatro meses: entra e sai papel. Companhias de energia listadas fora do índice (por liquidez ou critério da B3) não estão neste painel.":
    "The IEE is a B3 theoretical portfolio reviewed every four months: stocks enter and leave. Listed power companies outside the index (because of liquidity or B3 criteria) are not in this panel.",
  "Empresa sob controle da companhia listada: a cadeia de controladores únicos declarada à ANEEL (Composição Societária, Polímero) que sobe a partir dela passa pela companhia. Inclui a própria companhia. Controle compartilhado interrompe a cadeia: a SPE em que a companhia divide o controle com outro sócio não entra.":
    // i18n: dado (inglês com o nome próprio da base, Composição Societária)
    "Company under the listed company's control: the chain of single controlling shareholders declared to ANEEL (Composição Societária, Polímero) that rises from it passes through the listed company. It includes the company itself. Shared control breaks the chain: an SPV in which the company shares control with another shareholder is not included.",
  "Potência fiscalizada das usinas em operação no SIGA cujo dono majoritário (mais de 50%, em usina de participações válidas) está sob controle da companhia. Mede comando sobre a usina inteira, não propriedade.":
    "Inspected capacity of the plants in operation in SIGA whose majority owner (more than 50%, in a plant with valid stakes) is under the company's control. It measures command over the whole plant, not ownership.",
  "Soma da potência fiscalizada × participação direta de cada empresa sob controle, nas usinas em operação de participações válidas. Exclui participações detidas por coligadas e por SPE de controle compartilhado (não há look-through).":
    "Sum of inspected capacity × direct stake of each company under control, in plants in operation with valid stakes. It excludes stakes held by affiliates and by shared-control SPVs (no look-through).",
  "Potência outorgada das usinas em construção ou com construção não iniciada no SIGA cujo dono majoritário está sob controle da companhia.":
    "Granted capacity of the plants under construction or with construction not started in SIGA whose majority owner is under the company's control.",
  "Quilômetros de circuito em operação das concessionárias de transmissão sob controle (SIGET, pelo CNPJ do contrato); linha de circuito duplo conta duas vezes.":
    "Circuit kilometers in operation of the transmission concession holders under control (SIGET, by the contract's CNPJ); a double-circuit line counts twice.",
  "Soma das unidades consumidoras das distribuidoras ativas sob controle, no ano de referência da continuidade publicado pelo módulo Qualidade.":
    "Sum of the consumer units of the active distribution utilities under control, in the continuity reference year published by the Quality of supply module.",
  "Resultado antes do resultado financeiro e dos tributos (conta 3.05) ÷ receita (conta 3.01), consolidado, × 100. Nas distribuidoras a receita inclui a receita de construção, que reduz a margem sem mudar o resultado.":
    "Earnings before financial result and taxes (account 3.05) ÷ net revenue (account 3.01), consolidated, × 100. For distribution utilities, revenue includes construction revenue, which lowers the margin without changing earnings.",
  "Empréstimos, financiamentos e debêntures (2.01.04 + 2.02.01) ÷ patrimônio líquido (2.03), consolidado, no fim do exercício. O patrimônio inclui não controladores.":
    "Loans, financing and debentures (2.01.04 + 2.02.01) ÷ shareholders' equity (2.03), consolidated, at the end of the fiscal year. Equity includes non-controlling interests.",
  "Lucro atribuído aos sócios da controladora (3.11.01) ÷ patrimônio líquido no fim do exercício (2.03) × 100. Não é o ROE médio que as companhias divulgam.":
    "Net income attributable to owners of the parent (3.11.01) ÷ shareholders' equity at the end of the fiscal year (2.03) × 100. It is not the average ROE that companies disclose.",
  "Variação do preço de fechamento do papel ajustada por desdobramentos, grupamentos e bonificações, sem proventos em dinheiro.":
    "Change in the stock's closing price adjusted for splits, reverse splits and bonus shares, without cash distributions.",
  "Variação com os proventos em dinheiro (dividendos, juros sobre capital próprio e rendimentos, valores brutos por ação publicados pela B3) reinvestidos no fechamento da data ex, e com os eventos em ações. Não desconta imposto nem custos de negociação.":
    "Change with cash distributions (dividends and interest on equity and other income, gross amounts per share published by B3) reinvested at the close of the ex-date, and with stock events. It does not deduct taxes or trading costs.",
  "Média do volume financeiro diário negociado no papel, lote padrão do mercado à vista, nos pregões dos últimos 3 meses.":
    "Average daily traded value of the stock, standard lot in the cash market, over the trading sessions of the last 3 months.",
};

/* ---------------------------------------------------------------- Leilões */

/** Categorias de fonte dos leilões (leiloes.categorias[].rotulo e por_categoria[].rotulo). */
export const CATEGORIA_LEILAO_EN: Tabela = {
  "Hidrelétrica (UHE)": "Hydropower plant (UHE)",
  "Pequena hidrelétrica (PCH e CGH)": "Small hydropower (PCH and CGH)",
  Eólica: "Wind",
  "Solar fotovoltaica": "Solar photovoltaic",
  "Biomassa e resíduos": "Biomass and waste",
  "Gás natural": "Natural gas",
  "Óleo combustível e diesel": "Fuel oil and diesel",
  "Carvão mineral": "Coal",
};

/** Tipos de leilão (leiloes.tipos[].rotulo e cobertura.tipos_presentes[].rotulo). */
export const TIPO_LEILAO_EN: Tabela = {
  "Energia nova A-3": "New energy A-3",
  "Energia nova A-4": "New energy A-4",
  "Energia nova A-5": "New energy A-5",
  "Energia nova A-6": "New energy A-6",
  "Energia nova A-7": "New energy A-7",
  "Energia de reserva": "Reserve energy",
  "Fontes alternativas": "Alternative sources",
  "Projeto estruturante": "Structuring project",
};

/** Situação atual das usinas vendidas (leiloes.situacoes[].rotulo e .definicao). */
export const SITUACAO_LEILAO_EN: Tabela = {
  "Em operação": "In operation",
  "Em construção": "Under construction",
  "Construção não iniciada": "Construction not started",
  "Outorga revogada ou extinta": "Grant revoked or extinguished",
  "Sem situação identificada": "No status identified",
  "Sem código da usina": "No plant code",
  "Usina com fase Operação no SIGA.": "Plant with the Operation phase in SIGA.",
  "Usina com fase Construção no SIGA.": "Plant with the Construction phase in SIGA.",
  "Usina outorgada com fase Construção não iniciada no SIGA.": "Granted plant with the Construction not started phase in SIGA.",
  "Fora do arquivo aberto do SIGA, com ato de revogação ou extinção da outorga publicado desde 2015.":
    "Outside the open SIGA file, with an act revoking or extinguishing the grant published since 2015.",
  "Fora do arquivo aberto do SIGA e sem ato de encerramento desde 2015 vinculado ao núcleo do CEG.":
    "Outside the open SIGA file and with no termination act since 2015 linked to the CEG core.",
  "Linha do leilão sem núcleo do CEG: não há como cruzar com o cadastro.": "Auction row without a CEG core: it cannot be matched with the registry.",
};

/** Vendas sem grupo de controle provado (leiloes.grupos_controle.sem_vinculo[].rotulo). */
export const SEM_VINCULO_LEILAO_EN: Tabela = {
  "Usina fora do cadastro aberto do SIGA": "Plant outside the open SIGA registry",
  "Usina sem proprietário com mais de 50%": "Plant without an owner holding more than 50%",
  "Usina sem proprietário com CNPJ no SIGA": "Plant without an owner with CNPJ in SIGA",
  "Linha sem código da usina (CEG)": "Row without the plant code (CEG)",
};

/** Regras e notas publicadas pela gold de Leilões (regras, cobertura, vencedoras, grupos_controle, transmissao). */
export const REGRA_LEILAO_EN: Tabela = {
  "Energia vendida (VlrEnergiaVendida) em MWmédio: cada linha é um contrato, então a soma entre leilões é válida. A potência (MW) de uma usina vendida em mais de um leilão se repete em cada um e não é somada entre leilões.":
    "Energy sold (VlrEnergiaVendida) in MWavg: each row is a contract, so the sum across auctions is valid. The capacity (MW) of a plant sold in more than one auction is repeated in each one and is not added across auctions.",
  "Preço de venda por empreendimento (VlrPrecoLeilao), em R$/MWh nominais da data do leilão; nas termelétricas contratadas por disponibilidade, o campo traz o Índice de Custo Benefício (ICB), como diz o dicionário. Média ponderada pela energia vendida das linhas com preço.":
    "Sale price per project (VlrPrecoLeilao), in nominal R$/MWh as of the auction date; for thermal plants contracted by availability, the field carries the Cost-Benefit Index (ICB), as the data dictionary states. Average weighted by the energy sold in rows with a price.",
  "Deságio por empreendimento como publicado (VlrDesagio, %), conferido contra 100 × (1 − preço ÷ teto). Agregado = 100 × (1 − Σ preço × energia ÷ Σ teto × energia).":
    "Discount per project as published (VlrDesagio, %), checked against 100 × (1 − price ÷ ceiling). Aggregate = 100 × (1 − Σ price × energy ÷ Σ ceiling × energy).",
  "Zero que é campo não preenchido vira ausência: preço 0 (1 linha, com deságio 100%), garantia física 0 com energia vendida (2 linhas) e investimento 0 (ampliações e usinas existentes, em geral).":
    "A zero that is an unfilled field becomes missing: price 0 (1 row, with a 100% discount), physical guarantee 0 with energy sold (2 rows) and investment 0 (expansions and existing plants, in general).",
  "Situação atual pelo núcleo do CEG: a fase no SIGA prevalece; fora do SIGA, o ato de revogação ou extinção publicado desde 2015 classifica como outorga encerrada; o resto fica sem situação identificada. Não é cumprimento de contrato: prazos alterados por ato, rescisões, substituições e descontratações não estão nos arquivos.":
    "Current status by CEG core: the SIGA phase prevails; outside SIGA, an act of revocation or extinction published since 2015 classifies the grant as terminated; the rest has no status identified. It is not contract compliance: deadlines changed by act, terminations, substitutions and contract cancellations are not in the files.",
  "Nos produtos A-x, o ano A (início do suprimento) é o ano do leilão mais x. A entrada em operação comparada é a data do SIGA para a usina inteira; ampliação ou usina que já operava antes do leilão fica numa classe própria.":
    "In A-x products, year A (start of supply) is the auction year plus x. The start of operation compared is the SIGA date for the whole plant; an expansion or a plant that was already operating before the auction falls into a class of its own.",
  "Categoria de fonte = DscFonteEnergia, com a hídrica separada em UHE e em PCH ou CGH pelo tipo de geração.":
    "Source category = DscFonteEnergia, with hydro split into UHE and into PCH or CGH by generation type.",
  "O dicionário da ANEEL (versão 1.0, 30/03/2023) descreve o conjunto como os resultados dos leilões de energia do Ambiente de Contratação Regulada realizados desde 2005, com o tipo de leilão entre energia nova (A-3 a A-7), energia de reserva, estruturante e fontes alternativas.":
    "The ANEEL data dictionary (version 1.0, Mar 30, 2023) describes the dataset as the results of the energy auctions of the regulated contracting environment held since 2005, with the auction type among new energy (A-3 to A-7), reserve energy, structuring and alternative sources.",
  "Não estão no arquivo os leilões de energia existente e de ajuste, os de reserva de capacidade, os de sistemas isolados e os procedimentos competitivos simplificados. Ausência na base não prova que não houve leilão.":
    "The file does not include existing energy and adjustment auctions, capacity reserve auctions, isolated systems auctions or simplified competitive procedures. Absence from the database does not prove that no auction took place.",
  "Nome como publicado em DscEmpresaVencedora, que o dicionário descreve como a empresa vencedora ou o nome do cotista do consórcio. O arquivo não traz CNPJ: grafias diferentes da mesma empresa ficam separadas e nenhum nome é fundido por semelhança.":
    "Name as published in DscEmpresaVencedora, which the data dictionary describes as the winning company or the name of the consortium member. The file has no CNPJ: different spellings of the same company stay separate and no name is merged by similarity.",
  "Grupo que controla a usina no cadastro mais recente: proprietário com mais de 50% da usina no SIGA (vínculo pelo CNPJ publicado no mesmo registro) e o topo da sua cadeia de controladores únicos declarada à ANEEL (Composição Societária), como no módulo Empresas. Não é a vencedora na data do leilão: a usina pode ter mudado de dono, e a vencedora publicada pode ser um cotista do consórcio.":
    // i18n: dado (inglês com o nome próprio da base, Composição Societária)
    "Group that controls the plant in the most recent registry: the owner with more than 50% of the plant in SIGA (link by the CNPJ published in the same record) and the top of its chain of single controlling shareholders declared to ANEEL (Composição Societária), as in the Companies module. It is not the winner on the auction date: the plant may have changed owners, and the published winner may be a consortium member.",
  "Deságio de cada lote = 100 × (1 − RAP vencedora ÷ RAP do edital), recalculado das RAPs publicadas; o agregado do ano pondera pela RAP do edital. Lotes sem vencedor não entram.":
    "Discount of each lot = 100 × (1 − winning RAP ÷ tender RAP), recalculated from the published RAPs; the year's aggregate is weighted by the tender RAP. Lots without a winner are excluded.",
  "RAP e investimento de cada lote × I(último mês) ÷ I(mês do leilão), número-índice do IPCA (IBGE).": "RAP and investment of each lot × I(latest month) ÷ I(auction month), IPCA index number (IBGE).",
  "Lote com vencedor 'SEM LANCE', 'SEM INSCRITO APTO' ou 'NÃO LEILOADO' não foi contratado: fica fora de lotes contratados, km, MVA, investimento e RAP, e o 0 que a fonte publica em km, MVA, prazo e RAP vencedora é tratado como ausência.":
    // i18n: dado (inglês com os valores literais da fonte entre aspas)
    "A lot with winner 'SEM LANCE' (no bid), 'SEM INSCRITO APTO' (no qualified bidder) or 'NÃO LEILOADO' (not auctioned) was not contracted: it is left out of contracted lots, km, MVA, investment and RAP, and the 0 the source publishes for km, MVA, deadline and winning RAP is treated as missing.",
};

/** Rótulos dos downloads da gold de Leilões (downloads[].rotulo). */
export const DOWNLOAD_LEILAO_EN: Tabela = {
  "Empreendimentos contratados, com situação atual e grupo de controle (CSV)": "Contracted projects, with current status and controlling group (CSV)",
  "Resumo por leilão (CSV)": "Summary by auction (CSV)",
  "Preço médio por fonte e ano, nominal e real (CSV)": "Average price by source and year, nominal and real (CSV)",
  "Energia contratada por grupo que controla a usina no cadastro mais recente (CSV)": "Energy contracted by group that controls the plant in the most recent registry (CSV)",
  "Leilões de transmissão por ano, corrigidos pelo IPCA (CSV)": "Transmission auctions by year, adjusted by the IPCA (CSV)",
};

/** Situação da obra no RALIE (entrega.ralie_situacao_obra, chaves). */
export const OBRA_RALIE_EN: Tabela = {
  "Em andamento": "in progress",
  "Não Iniciada": "not started",
  Paralisada: "halted",
};

/** Módulo do observatório que publicou um insumo (insumos[].modulo). */
export const MODULO_EN: Tabela = {
  expansao: "Expansion",
  empresas: "Companies",
  geracao: "Generation",
  perdas: "Losses",
  qualidade: "Quality of supply",
};

/** Regra do preço real dos leilões, que traz o mês do IPCA ("I(set/2026)"): reescrita com o mesmo mês, em inglês. */
export function regraPrecoReal(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  const meses: Record<string, string> = { jan: "Jan", fev: "Feb", mar: "Mar", abr: "Apr", mai: "May", jun: "Jun", jul: "Jul", ago: "Aug", set: "Sep", out: "Oct", nov: "Nov", dez: "Dec" };
  const m = /^Preço real = preço × I\(([a-z]{3})\/(\d{4})\) ÷ I\(mês do leilão\), com o número-índice do IPCA do IBGE \(tabela 1737\)\. É uma régua de comparação entre anos, não o preço vigente de cada contrato, que segue o reajuste próprio do edital e do contrato\.$/.exec(texto);
  if (!m || !meses[m[1]]) return texto;
  return `Real price = price × I(${meses[m[1]]}/${m[2]}) ÷ I(auction month), using the IBGE IPCA index number (table 1737). It is a yardstick for comparing years, not the current price of each contract, which follows the adjustment set in its own tender and contract.`;
}

/** Regra da gold de Leilões no idioma da página: a tabela exata, e a do preço real pelo padrão. */
export function regraLeilao(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  return REGRA_LEILAO_EN[texto] ?? regraPrecoReal(texto, idioma);
}

/** Se a regra tem forma inglesa (sem ela, o componente marca o trecho como só em português). */
export function regraLeilaoTraduzida(texto: string): boolean {
  return regraLeilao(texto, "en") !== texto;
}
