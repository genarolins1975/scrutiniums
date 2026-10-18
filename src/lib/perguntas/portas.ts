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
import { donoDaRota, observatorio, type ObservatorioId } from "@/lib/observatorios/registro";
import contasFederais from "@/lib/contas-publicas/snapshots/dados.json";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import type { CaminhoPorta, Porta } from "./tipos";
import { comSinal, dataBr, lerPublico, mesAno, num, numero } from "./leitura";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
/** Destino com o domínio de origem e a coleção do registro a que pertence. */
function caminho(obs: DominioId, pergunta: string, resumo: string, href: string): CaminhoPorta {
  const dono = donoDaRota(href);
  const colecao = dono ? observatorio(dono.observatorio).colecoes.find((c) => c.id === dono.colecao)?.nome : undefined;
  return { pergunta, resumo, href, observatorio: dominio(obs).nomeCurto, colecao: colecao ?? dominio(obs).nomeCurto };
}

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
    numeros: [
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
      ),
    ],
    caminhos: [
      caminho("eficiencia", "Quanto as famílias ganham com o trabalho?", "Rendimento, ocupação, emprego formal e Cadastro Único nos recortes de cada fonte.", "/eficiencia-estatal/trabalho-renda"),
      caminho("credito", "Os aposentados estão mais endividados?", "Crédito consignado por idade, benefício e instituição.", "/observatorio/payroll-lending-aging"),
      caminho("credito", "As apostas online pesam no crédito das famílias?", "Apostas, endividamento e inadimplência, com o grau de evidência de cada número.", "/observatorio/bets-financial-risk"),
      caminho("credito", "Quantos golpes financeiros acontecem?", "Golpes e fraudes registrados, por tipo e canal, com fonte primária.", "/observatorio/financial-fraud"),
      caminho("eficiencia", "Falta moradia ou falta moradia adequada?", "Déficit habitacional, peso do aluguel na renda e inadequação dos domicílios.", "/eficiencia-estatal/habitacao"),
      caminho("agro", "Por que a comida subiu?", "Inflação de alimentos, itens da cesta e segurança alimentar dos domicílios.", "/agronegocio/prato"),
    ],
    lacunas: [
      "Inflação de todos os itens do orçamento, por região metropolitana.",
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
      "Recursos, atendimento e resultados dos serviços públicos, com a mesma régua para cada capital e o volume e o tempo dos processos na Justiça, cada medida com o universo da sua fonte.",
    numeros: [
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
      ),
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
      ),
    ],
    caminhos: [
      caminho("eficiencia", "Como estão as escolas municipais das capitais?", "Despesa por matrícula, alunos por turma, aprovação, Ideb e Saeb nas 26 capitais.", "/eficiencia-estatal/educacao-municipal-capitais"),
      caminho("eficiencia", "A atenção primária à saúde alcança a população?", "Despesa, unidades básicas, equipes e internações evitáveis nas capitais.", "/eficiencia-estatal/saude-capitais"),
      caminho("eficiencia", "Quanto tempo a Justiça leva?", "Despesas, filas e tempos em 57 tribunais, sem nota própria de eficiência.", "/eficiencia-estatal/judiciario"),
      caminho("eficiencia", "A Justiça é acessível a quem precisa?", "Cobertura das defensorias, tempo de resposta e conciliação.", "/eficiencia-estatal/acesso-justica"),
      caminho("eficiencia", "Que violência é registrada no país?", "Indicadores nacionais de violência, crimes patrimoniais, desaparecimentos e recursos por esfera de governo.", "/eficiencia-estatal/seguranca-publica"),
      caminho("eficiencia", "Como as capitais se comparam nos serviços?", "Duas capitais lado a lado em educação, saúde, renda e mobilidade, com a mesma régua.", "/eficiencia-estatal"),
    ],
    lacunas: [
      "Filas e tempo de espera no SUS.",
      "Educação e saúde nos municípios que não são capitais.",
      "Violência comparável entre estados, em taxa por habitante.",
    ],
    metodos: [
      { rotulo: "Educação: métodos", href: "/eficiencia-estatal/educacao-municipal-capitais/metodos" },
      { rotulo: "Saúde: métodos", href: "/eficiencia-estatal/saude-capitais/metodos" },
    ],
  };
}

// --------------------------------------------------------- Dinheiro público

function porta_dinheiro(): Porta {
  const rtn = contasFederais.rtnAnual as { periodo: string; despesa: number; previdencia: number; resultado: number }[];
  const anoCompleto = () => rtn.filter((r) => /^\d{4}$/.test(r.periodo)).reduce((a, b) => (b.periodo > a.periodo ? b : a));
  return {
    ...identidade("contas-publicas"),
    resumo:
      "Receitas e despesas do governo federal, o resultado das contas e a dívida dos estados, com valores nominais e o período de cada demonstrativo.",
    numeros: [
      numero(
        {
          rotulo: "Parte da despesa primária federal que vai para benefícios da Previdência",
          unidade: "a cada R$ 100",
          fonte: "Tesouro Nacional, Resultado do Tesouro Nacional",
          href: "/contas-publicas/panorama",
          nota: "Calculado: benefícios previdenciários sobre a despesa primária total do governo central. Não inclui juros da dívida.",
        },
        () => {
          const r = anoCompleto();
          return { valor: `R$ ${num((100 * r.previdencia) / r.despesa, 2)}`, periodo: r.periodo };
        },
      ),
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
      ),
    ],
    caminhos: [
      caminho("contas", "O governo fechou as contas no azul ou no vermelho?", "Receitas, despesas e resultado primário do governo central desde 1997.", "/contas-publicas/panorama"),
      caminho("contas", "Quanto do orçamento foi efetivamente pago?", "Da autorização ao pagamento, com juros e refinanciamento da dívida separados.", "/contas-publicas/execucao"),
      caminho("contas", "Quanto custa cada área do governo?", "Custos da União por área, do relatório de custos do Tesouro.", "/contas-publicas/custos"),
      caminho("contas", "O que ficou para pagar no ano seguinte?", "Restos a pagar inscritos, pagos e cancelados.", "/contas-publicas/restos-a-pagar"),
      caminho("estados", "Como está a dívida do meu estado?", "Execução, receitas, despesas e dívida das 27 unidades da Federação lado a lado.", "/contas-publicas-estaduais"),
      caminho("credito", "Quem deve à União?", "Dívida ativa da União inscrita na Procuradoria da Fazenda, por tipo de devedor.", "/observatorio/federal-tax-debt"),
    ],
    lacunas: [
      "Despesa federal por área (saúde, educação, previdência) no orçamento executado.",
      "Previdência e INSS em detalhe: benefícios, quem recebe e o resultado do sistema.",
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
      "Eletricidade, gás, água e esgoto e transporte: oferta, preço regulado e acesso, a partir dos dados abertos do ONS, da ANEEL, da ANP, do IBGE e do SINISA.",
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
      caminho("energia", "Por que a conta de luz muda?", "Tarifas por distribuidora e o que cada parcela remunera.", "/setor-eletrico/conta-de-luz"),
      caminho("gas", "Quanto gás o Brasil produz e importa?", "Produção por estado, gás reinjetado e queimado, importação por origem.", "/gas-natural/producao"),
      caminho("saneamento", "Quem está sem água e esgoto no meu município?", "Ficha de cada um dos 5.570 municípios, com prestador, regulador e comparação com o estado.", "/saneamento/municipio"),
      caminho("eficiencia", "Como as pessoas se deslocam nas cidades?", "Oferta e uso do transporte público nos recortes disponíveis.", "/eficiencia-estatal/mobilidade-transporte"),
    ],
    lacunas: [
      "Valor final da conta de luz com tributos e bandeira tarifária.",
      "Preço da gasolina e do diesel nos postos.",
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
      caminho("eficiencia", "As cidades estão preparadas para chuvas e resíduos?", "Drenagem, risco de inundação, coleta seletiva e destino do lixo.", "/eficiencia-estatal/meio-ambiente-clima"),
      caminho("saneamento", "Onde falta água nas torneiras?", "Interrupções, racionamento e colapso do abastecimento declarados pelos prestadores.", "/saneamento/resiliencia"),
      caminho("energia", "Como o clima afeta a energia?", "Chuvas, vazões e armazenamento das bacias das hidrelétricas.", "/setor-eletrico/agua-e-clima"),
      caminho("energia", "Como a matriz elétrica está mudando?", "Micro e minigeração distribuída no território e intensidade de emissões da geração.", "/setor-eletrico/transicao"),
    ],
    lacunas: [
      "Emissões pelo inventário oficial do governo (as disponíveis são estimativas da sociedade civil).",
      "Queimadas e focos de calor por município.",
      "Desastres e pessoas afetadas registrados pela Defesa Civil.",
    ],
    metodos: [
      { rotulo: "Agronegócio: método", href: "/agronegocio/metodologia" },
      { rotulo: "Saneamento: método", href: "/saneamento/metodologia" },
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
  cache ??= [porta_familias(), porta_servicos(), porta_dinheiro(), porta_energia(), porta_economia(), porta_territorio()];
  return cache;
}
