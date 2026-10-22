import { DADOS, ESTAGIOS, fiscalAcumulado, type Estagio } from "@/lib/contas-publicas/dados";
import rap from "@/lib/contas-publicas/snapshots/rap.json";
import { somarRAP } from "@/lib/contas-publicas/rap-modelo";
import { moeda, participacao } from "@/lib/contas-publicas/formato";
import { origemRAP, origemRTN, origemSIOP } from "@/lib/contas-publicas/proveniencia";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/** O que fica para trás em cada passo da cascata, na ordem: dotação, empenho, liquidação, pagamento. */
const PARADA = ["não empenhados", "empenhados e não liquidados", "liquidados e não pagos"];
const porcento = (r: number) => `${(r * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Os quatro estágios do orçamento federal no último exercício encerrado (dotação atualizada, empenhado, liquidado e pago), a
 * escala da entrada das Contas Federais no molde único (Iniciativa 4). Lidos de DADOS, a mesma base do capítulo de execução;
 * a cascata interativa com o exercício parcial fica num bloco recolhido da entrada.
 */
export function escalaFederal(ano = 2025): NumeroPorta[] {
  const base = DADOS.orcamento.find((b) => b.ano === ano);
  const etapas: Estagio[] = ["atualizada", "empenhado", "liquidado", "pago"];
  const valores = etapas.map((e) => base?.total[e] ?? null);
  const dot = valores[0];
  const periodo = `${ano}, exercício ${ano === 2026 ? "parcial" : "encerrado"}`;
  return etapas.map((e, i) => {
    const v = valores[i];
    const anterior = i > 0 ? valores[i - 1] : null;
    return {
      rotulo: ESTAGIOS.find((x) => x.id === e)!.nome,
      valor: ok(v) ? moeda(v, "reais") : null,
      unidade: i === 0 ? "limite autorizado no ano" : ok(v) && ok(dot) && dot > 0 ? `${porcento(v / dot)} da dotação` : "",
      periodo,
      fonte: "SIOP, dados abertos",
      nota: i > 0 && ok(v) && ok(anterior) ? `${moeda(anterior - v, "reais")} ${PARADA[i - 1]}.` : undefined,
      href: "/contas-publicas/execucao",
    };
  });
}

/** As três primeiras respostas das Contas Federais (pagamento, resultado primário e restos a pagar), com o número e a origem. */
export function respostasIniciais() {
  const orcamento = DADOS.orcamento.find((b) => b.ano === 2025)!;
  const divida = orcamento.grupos.filter((g) => ["2", "6"].includes(g.codigo)).reduce((s, g) => s + g.pago, 0);
  const fiscal = fiscalAcumulado(2025, 12)!;
  const saldo = somarRAP(rap.registros.filter((r) => r.periodo === "000/2026")).saldo;
  return [
    {
      pergunta: "Quanto foi pago do orçamento de 2025?",
      rotulo: "Pago do orçamento de 2025",
      valor: moeda(orcamento.total.pago, "reais"),
      recorte: "2025 · orçamento do exercício · sem restos a pagar",
      nota: `Juros e amortização: ${participacao(divida, orcamento.total.pago)}. Inclui refinanciamento. Pagamentos de compromissos de anos anteriores (restos a pagar) ficam separados.`,
      href: "execucao",
      acao: "Explorar os pagamentos",
      origem: origemSIOP(2025),
    },
    {
      pergunta: "As receitas cobriram as despesas, sem os juros?",
      rotulo: fiscal.resultado < 0 ? "Déficit primário do Governo Central" : "Superávit primário do Governo Central",
      valor: moeda(Math.abs(fiscal.resultado), "milhoes"),
      recorte: `2025 · ${fiscal.resultado < 0 ? "déficit primário" : "superávit primário"} · Governo Central`,
      nota: "Receita líquida menos despesa primária, sem juros. Não é o resultado nominal nem a apuração da meta fiscal.",
      href: "panorama",
      acao: "Entender o resultado",
      origem: origemRTN("Janeiro a dezembro de 2025"),
    },
    {
      pergunta: "Quanto ficou para pagar nos anos seguintes?",
      rotulo: "Saldo de restos a pagar",
      valor: moeda(saldo, "reais"),
      recorte: "Abertura de 2026 · restos a pagar",
      nota: "Saldo de compromissos de exercícios anteriores. Esta posição não mede pagamentos feitos durante 2026.",
      href: "restos-a-pagar",
      acao: "Acompanhar os compromissos",
      origem: { ...origemRAP("Abertura de 2026"), perimetro: "União · todos os órgãos da Base Geral · despesas primárias e financeiras" },
    },
  ];
}
