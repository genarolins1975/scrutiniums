"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_ATIVOS,
  ESQUEMA_ATIVOS,
  FASES_MAPA,
  ROTULO_ESTADO_VINCULO,
  TIPOS_USINA,
  carregarJson,
  dataTexto,
  filtrarAtivos,
  inteiro,
  linhasAtivos,
  nomeOuCnpj,
  projetar,
  raioPonto,
  resumoAtivos,
  rotuloTipo,
  textoResumoAtivos,
  type IdFaseMapa,
  type ProjecaoMalha,
  type TipoUsina,
} from "@/lib/energia/empresas";
import { num } from "@/lib/energia/formato";
import { URL_GEO, comFolga, lerViewBox, validaCamada, type CamadaGeo } from "@/lib/energia/geo";
import type { AtivosMapa } from "@/lib/energia/tipos-empresas";

/**
 * P036, mapa das usinas: cada usina do SIGA com coordenada oficial, na malha de UF do IBGE
 * (mesma projeção Albers da malha publicada), com a cor da fonte e a forma do vínculo
 * (círculo cheio: todos os proprietários com CNPJ; anel vazado: vínculo incompleto, que
 * continua identificado). A tabela abaixo é a equivalente: as mesmas usinas, na mesma ordem
 * do arquivo, com exportação do recorte.
 *
 * Carga sob demanda (contrato, seção 5.1): o arquivo das usinas (cerca de 2,8 MB) e a malha só
 * são buscados quando a pessoa pede o mapa; o pedido fica na URL (?at.mapa=1), então um link
 * compartilhado abre já carregado. Filtros (fase, tipo, vínculo, grupo) e a usina escolhida
 * também ficam na URL: voltar e avançar desfazem e refazem.
 *
 * Interação: clique ou toque escolhe a usina mais próxima (raio de 12 px com mouse, 22 px no toque); a escolha acende a
 * linha na tabela (que leva à página dela) e aparece na ficha abaixo do mapa, numa região
 * aria-live. Pelo teclado, a escolha se faz na tabela, que acende o ponto no mapa.
 */
export type EmpresasMapaAtivosProps = {
  urlAtivos: string;
  /** Usinas no SIGA (todas as fases), para dizer quantas ficam fora do mapa por falta de coordenada. */
  totalUsinas: number;
  dataSiga: string | null;
  fonte: string;
  versao: string;
};

type Carga = { estado: "ocioso" | "carregando" | "pronto" | "erro"; ativos: AtivosMapa | null; uf: CamadaGeo | null; erro: string };

async function buscaGeo(url: string): Promise<CamadaGeo> {
  const j = await carregarJson<unknown>(url);
  const erros = validaCamada(j);
  if (erros.length) throw new Error(erros.slice(0, 2).join("; "));
  return j as CamadaGeo;
}

/** Valor de uma variável CSS ("var(--serie-solar)" → cor resolvida no documento); só tokens, nunca cor escrita aqui. */
function corDoToken(el: Element, token: string): string {
  const m = /var\((--[a-z0-9-]+)\)/i.exec(token);
  return m ? getComputedStyle(el).getPropertyValue(m[1]).trim() || "currentColor" : "currentColor";
}

const LARGURA_SSR = 760;

export function EmpresasMapaAtivos({ urlAtivos, totalUsinas, dataSiga, fonte, versao }: EmpresasMapaAtivosProps) {
  const uid = useId().replace(/:/g, "");
  const [v, definir] = useEstadoUrl(ESQUEMA_ATIVOS);
  const [carga, setCarga] = useState<Carga>({ estado: "ocioso", ativos: null, uf: null, erro: "" });
  const [tentativa, setTentativa] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [largura, setLargura] = useState(LARGURA_SSR);

  useEffect(() => {
    if (!v.mapa) return;
    let vivo = true;
    setCarga((c) => ({ ...c, estado: "carregando" }));
    Promise.all([carregarJson<AtivosMapa>(urlAtivos), buscaGeo(URL_GEO.uf)])
      .then(([ativos, uf]) => vivo && setCarga({ estado: "pronto", ativos, uf, erro: "" }))
      .catch((e: unknown) => vivo && setCarga({ estado: "erro", ativos: null, uf: null, erro: e instanceof Error ? e.message : String(e) }));
    return () => {
      vivo = false;
    };
  }, [v.mapa, urlAtivos, tentativa]);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((ent) => setLargura(Math.max(280, Math.round(ent[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [carga.estado]);

  const j = carga.ativos;
  const geo = carga.uf;
  const vb = useMemo(() => {
    const b = lerViewBox(geo?.viewBox ?? "");
    return b ? comFolga(b, 0.01) : null;
  }, [geo]);
  const altura = vb ? Math.round((largura * vb.altura) / vb.largura) : 0;

  const filtro = useMemo(() => ({ fase: v.fase, tipos: v.tipos, vinculo: v.vinculo, grupo: v.grupo }), [v.fase, v.tipos, v.vinculo, v.grupo]);
  const indices = useMemo(() => (j ? filtrarAtivos(j, filtro) : []), [j, filtro]);
  const linhas = useMemo(() => (j ? linhasAtivos(j, indices) : []), [j, indices]);
  const resumo = useMemo(() => resumoAtivos(linhas), [linhas]);
  // projeção feita uma vez por arquivo (mesma ordem do arquivo)
  const xy = useMemo(() => {
    if (!j || !geo) return null;
    const p = geo.projecao as ProjecaoMalha;
    const xs = new Float64Array(j.nucleo.length);
    const ys = new Float64Array(j.nucleo.length);
    for (let i = 0; i < j.nucleo.length; i++) {
      const [x, y] = projetar(j.lon[i], j.lat[i], p);
      xs[i] = x;
      ys[i] = y;
    }
    return { xs, ys };
  }, [j, geo]);
  const iSel = useMemo(() => (j && v.sel ? j.nucleo.indexOf(v.sel) : -1), [j, v.sel]);
  const grupoAtual = j && v.grupo ? (j.grupos.find((g) => g[0] === v.grupo) ?? null) : null;
  const grupoForaDoArquivo = !!(j && v.grupo && !grupoAtual);

  // desenho: malha de UF e pontos no canvas (dezenas de milhares de marcas não cabem no DOM)
  useEffect(() => {
    const c = tela.current;
    if (!c || !geo || !vb || !xy || !j) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(largura * dpr);
    c.height = Math.round(altura * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = largura / vb.largura;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, -vb.x * s * dpr, -vb.y * s * dpr);
    ctx.clearRect(vb.x, vb.y, vb.largura, vb.altura);
    ctx.fillStyle = corDoToken(c, "var(--cor-papel)");
    ctx.strokeStyle = corDoToken(c, "var(--cor-linha)");
    ctx.lineWidth = 1 / s;
    for (const f of geo.features) {
      const p = new Path2D(f.d);
      ctx.fill(p);
      ctx.stroke(p);
    }
    const cores = new Map<string, string>(TIPOS_USINA.map((t) => [t.id, corDoToken(c, t.cor)]));
    const corOutro = corDoToken(c, "var(--cor-mineral)");
    const corAnel = corDoToken(c, "var(--cor-carvao)");
    const iVinc = j.estados.indexOf("vinculado");
    // as maiores por último, para não sumirem sob as pequenas
    const ordem = indices.slice().sort((a, b) => (j.mw[a] ?? 0) - (j.mw[b] ?? 0));
    for (const i of ordem) {
      const r = raioPonto(j.mw[i]) / s;
      ctx.beginPath();
      ctx.arc(xy.xs[i], xy.ys[i], r, 0, 2 * Math.PI);
      if (j.estado[i] === iVinc) {
        ctx.fillStyle = cores.get(j.tipo[i] ?? "") ?? corOutro;
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = corAnel;
        ctx.lineWidth = 1.2 / s;
        ctx.stroke();
      }
    }
    if (iSel >= 0) {
      ctx.beginPath();
      ctx.arc(xy.xs[iSel], xy.ys[iSel], 9 / s, 0, 2 * Math.PI);
      ctx.strokeStyle = corDoToken(c, "var(--cor-energia-dark)");
      ctx.lineWidth = 2.5 / s;
      ctx.stroke();
    }
  }, [geo, vb, xy, j, indices, iSel, largura, altura]);

  const tocar = (ev: MouseEvent<HTMLCanvasElement>) => {
    if (!vb || !xy || !j) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const s = r.width / vb.largura;
    const px = vb.x + (ev.clientX - r.left) / s;
    const py = vb.y + (ev.clientY - r.top) / s;
    // alvo de toque ampliado: com o dedo (pointer: coarse) a usina mais próxima vale até 22 px, e com o mouse, 12 px
    const alvoPx = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? 22 : 12;
    const raio = alvoPx / s;
    let melhor = -1;
    let dist = raio * raio;
    for (const i of indices) {
      const dx = xy.xs[i] - px;
      const dy = xy.ys[i] - py;
      const d = dx * dx + dy * dy;
      if (d <= dist) {
        dist = d;
        melhor = i;
      }
    }
    definir({ sel: melhor >= 0 ? j.nucleo[melhor] : "" });
  };

  const alternarTipo = (t: TipoUsina) => definir({ tipos: v.tipos.includes(t) ? v.tipos.filter((x) => x !== t) : [...v.tipos, t] });
  const temFiltro = v.fase !== "operacao" || v.tipos.length > 0 || v.vinculo !== "todos" || !!v.grupo;
  const semCoordenada = j ? totalUsinas - j.nucleo.length : null;

  if (!v.mapa) {
    return (
      <div className="space-y-2 border border-dashed border-linha bg-papel px-4 py-5">
        <p className="text-sm text-carvao">
          O mapa e a lista das usinas vêm de um arquivo próprio (coordenadas oficiais do SIGA de {dataTexto(dataSiga)}, cerca de 2,8 MB), carregado só quando você pede.
        </p>
        <button
          type="button"
          onClick={() => definir({ mapa: true })}
          className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-energia-dark hover:bg-energia-fundo"
        >
          Carregar o mapa e a lista das usinas
        </button>
      </div>
    );
  }

  return (
    <figure className="space-y-3" aria-labelledby={`${uid}-t`}>
      <figcaption id={`${uid}-t`} className="font-serif text-base text-carvao">
        Usinas do SIGA por fonte e vínculo de propriedade <span className="font-sans text-sm text-mineral">(SIGA de {dataTexto(dataSiga)})</span>
      </figcaption>

      <fieldset className="space-y-3 border border-linha bg-superficie p-3 text-sm">
        <legend className="rotulo px-1 text-mineral">Filtros do mapa e da lista</legend>
        <div role="radiogroup" aria-label="Fase no SIGA" className="flex flex-wrap gap-2">
          {[...FASES_MAPA.map((f) => ({ id: f.id as IdFaseMapa, rotulo: f.rotulo })), { id: "todas" as IdFaseMapa, rotulo: "Todas as fases" }].map((f) => (
            <label key={f.id} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.fase === f.id ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
              <input type="radio" name={`${uid}-fase`} checked={v.fase === f.id} onChange={() => definir({ fase: f.id })} className="accent-energia" />
              {f.rotulo}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de usina">
          {TIPOS_USINA.map((t) => (
            <label key={t.id} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.tipos.includes(t.id) ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
              <input type="checkbox" checked={v.tipos.includes(t.id)} onChange={() => alternarTipo(t.id)} className="accent-energia" />
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: t.cor }} />
              {t.id}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Vínculo de propriedade" className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos os vínculos"],
                ["sem_vinculo", "Só vínculo incompleto"],
              ] as const
            ).map(([id, rot]) => (
              <label key={id} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.vinculo === id ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
                <input type="radio" name={`${uid}-vinc`} checked={v.vinculo === id} onChange={() => definir({ vinculo: id })} className="accent-energia" />
                {rot}
              </label>
            ))}
          </div>
          <label className="inline-flex min-h-[44px] flex-wrap items-center gap-2 text-carvao-muted">
            Grupo do proprietário majoritário
            <select
              value={v.grupo}
              onChange={(e) => definir({ grupo: e.target.value })}
              className="min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-carvao"
              disabled={!j}
            >
              <option value="">Todos os grupos</option>
              {grupoForaDoArquivo && <option value={v.grupo}>CNPJ {v.grupo} (fora dos 200 maiores)</option>}
              {(j?.grupos ?? []).map(([cnpj, nome]) => (
                <option key={cnpj} value={cnpj}>
                  {nomeOuCnpj(nome, cnpj)}
                </option>
              ))}
            </select>
          </label>
          {temFiltro && (
            <button
              type="button"
              onClick={() => definir({ fase: "operacao", tipos: [], vinculo: "todos", grupo: "" })}
              className="rotulo inline-flex min-h-[44px] items-center px-2 text-carvao-muted underline underline-offset-4 hover:text-carvao"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </fieldset>

      <p role="status" aria-live="polite" className="text-sm text-carvao">
        {carga.estado === "pronto" ? textoResumoAtivos(resumo) : carga.estado === "carregando" ? "Carregando as usinas e a malha de UF…" : ""}
        {grupoAtual ? ` Grupo: ${nomeOuCnpj(grupoAtual[1], grupoAtual[0])}.` : ""}
      </p>
      {grupoForaDoArquivo && (
        <p className="text-sm text-carvao-muted">
          O CNPJ {v.grupo} não está entre os 200 maiores grupos que o arquivo do mapa identifica; as usinas dele estão no CSV de usinas e proprietários.
        </p>
      )}

      <div ref={caixa} className="relative w-full border border-linha bg-superficie" data-estado={carga.estado} style={vb ? { height: altura } : { minHeight: 320 }}>
        {carga.estado === "carregando" && (
          <div role="status" className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-carvao-muted">
            Carregando o arquivo das usinas e a malha de UF do IBGE.
          </div>
        )}
        {carga.estado === "erro" && (
          <div role="alert" className="flex h-[320px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-carvao">
            <p>Não foi possível carregar o mapa ({carga.erro}). As mesmas usinas estão no CSV de usinas e proprietários.</p>
            <button
              type="button"
              className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-4 text-energia-dark hover:border-carvao"
              onClick={() => setTentativa((t) => t + 1)}
            >
              Tentar de novo
            </button>
          </div>
        )}
        {carga.estado === "pronto" && vb && (
          <canvas
            ref={tela}
            onClick={tocar}
            style={{ width: largura, height: altura }}
            className="block cursor-crosshair"
            role="img"
            aria-label={`Mapa das usinas do recorte sobre as UF do Brasil. ${textoResumoAtivos(resumo)} A tabela abaixo traz as mesmas usinas.`}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda do mapa">
        {TIPOS_USINA.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.cor }} />
            {rotuloTipo(t.id)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border border-carvao" />
          anel vazado: vínculo incompleto ({ROTULO_ESTADO_VINCULO.sem_proprietario.toLocaleLowerCase("pt-BR")}, sem CNPJ ou soma diferente de 100%)
        </span>
        <span>Tamanho do ponto: até 30 MW, de 30 a 300 MW e acima de 300 MW (marca, não escala de área).</span>
      </div>

      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-acesso-mapa="">
        Pelo teclado ou com leitor de tela, escolha a usina na lista abaixo: a linha escolhida acende o ponto no mapa.
      </p>

      {j && iSel >= 0 && (
        <div aria-live="polite" className="border border-energia bg-energia-fundo px-4 py-3 text-sm text-carvao">
          <p className="font-medium">{j.nome[iSel] ?? `Núcleo ${j.nucleo[iSel]}`}</p>
          <p className="mt-1 text-carvao-muted">
            {rotuloTipo(j.tipo[iSel])} · {j.fase[iSel]} · {j.uf[iSel] ?? "UF sem dado"} · {j.mw[iSel] === null ? "potência sem dado" : `${num(j.mw[iSel] as number, 2)} MW ${j.fase[iSel] === "Operação" ? "fiscalizados" : "outorgados"}`} ·{" "}
            {ROTULO_ESTADO_VINCULO[j.estados[j.estado[iSel]]] ?? j.estados[j.estado[iSel]]}
            {j.grupo[iSel] >= 0 ? ` · grupo ${nomeOuCnpj(j.grupos[j.grupo[iSel]][1], j.grupos[j.grupo[iSel]][0])}` : ""}
          </p>
          <button type="button" onClick={() => definir({ sel: "" })} className="rotulo mt-1 inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            Limpar a escolha
          </button>
        </div>
      )}

      {j && (
        <TabelaInterativa
          titulo="Usinas do recorte do mapa (tabela equivalente)"
          colunas={COLUNAS_ATIVOS}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={versao}
          nomeArquivo="empresas-usinas-recorte"
          chaveUrl="at.tab"
          selecionado={v.sel || null}
          onSelecionar={(id) => definir({ sel: id ?? "" })}
          dicaBusca="Nome, núcleo do CEG ou UF"
          tamanhoPagina={25}
          nota={
            semCoordenada !== null && semCoordenada > 0
              ? `${inteiro(semCoordenada)} usinas do SIGA sem coordenada publicada ficam fora do mapa e desta lista; estão no CSV de usinas e proprietários. Potência fiscalizada em operação e outorgada nas demais fases: não somar entre fases.`
              : "Potência fiscalizada em operação e outorgada nas demais fases: não somar entre fases."
          }
        />
      )}
    </figure>
  );
}
