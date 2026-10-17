"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { FichaDistribuidora, FichaMunicipio, FichaSubmercado, FichaUf, FichaUsina } from "@/components/energia/TerritorioFicha";
import { TerritorioMapa, type DicaMapa, type GrupoPontosMapa, type PoligonoDestaque, type RotuloMapa, type SobreposicaoMapa } from "@/components/energia/TerritorioMapa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ROTULO_METODO, type ValorClassificavel } from "@/lib/energia/escalas";
import { dataBR, num } from "@/lib/energia/formato";
import { caixaDoCaminho, pontoRotulo, validaCamada, type CamadaGeo, type ContornoGeo, type FeatureGeo, type Ponto } from "@/lib/energia/geo";
import { coresParaClasses, descreveRegiao, moverNaLista, preenchimento } from "@/lib/energia/mapa-coropletico";
import { LIMITE_COMPARACAO, alternarSelecao, buscarEntidades } from "@/lib/energia/tabela";
import {
  CAMADAS,
  colunasDistribuidoras,
  colunasIsolados,
  colunasSubmercados,
  colunasUfsIndicadores,
  colunasUfsSubmercado,
  colunasUsinas,
  colunasVinculo,
  CORES_SEQUENCIAIS,
  COR_FONTE,
  ESQUEMA_TERRITORIO,
  ESTAGIOS_USINA,
  FONTES_USINA,
  medidas,
  MEDIDAS_MUNICIPIO,
  nomeSm,
  rotulosCamada,
  rotulosEstadoSm,
  rotulosEstagio,
  rotulosFonte,
  rotulosSituacao,
  SUBMERCADOS,
  classificacaoMedida,
  colunasMunicipios,
  conjuntosDoMunicipio,
  correspondencia,
  entidadesBusca,
  estadoNaDistribuidora,
  filtrarUsinas,
  fonteDaUsina,
  fundoSubmercado,
  indiceDistribuidoras,
  inteiro,
  linhaMunicipio,
  linhaUsina,
  municipiosDoJson,
  ordenarResultadosBusca,
  potenciaUsina,
  descricaoCamada,
  proximaPergunta,
  selecaoDeId,
  situacaoVinculo,
  textoDistribuidoras,
  textoQualidadeMalha,
  textoSemTarifa,
  textoSubmercadoMunicipio,
  usinasDoJson,
  valoresMedida,
  type Camada,
  type DadosExplorador,
  type EntidadeTerritorio,
  type EstagioUsina,
  type FonteUsina,
  type LinhaMunicipio,
  type MedidaMunicipio,
  type MunicipioT,
  type Selecao,
  type SituacaoVinculo,
  type TipoSelecao,
  type UsinaT,
} from "@/lib/energia/territorio";
import type { MunicipiosTerritorio, UsinasTerritorio } from "@/lib/energia/tipos-territorio";
import type { Submercado } from "@/lib/energia/tipos";
import type { Idioma } from "@/lib/idioma";
import { tx } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

/**
 * Explorador da página Minha região (P002): busca, quatro camadas no mesmo mapa
 * (submercados, áreas das distribuidoras, municípios e usinas), ficha da entidade
 * escolhida, tabela equivalente de cada camada, tabelas por grão e comparação de até
 * quatro municípios. Todo o estado fica na URL (camada, seleção, medida, filtros e
 * comparação): o link reproduz a consulta e o voltar do navegador a desfaz.
 *
 * A seleção é uma entidade de qualquer grão. Ao trocar de camada, ela continua só
 * onde a gold declara a correspondência válida (`correspondencia` em
 * src/lib/energia/territorio.ts); onde não declara, a página diz por quê e não acende
 * nada. Nenhum valor desce de grão: o município selecionado na camada de
 * submercados acende o submercado, e a ficha mostra o PLD como "do submercado".
 *
 * Peso: a malha municipal (1,3 MB), o índice municipal (1,1 MB) e as usinas (3,1 MB)
 * só são baixados quando a camada, a busca ou o link pedem; a malha de UF (67 KB) vem
 * com a página aberta.
 */

/* ---------------------------------------------------------------- carga sob demanda */

const cache = new Map<string, Promise<unknown>>();

function carregar<T>(url: string, validar?: (x: unknown) => string[]): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`resposta ${r.status}`);
      const j: unknown = await r.json();
      const erros = validar ? validar(j) : [];
      if (erros.length) throw new Error(erros.slice(0, 3).join("; "));
      return j as T;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

type Carga<T> = { estado: "ocioso" } | { estado: "carregando" } | { estado: "pronto"; dado: T } | { estado: "erro"; erro: string };

function useArquivo<T>(url: string, ativo: boolean, validar?: (x: unknown) => string[]): [Carga<T>, () => void] {
  const [carga, setCarga] = useState<Carga<T>>({ estado: "ocioso" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!ativo || carga.estado === "pronto") return;
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregar<T>(url, validar).then(
      (dado) => vivo && setCarga({ estado: "pronto", dado }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a carga pronta não é refeita; a tentativa refaz a que falhou
  }, [url, ativo, tentativa]);
  return [carga, () => setTentativa((t) => t + 1)];
}

const pronto = <T,>(c: Carga<T>): T | null => (c.estado === "pronto" ? c.dado : null);

/* ---------------------------------------------------------------- peças pequenas */

const CORES_SITUACAO: Record<SituacaoVinculo, string> = {
  exclusiva: "var(--escala-seq-2)",
  compartilhado: "var(--escala-seq-4)",
  so_sem_confirmacao: "var(--escala-div-neg-1)",
  sem_vinculo: "sem-dado",
};
const COR_VINCULO = { 1: "var(--cor-energia)", 2: "var(--escala-seq-3)", 0: "var(--escala-seq-2)" } as const; // i18n: dado
const COR_FORA_DA_AREA = "var(--escala-div-centro)";
const COR_NAO_SE_APLICA = "var(--mapa-nao-se-aplica)";
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const CLASSES_POTENCIA = [
  { ate: 1, espessura: 4 },
  { ate: 100, espessura: 6 },
  { ate: Infinity, espessura: 9 },
];
/** Rótulo de cada classe de potência das marcas, no idioma. */
function rotulosPotencia(idioma: Idioma): string[] {
  return [tx("menos de 1 MW", "less than 1 MW", idioma), tx("1 a menos de 100 MW", "1 to less than 100 MW", idioma), tx("100 MW ou mais", "100 MW or more", idioma)];
}
const classePotencia = (mw: number | null) => CLASSES_POTENCIA.findIndex((c) => (mw ?? 0) < c.ate);

type ItemLegenda = { id: string; rotulo: string; cor: string; contagem?: number | null; forma?: "area" | "tracejado" | "ponto-redondo" | "ponto-quadrado" | "ponto-vazado" };

function Amostra({ item }: { item: ItemLegenda }) {
  if (item.forma?.startsWith("ponto")) {
    const quadrado = item.forma !== "ponto-redondo";
    return (
      <svg aria-hidden="true" width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
        <path d="M8 8h0" stroke={item.cor} strokeWidth={9} strokeLinecap={quadrado ? "square" : "round"} />
        {item.forma === "ponto-vazado" && <path d="M8 8h0" stroke="var(--cor-superficie)" strokeWidth={5} strokeLinecap="square" />}
      </svg>
    );
  }
  const hachura = item.cor === "sem-dado";
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-5 shrink-0 border ${item.forma === "tracejado" ? "border-dashed border-carvao" : "border-linha"}`}
      style={hachura ? { backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, var(--cor-superficie) 1px 4px)" } : { background: item.cor }}
    />
  );
}

function Legenda({ titulo, itens, nota }: { titulo: string; itens: ItemLegenda[]; nota?: ReactNode }) {
  const tx = useTx();
  const idioma = useIdioma();
  return (
    <div>
      <p className="rotulo text-mineral">{titulo}</p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx(`Legenda: ${titulo}`, `Legend: ${titulo}`)}>
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-1.5">
            <Amostra item={i} />
            {i.rotulo}
            {i.contagem !== undefined && i.contagem !== null && <span className="tabular-nums">({num(i.contagem, 0, idioma)})</span>}
          </li>
        ))}
      </ul>
      {nota && <p className="mt-1 text-xs text-carvao-muted">{nota}</p>}
    </div>
  );
}

function Estado({ children, alerta = false }: { children: ReactNode; alerta?: boolean }) {
  return (
    <p role={alerta ? "alert" : "status"} className={`border border-dashed px-4 py-3 text-sm ${alerta ? "border-mineral bg-papel text-carvao" : "border-linha text-carvao-muted"}`}>
      {children}
    </p>
  );
}

function Falha({ erro, arquivo, nome, repetir }: { erro: string; arquivo: string; nome: string; repetir: () => void }) {
  const tx = useTx();
  const link = (
    <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
      {arquivo.split("/").at(-1)}
    </a>
  );
  return (
    <div role="alert" className="space-y-2 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
      <p>
        {tx(
          <>
            Não foi possível carregar {nome} ({erro}). Os mesmos dados estão em {link}.
          </>,
          <>
            Could not load {nome} ({erro}). The same data are in {link}.
          </>,
        )}
      </p>
      <button type="button" onClick={repetir} className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia">
        {tx("Tentar de novo", "Try again")}
      </button>
    </div>
  );
}

function Secao({ titulo, children, nivel, id }: { titulo: string; children: ReactNode; nivel?: "analisar" | "auditar"; id?: string }) {
  return (
    <div id={id} data-nivel={nivel} className="scroll-mt-28 space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- busca */

function Busca({
  entidades,
  carregando,
  onFoco,
  onEscolher,
  campoRef,
  reinicio,
  consultaDaUrl = "",
}: {
  entidades: EntidadeTerritorio[];
  carregando: boolean;
  onFoco: () => void;
  onEscolher: (e: EntidadeTerritorio) => void;
  campoRef: RefObject<HTMLInputElement>;
  /** Muda quando a escolha é limpa: o campo volta a ficar vazio. */
  reinicio: number;
  /** Texto de `?busca=` (a busca da página inicial leva o que a pessoa digitou): preenche o campo e abre a lista ao chegar. */
  consultaDaUrl?: string;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const uid = useId().replace(/:/g, "");
  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  // nome exato primeiro; no resto, o município maior antes (as entidades já chegam por população); mostra até 30 e conta o total
  const res = useMemo(() => {
    if (!consulta.trim()) return { itens: [] as EntidadeTerritorio[], total: 0 };
    const r = buscarEntidades(entidades, consulta, 200);
    return { itens: ordenarResultadosBusca(r.itens, consulta).slice(0, 30), total: r.total };
  }, [entidades, consulta]);
  useEffect(() => {
    if (reinicio > 0) {
      setConsulta("");
      setAberta(false);
      setAtivo(-1);
    }
  }, [reinicio]);
  useEffect(() => {
    if (consultaDaUrl) {
      setConsulta(consultaDaUrl);
      setAberta(true);
      setAtivo(-1);
    }
  }, [consultaDaUrl]);
  useEffect(() => {
    if (aberta && ativo >= 0) document.getElementById(`${uid}-op-${ativo}`)?.scrollIntoView?.({ block: "nearest" });
  }, [aberta, ativo, uid]);

  const escolher = (e: EntidadeTerritorio) => {
    onEscolher(e);
    setConsulta(e.rotulo);
    setAberta(false);
    setAtivo(-1);
  };
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={`${uid}-busca`} className="rotulo mb-1 block text-mineral">
        {tx("Encontre a sua região", "Find your region")}
      </label>
      <input
        id={`${uid}-busca`}
        ref={campoRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberta && consulta.trim() !== ""}
        aria-controls={`${uid}-lista`}
        aria-activedescendant={aberta && ativo >= 0 ? `${uid}-op-${ativo}` : undefined}
        aria-describedby={`${uid}-ajuda`}
        autoComplete="off"
        spellCheck={false}
        value={consulta}
        placeholder={tx("Município, distribuidora, UF ou submercado", "Municipality, distribution utility, state or submarket")}
        onFocus={onFoco}
        onChange={(e) => {
          setConsulta(e.target.value);
          setAberta(true);
          setAtivo(-1);
        }}
        onKeyDown={(ev) => {
          const n = res.itens.length;
          if (ev.key === "ArrowDown" || ev.key === "ArrowUp" || ev.key === "PageDown" || ev.key === "PageUp") {
            const prox = moverNaLista(aberta ? ativo : -1, ev.key, n);
            if (prox === null) return;
            ev.preventDefault();
            setAberta(true);
            setAtivo(prox);
          } else if (ev.key === "Enter" && aberta && ativo >= 0 && ativo < n) {
            ev.preventDefault();
            escolher(res.itens[ativo]);
          } else if (ev.key === "Escape") {
            if (aberta) {
              ev.preventDefault();
              setAberta(false);
              setAtivo(-1);
            } else if (consulta) setConsulta("");
          }
        }}
        onBlur={() => {
          setAberta(false);
          setAtivo(-1);
        }}
        className="h-11 w-full border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      />
      <p id={`${uid}-ajuda`} className="mt-1 text-xs text-carvao-muted">
        {carregando
          ? tx("Carregando os 5.571 municípios do IBGE para a busca…", "Loading the 5,571 IBGE municipalities for the search…")
          : tx(
              "Digite parte do nome, a sigla da UF, o CNPJ ou o código IBGE. Setas percorrem a lista; Enter escolhe.",
              "Type part of the name, the state abbreviation, the CNPJ or the IBGE code. Arrow keys move through the list; Enter chooses.",
            )}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-limite-busca="">
        <a href="#territorio-limites" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
          {tx("O que a página não permite concluir", "What the page does not allow you to conclude")}
        </a>
      </p>
      <p className="sr-only" role="status" aria-live="polite" data-anuncio-busca="">
        {!aberta || consulta.trim() === ""
          ? ""
          : res.total === 0
            ? carregando
              ? tx("Os municípios ainda estão chegando; tente de novo em instantes.", "The municipalities are still arriving; try again in a moment.")
              : tx("Nenhum resultado para essa busca.", "No results for this search.")
            : res.total > res.itens.length
              ? tx(
                  `${num(res.total, 0)} resultados; mostrando ${num(res.itens.length, 0)}. Refine a busca.`,
                  `${num(res.total, 0, idioma)} results; showing ${num(res.itens.length, 0, idioma)}. Refine the search.`,
                )
              : tx(`${num(res.total, 0)} ${res.total === 1 ? "resultado" : "resultados"}.`, `${num(res.total, 0, idioma)} ${res.total === 1 ? "result" : "results"}.`)}
      </p>
      <ul
        id={`${uid}-lista`}
        role="listbox"
        hidden={!aberta || consulta.trim() === ""}
        aria-label={tx("Resultados da busca", "Search results")}
        onPointerDown={(e) => e.preventDefault()}
        className="absolute left-0 right-0 top-[4.25rem] z-30 max-h-72 overflow-y-auto border border-linha bg-superficie shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
      >
        {res.itens.map((e, i) => (
          <li
            key={e.id}
            id={`${uid}-op-${i}`}
            role="option"
            aria-selected={i === ativo}
            onClick={() => escolher(e)}
            className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 border-b border-linha px-3 py-1 text-sm last:border-b-0 ${
              i === ativo ? "bg-energia-fundo text-carvao shadow-[inset_4px_0_0_var(--cor-energia)]" : "text-carvao hover:bg-papel"
            }`}
          >
            <span className="min-w-0">{e.tipo === "sm" ? e.rotulo : <Nome>{e.rotulo}</Nome>}</span>
            <span className="shrink-0 text-xs text-carvao-muted">
              {e.detalhe}
              {e.populacao ? ` · ${e.populacao}` : ""}
            </span>
          </li>
        ))}
        {res.total === 0 && (
          <li role="presentation" aria-hidden="true" className="px-3 py-2 text-xs text-carvao-muted">
            {carregando
              ? tx("Os municípios ainda estão chegando; tente de novo em instantes.", "The municipalities are still arriving; try again in a moment.")
              : tx("Nenhum resultado para essa busca.", "No results for this search.")}
          </li>
        )}
        {res.total > res.itens.length && (
          <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
            {tx(
              `Mais ${num(res.total - res.itens.length, 0)} resultados: refine a busca.`,
              `${num(res.total - res.itens.length, 0, idioma)} more results: refine the search.`,
            )}
          </li>
        )}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- explorador */

export function TerritorioExplorador({ dados }: { dados: DadosExplorador }) {
  const tx = useTx();
  const idioma = useIdioma();
  const ROTULO_CAMADA = rotulosCamada(idioma);
  const ROTULO_ESTADO_SM = rotulosEstadoSm(idioma);
  const ROTULO_ESTAGIO = rotulosEstagio(idioma);
  const ROTULO_FONTE = rotulosFonte(idioma);
  const ROTULO_SITUACAO = rotulosSituacao(idioma);
  const MEDIDA = medidas(idioma);
  const rotuloPotencia = rotulosPotencia(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_TERRITORIO);
  const [pedidoIndice, setPedidoIndice] = useState(false);
  const [pedidoMalha, setPedidoMalha] = useState(false);
  const [avisoCmp, setAvisoCmp] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);
  const fichaRef = useRef<HTMLElement>(null);
  const [reinicioBusca, setReinicioBusca] = useState(0);
  // `?busca=<texto>`, vindo da busca da página inicial: o campo já chega preenchido e a lista de municípios é pedida
  const [buscaDaUrl, setBuscaDaUrl] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("busca")?.trim().slice(0, 80) ?? "";
    if (q) {
      setBuscaDaUrl(q);
      setPedidoIndice(true);
    }
  }, []);
  // a escolha feita pela pessoa (busca, mapa, tabela) leva a tela até a ficha e o foco ao título dela; a que vem do link não
  const [pedidoFoco, setPedidoFoco] = useState(0);
  const cam = v.cam;
  const sel = v.sel;

  const querMalha = cam === "distribuidora" || cam === "municipio" || pedidoMalha;
  const querIndice = querMalha || pedidoIndice || cam === "usinas" || sel?.tipo === "mun" || sel?.tipo === "usi" || v.cmp.length > 0;
  const querUsinas = cam === "usinas" || sel?.tipo === "usi";

  const [cUf, repetirUf] = useArquivo<CamadaGeo>(dados.arquivos.geoUf, true, validaCamada);
  const [cMalha, repetirMalha] = useArquivo<CamadaGeo>(dados.arquivos.geoMunicipios, querMalha, validaCamada);
  const [cIndice, repetirIndice] = useArquivo<MunicipiosTerritorio>(dados.arquivos.municipios, querIndice);
  const [cUsinas, repetirUsinas] = useArquivo<UsinasTerritorio>(dados.arquivos.usinas, querUsinas);
  const geoUf = pronto(cUf);
  const geoMun = pronto(cMalha);
  const indice = pronto(cIndice);
  const arqUsinas = pronto(cUsinas);

  /* dados derivados (as mesmas linhas no mapa, na tabela e na exportação) */
  const idx = useMemo(() => indiceDistribuidoras(dados.distribuidoras), [dados.distribuidoras]);
  const distPorCnpj = useMemo(() => new Map(dados.distribuidoras.map((d) => [d.id, d])), [dados.distribuidoras]);
  const ufPorSigla = useMemo(() => new Map(dados.ufs.map((u) => [u.uf, u])), [dados.ufs]);
  const smPorId = useMemo(() => new Map(dados.submercados.map((s) => [s.id, s])), [dados.submercados]);
  const municipios = useMemo(() => (indice ? municipiosDoJson(indice) : null), [indice]);
  const porIbge = useMemo(() => new Map((municipios ?? []).map((m) => [m.ibge, m])), [municipios]);
  const linhasMun = useMemo(() => (municipios ? municipios.map((m) => linhaMunicipio(m, idx, idioma)) : null), [municipios, idx, idioma]);
  const usinas = useMemo(() => (arqUsinas ? usinasDoJson(arqUsinas, dados.limiteRegistroKw) : null), [arqUsinas, dados.limiteRegistroKw]);
  const usinasVisiveis = useMemo(() => (usinas ? filtrarUsinas(usinas, { fon: v.fon, est: v.est, reg: v.reg }) : null), [usinas, v.fon, v.est, v.reg]);
  const nomeMunicipio = useCallback((ibge: string) => {
    const m = porIbge.get(ibge);
    return m ? `${m.nome} (${m.uf})` : tx(`município ${ibge}`, `municipality ${ibge}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tx muda só com o idioma
  }, [porIbge, idioma]);
  const linhasUsinas = useMemo(() => (usinasVisiveis ? usinasVisiveis.map((u) => linhaUsina(u, nomeMunicipio, idioma)) : null), [usinasVisiveis, nomeMunicipio, idioma]);
  const entidades = useMemo(() => entidadesBusca(dados, municipios, idioma), [dados, municipios, idioma]);
  const featMun = useMemo(() => new Map((geoMun?.features ?? []).map((f) => [f.id, f])), [geoMun]);

  /* entidade escolhida */
  const selMun = sel?.tipo === "mun" ? porIbge.get(sel.id) ?? null : null;
  const selDist = sel?.tipo === "dist" ? distPorCnpj.get(sel.id) ?? null : null;
  const selUf = sel?.tipo === "uf" ? ufPorSigla.get(sel.id) ?? null : null;
  const selSm = sel?.tipo === "sm" ? smPorId.get(sel.id as Submercado) ?? null : null;
  const selUsi = sel?.tipo === "usi" && usinas ? usinas.find((u) => u.ceg === sel.id) ?? null : null;
  const corr = correspondencia(sel, cam, {
    compat: dados.compatibilidade,
    municipio: selMun,
    distribuidora: selDist,
    uf: selUf ?? (selMun ? ufPorSigla.get(selMun.uf) ?? null : null),
    usina: selUsi,
  }, idioma);

  const selecionar = useCallback(
    (s: Selecao) => {
      definir({ sel: s });
      if (s) setPedidoFoco((n) => n + 1);
    },
    [definir],
  );
  /** Limpa a escolha e devolve o foco ao campo de busca, sem perder o ponto onde a pessoa estava. */
  const limpar = useCallback(() => {
    definir({ sel: null });
    setReinicioBusca((n) => n + 1);
    campoBusca.current?.focus();
  }, [definir]);
  /** "Ver as usinas deste município": abre a camada Usinas com a busca da tabela já no nome do município. */
  const verUsinas = useCallback(
    (m: MunicipioT) => {
      definir({ cam: "usinas", usiq: `${m.nome} ${m.uf}` }); // i18n: dado
    },
    [definir],
  );
  const idSel = (tipo: TipoSelecao) => (sel?.tipo === tipo ? sel.id : null);

  /* ---------------------------------------------------------------- montagem do mapa por camada */

  type Montagem = {
    geo: CamadaGeo | null;
    carregando: string | null;
    falha: ReactNode;
    fills: string[];
    contornos: boolean;
    /** Contorno de cada UF desenhado a partir das próprias UFs (camadas que pintam a UF inteira, sem a malha municipal). */
    contornosUf: boolean;
    /** Siglas das UFs sobre o mapa. */
    rotulos: boolean;
    sobreposicoes: SobreposicaoMapa[];
    destaques: PoligonoDestaque[];
    pontos: GrupoPontosMapa[];
    pontoSelecionado: Ponto | null;
    foco: Ponto | null;
    legenda: ReactNode;
    titulo: string;
    descricao: string;
    clique: (a: { id: string | null; ponto: Ponto; tolerancia: number }) => void;
    dica: (id: string) => DicaMapa | null;
  };

  const ufDeFeature = useMemo(() => new Map((geoUf?.features ?? []).map((f) => [f.id, f.uf])), [geoUf]);
  const featPorUf = useMemo(() => new Map((geoUf?.features ?? []).map((f) => [f.uf, f])), [geoUf]);
  // siglas das UFs sobre o mapa e o contorno de cada UF para as camadas que pintam a UF inteira
  const rotulosUf = useMemo<RotuloMapa[]>(
    () =>
      (geoUf?.features ?? []).flatMap((f) => {
        const p = pontoRotulo(f.d);
        const c = caixaDoCaminho(f.d);
        return p ? [{ id: f.id, texto: f.uf, x: p[0], y: p[1], peso: c ? c.largura * c.altura : 0 }] : [];
      }),
    [geoUf],
  );
  const contornosUf = useMemo<ContornoGeo[]>(() => (geoUf?.features ?? []).map((f) => ({ id: f.id, uf: f.uf, d: f.d })), [geoUf]);
  // ponto de rótulo (dentro da maior parte da região): centro do "Aproximar"
  const centro = (f: FeatureGeo | undefined): Ponto | null => (f ? pontoRotulo(f.d) : null);

  const destaquesBase = (): PoligonoDestaque[] => {
    const out: PoligonoDestaque[] = [];
    // a malha de UF e a municipal estão na mesma projeção: o contorno da UF serve às duas
    const temMun = !!corr.municipio && featMun.has(corr.municipio);
    if (corr.uf && (sel?.tipo === "uf" || !temMun)) {
      const f = featPorUf.get(corr.uf);
      if (f) out.push({ id: `uf-${f.id}`, d: f.d, estilo: sel?.tipo === "uf" ? "selecao" : "contorno" });
    }
    if (corr.municipio) {
      const f = featMun.get(corr.municipio);
      if (f) out.push({ id: `mun-${f.id}`, d: f.d, estilo: "selecao" });
    }
    return out;
  };

  const vazio: Montagem = {
    geo: null,
    carregando: null,
    falha: null,
    fills: [],
    contornos: false,
    contornosUf: false,
    rotulos: false,
    sobreposicoes: [],
    destaques: [],
    pontos: [],
    pontoSelecionado: null,
    foco: null,
    legenda: null,
    titulo: "",
    descricao: "",
    clique: () => {},
    dica: () => null,
  };

  const montagem: Montagem = (() => {
    if (cUf.estado === "erro")
      return { ...vazio, falha: <Falha erro={cUf.erro} arquivo={dados.arquivos.geoUf} nome={tx("a malha de UF do IBGE", "the IBGE state map")} repetir={repetirUf} /> };

    if (cam === "submercado") {
      if (!geoUf) return { ...vazio, carregando: tx("Carregando o mapa das UFs (IBGE)…", "Loading the map of the states (IBGE)…") };
      const fills = geoUf.features.map((f) => {
        const s = ufPorSigla.get(f.uf)?.subsistema;
        return s ? fundoSubmercado(s) : "sem-dado";
      });
      const sobreposicoes: SobreposicaoMapa[] = [];
      if (geoMun && municipios) {
        const fora = municipios.filter((m) => m.sm_estado === "fora_do_sin").flatMap((m) => featMun.get(m.ibge) ?? []);
        const isol = municipios.filter((m) => m.sm_estado === "com_localidade_isolada").flatMap((m) => {
          const f = featMun.get(m.ibge);
          return f && m.sm ? [{ f, sm: m.sm }] : [];
        });
        sobreposicoes.push({ id: "fora", features: fora, fill: COR_NAO_SE_APLICA });
        for (const sm of SUBMERCADOS) {
          const fs = isol.filter((x) => x.sm === sm).map((x) => x.f);
          if (fs.length) sobreposicoes.push({ id: `isol-${sm}`, features: fs, fill: fundoSubmercado(sm), tracejado: true });
        }
      }
      const destaques: PoligonoDestaque[] = [];
      for (const u of dados.ufs.filter((x) => x.estado === ROTULO_ESTADO_SM.provado_com_area_sem_carga)) {
        const f = featPorUf.get(u.uf);
        if (f) destaques.push({ id: `tracejado-${u.uf}`, d: f.d, estilo: "tracejado" });
      }
      for (const sm of corr.sms) for (const u of dados.ufs.filter((x) => x.subsistema === sm)) {
        const f = featPorUf.get(u.uf);
        if (f) destaques.push({ id: `sm-${u.uf}`, d: f.d, estilo: "area" });
      }
      destaques.push(...destaquesBase());
      const e = dados.estadosMunicipio;
      const contaUf = (sm: Submercado) => dados.ufs.filter((u) => u.subsistema === sm).length;
      const ufsPorSm = SUBMERCADOS.map((s) => tx(`${nomeSm(s, idioma)} com ${contaUf(s)} UFs`, `${nomeSm(s, idioma)} with ${contaUf(s)} states`)).join(", ");
      return {
        ...vazio,
        geo: geoUf,
        fills,
        rotulos: true,
        sobreposicoes,
        destaques,
        foco: centro(corr.uf ? featPorUf.get(corr.uf) : undefined),
        titulo: tx(
          "Submercado de cada UF (camada oficial da EPE, pertença conferida pela carga do ONS em dois dias)",
          "Submarket of each state (official EPE layer, membership checked against the ONS load on two days)",
        ),
        descricao: tx(
          `Mapa das 27 UFs pintadas pelo submercado: ${ufsPorSm}. A tabela abaixo do mapa traz as mesmas UFs.`,
          `Map of the 27 states colored by submarket: ${ufsPorSm}. The table below the map shows the same states.`,
        ),
        legenda: (
          <Legenda
            titulo={tx("Submercado (cor da UF)", "Submarket (state color)")}
            itens={[
              ...SUBMERCADOS.map((s) => ({ id: s, rotulo: tx(`${nomeSm(s, idioma)} (UFs)`, `${nomeSm(s, idioma)} (states)`), cor: fundoSubmercado(s), contagem: contaUf(s) })),
              {
                id: "fora",
                rotulo: tx("Município fora do SIN: submercado não se aplica", "Municipality outside the SIN: submarket does not apply"),
                cor: COR_NAO_SE_APLICA,
                contagem: e.fora_do_sin ?? null,
              },
              {
                id: "isol",
                rotulo: tx("Município com localidade isolada, dentro do SIN (contorno tracejado)", "Municipality with an isolated locality, inside the SIN (dashed outline)"),
                cor: "var(--cor-superficie)",
                contagem: e.com_localidade_isolada ?? null,
                forma: "tracejado",
              },
              {
                id: "toco",
                rotulo: tx("UF com área de carga sem carga nos dias conferidos (contorno tracejado)", "State with a load area without load on the days checked (dashed outline)"),
                cor: "var(--cor-superficie)",
                forma: "tracejado",
              },
            ]}
            nota={tx(
              "A divisa é a da UF: o ONS não publica limite geográfico do submercado. Município fora do SIN não pertence ao submercado da cor da UF.",
              "The border is the state's: the ONS publishes no geographic boundary for the submarket. A municipality outside the SIN does not belong to the submarket of the state's color.",
            )}
          />
        ),
        clique: ({ id }) => {
          if (!id) return;
          if (/^\d{7}$/.test(id)) selecionar({ tipo: "mun", id });
          else {
            const uf = ufDeFeature.get(id);
            if (uf) selecionar(sel?.tipo === "uf" && sel.id === uf ? null : { tipo: "uf", id: uf });
          }
        },
        dica: (id) => {
          if (/^\d{7}$/.test(id)) {
            const m = porIbge.get(id);
            return m ? { titulo: `${m.nome} · ${m.uf}`, linhas: [textoSubmercadoMunicipio(m, idioma), m.sm_estado ? ROTULO_ESTADO_SM[m.sm_estado] : ""] } : null;
          }
          const u = ufPorSigla.get(ufDeFeature.get(id) ?? "");
          return u ? { titulo: `${u.nome} · ${u.uf}`, linhas: [u.submercado, tx(`pertença ${u.estado}`, `membership ${u.estado}`)] } : null;
        },
      };
    }

    if (cam === "usinas") {
      if (!geoUf) return { ...vazio, carregando: tx("Carregando o mapa das UFs (IBGE)…", "Loading the map of the states (IBGE)…") };
      if (cUsinas.estado === "erro")
        return { ...vazio, falha: <Falha erro={cUsinas.erro} arquivo={dados.arquivos.usinas} nome={tx("as usinas", "the plants")} repetir={repetirUsinas} /> };
      if (!usinasVisiveis) return { ...vazio, carregando: tx("Carregando as usinas do SIGA…", "Loading the SIGA plants…") };
      const grupos = new Map<string, { cor: string; ponta: "round" | "square"; espessura: number; d: string[]; vazado: boolean; ordem: number }>();
      for (const u of usinasVisiveis) {
        if (u.x === null || u.y === null) continue;
        const fonte = fonteDaUsina(u.tipo);
        const cl = classePotencia(potenciaUsina(u));
        const k = `${u.estagio}|${fonte}|${cl}`;
        let g = grupos.get(k);
        if (!g) {
          g = {
            cor: COR_FONTE[fonte],
            ponta: u.estagio === "operacao" ? "round" : "square",
            espessura: CLASSES_POTENCIA[cl].espessura,
            d: [],
            vazado: u.estagio === "construcao_nao_iniciada",
            ordem: (u.estagio === "operacao" ? 0 : 3) + cl,
          };
          grupos.set(k, g);
        }
        g.d.push(`M${u.x} ${u.y}h0`);
      }
      const pontos: GrupoPontosMapa[] = Array.from(grupos.entries())
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .map(([id, g]) => ({ id, cor: g.cor, ponta: g.ponta, espessura: g.espessura, d: g.d.join(""), vazado: g.vazado }));
      if (corr.usinas === "do_municipio" && corr.municipio) {
        const d = usinasVisiveis.filter((u) => u.x !== null && u.municipios.includes(corr.municipio!)).map((u) => `M${u.x} ${u.y}h0`).join("");
        if (d) pontos.push({ id: "destaque", cor: "var(--cor-carvao)", ponta: "round", espessura: 14, d, vazado: true });
      }
      const contaFonte = (f: FonteUsina) => usinasVisiveis.filter((u) => fonteDaUsina(u.tipo) === f).length;
      const contaEst = (e: EstagioUsina) => usinasVisiveis.filter((u) => u.estagio === e).length;
      const semCoord = usinasVisiveis.filter((u) => u.x === null || u.y === null).length;
      const ponto: Ponto | null = selUsi && selUsi.x !== null && selUsi.y !== null ? [selUsi.x, selUsi.y] : null;
      return {
        ...vazio,
        geo: geoUf,
        fills: geoUf.features.map(() => "var(--cor-superficie)"),
        contornosUf: true,
        rotulos: true,
        destaques: destaquesBase(),
        pontos,
        pontoSelecionado: ponto,
        foco: ponto ?? centro(corr.uf ? featPorUf.get(corr.uf) : undefined),
        titulo: tx(
          `Usinas do SIGA de ${dataBR(dados.referencias.siga_data)} (ponto: coordenada informada à ANEEL)`,
          `SIGA plants of ${dataBR(dados.referencias.siga_data, idioma)} (point: coordinate reported to ANEEL)`,
        ),
        descricao: tx(
          `Mapa do Brasil por UF com ${inteiro(usinasVisiveis.length - semCoord)} usinas desenhadas como pontos. A tabela abaixo do mapa traz as mesmas usinas.`,
          `Map of Brazil by state with ${inteiro(usinasVisiveis.length - semCoord, idioma)} plants drawn as points. The table below the map shows the same plants.`,
        ),
        legenda: (
          <div className="space-y-2">
            <Legenda
              titulo={tx("Fonte (cor)", "Source (color)")}
              itens={FONTES_USINA.filter((f) => v.fon.includes(f)).map((f) => ({ id: f, rotulo: ROTULO_FONTE[f], cor: COR_FONTE[f], contagem: contaFonte(f), forma: "ponto-redondo" as const }))}
            />
            <Legenda
              titulo={tx("Estágio (forma) e potência (tamanho)", "Stage (shape) and capacity (size)")}
              itens={[
                ...ESTAGIOS_USINA.filter((e) => v.est.includes(e)).map((e) => ({
                  id: e,
                  rotulo: ROTULO_ESTAGIO[e],
                  cor: "var(--cor-carvao-muted)",
                  contagem: contaEst(e),
                  forma: e === "operacao" ? ("ponto-redondo" as const) : e === "construcao" ? ("ponto-quadrado" as const) : ("ponto-vazado" as const),
                })),
              ]}
              nota={tx(
                `Tamanho da marca: ${rotuloPotencia.join(", ")} (fiscalizada em operação, outorgada nas demais).${semCoord ? ` ${inteiro(semCoord)} usinas sem coordenada ficam só na tabela.` : ""}${v.reg ? "" : " Registros de até 10 kW fora do mapa (marque para incluir)."}`,
                `Mark size: ${rotuloPotencia.join(", ")} (inspected in operation, granted for the others).${semCoord ? ` ${inteiro(semCoord, idioma)} plants without coordinates are only in the table.` : ""}${v.reg ? "" : " Registrations of up to 10 kW are off the map (check to include)."}`,
              )}
            />
          </div>
        ),
        clique: ({ id, ponto: p, tolerancia }) => {
          let melhor: UsinaT | null = null;
          let dist = tolerancia;
          for (const u of usinasVisiveis) {
            if (u.x === null || u.y === null) continue;
            const d = Math.hypot(u.x - p[0], u.y - p[1]);
            if (d <= dist) {
              dist = d;
              melhor = u;
            }
          }
          if (melhor) selecionar({ tipo: "usi", id: melhor.ceg });
          else if (id) {
            const uf = ufDeFeature.get(id);
            if (uf) selecionar({ tipo: "uf", id: uf });
          }
        },
        dica: (id) => {
          const u = ufPorSigla.get(ufDeFeature.get(id) ?? "");
          return u ? { titulo: `${u.nome} · ${u.uf}`, linhas: [tx("Toque ou clique numa marca para ver a usina.", "Tap or click a mark to see the plant.")] } : null;
        },
      };
    }

    // camadas sobre a malha municipal
    if (cMalha.estado === "erro")
      return { ...vazio, falha: <Falha erro={cMalha.erro} arquivo={dados.arquivos.geoMunicipios} nome={tx("a malha municipal do IBGE", "the IBGE municipal map")} repetir={repetirMalha} /> };
    if (cIndice.estado === "erro")
      return { ...vazio, falha: <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome={tx("o índice municipal", "the municipal index")} repetir={repetirIndice} /> };
    if (!geoMun || !municipios || !linhasMun) return { ...vazio, carregando: tx("Carregando o mapa e o índice dos municípios (IBGE)…", "Loading the map and the index of the municipalities (IBGE)…") };

    if (cam === "distribuidora") {
      const area = corr.dist;
      const cand = corr.candidatas;
      let fills: string[];
      let legenda: ReactNode;
      if (area !== null) {
        const d = idx.get(area);
        const conta = { 1: 0, 2: 0, 0: 0 } as Record<0 | 1 | 2, number>;
        fills = geoMun.features.map((f) => {
          const m = porIbge.get(f.id);
          const e = m ? estadoNaDistribuidora(m, area) : null;
          if (e === null) return COR_FORA_DA_AREA;
          conta[e]++;
          return COR_VINCULO[e];
        });
        legenda = (
          <Legenda
            titulo={tx(
              `Área de ${d?.sigla ?? "distribuidora"} pela relação oficial (municípios inteiros)`,
              `Area of ${d?.sigla ?? "the distribution utility"} by the official list (whole municipalities)`,
            )}
            itens={[
              { id: "1", rotulo: tx("Vínculo confirmado", "Confirmed link"), cor: COR_VINCULO[1], contagem: conta[1] },
              { id: "2", rotulo: tx("Só pelo cadastro de MMGD", "Only through the MMGD register"), cor: COR_VINCULO[2], contagem: conta[2] },
              { id: "0", rotulo: tx("Sem confirmação (ressalva)", "Unconfirmed (caveat)"), cor: COR_VINCULO[0], contagem: conta[0] },
              { id: "fora", rotulo: tx("Fora da área", "Outside the area"), cor: COR_FORA_DA_AREA },
            ]}
            nota={tx(
              "Não há polígono oficial de concessão acessível: a área é desenhada pelos municípios inteiros da relação, e município compartilhado aparece em todas as áreas.",
              "There is no accessible official concession polygon: the area is drawn from the whole municipalities in the list, and a shared municipality appears in every area.",
            )}
          />
        );
      } else if (cand.length) {
        const conta = new Map<number, number>();
        let varias = 0;
        fills = geoMun.features.map((f) => {
          const m = porIbge.get(f.id);
          const deles = m ? cand.filter((i) => estadoNaDistribuidora(m, i) !== null) : [];
          if (deles.length > 1) {
            varias++;
            return "var(--cor-mineral)";
          }
          if (deles.length === 1) {
            conta.set(deles[0], (conta.get(deles[0]) ?? 0) + 1);
            return `color-mix(in srgb, ${CORES_COMP[cand.indexOf(deles[0]) % 4]} 45%, var(--cor-superficie))`;
          }
          return COR_FORA_DA_AREA;
        });
        legenda = (
          <Legenda
            titulo={tx(
              "Áreas das distribuidoras que atendem o município escolhido (listadas, nenhuma escolhida)",
              "Areas of the distribution utilities serving the chosen municipality (listed, none chosen)",
            )}
            itens={[
              ...cand.map((i, k) => ({
                id: String(i),
                rotulo: idx.get(i)?.sigla ?? tx(`distribuidora ${i}`, `utility ${i}`),
                cor: `color-mix(in srgb, ${CORES_COMP[k % 4]} 45%, var(--cor-superficie))`,
                contagem: conta.get(i) ?? 0,
              })),
              { id: "varias", rotulo: tx("Em mais de uma dessas áreas", "In more than one of these areas"), cor: "var(--cor-mineral)", contagem: varias },
              { id: "fora", rotulo: tx("Fora dessas áreas", "Outside these areas"), cor: COR_FORA_DA_AREA },
            ]}
          />
        );
      } else {
        const conta: Record<SituacaoVinculo, number> = { exclusiva: 0, compartilhado: 0, so_sem_confirmacao: 0, sem_vinculo: 0 };
        fills = geoMun.features.map((f) => {
          const m = porIbge.get(f.id);
          if (!m) return "sem-dado";
          const s = situacaoVinculo(m);
          conta[s]++;
          return CORES_SITUACAO[s];
        });
        legenda = (
          <Legenda
            titulo={tx("Quantas distribuidoras atendem cada município (relação oficial)", "How many distribution utilities serve each municipality (official list)")}
            itens={(Object.keys(ROTULO_SITUACAO) as SituacaoVinculo[]).map((s) => ({ id: s, rotulo: ROTULO_SITUACAO[s], cor: CORES_SITUACAO[s], contagem: conta[s] }))}
            nota={tx(
              "Escolha uma distribuidora pela busca, pela tabela de distribuidoras ou pela ficha de um município para acender a área dela.",
              "Choose a distribution utility through the search, the utilities table or a municipality's sheet to highlight its area.",
            )}
          />
        );
      }
      return {
        ...vazio,
        geo: geoMun,
        fills,
        contornos: true,
        rotulos: true,
        destaques: destaquesBase(),
        foco: centro(corr.municipio ? featMun.get(corr.municipio) : undefined),
        titulo: tx("Áreas das distribuidoras: municípios inteiros da relação oficial da ANEEL", "Distribution utility areas: whole municipalities from ANEEL's official list"),
        descricao: tx(
          `Mapa dos ${inteiro(geoMun.features.length)} municípios do IBGE pintados pela distribuidora que os atende. A tabela abaixo do mapa traz os mesmos municípios.`,
          `Map of the ${inteiro(geoMun.features.length, idioma)} IBGE municipalities colored by the distribution utility serving them. The table below the map shows the same municipalities.`,
        ),
        legenda,
        clique: ({ id }) => id && /^\d{7}$/.test(id) && selecionar(sel?.tipo === "mun" && sel.id === id ? null : { tipo: "mun", id }),
        dica: (id) => {
          const m = porIbge.get(id);
          return m ? { titulo: `${m.nome} · ${m.uf}`, linhas: [textoDistribuidoras(m, idx, idioma), ROTULO_SITUACAO[situacaoVinculo(m)]] } : null;
        },
      };
    }

    // camada municipal: a medida escolhida
    const med = v.med;
    const def = MEDIDA[med];
    const valores = valoresMedida(linhasMun, med);
    const classes = classificacaoMedida(
      med,
      geoMun.features.map((f) => valores[f.id] as ValorClassificavel),
      idioma,
    );
    const cores = coresParaClasses(CORES_SEQUENCIAIS, classes.classes.length);
    const fills = geoMun.features.map((f) => preenchimento(valores[f.id], classes, { classes: cores, semDado: "sem-dado", naoSeAplica: COR_NAO_SE_APLICA }));
    const destaques = destaquesBase();
    if (corr.municipios === "area" && corr.dist !== null) {
      for (const m of municipios) if (estadoNaDistribuidora(m, corr.dist) !== null) {
        const f = featMun.get(m.ibge);
        if (f) destaques.push({ id: `area-${m.ibge}`, d: f.d, estilo: "area" });
      }
    }
    if (corr.municipios === "declarados" && selUsi) {
      for (const ibge of selUsi.municipios) {
        const f = featMun.get(ibge);
        if (f) destaques.push({ id: `usi-${ibge}`, d: f.d, estilo: "selecao" });
      }
    }
    return {
      ...vazio,
      geo: geoMun,
      fills,
      contornos: true,
      rotulos: true,
      destaques,
      foco: centro(corr.municipio ? featMun.get(corr.municipio) : undefined),
      titulo: tx(`${def.rotulo} por município (${def.unidade})`, `${def.rotulo} by municipality (${def.unidade})`),
      descricao: tx(
        `Mapa dos ${inteiro(geoMun.features.length)} municípios do IBGE pela medida ${def.rotulo}, em ${def.unidade}: ${inteiro(classes.validos)} com valor e ${inteiro(classes.semDado)} sem dado. A tabela abaixo do mapa traz os mesmos números.`,
        `Map of the ${inteiro(geoMun.features.length, idioma)} IBGE municipalities by the measure ${def.rotulo}, in ${def.unidade}: ${inteiro(classes.validos, idioma)} with a value and ${inteiro(classes.semDado, idioma)} with no data. The table below the map shows the same figures.`,
      ),
      legenda: (
        <Legenda
          titulo={tx(`Classes em ${def.unidade}`, `Classes in ${def.unidade}`)}
          itens={[
            ...classes.classes.map((c, i) => ({ id: String(i), rotulo: c.rotulo, cor: cores[i], contagem: c.contagem })),
            { id: "sem", rotulo: tx("sem dado", "no data"), cor: "sem-dado", contagem: classes.semDado }, // i18n: dado
          ]}
          nota={tx(
            `${ROTULO_METODO[classes.metodo]}. Cada classe inclui o limite inferior; zero é valor e fica na primeira classe. ${def.nota ?? ""}`,
            `${ROTULO_METODO[classes.metodo]}. Each class includes its lower bound; zero is a value and falls in the first class. ${def.nota ?? ""}`,
          )}
        />
      ),
      clique: ({ id }) => id && /^\d{7}$/.test(id) && selecionar(sel?.tipo === "mun" && sel.id === id ? null : { tipo: "mun", id }),
      dica: (id) => {
        const m = porIbge.get(id);
        if (!m) return null;
        const d = descreveRegiao(valores[id], classes, def.casas, def.unidade, idioma);
        return { titulo: `${m.nome} · ${m.uf}`, linhas: [d.valor, d.classe ? tx(`classe ${d.classe}`, `class ${d.classe}`) : ""].filter(Boolean) };
      },
    };
  })();

  /* ---------------------------------------------------------------- comparação */

  const entidadesCmp = useMemo(() => (municipios ?? []).map((m) => ({ id: m.ibge, rotulo: m.nome, detalhe: m.uf, sinonimos: [m.ibge] })), [municipios]);
  const cmp = v.cmp.flatMap((id) => porIbge.get(id) ?? []);

  /* ---------------------------------------------------------------- ficha */

  const rotuloSel = selMun ? `${selMun.nome} (${selMun.uf})` : selDist ? selDist.sigla : selUf ? (selUf.nome ?? selUf.uf) : selSm ? selSm.nome : selUsi ? selUsi.nome : null;
  const acaoLimpar = sel ? (
    <button type="button" onClick={limpar} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao" data-limpar-escolha="">
      {tx("Limpar a escolha", "Clear the choice")}
    </button>
  ) : undefined;

  let ficha: ReactNode;
  if (sel?.tipo === "mun") {
    ficha = selMun ? (
      <FichaMunicipio
        m={selMun}
        dados={dados}
        idx={idx}
        conjuntos={indice ? conjuntosDoMunicipio(selMun, indice.conjuntos.linhas, idx, idioma) : []}
        submercado={selMun.sm && selMun.sm_estado !== "fora_do_sin" ? smPorId.get(selMun.sm) ?? null : null}
        uf={ufPorSigla.get(selMun.uf) ?? null}
        onSelecionar={selecionar}
        onVerUsinas={verUsinas}
        acao={acaoLimpar}
      />
    ) : cIndice.estado === "erro" ? (
      <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome={tx("o índice municipal", "the municipal index")} repetir={repetirIndice} />
    ) : municipios ? (
      <Estado alerta>{tx(`O código IBGE ${sel.id} não está no índice municipal publicado.`, `The IBGE code ${sel.id} is not in the published municipal index.`)}</Estado>
    ) : (
      <Estado>{tx("Carregando o índice dos municípios para a ficha…", "Loading the municipal index for the sheet…")}</Estado>
    );
  } else if (sel?.tipo === "dist") {
    ficha = selDist ? (
      <FichaDistribuidora d={selDist} dados={dados} onSelecionar={selecionar} acao={acaoLimpar} />
    ) : (
      <Estado alerta>{tx(`O CNPJ ${sel.id} não tem município na relação oficial vigente.`, `The CNPJ ${sel.id} has no municipality in the official list in force.`)}</Estado>
    );
  } else if (sel?.tipo === "uf") {
    ficha = selUf ? (
      <FichaUf u={selUf} s={selUf.subsistema ? smPorId.get(selUf.subsistema) ?? null : null} dados={dados} onSelecionar={selecionar} acao={acaoLimpar} />
    ) : (
      <Estado alerta>{tx(`UF ${sel.id} desconhecida.`, `Unknown state ${sel.id}.`)}</Estado>
    );
  } else if (sel?.tipo === "sm") {
    ficha = selSm ? <FichaSubmercado s={selSm} dados={dados} onSelecionar={selecionar} acao={acaoLimpar} /> : <Estado alerta>{tx("Submercado desconhecido.", "Unknown submarket.")}</Estado>;
  } else if (sel?.tipo === "usi") {
    ficha = selUsi ? (
      <FichaUsina u={selUsi} dados={dados} nomeMunicipio={nomeMunicipio} onSelecionar={selecionar} acao={acaoLimpar} />
    ) : cUsinas.estado === "erro" ? (
      <Falha erro={cUsinas.erro} arquivo={dados.arquivos.usinas} nome={tx("as usinas", "the plants")} repetir={repetirUsinas} />
    ) : usinas ? (
      <Estado alerta>{tx(`A usina ${sel.id} não está no arquivo publicado.`, `The plant ${sel.id} is not in the published file.`)}</Estado>
    ) : (
      <Estado>{tx("Carregando as usinas para a ficha…", "Loading the plants for the sheet…")}</Estado>
    );
  } else {
    const c = dados.camadas.find((x) => x.id === (cam === "usinas" ? "usinas" : cam));
    ficha = (
      <div className="space-y-2 text-sm text-carvao-muted">
        <p className="rotulo text-mineral">{tx("Nenhuma escolha", "No choice")}</p>
        <p className="text-carvao">
          {tx(
            "Busque o seu município acima, toque no mapa ou escolha uma linha da tabela. A ficha diz de quem é cada número.",
            "Search for your municipality above, tap the map or choose a table row. The sheet says whose each figure is.",
          )}
        </p>
        {c && <p>{descricaoCamada(c.descricao)}</p>}
      </div>
    );
  }

  const prox = proximaPergunta(cam);

  const fichaPronta = Boolean(selMun || selDist || selUf || selSm || selUsi);
  useEffect(() => {
    if (pedidoFoco === 0 || !fichaPronta) return;
    // um instante depois do gesto: no toque, o navegador entrega o mousedown de compatibilidade depois do pointerup que escolheu a região e leva o
    // foco para o <main>; o foco do título da ficha só vale se vier depois dele
    const espera = window.setTimeout(() => {
      const caixa = fichaRef.current;
      const titulo = caixa?.querySelector<HTMLElement>("[data-foco-ficha]");
      if (!caixa || !titulo) return;
      titulo.focus({ preventScroll: true });
      const r = caixa.getBoundingClientRect();
      const fora = r.top > window.innerHeight * 0.85 || r.bottom < 0;
      if (fora) caixa.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 120);
    return () => window.clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoFoco, fichaPronta]);

  /* ---------------------------------------------------------------- render */

  return (
    <div className="space-y-6">
      {/* busca e camada */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Busca
            entidades={entidades}
            carregando={querIndice && !municipios && cIndice.estado !== "erro"}
            onFoco={() => setPedidoIndice(true)}
            onEscolher={(e) => {
              const s = selecaoDeId(e.id);
              if (s) selecionar(s);
            }}
            campoRef={campoBusca}
            reinicio={reinicioBusca}
            consultaDaUrl={buscaDaUrl}
          />
          {sel && rotuloSel && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0 text-sm" data-escolha="">
              <span className="border border-energia bg-energia-fundo px-2 py-0.5 text-carvao">
                {tx("Escolhido: ", "Chosen: ")}
                {selSm ? rotuloSel : <Nome>{rotuloSel}</Nome>}
              </span>
              {acaoLimpar}
            </p>
          )}
        </div>
        <fieldset className="min-w-0">
          <legend className="rotulo mb-1 text-mineral">{tx("Camada do mapa", "Map layer")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {CAMADAS.map((c) => (
              <label
                key={c}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${cam === c ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}
              >
                <input type="radio" name="territorio-camada" value={c} checked={cam === c} onChange={() => definir({ cam: c as Camada })} className="accent-[var(--cor-energia)]" />
                {ROTULO_CAMADA[c]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* opções da camada */}
      {cam === "municipio" && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Medida do mapa municipal", "Municipal map measure")}</span>
          <select value={v.med} onChange={(e) => definir({ med: e.target.value as MedidaMunicipio })} className="h-11 min-w-0 max-w-full border border-linha bg-superficie px-2 text-sm text-carvao">
            {MEDIDAS_MUNICIPIO.map((m) => (
              <option key={m} value={m}>
                {MEDIDA[m].rotulo} ({MEDIDA[m].unidade})
              </option>
            ))}
          </select>
        </label>
      )}
      {cam === "usinas" && (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          <fieldset className="min-w-0">
            <legend className="rotulo mb-1 text-mineral">{tx("Fontes", "Sources")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {FONTES_USINA.map((f) => (
                <label key={f} className="inline-flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 text-sm text-carvao">
                  <input
                    type="checkbox"
                    checked={v.fon.includes(f)}
                    onChange={() => definir({ fon: v.fon.includes(f) ? v.fon.filter((x) => x !== f) : FONTES_USINA.filter((x) => x === f || v.fon.includes(x)) })}
                  />
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COR_FONTE[f] }} />
                  {ROTULO_FONTE[f]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="rotulo mb-1 text-mineral">{tx("Estágios", "Stages")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {ESTAGIOS_USINA.map((e) => (
                <label key={e} className="inline-flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 text-sm text-carvao">
                  <input
                    type="checkbox"
                    checked={v.est.includes(e)}
                    onChange={() => definir({ est: v.est.includes(e) ? v.est.filter((x) => x !== e) : ESTAGIOS_USINA.filter((x) => x === e || v.est.includes(x)) })}
                  />
                  {ROTULO_ESTAGIO[e]}
                </label>
              ))}
              <label className="inline-flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 text-sm text-carvao">
                <input type="checkbox" checked={v.reg} onChange={() => definir({ reg: !v.reg })} />
                {tx("Incluir registros de até 10 kW", "Include registrations of up to 10 kW")}
              </label>
            </div>
          </fieldset>
        </div>
      )}

      {/* mapa e ficha */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          {montagem.legenda}
          {montagem.falha}
          {!montagem.falha && montagem.geo ? (
            <TerritorioMapa
              titulo={montagem.titulo}
              descricao={montagem.descricao}
              geo={montagem.geo}
              fills={montagem.fills}
              contornos={montagem.contornosUf ? contornosUf : montagem.contornos ? montagem.geo.contornos?.uf ?? null : null}
              rotulos={montagem.rotulos ? rotulosUf : []}
              sobreposicoes={montagem.sobreposicoes}
              destaques={montagem.destaques}
              pontos={montagem.pontos}
              pontoSelecionado={montagem.pontoSelecionado}
              foco={montagem.foco}
              onClique={montagem.clique}
              dica={montagem.dica}
              ajuda={
                <p>
                  {tx(
                    <>
                      Malha territorial do IBGE{montagem.geo.malha.revisao ? `, revisão de ${montagem.geo.malha.revisao}` : ""} (qualidade {textoQualidadeMalha(montagem.geo.malha.qualidade, idioma)}), em projeção de áreas
                      iguais. Pelo teclado, use a busca acima e a tabela abaixo.
                    </>,
                    <>
                      IBGE territorial map{montagem.geo.malha.revisao ? `, revision of ${montagem.geo.malha.revisao}` : ""} ({textoQualidadeMalha(montagem.geo.malha.qualidade, idioma)} quality), in an equal-area
                      projection. With the keyboard, use the search above and the table below.
                    </>,
                  )}
                </p>
              }
            />
          ) : (
            !montagem.falha && (
              <div className="flex h-[380px] items-center justify-center border border-linha bg-papel px-6 text-center sm:h-[540px]">
                <p role="status" className="text-sm text-carvao-muted">
                  {montagem.carregando ?? tx("Preparando o mapa…", "Preparing the map…")}
                </p>
              </div>
            )
          )}
          {cam === "submercado" && !(geoMun && municipios) && cMalha.estado !== "carregando" && (
            <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3 text-sm text-carvao-muted">
              <p className="min-w-0 flex-[1_1_16rem]">
                {tx(
                  `${inteiro(dados.estadosMunicipio.fora_do_sin ?? 0)} municípios estão fora do SIN e outros ${inteiro(dados.estadosMunicipio.com_localidade_isolada ?? 0)} têm localidade isolada, mas ficam dentro do SIN. Para vê-los no mapa, a página carrega os municípios.`,
                  `${inteiro(dados.estadosMunicipio.fora_do_sin ?? 0, idioma)} municipalities are outside the SIN and another ${inteiro(dados.estadosMunicipio.com_localidade_isolada ?? 0, idioma)} have an isolated locality but remain inside the SIN. To see them on the map, the page loads the municipalities.`,
                )}
              </p>
              <button type="button" onClick={() => setPedidoMalha(true)} className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo">
                {tx("Mostrar os municípios fora do SIN", "Show the municipalities outside the SIN")}
              </button>
            </div>
          )}
          {corr.texto && (
            <div role="status" className="flex flex-wrap items-start gap-x-3 gap-y-1 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao" data-correspondencia={corr.valida ? (corr.aviso ? "aviso" : "valida") : "nao-passa"}>
              <span className="rotulo shrink-0">
                {corr.valida
                  ? corr.aviso
                    ? tx("Nesta camada, com ressalva", "In this layer, with a caveat")
                    : tx("Nesta camada", "In this layer")
                  : tx("A escolha não passa para esta camada", "The choice does not carry over to this layer")}
              </span>
              <span className="min-w-0 flex-[1_1_16rem]">{corr.texto}</span>
            </div>
          )}
          {corr.candidatas.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 text-sm" aria-label={tx("Distribuidoras do município escolhido", "Distribution utilities of the chosen municipality")}>
              {corr.candidatas.map((i) => {
                const d = idx.get(i);
                return d ? (
                  <li key={i}>
                    <button type="button" onClick={() => selecionar({ tipo: "dist", id: d.id })} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {tx(`Ver a área de ${d.sigla}`, `See the area of ${d.sigla}`)}
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
        <aside ref={fichaRef} aria-label={tx("Ficha da escolha", "Sheet of the choice")} className="min-w-0 scroll-mt-24 border border-linha bg-superficie p-4" data-ficha={sel ? sel.tipo : "nenhuma"}>
          {ficha}
        </aside>
      </div>

      {/* tabela equivalente da camada */}
      <Secao titulo={tx(`Tabela equivalente do mapa: ${ROTULO_CAMADA[cam].toLowerCase()}`, `Table equivalent to the map: ${ROTULO_CAMADA[cam].toLowerCase()}`)} id="territorio-tabela">
        {cam === "submercado" && (
          <>
            <TabelaInterativa
              titulo={tx("Submercado de cada UF (as UFs que o mapa pinta)", "Submarket of each state (the states the map colors)")}
              colunas={colunasUfsSubmercado(idioma)}
              linhas={dados.ufs}
              chaveLinha="id"
              colunaRotulo="uf"
              fonte={tx("EPE, WebMap (camada 24); ONS, Carga de Energia Verificada por área de carga", "EPE, WebMap (layer 24); ONS, Verified Energy Load by load area")}
              versao={dados.versao}
              nomeArquivo="territorio-ufs-submercado"
              chaveUrl="ter.uf"
              ordemInicial={{ coluna: "uf", direcao: "asc" }}
              selecionado={idSel("uf")}
              onSelecionar={(id) => selecionar(id ? { tipo: "uf", id } : null)}
              dicaBusca={tx("UF ou submercado", "State or submarket")}
            />
            {linhasMun && (
              <TabelaInterativa
                titulo={tx("Municípios com localidade isolada (marcas por cima da cor da UF)", "Municipalities with an isolated locality (marks on top of the state color)")}
                colunas={colunasIsolados(idioma)}
                linhas={linhasMun.filter((l) => l.isol_n > 0)}
                chaveLinha="id"
                colunaRotulo="municipio"
                fonte={tx("EPE, PASI (ciclo 2025), pelo módulo Inclusão; IBGE, estimativa de população", "EPE, PASI (2025 cycle), through the Inclusion module; IBGE, population estimate")}
                versao={dados.versao}
                nomeArquivo="territorio-municipios-isolados"
                chaveUrl="ter.isol"
                ordemInicial={{ coluna: "isol_pop", direcao: "desc" }}
                selecionado={idSel("mun")}
                onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
                dicaBusca={tx("Município ou UF", "Municipality or state")}
              />
            )}
          </>
        )}
        {cam === "distribuidora" &&
          (linhasMun ? (
            <TabelaInterativa
              titulo={tx("Distribuidoras de cada município (os municípios que o mapa pinta)", "Distribution utilities of each municipality (the municipalities the map colors)")}
              colunas={colunasVinculo(idioma)}
              linhas={linhasMun}
              chaveLinha="id"
              colunaRotulo="municipio"
              fonte={tx(
                "ANEEL, relação conjunto × município (IndQual e limites de continuidade), pelo módulo Perdas",
                "ANEEL, consumer set × municipality list (IndQual and continuity limits), through the Losses module",
              )}
              versao={dados.versao}
              nomeArquivo="territorio-municipios-distribuidoras"
              chaveUrl="ter.vinc"
              ordemInicial={{ coluna: "municipio", direcao: "asc" }}
              selecionado={idSel("mun")}
              onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
              dicaBusca={tx("Município, UF, código IBGE ou sigla da distribuidora", "Municipality, state, IBGE code or utility acronym")}
            />
          ) : (
            <Estado>{tx("A tabela dos municípios aparece com o índice municipal.", "The municipalities table appears with the municipal index.")}</Estado>
          ))}
        {cam === "municipio" &&
          (linhasMun ? (
            <TabelaInterativa
              titulo={tx("Indicadores publicados por município (só valores do município)", "Indicators published by municipality (only the municipality's values)")}
              colunas={colunasMunicipios(v.med, idioma)}
              linhas={linhasMun}
              chaveLinha="id"
              colunaRotulo="municipio"
              fonte={tx(
                "ANEEL (MMGD, SIGA), ANEEL e MDS (Tarifa Social), MME (Luz para Todos), EPE (PASI), IBGE (população), pelos módulos de origem",
                "ANEEL (MMGD, SIGA), ANEEL and MDS (Social Tariff), MME (Luz para Todos), EPE (PASI), IBGE (population), through the source modules",
              )}
              versao={dados.versao}
              nomeArquivo="territorio-municipios"
              chaveUrl="ter.mun"
              ordemInicial={{ coluna: v.med, direcao: "desc" }}
              selecionado={idSel("mun")}
              onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
              dicaBusca={tx("Município, UF ou código IBGE", "Municipality, state or IBGE code")}
              nota={tx(
                "Nenhuma coluna desta tabela é valor de distribuidora, conjunto, submercado ou UF: esses ficam nas tabelas de cada tipo de área.",
                "No column in this table is a value of a distribution utility, consumer set, submarket or state: those are in the tables for each type of area.",
              )}
            />
          ) : (
            <Estado>{tx("A tabela dos municípios aparece com o índice municipal.", "The municipalities table appears with the municipal index.")}</Estado>
          ))}
        {cam === "usinas" &&
          (linhasUsinas ? (
            <TabelaInterativa
              titulo={tx("Usinas desenhadas no mapa (mesmo filtro de fontes, estágios e registros)", "Plants drawn on the map (same filter of sources, stages and registrations)")}
              colunas={colunasUsinas(idioma)}
              linhas={linhasUsinas}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte={tx("ANEEL, SIGA, pelo módulo Expansão", "ANEEL, SIGA, through the Expansion module")}
              versao={dados.versao}
              nomeArquivo="territorio-usinas"
              chaveUrl="ter.usi"
              ordemInicial={{ coluna: "mw_fiscalizado", direcao: "desc" }}
              selecionado={idSel("usi")}
              onSelecionar={(id) => selecionar(id ? { tipo: "usi", id } : null)}
              dicaBusca={tx("Nome, CEG, tipo, UF ou município", "Name, CEG, type, state or municipality")}
              nota={tx(
                "Usina declarada em mais de um município aparece uma vez, com os municípios listados; a potência não é repartida.",
                "A plant declared in more than one municipality appears once, with the municipalities listed; the capacity is not split.",
              )}
            />
          ) : (
            <Estado>{tx("A tabela das usinas aparece com o arquivo das usinas.", "The plants table appears with the plants file.")}</Estado>
          ))}
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">{tx("Próxima pergunta desta camada", "Next question for this layer")}</span>
          <a href={prox.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {prox.pergunta}
          </a>
        </p>
      </Secao>

      {/* tabelas por grão */}
      <Secao titulo={tx("Tabelas por tipo de área: cada número na tabela da sua área", "Tables by type of area: each figure in its area's table")} nivel="analisar" id="territorio-graos">
        <TabelaInterativa
          titulo={tx("Submercados: preço, armazenamento e MMGD estimada (valores do submercado inteiro)", "Submarkets: price, storage and estimated MMGD (values for the whole submarket)")}
          colunas={colunasSubmercados(dados.submercados.find((x) => x.mmgd_ons_ref)?.mmgd_ons_ref ?? null, idioma)}
          linhas={dados.submercados}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={tx("CCEE, PLD horário (pelo módulo PLD); ONS, EAR diário e carga verificada", "CCEE, hourly PLD (through the PLD module); ONS, daily EAR and verified load")}
          versao={dados.versao}
          nomeArquivo="territorio-submercados"
          chaveUrl="ter.sm"
          selecionado={idSel("sm")}
          onSelecionar={(id) => selecionar(id ? { tipo: "sm", id } : null)}
          dicaBusca={tx("Submercado ou UF", "Submarket or state")}
        />
        <TabelaInterativa
          titulo={tx("UFs: capacidade, Tarifa Social e sistemas isolados (valores da UF inteira)", "States: capacity, Social Tariff and isolated systems (values for the whole state)")}
          colunas={colunasUfsIndicadores(idioma)}
          linhas={dados.ufs}
          chaveLinha="id"
          colunaRotulo="uf"
          fonte={tx(
            "ANEEL, SIGA (pelo módulo Expansão); ANEEL, Beneficiários da CDE (pelo módulo Inclusão); EPE, PASI",
            "ANEEL, SIGA (through the Expansion module); ANEEL, CDE beneficiaries (through the Inclusion module); EPE, PASI",
          )}
          versao={dados.versao}
          nomeArquivo="territorio-ufs"
          chaveUrl="ter.ufi"
          nota={tx(
            <>
              Usinas em operação contadas na UF principal, sem os registros de até {num(dados.limiteRegistroKw, 0)} kW, que o município também deixa fora da contagem de usinas e que têm coluna própria; a capacidade em MW
              soma todas. {dados.notaMultiestadual} Desconto líquido: soma dos descontos do mês com os cancelamentos e refaturamentos, que entram no desconto e não na contagem de faturas; um mês pode fechar negativo.
            </>,
            <>
              Plants in operation counted in the main state, without the registrations of up to {num(dados.limiteRegistroKw, 0, idioma)} kW, which the municipality also leaves out of the plant count and which have
              their own column; the capacity in MW adds up all of them. {dados.notaMultiestadual} Net discount: sum of the month&apos;s discounts with cancellations and rebillings, which enter the discount and not
              the count of bills; a month can close negative.
            </>,
          )}
          ordemInicial={{ coluna: "cap_mw", direcao: "desc" }}
          selecionado={idSel("uf")}
          onSelecionar={(id) => selecionar(id ? { tipo: "uf", id } : null)}
          dicaBusca={tx("UF ou submercado", "State or submarket")}
        />
        <TabelaInterativa
          titulo={tx("Distribuidoras: área e indicadores da área inteira", "Distribution utilities: area and indicators for the whole area")}
          colunas={colunasDistribuidoras(idioma)}
          linhas={dados.distribuidoras}
          chaveLinha="id"
          colunaRotulo="sigla"
          fonte={tx(
            "ANEEL (relação de conjuntos, SAMP, Indicadores de Continuidade, Tarifas, MMGD, SCS), pelos módulos de origem",
            "ANEEL (consumer set list, SAMP, Continuity Indicators, Tariffs, MMGD, SCS), through the source modules",
          )}
          versao={dados.versao}
          nomeArquivo="territorio-distribuidoras"
          chaveUrl="ter.dist"
          ordemInicial={{ coluna: "municipios", direcao: "desc" }}
          selecionado={idSel("dist")}
          onSelecionar={(id) => selecionar(id ? { tipo: "dist", id } : null)}
          dicaBusca={tx("Sigla, razão social, CNPJ ou UF", "Acronym, corporate name, CNPJ or state")}
          nota={tx(
            `Valores da área inteira: não descrevem um município. Taxa de perdas de ano parcial não é comparável à de ano completo; taxa negativa está como o SAMP publica (ressalva na ficha). ${textoSemTarifa(dados.distribuidoras) ?? ""}`,
            `Values for the whole area: they do not describe a municipality. A loss rate for a partial year is not comparable to a full year's; a negative rate is as SAMP publishes it (caveat in the sheet). ${textoSemTarifa(dados.distribuidoras, idioma) ?? ""}`,
          )}
        />
      </Secao>

      {/* comparação */}
      <Secao titulo={tx("Comparar até quatro municípios", "Compare up to four municipalities")} nivel="analisar" id="territorio-comparar">
        {!municipios ? (
          cIndice.estado === "erro" ? (
            <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome={tx("o índice municipal", "the municipal index")} repetir={repetirIndice} />
          ) : (
            <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
              <p className="min-w-0 flex-[1_1_16rem] text-sm text-carvao-muted">
                {tx("A comparação lê o índice municipal, carregado só quando pedido.", "The comparison reads the municipal index, loaded only on request.")}
              </p>
              <button type="button" onClick={() => setPedidoIndice(true)} className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-sm text-carvao hover:bg-energia-fundo">
                {cIndice.estado === "carregando" ? tx("Carregando…", "Loading…") : tx("Carregar os municípios", "Load the municipalities")}
              </button>
            </div>
          )
        ) : (
          <>
            <Comparador
              rotulo={tx(`Municípios para comparar (até ${LIMITE_COMPARACAO})`, `Municipalities to compare (up to ${LIMITE_COMPARACAO})`)}
              entidades={entidadesCmp}
              selecionadas={v.cmp}
              onMudar={(ids) => definir({ cmp: ids })}
              dicaBusca={tx("Nome do município ou código IBGE", "Municipality name or IBGE code")}
              vazio={tx("Nenhum município escolhido. Escolha aqui ou pelo botão da ficha.", "No municipality chosen. Choose here or with the sheet's button.")}
            >
              {() => null}
            </Comparador>
            {selMun && !v.cmp.includes(selMun.ibge) && (
              <button
                type="button"
                onClick={() => {
                  const r = alternarSelecao(v.cmp, selMun.ibge, LIMITE_COMPARACAO);
                  if (r.motivo === "limite")
                    setAvisoCmp(tx(`Limite de ${LIMITE_COMPARACAO} municípios: remova um para incluir ${selMun.nome}.`, `Limit of ${LIMITE_COMPARACAO} municipalities: remove one to include ${selMun.nome}.`));
                  else {
                    setAvisoCmp("");
                    definir({ cmp: r.ids });
                  }
                }}
                className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-sm text-carvao hover:bg-energia-fundo"
              >
                {tx(
                  <>Incluir {selMun.nome} na comparação</>,
                  <>
                    Include <Nome>{selMun.nome}</Nome> in the comparison
                  </>,
                )}
              </button>
            )}
            {avisoCmp && <p role="status" className="text-sm text-carvao">{avisoCmp}</p>}
            {cmp.length > 0 && <TabelaComparacao municipios={cmp} linhas={linhasMun ?? []} />}
          </>
        )}
      </Secao>
    </div>
  );
}

/** Lado a lado, só valores do município; distribuidora e submercado aparecem como referência, sem número de outro grão. */
function TabelaComparacao({ municipios, linhas }: { municipios: MunicipioT[]; linhas: LinhaMunicipio[] }) {
  const tx = useTx();
  const idioma = useIdioma();
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const cols = municipios.map((m) => porId.get(m.ibge)!).filter(Boolean);
  const sd = tx("sem dado", "no data");
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const LINHAS: { rotulo: string; v: (l: LinhaMunicipio) => string }[] = [
    { rotulo: tx("População estimada", "Estimated population"), v: (l) => n(l.populacao) },
    { rotulo: tx("Unidades de MMGD", "MMGD units"), v: (l) => n(l.mmgd_un) },
    { rotulo: tx("Potência de MMGD (kW)", "MMGD capacity (kW)"), v: (l) => (l.mmgd_kw === null ? sd : num(l.mmgd_kw, 0, idioma)) },
    { rotulo: tx("MMGD por habitante (W)", "MMGD per inhabitant (W)"), v: (l) => (l.mmgd_w_hab === null ? sd : num(l.mmgd_w_hab, 1, idioma)) },
    { rotulo: tx("Faturas com Tarifa Social", "Bills with the Social Tariff"), v: (l) => n(l.tsee_faturas) },
    { rotulo: tx("Tarifa Social por família do CadÚnico (proxy, %)", "Social Tariff per CadÚnico family (proxy, %)"), v: (l) => (l.tsee_proxy_pct === null ? sd : num(l.tsee_proxy_pct, 1, idioma)) },
    { rotulo: tx("Luz para Todos (domicílios)", "Luz para Todos (households)"), v: (l) => n(l.lpt_dom) },
    { rotulo: tx("Usinas em operação só no município", "Plants in operation only in the municipality"), v: (l) => `${n(l.usi_op_n)} (${num(l.usi_op_mw, 1, idioma)} MW)` },
    { rotulo: tx("Registros de até 10 kW", "Registrations of up to 10 kW"), v: (l) => n(l.usi_reg_n) },
    { rotulo: tx("Localidades isoladas", "Isolated localities"), v: (l) => n(l.isol_n) },
    { rotulo: tx("Distribuidoras (referência, sem valor)", "Distribution utilities (reference, no value)"), v: (l) => l.distribuidoras },
    { rotulo: tx("Submercado (referência, sem valor)", "Submarket (reference, no value)"), v: (l) => l.submercado },
  ];
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Comparação de municípios (tabela rolável)", "Comparison of municipalities (scrollable table)")}>
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums" data-comparacao={cols.length}>
        <caption className="pb-2 text-left text-sm font-medium text-carvao">
          {tx("Municípios lado a lado: valores do próprio município", "Municipalities side by side: the municipality's own values")}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
              {tx("Indicador", "Indicator")}
            </th>
            {cols.map((l) => (
              <th key={l.id} scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium text-carvao">
                <Nome>{l.municipio}</Nome> ({l.uf})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS.map((r) => (
            <tr key={r.rotulo} className="border-b border-linha last:border-b-0">
              <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                {r.rotulo}
              </th>
              {cols.map((l) => (
                <td key={l.id} className="px-2 py-1.5 text-right text-carvao">
                  {r.v(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-carvao-muted">
        {tx(
          "Distribuidora e submercado entram como referência: os valores deles são da área inteira e do submercado inteiro, e ficam na ficha e nas tabelas de cada tipo de área.",
          "Distribution utility and submarket are included as reference: their values are for the whole area and the whole submarket, and are in the sheet and in the tables for each type of area.",
        )}
      </p>
    </div>
  );
}
