import { ContaGradeDica } from "@/components/energia/ContaGradeDica";
import { ContaRolavel } from "@/components/energia/ContaRolavel";
import { nomeMes, num } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { COR_BANDEIRA, SIGLA_BANDEIRA, gradeBandeiras } from "@/lib/energia/conta";
import { bandeiraNoIdioma } from "@/lib/energia/i18n/conta-inclusao";
import type { Bandeiras } from "@/lib/energia/tipos-conta";

/**
 * P050, bandeiras por vigência: grade ano × mês do acionamento publicado pela
 * ANEEL, como tabela semântica (é ela mesma a tabela equivalente). Cada célula
 * traz a sigla da bandeira escrita e o adicional em R$/MWh no texto para leitor
 * de tela; a cor só reforça (verde, amarela, vermelha patamar 1 e 2, escassez
 * hídrica). Mês não publicado fica vazio e dito como "não publicado", nunca
 * preenchido com o mês vizinho. A grade renderiza no servidor; a dica de cada mês
 * (passar o mouse, focar, tocar, setas do teclado) é de ContaGradeDica.
 */

/** Os doze meses (1 a 12): o rótulo curto da coluna e o nome por extenso para o leitor de tela, no idioma da página (nomeMes). */
const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

export function ContaBandeiras({ acionamento }: { acionamento: Bandeiras["acionamento"] }) {
  const idioma = idiomaEnergia();
  const grade = gradeBandeiras(acionamento);
  const presentes = Array.from(new Set(acionamento.map((a) => a.bandeira).filter((b): b is string => !!b)));
  const ordem = ["Verde", "Amarela", "Vermelha P1", "Vermelha P2", "Escassez Hídrica"]; // i18n: dado
  const legenda = [...ordem.filter((b) => presentes.includes(b)), ...presentes.filter((b) => !ordem.includes(b))];
  return (
    <div className="min-w-0">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-carvao-muted" aria-label={tx("Legenda das bandeiras", "Tariff flag legend")}>
        {legenda.map((b) => (
          <li key={b} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: COR_BANDEIRA[b] ?? "var(--serie-2)" }} />
            <span className="font-medium text-carvao">{SIGLA_BANDEIRA[b] ?? b}</span> {bandeiraNoIdioma(b, idioma)}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-dashed border-mineral" />
          {tx("mês não publicado", "month not published")}
        </li>
      </ul>
      <ContaGradeDica
        instrucao={tx(
          "Passe o mouse, toque ou use as setas sobre um mês para ver a bandeira e o adicional dele.",
          "Hover, tap or use the arrow keys on a month to see its tariff flag and surcharge.",
        )}
      >
      <ContaRolavel rotulo={tx("Bandeira acionada por mês e ano", "Tariff flag activated by month and year")}>
        <table className="w-full min-w-[300px] border-separate border-spacing-0.5 text-xs tabular-nums sm:min-w-[560px]">
          <caption className="sr-only">
            {tx(
              <>
                Bandeira tarifária acionada em cada mês, de {grade[0]?.ano} a {grade.at(-1)?.ano}, com o adicional em R$/MWh
              </>,
              <>
                Tariff flag activated in each month, from {grade[0]?.ano} to {grade.at(-1)?.ano}, with the surcharge in R$/MWh
              </>,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-1 text-left font-normal text-mineral sm:pr-2">
                {tx("Ano", "Year")}
              </th>
              {MESES.map((m) => (
                <th key={m} scope="col" className="px-0 py-1 text-center font-normal text-mineral sm:px-0.5">
                  {/* celular: a inicial do mês cabe nas doze colunas sem rolar de lado; o nome inteiro fica para quem lê por voz */}
                  {idioma === "en" ? (
                    // em inglês a inicial vem por último: "December" seguido do ano da primeira linha ("December 2015") não vira data
                    <>
                      <span className="sr-only">{nomeMes(m, idioma, true)}</span>
                      <span aria-hidden="true" className="hidden sm:inline">
                        {nomeMes(m, idioma)}
                      </span>
                      <span aria-hidden="true" className="sm:hidden">
                        {nomeMes(m, idioma)[0].toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="sm:hidden">
                        {nomeMes(m, idioma)[0].toUpperCase()}
                      </span>
                      <span aria-hidden="true" className="hidden sm:inline">
                        {nomeMes(m, idioma)}
                      </span>
                      <span className="sr-only">{nomeMes(m, idioma, true)}</span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((linha) => (
              <tr key={linha.ano}>
                <th scope="row" className="py-0.5 pr-1 text-left font-normal text-carvao sm:pr-2">
                  {linha.ano}
                </th>
                {linha.meses.map((c, i) =>
                  c ? (
                    <td
                      key={i}
                      className="cb-cel"
                      style={{ borderTop: `6px solid ${c.bandeira ? (COR_BANDEIRA[c.bandeira] ?? "var(--serie-2)") : "transparent"}` }}
                    >
                      <span aria-hidden="true">{c.bandeira ? (SIGLA_BANDEIRA[c.bandeira] ?? c.bandeira) : "?"}</span>
                      <span className="sr-only">
                        {c.bandeira ? bandeiraNoIdioma(c.bandeira, idioma) : tx("sem nome publicado", "no published name")},{" "}
                        {c.rs_mwh === null ? tx("sem valor publicado", "no published value") : `${num(c.rs_mwh, 2)} R$/MWh`}
                      </span>
                    </td>
                  ) : (
                    <td key={i} className="cb-vazia">
                      <span className="sr-only">{tx("não publicado", "not published")}</span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ContaRolavel>
      </ContaGradeDica>
    </div>
  );
}
