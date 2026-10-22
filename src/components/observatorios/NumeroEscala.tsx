import type { Idioma } from "@/lib/idioma";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/**
 * Um número de escala das entradas (EntradaColecao, fatia "Escala") e dos artefatos que citam um número com a sua prova:
 * valor e unidade, e logo abaixo a fonte e o período. Valor ausente (base não lida) é "Indisponível nesta publicação", nunca
 * zero. Saiu de EntradaObservatorio.tsx (Iniciativa 4 do parecer de UX de 21/10/2026); a Iniciativa 6 o funde no kit de
 * evidência, por isso não se cria outro componente de número ao lado dele.
 */
export function NumeroEscala({ n, grande = false, idioma = "pt" }: Readonly<{ n: NumeroPorta; grande?: boolean; idioma?: Idioma }>) {
  return (
    <>
      {n.valor === null ? (
        <span className="block text-base text-carvao">{idioma === "en" ? "Unavailable in this publication" : "Indisponível nesta publicação"}</span>
      ) : (
        <span className="block">
          <span className={`font-label leading-none tabular-nums text-carvao ${grande ? "text-[2.1rem]" : "text-[1.35rem]"}`}>{n.valor}</span>{" "}
          <span className="text-sm text-carvao-muted">{n.unidade}</span>
        </span>
      )}
      <span className="mt-2 block text-xs leading-relaxed text-mineral" data-prova-numero="">
        {n.fonte} · {n.periodo}
      </span>
    </>
  );
}
