/**
 * Reúne os verbetes publicados pelos módulos temáticos. Cada módulo edita só o seu
 * arquivo conceitos-<modulo>.ts; este arquivo não precisa mudar.
 */
import type { Conceito } from "./conceitos";
import { CONCEITOS as PLD } from "./conceitos-pld";
import { CONCEITOS as PREVISOES } from "./conceitos-previsoes";
import { CONCEITOS as AGUA } from "./conceitos-agua";
import { CONCEITOS as GERACAO } from "./conceitos-geracao";
import { CONCEITOS as CARGA } from "./conceitos-carga";
import { CONCEITOS as REDE } from "./conceitos-rede";
import { CONCEITOS as MERCADO } from "./conceitos-mercado";
import { CONCEITOS as CONTA } from "./conceitos-conta";
import { CONCEITOS as PERDAS } from "./conceitos-perdas";
import { CONCEITOS as QUALIDADE } from "./conceitos-qualidade";
import { CONCEITOS as INCLUSAO } from "./conceitos-inclusao";
import { CONCEITOS as EMPRESAS } from "./conceitos-empresas";
import { CONCEITOS as EXPANSAO } from "./conceitos-expansao";
import { CONCEITOS as TRANSICAO } from "./conceitos-transicao";
import { CONCEITOS as REGULACAO } from "./conceitos-regulacao";
import { CONCEITOS as INSTITUICOES } from "./conceitos-instituicoes";

export const CONCEITOS_MODULOS: Conceito[] = [...INSTITUICOES, ...PLD, ...PREVISOES, ...AGUA, ...GERACAO, ...CARGA, ...REDE, ...MERCADO, ...CONTA, ...PERDAS, ...QUALIDADE, ...INCLUSAO, ...EMPRESAS, ...EXPANSAO, ...TRANSICAO, ...REGULACAO];
