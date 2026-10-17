"use client";

import { useMemo, type ReactNode } from "react";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEvidenciaPerdas, useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { Nome } from "@/components/i18n/Nome";
import { dataBR, mesAno, plural } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { degrausRegulatorio, fraseSelecaoRegulatorio, linhasTrechosRegulatorio, rotuloResolucao, type LinhaRegulatorio } from "@/lib/energia/perdas";
import type { SegmentoTecnico } from "@/lib/energia/tipos-perdas";

/**
 * Percentual técnico regulatório implícito no SAMP (P057): nível do trecho mais recente de
 * cada distribuidora contra o trecho anterior (pontos pareados: o parâmetro mudou de um
 * processo tarifário para o seguinte?), degraus mensais da distribuidora escolhida e a
 * tabela de todos os trechos de referência publicados na gold.
 *
 * O que este painel não faz, de propósito: comparar a perda técnica realizada com esse
 * percentual (a técnica do SAMP é o próprio percentual aplicado à injetada, então a
 * diferença seria zero por construção) nem comparar a não técnica realizada com a
 * referência regulatória, que a fonte aberta não publica (bloqueio no painel).
 */

function colunas(tx: <T>(pt: T, en: T) => T): ColunaTabela[] {
  const unidade = tx("% da injetada publicada", "% of published injected energy");
  return [
    { id: "rotulo", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    // AAAA-MM como data: ordena pelo tempo (como texto, "abr/2025" viria antes de "jan/2020")
    { id: "inicio", rotulo: tx("Início do trecho", "Segment start"), tipo: "data" },
    { id: "fim", rotulo: tx("Fim do trecho", "Segment end"), tipo: "data" },
    { id: "meses", rotulo: tx("Meses", "Months"), tipo: "numero", casas: 0 },
    { id: "pct", rotulo: tx("Percentual técnico do trecho", "Technical percentage of the segment"), tipo: "numero", unidade, casas: 3 },
    { id: "pct_anterior", rotulo: tx("Percentual do trecho anterior de referência", "Percentage of the previous reference segment"), tipo: "numero", unidade, casas: 3 },
    { id: "diferenca", rotulo: tx("Diferença contra o trecho anterior de referência", "Difference against the previous reference segment"), tipo: "numero", unidade: "p.p.", casas: 3 },
    { id: "resolucao", rotulo: tx("Resolução homologatória associada", "Associated ratification resolution"), tipo: "texto", idiomaTexto: "nome" },
    { id: "inicio_vigencia", rotulo: tx("Início de vigência da resolução", "Resolution effective from"), tipo: "data" },
  ];
}

function detalheTrecho(l: LinhaRegulatorio, idioma: Idioma): string {
  const anterior = tx(
    l.anterior_inicio && l.anterior_fim ? `; trecho anterior de referência de ${mesAno(l.anterior_inicio)} a ${mesAno(l.anterior_fim)}` : "; sem trecho anterior de referência",
    l.anterior_inicio && l.anterior_fim ? `; previous reference segment from ${mesAno(l.anterior_inicio, idioma)} to ${mesAno(l.anterior_fim, idioma)}` : "; no previous reference segment",
    idioma,
  );
  const resolucao = l.resolucao ? tx(`; ${rotuloResolucao(l.resolucao)}, vigência em ${dataBR(l.inicio_vigencia)}`, `; ${rotuloResolucao(l.resolucao)}, effective on ${dataBR(l.inicio_vigencia, idioma)}`, idioma) : "";
  return tx(
    `trecho mais recente de ${mesAno(l.inicio)} a ${mesAno(l.fim)} (${l.meses} meses)${anterior}${resolucao}`,
    `latest segment from ${mesAno(l.inicio, idioma)} to ${mesAno(l.fim, idioma)} (${plural(l.meses, "month", "months", idioma)})${anterior}${resolucao}`,
    idioma,
  );
}

export type PerdasRegulatorioProps = {
  linhas: LinhaRegulatorio[];
  /** perdas_evidencias_tecnica.json, lido só quando há distribuidora escolhida. */
  urlEvidencias: string;
  segmentos: Record<string, SegmentoTecnico[]>;
  ids: string[];
  rotulos: Record<string, string>;
  versao: string;
  /** Encaixe da página entre a figura (com a distribuidora escolhida) e a tabela: o estado de cada comparação que a página poderia fazer. */
  aposFigura?: ReactNode;
};

export function PerdasRegulatorio({ linhas, urlEvidencias, segmentos, ids, rotulos, versao, aposFigura }: PerdasRegulatorioProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const idioma = useIdioma();
  const tx = useTx();
  const linhaSel = sel ? linhas.find((l) => l.id === sel) ?? null : null;
  const [prova, tentarProva] = useEvidenciaPerdas(urlEvidencias, linhaSel ? linhaSel.id : null);
  const degraus = useMemo(() => (sel && segmentos[sel] ? degrausRegulatorio(segmentos[sel]) : []), [sel, segmentos]);
  const itens = useMemo(
    () =>
      linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        valor: l.atual,
        referencia: l.anterior,
        detalhe: detalheTrecho(l, idioma),
      })),
    [linhas, idioma],
  );
  const linhasTabela = useMemo(() => linhasTrechosRegulatorio(segmentos, rotulos), [segmentos, rotulos]);
  const selTabela = sel ? linhasTabela.find((l) => l.cnpj === sel)?.id ?? null : null;

  return (
    <div className="space-y-5">
      <GraficoPontos
        titulo={tx("Percentual técnico regulatório implícito: trecho mais recente e trecho anterior", "Implicit regulatory technical percentage: latest segment and previous segment")}
        itens={itens}
        unidade="%"
        casas={3}
        rotuloValor={tx("Trecho mais recente", "Latest segment")}
        rotuloReferencia={tx("Trecho anterior de referência", "Previous reference segment")}
        textoSentido={tx(
          { acima: "maior que no trecho anterior", abaixo: "menor que no trecho anterior", igual: "igual ao trecho anterior" },
          { acima: "higher than in the previous segment", abaixo: "lower than in the previous segment", igual: "equal to the previous segment" },
        )}
        selecionado={linhaSel ? linhaSel.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }} // i18n: dado
        chaveUrl="graf"
      />

      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">
            {tx(
              "Escolha um ponto ou uma linha da tabela para ver, mês a mês, o percentual técnico dessa distribuidora.",
              "Choose a point or a table row to see, month by month, the technical percentage of this distribution utility.",
            )}
          </p>
        ) : !linhaSel ? (
          <p>
            {tx(
              <>{rotulos[sel] ?? sel}: nenhum trecho de 6 meses ou mais com o mesmo percentual técnico foi identificado na série do SAMP (trechos curtos ficam só no arquivo para download).</>,
              <>
                <Nome>{rotulos[sel] ?? sel}</Nome>: no segment of 6 months or more with the same technical percentage was found in the SAMP series (short segments are only in the download file).
              </>,
            )}
          </p>
        ) : (
          <>
            <p data-resposta="regulatorio-distribuidora">{marcarNomes(fraseSelecaoRegulatorio(linhaSel, segmentos[sel]?.length ?? 0, idioma), [linhaSel.rotulo], idioma)}</p>
            <div className="mt-1">
              {prova.estado === "pronta" ? (
                <ComproveNumero evidencia={prova.evidencia} rotulo={tx("Comprove este percentual", "Verify this percentage")} endereco={`https://scrutiniums.com/setor-eletrico/perdas/regulatorio?d=${linhaSel.id}#regulatorio`} />
              ) : prova.estado === "carregando" ? (
                <span role="status" className="text-xs text-carvao-muted">
                  {tx("Carregando a evidência do trecho.", "Loading the evidence for the segment.")}
                </span>
              ) : prova.estado === "erro" ? (
                <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarProva}>
                  {tx(<>A evidência não carregou ({prova.erro}); tentar de novo</>, <>The evidence did not load ({prova.erro}); try again</>)}
                </button>
              ) : null}
            </div>
            {linhaSel.resolucao && (
              <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota-ficha="">
                {tx(
                  "A ficha cita a troca contra o trecho imediatamente anterior, curto ou não, que o observatório usa para associar a resolução; a diferença desta página é contra o trecho de referência anterior.",
                  "The record cites the change against the immediately previous segment, short or not, which the observatory uses to associate the resolution; the difference on this page is against the previous reference segment.",
                )}
              </p>
            )}
            {degraus.length > 0 && (
              <div className="mt-3">
                <GraficoLinhas
                  titulo={tx(`${linhaSel.rotulo}: percentual técnico regulatório implícito, mês a mês`, `${linhaSel.rotulo}: implicit regulatory technical percentage, month by month`)}
                  dados={degraus}
                  chaveX="m"
                  formatoX="mes"
                  series={[{ id: "pct", rotulo: tx("Percentual técnico", "Technical percentage"), cor: "var(--escala-seq-4)" }]}
                  unidade={tx("% da injetada publicada", "% of published injected energy")}
                  casas={3}
                  altura={220}
                />
                <p className="mt-2 text-xs text-carvao-muted">
                  {tx(
                    "Lacuna é mês de troca ou trecho curto (a fonte mistura as duas taxas no mês da troca), nunca repetição do valor anterior.",
                    "A gap is a month of change or a short segment (the source mixes the two rates in the month of the change), never a repetition of the previous value.",
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {aposFigura}

      <TabelaInterativa
        titulo={tx("Trechos de referência do percentual técnico", "Reference segments of the technical percentage")}
        colunas={colunas(tx)}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={tx(
          "ANEEL, SAMP Balanço (perdas técnicas e energia injetada publicada); ANEEL, Componentes Tarifárias (início de vigência das resoluções)",
          "ANEEL, SAMP balance (technical losses and published injected energy); ANEEL, tariff components dataset (effective start of the resolutions)",
        )}
        versao={versao}
        nomeArquivo="perdas-percentual-tecnico-trechos"
        chaveUrl="reg"
        selecionado={selTabela}
        onSelecionar={(id) => selecionar(id ? linhasTabela.find((l) => l.id === id)?.cnpj ?? null : null)}
        ordemInicial={{ coluna: "pct", direcao: "desc" }}
        dicaBusca={tx("Sigla ou nome", "Acronym or name")}
        nota={tx(
          <>
            Inferência do observatório (natureza estimada): trecho de 6 meses ou mais com a mesma razão técnica ÷ injetada publicada. Não é a leitura do ato homologatório. A diferença é a mesma do gráfico: percentual do trecho
            menos o do trecho de referência anterior da lista; fica sem dado no primeiro trecho de referência da série ou quando o anterior não consta na lista (o arquivo para baixar traz todos os trechos, e a coluna troca_pp dele é
            contra o trecho imediatamente anterior, curto ou não, ou contra o mês anterior).
          </>,
          <>
            Observatory inference (estimated nature): a segment of 6 months or more with the same technical ÷ published injected ratio. It is not a reading of the ratification act. The difference is the same as in the chart: the
            percentage of the segment minus that of the previous reference segment in the list; it has no data in the first reference segment of the series or when the previous one is not in the list (the download file has all
            segments, and its <code>troca_pp</code> column is against the immediately previous segment, short or not, or against the previous month).
          </>,
        )}
      />
    </div>
  );
}
