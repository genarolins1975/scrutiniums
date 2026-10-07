"use client";

import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson, carregaTexto, lerCaminho } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import {
  COLUNAS_CATALOGO,
  COLUNAS_RECURSOS,
  ROTULO_ESTADO_DADOS,
  URL_GOLD,
  evidenciaEtapas,
  lerCsv,
  linhasIntegracao,
  linhasRecursos,
  rotuloTema,
  urlOficial,
  type SituacaoEtapa,
} from "@/lib/energia/dados";
import type { CatalogoDados, ConjuntoIntegrado, EntradaDados } from "@/lib/energia/tipos-dados";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * P067, catálogo utilizável: a tabela dos conjuntos com as cinco etapas da escada em colunas
 * (nenhum salto de catalogado para publicado fica escondido) e, para a linha escolhida, a
 * ficha com a evidência de cada etapa. A ficha lê a entrada completa de catalogo.json só ao
 * escolher a linha (uma leitura por página, compartilhada), para o HTML não carregar as
 * 415 fichas. A linha escolhida fica na URL (?c=): o link abre a mesma ficha.
 */

const ESQUEMA = { c: campo(tiposUrl.texto({ max: 200 }), "") };

const MARCA: Record<SituacaoEtapa, { glifo: string; texto: string; cor: string }> = {
  sim: { glifo: "●", texto: "cumprida", cor: "text-sucesso" },
  nao: { glifo: "○", texto: "não alcançada", cor: "text-mineral" },
  falhou: { glifo: "✕", texto: "tentada, sem êxito", cor: "text-erro" },
};

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; entrada: EntradaDados; portais: CatalogoDados["portais"]; integracoes: ConjuntoIntegrado[] };

function useEntrada(id: string, n: number | null): Carga {
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  useEffect(() => {
    if (n === null) return;
    let vivo = true;
    setC({ estado: "carregando" });
    // a entrada vem do catálogo; a evidência de cada integração vem de publicacao.json (lida só se o conjunto é integrado)
    carregaJson<unknown>(URL_GOLD.catalogo)
      .then(async (cat) => {
        const e = lerCaminho(cat, `entradas[${n}]`) as EntradaDados | undefined;
        const portais = lerCaminho(cat, "portais") as CatalogoDados["portais"] | undefined;
        if (!e || e.id !== id || !portais) return { erro: "A entrada não foi encontrada no catálogo publicado: a gold foi atualizada depois desta página.", e: null } as const;
        let integracoes: ConjuntoIntegrado[] = [];
        if ((e.integracoes ?? []).length) {
          const conjuntos = (lerCaminho(await carregaJson<unknown>(URL_GOLD.publicacao), "conjuntos") as ConjuntoIntegrado[] | undefined) ?? [];
          const ids = new Set((e.integracoes ?? []).map((x) => x.id));
          integracoes = conjuntos.filter((c) => ids.has(c.id));
        }
        return { e, portais, integracoes, erro: "" } as const;
      })
      .then((r) => {
        if (!vivo) return;
        if (r.e === null) setC({ estado: "erro", motivo: r.erro });
        else setC({ estado: "ok", entrada: r.e, portais: r.portais, integracoes: r.integracoes });
      })
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [id, n]);
  return c;
}

function Ficha({ id, n, slugsComFicha }: { id: string; n: number; slugsComFicha: readonly string[] }) {
  const c = useEntrada(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Lendo a ficha do conjunto no catálogo publicado…
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        Não foi possível ler a ficha: {c.motivo}
      </p>
    );
  const e = c.entrada;
  const etapas = evidenciaEtapas(e);
  const oficial = urlOficial(e, c.portais);
  const licenca = e.licenca ?? c.portais[e.orgao]?.licenca ?? "não informada";
  return (
    <div className="space-y-4" data-ficha={e.id}>
      <header>
        <p className="rotulo text-mineral">
          {e.orgao} · {rotuloTema(e.tema)} · {ROTULO_ESTADO_DADOS[e.estado]}
          {e.descontinuado ? " · descontinuado pela fonte" : ""}
        </p>
        <h3 className="mt-1 font-serif text-xl text-carvao">{e.titulo}</h3>
        {e.descricao && <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{e.descricao}</p>}
      </header>

      <ol className="grid gap-px border border-linha bg-linha md:grid-cols-5" aria-label="Escada de estados do conjunto">
        {etapas.map((x) => {
          const m = MARCA[x.situacao];
          return (
            <li key={x.id} className="min-w-0 bg-superficie p-3">
              <p className="rotulo text-mineral">{x.rotulo}</p>
              <p className={`mt-1 text-sm ${m.cor}`}>
                <span aria-hidden="true">{m.glifo}</span> {m.texto}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{x.detalhe}</p>
            </li>
          );
        })}
      </ol>

      {c.integracoes.length > 0 && (
        <div className="text-sm" data-integracoes="true">
          <p className="rotulo text-mineral">{c.integracoes.length === 1 ? "Integração do conjunto" : `Integrações do conjunto (${c.integracoes.length})`}</p>
          <ul className="mt-1 space-y-2">
            {c.integracoes.map((i) => (
              <li key={i.id} className="leading-relaxed text-carvao-muted">
                {linhasIntegracao(i).join(" ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(e.ressalvas ?? []).length > 0 && (
        <div className="border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao" data-ressalva="true">
          <p className="rotulo text-aviso">Ressalva declarada</p>
          <ul className="mt-1 list-disc pl-5">
            {(e.ressalvas ?? []).map((r) => (
              <li key={r}>
                <TextoDoLeitor texto={r} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {e.descontinuacao && (
        <p className="text-sm leading-relaxed text-carvao">
          <span className="rotulo mr-2 text-mineral">Descontinuado</span>
          Critério: {e.descontinuacao.motivo}. Evidência: {e.descontinuacao.evidencia}.
        </p>
      )}

      <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Página oficial do conjunto</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere]">
            {oficial ? (
              <a href={oficial} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {oficial} ↗
              </a>
            ) : (
              "não informada"
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Licença</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere] text-carvao-muted">{licenca || "não informada"}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Frequência declarada pela fonte</dt>
          <dd className="mt-0.5 text-carvao-muted">{e.frequencia_declarada ?? "não declarada"}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Última modificação na fonte</dt>
          <dd className="mt-0.5 text-carvao-muted">{e.modificado_na_fonte ? dataBR(e.modificado_na_fonte.slice(0, 10)) : e.recursos_resumo?.ultimo_publicado ? `arquivos até ${dataBR(e.recursos_resumo.ultimo_publicado.slice(0, 10))}` : "não informada"}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Uso no observatório</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.usado_em.length ? (
              <>
                {(e.papeis ?? []).join(", ") || "indicador"} em {e.usado_em.join(", ")}
                {(e.modelos ?? []).length ? ` · modelos ${(e.modelos ?? []).join(", ")}` : ""}
              </>
            ) : (
              "nenhum: o conjunto está catalogado, mas não alimenta nenhuma base publicada"
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Arquivos (recursos)</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.recursos_resumo
              ? `${num(e.recursos_resumo.total, 0)} no conjunto, ${num(e.recursos_resumo.acessados ?? 0, 0)} acessados pelo pipeline${e.recursos_resumo.removidos ? `, ${num(e.recursos_resumo.removidos, 0)} removidos pela fonte` : ""}`
              : "não contados"}
          </dd>
        </div>
      </dl>

      {(e.paginas ?? []).length > 0 && (
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Usado nas páginas</span>
          {(e.paginas ?? []).map((p, i) => (
            <span key={p.href}>
              {i > 0 ? " · " : ""}
              <Link href={p.href} className="text-energia-dark underline underline-offset-4">
                {p.rotulo}
              </Link>
            </span>
          ))}
        </p>
      )}
      {e.slug && slugsComFicha.includes(e.slug) && (
        <p className="text-sm">
          <Link href={`/setor-eletrico/dados/${e.slug}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Abrir a ficha do conjunto: capturas com sha256, downloads e como citar
          </Link>
        </p>
      )}
      {e.quebras.length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">Mudanças metodológicas</p>
          <ul className="mt-1 space-y-1 text-carvao-muted">
            {e.quebras.map((q) => (
              <li key={`${q.data}-${q.origem ?? "FONTE"}`}>
                <strong className="font-medium text-carvao">{dataBR(q.data)}</strong> ({q.origem === "PLATAFORMA" ? "identificada pela Scrutiniums no dado" : "declarada pela fonte"}): {q.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(e.recursos ?? []).length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">Recursos do conjunto na CCEE, um a um</p>
          <ul className="mt-1 divide-y divide-linha border border-linha">
            {(e.recursos ?? []).map((r) => (
              <li key={r.nome ?? "sem-nome"} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-1.5">
                <span className="text-carvao">{r.nome ?? "sem nome"}</span>
                <span className="text-xs text-carvao-muted">
                  {ROTULO_ESTADO_DADOS[r.estado]}
                  {r.formato ? ` · ${r.formato}` : ""}
                  {r.publicado_em ? ` · publicado em ${dataBR(r.publicado_em.slice(0, 10))}` : ""}
                  {r.capturas ? ` · ${num(r.capturas, 0)} ${r.capturas === 1 ? "captura" : "capturas"}` : ""}
                  {r.removido ? " · removido pela fonte" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DadosCatalogo({ linhas, slugsComFicha, versao }: { linhas: LinhaTabela[]; slugsComFicha: string[]; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.c ? linhas.find((l) => l.id === v.c) : undefined;
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo="Conjuntos catalogados, com as etapas da escada e o uso declarado"
        colunas={COLUNAS_CATALOGO}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        fonte="Scrutiniums, catalogo.json (listagens do ONS, da ANEEL e da CCEE, package_show versionados, registros dos módulos e cadastro manual)"
        versao={versao}
        nomeArquivo="dados-catalogo"
        chaveUrl="cat"
        ordemInicial={{ coluna: "etapas", direcao: "desc" }}
        tamanhoPagina={25}
        dicaBusca="Nome do conjunto"
        selecionado={escolhida ? String(escolhida.id) : null}
        onSelecionar={(id) => definir({ c: id ?? "" })}
        nota="Sim e não nas cinco etapas seguem a escada: um conjunto só tem uma etapa quando cumpriu todas as anteriores. Uso declarado é outro eixo: um conjunto pode estar em uso e abaixo de publicado, e nesse caso a ressalva diz o que falta. A frequência é o texto da fonte, sem correção."
      />
      <section aria-labelledby="ficha-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="ficha-h" className="rotulo text-mineral">
          Ficha do conjunto
        </h3>
        {escolhida ? (
          <div className="mt-3">
            <Ficha id={String(escolhida.id)} n={Number(escolhida.n)} slugsComFicha={slugsComFicha} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-carvao-muted">Escolha uma linha da tabela para ver, etapa por etapa, o que cada uma exigiu e o que o catálogo registrou como evidência.</p>
        )}
      </section>
    </div>
  );
}

type CargaCsv = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; linhas: LinhaTabela[] };

/** Recurso a recurso da CCEE: o CSV publicado, lido ao abrir o bloco (733 linhas não vão no HTML). */
export function DadosRecursosCcee({ url, versao }: { url: string; versao: string }) {
  const [c, setC] = useState<CargaCsv>({ estado: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregaTexto(url)
      .then((t) => vivo && setC({ estado: "ok", linhas: linhasRecursos(lerCsv(t)) }))
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [url]);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Lendo a tabela de recursos da CCEE…
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        Não foi possível ler a tabela: {c.motivo}. O arquivo continua disponível para baixar no link do painel.
      </p>
    );
  return (
    <TabelaInterativa
      titulo="Recursos (arquivos) dos conjuntos da CCEE, um a um"
      colunas={COLUNAS_RECURSOS}
      linhas={c.linhas}
      chaveLinha="id"
      colunaRotulo="recurso"
      fonte="CCEE, portal de dados abertos (listagem package_search); estado de cada recurso calculado pelo pipeline"
      versao={versao}
      nomeArquivo="dados-recursos-ccee"
      chaveUrl="rec"
      ordemInicial={{ coluna: "estado", direcao: "desc" }}
      tamanhoPagina={25}
      dicaBusca="Conjunto ou recurso"
      nota={`Um recurso herda o estado da integração que o capturou com sha256; o lido só por requisição parcial está em recurso verificado; os demais, em catalogado. Carimbo da gold: ${carimbo(versao)}.`}
    />
  );
}
