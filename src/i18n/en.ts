import type { ContagemParcialIndice, IntroducaoHero, pt } from "./pt";

type EntradaEn =
  | { readonly estado: "traduzido"; readonly texto: string }
  | { readonly estado: "portugues_marcado"; readonly motivo: string; readonly texto?: never };

export type DicionarioEn = { readonly [K in keyof typeof pt]: EntradaEn };

export const en = {
  "idioma.portugues": { estado: "traduzido", texto: "Portuguese" },
  "idioma.ingles": { estado: "traduzido", texto: "English" },
  "idioma.seletor": { estado: "traduzido", texto: "Language" },
  "traducao.portugues_apenas": { estado: "traduzido", texto: "Portuguese only" },
  "home.hero.titulo_inicio": { estado: "traduzido", texto: "From scattered information to " },
  "home.hero.titulo_destaque": { estado: "traduzido", texto: "verifiable knowledge" },
  "acesso.criar_conta": { estado: "traduzido", texto: "Create a free account" },
  "home.hero.ja_cadastrado": { estado: "traduzido", texto: "I already have an account" },
  "home.hero.rotulo": { estado: "traduzido", texto: "Public data observatories" },
  "home.hero.introducao": { estado: "traduzido", texto: "{observatorios} on credit, the power sector, natural gas, basic sanitation, public services and the public accounts of the União (Brazil's federal government) and the states, built on official databases. Each dashboard identifies the data source, the reference period and what the data cannot establish." satisfies IntroducaoHero },
  "home.hero.beneficio_conta": { estado: "traduzido", texto: "All dashboards with a free account" },
  "home.hero.beneficio_evidencia": { estado: "traduzido", texto: "Data source, reference period and limitations for each number" },
  "home.hero.beneficio_gratuidade": { estado: "traduzido", texto: "Free, with no subscription" },
  "home.indice.rotulo": { estado: "traduzido", texto: "Observatory index" },
  "home.indice.ilustracoes": { estado: "traduzido", texto: "Editorial illustrations for each observatory. They do not represent data or specific places." },
  "home.indice.paginas_tematicas": { estado: "traduzido", texto: "thematic pages" },
  "home.indice.secoes_publicadas": { estado: "traduzido", texto: "published sections" },
  "home.indice.temas_publicados": { estado: "traduzido", texto: "published topics" },
  "home.indice.capitulos_com_dados": { estado: "traduzido", texto: "chapters with data" },
  "home.indice.unidades_federacao": { estado: "traduzido", texto: "Federation Units" },
  "home.indice.paginas_por_pergunta": { estado: "traduzido", texto: "pages by question" },
  "home.indice.contagem_parcial": { estado: "traduzido", texto: "{publicados} of {total}" satisfies ContagemParcialIndice },
} as const satisfies DicionarioEn;
