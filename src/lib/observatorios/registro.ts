/**
 * Registro único dos seis observatórios (reagrupamento de 17/10/2026,
 * docs/observatorios/REAGRUPAMENTO.md).
 *
 * Os oito domínios de src/lib/dominios.ts continuam existindo como coleções:
 * guardam rotas, golds, telemetria e cabeçalhos próprios. Este registro diz a
 * qual observatório e a qual coleção cada painel pertence. Regras:
 *
 * 1. Cada rota de painel tem um único dono. As subpáginas herdam o dono do
 *    painel mais próximo acima delas (donoDaRota).
 * 2. Nenhum endereço muda: o registro organiza a navegação, não as URLs.
 * 3. Onde um tema aparece em outro observatório, aparece como atalho, que
 *    aponta para o painel do dono.
 *
 * Os painéis são lidos dos catálogos de cada domínio: um painel publicado num
 * catálogo entra aqui sem lista escrita à mão. Só o Crédito, que se divide
 * entre dois observatórios, e os temas da Eficiência Estatal têm tabela
 * explícita, e o teste reprova aba ou tema sem destino.
 */
import type { DominioId } from "@/lib/dominios";
import { OBSERVATORIOS, type Atalho, type Observatorio, type ObservatorioId, type Painel } from "./lista";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { CAPITULOS as CAPITULOS_SANEAMENTO, FERRAMENTAS as FERRAMENTAS_SANEAMENTO } from "@/lib/saneamento/capitulos";
import { PAGINAS_GAS } from "@/lib/gas/navegacao";
import { PAGINAS_COMBUSTIVEIS, ROTA_COMBUSTIVEIS } from "@/lib/combustiveis/paginas";
import { ROTA_INFLACAO, TITULO_PAINEL as TITULO_PAINEL_INFLACAO } from "@/lib/inflacao/paginas";
import { CAPITULOS_PUBLICADOS as CAPITULOS_CONTAS, PAINEL_AREAS } from "@/lib/contas-publicas/catalogo";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { CAPITULOS_AGRO, PERGUNTAS_AGRO } from "@/lib/agro/modelo";
import { COPIAS } from "./copias";
import { PAGINAS_CREDITO } from "@/lib/credito/navegacao";

export type { Atalho, Colecao, Observatorio, ObservatorioId, Painel } from "./lista";
export { OBSERVATORIOS } from "./lista";

// ------------------------------------------------------------------ Crédito

type Destino = readonly [ObservatorioId, string];
const FAM_DIVIDA: Destino = ["familias", "divida"];
const ECO_CREDITO: Destino = ["economia", "credito"];

/** Cada aba do Crédito e o seu dono. Abas institucionais ficam fora da navegação dos observatórios. */
export const DESTINO_ABAS_CREDITO: Record<string, Destino> = {
  "/map": ECO_CREDITO, "/overview": ECO_CREDITO, "/credit": ECO_CREDITO, "/credit-panorama": ECO_CREDITO,
  "/states": ECO_CREDITO, "/credit-penetration": ECO_CREDITO, "/institutions": ECO_CREDITO, "/products": ECO_CREDITO,
  "/interest-rates": ECO_CREDITO, "/sfn-entries-exits": ECO_CREDITO, "/compare": ECO_CREDITO, "/market": ECO_CREDITO,
  "/broad-credit": ECO_CREDITO, "/rural-credit": ECO_CREDITO, "/directed-credit-bndes": ECO_CREDITO,
  "/funding": ECO_CREDITO, "/consortia": ECO_CREDITO, "/loan-maturity": ECO_CREDITO, "/fidc-receivables": ECO_CREDITO,
  "/operational-indicators": ECO_CREDITO, "/leading-signals": ECO_CREDITO, "/search-trends": ECO_CREDITO,
  "/scenarios": ECO_CREDITO, "/alerts": ECO_CREDITO, "/regulacao": ECO_CREDITO, "/research": ECO_CREDITO,
  "/methodology": ECO_CREDITO,
  "/pix": ["economia", "pagamentos"], "/open-finance": ["economia", "pagamentos"],
  "/sectors": ["economia", "empresas"], "/recoveries": ["economia", "empresas"],
  "/payroll-lending-aging": FAM_DIVIDA, "/bets-financial-risk": FAM_DIVIDA, "/financial-fraud": FAM_DIVIDA,
  "/desenrola": FAM_DIVIDA, "/lawsuits": FAM_DIVIDA, "/debt-collection-lawsuits": FAM_DIVIDA,
  "/conduct-enforcement": FAM_DIVIDA,
  "/housing-credit": ["familias", "moradia"],
  "/formal-employment": ["familias", "renda"],
  "/subnational-credit": ["contas-publicas", "divida-governos"], "/federal-tax-debt": ["contas-publicas", "divida-governos"],
};
export const ABAS_INSTITUCIONAIS_CREDITO = new Set(["/suggestions", "/about"]);

function paineisCredito(): Painel[] {
  const raiz: Painel = { rota: "/observatorio", titulo: "Crédito", observatorio: "economia", colecao: "credito", origem: "credito" };
  // páginas Next do Crédito (consultas de juros e método), logo depois da raiz: são as mais procuradas pelo leitor
  const next = PAGINAS_CREDITO.map((p): Painel => ({ rota: p.href, titulo: p.titulo, observatorio: "economia", colecao: "credito", origem: "credito" }));
  return [raiz, ...next, ...ABAS_OBSERVATORIO.filter((a) => !ABAS_INSTITUCIONAIS_CREDITO.has(a.caminho) && !a.caminho.endsWith("/")).map((a): Painel => {
    const destino = DESTINO_ABAS_CREDITO[a.caminho];
    if (!destino) throw new Error(`aba do Crédito sem observatório: ${a.caminho}`);
    const [observatorio, colecao] = destino;
    return {
      rota: `/observatorio${a.caminho}`, titulo: a.titulo, observatorio, colecao, origem: "credito",
    };
  })];
}

// ------------------------------------------------------- Eficiência Estatal

/** Cada tema publicado da Eficiência Estatal e o seu dono. */
export const DESTINO_TEMAS_EFICIENCIA: Record<string, Destino> = {
  educacao: ["servicos-publicos", "educacao"],
  saude: ["servicos-publicos", "saude"],
  seguranca: ["servicos-publicos", "seguranca"],
  justica: ["servicos-publicos", "justica"],
  cultura: ["servicos-publicos", "cultura"],
  trabalho: ["familias", "renda"],
  alimentacao: ["familias", "protecao"],
  assistencia: ["familias", "protecao"],
  habitacao: ["familias", "moradia"],
  saneamento: ["energia-e-infraestrutura", "saneamento"],
  mobilidade: ["energia-e-infraestrutura", "mobilidade"],
  energia: ["energia-e-infraestrutura", "conectividade"],
  ambiente: ["territorio-e-clima", "cidades-clima"],
};

function paineisEficiencia(): Painel[] {
  const temas = DIMENSOES.filter((d) => d.href).map((d) => {
    const destino = DESTINO_TEMAS_EFICIENCIA[d.id];
    if (!destino) throw new Error(`tema da Eficiência Estatal sem observatório: ${d.id}`);
    const [observatorio, colecao] = destino;
    return {
      rota: d.href as string, titulo: d.titulo, observatorio, colecao, origem: "eficiencia" as const,
    };
  });
  return [
    { rota: "/eficiencia-estatal", titulo: "Comparação entre capitais", observatorio: "servicos-publicos", colecao: "sintese", origem: "eficiencia" },
    { rota: "/eficiencia-estatal/indice-de-resultados", titulo: "Índice de resultados das capitais", observatorio: "servicos-publicos", colecao: "sintese", origem: "eficiencia" },
    { rota: "/eficiencia-estatal/laboratorio-cesta", titulo: "Laboratório do índice (revisão v3)", observatorio: "servicos-publicos", colecao: "sintese", origem: "eficiencia" },
    { rota: "/eficiencia-estatal/judiciario", titulo: "Judiciário: filas e tempos", observatorio: "servicos-publicos", colecao: "justica", origem: "eficiencia" },
    // duplicata resolvida em 18/10/2026 (REAGRUPAMENTO.md): a página fica publicada e avisa qual é o painel principal (copias.ts)
    { rota: "/eficiencia-estatal/trabalho-renda/emprego-formal", titulo: "Emprego formal nacional", observatorio: "familias", colecao: "renda", origem: "eficiencia" },
    // resíduos e drenagem tratam de cidades e clima; o painel principal é Meio ambiente e clima (copias.ts)
    { rota: "/eficiencia-estatal/saneamento/residuos", titulo: "Resíduos sólidos", observatorio: "territorio-e-clima", colecao: "cidades-clima", origem: "eficiencia" },
    { rota: "/eficiencia-estatal/saneamento/drenagem", titulo: "Drenagem e risco de inundação", observatorio: "territorio-e-clima", colecao: "cidades-clima", origem: "eficiencia" },
    ...temas,
  ];
}

// ---------------------------------------------------------- Agronegócio

const AGRO_FAMILIAS = new Set(["prato", "alimentos-consumo"]);
const AGRO_TERRITORIO = new Set(["ambiente", "clima-ambiente"]);
const AGRO_EXTRAS: [string, string][] = [
  ["", "Agronegócio"], ["panorama", "Panorama"], ["atlas", "Atlas"], ["comparar", "Comparador"], ["cadeias", "Cadeias"],
  ["sintese", "Síntese"], ["aprenda", "Aprenda"], ["glossario", "Glossário"], ["metodologia", "Método"],
];

function paineisAgro(): Painel[] {
  const destino = (slug: string): Destino =>
    AGRO_FAMILIAS.has(slug) ? ["familias", "custo-de-vida"] : AGRO_TERRITORIO.has(slug) ? ["territorio-e-clima", "desmatamento"] : ["economia", "agro"];
  const itens: [string, string][] = [
    ...PERGUNTAS_AGRO.map((p): [string, string] => [p.id, p.curto]),
    ...CAPITULOS_AGRO.map((c): [string, string] => [c.id, c.nome]),
    ...AGRO_EXTRAS,
  ];
  return itens.map(([slug, titulo]) => {
    const [observatorio, colecao] = destino(slug);
    return {
      rota: `/agronegocio${slug ? `/${slug}` : ""}`, titulo, observatorio, colecao, origem: "agro" as const,
    };
  });
}

// --------------------------------------------- coleções que entram inteiras

function inteira(origem: DominioId, observatorio: ObservatorioId, colecao: string, itens: { rota: string; titulo: string }[]): Painel[] {
  return itens.map((i) => ({ ...i, observatorio, colecao, origem }));
}

function paineisColecoesInteiras(): Painel[] {
  return [
    ...inteira("energia", "energia-e-infraestrutura", "setor-eletrico",
      DESTINOS_NAVEGACAO.filter((d) => d.publicado && !d.href.includes("#")).map((d) => ({ rota: d.href, titulo: d.rotulo }))),
    ...inteira("gas", "energia-e-infraestrutura", "gas", [
      { rota: "/gas-natural", titulo: "Gás Natural" },
      ...PAGINAS_GAS.map((p) => ({ rota: p.href, titulo: p.rotulo })),
    ]),
    // coleção própria com a gold do pipeline do Gás (a mesma planilha da ANP do botijão e do GNV): origem gas. A consulta
    // por estado (/combustiveis/no-meu-estado) herda o dono do painel e só entra nas listas com a aprovação da LEVA_2
    ...inteira("gas", "energia-e-infraestrutura", "combustiveis",
      PAGINAS_COMBUSTIVEIS.filter((p) => p.href === ROTA_COMBUSTIVEIS).map((p) => ({ rota: p.href, titulo: "Combustíveis nos postos" }))),
    ...inteira("saneamento", "energia-e-infraestrutura", "saneamento", [
      { rota: "/saneamento", titulo: "Saneamento" },
      ...CAPITULOS_SANEAMENTO.map((c) => ({ rota: `/saneamento/${c.slug}`, titulo: c.rotulo })),
      ...FERRAMENTAS_SANEAMENTO.map((f) => ({ rota: `/saneamento/${f.slug}`, titulo: f.rotulo })),
    ]),
    ...inteira("contas", "contas-publicas", "federais", [
      { rota: "/contas-publicas", titulo: "Contas Federais" },
      // complemento do capítulo Panorama (20/10/2026): a despesa por área, pela classificação funcional do SIOP
      { rota: PAINEL_AREAS.href, titulo: PAINEL_AREAS.titulo },
      // só os capítulos com dados; os em preparação não têm página (Onda 3)
      ...CAPITULOS_CONTAS.map((c) => ({ rota: `/contas-publicas/${c.id}`, titulo: c.titulo })),
      { rota: "/contas-publicas/metodologia", titulo: "Metodologia" },
      { rota: "/contas-publicas/glossario", titulo: "Glossário" },
      { rota: "/contas-publicas/dados", titulo: "Dados" },
    ]),
    ...inteira("estados", "contas-publicas", "estaduais", [{ rota: "/contas-publicas-estaduais", titulo: "Contas Estaduais" }]),
  ];
}

// ------------------------------------------------------------------ atalhos

/** Temas que aparecem também em outro observatório, sempre apontando para o painel do dono. */
export const ATALHOS: Atalho[] = [
  { rota: "/observatorio/credit", observatorio: "familias", colecao: "divida" },
  { rota: "/observatorio-do-credito/quanto-meu-banco-cobra", observatorio: "familias", colecao: "divida" },
  { rota: "/observatorio-do-credito/simulador-da-parcela", observatorio: "familias", colecao: "divida" },
  { rota: "/setor-eletrico/inclusao-energetica", observatorio: "familias", colecao: "protecao" },
  { rota: "/saneamento/tarifa-social", observatorio: "familias", colecao: "protecao" },
  { rota: "/gas-natural/gas-de-cozinha", observatorio: "familias", colecao: "custo-de-vida" },
  { rota: "/setor-eletrico/conta-de-luz", observatorio: "familias", colecao: "custo-de-vida" },
  { rota: "/saneamento/preco-regulado", observatorio: "familias", colecao: "custo-de-vida" },
  { rota: "/saneamento/saude-ambiente", observatorio: "servicos-publicos", colecao: "saude" },
  { rota: "/saneamento/resiliencia", observatorio: "territorio-e-clima", colecao: "cidades-clima" },
  { rota: "/setor-eletrico/agua-e-clima", observatorio: "territorio-e-clima", colecao: "cidades-clima" },
  { rota: "/setor-eletrico/transicao", observatorio: "territorio-e-clima", colecao: "desmatamento" },
];

/**
 * Todos os painéis com dono, na ordem dos observatórios. Sem cache: os títulos
 * do Setor Elétrico seguem o idioma da página que pergunta (navegacao.ts), e
 * guardar a primeira leitura vazaria títulos em inglês para páginas em português.
 */
/** Painéis mantidos pelo próprio Observatório do Território e Clima, com pipeline e gold próprios (public/territorio). */
function paineisTerritorio(): Painel[] {
  return [
    { rota: "/territorio/queimadas", titulo: "Queimadas e focos de calor", observatorio: "territorio-e-clima", colecao: "fogo", origem: null },
    { rota: "/territorio/desastres", titulo: "Desastres reconhecidos", observatorio: "territorio-e-clima", colecao: "desastres", origem: null },
    { rota: "/territorio/emissoes", titulo: "Emissões pelo inventário oficial", observatorio: "territorio-e-clima", colecao: "desmatamento", origem: null },
  ];
}

/**
 * Painéis mantidos pelo próprio Observatório das Famílias, com pipeline e gold próprios (pipeline/inflacao, public/inflacao).
 * A consulta por cidade (/custo-de-vida/na-minha-cidade) herda o dono do painel e só entra nas listas com a aprovação da LEVA_2.
 */
function paineisFamilias(): Painel[] {
  return [{ rota: ROTA_INFLACAO, titulo: TITULO_PAINEL_INFLACAO, observatorio: "familias", colecao: "custo-de-vida", origem: null }];
}

/**
 * Painel registrado que é cópia integral de outro (copias.ts) leva `duplicataDe`.
 * Cópia parcial, uma seção da página, não: o resto da página é próprio e continua nas listas.
 */
const PRINCIPAL_DA_COPIA = new Map(COPIAS.filter((c) => !c.parcial).map((c) => [c.rota, c.principal]));

export function paineis(): Painel[] {
  // o painel das Famílias vem primeiro: na coleção Custo de vida, a inflação de todo o orçamento abre a lista, antes da comida
  return [...paineisFamilias(), ...paineisCredito(), ...paineisEficiencia(), ...paineisAgro(), ...paineisColecoesInteiras(), ...paineisTerritorio()]
    .map((p) => (PRINCIPAL_DA_COPIA.has(p.rota) ? { ...p, duplicataDe: PRINCIPAL_DA_COPIA.get(p.rota) } : p));
}

export function observatorio(id: ObservatorioId): Observatorio {
  const o = OBSERVATORIOS.find((x) => x.id === id);
  if (!o) throw new Error(`observatório desconhecido: ${id}`);
  return o;
}

function normalizar(caminho: string): string {
  const semConsulta = caminho.split(/[?#]/)[0] || "/";
  return semConsulta.length > 1 && semConsulta.endsWith("/") ? semConsulta.slice(0, -1) : semConsulta;
}

/** Painel dono de uma rota: ele mesmo ou o painel mais próximo acima dela. */
export function donoDaRota(caminho: string): Painel | null {
  let atual = normalizar(caminho);
  const porRota = new Map(paineis().map((p) => [p.rota, p]));
  while (atual) {
    const p = porRota.get(atual);
    if (p) return p;
    const corte = atual.lastIndexOf("/");
    if (corte <= 0) return null;
    atual = atual.slice(0, corte);
  }
  return null;
}

/** Rotas que um observatório pode apresentar: as próprias e os atalhos para painéis de outros. */
export function rotasDoObservatorio(id: ObservatorioId): Set<string> {
  return new Set([...paineis().filter((p) => p.observatorio === id).map((p) => p.rota), ...ATALHOS.filter((a) => a.observatorio === id).map((a) => a.rota)]);
}

/** Domínios de origem que alimentam um observatório (para dizer de onde vêm as coleções). */
export function origensDoObservatorio(id: ObservatorioId): DominioId[] {
  return Array.from(new Set(paineis().filter((p) => p.observatorio === id).flatMap((p) => (p.origem ? [p.origem] : []))));
}

/** Observatórios que recebem painéis de um domínio de origem (o Crédito alimenta mais de um). */
export function observatoriosDaOrigem(origem: DominioId): Observatorio[] {
  const ids = new Set(paineis().filter((p) => p.origem === origem).map((p) => p.observatorio));
  return OBSERVATORIOS.filter((o) => ids.has(o.id));
}
