import { TermoDica } from "@/components/evidencia/TermoDica";
import { tx } from "@/lib/energia/idioma";

/**
 * Unidades de medida com dica: convenções de medida, não afirmações sobre o
 * setor. A definição completa fica em Metodologia, seção Unidades. Nome e dica seguem o idioma da página (getters com tx).
 */
const UNIDADES = {
  MWmed: {
    get nome() { return tx("Megawatt médio", "Average megawatt"); },
    get dica() {
      return tx(
        "Energia de um período dividida pelo número de horas do período (MWh ÷ horas). É a unidade em que o ONS publica carga, geração e intercâmbio.",
        "Energy of a period divided by the number of hours in the period (MWh ÷ hours). It is the unit in which ONS publishes load, generation and interchange.",
      );
    },
  },
  "MWmês": {
    get nome() { return tx("Megawatt-mês", "Megawatt-month"); },
    get dica() {
      return tx(
        "Energia equivalente a um megawatt médio durante um mês. É a unidade em que o ONS publica a energia armazenada (EAR).",
        "Energy equivalent to one average megawatt over a month. It is the unit in which ONS publishes stored energy (EAR).",
      );
    },
  },
  "p.p.": {
    get nome() { return tx("Pontos percentuais", "Percentage points"); },
    get dica() { return tx("Diferença entre dois percentuais: de 60% para 62% são 2 p.p. (e não 2%).", "Difference between two percentages: from 60% to 62% is 2 p.p. (not 2%)."); },
  },
} as const;

export type UnidadeId = keyof typeof UNIDADES;

export function Unidade({ u, alvo = false }: { u: UnidadeId; alvo?: boolean }) {
  const x = UNIDADES[u];
  return (
    <TermoDica href="/setor-eletrico/metodologia#unidades" rotulo={`${u} · ${x.nome}`} dica={x.dica} alvo={alvo}>
      {u}
    </TermoDica>
  );
}

// getters, e não cópia: a lista lê nome e dica no idioma da página no momento do uso
export const LISTA_UNIDADES = Object.entries(UNIDADES).map(([u, x]) => ({
  u,
  get nome(): string {
    return x.nome;
  },
  get dica(): string {
    return x.dica;
  },
}));
