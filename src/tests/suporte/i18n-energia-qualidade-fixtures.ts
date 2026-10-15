import type { ComponentProps } from "react";
import type { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import type { CamadaGeo } from "@/lib/energia/geo";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

/** Congelamento em runtime mantém os tipos reais aceitos pelos consumidores. */
function congelar<T>(valor: T): T {
  if (valor !== null && typeof valor === "object") {
    for (const filho of Object.values(valor)) congelar(filho);
    Object.freeze(valor);
  }
  return valor;
}

export const URLS = congelar({
  municipios: "/energia/series/qualidade_municipios.csv",
  geo: "/energia/geo/municipios.json",
  serie: "/energia/series/qualidade_distribuidoras_serie.json",
  conjuntos: "/energia/series/qualidade_conjuntos_anual_2020_2029.csv",
});

export const ALFA = "1100001";
export const BETA = "1100002";

const CNPJ_ALFA = "00000000000001";
const CNPJ_BETA = "00000000000002";
const CONJUNTO_ZERO = "000001";
const CONJUNTO_FRACIONARIO = "000002";

// Ausentes em 2025; o primeiro aparece somente na linha de 2024 do CSV anual.
export const CODIGOS_AUSENTES = congelar(
  Array.from({ length: 1001 }, (_, indice) => String(indice + 3).padStart(6, "0")),
);

export const MUNICIPIOS_CSV = [
  "no_ibge;cod_ibge;municipio;uf;conjuntos;relacao;dec_min_h;dec_max_h;fec_min;fec_max;cnpjs",
  [
    "1", ALFA, "Município Alfa", "RO",
    [CONJUNTO_ZERO, CONJUNTO_FRACIONARIO, ...CODIGOS_AUSENTES].join(" "),
    "varios_conjuntos", "0", "12.5", "0", "2.5", `${CNPJ_ALFA} ${CNPJ_BETA}`,
  ].join(";"),
  [
    "1", BETA, "Município Beta", "RO", CONJUNTO_FRACIONARIO,
    "conjunto_exclusivo", "12.5", "12.5", "2.5", "2.5", CNPJ_BETA,
  ].join(";"),
].join("\n") + "\n";

export const CONJUNTOS_CSV = [
  "ano;conjunto;nome;sigla;meses;dec_h;dec_limite_h;razao_dec;fec_interrupcoes;fec_limite_interrupcoes;razao_fec;ucs_media;acima_limite_dec;acima_limite_fec;meses_fec",
  `2025;${CONJUNTO_ZERO};Conjunto Zero da Fixture;FIX-A;12;0;10;0;0;2;0;0;0;0;12`,
  `2025;${CONJUNTO_FRACIONARIO};Conjunto Fracionário da Fixture;FIX-B;12;12.5;10;1.25;2.5;2;1.25;1234;1;1;12`,
  `2024;${CODIGOS_AUSENTES[0]};Conjunto de Outro Ano da Fixture;FIX-A;12;99.99;10;9.999;9.99;2;4.995;4321;1;1;12`,
].join("\n") + "\n";

export const GEO = congelar({
  camada: "municipios",
  titulo: "Malha municipal sintética da fixture de Qualidade",
  fonte: "Fixture local de Qualidade, sem geometria oficial",
  url: "https://example.test/fixtures/qualidade/geometria",
  url_nomes: "https://example.test/fixtures/qualidade/nomes",
  capturado_em: "2026-01-02T03:04:05Z",
  sha256: "a".repeat(64),
  sha256_nomes: "b".repeat(64),
  bronze: "fixture-local-sem-arquivo-bronze",
  malha: {
    revisao: 1,
    nota_liberacao: "Dois polígonos sintéticos para o teste de Qualidade.",
    data_nota: "2026-01-02",
    documentacao: "https://example.test/fixtures/qualidade/documentacao",
    qualidade: "Fixture de DOM, sem validade territorial ou estatística.",
    formato_original: "Caminhos SVG sintéticos da fixture",
  },
  projecao: {
    nome: "Plano cartesiano sintético da fixture",
    paralelos_padrao: [],
    meridiano_central: 0,
    latitude_origem: 0,
    superficie: "Superfície sintética da fixture",
    unidade_svg_m: 1,
    origem_m: [0, 0],
    eixo_y: "positivo para baixo",
  },
  simplificacao: {
    metodo: "Sem simplificação; retângulos escritos na fixture",
    tolerancia_m: 0,
    arcos_com_tolerancia_reduzida: 0,
    garantia: "Dois polígonos de área não nula, sem pretensão cartográfica.",
  },
  viewBox: "0 0 240 120",
  contagem: { features: 2, poligonos: 2, poligonos_origem: 2, aneis: 2 },
  conciliacao: { nomes_sem_geometria: [] },
  contornos: { uf: [{ id: "11", uf: "RO", d: "M10 10h220v100h-220z" }] },
  features: [
    { id: ALFA, nome: "Município Alfa", uf: "RO", d: "M10 10h100v100h-100z" },
    { id: BETA, nome: "Município Beta", uf: "RO", d: "M130 10h100v100h-100z" },
  ],
} satisfies CamadaGeo);

export const SERIE = congelar({
  dominio: "energia",
  gold: "fixture-qualidade-distribuidoras-serie",
  gerado_em: "2026-01-02T03:04:05Z",
  versao_pipeline: "fixture-qualidade-1",
  versao_codigo: "fixture-local-sem-commit",
  disponivel: true,
  ano_referencia: 2025,
  anos_na_serie: 2,
  unidades: { dec: "h", fec: "interrupções", tmae: "min", compensacao: "R$", iasc: "pontos" },
  distribuidoras: {
    [CNPJ_ALFA]: {
      anos: [2024, 2025],
      dec: [1234.56, 2345.67],
      fec: [12.34, 23.45],
      dec_limite: [1000.12, 2000.23],
      fec_limite: [10.12, 20.23],
      quebras: [],
    },
    [CNPJ_BETA]: {
      anos: [2024, 2025],
      dec: [3456.78, 4567.89],
      fec: [34.56, 45.67],
      dec_limite: [3000.34, 4000.45],
      fec_limite: [30.34, 40.45],
      quebras: [],
    },
  },
} satisfies QualidadeSeriesDistribuidorasGold);

export const PROPS_MAPA = congelar({
  ano: 2025,
  urlMunicipios: URLS.municipios,
  urlSerie: URLS.serie,
  distribuidoras: [
    { cnpj: CNPJ_ALFA, rotulo: "Distribuidora Alfa da Fixture" },
    { cnpj: CNPJ_BETA, rotulo: "Distribuidora Beta da Fixture" },
  ],
  regra: "Fixture: maior ou menor valor dos conjuntos, sem média municipal.",
  totalMunicipios: 1234,
  fonte: "Fixture local de Qualidade; contagem sintética, sem base oficial",
  versao: "fixture-qualidade-1",
  avisosFec: {},
  tamanhoConjuntos: "três linhas na fixture local",
} satisfies Omit<ComponentProps<typeof QualidadeMapa>, "idioma">);
