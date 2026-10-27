"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { CopiarLinkRecorte } from "./CopiarLinkRecorte";
import { DetalhesRecorte } from "./DetalhesRecorte";

export type RecorteVisivel = { id: string; titulo: string; caminho: string; observatorio: string; criadoEm: string };

const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const acao = "rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-bronze disabled:opacity-50";

/**
 * "Meus recortes" na conta: título (link para o próprio recorte), observatório e data em que foi salvo, com renomear e
 * apagar. A lista inicial vem do servidor; as mudanças passam por /api/conta/recortes/[id].
 */
export function MeusRecortes({ iniciais, limite }: { iniciais: RecorteVisivel[]; limite: number }) {
  const [lista, setLista] = useState(iniciais);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const campo = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => { if (editando) entrada.current?.focus(); }, [editando]);
  function encerrarEdicao(id: string) {
    setEditando(null);
    requestAnimationFrame(() => botoes.current[id]?.focus());
  }

  async function renomear(id: string) {
    setOcupado(id);
    setErro("");
    try {
      const r = await fetch(`/api/conta/recortes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: rascunho }),
      });
      const j = (await r.json().catch(() => ({}))) as { recorte?: { titulo: string }; error?: string };
      if (!r.ok || !j.recorte) throw new Error(j.error ?? "Não foi possível renomear. Tente de novo.");
      setLista((l) => l.map((x) => (x.id === id ? { ...x, titulo: j.recorte!.titulo } : x)));
      encerrarEdicao(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível renomear. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function apagar(id: string, titulo: string) {
    if (!window.confirm(`Apagar o recorte "${titulo}"?`)) return;
    setOcupado(id);
    setErro("");
    try {
      const r = await fetch(`/api/conta/recortes/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setLista((l) => l.filter((x) => x.id !== id));
      requestAnimationFrame(() => listaRef.current?.focus());
    } catch {
      setErro("Não foi possível apagar. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div ref={listaRef} tabIndex={-1} aria-label="Meus recortes salvos" className="space-y-5">
      <p className="max-w-prose2 text-sm text-carvao-muted">
        Nos painéis, use <strong className="font-semibold text-carvao">Salvar recorte</strong>, na barra superior, para guardar a
        página com os filtros do endereço. O link de cada recorte pode ser compartilhado: quem não tem conta entra ou se cadastra
        e volta a ele. Até {limite} recortes por conta.
      </p>
      <p className="max-w-prose2 text-sm text-carvao-muted">Ao reabrir, a consulta usa os dados disponíveis naquele momento. Salvar um recorte não arquiva os valores de uma publicação anterior.</p>
      {erro && <Alert kind="erro">{erro}</Alert>}
      {lista.length === 0 ? (
        <p className="text-sm text-carvao">Nenhum recorte salvo ainda. <Link href="/app" className="underline underline-offset-4">Explore as coleções no Mapa da Conta.</Link></p>
      ) : (
        <ul className="divide-y divide-linha border-y border-linha">
          {lista.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {editando === r.id ? (
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renomear(r.id);
                    }}
                  >
                    <label htmlFor={`${campo}-${r.id}`} className="sr-only">
                      Novo título do recorte
                    </label>
                    <input
                      ref={entrada}
                      id={`${campo}-${r.id}`}
                      value={rascunho}
                      maxLength={120}
                      required
                      onChange={(e) => setRascunho(e.target.value)}
                      className="min-h-[44px] w-full max-w-md border border-linha bg-papel px-3 py-2 text-base text-carvao focus:border-bronze"
                    />
                    <button type="submit" className={acao} disabled={ocupado === r.id}>
                      Salvar título
                    </button>
                    <button type="button" className={acao} onClick={() => encerrarEdicao(r.id)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <Link href={r.caminho} className="font-serif text-lg leading-snug text-carvao underline-offset-4 hover:text-bronze hover:underline">
                    {r.titulo}
                  </Link>
                )}
                <p className="mt-1 text-xs text-carvao-muted">
                  {r.observatorio} · salvo em {dataBr(r.criadoEm)}
                </p>
                <DetalhesRecorte caminho={r.caminho} />
              </div>
              {editando !== r.id && (
                <div className="flex min-w-0 flex-wrap items-start gap-x-4 sm:max-w-xs sm:shrink-0">
                  <CopiarLinkRecorte caminho={r.caminho} classe={acao} titulo={r.titulo} />
                  <button
                    ref={(el) => { botoes.current[r.id] = el; }}
                    type="button"
                    className={acao}
                    onClick={() => {
                      setEditando(r.id);
                      setRascunho(r.titulo);
                    }}
                  >
                    Renomear
                  </button>
                  <button type="button" className={acao} disabled={ocupado === r.id} onClick={() => apagar(r.id, r.titulo)}>
                    Apagar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
