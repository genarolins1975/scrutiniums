"use client";

import { useMemo } from "react";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { TabelaInterativa, type TabelaInterativaProps } from "@/components/energia/TabelaInterativa";
import { expandirLinhasTabela, type LinhaCompactaTabela } from "@/lib/energia/conta";

/**
 * Tabela que só entra na página quando o leitor a pede (`ContaSobDemanda`), com as linhas em tuplas: a página entrega, no fluxo do
 * servidor, o identificador e o valor de cada coluna, e a tela volta às linhas (`expandirLinhasTabela`) só ao abrir. As tabelas de
 * exploração e de auditoria têm dezenas ou centenas de linhas, e repetir o nome de cada coluna em cada linha pesava mais que os valores.
 * A tabela nasce aberta: o leitor acabou de pedi-la. Para a tabela que precisa de seleção sincronizada com um gráfico, o componente
 * continua sendo o `TabelaInterativa` dentro de quem guarda a seleção.
 */
export function ContaTabelaSobDemanda({
  rotulo,
  detalhe,
  linhas,
  chaveUrl,
  ...tabela
}: Omit<TabelaInterativaProps, "linhas" | "chaveUrl" | "selecionado" | "onSelecionar" | "iniciarAberta"> & {
  /** Rótulo do botão ("a lista de distribuidoras sem tarifa vigente") e o que ele traz entre parênteses. */
  rotulo: string;
  detalhe?: string;
  chaveUrl: string;
  linhas: LinhaCompactaTabela[];
}) {
  const expandidas = useMemo(() => expandirLinhasTabela(tabela.colunas, linhas), [tabela.colunas, linhas]);
  return (
    <ContaSobDemanda chaveUrl={chaveUrl} rotulo={rotulo} detalhe={detalhe}>
      <TabelaInterativa {...tabela} chaveUrl={chaveUrl} linhas={expandidas} iniciarAberta />
    </ContaSobDemanda>
  );
}
