import type { GoldEmissoes, Setor } from "@/lib/territorio/emissoes";
import { EXPLICA_SETOR, NOME_SETOR, SETORES, mt } from "@/lib/territorio/emissoes";
import { n } from "@/components/territorio/Queimadas";

/** Cor de cada setor: identidade estável, sem juízo; a tabela repete os valores. */
export const COR_SETOR: Record<Setor, { fill: string; bg: string }> = {
  energia: { fill: "fill-carvao-soft", bg: "bg-carvao-soft" },
  ippu: { fill: "fill-obee-neutro", bg: "bg-obee-neutro" },
  agropecuaria: { fill: "fill-bronze", bg: "bg-bronze" },
  lulucf: { fill: "fill-obee", bg: "bg-obee" },
  residuos: { fill: "fill-gas", bg: "bg-gas" },
};

function LegendaSetores() {
  return (
    <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-carvao-muted">
      {SETORES.map((s) => (
        <span key={s} className="inline-flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 ${COR_SETOR[s].bg}`} />{NOME_SETOR[s]}</span>
      ))}
    </p>
  );
}

/** Emissões líquidas por ano, empilhadas por setor, com 2005 marcado como referência da NDC. */
export function SerieSetores({ g }: Readonly<{ g: GoldEmissoes }>) {
  return (
    <>
      <div className="md:hidden"><Grafico g={g} compacto /></div>
      <div className="hidden md:block"><Grafico g={g} /></div>
      <LegendaSetores />
    </>
  );
}

function Grafico({ g, compacto = false }: Readonly<{ g: GoldEmissoes; compacto?: boolean }>) {
  const max = Math.max(...g.anos.map((a) => a.totalLiquido));
  const L = compacto ? 360 : 960, A = compacto ? 230 : 260, base = compacto ? 196 : 220, topo = 22, larg = L / g.anos.length;
  const y = (v: number) => ((base - topo) * v) / max;
  const ultimo = g.anos[g.anos.length - 1];
  const ref = g.anos.find((a) => a.ano === g.derivados.anoReferenciaNdc)!;
  const passo = compacto ? 8 : 4;
  const fonte = compacto ? "text-xs" : "text-xs";
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Emissões líquidas de gases de efeito estufa por ano, ${g.anoInicial} a ${g.anoFinal}, por setor, em milhões de toneladas de CO2 equivalente. ${ref.ano}: ${n(mt(ref.totalLiquido), 0)}. ${ultimo.ano}: ${n(mt(ultimo.totalLiquido), 0)}. Valores na tabela.`} className="h-auto w-full">
      <line x1="0" x2={L} y1={base} y2={base} className="stroke-linha" strokeWidth="1" />
      {g.anos.map((a, i) => {
        const x = i * larg + larg * 0.12;
        let acumulado = 0;
        const destaque = a.ano === ref.ano || a.ano === ultimo.ano;
        return (
          <g key={a.ano}>
            <title>{`${a.ano}: ${n(mt(a.totalLiquido), 1)} Mt CO2e (${SETORES.map((s) => `${NOME_SETOR[s].toLowerCase()} ${n(mt(a.setores[s]), 1)}`).join("; ")})`}</title>
            {SETORES.map((s) => {
              const h = y(a.setores[s]);
              acumulado += h;
              return <rect key={s} x={x} y={base - acumulado} width={larg * 0.76} height={h} className={COR_SETOR[s].fill} />;
            })}
            {destaque && (
              <text x={a.ano === ultimo.ano ? L : x + larg * 0.38} y={base - y(a.totalLiquido) - 6} textAnchor={a.ano === ultimo.ano ? "end" : "middle"} className={`fill-carvao ${fonte} tabular-nums`}>{n(mt(a.totalLiquido), 0)}</text>
            )}
            {((i % passo === 0 && ultimo.ano - a.ano >= (compacto ? 4 : 2) && (compacto || Math.abs(a.ano - ref.ano) >= 2)) || a.ano === ultimo.ano || (!compacto && a.ano === ref.ano)) && (
              <text x={i === 0 ? x : a.ano === ultimo.ano ? L : x + larg * 0.38} y={base + 18} textAnchor={i === 0 ? "start" : a.ano === ultimo.ano ? "end" : "middle"} className={`${a.ano === ref.ano ? "fill-carvao" : "fill-mineral"} ${fonte}`}>{a.ano}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const th = "border-b border-linha px-3 py-2 text-left font-medium text-carvao";
const td = "border-b border-linha px-3 py-2 text-carvao tabular-nums";

export function TabelaSerieEmissoes({ g }: Readonly<{ g: GoldEmissoes }>) {
  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr>
          <th className={th}>Ano</th>
          <th className={`${th} text-right`}>Total líquido</th>
          <th className={`${th} text-right`}>Sem uso da terra</th>
          {SETORES.map((s) => <th key={s} className={`${th} text-right`}>{NOME_SETOR[s]}</th>)}
        </tr>
      </thead>
      <tbody>
        {g.anos.map((a) => (
          <tr key={a.ano}>
            <td className={td}>{a.ano}</td>
            <td className={`${td} text-right`}>{n(mt(a.totalLiquido), 1)}</td>
            <td className={`${td} text-right`}>{n(mt(a.totalSemLulucf), 1)}</td>
            {SETORES.map((s) => <td key={s} className={`${td} text-right`}>{n(mt(a.setores[s]), 1)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Os cinco setores do inventário: o que cada um mede, quanto pesa no último ano e quanto mudou desde 2005. */
export function CincoSetores({ g }: Readonly<{ g: GoldEmissoes }>) {
  const ultimo = g.anos[g.anos.length - 1];
  const ref = g.anos.find((a) => a.ano === g.derivados.anoReferenciaNdc)!;
  return (
    <section aria-labelledby="setores-titulo" className="border-y border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-12 md:py-14">
        <p className="rotulo text-mineral">Modelo didático</p>
        <h2 id="setores-titulo" className="mt-3 max-w-3xl font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-carvao">De onde vêm as emissões</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          O inventário divide as emissões em cinco setores, pelas regras internacionais do IPCC. Uso da terra e florestas é um saldo: soma o que
          se emite ao desmatar e desconta o que a vegetação retira da atmosfera. A barra mostra o peso de cada setor no total líquido de {ultimo.ano}.
        </p>
        <div aria-hidden="true" className="mt-8 flex h-6 w-full overflow-hidden">
          {SETORES.map((s) => <span key={s} className={COR_SETOR[s].bg} style={{ width: `${g.derivados.participacaoUltimoAnoPct[s]}%` }} />)}
        </div>
        <ol className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
          {SETORES.map((s) => {
            const v = g.derivados.variacaoDesde2005Pct[s];
            return (
              <li key={s} className="flex flex-col bg-papel p-5">
                <p className="rotulo flex items-center gap-2 text-mineral"><span aria-hidden="true" className={`inline-block h-3 w-3 ${COR_SETOR[s].bg}`} />{NOME_SETOR[s]}</p>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{EXPLICA_SETOR[s]}</p>
                <div className="mt-auto pt-4">
                  <span className="font-label text-[1.4rem] tabular-nums text-carvao">{n(mt(ultimo.setores[s]), 0)}</span>{" "}
                  <span className="text-xs text-carvao-muted">Mt CO2e em {ultimo.ano}</span>
                  <span className="mt-1 block text-xs text-mineral">{n(g.derivados.participacaoUltimoAnoPct[s], 1)}% do total líquido</span>
                  <span className="mt-1 block text-xs text-mineral">{v > 0 ? "+" : "−"}{n(Math.abs(v), 1)}% sobre {ref.ano} ({n(mt(ref.setores[s]), 0)} Mt)</span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-mineral">Os números são do inventário oficial; o modelo só organiza a leitura e não indica qual setor deveria reduzir mais.</p>
      </div>
    </section>
  );
}

/** As maiores categorias do último ano, com as remoções (valores negativos) à parte. */
export function TabelaCategorias({ g }: Readonly<{ g: GoldEmissoes }>) {
  const u = String(g.anoFinal);
  const linhas = g.subsetores.filter((s) => s.valores[u] !== null).map((s) => ({ ...s, v: s.valores[u] as number }));
  const emissoras = linhas.filter((l) => l.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const remocoes = linhas.filter((l) => l.v < 0).sort((a, b) => a.v - b.v);
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        <h3 className="font-serif text-xl leading-snug text-carvao">As dez maiores fontes em {g.anoFinal}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr><th className={th}>Categoria do inventário</th><th className={th}>Setor</th><th className={`${th} text-right`}>Mt CO2e</th></tr></thead>
            <tbody>{emissoras.map((l) => <tr key={l.codigo}><td className={td}>{l.codigo} {l.nome}</td><td className={`${td} text-carvao-muted`}>{NOME_SETOR[l.setor]}</td><td className={`${td} text-right`}>{n(mt(l.v), 1)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="min-w-0 lg:col-span-5">
        <h3 className="font-serif text-xl leading-snug text-carvao">O que foi retirado da atmosfera em {g.anoFinal}</h3>
        <p className="mt-1 text-sm text-carvao-muted">Categorias com saldo negativo: retiram mais do que emitem, segundo as regras do inventário.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead><tr><th className={th}>Categoria</th><th className={`${th} text-right`}>Mt CO2e</th></tr></thead>
            <tbody>{remocoes.map((l) => <tr key={l.codigo}><td className={td}>{l.codigo} {l.nome}</td><td className={`${td} text-right`}>−{n(Math.abs(mt(l.v)), 1)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
