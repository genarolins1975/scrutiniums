"use client";

import Link from "@/components/i18n/LinkIdioma";
import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { janelaDosPares, rotaEntidade, type Pares } from "@/lib/energia/empresas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

/**
 * Ficha da distribuidora, pares: as distribuidoras do mesmo grupo (e, na continuidade, do mesmo
 * porte do ranking da ANEEL) no mesmo ano de referência, com a desta ficha acesa. Escolher
 * outra barra ou ponto acende a mesma distribuidora nos dois gráficos e oferece a ficha dela; a
 * escolha fica na URL (?par=), e o voltar a desfaz.
 *
 * Os gráficos abrem com a distribuidora da página entre as linhas visíveis: a ordem parte da ponta mais
 * próxima dela e a altura visível vai até a linha dela (janelaDosPares); "Mostrar todas" abre a lista inteira.
 */
export function EmpresasFichaPares({ slug, sigla, perdas, qualidade }: { slug: string; sigla: string; perdas: Pares | null; qualidade: Pares | null }) {
  const tx = useTx();
  const ids = useMemo(() => Array.from(new Set([...(perdas?.itens ?? []), ...(qualidade?.itens ?? [])].map((i) => i.id))), [perdas, qualidade]);
  const esquema = useMemo(() => ({ par: campo(tiposUrl.opcao(ids), "", { param: "par" }) }), [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const sel = v.par || slug;
  const escolher = (id: string | null) => definir({ par: id && id !== slug ? id : "" });
  const rotulo = [...(perdas?.itens ?? []), ...(qualidade?.itens ?? [])].find((i) => i.id === sel)?.rotulo ?? sel;

  const janelaPerdas = perdas ? janelaDosPares(perdas.posicao, perdas.total, 44, 440) : null;
  const janelaDec = qualidade ? janelaDosPares(qualidade.posicao, qualidade.total, 44, 440) : null;
  const barras = perdas ? perdas.itens.map((i) => ({ id: i.id, rotulo: i.rotulo, perdas: i.valor })) : [];

  return (
    <div className="space-y-5">
      {(perdas || qualidade) && (
        <p className="max-w-prose2 text-xs text-carvao-muted" data-ordem-pares="">
          {tx(
            <>
              Os gráficos abrem com a {sigla} à vista: a ordem parte da ponta mais próxima dela. &ldquo;Mostrar todas&rdquo; abre a lista inteira.
            </>,
            <>
              The charts open with <Nome>{sigla}</Nome> in view: the order starts from the end closest to it. &ldquo;Show all&rdquo; opens the whole list.
            </>,
          )}
        </p>
      )}
      {perdas && janelaPerdas && (
        <GraficoBarras
          titulo={tx(`Perdas totais das ${perdas.regra}, com a ${sigla} acesa`, `Total losses of ${perdas.regra}, with ${sigla} highlighted`)}
          dados={janelaPerdas.crescente ? barras : barras.slice().reverse()}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: "perdas", rotulo: tx("Perdas totais", "Total losses"), cor: "var(--serie-comp-1)" }]}
          unidade="%"
          casas={2}
          orientacao="horizontal"
          alturaCategoria={44}
          alturaMaxima={janelaPerdas.alturaMaxima}
          selecionado={sel}
          onSelecionar={escolher}
        />
      )}
      {qualidade && janelaDec && (
        <GraficoPontos
          titulo={tx(`DEC diante do limite nas ${qualidade.regra}`, `DEC against the limit in ${qualidade.regra}`)}
          itens={qualidade.itens.map((i) => ({ id: i.id, rotulo: i.rotulo, valor: i.valor, referencia: i.referencia }))}
          unidade="h"
          casas={2}
          rotuloValor={tx("DEC apurado", "Measured DEC")}
          rotuloReferencia={tx("Limite regulatório", "Regulatory limit")}
          zeroNoEixo
          ordemInicial={{ por: "valor", direcao: janelaDec.crescente ? "asc" : "desc" }} // i18n: dado
          selecionado={sel}
          onSelecionar={escolher}
          alturaMaxima={janelaDec.alturaMaxima}
        />
      )}
      {sel !== slug && (
        <p aria-live="polite" className="text-sm text-carvao">
          {tx("Escolhida", "Chosen")}: <Nome>{rotulo}</Nome>.{" "}
          <Link href={rotaEntidade(sel)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {tx(<>Abrir a ficha de {rotulo}</>, <>Open the profile of <Nome>{rotulo}</Nome></>)}
          </Link>{" "}
          <button type="button" onClick={() => escolher(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            {tx(<>Voltar à {sigla}</>, <>Back to <Nome>{sigla}</Nome></>)}
          </button>
        </p>
      )}
    </div>
  );
}
