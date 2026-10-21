import type { Idioma } from "@/lib/idioma";
import type { TextosPagina } from "./tipos";

const pt = {
  titulo: "Registro público de erros",
  descricaoMeta: "Todo erro publicado pela Scrutiniums, com superfície, gravidade, datas de detecção e correção e canal de detecção. Nada é apagado.",
  trilha: "Trilha",
  sobre: "Sobre",
  trilhaAtual: "Registro de erros",
  rotulo: "Política de correção",
  contagem: (n: number) => `${n} ${n === 1 ? "erro registrado" : "erros registrados"}. Data não apurada aparece como não apurada.`,
  idiomaDoRegistro: "",
};

/**
 * A descrição do registro vem de pesquisa/registro_erros.json; a versão inglesa é a
 * tradução do texto conferido em src/tests/i18n-institucional.test.ts, que reprova
 * se o original mudar sem a tradução acompanhar.
 */
export const DESCRICAO_REGISTRO_EN = "Public error log of the Observatory (Editorial Constitution, Art. 10). Every published error is recorded with its dates, detection channel and fix; nothing is deleted. A null field means not established, never estimated. The log feeds the autonomy levels: a relevant error in a note returns that type of note to level 1.";

const en: TextosPagina<typeof pt> = {
  titulo: "Public error log",
  descricaoMeta: "Every error published by Scrutiniums, with the affected surface, severity, detection and fix dates, and detection channel. Nothing is deleted.",
  trilha: "Breadcrumb",
  sobre: "About",
  trilhaAtual: "Error log",
  rotulo: "Corrections policy",
  contagem: (n: number) => `${n} ${n === 1 ? "error recorded" : "errors recorded"}. A date that was not established is shown as such.`,
  idiomaDoRegistro: "The entries below are kept in Portuguese, the language in which the log is maintained.",
};

export const TEXTOS_ERROS: Record<Idioma, TextosPagina<typeof pt>> = { pt, en };
