/**
 * Complementos dos verbetes do Aprenda (P065): a unidade em que cada grandeza aparece e
 * os pares que o leitor costuma confundir.
 *
 * Regra: nada aqui acrescenta definição. Cada contraste é escrito só com o que os dois
 * verbetes conferidos já dizem (frase, como é medido e limitações) e só liga verbetes
 * CONFERIDOS; verbete em preparação não entra, porque um contraste também define. Quando
 * o termo confundido não é verbete (família, município), ele entra pelo rótulo.
 */
import { CONCEITOS, conceito } from "./conceitos";

/** Unidade em que a grandeza é publicada e lida no observatório; ausente quando o verbete não é grandeza. */
export const UNIDADE: Record<string, string> = {
  pld: "R$/MWh, por hora e submercado",
  mcp: "MWh (balanço) e R$ (resultado), por submercado e período de comercialização",
  cmo: "R$/MWh, por subsistema; por patamar de carga na versão semanal",
  cvu: "R$/MWh, por usina e semana operativa",
  ear: "MWmês ou percentual da EAR máxima",
  armazenamento: "MWmês",
  ena: "energia (MWmês, segundo o dicionário do ONS) ou percentual da MLT",
  carga: "MWmed, por subsistema e dia",
  "geracao-centralizada": "MWmed, por hora e subsistema",
  "geracao-distribuida": "kW de potência instalada (ANEEL); MWmed da parcela da carga (ONS)",
  intercambio: "MWmed, por hora e fronteira",
  "intercambio-internacional": "MWmed, por hora e país; positivo é exportação",
  acl: "MW médios (consumo contabilizado pela CCEE) ou MWh (consumo na rede, EPE)",
  acr: "MW médios (consumo contabilizado pela CCEE) ou MWh (consumo cativo na rede, EPE)",
  ess: "R$, por mês de competência",
  "garantia-fisica": "MW médios",
  gsf: "percentual, por mês (geração em MWmédios dividida pela garantia física em MWmédios)",
  "constrained-off": "GWh de energia não gerada estimada, % da geração possível estimada (taxa) e MW de corte simultâneo",
  imerg: "mm de precipitação por dia",
  "merra-2": "°C (temperatura do ar a 2 metros)",
  "curva-de-carga": "MWmed, por hora e subsistema",
  "carga-global": "MWmed, por meia hora e área de carga",
  "carga-liquida-de-mmgd": "MWmed, por meia hora",
  atls: "percentual do tempo de observação",
  "tarifa-te-tusd": "R$/MWh no conjunto da ANEEL; dividido por 1000, R$/kWh",
  "bandeira-tarifaria": "R$ por kWh consumido (publicado em R$/MWh)",
  "custo-de-disponibilidade": "kWh equivalentes (30, 50 ou 100) multiplicados pela tarifa, em R$",
  cde: "R$ (orçamento anual); R$/MWh nas componentes da tarifa",
  "perdas-de-energia": "MWh e percentual da energia injetada",
  "perdas-tecnicas": "percentual da energia injetada (estimado por modelo)",
  "perdas-nao-tecnicas": "percentual do mercado de baixa tensão medido",
  "percentual-regulatorio-de-perdas": "percentual",
  dec: "horas e centésimos de hora por unidade consumidora",
  fec: "interrupções por unidade consumidora",
  "compensacao-continuidade": "R$ e quantidade de compensações",
  "tarifa-social": "unidades consumidoras e faturas, nunca famílias",
  "fator-de-emissao": "tCO2/MWh",
  "limites-do-pld": "R$/MWh, por ano civil",
};

export type Contraste = {
  a: string;
  /** Outro verbete (slug) ou um termo que não é verbete, pelo rótulo. */
  b: string | { rotulo: string };
  texto: string;
};

export const CONTRASTES: Contraste[] = [
  {
    a: "pld",
    b: "cmo",
    texto:
      "O CMO é o custo de atender uma unidade a mais de carga, estimado pelos modelos do ONS por subsistema. O PLD parte do CMO, mas não é o CMO: é calculado pela CCEE por hora e submercado e aplica os limites regulatórios.",
  },
  {
    a: "pld",
    b: "tarifa-te-tusd",
    texto:
      "O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora segue a TE e a TUSD, que a ANEEL homologa nos processos tarifários, mais bandeira e tributos.",
  },
  {
    a: "limites-do-pld",
    b: "pld",
    texto:
      "Os limites são o piso e os dois tetos que a ANEEL fixa a cada ano; o PLD é o preço calculado dentro deles. Os limites são nominais: comparar anos exige deflator.",
  },
  {
    a: "mcp",
    b: "acl",
    texto:
      "O ACL é o segmento dos contratos bilaterais livremente negociados; o MCP é onde a CCEE apura, ao PLD, o balanço de cada perfil de agente. O preço de um contrato do ACL é privado e não é o PLD.",
  },
  {
    a: "acl",
    b: "acr",
    texto:
      "No ACR, agentes vendedores e distribuidoras negociam por licitação; no ACL, os contratos são bilaterais e livremente negociados. Nos painéis, cada ambiente aparece em dois universos (consumo contabilizado pela CCEE e consumo na rede da EPE), que não se misturam.",
  },
  {
    a: "submercado",
    b: "sin",
    texto:
      "O SIN é o sistema interligado inteiro; submercado é cada uma das quatro divisões dele com PLD próprio. Um valor do SIN é soma ou razão de somas dos subsistemas, conforme a regra de cada indicador.",
  },
  {
    a: "ear",
    b: "ena",
    texto:
      "A EAR é a energia associada à água já guardada nos reservatórios; a ENA é a energia que as vazões naturais que chegam permitiriam produzir. Uma ENA acima da MLT não diz, sozinha, quanto há guardado.",
  },
  {
    a: "ear",
    b: "armazenamento",
    texto:
      "A EAR é quanto está guardado; a EAR máxima é quanto caberia com todos os reservatórios cheios. O percentual da EAR é a razão entre as duas, e o denominador muda quando entram reservatórios.",
  },
  {
    a: "ena",
    b: "mlt",
    texto:
      "A ENA é o valor do período; a MLT é a referência com que o ONS a publica em percentual. O conjunto não informa o período de referência da MLT; por isso, nos painéis, \"acima do usual\" vem da distribuição histórica, não da MLT.",
  },
  {
    a: "carga",
    b: "geracao-centralizada",
    texto:
      "A carga é a energia atendida; a geração centralizada é a energia produzida pelas usinas no balanço do ONS. Em cada subsistema, geração menos carga deveria corresponder ao intercâmbio; o balanço da Rede mostra as horas em que não corresponde.",
  },
  {
    a: "carga",
    b: "curva-de-carga",
    texto:
      "São o mesmo produto do ONS em grãos diferentes: a média das 24 horas da curva reproduz a carga do dia. A curva mostra o perfil hora a hora; a carga diária, não.",
  },
  {
    a: "carga-global",
    b: "carga-liquida-de-mmgd",
    texto:
      "A carga global inclui a parcela atendida por micro e minigeração distribuída; a carga líquida de MMGD é a carga global sem essa parcela. Nos dados publicados, a líquida mais a parcela de MMGD dá a global em todas as meias horas conferidas.",
  },
  {
    a: "carga-global",
    b: "curva-de-carga",
    texto:
      "São grandezas diferentes: a carga global, por meia hora e área de carga, fica acima da curva de carga horária nas mesmas horas. Por isso a carga líquida de MMGD não se obtém subtraindo a MMGD da curva.",
  },
  {
    a: "geracao-distribuida",
    b: "geracao-centralizada",
    texto:
      "A MMGD se liga à rede de distribuição pelas instalações de unidades consumidoras e é publicada como potência instalada (ANEEL) e como parcela estimada da carga (ONS); a geração centralizada é verificada hora a hora nas usinas do balanço do ONS. Potência instalada não é energia gerada.",
  },
  {
    a: "intercambio",
    b: "intercambio-internacional",
    texto:
      "O intercâmbio é o fluxo entre subsistemas do SIN; o internacional é o fluxo entre o SIN e um país vizinho, publicado em outro conjunto. Itaipu entra como geração de uma usina, não como intercâmbio com o Paraguai.",
  },
  {
    a: "intercambio",
    b: "atls",
    texto:
      "O intercâmbio é o fluxo medido; o ATLS diz em que parte do tempo fluxos selecionados ficaram dentro das faixas de segurança. Nenhum dos dois conjuntos publica o valor do limite.",
  },
  {
    a: "decomp",
    b: "dessem",
    texto: "Os dois estimam o CMO publicado pelo ONS: o DECOMP por semana operativa, subsistema e patamar de carga; o DESSEM por meia hora e por barra.",
  },
  {
    a: "newave",
    b: "decomp",
    texto:
      "Os dois são citados pela CCEE no cálculo do PLD. O DECOMP tem saída publicada pelo ONS e usada aqui (o CMO semanal); a descrição técnica do NEWAVE não foi conferida, e o observatório não publica saída dele.",
  },
  {
    a: "cvu",
    b: "cmo",
    texto:
      "O CVU é um valor de cada usina térmica, considerado no Programa Mensal da Operação e nos modelos; o CMO é o custo de atender uma unidade a mais de carga, por subsistema. O CVU de uma usina não é o CMO nem o PLD.",
  },
  {
    a: "mre",
    b: "garantia-fisica",
    texto:
      "A garantia física é a quantidade máxima de energia de cada empreendimento que pode lastrear contratos; o MRE é o mecanismo pelo qual as hidrelétricas compartilham o risco hidrológico. No observatório, a geração das usinas do MRE dividida pela garantia física modulada é o GSF.",
  },
  {
    a: "garantia-fisica",
    b: "geracao-centralizada",
    texto: "Garantia física não é geração: a usina pode gerar mais ou menos que ela em cada mês.",
  },
  {
    a: "gsf",
    b: "garantia-fisica",
    texto:
      "A garantia física é o teto de energia de cada empreendimento; o GSF é a razão entre o que as usinas do MRE geraram no mês e a garantia física delas, no conjunto. Um GSF de 80,51% não diz que a garantia física caiu: diz que a geração do mês ficou abaixo dela.",
  },
  {
    a: "mre",
    b: "gsf",
    texto:
      "O MRE é o mecanismo pelo qual as hidrelétricas compartilham o risco hidrológico; o GSF é o número mensal que compara a geração delas com a garantia física. Falar em MRE é falar das regras do mecanismo, falar em GSF é falar da razão do mês.",
  },
  {
    a: "ree",
    b: "ear",
    texto:
      "A EAR é a energia associada à água armazenada; o REE é um dos recortes em que o ONS a publica, ao lado do subsistema, da bacia e do reservatório. Cada recorte tem o próprio perímetro e a própria EAR máxima.",
  },
  {
    a: "ree",
    b: { rotulo: "subsistema" },
    texto:
      "A topologia descrita pela EPE tem 4 subsistemas interligados e 12 REE: são recortes diferentes, e o REE agrega as usinas hidrelétricas de acordo com a bacia hidrográfica.",
  },
  {
    a: "constrained-off",
    b: "geracao-centralizada",
    texto:
      "A geração verificada é o que as usinas entregaram no balanço do ONS; o constrained-off é a energia que a usina deixou de gerar por comando do ONS, estimada contra uma geração de referência, só nas meias horas em que a usina foi limitada. É energia que a geração verificada não contém.",
  },
  {
    a: "constrained-off",
    b: { rotulo: "falta de vento" },
    texto:
      "O evento decorre de comando do ONS e se origina fora das instalações da usina. Um dia sem vento reduz a geração sem comando do ONS e não é constrained-off.",
  },
  {
    a: "imerg",
    b: "merra-2",
    texto: "O IMERG estima chuva com satélites; a MERRA-2 é uma reanálise de modelo, usada aqui para a temperatura. Nenhum dos dois é medição de estação.",
  },
  {
    a: "tarifa-te-tusd",
    b: "bandeira-tarifaria",
    texto:
      "A TE e a TUSD são homologadas para cada distribuidora nos processos tarifários; a bandeira é um acréscimo por kWh consumido, conforme o patamar acionado no mês, e não se aplica aos sistemas isolados.",
  },
  {
    a: "custo-de-disponibilidade",
    b: "tarifa-te-tusd",
    texto: "O custo de disponibilidade não é outra tarifa: é uma quantidade mínima em kWh equivalentes (30, 50 ou 100, conforme a ligação) multiplicada pela TE e pela TUSD da classe.",
  },
  {
    a: "cde",
    b: "tarifa-social",
    texto:
      "A Tarifa Social é a política de desconto na fatura; a CDE é o fundo setorial que a custeia, arrecadado principalmente por quotas incluídas nas tarifas de uso da rede.",
  },
  {
    a: "ess",
    b: "cde",
    texto:
      "O ESS é um encargo das regras de comercialização para os custos dos serviços do sistema; a CDE é um fundo setorial com orçamento anual aprovado pela ANEEL para políticas públicas. São bases diferentes, e o observatório não as soma.",
  },
  {
    a: "ess",
    b: "pld",
    texto: "O ESS é encargo, em reais por mês de competência; o PLD é preço, em R$/MWh por hora. Valor de competência do ESS não é valor pago no mês.",
  },
  {
    a: "perdas-tecnicas",
    b: "perdas-nao-tecnicas",
    texto:
      "As técnicas vêm da física do transporte (aquecimento dos condutores, núcleos dos transformadores) e são estimadas por modelo; as não técnicas são a diferença entre as totais e as técnicas e incluem furto, fraude e erros de medição e de faturamento.",
  },
  {
    a: "perdas-de-energia",
    b: "percentual-regulatorio-de-perdas",
    texto:
      "As perdas de energia são o realizado, calculado pela ANEEL no SAMP; o percentual regulatório é o nível que a ANEEL reconhece na tarifa de cada concessionária. Parâmetro regulatório não é perda realizada.",
  },
  {
    a: "dec",
    b: "fec",
    texto: "O DEC mede duração, em horas; o FEC mede frequência, em número de interrupções. Os dois são médias por unidade consumidora do conjunto.",
  },
  {
    a: "compensacao-continuidade",
    b: "dec",
    texto:
      "A compensação depende dos indicadores individuais de cada unidade (DIC, FIC e outros), que não são publicados; não se calcula a partir do DEC do conjunto.",
  },
  {
    a: "conjunto-eletrico",
    b: { rotulo: "município" },
    texto:
      "O conjunto é uma subdivisão da área da distribuidora, em geral formada por uma ou mais subestações de distribuição. Num mapa municipal de DEC por atribuição de conjunto, o valor é o do conjunto inteiro, não uma medição no município.",
  },
  {
    a: "tarifa-social",
    b: { rotulo: "família" },
    texto: "O alcance é contado em unidades consumidoras e faturas, nunca em famílias: uma família pode não ser titular da conta da casa em que mora.",
  },
  {
    a: "fator-de-emissao",
    b: { rotulo: "fator marginal" },
    texto:
      "O fator médio considera todas as usinas que estão gerando; a margem de operação, que o MCTI publica para o MDL, considera a energia despachada na margem. O fator médio não mede o efeito de consumir ou economizar um MWh a mais.",
  },
  {
    a: "agenda-regulatoria",
    b: { rotulo: "norma publicada" },
    texto: "A agenda lista atividades com previsão de edição de norma no biênio. Estar na agenda não é ter norma editada.",
  },
];

/**
 * Exemplo sintético do verbete quando nenhum painel publica o número correspondente: conta
 * com valores hipotéticos, exibida com o rótulo permanente de exemplo sintético.
 */
export const EXEMPLO_SINTETICO: Record<string, string> = {
  "custo-de-disponibilidade":
    "Uma unidade residencial monofásica com microgeração injetou na rede, num mês, mais energia do que consumiu. Mesmo assim, deve o custo de disponibilidade: 30 kWh multiplicados pela tarifa da classe. Com uma tarifa hipotética de R$ 0,80/kWh (TE mais TUSD, sem tributos), seriam R$ 24,00 no mês.",
};

export type ContrasteDoVerbete = { com: string; rotulo: string; href: string | null; texto: string };

/** Contrastes em que o verbete aparece, de qualquer lado do par. */
export function contrastesDe(slug: string): ContrasteDoVerbete[] {
  const out: ContrasteDoVerbete[] = [];
  for (const c of CONTRASTES) {
    const outro = c.a === slug ? c.b : c.b === slug ? c.a : null;
    if (outro === null) continue;
    if (typeof outro === "string") {
      const v = conceito(outro);
      if (!v) continue;
      out.push({ com: outro, rotulo: v.sigla ? `${v.sigla} (${v.nome})` : v.nome, href: `/setor-eletrico/aprenda/${outro}`, texto: c.texto });
    } else {
      out.push({ com: outro.rotulo, rotulo: outro.rotulo, href: null, texto: c.texto });
    }
  }
  return out;
}

/** Verbetes conferidos sem nenhum contraste (deve ser vazio; conferido em teste). */
export function conferidosSemContraste(): string[] {
  return CONCEITOS.filter((c) => c.estado === "CONFERIDO" && contrastesDe(c.slug).length === 0).map((c) => c.slug);
}
