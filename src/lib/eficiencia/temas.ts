/**
 * Temas da Eficiência Estatal com páginas próprias: endereço, abas (visões do tema) e ações (comparar, dados, métodos), numa
 * lista só. A navegação de coleção (src/lib/observatorios/navegacaoColecao.ts) lê daqui as páginas de cada tema; antes cada
 * tema tinha a sua navegação (NavegacaoTemaObee, NavegacaoPainel, NavegacaoSaude, NavegacaoJudiciario, NavegacaoJustica, NavegacaoAssistencia,
 * NavegacaoTrabalho e a do saneamento das capitais). Iniciativa 2 do parecer de UX de 21/10/2026.
 *
 * `levar`: parâmetros do endereço que acompanham o leitor de uma aba a outra do mesmo tema (o recorte: capital, UF, nível).
 *
 * `recorte`: o recorte geográfico do tema, fonte única para títulos, rótulo de contexto e navegação (recomendação 3 do parecer
 * estrutural de 10/11/2026). Quem mora fora das capitais precisa saber, antes de abrir o painel, se a cidade dele está lá:
 * tema restrito às capitais diz "nas capitais" no nome; tema que para no estado ou no país diz o recorte no rótulo de contexto
 * (`contexto`). Conferido por src/tests/recorte-geografico.test.ts contra os dados publicados de cada tema.
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

/** Menor território em que o tema publica valores: só as 26 capitais, todos os municípios, as 27 UFs ou só o país (e regiões). */
export type NivelRecorte = "capitais" | "municipios" | "ufs" | "brasil";
/** `rotulo`: o recorte como a tela o escreve ("26 capitais", "Brasil, regiões e estados"). */
export type RecorteGeografico = { nivel: NivelRecorte; rotulo: string };
const recorte = (nivel: NivelRecorte, rotulo: string): RecorteGeografico => ({ nivel, rotulo });
/** As 26 capitais estaduais (Brasília fica de fora: o Distrito Federal não é município). O mesmo recorte da Síntese das capitais. */
export const RECORTE_CAPITAIS = recorte("capitais", "26 capitais");

/** O tema cobre só parte dos municípios do país (ou nenhum): o leitor precisa ser avisado antes de procurar a cidade dele. */
export const recorteRestrito = (r: RecorteGeografico) => r.nivel !== "municipios";
/** O título já diz que o universo são as capitais. */
export const declaraCapitais = (titulo: string) => /\bcapita(l|is)\b/i.test(titulo);
/**
 * Título de painel com o recorte: o que só cobre as capitais termina em "nas capitais" (a forma já usada em "Saúde nas capitais"
 * e "Educação nas capitais"); os demais ficam como estão, e o recorte deles vai no rótulo de contexto.
 */
export function tituloComRecorte(titulo: string, r: RecorteGeografico): string {
  return r.nivel === "capitais" && !declaraCapitais(titulo) ? `${titulo} nas capitais` : titulo;
}

export type TemaEficiencia = {
  nome: string;
  rota: string;
  abas: readonly AbaTema[];
  acoes: readonly AbaTema[];
  levar?: readonly string[];
  recorte: RecorteGeografico;
  /** Rótulo de contexto acima do H1: o nome do tema e, quando o recorte é restrito e o nome não o diz, o recorte. */
  contexto: string;
};

/** Slugs que são ação do tema (à direita, como atalho), não visão. */
const ACOES = new Set(["dados", "metodos", "comparar"]);
const separar = (titulo: string, r: RecorteGeografico, rota: string, todas: readonly AbaTema[], levar?: readonly string[]): TemaEficiencia => {
  const nome = tituloComRecorte(titulo, r);
  return {
    nome,
    rota,
    abas: todas.filter(([c]) => !ACOES.has(c.replace(/^\//, ""))),
    acoes: todas.filter(([c]) => ACOES.has(c.replace(/^\//, ""))),
    levar,
    recorte: r,
    contexto: recorteRestrito(r) && !declaraCapitais(nome) ? `${nome} · ${r.rotulo}` : nome,
  };
};

// Recortes conferidos nos dados publicados de cada tema (public/eficiencia/<tema>, golds da Energia), em 10/11/2026.
const MUNICIPIOS = recorte("municipios", "Brasil, estados e municípios");
const REGIOES_E_UFS = recorte("ufs", "Brasil, regiões e estados");

/** Rótulos curtos dos capítulos do Judiciário na navegação (o título inteiro fica na página). */
const CURTOS_JUDICIARIO: Record<string, string> = {
  panorama: "Panorama", internacional: "Outros países", recursos: "Recursos", tempo: "Tempo", filas: "Filas", entrega: "Entrega",
  consistencia: "Consistência", criminal: "Criminal", acesso: "Acesso", comparar: "Comparar", metodos: "Método",
};

export const TEMAS_EFICIENCIA = {
  trabalho: separar("Trabalho e renda", MUNICIPIOS, BASE_TRABALHO, PAGINAS_TRABALHO.map((p) => [p.slug, p.nome] as const)),
  assistencia: separar("Assistência social e cuidado", MUNICIPIOS, "/eficiencia-estatal/assistencia-social", [
    ["", "Panorama"], ["necessidades", "Necessidades"], ["acesso", "Acesso"], ["acompanhamento", "Acompanhamento"], ["cuidado", "Cuidado e proteção"],
    ["recursos", "Recursos e capacidade"], ["dados", "Explorar dados"], ["metodos", "Dados e métodos"],
  ]),
  alimentacao: separar("Segurança alimentar", MUNICIPIOS, "/eficiencia-estatal/seguranca-alimentar", [
    ["", "Panorama"], ["necessidades", "Necessidades"], ["acesso", "Acesso"], ["qualidade", "Qualidade e continuidade"], ["recursos", "Recursos e estrutura"],
    ["dados", "Explorar dados"], ["metodos", "Método e fontes"],
  ]),
  habitacao: separar("Habitação", REGIOES_E_UFS, ROTA_HABITACAO, PAGINAS_HABITACAO),
  cultura: separar("Cultura", REGIOES_E_UFS, "/eficiencia-estatal/cultura", [
    ["", "Panorama"], ["rede", "Equipamentos"], ["acesso", "Acesso digital"], ["atividades", "Atividades"], ["acervos", "Acervos"], ["recursos", "Recursos"],
    ["metodos", "Dados e métodos"],
  ]),
  seguranca: separar("Segurança pública", recorte("ufs", "Brasil e estados"), "/eficiencia-estatal/seguranca-publica", [
    ["", "Panorama"], ["estados", "Por estado"], ["letalidade", "Violência letal"], ["mulheres", "Mulheres"], ["patrimonio", "Patrimônio"],
    ["resposta", "Busca e atividade"], ["recursos", "Recursos"], ["metodos", "Dados e métodos"],
  ]),
  saude: separar("Saúde", RECORTE_CAPITAIS, ROTA_SAUDE, [...ABAS_SAUDE.map((a) => [a.caminho, a.rotulo] as const), [COMPARAR_SAUDE, "Comparar capitais"], [METODOS_SAUDE, "Dados e métodos"]], ["cap"]),
  educacao: separar("Educação", RECORTE_CAPITAIS, ROTA_EDUCACAO_CAPITAIS, [...ROTULO_NAVEGACAO.map((a) => [a.caminho, a.rotulo] as const), [CAMINHO_COMPARAR, "Comparar capitais"], [CAMINHO_METODOS, "Dados e métodos"]], ["cap"]),
  judiciario: separar("Judiciário", recorte("brasil", "Brasil, por tribunal"), BASE_JUDICIARIO, [["", "Início"], ...CAPITULOS_JUDICIARIO.map(([slug]) => [slug, CURTOS_JUDICIARIO[slug] ?? slug] as const)]),
  justica: separar("Acesso à Justiça", recorte("ufs", "Brasil, estados e comarcas"), ROTA_JUSTICA, PAGINAS_JUSTICA),
  // SINISA 2025: Brasil, cinco regiões e 27 UFs (água e esgoto); resíduos e drenagem, Brasil e regiões. Não há valor por capital.
  saneamento: separar("Saneamento", REGIOES_E_UFS, ROTA_SANEAMENTO, PAGINAS_SANEAMENTO),
  mobilidade: separar("Mobilidade e transporte", MUNICIPIOS, ROTA_MOBILIDADE, PAGINAS_MOBILIDADE.map((p) => [p.slug, p.slug === "comparar" ? "Comparar territórios" : p.nome] as const), ["uf", "busca", "nivel", "ordem", "territorio"]),
  ambiente: separar("Meio ambiente e clima", recorte("brasil", "Brasil e regiões"), "/eficiencia-estatal/meio-ambiente-clima", [
    ["", "Panorama"], ["riscos", "Riscos e impactos"], ["prevencao", "Prevenção"], ["residuos", "Pressões ambientais"], ["metodos", "Dados e métodos"],
  ]),
  // PNAD Contínua por Brasil, região e UF; DEC, FEC e tarifas por distribuidora (golds do Setor Elétrico). Não há valor por capital.
  energia: separar("Energia e conectividade", REGIOES_E_UFS, "/eficiencia-estatal/energia-conectividade", [
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
