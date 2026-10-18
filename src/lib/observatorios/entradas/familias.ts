/**
 * Entrada com conta do Observatório das Famílias.
 *
 * Números de escala e o modelo didático do orçamento doméstico, todos lidos
 * das golds publicadas pelas coleções de origem (Crédito, Eficiência Estatal,
 * Agronegócio, Gás Natural, Setor Elétrico). Cada número traz fonte e
 * período da própria base; números de fontes e períodos diferentes nunca são
 * somados nem comparados entre si.
 */
import { lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

function serieCredito(chave: string): { v: number; ref: string; codigo: string } {
  const s = lerPublico("obs", "data", "gold", "pulse.json").series[chave];
  if (s.tipo !== "DADO OBSERVADO") throw new Error(`série ${chave} não observada`);
  const u = s.obs[s.obs.length - 1];
  return { v: u.v, ref: u.ref, codigo: String(s.meta.series_code) };
}

function habitacao(): any {
  const h = lerPublico("eficiencia", "habitacao", "snapshot.json");
  return { ...h.territorios.find((t: any) => t.id === "BR"), ano: h.ano };
}

/** Até quatro números de escala do tema, cada um com prova. */
export function escalaFamilias(): NumeroPorta[] {
  return [
    numero(
      {
        rotulo: "Parte da renda das famílias usada para pagar dívidas com bancos",
        unidade: "% da renda mensal",
        fonte: "Banco Central, SGS série 29034",
        href: "/observatorio/credit",
        nota: "Juros e amortizações sobre a renda disponível, com ajuste sazonal. Só dívidas no sistema financeiro.",
      },
      () => {
        const s = serieCredito("comprometimento");
        return { valor: num(s.v, 1), periodo: mesAno(s.ref) };
      },
    ),
    numero(
      {
        rotulo: "Dívida total das famílias com bancos em relação à renda de 12 meses",
        unidade: "% da renda acumulada",
        fonte: "Banco Central, SGS série 29037",
        href: "/observatorio/credit",
        nota: "Inclui financiamento imobiliário, que é dívida de prazo longo.",
      },
      () => {
        const s = serieCredito("endividamento");
        return { valor: num(s.v, 1), periodo: mesAno(s.ref) };
      },
    ),
    numero(
      {
        rotulo: "Déficit habitacional",
        unidade: "milhões de domicílios",
        fonte: "Fundação João Pinheiro",
        href: "/eficiencia-estatal/habitacao/deficit",
        nota: "Estimativa de necessidades habitacionais. Não equivale a pessoas sem moradia nem a uma fila de atendimento.",
      },
      () => {
        const h = habitacao();
        return { valor: num(h.deficit / 1e6, 2), periodo: String(h.ano) };
      },
    ),
    numero(
      {
        rotulo: "Inflação da comida em casa, em 12 meses",
        unidade: "%",
        fonte: "IBGE, IPCA, alimentação no domicílio",
        href: "/agronegocio/prato",
      },
      () => {
        const meses = lerPublico("agro", "gold", "snapshot.json").economia.prato.meses;
        const u = meses[meses.length - 1];
        return { valor: num(u.domicilio, 2), periodo: `12 meses até ${mesAno(u.mes)}`, nota: `IPCA geral no mesmo período: ${num(u.geral, 2)}%.` };
      },
    ),
  ];
}

/** Um elo do modelo didático: o que é, o número que o mede e onde se aprofunda. */
export type EloOrcamento = { titulo: string; explicacao: string; numero: NumeroPorta | null; href: string; painel: string };
export type EtapaOrcamento = { id: string; titulo: string; pergunta: string; elos: EloOrcamento[] };

/**
 * Modelo didático do orçamento doméstico: de onde vem o dinheiro, para onde vai
 * o essencial, quando entra a dívida e onde estão os riscos. Mostra relações
 * entre as partes; não é a conta de uma família real.
 */
export function orcamentoFamilia(): EtapaOrcamento[] {
  const inadimplencia = numero(
    { rotulo: "Crédito das famílias com atraso acima de 90 dias", unidade: "% da carteira", fonte: "Banco Central, SGS série 21084", href: "/observatorio/credit" },
    () => {
      const s = serieCredito("inad_pf");
      return { valor: num(s.v, 2), periodo: mesAno(s.ref) };
    },
  );
  const aluguel = numero(
    { rotulo: "Domicílios de baixa renda que gastam mais de 30% da renda com aluguel", unidade: "milhões", fonte: "Fundação João Pinheiro", href: "/eficiencia-estatal/habitacao/aluguel-renda" },
    () => {
      const h = habitacao();
      return { valor: num(h.aluguel / 1e6, 2), periodo: String(h.ano), nota: "Domicílios urbanos com renda de até três salários mínimos; componente do déficit habitacional." };
    },
  );
  const botijao = numero(
    { rotulo: "Botijão de gás de 13 kg, preço médio", unidade: "por botijão", fonte: "ANP", href: "/gas-natural/gas-de-cozinha" },
    () => {
      const m = lerPublico("gas", "gold", "gas-de-cozinha.json").indicadores.medio_mes;
      return { valor: `R$ ${num(m.valor, 2)}`, periodo: mesAno(m.periodo) };
    },
  );
  const comida = numero(
    { rotulo: "Inflação da comida em casa, 12 meses", unidade: "%", fonte: "IBGE, IPCA", href: "/agronegocio/prato" },
    () => {
      const meses = lerPublico("agro", "gold", "snapshot.json").economia.prato.meses;
      const u = meses[meses.length - 1];
      return { valor: num(u.domicilio, 2), periodo: `até ${mesAno(u.mes)}` };
    },
  );
  const comprometimento = numero(
    { rotulo: "Renda comprometida com dívidas bancárias", unidade: "% da renda mensal", fonte: "Banco Central, SGS série 29034", href: "/observatorio/credit" },
    () => {
      const s = serieCredito("comprometimento");
      return { valor: num(s.v, 1), periodo: mesAno(s.ref) };
    },
  );
  return [
    {
      id: "entra",
      titulo: "O que entra",
      pergunta: "De onde vem o dinheiro da família?",
      elos: [
        { titulo: "Renda do trabalho", explicacao: "Salários, trabalho por conta própria e emprego formal, nos recortes do IBGE e do Novo Caged.", numero: null, href: "/eficiencia-estatal/trabalho-renda", painel: "Trabalho e renda" },
        { titulo: "Proteção social", explicacao: "Cadastro Único, assistência social e programas de alimentação para quem tem renda baixa ou instável.", numero: null, href: "/eficiencia-estatal/assistencia-social", painel: "Assistência social e cuidado" },
      ],
    },
    {
      id: "essencial",
      titulo: "O essencial",
      pergunta: "Para onde vai o dinheiro antes de qualquer escolha?",
      elos: [
        { titulo: "Comida", explicacao: "O preço dos alimentos comprados para casa, item por item da cesta.", numero: comida, href: "/agronegocio/prato", painel: "Comida no prato" },
        { titulo: "Moradia", explicacao: "Aluguel, condições da casa e déficit habitacional.", numero: aluguel, href: "/eficiencia-estatal/habitacao", painel: "Habitação" },
        { titulo: "Gás, luz e água", explicacao: "Botijão, tarifa de energia e tarifa de água e esgoto, cada uma com a regra do seu regulador.", numero: botijao, href: "/gas-natural/gas-de-cozinha", painel: "Gás de cozinha" },
      ],
    },
    {
      id: "divida",
      titulo: "Quando falta",
      pergunta: "Quando a família recorre ao crédito?",
      elos: [
        { titulo: "Dívida com bancos", explicacao: "Cartão, empréstimo pessoal, consignado e financiamentos: quanto da renda vai para as parcelas.", numero: comprometimento, href: "/observatorio/credit", painel: "Pulso do crédito" },
        { titulo: "Consignado e aposentados", explicacao: "Crédito descontado na folha ou no benefício, por idade e instituição.", numero: null, href: "/observatorio/payroll-lending-aging", painel: "Consignado e aposentados" },
      ],
    },
    {
      id: "risco",
      titulo: "Os riscos",
      pergunta: "O que transforma aperto em inadimplência?",
      elos: [
        { titulo: "Atraso", explicacao: "Parcelas que deixam de ser pagas por mais de 90 dias.", numero: inadimplencia, href: "/observatorio/credit", painel: "Pulso do crédito" },
        { titulo: "Golpes e apostas", explicacao: "Fraudes financeiras e apostas online, com o grau de evidência de cada número.", numero: null, href: "/observatorio/financial-fraud", painel: "Golpes e fraudes" },
        { titulo: "Renegociação", explicacao: "Desenrola Brasil e outras saídas para quem já está em atraso.", numero: null, href: "/observatorio/desenrola", painel: "Desenrola Brasil" },
      ],
    },
  ];
}

/* eslint-enable @typescript-eslint/no-explicit-any */
