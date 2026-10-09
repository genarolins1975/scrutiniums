import { corDoRecorte, mwmes, type EntidadeEar, type UnidadeEar } from "@/lib/energia/agua";
import { pct, plural } from "@/lib/energia/formato";

/**
 * Faixa usual da data do recorte escolhido, na mesma unidade da figura principal da abertura (% da EAR máxima ou MWmês): a área
 * sombreada vai do 10º ao 90º percentil do mesmo dia do calendário nos anos da base, o traço é a mediana e o círculo cheio é a EAR do
 * dia. Formas diferentes, não só cor. Os números são os campos da própria entidade (os mesmos do gráfico de pontos, da resposta e da
 * tabela): a figura não calcula nada. Estática: a escolha do recorte é a dos controles acima dela.
 *
 * Existe porque a faixa em MWmês, que a tarefa de comparar com a história em energia pede, só estava em colunas de uma tabela larga.
 * A série do último ano e a faixa de cada data seguem só em % da EAR máxima, a única unidade em que a gold as publica.
 */
export function AguaFaixaDaData({ e, unidade }: { e: EntidadeEar; unidade: UnidadeEar }) {
  if (e.sem_armazenamento || e.dia === null) return null;
  const emMw = unidade === "mwmes";
  const ear = emMw ? e.ear_mwmes : e.ear_pct;
  const p10 = emMw ? e.p10_mwmes : e.p10;
  const p50 = emMw ? e.p50_mwmes : e.p50;
  const p90 = emMw ? e.p90_mwmes : e.p90;
  const teto = emMw ? Math.max(e.ear_max_mwmes ?? 0, p90 ?? 0, ear ?? 0) : 100;
  if (ear === null || !(teto > 0)) return null;
  const formatar = (v: number | null) => (emMw ? `${mwmes(v)} MWmês` : pct(v, 1));
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / teto) * 100))}%`;
  const temFaixa = p10 !== null && p90 !== null;
  const cor = corDoRecorte(e);
  const descricao = [
    `EAR do dia ${formatar(ear)}`,
    p50 !== null ? `mediana da data ${formatar(p50)}` : null,
    temFaixa ? `faixa usual da data de ${formatar(p10)} a ${formatar(p90)} (10º a 90º percentil)` : "sem faixa usual da data",
  ]
    .filter(Boolean)
    .join("; ");

  return (
    <figure data-faixa-da-data={e.id} className="space-y-2">
      <figcaption className="text-sm text-carvao">
        <span className="font-medium">Faixa usual da data, {e.rotulo}</span>
        <span className="text-carvao-muted">
          , em {emMw ? "MWmês" : "% da EAR máxima"}: do 10º ao 90º percentil do mesmo dia nos anos da base.
        </span>
      </figcaption>
      <div className="px-2">
        <div role="img" aria-label={descricao} className="relative h-9">
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-linha" />
          {temFaixa && (
            <div
              aria-hidden="true"
              className="absolute top-1/2 h-4 -translate-y-1/2 border"
              style={{
                left: x(p10),
                width: `calc(${x(p90)} - ${x(p10)})`,
                background: "color-mix(in srgb, var(--serie-referencia) 22%, transparent)",
                borderColor: "var(--serie-referencia)",
              }}
            />
          )}
          {p50 !== null && <div aria-hidden="true" className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-carvao-muted" style={{ left: x(p50) }} />}
          <div
            aria-hidden="true"
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie"
            style={{ left: x(ear), background: cor, boxShadow: "0 0 0 1px var(--cor-carvao)" }}
          />
        </div>
        <div aria-hidden="true" className="mt-0.5 flex justify-between text-sm tabular-nums text-carvao-muted">
          <span>0</span>
          <span>{emMw ? `${mwmes(teto)} MWmês` : "100%"}</span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-carvao-muted tabular-nums">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor, boxShadow: "0 0 0 1px var(--cor-carvao)" }} />
          EAR do dia: {formatar(ear)}
        </li>
        {p50 !== null && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3.5 w-0.5 bg-carvao-muted" />
            Mediana da data: {formatar(p50)}
          </li>
        )}
        {temFaixa ? (
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-4 border"
              style={{ background: "color-mix(in srgb, var(--serie-referencia) 22%, transparent)", borderColor: "var(--serie-referencia)" }}
            />
            Faixa usual: {formatar(p10)} a {formatar(p90)}
          </li>
        ) : (
          <li>Sem faixa usual: {plural(e.anos_na_base, "ano", "anos")} na base, menos que os 5 exigidos</li>
        )}
      </ul>
    </figure>
  );
}
