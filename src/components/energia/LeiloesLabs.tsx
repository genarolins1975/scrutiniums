"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import {
  COR_ENTRADA,
  PARAMETROS_LEILAO_INICIAIS,
  ROTULO_ENTRADA,
  leilaoDescendente,
  linhaProduto,
  type ParametrosLeilao,
} from "@/lib/energia/leiloes";
import type { IdEntrada } from "@/lib/energia/tipos-leiloes";

/**
 * Peças interativas da página de leilões do ACR. A linha do tempo dos produtos usa números da gold (passados pela página); o
 * laboratório do leilão é um modelo didático com grandezas escolhidas pela pessoa e diz o que deixa de fora.
 *
 * Controles nativos (rádios e deslizantes) com rótulo visível, valor escrito e alvo de 44 px; resultado anunciado por região viva.
 */

const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");

function Moldura({ id, titulo, rotuloModelo, children }: { id: string; titulo: string; rotuloModelo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="space-y-4 border border-linha bg-papel p-4 sm:p-5" data-laboratorio={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id={`${id}-t`} className="font-serif text-lg text-carvao">
          {titulo}
        </h4>
        <span className="rotulo border border-dashed border-mineral px-2 py-0.5 text-xs text-carvao-muted">{rotuloModelo}</span>
      </div>
      {children}
    </section>
  );
}

function Controle({ rotulo, valor, min, max, passo = 1, unidade, onMudar, ajuda }: {
  rotulo: string; valor: number; min: number; max: number; passo?: number; unidade: string; onMudar: (v: number) => void; ajuda?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm text-carvao">
        <span>{rotulo}</span>
        <span className="tabular-nums font-medium">
          {n(valor)} {unidade}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={`${n(valor)} ${unidade}`}
        onChange={(e) => onMudar(Number(e.target.value))}
        className="block min-h-[44px] w-full accent-energia"
      />
      {ajuda && <p className="text-xs leading-relaxed text-carvao-muted">{ajuda}</p>}
    </div>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false }: { rotulo: string; valor: ReactNode; nota?: ReactNode; destaque?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${destaque ? "border-energia bg-energia-fundo" : "border-linha bg-superficie"}`}>
      <p className="text-xs text-carvao-muted">{rotulo}</p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-carvao">{valor}</p>
      {nota && <p className="mt-0.5 text-xs leading-relaxed text-carvao-muted">{nota}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ produtos A-x */

export type ProdutoNaBase = {
  id: string;
  rotulo: string;
  antecedencia: number | null;
  leiloes: number;
  energiaMwmed: number;
  exemplo: { nome: string; data: string; ano: number } | null;
  /** Usinas em operação contratadas nesse tipo, pela posição da entrada em operação diante do ano A (MWmédio). */
  entrada: Record<IdEntrada, number> | null;
};

const ORDEM_ENTRADA: IdEntrada[] = ["ate_ano_a", "depois_ano_a", "antes_do_leilao", "sem_data"];

export function LinhaDosProdutos({ produtos, dataSiga }: { produtos: ProdutoNaBase[]; dataSiga: string }) {
  const [sel, setSel] = useState(produtos.find((p) => p.id === "A-5")?.id ?? produtos[0]?.id ?? "");
  const p = produtos.find((x) => x.id === sel);
  if (!p) return null;
  const ano = p.exemplo?.ano ?? 2020;
  const linha = linhaProduto(p.id, ano);
  const totalEntrada = p.entrada ? ORDEM_ENTRADA.reduce((s, k) => s + p.entrada![k], 0) : 0;
  return (
    <Moldura id="lab-produtos" titulo="Do leilão ao início do suprimento" rotuloModelo="Calendário do produto e dados da base">
      <TransicaoOpcoes rotulo="Produto" nome="leiloes-produto" opcoes={produtos.map((x) => [x.id, x.id] as const)} valor={sel} onMudar={setSel} />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" aria-live="polite">
        <span className="font-medium text-carvao">{p.rotulo}.</span>{" "}
        {p.antecedencia != null
          ? `No produto ${p.id}, o leilão acontece ${p.antecedencia} anos antes do ano A, em que começa a entrega da energia contratada. Nesse intervalo a usina é licenciada, financiada e construída.`
          : p.id === "LER"
            ? "Energia de reserva: contratada para aumentar a segurança do suprimento, com contrato celebrado com a CCEE e custo rateado entre os consumidores por encargo. O início do suprimento é fixado no edital e não está no arquivo."
            : p.id === "FA"
              ? "Fontes alternativas (eólica, biomassa e pequenas hidrelétricas): leilão próprio, com início do suprimento fixado no edital, que não está no arquivo."
              : "Projeto estruturante: hidrelétrica de grande porte licitada individualmente, com prazo de entrega fixado no edital, que não está no arquivo."}{" "}
        Na base: {n(p.leiloes)} {p.leiloes === 1 ? "leilão" : "leilões"} e {n(p.energiaMwmed, 1)} MWmédio contratados.
      </p>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`Calendário do produto ${p.id}`}>
        <ol className="flex min-w-[36rem] gap-1" aria-label="Anos, do leilão ao início do suprimento">
          {linha.anos.map((a) => {
            const ehLeilao = a === linha.anoLeilao;
            const ehA = a === linha.anoA;
            const obra = linha.anoA != null ? a > linha.anoLeilao && a < linha.anoA : false;
            return (
              <li
                key={a}
                className={`flex min-h-[64px] flex-1 flex-col justify-between border px-1.5 py-1 text-xs ${
                  ehA ? "border-energia bg-energia-fundo" : ehLeilao ? "border-carvao bg-superficie" : obra ? "border-linha bg-superficie" : "border-dashed border-linha"
                }`}
              >
                <span className="tabular-nums text-carvao">{a}</span>
                <span className="leading-tight text-carvao-muted">
                  {ehLeilao ? "Leilão" : ehA ? "Ano A: começa a entrega" : obra ? "Implantação" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {p.exemplo && (
        <p className="text-xs text-carvao-muted">
          Exemplo: {p.exemplo.nome}, em {p.exemplo.data}
          {linha.anoA != null ? `, com ano A em ${linha.anoA}` : ""}.
        </p>
      )}
      {p.entrada && totalEntrada > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-carvao">
            Usinas contratadas em {p.id} que estavam em operação no SIGA em {dataSiga}: quando entraram em operação, diante do ano A (energia
            contratada, {n(totalEntrada, 1)} MWmédio).
          </p>
          <div className="flex h-6 w-full overflow-hidden border border-linha" role="img" aria-label={ORDEM_ENTRADA.map((k) => `${ROTULO_ENTRADA[k]}: ${n((100 * p.entrada![k]) / totalEntrada, 1)}%`).join("; ")}>
            {ORDEM_ENTRADA.map((k) =>
              p.entrada![k] > 0 ? <span key={k} style={{ width: `${(100 * p.entrada![k]) / totalEntrada}%`, background: COR_ENTRADA[k] }} /> : null,
            )}
          </div>
          <ul className="grid gap-1 text-xs text-carvao-muted sm:grid-cols-2">
            {ORDEM_ENTRADA.filter((k) => p.entrada![k] > 0).map((k) => (
              <li key={k} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-[0.3em] inline-block h-2.5 w-2.5 shrink-0" style={{ background: COR_ENTRADA[k] }} />
                <span>
                  {ROTULO_ENTRADA[k]}: {n(p.entrada![k], 1)} MWmédio ({n((100 * p.entrada![k]) / totalEntrada, 1)}%)
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-carvao-muted">
            A data do SIGA é a da usina inteira; prazos alterados por ato da ANEEL e excludentes de responsabilidade não estão no arquivo. Entrar
            depois do ano A não prova descumprimento.
          </p>
        </div>
      )}
    </Moldura>
  );
}

/* ------------------------------------------------------------------ laboratório do leilão */

const CENARIOS: { id: string; rotulo: string; p: Partial<ParametrosLeilao> }[] = [
  { id: "base", rotulo: "Ponto de partida", p: {} },
  { id: "poucos", rotulo: "Poucos concorrentes", p: { proponentes: 6 } },
  { id: "muitos", rotulo: "Muitos concorrentes", p: { proponentes: 25 } },
  { id: "teto-baixo", rotulo: "Teto abaixo do custo de muitos", p: { teto: 260 } },
];

export function LabLeilao() {
  const [p, setP] = useState<ParametrosLeilao>(PARAMETROS_LEILAO_INICIAIS);
  const [cenario, setCenario] = useState("base");
  const r = useMemo(() => leilaoDescendente(p), [p]);
  // a figura é desenhada na largura real (texto de 11 px legível no celular), medida depois da primeira pintura
  const [largura, setLargura] = useState(640);
  const refFig = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = refFig.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const muda = (k: keyof ParametrosLeilao) => (v: number) => {
    setCenario("");
    setP((x) => ({ ...x, [k]: v, ...(k === "custoMin" && v > x.custoMax ? { custoMax: v } : {}), ...(k === "custoMax" && v < x.custoMin ? { custoMin: v } : {}) }));
  };
  const escolhe = (id: string) => {
    setCenario(id);
    setP({ ...PARAMETROS_LEILAO_INICIAIS, ...(CENARIOS.find((c) => c.id === id)?.p ?? {}) });
  };
  // figura: custos dos proponentes (barras) com o teto e o preço de fechamento
  const W = largura;
  const H = 220;
  const M = { e: 44, d: 12, t: 12, b: 28 };
  const max = Math.max(p.teto, p.custoMax) * 1.05;
  const y = (v: number) => M.t + (1 - v / max) * (H - M.t - M.b);
  const bw = (W - M.e - M.d) / r.custos.length;
  const vence = new Set(r.custos.map((c, i) => ({ c, i })).filter(({ c }) => r.preco != null && c <= r.preco + 1e-9).slice(0, r.vencedores).map(({ i }) => i));
  const marcas = [0, 100, 200, 300, 400, 500, 600].filter((v) => v <= max);
  return (
    <Moldura id="lab-leilao" titulo="Como o preço cai num leilão de preço descendente" rotuloModelo="Modelo didático">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Cada barra é um proponente com um lote de energia e um custo próprio. O leilão começa no preço teto e baixa o preço a cada rodada; quem
        não cobre o custo sai. Ele para quando a energia oferecida cabe na demanda das distribuidoras. Mexa na concorrência e no teto e veja o
        deságio mudar.
      </p>
      <TransicaoOpcoes rotulo="Cenário" nome="lab-leilao-cenario" opcoes={CENARIOS.map((c) => [c.id, c.rotulo] as const)} valor={cenario} onMudar={escolhe} />
      <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Controle rotulo="Preço teto" valor={p.teto} min={150} max={600} passo={10} unidade="R$/MWh" onMudar={muda("teto")} />
          <Controle rotulo="Demanda das distribuidoras" valor={p.demanda} min={100} max={2000} passo={100} unidade="MWmédio" onMudar={muda("demanda")} />
          <Controle rotulo="Proponentes" valor={p.proponentes} min={1} max={30} unidade="" onMudar={muda("proponentes")} ajuda="Cada um oferece um lote de 100 MWmédio." />
          <Controle rotulo="Menor custo entre eles" valor={p.custoMin} min={50} max={500} passo={10} unidade="R$/MWh" onMudar={muda("custoMin")} />
          <Controle rotulo="Maior custo entre eles" valor={p.custoMax} min={50} max={600} passo={10} unidade="R$/MWh" onMudar={muda("custoMax")} />
        </div>
        <div ref={refFig} className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
            <Cartao destaque rotulo="Preço de fechamento" valor={r.preco == null ? "sem venda" : `R$ ${n(r.preco)}/MWh`} />
            <Cartao rotulo="Deságio sobre o teto" valor={r.desagioPct == null ? "sem venda" : `${n(r.desagioPct, 1)}%`} />
            <Cartao rotulo="Energia contratada" valor={`${n(r.contratada)} MWmédio`} nota={r.faltou > 0 ? `faltaram ${n(r.faltou)} MWmédio` : "demanda atendida"} />
            <Cartao rotulo="Rodadas" valor={n(r.rodadas.length)} nota={r.margemMedia == null ? undefined : `margem média dos vencedores: R$ ${n(r.margemMedia)}/MWh`} />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`Custos de ${r.custos.length} proponentes, teto de R$ ${n(p.teto)}/MWh e preço de fechamento ${r.preco == null ? "inexistente" : `de R$ ${n(r.preco)}/MWh`}.`}>
            {marcas.map((v) => (
              <g key={v}>
                <line x1={M.e} x2={W - M.d} y1={y(v)} y2={y(v)} stroke="var(--cor-grade)" />
                <text x={M.e - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-carvao-muted)">
                  {n(v)}
                </text>
              </g>
            ))}
            {r.custos.map((c, i) => (
              <rect
                key={i}
                x={M.e + i * bw + bw * 0.15}
                width={bw * 0.7}
                y={y(c)}
                height={Math.max(1, y(0) - y(c))}
                fill={vence.has(i) ? "var(--cor-energia)" : "var(--cor-mineral-soft)"}
              />
            ))}
            <line x1={M.e} x2={W - M.d} y1={y(p.teto)} y2={y(p.teto)} stroke="var(--cor-carvao)" strokeDasharray="6 4" />
            <text x={W - M.d} y={y(p.teto) - 4} textAnchor="end" fontSize="11" fill="var(--cor-carvao)">
              Teto
            </text>
            {r.preco != null && (
              <>
                <line x1={M.e} x2={W - M.d} y1={y(r.preco)} y2={y(r.preco)} stroke="var(--cor-energia-dark)" strokeWidth="2" />
                <text x={M.e + 4} y={y(r.preco) - 4} fontSize="11" fill="var(--cor-energia-dark)">
                  Preço de fechamento
                </text>
              </>
            )}
            <text x={M.e} y={H - 8} fontSize="11" fill="var(--cor-carvao-muted)">
              {W < 420 ? "Proponentes, do menor ao maior custo" : "Proponentes, do menor ao maior custo (R$/MWh)"}
            </text>
          </svg>
          <p className="text-xs text-carvao-muted">
            <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 align-middle" style={{ background: "var(--cor-energia)" }} />
            vence ·
            <span aria-hidden="true" className="mx-1 inline-block h-2.5 w-2.5 align-middle" style={{ background: "var(--cor-mineral-soft)" }} />
            fica de fora
          </p>
          <details className="text-sm">
            <summary className="min-h-[44px] cursor-pointer text-carvao-muted underline underline-offset-4">Rodadas, uma a uma</summary>
            <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label="Rodadas do leilão (tabela rolável)">
              <table className="w-full min-w-[24rem] border-collapse text-xs tabular-nums">
                <thead>
                  <tr>
                    {["Rodada", "Preço (R$/MWh)", "Proponentes", "Oferta (MWmédio)"].map((c) => (
                      <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rodadas.map((x) => (
                    <tr key={x.rodada} className="border-b border-linha">
                      <td className="px-2 py-1">{x.rodada}</td>
                      <td className="px-2 py-1">{n(x.preco)}</td>
                      <td className="px-2 py-1">{x.proponentes}</td>
                      <td className="px-2 py-1">{n(x.oferta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        O que o modelo deixa de fora: os leilões reais têm produtos separados por fonte e prazo, fase discriminatória (cada vencedor recebe o
        próprio lance), sobra de oferta, margem de escoamento na rede, garantias, custo de capital e lances que não seguem o custo. O deságio
        real depende também do teto fixado em cada edital; aqui o modelo só mostra o mecanismo.
      </p>
    </Moldura>
  );
}
