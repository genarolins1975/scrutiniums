/**
 * Geometria comum das figuras do Varejo: escalas lineares, marcas redondas de eixo, caminhos com lacuna e a área entre duas séries
 * (cortada onde as linhas se cruzam). Sem dependência de biblioteca: as figuras são SVG e HTML desenhados à mão no servidor.
 */
export type Escala = (v: number) => number;

export function linear(dominio: readonly [number, number], faixa: readonly [number, number]): Escala {
  const [a, b] = dominio;
  const [c, d] = faixa;
  return (v) => (b === a ? (c + d) / 2 : c + ((v - a) * (d - c)) / (b - a));
}

/** Passo "redondo" (1, 2, 2,5, 5 × potência de 10) para cerca de `n` marcas entre min e max. */
export function passoRedondo(min: number, max: number, n = 4): number {
  const bruto = (max - min) / Math.max(1, n);
  if (!(bruto > 0)) return 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / pot;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot;
}

/** Domínio alargado até marcas redondas e as marcas dentro dele. Com `incluir`, o valor de referência (zero, 100) entra sempre. */
export function eixo(valores: readonly (number | null)[], { n = 4, incluir }: { n?: number; incluir?: number } = {}): { min: number; max: number; marcas: number[] } {
  const validos = valores.filter((x): x is number => x !== null && Number.isFinite(x));
  if (incluir !== undefined) validos.push(incluir);
  if (!validos.length) return { min: 0, max: 1, marcas: [0, 1] };
  let lo = Math.min(...validos);
  let hi = Math.max(...validos);
  if (lo === hi) { lo -= 1; hi += 1; }
  const p = passoRedondo(lo, hi, n);
  const min = Math.floor(lo / p + 1e-9) * p;
  const max = Math.ceil(hi / p - 1e-9) * p;
  const marcas: number[] = [];
  for (let m = min; m <= max + p / 2; m += p) marcas.push(Number(m.toFixed(6)));
  return { min, max, marcas };
}

/** Caminho SVG de uma série; valor ausente interrompe a linha (lacuna continua lacuna). */
export function caminho(valores: readonly (number | null)[], x: Escala, y: Escala): string {
  let d = "";
  let aberto = false;
  valores.forEach((v, i) => {
    if (v === null) { aberto = false; return; }
    d += `${aberto ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`;
    aberto = true;
  });
  return d;
}

/**
 * A área entre duas séries, em dois caminhos: onde `a` está acima de `b` e onde está abaixo. Entre dois meses com valor, o trecho é
 * cortado no ponto em que as linhas se cruzam; mês sem um dos valores não entra.
 */
export function areaEntre(a: readonly (number | null)[], b: readonly (number | null)[], x: Escala, y: Escala): { acima: string; abaixo: string } {
  let acima = "";
  let abaixo = "";
  const p = (px: number, v: number) => `${px.toFixed(2)} ${y(v).toFixed(2)}`;
  for (let i = 0; i < a.length - 1; i++) {
    const a0 = a[i], a1 = a[i + 1], b0 = b[i], b1 = b[i + 1];
    if (a0 === null || a1 === null || b0 === null || b1 === null) continue;
    const d0 = a0 - b0;
    const d1 = a1 - b1;
    const x0 = x(i);
    const x1 = x(i + 1);
    if (d0 * d1 >= 0) {
      const poli = `M${p(x0, a0)}L${p(x1, a1)}L${p(x1, b1)}L${p(x0, b0)}Z`;
      if (d0 + d1 >= 0) acima += poli; else abaixo += poli;
    } else {
      const t = d0 / (d0 - d1);
      const xc = x0 + t * (x1 - x0);
      const vc = a0 + t * (a1 - a0);
      const antes = `M${p(x0, a0)}L${p(xc, vc)}L${p(x0, b0)}Z`;
      const depois = `M${p(xc, vc)}L${p(x1, a1)}L${p(x1, b1)}Z`;
      if (d0 > 0) { acima += antes; abaixo += depois; } else { abaixo += antes; acima += depois; }
    }
  }
  return { acima, abaixo };
}

/** Meses que ganham rótulo no eixo do tempo: todo janeiro (o ano); em período curto, também julho. Devolve índice e texto. */
export function marcasDeTempo(meses: readonly string[], maximo = 9): { i: number; rotulo: string }[] {
  const jan = meses.map((m, i) => ({ i, m })).filter((x) => x.m.endsWith("-01"));
  const curto = jan.length < 4;
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  let marcas = meses
    .map((m, i) => ({ i, m }))
    .filter((x) => x.m.endsWith("-01") || (curto && x.m.endsWith("-07")))
    .map((x) => ({ i: x.i, rotulo: x.m.endsWith("-01") ? x.m.slice(0, 4) : `${nomes[Number(x.m.slice(5)) - 1]}/${x.m.slice(2, 4)}` }));
  while (marcas.length > maximo) marcas = marcas.filter((_, k) => k % 2 === 0);
  return marcas;
}
