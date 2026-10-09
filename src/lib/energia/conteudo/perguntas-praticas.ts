/**
 * Pergunta prática de cada verbete do Aprenda: o índice abre cada resultado pela pergunta de quem procura, antes da sigla, e o
 * verbete a repete sob o título ("Entenda um conceito": busca, verbetes curtos e ligação direta com o painel).
 *
 * Isto é um índice de navegação, não definição nem texto de fonte. Cada pergunta reformula como pergunta o que o próprio verbete
 * conferido já diz em "Em uma frase", e a resposta é o verbete: nada aqui acrescenta fato, número ou causa. Por isso só verbete
 * CONFERIDO tem pergunta. Verbete em preparação não tem definição a reformular, e a falta de pergunta é a falta de definição, não a
 * ausência do conceito: o índice o mostra como em preparação, com o nome e o painel onde ele aparece.
 *
 * Regras de escrita, conferidas em teste: começa por palavra interrogativa, termina em "?", sem a sigla nem o nome do verbete (não
 * entrega a resposta), sem sigla que a página não expande (unidades como kWh e MWh e a fórmula CO2 ficam como são), sem hífen nem
 * travessão como separador, sem "hoje", "agora" ou "atual".
 */
export const PERGUNTA_PRATICA: Record<string, string> = {
  // Preço
  pld: "A que preço se liquidam as diferenças entre a energia contratada e a verificada?",
  cmo: "Quanto custa atender uma unidade a mais de carga?",
  submercado: "Quais são as regiões com preço de curto prazo próprio?",
  cvu: "Que valor se atribui a cada usina térmica na programação da operação?",
  "limites-do-pld": "Quais são o piso e os tetos do preço de curto prazo?",

  // Água
  ear: "Quanta energia a água guardada nos reservatórios pode gerar?",
  armazenamento: "Quanta energia os reservatórios guardariam se estivessem cheios?",
  ena: "Quanta energia a água que chega aos reservatórios permitiria produzir?",
  mlt: "Com que média se compara a energia que chega aos reservatórios?",
  ree: "Como os modelos de planejamento representam as usinas hidrelétricas?",

  // Operação
  sin: "Qual é o nome do sistema elétrico interligado do país?",
  ons: "Quem coordena e controla a operação da geração e da transmissão de energia?",
  "sistemas-isolados": "Que sistemas de distribuição não estão ligados ao sistema interligado?",
  carga: "Quanta energia o sistema interligado atende por dia?",
  "geracao-centralizada": "Quanto as usinas geram hora a hora?",
  intercambio: "Quanta energia passa de um subsistema a outro?",
  "constrained-off": "Quando o operador manda uma usina gerar menos por motivo externo a ela?",
  "curva-de-carga": "Como o consumo varia hora a hora?",
  "carga-global": "Quanta energia o sistema atende a cada meia hora?",
  "carga-liquida-de-mmgd": "Qual é a carga sem a parcela da micro e minigeração distribuída?",
  "intercambio-internacional": "Quanta energia o país troca com os vizinhos?",
  atls: "Em que parte do tempo os fluxos ficaram dentro dos limites de segurança?",

  // Modelos
  newave: "Quais modelos entram no cálculo do preço de curto prazo?",
  decomp: "Que modelo estima o custo de operação de cada semana?",
  dessem: "Que modelo estima o custo de operação a cada meia hora?",

  // Mercado
  mcp: "Onde se contabilizam e se liquidam as diferenças de energia?",
  ccee: "Quem viabiliza a comercialização de energia elétrica?",
  acl: "Onde a energia é comprada em contratos livremente negociados?",
  acr: "Como distribuidoras compram energia por licitação?",
  mre: "Como as hidrelétricas compartilham o risco hidrológico?",
  gsf: "Quanto as hidrelétricas do mecanismo geraram diante da garantia física?",
  ess: "Que encargo cobre os serviços prestados ao sistema?",
  "garantia-fisica": "Quanta energia um empreendimento pode usar em contratos?",

  // Consumidor
  "tarifa-te-tusd": "Que tarifas são publicadas para cada distribuidora?",
  "bandeira-tarifaria": "Quando há acréscimo por kWh na conta de luz?",
  "custo-de-disponibilidade": "Quanto se deve mesmo quando a injeção supera o consumo?",
  cde: "Quem custeia os descontos e a universalização do serviço?",

  // Qualidade e perdas
  "perdas-de-energia": "Quanta energia passa pelas redes e não chega a ser vendida?",
  "perdas-tecnicas": "Quanta perda é própria do transporte da energia?",
  "perdas-nao-tecnicas": "Quanto da perda total não é técnica?",
  "percentual-regulatorio-de-perdas": "Que perda a tarifa reconhece para cada concessionária?",
  dec: "Por quanto tempo falta energia, em média?",
  fec: "Quantas vezes falta energia, em média?",
  "conjunto-eletrico": "Em que áreas se acompanham a duração e a frequência das interrupções?",
  "compensacao-continuidade": "Quando a distribuidora deve dar crédito na fatura?",

  // Inclusão
  "tarifa-social": "Quem tem desconto na fatura de energia?",

  // Transição
  "geracao-distribuida": "Que geração se liga à rede pelas instalações do consumidor?",
  "fator-de-emissao": "Quanto CO2 se associa a cada MWh gerado no sistema interligado?",

  // Regulação
  "agenda-regulatoria": "Que normas a agência prevê editar no biênio?",
  aneel: "Quem regula e fiscaliza o setor de energia elétrica?",

  // Expansão
  epe: "Quem faz os estudos que subsidiam o planejamento do setor energético?",

  // Fontes de dados
  ibge: "Quem produz as informações estatísticas e geográficas do País?",
  imerg: "De onde vem a estimativa de chuva por satélite?",
  "merra-2": "De onde vem a temperatura estimada que os painéis usam?",
};

/** Pergunta prática do verbete, ou null quando ele não tem (em preparação, ou verbete novo ainda sem pergunta escrita). */
export function perguntaPratica(slug: string): string | null {
  return PERGUNTA_PRATICA[slug] ?? null;
}
