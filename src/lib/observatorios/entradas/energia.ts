/**
 * Entrada com conta do Observatório de Energia e Infraestrutura.
 *
 * Números lidos das golds do Setor Elétrico (ONS e ANEEL), do Gás Natural
 * (ANP e Comex Stat) e do Saneamento (IBGE e SINISA). O modelo didático
 * percorre a cadeia de cada serviço, da origem ao consumidor, com um número
 * publicado onde existe; elos sem número ficam só com a descrição.
 */
import { dataBr, lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

function sin12m(): any {
  const r = (lerPublico("energia", "gold", "geracao.json").regioes as any[]).find((x) => x.rg === "SIN");
  return r["12m"];
}

function indicadorGas(arquivo: string, chave: string): { valor: number; periodo: string; unidade: string } {
  const i = lerPublico("gas", "gold", `${arquivo}.json`).indicadores[chave];
  if (typeof i?.valor !== "number") throw new Error(`${arquivo}.${chave} ausente`);
  return { valor: i.valor, periodo: i.periodo, unidade: i.unidade };
}

/** "2025-09 a 2026-08" ou "2026-09" → "set/2025 a ago/2026" ou "set/2026". */
function periodoGas(p: string): string {
  return p.split(" a ").map(mesAno).join(" a ");
}

function censo(): any {
  return (lerPublico("saneamento", "gold", "agregados.json") as any[]).find((x) => x.id === "BR");
}

const renovaveis = () =>
  numero(
    {
      rotulo: "Hidráulica, eólica e solar na geração do sistema interligado",
      unidade: "% da geração verificada",
      fonte: "ONS, balanço de energia",
      href: "/setor-eletrico/geracao",
      nota: "Últimos 12 meses. Não inclui a solar instalada nos telhados, que o balanço do ONS não mede.",
    },
    () => {
      const m = sin12m();
      return { valor: num(m.hes, 1), periodo: `${dataBr(m.inicio)} a ${dataBr(m.fim)}` };
    },
  );

const tarifa = () =>
  numero(
    {
      rotulo: "Tarifa residencial de luz, distribuidora típica",
      unidade: "por kWh",
      fonte: "ANEEL, tarifas homologadas",
      href: "/setor-eletrico/conta-de-luz",
      nota: "Mediana das tarifas residenciais vigentes, sem tributos, bandeira nem iluminação pública: não é o valor da fatura.",
    },
    () => {
      const c = lerPublico("energia", "gold", "conta.json");
      return { valor: `R$ ${num(c.tarifas.resumo.mediana / 1000, 2)}`, periodo: `vigente em ${dataBr(c.data_referencia)}` };
    },
  );

const botijao = () =>
  numero(
    { rotulo: "Preço médio do botijão de gás de 13 kg", unidade: "na revenda", fonte: "ANP, levantamento de preços", href: "/gas-natural/gas-de-cozinha" },
    () => {
      const p = indicadorGas("gas-de-cozinha", "medio_mes");
      const n = indicadorGas("gas-de-cozinha", "postos_mes");
      return { valor: `R$ ${num(p.valor, 2)}`, periodo: periodoGas(p.periodo), nota: `Média de ${num(n.valor, 0)} revendas pesquisadas no mês.` };
    },
  );

const semEsgoto = () =>
  numero(
    { rotulo: "Pessoas sem rede de esgoto nem fossa séptica", unidade: "milhões de moradores", fonte: "IBGE, Censo Demográfico", href: "/saneamento/acesso" },
    () => {
      const e = censo().censo2022.moradores.esgoto;
      return {
        valor: num(e.sem_rede_nem_septica / 1e6, 1),
        periodo: "2022",
        nota: `${num((100 * e.sem_rede_nem_septica) / e.total, 1)}% dos moradores. Inclui fossa rudimentar, vala, rio e domicílios sem banheiro.`,
      };
    },
  );

/** Até quatro números de escala do tema. */
export function escalaEnergia(): NumeroPorta[] {
  return [renovaveis(), tarifa(), botijao(), semEsgoto()];
}

export type EloCadeia = { titulo: string; texto: string; numero?: NumeroPorta };
export type Cadeia = { id: string; titulo: string; pergunta: string; elos: EloCadeia[]; paineis: { titulo: string; href: string }[] };

/** Da origem ao consumidor: luz, gás e água e esgoto, com o número publicado de cada elo onde existe. */
export function cadeias(): Cadeia[] {
  const geracao = numero(
    { rotulo: "Geração média do sistema interligado", unidade: "MW médios", fonte: "ONS, balanço de energia", href: "/setor-eletrico/geracao" },
    () => {
      const m = sin12m();
      return { valor: num(m.total_mwmed, 0), periodo: `${dataBr(m.inicio)} a ${dataBr(m.fim)}`, nota: `Hidráulica ${num(m.participacao.hidraulica, 1)}%, eólica ${num(m.participacao.eolica, 1)}%, solar ${num(m.participacao.solar, 1)}% e térmica ${num(m.participacao.termica, 1)}%.` };
    },
  );
  const reservatorios = numero(
    { rotulo: "Água guardada nos reservatórios das hidrelétricas", unidade: "% da capacidade", fonte: "ONS", href: "/setor-eletrico/agua-e-clima", nota: "Sistema interligado nacional, em energia armazenada." },
    () => {
      const a = lerPublico("energia", "gold", "agua_detalhe.json").armazenamento;
      const sin = (a.subsistemas as any[]).find((s) => s.sm === "SIN");
      return { valor: num(sin.ear_pct, 1), periodo: dataBr(sin.dia ?? a.dia) };
    },
  );
  const tarifaSocial = numero(
    { rotulo: "Unidades consumidoras com Tarifa Social", unidade: "milhões", fonte: "ANEEL, Sistema de Controle de Subvenções", href: "/setor-eletrico/inclusao-energetica" },
    () => {
      const k = lerPublico("energia", "gold", "inclusao.json").tarifa_social.kpis.uc_tsee;
      return { valor: num(k.valor / 1e6, 1), periodo: mesAno(k.mes), nota: "Desconto na conta de luz para famílias de baixa renda inscritas no CadÚnico." };
    },
  );
  const producaoGas = numero(
    { rotulo: "Produção de gás natural", unidade: "milhões de m³ por dia", fonte: "ANP, produção por estado", href: "/gas-natural/producao" },
    () => {
      const p = indicadorGas("producao", "producao_12m");
      const mar = indicadorGas("producao", "mar_pct_12m");
      return { valor: num(p.valor, 1), periodo: periodoGas(p.periodo), nota: `Média de 12 meses; ${num(mar.valor, 1)}% vem do mar.` };
    },
  );
  const disponivel = numero(
    { rotulo: "Parte da produção que chega ao mercado", unidade: "% da produção", fonte: "ANP, aproveitamento do gás", href: "/gas-natural/producao" },
    () => {
      const d = indicadorGas("aproveitamento", "disponivel");
      const r = indicadorGas("aproveitamento", "reinjecao");
      return { valor: num(d.valor, 1), periodo: periodoGas(d.periodo), nota: `${num(r.valor, 1)}% é reinjetado nos poços; o restante é consumido na produção ou queimado.` };
    },
  );
  const importado = numero(
    { rotulo: "Gás importado na oferta ao mercado", unidade: "% da oferta", fonte: "ANP e MDIC, Comex Stat", href: "/gas-natural/importacao" },
    () => {
      const p = indicadorGas("importacao", "participacao_12m");
      const g = indicadorGas("importacao", "gnl_participacao_massa_12m");
      return { valor: num(p.valor, 1), periodo: periodoGas(p.periodo), nota: `Soma do importado com o disponível nacional. O gás liquefeito (GNL) foi ${num(g.valor, 1)}% da massa importada.` };
    },
  );
  const semAgua = numero(
    { rotulo: "Pessoas sem ligação à rede de água", unidade: "milhões de moradores", fonte: "IBGE, Censo Demográfico", href: "/saneamento/acesso" },
    () => {
      const a = censo().censo2022.moradores.agua;
      return { valor: num(a.sem_ligacao / 1e6, 1), periodo: "2022", nota: `Abastecidas por poço, nascente, carro-pipa, chuva ou rio: ${num((100 * a.sem_ligacao) / a.total, 1)}% dos moradores.` };
    },
  );
  const investimento = numero(
    { rotulo: "Investimento em água e esgoto", unidade: "bilhões de reais", fonte: "Ministério das Cidades, SINISA", href: "/saneamento/investimento" },
    () => {
      const s = censo().sinisa;
      const ano = lerPublico("saneamento", "gold", "meta.json").sinisa.ano_referencia;
      const t = s.agua.investimento.total + s.esgoto.investimento.total;
      return { valor: num(t / 1e9, 1), periodo: String(ano), nota: `Água R$ ${num(s.agua.investimento.total / 1e9, 1)} bi e esgoto R$ ${num(s.esgoto.investimento.total / 1e9, 1)} bi, declarados por prestadores e governos estaduais.` };
    },
  );
  const prestadores = numero(
    { rotulo: "Prestadores de água e esgoto", unidade: "prestadores", fonte: "Ministério das Cidades, SINISA", href: "/saneamento/prestadores" },
    () => {
      const p = lerPublico("saneamento", "gold", "prestadores.json") as any[];
      const r = lerPublico("saneamento", "gold", "reguladores.json") as any[];
      const ano = lerPublico("saneamento", "gold", "meta.json").sinisa.ano_referencia;
      return { valor: num(p.length, 0), periodo: String(ano), nota: `Declarados ao SINISA: companhias estaduais, empresas privadas, autarquias e prefeituras. Os municípios declararam ${num(r.length, 0)} entidades reguladoras.` };
    },
  );
  return [
    {
      id: "luz", titulo: "Luz", pergunta: "De onde vem a energia e quanto ela custa?",
      elos: [
        { titulo: "Gerar", texto: "Usinas hidrelétricas, eólicas, solares e térmicas produzem a energia do sistema interligado.", numero: geracao },
        { titulo: "Guardar e transportar", texto: "Os reservatórios guardam água para gerar depois; a transmissão leva a energia entre as regiões, sob operação do ONS.", numero: reservatorios },
        { titulo: "Distribuir e cobrar", texto: "A distribuidora da sua região entrega a energia e cobra a tarifa que a ANEEL homologa.", numero: tarifa() },
        { titulo: "Chegar a todos", texto: "Descontos e programas de acesso para quem tem baixa renda ou vive longe da rede.", numero: tarifaSocial },
      ],
      paineis: [{ titulo: "Setor Elétrico", href: "/setor-eletrico" }, { titulo: "Conta de luz", href: "/setor-eletrico/conta-de-luz" }],
    },
    {
      id: "gas", titulo: "Gás", pergunta: "Quanto gás o país produz e quanto chega ao consumidor?",
      elos: [
        { titulo: "Extrair", texto: "O gás sai dos poços, a maior parte no mar, quase sempre junto com o petróleo.", numero: producaoGas },
        { titulo: "Aproveitar", texto: "Boa parte volta aos poços para manter a pressão; o que sobra segue por gasodutos.", numero: disponivel },
        { titulo: "Importar", texto: "A oferta é completada por gás da Bolívia, por gasoduto, e por navios de gás liquefeito.", numero: importado },
        { titulo: "Chegar à casa", texto: "Nas casas, o gás chega em botijão (GLP, outro produto) ou pelo encanamento da distribuidora local.", numero: botijao() },
      ],
      paineis: [{ titulo: "Gás Natural", href: "/gas-natural" }, { titulo: "Gás de cozinha", href: "/gas-natural/gas-de-cozinha" }],
    },
    {
      id: "agua", titulo: "Água e esgoto", pergunta: "Quem está sem água e esgoto, e quanto se investe?",
      elos: [
        { titulo: "Prestar e regular", texto: "O município presta o serviço diretamente ou o delega a uma companhia; uma agência reguladora fiscaliza preço e qualidade.", numero: prestadores },
        { titulo: "Investir", texto: "Prestadores e governos investem para ampliar e repor redes de água, coleta e tratamento.", numero: investimento },
        { titulo: "Abastecer", texto: "A rede leva água tratada às casas; quem não está ligado depende de poço, carro-pipa ou rio.", numero: semAgua },
        { titulo: "Coletar e tratar", texto: "O esgoto deveria ir para a rede ou para fossa séptica; o restante vai para fossa rudimentar, vala ou rio.", numero: semEsgoto() },
      ],
      paineis: [{ titulo: "Saneamento", href: "/saneamento" }, { titulo: "Ficha do município", href: "/saneamento/municipio" }],
    },
  ];
}

/* eslint-enable @typescript-eslint/no-explicit-any */
