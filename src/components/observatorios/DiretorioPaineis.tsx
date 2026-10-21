"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ColecaoInventario, ObservatorioInventario, PaginaInventario, TotaisInventario } from "@/lib/observatorios/inventario";
import styles from "./DiretorioPaineis.module.css";

/**
 * Diretório das coleções com filtro enquanto digita (mapa da área logada).
 * O servidor entrega o inventário inteiro; aqui a lista só encolhe: sem
 * JavaScript, tudo continua visível e cada coleção abre pelo formulário.
 * Enter abre a primeira coleção à vista (POST em /app/observatorios/entrar,
 * que guarda o último acesso). As páginas de cada coleção são links diretos.
 */
export function DiretorioPaineis({ observatorios, totais, extras }: {
  observatorios: ObservatorioInventario[];
  totais: TotaisInventario;
  /** Conteúdo próprio de um observatório, abaixo da pergunta (ex.: a parceria técnica). */
  extras?: Partial<Record<ObservatorioInventario["id"], ReactNode>>;
}) {
  const [termo, setTermo] = useState("");
  const idCampo = useId();
  const diretorio = useRef<HTMLDivElement>(null);

  const palavras = useMemo(() => normalizar(termo).split(/\s+/).filter(Boolean), [termo]);
  const visiveis = useMemo(() => {
    const porColecao = new Map<string, boolean>();
    for (const o of observatorios) for (const c of o.colecoes) porColecao.set(`${o.id}/${c.id}`, bate(o, c, palavras));
    return porColecao;
  }, [observatorios, palavras]);
  const total = Array.from(visiveis.values()).filter(Boolean).length;
  const filtrando = palavras.length > 0;

  function abrirPrimeira(e: React.FormEvent) {
    e.preventDefault();
    const primeira = diretorio.current?.querySelector<HTMLFormElement>("li:not([hidden]) form[data-abre-colecao]");
    primeira?.requestSubmit();
  }

  return (
    <>
      <section className={styles.filtro} aria-labelledby={`${idCampo}-titulo`}>
        <h1 id={`${idCampo}-titulo`}>Encontre o painel enquanto digita</h1>
        <form className={styles.campo} role="search" onSubmit={abrirPrimeira}>
          <label htmlFor={idCampo} className="sr-only">Filtrar as coleções por nome, tema, fonte ou página</label>
          <input
            id={idCampo}
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="conta de luz, esgoto, PLD, Ideb, botijão, dívida dos estados…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button type="submit" disabled={total === 0}>Abrir a primeira</button>
        </form>
        <p className={styles.estado} aria-live="polite">
          {filtrando
            ? total === 0
              ? "Nenhuma coleção com esse termo."
              : <>Coleções à vista: <b>{total}</b> de {totais.colecoes}. Enter abre a primeira.</>
            : <>Coleções: <b>{totais.colecoes}</b>, em seis observatórios. Páginas publicadas: <b>{totais.publicadas}</b>
                {totais.parciais > 0 && <>, com cobertura parcial: <b>{totais.parciais}</b></>}
                {totais.previstas > 0 && <>, previstas e ainda sem página: <b>{totais.previstas}</b></>}. A lista encolhe conforme você digita; Enter abre a primeira coleção.</>}
        </p>
        <p className={styles.legenda}>
          <span><i className={styles.pontoPublicado} aria-hidden="true" /> publicado: página com dados na cobertura declarada</span>
          <span><i className={styles.pontoParcial} aria-hidden="true" /> parcial: no ar, com parte da cobertura</span>
          <span><i className={styles.pontoPrevisto} aria-hidden="true" /> previsto: consta do catálogo, ainda sem página</span>
        </p>
      </section>

      <div className={styles.diretorio} ref={diretorio}>
        {observatorios.map((o) => {
          const algum = o.colecoes.some((c) => visiveis.get(`${o.id}/${c.id}`));
          return (
            <section key={o.id} id={`obs-${o.id}`} className={styles.grupo} hidden={!algum} aria-labelledby={`obs-${o.id}-titulo`}>
              <h2 id={`obs-${o.id}-titulo`}>
                {o.entrada ? (
                  <form method="post" action="/app/observatorios/entrar">
                    <input type="hidden" name="o" value={o.id} />
                    <button type="submit">{o.nomeCurto}</button>
                  </form>
                ) : o.nomeCurto}
              </h2>
              <p className={styles.pergunta}>{o.pergunta}</p>
              {extras?.[o.id]}
              <ul>
                {o.colecoes.map((c) => {
                  const mostra = visiveis.get(`${o.id}/${c.id}`) ?? true;
                  return (
                    <li key={c.id} hidden={!mostra}>
                      <form method="post" action="/app/observatorios/entrar" data-abre-colecao className={styles.colecao}>
                        <input type="hidden" name="o" value={o.id} />
                        <input type="hidden" name="c" value={c.id} />
                        <button type="submit"><span className={styles.nome}>{c.nome}</span> <span aria-hidden="true">→</span></button>
                      </form>
                      <Paginas paginas={c.paginas} palavras={palavras} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {filtrando && total === 0 && (
        <p className={styles.nada}>
          Nenhum painel com <q>{termo.trim()}</q>. Tente outra palavra, o nome de uma fonte (ONS, IBGE, ANP) ou o tema em palavras comuns.
        </p>
      )}
    </>
  );
}

/** Páginas da coleção, cada uma com a sua situação; a página que bate com o termo fica sublinhada. */
function Paginas({ paginas, palavras }: { paginas: PaginaInventario[]; palavras: string[] }) {
  if (paginas.length === 0) return <p className={`${styles.paginas} ${styles.so}`}>só o painel de entrada</p>;
  return (
    <p className={styles.paginas}>
      {paginas.map((p, i) => {
        const marcada = palavras.length > 0 && palavras.every((w) => normalizar(p.titulo).includes(w));
        const classe = p.situacao === "parcial" ? styles.parcial : p.situacao === "previsto" ? styles.previsto : "";
        const texto = p.situacao === "previsto" ? `${p.titulo} (previsto)` : p.situacao === "parcial" ? `${p.titulo} (parcial)` : p.titulo;
        return (
          <span key={`${p.rota ?? p.titulo}`} className={`${classe} ${marcada ? styles.bate : ""}`}>
            {i > 0 && <span aria-hidden="true" className={styles.sep}> · </span>}
            {p.rota ? (
              <Link href={p.rota} prefetch={false}>{texto}</Link>
            ) : (
              <span title={p.pendencia}>{texto}</span>
            )}
          </span>
        );
      })}
    </p>
  );
}

function bate(o: ObservatorioInventario, c: ColecaoInventario, palavras: string[]): boolean {
  if (palavras.length === 0) return true;
  const texto = normalizar([o.nomeCurto, o.pergunta, c.nome, c.termos, ...c.paginas.map((p) => p.titulo)].join(" "));
  return palavras.every((w) => texto.includes(w));
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
