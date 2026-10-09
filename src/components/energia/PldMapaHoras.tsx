"use client";

import { useMemo, useState } from "react";
import { MapaCalor, type MapaCalorProps } from "@/components/energia/MapaCalor";
import { FAIXAS_DE_HORAS, agruparEmFaixasDeHoras } from "@/lib/energia/pld";

/**
 * Mapa de calor com 24 colunas de hora, em duas formas conforme a largura da tela. Com 1024 px ou mais, a grade das 24 horas, como
 * sempre. Abaixo disso, a grade precisa de mais de 800 px de largura (1.100 px no toque) e a hora de ponta, ao fim do dia, fica fora
 * da tela: no lugar dela entram seis faixas de quatro horas (cada coluna começa na hora indicada), que cabem na tela com o mesmo
 * conjunto de linhas e a mesma escala de cores. O valor de cada faixa é a média simples dos quatro valores horários dela, e as 24
 * horas continuam à mão no mesmo lugar, atrás de "Ver as 24 horas", com a grade rolável de sempre.
 *
 * As duas formas estão no HTML (a troca é de CSS, sem depender de JavaScript); a grade de 24 horas da tela estreita só é montada ao abrir.
 */
export function PldMapaHoras(props: Omit<MapaCalorProps, "passoRotuloColunas"> & { passoRotuloColunas?: number }) {
  const { titulo, valores, nota } = props;
  const faixas = useMemo(() => agruparEmFaixasDeHoras(valores), [valores]);
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <div className="hidden min-w-0 lg:block" data-mapa-horas="largo">
        <MapaCalor {...props} />
      </div>
      <div className="min-w-0 space-y-3 lg:hidden" data-mapa-horas="estreito">
        <MapaCalor
          {...props}
          titulo={`${titulo}, por faixa de quatro horas`}
          colunas={FAIXAS_DE_HORAS}
          valores={faixas}
          passoRotuloColunas={1}
          nota={`Cada coluna é uma faixa de quatro horas que começa na hora indicada (0h vai até as 4h); o valor é a média simples dos quatro valores horários da faixa, sem pesos. ${nota ?? ""}`.trim()}
        />
        <details className="text-xs" onToggle={(e) => setAberta((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            Ver as 24 horas (a grade rola para o lado)
          </summary>
          {aberta && (
            <div className="mt-2">
              <MapaCalor {...props} />
            </div>
          )}
        </details>
      </div>
    </>
  );
}
