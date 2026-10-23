import type { ReactNode } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { Nome } from "@/components/i18n/Nome";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { DetalheDoNivel } from "@/components/painel/DetalheDoNivel";
import { TabelaDados } from "@/components/painel/TabelaDados";
import { dataBR } from "@/lib/painel/formato";
import { idiomaDaPagina, tx } from "@/lib/painel/idioma";
import type { FiguraProps, Natureza, Proveniencia } from "@/lib/painel/tipos";

type Idioma = "pt" | "en";

/** Data de referência da fonte na forma da página: dd/mm/aaaa, mmm/aaaa ou aaaa, com a hora local quando a referência é horária. */
function referencia(iso: string, idioma: Idioma): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  const hora = iso.length > 10 ? iso.slice(11, 16) : null;
  if (idioma === "en") return hora ? `${dataBR(iso, "en")}, ${hora}` : dataBR(iso, "en");
  if (d === undefined) return m === undefined ? a : `${m}/${a}`;
  return hora ? `${d}/${m}/${a} ${hora}` : `${d}/${m}/${a}`;
}

/**
 * A figura do kit de painel (Iniciativa 1 do parecer de UX de 23/10/2026), generalizada do PainelEvidencia: a regra editorial do
 * design system incorporada ao componente. Pergunta como título, subtítulo "indicador · unidade · universo" com o selo de natureza,
 * o gráfico na largura do bloco, a leitura guiada logo abaixo, as notas junto do dado ("O que mudou", "Como interpretar" e, sempre
 * à vista, "O que não é possível concluir"), a tabela equivalente em `<details>` e o rodapé com a fonte, o arquivo e "Sobre este dado".
 *
 * Tabela equivalente, proveniência e "não permite concluir" são obrigatórios no tipo: figura sem eles não compila. "Por que isso
 * importa" fica recolhido (aberto em Analisar e Auditar), porque a abertura da página já traz a razão da medida. `legivel` troca nomes
 * técnicos de conjunto pelos que o leitor reconhece (cada domínio tem o seu dicionário).
 */
export function FiguraAnalitica({
  id,
  pergunta,
  subtitulo,
  natureza,
  children,
  leitura,
  tabela,
  proveniencia,
  complementares = [],
  naoConcluir,
  porQueImporta,
  oQueMudou,
  comoInterpretar,
  ressalva,
  download,
  nivel,
  nivelTitulo = 2,
  complemento,
  depois,
  ancoraAntiga,
  legivel = (x: string) => x,
  extraFonte,
  idioma: idiomaFixo,
}: FiguraProps & {
  /** Nome legível de órgão e conjunto (o dicionário do domínio). */
  legivel?: (texto: string) => string;
  /** Complemento da linha de fonte (captura primária, ressalva de versão). */
  extraFonte?: ReactNode;
  idioma?: Idioma;
}) {
  const idioma = idiomaFixo ?? idiomaDaPagina();
  const Titulo = nivelTitulo === 3 ? "h3" : "h2";
  const todas: Proveniencia[] = [proveniencia, ...complementares.map((c) => c.p)];
  const selos = Array.from(new Set<Natureza>([natureza, ...complementares.map((c) => c.p.natureza)]));
  // fontes agrupadas por órgão e data de referência: "ONS, EAR por subsistema; por REE (referência até 29/09/2026)"
  const grupos: { orgao: string; ate: string; conjuntos: string[] }[] = [];
  for (const p of todas) {
    const orgao = legivel(p.fonte.orgao);
    const nome = legivel(`${p.fonte.orgao}, ${p.fonte.dataset}`);
    const conjunto = nome.startsWith(`${orgao}, `) ? nome.slice(orgao.length + 2) : nome;
    const ate = p.periodo_referencia.fim;
    const g = grupos.find((x) => x.orgao === orgao && x.ate === ate);
    if (!g) grupos.push({ orgao, ate, conjuntos: [conjunto] });
    else if (!g.conjuntos.includes(conjunto)) g.conjuntos.push(conjunto);
  }
  const fontes =
    idioma === "en" ? (
      <>
        {grupos.length === 1 ? "Source: " : "Sources: "}
        {grupos.map((g, i) => (
          <span key={`${g.orgao}-${g.ate}`}>
            {i > 0 && "; "}
            {g.orgao},{" "}
            {g.conjuntos.map((c, j) => (
              <span key={c}>
                {j > 0 && "; "}
                <Nome>{c}</Nome>
              </span>
            ))}{" "}
            (reference up to {referencia(g.ate, idioma)})
          </span>
        ))}
        .{" "}
      </>
    ) : (
      `${grupos.length === 1 ? "Fonte" : "Fontes"}: ${grupos.map((g) => `${g.orgao}, ${g.conjuntos.join("; ")} (referência até ${referencia(g.ate, idioma)})`).join("; ")}. `
    );
  const arquivo = download ?? (proveniencia.download ? { href: proveniencia.download, rotulo: tx("Baixar CSV da série completa", "Download CSV of the full series", idioma) } : null);
  const mudou = tx("O que mudou", "What changed", idioma);
  const interpretar = tx("Como interpretar", "How to read it", idioma);
  const naoPossivel = tx("O que não é possível concluir", "What cannot be concluded", idioma);
  const notas = [oQueMudou && ([mudou, oQueMudou, "data-que-mudou"] as const), comoInterpretar && ([interpretar, comoInterpretar, "data-como-interpretar"] as const)].filter(Boolean) as (readonly [string, ReactNode, string])[];
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-nivel={nivel} data-figura-analitica={id} className="scroll-mt-28 border-t border-linha pt-6">
      {ancoraAntiga && <span id={ancoraAntiga} data-ancora-antiga="" className="block scroll-mt-28" />}
      <header>
        <Titulo id={`${id}-titulo`} className={`${nivelTitulo === 3 ? "t-h3" : "t-h2"} max-w-4xl text-carvao`}>
          {pergunta}
        </Titulo>
        <p className="t-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-carvao-muted">
          <span>{subtitulo}</span>
          {selos.map((n) => (
            <SeloNatureza key={n} natureza={n} idioma={idioma} />
          ))}
        </p>
      </header>
      <div className="mt-5 min-w-0">{children}</div>
      {leitura && <div className="mt-4">{leitura}</div>}
      {complemento && <div className="mt-4 space-y-3">{complemento}</div>}
      {ressalva && (
        <p className="t-meta mt-4 max-w-prose2 text-carvao" data-ressalva="">
          <span className="font-medium">{tx("Ressalva: ", "Caveat: ", idioma)}</span>
          {ressalva}
        </p>
      )}
      <div data-notas-painel="" className={`mt-5 grid gap-x-8 gap-y-4 ${notas.length === 2 ? "md:grid-cols-3" : notas.length === 1 ? "md:grid-cols-2" : ""}`}>
        {notas.map(([rotulo, texto, marca]) => (
          <aside key={marca} aria-label={`${rotulo}: ${pergunta}`} {...{ [marca]: "" }} className="border-l border-linha pl-4">
            <p className="rotulo text-mineral">{rotulo}</p>
            <div className="t-meta mt-1 text-carvao-muted">{texto}</div>
          </aside>
        ))}
        <aside aria-label={`${naoPossivel}: ${pergunta}`} data-nao-concluir="" className="border-l border-carvao pl-4">
          <p className="rotulo text-mineral">{naoPossivel}</p>
          <div className="t-meta mt-1 text-carvao">{naoConcluir}</div>
        </aside>
      </div>
      {porQueImporta && (
        <DetalheDoNivel resumo={tx("Por que isso importa", "Why this matters", idioma)} abreEm="analisar" className="mt-1" dados={{ "data-por-que-importa": "" }}>
          <div className="t-meta max-w-prose2 border-t border-linha pb-2 pt-3 text-carvao-muted">{porQueImporta}</div>
        </DetalheDoNivel>
      )}
      {"naFigura" in tabela ? (
        <p className="t-meta mt-4 text-carvao-muted" data-tabela-equivalente="" data-na-figura="">
          <span className="font-medium text-carvao">{tx("Tabela equivalente: ", "Equivalent table: ", idioma)}</span>
          {tabela.naFigura}
        </p>
      ) : (
        <div data-tabela-equivalente="">
          <TabelaDados
            titulo={tabela.titulo ?? tx(`${pergunta}: tabela equivalente`, `${pergunta}: equivalent table`, idioma)}
            colunas={tabela.colunas}
            linhas={tabela.linhas}
            casas={tabela.casas}
            csv={tabela.csv}
            limite={tabela.limite}
            idiomaTexto={tabela.idiomaTexto}
            idioma={idioma}
          />
        </div>
      )}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-linha pt-3" data-proveniencia="">
        <p className="t-meta text-carvao-muted">
          {fontes}
          {extraFonte}
        </p>
        <div className="flex flex-wrap items-center gap-x-5">
          {arquivo && (
            <a href={arquivo.href} download className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
              {arquivo.rotulo}
              <SeloComConta href={arquivo.href} />
            </a>
          )}
          <SobreEsteDado p={proveniencia} />
        </div>
        {complementares.length > 0 && (
          <ul className="flex w-full flex-wrap items-center gap-x-5 gap-y-0 text-sm">
            {complementares.map((c) => (
              <li key={c.rotulo}>
                <SobreEsteDado p={c.p} rotulo={c.rotulo} />
              </li>
            ))}
          </ul>
        )}
      </footer>
      {depois && <div className="mt-8 space-y-8">{depois}</div>}
    </section>
  );
}
