"use client";

import { useEffect } from "react";
import { useGoldGeracaoSobDemanda } from "@/components/energia/GeracaoTabelasSobDemanda";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { formatos } from "@/lib/energia/formato";
import { COR_CATEGORIA, curtoCategoria, linhasRecentes, mwmed } from "@/lib/energia/geracao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Séries diária (últimos 60 dias) e horária (últimas 72 horas) do SIN por categoria, do nível Analisar do P021, lidas sob demanda
 * como as tabelas ao lado delas (GeracaoTabelaSobDemanda): a gold geracao_detalhe.json é buscada quando o gráfico chega perto da
 * janela, ao toque no botão ou quando o link já traz o estado dele na URL (intervalo e séries ocultas, `dia.*` e `hor.*`).
 * Antes disso o HTML e as props da página não carregam as duas séries (cerca de 75 KB entre marcação e fluxo de dados), o que
 * mantém a página abaixo dos 600 KB do contrato (seção 5.1). As linhas saem do mesmo seletor (linhasRecentes) que a tabela
 * equivalente e a exportação usam, e o CSV horário e o diário continuam no fim do painel.
 */
export function GeracaoSerieRecente({ tipo }: { tipo: "diaria" | "horaria" }) {
  const { caixa, pedido, pedir, g, erro, tentarDeNovo } = useGoldGeracaoSobDemanda();
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR } = formatos(idioma);
  const chaveUrl = tipo === "diaria" ? "dia" : "hor"; // i18n: dado

  // o estado do gráfico na URL (intervalo ou séries ocultas de um link compartilhado) pede a leitura de imediato
  useEffect(() => {
    const prefixo = `${chaveUrl}.`;
    const chaves: string[] = [];
    new URLSearchParams(window.location.search).forEach((_, k) => chaves.push(k));
    if (chaves.some((k) => k.startsWith(prefixo))) pedir();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pedir só liga o pedido; a URL é lida uma vez por gráfico
  }, [chaveUrl]);

  if (g) {
    const m = g.matriz;
    const serie = tipo === "diaria" ? m.diario_sin_recente : m.horario_sin_recente;
    const eixo = tipo === "diaria" ? m.diario_sin_recente.dias : m.horario_sin_recente.horas;
    return (
      <GraficoLinhas
        chaveUrl={chaveUrl}
        titulo={
          tipo === "diaria"
            ? tx(`Geração diária do SIN por categoria, ${dataBR(eixo[0])} a ${dataBR(eixo[eixo.length - 1])}`, `Daily SIN generation by category, ${dataBR(eixo[0])} to ${dataBR(eixo[eixo.length - 1])}`)
            : tx(`Geração horária do SIN por categoria, de ${dataBR(eixo[0])} a ${dataBR(eixo[eixo.length - 1])}`, `Hourly SIN generation by category, from ${dataBR(eixo[0])} to ${dataBR(eixo[eixo.length - 1])}`)
        }
        dados={linhasRecentes(eixo, serie)}
        chaveX="x"
        formatoX={tipo === "diaria" ? "data" : "hora"}
        series={serie.categorias.map((c) => ({ id: c, rotulo: curtoCategoria(idioma)[c], cor: COR_CATEGORIA[c] }))}
        unidade={mwmed(idioma)}
        casas={0}
        zeroNoEixo
        legendaInterativa
      />
    );
  }
  return (
    <div
      ref={caixa}
      role="status"
      aria-live="polite"
      data-grafico-sob-demanda={tipo}
      className="min-h-[16rem] space-y-2 border border-dashed border-linha p-4 text-sm text-carvao-muted"
    >
      <p>
        {erro
          ? tx(`A série não pôde ser lida da base publicada: ${erro}`, `The series could not be read from the published dataset: ${erro}`)
          : pedido
            ? tx("Lendo a série na base publicada…", "Reading the series from the published dataset…")
            : tipo === "diaria"
              ? tx("A série diária é lida da base publicada quando aparece na tela. Os arquivos CSV do painel estão no fim da página.", "The daily series is read from the published dataset when it appears on screen. The panel CSV files are at the end of the page.")
              : tx("A série horária é lida da base publicada quando aparece na tela. Os arquivos CSV do painel estão no fim da página.", "The hourly series is read from the published dataset when it appears on screen. The panel CSV files are at the end of the page.")}
      </p>
      {!pedido && (
        <button type="button" onClick={pedir} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
          {tx("Carregar a série", "Load the series")}
        </button>
      )}
      {erro && (
        <button type="button" onClick={tentarDeNovo} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
          {tx("Tentar de novo", "Try again")}
        </button>
      )}
    </div>
  );
}
