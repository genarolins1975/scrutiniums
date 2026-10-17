"use client";

import { useState, type ReactNode } from "react";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { useTx } from "@/lib/energia/useIdioma";

/**
 * Uma figura por vez, com a escolha da fonte acima: a página entrega os gráficos de eólicas e de fotovoltaicas já montados no servidor e o
 * navegador desenha só o escolhido. Assim o HTML da página leva um gráfico, não dois, e a pessoa compara trocando a opção.
 */
export function EscolhaFonte({ nome, opcoes, conteudo }: { nome: string; opcoes: readonly (readonly [string, string])[]; conteudo: Record<string, ReactNode> }) {
  const [valor, setValor] = useState(opcoes[0]?.[0] ?? "");
  const tx = useTx();
  if (opcoes.length < 2) return <>{conteudo[valor]}</>;
  return (
    <div className="space-y-3" data-escolha-fonte={nome}>
      <TransicaoOpcoes rotulo={tx("Fonte", "Source")} nome={nome} opcoes={opcoes} valor={valor} onMudar={setValor} />
      {conteudo[valor]}
    </div>
  );
}
