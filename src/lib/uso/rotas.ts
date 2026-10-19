/**
 * Normalização das rotas da medição de uso (server-only).
 *
 * O cliente manda só o caminho da página (sem consulta nem fragmento). Aqui ele
 * vira o MODELO da rota, como está nas pastas de src/app
 * ("/saneamento/municipio/4314902" vira "/saneamento/municipio/[id]"), e só é
 * aceito se o modelo pertencer à lista fechada gerada do sistema de arquivos
 * (rotas-do-app.json, regenerada por scripts/rotas-do-app.mjs). Caminho fora da
 * lista é recusado: nada arbitrário chega ao banco, nem o identificador que
 * preenche o modelo.
 *
 * Exceção deliberada: as entradas com conta dos observatórios
 * (/observatorios/familias e as demais do registro) contam pelo endereço
 * concreto, porque o modelo /observatorios/[id] somaria todos os observatórios
 * numa linha só e o painel não conseguiria atribuir a visita.
 */
import ROTAS_DO_APP from "./rotas-do-app.json";
import { OBSERVATORIOS, type ObservatorioId } from "@/lib/observatorios/lista";
import { donoDaRota } from "@/lib/observatorios/registro";
import { DOMINIOS } from "@/lib/dominios";

/** Rótulo do grupo de páginas fora dos seis observatórios: home, camada aberta, entrada, cadastro, conta e institucionais. */
export const FORA_DOS_OBSERVATORIOS = "plataforma" as const;
export type GrupoDeUso = ObservatorioId | typeof FORA_DOS_OBSERVATORIOS;

type Segmento = { tipo: "fixo"; valor: string } | { tipo: "parametro" } | { tipo: "resto"; opcional: boolean };
type Modelo = { rota: string; segmentos: Segmento[] };

const ENTRADAS_CONCRETAS = OBSERVATORIOS.flatMap((o) =>
  o.entrada && o.entrada.startsWith("/observatorios/") ? [o.entrada] : [],
);

/** Lista fechada: as páginas de src/app e as entradas concretas dos observatórios. */
export const ROTAS_ACEITAS: readonly string[] = Object.freeze([...(ROTAS_DO_APP as string[]), ...ENTRADAS_CONCRETAS]);

function segmentar(rota: string): Segmento[] {
  return rota.split("/").filter(Boolean).map((s): Segmento => {
    if (s.startsWith("[[...") && s.endsWith("]]")) return { tipo: "resto", opcional: true };
    if (s.startsWith("[...") && s.endsWith("]")) return { tipo: "resto", opcional: false };
    if (s.startsWith("[") && s.endsWith("]")) return { tipo: "parametro" };
    return { tipo: "fixo", valor: s };
  });
}

const MODELOS: Modelo[] = ROTAS_ACEITAS.map((rota) => ({ rota, segmentos: segmentar(rota) }));

const PESO = { fixo: 3, parametro: 2, resto: 1 } as const;

/** Pesos por posição do modelo que casa com o caminho, ou null. Fixo vence parâmetro, que vence o resto (regra do Next). */
function casar(modelo: Segmento[], partes: string[]): number[] | null {
  const pesos: number[] = [];
  for (let i = 0; i < modelo.length; i++) {
    const s = modelo[i];
    if (s.tipo === "resto") {
      const restantes = partes.length - i;
      if (restantes < (s.opcional ? 0 : 1)) return null;
      pesos.push(PESO.resto);
      return pesos;
    }
    if (i >= partes.length) return null;
    if (s.tipo === "fixo" && s.valor !== partes[i]) return null;
    pesos.push(PESO[s.tipo]);
  }
  return modelo.length === partes.length ? pesos : null;
}

function maisEspecifico(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

const LIMITE_CAMINHO = 512;
const LIMITE_SEGMENTOS = 16;

/**
 * Modelo da rota a que o caminho pertence, ou null quando o caminho não é uma
 * página do app. Consulta e fragmento são descartados antes de tudo.
 */
export function normalizarRota(caminho: unknown): string | null {
  if (typeof caminho !== "string" || caminho.length === 0 || caminho.length > LIMITE_CAMINHO) return null;
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return null;
  const semConsulta = caminho.split(/[?#]/)[0];
  const brutas = semConsulta.split("/").filter(Boolean);
  if (brutas.length > LIMITE_SEGMENTOS) return null;
  let partes: string[];
  try {
    partes = brutas.map((p) => decodeURIComponent(p));
  } catch {
    return null;
  }
  if (partes.some((p) => p === "." || p === ".." || p.includes("/"))) return null;
  let melhor: { rota: string; pesos: number[] } | null = null;
  for (const m of MODELOS) {
    const pesos = casar(m.segmentos, partes);
    if (pesos && (!melhor || maisEspecifico(pesos, melhor.pesos))) melhor = { rota: m.rota, pesos };
  }
  return melhor?.rota ?? null;
}

// ----------------------------------------------------------- atribuição

/** Endereços dos observatórios que o registro de painéis não cobre: entradas com conta, métodos e apresentações abertas. */
function enderecosProprios(): Map<string, ObservatorioId> {
  const mapa = new Map<string, ObservatorioId>();
  for (const o of OBSERVATORIOS) {
    if (o.entrada) mapa.set(o.entrada, o.id);
    if (o.metodo) mapa.set(o.metodo, o.id);
  }
  for (const d of DOMINIOS) {
    if (d.rotaApresentacao === d.rotaRaiz || mapa.has(d.rotaApresentacao)) continue;
    const dono = donoDaRota(d.rotaRaiz);
    if (dono) mapa.set(d.rotaApresentacao, dono.observatorio);
  }
  return mapa;
}

const cacheGrupo = new Map<string, GrupoDeUso>();
let proprios: Map<string, ObservatorioId> | null = null;

/**
 * Observatório dono de uma rota aceita (pelo registro, src/lib/observatorios/registro.ts),
 * ou "plataforma" para home, camada aberta (/perguntas), entrada, cadastro, conta e institucionais.
 * A irmã inglesa (/en/...) pertence ao mesmo observatório da página em português.
 */
export function grupoDaRota(rota: string): GrupoDeUso {
  const emCache = cacheGrupo.get(rota);
  if (emCache) return emCache;
  const pt = rota === "/en" ? "/" : rota.startsWith("/en/") ? rota.slice(3) : rota;
  proprios ??= enderecosProprios();
  let grupo: GrupoDeUso = FORA_DOS_OBSERVATORIOS;
  const dono = donoDaRota(pt);
  if (dono) grupo = dono.observatorio;
  else {
    let atual = pt;
    while (atual.length > 1) {
      const id = proprios.get(atual);
      if (id) {
        grupo = id;
        break;
      }
      atual = atual.slice(0, atual.lastIndexOf("/")) || "/";
    }
  }
  cacheGrupo.set(rota, grupo);
  return grupo;
}

export function nomeDoGrupo(grupo: string): string {
  if (grupo === FORA_DOS_OBSERVATORIOS) return "Fora dos observatórios";
  return OBSERVATORIOS.find((o) => o.id === grupo)?.nomeCurto ?? grupo;
}
