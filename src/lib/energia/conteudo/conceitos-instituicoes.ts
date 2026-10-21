import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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




function montarConceitos(tx: TxIdioma): Conceito[] {
  const LIDO = tx("texto compilado do Planalto, lido em 09/10/2026", "consolidated text published by Planalto, read on Oct 9, 2026");
  const planalto = (documento: string, url: string, trecho: string, parafrase: string): FonteOficial => ({
    orgao: tx("Presidência da República", "Presidency of the Republic"),
    documento: `${documento} (${LIDO})`,
    url,
    trecho,
    parafrase,
  });
  const ons = (documento: string, url: string, trecho: string, parafrase: string): FonteOficial => ({
    orgao: "ONS",
    documento: tx(`${documento} (página sem data de publicação, lida em 09/10/2026)`, `${documento} (page without publication date, read on Oct 9, 2026)`),
    url,
    trecho,
    parafrase,
  });
  const NOTA_CAPTURA = tx("A captura versionada de cada documento, com o sha256 do original e do texto, está no manifesto da pasta de documentos do Aprenda de 09/10/2026.", "The versioned capture of each document, with the sha256 of the original and of the text, is in the manifest of the Learn documents folder of Oct 9, 2026.");
  return [
    {
      slug: "aneel",
      sigla: "ANEEL",
      nome: tx("Agência Nacional de Energia Elétrica", "Brazilian Electricity Regulatory Agency"),
      grupo: "Regulação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Autarquia sob regime especial, vinculada ao Ministério de Minas e Energia, que tem por finalidade regular e fiscalizar a produção, a transmissão, a distribuição, o armazenamento e a comercialização de energia elétrica, em conformidade com as políticas e diretrizes do governo federal.", "Special-regime federal agency, linked to the Ministry of Mines and Energy, whose purpose is to regulate and oversee the production, transmission, distribution, storage and trading of electricity, in accordance with the policies and guidelines of the federal government."),
      porQueImporta:
        tx("Entre as competências que a lei lhe dá estão aprovar as regras e os procedimentos de comercialização de energia elétrica, definir as tarifas de uso dos sistemas de transmissão e de distribuição e fiscalizar permanentemente a prestação do serviço. O nome da ANEEL aparece como fonte de tarifas, limites de preço, indicadores de qualidade e normas em vários painéis do observatório.", "Among the powers the law gives it are approving the rules and procedures for trading electricity, setting the use tariffs of the transmission and distribution systems and permanently overseeing the provision of the service. ANEEL's name appears as the source of tariffs, price limits, quality indicators and norms in several panels of the observatory."),
      relacoes: ["ons", "ccee", "tarifa-te-tusd", "bandeira-tarifaria", "limites-do-pld", "agenda-regulatoria"],
      relacoesNotas: {
        "tarifa-te-tusd": tx("O art. 3º dá à ANEEL a competência de definir as tarifas de uso dos sistemas de transmissão e de distribuição.", "Art. 3 gives ANEEL the power to define the use tariffs of the transmission and distribution systems."),
      },
      fontes: [
        planalto(
          tx("Lei nº 9.427, de 26 de dezembro de 1996, arts. 1º e 2º", "Law No. 9.427 of Dec 26, 1996, arts. 1 and 2"),
          URL_L9427,
          // i18n: dado
          "Art. 1º É instituída a Agência Nacional de Energia Elétrica - ANEEL, autarquia sob regime especial, vinculada ao Ministério de Minas e Energia, com sede e foro no Distrito Federal e prazo de duração indeterminado. [...] Art. 2º A Agência Nacional de Energia Elétrica - Aneel tem por finalidade regular e fiscalizar a produção, transmissão, distribuição, armazenamento e comercialização de energia elétrica, em conformidade com as políticas e diretrizes do governo federal.",
          tx("Em outras palavras: a lei criou a ANEEL como autarquia ligada ao Ministério de Minas e Energia, com sede no Distrito Federal, e lhe deu a finalidade de regular e fiscalizar a produção, a transmissão, a distribuição, o armazenamento e a comercialização de energia elétrica, seguindo as políticas e diretrizes do governo federal.", "In other words: the law created ANEEL as a federal agency linked to the Ministry of Mines and Energy, headquartered in the Federal District, and gave it the purpose of regulating and overseeing the production, transmission, distribution, storage and trading of electricity, following the policies and guidelines of the federal government."),
        ),
        planalto(
          tx("Lei nº 9.427, de 26 de dezembro de 1996, art. 3º, incisos XIV, XVIII e XIX", "Law No. 9.427 of Dec 26, 1996, art. 3, items XIV, XVIII and XIX"),
          URL_L9427,
          // i18n: dado
          "XIV - aprovar as regras e os procedimentos de comercialização de energia elétrica, contratada de formas regulada e livre; [...] XVIII - definir as tarifas de uso dos sistemas de transmissão e distribuição, sendo que as de transmissão devem ser baseadas nas seguintes diretrizes: [...] XIX - regular o serviço concedido, permitido e autorizado e fiscalizar permanentemente sua prestação.",
          tx("Em outras palavras: entre as competências do art. 3º estão aprovar as regras e os procedimentos de comercialização de energia elétrica, definir as tarifas de uso dos sistemas de transmissão e de distribuição e fiscalizar permanentemente o serviço.", "In other words: among the powers of art. 3 are approving the rules and procedures for trading electricity, setting the use tariffs of the transmission and distribution systems and permanently overseeing the service."),
        ),
      ],
      limitacoes: [
        tx("A estrutura interna da agência (diretoria, superintendências) e o regimento dela não foram lidos para este verbete: ele descreve só o que os arts. 1º a 3º da lei dizem.", "The internal structure of the agency (board, superintendencies) and its bylaws were not read for this entry: it describes only what arts. 1 to 3 of the law say."),
        tx("O art. 3º lista mais competências do que as citadas aqui, e a própria lei diz que há outras incumbências previstas em lei.", "Art. 3 lists more powers than those cited here, and the law itself says there are other duties provided for by law."),
      ],
      detalheDaConferencia: [
        tx("O texto compilado do Planalto mostra, além da redação vigente do art. 2º (dada pela Lei nº 15.269, de 2025), a redação anterior riscada; só a vigente foi usada.", "The consolidated text from Planalto shows, besides the current wording of art. 2 (given by Law No. 15.269 of 2025), the previous wording struck through; only the current one was used."),
        NOTA_CAPTURA,
      ],
      vejaNoPortal: [
        { rotulo: tx("Regulação", "Regulation"), href: "/setor-eletrico/regulacao" },
        { rotulo: tx("Conta de luz", "Electricity bill"), href: "/setor-eletrico/conta-de-luz" },
      ],
    },
    {
      slug: "ons",
      sigla: "ONS",
      nome: tx("Operador Nacional do Sistema Elétrico", "National Electric System Operator"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Pessoa jurídica de direito privado, sem fins lucrativos, fiscalizada e regulada pela ANEEL, que executa a coordenação e o controle da operação da geração e da transmissão de energia elétrica do Sistema Interligado Nacional (SIN) e, desde 1º de maio de 2017, a previsão de carga e o planejamento da operação dos sistemas isolados.", "Private non-profit legal entity, overseen and regulated by ANEEL, that coordinates and controls the operation of electricity generation and transmission in the National Interconnected System (SIN) and, since May 1, 2017, performs load forecasting and operation planning for isolated systems."),
      porQueImporta:
        tx("A lei lista entre as atribuições do ONS o planejamento e a programação da operação e o despacho centralizado da geração, além da proposta de regras de operação da transmissão, que a ANEEL aprova. Conjuntos de dados abertos do ONS são fonte de números de reservatórios, carga, geração e intercâmbio no observatório.", "The law lists among the duties of the ONS the planning and scheduling of operation and the centralized dispatch of generation, as well as proposing transmission operation rules, which ANEEL approves. ONS open datasets are the source of reservoir, load, generation and interchange figures in the observatory."),
      relacoes: ["sin", "sistemas-isolados", "aneel", "ccee", "epe", "ear", "carga"],
      relacoesNotas: {
        sin: tx("A lei atribui ao ONS a coordenação e o controle da operação da geração e da transmissão integrantes do SIN.", "The law assigns to the ONS the coordination and control of the operation of the generation and transmission that are part of the SIN."),
        "sistemas-isolados": tx("Desde 1º de maio de 2017, o ONS faz a previsão de carga e o planejamento da operação dos sistemas isolados.", "Since May 1, 2017, the ONS performs load forecasting and operation planning for isolated systems."),
        aneel: tx("O ONS é fiscalizado e regulado pela ANEEL, que aprova as regras de operação da transmissão que ele propõe.", "The ONS is overseen and regulated by ANEEL, which approves the transmission operation rules it proposes."),
        ccee: tx("O decreto manda o ONS manter acordo operacional com a CCEE, para fixar as condições de relacionamento técnico-operacional entre as duas entidades.", "The decree requires the ONS to maintain an operating agreement with the CCEE, to define the conditions of the technical and operational relationship between the two entities."),
        epe: tx("O decreto manda o ONS manter acordo operacional com a EPE, para prover elementos e subsídios ao planejamento do setor elétrico.", "The decree requires the ONS to maintain an operating agreement with the EPE, to provide inputs and support for power sector planning."),
      },
      fontes: [
        planalto(
          tx("Lei nº 9.648, de 27 de maio de 1998, art. 13", "Law No. 9.648 of May 27, 1998, art. 13"),
          URL_L9648,
          // i18n: dado
          "Art. 13. As atividades de coordenação e controle da operação da geração e da transmissão de energia elétrica integrantes do Sistema Interligado Nacional (SIN) e as atividades de previsão de carga e planejamento da operação do Sistema Isolado (Sisol) serão executadas, mediante autorização do poder concedente, pelo Operador Nacional do Sistema Elétrico (ONS), pessoa jurídica de direito privado, sem fins lucrativos, fiscalizada e regulada pela Aneel [...] Sem prejuízo de outras funções que lhe forem atribuídas pelo Poder Concedente, constituirão atribuições do ONS: [...] a) o planejamento e a programação da operação e o despacho centralizado da geração, com vistas a otimização dos sistemas eletroenergéticos interligados; [...] f) propor regras para a operação das instalações de transmissão da rede básica do SIN, a serem aprovadas pela ANEEL. [...] g) a partir de 1º de maio de 2017, a previsão de carga e o planejamento da operação do Sisol.",
          tx("Em outras palavras: a lei diz que a coordenação e o controle da operação da geração e da transmissão do SIN, e a previsão de carga e o planejamento da operação do Sistema Isolado, são executados pelo ONS, pessoa jurídica de direito privado sem fins lucrativos, fiscalizada e regulada pela ANEEL. Entre as atribuições estão programar a operação e despachar a geração de forma centralizada e propor à ANEEL regras para a operação da transmissão; desde 1º de maio de 2017, também a previsão de carga e o planejamento da operação dos sistemas isolados.", "In other words: the law says that the coordination and control of the operation of SIN generation and transmission, and load forecasting and operation planning of the Isolated System, are performed by the ONS, a private non-profit legal entity overseen and regulated by ANEEL. Among its duties are scheduling operation and dispatching generation centrally and proposing to ANEEL rules for transmission operation; since May 1, 2017, also load forecasting and operation planning of isolated systems."),
        ),
        ons(
          tx("ONS, página institucional O que é ONS", "ONS, institutional page «O que é ONS»"),
          URL_ONS_QUEM,
          // i18n: dado
          "O Operador Nacional do Sistema Elétrico (ONS) é o órgão responsável pela coordenação e controle da operação das instalações de geração e transmissão de energia elétrica no Sistema Interligado Nacional (SIN) e pelo planejamento da operação dos sistemas isolados do país, sob a fiscalização e regulação da Agência Nacional de Energia Elétrica (Aneel).",
          tx("Em outras palavras: o próprio ONS se apresenta como o órgão que coordena e controla a operação das instalações de geração e de transmissão do SIN e planeja a operação dos sistemas isolados, sob fiscalização e regulação da ANEEL.", "In other words: the ONS itself presents itself as the body that coordinates and controls the operation of SIN generation and transmission facilities and plans the operation of isolated systems, under ANEEL oversight and regulation."),
        ),
        planalto(
          tx("Decreto nº 5.081, de 14 de maio de 2004, art. 3º, § 1º", "Decree No. 5.081 of May 14, 2004, art. 3, § 1"),
          URL_D5081,
          // i18n: dado
          "§ 1º Para a realização das atribuições tratadas no caput, o ONS deverá, entre outros: I - manter acordo operacional com a Câmara de Comercialização de Energia Elétrica - CCEE de que trata o art. 4º da Lei nº 10.848, de 2004, visando ao estabelecimento das condições de relacionamento técnico-operacional entre as duas entidades, para o desenvolvimento das atividades que lhes competirem, naquilo que for cabível; II - manter acordo operacional com a Empresa de Pesquisa Energética - EPE, com a finalidade de prover elementos e subsídios necessários ao desenvolvimento das atividades relativas ao planejamento do setor elétrico, nos termos da Lei nº 10.847, de 15 de março de 2004.",
          tx("Em outras palavras: para exercer suas atribuições, o ONS deve manter acordo operacional com a CCEE, para fixar como as duas entidades se relacionam tecnicamente, e com a EPE, para fornecer elementos ao planejamento do setor elétrico.", "In other words: to perform its duties, the ONS must maintain an operating agreement with the CCEE, to define how the two entities relate technically, and with the EPE, to provide inputs for power sector planning."),
        ),
      ],
      limitacoes: [
        tx("O estatuto social do ONS e os Procedimentos de Rede, que detalham como a operação é feita, não foram lidos para este verbete.", "The ONS bylaws and the Grid Procedures, which detail how operation is performed, were not read for this entry."),
        tx("A lista de atribuições da lei começa por \"Sem prejuízo de outras funções que lhe forem atribuídas pelo Poder Concedente\": ela não esgota o que o ONS faz.", "The law's list of duties begins with «Sem prejuízo de outras funções que lhe forem atribuídas pelo Poder Concedente» (without prejudice to other functions assigned to it by the granting authority): it does not exhaust what the ONS does."),
      ],
      detalheDaConferencia: [
        tx("A página do ONS não tem data de publicação nem de atualização; vale como lida em 09/10/2026. A lei e o decreto são os textos compilados do Planalto lidos na mesma data.", "The ONS page has no publication or update date; it counts as read on Oct 9, 2026. The law and the decree are the consolidated texts from Planalto read on the same date."),
        NOTA_CAPTURA,
      ],
      vejaNoPortal: [
        { rotulo: tx("Carga: perfil horário", "Load: hourly profile"), href: "/setor-eletrico/carga/perfil-horario" },
        { rotulo: tx("Água e clima: reservatórios", "Water and climate: reservoirs"), href: "/setor-eletrico/agua-e-clima" },
      ],
    },
    {
      slug: "ccee",
      sigla: "CCEE",
      nome: tx("Câmara de Comercialização de Energia Elétrica", "Electric Energy Trading Chamber"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Pessoa jurídica de direito privado, sem fins lucrativos, sob autorização do Poder Concedente e regulação e fiscalização pela ANEEL, cuja criação a lei autorizou com a finalidade de viabilizar a comercialização de energia elétrica.", "Private non-profit legal entity, under authorization of the granting authority and regulation and oversight by ANEEL, whose creation the law authorized for the purpose of enabling the trading of electricity."),
      porQueImporta:
        tx("O PLD é calculado pela CCEE e as operações do Mercado de Curto Prazo são contabilizadas por ela, como mostram as fontes dos verbetes PLD e MCP. Os dados abertos da CCEE são fonte de números de preço e de mercado no observatório.", "The PLD is calculated by the CCEE and the Short-Term Market operations are accounted by it, as the sources of the PLD and MCP entries show. CCEE open data are the source of price and market figures in the observatory."),
      relacoes: ["aneel", "ons", "pld", "mcp", "acl", "acr"],
      relacoesNotas: {
        aneel: tx("A lei põe a CCEE sob regulação e fiscalização da ANEEL.", "The law places the CCEE under ANEEL regulation and oversight."),
      },
      fontes: [
        planalto(
          tx("Lei nº 10.848, de 15 de março de 2004, art. 4º", "Law No. 10.848 of Mar 15, 2004, art. 4"),
          URL_L10848,
          // i18n: dado
          "Art. 4º Fica autorizada a criação da Câmara de Comercialização de Energia Elétrica - CCEE, pessoa jurídica de direito privado, sem fins lucrativos, sob autorização do Poder Concedente e regulação e fiscalização pela Agência Nacional de Energia Elétrica - ANEEL, com a finalidade de viabilizar a comercialização de energia elétrica de que trata esta Lei. [...] § 1º A CCEE será integrada por titulares de concessão, permissão ou autorização, por outros agentes vinculados aos serviços e às instalações de energia elétrica e pelos consumidores de que tratam os arts. 15 e 16 da Lei nº 9.074, de 7 de julho de 1995, e o § 5º do art. 26 da Lei nº 9.427, de 26 de dezembro de 1996.",
          tx("Em outras palavras: a lei autorizou a criação da CCEE, entidade privada sem fins lucrativos, regulada e fiscalizada pela ANEEL, para viabilizar a comercialização de energia elétrica; fazem parte dela os titulares de concessão, permissão ou autorização, outros agentes ligados aos serviços e às instalações de energia elétrica e os consumidores que a lei indica.", "In other words: the law authorized the creation of the CCEE, a private non-profit entity regulated and overseen by ANEEL, to enable the trading of electricity; its members are holders of concessions, permits or authorizations, other agents linked to electricity services and facilities, and the consumers indicated by the law."),
        ),
        planalto(
          tx("Lei nº 10.848, de 15 de março de 2004, art. 4º-D, incluído pela Lei nº 15.269, de 2025", "Law No. 10.848 of Mar 15, 2004, art. 4-D, added by Law No. 15.269 of 2025"),
          URL_L10848,
          // i18n: dado
          "Art. 4º-D. A partir da entrada em vigor deste artigo, a CCEE passará a ser denominada Câmara de Comercialização de Energia (CCEE), permanecendo válidas todas as disposições legais e infralegais anteriormente atribuídas à Câmara de Comercialização de Energia Elétrica.",
          tx("Em outras palavras: a partir da entrada em vigor desse artigo, o nome passa a ser Câmara de Comercialização de Energia, sem a palavra Elétrica, e continuam valendo as disposições que se referiam ao nome anterior.", "In other words: from the entry into force of that article, the name becomes «Câmara de Comercialização de Energia», without the word «Elétrica», and the provisions that referred to the previous name remain valid."),
        ),
        planalto(
          tx("Lei nº 15.269, de 24 de novembro de 2025, art. 24", "Law No. 15.269 of Nov 24, 2025, art. 24"),
          URL_L15269,
          // i18n: dado
          "Art. 24. Esta Lei entra em vigor na data de sua publicação e produz efeitos: I - em 1º de janeiro de 2026, quanto ao: a) art. 14; b) ao inciso V do art. 23; II - em 90 (noventa) dias da data de sua publicação, quanto ao art. 9º, na parte que inclui o art. 3º-D na Lei nº 10.848, de 15 de março de 2024; III - em 1º de janeiro de 2027, quanto ao art. 6º, apenas na parte que acrescenta o art. 1º-A e nas que alteram os arts. 4º e 5º da Lei nº 9.991, de 24 de julho de 2000; e IV - na data de sua publicação, quanto aos demais dispositivos.",
          tx("Em outras palavras: a lei vale desde a publicação e produz efeitos em data própria só para os dispositivos que lista (o art. 14, o inciso V do art. 23, a parte do art. 9º que inclui o art. 3º-D na Lei nº 10.848 e partes do art. 6º); os demais produzem efeitos na data da publicação.", "In other words: the law is valid from its publication and has effects on its own dates only for the provisions it lists (art. 14, item V of art. 23, the part of art. 9 that adds art. 3-D to Law No. 10.848 and parts of art. 6); the other provisions take effect on the date of publication."),
        ),
      ],
      limitacoes: [
        tx("Nome: o art. 4º-D da Lei nº 10.848, incluído pela Lei nº 15.269, de 24 de novembro de 2025, manda chamar a CCEE de Câmara de Comercialização de Energia, sem Elétrica, a partir da entrada em vigor do artigo. O art. 24 da Lei nº 15.269 lista os dispositivos com data própria e o art. 4º-D não está entre eles, de modo que ele vale desde a publicação, que o texto do Planalto indica ser a do Diário Oficial de 25/11/2025. Este verbete e o resto do observatório usam o nome anterior, o mesmo que a descrição do PLD no portal de dados abertos da CCEE traz na leitura de 27/09/2026.", "Name: art. 4-D of Law No. 10.848, added by Law No. 15.269 of Nov 24, 2025, requires the CCEE to be called «Câmara de Comercialização de Energia», without «Elétrica», from the entry into force of the article. Art. 24 of Law No. 15.269 lists the provisions with their own dates and art. 4-D is not among them, so it applies from publication, which the Planalto text indicates to be the Official Gazette of Nov 25, 2025. This entry and the rest of the observatory use the previous name, the same one that the PLD description on the CCEE open data portal shows in the reading of Sep 27, 2026."),
        tx("O estatuto social da CCEE, a Convenção de Comercialização e as Regras e Procedimentos de Comercialização, que detalham como ela funciona, não foram lidos para este verbete.", "The CCEE bylaws, the Trading Convention and the Trading Rules and Procedures, which detail how it works, were not read for this entry."),
      ],
      detalheDaConferencia: [
        tx("O endereço do portal da CCEE respondeu 403 (acesso bloqueado) a uma consulta automática em 09/10/2026, e o bloqueio não foi contornado. A definição vem da lei que autoriza a criação da CCEE, lida no Planalto.", "The CCEE portal address returned 403 (access blocked) to an automated query on Oct 9, 2026, and the block was not circumvented. The definition comes from the law that authorizes the creation of the CCEE, read on Planalto."),
        NOTA_CAPTURA,
      ],
      vejaNoPortal: [
        { rotulo: tx("Preço de curto prazo (PLD)", "Spot price (PLD)"), href: "/setor-eletrico/pld" },
        { rotulo: tx("Mercado", "Market"), href: "/setor-eletrico/mercado" },
      ],
    },
    {
      slug: "epe",
      sigla: "EPE",
      nome: tx("Empresa de Pesquisa Energética", "Energy Research Office"),
      grupo: "Expansão", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Empresa pública vinculada ao Ministério de Minas e Energia, cuja finalidade é prestar serviços na área de estudos e pesquisas destinadas a subsidiar o planejamento do setor energético.", "Public company linked to the Ministry of Mines and Energy, whose purpose is to provide services in studies and research intended to support energy sector planning."),
      porQueImporta:
        tx("A lei lhe dá, entre outras competências, realizar estudos e projeções da matriz energética brasileira, elaborar e publicar o balanço energético nacional e elaborar os estudos dos planos de expansão da geração e da transmissão de energia elétrica de curto, médio e longo prazos. O observatório usa dados publicados pela EPE, como o Plano Decenal de Expansão de Energia, o consumo mensal de energia elétrica e a localização das localidades isoladas.", "The law gives it, among other powers, conducting studies and projections of the Brazilian energy matrix, preparing and publishing the national energy balance and preparing the studies for the short, medium and long-term expansion plans of electricity generation and transmission. The observatory uses data published by the EPE, such as the Ten-Year Energy Expansion Plan, monthly electricity consumption and the location of isolated localities."),
      relacoes: ["ons", "aneel", "sistemas-isolados", "acl"],
      fontes: [
        planalto(
          tx("Lei nº 10.847, de 15 de março de 2004, arts. 1º e 2º", "Law No. 10.847 of Mar 15, 2004, arts. 1 and 2"),
          URL_L10847,
          // i18n: dado
          "Art. 1º Fica o Poder Executivo autorizado a criar empresa pública, [...] denominada Empresa de Pesquisa Energética - EPE, vinculada ao Ministério de Minas e Energia. [...] Art. 2º A Empresa de Pesquisa Energética - EPE tem por finalidade prestar serviços na área de estudos e pesquisas destinadas a subsidiar o planejamento do setor energético, tais como energia elétrica, petróleo e gás natural e seus derivados, carvão mineral, fontes energéticas renováveis e eficiência energética, dentre outras.",
          tx("Em outras palavras: a lei autorizou o Poder Executivo a criar a EPE como empresa pública ligada ao Ministério de Minas e Energia, para prestar serviços de estudos e pesquisas que subsidiem o planejamento do setor energético, em áreas como energia elétrica, petróleo, gás natural, carvão mineral, fontes renováveis e eficiência energética.", "In other words: the law authorized the Executive Branch to create the EPE as a public company linked to the Ministry of Mines and Energy, to provide studies and research services that support energy sector planning, in areas such as electricity, oil, natural gas, coal, renewable sources and energy efficiency."),
        ),
        planalto(
          tx("Lei nº 10.847, de 15 de março de 2004, art. 4º, incisos I, II e VII", "Law No. 10.847 of Mar 15, 2004, art. 4, items I, II and VII"),
          URL_L10847,
          // i18n: dado
          "Art. 4º Compete à EPE: I - realizar estudos e projeções da matriz energética brasileira; II - elaborar e publicar o balanço energético nacional; [...] VII - elaborar estudos necessários para o desenvolvimento dos planos de expansão da geração e transmissão de energia elétrica de curto, médio e longo prazos;",
          tx("Em outras palavras: compete à EPE fazer estudos e projeções da matriz energética, publicar o balanço energético nacional e elaborar os estudos para os planos de expansão da geração e da transmissão de energia elétrica, de curto, médio e longo prazos.", "In other words: the EPE is responsible for studies and projections of the energy matrix, publishing the national energy balance and preparing the studies for the short, medium and long-term expansion plans of electricity generation and transmission."),
        ),
      ],
      limitacoes: [
        tx("O estatuto da EPE e os planos que ela publica, como o Plano Decenal de Expansão de Energia, não foram lidos para este verbete: ele descreve só o que a lei de criação diz.", "The EPE bylaws and the plans it publishes, such as the Ten-Year Energy Expansion Plan, were not read for this entry: it describes only what the founding law says."),
        tx("A lei lista outras competências além das citadas, como estudos sobre petróleo, gás natural e eficiência energética (art. 4º).", "The law lists other powers besides those cited, such as studies on oil, natural gas and energy efficiency (art. 4)."),
      ],
      detalheDaConferencia: [tx("Lei lida no Planalto em 09/10/2026, no texto que o Planalto publica com as alterações posteriores.", "Law read on Planalto on Oct 9, 2026, in the text Planalto publishes with later amendments."), NOTA_CAPTURA],
      vejaNoPortal: [{ rotulo: tx("Expansão: cenários", "Expansion: scenarios"), href: "/setor-eletrico/expansao/cenarios" }],
    },
    {
      slug: "ibge",
      sigla: "IBGE",
      nome: tx("Fundação Instituto Brasileiro de Geografia e Estatística", "Brazilian Institute of Geography and Statistics Foundation"),
      grupo: "Fontes de dados", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Fundação cujo objetivo básico, segundo a lei, é assegurar informações e estudos de natureza estatística, geográfica, cartográfica e demográfica necessários ao conhecimento da realidade física, econômica e social do País.", "Foundation whose basic objective, according to the law, is to ensure statistical, geographical, cartographic and demographic information and studies needed to understand the physical, economic and social reality of the country."),
      porQueImporta:
        tx("O IBGE produz informação estatística geral do País, não do setor elétrico. O observatório usa números dele quando um painel precisa de dados sobre domicílios e famílias, como a Pesquisa de Orçamentos Familiares (POF), que dá o peso da energia no orçamento, e a PNAD Contínua, que dá os domicílios sem energia elétrica.", "The IBGE produces general statistical information about the country, not about the power sector. The observatory uses its figures when a panel needs data on households and families, such as the Household Budget Survey (POF), which gives the weight of energy in the budget, and the Continuous PNAD, which gives the households without electricity."),
      relacoes: ["tarifa-social", "aneel"],
      fontes: [
        planalto(
          tx("Lei nº 5.878, de 11 de maio de 1973, arts. 1º a 3º", "Law No. 5.878 of May 11, 1973, arts. 1 to 3"),
          URL_L5878,
          // i18n: dado
          "Art. 1º A Fundação Instituto Brasileiro de Geografia e Estatística [...] Art. 2º Constitui objetivo básico do IBGE assegurar informações e estudos de natureza estatística, geográfica, cartográfica e demográfica necessários ao conhecimento da realidade física, econômica e social do País, visando especificamente ao planejamento econômico e social e à segurança nacional. [...] Art. 3º Para consecução do objetivo básico enunciado, no artigo 2º, o IBGE atuará principalmente nas seguintes áreas de competência: I - estatísticas primárias (contínuas e censitárias); II - estatísticas derivadas (indicadores econômico e sociais, sistemas de contabilidade social e outros sistemas de estatísticas derivadas);",
          tx("Em outras palavras: a lei trata o IBGE como fundação, cujo objetivo básico é assegurar informações e estudos estatísticos, geográficos, cartográficos e demográficos sobre a realidade física, econômica e social do País, e que atua principalmente em estatísticas primárias, contínuas e censitárias, e em estatísticas derivadas.", "In other words: the law treats the IBGE as a foundation whose basic objective is to ensure statistical, geographical, cartographic and demographic information and studies on the physical, economic and social reality of the country, and which works mainly in primary statistics, continuous and census-based, and in derived statistics."),
        ),
      ],
      limitacoes: [
        tx("A lei é de 1973. O texto compilado do Planalto lido em 09/10/2026 não traz anotação de alteração nos arts. 1º a 3º, mas o estatuto vigente do IBGE e as normas sobre a vinculação dele à administração federal não foram lidos.", "The law is from 1973. The consolidated text from Planalto read on Oct 9, 2026 has no amendment notes in arts. 1 to 3, but the current IBGE bylaws and the norms on its link to the federal administration were not read."),
      ],
      detalheDaConferencia: [
        tx("O art. 1º da lei cita a supervisão de um ministro da época; o verbete não usa essa parte. O site do IBGE não foi consultado.", "Art. 1 of the law cites the supervision of a minister of the time; the entry does not use that part. The IBGE website was not consulted."),
        NOTA_CAPTURA,
      ],
      vejaNoPortal: [{ rotulo: tx("Inclusão: peso no orçamento", "Inclusion: weight in the budget"), href: "/setor-eletrico/inclusao-energetica/orcamento" }],
    },
    {
      slug: "sistemas-isolados",
      nome: tx("Sistemas Isolados", "Isolated Systems"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-09",
      emUmaFrase:
        tx("Sistemas elétricos de serviço público de distribuição de energia elétrica que, em sua configuração normal, não estão eletricamente conectados ao Sistema Interligado Nacional (SIN), por razões técnicas ou econômicas.", "Public service electricity distribution systems that, in their normal configuration, are not electrically connected to the National Interconnected System (SIN), for technical or economic reasons."),
      porQueImporta:
        tx("Um valor do SIN descreve o sistema interligado: as localidades atendidas por Sistemas Isolados ficam fora dele, por definição. A página do ONS diz que o consumo nelas representa menos de 1% da carga total do país, sem data de referência, e que a demanda é suprida principalmente por térmicas a óleo diesel. O painel de Inclusão energética lista as localidades e a população do PASI, da EPE.", "A SIN value describes the interconnected system: the localities served by Isolated Systems are outside it, by definition. The ONS page says that consumption in them represents less than 1% of the country's total load, without a reference date, and that demand is met mainly by diesel thermal plants. The Energy inclusion panel lists the localities and the population of the PASI, from the EPE."),
      relacoes: ["sin", "ons", "epe", "bandeira-tarifaria"],
      relacoesNotas: {
        sin: tx("Segundo o ONS, o SIN é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte.", "According to the ONS, the SIN is made up of four subsystems: South, Southeast/Center-West, Northeast and most of the North region."),
        ons: tx("Desde 1º de maio de 2017, o ONS faz a previsão de carga e o planejamento da operação dos sistemas isolados.", "Since May 1, 2017, the ONS performs load forecasting and operation planning for isolated systems."),
      },
      fontes: [
        planalto(
          tx("Decreto nº 7.246, de 28 de julho de 2010, art. 2º, inciso III", "Decree No. 7.246 of Jul 28, 2010, art. 2, item III"),
          URL_D7246,
          // i18n: dado
          "III - Sistemas Isolados - os sistemas elétricos de serviço público de distribuição de energia elétrica que, em sua configuração normal, não estejam eletricamente conectados ao Sistema Interligado Nacional - SIN, por razões técnicas ou econômicas;",
          tx("Em outras palavras: o decreto chama de Sistemas Isolados os sistemas elétricos de distribuição de serviço público que, em sua configuração normal, não estão ligados eletricamente ao SIN, por razões técnicas ou econômicas.", "In other words: the decree calls Isolated Systems the public service distribution electrical systems that, in their normal configuration, are not electrically connected to the SIN, for technical or economic reasons."),
        ),
        planalto(
          tx("Lei nº 9.648, de 27 de maio de 1998, art. 13", "Law No. 9.648 of May 27, 1998, art. 13"),
          URL_L9648,
          // i18n: dado
          "e as atividades de previsão de carga e planejamento da operação do Sistema Isolado (Sisol) serão executadas, mediante autorização do poder concedente, pelo Operador Nacional do Sistema Elétrico (ONS) [...] g) a partir de 1º de maio de 2017, a previsão de carga e o planejamento da operação do Sisol.",
          tx("Em outras palavras: a previsão de carga e o planejamento da operação do Sistema Isolado cabem ao ONS, a partir de 1º de maio de 2017.", "In other words: load forecasting and operation planning of the Isolated System are the responsibility of the ONS, from May 1, 2017."),
        ),
        ons(
          tx("ONS, página institucional O Sistema Interligado Nacional", "ONS, institutional page «O Sistema Interligado Nacional»"),
          URL_ONS_SIN,
          // i18n: dado
          "O Sistema Interligado Nacional é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte.",
          tx("Em outras palavras: o ONS descreve o SIN como o conjunto de quatro subsistemas, os três das regiões Sul, Sudeste/Centro-Oeste e Nordeste e a maior parte do Norte.", "In other words: the ONS describes the SIN as the group of four subsystems, the three of the South, Southeast/Center-West and Northeast regions and most of the North."),
        ),
        ons(
          tx("ONS, página institucional Sistemas Isolados", "ONS, institutional page «Sistemas Isolados»"),
          URL_ONS_ISOLADOS,
          // i18n: dado
          "Atualmente, existem 212 localidades isoladas no Brasil. A maior parte está na região Norte, nos estados de Rondônia, Acre, Amazonas, Roraima, Amapá e Pará. A ilha de Fernando de Noronha, em Pernambuco, e algumas localidades de Mato Grosso completam a lista. [...] O consumo nessas localidades é baixo e representa menos de 1% da carga total do país. A demanda por energia dessas regiões é suprida, principalmente, por térmicas a óleo diesel.",
          tx("Em outras palavras: a página do ONS, sem data de referência, conta as localidades isoladas, situa a maior parte delas na região Norte, diz que o consumo nelas é baixo (menos de 1% da carga total do país) e que a demanda é suprida principalmente por térmicas a óleo diesel.", "In other words: the ONS page, without a reference date, counts the isolated localities, places most of them in the North region, says that consumption in them is low (less than 1% of the country's total load) and that demand is met mainly by diesel thermal plants."),
        ),
      ],
      limitacoes: [
        tx("A página do ONS sobre os sistemas isolados não traz data de referência para a contagem de localidades, para a participação delas na carga nem para a lista de capitais atendidas: o verbete a cita como está escrita e não usa esses números como dado do observatório.", "The ONS page on isolated systems gives no reference date for the count of localities, for their share of the load or for the list of capitals served: the entry cites it as written and does not use these figures as observatory data."),
        tx("O decreto lido é o texto compilado do Planalto, com a redação do Decreto nº 11.629, de 2023, no inciso que define os Sistemas Isolados; os atos da ANEEL sobre esses sistemas não foram lidos.", "The decree read is the consolidated text from Planalto, with the wording of Decree No. 11.629 of 2023 in the item that defines Isolated Systems; ANEEL acts on these systems were not read."),
      ],
      detalheDaConferencia: [
        tx("A definição vem do decreto; o escopo do SIN e o das localidades isoladas vêm de páginas do ONS lidas em 09/10/2026, sem data de publicação.", "The definition comes from the decree; the scope of the SIN and that of the isolated localities come from ONS pages read on Oct 9, 2026, without a publication date."),
        NOTA_CAPTURA,
      ],
      vejaNoPortal: [{ rotulo: tx("Inclusão: sistemas isolados", "Inclusion: isolated systems"), href: "/setor-eletrico/inclusao-energetica/acesso#isolados" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
