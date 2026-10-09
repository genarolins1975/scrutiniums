/**
 * Vocabulário de quem procura sem conhecer a sigla: "preço da luz", "apagão", "gato de energia", "congestionamento". Cada
 * grupo liga alguns desses nomes aos destinos que de fato tratam do assunto; a busca da página inicial os trata como um nome a mais do
 * item, logo abaixo do título (busca.ts), e mostra ao leitor o termo que casou.
 *
 * Regras de manutenção:
 *  - o alvo é o endereço exato de um item do índice (página, painel, pergunta ou verbete); um endereço que o índice não
 *    tem deixa de contar, e o teste acusa, para a busca nunca prometer um destino que não existe;
 *  - o termo é o que o leitor diria, e não o nome técnico (o nome técnico já está no título do item);
 *  - o termo leva ao lugar onde o assunto é tratado, mesmo quando a página explica que não mede o que o termo sugere: quem
 *    procura "congestionamento" chega aos fluxos e às diferenças de preço, onde está escrito que o observatório não classifica
 *    hora congestionada;
 *  - nenhum termo afirma uma causa nem dá o assunto por medido: "apagão" leva às interrupções e aos cortes de carga que o
 *    observatório mostra, e a página diz o que cada um mede.
 */
export type GrupoDeSinonimos = {
  /** Endereços exatos dos itens do índice que respondem ao assunto. */
  alvos: string[];
  /** Como o leitor chama o assunto. */
  termos: string[];
};

const S = "/setor-eletrico";

export const SINONIMOS_BUSCA: readonly GrupoDeSinonimos[] = [
  // conta de luz
  {
    alvos: [`${S}/conta-de-luz`, `${S}/conta-de-luz#tarifa`],
    termos: ["preço da luz", "preço da energia", "preço da conta de luz", "valor da conta de luz", "conta de energia", "fatura de luz", "quanto pago de luz", "tarifa de energia"],
  },
  { alvos: [`${S}/conta-de-luz#simulador`], termos: ["simular a conta", "calcular a conta de luz", "quanto vou pagar de luz"] },
  { alvos: [`${S}/conta-de-luz/reajustes-e-subsidios#p050`, `${S}/aprenda/bandeira-tarifaria`], termos: ["bandeira vermelha", "bandeira amarela", "bandeira verde", "aumento da conta de luz", "reajuste da tarifa"] },
  // qualidade do serviço
  {
    alvos: [`${S}/qualidade`, `${S}/qualidade#p051`],
    termos: ["falta de luz", "falta de energia", "queda de energia", "queda de luz", "luz caiu", "energia caiu", "sem luz", "interrupção de energia", "apagão", "blecaute"],
  },
  { alvos: [`${S}/aprenda/dec`], termos: ["tempo sem energia", "tempo sem luz", "duração das faltas de energia", "horas sem luz"] },
  { alvos: [`${S}/aprenda/fec`], termos: ["quantas vezes falta energia", "quantas vezes falta luz", "frequência das faltas de energia", "número de quedas de energia"] },
  { alvos: [`${S}/qualidade#expurgos`], termos: ["apagão", "blecaute"] },
  { alvos: [`${S}/qualidade#p053`, `${S}/aprenda/compensacao-continuidade`], termos: ["desconto por falta de luz", "crédito na fatura", "ressarcimento por falta de energia"] },
  // perdas
  {
    alvos: [`${S}/perdas`, `${S}/perdas/composicao#painel-composicao`, `${S}/aprenda/perdas-nao-tecnicas`],
    termos: ["furto de energia", "roubo de energia", "gato de energia", "gato", "ligação clandestina", "fraude de energia", "desvio de energia"],
  },
  // água
  {
    alvos: [`${S}/agua-e-clima`, `${S}/agua-e-clima#p017`],
    termos: ["nível dos reservatórios", "nível das represas", "represas", "barragens", "seca", "crise hídrica", "falta de chuva", "água das usinas"],
  },
  // preço de curto prazo
  { alvos: [`${S}/pld`, `${S}/pld#hoje`, `${S}/aprenda/pld`], termos: ["preço da energia", "preço da energia no mercado", "preço spot", "preço no atacado", "preço por hora", "preço horário"] },
  { alvos: [`${S}/pld/modelos`, `${S}/pld/previsoes#p013`], termos: ["previsão do preço da energia", "preço futuro", "quanto vai custar a energia"] },
  // rede
  {
    alvos: [`${S}/rede`, `${S}/rede#p028`, `${S}/pld/diferencas-regionais#p012`],
    termos: ["congestionamento", "congestionamento de linhas", "gargalo na transmissão", "linhas lotadas", "limite de transmissão"],
  },
  { alvos: [`${S}/rede/restricoes#p030`], termos: ["apagão", "blecaute", "corte de carga"] },
  // carga
  { alvos: [`${S}/carga`, `${S}/carga#p025`], termos: ["consumo de energia", "consumo do país", "consumo do Brasil", "demanda de energia"] },
  { alvos: [`${S}/carga/clima-e-calendario#p027`], termos: ["calor e consumo", "temperatura e consumo", "feriado e consumo"] },
  // geração
  { alvos: [`${S}/geracao`], termos: ["fontes de energia", "matriz elétrica", "matriz energética", "energia solar", "energia eólica", "energia hidrelétrica", "usinas"] },
  { alvos: [`${S}/geracao/termica#p022`], termos: ["usina térmica", "térmicas ligadas", "por que ligaram as térmicas"] },
  { alvos: [`${S}/geracao/restricoes#p023`, `${S}/aprenda/constrained-off`], termos: ["curtailment", "geração cortada", "corte de energia solar", "corte de energia eólica"] },
  // transição
  {
    alvos: [`${S}/transicao`, `${S}/transicao/mmgd#p063`, `${S}/aprenda/geracao-distribuida`],
    termos: ["energia solar em casa", "energia solar no telhado", "painel solar", "placas solares", "geração própria", "gerar a própria energia", "geração distribuída"],
  },
  { alvos: [`${S}/transicao/emissoes#p064`, `${S}/aprenda/fator-de-emissao`], termos: ["carbono", "poluição", "gases de efeito estufa", "emissões de carbono"] },
  // inclusão
  { alvos: [`${S}/inclusao-energetica/tarifa-social#p059`, `${S}/aprenda/tarifa-social`], termos: ["desconto na conta de luz", "baixa renda", "famílias de baixa renda"] },
  { alvos: [`${S}/inclusao-energetica/acesso#p062`], termos: ["quem não tem energia elétrica", "sem acesso à luz", "comunidades isoladas"] },
  { alvos: [`${S}/inclusao-energetica/orcamento#p061`], termos: ["peso da conta de luz", "gasto com energia", "conta de luz no orçamento"] },
  // expansão
  { alvos: [`${S}/expansao`, `${S}/expansao/carteira#p040`], termos: ["obras", "usinas em construção", "novas usinas", "usinas novas", "projetos de geração"] },
  { alvos: [`${S}/expansao/cronograma#p041`], termos: ["atraso de obras", "obra atrasada", "prazo das obras"] },
  // empresas
  { alvos: [`${S}/empresas/ativos#p036`], termos: ["dono da usina", "quem é dono da usina", "proprietário da usina"] },
  { alvos: [`${S}/empresas/controle#p039`], termos: ["quem controla as empresas", "dono das distribuidoras"] },
  { alvos: [`${S}/empresas/distribuidoras#p037`], termos: ["minha distribuidora", "empresa que fornece a minha luz", "fornecedora de luz"] },
  { alvos: [`${S}/empresas/financas#p038`], termos: ["lucro das empresas", "balanço das empresas", "resultado financeiro"] },
  // mercado e regulação
  { alvos: [`${S}/mercado`, `${S}/mercado#livre-regulado`, `${S}/mercado/agentes#agentes`], termos: ["migrar para o mercado livre", "mercado livre de energia", "escolher o fornecedor de energia"] },
  { alvos: [`${S}/regulacao/consultas-e-agenda#p046`], termos: ["audiência pública", "consulta da ANEEL"] },
  { alvos: [`${S}/regulacao/linha-do-tempo#p045`], termos: ["mudanças nas regras", "histórico das regras", "decisão da ANEEL"] },
  // território, visão geral, aprenda e dados
  { alvos: [`${S}/territorio`], termos: ["meu estado", "minha cidade", "meu município", "por estado", "por município", "mapa do Brasil"] },
  { alvos: [`${S}/visao-geral`], termos: ["resumo do setor", "situação do sistema", "panorama", "como está o setor elétrico"] },
  { alvos: [`${S}/aprenda`], termos: ["glossário", "dicionário", "o que significa", "significado de sigla", "siglas"] },
  { alvos: [`${S}/dados`, `${S}/dados/reproducao#reproducao`], termos: ["baixar dados", "planilha", "excel", "csv", "download"] },
  { alvos: [`${S}/metodologia`], termos: ["como é calculado", "fórmula", "de onde vêm os números", "fonte dos números"] },
];

const POR_ALVO: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const g of SINONIMOS_BUSCA) {
    for (const alvo of g.alvos) {
      const lista = m.get(alvo) ?? [];
      for (const t of g.termos) if (!lista.includes(t)) lista.push(t);
      m.set(alvo, lista);
    }
  }
  return m;
})();

/** Os nomes alternativos de um endereço do índice, ou lista vazia. */
export function sinonimosDe(href: string): readonly string[] {
  return POR_ALVO.get(href) ?? [];
}
