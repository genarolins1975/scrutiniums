"use client";

import { useEffect, useState } from "react";
import { ANALISE_ALTERADA, prepararEnderecoAnalise } from "@/lib/painel/enderecoAnalise";

/** O endereço mostrado acompanha ilhas, âncoras e histórico; cada ação recaptura antes de usar. */
export function useEnderecoAnalise() {
  const [caminho, definir] = useState("");
  useEffect(() => {
    let ativo = true;
    // Primeiro todos os ouvintes restauram as ilhas; depois montamos o endereço.
    const atualizar = () => queueMicrotask(() => { if (ativo) definir(prepararEnderecoAnalise()); });
    const eventos = [ANALISE_ALTERADA, "scrutiniums:estado-url", "selecao-gas", "popstate", "hashchange"];
    atualizar();
    eventos.forEach((evento) => window.addEventListener(evento, atualizar));
    return () => {
      ativo = false;
      eventos.forEach((evento) => window.removeEventListener(evento, atualizar));
    };
  }, []);
  return caminho;
}
