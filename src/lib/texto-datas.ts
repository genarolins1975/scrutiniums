/**
 * Datas e instantes ISO embutidos em texto vindo de pipeline, tornados legíveis para o leitor
 * (usado pelos domínios Energia e Eficiência). O valor original fica disponível para o
 * atributo `datetime` do elemento <time>.
 */
export type SegmentoData = string | { iso: string; texto: string };

/**
 * Datas e instantes ISO embutidos em texto vindo do pipeline (ex.: "PREVISÃO emitida em
 * 2026-09-30T00:00Z (inicialização do modelo)") viram texto legível, sem mudar o dia nem o
 * fuso de referência: instante com "Z" fica em UTC ("30/09/2026 às 00h00 UTC", porque a
 * rodada do modelo é definida em UTC e converter para Brasília deslocaria a data); instante
 * sem fuso segue a convenção do domínio (Brasília); data civil não ganha horário. O valor
 * original permanece em `iso`.
 */
const DATA_EMBUTIDA = /(?<![\w@./:-])(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(Z)?)?(?![\w@/:-])/g;

export function segmentosComDatas(texto: string): SegmentoData[] {
  const out: SegmentoData[] = [];
  let ultimo = 0;
  const re = new RegExp(DATA_EMBUTIDA.source, "g");
  for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
    const [bruto, a, mes, d, hh, mm, z] = m;
    const dia = `${d}/${mes}/${a}`;
    const legivel = hh === undefined ? dia : z ? `${dia} às ${hh}h${mm} UTC` : `${dia} às ${hh}h${mm} (Brasília)`;
    out.push(texto.slice(ultimo, m.index), { iso: bruto, texto: legivel });
    ultimo = m.index + bruto.length;
  }
  out.push(texto.slice(ultimo));
  return out.filter((x) => x !== "");
}

/** Mesma conversão, como texto simples (sem o elemento <time>). */
export function textoComDatas(texto: string): string {
  return segmentosComDatas(texto)
    .map((x) => (typeof x === "string" ? x : x.texto))
    .join("");
}
