"use client";

import { useMemo } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_PROPRIETARIOS, ESQUEMA_ATIVOS, linhasProprietarios, grupoDoProprietario } from "@/lib/energia/empresas";
import type { Proprietario } from "@/lib/energia/tipos-empresas";

/**
 * P036, os maiores proprietários diretos (capacidade proporcional e capacidade sob controle
 * direto lado a lado, nunca somadas). Escolher um proprietário filtra o mapa das usinas pelo
 * grupo dele (o topo da cadeia declarada, ou ele mesmo quando é o topo) e abre o mapa: o
 * parâmetro é o mesmo do mapa (?at.g=), então o voltar desfaz a escolha nos dois.
 */
export function EmpresasProprietarios({ proprietarios, fonte, versao }: { proprietarios: Proprietario[]; fonte: string; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ATIVOS);
  const linhas = useMemo(() => linhasProprietarios(proprietarios), [proprietarios]);
  // a linha acesa é o primeiro proprietário do grupo escolhido no mapa
  const selecionado = v.grupo ? (proprietarios.find((p) => grupoDoProprietario(p) === v.grupo)?.cnpj ?? null) : null;
  return (
    <TabelaInterativa
      titulo={`Os ${proprietarios.length} maiores proprietários diretos por capacidade proporcional`}
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
      onSelecionar={(id) => {
        const p = proprietarios.find((x) => x.cnpj === id);
        definir(p ? { grupo: grupoDoProprietario(p), mapa: true } : { grupo: "" });
      }}
      dicaBusca="Nome ou CNPJ"
      nota="Escolher uma linha filtra o mapa das usinas pelo grupo do proprietário. A lista inteira (todos os proprietários com CNPJ) está no CSV de proprietários."
    />
  );
}
