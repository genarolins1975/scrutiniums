"use client";

import { useEffect, useState } from "react";
import { PROMESSA_ATUALIZACAO, publicadoEmBrasilia, situacaoFrescor, type SituacaoFrescor } from "@/lib/frescor";

/**
 * Selo de frescor da publicação do crédito. O HTML estático traz só a data da
 * última publicação (igual no servidor e no navegador); a idade e o aviso de
 * atraso são calculados no navegador, na hora da leitura, a partir do
 * `gerado_em` do meta.json publicado. Página force-static não congela o "em dia".
 */
export function SeloFrescor({ geradoEm, className = "" }: { geradoEm: string | null | undefined; className?: string }) {
  const [s, setS] = useState<SituacaoFrescor | null>(null);
  useEffect(() => {
    if (!geradoEm) return;
    const atualiza = () => setS(situacaoFrescor(geradoEm, new Date()));
    atualiza();
    const id = window.setInterval(atualiza, 3_600_000);
    return () => window.clearInterval(id);
  }, [geradoEm]);
  return <ConteudoFrescor geradoEm={geradoEm} situacao={s} className={className} />;
}

/** Apresentação pura: `situacao` nula é o HTML do build, antes do cálculo no navegador. */
export function ConteudoFrescor({
  geradoEm,
  situacao: s,
  className = "",
}: {
  geradoEm: string | null | undefined;
  situacao: SituacaoFrescor | null;
  className?: string;
}) {
  if (!geradoEm) {
    return (
      <p className={`text-xs text-mineral ${className}`} data-frescor="sem-data">
        Data da última publicação indisponível. {PROMESSA_ATUALIZACAO}
      </p>
    );
  }

  if (s?.atrasado) {
    return (
      <div role="status" data-frescor="atrasado" className={`border border-erro bg-papel px-4 py-3 text-sm text-carvao ${className}`}>
        <p className="rotulo text-erro">Atualização atrasada</p>
        <p className="mt-1 leading-relaxed">
          A última publicação destes dados é de {s.publicadoEm} (Brasília), {s.idade}. Os números desta página valem para
          essa publicação. O processamento diário não publicou dados novos desde então.
        </p>
      </div>
    );
  }

  return (
    <p className={`text-xs text-mineral ${className}`} data-frescor={s ? "em-dia" : "calculando"}>
      Última publicação: {s ? s.publicadoEm : publicadoEmBrasilia(geradoEm)} (Brasília){s ? `, ${s.idade}` : ""}. {PROMESSA_ATUALIZACAO}
    </p>
  );
}
