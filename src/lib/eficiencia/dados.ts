import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { join } from "node:path";
import type { GoldEducacao, IndicadorId, StatusDado } from "./tipos";
import { GRUPOS_REF, type DadosPainel, type DescritorExterno, type ExternaCompacta, type ObsCompacta, type RefCompacta } from "./consulta";

/**
 * Leitura da gold do painel no build (página estática). Arquivo ausente ou
 * ilegível devolve null: a página mostra o estado de indisponibilidade com o
 * motivo, nunca um número de reserva.
 */
const ARQUIVO = join(process.cwd(), "public", "eficiencia", "gold", "educacao_capitais.json");

let cache: GoldEducacao | null | undefined;

export type RevisaoCatalogo = { versao: string; data: string; resumo: string };

/** Histórico de revisões metodológicas do catálogo (pipeline/eficiencia/catalogo_indicadores.json), lido na geração da página; vazio se o arquivo não estiver disponível. */
export function historicoDoCatalogo(): RevisaoCatalogo[] {
  try {
    const c = JSON.parse(readFileSync(join(process.cwd(), "pipeline", "eficiencia", "catalogo_indicadores.json"), "utf-8")) as { historico?: RevisaoCatalogo[] };
    return Array.isArray(c.historico) ? c.historico : [];
  } catch {
    return [];
  }
}

export function goldEducacao(): GoldEducacao | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(ARQUIVO, "utf-8")) as GoldEducacao;
  } catch {
    cache = null;
  }
  return cache;
}

/**
 * Datas de geração e de captura da gold, lidas do início do arquivo (o bloco `meta` é o primeiro) sem
 * interpretar o arquivo inteiro. Usado onde só a data de atualização interessa. Ausente: null.
 */
export function metaEducacao(): { gerado_em: string | null; dados_capturados_ate: string | null } | null {
  try {
    const fd = openSync(ARQUIVO, "r");
    try {
      const buf = Buffer.alloc(4096);
      const n = readSync(fd, buf, 0, buf.length, 0);
      const cab = buf.toString("utf-8", 0, n);
      const pega = (k: string) => cab.match(new RegExp(`"${k}"\\s*:\\s*"([^"]+)"`))?.[1] ?? null;
      return { gerado_em: pega("gerado_em"), dados_capturados_ate: pega("dados_capturados_ate") };
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}


/** Parcela intraorçamentária da função Educação por capital e ano (RREO, 6º bimestre), em % da função; pares sem RREO ficam de fora. */
function intraPct(g: GoldEducacao): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const o of g.observacoes) {
    if (o.indicador !== "edu.despesa.funcao_educacao" || o.componente !== "nominal" || o.status !== "OBSERVADO") continue;
    const r = o.conferencia?.rreo;
    if (!r || r.intra === null || r.intra === undefined) continue;
    const total = r.exceto_intra + r.intra;
    if (!(total > 0)) continue;
    out.push([o.ano, o.ente, Number(((100 * r.intra) / total).toFixed(4))]);
  }
  return out;
}

/**
 * Payload do cliente: só o recorte que a página exibe, em tuplas e com textos
 * repetidos deduplicados (o registro detalhado de cada valor fica no CSV e na
 * gold, acessíveis pelos links de download).
 */
export function dadosPainel(g: GoldEducacao): DadosPainel {
  const capitais = g.universo.capitais.map((c) => ({ id: c.id, cod: c.cod_ibge, nome: c.nome, uf: c.uf, regiao: c.regiao }));
  const posCap = new Map(capitais.map((c, i) => [c.cod, i]));
  const indicadores = g.indicadores.map((f) => f.id) as IndicadorId[];
  const posInd = new Map(indicadores.map((id, i) => [id, i]));
  const posEtapa = new Map(g.etapas.map((e, i) => [e.id, i]));
  const status = Object.keys(g.status) as StatusDado[];
  const posStatus = new Map(status.map((s, i) => [s, i]));
  const componentes: string[] = [];
  const posComp = new Map<string, number>();
  const notas: string[] = [];
  const posNota = new Map<string, number>();
  const idx = <T,>(mapa: Map<string | T, number>, lista: T[], v: T, chave?: (x: T) => string) => {
    const k = chave ? chave(v) : v;
    let i = mapa.get(k);
    if (i === undefined) {
      i = lista.length;
      lista.push(v);
      mapa.set(k, i);
    }
    return i;
  };
  /** 12 algarismos significativos bastam à exibição e ao CSV do cliente; a gold e os CSV do servidor guardam a precisão original. */
  const p12 = (v: number | null) => (v === null ? null : Number(v.toPrecision(Math.abs(v) >= 1e9 ? 15 : 12)));
  const situacoes: string[] = [];
  const posSit = new Map<string, number>();
  const obs: ObsCompacta[] = g.observacoes.map((o) => [
    posInd.get(o.indicador)!,
    posCap.get(o.ente)!,
    o.ano,
    o.etapa ? posEtapa.get(o.etapa)! : -1,
    o.componente ? idx(posComp, componentes, o.componente) : -1,
    p12(o.valor),
    posStatus.get(o.status)!,
    o.nota ? idx(posNota, notas, o.nota) : -1,
    o.participacao ?? null,
    o.elegivel_comparacao ? 1 : 0,
    o.nota_material ? 1 : 0,
    o.conferencia ? idx(posSit, situacoes, o.conferencia.situacao) : -1,
    o.conferencia?.motivo_inelegibilidade ? idx(posNota, notas, o.conferencia.motivo_inelegibilidade) : -1,
    o.quebra_serie || o.conferencia?.quebra_serie ? 1 : 0,
  ]);
  // referências estatísticas do grupo: só as que têm alguma capital com valor
  const refs: RefCompacta[] = [];
  for (const r of g.referencias) {
    if (r.capitais_com_valor === 0) continue;
    // P e N do Ideb só aparecem na tabela auditável, que lê as observações; as referências do grupo cobrem o que o painel compara
    if (r.componente === "p_rendimento" || r.componente === "n_nota_padronizada") continue;
    const grupo = GRUPOS_REF.indexOf(r.grupo);
    refs.push([
      posInd.get(r.indicador)!,
      r.componente ? idx(posComp, componentes, r.componente) : -1,
      r.etapa ? posEtapa.get(r.etapa)! : -1,
      r.ano, grupo, r.capitais_no_grupo, r.capitais_com_valor, r.n, p12(r.media), p12(r.mediana), p12(r.minimo), p12(r.maximo),
      r.quartis_exibicao ? p12(r.q1) : null, r.quartis_exibicao ? p12(r.q3) : null,
      r.quartis_exibicao ? 1 : 0, p12(r.soma_numerador), p12(r.soma_denominador), p12(r.razao_agregada),
      r.capitais_minimo.map((c) => posCap.get(c)!), r.capitais_maximo.map((c) => posCap.get(c)!),
    ]);
  }
  const descritores: DescritorExterno[] = [];
  const posDesc = new Map<string, number>();
  const externas: ExternaCompacta[] = g.referencias_externas.map((r) => [
    posInd.get(r.indicador)!,
    r.componente ? idx(posComp, componentes, r.componente) : -1,
    r.etapa ? posEtapa.get(r.etapa)! : -1,
    r.ano,
    r.tipo === "nacional_mesmo_universo" ? 0 : 1,
    p12(r.valor)!,
    idx(posDesc, descritores, { rotulo: r.rotulo, unidade: r.unidade, unidade_diferenca: r.unidade_diferenca, escopo: r.escopo, origem: r.origem, comparabilidade: r.comparabilidade }, (x) => JSON.stringify(x)),
  ]);
  // tipo e data de referência da população não variam entre capitais no mesmo ano
  const populacao: DadosPainel["populacao"] = {};
  for (const o of g.observacoes) {
    if (o.indicador === "ctx.populacao.residente" && !(String(o.ano) in populacao)) {
      populacao[String(o.ano)] = { tipo: o.tipo_populacao ?? null, referencia: o.data_referencia ?? null };
    }
  }
  const fontes: DadosPainel["fontes"] = {};
  for (const f of g.fontes) {
    const c = f.capturas[f.capturas.length - 1];
    fontes[f.id] = { instituicao: c.instituicao, conjunto: c.conjunto, pagina: c.pagina, capturado_em: c.capturado_em };
  }
  return {
    capitais,
    regioes: g.universo.regioes,
    etapas: g.etapas,
    fichas: g.indicadores,
    subfuncoes: g.subfuncoes,
    anos: g.periodos,
    indicadores,
    componentes,
    status,
    notas,
    obs,
    situacoes,
    rotulosSituacao: g.politica_conferencia.rotulos,
    refs,
    externas,
    descritores,
    // só os conjuntos que o painel mostra (instituições públicas; sem o agregado ISCED 1 a 8, que inclui o ensino superior); a gold guarda todos
    internacionais: g.referencias_internacionais.filter((x) => x.instituicoes === "publicas" && x.nivel !== "ISCED11_1T8").map((x) => ({ conjunto: x.conjunto, nome: x.nome, nivel: x.nivel, etapa: x.etapa, instituicoes: x.instituicoes, ano: x.ano, unidade: x.unidade, brasil: x.brasil, media_ocde_publicada: x.media_ocde_publicada, paises: x.paises, paises_com_dado: x.paises_com_dado, membros_com_dado: x.membros_com_dado, media_membros_recomputada: x.media_membros_recomputada, diferenca_media: x.diferenca_media, media_confere: x.media_confere, preliminar: x.preliminar })),
    nacionalCalculada: g.referencia_nacional_calculada,
    populacao,
    limiarQuartis: g.politica_referencias.limiar_quartis,
    intraPct: intraPct(g),
    fontes,
    meta: {
      gerado_em: g.meta.gerado_em,
      versao_pipeline: g.meta.versao_pipeline,
      versao_codigo: g.meta.versao_codigo,
      hash_dados: g.meta.hash_dados,
      versao_catalogo: g.meta.versao_catalogo,
      dados_capturados_ate: g.meta.dados_capturados_ate,
    },
    excluidos: g.universo.excluidos.map((e) => ({ nome: e.nome, uf: e.uf, motivo: e.motivo })),
  };
}

/**
 * Indicadores que cada tema lê. A exploração de um tema leva ao navegador só as observações, as estatísticas do grupo e as
 * referências desses indicadores, com as notas reindexadas; a base completa continua na gold, nos CSV e na tabela de Comparar.
 * Os valores de um indicador são idênticos nos dois payloads: só deixa de ir o que a visão não usa.
 */
export const INDICADORES_DO_TEMA: Record<"gastos" | "atendimento" | "resultados" | "comparar", IndicadorId[]> = {
  gastos: ["edu.despesa.funcao_educacao", "edu.despesa.por_habitante", "edu.despesa.aplicacao_direta_por_matricula", "edu.despesa.ponte_matricula", "edu.despesa.subfuncao"],
  atendimento: ["edu.matriculas.rede_municipal", "edu.matriculas.conveniadas_municipais", "edu.atu.rede_municipal"],
  resultados: ["edu.aprovacao.rede_municipal", "edu.ideb.rede_municipal", "edu.saeb.rede_municipal"],
  // o comparador lê todas as medidas e a população, mas não a ponte nem a composição por subfunção
  comparar: [
    "ctx.populacao.residente",
    "edu.despesa.funcao_educacao",
    "edu.despesa.por_habitante",
    "edu.despesa.aplicacao_direta_por_matricula",
    "edu.matriculas.rede_municipal",
    "edu.matriculas.conveniadas_municipais",
    "edu.atu.rede_municipal",
    "edu.aprovacao.rede_municipal",
    "edu.ideb.rede_municipal",
    "edu.saeb.rede_municipal",
  ],
};

export function recortaPayload(d: DadosPainel, indicadores: readonly IndicadorId[]): DadosPainel {
  const manter = new Set(indicadores.map((i) => d.indicadores.indexOf(i)));
  const notas: string[] = [];
  const nova = new Map<number, number>();
  const remapeia = (i: number) => {
    if (i < 0) return -1;
    let j = nova.get(i);
    if (j === undefined) {
      j = notas.push(d.notas[i]) - 1;
      nova.set(i, j);
    }
    return j;
  };
  const obs = d.obs
    .filter((o) => manter.has(o[0]))
    .map((o) => {
      const c = [...o] as ObsCompacta;
      c[7] = remapeia(o[7]);
      c[12] = remapeia(o[12]);
      return c;
    });
  return { ...d, obs, notas, refs: d.refs.filter((r) => manter.has(r[0])), externas: d.externas.filter((e) => manter.has(e[0])) };
}

export function dadosPainelTema(g: GoldEducacao, tema: keyof typeof INDICADORES_DO_TEMA): DadosPainel {
  return recortaPayload(dadosPainel(g), INDICADORES_DO_TEMA[tema]);
}
