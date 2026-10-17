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
 *
 * Idioma: as frases e os rótulos têm as duas formas lado a lado (tx). As funções de texto recebem o
 * idioma por último (padrão: o da página, idiomaEnergia()), para o componente de cliente passar o
 * de useIdioma(); as constantes de rótulo (colunas, mapas) leem o idioma na hora do acesso, por
 * getter, e por isso continuam sendo constantes para quem as importa.
 */
import type { Idioma } from "@/lib/idioma";
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
  EmpresasGold,
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
import { idiomaEnergia, tx } from "./idioma";
import { SIGLAS, SIGLAS_IDIOMAS } from "./siglas";
import { LIMITE_COMPARACAO, type ColunaTabela, type EntidadeBuscavel, type LinhaTabela } from "./tabela";
import {
  CONTA_CVM_EN,
  DEFINICAO_CONTA_EN,
  DOWNLOAD_EMPRESAS_EN,
  ESTADO_VINCULO_GOLD_EN,
  FASE_SIGA_EN,
  MOTIVO_PARADA_GOLD_EN,
  NOTA_EMPRESAS_EN,
  REGIME_EN,
  SETOR_CVM_EN,
  SITUACAO_CVM_EN,
  motivoTarifa,
  traduzir,
  universoPerdas,
} from "./i18n/empresas-leiloes";

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
  {
    id: "p036",
    get rotulo() {
      return tx("Cadastro e ativos", "Registry and assets");
    },
    get pergunta() {
      return tx("Quem são os donos dos ativos?", "Who owns the assets?");
    },
    segmento: "ativos",
  },
  {
    id: "p037",
    get rotulo() {
      return tx("Perfil da distribuidora", "Distribution utility profile");
    },
    get pergunta() {
      return tx("Como a empresa atende sua área?", "How does the company serve its area?");
    },
    segmento: "distribuidoras",
  },
  {
    id: "p038",
    get rotulo() {
      return tx("Finanças e investimentos", "Finances and investments");
    },
    get pergunta() {
      return tx("Como evoluem os fundamentos reportados?", "How are the reported fundamentals evolving?");
    },
    segmento: "financas",
  },
  {
    id: "p039",
    get rotulo() {
      return tx("Controle e concentração", "Control and concentration");
    },
    get pergunta() {
      return tx("Quem controla e qual a concentração?", "Who controls the assets and how concentrated is control?");
    },
    segmento: "controle",
  },
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
export function semDado(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem dado", "no data", idioma);
}
export const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

export function inteiro(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, 0, idioma) : semDado(idioma);
}
export function numTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, casas, idioma) : semDado(idioma);
}
export function pctTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? pct(v, casas, idioma) : semDado(idioma);
}
/** Potência em MW para frase: "220.658,9 MW"; ausência → "sem dado". */
export function mwTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? `${num(v, casas, idioma)} MW` : semDado(idioma);
}
export function dataTexto(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return iso ? dataBR(iso, idioma) : semDado(idioma);
}

/** "12300288000107" → "12.300.288/0001-07"; outro formato fica como veio. */
export function cnpjFormatado(c: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!c) return semDado(idioma);
  const d = c.replace(/\D/g, "");
  if (d.length !== 14) return c;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Nome publicado ou, sem nome, o CNPJ formatado (identidade é o CNPJ; o nome é rótulo). */
export function nomeOuCnpj(nome: string | null | undefined, cnpj: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return nome && nome.trim() ? nome : cnpj ? `CNPJ ${cnpjFormatado(cnpj, idioma)}` : semDado(idioma);
}

/** "2026T2" → "2º trimestre de 2026". */
export function trimestreTexto(t: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const m = t ? /^(\d{4})T([1-4])$/.exec(t) : null;
  return m ? tx(`${m[2]}º trimestre de ${m[1]}`, `Q${m[2]} ${m[1]}`, idioma) : semDado(idioma);
}

/**
 * Reais em escala legível para frase ("R$ 42,8 bilhões", "R$ 389,8 milhões"); valores em R$
 * inteiros, como a gold publica. Singular abaixo de 2 ("R$ 1,3 bilhão"). Negativo com o
 * sinal de menos tipográfico. Ausência → "sem dado". Em inglês, "billion", "million" e "thousand".
 */
export function reaisEscala(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!temValor(v)) return semDado(idioma);
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  const escalas: [number, string, string][] = [
    [1e9, tx("bilhão", "billion", idioma), tx("bilhões", "billion", idioma)],
    [1e6, tx("milhão", "million", idioma), tx("milhões", "million", idioma)],
    [1e3, tx("mil", "thousand", idioma), tx("mil", "thousand", idioma)],
  ];
  for (const [base, um, varios] of escalas) {
    if (a >= base) {
      const x = Math.round((a / base) * 10) / 10;
      return `${sinal}R$ ${num(x, 1, idioma)} ${x < 2 ? um : varios}`;
    }
  }
  return `${sinal}R$ ${num(a, 0, idioma)}`;
}

/** "R$ 6.010,7 milhões" para frase: sempre em milhões, a unidade das tabelas e dos gráficos da página; negativo com o sinal de menos tipográfico. */
export function reaisMilhoes(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!temValor(v)) return semDado(idioma);
  return `${v < 0 ? "−" : ""}R$ ${num(Math.abs(v) / 1e6, 1, idioma)} ${tx("milhões", "million", idioma)}`;
}

/** R$ inteiros → R$ milhões (conversão de unidade para tabela e gráfico; nenhuma conta refeita). */
export function emMilhoes(v: number | null | undefined): number | null {
  return temValor(v) ? v / 1e6 : null;
}

/** Posição numa lista ordenada, para frase: "5 de 71". */
export function posicaoTexto(posicao: number, total: number, idioma: Idioma = idiomaEnergia()): string {
  return tx(`${num(posicao, 0, idioma)} de ${num(total, 0, idioma)}`, `${num(posicao, 0, idioma)} of ${num(total, 0, idioma)}`, idioma);
}

/** Downloads da gold filtrados pelos endereços pedidos, na ordem pedida, com o rótulo no idioma da página. */
export function downloadsDe(todos: readonly Download[], urls: readonly string[], idioma: Idioma = idiomaEnergia()): Download[] {
  return urls
    .map((u) => todos.find((d) => d.url === u))
    .filter((d): d is Download => !!d)
    .map((d) => (idioma === "pt" ? d : { ...d, rotulo: traduzir(DOWNLOAD_EMPRESAS_EN, d.rotulo, idioma) }));
}

/** Leitor de CNPJ de 14 dígitos para a URL (identidade canônica do módulo). */
export const leitorCnpj: Leitor<string> = { ler: (b) => (/^\d{14}$/.test(b) ? b : undefined), escrever: (v) => v };

/**
 * Cor de cada medida nos gráficos do módulo: a mesma medida leva a mesma cor em todas as páginas (capacidade proporcional em
 * violeta, capacidade sob controle em verde, HHI em laranja, km de circuito em azul). Nunca é cor de texto, e o rótulo e a forma
 * sempre acompanham a cor.
 */
export const COR_MEDIDA = {
  proporcional: "var(--serie-comp-1)",
  controle: "var(--serie-comp-3)",
  hhi: "var(--serie-comp-2)",
  circuito: "var(--serie-comp-4)",
} as const;

/** Sim ou não numa célula de tabela. */
function simNao(v: unknown, idioma: Idioma = idiomaEnergia()): string {
  return v ? tx("sim", "yes", idioma) : tx("não", "no", idioma);
}

/** Fase do SIGA no idioma da página (o valor da gold é a chave; a tradução é só do rótulo). */
export function rotuloFase(fase: string, idioma: Idioma = idiomaEnergia()): string {
  return traduzir(FASE_SIGA_EN, fase, idioma);
}

/* ================================================================ P036: cadastro e ativos */

export const ROTULO_ESTADO_VINCULO: Readonly<Record<EstadoVinculo, string>> = {
  get vinculado() {
    return tx("Vinculado: todos os proprietários com CNPJ", "Linked: all owners with CNPJ");
  },
  get inclui_sem_documento() {
    return tx("Inclui proprietário sem CNPJ (pessoa física)", "Includes an owner without CNPJ (individual)");
  },
  get soma_divergente() {
    return tx("Participações não somam 100%", "Stakes do not add up to 100%");
  },
  get sem_proprietario() {
    return tx("Proprietário não informado", "Owner not reported");
  },
  get nao_lido() {
    return tx("Campo de proprietários não lido", "Owners field not read");
  },
};

/** Rótulo do estado do vínculo publicado pela gold, no idioma da página. */
export function rotuloEstadoGold(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  return traduzir(ESTADO_VINCULO_GOLD_EN, rotulo, idioma);
}

/**
 * Resposta curta do P036: cobertura dos vínculos provados da geração e da transmissão. Todo
 * número vem da gold; "sem vínculo completo" é a soma publicada por estado (nunca deduzida).
 */
export function respostaCadastro(c: Cadastro, idioma: Idioma = idiomaEnergia()): string {
  const a = c.ativos;
  const semVinculoOperacao = a.estados.filter((e) => e.estado !== "vinculado").reduce((s, e) => s + e.usinas_operacao, 0);
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  const partes = [
    tx(
      `No SIGA de ${dataTexto(a.data, idioma)}, ${I(a.operacao.usinas)} usinas estão em operação, com ${mwTexto(a.operacao.mw_fiscalizado, 1, idioma)} de potência fiscalizada; ${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} dessa potência tem todos os proprietários identificados pelo CNPJ publicado no próprio registro, num total de ${I(a.proprietarios_cnpj)} proprietários.`,
      `In SIGA as of ${dataTexto(a.data, idioma)}, ${I(a.operacao.usinas)} plants are in operation, with ${mwTexto(a.operacao.mw_fiscalizado, 1, idioma)} of inspected capacity; ${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} of that capacity has all owners identified by the CNPJ published in the plant's own record, a total of ${I(a.proprietarios_cnpj)} owners.`,
      idioma,
    ),
    semVinculoOperacao > 0
      ? tx(
          `As ${I(semVinculoOperacao)} usinas em operação sem vínculo completo continuam identificadas, cada uma com o motivo.`,
          `The ${I(semVinculoOperacao)} plants in operation without a complete link remain identified, each with its reason.`,
          idioma,
        )
      : tx("Nenhuma usina em operação ficou sem vínculo completo.", "No plant in operation was left without a complete link.", idioma),
  ];
  const t = c.transmissao;
  if (t) {
    partes.push(
      tx(
        `Na transmissão, o SIGET de ${dataTexto(t.data, idioma)} liga ${pctTexto(t.resumo.pct_modulos_com_cnpj, 1, idioma)} dos ${I(t.resumo.modulos)} módulos ao CNPJ de ${I(t.resumo.cnpjs_com_modulos)} concessionárias, com ${numTexto(t.resumo.km_circuito_operacao, 1, idioma)} km de circuito em operação.`,
        `In transmission, SIGET as of ${dataTexto(t.data, idioma)} links ${pctTexto(t.resumo.pct_modulos_com_cnpj, 1, idioma)} of the ${I(t.resumo.modulos)} modules to the CNPJ of ${I(t.resumo.cnpjs_com_modulos)} concession holders, with ${numTexto(t.resumo.km_circuito_operacao, 1, idioma)} circuit km in operation.`,
        idioma,
      ),
    );
  } else {
    partes.push(
      tx(
        `Os ativos de transmissão não estão nesta publicação: os dados do SIGET (${SIGLAS.SIGET}) não foram integrados.`,
        `Transmission assets are not in this release: SIGET (${SIGLAS_IDIOMAS.en.SIGET}) data have not been integrated.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

export const COLUNAS_ESTADOS: ColunaTabela[] = [
  {
    id: "rotulo",
    get rotulo() {
      return tx("Estado do vínculo", "Link status");
    },
    tipo: "texto",
  },
  {
    id: "usinas_operacao",
    get rotulo() {
      return tx("Usinas em operação", "Plants in operation");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "mw_operacao",
    get rotulo() {
      return tx("Potência em operação", "Capacity in operation");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "pct_mw_operacao",
    get rotulo() {
      return tx("Da potência em operação", "Of capacity in operation");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "usinas", // i18n: dado
    get rotulo() {
      return tx("Usinas, todas as fases", "Plants, all phases");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "pct_usinas",
    get rotulo() {
      return tx("Das usinas, todas as fases", "Of plants, all phases");
    },
    tipo: "percentual",
    casas: 2,
  },
];
export function linhasEstados(a: Ativos, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return a.estados.map((e) => ({
    id: e.estado,
    rotulo: rotuloEstadoGold(e.rotulo, idioma),
    usinas_operacao: e.usinas_operacao,
    mw_operacao: e.mw_operacao,
    pct_mw_operacao: e.pct_mw_operacao,
    usinas: e.usinas,
    pct_usinas: e.pct_usinas,
  }));
}

export const COLUNAS_FASES: ColunaTabela[] = [
  {
    id: "fase",
    get rotulo() {
      return tx("Fase no SIGA", "Phase in SIGA");
    },
    tipo: "texto",
  },
  {
    id: "usinas", // i18n: dado
    get rotulo() {
      return tx("Usinas", "Plants");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "mw_outorgado",
    get rotulo() {
      return tx("Potência outorgada", "Granted capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "mw_fiscalizado",
    get rotulo() {
      return tx("Potência fiscalizada", "Inspected capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
];
export function linhasFases(a: Ativos, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return a.por_fase.map((f) => ({ id: f.fase, fase: rotuloFase(f.fase, idioma), usinas: f.usinas, mw_outorgado: f.mw_outorgado, mw_fiscalizado: f.mw_fiscalizado }));
}

export const COLUNAS_REGIMES: ColunaTabela[] = [
  {
    id: "rotulo",
    get rotulo() {
      return tx("Regime de exploração", "Operating regime");
    },
    tipo: "texto",
  },
  {
    id: "regime",
    get rotulo() {
      return tx("Sigla", "Acronym");
    },
    tipo: "texto",
  },
  {
    id: "parcelas",
    get rotulo() {
      return tx("Parcelas de propriedade", "Ownership stakes");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "mw_proporcional",
    get rotulo() {
      return tx("Capacidade proporcional", "Proportional capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
];
export function linhasRegimes(a: Ativos, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return a.por_regime.map((r) => ({ id: r.regime, rotulo: traduzir(REGIME_EN, r.rotulo, idioma), regime: r.regime, parcelas: r.parcelas, mw_proporcional: r.mw_proporcional }));
}

export const COLUNAS_SEM_VINCULO: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Usina", "Plant");
    },
    tipo: "texto",
  },
  { id: "ceg", rotulo: "CEG", tipo: "texto" },
  {
    id: "tipo",
    get rotulo() {
      return tx("Tipo", "Type");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "uf",
    get rotulo() {
      return tx("UF", "State");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "mw",
    get rotulo() {
      return tx("Potência fiscalizada", "Inspected capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "estado",
    get rotulo() {
      return tx("Motivo", "Reason");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "soma_pct",
    get rotulo() {
      return tx("Soma das participações", "Sum of stakes");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "proprietarios",
    get rotulo() {
      return tx("CNPJ publicados", "Published CNPJs");
    },
    tipo: "texto",
  },
  {
    id: "mesma_raiz",
    get rotulo() {
      return tx("Mesma raiz de CNPJ", "Same CNPJ root");
    },
    tipo: "texto",
    categorica: true,
  },
];
export function linhasSemVinculo(a: Ativos, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return a.sem_vinculo.map((u) => ({
    id: u.nucleo,
    nome: u.nome ?? tx(`Núcleo ${u.nucleo}`, `Core ${u.nucleo}`, idioma),
    ceg: u.ceg,
    tipo: u.tipo,
    uf: u.uf,
    mw: u.mw,
    estado: ROTULO_ESTADO_VINCULO[u.estado] ?? u.estado,
    soma_pct: u.soma_pct,
    proprietarios: u.proprietarios_cnpj.map((c) => cnpjFormatado(c, idioma)).join(", "),
    mesma_raiz: u.estado === "soma_divergente" ? simNao(u.mesma_raiz, idioma) : null,
  }));
}

export const COLUNAS_PROPRIETARIOS: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Proprietário direto", "Direct owner");
    },
    tipo: "texto",
  },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "mw_proporcional",
    get rotulo() {
      return tx("Capacidade proporcional", "Proportional capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "mw_controle_direto",
    get rotulo() {
      return tx("Capacidade sob controle direto", "Capacity under direct control");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "usinas_operacao",
    get rotulo() {
      return tx("Usinas em operação com participação", "Plants in operation with a stake");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "usinas_controle_direto",
    get rotulo() {
      return tx("Usinas sob controle direto", "Plants under direct control");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "grupo",
    get rotulo() {
      return tx("Grupo (topo da cadeia declarada)", "Group (top of the declared chain)");
    },
    tipo: "texto",
  },
  {
    id: "regimes",
    get rotulo() {
      return tx("Regimes", "Regimes");
    },
    tipo: "texto",
  },
  {
    id: "no_cadastro",
    get rotulo() {
      return tx("No cadastro de agentes", "In the agent registry");
    },
    tipo: "texto",
    categorica: true,
  },
];
export function linhasProprietarios(ps: readonly Proprietario[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return ps.map((p) => ({
    id: p.cnpj,
    nome: nomeOuCnpj(p.nome, p.cnpj, idioma),
    cnpj: cnpjFormatado(p.cnpj, idioma),
    mw_proporcional: p.mw_proporcional,
    mw_controle_direto: p.mw_controle_direto,
    usinas_operacao: p.usinas_operacao,
    usinas_controle_direto: p.usinas_controle_direto,
    grupo: p.grupo ? nomeOuCnpj(p.grupo_nome, p.grupo, idioma) : tx("o próprio proprietário é o topo", "the owner itself is the top", idioma),
    regimes: p.regimes.join(", "),
    no_cadastro: simNao(p.no_cadastro_agentes, idioma),
  }));
}
/** Grupo do proprietário para filtrar o mapa: o topo declarado ou, quando ele é o topo, o próprio CNPJ. */
export function grupoDoProprietario(p: Pick<Proprietario, "cnpj" | "grupo">): string {
  return p.grupo ?? p.cnpj;
}

export const COLUNAS_TRANSMISSAO: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Concessionária", "Concession holder");
    },
    tipo: "texto",
  },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "km",
    get rotulo() {
      return tx("Circuito em operação", "Circuit in operation");
    },
    tipo: "numero",
    unidade: "km", // i18n: dado
    casas: 1,
  },
  {
    id: "pct_km",
    get rotulo() {
      return tx("Do km de circuito do SIGET", "Of SIGET circuit km");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "circuitos",
    get rotulo() {
      return tx("Circuitos em operação", "Circuits in operation");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "subestacoes",
    get rotulo() {
      return tx("Subestações com equipamento", "Substations with equipment");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "mva",
    get rotulo() {
      return tx("Transformação em operação", "Transformation capacity in operation");
    },
    tipo: "numero",
    unidade: "MVA",
    casas: 0,
  },
  {
    id: "contratos",
    get rotulo() {
      return tx("Contratos", "Contracts");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "modulos",
    get rotulo() {
      return tx("Módulos", "Modules");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "ufs",
    get rotulo() {
      return tx("UF", "State");
    },
    tipo: "texto",
  },
  {
    id: "grupo",
    get rotulo() {
      return tx("Grupo", "Group");
    },
    tipo: "texto",
  },
];
export function linhasTransmissao(t: Transmissao, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return t.maiores.map((a) => ({
    id: a.cnpj,
    nome: nomeOuCnpj(a.nome, a.cnpj, idioma),
    cnpj: cnpjFormatado(a.cnpj, idioma),
    km: a.km_circuito_operacao,
    pct_km: a.pct_km,
    circuitos: a.circuitos_operacao,
    subestacoes: a.subestacoes,
    mva: a.mva_transformacao_operacao,
    contratos: a.contratos,
    modulos: a.modulos,
    ufs: a.ufs.join(", "),
    grupo: a.grupo ? nomeOuCnpj(a.grupo_nome, a.grupo, idioma) : tx("a própria concessionária é o topo", "the concession holder itself is the top", idioma),
  }));
}

export const COLUNAS_GRUPOS_TRANSMISSAO: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Grupo", "Group");
    },
    tipo: "texto",
  },
  {
    id: "cnpj",
    get rotulo() {
      return tx("CNPJ do topo", "CNPJ of the top");
    },
    tipo: "texto",
  },
  {
    id: "km",
    get rotulo() {
      return tx("Circuito em operação", "Circuit in operation");
    },
    tipo: "numero",
    unidade: "km", // i18n: dado
    casas: 1,
  },
  {
    id: "pct_km",
    get rotulo() {
      return tx("Do km de circuito do SIGET", "Of SIGET circuit km");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "empresas",
    get rotulo() {
      return tx("Concessionárias", "Concession holders");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "subestacoes",
    get rotulo() {
      return tx("Subestações (união)", "Substations (union)");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "mva",
    get rotulo() {
      return tx("Transformação em operação", "Transformation capacity in operation");
    },
    tipo: "numero",
    unidade: "MVA",
    casas: 0,
  },
];
export function linhasGruposTransmissao(t: Transmissao, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return t.grupos.map((g) => ({
    id: g.cnpj,
    nome: nomeOuCnpj(g.nome, g.cnpj, idioma),
    cnpj: cnpjFormatado(g.cnpj, idioma),
    km: g.km_circuito_operacao,
    pct_km: g.pct_km,
    empresas: g.empresas,
    subestacoes: g.subestacoes,
    mva: g.mva_transformacao_operacao,
  }));
}

/** Conferência SIGA × Agentes de Geração em uma frase; a nota (causa não verificada) vem da gold. */
export function textoConferenciaAgentes(c: ConferenciaAgentes | null, idioma: Idioma = idiomaEnergia()): string {
  if (!c) return tx("A conferência com o conjunto Agentes de Geração não está nesta publicação.", "The cross-check with the Agentes de Geração dataset is not in this release.", idioma);
  const pctIguais = c.comparadas > 0 ? (100 * c.iguais) / c.comparadas : null;
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  return tx(
    `Das ${I(c.comparadas)} usinas presentes no SIGA e no conjunto Agentes de Geração de ${dataTexto(c.data, idioma)}, ${I(c.iguais)} (${pctTexto(pctIguais, 2, idioma)}) ` +
      `têm a mesma lista de CNPJ e os mesmos percentuais; ${I(c.cnpj_diferentes)} têm CNPJ diferente e ${I(c.percentual_diferente)} percentual diferente. ${c.nota}`,
    `Of the ${I(c.comparadas)} plants present in SIGA and in the Agentes de Geração dataset as of ${dataTexto(c.data, idioma)}, ${I(c.iguais)} (${pctTexto(pctIguais, 2, idioma)}) ` +
      `have the same list of CNPJs and the same percentages; ${I(c.cnpj_diferentes)} have a different CNPJ and ${I(c.percentual_diferente)} a different percentage. ${traduzir(NOTA_EMPRESAS_EN, c.nota, idioma)}`,
    idioma,
  );
}

/* ---------------------------------------------------------------- P036: mapa das usinas */

/** Fases do SIGA aceitas no filtro do mapa (o teste confere que a gold não publica outra). */
export const FASES_MAPA = [
  {
    id: "operacao",
    fase: "Operação", // i18n: dado
    get rotulo() {
      return tx("Em operação", "In operation");
    },
  },
  {
    id: "construcao",
    fase: "Construção", // i18n: dado
    get rotulo() {
      return tx("Em construção", "Under construction");
    },
  },
  {
    id: "nao_iniciada",
    fase: "Construção não iniciada", // i18n: dado
    get rotulo() {
      return tx("Construção não iniciada", "Construction not started");
    },
  },
] as const;
export type IdFaseMapa = (typeof FASES_MAPA)[number]["id"] | "todas";

/** Nome de cada tipo de usina do SIGA nos dois idiomas (sem idioma, o da página). */
const NOME_TIPO = {
  UHE: (idioma?: Idioma) => tx("Hidrelétrica (UHE)", "Hydropower plant (UHE)", idioma),
  PCH: (idioma?: Idioma) => tx("Pequena central hidrelétrica (PCH)", "Small hydropower plant (PCH)", idioma),
  CGH: (idioma?: Idioma) => tx("Central geradora hidrelétrica (CGH)", "Mini hydropower plant (CGH)", idioma),
  UTE: (idioma?: Idioma) => tx("Termelétrica (UTE)", "Thermal power plant (UTE)", idioma),
  UTN: (idioma?: Idioma) => tx("Termonuclear (UTN)", "Nuclear power plant (UTN)", idioma),
  EOL: (idioma?: Idioma) => tx("Eólica (EOL)", "Wind (EOL)", idioma),
  UFV: (idioma?: Idioma) => tx("Solar fotovoltaica (UFV)", "Solar photovoltaic (UFV)", idioma),
} as const;

/** Tipos de usina do SIGA, com a cor de fonte do design system (a mesma em todos os gráficos). */
export const TIPOS_USINA = [
  {
    id: "UHE",
    get rotulo() {
      return NOME_TIPO.UHE();
    },
    cor: "var(--serie-hidraulica)",
  },
  {
    id: "PCH",
    get rotulo() {
      return NOME_TIPO.PCH();
    },
    cor: "var(--serie-hidraulica)",
  },
  {
    id: "CGH",
    get rotulo() {
      return NOME_TIPO.CGH();
    },
    cor: "var(--serie-hidraulica)",
  },
  {
    id: "UTE",
    get rotulo() {
      return NOME_TIPO.UTE();
    },
    cor: "var(--serie-termica)",
  },
  {
    id: "UTN",
    get rotulo() {
      return NOME_TIPO.UTN();
    },
    cor: "var(--serie-6)",
  },
  {
    id: "EOL",
    get rotulo() {
      return NOME_TIPO.EOL();
    },
    cor: "var(--serie-eolica)",
  },
  {
    id: "UFV",
    get rotulo() {
      return NOME_TIPO.UFV();
    },
    cor: "var(--serie-solar)",
  },
] as const;
export type TipoUsina = (typeof TIPOS_USINA)[number]["id"];
export const IDS_TIPOS: readonly TipoUsina[] = TIPOS_USINA.map((t) => t.id);
export function rotuloTipo(t: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const tipo = TIPOS_USINA.find((x) => x.id === t);
  return tipo ? NOME_TIPO[tipo.id](idioma) : t || semDado(idioma);
}

/** Estado do mapa na URL (prefixo "at."): seleção e filtros criam entrada no histórico; o voltar desfaz. */
export const ESQUEMA_ATIVOS = {
  mapa: campo(tiposUrl.booleano(), false, { param: "at.mapa" }),
  fase: campo(tiposUrl.opcao(["operacao", "construcao", "nao_iniciada", "todas"] as const), "operacao" as IdFaseMapa, { param: "at.fase" }), // i18n: dado
  tipos: campo(tiposUrl.lista(tiposUrl.opcao(IDS_TIPOS)), [] as TipoUsina[], { param: "at.tipo" }),
  vinculo: campo(tiposUrl.opcao(["todos", "sem_vinculo"] as const), "todos" as "todos" | "sem_vinculo", { param: "at.vinc" }), // i18n: dado
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

/**
 * Linhas da tabela equivalente do mapa (mesmas usinas e mesma ordem do desenho). A fase fica como a gold a publica (é a
 * chave do resumo por fase); a tela a mostra pelo rótulo do idioma (rotuloFase).
 */
export function linhasAtivos(j: AtivosMapa, indices: readonly number[], idioma: Idioma = idiomaEnergia()): LinhaAtivo[] {
  return indices.map((i) => {
    const g = j.grupo[i] >= 0 ? j.grupos[j.grupo[i]] : null;
    const est = j.estados[j.estado[i]];
    return {
      id: j.nucleo[i],
      nome: j.nome[i] ?? tx(`Núcleo ${j.nucleo[i]}`, `Core ${j.nucleo[i]}`, idioma),
      tipo: j.tipo[i],
      fase: j.fase[i],
      uf: j.uf[i],
      mw: j.mw[i],
      estado: ROTULO_ESTADO_VINCULO[est as EstadoVinculo] ?? est,
      grupo: g ? nomeOuCnpj(g[1], g[0], idioma) : tx("fora dos 200 maiores grupos ou sem grupo", "outside the 200 largest groups or without a group", idioma),
    };
  });
}

export const COLUNAS_ATIVOS: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Usina", "Plant");
    },
    tipo: "texto",
  },
  {
    id: "id",
    get rotulo() {
      return tx("Núcleo do CEG", "CEG core");
    },
    tipo: "texto",
  },
  {
    id: "tipo",
    get rotulo() {
      return tx("Tipo", "Type");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "fase",
    get rotulo() {
      return tx("Fase", "Phase");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "uf",
    get rotulo() {
      return tx("UF", "State");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "mw",
    get rotulo() {
      return tx("Potência", "Capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 2,
  },
  {
    id: "estado",
    get rotulo() {
      return tx("Vínculo", "Link");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "grupo",
    get rotulo() {
      return tx("Grupo do proprietário majoritário", "Group of the majority owner");
    },
    tipo: "texto",
  },
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
export function textoResumoAtivos(r: ReturnType<typeof resumoAtivos>, idioma: Idioma = idiomaEnergia()): string {
  if (r.usinas === 0) return tx("Nenhuma usina no recorte.", "No plant in the selection.", idioma);
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  const fases = r.porFase.map((f) => {
    const operacao = f.fase === "Operação"; // i18n: dado
    return tx(
      `${I(f.usinas)} em ${f.fase.toLocaleLowerCase("pt-BR")} (${mwTexto(f.mw, 1, idioma)} ${operacao ? "fiscalizados" : "outorgados"}${f.semPotencia ? `; ${I(f.semPotencia)} sem potência publicada` : ""})`,
      `${I(f.usinas)} in ${rotuloFase(f.fase, idioma).toLocaleLowerCase("en-US")} (${mwTexto(f.mw, 1, idioma)} ${operacao ? "inspected" : "granted"}${f.semPotencia ? `; ${I(f.semPotencia)} without published capacity` : ""})`,
      idioma,
    );
  });
  return tx(`${I(r.usinas)} usinas no recorte: ${fases.join("; ")}.`, `${I(r.usinas)} ${r.usinas === 1 ? "plant" : "plants"} in the selection: ${fases.join("; ")}.`, idioma);
}

/** Raio do ponto pela potência (marca, não escala de área), em unidades de tela. */
export function raioPonto(mw: number | null): number {
  if (!temValor(mw)) return 1.5;
  if (mw > 300) return 4;
  if (mw > 30) return 2.6;
  return 1.6;
}
export const CLASSES_RAIO = [
  {
    get rotulo() {
      return tx("até 30 MW", "up to 30 MW");
    },
    mw: 30,
  },
  {
    get rotulo() {
      return tx("mais de 30 até 300 MW", "over 30 up to 300 MW");
    },
    mw: 300,
  },
  {
    get rotulo() {
      return tx("mais de 300 MW", "over 300 MW");
    },
    mw: 301,
  },
] as const;

/* ================================================================ P037: distribuidoras */

export function rotuloGrupo(g: Distribuidora["grupo"], idioma: Idioma = idiomaEnergia()): string {
  return g === "concessionaria" ? tx("Concessionária", "Concession holder", idioma) : g === "permissionaria" ? tx("Permissionária", "Permit holder", idioma) : semDado(idioma);
}

/** Resposta curta do P037: universo e presença em cada base, pelo mesmo CNPJ dos módulos de origem. */
export function respostaDistribuidoras(d: Distribuidoras, idioma: Idioma = idiomaEnergia()): string {
  const r = d.resumo;
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  return tx(
    `${I(r.distribuidoras)} distribuidoras aparecem pelo CNPJ em ao menos uma base regulada de distribuição (${I(r.ativas)} ativas; ${I(r.concessionarias)} concessionárias e ${I(r.permissionarias)} permissionárias). ` +
      `A ficha de cada uma reúne as perdas (${I(r.com_perdas)} com registro no SAMP), a continuidade (${I(r.com_qualidade)}) e a tarifa residencial vigente (${I(r.com_tarifa_vigente)}), copiadas das páginas de origem pelo mesmo CNPJ; ` +
      `${I(r.com_controlador_acima)} têm controlador acima delas declarado à ANEEL e ${I(r.companhias_abertas)} são companhias abertas.`,
    `${I(r.distribuidoras)} distribution utilities appear by CNPJ in at least one regulated distribution database (${I(r.ativas)} active; ${I(r.concessionarias)} concession holders and ${I(r.permissionarias)} permit holders). ` +
      `Each one's profile brings together losses (${I(r.com_perdas)} with a record in SAMP), continuity of supply (${I(r.com_qualidade)}) and the current residential tariff (${I(r.com_tarifa_vigente)}), copied from the source pages by the same CNPJ; ` +
      `${I(r.com_controlador_acima)} have a controlling shareholder above them declared to ANEEL and ${I(r.companhias_abertas)} are publicly held companies.`,
    idioma,
  );
}

export function tarifaVigente(t: ReferenciaTarifa | null): number | null {
  return t && t.vigente ? t.total : null;
}

export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = [
  {
    id: "sigla",
    get rotulo() {
      return tx("Distribuidora", "Distribution utility");
    },
    tipo: "texto",
  },
  {
    id: "nome",
    get rotulo() {
      return tx("Razão social", "Legal name");
    },
    tipo: "texto",
  },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "grupo",
    get rotulo() {
      return tx("Grupo", "Group");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "situacao",
    get rotulo() {
      return tx("Situação", "Status");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "ufs",
    get rotulo() {
      return tx("UF da área", "States of the area");
    },
    tipo: "texto",
  },
  {
    id: "perdas_pct",
    get rotulo() {
      return tx("Perdas totais", "Total losses");
    },
    tipo: "percentual",
    casas: 2,
  },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  {
    id: "dec_limite",
    get rotulo() {
      return tx("Limite do DEC", "DEC limit");
    },
    tipo: "numero",
    unidade: "h",
    casas: 2,
  },
  {
    id: "fec",
    rotulo: "FEC",
    tipo: "numero",
    get unidade() {
      return tx("interrupções", "interruptions");
    },
    casas: 2,
  },
  {
    id: "fec_limite",
    get rotulo() {
      return tx("Limite do FEC", "FEC limit");
    },
    tipo: "numero",
    get unidade() {
      return tx("interrupções", "interruptions");
    },
    casas: 2,
  },
  {
    id: "tarifa",
    get rotulo() {
      return tx("Tarifa B1 vigente", "Current B1 tariff");
    },
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  {
    id: "controlador",
    get rotulo() {
      return tx("Controlador no topo da cadeia", "Controlling shareholder at the top of the chain");
    },
    tipo: "texto",
  },
  {
    id: "cvm",
    get rotulo() {
      return tx("Companhia aberta", "Publicly held company");
    },
    tipo: "texto",
    categorica: true,
  },
];
export function linhasDistribuidoras(ix: readonly Distribuidora[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return ix.map((d) => ({
    id: d.slug,
    sigla: d.sigla,
    nome: d.nome,
    cnpj: cnpjFormatado(d.cnpj, idioma),
    grupo: d.grupo ? rotuloGrupo(d.grupo, idioma) : null,
    situacao: d.ativa ? tx("ativa", "active", idioma) : tx("inativa", "inactive", idioma),
    ufs: d.ufs.length ? d.ufs.join(", ") : null,
    perdas_pct: d.perdas?.taxa_total_pct ?? null,
    dec: d.qualidade?.dec ?? null,
    dec_limite: d.qualidade?.dec_limite ?? null,
    fec: d.qualidade?.fec ?? null,
    fec_limite: d.qualidade?.fec_limite ?? null,
    tarifa: tarifaVigente(d.tarifa),
    controlador: d.controle.topo ? nomeOuCnpj(d.controle.topo_nome, d.controle.topo, idioma) : tx("a própria distribuidora é o topo", "the distribution utility itself is the top", idioma),
    cvm: simNao(d.cvm, idioma),
  }));
}

export function entidadesDistribuidoras(ix: readonly Distribuidora[], idioma: Idioma = idiomaEnergia()): EntidadeBuscavel[] {
  return ix.map((d) => ({
    id: d.slug,
    rotulo: d.sigla,
    detalhe: `${d.nome ?? semDado(idioma)}${d.ufs.length ? ` · ${d.ufs.join(", ")}` : ""}${d.ativa ? "" : tx(" · inativa", " · inactive", idioma)}`,
    sinonimos: [d.cnpj, cnpjFormatado(d.cnpj, idioma), ...d.siglas.map((s) => s.sigla), ...d.slugs_alternativos],
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
  idioma: Idioma = idiomaEnergia(),
): { valor: number; rotulo: string } | null {
  if (!ev || !anoPerdas || ev.valor_calculo === null || !ev.periodo.inicio?.startsWith(String(anoPerdas))) return null;
  return { valor: ev.valor_calculo, rotulo: tx(`Brasil, ${ev.universo}`, `Brazil, ${universoPerdas(ev.universo, idioma)}`, idioma) };
}

/** Anos de referência diferentes não se comparam (regra de pares da gold): o comparador avisa. */
export function avisoAnosComparacao(linhas: readonly LinhaComparacao[], idioma: Idioma = idiomaEnergia()): string | null {
  const anosP = new Set(linhas.map((l) => l.ano_perdas).filter(temValor));
  const anosQ = new Set(linhas.map((l) => l.ano_qualidade).filter(temValor));
  const partes: string[] = [];
  if (anosP.size > 1) partes.push(tx(`perdas de anos diferentes (${Array.from(anosP).sort().join(", ")})`, `losses from different years (${Array.from(anosP).sort().join(", ")})`, idioma));
  if (anosQ.size > 1) partes.push(tx(`continuidade de anos diferentes (${Array.from(anosQ).sort().join(", ")})`, `continuity of supply from different years (${Array.from(anosQ).sort().join(", ")})`, idioma));
  return partes.length
    ? tx(
        `Atenção: o recorte mistura ${partes.join(" e ")}; esses números não se comparam entre si.`,
        `Note: the selection mixes ${partes.join(" and ")}; these numbers are not comparable with each other.`,
        idioma,
      )
    : null;
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
function fraseLimite(medida: string, valor: number | null, limite: number | null, unidade: string, idioma: Idioma): string {
  if (!temValor(valor)) return tx(`${medida} ficou sem dado`, `${medida} had no data`, idioma);
  const s = sentidoLimite(valor, limite);
  const v = `${num(valor, 2, idioma)} ${unidade}`;
  if (s === null) return tx(`${medida} foi de ${v} (limite sem dado)`, `${medida} was ${v} (limit: no data)`, idioma);
  if (s === "igual") return tx(`${medida} foi de ${v}, igual ao limite`, `${medida} was ${v}, equal to the limit`, idioma);
  return tx(`${medida} foi de ${v}, ${s} do limite de ${num(limite as number, 2, idioma)}`, `${medida} was ${v}, ${s === "acima" ? "above" : "below"} the limit of ${num(limite as number, 2, idioma)}`, idioma);
}

/**
 * Resposta curta da ficha: perdas, continuidade diante do limite e tarifa vigente (ou o motivo da
 * falta). Cada parte diz o próprio período; ausência é dita, nunca preenchida.
 */
export function respostaFicha(d: Distribuidora, idioma: Idioma = idiomaEnergia()): string {
  const partes: string[] = [];
  const p = d.perdas;
  if (p && temValor(p.taxa_total_pct) && p.ano) {
    const incompleto = p.completo === false ? tx(" (ano incompleto no SAMP)", " (incomplete year in SAMP)", idioma) : "";
    if (p.taxa_total_pct < 0) {
      // perda negativa: a medida que o SAMP publica é negativa; o valor é o publicado, sem correção e sem causa afirmada
      partes.push(
        tx(
          `Em ${p.ano}, a ${d.sigla} registrou perda total negativa, de ${pct(p.taxa_total_pct, 2, idioma)} da energia injetada na rede${incompleto}. Valor negativo quer dizer que a medida publicada pelo SAMP é negativa; o observatório mostra o valor como a fonte o entrega, sem corrigi-lo e sem explicar a causa.`,
          `In ${p.ano}, ${d.sigla} recorded negative total losses, of ${pct(p.taxa_total_pct, 2, idioma)} of the energy injected into the grid${incompleto}. A negative value means the measure published by SAMP is negative; the observatory shows the value as the source delivers it, without correcting it or stating a reason.`,
          idioma,
        ),
      );
    } else {
      partes.push(
        tx(
          `Em ${p.ano}, a ${d.sigla} perdeu ${pct(p.taxa_total_pct, 2, idioma)} da energia injetada na rede${incompleto}.`,
          `In ${p.ano}, ${d.sigla} lost ${pct(p.taxa_total_pct, 2, idioma)} of the energy injected into the grid${incompleto}.`,
          idioma,
        ),
      );
    }
  } else if (p) {
    const ultimo = p.ultima_competencia ? dataBR(p.ultima_competencia, idioma) : semDado(idioma);
    partes.push(
      tx(
        `A ${d.sigla} não tem perdas no ano de referência do SAMP; o último mês com registro é ${ultimo}.`,
        `${d.sigla} has no losses in the SAMP reference year; the last month with a record is ${ultimo}.`,
        idioma,
      ),
    );
  } else {
    partes.push(tx(`A ${d.sigla} não aparece no SAMP.`, `${d.sigla} does not appear in SAMP.`, idioma));
  }
  const q = d.qualidade;
  if (q && q.ano) {
    partes.push(
      tx(
        `Na continuidade de ${q.ano}, ${fraseLimite("o DEC", q.dec, q.dec_limite, "horas", idioma)}, e ${fraseLimite("o FEC", q.fec, q.fec_limite, "interrupções", idioma)}.`,
        `In continuity of supply for ${q.ano}, ${fraseLimite("DEC", q.dec, q.dec_limite, "hours", idioma)}, and ${fraseLimite("FEC", q.fec, q.fec_limite, "interruptions", idioma)}.`,
        idioma,
      ),
    );
  } else {
    partes.push(tx("Não há indicadores de continuidade publicados para ela no ano de referência.", "No continuity indicators are published for it in the reference year.", idioma));
  }
  const t = d.tarifa;
  if (t && t.vigente) {
    const valor = temValor(t.total) ? `R$ ${num(t.total, 2, idioma)}/MWh` : semDado(idioma);
    partes.push(
      tx(
        `A tarifa residencial B1 vigente desde ${dataTexto(t.inicio, idioma)} é de ${valor}, sem tributos (${t.ato ?? "ato sem número publicado"}).`,
        `The residential B1 tariff in force since ${dataTexto(t.inicio, idioma)} is ${valor}, excluding taxes (${t.ato ?? "act without a published number"}).`,
        idioma,
      ),
    );
  } else if (t && !t.vigente) {
    partes.push(
      tx(
        `Não há tarifa residencial vigente: ${t.motivo ?? "motivo não publicado"}.`,
        `There is no residential tariff in force: ${t.motivo ? motivoTarifa(t.motivo, idioma) : "reason not published"}.`,
        idioma,
      ),
    );
  } else {
    partes.push(tx("Ela não aparece nas tarifas de aplicação.", "It does not appear in the application tariffs.", idioma));
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
export function paresPerdas(d: Distribuidora, ix: readonly Distribuidora[], idioma: Idioma = idiomaEnergia()): Pares | null {
  const v = d.perdas?.taxa_total_pct;
  const ano = d.perdas?.ano;
  if (!d.grupo || !temValor(v) || !ano) return null;
  const pares = ix.filter((x) => x.grupo === d.grupo && x.perdas?.ano === ano && temValor(x.perdas.taxa_total_pct));
  const itens = pares
    .map((x) => ({ id: x.slug, rotulo: rotuloDistribuidora(x), valor: x.perdas!.taxa_total_pct as number, referencia: null }))
    .sort((a, b) => a.valor - b.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const conc = d.grupo === "concessionaria";
  return {
    regra: tx(
      `${conc ? "concessionárias" : "permissionárias"} com taxa de perdas em ${ano}`,
      `${conc ? "concession holders" : "permit holders"} with a loss rate in ${ano}`,
      idioma,
    ),
    ano,
    total: itens.length,
    posicao: 1 + itens.filter((x) => x.valor < v).length,
    itens,
  };
}

/** Pares na continuidade: mesmo grupo e, quando a ANEEL publica o porte do ranking, o mesmo porte. Posição pelo DEC. */
export function paresQualidade(d: Distribuidora, ix: readonly Distribuidora[], idioma: Idioma = idiomaEnergia()): Pares | null {
  const q = d.qualidade;
  if (!d.grupo || !q || !q.ano || !temValor(q.dec)) return null;
  const pares = ix.filter(
    (x) => x.grupo === d.grupo && x.qualidade?.ano === q.ano && temValor(x.qualidade.dec) && (q.porte ? x.qualidade.porte === q.porte : true),
  );
  const itens = pares
    .map((x) => ({ id: x.slug, rotulo: rotuloDistribuidora(x), valor: x.qualidade!.dec as number, referencia: x.qualidade!.dec_limite }))
    .sort((a, b) => a.valor - b.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const conc = d.grupo === "concessionaria";
  const porteEn = q.porte === "grande" ? "large" : q.porte === "pequeno" ? "small" : q.porte;
  return {
    regra: tx(
      `${conc ? "concessionárias" : "permissionárias"}${q.porte ? ` de porte ${q.porte} no ranking da ANEEL` : ""} com DEC em ${q.ano}`,
      `${conc ? "concession holders" : "permit holders"}${q.porte ? ` of ${porteEn} size in the ANEEL ranking` : ""} with DEC in ${q.ano}`,
      idioma,
    ),
    ano: q.ano,
    total: itens.length,
    posicao: 1 + itens.filter((x) => x.valor < (q.dec as number)).length,
    itens,
  };
}

export function textoPares(sigla: string, medida: string, p: Pares | null, id?: string, idioma: Idioma = idiomaEnergia()): string {
  if (!p) return tx(`Sem pares comparáveis para ${medida}: falta o grupo, o ano de referência ou o valor.`, `No comparable peers for ${medida}: the group, the reference year or the value is missing.`, idioma);
  const meu = p.itens.find((x) => (id ? x.id === id : x.rotulo === sigla))?.valor;
  const base = tx(
    `Entre as ${inteiro(p.total, idioma)} ${p.regra}, a ${sigla} ocupa a posição ${posicaoTexto(p.posicao, p.total, idioma)} em ordem crescente de ${medida}`,
    `Among the ${inteiro(p.total, idioma)} ${p.regra}, ${sigla} ranks ${posicaoTexto(p.posicao, p.total, idioma)} in ascending order of ${medida}`,
    idioma,
  );
  // a ordem é da menor para a maior: a 1ª tem o menor valor e a última, o maior; a posição descreve a ordem do valor, sem juízo de qualidade
  if (typeof meu === "number" && meu < 0)
    return tx(`${base}. O valor é negativo na fonte, e por isso a posição não indica a menor perda.`, `${base}. The value is negative in the source, so the position does not indicate the lowest loss.`, idioma);
  const sentido =
    p.posicao === p.total
      ? tx(`: é o maior valor do grupo`, `: it is the highest value in the group`, idioma)
      : p.posicao === 1
        ? tx(`: é o menor valor do grupo`, `: it is the lowest value in the group`, idioma)
        : "";
  return tx(`${base}${sentido}. A ordem é do menor para o maior valor.`, `${base}${sentido}. The order runs from the lowest to the highest value.`, idioma);
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
  const [iAno, iMeses, iCompleto, iTaxa, iPnt] = [i("ano"), i("meses"), i("completo"), i("taxa_total_pct"), i("pnt_bt_pct")]; // i18n: dado
  if (iAno < 0 || iTaxa < 0) return [];
  return linhas.map((l) => {
    const taxa = typeof l[iTaxa] === "number" ? (l[iTaxa] as number) : null;
    const completo = iCompleto >= 0 ? l[iCompleto] === 1 || l[iCompleto] === true : true;
    return {
      ano: String(l[iAno]),
      taxa_completo: completo ? taxa : null,
      taxa_parcial: completo ? null : taxa,
      meses: iMeses >= 0 && typeof l[iMeses] === "number" ? (l[iMeses] as number) : null,
      completo: completo ? "sim" : "não", // i18n: dado
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
    total: n(v[i("total")]), // i18n: dado
  }));
}

export const COLUNAS_EVOLUCAO_PERDAS: ColunaTabela[] = [
  {
    id: "ano", // i18n: dado
    get rotulo() {
      return tx("Ano", "Year");
    },
    tipo: "texto",
  },
  {
    id: "taxa_completo",
    get rotulo() {
      return tx("Perdas totais, ano completo", "Total losses, complete year");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "taxa_parcial",
    get rotulo() {
      return tx("Perdas totais, ano incompleto", "Total losses, incomplete year");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "meses",
    get rotulo() {
      return tx("Meses no SAMP", "Months in SAMP");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "completo",
    get rotulo() {
      return tx("Ano completo", "Complete year");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "pnt_bt_pct",
    get rotulo() {
      return tx("Não técnicas sobre o mercado de baixa tensão", "Non-technical losses over the low-voltage market");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "brasil",
    get rotulo() {
      return tx("Referência: concessionárias do Brasil", "Reference: concession holders in Brazil");
    },
    tipo: "percentual",
    casas: 2,
  },
];
export const COLUNAS_EVOLUCAO_QUALIDADE: ColunaTabela[] = [
  {
    id: "ano", // i18n: dado
    get rotulo() {
      return tx("Ano", "Year");
    },
    tipo: "texto",
  },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  {
    id: "dec_limite",
    get rotulo() {
      return tx("Limite do DEC", "DEC limit");
    },
    tipo: "numero",
    unidade: "h",
    casas: 2,
  },
  {
    id: "fec",
    rotulo: "FEC",
    tipo: "numero",
    get unidade() {
      return tx("interrupções", "interruptions");
    },
    casas: 2,
  },
  {
    id: "fec_limite",
    get rotulo() {
      return tx("Limite do FEC", "FEC limit");
    },
    tipo: "numero",
    get unidade() {
      return tx("interrupções", "interruptions");
    },
    casas: 2,
  },
];
export const COLUNAS_EVOLUCAO_TARIFA: ColunaTabela[] = [
  {
    id: "inicio",
    get rotulo() {
      return tx("Início da vigência", "Start of validity");
    },
    tipo: "data",
  },
  {
    id: "fim",
    get rotulo() {
      return tx("Fim da vigência", "End of validity");
    },
    tipo: "data",
  },
  {
    id: "ato",
    get rotulo() {
      return tx("Ato", "Act");
    },
    tipo: "texto",
    literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" },
  },
  { id: "te", rotulo: "TE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "tusd", rotulo: "TUSD", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "total", rotulo: "Total", tipo: "numero", unidade: "R$/MWh", casas: 2 }, // i18n: dado (rótulo igual nos dois idiomas)
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
export function linksOrigem(d: Pick<Distribuidora, "cnpj" | "perdas" | "qualidade" | "tarifa">, idioma: Idioma = idiomaEnergia()): { rotulo: string; href: string }[] {
  const out: { rotulo: string; href: string }[] = [];
  if (d.perdas) out.push({ rotulo: tx("Perdas, com o mapa por conjunto e município", "Losses, with the map by consumer set and municipality", idioma), href: `/setor-eletrico/perdas?d=${d.cnpj}` });
  if (d.qualidade) out.push({ rotulo: tx("Qualidade do serviço, com os conjuntos elétricos", "Quality of supply, with the consumer sets", idioma), href: `/setor-eletrico/qualidade?dist=${d.cnpj}` });
  if (d.tarifa) out.push({ rotulo: tx("Conta de luz, com o histórico tarifário", "Electricity bill, with the tariff history", idioma), href: `/setor-eletrico/conta-de-luz?dist=${d.cnpj}` });
  return out;
}

/* ================================================================ P038: finanças */

export const ROTULO_ALERTA: Readonly<Record<string, string>> = {
  get consolidado_nao_apresentado() {
    return tx("consolidado não apresentado (exibido o individual)", "consolidated not presented (individual shown)");
  },
  get inicio_inconsistente_na_fonte() {
    return tx("data de início inconsistente na fonte (exercício aceito com nota)", "inconsistent start date in the source (fiscal year accepted with a note)");
  },
  get escala_corrigida() {
    return tx("escala convertida pelo observatório (estimado)", "scale converted by the observatory (estimated)");
  },
  get fluxos_nao_preenchidos() {
    return tx("DRE e DFC não preenchidas (ausentes)", "income statement (DRE) and cash flow statement (DFC) not filled in (missing)");
  },
  get dre_zerada_na_fonte() {
    return tx("DRE zerada na fonte, sem prova de não preenchimento", "income statement (DRE) zeroed in the source, with no proof it was left unfilled");
  },
};

export function rotuloEscopo(e: EscopoCvm | null, idioma: Idioma = idiomaEnergia()): string {
  return e === "con" ? tx("consolidado", "consolidated", idioma) : e === "ind" ? tx("individual", "individual", idioma) : semDado(idioma);
}

/** Rótulo da conta da CVM publicado pela gold, no idioma da página. */
export function rotuloConta(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  return traduzir(CONTA_CVM_EN, rotulo, idioma);
}

/** Situação do registro e setor declarado na CVM, no idioma da página. */
export function rotuloSituacaoCvm(s: string, idioma: Idioma = idiomaEnergia()): string {
  return traduzir(SITUACAO_CVM_EN, s, idioma);
}
export function rotuloSetorCvm(s: string, idioma: Idioma = idiomaEnergia()): string {
  return traduzir(SETOR_CVM_EN, s, idioma);
}

/** Resposta curta do P038: universo, períodos e revisões, com a cobertura dita (não é o setor inteiro). */
export function respostaFinancas(f: Financas, idioma: Idioma = idiomaEnergia()): string {
  const u = f.universo;
  const p = f.periodos;
  const e = f.exclusoes.escala;
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  return tx(
    `${I(u.companhias)} companhias abertas do setor elétrico estão no cadastro da CVM (${I(u.ativas)} ativas); ${I(u.com_dfp)} têm demonstrações anuais (DFP), até o exercício de ${p.ultimo_exercicio ?? semDado(idioma)}, e ${I(u.com_itr)} têm informações trimestrais (ITR), até ${dataTexto(p.ultimo_trimestre, idioma)}. ` +
      `${I(f.revisoes.valores_reapresentados)} valores foram reapresentados pela própria companhia no ano seguinte, e ${I(e.valores_corrigidos)} tiveram a escala convertida pelo observatório. ${u.nota_cobertura}`,
    `${I(u.companhias)} publicly held power sector companies are in the CVM registry (${I(u.ativas)} active); ${I(u.com_dfp)} have annual financial statements (DFP), up to fiscal year ${p.ultimo_exercicio ?? semDado(idioma)}, and ${I(u.com_itr)} have quarterly information (ITR), up to ${dataTexto(p.ultimo_trimestre, idioma)}. ` +
      `${I(f.revisoes.valores_reapresentados)} values were restated by the company itself in the following year, and ${I(e.valores_corrigidos)} had their scale converted by the observatory. ${traduzir(NOTA_EMPRESAS_EN, u.nota_cobertura, idioma)}`,
    idioma,
  );
}

export const COLUNAS_COMPANHIAS: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Companhia", "Company");
    },
    tipo: "texto",
  },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "situacao",
    get rotulo() {
      return tx("Situação na CVM", "Status at CVM");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "setor",
    get rotulo() {
      return tx("Setor declarado", "Declared sector");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "ultimo_exercicio",
    get rotulo() {
      return tx("Último exercício", "Latest fiscal year");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "escopo",
    get rotulo() {
      return tx("Escopo exibido", "Scope shown");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "receita",
    get rotulo() {
      return tx("Receita", "Net revenue");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "ebit",
    get rotulo() {
      return tx("Resultado antes do financeiro e dos tributos", "Earnings before financial result and taxes (EBIT)");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "lucro_liquido",
    get rotulo() {
      return tx("Lucro líquido", "Net income");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "divida_bruta",
    get rotulo() {
      return tx("Dívida bruta", "Gross debt");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "patrimonio_liquido",
    get rotulo() {
      return tx("Patrimônio líquido", "Shareholders' equity");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "ativo_total",
    get rotulo() {
      return tx("Ativo total", "Total assets");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "caixa_investimento",
    get rotulo() {
      return tx("Caixa das atividades de investimento", "Cash from investing activities");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "alertas",
    get rotulo() {
      return tx("Avisos", "Warnings");
    },
    tipo: "texto",
  },
  {
    id: "controladora",
    get rotulo() {
      return tx("Controladora aberta (consolida esta)", "Publicly held parent (consolidates this one)");
    },
    tipo: "texto",
  },
  {
    id: "reapresentados",
    get rotulo() {
      return tx("Valores reapresentados", "Restated values");
    },
    tipo: "numero",
    casas: 0,
  },
];
export function linhasCompanhias(cs: readonly Companhia[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return cs.map((c) => {
    const v = c.valores;
    return {
      id: c.cnpj,
      nome: nomeOuCnpj(c.nome, c.cnpj, idioma),
      cnpj: cnpjFormatado(c.cnpj, idioma),
      situacao: c.situacao === null ? null : rotuloSituacaoCvm(c.situacao, idioma),
      setor: c.setor === null ? null : rotuloSetorCvm(c.setor, idioma),
      ultimo_exercicio: c.ultimo_exercicio === null ? null : String(c.ultimo_exercicio),
      escopo: c.escopo_exibido ? rotuloEscopo(c.escopo_exibido, idioma) : null,
      receita: emMilhoes(v?.receita),
      ebit: emMilhoes(v?.ebit),
      lucro_liquido: emMilhoes(v?.lucro_liquido),
      divida_bruta: emMilhoes(v?.divida_bruta),
      patrimonio_liquido: emMilhoes(v?.patrimonio_liquido),
      ativo_total: emMilhoes(v?.ativo_total),
      caixa_investimento: emMilhoes(v?.caixa_investimento),
      alertas: c.alertas.length ? c.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ") : null,
      controladora: c.controladora_aberta ? nomeOuCnpj(c.controladora_aberta.nome, c.controladora_aberta.cnpj, idioma) : null,
      reapresentados: c.valores_reapresentados,
    };
  });
}

export function entidadesCompanhias(cs: readonly Companhia[], idioma: Idioma = idiomaEnergia()): EntidadeBuscavel[] {
  return cs.map((c) => ({
    id: c.cnpj,
    rotulo: nomeOuCnpj(c.nome, c.cnpj, idioma),
    detalhe: `${c.situacao != null ? rotuloSituacaoCvm(c.situacao, idioma) : semDado(idioma)}${c.ultimo_exercicio ? tx(` · DFP até ${c.ultimo_exercicio}`, ` · DFP up to ${c.ultimo_exercicio}`, idioma) : tx(" · sem DFP", " · no DFP", idioma)}`,
    sinonimos: [c.cnpj, cnpjFormatado(c.cnpj, idioma), ...(c.cd_cvm ? [c.cd_cvm] : []), ...(c.distribuidora_slug ? [c.distribuidora_slug] : [])],
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
  get trimestre() {
    return tx("valor do trimestre (três meses)", "value for the quarter (three months)");
  },
  get acumulado_no_ano() {
    return tx("acumulado desde janeiro", "year to date since January");
  },
  get saldo() {
    return tx("saldo no fim do trimestre", "balance at the end of the quarter");
  },
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
export function textoCompanhia(c: Companhia, contas: readonly DefinicaoConta[], idioma: Idioma = idiomaEnergia()): string {
  const nome = nomeOuCnpj(c.nome, c.cnpj, idioma);
  if (!c.valores || !c.ultimo_exercicio)
    return tx(
      `${nome} não tem demonstração anual (DFP) no período lido; só aparece no cadastro${c.ultimo_trimestre ? ` e nas informações trimestrais até ${dataTexto(c.ultimo_trimestre, idioma)}` : ""}.`,
      `${nome} has no annual financial statements (DFP) in the period read; it only appears in the registry${c.ultimo_trimestre ? ` and in the quarterly information up to ${dataTexto(c.ultimo_trimestre, idioma)}` : ""}.`,
      idioma,
    );
  const v = c.valores;
  const rot = (id: ContaCvm) => {
    const r = contas.find((x) => x.id === id)?.rotulo;
    if (!r) return id;
    return idioma === "en" ? rotuloConta(r, idioma).toLocaleLowerCase("en-US") : r.toLocaleLowerCase("pt-BR");
  };
  const M = (x: number | null | undefined) => reaisMilhoes(x, idioma);
  // uma só unidade no parágrafo e nos cartões (R$ milhões, como as tabelas e os gráficos): bilhões e milhões alternados faziam o mesmo valor parecer outro
  const partes = [
    tx(
      `No exercício de ${c.ultimo_exercicio}, ${nome} (${rotuloEscopo(c.escopo_exibido, idioma)}) reportou receita de ${M(v.receita)}, lucro líquido de ${M(v.lucro_liquido)} e ${rot("caixa_investimento")} de ${M(v.caixa_investimento)}; no fim do exercício, a dívida bruta era de ${M(v.divida_bruta)} e o patrimônio líquido de ${M(v.patrimonio_liquido)}.`,
      `In fiscal year ${c.ultimo_exercicio}, ${nome} (${rotuloEscopo(c.escopo_exibido, idioma)}) reported net revenue of ${M(v.receita)}, net income of ${M(v.lucro_liquido)} and ${rot("caixa_investimento")} of ${M(v.caixa_investimento)}; at the end of the fiscal year, gross debt was ${M(v.divida_bruta)} and shareholders' equity ${M(v.patrimonio_liquido)}.`,
      idioma,
    ),
  ];
  if (c.alertas.length) partes.push(tx(`Avisos: ${c.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ")}.`, `Warnings: ${c.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ")}.`, idioma));
  if (c.controladora_aberta) {
    const ctl = nomeOuCnpj(c.controladora_aberta.nome, c.controladora_aberta.cnpj, idioma);
    partes.push(tx(`A controladora aberta ${ctl} já consolida estes números: os dois não se somam.`, `The publicly held parent ${ctl} already consolidates these figures: the two are not added together.`, idioma));
  }
  if (c.controla_abertas.length)
    partes.push(
      tx(
        `Ela consolida ${plural(c.controla_abertas.length, "outra companhia aberta do universo", "outras companhias abertas do universo", idioma)}; os números não se somam.`,
        `It consolidates ${plural(c.controla_abertas.length, "other publicly held company in the universe", "other publicly held companies in the universe", idioma)}; the figures are not added together.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

function plural(n: number, um: string, varios: string, idioma: Idioma = idiomaEnergia()): string {
  return `${num(n, 0, idioma)} ${n === 1 ? um : varios}`;
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
export function contasGrafico(contas: readonly DefinicaoConta[], idioma: Idioma = idiomaEnergia()): { id: ContaCvm; rotulo: string; tipo: "fluxo" | "saldo"; codigo: string }[] {
  return contas.filter((c) => IDS_CONTAS.includes(c.id)).map((c) => ({ id: c.id, rotulo: rotuloConta(c.rotulo, idioma), tipo: c.tipo, codigo: c.codigo }));
}

/** Resumo por CNPJ para os números de destaque das finanças (nome, exercício, escopo e avisos). */
export function resumoCompanhias(cs: readonly Companhia[], idioma: Idioma = idiomaEnergia()): Record<string, { nome: string; exercicio: number | null; escopo: EscopoCvm | null; alertas: string[] }> {
  return Object.fromEntries(cs.map((c) => [c.cnpj, { nome: nomeOuCnpj(c.nome, c.cnpj, idioma), exercicio: c.ultimo_exercicio, escopo: c.escopo_exibido, alertas: c.alertas }]));
}

export const COLUNAS_CONTAS: ColunaTabela[] = [
  {
    id: "rotulo",
    get rotulo() {
      return tx("Conta", "Account");
    },
    tipo: "texto",
  },
  {
    id: "codigo",
    get rotulo() {
      return tx("Código no plano padronizado", "Code in the standardized chart of accounts");
    },
    tipo: "texto",
  },
  {
    id: "demonstracao",
    get rotulo() {
      return tx("Demonstração", "Statement");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "tipo",
    get rotulo() {
      return tx("Tipo", "Type");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "definicao",
    get rotulo() {
      return tx("Definição", "Definition");
    },
    tipo: "texto",
  },
];
export function linhasContas(contas: readonly DefinicaoConta[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return contas.map((c) => ({
    id: c.id,
    rotulo: rotuloConta(c.rotulo, idioma),
    codigo: c.codigo,
    demonstracao: c.demonstracao,
    tipo: c.tipo === "fluxo" ? tx("fluxo do período", "flow for the period", idioma) : tx("saldo no fim do período", "balance at the end of the period", idioma),
    definicao: traduzir(DEFINICAO_CONTA_EN, c.definicao, idioma),
  }));
}

export const COLUNAS_NAO_APRESENTADAS: ColunaTabela[] = [
  {
    id: "companhia",
    get rotulo() {
      return tx("Companhia", "Company");
    },
    tipo: "texto",
  },
  {
    id: "documento",
    get rotulo() {
      return tx("Documento", "Document");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "escopo",
    get rotulo() {
      return tx("Escopo", "Scope");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "data",
    get rotulo() {
      return tx("Data", "Date");
    },
    tipo: "data",
  },
  {
    id: "motivo",
    get rotulo() {
      return tx("Motivo", "Reason");
    },
    tipo: "texto",
    categorica: true,
  },
];
export function linhasNaoApresentadas(f: Financas, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const nomes = new Map(f.companhias.map((c) => [c.cnpj, nomeOuCnpj(c.nome, c.cnpj, idioma)]));
  return f.exclusoes.colunas_nao_apresentadas.exercicio_ou_trimestre.map((x) => ({
    id: `${x.cnpj}|${x.escopo}|${x.data}|${x.documento}`,
    companhia: nomes.get(x.cnpj) ?? `CNPJ ${cnpjFormatado(x.cnpj, idioma)}`,
    documento: x.documento,
    escopo: rotuloEscopo(x.escopo, idioma),
    data: x.data,
    motivo:
      x.motivo === "escopo_nao_apresentado"
        ? tx("escopo não apresentado (o outro escopo tem ativo)", "scope not presented (the other scope has assets)", idioma)
        : tx("demonstração zerada nos dois escopos", "statement zeroed in both scopes", idioma),
  }));
}

export const COLUNAS_SALTOS: ColunaTabela[] = [
  {
    id: "companhia",
    get rotulo() {
      return tx("Companhia", "Company");
    },
    tipo: "texto",
  },
  {
    id: "escopo",
    get rotulo() {
      return tx("Escopo", "Scope");
    },
    tipo: "texto",
  },
  {
    id: "de", // i18n: dado
    get rotulo() {
      return tx("Ativo antes", "Assets before");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 3,
  },
  {
    id: "para", // i18n: dado
    get rotulo() {
      return tx("Ativo depois", "Assets after");
    },
    tipo: "numero",
    get unidade() {
      return tx("R$ milhões", "R$ million");
    },
    casas: 1,
  },
  {
    id: "razao",
    get rotulo() {
      return tx("Razão", "Ratio");
    },
    tipo: "numero",
    casas: 0,
  },
];
export function linhasSaltos(f: Financas, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const nomes = new Map(f.companhias.map((c) => [c.cnpj, nomeOuCnpj(c.nome, c.cnpj, idioma)]));
  return f.exclusoes.saltos_ativo.casos.map((x, i) => ({
    id: `${x.cnpj}|${x.escopo}|${i}`,
    companhia: nomes.get(x.cnpj) ?? `CNPJ ${cnpjFormatado(x.cnpj, idioma)}`,
    escopo: rotuloEscopo(x.escopo, idioma),
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
  get nao_concentrado() {
    return tx("não concentrado", "unconcentrated");
  },
  get moderado() {
    return tx("moderadamente concentrado", "moderately concentrated");
  },
  get alto() {
    return tx("altamente concentrado", "highly concentrated");
  },
};

/** Faixa do HHI no idioma pedido (o mapa acima segue o idioma da página). */
function faixaHhi(f: FaixaHhi, idioma: Idioma): string {
  if (f === "alto") return tx("altamente concentrado", "highly concentrated", idioma);
  if (f === "moderado") return tx("moderadamente concentrado", "moderately concentrated", idioma);
  return tx("não concentrado", "unconcentrated", idioma);
}

/**
 * Limiares das faixas descritivas do HHI no Guia para Análise de Atos de Concentração Horizontal do
 * CADE (2016), conferido no PDF oficial pelo pipeline (documento do módulo, seção 2). São
 * referência de leitura, não dado: a faixa de cada valor vem calculada da gold, e o teste confere
 * que estes limiares são os mesmos do catálogo de métricas e que classificam igual à gold.
 */
export const LIMIARES_HHI_CADE = { moderado: 1500, alto: 2500 } as const;

/** Rótulos curtos dos níveis para o eixo do gráfico, que trunca nomes longos (a tabela mantém os completos). */
export const ROTULO_NIVEL_CURTO: Readonly<Record<"proprietario_direto" | "grupo_proporcional" | "grupo_controle", string>> = {
  get proprietario_direto() {
    return tx("Dono direto (proporcional)", "Direct owner (proportional)");
  },
  get grupo_proporcional() {
    return tx("Grupo (proporcional)", "Group (proportional)");
  },
  get grupo_controle() {
    return tx("Grupo (sob controle)", "Group (under control)");
  },
};

export const ROTULO_NIVEL: Readonly<Record<"proprietario_direto" | "grupo_proporcional" | "grupo_controle", string>> = {
  get proprietario_direto() {
    return tx("Proprietário direto (capacidade proporcional)", "Direct owner (proportional capacity)");
  },
  get grupo_proporcional() {
    return tx("Grupo de controle (capacidade proporcional)", "Controlling group (proportional capacity)");
  },
  get grupo_controle() {
    return tx("Grupo de controle (capacidade sob controle)", "Controlling group (capacity under control)");
  },
};

/** Resposta curta do P039: HHI e CR por grupo sobre a fronteira explícita, o maior grupo e a cobertura do grafo. */
export function respostaControle(c: Controle, idioma: Idioma = idiomaEnergia()): string {
  const g = c.concentracao.grupo_proporcional;
  const f = c.fronteira;
  const maior = g?.maiores[0];
  const partes = [
    tx(
      `Na fronteira de ${mwTexto(f.mw, 1, idioma)} em ${inteiro(f.usinas, idioma)} usinas em operação (SIGA de ${dataTexto(f.data, idioma)}), os grupos de controle declarados à ANEEL somam um HHI de ${numTexto(g?.hhi, 0, idioma)} pontos pela capacidade proporcional${g?.faixa ? `, ${faixaHhi(g.faixa, idioma)} nas faixas do Guia do CADE` : ""}; os 4 maiores grupos têm ${pctTexto(g?.cr4, 2, idioma)} da potência e os 10 maiores, ${pctTexto(g?.cr10, 2, idioma)}.`,
      `Within the boundary of ${mwTexto(f.mw, 1, idioma)} in ${inteiro(f.usinas, idioma)} plants in operation (SIGA as of ${dataTexto(f.data, idioma)}), the controlling groups declared to ANEEL add up to an HHI of ${numTexto(g?.hhi, 0, idioma)} points by proportional capacity${g?.faixa ? `, ${faixaHhi(g.faixa, idioma)} in the bands of the CADE Guide` : ""}; the 4 largest groups hold ${pctTexto(g?.cr4, 2, idioma)} of the capacity and the 10 largest, ${pctTexto(g?.cr10, 2, idioma)}.`,
      idioma,
    ),
  ];
  if (maior) partes.push(tx(`O maior é ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, com ${pctTexto(maior.pct, 2, idioma)}.`, `The largest is ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, with ${pctTexto(maior.pct, 2, idioma)}.`, idioma));
  partes.push(
    tx(
      `${pctTexto(c.cobertura.pct_mw_consolidado_em_grupo, 2, idioma)} da capacidade proporcional está em proprietários com um grupo declarado acima deles; nos demais, o próprio proprietário é o topo da cadeia.`,
      `${pctTexto(c.cobertura.pct_mw_consolidado_em_grupo, 2, idioma)} of proportional capacity is held by owners with a group declared above them; for the rest, the owner itself is the top of the chain.`,
      idioma,
    ),
  );
  return partes.join(" ");
}

export const COLUNAS_NIVEIS: ColunaTabela[] = [
  {
    id: "nivel",
    get rotulo() {
      return tx("Nível", "Level");
    },
    tipo: "texto",
  },
  {
    id: "hhi",
    rotulo: "HHI",
    tipo: "numero",
    get unidade() {
      return tx("pontos", "points");
    },
    casas: 1,
  },
  {
    id: "faixa",
    get rotulo() {
      return tx("Faixa (Guia do CADE)", "Band (CADE Guide)");
    },
    tipo: "texto",
  },
  { id: "cr4", rotulo: "CR4", tipo: "percentual", casas: 2 },
  { id: "cr10", rotulo: "CR10", tipo: "percentual", casas: 2 },
  {
    id: "participantes",
    get rotulo() {
      return tx("Participantes", "Participants");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "maior", // i18n: dado
    get rotulo() {
      return tx("Maior participante", "Largest participant");
    },
    tipo: "texto",
  },
  {
    id: "maior_pct",
    get rotulo() {
      return tx("Cota do maior", "Share of the largest");
    },
    tipo: "percentual",
    casas: 2,
  },
];
export function linhasNiveis(cc: Controle["concentracao"], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  const niveis = ["proprietario_direto", "grupo_proporcional", "grupo_controle"] as const;
  return niveis
    .map((id) => [id, cc[id]] as const)
    .filter((x): x is readonly [(typeof niveis)[number], Concentracao] => !!x[1])
    .map(([id, c]) => ({
      id,
      nivel: ROTULO_NIVEL[id],
      nivel_curto: ROTULO_NIVEL_CURTO[id],
      hhi: c.hhi,
      faixa: c.faixa ? faixaHhi(c.faixa, idioma) : null,
      cr4: c.cr4,
      cr10: c.cr10,
      participantes: c.participantes,
      maior: c.maiores[0] ? nomeOuCnpj(c.maiores[0].nome, c.maiores[0].cnpj, idioma) : null,
      maior_pct: c.maiores[0]?.pct ?? null,
    }));
}

export const COLUNAS_TIPOS: ColunaTabela[] = [
  {
    id: "tipo",
    get rotulo() {
      return tx("Tipo de usina", "Plant type");
    },
    tipo: "texto",
  },
  {
    id: "mw",
    get rotulo() {
      return tx("Potência na fronteira", "Capacity within the boundary");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "hhi",
    get rotulo() {
      return tx("HHI por grupo", "HHI by group");
    },
    tipo: "numero",
    get unidade() {
      return tx("pontos", "points");
    },
    casas: 1,
  },
  {
    id: "faixa",
    get rotulo() {
      return tx("Faixa (Guia do CADE)", "Band (CADE Guide)");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "cr4",
    get rotulo() {
      return tx("CR4 por grupo", "CR4 by group");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "participantes",
    get rotulo() {
      return tx("Grupos", "Groups");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "maior", // i18n: dado
    get rotulo() {
      return tx("Maior grupo", "Largest group");
    },
    tipo: "texto",
  },
  {
    id: "maior_pct",
    get rotulo() {
      return tx("Cota do maior", "Share of the largest");
    },
    tipo: "percentual",
    casas: 2,
  },
];
export function linhasTipos(ts: readonly ConcentracaoTipo[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return ts.map((t) => ({
    id: t.tipo,
    tipo: rotuloTipo(t.tipo, idioma),
    mw: t.mw,
    hhi: t.hhi_grupo,
    faixa: t.faixa ? faixaHhi(t.faixa, idioma) : null,
    cr4: t.cr4_grupo,
    participantes: t.participantes,
    maior: t.maior ? nomeOuCnpj(t.maior.nome, t.maior.cnpj, idioma) : null,
    maior_pct: t.maior?.pct ?? null,
  }));
}

/** Frase do recorte por tipo: o de maior HHI e quantos grupos tem (sem afirmar causa). */
export function textoTipos(ts: readonly ConcentracaoTipo[], idioma: Idioma = idiomaEnergia()): string {
  const validos = ts.filter((t) => temValor(t.hhi_grupo));
  if (!validos.length) return tx("Sem HHI por tipo de usina nesta publicação.", "No HHI by plant type in this release.", idioma);
  const maior = validos.slice().sort((a, b) => (b.hhi_grupo as number) - (a.hhi_grupo as number))[0];
  const menor = validos.slice().sort((a, b) => (a.hhi_grupo as number) - (b.hhi_grupo as number))[0];
  return tx(
    `Por tipo de usina, o HHI por grupo vai de ${numTexto(menor.hhi_grupo, 0, idioma)} pontos (${rotuloTipo(menor.tipo, idioma)}, ${inteiro(menor.participantes, idioma)} grupos) a ${numTexto(maior.hhi_grupo, 0, idioma)} pontos ` +
      `(${rotuloTipo(maior.tipo, idioma)}, ${plural(maior.participantes, "grupo", "grupos", idioma)}).`,
    `By plant type, the HHI by group ranges from ${numTexto(menor.hhi_grupo, 0, idioma)} points (${rotuloTipo(menor.tipo, idioma)}, ${plural(menor.participantes, "group", "groups", idioma)}) to ${numTexto(maior.hhi_grupo, 0, idioma)} points ` +
      `(${rotuloTipo(maior.tipo, idioma)}, ${plural(maior.participantes, "group", "groups", idioma)}).`,
    idioma,
  );
}

export const ROTULO_MOTIVO: Readonly<Record<MotivoParada, string>> = {
  get sem_declaracao() {
    return tx("sem declaração na janela", "no declaration in the window");
  },
  get ambigua() {
    return tx("declarações discordantes", "conflicting declarations");
  },
  get sem_controlador() {
    return tx("nenhum sócio controlador", "no controlling shareholder");
  },
  get compartilhado() {
    return tx("controle compartilhado", "shared control");
  },
  get pessoa_fisica() {
    return tx("controlador pessoa física", "individual controlling shareholder");
  },
  get sem_cnpj() {
    return tx("controlador sem CNPJ", "controlling shareholder without CNPJ");
  },
  get ciclo() {
    return tx("ciclo na cadeia", "cycle in the chain");
  },
};

export const COLUNAS_GRUPOS: ColunaTabela[] = [
  {
    id: "nome",
    get rotulo() {
      return tx("Grupo (topo da cadeia)", "Group (top of the chain)");
    },
    tipo: "texto",
  },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "mw_proporcional",
    get rotulo() {
      return tx("Capacidade proporcional", "Proportional capacity");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "participacao_pct",
    get rotulo() {
      return tx("Da fronteira", "Of the boundary");
    },
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "mw_controle",
    get rotulo() {
      return tx("Capacidade sob controle", "Capacity under control");
    },
    tipo: "numero",
    unidade: "MW",
    casas: 1,
  },
  {
    id: "usinas_controle",
    get rotulo() {
      return tx("Usinas sob controle", "Plants under control");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "empresas_com_usinas",
    get rotulo() {
      return tx("Empresas do grupo com usinas", "Group companies with plants");
    },
    tipo: "numero",
    casas: 0,
  },
  {
    id: "motivo",
    get rotulo() {
      return tx("Por que a cadeia para aqui", "Why the chain stops here");
    },
    tipo: "texto",
    categorica: true,
  },
  {
    id: "acima",
    get rotulo() {
      return tx("Acima do topo (sem CNPJ)", "Above the top (no CNPJ)");
    },
    tipo: "texto",
  },
  {
    id: "listada",
    get rotulo() {
      return tx("Companhia aberta", "Publicly held company");
    },
    tipo: "texto",
    categorica: true,
  },
];
export function linhasGrupos(gs: readonly Grupo[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return gs.map((g) => ({
    id: g.cnpj,
    nome: nomeOuCnpj(g.nome, g.cnpj, idioma),
    cnpj: cnpjFormatado(g.cnpj, idioma),
    mw_proporcional: g.mw_proporcional,
    participacao_pct: g.participacao_pct,
    mw_controle: g.mw_controle,
    usinas_controle: g.usinas_controle,
    empresas_com_usinas: g.empresas_com_usinas,
    motivo: ROTULO_MOTIVO[g.motivo_parada] ?? g.motivo_parada,
    acima: g.acima,
    listada: simNao(g.listada_cvm, idioma),
  }));
}

/** Barras dos maiores grupos (as mesmas linhas da tabela, só as primeiras n), proporcional e sob controle lado a lado. */
export function barrasGrupos(gs: readonly Grupo[], n = 12, idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string; mw_proporcional: number | null; mw_controle: number | null }[] {
  return gs.slice(0, n).map((g) => ({ id: g.cnpj, rotulo: nomeOuCnpj(g.nome, g.cnpj, idioma), mw_proporcional: g.mw_proporcional, mw_controle: g.mw_controle }));
}

export const COLUNAS_MOTIVOS: ColunaTabela[] = [
  {
    id: "rotulo",
    get rotulo() {
      return tx("Por que a cadeia para", "Why the chain stops");
    },
    tipo: "texto",
  },
  {
    id: "proprietarios",
    get rotulo() {
      return tx("Proprietários diretos", "Direct owners");
    },
    tipo: "numero",
    casas: 0,
  },
];
export function linhasMotivos(c: Controle["cobertura"], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return c.motivos_parada.map((m) => ({ id: m.motivo, rotulo: traduzir(MOTIVO_PARADA_GOLD_EN, m.rotulo, idioma), proprietarios: m.proprietarios }));
}

export const COLUNAS_PERIODOS_POLIMERO: ColunaTabela[] = [
  {
    id: "trimestre",
    get rotulo() {
      return tx("Trimestre", "Quarter");
    },
    tipo: "texto",
  },
  {
    id: "declarantes",
    get rotulo() {
      return tx("Agentes declarantes", "Declaring agents");
    },
    tipo: "numero",
    casas: 0,
  },
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
export function textoArvore(a: ArvoreSocietaria, motivos: readonly { motivo: string; rotulo: string }[] = [], idioma: Idioma = idiomaEnergia()): string {
  const nome = nomeOuCnpj(a.raiz.nome, a.raiz.cnpj, idioma);
  const topo = a.cadeia[a.cadeia.length - 1];
  const motivo = a.motivoTopo ? motivoExplicado(a.motivoTopo, motivos, idioma) : tx("motivo não publicado", "reason not published", idioma);
  const topoNome = nomeOuCnpj(topo.nome, topo.cnpj, idioma);
  const subida =
    a.cadeia.length > 1
      ? tx(
          `A cadeia de controladores únicos declarada à ANEEL sobe ${plural(a.cadeia.length - 1, "nível", "níveis", idioma)} de ${nome} até ${topoNome}`,
          `The chain of single controlling shareholders declared to ANEEL rises ${plural(a.cadeia.length - 1, "level", "levels", idioma)} from ${nome} to ${topoNome}`,
          idioma,
        )
      : tx(`${nome} é o próprio topo da cadeia declarada à ANEEL`, `${nome} is itself the top of the chain declared to ANEEL`, idioma);
  return tx(
    `${subida}, e para ali: ${motivo}. ${plural(a.socios.length, "sócio direto declarado", "sócios diretos declarados", idioma)}; aparece como sócia controladora (sozinha ou em controle compartilhado) de ${plural(a.controladas.length, "empresa", "empresas", idioma)}.`,
    `${subida}, and stops there: ${motivo}. ${plural(a.socios.length, "direct shareholder declared", "direct shareholders declared", idioma)}; it appears as controlling shareholder (alone or in shared control) of ${plural(a.controladas.length, "company", "companies", idioma)}.`,
    idioma,
  );
}

/** Estado da árvore na URL: o CNPJ escolhido (prefixo "ctl."). */
export const ESQUEMA_CONTROLE = { e: campo(leitorCnpj, "", { param: "ctl.e" }) };

/** Entidades que a busca da árvore oferece antes do arquivo da cadeia chegar: grupos, proprietários e distribuidoras da gold. */
export function entidadesControle(gs: readonly Grupo[], ps: readonly Proprietario[], ix: readonly Distribuidora[], idioma: Idioma = idiomaEnergia()): EntidadeBuscavel[] {
  const m = new Map<string, EntidadeBuscavel>();
  for (const g of gs) m.set(g.cnpj, { id: g.cnpj, rotulo: nomeOuCnpj(g.nome, g.cnpj, idioma), detalhe: tx("grupo de controle", "controlling group", idioma), sinonimos: [cnpjFormatado(g.cnpj, idioma)] });
  for (const p of ps) if (!m.has(p.cnpj)) m.set(p.cnpj, { id: p.cnpj, rotulo: nomeOuCnpj(p.nome, p.cnpj, idioma), detalhe: tx("proprietário de usinas", "plant owner", idioma), sinonimos: [cnpjFormatado(p.cnpj, idioma)] });
  for (const d of ix)
    if (!m.has(d.cnpj))
      m.set(d.cnpj, { id: d.cnpj, rotulo: d.sigla, detalhe: tx(`distribuidora · ${d.nome ?? semDado(idioma)}`, `distribution utility · ${d.nome ?? semDado(idioma)}`, idioma), sinonimos: [cnpjFormatado(d.cnpj, idioma), d.nome ?? ""] });
  return Array.from(m.values());
}

/** Todas as entidades do arquivo da cadeia (para a busca depois que ele chega). */
export function entidadesCadeia(c: CadeiaSocietaria, idioma: Idioma = idiomaEnergia()): EntidadeBuscavel[] {
  return Object.entries(c.nos).map(([cnpj, [nome]]) => ({ id: cnpj, rotulo: nomeOuCnpj(nome, cnpj, idioma), detalhe: cnpjFormatado(cnpj, idioma), sinonimos: [cnpj] }));
}

/* ================================================================ vereditos (resposta em duas camadas) */

/**
 * Cada veredito responde, em palavras simples e com poucos números, à pergunta do título do painel, a partir dos mesmos
 * campos da resposta completa (que continua inteira como segunda camada). Nenhuma frase traz número fixo: todo número
 * vem do argumento, e a ausência vira "sem dado". Termo técnico novo fica fora do veredito.
 */

function listaE(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/**
 * P036: o maior dono direto de usinas em operação (pela capacidade proporcional, a mesma ordem do gráfico), quanto da potência em
 * operação tem todos os donos identificados pelo CNPJ e o limite de leitura. A ligação dos módulos de transmissão ao CNPJ está no número
 * da página e na resposta completa; só a ausência do SIGET é dita aqui.
 */
export function vereditoCadastro(c: Cadastro, idioma: Idioma = idiomaEnergia()): string {
  const a = c.ativos;
  const t = c.transmissao;
  const maior = c.proprietarios.reduce<Proprietario | null>((m, p) => (temValor(p.mw_proporcional) && (!m || p.mw_proporcional > (m.mw_proporcional as number)) ? p : m), null);
  const dono = maior
    ? tx(
        `O maior dono direto é ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, com ${mwTexto(maior.mw_proporcional, 1, idioma)} de capacidade proporcional.`,
        `The largest direct owner is ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, with ${mwTexto(maior.mw_proporcional, 1, idioma)} of proportional capacity.`,
        idioma,
      )
    : "";
  const usinas = tx(
    `No SIGA de ${dataTexto(a.data, idioma)}, ${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} da potência em operação tem todos os donos identificados.`,
    `In SIGA as of ${dataTexto(a.data, idioma)}, ${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} of the capacity in operation has all owners identified.`,
    idioma,
  );
  const linhas = t ? "" : tx(" Os ativos de transmissão não estão nesta publicação.", " Transmission assets are not in this release.", idioma);
  return `${dono ? `${dono} ` : ""}${usinas}${linhas} ${tx("Capacidade instalada não é energia gerada.", "Installed capacity is not energy generated.", idioma)}`;
}

/**
 * P037: o universo de distribuidoras e, quando a gold de Perdas publica a taxa nacional do mesmo ano, a escala para
 * ler a ficha de cada uma. O que cada ficha reúne está na resposta completa.
 */
export function vereditoDistribuidoras(d: Distribuidoras, nacional: number | null = null, ano: number | null = null, idioma: Idioma = idiomaEnergia()): string {
  const r = d.resumo;
  const base = tx(`O observatório reúne ${inteiro(r.distribuidoras, idioma)} distribuidoras pelo CNPJ.`, `The observatory brings together ${inteiro(r.distribuidoras, idioma)} distribution utilities by CNPJ.`, idioma);
  const ficha = tx(
    "a ficha de cada empresa mostra as perdas dela, a continuidade do serviço e a tarifa residencial",
    "each company's profile shows its losses, continuity of supply and residential tariff",
    idioma,
  );
  if (temValor(nacional) && ano)
    return tx(
      `${base} Em ${ano}, a taxa nacional de perdas das concessionárias foi de ${pct(nacional, 2, idioma)} da energia injetada; ${ficha}.`,
      `${base} In ${ano}, the national loss rate of concession holders was ${pct(nacional, 2, idioma)} of the energy injected; ${ficha}.`,
      idioma,
    );
  return `${base} ${ficha.charAt(0).toUpperCase()}${ficha.slice(1)}.`;
}

/** P038: quantas companhias reportam, até quando, e a regra de não somar entre elas. */
export function vereditoFinancas(f: Financas, idioma: Idioma = idiomaEnergia()): string {
  const u = f.universo;
  const p = f.periodos;
  return tx(
    `As ${inteiro(u.companhias, idioma)} companhias abertas do setor elétrico na CVM reportam receita, resultado, dívida e patrimônio; ${inteiro(u.com_dfp, idioma)} têm demonstrações anuais até ${p.ultimo_exercicio ?? semDado(idioma)}. Escolha uma companhia para ver a evolução; valores de companhias diferentes não se somam.`,
    `The ${inteiro(u.companhias, idioma)} publicly held power sector companies at CVM report revenue, earnings, debt and equity; ${inteiro(u.com_dfp, idioma)} have annual financial statements up to ${p.ultimo_exercicio ?? semDado(idioma)}. Choose a company to see how it has evolved; values of different companies are not added together.`,
    idioma,
  );
}

/** P039: o maior grupo, o HHI com a escala e a faixa, e o limite de leitura (capacidade instalada, não poder de mercado). */
export function vereditoControle(c: Controle, idioma: Idioma = idiomaEnergia()): string {
  const g = c.concentracao.grupo_proporcional;
  const maior = g?.maiores[0];
  const grupo = maior
    ? tx(
        `O maior grupo de controle, ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, tem ${pctTexto(maior.pct, 2, idioma)} da potência em operação.`,
        `The largest controlling group, ${nomeOuCnpj(maior.nome, maior.cnpj, idioma)}, holds ${pctTexto(maior.pct, 2, idioma)} of the capacity in operation.`,
        idioma,
      )
    : tx("Não há grupo de controle com potência publicada.", "There is no controlling group with published capacity.", idioma);
  const hhi = tx(
    `O índice de concentração (HHI), de 0 a 10.000, é ${numTexto(g?.hhi, 0, idioma)}${g?.faixa ? `: ${faixaHhi(g.faixa, idioma)} nas faixas do Guia do CADE` : ""}.`,
    `The concentration index (HHI), from 0 to 10,000, is ${numTexto(g?.hhi, 0, idioma)}${g?.faixa ? `: ${faixaHhi(g.faixa, idioma)} in the bands of the CADE Guide` : ""}.`,
    idioma,
  );
  return `${grupo} ${hhi} ${tx("É capacidade instalada, não poder de mercado.", "This is installed capacity, not market power.", idioma)}`;
}

/**
 * Ficha: perdas (com a taxa nacional das concessionárias quando a página a traz), continuidade diante do limite da própria
 * distribuidora e tarifa residencial. "Dentro" e "acima" só diante do limite que a ANEEL fixa para ela, decidido na
 * precisão exibida; "abaixo da taxa nacional" só com a referência nacional do mesmo ano.
 */
export function vereditoFicha(d: Distribuidora, nacional: number | null = null, idioma: Idioma = idiomaEnergia()): string {
  const p = d.perdas;
  const q = d.qualidade;
  const dentro = (s: ReturnType<typeof sentidoLimite>) => s === "abaixo" || s === "igual";
  let abertura: string;
  if (p && temValor(p.taxa_total_pct) && p.ano) {
    const incompleto = p.completo === false ? tx(" (ano incompleto no SAMP)", " (incomplete year in SAMP)", idioma) : "";
    if (p.taxa_total_pct < 0) {
      abertura = tx(
        `Em ${p.ano}, a ${d.sigla} tem perda total negativa na fonte, de ${pct(p.taxa_total_pct, 2, idioma)}${incompleto}, que o observatório mostra sem corrigir`,
        `In ${p.ano}, ${d.sigla} has negative total losses in the source, of ${pct(p.taxa_total_pct, 2, idioma)}${incompleto}, which the observatory shows without correcting`,
        idioma,
      );
    } else {
      const s = temValor(nacional) ? sentidoLimite(p.taxa_total_pct, nacional) : null;
      const comp =
        s === "abaixo"
          ? tx(", abaixo da taxa nacional das concessionárias", ", below the national rate of concession holders", idioma)
          : s === "acima"
            ? tx(", acima da taxa nacional das concessionárias", ", above the national rate of concession holders", idioma)
            : s === "igual"
              ? tx(", igual à taxa nacional das concessionárias", ", equal to the national rate of concession holders", idioma)
              : "";
      abertura = tx(
        `Em ${p.ano}, a ${d.sigla} perdeu ${pct(p.taxa_total_pct, 2, idioma)} da energia injetada${incompleto}${comp}`,
        `In ${p.ano}, ${d.sigla} lost ${pct(p.taxa_total_pct, 2, idioma)} of the energy injected${incompleto}${comp}`,
        idioma,
      );
    }
  } else if (p) {
    abertura = tx(`A ${d.sigla} não tem perdas no ano de referência do SAMP`, `${d.sigla} has no losses in the SAMP reference year`, idioma);
  } else {
    abertura = tx(`A ${d.sigla} não aparece no SAMP`, `${d.sigla} does not appear in SAMP`, idioma);
  }
  let continuidade: string;
  if (q && q.ano) {
    const dec = sentidoLimite(q.dec, q.dec_limite);
    const fec = sentidoLimite(q.fec, q.fec_limite);
    const quando = p?.ano === q.ano ? "" : tx(`em ${q.ano}, `, `in ${q.ano}, `, idioma);
    if (!dec && !fec) continuidade = tx(`${quando}a continuidade não tem dado comparável com o limite`, `${quando}continuity of supply has no data comparable with the limit`, idioma);
    else if (dec && fec) {
      if (dentro(dec) && dentro(fec))
        continuidade = tx(`${quando}as interrupções ficaram dentro dos limites de duração e de frequência`, `${quando}interruptions stayed within the duration and frequency limits`, idioma);
      else if (!dentro(dec) && !dentro(fec))
        continuidade = tx(`${quando}as interrupções ficaram acima dos limites de duração e de frequência`, `${quando}interruptions were above the duration and frequency limits`, idioma);
      else
        continuidade = dentro(dec)
          ? tx(
              `${quando}as interrupções ficaram dentro do limite de duração e acima do limite de frequência`,
              `${quando}interruptions stayed within the duration limit and above the frequency limit`,
              idioma,
            )
          : tx(
              `${quando}as interrupções ficaram acima do limite de duração e dentro do limite de frequência`,
              `${quando}interruptions were above the duration limit and within the frequency limit`,
              idioma,
            );
    } else {
      const s = dec ?? fec;
      const nome = dec ? tx("duração", "duration", idioma) : tx("frequência", "frequency", idioma);
      const outro = dec ? tx("frequência", "frequency", idioma) : tx("duração", "duration", idioma);
      continuidade = tx(
        `${quando}a ${nome} das interrupções ficou ${dentro(s) ? "dentro do" : "acima do"} limite, e a ${outro} ficou sem dado`,
        `${quando}the ${nome} of interruptions was ${dentro(s) ? "within" : "above"} the limit, and the ${outro} had no data`,
        idioma,
      );
    }
  } else {
    continuidade = tx("não há indicador de continuidade publicado para o ano de referência", "there is no continuity indicator published for the reference year", idioma);
  }
  const t = d.tarifa;
  const tarifa =
    t && t.vigente && temValor(t.total)
      ? tx(`A tarifa residencial vigente é de R$ ${num(t.total, 2, idioma)}/MWh, sem tributos.`, `The residential tariff in force is R$ ${num(t.total, 2, idioma)}/MWh, excluding taxes.`, idioma)
      : t && !t.vigente
        ? tx(
            `Não há tarifa residencial vigente: ${(t.motivo ?? "motivo não publicado").split(";")[0]}.`,
            `There is no residential tariff in force: ${(t.motivo ? motivoTarifa(t.motivo, idioma) : "reason not published").split(";")[0]}.`,
            idioma,
          )
        : tx("Ela não aparece nas tarifas de aplicação.", "It does not appear in the application tariffs.", idioma);
  return tx(`${abertura}, e ${continuidade}. ${tarifa}`, `${abertura}, and ${continuidade}. ${tarifa}`, idioma);
}

/**
 * Concilia a fronteira do painel de controle com o total em operação do cadastro: a fronteira é menor porque deixa de fora as
 * usinas sem proprietário informado ou com participações que não somam 100% (contagem por estado do vínculo, na gold) e as
 * que não têm potência fiscalizada para contar (o resto da diferença). Todo número vem da gold.
 */
export function textoFronteiraNoCadastro(f: Controle["fronteira"], a: Ativos, idioma: Idioma = idiomaEnergia()): string {
  const fora = a.operacao.usinas - f.usinas;
  if (fora <= 0) return "";
  const semParticipacao = a.estados.filter((e) => e.estado === "sem_proprietario" || e.estado === "soma_divergente").reduce((n, e) => n + e.usinas_operacao, 0);
  const resto = fora - semParticipacao;
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  const W = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  return tx(
    `A fronteira (${W(f.mw)} em ${I(f.usinas)} usinas) é menor que o total em operação do cadastro (${W(f.mw_operacao_total)} em ${I(a.operacao.usinas)} usinas): ficam de fora ${I(fora)} usinas e ${W(f.mw_fora)}, ` +
      `sendo ${I(semParticipacao)} usinas sem proprietário informado ou com participações que não somam 100%${resto > 0 ? ` e ${I(resto)} sem potência fiscalizada para contar` : ""}.`,
    `The boundary (${W(f.mw)} in ${I(f.usinas)} plants) is smaller than the registry's total in operation (${W(f.mw_operacao_total)} in ${I(a.operacao.usinas)} plants): ${I(fora)} plants and ${W(f.mw_fora)} are left out, ` +
      `of which ${I(semParticipacao)} plants have no reported owner or stakes that do not add up to 100%${resto > 0 ? ` and ${I(resto)} have no inspected capacity to count` : ""}.`,
    idioma,
  );
}

/** O que a conciliação com o RALIE lê da gold de Expansão (estagios.ralie). */
export type RalieResumo = {
  data_ralie: string;
  usinas: number;
  mw_outorgado: number | null;
  mw_ugs_em_implantacao: number | null;
  fase_no_siga: { fase: string; usinas: number }[];
};

/**
 * Concilia as fases de construção do SIGA com a carteira do RALIE: duas fontes da ANEEL, duas datas e duas medidas (a
 * potência outorgada por usina, no SIGA, e a das unidades geradoras em implantação, no RALIE). A diferença de usinas vem das
 * que o RALIE lista e o SIGA já tem em operação ou não tem, e das que o SIGA tem em construção e o RALIE não lista; os dois
 * números do cruzamento (fase_no_siga) são os da gold de Expansão.
 */
export function textoFasesSigaERalie(a: Ativos, ralie: RalieResumo | null, idioma: Idioma = idiomaEnergia()): string {
  const construcao = a.por_fase.filter((f) => f.fase === "Construção" || f.fase === "Construção não iniciada");
  const usinas = construcao.reduce((n, f) => n + f.usinas, 0);
  const mw = construcao.reduce((n, f) => n + (f.mw_outorgado ?? 0), 0);
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  const W = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const siga = tx(
    `No SIGA de ${dataTexto(a.data, idioma)}, as fases Construção e Construção não iniciada somam ${I(usinas)} usinas e ${W(mw)} de potência outorgada.`,
    `In SIGA as of ${dataTexto(a.data, idioma)}, the Construction and Construction not started phases add up to ${I(usinas)} plants and ${W(mw)} of granted capacity.`,
    idioma,
  );
  if (!ralie) return siga;
  const na = (f: string) => ralie.fase_no_siga.find((x) => x.fase === f)?.usinas ?? 0;
  // i18n: dado
  const emConstrucao = na("Construção") + na("Construção não iniciada");
  // i18n: dado
  const ausentes = ralie.fase_no_siga.filter((x) => x.fase !== "Construção" && x.fase !== "Construção não iniciada" && x.fase !== "Operação").reduce((n, x) => n + x.usinas, 0);
  const emOperacao = na("Operação"); // i18n: dado
  return tx(
    `${siga} O RALIE, outra fonte da ANEEL, acompanhava em ${dataTexto(ralie.data_ralie, idioma)} ${I(ralie.usinas)} usinas em implantação: ${W(ralie.mw_outorgado)} de potência outorgada e ${W(ralie.mw_ugs_em_implantacao)} de potência das unidades geradoras em implantação, o número que a página Expansão destaca. ` +
      `Das ${I(ralie.usinas)}, ${I(emConstrucao)} estão nessas duas fases do SIGA, ${I(emOperacao)} já aparecem em operação e ${I(ausentes)} não aparecem no SIGA; das ${I(usinas)} do SIGA, ${I(usinas - emConstrucao)} não estão no RALIE. ` +
      "Por isso os dois totais não coincidem: mudam a fonte, a data e a medida.",
    `${siga} RALIE, another ANEEL source, was tracking ${I(ralie.usinas)} plants under implementation as of ${dataTexto(ralie.data_ralie, idioma)}: ${W(ralie.mw_outorgado)} of granted capacity and ${W(ralie.mw_ugs_em_implantacao)} of capacity of generating units under implementation, the figure the Expansion page highlights. ` +
      `Of the ${I(ralie.usinas)}, ${I(emConstrucao)} are in these two SIGA phases, ${I(emOperacao)} already appear in operation and ${I(ausentes)} do not appear in SIGA; of the ${I(usinas)} in SIGA, ${I(usinas - emConstrucao)} are not in RALIE. ` +
      "That is why the two totals do not match: the source, the date and the measure differ.",
    idioma,
  );
}

/** Concessionárias de transmissão do mesmo grupo entre as maiores, ditas uma vez para o gráfico não parecer ter empresas sem relação. */
export function textoGruposNaTransmissao(t: Transmissao, idioma: Idioma = idiomaEnergia()): string {
  const porGrupo = new Map<string, { nome: string | null; n: number }>();
  for (const a of t.maiores) {
    const k = a.grupo ?? a.cnpj;
    const x = porGrupo.get(k) ?? { nome: a.grupo ? a.grupo_nome : a.nome, n: 0 };
    x.n += 1;
    porGrupo.set(k, x);
  }
  const reunidos = Array.from(porGrupo.values()).filter((x) => x.n > 1);
  if (!reunidos.length) return "";
  const frase = reunidos.map((x) => tx(`${inteiro(x.n, idioma)} do grupo ${x.nome ?? semDado(idioma)}`, `${inteiro(x.n, idioma)} from the ${x.nome ?? semDado(idioma)} group`, idioma));
  return tx(
    `Entre as ${inteiro(t.maiores.length, idioma)} maiores concessionárias, ${listaE(frase, idioma)}: empresas do mesmo grupo aparecem separadas no gráfico, e a tabela dos grupos, abaixo, as reúne.`,
    `Among the ${inteiro(t.maiores.length, idioma)} largest concession holders, ${listaE(frase, idioma)}: companies from the same group appear separately in the chart, and the groups table below brings them together.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- abertura: busca por empresa e passos do vínculo */

/** Empresa da busca da abertura: uma por CNPJ, com os destinos úteis (ficha, demonstrações, árvore de controle). */
export type EntidadeEmpresa = EntidadeBuscavel & { destinos: { rotulo: string; href: string }[] };

/**
 * Entidades da busca da abertura, uma por CNPJ, para que a busca leve à ficha útil e nunca a um relatório de cobertura: as
 * distribuidoras (a ficha reúne perdas, continuidade, tarifa, controle e demonstrações), as companhias abertas do universo da CVM
 * (demonstrações já com a companhia escolhida) e os maiores proprietários e grupos de controle da gold (árvore societária).
 * Empresas fora dessas listas estão na busca da árvore de controle, que lê o arquivo inteiro da cadeia. Todo dado vem da gold.
 */
export function entidadesBuscaEmpresas(g: Pick<EmpresasGold, "distribuidoras" | "financas" | "cadastro" | "controle">, idioma: Idioma = idiomaEnergia()): EntidadeEmpresa[] {
  type Reg = { rotulo: string; razao: string | null; papeis: string[]; sinonimos: Set<string>; destinos: { rotulo: string; href: string }[] };
  const m = new Map<string, Reg>();
  const porSlug = new Map<string, string>();
  const reg = (cnpj: string, rotulo: string, razao: string | null): Reg => {
    let r = m.get(cnpj);
    if (!r) {
      r = { rotulo, razao, papeis: [], sinonimos: new Set([cnpjFormatado(cnpj, idioma)]), destinos: [] };
      m.set(cnpj, r);
    }
    return r;
  };
  const papel = (r: Reg, p: string) => {
    if (!r.papeis.includes(p)) r.papeis.push(p);
  };
  const destino = (r: Reg, rotulo: string, href: string) => {
    if (!r.destinos.some((d) => d.href === href)) r.destinos.push({ rotulo, href });
  };
  for (const d of g.distribuidoras.indice) {
    const r = reg(d.cnpj, d.sigla, d.nome);
    papel(
      r,
      tx(
        `${d.ativa ? "distribuidora" : "distribuidora inativa"}${d.ufs.length ? ` em ${d.ufs.join(", ")}` : ""}`,
        `${d.ativa ? "distribution utility" : "inactive distribution utility"}${d.ufs.length ? ` in ${d.ufs.join(", ")}` : ""}`,
        idioma,
      ),
    );
    r.sinonimos.add(d.slug);
    for (const s of d.siglas) r.sinonimos.add(s.sigla);
    for (const s of d.slugs_alternativos) r.sinonimos.add(s);
    if (d.ufs.length) r.sinonimos.add(d.ufs.join(" "));
    destino(r, tx("Ficha da distribuidora", "Distribution utility profile", idioma), rotaEntidade(d.slug));
    porSlug.set(d.slug, d.cnpj);
  }
  for (const c of g.financas.companhias) {
    // a companhia que é distribuidora do índice já tem a ficha, que traz as demonstrações dela
    const dono = c.distribuidora_slug ? porSlug.get(c.distribuidora_slug) : undefined;
    const r = dono ? m.get(dono)! : reg(c.cnpj, nomeOuCnpj(c.nome, c.cnpj, idioma), c.nome);
    r.sinonimos.add(cnpjFormatado(c.cnpj, idioma));
    if (c.cd_cvm) r.sinonimos.add(c.cd_cvm);
    if (c.nome) r.sinonimos.add(c.nome);
    papel(
      r,
      c.situacao === "ATIVO"
        ? tx("companhia aberta", "publicly held company", idioma)
        : tx("companhia aberta, registro cancelado ou suspenso", "publicly held company, registration cancelled or suspended", idioma),
    );
    if (!dono) destino(r, tx("Demonstrações na CVM", "Financial statements at CVM", idioma), `${rotaPainel("p038")}?fin.sel=${c.cnpj}#p038`);
  }
  const controle = (cnpj: string, nome: string | null, p: string) => {
    const r = reg(cnpj, nomeOuCnpj(nome, cnpj, idioma), nome);
    papel(r, p);
    destino(r, tx("Árvore de controle", "Control tree", idioma), `${rotaPainel("p039")}?ctl.e=${cnpj}#p039`);
  };
  for (const p of g.cadastro.proprietarios) controle(p.cnpj, p.nome, tx("dono direto de usinas", "direct owner of plants", idioma));
  for (const x of g.controle.grupos) controle(x.cnpj, x.nome, tx("grupo de controle", "controlling group", idioma));
  return Array.from(m.entries()).map(([cnpj, r]) => ({
    id: cnpj,
    rotulo: r.rotulo,
    detalhe: [r.razao && r.razao !== r.rotulo ? r.razao : null, `CNPJ ${cnpjFormatado(cnpj, idioma)}`, r.papeis.join(", ")].filter(Boolean).join(" · "),
    sinonimos: Array.from(r.sinonimos),
    destinos: r.destinos,
  }));
}

/** `liga` completa a frase "Documentado ...": já traz a preposição contraída ("pelo", "pela"). */
export type PassoVinculo = { id: "empresa" | "participacao" | "ativo" | "controle"; titulo: string; liga: string; contagem: string };

/**
 * Os quatro elos que ligam empresa, ativo e controle, cada um com o identificador que o documenta e a contagem que a gold publica.
 * Nenhum elo é feito por semelhança de nome: o CNPJ (ou o CEG, ou o módulo do SIGET) vem da própria fonte, no mesmo registro.
 */
export function passosVinculo(g: Pick<EmpresasGold, "cadastro" | "controle" | "distribuidoras" | "financas">, idioma: Idioma = idiomaEnergia()): PassoVinculo[] {
  const a = g.cadastro.ativos;
  const t = g.cadastro.transmissao;
  const grupos = g.controle.concentracao.grupo_proporcional?.participantes;
  const I = (v: number | null | undefined) => inteiro(v, idioma);
  return [
    {
      id: "empresa",
      titulo: tx("Empresa", "Company", idioma),
      liga: tx("pelo CNPJ de 14 dígitos", "by the 14-digit CNPJ", idioma),
      contagem: tx(
        `${I(a.proprietarios_cnpj)} donos de usinas, ${I(g.distribuidoras.resumo.distribuidoras)} distribuidoras e ${I(g.financas.universo.companhias)} companhias abertas; as listas se sobrepõem`,
        `${I(a.proprietarios_cnpj)} plant owners, ${I(g.distribuidoras.resumo.distribuidoras)} distribution utilities and ${I(g.financas.universo.companhias)} publicly held companies; the lists overlap`,
        idioma,
      ),
    },
    {
      id: "participacao",
      titulo: tx("Participação direta", "Direct stake", idioma),
      liga: tx("pelo percentual de cada dono no registro da usina", "by each owner's percentage in the plant record", idioma),
      contagem: tx(
        `${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} da potência em operação tem todos os donos identificados por CNPJ`,
        `${pctTexto(a.pct_mw_operacao_vinculado, 2, idioma)} of the capacity in operation has all owners identified by CNPJ`,
        idioma,
      ),
    },
    {
      id: "ativo",
      titulo: tx("Ativo", "Asset", idioma),
      liga: tx(
        `pelo CEG (${SIGLAS.CEG}) da usina e pelo módulo de transmissão do SIGET (${SIGLAS.SIGET}), com o CNPJ do contrato`,
        `by the plant's CEG (${SIGLAS_IDIOMAS.en.CEG}) and by the SIGET (${SIGLAS_IDIOMAS.en.SIGET}) transmission module, with the contract's CNPJ`,
        idioma,
      ),
      contagem: tx(
        `${I(a.usinas)} usinas${t ? ` e ${I(t.resumo.modulos)} módulos de transmissão` : ""}`,
        `${I(a.usinas)} plants${t ? ` and ${I(t.resumo.modulos)} transmission modules` : ""}`,
        idioma,
      ),
    },
    {
      id: "controle",
      titulo: tx("Controle declarado", "Declared control", idioma),
      liga: tx("pela cadeia de sócios controladores que cada agente declara à ANEEL", "by the chain of controlling shareholders that each agent declares to ANEEL", idioma),
      contagem: tx(`${I(grupos)} grupos no topo das cadeias, pela capacidade proporcional`, `${I(grupos)} groups at the top of the chains, by proportional capacity`, idioma),
    },
  ];
}

/* ---------------------------------------------------------------- leitura das fichas */

/**
 * Tira de um texto escrito para a gold o nome interno de campo entre parênteses ("(campo qualidade.porte)"), que o leitor
 * de Entender não consulta.
 */
export function semNomesDeCampo(texto: string): string {
  return texto
    .replace(/\s*\((?:campo\s+)?[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\)/g, "")
    .replace(/\s*\((?:[a-z]+[A-Z]|[A-Z][a-z]+[A-Z])[A-Za-z0-9]*\)/g, "");
}

/**
 * Rótulo da distribuidora nos gráficos de pares: a sigla; quando a sigla coincide com uma sigla que o observatório expande
 * como outra coisa (ESS é a distribuidora Energisa Sul-Sudeste e também a sigla de Encargos de Serviços do Sistema), o nome
 * da empresa sem o complemento depois do hífen, para a legenda de siglas não confundir as duas.
 */
export function rotuloDistribuidora(d: Pick<Distribuidora, "sigla" | "nome">): string {
  if (!(d.sigla in SIGLAS) || !d.nome) return d.sigla;
  const curto = d.nome.split(/\s+[-–]\s+/)[0].trim();
  return curto || d.sigla;
}

/**
 * Parâmetros dos gráficos de pares para que a distribuidora da página apareça entre as linhas visíveis ao abrir: a ordem
 * parte da ponta mais próxima dela (crescente se ela está na primeira metade, decrescente se na segunda) e a altura visível
 * vai até a linha dela e uma a mais. `posicao` é a posição na ordem crescente (1 é o menor valor).
 */
export function janelaDosPares(posicao: number, total: number, alturaLinha: number, minimo: number): { crescente: boolean; alturaMaxima: number } {
  const deCima = Math.max(1, posicao);
  const deBaixo = Math.max(1, total - posicao + 1);
  const crescente = deCima <= deBaixo;
  const linhas = Math.min(deCima, deBaixo);
  return { crescente, alturaMaxima: Math.max(minimo, (linhas + 1) * alturaLinha) };
}

/** Pares com valor negativo na fonte: quais são, para dizer uma vez que a barra negativa é a medida da fonte. Vazio sem negativos. */
export function textoNegativos(p: Pares | null, idioma: Idioma = idiomaEnergia()): string {
  if (!p) return "";
  const neg = p.itens.filter((i) => i.valor < 0);
  if (!neg.length) return "";
  const lista = listaE(
    neg.map((n) => n.rotulo),
    idioma,
  );
  return tx(
    `${neg.length === 1 ? "Uma distribuidora do grupo tem" : `${inteiro(neg.length, idioma)} distribuidoras do grupo têm`} valor negativo na fonte (${lista}): barra negativa é a medida publicada pelo SAMP, mostrada sem correção.`,
    `${neg.length === 1 ? "One distribution utility in the group has" : `${inteiro(neg.length, idioma)} distribution utilities in the group have`} a negative value in the source (${lista}): a negative bar is the measure published by SAMP, shown without correction.`,
    idioma,
  );
}

/** Anos de uma série com valor negativo na fonte, para dizer uma vez o que os valores negativos significam. */
export function textoAnosNegativos(pontos: readonly Pick<PontoPerdas, "ano" | "taxa_completo" | "taxa_parcial">[], idioma: Idioma = idiomaEnergia()): string {
  const neg = pontos.filter((x) => (x.taxa_completo ?? x.taxa_parcial ?? 0) < 0);
  if (!neg.length) return "";
  const lista = neg.map((x) => `${x.ano} (${pct((x.taxa_completo ?? x.taxa_parcial) as number, 2, idioma)})`);
  return tx(
    `Anos com perda total negativa na fonte: ${listaE(lista, idioma)}. Valor negativo é a medida publicada pelo SAMP; o observatório não o corrige.`,
    `Years with negative total losses in the source: ${listaE(lista, idioma)}. A negative value is the measure published by SAMP; the observatory does not correct it.`,
    idioma,
  );
}

/**
 * Motivo da parada da cadeia de controle em palavras que o leitor entende: a explicação que a gold publica
 * (cobertura.motivos_parada, por exemplo "declarações do mesmo trimestre discordam sobre quem é o controlador") no lugar do
 * rótulo curto ("declarações discordantes"), que fica nas tabelas. Sem a explicação, o rótulo curto.
 */
export function motivoExplicado(motivo: MotivoParada, motivos: readonly { motivo: string; rotulo: string }[] = [], idioma: Idioma = idiomaEnergia()): string {
  const explicado = motivos.find((m) => m.motivo === motivo)?.rotulo;
  if (explicado) return traduzir(MOTIVO_PARADA_GOLD_EN, explicado, idioma);
  return ROTULO_MOTIVO[motivo] ?? motivo;
}

/** Resumo dos sócios diretos: quantos, quantos marcados como controlador pela própria declaração, quantos sem CNPJ. */
export function textoSocios(socios: readonly SocioArvore[], idioma: Idioma = idiomaEnergia()): string {
  if (!socios.length) return "";
  const ctl = socios.filter((s) => s.controlador).length;
  const semDoc = socios.filter((s) => !s.cnpj).length;
  return tx(
    `${plural(socios.length, "sócio direto declarado", "sócios diretos declarados", idioma)}, ${ctl === 0 ? "nenhum marcado" : `${inteiro(ctl, idioma)} ${ctl === 1 ? "marcado" : "marcados"}`} como controlador na declaração à ANEEL e ${inteiro(semDoc, idioma)} sem CNPJ.`,
    `${plural(socios.length, "direct shareholder declared", "direct shareholders declared", idioma)}, ${ctl === 0 ? "none marked" : `${inteiro(ctl, idioma)} marked`} as controlling in the declaration to ANEEL and ${inteiro(semDoc, idioma)} without CNPJ.`,
    idioma,
  );
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
