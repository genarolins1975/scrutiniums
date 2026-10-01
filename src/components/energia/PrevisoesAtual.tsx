"use client";

import { useMemo } from "react";
import { Comparador, type ContextoComparador } from "@/components/energia/Comparador";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { dominioBonito, escalaLinear, rotuloTick } from "@/lib/energia/escalas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { CURTO_SM, NOME_SM, dataBR, num } from "@/lib/energia/formato";
import {
  COLUNAS_GRADE,
  COR_SM,
  HORIZONTES,
  SUBMERCADOS,
  descreverHorizonte,
  matrizGrade,
  reaisMWh,
  textoPublicadoNoCorte,
  type LinhaGrade,
} from "@/lib/energia/previsoes";
import type { Submercado } from "@/lib/energia/tipos";
import type { Horizonte, PublicadoNoCorte } from "@/lib/energia/tipos-previsoes";

/**
 * P013, previsão atual: a grade 4 × 7 da rodada mais recente (submercado ×
 * horizonte), em pequenos múltiplos na mesma escala e em tabela, os números de
 * destaque do submercado escolhido com a prova de cada um, e o detalhe da célula.
 *
 * Estado na URL: `sm` (submercado) e `h` (horizonte) escolhem a célula; clicar no
 * painel, na grade compacta ou numa linha da tabela muda os três (o voltar
 * desfaz). `sms` guarda os submercados comparados (até quatro, padrão: todos).
 *
 * Nada é recalculado aqui: os números e as frases chegam prontos da gold (linhas
 * de linhasGrade, evidências do pipeline). Célula sem número é desenhada como
 * ausência hachurada, nunca em zero; sem faixa calibrada, nenhuma banda é
 * desenhada.
 */

const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado, { param: "sm" }),
  h: campo(tiposUrl.opcao(HORIZONTES), "W1" as Horizonte, { param: "h" }),
};

export type PublicadoResumo = Pick<PublicadoNoCorte, "origem" | "submercados">;

export function PrevisoesAtual({
  linhas,
  origem,
  evidencias,
  publicado,
  fonte,
  versao,
  endereco,
}: {
  linhas: LinhaGrade[];
  /** Dia de origem da rodada (o corte é às 07h dele). */
  origem: string;
  evidencias: Record<string, Evidencia>;
  publicado: PublicadoResumo | null;
  fonte: string;
  versao: string;
  endereco: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sel = linhas.find((l) => l.submercado === v.sm && l.horizonte === v.h) ?? null;
  const doSm = linhas.filter((l) => l.submercado === v.sm);
  const semanal = doSm.find((l) => l.horizonte.startsWith("W") && l.evidencia);
  const mensal = doSm.find((l) => l.horizonte.startsWith("M") && l.evidencia);
  const pubSm = publicado?.submercados[v.sm] ?? null;
  const evPub = pubSm?.evidencia ? evidencias[pubSm.evidencia] : undefined;
  const matriz = matrizGrade(linhas);
  const entidades = useMemo(
    () =>
      SUBMERCADOS.filter((sm) => linhas.some((l) => l.submercado === sm)).map((sm) => ({
        id: sm,
        rotulo: NOME_SM[sm],
        detalhe: CURTO_SM[sm],
        sinonimos: [sm, CURTO_SM[sm]],
      })),
    [linhas],
  );
  const selecionar = (sm: Submercado, h?: Horizonte) => definir(h ? { sm, h } : { sm });

  const grupo = (freq: "W" | "M") => doSm.filter((l) => l.horizonte.startsWith(freq));
  const periodoGrupo = (freq: "W" | "M") => {
    const g = grupo(freq);
    return g.length ? `${g[0].horizonte} a ${g[g.length - 1].horizonte}: ${dataBR(g[0].inicio)} a ${dataBR(g[g.length - 1].fim)}` : "";
  };
  const usado = (l: LinhaGrade | undefined) =>
    l?.periodo_inicio && l.periodo_fim ? `Repete a média de ${dataBR(l.periodo_inicio)} a ${dataBR(l.periodo_fim)}, o último período completo elegível no corte.` : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Submercado</span>
          <select
            value={v.sm}
            onChange={(e) => selecionar(e.currentTarget.value as Submercado)}
            className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
          >
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Horizonte</span>
          <select
            value={v.h}
            onChange={(e) => definir({ h: e.currentTarget.value as Horizonte })}
            className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
          >
            {HORIZONTES.map((h) => (
              <option key={h} value={h}>
                {h}: {descreverHorizonte(h)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-celula={sel?.id ?? ""}>
        {sel ? textoCelula(sel) : "Esta combinação de submercado e horizonte não está na rodada."}
      </p>

      <div className="grid gap-4 sm:grid-cols-3" data-kpis={v.sm}>
        <Numero
          rotulo={`B0 semanal, ${CURTO_SM[v.sm]}`}
          natureza="PREVISTO"
          valor={semanal?.previsao ?? null}
          evidencia={semanal?.evidencia ? evidencias[semanal.evidencia] : undefined}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={periodoGrupo("W")}
          nota={usado(semanal)}
          motivoAusencia="A rodada não tem número semanal para este submercado; o motivo está na tabela."
          cor={COR_SM[v.sm]}
          tamanho="medio"
          endereco={endereco}
        />
        <Numero
          rotulo={`B0 mensal, ${CURTO_SM[v.sm]}`}
          natureza="PREVISTO"
          valor={mensal?.previsao ?? null}
          evidencia={mensal?.evidencia ? evidencias[mensal.evidencia] : undefined}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={periodoGrupo("M")}
          nota={usado(mensal)}
          motivoAusencia="A rodada não tem número mensal para este submercado; o motivo está na tabela."
          cor={COR_SM[v.sm]}
          tamanho="medio"
          endereco={endereco}
        />
        <Numero
          rotulo={`PLD já publicado no corte, ${CURTO_SM[v.sm]}`}
          natureza="OBSERVADO"
          valor={pubSm?.media ?? null}
          evidencia={evPub}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={pubSm?.primeira && pubSm.ultima ? `${dataBR(publicado?.origem)}, ${pubSm.primeira.slice(11, 13)}h a ${pubSm.ultima.slice(11, 13)}h` : undefined}
          nota="Média simples das horas do dia de origem depois do corte, já publicadas pela CCEE. É dado, não previsão."
          motivoAusencia="Nenhuma hora do dia de origem depois do corte estava capturada."
          tamanho="medio"
          endereco={endereco}
        />
      </div>
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{textoPublicadoNoCorte(publicado, v.sm)}</p>

      <Comparador
        rotulo="Submercados para comparar (até 4)"
        entidades={entidades}
        padrao={entidades.map((e) => e.id)}
        chaveUrl="sms"
        valores={(id) => [...linhas.filter((l) => l.submercado === id).flatMap((l) => [l.previsao, l.piso])]}
        unidade="R$/MWh"
        dicaBusca="SE/CO, Sul, Nordeste ou Norte"
        vazio="Nenhum submercado escolhido. Escolha até quatro para ver a grade de cada um na mesma escala."
        renderizarItem={(e, ctx) => (
          <GradeSubmercado
            sm={e.id as Submercado}
            origem={origem}
            linhas={linhas.filter((l) => l.submercado === e.id)}
            ctx={ctx}
            selecionado={v.sm === e.id}
            horizonte={v.h}
            onSelecionar={(h) => selecionar(e.id as Submercado, h)}
          />
        )}
      />

      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Grade 4 × 7 da referência B0 (rolável)">
        <table className="w-full min-w-[34rem] border-collapse text-sm tabular-nums" data-grade="4x7">
          <caption className="pb-2 text-left text-xs text-carvao-muted">
            Grade 4 × 7: referência B0 por submercado e horizonte, em R$/MWh. Os mesmos números da tabela completa abaixo e dos painéis acima. Escolha uma célula para ver o
            detalhe.
          </caption>
          <thead>
            <tr className="text-left text-xs text-mineral">
              <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                Submercado
              </th>
              {HORIZONTES.map((h) => (
                <th key={h} scope="col" className="border-b border-linha px-2 py-2 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((r) => (
              <tr key={r.submercado}>
                <th scope="row" className="border-b border-linha px-2 py-1 text-left font-normal text-carvao">
                  {CURTO_SM[r.submercado]}
                </th>
                {r.valores.map((x, i) => {
                  const h = HORIZONTES[i];
                  const ativo = v.sm === r.submercado && v.h === h;
                  return (
                    <td key={h} className="border-b border-linha p-0 text-right">
                      <button
                        type="button"
                        onClick={() => selecionar(r.submercado, h)}
                        aria-pressed={ativo}
                        aria-label={`${h}, ${NOME_SM[r.submercado]}: ${x === null ? "sem número" : reaisMWh(x)}`}
                        className={`min-h-[44px] w-full px-2 text-right ${ativo ? "bg-energia-fundo font-medium text-carvao" : "text-carvao hover:bg-papel"}`}
                      >
                        {x === null ? "sem número" : num(x, 2)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TabelaInterativa
        titulo="Células da rodada: referência B0, faixa, limites e período usado"
        colunas={COLUNAS_GRADE}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="sm"
        fonte={fonte}
        versao={versao}
        nomeArquivo="previsoes-pld-rodada-atual"
        chaveUrl="grade"
        selecionado={sel?.id ?? null}
        onSelecionar={(id) => {
          const l = linhas.find((x) => x.id === id);
          if (l) selecionar(l.submercado, l.horizonte);
        }}
        dicaBusca="Submercado, horizonte ou entrega"
        nota="P10 e P90 vazios: nenhuma faixa publicada, porque nenhum segmento está calibrado. Último dia e fim do período usado são os últimos dias inteiros (o fim da entrega, às 00h do dia seguinte, fica excluído)."
      />
    </div>
  );
}

/** Frase do detalhe da célula escolhida, só com campos da linha. */
function textoCelula(l: LinhaGrade): string {
  const entrega = `${l.horizonte} (${descreverHorizonte(l.horizonte)}), ${NOME_SM[l.submercado]}: entrega ${l.entrega}, de ${dataBR(l.inicio)} a ${dataBR(l.fim)}.`;
  if (l.previsao === null) return `${entrega} Sem número: ${l.motivo || "motivo não registrado"}.`;
  const usado = l.periodo_inicio && l.periodo_fim ? `, média do PLD de ${dataBR(l.periodo_inicio)} a ${dataBR(l.periodo_fim)}` : "";
  const faixa = l.p10 !== null && l.p90 !== null ? `Faixa P10 a P90: ${reaisMWh(l.p10)} a ${reaisMWh(l.p90)}.` : `Sem faixa (calibração: ${l.calibracao}).`;
  const lim = l.piso !== null && l.teto !== null ? ` Limites médios da entrega: piso ${reaisMWh(l.piso)} e teto estrutural ${reaisMWh(l.teto)} (${l.limites}).` : "";
  const aj = l.ajustada === "sim" ? " O valor foi ajustado ao limite de preço." : "";
  return `${entrega} Referência B0: ${reaisMWh(l.previsao)}${usado}. ${faixa}${lim}${aj}`;
}

/* ---------------------------------------------------------------- pequeno múltiplo */

const L = 360;
const A = 196;
const M = { e: 46, d: 10, t: 16, b: 36 };
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dia = (s: string) => Date.parse(`${s}T12:00:00Z`) / 86_400_000;

/**
 * Uma entrega é um segmento horizontal do primeiro ao último dia, na altura do
 * número previsto: a previsão vale para a média do período, não para cada dia. À
 * esquerda do corte, em cinza, o período que o B0 repete (dado observado). O piso
 * médio é a referência pontilhada. Valores escritos diretamente no gráfico; a
 * tabela abaixo tem os mesmos números.
 */
function GradeSubmercado({
  sm,
  origem,
  linhas,
  ctx,
  selecionado,
  horizonte,
  onSelecionar,
}: {
  sm: Submercado;
  origem: string;
  linhas: LinhaGrade[];
  ctx: ContextoComparador;
  selecionado: boolean;
  horizonte: Horizonte;
  onSelecionar: (h?: Horizonte) => void;
}) {
  const dom = ctx.dominio ?? dominioBonito(linhas.flatMap((l) => [l.previsao, l.piso]));
  const y = escalaLinear([dom.min, dom.max], [A - M.b, M.t]);
  const inicios = linhas.flatMap((l) => [l.periodo_inicio, l.inicio]).filter((x): x is string => !!x);
  const fins = linhas.map((l) => l.fim);
  if (!inicios.length || !fins.length) return null;
  const x0 = Math.min(...inicios.map(dia));
  const x1 = Math.max(...fins.map(dia)) + 1;
  const x = escalaLinear([x0, x1], [M.e, L - M.d]);
  const piso = linhas.find((l) => l.piso !== null)?.piso ?? null;
  // corte às 07h do dia de origem
  const corte = origem ? dia(origem) + 7 / 24 - 0.5 : null;
  const meses: { x: number; rotulo: string }[] = [];
  {
    // dia 1º de cada mês dentro do eixo (inclusive o do início, quando o eixo começa nele)
    const d = new Date(x0 * 86_400_000);
    d.setUTCDate(1);
    if (d.getTime() / 86_400_000 < x0 - 1e-6) d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() / 86_400_000 < x1 - 1) {
      meses.push({ x: x(d.getTime() / 86_400_000), rotulo: `${MESES_CURTOS[d.getUTCMonth()]}${d.getUTCMonth() === 0 ? `/${String(d.getUTCFullYear()).slice(2)}` : ""}` });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  const grupos = (["W", "M"] as const).map((f) => linhas.filter((l) => l.horizonte.startsWith(f)));
  const usados = new Map<string, { inicio: string; fim: string; valor: number; freq: string }>();
  for (const g of grupos)
    for (const l of g)
      if (l.periodo_inicio && l.periodo_fim && l.previsao !== null && !usados.has(`${l.periodo_inicio}:${l.periodo_fim}`))
        usados.set(`${l.periodo_inicio}:${l.periodo_fim}`, { inicio: l.periodo_inicio, fim: l.periodo_fim, valor: l.previsao, freq: l.horizonte[0] });
  const descricao = grupos
    .filter((g) => g.length)
    .map((g) => {
      const vals = Array.from(new Set(g.map((l) => (l.previsao === null ? "sem número" : reaisMWh(l.previsao)))));
      return `${g[0].horizonte.startsWith("W") ? "semanas" : "meses"} de ${dataBR(g[0].inicio)} a ${dataBR(g[g.length - 1].fim)}: ${vals.join(", ")}`;
    })
    .join("; ");
  const idTitulo = `grade-${sm}-titulo`;
  const idDesc = `grade-${sm}-desc`;
  const cor = COR_SM[sm];

  return (
    <figure className={`min-w-0 border bg-superficie p-3 ${selecionado ? "border-energia" : "border-linha"}`} data-grade-sm={sm}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-serif text-base text-carvao">{NOME_SM[sm]}</span>
        <button
          type="button"
          onClick={() => onSelecionar()}
          aria-pressed={selecionado}
          className={`rotulo inline-flex min-h-[44px] items-center px-2 ${selecionado ? "text-carvao" : "text-carvao-muted underline underline-offset-4 hover:text-carvao"}`}
        >
          {selecionado ? "Submercado escolhido" : `Escolher ${CURTO_SM[sm]}`}
        </button>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" role="img" aria-labelledby={`${idTitulo} ${idDesc}`} className="mt-1 block h-auto max-w-full overflow-visible">
        <title id={idTitulo}>{`Referência B0 por entrega, ${NOME_SM[sm]}`}</title>
        <desc id={idDesc}>{`${descricao}${piso !== null ? `; piso médio ${reaisMWh(piso)}` : ""}.`}</desc>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} stroke="var(--cor-grade)" strokeWidth={1} />
            <text x={M.e - 4} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--cor-mineral)">
              {rotuloTick(t, dom.passo)}
            </text>
          </g>
        ))}
        {meses.map((m) => (
          <text key={m.rotulo + m.x} x={m.x} y={A - M.b + 14} fontSize={11} fill="var(--cor-mineral)">
            {m.rotulo}
          </text>
        ))}
        <text x={M.e} y={A - 6} fontSize={11} fill="var(--cor-mineral)">
          R$/MWh por entrega
        </text>
        {piso !== null && (
          <g>
            <line x1={M.e} x2={L - M.d} y1={y(piso)} y2={y(piso)} stroke="var(--serie-referencia)" strokeWidth={1.5} strokeDasharray="2 3" />
            <text x={L - M.d} y={y(piso) - 4} textAnchor="end" fontSize={11} fill="var(--cor-carvao-muted)">
              piso médio {num(piso, 2)}
            </text>
          </g>
        )}
        {corte !== null && (
          <g>
            <line x1={x(corte)} x2={x(corte)} y1={M.t - 6} y2={A - M.b} stroke="var(--cor-carvao-muted)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={x(corte) - 3} y={M.t - 6} textAnchor="end" fontSize={11} fill="var(--cor-carvao-muted)">
              {`corte ${dataBR(origem).slice(0, 5)}`}
            </text>
          </g>
        )}
        {Array.from(usados.values()).map((u) => (
          <g key={`${u.inicio}:${u.fim}`}>
            <line x1={x(dia(u.inicio))} x2={x(dia(u.fim) + 1)} y1={y(u.valor)} y2={y(u.valor)} stroke="var(--cor-mineral)" strokeWidth={3} />
            <title>{`Período usado pelo B0 ${u.freq === "W" ? "semanal" : "mensal"}: ${dataBR(u.inicio)} a ${dataBR(u.fim)}, média ${reaisMWh(u.valor)} (observado)`}</title>
          </g>
        ))}
        {grupos.map((g) =>
          g.map((l) => {
            const xa = x(dia(l.inicio));
            const xb = x(dia(l.fim) + 1);
            const ativo = selecionado && l.horizonte === horizonte;
            if (l.previsao === null)
              return (
                <g key={l.id}>
                  <rect x={xa} y={A - M.b - 8} width={Math.max(6, xb - xa - 1)} height={8} fill="none" stroke="var(--cor-mineral)" strokeDasharray="2 2" />
                  <title>{`${l.horizonte}: sem número (${l.motivo || "motivo não registrado"})`}</title>
                </g>
              );
            const mensal = l.horizonte.startsWith("M");
            return (
              <g key={l.id}>
                <line
                  x1={xa + 0.5}
                  x2={xb - 0.5}
                  y1={y(l.previsao)}
                  y2={y(l.previsao)}
                  stroke={cor}
                  strokeWidth={ativo ? 5 : 3}
                  strokeDasharray={mensal ? "6 3" : undefined}
                />
                <title>{`${l.horizonte}, ${dataBR(l.inicio)} a ${dataBR(l.fim)}: ${reaisMWh(l.previsao)}`}</title>
              </g>
            );
          }),
        )}
        {grupos.map((g, gi) => {
          const comNumero = g.filter((l) => l.previsao !== null);
          if (!comNumero.length) return null;
          const iguais = comNumero.every((l) => Math.abs((l.previsao as number) - (comNumero[0].previsao as number)) < 0.005);
          const mensal = g[0].horizonte.startsWith("M");
          const ult = comNumero[comNumero.length - 1];
          const pri = comNumero[0];
          const yv = y(pri.previsao as number);
          // o grupo de valor mais alto leva o rótulo acima da linha; o outro, abaixo (não cruzam as linhas vizinhas)
          const outro = grupos[1 - gi].find((l) => l.previsao !== null)?.previsao ?? null;
          const acima = outro !== null && (pri.previsao as number) < outro ? yv + 13 : yv - 6;
          return iguais ? (
            <text key={g[0].horizonte} x={mensal ? x(dia(ult.fim) + 1) : x(dia(pri.inicio))} y={acima} textAnchor={mensal ? "end" : "start"} fontSize={11.5} fill="var(--cor-carvao)">
              {`${pri.horizonte} a ${ult.horizonte}: ${num(pri.previsao as number, 2)}`}
            </text>
          ) : (
            comNumero.map((l) => (
              <text key={l.id} x={(x(dia(l.inicio)) + x(dia(l.fim) + 1)) / 2} y={y(l.previsao as number) - 6} textAnchor="middle" fontSize={10.5} fill="var(--cor-carvao)">
                {num(l.previsao as number, 0)}
              </text>
            ))
          );
        })}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted">
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[3px] w-5 align-middle" style={{ background: cor }} />
          semanas (W1 a W4)
        </span>
        <span>
          <span aria-hidden="true" className="mr-1 inline-block w-5 border-t-2 border-dashed align-middle" style={{ borderColor: cor }} />
          meses (M1 a M3)
        </span>
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[3px] w-5 bg-mineral align-middle" />
          período que o B0 repete
        </span>
      </p>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={`Horizontes de ${NOME_SM[sm]}`}>
        {linhas.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onSelecionar(l.horizonte)}
            aria-pressed={selecionado && l.horizonte === horizonte}
            className={`min-h-[44px] min-w-[44px] border px-1 text-xs tabular-nums ${
              selecionado && l.horizonte === horizonte ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted hover:border-energia hover:text-carvao"
            }`}
          >
            {l.horizonte}
          </button>
        ))}
      </div>
    </figure>
  );
}
