"use client";

import { useId, useMemo } from "react";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import type { IdPainelMultiplo, LinhaMultiplos } from "@/lib/energia/tipos-visao";
import {
  JANELAS_P005,
  ROTA_VISAO,
  URL_GOLD_VISAO,
  bandaDeterminante,
  comUnidade,
  dadosDeterminante,
  linhasDeColunas,
  linhasMultiplos,
  periodoDaJanela,
  seriesDeterminante,
  type DeterminantesLeves,
  type JanelaP005,
  type PainelLeve,
} from "@/lib/energia/visao";

/**
 * Determinantes alinhados (P005): cinco gráficos pequenos sobre o mesmo calendário (os últimos 30, 60 ou 90 dias do recorte
 * publicado), cada um com a sua referência de comparação (faixa histórica, quartis, mesmo dia da semana do ano anterior, zero), o
 * valor do dia de referência com "Comprove este número" e a leitura frente à referência. O cursor é sincronizado pela data; a
 * tabela de Analisar tem exatamente as linhas da janela exibida (as mesmas que a exportação grava).
 *
 * O valor do cartão, o gráfico, a tabela, o anúncio por teclado e o arquivo exportado leem a mesma célula (a EAR do SIN com a
 * precisão da série publicada, arredondada uma só vez). O campo "Período" segue a janela escolhida. A mediana da data da água é
 * uma série desenhada, não só uma faixa. As fichas de prova não viajam nas props: são lidas da gold ao abrir.
 *
 * Estado na URL: janela (p005.dias), submercados ocultos no preço (p005.sm) e fronteiras ocultas na rede (p005.fr), com voltar e
 * avançar. As âncoras antigas da página inicial (preco, agua, geracao, consumo, rede e as variantes -painel) chegam aqui pelo id de
 * cada cartão.
 */

const ESQUEMA = {
  dias: campo(tiposUrl.opcao(JANELAS_P005), "90" as JanelaP005, { param: "p005.dias" }),
  sm: campo(tiposUrl.lista(tiposUrl.texto({ max: 24 }), { max: 4 }), [] as string[], { param: "p005.sm" }),
  fr: campo(tiposUrl.lista(tiposUrl.texto({ max: 24 }), { max: 4 }), [] as string[], { param: "p005.fr" }),
};

export type AncorasDeterminante = { id: string; painel: string };

/** Valor de uma coluna no dia dado, ou null se o dia não existe ou não tem valor. */
function valorNoDia(todas: readonly LinhaMultiplos[], dia: string, coluna: string): number | null {
  const x = todas.find((l) => l.d === dia)?.[coluna];
  return typeof x === "number" ? x : null;
}

function Cartao({
  p,
  d,
  todas,
  linhas,
  ancoras,
  ocultas,
  onOcultas,
  notas,
}: {
  p: PainelLeve;
  d: DeterminantesLeves;
  todas: readonly LinhaMultiplos[];
  linhas: readonly LinhaMultiplos[];
  ancoras?: AncorasDeterminante;
  ocultas?: string[];
  onOcultas?: (ids: string[]) => void;
  /** Pontes entre este número e o da mesma grandeza em outro corte ou em outro módulo, escritas a partir da gold (visao.ts). */
  notas?: readonly string[];
}) {
  const extras = d.extras[p.id] ?? [];
  const dados = dadosDeterminante(p, linhas, extras);
  const banda = bandaDeterminante(p);
  const series = seriesDeterminante(p, extras);
  const multi = p.colunas.length > 1;
  const fmt = (v: number | null) => comUnidade(v, p.unidade, p.casas);
  // o valor das séries extras (a mediana da data) no dia de referência do painel, lido da mesma linha do gráfico
  const doDia = extras.map((e) => ({ rotulo: e.rotulo, valor: valorNoDia(todas, p.dataReferencia, e.id) })).filter((x) => x.valor !== null);
  return (
    <section id={ancoras?.id} aria-labelledby={`p005-${p.id}-titulo`} className="scroll-mt-28 min-w-0 border border-linha bg-superficie p-4">
      <div id={ancoras?.painel} className="scroll-mt-28">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0">
          <h3 id={`p005-${p.id}-titulo`} className="ed-h3 font-serif text-carvao">
            {p.titulo}
          </h3>
          <p className="text-xs text-carvao-muted">{p.pergunta}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-0">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="font-serif text-[1.625rem] leading-tight tabular-nums text-carvao" data-valor-atual={p.id}>
              {p.valorTexto}
            </span>
            {p.rotuloValor && <span className="text-sm text-carvao-muted">{p.rotuloValor}</span>}
            <span className="text-xs text-carvao-muted">{p.id === "geracao" ? `7 dias até ${dataBR(p.dataReferencia)}` : dataBR(p.dataReferencia)}</span>
          </p>
          {p.comprove ? (
            <ComproveNumero
              sobDemanda={{ url: URL_GOLD_VISAO, caminho: p.comprove.caminho, indicador: p.comprove.indicador, valorExibido: p.comprove.valorExibido }}
              endereco={`${ROTA_VISAO}#${ancoras?.id ?? "determinantes"}`}
            />
          ) : (
            <span className="text-xs text-aviso">Prova do valor não publicada nesta execução{p.semEvidencia ? `: ${p.semEvidencia}` : "."}</span>
          )}
        </div>
      </div>
      <div className="mt-1">
        <GraficoLinhas
          titulo={`${p.titulo}: ${p.colunas.map((c) => c.rotulo).join(", ")}`}
          dados={dados}
          chaveX="d"
          series={series}
          unidade={p.unidade}
          casas={p.casas}
          banda={banda}
          zeroNoEixo={p.referencia.tipo === "zero"}
          altura={200}
          rotulosDiretos={false}
          legendaInterativa={multi}
          ocultas={multi ? ocultas : undefined}
          onOcultas={multi ? onOcultas : undefined}
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-carvao">{p.leitura}</p>
      {doDia.length > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-referencia-do-dia={p.id}>
          {doDia.map((x) => `${x.rotulo}: ${fmt(x.valor)}`).join("; ")}.
        </p>
      )}
      {p.id === "preco" && (
        <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-precos-do-dia="">
          Mesmo dia nos quatro submercados: {p.colunas.map((c) => `${c.rotulo} ${fmt(valorNoDia(todas, p.dataReferencia, c.id))}`).join("; ")}.
        </p>
      )}
      <p data-nivel="analisar" className="mt-1 text-xs text-mineral">
        {p.defasagem}
      </p>
      {notas && notas.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-linha pt-3 text-xs leading-relaxed text-carvao" data-nota-determinante={p.id}>
          {notas.map((n, i) => (
            <p key={n}>
              {i === 0 && <span className="rotulo mr-2 text-mineral">Para ler junto</span>}
              {n}
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
        Referência: {p.referencia.rotulo}.{extras.length > 0 ? ` Linha tracejada: ${extras.map((e) => e.rotulo.toLowerCase()).join("; ")}.` : ""} {p.nota}{" "}
        <a href={p.href} className="text-energia-dark underline underline-offset-4">
          Ver no painel de origem
        </a>
      </p>
    </section>
  );
}

export function VisaoDeterminantes({
  d,
  ancoras,
  fonte,
  notas = {},
}: {
  d: DeterminantesLeves;
  ancoras: Partial<Record<string, AncorasDeterminante>>;
  fonte: string;
  notas?: Partial<Record<IdPainelMultiplo, readonly string[]>>;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const nome = useId();
  const todas = useMemo(() => linhasDeColunas(d.campos, d.linhas), [d.campos, d.linhas]);
  const n = Number(v.dias);
  const linhas = useMemo(() => todas.slice(-Math.max(1, Math.min(n, todas.length))), [todas, n]);
  const inicio = linhas[0]?.d;
  const fim = linhas[linhas.length - 1]?.d;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <div role="radiogroup" aria-labelledby={`${nome}-rotulo`} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span id={`${nome}-rotulo`} className="rotulo text-mineral">
            Janela dos cinco gráficos
          </span>
          <div className="flex flex-wrap gap-1.5">
            {JANELAS_P005.map((j) => {
              const ativo = j === v.dias;
              return (
                <label
                  key={j}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center border px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-energia ${
                    ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
                  }`}
                >
                  <input type="radio" name={nome} value={j} checked={ativo} onChange={() => definir({ dias: j })} className="sr-only" />
                  Últimos {j} dias
                </label>
              );
            })}
          </div>
        </div>
        <p className="min-w-0 text-xs leading-relaxed text-carvao-muted" data-periodo-determinantes="" aria-live="polite">
          <span className="rotulo mr-1.5 text-mineral">Período</span>
          {periodoDaJanela(linhas)}
        </p>
      </div>
      <CursorSincronizado>
        <div className="grid gap-4 lg:grid-cols-2">
          {d.paineis.map((p) => (
            <Cartao
              key={p.id}
              p={p}
              d={d}
              todas={todas}
              linhas={linhas}
              ancoras={ancoras[p.id]}
              notas={notas[p.id]}
              ocultas={p.id === "preco" ? v.sm : p.id === "rede" ? v.fr : undefined}
              onOcultas={p.id === "preco" ? (ids) => definir({ sm: ids }) : p.id === "rede" ? (ids) => definir({ fr: ids }) : undefined}
            />
          ))}
        </div>
      </CursorSincronizado>
      <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-2" data-recorte-determinantes="">
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5 leading-relaxed">PLD por submercado; EAR e carga do SIN; participação térmica do SIN em 7 dias; intercâmbio nas fronteiras do ONS. O cursor de um gráfico marca a mesma data nos outros quatro.</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5 leading-relaxed">{d.paineis.map((p) => `${p.titulo.toLowerCase()} em ${p.unidade}`).join("; ")}</dd>
        </div>
      </dl>
      <SecaoDoPainel nivel="analisar" id="determinantes-tabela" titulo="Os cinco determinantes como tabela, dia a dia">
        <TabelaInterativa
          titulo={`Os cinco determinantes, dia a dia, de ${dataBR(inicio)} a ${dataBR(fim)}`}
          colunas={d.colunasTabela}
          linhas={linhasMultiplos(linhas)}
          chaveLinha="id"
          colunaRotulo="d"
          fonte={fonte}
          versao={d.janela.fim}
          nomeArquivo="visao-geral-determinantes"
          chaveUrl="p005.t"
          ordemInicial={{ coluna: "d", direcao: "desc" }}
          nota="Célula vazia é dia sem valor na base publicada de origem (nunca zero). Mesmas linhas dos cinco gráficos, na janela escolhida, e a mesma EAR do cartão, arredondada uma só vez."
        />
      </SecaoDoPainel>
    </div>
  );
}
