/**
 * Kit de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o molde único das páginas de painel e as peças que o compõem. Toda
 * página de painel migrada usa só estas peças para abertura, número, figura, tabela, controle, nota e gráfico; o teste
 * src/tests/painel-molde.test.ts confere a anatomia no HTML do servidor.
 */
export { PaginaPainel } from "./PaginaPainel";
export { AberturaPainel } from "./AberturaPainel";
export { NumeroIndicador, textoVariacao, unidadeIndicador, valorIndicador } from "./NumeroIndicador";
export { FaixaNumeros } from "./FaixaNumeros";
export { FiguraAnalitica } from "./FiguraAnalitica";
export { TabelaDados } from "./TabelaDados";
export { Controles } from "./Controles";
export { ParaLer } from "./ParaLer";
export { LeituraGuiada } from "./LeituraGuiada";
export { GraficoLinhas } from "./GraficoLinhas";
export { GraficoBarras } from "./GraficoBarras";
export { GraficoPontos } from "./GraficoPontos";
export { GraficoDispersao } from "./GraficoDispersao";
export { DetalheDoNivel } from "./DetalheDoNivel";
export type * from "@/lib/painel/tipos";
