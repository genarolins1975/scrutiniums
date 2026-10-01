"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { rotaEntidade, type Pares } from "@/lib/energia/empresas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";

/**
 * Ficha da distribuidora, pares: as distribuidoras do mesmo grupo (e, na continuidade, do mesmo
 * porte do ranking da ANEEL) no mesmo ano de referência, com a desta ficha acesa. Escolher
 * outra barra ou ponto acende a mesma distribuidora nos dois gráficos e oferece a ficha dela; a
 * escolha fica na URL (?par=), e o voltar a desfaz.
 */
export function EmpresasFichaPares({ slug, sigla, perdas, qualidade }: { slug: string; sigla: string; perdas: Pares | null; qualidade: Pares | null }) {
  const ids = useMemo(() => Array.from(new Set([...(perdas?.itens ?? []), ...(qualidade?.itens ?? [])].map((i) => i.id))), [perdas, qualidade]);
  const esquema = useMemo(() => ({ par: campo(tiposUrl.opcao(ids), "", { param: "par" }) }), [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const sel = v.par || slug;
  const escolher = (id: string | null) => definir({ par: id && id !== slug ? id : "" });
  const rotulo = [...(perdas?.itens ?? []), ...(qualidade?.itens ?? [])].find((i) => i.id === sel)?.rotulo ?? sel;

  return (
    <div className="space-y-5">
      {perdas && (
        <GraficoBarras
          titulo={`Perdas totais das ${perdas.regra}, com a ${sigla} acesa`}
          dados={perdas.itens.map((i) => ({ id: i.id, rotulo: i.rotulo, perdas: i.valor }))}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: "perdas", rotulo: "Perdas totais", cor: "var(--serie-comp-1)" }]}
          unidade="%"
          casas={2}
          orientacao="horizontal"
          alturaCategoria={44}
          alturaMaxima={440}
          selecionado={sel}
          onSelecionar={escolher}
        />
      )}
      {qualidade && (
        <GraficoPontos
          titulo={`DEC diante do limite nas ${qualidade.regra}`}
          itens={qualidade.itens.map((i) => ({ id: i.id, rotulo: i.rotulo, valor: i.valor, referencia: i.referencia }))}
          unidade="h"
          casas={2}
          rotuloValor="DEC apurado"
          rotuloReferencia="Limite regulatório"
          zeroNoEixo
          selecionado={sel}
          onSelecionar={escolher}
          alturaMaxima={440}
        />
      )}
      {sel !== slug && (
        <p aria-live="polite" className="text-sm text-carvao">
          Escolhida: {rotulo}.{" "}
          <Link href={rotaEntidade(sel)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Abrir a ficha de {rotulo}
          </Link>{" "}
          <button type="button" onClick={() => escolher(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            Voltar à {sigla}
          </button>
        </p>
      )}
    </div>
  );
}
