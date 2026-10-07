"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num } from "@/lib/energia/formato";
import { datasLegiveis } from "@/lib/energia/visao";
import { COLUNAS_PAGINAS, ORDEM_DIMENSOES, ROTULO_SEVERIDADE, ROTULO_TIPO, URL_AVALIACAO, dimensaoPorId, metaDaDimensao, textoDeducao, textoNota, textoTeto } from "@/lib/energia/avaliacao";
import type { LinhaTabela } from "@/lib/energia/tabela";
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
  const x = p.dimensoes[id];
  const d = dimensaoPorId(a, id);
  const meta = metaDaDimensao(a, id);
  const abaixo = x.estado === "avaliada" && (x.nota ?? 0) < meta;
  return (
    <section aria-labelledby={`dim-${id}`} className="min-w-0 border border-linha bg-superficie p-3" data-dimensao={id} data-estado={x.estado}>
      <h4 id={`dim-${id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-carvao">
        <span className="font-medium">
          {d.nome} <span className="font-normal text-mineral">· peso {d.peso}%</span>
        </span>
        <span className={x.estado === "avaliada" ? (abaixo ? "text-aviso" : "text-sucesso") : "text-mineral"}>
          {textoNota(x)}
          {x.estado === "avaliada" && <span className="text-mineral"> · meta {num(meta, 1)}</span>}
        </span>
      </h4>
      {x.evidencias.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
          {x.evidencias.map((e) => (
            <li key={e}>{datasLegiveis(e)}</li>
          ))}
        </ul>
      )}
      {x.estado === "avaliada" && x.partida !== undefined && x.deducoes.length > 0 && <p className="mt-2 text-xs text-carvao-muted">Parte de {num(x.partida, 1)} e desconta:</p>}
      {x.deducoes.length > 0 && (
        <div className="mt-2">
          <p className="rotulo text-mineral">Deduções</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
            {x.deducoes.map((e) => (
              <li key={e.motivo}>{datasLegiveis(textoDeducao(e))}</li>
            ))}
          </ul>
        </div>
      )}
      {x.tetos.length > 0 && (
        <div className="mt-2">
          <p className="rotulo text-mineral">Tetos aplicados</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
            {x.tetos.map((e) => (
              <li key={e.motivo}>{textoTeto(e)}</li>
            ))}
          </ul>
        </div>
      )}
      {x.itens && (
        <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
          Itens da anatomia (fração de 0 a 1): {Object.entries(x.itens).map(([k, v]) => `${k} ${num(v, 1)}`).join("; ")}.
        </p>
      )}
      {x.revisor && <p className="mt-2 text-xs text-mineral">Revisor em contexto limpo: {x.revisor}.</p>}
    </section>
  );
}

function Ficha({ a, rota }: { a: AvaliacaoGold; rota: string }) {
  const p = a.paginas.find((x) => x.rota === rota);
  if (!p) return <p className="text-sm text-carvao-muted">A página escolhida não está nesta rodada de avaliação.</p>;
  const defeitos = a.defeitos.filter((d) => p.defeitos.includes(d.id));
  return (
    <div className="space-y-4" data-ficha={p.rota}>
      <header>
        <p className="rotulo text-mineral">
          {ROTULO_TIPO[p.tipo]} · {a.modulos.find((m) => m.id === p.modulo)?.rotulo ?? ""} · rodada {a.rodada.id}
        </p>
        <h3 className="mt-1 font-serif text-xl text-carvao">{p.titulo ?? p.rota}</h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
          Nota ponderada {p.nota_ponderada === null ? "não avaliada" : num(p.nota_ponderada, 1)}.{" "}
          {p.atende_meta ? "A página atende à meta de produto." : p.abaixo_da_meta.length ? `Fora da meta: ${p.abaixo_da_meta.join("; ")}.` : "A página não atende à meta de produto."}{" "}
          <Link href={p.rota} className="text-energia-dark underline underline-offset-4">
            Abrir a página
          </Link>
          {p.amostra ? " Esta página faz parte de uma amostra da família: a nota vale para ela, não para as demais." : ""}
        </p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        {ORDEM_DIMENSOES.map((id) => (
          <CartaoDimensao key={id} a={a} p={p} id={id} />
        ))}
      </div>
      {defeitos.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Defeitos que afetam esta página</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {defeitos.map((d) => (
              <li key={d.id}>
                {d.id}, {ROTULO_SEVERIDADE[d.severidade].toLowerCase()}: {datasLegiveis(d.descricao)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.golds.length > 0 && <p className="text-xs text-mineral">Golds que alimentam a página: {p.golds.join(", ")}.</p>}
    </div>
  );
}

export function AvaliacaoPaginas({ linhas, versao }: { linhas: LinhaTabela[]; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.pag ? linhas.find((l) => l.rota === v.pag) : undefined;
  const c = useAvaliacao(!!escolhida);
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo="Nota de cada página por dimensão"
        colunas={COLUNAS_PAGINAS}
        linhas={linhas}
        chaveLinha="rota"
        colunaRotulo="titulo"
        fonte="Scrutiniums, avaliacao.json (medição por navegador, jornadas, revisão visual e didática, golds e testes)"
        versao={versao}
        nomeArquivo="avaliacao-paginas"
        chaveUrl="ava"
        ordemInicial={{ coluna: "ponderada", direcao: "asc" }}
        tamanhoPagina={25}
        dicaBusca="Nome ou rota da página"
        selecionado={escolhida ? String(escolhida.rota) : null}
        onSelecionar={(id) => definir({ pag: id ?? "" })}
        nota="Sem nota na célula quer dizer dimensão não avaliada ou que não se aplica à página, nunca zero. As famílias de verbetes, fichas de conjuntos e fichas de empresas foram amostradas. Escolha uma linha para ver a evidência de cada nota."
      />
      <section aria-labelledby="ficha-pagina-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="ficha-pagina-h" className="rotulo text-mineral">
          Evidência da nota
        </h3>
        {!escolhida ? (
          <p className="mt-2 text-sm text-carvao-muted">Escolha uma linha da tabela para ver, dimensão a dimensão, o que foi medido, o que foi deduzido e qual teto limitou a nota.</p>
        ) : c.estado === "carregando" ? (
          <p role="status" className="mt-2 text-sm text-carvao-muted">
            Lendo a evidência da página…
          </p>
        ) : c.estado === "erro" ? (
          <p role="alert" className="mt-2 text-sm text-erro">
            Não foi possível ler a evidência: {c.motivo}. O arquivo continua disponível para baixar no rodapé do painel.
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
