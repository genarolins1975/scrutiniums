import type { Conceito, FonteOficial } from "./conceitos";

/**
 * Verbetes de instituições e de escopo do sistema, pedidos pela página inicial (pedidos/inicial.md, itens 1 e 8): ANEEL, ONS, CCEE,
 * EPE, IBGE e Sistemas Isolados. Mesma regra da base (conceitos.ts): nenhuma definição de memória; CONFERIDO só com o documento primário
 * lido na data indicada. A definição de cada instituição é a da lei que a cria ou a regula (texto compilado do Planalto) e, no caso do
 * ONS, também a da página institucional dele; a de Sistemas Isolados é a do decreto que os define, com o escopo do SIN lido em página do
 * ONS. Nenhuma vem do portal da CCEE, que recusa consulta automática (403) e não foi contornado.
 *
 * Os trechos citados estão, literalmente, nas capturas versionadas de 09/10/2026 (pipeline/energia/seed/documentos_aprenda, pasta
 * v20261009T103148Z, com o sha256 do original e do texto no MANIFESTO.json); o teste de src/tests/energia-aprenda.test.ts confere.
 * Estes verbetes não alteram nenhum verbete existente: o SIN, por exemplo, mantém a limitação de 28/09/2026, e o escopo conferido está
 * em Sistemas Isolados.
 */

const LIDO = "texto compilado do Planalto, lido em 09/10/2026";

const URL_L9427 = "https://www.planalto.gov.br/ccivil_03/leis/l9427cons.htm";
const URL_L9648 = "https://www.planalto.gov.br/ccivil_03/leis/l9648cons.htm";
const URL_D5081 = "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5081.htm";
const URL_L10848 = "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.848.htm";
const URL_L15269 = "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15269.htm";
const URL_L10847 = "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.847.htm";
const URL_L5878 = "https://www.planalto.gov.br/ccivil_03/leis/l5878.htm";
const URL_D7246 = "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7246.htm";
const URL_ONS_QUEM = "https://www.ons.org.br/paginas/sobre-o-ons/o-que-e-ons";
const URL_ONS_SIN = "https://www.ons.org.br/paginas/sobre-o-sin/o-que-e-o-sin";
const URL_ONS_ISOLADOS = "https://www.ons.org.br/paginas/sobre-o-sin/sistemas-isolados";

const planalto = (documento: string, url: string, trecho: string, parafrase: string): FonteOficial => ({
  orgao: "Presidência da República",
  documento: `${documento} (${LIDO})`,
  url,
  trecho,
  parafrase,
});

const ons = (documento: string, url: string, trecho: string, parafrase: string): FonteOficial => ({
  orgao: "ONS",
  documento: `${documento} (página sem data de publicação, lida em 09/10/2026)`,
  url,
  trecho,
  parafrase,
});

const NOTA_CAPTURA = "A captura versionada de cada documento, com o sha256 do original e do texto, está no manifesto da pasta de documentos do Aprenda de 09/10/2026.";

export const CONCEITOS: Conceito[] = [
  {
    slug: "aneel",
    sigla: "ANEEL",
    nome: "Agência Nacional de Energia Elétrica",
    grupo: "Regulação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Autarquia sob regime especial, vinculada ao Ministério de Minas e Energia, que tem por finalidade regular e fiscalizar a produção, a transmissão, a distribuição, o armazenamento e a comercialização de energia elétrica, em conformidade com as políticas e diretrizes do governo federal.",
    porQueImporta:
      "Entre as competências que a lei lhe dá estão aprovar as regras e os procedimentos de comercialização de energia elétrica, definir as tarifas de uso dos sistemas de transmissão e de distribuição e fiscalizar permanentemente a prestação do serviço. O nome da ANEEL aparece como fonte de tarifas, limites de preço, indicadores de qualidade e normas em vários painéis do observatório.",
    relacoes: ["ons", "ccee", "tarifa-te-tusd", "bandeira-tarifaria", "limites-do-pld", "agenda-regulatoria"],
    relacoesNotas: {
      "tarifa-te-tusd": "O art. 3º dá à ANEEL a competência de definir as tarifas de uso dos sistemas de transmissão e de distribuição.",
    },
    fontes: [
      planalto(
        "Lei nº 9.427, de 26 de dezembro de 1996, arts. 1º e 2º",
        URL_L9427,
        "Art. 1º É instituída a Agência Nacional de Energia Elétrica - ANEEL, autarquia sob regime especial, vinculada ao Ministério de Minas e Energia, com sede e foro no Distrito Federal e prazo de duração indeterminado. [...] Art. 2º A Agência Nacional de Energia Elétrica - Aneel tem por finalidade regular e fiscalizar a produção, transmissão, distribuição, armazenamento e comercialização de energia elétrica, em conformidade com as políticas e diretrizes do governo federal.",
        "Em outras palavras: a lei criou a ANEEL como autarquia ligada ao Ministério de Minas e Energia, com sede no Distrito Federal, e lhe deu a finalidade de regular e fiscalizar a produção, a transmissão, a distribuição, o armazenamento e a comercialização de energia elétrica, seguindo as políticas e diretrizes do governo federal.",
      ),
      planalto(
        "Lei nº 9.427, de 26 de dezembro de 1996, art. 3º, incisos XIV, XVIII e XIX",
        URL_L9427,
        "XIV - aprovar as regras e os procedimentos de comercialização de energia elétrica, contratada de formas regulada e livre; [...] XVIII - definir as tarifas de uso dos sistemas de transmissão e distribuição, sendo que as de transmissão devem ser baseadas nas seguintes diretrizes: [...] XIX - regular o serviço concedido, permitido e autorizado e fiscalizar permanentemente sua prestação.",
        "Em outras palavras: entre as competências do art. 3º estão aprovar as regras e os procedimentos de comercialização de energia elétrica, definir as tarifas de uso dos sistemas de transmissão e de distribuição e fiscalizar permanentemente o serviço.",
      ),
    ],
    limitacoes: [
      "A estrutura interna da agência (diretoria, superintendências) e o regimento dela não foram lidos para este verbete: ele descreve só o que os arts. 1º a 3º da lei dizem.",
      "O art. 3º lista mais competências do que as citadas aqui, e a própria lei diz que há outras incumbências previstas em lei.",
    ],
    detalheDaConferencia: [
      "O texto compilado do Planalto mostra, além da redação vigente do art. 2º (dada pela Lei nº 15.269, de 2025), a redação anterior riscada; só a vigente foi usada.",
      NOTA_CAPTURA,
    ],
    vejaNoPortal: [
      { rotulo: "Regulação", href: "/setor-eletrico/regulacao" },
      { rotulo: "Conta de luz", href: "/setor-eletrico/conta-de-luz" },
    ],
  },
  {
    slug: "ons",
    sigla: "ONS",
    nome: "Operador Nacional do Sistema Elétrico",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Pessoa jurídica de direito privado, sem fins lucrativos, fiscalizada e regulada pela ANEEL, que executa a coordenação e o controle da operação da geração e da transmissão de energia elétrica do Sistema Interligado Nacional (SIN) e, desde 1º de maio de 2017, a previsão de carga e o planejamento da operação dos sistemas isolados.",
    porQueImporta:
      "A lei lista entre as atribuições do ONS o planejamento e a programação da operação e o despacho centralizado da geração, além da proposta de regras de operação da transmissão, que a ANEEL aprova. Conjuntos de dados abertos do ONS são a fonte dos números de reservatórios, carga, geração e intercâmbio no observatório.",
    relacoes: ["sin", "sistemas-isolados", "aneel", "ccee", "epe", "ear", "carga"],
    relacoesNotas: {
      sin: "A lei atribui ao ONS a coordenação e o controle da operação da geração e da transmissão integrantes do SIN.",
      "sistemas-isolados": "Desde 1º de maio de 2017, o ONS faz a previsão de carga e o planejamento da operação dos sistemas isolados.",
      aneel: "O ONS é fiscalizado e regulado pela ANEEL, que aprova as regras de operação da transmissão que ele propõe.",
      ccee: "O decreto manda o ONS manter acordo operacional com a CCEE, para fixar as condições de relacionamento técnico-operacional entre as duas entidades.",
      epe: "O decreto manda o ONS manter acordo operacional com a EPE, para prover elementos e subsídios ao planejamento do setor elétrico.",
    },
    fontes: [
      planalto(
        "Lei nº 9.648, de 27 de maio de 1998, art. 13",
        URL_L9648,
        "Art. 13. As atividades de coordenação e controle da operação da geração e da transmissão de energia elétrica integrantes do Sistema Interligado Nacional (SIN) e as atividades de previsão de carga e planejamento da operação do Sistema Isolado (Sisol) serão executadas, mediante autorização do poder concedente, pelo Operador Nacional do Sistema Elétrico (ONS), pessoa jurídica de direito privado, sem fins lucrativos, fiscalizada e regulada pela Aneel [...] Sem prejuízo de outras funções que lhe forem atribuídas pelo Poder Concedente, constituirão atribuições do ONS: [...] a) o planejamento e a programação da operação e o despacho centralizado da geração, com vistas a otimização dos sistemas eletroenergéticos interligados; [...] f) propor regras para a operação das instalações de transmissão da rede básica do SIN, a serem aprovadas pela ANEEL. [...] g) a partir de 1º de maio de 2017, a previsão de carga e o planejamento da operação do Sisol.",
        "Em outras palavras: a lei diz que a coordenação e o controle da operação da geração e da transmissão do SIN, e a previsão de carga e o planejamento da operação do Sistema Isolado, são executados pelo ONS, associação privada sem fins lucrativos fiscalizada e regulada pela ANEEL. Entre as atribuições estão programar a operação e despachar a geração de forma centralizada e propor à ANEEL regras para a operação da transmissão; desde 1º de maio de 2017, também a previsão de carga e o planejamento da operação dos sistemas isolados.",
      ),
      ons(
        "ONS, página institucional O que é ONS",
        URL_ONS_QUEM,
        "O Operador Nacional do Sistema Elétrico (ONS) é o órgão responsável pela coordenação e controle da operação das instalações de geração e transmissão de energia elétrica no Sistema Interligado Nacional (SIN) e pelo planejamento da operação dos sistemas isolados do país, sob a fiscalização e regulação da Agência Nacional de Energia Elétrica (Aneel).",
        "Em outras palavras: o próprio ONS se apresenta como o órgão que coordena e controla a operação das instalações de geração e de transmissão do SIN e planeja a operação dos sistemas isolados, sob fiscalização e regulação da ANEEL.",
      ),
      planalto(
        "Decreto nº 5.081, de 14 de maio de 2004, art. 3º, § 1º",
        URL_D5081,
        "§ 1º Para a realização das atribuições tratadas no caput, o ONS deverá, entre outros: I - manter acordo operacional com a Câmara de Comercialização de Energia Elétrica - CCEE de que trata o art. 4º da Lei nº 10.848, de 2004, visando ao estabelecimento das condições de relacionamento técnico-operacional entre as duas entidades, para o desenvolvimento das atividades que lhes competirem, naquilo que for cabível; II - manter acordo operacional com a Empresa de Pesquisa Energética - EPE, com a finalidade de prover elementos e subsídios necessários ao desenvolvimento das atividades relativas ao planejamento do setor elétrico, nos termos da Lei nº 10.847, de 15 de março de 2004.",
        "Em outras palavras: para exercer suas atribuições, o ONS deve manter acordo operacional com a CCEE, para fixar como as duas entidades se relacionam tecnicamente, e com a EPE, para fornecer elementos ao planejamento do setor elétrico.",
      ),
    ],
    limitacoes: [
      "O estatuto social do ONS e os Procedimentos de Rede, que detalham como a operação é feita, não foram lidos para este verbete.",
      "A lista de atribuições da lei começa por \"Sem prejuízo de outras funções que lhe forem atribuídas pelo Poder Concedente\": ela não esgota o que o ONS faz.",
    ],
    detalheDaConferencia: [
      "A página do ONS não tem data de publicação nem de atualização; vale como lida em 09/10/2026. A lei e o decreto são os textos compilados do Planalto lidos na mesma data.",
      NOTA_CAPTURA,
    ],
    vejaNoPortal: [
      { rotulo: "Carga: perfil horário", href: "/setor-eletrico/carga/perfil-horario" },
      { rotulo: "Água e clima: reservatórios", href: "/setor-eletrico/agua-e-clima" },
    ],
  },
  {
    slug: "ccee",
    sigla: "CCEE",
    nome: "Câmara de Comercialização de Energia Elétrica",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Pessoa jurídica de direito privado, sem fins lucrativos, sob autorização do Poder Concedente e regulação e fiscalização pela ANEEL, cuja criação a lei autorizou com a finalidade de viabilizar a comercialização de energia elétrica.",
    porQueImporta:
      "O PLD é calculado pela CCEE e as operações do Mercado de Curto Prazo são contabilizadas por ela, como mostram as fontes dos verbetes PLD e MCP. Os dados abertos da CCEE são a fonte dos números de preço e de mercado do observatório.",
    relacoes: ["aneel", "ons", "pld", "mcp", "acl", "acr"],
    relacoesNotas: {
      aneel: "A lei põe a CCEE sob regulação e fiscalização da ANEEL.",
    },
    fontes: [
      planalto(
        "Lei nº 10.848, de 15 de março de 2004, art. 4º",
        URL_L10848,
        "Art. 4º Fica autorizada a criação da Câmara de Comercialização de Energia Elétrica - CCEE, pessoa jurídica de direito privado, sem fins lucrativos, sob autorização do Poder Concedente e regulação e fiscalização pela Agência Nacional de Energia Elétrica - ANEEL, com a finalidade de viabilizar a comercialização de energia elétrica de que trata esta Lei. [...] § 1º A CCEE será integrada por titulares de concessão, permissão ou autorização, por outros agentes vinculados aos serviços e às instalações de energia elétrica e pelos consumidores de que tratam os arts. 15 e 16 da Lei nº 9.074, de 7 de julho de 1995, e o § 5º do art. 26 da Lei nº 9.427, de 26 de dezembro de 1996.",
        "Em outras palavras: a lei autorizou a criação da CCEE, entidade privada sem fins lucrativos, regulada e fiscalizada pela ANEEL, para viabilizar a comercialização de energia elétrica; fazem parte dela os titulares de concessão, permissão ou autorização, outros agentes ligados aos serviços e às instalações de energia elétrica e os consumidores que a lei indica.",
      ),
      planalto(
        "Lei nº 10.848, de 15 de março de 2004, art. 4º-D, incluído pela Lei nº 15.269, de 2025",
        URL_L10848,
        "Art. 4º-D. A partir da entrada em vigor deste artigo, a CCEE passará a ser denominada Câmara de Comercialização de Energia (CCEE), permanecendo válidas todas as disposições legais e infralegais anteriormente atribuídas à Câmara de Comercialização de Energia Elétrica.",
        "Em outras palavras: a partir da entrada em vigor desse artigo, o nome passa a ser Câmara de Comercialização de Energia, sem a palavra Elétrica, e continuam valendo as disposições que se referiam ao nome anterior.",
      ),
      planalto(
        "Lei nº 15.269, de 24 de novembro de 2025, art. 24",
        URL_L15269,
        "Art. 24. Esta Lei entra em vigor na data de sua publicação e produz efeitos: [...] IV - na data de sua publicação, quanto aos demais dispositivos.",
        "Em outras palavras: a lei vale desde a publicação, e os dispositivos que não têm prazo próprio, como o que inclui o art. 4º-D, produzem efeitos na mesma data.",
      ),
    ],
    limitacoes: [
      "Nome: o art. 4º-D da Lei nº 10.848, incluído pela Lei nº 15.269, de 24 de novembro de 2025, manda chamar a CCEE de Câmara de Comercialização de Energia, sem Elétrica, a partir da entrada em vigor do artigo. O art. 24 da Lei nº 15.269 não dá prazo próprio a esse artigo, e o texto do Planalto indica a publicação no Diário Oficial de 25/11/2025. Este verbete e o resto do observatório usam o nome anterior, o mesmo que a descrição do PLD no portal de dados abertos da CCEE traz na leitura de 27/09/2026.",
      "O estatuto social da CCEE, a Convenção de Comercialização e as Regras e Procedimentos de Comercialização, que detalham como ela funciona, não foram lidos para este verbete.",
    ],
    detalheDaConferencia: [
      "O endereço do portal da CCEE respondeu 403 (acesso bloqueado) a uma consulta automática em 09/10/2026, e o bloqueio não foi contornado. A definição vem da lei que autoriza a criação da CCEE, lida no Planalto.",
      NOTA_CAPTURA,
    ],
    vejaNoPortal: [
      { rotulo: "Preço de curto prazo (PLD)", href: "/setor-eletrico/pld" },
      { rotulo: "Mercado", href: "/setor-eletrico/mercado" },
    ],
  },
  {
    slug: "epe",
    sigla: "EPE",
    nome: "Empresa de Pesquisa Energética",
    grupo: "Expansão",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Empresa pública vinculada ao Ministério de Minas e Energia, cuja finalidade é prestar serviços na área de estudos e pesquisas destinadas a subsidiar o planejamento do setor energético.",
    porQueImporta:
      "A lei lhe dá, entre outras competências, realizar estudos e projeções da matriz energética brasileira, elaborar e publicar o balanço energético nacional e elaborar os estudos dos planos de expansão da geração e da transmissão de energia elétrica de curto, médio e longo prazos. O observatório usa dados publicados pela EPE, como o Plano Decenal de Expansão de Energia, o consumo mensal de energia elétrica e a localização das localidades isoladas.",
    relacoes: ["ons", "aneel", "sistemas-isolados", "acl"],
    fontes: [
      planalto(
        "Lei nº 10.847, de 15 de março de 2004, arts. 1º e 2º",
        URL_L10847,
        "Art. 1º Fica o Poder Executivo autorizado a criar empresa pública, [...] denominada Empresa de Pesquisa Energética - EPE, vinculada ao Ministério de Minas e Energia. [...] Art. 2º A Empresa de Pesquisa Energética - EPE tem por finalidade prestar serviços na área de estudos e pesquisas destinadas a subsidiar o planejamento do setor energético, tais como energia elétrica, petróleo e gás natural e seus derivados, carvão mineral, fontes energéticas renováveis e eficiência energética, dentre outras.",
        "Em outras palavras: a lei autorizou o Poder Executivo a criar a EPE como empresa pública ligada ao Ministério de Minas e Energia, para prestar serviços de estudos e pesquisas que subsidiem o planejamento do setor energético, em áreas como energia elétrica, petróleo, gás natural, carvão mineral, fontes renováveis e eficiência energética.",
      ),
      planalto(
        "Lei nº 10.847, de 15 de março de 2004, art. 4º, incisos I, II e VII",
        URL_L10847,
        "Art. 4º Compete à EPE: I - realizar estudos e projeções da matriz energética brasileira; II - elaborar e publicar o balanço energético nacional; [...] VII - elaborar estudos necessários para o desenvolvimento dos planos de expansão da geração e transmissão de energia elétrica de curto, médio e longo prazos;",
        "Em outras palavras: compete à EPE fazer estudos e projeções da matriz energética, publicar o balanço energético nacional e elaborar os estudos para os planos de expansão da geração e da transmissão de energia elétrica, de curto, médio e longo prazos.",
      ),
    ],
    limitacoes: [
      "O estatuto da EPE e os planos que ela publica, como o Plano Decenal de Expansão de Energia, não foram lidos para este verbete: ele descreve só o que a lei de criação diz.",
      "A lei lista outras competências além das citadas, como estudos sobre petróleo, gás natural e eficiência energética (art. 4º).",
    ],
    detalheDaConferencia: ["Lei lida no Planalto em 09/10/2026, no texto que o Planalto publica com as alterações posteriores.", NOTA_CAPTURA],
    vejaNoPortal: [{ rotulo: "Expansão: cenários", href: "/setor-eletrico/expansao/cenarios" }],
  },
  {
    slug: "ibge",
    sigla: "IBGE",
    nome: "Fundação Instituto Brasileiro de Geografia e Estatística",
    grupo: "Fontes de dados",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Fundação cujo objetivo básico, segundo a lei, é assegurar informações e estudos de natureza estatística, geográfica, cartográfica e demográfica necessários ao conhecimento da realidade física, econômica e social do País.",
    porQueImporta:
      "O IBGE produz informação estatística geral do País, não do setor elétrico. O observatório usa números dele quando um painel precisa de dados sobre domicílios e famílias, como a Pesquisa de Orçamentos Familiares (POF), que dá o peso da energia no orçamento, e a PNAD Contínua, que dá os domicílios sem energia elétrica.",
    relacoes: ["tarifa-social", "aneel"],
    fontes: [
      planalto(
        "Lei nº 5.878, de 11 de maio de 1973, arts. 1º a 3º",
        URL_L5878,
        "Art. 1º A Fundação Instituto Brasileiro de Geografia e Estatística [...] Art. 2º Constitui objetivo básico do IBGE assegurar informações e estudos de natureza estatística, geográfica, cartográfica e demográfica necessários ao conhecimento da realidade física, econômica e social do País, visando especificamente ao planejamento econômico e social e à segurança nacional. [...] Art. 3º Para consecução do objetivo básico enunciado, no artigo 2º, o IBGE atuará principalmente nas seguintes áreas de competência: I - estatísticas primárias (contínuas e censitárias); II - estatísticas derivadas (indicadores econômico e sociais, sistemas de contabilidade social e outros sistemas de estatísticas derivadas);",
        "Em outras palavras: a lei trata o IBGE como fundação, cujo objetivo básico é assegurar informações e estudos estatísticos, geográficos, cartográficos e demográficos sobre a realidade física, econômica e social do País, e que atua principalmente em estatísticas primárias, contínuas e censitárias, e em estatísticas derivadas.",
      ),
    ],
    limitacoes: [
      "A lei é de 1973. O texto compilado do Planalto lido em 09/10/2026 não traz anotação de alteração nos arts. 1º a 3º, mas o estatuto atual do IBGE e as normas sobre a vinculação dele à administração federal não foram lidos.",
    ],
    detalheDaConferencia: [
      "O art. 1º da lei cita a supervisão de um ministro da época; o verbete não usa essa parte. O site do IBGE não foi consultado.",
      NOTA_CAPTURA,
    ],
    vejaNoPortal: [{ rotulo: "Inclusão: peso no orçamento", href: "/setor-eletrico/inclusao-energetica/orcamento" }],
  },
  {
    slug: "sistemas-isolados",
    nome: "Sistemas Isolados",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-09",
    emUmaFrase:
      "Sistemas elétricos de serviço público de distribuição de energia elétrica que, em sua configuração normal, não estão eletricamente conectados ao Sistema Interligado Nacional (SIN), por razões técnicas ou econômicas.",
    porQueImporta:
      "Um valor do SIN descreve o sistema interligado: as localidades atendidas por Sistemas Isolados ficam fora dele, por definição. A página do ONS diz que o consumo nelas representa menos de 1% da carga total do país, sem data de referência, e que a demanda é suprida principalmente por térmicas a óleo diesel. O painel de Inclusão energética lista as localidades e a população do PASI, da EPE.",
    relacoes: ["sin", "ons", "epe", "bandeira-tarifaria"],
    relacoesNotas: {
      sin: "Segundo o ONS, o SIN é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte.",
      ons: "Desde 1º de maio de 2017, o ONS faz a previsão de carga e o planejamento da operação dos sistemas isolados.",
    },
    fontes: [
      planalto(
        "Decreto nº 7.246, de 28 de julho de 2010, art. 2º, inciso III",
        URL_D7246,
        "III - Sistemas Isolados - os sistemas elétricos de serviço público de distribuição de energia elétrica que, em sua configuração normal, não estejam eletricamente conectados ao Sistema Interligado Nacional - SIN, por razões técnicas ou econômicas;",
        "Em outras palavras: o decreto chama de Sistemas Isolados os sistemas elétricos de distribuição de serviço público que, em sua configuração normal, não estão ligados eletricamente ao SIN, por razões técnicas ou econômicas.",
      ),
      planalto(
        "Lei nº 9.648, de 27 de maio de 1998, art. 13",
        URL_L9648,
        "e as atividades de previsão de carga e planejamento da operação do Sistema Isolado (Sisol) serão executadas, mediante autorização do poder concedente, pelo Operador Nacional do Sistema Elétrico (ONS) [...] g) a partir de 1º de maio de 2017, a previsão de carga e o planejamento da operação do Sisol.",
        "Em outras palavras: a previsão de carga e o planejamento da operação do Sistema Isolado cabem ao ONS, a partir de 1º de maio de 2017.",
      ),
      ons(
        "ONS, página institucional O Sistema Interligado Nacional",
        URL_ONS_SIN,
        "O Sistema Interligado Nacional é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte.",
        "Em outras palavras: o ONS descreve o SIN como o conjunto de quatro subsistemas, os três das regiões Sul, Sudeste/Centro-Oeste e Nordeste e a maior parte do Norte.",
      ),
      ons(
        "ONS, página institucional Sistemas Isolados",
        URL_ONS_ISOLADOS,
        "Atualmente, existem 212 localidades isoladas no Brasil. A maior parte está na região Norte, nos estados de Rondônia, Acre, Amazonas, Roraima, Amapá e Pará. A ilha de Fernando de Noronha, em Pernambuco, e algumas localidades de Mato Grosso completam a lista. [...] O consumo nessas localidades é baixo e representa menos de 1% da carga total do país. A demanda por energia dessas regiões é suprida, principalmente, por térmicas a óleo diesel.",
        "Em outras palavras: a página do ONS, sem data de referência, conta as localidades isoladas, situa a maior parte delas na região Norte, diz que o consumo nelas é baixo (menos de 1% da carga total do país) e que a demanda é suprida principalmente por térmicas a óleo diesel.",
      ),
    ],
    limitacoes: [
      "A página do ONS sobre os sistemas isolados não traz data de referência para a contagem de localidades, para a participação delas na carga nem para a lista de capitais atendidas: o verbete a cita como está escrita e não usa esses números como dado do observatório.",
      "O decreto lido é o texto compilado do Planalto, com a redação do Decreto nº 11.629, de 2023, no inciso que define os Sistemas Isolados; os atos da ANEEL sobre esses sistemas não foram lidos.",
    ],
    detalheDaConferencia: [
      "A definição vem do decreto; o escopo do SIN e o das localidades isoladas vêm de páginas do ONS lidas em 09/10/2026, sem data de publicação.",
      NOTA_CAPTURA,
    ],
    vejaNoPortal: [{ rotulo: "Inclusão: sistemas isolados", href: "/setor-eletrico/inclusao-energetica/acesso#isolados" }],
  },
];
