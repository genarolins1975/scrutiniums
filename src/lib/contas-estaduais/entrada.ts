import { comparar } from "@/lib/contas-estaduais/comparacao";
import { dividaPrimaria, snapshot } from "@/lib/contas-estaduais/dados";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * Os dois números do estado escolhido na entrada das Contas Estaduais (molde único, Iniciativa 4): a execução do orçamento
 * (liquidado sobre a dotação atualizada, RREO) e a dívida líquida sobre a RCL ajustada (RGF), das mesmas respostas originais
 * conferidas que a ficha do estado usa. Sem fonte conferida no ano, o valor é null ("Indisponível nesta publicação").
 */
export function escalaEstadual(uf: string, ano: number): NumeroPorta[] {
  const estado = snapshot.ufs.find((u) => u.uf === uf)!;
  const execucao = comparar(ano, "CE-04", "Todas", true).linhas.find((l) => l.uf === uf)?.valor ?? null;
  const divida = dividaPrimaria(uf, ano)?.valores.percentual_declarado ?? null;
  const parcial = ano === 2026;
  return [
    {
      rotulo: `${estado.nome}: orçamento liquidado sobre a dotação atualizada`,
      valor: execucao === null ? null : pct(execucao),
      unidade: "da dotação",
      periodo: `${ano}${parcial ? ", parcial" : ""}, janeiro a dezembro`,
      fonte: "Tesouro / Siconfi, RREO",
      nota: execucao === null ? "Sem fonte conferida neste ano." : undefined,
      href: "#ficha",
    },
    {
      rotulo: `${estado.nome}: dívida líquida sobre a RCL ajustada`,
      valor: divida === null ? null : pct(divida),
      unidade: "da receita corrente líquida",
      periodo: `${ano}, ${parcial ? "1º" : "3º"} quadrimestre`,
      fonte: "Tesouro / Siconfi, RGF",
      nota: divida === null ? "Sem fonte conferida neste ano." : undefined,
      href: "#divida-estadual",
    },
  ];
}
