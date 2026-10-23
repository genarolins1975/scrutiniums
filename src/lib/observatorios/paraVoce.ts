/**
 * "Para você" (Onda 2 da banca de 19/10/2026): em cada entrada, as duas ou três perguntas de maior
 * valor para o cidadão sobre o próprio caso (minha conta, minha cidade, meu estado, minha capital),
 * cada uma com destino real a um clique, a resposta curta e, quando o destino mostra um número, esse
 * número lido da mesma base do destino, com fonte e período. Nada é escrito à mão: os leitores são os
 * mesmos da camada aberta (src/lib/perguntas/portas.ts), da inicial do Setor Elétrico
 * (src/lib/energia/home-sinais.ts), da entrada do Saneamento (src/lib/saneamento/respostas.ts) e da
 * entrada do Território e Clima (src/lib/observatorios/entradas/territorio.ts). Quando a leitura falha, o
 * número fica ausente e o cartão diz isso; ausência nunca vira zero.
 *
 * Quando o destino é uma busca, um simulador ou uma exploração que só mostra números depois da escolha
 * do leitor, o cartão não traz número e a pergunta declara o motivo em `semNumero`.
 *
 * O teste para-voce.test.ts reprova entrada sem o bloco, destino que não existe em src/app, número sem
 * fonte ou período e link fechado sem o selo "com conta" numa entrada aberta.
 */
import type { Idioma } from "@/lib/idioma";
import { tx } from "@/lib/energia/idioma";
import { sinalConta, sinalQualidade, sinalTarifaSocial, type SinalHome } from "@/lib/energia/home-sinais";
import {
  CONSULTAS,
  numeroAtrasoFamilias,
  numeroBotijao,
  numeroComidaEmCasa,
  numeroCustoDeVida,
  numeroEstadosDivida,
  numeroIdebCapitais,
  numeroInss,
  numeroDividaCem,
  numeroEducacaoMunicipios,
  numeroSaudeCapitais,
} from "@/lib/perguntas/portas";
import { lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { respostasDosCapitulos } from "@/lib/saneamento/respostas";
import { periodoConsultaTarifas } from "@/lib/saneamento/tarifas";
import { desastres, focos } from "@/lib/observatorios/entradas/territorio";
import { goldJuros, resolverConsulta, rotuloModalidade } from "@/lib/credito/juros";
import { dadosDoEstado, goldCombustiveis } from "@/lib/combustiveis/dados";
import { dadosBotijaoNoEstado } from "@/lib/gas/botijaoNoEstado";
import { goldGas } from "@/lib/gas/gold";
import { goldSeguranca, indicador, pacoteEstados, ultimoIndice } from "@/lib/eficiencia/seguranca/dados";
import { recorte, snapshot as snapshotEstadual } from "@/lib/contas-estaduais/dados";
import { escalaEstadual } from "@/lib/contas-estaduais/entrada";

/** Número do cartão: o mesmo do destino, com a prova ao lado. */
export type NumeroParaVoce = {
  rotulo: string;
  /** Valor formatado; null quando a base não pôde ser lida nesta publicação. */
  valor: string | null;
  unidade: string;
  periodo: string;
  fonte: string;
  nota?: string;
  /** Página de onde o número vem: é o próprio destino da pergunta (o teste confere). */
  origem: string;
};

export type PerguntaParaVoce = {
  id: IdPergunta | IdPerguntaMapa;
  pergunta: string;
  /** A resposta curta: o que o leitor encontra sobre o caso dele, em uma frase. */
  resposta: string;
  href: string;
  numero: NumeroParaVoce | null;
  /** Por que o cartão não traz número; obrigatório quando `numero` é null. */
  semNumero?: string;
};

const IDS = [
  "luz",
  "falta-luz",
  "tarifa-social-luz",
  "botijao",
  "gnv",
  "tanque",
  "agua",
  "municipio",
  "tarifa-social-agua",
  "capital",
  "escola",
  "educacao-capital",
  "saude-capital",
  "fogo",
  "desastres",
  "estado-contas",
  "inss",
  "previdencia",
  "metas",
  "comida",
  "custo-de-vida",
  "atlas-agro",
  "credito-atraso",
  "banco-cobra",
  "parcela",
] as const;
export type IdPergunta = (typeof IDS)[number];

/**
 * As perguntas de cada entrada, pela rota da entrada (src/lib/frescor/entradas.ts: as coleções pela rota,
 * os observatórios pelo campo `entrada` do registro). A ordem é a da procura: a consulta pessoal mais
 * pedida primeiro.
 */
export const PARA_VOCE = {
  "/setor-eletrico": ["luz", "falta-luz", "tarifa-social-luz"],
  "/gas-natural": ["botijao", "gnv"],
  "/saneamento": ["municipio", "agua", "tarifa-social-agua"],
  "/eficiencia-estatal": ["educacao-capital", "saude-capital", "municipio"],
  // o INSS na cidade do leitor (painel Previdência e INSS, 20/10/2026) abre o bloco; as metas continuam a um clique na
  // navegação dos painéis e no índice dos capítulos
  "/contas-publicas": ["inss", "estado-contas", "previdencia"],
  "/agronegocio": ["comida", "atlas-agro"],
  // as coleções de um painel só (Iniciativa 4 do parecer de UX, 22/10/2026): a consulta da própria página vem embutida no
  // bloco; os cartões levam às perguntas vizinhas do mesmo bolso (preço do que se compra, serviço da cidade), nunca à própria página
  "/combustiveis": ["gnv", "botijao", "luz"],
  "/conectividade": ["capital", "luz", "municipio"],
  "/educacao-municipal": ["educacao-capital", "capital"],
  "/custo-de-vida": ["comida", "botijao", "luz"],
  "/contas-publicas/previdencia": ["estado-contas", "custo-de-vida"],
  // Contas Estaduais (Iniciativa 4): as bandeiras do estado vêm embutidas no bloco; os cartões levam ao gasto federal por área e à capital
  "/contas-publicas-estaduais": ["previdencia", "capital"],
  // Crédito (Iniciativa 4): a taxa do seu banco, os atrasos das famílias e o simulador da parcela, os três na mesma grade (o
  // simulador vinha embutido embaixo dos cartões e saiu para a entrada caber no orçamento de comprimento, 22/10/2026)
  "/observatorio-do-credito": ["banco-cobra", "credito-atraso", "parcela"],
  // o custo de vida (painel novo das Famílias, 20/10/2026) abre o bloco; a água saiu para manter três perguntas e continua a
  // um clique em "Para o seu caso" da camada aberta das Famílias e no elo "Gás, luz e água" do orçamento da família
  "/observatorios/familias": ["custo-de-vida", "luz", "botijao"],
  // a escola pública da cidade do leitor (painel Educação nos municípios, 20/10/2026) abre o bloco; a educação das capitais
  // continua a um clique, na coleção Educação e no "Para você" da Eficiência Estatal
  "/observatorios/servicos-publicos": ["escola", "capital", "saude-capital"],
  "/territorio": ["fogo", "desastres"],
  "/observatorios/contas-publicas": ["inss", "estado-contas", "previdencia"],
  // o botijão saiu daqui em 19/10/2026 para dar lugar ao tanque (painel novo): continua a um clique no elo "Chegar à casa"
  // da cadeia do gás, logo abaixo, e no "Para você" das Famílias; assim ficam uma pergunta por serviço (luz, combustível, água)
  "/observatorios/energia-e-infraestrutura": ["luz", "tanque", "municipio"],
  "/observatorios/economia": ["banco-cobra", "credito-atraso", "comida"],
} as const satisfies Record<string, readonly IdPergunta[]>;

export type EntradaParaVoce = keyof typeof PARA_VOCE;

/** A rota é de uma entrada com bloco "Para você"? */
export function ehEntradaParaVoce(rota: string): rota is EntradaParaVoce {
  return Object.prototype.hasOwnProperty.call(PARA_VOCE, rota);
}

/* ------------------------------------------------------------------ números */

/** Número da camada aberta (NumeroPorta) no formato do cartão. */
function daPorta(n: NumeroPorta): NumeroParaVoce {
  return { rotulo: n.rotulo, valor: n.valor, unidade: n.unidade, periodo: n.periodo, fonte: n.fonte, nota: n.nota, origem: n.href };
}

/** Número da inicial do Setor Elétrico (bilíngue) no formato do cartão; a fonte vem da página que o publica. */
function doSinal(s: SinalHome, fonte: string, origem: string, idioma: Idioma): NumeroParaVoce {
  if (s.estado !== "disponivel") {
    return { rotulo: s.medida, valor: null, unidade: "", periodo: s.periodo ?? tx("indisponível nesta publicação", "unavailable in this publication", idioma), fonte, nota: s.motivo, origem };
  }
  return { rotulo: s.medida, valor: s.valorTexto, unidade: s.unidade, periodo: s.periodo, fonte, origem: s.endereco.split("#")[0] || origem };
}

/** Preço médio do GNV no Brasil, do mesmo arquivo da página de GNV e gás encanado. */
const numeroGnv = (): NumeroPorta =>
  numero(
    { rotulo: "Preço médio do GNV", unidade: "por m³", fonte: "ANP, Levantamento de Preços de Combustíveis", href: "/gas-natural/gnv-e-gas-encanado" },
    () => {
      const m = lerPublico("gas", "gold", "gnv-e-gas-encanado.json").indicadores.medio_mes;
      return { valor: `R$ ${num(m.valor, 2)}`, periodo: mesAno(m.periodo), nota: "Média dos postos pesquisados no mês, Brasil." };
    },
  );

/** Preço médio da gasolina comum no Brasil, do mesmo arquivo do painel de combustíveis. */
const numeroTanque = (): NumeroPorta =>
  numero(
    { rotulo: "Preço médio do litro de gasolina comum", unidade: "por litro", fonte: "ANP, Levantamento de Preços de Combustíveis", href: "/combustiveis" },
    () => {
      const g = lerPublico("gas", "gold", "combustiveis.json").indicadores;
      const p = g.gasolina_medio_mes;
      const n = g.gasolina_postos_mes;
      if (typeof p?.valor !== "number") throw new Error("combustiveis.gasolina_medio_mes ausente");
      return { valor: `R$ ${num(p.valor, 2)}`, periodo: mesAno(p.periodo), nota: `Média Brasil de ${num(n.valor, 0)} postos pesquisados no mês.` };
    },
  );

/** Taxa mediana da modalidade que a consulta "Quanto meu banco cobra?" abre sem escolha (o mesmo juros.json do destino). */
function numeroBancoCobra(): NumeroParaVoce {
  const origem = "/observatorio-do-credito/quanto-meu-banco-cobra";
  const fonte = "Banco Central, taxas de juros das operações contratadas por instituição";
  const data = (iso: string) => iso.split("-").reverse().join("/");
  try {
    const gold = goldJuros();
    if (!gold) throw new Error("juros.json ausente");
    const { modalidade } = resolverConsulta(gold, {});
    return {
      rotulo: `Taxa mediana entre ${modalidade.stats.n} instituições: ${rotuloModalidade(modalidade.modalidade).toLowerCase()}, pessoa física`,
      valor: `${num(modalidade.stats.mediana, 2)}%`,
      unidade: "ao ano",
      periodo: `${data(modalidade.janela.inicio)} a ${data(modalidade.janela.fim)}`,
      fonte,
      nota: "Taxa média das operações contratadas; não é o custo efetivo total (CET).",
      origem,
    };
  } catch {
    return { rotulo: "Taxa mediana das instituições", valor: null, unidade: "", periodo: "indisponível nesta publicação", fonte, origem };
  }
}

/** As respostas dos capítulos do Saneamento, lidas uma vez por processo (o build gera várias entradas). */
let respostasSaneamento: ReturnType<typeof respostasDosCapitulos> | null = null;
const respostas = () => (respostasSaneamento ??= respostasDosCapitulos());

/** A conta de água com 10 m³ nas tabelas verificadas: a resposta do capítulo 5, que o simulador calcula. */
const numeroContaAgua = (): NumeroPorta =>
  numero(
    { rotulo: "Conta residencial de água e esgoto com 10 m³ por mês", unidade: "por mês", fonte: "Atos tarifários dos reguladores", href: "/saneamento/preco-regulado/simulador" },
    () => {
      const r = respostas()[5];
      if (!r) throw new Error("sem tabelas verificadas");
      return { valor: r.valor, periodo: `tabelas vigentes nas consultas de ${periodoConsultaTarifas()}`, nota: "Faixa entre as tabelas verificadas; atos e vigências diferem. Não inclui o perfil completo de um imóvel." };
    },
  );

/** Municípios com tarifa social de água declarada: a resposta do capítulo 6, a mesma da página de tarifa social. */
const numeroTarifaSocialAgua = (): NumeroPorta =>
  numero(
    { rotulo: "Municípios com tarifa social de água declarada", unidade: "municípios", fonte: "Ministério das Cidades, SINISA, declarado pelos prestadores", href: "/saneamento/tarifa-social" },
    () => {
      const r = respostas()[6];
      const ano = r?.fonte.match(/\b\d{4}\b/)?.[0];
      if (!r || !ano) throw new Error("sem resposta do capítulo 6");
      return { valor: r.valor, periodo: ano, nota: "O SINISA conta economias com tarifa social, não famílias beneficiadas." };
    },
  );

/* ---------------------------------------------------------------- perguntas */

function pergunta(id: IdPergunta, idioma: Idioma): PerguntaParaVoce {
  const t = (pt: string, en: string) => tx(pt, en, idioma);
  switch (id) {
    case "luz":
      return {
        id,
        pergunta: t(CONSULTAS.luz.pergunta, "How much is my electricity bill?"),
        resposta: t(
          "Escolha a sua distribuidora: a tarifa dela, do que ela é feita e a conta estimada para o seu consumo, antes dos tributos.",
          "Choose your distribution utility: its tariff, what it is made of and the estimated bill for your consumption, before taxes.",
        ),
        href: CONSULTAS.luz.href,
        numero: doSinal(sinalConta(), t("ANEEL, tarifas homologadas", "ANEEL, approved tariffs"), CONSULTAS.luz.href, idioma),
      };
    case "falta-luz":
      return {
        id,
        pergunta: t("Quanto tempo a luz falta na minha região?", "How long does the power go out where I live?"),
        resposta: t(
          "A duração e a frequência das interrupções de cada distribuidora, ano a ano, com a média do país.",
          "The duration and frequency of interruptions at each distribution utility, year by year, with the national average.",
        ),
        href: "/setor-eletrico/qualidade",
        numero: doSinal(sinalQualidade(), t("ANEEL, indicadores de continuidade", "ANEEL, continuity indicators"), "/setor-eletrico/qualidade", idioma),
      };
    case "tarifa-social-luz":
      return {
        id,
        pergunta: t("Quem tem desconto na conta de luz?", "Who gets a discount on the electricity bill?"),
        resposta: t(
          "A Tarifa Social: quem tem direito, quantas unidades consumidoras recebem o desconto e como isso varia entre as distribuidoras.",
          "The Tarifa Social (social electricity tariff): who is entitled, how many consumer units get the discount and how it varies across distribution utilities.",
        ),
        href: "/setor-eletrico/inclusao-energetica/tarifa-social",
        numero: doSinal(sinalTarifaSocial(), t("ANEEL, subvenções informadas pelas distribuidoras", "ANEEL, subsidies reported by distribution utilities"), "/setor-eletrico/inclusao-energetica/tarifa-social", idioma),
      };
    case "botijao":
      return { id, pergunta: CONSULTAS.botijao.pergunta, resposta: CONSULTAS.botijao.resumo, href: CONSULTAS.botijao.href, numero: daPorta(numeroBotijao()) };
    case "gnv":
      return {
        id,
        pergunta: "Quanto custa o GNV no meu estado?",
        resposta: "O preço do metro cúbico de GNV em cada estado com postos pesquisados pela ANP e a inflação do gás encanado.",
        href: "/gas-natural/gnv-e-gas-encanado",
        numero: daPorta(numeroGnv()),
      };
    case "tanque":
      return {
        id,
        pergunta: "Quanto custa encher o tanque no meu estado?",
        resposta: "O preço médio do litro de gasolina, etanol e diesel no seu estado, a distância para a média do Brasil e a série mês a mês desde 2013.",
        href: "/combustiveis",
        numero: daPorta(numeroTanque()),
      };
    case "agua":
      // o simulador da conta de água saiu da área aberta em 20/10/2026 (princípio do aperitivo); segue nas entradas, com conta
      return {
        id,
        pergunta: "Quanto eu pagaria de água e esgoto?",
        resposta: "A conta do mês calculada com as tabelas verificadas nos atos dos reguladores, numa amostra declarada de prestadores.",
        href: "/saneamento/preco-regulado/simulador",
        numero: daPorta(numeroContaAgua()),
      };
    case "municipio":
      return {
        id,
        pergunta: CONSULTAS.municipio.pergunta,
        resposta: CONSULTAS.municipio.resumo,
        href: CONSULTAS.municipio.href,
        numero: null,
        semNumero: "Busca: os números aparecem na ficha do município escolhido.",
      };
    case "tarifa-social-agua":
      return {
        id,
        pergunta: "A minha cidade tem tarifa social de água?",
        resposta: "Onde os prestadores declaram tarifa social, quantas economias a recebem e quanto ela reduz a conta nas tabelas verificadas.",
        href: "/saneamento/tarifa-social",
        numero: daPorta(numeroTarifaSocialAgua()),
      };
    case "capital":
      return {
        id,
        pergunta: CONSULTAS.capital.pergunta,
        resposta: CONSULTAS.capital.resumo,
        href: CONSULTAS.capital.href,
        numero: null,
        semNumero: "Consulta: o retrato mostra os números da capital escolhida.",
      };
    case "escola":
      return {
        id,
        pergunta: CONSULTAS.escola.pergunta,
        resposta: "O Ideb da rede municipal da sua cidade; com a conta, a série histórica, a aprendizagem e a aprovação, a comparação com o estado e com cidades do mesmo porte e as matrículas.",
        href: CONSULTAS.escola.href,
        numero: daPorta(numeroEducacaoMunicipios()),
      };
    case "educacao-capital":
      return {
        id,
        pergunta: "Como estão as escolas municipais da minha capital?",
        resposta: "Despesa por matrícula, alunos por turma, aprovação, Ideb e Saeb da rede municipal de cada uma das 26 capitais.",
        href: "/eficiencia-estatal/educacao-municipal-capitais",
        numero: daPorta(numeroIdebCapitais()),
      };
    case "saude-capital":
      return {
        id,
        pergunta: "Quanto a prefeitura da minha capital gasta com saúde?",
        resposta: "Despesa por morador, unidades básicas, equipes e internações evitáveis em cada capital.",
        href: "/eficiencia-estatal/saude-capitais",
        numero: daPorta(numeroSaudeCapitais()),
      };
    case "fogo":
      return {
        id,
        pergunta: "Teve fogo perto de mim?",
        resposta: "Focos de calor por estado e por município, o ano em curso contra os mesmos meses do ano anterior e os rankings.",
        href: "/territorio/queimadas",
        numero: daPorta(focos()),
      };
    case "desastres":
      return {
        id,
        pergunta: "O meu município já teve desastre reconhecido?",
        resposta: "Secas, chuvas e deslizamentos com emergência ou calamidade reconhecida pela União desde 2003, por município e por tipo.",
        href: "/territorio/desastres",
        numero: daPorta(desastres()),
      };
    case "estado-contas":
      return {
        id,
        pergunta: "Como estão as contas do meu estado?",
        resposta: "Receitas, despesas, resultado e dívida das 27 unidades da Federação lado a lado, como cada uma declara ao Tesouro.",
        href: "/contas-publicas-estaduais",
        numero: daPorta(numeroEstadosDivida()),
      };
    case "inss":
      return {
        id,
        pergunta: CONSULTAS.inss.pergunta,
        resposta: "Quantos benefícios o INSS pagou na sua cidade e o valor médio; com a conta, os tipos de benefício, os estados e o resultado do Regime Geral.",
        href: CONSULTAS.inss.href,
        numero: daPorta(numeroInss()),
      };
    case "previdencia":
      return {
        id,
        pergunta: "Para onde vai o dinheiro do governo federal?",
        resposta: "Cada R$ 100 pagos por área de governo, como previdência, saúde e educação, com a dívida pública à parte, desde 2000.",
        href: "/contas-publicas/por-area",
        numero: daPorta(numeroDividaCem()),
      };
    case "metas":
      return {
        id,
        pergunta: "O que o governo federal se comprometeu a entregar?",
        resposta: "As metas físicas declaradas no orçamento e o que foi realizado, com unidade e período próprios de cada uma.",
        href: "/contas-publicas/metas",
        numero: null,
        semNumero: "Consulta: a página busca as metas por órgão, produto ou situação.",
      };
    case "comida":
      return {
        id,
        pergunta: "Quanto subiu a comida em casa?",
        resposta: "A inflação dos alimentos no IPCA, os itens da cesta e a segurança alimentar dos domicílios.",
        href: "/agronegocio/prato",
        numero: daPorta(numeroComidaEmCasa()),
      };
    case "custo-de-vida":
      return {
        id,
        pergunta: "Quanto subiu o custo de vida na minha cidade?",
        resposta: "A inflação do IPCA na sua cidade ou região metropolitana, no índice geral e nos nove grupos de despesa, comparada com a do Brasil.",
        href: "/custo-de-vida",
        numero: daPorta(numeroCustoDeVida()),
      };
    case "atlas-agro":
      return {
        id,
        pergunta: "O que o meu estado produz no campo?",
        resposta: "A produção de cada cadeia por estado, o crédito rural por finalidade e quem trabalha no campo, no mapa.",
        href: "/agronegocio/atlas",
        numero: null,
        semNumero: "Exploração: o mapa mostra a cadeia e o estado escolhidos.",
      };
    case "banco-cobra":
      return {
        id,
        pergunta: "Quanto o meu banco cobra de juros?",
        resposta: "A taxa do seu banco na modalidade escolhida, comparada com a mediana das instituições, e a parcela de uma dívida no simulador.",
        href: "/observatorio-do-credito/quanto-meu-banco-cobra",
        numero: numeroBancoCobra(),
      };
    case "parcela":
      return {
        id,
        pergunta: "Quanto vai custar minha parcela?",
        resposta: "Parcela, total pago e juros pela tabela Price, com a taxa publicada para o seu banco ou a do seu contrato, e quanto o CET muda o custo. É cálculo, não previsão nem oferta.",
        href: "/observatorio-do-credito/simulador-da-parcela",
        numero: null,
        semNumero: "Cálculo: a parcela sai do valor, do prazo e da taxa que você escolhe.",
      };
    case "credito-atraso":
      return {
        id,
        pergunta: "As famílias estão atrasando as dívidas?",
        resposta: "Concessões, saldo, juros e atrasos do crédito às famílias por modalidade, com a série histórica.",
        href: "/observatorio/credit",
        numero: daPorta(numeroAtrasoFamilias()),
      };
  }
}

/** As perguntas "Para você" de uma entrada, no idioma da página (inglês só no Setor Elétrico). */
export function paraVoce(entrada: EntradaParaVoce, idioma: Idioma = "pt"): PerguntaParaVoce[] {
  return PARA_VOCE[entrada].map((id) => pergunta(id, idioma));
}

/** Todas as perguntas do catálogo, para os testes. */
export function todasAsPerguntas(): PerguntaParaVoce[] {
  return IDS.map((id) => pergunta(id, "pt"));
}

/* ------------------------------------------------------------- mapa da conta */

/**
 * Decisão 1 da seção 8 do parecer de UX de 23/10/2026, pendente do dono: usar a UF informada no cadastro para mostrar, no mapa
 * da conta, os números do estado do leitor. Enquanto for false, o mapa chama `paraVoceDoMapa(null)`: os quatro cartões do estado
 * saem sem número e sem parâmetro. Ligar é trocar a constante e publicar a linha na política de privacidade ("a UF informada no
 * cadastro escolhe os números do seu estado nas páginas iniciais"); os leitores abaixo já estão prontos e testados.
 */
export const PARA_VOCE_POR_UF = false;

export type IdPerguntaMapa =
  | "tanque-uf" | "botijao-uf" | "violencia-uf" | "contas-uf"
  | "cidade-luz" | "cidade-saneamento" | "cidade-internet" | "cidade-inss" | "cidade-escola" | "cidade-fogo" | "cidade-custo-de-vida";

/** As 27 siglas que as bases por estado publicam (a lista das Contas Estaduais, a mesma do cadastro). */
const UFS = new Set<string>(snapshotEstadual.ufs.map((u) => u.uf));

/** Sigla válida em caixa alta, ou null. */
export function ufValida(uf: string | null | undefined): string | null {
  const u = typeof uf === "string" ? uf.trim().toUpperCase() : "";
  return UFS.has(u) ? u : null;
}

const comUf = (href: string, uf: string | null) => (uf ? `${href}?uf=${uf}` : href);
const indisponivel = (rotulo: string, fonte: string, origem: string): NumeroParaVoce => ({ rotulo, valor: null, unidade: "", periodo: "indisponível nesta publicação", fonte, origem });

/** Gasolina comum na UF, no último mês: o mesmo dadosDoEstado da consulta /combustiveis/no-meu-estado. */
export function numeroTanqueNaUf(uf: string): NumeroParaVoce {
  const origem = comUf("/combustiveis/no-meu-estado", uf);
  const fonte = "ANP, Levantamento de Preços de Combustíveis";
  try {
    const d = dadosDoEstado(goldCombustiveis());
    const linha = d.ufs.find((u) => u.uf === uf);
    const g = linha?.gasolina;
    if (!linha || !g) throw new Error(`sem gasolina em ${uf}`);
    return { rotulo: `Litro da gasolina comum, ${linha.nome}`, valor: `R$ ${num(g.medio, 2)}`, unidade: "por litro", periodo: mesAno(d.ultimoMes), fonte, nota: "Média dos postos pesquisados no mês.", origem };
  } catch {
    return indisponivel("Litro da gasolina comum", fonte, origem);
  }
}

/** Botijão de 13 kg na UF, no último mês: o mesmo dadosBotijaoNoEstado da consulta do gás de cozinha. */
export function numeroBotijaoNaUf(uf: string): NumeroParaVoce {
  const origem = comUf("/gas-natural/gas-de-cozinha", uf);
  const fonte = "ANP, Levantamento de Preços de Combustíveis";
  try {
    const d = dadosBotijaoNoEstado(goldGas.glp());
    const linha = d.ufs.find((u) => u.uf === uf);
    if (!linha) throw new Error(`sem botijão em ${uf}`);
    return { rotulo: `Botijão de gás de 13 kg, ${linha.nome}`, valor: `R$ ${num(linha.medio, 2)}`, unidade: "por botijão", periodo: mesAno(d.ultimoMes), fonte, nota: "Média das revendas pesquisadas no mês.", origem };
  } catch {
    return indisponivel("Botijão de gás de 13 kg", fonte, origem);
  }
}

/** O indicador principal do painel "Por estado" da Segurança (homicídio doloso), no último ano completo, do mesmo pacoteEstados. */
export function numeroViolenciaNaUf(uf: string): NumeroParaVoce {
  const origem = comUf("/eficiencia-estatal/seguranca-publica/estados", uf);
  try {
    const g = goldSeguranca();
    const p = pacoteEstados(g, (i) => i.grupo !== "recursos");
    const k = ultimoIndice(g, "homicidio");
    const serie = p.series.homicidio?.[uf] as { taxa?: (number | null)[] | null } | undefined;
    const taxa = serie?.taxa?.[k] ?? null;
    const nome = p.ufs.find((u) => u.sigla === uf)?.nome ?? uf;
    const ind = indicador(g, "homicidio");
    return {
      rotulo: `${ind.titulo}, ${nome}`,
      valor: taxa === null ? null : num(taxa, 1),
      unidade: "por 100 mil habitantes",
      periodo: String(p.anos[k]),
      fonte: p.rotuloFonte.sinesp,
      nota: "Registros da polícia de cada estado; a classificação muda entre estados.",
      origem,
    };
  } catch {
    return indisponivel("Homicídio doloso por 100 mil habitantes", "Sinesp VDE (MJSP)", origem);
  }
}

/**
 * As contas do estado: a dívida líquida sobre a receita corrente líquida do ano padrão da ficha (recorte), lida por
 * escalaEstadual, o mesmo leitor da entrada das Contas Estaduais. Não há leitor pronto do resultado primário por estado; a dívida
 * é o número que a ficha mostra para a UF escolhida.
 */
export function numeroContasNaUf(uf: string): NumeroParaVoce {
  const origem = comUf("/contas-publicas-estaduais", uf);
  try {
    const { ano } = recorte(uf, null);
    const n = escalaEstadual(uf, ano)[1];
    return { rotulo: n.rotulo, valor: n.valor, unidade: n.unidade, periodo: n.periodo, fonte: n.fonte, nota: n.nota, origem };
  } catch {
    return indisponivel("Dívida líquida sobre a RCL ajustada", "Tesouro / Siconfi, RGF", origem);
  }
}

/** Pergunta sem número, com o motivo. */
function semNumero(id: IdPerguntaMapa, pergunta: string, resposta: string, href: string, motivo: string): PerguntaParaVoce {
  return { id, pergunta, resposta, href, numero: null, semNumero: motivo };
}

/**
 * "Para você" do mapa da conta (Iniciativa M1 do parecer de UX de 23/10/2026): os quatro cartões do estado do leitor e as
 * consultas por cidade. Com a UF, os números saem dos mesmos leitores das consultas por estado e o destino leva `?uf=`; sem ela
 * (contas anteriores à obrigatoriedade, ou com PARA_VOCE_POR_UF desligado), os cartões saem sem número, com o motivo, e o destino
 * sem parâmetro. As consultas por cidade saem sempre sem número: o município ainda não está na conta (Iniciativa I3).
 */
export function paraVoceDoMapa(ufBruta: string | null): { estado: PerguntaParaVoce[]; cidade: PerguntaParaVoce[] } {
  const uf = ufValida(ufBruta);
  const noEstado = uf ? `em ${uf}` : "no meu estado";
  const escolher = "A página mostra os números depois de escolher o estado.";
  const estado: PerguntaParaVoce[] = [
    {
      id: "tanque-uf",
      pergunta: `Quanto custa encher o tanque ${noEstado}?`,
      resposta: "O preço médio do litro de gasolina, etanol e diesel no estado e a distância para a média do Brasil.",
      href: comUf("/combustiveis/no-meu-estado", uf),
      numero: uf ? numeroTanqueNaUf(uf) : null,
      semNumero: uf ? undefined : escolher,
    },
    {
      id: "botijao-uf",
      pergunta: `Quanto custa o botijão ${noEstado}?`,
      resposta: "O preço médio do botijão de 13 kg no estado, mês a mês, comparado com a média do Brasil.",
      href: comUf("/gas-natural/gas-de-cozinha", uf),
      numero: uf ? numeroBotijaoNaUf(uf) : null,
      semNumero: uf ? undefined : escolher,
    },
    {
      id: "violencia-uf",
      pergunta: `Como está a violência ${noEstado}?`,
      resposta: "Homicídios e outros registros de violência por 100 mil habitantes no estado, ao lado da taxa do Brasil.",
      href: comUf("/eficiencia-estatal/seguranca-publica/estados", uf),
      numero: uf ? numeroViolenciaNaUf(uf) : null,
      semNumero: uf ? undefined : escolher,
    },
    {
      id: "contas-uf",
      pergunta: uf ? `Como estão as contas do estado ${uf === "DF" ? "do DF" : `de ${uf}`}?` : "Como estão as contas do meu estado?",
      resposta: "Execução do orçamento, receitas, despesas e dívida, como o estado declara ao Tesouro.",
      href: comUf("/contas-publicas-estaduais", uf),
      numero: uf ? numeroContasNaUf(uf) : null,
      semNumero: uf ? undefined : "A ficha mostra os números depois de escolher o estado.",
    },
  ];
  const cidade = "O número aparece depois de escolher a cidade.";
  return {
    estado,
    cidade: [
      semNumero("cidade-luz", CONSULTAS.luz.pergunta, CONSULTAS.luz.resumo, CONSULTAS.luz.href, cidade),
      semNumero("cidade-saneamento", CONSULTAS.municipio.pergunta, CONSULTAS.municipio.resumo, CONSULTAS.municipio.href, cidade),
      semNumero("cidade-internet", CONSULTAS.internet.pergunta, CONSULTAS.internet.resumo, CONSULTAS.internet.href, cidade),
      semNumero("cidade-inss", CONSULTAS.inss.pergunta, CONSULTAS.inss.resumo, CONSULTAS.inss.href, cidade),
      semNumero("cidade-escola", CONSULTAS.escola.pergunta, CONSULTAS.escola.resumo, CONSULTAS.escola.href, cidade),
      semNumero("cidade-fogo", "Teve fogo perto de mim?", "Focos de calor por município, o ano em curso contra os mesmos meses do ano anterior.", "/territorio/queimadas", cidade),
      semNumero("cidade-custo-de-vida", "Quanto subiu o custo de vida na minha cidade?", "A inflação do IPCA na sua cidade ou região metropolitana, comparada com a do Brasil.", "/custo-de-vida", cidade),
    ],
  };
}
