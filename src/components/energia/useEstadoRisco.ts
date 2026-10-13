"use client";
import { useEffect, useRef } from "react";
import { gravarNaUrl, type Esquema } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "./useEstadoUrl";

/** A troca entre laboratórios desmonta o anterior. Persiste a última edição
 * antes dessa troca, inclusive se o debounce de um slider/restauração não terminou. */
export function useEstadoRisco<E extends Esquema>(esquema:E){
  const resultado=useEstadoUrl(esquema);
  const atual=useRef(resultado[0]);
  atual.current=resultado[0];
  useEffect(()=>{
    const persistir=()=>{gravarNaUrl(window,esquema,atual.current,"replace");};
    window.addEventListener("scrutiniums:riscos-gravar",persistir);
    return ()=>window.removeEventListener("scrutiniums:riscos-gravar",persistir);
  },[esquema]);
  return resultado;
}
