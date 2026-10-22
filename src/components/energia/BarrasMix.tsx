import type { FonteGeracao, Mix } from "@/lib/energia/tipos";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { tx } from "@/lib/energia/idioma";

export const COR_FONTE: Record<FonteGeracao, string> = {
  hidraulica: "var(--serie-hidraulica)",
  termica: "var(--serie-termica)",
  eolica: "var(--serie-eolica)",
  solar: "var(--serie-solar)",
};
export function nomeFonte(): Record<FonteGeracao, string> {
  return tx(
    { hidraulica: "Hidráulica", termica: "Térmica", eolica: "Eólica", solar: "Solar" },
    { hidraulica: "Hydropower", termica: "Thermal", eolica: "Wind", solar: "Solar" },
  );
}
export const ORDEM_FONTES: FonteGeracao[] = ["hidraulica", "termica", "eolica", "solar"];
/** Texto sobre o segmento com contraste AA: branco só sobre o azul da hidráulica. */
// Rótulo sobre a barra com contraste AA: sobre a térmica (laranja) nem branco
// (3,9:1) nem carvão (4,4:1) passam, então o rótulo vai num fundo claro próprio.
const TEXTO_SOBRE: Record<FonteGeracao, string> = {
  hidraulica: "text-white",
  termica: "mx-1 rounded-sm bg-superficie text-carvao",
  eolica: "text-carvao",
  solar: "text-carvao",
};

/**
 * Composição da geração verificada em barras 100% empilhadas, uma por janela.
 * Segmentos separados por 2px, rótulo visível nos segmentos a partir de 6%, e
 * dica nativa com MWmed e participação em todos (tabela equivalente ao lado).
 */
/** Participação exata a partir dos MWmed (evita arredondar de novo o percentual já arredondado). */
const parte = (m: NonNullable<Mix>, f: FonteGeracao) => (m.total_mwmed > 0 ? (100 * m.mwmed[f]) / m.total_mwmed : m.participacao[f]);

export function BarrasMix({
  linhas,
  tabela = false,
}: {
  linhas: { rotulo: string; detalhe?: string; mix: Mix; destaque?: boolean }[];
  /** Inclui a tabela equivalente (participação e total), quando a página não tem outra. */
  tabela?: boolean;
}) {
  const NOME_FONTE = nomeFonte();
  const loc = tx("pt-BR", "en-US");
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label={tx("Legenda", "Legend")}>
        {ORDEM_FONTES.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: COR_FONTE[f] }} />
            {NOME_FONTE[f]}
          </li>
        ))}
      </ul>
      <ul className="space-y-3">
        {linhas.map((l) => (
          <li key={l.rotulo} className="grid items-center gap-2 sm:grid-cols-[9.5rem_1fr]">
            <p className={`text-sm ${l.destaque ? "font-medium text-carvao" : "text-carvao-muted"}`}>
              {l.rotulo}
              {l.detalhe && <span className="block text-xs text-mineral">{l.detalhe}</span>}
            </p>
            {l.mix ? (
              <div className="flex h-8 w-full gap-[2px]" role="img" aria-label={`${l.rotulo}: ${ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} ${l.mix!.participacao[f].toLocaleString(loc)}%`).join(", ")}`}>
                {ORDEM_FONTES.map((f) => {
                  const p = l.mix!.participacao[f];
                  return (
                    <div
                      key={f}
                      title={`${NOME_FONTE[f]}: ${p.toLocaleString(loc)}% · ${l.mix!.mwmed[f].toLocaleString(loc)} ${tx("MWmed", "MWavg")}`}
                      className="flex h-full items-center overflow-hidden first:rounded-l-[3px] last:rounded-r-[3px]"
                      style={{ width: `${p}%`, background: COR_FONTE[f] }}
                    >
                      {p >= 6 && (
                        <span className={`px-1.5 text-xs font-medium tabular-nums ${TEXTO_SOBRE[f]}`}>
                          {parte(l.mix!, f).toLocaleString(loc, { maximumFractionDigits: 0 })}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-mineral">{tx("sem dado para esta janela", "no data for this window")}</p>
            )}
          </li>
        ))}
      </ul>
      {tabela && (
        <TabelaDados
          titulo={tx("Participação de cada fonte na geração verificada, por linha do gráfico", "Share of each source in verified generation, by chart row")}
          colunas={[tx("Linha", "Row"), ...ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} (%)`), tx("Total (MWmed)", "Total (MWavg)")]}
          linhas={linhas.map((l) => [l.rotulo, ...ORDEM_FONTES.map((f) => l.mix?.participacao[f] ?? null), l.mix?.total_mwmed ?? null])}
          casas={[null, 1, 1, 1, 1, 0]}
        />
      )}
    </div>
  );
}
