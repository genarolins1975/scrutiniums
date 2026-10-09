"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl, type Esquema } from "@/lib/energia/estadoUrl";
import { carimbo, num, plural } from "@/lib/energia/formato";
import {
  CHAVE_SEM_DADO,
  MIME_CSV,
  MIME_XLSX,
  TEXTO_SEM_DADO,
  criarIndiceBusca,
  descreverRecorte,
  filtrarLinhas,
  gerarCsv,
  gerarXlsx,
  nomeArquivo,
  opcoesFiltro,
  ordenarLinhas,
  paginar,
  type ColunaTabela,
  type ItemRecorte,
  type LinhaTabela,
  type OpcaoFiltro,
  type Ordem,
} from "@/lib/energia/tabela";

/**
 * Consulta em lista, para catálogos que o leitor percorre antes de comparar: busca, filtros por coluna (os principais na barra, os demais
 * em "Mais filtros"), ordenação, páginas curtas, exportação do recorte e, para cada item, um detalhe que se abre no próprio lugar.
 *
 * Mesmo motor da TabelaInterativa (busca sem acento, filtros com contagem por faceta, ordem estável com ausência no fim, CSV e XLSX das
 * linhas do recorte na ordem exibida) e mesmos parâmetros de URL (`<prefixo>.q`, `.ord`, `.f.<coluna>`): uma tabela completa da mesma
 * consulta, na mesma página, abre já no recorte escolhido aqui. A página do item aberto fica em `paramAberto`, para o link abrir o mesmo
 * detalhe. A lista é parcial por construção: o texto diz quantos itens o recorte tem e quantos a página mostra, e o arquivo completo
 * fica a um clique.
 */

export type OpcaoOrdem = { id: string; rotulo: string; ordem: NonNullable<Ordem> };

export type ContextoLista = {
  /** Valores marcados em cada coluna categórica. */
  filtros: Record<string, string[]>;
  definirFiltro: (coluna: string, valores: string[]) => void;
  /** Quantas linhas teriam cada valor da coluna com a busca e os OUTROS filtros aplicados (o filtro da própria coluna não conta). */
  contagemPorValor: (coluna: string) => Record<string, number>;
  total: number;
  recorte: number;
};

export type PropsListaConsultavel = {
  /** Nome acessível da lista e título da planilha exportada. */
  rotulo: string;
  substantivo: readonly [string, string];
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  chaveLinha: string;
  /** Coluna que nomeia a linha: entra sempre na busca. */
  colunaRotulo: string;
  /** Prefixo dos parâmetros de URL da consulta (busca, ordem, filtros): o mesmo da tabela completa, para as duas seguirem o mesmo recorte. */
  prefixo: string;
  /** Parâmetro da URL com o item aberto. */
  paramAberto: string;
  ordemInicial: NonNullable<Ordem>;
  opcoesOrdem: OpcaoOrdem[];
  /** Colunas categóricas com botão próprio na barra; as demais ficam em "Mais filtros". */
  filtrosDaBarra: string[];
  /** Colunas categóricas que o leitor não vê como filtro (o detalhe ou outro controle já cobre), mas que valem se vierem na URL. */
  filtrosOcultos?: string[];
  tamanhoPagina?: number;
  rotuloBusca: string;
  dicaBusca: string;
  fonte: string;
  versao: string;
  nomeDoArquivo: string;
  /** Link para o arquivo completo (o universo inteiro, sem filtro). */
  arquivoCompleto?: { rotulo: string; url: string };
  rotuloDetalhe: string;
  /** Conteúdo principal de cada item. */
  renderLinha: (l: LinhaTabela) => ReactNode;
  /** Links e botões de cada item, na linha de ações (o botão do detalhe vem junto). */
  renderAcoes?: (l: LinhaTabela) => ReactNode;
  renderDetalhe?: (l: LinhaTabela) => ReactNode;
  /** Controle extra na barra de filtros (o estado, por exemplo), com acesso ao recorte. */
  renderNaBarra?: (ctx: ContextoLista) => ReactNode;
  /** Texto do estado vazio. */
  semResultado?: ReactNode;
};

const FILTRO = "f:";

function montaEsquema(colunas: readonly ColunaTabela[], prefixo: string, ordemInicial: NonNullable<Ordem>, paramAberto: string, ordenaveis: string[]): Esquema {
  const e: Esquema = {
    busca: campo(tiposUrl.texto({ max: 120 }), "", { param: `${prefixo}.q`, historico: "replace" }),
    ordem: campo(tiposUrl.ordem(ordenaveis), ordemInicial as Ordem, { param: `${prefixo}.ord` }),
    pagina: campo(tiposUrl.inteiro({ min: 1 }), 1, { param: `${prefixo}.pg`, historico: "replace" }),
    aberto: campo(tiposUrl.texto({ max: 300 }), "", { param: paramAberto }),
  };
  for (const c of colunas) {
    if (c.categorica) e[FILTRO + c.id] = campo(tiposUrl.lista(tiposUrl.texto({ max: 120 })), [] as string[], { param: `${prefixo}.f.${c.id}` });
  }
  return e;
}

function baixar(nome: string, conteudo: string | Uint8Array<ArrayBuffer>, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const botao = "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia aria-disabled:cursor-not-allowed aria-disabled:text-carvao-muted";
const campoCls = "min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia";

export function ListaConsultavel(p: PropsListaConsultavel) {
  const { colunas, linhas, chaveLinha, colunaRotulo, prefixo, paramAberto, ordemInicial, opcoesOrdem, filtrosDaBarra, filtrosOcultos = [], tamanhoPagina = 10 } = p;
  const uid = useId();
  const topoRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [filtroAberto, setFiltroAberto] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const ordenaveis = useMemo(() => colunas.filter((c) => c.ordenavel !== false).map((c) => c.id), [colunas]);
  const assinatura = colunas.map((c) => `${c.id}:${c.categorica ? 1 : 0}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a assinatura resume o que o esquema lê das colunas
  const esquema = useMemo(() => montaEsquema(colunas, prefixo, ordemInicial, paramAberto, ordenaveis), [assinatura, prefixo, paramAberto, ordemInicial.coluna, ordemInicial.direcao]);
  const [estado, definir] = useEstadoUrl(esquema);

  const busca = typeof estado.busca === "string" ? estado.busca : "";
  const ordem = (estado.ordem ?? null) as Ordem;
  const aberto = typeof estado.aberto === "string" ? estado.aberto : "";
  const categoricas = useMemo(() => colunas.filter((c) => c.categorica), [colunas]);
  const filtros = useMemo(() => {
    const f: Record<string, string[]> = {};
    for (const c of categoricas) {
      const v = estado[FILTRO + c.id];
      if (Array.isArray(v) && v.length) f[c.id] = v as string[];
    }
    return f;
  }, [categoricas, estado]);

  const buscaAdiada = useDeferredValue(busca);
  const indice = useMemo(() => criarIndiceBusca(colunas, colunaRotulo), [colunas, colunaRotulo]);
  const ordenadas = useMemo(() => ordenarLinhas(linhas, colunas, ordem), [linhas, colunas, ordem]);
  const filtradas = useMemo(() => filtrarLinhas(ordenadas, colunas, { busca: buscaAdiada, filtros }, indice), [ordenadas, colunas, buscaAdiada, filtros, indice]);
  const opcoes = useMemo(() => {
    const out: Record<string, OpcaoFiltro[]> = {};
    for (const c of categoricas) out[c.id] = opcoesFiltro(linhas, c, filtrarLinhas(linhas, colunas, { busca: buscaAdiada, filtros }, indice, c.id));
    return out;
  }, [categoricas, linhas, colunas, buscaAdiada, filtros, indice]);

  const idDe = (l: LinhaTabela) => String(l[chaveLinha] ?? "");
  const paginaPedida = typeof estado.pagina === "number" ? estado.pagina : 1;
  const pag = paginar(filtradas.length, paginaPedida, tamanhoPagina);
  const visiveis = filtradas.slice(pag.inicio, pag.fim);
  const itemAberto = aberto ? linhas.find((l) => idDe(l) === aberto) : undefined;
  const abertoNoRecorte = !!itemAberto && filtradas.some((l) => idDe(l) === aberto);

  const recorte = descreverRecorte(colunas, { busca: buscaAdiada, filtros, ordem });
  const itensFiltro = recorte.filter((r) => r.tipo !== "ordem");
  const colunasDaBarra = filtrosDaBarra.map((id) => categoricas.find((c) => c.id === id)).filter((c): c is ColunaTabela => !!c);
  const colunasExtras = categoricas.filter((c) => !filtrosDaBarra.includes(c.id) && !filtrosOcultos.includes(c.id));

  const atual = useRef({ filtradas, tamanho: tamanhoPagina, pagina: pag.pagina });
  atual.current = { filtradas, tamanho: tamanhoPagina, pagina: pag.pagina };

  // o item aberto por um link leva a lista à página dele (uma vez) e à vista; paginar depois não devolve a ele
  const rolou = useRef(false);
  useEffect(() => {
    if (!aberto || rolou.current) return;
    const { filtradas: fs, tamanho: t, pagina: pgAtual } = atual.current;
    const i = fs.findIndex((l) => String(l[chaveLinha] ?? "") === aberto);
    if (i < 0) return;
    const alvo = Math.floor(i / t) + 1;
    if (alvo !== pgAtual) {
      definir({ pagina: alvo }, { historico: "replace" });
      return;
    }
    rolou.current = true;
    window.requestAnimationFrame(() => document.getElementById(`${uid}-item-${i - (alvo - 1) * t}`)?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }));
  }, [aberto, pag.pagina, chaveLinha, definir, uid]);

  // painel de filtro fecha ao tocar fora dele
  useEffect(() => {
    if (!filtroAberto) return;
    const fora = (e: PointerEvent) => {
      if (!barraRef.current?.contains(e.target as Node)) setFiltroAberto(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [filtroAberto]);

  const mudarFiltro = (id: string, valores: string[]) => definir({ [FILTRO + id]: valores, pagina: 1 });

  const limparTudo = () => {
    const m: Record<string, unknown> = { busca: "", pagina: 1 };
    for (const c of categoricas) m[FILTRO + c.id] = [];
    definir(m, { historico: "push" });
    setFiltroAberto(null);
    setAnuncio("Busca e filtros removidos: todos os itens.");
  };

  const remover = (it: ItemRecorte) => {
    if (it.tipo === "busca") definir({ busca: "", pagina: 1 }, { historico: "push" });
    else if (it.coluna) definir({ [FILTRO + it.coluna]: [], pagina: 1 });
    setAnuncio(`Filtro removido: ${it.rotulo}.`);
    buscaRef.current?.focus();
  };

  const irPara = (n: number) => {
    const alvo = paginar(filtradas.length, n, tamanhoPagina);
    if (alvo.pagina === pag.pagina) return;
    definir({ pagina: alvo.pagina });
    setAnuncio(`Página ${alvo.pagina} de ${alvo.paginas}: itens ${num(alvo.inicio + 1, 0)} a ${num(alvo.fim, 0)} de ${num(filtradas.length, 0)}.`);
    window.requestAnimationFrame(() => topoRef.current?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }));
  };

  const exportar = (formato: "csv" | "xlsx") => {
    if (!filtradas.length) {
      setAnuncio("Nada para exportar: o recorte atual não tem resultado. Limpe a busca ou os filtros.");
      return;
    }
    const nome = nomeArquivo(p.nomeDoArquivo, recorte, formato, p.versao);
    if (formato === "csv") baixar(nome, gerarCsv(colunas, filtradas), MIME_CSV);
    else baixar(nome, gerarXlsx(colunas, filtradas, { titulo: p.rotulo, fonte: p.fonte, versao: p.versao, recorte: recorte.map((r) => `${r.rotulo}: ${r.valor}`).join("; "), geradoEm: carimbo(new Date().toISOString()) }), MIME_XLSX);
    setAnuncio(`Arquivo ${nome} gerado com ${plural(filtradas.length, "linha", "linhas")}.`);
  };

  const ctx: ContextoLista = {
    filtros,
    definirFiltro: mudarFiltro,
    contagemPorValor: (id) => Object.fromEntries((opcoes[id] ?? []).map((o) => [o.valor, o.n])),
    total: linhas.length,
    recorte: filtradas.length,
  };

  const opcaoDaOrdem = opcoesOrdem.find((o) => ordem && o.ordem.coluna === ordem.coluna && o.ordem.direcao === ordem.direcao);
  const idOrdemAtual = opcaoDaOrdem?.id ?? (ordem ? "__outra" : "__nenhuma");
  const rotuloOrdemAtual = opcaoDaOrdem?.rotulo ?? (ordem ? `${colunas.find((c) => c.id === ordem.coluna)?.rotulo ?? ordem.coluna}, ${ordem.direcao === "asc" ? "crescente" : "decrescente"}` : "ordem original");
  const comRecorte = itensFiltro.length > 0;
  const [s, ps] = p.substantivo;
  const resumo =
    filtradas.length === 0
      ? `Nenhum ${s} corresponde à busca e aos filtros.`
      : comRecorte
        ? `${num(filtradas.length, 0)} de ${num(linhas.length, 0)} ${ps} correspondem à busca e aos filtros.`
        : `${num(linhas.length, 0)} ${ps}.`;
  const faixa = filtradas.length > 0 ? ` Mostrando ${num(pag.inicio + 1, 0)} a ${num(pag.fim, 0)}.` : "";

  /** Um item da lista. Função de render e não componente: o detalhe aberto guarda estado (leitura sob demanda) e não pode remontar a cada digitação. */
  const item = (l: LinhaTabela, i: number, foraDoRecorte = false) => {
    const id = idDe(l);
    const open = aberto === id;
    const sufixo = foraDoRecorte ? "fora" : String(i);
    return (
      <li key={id || `linha-${pag.inicio + i}`} id={`${uid}-item-${sufixo}`} data-id={id} data-aberto={open ? "true" : undefined} className="scroll-mt-28 py-4">
        {p.renderLinha(l)}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-0">
          {p.renderAcoes?.(l)}
          {p.renderDetalhe && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${uid}-detalhe-${sufixo}`}
              onClick={() => definir({ aberto: open ? "" : id })}
              className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
            >
              {open ? "Ocultar o detalhe" : p.rotuloDetalhe}
              <span aria-hidden="true" className="ml-1.5 text-[0.7em]">
                {open ? "▴" : "▾"}
              </span>
            </button>
          )}
        </div>
        {open && p.renderDetalhe && (
          <div id={`${uid}-detalhe-${sufixo}`} className="mt-3 border-l-2 border-energia-soft pl-4 md:pl-5">
            {p.renderDetalhe(l)}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="min-w-0 max-w-full scroll-mt-28" data-componente="lista-consultavel" data-prefixo={prefixo}>
      <div ref={topoRef} className="scroll-mt-28">
        <label htmlFor={`${uid}-busca`} className="rotulo block text-mineral">
          {p.rotuloBusca}
        </label>
        <input
          ref={buscaRef}
          id={`${uid}-busca`}
          type="search"
          value={busca}
          onChange={(e) => definir({ busca: e.target.value, pagina: 1 })}
          placeholder={p.dicaBusca}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${uid}-resumo`}
          className="mt-1 block min-h-[44px] w-full max-w-2xl border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral hover:border-energia"
        />
      </div>

      <div ref={barraRef} className="relative mt-3 flex flex-wrap items-end gap-x-2 gap-y-2">
        {colunasDaBarra.map((c) => (
          <FiltroPopover
            key={c.id}
            id={`${uid}-f-${c.id}`}
            rotulo={c.rotulo}
            colunas={[c]}
            opcoes={opcoes}
            filtros={filtros}
            aberto={filtroAberto === c.id}
            onAlternar={(abrir) => setFiltroAberto(abrir ? c.id : null)}
            onMudar={mudarFiltro}
          />
        ))}
        {p.renderNaBarra?.(ctx)}
        {colunasExtras.length > 0 && (
          <FiltroPopover
            id={`${uid}-f-mais`}
            rotulo="Mais filtros"
            colunas={colunasExtras}
            opcoes={opcoes}
            filtros={filtros}
            aberto={filtroAberto === "__mais"}
            onAlternar={(abrir) => setFiltroAberto(abrir ? "__mais" : null)}
            onMudar={mudarFiltro}
          />
        )}
        {opcoesOrdem.length > 0 && (
          <label className="flex min-w-0 flex-col gap-1 text-xs text-mineral">
            <span className="rotulo">Ordenar por</span>
            <select
              value={idOrdemAtual}
              onChange={(e) => {
                const o = opcoesOrdem.find((x) => x.id === e.target.value);
                if (o) definir({ ordem: o.ordem, pagina: 1 });
              }}
              className={campoCls}
            >
              {idOrdemAtual === "__outra" && <option value="__outra">{rotuloOrdemAtual} (escolhida na tabela)</option>}
              {idOrdemAtual === "__nenhuma" && <option value="__nenhuma">Ordem original</option>}
              {opcoesOrdem.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {itensFiltro.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span id={`${uid}-ativos`} className="rotulo text-mineral">
            Filtros ativos
          </span>
          <ul aria-labelledby={`${uid}-ativos`} className="flex flex-wrap gap-2">
            {itensFiltro.map((it) => (
              <li key={`${it.tipo}-${it.coluna ?? ""}`}>
                <button
                  type="button"
                  onClick={() => remover(it)}
                  aria-label={`Remover filtro ${it.rotulo}: ${it.valor}`}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-energia bg-energia-fundo px-3 text-left text-sm text-carvao hover:border-energia-dark"
                >
                  <span>
                    <span className="text-carvao-muted">{it.rotulo}:</span> {it.valor}
                  </span>
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
          {itensFiltro.length > 1 && (
            <button type="button" onClick={limparTudo} className="rotulo inline-flex min-h-[44px] items-center px-2 text-energia-dark underline underline-offset-4 hover:text-carvao">
              Limpar tudo
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p id={`${uid}-resumo`} role="status" className="text-sm text-carvao-muted">
          <span className="font-medium text-carvao">{resumo}</span>
          {faixa}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0">
          <span className="text-xs text-carvao-muted">Baixar o recorte atual:</span>
          {(["csv", "xlsx"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => exportar(f)}
              aria-disabled={filtradas.length === 0 || undefined}
              aria-label={`Baixar o recorte atual em ${f.toUpperCase()}`}
              className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
            >
              {f.toUpperCase()}
            </button>
          ))}
          {p.arquivoCompleto && (
            <a href={p.arquivoCompleto.url} download className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
              {p.arquivoCompleto.rotulo}
            </a>
          )}
        </div>
      </div>

      {itemAberto && !abertoNoRecorte && (
        <div className="mt-3 border border-aviso bg-superficie p-3" data-fora-do-recorte="true">
          <p className="text-sm leading-relaxed text-carvao">
            O item que o link abriu está fora da busca e dos filtros atuais.{" "}
            <button type="button" onClick={limparTudo} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              Mostrar todos os itens
            </button>
          </p>
          <ol aria-label="Item aberto pelo link">{item(itemAberto, 0, true)}</ol>
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="mt-4 border border-dashed border-mineral bg-papel p-5 text-sm leading-relaxed text-carvao-muted" data-estado="vazio">
          {p.semResultado ?? <>Nenhum item corresponde à busca e aos filtros.</>}{" "}
          <button type="button" onClick={limparTudo} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Limpar busca e filtros
          </button>
        </div>
      ) : (
        <ol aria-label={`${p.rotulo}, página ${pag.pagina} de ${pag.paginas}`} className="mt-2 divide-y divide-linha border-y border-linha" data-lista="itens">
          {visiveis.map((l, i) => item(l, i))}
        </ol>
      )}

      {pag.paginas > 1 && (
        <nav aria-label={`Paginação: ${p.rotulo}`} className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={botao} aria-disabled={pag.pagina === 1 || undefined} onClick={() => irPara(1)}>
            <span aria-hidden="true" className="mr-1">
              «
            </span>
            Primeira
          </button>
          <button type="button" className={botao} aria-disabled={pag.pagina === 1 || undefined} onClick={() => irPara(pag.pagina - 1)}>
            <span aria-hidden="true" className="mr-1">
              ‹
            </span>
            Anterior
          </button>
          <p className="px-1 text-sm tabular-nums text-carvao-muted">
            Página {pag.pagina} de {pag.paginas}
          </p>
          <button type="button" className={botao} aria-disabled={pag.pagina === pag.paginas || undefined} onClick={() => irPara(pag.pagina + 1)}>
            Próxima
            <span aria-hidden="true" className="ml-1">
              ›
            </span>
          </button>
          <button type="button" className={botao} aria-disabled={pag.pagina === pag.paginas || undefined} onClick={() => irPara(pag.paginas)}>
            Última
            <span aria-hidden="true" className="ml-1">
              »
            </span>
          </button>
        </nav>
      )}

      <p className="mt-3 border-t border-linha pt-2 text-xs leading-relaxed text-mineral">
        Fonte: {p.fonte}. “{TEXTO_SEM_DADO}” indica ausência na fonte, nunca zero; nos arquivos baixados a ausência é célula vazia. Ordem atual: {rotuloOrdemAtual}.
      </p>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </div>
  );
}

function FiltroPopover({
  id,
  rotulo,
  colunas,
  opcoes,
  filtros,
  aberto,
  onAlternar,
  onMudar,
}: {
  id: string;
  rotulo: string;
  colunas: ColunaTabela[];
  opcoes: Record<string, OpcaoFiltro[]>;
  filtros: Record<string, string[]>;
  aberto: boolean;
  onAlternar: (abrir: boolean) => void;
  onMudar: (coluna: string, valores: string[]) => void;
}) {
  const resumo = useRef<HTMLElement>(null);
  const marcadosNoGrupo = colunas.reduce((s, c) => s + (filtros[c.id]?.length ?? 0), 0);
  const ativo = marcadosNoGrupo > 0;
  const alternar = (c: ColunaTabela, valor: string) => {
    const atuais = new Set(filtros[c.id] ?? []);
    if (atuais.has(valor)) atuais.delete(valor);
    else atuais.add(valor);
    // valores na ordem das opções: a URL tem uma forma só para o mesmo filtro, qualquer que seja a ordem dos cliques
    onMudar(c.id, (opcoes[c.id] ?? []).filter((o) => atuais.has(o.valor)).map((o) => o.valor));
  };
  return (
    <details
      open={aberto}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        if (o !== aberto) onAlternar(o);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          e.preventDefault();
          onAlternar(false);
          resumo.current?.focus();
        }
      }}
    >
      <summary
        ref={resumo}
        className={`rotulo inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 border px-3 text-carvao [&::-webkit-details-marker]:hidden ${
          ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
        }`}
      >
        <span>{rotulo}</span>
        {ativo && <span className="tabular-nums">({marcadosNoGrupo})</span>}
        <span aria-hidden="true" className="text-[0.7em]">
          {aberto ? "▴" : "▾"}
        </span>
      </summary>
      <div id={id} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto border border-linha bg-superficie p-3 shadow-[0_6px_20px_rgba(26,29,33,0.12)]">
        <div className="space-y-4">
          {colunas.map((c) => (
            <fieldset key={c.id}>
              <legend className="rotulo text-mineral">Filtrar por {c.rotulo}</legend>
              <div className="mt-2 grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {(opcoes[c.id] ?? []).map((o) => (
                  <label key={o.valor} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-energia" checked={(filtros[c.id] ?? []).includes(o.valor)} onChange={() => alternar(c, o.valor)} />
                    <span className={`min-w-0 flex-1 ${o.valor === CHAVE_SEM_DADO ? "italic text-carvao-muted" : ""}`}>{o.rotulo}</span>
                    <span className="text-xs tabular-nums text-mineral">
                      {num(o.n, 0)}
                      <span className="sr-only"> {o.n === 1 ? "item" : "itens"}</span>
                    </span>
                  </label>
                ))}
              </div>
              {(filtros[c.id]?.length ?? 0) > 0 && (
                <button type="button" onClick={() => onMudar(c.id, [])} className="rotulo mt-1 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  Limpar {c.rotulo}
                </button>
              )}
            </fieldset>
          ))}
        </div>
      </div>
    </details>
  );
}
