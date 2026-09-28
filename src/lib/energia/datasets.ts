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

/** Colunas e unidade de cada arquivo publicado pela plataforma (CSV com ";" e ponto decimal; vazio = ausência). */
export const COLUNAS_ARQUIVO: Record<string, string> = {
  "/energia/series/pld_horario.csv":
    "data_hora_local: data e hora no horário de Brasília (AAAA-MM-DDTHH:MM); SE, S, NE, N: PLD de cada submercado naquela hora, em R$/MWh nominais.",
  "/energia/series/pld_diario.csv":
    "data: dia (AAAA-MM-DD); SE, S, NE, N: média simples das 24 horas do PLD, em R$/MWh nominais, calculada pela Scrutiniums; dias sem as 24 horas ficam de fora.",
  "/energia/series/ear_diario.csv":
    "data: dia; SE, S, NE, N: energia armazenada em % da EAR máxima, como publicada pelo ONS; SIN_calculado: soma das EAR dividida pela soma das máximas, calculada pela Scrutiniums.",
  "/energia/series/ena_diario.csv":
    "data: dia; colunas _pct_mlt: ENA bruta em % da MLT; colunas _mwmed: ENA bruta em energia (o dicionário do ONS descreve a unidade como MWmês); SIN calculado pela Scrutiniums.",
  "/energia/series/carga_diaria.csv":
    "data: dia; SE, S, NE, N: carga em MWmed, como publicada pelo ONS; SIN_calculado: soma dos quatro subsistemas.",
  "/energia/series/geracao_diaria.csv":
    "data: dia; hidraulica, termica, eolica e solar por região (SIN, SE, S, NE, N): média diária da geração verificada horária, em MWmed.",
  "/energia/series/intercambio_diario.csv":
    "data: dia; fluxo_: intercâmbio verificado médio do dia por fronteira, em MWmed, positivo no sentido indicado no nome (N_NE = do Norte para o Nordeste); programado_: valor programado pelo ONS.",
  "/energia/series/cmo_semanal.csv":
    "semana_operativa: data de referência da semana operativa informada pelo ONS; para cada subsistema, CMO semanal e por patamar de carga (leve, média, pesada), em R$/MWh.",
};

