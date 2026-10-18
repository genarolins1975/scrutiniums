/**
 * Entrada com conta do Observatório do Território e Clima.
 *
 * Números lidos do PRODES (INPE, pela gold do Agronegócio), do SINISA
 * (Ministério das Cidades, pelas golds da Eficiência Estatal e do Saneamento),
 * do ONS (pela gold do Setor Elétrico) e do Programa Queimadas do INPE (pela gold
 * do próprio observatório), do Atlas Digital de Desastres (Sedec/MIDR) e do inventário
 * oficial de emissões (MCTI), também pelas golds do próprio observatório. O modelo didático agrupa onde as
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

const focos = () => numero(
  { rotulo: "Focos de calor no Brasil", unidade: "focos", fonte: "INPE, Programa Queimadas, satélite de referência", href: "/territorio/queimadas", nota: "Foco é um pixel com fogo ativo, não um incêndio nem área queimada." },
  () => {
    const g = lerPublico("territorio", "gold", "queimadas.json");
    const a = (g.anual as { ano: number; focos: number | null; parcial: boolean }[]).filter((x) => !x.parcial && x.focos !== null).at(-1)!;
    const c = g.comparacao as { periodoAtual: { inicio: string; fim: string }; focosAtual: number; variacaoPct: number } | null;
    const ini = (iso: string) => `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
    return {
      valor: num(a.focos as number, 0),
      periodo: String(a.ano),
      nota: c ? `De ${ini(c.periodoAtual.inicio)} a ${ini(c.periodoAtual.fim)}: ${num(c.focosAtual, 0)} focos, ${c.variacaoPct > 0 ? "+" : "−"}${num(Math.abs(c.variacaoPct), 1)}% sobre os mesmos meses do ano anterior (preliminar).` : undefined,
    };
  },
);

const desastres = () => numero(
  { rotulo: "Municípios com desastre reconhecido pela União", unidade: "municípios", fonte: "Sedec/MIDR, Atlas Digital de Desastres", href: "/territorio/desastres", nota: "Ao menos um reconhecimento federal de situação de emergência ou estado de calamidade no ano." },
  () => {
    const g = lerPublico("territorio", "gold", "desastres.json");
    const a = (g.serie_anual as { ano: number; municipios_distintos_com_reconhecimento: number | null; registros_reconhecidos: number | null }[]).filter((x) => x.registros_reconhecidos !== null).at(-1)!;
    return { valor: num(a.municipios_distintos_com_reconhecimento as number, 0), periodo: String(a.ano), nota: `${num(a.registros_reconhecidos as number, 0)} registros municipais reconhecidos no ano; quem não pede reconhecimento não entra na conta.` };
  },
);

const emissoes = () => numero(
  { rotulo: "Emissões líquidas de gases de efeito estufa", unidade: "Mt CO2e", fonte: "MCTI, inventário nacional (SIRENE)", href: "/territorio/emissoes" },
  () => {
    const g = lerPublico("territorio", "gold", "emissoes.json");
    const u = (g.anos as { ano: number; totalLiquido: number }[]).at(-1)!;
    const v = g.derivados.variacaoDesde2005Pct.totalLiquido as number;
    return { valor: num(u.totalLiquido / 1000, 0), periodo: String(u.ano), nota: `${v > 0 ? "+" : "−"}${num(Math.abs(v), 1)}% sobre 2005, ano de referência da meta climática. Inventário oficial, ${g.edicao}.` };
  },
);

/** Até quatro números de escala do tema. */
export function escalaTerritorio(): NumeroPorta[] {
  return [amazonia(), focos(), inundacao(), racionamento()];
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
      id: "floresta", titulo: "Floresta, fogo e emissões", pergunta: "Quanto da vegetação nativa se perde, onde há fogo e quanto se emite?",
      texto: "Desmatamento medido por satélite na Amazônia Legal e no Cerrado, com o ano do PRODES (agosto a julho), focos de calor do satélite de referência do INPE e as emissões do inventário oficial.",
      numeros: [amazonia(), cerrado(), focos(), emissoes()],
      paineis: [{ titulo: "Desmatamento e emissões", href: "/agronegocio/ambiente" }, { titulo: "Queimadas e focos de calor", href: "/territorio/queimadas" }, { titulo: "Emissões pelo inventário oficial", href: "/territorio/emissoes" }, { titulo: "Transição e ambiente da energia", href: "/setor-eletrico/transicao" }],
    },
    {
      id: "cidades", titulo: "Cidades", pergunta: "As cidades estão preparadas para chuvas, secas e resíduos?",
      texto: "Risco de inundação, planos de drenagem e destino do lixo, como os municípios declaram ao SINISA, e os desastres que a União reconheceu.",
      numeros: [inundacao(), planos, residuos, desastres()],
      paineis: [{ titulo: "Meio ambiente e clima", href: "/eficiencia-estatal/meio-ambiente-clima" }, { titulo: "Desastres reconhecidos", href: "/territorio/desastres" }],
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
