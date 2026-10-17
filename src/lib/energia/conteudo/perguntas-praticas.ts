import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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
function montarPerguntaPratica(tx: TxIdioma): Record<string, string> {
  return {
    // Preço
    pld: tx("A que preço se liquidam as diferenças entre a energia contratada e a verificada?", "At what price are the differences between contracted and verified energy settled?"),
    cmo: tx("Quanto custa atender uma unidade a mais de carga?", "How much does it cost to serve one more unit of load?"),
    submercado: tx("Quais são as regiões com preço de curto prazo próprio?", "Which regions have their own short-term price?"),
    cvu: tx("Que valor se atribui a cada usina térmica na programação da operação?", "What value is assigned to each thermal plant in operation scheduling?"),
    "limites-do-pld": tx("Quais são o piso e os tetos do preço de curto prazo?", "What are the floor and the ceilings of the short-term price?"),
  
    // Água
    ear: tx("Quanta energia a água guardada nos reservatórios pode gerar?", "How much energy can the water stored in the reservoirs generate?"),
    armazenamento: tx("Quanta energia os reservatórios guardariam se estivessem cheios?", "How much energy would the reservoirs hold if they were full?"),
    ena: tx("Quanta energia a água que chega aos reservatórios permitiria produzir?", "How much energy would the water reaching the reservoirs allow to be produced?"),
    mlt: tx("Com que média se compara a energia que chega aos reservatórios?", "What average is the energy reaching the reservoirs compared with?"),
    ree: tx("Como os modelos de planejamento representam as usinas hidrelétricas?", "How do planning models represent hydropower plants?"),
  
    // Operação
    sin: tx("Qual é o nome do sistema elétrico interligado do país?", "What is the name of the country's interconnected electricity system?"),
    ons: tx("Quem coordena e controla a operação da geração e da transmissão de energia?", "Who coordinates and controls the operation of energy generation and transmission?"),
    "sistemas-isolados": tx("Que sistemas de distribuição não estão ligados ao sistema interligado?", "Which distribution systems are not connected to the interconnected system?"),
    carga: tx("Quanta energia o sistema interligado atende por dia?", "How much energy does the interconnected system serve per day?"),
    "geracao-centralizada": tx("Quanto as usinas geram hora a hora?", "How much do the plants generate hour by hour?"),
    intercambio: tx("Quanta energia passa de um subsistema a outro?", "How much energy passes from one subsystem to another?"),
    "constrained-off": tx("Quando o operador manda uma usina gerar menos por motivo externo a ela?", "When does the operator order a plant to generate less for a reason outside it?"),
    "curva-de-carga": tx("Como o consumo varia hora a hora?", "How does consumption vary hour by hour?"),
    "carga-global": tx("Quanta energia o sistema atende a cada meia hora?", "How much energy does the system serve every half hour?"),
    "carga-liquida-de-mmgd": tx("Qual é a carga sem a parcela da micro e minigeração distribuída?", "What is the load without the portion of distributed micro and mini generation?"),
    "intercambio-internacional": tx("Quanta energia o país troca com os vizinhos?", "How much energy does the country exchange with its neighbors?"),
    atls: tx("Em que parte do tempo os fluxos ficaram dentro dos limites de segurança?", "In what part of the time did the flows stay within the safety limits?"),
  
    // Modelos
    newave: tx("Quais modelos entram no cálculo do preço de curto prazo?", "Which models go into calculating the short-term price?"),
    decomp: tx("Que modelo estima o custo de operação de cada semana?", "Which model estimates the operating cost of each week?"),
    dessem: tx("Que modelo estima o custo de operação a cada meia hora?", "Which model estimates the operating cost every half hour?"),
  
    // Mercado
    mcp: tx("Onde se contabilizam e se liquidam as diferenças de energia?", "Where are energy differences accounted for and settled?"),
    ccee: tx("Quem viabiliza a comercialização de energia elétrica?", "Who enables the trading of electricity?"),
    acl: tx("Onde a energia é comprada em contratos livremente negociados?", "Where is energy bought in freely negotiated contracts?"),
    acr: tx("Como distribuidoras compram energia por licitação?", "How do distribution utilities buy energy through public tenders?"),
    mre: tx("Como as hidrelétricas compartilham o risco hidrológico?", "How do hydropower plants share hydrological risk?"),
    gsf: tx("Quanto as hidrelétricas do mecanismo geraram diante da garantia física?", "How much did the hydropower plants of the mechanism generate compared with the physical guarantee?"),
    ess: tx("Que encargo cobre os serviços prestados ao sistema?", "Which charge covers the services provided to the system?"),
    "garantia-fisica": tx("Quanta energia um empreendimento pode usar em contratos?", "How much energy can a project use in contracts?"),
  
    // Consumidor
    "tarifa-te-tusd": tx("Que tarifas são publicadas para cada distribuidora?", "Which tariffs are published for each distribution utility?"),
    "bandeira-tarifaria": tx("Quando há acréscimo por kWh na conta de luz?", "When is there a surcharge per kWh on the electricity bill?"),
    "custo-de-disponibilidade": tx("Quanto se deve mesmo quando a injeção supera o consumo?", "How much is owed even when injection exceeds consumption?"),
    cde: tx("Quem custeia os descontos e a universalização do serviço?", "Who pays for the discounts and for universal service?"),
  
    // Qualidade e perdas
    "perdas-de-energia": tx("Quanta energia passa pelas redes e não chega a ser vendida?", "How much energy passes through the grids and is not sold?"),
    "perdas-tecnicas": tx("Quanta perda é própria do transporte da energia?", "How much loss is inherent to transporting energy?"),
    "perdas-nao-tecnicas": tx("Quanto da perda total não é técnica?", "How much of the total loss is not technical?"),
    "percentual-regulatorio-de-perdas": tx("Que perda a tarifa reconhece para cada concessionária?", "What loss does the tariff recognize for each concession holder?"),
    dec: tx("Por quanto tempo falta energia, em média?", "For how long is there no electricity, on average?"),
    fec: tx("Quantas vezes falta energia, em média?", "How many times is there no electricity, on average?"),
    "conjunto-eletrico": tx("Em que áreas se acompanham a duração e a frequência das interrupções?", "In which areas are the duration and frequency of interruptions monitored?"),
    "compensacao-continuidade": tx("Quando a distribuidora deve dar crédito na fatura?", "When must the distribution utility give a credit on the bill?"),
  
    // Inclusão
    "tarifa-social": tx("Quem tem desconto na fatura de energia?", "Who gets a discount on the electricity bill?"),
  
    // Transição
    "geracao-distribuida": tx("Que geração se liga à rede pelas instalações do consumidor?", "What generation connects to the grid through the consumer's facilities?"),
    "fator-de-emissao": tx("Quanto CO2 se associa a cada MWh gerado no sistema interligado?", "How much CO2 is associated with each MWh generated in the interconnected system?"),
  
    // Regulação
    "agenda-regulatoria": tx("Que normas a agência prevê editar no biênio?", "Which norms does the agency plan to issue in the two-year period?"),
    aneel: tx("Quem regula e fiscaliza o setor de energia elétrica?", "Who regulates and oversees the electricity sector?"),
  
    // Expansão
    epe: tx("Quem faz os estudos que subsidiam o planejamento do setor energético?", "Who carries out the studies that support energy sector planning?"),
  
    // Fontes de dados
    ibge: tx("Quem produz as informações estatísticas e geográficas do País?", "Who produces the country's statistical and geographical information?"),
    imerg: tx("De onde vem a estimativa de chuva por satélite?", "Where does the satellite rainfall estimate come from?"),
    "merra-2": tx("De onde vem a temperatura estimada que os painéis usam?", "Where does the estimated temperature used by the panels come from?"),
  };
}
export const PERGUNTA_PRATICA_IDIOMAS = montarNosDoisIdiomas(montarPerguntaPratica);
export const PERGUNTA_PRATICA: Record<string, string> = PERGUNTA_PRATICA_IDIOMAS.pt;

/** Pergunta prática do verbete, ou null quando ele não tem (em preparação, ou verbete novo ainda sem pergunta escrita). */
export function perguntaPratica(slug: string, idioma: Idioma = idiomaEnergia()): string | null {
  return PERGUNTA_PRATICA_IDIOMAS[idioma][slug] ?? null;
}
