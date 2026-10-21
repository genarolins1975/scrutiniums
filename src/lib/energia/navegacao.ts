/**
 * Navegação do Observatório Brasileiro do Setor Elétrico.
 *
 * Duas listas, com papéis diferentes:
 *
 *  - `MODULOS_ENERGIA`: os módulos já publicados, na forma que o mapa, o sitemap
 *    e os testes de página leem desde o início. `integrado` indica se o módulo já
 *    publica dados; módulos em integração mostram escopo, perguntas e datasets
 *    catalogados, sem número.
 *  - `GRUPOS_NAVEGACAO`: os seis grupos da navegação principal (seção 5.1 da
 *    especificação), cada um com os seus destinos. Agrupar reduz a carga de
 *    escolha sem esconder os temas sociais: conta de luz, perdas, qualidade e
 *    inclusão têm grupo próprio e ficam a um clique no menu assim que publicados.
 *
 * Cada destino declara a pergunta central que responde (quadro da seção 6.2 C) e
 * `publicado`, que diz se a rota já existe no app. Destino não publicado nunca
 * vira link: o cabeçalho o mostra só como "em preparação", e o teste
 * `energia-comp-navegacao` confere, nos dois sentidos, que `publicado` concorda
 * com a existência do `page.tsx`.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia, tx } from "./idioma";

export type ModuloEnergia = {
  slug: string;
  href: string;
  rotulo: string;
  resumo: string;
  integrado: boolean;
  secao: string;
};

/**
 * Os textos (rotulo, resumo, pergunta) são getters: seguem o idioma da página no momento da leitura (tx), e o português continua
 * idêntico. Quem copia um destino com spread no topo do módulo congela o idioma; por isso as listas abaixo não usam spread.
 */
export const MODULOS_ENERGIA: ModuloEnergia[] = [
  {
    slug: "mapa",
    href: "/setor-eletrico",
    get rotulo() { return tx("Início", "Home"); },
    get resumo() { return tx("Por onde começar: o que cada página responde, com que fonte e até quando.", "Where to start: what each page answers, from which source and up to when."); },
    integrado: true,
    secao: "energia:mapa",
  },
  {
    slug: "visao-geral",
    href: "/setor-eletrico/visao-geral",
    get rotulo() { return tx("Visão geral", "Overview"); },
    get resumo() { return tx("O sistema elétrico em poucos minutos.", "The power system in a few minutes."); },
    integrado: true,
    secao: "energia:visao-geral",
  },
  {
    slug: "pld",
    href: "/setor-eletrico/pld",
    get rotulo() { return tx("PLD", "PLD"); },
    get resumo() { return tx("Preço horário por submercado: o que é, de onde vem, o que mostram os últimos dias e o estado da previsão.", "Hourly price by submarket: what it is, where it comes from, what the last days show and the state of the forecast."); },
    integrado: true,
    secao: "energia:pld",
  },
  {
    slug: "agua-e-clima",
    href: "/setor-eletrico/agua-e-clima",
    get rotulo() { return tx("Água e clima", "Water and climate"); },
    get resumo() { return tx("Energia armazenada e energia que chega aos reservatórios.", "Stored energy and the energy flowing into the reservoirs."); },
    integrado: true,
    secao: "energia:agua-e-clima",
  },
  {
    slug: "geracao",
    href: "/setor-eletrico/geracao",
    get rotulo() { return tx("Geração", "Generation"); },
    get resumo() { return tx("Com que fontes o sistema está atendendo a carga.", "Which sources the system is using to meet the load."); },
    integrado: true,
    secao: "energia:geracao",
  },
  {
    slug: "carga",
    href: "/setor-eletrico/carga",
    get rotulo() { return tx("Carga", "Load"); },
    get resumo() { return tx("Quanto o sistema está consumindo e como isso se compara.", "How much the system is consuming and how that compares."); },
    integrado: true,
    secao: "energia:carga",
  },
  {
    slug: "rede",
    href: "/setor-eletrico/rede",
    get rotulo() { return tx("Rede", "Grid"); },
    get resumo() { return tx("Fluxos entre regiões e diferenças de preço.", "Flows between regions and price differences."); },
    integrado: true,
    secao: "energia:rede",
  },
  {
    slug: "mercado",
    href: "/setor-eletrico/mercado",
    get rotulo() { return tx("Mercado", "Market"); },
    get resumo() { return tx("Livre e regulado, agentes e migração, MRE e GSF, encargos e liquidação, com a CCEE, a EPE e a ANEEL.", "Free and regulated markets, agents and migration, MRE and GSF, charges and settlement, with CCEE, EPE and ANEEL."); },
    integrado: true,
    secao: "energia:mercado",
  },
  {
    slug: "leiloes",
    href: "/setor-eletrico/leiloes",
    get rotulo() { return tx("Leilões", "Auctions"); },
    get resumo() { return tx("Leilões de geração do ACR e de transmissão: energia contratada, preço, deságio, vencedores e o que já opera.", "Generation auctions in the ACR and transmission auctions: contracted energy, price, discount, winners and what is already operating."); },
    integrado: true,
    secao: "energia:leiloes",
  },
  {
    slug: "empresas",
    href: "/setor-eletrico/empresas",
    get rotulo() { return tx("Empresas", "Companies"); },
    get resumo() { return tx("Grupos econômicos, companhias, usinas, linhas e concessões.", "Economic groups, companies, plants, lines and concessions."); },
    integrado: true,
    secao: "energia:empresas",
  },
  {
    slug: "expansao",
    href: "/setor-eletrico/expansao",
    get rotulo() { return tx("Expansão", "Expansion"); },
    get resumo() { return tx("Leilões, projetos, capacidade futura e planejamento.", "Auctions, projects, future capacity and planning."); },
    integrado: true,
    secao: "energia:expansao",
  },
  {
    slug: "regulacao",
    href: "/setor-eletrico/regulacao",
    get rotulo() { return tx("Regulação", "Regulation"); },
    get resumo() { return tx("ANEEL, MME, Congresso e Presidência, com linha do tempo e documentos primários.", "ANEEL, MME, Congress and the Presidency, with a timeline and primary documents."); },
    integrado: true,
    secao: "energia:regulacao",
  },
  {
    slug: "aprenda",
    href: "/setor-eletrico/aprenda",
    get rotulo() { return tx("Aprenda", "Learn"); },
    get resumo() { return tx("Base de conhecimento com fonte oficial em cada verbete.", "Knowledge base with an official source in every entry."); },
    integrado: true,
    secao: "energia:aprenda",
  },
  {
    slug: "dados", // i18n: dado
    href: "/setor-eletrico/dados",
    get rotulo() { return tx("Dados", "Data"); },
    get resumo() { return tx("Catálogo de datasets, metodologia, qualidade e downloads.", "Dataset catalog, methodology, quality and downloads."); },
    integrado: true,
    secao: "energia:dados",
  },
];

export function modulo(slug: string): ModuloEnergia {
  const m = MODULOS_ENERGIA.find((x) => x.slug === slug);
  if (!m) throw new Error(`módulo desconhecido: ${slug}`);
  return m;
}

// ---------------------------------------------------------------------------
// Navegação em seis grupos (seção 5.1)
// ---------------------------------------------------------------------------

export type IdGrupo =
  | "comece-aqui"
  | "operacao"
  | "precos-e-mercado"
  | "consumidor-e-territorio"
  | "empresas-e-futuro"
  | "conhecimento-e-evidencia";

export type DestinoNavegacao = {
  slug: string;
  href: string;
  /** Nome em linguagem simples: o visitante não precisa conhecer a sigla. */
  rotulo: string;
  /** Pergunta central que a página responde (quadro da seção 6.2 C). */
  pergunta: string;
  resumo: string;
  grupo: IdGrupo;
  /** A rota já existe no app. Falso: aparece só como "em preparação", nunca como link. */
  publicado: boolean;
  /** Já publica números. Falso: página de escopo e fontes catalogadas, sem número. */
  integrado: boolean;
};

export type GrupoNavegacao = {
  id: IdGrupo;
  n: number;
  rotulo: string;
  resumo: string;
  destinos: DestinoNavegacao[];
};

/**
 * Destino de um módulo já publicado: slug, endereço, resumo e estado vêm do módulo, para as duas listas não divergirem. O resumo
 * é lido do módulo a cada acesso (getter), e não copiado, para seguir o idioma da página.
 */
function doModulo(slug: string, d: Omit<DestinoNavegacao, "slug" | "href" | "resumo" | "integrado">): DestinoNavegacao {
  const m = modulo(slug);
  return Object.defineProperties(d, {
    slug: { value: m.slug, enumerable: true },
    href: { value: m.href, enumerable: true },
    resumo: { get: () => m.resumo, enumerable: true },
    integrado: { value: m.integrado, enumerable: true },
  }) as DestinoNavegacao;
}

/** A ordem desta lista é a ordem de exibição dentro de cada grupo. */
export const DESTINOS_NAVEGACAO: DestinoNavegacao[] = [
  // 1. Comece aqui
  doModulo("mapa", {
    get rotulo() { return tx("Início", "Home"); },
    grupo: "comece-aqui",
    publicado: true,
    get pergunta() { return tx("Como compreender e explorar o setor usando este observatório?", "How can this observatory help you understand and explore the sector?"); },
  }),
  doModulo("visao-geral", {
    get rotulo() { return tx("Visão geral", "Overview"); },
    grupo: "comece-aqui",
    publicado: true,
    get pergunta() { return tx("O que está acontecendo no sistema elétrico brasileiro?", "What is happening in the Brazilian power system?"); },
  }),
  {
    slug: "territorio",
    href: "/setor-eletrico/territorio",
    get rotulo() { return tx("Minha região", "My region"); },
    get pergunta() { return tx("O que acontece na minha região?", "What is happening in my region?"); },
    get resumo() { return tx("Mapa com submercado, distribuidora, município e usinas, cada número no seu próprio grão e com link para o módulo de origem.", "Map with submarket, distribution utility, municipality and plants, each number at its own level of detail and linked to its source module."); },
    grupo: "comece-aqui",
    publicado: true,
    integrado: true,
  },

  // 2. Operação do sistema
  doModulo("agua-e-clima", {
    get rotulo() { return tx("Água e clima", "Water and climate"); },
    grupo: "operacao",
    publicado: true,
    get pergunta() { return tx("Quanta energia está armazenada?", "How much energy is stored?"); },
  }),
  doModulo("geracao", {
    get rotulo() { return tx("Geração", "Generation"); },
    grupo: "operacao",
    publicado: true,
    get pergunta() { return tx("De onde vem a eletricidade?", "Where does the electricity come from?"); },
  }),
  // seção do módulo Geração com destino próprio no menu (pedido do dono de 20/10/2026: a página ficava oculta,
  // alcançável só por um link no painel de restrições, pelo mapa e pela busca)
  {
    slug: "curtailment",
    href: "/setor-eletrico/geracao/curtailment",
    get rotulo() { return tx("Curtailment", "Curtailment"); },
    get pergunta() { return tx("Por que eólicas e solares são cortadas e quem perde?", "Why are wind and solar plants cut, and who loses?"); },
    get resumo() { return tx("O que é o corte de geração renovável, por que acontece, quanto custa e para quem, com laboratórios interativos identificados como modelo didático.", "What renewable curtailment is, why it happens, how much it costs and to whom, with interactive labs labelled as didactic models."); },
    grupo: "operacao",
    publicado: true,
    integrado: true,
  },
  doModulo("carga", {
    get rotulo() { return tx("Carga", "Load"); },
    grupo: "operacao",
    publicado: true,
    get pergunta() { return tx("Quanto o sistema está consumindo?", "How much is the system consuming?"); },
  }),
  doModulo("rede", {
    get rotulo() { return tx("Rede", "Grid"); },
    grupo: "operacao",
    publicado: true,
    get pergunta() { return tx("Como a energia circula entre regiões?", "How does energy flow between regions?"); },
  }),

  // 3. Preços e mercado
  doModulo("pld", {
    get rotulo() { return tx("Preço de curto prazo (PLD)", "Spot price (PLD)"); },
    grupo: "precos-e-mercado",
    publicado: true,
    get pergunta() { return tx("Quanto custa a energia no curto prazo?", "How much does energy cost in the short term?"); },
  }),
  {
    slug: "pld-modelos",
    href: "/setor-eletrico/pld/modelos",
    get rotulo() { return tx("Previsões e modelos", "Forecasts and models"); },
    get pergunta() { return tx("O que os modelos conseguem prever?", "What can the models forecast?"); },
    get resumo() { return tx("Registro dos modelos de previsão do PLD com o estado de cada um e o arquivo imutável das emissões; sem modelo em produção, a previsão oficial fica indisponível, com o motivo.", "Register of the PLD forecasting models with the status of each one and the immutable archive of issued forecasts; with no model in production, the official forecast is unavailable, with the reason."); },
    grupo: "precos-e-mercado",
    publicado: true,
    integrado: true,
  },
  doModulo("mercado", {
    get rotulo() { return tx("Mercado", "Market"); },
    grupo: "precos-e-mercado",
    publicado: true,
    get pergunta() { return tx("Como a energia é contratada, alocada e liquidada?", "How is energy contracted, allocated and settled?"); },
  }),
  doModulo("leiloes", {
    get rotulo() { return tx("Leilões", "Auctions"); },
    grupo: "precos-e-mercado",
    publicado: true,
    get pergunta() { return tx("O que os leilões contrataram, a que preço e de quem?", "What did the auctions contract, at what price and from whom?"); },
  }),

  // 4. Consumidor e território
  {
    slug: "conta-de-luz",
    href: "/setor-eletrico/conta-de-luz",
    get rotulo() { return tx("Conta de luz", "Electricity bill"); },
    get pergunta() { return tx("Quanto custa o mesmo consumo?", "How much does the same consumption cost?"); },
    get resumo() { return tx("Tarifas de aplicação por distribuidora, componentes da conta, bandeiras e simulação por perfil de consumo.", "Applicable tariffs by distribution utility, bill components, tariff flags and a simulation by consumption profile."); },
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "perdas",
    href: "/setor-eletrico/perdas",
    get rotulo() { return tx("Perdas de energia", "Energy losses"); },
    get pergunta() { return tx("Onde a energia se perde?", "Where is energy lost?"); },
    get resumo() { return tx("Perdas técnicas e não técnicas por distribuidora, o percentual técnico regulatório e o custo que chega à tarifa.", "Technical and non-technical losses by distribution utility, the regulatory technical percentage and the cost passed on to the tariff."); },
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "qualidade",
    href: "/setor-eletrico/qualidade",
    get rotulo() { return tx("Qualidade do serviço", "Quality of supply"); },
    get pergunta() { return tx("Quanto tempo e quantas vezes falta luz?", "How long and how often does the power go out?"); },
    get resumo() { return tx("Duração e frequência das interrupções por distribuidora, limites regulatórios e compensações publicadas.", "Duration and frequency of interruptions by distribution utility, regulatory limits and published compensation payments."); },
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "inclusao-energetica",
    href: "/setor-eletrico/inclusao-energetica",
    get rotulo() { return tx("Inclusão energética", "Energy inclusion"); },
    get pergunta() { return tx("Para quem a energia pesa mais?", "For whom does energy weigh the most?"); },
    get resumo() { return tx("Tarifa Social, universalização do acesso, sistemas isolados e o peso da energia no orçamento das famílias.", "Tarifa Social (social electricity tariff), universal access, isolated systems and the weight of energy in household budgets."); },
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },

  // 5. Empresas e futuro
  doModulo("empresas", {
    get rotulo() { return tx("Empresas", "Companies"); },
    grupo: "empresas-e-futuro",
    publicado: true,
    get pergunta() { return tx("Quem atua no setor elétrico?", "Who operates in the power sector?"); },
  }),
  doModulo("expansao", {
    get rotulo() { return tx("Expansão", "Expansion"); },
    grupo: "empresas-e-futuro",
    publicado: true,
    get pergunta() { return tx("O que está sendo construído?", "What is being built?"); },
  }),
  {
    slug: "transicao",
    href: "/setor-eletrico/transicao",
    get rotulo() { return tx("Transição e ambiente", "Transition and environment"); },
    get pergunta() { return tx("Como a matriz está mudando?", "How is the energy mix changing?"); },
    get resumo() { return tx("Micro e minigeração distribuída no território e intensidade de emissões da geração, com fonte e natureza declaradas.", "Distributed micro and mini generation (MMGD) across the territory and the emissions intensity of generation, with source and nature of the data declared."); },
    grupo: "empresas-e-futuro",
    publicado: true,
    integrado: true,
  },

  // 6. Conhecimento e evidência
  doModulo("regulacao", {
    get rotulo() { return tx("Regulação", "Regulation"); },
    grupo: "conhecimento-e-evidencia",
    publicado: true,
    get pergunta() { return tx("Que regra vale em cada período?", "Which rule applies in each period?"); },
  }),
  doModulo("aprenda", {
    get rotulo() { return tx("Aprenda", "Learn"); },
    grupo: "conhecimento-e-evidencia",
    publicado: true,
    get pergunta() { return tx("O que cada conceito significa e onde aparece?", "What does each concept mean and where does it appear?"); },
  }),
  doModulo("dados", { // i18n: dado
    get rotulo() { return tx("Dados", "Data"); },
    grupo: "conhecimento-e-evidencia",
    publicado: true,
    get pergunta() { return tx("De onde vêm os números e como reutilizá-los?", "Where do the numbers come from and how can they be reused?"); },
  }),
  {
    slug: "metodologia",
    href: "/setor-eletrico/metodologia",
    get rotulo() { return tx("Metodologia", "Methodology"); },
    get pergunta() { return tx("Como calculamos e quais são os limites da análise?", "How do we calculate and what are the limits of the analysis?"); },
    get resumo() { return tx("Natureza de cada dado, unidades, linhagem das séries, regras de classificação, governança da previsão e limitações.", "Nature of each data point, units, series lineage, classification rules, forecast governance and limitations."); },
    grupo: "conhecimento-e-evidencia",
    publicado: true,
    integrado: true,
  },
];

/** Um dos seis grupos; os destinos são lidos de DESTINOS_NAVEGACAO na ordem dela, e os textos seguem o idioma da página. */
function grupo(id: IdGrupo, n: number, rotulo: () => string, resumo: () => string): GrupoNavegacao {
  return {
    id,
    n,
    get rotulo() { return rotulo(); },
    get resumo() { return resumo(); },
    destinos: DESTINOS_NAVEGACAO.filter((d) => d.grupo === id),
  };
}

export const GRUPOS_NAVEGACAO: GrupoNavegacao[] = [
  grupo("comece-aqui", 1, () => tx("Comece aqui", "Start here"), () => tx("Por onde começar e o que os dados mostram nos últimos dias.", "Where to start and what the data show over the last few days.")),
  grupo("operacao", 2, () => tx("Operação do sistema", "System operation"), () => tx("A água, a geração, o consumo e a rede que liga as regiões.", "Water, generation, consumption and the grid that links the regions.")),
  grupo("precos-e-mercado", 3, () => tx("Preços e mercado", "Prices and market"), () => tx("O preço de curto prazo, as previsões, como a energia é contratada e o que os leilões compraram.", "The spot price, the forecasts, how energy is contracted and what the auctions bought.")),
  grupo("consumidor-e-territorio", 4, () => tx("Consumidor e território", "Consumers and territory"), () => tx("O que chega a quem usa a energia: a conta, as perdas, a qualidade do serviço e o acesso.", "What reaches the people who use energy: the bill, losses, quality of supply and access.")),
  grupo("empresas-e-futuro", 5, () => tx("Empresas e futuro", "Companies and the future"), () => tx("Quem atua no setor, o que está sendo construído e a transição.", "Who operates in the sector, what is being built and the transition.")),
  grupo("conhecimento-e-evidencia", 6, () => tx("Conhecimento e evidência", "Knowledge and evidence"), () => tx("As regras, os conceitos, os dados e os métodos por trás de cada número.", "The rules, concepts, data and methods behind each number.")),
];

export function destino(slug: string): DestinoNavegacao {
  const d = DESTINOS_NAVEGACAO.find((x) => x.slug === slug);
  if (!d) throw new Error(`destino desconhecido: ${slug}`);
  return d;
}

/** Um grupo como o cabeçalho o desenha. */
export type ItemMenu = {
  grupo: GrupoNavegacao;
  /** Destinos com página: viram link. */
  links: DestinoNavegacao[];
  /** Destinos sem página: só texto "em preparação", nunca link. */
  emPreparacao: DestinoNavegacao[];
  /** O grupo contém a página atual. */
  ativo: boolean;
};

/**
 * Estrutura do menu para a página `atual` (slug do destino; as páginas de
 * previsão e de modelos passam "pld" e ficam no grupo de preços). Pura, para
 * ser testada sem renderizar: o cabeçalho só desenha o que ela devolve.
 */
export function menuNavegacao(atual: string, grupos: GrupoNavegacao[] = GRUPOS_NAVEGACAO): { itens: ItemMenu[]; grupoAtual: ItemMenu | null } {
  const itens = grupos.map((g) => ({
    grupo: g,
    links: g.destinos.filter((d) => d.publicado),
    emPreparacao: g.destinos.filter((d) => !d.publicado),
    ativo: g.destinos.some((d) => d.slug === atual),
  }));
  return { itens, grupoAtual: itens.find((i) => i.ativo) ?? null };
}

/** "a", "a e b", "a, b e c" ("a, b and c" em inglês): enumeração no idioma da página sem depender do ICU do ambiente. */
export function listaPorExtenso(itens: string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}
