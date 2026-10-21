import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/** Percurso didático; não é a topologia ou a sequência de despacho do SIN. */
function montarEtapasEnergia(tx: TxIdioma) {
  return [
    {
      id: "geracao", encontra: tx("Fontes de geração, capacidade instalada e reservatórios.", "Generation sources, installed capacity and reservoirs."), recorte: tx("Compare potência em MW, produção em MWh e armazenamento em %; cada medida tem seu período e universo.", "Compare capacity in MW, output in MWh and storage in %; each measure has its own period and universe."), nome: tx("Geração", "Generation"), numero: "01",
      titulo: tx("Fontes diferentes. Um sistema conectado.", "Different sources. One connected system."),
      texto: tx("Água, vento, sol e combustíveis são transformados em eletricidade. A participação de cada fonte muda com o período, os recursos disponíveis e a operação do sistema.", "Water, wind, sun and fuels are turned into electricity. The share of each source changes with the period, the resources available and the operation of the system."),
      conceito: tx("Potência instalada é capacidade. Energia gerada é produção ao longo do tempo.", "Installed capacity is capacity. Generated energy is output over time."),
      href: "/setor-eletrico/geracao", link: tx("Explorar as fontes de geração", "Explore the generation sources"),
      detalhe: "/setor-eletrico/agua-e-clima", detalheNome: tx("Reservatórios e afluências", "Reservoirs and inflows"),
      pergunta: tx("De onde vem a eletricidade?", "Where does electricity come from?"),
    },
    {
      id: "transmissao", encontra: tx("Intercâmbios entre subsistemas e expansão da infraestrutura.", "Interchanges between subsystems and infrastructure expansion."), recorte: tx("Distinga fluxos observados, capacidade instalada e projetos ainda em construção.", "Distinguish observed flows, installed capacity and projects still under construction."), nome: tx("Transmissão", "Transmission"), numero: "02",
      titulo: tx("A rede conecta a geração às regiões.", "The grid connects generation to the regions."),
      texto: tx("Linhas e subestações transportam energia em alta tensão. O ONS coordena a operação do sistema interligado, considerando recursos, demanda e restrições da rede.", "Lines and substations carry energy at high voltage. The ONS coordinates the operation of the interconnected system, considering resources, demand and grid constraints."),
      conceito: tx("Um intercâmbio medido não revela, sozinho, a capacidade disponível ou o congestionamento da rede.", "A measured interchange does not reveal, by itself, the available capacity or grid congestion."),
      href: "/setor-eletrico/rede", link: tx("Explorar a rede e os intercâmbios", "Explore the grid and the interchanges"),
      detalhe: "/setor-eletrico/expansao", detalheNome: tx("Expansão da infraestrutura", "Infrastructure expansion"),
      pergunta: tx("Como a energia circula entre regiões?", "How does energy flow between regions?"),
    },
    {
      id: "distribuicao", encontra: tx("Duração e frequência das interrupções; perdas por distribuidora.", "Duration and frequency of interruptions; losses by distribution utility."), recorte: tx("Compare DEC em horas e FEC em ocorrências no mesmo ano, com os limites aplicáveis.", "Compare DEC in hours and FEC in occurrences in the same year, with the applicable limits."), nome: tx("Distribuição", "Distribution"), numero: "03",
      titulo: tx("O sistema chega à escala da sua rua.", "The system reaches the scale of your street."),
      texto: tx("A rede de distribuição leva energia aos consumidores conectados a ela. Tarifas, interrupções e perdas ajudam a comparar diferentes dimensões do serviço de cada distribuidora.", "The distribution grid carries energy to the consumers connected to it. Tariffs, interruptions and losses help compare different dimensions of each distribution utility's service."),
      conceito: tx("Perdas totais incluem parcelas técnicas e não técnicas. Perda não técnica não é sinônimo de furto.", "Total losses include technical and non-technical portions. A non-technical loss is not a synonym for theft."),
      href: "/setor-eletrico/qualidade", link: tx("Comparar a qualidade do serviço", "Compare the quality of supply"),
      detalhe: "/setor-eletrico/perdas", detalheNome: tx("Perdas por distribuidora", "Losses by distribution utility"),
      pergunta: tx("Quanto tempo e quantas vezes falta luz?", "How long and how often is there a power outage?"),
    },
    {
      id: "consumo", encontra: tx("Componentes da conta, simulação de consumo e Tarifa Social.", "Components of the bill, consumption simulation and the Tarifa Social."), recorte: tx("A simulação depende do consumo e da tarifa selecionados; não substitui a fatura real.", "The simulation depends on the consumption and tariff selected; it does not replace the actual bill."), nome: tx("Consumo", "Consumption"), numero: "04",
      titulo: tx("Na tomada, energia. Na conta, várias parcelas.", "At the socket, energy. On the bill, several components."),
      texto: tx("Casas, comércio e indústria usam eletricidade. O valor da conta depende do consumo e das regras aplicáveis: tarifa, tributos, bandeiras e outros componentes.", "Homes, shops and industry use electricity. The amount of the bill depends on consumption and on the applicable rules: tariff, taxes, tariff flags and other components."),
      conceito: tx("PLD é o preço das diferenças no mercado de curto prazo. Não é a tarifa residencial.", "The PLD is the price of the differences in the short-term market. It is not the residential tariff."),
      href: "/setor-eletrico/conta-de-luz", link: tx("Entender cada parcela da conta", "Understand each component of the bill"),
      detalhe: "/setor-eletrico/inclusao-energetica", detalheNome: tx("Acesso e Tarifa Social", "Access and Tarifa Social"),
      pergunta: tx("O que compõe a conta de luz?", "What makes up the electricity bill?"),
    },
  ] as const;
}
export const ETAPAS_ENERGIA_IDIOMAS = montarNosDoisIdiomas(montarEtapasEnergia);
export const ETAPAS_ENERGIA = ETAPAS_ENERGIA_IDIOMAS.pt;

