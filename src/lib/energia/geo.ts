/**
 * Geometria oficial publicada para os mapas do Setor Elétrico
 * (public/energia/geo/uf.json e municipios.json, geradas por
 * pipeline/energia/geo.py a partir da malha territorial do IBGE) e
 * utilitários puros sobre ela, testáveis em node.
 *
 * Por que aqui e não no componente: o mapa coroplético, a tabela equivalente e
 * qualquer página que precise de rótulo, enquadramento ou agrupamento de
 * regiões usam a mesma leitura do caminho SVG, a mesma caixa e o mesmo ponto de
 * rótulo. O arquivo publicado já vem projetado (Albers cônica equivalente) e
 * quantizado em inteiros, com y para baixo: aqui só se lê e se enquadra, nunca
 * se reprojeta nem se inventa geometria.
 */

/* ---------- tipos do arquivo publicado ---------- */

export type FeatureGeo = {
  /** Código IBGE: 2 dígitos para UF, 7 para município. */
  id: string;
  nome: string;
  /** Sigla da UF (em grupos que cruzam UFs, siglas separadas por "/"). */
  uf: string;
  /** Caminho SVG compacto: um subcaminho "M x y l dx dy ... z" por anel. */
  d: string;
};

export type ContornoGeo = { id: string; uf: string; d: string };

export type CamadaGeo = {
  camada: string;
  titulo: string;
  fonte: string;
  url: string;
  url_nomes: string;
  /** Carimbo UTC da captura do original. */
  capturado_em: string;
  /** sha256 do arquivo original guardado no bronze. */
  sha256: string;
  sha256_nomes: string;
  bronze: string;
  malha: {
    revisao: number | null;
    nota_liberacao: string;
    data_nota: string | null;
    documentacao: string;
    qualidade: string;
    formato_original: string;
  };
  projecao: {
    nome: string;
    paralelos_padrao: number[];
    meridiano_central: number;
    latitude_origem: number;
    superficie: string;
    /** Metros por unidade do SVG. */
    unidade_svg_m: number;
    origem_m: [number, number];
    eixo_y: string;
  };
  simplificacao: { metodo: string; tolerancia_m: number; arcos_com_tolerancia_reduzida: number; garantia: string };
  viewBox: string;
  contagem: { features: number; poligonos: number; poligonos_origem: number; aneis: number };
  conciliacao: { nomes_sem_geometria: string[] };
  /** Divisas de UF pela união exata dos municípios (só na camada municipal). */
  contornos?: { uf: ContornoGeo[] };
  features: FeatureGeo[];
};

/** Endereços públicos das camadas (carregadas no cliente só quando a página pede). */
export const URL_GEO = {
  uf: "/energia/geo/uf.json",
  municipios: "/energia/geo/municipios.json",
} as const;

export type Ponto = [number, number];
export type Caixa = { x: number; y: number; largura: number; altura: number };

/* ---------- leitura do caminho ---------- */

// qualquer letra vira token: comando não suportado (curva, arco) é erro, nunca é pulado em silêncio
const TOKENS = /[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/**
 * Anéis (coordenadas absolutas) de um caminho SVG com M, L, H, V e Z, nas
 * formas absoluta e relativa. Cobre o formato publicado (M absoluto, l
 * relativo, z) e caminhos escritos à mão. Curvas não são aceitas: a malha
 * publicada só tem segmentos de reta.
 */
export function lerCaminho(d: string): Ponto[][] {
  const t = d.match(TOKENS) ?? [];
  const aneis: Ponto[][] = [];
  let atual: Ponto[] | null = null;
  let x = 0;
  let y = 0;
  let inicio: Ponto = [0, 0];
  let cmd = "";
  let i = 0;
  const numero = () => Number(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    else if (!cmd) throw new Error(`lerCaminho: número sem comando em "${d.slice(0, 40)}"`);
    switch (cmd) {
      case "M":
      case "m": {
        const nx = numero();
        const ny = numero();
        // "m" é relativo ao ponto corrente (depois de z, o início do subcaminho anterior;
        // no primeiro subcaminho, a origem, o que o torna absoluto)
        if (cmd === "m") {
          x += nx;
          y += ny;
        } else {
          x = nx;
          y = ny;
        }
        atual = [[x, y]];
        aneis.push(atual);
        inicio = [x, y];
        // pares seguintes ao moveto são lineto implícitos
        cmd = cmd === "M" ? "L" : "l";
        break;
      }
      case "L":
      case "l": {
        const nx = numero();
        const ny = numero();
        [x, y] = cmd === "l" ? [x + nx, y + ny] : [nx, ny];
        atual?.push([x, y]);
        break;
      }
      case "H":
      case "h": {
        const nx = numero();
        x = cmd === "h" ? x + nx : nx;
        atual?.push([x, y]);
        break;
      }
      case "V":
      case "v": {
        const ny = numero();
        y = cmd === "v" ? y + ny : ny;
        atual?.push([x, y]);
        break;
      }
      case "Z":
      case "z":
        // fecha o anel: o ponto corrente volta ao início do subcaminho
        [x, y] = inicio;
        cmd = "";
        break;
      default:
        throw new Error(`lerCaminho: comando "${cmd}" não suportado`);
    }
    if (Number.isNaN(x) || Number.isNaN(y)) throw new Error(`lerCaminho: coordenada inválida em "${d.slice(0, 40)}"`);
  }
  return aneis.filter((a) => a.length > 0);
}

/* ---------- medidas ---------- */

/** Área pelo laço de Gauss; em coordenadas de tela (y para baixo), positiva no sentido horário. */
export function areaAssinada(anel: readonly Ponto[]): number {
  let s = 0;
  for (let i = 0, n = anel.length; i < n; i++) {
    const [x0, y0] = anel[i];
    const [x1, y1] = anel[(i + 1) % n];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

export function caixaDeAneis(aneis: readonly (readonly Ponto[])[]): Caixa | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const a of aneis) {
    for (const [x, y] of a) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

export function caixaDoCaminho(d: string): Caixa | null {
  return caixaDeAneis(lerCaminho(d));
}

/** Caixa que envolve várias caixas (null quando não há nenhuma). */
export function uniaoDeCaixas(caixas: readonly (Caixa | null)[]): Caixa | null {
  const vs = caixas.filter((c): c is Caixa => !!c);
  if (!vs.length) return null;
  const x0 = Math.min(...vs.map((c) => c.x));
  const y0 = Math.min(...vs.map((c) => c.y));
  const x1 = Math.max(...vs.map((c) => c.x + c.largura));
  const y1 = Math.max(...vs.map((c) => c.y + c.altura));
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

export function caixaDeFeatures(features: readonly FeatureGeo[]): Caixa | null {
  return uniaoDeCaixas(features.map((f) => caixaDoCaminho(f.d)));
}

export function lerViewBox(vb: string): Caixa | null {
  const n = vb.trim().split(/[\s,]+/).map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[2] <= 0 || n[3] <= 0) return null;
  return { x: n[0], y: n[1], largura: n[2], altura: n[3] };
}

export function textoViewBox(c: Caixa): string {
  const r = (v: number) => Number(v.toFixed(2));
  return `${r(c.x)} ${r(c.y)} ${r(c.largura)} ${r(c.altura)}`;
}

/** Caixa com folga proporcional em volta (fração do maior lado). */
export function comFolga(c: Caixa, fracao = 0.02): Caixa {
  const f = Math.max(c.largura, c.altura) * fracao;
  return { x: c.x - f, y: c.y - f, largura: c.largura + 2 * f, altura: c.altura + 2 * f };
}

/* ---------- ponto de rótulo ---------- */

/** Ponto dentro do anel (regra do raio; ponto na borda pode cair para qualquer lado). */
export function pontoNoAnel([px, py]: Ponto, anel: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Dentro da região desenhada com fill-rule evenodd (buracos e enclaves respeitados). */
export function pontoNaRegiao(p: Ponto, aneis: readonly (readonly Ponto[])[]): boolean {
  let n = 0;
  for (const a of aneis) if (pontoNoAnel(p, a)) n++;
  return n % 2 === 1;
}

/** Centroide de área de um anel; sem área, média dos vértices. */
export function centroideAnel(anel: readonly Ponto[]): Ponto {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = anel.length; i < n; i++) {
    const [x0, y0] = anel[i];
    const [x1, y1] = anel[(i + 1) % n];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = anel.length || 1;
    return [anel.reduce((s, p) => s + p[0], 0) / n, anel.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Trechos internos de uma horizontal y (regra evenodd sobre todos os anéis). */
function trechosInternos(y: number, aneis: readonly (readonly Ponto[])[]): [number, number][] {
  const xs: number[] = [];
  for (const a of aneis) {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i];
      const [xj, yj] = a[j];
      if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
  return out;
}

/**
 * Ponto para rótulo ou dica de uma região: o centroide do maior anel quando
 * ele cai dentro da região; senão (forma em C, litoral recortado, buraco no
 * meio), o meio do trecho horizontal interno mais largo entre algumas alturas
 * da caixa. É aproximado de propósito: serve para posicionar texto, não para
 * cálculo. Null para caminho vazio.
 */
export function pontoRotulo(d: string): Ponto | null {
  const aneis = lerCaminho(d);
  if (!aneis.length) return null;
  let principal = aneis[0];
  for (const a of aneis) if (Math.abs(areaAssinada(a)) > Math.abs(areaAssinada(principal))) principal = a;
  const c = centroideAnel(principal);
  if (pontoNaRegiao(c, aneis)) return c;
  const cx = caixaDeAneis([principal]);
  if (!cx || cx.altura === 0) return c;
  let melhor: { p: Ponto; largura: number } | null = null;
  // meia unidade fora da grade inteira: a horizontal nunca passa exatamente sobre um vértice
  const alturas = [c[1], ...[0.5, 0.35, 0.65, 0.2, 0.8].map((f) => cx.y + cx.altura * f)].map((y) => Math.round(y) + 0.5);
  for (const y of alturas) {
    for (const [a, b] of trechosInternos(y, aneis)) {
      // só trechos que cruzam o anel principal (o rótulo fica na parte maior da região)
      const meio: Ponto = [(a + b) / 2, y];
      if (!pontoNoAnel(meio, principal)) continue;
      if (!melhor || b - a > melhor.largura) melhor = { p: meio, largura: b - a };
    }
  }
  return melhor?.p ?? c;
}

/* ---------- agrupamento ---------- */

export type GrupoGeo = FeatureGeo & { membros: string[] };

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Agrupa features por uma chave (ex.: municípios de uma área de concessão)
 * sem inventar geometria: o caminho do grupo é o conjunto dos caminhos dos
 * membros, desenhado com a mesma classe e o mesmo contorno. As divisas entre
 * membros continuam no desenho; a união exata, sem divisas internas, é feita
 * no pipeline sobre a topologia (pipeline/energia/geo.py, agrupa_por_chave).
 * Feature com chave nula ou vazia não entra em grupo nenhum.
 */
export function agruparPorChave(
  features: readonly FeatureGeo[],
  chave: (f: FeatureGeo) => string | null | undefined,
  nome?: (chave: string, membros: FeatureGeo[]) => string,
): GrupoGeo[] {
  const grupos = new Map<string, FeatureGeo[]>();
  for (const f of features) {
    const k = chave(f);
    if (k === null || k === undefined || k === "") continue;
    const g = grupos.get(k);
    if (g) g.push(f);
    else grupos.set(k, [f]);
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => COLLATOR.compare(a, b))
    .map(([k, ms]) => ({
      id: k,
      nome: nome ? nome(k, ms) : k,
      uf: Array.from(new Set(ms.map((m) => m.uf))).sort().join("/"),
      membros: ms.map((m) => m.id).sort(),
      // cada caminho publicado já é uma sequência de subcaminhos "M...z": a concatenação é válida
      d: ms.map((m) => m.d).join(""),
    }));
}

/* ---------- validação do arquivo carregado ---------- */

const eTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * Problemas de uma camada recebida (fetch no cliente ou prop); lista vazia
 * quando está íntegra. Confere o mínimo de que o mapa depende: proveniência,
 * viewBox, ids únicos e caminhos não vazios começando por moveto.
 */
export function validaCamada(x: unknown): string[] {
  const erros: string[] = [];
  if (!x || typeof x !== "object") return ["camada não é um objeto"];
  const c = x as Partial<CamadaGeo>;
  for (const k of ["fonte", "url", "capturado_em", "sha256", "viewBox"] as const) if (!eTexto(c[k])) erros.push(`campo "${k}" ausente`);
  if (eTexto(c.viewBox) && !lerViewBox(c.viewBox)) erros.push(`viewBox inválido: ${c.viewBox}`);
  if (!Array.isArray(c.features) || !c.features.length) return [...erros, "camada sem features"];
  const ids = new Set<string>();
  let ruins = 0;
  for (const f of c.features as Partial<FeatureGeo>[]) {
    if (!f || !eTexto(f.id) || !eTexto(f.nome) || typeof f.uf !== "string" || !eTexto(f.d) || !/^\s*[Mm]/.test(f.d)) ruins++;
    else if (ids.has(f.id)) erros.push(`id repetido: ${f.id}`);
    else ids.add(f.id);
  }
  if (ruins) erros.push(`${ruins} feature(s) sem id, nome, uf ou caminho`);
  return erros;
}

/* ---------- enquadramento e zoom ---------- */

export type Zoom = { escala: number; centro: Ponto };

export function centroDaCaixa(c: Caixa): Ponto {
  return [c.x + c.largura / 2, c.y + c.altura / 2];
}

export function zoomInicial(base: Caixa): Zoom {
  return { escala: 1, centro: centroDaCaixa(base) };
}

/**
 * Zoom dentro dos limites: escala entre 1 e o máximo, e centro que mantém a
 * janela dentro da caixa base (não se arrasta o mapa para fora da tela).
 */
export function limitarZoom(base: Caixa, z: Zoom, escalaMaxima: number): Zoom {
  const escala = Math.min(Math.max(1, Number.isFinite(z.escala) ? z.escala : 1), Math.max(1, escalaMaxima));
  const w = base.largura / escala;
  const h = base.altura / escala;
  const lim = (v: number, a: number, b: number) => (a > b ? (a + b) / 2 : Math.min(Math.max(v, a), b));
  return {
    escala,
    centro: [lim(z.centro[0], base.x + w / 2, base.x + base.largura - w / 2), lim(z.centro[1], base.y + h / 2, base.y + base.altura - h / 2)],
  };
}

/** Janela (viewBox) de um zoom. */
export function caixaDoZoom(base: Caixa, z: Zoom): Caixa {
  const w = base.largura / z.escala;
  const h = base.altura / z.escala;
  return { x: z.centro[0] - w / 2, y: z.centro[1] - h / 2, largura: w, altura: h };
}

/** Multiplica a escala por `fator` em torno de `alvo` (ou do centro atual) e limita. */
export function aplicarZoom(base: Caixa, z: Zoom, fator: number, escalaMaxima: number, alvo?: Ponto | null): Zoom {
  return limitarZoom(base, { escala: z.escala * fator, centro: alvo ?? z.centro }, escalaMaxima);
}

/** Ajuste "meet" (preserveAspectRatio xMidYMid meet): pixels por unidade e deslocamento. */
export function ajusteNaTela(vb: Caixa, largura: number, altura: number): { s: number; ox: number; oy: number } {
  const s = Math.min(largura / vb.largura, altura / vb.altura);
  return { s, ox: (largura - vb.largura * s) / 2, oy: (altura - vb.altura * s) / 2 };
}

/** Ponto da geometria → pixel dentro do elemento do mapa. */
export function paraTela(p: Ponto, vb: Caixa, largura: number, altura: number): Ponto {
  const { s, ox, oy } = ajusteNaTela(vb, largura, altura);
  return [ox + (p[0] - vb.x) * s, oy + (p[1] - vb.y) * s];
}
