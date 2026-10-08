"use client";

import { useMemo, useState, type ReactNode } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_TABELA,
  CABECALHO_TABELA,
  Indice,
  MEDIDA,
  MEDIDAS,
  ROTULO_STATUS,
  comparar,
  componente,
  composicaoDespesa,
  csv,
  distribuicaoMatriculas,
  edicaoIdeb,
  etapaValida,
  formata,
  formataEixo,
  linhasCsvComparacao,
  linhasCsvTabela,
  linhasTabela,
  nomeEtapa,
  rotuloComparacao,
  serie,
  unidade,
  variacao,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type MedidaId,
  type Moeda,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { decimal, inteiro, percentual, reaisCompleto } from "@/lib/eficiencia/formato";
import type { EtapaId, IndicadorId } from "@/lib/eficiencia/tipos";
import type { ContextoFicha } from "./FichaConteudo";
import { Passaporte } from "./Passaporte";
import { BarrasComposicao, GraficoPontosPares, MiniSerie, type Anotacao } from "./graficos";

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];

const PANDEMIA_IDEB: Anotacao = { ano: 2021, texto: "edição afetada pela pandemia de covid-19 (nota informativa do INEP sobre o Ideb 2021)." };
const PANDEMIA_APROVACAO: Anotacao = { ano: 2021, texto: "ano letivo afetado pela pandemia de covid-19, com regras excepcionais de avaliação em muitas redes." };

function esquema(ids: string[]) {
  return {
    cap: campo(tiposUrl.opcao(ids), ids[0]),
    ano: campo(tiposUrl.inteiro({ min: 2021, max: 2025 }), 2025),
    etapa: campo(tiposUrl.opcao(ETAPAS), "anos_iniciais" as EtapaId),
    med: campo(tiposUrl.opcao(MEDIDAS), "despesa" as MedidaId),
    grupo: campo(tiposUrl.opcao(["todas", "regiao"] as const), "todas" as Grupo),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor"] as const), "alfabetica" as Ordem),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
  };
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ peças pequenas */

function Bloco({ id, rotulo, titulo, children, acao }: { id: string; rotulo: string; titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 border-t border-linha pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="rotulo text-mineral">{rotulo}</p>
          <h2 id={`${id}-titulo`} className="mt-2 font-serif text-2xl leading-tight text-obee-tinta md:text-[1.75rem]">
            {titulo}
          </h2>
        </div>
        {acao}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SemValor({ ponto, contexto }: { ponto: Ponto; contexto?: string }) {
  return (
    <div className="mt-2 border border-dashed border-mineral bg-papel px-3 py-2 text-sm text-obee-tinta" role="note">
      <p className="rotulo flex items-center gap-1.5 !text-[0.66rem] text-carvao-muted">
        <span aria-hidden="true" className="inline-block h-2 w-2 border border-carvao-muted" />
        {ROTULO_STATUS[ponto.status]}
      </p>
      <p className="mt-1 leading-snug">{contexto ?? ponto.nota ?? "Sem valor para este recorte."}</p>
    </div>
  );
}

/**
 * Ressalva junto ao dado: restrição material com sinal visível ("Ressalva"); nota informativa com
 * "Nota". O detalhe abre por clique ou teclado (details/summary), sem depender de hover ou cor.
 */
function Ressalva({ ponto }: { ponto: Ponto }) {
  const texto = ponto.status === "OBSERVADO" && !ponto.elegivel ? ponto.motivo ?? ponto.nota : ponto.nota;
  if (!texto || ponto.status !== "OBSERVADO") return null;
  const material = ponto.notaMaterial || !ponto.elegivel;
  return (
    <details className="group mt-2 text-xs leading-snug">
      <summary
        className={`inline-flex min-h-[32px] cursor-pointer list-none items-center gap-1.5 border px-2 ${
          material ? "border-obee-tinta font-semibold text-obee-tinta" : "border-linha text-carvao-muted"
        }`}
      >
        <span aria-hidden="true">{material ? "!" : "i"}</span>
        {material ? (ponto.elegivel ? "Ressalva" : "Ressalva: fora das comparações") : "Nota"}
        <span className="sr-only"> (abrir detalhe)</span>
      </summary>
      <p className="mt-1.5 text-obee-tinta">{texto}</p>
      {!ponto.elegivel && ponto.nota && ponto.nota !== texto && <p className="mt-1 text-carvao-muted">{ponto.nota}</p>}
    </details>
  );
}

function ForaDoEscopo({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-mineral bg-papel px-4 py-4 text-sm leading-relaxed text-obee-tinta" role="note">
      <p className="rotulo !text-[0.66rem] text-carvao-muted">Fora do escopo deste indicador</p>
      <p className="mt-1">{texto}</p>
      {children}
    </div>
  );
}

function Selecao({
  id,
  rotulo,
  ajuda,
  valor,
  opcoes,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: string;
  opcoes: { v: string; t: string; desab?: boolean }[];
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-carvao-muted">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        disabled={desabilitado}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1.5 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta hover:border-obee disabled:text-mineral"
      >
        {opcoes.map((o) => (
          <option key={o.v} value={o.v} disabled={o.desab}>
            {o.t}
          </option>
        ))}
      </select>
      <p id={`${id}-ajuda`} className="mt-1 text-xs leading-snug text-carvao-muted">
        {ajuda}
      </p>
    </div>
  );
}

function Alternancia<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { v: T; t: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="rotulo text-carvao-muted">{rotulo}</legend>
      <div className="mt-1.5 inline-flex border border-linha bg-superficie">
        {opcoes.map((o) => (
          <label
            key={o.v}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
              valor === o.v ? "bg-obee-fundo font-semibold text-obee-tinta" : "text-carvao-muted hover:text-obee-tinta"
            }`}
          >
            <input type="radio" className="sr-only" name={rotulo} value={o.v} checked={valor === o.v} onChange={() => aoMudar(o.v)} />
            {o.t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TabelaSimples({ legenda, cabecalho, linhas }: { legenda: string; cabecalho: string[]; linhas: (string | number)[][] }) {
  return (
    <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={`${legenda} (tabela; role na horizontal se necessário)`}>
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 font-semibold text-obee-tinta ${i ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, j) => (
            <tr key={j} className="border-b border-linha">
              {l.map((c, i) =>
                i ? (
                  <td key={i} className="px-2 py-1.5 text-right text-obee-tinta">
                    {c}
                  </td>
                ) : (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-obee-tinta">
                    {c}
                  </th>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ painel */

export function PainelEducacao({ dados, contextos }: { dados: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  const [aviso, setAviso] = useState("");
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? dados.capitais[0];
  const ficha = (id: IndicadorId) => dados.fichas.find((f) => f.id === id)!;
  const pass = (id: IndicadorId, rotulo?: string, compacto?: boolean) => (
    <Passaporte f={ficha(id)} ctx={contextos[id]} rotulo={rotulo} compacto={compacto} />
  );
  const etapaNome = nomeEtapa(dados, s.etapa);
  const { edicao, exata } = edicaoIdeb(s.ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;

  const restaurar = () => {
    definir({ cap: ids[0], ano: 2025, etapa: "anos_iniciais", med: "despesa", grupo: "todas", ord: "alfabetica", moeda: "nominal", disc: "matematica" });
    setAviso("Recorte inicial restaurado.");
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link do recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };

  /* ---------- C: números de orientação ---------- */
  const kDesp = componente("despesa", s.moeda, s.disc);
  const desp = ix.ponto("edu.despesa.funcao_educacao", cap.cod, s.ano, null, kDesp);
  const despAnt = ix.ponto("edu.despesa.funcao_educacao", cap.cod, s.ano - 1, null, kDesp);
  const mat = ix.ponto("edu.matriculas.rede_municipal", cap.cod, s.ano, s.etapa, null);
  const matAnt = ix.ponto("edu.matriculas.rede_municipal", cap.cod, s.ano - 1, s.etapa, null);
  const conv = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, s.ano, s.etapa, null);
  const etapaFund = s.etapa === "anos_iniciais" || s.etapa === "anos_finais";
  const ideb = etapaFund ? ix.ponto("edu.ideb.rede_municipal", cap.cod, edicao, s.etapa, "ideb") : null;
  const idebAnt = etapaFund ? ix.ponto("edu.ideb.rede_municipal", cap.cod, edicao - 2, s.etapa, "ideb") : null;
  const aprov = etapaFund ? ix.ponto("edu.aprovacao.rede_municipal", cap.cod, s.ano, s.etapa, null) : null;

  /** Variação só entre valores elegíveis; quando um deles não é, diz por que não foi calculada. */
  const variacaoPct = (a: Ponto, b: Ponto, anoB: number) => {
    const v = variacao(a, b);
    if (!v) return null;
    if ("bloqueio" in v) return `Variação em relação a ${anoB} não calculada: um dos valores está fora das comparações.`;
    return `${v.pct >= 0 ? "+" : "−"}${decimal(Math.abs(v.pct), 1)}% em relação a ${anoB}`;
  };
  const variacaoAbs = (a: Ponto | null, b: Ponto | null, anoB: number, casas: number) =>
    a && b && a.valor !== null && b.valor !== null && a.elegivel && b.elegivel
      ? `${a.valor - b.valor >= 0 ? "+" : "−"}${decimal(Math.abs(a.valor - b.valor), casas)} em relação à edição ${anoB}`
      : null;
  const univ = (id: IndicadorId) => ficha(id).universo_rotulo;

  /* ---------- E: séries ---------- */
  const series: { m: MedidaId; titulo: string; zero: boolean; anot?: Anotacao[] }[] = [
    { m: "despesa", titulo: "Despesa liquidada na função Educação", zero: true },
    { m: "matriculas", titulo: "Matrículas na rede municipal", zero: true },
    { m: "conveniadas", titulo: "Matrículas em escolas privadas conveniadas só com o município", zero: true },
    { m: "atu", titulo: "Média de alunos por turma", zero: true },
    { m: "aprovacao", titulo: "Taxa de aprovação", zero: false, anot: [PANDEMIA_APROVACAO] },
    { m: "ideb", titulo: "Ideb", zero: false, anot: [PANDEMIA_IDEB] },
    { m: "saeb", titulo: `Proficiência no Saeb, ${s.disc === "matematica" ? "Matemática" : "Língua Portuguesa"}`, zero: false, anot: [PANDEMIA_IDEB] },
  ];

  /* ---------- F: comparação ---------- */
  const med = MEDIDA[s.med];
  const compEtapaOk = etapaValida(s.med, s.etapa);
  const compAnoOk = med.anos !== "ideb" || exata;
  const comp = compEtapaOk && compAnoOk ? comparar(ix, s.med, s.ano, s.etapa, s.moeda, s.disc, s.grupo, cap, s.ord) : null;
  const unidadeMed = unidade(s.med, s.moeda);
  const fmt = (v: number) => formata(s.med, v);
  const fmtCurto = (v: number) => formataEixo(s.med, v);
  // tabela equivalente e download saem da mesma comparação: incluídas e excluídas, com estado e motivo
  const linhasComp = comp
    ? [
        ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, formata(s.med, i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
        ...comp.excluidas.map((x) => [
          `${x.cap.nome} (${x.cap.uf})`,
          x.comValor && x.ponto.valor !== null ? formata(s.med, x.ponto.valor) : "",
          x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status],
        ]),
      ]
    : [];
  const csvComp = () =>
    comp &&
    baixar(
      `obee_comparacao_${s.med}_${s.ano}${med.etapas ? `_${s.etapa}` : ""}${s.grupo === "regiao" ? `_regiao_${cap.regiao}` : ""}.csv`,
      csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, s.med, s.ano, s.etapa, s.moeda, s.disc)),
    );

  /* ---------- G: decomposição ---------- */
  const compDesp = composicaoDespesa(ix, cap.cod, s.ano);
  const somaSub = compDesp.linhas.reduce((a, l) => a + l.valor, 0);
  const distMat = distribuicaoMatriculas(ix, cap.cod, s.ano);
  const convTotal = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, s.ano, "total", null);

  /* ---------- H: tabela ---------- */
  const tabela = linhasTabela(ix, cap.cod, s.ano);

  return (
    <div className="space-y-14">
      {/* B: controles */}
      <section aria-labelledby="controles-titulo" className="border border-linha bg-superficie px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="controles-titulo" className="rotulo text-obee-tinta">
            Recorte em exibição
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="rotulo min-h-[44px] border border-linha px-3 text-obee-tinta hover:border-obee">
              Copiar link do recorte
            </button>
            <button type="button" onClick={restaurar} className="rotulo min-h-[44px] border border-linha px-3 text-obee-tinta hover:border-obee">
              Voltar ao recorte inicial
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selecao
            id="f-cap"
            rotulo="Capital"
            ajuda="Rede municipal da capital. Recorte inicial: a primeira em ordem alfabética."
            valor={cap.id}
            opcoes={dados.capitais.map((c) => ({ v: c.id, t: `${c.nome} (${c.uf})` }))}
            aoMudar={(v) => definir({ cap: v })}
          />
          <Selecao
            id="f-ano"
            rotulo="Ano"
            ajuda="Exercício financeiro, ano do Censo Escolar e ano letivo. O Ideb usa a edição do ano ou a anterior, sempre indicada."
            valor={String(s.ano)}
            opcoes={dados.anos.financeiros.map((a) => ({ v: String(a), t: String(a) }))}
            aoMudar={(v) => definir({ ano: Number(v) })}
          />
          <Selecao
            id="f-etapa"
            rotulo="Etapa de ensino"
            ajuda="Vale para matrículas, alunos por turma, aprovação, Ideb e Saeb, conforme a etapa existir em cada um. Não se aplica à despesa."
            valor={s.etapa}
            opcoes={dados.etapas.map((e) => ({ v: e.id, t: e.nome }))}
            aoMudar={(v) => definir({ etapa: v as EtapaId })}
          />
          <Selecao
            id="f-med"
            rotulo="Indicador da comparação"
            ajuda="Medida mostrada na comparação entre capitais (bloco Comparação)."
            valor={s.med}
            opcoes={MEDIDAS.map((m) => ({ v: m, t: MEDIDA[m].rotulo }))}
            aoMudar={(v) => definir({ med: v as MedidaId })}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <Alternancia
            rotulo="Grupo de comparação"
            valor={s.grupo}
            opcoes={[
              { v: "todas", t: "Todas as capitais" },
              { v: "regiao", t: `Região ${dados.regioes[cap.regiao]}` },
            ]}
            aoMudar={(v) => definir({ grupo: v })}
          />
          <Alternancia
            rotulo="Valores da despesa"
            valor={s.moeda}
            opcoes={[
              { v: "nominal", t: "Nominais" },
              { v: "real", t: "Em reais de 2025 (IPCA)" },
            ]}
            aoMudar={(v) => definir({ moeda: v })}
          />
          <Alternancia
            rotulo="Disciplina do Saeb"
            valor={s.disc}
            opcoes={[
              { v: "matematica", t: "Matemática" },
              { v: "portugues", t: "Língua Portuguesa" },
            ]}
            aoMudar={(v) => definir({ disc: v })}
          />
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-obee-dark">
          {aviso}
        </p>
      </section>

      {/* C: números de orientação */}
      <section aria-labelledby="orientacao-titulo">
        <h2 id="orientacao-titulo" className="rotulo text-mineral">
          {nomeCap} · números de orientação
        </h2>
        <p className="mt-1 text-sm text-carvao-muted">
          Cada número tem o seu período. Quando os períodos diferem, isso aparece abaixo do valor.
        </p>
        <div className="mt-4 grid gap-px border border-linha bg-linha sm:grid-cols-2 xl:grid-cols-4">
          <Cartao id="despesa" rotulo="Despesa liquidada na função Educação" periodo={`Exercício ${s.ano} · ${unidade("despesa", s.moeda)} · ${univ("edu.despesa.funcao_educacao")}`} acao={pass("edu.despesa.funcao_educacao", "Passaporte", true)}>
            {desp.valor !== null ? (
              <>
                <Valor>{formata("despesa", desp.valor)}</Valor>
                {variacaoPct(desp, despAnt, s.ano - 1) && <Detalhe>{variacaoPct(desp, despAnt, s.ano - 1)}</Detalhe>}
                <Ressalva ponto={desp} />
              </>
            ) : (
              <SemValor ponto={desp} />
            )}
          </Cartao>
          <Cartao id="matriculas" rotulo={`Matrículas na rede municipal · ${etapaNome}`} periodo={`Censo Escolar ${s.ano} · matrículas · ${univ("edu.matriculas.rede_municipal")}`} acao={pass("edu.matriculas.rede_municipal", "Passaporte", true)}>
            {mat.valor !== null ? (
              <>
                <Valor>{inteiro(mat.valor)}</Valor>
                {variacaoPct(mat, matAnt, s.ano - 1) && <Detalhe>{variacaoPct(mat, matAnt, s.ano - 1)}</Detalhe>}
                {conv.valor !== null && (
                  <Detalhe>
                    Contadas à parte, não somadas: {inteiro(conv.valor)} em escolas privadas com parceria só com o município.
                  </Detalhe>
                )}
                <Ressalva ponto={mat} />
              </>
            ) : (
              <SemValor ponto={mat} />
            )}
          </Cartao>
          <Cartao
            id="ideb"
            rotulo={`Ideb da rede municipal${etapaFund ? ` · ${etapaNome}` : ""}`}
            periodo={etapaFund ? `Edição ${edicao}${exata ? "" : ` (o Ideb é bienal; não há edição ${s.ano})`} · índice de 0 a 10 · ${univ("edu.ideb.rede_municipal")}` : "Edições bienais · índice de 0 a 10"}
            acao={pass("edu.ideb.rede_municipal", "Passaporte", true)}
          >
            {!etapaFund ? (
              <ForaDoEscopo texto={`O Ideb é calculado para os anos iniciais e os anos finais do ensino fundamental, não para ${etapaNome.toLowerCase()}.`} />
            ) : ideb && ideb.valor !== null ? (
              <>
                <Valor>{decimal(ideb.valor, 1)}</Valor>
                {variacaoAbs(ideb, idebAnt, edicao - 2, 1) && <Detalhe>{variacaoAbs(ideb, idebAnt, edicao - 2, 1)}</Detalhe>}
              </>
            ) : (
              ideb && <SemValor ponto={ideb} />
            )}
          </Cartao>
          <Cartao
            id="aprovacao"
            rotulo={`Taxa de aprovação na rede municipal${etapaFund ? ` · ${etapaNome}` : ""}`}
            periodo={`Ano letivo ${s.ano} · % · ${univ("edu.aprovacao.rede_municipal")}`}
            acao={pass("edu.aprovacao.rede_municipal", "Passaporte", true)}
          >
            {!etapaFund ? (
              <ForaDoEscopo texto={`A taxa de aprovação deste painel cobre os anos iniciais e os anos finais do ensino fundamental, não ${etapaNome.toLowerCase()}.`} />
            ) : aprov && aprov.valor !== null ? (
              <>
                <Valor>{percentual(aprov.valor, 1)}</Valor>
                <Ressalva ponto={aprov} />
              </>
            ) : (
              aprov && <SemValor ponto={aprov} />
            )}
          </Cartao>
        </div>
      </section>

      {/* E: série histórica */}
      <Bloco id="serie" rotulo="Explorar · série histórica" titulo={`Séries de ${nomeCap}`}>
        <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">
          Pequenos múltiplos, um por medida, cada um com a sua unidade e o seu eixo. Não há eixo duplo nem sobreposição de medidas: a
          posição relativa das linhas em painéis diferentes não indica relação entre elas. Etapa selecionada: {etapaNome.toLowerCase()}.
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {series.map(({ m, titulo, zero, anot }) => {
            const md = MEDIDA[m];
            const ok = etapaValida(m, s.etapa);
            const pts = ok ? serie(ix, m, cap.cod, s.etapa, s.moeda, s.disc) : [];
            const sub = `${unidade(m, s.moeda)} · ${md.anos === "financeiros" ? "exercícios" : md.anos === "censo" ? (m === "aprovacao" ? "anos letivos" : "Censo Escolar") : "edições"} ${pts[0]?.ano ?? ""}${pts.length ? `–${pts[pts.length - 1].ano}` : ""}${md.etapas ? ` · ${etapaNome}` : " · todas as etapas"}`;
            return (
              <figure key={m} className="min-w-0">
                <figcaption>
                  <p className="font-semibold leading-snug text-obee-tinta">{titulo}</p>
                  <p className="mt-0.5 text-xs text-carvao-muted">{sub}</p>
                  <p className="text-xs text-carvao-muted">{ficha(md.indicador).universo_rotulo}</p>
                </figcaption>
                <div className="mt-3">
                  {ok ? (
                    <MiniSerie
                      titulo={`${titulo}, ${nomeCap}`}
                      pontos={pts}
                      formata={(v) => formata(m, v)}
                      formataEixo={(v) => formataEixo(m, v)}
                      zero={zero}
                      anotacoes={anot}
                    />
                  ) : (
                    <ForaDoEscopo
                      texto={`${titulo} não existe para ${etapaNome.toLowerCase()}. Etapas com dado: ${(md.etapas ?? [])
                        .map((e) => nomeEtapa(dados, e).toLowerCase())
                        .join(", ")}.`}
                    />
                  )}
                </div>
                {ok && (
                  <details className="mt-2 text-sm">
                    <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                    <TabelaSimples
                      legenda={`${titulo}, ${nomeCap}`}
                      cabecalho={["Ano", "Valor", "Estado do dado"]}
                      linhas={pts.map((p) => [String(p.ano), p.valor !== null ? formata(m, p.valor) : "", ROTULO_STATUS[p.status]])}
                    />
                  </details>
                )}
                <div className="mt-1">{pass(md.indicador, "Passaporte", true)}</div>
              </figure>
            );
          })}
        </div>
      </Bloco>

      {/* F: comparação */}
      <Bloco
        id="comparacao"
        rotulo="Explorar · comparação descritiva"
        titulo={`${med.rotulo}: capitais ${s.grupo === "regiao" ? `da região ${dados.regioes[cap.regiao]}` : "estaduais"}`}
        acao={
          <Alternancia
            rotulo="Ordem das capitais"
            valor={s.ord}
            opcoes={[
              { v: "alfabetica", t: "Alfabética" },
              { v: "valor", t: "Por valor, crescente" },
            ]}
            aoMudar={(v) => definir({ ord: v })}
          />
        }
      >
        <p className="text-sm text-carvao-muted">
          {unidadeMed} · {med.anos === "ideb" ? `edição ${s.ano}` : med.anos === "financeiros" ? `exercício ${s.ano}` : `${s.med === "aprovacao" ? "ano letivo" : "Censo Escolar"} ${s.ano}`}
          {med.etapas ? ` · ${etapaNome}` : " · todas as etapas"}
          {s.med === "saeb" ? ` · ${s.disc === "matematica" ? "Matemática" : "Língua Portuguesa"}` : ""}
        </p>
        <div className="mt-5">
          {!compEtapaOk ? (
            <ForaDoEscopo texto={`${med.rotulo} não existe para ${etapaNome.toLowerCase()}. Escolha uma etapa com dado:`}>
              <div className="mt-3 flex flex-wrap gap-2">
                {(med.etapas ?? []).map((e) => (
                  <button key={e} type="button" onClick={() => definir({ etapa: e })} className="rotulo min-h-[44px] border border-obee px-3 text-obee-dark hover:bg-obee-fundo">
                    {nomeEtapa(dados, e)}
                  </button>
                ))}
              </div>
            </ForaDoEscopo>
          ) : !compAnoOk ? (
            <ForaDoEscopo texto={`O Ideb e o Saeb são bienais: não há edição ${s.ano}. Escolha uma edição:`}>
              <div className="mt-3 flex flex-wrap gap-2">
                {[s.ano - 1, s.ano + 1]
                  .filter((a) => a >= 2021 && a <= 2025)
                  .map((a) => (
                    <button key={a} type="button" onClick={() => definir({ ano: a })} className="rotulo min-h-[44px] border border-obee px-3 text-obee-dark hover:bg-obee-fundo">
                      Edição {a}
                    </button>
                  ))}
              </div>
            </ForaDoEscopo>
          ) : comp && comp.incluidas.length === 0 ? (
            <ForaDoEscopo texto="Nenhuma capital do grupo tem valor observado e comparável neste recorte." />
          ) : (
            comp && (
              <>
                {comp.incluidas.length < 3 && (
                  <p className="mb-3 border-l-2 border-obee pl-3 text-sm text-obee-tinta">
                    Só {comp.incluidas.length} {comp.incluidas.length === 1 ? "capital tem" : "capitais têm"} valor neste recorte. A mediana de um grupo tão
                    pequeno é pouco informativa.
                  </p>
                )}
                <GraficoPontosPares
                  titulo={`${med.rotulo}, ${s.ano}`}
                  linhas={comp.incluidas.map((i) => ({
                    chave: i.cap.id,
                    rotulo: `${i.cap.nome} (${i.cap.uf})${i.ponto.nota ? " *" : ""}`,
                    valor: i.valor,
                    selecionada: i.cap.id === cap.id,
                  }))}
                  mediana={comp.mediana}
                  formata={fmt}
                  formataEixo={fmtCurto}
                  zero={s.med === "despesa" || s.med === "matriculas" || s.med === "conveniadas"}
                />
                {comp.incluidas.every((i) => i.cap.id !== cap.id) && (
                  <p className="mt-2 text-sm text-obee-tinta">{nomeCap} não está entre as capitais incluídas neste recorte; o motivo está na lista abaixo.</p>
                )}
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="text-sm leading-relaxed text-obee-tinta">
                    <p className="rotulo text-mineral">Critério do grupo, definido antes dos valores</p>
                    <p className="mt-1">{comp.criterio}</p>
                    <p className="mt-2">
                      <span className="text-carvao-muted">O que o indicador mede:</span> {comp.universoIndicador}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-px border border-linha bg-linha text-center">
                      {[
                        ["Capitais no grupo", comp.universo.length],
                        ["Com valor oficial", comp.comValor],
                        ["Na comparação", comp.incluidas.length],
                      ].map(([t, n]) => (
                        <div key={String(t)} className="bg-superficie px-2 py-2">
                          <dt className="text-xs leading-tight text-carvao-muted">{t}</dt>
                          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-obee-tinta">{n}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3">
                      A comparação é descritiva: não ajusta por população, renda, tamanho ou atribuições da rede. A mediana é o valor do meio
                      entre as {comp.incluidas.length} capitais na comparação, sem ponderação; não é estatística nacional, meta nem valor de
                      referência.
                    </p>
                    {comp.incluidas.some((i) => i.ponto.nota) && (
                      <div className="mt-3">
                        <p className="rotulo text-mineral">* Incluídas com nota</p>
                        <ul className="mt-1 space-y-1.5">
                          {comp.incluidas
                            .filter((i) => i.ponto.nota)
                            .map((i) => (
                              <li key={i.cap.id} className="leading-snug">
                                <span className="font-semibold">
                                  {i.cap.nome} ({i.cap.uf})
                                </span>
                                : {i.ponto.nota}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-obee-tinta">
                    <p className="rotulo text-mineral">Fora da comparação neste recorte ({comp.excluidas.length})</p>
                    {comp.excluidas.length ? (
                      <ul className="mt-1 space-y-1.5">
                        {comp.excluidas.map((e) => (
                          <li key={e.cap.id} className="leading-snug">
                            <span className="font-semibold">
                              {e.cap.nome} ({e.cap.uf})
                            </span>
                            : {e.comValor ? `valor oficial ${formata(s.med, e.ponto.valor as number)}, fora da comparação` : ROTULO_STATUS[e.status].toLowerCase()}
                            {e.motivo ? `. ${e.motivo}` : "."}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">Nenhuma: todas as capitais do grupo têm valor.</p>
                    )}
                  </div>
                </div>
                <details className="mt-5 text-sm">
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela da comparação</summary>
                  <TabelaSimples legenda={`${med.rotulo}, ${s.ano}, por capital`} cabecalho={["Capital", `Valor (${unidadeMed})`, "Situação"]} linhas={linhasComp} />
                </details>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={csvComp} className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie">
                    Baixar esta comparação (CSV)
                  </button>
                  {pass(med.indicador)}
                </div>
              </>
            )
          )}
        </div>
      </Bloco>

      {/* G: decomposição */}
      <Bloco id="decomposicao" rotulo="Explorar · decomposição" titulo={`Composição em ${nomeCap}, ${s.ano}`}>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Despesa liquidada na função Educação, por subfunção</h3>
            <p className="mt-0.5 text-xs text-carvao-muted">% do total da função · exercício {s.ano} · valores nominais · ordem da classificação funcional</p>
            {compDesp.inconsistente ? (
              <SemValor ponto={{ ...compDesp.total, status: "INCONSISTENTE" }} contexto="A soma das subfunções não reconcilia com o total da função; a composição não é exibida." />
            ) : compDesp.total.valor === null ? (
              <SemValor ponto={compDesp.total} />
            ) : (
              <>
                <div className="mt-4">
                  <BarrasComposicao
                    linhas={compDesp.linhas.map((l) => ({ chave: l.codigo, rotulo: l.rotulo, pct: l.participacao, detalhe: percentual(l.participacao, 1) }))}
                  />
                </div>
                <p className="mt-4 text-sm text-obee-tinta">
                  <span aria-hidden="true">✓ </span>
                  Soma das subfunções: {reaisCompleto(somaSub)}, igual ao total da função ({reaisCompleto(compDesp.total.valor)}), com tolerância de R$ 1,00.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  A classificação por subfunção segue a prática contábil de cada município: despesas comuns a várias etapas podem estar em
                  administração geral, em demais subfunções ou distribuídas nas subfunções de etapa. A composição não mede o custo de cada etapa.
                </p>
                <details className="mt-2 text-sm">
                  <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                  <TabelaSimples
                    legenda={`Despesa por subfunção, ${nomeCap}, ${s.ano}`}
                    cabecalho={["Subfunção", "R$", "% da função"]}
                    linhas={[
                      ...compDesp.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), percentual(l.participacao, 2)]),
                      ["Total da função Educação", reaisCompleto(compDesp.total.valor), "100,00%"],
                    ]}
                  />
                </details>
              </>
            )}
            <div className="mt-1">{pass("edu.despesa.subfuncao", "Passaporte", true)}</div>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Matrículas na rede municipal, por etapa</h3>
            <p className="mt-0.5 text-xs text-carvao-muted">matrículas e % do total da rede · Censo Escolar {s.ano} · etapas mutuamente exclusivas</p>
            {distMat.total.valor === null || distMat.total.valor === 0 ? (
              <SemValor ponto={distMat.total} />
            ) : (
              <>
                <div className="mt-4">
                  <BarrasComposicao
                    linhas={distMat.linhas
                      .filter((l) => l.rede !== null)
                      .map((l) => ({
                        chave: l.etapa,
                        rotulo: l.rotulo,
                        pct: (100 * (l.rede ?? 0)) / distMat.total.valor!,
                        detalhe: `${inteiro(l.rede ?? 0)} (${percentual((100 * (l.rede ?? 0)) / distMat.total.valor!, 1)})`,
                      }))}
                  />
                </div>
                <p className="mt-4 text-sm text-obee-tinta">
                  <span aria-hidden="true">✓ </span>
                  Soma das etapas: {inteiro(distMat.linhas.reduce((a, l) => a + (l.rede ?? 0), 0))}, igual ao total da rede ({inteiro(distMat.total.valor)}).
                </p>
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  A educação especial é uma modalidade transversal, já contada nas etapas. Matrículas em escolas privadas conveniadas com o
                  município aparecem só na tabela, em coluna separada, e não entram na soma.
                </p>
                <details className="mt-2 text-sm">
                  <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                  <TabelaSimples
                    legenda={`Matrículas por etapa, ${nomeCap}, ${s.ano}`}
                    cabecalho={["Etapa", "Rede municipal", "Conveniadas com o município (à parte)"]}
                    linhas={[
                      ...distMat.linhas.map((l) => [l.rotulo, l.rede !== null ? inteiro(l.rede) : "", l.conveniadas !== null ? inteiro(l.conveniadas) : ""]),
                      ["Total da educação básica", inteiro(distMat.total.valor), convTotal.valor !== null ? inteiro(convTotal.valor) : ""],
                    ]}
                  />
                </details>
              </>
            )}
            <div className="mt-1">{pass("edu.matriculas.rede_municipal", "Passaporte", true)}</div>
          </div>
        </div>
      </Bloco>

      {/* H: tabela auditável */}
      <Bloco
        id="tabela"
        rotulo="Auditar · tabela"
        titulo={`Todos os valores de ${nomeCap}, ${s.ano}`}
        acao={
          <button
            type="button"
            onClick={() => baixar(`obee_educacao_${cap.id}_${s.ano}.csv`, csv(CABECALHO_CSV_TABELA, linhasCsvTabela(dados, cap, tabela)))}
            className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie"
          >
            Baixar esta tabela (CSV, {tabela.length} linhas)
          </button>
        }
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Os mesmos valores dos gráficos e números acima, com período, unidade, estado do dado e fonte. Ideb e Saeb entram pela edição {edicao}
          {exata ? "" : ` (não há edição ${s.ano})`}. O download contém exatamente estas {tabela.length} linhas.
        </p>
        <div className="tabela-scroll mt-4 max-h-[36rem] overflow-y-auto border border-linha" tabIndex={0} role="region" aria-label="Tabela auditável (role na horizontal e na vertical)">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <caption className="sr-only">
              Valores de {nomeCap} em {s.ano}, por medida, etapa e componente
            </caption>
            <thead className="sticky top-0 bg-superficie">
              <tr>
                {CABECALHO_TABELA.map((c) => (
                  <th key={c} scope="col" className="border-b border-carvao-muted px-2.5 py-2 text-left font-semibold text-obee-tinta">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.map((l, i) => (
                <tr key={i} className="border-b border-linha align-top">
                  <th scope="row" className="px-2.5 py-1.5 text-left font-normal text-obee-tinta">
                    {l.medida}
                  </th>
                  <td className="px-2.5 py-1.5 text-obee-tinta">{l.etapa}</td>
                  <td className="px-2.5 py-1.5 text-obee-tinta">{l.componente}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-obee-tinta">{l.periodo}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-obee-tinta">
                    {l.valor}
                    {l.participacao && <span className="block text-xs text-carvao-muted">{percentual(Number(l.participacao), 1)} da função</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-carvao-muted">{l.unidade}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-obee-tinta">{ROTULO_STATUS[l.status]}</td>
                  <td className={`px-2.5 py-1.5 ${l.status === "OBSERVADO" && !l.elegivel ? "font-semibold text-obee-tinta" : "text-carvao-muted"}`}>
                    {rotuloComparacao(l)}
                    {l.situacao && <span className="block text-xs font-normal text-carvao-muted">{l.situacao}</span>}
                  </td>
                  <td className="max-w-[22rem] px-2.5 py-1.5 text-xs leading-snug text-carvao-muted">{l.nota}</td>
                  <td className="px-2.5 py-1.5 text-xs text-carvao-muted">{l.fonte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
}

function Cartao({ id, rotulo, periodo, children, acao }: { id: string; rotulo: string; periodo: string; children: ReactNode; acao: ReactNode }) {
  return (
    <div data-cartao={id} className="flex flex-col bg-superficie px-5 py-5">
      <p className="text-sm font-semibold leading-snug text-obee-tinta">{rotulo}</p>
      <p className="mt-0.5 text-xs leading-snug text-carvao-muted">{periodo}</p>
      <div className="mt-3 flex-1">{children}</div>
      <div className="mt-2">{acao}</div>
    </div>
  );
}

function Valor({ children }: { children: ReactNode }) {
  return <p className="text-[1.9rem] font-semibold leading-tight tracking-tight text-obee-tinta">{children}</p>;
}

function Detalhe({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-snug text-carvao-muted">{children}</p>;
}
