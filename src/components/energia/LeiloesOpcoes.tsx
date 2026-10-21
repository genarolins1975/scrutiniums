"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { quebrasFixas } from "@/lib/energia/escalas";
import { codigoUf, siglaDoCodigo } from "@/lib/energia/expansao";
import { formatos } from "@/lib/energia/formato";
import { URL_GEO } from "@/lib/energia/geo";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Uma visão por vez, com a escolha acima: a página monta as visões no servidor e o navegador mostra só a escolhida (o HTML inicial
 * leva uma figura, não todas).
 */
export function LeiloesAlternar({ rotulo, nome, opcoes, conteudo }: { rotulo: string; nome: string; opcoes: readonly (readonly [string, string])[]; conteudo: Record<string, ReactNode> }) {
  const [valor, setValor] = useState(opcoes[0]?.[0] ?? "");
  return (
    <div className="space-y-3" data-alternar={nome}>
      <TransicaoOpcoes rotulo={rotulo} nome={nome} opcoes={opcoes} valor={valor} onMudar={setValor} />
      {conteudo[valor]}
    </div>
  );
}

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/** Energia contratada por UF principal do empreendimento, com a UF escolhida descrita ao lado. */
export function LeiloesMapaUf({
  ufs,
  periodo,
}: {
  ufs: { uf: string; energia: number; empreendimentos: number; preco: number | null; fontes: string }[];
  periodo: string;
}) {
  const tx = useTx();
  const f = formatos(useIdioma());
  const [sel, setSel] = useState<string | null>(null);
  const valores = useMemo(() => {
    const v: Record<string, number | null> = {};
    for (const u of ufs) {
      const c = codigoUf(u.uf);
      if (c) v[c] = u.energia;
    }
    return v;
  }, [ufs]);
  const classes = useMemo(() => quebrasFixas([250, 1000, 2500, 5000], Object.values(valores), { casas: 0 }), [valores]);
  const u = ufs.find((x) => x.uf === sel);
  const fmt = (v: number, c = 1) => f.num(v, c);
  const mwmedio = tx("MWmédio", "MWavg");
  return (
    <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
      <MapaCoropletico
        titulo={tx(`Energia contratada nos leilões do ACR por UF principal do empreendimento, ${periodo}`, `Energy contracted in ACR auctions by the project's main state, ${periodo}`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={mwmedio}
        casas={1}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={sel ? codigoUf(sel) : null}
        onSelecionar={(id) => setSel(id ? siglaDoCodigo(id) : null)}
        rotulos
        periodo={periodo}
        nota={tx(
          "UF principal informada pela ANEEL: usina em mais de uma UF conta inteira numa só. UF sem empreendimento contratado aparece hachurada (sem dado), não como zero.",
          "Main state reported by ANEEL: a plant in more than one state counts in full in just one. A state with no project contracted appears hatched (no data), not as zero.",
        )}
      />
      <aside aria-label={tx("UF selecionada", "Selected state")} aria-live="polite" className="min-w-0 border-t border-linha pt-4 text-sm lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        {u ? (
          <dl className="space-y-2">
            <dt className="rotulo text-mineral">{u.uf}</dt>
            <dd className="font-serif text-2xl text-carvao">
              {fmt(u.energia)} {mwmedio}
            </dd>
            <dd className="text-carvao-muted">
              {u.empreendimentos} {tx("vendas", u.empreendimentos === 1 ? "sale" : "sales")}
            </dd>
            <dd className="text-carvao-muted">
              {tx("Preço médio da época", "Average price at the time")}: {u.preco == null ? tx("sem dado", "no data") : `R$ ${fmt(u.preco, 2)}/MWh`}
            </dd>
            <dd className="text-carvao-muted">
              {tx("Por fonte", "By source")}: {u.fontes}
            </dd>
          </dl>
        ) : (
          <p className="text-carvao-muted">{tx("Escolha uma UF no mapa ou na busca para ver o que foi contratado nela.", "Choose a state on the map or in the search to see what was contracted there.")}</p>
        )}
      </aside>
    </div>
  );
}

export type PontoPrecoAno = { ano: string; categoria: string; preco: number | null; precoReal: number | null; teto: number | null; energia: number; leiloes: number };

/**
 * Preço médio por fonte e ano do leilão. Leilões não acontecem todo ano nem para toda fonte: cada ano com venda da fonte é um
 * ponto, e o traço pontilhado só liga anos com venda (ano sem venda não tem ponto e não é zero). Escolha das fontes e de reais
 * da época ou corrigidos pelo IPCA; tabela equivalente com o teto médio.
 */
export function LeiloesPrecoAno({
  anos,
  categorias,
  pontos,
  ipcaAte,
  iniciais,
}: {
  anos: string[];
  categorias: { id: string; rotulo: string; cor: string }[];
  pontos: PontoPrecoAno[];
  ipcaAte: string;
  iniciais: string[];
}) {
  const tx = useTx();
  const f = formatos(useIdioma());
  const [ativas, setAtivas] = useState<string[]>(iniciais);
  const [real, setReal] = useState<"real" | "nominal">("real");
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [largura, setLargura] = useState(760);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const v = (p: PontoPrecoAno) => (real === "real" ? p.precoReal : p.preco);
  const vis = pontos.filter((p) => ativas.includes(p.categoria) && v(p) != null);
  const ymax = Math.max(100, Math.ceil(Math.max(0, ...vis.map((p) => v(p)!)) / 100) * 100);
  const W = largura;
  const H = 320;
  const M = { e: 52, d: largura < 520 ? 12 : 96, t: 16, b: 30 };
  const sx = (ano: string) => M.e + ((anos.indexOf(ano) + 0.5) / anos.length) * (W - M.e - M.d);
  const sy = (x: number) => M.t + (1 - x / ymax) * (H - M.t - M.b);
  const passo = W < 520 ? 4 : 2;
  const fmt = (x: number | null, c = 2) => (x == null ? tx("sem dado", "no data") : f.num(x, c));
  const mwmedio = tx("MWmédio", "MWavg");
  // rótulos diretos no fim de cada série, afastados quando ficariam sobrepostos (mínimo de 13 px entre eles)
  const finais = categorias
    .filter((c) => ativas.includes(c.id))
    .map((c) => {
      const ps = vis.filter((p) => p.categoria === c.id).sort((a, b) => (a.ano < b.ano ? -1 : 1));
      const u = ps[ps.length - 1];
      return u ? { id: c.id, rotulo: c.rotulo, x: sx(u.ano), y: sy(v(u)!) } : null;
    })
    .filter((x): x is { id: string; rotulo: string; x: number; y: number } => !!x)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < finais.length; i++) {
    const a = finais[i - 1];
    const b = finais[i];
    if (Math.abs(a.x - b.x) < 70 && b.y - a.y < 13) b.y = a.y + 13;
  }
  const yRotulo = Object.fromEntries(finais.map((f) => [f.id, f.y]));
  const alterna = (id: string) => setAtivas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const unidade = real === "real" ? tx(`R$/MWh de ${ipcaAte}`, `R$/MWh of ${ipcaAte}`) : tx("R$/MWh da data de cada leilão", "R$/MWh as of each auction date");
  return (
    <div ref={ref} className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="rotulo mb-1 text-mineral">{tx("Fontes", "Sources")}</legend>
        {categorias.map((c) => (
          <label
            key={c.id}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${ativas.includes(c.id) ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
          >
            <input type="checkbox" checked={ativas.includes(c.id)} onChange={() => alterna(c.id)} className="accent-energia" />
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: c.cor }} />
            {c.rotulo}
          </label>
        ))}
      </fieldset>
      <TransicaoOpcoes
        rotulo={tx("Reais", "Reais")}
        nome="leiloes-preco-real"
        opcoes={
          [
            ["real", tx(`de ${ipcaAte} (IPCA)`, `of ${ipcaAte} (IPCA)`)],
            ["nominal", tx("da época", "of the time")],
          ] as const
        }
        valor={real}
        onMudar={setReal}
      />
      <p className="text-sm font-medium text-carvao">
        {tx(`Preço médio de venda por fonte e ano do leilão, ponderado pela energia (${unidade})`, `Average sale price by source and auction year, weighted by energy (${unidade})`)}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full"
        role="img"
        aria-label={tx(`Preço médio por fonte e ano, em ${unidade}; os valores estão na tabela abaixo.`, `Average price by source and year, in ${unidade}; the values are in the table below.`)}
      >
        {Array.from({ length: ymax / 100 + 1 }, (_, i) => i * 100)
          .filter((t, _, arr) => arr.length <= 8 || t % 200 === 0)
          .map((t) => (
            <g key={t}>
              <line x1={M.e} x2={W - M.d} y1={sy(t)} y2={sy(t)} stroke="var(--cor-grade)" />
              <text x={M.e - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--cor-carvao-muted)">
                {f.num(t, 0)}
              </text>
            </g>
          ))}
        {anos.map((a, i) =>
          i % passo === 0 ? (
            <text key={a} x={sx(a)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--cor-carvao-muted)">
              {a}
            </text>
          ) : null,
        )}
        {categorias
          .filter((c) => ativas.includes(c.id))
          .map((c) => {
            const ps = vis.filter((p) => p.categoria === c.id).sort((a, b) => (a.ano < b.ano ? -1 : 1));
            if (!ps.length) return null;
            const d = ps.map((p, i) => `${i ? "L" : "M"}${sx(p.ano).toFixed(1)},${sy(v(p)!).toFixed(1)}`).join("");
            const u = ps[ps.length - 1];
            return (
              <g key={c.id}>
                <path d={d} fill="none" stroke={c.cor} strokeWidth="1.5" strokeDasharray="2 4" />
                {ps.map((p) => (
                  <circle key={p.ano} cx={sx(p.ano)} cy={sy(v(p)!)} r="4.5" fill={c.cor} stroke="var(--cor-superficie)" strokeWidth="1.5">
                    <title>{`${c.rotulo}, ${p.ano}: R$ ${fmt(v(p))}/MWh (${fmt(p.energia, 1)} ${mwmedio})`}</title>
                  </circle>
                ))}
                {largura >= 520 && (
                  <text x={sx(u.ano) + 8} y={(yRotulo[c.id] ?? sy(v(u)!)) + 4} fontSize="11" fill="var(--cor-carvao)">
                    {c.rotulo}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
      <p className="text-xs text-carvao-muted">
        {tx(
          "Cada ponto é um ano com venda da fonte; o pontilhado só liga esses anos e não indica valor nos anos sem venda.",
          "Each point is a year with sales of the source; the dotted line only connects those years and does not indicate a value in years without sales.",
        )}
      </p>
      <details onToggle={(e) => setTabelaAberta((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="min-h-[44px] cursor-pointer text-sm text-carvao-muted underline underline-offset-4">{tx("Tabela equivalente", "Equivalent table")}</summary>
        {/* montada só ao abrir: as linhas já estão na tabela de download e não pesam no HTML inicial */}
        {tabelaAberta && (
          <div className="tabela-scroll mt-2 max-h-[28rem] overflow-y-auto" tabIndex={0} role="region" aria-label={tx("Preço médio por fonte e ano (tabela rolável)", "Average price by source and year (scrollable table)")}>
            <table className="w-full min-w-[36rem] border-collapse text-xs tabular-nums">
              <thead>
                <tr>
                  {[
                    tx("Ano", "Year"),
                    tx("Fonte", "Source"),
                    tx("Leilões", "Auctions"),
                    tx("Energia (MWmédio)", "Energy (MWavg)"),
                    tx("Preço da época (R$/MWh)", "Price at the time (R$/MWh)"),
                    tx(`Preço de ${ipcaAte} (R$/MWh)`, `Price of ${ipcaAte} (R$/MWh)`),
                    tx("Teto médio da época (R$/MWh)", "Average ceiling at the time (R$/MWh)"),
                  ].map((h) => (
                    <th key={h} scope="col" className="sticky top-0 border-b border-linha bg-papel px-2 py-1.5 text-left font-medium text-mineral">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pontos
                  .filter((p) => ativas.includes(p.categoria))
                  .map((p) => (
                    <tr key={`${p.ano}-${p.categoria}`} className="border-b border-linha">
                      <td className="px-2 py-1">{p.ano}</td>
                      <td className="px-2 py-1">{categorias.find((c) => c.id === p.categoria)?.rotulo ?? p.categoria}</td>
                      <td className="px-2 py-1 text-right">{p.leiloes}</td>
                      <td className="px-2 py-1 text-right">{fmt(p.energia, 1)}</td>
                      <td className="px-2 py-1 text-right">{fmt(p.preco)}</td>
                      <td className="px-2 py-1 text-right">{fmt(p.precoReal)}</td>
                      <td className="px-2 py-1 text-right">{fmt(p.teto)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
