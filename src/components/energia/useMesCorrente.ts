import { useEffect, useState } from "react";
import { mesCorrenteBrasilia } from "@/lib/energia/bandeira-do-mes";

/* Sem "use client": é módulo de hooks, importado por componentes de cliente. */

/**
 * Mês corrente em Brasília para componentes de cliente. O HTML estático sai com `inicial` (o mês em que a página foi gerada), para a
 * hidratação não divergir; depois de montar, vale o mês de quem lê. Assim uma página gerada em outubro e lida em novembro diz que a
 * bandeira de novembro ainda não está no arquivo, em vez de chamar a de outubro de vigente.
 */
export function useMesCorrente(inicial: string): string {
  const [mes, setMes] = useState(inicial);
  useEffect(() => {
    setMes(mesCorrenteBrasilia());
  }, []);
  return mes;
}
