"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { FichaDistribuidora, FichaMunicipio, FichaSubmercado, FichaUf, FichaUsina } from "@/components/energia/TerritorioFicha";
import { TerritorioMapa, type DicaMapa, type GrupoPontosMapa, type PoligonoDestaque, type SobreposicaoMapa } from "@/components/energia/TerritorioMapa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ROTULO_METODO, type ValorClassificavel } from "@/lib/energia/escalas";
import { dataBR, num } from "@/lib/energia/formato";
import { pontoRotulo, validaCamada, type CamadaGeo, type FeatureGeo, type Ponto } from "@/lib/energia/geo";
import { coresParaClasses, descreveRegiao, moverNaLista, preenchimento } from "@/lib/energia/mapa-coropletico";
import { LIMITE_COMPARACAO, alternarSelecao, buscarEntidades } from "@/lib/energia/tabela";
import {
  CAMADAS,
  COLUNAS_DISTRIBUIDORAS,
  COLUNAS_ISOLADOS,
  COLUNAS_SUBMERCADOS,
  COLUNAS_UFS_INDICADORES,
  COLUNAS_UFS_SUBMERCADO,
  COLUNAS_USINAS,
  COLUNAS_VINCULO,
  CORES_SEQUENCIAIS,
  COR_FONTE,
  ESQUEMA_TERRITORIO,
  ESTAGIOS_USINA,
  FONTES_USINA,
  MEDIDA,
  MEDIDAS_MUNICIPIO,
  NOME_SUBMERCADO,
  ROTULO_CAMADA,
  ROTULO_ESTADO_SM,
  ROTULO_ESTAGIO,
  ROTULO_FONTE,
  ROTULO_SITUACAO,
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
  potenciaUsina,
  descricaoCamada,
  proximaPergunta,
  selecaoDeId,
  situacaoVinculo,
  textoDistribuidoras,
  textoQualidadeMalha,
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
const COR_VINCULO = { 1: "var(--cor-energia)", 2: "var(--escala-seq-3)", 0: "var(--escala-seq-2)" } as const;
const COR_FORA_DA_AREA = "var(--escala-div-centro)";
const COR_NAO_SE_APLICA = "var(--mapa-nao-se-aplica)";
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const CLASSES_POTENCIA = [
  { ate: 1, espessura: 4, rotulo: "menos de 1 MW" },
  { ate: 100, espessura: 6, rotulo: "1 a menos de 100 MW" },
  { ate: Infinity, espessura: 9, rotulo: "100 MW ou mais" },
];
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
  return (
    <div>
      <p className="rotulo text-mineral">{titulo}</p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-carvao-muted" aria-label={`Legenda: ${titulo}`}>
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-1.5">
            <Amostra item={i} />
            {i.rotulo}
            {i.contagem !== undefined && i.contagem !== null && <span className="tabular-nums">({num(i.contagem, 0)})</span>}
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
  return (
    <div role="alert" className="space-y-2 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
      <p>
        Não foi possível carregar {nome} ({erro}). Os mesmos dados estão em{" "}
        <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
          {arquivo.split("/").at(-1)}
        </a>
        .
      </p>
      <button type="button" onClick={repetir} className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia">
        Tentar de novo
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

function Busca({ entidades, carregando, onFoco, onEscolher }: { entidades: EntidadeTerritorio[]; carregando: boolean; onFoco: () => void; onEscolher: (e: EntidadeTerritorio) => void }) {
  const uid = useId().replace(/:/g, "");
  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const res = useMemo(() => (consulta.trim() ? buscarEntidades(entidades, consulta, 30) : { itens: [], total: 0 }), [entidades, consulta]);
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
        Encontre a sua região
      </label>
      <input
        id={`${uid}-busca`}
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
        placeholder="Município, distribuidora, UF ou submercado"
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
        {carregando ? "Carregando os 5.571 municípios do IBGE para a busca…" : "Digite parte do nome, a sigla da UF, o CNPJ ou o código IBGE. Setas percorrem a lista; Enter escolhe."}
      </p>
      <ul
        id={`${uid}-lista`}
        role="listbox"
        hidden={!aberta || consulta.trim() === ""}
        aria-label="Resultados da busca"
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
            <span className="min-w-0">{e.rotulo}</span>
            <span className="shrink-0 text-xs text-carvao-muted">{e.detalhe}</span>
          </li>
        ))}
        {res.total === 0 && (
          <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
            {carregando ? "Os municípios ainda estão chegando; tente de novo em instantes." : "Nenhum resultado para essa busca."}
          </li>
        )}
        {res.total > res.itens.length && (
          <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
            Mais {num(res.total - res.itens.length, 0)} resultados: refine a busca.
          </li>
        )}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- explorador */

export function TerritorioExplorador({ dados }: { dados: DadosExplorador }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_TERRITORIO);
  const [pedidoIndice, setPedidoIndice] = useState(false);
  const [pedidoMalha, setPedidoMalha] = useState(false);
  const [avisoCmp, setAvisoCmp] = useState("");
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
  const linhasMun = useMemo(() => (municipios ? municipios.map((m) => linhaMunicipio(m, idx)) : null), [municipios, idx]);
  const usinas = useMemo(() => (arqUsinas ? usinasDoJson(arqUsinas, dados.limiteRegistroKw) : null), [arqUsinas, dados.limiteRegistroKw]);
  const usinasVisiveis = useMemo(() => (usinas ? filtrarUsinas(usinas, { fon: v.fon, est: v.est, reg: v.reg }) : null), [usinas, v.fon, v.est, v.reg]);
  const nomeMunicipio = useCallback((ibge: string) => {
    const m = porIbge.get(ibge);
    return m ? `${m.nome} (${m.uf})` : `município ${ibge}`;
  }, [porIbge]);
  const linhasUsinas = useMemo(() => (usinasVisiveis ? usinasVisiveis.map((u) => linhaUsina(u, nomeMunicipio)) : null), [usinasVisiveis, nomeMunicipio]);
  const entidades = useMemo(() => entidadesBusca(dados, municipios), [dados, municipios]);
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
  });

  const selecionar = useCallback((s: Selecao) => definir({ sel: s }), [definir]);
  const idSel = (tipo: TipoSelecao) => (sel?.tipo === tipo ? sel.id : null);

  /* ---------------------------------------------------------------- montagem do mapa por camada */

  type Montagem = {
    geo: CamadaGeo | null;
    carregando: string | null;
    falha: ReactNode;
    fills: string[];
    contornos: boolean;
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
    if (cUf.estado === "erro") return { ...vazio, falha: <Falha erro={cUf.erro} arquivo={dados.arquivos.geoUf} nome="a malha de UF do IBGE" repetir={repetirUf} /> };

    if (cam === "submercado") {
      if (!geoUf) return { ...vazio, carregando: "Carregando o mapa das UFs (IBGE)…" };
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
      for (const u of dados.ufs.filter((x) => x.estado.startsWith("provado por uma"))) {
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
      return {
        ...vazio,
        geo: geoUf,
        fills,
        sobreposicoes,
        destaques,
        foco: centro(corr.uf ? featPorUf.get(corr.uf) : undefined),
        titulo: "Submercado de cada UF (camada oficial da EPE, pertença provada pela carga do ONS)",
        descricao: `Mapa das 27 UFs pintadas pelo submercado: ${SUBMERCADOS.map((s) => `${NOME_SUBMERCADO[s]} com ${contaUf(s)} UFs`).join(", ")}. A tabela abaixo do mapa traz as mesmas UFs.`,
        legenda: (
          <Legenda
            titulo="Submercado (cor da UF)"
            itens={[
              ...SUBMERCADOS.map((s) => ({ id: s, rotulo: `${NOME_SUBMERCADO[s]} (UFs)`, cor: fundoSubmercado(s), contagem: contaUf(s) })),
              { id: "fora", rotulo: "Município fora do SIN: submercado não se aplica", cor: COR_NAO_SE_APLICA, contagem: e.fora_do_sin ?? null },
              { id: "isol", rotulo: "Município com localidade isolada (contorno tracejado)", cor: "var(--cor-superficie)", contagem: e.com_localidade_isolada ?? null, forma: "tracejado" },
              { id: "toco", rotulo: "UF com área de carga sem carga nos dias conferidos (contorno tracejado)", cor: "var(--cor-superficie)", forma: "tracejado" },
            ]}
            nota="A divisa é a da UF: o ONS não publica limite geográfico do submercado. Município fora do SIN não pertence ao submercado da cor da UF."
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
            return m ? { titulo: `${m.nome} · ${m.uf}`, linhas: [textoSubmercadoMunicipio(m), m.sm_estado ? ROTULO_ESTADO_SM[m.sm_estado] : ""] } : null;
          }
          const u = ufPorSigla.get(ufDeFeature.get(id) ?? "");
          return u ? { titulo: `${u.nome} · ${u.uf}`, linhas: [u.submercado, `pertença ${u.estado}`] } : null;
        },
      };
    }

    if (cam === "usinas") {
      if (!geoUf) return { ...vazio, carregando: "Carregando o mapa das UFs (IBGE)…" };
      if (cUsinas.estado === "erro") return { ...vazio, falha: <Falha erro={cUsinas.erro} arquivo={dados.arquivos.usinas} nome="as usinas" repetir={repetirUsinas} /> };
      if (!usinasVisiveis) return { ...vazio, carregando: "Carregando as usinas do SIGA…" };
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
        destaques: destaquesBase(),
        pontos,
        pontoSelecionado: ponto,
        foco: ponto ?? centro(corr.uf ? featPorUf.get(corr.uf) : undefined),
        titulo: `Usinas do SIGA de ${dataBR(dados.referencias.siga_data)} (ponto: coordenada informada à ANEEL)`,
        descricao: `Mapa do Brasil por UF com ${inteiro(usinasVisiveis.length - semCoord)} usinas desenhadas como pontos. A tabela abaixo do mapa traz as mesmas usinas.`,
        legenda: (
          <div className="space-y-2">
            <Legenda titulo="Fonte (cor)" itens={FONTES_USINA.filter((f) => v.fon.includes(f)).map((f) => ({ id: f, rotulo: ROTULO_FONTE[f], cor: COR_FONTE[f], contagem: contaFonte(f), forma: "ponto-redondo" as const }))} />
            <Legenda
              titulo="Estágio (forma) e potência (tamanho)"
              itens={[
                ...ESTAGIOS_USINA.filter((e) => v.est.includes(e)).map((e) => ({
                  id: e,
                  rotulo: ROTULO_ESTAGIO[e],
                  cor: "var(--cor-carvao-muted)",
                  contagem: contaEst(e),
                  forma: e === "operacao" ? ("ponto-redondo" as const) : e === "construcao" ? ("ponto-quadrado" as const) : ("ponto-vazado" as const),
                })),
              ]}
              nota={`Tamanho da marca: ${CLASSES_POTENCIA.map((c) => c.rotulo).join(", ")} (fiscalizada em operação, outorgada nas demais).${semCoord ? ` ${inteiro(semCoord)} usinas sem coordenada ficam só na tabela.` : ""}${v.reg ? "" : " Registros de até 10 kW fora do mapa (marque para incluir)."}`}
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
          return u ? { titulo: `${u.nome} · ${u.uf}`, linhas: ["Toque ou clique numa marca para ver a usina."] } : null;
        },
      };
    }

    // camadas sobre a malha municipal
    if (cMalha.estado === "erro") return { ...vazio, falha: <Falha erro={cMalha.erro} arquivo={dados.arquivos.geoMunicipios} nome="a malha municipal do IBGE" repetir={repetirMalha} /> };
    if (cIndice.estado === "erro") return { ...vazio, falha: <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome="o índice municipal" repetir={repetirIndice} /> };
    if (!geoMun || !municipios || !linhasMun) return { ...vazio, carregando: "Carregando o mapa e o índice dos municípios (IBGE)…" };

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
            titulo={`Área de ${d?.sigla ?? "distribuidora"} pela relação oficial (municípios inteiros)`}
            itens={[
              { id: "1", rotulo: "Vínculo confirmado", cor: COR_VINCULO[1], contagem: conta[1] },
              { id: "2", rotulo: "Só pelo cadastro de MMGD", cor: COR_VINCULO[2], contagem: conta[2] },
              { id: "0", rotulo: "Sem confirmação (ressalva)", cor: COR_VINCULO[0], contagem: conta[0] },
              { id: "fora", rotulo: "Fora da área", cor: COR_FORA_DA_AREA },
            ]}
            nota="Não há polígono oficial de concessão acessível: a área é desenhada pelos municípios inteiros da relação, e município compartilhado aparece em todas as áreas."
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
            titulo="Áreas das distribuidoras que atendem o município escolhido (listadas, nenhuma escolhida)"
            itens={[
              ...cand.map((i, k) => ({ id: String(i), rotulo: idx.get(i)?.sigla ?? `distribuidora ${i}`, cor: `color-mix(in srgb, ${CORES_COMP[k % 4]} 45%, var(--cor-superficie))`, contagem: conta.get(i) ?? 0 })),
              { id: "varias", rotulo: "Em mais de uma dessas áreas", cor: "var(--cor-mineral)", contagem: varias },
              { id: "fora", rotulo: "Fora dessas áreas", cor: COR_FORA_DA_AREA },
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
            titulo="Quantas distribuidoras atendem cada município (relação oficial)"
            itens={(Object.keys(ROTULO_SITUACAO) as SituacaoVinculo[]).map((s) => ({ id: s, rotulo: ROTULO_SITUACAO[s], cor: CORES_SITUACAO[s], contagem: conta[s] }))}
            nota="Escolha uma distribuidora pela busca, pela tabela de distribuidoras ou pela ficha de um município para acender a área dela."
          />
        );
      }
      return {
        ...vazio,
        geo: geoMun,
        fills,
        contornos: true,
        destaques: destaquesBase(),
        foco: centro(corr.municipio ? featMun.get(corr.municipio) : undefined),
        titulo: "Áreas das distribuidoras: municípios inteiros da relação oficial da ANEEL",
        descricao: `Mapa dos ${inteiro(geoMun.features.length)} municípios do IBGE pintados pela distribuidora que os atende. A tabela abaixo do mapa traz os mesmos municípios.`,
        legenda,
        clique: ({ id }) => id && /^\d{7}$/.test(id) && selecionar(sel?.tipo === "mun" && sel.id === id ? null : { tipo: "mun", id }),
        dica: (id) => {
          const m = porIbge.get(id);
          return m ? { titulo: `${m.nome} · ${m.uf}`, linhas: [textoDistribuidoras(m, idx), ROTULO_SITUACAO[situacaoVinculo(m)]] } : null;
        },
      };
    }

    // camada municipal: a medida escolhida
    const med = v.med;
    const def = MEDIDA[med];
    const valores = valoresMedida(linhasMun, med);
    const classes = classificacaoMedida(med, geoMun.features.map((f) => valores[f.id] as ValorClassificavel));
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
      destaques,
      foco: centro(corr.municipio ? featMun.get(corr.municipio) : undefined),
      titulo: `${def.rotulo} por município (${def.unidade})`,
      descricao: `Mapa dos ${inteiro(geoMun.features.length)} municípios do IBGE pela medida ${def.rotulo}, em ${def.unidade}: ${inteiro(classes.validos)} com valor e ${inteiro(classes.semDado)} sem dado. A tabela abaixo do mapa traz os mesmos números.`,
      legenda: (
        <Legenda
          titulo={`Classes em ${def.unidade}`}
          itens={[
            ...classes.classes.map((c, i) => ({ id: String(i), rotulo: c.rotulo, cor: cores[i], contagem: c.contagem })),
            { id: "sem", rotulo: "sem dado", cor: "sem-dado", contagem: classes.semDado },
          ]}
          nota={`${ROTULO_METODO[classes.metodo]}. Cada classe inclui o limite inferior; zero é valor e fica na primeira classe. ${def.nota ?? ""}`}
        />
      ),
      clique: ({ id }) => id && /^\d{7}$/.test(id) && selecionar(sel?.tipo === "mun" && sel.id === id ? null : { tipo: "mun", id }),
      dica: (id) => {
        const m = porIbge.get(id);
        if (!m) return null;
        const d = descreveRegiao(valores[id], classes, def.casas, def.unidade);
        return { titulo: `${m.nome} · ${m.uf}`, linhas: [d.valor, d.classe ? `classe ${d.classe}` : ""].filter(Boolean) };
      },
    };
  })();

  /* ---------------------------------------------------------------- comparação */

  const entidadesCmp = useMemo(() => (municipios ?? []).map((m) => ({ id: m.ibge, rotulo: m.nome, detalhe: m.uf, sinonimos: [m.ibge] })), [municipios]);
  const cmp = v.cmp.flatMap((id) => porIbge.get(id) ?? []);

  /* ---------------------------------------------------------------- ficha */

  let ficha: ReactNode;
  if (sel?.tipo === "mun") {
    ficha = selMun ? (
      <FichaMunicipio
        m={selMun}
        dados={dados}
        idx={idx}
        conjuntos={indice ? conjuntosDoMunicipio(selMun, indice.conjuntos.linhas, idx) : []}
        submercado={selMun.sm && selMun.sm_estado !== "fora_do_sin" ? smPorId.get(selMun.sm) ?? null : null}
        uf={ufPorSigla.get(selMun.uf) ?? null}
        onSelecionar={selecionar}
      />
    ) : cIndice.estado === "erro" ? (
      <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome="o índice municipal" repetir={repetirIndice} />
    ) : municipios ? (
      <Estado alerta>O código IBGE {sel.id} não está no índice municipal publicado.</Estado>
    ) : (
      <Estado>Carregando o índice dos municípios para a ficha…</Estado>
    );
  } else if (sel?.tipo === "dist") {
    ficha = selDist ? <FichaDistribuidora d={selDist} dados={dados} onSelecionar={selecionar} /> : <Estado alerta>O CNPJ {sel.id} não tem município na relação oficial vigente.</Estado>;
  } else if (sel?.tipo === "uf") {
    ficha = selUf ? <FichaUf u={selUf} s={selUf.subsistema ? smPorId.get(selUf.subsistema) ?? null : null} dados={dados} onSelecionar={selecionar} /> : <Estado alerta>UF {sel.id} desconhecida.</Estado>;
  } else if (sel?.tipo === "sm") {
    ficha = selSm ? <FichaSubmercado s={selSm} dados={dados} onSelecionar={selecionar} /> : <Estado alerta>Submercado desconhecido.</Estado>;
  } else if (sel?.tipo === "usi") {
    ficha = selUsi ? (
      <FichaUsina u={selUsi} dados={dados} nomeMunicipio={nomeMunicipio} onSelecionar={selecionar} />
    ) : cUsinas.estado === "erro" ? (
      <Falha erro={cUsinas.erro} arquivo={dados.arquivos.usinas} nome="as usinas" repetir={repetirUsinas} />
    ) : usinas ? (
      <Estado alerta>A usina {sel.id} não está no arquivo publicado.</Estado>
    ) : (
      <Estado>Carregando as usinas para a ficha…</Estado>
    );
  } else {
    const c = dados.camadas.find((x) => x.id === (cam === "usinas" ? "usinas" : cam));
    ficha = (
      <div className="space-y-2 text-sm text-carvao-muted">
        <p className="rotulo text-mineral">Nenhuma escolha</p>
        <p className="text-carvao">Busque o seu município acima, toque no mapa ou escolha uma linha da tabela. A ficha diz de quem é cada número.</p>
        {c && <p>{descricaoCamada(c.descricao)}</p>}
      </div>
    );
  }

  const prox = proximaPergunta(cam);

  /* ---------------------------------------------------------------- render */

  return (
    <div className="space-y-6">
      {/* busca e camada */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Busca
          entidades={entidades}
          carregando={querIndice && !municipios && cIndice.estado !== "erro"}
          onFoco={() => setPedidoIndice(true)}
          onEscolher={(e) => {
            const s = selecaoDeId(e.id);
            if (s) selecionar(s);
          }}
        />
        <fieldset className="min-w-0">
          <legend className="rotulo mb-1 text-mineral">Camada do mapa</legend>
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
          <span className="rotulo text-mineral">Medida do mapa municipal</span>
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
            <legend className="rotulo mb-1 text-mineral">Fontes</legend>
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
            <legend className="rotulo mb-1 text-mineral">Estágios</legend>
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
                Incluir registros de até 10 kW
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
              contornos={montagem.contornos ? montagem.geo.contornos?.uf ?? null : null}
              sobreposicoes={montagem.sobreposicoes}
              destaques={montagem.destaques}
              pontos={montagem.pontos}
              pontoSelecionado={montagem.pontoSelecionado}
              foco={montagem.foco}
              onClique={montagem.clique}
              dica={montagem.dica}
              ajuda={
                <p>
                  Malha territorial do IBGE{montagem.geo.malha.revisao ? `, revisão de ${montagem.geo.malha.revisao}` : ""} (qualidade {textoQualidadeMalha(montagem.geo.malha.qualidade)}), em projeção de áreas
                  iguais. Pelo teclado, use a busca acima e a tabela abaixo.
                </p>
              }
            />
          ) : (
            !montagem.falha && (
              <div className="flex h-[380px] items-center justify-center border border-linha bg-papel px-6 text-center sm:h-[540px]">
                <p role="status" className="text-sm text-carvao-muted">
                  {montagem.carregando ?? "Preparando o mapa…"}
                </p>
              </div>
            )
          )}
          {cam === "submercado" && !(geoMun && municipios) && cMalha.estado !== "carregando" && (
            <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3 text-sm text-carvao-muted">
              <p className="min-w-0 flex-[1_1_16rem]">
                {inteiro(dados.estadosMunicipio.fora_do_sin ?? 0)} municípios estão fora do SIN e {inteiro(dados.estadosMunicipio.com_localidade_isolada ?? 0)} têm localidade isolada. Para vê-los no mapa, a página carrega os municípios.
              </p>
              <button type="button" onClick={() => setPedidoMalha(true)} className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo">
                Mostrar os municípios fora do SIN
              </button>
            </div>
          )}
          {corr.texto && (
            <div role="status" className="flex flex-wrap items-start gap-x-3 gap-y-1 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao" data-correspondencia={corr.valida ? (corr.aviso ? "aviso" : "valida") : "nao-passa"}>
              <span className="rotulo shrink-0">{corr.valida ? (corr.aviso ? "Nesta camada, com ressalva" : "Nesta camada") : "A escolha não passa para esta camada"}</span>
              <span className="min-w-0 flex-[1_1_16rem]">{corr.texto}</span>
            </div>
          )}
          {corr.candidatas.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 text-sm" aria-label="Distribuidoras do município escolhido">
              {corr.candidatas.map((i) => {
                const d = idx.get(i);
                return d ? (
                  <li key={i}>
                    <button type="button" onClick={() => selecionar({ tipo: "dist", id: d.id })} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      Ver a área de {d.sigla}
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
        <aside aria-label="Ficha da escolha" className="min-w-0 border border-linha bg-superficie p-4" data-ficha={sel ? sel.tipo : "nenhuma"}>
          {ficha}
          {sel && (
            <button type="button" onClick={() => selecionar(null)} className="rotulo mt-3 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              Limpar a escolha
            </button>
          )}
        </aside>
      </div>

      {/* tabela equivalente da camada */}
      <Secao titulo={`Tabela equivalente do mapa: ${ROTULO_CAMADA[cam].toLowerCase()}`} id="territorio-tabela">
        {cam === "submercado" && (
          <>
            <TabelaInterativa
              titulo="Submercado de cada UF (as UFs que o mapa pinta)"
              colunas={COLUNAS_UFS_SUBMERCADO}
              linhas={dados.ufs}
              chaveLinha="id"
              colunaRotulo="uf"
              fonte="EPE, WebMap (camada 24); ONS, Carga de Energia Verificada por área de carga"
              versao={dados.versao}
              nomeArquivo="territorio-ufs-submercado"
              chaveUrl="ter.uf"
              ordemInicial={{ coluna: "uf", direcao: "asc" }}
              selecionado={idSel("uf")}
              onSelecionar={(id) => selecionar(id ? { tipo: "uf", id } : null)}
              dicaBusca="UF ou submercado"
            />
            {linhasMun && (
              <TabelaInterativa
                titulo="Municípios com localidade isolada (marcas por cima da cor da UF)"
                colunas={COLUNAS_ISOLADOS}
                linhas={linhasMun.filter((l) => l.isol_n > 0)}
                chaveLinha="id"
                colunaRotulo="municipio"
                fonte="EPE, PASI (ciclo 2025), pelo módulo Inclusão; IBGE, estimativa de população"
                versao={dados.versao}
                nomeArquivo="territorio-municipios-isolados"
                chaveUrl="ter.isol"
                ordemInicial={{ coluna: "isol_pop", direcao: "desc" }}
                selecionado={idSel("mun")}
                onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
                dicaBusca="Município ou UF"
              />
            )}
          </>
        )}
        {cam === "distribuidora" &&
          (linhasMun ? (
            <TabelaInterativa
              titulo="Distribuidoras de cada município (os municípios que o mapa pinta)"
              colunas={COLUNAS_VINCULO}
              linhas={linhasMun}
              chaveLinha="id"
              colunaRotulo="municipio"
              fonte="ANEEL, relação conjunto × município (IndQual e limites de continuidade), pelo módulo Perdas"
              versao={dados.versao}
              nomeArquivo="territorio-municipios-distribuidoras"
              chaveUrl="ter.vinc"
              ordemInicial={{ coluna: "municipio", direcao: "asc" }}
              selecionado={idSel("mun")}
              onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
              dicaBusca="Município, UF, código IBGE ou sigla da distribuidora"
            />
          ) : (
            <Estado>A tabela dos municípios aparece com o índice municipal.</Estado>
          ))}
        {cam === "municipio" &&
          (linhasMun ? (
            <TabelaInterativa
              titulo="Indicadores publicados por município (só valores do município)"
              colunas={colunasMunicipios(v.med)}
              linhas={linhasMun}
              chaveLinha="id"
              colunaRotulo="municipio"
              fonte="ANEEL (MMGD, SIGA), ANEEL e MDS (Tarifa Social), MME (Luz para Todos), EPE (PASI), IBGE (população), pelos módulos de origem"
              versao={dados.versao}
              nomeArquivo="territorio-municipios"
              chaveUrl="ter.mun"
              ordemInicial={{ coluna: v.med, direcao: "desc" }}
              selecionado={idSel("mun")}
              onSelecionar={(id) => selecionar(id ? { tipo: "mun", id } : null)}
              dicaBusca="Município, UF ou código IBGE"
              nota="Nenhuma coluna desta tabela é valor de distribuidora, conjunto, submercado ou UF: esses ficam nas tabelas de cada tipo de área."
            />
          ) : (
            <Estado>A tabela dos municípios aparece com o índice municipal.</Estado>
          ))}
        {cam === "usinas" &&
          (linhasUsinas ? (
            <TabelaInterativa
              titulo="Usinas desenhadas no mapa (mesmo filtro de fontes, estágios e registros)"
              colunas={COLUNAS_USINAS}
              linhas={linhasUsinas}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte="ANEEL, SIGA, pelo módulo Expansão"
              versao={dados.versao}
              nomeArquivo="territorio-usinas"
              chaveUrl="ter.usi"
              ordemInicial={{ coluna: "mw_fiscalizado", direcao: "desc" }}
              selecionado={idSel("usi")}
              onSelecionar={(id) => selecionar(id ? { tipo: "usi", id } : null)}
              dicaBusca="Nome, CEG, tipo, UF ou município"
              nota="Usina declarada em mais de um município aparece uma vez, com os municípios listados; a potência não é repartida."
            />
          ) : (
            <Estado>A tabela das usinas aparece com o arquivo das usinas.</Estado>
          ))}
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta desta camada</span>
          <a href={prox.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {prox.pergunta}
          </a>
        </p>
      </Secao>

      {/* tabelas por grão */}
      <Secao titulo="Tabelas por tipo de área: cada número na tabela da sua área" nivel="analisar" id="territorio-graos">
        <TabelaInterativa
          titulo="Submercados: preço, armazenamento e MMGD estimada (valores do submercado inteiro)"
          colunas={COLUNAS_SUBMERCADOS}
          linhas={dados.submercados}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte="CCEE, PLD horário (pelo módulo PLD); ONS, EAR diário e carga verificada"
          versao={dados.versao}
          nomeArquivo="territorio-submercados"
          chaveUrl="ter.sm"
          selecionado={idSel("sm")}
          onSelecionar={(id) => selecionar(id ? { tipo: "sm", id } : null)}
          dicaBusca="Submercado ou UF"
        />
        <TabelaInterativa
          titulo="UFs: capacidade, Tarifa Social e sistemas isolados (valores da UF inteira)"
          colunas={COLUNAS_UFS_INDICADORES}
          linhas={dados.ufs}
          chaveLinha="id"
          colunaRotulo="uf"
          fonte="ANEEL, SIGA (pelo módulo Expansão); ANEEL, Beneficiários da CDE (pelo módulo Inclusão); EPE, PASI"
          versao={dados.versao}
          nomeArquivo="territorio-ufs"
          chaveUrl="ter.ufi"
          ordemInicial={{ coluna: "cap_mw", direcao: "desc" }}
          selecionado={idSel("uf")}
          onSelecionar={(id) => selecionar(id ? { tipo: "uf", id } : null)}
          dicaBusca="UF ou submercado"
        />
        <TabelaInterativa
          titulo="Distribuidoras: área e indicadores da área inteira"
          colunas={COLUNAS_DISTRIBUIDORAS}
          linhas={dados.distribuidoras}
          chaveLinha="id"
          colunaRotulo="sigla"
          fonte="ANEEL (relação de conjuntos, SAMP, Indicadores de Continuidade, Tarifas, MMGD, SCS), pelos módulos de origem"
          versao={dados.versao}
          nomeArquivo="territorio-distribuidoras"
          chaveUrl="ter.dist"
          ordemInicial={{ coluna: "municipios", direcao: "desc" }}
          selecionado={idSel("dist")}
          onSelecionar={(id) => selecionar(id ? { tipo: "dist", id } : null)}
          dicaBusca="Sigla, razão social, CNPJ ou UF"
          nota="Valores da área inteira: não descrevem um município. Taxa de perdas de ano parcial não é comparável à de ano completo; taxa negativa está como o SAMP publica (ressalva na ficha)."
        />
      </Secao>

      {/* comparação */}
      <Secao titulo="Comparar até quatro municípios" nivel="analisar" id="territorio-comparar">
        {!municipios ? (
          cIndice.estado === "erro" ? (
            <Falha erro={cIndice.erro} arquivo={dados.arquivos.municipios} nome="o índice municipal" repetir={repetirIndice} />
          ) : (
            <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
              <p className="min-w-0 flex-[1_1_16rem] text-sm text-carvao-muted">A comparação lê o índice municipal, carregado só quando pedido.</p>
              <button type="button" onClick={() => setPedidoIndice(true)} className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-sm text-carvao hover:bg-energia-fundo">
                {cIndice.estado === "carregando" ? "Carregando…" : "Carregar os municípios"}
              </button>
            </div>
          )
        ) : (
          <>
            <Comparador
              rotulo={`Municípios para comparar (até ${LIMITE_COMPARACAO})`}
              entidades={entidadesCmp}
              selecionadas={v.cmp}
              onMudar={(ids) => definir({ cmp: ids })}
              dicaBusca="Nome do município ou código IBGE"
              vazio="Nenhum município escolhido. Escolha aqui ou pelo botão da ficha."
            >
              {() => null}
            </Comparador>
            {selMun && !v.cmp.includes(selMun.ibge) && (
              <button
                type="button"
                onClick={() => {
                  const r = alternarSelecao(v.cmp, selMun.ibge, LIMITE_COMPARACAO);
                  if (r.motivo === "limite") setAvisoCmp(`Limite de ${LIMITE_COMPARACAO} municípios: remova um para incluir ${selMun.nome}.`);
                  else {
                    setAvisoCmp("");
                    definir({ cmp: r.ids });
                  }
                }}
                className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-sm text-carvao hover:bg-energia-fundo"
              >
                Incluir {selMun.nome} na comparação
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
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const cols = municipios.map((m) => porId.get(m.ibge)!).filter(Boolean);
  const LINHAS: { rotulo: string; v: (l: LinhaMunicipio) => string }[] = [
    { rotulo: "População estimada", v: (l) => inteiro(l.populacao) },
    { rotulo: "Unidades de MMGD", v: (l) => inteiro(l.mmgd_un) },
    { rotulo: "Potência de MMGD (kW)", v: (l) => (l.mmgd_kw === null ? "sem dado" : num(l.mmgd_kw, 0)) },
    { rotulo: "MMGD por habitante (W)", v: (l) => (l.mmgd_w_hab === null ? "sem dado" : num(l.mmgd_w_hab, 1)) },
    { rotulo: "Faturas com Tarifa Social", v: (l) => inteiro(l.tsee_faturas) },
    { rotulo: "Tarifa Social por família do CadÚnico (proxy, %)", v: (l) => (l.tsee_proxy_pct === null ? "sem dado" : num(l.tsee_proxy_pct, 1)) },
    { rotulo: "Luz para Todos (domicílios)", v: (l) => inteiro(l.lpt_dom) },
    { rotulo: "Usinas em operação só no município", v: (l) => `${inteiro(l.usi_op_n)} (${num(l.usi_op_mw, 1)} MW)` },
    { rotulo: "Registros de até 10 kW", v: (l) => inteiro(l.usi_reg_n) },
    { rotulo: "Localidades isoladas", v: (l) => inteiro(l.isol_n) },
    { rotulo: "Distribuidoras (referência, sem valor)", v: (l) => l.distribuidoras },
    { rotulo: "Submercado (referência, sem valor)", v: (l) => l.submercado },
  ];
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Comparação de municípios (tabela rolável)">
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums" data-comparacao={cols.length}>
        <caption className="pb-2 text-left text-sm font-medium text-carvao">Municípios lado a lado: valores do próprio município</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
              Indicador
            </th>
            {cols.map((l) => (
              <th key={l.id} scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium text-carvao">
                {l.municipio} ({l.uf})
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
        Distribuidora e submercado entram como referência: os valores deles são da área inteira e do submercado inteiro, e ficam na ficha e nas tabelas de cada tipo de área.
      </p>
    </div>
  );
}
