"use client";

import { useId, useState } from "react";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Artefato didático "um dia, hora a hora" das páginas Carga e Rede: 24 barras de um dia real, lidas de uma série horária publicada.
 *
 * - modo "carga": cada barra é a carga média de uma hora, em MW. Numa hora, MW médios e MWh são o mesmo número; a soma das 24 barras é a
 *   energia do dia (MWh) e ela dividida por 24 é a média do dia (MWmed), a linha tracejada. O pico é a barra mais alta.
 * - modo "fluxo": cada barra é o fluxo de uma hora numa fronteira; acima do zero, no sentido do nome da fronteira, abaixo, no contrário.
 *   As duas somas são a energia em cada sentido; o saldo do dia é a diferença; o menor dos dois sentidos é o que o saldo esconde. As
 *   somas vêm da gold diária (`totais`), as mesmas dos cartões da página; as barras, da série horária que as originou.
 *
 * Nada é estimado aqui: as contas são soma, divisão por 24, máximo e mínimo. O que o modelo deixa de fora fica na moldura (ModeloDidatico).
 */

export type DiaHoras = {
  dia: string;
  /** 24 valores médios horários (MW na carga; MWmed com sinal no fluxo); null onde a fonte não publica. */
  horas: (number | null)[];
  /** Fluxo: energia em cada sentido no dia, da gold diária. */
  totais?: { positivo: number; negativo: number } | null;
  /** Carga: a Carga de Energia Diária do mesmo dia (outro produto do ONS), quando publicada. */
  referenciaDiaria?: number | null;
};

export type SerieHoras = {
  id: string;
  rotulo: string;
  /** Fluxo: nome do sentido positivo ("Sul → Sudeste/Centro-Oeste") e do contrário. */
  positivo?: string;
  negativo?: string;
  /** Fluxo: nomes curtos das duas pontas, para a frase do saldo. */
  de?: string;
  para?: string;
  dias: DiaHoras[];
};

const SEMANA = {
  pt: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

function diaDaSemana(iso: string, idioma: "pt" | "en"): string {
  const [a, m, d] = iso.split("-").map(Number);
  return SEMANA[idioma][new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Fluxo de até 1 MWmed conta como nulo na contagem de horas por sentido (regra publicada com os dados da Rede). */
const NULO = 1;

export function HorasDoDia({
  id,
  modo,
  series,
  serieInicial,
  diaInicial,
  rotuloSerie,
}: {
  id: string;
  modo: "carga" | "fluxo";
  series: SerieHoras[];
  serieInicial?: string;
  diaInicial?: string;
  /** Rótulo do grupo de escolha da série (ex.: "Fronteira"); sem ele, com uma série só, não há escolha. */
  rotuloSerie?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const uid = useId();
  const [serieId, setSerieId] = useState(serieInicial ?? series[0]?.id ?? "");
  const serie = series.find((s) => s.id === serieId) ?? series[0];
  const [diaId, setDiaId] = useState(diaInicial ?? serie?.dias[serie.dias.length - 1]?.dia ?? "");
  const dia = serie?.dias.find((d) => d.dia === diaId) ?? serie?.dias[serie.dias.length - 1];
  const valores = dia?.horas ?? [];
  const validos = valores.map((v, h) => ({ v, h })).filter((x): x is { v: number; h: number } => x.v !== null && Number.isFinite(x.v));
  const [hora, setHora] = useState(18);
  if (!serie || !dia || validos.length === 0) {
    return <p className="text-sm text-carvao-muted">{tx("Série horária sem dados nesta publicação.", "Hourly series without data in this release.")}</p>;
  }
  const completo = validos.length === 24;
  const mw = modo === "carga" ? "MW" : tx("MWmed", "MWavg");

  // escala: barras começam no zero; no fluxo, simétrica em torno do zero
  const maxAbs = Math.max(...validos.map((x) => Math.abs(x.v)), 1);
  const maxPos = Math.max(...validos.map((x) => x.v), 0);
  const minNeg = Math.min(...validos.map((x) => x.v), 0);
  const topo = modo === "carga" ? maxPos * 1.08 : maxAbs * 1.1;
  const fundo = modo === "carga" ? 0 : minNeg < 0 ? -maxAbs * 1.1 : 0;
  const W = 720;
  const H = 240;
  const M = { e: 64, d: 12, t: 14, b: 30 };
  const larg = (W - M.e - M.d) / 24;
  const y = (v: number) => M.t + ((topo - v) / (topo - fundo || 1)) * (H - M.t - M.b);
  const x = (h: number) => M.e + h * larg;
  // marcas "redondas" do eixo (1, 2, 2,5 ou 5 vezes uma potência de 10), sem passar do topo nem do fundo
  const passo = (alvo: number) => {
    const p = 10 ** Math.floor(Math.log10(Math.max(alvo, 1)));
    return ([1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= alvo) ?? 10 * p);
  };
  const s = passo((modo === "carga" ? topo : Math.max(topo, -fundo)) / 2.2);
  const ticks: number[] = [];
  for (let t = Math.ceil(fundo / s) * s; t <= topo + 1e-9; t += s) ticks.push(Math.round(t));

  const soma = validos.reduce((t, x) => t + x.v, 0);
  const media = soma / validos.length;
  const pico = validos.reduce((a, b) => (b.v > a.v ? b : a));
  const vale = validos.reduce((a, b) => (b.v < a.v ? b : a));
  const vHora = valores[hora] ?? null;
  const hh = (h: number) => `${String(h).padStart(2, "0")}h`;

  // fluxo: as somas da gold diária (as mesmas dos cartões); sem elas, as das barras
  const somaPos = dia.totais?.positivo ?? validos.filter((x) => x.v > 0).reduce((t, x) => t + x.v, 0);
  const somaNeg = dia.totais?.negativo ?? -validos.filter((x) => x.v < 0).reduce((t, x) => t + x.v, 0);
  const horasPos = validos.filter((x) => x.v > NULO).length;
  const horasNeg = validos.filter((x) => x.v < -NULO).length;
  const saldo = somaPos - somaNeg;
  const escondida = Math.min(somaPos, somaNeg);

  const nomeDia = `${diaDaSemana(dia.dia, idioma)}, ${f.dataBR(dia.dia)}`;
  const resumoAria =
    modo === "carga"
      ? tx(
          `Carga hora a hora em ${nomeDia}: média de ${f.num(media, 0)} MW, pico de ${f.num(pico.v, 0)} MW às ${hh(pico.h)}, menor hora com ${f.num(vale.v, 0)} MW às ${hh(vale.h)}.`,
          `Load hour by hour on ${nomeDia}: average of ${f.num(media, 0)} MW, peak of ${f.num(pico.v, 0)} MW at ${hh(pico.h)}, lowest hour with ${f.num(vale.v, 0)} MW at ${hh(vale.h)}.`,
        )
      : tx(
          `Fluxo hora a hora em ${nomeDia}, ${serie.rotulo}: ${f.num(somaPos, 0)} MWh no sentido ${serie.positivo} e ${f.num(somaNeg, 0)} MWh no sentido ${serie.negativo}.`,
          `Flow hour by hour on ${nomeDia}, ${serie.rotulo}: ${f.num(somaPos, 0)} MWh in the ${serie.positivo} direction and ${f.num(somaNeg, 0)} MWh in the ${serie.negativo} direction.`,
        );

  return (
    <div className="space-y-4" data-horas-do-dia={id}>
      {rotuloSerie && series.length > 1 && (
        <TransicaoOpcoes
          rotulo={rotuloSerie}
          nome={`${id}-serie`}
          opcoes={series.map((s) => [s.id, s.rotulo] as const)}
          valor={serie.id}
          onMudar={(v) => setSerieId(v)}
        />
      )}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Dia", "Day")}</span>
          <select
            value={dia.dia}
            onChange={(e) => setDiaId(e.target.value)}
            className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
          >
            {serie.dias.map((d) => (
              <option key={d.dia} value={d.dia}>
                {`${diaDaSemana(d.dia, idioma)}, ${f.dataBR(d.dia)}`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm text-carvao" htmlFor={`${uid}-hora`}>
          <span className="rotulo text-mineral">{tx("Hora", "Hour")}</span>
          <input
            id={`${uid}-hora`}
            type="range"
            min={0}
            max={23}
            step={1}
            value={hora}
            onChange={(e) => setHora(Number(e.target.value))}
            aria-valuetext={`${hh(hora)}: ${vHora === null ? tx("sem dado", "no data") : `${f.num(vHora, 0)} ${mw}`}`}
            className="min-h-[44px] accent-energia"
          />
        </label>
      </div>

      <p className="text-sm leading-relaxed text-carvao" aria-live="polite" data-hora-escolhida="">
        {vHora === null
          ? tx(`Às ${hh(hora)}: sem dado publicado.`, `At ${hh(hora)}: no published data.`)
          : modo === "carga"
            ? tx(
                `Às ${hh(hora)}, o sistema atendeu em média ${f.num(vHora, 0)} MW; durante essa uma hora, isso é ${f.num(vHora, 0)} MWh de energia.`,
                `At ${hh(hora)}, the system served an average of ${f.num(vHora, 0)} MW; over that one hour, that is ${f.num(vHora, 0)} MWh of energy.`,
              )
            : Math.abs(vHora) <= NULO
              ? tx(`Às ${hh(hora)}, fluxo praticamente nulo (até 1 MWmed).`, `At ${hh(hora)}, practically no flow (up to 1 MWavg).`)
              : tx(
                  `Às ${hh(hora)}, ${f.num(Math.abs(vHora), 0)} MWmed no sentido ${vHora > 0 ? serie.positivo : serie.negativo}: nessa uma hora, ${f.num(Math.abs(vHora), 0)} MWh.`,
                  `At ${hh(hora)}, ${f.num(Math.abs(vHora), 0)} MWavg in the ${vHora > 0 ? serie.positivo : serie.negativo} direction: over that one hour, ${f.num(Math.abs(vHora), 0)} MWh.`,
                )}
      </p>

      <figure className="m-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={resumoAria}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.e} x2={W - M.d} y1={y(t)} y2={y(t)} stroke="var(--cor-linha)" strokeWidth={t === 0 ? 1.2 : 0.6} />
              <text x={M.e - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--cor-carvao-muted)">
                {f.num(t, 0)}
              </text>
            </g>
          ))}
          {valores.map((v, h) => {
            if (v === null) return null;
            const y0 = y(0);
            const y1 = y(v);
            const escolhida = h === hora;
            const cor = modo === "carga" || v >= 0 ? "var(--cor-energia)" : "var(--cor-bronze)";
            return (
              <rect
                key={h}
                x={x(h) + 1.5}
                width={larg - 3}
                y={Math.min(y0, y1)}
                height={Math.max(1, Math.abs(y1 - y0))}
                fill={cor}
                opacity={escolhida ? 1 : 0.55}
                onClick={() => setHora(h)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          {modo === "carga" && (
            <g>
              <line x1={M.e} x2={W - M.d} y1={y(media)} y2={y(media)} stroke="var(--cor-carvao)" strokeDasharray="5 4" strokeWidth={1.4} />
              <text x={M.e + 6} y={y(media) - 6} fontSize="11" fill="var(--cor-carvao)" stroke="var(--cor-superficie)" strokeWidth={4} paintOrder="stroke">
                {tx(`média do dia: ${f.num(media, 0)} MWmed`, `day average: ${f.num(media, 0)} MWavg`)}
              </text>
            </g>
          )}
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={x(h) + larg / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--cor-carvao-muted)">
              {hh(h)}
            </text>
          ))}
          {modo === "fluxo" && (
            <g fontSize="11" stroke="var(--cor-superficie)" strokeWidth={4} paintOrder="stroke">
              <text x={M.e + 4} y={M.t + 10} fill="var(--cor-energia-dark)">
                {`↑ ${serie.positivo}`}
              </text>
              {fundo < 0 && (
                <text x={M.e + 4} y={H - M.b - 4} fill="var(--cor-bronze-dark)">
                  {`↓ ${serie.negativo}`}
                </text>
              )}
            </g>
          )}
        </svg>
        <figcaption className="mt-1 text-xs text-carvao-muted">
          {modo === "carga"
            ? tx(
                `Cada barra: carga média de uma hora, em MW, de 00h a 23h de ${nomeDia}. Linha tracejada: média das ${validos.length} horas. Toque numa barra ou use o controle Hora.`,
                `Each bar: average load of one hour, in MW, from 00h to 23h on ${nomeDia}. Dashed line: average of the ${validos.length} hours. Tap a bar or use the Hour control.`,
              )
            : tx(
                `Cada barra: fluxo médio de uma hora, em MWmed. Acima do zero, no sentido ${serie.positivo}; abaixo, no sentido ${serie.negativo}. Toque numa barra ou use o controle Hora.`,
                `Each bar: average flow of one hour, in MWavg. Above zero, in the ${serie.positivo} direction; below, in the ${serie.negativo} direction. Tap a bar or use the Hour control.`,
              )}
        </figcaption>
      </figure>

      {modo === "carga" ? (
        <dl className="grid gap-x-6 gap-y-3 border-t border-linha pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4" data-contas-do-dia="">
          <div>
            <dt className="rotulo text-mineral">{tx("Energia no dia", "Energy in the day")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(soma, 0)}</span> MWh
              <span className="block text-xs text-carvao-muted">
                {completo
                  ? tx("a soma das 24 barras (cada hora: MW × 1 h)", "the sum of the 24 bars (each hour: MW × 1 h)")
                  : tx(`soma das ${validos.length} horas publicadas`, `sum of the ${validos.length} published hours`)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Média do dia", "Day average")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(media, 0)}</span> {tx("MWmed", "MWavg")}
              <span className="block text-xs text-carvao-muted">
                {tx(`a energia do dia dividida por ${validos.length} horas`, `the day's energy divided by ${validos.length} hours`)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Pico (hora mais alta)", "Peak (highest hour)")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(pico.v, 0)}</span> MW {tx(`às ${hh(pico.h)}`, `at ${hh(pico.h)}`)}
              <span className="block text-xs text-carvao-muted">
                {tx(`${f.num((100 * (pico.v - media)) / media, 1)}% acima da média do dia`, `${f.num((100 * (pico.v - media)) / media, 1)}% above the day average`)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Hora mais baixa", "Lowest hour")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(vale.v, 0)}</span> MW {tx(`às ${hh(vale.h)}`, `at ${hh(vale.h)}`)}
              <span className="block text-xs text-carvao-muted">
                {tx(`${f.num((100 * (media - vale.v)) / media, 1)}% abaixo da média do dia`, `${f.num((100 * (media - vale.v)) / media, 1)}% below the day average`)}
              </span>
            </dd>
          </div>
        </dl>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 border-t border-linha pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4" data-contas-do-dia="">
          <div>
            <dt className="rotulo text-mineral">{serie.positivo}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(somaPos, 0)}</span> MWh
              <span className="block text-xs text-carvao-muted">{tx(`soma das barras acima do zero (${horasPos} h)`, `sum of the bars above zero (${horasPos} h)`)}</span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{serie.negativo}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(somaNeg, 0)}</span> MWh
              <span className="block text-xs text-carvao-muted">{tx(`soma das barras abaixo do zero (${horasNeg} h)`, `sum of the bars below zero (${horasNeg} h)`)}</span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Saldo do dia", "Net flow of the day")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(Math.abs(saldo), 0)}</span> MWh
              <span className="block text-xs text-carvao-muted">
                {saldo === 0
                  ? tx("os dois sentidos se igualam", "the two directions are equal")
                  : tx(
                      `${f.num(somaPos, 0)} − ${f.num(somaNeg, 0)}: do ${saldo > 0 ? serie.de : serie.para} para o ${saldo > 0 ? serie.para : serie.de}`,
                      `${f.num(somaPos, 0)} − ${f.num(somaNeg, 0)}: from the ${saldo > 0 ? serie.de : serie.para} to the ${saldo > 0 ? serie.para : serie.de}`,
                    )}
              </span>
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("O que o saldo esconde", "What the net flow hides")}</dt>
            <dd className="mt-1 text-carvao">
              <span className="font-serif text-xl tabular-nums">{f.num(escondida, 0)}</span> MWh
              <span className="block text-xs text-carvao-muted">{tx("o menor dos dois sentidos: passou e voltou", "the smaller of the two directions: it went and came back")}</span>
            </dd>
          </div>
        </dl>
      )}

      {modo === "carga" && dia.referenciaDiaria !== undefined && dia.referenciaDiaria !== null && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-referencia-diaria="">
          {tx(
            `Para o mesmo dia, a Carga de Energia Diária do ONS (o produto dos cartões e do gráfico de pontos) publica ${f.num(dia.referenciaDiaria, 0)} MWmed; a média da curva horária dá ${f.num(media, 0)} MWmed. São dois arquivos do ONS e a diferença entre eles fica na conferência da página, em Auditar.`,
            `For the same day, the ONS Daily Energy Load (the product behind the cards and the dot chart) publishes ${f.num(dia.referenciaDiaria, 0)} MWavg; the average of the hourly curve gives ${f.num(media, 0)} MWavg. They are two ONS files, and the difference between them is in the page's check, under Audit.`,
          )}
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-energia-dark underline underline-offset-4">{tx("Os valores de cada hora em tabela", "The value of each hour as a table")}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm tabular-nums">
            <caption className="sr-only">{resumoAria}</caption>
            <thead>
              <tr className="border-b border-linha text-left text-xs text-carvao-muted">
                <th scope="col" className="py-1 pr-4 font-normal">{tx("Hora", "Hour")}</th>
                <th scope="col" className="py-1 pr-4 text-right font-normal">{modo === "carga" ? "MW" : tx(`MWmed (positivo: ${serie.positivo})`, `MWavg (positive: ${serie.positivo})`)}</th>
              </tr>
            </thead>
            <tbody>
              {valores.map((v, h) => (
                <tr key={h} className="border-b border-linha/60">
                  <th scope="row" className="py-0.5 pr-4 text-left font-normal">{hh(h)}</th>
                  <td className="py-0.5 pr-4 text-right">{v === null ? tx("sem dado", "no data") : f.num(v, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
