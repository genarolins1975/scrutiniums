"use client";

import { useId, type ReactNode } from "react";
import type { Classificacao } from "@/lib/energia/escalas";
import { FUNDO_SEM_DADO } from "@/lib/energia/mapa-calor";
import { num, plural } from "@/lib/energia/formato";
import { textoFaixa, textoForaDaFaixa, textoNumero, textoPontaFaixa, textoUniversoFaixa, textoValorMapa, type FaixaComparacao, type Medida, type ValorMapa } from "@/lib/energia/perdas";

/**
 * Distribuição das distribuidoras pela medida escolhida (taxa, volume, técnicas, não técnicas ou variação): quantas distribuidoras
 * caem em cada faixa, com as MESMAS faixas fixas e as mesmas contagens da legenda do mapa e da coluna "Classe no mapa" da tabela
 * (o `Classificacao` de classificacaoMedida), e a faixa observada (menor valor, mediana simples e maior valor, com os empates) lida do
 * mesmo seletor (faixaComparacao). O que fica de fora da comparação (valor publicado com ano incompleto ou alerta, e ausência) vem à
 * parte, com a sua contagem: não é faixa da distribuição, e ausência não é zero.
 *
 * Barras horizontais que partem do zero (a altura de cada barra é a contagem). Lista com a contagem e a participação escritas em cada
 * linha: nenhum número depende de cor ou de passar o ponteiro. A tabela equivalente fica recolhida, já no HTML do servidor.
 */

/* fundo hachurado da legenda do mapa para o valor publicado que fica fora da comparação (equivale à hachura cruzada do SVG) */
const FUNDO_FORA =
  "repeating-linear-gradient(45deg, var(--cor-mineral) 0 1px, transparent 1px 5px), repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, var(--cor-superficie) 1px 5px)";

export type PerdasDistribuicaoProps = {
  titulo: string;
  medida: Medida;
  /** Faixas fixas da medida e quantas distribuidoras comparáveis caem em cada uma. */
  classes: Classificacao;
  faixa: FaixaComparacao;
  periodo: string;
  /** Distribuidora escolhida (mapa, tabela ou ?d=), com o valor dela e a faixa em que cai. */
  escolhida: { rotulo: string; valor: ValorMapa; classe: number | null } | null;
  /** Ressalva da medida que muda a leitura das barras (ex.: a não técnica pode ser negativa), à vista sob as barras. */
  observacao?: ReactNode;
};

const participacao = (k: number, n: number) => (n ? `${num((100 * k) / n, 1)}%` : "sem dado");

export function PerdasDistribuicao({ titulo, medida, classes, faixa, periodo, escolhida, observacao }: PerdasDistribuicaoProps) {
  const uid = useId().replace(/:/g, "");
  const maior = Math.max(1, ...classes.classes.map((c) => c.contagem));
  const universo = textoUniversoFaixa(faixa);
  const foraTexto = textoForaDaFaixa(faixa);
  return (
    <figure data-grafico="distribuicao" data-orientacao="horizontal" aria-labelledby={`${uid}-t`} className="space-y-3">
      <figcaption>
        <p id={`${uid}-t`} data-titulo-grafico="" className="text-sm font-medium text-carvao">
          {titulo}
        </p>
      </figcaption>

      <ol aria-label={`Distribuidoras por faixa de ${medida.rotulo.toLowerCase()}, em ${medida.unidade}`} className="space-y-1.5">
        {classes.classes.map((c, i) => {
          const marcada = escolhida?.classe === i;
          return (
            <li
              key={c.indice}
              data-faixa-classe={c.indice}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12.5rem_minmax(0,1fr)_7rem]"
            >
              <span className="text-sm text-carvao sm:order-1 sm:text-right">{c.rotulo}</span>
              <span className="text-right text-sm tabular-nums text-carvao sm:order-3 sm:text-left">
                <span className="font-medium">{num(c.contagem, 0)}</span> <span className="text-xs text-carvao-muted">{participacao(c.contagem, faixa.n)}</span>
              </span>
              <span className="col-span-2 block border-l border-carvao-muted sm:order-2 sm:col-span-1" aria-hidden="true">
                {c.contagem > 0 && (
                  <span
                    className="block h-5 border border-mineral"
                    style={{ width: `${Math.max(1, (100 * c.contagem) / maior)}%`, background: medida.cores[i] }}
                    data-faixa-barra=""
                  />
                )}
                {c.contagem === 0 && <span className="block h-5" />}
              </span>
              {marcada && escolhida && (
                <span className="col-span-2 text-xs text-energia-dark sm:col-span-2 sm:col-start-2 sm:order-4" data-faixa-escolhida="">
                  Distribuidora escolhida nesta faixa: {escolhida.rotulo}, {textoValorMapa(escolhida.valor, medida)}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {observacao && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-faixa-observacao="">
          {observacao}
        </p>
      )}

      <ul className="space-y-1.5 border-t border-dashed border-linha pt-3 text-xs text-carvao-muted" aria-label="Fora da distribuição">
        <li className="flex items-start gap-2" data-faixa-fora="">
          <span aria-hidden="true" className="mt-0.5 inline-block h-3 w-5 shrink-0 border border-linha" style={{ background: FUNDO_FORA }} />
          <span>
            <span className="tabular-nums text-carvao">{num(faixa.fora, 0)}</span> com valor publicado fora da comparação: ano incompleto, alerta físico ou decomposição que não fecha. O número publicado e o motivo estão na tabela.
          </span>
        </li>
        <li className="flex items-start gap-2" data-faixa-sem-dado="">
          <span aria-hidden="true" className="mt-0.5 inline-block h-3 w-5 shrink-0 border border-linha" style={{ background: FUNDO_SEM_DADO }} />
          <span>
            <span className="tabular-nums text-carvao">{num(faixa.semDado, 0)}</span> sem dado no período: sem balanço publicado, ou a medida não foi publicada. Ausência não é zero e não entra em nenhuma faixa.
          </span>
        </li>
      </ul>
      {escolhida && escolhida.classe === null && (
        <p className="text-xs text-energia-dark" data-faixa-escolhida="">
          Distribuidora escolhida: {escolhida.rotulo}, {textoValorMapa(escolhida.valor, medida)}. Fica fora das faixas acima.
        </p>
      )}

      {faixa.n > 0 && faixa.minimo && faixa.maximo && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs tabular-nums text-carvao-muted" data-faixa-observada="">
          <div>
            <dt className="rotulo text-mineral">Menor valor observado</dt>
            <dd className="mt-0.5 text-carvao">{textoPontaFaixa(faixa.minimo, medida)}</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Mediana simples</dt>
            <dd className="mt-0.5 text-carvao">{textoNumero(faixa.mediana, medida)}</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Maior valor observado</dt>
            <dd className="mt-0.5 text-carvao">{textoPontaFaixa(faixa.maximo, medida)}</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Universo da faixa</dt>
            <dd className="mt-0.5 text-carvao">{universo}</dd>
          </div>
        </dl>
      )}
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Cada barra conta as distribuidoras com valor comparável cuja medida cai na faixa; as faixas são fixas, as mesmas do mapa e da tabela, e cada faixa inclui o limite inferior. Os extremos são os valores observados no
        período, não metas nem classificação de desempenho. A mediana é simples entre as distribuidoras, sem ponderar pelo tamanho, e não é o agregado das concessionárias.
      </p>

      <details className="text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({plural(classes.classes.length + 2, "linha", "linhas")})
        </summary>
        <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full min-w-[22rem] border-collapse text-xs tabular-nums">
            <caption className="mb-2 text-left text-carvao">{`${textoFaixa(faixa, medida)} ${foraTexto}`.trim()}</caption>
            <thead>
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Faixa ({medida.unidade}), {periodo}
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Distribuidoras
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Participação entre as comparáveis
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.classes.map((c) => (
                <tr key={c.indice} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                    {c.rotulo}
                  </th>
                  <td className="px-2 py-1 text-carvao">{num(c.contagem, 0)}</td>
                  <td className="px-2 py-1 text-carvao">{participacao(c.contagem, faixa.n)}</td>
                </tr>
              ))}
              <tr className="border-b border-linha">
                <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                  Fora da comparação
                </th>
                <td className="px-2 py-1 text-carvao">{num(faixa.fora, 0)}</td>
                <td className="px-2 py-1 text-mineral">não se aplica</td>
              </tr>
              <tr className="border-b border-linha">
                <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                  Sem dado
                </th>
                <td className="px-2 py-1 text-carvao">{num(faixa.semDado, 0)}</td>
                <td className="px-2 py-1 text-mineral">não se aplica</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
