"use client";

import { useMemo } from "react";
import { ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_CAMADAS,
  CORES_FIGURA,
  ESQUEMA_CENARIOS,
  FIGURAS_PDE,
  dadosFigura,
  gwTexto,
  linhasCamadasComparaveis,
  rotuloFigura,
  type IdFigura,
  type LinhaCamada,
} from "@/lib/energia/expansao";
import type { FiguraPde } from "@/lib/energia/tipos-expansao";

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

const SERIES_CAMADAS = [
  { id: "anexo_dez2026", rotulo: "Cenário PDE, dez/2026 (Anexo I-3)", cor: "var(--escala-seq-2)" },
  { id: "anexo_dez2035", rotulo: "Cenário PDE, dez/2035 (Anexo I-3)", cor: "var(--serie-comp-4)" },
  { id: "realizado", rotulo: "Realizado: em operação no SIGA", cor: "var(--cor-energia)" },
  { id: "carteira", rotulo: "Carteira: em implantação no RALIE", cor: "var(--serie-comp-3)" },
];

export function ExpansaoCamadas({ linhas, notas, datas }: { linhas: LinhaCamada[]; notas: Record<string, string | null>; datas: { siga: string; ralie: string } }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CENARIOS);
  const comparaveis = useMemo(() => linhasCamadasComparaveis(linhas), [linhas]);
  const sel = linhas.find((l) => l.id === v.cat) ?? null;
  const selecionar = (id: string | null) => definir({ cat: id ?? "" });
  return (
    <div className="space-y-4">
      <GraficoBarras
        titulo={`Cenário, realizado e carteira por categoria, em camadas separadas (GW; cenário do PDE 2035, SIGA de ${datas.siga}, RALIE de ${datas.ralie})`}
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
            <strong className="font-medium">{sel.categoria}</strong>, correspondência {sel.correspondencia}: cenário de {gwTexto(sel.anexo_dez2026, 3)} em dez/2026 e {gwTexto(sel.anexo_dez2035, 3)} em
            dez/2035 no Anexo I-3; {gwTexto(sel.realizado, 3)} em operação no SIGA e {gwTexto(sel.carteira, 3)} em implantação no RALIE. {notas[sel.id] ?? ""}
          </>
        ) : (
          "Escolha uma categoria no gráfico ou na tabela para ler a nota de correspondência com o cadastro da ANEEL."
        )}
      </p>
      <TabelaInterativa
        titulo="Camadas por categoria do PDE 2035, inclusive as sem correspondência no cadastro da ANEEL"
        colunas={COLUNAS_CAMADAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="categoria"
        fonte="EPE e MME, PDE 2035 (Figura 3-25 e Anexo I-3); ANEEL, SIGA e RALIE"
        versao={`PDE 2035; SIGA de ${datas.siga}; RALIE de ${datas.ralie}`}
        nomeArquivo="expansao-pde-camadas"
        chaveUrl="cen.tab"
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        nota="Nenhuma diferença entre camadas é calculada. Categoria sem correspondência verificada (térmicas), fora do universo do cadastro (micro e minigeração distribuída, baterias) ou que não é geração (resposta da demanda) tem realizado e carteira sem dado."
      />
    </div>
  );
}

export function ExpansaoFiguras({ figuras }: { figuras: Partial<Record<IdFigura, FiguraPde>> }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CENARIOS);
  const ids = FIGURAS_PDE.filter((id) => figuras[id]);
  const id = (figuras[v.fig] ? v.fig : ids[0]) as IdFigura | undefined;
  const f = id ? figuras[id] : undefined;
  const d = useMemo(() => (f ? dadosFigura(f) : null), [f]);
  if (!id || !f || !d) return <p className="text-sm text-carvao-muted">Nenhuma figura do caderno de dados do PDE nesta publicação (sem dado).</p>;
  const opcoes = ids.map((x) => [x, `${rotuloFigura(x)} (${figuras[x]!.unidade})`] as const);
  const titulo = `${rotuloFigura(id)}: ${f.titulo} (cenário; ${f.unidade})`;
  return (
    <div className="space-y-4">
      <ExpansaoOpcoes rotulo="Figura do PDE 2035" nome="expansao-cen-fig" opcoes={opcoes} valor={id} onMudar={(fig) => definir({ fig })} />
      {d.modo === "linhas" ? (
        <GraficoLinhas
          titulo={titulo}
          dados={d.dados}
          chaveX="ref"
          formatoX="texto"
          series={d.series.map((s, i) => ({ id: s.id, rotulo: s.rotulo, cor: CORES_FIGURA[i % CORES_FIGURA.length], tracejada: i >= 6 }))}
          unidade={f.unidade}
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
          unidade={f.unidade}
          casas={3}
          orientacao="horizontal"
          alturaCategoria={Math.max(56, 22 * d.series.length)}
        />
      )}
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {f.nota} {f.pagina ? `Relatório, p. ${f.pagina}; ` : ""}aba &quot;{f.aba}&quot; do caderno de dados.
      </p>
    </div>
  );
}
