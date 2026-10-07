"use client";

import { useId } from "react";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import type { MultiplosVisao, PainelDeterminante } from "@/lib/energia/tipos-visao";
import {
  JANELAS_P005,
  ROTA_VISAO,
  URL_GOLD_VISAO,
  bandaDeterminante,
  colunasMultiplos,
  dadosDeterminante,
  leituraDeterminante,
  linhasMultiplos,
  recorteMultiplos,
  seriesDeterminante,
  valorAtualTexto,
  type JanelaP005,
} from "@/lib/energia/visao";

/**
 * Determinantes alinhados (P005): cinco gráficos pequenos sobre o mesmo calendário (os
 * últimos 30, 60 ou 90 dias do recorte publicado), cada um com a sua referência de
 * comparação (faixa histórica, quartis, mesmo dia da semana do ano anterior, zero), o
 * valor atual com "Comprove este número" e a leitura frente à referência. O cursor é
 * sincronizado pela data entre os cinco; a tabela abaixo tem exatamente as linhas do
 * recorte exibido (as mesmas que a exportação grava).
 *
 * Estado na URL (seção 7.3): janela (p005.dias), submercados ocultos no preço (p005.sm)
 * e fronteiras ocultas na rede (p005.fr), com voltar e avançar. As âncoras antigas da
 * página inicial (preco, agua, geracao, consumo, rede e as variantes -painel) chegam
 * aqui pelo id de cada cartão.
 */

const ESQUEMA = {
  dias: campo(tiposUrl.opcao(JANELAS_P005), "90" as JanelaP005, { param: "p005.dias" }),
  sm: campo(tiposUrl.lista(tiposUrl.texto({ max: 24 }), { max: 4 }), [] as string[], { param: "p005.sm" }),
  fr: campo(tiposUrl.lista(tiposUrl.texto({ max: 24 }), { max: 4 }), [] as string[], { param: "p005.fr" }),
};

export type AncorasDeterminante = { id: string; painel: string };

function Cartao({
  p,
  i,
  m,
  linhas,
  ancoras,
  ocultas,
  onOcultas,
}: {
  p: PainelDeterminante;
  i: number;
  m: MultiplosVisao;
  linhas: MultiplosVisao["dados"];
  ancoras?: AncorasDeterminante;
  ocultas?: string[];
  onOcultas?: (ids: string[]) => void;
}) {
  const dados = dadosDeterminante(p, linhas);
  const banda = bandaDeterminante(p);
  const series = seriesDeterminante(p);
  const multi = p.colunas.length > 1;
  return (
    <section id={ancoras?.id} aria-labelledby={`p005-${p.id}-titulo`} className="scroll-mt-28 min-w-0 border border-linha bg-superficie p-4">
      <div id={ancoras?.painel} className="scroll-mt-28">
        <h4 id={`p005-${p.id}-titulo`} className="font-serif text-lg text-carvao">
          {p.titulo}{" "}
          <span className="ml-1 font-sans text-sm text-mineral">{p.pergunta}</span>
        </h4>
        <p className="mt-1 text-sm text-carvao">
          <span className="font-serif text-xl tabular-nums" data-valor-atual={p.id}>
            {valorAtualTexto(p)}
          </span>
          {p.valor_atual.rotulo && <span className="ml-2 text-carvao-muted">{p.valor_atual.rotulo}</span>}
          <span className="ml-2 text-xs text-mineral">
            {p.id === "geracao" ? `7 dias até ${dataBR(p.data_referencia)}` : dataBR(p.data_referencia)}
          </span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{leituraDeterminante(p, m)}</p>
        <p className="mt-0.5 text-xs text-mineral">{p.texto_defasagem}</p>
        <div className="mt-1">
          {p.evidencia ? (
            <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `multiplos.paineis[${i}].evidencia`, indicador: p.evidencia.indicador, valorExibido: p.evidencia.valor_exibido }} endereco={`${ROTA_VISAO}#${ancoras?.id ?? "determinantes"}`} />
          ) : (
            <span className="text-xs text-aviso">Evidência do valor atual não publicada nesta execução{p.evidencia_problemas?.length ? `: ${p.evidencia_problemas.join("; ")}` : "."}</span>
          )}
        </div>
      </div>
      <div className="mt-2">
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
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
        Referência: {p.referencia.rotulo}. {p.nota}{" "}
        <a href={p.href} className="text-energia-dark underline underline-offset-4">
          Ver no painel de origem
        </a>
      </p>
    </section>
  );
}

export function VisaoDeterminantes({ m, ancoras, fonte }: { m: MultiplosVisao; ancoras: Partial<Record<string, AncorasDeterminante>>; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const nome = useId();
  const linhas = recorteMultiplos(m, Number(v.dias));
  const inicio = linhas[0]?.d;
  const fim = linhas[linhas.length - 1]?.d;
  const colunas = colunasMultiplos(m);

  return (
    <div className="space-y-4">
      <fieldset className="min-w-0">
        <legend className="rotulo text-mineral">Janela comum aos cinco gráficos</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
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
      </fieldset>
      <p className="text-xs text-carvao-muted" aria-live="polite">
        Exibindo {linhas.length} dias, de {dataBR(inicio)} a {dataBR(fim)}. O cursor de um gráfico marca a mesma data nos outros quatro.
      </p>
      <CursorSincronizado>
        <div className="grid gap-4 lg:grid-cols-2">
          {m.paineis.map((p, i) => (
            <Cartao
              key={p.id}
              p={p}
              i={i}
              m={m}
              linhas={linhas}
              ancoras={ancoras[p.id]}
              ocultas={p.id === "preco" ? v.sm : p.id === "rede" ? v.fr : undefined}
              onOcultas={p.id === "preco" ? (ids) => definir({ sm: ids }) : p.id === "rede" ? (ids) => definir({ fr: ids }) : undefined}
            />
          ))}
        </div>
      </CursorSincronizado>
      <div data-nivel="analisar">
        <TabelaInterativa
          titulo={`Os cinco determinantes, dia a dia, de ${dataBR(inicio)} a ${dataBR(fim)}`}
          colunas={colunas}
          linhas={linhasMultiplos(linhas)}
          chaveLinha="id"
          colunaRotulo="d"
          fonte={fonte}
          versao={m.janela.fim}
          nomeArquivo="visao-geral-determinantes"
          chaveUrl="p005.t"
          ordemInicial={{ coluna: "d", direcao: "desc" }}
          nota="Célula vazia é dia sem valor na base publicada de origem (nunca zero). Mesmas linhas dos cinco gráficos, na janela escolhida."
        />
      </div>
    </div>
  );
}
