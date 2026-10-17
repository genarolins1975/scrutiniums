"use client";

import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import Link from "@/components/energia/LinkSemPrefetch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListaConsultavel, type ContextoLista } from "@/components/energia/ListaConsultavel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carregaJson, carregaTexto, lerCaminho } from "@/lib/energia/carregaJson";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { FREQUENCIA_EN, LICENCA_EN, PAINEIS_EN, rotuloDado, traduzido } from "@/lib/energia/i18n/regulacao-dados-metodo";
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
 *
 * Idioma: as linhas chegam do servidor já no idioma da página (linhasCatalogo); os nomes oficiais dos conjuntos ficam em português,
 * marcados como nome, e o texto escrito pela fonte (descrição, ressalva, mudança metodológica) sai marcado como trecho em português.
 */

const MARCA: Record<SituacaoEtapa, { glifo: string; cor: string }> = {
  sim: { glifo: "●", cor: "text-sucesso" },
  nao: { glifo: "○", cor: "text-mineral" },
  falhou: { glifo: "✕", cor: "text-erro" },
};

function textoMarca(s: SituacaoEtapa, tx: <T>(pt: T, en: T) => T): string {
  if (s === "sim") return tx("cumprida", "completed");
  if (s === "falhou") return tx("tentada, sem êxito", "attempted, unsuccessful");
  return tx("não alcançada", "not reached");
}

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; entrada: EntradaDados; portais: CatalogoDados["portais"]; integracoes: ConjuntoIntegrado[] };

function useEntrada(id: string, n: number | null): Carga {
  const tx = useTx();
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  const naoEncontrada = tx(
    "A entrada não foi encontrada no catálogo publicado: a gold foi atualizada depois desta página.",
    "The entry was not found in the published catalog: the gold file was updated after this page.",
  );
  useEffect(() => {
    if (n === null) return;
    let vivo = true;
    setC({ estado: "carregando" });
    // a entrada vem do catálogo; a evidência de cada integração vem de publicacao.json (lida só se o conjunto é integrado)
    carregaJson<unknown>(URL_GOLD.catalogo)
      .then(async (cat) => {
        const e = lerCaminho(cat, `entradas[${n}]`) as EntradaDados | undefined;
        const portais = lerCaminho(cat, "portais") as CatalogoDados["portais"] | undefined;
        if (!e || e.id !== id || !portais) return { erro: naoEncontrada, e: null } as const;
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
  }, [id, n, naoEncontrada]);
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

/** Valor da gold com tabela de tradução: em inglês, a forma da tabela ou, sem entrada, o original marcado como trecho em português. */
function DoDado({ tabela, valor, regiao }: { tabela: Record<string, string>; valor: string; regiao: string }) {
  const idioma = useIdioma();
  if (traduzido(tabela, valor, idioma)) return <>{rotuloDado(tabela, valor, idioma)}</>;
  return <TrechoPortugues regiao={regiao}>{valor}</TrechoPortugues>;
}

function Detalhe({ id, n, rotulosDosArquivos }: { id: string; n: number; rotulosDosArquivos: Record<string, string> }) {
  const tx = useTx();
  const idioma = useIdioma();
  const { dataBR, num } = formatos(idioma);
  const c = useEntrada(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        {tx("Lendo o histórico do conjunto no catálogo publicado…", "Reading the dataset history in the published catalog…")}
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        {tx("Não foi possível ler o detalhe:", "The detail could not be read:")} {c.motivo}
      </p>
    );
  const e = c.entrada;
  const etapas = evidenciaEtapas(e);
  const oficial = urlOficial(e, c.portais);
  const licenca = e.licenca ?? c.portais[e.orgao]?.licenca ?? null;
  const nome = nomeDoConjunto(e, c.integracoes);
  const paginas = (e.paginas ?? []).map((p) => rotuloDado(PAINEIS_EN, p.rotulo, idioma));
  const baixar = e.downloads ?? [];
  const naoInformada = tx("não informada", "not reported");
  return (
    <div className="space-y-4" data-detalhe={e.id}>
      <div>
        <p className="rotulo text-mineral">{tx("Histórico de estados", "History of states")}</p>
        <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {tx("Estado mais avançado:", "Most advanced state:")} <strong className="font-medium text-carvao">{ROTULO_ESTADO_DADOS[e.estado]}</strong>.{" "}
          {tx(
            "Cada etapa só vale quando as anteriores foram cumpridas, e o que cada uma exigiu está registrado abaixo.",
            "Each stage only counts when the previous ones were completed, and what each one required is recorded below.",
          )}
        </p>
        <ol className="mt-2 space-y-2" aria-label={tx("Escada de estados do conjunto", "Ladder of states of the dataset")}>
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
                    <span className={`ml-2 ${m.cor}`}>{textoMarca(x.situacao, tx)}</span>
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
          <p className="rotulo text-mineral">
            {c.integracoes.length === 1
              ? tx("Integração do conjunto", "Integration of the dataset")
              : tx(`Integrações do conjunto (${c.integracoes.length})`, `Integrations of the dataset (${c.integracoes.length})`)}
          </p>
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
          <p className="rotulo text-aviso">{tx("Ressalva declarada", "Declared caveat")}</p>
          <ul className="mt-1 list-disc pl-5">
            {(e.ressalvas ?? []).map((r) => (
              <li key={r}>
                <TrechoPortugues regiao="dados-ressalva">
                  <TextoDoLeitor texto={r} />
                </TrechoPortugues>
              </li>
            ))}
          </ul>
        </div>
      )}
      {e.descontinuacao && (
        <p className="text-sm leading-relaxed text-carvao">
          <span className="rotulo mr-2 text-mineral">{tx("Descontinuado", "Discontinued")}</span>
          {tx("Critério:", "Criterion:")} <TrechoPortugues regiao="dados-descontinuacao">{e.descontinuacao.motivo}</TrechoPortugues>. {tx("Evidência:", "Evidence:")}{" "}
          <TrechoPortugues regiao="dados-descontinuacao">{e.descontinuacao.evidencia}</TrechoPortugues>.
        </p>
      )}

      <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Página oficial do conjunto", "Official page of the dataset")}</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere]">
            {oficial ? (
              <a href={oficial} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {oficial} ↗
              </a>
            ) : (
              naoInformada
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Licença", "License")}</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere] text-carvao-muted">{licenca ? <DoDado tabela={LICENCA_EN} valor={licenca} regiao="dados-licenca" /> : naoInformada}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Frequência declarada pela fonte", "Frequency declared by the source")}</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.frequencia_declarada ? <DoDado tabela={FREQUENCIA_EN} valor={e.frequencia_declarada} regiao="dados-frequencia" /> : tx("não declarada", "not declared")}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Última modificação na fonte", "Latest modification at the source")}</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.modificado_na_fonte
              ? dataBR(e.modificado_na_fonte.slice(0, 10))
              : e.recursos_resumo?.ultimo_publicado
                ? tx(`arquivos até ${dataBR(e.recursos_resumo.ultimo_publicado.slice(0, 10))}`, `files up to ${dataBR(e.recursos_resumo.ultimo_publicado.slice(0, 10))}`)
                : naoInformada}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Uso no observatório", "Use in the observatory")}</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.usado_em.length ? (
              <>
                {(e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(", ") || ROTULO_PAPEL.indicador}
                {paginas.length ? tx(` ${paginas.length === 1 ? "na página" : "nas páginas"} ${paginas.join(", ")}`, ` on the ${paginas.length === 1 ? "page" : "pages"} ${paginas.join(", ")}`) : ""}
                <span data-nivel="analisar">
                  {" "}
                  ({e.usado_em.join(", ")}
                  {(e.modelos ?? []).length ? tx(` · modelos ${(e.modelos ?? []).join(", ")}`, ` · models ${(e.modelos ?? []).join(", ")}`) : ""})
                </span>
              </>
            ) : (
              tx("nenhum: o conjunto está catalogado, mas não alimenta nenhuma base publicada", "none: the dataset is cataloged, but does not feed any published base")
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Cobertura em arquivos (recursos)", "Coverage in files (resources)")}</dt>
          <dd className="mt-0.5 text-carvao-muted">
            {e.recursos_resumo
              ? tx(
                  `${num(e.recursos_resumo.total, 0)} no conjunto, ${num(e.recursos_resumo.acessados ?? 0, 0)} acessados pelo observatório${e.recursos_resumo.removidos ? `, ${num(e.recursos_resumo.removidos, 0)} removidos pela fonte` : ""}`,
                  `${num(e.recursos_resumo.total, 0)} in the dataset, ${num(e.recursos_resumo.acessados ?? 0, 0)} accessed by the observatory${e.recursos_resumo.removidos ? `, ${num(e.recursos_resumo.removidos, 0)} removed by the source` : ""}`,
                )
              : tx("não contados", "not counted")}
          </dd>
        </div>
        {nome.tituloNaFonte && (
          <div className="min-w-0 md:col-span-2" data-nivel="analisar">
            <dt className="rotulo text-mineral">{tx("Título na fonte", "Title at the source")}</dt>
            <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">
              <Nome>{nome.tituloNaFonte}</Nome>
            </dd>
          </div>
        )}
        {e.descricao && (
          <div className="min-w-0 md:col-span-2" data-nivel="analisar">
            <dt className="rotulo text-mineral">{tx("Descrição guardada no catálogo", "Description stored in the catalog")}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-carvao-muted">
              <TrechoPortugues regiao="dados-descricao">{e.descricao}</TrechoPortugues>
              {e.descricao.endsWith("…")
                ? tx(" O texto completo está no CSV do catálogo e na página oficial do conjunto.", " The full text is in the catalog CSV and on the official page of the dataset.")
                : ""}
            </dd>
          </div>
        )}
      </dl>

      {baixar.length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">{tx("Arquivos para baixar", "Files to download")}</p>
          <ul className="mt-1 space-y-0">
            {baixar.map((u) => (
              <li key={u}>
                <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {rotulosDosArquivos[u] ?? u.split("/").pop()} ({formatoDoArquivo(u)})
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mineral">{tx("A validação de cada arquivo e o significado das colunas estão na ficha do conjunto.", "The validation of each file and the meaning of the columns are in the dataset record.")}</p>
        </div>
      )}

      {(e.paginas ?? []).length > 0 && (
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">{tx("Usado nas páginas", "Used on the pages")}</span>
          {(e.paginas ?? []).map((p, i) => (
            <span key={p.href}>
              {i > 0 ? " · " : ""}
              <Link href={p.href} className="text-energia-dark underline underline-offset-4">
                {rotuloDado(PAINEIS_EN, p.rotulo, idioma)}
              </Link>
            </span>
          ))}
        </p>
      )}
      {e.quebras.length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">{tx("Mudanças metodológicas", "Methodological changes")}</p>
          <ul className="mt-1 space-y-1 text-carvao-muted">
            {e.quebras.map((q) => (
              <li key={`${q.data}-${q.origem ?? "FONTE"}`}>
                <strong className="font-medium text-carvao">{dataBR(q.data)}</strong> (
                {q.origem === "PLATAFORMA" ? tx("identificada pela Scrutiniums no dado", "identified by Scrutiniums in the data") : tx("declarada pela fonte", "declared by the source")}):{" "}
                <TrechoPortugues regiao="dados-quebra">{q.descricao}</TrechoPortugues>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(e.recursos ?? []).length > 0 && (
        <div className="text-sm">
          <p className="rotulo text-mineral">{tx("Recursos do conjunto na CCEE, um a um", "Resources of the dataset at CCEE, one by one")}</p>
          <ul className="mt-1 divide-y divide-linha border border-linha">
            {(e.recursos ?? []).map((r) => (
              <li key={r.nome ?? "sem-nome"} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-1.5">
                <span className="text-carvao">{r.nome ? <Nome>{r.nome}</Nome> : tx("sem nome", "no name")}</span>
                <span className="text-xs text-carvao-muted">
                  {ROTULO_ESTADO_DADOS[r.estado]}
                  {r.formato ? ` · ${r.formato}` : ""}
                  {r.publicado_em ? tx(` · publicado em ${dataBR(r.publicado_em.slice(0, 10))}`, ` · published on ${dataBR(r.publicado_em.slice(0, 10))}`) : ""}
                  {r.capturas ? tx(` · ${num(r.capturas, 0)} ${r.capturas === 1 ? "captura" : "capturas"}`, ` · ${num(r.capturas, 0)} ${r.capturas === 1 ? "capture" : "captures"}`) : ""}
                  {r.removido ? tx(" · removido pela fonte", " · removed by the source") : ""}
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
  const tx = useTx();
  const { dataBR, num } = formatos(useIdioma());
  // as linhas chegam no idioma da página: "sim", "não declarada" e "sem uso declarado" têm a forma inglesa correspondente
  const sim = tx("sim", "yes");
  const naoDeclarada = tx("não declarada", "not declared");
  const semUso = tx("sem uso declarado", "no declared use");
  const falhou = tx("falhou", "failed");
  const etapas = Number(l.etapas) || 0;
  // a data ISO sai no formato do idioma; o texto que não é data passa como veio
  const periodo = typeof l.periodo === "string" ? (/^\d{4}(-\d{2}){0,2}$/.test(l.periodo) ? dataBR(l.periodo) : textoData(l.periodo)) : null;
  const modificado = typeof l.modificado === "string" ? dataBR(l.modificado.slice(0, 10)) : null;
  const recursos = typeof l.recursos === "number" ? l.recursos : null;
  const acessados = typeof l.acessados === "number" ? l.acessados : 0;
  const uso = typeof l.uso === "string" && l.uso !== semUso ? l.uso : null;
  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0">
        <p className="rotulo text-mineral">
          {String(l.orgao)} · {String(l.tema)}
          {l.frequencia && l.frequencia !== naoDeclarada ? ` · ${String(l.frequencia)}` : ""}
        </p>
        <h3 className="mt-0.5 font-serif text-lg leading-snug text-carvao [overflow-wrap:anywhere]">
          <Nome>{String(l.titulo)}</Nome>
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
          {periodo ? tx(`Dados até ${periodo}`, `Data up to ${periodo}`) : tx("Período dos dados não medido", "Data period not measured")}
          {modificado ? tx(` · fonte atualizada em ${modificado}`, ` · source updated on ${modificado}`) : ""}
          {recursos !== null
            ? tx(
                ` · ${num(acessados, 0)} de ${num(recursos, 0)} ${recursos === 1 ? "arquivo acessado" : "arquivos acessados"}`,
                ` · ${num(acessados, 0)} of ${num(recursos, 0)} ${recursos === 1 ? "file accessed" : "files accessed"}`,
              )
            : tx(" · arquivos não contados", " · files not counted")}
        </p>
        {(l.descontinuado === sim || l.ressalva === sim || uso) && (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-carvao-muted">
            {uso && <span>{tx(`Uso no observatório: ${uso}`, `Use in the observatory: ${uso}`)}</span>}
            {l.ressalva === sim && <span>{tx("Com ressalva declarada", "With a declared caveat")}</span>}
            {l.descontinuado === sim && <span>{tx("Descontinuado pela fonte", "Discontinued by the source")}</span>}
          </p>
        )}
      </div>
      <div className="md:text-right">
        <p className="rotulo text-mineral">{tx("Estado mais avançado", "Most advanced state")}</p>
        <p className="mt-0.5 flex items-center gap-2 md:justify-end">
          <Passos n={etapas} />
          <span className="text-sm font-medium text-carvao" data-estado-linha={String(l.estado)}>
            {String(l.estado)}
          </span>
          <span className="sr-only">{tx(` (etapa ${etapas} de 5)`, ` (stage ${etapas} of 5)`)}</span>
        </p>
        {l.verificado === falhou && <p className="mt-0.5 text-xs text-carvao-muted">{tx("A tentativa de abrir o arquivo falhou.", "The attempt to open the file failed.")}</p>}
      </div>
    </div>
  );
}

/** Estado na barra de filtros: "chegou a" uma etapa ou além, porque a escada é cumulativa (a contagem de cada opção inclui as etapas seguintes). */
function SeletorDeEstado({ ctx }: { ctx: ContextoLista }) {
  const tx = useTx();
  const { num } = formatos(useIdioma());
  const marcados = ctx.filtros["estado"] ?? [];
  const exatas = ctx.contagemPorValor("estado");
  const rotulos = (s: EstadoDados) => estadosAPartirDe(s).map((x) => ROTULO_ESTADO_DADOS[x]);
  const igual = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const atual = marcados.length === 0 ? "CATALOGADO" : (ESTADOS_ESCADA.find((s) => s !== "CATALOGADO" && igual(marcados, rotulos(s))) ?? null);
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-mineral">
      <span className="rotulo">{tx("Estado: chegou a", "State: reached")}</span>
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
        {atual === null && <option value="__outro">{tx("Estados escolhidos na tabela", "States chosen in the table")}</option>}
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
  const tx = useTx();
  const { plural } = formatos(useIdioma());
  const linhas = useMemo(() => expandirLinhas(matriz), [matriz]);
  const colunasTabela = COLUNAS_CATALOGO;
  const fonte = tx(
    "Scrutiniums, catálogo de conjuntos (listagens do ONS, da ANEEL e da CCEE, metadados oficiais guardados, registros dos módulos e cadastro manual)",
    "Scrutiniums, dataset catalog (ONS, ANEEL and CCEE listings, stored official metadata, module registers and manual entries)",
  );
  return (
    <div className="space-y-8">
      <ListaConsultavel
        rotulo={tx("Conjuntos do catálogo", "Datasets in the catalog")}
        substantivo={tx(["conjunto", "conjuntos"], ["dataset", "datasets"])}
        colunas={colunasTabela}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        prefixo="cat"
        paramAberto="c"
        ordemInicial={{ coluna: "etapas", direcao: "desc" }}
        opcoesOrdem={[
          { id: "estado", rotulo: tx("Estado mais avançado, do maior ao menor", "Most advanced state, highest first"), ordem: { coluna: "etapas", direcao: "desc" } },
          { id: "nome", rotulo: tx("Nome, de A a Z", "Name, A to Z"), ordem: { coluna: "titulo", direcao: "asc" } },
          { id: "orgao", rotulo: tx("Órgão, de A a Z", "Body, A to Z"), ordem: { coluna: "orgao", direcao: "asc" } },
          // i18n: dado
          { id: "fonte", rotulo: tx("Atualização na fonte, da mais recente", "Update at the source, most recent first"), ordem: { coluna: "modificado", direcao: "desc" } },
          { id: "periodo", rotulo: tx("Último período dos dados, do mais recente", "Latest data period, most recent first"), ordem: { coluna: "periodo", direcao: "desc" } },
          { id: "arquivos", rotulo: tx("Número de arquivos, do maior ao menor", "Number of files, highest first"), ordem: { coluna: "recursos", direcao: "desc" } },
        ]}
        filtrosDaBarra={["tema", "orgao"]}
        filtrosOcultos={["integrado", "validado", "publicado", "estado"]}
        tamanhoPagina={10}
        rotuloBusca={tx("Encontre um conjunto", "Find a dataset")}
        dicaBusca={tx("Nome do conjunto, órgão ou tema", "Dataset name, body or theme")}
        fonte={fonte}
        versao={versao}
        nomeDoArquivo="dados-catalogo"
        arquivoCompleto={arquivoCompleto}
        rotuloDetalhe={tx("Histórico de estados e detalhes", "History of states and details")}
        renderLinha={(l) => <LinhaDoConjunto l={l} />}
        renderAcoes={(l) => (
          <>
            {typeof l.slug === "string" && (
              <Link href={`/setor-eletrico/dados/${l.slug}`} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                {typeof l.baixar === "number"
                  ? tx(`Ficha e ${plural(l.baixar, "arquivo", "arquivos")} para baixar`, `Record and ${plural(l.baixar, "file", "files")} to download`)
                  : tx("Ficha do conjunto", "Dataset record")}
              </Link>
            )}
            {(() => {
              const oficial = urlOficial({ id: String(l.id), orgao: String(l.orgao), url: typeof l.url === "string" ? l.url : undefined }, portais);
              return oficial ? (
                <a href={oficial} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {tx("Página oficial ↗", "Official page ↗")}
                </a>
              ) : null;
            })()}
          </>
        )}
        renderDetalhe={(l) => <Detalhe id={String(l.id)} n={Number(l.n)} rotulosDosArquivos={rotulosDosArquivos} />}
        renderNaBarra={(ctx) => <SeletorDeEstado ctx={ctx} />}
        semResultado={tx(
          <>Nenhum conjunto corresponde à busca e aos filtros. O catálogo não contém tudo o que é público: um conjunto que não aparece aqui pode existir na fonte.</>,
          <>No dataset matches the search and the filters. The catalog does not contain everything that is public: a dataset that does not appear here may exist at the source.</>,
        )}
      />

      {children && <div className="space-y-6">{children}</div>}

      <div id="tabela" data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
        <h3 id="tabela-catalogo-titulo" className="ed-h3 font-serif text-carvao">
          {tituloTabela}
        </h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{apoioTabela}</p>
        <TabelaInterativa
          titulo={tx("Conjuntos catalogados, com as etapas da escada e o uso declarado", "Cataloged datasets, with the ladder stages and the declared use")}
          colunas={colunasTabela}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="titulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="dados-catalogo"
          chaveUrl="cat"
          ordemInicial={{ coluna: "etapas", direcao: "desc" }}
          tamanhoPagina={25}
          dicaBusca={tx("Nome do conjunto", "Dataset name")}
          nota={tx(
            "Sim e não nas cinco etapas seguem a escada: um conjunto só tem uma etapa quando cumpriu todas as anteriores, e a coluna de estado traz o mais avançado de cada um. Uso declarado é outro eixo: um conjunto pode estar em uso e abaixo de publicado, e nesse caso a ressalva diz o que falta. A frequência é o texto da fonte, sem correção.",
            "Yes and no in the five stages follow the ladder: a dataset only has a stage when it completed all the previous ones, and the state column shows the most advanced one for each. Declared use is another axis: a dataset can be in use and below published, and in that case the caveat says what is missing. The frequency is the source's text, uncorrected (translated when an exact match exists).",
          )}
        />
      </div>
    </div>
  );
}

type CargaCsv = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; linhas: LinhaTabela[] };

/** Recurso a recurso da CCEE: o CSV publicado, lido ao abrir o bloco (733 linhas não vão no HTML). */
export function DadosRecursosCcee({ url, versao }: { url: string; versao: string }) {
  const tx = useTx();
  const { carimbo } = formatos(useIdioma());
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
        {tx("Lendo a tabela de recursos da CCEE…", "Reading the CCEE resource table…")}
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        {tx(
          `Não foi possível ler a tabela: ${c.motivo}. O arquivo continua disponível para baixar no link do painel.`,
          `The table could not be read: ${c.motivo}. The file is still available to download from the panel link.`,
        )}
      </p>
    );
  return (
    <TabelaInterativa
      titulo={tx("Recursos (arquivos) dos conjuntos da CCEE, um a um", "Resources (files) of the CCEE datasets, one by one")}
      colunas={COLUNAS_RECURSOS}
      linhas={c.linhas}
      chaveLinha="id"
      colunaRotulo="recurso"
      fonte={tx(
        "CCEE, portal de dados abertos (listagem package_search); estado de cada recurso calculado pelo pipeline",
        "CCEE, open data portal (package_search listing); state of each resource computed by the pipeline",
      )}
      versao={versao}
      nomeArquivo="dados-recursos-ccee"
      chaveUrl="rec"
      ordemInicial={{ coluna: "estado", direcao: "desc" }}
      tamanhoPagina={25}
      dicaBusca={tx("Conjunto ou recurso", "Dataset or resource")}
      nota={tx(
        `Um recurso herda o estado da integração que o capturou com sha256; o lido só por requisição parcial está em recurso verificado; os demais, em catalogado. Carimbo da gold: ${carimbo(versao)}.`,
        `A resource inherits the state of the integration that captured it with sha256; one read only by partial request is at resource verified; the others, at cataloged. Gold file timestamp: ${carimbo(versao)}.`,
      )}
    />
  );
}
