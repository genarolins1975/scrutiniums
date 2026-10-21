/**
 * Entrada com conta do Observatório das Contas Públicas.
 *
 * Números lidos do Resultado do Tesouro Nacional (RTN, governo central, caixa,
 * valores nominais), do SIOP (execução do orçamento da União) e do RGF dos
 * estados (Siconfi), pelos mesmos snapshots dos painéis. O modelo didático
 * segue a identidade do RTN: receita total, menos transferências, é a receita
 * líquida; menos a despesa primária, é o resultado primário. Juros da dívida
 * vêm de outra base (SIOP) e nunca são somados ao resultado.
 */
import contasFederais from "@/lib/contas-publicas/snapshots/dados.json";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import { comSinal, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

type LinhaRTN = {
  periodo: string;
  receitaTotal: number;
  transferencias: number;
  receitaLiquida: number;
  despesa: number;
  previdencia: number;
  pessoal: number;
  outrasObrigatorias: number;
  programacaoFinanceira: number;
  resultado: number;
};

const FONTE_RTN = "Tesouro Nacional, Resultado do Tesouro Nacional";

/** Último ano completo do RTN (valores em R$ milhões correntes). */
function anoCompleto(): LinhaRTN {
  const anuais = (contasFederais.rtnAnual as LinhaRTN[]).filter((r) => /^\d{4}$/.test(r.periodo));
  return anuais.reduce((a, b) => (b.periodo > a.periodo ? b : a));
}

/** Os 12 meses mais recentes do RTN, exigidos consecutivos. */
function dozeMeses(): LinhaRTN[] {
  const m = (contasFederais.rtnMensal as LinhaRTN[]).slice().sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-12);
  if (m.length !== 12) throw new Error("menos de 12 meses");
  for (let i = 1; i < m.length; i++) {
    const [a, ma] = m[i - 1].periodo.split("-").map(Number);
    const [b, mb] = m[i].periodo.split("-").map(Number);
    if (b * 12 + mb - (a * 12 + ma) !== 1) throw new Error("meses não consecutivos");
  }
  return m;
}

/** Juros e encargos da dívida pagos no orçamento da União (SIOP, grupo de natureza de despesa 2), em R$. */
function jurosPagos(): { valor: number; ano: number } {
  const anos = (contasFederais.orcamento as { ano: number; grupos: { codigo: string; pago: number }[] }[]).filter((o) => o.ano < Number(contasFederais.referenciaRTN.slice(0, 4)));
  const b = anos.reduce((x, y) => (y.ano > x.ano ? y : x));
  const g = b.grupos.find((x) => x.codigo === "2");
  if (!g) throw new Error("grupo 2 ausente");
  return { valor: g.pago, ano: b.ano };
}

const resultado12m = () =>
  numero(
    {
      rotulo: "Resultado primário do governo central em 12 meses",
      unidade: "bilhões de reais",
      fonte: FONTE_RTN,
      href: "/contas-publicas/panorama",
    },
    () => {
      const m = dozeMeses();
      const soma = m.reduce((s, x) => s + x.resultado, 0);
      return {
        valor: comSinal(soma / 1000, 1),
        periodo: `${mesAno(m[0].periodo)} a ${mesAno(m[11].periodo)}`,
        nota: `${soma < 0 ? "Negativo indica déficit" : "Positivo indica superávit"}, antes dos juros da dívida. Soma de valores nominais mensais.`,
      };
    },
  );

const receita = () =>
  numero(
    {
      rotulo: "Receita total do governo central",
      unidade: "trilhões de reais",
      fonte: FONTE_RTN,
      href: "/contas-publicas/panorama",
    },
    () => {
      const r = anoCompleto();
      return {
        valor: num(r.receitaTotal / 1e6, 2),
        periodo: r.periodo,
        nota: `Antes das transferências a estados e municípios, que levaram R$ ${num(r.transferencias / 1e3, 1)} bilhões. Valores nominais.`,
      };
    },
  );

const juros = () =>
  numero(
    {
      rotulo: "Juros e encargos da dívida pagos pela União",
      unidade: "bilhões de reais",
      fonte: "SIOP, execução do orçamento da União",
      href: "/contas-publicas/execucao",
      nota: "Grupo de despesa 2 do orçamento fiscal e da seguridade, valor pago. Não inclui amortização nem refinanciamento.",
    },
    () => {
      const j = jurosPagos();
      return { valor: num(j.valor / 1e9, 1), periodo: String(j.ano) };
    },
  );

const estadosAcima = () =>
  numero(
    {
      rotulo: "Estados com dívida maior que a receita corrente líquida",
      unidade: "de 27 UFs",
      fonte: "Tesouro Nacional, Siconfi (RGF, Anexo 2)",
      href: "/contas-publicas-estaduais",
    },
    () => {
      const rgf = primariosEstaduais.rgf as { uf: string; ano: number; periodo: number; status: string; valores: { percentual_declarado: number | null } }[];
      const conferidos = rgf.filter((r) => r.status === "fonte_primaria_conferida" && r.periodo === 3);
      const ano = Math.max(...conferidos.map((r) => r.ano));
      const doAno = conferidos.filter((r) => r.ano === ano);
      if (doAno.length !== 27) throw new Error("cobertura incompleta");
      const acima = doAno.filter((r) => (r.valores.percentual_declarado ?? 0) > 100);
      return {
        valor: String(acima.length),
        periodo: `${ano}, 3º quadrimestre`,
        nota: `${acima.map((r) => r.uf).join(", ")}: dívida consolidada líquida acima de 100% da receita corrente líquida, como declarada por cada estado.`,
      };
    },
  );

/** Até quatro números de escala do tema. */
export function escalaContas(): NumeroPorta[] {
  return [resultado12m(), receita(), juros(), estadosAcima()];
}

export type EtapaImposto = {
  id: string;
  titulo: string;
  texto: string;
  /** Valor em R$ bilhões nominais; negativo indica déficit. */
  bilhoes: number;
  /** Mesmo valor a cada R$ 100 da receita total. */
  porCem: number;
  /** Etapa que se subtrai da anterior (transferências e despesa). */
  sai?: boolean;
  partes?: { titulo: string; bilhoes: number; porCem: number }[];
};

export type FluxoImposto = {
  ano: string;
  fonte: string;
  etapas: EtapaImposto[];
  juros: NumeroPorta;
};

/**
 * Do imposto ao resultado, no último ano completo do RTN, em R$ bilhões e a
 * cada R$ 100 arrecadados. Confere as identidades do RTN antes de publicar;
 * se não fecharem, o modelo não é exibido.
 */
export function fluxoImposto(): FluxoImposto | null {
  try {
    const r = anoCompleto();
    const tol = 1; // R$ milhões
    const partes = r.previdencia + r.pessoal + r.outrasObrigatorias + r.programacaoFinanceira;
    if (Math.abs(r.receitaTotal - r.transferencias - r.receitaLiquida) > tol) throw new Error("receita líquida não fecha");
    if (Math.abs(partes - r.despesa) > tol) throw new Error("despesa não fecha");
    if (Math.abs(r.receitaLiquida - r.despesa - r.resultado) > tol) throw new Error("resultado não fecha");
    const bi = (v: number) => v / 1000;
    const cem = (v: number) => (100 * v) / r.receitaTotal;
    const parte = (titulo: string, v: number) => ({ titulo, bilhoes: bi(v), porCem: cem(v) });
    return {
      ano: r.periodo,
      fonte: `${FONTE_RTN}, série histórica até ${mesAno(contasFederais.referenciaRTN)}`,
      etapas: [
        { id: "arrecadacao", titulo: "Arrecadação", texto: "Impostos, contribuições e demais receitas do governo central.", bilhoes: bi(r.receitaTotal), porCem: 100 },
        { id: "transferencias", titulo: "Transferências a estados e municípios", texto: "Parcelas que a Constituição e as leis mandam repartir, como os fundos de participação.", bilhoes: bi(r.transferencias), porCem: cem(r.transferencias), sai: true },
        { id: "liquida", titulo: "Receita líquida", texto: "O que fica com a União para pagar as próprias despesas.", bilhoes: bi(r.receitaLiquida), porCem: cem(r.receitaLiquida) },
        {
          id: "despesa", titulo: "Despesa primária", texto: "Tudo o que a União gasta, exceto os juros da dívida.", bilhoes: bi(r.despesa), porCem: cem(r.despesa), sai: true,
          partes: [
            parte("Benefícios da Previdência", r.previdencia),
            parte("Pessoal e encargos", r.pessoal),
            parte("Outras despesas obrigatórias", r.outrasObrigatorias),
            parte("Despesas sujeitas à programação financeira", r.programacaoFinanceira),
          ],
        },
        { id: "resultado", titulo: "Resultado primário", texto: r.resultado < 0 ? "A despesa primária superou a receita líquida: déficit, antes dos juros." : "A receita líquida superou a despesa primária: superávit, antes dos juros.", bilhoes: bi(r.resultado), porCem: cem(r.resultado) },
      ],
      juros: juros(),
    };
  } catch {
    return null;
  }
}
