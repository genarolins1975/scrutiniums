import type { ReactNode } from "react";
import {
  MEDIDA,
  diferenca,
  formata,
  type CapitalPainel,
  type ContextoInternacional,
  type MedidaId,
  type NivelExterno,
  type RefGrupo,
} from "@/lib/eficiencia/consulta";
import { decimal, inteiro, reaisInteiro } from "@/lib/eficiencia/formato";

/**
 * Referências visíveis junto de cada número: o grupo de capitais (média simples, mediana, extremos, faixa central quando o grupo
 * é grande o bastante), a referência nacional oficial com o universo declarado e o contexto internacional em seção própria.
 * Linguagem descritiva: "acima da mediana", "diferença de X pontos"; nunca "melhor", "pior" nem meta.
 */

const nomeCap = (c: CapitalPainel) => `${c.nome} (${c.uf})`;

export function listaCapitais(cs: CapitalPainel[]): string {
  return cs.map(nomeCap).join(", ");
}

/** Extremos com empate: "menor valor observado entre as 26 capitais: Belém (PA)". */
export function Extremos({ r, m, rotuloGrupo }: { r: RefGrupo; m: MedidaId; rotuloGrupo: string }) {
  if (r.minimo === null || r.maximo === null) return null;
  return (
    <>
      Menor valor observado {rotuloGrupo}: {formata(m, r.minimo)} ({listaCapitais(r.capitaisMinimo)}). Maior: {formata(m, r.maximo)} ({listaCapitais(r.capitaisMaximo)}).
    </>
  );
}

/** Linha de referência do grupo para um cartão: mediana, média, tamanho do grupo e posição descritiva do valor. */
export function RefLinha({ r, m, valor, elegivel, rotuloGrupo }: { r: RefGrupo | null; m: MedidaId; valor: number | null; elegivel: boolean; rotuloGrupo: string }) {
  if (!r || r.mediana === null) {
    return <p className="mt-2 text-xs leading-snug text-carvao-muted">Sem referência do grupo: nenhuma capital do grupo tem valor observado e elegível neste recorte.</p>;
  }
  const d = valor !== null && elegivel ? diferenca(m, valor, r.mediana) : null;
  const eMin = valor !== null && elegivel && r.minimo !== null && valor === r.minimo;
  const eMax = valor !== null && elegivel && r.maximo !== null && valor === r.maximo;
  return (
    <div className="mt-2 border-t border-linha pt-2 text-xs leading-snug text-carvao-muted">
      <p>
        <span className="font-semibold text-obee-tinta">Mediana {rotuloGrupo}:</span> {formata(m, r.mediana)}
        {r.media !== null && <> · média simples {formata(m, r.media)}</>} · {r.n} {r.n === 1 ? "capital" : "capitais"} na comparação
        {r.n < r.noGrupo ? ` (de ${r.noGrupo})` : ""}
      </p>
      {r.quartisExibicao && r.q1 !== null && r.q3 !== null && (
        <p className="mt-0.5">
          50% centrais dos valores: {formata(m, r.q1)} a {formata(m, r.q3)}
        </p>
      )}
      {d && <p className="mt-0.5 text-obee-tinta">Este valor: {d.texto}.</p>}
      {(eMin || eMax) && <p className="mt-0.5 text-obee-tinta">{eMin ? "Menor valor observado" : "Maior valor observado"} entre as {r.n} capitais na comparação.</p>}
      {valor !== null && !elegivel && <p className="mt-0.5 text-obee-tinta">Valor fora das comparações: não entra na referência do grupo.</p>}
    </div>
  );
}

/** Resumo completo do grupo, sob o gráfico: média, mediana, extremos, faixa central, razão agregada e cobertura. */
export function ResumoGrupo({
  r,
  m,
  rotuloGrupo,
  textoRazao,
}: {
  r: RefGrupo;
  m: MedidaId;
  rotuloGrupo: string;
  /** frase da razão agregada, quando a medida tem numerador e denominador publicados */
  textoRazao?: ReactNode;
}) {
  const itens: [string, ReactNode, boolean?][] = [
    ["Capitais na comparação", `${r.n} de ${r.noGrupo} no grupo${r.comValor !== r.n ? `; ${r.comValor} com valor` : ""}`],
    ["Mediana", r.mediana === null ? "sem valor" : formata(m, r.mediana)],
    ["Média simples", r.media === null ? "sem valor" : formata(m, r.media)],
    ["Menor valor", r.minimo === null ? "sem valor" : `${formata(m, r.minimo)} · ${listaCapitais(r.capitaisMinimo)}`],
    ["Maior valor", r.maximo === null ? "sem valor" : `${formata(m, r.maximo)} · ${listaCapitais(r.capitaisMaximo)}`],
  ];
  if (r.quartisExibicao && r.q1 !== null && r.q3 !== null) itens.push(["50% centrais dos valores", `${formata(m, r.q1)} a ${formata(m, r.q3)}`]);
  else itens.push(["50% centrais dos valores", `não exibido: com ${r.n} valores, a faixa entre quartis daria precisão aparente (política de apresentação, limiar de 8)`]);
  if (r.razaoAgregada !== null && textoRazao) itens.push(["Razão agregada do grupo", textoRazao, true]);
  return (
    <dl className="grid border-l border-t border-linha bg-superficie text-sm sm:grid-cols-2 lg:grid-cols-3" aria-label={`Resumo do grupo ${rotuloGrupo}`}>
      {itens.map(([t, v, largo]) => (
        <div key={t} className={`border-b border-r border-linha px-3 py-2.5 ${largo ? "sm:col-span-2 lg:col-span-3" : ""}`}>
          <dt className="text-xs text-carvao-muted">{t}</dt>
          <dd className="mt-0.5 leading-snug text-obee-tinta">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Referências nacionais oficiais: mesmo universo (com diferença, na unidade da escala) ou outro universo (só ao lado). */
export function ReferenciasNacionais({ externas, valor, m, nomeCapital }: { externas: NivelExterno[]; valor: number | null; m: MedidaId; nomeCapital: string }) {
  if (!externas.length) return null;
  return (
    <ul className="space-y-3">
      {externas.map((e) => {
        const d = e.tipo === "nacional_mesmo_universo" && valor !== null ? diferenca(m, valor, e.valor, "referência nacional") : null;
        return (
          <li key={e.id} className="border-l-2 border-obee-neutro pl-3 text-sm leading-relaxed text-obee-tinta">
            <p>
              <span className="font-semibold">{e.rotulo}:</span> {formataExterna(m, e.valor)} <span className="text-carvao-muted">({e.unidade})</span>
            </p>
            <p className="text-xs text-carvao-muted">{e.escopoTexto}</p>
            {d && (
              <p className="mt-0.5 text-xs">
                {nomeCapital}: {d.texto}.
              </p>
            )}
            {e.tipo === "nacional_outro_universo" && (
              <p className="mt-0.5 text-xs text-obee-tinta">Outro universo e outro perímetro: o painel não calcula diferença entre este valor e o de uma capital.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Referência nacional em uma linha, para o cartão: valor da referência e diferença descritiva quando o universo é o mesmo. */
export function RefNacionalLinha({ externas, valor, elegivel, m, nomeCapital }: { externas: NivelExterno[]; valor: number | null; elegivel: boolean; m: MedidaId; nomeCapital: string }) {
  if (!externas.length) return null;
  return (
    <div className="mt-1.5 text-xs leading-snug text-carvao-muted">
      {externas.map((e) => {
        const d = e.tipo === "nacional_mesmo_universo" && valor !== null && elegivel ? diferenca(m, valor, e.valor, "referência nacional") : null;
        return (
          <p key={e.id}>
            <span className="font-semibold text-obee-tinta">{e.rotulo}:</span> {formataExterna(m, e.valor)}
            {e.tipo === "nacional_outro_universo" ? ` (${e.unidade}; outro universo, sem diferença com a capital)` : d ? ` · ${nomeCapital}: ${d.texto}` : ""}
          </p>
        );
      })}
    </div>
  );
}

function formataExterna(m: MedidaId, v: number): string {
  if (m === "despesa_mat") return reaisInteiro(v);
  return formata(m, v);
}

const ROTULO_ISCED: Record<string, string> = { ISCED11_1: "ISCED 1 (anos iniciais, 1º ao 5º ano)", ISCED11_2: "ISCED 2 (anos finais, 6º ao 9º ano)", ISCED11_1T8: "ISCED 1 a 8 (do ensino fundamental ao superior)" };

/** Contexto internacional, em seção própria: outro universo (país), nunca diferença contra a capital nem mistura com a distribuição. */
export function ContextoInternacionalBloco({ grupos, anoPainel }: { grupos: ContextoInternacional[]; anoPainel: number }) {
  if (!grupos.length) return null;
  return (
    <div className="space-y-5">
      {grupos.map((g) => {
        const usd = g.conjunto === "ocde_despesa_por_estudante";
        const fmt = (v: number) => (usd ? `US$ ${inteiro(Math.round(v))}` : decimal(v, 1));
        const valores = g.paises.map((p) => p.valor);
        return (
          <div key={`${g.conjunto}-${g.nivel}-${g.instituicoes}-${g.ano}`} className="border border-linha px-4 py-4 text-sm leading-relaxed text-obee-tinta">
            <p className="font-semibold">
              {g.nome} · {ROTULO_ISCED[g.nivel] ?? g.nivel} · {g.ano}
              {!usd && ` · instituições ${g.instituicoes === "publicas" ? "públicas" : "públicas e privadas"}`}
            </p>
            {g.ano !== anoPainel && (
              <p className="mt-0.5 text-xs text-obee-tinta">
                Outro ano: dado da OCDE de {g.ano}; o painel mostra {anoPainel}. Os dois anos não são o mesmo período.
              </p>
            )}
            <dl className="mt-2 grid gap-px border border-linha bg-linha text-center sm:grid-cols-3">
              {[
                ["Brasil, país inteiro", g.brasil === null ? "sem dado" : fmt(g.brasil)],
                ["Média da OCDE, como publicada", g.media_ocde_publicada === null ? "sem dado" : fmt(g.media_ocde_publicada)],
                ["Países com dado na fonte", `${g.paises_com_dado}${valores.length ? `; de ${fmt(Math.min(...valores))} a ${fmt(Math.max(...valores))} entre os demais` : ""}`],
              ].map(([t, v]) => (
                <div key={t} className="bg-superficie px-2 py-2">
                  <dt className="text-xs text-carvao-muted">{t}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-carvao-muted">
              {usd
                ? "Despesa em instituições educacionais, fonte governamental, por estudante equivalente em tempo integral, em dólares de paridade de poder de compra (PPC) do PIB, nunca convertidos pelo câmbio. Brasil: país inteiro, todas as esferas; a média da OCDE é a média simples dos países da OCDE com dado."
                : "Média de alunos por turma no ensino regular, país inteiro. A média da OCDE é a média simples dos países da OCDE com dado; não é meta. Alunos por turma não é alunos por professor."}
            </p>
            <details className="mt-2">
              <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver os {g.paises_com_dado} países com dado</summary>
              <div className="tabela-scroll mt-2 max-h-72 overflow-y-auto border border-linha" tabIndex={0} role="region" aria-label={`Países, ${g.nome}, ${g.ano} (role na vertical se necessário)`}>
                <table className="w-full min-w-[18rem] border-collapse text-xs">
                  <caption className="sr-only">
                    {g.nome}, {ROTULO_ISCED[g.nivel] ?? g.nivel}, {g.ano}, todos os países com dado na fonte, em ordem alfabética
                  </caption>
                  <thead className="sticky top-0 bg-superficie">
                    <tr>
                      <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-left font-semibold">País</th>
                      <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-right font-semibold">{usd ? "US$ PPC por estudante" : "Alunos por turma"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...g.paises, ...(g.brasil !== null ? [{ codigo: "BRA", nome: "Brazil (Brasil)", valor: g.brasil }] : [])]
                      .sort((a, b) => a.nome.localeCompare(b.nome, "en"))
                      .map((p) => (
                        <tr key={p.codigo} className={`border-b border-linha ${p.codigo === "BRA" ? "font-semibold" : ""}`}>
                          <th scope="row" className="px-2 py-1 text-left font-normal">{p.nome}</th>
                          <td className="px-2 py-1 text-right tabular-nums">{fmt(p.valor)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-carvao-muted">
        Contexto, não comparação: país e município são escalas diferentes, e a OCDE mede outro conceito de despesa e de turma. O painel não calcula diferença entre uma capital e estes
        valores, não mistura os países com a distribuição das capitais e não converte moedas pelo câmbio. A média da OCDE não é meta oficial.
      </p>
    </div>
  );
}

export function SemReferencia({ medida, motivo }: { medida: MedidaId; motivo: string }) {
  return (
    <p className="border border-dashed border-mineral bg-papel px-3 py-2 text-sm leading-relaxed text-obee-tinta" role="note">
      <span className="rotulo !text-[0.66rem] text-carvao-muted">Sem referência externa para {MEDIDA[medida].rotulo.toLowerCase()}</span>
      <br />
      {motivo}
    </p>
  );
}
