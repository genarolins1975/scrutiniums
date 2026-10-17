"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR as dataBRBase, plural as pluralBase, reais as reaisBase } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  colunasCalendario,
  colunasEmpates,
  colunasPermanencia,
  COR_SM,
  curtoSm,
  doSm,
  escalaHorasDia,
  JANELAS_CALENDARIO,
  LIMITES_HORA,
  nomeSm,
  SUBMERCADOS,
  calendarioLimite,
  diasNoLimite,
  emPct,
  linhasCalendario,
  linhasEmpates,
  linhasPermanencia,
  permanencia,
  regimesDoAno,
  respostaP010,
  rotaPainel,
  textoDiasNoLimite,
  vereditoP010,
  type JanelaCalendario,
  type LimiteHora,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoLimitesDisponivel } from "@/lib/energia/tipos-pld";

/**
 * P010, limites, piso e tetos: submercado (?sm=), ano (?ano=) e limite do
 * calendário (?lim=) ficam na URL; busca, ordem e filtros das tabelas também
 * (prefixos cal, perm e emp). A resposta, as medidas da faixa, as barras de permanência e a
 * tabela leem as mesmas linhas (linhasPermanencia); o calendário e a sua tabela, a
 * mesma série diária da gold. Hora no limite é igualdade ao centavo, regra da gold;
 * o menor valor observado nunca aparece como piso.
 *
 * Ordem da página: resposta e escolha de submercado e ano, figura principal (permanência por ano,
 * com o ano escolhido marcado), faixa de medidas do ano (com os limites do trecho vigente e o objeto
 * de cada um; vem depois da figura para que ela apareça na primeira tela), recorte, tabela, notas do painel e as três visões
 * complementares (calendário dos dias, horas no piso por submercado e empates), visíveis em Entender.
 */
function rotuloLimite(l: LimiteHora, idioma: Idioma): string {
  if (l === "piso") return tx("Horas no piso", "Hours at the floor", idioma);
  return tx("Horas no teto horário", "Hours at the hourly cap", idioma);
}

export type LimitesP010 = Pick<BlocoLimitesDisponivel, "permanencia_anual" | "regimes" | "empates_piso" | "calendario" | "tolerancia">;

const valorLimite = (v: number | null, idioma: Idioma) => (v === null ? tx("sem valor integrado", "no integrated value", idioma) : `${reaisBase(v, 2, idioma)}/MWh`);

export function PldLimites({
  l,
  anos,
  diaReferencia,
  fichas,
  fonte,
  versao,
  notaPermanencia,
  notas,
}: {
  l: LimitesP010;
  anos: number[];
  diaReferencia: string;
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Contexto de anos com muitas horas no piso que o dado publicado sustenta (ver o achado A02, na página CMO e formação de preço). */
  notaPermanencia?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
}) {
  const ultimo = anos[anos.length - 1] ?? Number(diaReferencia.slice(0, 4));
  const esquema = useMemo(
    () => ({
      sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
      ano: campo(tiposUrl.inteiro({ min: anos[0] ?? ultimo, max: ultimo }), ultimo),
      lim: campo(tiposUrl.opcao(LIMITES_HORA), "piso" as LimiteHora),
      cal: campo(tiposUrl.opcao(["6m", "12m"] as const), "6m" as JanelaCalendario),
      sms: campo(tiposUrl.lista(tiposUrl.opcao(SUBMERCADOS), { max: LIMITE_COMPARACAO }), [...SUBMERCADOS] as Submercado[]),
    }),
    // o esquema depende só da lista de anos publicada (estável no build)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anos.join(",")],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const dataBR = (iso: string | null | undefined) => dataBRBase(iso, idioma);
  const plural = (n: number, um: string, varios: string) => pluralBase(n, um, varios, idioma);
  const sm = v.sm as Submercado;
  const nome = nomeSm(sm, idioma);
  const ano = v.ano;
  const lim = v.lim as LimiteHora;
  const bloco = l as BlocoLimitesDisponivel;
  const p = permanencia(bloco, ano, sm);
  const regs = regimesDoAno(bloco, ano);
  const reg = regs.length === 1 ? regs[0] : null;
  const perm = useMemo(() => linhasPermanencia(bloco, sm, idioma), [bloco, sm, idioma]);
  const nDias = JANELAS_CALENDARIO[v.cal as JanelaCalendario];
  const cal = useMemo(() => calendarioLimite(bloco.calendario, sm, lim, nDias, idioma), [bloco, sm, lim, nDias, idioma]);
  const calLinhas = useMemo(() => linhasCalendario(bloco.calendario, sm, nDias, idioma), [bloco, sm, nDias, idioma]);
  const empates = useMemo(() => linhasEmpates(bloco, idioma), [bloco, idioma]);
  const escolhidos = v.sms as Submercado[];
  // piso por ano para os submercados escolhidos: as mesmas linhas de linhasPermanencia, uma coluna por submercado
  const comparacao = useMemo(() => {
    const porSm = Object.fromEntries(escolhidos.map((s) => [s, linhasPermanencia(bloco, s, idioma)]));
    return anos.map((a) => ({
      id: String(a),
      rotulo: permanencia(bloco, a, "SE")?.parcial ? tx(`${a} (parcial)`, `${a} (partial)`) : String(a),
      ...Object.fromEntries(escolhidos.map((s) => [s, porSm[s].find((l) => l.id === String(a))?.piso_pct ?? null])),
    }));
  }, [bloco, anos, escolhidos, idioma, tx]);
  const dias = bloco.calendario.dias.slice(-nDias);
  // os dias com hora no limite, ditos por data quando são poucos, em todo o calendário publicado (a grade de uma janela sem eventos é uniforme)
  const textoDias = textoDiasNoLimite(diasNoLimite(bloco.calendario, sm, lim), lim, bloco.calendario.dias.length, 10, idioma);
  const endereco = `${rotaPainel("p010")}#p010`;
  const ficha = fichas[`piso_${ano}_${sm}`] ?? null;
  const periodoAno = p?.parcial ? tx(`${ano} até ${dataBR(diaReferencia)}`, `${ano} through ${dataBR(diaReferencia)}`) : String(ano);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p010" vivo veredito={vereditoP010(bloco, ano, sm, diaReferencia, idioma)}>
          {respostaP010(bloco, ano, sm, diaReferencia, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldEscolha
            legenda={tx("Submercado", "Submarket")}
            opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: curtoSm(s, idioma), detalhe: nomeSm(s, idioma) }))}
            valor={sm}
            onEscolher={(s) => definir({ sm: s })}
          />
          <PldLista
            rotulo={tx("Ano", "Year")}
            opcoes={anos.map((a) => ({ id: String(a), rotulo: permanencia(bloco, a, sm)?.parcial ? tx(`${a} (parcial)`, `${a} (partial)`) : String(a) }))}
            valor={String(ano)}
            onEscolher={(a) => definir({ ano: Number(a) })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <GraficoBarras
          titulo={tx(
            `Horas no piso e no teto horário por ano, ${nome} (% das horas com limite vigente)`,
            `Hours at the floor and at the hourly cap by year, ${nome} (% of hours with a limit in force)`,
          )}
          dados={perm}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "piso_pct", rotulo: tx("no piso", "at the floor"), cor: "var(--escala-seq-3)" },
            { id: "teto_pct", rotulo: tx("no teto horário", "at the hourly cap"), cor: "var(--escala-div-neg-2)" },
          ]}
          unidade="%"
          casas={2}
          selecionado={String(ano)}
          onSelecionar={(id) => id && definir({ ano: Number(id) })}
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "Cada ano tem o próprio piso e os próprios tetos: a barra mede quanto tempo o preço passou no limite daquele ano, não o nível do preço. O ano parcial ainda não terminou e não se compara a anos completos sem essa ressalva.",
            "Each year has its own floor and its own caps: the bar measures how long the price stayed at that year's limit, not the price level. The partial year has not ended yet and is not comparable to complete years without this caveat.",
          )}
        </p>
        {notaPermanencia ? <p className="text-sm leading-relaxed text-carvao-muted">{notaPermanencia}</p> : null}
      </div>

      <FaixaMetricas colunas={4} rotulo={tx(`Medidas de ${periodoAno}, ${nome}`, `Measures for ${periodoAno}, ${nome}`)}>
        <Numero
          variante="faixa"
          rotulo={tx("Horas no piso", "Hours at the floor")}
          natureza="CALCULADO"
          valor={emPct(p?.frac_piso)}
          evidencia={ficha}
          formato="pct"
          casas={2}
          unidade={tx("das horas com limite", "of hours with a limit")}
          periodo={periodoAno}
          motivoAusencia={tx("Sem permanência publicada para o ano e o submercado.", "No duration published for the year and submarket.")}
          cor={COR_SM[sm]}
          endereco={endereco}
          nota={
            ficha
              ? undefined
              : tx(
                  "A ficha Comprove é publicada para o ano de referência; os demais anos estão na tabela e no CSV diário.",
                  "The Verify sheet is published for the reference year; the other years are in the table and in the daily CSV.",
                )
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx("Horas no teto horário", "Hours at the hourly cap")}
          natureza="CALCULADO"
          valor={p?.horas_teto_horario ?? null}
          formato="num"
          casas={0}
          unidade={tx("horas", "hours")}
          periodo={periodoAno}
          motivoAusencia={tx("Sem permanência publicada.", "No duration published.")}
          cor={COR_SM[sm]}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Dias com média no teto estrutural", "Days with the average at the structural cap")}
          natureza="CALCULADO"
          valor={p?.dias_teto_estrutural ?? null}
          formato="num"
          casas={0}
          unidade={tx("dias", "days")}
          periodo={periodoAno}
          motivoAusencia={tx("Sem permanência publicada.", "No duration published.")}
          cor={COR_SM[sm]}
          nota={tx("Conferido sobre a média das 24 horas do dia.", "Checked against the average of the 24 hours of the day.")}
        />
        <div role="group" aria-label={tx(`Limites vigentes em ${ano}`, `Limits in force in ${ano}`)} data-metrica="" className="min-w-0">
          <p className="mb-1.5 text-[0.8125rem] leading-snug text-carvao-muted">{tx(`Limites de ${ano} (atos da ANEEL)`, `Limits for ${ano} (ANEEL acts)`)}</p>
          {reg ? (
            <dl className="space-y-1.5 text-sm tabular-nums text-carvao">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <dt className="text-carvao-muted">
                  {tx("Piso", "Floor")} <span className="text-xs">{tx("(cada hora)", "(each hour)")}</span>
                </dt>
                <dd>{valorLimite(reg.pld_min, idioma)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <dt className="text-carvao-muted">
                  {tx("Teto horário", "Hourly cap")} <span className="text-xs">{tx("(cada hora)", "(each hour)")}</span>
                </dt>
                <dd>{valorLimite(reg.pld_max_horario, idioma)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <dt className="text-carvao-muted">
                  {tx("Teto estrutural", "Structural cap")} <span className="text-xs">{tx("(média do dia)", "(daily average)")}</span>
                </dt>
                <dd>{valorLimite(reg.pld_max_estrutural, idioma)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-carvao-muted">
              {regs.length
                ? tx("Mais de um trecho de vigência no ano: veja a tabela de limites.", "More than one period in force during the year: see the limits table.")
                : tx("Sem ato vigente integrado para o ano.", "No act in force integrated for the year.")}
            </p>
          )}
          {reg && (
            <p className="mt-1.5 text-xs leading-snug text-carvao-muted">
              {reg.ato_pld_min === reg.ato_pld_max_horario && reg.ato_pld_min === reg.ato_pld_max_estrutural
                ? tx(`Piso e tetos: ${reg.ato_pld_min ?? "ato não identificado"}.`, `Floor and caps: ${reg.ato_pld_min ?? "act not identified"}.`)
                : tx(
                    `Piso: ${reg.ato_pld_min ?? "ato não identificado"}; teto horário: ${reg.ato_pld_max_horario ?? "ato não identificado"}; teto estrutural: ${reg.ato_pld_max_estrutural ?? "ato não identificado"}.`,
                    `Floor: ${reg.ato_pld_min ?? "act not identified"}; hourly cap: ${reg.ato_pld_max_horario ?? "act not identified"}; structural cap: ${reg.ato_pld_max_estrutural ?? "act not identified"}.`,
                  )}
            </p>
          )}
        </div>
      </FaixaMetricas>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              `Ano ${periodoAno}; calendário dos últimos ${plural(dias.length, "dia", "dias")} (${dias.length ? `${dataBR(dias[0])} a ${dataBR(dias[dias.length - 1])}` : "sem dias"})`,
              `Year ${periodoAno}; calendar of the last ${plural(dias.length, "day", "days")} (${dias.length ? `${dataBR(dias[0])} to ${dataBR(dias[dias.length - 1])}` : "no days"})`,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
          <dd className="mt-0.5">
            {tx(`Horas com PLD publicado ${doSm(sm, "pt")} e limite vigente do ato da ANEEL`, `Hours with a published PLD ${doSm(sm, idioma)} and a limit in force under the ANEEL act`)}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              "horas e % das horas; limites em R$/MWh nominais; hora no limite = preço igual ao limite, ao centavo",
              "hours and % of hours; limits in nominal R$/MWh; hour at the limit = price equal to the limit, to the cent",
            )}
            <span data-nivel="analisar">
              {" "}
              {tx(
                `(|PLD − limite| ≤ R$ ${String(bloco.tolerancia.hora).replace(".", ",")}/MWh)`,
                `(|PLD − limit| ≤ R$ ${String(bloco.tolerancia.hora)}/MWh)`,
              )}
            </span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={tx(`Tabela equivalente: permanência nos limites por ano, ${nome}`, `Equivalent table: duration at the limits by year, ${nome}`)}
        colunas={colunasPermanencia(idioma)}
        linhas={perm}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-permanencia-${sm}`}
        chaveUrl="perm"
        selecionado={String(ano)}
        onSelecionar={(id) => id && definir({ ano: Number(id) })}
      />

      {notas}

      <SecaoDoPainel
        id="calendario"
        titulo={tx("Em quais dos últimos dias o preço ficou no limite?", "On which of the recent days was the price at the limit?")}
        lead={tx(
          `Cada célula é um dia e cada linha é uma semana; o valor é o número de horas do dia no limite escolhido. O calendário usa os dias mais recentes da publicação (${
            bloco.calendario.dias.length ? `${dataBR(bloco.calendario.dias[0])} a ${dataBR(bloco.calendario.dias[bloco.calendario.dias.length - 1])}` : "sem dias"
          }), e a janela abaixo escolhe o último semestre ou todos eles, qualquer que seja o Ano escolhido acima: o histórico de cada ano está nas barras e no arquivo diário de limites.`,
          `Each cell is a day and each row is a week; the value is the number of hours of the day at the chosen limit. The calendar uses the most recent days of the publication (${
            bloco.calendario.dias.length ? `${dataBR(bloco.calendario.dias[0])} to ${dataBR(bloco.calendario.dias[bloco.calendario.dias.length - 1])}` : "no days"
          }), and the window below chooses the last semester or all of them, whatever Year is chosen above: the history of each year is in the bars and in the daily limits file.`,
        )}
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldEscolha
            legenda={tx("Calendário", "Calendar")}
            opcoes={LIMITES_HORA.map((x) => ({ id: x, rotulo: rotuloLimite(x, idioma) }))}
            valor={lim}
            onEscolher={(x) => definir({ lim: x })}
          />
          <PldEscolha
            legenda={tx("Janela do calendário", "Calendar window")}
            opcoes={[
              { id: "6m" as JanelaCalendario, rotulo: tx("Último semestre", "Last semester") },
              { id: "12m" as JanelaCalendario, rotulo: tx(`Últimos ${bloco.calendario.dias.length} dias`, `Last ${bloco.calendario.dias.length} days`) },
            ]}
            valor={v.cal as JanelaCalendario}
            onEscolher={(x) => definir({ cal: x })}
          />
        </div>
        {textoDias && (
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="dias-no-limite">
            {textoDias}
          </p>
        )}
        <MapaCalor
          titulo={tx(
            `${rotuloLimite(lim, "pt")} por dia, ${nome}, últimos ${plural(dias.length, "dia", "dias")}`,
            `${rotuloLimite(lim, idioma)} per day, ${nome}, last ${plural(dias.length, "day", "days")}`,
          )}
          linhas={cal.linhas}
          colunas={cal.colunas}
          nomeLinhas={tx("Semana", "Week")}
          nomeColunas={tx("Dia da semana", "Day of the week")}
          valores={cal.valores}
          escala={escalaHorasDia(idioma)}
          unidade={tx("horas", "hours")}
          casas={0}
          periodo={dias.length ? tx(`${dataBR(dias[0])} a ${dataBR(dias[dias.length - 1])}`, `${dataBR(dias[0])} to ${dataBR(dias[dias.length - 1])}`) : undefined}
          nota={tx(
            "Célula com borda tracejada: dia fora da janela escolhida. Zero é valor: dia sem nenhuma hora no limite.",
            "Cell with a dashed border: day outside the chosen window. Zero is a value: a day with no hour at the limit.",
          )}
        />
        <TabelaInterativa
          titulo={tx(`Tabela equivalente do calendário: horas no limite por dia, ${nome}`, `Equivalent table for the calendar: hours at the limit per day, ${nome}`)}
          colunas={colunasCalendario(idioma)}
          linhas={calLinhas}
          chaveLinha="id"
          colunaRotulo="dia" // i18n: dado
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-limites-calendario-${sm}`}
          chaveUrl="cal.t"
          ordemInicial={{ coluna: "dia", direcao: "desc" }} // i18n: dado
          nota={tx(
            "O histórico diário desde 2021, com os limites vigentes de cada dia, está no CSV de limites (download no rodapé do painel).",
            "The daily history since 2021, with the limits in force on each day, is in the limits CSV (download at the foot of the panel).",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="piso-por-submercado" titulo={tx("Quantas horas no piso, por ano e por submercado?", "How many hours at the floor, by year and by submarket?")}>
        <Comparador
          rotulo={tx(`Submercados no gráfico (até ${LIMITE_COMPARACAO})`, `Submarkets in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={SUBMERCADOS.map((s) => ({ id: s, rotulo: nomeSm(s, idioma), sinonimos: [curtoSm(s, idioma), nomeSm(s, "pt")] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ sms: ids as Submercado[] })}
          dicaBusca={tx("Sul, Nordeste, Norte", "South, Northeast, North")}
          vazio={tx(
            "Nenhum submercado escolhido. Escolha até quatro para comparar as horas no piso na mesma escala.",
            "No submarket chosen. Choose up to four to compare hours at the floor on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <GraficoBarras
            titulo={tx("Horas no piso por ano e submercado (% das horas com limite vigente)", "Hours at the floor by year and submarket (% of hours with a limit in force)")}
            dados={comparacao}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={escolhidos.map((s) => ({ id: s, rotulo: nomeSm(s, idioma), cor: COR_SM[s] }))}
            unidade="%"
            casas={2}
            selecionado={String(ano)}
            onSelecionar={(id) => id && definir({ ano: Number(id) })}
          />
        )}
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "Os quatro submercados têm o mesmo piso em cada ano; diferenças entre as barras de um ano vêm das horas em que os preços se separaram (painel de diferenças regionais), não de pisos diferentes.",
            "The four submarkets have the same floor in each year; differences between the bars of a year come from the hours in which prices diverged (regional differences panel), not from different floors.",
          )}
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="empates-piso" titulo={tx("Em quantas horas vários submercados ficaram no piso ao mesmo tempo?", "In how many hours were several submarkets at the floor at the same time?")}>
        <GraficoBarras
          titulo={tx("Horas de cada ano pelo número de submercados no piso na mesma hora", "Hours of each year by the number of submarkets at the floor in the same hour")}
          dados={empates}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "q0", rotulo: tx("nenhum", "none"), cor: "var(--escala-seq-1)" },
            { id: "q1", rotulo: tx("um", "one"), cor: "var(--escala-seq-2)" },
            { id: "q2", rotulo: tx("dois", "two"), cor: "var(--escala-seq-3)" },
            { id: "q3", rotulo: tx("três", "three"), cor: "var(--escala-seq-4)" },
            { id: "q4", rotulo: tx("os quatro", "all four"), cor: "var(--escala-seq-5)" },
          ]}
          unidade={tx("horas", "hours")}
          casas={0}
          empilhado
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "Com os quatro no piso, os preços são iguais por regra, e a hora não diz nada sobre diferenças entre regiões nem sobre o custo de cada uma. As médias e os percentis de anos com muitas horas no piso têm uma massa de valores iguais; o painel de histórico mostra essa massa.",
            "With all four at the floor, prices are equal by rule, and the hour says nothing about differences between regions or about the cost of each one. The averages and percentiles of years with many hours at the floor contain a mass of equal values; the history panel shows this mass.",
          )}
        </p>
        <TabelaInterativa
          titulo={tx("Tabela equivalente: horas por número de submercados no piso", "Equivalent table: hours by number of submarkets at the floor")}
          colunas={colunasEmpates(idioma)}
          linhas={empates}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="pld-empates-piso"
          chaveUrl="emp"
        />
      </SecaoDoPainel>
    </div>
  );
}
