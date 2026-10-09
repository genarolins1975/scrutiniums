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
 */
import { dataBR, horaLocal, mesAno, num, plural } from "./formato";
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

/* ====================================================================== */
/* rotas, painéis e atualidade                                              */
/* ====================================================================== */

export const ROTA_GERACAO = "/setor-eletrico/geracao";
export type PainelGeracao = "p021" | "p022" | "p023" | "p024";

/** Pergunta do destino Geração no menu (navegacao.ts) e título da página principal. */
export const PERGUNTA_MODULO_GERACAO = "De onde vem a eletricidade e quais fontes estão sendo usadas?";

/**
 * Um painel por página: cada um tem séries, várias tabelas equivalentes e fichas de prova;
 * juntos passariam da meta de cerca de 600 KB de HTML por página (contrato, seção 5.1).
 * Perguntas do Anexo A, com o sujeito explícito quando a pergunta curta seria ambígua.
 */
/** `publicado`: a rota do painel já existe no app; painel não publicado aparece como "em preparação", nunca como link. */
export const PAINEIS_GERACAO: { id: PainelGeracao; rotulo: string; caminho: string; pergunta: string; publicado: boolean }[] = [
  { id: "p021", rotulo: "Matriz efetiva", caminho: "", pergunta: "De onde vem a eletricidade?", publicado: true },
  { id: "p022", rotulo: "Despacho térmico", caminho: "/termica", pergunta: "Quanto as térmicas geraram e por que foram acionadas?", publicado: true },
  { id: "p023", rotulo: "Renováveis restringidas", caminho: "/restricoes", pergunta: "Quanta geração eólica e solar foi restringida?", publicado: true },
  { id: "p024", rotulo: "Capacidade e utilização", caminho: "/capacidade", pergunta: "Quanto está instalado e quanto produz?", publicado: true },
];

export function painelPublicado(id: PainelGeracao): boolean {
  return PAINEIS_GERACAO.find((p) => p.id === id)?.publicado ?? false;
}

export function rotaPainel(id: PainelGeracao): string {
  return `${ROTA_GERACAO}${PAINEIS_GERACAO.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelGeracao): string {
  return PAINEIS_GERACAO.find((p) => p.id === id)?.pergunta ?? "";
}

/**
 * Texto da gold em português de leitor: troca nomes de campo e identificadores internos (id_ons, ressalvas_universo, natureza_pct,
 * matriz.universo, hidraulica sem acento) pela descrição, e a frase "igual ao do Balanço" pela que a reconciliação sustenta
 * (próximo, com divergências listadas em Auditar). Só muda a redação exibida: o dado e o arquivo publicado seguem como estão.
 */
const EM_PORTUGUES: readonly (readonly [RegExp, string])[] = [
  [/\(total da Geração por Usina, igual ao do Balanço\)/g, "(total da Geração por Usina, próximo ao do Balanço, com divergências listadas em Auditar)"],
  [/matriz\.outros_por_ceg/g, "a decomposição de outras térmicas pelo CEG"],
  [/matriz\.universo/g, "o universo da matriz"],
  [/\boutros_por_ceg\b/g, "decomposição de outras térmicas pelo CEG"],
  [/\bressalvas_universo\b/g, "ressalvas de universo"],
  [/\bnatureza_mensal_sin\b/g, "série mensal por natureza"],
  [/\bnatureza_pct\b/g, "parcela por natureza"],
  [/\bid_ons\b/g, "código do ONS"],
  [/'quebras'/g, "a tabela de mudanças de universo e de rótulo"],
  [/\btermica_sem_combustivel\b/g, "térmicas Tipo III"],
  [/\bsolar_centralizada\b/g, "solar centralizada"],
  [/\bsolar_mmgd\b/g, "solar MMGD"],
  [/\bnao_mapeada\b/g, "não mapeada"],
  [/\bhidraulica\b/g, "hidráulica"],
  [/\btermica\b/g, "térmica"],
  [/\beolica\b/g, "eólica"],
];

export function emPortugues(texto: string): string {
  return EM_PORTUGUES.reduce((t, [re, por]) => t.replace(re, por), texto);
}

/** Linhas com valores simples (número, texto, nulo) para a tabela; booleano vira "sim"/"não", lista vira texto. */
export function paraTabela<T extends object>(linhas: readonly T[]): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "sim" : "não") : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

/** MWh para GWh (unidade de exibição); ausência continua ausência. */
export function gwh(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v / 1000;
}

/** "a", "a e b", "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
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
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3): { defasada: boolean; dias: number; texto: string } {
  const proc = diaDeBrasilia(geradoEm);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: `Fonte defasada: o dia mais recente é ${dataBR(diaReferencia)}, ${plural(dias, "dia", "dias")} antes do processamento (${dataBR(proc)}), mais que o atraso habitual de publicação do ONS. Os números são os da última publicação válida.`,
    };
  }
  return { defasada: false, dias, texto: `Dado até ${dataBR(diaReferencia)}, processado em ${dataBR(proc)} (${plural(dias, "dia", "dias")} depois).` };
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
  return m ? `d${m[1]} ${m[2]}` : `de ${nome}`;
}

export function situacaoMensal(ultimoMes: string | null, geradoEm: string, nome: string): { defasada: boolean; texto: string } {
  const proc = diaDeBrasilia(geradoEm);
  if (!ultimoMes) return { defasada: true, texto: `${inicial(nome)}: nenhum mês completo publicado.` };
  // dias entre o fim do último mês completo e o processamento: processar no dia 1 com agosto completo são 31 dias, o ritmo normal de um conjunto diário
  const fimDoMes = new Date(Date.UTC(Number(ultimoMes.slice(0, 4)), Number(ultimoMes.slice(5, 7)), 0));
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - fimDoMes.getTime()) / 86_400_000);
  if (dias > 45) {
    return {
      defasada: true,
      texto: `Fonte defasada: o último mês completo ${deContraido(nome)} é ${mesAno(ultimoMes)}, encerrado ${plural(dias, "dia", "dias")} antes do processamento (${dataBR(proc)}). Os números são os da última publicação válida.`,
    };
  }
  return { defasada: false, texto: `${inicial(nome)}: último mês completo ${mesAno(ultimoMes)}, processado em ${dataBR(proc)}.` };
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
export const CURTO_CATEGORIA: Record<CategoriaGeracao, string> = {
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
};

/** Nome dentro de frase (minúscula, com a natureza quando ela muda a leitura). */
export const FRASE_CATEGORIA: Record<CategoriaGeracao, string> = {
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
};

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

/** Nome completo de cada categoria, como a gold publica. */
export function nomesCategorias(cats: GoldGeracaoDetalhe["categorias"]): Record<CategoriaGeracao, string> {
  const out = { ...CURTO_CATEGORIA };
  for (const c of cats) out[c.id] = c.rotulo;
  return out;
}

export const REGIOES: readonly RegiaoGeracao[] = ["SIN", "SE", "S", "NE", "N"];
export const NOME_REGIAO: Record<RegiaoGeracao, string> = { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
export const DO_REGIAO: Record<RegiaoGeracao, string> = { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" };
export const NO_REGIAO: Record<RegiaoGeracao, string> = { SIN: "no SIN", SE: "no Sudeste/Centro-Oeste", S: "no Sul", NE: "no Nordeste", N: "no Norte" };
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

export const NATUREZAS: readonly NaturezaGeracao[] = ["verificada", "grupo_tipo3", "grupo_mmgd"];
export const CURTO_NATUREZA: Record<NaturezaGeracao, string> = {
  verificada: "Medição (usinas com relacionamento com o ONS)",
  grupo_tipo3: "Previsão do ONS (grupos Tipo III)",
  grupo_mmgd: "Estimativa do ONS (MMGD)",
};
export const COR_NATUREZA: Record<NaturezaGeracao, string> = {
  verificada: "var(--cor-energia)",
  grupo_tipo3: "var(--cor-previsto)",
  grupo_mmgd: "var(--serie-solar)",
};

/* ====================================================================== */
/* P021: matriz efetiva                                                     */
/* ====================================================================== */

export type JanelaMatriz = "dia" | "7d" | "30d" | "12m";
export const JANELAS: readonly JanelaMatriz[] = ["dia", "7d", "30d", "12m"];
export const ROTULO_JANELA: Record<JanelaMatriz, string> = { dia: "Último dia", "7d": "7 dias", "30d": "30 dias", "12m": "365 dias" };
export type Perimetro = "com" | "sem";
export const PERIMETROS: readonly Perimetro[] = ["com", "sem"];
export const ROTULO_PERIMETRO: Record<Perimetro, string> = { com: "Com MMGD estimada", sem: "Sem MMGD" };
/** O perímetro dentro de frase e de título: minúscula só na palavra comum, a sigla MMGD fica como está. */
export const PERIMETRO_EM_FRASE: Record<Perimetro, string> = { com: "com MMGD estimada", sem: "sem MMGD" };

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
export function periodoMix(x: Pick<Mix, "inicio" | "fim" | "dias">): string {
  return x.inicio === x.fim ? dataBR(x.inicio) : `${dataBR(x.inicio)} a ${dataBR(x.fim)} (${plural(x.dias, "dia", "dias")})`;
}

const participacaoDe = (x: Mix, per: Perimetro, c: CategoriaGeracao) => (per === "com" ? x.participacao[c] : x.participacao_sem_mmgd[c]);
const totalDe = (x: Mix, per: Perimetro) => (per === "com" ? x.total_mwmed : x.total_sem_mmgd_mwmed);

/** Ressalva de universo escrita: por que a participação da categoria não se compara com a de antes. */
export function textoRessalva(r: RessalvaUniverso | undefined | null): string | null {
  if (!r) return null;
  const partes: string[] = [];
  if (r.motivos.includes("universo_reduzido")) {
    partes.push(`${num(r.identificadores_com_valor_no_ultimo_mes, 0)} usinas com dado no último mês, contra até ${num(r.maior_numero_12_meses_antes, 0)} nos 12 meses anteriores`);
  }
  if (r.motivos.includes("salto_no_periodo") && r.saltos.length) partes.push(`salto no número de usinas com dado em ${listaTexto(r.saltos.map((s) => mesAno(s.slice(0, 7))))}`);
  return partes.length ? `Ressalva de universo: ${partes.join("; ")}.` : "Ressalva de universo.";
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
): LinhaMatriz[] {
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
      curto: `${CURTO_CATEGORIA[c]}${mix.ressalvas_universo[c] ? " (ressalva)" : ""}`,
      categoria: nomes[c],
      mwmed: v,
      participacao: participacaoDe(mix, per, c),
      mwmed_ref: vr,
      participacao_ref: ref ? participacaoDe(ref, per, c) : null,
      ressalva: textoRessalva(mix.ressalvas_universo[c]),
      presenca: dias !== undefined ? `linha em ${num(dias, 0)} de ${num(mix.dias, 0)} dias` : null,
    });
  }
  return out;
}

export function colunasMatriz(janela: JanelaMatriz, per: Perimetro): ColunaTabela[] {
  const ref = janelaReferencia(janela);
  const p = per === "com" ? "com MMGD" : "sem MMGD";
  return [
    { id: "categoria", rotulo: "Categoria", tipo: "texto" },
    { id: "mwmed", rotulo: `Geração, ${ROTULO_JANELA[janela]}`, tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "participacao", rotulo: `Participação, ${ROTULO_JANELA[janela]} (${p})`, tipo: "percentual", casas: 2 },
    { id: "mwmed_ref", rotulo: `Geração, ${ROTULO_JANELA[ref]}`, tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "participacao_ref", rotulo: `Participação, ${ROTULO_JANELA[ref]} (${p})`, tipo: "percentual", casas: 2 },
    { id: "ressalva", rotulo: "Ressalva de universo", tipo: "texto" },
    { id: "presenca", rotulo: "Presença parcial no período", tipo: "texto" },
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
export function respostaMatriz(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro): string {
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return `Sem janela publicada ${NO_REGIAO[rg]} nesta publicação.`;
  const total = totalDe(mix, per);
  const nomes = Object.fromEntries(CATEGORIAS.map((c) => [c, FRASE_CATEGORIA[c]])) as Record<CategoriaGeracao, string>;
  const linhas = ordenaPorParticipacao(linhasMatriz(m, rg, janela, per, nomes)).filter((l) => (l.participacao ?? 0) > 0);
  const maiores = linhas.slice(0, 5).map((l) => `${l.categoria} ${num(l.participacao, 1)}%`);
  const quando = janela === "dia" ? `Em ${dataBR(mix.inicio)}` : `De ${dataBR(mix.inicio)} a ${dataBR(mix.fim)} (${plural(mix.dias, "dia", "dias")})`;
  const perimetro = per === "sem" ? ", sem a MMGD estimada pelo ONS," : "";
  const frases = [
    `${quando}, a geração ${DO_REGIAO[rg]}${perimetro} foi de ${num(total, 0)} MWmed em média.`,
    maiores.length ? `As maiores participações: ${listaTexto(maiores)}.` : "Nenhuma categoria com geração positiva no período.",
  ];
  const nat = mix.natureza_pct;
  if (per === "com" && nat.verificada !== null) {
    const partes = [`medição ${num(nat.verificada, 1)}%`];
    if (nat.grupo_tipo3 !== null) partes.push(`previsão do ONS para pequenas usinas Tipo III ${num(nat.grupo_tipo3, 1)}%`);
    if (nat.grupo_mmgd !== null) partes.push(`estimativa do ONS para a MMGD ${num(nat.grupo_mmgd, 1)}%`);
    frases.push(`Natureza da energia: ${listaTexto(partes)}.`);
  }
  if (per === "sem" && mix.participacao.solar_mmgd !== null) {
    frases.push(`A MMGD estimada, fora deste perímetro, foi ${num(mix.participacao.solar_mmgd, 1)}% do total com ela.`);
  }
  const ress = CATEGORIAS.filter((c) => mix.ressalvas_universo[c] && !(per === "sem" && c === "solar_mmgd"));
  if (ress.length) {
    frases.push(
      `${inicial(listaTexto(ress.map((c) => FRASE_CATEGORIA[c])))} ${ress.length === 1 ? "tem" : "têm"} ressalva de universo: a fonte publicou menos usinas com dado no período, e a participação não se compara com a de antes.`,
    );
  }
  return frases.join(" ");
}

/** Categorias com ressalva na janela, com o texto de cada uma (lista visível junto da participação). */
export function ressalvasDaJanela(mix: Mix | null, nomes: Record<CategoriaGeracao, string>): { id: CategoriaGeracao; nome: string; texto: string }[] {
  if (!mix) return [];
  return CATEGORIAS.filter((c) => mix.ressalvas_universo[c]).map((c) => ({ id: c, nome: nomes[c], texto: textoRessalva(mix.ressalvas_universo[c])! }));
}

/** Minúscula só nas palavras apenas capitalizadas: "Previsão do ONS (grupos Tipo III)" vira "previsão do ONS (grupos tipo III)"; a sigla fica como está. */
export function minusculaPalavras(s: string): string {
  return s.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => (/^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]+$/.test(w) ? w.toLowerCase() : w));
}

/** Natureza da energia na janela (para o recorte do painel). */
export function textoNatureza(nat: Record<NaturezaGeracao, number | null>): string {
  const partes = NATUREZAS.filter((n) => nat[n] !== null).map((n) => `${minusculaPalavras(CURTO_NATUREZA[n])} ${num(nat[n], 1)}%`);
  return partes.length ? listaTexto(partes) : "sem natureza publicada";
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
export function linhasMensalMatriz(ms: MensalSin, per: Perimetro): { linhas: LinhaMesMatriz[]; series: CategoriaGeracao[] } {
  const inicio = per === "com" ? primeiroMesComMmgd(ms) : ms.meses[0];
  const linhas: LinhaMesMatriz[] = [];
  for (let i = 0; i < ms.meses.length; i++) {
    const m = ms.meses[i];
    if (!inicio || m < inicio) continue;
    const l: LinhaMesMatriz = {
      id: m,
      m,
      mes: mesAno(m),
      // o mês incompleto leva a marca no próprio eixo do gráfico, não só na nota
      rotulo: ms.parcial[i] ? `${mesAno(m)} (parcial)` : mesAno(m),
      total: per === "com" ? ms.total_mwmed[i] : ms.total_sem_mmgd_mwmed[i],
      parcial: ms.parcial[i] ? `parcial (${num(ms.dias_completos[i], 0)} de ${num(ms.dias_no_mes[i], 0)} dias)` : "não",
      dias: ms.dias_completos[i],
      ressalvas: CATEGORIAS.filter((c) => (ms.ressalvas_universo[c] ?? []).includes(m))
        .map((c) => CURTO_CATEGORIA[c])
        .join(", "),
    };
    for (const c of CATEGORIAS) if (!(per === "sem" && c === "solar_mmgd")) l[c] = ms[c][i];
    linhas.push(l);
  }
  const series = CATEGORIAS.filter((c) => !(per === "sem" && c === "solar_mmgd") && linhas.some((l) => l[c] !== null && l[c] !== undefined));
  return { linhas, series };
}

export function colunasMensalMatriz(series: readonly CategoriaGeracao[]): ColunaTabela[] {
  return [
    { id: "mes", rotulo: "Mês", tipo: "texto" },
    ...series.map((c): ColunaTabela => ({ id: c, rotulo: CURTO_CATEGORIA[c], tipo: "numero", unidade: "MWmed", casas: 1 })),
    { id: "total", rotulo: "Total", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "parcial", rotulo: "Mês parcial", tipo: "texto" },
    { id: "ressalvas", rotulo: "Categorias com ressalva de universo", tipo: "texto" },
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
export function marcosMensais(quebras: readonly Quebra[], meses: readonly string[]): { x: string; rotulo: string }[] {
  const out: { x: string; rotulo: string }[] = [];
  const tem = new Set(meses);
  const add = (x: string, rotulo: string) => {
    if (tem.has(x) && !out.some((o) => o.x === x)) out.push({ x, rotulo });
  };
  for (const q of quebras.filter((x) => x.origem === "FONTE")) add(q.data.slice(0, 7), `${mesAno(q.data.slice(0, 7))}: ${q.tipo === "rotulo_novo" ? "grupos novos na fonte" : "mudança declarada pela fonte"}`);
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

export function colunasRecentes(cats: readonly CategoriaGeracao[], rotuloX: string, tipoX: "data" | "texto"): ColunaTabela[] {
  return [{ id: "x", rotulo: rotuloX, tipo: tipoX }, ...cats.map((c): ColunaTabela => ({ id: c, rotulo: CURTO_CATEGORIA[c], tipo: "numero", unidade: "MWmed", casas: 1 }))];
}

/* ---------- natureza mensal ---------- */

export function linhasNaturezaMensal(n: NaturezaMensal): { id: string; m: string; mes: string; verificada: number | null; grupo_tipo3: number | null; grupo_mmgd: number | null }[] {
  return n.meses.map((m, i) => ({ id: m, m, mes: mesAno(m), verificada: n.verificada[i], grupo_tipo3: n.grupo_tipo3[i], grupo_mmgd: n.grupo_mmgd[i] }));
}

export const COLUNAS_NATUREZA_MENSAL: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "verificada", rotulo: CURTO_NATUREZA.verificada, tipo: "percentual", casas: 2 },
  { id: "grupo_tipo3", rotulo: CURTO_NATUREZA.grupo_tipo3, tipo: "percentual", casas: 2 },
  { id: "grupo_mmgd", rotulo: CURTO_NATUREZA.grupo_mmgd, tipo: "percentual", casas: 2 },
];

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
export function linhasDozeMeses(c: ComparacaoDozeMeses, atual: Mix | null, universo?: Pick<Matriz["universo"], "lacuna_ultimo_mes">): LinhaDozeMeses[] {
  if (!atual || atual.inicio !== c.atual.inicio || atual.fim !== c.atual.fim) return [];
  const lacuna = universo?.lacuna_ultimo_mes?.detalhe_por_categoria;
  return CATEGORIAS.filter((k) => atual.mwmed[k] !== null || c.anterior_mwmed[k] !== null).map((k) => {
    const sup = c.variacao_suprimida[k];
    const situacao = sup
      ? `variação suprimida: ${sup.motivo}`
      : c.variacao_pct[k] === null
        ? c.anterior_mwmed[k] === null
          ? "sem valor na janela anterior"
          : "sem variação publicada"
        : "comparável";
    return { id: k, rotulo: CURTO_CATEGORIA[k], atual: atual.mwmed[k], anterior: c.anterior_mwmed[k], variacao_pct: c.variacao_pct[k], situacao, lacuna_gwh: lacuna?.[k] ? gwh(lacuna[k]!.mwh_dos_ausentes_mesmo_mes_ano_anterior) : null };
  });
}

/**
 * Categorias que seguem comparáveis (sem variação suprimida) mas têm usinas sem dado no último mês, com a geração delas no mesmo mês
 * de um ano antes: a lacuna pequena não suprime a variação, e a página mostra o tamanho dela ao lado.
 */
export function lacunaDasComparaveis(c: Pick<ComparacaoDozeMeses, "variacao_pct" | "variacao_suprimida">, universo: Pick<Matriz["universo"], "lacuna_ultimo_mes">): { id: CategoriaGeracao; rotulo: string; gwh: number; mes: string; mesAnoAnterior: string }[] {
  const l = universo.lacuna_ultimo_mes;
  if (!l) return [];
  return CATEGORIAS.flatMap((k) => {
    const d = l.detalhe_por_categoria[k];
    const g = d ? gwh(d.mwh_dos_ausentes_mesmo_mes_ano_anterior) : null;
    return g !== null && g > 0 && c.variacao_pct[k] !== null && !c.variacao_suprimida[k] ? [{ id: k, rotulo: CURTO_CATEGORIA[k], gwh: g, mes: l.mes, mesAnoAnterior: l.mes_ano_anterior }] : [];
  }).sort((a, b) => b.gwh - a.gwh);
}

export function colunasDozeMeses(c: ComparacaoDozeMeses, universo?: Pick<Matriz["universo"], "lacuna_ultimo_mes">): ColunaTabela[] {
  const lac = universo?.lacuna_ultimo_mes;
  return [
    { id: "rotulo", rotulo: "Categoria", tipo: "texto" },
    { id: "atual", rotulo: `${dataBR(c.atual.inicio)} a ${dataBR(c.atual.fim)}`, tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "anterior", rotulo: `${dataBR(c.anterior.inicio)} a ${dataBR(c.anterior.fim)}`, tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "variacao_pct", rotulo: "Variação publicada", tipo: "percentual", casas: 1 },
    { id: "situacao", rotulo: "Situação", tipo: "texto" },
    ...(lac ? [{ id: "lacuna_gwh", rotulo: `Geração em ${mesAno(lac.mes_ano_anterior)} das usinas sem dado em ${mesAno(lac.mes)}`, tipo: "numero" as const, unidade: "GWh", casas: 1 }] : []),
  ];
}

export function textoDozeMeses(c: ComparacaoDozeMeses): string {
  const sup = CATEGORIAS.filter((k) => c.variacao_suprimida[k]);
  const base = `Total sem MMGD de ${dataBR(c.atual.inicio)} a ${dataBR(c.atual.fim)} contra os 365 dias anteriores: ${c.variacao_total_sem_mmgd_pct === null ? "sem variação publicada" : `${c.variacao_total_sem_mmgd_pct > 0 ? "+" : c.variacao_total_sem_mmgd_pct < 0 ? "−" : ""}${num(Math.abs(c.variacao_total_sem_mmgd_pct), 1)}%`}.`;
  const regime = c.mesmo_regime_mmgd ? " As duas janelas são posteriores a 29/04/2023, e a MMGD se compara com ela mesma." : " As janelas atravessam 29/04/2023: a MMGD não entra na comparação.";
  const s = sup.length
    ? ` ${inicial(listaTexto(sup.map((k) => FRASE_CATEGORIA[k])))}: variação suprimida: o número de usinas com dado na fonte mudou dentro das janelas comparadas.`
    : "";
  // com categorias suprimidas, o total das demais é o que se compara: o total completo muda também pelo cadastro de usinas da fonte
  const v = c.variacao_total_comparavel_pct;
  const cmp = sup.length && v !== null && v !== undefined ? ` Só com as demais categorias, o total varia ${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), 1)}%.` : "";
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
export function presencaMmgdNoAno(a: Pick<AnoSin, "dias" | "mmgd_dias">): string {
  if (a.mmgd_dias <= 0) return "sem estimativa no ano";
  if (a.mmgd_dias < a.dias) return `parcial: estimativa em ${num(a.mmgd_dias, 0)} de ${num(a.dias, 0)} dias`;
  return "estimativa em todos os dias";
}

export type LinhaAnual = { id: string; ano: string; dias: number; parcial: string; total_sem_mmgd_mwmed: number | null; mmgd_dias: number; presenca_mmgd: string; mmgd_mwmed: number | null; mmgd_nos_dias_mwmed: number | null; verificada_pct: number | null } & Partial<Record<CategoriaGeracao, number | null>>;

export function linhasAnuais(anos: readonly AnoSin[]): LinhaAnual[] {
  return anos.map((a) => {
    const l: LinhaAnual = {
      id: String(a.ano),
      ano: String(a.ano),
      dias: a.dias,
      parcial: a.parcial ? "sim, ano em curso" : "não",
      total_sem_mmgd_mwmed: a.total_sem_mmgd_mwmed,
      mmgd_dias: a.mmgd_dias,
      presenca_mmgd: presencaMmgdNoAno(a),
      mmgd_mwmed: a.mwmed.solar_mmgd,
      mmgd_nos_dias_mwmed: mmgdNosDiasComEstimativa(a),
      verificada_pct: a.natureza_pct.verificada,
    };
    for (const c of CATEGORIAS) if (c !== "solar_mmgd") l[c] = a.participacao_sem_mmgd[c];
    return l;
  });
}

export function colunasAnuais(anos: readonly AnoSin[]): ColunaTabela[] {
  const cats = CATEGORIAS.filter((c) => c !== "solar_mmgd" && anos.some((a) => a.participacao_sem_mmgd[c] !== null));
  return [
    { id: "ano", rotulo: "Ano", tipo: "texto" },
    { id: "dias", rotulo: "Dias completos", tipo: "numero", casas: 0 },
    { id: "parcial", rotulo: "Ano em curso (parcial)", tipo: "texto" },
    { id: "total_sem_mmgd_mwmed", rotulo: "Total sem MMGD", tipo: "numero", unidade: "MWmed", casas: 1 },
    ...cats.map((c): ColunaTabela => ({ id: c, rotulo: `${CURTO_CATEGORIA[c]} (sem MMGD)`, tipo: "percentual", casas: 2 })),
    { id: "mmgd_dias", rotulo: "Dias com estimativa de MMGD", tipo: "numero", casas: 0 },
    { id: "presenca_mmgd", rotulo: "Presença da MMGD estimada no ano", tipo: "texto" },
    { id: "mmgd_mwmed", rotulo: "MMGD estimada, contribuição à média anual", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "mmgd_nos_dias_mwmed", rotulo: "MMGD estimada, média dos dias com estimativa", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "verificada_pct", rotulo: "Parcela de medição no total com MMGD", tipo: "percentual", casas: 2 },
  ];
}

/**
 * Nota da tabela anual, montada dos dados: o ano em que a MMGD entra pela metade, as duas médias da MMGD (ano inteiro e dias com
 * estimativa) e o denominador da parcela de medição, que passa a incluir a MMGD no mesmo ano.
 */
export function notaAnual(anos: readonly AnoSin[], primeiroDiaMmgd: string | null): string {
  const parcial = anos.find((a) => a.mmgd_dias > 0 && a.mmgd_dias < a.dias);
  const desde = primeiroDiaMmgd ? dataBR(primeiroDiaMmgd) : "data não informada";
  const entrada = parcial ? ` (em ${parcial.ano}, ${num(parcial.mmgd_dias, 0)} dos ${num(parcial.dias, 0)} dias)` : "";
  return [
    "O ano em curso é parcial e não se compara com anos completos sem esse aviso.",
    `A estimativa da MMGD só existe a partir de ${desde}${entrada}: ela não entra na participação por categoria desta tabela, que é sem MMGD, e aparece em MWmed.`,
    `A contribuição à média anual divide a energia da MMGD pelas horas do ano inteiro${parcial ? ` (em ${parcial.ano} vale ${num(parcial.mmgd_dias, 0)}/${num(parcial.dias, 0)} da média dos dias com estimativa)` : ""}; a média dos dias com estimativa divide só pelas horas dos dias em que a estimativa existe (média anual vezes os dias do ano, dividida pelos dias com estimativa).`,
    `A parcela de medição usa o total com a MMGD desde a entrada dela; antes, o total não a inclui, e a queda entre esses anos inclui a entrada da MMGD no total, não só mudança na medição.`,
  ].join(" ");
}

/* ---------- A11 ---------- */

export function linhasA11(a: Pick<A11, "tabela">) {
  return a.tabela.map((l) => ({ id: l.d, ...l }));
}

export const COLUNAS_A11: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "balanco_solar_mwmed", rotulo: "Solar no Balanço", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "usinas_solar_mwmed", rotulo: "Soma das usinas fotovoltaicas", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "usinas_mmgd_mwmed", rotulo: "Grupos MMGD", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "usinas_sem_mmgd_mwmed", rotulo: "Usinas sem MMGD", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "diferenca_mwh", rotulo: "Balanço menos usinas", tipo: "numero", unidade: "MWh", casas: 3 },
];

export function linhasMmgdApi(a: Pick<A11, "comparacao_api_transicao">) {
  return a.comparacao_api_transicao.map((l) => ({ id: l.mes, m: l.mes, mes: mesAno(l.mes), usina_mwmed: l.usina_mwmed, api_mwmed: l.api_mwmed, razao_usina_api: l.razao_usina_api }));
}

export const COLUNAS_MMGD_API: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "usina_mwmed", rotulo: "MMGD na Geração por Usina", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "api_mwmed", rotulo: "MMGD na carga verificada (API)", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "razao_usina_api", rotulo: "Razão entre as duas", tipo: "numero", casas: 3 },
];

/** Resumo do achado A11 lido da gold (dias conciliados, primeira hora, documentos). */
export function textoA11(a: A11): string {
  if (a.estado !== "confirmado") return `Verificação da quebra de 29/04/2023 pendente: ${a.conclusao ?? "sem conclusão publicada"}.`;
  const prim = a.primeira_hora_mmgd ? horaLocal(a.primeira_hora_mmgd) : a.primeiro_dia_mmgd ? dataBR(a.primeiro_dia_mmgd) : "sem data";
  return `A MMGD estimada pelo ONS aparece na Geração por Usina a partir de ${prim}. ${a.janela_da_quebra_conciliada ? "Na janela da quebra, a solar do Balanço é igual à soma das usinas fotovoltaicas com a MMGD dia a dia." : "Na janela da quebra, a solar do Balanço não fecha com a soma das usinas."} Em todo o histórico, ${num(a.dias_conciliados, 0)} de ${num(a.dias_conferidos, 0)} dias conciliam dentro da tolerância.`;
}

/* ---------- auditoria da matriz ---------- */

export function linhasReconciliacaoFonte(r: Matriz["reconciliacao_balanco"]) {
  return (Object.keys(r.por_fonte) as (keyof typeof r.por_fonte)[]).map((f) => ({ id: f, fonte: NOME_FONTE_BALANCO[f], ...r.por_fonte[f] }));
}

export const NOME_FONTE_BALANCO: Record<string, string> = { hidraulica: "Hidráulica", termica: "Térmica (inclui nuclear)", eolica: "Eólica", solar: "Solar" };

export const COLUNAS_RECONCILIACAO_FONTE: ColunaTabela[] = [
  { id: "fonte", rotulo: "Fonte do Balanço", tipo: "texto" },
  { id: "sin_dias", rotulo: "Dias no SIN", tipo: "numero", casas: 0 },
  { id: "sin_dias_conciliados", rotulo: "Dias conciliados no SIN", tipo: "numero", casas: 0 },
  { id: "pct_sin_dias_conciliados", rotulo: "Dias conciliados no SIN", tipo: "percentual", casas: 2 },
  { id: "subsistema_dias", rotulo: "Subsistema-dias", tipo: "numero", casas: 0 },
  { id: "conciliados", rotulo: "Subsistema-dias conciliados", tipo: "numero", casas: 0 },
  { id: "soma_diferencas_mwh", rotulo: "Soma das diferenças", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "soma_balanco_mwh", rotulo: "Energia no Balanço", tipo: "numero", unidade: "MWh", casas: 1 },
];

export function linhasDivergencias(r: Matriz["reconciliacao_balanco"]) {
  return r.maiores_divergencias.map((d) => ({ id: `${d.d}:${d.fonte}:${d.sm}`, d: d.d, fonte: NOME_FONTE_BALANCO[d.fonte], sm: NOME_REGIAO[d.sm], balanco_mwh: d.balanco_mwh, usinas_mwh: d.usinas_mwh, diferenca_mwh: d.diferenca_mwh }));
}

export const COLUNAS_DIVERGENCIAS: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "fonte", rotulo: "Fonte", tipo: "texto", categorica: true },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "balanco_mwh", rotulo: "Balanço", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "usinas_mwh", rotulo: "Soma das usinas", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "diferenca_mwh", rotulo: "Balanço menos usinas", tipo: "numero", unidade: "MWh", casas: 1 },
];

export function linhasReconciliacaoMensal(r: Matriz["reconciliacao_balanco"]) {
  return r.mensal_ultimos_6.map((x) => ({ ...x, id: `${x.mes}:${x.fonte}`, mes: mesAno(x.mes), m: x.mes, fonte: NOME_FONTE_BALANCO[x.fonte] }));
}

export const COLUNAS_RECONCILIACAO_MENSAL: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto", categorica: true },
  { id: "fonte", rotulo: "Fonte", tipo: "texto", categorica: true },
  { id: "balanco_mwh", rotulo: "Balanço", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "usinas_mwh", rotulo: "Soma das usinas", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "roraima_excluida_mwh", rotulo: "Térmica de Roraima fora do Balanço", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "diferenca_sem_roraima_mwh", rotulo: "Diferença sem Roraima", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "diferenca_pct", rotulo: "Diferença relativa", tipo: "percentual", casas: 3 },
  { id: "subsistema_dias_conciliados", rotulo: "Subsistema-dias conciliados", tipo: "numero", casas: 0 },
  { id: "subsistema_dias", rotulo: "Subsistema-dias", tipo: "numero", casas: 0 },
];

export function linhasRotulos(rotulos: readonly RotuloFonte[]) {
  return rotulos.map((r, i) => ({
    id: `${i}`,
    tipo: r.tipo,
    combustivel: r.combustivel,
    modalidade: r.modalidade,
    categoria: CURTO_CATEGORIA[r.categoria],
    natureza: CURTO_NATUREZA[r.natureza],
    gwh_12m: gwh(r.mwh_12m),
    gwh_desde_inicio: gwh(r.mwh_desde_inicio),
  }));
}

export const COLUNAS_ROTULOS: ColunaTabela[] = [
  { id: "tipo", rotulo: "Tipo (ONS)", tipo: "texto", categorica: true },
  { id: "combustivel", rotulo: "Combustível (ONS)", tipo: "texto" },
  { id: "modalidade", rotulo: "Modalidade (ONS)", tipo: "texto", categorica: true },
  { id: "categoria", rotulo: "Categoria do painel", tipo: "texto", categorica: true },
  { id: "natureza", rotulo: "Natureza", tipo: "texto", categorica: true },
  { id: "gwh_12m", rotulo: "Energia em 12 meses", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "gwh_desde_inicio", rotulo: "Energia desde 2021", tipo: "numero", unidade: "GWh", casas: 1 },
];

export function linhasOutrosPorCeg(o: Matriz["outros_por_ceg"]) {
  return (o?.itens ?? []).map((x, i) => ({ id: `${x.codigo_ceg ?? "sem"}:${i}`, codigo: x.codigo_ceg ?? "sem CEG (conjuntos)", fonte_aneel: x.fonte_aneel, mwmed: x.mwmed, pct: x.pct_da_categoria, identificadores: x.identificadores, maiores: x.maiores.join(", ") }));
}

export const COLUNAS_OUTROS_CEG: ColunaTabela[] = [
  { id: "codigo", rotulo: "Código de combustível no CEG", tipo: "texto" },
  { id: "fonte_aneel", rotulo: "Fonte na classificação da ANEEL", tipo: "texto" },
  { id: "mwmed", rotulo: "Geração média", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "pct", rotulo: "Parcela de outras térmicas", tipo: "percentual", casas: 2 },
  { id: "identificadores", rotulo: "Identificadores", tipo: "numero", casas: 0 },
  { id: "maiores", rotulo: "Maiores", tipo: "texto" },
];

export function linhasLacuna(u: Matriz["universo"]) {
  const l = u.lacuna_ultimo_mes;
  if (!l) return [];
  return CATEGORIAS.filter((c) => l.detalhe_por_categoria[c]).map((c) => {
    const d = l.detalhe_por_categoria[c]!;
    return { id: c, categoria: CURTO_CATEGORIA[c], com_valor_no_mes: d.com_valor_no_mes, com_valor_ano_anterior: d.com_valor_mesmo_mes_ano_anterior, sem_valor: d.sem_valor, sem_linhas: d.sem_linhas, gwh_ausentes_ano_anterior: gwh(d.mwh_dos_ausentes_mesmo_mes_ano_anterior) };
  });
}

export function colunasLacuna(u: Matriz["universo"]): ColunaTabela[] {
  const l = u.lacuna_ultimo_mes;
  const mes = l ? mesAno(l.mes) : "último mês";
  const ant = l ? mesAno(l.mes_ano_anterior) : "um ano antes";
  return [
    { id: "categoria", rotulo: "Categoria", tipo: "texto" },
    { id: "com_valor_no_mes", rotulo: `Usinas com dado em ${mes}`, tipo: "numero", casas: 0 },
    { id: "com_valor_ano_anterior", rotulo: `Usinas com dado em ${ant}`, tipo: "numero", casas: 0 },
    { id: "sem_valor", rotulo: `Com linhas vazias em ${mes}`, tipo: "numero", casas: 0 },
    { id: "sem_linhas", rotulo: `Sem linhas em ${mes}`, tipo: "numero", casas: 0 },
    { id: "gwh_ausentes_ano_anterior", rotulo: `Geração publicada para os mesmos ausentes em ${ant}`, tipo: "numero", unidade: "GWh", casas: 1 },
  ];
}

export const ROTULO_QUEBRA: Record<string, string> = {
  rotulo_novo: "Rótulo novo na fonte",
  rotulo_encerrado: "Rótulo some do arquivo",
  rotulo_sem_valor: "Rótulo só com linhas vazias",
  sequencia_zero: "Sequência de zero exato",
  roraima: "Roraima no Balanço",
  identificadores_sem_valor: "Identificadores sem valor",
  salto_de_universo: "Salto no número de usinas",
};

export function linhasQuebras(q: readonly Quebra[]) {
  return q.map((x, i) => ({
    id: `${x.data}:${i}`,
    data: x.data,
    tipo: ROTULO_QUEBRA[x.tipo] ?? x.tipo,
    origem: x.origem === "FONTE" ? "declarada pela fonte" : "detectada no dado",
    categorias: x.categorias.map((c) => CURTO_CATEGORIA[c as CategoriaGeracao] ?? c).join(", "),
    descricao: x.descricao,
  }));
}

export const COLUNAS_QUEBRAS: ColunaTabela[] = [
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "origem", rotulo: "Origem", tipo: "texto", categorica: true },
  { id: "categorias", rotulo: "Categorias", tipo: "texto" },
  { id: "descricao", rotulo: "Descrição", tipo: "texto" },
];

export function linhasControles(c: readonly ControleGeracao[]) {
  return c.map((x, i) => ({ id: `${i}`, nome: emPortugues(x.nome), resultado: x.resultado, critico: x.critico ? "sim" : "não", detalhe: emPortugues(x.detalhe) }));
}

export const COLUNAS_CONTROLES: ColunaTabela[] = [
  { id: "nome", rotulo: "Controle", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto", categorica: true },
  { id: "critico", rotulo: "Crítico", tipo: "texto", categorica: true },
  { id: "detalhe", rotulo: "Detalhe", tipo: "texto" },
];

export function linhasFontes(f: readonly FontePublicada[]) {
  return f.map((x) => ({ id: x.id, orgao: x.orgao, conjunto: x.conjunto, arquivos: x.arquivos, primeiro: x.primeiro_periodo, ultimo: x.ultimo_periodo, captura: x.ultima_captura, publicacao: x.publicacao_mais_recente, licenca: x.licenca, url: x.url }));
}

export const COLUNAS_FONTES: ColunaTabela[] = [
  { id: "orgao", rotulo: "Órgão", tipo: "texto", categorica: true },
  { id: "conjunto", rotulo: "Conjunto", tipo: "texto" },
  { id: "arquivos", rotulo: "Arquivos integrados", tipo: "numero", casas: 0 },
  { id: "primeiro", rotulo: "Primeiro período", tipo: "texto" },
  { id: "ultimo", rotulo: "Último período", tipo: "texto" },
  { id: "captura", rotulo: "Última captura (UTC)", tipo: "texto" },
  { id: "publicacao", rotulo: "Publicação mais recente na fonte (UTC)", tipo: "texto" },
  { id: "licenca", rotulo: "Licença", tipo: "texto" },
  { id: "url", rotulo: "Endereço", tipo: "texto" },
];

/** Regras publicadas na gold, com rótulo legível. */
export const ROTULO_REGRA: Record<string, string> = {
  matriz: "Categorias e MWmed",
  participacao: "Participação",
  comparacao: "Comparações e a quebra de 2023",
  termica: "Motivos de despacho",
  restricao: "Energia não gerada, taxa e potência cortada",
  capacidade: "Fator de capacidade",
  janelas: "Janelas",
};

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

export const CURTO_MOTIVO: Record<MotivoDespacho, string> = {
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
};

export const COR_MOTIVO: Record<MotivoDespacho, string> = {
  inflexibilidade: "var(--serie-sm-se)",
  merito: "var(--cor-energia)",
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

export const CURTO_COMBUSTIVEL: Record<CategoriaCombustivel, string> = {
  gas: "Gás natural",
  nuclear: "Nuclear",
  carvao: "Carvão mineral",
  outros: "Outras térmicas",
  biomassa: "Biomassa",
  oleo: "Óleo e diesel",
  termica_sem_combustivel: "Térmicas Tipo III",
  nao_mapeada: "Sem combustível identificado",
};

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
export function explicacaoDoMotivo(motivos: readonly { id: MotivoDespacho; rotulo: string }[], id: MotivoDespacho): string | null {
  const m = motivos.find((x) => x.id === id);
  return m ? (/\(([^()]+)\)\s*$/.exec(m.rotulo)?.[1] ?? null) : null;
}

/** Motivo pelo rótulo da gold (texto completo). */
export function nomesMotivos(t: Pick<Termica, "motivos">): Record<MotivoDespacho, string> {
  const out = { ...CURTO_MOTIVO };
  for (const m of t.motivos) out[m.id] = m.rotulo;
  return out;
}

/**
 * Resposta curta do P022: energia média dos 12 meses, motivos e combustíveis com maior
 * parcela (lidos da partição publicada) e o aviso de que o motivo é a classificação do ONS.
 */
export function respostaTermica(t: Pick<Termica, "ultimos_12m">): string {
  const u = t.ultimos_12m;
  const motivos = [...u.por_motivo].filter((m) => (m.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const comb = [...u.por_combustivel].filter((c) => (c.pct_total ?? 0) > 0).sort((a, b) => (b.pct_total ?? 0) - (a.pct_total ?? 0));
  const frases = [
    `De ${mesAno(u.inicio)} a ${mesAno(u.fim)}, as térmicas despachadas pelo ONS geraram ${num(u.total_mwmed, 0)} MWmed em média (${num(gwh(u.total_mwh), 0)} GWh).`,
  ];
  if (motivos.length) frases.push(`Por motivo: ${listaTexto(motivos.slice(0, 3).map((m) => `${minusculaPalavras(CURTO_MOTIVO[m.motivo])} ${num(m.pct, 1)}%`))}.`);
  if (comb.length) frases.push(`Por combustível: ${listaTexto(comb.slice(0, 3).map((c) => `${minusculaPalavras(CURTO_COMBUSTIVEL[c.categoria])} ${num(c.pct_total, 1)}%`))}.`);
  if (u.nao_classificado_pct !== null) frases.push(`A diferença entre o total e a soma dos motivos (não classificada) é ${num(u.nao_classificado_pct, 3)}% da energia.`);
  frases.push("O motivo é a classificação publicada pelo ONS, não uma inferência a partir do preço.");
  return frases.join(" ");
}

export type LinhaCombustivelMotivo = { id: CategoriaCombustivel; combustivel: string; gwh: number | null; mwmed: number | null; pct_total: number | null; nao_classificado_gwh: number | null } & Partial<Record<MotivoDespacho, number | null>>;

/** Combustível × motivo dos 12 meses (GWh); a mesma matriz alimenta as barras empilhadas e a tabela. */
export function linhasCombustivelMotivo(t: Pick<Termica, "ultimos_12m">): { linhas: LinhaCombustivelMotivo[]; motivos: MotivoDespacho[] } {
  const linhas = t.ultimos_12m.por_combustivel.map((c) => {
    const l: LinhaCombustivelMotivo = { id: c.categoria, combustivel: CURTO_COMBUSTIVEL[c.categoria], gwh: gwh(c.mwh), mwmed: c.mwmed, pct_total: c.pct_total, nao_classificado_gwh: gwh(c.nao_classificado_mwh) };
    for (const m of MOTIVOS) l[m] = gwh(c.motivos_mwh[m]);
    return l;
  });
  const motivos = MOTIVOS.filter((m) => linhas.some((l) => (l[m] ?? 0) > 0));
  return { linhas, motivos };
}

export function colunasCombustivelMotivo(motivos: readonly MotivoDespacho[]): ColunaTabela[] {
  return [
    { id: "combustivel", rotulo: "Combustível", tipo: "texto" },
    { id: "gwh", rotulo: "Geração total", tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "mwmed", rotulo: "Geração média", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "pct_total", rotulo: "Parcela da geração térmica", tipo: "percentual", casas: 2 },
    ...motivos.map((m): ColunaTabela => ({ id: m, rotulo: CURTO_MOTIVO[m], tipo: "numero", unidade: "GWh", casas: 1 })),
    { id: "nao_classificado_gwh", rotulo: "Não classificado", tipo: "numero", unidade: "GWh", casas: 3 },
  ];
}

export function linhasMotivos12m(t: Pick<Termica, "ultimos_12m">, nomes: Record<MotivoDespacho, string>) {
  return t.ultimos_12m.por_motivo.map((m) => ({ id: m.motivo, curto: CURTO_MOTIVO[m.motivo], motivo: nomes[m.motivo], gwh: gwh(m.mwh), pct: m.pct }));
}

export const COLUNAS_MOTIVOS_12M: ColunaTabela[] = [
  { id: "motivo", rotulo: "Motivo de despacho (ONS)", tipo: "texto" },
  { id: "gwh", rotulo: "Geração", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "pct", rotulo: "Parcela da geração térmica", tipo: "percentual", casas: 2 },
];

export type JanelaTermica = "24m" | "tudo";
export const JANELAS_TERMICA: readonly JanelaTermica[] = ["24m", "tudo"];

export type LinhaTermicaMes = { id: string; m: string; mes: string; rotulo: string; total: number | null; nao_classificado: number | null; constrained_off: number | null; parcial: string } & Partial<Record<MotivoDespacho, number | null>>;

/** Série mensal do SIN por motivo (MWmed); "24m" corta nos 24 meses mais recentes publicados. */
export function linhasTermicaMensal(t: Pick<Termica, "mensal_sin">, janela: JanelaTermica): { linhas: LinhaTermicaMes[]; motivos: MotivoDespacho[] } {
  const ms = t.mensal_sin;
  const ini = janela === "24m" ? Math.max(0, ms.meses.length - 24) : 0;
  const linhas: LinhaTermicaMes[] = [];
  for (let i = ini; i < ms.meses.length; i++) {
    const l: LinhaTermicaMes = {
      id: ms.meses[i],
      m: ms.meses[i],
      mes: mesAno(ms.meses[i]),
      rotulo: ms.parcial[i] ? `${mesAno(ms.meses[i])} (parcial)` : mesAno(ms.meses[i]),
      total: ms.total_mwmed[i],
      nao_classificado: ms.nao_classificado_mwmed[i],
      constrained_off: ms.constrained_off_mwmed[i],
      parcial: ms.parcial[i] ? "sim" : "não",
    };
    for (const m of MOTIVOS) l[m] = ms[m][i];
    linhas.push(l);
  }
  const motivos = MOTIVOS.filter((m) => linhas.some((l) => (l[m] ?? 0) > 0));
  return { linhas, motivos };
}

export function colunasTermicaMensal(motivos: readonly MotivoDespacho[]): ColunaTabela[] {
  return [
    { id: "mes", rotulo: "Mês", tipo: "texto" },
    ...motivos.map((m): ColunaTabela => ({ id: m, rotulo: CURTO_MOTIVO[m], tipo: "numero", unidade: "MWmed", casas: 1 })),
    { id: "nao_classificado", rotulo: "Não classificado", tipo: "numero", unidade: "MWmed", casas: 2 },
    { id: "total", rotulo: "Total verificado", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "constrained_off", rotulo: "Constrained-off térmico (à parte)", tipo: "numero", unidade: "MWmed", casas: 1 },
    { id: "parcial", rotulo: "Mês parcial", tipo: "texto" },
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
export function motivoPrincipal(u: Pick<TermicaUsina, "motivos_pct">): string {
  const e = (Object.entries(u.motivos_pct) as [MotivoDespacho, number][]).sort((a, b) => b[1] - a[1])[0];
  return e ? `${CURTO_MOTIVO[e[0]]} (${num(e[1], 1)}%)` : "sem geração no período";
}

export const ROTULO_ORIGEM_COMBUSTIVEL: Record<string, string> = {
  termica_por_motivo: "campo da própria térmica por motivo",
  geracao_por_usina: "mesmo CEG na Geração por Usina",
  capacidade_instalada: "mesmo CEG na Capacidade Instalada",
  geracao_por_usina_ceg_base: "CEG sem versão na Geração por Usina",
  capacidade_instalada_ceg_base: "CEG sem versão na Capacidade Instalada",
  mesma_usina: "outra chave da mesma usina",
  nao_identificado: "não identificado",
};

export function linhasUsinasTermicas(t: Pick<Termica, "usinas_12m">) {
  return t.usinas_12m.map((u) => ({
    id: u.id,
    nome: u.nome ?? u.id,
    combustivel: CURTO_COMBUSTIVEL[u.categoria],
    sm: u.sm ? (NOME_REGIAO[u.sm as Submercado] ?? u.sm) : null,
    gwh: gwh(u.mwh),
    mwmed: u.mwmed,
    motivo_principal: motivoPrincipal(u),
    inflexibilidade_pct: u.motivos_pct.inflexibilidade ?? (u.mwh ? 0 : null),
    merito_pct: u.motivos_pct.merito ?? (u.mwh ? 0 : null),
    cvu: u.cvu_semana_vigente,
    parcelas: u.parcelas.length + u.parcelas_omitidas,
    origem_combustivel: ROTULO_ORIGEM_COMBUSTIVEL[u.origem_combustivel] ?? u.origem_combustivel,
    chaves: u.chaves_na_fonte.join(", "),
  }));
}

export const COLUNAS_USINAS_TERMICAS: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "combustivel", rotulo: "Combustível", tipo: "texto", categorica: true },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "gwh", rotulo: "Geração em 12 meses", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "mwmed", rotulo: "Geração média", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "motivo_principal", rotulo: "Motivo com maior parcela", tipo: "texto" },
  { id: "inflexibilidade_pct", rotulo: "Inflexibilidade", tipo: "percentual", casas: 1 },
  { id: "merito_pct", rotulo: "Ordem de mérito", tipo: "percentual", casas: 1 },
  { id: "cvu", rotulo: "CVU da semana vigente (parcela única)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "parcelas", rotulo: "Parcelas no ONS", tipo: "numero", casas: 0 },
  { id: "origem_combustivel", rotulo: "Origem do combustível", tipo: "texto", categorica: true },
  { id: "chaves", rotulo: "Chaves na fonte (CEG)", tipo: "texto", buscavel: true },
];

/** Usina pedida (id), se publicada; senão a de maior geração. */
export function usinaTermicaEscolhida(t: Pick<Termica, "usinas_12m">, pedido: string): TermicaUsina | null {
  return t.usinas_12m.find((u) => u.id === pedido) ?? t.usinas_12m[0] ?? null;
}

/**
 * Motivos (% da geração de cada usina) de até quatro usinas, uma coluna por usina: a mesma
 * linha alimenta as barras agrupadas e a tabela. Motivo sem geração na usina é zero
 * (a gold só publica os motivos com geração; a usina gerou no período).
 */
export function linhasMotivosUsinas(usinas: readonly TermicaUsina[]): { id: MotivoDespacho; motivo: string; [usina: string]: number | null | string }[] {
  const motivos = MOTIVOS.filter((m) => usinas.some((u) => (u.motivos_pct[m] ?? 0) > 0));
  return motivos.map((m) => {
    const l: { id: MotivoDespacho; motivo: string; [usina: string]: number | null | string } = { id: m, motivo: CURTO_MOTIVO[m] };
    for (const u of usinas) l[u.id] = u.mwh ? (u.motivos_pct[m] ?? 0) : null;
    return l;
  });
}

export function linhasParcelas(u: TermicaUsina) {
  return u.parcelas.map((p) => ({ id: String(p.cod), cod: p.cod, nome: p.nome, gwh: gwh(p.mwh), cvu: p.cvu_semana_vigente }));
}

export const COLUNAS_PARCELAS: ColunaTabela[] = [
  { id: "cod", rotulo: "Código do ONS nos modelos", tipo: "numero", casas: 0, buscavel: true },
  { id: "nome", rotulo: "Nome da parcela", tipo: "texto" },
  { id: "gwh", rotulo: "Geração em 12 meses", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "cvu", rotulo: "CVU da semana vigente", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

/** CVU: quantis por combustível na semana vigente (custo declarado, não custo realizado). */
export function linhasCvuCombustivel(cvu: NonNullable<Termica["cvu"]>) {
  return cvu.por_combustivel.map((c) => ({ id: c.categoria, combustivel: CURTO_COMBUSTIVEL[c.categoria], n: c.n, min: c.min, p25: c.p25, p50: c.p50, p75: c.p75, max: c.max }));
}

export const COLUNAS_CVU_COMBUSTIVEL: ColunaTabela[] = [
  { id: "combustivel", rotulo: "Combustível", tipo: "texto" },
  { id: "n", rotulo: "Parcelas com CVU", tipo: "numero", casas: 0 },
  { id: "min", rotulo: "Mínimo", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p25", rotulo: "1º quartil", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p50", rotulo: "Mediana", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p75", rotulo: "3º quartil", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "max", rotulo: "Máximo", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

export function linhasCvuUsinas(cvu: NonNullable<Termica["cvu"]>) {
  return cvu.usinas.map((u) => ({ id: String(u.cod), cod: u.cod, nome: u.nome, sm: u.sm ? (NOME_REGIAO[u.sm as Submercado] ?? u.sm) : null, combustivel: CURTO_COMBUSTIVEL[u.categoria], cvu: u.cvu, usina: u.usina ?? "sem par na térmica por motivo" }));
}

export const COLUNAS_CVU_USINAS: ColunaTabela[] = [
  { id: "cod", rotulo: "Código do ONS", tipo: "numero", casas: 0, buscavel: true },
  { id: "nome", rotulo: "Nome no CVU", tipo: "texto" },
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "combustivel", rotulo: "Combustível", tipo: "texto", categorica: true },
  { id: "cvu", rotulo: "CVU", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "usina", rotulo: "Usina na térmica por motivo", tipo: "texto" },
];

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

export function textoCvu(cvu: NonNullable<Termica["cvu"]>): string {
  const s = cvu.semana;
  return `Semana operativa de ${dataBR(s.inicio)} a ${dataBR(s.fim)}${s.estudo ? ` (${s.estudo}${s.revisao !== null ? `, revisão ${s.revisao}` : ""})` : ""}: ${num(cvu.cobertura.usinas_com_cvu, 0)} usinas com CVU, ${num(cvu.cobertura.pareadas_com_termica, 0)} pareadas com a térmica por motivo pelo código do ONS${cvu.cobertura.sem_par.length ? `; sem par: ${listaTexto(cvu.cobertura.sem_par)}` : ""}.`;
}

export function linhasUniversoTermica(t: Pick<Termica, "universo">) {
  return t.universo.mensal.map((x) => ({ ...x, id: x.mes, m: x.mes, mes: mesAno(x.mes) }));
}

export const COLUNAS_UNIVERSO_TERMICA: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "termica_por_motivo_mwh", rotulo: "Térmica por motivo", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "usinas_pareadas", rotulo: "Usinas pareadas", tipo: "numero", casas: 0 },
  { id: "usinas_sem_par", rotulo: "Usinas sem par", tipo: "numero", casas: 0 },
  { id: "pareadas_geracao_usina_mwh", rotulo: "As mesmas usinas na Geração por Usina", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "diferenca_pareadas_pct", rotulo: "Diferença entre os conjuntos", tipo: "percentual", casas: 2 },
  { id: "geracao_usina_tipo_i_iia_mwh", rotulo: "Térmicas Tipo I e II-A na Geração por Usina", tipo: "numero", unidade: "MWh", casas: 1 },
  { id: "cobertura_tipo_i_iia_pct", rotulo: "Cobertura", tipo: "percentual", casas: 2 },
];

/** O que o componente cliente do P022 recebe: a térmica sem as partes que só a auditoria usa. */
export type TermicaCliente = Omit<Termica, "cvu" | "universo" | "identidade" | "mapa_combustivel">;

/* ---------- contexto de 7 dias (Balanço, gold de operação) ---------- */

/** Participação térmica da semana e a posição no ano anterior, sem arredondar o percentil a inteiro. */
export function textoTermica7d(t: { participacao_7d: number | null; percentil: number | null; mediana_365d: number | null; p10_365d: number | null; p90_365d: number | null }): string {
  if (t.participacao_7d === null) return "Sem participação térmica de 7 dias nesta publicação.";
  const pos =
    t.percentil === null
      ? ""
      : t.p90_365d !== null && t.participacao_7d > t.p90_365d
        ? ", acima da faixa usual do ano anterior"
        : t.p10_365d !== null && t.participacao_7d < t.p10_365d
          ? ", abaixo da faixa usual do ano anterior"
          : ", dentro da faixa usual do ano anterior";
  return `No Balanço de Energia, as térmicas (com a nuclear) responderam por ${num(t.participacao_7d, 1)}% da geração nos últimos 7 dias${t.percentil !== null ? `, percentil ${num(t.percentil, 1)} das janelas de 7 dias do ano anterior` : ""}${pos}.`;
}

/* ====================================================================== */
/* P023: renováveis restringidas                                            */
/* ====================================================================== */

export type FonteRestricao = "eolica" | "solar";
export const FONTES_RESTRICAO: readonly FonteRestricao[] = ["eolica", "solar"];
export const NOME_FONTE_RESTRICAO: Record<FonteRestricao, string> = { eolica: "Eólicas", solar: "Fotovoltaicas" };
export const FRASE_FONTE_RESTRICAO: Record<FonteRestricao, string> = { eolica: "usinas eólicas", solar: "usinas fotovoltaicas" };

export const RAZOES: readonly RazaoRestricao[] = ["ENE", "CNF", "REL", "PAR", "SEM"];
export const CURTO_RAZAO: Record<RazaoRestricao, string> = {
  REL: "Elétrica (REL)",
  CNF: "Confiabilidade (CNF)",
  ENE: "Energética (ENE)",
  PAR: "Parecer de acesso (PAR)",
  SEM: "Sem razão informada",
};
export const FRASE_RAZAO: Record<RazaoRestricao, string> = {
  REL: "razão elétrica",
  CNF: "confiabilidade",
  ENE: "razão energética",
  PAR: "parecer de acesso",
  SEM: "sem razão informada",
};
export const COR_RAZAO: Record<RazaoRestricao, string> = {
  ENE: "var(--cor-energia)",
  CNF: "var(--serie-sm-se)",
  REL: "var(--serie-termica)",
  PAR: "var(--serie-solar)",
  SEM: "var(--serie-referencia)",
};
export const NOME_ORIGEM: Record<string, string> = { LOC: "Local", SIS: "Sistêmica", SEM: "Sem origem informada" };

/** "16/08/2026 às 10h30" a partir de "AAAA-MM-DDTHH:MM". */
export function instanteBR(ref: string | null): string {
  if (!ref) return "sem registro";
  return `${dataBR(ref)} às ${ref.slice(11, 13)}h${ref.slice(14, 16)}`;
}

/**
 * Resposta curta do P023 para a fonte escolhida: energia não gerada estimada, taxa e
 * denominador, razões oficiais, maior corte simultâneo (potência, não energia) e o que a
 * restrição não é.
 */
export function respostaRestricao(r: Pick<Restricao, "fonte" | "primeiro_mes" | "ultimos_12m">): string {
  const u = r.ultimos_12m;
  const nome = FRASE_FONTE_RESTRICAO[r.fonte];
  if (!u) return `Sem 12 meses completos de restrição publicados para ${nome}; a série começa em ${mesAno(r.primeiro_mes)}.`;
  const razoes = [...u.por_razao].filter((x) => (x.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const frases = [
    `De ${mesAno(u.inicio)} a ${mesAno(u.fim)}, a limitação da geração de ${nome} pelo ONS deixou de gerar ${num(gwh(u.energia_nao_gerada_mwh), 0)} GWh, estimados sobre a geração de referência do ONS: ${num(u.taxa_pct, 1)}% do que essas usinas teriam gerado (verificada mais não gerada).`,
  ];
  if (razoes.length) frases.push(`Por razão oficial: ${listaTexto(razoes.slice(0, 3).map((x) => `${FRASE_RAZAO[x.razao]} ${num(x.pct, 1)}%`))}.`);
  if (u.potencia_max_cortada_mw !== null) frases.push(`O maior corte simultâneo foi de ${num(u.potencia_max_cortada_mw, 1)} MW em ${instanteBR(u.quando_potencia_max)} (potência, não energia).`);
  frases.push(`${num(u.usinas_com_restricao, 0)} de ${num(u.usinas_no_universo, 0)} usinas e conjuntos do universo tiveram restrição.`);
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
export function linhasRestricaoMensal(r: Pick<Restricao, "mensal_sin">): { linhas: LinhaRestricaoMes[]; razoes: RazaoRestricao[] } {
  const ms = r.mensal_sin;
  const linhas = ms.meses.map((m, i) => {
    const l: LinhaRestricaoMes = {
      id: m,
      m,
      mes: mesAno(m),
      total_gwh: gwh(ms.energia_nao_gerada_total_mwh[i]),
      verificada_gwh: gwh(ms.geracao_verificada_mwh[i]),
      taxa_pct: ms.taxa_pct[i],
      potencia_mw: ms.potencia_max_cortada_mw[i],
      usinas: ms.usinas[i],
      meias_horas: ms.meias_horas_limitadas[i],
      parcial: ms.parcial[i] ? "sim" : "não",
    };
    for (const z of RAZOES) l[z] = gwh(ms.energia_nao_gerada_mwh[z]?.[i]);
    return l;
  });
  const razoes = RAZOES.filter((z) => linhas.some((l) => (l[z] ?? 0) > 0));
  return { linhas, razoes };
}

export function colunasRestricaoMensal(razoes: readonly RazaoRestricao[]): ColunaTabela[] {
  return [
    { id: "mes", rotulo: "Mês", tipo: "texto" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: `Não gerada, ${CURTO_RAZAO[z]}`, tipo: "numero", unidade: "GWh", casas: 2 })),
    { id: "total_gwh", rotulo: "Não gerada, total", tipo: "numero", unidade: "GWh", casas: 2 },
    { id: "verificada_gwh", rotulo: "Geração verificada", tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "taxa_pct", rotulo: "Taxa de restrição", tipo: "percentual", casas: 2 },
    { id: "potencia_mw", rotulo: "Maior corte simultâneo", tipo: "numero", unidade: "MW", casas: 1 },
    { id: "usinas", rotulo: "Usinas e conjuntos", tipo: "numero", casas: 0 },
    { id: "meias_horas", rotulo: "Meias horas limitadas", tipo: "numero", casas: 0 },
    { id: "parcial", rotulo: "Mês parcial", tipo: "texto" },
  ];
}

export function linhasRazoes12m(r: Pick<Restricao, "ultimos_12m">) {
  return (r.ultimos_12m?.por_razao ?? []).map((x) => ({
    id: x.razao,
    razao: CURTO_RAZAO[x.razao],
    // total zero: não há limitação a classificar por origem, e as duas origens ficam sem valor por isso (a soma das origens é o total)
    rotulo_oficial: x.mwh === 0 ? `${x.rotulo}. Nenhuma energia não gerada com esta razão nos 12 meses; sem limitação, as origens ficam sem valor.` : x.rotulo,
    gwh: gwh(x.mwh),
    pct: x.pct,
    LOC: gwh(x.origens_mwh.LOC),
    SIS: gwh(x.origens_mwh.SIS),
  }));
}

export const COLUNAS_RAZOES_12M: ColunaTabela[] = [
  { id: "razao", rotulo: "Razão (código do ONS)", tipo: "texto" },
  { id: "rotulo_oficial", rotulo: "Descrição", tipo: "texto" },
  { id: "LOC", rotulo: "Origem local", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "SIS", rotulo: "Origem sistêmica", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "gwh", rotulo: "Total", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "pct", rotulo: "Parcela da energia não gerada", tipo: "percentual", casas: 2 },
];

export function linhasSubsistemas12m(r: Pick<Restricao, "ultimos_12m">) {
  return (r.ultimos_12m?.por_subsistema ?? []).map((x) => ({ id: x.sm, sm: NOME_REGIAO[x.sm], nao_gerada_gwh: gwh(x.energia_nao_gerada_mwh), verificada_gwh: gwh(x.geracao_verificada_mwh), taxa_pct: x.taxa_pct }));
}

export const COLUNAS_SUBSISTEMAS_12M: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto" },
  { id: "nao_gerada_gwh", rotulo: "Energia não gerada", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "verificada_gwh", rotulo: "Geração verificada", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "taxa_pct", rotulo: "Taxa de restrição", tipo: "percentual", casas: 2 },
];

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

export const ROTULO_COORDENADA: Record<string, string> = { subestacao_coletora: "subestação coletora", ponto_de_conexao: "ponto de conexão" };

export function linhasUsinasRestricao(r: Pick<Restricao, "usinas_12m">): LinhaUsinaRestricao[] {
  return r.usinas_12m.map((u) => ({
    id: u.id,
    nome: u.nome ?? u.id,
    sm: u.sm ? (NOME_REGIAO[u.sm as Submercado] ?? u.sm) : null,
    uf: u.uf,
    nao_gerada_gwh: gwh(u.energia_nao_gerada_mwh),
    verificada_gwh: gwh(u.geracao_verificada_mwh),
    taxa_pct: u.taxa_pct,
    razao_principal: CURTO_RAZAO[u.razao_principal],
    coordenada: u.origem_coordenada ? ROTULO_COORDENADA[u.origem_coordenada] : "sem coordenada",
  }));
}

export const COLUNAS_USINAS_RESTRICAO: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina ou conjunto", tipo: "texto" },
  // o identificador do ONS (CJU_..., ceg:...) é a chave da linha e do arquivo por usina e mês; a tabela do leitor mostra o nome
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "nao_gerada_gwh", rotulo: "Energia não gerada em 12 meses", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "verificada_gwh", rotulo: "Geração verificada em 12 meses", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "taxa_pct", rotulo: "Taxa de restrição", tipo: "percentual", casas: 2 },
  { id: "razao_principal", rotulo: "Razão com mais energia", tipo: "texto", categorica: true },
  { id: "coordenada", rotulo: "Origem da coordenada", tipo: "texto", categorica: true },
];

/** Usina pedida, se publicada; null quando não há pedido válido. */
export function usinaRestricaoEscolhida(r: Pick<Restricao, "usinas_12m">, pedido: string): RestricaoUsina | null {
  return pedido ? (r.usinas_12m.find((u) => u.id === pedido) ?? null) : null;
}

/** Mesma comparação de até quatro usinas: energia não gerada, verificada e taxa dos 12 meses (gold). */
export function linhasComparacaoUsinas(r: Pick<Restricao, "usinas_12m">, ids: readonly string[]): LinhaUsinaRestricao[] {
  const todas = linhasUsinasRestricao(r);
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
export function classesTamanho(usinas: readonly Pick<RestricaoUsina, "energia_nao_gerada_mwh">[]): { cortes: [number, number]; rotulos: [string, string, string] } {
  const v = usinas.map((u) => u.energia_nao_gerada_mwh).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const q = (p: number) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);
  const c1 = q(1 / 3);
  const c2 = q(2 / 3);
  return {
    cortes: [c1, c2],
    rotulos: [`menos de ${num(gwh(c1), 0)} GWh`, `${num(gwh(c1), 0)} a menos de ${num(gwh(c2), 0)} GWh`, `${num(gwh(c2), 0)} GWh ou mais`],
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
export function serieUsinaCsv(texto: string, fonte: FonteRestricao, id: string): LinhaUsinaMes[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const cab = (linhas[0] ?? "").split(";");
  const i = (c: string) => cab.indexOf(c);
  const [iMes, iFonte, iId, iVer, iMh, iMhl] = [i("mes"), i("fonte"), i("id_ons"), i("geracao_verificada_mwh"), i("meias_horas"), i("meias_horas_limitadas")];
  const iRaz = Object.fromEntries(RAZOES.map((z) => [z, i(`eng_${z}_mwh`)])) as Record<RazaoRestricao, number>;
  if ([iMes, iFonte, iId].some((k) => k < 0)) return [];
  const out: LinhaUsinaMes[] = [];
  const marca = `;${fonte};${id};`;
  for (const l of linhas.slice(1)) {
    if (!l.includes(marca)) continue;
    const c = l.split(";");
    if (c[iFonte] !== fonte || c[iId] !== id) continue;
    const r: LinhaUsinaMes = { id: c[iMes], m: c[iMes], mes: mesAno(c[iMes]), verificada_mwh: numCsv(c[iVer]), meias_horas: numCsv(c[iMh]), meias_horas_limitadas: numCsv(c[iMhl]) };
    for (const z of RAZOES) r[z] = iRaz[z] >= 0 ? numCsv(c[iRaz[z]]) : null;
    out.push(r);
  }
  return out.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
}

export function colunasUsinaMes(razoes: readonly RazaoRestricao[]): ColunaTabela[] {
  return [
    { id: "mes", rotulo: "Mês", tipo: "texto" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: `Não gerada, ${CURTO_RAZAO[z]}`, tipo: "numero", unidade: "MWh", casas: 1 })),
    { id: "verificada_mwh", rotulo: "Geração verificada", tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "meias_horas_limitadas", rotulo: "Meias horas limitadas", tipo: "numero", casas: 0 },
    { id: "meias_horas", rotulo: "Meias horas com dado", tipo: "numero", casas: 0 },
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

export function colunasRestricaoDiaria(razoes: readonly RazaoRestricao[]): ColunaTabela[] {
  return [
    { id: "d", rotulo: "Dia", tipo: "data" },
    ...razoes.map((z): ColunaTabela => ({ id: z, rotulo: `Não gerada, ${CURTO_RAZAO[z]}`, tipo: "numero", unidade: "MWh", casas: 1 })),
    { id: "verificada_mwh", rotulo: "Geração verificada", tipo: "numero", unidade: "MWh", casas: 1 },
    { id: "potencia_mw", rotulo: "Maior corte simultâneo", tipo: "numero", unidade: "MW", casas: 1 },
  ];
}

export function linhasDescricoes(r: Pick<Restricao, "descricoes_ultimo_mes">) {
  return (r.descricoes_ultimo_mes?.itens ?? []).map((x, i) => ({ id: `${i}`, descricao: x.descricao, gwh: gwh(x.mwh) }));
}

export const COLUNAS_DESCRICOES: ColunaTabela[] = [
  { id: "descricao", rotulo: "Detalhamento publicado pelo ONS", tipo: "texto" },
  { id: "gwh", rotulo: "Energia não gerada", tipo: "numero", unidade: "GWh", casas: 2 },
];

export function linhasDetalhe(r: Restricao) {
  return (r.detalhe ?? []).map((x) => ({
    id: x.mes,
    mes: mesAno(x.mes),
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

export const COLUNAS_DETALHE: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas individuais", tipo: "numero", casas: 0 },
  { id: "conjuntos", rotulo: "Conjuntos", tipo: "numero", casas: 0 },
  { id: "verificada_gwh", rotulo: "Geração verificada (detalhe)", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "estimada_gwh", rotulo: "Geração de referência (detalhe)", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "meias_horas", rotulo: "Meias horas restritas", tipo: "numero", casas: 0 },
  { id: "soma_detalhe_gwh", rotulo: "Soma das usinas comparadas", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "soma_principal_gwh", rotulo: "Mesmos conjuntos no arquivo principal", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "diferenca_pct", rotulo: "Diferença", tipo: "percentual", casas: 3 },
];

/** Controles da importação das restrições, em frases (contagens da gold). */
export function textoControlesRestricao(r: Restricao): string[] {
  const c = r.controles;
  return [
    `${num(c.linhas, 0)} linhas lidas; ${num(c.valores_negativos_na_fonte, 0)} células negativas na fonte (o dicionário não admite), mantidas como publicadas.`,
    `Campo de geração não realizada apurada (GNRa) do ONS conferido com a regra em ${num(c.meias_horas_com_gnra, 0)} meias horas: ${num(c.gnra_divergente_da_regra, 0)} divergentes.`,
    `Corte simultâneo acima da soma das referências: ${num(c.meias_horas_corte_acima_da_referencia, 0)} de ${num(c.meias_horas_com_corte, 0)} meias horas com corte (por subsistema).`,
    `Meias horas limitadas sem referência: ${num(c.limitadas_sem_referencia, 0)}; razões fora do domínio do dicionário: ${num(c.razao_fora_do_dominio, 0)}.`,
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
export function respostaCapacidade(c: Capacidade): string {
  const r = c.retrato;
  const maiores = [...r.por_categoria].filter((x) => (x.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const frases = [
    `Em ${dataBR(r.data)}, as usinas despachadas pelo ONS somavam ${num(r.total_mw, 0)} MW em operação comercial${maiores.length ? `: ${listaTexto(maiores.slice(0, 3).map((x) => `${minusculaPalavras(CURTO_CATEGORIA[x.categoria])} ${num(x.pct, 1)}%`))}` : ""}.`,
  ];
  const u = c.ultimos_12m;
  if (u) {
    const fcs = ["hidraulica", "eolica", "solar_centralizada"]
      .map((k) => u.por_categoria.find((x) => x.categoria === k))
      .filter((x): x is Capacidade12m => !!x && x.fator_capacidade_pct !== null)
      .map((x) => `${minusculaPalavras(CURTO_CATEGORIA[x.categoria])} ${num(x.fator_capacidade_pct, 1)}%`);
    if (fcs.length) frases.push(`De ${mesAno(u.inicio)} a ${mesAno(u.fim)}, a geração dividida pela potência em operação ao longo de cada mês (fator de capacidade) foi de ${listaTexto(fcs)}.`);
  }
  const mm = c.contexto.mmgd;
  if (mm) frases.push(`A micro e minigeração distribuída cadastrada na ANEEL (${num(mm.potencia_mw, 0)} MW) é outro universo e não entra nessa soma nem no fator de capacidade.`);
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
export function linhasCapacidade(c: Capacidade): LinhaCapacidade[] {
  const siga = c.contexto.siga?.por_categoria_mw ?? {};
  return CATEGORIAS_CAPACIDADE.map((k) => {
    const r = c.retrato.por_categoria.find((x) => x.categoria === k);
    const u = c.ultimos_12m?.por_categoria.find((x) => x.categoria === k);
    return {
      id: k,
      categoria: CURTO_CATEGORIA[k],
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

export function colunasCapacidade(c: Capacidade): ColunaTabela[] {
  const dSiga = c.contexto.siga?.data_referencia ? dataBR(c.contexto.siga.data_referencia) : "retrato";
  const per = c.ultimos_12m ? `${mesAno(c.ultimos_12m.inicio)} a ${mesAno(c.ultimos_12m.fim)}` : "12 meses";
  return [
    { id: "categoria", rotulo: "Categoria", tipo: "texto" },
    { id: "mw", rotulo: `Potência em operação, ONS (${dataBR(c.retrato.data)})`, tipo: "numero", unidade: "MW", casas: 1 },
    { id: "pct", rotulo: "Parcela da potência do ONS", tipo: "percentual", casas: 2 },
    { id: "unidades", rotulo: "Unidades geradoras", tipo: "numero", casas: 0 },
    { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
    { id: "siga_mw", rotulo: `Capacidade fiscalizada, ANEEL SIGA (${dSiga})`, tipo: "numero", unidade: "MW", casas: 1 },
    { id: "fc_pct", rotulo: `Fator de capacidade, ${per}`, tipo: "percentual", casas: 2 },
    { id: "fc_ons_pct", rotulo: "Fator de capacidade publicado pelo ONS", tipo: "percentual", casas: 2 },
    { id: "potencia_media_12m_mw", rotulo: "Potência média em operação", tipo: "numero", unidade: "MW", casas: 1 },
    { id: "capacidade_hora_media_mw", rotulo: "Potência média no denominador", tipo: "numero", unidade: "MW", casas: 1 },
    { id: "cobertura_pct", rotulo: "Geração coberta pelo pareamento", tipo: "percentual", casas: 2 },
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

export function linhasExtremosFc(u: Capacidade12m) {
  const n = u.distribuicao_usinas?.n ?? 0;
  if (n > 0 && n < MINIMO_PARA_DISTRIBUICAO) {
    // poucas observações: as menores e as maiores são as mesmas usinas, e cada uma entra uma vez
    return observacoesFc(u)
      .reverse()
      .map((x) => ({ id: `todas:${x.id}`, grupo: "todas", nome: x.nome, fc_pct: x.fc_pct, potencia_media_mw: [...u.menores, ...u.maiores].find((y) => y.id === x.id)?.potencia_media_mw ?? null }));
  }
  return [
    // o código do ONS (ceg:..., cju:...) é a chave da linha e do arquivo por usina e mês; a tabela do leitor mostra o nome
    ...u.menores.map((x) => ({ id: `menor:${x.id}`, grupo: "menores", nome: x.nome ?? "sem nome na fonte", fc_pct: x.fc_pct, potencia_media_mw: x.potencia_media_mw })),
    ...u.maiores.map((x) => ({ id: `maior:${x.id}`, grupo: "maiores", nome: x.nome ?? "sem nome na fonte", fc_pct: x.fc_pct, potencia_media_mw: x.potencia_media_mw })),
  ];
}

export const COLUNAS_EXTREMOS_FC: ColunaTabela[] = [
  { id: "grupo", rotulo: "Grupo", tipo: "texto", categorica: true },
  { id: "nome", rotulo: "Usina ou conjunto", tipo: "texto" },
  { id: "fc_pct", rotulo: "Fator de capacidade, 12 meses", tipo: "percentual", casas: 1 },
  { id: "potencia_media_mw", rotulo: "Potência média em operação", tipo: "numero", unidade: "MW", casas: 1 },
];

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
export const NOME_GRUPO_ANEEL: Record<GrupoAneel, string> = {
  hidraulica: "Hidráulica (UHE, PCH e CGH)",
  eolica: "Eólica (EOL)",
  solar_centralizada: "Solar centralizada (UFV)",
  nuclear: "Nuclear (UTN)",
  termica: "Térmicas (UTE), todos os combustíveis",
};

export function grupoAneelEscolhido(pedido: string): GrupoAneel {
  return (GRUPOS_ANEEL as readonly string[]).includes(pedido) ? (pedido as GrupoAneel) : "eolica";
}

/** ANEEL × ONS nas datas da série histórica oficial, para um grupo (nada somado). */
export function linhasSigaHistorico(sh: NonNullable<Capacidade["contexto"]["siga_historico"]>, g: GrupoAneel) {
  const x = sh.grupos[g];
  return sh.datas.map((d, i) => ({ id: d, m: d, mes: mesAno(d), aneel_mw: x.aneel_mw[i], ons_mw: x.ons_mw[i], ons_pct_da_aneel: x.ons_pct_da_aneel[i] }));
}

export const COLUNAS_SIGA_HISTORICO: ColunaTabela[] = [
  { id: "mes", rotulo: "Data da série da ANEEL", tipo: "texto" },
  { id: "aneel_mw", rotulo: "Potência em operação, ANEEL", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "ons_mw", rotulo: "Potência em operação comercial, ONS (último dia do mês)", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "ons_pct_da_aneel", rotulo: "ONS como parcela da ANEEL", tipo: "percentual", casas: 1 },
];

/** MMGD cadastrada (MW) e MMGD estimada pelo ONS (MWmed), lado a lado; nunca divididas. */
export function linhasMmgdCapacidade(m: NonNullable<NonNullable<Capacidade["contexto"]["mmgd"]>["mensal"]>) {
  return m.meses.map((mes, i) => ({
    id: mes,
    m: mes,
    mes: mesAno(mes),
    potencia_mw: m.potencia_cadastrada_mw[i],
    provisorio: m.cadastro_provisorio[i] ? "sim" : "não",
    geracao_mwmed: m.geracao_estimada_ons_mwmed[i],
    mes_completo: m.mes_completo_na_geracao[i] ? "sim" : "não",
  }));
}

export const COLUNAS_MMGD_CAPACIDADE: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "potencia_mw", rotulo: "Potência de MMGD cadastrada na ANEEL (fim do mês)", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "provisorio", rotulo: "Cadastro provisório", tipo: "texto", categorica: true },
  { id: "geracao_mwmed", rotulo: "MMGD estimada pelo ONS", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "mes_completo", rotulo: "Mês completo na geração", tipo: "texto", categorica: true },
];

export function linhasFcAcima100(p: Capacidade["pareamento"]) {
  return p.fc_acima_de_100.exemplos.map((x, i) => ({ id: `${x.id}:${x.mes}:${i}`, nome: x.nome ?? x.id, categoria: CURTO_CATEGORIA[x.categoria], mes: mesAno(x.mes), fc_pct: x.fc_pct, potencia_mw: x.potencia_mw, chave: x.id }));
}

export const COLUNAS_FC_ACIMA_100: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina ou conjunto", tipo: "texto" },
  { id: "categoria", rotulo: "Categoria", tipo: "texto", categorica: true },
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "fc_pct", rotulo: "Fator de capacidade do mês", tipo: "percentual", casas: 1 },
  { id: "potencia_mw", rotulo: "Potência em operação comercial", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "chave", rotulo: "Grupo de pareamento", tipo: "texto", buscavel: true },
];

export const ROTULO_CASAMENTO: Record<string, string> = {
  ceg: "mesmo CEG (usina individual)",
  conjunto: "conjunto com relacionamento vigente",
  sem_unidades: "sem unidade pareada (fora do fator de capacidade)",
};

/* ====================================================================== */
/* downloads de cada painel                                                 */
/* ====================================================================== */

const DOWNLOADS_PAINEL: Record<PainelGeracao, RegExp> = {
  p021: /matriz|rotulos|a11|reconciliacao/,
  p022: /termica|cvu/,
  p023: /restricao/,
  p024: /capacidade/,
};

export function downloadsDoPainel(d: readonly { rotulo: string; url: string }[], p: PainelGeracao): { rotulo: string; url: string }[] {
  // o arquivo horário tem 8.760 linhas, 365 dias; o rótulo publicado ainda diz 366 (ajuste pedido ao pipeline)
  return d.filter((x) => DOWNLOADS_PAINEL[p].test(x.url)).map((x) => ({ ...x, rotulo: x.rotulo.replace("últimos 366 dias", "últimos 365 dias") }));
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
export const NOME_NA_BARRA: Record<CategoriaGeracao, string> = { ...CURTO_CATEGORIA, solar_mmgd: "Solar MMGD" };

/** Total da janela em MWmed no perímetro escolhido (com ou sem a MMGD estimada). */
export function totalDaJanela(mix: Pick<Mix, "total_mwmed" | "total_sem_mmgd_mwmed"> | null, per: Perimetro): number | null {
  return mix ? (per === "com" ? mix.total_mwmed : mix.total_sem_mmgd_mwmed) : null;
}

/** Ressalva de universo sem o prefixo e sem o ponto final, para entrar numa frase ou numa legenda. */
function ressalvaEmFrase(r: RessalvaUniverso | undefined | null): string | null {
  const t = textoRessalva(r);
  return t ? t.replace(/^Ressalva de universo:?\s*/, "").replace(/\.$/, "") || "cobertura da fonte alterada" : null;
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
export function composicaoDaJanela(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro): LinhaFonte[] {
  const { mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return [];
  const out: LinhaFonte[] = [];
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const p = participacaoDe(mix, per, c);
    if (p === null) continue;
    out.push({ id: c, rotulo: NOME_NA_BARRA[c], participacao: p, mwmed: mix.mwmed[c], natureza: naturezaDaCategoria(c), cobertura: ressalvaEmFrase(mix.ressalvas_universo[c]) });
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
): { janela: JanelaMatriz; ref: JanelaMatriz; comparaveis: LinhaComparacaoJanelas[]; fora: ForaDaComparacao[] } {
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
      fora.push({ id: c, rotulo: CURTO_CATEGORIA[c], motivo: ressalvaEmFrase(dona) ?? "cobertura da fonte alterada" });
    } else if (p === null || pr === null) {
      fora.push({ id: c, rotulo: CURTO_CATEGORIA[c], motivo: `sem valor na janela de ${ROTULO_JANELA[p === null ? janela : ref]}` });
    } else comparaveis.push({ id: c, rotulo: CURTO_CATEGORIA[c], participacao: p, participacao_ref: pr });
  }
  comparaveis.sort((a, b) => b.participacao - a.participacao);
  return { janela, ref, comparaveis, fora };
}

/** Fonte de maior participação na janela (a "fonte principal" da faixa de métricas), pelo mesmo critério do gráfico. */
export function fontePrincipalDaJanela(mix: Mix | null, per: Perimetro): { id: CategoriaGeracao; rotulo: string; frase: string; participacao: number } | null {
  if (!mix) return null;
  let melhor: { id: CategoriaGeracao; participacao: number } | null = null;
  for (const c of CATEGORIAS) {
    if (per === "sem" && c === "solar_mmgd") continue;
    const p = participacaoDe(mix, per, c);
    if (p !== null && (melhor === null || p > melhor.participacao)) melhor = { id: c, participacao: p };
  }
  return melhor ? { ...melhor, rotulo: CURTO_CATEGORIA[melhor.id], frase: FRASE_CATEGORIA[melhor.id] } : null;
}

/** Natureza da energia da janela (medição, previsão do ONS e estimativa do ONS): as partes que fecham 100%, na ordem de NATUREZAS. */
export function partesDaNatureza(mix: Pick<Mix, "natureza_pct"> | null): { id: NaturezaGeracao; rotulo: string; pct: number }[] {
  if (!mix) return [];
  return NATUREZAS.flatMap((n) => {
    const p = mix.natureza_pct[n];
    return p === null ? [] : [{ id: n, rotulo: CURTO_NATUREZA[n], pct: p }];
  });
}

/**
 * Datas de referência de cada parte do módulo, com a natureza de cada uma: a matriz vai até o último dia completo; o despacho térmico,
 * as restrições e o fator de capacidade, até o último mês completo de cada conjunto; a capacidade instalada é o retrato de uma data.
 * Parte que a gold não publica não entra na lista.
 */
export function datasDoModulo(g: Pick<GoldGeracaoDetalhe, "dia_referencia" | "a11" | "termica" | "restricoes" | "capacidade">): { rotulo: string; texto: string; natureza: Natureza }[] {
  const out: { rotulo: string; texto: string; natureza: Natureza }[] = [{ rotulo: "Matriz efetiva", texto: `até ${dataBR(g.dia_referencia)}`, natureza: "CALCULADO" }];
  if (g.a11.primeiro_dia_mmgd) out.push({ rotulo: "MMGD estimada pelo ONS", texto: `de ${dataBR(g.a11.primeiro_dia_mmgd)} a ${dataBR(g.dia_referencia)}`, natureza: "ESTIMADO" });
  if (g.termica) out.push({ rotulo: "Despacho térmico", texto: `até ${mesAno(g.termica.ultimo_mes_completo)} (último mês completo)`, natureza: "CALCULADO" });
  const meses = [g.restricoes.eolica?.ultimo_mes_completo, g.restricoes.solar?.ultimo_mes_completo].filter((x): x is string => !!x).sort();
  if (meses.length) out.push({ rotulo: "Restrições de renováveis", texto: `até ${mesAno(meses[0])} (último mês completo)`, natureza: "ESTIMADO" });
  if (g.capacidade) {
    out.push({ rotulo: "Potência instalada", texto: `retrato de ${dataBR(g.capacidade.retrato.data)}`, natureza: "OBSERVADO" });
    const ultimo = g.capacidade.mensal.meses.at(-1);
    if (ultimo) out.push({ rotulo: "Fator de capacidade", texto: `até ${mesAno(ultimo)} (último mês completo)`, natureza: "CALCULADO" });
  }
  return out;
}

/**
 * Categorias cuja cobertura na fonte mudou em algum mês da série mensal (ressalva de universo no mês): quantos meses e o último.
 * Serve à nota sob a série mensal: a variação dessas categorias entre meses pode refletir a cobertura, não só a geração.
 */
export function coberturaMensal(ms: Pick<MensalSin, "ressalvas_universo">): { id: CategoriaGeracao; rotulo: string; meses: number; ultimo: string }[] {
  return CATEGORIAS.flatMap((c) => {
    const lista = ms.ressalvas_universo[c] ?? [];
    return lista.length ? [{ id: c, rotulo: CURTO_CATEGORIA[c], meses: lista.length, ultimo: [...lista].sort().at(-1)! }] : [];
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
 * Mês sem valor é dito, nunca zerado, e a frase some quando nem o último mês tem valor.
 */
export function textoMudancaMensal(o: {
  nome: string;
  unidade: string;
  casas?: number;
  percentual?: boolean;
  meses: readonly string[];
  valores: readonly (number | null | undefined)[];
  mes: string | null;
}): string {
  if (!o.mes) return "";
  const casas = o.casas ?? 1;
  const valor = (m: string): number | null => {
    const i = o.meses.indexOf(m);
    const v = i >= 0 ? o.valores[i] : null;
    return v === null || v === undefined ? null : v;
  };
  const v = valor(o.mes);
  if (v === null) return "";
  const fmt = (x: number) => `${num(x, casas)}${o.percentual ? "%" : ` ${o.unidade}`}`;
  const diferenca = (ref: number) => {
    if (o.percentual) {
      const d = v - ref;
      const a = Math.round(Math.abs(d) * 10) / 10;
      return `${d > 0 ? "+" : d < 0 ? "−" : ""}${num(a, 1)} ${a === 1 ? "ponto percentual" : "pontos percentuais"}`;
    }
    if (ref === 0) return "sem variação calculável";
    const d = (100 * (v - ref)) / ref;
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${num(Math.abs(d), 1)}%`;
  };
  const contra = (m: string) => {
    const x = valor(m);
    return x === null ? `sem valor em ${mesAno(m)}` : `${fmt(x)} em ${mesAno(m)} (${diferenca(x)})`;
  };
  const anterior = mesDeslocado(o.mes, -1);
  const anoAntes = mesDeslocado(o.mes, -12);
  return `${inicial(o.nome)} em ${mesAno(o.mes)}: ${fmt(v)}, contra ${contra(anterior)} e ${contra(anoAntes)}.`;
}

/** CVU zero publicado na semana: quantas parcelas e em quais combustíveis. Zero é valor da fonte, mantido como publicado e nunca tratado como ausência. */
export function zerosDoCvu(cvu: Pick<NonNullable<Termica["cvu"]>, "usinas">): { total: number; zeros: number; porCombustivel: { categoria: string; rotulo: string; n: number; zeros: number }[] } {
  const por: Record<string, { n: number; zeros: number }> = {};
  for (const u of cvu.usinas) {
    const x = (por[u.categoria] ??= { n: 0, zeros: 0 });
    x.n += 1;
    if (u.cvu === 0) x.zeros += 1;
  }
  const rotulo = (k: string) => (CURTO_COMBUSTIVEL as Record<string, string>)[k] ?? k;
  const porCombustivel = Object.keys(por)
    .filter((k) => por[k].zeros > 0)
    .map((k) => ({ categoria: k, rotulo: rotulo(k), n: por[k].n, zeros: por[k].zeros }))
    .sort((a, b) => b.zeros - a.zeros);
  return { total: cvu.usinas.length, zeros: porCombustivel.reduce((t, x) => t + x.zeros, 0), porCombustivel };
}

export function notaCvuZero(cvu: Pick<NonNullable<Termica["cvu"]>, "usinas">): string {
  const z = zerosDoCvu(cvu);
  const onde = z.porCombustivel.map((x) => `${minusculaPalavras(x.rotulo)}, ${num(x.zeros, 0)} de ${num(x.n, 0)}`);
  const zero = z.zeros > 0 ? `CVU 0,00 é valor publicado pela fonte em ${num(z.zeros, 0)} das ${num(z.total, 0)} parcelas da semana (${listaTexto(onde)}); fica como publicado e nunca é tratado como ausência. ` : "";
  return `${zero}A mediana é a das parcelas com CVU, sem peso pela geração, em reais correntes de cada semana.`;
}

/** Nota da térmica por motivo: o não classificado (total verificado menos a soma dos motivos, com sinal) fica fora das barras e dentro da tabela. */
export function notaNaoClassificado(u: Pick<Termica["ultimos_12m"], "nao_classificado_mwh" | "nao_classificado_pct" | "total_mwh">): string {
  if (u.nao_classificado_mwh === null || u.nao_classificado_mwh === undefined) return "";
  const g = gwh(u.nao_classificado_mwh);
  const pct = u.nao_classificado_pct;
  return `As barras somam só os motivos classificados; o não classificado, ${num(g, 1)} GWh${pct === null || pct === undefined ? "" : ` (${num(pct, 3)}% da geração térmica)`}, é o total verificado menos a soma dos motivos, com sinal, como a fonte publica, e está na tabela.`;
}

/** Quando o número de usinas pareadas ou a cobertura mudam dentro dos 12 meses publicados, a página diz (o universo cresce, não só a geração). */
export function notaCrescimentoUniverso(u: Pick<Termica["universo"], "mensal">): string {
  const m = u.mensal;
  if (m.length < 2) return "";
  const a = m[0];
  const z = m[m.length - 1];
  if (a.usinas_pareadas === z.usinas_pareadas && a.cobertura_tipo_i_iia_pct === z.cobertura_tipo_i_iia_pct) return "";
  return `O universo muda dentro dos 12 meses: as usinas pareadas entre os dois conjuntos do ONS passam de ${num(a.usinas_pareadas, 0)} em ${mesAno(a.mes)} para ${num(z.usinas_pareadas, 0)} em ${mesAno(z.mes)}, e a cobertura das térmicas Tipo I e II-A na Geração por Usina, de ${num(a.cobertura_tipo_i_iia_pct, 1)}% para ${num(z.cobertura_tipo_i_iia_pct, 1)}%.`;
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
export function textoDiasDoBalancoForaDoPadrao(dias: readonly { d: string; sm: string; balanco_mwh: number; usinas_mwh: number }[]): string {
  if (!dias.length) return "";
  const nome = (sm: string) => (NOME_REGIAO as Record<string, string>)[sm] ?? sm;
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
  return `No Balanço, a eólica fica muito abaixo da soma das usinas em ${listaTexto(porDia.map((p) => `${dataBR(p.d)} (${listaTexto(p.sms)})`))}; por exemplo, ${num(ex.balanco_mwh / 1000, 1)} GWh contra ${num(ex.usinas_mwh / 1000, 1)} GWh no ${nome(ex.sm)} em ${dataBR(ex.d)}. As janelas de 7 dias que incluem esses dias usam esse Balanço e podem ter a participação térmica distorcida; a divergência está listada em Auditar.`;
}

/** Categorias em que a capacidade fiscalizada da ANEEL (SIGA) e a potência do ONS diferem em mais de 25%: outro universo e outra classificação. */
export function diferencasAneelOns(linhas: readonly Pick<LinhaCapacidade, "id" | "categoria" | "mw" | "siga_mw">[]): { id: CategoriaCapacidade; categoria: string; aneel: number; ons: number }[] {
  return linhas
    .flatMap((l) => (l.mw && l.siga_mw && Math.abs(l.siga_mw / l.mw - 1) > 0.25 ? [{ id: l.id, categoria: l.categoria, aneel: l.siga_mw, ons: l.mw }] : []))
    .sort((a, b) => Math.abs(b.aneel - b.ons) - Math.abs(a.aneel - a.ons));
}

/** Categorias cujo fator de capacidade usa só parte da potência em operação (denominador com menos de 90% dela): a ressalva vem junto do fator. */
export function coberturaDaPotencia(linhas: readonly Pick<LinhaCapacidade, "id" | "categoria" | "fc_pct" | "potencia_media_12m_mw" | "capacidade_hora_media_mw">[]): { id: CategoriaCapacidade; categoria: string; fc: number; denominador: number; potencia: number; pct: number }[] {
  return linhas.flatMap((l) => {
    const d = l.capacidade_hora_media_mw;
    const p = l.potencia_media_12m_mw;
    return l.fc_pct !== null && d && p && d / p < 0.9 ? [{ id: l.id, categoria: l.categoria, fc: l.fc_pct, denominador: d, potencia: p, pct: (100 * d) / p }] : [];
  });
}

/** Menos de 10 observações: a distribuição não se descreve por quantis; mostram-se os valores de cada usina ou conjunto (menores e maiores cobrem todos). */
export const MINIMO_PARA_DISTRIBUICAO = 10;

export function observacoesFc(u: Pick<Capacidade12m, "menores" | "maiores">): { id: string; nome: string; fc_pct: number }[] {
  const vistos: Record<string, boolean> = {};
  const out: { id: string; nome: string; fc_pct: number }[] = [];
  for (const x of [...u.menores, ...u.maiores]) {
    if (vistos[x.id] || x.fc_pct === null || x.fc_pct === undefined) continue;
    vistos[x.id] = true;
    out.push({ id: x.id, nome: x.nome ?? "sem nome na fonte", fc_pct: x.fc_pct });
  }
  return out.sort((a, b) => b.fc_pct - a.fc_pct);
}

/** Universo e início de cada fonte de restrição, para a frase que as junta: eólica e fotovoltaica não são o mesmo universo nem o mesmo período. */
export function notaUniversoRestricoes(rs: Partial<Record<FonteRestricao, Pick<Restricao, "primeiro_mes" | "ultimos_12m">>>): string {
  const partes = FONTES_RESTRICAO.flatMap((f) => {
    const r = rs[f];
    if (!r?.ultimos_12m) return [];
    return [`${NOME_FONTE_RESTRICAO[f].toLowerCase()}, ${num(r.ultimos_12m.usinas_no_universo, 0)} usinas e conjuntos, série desde ${mesAno(r.primeiro_mes)}`];
  });
  return partes.length > 1 ? `Universos e períodos diferentes: ${listaTexto(partes)}. As duas taxas não se comparam como se fossem do mesmo conjunto.` : "";
}

/** Em palavras simples, o que cada motivo de despacho quer dizer (a redação do ONS fica ao lado, no rótulo publicado). */
export const GLOSA_MOTIVO: Record<MotivoDespacho, string> = {
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
};

/* ====================================================================== */
/* vereditos (r8): resposta curta em duas camadas                           */
/* ====================================================================== */

/**
 * Cada veredito responde, em palavras simples e com no máximo dois números, à pergunta do título do painel e diz o limite
 * de leitura. Os números saem dos mesmos campos da resposta completa (respostaMatriz, respostaTermica, respostaRestricao e
 * respostaCapacidade), que continua inteira como segunda camada em Analisar e Auditar. Dado ausente: veredito vazio.
 */

/** P021: as duas maiores fontes do recorte escolhido e o aviso de que parte da energia é estimativa ou previsão do ONS. */
export function vereditoMatriz(m: Pick<Matriz, "janelas">, rg: RegiaoGeracao, pedida: JanelaMatriz, per: Perimetro): string {
  const { janela, mix } = janelaEscolhida(m, rg, pedida);
  if (!mix) return "";
  const nomes = Object.fromEntries(CATEGORIAS.map((c) => [c, FRASE_CATEGORIA[c]])) as Record<CategoriaGeracao, string>;
  const linhas = ordenaPorParticipacao(linhasMatriz(m, rg, janela, per, nomes)).filter((l) => (l.participacao ?? 0) > 0);
  if (!linhas.length) return "";
  const quando = `${janela === "dia" ? `Em ${dataBR(mix.fim)}` : `Nos ${mix.dias} dias até ${dataBR(mix.fim)}`}${per === "sem" ? ", sem a MMGD estimada" : ""}`;
  const [a, b] = linhas;
  const fontes = b
    ? `as duas maiores fontes foram ${a.categoria}, com ${num(a.participacao, 1)}% da geração ${DO_REGIAO[rg]}, e ${b.categoria}, com ${num(b.participacao, 1)}%`
    : `a única fonte com geração foi ${a.categoria}, com ${num(a.participacao, 1)}% da geração ${DO_REGIAO[rg]}`;
  const limite = per === "sem" ? "A MMGD estimada pelo ONS fica fora desta conta." : "Parte da energia é estimativa ou previsão do ONS, não medição.";
  return `${quando}, ${fontes}. ${limite}`;
}

/** Fontes das pequenas usinas Tipo III, em plural, na ordem das categorias; todas as térmicas viram "térmicas". */
export function fontesDoGrupoTipo3(rotulos: readonly Pick<RotuloFonte, "categoria" | "natureza" | "mwh_12m" | "mwh_desde_inicio">[], categorias: GoldGeracaoDetalhe["categorias"]): string[] {
  const plural: Partial<Record<CategoriaGeracao, string>> = { hidraulica: "hidráulicas", eolica: "eólicas", solar_centralizada: "solares" };
  const termica = new Set(categorias.filter((c) => c.termica).map((c) => c.id));
  const com = new Set(rotulos.filter((r) => r.natureza === "grupo_tipo3" && (r.mwh_12m ?? 0) > 0).map((r) => r.categoria));
  const out: string[] = [];
  for (const c of CATEGORIAS) if (com.has(c) && plural[c]) out.push(plural[c]!);
  if (CATEGORIAS.some((c) => com.has(c) && termica.has(c))) out.push("térmicas");
  return out;
}

/**
 * Conciliação do Tipo III: a natureza "previsão do ONS para grupos Tipo III" reúne pequenas usinas de várias fontes e vale
 * `grupo` % da geração; o gráfico mostra só a categoria "Térmicas Tipo III", a parte térmica do grupo, em `termica` %.
 */
export function notaTipoIII(mix: Mix | null, per: Perimetro, fontes: readonly string[]): string {
  if (!mix) return "";
  const grupo = mix.natureza_pct.grupo_tipo3;
  const termica = per === "com" ? mix.participacao.termica_sem_combustivel : mix.participacao_sem_mmgd.termica_sem_combustivel;
  if (grupo === null || termica === null) return "";
  const quais = fontes.length ? `${listaTexto(fontes)}, cada uma contada na sua fonte` : "de várias fontes";
  const sem = per === "sem" ? " (sem a MMGD no total)" : "";
  return `Pequenas usinas Tipo III: ${num(grupo, 1)}% da geração com a MMGD estimada, somando usinas ${quais}. O gráfico mostra só a parte térmica do grupo, "Térmicas Tipo III": ${num(termica, 1)}%${sem}.`;
}

/** P022: a energia térmica dos 12 meses e o motivo de despacho com maior parcela, como o ONS o classifica. */
export function vereditoTermica(t: Pick<Termica, "ultimos_12m">): string {
  const u = t.ultimos_12m;
  const principal = [...u.por_motivo].filter((m) => (m.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  if (u.total_mwmed === null) return "";
  const motivo = principal
    ? `, ${num(principal.pct, 1)}% por ${minusculaPalavras(CURTO_MOTIVO[principal.motivo])}${principal.motivo === "inflexibilidade" ? " (geração declarada pelo agente ou acima do despachado)" : ""}`
    : "";
  return `Nos 12 meses até ${mesAno(u.fim)}, as térmicas despachadas pelo ONS geraram ${num(u.total_mwmed, 0)} MWmed em média${motivo}. O motivo é a classificação do ONS, não uma inferência do observatório.`;
}

/** P023: o quanto as eólicas e as fotovoltaicas deixaram de gerar por limitação do ONS (cada fonte publicada com 12 meses). */
export function vereditoRestricao(rs: Partial<Record<FonteRestricao, Pick<Restricao, "fonte" | "primeiro_mes" | "ultimos_12m">>>): string {
  const com = FONTES_RESTRICAO.filter((f) => rs[f]?.ultimos_12m && rs[f]!.ultimos_12m!.taxa_pct !== null);
  if (!com.length) return "";
  const nome = (f: FonteRestricao) => FRASE_FONTE_RESTRICAO[f].replace(/^usinas /, "");
  const taxa = (f: FonteRestricao) => `${num(rs[f]!.ultimos_12m!.taxa_pct, 1)}%`;
  const fim = rs[com[0]]!.ultimos_12m!.fim;
  const quando = com.every((f) => rs[f]!.ultimos_12m!.fim === fim) ? `Nos 12 meses até ${mesAno(fim)}` : "Nos últimos 12 meses completos";
  const [a, b] = com;
  const corpo = `a limitação do ONS fez as ${nome(a)} deixarem de gerar ${taxa(a)} do que teriam gerado${b ? `, e as ${nome(b)}, ${taxa(b)}` : ""}`;
  return `${quando}, ${corpo}. O valor é estimativa, e restrição não é falta de vento nem de sol.`;
}

/** Razões oficiais sem energia não gerada nos 12 meses (não aparecem no gráfico mensal) e a chave das que aparecem. */
export function notaRazoesRestricao(
  r: Pick<Restricao, "ultimos_12m">,
  rotulos: Partial<Record<RazaoRestricao, string>>,
  noGrafico: readonly RazaoRestricao[],
): string {
  const u = r.ultimos_12m;
  if (!u) return "";
  const chave = noGrafico.map((z) => `${z}, ${(rotulos[z] ?? CURTO_RAZAO[z]).replace(/^(.)/, (c) => c.toLowerCase())}`);
  const oficiais: RazaoRestricao[] = ["REL", "CNF", "ENE", "PAR"];
  const vazias = oficiais.filter((z) => !noGrafico.includes(z));
  const semEnergia = vazias.length
    ? ` ${inicial(listaTexto(vazias.map((z) => (rotulos[z] ?? CURTO_RAZAO[z]).replace(/^(.)/, (c) => c.toLowerCase()))))} não teve energia não gerada nos 12 meses e por isso não aparece no gráfico.`
    : "";
  return `Razões no gráfico: ${chave.join("; ")}.${semEnergia}`;
}

/** P024: a potência instalada no retrato, o fator de capacidade de uma fonte em palavras simples e o que fica fora da soma. */
export function vereditoCapacidade(c: Pick<Capacidade, "retrato" | "ultimos_12m" | "contexto">): string {
  const r = c.retrato;
  if (r.total_mw === null) return "";
  const u = c.ultimos_12m;
  const NOME: Partial<Record<CategoriaCapacidade, string>> = { eolica: "eólicas", solar_centralizada: "solares centralizadas", hidraulica: "hidrelétricas" };
  const base = (["eolica", "solar_centralizada", "hidraulica"] as const).map((k) => u?.por_categoria.find((x) => x.categoria === k)).find((x) => !!x && x.fator_capacidade_pct !== null);
  const fc = u && base ? ` Nos 12 meses até ${mesAno(u.fim)}, as ${NOME[base.categoria]} geraram ${num(base.fator_capacidade_pct, 1)}% do máximo que a potência delas permitiria.` : "";
  const mmgd = c.contexto.mmgd ? " A micro e minigeração distribuída fica fora." : "";
  return `Em ${dataBR(r.data)}, as usinas despachadas pelo ONS somavam ${num(r.total_mw, 0)} MW.${fc}${mmgd}`;
}

/**
 * "O que mudou" de painel mensal que não compara com a publicação anterior: diz isso e até que mês o dado vai e quando
 * foi processado, em vez de apresentar a data de processamento como se fosse mudança.
 */
export function textoSemComparacaoMensal(ultimoMes: string | null, geradoEm: string, nome: string): string {
  if (!ultimoMes) return `${inicial(nome)}: nenhum mês completo publicado.`;
  return `Sem comparação com a publicação anterior. ${inicial(nome)}: último mês completo ${mesAno(ultimoMes)}, processado em ${dataBR(diaDeBrasilia(geradoEm))}.`;
}
