import type { ReactNode } from "react";
import { Siglas } from "./Siglas";
import { ROTULO_STATUS, type Ponto } from "@/lib/eficiencia/consulta";

/**
 * Estados que acompanham o dado: ausência (sem valor), ressalva material ou informativa e exclusão da comparação. O
 * motivo curto fica sempre visível; o restante abre por clique ou teclado, nunca por hover. Ausência não é zero.
 */

export function SemValor({ ponto, contexto }: { ponto: Ponto; contexto?: string }) {
  const texto = contexto ?? ponto.nota ?? "Sem valor para este recorte.";
  // frase inicial sempre visível; o restante do motivo abre por clique ou teclado
  const corte = texto.length > 170 ? texto.search(/\.\s/) : -1;
  const inicio = corte > 0 ? texto.slice(0, corte + 1) : texto;
  const resto = corte > 0 ? texto.slice(corte + 1).trim() : "";
  return (
    <div className="mt-2 border border-dashed border-mineral bg-papel px-3 py-2 text-sm text-obee-tinta" role="note">
      <p className="rotulo flex items-center gap-1.5 !text-[0.66rem] text-carvao-muted">
        <span aria-hidden="true" className="inline-block h-2 w-2 border border-carvao-muted" />
        {ponto.status === "NAO_COMPARAVEL" && ponto.valor === null ? "Sem valor publicável" : ROTULO_STATUS[ponto.status]}
      </p>
      <p className="mt-1 leading-snug"><Siglas texto={inicio} /></p>
      {resto && (
        <details className="mt-1">
          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver o motivo completo</summary>
          <p className="mt-1 leading-snug text-carvao-muted"><Siglas texto={resto} /></p>
        </details>
      )}
    </div>
  );
}

/**
 * Ressalva junto ao dado: restrição material com sinal visível ("Ressalva"); nota informativa com
 * "Nota". O detalhe abre por clique ou teclado (details/summary), sem depender de hover ou cor.
 */

export function Ressalva({ ponto }: { ponto: Ponto }) {
  const texto = ponto.status === "OBSERVADO" && !ponto.elegivel ? ponto.motivo ?? ponto.nota : ponto.nota;
  if (!texto || ponto.status !== "OBSERVADO") return null;
  const material = ponto.notaMaterial || !ponto.elegivel;
  const extra = !ponto.elegivel && ponto.nota && ponto.nota !== texto ? ponto.nota : null;
  if (material) {
    // ressalva material acompanha o número: a primeira frase fica à vista, o restante abre por clique ou teclado
    const corte = texto.length > 170 ? texto.search(/\.\s/) : -1;
    const inicio = corte > 0 ? texto.slice(0, corte + 1) : texto;
    const resto = corte > 0 ? texto.slice(corte + 1).trim() : "";
    return (
      <div className="mt-3 max-w-prose2 border-l-2 border-obee-tinta pl-3 text-sm leading-snug text-obee-tinta" role="note">
        <p className="rotulo !text-[0.66rem] text-carvao-muted">{ponto.elegivel ? "Ressalva" : "Ressalva: fora das comparações"}</p>
        <p className="mt-0.5"><Siglas texto={inicio} /></p>
        {(resto || extra) && (
          <details className="mt-0.5">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver o restante</summary>
            {resto && <p className="text-carvao-muted"><Siglas texto={resto} /></p>}
            {extra && <p className="mt-1 text-carvao-muted">{extra}</p>}
          </details>
        )}
      </div>
    );
  }
  return (
    <details className="group mt-2 text-xs leading-snug">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 border border-linha px-2 text-carvao-muted">
        <span aria-hidden="true">i</span>
        Nota
        <span className="sr-only"> (abrir detalhe)</span>
      </summary>
      <p className="mt-1.5 text-obee-tinta"><Siglas texto={texto} /></p>
    </details>
  );
}

export function ForaDoEscopo({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-mineral bg-papel px-4 py-4 text-sm leading-relaxed text-obee-tinta" role="note">
      <p className="rotulo !text-[0.66rem] text-carvao-muted">Fora do escopo deste indicador</p>
      <p className="mt-1"><Siglas texto={texto} /></p>
      {children}
    </div>
  );
}


/**
 * Capitais que ficaram fora da comparação do recorte, cada uma com o estado do dado e o primeiro motivo à vista; o texto
 * completo abre por clique ou teclado. A lista acompanha a comparação para que ninguém suma sem explicação.
 */
export function ForaDaComparacao({ itens }: { itens: { nome: string; uf: string; status: string; motivo: string }[] }) {
  if (!itens.length) return null;
  return (
    <div id="fora-da-comparacao" className="scroll-mt-24 border-t border-linha pt-4" role="note">
      <p className="rotulo text-mineral">
        {itens.length === 1 ? "1 capital fora desta comparação" : `${itens.length} capitais fora desta comparação`}
      </p>
      <ul className="mt-2 space-y-2 text-sm leading-snug text-obee-tinta">
        {itens.map((x) => {
          const texto = x.motivo || "Sem valor para este recorte.";
          const corte = texto.length > 150 ? texto.search(/\.\s/) : -1;
          const inicio = corte > 0 ? texto.slice(0, corte + 1) : texto;
          const resto = corte > 0 ? texto.slice(corte + 1).trim() : "";
          return (
            <li key={`${x.nome}-${x.uf}`}>
              <span className="font-semibold">
                {x.nome} ({x.uf})
              </span>
              <span className="text-carvao-muted"> · {x.status}</span>
              <br />
              <Siglas texto={inicio} />
              {resto && (
                <details className="mt-0.5">
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver o motivo completo</summary>
                  <p className="text-carvao-muted"><Siglas texto={resto} /></p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Ressalvas materiais do recorte inteiro, à vista junto do gráfico e sem depender de uma capital escolhida: cada texto distinto,
 * com a que capitais se aplica. A frase inicial fica visível; o restante abre por clique ou teclado.
 */
export function NotasMateriais({ notas, n }: { notas: { texto: string; capitais: string[] }[]; n: number }) {
  if (!notas.length) return null;
  return (
    <div className="border-l-2 border-obee-tinta bg-papel px-3 py-2 text-sm text-obee-tinta" role="note" aria-label="Ressalvas materiais deste recorte">
      <p className="rotulo !text-[0.66rem] text-carvao-muted">Ressalvas deste recorte</p>
      <ul className="mt-1 space-y-2">
        {notas.map((x) => {
          const corte = x.texto.length > 190 ? x.texto.search(/\.\s/) : -1;
          const inicio = corte > 0 ? x.texto.slice(0, corte + 1) : x.texto;
          const resto = corte > 0 ? x.texto.slice(corte + 1).trim() : "";
          const aplica = x.capitais.length === n ? `Vale para as ${n} capitais.` : `Vale para ${x.capitais.length} ${x.capitais.length === 1 ? "capital" : "capitais"}: ${x.capitais.slice(0, 4).join(", ")}${x.capitais.length > 4 ? ` e mais ${x.capitais.length - 4}` : ""}.`;
          return (
            <li key={x.texto} className="leading-snug">
              <Siglas texto={inicio} /> <span className="text-carvao-muted">{aplica}</span>
              {resto && (
                <details className="mt-0.5">
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver o restante</summary>
                  <p className="text-carvao-muted"><Siglas texto={resto} /></p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
