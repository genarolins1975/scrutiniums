import type { Idioma } from "@/lib/idioma";
import type { TextosPagina } from "./tipos";

const pt = {
  titulo: "Governança editorial",
  descricaoMeta: "A Constituição editorial que rege as notas do Observatório Brasileiro de Crédito: origem dos números, classes de afirmação, temas vedados, revisão independente, erro e errata.",
  trilha: "Trilha",
  sobre: "Sobre",
  rotulo: "Institucional",
  tituloPagina: "Constituição editorial",
  descricao: "Regras que valem para as notas do Observatório Brasileiro de Crédito, escritas por agentes e verificadas por código. Os números dos painéis vêm do pipeline, não das notas.",
  nota: "Texto publicado a partir do arquivo em vigor no repositório. Única diferença em relação a ele: no Art. 5, os nomes das entidades em que o responsável ocupa cargos foram omitidos.",
  vejaAntes: "Veja também a",
  politicaLink: "política de correção",
  vejaMeio: "e o",
  registroLink: "registro público de erros",
};

const en: TextosPagina<typeof pt> = {
  titulo: "Editorial governance",
  descricaoMeta: "The Editorial Constitution that governs the notes of the Brazilian Credit Observatory: where the numbers come from, classes of statement, off-limits topics, independent review, errors and errata.",
  trilha: "Breadcrumb",
  sobre: "About",
  rotulo: "Institutional",
  tituloPagina: "Editorial Constitution",
  descricao: "Rules for the notes of the Brazilian Credit Observatory, written by agents and verified by code. The numbers in the dashboards come from the pipeline, not from the notes.",
  nota: "Courtesy translation of the Portuguese text in force in the repository; the Portuguese version prevails. As in the Portuguese page, Art. 5 omits the names of the entities where the person responsible holds positions.",
  vejaAntes: "See also the",
  politicaLink: "corrections policy",
  vejaMeio: "and the",
  registroLink: "public error log",
};

export const TEXTOS_GOVERNANCA: Record<Idioma, TextosPagina<typeof pt>> = { pt, en };
