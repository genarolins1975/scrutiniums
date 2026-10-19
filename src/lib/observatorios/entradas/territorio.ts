/**
 * Entrada com conta do Observatório do Território e Clima (/territorio).
 *
 * Números lidos do Programa Queimadas do INPE, do Atlas Digital de Desastres
 * (Sedec/MIDR) e do inventário oficial de emissões (MCTI), pelas golds do próprio
 * observatório (public/territorio/gold); do PRODES (INPE, pela gold do Agronegócio),
 * do SINISA (Ministério das Cidades, pelas golds da Eficiência Estatal e do
 * Saneamento) e do ONS (pela gold do Setor Elétrico). Nenhum valor é escrito à mão:
 * quando a leitura falha, o número fica ausente e a página diz isso.
 */
import { dataBr, lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { NOME_UF, lerQueimadas, recorte } from "@/lib/territorio/queimadas";
import { GRUPOS, ROTULO_CURTO, lerDesastres, serieReconhecida } from "@/lib/territorio/desastres";
import { NOME_SETOR, SETORES, lerEmissoes } from "@/lib/territorio/emissoes";

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

const sinal = (v: number, casas = 1) => `${v > 0 ? "+" : "−"}${num(Math.abs(v), casas)}%`;

export const amazonia = () => numero(
  { rotulo: "Área desmatada na Amazônia Legal", unidade: "km²", fonte: "INPE, PRODES", href: "/agronegocio/ambiente" },
  () => {
    const t = prodes().taxaAmazoniaLegal as { inicio: number; fim: number; km2: number; estimada: boolean }[];
    const c = t.filter((x) => !x.estimada).at(-1)!;
    const est = t.find((x) => x.estimada && x.inicio === c.fim);
    return { valor: num(c.km2, 0), periodo: `ago/${c.inicio} a jul/${c.fim}`, nota: est ? `Estimativa preliminar de ago/${est.inicio} a jul/${est.fim}: ${num(est.km2, 0)} km², sujeita a revisão.` : undefined };
  },
);

export const cerrado = () => numero(
  { rotulo: "Desmatamento mapeado no Cerrado", unidade: "km²", fonte: "INPE, PRODES Cerrado", href: "/agronegocio/ambiente", nota: "Incremento anual mapeado; não é a mesma medida da taxa da Amazônia." },
  () => {
    const b = (prodes().biomas as any[]).find((x) => x.id === "cerrado");
    const p = (b.periodos as any[]).filter((x) => x.anual && !x.parcial).reduce((a, x) => (x.fim > a.fim ? x : a));
    return { valor: num(p.km2, 0), periodo: `${p.inicio} a ${p.fim}` };
  },
);

export const inundacao = () => numero(
  { rotulo: "Domicílios em área de risco de inundação", unidade: "milhões", fonte: "Ministério das Cidades, SINISA, drenagem", href: "/eficiencia-estatal/meio-ambiente-clima", nota: "Declarado pelos municípios que responderam ao módulo de drenagem." },
  () => {
    const s = sinisa("DOM_RISCO");
    return { valor: num(s.valor / 1e6, 2), periodo: String(s.ano) };
  },
);

export const residuos = () => numero(
  { rotulo: "Resíduos com disposição final inadequada", unidade: "% do coletado", fonte: "Ministério das Cidades, SINISA, resíduos", href: "/eficiencia-estatal/meio-ambiente-clima" },
  () => {
    const s = sinisa("IRS3002");
    return { valor: num(s.valor, 1), periodo: String(s.ano) };
  },
);

export const racionamento = () => numero(
  { rotulo: "Municípios com racionamento por falta de água no manancial", unidade: "municípios", fonte: "Ministério das Cidades, SINISA", href: "/saneamento/resiliencia" },
  () => {
    const c = continuidade();
    return { valor: num(c.motivos_interrupcoes["Baixa disponibilidade do manancial"], 0), periodo: "2024", nota: `Declarado pelos prestadores de ${num(c.municipios_participantes, 0)} municípios participantes; ${num(c.municipios_com_colapso, 0)} registraram colapso no abastecimento.` };
  },
);

export const reservatorios = () => numero(
  { rotulo: "Água guardada nos reservatórios das hidrelétricas", unidade: "% da capacidade", fonte: "ONS", href: "/setor-eletrico/agua-e-clima", nota: "Sistema interligado nacional, em energia armazenada." },
  () => {
    const a = lerPublico("energia", "gold", "agua_detalhe.json").armazenamento;
    const sin = (a.subsistemas as any[]).find((s) => s.sm === "SIN");
    return { valor: num(sin.ear_pct, 1), periodo: dataBr(sin.dia ?? a.dia) };
  },
);

export const focos = () => numero(
  { rotulo: "Focos de calor no Brasil", unidade: "focos", fonte: "INPE, Programa Queimadas, satélite de referência", href: "/territorio/queimadas", nota: "Foco é um pixel com fogo ativo, não um incêndio nem área queimada." },
  () => {
    const g = lerQueimadas();
    const a = g.anual.filter((x) => !x.parcial && x.focos !== null).at(-1)!;
    return { valor: num(a.focos as number, 0), periodo: a.preliminar ? `${a.ano}, preliminar` : String(a.ano) };
  },
);

export const desastres = () => numero(
  { rotulo: "Municípios com desastre reconhecido pela União", unidade: "municípios", fonte: "Sedec/MIDR, Atlas Digital de Desastres", href: "/territorio/desastres", nota: "Ao menos um reconhecimento federal de situação de emergência ou estado de calamidade no ano; quem não pede reconhecimento não entra na conta." },
  () => {
    const a = serieReconhecida(lerDesastres()).at(-1)!;
    return { valor: num(a.municipios_distintos_com_reconhecimento, 0), periodo: String(a.ano) };
  },
);

export const emissoes = () => numero(
  { rotulo: "Emissões líquidas de gases de efeito estufa", unidade: "Mt CO2e", fonte: "MCTI, inventário nacional (SIRENE)", href: "/territorio/emissoes" },
  () => {
    const g = lerEmissoes();
    const u = g.anos.at(-1)!;
    return {
      valor: num(u.totalLiquido / 1000, 0),
      periodo: String(u.ano),
      nota: `${sinal(g.derivados.variacaoDesde2005Pct.totalLiquido)} sobre ${g.derivados.anoReferenciaNdc}, ano de referência da meta climática. Inventário oficial, ${g.edicao}.`,
    };
  },
);

/**
 * Os quatro números de escala da primeira tela: o que muda (fogo e floresta) e
 * onde atinge as pessoas (desastres reconhecidos e domicílios em área de risco).
 */
export function escalaTerritorio(): NumeroPorta[] {
  return [focos(), amazonia(), desastres(), inundacao()];
}

/** Uma lista curta de valores da mesma fonte e período, com a prova ao pé. */
export type ListaCartao = { titulo: string; itens: { nome: string; valor: string }[]; unidade: string; fonte: string; periodo: string } | null;

export type CartaoPainel = {
  id: "queimadas" | "desastres" | "emissoes";
  titulo: string;
  pergunta: string;
  href: string;
  numero: NumeroPorta;
  lista: ListaCartao;
};

function lista(ler: () => NonNullable<ListaCartao>): ListaCartao {
  try {
    return ler();
  } catch {
    return null;
  }
}

/** Os três painéis mantidos pelo observatório, cada um com um número e uma lista que já respondem algo. */
export function cartoesTerritorio(): CartaoPainel[] {
  const fonteQ = "INPE, Programa Queimadas, satélite de referência";
  const fonteD = "Sedec/MIDR, Atlas Digital de Desastres";
  const fonteE = "MCTI, inventário nacional (SIRENE)";
  return [
    {
      id: "queimadas",
      titulo: "Queimadas e focos de calor",
      pergunta: "Onde e quanto o fogo aparece?",
      href: "/territorio/queimadas",
      numero: numero(
        { rotulo: "Focos de calor no ano em curso", unidade: "focos", fonte: fonteQ, href: "/territorio/queimadas" },
        () => {
          const c = lerQueimadas().comparacao!;
          return {
            valor: num(c.focosAtual, 0),
            periodo: `${mesAno(c.periodoAtual.inicio)} a ${mesAno(c.periodoAtual.fim)}, preliminar`,
            nota: `${sinal(c.variacaoPct)} sobre os mesmos meses de ${c.periodoAnterior.inicio.slice(0, 4)} (${num(c.focosAnterior, 0)} focos).`,
          };
        },
      ),
      lista: lista(() => {
        const g = lerQueimadas();
        const r = recorte(g, "acumuladoAnoCorrente")!;
        const ufs = (r.porUF ?? []).filter((u) => NOME_UF[u.id]).slice(0, 3);
        if (!ufs.length || r.focos === null) throw new Error("sem estados");
        return {
          titulo: "Estados com mais focos",
          itens: ufs.map((u) => ({ nome: NOME_UF[u.id], valor: num(u.focos, 0) })),
          unidade: "focos",
          fonte: fonteQ,
          periodo: `${mesAno(r.periodo.inicio)} a ${mesAno(r.periodo.fim)}`,
        };
      }),
    },
    {
      id: "desastres",
      titulo: "Desastres reconhecidos",
      pergunta: "Onde os desastres atingem os municípios?",
      href: "/territorio/desastres",
      numero: numero(
        { rotulo: "Registros municipais com reconhecimento federal", unidade: "registros", fonte: fonteD, href: "/territorio/desastres", nota: "Um registro é um município atingido por um desastre reconhecido; não é o número de desastres." },
        () => {
          const a = serieReconhecida(lerDesastres()).at(-1)!;
          return { valor: num(a.registros_reconhecidos, 0), periodo: `ocorrências de ${a.ano}` };
        },
      ),
      lista: lista(() => {
        const a = serieReconhecida(lerDesastres()).at(-1)!;
        return {
          titulo: "Por tipo de desastre",
          itens: [...GRUPOS].sort((x, y) => a.por_grupo_reconhecidos[y] - a.por_grupo_reconhecidos[x]).map((gr) => ({ nome: ROTULO_CURTO[gr], valor: num(a.por_grupo_reconhecidos[gr], 0) })),
          unidade: "registros reconhecidos",
          fonte: fonteD,
          periodo: String(a.ano),
        };
      }),
    },
    {
      id: "emissoes",
      titulo: "Emissões pelo inventário oficial",
      pergunta: "Quanto o Brasil emite de gases de efeito estufa?",
      href: "/territorio/emissoes",
      numero: emissoes(),
      lista: lista(() => {
        const g = lerEmissoes();
        const p = g.derivados.participacaoUltimoAnoPct;
        return {
          titulo: "Parte de cada setor no total líquido",
          itens: [...SETORES].sort((x, y) => p[y] - p[x]).map((s) => ({ nome: NOME_SETOR[s], valor: num(p[s], 1) })),
          unidade: "%",
          fonte: fonteE,
          periodo: String(g.anoFinal),
        };
      }),
    },
  ];
}

/** Número com prova para os caminhos por pergunta que levam a painéis de outras coleções. */
export function numeroDoCaminho(href: string): NumeroPorta | null {
  const porRota: Record<string, () => NumeroPorta> = {
    "/agronegocio/ambiente": cerrado,
    "/eficiencia-estatal/meio-ambiente-clima": residuos,
    "/saneamento/resiliencia": racionamento,
    "/setor-eletrico/agua-e-clima": reservatorios,
  };
  return porRota[href]?.() ?? null;
}

/** Datas de captura das golds do próprio observatório, para a atualidade no fim da entrada. */
export function capturasTerritorio(): { fonte: string; capturadoEm: string | null; href: string }[] {
  const ler = (f: () => string) => {
    try {
      return dataBr(f());
    } catch {
      return null;
    }
  };
  return [
    { fonte: "Focos de calor (INPE)", capturadoEm: ler(() => lerQueimadas().capturadoEm), href: "/territorio/queimadas" },
    { fonte: "Desastres (Sedec/MIDR)", capturadoEm: ler(() => lerDesastres().capturadoEm), href: "/territorio/desastres" },
    { fonte: "Emissões (MCTI)", capturadoEm: ler(() => lerEmissoes().capturadoEm), href: "/territorio/emissoes" },
  ];
}

/* eslint-enable @typescript-eslint/no-explicit-any */
