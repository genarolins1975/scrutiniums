"use client";

import Link from "@/components/i18n/LinkIdioma";
import { useEffect, useMemo, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { PAINEIS_EN, rotuloDado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { expandirLinhas, type MatrizLinhas } from "@/lib/energia/dados";
import {
  COLUNAS_PAGINAS,
  ORDEM_DIMENSOES,
  ROTULO_CURTO,
  ROTULO_SEVERIDADE,
  ROTULO_TIPO,
  URL_AVALIACAO,
  dimensaoPorId,
  metaDaDimensao,
  textoDeducao,
  textoNota,
  textoTeto,
} from "@/lib/energia/avaliacao";
import type { AvaliacaoGold, IdDimensao, PaginaAvaliada } from "@/lib/energia/tipos-avaliacao";

/**
 * P071, a nota de cada página com a evidência: a tabela das páginas (filtros por entrega e tipo,
 * ordenação, exportação) e, para a linha escolhida, a ficha com a nota de cada dimensão, a
 * evidência, as deduções e os tetos que a explicam. A ficha lê avaliacao.json só ao escolher
 * a linha (uma leitura por página), para o HTML não carregar a evidência das 89 páginas.
 * A página escolhida fica na URL (?pag=): o link abre a mesma ficha.
 */

const ESQUEMA = { pag: campo(tiposUrl.texto({ max: 200 }), "") };

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; a: AvaliacaoGold };

function useAvaliacao(ativo: boolean): Carga {
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    carregaJson<AvaliacaoGold>(URL_AVALIACAO)
      .then((a) => vivo && setC({ estado: "ok", a }))
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [ativo]);
  return c;
}

function CartaoDimensao({ a, p, id }: { a: AvaliacaoGold; p: PaginaAvaliada; id: IdDimensao }) {
  const tx = useTx();
  const { num, datasLegiveis } = formatos(useIdioma());
  const x = p.dimensoes[id];
  const d = dimensaoPorId(a, id);
  const meta = metaDaDimensao(a, id);
  const abaixo = x.estado === "avaliada" && (x.nota ?? 0) < meta;
  return (
    <section aria-labelledby={`dim-${id}`} className="min-w-0 border border-linha bg-superficie p-3" data-dimensao={id} data-estado={x.estado}>
      <h4 id={`dim-${id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-carvao">
        <span className="font-medium">
          {tx(d.nome, ROTULO_CURTO[id])} <span className="font-normal text-mineral">· {tx("peso", "weight")} {d.peso}%</span>
        </span>
        <span className={x.estado === "avaliada" ? (abaixo ? "text-aviso" : "text-sucesso") : "text-mineral"}>
          {textoNota(x)}
          {x.estado === "avaliada" && (
            <span className="text-mineral">
              {" "}
              · {tx("meta", "target")} {num(meta, 1)}
            </span>
          )}
        </span>
      </h4>
      {x.evidencias.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
          {x.evidencias.map((e) => (
            <li key={e}>
              <TrechoPortugues regiao="avaliacao-evidencia">{datasLegiveis(e)}</TrechoPortugues>
            </li>
          ))}
        </ul>
      )}
      {x.estado === "avaliada" && x.partida !== undefined && x.deducoes.length > 0 && (
        <p className="mt-2 text-xs text-carvao-muted">{tx(`Parte de ${num(x.partida, 1)} e desconta:`, `Starts from ${num(x.partida, 1)} and deducts:`)}</p>
      )}
      {x.deducoes.length > 0 && (
        <div className="mt-2">
          <p className="rotulo text-mineral">{tx("Deduções", "Deductions")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
            {x.deducoes.map((e) => (
              <li key={e.motivo}>
                {tx(<>{datasLegiveis(textoDeducao(e))}</>, <>
                  {`minus ${num(e.pontos, e.pontos % 1 === 0 ? 0 : 2)}: `}
                  <TrechoPortugues regiao="avaliacao-deducao">{datasLegiveis(e.motivo)}</TrechoPortugues>
                </>)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {x.tetos.length > 0 && (
        <div className="mt-2">
          <p className="rotulo text-mineral">{tx("Tetos aplicados", "Caps applied")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
            {x.tetos.map((e) => (
              <li key={e.motivo}>
                {tx(<>{textoTeto(e)}</>, <>
                  {`cap ${num(e.valor, 1)}: `}
                  <TrechoPortugues regiao="avaliacao-teto">{e.motivo}</TrechoPortugues>
                </>)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {x.itens && (
        <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
          {tx("Itens da anatomia (fração de 0 a 1):", "Anatomy items (fraction from 0 to 1):")} {Object.entries(x.itens).map(([k, v]) => `${k} ${num(v, 1)}`).join("; ")}.
        </p>
      )}
      {x.revisor && (
        <p className="mt-2 text-xs text-mineral">
          {tx("Revisor em contexto limpo:", "Reviewer in a clean context:")} <TrechoPortugues regiao="avaliacao-revisor">{x.revisor}</TrechoPortugues>.
        </p>
      )}
    </section>
  );
}

function Ficha({ a, rota }: { a: AvaliacaoGold; rota: string }) {
  const tx = useTx();
  const { num, datasLegiveis } = formatos(useIdioma());
  const p = a.paginas.find((x) => x.rota === rota);
  if (!p) return <p className="text-sm text-carvao-muted">{tx("A página escolhida não está nesta rodada de avaliação.", "The chosen page is not in this evaluation round.")}</p>;
  const defeitos = a.defeitos.filter((d) => p.defeitos.includes(d.id));
  return (
    <div className="space-y-4" data-ficha={p.rota}>
      <header>
        <p className="rotulo text-mineral">
          {ROTULO_TIPO[p.tipo]} · {rotuloDado(PAINEIS_EN, a.modulos.find((m) => m.id === p.modulo)?.rotulo ?? "")} · {tx("rodada", "round")} {a.rodada.id}
        </p>
        <h3 className="mt-1 font-serif text-xl text-carvao">{p.titulo ? <TrechoPortugues regiao="avaliacao-titulo">{p.titulo}</TrechoPortugues> : p.rota}</h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
          {tx("Nota ponderada", "Weighted score")} {p.nota_ponderada === null ? tx("não avaliada", "not assessed") : num(p.nota_ponderada, 1)}.{" "}
          {p.atende_meta ? (
            tx("A página atende à meta de produto.", "The page meets the product target.")
          ) : p.abaixo_da_meta.length ? (
            <>
              {tx("Fora da meta:", "Below the target:")} <TrechoPortugues regiao="avaliacao-abaixo-meta">{p.abaixo_da_meta.join("; ")}</TrechoPortugues>.
            </>
          ) : (
            tx("A página não atende à meta de produto.", "The page does not meet the product target.")
          )}{" "}
          <Link href={p.rota} className="text-energia-dark underline underline-offset-4">
            {tx("Abrir a página", "Open the page")}
          </Link>
          {p.amostra
            ? tx(
                " Esta página faz parte de uma amostra da família: a nota vale para ela, não para as demais.",
                " This page is part of a sample of its family: the score applies to it, not to the others.",
              )
            : ""}
        </p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        {ORDEM_DIMENSOES.map((id) => (
          <CartaoDimensao key={id} a={a} p={p} id={id} />
        ))}
      </div>
      {defeitos.length > 0 && (
        <div>
          <p className="rotulo text-mineral">{tx("Defeitos que afetam esta página", "Defects affecting this page")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {defeitos.map((d) => (
              <li key={d.id}>
                {d.id}, {ROTULO_SEVERIDADE[d.severidade].toLowerCase()}: <TrechoPortugues regiao="avaliacao-defeito">{datasLegiveis(d.descricao)}</TrechoPortugues>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.golds.length > 0 && (
        <p className="text-xs text-mineral">
          {tx("Golds que alimentam a página:", "Gold files that feed the page:")} {p.golds.join(", ")}.
        </p>
      )}
    </div>
  );
}

/** `matriz` leva as chaves uma vez e os valores de cada página (89 linhas com 17 campos): o HTML não repete o nome de cada campo em cada linha. */
export function AvaliacaoPaginas({ matriz, versao }: { matriz: MatrizLinhas; versao: string }) {
  const tx = useTx();
  const linhas = useMemo(() => expandirLinhas(matriz), [matriz]);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.pag ? linhas.find((l) => l.rota === v.pag) : undefined;
  const c = useAvaliacao(!!escolhida);
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo={tx("Nota de cada página por dimensão", "Score of each page by dimension")}
        colunas={COLUNAS_PAGINAS}
        linhas={linhas}
        chaveLinha="rota"
        colunaRotulo="titulo"
        fonte={tx(
          "Scrutiniums, avaliacao.json (medição por navegador, jornadas, revisão visual e didática, golds e testes)",
          "Scrutiniums, avaliacao.json (browser measurement, journeys, visual and didactic review, gold files and tests)",
        )}
        versao={versao}
        nomeArquivo="avaliacao-paginas"
        chaveUrl="ava"
        ordemInicial={{ coluna: "ponderada", direcao: "asc" }}
        tamanhoPagina={12}
        dicaBusca={tx("Nome ou rota da página", "Page name or route")}
        selecionado={escolhida ? String(escolhida.rota) : null}
        onSelecionar={(id) => definir({ pag: id ?? "" })}
        nota={tx(
          "Sem nota na célula quer dizer dimensão não avaliada ou que não se aplica à página, nunca zero. As famílias de verbetes, fichas de conjuntos e fichas de empresas foram amostradas. Escolha uma linha para ver a evidência de cada nota.",
          "No score in a cell means a dimension not assessed or not applicable to the page, never zero. The families of entries, dataset records and company records were sampled. Choose a row to see the evidence for each score.",
        )}
      />
      <section aria-labelledby="ficha-pagina-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="ficha-pagina-h" className="rotulo text-mineral">
          {tx("Evidência da nota", "Evidence for the score")}
        </h3>
        {!escolhida ? (
          <p className="mt-2 text-sm text-carvao-muted">
            {tx(
              "Escolha uma linha da tabela para ver, dimensão a dimensão, o que foi medido, o que foi deduzido e qual teto limitou a nota.",
              "Choose a row of the table to see, dimension by dimension, what was measured, what was deducted and which cap limited the score.",
            )}
          </p>
        ) : c.estado === "carregando" ? (
          <p role="status" className="mt-2 text-sm text-carvao-muted">
            {tx("Lendo a evidência da página…", "Reading the page evidence…")}
          </p>
        ) : c.estado === "erro" ? (
          <p role="alert" className="mt-2 text-sm text-erro">
            {tx(
              `Não foi possível ler a evidência: ${c.motivo}. O arquivo continua disponível para baixar no rodapé do painel.`,
              `The evidence could not be read: ${c.motivo}. The file is still available to download in the panel footer.`,
            )}
          </p>
        ) : (
          <div className="mt-3">
            <Ficha a={c.a} rota={String(escolhida.rota)} />
          </div>
        )}
      </section>
    </div>
  );
}
