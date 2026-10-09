"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import {
  diferencaPar,
  dominioBonito,
  escalaLinear,
  formatarDiferenca,
  formatarValor,
  ordenarPares,
  pxCaractere12,
  rotuloTick,
  sentidoDiferenca,
  ticksQueCabem,
  valido,
  type Direcao,
} from "@/lib/energia/escalas";

/**
 * Pontos pareados por entidade: realizado × referência (perda realizada ×
 * referência regulatória, DEC apurado × limite). É a forma da gramática de
 * gráficos para "realizado versus referência" (seção 8.2): cada linha mostra
 * os dois valores na mesma escala e a diferença escrita, sem pedir ao leitor
 * que subtraia de cabeça.
 *
 * - Formas diferentes, não só cor: realizado é círculo cheio, referência é
 *   losango vazado; um segmento neutro liga os dois.
 * - A diferença (realizado − referência) aparece em coluna própria, na dica e
 *   na tabela, com sinal tipográfico e sentido ("acima", "abaixo", "igual")
 *   calculado na precisão exibida. Sem cor de "bom" ou "ruim": o gráfico não
 *   classifica moralmente as entidades (seção 10.4).
 * - Ausência é distinta: marca faltante não é desenhada em zero, a diferença
 *   fica "sem dado" e, sem os dois valores, a linha diz "sem dado".
 * - Ordenação por realizado, diferença ou nome em controle nativo (rádios e
 *   botão), com nulos sempre no fim; o gráfico e a tabela usam a mesma ordem.
 * - Cada linha é alvo de foco (tabindex itinerante): setas percorrem, Home e
 *   End vão aos extremos, Enter ou Espaço selecionam; a dica aparece no foco,
 *   no toque e no hover. Seleção controlada para sincronizar com mapa e tabela.
 * - Altura por linha fixa (44 px, o alvo de toque) e rolagem vertical com o
 *   eixo fixo acima quando há muitas entidades; HTML útil já no servidor.
 */
export type ParEntidade = {
  /** Identificador estável (ex.: código da distribuidora), usado na seleção. */
  id: string;
  rotulo: string;
  valor: number | null | undefined;
  referencia: number | null | undefined;
  /** Linha complementar na dica (ex.: "vigência 2023 a 2026"). */
  detalhe?: string;
};

export type CriterioPontos = "valor" | "diferenca" | "nome";
export type OrdemPontos = { por: CriterioPontos; direcao: Direcao };

export type GraficoPontosProps = {
  titulo: string;
  itens: ParEntidade[];
  unidade: string;
  casas?: number;
  /** Ex.: "Perda realizada", "DEC apurado". */
  rotuloValor: string;
  /** Ex.: "Referência regulatória", "Limite". */
  rotuloReferencia: string;
  /** Unidade da diferença; padrão "p.p." quando a unidade é "%", senão a própria unidade. */
  unidadeDiferenca?: string;
  /** Cor do círculo (realizado), token CSS. */
  corValor?: string;
  /** Cor do contorno do losango (referência), token CSS. */
  corReferencia?: string;
  zeroNoEixo?: boolean;
  ordemInicial?: OrdemPontos;
  /** Ordem controlada (ex.: vinda da URL); com ela, use onOrdenar para atualizar. */
  ordem?: OrdemPontos;
  onOrdenar?: (o: OrdemPontos) => void;
  /** Prefixo único na página dos parâmetros de URL (`<chave>.ord` e `<chave>.dir`) da ordem escolhida, quando ela não é controlada: o link do painel e o F5 reabrem a mesma ordem. */
  chaveUrl?: string;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /**
   * Sentido da diferença na dica, na coluna de diferença e no leitor de tela. Padrão: "acima da referência", "abaixo da referência" e
   * "igual à referência". Quando a referência não é uma meta (por exemplo, o trecho anterior da própria entidade), a página diz isso
   * aqui ("maior que no trecho anterior"), para a dica não ser lida como comparação com uma meta.
   */
  textoSentido?: { acima: string; abaixo: string; igual: string };
  /** Altura de cada linha em px (mínimo recomendado 44, o alvo de toque). */
  alturaLinha?: number;
  /** Acima desta altura a área das linhas rola na vertical. */
  alturaMaxima?: number;
};

const LARGURA_SSR = 760;
const PX_CARACTERE = 6.4; // largura média de um caractere a 12 px
const LARGURA_ESTREITA = 520; // abaixo disto (celular): rótulo acima da trilha, com a largura toda para o texto
const MEIA_DIAGONAL = 7.5; // losango maior que o círculo: continua visível quando os dois coincidem

const r1 = (v: number) => Math.round(v * 10) / 10;

function cabe(texto: string, largura: number, px = PX_CARACTERE): string {
  if (texto.length * px <= largura) return texto;
  const n = Math.floor(largura / px) - 1;
  return n >= 3 ? `${texto.slice(0, n).trimEnd()}…` : "";
}

const losango = (x: number, y: number, m = MEIA_DIAGONAL) => `${r1(x)},${r1(y - m)} ${r1(x + m)},${r1(y)} ${r1(x)},${r1(y + m)} ${r1(x - m)},${r1(y)}`;

const TEXTO_SENTIDO = { acima: "acima da referência", abaixo: "abaixo da referência", igual: "igual à referência" } as const;

function textoDirecao(o: OrdemPontos): string {
  if (o.por === "nome") return o.direcao === "asc" ? "A a Z" : "Z a A";
  return o.direcao === "desc" ? "maior primeiro" : "menor primeiro";
}

export function GraficoPontos({
  titulo,
  itens,
  unidade,
  casas = 1,
  rotuloValor,
  rotuloReferencia,
  unidadeDiferenca,
  corValor = "var(--cor-energia)",
  corReferencia = "var(--cor-carvao-muted)",
  zeroNoEixo = false,
  ordemInicial = { por: "valor", direcao: "desc" },
  ordem: ordemControlada,
  onOrdenar,
  chaveUrl,
  selecionado = null,
  onSelecionar,
  textoSentido,
  alturaLinha = 44,
  alturaMaxima = 528,
}: GraficoPontosProps) {
  const sentidos = textoSentido ?? TEXTO_SENTIDO;
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(LARGURA_SSR);
  const [todas, setTodas] = useState(false);
  const [ordemInterna, setOrdemInterna] = useState<OrdemPontos>(ordemInicial);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [focoVisivel, setFocoVisivel] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const alvos = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (ativo === null) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [ativo]);

  const esquemaUrl = useMemo(
    () => ({
      por: campo(tiposUrl.opcao(["nome", "valor", "diferenca"] as const), ordemInicial.por, { param: `${chaveUrl}.ord` }),
      dir: campo(tiposUrl.opcao(["asc", "desc"] as const), ordemInicial.direcao, { param: `${chaveUrl}.dir` }),
    }),
    [chaveUrl, ordemInicial.por, ordemInicial.direcao],
  );
  const [vUrl, definirUrl] = useEstadoUrl(esquemaUrl, { sincronizar: !!chaveUrl });
  const ordem: OrdemPontos = ordemControlada ?? (chaveUrl ? { por: vUrl.por, direcao: vUrl.dir } : ordemInterna);
  const uDif = unidadeDiferenca ?? (unidade === "%" ? "p.p." : unidade);
  const nomeCriterio = (c: CriterioPontos) => (c === "valor" ? rotuloValor : c === "diferenca" ? "Diferença" : "Nome");

  function mudarOrdem(o: OrdemPontos) {
    if (!ordemControlada) {
      if (chaveUrl) definirUrl({ por: o.por, dir: o.direcao });
      else setOrdemInterna(o);
    }
    onOrdenar?.(o);
    setAnuncio(`Ordenado por: ${nomeCriterio(o.por)}, ${textoDirecao(o)}. Entidades sem dado ficam no fim.`);
  }

  const lista = ordenarPares(itens, ordem.por, ordem.direcao);
  const n = lista.length;

  if (!n) {
    return (
      <div ref={raiz} className="flex h-[88px] items-center border border-dashed border-linha px-4 text-sm text-carvao-muted">
        Nenhuma entidade com dados para exibir.
      </div>
    );
  }

  const w = largura;
  const hc = alturaLinha;
  const h = n * hc;
  // celular: o nome da entidade e a diferença ficam numa linha acima, e a trilha dos pontos usa a largura toda; a coluna lateral de 30%
  // cortava o nome ("Sudeste/Cent…", "NEOENERGIA BR…") e deixava linhas indistinguíveis
  const rotuloEmCima = w < LARGURA_ESTREITA;
  const colunaRotulo = rotuloEmCima ? 0 : Math.round(Math.min(200, Math.max(88, w * 0.3)));
  const colunaDif = w < LARGURA_ESTREITA ? 76 : 104;
  const dom = dominioBonito(
    lista.flatMap((p) => [p.valor, p.referencia]),
    { zero: zeroNoEixo },
  );
  // a trilha deixa 22 px nas pontas para o rótulo da primeira e da última marca ("74.000") não sair do gráfico
  const x = escalaLinear([dom.min, dom.max], rotuloEmCima ? [22, w - 22] : [colunaRotulo + 12, w - colunaDif - 12]);
  // marcas do eixo que cabem sem encostar na vizinha (a 390 px "500.000" e "1.000.000" saíam coladas)
  const ticksEixo = ticksQueCabem(dom.ticks, x, (t) => rotuloTick(t, dom.passo).length * PX_CARACTERE, 10);
  const temAusencia = lista.some((p) => !valido(p.valor) || !valido(p.referencia));

  const ids = lista.map((p) => p.id);
  const iSel = selecionado === null ? -1 : ids.indexOf(selecionado);
  const idCursor = cursor !== null && ids.includes(cursor) ? cursor : iSel >= 0 ? ids[iSel] : ids[0];

  const leitura = (p: ParEntidade): string => {
    const dif = diferencaPar(p.valor, p.referencia);
    const sentido = sentidoDiferenca(dif, casas);
    return (
      `${p.rotulo}: ${rotuloValor} ${formatarValor(p.valor, casas, unidade)}; ${rotuloReferencia} ${formatarValor(p.referencia, casas, unidade)}; ` +
      (sentido ? `diferença ${formatarDiferenca(dif, casas, uDif)}, ${sentidos[sentido]}` : "diferença sem dado")
    );
  };

  function selecionar(p: ParEntidade) {
    if (!onSelecionar) return;
    const novo = selecionado === p.id ? null : p.id;
    onSelecionar(novo);
    setAnuncio(novo === null ? `Seleção de ${p.rotulo} removida` : `Selecionada: ${p.rotulo}`);
  }

  function irPara(i: number) {
    const alvo = ids[Math.max(0, Math.min(n - 1, i))];
    setCursor(alvo);
    alvos.current.get(alvo)?.focus();
  }

  function teclado(ev: React.KeyboardEvent<SVGGElement>, i: number) {
    const t = ev.key;
    if (t === "ArrowDown" || t === "ArrowRight") irPara(i + 1);
    else if (t === "ArrowUp" || t === "ArrowLeft") irPara(i - 1);
    else if (t === "Home") irPara(0);
    else if (t === "End") irPara(n - 1);
    else if ((t === "Enter" || t === " ") && onSelecionar) selecionar(lista[i]);
    else if (t === "Escape") setAtivo(null);
    else return;
    ev.preventDefault();
  }

  const linhas = lista.map((p, i) => {
    const y0 = i * hc;
    const cy = rotuloEmCima ? y0 + 31 : y0 + hc / 2;
    const yTexto = rotuloEmCima ? y0 + 14 : cy + 4;
    const sel = i === iSel;
    const temV = valido(p.valor);
    const temR = valido(p.referencia);
    const dif = diferencaPar(p.valor, p.referencia);
    const xv = temV ? x(p.valor as number) : 0;
    const xr = temR ? x(p.referencia as number) : 0;
    return (
      <g
        key={p.id}
        ref={(el) => {
          if (el) alvos.current.set(p.id, el);
          else alvos.current.delete(p.id);
        }}
        role={onSelecionar ? "button" : "img"}
        aria-label={leitura(p)}
        aria-pressed={onSelecionar ? sel : undefined}
        tabIndex={p.id === idCursor ? 0 : -1}
        data-id={p.id}
        className={`outline-none focus:outline-none ${onSelecionar ? "cursor-pointer" : "cursor-default"}`}
        onKeyDown={(e) => teclado(e, i)}
        onFocus={(e) => {
          setCursor(p.id);
          setAtivo(p.id);
          let visivel = true;
          try {
            visivel = e.currentTarget.matches(":focus-visible");
          } catch {
            /* navegador sem :focus-visible: mostra o anel */
          }
          setFocoVisivel(visivel ? p.id : null);
        }}
        onBlur={() => {
          setFocoVisivel(null);
          setAtivo((a) => (a === p.id ? null : a));
        }}
        onPointerEnter={() => setAtivo(p.id)}
        onPointerDown={() => {
          setAtivo(p.id);
          setAnuncio(leitura(p));
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && ativo !== p.id) {
            setAtivo(p.id);
            setAnuncio(leitura(p));
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAtivo((a) => (a === p.id ? null : a));
        }}
        onClick={() => selecionar(p)}
      >
        {/* alvo de ponteiro e toque: a linha inteira */}
        <rect x="0" y={y0} width={w} height={hc} fill="transparent" />
        <text x="4" y={r1(yTexto)} fontSize="12" fontWeight={sel ? 600 : 400} fill={sel ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"} data-rotulo-categoria="true">
          {rotuloEmCima ? cabe(p.rotulo, w - colunaDif - 12, pxCaractere12(p.rotulo)) : cabe(p.rotulo, colunaRotulo - 8)}
        </text>
        {temV && temR && Math.abs(xv - xr) > 0.5 && <line x1={r1(xv)} x2={r1(xr)} y1={r1(cy)} y2={r1(cy)} stroke="var(--cor-mineral-soft)" strokeWidth="2" strokeLinecap="round" />}
        {temR && <polygon data-forma="losango" points={losango(xr, cy)} fill="var(--cor-superficie)" stroke={corReferencia} strokeWidth="2" strokeLinejoin="round" />}
        {temV && <circle data-forma="circulo" cx={r1(xv)} cy={r1(cy)} r="5" fill={corValor} stroke="var(--cor-superficie)" strokeWidth="2" />}
        {!temV && !temR && (
          <text data-estado="sem-dado" x={rotuloEmCima ? 12 : colunaRotulo + 12} y={r1(cy + 4)} fontSize="11" fontStyle="italic" fill="var(--cor-carvao-muted)">
            sem dado
          </text>
        )}
        <text
          x={w - 4}
          y={r1(yTexto)}
          textAnchor="end"
          fontSize="12"
          fontStyle={dif === null ? "italic" : undefined}
          fill={sel ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
          className="tabular-nums"
          data-diferenca={dif === null ? "sem-dado" : dif}
        >
          {formatarDiferenca(dif, casas, uDif)}
        </text>
        {focoVisivel === p.id && (
          <rect x="1" y={y0 + 1} width={Math.max(0, w - 2)} height={Math.max(0, hc - 2)} fill="none" stroke="var(--cor-energia)" strokeWidth="2" rx="2" />
        )}
      </g>
    );
  });

  const iAtivo = ativo === null ? -1 : ids.indexOf(ativo);
  const pa = iAtivo >= 0 ? lista[iAtivo] : null;
  let dica: React.ReactNode = null;
  if (pa) {
    const dif = diferencaPar(pa.valor, pa.referencia);
    const sentido = sentidoDiferenca(dif, casas);
    const est = 104 + (pa.detalhe ? 16 : 0);
    const y0 = iAtivo * hc;
    const acima = y0 + hc + est > h && y0 - est >= 0;
    // sem w-max: a largura da dica se ajusta ao espaço entre left e a borda do gráfico, então ela nunca cria rolagem horizontal na página
    dica = (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-20 min-w-[12rem] max-w-[17rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
        style={{ top: acima ? y0 : y0 + hc, transform: acima ? "translateY(-100%)" : undefined, left: `min(${colunaRotulo}px, calc(100% - 13rem))` }}
      >
        <p className="font-medium text-carvao">{pa.rotulo}</p>
        {pa.detalhe && <p className="text-carvao-muted">{pa.detalhe}</p>}
        <ul className="mt-1 space-y-0.5">
          <li className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-carvao-muted">
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" fill={corValor} />
              </svg>
              {rotuloValor}
            </span>
            <span className={`tabular-nums ${valido(pa.valor) ? "font-medium text-carvao" : "italic text-carvao-muted"}`}>{formatarValor(pa.valor, casas, unidade)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-carvao-muted">
              <svg width="12" height="12" aria-hidden="true">
                <polygon points={losango(6, 6, 5)} fill="var(--cor-superficie)" stroke={corReferencia} strokeWidth="1.5" />
              </svg>
              {rotuloReferencia}
            </span>
            <span className={`tabular-nums ${valido(pa.referencia) ? "font-medium text-carvao" : "italic text-carvao-muted"}`}>
              {formatarValor(pa.referencia, casas, unidade)}
            </span>
          </li>
          <li className="flex justify-between gap-3 border-t border-linha pt-0.5">
            <span className="text-carvao-muted">Diferença</span>
            <span className="text-right tabular-nums text-carvao">
              {sentido ? `${formatarDiferenca(dif, casas, uDif)}, ${sentidos[sentido]}` : "sem dado: falta um dos valores"}
            </span>
          </li>
        </ul>
      </div>
    );
  }

  const instrucoes = `${n} ${n === 1 ? "entidade" : "entidades"}, cada uma com ${rotuloValor} (círculo cheio) e ${rotuloReferencia} (losango vazado). Use Tab para entrar no gráfico, as setas para percorrer as linhas, Home e End para ir ao início e ao fim${onSelecionar ? " e Enter ou Espaço para selecionar" : ""}. A tabela com os mesmos dados está logo abaixo.`;
  const colunaOrdenada = ordem.por === "nome" ? "nome" : ordem.por;
  const ariaSort = (c: "nome" | "valor" | "diferenca") => (colunaOrdenada === c ? (ordem.direcao === "asc" ? "ascending" : "descending") : undefined);

  return (
    <div ref={raiz} className="relative w-full" data-grafico="pontos" data-rotulos={rotuloEmCima ? "acima" : "lateral"}>
      <p className="mb-1 text-sm font-medium text-carvao" data-titulo-grafico="true">
        {titulo}
        {unidade.length > 1 && <span className="font-normal text-mineral">, em {unidade}</span>}
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1">
        <fieldset className="flex flex-wrap items-center gap-x-4">
          <legend className="rotulo float-left mr-3 text-mineral">Ordenar por</legend>
          {(["valor", "diferenca", "nome"] as CriterioPontos[]).map((c) => (
            <label key={c} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input
                type="radio"
                name={`${uid}-ordem`}
                value={c}
                checked={ordem.por === c}
                onChange={() => mudarOrdem({ por: c, direcao: c === "nome" ? "asc" : "desc" })}
                className="h-4 w-4 accent-energia"
              />
              {nomeCriterio(c)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={() => mudarOrdem({ por: ordem.por, direcao: ordem.direcao === "asc" ? "desc" : "asc" })}
          aria-label={`Ordem: ${textoDirecao(ordem)}. Inverter`}
          className="rotulo inline-flex min-h-[44px] items-center gap-1.5 border border-linha px-3 text-carvao-muted hover:border-carvao hover:text-carvao"
        >
          <span aria-hidden="true">{ordem.direcao === "desc" ? "↓" : "↑"}</span>
          Ordem: {textoDirecao(ordem)}
        </button>
      </div>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" fill={corValor} />
          </svg>
          {rotuloValor} (círculo cheio)
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <polygon points={losango(7, 7, 6)} fill="var(--cor-superficie)" stroke={corReferencia} strokeWidth="2" />
          </svg>
          {rotuloReferencia} (losango vazado)
        </li>
        <li>
          Diferença: {rotuloValor} menos {rotuloReferencia}, em {uDif}
        </li>
        {temAusencia && (
          <li data-legenda="sem-dado">
            <span className="italic">sem dado</span>: a marca ausente não é desenhada e a diferença não é calculada
          </li>
        )}
        <li className="text-mineral">Valores em {unidade}</li>
      </ul>
      <p id={`${uid}-i`} className="sr-only">
        {instrucoes}
      </p>
      {/* eixo e cabeçalho da diferença fora da área rolável: continuam visíveis com muitas entidades */}
      <svg width="100%" height={rotuloEmCima ? 36 : 22} viewBox={`0 0 ${w} ${rotuloEmCima ? 36 : 22}`} aria-hidden="true" className="block overflow-visible">
        {/* celular: o cabeçalho da diferença ocupa a própria linha, para não encostar na última marca do eixo */}
        <text x={w - 4} y="11" textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
          Diferença
        </text>
        <g transform={rotuloEmCima ? "translate(0 14)" : undefined}>
          {ticksEixo.map((t) => {
            const px = x(t);
            const rotulo = rotuloTick(t, dom.passo);
            const meia = (rotulo.length * PX_CARACTERE) / 2;
            return (
              <g key={t}>
                <text x={r1(px)} y={rotuloEmCima ? 12 : 12} textAnchor={px - meia < 0 ? "start" : px + meia > w ? "end" : "middle"} fontSize="11" fill="var(--cor-mineral)" className="tabular-nums">
                  {rotulo}
                </text>
                <line x1={r1(px)} x2={r1(px)} y1="16" y2="22" stroke="var(--cor-grade)" strokeWidth="1" />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="overflow-y-auto overflow-x-hidden" style={todas ? undefined : { maxHeight: alturaMaxima }} data-rolagem={h > alturaMaxima && !todas ? "sim" : "nao"}>
        <div className="relative">
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-i`} className="block overflow-visible">
            <title id={`${uid}-t`}>{titulo}</title>
            <g aria-hidden="true">
              {iSel >= 0 && <rect data-selecionada={ids[iSel]} x="0" y={iSel * hc} width={w} height={hc} fill="var(--cor-energia-fundo)" />}
              {iAtivo >= 0 && iAtivo !== iSel && <rect x="0" y={iAtivo * hc} width={w} height={hc} fill="var(--cor-grade)" opacity="0.55" />}
              {ticksEixo.map((t) => (
                <line key={t} x1={r1(x(t))} x2={r1(x(t))} y1="0" y2={h} stroke="var(--cor-grade)" strokeWidth="1" />
              ))}
            </g>
            {linhas}
          </svg>
          {dica}
        </div>
      </div>
      {h > alturaMaxima && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-mineral" data-aviso-rolagem="true">
          <span>{todas ? `Todas as ${n.toLocaleString("pt-BR")} entidades.` : `O gráfico mostra só parte das ${n.toLocaleString("pt-BR")} entidades, na ordem escolhida.`}</span>
          <button
            type="button"
            aria-expanded={todas}
            onClick={() => setTodas((t) => !t)}
            className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao"
          >
            {todas ? "Mostrar só o início" : `Mostrar todas as ${n.toLocaleString("pt-BR")}`}
          </button>
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({n.toLocaleString("pt-BR")} {n === 1 ? "linha" : "linhas"})
        </summary>
        <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}, em ${unidade}. Ordenado por: ${nomeCriterio(ordem.por)}, ${textoDirecao(ordem)}`}</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" aria-sort={ariaSort("nome")} className="border-b border-linha px-2 py-1.5 font-medium">
                  Entidade
                </th>
                <th scope="col" aria-sort={ariaSort("valor")} className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  {rotuloValor} ({unidade})
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  {rotuloReferencia} ({unidade})
                </th>
                <th scope="col" aria-sort={ariaSort("diferenca")} className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  Diferença ({uDif})
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const sel = i === iSel;
                const ausente = sel ? "italic text-carvao-muted" : "italic text-mineral";
                const dif = diferencaPar(p.valor, p.referencia);
                return (
                  <tr key={p.id} data-id={p.id} className={`border-b border-linha ${sel ? "bg-energia-fundo" : ""}`}>
                    <th scope="row" className={`px-2 py-1 text-left text-carvao ${sel ? "font-semibold" : "font-normal"}`}>
                      {p.rotulo}
                      {sel && <span className="sr-only"> (selecionada)</span>}
                    </th>
                    <td className={`px-2 py-1 text-right ${valido(p.valor) ? "text-carvao" : ausente}`}>{formatarValor(p.valor, casas)}</td>
                    <td className={`px-2 py-1 text-right ${valido(p.referencia) ? "text-carvao" : ausente}`}>{formatarValor(p.referencia, casas)}</td>
                    <td className={`px-2 py-1 text-right ${dif === null ? ausente : "text-carvao"}`}>{formatarDiferenca(dif, casas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
