"use client";

import { useMemo, type ReactElement } from "react";
import { Controles, TabelaDados } from "@/components/painel";
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
import { Alternancia, Selecao } from "./controles";

export type VisaoColunas = "todas" | "recursos" | "atendimento" | "resultado";

const ROTULO_GRUPO: Record<ColunaDef["grupo"], string> = { recursos: "Gasto, população e matrículas", atendimento: "Atendimento", resultado: "Resultados" };

function fmtResumo(c: ColunaDef, v: number | null): string {
  if (v === null) return "";
  if (c.id === "populacao") return inteiro(v);
  if (c.id === "conveniadas_pct") return percentual(v, 1);
  return c.medida ? formata(c.medida, v) : String(v);
}

/** Valor numérico à direita, em algarismos tabulares (a célula da TabelaDados com nó próprio não alinha sozinha). */
const Num = ({ children, classe = "" }: { children: React.ReactNode; classe?: string }) => <span className={`block text-right tabular-nums ${classe}`}>{children}</span>;

function celula(l: LinhaComparativa, c: ColunaDef): ReactElement {
  const cel = l.celulas[c.id];
  if (cel.foraDoEscopo) return <Num classe="text-mineral">—</Num>;
  if (cel.valor === null || cel.ponto.status !== "OBSERVADO") {
    return <Num classe="text-xs text-carvao-muted">{cel.ponto.status === "AUSENTE_NA_COLETA" ? "Sem registro" : cel.ponto.status === "NAO_COMPARAVEL" ? "Sem valor publicável (ver ressalvas)" : ROTULO_STATUS[cel.ponto.status]}</Num>;
  }
  const fora = !cel.elegivel && c.id !== "populacao" && c.id !== "conveniadas_pct";
  return (
    <Num>
      {cel.texto}
      {fora && <span className="block text-xs font-semibold text-obee-tinta">fora das comparações</span>}
    </Num>
  );
}

function ressalvas(l: LinhaComparativa): ReactElement {
  const material = l.ressalvas.filter((r) => r.material);
  if (!l.ressalvas.length) return <span className="text-carvao-muted">nenhuma</span>;
  return (
    <details className="text-xs">
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
  );
}

/**
 * Tabela comparativa das capitais, com despesa total, população, despesa por habitante, matrículas, despesa por matrícula, participação das
 * conveniadas e resultados da etapa em exibição. Os recursos valem para todas as etapas da rede; só as colunas de resultado seguem a etapa
 * escolhida, e isso aparece no cabeçalho. Ausentes e valores fora das comparações não recebem posição numérica.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) é a fatia de tabelas da página Comparar capitais: as colunas em
 * exibição, a ordem (coluna e sentido, na URL como antes: ?ot= e ?od=) e o arquivo ficam nos Controles do kit logo antes da tabela; as
 * capitais vão numa TabelaDados à vista, com a capital fixa ao rolar, o nome que destaca a capital e as ressalvas por linha; as linhas de
 * resumo do grupo (mediana, média, extremos e cobertura) vão numa segunda TabelaDados, logo abaixo, porque não são capitais e não entram na
 * ordenação. Antes a ordem se escolhia no título de cada coluna e, em tela estreita, a visão "Todas" escondia as colunas não centrais; no
 * molde, a ordem vem do controle e a tabela inteira rola dentro do bloco.
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
  aoOrdenar: (coluna: ColunaId | "alfabetica", decrescente: boolean) => void;
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
  // o rótulo de cada coluna leva o grupo e, nas colunas que seguem a etapa, a etapa (antes numa linha acima do título da coluna)
  const rotulo = (c: ColunaDef) => `${rotuloColuna(c, disc)} (${ROTULO_GRUPO[c.grupo]}${c.porEtapa ? ` · ${nomeEtapa(dados, etapa)}` : ""})${c.id === colSel ? " · medida escolhida" : ""}`;
  const colDiferenca = `Diferença para a mediana do grupo (${MEDIDA[medida].rotulo})`;
  const cabecalho = ["Capital", ...colunas.map(rotulo), colDiferenca, "Ressalvas"];

  const corpo = linhas.map((l) => {
    const selecionada = destacadas.includes(l.cap.id);
    return [
      <button
        key="cap"
        type="button"
        onClick={() => aoSelecionar(l.cap.id)}
        aria-current={selecionada ? "true" : undefined}
        className={`inline-flex min-h-[44px] items-center text-left text-obee-dark underline underline-offset-2 hover:text-obee-tinta ${selecionada ? "font-semibold" : ""}`}
      >
        {l.cap.nome} ({l.cap.uf})<span className="sr-only">{selecionada ? ", capital destacada; ativar retira o destaque" : ", destacar esta capital"}</span>
      </button>,
      ...colunas.map((c) => celula(l, c)),
      <span key="dif" className="text-xs leading-snug text-obee-tinta">
        {l.diferenca ? l.diferenca.texto : colSel ? <span className="text-carvao-muted">sem diferença: fora da comparação ou sem valor</span> : ""}
      </span>,
      ressalvas(l),
    ];
  });
  const resumo = (
    [
      ["Mediana do grupo", "mediana"],
      ["Média simples das capitais", "media"],
      ["Menor valor", "minimo"],
      ["Maior valor", "maximo"],
    ] as const
  ).map(([nome, k]) => [
    nome,
    ...colunas.map((c) => {
      const r = t.resumo[c.id];
      const texto = semEscopo(c) ? "—" : r ? fmtResumo(c, r[k]) : "";
      return texto ? <Num key={c.id}>{texto}</Num> : null;
    }),
  ]);
  const cobertura = [
    "Capitais com valor e na comparação",
    ...colunas.map((c) => {
      const r = t.resumo[c.id];
      return semEscopo(c) ? "—" : r ? `${r.comValor} com valor; ${r.n} na comparação (de ${r.noGrupo})` : c.medida === null && c.id !== "populacao" ? "não se aplica" : "sem valor no grupo";
    }),
  ];
  const opcoesOrdem = [{ v: "alfabetica", t: "Capital (alfabética)" }, ...COLUNAS.map((c) => ({ v: c.id, t: rotuloColuna(c, disc) }))];

  return (
    <>
      <Controles rotulo="Colunas e ordem da tabela comparativa" resumo={`${linhas.length} capitais · ${colunas.length} colunas em exibição · ordem: ${opcoesOrdem.find((o) => o.v === ordem)?.t.toLowerCase()}${ordem === "alfabetica" ? "" : decrescente ? ", decrescente" : ", crescente"}`} idioma="pt">
        <Alternancia<VisaoColunas>
          rotulo="Colunas em exibição"
          valor={visao}
          opcoes={[
            { v: "todas", t: "Todas" },
            { v: "recursos", t: "Gasto e matrículas" },
            { v: "atendimento", t: "Atendimento" },
            { v: "resultado", t: "Resultados" },
          ]}
          aoMudar={aoVisao}
        />
        <div className="w-full min-w-0 sm:w-72">
          <Selecao id="t-ordem" rotulo="Ordenar a tabela por" ajuda="Ordem de leitura; não é classificação." valor={ordem} opcoes={opcoesOrdem} aoMudar={(v) => aoOrdenar(v as ColunaId | "alfabetica", ordem === v ? decrescente : false)} />
        </div>
        <Alternancia<"asc" | "desc">
          rotulo="Sentido"
          valor={decrescente ? "desc" : "asc"}
          opcoes={[
            { v: "asc", t: "Crescente" },
            { v: "desc", t: "Decrescente" },
          ]}
          aoMudar={(v) => aoOrdenar(ordem, v === "desc")}
        />
        <button type="button" onClick={aoBaixar} className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie">
          Baixar esta tabela (CSV)
        </button>
      </Controles>
      <TabelaDados
        recolhida={false}
        idioma="pt"
        id="tabela-comparativa"
        tituloVisivel={`Tabela comparativa das capitais, ${ano}`}
        titulo={`Comparação entre as capitais, ${ano}: despesa total, população, despesa por habitante, matrículas, despesa por matrícula e resultados da etapa escolhida`}
        lead={
          <>
            <p>
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
              linha do resumo do grupo.
            </p>
            <p className="mt-1">A tabela põe gasto, atendimento e resultado de cada capital na mesma linha para consulta; a leitura conjunta não indica causa nem efeito de um sobre o outro, e os períodos de cada coluna são os do cabeçalho.</p>
            <p className="mt-1">A tabela rola na horizontal dentro da caixa; a capital fica visível. Ordene pelos controles logo acima; clique no nome da capital para destacá-la (ou retirar o destaque) no gráfico e na tabela.</p>
          </>
        }
        colunas={cabecalho}
        linhas={corpo}
        limite={corpo.length}
        fixarPrimeiraColuna
        linhasDestacadas={linhas.flatMap((l, i) => (destacadas.includes(l.cap.id) ? [i] : []))}
      />
      <TabelaDados
        recolhida={false}
        idioma="pt"
        id="resumo-do-grupo"
        tituloVisivel={`Resumo do grupo: ${nomeGrupo}, ${ano}`}
        titulo={`Resumo do grupo de comparação, ${ano}: mediana, média simples, extremos e cobertura de cada coluna`}
        colunas={["Resumo", ...colunas.map(rotulo)]}
        linhas={[...resumo, cobertura]}
        limite={resumo.length + 1}
        fixarPrimeiraColuna
        ausencia={Object.fromEntries(colunas.map((c) => [rotulo(c), "sem valor"]))}
        nota="As linhas de resumo não são capitais e não entram na ordenação. A média simples dá o mesmo peso a cada capital. A despesa por habitante e a despesa por matrícula têm, além disso, a razão agregada do grupo (soma dos numeradores ÷ soma dos denominadores dos mesmos pares), mostrada sob o gráfico da comparação. A participação das conveniadas é o total das matrículas em escolas privadas com parceria só com o município dividido pelo total da rede municipal; não é uma medida de gasto. Valor fora das comparações aparece com a sua ressalva e não recebe posição na ordenação."
      />
    </>
  );
}
