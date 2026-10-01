"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from "react";
import { ExpansaoMarcas } from "@/components/energia/ExpansaoOpcoes";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CAMADAS_REDE,
  CLASSES_PONTO,
  COLUNAS_PONTOS,
  ESQUEMA_CARTEIRA,
  ESQUEMA_TRANSMISSAO,
  ESTAGIOS_PONTOS,
  NOME_TIPO,
  NOME_UF,
  ROTULO_ESTAGIO,
  TENSOES_MINIMAS,
  classePonto,
  filtraRede,
  inteiro,
  kmTexto,
  linhasPontos,
  mwTexto,
  pontosDoJson,
  type CamadaRede,
  type EstagioPonto,
  type UsinaPonto,
} from "@/lib/energia/expansao";
import { aplicarZoom, caixaDoZoom, comFolga, lerCaminho, lerViewBox, limitarZoom, pontoNaRegiao, textoViewBox, URL_GEO, zoomInicial, type CamadaGeo, type Caixa, type Ponto, type Zoom } from "@/lib/energia/geo";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { LinhasRedeEpe, PontosUsinas } from "@/lib/energia/tipos-expansao";

/**
 * Mapas sob demanda da Expansão sobre a malha oficial de UF do IBGE
 * (public/energia/geo/uf.json, Albers cônica equivalente):
 *
 *  - usinas do SIGA por estágio (P040), com a latitude e a longitude oficiais
 *    projetadas na mesma grade da malha (projetaPonto em src/lib/energia/expansao.ts,
 *    conferida no teste: cada usina cai na UF que o SIGA informa);
 *  - linhas de transmissão existentes e planejadas do WebMap da EPE (P042), publicadas
 *    pelo pipeline já na grade da malha.
 *
 * Por que sob demanda: os arquivos têm 3,1 MB (pontos) e 0,45 MB (linhas), acima do que
 * cabe no HTML da página (contrato, seção 5.1). Nada é carregado até a pessoa pedir, ou
 * até o link trazer uma usina selecionada.
 *
 * Desempenho: os pontos de cada estágio e classe de potência são um único <path> com
 * subcaminhos de comprimento zero (a ponta arredondada ou quadrada desenha a marca);
 * 22 mil usinas viram poucos elementos. O clique procura a usina mais próxima num raio
 * de 12 px; fora dele, seleciona a UF sob o ponteiro.
 *
 * Acessibilidade: as marcas não são alvos de Tab (seriam milhares); o teclado usa a
 * tabela equivalente logo abaixo (busca, ordem, seleção), sincronizada com o mapa pela
 * URL. Cor nunca é o único portador: o estágio também muda a forma (quadrado para
 * outorgado sem obra, círculo para em construção, círculo pequeno para em operação) e a
 * camada da rede muda o traço (contínuo para existente, tracejado para planejada).
 */

// requisições sob demanda, compartilhadas pelas instâncias; falha não fica em cache
const cache = new Map<string, Promise<unknown>>();
function carregar<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

const ESCALA_MAXIMA = 12;

/** Quadro do mapa: malha de UF, zoom por botões, arrasto quando aproximado, clique convertido para a grade da malha. */
function MapaBase({
  geo,
  titulo,
  descricao,
  ufSelecionada,
  foco,
  onClique,
  dica,
  children,
}: {
  geo: CamadaGeo;
  titulo: string;
  descricao: string;
  /** O que o clique faz neste mapa (dito ao lado dos botões de zoom). */
  dica: string;
  ufSelecionada: string | null;
  /** Ponto que o "Aproximar" centraliza (a seleção atual). */
  foco: Ponto | null;
  /** Clique em coordenadas da malha, com a tolerância de 12 px convertida para unidades da malha. */
  onClique: (p: Ponto, tolerancia: number) => void;
  children: (pxPorUnidade: number) => ReactNode;
}) {
  const base = useMemo<Caixa>(() => comFolga(lerViewBox(geo.viewBox) ?? { x: 0, y: 0, largura: 1, altura: 1 }, 0.01), [geo.viewBox]);
  const [zoom, setZoom] = useState<Zoom>(() => zoomInicial(base));
  const [px, setPx] = useState(1 / 60);
  const svg = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ x: number; y: number; centro: Ponto; moveu: boolean } | null>(null);
  const vb = caixaDoZoom(base, zoom);

  // pixels por unidade da malha (ajuste "meet"), medido no cliente; no servidor vale a largura padrão
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setPx(Math.min(r.width / vb.largura, r.height / vb.altura));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [vb.largura, vb.altura]);

  const paraMalha = useCallback((cx: number, cy: number): Ponto | null => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = el.createSVGPoint();
    p.x = cx;
    p.y = cy;
    const q = p.matrixTransform(m.inverse());
    return [q.x, q.y];
  }, []);

  const mudar = (fator: number) => setZoom((z) => aplicarZoom(base, z, fator, ESCALA_MAXIMA, fator > 1 ? foco : null));

  function aoPressionar(e: PE<SVGSVGElement>) {
    arrasto.current = { x: e.clientX, y: e.clientY, centro: zoom.centro, moveu: false };
  }
  function aoMover(e: PE<SVGSVGElement>) {
    const a = arrasto.current;
    if (!a || zoom.escala <= 1) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.moveu && Math.hypot(dx, dy) < 6) return;
    a.moveu = true;
    setZoom(limitarZoom(base, { escala: zoom.escala, centro: [a.centro[0] - dx / px, a.centro[1] - dy / px] }, ESCALA_MAXIMA));
  }
  function aoSoltar(e: PE<SVGSVGElement>) {
    const a = arrasto.current;
    arrasto.current = null;
    if (a?.moveu) return;
    const p = paraMalha(e.clientX, e.clientY);
    if (p) onClique(p, 12 / px);
  }

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium text-carvao">{titulo}</figcaption>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => mudar(2)} className="min-h-[44px] min-w-[44px] border border-linha bg-superficie px-3 text-carvao hover:border-energia" aria-label="Aproximar o mapa">
          +
        </button>
        <button type="button" onClick={() => mudar(0.5)} disabled={zoom.escala <= 1} className="min-h-[44px] min-w-[44px] border border-linha bg-superficie px-3 text-carvao hover:border-energia disabled:text-mineral" aria-label="Afastar o mapa">
          −
        </button>
        <button type="button" onClick={() => setZoom(zoomInicial(base))} disabled={zoom.escala <= 1} className="min-h-[44px] border border-linha bg-superficie px-3 text-carvao hover:border-energia disabled:text-mineral">
          Restaurar
        </button>
        <span className="text-xs text-carvao-muted">{zoom.escala > 1 ? `Aproximação de ${inteiro(zoom.escala)} vezes; arraste para mover. ${dica}` : dica}</span>
      </div>
      <div className="relative border border-linha bg-papel">
        <svg
          ref={svg}
          role="img"
          aria-label={descricao}
          viewBox={textoViewBox(vb)}
          preserveAspectRatio="xMidYMid meet"
          className={`block h-[380px] w-full select-none sm:h-[540px] ${zoom.escala > 1 ? "touch-none" : "touch-pan-y"}`}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerLeave={() => (arrasto.current = null)}
        >
          <g>
            {geo.features.map((f) => (
              <path key={f.id} d={f.d} fill="var(--cor-superficie)" stroke="var(--cor-linha)" strokeWidth={1} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
            ))}
          </g>
          {children(px)}
          {ufSelecionada &&
            geo.features
              .filter((f) => f.uf === ufSelecionada)
              .map((f) => <path key={`sel-${f.id}`} d={f.d} fill="none" stroke="var(--cor-energia-dark)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
        </svg>
      </div>
    </figure>
  );
}

/** UF sob um ponto da malha (anéis lidos uma vez por camada). */
function useUfNoPonto(geo: CamadaGeo | null) {
  const aneis = useMemo(() => (geo ? geo.features.map((f) => ({ uf: f.uf, aneis: lerCaminho(f.d) })) : []), [geo]);
  return useCallback((p: Ponto) => aneis.find((a) => pontoNaRegiao(p, a.aneis))?.uf ?? null, [aneis]);
}

function Carregando({ texto }: { texto: string }) {
  return (
    <p role="status" className="text-sm text-carvao-muted">
      {texto}
    </p>
  );
}

function Erro({ erro, arquivo }: { erro: string; arquivo: string }) {
  return (
    <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
      Não foi possível carregar o mapa ({erro}). Os mesmos dados estão em{" "}
      <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
        {arquivo.split("/").at(-1)}
      </a>
      .
    </p>
  );
}

/* ---------------------------------------------------------------- usinas (P040) */

const COR_ESTAGIO: Record<EstagioPonto, string> = {
  construcao_nao_iniciada: "var(--serie-comp-3)",
  construcao: "var(--cor-energia)",
  operacao: "var(--cor-mineral-soft)",
};
const PONTA_ESTAGIO: Record<EstagioPonto, "square" | "round"> = { construcao_nao_iniciada: "square", construcao: "round", operacao: "round" };
const FATOR_ESTAGIO: Record<EstagioPonto, number> = { construcao_nao_iniciada: 1, construcao: 1, operacao: 0.7 };

function Amostra({ estagio, classe = 1 }: { estagio: EstagioPonto; classe?: number }) {
  const r = CLASSES_PONTO[classe].raio * 2 * FATOR_ESTAGIO[estagio] + 2;
  return (
    <svg aria-hidden="true" width={16} height={16} viewBox="0 0 16 16" className="shrink-0">
      <path d="M8 8h0" stroke={COR_ESTAGIO[estagio]} strokeWidth={r} strokeLinecap={PONTA_ESTAGIO[estagio]} />
    </svg>
  );
}

export function ExpansaoMapaUsinas({ url, tamanho, dataSiga, fonte }: { url: string; tamanho: string | null; dataSiga: string; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CARTEIRA);
  const [pedido, setPedido] = useState(false);
  const [dados, setDados] = useState<{ geo: CamadaGeo; pts: UsinaPonto[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = pedido || v.usina > 0;
  const ufNoPonto = useUfNoPonto(dados?.geo ?? null);

  useEffect(() => {
    if (!ativo || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.uf), carregar<PontosUsinas>(url)]).then(
      ([geo, j]) => vivo && setDados({ geo, pts: pontosDoJson(j, geo.projecao, ESTAGIOS_PONTOS) }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, dados, url]);

  const visiveis = useMemo(() => (dados ? dados.pts.filter((p) => (v.pts as readonly string[]).includes(p.estagio)) : []), [dados, v.pts]);
  // um caminho por estágio e classe de potência: o de operação primeiro, por baixo
  const camadas = useMemo(() => {
    const grupos = new Map<string, { estagio: EstagioPonto; classe: number; d: string[]; n: number }>();
    for (const p of visiveis) {
      const est = p.estagio as EstagioPonto;
      const cl = classePonto(p.mw_outorgado);
      const k = `${est}:${cl}`;
      let gr = grupos.get(k);
      if (!gr) grupos.set(k, (gr = { estagio: est, classe: cl, d: [], n: 0 }));
      gr.d.push(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`);
      gr.n++;
    }
    const ordem = (e: EstagioPonto) => (e === "operacao" ? 0 : e === "construcao_nao_iniciada" ? 1 : 2);
    return Array.from(grupos.values()).sort((a, b) => ordem(a.estagio) - ordem(b.estagio) || a.classe - b.classe);
  }, [visiveis]);
  const contagem = useMemo(() => Object.fromEntries(ESTAGIOS_PONTOS.map((e) => [e, visiveis.filter((p) => p.estagio === e).length])), [visiveis]);
  const sel = dados && v.usina > 0 ? (dados.pts.find((p) => p.nucleo === v.usina) ?? null) : null;
  const linhas = useMemo(() => linhasPontos(visiveis), [visiveis]);

  if (!ativo) {
    return (
      <div className="space-y-2 border border-linha bg-superficie p-4">
        <p className="text-sm text-carvao">
          Mapa das usinas com a localização oficial do SIGA (centróide aproximado informado à ANEEL), por estágio e classe de potência, com tabela equivalente.
        </p>
        <button type="button" onClick={() => setPedido(true)} className="min-h-[44px] border border-energia bg-energia-fundo px-4 text-sm text-carvao hover:bg-superficie">
          Carregar o mapa das usinas{tamanho ? ` (arquivo de ${tamanho})` : ""}
        </button>
      </div>
    );
  }
  if (erro) return <Erro erro={erro} arquivo={url} />;
  if (!dados) return <Carregando texto={`Carregando os pontos das usinas${tamanho ? ` (${tamanho})` : ""} e a malha de UF do IBGE…`} />;

  const clique = (p: Ponto, tol: number) => {
    let melhor: UsinaPonto | null = null;
    let dist = tol;
    for (const u of visiveis) {
      const d = Math.hypot(u.x - p[0], u.y - p[1]);
      if (d <= dist) {
        dist = d;
        melhor = u;
      }
    }
    if (melhor) definir({ usina: melhor.nucleo });
    else {
      const uf = ufNoPonto(p);
      definir({ uf: uf ?? "", usina: 0 });
    }
  };
  const descricao = `Mapa do Brasil por UF com ${inteiro(visiveis.length)} usinas: ${ESTAGIOS_PONTOS.filter((e) => (v.pts as readonly string[]).includes(e))
    .map((e) => `${inteiro(contagem[e])} ${ROTULO_ESTAGIO[e].toLocaleLowerCase("pt-BR")}`)
    .join(", ")}. A tabela abaixo traz as mesmas usinas.`;

  return (
    <div className="space-y-4">
      <ExpansaoMarcas
        rotulo="Estágios no mapa"
        opcoes={ESTAGIOS_PONTOS.map((e) => ({ id: e, rotulo: `${ROTULO_ESTAGIO[e]} (${inteiro(dados.pts.filter((p) => p.estagio === e).length)})`, marcador: <Amostra estagio={e} /> }))}
        valor={v.pts as EstagioPonto[]}
        onMudar={(pts) => definir({ pts })}
      />
      <MapaBase
        geo={dados.geo}
        titulo={`Usinas do SIGA por estágio, ${dataSiga}`}
        descricao={descricao}
        ufSelecionada={v.uf || null}
        foco={sel ? [sel.x, sel.y] : null}
        onClique={clique}
        dica="Clique ou toque numa marca para ver a usina; fora das marcas, a UF fica destacada."
      >
        {() => (
          <g pointerEvents="none">
            {camadas.map((c) => (
              <path
                key={`${c.estagio}:${c.classe}`}
                d={c.d.join("")}
                fill="none"
                stroke={COR_ESTAGIO[c.estagio]}
                strokeWidth={CLASSES_PONTO[c.classe].raio * 2 * FATOR_ESTAGIO[c.estagio] + 1.5}
                strokeLinecap={PONTA_ESTAGIO[c.estagio]}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {sel && (
              <>
                <path d={`M${sel.x} ${sel.y}h0`} stroke="var(--cor-carvao)" strokeWidth={16} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={`M${sel.x} ${sel.y}h0`} stroke="var(--cor-superficie)" strokeWidth={11} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={`M${sel.x} ${sel.y}h0`} stroke={COR_ESTAGIO[sel.estagio as EstagioPonto] ?? "var(--cor-carvao)"} strokeWidth={7} strokeLinecap={PONTA_ESTAGIO[sel.estagio as EstagioPonto] ?? "round"} vectorEffect="non-scaling-stroke" />
              </>
            )}
          </g>
        )}
      </MapaBase>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted">
        <span className="rotulo text-mineral">Tamanho da marca</span>
        {CLASSES_PONTO.map((c, i) => (
          <span key={c.rotulo} className="inline-flex items-center gap-1.5">
            <Amostra estagio="construcao" classe={i} />
            {c.rotulo} outorgados
          </span>
        ))}
      </div>
      <p aria-live="polite" className="min-h-[1.5rem] text-sm text-carvao">
        {sel ? (
          <>
            <strong className="font-medium">{sel.nome ?? `Usina ${sel.nucleo}`}</strong> (núcleo do CEG {sel.nucleo}): {sel.tipo ? (NOME_TIPO[sel.tipo] ?? sel.tipo) : "tipo sem dado"}, {sel.uf ? (NOME_UF[sel.uf] ?? sel.uf) : "UF sem dado"},{" "}
            {ROTULO_ESTAGIO[sel.estagio].toLocaleLowerCase("pt-BR")}; {mwTexto(sel.mw_outorgado, 3)} outorgados e {mwTexto(sel.mw_fiscalizado, 3)} fiscalizados.{" "}
            <button type="button" onClick={() => definir({ usina: 0 })} className="min-h-[44px] text-energia-dark underline underline-offset-4">
              Limpar a seleção
            </button>
          </>
        ) : v.uf ? (
          `UF destacada: ${NOME_UF[v.uf] ?? v.uf}.`
        ) : (
          ""
        )}
      </p>
      <TabelaInterativa
        titulo={`Usinas no mapa (${ESTAGIOS_PONTOS.filter((e) => (v.pts as readonly string[]).includes(e))
          .map((e) => ROTULO_ESTAGIO[e].toLocaleLowerCase("pt-BR"))
          .join(", ")})`}
        colunas={COLUNAS_PONTOS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={dataSiga}
        nomeArquivo="expansao-usinas-mapa"
        chaveUrl="car.pt"
        ordemInicial={{ coluna: "mw_outorgado", direcao: "desc" }}
        selecionado={v.usina > 0 ? String(v.usina) : null}
        onSelecionar={(id) => definir({ usina: id ? Number(id) : 0 })}
        dicaBusca="Nome da usina, núcleo do CEG, tipo ou UF"
        nota="Usinas sem coordenada no SIGA (latitude e longitude zero na fonte) não aparecem no mapa nem nesta tabela; estão no CSV completo do SIGA."
      />
    </div>
  );
}

/* ---------------------------------------------------------------- rede da EPE (P042) */

const ROTULO_CAMADA: Record<CamadaRede, string> = { existente: "Existente", planejada: "Planejada" };
const COLUNAS_LINHAS: ColunaTabela[] = [
  { id: "nome", rotulo: "Linha", tipo: "texto" },
  { id: "camada", rotulo: "Camada", tipo: "texto", categorica: true },
  { id: "tensao", rotulo: "Tensão", tipo: "numero", unidade: "kV", casas: 0, buscavel: true },
  { id: "ano", rotulo: "Ano de operação", tipo: "numero", casas: 0, buscavel: true },
  { id: "km", rotulo: "Comprimento da geometria", tipo: "numero", unidade: "km de traçado", casas: 1 },
];

function TracoCamada({ camada }: { camada: CamadaRede }) {
  return (
    <svg aria-hidden="true" width={24} height={10} viewBox="0 0 24 10" className="shrink-0">
      <path d="M1 5H23" stroke={camada === "existente" ? "var(--cor-carvao-muted)" : "var(--cor-energia)"} strokeWidth={camada === "existente" ? 1.5 : 2.5} strokeDasharray={camada === "planejada" ? "4 3" : undefined} />
    </svg>
  );
}

export function ExpansaoMapaRede({ url, tamanho, captura, fonte }: { url: string; tamanho: string | null; captura: string; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_TRANSMISSAO);
  const [pedido, setPedido] = useState(false);
  const [dados, setDados] = useState<{ geo: CamadaGeo; rede: LinhasRedeEpe } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linhaSel, setLinhaSel] = useState<string | null>(null);
  const ufNoPonto = useUfNoPonto(dados?.geo ?? null);

  useEffect(() => {
    if (!pedido || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.uf), carregar<LinhasRedeEpe>(url)]).then(
      ([geo, rede]) => vivo && setDados({ geo, rede }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [pedido, dados, url]);

  const visiveis = useMemo(() => (dados ? filtraRede(dados.rede.linhas, v.cam, Number(v.kv)) : []), [dados, v.cam, v.kv]);
  const linhas = useMemo(
    () => visiveis.map((l, i) => ({ id: `${l[0]}:${i}:${l[1] ?? ""}`, nome: l[1], camada: ROTULO_CAMADA[l[0]], tensao: l[2], ano: l[3], km: l[4] })),
    [visiveis],
  );
  const selecionada = linhaSel ? (visiveis.find((l, i) => `${l[0]}:${i}:${l[1] ?? ""}` === linhaSel) ?? null) : null;

  if (!pedido) {
    return (
      <div className="space-y-2 border border-linha bg-superficie p-4">
        <p className="text-sm text-carvao">Mapa das linhas de transmissão existentes e planejadas publicadas pela EPE no WebMap, sobre a malha de UF do IBGE, com tabela equivalente.</p>
        <button type="button" onClick={() => setPedido(true)} className="min-h-[44px] border border-energia bg-energia-fundo px-4 text-sm text-carvao hover:bg-superficie">
          Carregar o mapa da rede{tamanho ? ` (arquivo de ${tamanho})` : ""}
        </button>
      </div>
    );
  }
  if (erro) return <Erro erro={erro} arquivo={url} />;
  if (!dados) return <Carregando texto={`Carregando as linhas da EPE${tamanho ? ` (${tamanho})` : ""} e a malha de UF do IBGE…`} />;

  const clique = (p: Ponto) => {
    const uf = ufNoPonto(p);
    definir({ uf: uf ?? "" });
  };
  const nLinhas = (c: CamadaRede) => visiveis.filter((l) => l[0] === c).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <ExpansaoMarcas
          rotulo="Camadas"
          opcoes={CAMADAS_REDE.map((c) => ({ id: c, rotulo: `${ROTULO_CAMADA[c]} (${inteiro(nLinhas(c))} linhas)`, marcador: <TracoCamada camada={c} /> }))}
          valor={v.cam as CamadaRede[]}
          onMudar={(cam) => definir({ cam })}
        />
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao">
          <span className="rotulo text-mineral">Tensão mínima</span>
          <select value={v.kv} onChange={(e) => definir({ kv: e.target.value as (typeof TENSOES_MINIMAS)[number] })} className="min-h-[44px] border border-linha bg-superficie px-2">
            {TENSOES_MINIMAS.map((k) => (
              <option key={k} value={k}>
                {k === "0" ? "todas (inclusive sem tensão informada)" : `${k} kV ou mais`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MapaBase
        geo={dados.geo}
        titulo={`Linhas de transmissão da EPE, capturadas em ${captura}`}
        descricao={`Mapa do Brasil por UF com ${inteiro(visiveis.length)} linhas de transmissão da EPE (${v.cam.map((c) => ROTULO_CAMADA[c as CamadaRede].toLocaleLowerCase("pt-BR")).join(" e ")}). A tabela abaixo traz as mesmas linhas.`}
        ufSelecionada={v.uf || null}
        foco={null}
        onClique={clique}
        dica="Clique ou toque numa UF para destacá-la; escolha uma linha na tabela para destacá-la no mapa."
      >
        {() => (
          <g fill="none" pointerEvents="none">
            {visiveis
              .filter((l) => l[0] === "existente")
              .map((l, i) => (
                <path key={`e${i}`} d={l[5]} stroke="var(--cor-carvao-muted)" strokeWidth={(l[2] ?? 0) >= 500 ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
              ))}
            {visiveis
              .filter((l) => l[0] === "planejada")
              .map((l, i) => (
                <path key={`p${i}`} d={l[5]} stroke="var(--cor-energia)" strokeWidth={(l[2] ?? 0) >= 500 ? 2.6 : 1.8} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
              ))}
            {selecionada && <path d={selecionada[5]} stroke="var(--cor-carvao)" strokeWidth={4} vectorEffect="non-scaling-stroke" />}
          </g>
        )}
      </MapaBase>
      <p aria-live="polite" className="min-h-[1.5rem] text-sm text-carvao">
        {selecionada
          ? `${selecionada[1] ?? "Linha sem nome"}: ${ROTULO_CAMADA[selecionada[0]].toLocaleLowerCase("pt-BR")}, ${selecionada[2] ? `${inteiro(selecionada[2])} kV` : "tensão não informada"}, ${selecionada[3] ? `ano ${selecionada[3]}` : "ano não informado"}, ${kmTexto(selecionada[4])} de traçado.`
          : v.uf
            ? `UF destacada: ${NOME_UF[v.uf] ?? v.uf}. Os totais por UF estão na tabela de geração e rede acima.`
            : ""}
      </p>
      <TabelaInterativa
        titulo="Linhas de transmissão no mapa"
        colunas={COLUNAS_LINHAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={captura}
        nomeArquivo="expansao-linhas-epe"
        chaveUrl="rede.tab"
        ordemInicial={{ coluna: "km", direcao: "desc" }}
        selecionado={linhaSel}
        onSelecionar={setLinhaSel}
        dicaBusca="Nome da linha, tensão ou ano"
        nota="Ano e tensão zero na fonte são ausência. km de traçado da geometria publicada pela EPE (generalizada pelo servidor), não km de circuito do SIGET: as duas medidas não se somam."
      />
    </div>
  );
}
