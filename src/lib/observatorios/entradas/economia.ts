/**
 * Entrada com conta do Observatório da Economia.
 *
 * Números lidos das golds do Crédito (Banco Central, SGS e estatísticas de
 * meios de pagamento) e do Agronegócio (IBGE e Comex Stat). O modelo didático
 * percorre o crédito do juro básico ao atraso, com as definições do Banco
 * Central; ele não estima quanto da Selic chega às taxas, nem em que prazo.
 */
import { dataBr, lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { serieCredito } from "./familias";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

const bcb = (codigo: string) => `Banco Central, SGS série ${codigo}`;

/** Mês de uma série combinada na nota, quando difere do mês do número principal. */
function seOutro(principal: { ref: string }, outra: { ref: string }): string {
  return outra.ref.slice(0, 7) === principal.ref.slice(0, 7) ? "" : ` (${mesAno(outra.ref)})`;
}

function pix(): any {
  const p = lerPublico("obs", "data", "gold", "pix.json");
  if (!p.disponivel) throw new Error("pix indisponível");
  return p;
}

function agro(): any {
  return lerPublico("agro", "gold", "snapshot.json").economia;
}

/** "2025-T3" ou "2025.3" → "3º tri/2025". */
function trimestre(p: string): string {
  const [ano, t] = p.split(/[-.]T?/);
  return `${t}º tri/${ano}`;
}

const creditoPib = () =>
  numero(
    { rotulo: "Crédito total em relação ao PIB", unidade: "% do PIB", fonte: bcb("20622"), href: "/observatorio/credit" },
    () => {
      const s = serieCredito("credito_pib");
      const saldo = serieCredito("saldo_total");
      return { valor: num(s.v, 1), periodo: mesAno(s.ref), nota: `Saldo de R$ ${num(saldo.v / 1e6, 2)} trilhões em ${mesAno(saldo.ref)} (SGS ${saldo.codigo}), com famílias e empresas.` };
    },
  );

const transacoesPix = () =>
  numero(
    { rotulo: "Transações Pix no mês", unidade: "bilhões", fonte: "Banco Central, estatísticas de meios de pagamento", href: "/observatorio/pix" },
    () => {
      const p = pix();
      return { valor: num(p.kpis.qtd.v / 1e9, 2), periodo: mesAno(p.mes), nota: `${num(p.kpis.qtd.yoy, 1)}% a mais que no mesmo mês do ano anterior. Inclui transferências entre pessoas, compras e pagamentos ao governo.` };
    },
  );

const inadPj = () =>
  numero(
    { rotulo: "Crédito das empresas com atraso acima de 90 dias", unidade: "% da carteira", fonte: bcb("21083"), href: "/observatorio/credit" },
    () => {
      const s = serieCredito("inad_pj");
      return { valor: num(s.v, 2), periodo: mesAno(s.ref), nota: "Carteira de pessoas jurídicas com recursos livres e direcionados." };
    },
  );

const exportacoesAgro = () =>
  numero(
    {
      rotulo: "Participação do agronegócio nas exportações",
      unidade: "% do valor exportado",
      fonte: "MDIC, Comex Stat",
      href: "/agronegocio/mercados",
      nota: "Recorte por capítulos do Sistema Harmonizado; difere do Agrostat do Ministério da Agricultura.",
    },
    () => {
      const anual = agro().comercio.exportacoes.anual;
      const u = anual[anual.length - 1];
      return { valor: num(u.participacao, 1), periodo: String(u.ano) };
    },
  );

/** Até quatro números de escala do tema, um por coleção. */
export function escalaEconomia(): NumeroPorta[] {
  return [creditoPib(), transacoesPix(), inadPj(), exportacoesAgro()];
}

export type PassoCredito = { id: string; titulo: string; pergunta: string; texto: string; numeros: NumeroPorta[]; href: string };
export type CircuitoCredito = { passos: PassoCredito[]; trilhos: NumeroPorta[]; producao: NumeroPorta[] };

/** Do juro básico ao atraso, com os pagamentos e a produção ao lado. */
export function circuitoCredito(): CircuitoCredito {
  const selic = numero(
    { rotulo: "Meta da taxa Selic", unidade: "% ao ano", fonte: bcb("432"), href: "/observatorio/credit", nota: "Definida pelo Copom; é a referência para o custo do dinheiro entre bancos." },
    () => {
      const s = serieCredito("selic_meta");
      return { valor: num(s.v, 2), periodo: `vigente em ${dataBr(s.ref)}` };
    },
  );
  const taxa = numero(
    { rotulo: "Taxa média de juros do crédito", unidade: "% ao ano", fonte: bcb("20714"), href: "/observatorio/credit" },
    () => {
      const t = serieCredito("taxa_total");
      const pf = serieCredito("taxa_pf");
      const pj = serieCredito("taxa_pj");
      return { valor: num(t.v, 2), periodo: mesAno(t.ref), nota: `Operações contratadas no mês. Famílias ${num(pf.v, 2)}%${seOutro(t, pf)} e empresas ${num(pj.v, 2)}%${seOutro(t, pj)} ao ano.` };
    },
  );
  const spread = numero(
    { rotulo: "Spread médio", unidade: "pontos percentuais", fonte: bcb("20783"), href: "/observatorio/credit", nota: "Diferença entre a taxa cobrada e o custo de captação dos bancos." },
    () => {
      const s = serieCredito("spread_total");
      return { valor: num(s.v, 2), periodo: mesAno(s.ref) };
    },
  );
  const saldo = numero(
    { rotulo: "Saldo do crédito", unidade: "trilhões de reais", fonte: bcb("20539"), href: "/observatorio/credit-panorama" },
    () => {
      const t = serieCredito("saldo_total");
      const pf = serieCredito("saldo_pf");
      const pj = serieCredito("saldo_pj");
      return { valor: num(t.v / 1e6, 2), periodo: mesAno(t.ref), nota: `Famílias R$ ${num(pf.v / 1e6, 2)} tri${seOutro(t, pf)} e empresas R$ ${num(pj.v / 1e6, 2)} tri${seOutro(t, pj)}. Estoque: tudo o que está emprestado.` };
    },
  );
  const concessoes = numero(
    { rotulo: "Crédito novo concedido no mês", unidade: "bilhões de reais", fonte: bcb("20631"), href: "/observatorio/credit", nota: "Fluxo: o que foi contratado no mês, que não se soma ao saldo." },
    () => {
      const c = serieCredito("concessoes_total");
      return { valor: num(c.v / 1e3, 1), periodo: mesAno(c.ref) };
    },
  );
  const inad = numero(
    { rotulo: "Crédito com atraso acima de 90 dias", unidade: "% da carteira", fonte: bcb("21082"), href: "/observatorio/credit" },
    () => {
      const t = serieCredito("inad_total");
      const pf = serieCredito("inad_pf");
      const pj = serieCredito("inad_pj");
      return { valor: num(t.v, 2), periodo: mesAno(t.ref), nota: `Famílias ${num(pf.v, 2)}%${seOutro(t, pf)} e empresas ${num(pj.v, 2)}%${seOutro(t, pj)}.` };
    },
  );
  const valorPix = numero(
    { rotulo: "Valor movimentado pelo Pix no mês", unidade: "trilhões de reais", fonte: "Banco Central, estatísticas de meios de pagamento", href: "/observatorio/pix" },
    () => {
      const p = pix();
      return { valor: num(p.kpis.valor.v / 1e12, 2), periodo: mesAno(p.mes), nota: `${num(p.kpis.qtd.v / 1e9, 2)} bilhões de transações; ${num(p.kpis.usuarios.v / 1e6, 1)} milhões de usuários em ${dataBr(p.kpis.usuarios.data)}.` };
    },
  );
  const vaAgro = numero(
    { rotulo: "Peso da agropecuária no valor adicionado", unidade: "%", fonte: "IBGE, Contas Nacionais Trimestrais", href: "/agronegocio/tamanho", nota: "Só a produção dentro da porteira; não inclui insumos, agroindústria nem serviços ligados ao agro." },
    () => {
      const u4 = agro().pib.ultimos4;
      return { valor: num(u4.participacaoVa, 1), periodo: `4 trimestres, ${trimestre(u4.inicio)} a ${trimestre(u4.fim)}` };
    },
  );
  return {
    passos: [
      { id: "juro", titulo: "Juro básico", pergunta: "Quanto custa o dinheiro?", texto: "O Banco Central fixa a meta da Selic, base para o que os bancos pagam para captar recursos.", numeros: [selic], href: "/observatorio/credit" },
      { id: "preco", titulo: "Juro cobrado", pergunta: "Quanto o banco cobra?", texto: "A taxa do empréstimo soma o custo de captação e o spread, que cobre risco, impostos, custos e margem.", numeros: [taxa, spread], href: "/observatorio/credit" },
      { id: "volume", titulo: "Crédito", pergunta: "Quanto se empresta?", texto: "O saldo é tudo o que está emprestado; as concessões são o crédito novo de cada mês.", numeros: [saldo, concessoes], href: "/observatorio/credit-panorama" },
      { id: "risco", titulo: "Atraso", pergunta: "Quanto deixa de ser pago?", texto: "Crédito com parcelas vencidas há mais de 90 dias, sobre o total emprestado, separando famílias e empresas.", numeros: [inad], href: "/observatorio/credit" },
    ],
    trilhos: [valorPix],
    producao: [vaAgro, exportacoesAgro()],
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
