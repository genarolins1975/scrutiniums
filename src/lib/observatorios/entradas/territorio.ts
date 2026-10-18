/**
 * Entrada com conta do Observatório do Território e Clima.
 *
 * Números lidos do PRODES (INPE, pela gold do Agronegócio), do SINISA
 * (Ministério das Cidades, pelas golds da Eficiência Estatal e do Saneamento)
 * e do ONS (pela gold do Setor Elétrico). O modelo didático agrupa onde as
 * mudanças no território são medidas; ele não atribui causa ao clima.
 */
import { dataBr, lerPublico, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

function prodes(): any {
  return lerPublico("agro", "gold", "snapshot.json").economia.ambiente.prodes;
}

function sinisa(indicador: string): { valor: number; ano: number } {
  const s = lerPublico("eficiencia", "saneamento", "snapshot.json");
  const v = (s.valores as any[]).find((x) => x.id === "BR" && x.indicador === indicador);
  return { valor: v.valor, ano: s.referencia };
}

function continuidade(): any {
  return (lerPublico("saneamento", "gold", "agregados.json") as any[]).find((x) => x.id === "BR").continuidade;
}

const amazonia = () => numero(
  { rotulo: "Área desmatada na Amazônia Legal", unidade: "km²", fonte: "INPE, PRODES", href: "/agronegocio/ambiente" },
  () => {
    const t = prodes().taxaAmazoniaLegal as { inicio: number; fim: number; km2: number; estimada: boolean }[];
    const c = t.filter((x) => !x.estimada).at(-1)!;
    const est = t.find((x) => x.estimada && x.inicio === c.fim);
    return { valor: num(c.km2, 0), periodo: `ago/${c.inicio} a jul/${c.fim}`, nota: est ? `Estimativa preliminar de ago/${est.inicio} a jul/${est.fim}: ${num(est.km2, 0)} km², sujeita a revisão.` : undefined };
  },
);

const cerrado = () => numero(
  { rotulo: "Desmatamento mapeado no Cerrado", unidade: "km²", fonte: "INPE, PRODES Cerrado", href: "/agronegocio/ambiente", nota: "Incremento anual mapeado; não é a mesma medida da taxa da Amazônia." },
  () => {
    const b = (prodes().biomas as any[]).find((x) => x.id === "cerrado");
    const p = (b.periodos as any[]).filter((x) => x.anual && !x.parcial).reduce((a, x) => (x.fim > a.fim ? x : a));
    return { valor: num(p.km2, 0), periodo: `${p.inicio} a ${p.fim}` };
  },
);

const inundacao = () => numero(
  { rotulo: "Domicílios em área de risco de inundação", unidade: "milhões", fonte: "Ministério das Cidades, SINISA, drenagem", href: "/eficiencia-estatal/meio-ambiente-clima", nota: "Declarado pelos municípios que responderam ao módulo de drenagem." },
  () => {
    const s = sinisa("DOM_RISCO");
    return { valor: num(s.valor / 1e6, 2), periodo: String(s.ano) };
  },
);

const racionamento = () => numero(
  { rotulo: "Municípios com racionamento por falta de água no manancial", unidade: "municípios", fonte: "Ministério das Cidades, SINISA", href: "/saneamento/resiliencia" },
  () => {
    const c = continuidade();
    return { valor: num(c.motivos_interrupcoes["Baixa disponibilidade do manancial"], 0), periodo: "2024", nota: `Declarado pelos prestadores de ${num(c.municipios_participantes, 0)} municípios participantes.` };
  },
);

/** Até quatro números de escala do tema. */
export function escalaTerritorio(): NumeroPorta[] {
  return [amazonia(), inundacao(), racionamento(), cerrado()];
}

export type FrenteTerritorio = { id: string; titulo: string; pergunta: string; texto: string; numeros: NumeroPorta[]; paineis: { titulo: string; href: string }[] };

/** Onde as mudanças no território são medidas: floresta, cidades e água. */
export function frentesTerritorio(): FrenteTerritorio[] {
  const planos = numero(
    { rotulo: "Municípios com plano diretor de drenagem urbana", unidade: "municípios", fonte: "Ministério das Cidades, SINISA", href: "/eficiencia-estatal/meio-ambiente-clima" },
    () => {
      const s = sinisa("PLANO_DRENAGEM");
      return { valor: num(s.valor, 0), periodo: String(s.ano) };
    },
  );
  const residuos = numero(
    { rotulo: "Resíduos com disposição final inadequada", unidade: "% do coletado", fonte: "Ministério das Cidades, SINISA, resíduos", href: "/eficiencia-estatal/meio-ambiente-clima" },
    () => {
      const s = sinisa("IRS3002");
      return { valor: num(s.valor, 1), periodo: String(s.ano) };
    },
  );
  const colapso = numero(
    { rotulo: "Municípios com colapso no abastecimento de água", unidade: "municípios", fonte: "Ministério das Cidades, SINISA", href: "/saneamento/resiliencia" },
    () => {
      const c = continuidade();
      return { valor: num(c.municipios_com_colapso, 0), periodo: "2024", nota: `Entre ${num(c.municipios_informaram_colapso, 0)} municípios que informaram.` };
    },
  );
  const reservatorios = numero(
    { rotulo: "Água guardada nos reservatórios das hidrelétricas", unidade: "% da capacidade", fonte: "ONS", href: "/setor-eletrico/agua-e-clima" },
    () => {
      const a = lerPublico("energia", "gold", "agua_detalhe.json").armazenamento;
      const sin = (a.subsistemas as any[]).find((s) => s.sm === "SIN");
      return { valor: num(sin.ear_pct, 1), periodo: dataBr(sin.dia ?? a.dia), nota: "Sistema interligado nacional, em energia armazenada." };
    },
  );
  return [
    {
      id: "floresta", titulo: "Floresta e uso da terra", pergunta: "Quanto da vegetação nativa se perde?",
      texto: "Desmatamento medido por satélite na Amazônia Legal e no Cerrado, com o ano do PRODES (agosto a julho).",
      numeros: [amazonia(), cerrado()],
      paineis: [{ titulo: "Desmatamento e emissões", href: "/agronegocio/ambiente" }, { titulo: "Transição e ambiente da energia", href: "/setor-eletrico/transicao" }],
    },
    {
      id: "cidades", titulo: "Cidades", pergunta: "As cidades estão preparadas para chuvas e resíduos?",
      texto: "Risco de inundação, planos de drenagem e destino do lixo, como os municípios declaram ao SINISA.",
      numeros: [inundacao(), planos, residuos],
      paineis: [{ titulo: "Meio ambiente e clima", href: "/eficiencia-estatal/meio-ambiente-clima" }],
    },
    {
      id: "agua", titulo: "Água", pergunta: "Onde a água falta?",
      texto: "Racionamento e colapso do abastecimento declarados pelos prestadores e o armazenamento dos reservatórios das hidrelétricas.",
      numeros: [racionamento(), colapso, reservatorios],
      paineis: [{ titulo: "Secas e eventos extremos", href: "/saneamento/resiliencia" }, { titulo: "Água e clima", href: "/setor-eletrico/agua-e-clima" }],
    },
  ];
}

/* eslint-enable @typescript-eslint/no-explicit-any */
