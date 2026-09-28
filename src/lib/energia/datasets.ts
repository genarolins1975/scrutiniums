/**
 * Datasets integrados: slug público → identificador interno do pipeline, golds
 * que consome, páginas que o exibem e downloads. Espelha INTEGRADOS de
 * pipeline/energia/catalogo.py (o teste energia-gold-contrato confere).
 */
export type DatasetIntegrado = {
  slug: string;
  interno: string;
  catalogoId: string;
  paginas: { rotulo: string; href: string }[];
  downloads: string[];
};

export const DATASETS_INTEGRADOS: DatasetIntegrado[] = [
  { slug: "ccee-pld-horario", interno: "ccee_pld_horario", catalogoId: "ccee:pld_horario", paginas: [{ rotulo: "PLD", href: "/setor-eletrico/pld" }, { rotulo: "Rede", href: "/setor-eletrico/rede" }], downloads: ["/energia/series/pld_horario.csv", "/energia/series/pld_diario.csv"] },
  { slug: "ons-ear-subsistema", interno: "ear_subsistema_di", catalogoId: "ons:ear-diario-por-subsistema", paginas: [{ rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima" }], downloads: ["/energia/series/ear_diario.csv"] },
  { slug: "ons-ena-subsistema", interno: "ena_subsistema_di", catalogoId: "ons:ena-diario-por-subsistema", paginas: [{ rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima#ena" }], downloads: ["/energia/series/ena_diario.csv"] },
  { slug: "ons-carga-diaria", interno: "carga_energia_di", catalogoId: "ons:carga-energia", paginas: [{ rotulo: "Carga", href: "/setor-eletrico/carga" }], downloads: ["/energia/series/carga_diaria.csv"] },
  { slug: "ons-balanco-energia", interno: "balanco_energia_subsistema_ho", catalogoId: "ons:balanco-energia-subsistema", paginas: [{ rotulo: "Geração", href: "/setor-eletrico/geracao" }, { rotulo: "Rede", href: "/setor-eletrico/rede" }], downloads: ["/energia/series/geracao_diaria.csv"] },
  { slug: "ons-intercambio", interno: "intercambio_nacional_ho", catalogoId: "ons:intercambio-nacional", paginas: [{ rotulo: "Rede", href: "/setor-eletrico/rede" }], downloads: ["/energia/series/intercambio_diario.csv"] },
  { slug: "ons-cmo-semanal", interno: "cmo_se", catalogoId: "ons:cmo-semanal", paginas: [{ rotulo: "PLD (formação)", href: "/setor-eletrico/pld#cmo" }], downloads: ["/energia/series/cmo_semanal.csv"] },
];

export function datasetPorSlug(slug: string) {
  return DATASETS_INTEGRADOS.find((d) => d.slug === slug);
}
