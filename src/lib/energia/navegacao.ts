/**
 * Navegação do Observatório Brasileiro do Setor Elétrico. `integrado` indica se
 * o módulo já publica dados; módulos em integração mostram escopo, perguntas e
 * datasets catalogados, sem número.
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
  { slug: "visao-geral", href: "/setor-eletrico", rotulo: "Visão geral", resumo: "O sistema elétrico em poucos minutos.", integrado: true, secao: "energia:visao-geral" },
  { slug: "pld", href: "/setor-eletrico/pld", rotulo: "PLD", resumo: "Preço de curto prazo: o que é, de onde vem, o que acontece agora e o estado da previsão.", integrado: true, secao: "energia:pld" },
  { slug: "agua-e-clima", href: "/setor-eletrico/agua-e-clima", rotulo: "Água e clima", resumo: "Energia armazenada e energia que chega aos reservatórios.", integrado: true, secao: "energia:agua-e-clima" },
  { slug: "geracao", href: "/setor-eletrico/geracao", rotulo: "Geração", resumo: "Com que fontes o sistema está atendendo a carga.", integrado: true, secao: "energia:geracao" },
  { slug: "carga", href: "/setor-eletrico/carga", rotulo: "Carga", resumo: "Quanto o sistema está consumindo e como isso se compara.", integrado: true, secao: "energia:carga" },
  { slug: "rede", href: "/setor-eletrico/rede", rotulo: "Rede", resumo: "Fluxos entre regiões e diferenças de preço.", integrado: true, secao: "energia:rede" },
  { slug: "mercado", href: "/setor-eletrico/mercado", rotulo: "Mercado", resumo: "Ambientes de contratação, agentes e mecanismos de mercado.", integrado: false, secao: "energia:mercado" },
  { slug: "empresas", href: "/setor-eletrico/empresas", rotulo: "Empresas", resumo: "Grupos econômicos, companhias, usinas, linhas e concessões.", integrado: false, secao: "energia:empresas" },
  { slug: "expansao", href: "/setor-eletrico/expansao", rotulo: "Expansão", resumo: "Leilões, projetos, capacidade futura e planejamento.", integrado: false, secao: "energia:expansao" },
  { slug: "regulacao", href: "/setor-eletrico/regulacao", rotulo: "Regulação", resumo: "ANEEL, CCEE, ONS e MME com linha do tempo e documentos primários.", integrado: false, secao: "energia:regulacao" },
  { slug: "aprenda", href: "/setor-eletrico/aprenda", rotulo: "Aprenda", resumo: "Base de conhecimento com fonte oficial em cada verbete.", integrado: true, secao: "energia:aprenda" },
  { slug: "dados", href: "/setor-eletrico/dados", rotulo: "Dados", resumo: "Catálogo de datasets, metodologia, qualidade e downloads.", integrado: true, secao: "energia:dados" },
];

export function modulo(slug: string): ModuloEnergia {
  const m = MODULOS_ENERGIA.find((x) => x.slug === slug);
  if (!m) throw new Error(`módulo desconhecido: ${slug}`);
  return m;
}
