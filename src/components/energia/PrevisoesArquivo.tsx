"use client";

import { useMemo, type ReactNode } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaAdaptativa, type ColunaAdaptativa } from "@/components/energia/PrevisoesTabela";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR as dataBRBase, num as numBase } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  colunasArquivoTabela,
  arquivoAte,
  datasInclusao,
  instanteBR,
  linhasGraficoRodadas,
  minusculaInicial,
  reaisMWh,
  respostaP015,
  resumoRodadas,
  vereditoP015,
  type AvisoRodada,
  type LinhaArquivo,
  type ResumoRodada,
} from "@/lib/energia/previsoes";

/**
 * P015, arquivo de emissões: "o que foi previsto antes do resultado". O dia em
 * `?em=` mostra o arquivo como estava ao fim daquele dia (só registros incluídos
 * até ele); a rodada em `?rod=` restringe a tabela; o registro em `?reg=` abre o
 * detalhe. Gráficos, tabela, resposta e exportação saem das MESMAS linhas
 * filtradas, então não divergem.
 *
 * Nada é recalculado: cada linha é uma linha do CSV publicado pelo pipeline
 * (previsoes_emissoes.csv), com o sha256 do registro imutável. Registro incluído
 * no arquivo em dia posterior ao da emissão aparece como transcrito.
 *
 * As rodadas registradas ficam numa tabela própria, com a emissão e os avisos materiais de cada uma (emissão manual ou depois do
 * prazo, código sem versão registrada, registro transcrito, rodada sem número) à vista em Entender, junto do que cada rodada emitiu.
 */
export function PrevisoesArquivo({
  linhas,
  total,
  omitidas,
  fonte,
  versao,
  recorte,
  avisos,
  notas,
}: {
  linhas: LinhaArquivo[];
  /** Linhas do CSV completo (o recorte pode omitir rodadas antigas). */
  total: number;
  /** Rodadas antigas fora do recorte da página (estão no CSV). */
  omitidas: number;
  fonte: string;
  versao: string;
  /** Período, universo e unidade (seção 7.2, item 3), logo abaixo da resposta. */
  recorte?: ReactNode;
  /** Avisos materiais de cada rodada (avisosDaRodada), por identificador da rodada; rodada sem entrada não tem avisos disponíveis nesta publicação. */
  avisos: Record<string, AvisoRodada[]>;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal (as rodadas) e antes da tabela de registros. */
  notas?: ReactNode;
}) {
  const datas = useMemo(() => datasInclusao(linhas), [linhas]);
  const runs = useMemo(() => Array.from(new Set(linhas.map((l) => l.run_id))), [linhas]);
  const esquema = useMemo(
    () => ({
      em: campo(tiposUrl.data({ min: datas[0], max: datas[datas.length - 1] }), "", { param: "em" }), // i18n: dado
      rod: campo(tiposUrl.opcao(runs), "" as string, { param: "rod" }),
      reg: campo(tiposUrl.texto({ max: 160 }), "", { param: "reg" }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem as listas
    [datas.join(","), runs.join(",")],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const dataBR = (iso: string | null | undefined) => dataBRBase(iso, idioma);
  const num = (x: number | null | undefined, casas = 1) => numBase(x, casas, idioma);
  const R = (x: number | null | undefined, casas = 2) => reaisMWh(x, casas, idioma);
  const noDia = arquivoAte(linhas, v.em);
  const rodadas = resumoRodadas(noDia, idioma);
  const visiveis = v.rod ? noDia.filter((l) => l.run_id === v.rod) : noDia;
  const reg = visiveis.find((l) => l.forecast_id === v.reg) ?? null;
  const grafico = linhasGraficoRodadas(rodadas, idioma);

  return (
    <div className="space-y-6">
      {/* resposta curta do painel (seção 7.2, item 2), refeita para o recorte escolhido */}
      <RespostaCurta id="p015" vivo veredito={vereditoP015(noDia, v.em, total, idioma)}>
        <span data-recorte={v.em || "tudo"}>{respostaP015(noDia, v.em, total, idioma)}</span>
      </RespostaCurta>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Ver o arquivo como estava ao fim de", "See the archive as it was at the end of")}</span>
          <input
            type="date"
            value={v.em}
            min={datas[0]}
            max={datas[datas.length - 1]}
            onChange={(e) => definir({ em: e.currentTarget.value, rod: "", reg: "" })}
            className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
          />
        </label>
        {(v.em || v.rod) && (
          <button
            type="button"
            onClick={() => definir({ em: "", rod: "", reg: "" })}
            className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
          >
            {tx("Ver o arquivo inteiro", "See the whole archive")}
          </button>
        )}
      </div>
      {(v.em || v.rod) && (
        <p className="text-xs text-carvao-muted" data-recorte-arquivo="">
          {tx(
            `Recorte: ${v.em ? `registros incluídos até ${dataBR(v.em)}` : "todos os dias"}${v.rod ? `; só a ${rodadas.find((r) => r.run_id === v.rod)?.rotulo.toLowerCase() ?? "rodada escolhida"}` : ""}.`,
            `Selection: ${v.em ? `records included up to ${dataBR(v.em)}` : "all days"}${v.rod ? `; only the ${rodadas.find((r) => r.run_id === v.rod)?.rotulo.replace(/^./, (c) => c.toLowerCase()) ?? "chosen run"}` : ""}.`,
          )}
        </p>
      )}


      {rodadas.length > 0 && (
        <SecaoDoPainel
          id="rodadas"
          titulo={tx("Rodadas registradas e as condições de cada emissão", "Recorded runs and the conditions of each issue")}
          lead={tx(
            "Cada rodada é uma emissão de previsões de um dia de origem. Os avisos de cada uma ficam junto da emissão, e não só em Auditar.",
            "Each run is an issue of forecasts for an origin day. The notices of each one stay next to the issue, and not only in Audit.",
          )}
        >
          <TabelaAdaptativa
            legenda={tx("Rodadas registradas no arquivo de emissões: emissão, células com número e avisos", "Runs recorded in the forecast archive: issue, cells with a number and notices")}
            nome="rodadas-registradas"
            colunas={colunasRodadas(v.rod, avisos, (id) => definir({ rod: id && id !== v.rod ? id : "", reg: "" }), idioma)}
            linhas={rodadas}
          />
          {grafico.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <GraficoBarras
                titulo={tx("Células por rodada, com e sem número", "Cells per run, with and without a number")}
                dados={grafico}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[
                  { id: "com_numero", rotulo: tx("com número", "with a number"), cor: "var(--cor-energia)" }, // i18n: dado
                  { id: "sem_numero", rotulo: tx("sem número", "no number"), cor: "var(--cor-mineral-soft)" },
                ]}
                unidade={tx("células", "cells")}
                casas={0}
                empilhado
                rotulosValor
                selecionado={v.rod || null}
                onSelecionar={(id) => definir({ rod: id && id !== v.rod ? id : "", reg: "" })}
                altura={260}
              />
              <div data-nivel="analisar">
                <GraficoBarras
                  titulo={tx("Atraso da emissão sobre o prazo das 08h00", "Issue delay over the 08:00 deadline")}
                  dados={grafico}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "atraso_min", rotulo: tx("atraso", "delay"), cor: "var(--cor-carvao-muted)" }]}
                  unidade={tx("minutos", "minutes")}
                  casas={0}
                  orientacao="horizontal"
                  rotulosValor
                  selecionado={v.rod || null}
                  onSelecionar={(id) => definir({ rod: id && id !== v.rod ? id : "", reg: "" })}
                />
              </div>
            </div>
          )}
        </SecaoDoPainel>
      )}

      {recorte}
      {notas}

      <TabelaInterativa
        titulo={tx("Registros do arquivo de emissões", "Forecast archive records")}
        colunas={colunasArquivoTabela(idioma)}
        linhas={visiveis}
        chaveLinha="id"
        colunaRotulo="linha"
        fonte={fonte}
        versao={versao}
        nomeArquivo={v.em ? `previsoes-pld-arquivo-ate-${v.em}` : "previsoes-pld-arquivo"}
        chaveUrl="arq"
        selecionado={reg?.id ?? null}
        onSelecionar={(id) => definir({ reg: id ?? "" })}
        dicaBusca={tx("Entrega, horizonte ou submercado", "Delivery, horizon or submarket")}
        semLinhas={
          v.em
            ? tx(`Nenhum registro estava no arquivo ao fim de ${dataBR(v.em)}.`, `No record was in the archive at the end of ${dataBR(v.em)}.`)
            : tx("O arquivo não tem registro publicado.", "The archive has no published record.")
        }
        nota={
          <>
            {tx(
              "Uma linha por célula emitida, como gravada. Cada registro guarda uma impressão digital do conteúdo e a do registro anterior, o que denuncia alteração, remoção ou reordenação. Escolha uma linha para ver o registro inteiro; o CSV completo, no download, traz todas as colunas.",
              "One row per issued cell, as recorded. Each record keeps a fingerprint of its content and that of the previous record, which exposes any change, removal or reordering. Choose a row to see the whole record; the full CSV, in the download, carries all the columns.",
            )}
            {omitidas > 0
              ? tx(
                  ` As ${omitidas} rodadas mais antigas não estão nesta página: o CSV completo, no download, tem as ${total} linhas.`,
                  ` The ${omitidas} oldest runs are not on this page: the full CSV, in the download, has all ${total} rows.`,
                )
              : ""}
            <span data-nivel="analisar">{tx(" A impressão digital é o sha256 do registro.", " The fingerprint is the record's sha256.")}</span>
          </>
        }
      />

      {reg && (
        <section aria-labelledby="registro-detalhe-titulo" className="space-y-2 border-t border-linha pt-4" data-registro={reg.forecast_id}>
          <h4 id="registro-detalhe-titulo" className="font-serif text-base text-carvao">
            {tx(`Registro ${reg.horizonte} ${reg.sm} da rodada de ${dataBR(reg.origem)}`, `Record ${reg.horizonte} ${reg.sm} of the run of ${dataBR(reg.origem)}`)}
          </h4>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Item rotulo={tx("Previsão", "Forecast")}>
              {reg.previsao === null ? tx(`sem número: ${reg.motivo || "motivo não registrado"}`, `no number: ${reg.motivo || "reason not recorded"}`) : R(reg.previsao, 4)}
            </Item>
            <Item rotulo={tx("Faixa P10 a P90", "P10 to P90 band")}>
              {reg.p10 !== null && reg.p90 !== null ? tx(`${R(reg.p10)} a ${R(reg.p90)}`, `${R(reg.p10)} to ${R(reg.p90)}`) : tx("sem faixa gravada", "no band recorded")}
            </Item>
            <Item rotulo={tx("Entrega", "Delivery")}>{reg.entrega}</Item>
            <Item rotulo={tx("Realizado", "Actual")}>
              {reg.realizado === null ? tx("ainda sem realizado (a entrega não terminou)", "no actual value yet (the delivery has not ended)") : R(reg.realizado)}
            </Item>
            <Item rotulo={tx("Corte e emissão", "Cutoff and issue")}>
              {tx(`corte em ${dataBR(reg.origem)} às 07h00; ${reg.emitido}`, `cutoff on ${dataBR(reg.origem)} at 07:00; ${reg.emitido}`)}
              {reg.atraso_min !== null && reg.atraso_min > 0 ? (
                <span data-nivel="analisar">
                  {tx(` (${num(reg.atraso_min, 1)} minutos depois do prazo; `, ` (${num(reg.atraso_min, 1)} minutes after the deadline; `)}
                  <TrechoPortugues regiao="previsoes-atraso">{reg.atraso_origem}</TrechoPortugues>)
                </span>
              ) : null}
            </Item>
            <Item rotulo={tx("Inclusão no arquivo", "Inclusion in the archive")}>
              {tx(
                `${dataBR(reg.registrado_no_portal_em)}; transcrito depois da emissão: ${reg.transcrito}`,
                `${dataBR(reg.registrado_no_portal_em)}; transcribed after issue: ${reg.transcrito}`,
              )}
            </Item>
            <Item rotulo={tx("Modelo", "Model")}>
              {reg.modelo} {reg.versao_modelo} ({reg.tipo})
            </Item>
            <Item rotulo={tx("Versão do código", "Code version")} nivel="analisar">
              {reg.versao_codigo || tx("não registrada", "not recorded")}
            </Item>
            <Item rotulo={tx("Alertas", "Alerts")} nivel="analisar">
              {reg.alertas || tx("nenhum", "none")}
            </Item>
            <Item rotulo={tx("Correção", "Correction")}>
              {reg.substitui ? tx(`substitui ${reg.substitui}`, `replaces ${reg.substitui}`) : tx("registro original (não substitui outro)", "original record (does not replace another)")}
            </Item>
            <Item rotulo={tx("sha256 do registro", "Record sha256")} nivel="analisar">
              <code className="font-mono text-xs">{reg.sha256}</code>
            </Item>
            <Item rotulo={tx("Registro anterior", "Previous record")} nivel="analisar">
              <code className="font-mono text-xs">{reg.anterior || tx("início do encadeamento particionado", "start of the partitioned chain")}</code>
            </Item>
          </dl>
        </section>
      )}
    </div>
  );
}

/** Emissão em uma palavra: agendada pela rotina ou manual. */
function modoEmissao(modo: string, idioma: Idioma): string {
  // linhasArquivo escreve o modo no idioma da página: "agendada" ou "scheduled"
  if (modo === "agendada" || modo === "scheduled") return tx("pelo agendamento", "by the schedule", idioma);
  if (modo.startsWith("manual")) return tx("manualmente", "manually", idioma);
  return modo || tx("modo não registrado", "mode not recorded", idioma);
}

/** Colunas da tabela de rodadas: a emissão, a contagem de células com número, os avisos e o botão que filtra a tabela de registros. */
function colunasRodadas(
  escolhida: string,
  avisos: Record<string, AvisoRodada[]>,
  alternar: (id: string) => void,
  idioma: Idioma,
): ColunaAdaptativa<ResumoRodada>[] {
  return [
    {
      id: "rodada",
      rotulo: tx("Rodada", "Run"),
      classe: "w-[11rem]",
      celula: (r) => (
        <>
          <span className="font-serif text-lg text-carvao">{r.rotulo}</span>
          <span className="block text-xs text-mineral">
            {r.modelo} · {r.tipo}
          </span>
        </>
      ),
    },
    {
      id: "emissao",
      rotulo: tx("Emitida em (Brasília)", "Issued on (Brasília time)"),
      classe: "w-[10rem]",
      celula: (r) => (
        <>
          {instanteBR(r.emitido_em, idioma)}
          <span className="block text-xs text-carvao-muted">{modoEmissao(r.modo, idioma)}</span>
        </>
      ),
    },
    { id: "numeros", rotulo: tx("Células com número", "Cells with a number"), classe: "w-[8rem]", celula: (r) => tx(`${r.com_numero} de ${r.celulas}`, `${r.com_numero} of ${r.celulas}`) },
    {
      id: "avisos",
      rotulo: tx("Avisos da rodada", "Run notices"),
      celula: (r) => {
        const lista = avisos[r.run_id];
        if (!lista) return <span className="text-carvao-muted">{tx("avisos desta rodada indisponíveis nesta publicação", "notices for this run unavailable in this publication")}</span>;
        return lista.length ? (
          <ul className="space-y-1.5" data-avisos-da-rodada={r.run_id}>
            {lista.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.rotulo}: </span>
                {minusculaInicial(a.texto)}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-carvao-muted">{tx("nenhum aviso registrado", "no notice recorded")}</span>
        );
      },
    },
    {
      id: "registros",
      rotulo: tx("Registros", "Records"),
      classe: "w-[9rem]",
      celula: (r) => (
        <button
          type="button"
          onClick={() => alternar(r.run_id)}
          aria-pressed={escolhida === r.run_id}
          className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-left text-sm text-carvao hover:border-energia aria-pressed:border-energia aria-pressed:bg-energia-fundo"
        >
          {escolhida === r.run_id ? tx("Mostrar todas as rodadas", "Show all runs") : tx("Ver só os registros desta rodada", "See only the records of this run")}
        </button>
      ),
    },
  ];
}

function Item({ rotulo, children, nivel }: { rotulo: string; children: ReactNode; nivel?: "analisar" | "auditar" }) {
  return (
    <div data-nivel={nivel} className="min-w-0 border-t border-linha py-1.5">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-0.5 text-carvao [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
