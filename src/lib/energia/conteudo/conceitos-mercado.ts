import type { Conceito, FonteOficial } from "./conceitos";

/**
 * Verbetes do módulo mercado. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes, versionadas em pipeline/energia/seed/documentos_aprenda/ (MANIFESTO.json com o
 * sha256 de cada original e a transformação aplicada):
 * - MRE: glossário do InfoMercado mensal Nº 229 da CCEE (julho de 2026, publicado em
 *   10/09/2026), página 12, capturado pelo pipeline em 06/10/2026 às 17h01 de Brasília (sha256
 *   c7efe73d4792c5ddda3148d68b4de8de840ad9f47187212e2a79c3bb4054aae5);
 * - ACR, ACL, garantia física e ESS: Decreto nº 5.163/2004, texto compilado do Planalto
 *   acessado em 06/10/2026 às 18h28 de Brasília, na redação vigente (art. 1º, § 2º; art. 2º,
 *   §§ 1º a 3º; art. 59).
 * - GSF: Boletim Mensal de Monitoramento do Sistema Elétrico Brasileiro de janeiro de 2021 e
 *   Relatório do GT Aprimoramento do MRE de julho de 2019, ambos do MME, conferidos em
 *   07/10/2026 e versionados em v20261007T211054Z (sha256 de cada original no MANIFESTO.json).
 * Os trechos são literais; a paráfrase não acrescenta nada que eles não digam. Nenhum desses
 * documentos é a definição regulatória do fator: as Regras de Comercialização da CCEE e a
 * regulamentação da ANEEL não foram acessadas, e o verbete GSF diz isso. As definições
 * operacionais do módulo (gold mercado.json, bloco "definicoes") são método do observatório,
 * não documento primário.
 */

const URL_IM_229 = "https://www.ccee.org.br/documents/80415/35773859/InfoMercado-mensal_JUL_26_229.pdf/92b947aa-21df-f603-a4dc-87876f30a94a";

const URL_D5163 = "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5163.htm";

const d5163 = (dispositivo: string, trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "Presidência da República",
  documento: `Decreto nº 5.163, de 30 de julho de 2004, ${dispositivo} (texto compilado, redação vigente em 06/10/2026)`,
  url: URL_D5163,
  trecho,
  parafrase,
});

const URL_BOLETIM_MME = "https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/publicacoes/boletim-de-monitoramento-do-sistema-eletrico/2021/boletim-de-monitoramento-do-sistema-eletrico-jan-2021.pdf";

const URL_GT_MRE = "https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-executiva/modernizacao-do-setor-eletrico/arquivos/pasta-geral-publicada/mre.pdf";

const boletimMme = (secao: string, trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "MME",
  documento: `Boletim Mensal de Monitoramento do Sistema Elétrico Brasileiro, janeiro de 2021, ${secao}`,
  url: URL_BOLETIM_MME,
  trecho,
  parafrase,
});

const gtMre = (secao: string, trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "MME, GT Modernização do Setor Elétrico",
  documento: `Relatório do Grupo Temático Aprimoramento do MRE, julho de 2019, ${secao}`,
  url: URL_GT_MRE,
  trecho,
  parafrase,
});

const VEJA_LIVRE = [{ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado" }];

const im229 = (trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "CCEE",
  documento: "InfoMercado mensal Nº 229 (julho de 2026), seção 12, Glossário, página 12",
  url: URL_IM_229,
  trecho,
  parafrase,
});

export const CONCEITOS: Conceito[] = [
  {
    slug: "mre",
    sigla: "MRE",
    nome: "Mecanismo de Realocação de Energia",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase:
      "Mecanismo de compartilhamento dos riscos hidrológicos associados à otimização eletroenergética do Sistema Interligado Nacional (SIN), por meio do despacho centralizado das unidades de geração de energia elétrica.",
    porQueImporta:
      "O risco hidrológico é compartilhado entre as usinas participantes do mecanismo, em vez de ficar com cada uma isoladamente. Segundo o relatório do GT de Aprimoramento do MRE, participam também as PCHs, que não são despachadas centralizadamente; para elas, o MRE é uma forma de mitigar o risco hidrológico.",
    comoEMedido:
      "Não é uma grandeza. O resultado do mecanismo, mês a mês, é o GSF (ver o verbete): no observatório, a geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade, calculada com os conjuntos abertos da CCEE e conferida com o fator mensal do InfoMercado em alguns meses da série.",
    relacoes: ["gsf", "garantia-fisica", "mcp"],
    fontes: [
      im229(
        "MRE – Mecanismo de compartilhamento dos riscos hidrológicos associados à otimização eletroenergética do SIN, por meio do despacho centralizado das unidades de geração de energia elétrica.",
        "Em outras palavras: as usinas dividem entre si o risco ligado à água, no contexto de uma operação do sistema interligado otimizada e despachada de forma centralizada.",
      ),
      gtMre(
        "seção sobre as PCHs no mecanismo, página 18",
        "As PCHs são usinas a fio d’água e não participam do despacho centralizado. A extensão do MRE às PCHs permite a elas mitigar o respectivo risco hidrológico e, portanto, melhorar sua competitividade.",
        "Em outras palavras: as pequenas centrais hidrelétricas podem participar do MRE mesmo sem fazer parte do despacho centralizado, e isso as ajuda a reduzir o risco hidrológico.",
      ),
    ],
    limitacoes: [
      "O glossário do InfoMercado define o mecanismo, não a fórmula do fator de ajuste; a razão usada no observatório é a que reproduz o fator mensal publicado pela CCEE, e a divergência com o número de 12 meses do InfoMercado está publicada no painel.",
    ],
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
  {
    slug: "acr",
    sigla: "ACR",
    nome: "Ambiente de Contratação Regulada",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase: "Segmento do mercado em que agentes vendedores e distribuidoras compram e vendem energia por meio de licitação, conforme regras e procedimentos de comercialização específicos.",
    porQueImporta:
      "É o ambiente em que a distribuidora compra a energia para o mercado que atende: o mesmo Decreto exige que os agentes de distribuição garantam cem por cento desse mercado por contratos registrados na CCEE (art. 2º, inciso II).",
    comoEMedido:
      "No observatório, pelo consumo contabilizado pela CCEE na classe de agente Distribuidor, em MW médios, ao lado do ACL; na EPE, pelo consumo cativo na rede, em MWh. Participações sempre como razão de somas em energia.",
    relacoes: ["acl", "mcp", "pld", "tarifa-te-tusd"],
    fontes: [
      d5163(
        "art. 1º, § 2º, inciso I",
        "I - Ambiente de Contratação Regulada - ACR o segmento do mercado no qual se realizam as operações de compra e venda de energia elétrica entre agentes vendedores e agentes de distribuição, precedidas de licitação, ressalvados os casos previstos em lei, conforme regras e procedimentos de comercialização específicos;",
        "Em outras palavras: no ACR, quem vende energia e as distribuidoras negociam por licitação, salvo as exceções previstas em lei.",
      ),
      d5163(
        "art. 2º, inciso II",
        "II - os agentes de distribuição deverão garantir o atendimento a cem por cento de seus mercados de energia por intermédio de contratos registrados na Câmara de Comercialização de Energia Elétrica - CCEE e, quando for o caso, aprovados, homologados ou registrados pela ANEEL;",
        "Em outras palavras: a distribuidora precisa ter contratos registrados na CCEE para cem por cento do mercado que atende.",
      ),
    ],
    limitacoes: [
      "O consumo contabilizado pela CCEE, segundo a descrição do conjunto de dados da própria CCEE, é referido ao centro de gravidade do submercado: não é o consumo faturado pelas distribuidoras nem o consumo cativo da EPE, que têm outros perímetros.",
    ],
    vejaNoPortal: VEJA_LIVRE,
  },
  {
    slug: "acl",
    sigla: "ACL",
    nome: "Ambiente de Contratação Livre",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase: "Segmento do mercado em que a energia é comprada e vendida em contratos bilaterais livremente negociados, conforme regras e procedimentos de comercialização específicos.",
    porQueImporta:
      "A parte do consumo que contrata nesse ambiente não compra a energia da distribuidora; a participação do ACL no consumo mostra quanto do mercado passou a negociar a própria energia.",
    comoEMedido:
      "No observatório, pelo consumo contabilizado pela CCEE nas classes de agente de consumo, sem a exportação, em MW médios; e pelo consumo livre na rede publicado pela EPE, em MWh. Participações sempre como razão de somas em energia, nunca média de percentuais.",
    relacoes: ["acr", "mcp", "pld"],
    fontes: [
      d5163(
        "art. 1º, § 2º, inciso II",
        "II - Ambiente de Contratação Livre - ACL o segmento do mercado no qual se realizam as operações de compra e venda de energia elétrica, objeto de contratos bilaterais livremente negociados, conforme regras e procedimentos de comercialização específicos;",
        "Em outras palavras: no ACL, comprador e vendedor negociam diretamente os contratos, dentro das regras de comercialização.",
      ),
    ],
    limitacoes: [
      "O observatório não publica preço de contrato do ACL: os contratos são bilaterais e privados, e o PLD não é o preço deles.",
    ],
    vejaNoPortal: VEJA_LIVRE,
  },
  {
    slug: "garantia-fisica",
    nome: "Garantia física",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase:
      "Quantidade máxima de energia de um empreendimento de geração, definida pelo Ministério de Minas e Energia, que pode ser usada para comprovar atendimento de carga ou para comercialização por meio de contratos.",
    porQueImporta:
      "O Decreto exige que os agentes vendedores tenham lastro para cem por cento dos contratos, e esse lastro é a garantia física de empreendimentos próprios ou de terceiros; ela é revisada periodicamente e calculada pela EPE.",
    comoEMedido:
      "No observatório, a garantia física das usinas do MRE aparece em MW médios nos conjuntos da CCEE, modulada e ajustada pelo fator de disponibilidade, como denominador do GSF; a de cada usina não é publicada aqui.",
    relacoes: ["mre", "gsf", "acr", "acl"],
    fontes: [
      d5163(
        "art. 2º, inciso I",
        "I - os agentes vendedores deverão apresentar lastro para a venda de energia para garantir cem por cento de seus contratos;",
        "Em outras palavras: quem vende energia precisa ter lastro para cem por cento dos contratos.",
      ),
      d5163(
        "art. 2º, § 1º",
        "§ 1 º O lastro para a venda de que trata o inciso I do caput será constituído pela garantia física proporcionada por empreendimento de geração própria ou de terceiros, neste caso, mediante contratos de compra de energia.",
      ),
      d5163(
        "art. 2º, § 2º",
        "§ 2 º A garantia física de energia de um empreendimento de geração, a ser definida pelo Ministério de Minas e Energia e a qual deverá constar do contrato de concessão ou do ato de autorização, corresponderá à quantidade máxima de energia elétrica associada ao empreendimento, incluída a importação, que poderá ser utilizada para comprovação de atendimento de carga ou comercialização por meio de contratos.",
        "Em outras palavras: a garantia física é o teto de energia que um empreendimento pode usar para comprovar atendimento de carga ou vender em contratos, fixado pelo MME no ato de outorga.",
      ),
      d5163(
        "art. 2º, § 3º",
        "§ 3º A garantia física de empreendimentos de geração será revisada periodicamente e calculada pela Empresa de Pesquisa Energética - EPE conforme diretrizes e metodologias estabelecidas pelo Ministério de Minas e Energia.",
      ),
    ],
    limitacoes: [
      "Garantia física não é geração: a usina pode gerar mais ou menos que ela em cada mês, e é essa diferença, no conjunto das hidrelétricas do MRE, que o GSF mede.",
    ],
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
  {
    slug: "ess",
    sigla: "ESS",
    nome: "Encargos de Serviços do Sistema",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase:
      "Encargo previsto nas regras de comercialização para cobrir os custos dos serviços do sistema prestados aos usuários do SIN, inclusive os serviços ancilares, como a geração despachada fora da ordem de mérito por restrição de transmissão ou por segurança energética.",
    porQueImporta:
      "É um custo da operação que não está no preço da energia: o Decreto prevê que a geração despachada fora da ordem de mérito seja alocada aos consumidores, com possibilidade de diferenciação entre os submercados.",
    comoEMedido:
      "No observatório, pela soma mensal dos tipos de encargo publicados pela CCEE no conjunto ENCARGO_ESS_ANCILAR, em reais, por mês de competência, conferida com o boletim de monitoramento do MME e com o InfoMercado.",
    relacoes: ["mcp", "pld", "cde"],
    fontes: [
      d5163(
        "art. 59, caput e inciso I",
        "Art. 59. As regras e os procedimentos de comercialização deverão prever o pagamento de encargo para cobertura dos custos dos serviços do sistema, inclusive dos serviços ancilares, prestados aos usuários do SIN, que compreenderão, entre outros: (Redação dada pelo Decreto nº 9.143, de 2017) I - a geração despachada independentemente da ordem de mérito, por restrições de transmissão em cada submercado ou por razões de segurança energética, a ser alocada aos consumidores com possibilidade de diferenciação entre os submercados;",
        "Em outras palavras: as regras de comercialização preveem um encargo para pagar os serviços que mantêm o sistema operando, entre eles a geração acionada fora da ordem de custo por limite da rede ou por segurança energética.",
      ),
      d5163(
        "art. 59, incisos II e III",
        "II - a reserva de potência operativa, em MW, disponibilizada pelos geradores para a regulação da freqüência do sistema e sua capacidade de partida autônoma; III - a reserva de capacidade, em MVAr, disponibilizada pelos geradores, superior aos valores de referência estabelecidos para cada gerador em Procedimentos de Rede do ONS, necessária à operação do sistema de transmissão;",
      ),
    ],
    limitacoes: [
      "Valor de competência não é valor pago no mês: o pagamento sai depois, na liquidação, e passa pelo alívio com recursos do próprio mercado.",
    ],
    vejaNoPortal: [{ rotulo: "Mercado: encargos e liquidação", href: "/setor-eletrico/mercado/encargos" }],
  },
  {
    slug: "gsf",
    sigla: "GSF",
    nome: "Generation Scaling Factor (fator de ajuste do MRE)",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-07",
    ressalva: "definição regulatória não lida (Regras de Comercialização da CCEE)",
    emUmaFrase:
      "Razão, em percentual, entre a geração verificada das usinas do Mecanismo de Realocação de Energia (MRE) no mês e a garantia física dessas usinas; abaixo de 100%, as hidrelétricas do mecanismo geraram, juntas, menos que a garantia física.",
    porQueImporta:
      "A garantia física é a quantidade máxima de energia de um empreendimento que pode comprovar atendimento de carga ou lastrear contratos (ver Garantia física); o GSF mostra, mês a mês, quanto dela as hidrelétricas do MRE entregaram juntas. O relatório do GT de Aprimoramento do MRE (julho de 2019) registra que, desde 2014, o GSF tem ficado abaixo de 90%, o que expôs negativamente muitos agentes hidrelétricos a valores elevados de PLD, e que o descolamento entre a sazonalidade da produção e a da garantia física sazonalizada infla o GSF no período úmido e o reduz no período seco, com oscilações artificiais que elevam o risco das hidrelétricas.",
    comoEMedido:
      "Em percentual, por mês: geração das usinas do MRE dividida pela garantia física, que entra em formas diferentes conforme a fonte. Segundo o relatório do GT, o MRE usa a garantia física sazonalizada e modulada: a sazonalização segue a estratégia comercial de cada agente, e a modulação segue as regras de comercialização e o perfil de geração das usinas do MRE. O boletim do MME compara a geração hidráulica, referenciada ao centro de gravidade, com a garantia física sazonalizada. No observatório, o denominador é a garantia física modulada e ajustada pelo fator de disponibilidade, nos conjuntos abertos da CCEE, e o resultado foi conferido com o fator mensal do InfoMercado em alguns meses da série, listados no painel.",
    relacoes: ["mre", "garantia-fisica"],
    fontes: [
      boletimMme(
        "seção 8.5, Mecanismo de Realocação de Energia, página 28",
        "Em dezembro de 2020, as usinas participantes do MRE geraram, juntas, 42.500 MWmédios, ante a garantia física sazonalizada de 52.788 MWmédios, o que representou um GSF mensal de 80,51%.",
        "Em outras palavras: dividindo o que as usinas do MRE geraram juntas, 42.500 MWmédios, pela garantia física sazonalizada, 52.788 MWmédios, o resultado é 80,51%, e esse é o GSF do mês.",
      ),
      boletimMme("lista de siglas", "GSF - Generation Scaling Factor"),
      gtMre(
        "seção sobre o balanço operativo, página 38",
        "Com base no comportamento da geração hidrelétrica é possível avaliar o comportamento do fator de ajuste do MRE, conhecido como GSF.",
        "Em outras palavras: o relatório trata o fator de ajuste do MRE e o GSF como o mesmo número.",
      ),
      gtMre(
        "Tabela 1, variáveis avaliadas, página 22",
        "Razão entre a geração verificada (mensal) e as garantias físicas históricas. Neste estudo não será considerado procedimento da sazonalização das garantias físicas para o MRE.",
        "Em outras palavras: neste estudo o GSF é a geração mensal verificada dividida pelas garantias físicas históricas, sem aplicar a sazonalização das garantias físicas.",
      ),
      gtMre(
        "seção sobre a contabilização do MRE, página 17",
        "e utiliza a GF sazonalizada e modulada. A sazonalização da GF é realizada em função da estratégia comercial de cada agente, enquanto que a modulação é realizada pelas regras de comercialização e segue o perfil de geração das usinas do MRE.",
        "Em outras palavras: a garantia física que entra na contabilização do MRE passa por duas etapas, a sazonalização, que depende da estratégia de cada agente, e a modulação, que segue as regras de comercialização e o perfil de geração das usinas.",
      ),
      gtMre(
        "seção sobre a recente crise do MRE, página 21",
        "Os últimos anos foram os mais desafiadores para o MRE desde sua implantação em 2001, especialmente a partir do ano de 2014, período em que o GSF tem apresentado valores abaixo de 90%, o que tem exposto negativamente muitos agentes hidrelétricos a valores elevados de PLD.",
        "Em outras palavras: desde 2014 o GSF vinha abaixo de 90%, e isso deixou muitos agentes hidrelétricos expostos a preços de curto prazo elevados.",
      ),
      gtMre(
        "seção sobre a produção das usinas do MRE (figura 8), página 18",
        "O descolamento entre a sazonalidade da produção hidrelétrica e da GF faz com o GSF seja inflado no período úmido (muita geração e baixa GF sazonalizada) e reduzido no período seco (pouca geração e alta GF sazonalizada), provocando oscilações artificiais do GSF e elevando o risco das hidrelétricas.",
        "Em outras palavras (o original traz \"faz com o GSF seja inflado\"): como a produção das hidrelétricas e a garantia física sazonalizada não variam juntas ao longo do ano, o GSF calculado com a garantia física sazonalizada fica artificialmente alto no período úmido, quando se gera muito e a garantia física sazonalizada é baixa, e artificialmente baixo no período seco.",
      ),
    ],
    limitacoes: [
      "As fontes não usam o mesmo denominador. O boletim do MME usa a garantia física sazonalizada; o relatório do GT usa as garantias físicas históricas, sem sazonalização, na Tabela 1, e a garantia física sazonalizada nas figuras; o observatório usa a garantia física modulada e ajustada pelo fator de disponibilidade. A diferença pode ser grande: no exemplo, o mesmo mês dá resultados distintos com cada denominador. Valores de fontes diferentes só se comparam depois de conferir o denominador.",
      "A definição regulatória do fator de ajuste do MRE, nas Regras de Comercialização da CCEE e na regulamentação da ANEEL, não foi lida: o repositório de normas da ANEEL responde 403 a requisições automatizadas e o bloqueio não foi contornado, e as Regras de Comercialização não foram lidas. O verbete descreve o GSF como os documentos do MME o usam.",
      "A conferência com o fator mensal do InfoMercado cobre alguns meses da série, e o mês do exemplo pode ainda não ter edição correspondente; a lista e a divergência do número de 12 meses estão no painel de Mercado (ver MRE).",
      "O GSF é o resultado do conjunto das usinas do mecanismo, que o boletim descreve como as usinas do MRE geraram \"juntas\"; não é o desempenho de uma usina.",
    ],
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" }],
  },
];
