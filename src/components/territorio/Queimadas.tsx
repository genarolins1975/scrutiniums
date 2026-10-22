import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import type { ReactNode } from "react";
import type { FocosMunicipio, GoldQueimadas } from "@/lib/territorio/queimadas";
import { NOME_UF } from "@/lib/territorio/queimadas";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function n(v: number, casas = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function mesAno(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/** Figura com pergunta, subtítulo de unidade e universo, fonte e tabela equivalente recolhida. */
export function Figura({ id, titulo, subtitulo, children, tabela, fonte }: Readonly<{ id: string; titulo: string; subtitulo: string; children: ReactNode; tabela: ReactNode; fonte: ReactNode }>) {
  return (
    <figure aria-labelledby={`${id}-titulo`} className="border-t border-linha pt-6">
      <h3 id={`${id}-titulo`} className="font-serif text-xl leading-snug text-carvao">{titulo}</h3>
      <p className="mt-1 text-sm text-carvao-muted">{subtitulo}</p>
      <div className="mt-5">{children}</div>
      <figcaption className="mt-3 text-xs leading-relaxed text-mineral">{fonte}</figcaption>
      <details className="mt-3">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao underline decoration-linha underline-offset-4">Ver a tabela</summary>
        <div className="mt-2 overflow-x-auto">{tabela}</div>
      </details>
    </figure>
  );
}

const th = "border-b border-linha px-3 py-2 text-left font-medium text-carvao";
const td = "border-b border-linha px-3 py-2 text-carvao tabular-nums";

/** Focos por ano do satélite de referência, anos fechados; o ano em curso fica à parte, com contorno, e não se compara. */
export function SerieAnual({ g }: Readonly<{ g: GoldQueimadas }>) {
  return (
    <>
      <div className="md:hidden"><GraficoAnual g={g} compacto /></div>
      <div className="hidden md:block"><GraficoAnual g={g} /></div>
    </>
  );
}

function GraficoAnual({ g, compacto = false }: Readonly<{ g: GoldQueimadas; compacto?: boolean }>) {
  const fechados = g.anual.filter((a) => !a.parcial && a.focos !== null) as { ano: number; focos: number }[];
  const parcial = g.anual.find((a) => a.parcial);
  const max = Math.max(...fechados.map((a) => a.focos), parcial?.focos ?? 0);
  // no celular o desenho tem a largura real da tela: menos rótulos, texto em tamanho legível
  const L = compacto ? 360 : 960, A = compacto ? 230 : 260, base = compacto ? 196 : 220, topo = 20, larg = L / (fechados.length + 2.2);
  const passo = compacto ? 5 : 2;
  const y = (v: number) => base - ((base - topo) * v) / max;
  const maior = fechados.reduce((a, b) => (b.focos > a.focos ? b : a));
  const menor = fechados.reduce((a, b) => (b.focos < a.focos ? b : a));
  const ultimo = fechados[fechados.length - 1];
  const destaque = new Set(compacto ? [maior.ano, ultimo.ano] : [maior.ano, menor.ano, ultimo.ano]);
  const fonte = compacto ? "text-[11px]" : "text-[13px]";
  const fonteEixo = compacto ? "text-[11px]" : "text-[12px]";
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Focos de calor por ano, satélite de referência, ${fechados[0].ano} a ${ultimo.ano}. Maior: ${maior.ano}, ${n(maior.focos)}. Menor: ${menor.ano}, ${n(menor.focos)}. ${ultimo.ano}: ${n(ultimo.focos)}.`} className="h-auto w-full">
      <line x1="0" x2={L} y1={base} y2={base} className="stroke-linha" strokeWidth="1" />
      {fechados.map((a, i) => {
        const x = i * larg + larg * 0.15;
        return (
          <g key={a.ano}>
            <title>{`${a.ano}: ${n(a.focos)} focos`}</title>
            <rect x={x} y={y(a.focos)} width={larg * 0.7} height={base - y(a.focos)} className={a.ano === ultimo.ano ? "fill-obee" : "fill-obee-neutro"} />
            {destaque.has(a.ano) && <text x={x + larg * 0.35} y={y(a.focos) - 6} textAnchor="middle" className={`fill-carvao ${fonte} tabular-nums`}>{n(a.focos / 1000, 0)} mil</text>}
            {((i % passo === 0 && (!compacto || ultimo.ano - a.ano >= 3)) || a.ano === ultimo.ano) && (
              <text x={compacto && i === 0 ? x : x + larg * 0.35} y={base + 18} textAnchor={compacto && i === 0 ? "start" : "middle"} className={`fill-mineral ${fonteEixo}`}>{a.ano}</text>
            )}
          </g>
        );
      })}
      {parcial && parcial.focos !== null && (
        <g>
          <title>{`${parcial.ano}, parcial até ${parcial.ultimoDia ? dataBr(parcial.ultimoDia) : "a data da captura"}: ${n(parcial.focos)} focos`}</title>
          <rect x={(fechados.length + 1) * larg + larg * 0.15} y={y(parcial.focos)} width={larg * 0.7} height={base - y(parcial.focos)} className="fill-none stroke-obee" strokeWidth="2" strokeDasharray="4 3" />
          <text x={compacto ? L : (fechados.length + 1) * larg + larg * 0.5} y={y(parcial.focos) - 6} textAnchor={compacto ? "end" : "middle"} className={`fill-carvao ${fonte} tabular-nums`}>{n(parcial.focos / 1000, 0)} mil</text>
          <text x={compacto ? L : (fechados.length + 1) * larg + larg * 0.5} y={base + 18} textAnchor={compacto ? "end" : "middle"} className={`fill-mineral ${fonteEixo}`}>{compacto ? `${String(parcial.ano).slice(2)}*` : `${parcial.ano}*`}</text>
        </g>
      )}
    </svg>
  );
}

export function TabelaAnual({ g }: Readonly<{ g: GoldQueimadas }>) {
  return (
    <table className="w-full min-w-[320px] text-sm">
      <thead><tr><th className={th}>Ano</th><th className={`${th} text-right`}>Focos</th><th className={th}>Situação</th></tr></thead>
      <tbody>
        {g.anual.map((a) => (
          <tr key={a.ano}>
            <td className={td}>{a.ano}</td>
            <td className={`${td} text-right`}>{a.focos === null ? "Indisponível" : n(a.focos)}</td>
            <td className={`${td} text-carvao-muted`}>{a.parcial ? `Parcial, até ${a.ultimoDia ? dataBr(a.ultimoDia) : "a captura"}` : a.preliminar ? "Ano encerrado, preliminar (arquivos mensais; consolidado do INPE ainda não publicado)" : "Ano fechado"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Mês a mês, ano corrente contra o anterior; mês em curso com contorno e mês sem arquivo vazio, nunca zero. */
export function MesAMes({ g }: Readonly<{ g: GoldQueimadas }>) {
  const anos = Object.keys(g.mensal).sort();
  return (
    <>
      <div className="md:hidden"><GraficoMensal g={g} compacto /></div>
      <div className="hidden md:block"><GraficoMensal g={g} /></div>
      <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-carvao-muted">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-obee-neutro" />{anos[0]}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-obee" />{anos[1]}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 border-2 border-dashed border-obee" />Mês em curso, parcial</span>
      </p>
    </>
  );
}

function GraficoMensal({ g, compacto = false }: Readonly<{ g: GoldQueimadas; compacto?: boolean }>) {
  const anos = Object.keys(g.mensal).sort();
  const [anterior, atual] = anos;
  const mA = g.mensal[anterior] ?? [];
  const mB = g.mensal[atual] ?? [];
  const vals = [...mA, ...mB].map((m) => m.focos ?? 0);
  const max = Math.max(...vals, 1);
  const L = compacto ? 360 : 960, A = compacto ? 210 : 250, base = compacto ? 182 : 210, topo = 16, grupo = L / 12;
  const y = (v: number) => base - ((base - topo) * v) / max;
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Focos de calor por mês, ${anterior} e ${atual}, satélite de referência; valores na tabela.`} className="h-auto w-full">
        <line x1="0" x2={L} y1={base} y2={base} className="stroke-linha" strokeWidth="1" />
        {MESES.map((rot, i) => {
          const a = mA[i];
          const b = mB[i];
          const x = i * grupo;
          return (
            <g key={rot}>
              {a && a.focos !== null && (
                <g><title>{`${rot}/${anterior}: ${n(a.focos)} focos`}</title>
                  <rect x={x + grupo * 0.12} y={y(a.focos)} width={grupo * 0.36} height={base - y(a.focos)} className="fill-obee-neutro" /></g>
              )}
              {b && b.focos !== null && (
                <g><title>{`${rot}/${atual}${b.parcial ? ", parcial" : ""}: ${n(b.focos)} focos`}</title>
                  <rect x={x + grupo * 0.52} y={y(b.focos)} width={grupo * 0.36} height={base - y(b.focos)} className={b.parcial ? "fill-none stroke-obee" : "fill-obee"} strokeWidth={b.parcial ? 2 : 0} strokeDasharray={b.parcial ? "4 3" : undefined} /></g>
              )}
              <text x={x + grupo / 2} y={base + 18} textAnchor="middle" className={`fill-mineral ${compacto ? "text-[11px]" : "text-[12px]"}`}>{compacto ? rot[0].toUpperCase() : rot}</text>
            </g>
          );
        })}
    </svg>
  );
}

export function TabelaMensal({ g }: Readonly<{ g: GoldQueimadas }>) {
  const anos = Object.keys(g.mensal).sort();
  return (
    <table className="w-full min-w-[320px] text-sm">
      <thead><tr><th className={th}>Mês</th>{anos.map((a) => <th key={a} className={`${th} text-right`}>{a}</th>)}</tr></thead>
      <tbody>
        {MESES.map((m, i) => (
          <tr key={m}>
            <td className={td}>{m}</td>
            {anos.map((a) => {
              const x = g.mensal[a]?.[i];
              return <td key={a} className={`${td} text-right`}>{!x ? "" : x.focos === null ? "Indisponível" : `${n(x.focos)}${x.parcial ? " (parcial)" : ""}`}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras horizontais de um recorte por categoria, com o mesmo período do ano anterior como referência. */
export function BarrasComparadas({ linhas, rotuloAtual, rotuloAnterior, nome = (id: string) => id }: Readonly<{ linhas: { id: string; atual: number; anterior: number | null }[]; rotuloAtual: string; rotuloAnterior: string; nome?: (id: string) => string }>) {
  const max = Math.max(...linhas.flatMap((l) => [l.atual, l.anterior ?? 0]), 1);
  return (
    <div>
      <p className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-carvao-muted">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-obee" />{rotuloAtual}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-1 w-3 bg-carvao" />{rotuloAnterior}</span>
      </p>
      <ul className="space-y-3">
        {linhas.map((l) => (
          <li key={l.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="truncate text-carvao" title={nome(l.id)}>{nome(l.id)}</span>
            <span aria-hidden="true" className="relative block h-5 bg-papel">
              <span className="absolute inset-y-0 left-0 bg-obee" style={{ width: `${(100 * l.atual) / max}%` }} />
              {l.anterior !== null && <span className="absolute inset-y-[-3px] w-[3px] bg-carvao" style={{ left: `calc(${(100 * l.anterior) / max}% - 1.5px)` }} />}
            </span>
            <span className="tabular-nums text-carvao">{n(l.atual)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TabelaUF({ g, linhas }: Readonly<{ g: GoldQueimadas; linhas: { id: string; atual: number; anterior: number | null; anoCompleto: number | null }[] }>) {
  const c = g.comparacao;
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr>
          <th className={th}>Unidade da Federação</th>
          <th className={`${th} text-right`}>{c ? `${mesAno(c.periodoAtual.inicio)} a ${mesAno(c.periodoAtual.fim)}` : "Ano corrente"}</th>
          <th className={`${th} text-right`}>{c ? `${mesAno(c.periodoAnterior.inicio)} a ${mesAno(c.periodoAnterior.fim)}` : "Mesmo período anterior"}</th>
          <th className={`${th} text-right`}>Diferença</th>
          <th className={`${th} text-right`}>{Number(g.dataReferencia.slice(0, 4)) - 1} completo</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id}>
            <td className={td}>{NOME_UF[l.id] ?? l.id}</td>
            <td className={`${td} text-right`}>{n(l.atual)}</td>
            <td className={`${td} text-right`}>{l.anterior === null ? "" : n(l.anterior)}</td>
            <td className={`${td} text-right`}>{l.anterior ? `${l.atual >= l.anterior ? "+" : "−"}${n(Math.abs(l.atual - l.anterior))}` : l.anterior === 0 ? "sem focos antes" : ""}</td>
            <td className={`${td} text-right`}>{l.anoCompleto === null ? "" : n(l.anoCompleto)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Modelo didático do foco de calor. No painel, a introdução fala "deste painel"; na
 * entrada do observatório, ela recebe outro texto (introducao) e a ligação ao painel.
 */
export function DoSateliteAoFoco({ introducao }: Readonly<{ introducao?: ReactNode }> = {}) {
  const casos = [
    { id: "um", titulo: "Fogo ativo num pixel", texto: "Na passagem do satélite, um pixel de cerca de 1 km com fogo ativo vira 1 foco, mesmo que o fogo ocupe só parte dele.", pixels: [[1, 1]], nuvem: false, focos: 1 },
    { id: "grande", titulo: "Um incêndio grande", texto: "Uma frente de fogo que cobre vários pixels gera vários focos. Foco não é incêndio: um único incêndio pode somar dezenas.", pixels: [[0, 1], [1, 1], [2, 1], [1, 0], [2, 0]], nuvem: false, focos: 5 },
    { id: "invisivel", titulo: "O que fica de fora", texto: "Fogo pequeno, rasteiro sob a copa, sob nuvem ou apagado entre duas passagens do satélite não é detectado: zero focos não prova ausência de fogo.", pixels: [[1, 1]], nuvem: true, focos: 0 },
  ];
  return (
    <ModeloDidatico
      id="didatico"
      titulo="Do satélite ao foco de calor"
      descricao={
        <>
          {introducao ?? (
            <>
              Os números deste painel contam focos: pixels com fogo ativo vistos pelo satélite de referência do INPE. O esquema mostra
              por que foco não é área queimada nem número de incêndios. É uma ilustração, sem escala nem dado real.
            </>
          )}
        </>
      }
      deixaDeFora={[
        "Fogo pequeno, rasteiro sob a copa, sob nuvem ou apagado entre duas passagens do satélite: zero focos não prova ausência de fogo.",
        "Área queimada e número de incêndios: o foco é um pixel com fogo ativo, e um incêndio grande soma vários.",
        "Escala e dado real: é uma ilustração.",
      ]}
    >
        <ol className="grid gap-px border border-linha bg-linha md:grid-cols-3">
          {casos.map((c, i) => (
            <li key={c.id} className="flex flex-col bg-papel p-5">
              <p className="rotulo flex items-baseline gap-2 text-mineral"><span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>{c.titulo}</p>
              <svg viewBox="0 0 120 90" aria-hidden="true" className="mt-4 h-auto w-40">
                {[0, 1, 2].map((cx) => [0, 1].map((cy) => (
                  <rect key={`${cx}-${cy}`} x={10 + cx * 34} y={14 + cy * 34} width="32" height="32" className={c.pixels.some(([px, py]) => px === cx && py === cy) && !c.nuvem ? "fill-obee" : "fill-superficie"} stroke="#D8D2C6" />
                )))}
                {c.pixels.map(([px, py]) => (
                  <circle key={`${px}-${py}`} cx={26 + px * 34} cy={30 + py * 34} r="5" className="fill-bronze" />
                ))}
                {c.nuvem && <ellipse cx="60" cy="40" rx="46" ry="20" className="fill-marfim" stroke="#A6A8A4" strokeDasharray="3 3" />}
              </svg>
              <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{c.texto}</p>
              <p className="mt-auto pt-3 text-sm text-carvao"><span className="font-label text-lg tabular-nums">{c.focos}</span> {c.focos === 1 ? "foco" : "focos"}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-mineral">
          Ponto marrom: fogo no terreno. Quadrado escuro: pixel que o satélite registra como foco. Comparar anos exige sempre o mesmo
          satélite: a soma de todos os satélites conta o mesmo fogo várias vezes e muda com a quantidade de satélites em órbita.
        </p>
    </ModeloDidatico>
  );
}

/** Ranking de municípios por focos no último ano completo, com a densidade por área ao lado; cabe na largura do celular. */
export function TabelaMunicipios({ itens, ano, rotuloOrdem }: Readonly<{ itens: FocosMunicipio[]; ano: number; rotuloOrdem: string }>) {
  const c = "border-b border-linha px-2 py-2 md:px-3";
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{rotuloOrdem}</caption>
      <thead>
        <tr>
          <th className={`${c} w-8 text-left font-medium text-carvao`}>#</th>
          <th className={`${c} text-left font-medium text-carvao`}>Município</th>
          <th className={`${c} text-right font-medium text-carvao`}>Focos em {ano}</th>
          <th className={`${c} text-right font-medium text-carvao`}>Por 1.000 km²</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((m, i) => (
          <tr key={m.id}>
            <td className={`${c} tabular-nums text-carvao-muted`}>{i + 1}</td>
            <td className={`${c} text-carvao`}>{m.nome} <span className="whitespace-nowrap text-carvao-muted">({m.uf})</span></td>
            <td className={`${c} text-right tabular-nums text-carvao`}>{n(m.focos.ultimoAnoCompleto ?? 0)}</td>
            <td className={`${c} text-right tabular-nums text-carvao`}>{m.porMilKm2 == null ? "Indisponível" : n(m.porMilKm2, 1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
