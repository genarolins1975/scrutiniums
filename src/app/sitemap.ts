import type { MetadataRoute } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INDICADORES } from "@/lib/dadosPublicos";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";

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

  return [
    rota("", 1.0, "weekly"),
    rota("/observatorio", 1.0, "daily"),
    ...ABAS_OBSERVATORIO.map((a) => rota(`/observatorio${a.caminho}`, 0.9, "daily")),
    rota("/observatorio-do-credito", 0.9, "daily"),
    rota("/imprensa", 0.9, "weekly"),
    rota("/dados", 0.9, "daily"),
    rota("/resumo", 0.9, "daily"),
    ...INDICADORES.map((i) => rota(`/dados/${i.slug}`, 0.8, "daily")),
    ...instituicoes.map((i) => rota(`/observatorio/institutions/${i.cod}`, 0.6, "weekly")),
    rota("/glossario", 0.8, "monthly"),
    rota("/metodologia", 0.8, "monthly"),
    rota("/fontes", 0.7, "monthly"),
    rota("/cadastro", 0.6, "yearly"),
    rota("/entrar", 0.3, "yearly"),
    rota("/privacidade", 0.2, "yearly"),
    rota("/termos", 0.2, "yearly"),
  ];
}
