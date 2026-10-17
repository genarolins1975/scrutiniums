"use client";

import { useMemo } from "react";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { TabelaInterativa, type TabelaInterativaProps } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { CAMPO_VALORES, expandirLinhasTabela, linhasEmReais, tabelaTemReal, type LinhaCompactaTabela, type ReaisDaTabela } from "@/lib/energia/conta";
import { useTx } from "@/lib/energia/useIdioma";

/**
 * Tabela que só entra na página quando o leitor a pede (`ContaSobDemanda`), com as linhas em tuplas: a página entrega, no fluxo do
 * servidor, o identificador e o valor de cada coluna, e a tela volta às linhas (`expandirLinhasTabela`) só ao abrir. As tabelas de
 * exploração e de auditoria têm dezenas ou centenas de linhas, e repetir o nome de cada coluna em cada linha pesava mais que os valores.
 * A tabela nasce aberta: o leitor acabou de pedi-la. Para a tabela que precisa de seleção sincronizada com um gráfico, o componente
 * continua sendo o `TabelaInterativa` dentro de quem guarda a seleção.
 *
 * Com `reais`, a tabela traz dinheiro e segue a escolha Nominais ou Em reais (?valores=) do painel: em reais, as colunas de valor saem
 * multiplicadas pelo fator do ano (ou por um fator só, quando a tabela é de um ano), e o título, o nome do arquivo e a nota dizem a moeda,
 * para que o que se vê e o que se exporta (a exportação leva o título e a nota) falem a mesma moeda do gráfico e do número de destaque.
 */
export function ContaTabelaSobDemanda({
  rotulo,
  detalhe,
  linhas,
  chaveUrl,
  reais,
  ...tabela
}: Omit<TabelaInterativaProps, "linhas" | "chaveUrl" | "selecionado" | "onSelecionar" | "iniciarAberta"> & {
  /** Rótulo do botão ("a lista de distribuidoras sem tarifa vigente") e o que ele traz entre parênteses. */
  rotulo: string;
  detalhe?: string;
  chaveUrl: string;
  linhas: LinhaCompactaTabela[];
  reais?: ReaisDaTabela;
}) {
  const [v] = useEstadoUrl({ valores: CAMPO_VALORES });
  const tx = useTx();
  const expandidas = useMemo(() => expandirLinhasTabela(tabela.colunas, linhas), [tabela.colunas, linhas]);
  const emReais = tabelaTemReal(reais) && v.valores === "real";
  const doModo = useMemo(() => (emReais && reais ? linhasEmReais(expandidas, reais) : expandidas), [emReais, reais, expandidas]);
  const base = reais?.base ?? null;
  const titulo = reais
    ? emReais
      ? tx(`${tabela.titulo}, em reais de ${base} (corrigidos pelo IPCA)`, `${tabela.titulo}, in ${base} reais (adjusted by the IPCA)`)
      : tx(`${tabela.titulo}, em valores nominais (da época)`, `${tabela.titulo}, in nominal values (of the time)`)
    : tabela.titulo;
  // o mês-base vem no idioma da página ("ago/2026", "Aug 2026"): no nome do arquivo, sem barra nem espaço
  const nomeArquivo = reais && emReais && base ? `${tabela.nomeArquivo}-reais-${base.replace("/", "-").replace(/\s+/g, "-")}` : tabela.nomeArquivo;
  const nota = reais ? (
    <>
      {tabela.nota}
      {tabela.nota ? " " : ""}
      {emReais
        ? tx(
            `Valores em reais de ${base}: cada valor nominal é multiplicado pelo índice do IPCA de ${base} dividido pela média dos índices mensais do ano.`,
            `Values in ${base} reais: each nominal value is multiplied by the IPCA index for ${base} divided by the average of the year's monthly indices.`,
          )
        : tx("Valores nominais, na moeda da época; a escolha Em reais, acima dos gráficos, corrige pelo IPCA.", "Nominal values, in the currency of the time; the In reais option, above the charts, adjusts by the IPCA.")}
    </>
  ) : (
    tabela.nota
  );
  return (
    <ContaSobDemanda chaveUrl={chaveUrl} rotulo={rotulo} detalhe={detalhe}>
      <TabelaInterativa {...tabela} titulo={titulo} nomeArquivo={nomeArquivo} nota={nota} chaveUrl={chaveUrl} linhas={doModo} iniciarAberta />
    </ContaSobDemanda>
  );
}
