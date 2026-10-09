"use client";

import { useMemo, type ReactNode } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaAdaptativa, type ColunaAdaptativa } from "@/components/energia/PrevisoesTabela";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num } from "@/lib/energia/formato";
import {
  COLUNAS_ARQUIVO_TABELA,
  arquivoAte,
  datasInclusao,
  instanteBR,
  linhasGraficoRodadas,
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
      em: campo(tiposUrl.data({ min: datas[0], max: datas[datas.length - 1] }), "", { param: "em" }),
      rod: campo(tiposUrl.opcao(runs), "" as string, { param: "rod" }),
      reg: campo(tiposUrl.texto({ max: 160 }), "", { param: "reg" }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem as listas
    [datas.join(","), runs.join(",")],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const noDia = arquivoAte(linhas, v.em);
  const rodadas = resumoRodadas(noDia);
  const visiveis = v.rod ? noDia.filter((l) => l.run_id === v.rod) : noDia;
  const reg = visiveis.find((l) => l.forecast_id === v.reg) ?? null;
  const grafico = linhasGraficoRodadas(rodadas);

  return (
    <div className="space-y-6">
      {/* resposta curta do painel (seção 7.2, item 2), refeita para o recorte escolhido */}
      <RespostaCurta id="p015" vivo veredito={vereditoP015(noDia, v.em, total)}>
        <span data-recorte={v.em || "tudo"}>{respostaP015(noDia, v.em, total)}</span>
      </RespostaCurta>
      {recorte}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Ver o arquivo como estava ao fim de</span>
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
            Ver o arquivo inteiro
          </button>
        )}
      </div>
      {(v.em || v.rod) && (
        <p className="text-xs text-carvao-muted" data-recorte-arquivo="">
          Recorte: {v.em ? `registros incluídos até ${dataBR(v.em)}` : "todos os dias"}
          {v.rod ? `; só a ${rodadas.find((r) => r.run_id === v.rod)?.rotulo.toLowerCase() ?? "rodada escolhida"}` : ""}.
        </p>
      )}


      {rodadas.length > 0 && (
        <SecaoDoPainel
          id="rodadas"
          titulo="Rodadas registradas e as condições de cada emissão"
          lead="Cada rodada é uma emissão de previsões de um dia de origem. Os avisos de cada uma ficam junto da emissão, e não só em Auditar."
        >
          <TabelaAdaptativa
            legenda="Rodadas registradas no arquivo de emissões: emissão, células com número e avisos"
            nome="rodadas-registradas"
            colunas={colunasRodadas(v.rod, avisos, (id) => definir({ rod: id && id !== v.rod ? id : "", reg: "" }))}
            linhas={rodadas}
          />
          {grafico.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <GraficoBarras
                titulo="Células por rodada, com e sem número"
                dados={grafico}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[
                  { id: "com_numero", rotulo: "com número", cor: "var(--cor-energia)" },
                  { id: "sem_numero", rotulo: "sem número", cor: "var(--cor-mineral-soft)" },
                ]}
                unidade="células"
                casas={0}
                empilhado
                rotulosValor
                selecionado={v.rod || null}
                onSelecionar={(id) => definir({ rod: id && id !== v.rod ? id : "", reg: "" })}
                altura={260}
              />
              <div data-nivel="analisar">
                <GraficoBarras
                  titulo="Atraso da emissão sobre o prazo das 08h00"
                  dados={grafico}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "atraso_min", rotulo: "atraso", cor: "var(--cor-carvao-muted)" }]}
                  unidade="minutos"
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

      {notas}

      <TabelaInterativa
        titulo="Registros do arquivo de emissões"
        colunas={COLUNAS_ARQUIVO_TABELA}
        linhas={visiveis}
        chaveLinha="id"
        colunaRotulo="linha"
        fonte={fonte}
        versao={versao}
        nomeArquivo={v.em ? `previsoes-pld-arquivo-ate-${v.em}` : "previsoes-pld-arquivo"}
        chaveUrl="arq"
        selecionado={reg?.id ?? null}
        onSelecionar={(id) => definir({ reg: id ?? "" })}
        dicaBusca="Entrega, horizonte ou submercado"
        semLinhas={v.em ? `Nenhum registro estava no arquivo ao fim de ${dataBR(v.em)}.` : "O arquivo não tem registro publicado."}
        nota={
          <>
            Uma linha por célula emitida, como gravada. Cada registro guarda uma impressão digital do conteúdo e a do registro anterior, o que denuncia alteração, remoção
            ou reordenação. Escolha uma linha para ver o registro inteiro; o CSV completo, no download, traz todas as colunas.
            {omitidas > 0 ? ` As ${omitidas} rodadas mais antigas não estão nesta página: o CSV completo, no download, tem as ${total} linhas.` : ""}
            <span data-nivel="analisar"> A impressão digital é o sha256 do registro.</span>
          </>
        }
      />

      {reg && (
        <section aria-labelledby="registro-detalhe-titulo" className="space-y-2 border-t border-linha pt-4" data-registro={reg.forecast_id}>
          <h4 id="registro-detalhe-titulo" className="font-serif text-base text-carvao">
            Registro {reg.horizonte} {reg.sm} da rodada de {dataBR(reg.origem)}
          </h4>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Item rotulo="Previsão">{reg.previsao === null ? `sem número: ${reg.motivo || "motivo não registrado"}` : reaisMWh(reg.previsao, 4)}</Item>
            <Item rotulo="Faixa P10 a P90">{reg.p10 !== null && reg.p90 !== null ? `${reaisMWh(reg.p10)} a ${reaisMWh(reg.p90)}` : "sem faixa gravada"}</Item>
            <Item rotulo="Entrega">{reg.entrega}</Item>
            <Item rotulo="Realizado">{reg.realizado === null ? "ainda sem realizado (a entrega não terminou)" : reaisMWh(reg.realizado)}</Item>
            <Item rotulo="Corte e emissão">
              corte em {dataBR(reg.origem)} às 07h00; {reg.emitido}
              {reg.atraso_min !== null && reg.atraso_min > 0 ? <span data-nivel="analisar">{` (${num(reg.atraso_min, 1)} minutos depois do prazo; ${reg.atraso_origem})`}</span> : null}
            </Item>
            <Item rotulo="Inclusão no arquivo">
              {dataBR(reg.registrado_no_portal_em)}; transcrito depois da emissão: {reg.transcrito}
            </Item>
            <Item rotulo="Modelo">
              {reg.modelo} {reg.versao_modelo} ({reg.tipo})
            </Item>
            <Item rotulo="Versão do código" nivel="analisar">
              {reg.versao_codigo || "não registrada"}
            </Item>
            <Item rotulo="Alertas" nivel="analisar">
              {reg.alertas || "nenhum"}
            </Item>
            <Item rotulo="Correção">{reg.substitui ? `substitui ${reg.substitui}` : "registro original (não substitui outro)"}</Item>
            <Item rotulo="sha256 do registro" nivel="analisar">
              <span className="font-mono text-xs">{reg.sha256}</span>
            </Item>
            <Item rotulo="Registro anterior" nivel="analisar">
              <span className="font-mono text-xs">{reg.anterior || "início do encadeamento particionado"}</span>
            </Item>
          </dl>
        </section>
      )}
    </div>
  );
}

/** Emissão em uma palavra: agendada pela rotina ou manual. */
function modoEmissao(modo: string): string {
  if (modo === "agendada") return "pelo agendamento";
  if (modo.startsWith("manual")) return "manualmente";
  return modo || "modo não registrado";
}

/** Colunas da tabela de rodadas: a emissão, a contagem de células com número, os avisos e o botão que filtra a tabela de registros. */
function colunasRodadas(
  escolhida: string,
  avisos: Record<string, AvisoRodada[]>,
  alternar: (id: string) => void,
): ColunaAdaptativa<ResumoRodada>[] {
  return [
    {
      id: "rodada",
      rotulo: "Rodada",
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
      rotulo: "Emitida em (Brasília)",
      classe: "w-[10rem]",
      celula: (r) => (
        <>
          {instanteBR(r.emitido_em)}
          <span className="block text-xs text-carvao-muted">{modoEmissao(r.modo)}</span>
        </>
      ),
    },
    { id: "numeros", rotulo: "Células com número", classe: "w-[8rem]", celula: (r) => `${r.com_numero} de ${r.celulas}` },
    {
      id: "avisos",
      rotulo: "Avisos da rodada",
      celula: (r) => {
        const lista = avisos[r.run_id];
        if (!lista) return <span className="text-carvao-muted">avisos desta rodada indisponíveis nesta publicação</span>;
        return lista.length ? (
          <ul className="space-y-1.5" data-avisos-da-rodada={r.run_id}>
            {lista.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.rotulo}: </span>
                {a.texto}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-carvao-muted">nenhum aviso registrado</span>
        );
      },
    },
    {
      id: "registros",
      rotulo: "Registros",
      classe: "w-[9rem]",
      celula: (r) => (
        <button
          type="button"
          onClick={() => alternar(r.run_id)}
          aria-pressed={escolhida === r.run_id}
          className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-left text-sm text-carvao hover:border-energia aria-pressed:border-energia aria-pressed:bg-energia-fundo"
        >
          {escolhida === r.run_id ? "Mostrar todas as rodadas" : "Ver só os registros desta rodada"}
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
