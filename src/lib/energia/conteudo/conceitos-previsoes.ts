import type { Idioma } from "@/lib/idioma";
import type { Conceito } from "./conceitos";

/**
 * Verbetes do módulo previsoes. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 */
export const CONCEITOS: Conceito[] = [];
export const CONCEITOS_IDIOMAS: Record<Idioma, Conceito[]> = { pt: CONCEITOS, en: CONCEITOS };
