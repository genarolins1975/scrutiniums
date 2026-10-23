"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { Nome } from "@/components/i18n/Nome";
import { formatos } from "@/lib/energia/formato";
import { COR_CATEGORIA_LEILAO, CURTO_CATEGORIA, CURTO_SITUACAO, numeroAneel } from "@/lib/energia/leiloes";
import type { IdCategoria, PontosLeiloes } from "@/lib/energia/tipos-leiloes";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Preço de cada empreendimento contratado ao longo do tempo, carregado sob demanda (leiloes_empreendimentos.json, cerca de 250 KB):
 * a página leva só o botão. A categoria escolhida fica em cor; as demais ficam ao fundo, em cinza, como contexto. Teclado: setas
 * percorrem os pontos da categoria em ordem de data; Esc limpa. Tabela equivalente com os pontos da categoria.
 * Idioma: o da página (useIdioma); números e datas pelo formatador do idioma, com o mesmo valor.
 */

const frac = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 + (Number(iso.slice(8, 10)) - 1) / 365;

type Ponto = { i: number; data: string; leilao: string; nome: string; cat: IdCategoria | null; uf: string | null; e: number; p: number | null; pr: number | null; teto: number | null; des: number | null; sit: string; venc: string | null };

export function LeiloesDispersao({ url, categorias, ipcaAte }: { url: string; categorias: { id: IdCategoria; rotulo: string }[]; ipcaAte: string }) {
  const tx = useTx();
  const f = formatos(useIdioma());
  const n = (v: number | null | undefined, casas = 2) => (v == null ? tx("sem dado", "no data") : f.num(v, casas));
  const dataBR = (iso: string) => f.dataBR(iso);
  const uid = useId().replace(/:/g, "");
  const [estado, setEstado] = useState<"inicial" | "carregando" | "pronto" | "erro">("inicial");
  const [dados, setDados] = useState<Ponto[]>([]);
  const [cat, setCat] = useState<IdCategoria>(categorias[0]?.id ?? "eolica");
  const [real, setReal] = useState<"real" | "nominal">("real");
  const [ativo, setAtivo] = useState<number | null>(null);
  const [largura, setLargura] = useState(760);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [estado]);

  const carregar = async () => {
    setEstado("carregando");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as PontosLeiloes;
      setDados(
        j.linhas.map((l, i) => ({
          i, data: l[0], leilao: l[1], nome: l[2], cat: l[3] == null ? null : j.categorias[l[3]], uf: l[4], e: l[5], p: l[6], pr: l[7], teto: l[8], des: l[9],
          sit: j.situacoes[l[10]], venc: l[11],
        })),
      );
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  };

  const valor = (x: Ponto) => (real === "real" ? x.pr : x.p);
  const todos = useMemo(() => dados.filter((x) => valor(x) != null), [dados, real]); // eslint-disable-line react-hooks/exhaustive-deps
  const daCat = useMemo(() => todos.filter((x) => x.cat === cat).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.i - b.i)), [todos, cat]);
  const semPreco = dados.filter((x) => x.cat === cat && valor(x) == null).length;
  const mwmedio = tx("MWmédio", "MWavg");

  if (estado !== "pronto") {
    return (
      <div className="space-y-2 border-t border-linha pt-4">
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            <>
              O preço de cada venda (empreendimento vencedor em um leilão), ao longo do tempo, em reais da época ou de {ipcaAte}. O arquivo tem cerca de 250 KB
              e só é baixado quando você pede.
            </>,
            <>
              The price of each sale (a winning project in an auction), over time, in reais of the time or of {ipcaAte}. The file is about 250 KB and is only
              downloaded when you ask for it.
            </>,
          )}
        </p>
        <button type="button" onClick={carregar} disabled={estado === "carregando"} className="min-h-[44px] border border-energia bg-superficie px-4 text-sm text-energia-dark hover:bg-energia-fundo">
          {estado === "carregando"
            ? tx("Carregando…", "Loading…")
            : estado === "erro"
              ? tx("Falhou; tentar de novo", "Failed; try again")
              : tx("Ver o preço de cada empreendimento", "See the price of each project")}
        </button>
      </div>
    );
  }

  const W = largura;
  const H = 340;
  const M = { e: 56, d: 12, t: 14, b: 34 };
  const xs = todos.map((x) => frac(x.data));
  const ys = todos.map((x) => valor(x)!);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const ymax = Math.ceil(Math.max(...ys) / 100) * 100;
  const sx = (v: number) => M.e + ((v - x0) / (x1 - x0)) * (W - M.e - M.d);
  const sy = (v: number) => M.t + (1 - v / ymax) * (H - M.t - M.b);
  const passoAno = W < 520 ? 5 : 2;
  const anos = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).filter((a) => a % passoAno === 0);
  const ticksY = Array.from({ length: Math.floor(ymax / 100) + 1 }, (_, i) => i * 100).filter((v, _, arr) => arr.length <= 8 || v % 200 === 0);
  const sel = ativo != null ? daCat[ativo] : null;
  const cor = COR_CATEGORIA_LEILAO[cat];
  const teclado = (e: React.KeyboardEvent) => {
    if (!daCat.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") setAtivo((a) => (a == null ? 0 : Math.min(daCat.length - 1, a + 1)));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setAtivo((a) => (a == null ? 0 : Math.max(0, a - 1)));
    else if (e.key === "Home") setAtivo(0);
    else if (e.key === "End") setAtivo(daCat.length - 1);
    else if (e.key === "Escape") setAtivo(null);
    else return;
    e.preventDefault();
  };
  const ponteiro = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    let melhor = -1;
    let dmin = 22 * 22;
    daCat.forEach((x, i) => {
      const d = (sx(frac(x.data)) - px) ** 2 + (sy(valor(x)!) - py) ** 2;
      if (d < dmin) {
        dmin = d;
        melhor = i;
      }
    });
    setAtivo(melhor >= 0 ? melhor : null);
  };
  const destaque = tx(CURTO_CATEGORIA[cat].toLowerCase(), CURTO_CATEGORIA[cat].toLocaleLowerCase("en-US"));
  const situacao = sel ? (CURTO_SITUACAO[sel.sit as keyof typeof CURTO_SITUACAO] ?? sel.sit) : "";

  return (
    <div ref={ref} className="space-y-3 border-t border-linha pt-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <TransicaoOpcoes
          rotulo={tx("Fonte em destaque", "Highlighted source")}
          nome={`${uid}-cat`}
          opcoes={categorias.map((c) => [c.id, CURTO_CATEGORIA[c.id]] as const)}
          valor={cat}
          onMudar={(v) => {
            setCat(v);
            setAtivo(null);
          }}
        />
        <TransicaoOpcoes
          rotulo={tx("Reais", "Reais")}
          nome={`${uid}-real`}
          opcoes={
            [
              ["real", tx(`de ${ipcaAte}`, `of ${ipcaAte}`)],
              ["nominal", tx("da época", "of the time")],
            ] as const
          }
          valor={real}
          onMudar={setReal}
        />
      </div>
      <p className="text-sm font-medium text-carvao">
        {tx(
          `Preço de venda por empreendimento, ${destaque} em destaque, em R$/MWh ${real === "real" ? `de ${ipcaAte}` : "da data de cada leilão"}`,
          `Sale price per project, ${destaque} highlighted, in R$/MWh ${real === "real" ? `of ${ipcaAte}` : "as of each auction date"}`,
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-energia"
        tabIndex={0}
        role="img"
        aria-label={tx(
          `Dispersão do preço de ${daCat.length} vendas de ${CURTO_CATEGORIA[cat]}; use as setas para percorrer em ordem de data.`,
          `Scatter of the price of ${daCat.length} ${CURTO_CATEGORIA[cat]} ${daCat.length === 1 ? "sale" : "sales"}; use the arrow keys to go through them in date order.`,
        )}
        onKeyDown={teclado}
        onPointerMove={ponteiro}
        onPointerDown={ponteiro}
        onPointerLeave={() => setAtivo(null)}
      >
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={M.e} x2={W - M.d} y1={sy(v)} y2={sy(v)} stroke="var(--cor-grade)" />
            <text x={M.e - 6} y={sy(v) + 4} textAnchor="end" fontSize="12" fill="var(--cor-carvao-muted)">
              {n(v, 0)}
            </text>
          </g>
        ))}
        {anos.map((a) => (
          <text key={a} x={sx(a)} y={H - 12} textAnchor="middle" fontSize="12" fill="var(--cor-carvao-muted)">
            {a}
          </text>
        ))}
        {todos.filter((x) => x.cat !== cat).map((x) => (
          <circle key={x.i} cx={sx(frac(x.data))} cy={sy(valor(x)!)} r={2} fill="var(--cor-mineral-soft)" opacity={0.6} />
        ))}
        {daCat.map((x, i) => (
          <circle key={x.i} cx={sx(frac(x.data))} cy={sy(valor(x)!)} r={i === ativo ? 6 : 3.5} fill={cor} stroke={i === ativo ? "var(--cor-carvao)" : "var(--cor-superficie)"} strokeWidth={i === ativo ? 2 : 0.8} />
        ))}
        <text x={M.e} y={M.t - 2} fontSize="12" fill="var(--cor-carvao-muted)">
          R$/MWh
        </text>
      </svg>
      <div aria-live="polite" className="min-h-[3rem] text-sm text-carvao">
        {sel ? (
          tx(
            <p>
              <span className="font-medium">{sel.nome}</span> ({sel.uf ?? "UF sem dado"}), leilão nº {numeroAneel(sel.leilao)} de {dataBR(sel.data)}: R$ {n(sel.p)}/MWh da época,
              R$ {n(sel.pr)}/MWh de {ipcaAte}; teto R$ {n(sel.teto)}/MWh, deságio {n(sel.des)}%; {n(sel.e, 1)} MWmédio; no SIGA: {situacao}. Vencedora publicada: {sel.venc ?? "sem nome"}.
            </p>,
            <p>
              <span className="font-medium">
                <Nome>{sel.nome}</Nome>
              </span>{" "}
              ({sel.uf ?? "state: no data"}), auction No. {numeroAneel(sel.leilao)} on {dataBR(sel.data)}: R$ {n(sel.p)}/MWh at the time, R$ {n(sel.pr)}/MWh of {ipcaAte};
              ceiling R$ {n(sel.teto)}/MWh, discount {n(sel.des)}%; {n(sel.e, 1)} MWavg; in SIGA: {situacao}. Published winner: {sel.venc ? <Nome>{sel.venc}</Nome> : "unnamed"}.
            </p>,
          )
        ) : (
          <p className="text-carvao-muted">
            {tx(
              `${daCat.length} vendas com preço${semPreco ? `; ${semPreco} sem preço publicado ficam fora` : ""}. Toque ou passe o ponteiro sobre um ponto, ou use as setas.`,
              `${daCat.length} ${daCat.length === 1 ? "sale" : "sales"} with a price${semPreco ? `; ${semPreco} without a published price are left out` : ""}. Tap or hover over a point, or use the arrow keys.`,
            )}
          </p>
        )}
      </div>
      <details>
        <summary className="min-h-[44px] cursor-pointer text-sm text-carvao-muted underline underline-offset-4">
          {tx(`Tabela dos ${daCat.length} pontos em destaque`, `Table of the ${daCat.length} highlighted points`)}
        </summary>
        <div className="tabela-scroll mt-2 max-h-[28rem] overflow-y-auto" tabIndex={0} role="region" aria-label={tx("Pontos da dispersão (tabela rolável)", "Scatter points (scrollable table)")}>
          <table className="w-full min-w-[40rem] border-collapse text-xs tabular-nums">
            <thead>
              <tr>
                {[
                  tx("Data", "Date"),
                  tx("Leilão", "Auction"),
                  tx("Empreendimento", "Project"),
                  tx("UF", "State"),
                  mwmedio,
                  tx("R$/MWh da época", "R$/MWh at the time"),
                  tx(`R$/MWh de ${ipcaAte}`, `R$/MWh of ${ipcaAte}`),
                  tx("Deságio (%)", "Discount (%)"),
                ].map((c) => (
                  <th key={c} scope="col" className="sticky top-0 border-b border-linha bg-papel px-2 py-1.5 text-left font-medium text-mineral">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daCat.map((x) => (
                <tr key={x.i} className="border-b border-linha">
                  <td className="px-2 py-1">{dataBR(x.data)}</td>
                  <td className="px-2 py-1">{numeroAneel(x.leilao)}</td>
                  <td className="px-2 py-1">
                    <Nome>{x.nome}</Nome>
                  </td>
                  <td className="px-2 py-1">{x.uf ?? tx("sem dado", "no data")}</td>
                  <td className="px-2 py-1 text-right">{n(x.e, 1)}</td>
                  <td className="px-2 py-1 text-right">{n(x.p)}</td>
                  <td className="px-2 py-1 text-right">{n(x.pr)}</td>
                  <td className="px-2 py-1 text-right">{n(x.des)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
