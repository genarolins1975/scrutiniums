/**
 * Lógica pura das páginas do módulo Empresas (/setor-eletrico/empresas e
 * /setor-eletrico/empresas/[entidade]), sem React e testável em node
 * (src/tests/energia-empresas.test.ts).
 *
 * Por que um arquivo próprio: os componentes "use client" só exportam componentes, e
 * as mesmas linhas precisam alimentar o gráfico, a tabela equivalente e a exportação
 * (seção 11.7 da especificação). Cada função `linhas*` ou `dados*` monta UMA matriz
 * que o gráfico e a tabela recebem iguais; o teste confere essa matriz contra os CSV
 * publicados pelo pipeline (pipeline/energia/modulos/empresas.py).
 *
 * O que fica aqui:
 *  - seleção, ordenação e conversão de unidade (kW para MW já vem do pipeline; R$ para
 *    R$ milhões aqui) de números publicados na gold; nenhuma participação, HHI, soma
 *    de capacidade ou conta é refeita: a fórmula roda no pipeline, a interface só lê;
 *  - as respostas curtas de cada painel e da ficha da distribuidora, geradas por regra
 *    determinística a partir dos números publicados (seção 7.4). Nenhuma frase traz
 *    número fixo: todo número vem do argumento, e a ausência vira "sem dado";
 *  - a projeção das coordenadas oficiais do SIGA na grade da malha do IBGE, a árvore
 *    societária montada do arquivo da cadeia e os esquemas de estado na URL.
 *
 * Medidas que nunca se misturam (ver tipos-empresas.ts): capacidade proporcional e
 * capacidade sob controle; consolidado e individual da CVM; potência fiscalizada (em
 * operação) e outorgada (demais fases); km de circuito e km de traçado.
 */
import type {
  Ativos,
  AtivosMapa,
  CadeiaSocietaria,
  Cadastro,
  Companhia,
  Concentracao,
  ConcentracaoTipo,
  ConferenciaAgentes,
  ContaCvm,
  Controle,
  DefinicaoConta,
  Distribuidora,
  Distribuidoras,
  EscopoCvm,
  EstadoVinculo,
  FaixaHhi,
  Financas,
  Grupo,
  MotivoParada,
  Proprietario,
  ReferenciaTarifa,
  SeriesFinanceiras,
  Transmissao,
} from "./tipos-empresas";
import type { Download } from "./tipos";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { dataBR, num, pct } from "./formato";
import { LIMITE_COMPARACAO, type ColunaTabela, type EntidadeBuscavel, type LinhaTabela } from "./tabela";

/* ================================================================ comum */

export const ROTA_EMPRESAS = "/setor-eletrico/empresas";

export type PainelEmpresas = "p036" | "p037" | "p038" | "p039";

/**
 * Os quatro painéis do módulo, com a pergunta do Anexo A da especificação como título, cada um
 * na sua página (/setor-eletrico/empresas/<segmento>). Por que uma página por painel: juntos, os
 * quatro passavam de 650 KB de HTML, acima da meta de cerca de 600 KB por página (contrato,
 * seção 5.1). Os segmentos não podem coincidir com o slug de nenhuma distribuidora (a rota
 * dinâmica [entidade] é irmã deles); o teste confere.
 */
export const PAINEIS_EMPRESAS: readonly { id: PainelEmpresas; rotulo: string; pergunta: string; segmento: string }[] = [
  { id: "p036", rotulo: "Cadastro e ativos", pergunta: "Quem opera quais ativos?", segmento: "ativos" },
  { id: "p037", rotulo: "Perfil da distribuidora", pergunta: "Como a empresa atende sua área?", segmento: "distribuidoras" },
  { id: "p038", rotulo: "Finanças e investimentos", pergunta: "Como evoluem os fundamentos reportados?", segmento: "financas" },
  { id: "p039", rotulo: "Controle e concentração", pergunta: "Quem controla e qual a concentração?", segmento: "controle" },
];

export function painel(id: PainelEmpresas) {
  return PAINEIS_EMPRESAS.find((p) => p.id === id)!;
}
/** Página do painel. */
export function rotaPainel(id: PainelEmpresas): string {
  return `${ROTA_EMPRESAS}/${painel(id).segmento}`;
}
/** Página do painel com a âncora do próprio painel (link compartilhável e "Comprove este número"). */
export function ancoraPainel(id: PainelEmpresas): string {
  return `${rotaPainel(id)}#${id}`;
}
export function rotaEntidade(slug: string): string {
  return `${ROTA_EMPRESAS}/${slug}`;
}

/**
 * Ausência dentro de frase. O traço de AUSENTE (formato.ts) serve às células de tabela;
 * no meio de um texto ele se leria como pontuação, então as funções de texto dizem
 * "sem dado".
 */
export const SEM_DADO = "sem dado";
export const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

export function inteiro(v: number | null | undefined): string {
  return temValor(v) ? num(v, 0) : SEM_DADO;
}
export function numTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? num(v, casas) : SEM_DADO;
}
export function pctTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? pct(v, casas) : SEM_DADO;
}
/** Potência em MW para frase: "220.658,9 MW"; ausência → "sem dado". */
export function mwTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? `${num(v, casas)} MW` : SEM_DADO;
}
export function dataTexto(iso: string | null | undefined): string {
  return iso ? dataBR(iso) : SEM_DADO;
}

/** "12300288000107" → "12.300.288/0001-07"; outro formato fica como veio. */
export function cnpjFormatado(c: string | null | undefined): string {
  if (!c) return SEM_DADO;
  const d = c.replace(/\D/g, "");
  if (d.length !== 14) return c;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Nome publicado ou, sem nome, o CNPJ formatado (identidade é o CNPJ; o nome é rótulo). */
export function nomeOuCnpj(nome: string | null | undefined, cnpj: string | null | undefined): string {
  return nome && nome.trim() ? nome : cnpj ? `CNPJ ${cnpjFormatado(cnpj)}` : SEM_DADO;
}

/** "2026T2" → "2º trimestre de 2026". */
export function trimestreTexto(t: string | null | undefined): string {
  const m = t ? /^(\d{4})T([1-4])$/.exec(t) : null;
  return m ? `${m[2]}º trimestre de ${m[1]}` : SEM_DADO;
}

/**
 * Reais em escala legível para frase ("R$ 42,8 bilhões", "R$ 389,8 milhões"); valores em R$
 * inteiros, como a gold publica. Singular abaixo de 2 ("R$ 1,3 bilhão"). Negativo com o
 * sinal de menos tipográfico. Ausência → "sem dado".
 */
export function reaisEscala(v: number | null | undefined): string {
  if (!temValor(v)) return SEM_DADO;
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  const escalas: [number, string, string][] = [
    [1e9, "bilhão", "bilhões"],
    [1e6, "milhão", "milhões"],
    [1e3, "mil", "mil"],
  ];
  for (const [base, um, varios] of escalas) {
    if (a >= base) {
      const x = Math.round((a / base) * 10) / 10;
      return `${sinal}R$ ${num(x, 1)} ${x < 2 ? um : varios}`;
    }
  }
  return `${sinal}R$ ${num(a, 0)}`;
}

/** R$ inteiros → R$ milhões (conversão de unidade para tabela e gráfico; nenhuma conta refeita). */
export function emMilhoes(v: number | null | undefined): number | null {
  return temValor(v) ? v / 1e6 : null;
}

/** Posição numa lista ordenada, para frase: "5 de 71". */
export function posicaoTexto(posicao: number, total: number): string {
  return `${num(posicao, 0)} de ${num(total, 0)}`;
}

/** Downloads da gold filtrados pelos endereços pedidos, na ordem pedida. */
export function downloadsDe(todos: readonly Download[], urls: readonly string[]): Download[] {
  return urls.map((u) => todos.find((d) => d.url === u)).filter((d): d is Download => !!d);
}

/** Leitor de CNPJ de 14 dígitos para a URL (identidade canônica do módulo). */
export const leitorCnpj: Leitor<string> = { ler: (b) => (/^\d{14}$/.test(b) ? b : undefined), escrever: (v) => v };

/* ================================================================ P036: cadastro e ativos */

export const ROTULO_ESTADO_VINCULO: Readonly<Record<EstadoVinculo, string>> = {
  vinculado: "Vinculado: todos os proprietários com CNPJ",
  inclui_sem_documento: "Inclui proprietário sem CNPJ (pessoa física)",
  soma_divergente: "Participações não somam 100%",
  sem_proprietario: "Proprietário não informado",
  nao_lido: "Campo de proprietários não lido",
};

/**
 * Resposta curta do P036: cobertura dos vínculos provados da geração e da transmissão. Todo
 * número vem da gold; "sem vínculo completo" é a soma publicada por estado (nunca deduzida).
 */
export function respostaCadastro(c: Cadastro): string {
  const a = c.ativos;
  const semVinculoOperacao = a.estados.filter((e) => e.estado !== "vinculado").reduce((s, e) => s + e.usinas_operacao, 0);
  const partes = [
    `No SIGA de ${dataTexto(a.data)}, ${inteiro(a.operacao.usinas)} usinas estão em operação, com ${mwTexto(a.operacao.mw_fiscalizado)} de potência fiscalizada; ${pctTexto(a.pct_mw_operacao_vinculado)} dessa potência tem todos os proprietários identificados pelo CNPJ publicado no próprio registro, num total de ${inteiro(a.proprietarios_cnpj)} proprietários.`,
    semVinculoOperacao > 0
      ? `As ${inteiro(semVinculoOperacao)} usinas em operação sem vínculo completo continuam identificadas, cada uma com o motivo.`
      : "Nenhuma usina em operação ficou sem vínculo completo.",
  ];
  const t = c.transmissao;
  if (t) {
    partes.push(
      `Na transmissão, o SIGET de ${dataTexto(t.data)} liga ${pctTexto(t.resumo.pct_modulos_com_cnpj)} dos ${inteiro(t.resumo.modulos)} módulos ao CNPJ de ${inteiro(t.resumo.cnpjs_com_modulos)} concessionárias, com ${numTexto(t.resumo.km_circuito_operacao)} km de circuito em operação.`,
    );
  } else {
    partes.push("Os ativos de transmissão não estão nesta publicação: o SIGET faltou no silver do módulo.");
  }
  return partes.join(" ");
}

export const COLUNAS_ESTADOS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Estado do vínculo", tipo: "texto" },
  { id: "usinas_operacao", rotulo: "Usinas em operação", tipo: "numero", casas: 0 },
  { id: "mw_operacao", rotulo: "Potência em operação", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "pct_mw_operacao", rotulo: "Da potência em operação", tipo: "percentual", casas: 2 },
  { id: "usinas", rotulo: "Usinas, todas as fases", tipo: "numero", casas: 0 },
  { id: "pct_usinas", rotulo: "Das usinas, todas as fases", tipo: "percentual", casas: 2 },
];
export function linhasEstados(a: Ativos): LinhaTabela[] {
  return a.estados.map((e) => ({
    id: e.estado,
    rotulo: e.rotulo,
    usinas_operacao: e.usinas_operacao,
    mw_operacao: e.mw_operacao,
    pct_mw_operacao: e.pct_mw_operacao,
    usinas: e.usinas,
    pct_usinas: e.pct_usinas,
  }));
}

export const COLUNAS_FASES: ColunaTabela[] = [
  { id: "fase", rotulo: "Fase no SIGA", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_fiscalizado", rotulo: "Potência fiscalizada", tipo: "numero", unidade: "MW", casas: 1 },
];
export function linhasFases(a: Ativos): LinhaTabela[] {
  return a.por_fase.map((f) => ({ id: f.fase, fase: f.fase, usinas: f.usinas, mw_outorgado: f.mw_outorgado, mw_fiscalizado: f.mw_fiscalizado }));
}

export const COLUNAS_REGIMES: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Regime de exploração", tipo: "texto" },
  { id: "regime", rotulo: "Sigla", tipo: "texto" },
  { id: "parcelas", rotulo: "Parcelas de propriedade", tipo: "numero", casas: 0 },
  { id: "mw_proporcional", rotulo: "Capacidade proporcional", tipo: "numero", unidade: "MW", casas: 1 },
];
export function linhasRegimes(a: Ativos): LinhaTabela[] {
  return a.por_regime.map((r) => ({ id: r.regime, rotulo: r.rotulo, regime: r.regime, parcelas: r.parcelas, mw_proporcional: r.mw_proporcional }));
}

export const COLUNAS_SEM_VINCULO: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "ceg", rotulo: "CEG", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "mw", rotulo: "Potência fiscalizada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "estado", rotulo: "Motivo", tipo: "texto", categorica: true },
  { id: "soma_pct", rotulo: "Soma das participações", tipo: "percentual", casas: 2 },
  { id: "proprietarios", rotulo: "CNPJ publicados", tipo: "texto" },
  { id: "mesma_raiz", rotulo: "Mesma raiz de CNPJ", tipo: "texto", categorica: true },
];
export function linhasSemVinculo(a: Ativos): LinhaTabela[] {
  return a.sem_vinculo.map((u) => ({
    id: u.nucleo,
    nome: u.nome ?? `Núcleo ${u.nucleo}`,
    ceg: u.ceg,
    tipo: u.tipo,
    uf: u.uf,
    mw: u.mw,
    estado: ROTULO_ESTADO_VINCULO[u.estado] ?? u.estado,
    soma_pct: u.soma_pct,
    proprietarios: u.proprietarios_cnpj.map(cnpjFormatado).join(", "),
    mesma_raiz: u.estado === "soma_divergente" ? (u.mesma_raiz ? "sim" : "não") : null,
  }));
}

export const COLUNAS_PROPRIETARIOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Proprietário direto", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "mw_proporcional", rotulo: "Capacidade proporcional", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_controle_direto", rotulo: "Capacidade sob controle direto", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "usinas_operacao", rotulo: "Usinas em operação com participação", tipo: "numero", casas: 0 },
  { id: "usinas_controle_direto", rotulo: "Usinas sob controle direto", tipo: "numero", casas: 0 },
  { id: "grupo", rotulo: "Grupo (topo da cadeia declarada)", tipo: "texto" },
  { id: "regimes", rotulo: "Regimes", tipo: "texto" },
  { id: "no_cadastro", rotulo: "No cadastro de agentes", tipo: "texto", categorica: true },
];
export function linhasProprietarios(ps: readonly Proprietario[]): LinhaTabela[] {
  return ps.map((p) => ({
    id: p.cnpj,
    nome: nomeOuCnpj(p.nome, p.cnpj),
    cnpj: cnpjFormatado(p.cnpj),
    mw_proporcional: p.mw_proporcional,
    mw_controle_direto: p.mw_controle_direto,
    usinas_operacao: p.usinas_operacao,
    usinas_controle_direto: p.usinas_controle_direto,
    grupo: p.grupo ? nomeOuCnpj(p.grupo_nome, p.grupo) : "o próprio proprietário é o topo",
    regimes: p.regimes.join(", "),
    no_cadastro: p.no_cadastro_agentes ? "sim" : "não",
  }));
}
/** Grupo do proprietário para filtrar o mapa: o topo declarado ou, quando ele é o topo, o próprio CNPJ. */
export function grupoDoProprietario(p: Pick<Proprietario, "cnpj" | "grupo">): string {
  return p.grupo ?? p.cnpj;
}

export const COLUNAS_TRANSMISSAO: ColunaTabela[] = [
  { id: "nome", rotulo: "Concessionária", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "km", rotulo: "Circuito em operação", tipo: "numero", unidade: "km", casas: 1 },
  { id: "pct_km", rotulo: "Do km de circuito do SIGET", tipo: "percentual", casas: 2 },
  { id: "circuitos", rotulo: "Circuitos em operação", tipo: "numero", casas: 0 },
  { id: "subestacoes", rotulo: "Subestações com equipamento", tipo: "numero", casas: 0 },
  { id: "mva", rotulo: "Transformação em operação", tipo: "numero", unidade: "MVA", casas: 0 },
  { id: "contratos", rotulo: "Contratos", tipo: "numero", casas: 0 },
  { id: "modulos", rotulo: "Módulos", tipo: "numero", casas: 0 },
  { id: "ufs", rotulo: "UF", tipo: "texto" },
  { id: "grupo", rotulo: "Grupo", tipo: "texto" },
];
export function linhasTransmissao(t: Transmissao): LinhaTabela[] {
  return t.maiores.map((a) => ({
    id: a.cnpj,
    nome: nomeOuCnpj(a.nome, a.cnpj),
    cnpj: cnpjFormatado(a.cnpj),
    km: a.km_circuito_operacao,
    pct_km: a.pct_km,
    circuitos: a.circuitos_operacao,
    subestacoes: a.subestacoes,
    mva: a.mva_transformacao_operacao,
    contratos: a.contratos,
    modulos: a.modulos,
    ufs: a.ufs.join(", "),
    grupo: a.grupo ? nomeOuCnpj(a.grupo_nome, a.grupo) : "a própria concessionária é o topo",
  }));
}

export const COLUNAS_GRUPOS_TRANSMISSAO: ColunaTabela[] = [
  { id: "nome", rotulo: "Grupo", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ do topo", tipo: "texto" },
  { id: "km", rotulo: "Circuito em operação", tipo: "numero", unidade: "km", casas: 1 },
  { id: "pct_km", rotulo: "Do km de circuito do SIGET", tipo: "percentual", casas: 2 },
  { id: "empresas", rotulo: "Concessionárias", tipo: "numero", casas: 0 },
  { id: "subestacoes", rotulo: "Subestações (união)", tipo: "numero", casas: 0 },
  { id: "mva", rotulo: "Transformação em operação", tipo: "numero", unidade: "MVA", casas: 0 },
];
export function linhasGruposTransmissao(t: Transmissao): LinhaTabela[] {
  return t.grupos.map((g) => ({
    id: g.cnpj,
    nome: nomeOuCnpj(g.nome, g.cnpj),
    cnpj: cnpjFormatado(g.cnpj),
    km: g.km_circuito_operacao,
    pct_km: g.pct_km,
    empresas: g.empresas,
    subestacoes: g.subestacoes,
    mva: g.mva_transformacao_operacao,
  }));
}

/** Conferência SIGA × Agentes de Geração em uma frase; a nota (causa não verificada) vem da gold. */
export function textoConferenciaAgentes(c: ConferenciaAgentes | null): string {
  if (!c) return "A conferência com o conjunto Agentes de Geração não está nesta publicação.";
  const pctIguais = c.comparadas > 0 ? (100 * c.iguais) / c.comparadas : null;
  return (
    `Das ${inteiro(c.comparadas)} usinas presentes no SIGA e no conjunto Agentes de Geração de ${dataTexto(c.data)}, ${inteiro(c.iguais)} (${pctTexto(pctIguais, 2)}) ` +
    `têm a mesma lista de CNPJ e os mesmos percentuais; ${inteiro(c.cnpj_diferentes)} têm CNPJ diferente e ${inteiro(c.percentual_diferente)} percentual diferente. ${c.nota}`
  );
}

/* ---------------------------------------------------------------- P036: mapa das usinas */

/** Fases do SIGA aceitas no filtro do mapa (o teste confere que a gold não publica outra). */
export const FASES_MAPA = [
  { id: "operacao", fase: "Operação", rotulo: "Em operação" },
  { id: "construcao", fase: "Construção", rotulo: "Em construção" },
  { id: "nao_iniciada", fase: "Construção não iniciada", rotulo: "Construção não iniciada" },
] as const;
export type IdFaseMapa = (typeof FASES_MAPA)[number]["id"] | "todas";

/** Tipos de usina do SIGA, com a cor de fonte do design system (a mesma em todos os gráficos). */
export const TIPOS_USINA = [
  { id: "UHE", rotulo: "Hidrelétrica (UHE)", cor: "var(--serie-hidraulica)" },
  { id: "PCH", rotulo: "Pequena central hidrelétrica (PCH)", cor: "var(--serie-hidraulica)" },
  { id: "CGH", rotulo: "Central geradora hidrelétrica (CGH)", cor: "var(--serie-hidraulica)" },
  { id: "UTE", rotulo: "Termelétrica (UTE)", cor: "var(--serie-termica)" },
  { id: "UTN", rotulo: "Termonuclear (UTN)", cor: "var(--serie-6)" },
  { id: "EOL", rotulo: "Eólica (EOL)", cor: "var(--serie-eolica)" },
  { id: "UFV", rotulo: "Solar fotovoltaica (UFV)", cor: "var(--serie-solar)" },
] as const;
export type TipoUsina = (typeof TIPOS_USINA)[number]["id"];
export const IDS_TIPOS: readonly TipoUsina[] = TIPOS_USINA.map((t) => t.id);
export function rotuloTipo(t: string | null | undefined): string {
  return TIPOS_USINA.find((x) => x.id === t)?.rotulo ?? (t || SEM_DADO);
}

/** Estado do mapa na URL (prefixo "at."): seleção e filtros criam entrada no histórico; o voltar desfaz. */
export const ESQUEMA_ATIVOS = {
  mapa: campo(tiposUrl.booleano(), false, { param: "at.mapa" }),
  fase: campo(tiposUrl.opcao(["operacao", "construcao", "nao_iniciada", "todas"] as const), "operacao" as IdFaseMapa, { param: "at.fase" }),
  tipos: campo(tiposUrl.lista(tiposUrl.opcao(IDS_TIPOS)), [] as TipoUsina[], { param: "at.tipo" }),
  vinculo: campo(tiposUrl.opcao(["todos", "sem_vinculo"] as const), "todos" as "todos" | "sem_vinculo", { param: "at.vinc" }),
  grupo: campo(leitorCnpj, "", { param: "at.g" }),
  sel: campo(tiposUrl.texto({ max: 12 }), "", { param: "at.sel" }),
};

export type FiltroAtivos = { fase: IdFaseMapa; tipos: readonly string[]; vinculo: "todos" | "sem_vinculo"; grupo: string };

export type ProjecaoMalha = { paralelos_padrao: number[]; meridiano_central: number; latitude_origem: number; unidade_svg_m: number; origem_m: [number, number] };

/**
 * Raio da esfera autálica do GRS80, o mesmo de pipeline/energia/geo.py: constante geodésica,
 * não dado. O teste confere que a malha publicada declara este raio e que as usinas caem
 * dentro da UF que o SIGA informa.
 */
export const R_AUTALICO = 6371007.181;

/**
 * Albers cônica equivalente na esfera autálica, com os parâmetros que a própria malha publica
 * (public/energia/geo/uf.json, campo projecao), na grade do SVG (origem e metros por unidade, y
 * para baixo). As coordenadas do SIGA entram como estão; nada é aproximado.
 */
export function projetar(lon: number, lat: number, p: ProjecaoMalha): [number, number] {
  const rad = Math.PI / 180;
  const [f1, f2] = [p.paralelos_padrao[0] * rad, p.paralelos_padrao[1] * rad];
  const n = (Math.sin(f1) + Math.sin(f2)) / 2;
  const c = Math.cos(f1) ** 2 + 2 * n * Math.sin(f1);
  const rho0 = (R_AUTALICO * Math.sqrt(c - 2 * n * Math.sin(p.latitude_origem * rad))) / n;
  const rho = (R_AUTALICO * Math.sqrt(c - 2 * n * Math.sin(lat * rad))) / n;
  const teta = n * (lon - p.meridiano_central) * rad;
  const x = rho * Math.sin(teta);
  const y = rho0 - rho * Math.cos(teta);
  return [(x - p.origem_m[0]) / p.unidade_svg_m, (p.origem_m[1] - y) / p.unidade_svg_m];
}

export type LinhaAtivo = {
  id: string;
  nome: string;
  tipo: string | null;
  fase: string;
  uf: string | null;
  mw: number | null;
  estado: string;
  grupo: string;
};

/** Índices das usinas do arquivo do mapa que passam no filtro (ordem do arquivo). */
export function filtrarAtivos(j: Pick<AtivosMapa, "fase" | "tipo" | "estado" | "estados" | "grupo" | "grupos">, f: FiltroAtivos): number[] {
  const fase = f.fase === "todas" ? null : FASES_MAPA.find((x) => x.id === f.fase)?.fase ?? null;
  const tipos = f.tipos.length ? new Set(f.tipos) : null;
  const iVinculado = j.estados.indexOf("vinculado");
  const iGrupo = f.grupo ? j.grupos.findIndex((g) => g[0] === f.grupo) : -1;
  const out: number[] = [];
  for (let i = 0; i < j.fase.length; i++) {
    if (fase && j.fase[i] !== fase) continue;
    if (tipos && !tipos.has(j.tipo[i] ?? "")) continue;
    if (f.vinculo === "sem_vinculo" && j.estado[i] === iVinculado) continue;
    if (f.grupo && (iGrupo < 0 || j.grupo[i] !== iGrupo)) continue;
    out.push(i);
  }
  return out;
}

/** Linhas da tabela equivalente do mapa (mesmas usinas e mesma ordem do desenho). */
export function linhasAtivos(j: AtivosMapa, indices: readonly number[]): LinhaAtivo[] {
  return indices.map((i) => {
    const g = j.grupo[i] >= 0 ? j.grupos[j.grupo[i]] : null;
    const est = j.estados[j.estado[i]];
    return {
      id: j.nucleo[i],
      nome: j.nome[i] ?? `Núcleo ${j.nucleo[i]}`,
      tipo: j.tipo[i],
      fase: j.fase[i],
      uf: j.uf[i],
      mw: j.mw[i],
      estado: ROTULO_ESTADO_VINCULO[est] ?? est,
      grupo: g ? nomeOuCnpj(g[1], g[0]) : "fora dos 200 maiores grupos ou sem grupo",
    };
  });
}

export const COLUNAS_ATIVOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "id", rotulo: "Núcleo do CEG", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "fase", rotulo: "Fase", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "mw", rotulo: "Potência", tipo: "numero", unidade: "MW", casas: 2 },
  { id: "estado", rotulo: "Vínculo", tipo: "texto", categorica: true },
  { id: "grupo", rotulo: "Grupo do proprietário majoritário", tipo: "texto" },
];

/**
 * Resumo do recorte do mapa. A potência só é somada dentro de uma fase, porque o arquivo traz
 * a potência fiscalizada em operação e a outorgada nas demais (somar as duas misturaria
 * medidas diferentes).
 */
export function resumoAtivos(linhas: readonly Pick<LinhaAtivo, "fase" | "mw">[]): { usinas: number; porFase: { fase: string; usinas: number; mw: number; semPotencia: number }[] } {
  const m = new Map<string, { fase: string; usinas: number; mw: number; semPotencia: number }>();
  for (const l of linhas) {
    const r = m.get(l.fase) ?? { fase: l.fase, usinas: 0, mw: 0, semPotencia: 0 };
    r.usinas += 1;
    if (temValor(l.mw)) r.mw += l.mw;
    else r.semPotencia += 1;
    m.set(l.fase, r);
  }
  const ordem = FASES_MAPA.map((f) => f.fase as string);
  return { usinas: linhas.length, porFase: Array.from(m.values()).sort((a, b) => ordem.indexOf(a.fase) - ordem.indexOf(b.fase)) };
}

/** Frase do recorte do mapa (aria-live): quantas usinas e quanta potência, por fase. */
export function textoResumoAtivos(r: ReturnType<typeof resumoAtivos>): string {
  if (r.usinas === 0) return "Nenhuma usina no recorte.";
  const fases = r.porFase.map((f) => {
    const medida = f.fase === "Operação" ? "fiscalizados" : "outorgados";
    return `${inteiro(f.usinas)} em ${f.fase.toLocaleLowerCase("pt-BR")} (${mwTexto(f.mw)} ${medida}${f.semPotencia ? `; ${inteiro(f.semPotencia)} sem potência publicada` : ""})`;
  });
  return `${inteiro(r.usinas)} usinas no recorte: ${fases.join("; ")}.`;
}

/** Raio do ponto pela potência (marca, não escala de área), em unidades de tela. */
export function raioPonto(mw: number | null): number {
  if (!temValor(mw)) return 1.5;
  if (mw > 300) return 4;
  if (mw > 30) return 2.6;
  return 1.6;
}
export const CLASSES_RAIO = [
  { rotulo: "até 30 MW", mw: 30 },
  { rotulo: "mais de 30 até 300 MW", mw: 300 },
  { rotulo: "mais de 300 MW", mw: 301 },
] as const;

/* ================================================================ P037: distribuidoras */

export function rotuloGrupo(g: Distribuidora["grupo"]): string {
  return g === "concessionaria" ? "Concessionária" : g === "permissionaria" ? "Permissionária" : SEM_DADO;
}

/** Resposta curta do P037: universo e presença em cada base, pelo mesmo CNPJ dos módulos de origem. */
export function respostaDistribuidoras(d: Distribuidoras): string {
  const r = d.resumo;
  return (
    `${inteiro(r.distribuidoras)} distribuidoras aparecem pelo CNPJ em ao menos uma base regulada de distribuição (${inteiro(r.ativas)} ativas; ${inteiro(r.concessionarias)} concessionárias e ${inteiro(r.permissionarias)} permissionárias). ` +
    `A ficha de cada uma reúne as perdas (${inteiro(r.com_perdas)} com registro no SAMP), a continuidade (${inteiro(r.com_qualidade)}) e a tarifa residencial vigente (${inteiro(r.com_tarifa_vigente)}), copiadas das páginas de origem pelo mesmo CNPJ; ` +
    `${inteiro(r.com_controlador_acima)} têm controlador acima delas declarado à ANEEL e ${inteiro(r.companhias_abertas)} são companhias abertas.`
  );
}

export function tarifaVigente(t: ReferenciaTarifa | null): number | null {
  return t && t.vigente ? t.total : null;
}

export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "nome", rotulo: "Razão social", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "grupo", rotulo: "Grupo", tipo: "texto", categorica: true },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "ufs", rotulo: "UF da área", tipo: "texto" },
  { id: "perdas_pct", rotulo: "Perdas totais", tipo: "percentual", casas: 2 },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite do DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite do FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "tarifa", rotulo: "Tarifa B1 vigente", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "controlador", rotulo: "Controlador no topo da cadeia", tipo: "texto" },
  { id: "cvm", rotulo: "Companhia aberta", tipo: "texto", categorica: true },
];
export function linhasDistribuidoras(ix: readonly Distribuidora[]): LinhaTabela[] {
  return ix.map((d) => ({
    id: d.slug,
    sigla: d.sigla,
    nome: d.nome,
    cnpj: cnpjFormatado(d.cnpj),
    grupo: d.grupo ? rotuloGrupo(d.grupo) : null,
    situacao: d.ativa ? "ativa" : "inativa",
    ufs: d.ufs.length ? d.ufs.join(", ") : null,
    perdas_pct: d.perdas?.taxa_total_pct ?? null,
    dec: d.qualidade?.dec ?? null,
    dec_limite: d.qualidade?.dec_limite ?? null,
    fec: d.qualidade?.fec ?? null,
    fec_limite: d.qualidade?.fec_limite ?? null,
    tarifa: tarifaVigente(d.tarifa),
    controlador: d.controle.topo ? nomeOuCnpj(d.controle.topo_nome, d.controle.topo) : "a própria distribuidora é o topo",
    cvm: d.cvm ? "sim" : "não",
  }));
}

export function entidadesDistribuidoras(ix: readonly Distribuidora[]): EntidadeBuscavel[] {
  return ix.map((d) => ({
    id: d.slug,
    rotulo: d.sigla,
    detalhe: `${d.nome ?? SEM_DADO}${d.ufs.length ? ` · ${d.ufs.join(", ")}` : ""}${d.ativa ? "" : " · inativa"}`,
    sinonimos: [d.cnpj, cnpjFormatado(d.cnpj), ...d.siglas.map((s) => s.sigla), ...d.slugs_alternativos],
  }));
}

/**
 * Comparação padrão (não gravada na URL): as quatro distribuidoras ativas com mais unidades
 * consumidoras no ano de referência da continuidade; empate pela sigla.
 */
export function padraoComparacao(ix: readonly Distribuidora[], n = LIMITE_COMPARACAO): string[] {
  return ix
    .filter((d) => d.ativa && temValor(d.qualidade?.ucs))
    .slice()
    .sort((a, b) => (b.qualidade!.ucs as number) - (a.qualidade!.ucs as number) || a.sigla.localeCompare(b.sigla, "pt-BR"))
    .slice(0, n)
    .map((d) => d.slug);
}

export type LinhaComparacao = {
  id: string;
  rotulo: string;
  perdas: number | null;
  tarifa: number | null;
  dec: number | null;
  dec_limite: number | null;
  fec: number | null;
  fec_limite: number | null;
  ano_perdas: number | null;
  ano_qualidade: number | null;
};
/** Linhas do comparador (as mesmas nas barras, nos pontos pareados e na tabela), na ordem de escolha. */
export function dadosComparacao(ix: readonly Distribuidora[], slugs: readonly string[]): LinhaComparacao[] {
  const porSlug = new Map(ix.map((d) => [d.slug, d]));
  return slugs
    .map((s) => porSlug.get(s))
    .filter((d): d is Distribuidora => !!d)
    .map((d) => ({
      id: d.slug,
      rotulo: d.sigla,
      perdas: d.perdas?.taxa_total_pct ?? null,
      tarifa: tarifaVigente(d.tarifa),
      dec: d.qualidade?.dec ?? null,
      dec_limite: d.qualidade?.dec_limite ?? null,
      fec: d.qualidade?.fec ?? null,
      fec_limite: d.qualidade?.fec_limite ?? null,
      ano_perdas: d.perdas?.ano ?? null,
      ano_qualidade: d.qualidade?.ano ?? null,
    }));
}

/**
 * Referência nacional das barras de perdas: a taxa nacional publicada pela gold de Perdas, com o
 * universo dela no rótulo, só quando o período é o mesmo ano das perdas por distribuidora (anos
 * diferentes não se comparam). Null sem ficha ou com ano diferente.
 */
export function referenciaPerdasNacional(
  ev: { valor_calculo: number | null; universo: string; periodo: { inicio?: string | null } } | null,
  anoPerdas: number | null,
): { valor: number; rotulo: string } | null {
  if (!ev || !anoPerdas || ev.valor_calculo === null || !ev.periodo.inicio?.startsWith(String(anoPerdas))) return null;
  return { valor: ev.valor_calculo, rotulo: `Brasil, ${ev.universo}` };
}

/** Anos de referência diferentes não se comparam (regra de pares da gold): o comparador avisa. */
export function avisoAnosComparacao(linhas: readonly LinhaComparacao[]): string | null {
  const anosP = new Set(linhas.map((l) => l.ano_perdas).filter(temValor));
  const anosQ = new Set(linhas.map((l) => l.ano_qualidade).filter(temValor));
  const partes: string[] = [];
  if (anosP.size > 1) partes.push(`perdas de anos diferentes (${Array.from(anosP).sort().join(", ")})`);
  if (anosQ.size > 1) partes.push(`continuidade de anos diferentes (${Array.from(anosQ).sort().join(", ")})`);
  return partes.length ? `Atenção: o recorte mistura ${partes.join(" e ")}; esses números não se comparam entre si.` : null;
}

/** Sentido de um valor diante do limite, decidido na precisão exibida (2 casas). */
export function sentidoLimite(valor: number | null | undefined, limite: number | null | undefined, casas = 2): "acima" | "abaixo" | "igual" | null {
  if (!temValor(valor) || !temValor(limite)) return null;
  const f = 10 ** casas;
  const a = Math.round(valor * f);
  const b = Math.round(limite * f);
  return a > b ? "acima" : a < b ? "abaixo" : "igual";
}

/** "o DEC foi de 8,98 horas, abaixo do limite de 9,50"; ausência é dita ("o DEC ficou sem dado"). */
function fraseLimite(medida: string, valor: number | null, limite: number | null, unidade: string): string {
  if (!temValor(valor)) return `${medida} ficou sem dado`;
  const s = sentidoLimite(valor, limite);
  const v = `${num(valor, 2)} ${unidade}`;
  if (s === null) return `${medida} foi de ${v} (limite sem dado)`;
  if (s === "igual") return `${medida} foi de ${v}, igual ao limite`;
  return `${medida} foi de ${v}, ${s} do limite de ${num(limite as number, 2)}`;
}

/**
 * Resposta curta da ficha: perdas, continuidade diante do limite e tarifa vigente (ou o motivo da
 * falta). Cada parte diz o próprio período; ausência é dita, nunca preenchida.
 */
export function respostaFicha(d: Distribuidora): string {
  const partes: string[] = [];
  const p = d.perdas;
  if (p && temValor(p.taxa_total_pct) && p.ano) {
    const incompleto = p.completo === false ? " (ano incompleto no SAMP)" : "";
    if (p.taxa_total_pct < 0) {
      // perda negativa: a energia fornecida superou a injetada; o valor é o publicado, sem causa afirmada
      partes.push(
        `Em ${p.ano}, a ${d.sigla} registrou perda total negativa, de ${pct(p.taxa_total_pct, 2)} da energia injetada na rede${incompleto}: a energia fornecida superou a injetada. O valor é o que consta no SAMP e a página não o corrige nem explica a causa.`,
      );
    } else {
      partes.push(`Em ${p.ano}, a ${d.sigla} perdeu ${pct(p.taxa_total_pct, 2)} da energia injetada na rede${incompleto}.`);
    }
  } else if (p) {
    partes.push(`A ${d.sigla} não tem perdas no ano de referência do SAMP; o último mês com registro é ${p.ultima_competencia ? dataBR(p.ultima_competencia) : SEM_DADO}.`);
  } else {
    partes.push(`A ${d.sigla} não aparece no SAMP.`);
  }
  const q = d.qualidade;
  if (q && q.ano) {
    partes.push(`Na continuidade de ${q.ano}, ${fraseLimite("o DEC", q.dec, q.dec_limite, "horas")}, e ${fraseLimite("o FEC", q.fec, q.fec_limite, "interrupções")}.`);
  } else {
    partes.push("Não há indicadores de continuidade publicados para ela no ano de referência.");
  }
  const t = d.tarifa;
  if (t && t.vigente) {
    partes.push(`A tarifa residencial B1 vigente desde ${dataTexto(t.inicio)} é de ${temValor(t.total) ? `R$ ${num(t.total, 2)}/MWh` : SEM_DADO}, sem tributos (${t.ato ?? "ato sem número publicado"}).`);
  } else if (t && !t.vigente) {
    partes.push(`Não há tarifa residencial vigente: ${t.motivo ?? "motivo não publicado"}.`);
  } else {
    partes.push("Ela não aparece nas tarifas de aplicação.");
  }
  return partes.join(" ");
}

export type Pares = {
  regra: string;
  ano: number;
  total: number;
  posicao: number;
  itens: { id: string; rotulo: string; valor: number; referencia: number | null }[];
};

/**
 * Pares nas perdas: mesmo grupo (concessionária ou permissionária) e mesmo ano de referência, com
 * taxa publicada. Posição = 1 + quantas têm taxa menor (empates ficam na mesma posição).
 */
export function paresPerdas(d: Distribuidora, ix: readonly Distribuidora[]): Pares | null {
  const v = d.perdas?.taxa_total_pct;
  const ano = d.perdas?.ano;
  if (!d.grupo || !temValor(v) || !ano) return null;
  const pares = ix.filter((x) => x.grupo === d.grupo && x.perdas?.ano === ano && temValor(x.perdas.taxa_total_pct));
  const itens = pares
    .map((x) => ({ id: x.slug, rotulo: x.sigla, valor: x.perdas!.taxa_total_pct as number, referencia: null }))
    .sort((a, b) => a.valor - b.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return {
    regra: `${d.grupo === "concessionaria" ? "concessionárias" : "permissionárias"} com taxa de perdas em ${ano}`,
    ano,
    total: itens.length,
    posicao: 1 + itens.filter((x) => x.valor < v).length,
    itens,
  };
}

/** Pares na continuidade: mesmo grupo e, quando a ANEEL publica o porte do ranking, o mesmo porte. Posição pelo DEC. */
export function paresQualidade(d: Distribuidora, ix: readonly Distribuidora[]): Pares | null {
  const q = d.qualidade;
  if (!d.grupo || !q || !q.ano || !temValor(q.dec)) return null;
  const pares = ix.filter(
    (x) => x.grupo === d.grupo && x.qualidade?.ano === q.ano && temValor(x.qualidade.dec) && (q.porte ? x.qualidade.porte === q.porte : true),
  );
  const itens = pares
    .map((x) => ({ id: x.slug, rotulo: x.sigla, valor: x.qualidade!.dec as number, referencia: x.qualidade!.dec_limite }))
    .sort((a, b) => a.valor - b.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const grupo = d.grupo === "concessionaria" ? "concessionárias" : "permissionárias";
  return {
    regra: `${grupo}${q.porte ? ` de porte ${q.porte} no ranking da ANEEL` : ""} com DEC em ${q.ano}`,
    ano: q.ano,
    total: itens.length,
    posicao: 1 + itens.filter((x) => x.valor < (q.dec as number)).length,
    itens,
  };
}

export function textoPares(sigla: string, medida: string, p: Pares | null): string {
  if (!p) return `Sem pares comparáveis para ${medida}: falta o grupo, o ano de referência ou o valor.`;
  return `Entre as ${inteiro(p.total)} ${p.regra}, a ${sigla} ocupa a posição ${posicaoTexto(p.posicao, p.total)} em ordem crescente de ${medida}.`;
}

/* ---------------------------------------------------------------- P037: evolução própria */

export type PontoPerdas = { ano: string; taxa_completo: number | null; taxa_parcial: number | null; meses: number | null; completo: "sim" | "não"; pnt_bt_pct: number | null };

/**
 * Série anual de perdas da gold de Perdas para um CNPJ (linhas na ordem de `campos`). Ano
 * incompleto (meses < 12) fica numa série própria, tracejada, fora da comparação com anos
 * completos (seção 11.6).
 */
export function evolucaoPerdas(linhas: readonly (readonly unknown[])[] | undefined, campos: readonly string[]): PontoPerdas[] {
  if (!linhas) return [];
  const i = (c: string) => campos.indexOf(c);
  const [iAno, iMeses, iCompleto, iTaxa, iPnt] = [i("ano"), i("meses"), i("completo"), i("taxa_total_pct"), i("pnt_bt_pct")];
  if (iAno < 0 || iTaxa < 0) return [];
  return linhas.map((l) => {
    const taxa = typeof l[iTaxa] === "number" ? (l[iTaxa] as number) : null;
    const completo = iCompleto >= 0 ? l[iCompleto] === 1 || l[iCompleto] === true : true;
    return {
      ano: String(l[iAno]),
      taxa_completo: completo ? taxa : null,
      taxa_parcial: completo ? null : taxa,
      meses: iMeses >= 0 && typeof l[iMeses] === "number" ? (l[iMeses] as number) : null,
      completo: completo ? "sim" : "não",
      pnt_bt_pct: iPnt >= 0 && typeof l[iPnt] === "number" ? (l[iPnt] as number) : null,
    };
  });
}

/**
 * Acrescenta a cada ano a taxa nacional das concessionárias publicada pela gold de Perdas
 * (referência do gráfico), só em ano completo nas duas séries; ano parcial nacional não entra
 * (ausência, nunca o último valor repetido).
 */
export function comReferenciaNacional(
  pontos: readonly PontoPerdas[],
  nacional: readonly { ano: number; parcial: boolean; taxa_total_pct: number | null; universo?: string }[],
): (PontoPerdas & { brasil: number | null })[] {
  const ref = new Map(nacional.filter((n) => !n.parcial && (n.universo ?? "concessionarias") === "concessionarias").map((n) => [String(n.ano), n.taxa_total_pct]));
  return pontos.map((p) => ({ ...p, brasil: p.completo === "sim" ? (ref.get(p.ano) ?? null) : null }));
}

export type PontoQualidade = { ano: string; dec: number | null; dec_limite: number | null; fec: number | null; fec_limite: number | null };
export function evolucaoQualidade(s: { anos: number[]; dec: (number | null)[]; fec: (number | null)[]; dec_limite: (number | null)[]; fec_limite: (number | null)[] } | undefined): PontoQualidade[] {
  if (!s) return [];
  return s.anos.map((a, k) => ({ ano: String(a), dec: s.dec[k] ?? null, dec_limite: s.dec_limite[k] ?? null, fec: s.fec[k] ?? null, fec_limite: s.fec_limite[k] ?? null }));
}

export type PontoTarifa = { inicio: string; fim: string; ato: string; te: number | null; tusd: number | null; total: number | null };
export function evolucaoTarifa(vigencias: readonly (readonly unknown[])[] | undefined, campos: readonly string[]): PontoTarifa[] {
  if (!vigencias) return [];
  const i = (c: string) => campos.indexOf(c);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return vigencias.map((v) => ({
    inicio: String(v[i("inicio")]),
    fim: String(v[i("fim")]),
    ato: String(v[i("ato")] ?? ""),
    te: n(v[i("te")]),
    tusd: n(v[i("tusd")]),
    total: n(v[i("total")]),
  }));
}

export const COLUNAS_EVOLUCAO_PERDAS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "taxa_completo", rotulo: "Perdas totais, ano completo", tipo: "percentual", casas: 2 },
  { id: "taxa_parcial", rotulo: "Perdas totais, ano incompleto", tipo: "percentual", casas: 2 },
  { id: "meses", rotulo: "Meses no SAMP", tipo: "numero", casas: 0 },
  { id: "completo", rotulo: "Ano completo", tipo: "texto", categorica: true },
  { id: "pnt_bt_pct", rotulo: "Não técnicas sobre o mercado de baixa tensão", tipo: "percentual", casas: 2 },
  { id: "brasil", rotulo: "Referência: concessionárias do Brasil", tipo: "percentual", casas: 2 },
];
export const COLUNAS_EVOLUCAO_QUALIDADE: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite do DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite do FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
];
export const COLUNAS_EVOLUCAO_TARIFA: ColunaTabela[] = [
  { id: "inicio", rotulo: "Início da vigência", tipo: "data" },
  { id: "fim", rotulo: "Fim da vigência", tipo: "data" },
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "te", rotulo: "TE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "tusd", rotulo: "TUSD", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "total", rotulo: "Total", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

/** Entidade da rota dinâmica: slug principal ou slug alternativo (rota de apoio que aponta para o principal). */
export function resolverEntidade(ix: readonly Distribuidora[], slug: string): { dist: Distribuidora; principal: boolean } | null {
  const p = ix.find((d) => d.slug === slug);
  if (p) return { dist: p, principal: true };
  const a = ix.find((d) => d.slugs_alternativos.includes(slug));
  return a ? { dist: a, principal: false } : null;
}

export function slugsEstaticos(ix: readonly Distribuidora[]): string[] {
  return ix.flatMap((d) => [d.slug, ...d.slugs_alternativos]);
}

/** Endereços nas páginas de origem com a distribuidora já escolhida (mesmo CNPJ, mesmos parâmetros dessas páginas). */
export function linksOrigem(d: Pick<Distribuidora, "cnpj" | "perdas" | "qualidade" | "tarifa">): { rotulo: string; href: string }[] {
  const out: { rotulo: string; href: string }[] = [];
  if (d.perdas) out.push({ rotulo: "Perdas, com o mapa por conjunto e município", href: `/setor-eletrico/perdas?d=${d.cnpj}` });
  if (d.qualidade) out.push({ rotulo: "Qualidade do serviço, com os conjuntos elétricos", href: `/setor-eletrico/qualidade?dist=${d.cnpj}` });
  if (d.tarifa) out.push({ rotulo: "Conta de luz, com o histórico tarifário", href: `/setor-eletrico/conta-de-luz?dist=${d.cnpj}` });
  return out;
}

/* ================================================================ P038: finanças */

export const ROTULO_ALERTA: Readonly<Record<string, string>> = {
  consolidado_nao_apresentado: "consolidado não apresentado (exibido o individual)",
  inicio_inconsistente_na_fonte: "data de início inconsistente na fonte (exercício aceito com nota)",
  escala_corrigida: "escala convertida pelo observatório (estimado)",
  fluxos_nao_preenchidos: "DRE e DFC não preenchidas (ausentes)",
  dre_zerada_na_fonte: "DRE zerada na fonte, sem prova de não preenchimento",
};

export function rotuloEscopo(e: EscopoCvm | null): string {
  return e === "con" ? "consolidado" : e === "ind" ? "individual" : SEM_DADO;
}

/** Resposta curta do P038: universo, períodos e revisões, com a cobertura dita (não é o setor inteiro). */
export function respostaFinancas(f: Financas): string {
  const u = f.universo;
  const p = f.periodos;
  const e = f.exclusoes.escala;
  return (
    `${inteiro(u.companhias)} companhias abertas do setor elétrico estão no cadastro da CVM (${inteiro(u.ativas)} ativas); ${inteiro(u.com_dfp)} têm demonstrações anuais (DFP), até o exercício de ${p.ultimo_exercicio ?? SEM_DADO}, e ${inteiro(u.com_itr)} têm informações trimestrais (ITR), até ${dataTexto(p.ultimo_trimestre)}. ` +
    `${inteiro(f.revisoes.valores_reapresentados)} valores foram reapresentados pela própria companhia no ano seguinte, e ${inteiro(e.valores_corrigidos)} tiveram a escala convertida pelo observatório. ${u.nota_cobertura}`
  );
}

export const COLUNAS_COMPANHIAS: ColunaTabela[] = [
  { id: "nome", rotulo: "Companhia", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "situacao", rotulo: "Situação na CVM", tipo: "texto", categorica: true },
  { id: "setor", rotulo: "Setor declarado", tipo: "texto", categorica: true },
  { id: "ultimo_exercicio", rotulo: "Último exercício", tipo: "texto", categorica: true },
  { id: "escopo", rotulo: "Escopo exibido", tipo: "texto", categorica: true },
  { id: "receita", rotulo: "Receita", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "ebit", rotulo: "Resultado antes do financeiro e dos tributos", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "lucro_liquido", rotulo: "Lucro líquido", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "divida_bruta", rotulo: "Dívida bruta", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "patrimonio_liquido", rotulo: "Patrimônio líquido", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "ativo_total", rotulo: "Ativo total", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "caixa_investimento", rotulo: "Caixa das atividades de investimento", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "alertas", rotulo: "Avisos", tipo: "texto" },
  { id: "controladora", rotulo: "Controladora aberta (consolida esta)", tipo: "texto" },
  { id: "reapresentados", rotulo: "Valores reapresentados", tipo: "numero", casas: 0 },
];
export function linhasCompanhias(cs: readonly Companhia[]): LinhaTabela[] {
  return cs.map((c) => {
    const v = c.valores;
    return {
      id: c.cnpj,
      nome: nomeOuCnpj(c.nome, c.cnpj),
      cnpj: cnpjFormatado(c.cnpj),
      situacao: c.situacao,
      setor: c.setor,
      ultimo_exercicio: c.ultimo_exercicio === null ? null : String(c.ultimo_exercicio),
      escopo: c.escopo_exibido ? rotuloEscopo(c.escopo_exibido) : null,
      receita: emMilhoes(v?.receita),
      ebit: emMilhoes(v?.ebit),
      lucro_liquido: emMilhoes(v?.lucro_liquido),
      divida_bruta: emMilhoes(v?.divida_bruta),
      patrimonio_liquido: emMilhoes(v?.patrimonio_liquido),
      ativo_total: emMilhoes(v?.ativo_total),
      caixa_investimento: emMilhoes(v?.caixa_investimento),
      alertas: c.alertas.length ? c.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ") : null,
      controladora: c.controladora_aberta ? nomeOuCnpj(c.controladora_aberta.nome, c.controladora_aberta.cnpj) : null,
      reapresentados: c.valores_reapresentados,
    };
  });
}

export function entidadesCompanhias(cs: readonly Companhia[]): EntidadeBuscavel[] {
  return cs.map((c) => ({
    id: c.cnpj,
    rotulo: nomeOuCnpj(c.nome, c.cnpj),
    detalhe: `${c.situacao ?? SEM_DADO}${c.ultimo_exercicio ? ` · DFP até ${c.ultimo_exercicio}` : " · sem DFP"}`,
    sinonimos: [c.cnpj, cnpjFormatado(c.cnpj), ...(c.cd_cvm ? [c.cd_cvm] : []), ...(c.distribuidora_slug ? [c.distribuidora_slug] : [])],
  }));
}

/**
 * Companhia padrão do gráfico (não gravada na URL): a de maior ativo total no último exercício
 * entre as ativas que não têm controladora aberta acima (o topo não é consolidado por outra
 * companhia exibida). Empate pelo CNPJ.
 */
export function padraoFinancas(cs: readonly Companhia[]): string[] {
  const c = cs
    .filter((x) => x.situacao === "ATIVO" && !x.controladora_aberta && temValor(x.valores?.ativo_total))
    .slice()
    .sort((a, b) => (b.valores!.ativo_total as number) - (a.valores!.ativo_total as number) || a.cnpj.localeCompare(b.cnpj))[0];
  return c ? [c.cnpj] : [];
}

export const ESCOPOS = ["con", "ind"] as const;
export const FREQUENCIAS = ["anual", "trimestral"] as const;
export type Frequencia = (typeof FREQUENCIAS)[number];

export const ROTULO_RECORTE: Readonly<Record<string, string>> = {
  trimestre: "valor do trimestre (três meses)",
  acumulado_no_ano: "acumulado desde janeiro",
  saldo: "saldo no fim do trimestre",
};

export type DadosFinancas = {
  linhas: Record<string, string | number | null>[];
  /** CNPJ com ao menos um valor no recorte. */
  comDados: string[];
  /** Recorte do ITR ("trimestre", "acumulado_no_ano", "saldo"); null no anual. */
  recorte: string | null;
};

/**
 * Linhas do gráfico e da tabela de finanças: uma linha por exercício (ou fim de trimestre) e uma
 * coluna por CNPJ escolhido, em R$ milhões como o arquivo publica. Ausência fica null (lacuna na
 * linha), nunca zero; período em que nenhuma escolhida tem valor não entra.
 */
export function dadosFinancas(series: SeriesFinanceiras["series"], cnpjs: readonly string[], escopo: EscopoCvm, conta: ContaCvm, freq: Frequencia): DadosFinancas {
  const mapa = new Map<string, Record<string, string | number | null>>();
  const comDados: string[] = [];
  let recorte: string | null = null;
  for (const c of cnpjs) {
    const s = series[c];
    if (!s) continue;
    let pontos: [string, number | null][] = [];
    if (freq === "anual") {
      pontos = (s.anual[escopo]?.[conta] ?? []).map(([a, v]) => [String(a), v]);
    } else {
      const tri = s.trimestral[escopo] ?? {};
      const chave = Object.keys(tri).find((k) => k.split(":")[0] === conta);
      if (chave) {
        recorte = chave.split(":")[1] ?? null;
        pontos = tri[chave];
      }
    }
    if (pontos.some(([, v]) => temValor(v))) comDados.push(c);
    for (const [x, v] of pontos) {
      const l = mapa.get(x) ?? { x };
      l[c] = v;
      mapa.set(x, l);
    }
  }
  const linhas = Array.from(mapa.values())
    .filter((l) => cnpjs.some((c) => temValor(l[c] as number | null)))
    .map((l) => {
      for (const c of cnpjs) if (!(c in l)) l[c] = null;
      return l;
    })
    .sort((a, b) => String(a.x).localeCompare(String(b.x)));
  return { linhas, comDados, recorte: freq === "anual" ? null : recorte };
}

/**
 * Frase da companhia: último exercício, escopo e os principais números, com os avisos e a regra
 * de não somar com a controladora. Todo número vem da gold.
 */
export function textoCompanhia(c: Companhia, contas: readonly DefinicaoConta[]): string {
  const nome = nomeOuCnpj(c.nome, c.cnpj);
  if (!c.valores || !c.ultimo_exercicio) return `${nome} não tem demonstração anual (DFP) no período lido; só aparece no cadastro${c.ultimo_trimestre ? ` e nas informações trimestrais até ${dataTexto(c.ultimo_trimestre)}` : ""}.`;
  const v = c.valores;
  const rot = (id: ContaCvm) => contas.find((x) => x.id === id)?.rotulo.toLocaleLowerCase("pt-BR") ?? id;
  const partes = [
    `No exercício de ${c.ultimo_exercicio}, ${nome} (${rotuloEscopo(c.escopo_exibido)}) reportou receita de ${reaisEscala(v.receita)}, lucro líquido de ${reaisEscala(v.lucro_liquido)} e ${rot("caixa_investimento")} de ${reaisEscala(v.caixa_investimento)}; no fim do exercício, a dívida bruta era de ${reaisEscala(v.divida_bruta)} e o patrimônio líquido de ${reaisEscala(v.patrimonio_liquido)}.`,
  ];
  if (c.alertas.length) partes.push(`Avisos: ${c.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ")}.`);
  if (c.controladora_aberta) partes.push(`A controladora aberta ${nomeOuCnpj(c.controladora_aberta.nome, c.controladora_aberta.cnpj)} já consolida estes números: os dois não se somam.`);
  if (c.controla_abertas.length) partes.push(`Ela consolida ${plural(c.controla_abertas.length, "outra companhia aberta do universo", "outras companhias abertas do universo")}; os números não se somam.`);
  return partes.join(" ");
}

function plural(n: number, um: string, varios: string): string {
  return `${num(n, 0)} ${n === 1 ? um : varios}`;
}

export const IDS_CONTAS: readonly ContaCvm[] = [
  "receita",
  "ebit",
  "lucro_liquido",
  "lucro_controladores",
  "ativo_total",
  "caixa",
  "emprestimos_cp",
  "emprestimos_lp",
  "patrimonio_liquido",
  "caixa_operacional",
  "caixa_investimento",
  "divida_bruta",
];

/** Contas oferecidas no gráfico: as definidas na gold (rótulo e tipo publicados), na ordem publicada. */
export function contasGrafico(contas: readonly DefinicaoConta[]): { id: ContaCvm; rotulo: string; tipo: "fluxo" | "saldo"; codigo: string }[] {
  return contas.filter((c) => IDS_CONTAS.includes(c.id)).map((c) => ({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, codigo: c.codigo }));
}

/** Resumo por CNPJ para os números de destaque das finanças (nome, exercício, escopo e avisos). */
export function resumoCompanhias(cs: readonly Companhia[]): Record<string, { nome: string; exercicio: number | null; escopo: EscopoCvm | null; alertas: string[] }> {
  return Object.fromEntries(cs.map((c) => [c.cnpj, { nome: nomeOuCnpj(c.nome, c.cnpj), exercicio: c.ultimo_exercicio, escopo: c.escopo_exibido, alertas: c.alertas }]));
}

export const COLUNAS_CONTAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Conta", tipo: "texto" },
  { id: "codigo", rotulo: "Código no plano padronizado", tipo: "texto" },
  { id: "demonstracao", rotulo: "Demonstração", tipo: "texto", categorica: true },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "definicao", rotulo: "Definição", tipo: "texto" },
];
export function linhasContas(contas: readonly DefinicaoConta[]): LinhaTabela[] {
  return contas.map((c) => ({ id: c.id, rotulo: c.rotulo, codigo: c.codigo, demonstracao: c.demonstracao, tipo: c.tipo === "fluxo" ? "fluxo do período" : "saldo no fim do período", definicao: c.definicao }));
}

export const COLUNAS_NAO_APRESENTADAS: ColunaTabela[] = [
  { id: "companhia", rotulo: "Companhia", tipo: "texto" },
  { id: "documento", rotulo: "Documento", tipo: "texto", categorica: true },
  { id: "escopo", rotulo: "Escopo", tipo: "texto", categorica: true },
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "motivo", rotulo: "Motivo", tipo: "texto", categorica: true },
];
export function linhasNaoApresentadas(f: Financas): LinhaTabela[] {
  const nomes = new Map(f.companhias.map((c) => [c.cnpj, nomeOuCnpj(c.nome, c.cnpj)]));
  return f.exclusoes.colunas_nao_apresentadas.exercicio_ou_trimestre.map((x) => ({
    id: `${x.cnpj}|${x.escopo}|${x.data}|${x.documento}`,
    companhia: nomes.get(x.cnpj) ?? `CNPJ ${cnpjFormatado(x.cnpj)}`,
    documento: x.documento,
    escopo: rotuloEscopo(x.escopo),
    data: x.data,
    motivo: x.motivo === "escopo_nao_apresentado" ? "escopo não apresentado (o outro escopo tem ativo)" : "demonstração zerada nos dois escopos",
  }));
}

export const COLUNAS_SALTOS: ColunaTabela[] = [
  { id: "companhia", rotulo: "Companhia", tipo: "texto" },
  { id: "escopo", rotulo: "Escopo", tipo: "texto" },
  { id: "de", rotulo: "Ativo antes", tipo: "numero", unidade: "R$ milhões", casas: 3 },
  { id: "para", rotulo: "Ativo depois", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "razao", rotulo: "Razão", tipo: "numero", casas: 0 },
];
export function linhasSaltos(f: Financas): LinhaTabela[] {
  const nomes = new Map(f.companhias.map((c) => [c.cnpj, nomeOuCnpj(c.nome, c.cnpj)]));
  return f.exclusoes.saltos_ativo.casos.map((x, i) => ({
    id: `${x.cnpj}|${x.escopo}|${i}`,
    companhia: nomes.get(x.cnpj) ?? `CNPJ ${cnpjFormatado(x.cnpj)}`,
    escopo: rotuloEscopo(x.escopo),
    de: emMilhoes(x.de),
    para: emMilhoes(x.para),
    razao: x.razao,
  }));
}

/** Estado do painel de finanças na URL (prefixo "fin."). */
export function esquemaFinancas(padrao: readonly string[]) {
  return {
    sel: campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), [...padrao], { param: "fin.sel" }),
    conta: campo(tiposUrl.opcao(IDS_CONTAS), "receita" as ContaCvm, { param: "fin.conta" }),
    escopo: campo(tiposUrl.opcao(ESCOPOS), "con" as EscopoCvm, { param: "fin.esc" }),
    freq: campo(tiposUrl.opcao(FREQUENCIAS), "anual" as Frequencia, { param: "fin.freq" }),
  };
}

/* ================================================================ P039: controle e concentração */

export const ROTULO_FAIXA: Readonly<Record<FaixaHhi, string>> = {
  nao_concentrado: "não concentrado",
  moderado: "moderadamente concentrado",
  alto: "altamente concentrado",
};

/**
 * Limiares das faixas descritivas do HHI no Guia para Análise de Atos de Concentração Horizontal do
 * CADE (2016), conferido no PDF oficial pelo pipeline (documento do módulo, seção 2). São
 * referência de leitura, não dado: a faixa de cada valor vem calculada da gold, e o teste confere
 * que estes limiares são os mesmos do catálogo de métricas e que classificam igual à gold.
 */
export const LIMIARES_HHI_CADE = { moderado: 1500, alto: 2500 } as const;

export const ROTULO_NIVEL: Readonly<Record<"proprietario_direto" | "grupo_proporcional" | "grupo_controle", string>> = {
  proprietario_direto: "Proprietário direto (capacidade proporcional)",
  grupo_proporcional: "Grupo de controle (capacidade proporcional)",
  grupo_controle: "Grupo de controle (capacidade sob controle)",
};

/** Resposta curta do P039: HHI e CR por grupo sobre a fronteira explícita, o maior grupo e a cobertura do grafo. */
export function respostaControle(c: Controle): string {
  const g = c.concentracao.grupo_proporcional;
  const f = c.fronteira;
  const maior = g?.maiores[0];
  const partes = [
    `Na fronteira de ${mwTexto(f.mw)} em ${inteiro(f.usinas)} usinas em operação (SIGA de ${dataTexto(f.data)}), os grupos de controle declarados à ANEEL somam um HHI de ${numTexto(g?.hhi, 0)} pontos pela capacidade proporcional${g?.faixa ? `, ${ROTULO_FAIXA[g.faixa]} nas faixas do Guia do CADE` : ""}; os 4 maiores grupos têm ${pctTexto(g?.cr4, 2)} da potência e os 10 maiores, ${pctTexto(g?.cr10, 2)}.`,
  ];
  if (maior) partes.push(`O maior é ${nomeOuCnpj(maior.nome, maior.cnpj)}, com ${pctTexto(maior.pct, 2)}.`);
  partes.push(
    `${pctTexto(c.cobertura.pct_mw_consolidado_em_grupo, 2)} da capacidade proporcional está em proprietários com um grupo declarado acima deles; nos demais, o próprio proprietário é o topo da cadeia.`,
  );
  return partes.join(" ");
}

export const COLUNAS_NIVEIS: ColunaTabela[] = [
  { id: "nivel", rotulo: "Nível", tipo: "texto" },
  { id: "hhi", rotulo: "HHI", tipo: "numero", unidade: "pontos", casas: 1 },
  { id: "faixa", rotulo: "Faixa (Guia do CADE)", tipo: "texto" },
  { id: "cr4", rotulo: "CR4", tipo: "percentual", casas: 2 },
  { id: "cr10", rotulo: "CR10", tipo: "percentual", casas: 2 },
  { id: "participantes", rotulo: "Participantes", tipo: "numero", casas: 0 },
  { id: "maior", rotulo: "Maior participante", tipo: "texto" },
  { id: "maior_pct", rotulo: "Cota do maior", tipo: "percentual", casas: 2 },
];
export function linhasNiveis(cc: Controle["concentracao"]): LinhaTabela[] {
  const niveis = ["proprietario_direto", "grupo_proporcional", "grupo_controle"] as const;
  return niveis
    .map((id) => [id, cc[id]] as const)
    .filter((x): x is readonly [(typeof niveis)[number], Concentracao] => !!x[1])
    .map(([id, c]) => ({
      id,
      nivel: ROTULO_NIVEL[id],
      hhi: c.hhi,
      faixa: c.faixa ? ROTULO_FAIXA[c.faixa] : null,
      cr4: c.cr4,
      cr10: c.cr10,
      participantes: c.participantes,
      maior: c.maiores[0] ? nomeOuCnpj(c.maiores[0].nome, c.maiores[0].cnpj) : null,
      maior_pct: c.maiores[0]?.pct ?? null,
    }));
}

export const COLUNAS_TIPOS: ColunaTabela[] = [
  { id: "tipo", rotulo: "Tipo de usina", tipo: "texto" },
  { id: "mw", rotulo: "Potência na fronteira", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "hhi", rotulo: "HHI por grupo", tipo: "numero", unidade: "pontos", casas: 1 },
  { id: "faixa", rotulo: "Faixa (Guia do CADE)", tipo: "texto", categorica: true },
  { id: "cr4", rotulo: "CR4 por grupo", tipo: "percentual", casas: 2 },
  { id: "participantes", rotulo: "Grupos", tipo: "numero", casas: 0 },
  { id: "maior", rotulo: "Maior grupo", tipo: "texto" },
  { id: "maior_pct", rotulo: "Cota do maior", tipo: "percentual", casas: 2 },
];
export function linhasTipos(ts: readonly ConcentracaoTipo[]): LinhaTabela[] {
  return ts.map((t) => ({
    id: t.tipo,
    tipo: rotuloTipo(t.tipo),
    mw: t.mw,
    hhi: t.hhi_grupo,
    faixa: t.faixa ? ROTULO_FAIXA[t.faixa] : null,
    cr4: t.cr4_grupo,
    participantes: t.participantes,
    maior: t.maior ? nomeOuCnpj(t.maior.nome, t.maior.cnpj) : null,
    maior_pct: t.maior?.pct ?? null,
  }));
}

/** Frase do recorte por tipo: o de maior HHI e quantos grupos tem (sem afirmar causa). */
export function textoTipos(ts: readonly ConcentracaoTipo[]): string {
  const validos = ts.filter((t) => temValor(t.hhi_grupo));
  if (!validos.length) return "Sem HHI por tipo de usina nesta publicação.";
  const maior = validos.slice().sort((a, b) => (b.hhi_grupo as number) - (a.hhi_grupo as number))[0];
  const menor = validos.slice().sort((a, b) => (a.hhi_grupo as number) - (b.hhi_grupo as number))[0];
  return (
    `Por tipo de usina, o HHI por grupo vai de ${numTexto(menor.hhi_grupo, 0)} pontos (${rotuloTipo(menor.tipo)}, ${inteiro(menor.participantes)} grupos) a ${numTexto(maior.hhi_grupo, 0)} pontos ` +
    `(${rotuloTipo(maior.tipo)}, ${plural(maior.participantes, "grupo", "grupos")}).`
  );
}

export const ROTULO_MOTIVO: Readonly<Record<MotivoParada, string>> = {
  sem_declaracao: "sem declaração na janela",
  ambigua: "declarações discordantes",
  sem_controlador: "nenhum sócio controlador",
  compartilhado: "controle compartilhado",
  pessoa_fisica: "controlador pessoa física",
  sem_cnpj: "controlador sem CNPJ",
  ciclo: "ciclo na cadeia",
};

export const COLUNAS_GRUPOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Grupo (topo da cadeia)", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "mw_proporcional", rotulo: "Capacidade proporcional", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "participacao_pct", rotulo: "Da fronteira", tipo: "percentual", casas: 2 },
  { id: "mw_controle", rotulo: "Capacidade sob controle", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "usinas_controle", rotulo: "Usinas sob controle", tipo: "numero", casas: 0 },
  { id: "empresas_com_usinas", rotulo: "Empresas do grupo com usinas", tipo: "numero", casas: 0 },
  { id: "motivo", rotulo: "Por que a cadeia para aqui", tipo: "texto", categorica: true },
  { id: "acima", rotulo: "Acima do topo (sem CNPJ)", tipo: "texto" },
  { id: "listada", rotulo: "Companhia aberta", tipo: "texto", categorica: true },
];
export function linhasGrupos(gs: readonly Grupo[]): LinhaTabela[] {
  return gs.map((g) => ({
    id: g.cnpj,
    nome: nomeOuCnpj(g.nome, g.cnpj),
    cnpj: cnpjFormatado(g.cnpj),
    mw_proporcional: g.mw_proporcional,
    participacao_pct: g.participacao_pct,
    mw_controle: g.mw_controle,
    usinas_controle: g.usinas_controle,
    empresas_com_usinas: g.empresas_com_usinas,
    motivo: ROTULO_MOTIVO[g.motivo_parada] ?? g.motivo_parada,
    acima: g.acima,
    listada: g.listada_cvm ? "sim" : "não",
  }));
}

/** Barras dos maiores grupos (as mesmas linhas da tabela, só as primeiras n), proporcional e sob controle lado a lado. */
export function barrasGrupos(gs: readonly Grupo[], n = 12): { id: string; rotulo: string; mw_proporcional: number | null; mw_controle: number | null }[] {
  return gs.slice(0, n).map((g) => ({ id: g.cnpj, rotulo: nomeOuCnpj(g.nome, g.cnpj), mw_proporcional: g.mw_proporcional, mw_controle: g.mw_controle }));
}

export const COLUNAS_MOTIVOS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Por que a cadeia para", tipo: "texto" },
  { id: "proprietarios", rotulo: "Proprietários diretos", tipo: "numero", casas: 0 },
];
export function linhasMotivos(c: Controle["cobertura"]): LinhaTabela[] {
  return c.motivos_parada.map((m) => ({ id: m.motivo, rotulo: m.rotulo, proprietarios: m.proprietarios }));
}

export const COLUNAS_PERIODOS_POLIMERO: ColunaTabela[] = [
  { id: "trimestre", rotulo: "Trimestre", tipo: "texto" },
  { id: "declarantes", rotulo: "Agentes declarantes", tipo: "numero", casas: 0 },
];
export function linhasPeriodosPolimero(p: Controle["polimero"]): LinhaTabela[] {
  return (p?.periodos ?? []).map((x) => ({ id: x.trimestre, trimestre: x.trimestre, declarantes: x.declarantes }));
}

/* ---------------------------------------------------------------- P039: árvore societária */

export type NoCadeia = { cnpj: string; nome: string | null; motivo: MotivoParada | null };
export type SocioArvore = { cnpj: string | null; nome: string | null; controlador: boolean; pct: number | null };
export type ArvoreSocietaria = {
  raiz: NoCadeia;
  /** Da raiz ao topo, seguindo o controlador direto único com CNPJ; o último é o topo. */
  cadeia: NoCadeia[];
  /** Por que a cadeia para no topo (a fonte não permite subir mais). */
  motivoTopo: MotivoParada | null;
  /** Controladores sem CNPJ declarados acima do topo (só os nomes que a regra de publicação permite). */
  acimaDoTopo: SocioArvore[];
  /** Sócios diretos da raiz: controladores primeiro, depois pela participação. */
  socios: SocioArvore[];
  /** Empresas em que a raiz é sócia controladora. */
  controladas: { cnpj: string; nome: string | null; pct: number | null }[];
  ciclo: boolean;
};

function ordenaSocios(a: SocioArvore, b: SocioArvore): number {
  if (a.controlador !== b.controlador) return a.controlador ? -1 : 1;
  const pa = a.pct ?? -1;
  const pb = b.pct ?? -1;
  return pb - pa || (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR");
}

/**
 * Árvore de um CNPJ a partir do arquivo da cadeia (empresas_cadeia.json): sobe pelo controlador
 * direto publicado em `nos` até não haver mais (o motivo da parada é o do topo) ou até um ciclo;
 * os sócios e as controladas vêm das arestas publicadas. Nenhum percentual é recalculado: o
 * percentual direto é o do arquivo, e null quando a fonte só dá o relativo ao declarante.
 */
export function arvoreDe(c: CadeiaSocietaria, cnpj: string): ArvoreSocietaria | null {
  const no = c.nos[cnpj];
  const temArestas = c.arestas.pai.includes(cnpj) || c.arestas.socio.includes(cnpj);
  if (!no && !temArestas) return null;
  const noDe = (x: string): NoCadeia => ({ cnpj: x, nome: c.nos[x]?.[0] ?? null, motivo: c.nos[x]?.[2] ?? null });
  const cadeia: NoCadeia[] = [noDe(cnpj)];
  const vistos = new Set([cnpj]);
  let ciclo = false;
  let atual = cnpj;
  for (;;) {
    const prox = c.nos[atual]?.[1] ?? null;
    if (!prox) break;
    if (vistos.has(prox)) {
      ciclo = true;
      break;
    }
    vistos.add(prox);
    cadeia.push(noDe(prox));
    atual = prox;
  }
  const topo = cadeia[cadeia.length - 1];
  const socios: SocioArvore[] = [];
  const acimaDoTopo: SocioArvore[] = [];
  const controladas: { cnpj: string; nome: string | null; pct: number | null }[] = [];
  const a = c.arestas;
  for (let i = 0; i < a.pai.length; i++) {
    if (a.pai[i] === cnpj) socios.push({ cnpj: a.socio[i], nome: a.nome[i], controlador: a.controlador[i] === 1, pct: a.pct_direto[i] });
    if (a.pai[i] === topo.cnpj && a.controlador[i] === 1 && a.socio[i] === null) acimaDoTopo.push({ cnpj: null, nome: a.nome[i], controlador: true, pct: a.pct_direto[i] });
    if (a.socio[i] === cnpj && a.controlador[i] === 1) controladas.push({ cnpj: a.pai[i], nome: c.nos[a.pai[i]]?.[0] ?? null, pct: a.pct_direto[i] });
  }
  socios.sort(ordenaSocios);
  controladas.sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1) || (x.nome ?? "").localeCompare(y.nome ?? "", "pt-BR"));
  return { raiz: cadeia[0], cadeia, motivoTopo: ciclo ? "ciclo" : topo.motivo, acimaDoTopo, socios, controladas, ciclo };
}

/** Frase da árvore: até onde a cadeia sobe e por que para. */
export function textoArvore(a: ArvoreSocietaria): string {
  const nome = nomeOuCnpj(a.raiz.nome, a.raiz.cnpj);
  const topo = a.cadeia[a.cadeia.length - 1];
  const motivo = a.motivoTopo ? ROTULO_MOTIVO[a.motivoTopo] : "motivo não publicado";
  const subida =
    a.cadeia.length > 1
      ? `A cadeia de controladores únicos declarada à ANEEL sobe ${plural(a.cadeia.length - 1, "nível", "níveis")} de ${nome} até ${nomeOuCnpj(topo.nome, topo.cnpj)}`
      : `${nome} é o próprio topo da cadeia declarada à ANEEL`;
  return `${subida}, e para ali: ${motivo}. ${plural(a.socios.length, "sócio direto declarado", "sócios diretos declarados")}; aparece como sócia controladora (sozinha ou em controle compartilhado) de ${plural(a.controladas.length, "empresa", "empresas")}.`;
}

/** Estado da árvore na URL: o CNPJ escolhido (prefixo "ctl."). */
export const ESQUEMA_CONTROLE = { e: campo(leitorCnpj, "", { param: "ctl.e" }) };

/** Entidades que a busca da árvore oferece antes do arquivo da cadeia chegar: grupos, proprietários e distribuidoras da gold. */
export function entidadesControle(gs: readonly Grupo[], ps: readonly Proprietario[], ix: readonly Distribuidora[]): EntidadeBuscavel[] {
  const m = new Map<string, EntidadeBuscavel>();
  for (const g of gs) m.set(g.cnpj, { id: g.cnpj, rotulo: nomeOuCnpj(g.nome, g.cnpj), detalhe: "grupo de controle", sinonimos: [cnpjFormatado(g.cnpj)] });
  for (const p of ps) if (!m.has(p.cnpj)) m.set(p.cnpj, { id: p.cnpj, rotulo: nomeOuCnpj(p.nome, p.cnpj), detalhe: "proprietário de usinas", sinonimos: [cnpjFormatado(p.cnpj)] });
  for (const d of ix) if (!m.has(d.cnpj)) m.set(d.cnpj, { id: d.cnpj, rotulo: d.sigla, detalhe: `distribuidora · ${d.nome ?? SEM_DADO}`, sinonimos: [cnpjFormatado(d.cnpj), d.nome ?? ""] });
  return Array.from(m.values());
}

/** Todas as entidades do arquivo da cadeia (para a busca depois que ele chega). */
export function entidadesCadeia(c: CadeiaSocietaria): EntidadeBuscavel[] {
  return Object.entries(c.nos).map(([cnpj, [nome]]) => ({ id: cnpj, rotulo: nomeOuCnpj(nome, cnpj), detalhe: cnpjFormatado(cnpj), sinonimos: [cnpj] }));
}

/* ================================================================ carga sob demanda */

const cacheJson = new Map<string, Promise<unknown>>();
/** Busca um JSON publicado uma única vez por página (os componentes que o leem compartilham a promessa); falha libera nova tentativa. */
export function carregarJson<T>(url: string): Promise<T> {
  let p = cacheJson.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        return r.json() as Promise<unknown>;
      })
      .catch((e: unknown) => {
        cacheJson.delete(url);
        throw e;
      });
    cacheJson.set(url, p);
  }
  return p as Promise<T>;
}
