/**
 * Coleção "Varejo" (Observatório da Economia): fonte única de rotas, rótulos, perguntas, resumos, termos de busca, seções de
 * telemetria e arquivos para baixar. Registro (src/lib/observatorios/registro.ts), navegação da coleção, camada aberta,
 * sitemap, convite e páginas leem daqui; nenhum endereço é escrito à mão em outro lugar.
 *
 * Princípio do aperitivo: o endereço público /varejo serve, sem sessão, a versão aperitivo (src/app/aperitivo/varejo, por
 * rewrite do middleware) e, com sessão, a entrada completa da coleção. APERITIVOS em src/lib/rotasPublicas.ts declara as duas.
 *
 * As páginas `grupos`, `grupo` (a ficha de cada grupo) e `comparador` estão reservadas e ainda não publicadas: com
 * `publicada: false` não entram na navegação, no registro, na busca nem em nenhum link. A etapa que as cria troca o campo.
 *
 * A coleção mantém pipeline e golds próprios (pipeline/varejo, public/varejo/gold) e a fonte de frescor "varejo"
 * (src/lib/frescor/limiares.json).
 */

export const ROTA_VAREJO = "/varejo";
export const VERSAO_ABERTA = "/aperitivo/varejo";
export const NOME_COLECAO = "Varejo";

export type IdPaginaVarejo = "inicio" | "brasil" | "segmentos" | "grupos" | "grupo" | "comparador" | "metodo";

export type PaginaVarejo = {
  id: IdPaginaVarejo;
  href: string;
  /** Rótulo curto da navegação da coleção. */
  rotulo: string;
  /** Pergunta que a página responde (o H1 da entrada; nas páginas de painel, o grupo acima do título calculado). */
  pergunta: string;
  /** Até 140 caracteres: leva a página à busca da plataforma e aos cartões de destino da entrada. */
  resumo: string;
  /** De 3 a 12 termos: siglas, fontes, indicadores e o vocabulário leigo que o título não diz. */
  termos: readonly string[];
  secao: `economia:${string}`;
  publicada: boolean;
  /** Página de método: fica nos atalhos da navegação e fora do registro de painéis. */
  metodo?: boolean;
};

export const PAGINAS_VAREJO: readonly PaginaVarejo[] = [
  {
    id: "inicio", href: ROTA_VAREJO, rotulo: "Início", secao: "economia:varejo", publicada: true,
    pergunta: "O varejo brasileiro está vendendo mais?",
    resumo: "O varejo brasileiro está vendendo mais? Vendas do mês, tamanho do mercado e o caminho de R$ 100 até o lucro.",
    termos: ["PMC", "PAC", "comércio varejista"],
  },
  {
    id: "brasil", href: `${ROTA_VAREJO}/brasil`, rotulo: "Brasil", secao: "economia:varejo-brasil", publicada: true,
    pergunta: "O que mudou nas vendas?",
    resumo: "O que mudou nas vendas do varejo? Volume contra receita, mês a mês.",
    termos: ["volume de vendas", "receita nominal", "varejo restrito", "varejo ampliado"],
  },
  {
    id: "segmentos", href: `${ROTA_VAREJO}/segmentos`, rotulo: "Segmentos e estados", secao: "economia:varejo-segmentos", publicada: true,
    pergunta: "Onde a média esconde diferenças?",
    resumo: "Onde a média do varejo esconde diferenças? Atividades, estados e internet.",
    termos: ["farmácias", "vestuário", "eletrodomésticos", "e-commerce", "vendas por estado"],
  },
  // reservadas (outra etapa cria as páginas e troca `publicada`): não entram em navegação, registro, busca nem link
  {
    id: "grupos", href: `${ROTA_VAREJO}/grupos`, rotulo: "Grupos", secao: "economia:varejo-grupos", publicada: false,
    pergunta: "Quem são os maiores grupos do varejo?",
    resumo: "Quem são os maiores grupos do varejo brasileiro? Vendas, lojas, bandeiras e demonstrações das companhias abertas.",
    termos: ["ranking do varejo", "maiores varejistas", "redes", "bandeiras", "lojas", "CVM", "companhias abertas"],
  },
  {
    id: "grupo", href: `${ROTA_VAREJO}/grupos/[slug]`, rotulo: "Ficha do grupo", secao: "economia:varejo-grupo", publicada: false,
    pergunta: "Como este grupo vende e ganha dinheiro?",
    resumo: "Como este grupo do varejo vende e ganha dinheiro? Bandeiras, canais, indicadores operacionais e demonstrações.",
    termos: ["ficha", "bandeiras", "vendas nas mesmas lojas", "margem", "dívida"],
  },
  {
    id: "comparador", href: `${ROTA_VAREJO}/comparador`, rotulo: "Comparador", secao: "economia:varejo-comparador", publicada: false,
    pergunta: "Como dois grupos se comparam?",
    resumo: "Como dois grupos do varejo se comparam? Receita, margens, giro e dívida das companhias abertas, lado a lado.",
    termos: ["comparar varejistas", "margem bruta", "margem líquida", "giro de estoque", "dívida líquida"],
  },
  {
    id: "metodo", href: `${ROTA_VAREJO}/metodo`, rotulo: "Método", secao: "economia:varejo-metodo", publicada: true, metodo: true,
    pergunta: "Como o Varejo mede cada número?",
    resumo: "Como a coleção Varejo mede cada número? Fontes, tabelas, fórmulas, correspondência com o IBGE e lacunas.",
    termos: ["metodologia", "SIDRA", "fórmulas", "lacunas", "pesos da PMC"],
  },
];

export function paginaVarejo(id: IdPaginaVarejo): PaginaVarejo {
  const p = PAGINAS_VAREJO.find((x) => x.id === id);
  if (!p) throw new Error(`página do Varejo fora do catálogo: ${id}`);
  return p;
}

/** Páginas com endereço no ar, na ordem da procura. */
export const paginasPublicadas = (): PaginaVarejo[] => PAGINAS_VAREJO.filter((p) => p.publicada);

/** Painéis da coleção (sem a entrada e sem o método), para a navegação e os destinos da entrada. */
export const paineisPublicados = (): PaginaVarejo[] => paginasPublicadas().filter((p) => p.id !== "inicio" && !p.metodo);

export const ROTA_BRASIL = paginaVarejo("brasil").href;
export const ROTA_SEGMENTOS = paginaVarejo("segmentos").href;
export const ROTA_METODO = paginaVarejo("metodo").href;

export const PERGUNTA_ENTRADA = paginaVarejo("inicio").pergunta;
export const PERGUNTA_APERITIVO = "Quanto o varejo vendeu no último mês?";
export const SECAO_APERITIVO = "economia:varejo-aperitivo";

/** Arquivos para baixar, servidos por rotas com conta ao lado da entrada. */
export const DOWNLOADS = [
  { arquivo: "serie-brasil.csv", rotulo: "Vendas no Brasil, por mês", descricao: "Volume e receita nominal do varejo restrito e do ampliado desde janeiro de 2018: índice, índice com ajuste sazonal e as quatro variações da PMC" },
  { arquivo: "atividades.csv", rotulo: "Vendas por atividade, por mês", descricao: "As atividades da PMC no Brasil desde janeiro de 2018, com o universo a que cada uma pertence" },
  { arquivo: "ufs.csv", rotulo: "Vendas por estado, por mês", descricao: "Varejo restrito e ampliado nas 27 unidades da federação desde janeiro de 2018, e a PAC 2024 por estado" },
] as const;

export const hrefDownload = (arquivo: (typeof DOWNLOADS)[number]["arquivo"]) => `${ROTA_VAREJO}/${arquivo}`;

/** Sigla da UF → código do IBGE (a chave da malha oficial do mapa) e nome com a preposição certa. */
export const UFS: Record<string, { cod: string; nome: string; de: string }> = {
  RO: { cod: "11", nome: "Rondônia", de: "de Rondônia" }, AC: { cod: "12", nome: "Acre", de: "do Acre" }, AM: { cod: "13", nome: "Amazonas", de: "do Amazonas" },
  RR: { cod: "14", nome: "Roraima", de: "de Roraima" }, PA: { cod: "15", nome: "Pará", de: "do Pará" }, AP: { cod: "16", nome: "Amapá", de: "do Amapá" },
  TO: { cod: "17", nome: "Tocantins", de: "do Tocantins" }, MA: { cod: "21", nome: "Maranhão", de: "do Maranhão" }, PI: { cod: "22", nome: "Piauí", de: "do Piauí" },
  CE: { cod: "23", nome: "Ceará", de: "do Ceará" }, RN: { cod: "24", nome: "Rio Grande do Norte", de: "do Rio Grande do Norte" }, PB: { cod: "25", nome: "Paraíba", de: "da Paraíba" },
  PE: { cod: "26", nome: "Pernambuco", de: "de Pernambuco" }, AL: { cod: "27", nome: "Alagoas", de: "de Alagoas" }, SE: { cod: "28", nome: "Sergipe", de: "de Sergipe" },
  BA: { cod: "29", nome: "Bahia", de: "da Bahia" }, MG: { cod: "31", nome: "Minas Gerais", de: "de Minas Gerais" }, ES: { cod: "32", nome: "Espírito Santo", de: "do Espírito Santo" },
  RJ: { cod: "33", nome: "Rio de Janeiro", de: "do Rio de Janeiro" }, SP: { cod: "35", nome: "São Paulo", de: "de São Paulo" }, PR: { cod: "41", nome: "Paraná", de: "do Paraná" },
  SC: { cod: "42", nome: "Santa Catarina", de: "de Santa Catarina" }, RS: { cod: "43", nome: "Rio Grande do Sul", de: "do Rio Grande do Sul" },
  MS: { cod: "50", nome: "Mato Grosso do Sul", de: "de Mato Grosso do Sul" }, MT: { cod: "51", nome: "Mato Grosso", de: "de Mato Grosso" },
  GO: { cod: "52", nome: "Goiás", de: "de Goiás" }, DF: { cod: "53", nome: "Distrito Federal", de: "do Distrito Federal" },
};

/** "no Pará", "na Bahia", "em Pernambuco": a preposição de lugar, derivada da de posse. */
export const emUf = (uf: string): string => (UFS[uf]?.de ?? uf).replace(/^do /, "no ").replace(/^da /, "na ").replace(/^de /, "em ");

/** Nome curto das atividades da PMC, para tabelas e eixos (o nome inteiro do IBGE fica no detalhe e no método). */
export const NOME_CURTO_ATIVIDADE: Record<string, string> = {
  combustiveis: "Combustíveis e lubrificantes",
  alimentar: "Supermercados, alimentos, bebidas e fumo",
  "hiper-super": "Hipermercados e supermercados",
  vestuario: "Tecidos, vestuário e calçados",
  "moveis-eletro": "Móveis e eletrodomésticos",
  moveis: "Móveis",
  eletrodomesticos: "Eletrodomésticos",
  farmacia: "Farmácia, perfumaria e cosméticos",
  livros: "Livros, jornais e papelaria",
  informatica: "Informática, escritório e comunicação",
  "uso-pessoal": "Outros artigos de uso pessoal e doméstico",
  veiculos: "Veículos, motos, partes e peças",
  construcao: "Material de construção",
  "atacado-alimentar": "Atacado de alimentos, bebidas e fumo",
};
