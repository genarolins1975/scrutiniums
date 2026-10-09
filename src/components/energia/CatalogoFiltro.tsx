"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/** Busca sem distinção de acento nem de caixa ("geracao" encontra "Geração"). */
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type ItemCatalogo = {
  id: string;
  slug: string | null;
  orgao: string;
  titulo: string;
  url: string;
  tema: string;
  estado: string;
  formatos: string[];
  modificado: string | null;
  verificado: boolean;
  descontinuado: boolean;
};

const TEMAS: Record<string, string> = {
  preco: "Preço",
  hidrologia: "Hidrologia",
  geracao: "Geração",
  carga: "Carga",
  rede: "Rede",
  distribuicao: "Distribuição",
  expansao: "Expansão",
  regulacao: "Regulação",
  empresas: "Empresas",
  mercado: "Mercado",
  outros: "Outros",
};

/** Catálogo filtrável: busca por texto e filtros por órgão, tema e estado, numa só linha. */
export function CatalogoFiltro({ itens }: { itens: ItemCatalogo[] }) {
  const [q, setQ] = useState("");
  const [orgao, setOrgao] = useState("");
  const [tema, setTema] = useState("");
  const [estado, setEstado] = useState("");
  const orgaos = useMemo(() => Array.from(new Set(itens.map((i) => i.orgao))).sort(), [itens]);
  const estados = useMemo(() => Array.from(new Set(itens.map((i) => i.estado))), [itens]);
  const filtrados = itens.filter(
    (i) =>
      (!orgao || i.orgao === orgao) &&
      (!tema || i.tema === tema) &&
      (!estado || i.estado === estado) &&
      (!q || semAcento(i.titulo).includes(semAcento(q))),
  );
  const sel = "min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao";
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-mineral">
          Buscar
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="nome do conjunto" className={sel} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-mineral">
          Órgão
          <select value={orgao} onChange={(e) => setOrgao(e.target.value)} className={sel}>
            <option value="">Todos</option>
            {orgaos.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-mineral">
          Tema
          <select value={tema} onChange={(e) => setTema(e.target.value)} className={sel}>
            <option value="">Todos</option>
            {Object.entries(TEMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-mineral">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={sel}>
            <option value="">Todos</option>
            {estados.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-mineral" aria-live="polite">{filtrados.length} de {itens.length} conjuntos</p>
      <ul className="mt-3 divide-y divide-linha border-y border-linha">
        {filtrados.map((i) => (
          <li key={i.id} className="grid gap-1 py-3 md:grid-cols-[5.5rem_1fr_11rem_auto] md:items-baseline md:gap-4">
            <span className="rotulo text-mineral">{i.orgao}</span>
            <span className="text-sm text-carvao">
              {i.slug ? (
                <Link href={`/setor-eletrico/dados/${i.slug}`} className="font-medium underline underline-offset-4">{i.titulo}</Link>
              ) : (
                i.titulo
              )}
              <span className="ml-2 text-xs text-mineral">{TEMAS[i.tema] ?? i.tema}{i.formatos.length ? ` · ${i.formatos.slice(0, 4).join(", ")}` : ""}</span>
              {!i.verificado && <span className="ml-2 text-xs text-aviso">metadados a conferir</span>}
              {i.descontinuado && <span className="ml-2 text-xs text-mineral">descontinuado na fonte</span>}
            </span>
            <span className={`rotulo !text-xs ${i.estado === "CATALOGADO" ? "text-mineral" : "text-energia-dark"}`}>{i.estado}</span>
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">fonte ↗</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
