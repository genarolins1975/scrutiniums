import type { GoldDesastres, Grupo } from "@/lib/territorio/desastres";
import { GRUPOS, ROTULO_CURTO, serieReconhecida } from "@/lib/territorio/desastres";
import { NOME_UF } from "@/lib/territorio/queimadas";
import { n } from "@/components/territorio/Queimadas";

/** Cor de cada grupo: identidade estável, sem juízo de gravidade; os rótulos e a tabela repetem a informação. */
export const COR: Record<Grupo, { fill: string; bg: string }> = {
  secas_estiagens: { fill: "fill-bronze", bg: "bg-bronze" },
  chuvas_inundacoes_enxurradas_alagamentos: { fill: "fill-obee", bg: "bg-obee" },
  movimentos_de_massa: { fill: "fill-carvao-soft", bg: "bg-carvao-soft" },
  outros: { fill: "fill-obee-neutro", bg: "bg-obee-neutro" },
};

export function Legenda() {
  return (
    <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-carvao-muted">
      {GRUPOS.map((gr) => (
        <span key={gr} className="inline-flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 ${COR[gr].bg}`} />{ROTULO_CURTO[gr]}</span>
      ))}
    </p>
  );
}

/** Registros reconhecidos por ano, empilhados por grupo de tipologia. */
export function SerieEmpilhada({ g }: Readonly<{ g: GoldDesastres }>) {
  return (
    <>
      <div className="md:hidden"><Grafico g={g} compacto /></div>
      <div className="hidden md:block"><Grafico g={g} /></div>
      <Legenda />
    </>
  );
}

function Grafico({ g, compacto = false }: Readonly<{ g: GoldDesastres; compacto?: boolean }>) {
  const serie = serieReconhecida(g);
  const max = Math.max(...serie.map((a) => a.registros_reconhecidos));
  const L = compacto ? 360 : 960, A = compacto ? 230 : 260, base = compacto ? 196 : 220, topo = 20, larg = L / serie.length;
  const y = (v: number) => ((base - topo) * v) / max;
  const ultimo = serie[serie.length - 1];
  const maior = serie.reduce((a, b) => (b.registros_reconhecidos > a.registros_reconhecidos ? b : a));
  const passo = compacto ? 5 : 2;
  const fonte = compacto ? "text-xs" : "text-xs";
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Registros municipais com reconhecimento federal por ano, ${serie[0].ano} a ${ultimo.ano}, por grupo de tipologia. Maior: ${maior.ano}, ${n(maior.registros_reconhecidos)}. ${ultimo.ano}: ${n(ultimo.registros_reconhecidos)}. Valores na tabela.`} className="h-auto w-full">
      <line x1="0" x2={L} y1={base} y2={base} className="stroke-linha" strokeWidth="1" />
      {serie.map((a, i) => {
        const x = i * larg + larg * 0.15;
        let acumulado = 0;
        return (
          <g key={a.ano}>
            <title>{`${a.ano}: ${n(a.registros_reconhecidos)} registros reconhecidos (${GRUPOS.map((gr) => `${ROTULO_CURTO[gr].toLowerCase()} ${n(a.por_grupo_reconhecidos[gr])}`).join("; ")})`}</title>
            {GRUPOS.map((gr) => {
              const h = y(a.por_grupo_reconhecidos[gr]);
              acumulado += h;
              return <rect key={gr} x={x} y={base - acumulado} width={larg * 0.7} height={h} className={COR[gr].fill} />;
            })}
            {(a.ano === maior.ano || a.ano === ultimo.ano) && (
              <text x={compacto && a.ano === ultimo.ano ? L : x + larg * 0.35} y={base - y(a.registros_reconhecidos) - 6} textAnchor={compacto && a.ano === ultimo.ano ? "end" : "middle"} className={`fill-carvao ${fonte} tabular-nums`}>{n(a.registros_reconhecidos)}</text>
            )}
            {((i % passo === 0 && (!compacto || ultimo.ano - a.ano >= 3)) || a.ano === ultimo.ano) && (
              <text x={compacto && i === 0 ? x : compacto && a.ano === ultimo.ano ? L : x + larg * 0.35} y={base + 18} textAnchor={compacto && i === 0 ? "start" : compacto && a.ano === ultimo.ano ? "end" : "middle"} className={`fill-mineral ${fonte}`}>{a.ano}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const th = "border-b border-linha px-3 py-2 text-left font-medium text-carvao";
const td = "border-b border-linha px-3 py-2 text-carvao tabular-nums";

export function TabelaSerie({ g }: Readonly<{ g: GoldDesastres }>) {
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr>
          <th className={th}>Ano</th>
          <th className={`${th} text-right`}>Reconhecidos</th>
          {GRUPOS.map((gr) => <th key={gr} className={`${th} text-right`}>{ROTULO_CURTO[gr]}</th>)}
          <th className={`${th} text-right`}>Municípios distintos</th>
        </tr>
      </thead>
      <tbody>
        {serieReconhecida(g).map((a) => (
          <tr key={a.ano}>
            <td className={td}>{a.ano}</td>
            <td className={`${td} text-right`}>{n(a.registros_reconhecidos)}</td>
            {GRUPOS.map((gr) => <td key={gr} className={`${td} text-right`}>{n(a.por_grupo_reconhecidos[gr])}</td>)}
            <td className={`${td} text-right`}>{n(a.municipios_distintos_com_reconhecimento)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaUFDesastres({ g }: Readonly<{ g: GoldDesastres }>) {
  const ufs = Object.entries(g.por_uf.ultimo_ano_completo.ufs).sort((a, b) => b[1].registros_reconhecidos - a[1].registros_reconhecidos);
  const max = Math.max(...ufs.map(([, u]) => u.registros_reconhecidos), 1);
  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr>
          <th className={th}>Unidade da Federação</th>
          <th className={`${th} text-right`}>Reconhecidos</th>
          <th className={`${th} text-right`}>Municípios distintos</th>
          {GRUPOS.map((gr) => <th key={gr} className={`${th} text-right`}>{ROTULO_CURTO[gr]}</th>)}
        </tr>
      </thead>
      <tbody>
        {ufs.map(([uf, u]) => (
          <tr key={uf}>
            <td className={td}>{NOME_UF[uf] ?? uf}</td>
            <td className={`${td} text-right`}>
              <span className="inline-flex items-center justify-end gap-2">
                <span aria-hidden="true" className="inline-block h-2 bg-obee" style={{ width: `${Math.max(2, (60 * u.registros_reconhecidos) / max)}px` }} />
                {n(u.registros_reconhecidos)}
              </span>
            </td>
            <td className={`${td} text-right`}>{n(u.municipios_distintos)}</td>
            {GRUPOS.map((gr) => <td key={gr} className={`${td} text-right`}>{n(u.por_grupo[gr])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaDanos({ g }: Readonly<{ g: GoldDesastres }>) {
  const linhas = g.danos_humanos.serie.filter((d) => d.publicavel);
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr>
          <th className={th}>Ano</th>
          <th className={`${th} text-right`}>Óbitos</th>
          <th className={`${th} text-right`}>Desabrigados</th>
          <th className={`${th} text-right`}>Desalojados</th>
          <th className={`${th} text-right`}>Registros sem nenhum dano humano informado</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((d) => (
          <tr key={d.ano}>
            <td className={td}>{d.ano}</td>
            <td className={`${td} text-right`}>{n(d.obitos)}</td>
            <td className={`${td} text-right`}>{n(d.desabrigados)}</td>
            <td className={`${td} text-right`}>{n(d.desalojados)}</td>
            <td className={`${td} text-right`}>{n(d.registros_sem_nenhum_dano_humano_informado)} de {n(d.registros)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Modelo didático: do desastre no município ao reconhecimento federal, e o que cada contagem conta. */
export function DoDesastreAoReconhecimento() {
  const passos = [
    { titulo: "O desastre acontece", texto: "Uma chuva forte, uma estiagem longa ou um deslizamento atinge um ou vários municípios." },
    { titulo: "O município registra", texto: "A prefeitura decreta situação de emergência ou estado de calamidade e registra os danos no S2iD, o sistema da Defesa Civil nacional." },
    { titulo: "O pedido segue para Brasília", texto: "Para ter apoio federal, o município pede o reconhecimento. Quem não pede não entra na contagem de reconhecidos." },
    { titulo: "A União reconhece", texto: "A Defesa Civil nacional analisa e publica uma portaria. Uma só portaria pode reconhecer dezenas de municípios." },
  ];
  return (
    <section aria-labelledby="didatico-desastres" className="border-y border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-12 md:py-14">
        <p className="rotulo text-mineral">Modelo didático</p>
        <h2 id="didatico-desastres" className="mt-3 max-w-3xl font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-carvao">Do desastre ao reconhecimento federal</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          O painel conta registros municipais que chegaram ao último passo. O caminho explica por que essa contagem não é o número de
          desastres nem o de portarias.
        </p>
        <ol className="mt-8 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
          {passos.map((p, i) => (
            <li key={p.titulo} className="flex flex-col bg-papel p-5">
              <p className="rotulo flex items-baseline gap-2 text-mineral"><span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>Passo</p>
              <h3 className="mt-2 font-serif text-lg leading-snug text-carvao">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.texto}</p>
            </li>
          ))}
        </ol>
        <dl className="mt-6 grid gap-px border border-linha bg-linha md:grid-cols-3">
          {[
            ["Uma chuva em 300 municípios", "300 registros municipais"],
            ["Uma portaria para 40 municípios", "40 registros reconhecidos"],
            ["Município que não pediu", "fica fora dos reconhecidos, mesmo com desastre"],
          ].map(([a, b]) => (
            <div key={a} className="bg-papel p-4">
              <dt className="text-sm text-carvao">{a}</dt>
              <dd className="mt-1 text-sm text-carvao-muted">conta como {b}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-mineral">Exemplos ilustrativos, sem dado real. As regras de reconhecimento mudaram ao longo do tempo (2012, 2016, 2020 e 2022).</p>
      </div>
    </section>
  );
}
