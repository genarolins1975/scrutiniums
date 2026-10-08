"use client";

import { useMemo, type ReactNode } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num } from "@/lib/energia/formato";
import {
  COLUNAS_ARQUIVO,
  arquivoAte,
  datasInclusao,
  linhasGraficoRodadas,
  reaisMWh,
  respostaP015,
  resumoRodadas,
  type LinhaArquivo,
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
 */
export function PrevisoesArquivo({
  linhas,
  total,
  omitidas,
  fonte,
  versao,
  recorte,
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
      <p className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg" aria-live="polite" data-resposta="p015" data-recorte={v.em || "tudo"}>
        {respostaP015(noDia, v.em, total)}
      </p>
      {recorte}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm text-carvao">
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
      )}

      <TabelaInterativa
        titulo="Registros do arquivo de emissões"
        colunas={COLUNAS_ARQUIVO}
        linhas={visiveis}
        chaveLinha="id"
        colunaRotulo="forecast_id"
        fonte={fonte}
        versao={versao}
        nomeArquivo={v.em ? `previsoes-pld-arquivo-ate-${v.em}` : "previsoes-pld-arquivo"}
        chaveUrl="arq"
        selecionado={reg?.id ?? null}
        onSelecionar={(id) => definir({ reg: id ?? "" })}
        dicaBusca="Entrega, horizonte, submercado ou sha256"
        semLinhas={v.em ? `Nenhum registro estava no arquivo ao fim de ${dataBR(v.em)}.` : "O arquivo não tem registro publicado."}
        nota={
          <>
            Uma linha por célula emitida, como gravada; o sha256 de cada registro e o do anterior formam o encadeamento que denuncia alteração, remoção ou reordenação.
            Escolha uma linha para ver versão do código, alertas, correção e o sha256 do registro anterior; o CSV completo, no download, traz todas as colunas.
            {omitidas > 0 ? ` As ${omitidas} rodadas mais antigas não estão nesta página: o CSV completo, no download, tem as ${total} linhas.` : ""}
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
              {reg.atraso_min !== null && reg.atraso_min > 0 ? ` (${num(reg.atraso_min, 1)} minutos depois do prazo; ${reg.atraso_origem})` : ""}
            </Item>
            <Item rotulo="Inclusão no arquivo">
              {dataBR(reg.registrado_no_portal_em)}; transcrito depois da emissão: {reg.transcrito}
            </Item>
            <Item rotulo="Modelo e código">
              {reg.modelo} {reg.versao_modelo} ({reg.tipo}); código {reg.versao_codigo || "não registrado"}
            </Item>
            <Item rotulo="Alertas">{reg.alertas || "nenhum"}</Item>
            <Item rotulo="Correção">{reg.substitui ? `substitui ${reg.substitui}` : "registro original (não substitui outro)"}</Item>
            <Item rotulo="sha256">
              <span className="font-mono text-xs">{reg.sha256}</span>
            </Item>
            <Item rotulo="Registro anterior">
              <span className="font-mono text-xs">{reg.anterior || "início do encadeamento particionado"}</span>
            </Item>
          </dl>
        </section>
      )}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-linha py-1.5">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-0.5 text-carvao [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
