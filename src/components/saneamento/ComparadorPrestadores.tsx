"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { baixarCsv } from "@/lib/saneamento/csv";
import { normalizar } from "@/lib/saneamento/municipios";
import { MEDIDAS_PRESTADOR, formatarMedidaPrestador } from "@/lib/saneamento/prestadores";
import { NATUREZA_CURTA } from "@/lib/saneamento/rotulos";
import type { Prestador } from "@/lib/saneamento/tipos";

/**
 * Até quatro prestadores lado a lado, com as mesmas fórmulas e o perímetro de
 * cada um declarado. Estado na URL (?p=id1,id2): o link reproduz a comparação.
 */
const MAX = 4;
const ESQUEMA = { p: campo(tiposUrl.lista(tiposUrl.texto({ max: 160 }), { max: MAX }), [] as string[]) };

let promessa: Promise<Prestador[]> | null = null;
function carregar(): Promise<Prestador[]> {
  if (!promessa) {
    promessa = fetch("/saneamento/gold/prestadores.json")
      .then((r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        return r.json() as Promise<Prestador[]>;
      })
      .catch((e: unknown) => {
        promessa = null;
        throw e;
      });
  }
  return promessa;
}

export function ComparadorPrestadores({ sugestoes }: { sugestoes: { id: string; rotulo: string }[] }) {
  const [s, set] = useEstadoUrl(ESQUEMA);
  const [lista, setLista] = useState<Prestador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [termo, setTermo] = useState("");

  useEffect(() => {
    let vivo = true;
    setErro(null);
    carregar().then(
      (l) => vivo && setLista(l),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const porId = useMemo(() => new Map((lista ?? []).map((p) => [p.id, p])), [lista]);
  const escolhidos = s.p.map((id) => porId.get(id)).filter((p): p is Prestador => !!p);
  const resultados = useMemo(() => {
    const q = normalizar(termo);
    if (!lista || q.length < 2) return [];
    return lista
      .filter((p) => !s.p.includes(p.id) && normalizar(`${p.nome ?? ""} ${p.sigla ?? ""} ${p.ufs.join(" ")}`).includes(q))
      .slice(0, 8);
  }, [lista, termo, s.p]);

  const adicionar = (id: string) => {
    if (s.p.length >= MAX || s.p.includes(id)) return;
    set({ p: [...s.p, id] });
    setTermo("");
  };
  const remover = (id: string) => set({ p: s.p.filter((x) => x !== id) });

  const exportar = () =>
    baixarCsv(
      "saneamento-comparacao-prestadores-2024.csv",
      ["medida", "como_calculada", ...escolhidos.map((p) => p.sigla ?? p.nome ?? p.id)],
      MEDIDAS_PRESTADOR.map((m) => [m.rotulo, m.nota, ...escolhidos.map((p) => m.valor(p))]),
    );

  if (erro) {
    return (
      <div className="border border-dashed border-linha p-5 text-sm text-carvao-muted">
        <p className="font-medium text-carvao">Não foi possível carregar o cadastro de prestadores ({erro}).</p>
        <button type="button" onClick={() => setTentativa((t) => t + 1)} className="mt-3 inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm">
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-linha bg-superficie p-4">
        <label className="block max-w-xl text-sm text-carvao">
          Adicionar prestador ({escolhidos.length} de {MAX})
          <input
            type="search"
            value={termo}
            disabled={s.p.length >= MAX || !lista}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={lista ? "Nome, sigla ou UF" : "Carregando cadastro"}
            className="mt-1 block min-h-[44px] w-full border border-linha bg-papel px-3 text-sm text-carvao"
          />
        </label>
        {resultados.length > 0 && (
          <ul className="mt-2 max-w-xl divide-y divide-linha border border-linha bg-papel" aria-label="Prestadores encontrados">
            {resultados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => adicionar(p.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-obee-fundo">
                  <span>
                    {p.nome}
                    {p.sigla && <span className="text-carvao-muted"> ({p.sigla})</span>}
                  </span>
                  <span className="shrink-0 text-xs text-carvao-muted">{p.ufs.join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {escolhidos.length === 0 && (
          <div className="mt-3 text-sm text-carvao-muted">
            <p>Comece por um par sugerido ou busque pelo nome:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {sugestoes.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => set({ p: g.id.split(",") })}
                    className="inline-flex min-h-[44px] items-center border border-obee px-3 text-sm text-obee-dark hover:bg-obee-fundo"
                  >
                    {g.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {escolhidos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Prestadores escolhidos">
            {escolhidos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => remover(p.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-carvao px-3 text-sm text-carvao hover:bg-obee-fundo"
                  aria-label={`Remover ${p.nome}`}
                >
                  {p.sigla ?? p.nome} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!lista ? (
        <p className="mt-6 text-sm text-carvao-muted" aria-live="polite">
          Carregando cadastro de prestadores.
        </p>
      ) : escolhidos.length > 0 ? (
        <>
          <div className="tabela-scroll mt-6" tabIndex={0} role="region" aria-label="Comparação de prestadores (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Medidas dos prestadores escolhidos, SINISA 2024</caption>
              <thead>
                <tr className="border-b border-carvao align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Medida</th>
                  {escolhidos.map((p) => (
                    <th key={p.id} scope="col" className="py-2 pr-4 text-right font-medium">
                      <Link href={`/saneamento/prestadores/${p.id}`} className="underline underline-offset-2">
                        {p.sigla ?? p.nome}
                      </Link>
                      <span className="block text-xs font-normal text-carvao-muted">
                        {NATUREZA_CURTA[p.natureza ?? ""] ?? p.natureza ?? "natureza sem dado"} · {p.abrangencia ?? ""} · {p.ufs.join(", ")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEDIDAS_PRESTADOR.map((m) => (
                  <tr key={m.id} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      {m.rotulo}
                      <span className="block text-xs text-carvao-muted">{m.nota}</span>
                    </th>
                    {escolhidos.map((p) => {
                      const v = m.valor(p);
                      return (
                        <td key={p.id} className={`py-2 pr-4 text-right tabular-nums ${v == null ? "text-carvao-muted" : "text-carvao"}`}>
                          {formatarMedidaPrestador(m, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={exportar} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
              Baixar CSV da comparação
            </button>
            <p className="text-xs text-carvao-muted">O endereço da página guarda a seleção; copie o link para compartilhar.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
