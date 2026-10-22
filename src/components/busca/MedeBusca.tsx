"use client";

import { useEffect } from "react";
import { medirBusca } from "@/lib/busca/medir";

// o modo estrito do React em desenvolvimento repete o efeito: o mesmo termo seguido conta uma vez
let ultimo: string | null = null;

/** Conta a busca da página /buscar uma vez por termo exibido (medição agregada, src/lib/busca/medir.ts). */
export function MedeBusca({ termo }: { termo: string }) {
  useEffect(() => {
    if (!termo || termo === ultimo) return;
    ultimo = termo;
    medirBusca(termo);
  }, [termo]);
  return null;
}
