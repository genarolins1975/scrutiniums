/**
 * Registro das seis portas de "O Brasil em perguntas".
 *
 * Os números são lidos das mesmas golds e snapshots que alimentam os painéis,
 * no momento da publicação. Cada leitura é isolada: se um arquivo faltar ou
 * mudar de forma, só aquele número fica indisponível, com a ausência dita na
 * página. Fonte e unidade acompanham a base; o período vem do próprio arquivo.
 * Os destinos levam aos painéis dos observatórios (com conta) e as páginas de
 * método são públicas.
 */
import { dominio, type DominioId } from "@/lib/dominios";
import { OBSERVATORIOS, donoDaRota, observatorio, type ObservatorioId } from "@/lib/observatorios/registro";
import contasFederais from "@/lib/contas-publicas/snapshots/dados.json";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import type { CaminhoPorta, ConsultaAberta, NumeroPorta, Porta } from "./tipos";
import { comSinal, dataBr, lerPublico, mesAno, num, numero } from "./leitura";
import { consultasLeva2, metodosLeva2 } from "./leva2";
import { composicao, emCem, ultimoEncerrado } from "@/lib/contas-publicas/areas";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
/** Destino com o domínio de origem (ou o próprio observatório, quando ele mantém o painel) e a coleção do registro a que pertence. */
function caminho(obs: DominioId | ObservatorioId, pergunta: string, resumo: string, href: string): CaminhoPorta {
  const dono = donoDaRota(href);
  const colecao = dono ? observatorio(dono.observatorio).colecoes.find((c) => c.id === dono.colecao)?.nome : undefined;
  const nome = OBSERVATORIOS.some((o) => o.id === obs) ? observatorio(obs as ObservatorioId).nomeCurto : dominio(obs as DominioId).nomeCurto;
  return { pergunta, resumo, href, observatorio: nome, colecao: colecao ?? nome };
}

/**
 * Consultas pessoais abertas (leva 1, 19/10/2026; src/lib/rotasPublicas.ts). Cada uma responde ao caso de quem
 * pergunta, sem conta; séries completas, comparações amplas e downloads seguem nos painéis. Princípio do aperitivo
 * (20/10/2026): uma única página aberta por tema, que sem sessão mostra só o aperitivo; o simulador da conta de água
 * saiu da área aberta, e o resumo de cada consulta descreve o aperitivo, não o painel completo.
 */
export const CONSULTAS = {
  botijao: {
    pergunta: "Quanto custa o botijão no meu estado?",
    resumo: "O preço médio do botijão de 13 kg no seu estado no último mês, comparado com a média do Brasil, pela pesquisa de preços da ANP.",
    href: "/gas-natural/gas-de-cozinha",
  },
  luz: {
    pergunta: "Quanto custa a minha conta de luz?",
    resumo: "A conta estimada para o seu consumo na distribuidora da sua cidade, sem tributos, com a bandeira do mês.",
    href: "/setor-eletrico/conta-de-luz",
  },
  municipio: {
    pergunta: "Como está o saneamento no meu município?",
    resumo: "Quantos moradores da sua cidade têm água e esgoto e quem presta o serviço.",
    href: "/saneamento/municipio",
  },
  capital: {
    pergunta: "Como está a minha capital?",
    resumo: "Alguns indicadores da sua capital, cada um com o ano, a fonte e a posição entre as 26 capitais.",
    href: "/eficiencia-estatal",
  },
  // painel Previdência e INSS (20/10/2026): sem sessão, o endereço mostra só o município escolhido no último dezembro
  internet: {
    pergunta: "Como é a internet na minha cidade?",
    resumo: "Quantos acessos de banda larga fixa o seu município tem por 100 habitantes, quantos por fibra, quantas empresas atendem e quem está dentro da cobertura 4G e 5G, pela Anatel.",
    href: "/conectividade",
  },
  inss: {
    pergunta: "Quanto o INSS paga na minha cidade?",
    resumo: "Quantos benefícios o INSS pagou por agências da sua cidade em dezembro e o valor médio de cada um, pelo Ministério da Previdência Social.",
    href: "/contas-publicas/previdencia",
  },
  // painel Educação nos municípios (20/10/2026): sem sessão, o endereço mostra só o Ideb mais recente da rede municipal
  escola: {
    pergunta: "Como está a escola pública da minha cidade?",
    resumo: "O Ideb mais recente das escolas da prefeitura da sua cidade, nos anos iniciais e finais do ensino fundamental, pelo INEP.",
    href: "/educacao-municipal",
  },
} satisfies Record<string, ConsultaAberta>;

// ------------------------------------------------- Números compartilhados

/*
 * Números que a camada aberta e o bloco "Para você" das entradas (src/lib/observatorios/paraVoce.ts) mostram:
 * um leitor só por número, para que os dois lugares nunca divirjam.
 */

const rtn = contasFederais.rtnAnual as { periodo: string; despesa: number; previdencia: number; resultado: number }[];
/** O último ano completo do Resultado do Tesouro Nacional. */
const anoCompleto = () => rtn.filter((r) => /^\d{4}$/.test(r.periodo)).reduce((a, b) => (b.periodo > a.periodo ? b : a));

/** Preço médio do botijão de 13 kg no Brasil, o mesmo da consulta aberta /gas-natural/gas-de-cozinha. */
export const numeroBotijao = (): NumeroPorta =>
  numero(
    {
      rotulo: "Preço médio do botijão de gás de 13 kg",
      unidade: "por botijão",
      fonte: "ANP, Levantamento de Preços de Combustíveis",
      href: "/gas-natural/gas-de-cozinha",
    },
    () => {
      const m = lerPublico("gas", "gold", "gas-de-cozinha.json").indicadores.medio_mes;
      return { valor: `R$ ${num(m.valor, 2)}`, periodo: mesAno(m.periodo), nota: "Média das revendas pesquisadas no mês, Brasil." };
    },
  );

/**
 * Inflação oficial em 12 meses no Brasil (IPCA, índice geral), a mesma da primeira tela do painel /custo-de-vida, com a
 * faixa entre as 16 áreas pesquisadas no mesmo mês. Lida da gold do painel (public/inflacao/gold/ipca.json).
 */
export const numeroCustoDeVida = (): NumeroPorta =>
  numero(
    {
      rotulo: "Inflação oficial em 12 meses, Brasil",
      unidade: "%",
      fonte: "IBGE, IPCA, tabela 7060 do SIDRA",
      href: "/custo-de-vida",
    },
    () => {
      const g = lerPublico("inflacao", "gold", "ipca.json");
      const areas = (g.areas as { id: string; nome: string }[])
        .filter((a) => a.id !== "1")
        .map((a) => ({ nome: a.nome, doze: g.ultimo[a.id].geral.doze as number }))
        .sort((x, y) => x.doze - y.doze || x.nome.localeCompare(y.nome, "pt-BR"));
      const menor = areas[0];
      const maior = areas[areas.length - 1];
      if (areas.length !== 16 || typeof g.ultimo["1"]?.geral?.doze !== "number") throw new Error("gold do IPCA incompleta");
      return {
        valor: comSinal(g.ultimo["1"].geral.doze, 2),
        periodo: `12 meses até ${mesAno(g.ultimo_mes)}`,
        nota: `Nas 16 áreas pesquisadas pelo IBGE, de ${comSinal(menor.doze, 2)}% em ${menor.nome} a ${comSinal(maior.doze, 2)}% em ${maior.nome}.`,
      };
    },
  );

/** Inflação da alimentação no domicílio em 12 meses (IPCA), a mesma do painel /agronegocio/prato. */
export const numeroComidaEmCasa = (): NumeroPorta =>
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
  );

/** Crédito das famílias com atraso acima de 90 dias, do pulso do Crédito. */
export const numeroAtrasoFamilias = (): NumeroPorta =>
  numero(
    {
      rotulo: "Crédito das famílias com atraso acima de 90 dias",
      unidade: "% da carteira",
      fonte: "Banco Central, SGS série 21084",
      href: "/observatorio/credit",
      nota: "Só dívidas com bancos e financeiras; não inclui crediário informal nem contas de consumo.",
    },
    () => {
      const s = lerPublico("obs", "data", "gold", "pulse.json").series.inad_pf;
      const u = s.obs[s.obs.length - 1];
      return { valor: num(u.v, 2), periodo: mesAno(u.ref) };
    },
  );

/** Ideb dos anos iniciais nas redes municipais das capitais (mediana), do painel de Educação. */
export const numeroIdebCapitais = (): NumeroPorta =>
  numero(
    {
      rotulo: "Ideb do 1º ao 5º ano nas escolas municipais das capitais (mediana)",
      unidade: "de 0 a 10",
      fonte: "INEP, Ideb",
      href: "/eficiencia-estatal/educacao-municipal-capitais",
    },
    () => {
      const e = lerPublico("eficiencia", "gold", "educacao_capitais.json");
      const refs = (e.referencias as any[]).filter(
        (r) => r.indicador === "edu.ideb.rede_municipal" && r.componente === "ideb" && r.etapa === "anos_iniciais" && r.grupo === "todas",
      );
      const r = refs.reduce((a, b) => (b.ano > a.ano ? b : a));
      return {
        valor: num(r.mediana, 2),
        periodo: String(r.ano),
        nota: `${r.n} capitais, de ${num(r.minimo, 1)} a ${num(r.maximo, 1)}. Mediana: metade das capitais está acima, metade abaixo.`,
      };
    },
  );

/**
 * Ideb dos anos iniciais das redes municipais do Brasil na edição mais recente, o primeiro número do painel Educação nos
 * municípios, lido da gold dele (public/educacao/gold/educacao.json, pipeline/educacao).
 */
export const numeroEducacaoMunicipios = (): NumeroPorta =>
  numero(
    {
      rotulo: "Ideb do 1º ao 5º ano nas escolas municipais do Brasil",
      unidade: "de 0 a 10",
      fonte: "INEP, Ideb",
      href: "/educacao-municipal",
    },
    () => {
      const g = lerPublico("educacao", "gold", "educacao.json");
      const k = g.ideb.anos.length - 1;
      const v = g.ideb.brasil.ai.municipal.ideb[k];
      const d = g.distribuicao.ai.brasil;
      if (typeof v !== "number" || typeof d?.n !== "number") throw new Error("gold da educação incompleta");
      return {
        valor: num(v, 1),
        periodo: String(g.ideb.ano),
        nota: `Metade das ${num(d.n, 0)} redes municipais com resultado ficou entre ${num(d.p25, 1)} e ${num(d.p75, 1)}. Anos finais: ${num(g.ideb.brasil.af.municipal.ideb[k], 1)}.`,
      };
    },
  );

/** Despesa municipal com saúde por morador (mediana das capitais), do painel de Saúde. */
export const numeroSaudeCapitais = (): NumeroPorta =>
  numero(
    {
      rotulo: "Despesa da prefeitura com saúde por morador (mediana das capitais)",
      unidade: "por habitante no ano",
      fonte: "Tesouro Nacional, Siconfi, e IBGE, população",
      href: "/eficiencia-estatal/saude-capitais",
      nota: "Despesa liquidada pelo município; não inclui o gasto da União e do estado no território. Valores nominais.",
    },
    () => {
      const g = lerPublico("eficiencia", "gold", "saude_capitais.json");
      const refs = (g.referencias as any[]).filter(
        (r) => r.indicador === "sau.despesa.por_habitante" && r.componente === "nominal" && r.grupo === "todas" && typeof r.mediana === "number",
      );
      const r = refs.reduce((a, b) => (b.ano > a.ano ? b : a));
      return { valor: `R$ ${num(r.mediana, 0)}`, periodo: `${r.ano}, ${r.n} capitais com dado` };
    },
  );

/**
 * Benefícios pagos pelo INSS no mês mais recente do BEPS (todos os grupos), o primeiro número do painel Previdência e INSS,
 * lido da gold dele (public/previdencia/gold/previdencia.json, pipeline/previdencia).
 */
export const numeroInss = (): NumeroPorta =>
  numero(
    {
      rotulo: "Benefícios pagos pelo INSS no mês",
      unidade: "milhões",
      fonte: "Ministério da Previdência Social, Boletim Estatístico da Previdência Social",
      href: "/contas-publicas/previdencia",
    },
    () => {
      const g = lerPublico("previdencia", "gold", "previdencia.json");
      const t = (g.brasil_mes.tipos as { id: string; q: number }[]);
      const total = t.find((x) => x.id === "total");
      const rgps = t.find((x) => x.id === "rgps");
      const assist = t.find((x) => x.id === "assistenciais");
      if (!total || !rgps || !assist) throw new Error("gold da previdência incompleta");
      return {
        valor: num(total.q / 1e6, 2),
        periodo: mesAno(g.brasil_mes.referencia),
        nota: `${num(rgps.q / 1e6, 2)} milhões do Regime Geral e ${num(assist.q / 1e6, 2)} milhões assistenciais, como o BPC. Conta benefícios, não pessoas.`,
      };
    },
  );

/**
 * Parte de cada R$ 100 pagos pelo orçamento federal que foi para a dívida pública, no último exercício encerrado: o
 * número do painel Despesa por área (/contas-publicas/por-area), com a mesma conta (src/lib/contas-publicas/areas.ts).
 */
export const numeroDividaCem = (): NumeroPorta =>
  numero(
    {
      rotulo: "Parte dos pagamentos federais que foi para a dívida pública",
      unidade: "a cada R$ 100 pagos",
      fonte: "SIOP, execução do orçamento da União por função",
      href: "/contas-publicas/por-area",
      nota: "Juros, amortização e refinanciamento de títulos (função Encargos Especiais, subfunções 841 a 844), valor pago no exercício, em valores nominais. O restante se divide entre as transferências a estados e municípios e as áreas de governo.",
    },
    () => {
      const ano = ultimoEncerrado();
      if (ano === null) throw new Error("sem exercício encerrado");
      const c = composicao(ano, "pago", "total");
      const itens = c ? emCem(c) : null;
      if (!itens) throw new Error("composição indisponível");
      const divida = itens.filter((p) => p.tipo === "divida").reduce((s, p) => s + p.cem, 0);
      return { valor: `R$ ${num(divida, 1)}`, periodo: String(ano) };
    },
  );

/** Estados com dívida consolidada líquida acima da receita corrente líquida (RGF, 3º quadrimestre). */
export const numeroEstadosDivida = (): NumeroPorta =>
  numero(
    {
      rotulo: "Estados com dívida maior que a receita corrente líquida",
      unidade: "de 27 UFs",
      fonte: "Tesouro Nacional, Siconfi (RGF, Anexo 2)",
      href: "/contas-publicas-estaduais",
      nota: "Dívida consolidada líquida acima de 100% da receita corrente líquida, como declarada por cada estado.",
    },
    () => {
      const rgf = primariosEstaduais.rgf as { uf: string; ano: number; periodo: number; status: string; valores: { percentual_declarado: number | null } }[];
      const conferidos = rgf.filter((r) => r.status === "fonte_primaria_conferida" && r.periodo === 3);
      const ano = Math.max(...conferidos.map((r) => r.ano));
      const doAno = conferidos.filter((r) => r.ano === ano);
      if (doAno.length !== 27) throw new Error("cobertura incompleta");
      const pct = (r: (typeof doAno)[number]) => r.valores.percentual_declarado ?? 0;
      const acima = doAno.filter((r) => pct(r) > 100);
      const teto = doAno.filter((r) => pct(r) > 200).map((r) => r.uf);
      return {
        valor: String(acima.length),
        periodo: `${ano}, 3º quadrimestre`,
        nota: `${acima.map((r) => r.uf).join(", ")}. O limite fixado pelo Senado para os estados é 200%${teto.length ? `; acima dele: ${teto.join(", ")}` : ""}.`,
      };
    },
  );

/** Identidade da porta lida do registro dos observatórios. */
function identidade(id: ObservatorioId) {
  const o = observatorio(id);
  return { id, nome: o.nomeCurto, nomeCompleto: o.nome, pergunta: o.pergunta, acento: o.acento };
}

// ------------------------------------------------------------------ Bolso

function porta_familias(): Porta {
  return {
    ...identidade("familias"),
    resumo:
      "Renda, dívidas, proteção social, moradia e os preços que entram no orçamento doméstico, cada um medido pela fonte oficial do seu tema.",
    // a inflação de todo o orçamento abre a porta (e o cartão da home, que mostra o primeiro número) desde 20/10/2026; a
    // comida em casa continua a um clique, no caminho "Por que a comida subiu?" e no painel canônico /agronegocio/prato
    numeros: [
      numeroCustoDeVida(),
      numeroBotijao(),
      numeroAtrasoFamilias(),
    ],
    caminhos: [
      caminho("familias", "Quanto subiu o custo de vida na minha cidade?", "A inflação do IPCA em cada uma das 16 áreas pesquisadas e no Brasil, por grupo de despesa, mês a mês desde 2020.", "/custo-de-vida"),
      caminho("eficiencia", "Quanto as famílias ganham com o trabalho?", "Rendimento, ocupação, emprego formal e Cadastro Único nos recortes de cada fonte.", "/eficiencia-estatal/trabalho-renda"),
      caminho("credito", "Os aposentados estão mais endividados?", "Crédito consignado por idade, benefício e instituição.", "/observatorio/payroll-lending-aging"),
      caminho("credito", "As apostas online pesam no crédito das famílias?", "Apostas, endividamento e inadimplência, com o grau de evidência de cada número.", "/observatorio/bets-financial-risk"),
      caminho("credito", "Quantos golpes financeiros acontecem?", "Golpes e fraudes registrados, por tipo e canal, com fonte primária.", "/observatorio/financial-fraud"),
      caminho("eficiencia", "Falta moradia ou falta moradia adequada?", "Déficit habitacional, peso do aluguel na renda e inadequação dos domicílios.", "/eficiencia-estatal/habitacao"),
      caminho("agro", "Por que a comida subiu?", "Inflação de alimentos, itens da cesta e segurança alimentar dos domicílios.", "/agronegocio/prato"),
    ],
    paraOSeuCaso: [CONSULTAS.botijao, CONSULTAS.luz],
    lacunas: [
      "Quanto cada família paga de impostos sobre o consumo.",
      "Dívidas fora dos bancos: crediário e contas de consumo atrasadas.",
    ],
    metodos: [
      { rotulo: "Gás Natural: método", href: "/gas-natural/metodologia" },
      { rotulo: "Agronegócio: método", href: "/agronegocio/metodologia" },
      { rotulo: "Glossário do crédito", href: "/glossario" },
    ],
  };
}

// ------------------------------------------------------- Serviços públicos

function porta_servicos(): Porta {
  return {
    ...identidade("servicos-publicos"),
    resumo:
      "Recursos, atendimento e resultados dos serviços públicos: a escola pública de cada município, a mesma régua para cada capital e o volume e o tempo dos processos na Justiça, cada medida com o universo da sua fonte.",
    // a escola pública dos municípios (painel Educação nos municípios, 20/10/2026) abre a porta e o cartão da home, que mostra o
    // primeiro número; o Ideb das capitais segue a um clique, no caminho "Como estão as escolas municipais das capitais?"
    numeros: [
      numeroEducacaoMunicipios(),
      numero(
        {
          rotulo: "Processos à espera de decisão final na Justiça",
          unidade: "milhões",
          fonte: "CNJ, Justiça em Números",
          href: "/eficiencia-estatal/judiciario",
        },
        () => {
          const j = lerPublico("eficiencia", "judiciario", "snapshot.json");
          return {
            valor: num(j.nacional.pendentesMilhoes, 1),
            periodo: j.fonte.referencia.match(/\d{4}/)?.[0] ?? j.fonte.referencia,
            nota: `Tempo médio de um processo pendente: ${num(j.nacional.tempoPendentes, 0)} meses.`,
          };
        },
      ),
      numeroSaudeCapitais(),
    ],
    caminhos: [
      caminho("eficiencia", "Como estão as escolas municipais das capitais?", "Despesa por matrícula, alunos por turma, aprovação, Ideb e Saeb nas 26 capitais.", "/eficiencia-estatal/educacao-municipal-capitais"),
      caminho("eficiencia", "A atenção primária à saúde alcança a população?", "Despesa, unidades básicas, equipes e internações evitáveis nas capitais.", "/eficiencia-estatal/saude-capitais"),
      caminho("eficiencia", "Quanto tempo a Justiça leva?", "Despesas, filas e tempos em 57 tribunais, sem nota própria de eficiência.", "/eficiencia-estatal/judiciario"),
      caminho("eficiencia", "A Justiça é acessível a quem precisa?", "Cobertura das defensorias, tempo de resposta e conciliação.", "/eficiencia-estatal/acesso-justica"),
      caminho("eficiencia", "Quanta violência cada estado registra?", "Homicídios registrados pela polícia e óbitos por agressão na saúde, por UF e em taxa por 100 mil habitantes, com a referência do Brasil.", "/eficiencia-estatal/seguranca-publica/estados"),
    ],
    paraOSeuCaso: [CONSULTAS.escola, CONSULTAS.capital],
    lacunas: [
      "Filas e tempo de espera no SUS.",
      "Saúde nos municípios que não são capitais.",
    ],
    metodos: [
      { rotulo: "Educação: métodos", href: "/eficiencia-estatal/educacao-municipal-capitais/metodos" },
      { rotulo: "Saúde: métodos", href: "/eficiencia-estatal/saude-capitais/metodos" },
      { rotulo: "Segurança pública: métodos", href: "/eficiencia-estatal/seguranca-publica/metodos" },
    ],
  };
}

// --------------------------------------------------------- Dinheiro público

function porta_dinheiro(): Porta {
  return {
    ...identidade("contas-publicas"),
    resumo:
      "Receitas e despesas do governo federal, o resultado das contas e a dívida dos estados, com valores nominais e o período de cada demonstrativo.",
    // o INSS (painel Previdência e INSS, 20/10/2026) abre a porta e o cartão da home, que mostra o primeiro número; a
    // parte da despesa primária que vai para benefícios segue no Panorama e na régua do painel Despesa por área
    numeros: [
      numeroInss(),
      numero(
        {
          rotulo: "Resultado primário do governo central",
          unidade: "bilhões de reais",
          fonte: "Tesouro Nacional, Resultado do Tesouro Nacional",
          href: "/contas-publicas/panorama",
        },
        () => {
          const r = anoCompleto();
          return {
            valor: comSinal(r.resultado / 1000, 1),
            periodo: r.periodo,
            nota: r.resultado < 0 ? "Negativo indica déficit: as despesas primárias superaram as receitas líquidas. Valores nominais." : "Positivo indica superávit. Valores nominais.",
          };
        },
      ),
      numeroEstadosDivida(),
    ],
    caminhos: [
      caminho("contas", "Para onde vai o dinheiro federal, por área?", "Cada R$ 100 pagos por área de governo (saúde, educação, previdência), com a dívida à parte, desde 2000.", "/contas-publicas/por-area"),
      caminho("contas", "O governo fechou as contas no azul ou no vermelho?", "Receitas, despesas e resultado primário do governo central desde 1997.", "/contas-publicas/panorama"),
      caminho("contas", "Quanto do orçamento foi efetivamente pago?", "Da autorização ao pagamento, com juros e refinanciamento da dívida separados.", "/contas-publicas/execucao"),
      caminho("contas", "Quanto custa manter o governo federal?", "Custos da União por natureza (pessoal, funcionamento, transferências e benefícios), do relatório de custos do Tesouro.", "/contas-publicas/custos"),
      caminho("contas", "O que ficou para pagar no ano seguinte?", "Restos a pagar inscritos, pagos e cancelados.", "/contas-publicas/restos-a-pagar"),
      caminho("contas", "Quanto os governos devem?", "Dívida bruta do governo geral desde 2006, em reais e em % do PIB, e quanto do orçamento federal já nasce obrigatório.", "/contas-publicas/riscos"),
      caminho("contas", "Quanto a União deixa de arrecadar com benefícios tributários?", "Isenções, deduções e regimes especiais estimados pela Receita Federal, por tributo, área e benefício.", "/contas-publicas/beneficios"),
      caminho("estados", "Como está a dívida do meu estado?", "Execução, receitas, despesas e dívida das 27 unidades da Federação lado a lado.", "/contas-publicas-estaduais"),
      caminho("credito", "Quem deve à União?", "Dívida ativa da União inscrita na Procuradoria da Fazenda, por tipo de devedor.", "/observatorio/federal-tax-debt"),
    ],
    paraOSeuCaso: [CONSULTAS.inss],
    lacunas: [
      "Previdência dos servidores públicos: os regimes próprios da União, dos estados e dos municípios.",
      "Quem paga os impostos e o que muda com a reforma tributária.",
    ],
    metodos: [
      { rotulo: "Contas Federais: método", href: "/contas-publicas/metodologia" },
      { rotulo: "Contas Federais: glossário", href: "/contas-publicas/glossario" },
    ],
  };
}


// --------------------------------------------------- Energia e infraestrutura

function porta_energia(): Porta {
  return {
    ...identidade("energia-e-infraestrutura"),
    resumo:
      "Eletricidade, gás, água e esgoto e transporte: oferta, tarifas e acesso, a partir dos dados abertos do ONS, da ANEEL, da ANP, do IBGE e do SINISA.",
    numeros: [
      numero(
        {
          rotulo: "Pessoas sem rede de esgoto nem fossa séptica",
          unidade: "milhões de moradores",
          fonte: "IBGE, Censo Demográfico",
          href: "/saneamento/acesso",
        },
        () => {
          const br = (lerPublico("saneamento", "gold", "agregados.json") as any[]).find((x) => x.id === "BR");
          const e = br.censo2022.moradores.esgoto;
          return {
            valor: num(e.sem_rede_nem_septica / 1e6, 1),
            periodo: "2022",
            nota: `${num((100 * e.sem_rede_nem_septica) / e.total, 1)}% dos moradores. Inclui fossa rudimentar, vala, rio e domicílios sem banheiro.`,
          };
        },
      ),
      numero(
        {
          rotulo: "Água guardada nos reservatórios das hidrelétricas",
          unidade: "% da capacidade",
          fonte: "ONS, energia armazenada por subsistema",
          href: "/setor-eletrico/agua-e-clima",
          nota: "Sistema interligado nacional, em energia armazenada.",
        },
        () => {
          const a = lerPublico("energia", "gold", "agua_detalhe.json").armazenamento;
          const sin = (a.subsistemas as any[]).find((s) => s.sm === "SIN");
          return { valor: num(sin.ear_pct, 1), periodo: dataBr(sin.dia ?? a.dia) };
        },
      ),
      numero(
        {
          rotulo: "Tarifa residencial de luz, distribuidora típica",
          unidade: "por kWh",
          fonte: "ANEEL, tarifas homologadas",
          href: "/setor-eletrico/conta-de-luz",
          nota: "Mediana das tarifas B1 vigentes, sem tributos, bandeira nem iluminação pública: não é o valor da fatura.",
        },
        () => {
          const c = lerPublico("energia", "gold", "conta.json");
          return { valor: `R$ ${num(c.tarifas.resumo.mediana / 1000, 2)}`, periodo: `vigente em ${dataBr(c.data_referencia)}` };
        },
      ),
    ],
    caminhos: [
      caminho("energia", "Os reservatórios estão cheios ou vazios?", "Armazenamento e chuvas por região, comparados ao histórico da mesma época.", "/setor-eletrico/agua-e-clima"),
      caminho("energia", "Quais fontes geram a energia do país?", "Geração por fonte e por usina, com solar distribuída separada.", "/setor-eletrico/geracao"),
      caminho("gas", "Quanto gás o Brasil produz e importa?", "Produção por estado, gás reinjetado e queimado, importação por origem.", "/gas-natural/producao"),
      caminho("gas", "Quanto custa encher o tanque no meu estado?", "Gasolina, etanol e diesel por estado e no Brasil, mês a mês desde 2013.", "/combustiveis"),
      caminho("eficiencia", "Como as pessoas se deslocam nas cidades?", "Oferta e uso do transporte público nos recortes disponíveis.", "/eficiencia-estatal/mobilidade-transporte"),
    ],
    paraOSeuCaso: [CONSULTAS.luz, CONSULTAS.internet, CONSULTAS.municipio, CONSULTAS.botijao],
    lacunas: [
      "Valor final da conta de luz com tributos e bandeira tarifária.",
      "Rodovias, ferrovias e portos.",
    ],
    metodos: [
      { rotulo: "Setor Elétrico: método", href: "/setor-eletrico/metodologia" },
      { rotulo: "Setor Elétrico: aprenda", href: "/setor-eletrico/aprenda" },
      { rotulo: "Gás Natural: método", href: "/gas-natural/metodologia" },
      { rotulo: "Saneamento: método", href: "/saneamento/metodologia" },
    ],
  };
}

// --------------------------------------------------------- Economia que produz

function porta_economia(): Porta {
  return {
    ...identidade("economia"),
    resumo:
      "O peso da agropecuária na economia e nas exportações, o sistema financeiro e os pagamentos, a partir das contas nacionais, do comércio exterior e do Banco Central.",
    numeros: [
      numero(
        {
          rotulo: "Participação do agronegócio nas exportações",
          unidade: "% do valor exportado",
          fonte: "MDIC, Comex Stat",
          href: "/agronegocio/mercados",
          nota: "Recorte por capítulos do Sistema Harmonizado; difere do Agrostat do Ministério da Agricultura.",
        },
        () => {
          const anual = lerPublico("agro", "gold", "snapshot.json").economia.comercio.exportacoes.anual;
          const u = anual[anual.length - 1];
          return { valor: num(u.participacao, 1), periodo: String(u.ano) };
        },
      ),
      numero(
        {
          rotulo: "Peso da agropecuária no valor adicionado da economia",
          unidade: "%",
          fonte: "IBGE, Contas Nacionais Trimestrais",
          href: "/agronegocio/tamanho",
          nota: "Só a produção dentro da porteira; não inclui insumos, agroindústria nem serviços ligados ao agro.",
        },
        () => {
          const u4 = lerPublico("agro", "gold", "snapshot.json").economia.pib.ultimos4;
          return { valor: num(u4.participacaoVa, 1), periodo: `4 trimestres, ${trimestre(u4.inicio)} a ${trimestre(u4.fim)}` };
        },
      ),
      numero(
        {
          rotulo: "Crédito total em relação ao PIB",
          unidade: "%",
          fonte: "Banco Central, SGS série 20622",
          href: "/observatorio/credit",
        },
        () => {
          const s = lerPublico("obs", "data", "gold", "pulse.json").series.credito_pib;
          const u = s.obs[s.obs.length - 1];
          return { valor: num(u.v, 1), periodo: mesAno(u.ref) };
        },
      ),
    ],
    caminhos: [
      caminho("agro", "Quanto o agro pesa na economia?", "Parcela no valor adicionado, crescimento em volume e peso nas exportações.", "/agronegocio/tamanho"),
      caminho("agro", "Para quem o Brasil vende e de quem depende?", "Exportações por produto e país e a origem dos fertilizantes.", "/agronegocio/mercados"),
      caminho("credito", "Quem empresta e para quem?", "Carteira por estado, faixa de renda, ocupação e produto.", "/observatorio/credit-panorama"),
      caminho("credito", "Como se comparam os bancos?", "Capital, inadimplência e rentabilidade dentro de cada segmento.", "/observatorio/institutions"),
      caminho("credito", "Os juros e os atrasos estão subindo?", "Concessões, saldo, taxas e inadimplência por segmento, com a série histórica.", "/observatorio/credit"),
      caminho("credito", "Como o Pix mudou os pagamentos?", "Pix comparado a cartões, TED e boleto, com geografia municipal.", "/observatorio/pix"),
    ],
    paraOSeuCaso: [],
    lacunas: [
      "Indústria e serviços: produção, emprego e investimento por setor.",
      "Produção agrícola por estado e por cadeia.",
    ],
    metodos: [
      { rotulo: "Agronegócio: método", href: "/agronegocio/metodologia" },
      { rotulo: "Glossário do crédito", href: "/glossario" },
    ],
  };
}

/** "2025-T3" ou "2025.3" → "3º tri/2025". */
function trimestre(p: string): string {
  return `${p.slice(-1)}º tri/${p.slice(0, 4)}`;
}

// -------------------------------------------------------- Território e clima

function porta_territorio(): Porta {
  return {
    ...identidade("territorio-e-clima"),
    resumo:
      "Desmatamento medido por satélite, cidades expostas a inundações e municípios com falta de água declarada pelos prestadores, cada dado com o período da sua fonte.",
    numeros: [
      numero(
        {
          rotulo: "Área desmatada na Amazônia Legal",
          unidade: "km²",
          fonte: "INPE, PRODES",
          href: "/agronegocio/ambiente",
        },
        () => {
          const t = lerPublico("agro", "gold", "snapshot.json").economia.ambiente.prodes.taxaAmazoniaLegal as { inicio: number; fim: number; km2: number; estimada: boolean }[];
          const c = t.filter((x) => !x.estimada).at(-1)!;
          const est = t.find((x) => x.estimada && x.inicio === c.fim);
          return {
            valor: num(c.km2, 0),
            periodo: `ago/${c.inicio} a jul/${c.fim}`,
            nota: est ? `Estimativa preliminar de ago/${est.inicio} a jul/${est.fim}: ${num(est.km2, 0)} km², sujeita a revisão.` : undefined,
          };
        },
      ),
      numero(
        {
          rotulo: "Domicílios em área de risco de inundação",
          unidade: "milhões",
          fonte: "Ministério das Cidades, SINISA, drenagem",
          href: "/eficiencia-estatal/meio-ambiente-clima",
          nota: "Declarado pelos municípios que responderam ao módulo de drenagem.",
        },
        () => {
          const s = lerPublico("eficiencia", "saneamento", "snapshot.json");
          const v = (s.valores as any[]).find((x) => x.id === "BR" && x.indicador === "DOM_RISCO");
          return { valor: num(v.valor / 1e6, 2), periodo: String(s.referencia) };
        },
      ),
      numero(
        {
          rotulo: "Municípios com racionamento por falta de água no manancial",
          unidade: "municípios",
          fonte: "Ministério das Cidades, SINISA",
          href: "/saneamento/resiliencia",
        },
        () => {
          const br = (lerPublico("saneamento", "gold", "agregados.json") as any[]).find((x) => x.id === "BR");
          const c = br.continuidade;
          return {
            valor: num(c.motivos_interrupcoes["Baixa disponibilidade do manancial"], 0),
            periodo: "2024",
            nota: `Declarado pelos prestadores de ${num(c.municipios_participantes, 0)} municípios participantes; ${num(c.municipios_com_colapso, 0)} registraram colapso no abastecimento.`,
          };
        },
      ),
    ],
    caminhos: [
      caminho("agro", "Quanto se desmata e quanto se emite?", "Desmatamento por bioma, emissões estimadas e uso da terra.", "/agronegocio/ambiente"),
      caminho("territorio-e-clima", "Onde e quanto o fogo aparece?", "Focos de calor desde 2003, o ano em curso, estados, biomas, municípios e área queimada.", "/territorio/queimadas"),
      caminho("territorio-e-clima", "Quanto o Brasil emite de gases de efeito estufa?", "Inventário oficial de 1990 ao último ano publicado, por setor, com 2005 como referência.", "/territorio/emissoes"),
      caminho("territorio-e-clima", "Onde os desastres atingem os municípios?", "Secas, chuvas e deslizamentos reconhecidos pela União desde 2003, por tipo e estado.", "/territorio/desastres"),
      caminho("eficiencia", "As cidades estão preparadas para chuvas e resíduos?", "Drenagem, risco de inundação, coleta seletiva e destino do lixo.", "/eficiencia-estatal/meio-ambiente-clima"),
      caminho("saneamento", "Onde falta água nas torneiras?", "Interrupções, racionamento e colapso do abastecimento declarados pelos prestadores.", "/saneamento/resiliencia"),
      caminho("energia", "Como o clima afeta a energia?", "Chuvas, vazões e armazenamento das bacias das hidrelétricas.", "/setor-eletrico/agua-e-clima"),
      caminho("energia", "Como a matriz elétrica está mudando?", "Micro e minigeração distribuída no território e intensidade de emissões da geração.", "/setor-eletrico/transicao"),
    ],
    paraOSeuCaso: [],
    lacunas: [
      "Emissões oficiais dos anos mais recentes (o inventário do governo sai a cada dois anos).",
      "Área queimada por estado e por município (o INPE publica a tabela só por bioma).",
      "Emissões oficiais por estado (o inventário nacional não traz recorte por UF).",
      "Desastres reconhecidos no ano em curso (a base consolidada vai até o ano anterior).",
    ],
    metodos: [
      { rotulo: "Agronegócio: método", href: "/agronegocio/metodologia" },
      { rotulo: "Saneamento: método", href: "/saneamento/metodologia" },
      { rotulo: "Território e Clima: método", href: "/territorio/metodologia" },
    ],
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

let cache: Porta[] | null = null;

/**
 * As seis portas, na ordem da home. A home é dinâmica (sessão): a leitura das
 * golds acontece uma vez por instância do servidor, não a cada visita. As
 * golds só mudam com nova publicação, que reinicia as instâncias.
 */
export function portas(): Porta[] {
  cache ??= [porta_familias(), porta_servicos(), porta_dinheiro(), porta_energia(), porta_economia(), porta_territorio()].map(comLeva2);
  return cache;
}

/** Itens aprovados da leva 2 (src/lib/rotasPublicas.ts, LEVA_2) entram depois dos da leva 1; sem aprovação, nada muda. */
function comLeva2(p: Porta): Porta {
  return { ...p, paraOSeuCaso: [...p.paraOSeuCaso, ...consultasLeva2(p.id)], metodos: [...p.metodos, ...metodosLeva2(p.id)] };
}
