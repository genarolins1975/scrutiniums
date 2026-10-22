import Link from "next/link";
import type { ReactNode } from "react";
import type { ObservatorioInventario, PaginaInventario, TotaisInventario } from "@/lib/observatorios/inventario";
import { BuscaPlataforma } from "@/components/busca/BuscaPlataforma";
import styles from "./DiretorioPaineis.module.css";

/**
 * Mapa da área logada: a busca da plataforma (BuscaPlataforma, o mesmo índice e a mesma lista de resultados da página
 * /buscar e da barra) e, abaixo, o diretório de todas as coleções e páginas, a versão com conta do diretório que /buscar
 * mostra sem termo. Cada coleção e cada observatório abrem pelo formulário (POST em /app/observatorios/entrar, que guarda o
 * último acesso); as páginas de cada coleção são links diretos.
 */
export function DiretorioPaineis({ observatorios, totais, extras, exemplo }: {
  observatorios: ObservatorioInventario[];
  totais: TotaisInventario;
  /** Conteúdo próprio de um observatório, abaixo da pergunta (ex.: a parceria técnica). */
  extras?: Partial<Record<ObservatorioInventario["id"], ReactNode>>;
  /** Texto de exemplo do campo (EXEMPLO_DO_CAMPO, lido no servidor). */
  exemplo: string;
}) {
  return (
    <>
      <section className={styles.filtro} aria-labelledby="diretorio-titulo">
        <h1 id="diretorio-titulo">Encontre o painel</h1>
        <BuscaPlataforma variante="pagina" exemplo={exemplo} />
        <p className={styles.estado}>
          Coleções: <b>{totais.colecoes}</b>, em seis observatórios. Páginas publicadas: <b>{totais.publicadas}</b>
          {totais.parciais > 0 && <>, com cobertura parcial: <b>{totais.parciais}</b></>}
          {totais.previstas > 0 && <>, previstas e ainda sem página: <b>{totais.previstas}</b></>}. A busca procura em coleções, páginas, perguntas,
          consultas e verbetes; Enter abre o primeiro resultado.
        </p>
        <p className={styles.legenda}>
          <span><i className={styles.pontoPublicado} aria-hidden="true" /> publicado: página com dados na cobertura declarada</span>
          <span><i className={styles.pontoParcial} aria-hidden="true" /> parcial: no ar, com parte da cobertura</span>
          <span><i className={styles.pontoPrevisto} aria-hidden="true" /> previsto: consta do catálogo, ainda sem página</span>
        </p>
      </section>

      <div className={styles.diretorio}>
        {observatorios.map((o) => {
          return (
            <section key={o.id} id={`obs-${o.id}`} className={styles.grupo} aria-labelledby={`obs-${o.id}-titulo`}>
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
                  return (
                    <li key={c.id}>
                      <form method="post" action="/app/observatorios/entrar" className={styles.colecao}>
                        <input type="hidden" name="o" value={o.id} />
                        <input type="hidden" name="c" value={c.id} />
                        <button type="submit"><span className={styles.nome}>{c.nome}</span> <span aria-hidden="true">→</span></button>
                      </form>
                      <Paginas paginas={c.paginas} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Páginas da coleção, cada uma com a sua situação. */
function Paginas({ paginas }: { paginas: PaginaInventario[] }) {
  if (paginas.length === 0) return <p className={`${styles.paginas} ${styles.so}`}>só o painel de entrada</p>;
  return (
    <p className={styles.paginas}>
      {paginas.map((p, i) => {
        const classe = p.situacao === "parcial" ? styles.parcial : p.situacao === "previsto" ? styles.previsto : "";
        const texto = p.situacao === "previsto" ? `${p.titulo} (previsto)` : p.situacao === "parcial" ? `${p.titulo} (parcial)` : p.titulo;
        return (
          <span key={`${p.rota ?? p.titulo}`} className={classe}>
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
