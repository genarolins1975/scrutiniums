"use client";

import { useId, useMemo, useRef, useState } from "react";
import { num, plural } from "@/lib/energia/formato";
import { textoValor } from "@/lib/energia/distribuicao";
import {
  FUNDO_SEM_DADO,
  classeDe,
  estadoCelula,
  moveNaGrade,
  resumoGrade,
  rotulosClasses,
  validaEscala,
  validaMatriz,
  type EscalaCores,
  type Posicao,
  type ValorCelula,
} from "@/lib/energia/mapa-calor";

// só tipos: NAO_SE_APLICA vem de @/lib/energia/escalas (constante reexportada por módulo
// "use client" chega ao Server Component como referência de cliente, não como o texto)
export type { EscalaCores, ValorCelula } from "@/lib/energia/mapa-calor";

/**
 * Mapa de calor genérico (hora × dia, mês × ano): linhas, colunas e uma
 * matriz de valores, com escala de cores em classes definida pelo chamador
 * (sequencial ou divergente, sempre por variável CSS). Classes explícitas em
 * vez de gradiente contínuo: cada cor tem rótulo na legenda, e a leitura
 * "está na classe X" é a mesma na dica, na legenda e na tabela.
 *
 * A grade é uma tabela com papel de grid (WAI-ARIA): uma única parada de
 * Tab, setas nas duas dimensões, Home e End na linha, Ctrl+Home e Ctrl+End
 * nos cantos, Page Up e Page Down por semana. Cada célula leva o valor em
 * texto para leitor de tela; a dica aparece no foco, no toque e no ponteiro.
 *
 * Sem dado é hachura (a célula existe e o valor falta); "não se aplica" é
 * célula vazia com borda tracejada (a combinação não existe); zero é valor e
 * recebe a cor da sua classe. No celular a grade rola na horizontal dentro do
 * próprio componente, com rótulos de linha fixos; em ponteiro grosso as
 * células passam a 44 px. A altura vem só do CSS (sem medição), então o HTML
 * do servidor já tem o tamanho final.
 */
export type RotuloEixo = { id: string; rotulo: string; curto?: string };

export type MapaCalorProps = {
  titulo: string;
  linhas: RotuloEixo[];
  colunas: RotuloEixo[];
  /** Nome da dimensão das linhas e das colunas (ex.: "Dia" e "Hora"). */
  nomeLinhas: string;
  nomeColunas: string;
  /** valores[i][j]: linha i, coluna j. null = sem dado; NAO_SE_APLICA = combinação inexistente. */
  valores: ValorCelula[][];
  escala: EscalaCores;
  unidade: string;
  casas?: number;
  /** Mostra o rótulo visível de uma coluna a cada N (os demais seguem para leitor de tela). */
  passoRotuloColunas?: number;
  periodo?: string;
  nota?: string;
};

/** Acima disso a tabela equivalente só é montada ao abrir, para não pesar o HTML. */
const LIMITE_TABELA_MONTADA = 1500;

const ANEL =
  "outline outline-2 outline-offset-0 outline-carvao shadow-[inset_0_0_0_2px_var(--cor-superficie)]";

export function MapaCalor({
  titulo,
  linhas,
  colunas,
  nomeLinhas,
  nomeColunas,
  valores,
  escala,
  unidade,
  casas = 1,
  passoRotuloColunas = 1,
  periodo,
  nota,
}: MapaCalorProps) {
  const uid = useId().replace(/:/g, "");
  const envoltorio = useRef<HTMLDivElement>(null);
  const grade = useRef<HTMLTableElement>(null);
  const [foco, setFoco] = useState<Posicao>({ l: 0, c: 0 });
  const [ativo, setAtivo] = useState<(Posicao & { x: number; y: number; acima: boolean }) | null>(null);
  const [leitura, setLeitura] = useState("");
  const nL = linhas.length;
  const nC = colunas.length;
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const montarTabela = nL * nC <= LIMITE_TABELA_MONTADA || tabelaAberta;

  const rotulos = useMemo(() => rotulosClasses(escala, casas), [escala, casas]);
  const res = useMemo(() => resumoGrade(valores, escala.limites), [valores, escala.limites]);

  const erros = [...validaEscala(escala), ...validaMatriz(valores, nL, nC)];
  // dado publicado é estático: escala ou matriz inconsistente falha no build, não vira mapa errado
  if (erros.length) throw new Error(`MapaCalor "${titulo}": ${erros.join("; ")}`);

  function descreve(v: ValorCelula): { valor: string; classe: string } {
    const e = estadoCelula(v);
    if (e === "nao-se-aplica") return { valor: "não se aplica", classe: "combinação inexistente" };
    if (e === "sem-dado") return { valor: "sem dado", classe: "valor ausente na fonte" };
    return { valor: textoValor(v as number, casas, unidade), classe: `classe ${rotulos[classeDe(v, escala.limites) as number]}` };
  }

  function textoCelula(p: Posicao): string {
    const d = descreve(valores[p.l][p.c]);
    return `${linhas[p.l].rotulo}, ${colunas[p.c].rotulo}: ${d.valor}${estadoCelula(valores[p.l][p.c]) === "valor" ? ` (${d.classe})` : ""}.`;
  }

  function mostra(el: HTMLElement, p: Posicao, anunciar: boolean) {
    const env = envoltorio.current;
    if (!env) return;
    const er = env.getBoundingClientRect();
    const cr = el.getBoundingClientRect();
    const topo = cr.top - er.top;
    const acima = topo > 96;
    setAtivo({ ...p, x: cr.left - er.left + cr.width / 2, y: acima ? topo - 8 : topo + cr.height + 8, acima });
    if (anunciar) setLeitura(textoCelula(p));
  }

  function teclado(ev: React.KeyboardEvent<HTMLTableElement>) {
    if (ev.key === "Escape") {
      setAtivo(null);
      return;
    }
    const prox = moveNaGrade(foco, ev.key, nL, nC, ev.ctrlKey || ev.metaKey);
    if (!prox) return;
    ev.preventDefault();
    setFoco(prox);
    // o foco real vai para a célula (tabindex móvel): o leitor de tela lê cabeçalhos e valor
    grade.current?.querySelector<HTMLElement>(`[data-l="${prox.l}"][data-c="${prox.c}"]`)?.focus();
  }

  const va = ativo ? valores[ativo.l][ativo.c] : undefined;
  const da = ativo ? descreve(va) : null;

  return (
    <div ref={envoltorio} className="relative w-full min-w-0">
      <div className="mb-3">
        <p className="rotulo text-mineral">
          Escala em {unidade}
          {escala.tipo === "divergente" && typeof escala.centro === "number" ? `, centro em ${textoValor(escala.centro, casas, unidade)}` : ""}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-carvao-muted" aria-label={`Legenda: classes em ${unidade}`}>
          {rotulos.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: escala.cores[i] }} />
              {r}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: FUNDO_SEM_DADO }} />
            sem dado
          </li>
          {res.naoSeAplica > 0 && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-5 border border-dashed border-mineral bg-superficie" />
              não se aplica
            </li>
          )}
        </ul>
      </div>

      {/* rolagem horizontal contida aqui: a página nunca transborda */}
      <div className="tabela-scroll max-w-full" onScroll={() => setAtivo(null)}>
        <table
          ref={grade}
          role="grid"
          aria-readonly="true"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-r`}
          onKeyDown={teclado}
          onPointerLeave={(ev) => {
            if (ev.pointerType === "mouse") setAtivo(null);
          }}
          onBlur={(ev) => {
            if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setAtivo(null);
          }}
          className="w-full min-w-[calc(4.5rem_+_var(--mc-colunas)_*_2rem)] table-fixed border-separate border-spacing-0.5 text-xs [@media(pointer:coarse)]:min-w-[calc(4.5rem_+_var(--mc-colunas)_*_2.875rem)]"
          style={{ "--mc-colunas": nC } as React.CSSProperties}
        >
          <caption id={`${uid}-t`} className="sr-only">
            {`${titulo}. ${nomeLinhas} nas linhas e ${nomeColunas.toLowerCase()} nas colunas, em ${unidade}. Use as setas para mover entre as células.`}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[4.5rem] bg-superficie pr-2 text-right align-bottom font-normal text-mineral">
                <span aria-hidden="true">{nomeLinhas}</span>
                <span className="sr-only">{`${nomeLinhas} por ${nomeColunas.toLowerCase()}`}</span>
              </th>
              {colunas.map((c, j) => (
                <th key={c.id} scope="col" className="h-6 overflow-hidden whitespace-nowrap px-0 text-center align-bottom font-normal text-mineral">
                  {j % Math.max(1, passoRotuloColunas) === 0 && <span aria-hidden="true">{c.curto ?? c.rotulo}</span>}
                  <span className="sr-only">{c.rotulo}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((lin, i) => (
              <tr key={lin.id}>
                <th scope="row" className="sticky left-0 z-10 truncate whitespace-nowrap bg-superficie pr-2 text-right font-normal text-carvao-muted">
                  <span aria-hidden="true">{lin.curto ?? lin.rotulo}</span>
                  <span className="sr-only">{lin.rotulo}</span>
                </th>
                {colunas.map((col, j) => {
                  const v = valores[i][j];
                  const e = estadoCelula(v);
                  const k = classeDe(v, escala.limites);
                  const d = descreve(v);
                  const eAtivo = ativo?.l === i && ativo?.c === j;
                  const fundo = e === "valor" ? escala.cores[k as number] : e === "sem-dado" ? FUNDO_SEM_DADO : undefined;
                  return (
                    <td
                      key={col.id}
                      role="gridcell"
                      tabIndex={foco.l === i && foco.c === j ? 0 : -1}
                      data-l={i}
                      data-c={j}
                      data-estado={e}
                      data-classe={k ?? undefined}
                      style={fundo ? { background: fundo } : undefined}
                      onFocus={(ev) => {
                        setFoco({ l: i, c: j });
                        mostra(ev.currentTarget, { l: i, c: j }, false);
                      }}
                      onPointerEnter={(ev) => {
                        if (ev.pointerType === "mouse") mostra(ev.currentTarget, { l: i, c: j }, true);
                      }}
                      onPointerDown={(ev) => {
                        if (ev.pointerType !== "mouse") mostra(ev.currentTarget, { l: i, c: j }, false);
                      }}
                      className={`relative h-7 p-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-carvao focus-visible:shadow-[inset_0_0_0_2px_var(--cor-superficie)] [@media(pointer:coarse)]:h-11 ${
                        e === "nao-se-aplica" ? "border border-dashed border-mineral bg-superficie" : ""
                      } ${eAtivo ? ANEL : ""}`}
                    >
                      <span className="sr-only">{e === "valor" ? `${d.valor}, ${d.classe}` : d.valor}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ativo && da && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-30 min-w-[11rem] max-w-[16rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
          style={{
            left: `min(max(0px, ${ativo.x}px - 5.5rem), calc(100% - 11rem))`,
            top: ativo.y,
            transform: ativo.acima ? "translateY(-100%)" : undefined,
          }}
        >
          <p className="rotulo text-mineral">
            {linhas[ativo.l].rotulo} · {colunas[ativo.c].rotulo}
          </p>
          <p className="mt-1 tabular-nums text-carvao">{da.valor}</p>
          <p className="text-carvao-muted">{da.classe}</p>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      <div id={`${uid}-r`} className="mt-3 space-y-1 border-t border-linha pt-2 text-xs leading-relaxed text-carvao-muted">
        <p className="tabular-nums">
          {plural(res.celulas, "célula", "células")}: {num(res.comValor, 0)} com valor
          {res.semDado > 0 && <span data-sem-dado={res.semDado}>, {num(res.semDado, 0)} sem dado (hachuradas)</span>}
          {res.naoSeAplica > 0 && `, ${num(res.naoSeAplica, 0)} não se aplica (borda tracejada)`}
          {res.min !== null && res.max !== null && `. Valores de ${textoValor(res.min, casas, unidade)} a ${textoValor(res.max, casas, unidade)}`}.
        </p>
        {periodo && (
          <p>
            <span className="rotulo mr-2 text-mineral">Período</span>
            {periodo}
          </p>
        )}
        <p>
          Cada classe inclui o limite inferior. Setas movem entre células; Home e End vão ao início e ao fim da linha; Ctrl+Home e Ctrl+End, aos cantos.
        </p>
        {nota && <p>{nota}</p>}
      </div>

      <details className="mt-3 text-xs" onToggle={(e) => setTabelaAberta((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({plural(nL, "linha", "linhas")})
        </summary>
        {montarTabela && (
          <div className="tabela-scroll mt-2 max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
            <table className="w-full border-collapse tabular-nums">
              <caption className="sr-only">{`${titulo}, em ${unidade}`}</caption>
              <thead className="sticky top-0 bg-superficie">
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{nomeLinhas}</th>
                  {colunas.map((c) => (
                    <th key={c.id} scope="col" className="whitespace-nowrap border-b border-linha px-2 py-1.5 font-medium">
                      {c.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((lin, i) => (
                  <tr key={lin.id} className="border-b border-linha">
                    <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-normal text-carvao">{lin.rotulo}</th>
                    {colunas.map((c, j) => {
                      const v = valores[i][j];
                      const e = estadoCelula(v);
                      return (
                        <td key={c.id} className={`whitespace-nowrap px-2 py-1 ${e === "valor" ? "text-carvao" : "text-mineral"}`}>
                          {e === "valor" ? num(v as number, casas) : e === "sem-dado" ? "sem dado" : "não se aplica"}
                        </td>
                      );
                    })}
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
