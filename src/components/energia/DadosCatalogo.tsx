"use client";

import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import Link from "@/components/energia/LinkSemPrefetch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListaConsultavel, type ContextoLista } from "@/components/energia/ListaConsultavel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson, carregaTexto, lerCaminho } from "@/lib/energia/carregaJson";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import {
  COLUNAS_CATALOGO,
  COLUNAS_RECURSOS,
  ESTADOS_ESCADA,
  ROTULO_ESTADO_ATE,
  ROTULO_ESTADO_DADOS,
  ROTULO_PAPEL,
  URL_GOLD,
  estadosAPartirDe,
  evidenciaEtapas,
  expandirLinhas,
  lerCsv,
  linhasIntegracao,
  linhasRecursos,
  urlOficial,
  type MatrizLinhas,
  type SituacaoEtapa,
} from "@/lib/energia/dados";
import { nomeDoConjunto, formatoDoArquivo } from "@/lib/energia/dados-ficha";
import type { CatalogoDados, ConjuntoIntegrado, EntradaDados, EstadoDados } from "@/lib/energia/tipos-dados";
import { textoData, type LinhaTabela } from "@/lib/energia/tabela";

/**
 * O catálogo de conjuntos, uma lista só: busca, filtros por tema, órgão e estado, ordenação, páginas curtas, exportação do recorte e,
 * em cada conjunto, o estado mais avançado que ele alcançou, o período dos dados, a cobertura em arquivos, a ficha e os arquivos para
 * baixar. O detalhe de cada conjunto mostra a escada inteira (o histórico de estados, com a evidência de cada etapa); a escada é
 * cumulativa, então cada conjunto aparece uma vez, no estado mais avançado, e nenhum estado é uma fatia que se some com as outras.
 *
 * O detalhe lê a entrada completa de catalogo.json só ao abrir (uma leitura por página, compartilhada), para o HTML não carregar as 415
 * entradas. O item aberto fica na URL (?c=): o link abre o mesmo detalhe. A tabela completa (todas as colunas, mesma busca e mesmos
 * filtros, com exportação) fica em Analisar e segue o mesmo recorte pela URL.
 */

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

/** Os cinco passos da escada como marcas: preenchidos até o estado mais avançado. Só redundância visual; o texto diz o estado. */
function Passos({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`inline-block h-2.5 w-3 border ${i < n ? "border-energia bg-energia" : "border-mineral bg-transparent"}`} />
      ))}
    </span>
  );
}

function Detalhe({ id, n, rotulosDosArquivos }: { id: string; n: number; rotulosDosArquivos: Record<string, string> }) {
  const c = useEntrada(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Lendo o histórico do conjunto no catálogo publicado…
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        Não foi possível ler o detalhe: {c.motivo}
      </p>
    );
  const e = c.entrada;
  const etapas = evidenciaEtapas(e);
  const oficial = urlOficial(e, c.portais);
  const licenca = e.licenca ?? c.portais[e.orgao]?.licenca ?? "não informada";
  const nome = nomeDoConjunto(e, c.integracoes);
  const paginas = (e.paginas ?? []).map((p) => p.rotulo);
  const baixar = e.downloads ?? [];
  return (
    <div className="space-y-4" data-detalhe={e.id}>
      <div>
        <p className="rotulo text-mineral">Histórico de estados</p>
        <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Estado mais avançado: <strong className="font-medium text-carvao">{ROTULO_ESTADO_DADOS[e.estado]}</strong>. Cada etapa só vale quando as anteriores foram cumpridas, e o que cada uma exigiu está registrado abaixo.
        </p>
        <ol className="mt-2 space-y-2" aria-label="Escada de estados do conjunto">
          {etapas.map((x) => {
            const m = MARCA[x.situacao];
            return (
              <li key={x.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 text-sm">
                <span aria-hidden="true" className={m.cor}>
                  {m.glifo}
                </span>
                <div className="min-w-0">
                  <p className="text-carvao">
                    <strong className="font-medium">{x.rotulo}</strong>
                    <span className={`ml-2 ${m.cor}`}>{m.texto}</span>
                  </p>
                  <p className="text-xs leading-relaxed text-carvao-muted">{x.detalhe}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {c.integracoes.length > 0 && (
        <div className="text-sm" data-integracoes="true" data-nivel="analisar">
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
                {(e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(", ") || "indicador"}
                {paginas.length ? ` ${paginas.length === 1 ? "na página" : "nas páginas"} ${paginas.join(", ")}` : ""}
                <span data-nivel="analisar">
                  {" "}
                  ({e.usado_em.join(", ")}
                  {(e.modelos ?? []).length ? ` · modelos ${(e.modelos ?? []).join(", ")}` : ""})
                </span>
              </>
            ) : (
              "nenhum: o conjunto está catalogado, mas não alimenta nenhuma base publicada"
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Cobertura em arquivos (recursos)</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.recursos_resumo
              ? `${num(e.recursos_resumo.total, 0)} no conjunto, ${num(e.recursos_resumo.acessados ?? 0, 0)} acessados pelo observatório${e.recursos_resumo.removidos ? `, ${num(e.recursos_resumo.removidos, 0)} removidos pela fonte` : ""}`
              : "não contados"}
          </dd>
        </div>
        {nome.tituloNaFonte && (
          <div className="min-w-0 md:col-span-2" data-nivel="analisar">
            <dt className="rotulo text-mineral">Título na fonte</dt>
            <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">{nome.tituloNaFonte}</dd>
          </div>
        )}
        {e.descricao && (
          <div className="min-w-0 md:col-span-2" data-nivel="analisar">
            <dt className="rotulo text-mineral">Descrição guardada no catálogo</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-carvao-muted">
              {e.descricao}
              {e.descricao.endsWith("…") ? " O texto completo está no CSV do catálogo e na página oficial do conjunto." : ""}
            </dd>
          </div>
        )}
      </dl>

      {baixar.length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">Arquivos para baixar</p>
          <ul className="mt-1 space-y-0">
            {baixar.map((u) => (
              <li key={u}>
                <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {rotulosDosArquivos[u] ?? u.split("/").pop()} ({formatoDoArquivo(u)})
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mineral">A validação de cada arquivo e o significado das colunas estão na ficha do conjunto.</p>
        </div>
      )}

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

/** Um conjunto na lista: nome, órgão e tema, período dos dados, atualização na fonte, cobertura em arquivos e estado mais avançado. */
function LinhaDoConjunto({ l }: { l: LinhaTabela }) {
  const etapas = Number(l.etapas) || 0;
  const periodo = typeof l.periodo === "string" ? textoData(l.periodo) : null;
  const modificado = typeof l.modificado === "string" ? dataBR(l.modificado.slice(0, 10)) : null;
  const recursos = typeof l.recursos === "number" ? l.recursos : null;
  const acessados = typeof l.acessados === "number" ? l.acessados : 0;
  const uso = typeof l.uso === "string" && l.uso !== "sem uso declarado" ? l.uso : null;
  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0">
        <p className="rotulo text-mineral">
          {String(l.orgao)} · {String(l.tema)}
          {l.frequencia && l.frequencia !== "não declarada" ? ` · ${String(l.frequencia)}` : ""}
        </p>
        <h3 className="mt-0.5 font-serif text-lg leading-snug text-carvao [overflow-wrap:anywhere]">{String(l.titulo)}</h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
          {periodo ? `Dados até ${periodo}` : "Período dos dados não medido"}
          {modificado ? ` · fonte atualizada em ${modificado}` : ""}
          {recursos !== null ? ` · ${num(acessados, 0)} de ${num(recursos, 0)} ${recursos === 1 ? "arquivo acessado" : "arquivos acessados"}` : " · arquivos não contados"}
        </p>
        {(l.descontinuado === "sim" || l.ressalva === "sim" || uso) && (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-carvao-muted">
            {uso && <span>Uso no observatório: {uso}</span>}
            {l.ressalva === "sim" && <span>Com ressalva declarada</span>}
            {l.descontinuado === "sim" && <span>Descontinuado pela fonte</span>}
          </p>
        )}
      </div>
      <div className="md:text-right">
        <p className="rotulo text-mineral">Estado mais avançado</p>
        <p className="mt-0.5 flex items-center gap-2 md:justify-end">
          <Passos n={etapas} />
          <span className="text-sm font-medium text-carvao" data-estado-linha={String(l.estado)}>
            {String(l.estado)}
          </span>
          <span className="sr-only"> (etapa {etapas} de 5)</span>
        </p>
        {l.verificado === "falhou" && <p className="mt-0.5 text-xs text-carvao-muted">A tentativa de abrir o arquivo falhou.</p>}
      </div>
    </div>
  );
}

/** Estado na barra de filtros: "chegou a" uma etapa ou além, porque a escada é cumulativa (a contagem de cada opção inclui as etapas seguintes). */
function SeletorDeEstado({ ctx }: { ctx: ContextoLista }) {
  const marcados = ctx.filtros["estado"] ?? [];
  const exatas = ctx.contagemPorValor("estado");
  const rotulos = (s: EstadoDados) => estadosAPartirDe(s).map((x) => ROTULO_ESTADO_DADOS[x]);
  const igual = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const atual = marcados.length === 0 ? "CATALOGADO" : (ESTADOS_ESCADA.find((s) => s !== "CATALOGADO" && igual(marcados, rotulos(s))) ?? null);
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-mineral">
      <span className="rotulo">Estado: chegou a</span>
      <select
        value={atual ?? "__outro"}
        onChange={(ev) => {
          const s = ev.target.value as EstadoDados;
          if (!ESTADOS_ESCADA.includes(s)) return;
          ctx.definirFiltro("estado", s === "CATALOGADO" ? [] : rotulos(s));
        }}
        className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia"
      >
        {ESTADOS_ESCADA.map((s) => {
          const n = estadosAPartirDe(s).reduce((t, x) => t + (exatas[ROTULO_ESTADO_DADOS[x]] ?? 0), 0);
          return (
            <option key={s} value={s}>
              {ROTULO_ESTADO_ATE[s]} ({num(n, 0)})
            </option>
          );
        })}
        {atual === null && <option value="__outro">Estados escolhidos na tabela</option>}
      </select>
    </label>
  );
}

export function DadosCatalogo({
  matriz,
  portais,
  versao,
  rotulosDosArquivos,
  arquivoCompleto,
  tituloTabela,
  apoioTabela,
  children,
}: {
  matriz: MatrizLinhas;
  portais: CatalogoDados["portais"];
  versao: string;
  rotulosDosArquivos: Record<string, string>;
  arquivoCompleto: { rotulo: string; url: string };
  tituloTabela: string;
  apoioTabela: string;
  /** O que fica entre a lista e a tabela completa (notas, resposta, capítulos): servidor, passado como filho. */
  children?: ReactNode;
}) {
  const linhas = useMemo(() => expandirLinhas(matriz), [matriz]);
  const colunasTabela = COLUNAS_CATALOGO;
  return (
    <div className="space-y-8">
      <ListaConsultavel
        rotulo="Conjuntos do catálogo"
        substantivo={["conjunto", "conjuntos"]}
        colunas={colunasTabela}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        prefixo="cat"
        paramAberto="c"
        ordemInicial={{ coluna: "etapas", direcao: "desc" }}
        opcoesOrdem={[
          { id: "estado", rotulo: "Estado mais avançado, do maior ao menor", ordem: { coluna: "etapas", direcao: "desc" } },
          { id: "nome", rotulo: "Nome, de A a Z", ordem: { coluna: "titulo", direcao: "asc" } },
          { id: "orgao", rotulo: "Órgão, de A a Z", ordem: { coluna: "orgao", direcao: "asc" } },
          { id: "fonte", rotulo: "Atualização na fonte, da mais recente", ordem: { coluna: "modificado", direcao: "desc" } },
          { id: "periodo", rotulo: "Último período dos dados, do mais recente", ordem: { coluna: "periodo", direcao: "desc" } },
          { id: "arquivos", rotulo: "Número de arquivos, do maior ao menor", ordem: { coluna: "recursos", direcao: "desc" } },
        ]}
        filtrosDaBarra={["tema", "orgao"]}
        filtrosOcultos={["integrado", "validado", "publicado", "estado"]}
        tamanhoPagina={10}
        rotuloBusca="Encontre um conjunto"
        dicaBusca="Nome do conjunto, órgão ou tema"
        fonte="Scrutiniums, catálogo de conjuntos (listagens do ONS, da ANEEL e da CCEE, metadados oficiais guardados, registros dos módulos e cadastro manual)"
        versao={versao}
        nomeDoArquivo="dados-catalogo"
        arquivoCompleto={arquivoCompleto}
        rotuloDetalhe="Histórico de estados e detalhes"
        renderLinha={(l) => <LinhaDoConjunto l={l} />}
        renderAcoes={(l) => (
          <>
            {typeof l.slug === "string" && (
              <Link href={`/setor-eletrico/dados/${l.slug}`} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                {typeof l.baixar === "number" ? `Ficha e ${plural(l.baixar, "arquivo", "arquivos")} para baixar` : "Ficha do conjunto"}
              </Link>
            )}
            {(() => {
              const oficial = urlOficial({ id: String(l.id), orgao: String(l.orgao), url: typeof l.url === "string" ? l.url : undefined }, portais);
              return oficial ? (
                <a href={oficial} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                  Página oficial ↗
                </a>
              ) : null;
            })()}
          </>
        )}
        renderDetalhe={(l) => <Detalhe id={String(l.id)} n={Number(l.n)} rotulosDosArquivos={rotulosDosArquivos} />}
        renderNaBarra={(ctx) => <SeletorDeEstado ctx={ctx} />}
        semResultado={<>Nenhum conjunto corresponde à busca e aos filtros. O catálogo não contém tudo o que é público: um conjunto que não aparece aqui pode existir na fonte.</>}
      />

      {children && <div className="space-y-6">{children}</div>}

      <div id="tabela" data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
        <h3 id="tabela-catalogo-titulo" className="ed-h3 font-serif text-carvao">
          {tituloTabela}
        </h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{apoioTabela}</p>
        <TabelaInterativa
          titulo="Conjuntos catalogados, com as etapas da escada e o uso declarado"
          colunas={colunasTabela}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="titulo"
          fonte="Scrutiniums, catálogo de conjuntos (listagens do ONS, da ANEEL e da CCEE, metadados oficiais guardados, registros dos módulos e cadastro manual)"
          versao={versao}
          nomeArquivo="dados-catalogo"
          chaveUrl="cat"
          ordemInicial={{ coluna: "etapas", direcao: "desc" }}
          tamanhoPagina={25}
          dicaBusca="Nome do conjunto"
          nota="Sim e não nas cinco etapas seguem a escada: um conjunto só tem uma etapa quando cumpriu todas as anteriores, e a coluna de estado traz o mais avançado de cada um. Uso declarado é outro eixo: um conjunto pode estar em uso e abaixo de publicado, e nesse caso a ressalva diz o que falta. A frequência é o texto da fonte, sem correção."
        />
      </div>
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
