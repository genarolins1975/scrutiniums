/**
 * Temas da Eficiência Estatal com páginas próprias: endereço, abas (visões do tema) e ações (comparar, dados, métodos), numa
 * lista só. A navegação de coleção (src/lib/observatorios/navegacaoColecao.ts) lê daqui as páginas de cada tema; antes cada
 * tema tinha a sua navegação (NavegacaoTemaObee, NavegacaoPainel, NavegacaoSaude, NavegacaoJudiciario, NavegacaoJustica, NavegacaoAssistencia,
 * NavegacaoTrabalho e a do saneamento das capitais). Iniciativa 2 do parecer de UX de 21/10/2026.
 *
 * `levar`: parâmetros do endereço que acompanham o leitor de uma aba a outra do mesmo tema (o recorte: capital, UF, nível).
 */
import { BASE as BASE_TRABALHO, PAGINAS as PAGINAS_TRABALHO } from "@/components/eficiencia/trabalho-renda/modelo";
import { PAGINAS as PAGINAS_HABITACAO, ROTA as ROTA_HABITACAO } from "@/lib/eficiencia/habitacao/modelo";
import { PAGINAS_JUSTICA, ROTA_JUSTICA } from "@/lib/eficiencia/justica/modelo";
import { BASE_JUDICIARIO, CAPITULOS as CAPITULOS_JUDICIARIO } from "@/lib/eficiencia/judiciario/modelo";
import { PAGINAS as PAGINAS_SANEAMENTO, ROTA as ROTA_SANEAMENTO } from "@/lib/eficiencia/saneamento/modelo";
import { PAGINAS_MOBILIDADE, ROTA_MOBILIDADE } from "@/lib/eficiencia/mobilidade/modelo";
import { ABAS_SAUDE, CAMINHO_COMPARAR as COMPARAR_SAUDE, CAMINHO_METODOS as METODOS_SAUDE, ROTA_SAUDE } from "@/lib/eficiencia/saude/rotas";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, ROTA_BASE as ROTA_EDUCACAO_CAPITAIS, ROTULO_NAVEGACAO } from "@/lib/eficiencia/visao";

export type AbaTema = readonly [caminho: string, rotulo: string];
export type TemaEficiencia = { nome: string; rota: string; abas: readonly AbaTema[]; acoes: readonly AbaTema[]; levar?: readonly string[] };

/** Slugs que são ação do tema (à direita, como atalho), não visão. */
const ACOES = new Set(["dados", "metodos", "comparar"]);
const separar = (nome: string, rota: string, todas: readonly AbaTema[], levar?: readonly string[]): TemaEficiencia => ({
  nome,
  rota,
  abas: todas.filter(([c]) => !ACOES.has(c.replace(/^\//, ""))),
  acoes: todas.filter(([c]) => ACOES.has(c.replace(/^\//, ""))),
  levar,
});

/** Rótulos curtos dos capítulos do Judiciário na navegação (o título inteiro fica na página). */
const CURTOS_JUDICIARIO: Record<string, string> = {
  panorama: "Panorama", internacional: "Outros países", recursos: "Recursos", tempo: "Tempo", filas: "Filas", entrega: "Entrega",
  consistencia: "Consistência", criminal: "Criminal", acesso: "Acesso", comparar: "Comparar", metodos: "Método",
};

export const TEMAS_EFICIENCIA = {
  trabalho: separar("Trabalho e renda", BASE_TRABALHO, PAGINAS_TRABALHO.map((p) => [p.slug, p.nome] as const)),
  assistencia: separar("Assistência social e cuidado", "/eficiencia-estatal/assistencia-social", [
    ["", "Panorama"], ["necessidades", "Necessidades"], ["acesso", "Acesso"], ["acompanhamento", "Acompanhamento"], ["cuidado", "Cuidado e proteção"],
    ["recursos", "Recursos e capacidade"], ["dados", "Explorar dados"], ["metodos", "Dados e métodos"],
  ]),
  alimentacao: separar("Segurança alimentar", "/eficiencia-estatal/seguranca-alimentar", [
    ["", "Panorama"], ["necessidades", "Necessidades"], ["acesso", "Acesso"], ["qualidade", "Qualidade e continuidade"], ["recursos", "Recursos e estrutura"],
    ["dados", "Explorar dados"], ["metodos", "Método e fontes"],
  ]),
  habitacao: separar("Habitação", ROTA_HABITACAO, PAGINAS_HABITACAO),
  cultura: separar("Cultura", "/eficiencia-estatal/cultura", [
    ["", "Panorama"], ["rede", "Equipamentos"], ["acesso", "Acesso digital"], ["atividades", "Atividades"], ["acervos", "Acervos"], ["recursos", "Recursos"],
    ["metodos", "Dados e métodos"],
  ]),
  seguranca: separar("Segurança pública", "/eficiencia-estatal/seguranca-publica", [
    ["", "Panorama"], ["estados", "Por estado"], ["letalidade", "Violência letal"], ["mulheres", "Mulheres"], ["patrimonio", "Patrimônio"],
    ["resposta", "Busca e atividade"], ["recursos", "Recursos"], ["metodos", "Dados e métodos"],
  ]),
  saude: separar("Saúde nas capitais", ROTA_SAUDE, [...ABAS_SAUDE.map((a) => [a.caminho, a.rotulo] as const), [COMPARAR_SAUDE, "Comparar capitais"], [METODOS_SAUDE, "Dados e métodos"]], ["cap"]),
  educacao: separar("Educação nas capitais", ROTA_EDUCACAO_CAPITAIS, [...ROTULO_NAVEGACAO.map((a) => [a.caminho, a.rotulo] as const), [CAMINHO_COMPARAR, "Comparar capitais"], [CAMINHO_METODOS, "Dados e métodos"]], ["cap"]),
  judiciario: separar("Judiciário", BASE_JUDICIARIO, [["", "Início"], ...CAPITULOS_JUDICIARIO.map(([slug]) => [slug, CURTOS_JUDICIARIO[slug] ?? slug] as const)]),
  justica: separar("Acesso à Justiça", ROTA_JUSTICA, PAGINAS_JUSTICA),
  saneamento: separar("Saneamento nas capitais", ROTA_SANEAMENTO, PAGINAS_SANEAMENTO),
  mobilidade: separar("Mobilidade e transporte", ROTA_MOBILIDADE, PAGINAS_MOBILIDADE.map((p) => [p.slug, p.slug === "comparar" ? "Comparar territórios" : p.nome] as const), ["uf", "busca", "nivel", "ordem", "territorio"]),
  ambiente: separar("Meio ambiente e clima", "/eficiencia-estatal/meio-ambiente-clima", [
    ["", "Panorama"], ["riscos", "Riscos e impactos"], ["prevencao", "Prevenção"], ["residuos", "Pressões ambientais"], ["metodos", "Dados e métodos"],
  ]),
  energia: separar("Energia e conectividade", "/eficiencia-estatal/energia-conectividade", [
    ["", "Panorama"], ["acesso", "Acesso à energia"], ["continuidade", "Continuidade"], ["custo", "Custo e proteção"], ["internet", "Conectividade"],
    ["metodos", "Dados e métodos"],
  ]),
} satisfies Record<string, TemaEficiencia>;

export type IdTemaEficiencia = keyof typeof TEMAS_EFICIENCIA;

/** Endereço de uma aba ou ação do tema ("" é a entrada; caminhos com "/" inicial são relativos à entrada). */
export function hrefDoTema(t: TemaEficiencia, caminho: string): string {
  const c = caminho.replace(/^\//, "");
  return c ? `${t.rota}/${c}` : t.rota;
}
