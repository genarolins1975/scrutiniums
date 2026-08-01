import type { MetadataRoute } from "next";
import { INDICADORES } from "@/lib/dadosPublicos";

/** Superfície pública indexável. A área logada fica de fora por desenho. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://scrutiniums.com";
  const agora = new Date();
  const rota = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${base}${path}`,
    lastModified: agora,
    changeFrequency,
    priority,
  });
  return [
    rota("", 1.0, "weekly"),
    rota("/dados", 0.9, "daily"),
    rota("/resumo", 0.9, "daily"),
    ...INDICADORES.map((i) => rota(`/dados/${i.slug}`, 0.8, "daily")),
    rota("/glossario", 0.8, "monthly"),
    rota("/metodologia", 0.8, "monthly"),
    rota("/fontes", 0.7, "monthly"),
    rota("/cadastro", 0.6, "yearly"),
    rota("/entrar", 0.3, "yearly"),
    rota("/privacidade", 0.2, "yearly"),
    rota("/termos", 0.2, "yearly"),
  ];
}
