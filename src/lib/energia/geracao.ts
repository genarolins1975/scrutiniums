/**
 * Lógica pura das páginas da Geração (P021 matriz efetiva, P022 despacho térmico, P023
 * renováveis restringidas, P024 capacidade e utilização), testada em node sem navegador.
 *
 * Nada aqui recalcula indicador: energia, participação, motivos, cortes, fatores de
 * capacidade e variações vêm prontos da gold (pipeline/energia/modulos/geracao_detalhe.py).
 * As funções escolhem o recorte pedido na URL, montam as linhas que o gráfico, a tabela
 * equivalente e a exportação usam (as mesmas linhas, para que os três nunca divirjam) e
 * escrevem as respostas curtas por regra determinística: mudar o número muda o texto, e
 * nenhuma frase traz número fixo. Ausência continua ausência (null), nunca zero.
 *
 * A única transformação numérica é de unidade de exibição (MWh para GWh, divisão por mil),
 * para que eixos e tabelas de energia de 12 meses sejam legíveis; a ficha de prova mostra o
 * valor original da gold.
 *
 * Idioma: toda função que escreve texto recebe `idioma` por último (padrão: o da página, por idiomaEnergia()); o
 * componente de cliente passa o de useIdioma(). Os números e as datas são os mesmos nos dois idiomas.
 */
import { Fragment, createElement, type ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { formatos } from "./formato";
import { idiomaEnergia, porIdioma, tx } from "./idioma";
import { CONTROLES_GERACAO_EN, DOWNLOADS_GERACAO_EN, RESULTADOS_CONTROLE_EN, nomeNo, rotuloGold, rotuloGoldEn, txEm } from "./i18n/geracao";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Natureza, Submercado } from "./tipos";
import type {
  A11,
  AnoSin,
  Capacidade,
  Capacidade12m,
  CategoriaCapacidade,
  CategoriaCombustivel,
  CategoriaGeracao,
  ComparacaoDozeMeses,
  ControleGeracao,
  FontePublicada,
  GoldGeracaoDetalhe,
  JanelasRegiao,
  Matriz,
  MensalSin,
  Mix,
  MotivoDespacho,
  NaturezaGeracao,
  NaturezaMensal,
  Quebra,
  Quantis,
  RazaoRestricao,
  Restricao,
  RestricaoUsina,
  RegiaoGeracao,
  RessalvaUniverso,
  RotuloFonte,
  Termica,
  TermicaUsina,
} from "./tipos-geracao";

/** Unidade de energia média no idioma (MWmed; em inglês, MWavg). */
export function mwmed(idioma: Idioma = idiomaEnergia()): string {
  return tx("MWmed", "MWavg", idioma);
}

/* ====================================================================== */
/* rotas, painéis e atualidade                                              */
/* ====================================================================== */

export const ROTA_GERACAO = "/setor-eletrico/geracao";
export type PainelGeracao = "p021" | "p022" | "p023" | "p024";

/** Pergunta do destino Geração no menu (navegacao.ts) e título da página principal. */
export function perguntaModuloGeracao(idioma: Idioma = idiomaEnergia()): string {
  return tx("De onde vem a eletricidade e quais fontes estão sendo usadas?", "Where does electricity come from, and which sources are being used?", idioma);
}

/**
 * Um painel por página: cada um tem séries, várias tabelas equivalentes e fichas de prova;
 * juntos passariam da meta de cerca de 600 KB de HTML por página (contrato, seção 5.1).
 * Perguntas do Anexo A, com o sujeito explícito quando a pergunta curta seria ambígua.
 */
/** `publicado`: a rota do painel já existe no app; painel não publicado aparece como "em preparação", nunca como link. */
export function paineisGeracao(idioma: Idioma = idiomaEnergia()): { id: PainelGeracao; rotulo: string; caminho: string; pergunta: string; publicado: boolean }[] {
  const tx = txEm(idioma);
  return [
    { id: "p021", rotulo: tx("Matriz efetiva", "Effective mix"), caminho: "", pergunta: tx("De onde vem a eletricidade?", "Where does electricity come from?"), publicado: true },
    { id: "p022", rotulo: tx("Despacho térmico", "Thermal dispatch"), caminho: "/termica", pergunta: tx("Quanto as térmicas geraram e por que foram acionadas?", "How much did thermal plants generate, and why were they dispatched?"), publicado: true },
    { id: "p023", rotulo: tx("Renováveis restringidas", "Restricted renewables"), caminho: "/restricoes", pergunta: tx("Quanta geração eólica e solar foi restringida?", "How much wind and solar generation was restricted?"), publicado: true },
    { id: "p024", rotulo: tx("Capacidade e utilização", "Capacity and utilization"), caminho: "/capacidade", pergunta: tx("Quanto está instalado e quanto produz?", "How much is installed, and how much does it produce?"), publicado: true },
  ];
}

/** Os painéis em português (rotas e publicação não mudam com o idioma). */
export const PAINEIS_GERACAO = paineisGeracao("pt");

export function painelPublicado(id: PainelGeracao): boolean {
  return PAINEIS_GERACAO.find((p) => p.id === id)?.publicado ?? false;
}

export function rotaPainel(id: PainelGeracao): string {
  return `${ROTA_GERACAO}${PAINEIS_GERACAO.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelGeracao, idioma: Idioma = idiomaEnergia()): string {
  return paineisGeracao(idioma).find((p) => p.id === id)?.pergunta ?? "";
}

/**
 * Texto da gold em português de leitor: troca nomes de campo e identificadores internos (id_ons, ressalvas_universo, natureza_pct,
 * matriz.universo, hidraulica sem acento) pela descrição, e a frase "igual ao do Balanço" pela que a reconciliação sustenta
 * (próximo, com divergências listadas em Auditar). Só muda a redação exibida: o dado e o arquivo publicado seguem como estão.
 */
const EM_PORTUGUES: readonly (readonly [RegExp, string])[] = [
  [/\(total da Geração por Usina, igual ao do Balanço\)/g, "(total da Geração por Usina, próximo ao do Balanço, com divergências listadas em Auditar)"], // i18n: dado
  [/matriz\.outros_por_ceg/g, "a decomposição de outras térmicas pelo CEG"], // i18n: dado
  [/matriz\.universo/g, "o universo da matriz"], // i18n: dado
  [/\boutros_por_ceg\b/g, "decomposição de outras térmicas pelo CEG"], // i18n: dado
  [/\bressalvas_universo\b/g, "ressalvas de universo"], // i18n: dado
  [/\bnatureza_mensal_sin\b/g, "série mensal por natureza"], // i18n: dado
  [/\bnatureza_pct\b/g, "parcela por natureza"], // i18n: dado
  [/\bons_pct_da_aneel\b/g, 'a coluna "ONS como parcela da ANEEL"'], // i18n: dado
  [/^mwh_dos_ausentes_mesmo_mes_ano_anterior\b/g, 'A coluna "Geração publicada para os mesmos ausentes"'], // i18n: dado
  [/\bmwh_dos_ausentes_mesmo_mes_ano_anterior\b/g, 'a coluna "Geração publicada para os mesmos ausentes"'], // i18n: dado
  [/\bid_ons\b/g, "código do ONS"], // i18n: dado
  [/'quebras'/g, "a tabela de mudanças de universo e de rótulo"], // i18n: dado
  [/\btermica_sem_combustivel\b/g, "térmicas Tipo III"], // i18n: dado
  [/\bsolar_centralizada\b/g, "solar centralizada"], // i18n: dado
  [/\bsolar_mmgd\b/g, "solar MMGD"], // i18n: dado
  [/\bnao_mapeada\b/g, "não mapeada"], // i18n: dado
  [/\bhidraulica\b/g, "hidráulica"], // i18n: dado
  [/\btermica\b/g, "térmica"], // i18n: dado
  [/\beolica\b/g, "eólica"], // i18n: dado
];

/** Prosa da gold com os nomes de campo trocados pela descrição (em português: a gold não tem versão inglesa). */
export function emPortugues(texto: string): string {
  return EM_PORTUGUES.reduce((t, [re, por]) => t.replace(re, por), texto);
}

/** Linhas com valores simples (número, texto, nulo) para a tabela; booleano vira "sim"/"não", lista vira texto. */
export function paraTabela<T extends object>(linhas: readonly T[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const tx = txEm(idioma);
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? sim : nao) : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

/** MWh para GWh (unidade de exibição); ausência continua ausência. */
export function gwh(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v / 1000;
}

/** "a", "a e b", "a, b e c" ("a, b and c" em inglês). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** Primeira letra maiúscula (início de frase). */
export function inicial(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Dia de Brasília (AAAA-MM-DD) de um carimbo UTC. */
export function diaDeBrasilia(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

/** Meses entre dois AAAA-MM (fim − início). */
export function mesesEntre(inicio: string, fim: string): number {
  return (Number(fim.slice(0, 4)) - Number(inicio.slice(0, 4))) * 12 + Number(fim.slice(5, 7)) - Number(inicio.slice(5, 7));
}

/**
 * Atualidade de série diária: a Geração por Usina sai com um a dois dias de atraso; acima
 * de `folgaDias` a página avisa que a fonte está defasada e mostra a última publicação válida.
 */
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3, idioma: Idioma = idiomaEnergia()): { defasada: boolean; dias: number; texto: string } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const proc = diaDeBrasilia(geradoEm);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: tx(
        `Fonte defasada: o dia mais recente é ${f.dataBR(diaReferencia)}, ${f.plural(dias, "dia", "dias")} antes do processamento (${f.dataBR(proc)}), mais que o atraso habitual de publicação do ONS. Os números são os da última publicação válida.`,
        `Source out of date: the most recent day is ${f.dataBR(diaReferencia)}, ${f.plural(dias, "day", "days")} before processing (${f.dataBR(proc)}), more than the usual ONS publication delay. The figures are those of the latest valid publication.`,
      ),
    };
  }
  return {
    defasada: false,
    dias,
    texto: tx(
      `Dado até ${f.dataBR(diaReferencia)}, processado em ${f.dataBR(proc)} (${f.plural(dias, "dia", "dias")} depois).`,
      `Data up to ${f.dataBR(diaReferencia)}, processed on ${f.dataBR(proc)} (${f.plural(dias, "day", "days")} later).`,
    ),
  };
}

/**
 * Atualidade de série mensal: o último mês completo fica a cerca de um mês do processamento
 * (31 dias quando se processa no dia 1 com o mês anterior ainda incompleto); acima de 45 dias
 * entre o fim desse mês e o processamento, a fonte está defasada. A conta é em dias, não na
 * diferença entre rótulos de mês: ago a out são dois rótulos e 31 dias.
 */
/** "de" + artigo contraído: "de a térmica" → "da térmica", "de as restrições" → "das restrições". */
export function deContraido(nome: string): string {
  const m = /^(o|a|os|as) (.*)$/.exec(nome);
  return m ? `d${m[1]} ${m[2]}` : `de ${nome}`; // i18n: dado
}

/** `nome` vem no idioma da página ("a térmica por motivo de despacho"; "thermal generation by dispatch reason"). */
export function situacaoMensal(ultimoMes: string | null, geradoEm: string, nome: string, idioma: Idioma = idiomaEnergia()): { defasada: boolean; texto: string } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const proc = diaDeBrasilia(geradoEm);
  if (!ultimoMes) return { defasada: true, texto: tx(`${inicial(nome)}: nenhum mês completo publicado.`, `${inicial(nome)}: no complete month published.`) };
  // dias entre o fim do último mês completo e o processamento: processar no dia 1 com agosto completo são 31 dias, o ritmo normal de um conjunto diário
  const fimDoMes = new Date(Date.UTC(Number(ultimoMes.slice(0, 4)), Number(ultimoMes.slice(5, 7)), 0));
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - fimDoMes.getTime()) / 86_400_000);
  if (dias > 45) {
    return {
      defasada: true,
      texto: tx(
        `Fonte defasada: o último mês completo ${deContraido(nome)} é ${f.mesAno(ultimoMes)}, encerrado ${f.plural(dias, "dia", "dias")} antes do processamento (${f.dataBR(proc)}). Os números são os da última publicação válida.`,
        `Source out of date: the latest complete month of ${nome} is ${f.mesAno(ultimoMes)}, which ended ${f.plural(dias, "day", "days")} before processing (${f.dataBR(proc)}). The figures are those of the latest valid publication.`,
      ),
    };
  }
  return {
    defasada: false,
    texto: tx(
      `${inicial(nome)}: último mês completo ${f.mesAno(ultimoMes)}, processado em ${f.dataBR(proc)}.`,
      `${inicial(nome)}: latest complete month ${f.mesAno(ultimoMes)}, processed on ${f.dataBR(proc)}.`,
    ),
  };
}

/* ====================================================================== */
/* categorias, cores e nomes                                               */
/* ====================================================================== */

export const CATEGORIAS: readonly CategoriaGeracao[] = [
  "hidraulica",
  "eolica",
  "solar_centralizada",
  "solar_mmgd",
  "nuclear",
  "gas",
  "carvao",
  "oleo",
  "biomassa",
  "outros",
  "termica_sem_combustivel",
  "nao_mapeada",
];

/** Nome curto para eixo e legenda; o nome completo (da gold) vai na tabela e na dica. */
export function curtoCategoria(idioma: Idioma = idiomaEnergia()): Record<CategoriaGeracao, string> {
  return porIdioma(idioma, {
    pt: {
      hidraulica: "Hidráulica",
      eolica: "Eólica",
      solar_centralizada: "Solar centralizada",
      solar_mmgd: "Solar MMGD (estimada)",
      nuclear: "Nuclear",
      gas: "Gás natural",
      carvao: "Carvão mineral",
      oleo: "Óleo e diesel",
      biomassa: "Biomassa",
      outros: "Outras térmicas",
      termica_sem_combustivel: "Térmicas Tipo III",
      nao_mapeada: "Não mapeada",
    },
    en: {
      hidraulica: "Hydropower",
      eolica: "Wind",
      solar_centralizada: "Centralized solar",
      solar_mmgd: "Solar MMGD (estimated)",
      nuclear: "Nuclear",
      gas: "Natural gas",
      carvao: "Coal",
      oleo: "Fuel oil and diesel",
      biomassa: "Biomass",
      outros: "Other thermal",
      termica_sem_combustivel: "Type III thermal plants",
      nao_mapeada: "Unmapped",
    },
  });
}

/** Nome dentro de frase (minúscula, com a natureza quando ela muda a leitura). */
export function fraseCategoria(idioma: Idioma = idiomaEnergia()): Record<CategoriaGeracao, string> {
  return porIdioma(idioma, {
    pt: {
      hidraulica: "hidráulica",
      eolica: "eólica",
      solar_centralizada: "solar centralizada",
      solar_mmgd: "solar MMGD (estimativa do ONS)",
      nuclear: "nuclear",
      gas: "gás natural",
      carvao: "carvão mineral",
      oleo: "óleo combustível e diesel",
      biomassa: "biomassa",
      outros: "outras térmicas",
      termica_sem_combustivel: "térmicas pequenas sem combustível identificado (previsão Tipo III)",
      nao_mapeada: "categoria não mapeada",
    },
    en: {
      hidraulica: "hydropower",
      eolica: "wind",
      solar_centralizada: "centralized solar",
      solar_mmgd: "solar MMGD (ONS estimate)",
      nuclear: "nuclear",
      gas: "natural gas",
      carvao: "coal",
      oleo: "fuel oil and diesel",
      biomassa: "biomass",
      outros: "other thermal",
      termica_sem_combustivel: "small thermal plants without an identified fuel (Type III forecast)",
      nao_mapeada: "unmapped category",
    },
  });
}

/** O nome em frase, em português (o mesmo de fraseCategoria("pt")). */
export const FRASE_CATEGORIA: Record<CategoriaGeracao, string> = fraseCategoria("pt");

/**
 * Cor por categoria, só tokens. A MMGD e as térmicas Tipo III usam um tom mais escuro da série de origem (25% de preto):
 * o tom claro de antes (45% sobre o branco) dava 1,6:1 e 1,8:1 contra o fundo, abaixo dos 3:1 do WCAG 1.4.11. Agora são 5,1:1 e 6,2:1.
 */
export const COR_CATEGORIA: Record<CategoriaGeracao, string> = {
  hidraulica: "var(--serie-hidraulica)",
  eolica: "var(--serie-eolica)",
  solar_centralizada: "var(--serie-solar)",
  solar_mmgd: "color-mix(in srgb, var(--serie-solar) 75%, #000)",
  nuclear: "var(--serie-sm-se)",
  gas: "var(--serie-termica)",
  carvao: "var(--serie-1)",
  oleo: "var(--serie-6)",
  biomassa: "var(--cor-sucesso)",
  outros: "var(--serie-3)",
  termica_sem_combustivel: "color-mix(in srgb, var(--serie-termica) 75%, #000)",
  nao_mapeada: "var(--serie-referencia)",
};

/** Nome completo de cada categoria, como a gold publica (em inglês, pela tabela exata; sem entrada, o nome curto inglês). */
export function nomesCategorias(cats: GoldGeracaoDetalhe["categorias"], idioma: Idioma = idiomaEnergia()): Record<CategoriaGeracao, string> {
  const curto = curtoCategoria(idioma);
  const out = { ...curto };
  for (const c of cats) out[c.id] = rotuloGold(c.rotulo, idioma, curto[c.id]);
  return out;
}

export const REGIOES: readonly RegiaoGeracao[] = ["SIN", "SE", "S", "NE", "N"];

export function nomeRegiao(idioma: Idioma = idiomaEnergia()): Record<RegiaoGeracao, string> {
  return porIdioma(idioma, {
    pt: { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" },
    en: { SIN: "SIN", SE: "Southeast/Center-West", S: "South", NE: "Northeast", N: "North" },
  });
}

/** "do SIN", "do Sul" (em inglês, "in the SIN", "in the South": a frase inglesa usa a mesma forma para os dois). */
export function doRegiao(idioma: Idioma = idiomaEnergia()): Record<RegiaoGeracao, string> {
  return porIdioma(idioma, {
    pt: { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" },
    en: { SIN: "in the SIN", SE: "in the Southeast/Center-West", S: "in the South", NE: "in the Northeast", N: "in the North" },
  });
}

export function noRegiao(idioma: Idioma = idiomaEnergia()): Record<RegiaoGeracao, string> {
  return porIdioma(idioma, {
    pt: { SIN: "no SIN", SE: "no Sudeste/Centro-Oeste", S: "no Sul", NE: "no Nordeste", N: "no Norte" },
    en: { SIN: "in the SIN", SE: "in the Southeast/Center-West", S: "in the South", NE: "in the Northeast", N: "in the North" },
  });
}

export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

export const NATUREZAS: readonly NaturezaGeracao[] = ["verificada", "grupo_tipo3", "grupo_mmgd"];

export function curtoNatureza(idioma: Idioma = idiomaEnergia()): Record<NaturezaGeracao, string> {
  return porIdioma(idioma, {
    pt: {
      verificada: "Medição (usinas com relacionamento com o ONS)",
      grupo_tipo3: "Previsão do ONS (grupos Tipo III)",
      grupo_mmgd: "Estimativa do ONS (MMGD)",
    },
    en: {
      verificada: "Measurement (plants with a relationship with the ONS)",
      grupo_tipo3: "ONS forecast (Type III groups)",
      grupo_mmgd: "ONS estimate (MMGD)",
    },
  });
}

export const COR_NATUREZA: Record<NaturezaGeracao, string> = {
  verificada: "var(--cor-energia)", // i18n: dado
  grupo_tipo3: "var(--cor-previsto)",
  grupo_mmgd: "var(--serie-solar)",
};

/* ====================================================================== */
/* P021: matriz efetiva                                                     */
/* ====================================================================== */

export type JanelaMatriz = "dia" | "7d" | "30d" | "12m";
export const JANELAS: readonly JanelaMatriz[] = ["dia", "7d", "30d", "12m"]; // i18n: dado

export function rotuloJanela(idioma: Idioma = idiomaEnergia()): Record<JanelaMatriz, string> {
  return porIdioma(idioma, {
    pt: { dia: "Último dia", "7d": "7 dias", "30d": "30 dias", "12m": "365 dias" },
    en: { dia: "Last day", "7d": "7 days", "30d": "30 days", "12m": "365 days" },
  });
}

/** A janela como adjetivo da frase inglesa ("the 30-day window"); em português, o rótulo da janela. */
export function janelaAdjetivo(j: JanelaMatriz, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, {
    pt: rotuloJanela("pt"),
    en: { dia: "last-day", "7d": "7-day", "30d": "30-day", "12m": "365-day" },
  })[j];
}

export type Perimetro = "com" | "sem";
export const PERIMETROS: readonly Perimetro[] = ["com", "sem"]; // i18n: dado

export function rotuloPerimetro(idioma: Idioma = idiomaEnergia()): Record<Perimetro, string> {
  return porIdioma(idioma, { pt: { com: "Com MMGD estimada", sem: "Sem MMGD" }, en: { com: "With estimated MMGD", sem: "Without MMGD" } });
}

/** O perímetro dentro de frase e de título: minúscula só na palavra comum, a sigla MMGD fica como está. */
export function perimetroEmFrase(idioma: Idioma = idiomaEnergia()): Record<Perimetro, string> {
  return porIdioma(idioma, { pt: { com: "com MMGD estimada", sem: "sem MMGD" }, en: { com: "with estimated MMGD", sem: "without MMGD" } });
}

/** Janelas publicadas para a região (os subsistemas só têm 30 e 365 dias). */
export function janelasDisponiveis(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao): JanelaMatriz[] {
  const j: JanelasRegiao | undefined = m.janelas[rg];
  return JANELAS.filter((k) => !!j?.[k]);
}

/** Janela pedida, se existir para a região; senão 30 dias (e o aviso diz que mudou). */
export function janelaEscolhida(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz): { janela: JanelaMatriz; mix: Mix | null; ajustada: boolean } {
  const disp = janelasDisponiveis(m, rg);
  const janela = disp.includes(pedida) ? pedida : disp.includes("30d") ? "30d" : (disp[0] ?? "30d");
  return { janela, mix: m.janelas[rg]?.[janela] ?? null, ajustada: janela !== pedida };
}

/** Referência de comparação do gráfico de participação: 365 dias; para a própria janela de 365 dias, os 30 dias. */
export function janelaReferencia(j: JanelaMatriz): JanelaMatriz {
  return j === "12m" ? "30d" : "12m";
}

/** Texto "31/08/2026 a 29/09/2026 (30 dias)" ou "29/09/2026" para a janela de um dia. */
export function periodoMix(x: Pick<Mix, "inicio" | "fim" | "dias">, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  if (x.inicio === x.fim) return f.dataBR(x.inicio);
  return tx(
    `${f.dataBR(x.inicio)} a ${f.dataBR(x.fim)} (${f.plural(x.dias, "dia", "dias")})`,
    `${f.dataBR(x.inicio)} to ${f.dataBR(x.fim)} (${f.plural(x.dias, "day", "days")})`,
    idioma,
  );
}

const participacaoDe = (x: Mix, per: Perimetro, c: CategoriaGeracao) => (per === "com" ? x.participacao[c] : x.participacao_sem_mmgd[c]);
const totalDe = (x: Mix, per: Perimetro) => (per === "com" ? x.total_mwmed : x.total_sem_mmgd_mwmed);

/** Ressalva de universo escrita: por que a participação da categoria não se compara com a de antes. */
export function textoRessalva(r: RessalvaUniverso | undefined | null, idioma: Idioma = idiomaEnergia()): string | null {
  if (!r) return null;
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const partes: string[] = [];
  if (r.motivos.includes("universo_reduzido")) {
    partes.push(
      tx(
        `${f.num(r.identificadores_com_valor_no_ultimo_mes, 0)} usinas com dado no último mês, contra até ${f.num(r.maior_numero_12_meses_antes, 0)} nos 12 meses anteriores`,
        `${f.num(r.identificadores_com_valor_no_ultimo_mes, 0)} plants with data in the latest month, against up to ${f.num(r.maior_numero_12_meses_antes, 0)} in the previous 12 months`,
      ),
    );
  }
  if (r.motivos.includes("salto_no_periodo") && r.saltos.length) {
    const meses = listaTexto(r.saltos.map((s) => f.mesAno(s.slice(0, 7))), idioma);
    partes.push(tx(`salto no número de usinas com dado em ${meses}`, `jump in the number of plants with data in ${meses}`));
  }
  return partes.length ? tx(`Ressalva de universo: ${partes.join("; ")}.`, `Coverage caveat: ${partes.join("; ")}.`) : tx("Ressalva de universo.", "Coverage caveat.");
}

export type LinhaMatriz = {
  id: CategoriaGeracao;
  curto: string;
  categoria: string;
  mwmed: number | null;
  participacao: number | null;
  mwmed_ref: number | null;
  participacao_ref: number | null;
  ressalva: string | null;
  presenca: string | null;
};

/**
 * Uma linha por categoria com valor na janela escolhida ou na referência, na ordem da gold.
 * No perímetro sem MMGD a categoria Solar MMGD sai da tabela (fica fora do perímetro).
 */
export function linhasMatriz(
  m: Pick<Matriz, "janelas">,
  rg: RegiaoGeracao,
  pedida: JanelaMatriz,
  per: Perimetro,
  nomes: Record<CategoriaGeracao, string>,
  idioma: Idioma = idiomaEnergia(),
): LinhaMatriz[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const curto = curtoCategoria(idioma);
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  const ref = m.janelas[rg]?.[janelaReferencia(janela)] ?? null;
  if (!mix) return [];
  const out: LinhaMatriz[] = [];
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const v = mix.mwmed[c];
    const vr = ref?.mwmed[c] ?? null;
    if (v === null && vr === null) continue;
    const dias = mix.dias_com_linha[c];
    out.push({
      id: c,
      curto: `${curto[c]}${mix.ressalvas_universo[c] ? tx(" (ressalva)", " (caveat)") : ""}`,
      categoria: nomes[c],
      mwmed: v,
      participacao: participacaoDe(mix, per, c),
      mwmed_ref: vr,
      participacao_ref: ref ? participacaoDe(ref, per, c) : null,
      ressalva: textoRessalva(mix.ressalvas_universo[c], idioma),
      presenca: dias !== undefined ? tx(`linha em ${f.num(dias, 0)} de ${f.num(mix.dias, 0)} dias`, `row on ${f.num(dias, 0)} of ${f.num(mix.dias, 0)} days`) : null,
    });
  }
  return out;
}

export function colunasMatriz(janela: JanelaMatriz, per: Perimetro, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const rj = rotuloJanela(idioma);
  const ref = janelaReferencia(janela);
  const p = per === "com" ? tx("com MMGD", "with MMGD") : tx("sem MMGD", "without MMGD");
  const u = mwmed(idioma);
  return [
    { id: "categoria", rotulo: tx("Categoria", "Category"), tipo: "texto" },
    { id: "mwmed", rotulo: tx(`Geração, ${rj[janela]}`, `Generation, ${rj[janela]}`), tipo: "numero", unidade: u, casas: 1 },
    { id: "participacao", rotulo: tx(`Participação, ${rj[janela]} (${p})`, `Share, ${rj[janela]} (${p})`), tipo: "percentual", casas: 2 },
    { id: "mwmed_ref", rotulo: tx(`Geração, ${rj[ref]}`, `Generation, ${rj[ref]}`), tipo: "numero", unidade: u, casas: 1 },
    { id: "participacao_ref", rotulo: tx(`Participação, ${rj[ref]} (${p})`, `Share, ${rj[ref]} (${p})`), tipo: "percentual", casas: 2 },
    { id: "ressalva", rotulo: tx("Ressalva de universo", "Coverage caveat"), tipo: "texto" },
    { id: "presenca", rotulo: tx("Presença parcial no período", "Partial presence in the period"), tipo: "texto" },
  ];
}

/** Ordem decrescente pela participação; ausência no fim. */
function ordenaPorParticipacao(linhas: readonly LinhaMatriz[]): LinhaMatriz[] {
  return [...linhas].sort((a, b) => (b.participacao ?? -Infinity) - (a.participacao ?? -Infinity));
}

/**
 * Resposta curta do P021 para o recorte pedido: total, as maiores participações, a
 * natureza do dado e as ressalvas de universo. Tudo lido da janela; nenhuma soma de
 * participações é feita aqui.
 */
export function respostaMatriz(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return tx(`Sem janela publicada ${noRegiao(idioma)[rg]} nesta publicação.`, `No window published ${noRegiao(idioma)[rg]} in this release.`);
  const total = totalDe(mix, per);
  const frase = fraseCategoria(idioma);
  const nomes = Object.fromEntries(CATEGORIAS.map((c) => [c, frase[c]])) as Record<CategoriaGeracao, string>;
  const linhas = ordenaPorParticipacao(linhasMatriz(m, rg, janela, per, nomes, idioma)).filter((l) => (l.participacao ?? 0) > 0);
  const maiores = linhas.slice(0, 5).map((l) => `${l.categoria} ${f.num(l.participacao, 1)}%`);
  const quando =
    janela === "dia"
      ? tx(`Em ${f.dataBR(mix.inicio)}`, `On ${f.dataBR(mix.inicio)}`)
      : tx(`De ${f.dataBR(mix.inicio)} a ${f.dataBR(mix.fim)} (${f.plural(mix.dias, "dia", "dias")})`, `From ${f.dataBR(mix.inicio)} to ${f.dataBR(mix.fim)} (${f.plural(mix.dias, "day", "days")})`);
  const perimetro = per === "sem" ? tx(", sem a MMGD estimada pelo ONS,", ", without the MMGD estimated by the ONS,") : "";
  const frases = [
    tx(`${quando}, a geração ${doRegiao(idioma)[rg]}${perimetro} foi de ${f.num(total, 0)} MWmed em média.`, `${quando}, generation ${doRegiao(idioma)[rg]}${perimetro} averaged ${f.num(total, 0)} MWavg.`),
    maiores.length
      ? tx(`As maiores participações: ${listaTexto(maiores, idioma)}.`, `The largest shares: ${listaTexto(maiores, idioma)}.`)
      : tx("Nenhuma categoria com geração positiva no período.", "No category had positive generation in the period."),
  ];
  const nat = mix.natureza_pct;
  if (per === "com" && nat.verificada !== null) {
    const partes = [tx(`medição ${f.num(nat.verificada, 1)}%`, `measurement ${f.num(nat.verificada, 1)}%`)];
    if (nat.grupo_tipo3 !== null) partes.push(tx(`previsão do ONS para pequenas usinas Tipo III ${f.num(nat.grupo_tipo3, 1)}%`, `ONS forecast for small Type III plants ${f.num(nat.grupo_tipo3, 1)}%`));
    if (nat.grupo_mmgd !== null) partes.push(tx(`estimativa do ONS para a MMGD ${f.num(nat.grupo_mmgd, 1)}%`, `ONS estimate for the MMGD ${f.num(nat.grupo_mmgd, 1)}%`));
    frases.push(tx(`Natureza da energia: ${listaTexto(partes, idioma)}.`, `Nature of the energy: ${listaTexto(partes, idioma)}.`));
  }
  if (per === "sem" && mix.participacao.solar_mmgd !== null) {
    frases.push(
      tx(
        `A MMGD estimada, fora deste perímetro, foi ${f.num(mix.participacao.solar_mmgd, 1)}% do total com ela.`,
        `The estimated MMGD, outside this scope, was ${f.num(mix.participacao.solar_mmgd, 1)}% of the total including it.`,
      ),
    );
  }
  const ress = CATEGORIAS.filter((c) => mix.ressalvas_universo[c] && !(per === "sem" && c === "solar_mmgd"));
  if (ress.length) {
    const quais = inicial(listaTexto(ress.map((c) => frase[c]), idioma));
    frases.push(
      tx(
        `${quais} ${ress.length === 1 ? "tem" : "têm"} ressalva de universo: a fonte publicou menos usinas com dado no período, e a participação não se compara com a de antes.`,
        `${quais} ${ress.length === 1 ? "has" : "have"} a coverage caveat: the source published fewer plants with data in the period, and the share is not comparable with earlier periods.`,
      ),
    );
  }
  return frases.join(" ");
}

/** Categorias com ressalva na janela, com o texto de cada uma (lista visível junto da participação). */
export function ressalvasDaJanela(mix: Mix | null, nomes: Record<CategoriaGeracao, string>, idioma: Idioma = idiomaEnergia()): { id: CategoriaGeracao; nome: string; texto: string }[] {
  if (!mix) return [];
  return CATEGORIAS.filter((c) => mix.ressalvas_universo[c]).map((c) => ({ id: c, nome: nomes[c], texto: textoRessalva(mix.ressalvas_universo[c], idioma)! }));
}

/** Minúscula só nas palavras apenas capitalizadas: "Previsão do ONS (grupos Tipo III)" vira "previsão do ONS (grupos tipo III)"; a sigla fica como está. */
export function minusculaPalavras(s: string): string {
  return s.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => (/^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]+$/.test(w) ? w.toLowerCase() : w));
}

/** Natureza da energia na janela (para o recorte do painel). */
export function textoNatureza(nat: Record<NaturezaGeracao, number | null>, idioma: Idioma = idiomaEnergia()): string {
  const f = formatos(idioma);
  const curto = curtoNatureza(idioma);
  const partes = NATUREZAS.filter((n) => nat[n] !== null).map((n) => `${minusculaPalavras(curto[n])} ${f.num(nat[n], 1)}%`);
  return partes.length ? listaTexto(partes, idioma) : tx("sem natureza publicada", "no data nature published", idioma);
}

/* ---------- série mensal empilhada (energia por fonte ao longo do tempo) ---------- */

export type LinhaMesMatriz = { id: string; m: string; mes: string; rotulo: string; total: number | null; parcial: string; dias: number; ressalvas: string } & Partial<
  Record<CategoriaGeracao, number | null>
>;

/** Primeiro mês com a MMGD presente em todos os dias (antes dele, o perímetro com MMGD não existe inteiro). */
export function primeiroMesComMmgd(ms: Pick<MensalSin, "meses" | "solar_mmgd" | "dias_com_linha">): string | null {
  const parcial = ms.dias_com_linha.solar_mmgd ?? {};
  for (let i = 0; i < ms.meses.length; i++) if (ms.solar_mmgd[i] !== null && parcial[ms.meses[i]] === undefined) return ms.meses[i];
  return null;
}

/** Meses em que uma categoria existe só em parte dos dias (a MMGD em abr/2023, por exemplo): o mês, os dias com linha e os dias do mês. */
export function mesesComPresencaParcial(ms: Pick<MensalSin, "meses" | "dias_no_mes" | "dias_com_linha">, cat: CategoriaGeracao): { mes: string; dias: number; diasDoMes: number }[] {
  const por = ms.dias_com_linha[cat] ?? {};
  return ms.meses.flatMap((m, i) => (por[m] !== undefined ? [{ mes: m, dias: por[m], diasDoMes: ms.dias_no_mes[i] }] : []));
}

/**
 * Energia média mensal do SIN por categoria. Com MMGD: só os meses em que a MMGD existe em
 * todos os dias (desde maio de 2023); sem MMGD: toda a série, que pode cruzar 29/04/2023.
 * Categoria sem nenhum valor no recorte fica fora das séries.
 */
export function linhasMensalMatriz(ms: MensalSin, per: Perimetro, idioma: Idioma = idiomaEnergia()): { linhas: LinhaMesMatriz[]; series: CategoriaGeracao[] } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const curto = curtoCategoria(idioma);
  const inicio = per === "com" ? primeiroMesComMmgd(ms) : ms.meses[0];
  const linhas: LinhaMesMatriz[] = [];
  for (let i = 0; i < ms.meses.length; i++) {
    const m = ms.meses[i];
    if (!inicio || m < inicio) continue;
    const l: LinhaMesMatriz = {
      id: m,
      m,
      mes: f.mesAno(m),
      // o mês incompleto leva a marca no próprio eixo do gráfico, não só na nota
      rotulo: ms.parcial[i] ? tx(`${f.mesAno(m)} (parcial)`, `${f.mesAno(m)} (partial)`) : f.mesAno(m),
      total: per === "com" ? ms.total_mwmed[i] : ms.total_sem_mmgd_mwmed[i],
      parcial: ms.parcial[i]
        ? tx(`parcial (${f.num(ms.dias_completos[i], 0)} de ${f.num(ms.dias_no_mes[i], 0)} dias)`, `partial (${f.num(ms.dias_completos[i], 0)} of ${f.num(ms.dias_no_mes[i], 0)} days)`)
        : tx("não", "no"),
      dias: ms.dias_completos[i],
      ressalvas: CATEGORIAS.filter((c) => (ms.ressalvas_universo[c] ?? []).includes(m))
        .map((c) => curto[c])
        .join(", "),
    };
    for (const c of CATEGORIAS) if (!(per === "sem" && c === "solar_mmgd")) l[c] = ms[c][i];
    linhas.push(l);
  }
  const series = CATEGORIAS.filter((c) => !(per === "sem" && c === "solar_mmgd") && linhas.some((l) => l[c] !== null && l[c] !== undefined));
  return { linhas, series };
}

export function colunasMensalMatriz(series: readonly CategoriaGeracao[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const curto = curtoCategoria(idioma);
  const u = mwmed(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    ...series.map((c): ColunaTabela => ({ id: c, rotulo: curto[c], tipo: "numero", unidade: u, casas: 1 })),
    { id: "total", rotulo: tx("Total", "Total"), tipo: "numero", unidade: u, casas: 1 }, // i18n: dado
    { id: "parcial", rotulo: tx("Mês parcial", "Partial month"), tipo: "texto" },
    { id: "ressalvas", rotulo: tx("Categorias com ressalva de universo", "Categories with a coverage caveat"), tipo: "texto" },
  ];
}

/** Série mensal de até quatro categorias, para a comparação na mesma escala. */
export function linhasCategoriasMensal(ms: MensalSin, cats: readonly CategoriaGeracao[]): ({ id: string; m: string } & Partial<Record<CategoriaGeracao, number | null>>)[] {
  return ms.meses.map((m, i) => {
    const l: { id: string; m: string } & Partial<Record<CategoriaGeracao, number | null>> = { id: m, m };
    for (const c of cats) l[c] = ms[c][i];
    return l;
  });
}

/** Mudanças de universo da fonte como marcos (data em AAAA-MM). */
export function marcosMensais(quebras: readonly Quebra[], meses: readonly string[], idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const out: { x: string; rotulo: string }[] = [];
  const tem = new Set(meses);
  const add = (x: string, rotulo: string) => {
    if (tem.has(x) && !out.some((o) => o.x === x)) out.push({ x, rotulo });
  };
  for (const q of quebras.filter((x) => x.origem === "FONTE")) {
    const oQue = q.tipo === "rotulo_novo" ? tx("grupos novos na fonte", "new groups in the source") : tx("mudança declarada pela fonte", "change declared by the source");
    add(q.data.slice(0, 7), `${f.mesAno(q.data.slice(0, 7))}: ${oQue}`);
  }
  return out;
}

/* ---------- séries recentes (60 dias e 72 horas) ---------- */

export function linhasRecentes(eixo: readonly string[], serie: Matriz["diario_sin_recente"] | Matriz["horario_sin_recente"]): ({ id: string; x: string } & Partial<Record<CategoriaGeracao, number | null>>)[] {
  return eixo.map((x, i) => {
    const l: { id: string; x: string } & Partial<Record<CategoriaGeracao, number | null>> = { id: x, x };
    for (const c of serie.categorias) l[c] = serie[c]?.[i] ?? null;
    return l;
  });
}

export function colunasRecentes(cats: readonly CategoriaGeracao[], rotuloX: string, tipoX: "data" | "texto", idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const curto = curtoCategoria(idioma);
  const u = mwmed(idioma);
  return [{ id: "x", rotulo: rotuloX, tipo: tipoX }, ...cats.map((c): ColunaTabela => ({ id: c, rotulo: curto[c], tipo: "numero", unidade: u, casas: 1 }))];
}

/* ---------- natureza mensal ---------- */

export function linhasNaturezaMensal(n: NaturezaMensal, idioma: Idioma = idiomaEnergia()): { id: string; m: string; mes: string; verificada: number | null; grupo_tipo3: number | null; grupo_mmgd: number | null }[] {
  const f = formatos(idioma);
  return n.meses.map((m, i) => ({ id: m, m, mes: f.mesAno(m), verificada: n.verificada[i], grupo_tipo3: n.grupo_tipo3[i], grupo_mmgd: n.grupo_mmgd[i] }));
}

export function colunasNaturezaMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const curto = curtoNatureza(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "verificada", rotulo: curto.verificada, tipo: "percentual", casas: 2 },
    { id: "grupo_tipo3", rotulo: curto.grupo_tipo3, tipo: "percentual", casas: 2 },
    { id: "grupo_mmgd", rotulo: curto.grupo_mmgd, tipo: "percentual", casas: 2 },
  ];
}

/* ---------- comparação de 12 meses ---------- */

export type LinhaDozeMeses = {
  id: CategoriaGeracao;
  rotulo: string;
  atual: number | null;
  anterior: number | null;
  variacao_pct: number | null;
  situacao: string;
  /** Geração, no mesmo mês de um ano antes, das usinas que ficaram sem dado no último mês: ordem de grandeza da lacuna ao lado da variação. */
  lacuna_gwh: number | null;
};

/**
 * 365 dias contra os 365 anteriores, na geração média de cada categoria (MWmed da janela de
 * 365 dias do SIN e da comparação publicada). Variação suprimida é dita como tal.
 */
export function linhasDozeMeses(c: ComparacaoDozeMeses, atual: Mix | null, universo?: Pick<Matriz["universo"], "lacuna_ultimo_mes">, idioma: Idioma = idiomaEnergia()): LinhaDozeMeses[] {
  if (!atual || atual.inicio !== c.atual.inicio || atual.fim !== c.atual.fim) return [];
  const tx = txEm(idioma);
  const curto = curtoCategoria(idioma);
  const lacuna = universo?.lacuna_ultimo_mes?.detalhe_por_categoria;
  return CATEGORIAS.filter((k) => atual.mwmed[k] !== null || c.anterior_mwmed[k] !== null).map((k) => {
    const sup = c.variacao_suprimida[k];
    const situacao = sup
      ? tx(`variação suprimida: ${sup.motivo}`, `variation suppressed: ${rotuloGold(sup.motivo, idioma, "change in the number of plants with data in the source")}`)
      : c.variacao_pct[k] === null
        ? c.anterior_mwmed[k] === null
          ? tx("sem valor na janela anterior", "no value in the previous window")
          : tx("sem variação publicada", "no variation published")
        : tx("comparável", "comparable");
    return { id: k, rotulo: curto[k], atual: atual.mwmed[k], anterior: c.anterior_mwmed[k], variacao_pct: c.variacao_pct[k], situacao, lacuna_gwh: lacuna?.[k] ? gwh(lacuna[k]!.mwh_dos_ausentes_mesmo_mes_ano_anterior) : null };
  });
}

/**
 * Categorias que seguem comparáveis (sem variação suprimida) mas têm usinas sem dado no último mês, com a geração delas no mesmo mês
 * de um ano antes: a lacuna pequena não suprime a variação, e a página mostra o tamanho dela ao lado.
 */
export function lacunaDasComparaveis(
  c: Pick<ComparacaoDozeMeses, "variacao_pct" | "variacao_suprimida">,
  universo: Pick<Matriz["universo"], "lacuna_ultimo_mes">,
  idioma: Idioma = idiomaEnergia(),
): { id: CategoriaGeracao; rotulo: string; gwh: number; mes: string; mesAnoAnterior: string }[] {
  const l = universo.lacuna_ultimo_mes;
  if (!l) return [];
  const curto = curtoCategoria(idioma);
  return CATEGORIAS.flatMap((k) => {
    const d = l.detalhe_por_categoria[k];
    const g = d ? gwh(d.mwh_dos_ausentes_mesmo_mes_ano_anterior) : null;
    return g !== null && g > 0 && c.variacao_pct[k] !== null && !c.variacao_suprimida[k] ? [{ id: k, rotulo: curto[k], gwh: g, mes: l.mes, mesAnoAnterior: l.mes_ano_anterior }] : [];
  }).sort((a, b) => b.gwh - a.gwh);
}

export function colunasDozeMeses(c: ComparacaoDozeMeses, universo?: Pick<Matriz["universo"], "lacuna_ultimo_mes">, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const u = mwmed(idioma);
  const lac = universo?.lacuna_ultimo_mes;
  return [
    { id: "rotulo", rotulo: tx("Categoria", "Category"), tipo: "texto" },
    { id: "atual", rotulo: tx(`${f.dataBR(c.atual.inicio)} a ${f.dataBR(c.atual.fim)}`, `${f.dataBR(c.atual.inicio)} to ${f.dataBR(c.atual.fim)}`), tipo: "numero", unidade: u, casas: 1 },
    { id: "anterior", rotulo: tx(`${f.dataBR(c.anterior.inicio)} a ${f.dataBR(c.anterior.fim)}`, `${f.dataBR(c.anterior.inicio)} to ${f.dataBR(c.anterior.fim)}`), tipo: "numero", unidade: u, casas: 1 },
    { id: "variacao_pct", rotulo: tx("Variação publicada", "Published variation"), tipo: "percentual", casas: 1 },
    { id: "situacao", rotulo: tx("Situação", "Status"), tipo: "texto" },
    ...(lac
      ? [
          {
            id: "lacuna_gwh",
            rotulo: tx(`Geração em ${f.mesAno(lac.mes_ano_anterior)} das usinas sem dado em ${f.mesAno(lac.mes)}`, `Generation in ${f.mesAno(lac.mes_ano_anterior)} of the plants without data in ${f.mesAno(lac.mes)}`),
            tipo: "numero" as const,
            unidade: "GWh",
            casas: 1,
          },
        ]
      : []),
  ];
}

export function textoDozeMeses(c: ComparacaoDozeMeses, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const sup = CATEGORIAS.filter((k) => c.variacao_suprimida[k]);
  const vt = c.variacao_total_sem_mmgd_pct;
  const variacao = vt === null ? tx("sem variação publicada", "no variation published") : `${vt > 0 ? "+" : vt < 0 ? "−" : ""}${f.num(Math.abs(vt), 1)}%`;
  const base = tx(
    `Total sem MMGD de ${f.dataBR(c.atual.inicio)} a ${f.dataBR(c.atual.fim)} contra os 365 dias anteriores: ${variacao}.`,
    `Total without MMGD from ${f.dataBR(c.atual.inicio)} to ${f.dataBR(c.atual.fim)} against the previous 365 days: ${variacao}.`,
  );
  const regime = c.mesmo_regime_mmgd
    ? tx(" As duas janelas são posteriores a 29/04/2023, e a MMGD se compara com ela mesma.", ` Both windows are after ${f.dataBR("2023-04-29")}, and the MMGD is compared with itself.`)
    : tx(" As janelas atravessam 29/04/2023: a MMGD não entra na comparação.", ` The windows cross ${f.dataBR("2023-04-29")}: the MMGD is left out of the comparison.`);
  const frase = fraseCategoria(idioma);
  const quais = inicial(listaTexto(sup.map((k) => frase[k]), idioma));
  const s = sup.length
    ? tx(
        ` ${quais}: variação suprimida: o número de usinas com dado na fonte mudou dentro das janelas comparadas.`,
        ` ${quais}: variation suppressed: the number of plants with data in the source changed within the compared windows.`,
      )
    : "";
  // com categorias suprimidas, o total das demais é o que se compara: o total completo muda também pelo cadastro de usinas da fonte
  const v = c.variacao_total_comparavel_pct;
  const sv = v !== null && v !== undefined ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${f.num(Math.abs(v), 1)}%` : "";
  const cmp = sup.length && v !== null && v !== undefined ? tx(` Só com as demais categorias, o total varia ${sv}.`, ` With the other categories only, the total varies by ${sv}.`) : "";
  return `${base}${regime}${s}${cmp}`;
}

/**
 * Quanto da inflexibilidade vem da nuclear e quanto ela vale sem a nuclear. A nuclear quase não varia de
 * despacho (a inflexibilidade é a quase totalidade da sua geração) e pesa na parcela total; sem ela, a
 * parcela é a das demais térmicas. Null quando falta o total, o motivo ou a nuclear.
 */
export function inflexibilidadeSemNuclear(u: {
  total_mwh: number | null;
  por_motivo: { motivo: string; mwh: number | null }[];
  por_combustivel: { categoria: string; mwh: number | null; motivos_mwh: Record<string, number | null> }[];
}): { nuclearNaInflexibilidadePct: number; nuclearInflexivelPct: number; semNuclearPct: number } | null {
  const infl = u.por_motivo.find((m) => m.motivo === "inflexibilidade")?.mwh;
  const nuc = u.por_combustivel.find((c) => c.categoria === "nuclear");
  const nucInfl = nuc?.motivos_mwh.inflexibilidade;
  if (!u.total_mwh || !infl || !nuc?.mwh || nucInfl === null || nucInfl === undefined || u.total_mwh <= nuc.mwh) return null;
  return {
    nuclearNaInflexibilidadePct: (100 * nucInfl) / infl,
    nuclearInflexivelPct: (100 * nucInfl) / nuc.mwh,
    semNuclearPct: (100 * (infl - nucInfl)) / (u.total_mwh - nuc.mwh),
  };
}

/* ---------- anos ---------- */

/**
 * MMGD nos dias com estimativa: a energia da MMGD dividida só pelas horas dos dias em que a estimativa do ONS existe, isto é, a
 * média do ano (que divide pelas horas do ano inteiro) vezes os dias do ano e dividida pelos dias com estimativa. Sem estimativa
 * no ano é ausência (não zero); num ano com estimativa em todos os dias coincide com a média do ano.
 */
export function mmgdNosDiasComEstimativa(a: Pick<AnoSin, "mwmed" | "dias" | "mmgd_dias">): number | null {
  const v = a.mwmed.solar_mmgd;
  if (v === null || a.mmgd_dias <= 0 || a.dias <= 0) return null;
  return (v * a.dias) / a.mmgd_dias;
}

/** Presença da MMGD estimada no ano, dita na linha como as janelas dizem a presença parcial de uma categoria. */
export function presencaMmgdNoAno(a: Pick<AnoSin, "dias" | "mmgd_dias">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (a.mmgd_dias <= 0) return tx("sem estimativa no ano", "no estimate in the year");
  if (a.mmgd_dias < a.dias) return tx(`parcial: estimativa em ${f.num(a.mmgd_dias, 0)} de ${f.num(a.dias, 0)} dias`, `partial: estimate on ${f.num(a.mmgd_dias, 0)} of ${f.num(a.dias, 0)} days`);
  return tx("estimativa em todos os dias", "estimate on every day");
}

export type LinhaAnual = { id: string; ano: string; dias: number; parcial: string; total_sem_mmgd_mwmed: number | null; mmgd_dias: number; presenca_mmgd: string; mmgd_mwmed: number | null; mmgd_nos_dias_mwmed: number | null; verificada_pct: number | null } & Partial<Record<CategoriaGeracao, number | null>>;

export function linhasAnuais(anos: readonly AnoSin[], idioma: Idioma = idiomaEnergia()): LinhaAnual[] {
  const tx = txEm(idioma);
  return anos.map((a) => {
    const l: LinhaAnual = {
      id: String(a.ano),
      ano: String(a.ano),
      dias: a.dias,
      parcial: a.parcial ? tx("sim, ano em curso", "yes, current year") : tx("não", "no"),
      total_sem_mmgd_mwmed: a.total_sem_mmgd_mwmed,
      mmgd_dias: a.mmgd_dias,
      presenca_mmgd: presencaMmgdNoAno(a, idioma),
      mmgd_mwmed: a.mwmed.solar_mmgd,
      mmgd_nos_dias_mwmed: mmgdNosDiasComEstimativa(a),
      verificada_pct: a.natureza_pct.verificada,
    };
    for (const c of CATEGORIAS) if (c !== "solar_mmgd") l[c] = a.participacao_sem_mmgd[c];
    return l;
  });
}

export function colunasAnuais(anos: readonly AnoSin[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const curto = curtoCategoria(idioma);
  const u = mwmed(idioma);
  const cats = CATEGORIAS.filter((c) => c !== "solar_mmgd" && anos.some((a) => a.participacao_sem_mmgd[c] !== null));
  return [
    { id: "ano", rotulo: tx("Ano", "Year"), tipo: "texto" }, // i18n: dado
    { id: "dias", rotulo: tx("Dias completos", "Complete days"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "parcial", rotulo: tx("Ano em curso (parcial)", "Current year (partial)"), tipo: "texto" },
    { id: "total_sem_mmgd_mwmed", rotulo: tx("Total sem MMGD", "Total without MMGD"), tipo: "numero", unidade: u, casas: 1 },
    ...cats.map((c): ColunaTabela => ({ id: c, rotulo: tx(`${curto[c]} (sem MMGD)`, `${curto[c]} (without MMGD)`), tipo: "percentual", casas: 2 })),
    { id: "mmgd_dias", rotulo: tx("Dias com estimativa de MMGD", "Days with an MMGD estimate"), tipo: "numero", casas: 0 },
    { id: "presenca_mmgd", rotulo: tx("Presença da MMGD estimada no ano", "Presence of the estimated MMGD in the year"), tipo: "texto" },
    { id: "mmgd_mwmed", rotulo: tx("MMGD estimada, contribuição à média anual", "Estimated MMGD, contribution to the annual average"), tipo: "numero", unidade: u, casas: 1 },
    { id: "mmgd_nos_dias_mwmed", rotulo: tx("MMGD estimada, média dos dias com estimativa", "Estimated MMGD, average of the days with an estimate"), tipo: "numero", unidade: u, casas: 1 },
    { id: "verificada_pct", rotulo: tx("Parcela de medição no total com MMGD", "Measurement share of the total with MMGD"), tipo: "percentual", casas: 2 },
  ];
}

/**
 * Nota da tabela anual, montada dos dados: o ano em que a MMGD entra pela metade, as duas médias da MMGD (ano inteiro e dias com
 * estimativa) e o denominador da parcela de medição, que passa a incluir a MMGD no mesmo ano.
 */
export function notaAnual(anos: readonly AnoSin[], primeiroDiaMmgd: string | null, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const parcial = anos.find((a) => a.mmgd_dias > 0 && a.mmgd_dias < a.dias);
  const desde = primeiroDiaMmgd ? f.dataBR(primeiroDiaMmgd) : tx("data não informada", "date not reported");
  const entrada = parcial
    ? tx(` (em ${parcial.ano}, ${f.num(parcial.mmgd_dias, 0)} dos ${f.num(parcial.dias, 0)} dias)`, ` (in ${parcial.ano}, ${f.num(parcial.mmgd_dias, 0)} of the ${f.num(parcial.dias, 0)} days)`)
    : "";
  const fracao = parcial
    ? tx(
        ` (em ${parcial.ano} vale ${f.num(parcial.mmgd_dias, 0)}/${f.num(parcial.dias, 0)} da média dos dias com estimativa)`,
        ` (in ${parcial.ano} it equals ${f.num(parcial.mmgd_dias, 0)}/${f.num(parcial.dias, 0)} of the average of the days with an estimate)`,
      )
    : "";
  return [
    tx("O ano em curso é parcial e não se compara com anos completos sem esse aviso.", "The current year is partial and is not compared with complete years without this warning."),
    tx(
      `A estimativa da MMGD só existe a partir de ${desde}${entrada}: ela não entra na participação por categoria desta tabela, que é sem MMGD, e aparece em MWmed.`,
      `The MMGD estimate only exists from ${desde}${entrada}: it does not enter the share by category in this table, which excludes MMGD, and appears in MWavg.`,
    ),
    tx(
      `A contribuição à média anual divide a energia da MMGD pelas horas do ano inteiro${fracao}; a média dos dias com estimativa divide só pelas horas dos dias em que a estimativa existe (média anual vezes os dias do ano, dividida pelos dias com estimativa).`,
      `The contribution to the annual average divides the MMGD energy by the hours of the whole year${fracao}; the average of the days with an estimate divides only by the hours of the days on which the estimate exists (annual average times the days in the year, divided by the days with an estimate).`,
    ),
    tx(
      `A parcela de medição usa o total com a MMGD desde a entrada dela; antes, o total não a inclui, e a queda entre esses anos inclui a entrada da MMGD no total, não só mudança na medição.`,
      "The measurement share uses the total including the MMGD from its entry onward; before that, the total does not include it, and the drop between those years includes the entry of the MMGD into the total, not only a change in measurement.",
    ),
  ].join(" ");
}

/* ---------- A11 ---------- */

export function linhasA11(a: Pick<A11, "tabela">) {
  return a.tabela.map((l) => ({ id: l.d, ...l }));
}

export function colunasA11(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const u = mwmed(idioma);
  return [
    { id: "d", rotulo: tx("Dia", "Day"), tipo: "data" },
    { id: "balanco_solar_mwmed", rotulo: tx("Solar no Balanço", "Solar in the Energy Balance"), tipo: "numero", unidade: u, casas: 1 },
    { id: "usinas_solar_mwmed", rotulo: tx("Soma das usinas fotovoltaicas", "Sum of photovoltaic plants"), tipo: "numero", unidade: u, casas: 1 },
    { id: "usinas_mmgd_mwmed", rotulo: tx("Grupos MMGD", "MMGD groups"), tipo: "numero", unidade: u, casas: 1 },
    { id: "usinas_sem_mmgd_mwmed", rotulo: tx("Usinas sem MMGD", "Plants without MMGD"), tipo: "numero", unidade: u, casas: 1 },
    { id: "diferenca_mwh", rotulo: tx("Balanço menos usinas", "Balance minus plants"), tipo: "numero", unidade: "MWh", casas: 3 },
  ];
}

export function linhasMmgdApi(a: Pick<A11, "comparacao_api_transicao">, idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  return a.comparacao_api_transicao.map((l) => ({ id: l.mes, m: l.mes, mes: f.mesAno(l.mes), usina_mwmed: l.usina_mwmed, api_mwmed: l.api_mwmed, razao_usina_api: l.razao_usina_api }));
}

export function colunasMmgdApi(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const u = mwmed(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "usina_mwmed", rotulo: tx("MMGD na Geração por Usina", "MMGD in the ONS generation by plant dataset"), tipo: "numero", unidade: u, casas: 1 },
    { id: "api_mwmed", rotulo: tx("MMGD na carga verificada (API)", "MMGD in verified load (API)"), tipo: "numero", unidade: u, casas: 1 },
    { id: "razao_usina_api", rotulo: tx("Razão entre as duas", "Ratio between the two"), tipo: "numero", casas: 3 },
  ];
}

/** Resumo do achado A11 lido da gold (dias conciliados, primeira hora, documentos). */
export function textoA11(a: A11, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (a.estado !== "confirmado") {
    const conclusao = a.conclusao ?? tx("sem conclusão publicada", "no conclusion published");
    return tx(`Verificação da quebra de 29/04/2023 pendente: ${conclusao}.`, `Check of the ${f.dataBR("2023-04-29")} break pending: ${conclusao}.`);
  }
  const prim = a.primeira_hora_mmgd ? f.horaLocal(a.primeira_hora_mmgd) : a.primeiro_dia_mmgd ? f.dataBR(a.primeiro_dia_mmgd) : tx("sem data", "no date");
  const janela = a.janela_da_quebra_conciliada
    ? tx(
        "Na janela da quebra, a solar do Balanço é igual à soma das usinas fotovoltaicas com a MMGD dia a dia.",
        "In the break window, solar in the Energy Balance equals the sum of photovoltaic plants plus the MMGD, day by day.",
      )
    : tx("Na janela da quebra, a solar do Balanço não fecha com a soma das usinas.", "In the break window, solar in the Energy Balance does not match the sum of the plants.");
  return tx(
    `A MMGD estimada pelo ONS aparece na Geração por Usina a partir de ${prim}. ${janela} Em todo o histórico, ${f.num(a.dias_conciliados, 0)} de ${f.num(a.dias_conferidos, 0)} dias conciliam dentro da tolerância.`,
    `The MMGD estimated by the ONS appears in the ONS generation by plant dataset from ${prim}. ${janela} Across the whole history, ${f.num(a.dias_conciliados, 0)} of ${f.num(a.dias_conferidos, 0)} days reconcile within the tolerance.`,
  );
}

/* ---------- auditoria da matriz ---------- */

export function nomeFonteBalanco(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: { hidraulica: "Hidráulica", termica: "Térmica (inclui nuclear)", eolica: "Eólica", solar: "Solar" },
    en: { hidraulica: "Hydropower", termica: "Thermal (includes nuclear)", eolica: "Wind", solar: "Solar" },
  });
}

export function linhasReconciliacaoFonte(r: Matriz["reconciliacao_balanco"], idioma: Idioma = idiomaEnergia()) {
  const nome = nomeFonteBalanco(idioma);
  return (Object.keys(r.por_fonte) as (keyof typeof r.por_fonte)[]).map((f) => ({ id: f, fonte: nome[f], ...r.por_fonte[f] }));
}

export function colunasReconciliacaoFonte(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "fonte", rotulo: tx("Fonte do Balanço", "Energy Balance source"), tipo: "texto" }, // i18n: dado
    { id: "sin_dias", rotulo: tx("Dias no SIN", "Days in the SIN"), tipo: "numero", casas: 0 },
    { id: "sin_dias_conciliados", rotulo: tx("Dias conciliados no SIN", "Reconciled days in the SIN"), tipo: "numero", casas: 0 },
    { id: "pct_sin_dias_conciliados", rotulo: tx("Dias conciliados no SIN", "Reconciled days in the SIN"), tipo: "percentual", casas: 2 },
    { id: "subsistema_dias", rotulo: tx("Subsistema-dias", "Subsystem-days"), tipo: "numero", casas: 0 },
    { id: "conciliados", rotulo: tx("Subsistema-dias conciliados", "Reconciled subsystem-days"), tipo: "numero", casas: 0 },
    { id: "soma_diferencas_mwh", rotulo: tx("Soma das diferenças", "Sum of the differences"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "soma_balanco_mwh", rotulo: tx("Energia no Balanço", "Energy in the Energy Balance"), tipo: "numero", unidade: "MWh", casas: 1 },
  ];
}

export function linhasDivergencias(r: Matriz["reconciliacao_balanco"], idioma: Idioma = idiomaEnergia()) {
  const nome = nomeFonteBalanco(idioma);
  const regiao = nomeRegiao(idioma);
  return r.maiores_divergencias.map((d) => ({ id: `${d.d}:${d.fonte}:${d.sm}`, d: d.d, fonte: nome[d.fonte], sm: regiao[d.sm], balanco_mwh: d.balanco_mwh, usinas_mwh: d.usinas_mwh, diferenca_mwh: d.diferenca_mwh }));
}

export function colunasDivergencias(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "d", rotulo: tx("Dia", "Day"), tipo: "data" },
    { id: "fonte", rotulo: tx("Fonte", "Source"), tipo: "texto", categorica: true }, // i18n: dado
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
    { id: "balanco_mwh", rotulo: tx("Balanço", "Energy Balance"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "usinas_mwh", rotulo: tx("Soma das usinas", "Sum of the plants"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "diferenca_mwh", rotulo: tx("Balanço menos usinas", "Balance minus plants"), tipo: "numero", unidade: "MWh", casas: 1 },
  ];
}

export function linhasReconciliacaoMensal(r: Matriz["reconciliacao_balanco"], idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  const nome = nomeFonteBalanco(idioma);
  return r.mensal_ultimos_6.map((x) => ({ ...x, id: `${x.mes}:${x.fonte}`, mes: f.mesAno(x.mes), m: x.mes, fonte: nome[x.fonte] }));
}

export function colunasReconciliacaoMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto", categorica: true },
    { id: "fonte", rotulo: tx("Fonte", "Source"), tipo: "texto", categorica: true }, // i18n: dado
    { id: "balanco_mwh", rotulo: tx("Balanço", "Energy Balance"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "usinas_mwh", rotulo: tx("Soma das usinas", "Sum of the plants"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "roraima_excluida_mwh", rotulo: tx("Térmica de Roraima fora do Balanço", "Roraima thermal outside the Energy Balance"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "diferenca_sem_roraima_mwh", rotulo: tx("Diferença sem Roraima", "Difference without Roraima"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "diferenca_pct", rotulo: tx("Diferença relativa", "Relative difference"), tipo: "percentual", casas: 3 },
    { id: "subsistema_dias_conciliados", rotulo: tx("Subsistema-dias conciliados", "Reconciled subsystem-days"), tipo: "numero", casas: 0 },
    { id: "subsistema_dias", rotulo: tx("Subsistema-dias", "Subsystem-days"), tipo: "numero", casas: 0 },
  ];
}

export function linhasRotulos(rotulos: readonly RotuloFonte[], idioma: Idioma = idiomaEnergia()) {
  const curto = curtoCategoria(idioma);
  const nat = curtoNatureza(idioma);
  return rotulos.map((r, i) => ({
    id: `${i}`,
    tipo: rotuloGold(r.tipo, idioma),
    combustivel: rotuloGold(r.combustivel, idioma),
    modalidade: r.modalidade === null ? null : rotuloGold(r.modalidade, idioma),
    categoria: curto[r.categoria],
    natureza: nat[r.natureza],
    gwh_12m: gwh(r.mwh_12m),
    gwh_desde_inicio: gwh(r.mwh_desde_inicio),
  }));
}

export function colunasRotulos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "tipo", rotulo: tx("Tipo (ONS)", "Type (ONS)"), tipo: "texto", categorica: true },
    { id: "combustivel", rotulo: tx("Combustível (ONS)", "Fuel (ONS)"), tipo: "texto" },
    { id: "modalidade", rotulo: tx("Modalidade (ONS)", "Modality (ONS)"), tipo: "texto", categorica: true },
    { id: "categoria", rotulo: tx("Categoria do painel", "Panel category"), tipo: "texto", categorica: true },
    { id: "natureza", rotulo: tx("Natureza", "Nature"), tipo: "texto", categorica: true },
    { id: "gwh_12m", rotulo: tx("Energia em 12 meses", "Energy in 12 months"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "gwh_desde_inicio", rotulo: tx("Energia desde 2021", "Energy since 2021"), tipo: "numero", unidade: "GWh", casas: 1 },
  ];
}

export function linhasOutrosPorCeg(o: Matriz["outros_por_ceg"], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return (o?.itens ?? []).map((x, i) => ({
    id: `${x.codigo_ceg ?? "sem"}:${i}`, // i18n: dado
    codigo: x.codigo_ceg ?? tx("sem CEG (conjuntos)", "no CEG (plant clusters)"),
    fonte_aneel: x.fonte_aneel === null ? null : rotuloGold(x.fonte_aneel, idioma),
    mwmed: x.mwmed,
    pct: x.pct_da_categoria,
    identificadores: x.identificadores,
    maiores: x.maiores.join(", "),
  }));
}

export function colunasOutrosCeg(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "codigo", rotulo: tx("Código de combustível no CEG", "Fuel code in the CEG"), tipo: "texto" },
    { id: "fonte_aneel", rotulo: tx("Fonte na classificação da ANEEL", "Source in the ANEEL classification"), tipo: "texto" },
    { id: "mwmed", rotulo: tx("Geração média", "Average generation"), tipo: "numero", unidade: mwmed(idioma), casas: 1 },
    { id: "pct", rotulo: tx("Parcela de outras térmicas", "Share of other thermal"), tipo: "percentual", casas: 2 },
    { id: "identificadores", rotulo: tx("Identificadores", "Identifiers"), tipo: "numero", casas: 0 },
    { id: "maiores", rotulo: tx("Maiores", "Largest"), tipo: "texto" },
  ];
}

export function linhasLacuna(u: Matriz["universo"], idioma: Idioma = idiomaEnergia()) {
  const l = u.lacuna_ultimo_mes;
  if (!l) return [];
  const curto = curtoCategoria(idioma);
  return CATEGORIAS.filter((c) => l.detalhe_por_categoria[c]).map((c) => {
    const d = l.detalhe_por_categoria[c]!;
    return { id: c, categoria: curto[c], com_valor_no_mes: d.com_valor_no_mes, com_valor_ano_anterior: d.com_valor_mesmo_mes_ano_anterior, sem_valor: d.sem_valor, sem_linhas: d.sem_linhas, gwh_ausentes_ano_anterior: gwh(d.mwh_dos_ausentes_mesmo_mes_ano_anterior) };
  });
}

export function colunasLacuna(u: Matriz["universo"], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const l = u.lacuna_ultimo_mes;
  const mes = l ? f.mesAno(l.mes) : tx("último mês", "the latest month");
  const ant = l ? f.mesAno(l.mes_ano_anterior) : tx("um ano antes", "a year earlier");
  return [
    { id: "categoria", rotulo: tx("Categoria", "Category"), tipo: "texto" },
    { id: "com_valor_no_mes", rotulo: tx(`Usinas com dado em ${mes}`, `Plants with data in ${mes}`), tipo: "numero", casas: 0 },
    { id: "com_valor_ano_anterior", rotulo: tx(`Usinas com dado em ${ant}`, `Plants with data in ${ant}`), tipo: "numero", casas: 0 },
    { id: "sem_valor", rotulo: tx(`Com linhas vazias em ${mes}`, `With empty rows in ${mes}`), tipo: "numero", casas: 0 },
    { id: "sem_linhas", rotulo: tx(`Sem linhas em ${mes}`, `Without rows in ${mes}`), tipo: "numero", casas: 0 },
    { id: "gwh_ausentes_ano_anterior", rotulo: tx(`Geração publicada para os mesmos ausentes em ${ant}`, `Generation published for the same missing plants in ${ant}`), tipo: "numero", unidade: "GWh", casas: 1 },
  ];
}

export function rotuloQuebra(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: {
      rotulo_novo: "Rótulo novo na fonte",
      rotulo_encerrado: "Rótulo some do arquivo",
      rotulo_sem_valor: "Rótulo só com linhas vazias",
      sequencia_zero: "Sequência de zero exato",
      roraima: "Roraima no Balanço",
      identificadores_sem_valor: "Identificadores sem valor",
      salto_de_universo: "Salto no número de usinas",
    },
    en: {
      rotulo_novo: "New label in the source",
      rotulo_encerrado: "Label disappears from the file",
      rotulo_sem_valor: "Label with empty rows only",
      sequencia_zero: "Run of exact zeros",
      roraima: "Roraima in the Energy Balance",
      identificadores_sem_valor: "Identifiers without a value",
      salto_de_universo: "Jump in the number of plants",
    },
  });
}

export function linhasQuebras(q: readonly Quebra[], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const rotulo = rotuloQuebra(idioma);
  const curto = curtoCategoria(idioma);
  return q.map((x, i) => ({
    id: `${x.data}:${i}`,
    data: x.data,
    tipo: rotulo[x.tipo] ?? x.tipo,
    origem: x.origem === "FONTE" ? tx("declarada pela fonte", "declared by the source") : tx("detectada no dado", "detected in the data"),
    categorias: x.categorias.map((c) => curto[c as CategoriaGeracao] ?? c).join(", "),
    // descrição escrita pelo pipeline, em português (sem versão inglesa na gold)
    descricao: x.descricao,
  }));
}

export function colunasQuebras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "data", rotulo: tx("Data", "Date"), tipo: "data" },
    { id: "tipo", rotulo: tx("Tipo", "Type"), tipo: "texto", categorica: true },
    { id: "origem", rotulo: tx("Origem", "Origin"), tipo: "texto", categorica: true },
    { id: "categorias", rotulo: tx("Categorias", "Categories"), tipo: "texto" },
    { id: "descricao", rotulo: tx("Descrição (em português, como publicada)", "Description (in Portuguese, as published)"), tipo: "texto", idiomaTexto: "portugues" },
  ];
}

export function linhasControles(c: readonly ControleGeracao[], idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  return c.map((x, i) => {
    const nome = emPortugues(x.nome);
    return {
      id: `${i}`,
      nome: idioma === "en" ? (rotuloGoldEn(nome, CONTROLES_GERACAO_EN) ?? nome) : nome,
      resultado: idioma === "en" ? (RESULTADOS_CONTROLE_EN[x.resultado] ?? x.resultado) : x.resultado,
      critico: x.critico ? tx("sim", "yes") : tx("não", "no"),
      // detalhe escrito pelo pipeline, em português (sem versão inglesa na gold)
      detalhe: emPortugues(x.detalhe),
    };
  });
}

export function colunasControles(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("Controle", "Check"), tipo: "texto" },
    { id: "resultado", rotulo: tx("Resultado", "Result"), tipo: "texto", categorica: true },
    { id: "critico", rotulo: tx("Crítico", "Critical"), tipo: "texto", categorica: true },
    { id: "detalhe", rotulo: tx("Detalhe", "Detail (in Portuguese, as published)"), tipo: "texto", idiomaTexto: "portugues" },
  ];
}

export function linhasFontes(f: readonly FontePublicada[]) {
  return f.map((x) => ({ id: x.id, orgao: x.orgao, conjunto: x.conjunto, arquivos: x.arquivos, primeiro: x.primeiro_periodo, ultimo: x.ultimo_periodo, captura: x.ultima_captura, publicacao: x.publicacao_mais_recente, licenca: x.licenca, url: x.url }));
}

export function colunasFontes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "orgao", rotulo: tx("Órgão", "Agency"), tipo: "texto", categorica: true },
    { id: "conjunto", rotulo: tx("Conjunto", "Dataset (official name)"), tipo: "texto", idiomaTexto: "nome" },
    { id: "arquivos", rotulo: tx("Arquivos integrados", "Integrated files"), tipo: "numero", casas: 0 },
    { id: "primeiro", rotulo: tx("Primeiro período", "First period"), tipo: "texto" },
    { id: "ultimo", rotulo: tx("Último período", "Last period"), tipo: "texto" },
    { id: "captura", rotulo: tx("Última captura (UTC)", "Latest capture (UTC)"), tipo: "texto" },
    { id: "publicacao", rotulo: tx("Publicação mais recente na fonte (UTC)", "Most recent publication at the source (UTC)"), tipo: "texto" },
    { id: "licenca", rotulo: tx("Licença", "License (as published)"), tipo: "texto" },
    { id: "url", rotulo: tx("Endereço", "Address"), tipo: "texto" },
  ];
}

/** Regras publicadas na gold, com rótulo legível. */
export function rotuloRegraGeracao(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: {
      matriz: "Categorias e MWmed",
      participacao: "Participação",
      comparacao: "Comparações e a quebra de 2023",
      termica: "Motivos de despacho",
      restricao: "Energia não gerada, taxa e potência cortada",
      capacidade: "Fator de capacidade",
      janelas: "Janelas",
    },
    en: {
      matriz: "Categories and MWavg",
      participacao: "Share",
      comparacao: "Comparisons and the 2023 break",
      termica: "Dispatch reasons",
      restricao: "Energy not generated, rate and curtailed capacity",
      capacidade: "Capacity factor",
      janelas: "Windows",
    },
  });
}

/* ====================================================================== */
/* P022: despacho térmico                                                   */
/* ====================================================================== */

export const MOTIVOS: readonly MotivoDespacho[] = [
  "inflexibilidade",
  "merito",
  "unit_commitment",
  "exportacao",
  "substituicao",
  "razao_eletrica",
  "garantia_energetica",
  "gfom",
  "reposicao_perdas",
  "reserva_potencia",
];

export function curtoMotivo(idioma: Idioma = idiomaEnergia()): Record<MotivoDespacho, string> {
  return porIdioma(idioma, {
    pt: {
      merito: "Ordem de mérito",
      inflexibilidade: "Inflexibilidade",
      razao_eletrica: "Razão elétrica",
      garantia_energetica: "Garantia energética",
      gfom: "GFOM",
      reposicao_perdas: "Reposição de perdas",
      exportacao: "Exportação",
      reserva_potencia: "Reserva de potência",
      substituicao: "Substituição",
      unit_commitment: "Unit commitment",
    },
    en: {
      merito: "Merit order",
      inflexibilidade: "Inflexibility",
      razao_eletrica: "Electrical reason",
      garantia_energetica: "Energy security",
      gfom: "GFOM",
      reposicao_perdas: "Loss replacement",
      exportacao: "Export",
      reserva_potencia: "Capacity reserve",
      substituicao: "Replacement",
      unit_commitment: "Unit commitment",
    },
  });
}

export const COR_MOTIVO: Record<MotivoDespacho, string> = {
  inflexibilidade: "var(--serie-sm-se)",
  merito: "var(--cor-energia)", // i18n: dado
  unit_commitment: "var(--serie-termica)",
  exportacao: "var(--serie-sm-n)",
  substituicao: "var(--serie-solar)",
  razao_eletrica: "var(--cor-erro)",
  garantia_energetica: "var(--serie-eolica)",
  gfom: "var(--serie-3)",
  reposicao_perdas: "var(--serie-6)",
  reserva_potencia: "var(--serie-2)",
};

export const COMBUSTIVEIS: readonly CategoriaCombustivel[] = ["gas", "nuclear", "carvao", "outros", "biomassa", "oleo", "termica_sem_combustivel", "nao_mapeada"];

export function curtoCombustivel(idioma: Idioma = idiomaEnergia()): Record<CategoriaCombustivel, string> {
  return porIdioma(idioma, {
    pt: {
      gas: "Gás natural",
      nuclear: "Nuclear",
      carvao: "Carvão mineral",
      outros: "Outras térmicas",
      biomassa: "Biomassa",
      oleo: "Óleo e diesel",
      termica_sem_combustivel: "Térmicas Tipo III",
      nao_mapeada: "Sem combustível identificado",
    },
    en: {
      gas: "Natural gas",
      nuclear: "Nuclear",
      carvao: "Coal",
      outros: "Other thermal",
      biomassa: "Biomass",
      oleo: "Fuel oil and diesel",
      termica_sem_combustivel: "Type III thermal plants",
      nao_mapeada: "No identified fuel",
    },
  });
}

export const COR_COMBUSTIVEL: Record<CategoriaCombustivel, string> = {
  gas: COR_CATEGORIA.gas,
  nuclear: COR_CATEGORIA.nuclear,
  carvao: COR_CATEGORIA.carvao,
  outros: COR_CATEGORIA.outros,
  biomassa: COR_CATEGORIA.biomassa,
  oleo: COR_CATEGORIA.oleo,
  termica_sem_combustivel: COR_CATEGORIA.termica_sem_combustivel,
  nao_mapeada: COR_CATEGORIA.nao_mapeada,
};

/** O que o rótulo da base publicada diz entre parênteses sobre o motivo ("necessidade do SIN"); null quando o rótulo não traz. */
export function explicacaoDoMotivo(motivos: readonly { id: MotivoDespacho; rotulo: string }[], id: MotivoDespacho, idioma: Idioma = idiomaEnergia()): string | null {
  const m = motivos.find((x) => x.id === id);
  if (!m) return null;
  // em inglês, só a tradução exata do rótulo: sem ela, nenhuma explicação (nunca o parêntese em português)
  const rotulo = idioma === "en" ? rotuloGoldEn(m.rotulo) : m.rotulo;
  return rotulo ? (/\(([^()]+)\)\s*$/.exec(rotulo)?.[1] ?? null) : null;
}

/** Motivo pelo rótulo da gold (texto completo; em inglês, pela tabela exata, com o nome curto inglês como reserva). */
export function nomesMotivos(t: Pick<Termica, "motivos">, idioma: Idioma = idiomaEnergia()): Record<MotivoDespacho, string> {
  const curto = curtoMotivo(idioma);
  const out = { ...curto };
  for (const m of t.motivos) out[m.id] = rotuloGold(m.rotulo, idioma, curto[m.id]);
  return out;
}

/**
 * Resposta curta do P022: energia média dos 12 meses, motivos e combustíveis com maior
 * parcela (lidos da partição publicada) e o aviso de que o motivo é a classificação do ONS.
 */
export function respostaTermica(t: Pick<Termica, "ultimos_12m">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const cm = curtoMotivo(idioma);
  const cc = curtoCombustivel(idioma);
  const u = t.ultimos_12m;
  const motivos = [...u.por_motivo].filter((m) => (m.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const comb = [...u.por_combustivel].filter((c) => (c.pct_total ?? 0) > 0).sort((a, b) => (b.pct_total ?? 0) - (a.pct_total ?? 0));
  const frases = [
    tx(
      `De ${f.mesAno(u.inicio)} a ${f.mesAno(u.fim)}, as térmicas despachadas pelo ONS geraram ${f.num(u.total_mwmed, 0)} MWmed em média (${f.num(gwh(u.total_mwh), 0)} GWh).`,
      `From ${f.mesAno(u.inicio)} to ${f.mesAno(u.fim)}, the thermal plants dispatched by the ONS generated an average of ${f.num(u.total_mwmed, 0)} MWavg (${f.num(gwh(u.total_mwh), 0)} GWh).`,
    ),
  ];
  if (motivos.length) {
    const l = listaTexto(motivos.slice(0, 3).map((m) => `${minusculaPalavras(cm[m.motivo])} ${f.num(m.pct, 1)}%`), idioma);
    frases.push(tx(`Por motivo: ${l}.`, `By reason: ${l}.`));
  }
  if (comb.length) {
    const l = listaTexto(comb.slice(0, 3).map((c) => `${minusculaPalavras(cc[c.categoria])} ${f.num(c.pct_total, 1)}%`), idioma);
    frases.push(tx(`Por combustível: ${l}.`, `By fuel: ${l}.`));
  }
  if (u.nao_classificado_pct !== null) {
    frases.push(
      tx(
        `A diferença entre o total e a soma dos motivos (não classificada) é ${f.num(u.nao_classificado_pct, 3)}% da energia.`,
        `The difference between the total and the sum of the reasons (unclassified) is ${f.num(u.nao_classificado_pct, 3)}% of the energy.`,
      ),
    );
  }
  frases.push(tx("O motivo é a classificação publicada pelo ONS, não uma inferência a partir do preço.", "The reason is the classification published by the ONS, not an inference from the price."));
  return frases.join(" ");
}

export type LinhaCombustivelMotivo = { id: CategoriaCombustivel; combustivel: string; gwh: number | null; mwmed: number | null; pct_total: number | null; nao_classificado_gwh: number | null } & Partial<Record<MotivoDespacho, number | null>>;

/** Combustível × motivo dos 12 meses (GWh); a mesma matriz alimenta as barras empilhadas e a tabela. */
export function linhasCombustivelMotivo(t: Pick<Termica, "ultimos_12m">, idioma: Idioma = idiomaEnergia()): { linhas: LinhaCombustivelMotivo[]; motivos: MotivoDespacho[] } {
  const cc = curtoCombustivel(idioma);
  const linhas = t.ultimos_12m.por_combustivel.map((c) => {
    const l: LinhaCombustivelMotivo = { id: c.categoria, combustivel: cc[c.categoria], gwh: gwh(c.mwh), mwmed: c.mwmed, pct_total: c.pct_total, nao_classificado_gwh: gwh(c.nao_classificado_mwh) };
    for (const m of MOTIVOS) l[m] = gwh(c.motivos_mwh[m]);
    return l;
  });
  const motivos = MOTIVOS.filter((m) => linhas.some((l) => (l[m] ?? 0) > 0));
  return { linhas, motivos };
}

export function colunasCombustivelMotivo(motivos: readonly MotivoDespacho[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cm = curtoMotivo(idioma);
  return [
    { id: "combustivel", rotulo: tx("Combustível", "Fuel"), tipo: "texto" },
    { id: "gwh", rotulo: tx("Geração total", "Total generation"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "mwmed", rotulo: tx("Geração média", "Average generation"), tipo: "numero", unidade: mwmed(idioma), casas: 1 },
    { id: "pct_total", rotulo: tx("Parcela da geração térmica", "Share of thermal generation"), tipo: "percentual", casas: 2 },
    ...motivos.map((m): ColunaTabela => ({ id: m, rotulo: cm[m], tipo: "numero", unidade: "GWh", casas: 1 })),
    { id: "nao_classificado_gwh", rotulo: tx("Não classificado", "Unclassified"), tipo: "numero", unidade: "GWh", casas: 3 },
  ];
}

export function linhasMotivos12m(t: Pick<Termica, "ultimos_12m">, nomes: Record<MotivoDespacho, string>, idioma: Idioma = idiomaEnergia()) {
  const cm = curtoMotivo(idioma);
  return t.ultimos_12m.por_motivo.map((m) => ({ id: m.motivo, curto: cm[m.motivo], motivo: nomes[m.motivo], gwh: gwh(m.mwh), pct: m.pct }));
}

export function colunasMotivos12m(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "motivo", rotulo: tx("Motivo de despacho (ONS)", "Dispatch reason (ONS)"), tipo: "texto" },
    { id: "gwh", rotulo: tx("Geração", "Generation"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "pct", rotulo: tx("Parcela da geração térmica", "Share of thermal generation"), tipo: "percentual", casas: 2 },
  ];
}

export type JanelaTermica = "24m" | "tudo";
export const JANELAS_TERMICA: readonly JanelaTermica[] = ["24m", "tudo"];

export type LinhaTermicaMes = { id: string; m: string; mes: string; rotulo: string; total: number | null; nao_classificado: number | null; constrained_off: number | null; parcial: string } & Partial<Record<MotivoDespacho, number | null>>;

/** Série mensal do SIN por motivo (MWmed); "24m" corta nos 24 meses mais recentes publicados. */
export function linhasTermicaMensal(t: Pick<Termica, "mensal_sin">, janela: JanelaTermica, idioma: Idioma = idiomaEnergia()): { linhas: LinhaTermicaMes[]; motivos: MotivoDespacho[] } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const ms = t.mensal_sin;
  const ini = janela === "24m" ? Math.max(0, ms.meses.length - 24) : 0;
  const linhas: LinhaTermicaMes[] = [];
  for (let i = ini; i < ms.meses.length; i++) {
    const l: LinhaTermicaMes = {
      id: ms.meses[i],
      m: ms.meses[i],
      mes: f.mesAno(ms.meses[i]),
      rotulo: ms.parcial[i] ? tx(`${f.mesAno(ms.meses[i])} (parcial)`, `${f.mesAno(ms.meses[i])} (partial)`) : f.mesAno(ms.meses[i]),
      total: ms.total_mwmed[i],
      nao_classificado: ms.nao_classificado_mwmed[i],
      constrained_off: ms.constrained_off_mwmed[i],
      parcial: ms.parcial[i] ? tx("sim", "yes") : tx("não", "no"),
    };
    for (const m of MOTIVOS) l[m] = ms[m][i];
    linhas.push(l);
  }
  const motivos = MOTIVOS.filter((m) => linhas.some((l) => (l[m] ?? 0) > 0));
  return { linhas, motivos };
}

export function colunasTermicaMensal(motivos: readonly MotivoDespacho[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cm = curtoMotivo(idioma);
  const u = mwmed(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    ...motivos.map((m): ColunaTabela => ({ id: m, rotulo: cm[m], tipo: "numero", unidade: u, casas: 1 })),
    { id: "nao_classificado", rotulo: tx("Não classificado", "Unclassified"), tipo: "numero", unidade: u, casas: 2 },
    { id: "total", rotulo: tx("Total verificado", "Verified total"), tipo: "numero", unidade: u, casas: 1 }, // i18n: dado
    { id: "constrained_off", rotulo: tx("Constrained-off térmico (à parte)", "Thermal constrained-off (separate)"), tipo: "numero", unidade: u, casas: 1 },
    { id: "parcial", rotulo: tx("Mês parcial", "Partial month"), tipo: "texto" },
  ];
}

/** Série mensal por combustível de até quatro combustíveis (comparação na mesma escala). */
export function linhasCombustivelMensal(t: Pick<Termica, "mensal_combustivel">, cats: readonly CategoriaCombustivel[]): ({ id: string; m: string } & Partial<Record<CategoriaCombustivel, number | null>>)[] {
  const mc = t.mensal_combustivel;
  return mc.meses.map((m, i) => {
    const l: { id: string; m: string } & Partial<Record<CategoriaCombustivel, number | null>> = { id: m, m };
    for (const c of cats) l[c] = mc[c]?.[i] ?? null;
    return l;
  });
}

/** Combustíveis com algum valor positivo na série mensal (os escolhíveis na comparação). */
export function combustiveisComSerie(t: Pick<Termica, "mensal_combustivel">): CategoriaCombustivel[] {
  return COMBUSTIVEIS.filter((c) => (t.mensal_combustivel[c] ?? []).some((v) => (v ?? 0) > 0));
}

/** Motivo com maior parcela na usina (texto). */
export function motivoPrincipal(u: Pick<TermicaUsina, "motivos_pct">, idioma: Idioma = idiomaEnergia()): string {
  const e = (Object.entries(u.motivos_pct) as [MotivoDespacho, number][]).sort((a, b) => b[1] - a[1])[0];
  return e ? `${curtoMotivo(idioma)[e[0]]} (${formatos(idioma).num(e[1], 1)}%)` : tx("sem geração no período", "no generation in the period", idioma);
}

export function rotuloOrigemCombustivel(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: {
      termica_por_motivo: "campo da própria térmica por motivo",
      geracao_por_usina: "mesmo CEG na Geração por Usina",
      capacidade_instalada: "mesmo CEG na Capacidade Instalada",
      geracao_por_usina_ceg_base: "CEG sem versão na Geração por Usina",
      capacidade_instalada_ceg_base: "CEG sem versão na Capacidade Instalada",
      mesma_usina: "outra chave da mesma usina",
      nao_identificado: "não identificado",
    },
    en: {
      termica_por_motivo: "field of the thermal by dispatch reason dataset itself",
      geracao_por_usina: "same CEG in the ONS generation by plant dataset",
      capacidade_instalada: "same CEG in the ONS installed capacity dataset",
      geracao_por_usina_ceg_base: "CEG without version in the ONS generation by plant dataset",
      capacidade_instalada_ceg_base: "CEG without version in the ONS installed capacity dataset",
      mesma_usina: "another key of the same plant",
      nao_identificado: "not identified",
    },
  });
}

export function linhasUsinasTermicas(t: Pick<Termica, "usinas_12m">, idioma: Idioma = idiomaEnergia()) {
  const cc = curtoCombustivel(idioma);
  const regiao = nomeRegiao(idioma);
  const origem = rotuloOrigemCombustivel(idioma);
  return t.usinas_12m.map((u) => ({
    id: u.id,
    nome: u.nome ?? u.id,
    combustivel: cc[u.categoria],
    sm: u.sm ? (regiao[u.sm as Submercado] ?? u.sm) : null,
    gwh: gwh(u.mwh),
    mwmed: u.mwmed,
    motivo_principal: motivoPrincipal(u, idioma),
    inflexibilidade_pct: u.motivos_pct.inflexibilidade ?? (u.mwh ? 0 : null),
    merito_pct: u.motivos_pct.merito ?? (u.mwh ? 0 : null),
    cvu: u.cvu_semana_vigente,
    parcelas: u.parcelas.length + u.parcelas_omitidas,
    origem_combustivel: origem[u.origem_combustivel] ?? u.origem_combustivel,
    chaves: u.chaves_na_fonte.join(", "),
  }));
}

export function colunasUsinasTermicas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("Usina", "Plant"), tipo: "texto", idiomaTexto: "nome" },
    { id: "combustivel", rotulo: tx("Combustível", "Fuel"), tipo: "texto", categorica: true },
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
    { id: "gwh", rotulo: tx("Geração em 12 meses", "Generation in 12 months"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "mwmed", rotulo: tx("Geração média", "Average generation"), tipo: "numero", unidade: mwmed(idioma), casas: 1 },
    { id: "motivo_principal", rotulo: tx("Motivo com maior parcela", "Reason with the largest share"), tipo: "texto" },
    { id: "inflexibilidade_pct", rotulo: tx("Inflexibilidade", "Inflexibility"), tipo: "percentual", casas: 1 },
    { id: "merito_pct", rotulo: tx("Ordem de mérito", "Merit order"), tipo: "percentual", casas: 1 },
    { id: "cvu", rotulo: tx("CVU da semana vigente (parcela única)", "CVU for the current week (single portion)"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "parcelas", rotulo: tx("Parcelas no ONS", "Portions at the ONS"), tipo: "numero", casas: 0 },
    { id: "origem_combustivel", rotulo: tx("Origem do combustível", "Fuel origin"), tipo: "texto", categorica: true },
    { id: "chaves", rotulo: tx("Chaves na fonte (CEG)", "Keys in the source (CEG)"), tipo: "texto", buscavel: true },
  ];
}

/** Usina pedida (id), se publicada; senão a de maior geração. */
export function usinaTermicaEscolhida(t: Pick<Termica, "usinas_12m">, pedido: string): TermicaUsina | null {
  return t.usinas_12m.find((u) => u.id === pedido) ?? t.usinas_12m[0] ?? null;
}

/**
 * Motivos (% da geração de cada usina) de até quatro usinas, uma coluna por usina: a mesma
 * linha alimenta as barras agrupadas e a tabela. Motivo sem geração na usina é zero
 * (a gold só publica os motivos com geração; a usina gerou no período).
 */
export function linhasMotivosUsinas(usinas: readonly TermicaUsina[], idioma: Idioma = idiomaEnergia()): { id: MotivoDespacho; motivo: string; [usina: string]: number | null | string }[] {
  const cm = curtoMotivo(idioma);
  const motivos = MOTIVOS.filter((m) => usinas.some((u) => (u.motivos_pct[m] ?? 0) > 0));
  return motivos.map((m) => {
    const l: { id: MotivoDespacho; motivo: string; [usina: string]: number | null | string } = { id: m, motivo: cm[m] };
    for (const u of usinas) l[u.id] = u.mwh ? (u.motivos_pct[m] ?? 0) : null;
    return l;
  });
}

export function linhasParcelas(u: TermicaUsina) {
  return u.parcelas.map((p) => ({ id: String(p.cod), cod: p.cod, nome: p.nome, gwh: gwh(p.mwh), cvu: p.cvu_semana_vigente }));
}

export function colunasParcelas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "cod", rotulo: tx("Código do ONS nos modelos", "ONS code in the models"), tipo: "numero", casas: 0, buscavel: true },
    { id: "nome", rotulo: tx("Nome da parcela", "Portion name"), tipo: "texto", idiomaTexto: "nome" },
    { id: "gwh", rotulo: tx("Geração em 12 meses", "Generation in 12 months"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "cvu", rotulo: tx("CVU da semana vigente", "CVU for the current week"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}

/** CVU: quantis por combustível na semana vigente (custo declarado, não custo realizado). */
export function linhasCvuCombustivel(cvu: NonNullable<Termica["cvu"]>, idioma: Idioma = idiomaEnergia()) {
  const cc = curtoCombustivel(idioma);
  return cvu.por_combustivel.map((c) => ({ id: c.categoria, combustivel: cc[c.categoria], n: c.n, min: c.min, p25: c.p25, p50: c.p50, p75: c.p75, max: c.max }));
}

export function colunasCvuCombustivel(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "combustivel", rotulo: tx("Combustível", "Fuel"), tipo: "texto" },
    { id: "n", rotulo: tx("Parcelas com CVU", "Portions with a CVU"), tipo: "numero", casas: 0 },
    { id: "min", rotulo: tx("Mínimo", "Minimum"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p25", rotulo: tx("1º quartil", "1st quartile"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p50", rotulo: tx("Mediana", "Median"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p75", rotulo: tx("3º quartil", "3rd quartile"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "max", rotulo: tx("Máximo", "Maximum"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}

export function linhasCvuUsinas(cvu: NonNullable<Termica["cvu"]>, idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const cc = curtoCombustivel(idioma);
  const regiao = nomeRegiao(idioma);
  return cvu.usinas.map((u) => ({
    id: String(u.cod),
    cod: u.cod,
    nome: u.nome,
    sm: u.sm ? (regiao[u.sm as Submercado] ?? u.sm) : null,
    combustivel: cc[u.categoria],
    cvu: u.cvu,
    usina: u.usina ?? tx("sem par na térmica por motivo", "no match in thermal by dispatch reason"),
  }));
}

export function colunasCvuUsinas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "cod", rotulo: tx("Código do ONS", "ONS code"), tipo: "numero", casas: 0, buscavel: true },
    { id: "nome", rotulo: tx("Nome no CVU", "Name in the CVU"), tipo: "texto", idiomaTexto: "nome" },
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
    { id: "combustivel", rotulo: tx("Combustível", "Fuel"), tipo: "texto", categorica: true },
    { id: "cvu", rotulo: "CVU", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "usina", rotulo: tx("Usina na térmica por motivo", "Plant in thermal by dispatch reason"), tipo: "texto" }, // i18n: dado
  ];
}

export function linhasCvuMensal(cvu: NonNullable<Termica["cvu"]>, cats: readonly CategoriaCombustivel[]) {
  const mm = cvu.mediana_mensal;
  return mm.meses.map((m, i) => {
    const l: { id: string; m: string } & Partial<Record<CategoriaCombustivel, number | null>> = { id: m, m };
    for (const c of cats) l[c] = mm[c]?.[i] ?? null;
    return l;
  });
}

export function combustiveisCvu(cvu: NonNullable<Termica["cvu"]>): CategoriaCombustivel[] {
  return COMBUSTIVEIS.filter((c) => (cvu.mediana_mensal[c] ?? []).some((v) => v !== null));
}

export function textoCvu(cvu: NonNullable<Termica["cvu"]>, idioma: Idioma = idiomaEnergia()): ReactNode {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const s = cvu.semana;
  const semPar = cvu.cobertura.sem_par;
  // o estudo do ONS ("PMO Outubro 2026") e as usinas sem par ficam com o nome publicado; em inglês, marcados como nome próprio
  const nomesSemPar = semPar.flatMap((n, i) => [i === 0 ? "" : i === semPar.length - 1 ? tx(" e ", " and ") : ", ", nomeNo(n, idioma)]);
  return createElement(
    Fragment,
    null,
    tx(`Semana operativa de ${f.dataBR(s.inicio)} a ${f.dataBR(s.fim)}`, `Operating week from ${f.dataBR(s.inicio)} to ${f.dataBR(s.fim)}`),
    ...(s.estudo ? [" (", nomeNo(s.estudo, idioma), s.revisao !== null ? tx(`, revisão ${s.revisao}`, `, revision ${s.revisao}`) : "", ")"] : []),
    tx(
      `: ${f.num(cvu.cobertura.usinas_com_cvu, 0)} usinas com CVU, ${f.num(cvu.cobertura.pareadas_com_termica, 0)} pareadas com a térmica por motivo pelo código do ONS`,
      `: ${f.num(cvu.cobertura.usinas_com_cvu, 0)} plants with a CVU, ${f.num(cvu.cobertura.pareadas_com_termica, 0)} matched with thermal by dispatch reason through the ONS code`,
    ),
    ...(semPar.length ? [tx("; sem par: ", "; unmatched: "), ...nomesSemPar] : []),
    ".",
  );
}

export function linhasUniversoTermica(t: Pick<Termica, "universo">, idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  return t.universo.mensal.map((x) => ({ ...x, id: x.mes, m: x.mes, mes: f.mesAno(x.mes) }));
}

export function colunasUniversoTermica(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "termica_por_motivo_mwh", rotulo: tx("Térmica por motivo", "Thermal by dispatch reason"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "usinas_pareadas", rotulo: tx("Usinas pareadas", "Matched plants"), tipo: "numero", casas: 0 },
    { id: "usinas_sem_par", rotulo: tx("Usinas sem par", "Unmatched plants"), tipo: "numero", casas: 0 },
    { id: "pareadas_geracao_usina_mwh", rotulo: tx("As mesmas usinas na Geração por Usina", "The same plants in the ONS generation by plant dataset"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "diferenca_pareadas_pct", rotulo: tx("Diferença entre os conjuntos", "Difference between the datasets"), tipo: "percentual", casas: 2 },
    { id: "geracao_usina_tipo_i_iia_mwh", rotulo: tx("Térmicas Tipo I e II-A na Geração por Usina", "Type I and II-A thermal plants in the ONS generation by plant dataset"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "cobertura_tipo_i_iia_pct", rotulo: tx("Cobertura", "Coverage"), tipo: "percentual", casas: 2 },
  ];
}

/** O que o componente cliente do P022 recebe: a térmica sem as partes que só a auditoria usa. */
export type TermicaCliente = Omit<Termica, "cvu" | "universo" | "identidade" | "mapa_combustivel">;

/* ---------- contexto de 7 dias (Balanço, gold de operação) ---------- */

/** Participação térmica da semana e a posição no ano anterior, sem arredondar o percentil a inteiro. */
export function textoTermica7d(
  t: { participacao_7d: number | null; percentil: number | null; mediana_365d: number | null; p10_365d: number | null; p90_365d: number | null },
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (t.participacao_7d === null) return tx("Sem participação térmica de 7 dias nesta publicação.", "No 7-day thermal share in this release.");
  const pos =
    t.percentil === null
      ? ""
      : t.p90_365d !== null && t.participacao_7d > t.p90_365d
        ? tx(", acima da faixa usual do ano anterior", ", above the usual range of the previous year")
        : t.p10_365d !== null && t.participacao_7d < t.p10_365d
          ? tx(", abaixo da faixa usual do ano anterior", ", below the usual range of the previous year")
          : tx(", dentro da faixa usual do ano anterior", ", within the usual range of the previous year");
  const pct = t.percentil !== null ? tx(`, percentil ${f.num(t.percentil, 1)} das janelas de 7 dias do ano anterior`, `, percentile ${f.num(t.percentil, 1)} of the 7-day windows of the previous year`) : "";
  return tx(
    `No Balanço de Energia, as térmicas (com a nuclear) responderam por ${f.num(t.participacao_7d, 1)}% da geração nos últimos 7 dias${pct}${pos}.`,
    `In the ONS Energy Balance, thermal plants (including nuclear) accounted for ${f.num(t.participacao_7d, 1)}% of generation in the last 7 days${pct}${pos}.`,
  );
}

/* ====================================================================== */
/* P023: renováveis restringidas                                            */
/* ====================================================================== */

export type FonteRestricao = "eolica" | "solar";
export const FONTES_RESTRICAO: readonly FonteRestricao[] = ["eolica", "solar"];

export function nomeFonteRestricao(idioma: Idioma = idiomaEnergia()): Record<FonteRestricao, string> {
  return porIdioma(idioma, { pt: { eolica: "Eólicas", solar: "Fotovoltaicas" }, en: { eolica: "Wind", solar: "Photovoltaic" } });
}

export function fraseFonteRestricao(idioma: Idioma = idiomaEnergia()): Record<FonteRestricao, string> {
  return porIdioma(idioma, { pt: { eolica: "usinas eólicas", solar: "usinas fotovoltaicas" }, en: { eolica: "wind plants", solar: "photovoltaic plants" } });
}

export const RAZOES: readonly RazaoRestricao[] = ["ENE", "CNF", "REL", "PAR", "SEM"]; // i18n: dado

export function curtoRazao(idioma: Idioma = idiomaEnergia()): Record<RazaoRestricao, string> {
  return porIdioma(idioma, {
    pt: {
      REL: "Elétrica (REL)",
      CNF: "Confiabilidade (CNF)",
      ENE: "Energética (ENE)",
      PAR: "Parecer de acesso (PAR)",
      SEM: "Sem razão informada",
    },
    en: {
      REL: "Electrical (REL)",
      CNF: "Reliability (CNF)",
      ENE: "Energy (ENE)",
      PAR: "Access opinion (PAR)",
      SEM: "No reason given",
    },
  });
}

export function fraseRazao(idioma: Idioma = idiomaEnergia()): Record<RazaoRestricao, string> {
  return porIdioma(idioma, {
    pt: { REL: "razão elétrica", CNF: "confiabilidade", ENE: "razão energética", PAR: "parecer de acesso", SEM: "sem razão informada" },
    en: { REL: "electrical reason", CNF: "reliability", ENE: "energy reason", PAR: "access opinion", SEM: "no reason given" },
  });
}

export const COR_RAZAO: Record<RazaoRestricao, string> = {
  ENE: "var(--cor-energia)", // i18n: dado
  CNF: "var(--serie-sm-se)",
  REL: "var(--serie-termica)",
  PAR: "var(--serie-solar)",
  SEM: "var(--serie-referencia)",
};

export function nomeOrigem(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, { pt: { LOC: "Local", SIS: "Sistêmica", SEM: "Sem origem informada" }, en: { LOC: "Local", SIS: "Systemic", SEM: "No origin given" } });
}

/** "16/08/2026 às 10h30" a partir de "AAAA-MM-DDTHH:MM" ("Aug 16, 2026, 10:30" em inglês). */
export function instanteBR(ref: string | null, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  if (!ref) return tx("sem registro", "no record");
  const f = formatos(idioma);
  return tx(`${f.dataBR(ref)} às ${ref.slice(11, 13)}h${ref.slice(14, 16)}`, `${f.dataBR(ref)}, ${ref.slice(11, 13)}:${ref.slice(14, 16)}`);
}

/**
 * Resposta curta do P023 para a fonte escolhida: energia não gerada estimada, taxa e
 * denominador, razões oficiais, maior corte simultâneo (potência, não energia) e o que a
 * restrição não é.
 */
export function respostaRestricao(r: Pick<Restricao, "fonte" | "primeiro_mes" | "ultimos_12m">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const fr = fraseRazao(idioma);
  const u = r.ultimos_12m;
  const nome = fraseFonteRestricao(idioma)[r.fonte];
  if (!u) {
    return tx(
      `Sem 12 meses completos de restrição publicados para ${nome}; a série começa em ${f.mesAno(r.primeiro_mes)}.`,
      `No 12 complete months of restriction published for ${nome}; the series starts in ${f.mesAno(r.primeiro_mes)}.`,
    );
  }
  const razoes = [...u.por_razao].filter((x) => (x.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const frases = [
    tx(
      `De ${f.mesAno(u.inicio)} a ${f.mesAno(u.fim)}, a limitação da geração de ${nome} pelo ONS deixou de gerar ${f.num(gwh(u.energia_nao_gerada_mwh), 0)} GWh, estimados sobre a geração de referência do ONS: ${f.num(u.taxa_pct, 1)}% do que essas usinas teriam gerado (verificada mais não gerada).`,
      `From ${f.mesAno(u.inicio)} to ${f.mesAno(u.fim)}, the ONS limitation of the generation of ${nome} left ${f.num(gwh(u.energia_nao_gerada_mwh), 0)} GWh ungenerated, estimated against the ONS reference generation: ${f.num(u.taxa_pct, 1)}% of what these plants would have generated (verified plus not generated).`,
    ),
  ];
  if (razoes.length) {
    const l = listaTexto(razoes.slice(0, 3).map((x) => `${fr[x.razao]} ${f.num(x.pct, 1)}%`), idioma);
    frases.push(tx(`Por razão oficial: ${l}.`, `By official reason: ${l}.`));
  }
  if (u.potencia_max_cortada_mw !== null) {
    frases.push(
      tx(
        `O maior corte simultâneo foi de ${f.num(u.potencia_max_cortada_mw, 1)} MW em ${instanteBR(u.quando_potencia_max, idioma)} (potência, não energia).`,
        `The largest simultaneous cut was ${f.num(u.potencia_max_cortada_mw, 1)} MW on ${instanteBR(u.quando_potencia_max, idioma)} (capacity, not energy).`,
      ),
    );
  }
  frases.push(
    tx(
      `${f.num(u.usinas_com_restricao, 0)} de ${f.num(u.usinas_no_universo, 0)} usinas e conjuntos do universo tiveram restrição.`,
      `${f.num(u.usinas_com_restricao, 0)} of ${f.num(u.usinas_no_universo, 0)} plants and plant clusters in the universe had restrictions.`,
    ),
  );
  return frases.join(" ");
}

export type LinhaRestricaoMes = {
  id: string;
  m: string;
  mes: string;
  total_gwh: number | null;
  verificada_gwh: number | null;
  taxa_pct: number | null;
  potencia_mw: number | null;
  usinas: number;
  meias_horas: number;
  parcial: string;
} & Partial<Record<RazaoRestricao, number | null>>;

/** Série mensal do SIN: energia não gerada por razão (GWh), taxa (%) e maior corte simultâneo (MW). */
export function linhasRestricaoMensal(r: Pick<Restricao, "mensal_sin">, idioma: Idioma = idiomaEnergia()): { linhas: LinhaRestricaoMes[]; razoes: RazaoRestricao[] } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const ms = r.mensal_sin;
  const linhas = ms.meses.map((m, i) => {
    const l: LinhaRestricaoMes = {
      id: m,
      m,
      mes: f.mesAno(m),
      total_gwh: gwh(ms.energia_nao_gerada_total_mwh[i]),
      verificada_gwh: gwh(ms.geracao_verificada_mwh[i]),
      taxa_pct: ms.taxa_pct[i],
      potencia_mw: ms.potencia_max_cortada_mw[i],
      usinas: ms.usinas[i],
      meias_horas: ms.meias_horas_limitadas[i],
      parcial: ms.parcial[i] ? tx("sim", "yes") : tx("não", "no"),
    };
    for (const z of RAZOES) l[z] = gwh(ms.energia_nao_gerada_mwh[z]?.[i]);
    return l;
  });
  const razoes = RAZOES.filter((z) => linhas.some((l) => (l[z] ?? 0) > 0));
  return { linhas, razoes };
}

export function colunasRestricaoMensal(razoes: readonly RazaoRestricao[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cr = curtoRazao(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: tx(`Não gerada, ${cr[z]}`, `Not generated, ${cr[z]}`), tipo: "numero", unidade: "GWh", casas: 2 })),
    { id: "total_gwh", rotulo: tx("Não gerada, total", "Not generated, total"), tipo: "numero", unidade: "GWh", casas: 2 },
    { id: "verificada_gwh", rotulo: tx("Geração verificada", "Verified generation"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "taxa_pct", rotulo: tx("Taxa de restrição", "Restriction rate"), tipo: "percentual", casas: 2 },
    { id: "potencia_mw", rotulo: tx("Maior corte simultâneo", "Largest simultaneous cut"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "usinas", rotulo: tx("Usinas e conjuntos", "Plants and plant clusters"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "meias_horas", rotulo: tx("Meias horas limitadas", "Limited half hours"), tipo: "numero", casas: 0 },
    { id: "parcial", rotulo: tx("Mês parcial", "Partial month"), tipo: "texto" },
  ];
}

export function linhasRazoes12m(r: Pick<Restricao, "ultimos_12m">, idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const cr = curtoRazao(idioma);
  return (r.ultimos_12m?.por_razao ?? []).map((x) => {
    const rotulo = rotuloGold(x.rotulo, idioma, cr[x.razao]);
    return {
      id: x.razao,
      razao: cr[x.razao],
      // total zero: não há limitação a classificar por origem, e as duas origens ficam sem valor por isso (a soma das origens é o total)
      rotulo_oficial:
        x.mwh === 0
          ? tx(
              `${rotulo}. Nenhuma energia não gerada com esta razão nos 12 meses; sem limitação, as origens ficam sem valor.`,
              `${rotulo}. No energy went ungenerated for this reason in the 12 months; with no limitation, the origins have no value.`,
            )
          : rotulo,
      gwh: gwh(x.mwh),
      pct: x.pct,
      LOC: gwh(x.origens_mwh.LOC),
      SIS: gwh(x.origens_mwh.SIS),
    };
  });
}

export function colunasRazoes12m(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "razao", rotulo: tx("Razão (código do ONS)", "Reason (ONS code)"), tipo: "texto" },
    { id: "rotulo_oficial", rotulo: tx("Descrição", "Description"), tipo: "texto" },
    { id: "LOC", rotulo: tx("Origem local", "Local origin"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "SIS", rotulo: tx("Origem sistêmica", "Systemic origin"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "gwh", rotulo: tx("Total", "Total"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "pct", rotulo: tx("Parcela da energia não gerada", "Share of the energy not generated"), tipo: "percentual", casas: 2 },
  ];
}

export function linhasSubsistemas12m(r: Pick<Restricao, "ultimos_12m">, idioma: Idioma = idiomaEnergia()) {
  const regiao = nomeRegiao(idioma);
  return (r.ultimos_12m?.por_subsistema ?? []).map((x) => ({ id: x.sm, sm: regiao[x.sm], nao_gerada_gwh: gwh(x.energia_nao_gerada_mwh), verificada_gwh: gwh(x.geracao_verificada_mwh), taxa_pct: x.taxa_pct }));
}

export function colunasSubsistemas12m(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto" },
    { id: "nao_gerada_gwh", rotulo: tx("Energia não gerada", "Energy not generated"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "verificada_gwh", rotulo: tx("Geração verificada", "Verified generation"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "taxa_pct", rotulo: tx("Taxa de restrição", "Restriction rate"), tipo: "percentual", casas: 2 },
  ];
}

export type LinhaUsinaRestricao = {
  id: string;
  nome: string;
  sm: string | null;
  uf: string | null;
  nao_gerada_gwh: number | null;
  verificada_gwh: number | null;
  taxa_pct: number | null;
  razao_principal: string;
  coordenada: string;
};

export function rotuloCoordenada(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: { subestacao_coletora: "subestação coletora", ponto_de_conexao: "ponto de conexão" },
    en: { subestacao_coletora: "collector substation", ponto_de_conexao: "connection point" },
  });
}

export function linhasUsinasRestricao(r: Pick<Restricao, "usinas_12m">, idioma: Idioma = idiomaEnergia()): LinhaUsinaRestricao[] {
  const tx = txEm(idioma);
  const regiao = nomeRegiao(idioma);
  const cr = curtoRazao(idioma);
  const coord = rotuloCoordenada(idioma);
  return r.usinas_12m.map((u) => ({
    id: u.id,
    nome: u.nome ?? u.id,
    sm: u.sm ? (regiao[u.sm as Submercado] ?? u.sm) : null,
    uf: u.uf,
    nao_gerada_gwh: gwh(u.energia_nao_gerada_mwh),
    verificada_gwh: gwh(u.geracao_verificada_mwh),
    taxa_pct: u.taxa_pct,
    razao_principal: cr[u.razao_principal],
    coordenada: u.origem_coordenada ? coord[u.origem_coordenada] : tx("sem coordenada", "no coordinate"),
  }));
}

export function colunasUsinasRestricao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("Usina ou conjunto", "Plant or plant cluster"), tipo: "texto", idiomaTexto: "nome" },
    // o identificador do ONS (CJU_..., ceg:...) é a chave da linha e do arquivo por usina e mês; a tabela do leitor mostra o nome
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
    { id: "uf", rotulo: tx("UF", "State"), tipo: "texto", categorica: true },
    { id: "nao_gerada_gwh", rotulo: tx("Energia não gerada em 12 meses", "Energy not generated in 12 months"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "verificada_gwh", rotulo: tx("Geração verificada em 12 meses", "Verified generation in 12 months"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "taxa_pct", rotulo: tx("Taxa de restrição", "Restriction rate"), tipo: "percentual", casas: 2 },
    { id: "razao_principal", rotulo: tx("Razão com mais energia", "Reason with the most energy"), tipo: "texto", categorica: true },
    { id: "coordenada", rotulo: tx("Origem da coordenada", "Coordinate origin"), tipo: "texto", categorica: true },
  ];
}

/** As colunas em português (o mesmo de colunasUsinasRestricao("pt")). */
export const COLUNAS_USINAS_RESTRICAO: ColunaTabela[] = colunasUsinasRestricao("pt");

/** Usina pedida, se publicada; null quando não há pedido válido. */
export function usinaRestricaoEscolhida(r: Pick<Restricao, "usinas_12m">, pedido: string): RestricaoUsina | null {
  return pedido ? (r.usinas_12m.find((u) => u.id === pedido) ?? null) : null;
}

/** Mesma comparação de até quatro usinas: energia não gerada, verificada e taxa dos 12 meses (gold). */
export function linhasComparacaoUsinas(r: Pick<Restricao, "usinas_12m">, ids: readonly string[], idioma: Idioma = idiomaEnergia()): LinhaUsinaRestricao[] {
  const todas = linhasUsinasRestricao(r, idioma);
  return ids.map((id) => todas.find((l) => l.id === id)).filter((l): l is LinhaUsinaRestricao => !!l);
}

/* ---------- mapa das usinas ---------- */

/** Raio da esfera autálica do GRS80, o mesmo que a malha publicada declara em `projecao.superficie`. */
export const R_AUTALICO_GRS80 = 6371007.181;

export type ProjecaoMalha = { paralelos_padrao: number[]; meridiano_central: number; latitude_origem: number; unidade_svg_m: number; origem_m: [number, number] };

/**
 * Albers cônica equivalente com os parâmetros da malha de UF publicada (public/energia/geo/uf.json),
 * na mesma grade do SVG (y para baixo). A coordenada é a que o ONS publica no conjunto de fator de
 * capacidade; o ponto não é deslocado nem arredondado.
 */
export function projetaPonto(lon: number, lat: number, p: ProjecaoMalha): [number, number] {
  const rad = Math.PI / 180;
  const [f1, f2] = [p.paralelos_padrao[0] * rad, p.paralelos_padrao[1] * rad];
  const f0 = p.latitude_origem * rad;
  const n = (Math.sin(f1) + Math.sin(f2)) / 2;
  const c = Math.cos(f1) ** 2 + 2 * n * Math.sin(f1);
  const rho0 = (R_AUTALICO_GRS80 * Math.sqrt(c - 2 * n * Math.sin(f0))) / n;
  const rho = (R_AUTALICO_GRS80 * Math.sqrt(c - 2 * n * Math.sin(lat * rad))) / n;
  const teta = n * (lon - p.meridiano_central) * rad;
  const x = rho * Math.sin(teta);
  const y = rho0 - rho * Math.cos(teta);
  return [(x - p.origem_m[0]) / p.unidade_svg_m, (p.origem_m[1] - y) / p.unidade_svg_m];
}

export type PontoUsina = { id: string; nome: string; uf: string | null; x: number; y: number; classe: number; razao: RazaoRestricao; nao_gerada_gwh: number | null; taxa_pct: number | null };

/** Classes de tamanho pelos tercis da energia não gerada das usinas publicadas (marca, não escala de área). */
export function classesTamanho(usinas: readonly Pick<RestricaoUsina, "energia_nao_gerada_mwh">[], idioma: Idioma = idiomaEnergia()): { cortes: [number, number]; rotulos: [string, string, string] } {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const v = usinas.map((u) => u.energia_nao_gerada_mwh).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const q = (p: number) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);
  const c1 = q(1 / 3);
  const c2 = q(2 / 3);
  const a = f.num(gwh(c1), 0);
  const b = f.num(gwh(c2), 0);
  return {
    cortes: [c1, c2],
    rotulos: [tx(`menos de ${a} GWh`, `less than ${a} GWh`), tx(`${a} a menos de ${b} GWh`, `${a} to less than ${b} GWh`), tx(`${b} GWh ou mais`, `${b} GWh or more`)],
  };
}

/** Pontos projetados das usinas com coordenada; as sem coordenada são contadas à parte. */
export function pontosUsinas(usinas: readonly RestricaoUsina[], p: ProjecaoMalha): { pontos: PontoUsina[]; semCoordenada: number } {
  const { cortes } = classesTamanho(usinas);
  const pontos: PontoUsina[] = [];
  let semCoordenada = 0;
  for (const u of usinas) {
    if (u.lat === null || u.lon === null) {
      semCoordenada++;
      continue;
    }
    const [x, y] = projetaPonto(u.lon, u.lat, p);
    const e = u.energia_nao_gerada_mwh;
    pontos.push({ id: u.id, nome: u.nome ?? u.id, uf: u.uf, x, y, classe: e < cortes[0] ? 0 : e < cortes[1] ? 1 : 2, razao: u.razao_principal, nao_gerada_gwh: gwh(e), taxa_pct: u.taxa_pct });
  }
  return { pontos, semCoordenada };
}

/* ---------- histórico da usina (CSV publicado, lido sob demanda) ---------- */

export type LinhaUsinaMes = { id: string; m: string; mes: string; verificada_mwh: number | null; meias_horas: number | null; meias_horas_limitadas: number | null } & Partial<Record<RazaoRestricao, number | null>>;

const numCsv = (s: string | undefined): number | null => (s === undefined || s === "" ? null : Number(s));

/**
 * Meses de uma usina no CSV publicado (geracao_restricao_usina_mensal.csv), na ordem do mês.
 * Lê só as linhas da fonte e do identificador pedidos; célula vazia é ausência.
 */
export function serieUsinaCsv(texto: string, fonte: FonteRestricao, id: string, idioma: Idioma = idiomaEnergia()): LinhaUsinaMes[] {
  const f = formatos(idioma);
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const cab = (linhas[0] ?? "").split(";");
  const i = (c: string) => cab.indexOf(c);
  const [iMes, iFonte, iId, iVer, iMh, iMhl] = [i("mes"), i("fonte"), i("id_ons"), i("geracao_verificada_mwh"), i("meias_horas"), i("meias_horas_limitadas")]; // i18n: dado
  const iRaz = Object.fromEntries(RAZOES.map((z) => [z, i(`eng_${z}_mwh`)])) as Record<RazaoRestricao, number>;
  if ([iMes, iFonte, iId].some((k) => k < 0)) return [];
  const out: LinhaUsinaMes[] = [];
  const marca = `;${fonte};${id};`;
  for (const l of linhas.slice(1)) {
    if (!l.includes(marca)) continue;
    const c = l.split(";");
    if (c[iFonte] !== fonte || c[iId] !== id) continue;
    const r: LinhaUsinaMes = { id: c[iMes], m: c[iMes], mes: f.mesAno(c[iMes]), verificada_mwh: numCsv(c[iVer]), meias_horas: numCsv(c[iMh]), meias_horas_limitadas: numCsv(c[iMhl]) };
    for (const z of RAZOES) r[z] = iRaz[z] >= 0 ? numCsv(c[iRaz[z]]) : null;
    out.push(r);
  }
  return out.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
}

export function colunasUsinaMes(razoes: readonly RazaoRestricao[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cr = curtoRazao(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: tx(`Não gerada, ${cr[z]}`, `Not generated, ${cr[z]}`), tipo: "numero", unidade: "MWh", casas: 1 })),
    { id: "verificada_mwh", rotulo: tx("Geração verificada", "Verified generation"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "meias_horas_limitadas", rotulo: tx("Meias horas limitadas", "Limited half hours"), tipo: "numero", casas: 0 },
    { id: "meias_horas", rotulo: tx("Meias horas com dado", "Half hours with data"), tipo: "numero", casas: 0 },
  ];
}

/* ---------- diário recente, causas e detalhamento ---------- */

export function linhasRestricaoDiaria(r: Pick<Restricao, "diario_recente">): ({ id: string; d: string; verificada_mwh: number | null; potencia_mw: number | null } & Partial<Record<RazaoRestricao, number | null>>)[] {
  const dr = r.diario_recente;
  return dr.dias.map((d, i) => {
    const l: { id: string; d: string; verificada_mwh: number | null; potencia_mw: number | null } & Partial<Record<RazaoRestricao, number | null>> = {
      id: d,
      d,
      verificada_mwh: dr.geracao_verificada_mwh[i],
      potencia_mw: dr.potencia_max_cortada_mw[i],
    };
    for (const z of RAZOES) l[z] = dr.energia_nao_gerada_mwh[z]?.[i] ?? null;
    return l;
  });
}

export function colunasRestricaoDiaria(razoes: readonly RazaoRestricao[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const cr = curtoRazao(idioma);
  return [
    { id: "d", rotulo: tx("Dia", "Day"), tipo: "data" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: tx(`Não gerada, ${cr[z]}`, `Not generated, ${cr[z]}`), tipo: "numero", unidade: "MWh", casas: 1 })),
    { id: "verificada_mwh", rotulo: tx("Geração verificada", "Verified generation"), tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "potencia_mw", rotulo: tx("Maior corte simultâneo", "Largest simultaneous cut"), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}

export function linhasDescricoes(r: Pick<Restricao, "descricoes_ultimo_mes">) {
  return (r.descricoes_ultimo_mes?.itens ?? []).map((x, i) => ({ id: `${i}`, descricao: x.descricao, gwh: gwh(x.mwh) }));
}

export function colunasDescricoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "descricao", rotulo: tx("Detalhamento publicado pelo ONS", "Detail published by the ONS (in Portuguese)"), tipo: "texto", idiomaTexto: "portugues" },
    { id: "gwh", rotulo: tx("Energia não gerada", "Energy not generated"), tipo: "numero", unidade: "GWh", casas: 2 },
  ];
}

export function linhasDetalhe(r: Restricao, idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  return (r.detalhe ?? []).map((x) => ({
    id: x.mes,
    mes: f.mesAno(x.mes),
    usinas: x.usinas,
    conjuntos: x.conjuntos,
    verificada_gwh: gwh(x.geracao_verificada_mwh),
    estimada_gwh: gwh(x.geracao_estimada_mwh),
    meias_horas: x.meias_horas_restritas,
    soma_detalhe_gwh: gwh(x.conferencia.soma_detalhe_mwh),
    soma_principal_gwh: gwh(x.conferencia.soma_arquivo_principal_mwh),
    diferenca_pct: x.conferencia.diferenca_pct,
  }));
}

export function colunasDetalhe(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "usinas", rotulo: tx("Usinas individuais", "Individual plants"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "conjuntos", rotulo: tx("Conjuntos", "Plant clusters"), tipo: "numero", casas: 0 },
    { id: "verificada_gwh", rotulo: tx("Geração verificada (detalhe)", "Verified generation (detail)"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "estimada_gwh", rotulo: tx("Geração de referência (detalhe)", "Reference generation (detail)"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "meias_horas", rotulo: tx("Meias horas restritas", "Restricted half hours"), tipo: "numero", casas: 0 },
    { id: "soma_detalhe_gwh", rotulo: tx("Soma das usinas comparadas", "Sum of the compared plants"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "soma_principal_gwh", rotulo: tx("Mesmos conjuntos no arquivo principal", "Same clusters in the main file"), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "diferenca_pct", rotulo: tx("Diferença", "Difference"), tipo: "percentual", casas: 3 },
  ];
}

/** Controles da importação das restrições, em frases (contagens da gold). */
export function textoControlesRestricao(r: Restricao, idioma: Idioma = idiomaEnergia()): string[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const c = r.controles;
  return [
    tx(
      `${f.num(c.linhas, 0)} linhas lidas; ${f.num(c.valores_negativos_na_fonte, 0)} células negativas na fonte (o dicionário não admite), mantidas como publicadas.`,
      `${f.num(c.linhas, 0)} rows read; ${f.num(c.valores_negativos_na_fonte, 0)} negative cells in the source (the data dictionary does not allow them), kept as published.`,
    ),
    tx(
      `Campo de geração não realizada apurada (GNRa) do ONS conferido com a regra em ${f.num(c.meias_horas_com_gnra, 0)} meias horas: ${f.num(c.gnra_divergente_da_regra, 0)} divergentes.`,
      `ONS field of assessed unrealized generation (GNRa) checked against the rule in ${f.num(c.meias_horas_com_gnra, 0)} half hours: ${f.num(c.gnra_divergente_da_regra, 0)} divergent.`,
    ),
    tx(
      `Corte simultâneo acima da soma das referências: ${f.num(c.meias_horas_corte_acima_da_referencia, 0)} de ${f.num(c.meias_horas_com_corte, 0)} meias horas com corte (por subsistema).`,
      `Simultaneous cut above the sum of the references: ${f.num(c.meias_horas_corte_acima_da_referencia, 0)} of ${f.num(c.meias_horas_com_corte, 0)} half hours with a cut (by subsystem).`,
    ),
    tx(
      `Meias horas limitadas sem referência: ${f.num(c.limitadas_sem_referencia, 0)}; razões fora do domínio do dicionário: ${f.num(c.razao_fora_do_dominio, 0)}.`,
      `Limited half hours without a reference: ${f.num(c.limitadas_sem_referencia, 0)}; reasons outside the data dictionary domain: ${f.num(c.razao_fora_do_dominio, 0)}.`,
    ),
  ];
}

/* ====================================================================== */
/* P024: capacidade e utilização                                            */
/* ====================================================================== */

export const CATEGORIAS_CAPACIDADE: readonly CategoriaCapacidade[] = ["hidraulica", "eolica", "solar_centralizada", "nuclear", "gas", "carvao", "oleo", "biomassa", "outros"];

/**
 * Resposta curta do P024: potência das usinas despachadas no retrato, fator de capacidade
 * dos 12 meses das três maiores categorias e a MMGD cadastrada, que fica fora da conta.
 */
export function respostaCapacidade(c: Capacidade, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const curto = curtoCategoria(idioma);
  const r = c.retrato;
  const maiores = [...r.por_categoria].filter((x) => (x.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const quais = maiores.length ? `: ${listaTexto(maiores.slice(0, 3).map((x) => `${minusculaPalavras(curto[x.categoria])} ${f.num(x.pct, 1)}%`), idioma)}` : "";
  const frases = [
    tx(
      `Em ${f.dataBR(r.data)}, as usinas despachadas pelo ONS somavam ${f.num(r.total_mw, 0)} MW em operação comercial${quais}.`,
      `On ${f.dataBR(r.data)}, the plants dispatched by the ONS totaled ${f.num(r.total_mw, 0)} MW in commercial operation${quais}.`,
    ),
  ];
  const u = c.ultimos_12m;
  if (u) {
    const fcs = ["hidraulica", "eolica", "solar_centralizada"]
      .map((k) => u.por_categoria.find((x) => x.categoria === k))
      .filter((x): x is Capacidade12m => !!x && x.fator_capacidade_pct !== null)
      .map((x) => `${minusculaPalavras(curto[x.categoria])} ${f.num(x.fator_capacidade_pct, 1)}%`);
    if (fcs.length) {
      const l = listaTexto(fcs, idioma);
      frases.push(
        tx(
          `De ${f.mesAno(u.inicio)} a ${f.mesAno(u.fim)}, a geração dividida pela potência em operação ao longo de cada mês (fator de capacidade) foi de ${l}.`,
          `From ${f.mesAno(u.inicio)} to ${f.mesAno(u.fim)}, generation divided by the capacity in operation over each month (capacity factor) was ${l}.`,
        ),
      );
    }
  }
  const mm = c.contexto.mmgd;
  if (mm) {
    frases.push(
      tx(
        `A micro e minigeração distribuída cadastrada na ANEEL (${f.num(mm.potencia_mw, 0)} MW) é outro universo e não entra nessa soma nem no fator de capacidade.`,
        `Distributed micro and mini generation registered with ANEEL (${f.num(mm.potencia_mw, 0)} MW) is a different universe and is included neither in this sum nor in the capacity factor.`,
      ),
    );
  }
  return frases.join(" ");
}

export type LinhaCapacidade = {
  id: CategoriaCapacidade;
  categoria: string;
  mw: number | null;
  pct: number | null;
  unidades: number | null;
  usinas: number | null;
  siga_mw: number | null;
  fc_pct: number | null;
  fc_ons_pct: number | null;
  potencia_media_12m_mw: number | null;
  capacidade_hora_media_mw: number | null;
  cobertura_pct: number | null;
};

/** Retrato do ONS, SIGA (outro universo, ao lado) e 12 meses por categoria. */
export function linhasCapacidade(c: Capacidade, idioma: Idioma = idiomaEnergia()): LinhaCapacidade[] {
  const curto = curtoCategoria(idioma);
  const siga = c.contexto.siga?.por_categoria_mw ?? {};
  return CATEGORIAS_CAPACIDADE.map((k) => {
    const r = c.retrato.por_categoria.find((x) => x.categoria === k);
    const u = c.ultimos_12m?.por_categoria.find((x) => x.categoria === k);
    return {
      id: k,
      categoria: curto[k],
      mw: r?.mw ?? null,
      pct: r?.pct ?? null,
      unidades: r?.unidades ?? null,
      usinas: r?.usinas ?? null,
      siga_mw: siga[k] ?? null,
      fc_pct: u?.fator_capacidade_pct ?? null,
      fc_ons_pct: u?.fc_ons_pct ?? null,
      potencia_media_12m_mw: u?.potencia_media_12m_mw ?? null,
      capacidade_hora_media_mw: u?.capacidade_hora_media_mw ?? null,
      cobertura_pct: u?.cobertura_pct ?? null,
    };
  });
}

export function colunasCapacidade(c: Capacidade, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const dSiga = c.contexto.siga?.data_referencia ? f.dataBR(c.contexto.siga.data_referencia) : tx("retrato", "snapshot");
  const per = c.ultimos_12m ? tx(`${f.mesAno(c.ultimos_12m.inicio)} a ${f.mesAno(c.ultimos_12m.fim)}`, `${f.mesAno(c.ultimos_12m.inicio)} to ${f.mesAno(c.ultimos_12m.fim)}`) : tx("12 meses", "12 months");
  return [
    { id: "categoria", rotulo: tx("Categoria", "Category"), tipo: "texto" },
    { id: "mw", rotulo: tx(`Potência em operação, ONS (${f.dataBR(c.retrato.data)})`, `Capacity in operation, ONS (${f.dataBR(c.retrato.data)})`), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "pct", rotulo: tx("Parcela da potência do ONS", "Share of ONS capacity"), tipo: "percentual", casas: 2 },
    { id: "unidades", rotulo: tx("Unidades geradoras", "Generating units"), tipo: "numero", casas: 0 },
    { id: "usinas", rotulo: tx("Usinas", "Plants"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "siga_mw", rotulo: tx(`Capacidade fiscalizada, ANEEL SIGA (${dSiga})`, `Inspected capacity, ANEEL SIGA (${dSiga})`), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "fc_pct", rotulo: tx(`Fator de capacidade, ${per}`, `Capacity factor, ${per}`), tipo: "percentual", casas: 2 },
    { id: "fc_ons_pct", rotulo: tx("Fator de capacidade publicado pelo ONS", "Capacity factor published by the ONS"), tipo: "percentual", casas: 2 },
    { id: "potencia_media_12m_mw", rotulo: tx("Potência média em operação", "Average capacity in operation"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "capacidade_hora_media_mw", rotulo: tx("Potência média no denominador", "Average capacity in the denominator"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "cobertura_pct", rotulo: tx("Geração coberta pelo pareamento", "Generation covered by the matching"), tipo: "percentual", casas: 2 },
  ];
}

export function categoriaCapacidadeEscolhida(pedido: string): CategoriaCapacidade {
  return (CATEGORIAS_CAPACIDADE as readonly string[]).includes(pedido) ? (pedido as CategoriaCapacidade) : "eolica";
}

/**
 * Distribuição por usina do fator de capacidade dos 12 meses de uma categoria, no formato do
 * Histograma: as classes de 10 pontos são as da gold; usinas com 100% ou mais ficam fora
 * das classes, contadas à parte (classe aberta na gold).
 */
export function histogramaFc(u: Capacidade12m): {
  classes: { inicio: number; fim: number; contagem: number; fechadaDireita: boolean }[];
  massas: never[];
  resumo: { n: number; semDado: number; min: number | null; p10: number | null; p25: number | null; mediana: number | null; p75: number | null; p90: number | null; max: number | null };
  foraDasClasses: { abaixo: number; acima: number };
  larguraReferencia: number;
  larguraUniforme: boolean;
} | null {
  const d: Quantis | null = u.distribuicao_usinas;
  if (!d || u.histograma_10pp.length !== 11) return null;
  return {
    classes: u.histograma_10pp.slice(0, 10).map((n, k) => ({ inicio: 10 * k, fim: 10 * (k + 1), contagem: n, fechadaDireita: false })),
    massas: [],
    resumo: { n: d.n, semDado: 0, min: d.min, p10: d.p10, p25: d.p25, mediana: d.p50, p75: d.p75, p90: d.p90, max: d.max },
    foraDasClasses: { abaixo: 0, acima: u.histograma_10pp[10] },
    larguraReferencia: 10,
    larguraUniforme: true,
  };
}

export function linhasExtremosFc(u: Capacidade12m, idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const semNome = tx("sem nome na fonte", "no name in the source");
  const n = u.distribuicao_usinas?.n ?? 0;
  if (n > 0 && n < MINIMO_PARA_DISTRIBUICAO) {
    // poucas observações: as menores e as maiores são as mesmas usinas, e cada uma entra uma vez
    return observacoesFc(u, idioma)
      .reverse()
      .map((x) => ({ id: `todas:${x.id}`, grupo: tx("todas", "all"), nome: x.nome, fc_pct: x.fc_pct, potencia_media_mw: [...u.menores, ...u.maiores].find((y) => y.id === x.id)?.potencia_media_mw ?? null })); // i18n: dado
  }
  return [
    // o código do ONS (ceg:..., cju:...) é a chave da linha e do arquivo por usina e mês; a tabela do leitor mostra o nome
    ...u.menores.map((x) => ({ id: `menor:${x.id}`, grupo: tx("menores", "lowest"), nome: x.nome ?? semNome, fc_pct: x.fc_pct, potencia_media_mw: x.potencia_media_mw })), // i18n: dado
    ...u.maiores.map((x) => ({ id: `maior:${x.id}`, grupo: tx("maiores", "highest"), nome: x.nome ?? semNome, fc_pct: x.fc_pct, potencia_media_mw: x.potencia_media_mw })), // i18n: dado
  ];
}

export function colunasExtremosFc(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "grupo", rotulo: tx("Grupo", "Group"), tipo: "texto", categorica: true },
    { id: "nome", rotulo: tx("Usina ou conjunto", "Plant or plant cluster"), tipo: "texto", idiomaTexto: "nome" },
    { id: "fc_pct", rotulo: tx("Fator de capacidade, 12 meses", "Capacity factor, 12 months"), tipo: "percentual", casas: 1 },
    { id: "potencia_media_mw", rotulo: tx("Potência média em operação", "Average capacity in operation"), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}

/** As colunas em português (o mesmo de colunasExtremosFc("pt")). */
export const COLUNAS_EXTREMOS_FC: ColunaTabela[] = colunasExtremosFc("pt");

/** Fator de capacidade mensal de até quatro categorias (mesma escala). */
export function linhasFcMensal(c: Capacidade, cats: readonly CategoriaCapacidade[]) {
  const mm = c.mensal;
  return mm.meses.map((m, i) => {
    const l: { id: string; m: string } & Partial<Record<CategoriaCapacidade, number | null>> = { id: m, m };
    for (const k of cats) l[k] = mm.fator_capacidade_pct[k]?.[i] ?? null;
    return l;
  });
}

/** Potência em operação comercial média mensal de até quatro categorias. */
export function linhasPotenciaMensal(c: Capacidade, cats: readonly CategoriaCapacidade[]) {
  const mm = c.mensal;
  return mm.meses.map((m, i) => {
    const l: { id: string; m: string } & Partial<Record<CategoriaCapacidade, number | null>> = { id: m, m };
    for (const k of cats) l[k] = mm.potencia_operacional_mw[k]?.[i] ?? null;
    return l;
  });
}

/** Fator de capacidade do painel e o publicado pelo ONS, mês a mês, na eólica ou na solar. */
export function linhasFcConferencia(c: Capacidade, k: "eolica" | "solar_centralizada") {
  const mm = c.mensal;
  return mm.meses.map((m, i) => ({ id: m, m, painel: mm.fator_capacidade_pct[k]?.[i] ?? null, ons: mm.fc_ons_pct[k]?.[i] ?? null }));
}

export type GrupoAneel = "hidraulica" | "eolica" | "solar_centralizada" | "nuclear" | "termica";
export const GRUPOS_ANEEL: readonly GrupoAneel[] = ["hidraulica", "eolica", "solar_centralizada", "termica", "nuclear"];

export function nomeGrupoAneel(idioma: Idioma = idiomaEnergia()): Record<GrupoAneel, string> {
  return porIdioma(idioma, {
    pt: {
      hidraulica: "Hidráulica (UHE, PCH e CGH)",
      eolica: "Eólica (EOL)",
      solar_centralizada: "Solar centralizada (UFV)",
      nuclear: "Nuclear (UTN)",
      termica: "Térmicas (UTE), todos os combustíveis",
    },
    en: {
      hidraulica: "Hydropower (UHE, PCH and CGH)",
      eolica: "Wind (EOL)",
      solar_centralizada: "Centralized solar (UFV)",
      nuclear: "Nuclear (UTN)",
      termica: "Thermal (UTE), all fuels",
    },
  });
}

export function grupoAneelEscolhido(pedido: string): GrupoAneel {
  return (GRUPOS_ANEEL as readonly string[]).includes(pedido) ? (pedido as GrupoAneel) : "eolica";
}

/** ANEEL × ONS nas datas da série histórica oficial, para um grupo (nada somado). */
export function linhasSigaHistorico(sh: NonNullable<Capacidade["contexto"]["siga_historico"]>, g: GrupoAneel, idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  const x = sh.grupos[g];
  return sh.datas.map((d, i) => ({ id: d, m: d, mes: f.mesAno(d), aneel_mw: x.aneel_mw[i], ons_mw: x.ons_mw[i], ons_pct_da_aneel: x.ons_pct_da_aneel[i] }));
}

export function colunasSigaHistorico(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Data da série da ANEEL", "Date in the ANEEL series"), tipo: "texto" },
    { id: "aneel_mw", rotulo: tx("Potência em operação, ANEEL", "Capacity in operation, ANEEL"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "ons_mw", rotulo: tx("Potência em operação comercial, ONS (último dia do mês)", "Capacity in commercial operation, ONS (last day of the month)"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "ons_pct_da_aneel", rotulo: tx("ONS como parcela da ANEEL", "ONS as a share of ANEEL"), tipo: "percentual", casas: 1 },
  ];
}

/** MMGD cadastrada (MW) e MMGD estimada pelo ONS (MWmed), lado a lado; nunca divididas. */
export function linhasMmgdCapacidade(m: NonNullable<NonNullable<Capacidade["contexto"]["mmgd"]>["mensal"]>, idioma: Idioma = idiomaEnergia()) {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  return m.meses.map((mes, i) => ({
    id: mes,
    m: mes,
    mes: f.mesAno(mes),
    potencia_mw: m.potencia_cadastrada_mw[i],
    provisorio: m.cadastro_provisorio[i] ? tx("sim", "yes") : tx("não", "no"),
    geracao_mwmed: m.geracao_estimada_ons_mwmed[i],
    mes_completo: m.mes_completo_na_geracao[i] ? tx("sim", "yes") : tx("não", "no"),
  }));
}

export function colunasMmgdCapacidade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "potencia_mw", rotulo: tx("Potência de MMGD cadastrada na ANEEL (fim do mês)", "MMGD capacity registered with ANEEL (end of month)"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "provisorio", rotulo: tx("Cadastro provisório", "Provisional registration"), tipo: "texto", categorica: true },
    { id: "geracao_mwmed", rotulo: tx("MMGD estimada pelo ONS", "MMGD estimated by the ONS"), tipo: "numero", unidade: mwmed(idioma), casas: 1 },
    { id: "mes_completo", rotulo: tx("Mês completo na geração", "Complete month in generation"), tipo: "texto", categorica: true },
  ];
}

export function linhasFcAcima100(p: Capacidade["pareamento"], idioma: Idioma = idiomaEnergia()) {
  const f = formatos(idioma);
  const curto = curtoCategoria(idioma);
  return p.fc_acima_de_100.exemplos.map((x, i) => ({ id: `${x.id}:${x.mes}:${i}`, nome: x.nome ?? x.id, categoria: curto[x.categoria], mes: f.mesAno(x.mes), fc_pct: x.fc_pct, potencia_mw: x.potencia_mw, chave: x.id }));
}

export function colunasFcAcima100(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("Usina ou conjunto", "Plant or plant cluster"), tipo: "texto", idiomaTexto: "nome" },
    { id: "categoria", rotulo: tx("Categoria", "Category"), tipo: "texto", categorica: true },
    { id: "mes", rotulo: tx("Mês", "Month"), tipo: "texto" },
    { id: "fc_pct", rotulo: tx("Fator de capacidade do mês", "Capacity factor for the month"), tipo: "percentual", casas: 1 },
    { id: "potencia_mw", rotulo: tx("Potência em operação comercial", "Capacity in commercial operation"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "chave", rotulo: tx("Grupo de pareamento", "Matching group"), tipo: "texto", buscavel: true },
  ];
}

export function rotuloCasamento(idioma: Idioma = idiomaEnergia()): Record<string, string> {
  return porIdioma(idioma, {
    pt: {
      ceg: "mesmo CEG (usina individual)",
      conjunto: "conjunto com relacionamento vigente",
      sem_unidades: "sem unidade pareada (fora do fator de capacidade)",
    },
    en: {
      ceg: "same CEG (individual plant)",
      conjunto: "plant cluster with a current relationship",
      sem_unidades: "no matched unit (outside the capacity factor)",
    },
  });
}

/* ====================================================================== */
/* downloads de cada painel                                                 */
/* ====================================================================== */

const DOWNLOADS_PAINEL: Record<PainelGeracao, RegExp> = {
  p021: /matriz|rotulos|a11|reconciliacao/,
  p022: /termica|cvu/,
  p023: /restricao/,
  p024: /capacidade/,
};

export function downloadsDoPainel(d: readonly { rotulo: string; url: string }[], p: PainelGeracao, idioma: Idioma = idiomaEnergia()): { rotulo: string; url: string }[] {
  // o arquivo horário tem 8.760 linhas, 365 dias; o rótulo publicado ainda diz 366 (ajuste pedido ao pipeline)
  return d
    .filter((x) => DOWNLOADS_PAINEL[p].test(x.url))
    .map((x) => {
      const rotulo = x.rotulo.replace("últimos 366 dias", "últimos 365 dias"); // i18n: dado
      return { ...x, rotulo: idioma === "en" ? (DOWNLOADS_GERACAO_EN[rotulo] ?? rotulo) : rotulo };
    });
}

/* ====================================================================== */
/* P021 na abertura editorial: maiores fontes, composição completa,         */
/* natureza do dado e cobertura da fonte                                    */
/* ====================================================================== */

/**
 * Seletores que servem ao gráfico, à frase e à faixa de métricas ao mesmo tempo (um número, um seletor). Nenhum indicador é
 * recalculado: participação e MWmed saem da janela publicada na gold, e a única conta é a soma das participações exibidas, para
 * mostrar que a composição fecha dentro da tolerância do controle publicado.
 */

/**
 * Natureza de uma categoria inteira. A MMGD é estimativa do ONS e as térmicas Tipo III são previsão do ONS. As demais são medição,
 * com uma parcela de previsão Tipo III dita à parte (notaTipoIII), porque o grupo Tipo III reúne pequenas usinas de várias fontes.
 */
export type NaturezaDaFonte = "medicao" | "estimativa" | "previsao";

export function naturezaDaCategoria(c: CategoriaGeracao): NaturezaDaFonte {
  return c === "solar_mmgd" ? "estimativa" : c === "termica_sem_combustivel" ? "previsao" : "medicao";
}

/** Nome da fonte ao lado da barra: o mesmo nome curto, sem "(estimada)" na MMGD, porque o selo de natureza da linha já diz que é estimativa. */
export function nomeNaBarra(idioma: Idioma = idiomaEnergia()): Record<CategoriaGeracao, string> {
  return { ...curtoCategoria(idioma), solar_mmgd: "Solar MMGD" };
}

/** Total da janela em MWmed no perímetro escolhido (com ou sem a MMGD estimada). */
export function totalDaJanela(mix: Pick<Mix, "total_mwmed" | "total_sem_mmgd_mwmed"> | null, per: Perimetro): number | null {
  return mix ? (per === "com" ? mix.total_mwmed : mix.total_sem_mmgd_mwmed) : null;
}

/** Ressalva de universo sem o prefixo e sem o ponto final, para entrar numa frase ou numa legenda. */
function ressalvaEmFrase(r: RessalvaUniverso | undefined | null, idioma: Idioma): string | null {
  const tx = txEm(idioma);
  const t = textoRessalva(r, idioma);
  if (!t) return null;
  const prefixo = idioma === "en" ? /^Coverage caveat:?\s*/ : /^Ressalva de universo:?\s*/;
  return t.replace(prefixo, "").replace(/\.$/, "") || tx("cobertura da fonte alterada", "source coverage changed");
}

export type LinhaFonte = {
  id: CategoriaGeracao;
  rotulo: string;
  /** % da geração no perímetro escolhido, como a gold publica (sem novo arredondamento). */
  participacao: number;
  mwmed: number | null;
  natureza: NaturezaDaFonte;
  /** Por que a participação não se compara com a de outro período (ressalva de universo na janela), ou null. */
  cobertura: string | null;
};

/**
 * Uma linha por categoria com valor na janela, da maior para a menor participação (empate na ordem das categorias). Categoria sem
 * valor na janela fica de fora: ausência não é zero e não entra na soma. No perímetro sem MMGD, a Solar MMGD fica fora.
 */
export function composicaoDaJanela(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro, idioma: Idioma = idiomaEnergia()): LinhaFonte[] {
  const { mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return [];
  const barra = nomeNaBarra(idioma);
  const out: LinhaFonte[] = [];
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const p = participacaoDe(mix, per, c);
    if (p === null) continue;
    out.push({ id: c, rotulo: barra[c], participacao: p, mwmed: mix.mwmed[c], natureza: naturezaDaCategoria(c), cobertura: ressalvaEmFrase(mix.ressalvas_universo[c], idioma) });
  }
  return out.sort((a, b) => b.participacao - a.participacao);
}

/** As `n` maiores participações (só as positivas) de uma lista já ordenada: o recorte da abertura, que nunca é a composição completa. */
export function maioresFontes<T extends { participacao: number }>(linhas: readonly T[], n = 5): T[] {
  return linhas.filter((l) => l.participacao > 0).slice(0, n);
}

/** Tolerância, em pontos percentuais, do controle publicado "Participações somam 100% em todas as janelas e regiões". */
export const TOLERANCIA_SOMA_PP = 0.05;

/** A soma das participações exibidas contra 100%: a composição só é completa quando fecha dentro da tolerância do controle publicado. */
export function fechamentoDaComposicao(linhas: readonly { participacao: number }[]): { soma: number; categorias: number; tolerancia: number; fecha: boolean } {
  const soma = Math.round(linhas.reduce((s, l) => s + l.participacao, 0) * 100) / 100;
  return { soma, categorias: linhas.length, tolerancia: TOLERANCIA_SOMA_PP, fecha: linhas.length > 0 && Math.abs(soma - 100) <= TOLERANCIA_SOMA_PP + 1e-9 };
}

export type LinhaComparacaoJanelas = { id: CategoriaGeracao; rotulo: string; participacao: number; participacao_ref: number };
export type ForaDaComparacao = { id: CategoriaGeracao; rotulo: string; motivo: string };

/**
 * Participação da janela escolhida contra a de referência (365 dias; para a de 365 dias, os 30 dias), só das categorias que podem
 * ser comparadas. Categoria com ressalva de universo em qualquer das duas janelas (a fonte publicou outro número de usinas com
 * dado) sai do gráfico e entra em `fora`, com a mudança de cobertura dita; o valor de cada janela continua na tabela e na
 * composição completa. Categoria sem valor em uma das janelas também sai, como ausência.
 */
export function comparacaoEntreJanelas(
  m: Pick<Matriz, "janelas">,
  rg: RegiaoGeracao,
  pedida: JanelaMatriz,
  per: Perimetro,
  idioma: Idioma = idiomaEnergia(),
): { janela: JanelaMatriz; ref: JanelaMatriz; comparaveis: LinhaComparacaoJanelas[]; fora: ForaDaComparacao[] } {
  const tx = txEm(idioma);
  const curto = curtoCategoria(idioma);
  const rj = rotuloJanela(idioma);
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  const ref = janelaReferencia(janela);
  const mixRef = m.janelas[rg]?.[ref] ?? null;
  const comparaveis: LinhaComparacaoJanelas[] = [];
  const fora: ForaDaComparacao[] = [];
  if (!mix) return { janela, ref, comparaveis, fora };
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const p = participacaoDe(mix, per, c);
    const pr = mixRef ? participacaoDe(mixRef, per, c) : null;
    if (p === null && pr === null) continue;
    const rJ = mix.ressalvas_universo[c];
    const rR = mixRef?.ressalvas_universo[c];
    if (rJ || rR) {
      // a janela com mais motivos (salto no período, além do universo reduzido) é a que diz mais sobre a mudança de cobertura
      const dona = (rJ?.motivos.length ?? 0) >= (rR?.motivos.length ?? 0) ? rJ : rR;
      fora.push({ id: c, rotulo: curto[c], motivo: ressalvaEmFrase(dona, idioma) ?? tx("cobertura da fonte alterada", "source coverage changed") });
    } else if (p === null || pr === null) {
      const qual = rj[p === null ? janela : ref];
      fora.push({ id: c, rotulo: curto[c], motivo: tx(`sem valor na janela de ${qual}`, `no value in the ${janelaAdjetivo(p === null ? janela : ref)} window`) });
    } else comparaveis.push({ id: c, rotulo: curto[c], participacao: p, participacao_ref: pr });
  }
  comparaveis.sort((a, b) => b.participacao - a.participacao);
  return { janela, ref, comparaveis, fora };
}

/** Fonte de maior participação na janela (a "fonte principal" da faixa de métricas), pelo mesmo critério do gráfico. */
export function fontePrincipalDaJanela(mix: Mix | null, per: Perimetro, idioma: Idioma = idiomaEnergia()): { id: CategoriaGeracao; rotulo: string; frase: string; participacao: number } | null {
  if (!mix) return null;
  let melhor: { id: CategoriaGeracao; participacao: number } | null = null;
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const p = participacaoDe(mix, per, c);
    if (p !== null && (melhor === null || p > melhor.participacao)) melhor = { id: c, participacao: p };
  }
  return melhor ? { ...melhor, rotulo: curtoCategoria(idioma)[melhor.id], frase: fraseCategoria(idioma)[melhor.id] } : null;
}

/** Natureza da energia da janela (medição, previsão do ONS e estimativa do ONS): as partes que fecham 100%, na ordem de NATUREZAS. */
export function partesDaNatureza(mix: Pick<Mix, "natureza_pct"> | null, idioma: Idioma = idiomaEnergia()): { id: NaturezaGeracao; rotulo: string; pct: number }[] {
  if (!mix) return [];
  const curto = curtoNatureza(idioma);
  return NATUREZAS.flatMap((n) => {
    const p = mix.natureza_pct[n];
    return p === null ? [] : [{ id: n, rotulo: curto[n], pct: p }];
  });
}

/**
 * Datas de referência de cada parte do módulo, com a natureza de cada uma: a matriz vai até o último dia completo; o despacho térmico,
 * as restrições e o fator de capacidade, até o último mês completo de cada conjunto; a capacidade instalada é o retrato de uma data.
 * Parte que a gold não publica não entra na lista.
 */
export function datasDoModulo(
  g: Pick<GoldGeracaoDetalhe, "dia_referencia" | "a11" | "termica" | "restricoes" | "capacidade">,
  idioma: Idioma = idiomaEnergia(),
): { rotulo: string; texto: string; natureza: Natureza }[] {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const ateMes = (m: string) => tx(`até ${f.mesAno(m)} (último mês completo)`, `up to ${f.mesAno(m)} (latest complete month)`);
  const out: { rotulo: string; texto: string; natureza: Natureza }[] = [
    { rotulo: tx("Matriz efetiva", "Effective mix"), texto: tx(`até ${f.dataBR(g.dia_referencia)}`, `up to ${f.dataBR(g.dia_referencia)}`), natureza: "CALCULADO" },
  ];
  if (g.a11.primeiro_dia_mmgd) {
    out.push({
      rotulo: tx("MMGD estimada pelo ONS", "MMGD estimated by the ONS"),
      texto: tx(`de ${f.dataBR(g.a11.primeiro_dia_mmgd)} a ${f.dataBR(g.dia_referencia)}`, `from ${f.dataBR(g.a11.primeiro_dia_mmgd)} to ${f.dataBR(g.dia_referencia)}`),
      natureza: "ESTIMADO",
    });
  }
  if (g.termica) out.push({ rotulo: tx("Despacho térmico", "Thermal dispatch"), texto: ateMes(g.termica.ultimo_mes_completo), natureza: "CALCULADO" });
  const meses = [g.restricoes.eolica?.ultimo_mes_completo, g.restricoes.solar?.ultimo_mes_completo].filter((x): x is string => !!x).sort();
  if (meses.length) out.push({ rotulo: tx("Restrições de renováveis", "Renewable restrictions"), texto: ateMes(meses[0]), natureza: "ESTIMADO" });
  if (g.capacidade) {
    out.push({ rotulo: tx("Potência instalada", "Installed capacity"), texto: tx(`retrato de ${f.dataBR(g.capacidade.retrato.data)}`, `snapshot of ${f.dataBR(g.capacidade.retrato.data)}`), natureza: "OBSERVADO" });
    const ultimo = g.capacidade.mensal.meses.at(-1);
    if (ultimo) out.push({ rotulo: tx("Fator de capacidade", "Capacity factor"), texto: ateMes(ultimo), natureza: "CALCULADO" });
  }
  return out;
}

/**
 * Categorias cuja cobertura na fonte mudou em algum mês da série mensal (ressalva de universo no mês): quantos meses e o último.
 * Serve à nota sob a série mensal: a variação dessas categorias entre meses pode refletir a cobertura, não só a geração.
 */
export function coberturaMensal(ms: Pick<MensalSin, "ressalvas_universo">, idioma: Idioma = idiomaEnergia()): { id: CategoriaGeracao; rotulo: string; meses: number; ultimo: string }[] {
  const curto = curtoCategoria(idioma);
  return CATEGORIAS.flatMap((c) => {
    const lista = ms.ressalvas_universo[c] ?? [];
    return lista.length ? [{ id: c, rotulo: curto[c], meses: lista.length, ultimo: [...lista].sort().at(-1)! }] : [];
  });
}

/* ====================================================================== */
/* Ajustes das avaliações independentes: o que mudou, notas de universo,    */
/* amostra pequena e referências ao lado do dado                            */
/* ====================================================================== */

/** AAAA-MM deslocado em `meses` (negativo volta no tempo). */
export function mesDeslocado(mes: string, meses: number): string {
  const n = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + meses;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
}

/**
 * "O que mudou" de uma série mensal: o último mês completo contra o mês anterior e contra o mesmo mês de um ano antes. Valor em
 * unidade própria vira variação em %; valor que já é percentual (fator de capacidade, taxa) vira diferença em pontos percentuais.
 * Mês sem valor é dito, nunca zerado, e a frase some quando nem o último mês tem valor. `nome` e `unidade` vêm no idioma da página.
 */
export function textoMudancaMensal(
  o: {
    nome: string;
    unidade: string;
    casas?: number;
    percentual?: boolean;
    meses: readonly string[];
    valores: readonly (number | null | undefined)[];
    mes: string | null;
  },
  idioma: Idioma = idiomaEnergia(),
): string {
  if (!o.mes) return "";
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const casas = o.casas ?? 1;
  const valor = (m: string): number | null => {
    const i = o.meses.indexOf(m);
    const v = i >= 0 ? o.valores[i] : null;
    return v === null || v === undefined ? null : v;
  };
  const v = valor(o.mes);
  if (v === null) return "";
  const fmt = (x: number) => `${f.num(x, casas)}${o.percentual ? "%" : ` ${o.unidade}`}`;
  const diferenca = (ref: number) => {
    if (o.percentual) {
      const d = v - ref;
      const a = Math.round(Math.abs(d) * 10) / 10;
      const pontos = a === 1 ? tx("ponto percentual", "percentage point") : tx("pontos percentuais", "percentage points");
      return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f.num(a, 1)} ${pontos}`;
    }
    if (ref === 0) return tx("sem variação calculável", "no computable variation");
    const d = (100 * (v - ref)) / ref;
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f.num(Math.abs(d), 1)}%`;
  };
  const contra = (m: string) => {
    const x = valor(m);
    return x === null ? tx(`sem valor em ${f.mesAno(m)}`, `no value in ${f.mesAno(m)}`) : tx(`${fmt(x)} em ${f.mesAno(m)} (${diferenca(x)})`, `${fmt(x)} in ${f.mesAno(m)} (${diferenca(x)})`);
  };
  const anterior = mesDeslocado(o.mes, -1);
  const anoAntes = mesDeslocado(o.mes, -12);
  return tx(
    `${inicial(o.nome)} em ${f.mesAno(o.mes)}: ${fmt(v)}, contra ${contra(anterior)} e ${contra(anoAntes)}.`,
    `${inicial(o.nome)} in ${f.mesAno(o.mes)}: ${fmt(v)}, against ${contra(anterior)} and ${contra(anoAntes)}.`,
  );
}

/** CVU zero publicado na semana: quantas parcelas e em quais combustíveis. Zero é valor da fonte, mantido como publicado e nunca tratado como ausência. */
export function zerosDoCvu(
  cvu: Pick<NonNullable<Termica["cvu"]>, "usinas">,
  idioma: Idioma = idiomaEnergia(),
): { total: number; zeros: number; porCombustivel: { categoria: string; rotulo: string; n: number; zeros: number }[] } {
  const por: Record<string, { n: number; zeros: number }> = {};
  for (const u of cvu.usinas) {
    const x = (por[u.categoria] ??= { n: 0, zeros: 0 });
    x.n += 1;
    if (u.cvu === 0) x.zeros += 1;
  }
  const cc = curtoCombustivel(idioma) as Record<string, string>;
  const rotulo = (k: string) => cc[k] ?? k;
  const porCombustivel = Object.keys(por)
    .filter((k) => por[k].zeros > 0)
    .map((k) => ({ categoria: k, rotulo: rotulo(k), n: por[k].n, zeros: por[k].zeros }))
    .sort((a, b) => b.zeros - a.zeros);
  return { total: cvu.usinas.length, zeros: porCombustivel.reduce((t, x) => t + x.zeros, 0), porCombustivel };
}

export function notaCvuZero(cvu: Pick<NonNullable<Termica["cvu"]>, "usinas">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const z = zerosDoCvu(cvu, idioma);
  const onde = listaTexto(
    z.porCombustivel.map((x) => tx(`${minusculaPalavras(x.rotulo)}, ${f.num(x.zeros, 0)} de ${f.num(x.n, 0)}`, `${minusculaPalavras(x.rotulo)}, ${f.num(x.zeros, 0)} of ${f.num(x.n, 0)}`)),
    idioma,
  );
  const zero =
    z.zeros > 0
      ? tx(
          `CVU 0,00 é valor publicado pela fonte em ${f.num(z.zeros, 0)} das ${f.num(z.total, 0)} parcelas da semana (${onde}); fica como publicado e nunca é tratado como ausência. `,
          `A CVU of ${f.num(0, 2)} is a value published by the source in ${f.num(z.zeros, 0)} of the ${f.num(z.total, 0)} portions of the week (${onde}); it stays as published and is never treated as missing. `,
        )
      : "";
  return `${zero}${tx("A mediana é a das parcelas com CVU, sem peso pela geração, em reais correntes de cada semana.", "The median is that of the portions with a CVU, unweighted by generation, in current reais of each week.")}`;
}

/** Nota da térmica por motivo: o não classificado (total verificado menos a soma dos motivos, com sinal) fica fora das barras e dentro da tabela. */
export function notaNaoClassificado(u: Pick<Termica["ultimos_12m"], "nao_classificado_mwh" | "nao_classificado_pct" | "total_mwh">, idioma: Idioma = idiomaEnergia()): string {
  if (u.nao_classificado_mwh === null || u.nao_classificado_mwh === undefined) return "";
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const g = gwh(u.nao_classificado_mwh);
  const pct = u.nao_classificado_pct;
  const parte = pct === null || pct === undefined ? "" : tx(` (${f.num(pct, 3)}% da geração térmica)`, ` (${f.num(pct, 3)}% of thermal generation)`);
  return tx(
    `As barras somam só os motivos classificados; o não classificado, ${f.num(g, 1)} GWh${parte}, é o total verificado menos a soma dos motivos, com sinal, como a fonte publica, e está na tabela.`,
    `The bars add up only the classified reasons; the unclassified amount, ${f.num(g, 1)} GWh${parte}, is the verified total minus the sum of the reasons, with its sign, as the source publishes it, and it is in the table.`,
  );
}

/** Quando o número de usinas pareadas ou a cobertura mudam dentro dos 12 meses publicados, a página diz (o universo cresce, não só a geração). */
export function notaCrescimentoUniverso(u: Pick<Termica["universo"], "mensal">, idioma: Idioma = idiomaEnergia()): string {
  const m = u.mensal;
  if (m.length < 2) return "";
  const a = m[0];
  const z = m[m.length - 1];
  if (a.usinas_pareadas === z.usinas_pareadas && a.cobertura_tipo_i_iia_pct === z.cobertura_tipo_i_iia_pct) return "";
  const tx = txEm(idioma);
  const f = formatos(idioma);
  return tx(
    `O universo muda dentro dos 12 meses: as usinas pareadas entre os dois conjuntos do ONS passam de ${f.num(a.usinas_pareadas, 0)} em ${f.mesAno(a.mes)} para ${f.num(z.usinas_pareadas, 0)} em ${f.mesAno(z.mes)}, e a cobertura das térmicas Tipo I e II-A na Geração por Usina, de ${f.num(a.cobertura_tipo_i_iia_pct, 1)}% para ${f.num(z.cobertura_tipo_i_iia_pct, 1)}%.`,
    `The universe changes within the 12 months: the plants matched between the two ONS datasets go from ${f.num(a.usinas_pareadas, 0)} in ${f.mesAno(a.mes)} to ${f.num(z.usinas_pareadas, 0)} in ${f.mesAno(z.mes)}, and the coverage of Type I and II-A thermal plants in the ONS generation by plant dataset, from ${f.num(a.cobertura_tipo_i_iia_pct, 1)}% to ${f.num(z.cobertura_tipo_i_iia_pct, 1)}%.`,
  );
}

/** Soma térmica da matriz efetiva numa janela (nuclear, gás, carvão, óleo, biomassa e outras térmicas; sem as térmicas Tipo III), em MWmed. */
export function somaTermicaDaMatriz(mix: Pick<Mix, "mwmed"> | null): number | null {
  if (!mix) return null;
  const cats: CategoriaGeracao[] = ["nuclear", "gas", "carvao", "oleo", "biomassa", "outros"];
  const v = cats.map((c) => mix.mwmed[c]).filter((x): x is number => x !== null);
  return v.length ? v.reduce((t, x) => t + x, 0) : null;
}

/** As `n` usinas térmicas com mais geração nos 12 meses (a lista da gold já vem ordenada; aqui a ordem é explícita). */
export function maioresUsinasTermicas(usinas: readonly TermicaUsina[], n = 10): TermicaUsina[] {
  return [...usinas].sort((a, b) => (b.mwmed ?? 0) - (a.mwmed ?? 0)).slice(0, n);
}

/** Comparação aberta por padrão: a usina com mais geração de cada um de `n` combustíveis diferentes, na ordem da geração. */
export function usinasPadraoComparacao(usinas: readonly TermicaUsina[], n = 3): TermicaUsina[] {
  const vistos: Record<string, boolean> = {};
  const out: TermicaUsina[] = [];
  for (const u of maioresUsinasTermicas(usinas, usinas.length)) {
    if (vistos[u.categoria]) continue;
    vistos[u.categoria] = true;
    out.push(u);
    if (out.length >= n) break;
  }
  return out;
}

/** Dias em que o Balanço registra a eólica de um subsistema muito abaixo da soma das usinas (menos de 10%): entram nas maiores divergências da reconciliação. */
export function diasDoBalancoForaDoPadrao(rec: Pick<Matriz["reconciliacao_balanco"], "maiores_divergencias">): { d: string; sm: string; balanco_mwh: number; usinas_mwh: number }[] {
  return rec.maiores_divergencias
    .flatMap((x) => (x.fonte === "eolica" && x.usinas_mwh !== null && x.balanco_mwh !== null && x.usinas_mwh > 0 && x.balanco_mwh < 0.1 * x.usinas_mwh ? [{ d: x.d, sm: x.sm as string, balanco_mwh: x.balanco_mwh, usinas_mwh: x.usinas_mwh }] : []))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}

/** Frase dos dias em que o Balanço registra a eólica muito abaixo da soma das usinas, por subsistema, com o maior caso como exemplo; vazia sem esses dias. */
export function textoDiasDoBalancoForaDoPadrao(dias: readonly { d: string; sm: string; balanco_mwh: number; usinas_mwh: number }[], idioma: Idioma = idiomaEnergia()): string {
  if (!dias.length) return "";
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const regiao = nomeRegiao(idioma) as Record<string, string>;
  const nome = (sm: string) => regiao[sm] ?? sm;
  const porDia: { d: string; sms: string[] }[] = [];
  for (const x of dias) {
    let e = porDia.find((p) => p.d === x.d);
    if (!e) {
      e = { d: x.d, sms: [] };
      porDia.push(e);
    }
    e.sms.push(nome(x.sm));
  }
  const ex = [...dias].sort((a, b) => b.usinas_mwh - a.usinas_mwh)[0];
  const quando = listaTexto(porDia.map((p) => `${f.dataBR(p.d)} (${listaTexto(p.sms, idioma)})`), idioma);
  return tx(
    `No Balanço, a eólica fica muito abaixo da soma das usinas em ${quando}; por exemplo, ${f.num(ex.balanco_mwh / 1000, 1)} GWh contra ${f.num(ex.usinas_mwh / 1000, 1)} GWh no ${nome(ex.sm)} em ${f.dataBR(ex.d)}. As janelas de 7 dias que incluem esses dias usam esse Balanço e podem ter a participação térmica distorcida; a divergência está listada em Auditar.`,
    `In the Energy Balance, wind is far below the sum of the plants on ${quando}; for example, ${f.num(ex.balanco_mwh / 1000, 1)} GWh against ${f.num(ex.usinas_mwh / 1000, 1)} GWh in the ${nome(ex.sm)} on ${f.dataBR(ex.d)}. The 7-day windows that include these days use that Balance and may have a distorted thermal share; the divergence is listed under Audit.`,
  );
}

/** Categorias em que a capacidade fiscalizada da ANEEL (SIGA) e a potência do ONS diferem em mais de 25%: outro universo e outra classificação. */
export function diferencasAneelOns(linhas: readonly Pick<LinhaCapacidade, "id" | "categoria" | "mw" | "siga_mw">[]): { id: CategoriaCapacidade; categoria: string; aneel: number; ons: number }[] {
  return linhas
    .flatMap((l) => (l.mw && l.siga_mw && Math.abs(l.siga_mw / l.mw - 1) > 0.25 ? [{ id: l.id, categoria: l.categoria, aneel: l.siga_mw, ons: l.mw }] : []))
    .sort((a, b) => Math.abs(b.aneel - b.ons) - Math.abs(a.aneel - a.ons));
}

/** Categorias cujo fator de capacidade usa só parte da potência em operação (denominador com menos de 90% dela): a ressalva vem junto do fator. */
export function coberturaDaPotencia(
  linhas: readonly Pick<LinhaCapacidade, "id" | "categoria" | "fc_pct" | "potencia_media_12m_mw" | "capacidade_hora_media_mw">[],
): { id: CategoriaCapacidade; categoria: string; fc: number; denominador: number; potencia: number; pct: number }[] {
  return linhas.flatMap((l) => {
    const d = l.capacidade_hora_media_mw;
    const p = l.potencia_media_12m_mw;
    return l.fc_pct !== null && d && p && d / p < 0.9 ? [{ id: l.id, categoria: l.categoria, fc: l.fc_pct, denominador: d, potencia: p, pct: (100 * d) / p }] : [];
  });
}

/** Menos de 10 observações: a distribuição não se descreve por quantis; mostram-se os valores de cada usina ou conjunto (menores e maiores cobrem todos). */
export const MINIMO_PARA_DISTRIBUICAO = 10;

export function observacoesFc(u: Pick<Capacidade12m, "menores" | "maiores">, idioma: Idioma = idiomaEnergia()): { id: string; nome: string; fc_pct: number }[] {
  const semNome = tx("sem nome na fonte", "no name in the source", idioma);
  const vistos: Record<string, boolean> = {};
  const out: { id: string; nome: string; fc_pct: number }[] = [];
  for (const x of [...u.menores, ...u.maiores]) {
    if (vistos[x.id] || x.fc_pct === null || x.fc_pct === undefined) continue;
    vistos[x.id] = true;
    out.push({ id: x.id, nome: x.nome ?? semNome, fc_pct: x.fc_pct });
  }
  return out.sort((a, b) => b.fc_pct - a.fc_pct);
}

/** Universo e início de cada fonte de restrição, para a frase que as junta: eólica e fotovoltaica não são o mesmo universo nem o mesmo período. */
export function notaUniversoRestricoes(rs: Partial<Record<FonteRestricao, Pick<Restricao, "primeiro_mes" | "ultimos_12m">>>, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const nome = nomeFonteRestricao(idioma);
  const partes = FONTES_RESTRICAO.flatMap((fr) => {
    const r = rs[fr];
    if (!r?.ultimos_12m) return [];
    const n = f.num(r.ultimos_12m.usinas_no_universo, 0);
    const desde = f.mesAno(r.primeiro_mes);
    return [tx(`${nome[fr].toLowerCase()}, ${n} usinas e conjuntos, série desde ${desde}`, `${nome[fr].toLowerCase()}, ${n} plants and plant clusters, series since ${desde}`)];
  });
  if (partes.length <= 1) return "";
  const l = listaTexto(partes, idioma);
  return tx(
    `Universos e períodos diferentes: ${l}. As duas taxas não se comparam como se fossem do mesmo conjunto.`,
    `Different universes and periods: ${l}. The two rates are not comparable as if they referred to the same set.`,
  );
}

/** Em palavras simples, o que cada motivo de despacho quer dizer (a redação do ONS fica ao lado, no rótulo publicado). */
export function glosaMotivo(idioma: Idioma = idiomaEnergia()): Record<MotivoDespacho, string> {
  return porIdioma(idioma, {
    pt: {
      merito: "Entra a usina de menor custo variável declarado, depois da geração inflexível.",
      inflexibilidade: "Geração que o agente declara não poder reduzir, ou que ficou acima do despachado.",
      razao_eletrica: "Geração necessária ao sistema elétrico, à segurança da rede, como o ONS classifica.",
      garantia_energetica: "Geração decidida pelo CMSE (Comitê de Monitoramento do Setor Elétrico) para garantir o suprimento de energia.",
      gfom: "Geração fora da ordem de mérito para compensar falta futura de combustível.",
      reposicao_perdas: "Geração para repor perdas, como a fonte rotula.",
      exportacao: "Geração para atender à exportação de energia.",
      reserva_potencia: "Geração para recompor a reserva de potência operativa.",
      substituicao: "Geração no lugar de uma usina que ficou sem combustível.",
      unit_commitment: "Usina mantida ligada para respeitar a rampa (velocidade de subida e descida) e os tempos mínimos de operação.",
    },
    en: {
      merito: "The plant with the lowest declared variable cost runs, after the inflexible generation.",
      inflexibilidade: "Generation the agent declares it cannot reduce, or that ended up above the dispatched amount.",
      razao_eletrica: "Generation the power system needs for grid security, as classified by the ONS.",
      garantia_energetica: "Generation decided by the CMSE (Power Sector Monitoring Committee) to secure the energy supply.",
      gfom: "Generation outside the merit order to offset a future fuel shortage.",
      reposicao_perdas: "Generation to replace losses, as the source labels it.",
      exportacao: "Generation to meet energy exports.",
      reserva_potencia: "Generation to restore the operating capacity reserve.",
      substituicao: "Generation in place of a plant that was left without fuel.",
      unit_commitment: "Plant kept online to respect its ramping (speed of increase and decrease) and minimum operating times.",
    },
  });
}

/* ====================================================================== */
/* vereditos (r8): resposta curta em duas camadas                           */
/* ====================================================================== */

/**
 * Cada veredito responde, em palavras simples e com no máximo dois números, à pergunta do título do painel e diz o limite
 * de leitura. Os números saem dos mesmos campos da resposta completa (respostaMatriz, respostaTermica, respostaRestricao e
 * respostaCapacidade), que continua inteira como segunda camada em Analisar e Auditar. Dado ausente: veredito vazio.
 */

/** P021: as duas maiores fontes do recorte escolhido e o aviso de que parte da energia é estimativa ou previsão do ONS. */
export function vereditoMatriz(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return "";
  const frase = fraseCategoria(idioma);
  const nomes = Object.fromEntries(CATEGORIAS.map((c) => [c, frase[c]])) as Record<CategoriaGeracao, string>;
  const linhas = ordenaPorParticipacao(linhasMatriz(m, rg, janela, per, nomes, idioma)).filter((l) => (l.participacao ?? 0) > 0);
  if (!linhas.length) return "";
  const periodo = janela === "dia" ? tx(`Em ${f.dataBR(mix.fim)}`, `On ${f.dataBR(mix.fim)}`) : tx(`Nos ${mix.dias} dias até ${f.dataBR(mix.fim)}`, `In the ${mix.dias} days up to ${f.dataBR(mix.fim)}`);
  const quando = `${periodo}${per === "sem" ? tx(", sem a MMGD estimada", ", without the estimated MMGD") : ""}`;
  const onde = doRegiao(idioma)[rg];
  const [a, b] = linhas;
  const fontes = b
    ? tx(
        `as duas maiores fontes foram ${a.categoria}, com ${f.num(a.participacao, 1)}% da geração ${onde}, e ${b.categoria}, com ${f.num(b.participacao, 1)}%`,
        `the two largest sources were ${a.categoria}, with ${f.num(a.participacao, 1)}% of generation ${onde}, and ${b.categoria}, with ${f.num(b.participacao, 1)}%`,
      )
    : tx(`a única fonte com geração foi ${a.categoria}, com ${f.num(a.participacao, 1)}% da geração ${onde}`, `the only source with generation was ${a.categoria}, with ${f.num(a.participacao, 1)}% of generation ${onde}`);
  const limite =
    per === "sem"
      ? tx("A MMGD estimada pelo ONS fica fora desta conta.", "The MMGD estimated by the ONS is left out of this calculation.")
      : tx("Parte da energia é estimativa ou previsão do ONS, não medição.", "Part of the energy is an ONS estimate or forecast, not a measurement.");
  return `${quando}, ${fontes}. ${limite}`;
}

/** Fontes das pequenas usinas Tipo III, em plural, na ordem das categorias; todas as térmicas viram "térmicas". */
export function fontesDoGrupoTipo3(
  rotulos: readonly Pick<RotuloFonte, "categoria" | "natureza" | "mwh_12m" | "mwh_desde_inicio">[],
  categorias: GoldGeracaoDetalhe["categorias"],
  idioma: Idioma = idiomaEnergia(),
): string[] {
  const tx = txEm(idioma);
  const plural: Partial<Record<CategoriaGeracao, string>> = porIdioma(idioma, {
    pt: { hidraulica: "hidráulicas", eolica: "eólicas", solar_centralizada: "solares" },
    en: { hidraulica: "hydropower", eolica: "wind", solar_centralizada: "solar" },
  });
  const termica = new Set(categorias.filter((c) => c.termica).map((c) => c.id));
  const com = new Set(rotulos.filter((r) => r.natureza === "grupo_tipo3" && (r.mwh_12m ?? 0) > 0).map((r) => r.categoria));
  const out: string[] = [];
  for (const c of CATEGORIAS) if (com.has(c) && plural[c]) out.push(plural[c]!);
  if (CATEGORIAS.some((c) => com.has(c) && termica.has(c))) out.push(tx("térmicas", "thermal"));
  return out;
}

/**
 * Conciliação do Tipo III: a natureza "previsão do ONS para grupos Tipo III" reúne pequenas usinas de várias fontes e vale
 * `grupo` % da geração; o gráfico mostra só a categoria "Térmicas Tipo III", a parte térmica do grupo, em `termica` %.
 */
export function notaTipoIII(mix: Mix | null, per: Perimetro, fontes: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (!mix) return "";
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const grupo = mix.natureza_pct.grupo_tipo3;
  const termica = per === "com" ? mix.participacao.termica_sem_combustivel : mix.participacao_sem_mmgd.termica_sem_combustivel;
  if (grupo === null || termica === null) return "";
  const quais = fontes.length
    ? tx(`${listaTexto(fontes, idioma)}, cada uma contada na sua fonte`, `${listaTexto(fontes, idioma)} plants, each counted in its own source`)
    : tx("de várias fontes", "plants from several sources");
  const sem = per === "sem" ? tx(" (sem a MMGD no total)", " (without the MMGD in the total)") : "";
  return tx(
    `Pequenas usinas Tipo III: ${f.num(grupo, 1)}% da geração com a MMGD estimada, somando usinas ${quais}. O gráfico mostra só a parte térmica do grupo, "Térmicas Tipo III": ${f.num(termica, 1)}%${sem}.`,
    `Small Type III plants: ${f.num(grupo, 1)}% of generation including the estimated MMGD, adding up ${quais}. The chart shows only the thermal part of the group, "Type III thermal plants": ${f.num(termica, 1)}%${sem}.`,
  );
}

/** P022: a energia térmica dos 12 meses e o motivo de despacho com maior parcela, como o ONS o classifica. */
export function vereditoTermica(t: Pick<Termica, "ultimos_12m">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const u = t.ultimos_12m;
  const principal = [...u.por_motivo].filter((m) => (m.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  if (u.total_mwmed === null) return "";
  const nomeMotivo = principal ? minusculaPalavras(curtoMotivo(idioma)[principal.motivo]) : "";
  const glosa = principal?.motivo === "inflexibilidade" ? tx(" (geração declarada pelo agente ou acima do despachado)", " (generation declared by the agent, or above the dispatched amount)") : "";
  const motivo = principal ? tx(`, ${f.num(principal.pct, 1)}% por ${nomeMotivo}${glosa}`, `, ${f.num(principal.pct, 1)}% due to ${nomeMotivo}${glosa}`) : "";
  return tx(
    `Nos 12 meses até ${f.mesAno(u.fim)}, as térmicas despachadas pelo ONS geraram ${f.num(u.total_mwmed, 0)} MWmed em média${motivo}. O motivo é a classificação do ONS, não uma inferência do observatório.`,
    `In the 12 months up to ${f.mesAno(u.fim)}, the thermal plants dispatched by the ONS generated an average of ${f.num(u.total_mwmed, 0)} MWavg${motivo}. The reason is the ONS classification, not an inference by the observatory.`,
  );
}

/** P023: o quanto as eólicas e as fotovoltaicas deixaram de gerar por limitação do ONS (cada fonte publicada com 12 meses). */
export function vereditoRestricao(rs: Partial<Record<FonteRestricao, Pick<Restricao, "fonte" | "primeiro_mes" | "ultimos_12m">>>, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const com = FONTES_RESTRICAO.filter((fr) => rs[fr]?.ultimos_12m && rs[fr]!.ultimos_12m!.taxa_pct !== null);
  if (!com.length) return "";
  const frase = fraseFonteRestricao(idioma);
  const nome = (fr: FonteRestricao) => frase[fr].replace(/^usinas /, "");
  const taxa = (fr: FonteRestricao) => `${f.num(rs[fr]!.ultimos_12m!.taxa_pct, 1)}%`;
  const fim = rs[com[0]]!.ultimos_12m!.fim;
  const quando = com.every((fr) => rs[fr]!.ultimos_12m!.fim === fim) ? tx(`Nos 12 meses até ${f.mesAno(fim)}`, `In the 12 months up to ${f.mesAno(fim)}`) : tx("Nos últimos 12 meses completos", "In the last 12 complete months");
  const [a, b] = com;
  const corpo = tx(
    `a limitação do ONS fez as ${nome(a)} deixarem de gerar ${taxa(a)} do que teriam gerado${b ? `, e as ${nome(b)}, ${taxa(b)}` : ""}`,
    `ONS limitation kept ${frase[a]} from generating ${taxa(a)} of what they would have generated${b ? `, and ${frase[b]}, ${taxa(b)}` : ""}`,
  );
  return tx(`${quando}, ${corpo}. O valor é estimativa, e restrição não é falta de vento nem de sol.`, `${quando}, ${corpo}. The value is an estimate, and a restriction is not a lack of wind or sun.`);
}

/** Razões oficiais sem energia não gerada nos 12 meses (não aparecem no gráfico mensal) e a chave das que aparecem. */
export function notaRazoesRestricao(
  r: Pick<Restricao, "ultimos_12m">,
  rotulos: Partial<Record<RazaoRestricao, string>>,
  noGrafico: readonly RazaoRestricao[],
  idioma: Idioma = idiomaEnergia(),
): string {
  const u = r.ultimos_12m;
  if (!u) return "";
  const tx = txEm(idioma);
  const cr = curtoRazao(idioma);
  const minuscula = (z: RazaoRestricao) => (rotulos[z] ?? cr[z]).replace(/^(.)/, (c) => c.toLowerCase());
  const chave = noGrafico.map((z) => `${z}, ${minuscula(z)}`);
  const oficiais: RazaoRestricao[] = ["REL", "CNF", "ENE", "PAR"];
  const vazias = oficiais.filter((z) => !noGrafico.includes(z));
  const quais = inicial(listaTexto(vazias.map(minuscula), idioma));
  const semEnergia = vazias.length
    ? tx(
        ` ${quais} não teve energia não gerada nos 12 meses e por isso não aparece no gráfico.`,
        ` ${quais} had no energy left ungenerated in the 12 months and therefore does not appear in the chart.`,
      )
    : "";
  return tx(`Razões no gráfico: ${chave.join("; ")}.${semEnergia}`, `Reasons in the chart: ${chave.join("; ")}.${semEnergia}`);
}

/** P024: a potência instalada no retrato, o fator de capacidade de uma fonte em palavras simples e o que fica fora da soma. */
export function vereditoCapacidade(c: Pick<Capacidade, "retrato" | "ultimos_12m" | "contexto">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  const r = c.retrato;
  if (r.total_mw === null) return "";
  const u = c.ultimos_12m;
  const NOME: Partial<Record<CategoriaCapacidade, string>> = porIdioma(idioma, {
    pt: { eolica: "eólicas", solar_centralizada: "solares centralizadas", hidraulica: "hidrelétricas" },
    en: { eolica: "wind plants", solar_centralizada: "centralized solar plants", hidraulica: "hydropower plants" },
  });
  const base = (["eolica", "solar_centralizada", "hidraulica"] as const).map((k) => u?.por_categoria.find((x) => x.categoria === k)).find((x) => !!x && x.fator_capacidade_pct !== null);
  const fc =
    u && base
      ? tx(
          ` Nos 12 meses até ${f.mesAno(u.fim)}, as ${NOME[base.categoria]} geraram ${f.num(base.fator_capacidade_pct, 1)}% do máximo que a potência delas permitiria.`,
          ` In the 12 months up to ${f.mesAno(u.fim)}, ${NOME[base.categoria]} generated ${f.num(base.fator_capacidade_pct, 1)}% of the maximum their capacity would allow.`,
        )
      : "";
  const mmgd = c.contexto.mmgd ? tx(" A micro e minigeração distribuída fica fora.", " Distributed micro and mini generation is left out.") : "";
  return tx(
    `Em ${f.dataBR(r.data)}, as usinas despachadas pelo ONS somavam ${f.num(r.total_mw, 0)} MW.${fc}${mmgd}`,
    `On ${f.dataBR(r.data)}, the plants dispatched by the ONS totaled ${f.num(r.total_mw, 0)} MW.${fc}${mmgd}`,
  );
}

/**
 * "O que mudou" de painel mensal que não compara com a publicação anterior: diz isso e até que mês o dado vai e quando
 * foi processado, em vez de apresentar a data de processamento como se fosse mudança. `nome` vem no idioma da página.
 */
export function textoSemComparacaoMensal(ultimoMes: string | null, geradoEm: string, nome: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (!ultimoMes) return tx(`${inicial(nome)}: nenhum mês completo publicado.`, `${inicial(nome)}: no complete month published.`);
  const proc = f.dataBR(diaDeBrasilia(geradoEm));
  return tx(
    `Sem comparação com a publicação anterior. ${inicial(nome)}: último mês completo ${f.mesAno(ultimoMes)}, processado em ${proc}.`,
    `No comparison with the previous release. ${inicial(nome)}: latest complete month ${f.mesAno(ultimoMes)}, processed on ${proc}.`,
  );
}
