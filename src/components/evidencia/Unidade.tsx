import { TermoDica } from "@/components/evidencia/TermoDica";

/**
 * Unidades de medida com dica: convenções de medida, não afirmações sobre o
 * setor. A definição completa fica em Metodologia, seção Unidades.
 */
const UNIDADES = {
  MWmed: {
    nome: "Megawatt médio",
    dica: "Energia de um período dividida pelo número de horas do período (MWh ÷ horas). É a unidade em que o ONS publica carga, geração e intercâmbio.",
  },
  "MWmês": {
    nome: "Megawatt-mês",
    dica: "Energia equivalente a um megawatt médio durante um mês. É a unidade em que o ONS publica a energia armazenada (EAR).",
  },
  "p.p.": {
    nome: "Pontos percentuais",
    dica: "Diferença entre dois percentuais: de 60% para 62% são 2 p.p. (e não 2%).",
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

export const LISTA_UNIDADES = Object.entries(UNIDADES).map(([u, x]) => ({ u, ...x }));
