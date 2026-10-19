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
  numeroEstadosDivida,
  numeroIdebCapitais,
  numeroPrevidencia,
  numeroSaudeCapitais,
} from "@/lib/perguntas/portas";
import { lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { respostasDosCapitulos } from "@/lib/saneamento/respostas";
import { periodoConsultaTarifas } from "@/lib/saneamento/tarifas";
import { desastres, focos } from "@/lib/observatorios/entradas/territorio";

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
  id: IdPergunta;
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
  "agua",
  "municipio",
  "tarifa-social-agua",
  "capital",
  "educacao-capital",
  "saude-capital",
  "fogo",
  "desastres",
  "estado-contas",
  "previdencia",
  "metas",
  "comida",
  "atlas-agro",
  "credito-atraso",
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
  "/contas-publicas": ["estado-contas", "previdencia", "metas"],
  "/agronegocio": ["comida", "atlas-agro"],
  "/observatorios/familias": ["luz", "botijao", "agua"],
  "/observatorios/servicos-publicos": ["capital", "educacao-capital", "saude-capital"],
  "/territorio": ["fogo", "desastres"],
  "/observatorios/contas-publicas": ["estado-contas", "previdencia", "metas"],
  "/observatorios/energia-e-infraestrutura": ["luz", "municipio", "botijao"],
  "/observatorios/economia": ["credito-atraso", "comida"],
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
    case "agua":
      return { id, pergunta: CONSULTAS.agua.pergunta, resposta: CONSULTAS.agua.resumo, href: CONSULTAS.agua.href, numero: daPorta(numeroContaAgua()) };
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
    case "previdencia":
      return {
        id,
        pergunta: "Para onde vai o dinheiro do governo federal?",
        resposta: "Receitas, despesas e resultado do governo central desde 1997, com o peso de cada grande despesa.",
        href: "/contas-publicas/panorama",
        numero: daPorta(numeroPrevidencia()),
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
    case "atlas-agro":
      return {
        id,
        pergunta: "O que o meu estado produz no campo?",
        resposta: "A produção de cada cadeia por estado, o crédito rural por finalidade e quem trabalha no campo, no mapa.",
        href: "/agronegocio/atlas",
        numero: null,
        semNumero: "Exploração: o mapa mostra a cadeia e o estado escolhidos.",
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
