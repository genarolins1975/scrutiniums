import type { ReactNode } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import dynamic from "next/dynamic";
import { TextoDaColuna } from "@/components/painel/TextoDaColuna";
import { idiomaDaPagina, tx } from "@/lib/painel/idioma";
import type { ColunaTabela, LinhaTabela } from "@/lib/painel/tabela";
import type { CelulaTabela, TabelaDadosProps } from "@/lib/painel/tipos";

/** A tabela ordenável (TabelaInterativa) só chega ao navegador quando alguma página pede `ordenavel`: a TabelaDados estática, usada também
 * dentro de componentes de cliente, não leva o explorador inteiro no pacote da página. */
const TabelaInterativa = dynamic(() => import("@/components/painel/TabelaInterativa").then((m) => m.TabelaInterativa));

/**
 * Tabela do kit de painel (Iniciativa 1 do parecer de UX de 23/10/2026), generalizada da tabela equivalente do Setor Elétrico. Duas
 * formas, as duas marcadas `data-tabela-dados` (o teste do molde não aceita `<table>` fora delas):
 *
 * - recolhida (padrão): a tabela equivalente de um gráfico, em `<details>`, com as últimas `limite` linhas e o arquivo da série
 *   completa (rota de servidor fechada, com o selo "com conta");
 * - à vista (`recolhida={false}`): a tabela da fatia `tabelas`.
 *
 * Cabeçalho semântico (`<th scope>`), números à direita com algarismos tabulares, a primeira coluna como cabeçalho de linha. Zero é
 * número; ausência é sempre texto ("sem dado", ou o que `ausencia` disser por coluna: "não elegível", "não publicado"), nunca traço
 * sem legenda. No celular a tabela rola dentro do próprio bloco (`tabela-scroll`), com a primeira coluna fixa quando pedida; a página
 * nunca rola na horizontal. Com `ordenavel`, a tabela é a TabelaInterativa (ordenação com estado visível e `aria-sort`, exportação do
 * navegador só com conta, por ExportacaoComConta).
 */
export function TabelaDados({
  titulo,
  colunas,
  linhas,
  csv,
  limite = 30,
  casas,
  idiomaTexto,
  ordenavel = false,
  ausencia,
  fixarPrimeiraColuna = false,
  recolhida = true,
  nota,
  idioma: idiomaFixo,
  tituloVisivel,
  lead,
  id,
  nivel,
  destaqueUltimaLinha = false,
  linhasDestacadas = [],
}: TabelaDadosProps) {
  const idioma = idiomaFixo ?? idiomaDaPagina();
  const locale = idioma === "en" ? "en-US" : "pt-BR";
  const n = (x: number) => x.toLocaleString(locale);
  const formata = (v: number, c: number | null | undefined) =>
    (typeof c === "number" ? v.toLocaleString(locale, { minimumFractionDigits: c, maximumFractionDigits: c }) : v.toLocaleString(locale, { maximumFractionDigits: 2 })).replace(/^-/, "−");
  const semDado = (j: number) => ausencia?.[colunas[j]] ?? tx("sem dado", "no data", idioma);
  // coluna numérica: todas as células não nulas são números
  const numerica = colunas.map((_, j) => linhas.some((l) => typeof l[j] === "number") && linhas.every((l) => l[j] === null || l[j] === undefined || typeof l[j] === "number"));

  if (ordenavel) {
    const cols: ColunaTabela[] = colunas.map((c, j) => ({
      id: `c${j}`,
      rotulo: c,
      tipo: numerica[j] ? "numero" : "texto",
      casas: casas?.[j] ?? undefined,
      idiomaTexto: idiomaTexto?.[j] ?? undefined,
    }));
    // a tabela ordenável guarda valores (texto e número); nó marcado vira o próprio texto
    const valor = (v: CelulaTabela) => (v === null || typeof v === "string" || typeof v === "number" ? v : null);
    const dados: LinhaTabela[] = linhas.map((l, i) => Object.fromEntries([["_id", String(i)], ...l.map((v, j) => [`c${j}`, valor(v)] as const)]));
    return (
      <div data-tabela-ordenavel="">
        <TabelaInterativa titulo={titulo} colunas={cols} linhas={dados} chaveLinha="_id" fonte={titulo} versao="" nomeArquivo={titulo} recolher={recolhida} />
        {nota && <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{nota}</p>}
      </div>
    );
  }

  const visiveis = linhas.slice(-limite);
  const celula = (v: CelulaTabela, j: number): ReactNode =>
    v === null || v === undefined ? (
      <span className="italic text-mineral">{semDado(j)}</span>
    ) : typeof v === "number" ? (
      formata(v, casas?.[j])
    ) : typeof v !== "string" ? (
      v
    ) : idiomaTexto?.[j] ? (
      <TextoDaColuna coluna={{ id: `dados-${j}`, idiomaTexto: idiomaTexto[j] ?? undefined }}>{v}</TextoDaColuna>
    ) : (
      v
    );
  const fixa = fixarPrimeiraColuna ? "sticky left-0 z-10 bg-papel" : "";
  const tabela = (
    <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={tx(`${titulo} (tabela rolável)`, `${titulo} (scrollable table)`, idioma)}>
      <table className="t-tabela w-full min-w-[28rem] border-collapse tabular-nums" data-tabela-dados="">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            {colunas.map((c, j) => (
              <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${numerica[j] ? "text-right" : "text-left"} ${j === 0 ? fixa : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((l, i) => (
            <tr
              key={i}
              className={`border-b border-linha ${destaqueUltimaLinha && i === visiveis.length - 1 ? "font-medium" : ""} ${linhasDestacadas.includes(linhas.length - visiveis.length + i) ? "bg-contexto" : ""}`}
            >
              {l.map((v, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className={`px-2 py-1 text-left font-normal text-carvao ${numerica[j] ? "text-right" : ""} ${fixa}`}>
                    {celula(v, j)}
                  </th>
                ) : (
                  <td key={j} className={`px-2 py-1 text-carvao ${numerica[j] ? "text-right" : ""}`}>
                    {celula(v, j)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const arquivo = csv && (
    <a href={csv} download className="rotulo mt-3 inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
      {tx("Baixar série completa (CSV)", "Download full series (CSV)", idioma)}
      <SeloComConta href={csv} />
    </a>
  );
  if (!recolhida) {
    const corpo = (
      <>
        {tabela}
        {visiveis.length < linhas.length && (
          <p className="t-meta mt-2 text-carvao-muted">
            {tx(`Últimas ${n(visiveis.length)} de ${n(linhas.length)} linhas.`, `Last ${n(visiveis.length)} of ${n(linhas.length)} rows.`, idioma)}
          </p>
        )}
        {nota && <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{nota}</p>}
        {arquivo}
      </>
    );
    // na fatia `tabelas`, o bloco é a própria tabela: título, frase, a tabela e o arquivo, com a âncora e o nível
    if (tituloVisivel)
      return (
        <section id={id} data-nivel={nivel} data-bloco-tabela="" aria-labelledby={id ? `${id}-titulo` : undefined} className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
          <h3 id={id ? `${id}-titulo` : undefined} className="t-h3 text-carvao">
            {tituloVisivel}
          </h3>
          {lead && <div className="t-meta max-w-prose2 text-carvao-muted">{lead}</div>}
          {corpo}
        </section>
      );
    return (
      <div data-tabela-a-vista="" id={id} data-nivel={nivel}>
        {corpo}
      </div>
    );
  }
  return (
    <details className="mt-4 border-t border-linha pt-3" data-tabela-recolhida="">
      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        {tx(
          `Resumo em tabela (${visiveis.length === linhas.length ? `${linhas.length} linhas` : `últimas ${visiveis.length} de ${linhas.length} linhas`})`,
          `Table summary (${visiveis.length === linhas.length ? `${n(linhas.length)} ${linhas.length === 1 ? "row" : "rows"}` : `last ${n(visiveis.length)} of ${n(linhas.length)} rows`})`,
          idioma,
        )}
      </summary>
      {tabela}
      {nota && <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{nota}</p>}
      {arquivo}
    </details>
  );
}
