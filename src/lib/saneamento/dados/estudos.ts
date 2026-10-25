import { rotuloSinisa } from "@/lib/saneamento/edicao";
/**
 * Dois estudos de formação e revisão de tarifa, sob modelos regulatórios
 * distintos, reconstruídos a partir de documentos oficiais consultados em
 * 14/10/2026. Cada número leva documento e localizador ("PDF p." é a página
 * física do arquivo). Nenhum valor é estimado; as únicas contas são somas de
 * componentes publicados, conferidas com a planilha oficial no caso da ARSESP.
 * Curadoria e originais: pipeline/observatorio_saneamento/curadoria/ (manifesto).
 */

export type Documento = { id: string; rotulo: string; url: string; sha256: string; observacao?: string };
export type Linha = { rotulo: string; valor: number | null; unidade: string; casas: number; fonte: string; nota?: string };
export type Etapa = { quando: string; o_que: string; fonte: string };
/** Quem suporta, conforme o documento: sem deduzir repasse que o texto não prevê. */
export type Risco = {
  evento: string;
  quem: "Prestador" | "Poder concedente" | "Tarifa, por repasse previsto" | "Tarifa, por ajuste posterior" | "Taxa fixa reconhecida na tarifa" | "Repartido conforme a causa";
  como: string;
  fonte: string;
};

export type Estudo = {
  id: string;
  prestador: string;
  regulador: string;
  titulo: string;
  modelo: string;
  modeloResumo: string;
  baseLegal: string;
  documentos: Documento[];
  cronologia: Etapa[];
  pedidoReconhecido: Linha[];
  receita: { titulo: string; moeda: string; linhas: Linha[]; total: Linha; nota: string };
  ponte?: { titulo: string; linhas: Linha[]; nota: string };
  wacc: Linha[];
  outrosParametros: Linha[];
  obrigacoes: { premissa: string; obrigacao: string; resultado: string; providencia: string; fonte: string }[];
  riscos: Risco[];
  naoVerificado: string[];
};

const ARSESP_NT_EQ = "nt-equilibrio";
const ARSESP_NT_AP = "nt-aplicacao";

export const ESTUDOS: Estudo[] = [
  {
    id: "sabesp-2026",
    prestador: "SABESP (URAE-1, Contrato de Concessão 01/2024)",
    regulador: "ARSESP",
    titulo: "1º reajuste do contrato de concessão da Sabesp (vigência em 01/01/2026)",
    modelo: "Contratual, pós-desestatização: tarifa de equilíbrio calculada a cada ano por blocos de custo, com parâmetros fixados no contrato",
    modeloResumo:
      "O contrato fixa o método e parâmetros como custo de capital e Fator X. Todo ano a ARSESP recalcula a tarifa de equilíbrio com custos e ativos já realizados. A tarifa aplicada é a menor entre a de equilíbrio e a tabela contratual corrigida; a diferença é coberta por conta vinculada ou pelo FAUSP, um fundo estadual.",
    baseLegal: "Lei 11.445/2007, art. 23, IV; LC-SP 1.025/2007; Lei estadual 17.853/2023; Contrato de Concessão 01/2024, Anexos V, VII e VIII",
    documentos: [
      { id: ARSESP_NT_EQ, rotulo: "ARSESP, Nota Técnica do 1º reajuste: Tarifa de Equilíbrio (versão final com errata)", url: "https://www.arsesp.sp.gov.br/Documentosgerais/NT%201%C2%BA%20REAJUSTE%20TARIF%C3%81RIO%20DA%20SABESP%20-%20Tarifa%20de%20Equil%C3%ADbrio-%20URAE1_Final%20V2%20-%20Errata.pdf", sha256: "2a1e1141a694f2d382458ed7a02968008d0ac315b25d37cbfd577097531df5fd" },
      { id: ARSESP_NT_AP, rotulo: "ARSESP, Nota Técnica do 1º reajuste: Tarifa de Aplicação", url: "https://www.arsesp.sp.gov.br/Documentosgerais/NT%201%C2%BA%20REAJUSTE%20TARIF%C3%81RIO%20DA%20SABESP-%20Tarifa%20Aplica%C3%A7%C3%A3o%20-%20URAE1%20v2%20-%20Errata%20-%20Assinada.pdf", sha256: "f77ea81c41d25a3d3caee590537746d526aff6d9b2a75ab002a56c1c71b60ef8" },
      { id: "deli1748", rotulo: "Deliberação ARSESP 1.748/2025 (tarifa de equilíbrio)", url: "https://www.arsesp.sp.gov.br/LegislacaoArquivos/deli1748.pdf", sha256: "8f1bc5b8e56ada857a26d1fc542c7cffe9d8d323554fe577e9d7b344b6123c33" },
      { id: "deli1749", rotulo: "Deliberação ARSESP 1.749/2025 (tarifa de aplicação)", url: "https://www.arsesp.sp.gov.br/LegislacaoArquivos/1749.pdf", sha256: "f04bef7935f7657f066281822c49c6ecbbdb64421b54c1f56e16affbf5a84316" },
      { id: "planilha", rotulo: "ARSESP, planilha de cálculo da tarifa de equilíbrio (.xlsm)", url: "https://www.arsesp.sp.gov.br/Documentosgerais/251129_1%C2%B0_Reajuste_V3%20-%20NT%20Final%20Tarifa%20Equil%C3%ADbrio_limpo.xlsm", sha256: "cdb09cf2247ccfbb6f423ba1276b4357d29038117d4cf02ae921d3816d8c6166" },
      { id: "contrato", rotulo: "Contrato de Concessão 01/2024 (URAE-1)", url: "https://semil.sp.gov.br/urae1/wp-content/uploads/sites/26/2024/08/Contrato-de-Concessao-Assinado_assinado_dp_assinado.pdf", sha256: "facff76edcd89317000204f645f1d71c00b0813a2f8d29bc6e108429ba3eebc5" },
      { id: "anexo8", rotulo: "Contrato 01/2024, Anexo VIII (formação da tarifa inicial), apostilado", url: "https://semil.sp.gov.br/urae1/wp-content/uploads/sites/26/2025/02/ANEXO-VIII_Apostilado.pdf", sha256: "c6c54c44baab546a680b3477ffffc38b752e0591e3a8f4eb734f518cde146894" },
      { id: "anexo7", rotulo: "Contrato 01/2024, Anexo VII (Fator U, Fator Q e indicadores), apostilado", url: "https://semil.sp.gov.br/urae1/wp-content/uploads/sites/26/2025/02/ANEXO-VII_Apostilado.pdf", sha256: "cf1215d6a652ee5e149a7c705960ed30fd6a1c841a8920dc299e8b080e642cce" },
    ],
    cronologia: [
      { quando: "23/07/2024", o_que: "Início da eficácia do contrato; tarifas do Anexo IV passam a valer (Deliberação 1.539). P0 contratual de R$ 6,3359/m³ (preços de junho de 2024).", fonte: "Deliberação 1.539, PDF p.4; Anexo VIII, item 3.2" },
      { quando: "21/11 e 27/11/2025", o_que: "A Sabesp protocola os pedidos (Cartas 0848-2025 e 0867-2025). Os valores pedidos não foram publicados.", fonte: "NT Equilíbrio, PDF p.49-50" },
      { quando: "01/12/2025", o_que: "ARSESP decide: Deliberações 1.748 (tarifa de equilíbrio) e 1.749 (tarifa de aplicação), republicadas por erro material.", fonte: "Deliberações 1.748 e 1.749, PDF p.1" },
      { quando: "01/01/2026", o_que: "Entrada em vigor das novas tabelas.", fonte: "Deliberação 1.748, art. 2º; Deliberação 1.749, art. 3º" },
      { quando: "28/01/2026", o_que: "Tarifas de transição para quem perde a tarifa social (Deliberação 1.768), retroativas a 01/01/2026.", fonte: "Deliberação 1.768, PDF p.1-2" },
      { quando: "Dezembro de cada ano", o_que: "Reajuste anual homologado em dezembro e aplicado em 1º de janeiro; 1ª revisão periódica em 2029.", fonte: "Anexo V, item 5.1.1; Anexo VIII, item 5.5" },
    ],
    pedidoReconhecido: [
      { rotulo: "Valor pedido pela concessionária", valor: null, unidade: "", casas: 0, fonte: "NT Equilíbrio, PDF p.49-50", nota: "Não publicado; o Observatório não estima." },
      { rotulo: "Tarifa de equilíbrio sem os três pleitos de reequilíbrio", valor: 6.5304, unidade: "R$/m³ (out/2025)", casas: 4, fonte: "NT Equilíbrio, PDF p.48", nota: "Variação de 3,07% sobre a tarifa média base." },
      { rotulo: "Tarifa de equilíbrio reconhecida", valor: 6.7673, unidade: "R$/m³ (out/2025)", casas: 4, fonte: "NT Equilíbrio, PDF p.56-57; Deliberação 1.748, arts. 1º e 3º", nota: "Variação de 6,81%, com reconhecimento provisório de 40% de três pleitos." },
      { rotulo: "Tabela do contrato (Anexo IV) corrigida", valor: 6.7655, unidade: "R$/m³", casas: 4, fonte: "NT Aplicação, PDF p.5-7", nota: "Reajuste de 6,1106% (IPCA) e PIS/Cofins efetivo de 7,2331%." },
      { rotulo: "Tarifa autorizada para aplicação", valor: 6.7655, unidade: "R$/m³", casas: 4, fonte: "Deliberação 1.749, arts. 1º a 3º", nota: "Vale a menor entre a de equilíbrio e a contratual corrigida; a diferença, 0,0266% desfavorável ao FAUSP." },
    ],
    receita: {
      titulo: "Receita requerida por blocos de custo",
      moeda: "R$ milhões, preços de outubro de 2025; ano de referência 2024",
      linhas: [
        { rotulo: "Custos operacionais regulatórios (OPEX)", valor: 9670.47, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, quadro da PDF p.56", nota: "Água 5.299; esgoto 2.889; geral 1.482." },
        { rotulo: "Outras despesas", valor: 1531.17, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56", nota: "PPP e locação 714,44; fundos municipais 696,70; recursos hídricos 84,67; seguros, P&D e verificador." },
        { rotulo: "Receitas irrecuperáveis (inadimplência regulatória)", valor: 411.56, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56", nota: "Taxa fixa de 1,65% no 1º ciclo." },
        { rotulo: "Remuneração do capital", valor: 10559.45, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56", nota: "11,91% × (base de remuneração líquida 85.856,72 + outorga líquida 2.803,68)." },
        { rotulo: "Remuneração da necessidade de capital de giro", valor: 67.35, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56" },
        { rotulo: "Quota de reintegração regulatória (depreciação)", valor: 3108.7, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56", nota: "Sobre a base bruta sem terrenos de 143.719,18 e a outorga bruta de 2.883,78." },
      ],
      total: { rotulo: "Receita requerida", valor: 25348.7, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56; planilha ARSESP, aba P0 2026" },
      nota: "A soma dos seis blocos reproduz a receita requerida publicada. O quadro não rotula a unidade; milhões é a única coerente com a receita tarifária base dividida pelo volume medido.",
    },
    ponte: {
      titulo: "Da receita requerida à tarifa de equilíbrio",
      linhas: [
        { rotulo: "Receita requerida", valor: 25348.7, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56" },
        { rotulo: "(−) Fator K, receitas complementares e adicionais", valor: -405.72, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56", nota: "242,16 + 92,92 + 70,64." },
        { rotulo: "Receita tarifária base", valor: 24942.97, unidade: "R$ mi", casas: 2, fonte: "NT Equilíbrio, PDF p.56" },
        { rotulo: "÷ volume medido", valor: 3677.38, unidade: "milhões de m³", casas: 2, fonte: "NT Equilíbrio, PDF p.56" },
        { rotulo: "Tarifa média base", valor: 6.7828, unidade: "R$/m³", casas: 4, fonte: "NT Equilíbrio, PDF p.56" },
        { rotulo: "Componentes financeiros (saldo)", valor: -0.0155, unidade: "R$/m³", casas: 4, fonte: "NT Equilíbrio, PDF p.56", nota: "Encerramento do 4º ciclo −0,6170; 1º Termo Aditivo +0,2386; reformas e cancelamentos +0,1918; fundos municipais +0,0680 e outros." },
        { rotulo: "Tarifa de equilíbrio", valor: 6.7673, unidade: "R$/m³", casas: 4, fonte: "NT Equilíbrio, PDF p.56-57; Deliberação 1.748" },
      ],
      nota: "Cada linha é publicada. A única conta do Observatório é a soma das três deduções (405,72); a diferença de R$ 0,01 mi para a receita tarifária base publicada é arredondamento da fonte.",
    },
    wacc: [
      { rotulo: "Taxa livre de risco", valor: 3.84, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "Beta desalavancado / realavancado", valor: 0.73, unidade: "beta realavancado", casas: 2, fonte: "Anexo VIII, Tabela 5", nota: "Desalavancado 0,61." },
      { rotulo: "Prêmio de risco de mercado", valor: 7.17, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "Risco-país", valor: 2.52, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "Custo do capital próprio, real", valor: 8.84, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "Custo da dívida real antes do IR", valor: 7.13, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5", nota: "Debêntures 6,61% + custo de emissão 0,52%." },
      { rotulo: "Participação de capital de terceiros", valor: 23.62, unidade: "%", casas: 2, fonte: "Anexo VIII, item 10.5.3" },
      { rotulo: "IR e CSLL", valor: 34, unidade: "%", casas: 0, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "WACC real depois de impostos", valor: 7.86, unidade: "%", casas: 2, fonte: "Anexo VIII, Tabela 5" },
      { rotulo: "WACC real antes de impostos (usado na tarifa)", valor: 11.91, unidade: "%", casas: 2, fonte: "Anexo VIII, item 10.7", nota: "Fixo no 1º ciclo. Texto e planilha divergem nas janelas da taxa livre de risco e do beta; divergência registrada, não resolvida." },
    ],
    outrosParametros: [
      { rotulo: "Fator X", valor: 0.89, unidade: "% ao ano", casas: 2, fonte: "Anexo VIII, itens 7.5.6 e 7.8.1" },
      { rotulo: "Receitas irrecuperáveis", valor: 1.65, unidade: "%", casas: 2, fonte: "Anexo VIII, PDF p.10" },
      { rotulo: "Reajuste pela inflação (IPCA jun/2024 a out/2025)", valor: 6.1106, unidade: "%", casas: 4, fonte: "Deliberação 1.749, art. 1º" },
    ],
    obrigacoes: [
      { premissa: "Cobertura de água (ICA) de 97% em 2026 e 99% de 2027 em diante", obrigacao: "Metas de cobertura da URAE-1, base para avaliação de caducidade até 2030", resultado: `Verificação anual da ARSESP pelo Anexo II; o ${rotuloSinisa()} mede outro conceito (ao lado, por prestador)`, providencia: "Fator U e Fator Q não aplicados no 1º reajuste", fonte: "Anexo VII, item 3.7; NT Equilíbrio, PDF p.5" },
      { premissa: "Cobertura de esgoto (ICE) de 90% em 2026, 93% em 2027, 96% em 2028 e 99% de 2029 em diante", obrigacao: "Metas contratuais, universalização até 31/12/2029", resultado: "Sem aferição publicada pelo regulador para 2026 nos documentos consultados", providencia: "Não aplicável neste reajuste", fonte: "Anexo VII, item 3.7; Contrato, PDF p.6 e p.26" },
      { premissa: "Tratamento do esgoto coletado (IEC) de 85% em 2026 e 99% de 2029 em diante", obrigacao: "Meta contratual de tratamento", resultado: "Sem aferição publicada para 2026 nos documentos consultados", providencia: "Não aplicável neste reajuste", fonte: "Anexo VII, item 3.7" },
      { premissa: "Investimento realizado entra na base de remuneração", obrigacao: "Base atualizada com laudos de dezembro de 2023 e 2024 homologados", resultado: "Base líquida de R$ 85.856,72 mi remunerada a 11,91%", providencia: "Investimento não realizado não entra na base (Cl. 37, § 1º)", fonte: "NT Equilíbrio, PDF p.15-17 e p.56; Contrato, Cl. 37" },
    ],
    riscos: [
      { evento: "Frustração ou variação da arrecadação (demanda)", quem: "Prestador", como: "Risco da concessionária; o mercado é atualizado a cada reajuste com dados realizados", fonte: "Contrato, Cl. 36, h (PDF p.56)" },
      { evento: "Inadimplência dos usuários", quem: "Taxa fixa reconhecida na tarifa", como: "Taxa regulatória de 1,65% fixada para o 1º ciclo; o documento não prevê ajuste pela inadimplência realizada", fonte: "Anexo VIII, PDF p.10" },
      { evento: "Indisponibilidade de energia elétrica", quem: "Poder concedente", como: "Risco da URAE-1; o custo da energia está no OPEX por custo unitário, corrigido por IPCA e Fator X", fonte: "Contrato, Cl. 37, q (PDF p.60); Anexo VIII, itens 7.2.3 e 7.5.8" },
      { evento: "Atrasos de obra e de licenças", quem: "Repartido conforme a causa", como: "Repartido conforme a causa entre as cláusulas 36 e 37", fonte: "Contrato, Cl. 36, a, b, l; Cl. 37, b, e, k" },
      { evento: "Mudança de tributos que não incidem sobre a renda (inclui a reforma tributária)", quem: "Poder concedente", como: "Risco da URAE-1, com reequilíbrio", fonte: "Contrato, Cl. 37, f" },
      { evento: "Pleitos de reequilíbrio no 1º reajuste", quem: "Tarifa, por ajuste posterior", como: "Reconhecimento antecipado e provisório de 40% de três pleitos (+0,2369 R$/m³), sujeito a revisão", fonte: "Deliberação 1.748, art. 3º; NT Equilíbrio, PDF p.48-56" },
    ],
    naoVerificado: [
      "Valores pedidos pela Sabesp nas Cartas 0848-2025 e 0867-2025 (não publicados).",
      "Consulta pública específica deste reajuste (não identificada na lista oficial da ARSESP).",
      "Data exata da republicação das Deliberações (04/12 ou 08/12/2025).",
    ],
  },
  {
    id: "sanepar-2025",
    prestador: "SANEPAR",
    regulador: "AGEPAR",
    titulo: "3ª Revisão Tarifária Periódica da Sanepar, ciclo 2025-2028 (vigência em 17/05/2025)",
    modelo: "Discricionário, por preço-teto: fluxo de caixa descontado prospectivo para o ciclo",
    modeloResumo:
      "O regulador projeta receitas, custos e investimentos dos quatro anos do ciclo. A tarifa média (P0) é a que iguala o valor presente das receitas ao dos custos, investimentos e bases de capital, ao custo de capital regulatório. Entre revisões, reajustes anuais aplicam inflação, energia e fatores X e Q.",
    baseLegal: "Lei 11.445/2007; LC-PR 222/2020; Manual de Revisão Tarifária da AGEPAR (NT 007/2024)",
    documentos: [
      { id: "nt6", rotulo: "AGEPAR, Nota Técnica 006/2025 (pós-audiência)", url: "https://www.sanepar.com.br/sites/default/files/notatecnica620253artpsanepar.pdf", sha256: "3f1c5f5164eed73443af587deee45afc44b503b72edad203d7c59763a52ec67c", observacao: "Cópia publicada pela Sanepar com assinatura eletrônica e código de validação da AGEPAR; o repositório oficial recusou a conexão." },
      { id: "dioe11882", rotulo: "Diário Oficial do Paraná 11882, de 30/04/2025, p.77 (fluxo de caixa descontado, elaboração AGEPAR)", url: "https://www.sanepar.com.br/sites/default/files/diariooficialcomindservicos11882pag772025.pdf", sha256: "fa33dd635da82c21c245a024c66dd8eb58d1a0202c53cc6a4d2bd814b39403b9" },
      { id: "res10", rotulo: "Resolução AGEPAR 10/2025 (texto oficial)", url: "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=360557", sha256: "e6ad716de15fea87873065e879484b133432799bce405911cabb00967d25cd24" },
      { id: "res10anexo", rotulo: "Resolução AGEPAR 10/2025, Anexo Único (tabela)", url: "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=abrirAnexo&codArquivoAnexado=76240", sha256: "e21e86581c6921e449eac6f3a936c04e010a9638d587f2f77df8e255253fc22f" },
      { id: "res39", rotulo: "Resolução AGEPAR 39/2026, anexo (NT 002/2026, precatório)", url: "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=abrirAnexo&codArquivoAnexado=81928", sha256: "98ac72e3b87ce180bd8b14732ffb7ef9a0a49bc2c7cfacedfbabfe9e7bcda836" },
    ],
    cronologia: [
      { quando: "24/04/2024", o_que: "Cronograma da revisão (Resolução AGEPAR 20/2024, alterada pela 44/2024).", fonte: "Listagem oficial de resoluções" },
      { quando: "2024", o_que: "Consultas públicas 01, 04, 06 e 11/2024.", fonte: "Resolução 10/2025, considerandos" },
      { quando: "13/03/2025", o_que: "Audiência pública 001/2025 sobre a nota técnica preliminar.", fonte: "Página oficial de audiências da AGEPAR" },
      { quando: "03/04/2025", o_que: "Nota técnica final (006/2025), após a audiência.", fonte: "NT 006/2025, rodapé" },
      { quando: "15/04/2025", o_que: "Conselho Diretor aprova por unanimidade; Resolução AGEPAR 10/2025.", fonte: "Ata RCD 06/2025; Resolução 10/2025" },
      { quando: "17/05/2025", o_que: "Entrada em vigor das tabelas.", fonte: "Resolução 10/2025, art. 2º" },
      { quando: "21/08/2025", o_que: "Tarifa social da Lei 14.898/2024 (Resolução 36/2025), com tabelas ampliadas em 2,7117% para manter a tarifa média.", fonte: "Resolução 36/2025" },
      { quando: "17/05/2026", o_que: "Reajuste anual de 2,4993% (Resolução 23/2026); tarifa média de R$ 7,0032/m³.", fonte: "Resolução 23/2026; DIOE 12131" },
      { quando: "23/06/2026", o_que: "R$ 3,94 bilhões de precatório destinados à modicidade tarifária (Resolução 39/2026).", fonte: "Resolução 39/2026, anexo NT 002/2026" },
      { quando: "16/05/2029", o_que: "Fim do ciclo.", fonte: "NT 002/2026, PDF p.84" },
    ],
    pedidoReconhecido: [
      { rotulo: "Tarifa pedida pela Sanepar", valor: null, unidade: "", casas: 0, fonte: "NT 006/2025", nota: "Não publicada; o Observatório não estima." },
      { rotulo: "Investimento pedido para 2025-2028", valor: 8146.53, unidade: "R$ mi (dez/2024)", casas: 2, fonte: "NT 006/2025, Tabela 25" },
      { rotulo: "Investimento considerado pela AGEPAR", valor: 6824.5, unidade: "R$ mi (dez/2024)", casas: 2, fonte: "NT 006/2025, Tabela 25", nota: "Glosa de 16,45% sobre o pedido com juros atualizados (R$ 8.168,01 mi)." },
      { rotulo: "Tarifa média antes das compensações", valor: 6.6524, unidade: "R$/m³ (dez/2024)", casas: 4, fonte: "DIOE 11882, p.77" },
      { rotulo: "Tarifa média máxima autorizada (P0)", valor: 6.83, unidade: "R$/m³ (dez/2024)", casas: 2, fonte: "Resolução 10/2025, art. 1º", nota: "Tabelas reajustadas em 3,7753%." },
    ],
    receita: {
      titulo: "Composição do P0 no fluxo de caixa descontado",
      moeda: "Parcelas do P0 em R$/m³ (valor presente dos fluxos 2025-2028 ÷ volume faturado em valor presente), preços de dezembro de 2024",
      linhas: [
        { rotulo: "Custos operacionais (OPEX)", valor: 3.34, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77", nota: "Parcela A (custos não gerenciáveis) 1,04; Parcela B 2,30." },
        { rotulo: "Investimentos do ciclo (CAPEX)", valor: 1.56, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
        { rotulo: "Base de capital inicial", valor: 6.49, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
        { rotulo: "(−) Base de capital final", valor: -4.79, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77", nota: "Devolvida ao fim do ciclo: a depreciação é paga de forma implícita pela diferença entre as bases." },
        { rotulo: "Variação do capital de giro", valor: 0.07, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
        { rotulo: "Receitas irrecuperáveis", valor: 0.04, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
        { rotulo: "Ativos não operacionais (anuidade)", valor: 0.01, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
        { rotulo: "(−) Outras receitas", valor: -0.08, unidade: "R$/m³", casas: 2, fonte: "DIOE 11882, p.77" },
      ],
      total: { rotulo: "Tarifa média antes das compensações (P0)", valor: 6.6524, unidade: "R$/m³", casas: 4, fonte: "DIOE 11882, p.77" },
      nota: "As parcelas publicadas com duas casas somam 6,64, coerente com 6,6524 dentro do arredondamento da fonte. O custo de capital entra pelo desconto dos fluxos a 12,24%, não como linha.",
    },
    ponte: {
      titulo: "Do P0 calculado à tarifa autorizada",
      linhas: [
        { rotulo: "P0 antes das compensações", valor: 6.6524, unidade: "R$/m³", casas: 4, fonte: "DIOE 11882, p.77" },
        { rotulo: "Ajuste compensatório ordinário", valor: -0.01, unidade: "R$/m³", casas: 2, fonte: "NT 006/2025, PDF p.93", nota: "−R$ 20,7 mi, com o fluxo da 2ª revisão refeito a 11,47%." },
        { rotulo: "Ajustes extraordinários", valor: 0.19, unidade: "R$/m³", casas: 2, fonte: "NT 006/2025, Tabelas 36 a 40", nota: "R$ 617,4 mi: sobras da 2ª revisão −132,8; conta gráfica da Parcela A +259,3; capital de giro +321,8; instalações +169,0." },
        { rotulo: "P0 autorizado", valor: 6.83, unidade: "R$/m³", casas: 2, fonte: "Resolução 10/2025, art. 1º" },
      ],
      nota: "Linhas publicadas pelo regulador; os ajustes estão em duas casas na fonte.",
    },
    wacc: [
      { rotulo: "Taxa livre de risco", valor: 3.74, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "Beta desalavancado / realavancado", valor: 0.968, unidade: "beta realavancado", casas: 3, fonte: "NT 006/2025, Tabela 7", nota: "Desalavancado 0,608." },
      { rotulo: "Prêmio de risco de mercado", valor: 8.81, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "Risco-país", valor: 3.07, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "Custo do capital próprio, nominal em dólar", valor: 15.34, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "Custo da dívida, nominal", valor: 8.75, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "Participação de capital de terceiros", valor: 47.29, unidade: "%", casas: 2, fonte: "NT 006/2025, Tabela 7", nota: "A Tabela 6 mostra 47,20% em 2024; diferença registrada como publicada." },
      { rotulo: "IR e CSLL", valor: 34, unidade: "%", casas: 0, fonte: "NT 006/2025, Tabela 7" },
      { rotulo: "WACC real depois de impostos", valor: 8.08, unidade: "%", casas: 2, fonte: "NT 006/2025, PDF p.24" },
      { rotulo: "WACC real antes de impostos (usado no fluxo)", valor: 12.24, unidade: "%", casas: 2, fonte: "NT 006/2025, PDF p.24" },
    ],
    outrosParametros: [
      { rotulo: "Fator X", valor: 0, unidade: "% ao ano", casas: 1, fonte: "NT 006/2025, PDF p.42-43", nota: "O índice de Malmquist deu mediana de −6,5%; a AGEPAR neutralizou o fator." },
      { rotulo: "Receitas irrecuperáveis", valor: 0.6574, unidade: "%", casas: 4, fonte: "NT 006/2025, PDF p.14" },
      { rotulo: "Glosa prudencial sobre investimentos de 2021-2024", valor: 5, unidade: "%", casas: 0, fonte: "NT 006/2025, PDF p.81" },
    ],
    obrigacoes: [
      { premissa: "Plano de investimentos de R$ 6.824,50 mi em 2025-2028", obrigacao: "Investimento considerado na tarifa; diferença entre previsto e realizado compensada na revisão seguinte", resultado: `Execução do ciclo ainda não aferida; os dados de ${rotuloSinisa()} são anteriores ao ciclo`, providencia: "Compensação prevista para a 4ª revisão", fonte: "NT 006/2025, Tabela 25 e PDF p.90-91" },
      { premissa: "Redução de perdas de 0,31% ao ano", obrigacao: "Trajetória regulatória de perdas usada nos custos", resultado: "Perdas na distribuição de 2024 ao lado (SINISA, prestador)", providencia: "Sem aplicação de mecanismo específico nos documentos consultados", fonte: "NT 006/2025, PDF p.11" },
      { premissa: "Qualidade do serviço (Fator Q)", obrigacao: "Ajuste anual por desempenho", resultado: "Fator Q de 0,0000% nos reajustes de 2024 e 2026", providencia: "Aplicação depende de deliberação do Conselho Diretor", fonte: "DOE do IRT 2024; DIOE 12131 (IRT 2026)" },
    ],
    riscos: [
      { evento: "Custos não gerenciáveis (Parcela A), inclusive preço da energia", quem: "Tarifa, por repasse previsto", como: "Conta gráfica mensal repassada no reajuste seguinte; a quantidade de energia é Parcela B, risco do prestador", fonte: "NT 006/2025, PDF p.34 e p.90" },
      { evento: "Variação de demanda", quem: "Tarifa, por ajuste posterior", como: "Diferenças viram sobras financeiras apuradas na revisão seguinte", fonte: "NT 006/2025, PDF p.94-95" },
      { evento: "Inadimplência", quem: "Taxa fixa reconhecida na tarifa", como: "Taxa regulatória de 0,6574% definida na revisão", fonte: "NT 006/2025, PDF p.14" },
      { evento: "Investimento previsto e não realizado", quem: "Tarifa, por ajuste posterior", como: "Diferença compensada na revisão seguinte; baixas e ativos não elegíveis são risco do negócio", fonte: "NT 006/2025, PDF p.90-91" },
      { evento: "Ganho de precatório (imunidade recíproca)", quem: "Tarifa, por repasse previsto", como: "R$ 3,94 bilhões destinados à modicidade: metade em investimento não oneroso, metade em desconto de 25% na tarifa mínima até 16/05/2029", fonte: "Resolução 39/2026; NT 002/2026, PDF p.71-88" },
    ],
    naoVerificado: [
      "Tarifa pedida pela Sanepar (não publicada).",
      "Planilha completa do modelo da AGEPAR no repositório oficial (não acessível); usado o quadro publicado no Diário Oficial.",
      "Diferimento de reajustes: não encontrado nesta revisão.",
    ],
  },
];

export const GLOSSARIO_CONTA: { termo: string; definicao: string; naConta: string }[] = [
  { termo: "Receita requerida", definicao: "Quanto o regulador reconhece que o prestador precisa arrecadar no período para cobrir custos, depreciação e a remuneração do capital investido.", naConta: "Dividida pelo volume faturado, vira a tarifa média; a estrutura tarifária reparte essa média entre categorias e faixas." },
  { termo: "Base de remuneração regulatória (BRR)", definicao: "Valor dos ativos em serviço que o regulador aceita remunerar, avaliado por laudo e método próprios. Não é o ativo contábil do balanço.", naConta: "Quanto maior a base, maior a parcela de remuneração do capital na tarifa." },
  { termo: "Custo médio ponderado de capital (WACC)", definicao: "Taxa de retorno regulatória sobre a base, combinando custo do capital próprio e da dívida. Não é o lucro realizado pela empresa.", naConta: "Multiplicada pela base líquida, dá a remuneração do capital (Sabesp) ou desconta os fluxos (Sanepar)." },
  { termo: "Quota de reintegração regulatória", definicao: "Depreciação regulatória: devolve ao longo da vida útil o valor investido. Investimento e depreciação da mesma obra não são custos que se somam.", naConta: "Entra como bloco de custo no modelo da Sabesp e de forma implícita no fluxo da Sanepar." },
  { termo: "Fator X", definicao: "Redutor de produtividade aplicado nos reajustes para repartir ganhos esperados de eficiência. Nem todo regime o usa da mesma forma.", naConta: "Reduz o reajuste anual (0,89% ao ano na Sabesp; 0% na Sanepar neste ciclo)." },
  { termo: "Reajuste e revisão", definicao: "Reajuste corrige valores por índice e fatores definidos; revisão periódica recalcula custos, base e parâmetros; revisão extraordinária trata de evento fora do ciclo.", naConta: "O índice médio divulgado não é o aumento de toda conta: depende da categoria e do consumo." },
];
