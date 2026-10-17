"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_PROPRIETARIOS, COR_MEDIDA, ESQUEMA_ATIVOS, grupoDoProprietario, inteiro, linhasProprietarios } from "@/lib/energia/empresas";
import type { Proprietario } from "@/lib/energia/tipos-empresas";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P036, os maiores proprietários diretos (capacidade proporcional e capacidade sob controle direto lado a lado, nunca somadas): as
 * barras dos dez primeiros e a tabela dos trinta, com as mesmas linhas (linhasProprietarios), que também alimentam a exportação.
 * Escolher uma barra ou uma linha filtra o mapa das usinas pelo grupo do proprietário (o topo da cadeia declarada, ou ele mesmo
 * quando é o topo) e abre o mapa: o parâmetro é o mesmo do mapa (?at.g=), então o voltar desfaz a escolha nos dois.
 */
export function EmpresasProprietarios({
  proprietarios,
  totalComCnpj,
  csv,
  fonte,
  versao,
}: {
  proprietarios: Proprietario[];
  /** Proprietários com CNPJ nas usinas de todas as fases, para dizer quantos o gráfico e a tabela deixam de fora. */
  totalComCnpj: number;
  /** Arquivo com a lista inteira dos proprietários. */
  csv: { rotulo: string; url: string } | null;
  fonte: string;
  versao: string;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const I = (x: number) => inteiro(x, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_ATIVOS);
  const linhas = useMemo(() => linhasProprietarios(proprietarios, idioma), [proprietarios, idioma]);
  const barras = useMemo(() => linhas.slice(0, 10), [linhas]);
  // a linha acesa é o primeiro proprietário do grupo escolhido no mapa
  const selecionado = v.grupo ? (proprietarios.find((p) => grupoDoProprietario(p) === v.grupo)?.cnpj ?? null) : null;
  const escolher = (id: string | null) => {
    const p = proprietarios.find((x) => x.cnpj === id);
    definir(p ? { grupo: grupoDoProprietario(p), mapa: true } : { grupo: "" });
  };
  return (
    <div className="space-y-4">
      <GraficoBarras
        rotulosSaoNomes
        titulo={tx("Capacidade proporcional e capacidade sob controle direto dos 10 maiores proprietários diretos", "Proportional capacity and capacity under direct control of the 10 largest direct owners")}
        dados={barras}
        chaveCategoria="id"
        chaveRotulo="nome"
        series={[
          { id: "mw_proporcional", rotulo: tx("Capacidade proporcional", "Proportional capacity"), cor: COR_MEDIDA.proporcional },
          { id: "mw_controle_direto", rotulo: tx("Capacidade sob controle direto", "Capacity under direct control"), cor: COR_MEDIDA.controle },
        ]}
        unidade="MW"
        casas={1}
        orientacao="horizontal"
        alturaCategoria={56}
        alturaMaxima={barras.length * 56}
        selecionado={selecionado}
        onSelecionar={escolher}
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-universo-parcial="proprietarios">
        {tx(
          <>
            O gráfico mostra {I(barras.length)} dos {I(proprietarios.length)} maiores proprietários diretos, de {I(totalComCnpj)} CNPJ com participação em usinas; a tabela abaixo traz os{" "}
            {I(proprietarios.length)}, e a lista inteira está no{" "}
          </>,
          <>
            The chart shows {I(barras.length)} of the {I(proprietarios.length)} largest direct owners, out of {I(totalComCnpj)} CNPJs with stakes in plants; the table below lists the{" "}
            {I(proprietarios.length)}, and the full list is in the{" "}
          </>,
        )}
        {csv ? (
          <a href={csv.url} download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
            {csv.rotulo}
          </a>
        ) : (
          tx("CSV de proprietários", "owners CSV")
        )}
        {tx(
          ". Capacidade proporcional reparte a usina entre os donos pela participação; capacidade sob controle direto conta a usina inteira para quem tem mais de 50% dela. Uma não é parte da outra.",
          ". Proportional capacity splits the plant among the owners by stake; capacity under direct control counts the whole plant for whoever holds more than 50% of it. One is not part of the other.",
        )}
      </p>
      <TabelaInterativa
        titulo={tx(`Os ${proprietarios.length} maiores proprietários diretos por capacidade proporcional`, `The ${proprietarios.length} largest direct owners by proportional capacity`)}
        colunas={COLUNAS_PROPRIETARIOS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={versao}
        nomeArquivo="empresas-proprietarios-maiores"
        chaveUrl="at.prop"
        ordemInicial={{ coluna: "mw_proporcional", direcao: "desc" }}
        selecionado={selecionado}
        onSelecionar={escolher}
        dicaBusca={tx("Nome ou CNPJ", "Name or CNPJ")}
        nota={tx("Escolher uma linha ou uma barra filtra o mapa das usinas pelo grupo do proprietário.", "Choosing a row or a bar filters the plant map by the owner's group.")}
      />
    </div>
  );
}
