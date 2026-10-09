"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { campo, tiposUrl, type Esquema } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import {
  CHAVE_SEM_DADO,
  MIME_CSV,
  MIME_XLSX,
  TEXTO_SEM_DADO,
  criarIndiceBusca,
  descreverRecorte,
  ehNumerica,
  filtrarLinhas,
  gerarCsv,
  gerarXlsx,
  nomeArquivo,
  opcoesFiltro,
  ordenarLinhas,
  paginar,
  rotuloCabecalho,
  textoCelula,
  valorColuna,
  type ColunaTabela,
  type ItemRecorte,
  type LinhaTabela,
  type OpcaoFiltro,
  type Ordem,
} from "@/lib/energia/tabela";

/**
 * Tabela interativa (explorador de dados) do Setor Elétrico: a tabela que
 * responde "quais distribuidoras, municípios ou usinas" com os mesmos números
 * do gráfico ao lado.
 *
 * - Colunas tipadas (texto, número com casas e unidade, percentual, data);
 *   cabeçalho com botão de ordenação e aria-sort; ausência sempre no fim.
 * - Busca sem acento e sem caixa; filtros por coluna categórica com contagem
 *   por faceta; resumo visível dos filtros com ação de remover cada um.
 * - "n de N linhas" em região de status; paginação (25 a 200 por página) em
 *   vez de 6.000 linhas no DOM.
 * - Linha selecionável e sincronizável (selecionado, onSelecionar): a seleção
 *   que vem de fora (mapa, gráfico) leva a tabela à página da linha.
 * - Exportação CSV e XLSX das linhas do recorte, na ordem exibida, com o
 *   recorte no nome do arquivo; a planilha leva fonte, versão e dicionário.
 * - Com chaveUrl, busca, filtros, ordem e página ficam na URL (link
 *   reproduzível; voltar/avançar funcionam) sem tocar em ?modo= nem no #hash.
 * - A rolagem horizontal fica dentro do componente; a primeira coluna (o nome
 *   da linha) fica fixa ao rolar.
 * - Ausência é "sem dado" em itálico, nunca zero; no arquivo, célula vazia.
 */

export type TabelaInterativaProps = {
  titulo: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  /** Campo com o identificador estável de cada linha (seleção sincronizada e chave de renderização). */
  chaveLinha: string;
  /** Coluna que nomeia a linha (cabeçalho de linha, fixa ao rolar); padrão: a primeira. */
  colunaRotulo?: string;
  /** Fonte (órgão e conjunto), exibida no rodapé e gravada na planilha. */
  fonte: string;
  /** Versão dos dados (data de referência ou snapshot), exibida no rodapé e no nome do arquivo. */
  versao: string;
  /** Base do nome dos arquivos exportados, ex.: "perdas-distribuidoras". */
  nomeArquivo: string;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /** Prefixo dos parâmetros na URL (busca, filtros, ordem, página). Sem ele, o estado é só local. */
  chaveUrl?: string;
  /** Busca da página no servidor (buscaDeParametros(searchParams)), para o HTML já sair com o recorte do link. */
  buscaInicial?: string;
  ordemInicial?: Ordem;
  tamanhoPagina?: 25 | 50 | 100 | 200;
  /** Exemplo do que se pode buscar ("Nome, código ou UF"). */
  dicaBusca?: string;
  /** Texto do estado vazio quando não há nenhuma linha publicada. */
  semLinhas?: ReactNode;
  /** Nota extra no rodapé (limitação que muda a leitura). */
  nota?: ReactNode;
  /**
   * Em Entender, a tabela longa ou larga fica atrás do botão "Ver a tabela completa": o essencial da página é a
   * resposta, e a tabela serve a quem quer conferir. Padrão: tabelas com mais de 12 linhas ou mais de 6 colunas (no
   * celular, mais que isso não cabe sem esconder os números). Em Analisar e Auditar, e fora de uma página com níveis
   * de profundidade, a tabela aparece sempre aberta.
   */
  recolher?: boolean;
  /**
   * Tabela montada depois de um pedido do leitor ("Abrir: tabela..."): nasce aberta em Entender, porque ele acabou de pedir para vê-la.
   * Sem isto, o leitor abria a tabela e ainda encontrava o botão "Ver a tabela completa".
   */
  iniciarAberta?: boolean;
};

const TAMANHOS = [25, 50, 100, 200] as const;
const LINHAS_PARA_RECOLHER = 12;
const COLUNAS_PARA_RECOLHER = 6;
const FILTRO = "f:";

/** Esquema da URL: busca e página substituem a entrada do histórico; ordem e filtros criam entrada nova. */
function esquemaTabela(colunas: readonly ColunaTabela[], prefixo: string | undefined, ordemInicial: Ordem): Esquema {
  const p = prefixo ? `${prefixo}.` : "";
  const ordenaveis = colunas.filter((c) => c.ordenavel !== false).map((c) => c.id);
  const e: Esquema = {
    busca: campo(tiposUrl.texto({ max: 120 }), "", { param: `${p}q`, historico: "replace" }),
    ordem: campo(tiposUrl.ordem(ordenaveis), ordemInicial, { param: `${p}ord` }),
    pagina: campo(tiposUrl.inteiro({ min: 1 }), 1, { param: `${p}pag`, historico: "replace" }),
  };
  for (const c of colunas) {
    if (c.categorica) e[FILTRO + c.id] = campo(tiposUrl.lista(tiposUrl.texto({ max: 120 })), [] as string[], { param: `${p}f.${c.id}` });
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

function SemDado({ sobreFundoAtivo }: { sobreFundoAtivo: boolean }) {
  // mineral fica abaixo de AA sobre energia-fundo (linha selecionada): lá o texto passa a carvão-muted
  return (
    <span data-estado="sem-dado" className={`italic ${sobreFundoAtivo ? "text-carvao-muted" : "text-mineral"}`}>
      {TEXTO_SEM_DADO}
    </span>
  );
}

/** Versão dos dados para leitura: data ISO vira dd/mm/aaaa (ou mm/aaaa); instante vira data e hora de Brasília; o resto fica como veio. */
function versaoLegivel(v: string): string {
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(v)) return dataBR(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return carimbo(v);
  return v;
}

export function TabelaInterativa({
  titulo,
  colunas,
  linhas,
  chaveLinha,
  colunaRotulo,
  fonte,
  versao,
  nomeArquivo: baseArquivo,
  selecionado = null,
  onSelecionar,
  chaveUrl,
  buscaInicial,
  ordemInicial = null,
  tamanhoPagina = 25,
  dicaBusca,
  semLinhas,
  nota,
  recolher,
  iniciarAberta = false,
}: TabelaInterativaProps) {
  const uid = useId();
  const buscaRef = useRef<HTMLInputElement>(null);
  // a tabela só avisa da rolagem quando de fato é mais larga que a área visível
  const rolagemRef = useRef<HTMLDivElement>(null);
  const [maisColunas, setMaisColunas] = useState(false);
  const filtrosRef = useRef<HTMLDivElement>(null);

  // o esquema só depende de ids, categorias e ordenabilidade: colunas recriadas a cada render não o recriam
  const assinatura = colunas.map((c) => `${c.id}:${c.categorica ? 1 : 0}:${c.ordenavel === false ? 0 : 1}`).join("|");
  const chaveOrdemInicial = ordemInicial ? `${ordemInicial.direcao}:${ordemInicial.coluna}` : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a assinatura resume o que o esquema lê das colunas
  const esquema = useMemo(() => esquemaTabela(colunas, chaveUrl, ordemInicial), [assinatura, chaveUrl, chaveOrdemInicial]);
  // sem chaveUrl o estado é local: a busca da página não se aplica a ele
  const [estado, definir] = useEstadoUrl(esquema, { sincronizar: !!chaveUrl, buscaInicial: chaveUrl ? buscaInicial : undefined });

  const busca = typeof estado.busca === "string" ? estado.busca : "";
  const ordem = (estado.ordem ?? null) as Ordem;
  const paginaPedida = typeof estado.pagina === "number" ? estado.pagina : 1;
  const categoricas = useMemo(() => colunas.filter((c) => c.categorica), [colunas]);
  const filtros = useMemo(() => {
    const f: Record<string, string[]> = {};
    for (const c of categoricas) {
      const v = estado[FILTRO + c.id];
      if (Array.isArray(v) && v.length) f[c.id] = v as string[];
    }
    return f;
  }, [categoricas, estado]);

  // digitação responde já; a filtragem das ~6.000 linhas acompanha logo depois
  const buscaAdiada = useDeferredValue(busca);
  const idRotulo = (colunas.find((c) => c.id === colunaRotulo) ?? colunas[0])?.id;
  const indice = useMemo(() => criarIndiceBusca(colunas, idRotulo), [colunas, idRotulo]);
  const ordenadas = useMemo(() => ordenarLinhas(linhas, colunas, ordem), [linhas, colunas, ordem]);
  const filtradas = useMemo(
    () => filtrarLinhas(ordenadas, colunas, { busca: buscaAdiada, filtros }, indice),
    [ordenadas, colunas, buscaAdiada, filtros, indice],
  );
  const opcoes = useMemo(() => {
    const out: Record<string, OpcaoFiltro[]> = {};
    for (const c of categoricas) {
      // faceta: conta as linhas que sobram com a busca e os OUTROS filtros
      out[c.id] = opcoesFiltro(linhas, c, filtrarLinhas(linhas, colunas, { busca: buscaAdiada, filtros }, indice, c.id));
    }
    return out;
  }, [categoricas, linhas, colunas, buscaAdiada, filtros, indice]);

  const [tamanho, setTamanho] = useState<number>(tamanhoPagina);
  const pag = paginar(filtradas.length, paginaPedida, tamanho);
  const visiveis = filtradas.slice(pag.inicio, pag.fim);
  const colRot = colunas.find((c) => c.id === colunaRotulo) ?? colunas[0];
  const selecionavel = typeof onSelecionar === "function";
  const idDe = (l: LinhaTabela) => String(l[chaveLinha] ?? "");

  const recorte = descreverRecorte(colunas, { busca: buscaAdiada, filtros, ordem });
  const itensFiltro = recorte.filter((r) => r.tipo !== "ordem");
  const [anuncio, setAnuncio] = useState("");
  const [filtroAberto, setFiltroAberto] = useState<string | null>(null);
  const recolhivel = recolher ?? (linhas.length > LINHAS_PARA_RECOLHER || colunas.length > COLUNAS_PARA_RECOLHER);
  const [aberta, setAberta] = useState(iniciarAberta);
  // a linha já escolhida quando a página abre (o padrão da página, como a maior bacia) não é pedido do leitor: só uma escolha feita depois,
  // no mapa ou no gráfico, abre a tabela. Sem isso, toda página com seleção padrão abria a tabela larga em Entender, que no celular
  // mostrava duas colunas de doze.
  const selecaoInicial = useRef(selecionado);
  const selecaoNova = selecionado !== null && selecionado !== undefined && selecionado !== selecaoInicial.current;
  const comRecorte = !!busca || itensFiltro.length > 0 || paginaPedida > 1 || selecaoNova;
  // quem chega por um link com busca, filtro ou página, ou escolhe uma linha depois, precisa ver a tabela
  useEffect(() => {
    if (comRecorte) setAberta(true);
  }, [comRecorte]);

  // seleção vinda de fora (mapa, gráfico): leva à página da linha; paginar depois não devolve a ela
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const medir = () => setMaisColunas(el.scrollWidth > el.clientWidth + 2);
    // há mais colunas à direita: a borda direita esmaece (CSS), para que um número cortado no limite da janela não seja lido como completo
    const marcar = () => {
      el.dataset.maisDireita = el.scrollWidth > el.clientWidth + 2 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? "sim" : "nao";
    };
    medir();
    marcar();
    el.addEventListener("scroll", marcar, { passive: true });
    if (typeof ResizeObserver === "undefined") return () => el.removeEventListener("scroll", marcar);
    const ro = new ResizeObserver(() => {
      medir();
      marcar();
    });
    ro.observe(el);
    const tabela = el.querySelector("table");
    if (tabela) ro.observe(tabela);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", marcar);
    };
  }, [filtradas.length, colunas.length]);

  const atual = useRef({ filtradas, tamanho, pagina: pag.pagina });
  atual.current = { filtradas, tamanho, pagina: pag.pagina };
  useEffect(() => {
    if (selecionado === null || selecionado === undefined) return;
    const { filtradas: fs, tamanho: t, pagina: p } = atual.current;
    const i = fs.findIndex((l) => String(l[chaveLinha] ?? "") === selecionado);
    if (i < 0) return;
    const alvo = Math.floor(i / t) + 1;
    if (alvo !== p) definir({ pagina: alvo }, { historico: "replace" });
  }, [selecionado, chaveLinha, definir]);

  // painel de filtro fecha ao tocar fora dele
  useEffect(() => {
    if (!filtroAberto) return;
    const fora = (e: PointerEvent) => {
      if (!filtrosRef.current?.contains(e.target as Node)) setFiltroAberto(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [filtroAberto]);

  function alternarOrdem(c: ColunaTabela) {
    const prox: Ordem =
      !ordem || ordem.coluna !== c.id ? { coluna: c.id, direcao: "asc" } : ordem.direcao === "asc" ? { coluna: c.id, direcao: "desc" } : null;
    definir({ ordem: prox, pagina: 1 });
    setAnuncio(
      prox
        ? `Ordenada por ${c.rotulo}, ${prox.direcao === "asc" ? "crescente" : "decrescente"}. Linhas sem dado ficam no fim.`
        : "Ordenação removida: linhas na ordem original.",
    );
  }

  function mudarFiltro(c: ColunaTabela, valores: string[]) {
    definir({ [FILTRO + c.id]: valores, pagina: 1 });
  }

  function remover(item: ItemRecorte) {
    if (item.tipo === "busca") definir({ busca: "", pagina: 1 }, { historico: "push" });
    else if (item.coluna) definir({ [FILTRO + item.coluna]: [], pagina: 1 });
    setAnuncio(`Filtro removido: ${item.rotulo}.`);
    buscaRef.current?.focus();
  }

  function limparTudo() {
    const m: Record<string, unknown> = { busca: "", pagina: 1 };
    for (const c of categoricas) m[FILTRO + c.id] = [];
    definir(m, { historico: "push" });
    setFiltroAberto(null);
    setAnuncio("Filtros removidos: todas as linhas.");
  }

  function irPara(p: number) {
    const alvo = paginar(filtradas.length, p, tamanho);
    if (alvo.pagina === pag.pagina) return;
    definir({ pagina: alvo.pagina });
    setAnuncio(`Página ${alvo.pagina} de ${alvo.paginas}: linhas ${num(alvo.inicio + 1, 0)} a ${num(alvo.fim, 0)} de ${num(filtradas.length, 0)}.`);
  }

  function exportar(formato: "csv" | "xlsx") {
    if (!filtradas.length) {
      setAnuncio("Nenhuma linha para exportar: o recorte atual não tem resultado. Limpe a busca ou os filtros.");
      return;
    }
    const nome = nomeArquivo(baseArquivo, recorte, formato, versao);
    if (formato === "csv") baixar(nome, gerarCsv(colunas, filtradas), MIME_CSV);
    else {
      const meta = { titulo, fonte, versao, recorte: recorte.map((r) => `${r.rotulo}: ${r.valor}`).join("; "), geradoEm: carimbo(new Date().toISOString()) };
      baixar(nome, gerarXlsx(colunas, filtradas, meta), MIME_XLSX);
    }
    setAnuncio(`Arquivo ${nome} gerado com ${plural(filtradas.length, "linha", "linhas")}.`);
  }

  const selecionadaFora =
    selecionado !== null && selecionado !== undefined && !filtradas.some((l) => idDe(l) === selecionado)
      ? linhas.find((l) => idDe(l) === selecionado)
      : undefined;
  const semResultado = filtradas.length === 0;
  const botaoPagina = "rotulo inline-flex min-h-[44px] items-center gap-1 border border-linha bg-superficie px-3 text-carvao hover:border-energia aria-disabled:cursor-not-allowed aria-disabled:border-linha aria-disabled:text-carvao-muted";

  return (
    <div className="min-w-0 max-w-full" data-componente="tabela-interativa">
      {recolhivel && (
        <div className="tabela-recolher">
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={`${uid}-conteudo`}
            onClick={() => setAberta((a) => !a)}
            className="tabela-recolher-btn"
          >
            {aberta ? "Ocultar a tabela" : `Ver a tabela completa (${plural(linhas.length, "linha", "linhas")})`}
          </button>
        </div>
      )}
      <div id={`${uid}-conteudo`} data-recolhivel={recolhivel ? (aberta ? "aberta" : "fechada") : undefined}>
      <div>
        <label htmlFor={`${uid}-busca`} className="rotulo block text-mineral">
          Buscar na tabela
        </label>
        <input
          ref={buscaRef}
          id={`${uid}-busca`}
          type="search"
          value={busca}
          onChange={(e) => definir({ busca: e.target.value, pagina: 1 })}
          placeholder={dicaBusca}
          autoComplete="off"
          spellCheck={false}
          aria-controls={`${uid}-tabela`}
          aria-describedby={`${uid}-contagem`}
          className="mt-1 block min-h-[44px] w-full max-w-xl border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral hover:border-energia"
        />
      </div>

      {categoricas.length > 0 && (
        <div ref={filtrosRef} className="relative mt-3 flex flex-wrap items-center gap-2">
          <span className="rotulo mr-1 text-mineral">Filtrar</span>
          {categoricas.map((c) => (
            <FiltroCategoria
              key={c.id}
              coluna={c}
              opcoes={opcoes[c.id] ?? []}
              marcados={filtros[c.id] ?? []}
              aberto={filtroAberto === c.id}
              onAlternar={(abrir) => setFiltroAberto(abrir ? c.id : null)}
              onMudar={(v) => mudarFiltro(c, v)}
            />
          ))}
        </div>
      )}

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
              Limpar todos
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p id={`${uid}-contagem`} role="status" className="text-sm text-carvao-muted">
          <span className="font-medium tabular-nums text-carvao">{num(filtradas.length, 0)}</span> de {num(linhas.length, 0)}{" "}
          {linhas.length === 1 ? "linha" : "linhas"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-carvao-muted">Linhas mostradas:</span>
          {(["csv", "xlsx"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => exportar(f)}
              aria-disabled={semResultado || undefined}
              className={botaoPagina}
            >
              Baixar {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {selecionadaFora && (
        <p className="mt-2 text-sm text-carvao-muted">
          A linha selecionada ({textoCelula(valorColuna(selecionadaFora, colRot), colRot)}) está fora dos filtros aplicados.{" "}
          <button type="button" onClick={limparTudo} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Mostrar todas as linhas
          </button>
        </p>
      )}

      {maisColunas && (
        <p className="mt-2 text-xs text-mineral" data-dica-rolagem="true">
          A tabela é mais larga que a tela: role para o lado para ver todas as colunas.
        </p>
      )}
      <div ref={rolagemRef} className="tabela-scroll mt-2 max-w-full overflow-x-auto border-t border-linha" role="region" tabIndex={0} aria-label={`${titulo} (tabela rolável)`}>
        <table id={`${uid}-tabela`} className="w-full border-collapse text-sm tabular-nums">
          <caption className="sr-only">
            {`${titulo}. ${num(filtradas.length, 0)} de ${plural(linhas.length, "linha", "linhas")}`}
            {ordem ? `, ordenada por ${colunas.find((c) => c.id === ordem.coluna)?.rotulo ?? ordem.coluna}, ${ordem.direcao === "asc" ? "crescente" : "decrescente"}` : ""}
            {pag.paginas > 1 ? `. Página ${pag.pagina} de ${pag.paginas}` : ""}
            {selecionavel ? ". O botão na coluna de nome seleciona a linha" : ""}.
          </caption>
          <thead>
            <tr>
              {colunas.map((c) => {
                const ativa = ordem?.coluna === c.id;
                const numerica = ehNumerica(c);
                const fixa = c.id === colRot?.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    data-nivel={c.nivel}
                    aria-sort={ativa && ordem ? (ordem.direcao === "asc" ? "ascending" : "descending") : undefined}
                    className={`border-b-2 border-linha bg-superficie px-2 align-bottom font-medium ${numerica ? "min-w-[7rem] text-right" : "text-left"} ${
                      ativa ? "text-carvao" : "text-mineral"
                    } ${fixa ? "sticky left-0 z-20 min-w-[7rem] max-w-[11rem] sm:min-w-[9rem] sm:max-w-[20rem]" : ""}`}
                  >
                    {c.ordenavel !== false ? (
                      <button
                        type="button"
                        onClick={() => alternarOrdem(c)}
                        className={`inline-flex min-h-[44px] w-full items-center gap-1.5 py-1 ${numerica ? "justify-end text-right" : "text-left"} hover:text-carvao`}
                      >
                        <span>{rotuloCabecalho(c)}</span>
                        <span aria-hidden="true" className={`text-[0.7rem] ${ativa ? "text-energia-dark" : "text-mineral"}`}>
                          {ativa && ordem ? (ordem.direcao === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex min-h-[44px] items-center py-1">{rotuloCabecalho(c)}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {semResultado ? (
              <tr>
                <td colSpan={Math.max(1, colunas.length)} className="px-3 py-8 text-center text-sm text-carvao-muted" data-estado="vazio">
                  {linhas.length === 0 ? (
                    semLinhas ?? "Nenhuma linha publicada para esta tabela."
                  ) : (
                    <>
                      Nenhuma linha com esses filtros.{" "}
                      <button type="button" onClick={limparTudo} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        Limpar filtros
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              visiveis.map((l, i) => {
                const id = idDe(l);
                const sel = selecionavel && selecionado !== null && id === selecionado;
                const escolher = () => onSelecionar?.(sel ? null : id);
                return (
                  <tr
                    key={id || `linha-${pag.inicio + i}`}
                    data-id={id}
                    data-selecionada={sel ? "true" : undefined}
                    onClick={selecionavel ? escolher : undefined}
                    className={`border-b border-linha ${sel ? "bg-energia-fundo" : "odd:bg-papel even:bg-superficie"} ${selecionavel ? "cursor-pointer" : ""}`}
                  >
                    {colunas.map((c) => {
                      const v = valorColuna(l, c);
                      const numerica = ehNumerica(c);
                      const conteudo = v === null ? <SemDado sobreFundoAtivo={sel} /> : textoCelula(v, c);
                      if (c.id === colRot?.id) {
                        return (
                          <th
                            key={c.id}
                            scope="row"
                            className={`sticky left-0 z-10 min-w-[7rem] max-w-[11rem] whitespace-normal bg-inherit px-2 font-normal text-carvao [overflow-wrap:anywhere] sm:min-w-[9rem] sm:max-w-[20rem] ${numerica ? "text-right" : "text-left"} ${
                              sel ? "shadow-[inset_4px_0_0_var(--cor-energia)]" : ""
                            }`}
                          >
                            {selecionavel ? (
                              <button
                                type="button"
                                aria-pressed={sel}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  escolher();
                                }}
                                className="flex min-h-[44px] w-full items-center py-1 text-left underline decoration-linha underline-offset-4 hover:decoration-energia"
                              >
                                {conteudo}
                              </button>
                            ) : (
                              <span className="block py-2">{conteudo}</span>
                            )}
                          </th>
                        );
                      }
                      return (
                        <td key={c.id} data-nivel={c.nivel} className={`tc ${numerica ? "tc-n" : c.tipo === "data" ? "tc-d" : "tc-t"}`}>
                          {conteudo}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > TAMANHOS[0] && (
        <nav aria-label={`Paginação: ${titulo}`} className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={botaoPagina} aria-disabled={pag.pagina === 1 || undefined} onClick={() => irPara(1)}>
            <span aria-hidden="true">«</span> Primeira
          </button>
          <button type="button" className={botaoPagina} aria-disabled={pag.pagina === 1 || undefined} onClick={() => irPara(pag.pagina - 1)}>
            <span aria-hidden="true">‹</span> Anterior
          </button>
          <p className="px-1 text-sm tabular-nums text-carvao-muted">
            Página {pag.pagina} de {pag.paginas} · linhas {num(pag.inicio + 1, 0)} a {num(pag.fim, 0)}
          </p>
          <button type="button" className={botaoPagina} aria-disabled={pag.pagina === pag.paginas || undefined} onClick={() => irPara(pag.pagina + 1)}>
            Próxima <span aria-hidden="true">›</span>
          </button>
          <button type="button" className={botaoPagina} aria-disabled={pag.pagina === pag.paginas || undefined} onClick={() => irPara(pag.paginas)}>
            Última <span aria-hidden="true">»</span>
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-carvao-muted">
            Linhas por página
            <select
              value={tamanho}
              onChange={(e) => {
                const novo = Number(e.target.value);
                setTamanho(novo);
                definir({ pagina: 1 });
                const alvo = paginar(filtradas.length, 1, novo);
                setAnuncio(`${novo} linhas por página: ${plural(alvo.paginas, "página", "páginas")}. Página 1: linhas ${num(alvo.inicio + 1, 0)} a ${num(alvo.fim, 0)} de ${num(filtradas.length, 0)}.`);
              }}
              className="min-h-[44px] border border-linha bg-superficie px-2 text-carvao"
            >
              {TAMANHOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </nav>
      )}

      <footer className="mt-3 border-t border-linha pt-2 text-xs leading-relaxed text-mineral">
        <p>
          Fonte: {fonte}. Versão dos dados: {versaoLegivel(versao)}. “{TEXTO_SEM_DADO}” indica ausência na fonte, nunca zero; nos arquivos baixados a ausência é célula vazia.
        </p>
        {nota && <div className="mt-1">{nota}</div>}
      </footer>

      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      </div>
    </div>
  );
}

function FiltroCategoria({
  coluna,
  opcoes,
  marcados,
  aberto,
  onAlternar,
  onMudar,
}: {
  coluna: ColunaTabela;
  opcoes: OpcaoFiltro[];
  marcados: string[];
  aberto: boolean;
  onAlternar: (abrir: boolean) => void;
  onMudar: (valores: string[]) => void;
}) {
  const resumo = useRef<HTMLElement>(null);
  const marcadosSet = new Set(marcados);
  // valores na ordem das opções: a URL tem uma forma só para o mesmo filtro, qualquer que seja a ordem dos cliques
  const alternar = (valor: string) => {
    const novo = new Set(marcadosSet);
    if (novo.has(valor)) novo.delete(valor);
    else novo.add(valor);
    onMudar(opcoes.filter((o) => novo.has(o.valor)).map((o) => o.valor));
  };
  const ativo = marcados.length > 0;
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
        <span>{coluna.rotulo}</span>
        {ativo && <span className="tabular-nums">({marcados.length})</span>}
        <span aria-hidden="true" className="text-[0.7em]">
          {aberto ? "▴" : "▾"}
        </span>
      </summary>
      {/* painel ancorado na largura da faixa de filtros: nunca passa da borda da tela */}
      <div className="absolute left-0 right-0 top-full z-30 mt-1 border border-linha bg-superficie p-3 shadow-[0_6px_20px_rgba(26,29,33,0.12)]">
        <fieldset>
          <legend className="rotulo text-mineral">Filtrar por {coluna.rotulo}</legend>
          <div className="mt-2 grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {opcoes.map((o) => (
              <label key={o.valor} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-energia" checked={marcadosSet.has(o.valor)} onChange={() => alternar(o.valor)} />
                <span className={`min-w-0 flex-1 ${o.valor === CHAVE_SEM_DADO ? "italic text-carvao-muted" : ""}`}>{o.rotulo}</span>
                <span className="text-xs tabular-nums text-mineral">
                  {num(o.n, 0)}
                  <span className="sr-only"> {o.n === 1 ? "linha" : "linhas"}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {ativo && (
          <button type="button" onClick={() => onMudar([])} className="rotulo mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Limpar {coluna.rotulo}
          </button>
        )}
      </div>
    </details>
  );
}
