"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { carimbo, num, plural } from "@/lib/energia/formato";
import {
  ROTULO_METODO,
  classeDe,
  ordenarComNulos,
  quebrasQuantis,
  valido,
  type Classificacao,
  type Direcao,
  type ValorClassificavel,
} from "@/lib/energia/escalas";
import { FUNDO_SEM_DADO } from "@/lib/energia/mapa-calor";
import {
  aplicarZoom,
  caixaDoCaminho,
  caixaDoZoom,
  comFolga,
  ajusteNaTela,
  lerViewBox,
  limitarZoom,
  paraTela,
  pontoRotulo,
  textoViewBox,
  validaCamada,
  zoomInicial,
  type CamadaGeo,
  type ContornoGeo,
  type FeatureGeo,
  type Ponto,
  type Zoom,
} from "@/lib/energia/geo";
import {
  COR_NAO_SE_APLICA_PADRAO,
  buscarRegioes,
  coresParaClasses,
  descreveRegiao,
  fraseRegiao,
  moverNaLista,
  preenchimento,
  resumoMapa,
  validaCores,
} from "@/lib/energia/mapa-coropletico";

// Só tipos saem daqui. NAO_SE_APLICA (escalas.ts), URL_GEO e agruparPorChave (geo.ts) são
// importados das bibliotecas: um valor reexportado por módulo "use client" chega ao Server
// Component como referência de cliente (URL_GEO.uf lança erro no servidor e NAO_SE_APLICA
// deixa de ser o texto que classeDe reconhece).
export type { CamadaGeo, FeatureGeo } from "@/lib/energia/geo";

/**
 * Mapa coroplético sobre a malha oficial do IBGE (public/energia/geo/*.json,
 * gerada por pipeline/energia/geo.py): uma cor por classe, com legenda que diz
 * a unidade, o método das classes e os três estados que nunca se confundem.
 * Sem dado é hachura (a região existe e o valor falta); "não se aplica" é
 * cinza claro liso com rótulo; zero é valor e recebe a cor da sua classe.
 *
 * Interação: clique ou toque seleciona (e mostra a dica no toque); o mouse
 * mostra a dica ao passar. O SVG não tem paradas de Tab por região (seriam
 * milhares no mapa municipal): o teclado usa a busca, um combobox com lista
 * (setas, Page Up e Page Down, Enter, Esc) que também acende a região e a dica
 * no mapa. A seleção pode ser controlada por props (selecionado, onSelecionar)
 * para sincronizar com tabela, série e perfil. Zoom por botões, centrado na
 * seleção, com arrasto para mover quando aproximado, e Restaurar.
 *
 * Desempenho: um único <path> por região, numa camada memoizada que não
 * re-renderiza no hover (a dica e os contornos de destaque são camadas por
 * cima); o evento é delegado ao SVG e a região vem do data-id do alvo.
 * A geometria pode vir por prop (UF, pequena, já no HTML do servidor) ou ser
 * buscada no cliente só quando a página a pede (municípios, 1,3 MB). A
 * altura é fixa em pixels, então carregar a malha não desloca a página.
 */

export type MapaCoropleticoProps = {
  titulo: string;
  /** Geometria já carregada; tem precedência sobre `fonteGeometria`. */
  geometria?: CamadaGeo;
  /** Endereço da camada para buscar no cliente (use URL_GEO.uf ou URL_GEO.municipios). */
  fonteGeometria?: string;
  /** Valor por id da região: número (zero inclusive), null ou ausente = sem dado, NAO_SE_APLICA. */
  valores: Readonly<Record<string, ValorClassificavel>>;
  /** Cores das classes, da menor para a maior, só por variável CSS (ex.: "var(--serie-1)"). */
  cores: readonly string[];
  /** Classificação de escalas.ts (quantis, intervalos iguais ou quebras fixas). Padrão: quantis, uma classe por cor. */
  classificacao?: Classificacao;
  unidade: string;
  casas?: number;
  /** Nome das regiões nos textos; padrão pela camada (UF, município). */
  rotuloRegiao?: { singular: string; plural: string };
  /** Seleção controlada: id, null (nenhuma) ou omitido (o mapa guarda a própria seleção). */
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /** Cor de "não se aplica" (cinza claro liso). */
  corNaoSeAplica?: string;
  /** Sigla sobre cada região grande o bastante (útil na camada de UF). */
  rotulos?: boolean;
  /** Divisas de UF por cima dos municípios, quando a camada as traz. */
  contornos?: boolean;
  /** Altura do mapa em pixels a partir de 640 px de largura, e no celular. */
  altura?: number;
  alturaCelular?: number;
  /** Aproximação máxima (padrão 16× no mapa municipal e 8× nos demais). */
  escalaMaxima?: number;
  periodo?: string;
  nota?: string;
};

/** Largura usada no HTML do servidor, antes da medição real (a mesma de GraficoLinhas). */
const LARGURA_SSR = 760;
/** Até esse número de linhas a tabela equivalente vai no HTML; acima, é montada ao abrir. */
const LIMITE_TABELA_MONTADA = 60;
const LIMITE_LISTA = 50;
const SEM_FEATURES: FeatureGeo[] = [];

const BOTAO =
  "inline-flex h-11 min-w-[44px] items-center justify-center border border-linha bg-superficie px-2 text-sm text-carvao hover:border-carvao disabled:cursor-not-allowed disabled:text-carvao-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

/* ---------- carga da geometria no cliente (compartilhada entre mapas) ---------- */

const cacheGeo = new Map<string, Promise<CamadaGeo>>();

/** Busca e valida uma camada; pedidos iguais compartilham a mesma promessa, e falha não fica em cache. */
function carregarGeometria(url: string): Promise<CamadaGeo> {
  let p = cacheGeo.get(url);
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        const j: unknown = await r.json();
        const erros = validaCamada(j);
        if (erros.length) throw new Error(erros.slice(0, 3).join("; "));
        return j as CamadaGeo;
      })
      .catch((e: unknown) => {
        cacheGeo.delete(url);
        throw e;
      });
    cacheGeo.set(url, p);
  }
  return p;
}

type Carga = { estado: "carregando" } | { estado: "pronto"; geo: CamadaGeo } | { estado: "erro"; erro: string };

function rotuloPadrao(camada: string | undefined): { singular: string; plural: string } {
  if (camada === "uf") return { singular: "UF", plural: "UFs" };
  if (camada === "municipios") return { singular: "município", plural: "municípios" };
  return { singular: "região", plural: "regiões" };
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- camadas memoizadas ---------- */

/** Uma região = um <path>. Não recebe estado de hover nem de seleção: não re-renderiza com eles. */
const CamadaRegioes = memo(function CamadaRegioes({ features, fills }: { features: readonly FeatureGeo[]; fills: readonly string[] }) {
  return (
    <g fillRule="evenodd" stroke="var(--cor-superficie)" strokeLinejoin="round">
      {features.map((f, i) => (
        <path key={f.id} d={f.d} fill={fills[i]} data-id={f.id} />
      ))}
    </g>
  );
});

const CamadaContornos = memo(function CamadaContornos({ contornos }: { contornos: readonly ContornoGeo[] }) {
  return (
    <g fill="none" stroke="var(--cor-carvao-muted)" strokeWidth={0.9} strokeLinejoin="round" pointerEvents="none" aria-hidden="true">
      {contornos.map((c) => (
        <path key={c.id} d={c.d} />
      ))}
    </g>
  );
});

type Rotulo = { id: string; texto: string; p: Ponto; largura: number };

const CamadaRotulos = memo(function CamadaRotulos({ rotulos, upx }: { rotulos: readonly Rotulo[]; upx: number }) {
  return (
    <g pointerEvents="none" aria-hidden="true" fontSize={11 * upx} textAnchor="middle" fill="var(--cor-carvao)">
      {rotulos
        // só onde a sigla cabe dentro da região na escala atual
        .filter((r) => r.largura / upx >= 26)
        .map((r) => (
          <text key={r.id} x={r.p[0]} y={r.p[1] + 4 * upx} stroke="var(--cor-superficie)" strokeWidth={3 * upx} paintOrder="stroke" strokeLinejoin="round">
            {r.texto}
          </text>
        ))}
    </g>
  );
});

type LinhaTabela = { id: string; nome: string; uf: string; v: ValorClassificavel };

const TabelaRegioes = memo(function TabelaRegioes({
  titulo,
  linhas,
  classes,
  casas,
  unidade,
  rotulo,
  selecionado,
}: {
  titulo: string;
  linhas: readonly LinhaTabela[];
  classes: Classificacao;
  casas: number;
  unidade: string;
  rotulo: { singular: string; plural: string };
  selecionado: string | null;
}) {
  const [aberta, setAberta] = useState(false);
  const [ordem, setOrdem] = useState<{ por: "nome" | "valor"; dir: Direcao }>({ por: "nome", dir: "asc" });
  const montar = linhas.length <= LIMITE_TABELA_MONTADA || aberta;
  const ordenadas = useMemo(
    () =>
      montar
        ? ordenarComNulos(linhas, ordem.por === "nome" ? (l) => l.nome : (l) => (valido(l.v) ? l.v : null), ordem.dir, (l) => `${l.nome} ${l.uf}`)
        : [],
    [linhas, ordem, montar],
  );
  const alterna = (por: "nome" | "valor") =>
    setOrdem((o) => (o.por === por ? { por, dir: o.dir === "asc" ? "desc" : "asc" } : { por, dir: por === "valor" ? "desc" : "asc" }));
  const ariaSort = (por: "nome" | "valor") => (ordem.por === por ? (ordem.dir === "asc" ? "ascending" : "descending") : "none");
  const seta = (por: "nome" | "valor") => (ordem.por === por ? (ordem.dir === "asc" ? "↑" : "↓") : "↕");
  const botaoOrdem =
    "inline-flex min-h-[44px] items-center gap-1 text-left font-medium text-mineral hover:text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";
  return (
    <details className="mt-3 text-xs" onToggle={(e) => setAberta((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        Dados do mapa em tabela ({plural(linhas.length, rotulo.singular, rotulo.plural)})
      </summary>
      {montar && (
        <div className="tabela-scroll mt-2 max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}, em ${unidade}. Sem dado e não se aplica ficam no fim em qualquer ordem.`}</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left">
                <th scope="col" aria-sort={ariaSort("nome")} className="border-b border-linha px-2">
                  <button type="button" onClick={() => alterna("nome")} className={botaoOrdem}>
                    {maiuscula(rotulo.singular)} <span aria-hidden="true">{seta("nome")}</span>
                  </button>
                </th>
                <th scope="col" className="border-b border-linha px-2 font-medium text-mineral">UF</th>
                <th scope="col" className="border-b border-linha px-2 font-medium text-mineral">Código IBGE</th>
                <th scope="col" aria-sort={ariaSort("valor")} className="border-b border-linha px-2">
                  <button type="button" onClick={() => alterna("valor")} className={botaoOrdem}>
                    Valor ({unidade}) <span aria-hidden="true">{seta("valor")}</span>
                  </button>
                </th>
                <th scope="col" className="border-b border-linha px-2 font-medium text-mineral">Classe</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => {
                const d = descreveRegiao(l.v, classes, casas, "");
                const sel = l.id === selecionado;
                // linha selecionada tem fundo energia-fundo: ali o texto fica só em carvão e carvão-muted
                return (
                  <tr key={l.id} data-estado={d.estado} className={`border-b border-linha ${sel ? "bg-energia-fundo shadow-[inset_4px_0_0_var(--cor-energia)]" : ""}`}>
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                      {l.nome}
                      {sel && <span className="sr-only"> (selecionado)</span>}
                    </th>
                    <td className="px-2 py-1 text-carvao">{l.uf}</td>
                    <td className="px-2 py-1 text-carvao-muted">{l.id}</td>
                    <td className={`px-2 py-1 ${d.estado === "valor" ? "text-carvao" : "text-carvao-muted"}`}>{d.valor}</td>
                    <td className="px-2 py-1 text-carvao-muted">{d.classe ?? "sem classe"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
});

/* ---------- componente ---------- */

type Dica = { id: string; origem: "ponteiro" | "toque" | "teclado"; x?: number; y?: number };

export function MapaCoropletico({
  titulo,
  geometria,
  fonteGeometria,
  valores,
  cores,
  classificacao,
  unidade,
  casas = 1,
  rotuloRegiao,
  selecionado: selecionadoProp,
  onSelecionar,
  corNaoSeAplica = COR_NAO_SE_APLICA_PADRAO,
  rotulos = false,
  contornos = true,
  altura = 520,
  alturaCelular = 380,
  escalaMaxima,
  periodo,
  nota,
}: MapaCoropleticoProps) {
  const uid = useId().replace(/:/g, "");

  /* carga */
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (geometria || !fonteGeometria) return;
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregarGeometria(fonteGeometria).then(
      (geo) => vivo && setCarga({ estado: "pronto", geo }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [geometria, fonteGeometria, tentativa]);
  const geo = geometria ?? (carga.estado === "pronto" ? carga.geo : null);
  const features = geo?.features ?? SEM_FEATURES;
  const camada = geo?.camada;
  // objeto estável: a tabela memoizada não re-renderiza a cada movimento do ponteiro
  const rotulo = useMemo(() => rotuloRegiao ?? rotuloPadrao(camada), [rotuloRegiao, camada]);
  const porId = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);

  /* classes e cores: o universo das classes é o das regiões desenhadas */
  const universo = useMemo(() => (features.length ? features.map((f) => valores[f.id]) : Object.values(valores)), [features, valores]);
  const classes = useMemo(() => classificacao ?? quebrasQuantis(universo, cores.length, { casas }), [classificacao, universo, cores.length, casas]);
  const errosCores = validaCores(cores, classes.classes.length);
  // a paleta costuma chegar como literal novo a cada render do pai: a chave em texto mantém o memo
  const chaveCores = cores.join("|");
  const coresClasses = useMemo(() => coresParaClasses(chaveCores.split("|"), classes.classes.length), [chaveCores, classes.classes.length]);
  const hachura = `${uid}-sem-dado`;
  const fills = useMemo(
    () => features.map((f) => preenchimento(valores[f.id], classes, { classes: coresClasses, semDado: `url(#${hachura})`, naoSeAplica: corNaoSeAplica })),
    [features, valores, classes, coresClasses, hachura, corNaoSeAplica],
  );
  const resumo = useMemo(() => resumoMapa(features.map((f) => f.id), valores), [features, valores]);
  const linhasTabela = useMemo<LinhaTabela[]>(
    () =>
      features.length
        ? features.map((f) => ({ id: f.id, nome: f.nome, uf: f.uf, v: valores[f.id] }))
        : // sem malha (carregando ou erro), a tabela lista os valores pelo código
          Object.keys(valores).map((id) => ({ id, nome: id, uf: "", v: valores[id] })),
    [features, valores],
  );

  /* seleção */
  const [selInterna, setSelInterna] = useState<string | null>(null);
  const controlado = selecionadoProp !== undefined;
  const selecionado = controlado ? selecionadoProp : selInterna;
  const selFeature = selecionado ? porId.get(selecionado) ?? null : null;
  const [leitura, setLeitura] = useState("");

  const descricao = (id: string) => descreveRegiao(valores[id], classes, casas, unidade);
  const frase = (f: FeatureGeo) => fraseRegiao(f, descricao(f.id));

  function selecionar(id: string | null) {
    if (!controlado) setSelInterna(id);
    onSelecionar?.(id);
    const f = id ? porId.get(id) : null;
    setLeitura(f ? `Selecionado: ${frase(f)}.` : "Seleção removida.");
  }

  /* tamanho medido e enquadramento */
  const caixaRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: LARGURA_SSR, h: altura });
  useEffect(() => {
    const el = caixaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      if (r.width > 0 && r.height > 0) setTam({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo]);

  const base = useMemo(() => {
    const vb = geo ? lerViewBox(geo.viewBox) : null;
    return vb ? comFolga(vb, 0.015) : null;
  }, [geo]);
  const maxEscala = escalaMaxima ?? (features.length > 500 ? 16 : 8);
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const zAtual = base ? limitarZoom(base, zoom ?? zoomInicial(base), maxEscala) : null;
  const vb = base && zAtual ? caixaDoZoom(base, zAtual) : null;
  const aj = vb ? ajusteNaTela(vb, tam.w, tam.h) : null;
  const upx = aj && aj.s > 0 ? 1 / aj.s : 1; // unidades da malha por pixel

  // ponto de rótulo/dica de cada região, calculado uma vez e só quando pedido
  // (cache novo quando a malha muda)
  const pontos = useMemo(() => ({ malha: features, mapa: new Map<string, Ponto | null>() }), [features]);
  const pontoDe = (f: FeatureGeo): Ponto | null => {
    if (!pontos.mapa.has(f.id)) pontos.mapa.set(f.id, pontoRotulo(f.d));
    return pontos.mapa.get(f.id) ?? null;
  };
  const rotulosCalc = useMemo<Rotulo[]>(() => {
    if (!rotulos) return [];
    return features.flatMap((f) => {
      const p = pontoRotulo(f.d);
      const c = caixaDoCaminho(f.d);
      return p && c ? [{ id: f.id, texto: f.uf || f.nome, p, largura: Math.min(c.largura, c.altura * 2) }] : [];
    });
  }, [features, rotulos]);

  /* dica e hover */
  const [dica, setDica] = useState<Dica | null>(null);
  const tipoPonteiro = useRef("mouse");
  const ultimoAnunciado = useRef<string | null>(null);
  const arrasto = useRef<{ x: number; y: number; centro: Ponto } | null>(null);
  const arrastou = useRef(false);

  const idDoAlvo = (t: EventTarget | null): string | null => {
    const el = t as Element | null;
    return el && typeof el.getAttribute === "function" ? el.getAttribute("data-id") : null;
  };
  const posicaoRelativa = (ev: { clientX: number; clientY: number }): Ponto | null => {
    const r = caixaRef.current?.getBoundingClientRect();
    return r ? [ev.clientX - r.left, ev.clientY - r.top] : null;
  };

  function aoMover(ev: React.PointerEvent<SVGSVGElement>) {
    const a = arrasto.current;
    if (a && base && zAtual && aj) {
      const dx = ev.clientX - a.x;
      const dy = ev.clientY - a.y;
      if (!arrastou.current && Math.hypot(dx, dy) < 5) return;
      if (!arrastou.current) {
        arrastou.current = true;
        ev.currentTarget.setPointerCapture?.(ev.pointerId);
        setDica(null);
      }
      setZoom(limitarZoom(base, { escala: zAtual.escala, centro: [a.centro[0] - dx / aj.s, a.centro[1] - dy / aj.s] }, maxEscala));
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const id = idDoAlvo(ev.target);
    const pos = posicaoRelativa(ev);
    if (!id || !pos) {
      if (dica?.origem === "ponteiro") setDica(null);
      return;
    }
    setDica({ id, origem: "ponteiro", x: pos[0], y: pos[1] });
    const f = porId.get(id);
    if (f && id !== ultimoAnunciado.current) {
      ultimoAnunciado.current = id;
      setLeitura(frase(f));
    }
  }

  function aoClicar(ev: React.MouseEvent<SVGSVGElement>) {
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    const id = idDoAlvo(ev.target);
    if (!id) {
      setDica(null);
      return;
    }
    const novo = id === selecionado ? null : id;
    selecionar(novo);
    // no toque não há hover: a dica aparece no ponto tocado
    const pos = posicaoRelativa(ev);
    if (novo && pos && tipoPonteiro.current !== "mouse") setDica({ id, origem: "toque", x: pos[0], y: pos[1] });
    else if (!novo && dica?.origem === "toque") setDica(null);
  }

  /* zoom por botões */
  function zoomPor(fator: number) {
    if (!base || !zAtual) return;
    const alvo = fator > 1 && selFeature ? pontoDe(selFeature) : null;
    const z = aplicarZoom(base, zAtual, fator, maxEscala, alvo);
    setZoom(z);
    setDica(null);
    setLeitura(z.escala > 1 ? `Mapa aproximado ${num(z.escala, 0)} vezes${alvo && selFeature ? `, em ${selFeature.nome}` : ""}.` : "Mapa no enquadramento inicial.");
  }
  function restaurar() {
    setZoom(null);
    setDica(null);
    setLeitura("Mapa no enquadramento inicial.");
  }

  /* busca (combobox) */
  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const resultados = useMemo(() => buscarRegioes(features, consulta, LIMITE_LISTA), [features, consulta]);
  useEffect(() => {
    if (aberta && ativo >= 0) document.getElementById(`${uid}-op-${ativo}`)?.scrollIntoView?.({ block: "nearest" });
  }, [aberta, ativo, uid]);

  function escolher(f: FeatureGeo) {
    selecionar(f.id);
    setConsulta(f.nome);
    setAberta(false);
    setAtivo(-1);
    // com zoom, a região escolhida vem para o centro; sem zoom ela já está à vista
    if (base && zAtual && zAtual.escala > 1) {
      const p = pontoDe(f);
      if (p) setZoom(limitarZoom(base, { escala: zAtual.escala, centro: p }, maxEscala));
    }
    setDica({ id: f.id, origem: "teclado" });
  }

  function teclaBusca(ev: React.KeyboardEvent<HTMLInputElement>) {
    const n = resultados.itens.length;
    if (ev.key === "ArrowDown" && ev.altKey) {
      ev.preventDefault();
      setAberta(true);
      return;
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp" || ev.key === "PageDown" || ev.key === "PageUp") {
      const prox = moverNaLista(aberta ? ativo : -1, ev.key, n);
      if (prox === null) return;
      ev.preventDefault();
      setAberta(true);
      setAtivo(prox);
      setDica({ id: resultados.itens[prox].id, origem: "teclado" });
      return;
    }
    if (ev.key === "Enter" && aberta && ativo >= 0 && ativo < n) {
      ev.preventDefault();
      escolher(resultados.itens[ativo]);
      return;
    }
    if (ev.key === "Escape") {
      if (aberta) {
        ev.preventDefault();
        setAberta(false);
        setAtivo(-1);
        if (dica?.origem === "teclado") setDica(null);
      } else if (consulta) {
        ev.preventDefault();
        setConsulta("");
      }
    }
  }

  /* dica: posição do ponteiro ou, no teclado, o ponto de rótulo da região */
  const dicaFeature = dica ? porId.get(dica.id) ?? null : null;
  let dicaPos: Ponto | null = null;
  if (dica && dicaFeature) {
    if (dica.x !== undefined && dica.y !== undefined) dicaPos = [dica.x, dica.y];
    else if (vb) {
      const p = pontoDe(dicaFeature);
      const t = p ? paraTela(p, vb, tam.w, tam.h) : null;
      if (t && t[0] >= 0 && t[0] <= tam.w && t[1] >= 0 && t[1] <= tam.h) dicaPos = t;
    }
  }
  const dicaDesc = dicaFeature ? descricao(dicaFeature.id) : null;
  const destaque = dicaFeature && dicaFeature.id !== selecionado ? dicaFeature : null;

  const mostrarContornos = contornos && !!geo?.contornos?.uf?.length;
  const espessura = features.length > 500 ? Math.min(0.9, 0.25 * (zAtual?.escala ?? 1) ** 0.5) : 0.9;
  const classeDoZero = resumo.zeros > 0 ? classeDe(0, classes) : null;
  const noZoom = !!zAtual && zAtual.escala > 1;

  // configuração inconsistente é erro de programação: falha no build, não vira mapa com cor errada
  if (!geometria && !fonteGeometria) throw new Error(`MapaCoropletico "${titulo}": informe geometria ou fonteGeometria`);
  if (errosCores.length) throw new Error(`MapaCoropletico "${titulo}": ${errosCores.join("; ")}`);

  return (
    <div className="relative w-full min-w-0">
      {/* legenda: unidade, método, classes e os três estados */}
      <div className="mb-3">
        <p className="rotulo text-mineral">
          Classes em {unidade}
          {periodo ? ` · ${periodo}` : ""}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-carvao-muted" aria-label={`Legenda: classes em ${unidade}`}>
          {classes.classes.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5" data-classe={i}>
              <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: coresClasses[i] }} />
              {c.rotulo}
              <span className="tabular-nums">({num(c.contagem, 0)})</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5" data-estado="sem-dado">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: FUNDO_SEM_DADO }} />
            sem dado <span className="tabular-nums">({num(resumo.semDado, 0)})</span>
          </li>
          <li className="flex items-center gap-1.5" data-estado="nao-se-aplica">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: corNaoSeAplica }} />
            não se aplica <span className="tabular-nums">({num(resumo.naoSeAplica, 0)})</span>
          </li>
        </ul>
        <p className="mt-1 text-xs text-carvao-muted">
          {ROTULO_METODO[classes.metodo]}. Cada classe inclui o limite inferior.
          {typeof classeDoZero === "number" &&
            ` Zero é valor, não ausência: ${plural(resumo.zeros, `${rotulo.singular} tem`, `${rotulo.plural} têm`)} valor 0, na classe ${classes.classes[classeDoZero].rotulo}.`}
        </p>
      </div>

      {/* busca e zoom */}
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <label htmlFor={`${uid}-busca`} className="rotulo mb-1 block text-mineral">
            Buscar {rotulo.singular}
          </label>
          <input
            id={`${uid}-busca`}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={aberta}
            aria-controls={`${uid}-lista`}
            aria-activedescendant={aberta && ativo >= 0 ? `${uid}-op-${ativo}` : undefined}
            aria-describedby={`${uid}-ajuda`}
            autoComplete="off"
            spellCheck={false}
            disabled={!geo}
            value={consulta}
            placeholder={geo ? "Nome, sigla da UF ou código IBGE" : "Aguardando a malha"}
            onChange={(e) => {
              setConsulta(e.target.value);
              setAberta(true);
              setAtivo(-1);
            }}
            onClick={() => setAberta(true)}
            onKeyDown={teclaBusca}
            onBlur={() => {
              setAberta(false);
              setAtivo(-1);
              if (dica?.origem === "teclado") setDica(null);
            }}
            className="h-11 w-full border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-energia disabled:cursor-wait"
          />
          <p id={`${uid}-ajuda`} className="sr-only">
            Digite parte do nome, a sigla da UF ou o código IBGE. Setas percorrem a lista e acendem a região no mapa; Enter seleciona; Esc fecha a lista.
          </p>
          {/* a lista existe sempre (aria-controls aponta para ela) e só aparece aberta */}
          <ul
              id={`${uid}-lista`}
              role="listbox"
              hidden={!aberta || !geo}
              aria-label={`${maiuscula(rotulo.plural)} encontrados`}
              // o clique na lista não pode tirar o foco do campo antes de selecionar
              onPointerDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto border border-linha bg-superficie shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            >
              {resultados.itens.map((f, i) => {
                const d = descricao(f.id);
                return (
                  <li
                    key={f.id}
                    id={`${uid}-op-${i}`}
                    role="option"
                    aria-selected={i === ativo}
                    onClick={() => escolher(f)}
                    className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 border-b border-linha px-3 py-1 text-sm last:border-b-0 ${
                      // fundo claro e barra no acento: a opção ativa não depende só de um fundo quase branco
                      i === ativo ? "bg-energia-fundo text-carvao shadow-[inset_4px_0_0_var(--cor-energia)]" : "text-carvao hover:bg-papel"
                    }`}
                  >
                    <span>
                      {f.nome}
                      {f.uf && f.uf !== f.nome && <span className="text-carvao-muted">, {f.uf}</span>}
                      {f.id === selecionado && <span className="text-carvao-muted"> (selecionado)</span>}
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-carvao-muted">{d.valor}</span>
                  </li>
                );
              })}
              {resultados.total === 0 && (
                <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
                  Nenhum resultado para essa busca.
                </li>
              )}
              {resultados.total > resultados.itens.length && (
                <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
                  Mais {num(resultados.total - resultados.itens.length, 0)} resultados: refine a busca.
                </li>
              )}
            </ul>
        </div>
        <div role="group" aria-label="Zoom do mapa" className="flex gap-1">
          <button type="button" className={BOTAO} onClick={() => zoomPor(2)} disabled={!zAtual || zAtual.escala >= maxEscala} aria-label={selFeature ? `Aproximar em ${selFeature.nome}` : "Aproximar"} title="Aproximar">
            +
          </button>
          <button type="button" className={BOTAO} onClick={() => zoomPor(0.5)} disabled={!noZoom} aria-label="Afastar" title="Afastar">
            −
          </button>
          <button type="button" className={`${BOTAO} rotulo px-3`} onClick={restaurar} disabled={!noZoom}>
            Restaurar
          </button>
        </div>
      </div>

      {/* mapa: altura fixa em pixels (por faixa de largura), sem salto quando a malha chega */}
      <div
        ref={caixaRef}
        className="relative h-[var(--mapa-h)] overflow-hidden border border-linha bg-superficie sm:h-[var(--mapa-h-sm)]"
        style={{ "--mapa-h": `${alturaCelular}px`, "--mapa-h-sm": `${altura}px` } as React.CSSProperties}
        data-estado={geo ? "pronto" : carga.estado}
      >
        {!geo && carga.estado !== "erro" && (
          <div role="status" className="flex h-full items-center justify-center px-6 text-center text-sm text-carvao-muted">
            Carregando a malha territorial do IBGE.
          </div>
        )}
        {!geo && carga.estado === "erro" && (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-carvao">
            <p>
              Não foi possível carregar a malha territorial ({carga.erro}). Os valores continuam na tabela abaixo, pelo código IBGE.
            </p>
            <button type="button" className={`${BOTAO} rotulo px-4 text-energia-dark`} onClick={() => setTentativa((t) => t + 1)}>
              Tentar de novo
            </button>
          </div>
        )}
        {geo && vb && zAtual && (
          <svg
            width="100%"
            height="100%"
            viewBox={textoViewBox(vb)}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-labelledby={`${uid}-t`}
            aria-describedby={`${uid}-r`}
            className={`block h-full w-full select-none [&_path]:[vector-effect:non-scaling-stroke] ${noZoom ? "cursor-grab touch-none" : "cursor-pointer"}`}
            onPointerDown={(ev) => {
              tipoPonteiro.current = ev.pointerType;
              arrastou.current = false;
              arrasto.current = noZoom && ev.button === 0 ? { x: ev.clientX, y: ev.clientY, centro: zAtual.centro } : null;
            }}
            onPointerMove={aoMover}
            onPointerUp={() => (arrasto.current = null)}
            onPointerCancel={() => (arrasto.current = null)}
            onPointerLeave={(ev) => {
              if (ev.pointerType === "mouse" && dica?.origem === "ponteiro") setDica(null);
            }}
            onClick={aoClicar}
          >
            <title id={`${uid}-t`}>{`${titulo}: mapa por ${rotulo.singular}. A busca acima do mapa escolhe uma região pelo teclado.`}</title>
            <defs>
              {/* hachura de "sem dado" com 6 px de passo em qualquer zoom */}
              <pattern id={hachura} patternUnits="userSpaceOnUse" width={6 * upx} height={6 * upx} patternTransform="rotate(45)">
                <rect width={6 * upx} height={6 * upx} fill="var(--cor-superficie)" />
                <rect width={1.2 * upx} height={6 * upx} fill="var(--cor-mineral)" />
              </pattern>
            </defs>
            <g strokeWidth={espessura}>
              <CamadaRegioes features={features} fills={fills} />
            </g>
            {mostrarContornos && <CamadaContornos contornos={geo.contornos!.uf} />}
            {rotulos && <CamadaRotulos rotulos={rotulosCalc} upx={upx} />}
            {destaque && <path d={destaque.d} fill="none" fillRule="evenodd" stroke="var(--cor-carvao)" strokeWidth={2} pointerEvents="none" data-destaque={destaque.id} />}
            {selFeature && (
              <g fill="none" fillRule="evenodd" strokeLinejoin="round" pointerEvents="none" data-selecionado={selFeature.id}>
                <path d={selFeature.d} stroke="var(--cor-superficie)" strokeWidth={5} />
                <path d={selFeature.d} stroke="var(--cor-carvao)" strokeWidth={2.5} />
              </g>
            )}
          </svg>
        )}
        {dicaFeature && dicaDesc && dicaPos && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 w-[13rem] max-w-full border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            style={{
              // largura fixa: a dica nunca passa da borda do mapa (que corta o que transborda)
              left: `clamp(0px, ${dicaPos[0]}px - 6.5rem, 100% - 13rem)`,
              top: dicaPos[1],
              transform: dicaPos[1] > 96 ? "translateY(calc(-100% - 12px))" : "translateY(16px)",
            }}
          >
            <p className="rotulo text-mineral">{dicaFeature.uf && dicaFeature.uf !== dicaFeature.nome ? `${dicaFeature.nome} · ${dicaFeature.uf}` : dicaFeature.nome}</p>
            <p className="mt-1 tabular-nums text-carvao">{dicaDesc.valor}</p>
            {dicaDesc.classe && <p className="text-carvao-muted">classe {dicaDesc.classe}</p>}
          </div>
        )}
      </div>

      {/* leitura da região ativa e das mudanças de seleção e de zoom, para leitor de tela */}
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      {/* seleção atual */}
      <div className="mt-2 flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linha pb-2 text-sm" data-selecao={selecionado ?? ""}>
        {selFeature ? (
          <p className="text-carvao">
            <span className="rotulo mr-2 text-mineral">Seleção</span>
            <strong className="font-medium">{selFeature.nome}</strong>
            {selFeature.uf && selFeature.uf !== selFeature.nome ? ` (${selFeature.uf})` : ""}: <span className="tabular-nums">{descricao(selFeature.id).valor}</span>
            {descricao(selFeature.id).classe && <span className="text-carvao-muted">, classe {descricao(selFeature.id).classe}</span>}
          </p>
        ) : selecionado && geo ? (
          <p className="text-carvao">
            <span className="rotulo mr-2 text-mineral">Seleção</span>
            {selecionado}: sem polígono nesta malha.
          </p>
        ) : (
          <p className="text-carvao-muted">Sem seleção. Clique ou toque numa região, ou escolha pela busca.</p>
        )}
        {selecionado && (
          <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia" onClick={() => selecionar(null)}>
            Limpar seleção
          </button>
        )}
      </div>

      {/* resumo da cobertura, fonte da malha e modo de uso */}
      <div id={`${uid}-r`} className="mt-2 space-y-1 text-xs leading-relaxed text-carvao-muted">
        <p className="tabular-nums">
          {plural(resumo.regioes, rotulo.singular, rotulo.plural)}: {num(resumo.comValor, 0)} com valor
          {`, ${num(resumo.semDado, 0)} sem dado (hachura), ${num(resumo.naoSeAplica, 0)} não se aplica (cinza liso)`}
          {resumo.minimo !== null && resumo.maximo !== null && `. Valores de ${descreveRegiao(resumo.minimo, classes, casas, unidade).valor} a ${descreveRegiao(resumo.maximo, classes, casas, unidade).valor}`}.
        </p>
        {geo && resumo.foraDaMalha.length > 0 && (
          <p data-fora-da-malha={resumo.foraDaMalha.length}>
            {plural(resumo.foraDaMalha.length, "valor informado não tem", "valores informados não têm")} polígono nesta malha e {resumo.foraDaMalha.length === 1 ? "não aparece" : "não aparecem"} no desenho: {resumo.foraDaMalha.slice(0, 8).join(", ")}
            {resumo.foraDaMalha.length > 8 ? " e outros" : ""}.
          </p>
        )}
        {geo && (
          <p>
            Malha territorial do IBGE{geo.malha.revisao ? `, revisão de ${geo.malha.revisao}` : ""}, qualidade {geo.malha.qualidade === "intermediaria" ? "intermediária" : geo.malha.qualidade === "minima" ? "mínima" : geo.malha.qualidade},
            capturada em {carimbo(geo.capturado_em)}. Projeção: {geo.projecao.nome} (áreas proporcionais às reais).
          </p>
        )}
        <p>Clique ou toque numa região para selecioná-la; pelo teclado, use a busca. Com zoom, arraste o mapa para movê-lo.</p>
        {nota && <p>{nota}</p>}
      </div>

      <TabelaRegioes titulo={titulo} linhas={linhasTabela} classes={classes} casas={casas} unidade={unidade} rotulo={rotulo} selecionado={selecionado} />
    </div>
  );
}
