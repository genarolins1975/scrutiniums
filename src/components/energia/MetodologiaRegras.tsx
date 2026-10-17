"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListaConsultavel } from "@/components/energia/ListaConsultavel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  COLUNAS_METRICAS,
  URL_GOLD,
  expandirLinhas,
  moduloDaGold,
  rotuloNatureza,
  urlCodigoMetrica,
  type MatrizLinhas,
  type MetricaPublicada,
} from "@/lib/energia/dados";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * Consulta das regras por indicador: uma lista pesquisável dos indicadores publicados (busca por nome, unidade ou pergunta; filtros por
 * módulo, natureza e fórmula; ordenação; exportação do recorte) e, para o indicador aberto (?m=), a regra inteira em quatro partes:
 * o que mede, como é calculado, de onde vem (as fontes, com a ficha de cada uma, a base publicada e o código) e o que não permite concluir.
 * A regra é lida de metricas.json só ao abrir o indicador (a mesma lista que o pipeline usa para calcular), para o HTML não carregar as
 * 276 regras. A tabela completa, com todas as colunas, fica em Analisar e segue a mesma busca e os mesmos filtros pela URL.
 *
 * Idioma: os rótulos traduzem; o texto de cada regra (pergunta, definição, unidade, recortes, regras, limitações) é o da lista de
 * indicadores, escrita em português, e sai marcado como trecho em português na página inglesa.
 */

/** Texto da regra como está na lista publicada (em português). */
function DaRegra({ children, regiao }: { children: ReactNode; regiao: string }) {
  return <TrechoPortugues regiao={regiao}>{children}</TrechoPortugues>;
}

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; m: MetricaPublicada };

function useMetrica(id: string, n: number): Carga {
  const tx = useTx();
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  const naoEncontrada = tx(
    "A regra não foi encontrada no catálogo publicado: a gold foi atualizada depois desta página.",
    "The rule was not found in the published catalog: the gold file was updated after this page.",
  );
  useEffect(() => {
    let vivo = true;
    setC({ estado: "carregando" });
    carregaJson<unknown>(URL_GOLD.metricas)
      .then((g) => {
        const m = lerCaminho(g, `metricas[${n}]`) as MetricaPublicada | undefined;
        if (!vivo) return;
        if (!m || m.id !== id) setC({ estado: "erro", motivo: naoEncontrada });
        else setC({ estado: "ok", m });
      })
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [id, n, naoEncontrada]);
  return c;
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Lista({ itens, regiao }: { itens: string[]; regiao: string }) {
  const tx = useTx();
  if (!itens.length) return <>{tx("nenhuma", "none")}</>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {itens.map((i) => (
        <li key={i}>
          <DaRegra regiao={regiao}>{i}</DaRegra>
        </li>
      ))}
    </ul>
  );
}

export type FonteComFicha = { slug: string; nome: string };

function Regra({ id, n, fichasPorFonte }: { id: string; n: number; fichasPorFonte: Record<string, FonteComFicha> }) {
  const tx = useTx();
  const { num } = formatos(useIdioma());
  const c = useMetrica(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        {tx("Lendo a regra no catálogo de indicadores publicado…", "Reading the rule in the published indicator catalog…")}
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        {tx("Não foi possível ler a regra:", "The rule could not be read:")} {c.motivo}
      </p>
    );
  const m = c.m;
  const fontes = m.fontes.map((f) => ({ id: f, ficha: fichasPorFonte[f] }));
  const comFicha = fontes.filter((f) => f.ficha);
  const semFicha = fontes.filter((f) => !f.ficha);
  return (
    <div className="space-y-5" data-regra={m.id}>
      <header>
        <p className="rotulo text-mineral">
          {moduloDaGold(m.gold)} · {tx(`fórmula versão ${m.versao_formula}`, `formula version ${m.versao_formula}`)}
        </p>
        <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao">
          <DaRegra regiao="regra-pergunta">{m.pergunta}</DaRegra>
        </p>
      </header>

      <section aria-label={tx("O que mede", "What it measures")}>
        <h4 className="text-sm font-medium text-carvao">{tx("O que mede", "What it measures")}</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo rotulo={tx("Definição", "Definition")}>
              <DaRegra regiao="regra-definicao">{m.definicao}</DaRegra>
            </Campo>
          </div>
          <Campo rotulo={tx("Unidade", "Unit")}>
            <DaRegra regiao="regra-unidade">{m.unidade}</DaRegra>
          </Campo>
          <Campo rotulo={tx("Recorte geográfico e temporal", "Geographic and time scope")}>
            <DaRegra regiao="regra-recorte">
              {m.grao_geografico}; {m.grao_temporal}
            </DaRegra>
          </Campo>
          <Campo rotulo={tx("Natureza do dado de origem", "Nature of the source data")}>{rotuloNatureza(m.natureza_fonte)}</Campo>
          <Campo rotulo={tx("Natureza do resultado", "Nature of the result")}>{rotuloNatureza(m.natureza_transformacao)}</Campo>
          <Campo rotulo={tx("Dimensões", "Dimensions")}>
            {m.dimensoes.length ? <DaRegra regiao="regra-dimensoes">{m.dimensoes.join(", ")}</DaRegra> : tx("nenhuma", "none")}
          </Campo>
        </dl>
      </section>

      <section aria-label={tx("Como é calculado", "How it is calculated")}>
        <h4 className="text-sm font-medium text-carvao">{tx("Como é calculado", "How it is calculated")}</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {m.formula && (
            <div className="md:col-span-2">
              <Campo rotulo={tx("Fórmula", "Formula")}>
                <span className="font-mono text-xs">
                  <DaRegra regiao="regra-formula">{m.formula}</DaRegra>
                </span>
              </Campo>
            </div>
          )}
          {m.numerador && (
            <Campo rotulo={tx("Numerador", "Numerator")}>
              <DaRegra regiao="regra-numerador">{m.numerador}</DaRegra>
            </Campo>
          )}
          {m.denominador && (
            <Campo rotulo={tx("Denominador", "Denominator")}>
              <DaRegra regiao="regra-denominador">{m.denominador}</DaRegra>
            </Campo>
          )}
          <Campo rotulo={tx("Regra de agregação", "Aggregation rule")}>
            <DaRegra regiao="regra-agregacao">{m.regra_agregacao}</DaRegra>
          </Campo>
          <Campo rotulo={tx("Regra de cobertura", "Coverage rule")}>
            <DaRegra regiao="regra-cobertura">{m.regra_cobertura}</DaRegra>
          </Campo>
          <Campo rotulo={tx("Política de ausência", "Missing data policy")}>
            <DaRegra regiao="regra-ausencia">{m.politica_ausencia}</DaRegra>
          </Campo>
        </dl>
        {!m.formula && (
          <p className="mt-2 text-xs text-mineral">
            {tx(
              "Este indicador não tem fórmula publicada: a definição e a regra de agregação dizem como o número é obtido.",
              "This indicator has no published formula: the definition and the aggregation rule say how the number is obtained.",
            )}
          </p>
        )}
      </section>

      <section aria-label={tx("De onde vem", "Where it comes from")}>
        <h4 className="text-sm font-medium text-carvao">{tx("De onde vem", "Where it comes from")}</h4>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-linhagem-do-indicador="">
          {comFicha.length > 0 && (
            <>
              {comFicha.length === 1 ? tx("Fonte com ficha:", "Source with a record:") : tx("Fontes com ficha:", "Sources with a record:")}{" "}
              {comFicha.map((f, i) => (
                <span key={f.id}>
                  {i > 0 ? "; " : ""}
                  <Link href={`/setor-eletrico/dados/${f.ficha!.slug}`} className="text-energia-dark underline underline-offset-4">
                    <Nome>{f.ficha!.nome}</Nome>
                  </Link>
                  <span data-nivel="analisar"> ({f.id})</span>
                </span>
              ))}
              .{" "}
            </>
          )}
          {semFicha.length > 0 && (
            <>
              {tx(
                `${comFicha.length > 0 ? "Usa também" : "Usa"} ${semFicha.length === 1 ? "uma fonte" : `${num(semFicha.length, 0)} fontes`} que não ${semFicha.length === 1 ? "tem" : "têm"} ficha de conjunto própria`,
                `${comFicha.length > 0 ? "It also uses" : "It uses"} ${semFicha.length === 1 ? "one source" : `${num(semFicha.length, 0)} sources`} that ${semFicha.length === 1 ? "has" : "have"} no dataset record of their own`,
              )}
              <span data-nivel="analisar"> ({semFicha.map((f) => f.id).join(", ")})</span>.{" "}
            </>
          )}
          {tx(`Elas alimentam a base publicada do módulo ${moduloDaGold(m.gold)}`, `They feed the published base of the ${moduloDaGold(m.gold)} module`)}
          <span data-nivel="analisar"> ({m.gold})</span>
          {tx(", e esta regra a transforma neste indicador.", ", and this rule turns it into this indicator.")}
        </p>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <Campo rotulo={tx("Onde aparece", "Where it appears")}>
            {m.paginas.map((p, i) => (
              <span key={p}>
                {i > 0 ? " · " : ""}
                <Link href={p} className="text-energia-dark underline underline-offset-4">
                  {p.replace("/setor-eletrico", "") || "/"}
                </Link>
              </span>
            ))}
          </Campo>
          <Campo rotulo={tx("Código que aplica a regra", "Code that applies the rule")}>
            <a href={urlCodigoMetrica(m.arquivo)} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              {m.arquivo} ↗
            </a>
          </Campo>
        </dl>
      </section>

      <section aria-label={tx("O que não permite concluir", "What it does not allow one to conclude")}>
        <h4 className="text-sm font-medium text-carvao">{tx("O que não permite concluir", "What it does not allow one to conclude")}</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo rotulo={tx("Limitações", "Limitations")}>
              <Lista itens={m.limitacoes} regiao="regra-limitacoes" />
            </Campo>
          </div>
          <Campo rotulo={tx("Regras de comparabilidade", "Comparability rules")}>
            <Lista itens={m.regras_comparabilidade} regiao="regra-comparabilidade" />
          </Campo>
          <Campo rotulo={tx("Validações", "Validations")}>
            <Lista itens={m.validacoes} regiao="regra-validacoes" />
          </Campo>
        </dl>
      </section>
    </div>
  );
}

function LinhaDoIndicador({ l }: { l: LinhaTabela }) {
  const tx = useTx();
  const { num } = formatos(useIdioma());
  const paginas = typeof l.paginas === "number" ? l.paginas : 0;
  // a linha chega no idioma da página: "sim" é "yes" em inglês
  const comFormula = l.formula === tx("sim", "yes");
  return (
    <div className="min-w-0">
      <p className="rotulo text-mineral">
        {tx(
          `${String(l.modulo)} · dado de origem ${String(l.natureza_fonte).toLowerCase()} · resultado ${String(l.natureza_calculo).toLowerCase()}`,
          `${String(l.modulo)} · source data ${String(l.natureza_fonte).toLowerCase()} · result ${String(l.natureza_calculo).toLowerCase()}`,
        )}
      </p>
      <h3 className="mt-0.5 font-serif text-lg leading-snug text-carvao [overflow-wrap:anywhere]">
        <DaRegra regiao="regra-titulo">{String(l.titulo)}</DaRegra>
      </h3>
      {l.pergunta && (
        <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao">
          <DaRegra regiao="regra-pergunta">{String(l.pergunta)}</DaRegra>
        </p>
      )}
      <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
        {tx("Unidade:", "Unit:")}{" "}
        <DaRegra regiao="regra-unidade">
          {String(l.unidade)} · {String(l.grao_geografico)}; {String(l.grao_temporal)}
        </DaRegra>{" "}
        ·{" "}
        {comFormula ? tx("fórmula publicada", "published formula") : tx("sem fórmula (definição e regra de agregação)", "no formula (definition and aggregation rule)")} ·{" "}
        {tx(`aparece em ${paginas === 1 ? "1 página" : `${num(paginas, 0)} páginas`}`, `appears on ${paginas === 1 ? "1 page" : `${num(paginas, 0)} pages`}`)}
      </p>
    </div>
  );
}

export function MetodologiaRegras({
  matriz,
  versao,
  fichasPorFonte,
  arquivoCompleto,
  tituloTabela,
  apoioTabela,
  children,
}: {
  matriz: MatrizLinhas;
  versao: string;
  fichasPorFonte: Record<string, FonteComFicha>;
  arquivoCompleto: { rotulo: string; url: string };
  tituloTabela: string;
  apoioTabela: string;
  /** O que fica entre a lista e a tabela completa (notas, resposta): servidor, passado como filho. */
  children?: ReactNode;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const linhas = useMemo(() => expandirLinhas(matriz), [matriz]);
  // as linhas chegam na ordem dos módulos pelo nome português; em inglês essa é a ordem inicial (coluna fora da tabela: não reordena),
  // para que a primeira página mostre os mesmos indicadores da página portuguesa. "Module, A to Z" ordena pelo nome inglês.
  const ordemPadraoEn = { coluna: "ordem_padrao", direcao: "asc" } as const;
  const fonte = tx(
    "Scrutiniums, catálogo de indicadores dos módulos (o mesmo que o observatório usa para calcular)",
    "Scrutiniums, catalog of module indicators (the same one the observatory uses to calculate)",
  );
  return (
    <div className="space-y-8">
      <ListaConsultavel
        rotulo={tx("Regras por indicador", "Rules by indicator")}
        substantivo={tx(["indicador", "indicadores"], ["indicator", "indicators"])}
        colunas={COLUNAS_METRICAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        prefixo="reg"
        paramAberto="m"
        ordemInicial={idioma === "en" ? ordemPadraoEn : { coluna: "modulo", direcao: "asc" }}
        opcoesOrdem={[
          ...(idioma === "en" ? [{ id: "padrao", rotulo: "Module (default order)", ordem: ordemPadraoEn }] : []),
          { id: "modulo", rotulo: tx("Módulo, de A a Z", "Module, A to Z"), ordem: { coluna: "modulo", direcao: "asc" } },
          { id: "nome", rotulo: tx("Indicador, de A a Z", "Indicator, A to Z"), ordem: { coluna: "titulo", direcao: "asc" } },
          { id: "unidade", rotulo: tx("Unidade, de A a Z", "Unit, A to Z"), ordem: { coluna: "unidade", direcao: "asc" } },
          { id: "paginas", rotulo: tx("Páginas em que aparece, do maior ao menor", "Pages where it appears, highest first"), ordem: { coluna: "paginas", direcao: "desc" } },
        ]}
        filtrosDaBarra={["modulo", "formula"]}
        tamanhoPagina={10}
        rotuloBusca={tx("Encontre um indicador", "Find an indicator")}
        dicaBusca={tx("Nome, unidade, módulo ou pergunta que ele responde", "Name, unit, module or question it answers")}
        fonte={fonte}
        versao={versao}
        nomeDoArquivo="metodologia-regras-por-indicador"
        arquivoCompleto={arquivoCompleto}
        rotuloDetalhe={tx("Abrir a regra do indicador", "Open the indicator rule")}
        renderLinha={(l) => <LinhaDoIndicador l={l} />}
        renderDetalhe={(l) => <Regra id={String(l.id)} n={Number(l.n)} fichasPorFonte={fichasPorFonte} />}
        semResultado={tx(
          <>Nenhum indicador corresponde à busca e aos filtros. A lista traz só os números que o observatório exibe.</>,
          <>No indicator matches the search and the filters. The list only includes the numbers the observatory displays.</>,
        )}
      />

      {children && <div className="space-y-6">{children}</div>}

      <div id="tabela" data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">{tituloTabela}</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{apoioTabela}</p>
        <TabelaInterativa
          titulo={tx("Regras por indicador: natureza, unidade e recortes de cada número publicado", "Rules by indicator: nature, unit and scopes of each published number")}
          colunas={COLUNAS_METRICAS}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="titulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="metodologia-regras-por-indicador"
          chaveUrl="reg"
          ordemInicial={idioma === "en" ? null : { coluna: "modulo", direcao: "asc" }}
          tamanhoPagina={25}
          dicaBusca={tx("Indicador, módulo ou unidade", "Indicator, module or unit")}
          nota={tx(
            "Natureza mista quer dizer que o resultado combina dados de naturezas diferentes; o texto completo está na regra de cada indicador. A coluna Páginas conta onde o indicador aparece.",
            "Mixed nature means that the result combines data of different natures; the full text is in the rule of each indicator. The Pages column counts where the indicator appears.",
          )}
        />
      </div>
    </div>
  );
}
