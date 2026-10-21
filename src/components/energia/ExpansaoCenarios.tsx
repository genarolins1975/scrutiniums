"use client";

import { useMemo } from "react";
import { ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CORES_FIGURA,
  ESQUEMA_CENARIOS,
  FIGURAS_PDE,
  colunasCamadas,
  dadosFigura,
  gwTexto,
  linhasCamadasComparaveis,
  rotuloFigura,
  tituloFigura,
  type IdFigura,
  type LinhaCamada,
} from "@/lib/energia/expansao";
import type { FiguraPde } from "@/lib/energia/tipos-expansao";
import { UNIDADES_EN } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P043, cenários do PDE 2035 em camadas separadas.
 *
 * Camadas: por categoria do plano, o valor do cenário comparável com o cadastro da ANEEL
 * (Anexo I-3 do relatório, sem a parcela que o SIGA não cadastra), o realizado do SIGA
 * e a carteira do RALIE ficam lado a lado, em barras agrupadas e nunca empilhadas, sem
 * diferença calculada. A categoria escolhida (cen.cat) liga o gráfico, a tabela e a nota
 * de correspondência.
 *
 * Figuras: a figura escolhida (cen.fig) é desenhada com a unidade do caderno de dados
 * (GW, MW, km, MVA, R$ bilhões, TWh); figuras com unidades diferentes nunca dividem
 * eixo. Todo título leva "cenário".
 */

export function ExpansaoCamadas({ linhas, notas, datas }: { linhas: LinhaCamada[]; notas: Record<string, string | null>; datas: { siga: string; ralie: string } }) {
  const idioma = useIdioma();
  const tx = useTx();
  const SERIES_CAMADAS = [
    { id: "anexo_dez2026", rotulo: tx("Cenário PDE, dez/2026 (Anexo I-3)", "PDE scenario, Dec 2026 (Annex I-3)"), cor: "var(--escala-seq-2)" },
    { id: "anexo_dez2035", rotulo: tx("Cenário PDE, dez/2035 (Anexo I-3)", "PDE scenario, Dec 2035 (Annex I-3)"), cor: "var(--serie-comp-4)" },
    { id: "realizado", rotulo: tx("Realizado: em operação no SIGA", "Actual: in operation in the SIGA"), cor: "var(--cor-energia)" }, // i18n: dado
    { id: "carteira", rotulo: tx("Carteira: em implantação no RALIE", "Portfolio: under implementation in the RALIE"), cor: "var(--serie-comp-3)" },
  ];
  const [v, definir] = useEstadoUrl(ESQUEMA_CENARIOS);
  const comparaveis = useMemo(() => linhasCamadasComparaveis(linhas), [linhas]);
  const sel = linhas.find((l) => l.id === v.cat) ?? null;
  const selecionar = (id: string | null) => definir({ cat: id ?? "" });
  return (
    <div className="space-y-4">
      <GraficoBarras
        titulo={tx(
          `Cenário, realizado e carteira por categoria, em camadas separadas (GW; cenário do PDE 2035, SIGA de ${datas.siga}, RALIE de ${datas.ralie})`,
          `Scenario, actual and portfolio by category, in separate layers (GW; PDE 2035 scenario, SIGA of ${datas.siga}, RALIE of ${datas.ralie})`,
        )}
        dados={comparaveis}
        chaveCategoria="id"
        chaveRotulo="categoria"
        series={SERIES_CAMADAS}
        unidade="GW"
        casas={3}
        orientacao="horizontal"
        alturaCategoria={88}
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
      />
      <p aria-live="polite" className="max-w-prose2 text-sm leading-relaxed text-carvao">
        {sel ? (
          <>
            <strong className="font-medium">{sel.categoria}</strong>
            {tx(
              <>
                , correspondência {sel.correspondencia}: cenário de {gwTexto(sel.anexo_dez2026, 3, idioma)} em dez/2026 e {gwTexto(sel.anexo_dez2035, 3, idioma)} em dez/2035 no Anexo I-3; {gwTexto(sel.realizado, 3, idioma)} em operação no SIGA e{" "}
                {gwTexto(sel.carteira, 3, idioma)} em implantação no RALIE.
              </>,
              <>
                , {sel.correspondencia} match: scenario of {gwTexto(sel.anexo_dez2026, 3, idioma)} in Dec 2026 and {gwTexto(sel.anexo_dez2035, 3, idioma)} in Dec 2035 in Annex I-3; {gwTexto(sel.realizado, 3, idioma)} in operation in the SIGA and{" "}
                {gwTexto(sel.carteira, 3, idioma)} under implementation in the RALIE.
              </>,
            )}{" "}
            {notas[sel.id] ? <TrechoPortugues regiao="expansao-camada-nota">{notas[sel.id]}</TrechoPortugues> : ""}
          </>
        ) : (
          tx(
            "Escolha uma categoria no gráfico ou na tabela para ler a nota de correspondência com o cadastro da ANEEL.",
            "Choose a category in the chart or the table to read the note on the match with ANEEL's register.",
          )
        )}
      </p>
      <TabelaInterativa
        titulo={tx("Camadas por categoria do PDE 2035, inclusive as sem correspondência no cadastro da ANEEL", "Layers by PDE 2035 category, including those with no match in ANEEL's register")}
        colunas={colunasCamadas(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="categoria"
        fonte={tx("EPE e MME, PDE 2035 (Figura 3-25 e Anexo I-3); ANEEL, SIGA e RALIE", "EPE and MME, PDE 2035 (Figure 3-25 and Annex I-3); ANEEL, SIGA and RALIE")}
        versao={tx(`PDE 2035; SIGA de ${datas.siga}; RALIE de ${datas.ralie}`, `PDE 2035; SIGA of ${datas.siga}; RALIE of ${datas.ralie}`)}
        nomeArquivo="expansao-pde-camadas"
        chaveUrl="cen.tab"
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        nota={tx(
          "Nenhuma diferença entre camadas é calculada. Categoria sem correspondência verificada (térmicas), fora do universo do cadastro (micro e minigeração distribuída, baterias) ou que não é geração (resposta da demanda) tem realizado e carteira sem dado.",
          "No difference between layers is calculated. A category with no verified match (thermal), outside the register's universe (distributed micro and mini generation, batteries) or that is not generation (demand response) has no data for actual and portfolio.",
        )}
      />
    </div>
  );
}

export function ExpansaoFiguras({ figuras }: { figuras: Partial<Record<IdFigura, FiguraPde>> }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_CENARIOS);
  const ids = FIGURAS_PDE.filter((id) => figuras[id]);
  const id = (figuras[v.fig] ? v.fig : ids[0]) as IdFigura | undefined;
  const f = id ? figuras[id] : undefined;
  const d = useMemo(() => (f ? dadosFigura(f, idioma) : null), [f, idioma]);
  if (!id || !f || !d)
    return <p className="text-sm text-carvao-muted">{tx("Nenhuma figura do caderno de dados do PDE nesta publicação (sem dado).", "No figure from the PDE data workbook in this release (no data).")}</p>;
  const unidade = (u: string) => tx(u, UNIDADES_EN[u] ?? u);
  const opcoes = ids.map((x) => [x, `${rotuloFigura(x, idioma)} (${unidade(figuras[x]!.unidade)})`] as const);
  const titulo = tx(`${rotuloFigura(id, idioma)}: ${f.titulo} (cenário; ${f.unidade})`, `${rotuloFigura(id, idioma)}: ${tituloFigura(f.titulo, idioma)} (scenario; ${unidade(f.unidade)})`);
  return (
    <div className="space-y-4">
      <ExpansaoOpcoes rotulo={tx("Figura do PDE 2035", "PDE 2035 figure")} nome="expansao-cen-fig" opcoes={opcoes} valor={id} onMudar={(fig) => definir({ fig })} />
      {d.modo === "linhas" ? (
        <GraficoLinhas
          titulo={titulo}
          dados={d.dados}
          chaveX="ref"
          formatoX="texto"
          series={d.series.map((s, i) => ({ id: s.id, rotulo: s.rotulo, cor: CORES_FIGURA[i % CORES_FIGURA.length], tracejada: i >= 6 }))}
          unidade={unidade(f.unidade)}
          casas={f.unidade === "GW" ? 3 : f.unidade === "R$ bilhões" ? 2 : 1}
          zeroNoEixo
          legendaInterativa
          altura={320}
        />
      ) : (
        <GraficoBarras
          titulo={titulo}
          dados={d.dados}
          chaveCategoria="id"
          chaveRotulo="coluna"
          series={d.series.map((s, i) => ({ id: s.id, rotulo: s.rotulo, cor: i === 0 ? "var(--escala-seq-2)" : i === 1 ? "var(--serie-comp-4)" : "var(--escala-seq-4)" }))}
          unidade={unidade(f.unidade)}
          casas={3}
          orientacao="horizontal"
          alturaCategoria={Math.max(56, 22 * d.series.length)}
        />
      )}
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            {f.nota} {f.pagina ? `Relatório, p. ${f.pagina}; ` : ""}aba &quot;{f.aba}&quot; do caderno de dados.
          </>,
          <>
            <TrechoPortugues regiao="expansao-figura-nota">{f.nota}</TrechoPortugues> {f.pagina ? `Report, p. ${f.pagina}; ` : ""}tab &quot;<Nome>{f.aba}</Nome>&quot; of the data workbook.
          </>,
        )}
      </p>
    </div>
  );
}
