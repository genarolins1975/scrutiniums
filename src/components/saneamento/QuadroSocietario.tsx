import type { CompanhiaAberta } from "@/lib/saneamento/tipos";
import { achatar, nomeAcionista, pctSocietario, rotuloAcoes } from "@/lib/saneamento/controle";
import { data } from "@/lib/saneamento/formato";

/**
 * Posição acionária de uma companhia aberta, como declarada no FRE da CVM. Cada nível mostra os acionistas do acionista acima, com os
 * percentuais dele: é a cadeia de controle informada pela companhia, não uma apuração feita aqui.
 */
export function QuadroSocietario({ companhia }: { companhia: CompanhiaAberta }) {
  const linhas = achatar(companhia);
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`Posição acionária de ${companhia.nome} (rolável)`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">
          Acionistas de {companhia.nome}, FRE versão {companhia.documento.versao}, recebido em {data(companhia.documento.recebido_em)}
        </caption>
        <thead>
          <tr className="border-b border-carvao text-right">
            <th scope="col" className="py-2 pr-4 text-left font-medium">Acionista</th>
            <th scope="col" className="py-2 pr-4 font-medium">Ações ordinárias</th>
            <th scope="col" className="py-2 pr-4 font-medium">Ações preferenciais</th>
            <th scope="col" className="py-2 pr-4 font-medium">Total</th>
            <th scope="col" className="py-2 pr-4 font-medium">Controlador</th>
            <th scope="col" className="py-2 font-medium">Acordo de acionistas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ nivel, acima, no }, i) => (
            <tr key={i} className="border-b border-linha align-top text-right tabular-nums">
              <th scope="row" className="py-2 pr-4 text-left font-normal" style={{ paddingLeft: `${(nivel - 1) * 1.25}rem` }}>
                <span className="text-carvao">{nomeAcionista(no)}</span>
                <span className="block text-xs text-carvao-muted">
                  {acima ? `Acionista de ${acima}` : "Acionista direto da companhia"}
                  {no.cnpj ? `, CNPJ ${no.cnpj}` : ""}
                  {no.exterior ? ", residente no exterior" : ""}
                </span>
              </th>
              <td className="py-2 pr-4">{pctSocietario(no, "pct_on")}</td>
              <td className="py-2 pr-4">{pctSocietario(no, "pct_pn")}</td>
              <td className="py-2 pr-4">
                {pctSocietario(no, "pct_total")}
                {rotuloAcoes(no) && <span className="block text-xs text-carvao-muted">{rotuloAcoes(no)}</span>}
              </td>
              <td className="py-2 pr-4">{no.controlador ? "Sim" : "Não"}</td>
              <td className="py-2">{no.acordo ? "Sim" : "Não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
