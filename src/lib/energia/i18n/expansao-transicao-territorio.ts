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

/* ================================================================ Transição */

/** Fonte de geração da MMGD (rótulo publicado pela gold). */
export const FONTE_MMGD_EN: Readonly<Record<string, string>> = {
  "Solar fotovoltaica": "Solar photovoltaic",
  "Termelétrica (biogás, biomassa e outros combustíveis)": "Thermal (biogas, biomass and other fuels)",
  "Hidráulica": "Hydro",
  "Eólica": "Wind",
  "Fonte não informada": "Source not reported",
};
/** Dia da semana como a gold o publica. */
export const DIA_SEMANA_EN: Readonly<Record<string, string>> = {
  segunda: "Monday",
  "terça": "Tuesday",
  quarta: "Wednesday",
  quinta: "Thursday",
  sexta: "Friday",
  "sábado": "Saturday",
  domingo: "Sunday",
};
/** Feriados nacionais citados na conferência do ONS. */
export const FERIADO_EN: Readonly<Record<string, string>> = {
  "Dia do Trabalho": "Labour Day",
  Tiradentes: "Tiradentes Day",
  feriado: "holiday",
};
/** Notas curtas da gold da Transição com versão inglesa. */
export const NOTA_TRANSICAO_EN: Readonly<Record<string, string>> = {
  "Uma única captura do cadastro integrada até aqui: as revisões por registro tardio serão medidas a partir da próxima captura.":
    "A single capture of the register integrated so far: revisions due to late registration will be measured from the next capture on.",
  "Ainda não há duas capturas do cadastro para medir revisões.": "There are not yet two captures of the register to measure revisions.",
  // Regras publicadas em transicao.json (regras.*)
  "Potência instalada cadastrada (kW, MW) é capacidade; energia gerada (MWh, MWmed) só aparece na estimativa do ONS, em bloco separado.":
    "Registered installed capacity (kW, MW) is capacity; energy generated (MWh, MWavg) only appears in the ONS estimate, in a separate block.",
  "Cadastro regulatório da ANEEL e estimativa operacional do ONS são grandezas diferentes: nunca somadas, só comparadas por razão rotulada.":
    "ANEEL's regulatory register and the ONS operational estimate are different quantities: never added, only compared through a labeled ratio.",
  "Ano e mês vêm da data de conexão publicada (DthAtualizaCadastralEmpreend, conferida com DatConexao do recurso técnico).":
    "Year and month come from the published connection date (DthAtualizaCadastralEmpreend, checked against DatConexao in the technical resource).",
  "Os 6 meses anteriores à data do cadastro são provisórios: conexões desses meses ainda podem entrar em capturas seguintes; a queda nesses meses não tem causa atribuída.":
    "The 6 months before the register date are provisional: connections in those months may still enter later captures; the drop in those months has no attributed cause.",
  "Comparações de crescimento usam o último ano completo antes da data do cadastro; o ano corrente é parcial e não entra em ranking.":
    "Growth comparisons use the last full year before the register date; the current year is partial and does not enter rankings.",
  "Por habitante usa a população estimada pelo IBGE; rankings só com população de pelo menos 100.000.":
    "Per inhabitant uses the population estimated by the IBGE; rankings only with a population of at least 100,000.",
  "Participações em % com duas casas; abaixo de 0,01% (e diferente de zero), com dois algarismos significativos.":
    "Shares in % with two decimal places; below 0.01% (and other than zero), with two significant digits.",
  "Séries anual e mensal do cadastro trazem todos os anos e meses entre a primeira conexão e a data do cadastro. Dentro da cobertura declarada pela ANEEL (a partir de dez/2008), sem conexão = zero explícito; antes dela, período sem registro fica nulo e registro existente é publicado, os dois rotulados como fora da cobertura (ou em parte, no ano de 2008).":
    "The annual and monthly register series carry every year and month between the first connection and the register date. Within the coverage declared by ANEEL (from Dec/2008), no connection = explicit zero; before it, a period without records stays null and an existing record is published, both labeled as outside coverage (or partly, in the year 2008).",
  "Unidades em UF onde a distribuidora (CNPJ) não tem conjunto elétrico ficam no município publicado, sinalizadas e contadas, sem correção, em duas classes pelo CEP publicado: provável município errado (CEP na área da distribuidora) e provável distribuidora errada (CEP, código e UF na UF do município), além das indeterminadas.":
    "Units in a state where the distribution utility (CNPJ) has no consumer set stay in the published municipality, flagged and counted, without correction, in two classes by the published postal code (CEP): probable wrong municipality (CEP in the utility's area) and probable wrong utility (CEP, code and state in the municipality's state), plus the undetermined ones.",
  "Potência ausente não vira zero: a unidade conta, a soma de kW é das potências informadas, unidades_sem_potencia marca a soma parcial e potência nula marca agregado sem nenhuma potência.":
    "Missing capacity does not become zero: the unit counts, the kW sum is of the reported capacities, unidades_sem_potencia marks the partial sum and null capacity marks an aggregate with no capacity at all.", // i18n: dado
  "Fator médio (inventários) e fatores de margem (MDL) são séries separadas e não se substituem.":
    "The average factor (inventories) and the margin factors (CDM) are separate series and do not replace each other.",
  "Os fatores do MCTI são de CO2, em tCO2/MWh; não são CO2 equivalente.": "The MCTI factors are for CO2, in tCO2/MWh; they are not CO2 equivalent.",
  "Não há intensidade de emissão municipal nem horária: o fator oficial é nacional (SIN) e mensal.":
    "There is no municipal or hourly emissions intensity: the official factor is national (SIN) and monthly.",
  // Controles do cadastro de MMGD (mmgd.controles)
  "A ANEEL declara a cobertura da relação a partir de dezembro de 2008. Dentro dela, período sem conexão no cadastro é zero explícito; antes dela (e no ano de 2008, coberto só em dezembro), período sem registro fica nulo, e registro existente é publicado como está, com o rótulo de cobertura.":
    "ANEEL declares the coverage of the register from December 2008. Within it, a period without connections in the register is an explicit zero; before it (and in the year 2008, covered only in December), a period without records stays null, and an existing record is published as is, with the coverage label.",
  "medida e publicada, não removida: CPF e CEP de pessoa física vêm tarjados e unidades iguais do mesmo titular podem ser legítimas":
    "measured and published, not removed: the CPF and postal code of individuals come redacted, and identical units of the same holder may be legitimate",
  "sinalizadas e separadas em classes pelo CEP, não corrigidas nem removidas: o código de município e o CNPJ são os publicados pela ANEEL":
    "flagged and split into classes by postal code (CEP), neither corrected nor removed: the municipality code and the CNPJ are the ones published by ANEEL",
  "UF atendida = UF de algum município de algum conjunto elétrico do CNPJ, em qualquer ano da base (1990 a 2032); comparação só por CNPJ e código IBGE, sem nome":
    "state served = state of any municipality of any consumer set of the CNPJ, in any year of the database (1990 to 2032); comparison only by CNPJ and IBGE code, without names",
  "Provável código de município errado: o CEP publicado fica numa UF da área da distribuidora":
    "Probable wrong municipality code: the published postal code is in a state within the utility's area",
  "Provável distribuidora (CNPJ) errada: CEP, código do empreendimento e UF publicada ficam na UF do município":
    "Probable wrong distribution utility (CNPJ): postal code, project code and published state are in the municipality's state",
  "Indeterminada: CEP ausente, de preenchimento, sem referência, numa terceira UF ou sinais divergentes":
    "Undetermined: postal code missing, placeholder, without reference, in a third state or divergent signals",
  "Para refazer a potência por habitante de um município sem as unidades que provavelmente estão em outro município, desconte só a classe de provável município errado (colunas do CSV municipal). A classe de provável distribuidora errada fica no município publicado e infla o total da distribuidora informada.":
    "To recompute a municipality's capacity per inhabitant without the units that are probably in another municipality, discount only the probable wrong municipality class (columns of the municipal CSV). The probable wrong utility class stays in the published municipality and inflates the total of the reported utility.", // i18n: dado
  "UF do CEP = UF (pelo código IBGE do município) que reúne pelo menos 90% das unidades não sinalizadas do cadastro com o mesmo prefixo de 5 dígitos; prefixo sem unidade não sinalizada, ou sem UF que chegue a 90%, usa o de 3 dígitos pela mesma regra; prefixo com os cinco dígitos iguais (ex.: 77777) é preenchimento. A tabela oficial de faixas de CEP por UF dos Correios só é consultável com verificação humana, que não é contornada.":
    "State of the postal code = the state (by the municipality's IBGE code) that gathers at least 90% of the unflagged units of the register with the same 5-digit prefix; a prefix without unflagged units, or with no state reaching 90%, uses the 3-digit one by the same rule; a prefix with five identical digits (e.g. 77777) is a placeholder. The official table of postal code ranges by state from Correios can only be consulted with human verification, which is not circumvented.",
  // Validações e conferência da estimativa do ONS (ons_mmgd)
  "0 ≤ participação ≤ 100% em cada mês (submercado e SIN) e em cada ano (SIN); violação derruba a publicação":
    "0 ≤ share ≤ 100% in each month (submarket and SIN) and in each year (SIN); a violation blocks the release",
  "dia por submercado com MMGD estimada negativa ou maior que a carga global do dia": "day per submarket with estimated MMGD negative or greater than the day's gross load",
  "ressalva na proveniência; os dias ficam na série como o ONS publica": "caveat in the provenance; the days stay in the series as the ONS publishes them",
  "cada dia de 29/04 a 06/05/2023 menos o mesmo dia da semana 14 dias antes (médias de 24 horas); pares com feriado nacional (21/04 e 01/05) ficam fora da mediana":
    "each day from Apr 29 to May 6, 2023 minus the same weekday 14 days earlier (24-hour averages); pairs with a national holiday (Apr 21 and May 1) stay out of the median",
  "O ONS declara, na página do Balanço de Energia, que a estimativa de MMGD passou a compor os dados de geração e carga a partir de 29/04/2023. No dado, a solar do SIN no balanço sobe 2.386 MWmed de 28/04 para 29/04/2023; a MMGD estimada pela API de carga verificada, como publicada na data de processamento, é 3.528 MWmed em 29/04/2023, 1.142 MWmed acima do degrau. A fonte não publica explicação para essa diferença. Comparando cada dia de 29/04 a 06/05 com o mesmo dia da semana 14 dias antes (6 pares, sem feriados), a mediana das diferenças é 2.840 MWmed na solar e 559 MWmed na carga, para 3.478 MWmed de MMGD estimada nos mesmos dias: na carga do balanço não aparece degrau do tamanho da MMGD estimada.":
    "The ONS states, on the Energy Balance page, that the MMGD estimate began to make up the generation and load data from Apr 29, 2023. In the data, SIN solar in the balance rises 2,386 MWavg from Apr 28 to Apr 29, 2023; the MMGD estimated by the verified load API, as published on the processing date, is 3,528 MWavg on Apr 29, 2023, 1,142 MWavg above the step. The source publishes no explanation for this difference. Comparing each day from Apr 29 to May 6 with the same weekday 14 days earlier (6 pairs, without holidays), the median of the differences is 2,840 MWavg in solar and 559 MWavg in load, against 3,478 MWavg of estimated MMGD on the same days: the balance load shows no step the size of the estimated MMGD.",
  // Fatores de emissão do MCTI (emissoes)
  "Base de usinas do ONS ampliada (termelétricas a biomassa e conjuntos de usinas solares e eólicas, de emissão nula); metodologia mantida. Valores a partir de jan/2025 podem ser menores por causa da base, não só da operação.":
    "ONS plant database expanded (biomass thermal plants and clusters of solar and wind plants, with zero emissions); methodology kept. Values from Jan/2025 on may be lower because of the database, not only because of operation.",
  "energia despachada no SIN usada pelo MCTI no método simples ajustado (MWh), antes e depois da ampliação da base":
    "energy dispatched in the SIN used by the MCTI in the simple adjusted method (MWh), before and after the database expansion",
  "Uma estimativa própria de intensidade (por exemplo, geração térmica do ONS por combustível multiplicada por fatores de combustível) exigiria consumo específico de cada usina, que não é publicado de forma estruturada; o resultado teria incerteza maior que a diferença entre anos e não substitui o fator oficial. Nada foi estimado.":
    "An in-house intensity estimate (for example, ONS thermal generation by fuel multiplied by fuel factors) would require each plant's specific consumption, which is not published in a structured way; the result would have an uncertainty larger than the difference between years and would not replace the official factor. Nothing was estimated.",
  "site institucional anterior do MCTI (antigo.mctic.gov.br), planilhas oficiais de 2006 a 2021: usadas só onde a página vigente não tem valor, e sempre comparadas com ela":
    "previous institutional MCTI website (antigo.mctic.gov.br), official spreadsheets from 2006 to 2021: used only where the current page has no value, and always compared with it",
  "média simples dos fatores diários da margem de operação comparada ao fator mensal publicado":
    "simple average of the daily operating margin factors compared with the published monthly factor",
  "data inexistente no calendário": "date that does not exist in the calendar",
  "data inexistente no calendário (valor da publicação anterior)": "date that does not exist in the calendar (value from the previous release)",
  "CO2 (não CO2e)": "CO2 (not CO2e)",
  atual: "current",
};
/** Série dos fatores do MCTI como a gold a nomeia (código com espaço no lugar do sublinhado, ou rótulo). */
export const SERIE_MCTI_EN: Readonly<Record<string, string>> = {
  "margem operacao diaria": "operating margin, daily",
  "margem operacao mensal": "operating margin, monthly",
  "margem construcao": "build margin",
  "fator médio mensal": "average factor, monthly",
  "fator médio anual": "average factor, annual",
  "margem de operação (despacho) diária": "operating margin (dispatch), daily",
  "margem de operação (despacho) mensal": "operating margin (dispatch), monthly",
  "margem de operação (simples ajustado) anual": "operating margin (simple adjusted), annual",
  "margem de construção anual": "build margin, annual",
};
/** Resultado de controle publicado na gold. */
export const RESULTADO_CONTROLE_EN: Readonly<Record<string, string>> = {
  aprovada: "passed",
  aprovado: "passed",
  reprovada: "failed",
  reprovado: "failed",
};
/** Motivo das unidades indeterminadas pelo CEP (código da gold, com espaço no lugar do sublinhado). */
export const MOTIVO_CEP_EN: Readonly<Record<string, string>> = {
  "sem cep": "no postal code",
  "cep de preenchimento": "placeholder postal code",
  "cep sem referencia": "postal code without reference",
  "cep em terceira uf": "postal code in a third state",
  "sinais divergentes": "divergent signals",
};
/** Modelo do aviso sobre o total de uma distribuidora na MMGD (texto gerado pelo pipeline). */
export const AVISO_DISTRIBUIDORA =
  /^O total inclui ([\d.]+) unidades \(([\d,]+) MW\) cadastradas com este CNPJ em ([A-Z, ]+), onde ele não tem conjunto elétrico, com CEP, código do empreendimento e UF publicada na UF do município: provavelmente são de outra distribuidora e inflam o total desta\.$/; // i18n: dado

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
  "Geração total de eletricidade por fonte no horizonte decenal": "Total electricity generation by source over the ten-year horizon", // i18n: dado
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
  "Total (MW)": "Total (MW)", // i18n: dado
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

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; // i18n: dado
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
    "Indicative expansion chosen by the lowest total cost that meets the energy and capacity supply criteria.", // i18n: dado
};

/* ================================================================ Território */

/** Grão territorial (graos[].rotulo da gold). */
export const GRAO_TERRITORIO_EN: Readonly<Record<string, string>> = {
  Submercado: "Submarket",
  "Unidade da federação": "State",
  "Área de atuação da distribuidora": "Distribution utility service area",
  "Conjunto elétrico": "Consumer set",
  "Município": "Municipality",
  Usina: "Power plant",
};
/** De quem é o número na ficha de um município (graos[].rotulo_no_municipio da gold). */
export const GRAO_NO_MUNICIPIO_EN: Readonly<Record<string, string>> = {
  "do submercado a que a UF do município pertence (área de carga do ONS); não é um valor do município":
    "of the submarket the municipality's state belongs to (ONS load area); not a value of the municipality",
  "da UF do município": "of the municipality's state",
  "da distribuidora que atende o município (valor da área inteira da distribuidora, não do município)":
    "of the distribution utility serving the municipality (value for the utility's whole area, not for the municipality)",
  "do conjunto elétrico que atende o município (o conjunto pode cobrir outros municípios ou só parte deste)":
    "of the consumer set serving the municipality (the set may cover other municipalities or only part of this one)",
  "do município": "of the municipality",
  "da usina (ponto); uma usina declarada em vários municípios não tem a potência repartida":
    "of the plant (point); a plant declared in several municipalities does not have its capacity split",
};
/** Nome de camada do mapa (camadas[].rotulo da gold). */
export const CAMADA_TERRITORIO_EN: Readonly<Record<string, string>> = {
  Submercados: "Submarkets",
  "Áreas das distribuidoras": "Distribution utility areas",
  "Municípios": "Municipalities",
  Usinas: "Power plants",
};
/** Descrição de camada do mapa (camadas[].descricao da gold, como publicada). */
export const DESCRICAO_CAMADA_EN: Readonly<Record<string, string>> = {
  "Cada UF pintada pelo subsistema da camada oficial da EPE, com a pertença das suas áreas de carga provada pela soma da carga do ONS. A divisa é a da UF: o ONS não publica limite geográfico do submercado. Os municípios fora do SIN (sm_estado 'fora_do_sin' no índice municipal) recebem marca própria por cima: a cor da UF não vale para eles.":
    "Each state colored by the subsystem of the official EPE layer, with the membership of its load areas checked by the sum of the ONS load. The border is the state's: the ONS publishes no geographic boundary for the submarket. Municipalities outside the SIN get their own mark on top: the state's color does not hold for them.",
  "Municípios inteiros agrupados pela relação oficial; município com mais de uma distribuidora tem marca própria.":
    "Whole municipalities grouped by the official list; a municipality with more than one distribution utility has its own mark.",
  "Indicadores publicados por município (MMGD, Tarifa Social, Luz para Todos, usinas declaradas só no município, localidades isoladas).":
    "Indicators published by municipality (MMGD, Social Tariff, Luz para Todos, plants declared only in the municipality, isolated localities).",
  "Pontos do SIGA na mesma grade da malha. A coordenada é aproximada (centróide do empreendimento).":
    "SIGA points on the same grid as the map. The coordinate is approximate (centroid of the project).",
};
/** Regra de compatibilidade entre grãos (compatibilidade[].regra da gold). */
export const REGRA_COMPATIBILIDADE_EN: Readonly<Record<string, string>> = {
  "Pela relação oficial conjunto × município (módulo Perdas). Um vínculo leva à distribuidora; com mais de um, a seleção lista as distribuidoras e não escolhe por conta própria.":
    "Through the official consumer set × municipality list (Losses module). One link leads to the distribution utility; with more than one, the selection lists the utilities and does not choose on its own.",
  "Pela relação IndQual Município (módulo Qualidade). O DEC exibido é do conjunto inteiro.":
    "Through the IndQual Municipality list (Quality module). The DEC shown is for the whole consumer set.",
  "Pela UF do município (subsistema da UF na camada oficial da EPE, com a pertença das áreas de carga do ONS provada pela soma). Município cuja sede é localidade isolada do PASI, ou com ao menos metade da população em localidades isoladas, está fora do SIN: o submercado não se aplica a ele.":
    "Through the municipality's state (the state's subsystem in the official EPE layer, with the membership of the ONS load areas checked by the sum). A municipality whose seat is an isolated locality of the PASI, or with at least half of its population in isolated localities, is outside the SIN: the submarket does not apply to it.",
  "Usinas que o SIGA declara no município (nome oficial do IBGE). A coordenada é conferida, não decide.":
    "Plants that SIGA declares in the municipality (official IBGE name). The coordinate is checked, it does not decide.",
  "A área da distribuidora é o conjunto dos municípios da relação; selecionar a distribuidora destaca os municípios, não seleciona um deles.":
    "The distribution utility's area is the set of municipalities in the list; selecting the utility highlights the municipalities, it does not select one of them.",
  "Submercados das UFs dos municípios de vínculo válido da distribuidora que estão no SIN; com mais de um, a seleção lista todos. Municípios fora do SIN não contam e são informados à parte (area.fora_do_sin).":
    "Submarkets of the states of the utility's validly linked municipalities that are in the SIN; with more than one, the selection lists all of them. Municipalities outside the SIN do not count and are reported separately.",
  "UFs cujas áreas de carga o ONS soma no submercado.": "States whose load areas the ONS adds up in the submarket.",
  "Selecionar um submercado não seleciona município: o submercado contém centenas de municípios e os seus números não são de nenhum deles.":
    "Selecting a submarket does not select a municipality: the submarket contains hundreds of municipalities and its figures belong to none of them.",
  "Municípios declarados pelo SIGA para a usina (um ou mais).": "Municipalities declared by SIGA for the plant (one or more).",
  "Não se aplica: o submercado de uma usina depende do ponto de conexão à rede, que o SIGA não publica; a UF ou o município da usina não decidem.":
    "Does not apply: a plant's submarket depends on its grid connection point, which SIGA does not publish; the plant's state or municipality does not decide it.",
  "Não se aplica: usina de geração centralizada não é atendida pela distribuidora do município em que está.":
    "Does not apply: a centralized generation plant is not served by the distribution utility of the municipality where it is located.",
};
