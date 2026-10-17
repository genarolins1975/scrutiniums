/**
 * Reúne os verbetes publicados pelos módulos temáticos. Cada módulo edita só o seu
 * arquivo conceitos-<modulo>.ts; este arquivo não precisa mudar.
 */
import type { Idioma } from "@/lib/idioma";
import type { Conceito } from "./conceitos";
import { CONCEITOS_IDIOMAS as PLD } from "./conceitos-pld";
import { CONCEITOS_IDIOMAS as PREVISOES } from "./conceitos-previsoes";
import { CONCEITOS_IDIOMAS as AGUA } from "./conceitos-agua";
import { CONCEITOS_IDIOMAS as GERACAO } from "./conceitos-geracao";
import { CONCEITOS_IDIOMAS as CARGA } from "./conceitos-carga";
import { CONCEITOS_IDIOMAS as REDE } from "./conceitos-rede";
import { CONCEITOS_IDIOMAS as MERCADO } from "./conceitos-mercado";
import { CONCEITOS_IDIOMAS as CONTA } from "./conceitos-conta";
import { CONCEITOS_IDIOMAS as PERDAS } from "./conceitos-perdas";
import { CONCEITOS_IDIOMAS as QUALIDADE } from "./conceitos-qualidade";
import { CONCEITOS_IDIOMAS as INCLUSAO } from "./conceitos-inclusao";
import { CONCEITOS_IDIOMAS as EMPRESAS } from "./conceitos-empresas";
import { CONCEITOS_IDIOMAS as EXPANSAO } from "./conceitos-expansao";
import { CONCEITOS_IDIOMAS as TRANSICAO } from "./conceitos-transicao";
import { CONCEITOS_IDIOMAS as REGULACAO } from "./conceitos-regulacao";
import { CONCEITOS_IDIOMAS as INSTITUICOES } from "./conceitos-instituicoes";

const MODULOS: Record<Idioma, Conceito[]>[] = [INSTITUICOES, PLD, PREVISOES, AGUA, GERACAO, CARGA, REDE, MERCADO, CONTA, PERDAS, QUALIDADE, INCLUSAO, EMPRESAS, EXPANSAO, TRANSICAO, REGULACAO];

/** Os verbetes dos módulos nos dois idiomas, na mesma ordem e com os mesmos slugs. */
export const CONCEITOS_MODULOS_IDIOMAS: Record<Idioma, Conceito[]> = {
  pt: MODULOS.flatMap((m) => m.pt),
  en: MODULOS.flatMap((m) => m.en),
};
export const CONCEITOS_MODULOS: Conceito[] = CONCEITOS_MODULOS_IDIOMAS.pt;
