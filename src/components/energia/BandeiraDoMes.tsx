"use client";

import { fonteBandeira, fraseBandeira, rotuloBandeira, situacaoBandeira } from "@/lib/energia/bandeira-do-mes";
import type { BandeiraVigente } from "@/lib/energia/tipos-conta";
import { useIdioma } from "@/lib/energia/useIdioma";
import { useMesCorrente } from "./useMesCorrente";

/**
 * Situação da bandeira no mês de quem lê: "rotulo" para a lista de datas do cabeçalho; "frase" com a fonte e a data do arquivo para o
 * texto corrido. O HTML estático sai com o mês da geração da página (`mesInicial`) e o navegador refaz com o mês corrente.
 */
export function BandeiraDoMes({ vigente, mesInicial, forma }: { vigente: BandeiraVigente | null; mesInicial: string; forma: "rotulo" | "frase" }) {
  const idioma = useIdioma();
  const mes = useMesCorrente(mesInicial);
  const s = situacaoBandeira(vigente, mes);
  if (forma === "rotulo")
    return (
      <span data-bandeira-estado={s.estado} data-bandeira-mes={mes}>
        {rotuloBandeira(s, idioma)}
      </span>
    );
  return (
    <span data-bandeira-estado={s.estado} data-bandeira-mes={mes}>
      {fraseBandeira(s, idioma)} {fonteBandeira(vigente, idioma)}
    </span>
  );
}
