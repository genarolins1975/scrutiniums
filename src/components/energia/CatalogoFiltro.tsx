"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/** Busca sem distinção de acento nem de caixa ("geracao" encontra "Geração"). */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  descricao?: string;
};

/** Conjuntos mostrados de saída; o restante abre sob demanda para a página não virar diretório. */
const LIMITE = 30;

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

/**
 * Explorador do catálogo: busca por texto (título e descrição), filtros por
 * órgão, tema e estado, chips de tema com contagem e a posição de cada conjunto
 * na esteira de integração (seis degraus). Não é um diretório de arquivos: é o
 * estado do que a plataforma sabe sobre cada fonte.
 */
export function CatalogoFiltro({ itens, estados }: { itens: ItemCatalogo[]; estados: string[] }) {
  const [q, setQ] = useState("");
  const [orgao, setOrgao] = useState("");
  const [tema, setTema] = useState("");
  const [estado, setEstado] = useState("");
  const [soVerificados, setSoVerificados] = useState(false);
  const [todos, setTodos] = useState(false);
  const orgaos = useMemo(() => Array.from(new Set(itens.map((i) => i.orgao))).sort(), [itens]);
  const porTema = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of itens) m[i.tema] = (m[i.tema] ?? 0) + 1;
    return m;
  }, [itens]);
  const filtrados = itens.filter(
    (i) =>
      (!orgao || i.orgao === orgao) &&
      (!tema || i.tema === tema) &&
      (!estado || i.estado === estado) &&
      (!soVerificados || i.verificado) &&
      (!q || semAcento(`${i.titulo} ${i.descricao ?? ""}`).includes(semAcento(q))),
  );
  const sel = "min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao";
  const degrau = (e: string) => Math.max(0, estados.indexOf(e));
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-mineral">
          Buscar no título e na descrição
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="ex.: reservatório, tarifa, leilão" className={sel} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-mineral">
          Órgão
          <select value={orgao} onChange={(e) => setOrgao(e.target.value)} className={sel}>
            <option value="">Todos</option>
            {orgaos.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-mineral">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={sel}>
            <option value="">Todos</option>
            {estados.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-xs text-mineral">
          <input type="checkbox" checked={soVerificados} onChange={(e) => setSoVerificados(e.target.checked)} className="h-4 w-4 accent-[var(--cor-energia)]" />
          só metadados verificados na API oficial
        </label>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Temas">
        <li>
          <button type="button" aria-pressed={tema === ""} onClick={() => setTema("")} className={`rotulo min-h-[36px] border px-2.5 ${tema === "" ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}>
            todos · {itens.length}
          </button>
        </li>
        {Object.entries(TEMAS)
          .filter(([k]) => porTema[k])
          .map(([k, v]) => (
            <li key={k}>
              <button type="button" aria-pressed={tema === k} onClick={() => setTema(tema === k ? "" : k)} className={`rotulo min-h-[36px] border px-2.5 ${tema === k ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}>
                {v} · {porTema[k]}
              </button>
            </li>
          ))}
      </ul>
      <p className="mt-3 text-xs text-mineral" aria-live="polite">
        {filtrados.length} de {itens.length} conjuntos
      </p>
      <ul className="mt-3 divide-y divide-linha border-y border-linha">
        {(todos ? filtrados : filtrados.slice(0, LIMITE)).map((i) => (
          <li key={i.id} className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 py-3 md:grid-cols-[5.5rem_1fr_9rem_auto] md:items-center md:gap-4">
            <span className="rotulo text-mineral">{i.orgao}</span>
            <span className="min-w-0 text-sm text-carvao">
              {i.slug ? (
                <Link href={`/setor-eletrico/dados/${i.slug}`} className="font-medium underline underline-offset-4">{i.titulo}</Link>
              ) : (
                i.titulo
              )}
              <span className="ml-2 text-xs text-mineral">{TEMAS[i.tema] ?? i.tema}{i.formatos.length ? ` · ${i.formatos.slice(0, 4).join(", ")}` : ""}</span>
              {!i.verificado && <span className="ml-2 text-xs text-aviso">metadados a conferir</span>}
              {i.descontinuado && <span className="ml-2 text-xs text-mineral">descontinuado na fonte</span>}
            </span>
            <span className="col-start-2 flex flex-col gap-1 md:col-start-auto" title={`Estado: ${i.estado}`}>
              <span className="flex gap-0.5" aria-hidden="true">
                {estados.map((e, k) => (
                  <span key={e} className={`h-1.5 flex-1 ${k <= degrau(i.estado) ? "bg-energia" : "bg-linha"}`} />
                ))}
              </span>
              <span className={`rotulo ${i.estado === "CATALOGADO" ? "text-mineral" : "text-energia-dark"}`}>{i.estado}</span>
            </span>
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="rotulo col-start-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 md:col-start-auto">fonte ↗</a>
          </li>
        ))}
      </ul>
      {!todos && filtrados.length > LIMITE && (
        <button type="button" onClick={() => setTodos(true)} className="rotulo mt-4 inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
          Mostrar os {filtrados.length - LIMITE} restantes
        </button>
      )}
    </div>
  );
}
