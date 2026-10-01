"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  URL_GEO,
  agruparPorChave,
  ajusteNaTela,
  aplicarZoom,
  caixaDoCaminho,
  caixaDoZoom,
  centroDaCaixa,
  comFolga,
  lerViewBox,
  limitarZoom,
  paraTela,
  pontoRotulo,
  textoViewBox,
  validaCamada,
  zoomInicial,
  type CamadaGeo,
  type FeatureGeo,
  type GrupoGeo,
  type Ponto,
  type Zoom,
} from "@/lib/energia/geo";
import { buscarRegioes, moverNaLista } from "@/lib/energia/mapa-coropletico";
import { classeDe } from "@/lib/energia/escalas";
import { FUNDO_SEM_DADO } from "@/lib/energia/mapa-calor";
import { carimbo, num, plural } from "@/lib/energia/formato";
import { carregarJson, classificacaoMedida, classeDoValor, montarAreas, textoValorMapa, type Medida, type ValorMapa } from "@/lib/energia/perdas";
import type { MunicipiosPerdas } from "@/lib/energia/tipos-perdas";

/**
 * Mapa das áreas de atuação das distribuidoras (módulo Perdas, P055).
 *
 * Por que um mapa próprio e não o MapaCoropletico: o dado é da distribuidora, não do
 * município. Cada área é o conjunto dos municípios do IBGE em que a distribuidora é a
 * única com vínculo confirmado na relação oficial da ANEEL, e recebe UMA cor, a do valor
 * da distribuidora inteira (nada é repartido entre municípios, seção 8.3). Município
 * atendido por mais de uma distribuidora tem marca própria e, ao ser escolhido, lista as
 * distribuidoras; vínculo sem confirmação aparece só como contorno tracejado; município
 * sem distribuidora fica sem cor. A tabela equivalente é a do explorador, com as mesmas
 * classes (coluna "Classe no mapa").
 *
 * Estados que nunca se confundem: valor (cor da classe, zero inclusive), sem dado
 * (hachura simples), fora da comparação (hachura cruzada: a fonte publicou, mas o ano
 * está incompleto ou tem alerta) e compartilhado (pontilhado).
 *
 * Interação: clique ou toque escolhe a área; a busca (combobox) acha distribuidora ou
 * município pelo teclado; zoom por botões, "Aproximar da seleção", arrasto quando
 * aproximado e "Restaurar". A malha municipal (1,3 MB) e a relação município ×
 * distribuidora (0,6 MB) chegam no cliente só quando o mapa aparece; enquanto isso a
 * caixa tem altura fixa e a tabela do explorador já traz os números.
 */

export type EntidadeMapa = { id: string; rotulo: string; nome: string; ufs: string };

export type PerdasMapaProps = {
  titulo: string;
  entidades: readonly EntidadeMapa[];
  valores: Readonly<Record<string, ValorMapa>>;
  medida: Medida;
  periodo: string;
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  urlMunicipios: string;
};

type Carga =
  | { estado: "carregando" }
  | { estado: "pronto"; geo: CamadaGeo; mun: MunicipiosPerdas }
  | { estado: "erro"; erro: string };

const BOTAO =
  "inline-flex h-11 min-w-[44px] items-center justify-center border border-linha bg-superficie px-2 text-sm text-carvao hover:border-carvao disabled:cursor-not-allowed disabled:text-carvao-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

const ESCALA_MAXIMA = 16;
const LIMITE_LISTA = 50;

/* fundos da legenda (HTML) equivalentes às hachuras do SVG */
const FUNDO_FORA =
  "repeating-linear-gradient(45deg, var(--cor-mineral) 0 1px, transparent 1px 5px), repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, var(--cor-superficie) 1px 5px)";
const FUNDO_COMPARTILHADO = "radial-gradient(var(--cor-carvao-muted) 1px, var(--cor-linha) 1.2px) 0 0 / 5px 5px";

async function carregarCamada(): Promise<CamadaGeo> {
  const j = await carregarJson<unknown>(URL_GEO.municipios);
  const erros = validaCamada(j);
  if (erros.length) throw new Error(erros.slice(0, 3).join("; "));
  return j as CamadaGeo;
}

/** Uma área = um <path>; não recebe hover nem seleção, então não re-renderiza com eles. */
const CamadaAreas = memo(function CamadaAreas({ grupos, fills }: { grupos: readonly GrupoGeo[]; fills: readonly string[] }) {
  return (
    <g fillRule="evenodd" stroke="var(--cor-superficie)" strokeWidth={0.35} strokeLinejoin="round">
      {grupos.map((g, i) => (
        <path key={g.id} d={g.d} fill={fills[i]} data-id={g.id} />
      ))}
    </g>
  );
});

const CamadaMunicipios = memo(function CamadaMunicipios({
  features,
  fill,
  traco,
  tracejado,
}: {
  features: readonly FeatureGeo[];
  fill: string;
  traco: string;
  tracejado?: boolean;
}) {
  return (
    <g fillRule="evenodd" stroke={traco} strokeWidth={0.6} strokeDasharray={tracejado ? "2 2" : undefined} strokeLinejoin="round">
      {features.map((f) => (
        <path key={f.id} d={f.d} fill={fill} data-mun={f.id} />
      ))}
    </g>
  );
});

/** Só contorno, por cima da área (vínculo só pelo cadastro de MMGD): não captura o ponteiro. */
const CamadaMarcas = memo(function CamadaMarcas({ features, tracejado }: { features: readonly FeatureGeo[]; tracejado: string }) {
  return (
    <g fill="none" stroke="var(--cor-carvao)" strokeWidth={0.9} strokeDasharray={tracejado} strokeLinejoin="round" pointerEvents="none" aria-hidden="true">
      {features.map((f) => (
        <path key={f.id} d={f.d} />
      ))}
    </g>
  );
});

const CamadaContornos = memo(function CamadaContornos({ geo }: { geo: CamadaGeo }) {
  if (!geo.contornos?.uf?.length) return null;
  return (
    <g fill="none" stroke="var(--cor-carvao-muted)" strokeWidth={0.9} strokeLinejoin="round" pointerEvents="none" aria-hidden="true">
      {geo.contornos.uf.map((c) => (
        <path key={c.id} d={c.d} />
      ))}
    </g>
  );
});

type Dica = { tipo: "area" | "mun"; id: string; x?: number; y?: number; origem: "ponteiro" | "toque" | "teclado" };
type ItemBusca = { id: string; nome: string; uf: string; tipo: "dist" | "mun" };

export function PerdasMapa({ titulo, entidades, valores, medida, periodo, selecionado, onSelecionar, urlMunicipios }: PerdasMapaProps) {
  const uid = useId().replace(/:/g, "");

  /* carga da malha e da relação município × distribuidora */
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    Promise.all([carregarCamada(), carregarJson<MunicipiosPerdas>(urlMunicipios)]).then(
      ([geo, mun]) => vivo && setCarga({ estado: "pronto", geo, mun }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [urlMunicipios, tentativa]);
  const geo = carga.estado === "pronto" ? carga.geo : null;
  const mun = carga.estado === "pronto" ? carga.mun : null;

  const porEntidade = useMemo(() => new Map(entidades.map((e) => [e.id, e])), [entidades]);
  const porMunicipio = useMemo(() => new Map((geo?.features ?? []).map((f) => [f.id, f])), [geo]);
  const areas = useMemo(() => (geo && mun ? montarAreas(mun, geo.features.map((f) => f.id)) : null), [geo, mun]);
  const dono = useMemo(() => {
    const m = new Map<string, string>();
    areas?.exclusivos.forEach((cods, cnpj) => cods.forEach((c) => m.set(c, cnpj)));
    return m;
  }, [areas]);
  const grupos = useMemo(() => (geo ? agruparPorChave(geo.features, (f) => dono.get(f.id)) : []), [geo, dono]);
  const porGrupo = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);
  const featuresDe = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => porMunicipio.get(id)).filter((f): f is FeatureGeo => !!f);
  const compartilhados = useMemo(() => featuresDe(areas?.compartilhados.map((c) => c.id)), [areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const soNaoConf = useMemo(() => featuresDe(areas?.soNaoConfirmados.map((c) => c.id)), [areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const semVinculo = useMemo(() => featuresDe(areas?.semVinculo), [areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const soMmgd = useMemo(() => featuresDe(areas ? Array.from(areas.soMmgd) : []), [areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const vinculosMun = useMemo(() => {
    const m = new Map<string, { cnpjs: string[]; confirmado: boolean }>();
    for (const c of areas?.compartilhados ?? []) m.set(c.id, { cnpjs: c.cnpjs, confirmado: true });
    for (const c of areas?.soNaoConfirmados ?? []) m.set(c.id, { cnpjs: c.cnpjs, confirmado: false });
    return m;
  }, [areas]);

  /* classes e preenchimento: os mesmos cortes da legenda e da coluna "Classe no mapa" */
  const classes = useMemo(() => classificacaoMedida(medida, valores), [medida, valores]);
  const hach = `${uid}-sem-dado`;
  const hachFora = `${uid}-fora`;
  const hachComp = `${uid}-comp`;
  const fills = useMemo(
    () =>
      grupos.map((g) => {
        const v = valores[g.id];
        if (!v || v.estado === "sem-dado") return `url(#${hach})`;
        if (v.estado === "fora") return `url(#${hachFora})`;
        const k = classeDe(v.v, classes);
        return typeof k === "number" ? medida.cores[k] : `url(#${hach})`;
      }),
    [grupos, valores, classes, medida, hach, hachFora],
  );
  const contagem = useMemo(() => {
    let valor = 0;
    let semDado = 0;
    let fora = 0;
    for (const e of entidades) {
      const v = valores[e.id];
      if (!v || v.estado === "sem-dado") semDado++;
      else if (v.estado === "fora") fora++;
      else valor++;
    }
    return { valor, semDado, fora };
  }, [entidades, valores]);

  /* tamanho medido e enquadramento */
  const caixaRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 760, h: 520 });
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
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const zAtual = base ? limitarZoom(base, zoom ?? zoomInicial(base), ESCALA_MAXIMA) : null;
  const vb = base && zAtual ? caixaDoZoom(base, zAtual) : null;
  const aj = vb ? ajusteNaTela(vb, tam.w, tam.h) : null;
  const noZoom = !!zAtual && zAtual.escala > 1;

  /* textos */
  const [leitura, setLeitura] = useState("");
  const nomeDe = (id: string) => porEntidade.get(id)?.rotulo ?? id;
  const valorDe = (id: string) => {
    const v = valores[id];
    return v ? textoValorMapa(v, medida) : "sem dado (sem balanço no SAMP)";
  };
  const fraseArea = (id: string) => {
    const e = porEntidade.get(id);
    const v = valores[id];
    const classe = v && v.estado === "valor" ? `, classe ${classeDoValor(v, classes)}` : "";
    return `${e ? `${e.rotulo} (${e.ufs || "UF não informada"})` : id}: ${valorDe(id)}${classe}`;
  };
  const fraseMunicipio = (cod: string) => {
    const f = porMunicipio.get(cod);
    const nome = f ? `${f.nome} (${f.uf})` : cod;
    const vinc = vinculosMun.get(cod);
    if (dono.has(cod)) return `${nome}: área de ${fraseArea(dono.get(cod)!)}${areas?.soMmgd.has(cod) ? " (vínculo só pelo cadastro de MMGD)" : ""}`;
    if (!vinc) return `${nome}: nenhuma distribuidora ligada na relação oficial`;
    const lista = vinc.cnpjs.map((c) => `${nomeDe(c)} (${valorDe(c)})`).join("; ");
    return vinc.confirmado ? `${nome}: atendido por mais de uma distribuidora: ${lista}` : `${nome}: só vínculo não confirmado com ${lista}`;
  };

  /* seleção e município em foco (compartilhado ou sem confirmação) */
  const [munFoco, setMunFoco] = useState<string | null>(null);
  function selecionar(id: string | null) {
    onSelecionar(id);
    setLeitura(id ? `Selecionada: ${fraseArea(id)}.` : "Seleção removida.");
  }

  /* dica */
  const [dica, setDica] = useState<Dica | null>(null);
  const tipoPonteiro = useRef("mouse");
  const arrasto = useRef<{ x: number; y: number; centro: Ponto } | null>(null);
  const arrastou = useRef(false);
  const alvoDe = (t: EventTarget | null): { tipo: "area" | "mun"; id: string } | null => {
    const el = t as Element | null;
    if (!el || typeof el.getAttribute !== "function") return null;
    const a = el.getAttribute("data-id");
    if (a) return { tipo: "area", id: a };
    const m = el.getAttribute("data-mun");
    return m ? { tipo: "mun", id: m } : null;
  };
  const posicao = (ev: { clientX: number; clientY: number }): Ponto | null => {
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
      setZoom(limitarZoom(base, { escala: zAtual.escala, centro: [a.centro[0] - dx / aj.s, a.centro[1] - dy / aj.s] }, ESCALA_MAXIMA));
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const alvo = alvoDe(ev.target);
    const pos = posicao(ev);
    if (!alvo || !pos) {
      if (dica?.origem === "ponteiro") setDica(null);
      return;
    }
    if (dica?.id !== alvo.id) setLeitura(alvo.tipo === "area" ? fraseArea(alvo.id) : fraseMunicipio(alvo.id));
    setDica({ ...alvo, origem: "ponteiro", x: pos[0], y: pos[1] });
  }

  function aoClicar(ev: React.MouseEvent<SVGSVGElement>) {
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    const alvo = alvoDe(ev.target);
    const pos = posicao(ev);
    if (!alvo) {
      setDica(null);
      return;
    }
    if (alvo.tipo === "area") {
      setMunFoco(null);
      const novo = alvo.id === selecionado ? null : alvo.id;
      selecionar(novo);
      if (novo && pos && tipoPonteiro.current !== "mouse") setDica({ ...alvo, origem: "toque", x: pos[0], y: pos[1] });
    } else {
      setMunFoco(alvo.id);
      setLeitura(fraseMunicipio(alvo.id));
      if (pos && tipoPonteiro.current !== "mouse") setDica({ ...alvo, origem: "toque", x: pos[0], y: pos[1] });
    }
  }

  /* zoom */
  const caixaSel = useMemo(() => {
    const g = selecionado ? porGrupo.get(selecionado) : null;
    return g ? caixaDoCaminho(g.d) : null;
  }, [selecionado, porGrupo]);
  function zoomPor(fator: number) {
    if (!base || !zAtual) return;
    const z = aplicarZoom(base, zAtual, fator, ESCALA_MAXIMA, fator > 1 && caixaSel ? centroDaCaixa(caixaSel) : null);
    setZoom(z);
    setDica(null);
    setLeitura(z.escala > 1 ? `Mapa aproximado ${num(z.escala, 0)} vezes.` : "Mapa no enquadramento inicial.");
  }
  function aproximarDaSelecao() {
    if (!base || !caixaSel || !selecionado) return;
    const c = comFolga(caixaSel, 0.08);
    const escala = Math.min(base.largura / c.largura, base.altura / c.altura);
    setZoom(limitarZoom(base, { escala, centro: centroDaCaixa(c) }, ESCALA_MAXIMA));
    setDica(null);
    setLeitura(`Mapa aproximado na área de ${nomeDe(selecionado)}.`);
  }
  function restaurar() {
    setZoom(null);
    setDica(null);
    setLeitura("Mapa no enquadramento inicial.");
  }

  /* busca: distribuidoras e municípios */
  const itensBusca = useMemo<ItemBusca[]>(
    () => [
      ...entidades.map((e) => ({ id: e.id, nome: `${e.rotulo} · ${e.nome}`, uf: e.ufs, tipo: "dist" as const })),
      ...(geo?.features ?? []).map((f) => ({ id: f.id, nome: f.nome, uf: f.uf, tipo: "mun" as const })),
    ],
    [entidades, geo],
  );
  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const resultados = useMemo(() => {
    const r = buscarRegioes(itensBusca, consulta, LIMITE_LISTA);
    // distribuidoras primeiro: a busca por "light" acha a empresa antes do município homônimo
    const ordem = [...r.itens.filter((i) => i.tipo === "dist"), ...r.itens.filter((i) => i.tipo === "mun")];
    return { itens: consulta.trim() ? ordem : ordem.filter((i) => i.tipo === "dist"), total: r.total };
  }, [itensBusca, consulta]);
  useEffect(() => {
    if (aberta && ativo >= 0) document.getElementById(`${uid}-op-${ativo}`)?.scrollIntoView?.({ block: "nearest" });
  }, [aberta, ativo, uid]);

  function escolher(item: ItemBusca) {
    setAberta(false);
    setAtivo(-1);
    if (item.tipo === "dist") {
      setConsulta(nomeDe(item.id));
      setMunFoco(null);
      selecionar(item.id);
      setDica({ tipo: "area", id: item.id, origem: "teclado" });
      return;
    }
    setConsulta(`${item.nome} (${item.uf})`);
    const d = dono.get(item.id);
    if (d) {
      setMunFoco(null);
      selecionar(d);
    } else {
      setMunFoco(item.id);
      setLeitura(fraseMunicipio(item.id));
    }
    setDica({ tipo: "mun", id: item.id, origem: "teclado" });
  }

  function teclaBusca(ev: React.KeyboardEvent<HTMLInputElement>) {
    const n = resultados.itens.length;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp" || ev.key === "PageDown" || ev.key === "PageUp") {
      const prox = moverNaLista(aberta ? ativo : -1, ev.key, n);
      if (prox === null) return;
      ev.preventDefault();
      setAberta(true);
      setAtivo(prox);
      const it = resultados.itens[prox];
      setDica({ tipo: it.tipo === "dist" ? "area" : "mun", id: it.id, origem: "teclado" });
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

  /* posição da dica: ponteiro, ou ponto de rótulo no teclado */
  const pontoDaDica = (d: Dica): Ponto | null => {
    if (d.x !== undefined && d.y !== undefined) return [d.x, d.y];
    if (!vb) return null;
    let p: Ponto | null = null;
    if (d.tipo === "mun") {
      const f = porMunicipio.get(d.id);
      p = f ? pontoRotulo(f.d) : null;
    } else {
      const g = porGrupo.get(d.id);
      const c = g ? caixaDoCaminho(g.d) : null;
      p = c ? centroDaCaixa(c) : null;
    }
    const t = p ? paraTela(p, vb, tam.w, tam.h) : null;
    return t && t[0] >= 0 && t[0] <= tam.w && t[1] >= 0 && t[1] <= tam.h ? t : null;
  };
  const dicaPos = dica ? pontoDaDica(dica) : null;
  const dicaTexto = dica ? (dica.tipo === "area" ? fraseArea(dica.id) : fraseMunicipio(dica.id)) : "";
  const destaque = dica?.tipo === "area" && dica.id !== selecionado ? porGrupo.get(dica.id) ?? null : null;
  const destaqueMun = dica?.tipo === "mun" ? porMunicipio.get(dica.id) ?? null : null;
  const selGrupo = selecionado ? porGrupo.get(selecionado) ?? null : null;
  const selCompart = useMemo(() => featuresDe(selecionado ? areas?.compartilhadosDe.get(selecionado) : []), [selecionado, areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const selNaoConf = useMemo(() => featuresDe(selecionado ? areas?.naoConfirmadosDe.get(selecionado) : []), [selecionado, areas, porMunicipio]); // eslint-disable-line react-hooks/exhaustive-deps
  const munFocoInfo = munFoco ? vinculosMun.get(munFoco) ?? null : null;

  return (
    <div className="relative w-full min-w-0">
      {/* legenda: unidade, classes fixas e os estados sem cor de classe */}
      <div className="mb-3">
        <p className="rotulo text-mineral">
          {medida.rotulo} · {medida.unidade} · {periodo}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-carvao-muted" aria-label={`Legenda: classes de ${medida.rotulo.toLowerCase()}, em ${medida.unidade}`}>
          {classes.classes.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5" data-classe={i}>
              <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: medida.cores[i] }} />
              {c.rotulo}
              <span className="tabular-nums">({num(c.contagem, 0)})</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5" data-estado="fora">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: FUNDO_FORA }} />
            fora da comparação <span className="tabular-nums">({num(contagem.fora, 0)})</span>
          </li>
          <li className="flex items-center gap-1.5" data-estado="sem-dado">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: FUNDO_SEM_DADO }} />
            sem dado <span className="tabular-nums">({num(contagem.semDado, 0)})</span>
          </li>
          <li className="flex items-center gap-1.5" data-estado="compartilhado">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: FUNDO_COMPARTILHADO }} />
            município com mais de uma distribuidora
          </li>
          <li className="flex items-center gap-1.5" data-estado="so-mmgd">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-dotted border-carvao" />
            vínculo só pelo cadastro de MMGD (contorno pontilhado, cor da área)
          </li>
          <li className="flex items-center gap-1.5" data-estado="sem-vinculo">
            <span aria-hidden="true" className="inline-block h-3 w-5 border border-dashed border-carvao-muted bg-superficie" />
            sem distribuidora confirmada
          </li>
        </ul>
        <p className="mt-1 text-xs text-carvao-muted">
          Quebras fixas, as mesmas em todos os anos (cada classe inclui o limite inferior). Cada área tem a cor do valor da distribuidora inteira; nenhum número é dividido entre municípios.
        </p>
      </div>

      {/* busca e zoom */}
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <label htmlFor={`${uid}-busca`} className="rotulo mb-1 block text-mineral">
            Buscar distribuidora ou município
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
            value={consulta}
            placeholder="Sigla, nome, UF ou município"
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
            className="h-11 w-full border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          />
          <p id={`${uid}-ajuda`} className="sr-only">
            Digite a sigla ou o nome da distribuidora, ou o nome do município. Setas percorrem a lista; Enter seleciona; Esc fecha a lista.
          </p>
          <ul
            id={`${uid}-lista`}
            role="listbox"
            hidden={!aberta}
            aria-label="Distribuidoras e municípios encontrados"
            onPointerDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto border border-linha bg-superficie shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
          >
            {resultados.itens.map((it, i) => (
              <li
                key={`${it.tipo}-${it.id}`}
                id={`${uid}-op-${i}`}
                role="option"
                aria-selected={i === ativo}
                onClick={() => escolher(it)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 border-b border-linha px-3 py-1 text-sm last:border-b-0 ${
                  i === ativo ? "bg-energia-fundo text-carvao shadow-[inset_4px_0_0_var(--cor-energia)]" : "text-carvao hover:bg-papel"
                }`}
              >
                <span>
                  {it.nome}
                  {it.uf && <span className="text-carvao-muted">, {it.uf}</span>}
                  <span className="text-carvao-muted"> ({it.tipo === "dist" ? "distribuidora" : "município"})</span>
                </span>
                {it.tipo === "dist" && <span className="whitespace-nowrap tabular-nums text-carvao-muted">{valores[it.id]?.estado === "valor" ? valorDe(it.id) : ""}</span>}
              </li>
            ))}
            {resultados.itens.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-xs text-carvao-muted">
                {geo || !consulta ? "Nenhum resultado para essa busca." : "A lista de municípios chega com a malha; distribuidoras já podem ser buscadas."}
              </li>
            )}
          </ul>
        </div>
        <div role="group" aria-label="Zoom do mapa" className="flex flex-wrap gap-1">
          <button type="button" className={BOTAO} onClick={() => zoomPor(2)} disabled={!zAtual || zAtual.escala >= ESCALA_MAXIMA} aria-label="Aproximar" title="Aproximar">
            +
          </button>
          <button type="button" className={BOTAO} onClick={() => zoomPor(0.5)} disabled={!noZoom} aria-label="Afastar" title="Afastar">
            −
          </button>
          <button type="button" className={`${BOTAO} rotulo px-3`} onClick={aproximarDaSelecao} disabled={!caixaSel}>
            Aproximar da seleção
          </button>
          <button type="button" className={`${BOTAO} rotulo px-3`} onClick={restaurar} disabled={!noZoom}>
            Restaurar
          </button>
        </div>
      </div>

      {/* mapa com altura fixa: a chegada da malha não desloca a página */}
      <div ref={caixaRef} className="relative h-[380px] overflow-hidden border border-linha bg-superficie sm:h-[540px]" data-estado={geo ? "pronto" : carga.estado}>
        {!geo && carga.estado !== "erro" && (
          <div role="status" className="flex h-full items-center justify-center px-6 text-center text-sm text-carvao-muted">
            Carregando a malha municipal do IBGE e a relação entre municípios e distribuidoras. Os números já estão na tabela abaixo.
          </div>
        )}
        {carga.estado === "erro" && (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-carvao">
            <p>Não foi possível carregar a malha ou a relação de municípios ({carga.erro}). Os valores continuam na tabela abaixo, por distribuidora.</p>
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
            <title id={`${uid}-t`}>{`${titulo}: áreas de atuação das distribuidoras, ${medida.rotulo.toLowerCase()} em ${periodo}. A busca acima escolhe uma distribuidora ou um município pelo teclado.`}</title>
            <defs>
              <pattern id={hach} patternUnits="userSpaceOnUse" width={6 * (aj ? 1 / aj.s : 1)} height={6 * (aj ? 1 / aj.s : 1)} patternTransform="rotate(45)">
                <rect width="100%" height="100%" fill="var(--cor-superficie)" />
                <rect width={1.2 * (aj ? 1 / aj.s : 1)} height="100%" fill="var(--cor-mineral)" />
              </pattern>
              <pattern id={hachFora} patternUnits="userSpaceOnUse" width={6 * (aj ? 1 / aj.s : 1)} height={6 * (aj ? 1 / aj.s : 1)} patternTransform="rotate(45)">
                <rect width="100%" height="100%" fill="var(--cor-superficie)" />
                <rect width={1.2 * (aj ? 1 / aj.s : 1)} height="100%" fill="var(--cor-mineral)" />
                <rect width="100%" height={1.2 * (aj ? 1 / aj.s : 1)} fill="var(--cor-mineral)" />
              </pattern>
              <pattern id={hachComp} patternUnits="userSpaceOnUse" width={5 * (aj ? 1 / aj.s : 1)} height={5 * (aj ? 1 / aj.s : 1)}>
                <rect width="100%" height="100%" fill="var(--cor-linha)" />
                <circle cx={2.5 * (aj ? 1 / aj.s : 1)} cy={2.5 * (aj ? 1 / aj.s : 1)} r={1 * (aj ? 1 / aj.s : 1)} fill="var(--cor-carvao-muted)" />
              </pattern>
            </defs>
            <CamadaAreas grupos={grupos} fills={fills} />
            <CamadaMarcas features={soMmgd} tracejado="1 2" />
            <CamadaMunicipios features={compartilhados} fill={`url(#${hachComp})`} traco="var(--cor-superficie)" />
            <CamadaMunicipios features={soNaoConf} fill="var(--cor-superficie)" traco="var(--cor-carvao-muted)" tracejado />
            <CamadaMunicipios features={semVinculo} fill="var(--cor-superficie)" traco="var(--cor-carvao-muted)" tracejado />
            <CamadaContornos geo={geo} />
            {destaque && <path d={destaque.d} fill="none" fillRule="evenodd" stroke="var(--cor-carvao)" strokeWidth={1.5} pointerEvents="none" data-destaque={destaque.id} />}
            {destaqueMun && <path d={destaqueMun.d} fill="none" stroke="var(--cor-carvao)" strokeWidth={2} pointerEvents="none" />}
            {selGrupo && (
              <g fill="none" fillRule="evenodd" strokeLinejoin="round" pointerEvents="none" data-selecionado={selGrupo.id}>
                <path d={selGrupo.d} stroke="var(--cor-superficie)" strokeWidth={4} />
                <path d={selGrupo.d} stroke="var(--cor-carvao)" strokeWidth={2} />
              </g>
            )}
            {selecionado && (selCompart.length > 0 || selNaoConf.length > 0) && (
              <g fill="none" strokeLinejoin="round" pointerEvents="none">
                {selCompart.map((f) => (
                  <path key={`c${f.id}`} d={f.d} stroke="var(--cor-carvao)" strokeWidth={1.6} />
                ))}
                {selNaoConf.map((f) => (
                  <path key={`n${f.id}`} d={f.d} stroke="var(--cor-carvao)" strokeWidth={1.2} strokeDasharray="3 2" />
                ))}
              </g>
            )}
          </svg>
        )}
        {dica && dicaPos && dicaTexto && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 w-[15rem] max-w-full border border-linha bg-superficie px-3 py-2 text-xs leading-snug text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            style={{ left: `clamp(0px, ${dicaPos[0]}px - 7.5rem, 100% - 15rem)`, top: dicaPos[1], transform: dicaPos[1] > 110 ? "translateY(calc(-100% - 12px))" : "translateY(16px)" }}
          >
            {dicaTexto}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      {/* município escolhido sem dono único: lista quem atende */}
      {munFoco && (
        <div className="mt-2 border border-linha bg-papel px-3 py-2 text-sm text-carvao" data-municipio-foco={munFoco}>
          <p>{fraseMunicipio(munFoco)}.</p>
          {munFocoInfo && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {munFocoInfo.cnpjs.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-energia-dark hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
                    onClick={() => {
                      selecionar(c);
                      setMunFoco(null);
                    }}
                  >
                    Ver {nomeDe(c)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="rotulo mt-1 inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4" onClick={() => setMunFoco(null)}>
            Fechar
          </button>
        </div>
      )}

      {/* resumo do desenho, malha e regra */}
      <div id={`${uid}-r`} className="mt-2 space-y-1 text-xs leading-relaxed text-carvao-muted">
        <p className="tabular-nums">
          {plural(entidades.length, "distribuidora", "distribuidoras")}: {num(contagem.valor, 0)} na comparação, {num(contagem.fora, 0)} fora da comparação (hachura cruzada) e {num(contagem.semDado, 0)} sem dado (hachura simples).
          {areas &&
            ` ${plural(areas.compartilhados.length, "município atendido", "municípios atendidos")} por mais de uma distribuidora (pontilhado), ${plural(areas.soNaoConfirmados.length, "município", "municípios")} só com vínculo não confirmado e ${plural(areas.semVinculo.length, "município", "municípios")} sem distribuidora (contorno tracejado).`}
          {areas && areas.foraDaMalha.length > 0 && ` Código da relação ausente da malha do IBGE: ${areas.foraDaMalha.join(", ")}.`}
        </p>
        {geo && (
          <p>
            Malha municipal do IBGE{geo.malha.revisao ? `, revisão de ${geo.malha.revisao}` : ""}, capturada em {carimbo(geo.capturado_em)}; projeção {geo.projecao.nome} (áreas proporcionais às reais). Relação município × distribuidora de {mun?.ano_relacao ?? "ano não informado"}.
          </p>
        )}
        <p>Clique ou toque numa área para escolher a distribuidora; num município pontilhado, para ver quem o atende. Pelo teclado, use a busca. Com zoom, arraste o mapa para movê-lo.</p>
      </div>
    </div>
  );
}
