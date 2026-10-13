/** Percurso didático; não é a topologia ou a sequência de despacho do SIN. */
export const ETAPAS_ENERGIA = [
  {
    id: "geracao", encontra: "Fontes de geração, capacidade instalada e reservatórios.", recorte: "Compare potência em MW, produção em MWh e armazenamento em %; cada medida tem seu período e universo.", nome: "Geração", numero: "01",
    titulo: "Fontes diferentes. Um sistema conectado.",
    texto: "Água, vento, sol e combustíveis são transformados em eletricidade. A participação de cada fonte muda com o período, os recursos disponíveis e a operação do sistema.",
    conceito: "Potência instalada é capacidade. Energia gerada é produção ao longo do tempo.",
    href: "/setor-eletrico/geracao", link: "Explorar as fontes de geração",
    detalhe: "/setor-eletrico/agua-e-clima", detalheNome: "Reservatórios e afluências",
    pergunta: "De onde vem a eletricidade?",
  },
  {
    id: "transmissao", encontra: "Intercâmbios entre subsistemas e expansão da infraestrutura.", recorte: "Distinga fluxos observados, capacidade instalada e projetos ainda em construção.", nome: "Transmissão", numero: "02",
    titulo: "A rede conecta a geração às regiões.",
    texto: "Linhas e subestações transportam energia em alta tensão. O ONS coordena a operação do sistema interligado, considerando recursos, demanda e restrições da rede.",
    conceito: "Um intercâmbio medido não revela, sozinho, a capacidade disponível ou o congestionamento da rede.",
    href: "/setor-eletrico/rede", link: "Explorar a rede e os intercâmbios",
    detalhe: "/setor-eletrico/expansao", detalheNome: "Expansão da infraestrutura",
    pergunta: "Como a energia circula entre regiões?",
  },
  {
    id: "distribuicao", encontra: "Duração e frequência das interrupções; perdas por distribuidora.", recorte: "Compare DEC em horas e FEC em ocorrências no mesmo ano, com os limites aplicáveis.", nome: "Distribuição", numero: "03",
    titulo: "O sistema chega à escala da sua rua.",
    texto: "A rede de distribuição leva energia aos consumidores conectados a ela. Tarifas, interrupções e perdas ajudam a comparar diferentes dimensões do serviço de cada distribuidora.",
    conceito: "Perdas totais incluem parcelas técnicas e não técnicas. Perda não técnica não é sinônimo de furto.",
    href: "/setor-eletrico/qualidade", link: "Comparar a qualidade do serviço",
    detalhe: "/setor-eletrico/perdas", detalheNome: "Perdas por distribuidora",
    pergunta: "Quanto tempo e quantas vezes falta luz?",
  },
  {
    id: "consumo", encontra: "Componentes da conta, simulação de consumo e Tarifa Social.", recorte: "A simulação depende do consumo e da tarifa selecionados; não substitui a fatura real.", nome: "Consumo", numero: "04",
    titulo: "Na tomada, energia. Na conta, várias parcelas.",
    texto: "Casas, comércio e indústria usam eletricidade. O valor da conta depende do consumo e das regras aplicáveis: tarifa, tributos, bandeiras e outros componentes.",
    conceito: "PLD é o preço das diferenças no mercado de curto prazo. Não é a tarifa residencial.",
    href: "/setor-eletrico/conta-de-luz", link: "Entender cada parcela da conta",
    detalhe: "/setor-eletrico/inclusao-energetica", detalheNome: "Acesso e Tarifa Social",
    pergunta: "O que compõe a conta de luz?",
  },
] as const;

