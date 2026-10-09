import type { MetadataRoute } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INDICADORES } from "@/lib/dadosPublicos";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";

/**
 * Superfície pública indexável: páginas institucionais, indicadores abertos
 * e o Observatório inteiro — todas as abas e as páginas por instituição.
 * A área logada (/app) fica de fora por desenho.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://scrutiniums.com";
  const agora = new Date();
  const rota = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${base}${path}`,
    lastModified: agora,
    changeFrequency,
    priority,
  });

  let instituicoes: { cod: string }[] = [];
  try {
    instituicoes = JSON.parse(
      readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "inst_index.json"), "utf-8"),
    ).instituicoes;
  } catch {
    instituicoes = [];
  }

  // Páginas municipais de presença bancária: 5,5 mil rotas de cauda longa,
  // geradas do mesmo gold que alimenta o mapa (bem abaixo do teto de 50 mil
  // URLs por sitemap).
  let municipios: { cod: string }[] = [];
  try {
    municipios = JSON.parse(
      readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "presenca_mun.json"), "utf-8"),
    ).municipios;
  } catch {
    municipios = [];
  }

  // Páginas por UF: 27 rotas a partir do gold que as alimenta.
  let ufs: { uf: string }[] = [];
  try {
    ufs = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "ufs.json"), "utf-8")).ufs;
  } catch {
    ufs = [];
  }

  // Cartões dos modelos de previsão do PLD (registro publicado na gold de energia).
  let modelosEnergia: string[] = [];
  try {
    modelosEnergia = JSON.parse(
      readFileSync(join(process.cwd(), "public", "energia", "gold", "modelos.json"), "utf-8"),
    ).modelos.map((m: { id: string }) => m.id);
  } catch {
    modelosEnergia = [];
  }

  const entradas: MetadataRoute.Sitemap = [
    rota("", 1.0, "weekly"),
    rota("/observatorio", 1.0, "daily"),
    ...ABAS_OBSERVATORIO.map((a) => rota(`/observatorio${a.caminho}`, 0.9, "daily")),
    rota("/observatorio-do-credito", 0.9, "daily"),
    rota("/imprensa", 0.9, "weekly"),
    rota("/dados", 0.9, "daily"),
    rota("/resumo", 0.9, "daily"),
    ...INDICADORES.map((i) => rota(`/dados/${i.slug}`, 0.8, "daily")),
    ...instituicoes.map((i) => rota(`/observatorio/institutions/${i.cod}`, 0.6, "weekly")),
    ...ufs.map((u) => rota(`/observatorio/states/${u.uf}`, 0.8, "daily")),
    ...municipios.map((m) => rota(`/observatorio/presenca/${m.cod}`, 0.5, "weekly")),
    rota("/glossario", 0.8, "monthly"),
    // Observatório Brasileiro do Setor Elétrico (domínio energia)
    ...MODULOS_ENERGIA.map((m) => rota(m.href, m.integrado ? 0.9 : 0.5, m.integrado ? "daily" : "monthly")),
    // destinos publicados da navegação em seis grupos que não são módulos da lista antiga
    // (conta de luz, perdas, qualidade, inclusão, transição etc.)
    ...DESTINOS_NAVEGACAO.filter((d) => d.publicado && !MODULOS_ENERGIA.some((m) => m.href === d.href) && !d.href.includes("#")).map((d) =>
      rota(d.href, 0.8, "weekly"),
    ),
    rota("/setor-eletrico/metodologia", 0.7, "monthly"),
    // Observatório Brasileiro de Eficiência Estatal: entrada e dois temas publicados (Educação e Saúde nas capitais).
    rota("/eficiencia-estatal", 0.7, "monthly"),
    rota("/eficiencia-estatal/educacao-municipal-capitais", 0.6, "monthly"),
    ...["gastos", "atendimento", "resultados", "comparar", "metodos"].map((v) => rota(`/eficiencia-estatal/educacao-municipal-capitais/${v}`, 0.5, "monthly")),
    rota("/eficiencia-estatal/saude-capitais", 0.6, "monthly"),
    ...["gastos", "rede-e-atencao-primaria", "atendimento-e-resultados", "comparar", "metodos"].map((v) => rota(`/eficiencia-estatal/saude-capitais/${v}`, 0.5, "monthly")),
    rota("/setor-eletrico/pld/modelos", 0.6, "weekly"),
    ...modelosEnergia.map((m) => rota(`/setor-eletrico/pld/modelos/${m}`, 0.5, "weekly")),
    rota("/setor-eletrico/pld/previsoes", 0.6, "daily"),
    ...CONCEITOS.filter((c) => c.estado === "CONFERIDO").map((c) => rota(`/setor-eletrico/aprenda/${c.slug}`, 0.6, "monthly")),
    ...DATASETS_INTEGRADOS.map((d) => rota(`/setor-eletrico/dados/${d.slug}`, 0.5, "weekly")),
    rota("/cadastro", 0.6, "yearly"),
    rota("/entrar", 0.3, "yearly"),
    rota("/privacidade", 0.2, "yearly"),
    rota("/termos", 0.2, "yearly"),
  ];
  // uma URL por entrada: destinos da navegação nova repetem rotas listadas acima
  const vistas = new Set<string>();
  return entradas.filter((e) => (vistas.has(e.url) ? false : (vistas.add(e.url), true)));
}
