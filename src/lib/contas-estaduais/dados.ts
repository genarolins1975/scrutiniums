import snapshot from "./snapshot.json";
import catalogo from "./catalogo.json";
import primarios from "./primarios.json";

export { snapshot, catalogo, primarios };
export const INDICADORES_RREO = ["CE-01", "CE-04", "CE-05", "CE-06"] as const;
export const dividaPrimaria = (uf: string, ano: number) => primarios.rgf.find(r => r.uf === uf && r.ano === ano);
export const execucaoPrimaria = (uf: string, ano: number) => primarios.rreo.find(r => r.uf === uf && r.ano === ano);
export const PROVAS = ["PE", "SP", "MG", "RS", "AM", "DF"] as const;
export const ANOS = Array.from({ length: 12 }, (_, i) => 2026 - i);
export const STATUS = {
  nao_sondado: "Ainda não sondado",
  sem_registro_snapshot: "Sem registro neste snapshot",
  evidencia_herdada: "Evidência herdada · verificar origem",
  divergencia_aritmetica: "Conferência aritmética pendente",
  fonte_primaria_conferida: "Conferido na resposta original",
} as const;
export type Estado = typeof snapshot.ufs[number];
export type Status = keyof typeof STATUS;

export function razao(n: number | null, d: number | null): number | null {
  return n !== null && d !== null && Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d * 100 : null;
}

// A gold tem uma casa decimal. Não ampliar a tolerância para absorver
// divergências (inclusive as duas observadas: AM e TO).
export function conferir(n: number | null, d: number | null, publicado: number | null) {
  const calculado = razao(n, d);
  const diferenca = calculado !== null && publicado !== null && Number.isFinite(publicado) ? calculado - publicado : null;
  return { calculado, diferenca, compativel: diferenca !== null && Math.abs(diferenca) <= 0.05 + 1e-9 };
}

export function observacao(uf: Estado, ano: number) {
  const primaria = dividaPrimaria(uf.uf, ano);
  if (primaria) return { valor: primaria.valores.percentual_declarado, periodo: ano + " · " + primaria.periodo + "º quadrimestre", parcial: primaria.periodo !== 3 };
  if (ano === uf.exercicio) return { valor: uf.dcl_rcl_pct, periodo: ano + " · " + uf.quadrimestre + "º quadrimestre", parcial: uf.quadrimestre !== 3 };
  const registro = uf.serie.find(s => s.ano === ano);
  return { valor: registro?.dcl_rcl_pct ?? null, periodo: ano + " · 3º quadrimestre", parcial: false };
}
export function cobertura(uf: Estado, ano: number, indicador: string): Status {
  if (indicador === "CE-11" && dividaPrimaria(uf.uf, ano)) return "fonte_primaria_conferida";
  if (INDICADORES_RREO.some(id => id === indicador) && execucaoPrimaria(uf.uf, ano)) return "fonte_primaria_conferida";
  if (indicador !== "CE-11") return "nao_sondado";
  if (observacao(uf, ano).valor === null) return "sem_registro_snapshot";
  if (ano === uf.exercicio && !conferir(uf.dcl, uf.rcl, uf.dcl_rcl_pct).compativel) return "divergencia_aritmetica";
  return "evidencia_herdada";
}
export function matriz(ano: number) {
  return snapshot.ufs.flatMap(uf => catalogo.indicadores.map(i => ({
    uf: uf.uf, ano, indicador: i.id, fonte: i.fonteERegra.split(" · ")[0],
    status: cobertura(uf, ano, i.id), conferidoNaFonte: cobertura(uf, ano, i.id) === "fonte_primaria_conferida",
    periodo: i.id === "CE-11" ? observacao(uf, ano).periodo : cobertura(uf, ano, i.id) === "fonte_primaria_conferida" ? ano + " · 6º bimestre" : null,
  })));
}
export function csvCobertura(ano: number) {
  const cell = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return "\uFEFF" + [["UF", "ano", "indicador", "fonte", "status", "conferido_na_fonte", "periodo"], ...matriz(ano).map(r => [r.uf, r.ano, r.indicador, r.fonte, r.status, r.conferidoNaFonte, r.periodo])].map(r => r.map(cell).join(";")).join("\r\n");
}
export function recorte(uf: string | null | undefined, ano: string | null | undefined) {
  return { uf: snapshot.ufs.some(e => e.uf === uf) ? uf! : "PE", ano: ano && ANOS.includes(Number(ano)) ? Number(ano) : 2025 };
}
