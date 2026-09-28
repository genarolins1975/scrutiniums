"use client";

import { useMemo } from "react";
import type { FonteGeracao, Submercado } from "@/lib/energia/tipos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { COR_FONTE, NOME_FONTE } from "@/components/energia/BarrasMix";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Linha do tempo do dia: as 24 horas do PLD como uma curva limpa, por
 * submercado ou todos, com o fundo indicando madrugada, manhã, tarde e noite.
 * Quando o dia escolhido coincide com o dia do perfil horário de geração
 * publicado, a solar e a eólica aparecem em um segundo gráfico alinhado pela
 * hora, para dar contexto sem misturar unidades. Estado na URL (?dia=,
 * ?submercado=). Nenhuma frase atribui o preço à geração: as curvas são
 * mostradas lado a lado, e a leitura é do usuário.
 */
export type DiaHorario = { d: string; horas: { h: string; SE: number | null; S: number | null; NE: number | null; N: number | null }[] };
export type PerfilGeracao = { dia: string; horas: ({ h: string } & Record<FonteGeracao, number | null>)[] };

const SMS: { id: Submercado; rotulo: string; sigla: string; cor: string }[] = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
];
const FAIXAS = [
  { de: "00:00", ate: "05:00", rotulo: "madrugada" },
  { de: "06:00", ate: "11:00", rotulo: "manhã" },
  { de: "12:00", ate: "17:00", rotulo: "tarde" },
  { de: "18:00", ate: "23:00", rotulo: "noite" },
];
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function LinhaDoDia({ dias, perfil, limiar }: { dias: DiaHorario[]; perfil: PerfilGeracao | null; limiar: number }) {
  const datas = dias.map((d) => d.d);
  const [dia, setDia] = useEstadoUrl<string>("dia", datas[datas.length - 1] ?? "", umDe(datas));
  const [sm, setSm] = useEstadoUrl<"todos" | Submercado>("submercado", "todos", umDe(["todos", "SE", "S", "NE", "N"] as const));
  const atual = dias.find((d) => d.d === dia) ?? dias[dias.length - 1];
  const series = (sm === "todos" ? SMS : SMS.filter((s) => s.id === sm)).map((s) => ({ id: s.id, rotulo: s.rotulo, sigla: s.sigla, cor: s.cor, espessura: sm === "todos" ? 2 : 2.5 }));
  const leitura = useMemo(() => {
    if (!atual) return null;
    const foco: Submercado = sm === "todos" ? "SE" : sm;
    const vals = atual.horas.map((h) => ({ h: h.h, v: h[foco] })).filter((p): p is { h: string; v: number } => typeof p.v === "number");
    if (!vals.length) return null;
    const max = vals.reduce((a, b) => (b.v > a.v ? b : a));
    const min = vals.reduce((a, b) => (b.v < a.v ? b : a));
    let horasDif = 0;
    let maiorDif = { h: "", v: 0 };
    for (const h of atual.horas) {
      const xs = SMS.map((s) => h[s.id]).filter((v): v is number => typeof v === "number");
      if (xs.length < 2) continue;
      const dif = Math.max(...xs) - Math.min(...xs);
      if (dif > limiar) horasDif += 1;
      if (dif > maiorDif.v) maiorDif = { h: h.h, v: dif };
    }
    return { foco, max, min, horasDif, maiorDif, nomeFoco: SMS.find((s) => s.id === foco)!.rotulo };
  }, [atual, sm, limiar]);
  const mesmoDia = perfil && atual && perfil.dia === atual.d;
  const dados = atual ? atual.horas.map((h) => ({ x: h.h, SE: h.SE, S: h.S, NE: h.NE, N: h.N })) : [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Submercado" className="flex flex-wrap gap-1 border-b border-linha">
          {[{ id: "todos" as const, rotulo: "Todos" }, ...SMS.map((s) => ({ id: s.id, rotulo: s.sigla }))].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sm === t.id}
              onClick={() => setSm(t.id)}
              className={`rotulo min-h-[44px] border-b-2 px-3 ${sm === t.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-mineral">
          Dia
          <select value={atual?.d ?? ""} onChange={(e) => setDia(e.target.value)} className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao">
            {datas.map((d) => (
              <option key={d} value={d}>
                {dataBR(d)}
                {perfil && perfil.dia === d ? " · com perfil de geração" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {atual && (
        <div className="mt-3">
          <GraficoLinhas
            titulo={`PLD hora a hora em ${dataBR(atual.d)}${sm === "todos" ? ", quatro submercados" : `, ${SMS.find((s) => s.id === sm)?.rotulo}`}`}
            dados={dados}
            chaveX="x"
            series={series}
            unidade="R$/MWh"
            casas={2}
            formatoX="hora"
            altura={280}
            faixasX={FAIXAS}
            ensina={{
              texto: "Cada ponto é o PLD de uma hora, calculado pela CCEE na véspera para cada submercado. Valores nominais, horário de Brasília.",
              fonte: "CCEE, PLD_HORARIO",
              href: "/setor-eletrico/aprenda/pld",
              hrefRotulo: "Entenda o PLD",
            }}
          />
        </div>
      )}
      {leitura && (
        <dl className="mt-4 grid gap-px border border-linha bg-linha sm:grid-cols-3">
          <div className="bg-superficie p-3">
            <dt className="rotulo text-mineral">Hora mais cara ({leitura.nomeFoco})</dt>
            <dd className="mt-1 text-sm tabular-nums text-carvao">
              {leitura.max.h.slice(0, 2)}h · {reais(leitura.max.v)}/MWh
            </dd>
          </div>
          <div className="bg-superficie p-3">
            <dt className="rotulo text-mineral">Hora mais barata ({leitura.nomeFoco})</dt>
            <dd className="mt-1 text-sm tabular-nums text-carvao">
              {leitura.min.h.slice(0, 2)}h · {reais(leitura.min.v)}/MWh
            </dd>
          </div>
          <div className="bg-superficie p-3">
            <dt className="rotulo text-mineral">Regiões com preço diferente</dt>
            <dd className="mt-1 text-sm tabular-nums text-carvao">
              {leitura.horasDif === 0
                ? `nenhuma hora com diferença acima de ${reais(limiar)}/MWh`
                : `${leitura.horasDif} de 24 horas; maior diferença ${reais(leitura.maiorDif.v)}/MWh às ${leitura.maiorDif.h.slice(0, 2)}h`}
            </dd>
          </div>
        </dl>
      )}
      {perfil && (
        <div className="mt-5 border-t border-linha pt-4">
          {mesmoDia ? (
            <>
              <p className="text-sm text-carvao">
                <span className="rotulo mr-2 text-mineral">Mesmo dia, outra grandeza</span>
                Geração solar e eólica verificada do SIN em {dataBR(perfil.dia)}, hora a hora (ONS). As duas curvas ficam lado a lado para dar contexto;
                a coincidência de horários não estabelece relação de causa entre geração e preço.
              </p>
              <div className="mt-3">
                <GraficoLinhas
                  titulo={`Geração solar e eólica do SIN em ${dataBR(perfil.dia)}`}
                  dados={perfil.horas.map((h) => ({ x: h.h, solar: h.solar, eolica: h.eolica }))}
                  chaveX="x"
                  series={[
                    { id: "solar", rotulo: NOME_FONTE.solar, cor: COR_FONTE.solar, espessura: 2.5 },
                    { id: "eolica", rotulo: NOME_FONTE.eolica, cor: COR_FONTE.eolica, espessura: 2.5 },
                  ]}
                  unidade="MWmed"
                  casas={0}
                  formatoX="hora"
                  altura={200}
                  zeroNoEixo
                  faixasX={FAIXAS}
                />
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-mineral">
              O perfil horário de geração publicado nesta edição é de {dataBR(perfil.dia)}.{" "}
              {datas.includes(perfil.dia) ? (
                <button type="button" onClick={() => setDia(perfil.dia)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  Ver esse dia com as curvas de solar e eólica ao lado
                </button>
              ) : (
                "Esse dia não está entre os 30 dias de PLD horário desta publicação."
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
