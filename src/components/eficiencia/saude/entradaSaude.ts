import { GRUPOS_DESTINO, GRUPOS_FONTE, IndiceSaude, agrupar, comparar, composicao, composicaoAgregada, evolucaoDaDespesa, variacaoTotal, type FatiaElo, type LinhaComposicao } from "@/lib/eficiencia/saude/consulta";
import { dadosSaude } from "@/lib/eficiencia/saude/dados";
import { MEDIDAS_SAUDE, ROTULO_PERIODO } from "@/lib/eficiencia/saude/medidas";
import { OPCOES_PANORAMA } from "@/lib/eficiencia/saude/molde";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, CAMINHO_TEMA } from "@/lib/eficiencia/saude/rotas";
import type { GoldSaude } from "@/lib/eficiencia/saude/tipos";
import { decimal, inteiro, percentual } from "@/lib/eficiencia/formato";

/**
 * Leituras da gold que a entrada da Saúde nas capitais faz no servidor (a página é estática): as composições do modelo didático por
 * capital e do conjunto, os números das perguntas para começar e o que o painel ainda não mede. O navegador recebe só o resultado,
 * pequeno, em vez das milhares de observações de fonte, subfunção e grupo de internação.
 */

export type Elo =
  | { ok: true; ano: number; fatias: FatiaElo[]; total: number; escopo: string; ressalva: string | null }
  | { ok: false; ano: number; motivo: string };

export type Observado = { valor: number | null; ano: number; nota: string | null };

export type ModeloCapital = { id: string; nome: string; uf: string; fonte: Elo; destino: Elo; cobertura: Observado; icsap: Observado; planos: Observado };

export type DadosModeloSaude = {
  conjunto: ModeloCapital;
  capitais: ModeloCapital[];
  /** Medianas das capitais e referências do Brasil para o terceiro elo; null quando a fonte não traz o valor no período. */
  regua: { coberturaMediana: number | null; coberturaBrasil: number | null; icsapMediana: number | null; icsapBrasil: number | null; planosMediana: number | null };
};

export type PerguntaEntrada = { id: string; pergunta: string; resposta: string; numero: string | null; prova: string | null; caminho: string; params: Record<string, string> };

const ultimoAno = (ix: IndiceSaude, ind: string, comp: string | null) => {
  const anos = ix.anos(ind, comp);
  return anos[anos.length - 1];
};

const pct = (v: number) => percentual(v, 1);

function eloDaCapital(ix: IndiceSaude, ind: string, cod: number, ano: number, categorias: [string, string][], grupos: typeof GRUPOS_FONTE, escopo: string): Elo {
  const c = composicao(ix, ind, cod, ano, categorias);
  if (c.indisponivel || !c.linhas.length) return { ok: false, ano, motivo: c.indisponivel ?? "Sem composição publicada para este recorte." };
  const foraDaComparacao = categorias.map(([k]) => ix.ponto(ind, cod, ano, k)).some((p) => p.status === "OBSERVADO" && p.valor !== null && !p.elegivel);
  return {
    ok: true,
    ano,
    fatias: agrupar(c.linhas, grupos),
    total: c.linhas.reduce((s, l) => s + l.valor, 0),
    escopo,
    ressalva: foraDaComparacao ? "Valor oficial fora das comparações deste exercício; mostrado com a ressalva, sem entrar nas medianas." : null,
  };
}

function eloDoConjunto(ix: IndiceSaude, ind: string, ano: number, categorias: [string, string][], grupos: typeof GRUPOS_FONTE, exigeTodas: boolean): Elo {
  const ag = composicaoAgregada(ix, ind, ano, categorias, { exigeTodas });
  if (!ag.linhas.length) return { ok: false, ano, motivo: "Nenhuma capital tem composição publicada neste exercício." };
  const linhas: LinhaComposicao[] = ag.linhas;
  return {
    ok: true,
    ano,
    fatias: agrupar(linhas, grupos),
    total: linhas.reduce((s, l) => s + l.valor, 0),
    escopo: `Soma de ${ag.capitais} de ${ag.universo} capitais`,
    ressalva: ag.fora.length ? `Fora da soma: ${ag.fora.map((f) => `${f.cap.nome} (${f.cap.uf}), ${f.motivo}`).join("; ")}.` : null,
  };
}

/** Composição, cobertura, internações evitáveis e planos de cada capital e do conjunto, no último ano de cada fonte. */
export function modeloSaude(g: GoldSaude): DadosModeloSaude {
  const gastos = new IndiceSaude(dadosSaude(g, "gastos"));
  const rede = new IndiceSaude(dadosSaude(g, "rede"));
  const res = new IndiceSaude(dadosSaude(g, "resultados"));
  const fon: [string, string][] = Object.entries(gastos.d.rotulos.fontes);
  const sub: [string, string][] = Object.keys(gastos.d.rotulos.subfuncoes).map((k) => [k, gastos.d.rotulos.subfuncoes[k]]);
  const anoFonte = ultimoAno(gastos, "sau.despesa.por_fonte", fon[0][0]);
  const anoDestino = ultimoAno(gastos, "sau.despesa.subfuncao", "301");
  const anoCob = ultimoAno(rede, "sau.aps.cobertura_potencial", null);
  const anoIcsap = ultimoAno(res, "sau.icsap.taxa", "ripsa");
  const anoPlanos = ultimoAno(res, "sau.ctx.cobertura_planos", null);
  const obs = (ix: IndiceSaude, ind: string, cod: number, ano: number, comp: string | null): Observado => {
    const p = ix.ponto(ind, cod, ano, comp);
    const nota = p.valor === null ? (p.nota ?? "Sem valor para este recorte.") : !p.elegivel ? (p.motivo ?? "Valor oficial fora das comparações.") : null;
    return { valor: p.valor, ano, nota };
  };
  const capitais: ModeloCapital[] = gastos.d.capitais.map((c) => {
    const nome = `${c.nome} (${c.uf})`;
    return {
      id: c.id,
      nome: c.nome,
      uf: c.uf,
      fonte: eloDaCapital(gastos, "sau.despesa.por_fonte", c.cod, anoFonte, fon, GRUPOS_FONTE, nome),
      destino: eloDaCapital(gastos, "sau.despesa.subfuncao", c.cod, anoDestino, sub, GRUPOS_DESTINO, nome),
      cobertura: obs(rede, "sau.aps.cobertura_potencial", c.cod, anoCob, null),
      icsap: obs(res, "sau.icsap.taxa", c.cod, anoIcsap, "ripsa"),
      planos: obs(res, "sau.ctx.cobertura_planos", c.cod, anoPlanos, null),
    };
  });
  const refCob = rede.referencia("sau.aps.cobertura_potencial", null, anoCob, "todas");
  const refIcsap = res.referencia("sau.icsap.taxa", "ripsa", anoIcsap, "todas");
  const refPlanos = res.referencia("sau.ctx.cobertura_planos", null, anoPlanos, "todas");
  const brasil = (ix: IndiceSaude, ind: string, comp: string | null, ano: number) =>
    ix.externas(ind, comp, ano).find((e) => e.comparabilidade === "direta" && e.tipo !== "normativa")?.valor ?? null;
  const conjunto: ModeloCapital = {
    id: "",
    nome: "Conjunto das capitais",
    uf: "",
    fonte: eloDoConjunto(gastos, "sau.despesa.por_fonte", anoFonte, fon, GRUPOS_FONTE, true),
    destino: eloDoConjunto(gastos, "sau.despesa.subfuncao", anoDestino, sub, GRUPOS_DESTINO, false),
    cobertura: { valor: refCob?.mediana ?? null, ano: anoCob, nota: refCob ? `Mediana de ${refCob.n} capitais.` : "Nenhuma capital na comparação." },
    icsap: { valor: refIcsap?.mediana ?? null, ano: anoIcsap, nota: refIcsap ? `Mediana de ${refIcsap.n} capitais.` : "Nenhuma capital na comparação." },
    planos: { valor: refPlanos?.mediana ?? null, ano: anoPlanos, nota: refPlanos ? `Mediana de ${refPlanos.n} capitais.` : "Nenhuma capital com valor." },
  };
  return {
    conjunto,
    capitais,
    regua: {
      coberturaMediana: refCob?.mediana ?? null,
      coberturaBrasil: brasil(rede, "sau.aps.cobertura_potencial", null, anoCob),
      icsapMediana: refIcsap?.mediana ?? null,
      icsapBrasil: brasil(res, "sau.icsap.taxa", "ripsa", anoIcsap),
      planosMediana: refPlanos?.mediana ?? null,
    },
  };
}

/** Participação de uma fatia no elo, ou null quando o elo não tem a fatia. */
export const fatia = (e: Elo, chave: string) => (e.ok ? (e.fatias.find((f) => f.chave === chave) ?? null) : null);

/**
 * As perguntas para começar: cada uma com a resposta curta e o número lido da mesma base que o destino desenha. Sem número, a
 * pergunta segue com a resposta e o caminho; nada é estimado no lugar.
 */
export function perguntasSaude(g: GoldSaude, modelo: DadosModeloSaude): PerguntaEntrada[] {
  const gastos = new IndiceSaude(dadosSaude(g, "gastos"));
  const res = new IndiceSaude(dadosSaude(g, "resultados"));
  const c = modelo.conjunto;
  const proprios = fatia(c.fonte, "proprios");
  const uniao = fatia(c.fonte, "sus_uniao");
  const basica = fatia(c.destino, "basica");
  const hosp = fatia(c.destino, "hospitalar");

  const asps = MEDIDAS_SAUDE.asps_pct;
  const anoAsps = ultimoAno(gastos, asps.indicador, null);
  const cAsps = comparar(gastos, asps, anoAsps, OPCOES_PANORAMA, "todas", null, "alfabetica");
  const acima = cAsps.incluidas.filter((i) => i.valor >= 15).length;

  const grupos: [string, string][] = Object.entries(res.d.rotulos.grupos);
  const anoGr = ultimoAno(res, "sau.icsap.grupos", grupos[0][0]);
  const agGr = composicaoAgregada(res, "sau.icsap.grupos", anoGr, grupos, { exigeTodas: true });
  const maiores = agGr.linhas.slice().sort((a, b) => b.valor - a.valor).slice(0, 3);

  const anoPl = c.planos.ano;
  const refPl = res.referencia("sau.ctx.cobertura_planos", null, anoPl, "todas");

  const evo = evolucaoDaDespesa(gastos);
  const varTotal = variacaoTotal(evo.pontos);
  const p0 = evo.pontos[0];
  const pN = evo.pontos[evo.pontos.length - 1];

  const escopoFonte = c.fonte.ok ? `${c.fonte.escopo.toLowerCase()}, ${c.fonte.ano}` : null;
  const escopoDestino = c.destino.ok ? `${c.destino.escopo.toLowerCase()}, ${c.destino.ano}` : null;

  return [
    {
      id: "comparar",
      pergunta: "Como a sua capital fica ao lado de outra?",
      resposta: "Escolha duas capitais e veja as medidas do painel lado a lado, no mesmo período e na mesma unidade.",
      numero: null,
      prova: null,
      caminho: CAMINHO_COMPARAR,
      params: {},
    },
    {
      id: "quem-paga",
      pergunta: "Quem paga a saúde da prefeitura?",
      resposta: uniao ? `Da despesa empenhada em saúde, ${pct(uniao.participacao)} veio de transferências do SUS da União.` : "A composição por fonte não está publicada no último exercício.",
      numero: proprios ? pct(proprios.participacao) : null,
      prova: proprios && escopoFonte ? `de impostos e recursos livres do município · ${escopoFonte} · SIOPS, despesa por fonte` : null,
      caminho: CAMINHO_TEMA.gastos,
      params: { med: "despesa" },
    },
    {
      id: "posto-ou-hospital",
      pergunta: "Quanto vai para a atenção básica e quanto para o hospital?",
      resposta: hosp ? `Assistência hospitalar e ambulatorial: ${pct(hosp.participacao)} da despesa liquidada. A classificação é contábil e varia entre prefeituras.` : "A composição por subfunção não está publicada no último exercício.",
      numero: basica ? pct(basica.participacao) : null,
      prova: basica && escopoDestino ? `na subfunção Atenção básica · ${escopoDestino} · Siconfi (DCA)` : null,
      caminho: CAMINHO_TEMA.gastos,
      params: { med: "despesa" },
    },
    {
      id: "minimo-15",
      pergunta: "A prefeitura aplica o mínimo de 15% em saúde?",
      resposta: cAsps.ref?.mediana != null ? `Mediana de ${pct(cAsps.ref.mediana)} da receita de impostos e transferências. O mínimo é referência da lei, não meta.` : "Nenhuma capital entra na comparação deste exercício.",
      numero: cAsps.incluidas.length ? `${acima} de ${cAsps.incluidas.length}` : null,
      prova: cAsps.incluidas.length ? `capitais declararam ao menos 15% · ${ROTULO_PERIODO[asps.periodo](anoAsps).toLowerCase()} · SIOPS` : null,
      caminho: CAMINHO_TEMA.gastos,
      params: { med: "asps_pct" },
    },
    {
      id: "internacoes",
      pergunta: "De que se internam os moradores que o posto poderia tratar?",
      resposta: maiores.length ? `As causas mais frequentes: ${maiores.map((l) => `${l.rotulo.charAt(0).toLowerCase()}${l.rotulo.slice(1)} (${pct(l.participacao)})`).join(", ")}.` : "A composição por grupo não está publicada no último ano.",
      numero: agGr.linhas.length ? inteiro(agGr.linhas.reduce((s, l) => s + l.valor, 0)) : null,
      prova: agGr.linhas.length ? `internações evitáveis pagas pelo SUS · soma de ${agGr.capitais} de ${agGr.universo} capitais, ${anoGr} · RIPSA MRB.4.02` : null,
      caminho: CAMINHO_TEMA.resultados,
      params: { med: "icsap_taxa" },
    },
    {
      id: "planos",
      pergunta: "Quantos moradores têm plano de saúde?",
      resposta: refPl && refPl.minimo !== null && refPl.maximo !== null ? `De ${pct(refPl.minimo)} a ${pct(refPl.maximo)} da população, conforme a capital. Quem não tem plano depende só do SUS.` : "Sem valor publicado no último ano.",
      numero: refPl?.mediana != null ? pct(refPl.mediana) : null,
      prova: refPl?.mediana != null ? `com plano privado, mediana de ${refPl.n} capitais · dezembro de ${anoPl} · RIPSA COB.5.01 (ANS)` : null,
      caminho: CAMINHO_TEMA.resultados,
      params: { med: "icsap_taxa" },
    },
    {
      id: "inflacao",
      pergunta: "O gasto da prefeitura cresceu acima da inflação?",
      resposta: p0 && pN ? `Soma de ${evo.capitais.length} capitais com valor comparável em todos os anos, em reais de ${pN.ano} corrigidos pelo IPCA.` : "Nenhuma capital tem valor comparável em todos os exercícios.",
      numero: varTotal !== null ? `${varTotal >= 0 ? "+" : "−"}${decimal(Math.abs(varTotal), 1)}%` : null,
      prova: varTotal !== null && p0 && pN ? `variação real de ${p0.ano} a ${pN.ano}, já descontado o IPCA · soma de ${evo.capitais.length} capitais · Siconfi (DCA) e IBGE` : null,
      caminho: CAMINHO_TEMA.gastos,
      params: { med: "despesa", moeda: "real" },
    },
    {
      id: "metodos",
      pergunta: "De onde vem cada número?",
      resposta: "Fontes, fórmulas, conferências e o passo a passo para reproduzir cada medida.",
      numero: null,
      prova: null,
      caminho: CAMINHO_METODOS,
      params: {},
    },
  ];
}

/** Número da faixa: a parcela do SUS da União no conjunto, com o escopo e a lista de quem fica fora. */
export function numeroSusUniao(modelo: DadosModeloSaude): { valor: number; ano: number; escopo: string; ressalva: string | null } | { valor: null; ano: number; motivo: string } {
  const e = modelo.conjunto.fonte;
  const f = fatia(e, "sus_uniao");
  if (!e.ok || !f) return { valor: null, ano: e.ano, motivo: e.ok ? "A fonte não traz transferências do SUS da União neste exercício." : e.motivo };
  return { valor: f.participacao, ano: e.ano, escopo: e.escopo, ressalva: e.ressalva };
}

/** Indicadores avaliados e não publicados, com o motivo da própria gold: o que o painel ainda não mede, sem promessa de data. */
export function naoPublicados(g: GoldSaude): { id: string; nome: string; motivos: string[] }[] {
  return g.indicadores.filter((f) => f.motivo_nao_publicacao && f.motivo_nao_publicacao.length > 0).map((f) => ({ id: f.id, nome: f.nome, motivos: f.motivo_nao_publicacao! }));
}
