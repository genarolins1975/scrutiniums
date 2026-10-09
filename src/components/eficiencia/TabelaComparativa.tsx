"use client";

import { useMemo, type CSSProperties } from "react";
import {
  COLUNAS,
  MEDIDA,
  rotuloColuna,
  ROTULO_STATUS,
  formata,
  nomeEtapa,
  ordenaTabela,
  tabelaComparativa,
  type ColunaDef,
  type CapitalPainel,
  type ColunaId,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type Indice,
  type LinhaComparativa,
  type MedidaId,
  type Moeda,
} from "@/lib/eficiencia/consulta";
import { inteiro, percentual } from "@/lib/eficiencia/formato";
import type { EtapaId } from "@/lib/eficiencia/tipos";

export type VisaoColunas = "todas" | "recursos" | "atendimento" | "resultado";

const ROTULO_GRUPO: Record<ColunaDef["grupo"], string> = { recursos: "Gasto, população e matrículas", atendimento: "Atendimento", resultado: "Resultados" };

function fmtResumo(c: ColunaDef, v: number | null): string {
  if (v === null) return "";
  if (c.id === "populacao") return inteiro(v);
  if (c.id === "conveniadas_pct") return percentual(v, 1);
  return c.medida ? formata(c.medida, v) : String(v);
}

/**
 * Tabela comparativa das capitais, com despesa total, população, despesa por habitante, matrículas, despesa por matrícula, participação das
 * conveniadas e resultados da etapa em exibição. Os recursos valem para todas as etapas da rede; só as colunas de resultado seguem a etapa
 * escolhida, e isso aparece no cabeçalho. Ausentes e valores fora das comparações não recebem posição numérica. Rolagem dentro da tabela,
 * com a capital sempre visível; a página não rola na horizontal.
 */
export function TabelaComparativa({
  ix,
  dados,
  ano,
  etapa,
  moeda,
  disc,
  destacadas,
  grupo,
  capGrupo,
  medida,
  ordem,
  decrescente,
  visao,
  aoOrdenar,
  aoVisao,
  aoSelecionar,
  aoBaixar,
}: {
  ix: Indice;
  dados: DadosPainel;
  ano: number;
  etapa: EtapaId;
  moeda: Moeda;
  disc: Disciplina;
  /** capitais destacadas (poucas), sem tirar o contexto do grupo */
  destacadas: string[];
  /** grupo de comparação: todas as capitais ou as da região de capGrupo */
  grupo: Grupo;
  capGrupo: CapitalPainel;
  medida: MedidaId;
  ordem: ColunaId | "alfabetica";
  decrescente: boolean;
  visao: VisaoColunas;
  aoOrdenar: (coluna: ColunaId | "alfabetica") => void;
  aoVisao: (v: VisaoColunas) => void;
  aoSelecionar: (id: string) => void;
  aoBaixar: () => void;
}) {
  const t = useMemo(() => tabelaComparativa(ix, ano, etapa, moeda, disc, grupo, capGrupo, medida), [ix, ano, etapa, moeda, disc, grupo, capGrupo, medida]);
  const linhas = useMemo(() => ordenaTabela(t.linhas, ordem, decrescente), [t.linhas, ordem, decrescente]);
  const colunas = COLUNAS.filter((c) => visao === "todas" || c.grupo === visao);
  const colSel = COLUNAS.find((c) => c.medida === medida)?.id;
  const nomeGrupo = grupo === "regiao" ? `capitais da região ${dados.regioes[capGrupo.regiao]}` : "todas as capitais estaduais";
  /** a medida da coluna não existe na etapa escolhida (por exemplo, Ideb na creche); alunos por turma existe também em creche e pré-escola */
  const semEscopo = (c: ColunaDef) => c.porEtapa && !!c.medida && !(MEDIDA[c.medida].etapas ?? []).includes(etapa);
  const resultadoSemEscopo = !["anos_iniciais", "anos_finais"].includes(etapa);
  /** em tela estreita, a visão "Todas" mostra só as medidas centrais; as demais aparecem ao escolher um grupo de colunas */
  const esconde = (c: ColunaDef) => (visao === "todas" && !c.central ? "hidden md:table-cell" : "");
  const aria = (id: ColunaId | "alfabetica") => (ordem === id ? (decrescente ? "descending" : "ascending") : "none");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <fieldset className="min-w-0">
          <legend className="rotulo text-carvao-muted">Colunas em exibição</legend>
          <div className="mt-1.5 inline-flex flex-wrap border border-linha bg-superficie">
            {(
              [
                ["todas", "Todas"],
                ["recursos", "Gasto e matrículas"],
                ["atendimento", "Atendimento"],
                ["resultado", "Resultados"],
              ] as [VisaoColunas, string][]
            ).map(([v, tx]) => (
              <label
                key={v}
                className={`relative inline-flex min-h-[44px] cursor-pointer items-center px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
                  visao === v ? "bg-obee-fundo font-semibold text-obee-tinta" : "text-carvao-muted hover:text-obee-tinta"
                }`}
              >
                <input type="radio" className="sr-only" name="visao-colunas" value={v} checked={visao === v} onChange={() => aoVisao(v)} />
                {tx}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={aoBaixar} className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie">
          Baixar esta tabela (CSV)
        </button>
      </div>
      <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {nomeGrupo[0].toUpperCase() + nomeGrupo.slice(1)}, exercício {ano}. Recursos e matrículas valem para todas as etapas da rede municipal; os resultados são os de{" "}
        {resultadoSemEscopo ? (
          <>
            <strong className="font-semibold text-obee-tinta">{nomeEtapa(dados, etapa).toLowerCase()}</strong>, que não têm Ideb, Saeb, aprovação e, no caso de ensino médio e EJA, alunos por turma neste painel: escolha anos iniciais ou finais
            para vê-los
          </>
        ) : (
          <strong className="font-semibold text-obee-tinta">{nomeEtapa(dados, etapa).toLowerCase()}</strong>
        )}
        . {t.edicaoExata ? `Ideb e Saeb usam a edição ${t.edicao}` : `Ideb e Saeb são bienais e não há edição em ${ano}: essas colunas ficam sem valor (a edição mais recente é a de ${t.edicao}, disponível ao escolher o ano ${t.edicao})`}. A mediana de cada coluna usa só as capitais com valor observado e elegível; a cobertura difere entre colunas e está na última
        linha.
      </p>
      {visao === "todas" && (
        <p className="mt-1 text-xs text-carvao-muted md:hidden">Em tela estreita, a visão Todas mostra as medidas centrais de gasto e matrículas. Escolha um grupo de colunas para ver população, atendimento e resultados.</p>
      )}
      <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        A tabela põe gasto, atendimento e resultado de cada capital na mesma linha para consulta; a leitura conjunta não indica causa nem efeito de um sobre o outro, e os períodos de cada coluna são os do cabeçalho.
      </p>
      <p className="mt-1 text-xs text-carvao-muted" id="aviso-rolagem">
        A tabela rola na horizontal e na vertical dentro da caixa; a capital fica visível. Clique no título de uma coluna para ordenar; clique no nome da capital para destacá-la (ou retirar o destaque) no gráfico e na tabela.
      </p>
      <div
        className="tabela-scroll mt-3 max-h-[40rem] overflow-y-auto border border-linha"
        tabIndex={0}
        role="region"
        aria-label={`Tabela comparativa das capitais, ${ano} (role na horizontal e na vertical)`}
        aria-describedby="aviso-rolagem"
      >
        <table
          className="w-full min-w-[var(--mw-estreita)] border-collapse text-sm md:min-w-[var(--mw-larga)]"
          style={{ "--mw-estreita": `${6.25 + colunas.filter((c) => esconde(c) === "").length * 6.75}rem`, "--mw-larga": `${14 + colunas.length * 9.5}rem` } as CSSProperties}
        >
          <caption className="sr-only">
            Comparação entre as capitais, {ano}: despesa total, população, despesa por habitante, matrículas, despesa por matrícula e resultados da etapa escolhida
          </caption>
          <thead className="sticky top-0 z-20 bg-superficie">
            <tr>
              <th scope="col" aria-sort={aria("alfabetica")} className="sticky left-0 z-30 min-w-[6.25rem] border-b border-r border-carvao-muted bg-superficie px-2 py-2 text-left align-bottom md:min-w-[10rem] md:px-2.5">
                <button type="button" onClick={() => aoOrdenar("alfabetica")} className="inline-flex min-h-[44px] items-center gap-1 text-left font-semibold text-obee-tinta">
                  Capital{ordem === "alfabetica" ? <span aria-hidden="true"> ↓</span> : null}
                </button>
              </th>
              {colunas.map((c) => (
                <th key={c.id} scope="col" aria-sort={aria(c.id)} className={`${esconde(c)} min-w-[6.75rem] border-b border-carvao-muted px-2 py-2 text-right md:min-w-[8.5rem] md:px-2.5 align-bottom ${c.id === colSel ? "bg-obee-fundo" : ""}`}>
                  <span className="block text-[0.66rem] font-normal uppercase tracking-wide text-carvao-muted">
                    {ROTULO_GRUPO[c.grupo]}
                    {c.porEtapa ? ` · ${nomeEtapa(dados, etapa)}` : ""}
                  </span>
                  <button type="button" onClick={() => aoOrdenar(c.id)} className="inline-flex min-h-[44px] min-w-[44px] items-end justify-end gap-1 text-right font-semibold text-obee-tinta">
                    {rotuloColuna(c, disc)}
                    {ordem === c.id ? <span aria-hidden="true">{decrescente ? "↓" : "↑"}</span> : null}
                  </button>
                </th>
              ))}
              <th scope="col" className="min-w-[13rem] border-b border-carvao-muted px-2.5 py-2 text-left align-bottom font-semibold text-obee-tinta">
                Diferença para a mediana do grupo
                <span className="block text-xs font-normal text-carvao-muted">{MEDIDA[medida].rotulo}</span>
              </th>
              <th scope="col" className="min-w-[8rem] border-b border-carvao-muted px-2.5 py-2 text-left align-bottom font-semibold text-obee-tinta">
                Ressalvas
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <LinhaTabela key={l.cap.id} l={l} colunas={colunas} colSel={colSel} selecionada={destacadas.includes(l.cap.id)} aoSelecionar={aoSelecionar} esconde={esconde} />
            ))}
          </tbody>
          <tfoot className="bg-papel">
            {(
              [
                ["Mediana do grupo", "mediana"],
                ["Média simples das capitais", "media"],
                ["Menor valor", "minimo"],
                ["Maior valor", "maximo"],
              ] as const
            ).map(([rotulo, k]) => (
              <tr key={k} className="border-t border-linha align-top">
                <th scope="row" className="sticky left-0 z-10 bg-papel px-2.5 py-1.5 text-left font-semibold text-obee-tinta">
                  {rotulo}
                </th>
                {colunas.map((c) => {
                  const r = t.resumo[c.id];
                  const sem = semEscopo(c);
                  return (
                    <td key={c.id} className={`${esconde(c)} px-2.5 py-1.5 text-right tabular-nums text-obee-tinta ${c.id === colSel ? "bg-obee-fundo" : ""}`}>
                      {sem ? "—" : r ? fmtResumo(c, r[k]) : ""}
                    </td>
                  );
                })}
                <td />
                <td />
              </tr>
            ))}
            <tr className="border-t border-linha align-top">
              <th scope="row" className="sticky left-0 z-10 bg-papel px-2.5 py-1.5 text-left font-semibold text-obee-tinta">
                Capitais com valor e na comparação
              </th>
              {colunas.map((c) => {
                const r = t.resumo[c.id];
                const sem = semEscopo(c);
                return (
                  <td key={c.id} className={`${esconde(c)} px-2.5 py-1.5 text-right text-xs tabular-nums text-carvao-muted ${c.id === colSel ? "bg-obee-fundo" : ""}`}>
                    {sem ? "—" : r ? `${r.comValor} com valor; ${r.n} na comparação (de ${r.noGrupo})` : c.medida === null && c.id !== "populacao" ? "não se aplica" : "sem valor no grupo"}
                  </td>
                );
              })}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        As linhas de resumo não são capitais e não entram na ordenação. A média simples dá o mesmo peso a cada capital. A despesa por habitante e a despesa por matrícula têm, além disso, a razão agregada do grupo (soma dos numeradores ÷ soma dos denominadores dos
        mesmos pares), mostrada sob o gráfico da comparação. A participação das conveniadas é o total das matrículas em escolas privadas com parceria só com o município dividido pelo total da rede municipal; não é uma medida de gasto.
        Valor fora das comparações aparece com a sua ressalva e não recebe posição na ordenação.
      </p>
    </div>
  );
}

function Celula({ l, c, destaque, esconde }: { l: LinhaComparativa; c: ColunaDef; destaque: boolean; esconde: string }) {
  const cel = l.celulas[c.id];
  const base = `${esconde} px-2.5 py-1.5 text-right align-top tabular-nums ${destaque ? "bg-obee-fundo" : ""}`;
  if (cel.foraDoEscopo) return <td className={`${base} text-mineral`}>—</td>;
  if (cel.valor === null || cel.ponto.status !== "OBSERVADO") {
    return (
      <td className={`${base} text-xs text-carvao-muted`}>
        {cel.ponto.status === "AUSENTE_NA_COLETA" ? "Sem registro" : cel.ponto.status === "NAO_COMPARAVEL" ? "Sem valor publicável (ver ressalvas)" : ROTULO_STATUS[cel.ponto.status]}
      </td>
    );
  }
  const fora = !cel.elegivel && c.id !== "populacao" && c.id !== "conveniadas_pct";
  return (
    <td className={`${base} text-obee-tinta`}>
      {cel.texto}
      {fora && <span className="block text-xs font-semibold text-obee-tinta">fora das comparações</span>}
    </td>
  );
}

function LinhaTabela({
  l,
  colunas,
  colSel,
  selecionada,
  aoSelecionar,
  esconde,
}: {
  l: LinhaComparativa;
  colunas: ColunaDef[];
  colSel: ColunaId | undefined;
  selecionada: boolean;
  aoSelecionar: (id: string) => void;
  esconde: (c: ColunaDef) => string;
}) {
  const material = l.ressalvas.filter((r) => r.material);
  return (
    <tr className={`border-b border-linha align-top ${selecionada ? "bg-obee-fundo/40" : ""}`}>
      <th scope="row" className={`sticky left-0 z-10 border-r border-linha px-2.5 py-1.5 text-left font-normal ${selecionada ? "bg-obee-fundo font-semibold" : "bg-superficie"}`}>
        <button
          type="button"
          onClick={() => aoSelecionar(l.cap.id)}
          aria-current={selecionada ? "true" : undefined}
          className="inline-flex min-h-[44px] items-center text-left text-obee-dark underline underline-offset-2 hover:text-obee-tinta"
        >
          {l.cap.nome} ({l.cap.uf})
          <span className="sr-only">{selecionada ? ", capital destacada; ativar retira o destaque" : ", destacar esta capital"}</span>
        </button>
      </th>
      {colunas.map((c) => (
        <Celula key={c.id} l={l} c={c} destaque={c.id === colSel} esconde={esconde(c)} />
      ))}
      <td className="px-2.5 py-1.5 text-xs leading-snug text-obee-tinta">{l.diferenca ? l.diferenca.texto : colSel ? <span className="text-carvao-muted">sem diferença: fora da comparação ou sem valor</span> : ""}</td>
      <td className="px-2.5 py-1.5 text-xs">
        {l.ressalvas.length ? (
          <details>
            <summary className={`inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 border px-2 ${material.length ? "border-obee-tinta font-semibold text-obee-tinta" : "border-linha text-carvao-muted"}`}>
              <span aria-hidden="true">{material.length ? "!" : "i"}</span>
              {l.ressalvas.length} {l.ressalvas.length === 1 ? "item" : "itens"}
              <span className="sr-only"> (abrir ressalvas de {l.cap.nome})</span>
            </summary>
            <ul className="mt-1.5 w-[20rem] max-w-[70vw] space-y-1.5 leading-snug text-obee-tinta">
              {l.ressalvas.map((r, i) => (
                <li key={i}>
                  <span className="font-semibold">{r.coluna}:</span> {r.texto}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <span className="text-carvao-muted">nenhuma</span>
        )}
      </td>
    </tr>
  );
}

