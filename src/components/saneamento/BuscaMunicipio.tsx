"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buscarMunicipios, type ItemIndice } from "@/lib/saneamento/municipios";

/**
 * Busca por nome do município (sem geolocalização). O índice (código, nome,
 * UF) é baixado no primeiro foco. Combobox ARIA: setas percorrem, Enter abre
 * a ficha, Esc limpa. Aceita "Nome UF" para desambiguar (ex.: "Bom Jesus PI").
 */
let indicePromessa: Promise<ItemIndice[]> | null = null;
function carregarIndice(): Promise<ItemIndice[]> {
  if (!indicePromessa) {
    indicePromessa = fetch("/saneamento/gold/indice.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ItemIndice[]>;
      })
      .catch((e) => {
        indicePromessa = null;
        throw e;
      });
  }
  return indicePromessa;
}

export function BuscaMunicipio({
  destino = (id) => `/saneamento/municipio/${id}`,
  rotulo = "Como está o saneamento no meu município?",
  aoEscolher,
  grande = false,
}: {
  destino?: (id: string) => string;
  rotulo?: string;
  aoEscolher?: (item: ItemIndice) => void;
  grande?: boolean;
}) {
  const router = useRouter();
  const uid = useId().replace(/:/g, "");
  const [indice, setIndice] = useState<ItemIndice[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const lista = useRef<HTMLUListElement>(null);
  const resultados = indice ? buscarMunicipios(indice, q) : [];

  const preparar = () => {
    if (indice || erro) return;
    carregarIndice().then(setIndice, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => setAtivo(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const escolher = (it: ItemIndice) => {
    setAberto(false);
    if (aoEscolher) {
      aoEscolher(it);
      setQ("");
    } else router.push(destino(it[0]));
  };

  return (
    <div className="relative max-w-xl">
      <label htmlFor={`busca-${uid}`} className={grande ? "font-serif text-xl text-carvao md:text-2xl" : "text-sm text-carvao"}>
        {rotulo}
      </label>
      <input
        id={`busca-${uid}`}
        type="search"
        role="combobox"
        aria-expanded={aberto && resultados.length > 0}
        aria-controls={`lista-${uid}`}
        aria-autocomplete="list"
        aria-activedescendant={aberto && resultados[ativo] ? `op-${uid}-${ativo}` : undefined}
        autoComplete="off"
        placeholder="Digite o nome do município"
        value={q}
        onFocus={() => {
          preparar();
          setAberto(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(a + 1, Math.max(0, resultados.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && resultados[ativo]) {
            e.preventDefault();
            escolher(resultados[ativo]);
          } else if (e.key === "Escape") {
            setQ("");
            setAberto(false);
          }
        }}
        className={`mt-2 block w-full border border-mineral bg-superficie px-4 text-carvao placeholder:text-carvao-muted ${grande ? "min-h-[52px] text-lg" : "min-h-[44px] text-base"}`}
      />
      <p className="mt-1 text-xs text-carvao-muted" aria-live="polite">
        {erro
          ? `Não foi possível carregar a lista de municípios (${erro}).`
          : q.trim().length >= 2 && indice
            ? resultados.length
              ? `${resultados.length} ${resultados.length === 1 ? "município encontrado" : "municípios encontrados"}. Use as setas e Enter.`
              : "Nenhum município com esse nome. Confira a grafia ou acrescente a UF."
            : "Sem localização automática: a busca é só pelo nome. Para nomes repetidos, acrescente a UF."}
      </p>
      {aberto && resultados.length > 0 && (
        <ul
          ref={lista}
          id={`lista-${uid}`}
          role="listbox"
          aria-label="Municípios encontrados"
          className="absolute inset-x-0 z-30 mt-1 max-h-80 overflow-y-auto border border-linha bg-superficie shadow-[0_8px_24px_rgba(26,29,33,0.12)]"
        >
          {resultados.map((it, i) => (
            <li
              key={it[0]}
              id={`op-${uid}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === ativo}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(it);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 text-sm ${i === ativo ? "bg-obee-fundo text-carvao" : "text-carvao"}`}
            >
              <span>{it[1]}</span>
              <span className="text-carvao-muted">{it[2]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
