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
export type ModuloEnergia = {
  slug: string;
  href: string;
  rotulo: string;
  resumo: string;
  integrado: boolean;
  secao: string;
};

export const MODULOS_ENERGIA: ModuloEnergia[] = [
  { slug: "mapa", href: "/setor-eletrico", rotulo: "Mapa", resumo: "Por onde começar: o que cada página responde, com que fonte e até quando.", integrado: true, secao: "energia:mapa" },
  { slug: "visao-geral", href: "/setor-eletrico/visao-geral", rotulo: "Visão geral", resumo: "O sistema elétrico em poucos minutos.", integrado: true, secao: "energia:visao-geral" },
  { slug: "pld", href: "/setor-eletrico/pld", rotulo: "PLD", resumo: "Preço horário por submercado: o que é, de onde vem, o que acontece agora e o estado da previsão.", integrado: true, secao: "energia:pld" },
  { slug: "agua-e-clima", href: "/setor-eletrico/agua-e-clima", rotulo: "Água e clima", resumo: "Energia armazenada e energia que chega aos reservatórios.", integrado: true, secao: "energia:agua-e-clima" },
  { slug: "geracao", href: "/setor-eletrico/geracao", rotulo: "Geração", resumo: "Com que fontes o sistema está atendendo a carga.", integrado: true, secao: "energia:geracao" },
  { slug: "carga", href: "/setor-eletrico/carga", rotulo: "Carga", resumo: "Quanto o sistema está consumindo e como isso se compara.", integrado: true, secao: "energia:carga" },
  { slug: "rede", href: "/setor-eletrico/rede", rotulo: "Rede", resumo: "Fluxos entre regiões e diferenças de preço.", integrado: true, secao: "energia:rede" },
  { slug: "mercado", href: "/setor-eletrico/mercado", rotulo: "Mercado", resumo: "Livre e regulado, agentes e migração, MRE e GSF, encargos e liquidação, com a CCEE, a EPE e a ANEEL.", integrado: true, secao: "energia:mercado" },
  { slug: "empresas", href: "/setor-eletrico/empresas", rotulo: "Empresas", resumo: "Grupos econômicos, companhias, usinas, linhas e concessões.", integrado: true, secao: "energia:empresas" },
  { slug: "expansao", href: "/setor-eletrico/expansao", rotulo: "Expansão", resumo: "Leilões, projetos, capacidade futura e planejamento.", integrado: true, secao: "energia:expansao" },
  { slug: "regulacao", href: "/setor-eletrico/regulacao", rotulo: "Regulação", resumo: "ANEEL, CCEE, ONS e MME com linha do tempo e documentos primários.", integrado: true, secao: "energia:regulacao" },
  { slug: "aprenda", href: "/setor-eletrico/aprenda", rotulo: "Aprenda", resumo: "Base de conhecimento com fonte oficial em cada verbete.", integrado: true, secao: "energia:aprenda" },
  { slug: "dados", href: "/setor-eletrico/dados", rotulo: "Dados", resumo: "Catálogo de datasets, metodologia, qualidade e downloads.", integrado: true, secao: "energia:dados" },
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

/** Campos que um módulo já publicado empresta ao destino, para as duas listas não divergirem. */
function doModulo(slug: string): Pick<DestinoNavegacao, "slug" | "href" | "resumo" | "integrado"> {
  const m = modulo(slug);
  return { slug: m.slug, href: m.href, resumo: m.resumo, integrado: m.integrado };
}

/** A ordem desta lista é a ordem de exibição dentro de cada grupo. */
export const DESTINOS_NAVEGACAO: DestinoNavegacao[] = [
  // 1. Comece aqui
  { ...doModulo("mapa"), rotulo: "Mapa do observatório", grupo: "comece-aqui", publicado: true, pergunta: "Como compreender e explorar o setor usando este observatório?" },
  { ...doModulo("visao-geral"), rotulo: "Visão geral", grupo: "comece-aqui", publicado: true, pergunta: "O que está acontecendo no sistema elétrico?" },
  {
    slug: "territorio",
    href: "/setor-eletrico/territorio",
    rotulo: "Minha região",
    pergunta: "O que acontece na minha região?",
    resumo: "Mapa com submercado, distribuidora, município e usinas, cada número no seu próprio grão e com link para o módulo de origem.",
    grupo: "comece-aqui",
    publicado: true,
    integrado: true,
  },

  // 2. Operação do sistema
  { ...doModulo("agua-e-clima"), rotulo: "Água e clima", grupo: "operacao", publicado: true, pergunta: "Quanta energia está armazenada e como a água e o clima estão evoluindo?" },
  { ...doModulo("geracao"), rotulo: "Geração", grupo: "operacao", publicado: true, pergunta: "De onde vem a eletricidade e quais fontes estão sendo usadas?" },
  { ...doModulo("carga"), rotulo: "Carga", grupo: "operacao", publicado: true, pergunta: "Quanto e quando o sistema demanda energia?" },
  { ...doModulo("rede"), rotulo: "Rede", grupo: "operacao", publicado: true, pergunta: "Como a energia circula entre regiões e que restrições são documentadas?" },

  // 3. Preços e mercado
  { ...doModulo("pld"), rotulo: "Preço de curto prazo (PLD)", grupo: "precos-e-mercado", publicado: true, pergunta: "Como funciona e como varia o preço de curto prazo?" },
  {
    slug: "pld-modelos",
    href: "/setor-eletrico/pld/modelos",
    rotulo: "Previsões e modelos",
    pergunta: "O que se projeta para o PLD e como a previsão tem se saído?",
    resumo: "Registro dos modelos de previsão do PLD com o estado de cada um e o arquivo imutável das emissões; sem modelo em produção, a previsão oficial fica indisponível, com o motivo.",
    grupo: "precos-e-mercado",
    publicado: true,
    integrado: true,
  },
  { ...doModulo("mercado"), rotulo: "Mercado", grupo: "precos-e-mercado", publicado: true, pergunta: "Como a energia é contratada, alocada e liquidada?" },

  // 4. Consumidor e território
  {
    slug: "conta-de-luz",
    href: "/setor-eletrico/conta-de-luz",
    rotulo: "Conta de luz",
    pergunta: "Quanto custa a energia ao consumidor e o que compõe a conta?",
    resumo: "Tarifas de aplicação por distribuidora, componentes da conta, bandeiras e simulação por perfil de consumo.",
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "perdas",
    href: "/setor-eletrico/perdas",
    rotulo: "Perdas de energia",
    pergunta: "Onde se perde energia, quanto e com que efeito econômico?",
    resumo: "Perdas técnicas e não técnicas por distribuidora, o realizado diante da referência regulatória e o custo que chega à tarifa.",
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "qualidade",
    href: "/setor-eletrico/qualidade",
    rotulo: "Qualidade do serviço",
    pergunta: "Com que frequência e por quanto tempo falta energia?",
    resumo: "Duração e frequência das interrupções por distribuidora, limites regulatórios e compensações publicadas.",
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },
  {
    slug: "inclusao-energetica",
    href: "/setor-eletrico/inclusao-energetica",
    rotulo: "Inclusão energética",
    pergunta: "Quem tem acesso adequado e para quem a energia pesa mais?",
    resumo: "Tarifa Social, universalização do acesso, sistemas isolados e o peso da energia no orçamento das famílias.",
    grupo: "consumidor-e-territorio",
    publicado: true,
    integrado: true,
  },

  // 5. Empresas e futuro
  { ...doModulo("empresas"), rotulo: "Empresas", grupo: "empresas-e-futuro", publicado: true, pergunta: "Quem participa do setor e como atua?" },
  { ...doModulo("expansao"), rotulo: "Expansão", grupo: "empresas-e-futuro", publicado: true, pergunta: "O que está sendo construído e quando pode entrar?" },
  {
    slug: "transicao",
    href: "/setor-eletrico/transicao",
    rotulo: "Transição e ambiente",
    pergunta: "Como a transformação do setor se distribui e afeta as emissões?",
    resumo: "Micro e minigeração distribuída no território e intensidade de emissões da geração, com fonte e natureza declaradas.",
    grupo: "empresas-e-futuro",
    publicado: true,
    integrado: true,
  },

  // 6. Conhecimento e evidência
  { ...doModulo("regulacao"), rotulo: "Regulação", grupo: "conhecimento-e-evidencia", publicado: true, pergunta: "Quais regras mudaram e desde quando valem?" },
  { ...doModulo("aprenda"), rotulo: "Aprenda", grupo: "conhecimento-e-evidencia", publicado: true, pergunta: "O que significam os conceitos e como se ligam aos números?" },
  { ...doModulo("dados"), rotulo: "Dados", grupo: "conhecimento-e-evidencia", publicado: true, pergunta: "De onde vêm os números e como reutilizá-los?" },
  {
    slug: "metodologia",
    href: "/setor-eletrico/metodologia",
    rotulo: "Metodologia",
    pergunta: "Como calculamos e quais são os limites da análise?",
    resumo: "Natureza de cada dado, unidades, linhagem das séries, regras de classificação, governança da previsão e limitações.",
    grupo: "conhecimento-e-evidencia",
    publicado: true,
    integrado: true,
  },
];

const DEFINICAO_GRUPOS: Omit<GrupoNavegacao, "destinos">[] = [
  { id: "comece-aqui", n: 1, rotulo: "Comece aqui", resumo: "Por onde começar e o que está acontecendo agora." },
  { id: "operacao", n: 2, rotulo: "Operação do sistema", resumo: "A água, a geração, o consumo e a rede que liga as regiões." },
  { id: "precos-e-mercado", n: 3, rotulo: "Preços e mercado", resumo: "O preço de curto prazo, as previsões e como a energia é contratada." },
  { id: "consumidor-e-territorio", n: 4, rotulo: "Consumidor e território", resumo: "O que chega a quem usa a energia: a conta, as perdas, a qualidade do serviço e o acesso." },
  { id: "empresas-e-futuro", n: 5, rotulo: "Empresas e futuro", resumo: "Quem atua no setor, o que está sendo construído e a transição." },
  { id: "conhecimento-e-evidencia", n: 6, rotulo: "Conhecimento e evidência", resumo: "As regras, os conceitos, os dados e os métodos por trás de cada número." },
];

export const GRUPOS_NAVEGACAO: GrupoNavegacao[] = DEFINICAO_GRUPOS.map((g) => ({
  ...g,
  destinos: DESTINOS_NAVEGACAO.filter((d) => d.grupo === g.id),
}));

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

/** "a", "a e b", "a, b e c": enumeração em português sem depender do ICU do ambiente. */
export function listaPorExtenso(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
