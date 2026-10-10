import type { MetadataRoute } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INDICADORES } from "@/lib/dadosPublicos";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { PAGINAS as PAINEIS_TRABALHO_RENDA } from "@/components/eficiencia/trabalho-renda/modelo";
import { PAGINAS_MOBILIDADE, ROTA_MOBILIDADE } from "@/lib/eficiencia/mobilidade/modelo";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";

/** Superfície pública indexável. A área logada (/app) fica de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://scrutiniums.com";
  const agora = new Date();
  const rota = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({url: `${base}${path}`, lastModified: agora, changeFrequency, priority});
  let instituicoes: { cod: string }[] = [];
  try {instituicoes = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "inst_index.json"), "utf-8")).instituicoes;} catch {instituicoes = [];}
  let municipios: { cod: string }[] = [];
  try {municipios = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "presenca_mun.json"), "utf-8")).municipios;} catch {municipios = [];}
  let ufs: { uf: string }[] = [];
  try {ufs = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "ufs.json"), "utf-8")).ufs;} catch {ufs = [];}
  let modelosEnergia: string[] = [];
  try {modelosEnergia = JSON.parse(readFileSync(join(process.cwd(), "public", "energia", "gold", "modelos.json"), "utf-8")).modelos.map((m: { id: string }) => m.id);} catch {modelosEnergia = [];}
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
    ...MODULOS_ENERGIA.map((m) => rota(m.href, m.integrado ? 0.9 : 0.5, m.integrado ? "daily" : "monthly")),
    ...DESTINOS_NAVEGACAO.filter((d) => d.publicado && !MODULOS_ENERGIA.some((m) => m.href === d.href) && !d.href.includes("#")).map((d) => rota(d.href, 0.8, "weekly")),
    rota("/setor-eletrico/metodologia", 0.7, "monthly"),
    rota("/eficiencia-estatal", 0.7, "monthly"),
    ...PAGINAS_MOBILIDADE.map(p => rota(ROTA_MOBILIDADE+(p.slug?'/'+p.slug:''), 0.6, "monthly")),
    ...["", "necessidades", "acesso", "acompanhamento", "cuidado", "recursos", "dados", "metodos"].map(s => rota(`/eficiencia-estatal/assistencia-social${s ? "/"+s : ""}`, 0.6, "monthly")),
    ...["", "necessidades", "acesso", "qualidade", "recursos", "dados", "metodos"].map(s => rota(`/eficiencia-estatal/seguranca-alimentar${s ? "/"+s : ""}`, 0.6, "monthly")),
    rota("/eficiencia-estatal/educacao-municipal-capitais", 0.6, "monthly"),
    ...["gastos", "atendimento", "resultados", "comparar", "metodos"].map((v) => rota(`/eficiencia-estatal/educacao-municipal-capitais/${v}`, 0.5, "monthly")),
    ...PAINEIS_TRABALHO_RENDA.map(p => rota(`/eficiencia-estatal/trabalho-renda${p.slug ? `/${p.slug}` : ""}`, 0.6, "monthly")),
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
  const vistas = new Set<string>();
  return entradas.filter((e) => (vistas.has(e.url) ? false : (vistas.add(e.url), true)));
}
