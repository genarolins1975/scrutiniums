"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { textoDestaquePerfil, textoReferenciasPerfil, type DestaquePerfil, type ReferenciasPerfil } from "@/lib/energia/conta";
import { dominioComZero, escalaLinear, rotuloTick, ticksQueCabem } from "@/lib/energia/escalas";
import { num, reais } from "@/lib/energia/formato";

/**
 * Três referências do mesmo consumo: o menor, a mediana e o maior custo do perfil entre as distribuidoras com tarifa vigente, numa
 * só escala que parte do zero, com a faixa do 1º ao 3º quartil (onde está a metade central) e as distribuidoras em destaque
 * (?dist=) como losangos. É a figura que a abertura mostra antes do ranking de todas: o ranking diz quem é cada uma; esta diz onde
 * ficam os extremos, a mediana e a sua distribuidora.
 *
 * Os valores vêm de `referenciasDoPerfil` e `destaquesDoPerfil` (src/lib/energia/conta.ts), os mesmos da faixa de métricas, da
 * frase do painel e da tabela do ranking. A figura não calcula nada: desenha. Texto e tabela dizem o mesmo que o desenho (a tabela
 * equivalente traz também a tarifa TE + TUSD de cada referência), e o desenho não depende de cor: o menor e o maior são círculos
 * escuros, a mediana é um círculo maior, a distribuidora em destaque é um losango vazado, e cada um leva o nome e o valor em texto.
 */

const LARGURA_SSR = 760;
const PX_CARACTERE = 6.2;
const MARGEM = 14;
const Y_LINHA = 24;
const Y_EIXO = 46;
const ALTURA = 72;

function Marcador({ tipo }: { tipo: "extremo" | "mediana" | "destaque" | "faixa" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" className="shrink-0">
      {tipo === "extremo" && <circle cx="7" cy="7" r="5" fill="var(--serie-1)" />}
      {tipo === "mediana" && <circle cx="7" cy="7" r="6" fill="var(--cor-energia)" />}
      {tipo === "destaque" && <path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" fill="var(--cor-superficie)" stroke="var(--cor-energia-dark)" strokeWidth="2" />}
      {tipo === "faixa" && <rect x="0.5" y="3.5" width="13" height="7" fill="var(--escala-seq-1)" stroke="var(--escala-seq-3)" />}
    </svg>
  );
}

function Rotulo({ alinhar, marcador, titulo, valor }: { alinhar: "left" | "center" | "right"; marcador: "extremo" | "mediana"; titulo: ReactNode; valor: string }) {
  const lado = alinhar === "left" ? "justify-start text-left" : alinhar === "center" ? "justify-center text-center" : "justify-end text-right";
  return (
    <p className={`flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0 ${lado}`}>
      <span className="inline-flex items-center gap-1.5 text-xs leading-snug text-carvao-muted">
        <Marcador tipo={marcador} />
        <span className="min-w-0 break-words">{titulo}</span>
      </span>
      <span className="font-serif text-[1.375rem] leading-tight tabular-nums text-carvao md:text-[1.5rem]">{valor}</span>
    </p>
  );
}

export function ContaReferencias({ referencias: r, destaques, seletor }: { referencias: ReferenciasPerfil; destaques: DestaquePerfil[]; seletor?: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(LARGURA_SSR);
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const titulo = `Menor, mediana e maior custo de ${r.perfil} kWh/mês entre as ${r.n} distribuidoras, só pela tarifa B1 residencial (sem tributos e sem bandeira)`;

  if (!r.menor || !r.maior || r.mediana === null) {
    return (
      <div ref={raiz} data-grafico="referencias" className="w-full">
        <p className="mb-1 text-sm font-medium text-carvao">{titulo}</p>
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
          Sem referências do custo de {r.perfil} kWh por mês nesta publicação: nenhuma distribuidora tem tarifa B1 residencial vigente na data.
        </p>
      </div>
    );
  }

  const menor = r.menor;
  const maior = r.maior;
  const mediana = r.mediana;
  const dom = dominioComZero([maior.valor, ...destaques.map((d) => d.valor)]);
  const x = escalaLinear([0, dom.max], [MARGEM, largura - MARGEM]);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const ticks = ticksQueCabem(dom.ticks, x, (t) => rotuloTick(t, dom.passo).length * PX_CARACTERE, 12);
  const temFaixa = r.p25 !== null && r.p75 !== null;
  const linhas: { id: string; rotulo: string; valor: number | null; tarifa: number | null }[] = [
    { id: "menor", rotulo: `Menor (${menor.sigla})`, valor: menor.valor, tarifa: r.tarifa.menor },
    { id: "p25", rotulo: "1º quartil", valor: r.p25, tarifa: r.tarifa.p25 },
    { id: "mediana", rotulo: `Mediana de ${r.n} distribuidoras`, valor: mediana, tarifa: r.tarifa.mediana },
    { id: "p75", rotulo: "3º quartil", valor: r.p75, tarifa: r.tarifa.p75 },
    { id: "maior", rotulo: `Maior (${maior.sigla})`, valor: maior.valor, tarifa: r.tarifa.maior },
    ...destaques.map((d) => ({ id: `d-${d.cnpj}`, rotulo: `Em destaque: ${d.sigla}`, valor: d.valor, tarifa: d.tarifa })),
  ];

  return (
    <div ref={raiz} data-grafico="referencias" className="w-full">
      <p className="mb-2 text-sm font-medium text-carvao" data-titulo-grafico="true">
        {titulo}
        <span className="font-normal text-mineral">, em R$/mês</span>
      </p>
      <div className="grid grid-cols-3 gap-x-3">
        <Rotulo alinhar="left" marcador="extremo" titulo={`Menor · ${menor.sigla}`} valor={reais(menor.valor)} />
        <Rotulo alinhar="center" marcador="mediana" titulo="Mediana" valor={reais(mediana)} />
        <Rotulo alinhar="right" marcador="extremo" titulo={`Maior · ${maior.sigla}`} valor={reais(maior.valor)} />
      </div>
      <svg width="100%" height={ALTURA} viewBox={`0 0 ${largura} ${ALTURA}`} role="img" aria-label={textoReferenciasPerfil(r)} className="mt-2 block overflow-visible">
        {temFaixa && (
          <rect
            x={r1(x(r.p25 as number))}
            y={Y_LINHA - 9}
            width={r1(x(r.p75 as number) - x(r.p25 as number))}
            height="18"
            fill="var(--escala-seq-1)"
            stroke="var(--escala-seq-3)"
            strokeWidth="1"
          >
            <title>{`Do 1º ao 3º quartil: ${reais(r.p25)} a ${reais(r.p75)}`}</title>
          </rect>
        )}
        <line x1={r1(x(menor.valor))} x2={r1(x(maior.valor))} y1={Y_LINHA} y2={Y_LINHA} stroke="var(--cor-carvao-muted)" strokeWidth="2" />
        <circle cx={r1(x(menor.valor))} cy={Y_LINHA} r="6" fill="var(--serie-1)">
          <title>{`Menor: ${menor.sigla}, ${reais(menor.valor)}`}</title>
        </circle>
        <circle cx={r1(x(maior.valor))} cy={Y_LINHA} r="6" fill="var(--serie-1)">
          <title>{`Maior: ${maior.sigla}, ${reais(maior.valor)}`}</title>
        </circle>
        <circle cx={r1(x(mediana))} cy={Y_LINHA} r="8" fill="var(--cor-energia)" stroke="var(--cor-superficie)" strokeWidth="2">
          <title>{`Mediana: ${reais(mediana)}`}</title>
        </circle>
        {destaques.map((d) => {
          const cx = r1(x(d.valor));
          return (
            <path key={d.cnpj} d={`M${cx},${Y_LINHA - 10}L${cx + 10},${Y_LINHA}L${cx},${Y_LINHA + 10}L${cx - 10},${Y_LINHA}Z`} fill="var(--cor-superficie)" stroke="var(--cor-energia-dark)" strokeWidth="2.5">
              <title>{`Em destaque: ${textoDestaquePerfil(d)}`}</title>
            </path>
          );
        })}
        <line x1={MARGEM} x2={largura - MARGEM} y1={Y_EIXO} y2={Y_EIXO} stroke="var(--cor-carvao-muted)" strokeWidth="1" />
        {ticks.map((t) => (
          <g key={t} aria-hidden="true">
            <line x1={r1(x(t))} x2={r1(x(t))} y1={Y_EIXO} y2={Y_EIXO + 4} stroke="var(--cor-carvao-muted)" strokeWidth="1" />
            <text x={r1(x(t))} y={Y_EIXO + 17} textAnchor={t === 0 ? "start" : "middle"} fontSize="11" fill="var(--cor-mineral)" className="tabular-nums">
              {rotuloTick(t, dom.passo)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <Marcador tipo="extremo" />
          menor e maior
        </li>
        <li className="flex items-center gap-1.5">
          <Marcador tipo="mediana" />
          mediana
        </li>
        {temFaixa && (
          <li className="flex items-center gap-1.5">
            <Marcador tipo="faixa" />
            do 1º ao 3º quartil, a metade central ({reais(r.p25)} a {reais(r.p75)})
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <Marcador tipo="destaque" />
          distribuidora em destaque
        </li>
        <li className="text-mineral">Valores em R$/mês para {num(r.perfil, 0)} kWh</li>
      </ul>
      <div className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
        {seletor}
        {destaques.length > 0 ? (
          <ul className="space-y-1 text-sm text-carvao" aria-label="Distribuidoras em destaque" aria-live="polite" data-destaques-perfil="">
            {destaques.map((d, i) => (
              <li key={d.cnpj} className="flex items-start gap-2">
                <span className="mt-1">
                  <Marcador tipo="destaque" />
                </span>
                <span className={i === 0 ? "font-medium" : ""}>{textoDestaquePerfil(d)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-carvao-muted md:pt-6" data-destaques-perfil="">
            Escolha uma distribuidora para ver onde ela fica entre o menor e o maior custo. Vale também clicar numa barra do ranking ou numa linha da tabela.
          </p>
        )}
      </div>
      <details className="mt-2 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({linhas.length.toLocaleString("pt-BR")} linhas)
        </summary>
        <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}, em R$/mês e em R$/MWh`}</caption>
            <thead>
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Referência
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  Custo de {num(r.perfil, 0)} kWh (R$/mês)
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  Tarifa TE + TUSD (R$/MWh)
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                    {l.rotulo}
                  </th>
                  <td className="px-2 py-1 text-right text-carvao">{l.valor === null ? <span className="italic text-mineral">sem dado</span> : num(l.valor, 2)}</td>
                  <td className="px-2 py-1 text-right text-carvao">{l.tarifa === null ? <span className="italic text-mineral">sem dado</span> : num(l.tarifa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
