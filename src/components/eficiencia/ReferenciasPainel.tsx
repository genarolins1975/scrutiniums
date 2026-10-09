import type { ReactNode } from "react";
import type { ReferenciaNacionalCalculada } from "@/lib/eficiencia/tipos";
import {
  MEDIDA,
  classeDaReferencia,
  diferenca,
  diferencaNacionalCalculada,
  formata,
  type CapitalPainel,
  type ContextoInternacional,
  type MedidaId,
  type NivelExterno,
  type RefGrupo,
} from "@/lib/eficiencia/consulta";
import { decimal, inteiro, percentual, reaisCurto, reaisInteiro } from "@/lib/eficiencia/formato";

/**
 * Referências visíveis junto de cada número: o grupo de capitais (média simples, mediana, extremos, faixa central quando o grupo
 * é grande o bastante), a referência nacional oficial com o universo declarado e o contexto internacional em seção própria.
 * Linguagem descritiva: "acima da mediana", "diferença de X pontos"; nunca "melhor", "pior" nem meta.
 */

const nomeCap = (c: CapitalPainel) => `${c.nome} (${c.uf})`;

/** Capitais empatadas em ordem alfabética, igual à da frase factual, com "e" antes da última. */
export function listaCapitais(cs: CapitalPainel[]): string {
  const nomes = cs.map(nomeCap).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return nomes.length < 2 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
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
            <p className="rotulo !text-[0.66rem] text-mineral">{classeDaReferencia(e.origem, e.comparabilidade)}</p>
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

const ROTULO_EXCLUSAO_CURTO: Record<string, string> = {
  DIFERENCA_MATERIAL_COM_RREO: "DCA diverge do RREO",
  DCA_AUSENTE: "sem DCA",
  RREO_AUSENTE: "sem RREO",
  SEM_LINHA_EDUCACAO: "sem linha da Educação",
  ERRO_COLETA: "erro de coleta",
  DESPESA_NAO_POSITIVA: "despesa nula ou negativa",
  POPULACAO_AUSENTE: "sem população",
};

/**
 * Referência nacional calculada pelo OBEE: despesa municipal em Educação por habitante, no exercício mais recente, com o conceito e a
 * conferência das capitais. Mostra mediana, média simples e razão agregada dos MESMOS municípios elegíveis, a cobertura e a diferença
 * descritiva da capital. Não é indicador oficial do IBGE nem da STN, e não é meta.
 */
export function ReferenciaNacionalCalculadaBloco({ referencia, valor, elegivel, nomeCapital, completo }: { referencia: ReferenciaNacionalCalculada; valor: number | null; elegivel: boolean; nomeCapital: string; completo?: boolean }) {
  const g = referencia.grupos.find((x) => x.id === "elegiveis");
  if (!g) return null;
  const dif = valor !== null && elegivel ? diferencaNacionalCalculada(valor, g) : null;
  const cob = referencia.cobertura;
  if (!completo) {
    return (
      <div className="mt-1.5 text-xs leading-snug text-carvao-muted">
        <p>
          <span className="font-semibold text-obee-tinta">{referencia.rotulo_origem}:</span> mediana de {reaisInteiro(g.mediana ?? 0)} por habitante e razão agregada de {reaisInteiro(g.razao_agregada ?? 0)}, em {inteiro(g.n_municipios)} municípios elegíveis de{" "}
          {inteiro(referencia.n_municipios_total)} ({percentual(cob.municipios_pct ?? 0, 1)} dos municípios, {percentual(cob.populacao_pct ?? 0, 1)} da população), {referencia.ano}.
          {dif?.mediana ? ` ${nomeCapital}: ${dif.mediana}.` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="border-l-2 border-obee-neutro pl-3 text-sm leading-relaxed text-obee-tinta">
      <p className="rotulo !text-[0.66rem] text-mineral">Calculado pelo OBEE com fontes oficiais</p>
      <p>
        <span className="font-semibold">Despesa municipal em Educação por habitante, municípios com dados elegíveis, {referencia.ano}:</span> mediana {reaisInteiro(g.mediana ?? 0)}, média simples {reaisInteiro(g.media ?? 0)}, razão agregada{" "}
        {reaisInteiro(g.razao_agregada ?? 0)}.
      </p>
      <p className="mt-1 text-xs text-carvao-muted">
        {referencia.rotulo_origem}: {inteiro(g.n_municipios)} de {inteiro(ref_total(referencia))} municípios ({percentual(cob.municipios_pct ?? 0, 1)}), {percentual(cob.populacao_pct ?? 0, 1)} da população. Não é indicador do IBGE nem da STN e não é meta.
      </p>
      {dif && (
        <p className="mt-1 text-xs">
          {nomeCapital}: {dif.mediana}
          {dif.agregada ? `; ${dif.agregada}` : ""}. A mediana nacional mistura municípios de todos os portes e responsabilidades educacionais; a diferença é descritiva, não avaliação.
        </p>
      )}
      <details className="mt-1">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Cobertura, grupos e exclusões</summary>
        <p className="text-xs text-carvao-muted">
          Mesmo conceito das capitais: despesa liquidada na função Educação (DCA, Anexo I-E, exceto intraorçamentárias) ÷ população residente estimada do IBGE; só entra o município cuja DCA confere com o RREO. A razão agregada soma a despesa e a população dos mesmos{" "}
          {inteiro(g.n_municipios)} municípios elegíveis.
        </p>
        <p className="mt-1 text-xs text-carvao-muted">
          Cobertura: {percentual(cob.municipios_pct ?? 0, 1)} dos municípios, {percentual(cob.populacao_pct ?? 0, 1)} da população e {percentual(cob.despesa_pct ?? 0, 1)} da despesa declarada ({reaisCurto(referencia.despesa_declarada_total)}). Excluídos, por
          motivo: {Object.entries(referencia.exclusoes).map(([k, v]) => `${ROTULO_EXCLUSAO_CURTO[k] ?? v.motivo} (${inteiro(v.n)})`).join("; ")}. Município excluído não é imputado nem tratado como zero.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-carvao-muted">
          {referencia.grupos.map((x) => (
            <li key={x.id}>
              <span className="font-semibold text-obee-tinta">{x.rotulo}</span> ({inteiro(x.n_municipios)}): mediana {reaisInteiro(x.mediana ?? 0)}, razão agregada {reaisInteiro(x.razao_agregada ?? 0)}. {x.nota}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const ref_total = (r: ReferenciaNacionalCalculada) => r.n_municipios_total;

function formataExterna(m: MedidaId, v: number): string {
  if (m === "despesa_mat") return reaisInteiro(v);
  return formata(m, v);
}

const ROTULO_ISCED: Record<string, string> = {
  ISCED11_1: "ISCED 1 (anos iniciais, 1º ao 5º ano)",
  ISCED11_2: "ISCED 2 (anos finais, 6º ao 9º ano)",
  ISCED11_1T8: "ISCED 1 a 8 (do ensino fundamental ao superior)",
};

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
              {g.preliminar ? " · dado preliminar da fonte" : ""}
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
                ["Países com dado na fonte", `${g.paises_com_dado}, dos quais ${g.membros_com_dado} membros da OCDE${valores.length ? `; de ${fmt(Math.min(...valores))} a ${fmt(Math.max(...valores))}` : ""}`],
              ].map(([t, v]) => (
                <div key={t} className="bg-superficie px-2 py-2">
                  <dt className="text-xs text-carvao-muted">{t}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-carvao-muted">
              {usd
                ? "Despesa em instituições educacionais, fonte governamental, por estudante equivalente em tempo integral, em dólares de paridade de poder de compra (PPC) do PIB, nunca convertidos pelo câmbio. Brasil: país inteiro, todas as esferas; só instituições públicas. A média da OCDE é a publicada pela fonte; o OBEE a recalculou como média simples dos membros oficiais da OCDE com dado e ela confere."
                : "Média de alunos por turma no ensino regular, país inteiro. A média da OCDE é a publicada pela fonte e foi recalculada pelo OBEE como média simples dos membros oficiais com dado; não é meta. Alunos por turma não é alunos por professor."}
            </p>
            <details className="mt-2">
              <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver os {g.paises_com_dado} países com dado (membros da OCDE marcados)</summary>
              <div className="tabela-scroll mt-2 max-h-72 overflow-y-auto border border-linha" tabIndex={0} role="region" aria-label={`Países, ${g.nome}, ${g.ano} (role na vertical se necessário)`}>
                <table className="w-full min-w-[18rem] border-collapse text-xs">
                  <caption className="sr-only">
                    {g.nome}, {ROTULO_ISCED[g.nivel] ?? g.nivel}, {g.ano}, todos os países com dado na fonte, em ordem alfabética
                  </caption>
                  <thead className="sticky top-0 bg-superficie">
                    <tr>
                      <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-left font-semibold">País</th>
                      <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-left font-semibold">OCDE</th>
                      <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-right font-semibold">{usd ? "US$ PPC por estudante" : "Alunos por turma"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...g.paises, ...(g.brasil !== null ? [{ codigo: "BRA", nome: "Brazil (Brasil)", valor: g.brasil }] : [])]
                      .sort((a, b) => a.nome.localeCompare(b.nome, "en"))
                      .map((p) => ({ membro: false, ...p }))
                      .map((p) => (
                        <tr key={p.codigo} className={`border-b border-linha ${p.codigo === "BRA" ? "font-semibold" : ""}`}>
                          <th scope="row" className="px-2 py-1 text-left font-normal">{p.nome}</th>
                          <td className="px-2 py-1">{p.codigo === "BRA" ? "não" : p.membro ? "membro" : "não"}</td>
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

/**
 * Referências do grupo em linha, sem caixas: mediana, média simples, menor e maior valor (com a capital), cobertura e, quando
 * informativa, a faixa dos 50% centrais. A razão agregada, que é outra conta, vem em frase própria logo abaixo, para não se
 * confundir com a média simples. Nada aqui é meta, padrão ou nota.
 */
export function ReferenciasDoGrupo({ r, m, textoRazao }: { r: RefGrupo; m: MedidaId; textoRazao?: ReactNode }) {
  const itens: [string, ReactNode][] = [
    ["Mediana", r.mediana === null ? "sem valor" : formata(m, r.mediana)],
    ["Média simples", r.media === null ? "sem valor" : formata(m, r.media)],
    ["Menor valor", r.minimo === null ? "sem valor" : `${formata(m, r.minimo)} · ${listaCapitais(r.capitaisMinimo)}`],
    ["Maior valor", r.maximo === null ? "sem valor" : `${formata(m, r.maximo)} · ${listaCapitais(r.capitaisMaximo)}`],
    ["Capitais na comparação", `${r.n} de ${r.noGrupo}`],
  ];
  if (r.quartisExibicao && r.q1 !== null && r.q3 !== null) itens.push(["Metade central", `${formata(m, r.q1)} a ${formata(m, r.q3)}`]);
  return (
    <div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(([t, v]) => (
          <div key={t} className="border-t border-linha pt-2">
            <dt className="text-xs text-carvao-muted">{t}</dt>
            <dd className="mt-0.5 leading-snug text-obee-tinta">{v}</dd>
          </div>
        ))}
      </dl>
      {!(r.quartisExibicao && r.q1 !== null) && (
        <p className="mt-2 text-xs leading-snug text-carvao-muted">Com {r.n} valores, a faixa entre quartis daria precisão aparente: ela só é exibida a partir de 8 valores.</p>
      )}
      {r.razaoAgregada !== null && textoRazao && <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{textoRazao}</p>}
    </div>
  );
}
