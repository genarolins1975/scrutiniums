"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListaConsultavel } from "@/components/energia/ListaConsultavel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
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
 */

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; m: MetricaPublicada };

function useMetrica(id: string, n: number): Carga {
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  useEffect(() => {
    let vivo = true;
    setC({ estado: "carregando" });
    carregaJson<unknown>(URL_GOLD.metricas)
      .then((g) => {
        const m = lerCaminho(g, `metricas[${n}]`) as MetricaPublicada | undefined;
        if (!vivo) return;
        if (!m || m.id !== id) setC({ estado: "erro", motivo: "A regra não foi encontrada no catálogo publicado: a gold foi atualizada depois desta página." });
        else setC({ estado: "ok", m });
      })
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [id, n]);
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

function Lista({ itens }: { itens: string[] }) {
  if (!itens.length) return <>nenhuma</>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export type FonteComFicha = { slug: string; nome: string };

function Regra({ id, n, fichasPorFonte }: { id: string; n: number; fichasPorFonte: Record<string, FonteComFicha> }) {
  const c = useMetrica(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Lendo a regra no catálogo de indicadores publicado…
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        Não foi possível ler a regra: {c.motivo}
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
          {moduloDaGold(m.gold)} · fórmula versão {m.versao_formula}
        </p>
        <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao">{m.pergunta}</p>
      </header>

      <section aria-label="O que mede">
        <h4 className="text-sm font-medium text-carvao">O que mede</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo rotulo="Definição">{m.definicao}</Campo>
          </div>
          <Campo rotulo="Unidade">{m.unidade}</Campo>
          <Campo rotulo="Recorte geográfico e temporal">
            {m.grao_geografico}; {m.grao_temporal}
          </Campo>
          <Campo rotulo="Natureza do dado de origem">{rotuloNatureza(m.natureza_fonte)}</Campo>
          <Campo rotulo="Natureza do resultado">{rotuloNatureza(m.natureza_transformacao)}</Campo>
          <Campo rotulo="Dimensões">{m.dimensoes.length ? m.dimensoes.join(", ") : "nenhuma"}</Campo>
        </dl>
      </section>

      <section aria-label="Como é calculado">
        <h4 className="text-sm font-medium text-carvao">Como é calculado</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {m.formula && (
            <div className="md:col-span-2">
              <Campo rotulo="Fórmula">
                <span className="font-mono text-xs">{m.formula}</span>
              </Campo>
            </div>
          )}
          {m.numerador && <Campo rotulo="Numerador">{m.numerador}</Campo>}
          {m.denominador && <Campo rotulo="Denominador">{m.denominador}</Campo>}
          <Campo rotulo="Regra de agregação">{m.regra_agregacao}</Campo>
          <Campo rotulo="Regra de cobertura">{m.regra_cobertura}</Campo>
          <Campo rotulo="Política de ausência">{m.politica_ausencia}</Campo>
        </dl>
        {!m.formula && <p className="mt-2 text-xs text-mineral">Este indicador não tem fórmula publicada: a definição e a regra de agregação dizem como o número é obtido.</p>}
      </section>

      <section aria-label="De onde vem">
        <h4 className="text-sm font-medium text-carvao">De onde vem</h4>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-linhagem-do-indicador="">
          {comFicha.length > 0 && (
            <>
              {comFicha.length === 1 ? "Fonte" : "Fontes"} com ficha:{" "}
              {comFicha.map((f, i) => (
                <span key={f.id}>
                  {i > 0 ? "; " : ""}
                  <Link href={`/setor-eletrico/dados/${f.ficha!.slug}`} className="text-energia-dark underline underline-offset-4">
                    {f.ficha!.nome}
                  </Link>
                  <span data-nivel="analisar"> ({f.id})</span>
                </span>
              ))}
              .{" "}
            </>
          )}
          {semFicha.length > 0 && (
            <>
              {comFicha.length > 0 ? "Usa também" : "Usa"} {semFicha.length === 1 ? "uma fonte" : `${semFicha.length} fontes`} que não {semFicha.length === 1 ? "tem" : "têm"} ficha de conjunto própria
              <span data-nivel="analisar"> ({semFicha.map((f) => f.id).join(", ")})</span>.{" "}
            </>
          )}
          Elas alimentam a base publicada do módulo {moduloDaGold(m.gold)}
          <span data-nivel="analisar"> ({m.gold})</span>, e esta regra a transforma neste indicador.
        </p>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <Campo rotulo="Onde aparece">
            {m.paginas.map((p, i) => (
              <span key={p}>
                {i > 0 ? " · " : ""}
                <Link href={p} className="text-energia-dark underline underline-offset-4">
                  {p.replace("/setor-eletrico", "") || "/"}
                </Link>
              </span>
            ))}
          </Campo>
          <Campo rotulo="Código que aplica a regra">
            <a href={urlCodigoMetrica(m.arquivo)} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              {m.arquivo} ↗
            </a>
          </Campo>
        </dl>
      </section>

      <section aria-label="O que não permite concluir">
        <h4 className="text-sm font-medium text-carvao">O que não permite concluir</h4>
        <dl className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo rotulo="Limitações">
              <Lista itens={m.limitacoes} />
            </Campo>
          </div>
          <Campo rotulo="Regras de comparabilidade">
            <Lista itens={m.regras_comparabilidade} />
          </Campo>
          <Campo rotulo="Validações">
            <Lista itens={m.validacoes} />
          </Campo>
        </dl>
      </section>
    </div>
  );
}

function LinhaDoIndicador({ l }: { l: LinhaTabela }) {
  const paginas = typeof l.paginas === "number" ? l.paginas : 0;
  return (
    <div className="min-w-0">
      <p className="rotulo text-mineral">
        {String(l.modulo)} · dado de origem {String(l.natureza_fonte).toLowerCase()} · resultado {String(l.natureza_calculo).toLowerCase()}
      </p>
      <h3 className="mt-0.5 font-serif text-lg leading-snug text-carvao [overflow-wrap:anywhere]">{String(l.titulo)}</h3>
      {l.pergunta && <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao">{String(l.pergunta)}</p>}
      <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
        Unidade: {String(l.unidade)} · {String(l.grao_geografico)}; {String(l.grao_temporal)} · {l.formula === "sim" ? "fórmula publicada" : "sem fórmula (definição e regra de agregação)"} · aparece em {paginas === 1 ? "1 página" : `${paginas} páginas`}
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
  const linhas = useMemo(() => expandirLinhas(matriz), [matriz]);
  return (
    <div className="space-y-8">
      <ListaConsultavel
        rotulo="Regras por indicador"
        substantivo={["indicador", "indicadores"]}
        colunas={COLUNAS_METRICAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        prefixo="reg"
        paramAberto="m"
        ordemInicial={{ coluna: "modulo", direcao: "asc" }}
        opcoesOrdem={[
          { id: "modulo", rotulo: "Módulo, de A a Z", ordem: { coluna: "modulo", direcao: "asc" } },
          { id: "nome", rotulo: "Indicador, de A a Z", ordem: { coluna: "titulo", direcao: "asc" } },
          { id: "unidade", rotulo: "Unidade, de A a Z", ordem: { coluna: "unidade", direcao: "asc" } },
          { id: "paginas", rotulo: "Páginas em que aparece, do maior ao menor", ordem: { coluna: "paginas", direcao: "desc" } },
        ]}
        filtrosDaBarra={["modulo", "formula"]}
        tamanhoPagina={10}
        rotuloBusca="Encontre um indicador"
        dicaBusca="Nome, unidade, módulo ou pergunta que ele responde"
        fonte="Scrutiniums, catálogo de indicadores dos módulos (o mesmo que o observatório usa para calcular)"
        versao={versao}
        nomeDoArquivo="metodologia-regras-por-indicador"
        arquivoCompleto={arquivoCompleto}
        rotuloDetalhe="Abrir a regra do indicador"
        renderLinha={(l) => <LinhaDoIndicador l={l} />}
        renderDetalhe={(l) => <Regra id={String(l.id)} n={Number(l.n)} fichasPorFonte={fichasPorFonte} />}
        semResultado={<>Nenhum indicador corresponde à busca e aos filtros. A lista traz só os números que o observatório exibe.</>}
      />

      {children && <div className="space-y-6">{children}</div>}

      <div id="tabela" data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">{tituloTabela}</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{apoioTabela}</p>
        <TabelaInterativa
          titulo="Regras por indicador: natureza, unidade e recortes de cada número publicado"
          colunas={COLUNAS_METRICAS}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="titulo"
          fonte="Scrutiniums, catálogo de indicadores dos módulos (o mesmo que o observatório usa para calcular)"
          versao={versao}
          nomeArquivo="metodologia-regras-por-indicador"
          chaveUrl="reg"
          ordemInicial={{ coluna: "modulo", direcao: "asc" }}
          tamanhoPagina={25}
          dicaBusca="Indicador, módulo ou unidade"
          nota="Natureza mista quer dizer que o resultado combina dados de naturezas diferentes; o texto completo está na regra de cada indicador. A coluna Páginas conta onde o indicador aparece."
        />
      </div>
    </div>
  );
}
