"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { dominioBonito, escalaLinear, rotuloTick, type Dominio } from "@/lib/energia/escalas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR as dataBRBase, dataCurta, nomeSubmercado, num as numBase, reais as reaisBase } from "@/lib/energia/formato";
import { tx as txBase } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import {
  colunasGrade,
  COR_SM,
  HORIZONTES,
  SUBMERCADOS,
  descreverHorizonte,
  matrizGrade,
  resumoB0,
  reaisMWh as reaisMWhBase,
  textoPublicadoNoCorte,
  type LinhaGrade,
} from "@/lib/energia/previsoes";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { Frequencia, Horizonte, PublicadoNoCorte } from "@/lib/energia/tipos-previsoes";

/**
 * Rodada mais recente do B0 (referência experimental): a figura por entrega em dois painéis por submercado (semanas e meses, cada um
 * com o seu eixo de tempo e a mesma escala de preço), a grade 4 × 7 em tabela, as notas do painel, a escolha de até quatro
 * submercados, o detalhe de uma célula com a prova de cada número, o PLD já publicado no corte (dado observado, em seção própria) e
 * a tabela completa das células.
 *
 * Estado na URL: `sm` (submercado) e `h` (horizonte) escolhem a célula; clicar no painel, na grade ou numa linha da tabela muda os
 * três (o voltar desfaz). `sms` guarda os submercados exibidos (até quatro, padrão: todos).
 *
 * Nada é recalculado aqui: os números e as frases chegam prontos da gold (linhas de linhasGrade, evidências do pipeline). Célula sem
 * número é desenhada como ausência hachurada, nunca em zero; sem faixa calibrada, nenhuma banda é desenhada; o realizado só aparece
 * quando a entrega termina.
 */

const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado, { param: "sm" }),
  h: campo(tiposUrl.opcao(HORIZONTES), "W1" as Horizonte, { param: "h" }),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(SUBMERCADOS), { max: LIMITE_COMPARACAO }), [...SUBMERCADOS] as Submercado[], { param: "sms" }),
};

export type PublicadoResumo = Pick<PublicadoNoCorte, "origem" | "submercados">;

/** Formatadores no idioma da página, para as peças deste painel. */
function formatos(idioma: Idioma) {
  return {
    dataBR: (iso: string | null | undefined) => dataBRBase(iso, idioma),
    /** "03/10" no português, "Oct 3" no inglês. */
    diaMes: (iso: string) => (idioma === "en" ? dataCurta(iso, "en") : dataBRBase(iso, "pt").slice(0, 5)),
    num: (v: number | null | undefined, casas = 1) => numBase(v, casas, idioma),
    reais: (v: number | null | undefined) => reaisBase(v, 2, idioma),
    reaisMWh: (v: number | null | undefined) => reaisMWhBase(v, 2, idioma),
    nome: (sm: string) => nomeSubmercado(sm, idioma),
    curto: (sm: string) => nomeSubmercado(sm, idioma, true),
    tx: <T,>(pt: T, en: T) => txBase(pt, en, idioma),
  };
}

export function PrevisoesAtual({
  linhas,
  origem,
  evidencias,
  publicado,
  fonte,
  versao,
  endereco,
  mediaDiaPaginaPld,
  resposta,
  recorte,
  notas,
  aposPrincipal,
  noCorteGrafico,
  avaliacao,
}: {
  linhas: LinhaGrade[];
  /** Dia de origem da rodada (o corte é às 07h dele). */
  origem: string;
  evidencias: Record<string, Evidencia>;
  publicado: PublicadoResumo | null;
  fonte: string;
  versao: string;
  endereco: string;
  /** Média das 24 horas do dia de origem que a página PLD mostra (pld.json), por submercado; null quando o dia da página PLD não é o da rodada. */
  mediaDiaPaginaPld?: Partial<Record<Submercado, number | null>> | null;
  /** Resposta curta do painel (PrevisoesResposta com `depois`), logo depois da figura principal: a faixa de métricas já traz os números e a figura sobe para a primeira tela. */
  resposta?: ReactNode;
  /** Período, universo e unidade do painel (PrevisoesRecorte), logo depois da figura principal e da grade. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois do recorte. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
  /** Gráfico do PLD já publicado no corte (servidor), dentro da seção do dado observado. */
  noCorteGrafico?: ReactNode;
  /** Seção de avaliação depois do resultado (servidor), entre o dado observado e a tabela completa. */
  avaliacao?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, num, reais, reaisMWh, nome, curto } = formatos(idioma);
  const sel = linhas.find((l) => l.submercado === v.sm && l.horizonte === v.h) ?? null;
  const semanal = resumoB0(linhas, v.sm, "W", idioma);
  const mensal = resumoB0(linhas, v.sm, "M", idioma);
  const pubSm = publicado?.submercados[v.sm] ?? null;
  const evPub = pubSm?.evidencia ? evidencias[pubSm.evidencia] : undefined;
  const matriz = matrizGrade(linhas);
  const entidades = useMemo(
    () =>
      SUBMERCADOS.filter((sm) => linhas.some((l) => l.submercado === sm)).map((sm) => ({
        id: sm,
        rotulo: nomeSubmercado(sm, idioma),
        detalhe: nomeSubmercado(sm, idioma, true),
        sinonimos: [sm, nomeSubmercado(sm, idioma, true), nomeSubmercado(sm, "pt")],
      })),
    [linhas, idioma],
  );
  const selecionar = (sm: Submercado, h?: Horizonte) => definir(h ? { sm, h } : { sm });
  const escolhidos = useMemo(() => v.sms.filter((sm) => entidades.some((e) => e.id === sm)), [v.sms, entidades]);
  // mesma escala de preço em todos os painéis: o domínio sai dos números e do piso de todos os submercados exibidos
  const dom = useMemo(
    () => dominioBonito(escolhidos.flatMap((sm) => linhas.filter((l) => l.submercado === sm).flatMap((l) => [l.previsao, l.piso]))),
    [escolhidos, linhas],
  );
  const algumRealizado = linhas.some((l) => l.realizado !== null);

  return (
    <div className="space-y-6">
      <section aria-labelledby="rodada-figura-titulo" className="space-y-3" data-figura-rodada="">
        <h3 id="rodada-figura-titulo" className="ed-h3 font-serif text-carvao">
          {tx("Referência B0 por entrega, nos submercados escolhidos", "B0 benchmark by delivery, in the chosen submarkets")}
        </h3>
        {escolhidos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {escolhidos.map((sm) => (
              <GradeSubmercado
                key={sm}
                sm={sm}
                origem={origem}
                linhas={linhas.filter((l) => l.submercado === sm)}
                dom={dom}
                selecionado={v.sm === sm}
                horizonte={v.h}
                onSelecionar={(h) => selecionar(sm, h)}
                idioma={idioma}
              />
            ))}
          </div>
        ) : (
          <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
            {tx(
              "Nenhum submercado escolhido. Escolha até quatro, mais abaixo, para ver a referência de cada um na mesma escala.",
              "No submarket chosen. Choose up to four, further down, to see the benchmark of each on the same scale.",
            )}
          </p>
        )}
        <p className="text-xs text-carvao-muted" data-escala="">
          {tx(
            `Mesma escala de preço em todos os painéis: ${num(dom.min, 0)} a ${num(dom.max, 0)} R$/MWh. Semanas e meses têm eixos de tempo próprios.`,
            `Same price scale in all panels: ${num(dom.min, 0)} to ${num(dom.max, 0)} R$/MWh. Weeks and months have their own time axes.`,
          )}
        </p>
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          {tx(
            "Em cada painel, um traço horizontal por entrega, do primeiro ao último dia, na altura do número previsto: contínuo para as semanas, tracejado para os meses. À esquerda do corte, em cinza, o período que o B0 repete (dado observado). A linha pontilhada é o piso médio do PLD na entrega.",
            "In each panel, one horizontal stroke per delivery, from the first to the last day, at the height of the forecast number: solid for weeks, dashed for months. To the left of the cutoff, in gray, the period that B0 repeats (observed data). The dotted line is the average PLD floor in the delivery.",
          )}{" "}
          {algumRealizado
            ? tx(
                "O losango é o realizado da entrega, o PLD médio de todas as horas, que só existe depois que ela termina.",
                "The diamond is the actual value of the delivery, the average PLD of all its hours, which only exists after it ends.",
              )
            : tx(
                "Nenhuma entrega prevista terminou: o realizado aparece nestes painéis, como um losango, quando a entrega fecha.",
                "No forecast delivery has ended: the actual value appears in these panels, as a diamond, when the delivery closes.",
              )}
        </p>
      </section>

      {resposta}

      <div className="space-y-2" data-grade-bloco="">
        {/* a legenda fica fora da região que rola: dentro da tabela ela ficaria mais larga que a janela e o texto sairia cortado no celular */}
        <p id="grade-4x7-legenda" className="text-xs text-carvao-muted">
          {tx(
            "Grade 4 × 7: referência B0 por submercado e horizonte, em R$/MWh. Os mesmos números da tabela completa e dos painéis acima. Escolha uma célula para ver o detalhe.",
            "4 × 7 grid: B0 benchmark by submarket and horizon, in R$/MWh. The same numbers as the full table and the panels above. Choose a cell to see the detail.",
          )}
        </p>
        <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Grade 4 × 7 da referência B0 (rolável)", "4 × 7 grid of the B0 benchmark (scrollable)")}>
          <table className="w-full min-w-[34rem] border-collapse text-sm tabular-nums" data-grade="4x7" aria-describedby="grade-4x7-legenda">
            <caption className="sr-only">{tx("Grade 4 × 7 da referência B0 por submercado e horizonte, em R$/MWh", "4 × 7 grid of the B0 benchmark by submarket and horizon, in R$/MWh")}</caption>
            <thead>
              <tr className="text-left text-xs text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                  {tx("Submercado", "Submarket")}
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
                    {curto(r.submercado)}
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
                          aria-label={`${h}, ${nome(r.submercado)}: ${x === null ? tx("sem número", "no number") : reaisMWh(x)}`}
                          className={`min-h-[44px] w-full px-2 text-right ${ativo ? "bg-energia-fundo font-medium text-carvao" : "text-carvao hover:bg-papel"}`}
                        >
                          {x === null ? tx("sem número", "no number") : num(x, 2)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recorte}
      {notas}
      {aposPrincipal}

      <SecaoDoPainel id="comparar" titulo={tx("Quais submercados aparecem nos painéis?", "Which submarkets appear in the panels?")} nivel="analisar">
        <Comparador
          rotulo={tx(`Submercados para comparar (até ${LIMITE_COMPARACAO})`, `Submarkets to compare (up to ${LIMITE_COMPARACAO})`)}
          entidades={entidades}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ sms: ids as Submercado[] })}
          dicaBusca={tx("SE/CO, Sul, Nordeste ou Norte", "SE/CW, South, Northeast or North")}
          vazio={tx(
            "Nenhum submercado escolhido. Escolha até quatro para ver a referência de cada um na mesma escala.",
            "No submarket chosen. Choose up to four to see the benchmark of each on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
      </SecaoDoPainel>

      <SecaoDoPainel id="celula" titulo={tx("Uma célula da rodada: submercado e horizonte escolhidos", "One cell of the run: chosen submarket and horizon")}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-carvao">
            <span className="rotulo text-mineral">{tx("Submercado", "Submarket")}</span>
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
            <span className="rotulo text-mineral">{tx("Horizonte", "Horizon")}</span>
            <select
              value={v.h}
              onChange={(e) => definir({ h: e.currentTarget.value as Horizonte })}
              className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
            >
              {HORIZONTES.map((h) => (
                <option key={h} value={h}>
                  {h}: {descreverHorizonte(h, idioma)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-celula={sel?.id ?? ""}>
          {sel ? textoCelula(sel, idioma) : tx("Esta combinação de submercado e horizonte não está na rodada.", "This combination of submarket and horizon is not in the run.")}
        </p>
        <div data-kpis={v.sm}>
          <FaixaMetricas colunas={2} rotulo={tx(`Números da rodada para ${nome(v.sm)}`, `Run numbers for ${nome(v.sm)}`)}>
            <Numero
              variante="faixa"
              rotulo={tx(`B0 semanal, ${curto(v.sm)}`, `Weekly B0, ${curto(v.sm)}`)}
              natureza="PREVISTO"
              valor={semanal.valor}
              evidencia={semanal.evidencia ? evidencias[semanal.evidencia] : undefined}
              formato="reais"
              casas={2}
              unidade="R$/MWh"
              periodo={semanal.periodo}
              nota={semanal.usado}
              motivoAusencia={tx("A rodada não tem número semanal para este submercado; o motivo está na tabela.", "The run has no weekly number for this submarket; the reason is in the table.")}
              cor={COR_SM[v.sm]}
              endereco={endereco}
            />
            <Numero
              variante="faixa"
              rotulo={tx(`B0 mensal, ${curto(v.sm)}`, `Monthly B0, ${curto(v.sm)}`)}
              natureza="PREVISTO"
              valor={mensal.valor}
              evidencia={mensal.evidencia ? evidencias[mensal.evidencia] : undefined}
              formato="reais"
              casas={2}
              unidade="R$/MWh"
              periodo={mensal.periodo}
              nota={mensal.usado}
              motivoAusencia={tx("A rodada não tem número mensal para este submercado; o motivo está na tabela.", "The run has no monthly number for this submarket; the reason is in the table.")}
              cor={COR_SM[v.sm]}
              endereco={endereco}
            />
          </FaixaMetricas>
        </div>
      </SecaoDoPainel>

      {publicado && (
        <SecaoDoPainel
          id="publicado-no-corte"
          titulo={tx(
            `O PLD já publicado para ${dataBR(publicado.origem)}, no corte, é dado e não previsão`,
            `The PLD already published for ${dataBR(publicado.origem)}, at the cutoff, is data and not a forecast`,
          )}
          lead={tx(
            "A CCEE publica o PLD de cada dia na véspera. No corte das 07h00, as horas restantes do dia de origem já eram conhecidas: aparecem aqui como dado observado, e nenhuma entrega prevista as inclui.",
            "CCEE publishes each day's PLD on the previous day. At the 07:00 cutoff, the remaining hours of the origin day were already known: they appear here as observed data, and no forecast delivery includes them.",
          )}
        >
          <FaixaMetricas colunas={2} rotulo={tx(`PLD já publicado no corte, ${nome(v.sm)}`, `PLD already published at the cutoff, ${nome(v.sm)}`)}>
            <Numero
              variante="faixa"
              rotulo={tx(`PLD já publicado no corte, ${curto(v.sm)}`, `PLD already published at the cutoff, ${curto(v.sm)}`)}
              natureza="OBSERVADO"
              valor={pubSm?.media ?? null}
              evidencia={evPub}
              formato="reais"
              casas={2}
              unidade="R$/MWh"
              periodo={
                pubSm?.primeira && pubSm.ultima
                  ? tx(
                      `${dataBR(publicado.origem)}, ${pubSm.primeira.slice(11, 13)}h a ${pubSm.ultima.slice(11, 13)}h`,
                      `${dataBR(publicado.origem)}, ${pubSm.primeira.slice(11, 13)}h to ${pubSm.ultima.slice(11, 13)}h`,
                    )
                  : undefined
              }
              nota={
                <>
                  {tx(
                    "Média simples das horas do dia de origem depois do corte, já publicadas pela CCEE. É dado, não previsão.",
                    "Simple average of the hours of the origin day after the cutoff, already published by CCEE. It is data, not a forecast.",
                  )}
                  {typeof mediaDiaPaginaPld?.[v.sm] === "number" && pubSm?.horas ? (
                    <>
                      {" "}
                      {tx(
                        `A página PLD mostra a média das 24 horas do dia, ${reais(mediaDiaPaginaPld[v.sm] as number)}/MWh; aqui entram só as ${pubSm.horas} horas depois do corte.`,
                        `The PLD page shows the average of the 24 hours of the day, ${reais(mediaDiaPaginaPld[v.sm] as number)}/MWh; here only the ${pubSm.horas} hours after the cutoff are included.`,
                      )}
                    </>
                  ) : null}
                </>
              }
              motivoAusencia={tx("Nenhuma hora do dia de origem depois do corte estava capturada.", "No hour of the origin day after the cutoff had been captured.")}
              endereco={endereco}
            />
          </FaixaMetricas>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoPublicadoNoCorte(publicado, v.sm, idioma)}</p>
          {noCorteGrafico && (
            <div data-nivel="analisar" className="space-y-2" data-grafico-no-corte="">
              {noCorteGrafico}
            </div>
          )}
        </SecaoDoPainel>
      )}

      {avaliacao}

      <TabelaInterativa
        titulo={tx("Células da rodada: referência B0, faixa, limites e período usado", "Cells of the run: B0 benchmark, band, limits and period used")}
        colunas={colunasGrade(idioma)}
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
        dicaBusca={tx("Submercado, horizonte ou entrega", "Submarket, horizon or delivery")}
        nota={tx(
          "P10 e P90 vazios: nenhuma faixa publicada; nenhum segmento está calibrado. Último dia e fim do período usado são os últimos dias inteiros (o fim da entrega, às 00h do dia seguinte, fica excluído). Realizado e erro ficam sem dado até a entrega terminar.",
          "Empty P10 and P90: no band published; no segment is calibrated. Last day and end of the period used are the last whole days (the end of the delivery, at 00h of the next day, is excluded). Actual and error stay without data until the delivery ends.",
        )}
      />
    </div>
  );
}

/** Frase do detalhe da célula escolhida, só com campos da linha. */
function textoCelula(l: LinhaGrade, idioma: Idioma): string {
  const { dataBR, reaisMWh, nome, tx } = formatos(idioma);
  const entrega = tx(
    `${l.horizonte} (${descreverHorizonte(l.horizonte, "pt")}), ${nome(l.submercado)}: entrega ${l.entrega}, de ${dataBR(l.inicio)} a ${dataBR(l.fim)}.`,
    `${l.horizonte} (${descreverHorizonte(l.horizonte, idioma)}), ${nome(l.submercado)}: delivery ${l.entrega}, from ${dataBR(l.inicio)} to ${dataBR(l.fim)}.`,
  );
  if (l.previsao === null) return tx(`${entrega} Sem número: ${l.motivo || "motivo não registrado"}.`, `${entrega} No number: ${l.motivo || "reason not recorded"}.`);
  const usado = l.periodo_inicio && l.periodo_fim ? tx(`, média do PLD de ${dataBR(l.periodo_inicio)} a ${dataBR(l.periodo_fim)}`, `, average PLD from ${dataBR(l.periodo_inicio)} to ${dataBR(l.periodo_fim)}`) : "";
  const faixa =
    l.p10 !== null && l.p90 !== null
      ? tx(`Faixa P10 a P90: ${reaisMWh(l.p10)} a ${reaisMWh(l.p90)}.`, `P10 to P90 band: ${reaisMWh(l.p10)} to ${reaisMWh(l.p90)}.`)
      : tx(`Sem faixa (calibração: ${l.calibracao}).`, `No band (calibration: ${l.calibracao}).`);
  const lim =
    l.piso !== null && l.teto !== null
      ? tx(
          ` Limites médios da entrega: piso ${reaisMWh(l.piso)} e teto estrutural ${reaisMWh(l.teto)} (${l.limites}).`,
          ` Average limits of the delivery: floor ${reaisMWh(l.piso)} and structural cap ${reaisMWh(l.teto)} (${l.limites}).`,
        )
      : "";
  // "sim" no português e "yes" no inglês (linhasGrade escreve no idioma da página)
  const aj = l.ajustada === "sim" || l.ajustada === "yes" ? tx(" O valor foi ajustado ao limite de preço.", " The value was adjusted to the price limit.") : "";
  const real =
    l.realizado !== null
      ? tx(
          ` Realizado: ${reaisMWh(l.realizado)}${l.erro !== null ? `; erro (previsão menos realizado): ${reaisMWh(l.erro)}` : ""}.`,
          ` Actual: ${reaisMWh(l.realizado)}${l.erro !== null ? `; error (forecast minus actual): ${reaisMWh(l.erro)}` : ""}.`,
        )
      : l.termina
        ? tx(` Sem realizado: a entrega termina em ${dataBR(l.termina)}.`, ` No actual value: the delivery ends on ${dataBR(l.termina)}.`)
        : "";
  return tx(`${entrega} Referência B0: ${reaisMWh(l.previsao)}${usado}. ${faixa}${lim}${aj}${real}`, `${entrega} B0 benchmark: ${reaisMWh(l.previsao)}${usado}. ${faixa}${lim}${aj}${real}`);
}

/* ---------------------------------------------------------------- pequeno múltiplo */

const L = 360;
const A = 156;
const M = { e: 52, d: 10, t: 18, b: 26 };
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]; // i18n: dado
const MESES_CURTOS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Meia-noite do dia (AAAA-MM-DD) em dias desde 1970. */
const dia = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;
function frequencias(idioma: Idioma): { freq: Frequencia; titulo: string }[] {
  return [
    { freq: "W", titulo: txBase("Semanas (W1 a W4)", "Weeks (W1 to W4)", idioma) },
    { freq: "M", titulo: txBase("Meses (M1 a M3)", "Months (M1 to M3)", idioma) },
  ];
}

/**
 * Um submercado em dois painéis, semanas e meses, cada um com o seu eixo de tempo e a mesma escala de preço. Uma entrega é um
 * segmento horizontal do primeiro ao último dia, na altura do número previsto: a previsão vale para a média do período, não para
 * cada dia. À esquerda do corte, em cinza, o período que o B0 repete (dado observado). O piso médio é a referência pontilhada, e o
 * realizado, quando a entrega termina, um losango. Valores escritos diretamente no gráfico; a tabela tem os mesmos números.
 */
function GradeSubmercado({
  sm,
  origem,
  linhas,
  dom,
  selecionado,
  horizonte,
  onSelecionar,
  idioma,
}: {
  sm: Submercado;
  origem: string;
  linhas: LinhaGrade[];
  dom: Dominio;
  selecionado: boolean;
  horizonte: Horizonte;
  onSelecionar: (h?: Horizonte) => void;
  idioma: Idioma;
}) {
  const { nome, curto, tx } = formatos(idioma);
  const cor = COR_SM[sm];
  const temRealizado = linhas.some((l) => l.realizado !== null);
  return (
    <figure className={`min-w-0 border bg-superficie p-3 ${selecionado ? "border-energia" : "border-linha"}`} data-grade-sm={sm}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-serif text-base text-carvao">{nome(sm)}</span>
        <button
          type="button"
          onClick={() => onSelecionar()}
          aria-pressed={selecionado}
          className={`rotulo inline-flex min-h-[44px] items-center px-2 ${selecionado ? "text-carvao" : "text-carvao-muted underline underline-offset-4 hover:text-carvao"}`}
        >
          {selecionado ? tx("Submercado escolhido", "Chosen submarket") : tx(`Escolher ${curto(sm)}`, `Choose ${curto(sm)}`)}
        </button>
      </figcaption>
      {frequencias(idioma).map(({ freq, titulo }) => (
        <PainelFrequencia
          key={freq}
          sm={sm}
          freq={freq}
          titulo={titulo}
          origem={origem}
          linhas={linhas}
          dom={dom}
          cor={cor}
          horizonte={horizonte}
          ativo={selecionado}
          idioma={idioma}
        />
      ))}
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted">
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[3px] w-5 align-middle" style={{ background: cor }} />
          {tx("B0 por entrega (R$/MWh)", "B0 by delivery (R$/MWh)")}
        </span>
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[3px] w-5 bg-mineral align-middle" />
          {tx("período que o B0 repete", "period that B0 repeats")}
        </span>
        {temRealizado && (
          <span>
            <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rotate-45 bg-carvao align-middle" />
            {tx("realizado", "actual")}
          </span>
        )}
      </p>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={tx(`Horizontes de ${nome(sm)}`, `Horizons of ${nome(sm)}`)}>
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

function PainelFrequencia({
  sm,
  freq,
  titulo,
  origem,
  linhas,
  dom,
  cor,
  horizonte,
  ativo,
  idioma,
}: {
  sm: Submercado;
  freq: Frequencia;
  titulo: string;
  origem: string;
  linhas: LinhaGrade[];
  dom: Dominio;
  cor: string;
  horizonte: Horizonte;
  ativo: boolean;
  idioma: Idioma;
}) {
  const { dataBR, diaMes, num, reaisMWh, nome, tx } = formatos(idioma);
  const grupo = linhas.filter((l) => l.horizonte.startsWith(freq));
  if (!grupo.length) return null;
  const mensal = freq === "M";
  const inicios = grupo.flatMap((l) => [l.periodo_inicio, l.inicio]).filter((x): x is string => !!x);
  const x0 = Math.min(...inicios.map(dia));
  const x1 = Math.max(...grupo.map((l) => dia(l.fim))) + 1;
  const x = escalaLinear([x0, x1], [M.e, L - M.d]);
  const y = escalaLinear([dom.min, dom.max], [A - M.b, M.t]);
  const piso = grupo.find((l) => l.piso !== null)?.piso ?? null;
  // corte às 07h do dia de origem (Brasília)
  const corte = origem ? dia(origem) + 7 / 24 : null;
  const marcas: { x: number; rotulo: string }[] = [];
  if (mensal) {
    // dia 1º de cada mês dentro do eixo (inclusive o do início, quando o eixo começa nele)
    const d = new Date(x0 * 86_400_000);
    d.setUTCDate(1);
    if (d.getTime() / 86_400_000 < x0 - 1e-6) d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() / 86_400_000 < x1 - 1) {
      marcas.push({
        x: x(d.getTime() / 86_400_000),
        rotulo: tx(
          `${MESES_CURTOS[d.getUTCMonth()]}${d.getUTCMonth() === 0 ? `/${String(d.getUTCFullYear()).slice(2)}` : ""}`,
          `${MESES_CURTOS_EN[d.getUTCMonth()]}${d.getUTCMonth() === 0 ? ` \u2019${String(d.getUTCFullYear()).slice(2)}` : ""}`,
        ),
      });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  } else {
    // semanas: o primeiro dia de cada entrega (sábado), no formato dd/mm
    for (const l of grupo) marcas.push({ x: x(dia(l.inicio)), rotulo: diaMes(l.inicio) });
  }
  const usados = new Map<string, { inicio: string; fim: string; valor: number }>();
  for (const l of grupo) if (l.periodo_inicio && l.periodo_fim && l.previsao !== null && !usados.has(`${l.periodo_inicio}:${l.periodo_fim}`)) usados.set(`${l.periodo_inicio}:${l.periodo_fim}`, { inicio: l.periodo_inicio, fim: l.periodo_fim, valor: l.previsao });
  const vals = Array.from(new Set(grupo.map((l) => (l.previsao === null ? tx("sem número", "no number") : reaisMWh(l.previsao)))));
  const descricao = tx(
    `${mensal ? "meses" : "semanas"} de ${dataBR(grupo[0].inicio)} a ${dataBR(grupo[grupo.length - 1].fim)}: ${vals.join(", ")}${piso !== null ? `; piso médio ${reaisMWh(piso)}` : ""}.`,
    `${mensal ? "months" : "weeks"} from ${dataBR(grupo[0].inicio)} to ${dataBR(grupo[grupo.length - 1].fim)}: ${vals.join(", ")}${piso !== null ? `; average floor ${reaisMWh(piso)}` : ""}.`,
  );
  const idTitulo = `grade-${sm}-${freq}-titulo`;
  const idDesc = `grade-${sm}-${freq}-desc`;
  const comNumero = grupo.filter((l) => l.previsao !== null);
  const iguais = comNumero.length > 0 && comNumero.every((l) => Math.abs((l.previsao as number) - (comNumero[0].previsao as number)) < 0.005);

  return (
    <div className="mt-2" data-painel-frequencia={freq}>
      <p className="text-xs font-medium text-carvao-muted">{titulo}</p>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" role="img" aria-labelledby={`${idTitulo} ${idDesc}`} className="mt-0.5 block h-auto max-w-full overflow-visible">
        <title id={idTitulo}>{tx(`Referência B0 por entrega, ${nome(sm)}: ${titulo.toLowerCase()}`, `B0 benchmark by delivery, ${nome(sm)}: ${titulo.toLowerCase()}`)}</title>
        <desc id={idDesc}>{descricao}</desc>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} stroke="var(--cor-grade)" strokeWidth={1} />
            <text x={M.e - 4} y={y(t) + 3.5} textAnchor="end" fontSize={12} fill="var(--cor-mineral)">
              {rotuloTick(t, dom.passo)}
            </text>
          </g>
        ))}
        {marcas.map((m) => (
          <text key={m.rotulo + m.x} x={m.x} y={A - M.b + 14} fontSize={12} fill="var(--cor-mineral)">
            {m.rotulo}
          </text>
        ))}
        {piso !== null && (
          <g>
            <line x1={M.e} x2={L - M.d} y1={y(piso)} y2={y(piso)} stroke="var(--serie-referencia)" strokeWidth={1.5} strokeDasharray="2 3" />
            <text x={L - M.d} y={y(piso) - 4} textAnchor="end" fontSize={12} fill="var(--cor-carvao-muted)">
              {tx(`piso médio ${num(piso, 2)}`, `average floor ${num(piso, 2)}`)}
            </text>
          </g>
        )}
        {corte !== null && corte > x0 && corte < x1 && (
          <g>
            <line x1={x(corte)} x2={x(corte)} y1={M.t - 6} y2={A - M.b} stroke="var(--cor-carvao-muted)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={x(corte) - 3} y={M.t - 6} textAnchor="end" fontSize={12} fill="var(--cor-carvao-muted)">
              {tx(`corte ${diaMes(origem)}`, `cutoff ${diaMes(origem)}`)}
            </text>
          </g>
        )}
        {Array.from(usados.values()).map((u) => (
          <g key={`${u.inicio}:${u.fim}`}>
            <line x1={x(dia(u.inicio))} x2={x(dia(u.fim) + 1)} y1={y(u.valor)} y2={y(u.valor)} stroke="var(--cor-mineral)" strokeWidth={3} />
            <title>
              {tx(
                `Período usado pelo B0 ${mensal ? "mensal" : "semanal"}: ${dataBR(u.inicio)} a ${dataBR(u.fim)}, média ${reaisMWh(u.valor)} (observado)`,
                `Period used by the ${mensal ? "monthly" : "weekly"} B0: ${dataBR(u.inicio)} to ${dataBR(u.fim)}, average ${reaisMWh(u.valor)} (observed)`,
              )}
            </title>
          </g>
        ))}
        {grupo.map((l) => {
          const xa = x(dia(l.inicio));
          const xb = x(dia(l.fim) + 1);
          const ativoH = ativo && l.horizonte === horizonte;
          if (l.previsao === null)
            return (
              <g key={l.id}>
                <rect x={xa} y={A - M.b - 8} width={Math.max(6, xb - xa - 1)} height={8} fill="none" stroke="var(--cor-mineral)" strokeDasharray="2 2" />
                <title>{tx(`${l.horizonte}: sem número (${l.motivo || "motivo não registrado"})`, `${l.horizonte}: no number (${l.motivo || "reason not recorded"})`)}</title>
              </g>
            );
          return (
            <g key={l.id}>
              <line
                x1={xa + 0.5}
                x2={xb - 0.5}
                y1={y(l.previsao)}
                y2={y(l.previsao)}
                stroke={cor}
                strokeWidth={ativoH ? 5 : 3}
                strokeDasharray={mensal ? "6 3" : undefined}
              />
              <title>{tx(`${l.horizonte}, ${dataBR(l.inicio)} a ${dataBR(l.fim)}: ${reaisMWh(l.previsao)}`, `${l.horizonte}, ${dataBR(l.inicio)} to ${dataBR(l.fim)}: ${reaisMWh(l.previsao)}`)}</title>
              {l.realizado !== null && (
                <g>
                  <path
                    d={`M${(xa + xb) / 2},${y(l.realizado) - 6} l6,6 l-6,6 l-6,-6 Z`}
                    fill="var(--cor-carvao)"
                    stroke="var(--cor-superficie)"
                    strokeWidth={1}
                  />
                  <title>{tx(`${l.horizonte}: realizado ${reaisMWh(l.realizado)}, previsão ${reaisMWh(l.previsao)}`, `${l.horizonte}: actual ${reaisMWh(l.realizado)}, forecast ${reaisMWh(l.previsao)}`)}</title>
                </g>
              )}
            </g>
          );
        })}
        {comNumero.length > 0 &&
          (iguais ? (
            <text
              x={mensal ? x(dia(comNumero[comNumero.length - 1].fim) + 1) : x(dia(comNumero[0].inicio))}
              y={y(comNumero[0].previsao as number) - 7}
              textAnchor={mensal ? "end" : "start"}
              fontSize={12}
              fill="var(--cor-carvao)"
            >
              {tx(
                `${comNumero[0].horizonte} a ${comNumero[comNumero.length - 1].horizonte}: ${num(comNumero[0].previsao as number, 2)}`,
                `${comNumero[0].horizonte} to ${comNumero[comNumero.length - 1].horizonte}: ${num(comNumero[0].previsao as number, 2)}`,
              )}
            </text>
          ) : (
            comNumero.map((l) => (
              <text key={l.id} x={(x(dia(l.inicio)) + x(dia(l.fim) + 1)) / 2} y={y(l.previsao as number) - 7} textAnchor="middle" fontSize={12} fill="var(--cor-carvao)">
                {num(l.previsao as number, 0)}
              </text>
            ))
          ))}
      </svg>
    </div>
  );
}
