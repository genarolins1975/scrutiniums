import { num } from "@/lib/energia/formato";
import { COR_BANDEIRA, SIGLA_BANDEIRA, gradeBandeiras } from "@/lib/energia/conta";
import type { Bandeiras } from "@/lib/energia/tipos-conta";

/**
 * P050, bandeiras por vigência: grade ano × mês do acionamento publicado pela
 * ANEEL, como tabela semântica (é ela mesma a tabela equivalente). Cada célula
 * traz a sigla da bandeira escrita e o adicional em R$/MWh no texto para leitor
 * de tela; a cor só reforça (verde, amarela, vermelha patamar 1 e 2, escassez
 * hídrica). Mês não publicado fica vazio e dito como "não publicado", nunca
 * preenchido com o mês vizinho. Sem estado: renderiza no servidor.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function ContaBandeiras({ acionamento }: { acionamento: Bandeiras["acionamento"] }) {
  const grade = gradeBandeiras(acionamento);
  const presentes = Array.from(new Set(acionamento.map((a) => a.bandeira).filter((b): b is string => !!b)));
  const ordem = ["Verde", "Amarela", "Vermelha P1", "Vermelha P2", "Escassez Hídrica"];
  const legenda = [...ordem.filter((b) => presentes.includes(b)), ...presentes.filter((b) => !ordem.includes(b))];
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-carvao-muted" aria-label="Legenda das bandeiras">
        {legenda.map((b) => (
          <li key={b} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: COR_BANDEIRA[b] ?? "var(--serie-2)" }} />
            <span className="font-medium text-carvao">{SIGLA_BANDEIRA[b] ?? b}</span> {b}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-dashed border-mineral" />
          mês não publicado
        </li>
      </ul>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Bandeira acionada por mês e ano">
        <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-xs tabular-nums">
          <caption className="sr-only">
            Bandeira tarifária acionada em cada mês, de {grade[0]?.ano} a {grade.at(-1)?.ano}, com o adicional em R$/MWh
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-2 text-left font-normal text-mineral">
                Ano
              </th>
              {MESES.map((m) => (
                <th key={m} scope="col" className="px-0.5 py-1 text-center font-normal text-mineral">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((linha) => (
              <tr key={linha.ano}>
                <th scope="row" className="py-0.5 pr-2 text-left font-normal text-carvao">
                  {linha.ano}
                </th>
                {linha.meses.map((c, i) =>
                  c ? (
                    <td
                      key={i}
                      className="h-8 border border-linha bg-superficie px-0.5 text-center leading-tight text-carvao"
                      style={{ borderTop: `6px solid ${c.bandeira ? (COR_BANDEIRA[c.bandeira] ?? "var(--serie-2)") : "transparent"}` }}
                    >
                      <span aria-hidden="true">{c.bandeira ? (SIGLA_BANDEIRA[c.bandeira] ?? c.bandeira) : "?"}</span>
                      <span className="sr-only">
                        {c.bandeira ?? "sem nome publicado"}, {c.rs_mwh === null ? "sem valor publicado" : `${num(c.rs_mwh, 2)} R$/MWh`}
                      </span>
                    </td>
                  ) : (
                    <td key={i} className="h-8 border border-dashed border-linha">
                      <span className="sr-only">não publicado</span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
