import { CAPITULOS_AGRO, PERGUNTAS_AGRO } from '@/lib/agro/modelo';
/**
 * Vitrine da página inicial: o que cada observatório já publica.
 *
 * Nada aqui é escrito à mão quando existe registro no código. Títulos, rotas,
 * perguntas e contagens vêm dos catálogos de cada domínio (abas do Crédito,
 * navegação do Setor Elétrico, dimensões da Eficiência Estatal, capítulos das
 * Contas Federais, medidas e catálogo das Contas Estaduais, páginas do Gás Natural). Um painel que sai
 * do registro some da home; um título que muda no registro muda aqui.
 *
 * As descrições curtas do Crédito resumem a descrição publicada de cada aba
 * (src/lib/data/observatorioAbas.ts). A situação de cada observatório (piloto,
 * capítulos sem dados, ausência de notas) acompanha a vitrine para que a home
 * não apresente como pronto o que ainda é método proposto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DominioId } from "@/lib/dominios";
import type { Idioma } from "@/lib/idioma";
import { formatadorNumero } from "@/lib/format";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { orgaosDasFontes } from "@/lib/energia/dados";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { PERGUNTA_PAINEL as PERGUNTA_EDUCACAO, ROTA_EDUCACAO, TITULO_PAINEL as TITULO_EDUCACAO } from "@/lib/educacao/paginas";
import { CAPITULOS, PAINEIS_COM_DADOS, PAINEL_AREAS, PAINEL_PREVIDENCIA } from "@/lib/contas-publicas/catalogo";
import { MEDIDAS } from "@/lib/contas-estaduais/comparacao";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import catalogoEstadual from "@/lib/contas-estaduais/catalogo.json";
import { CAPITULOS as CAPITULOS_SANEAMENTO, ROTA as ROTA_SANEAMENTO, rotaCapitulo } from "@/lib/saneamento/capitulos";
import { PAGINAS_GAS } from "@/lib/gas/navegacao";
import { ROTA_COMBUSTIVEIS, paginaCombustiveis } from "@/lib/combustiveis/paginas";
import { goldGas } from "@/lib/gas/gold";

export type PainelVitrine = { titulo: string; href: string; descricao: string };

export type UnidadeSimplesIndice =
  | "paginas_tematicas" | "secoes_publicadas" | "temas_publicados"
  | "unidades_federacao" | "paginas_por_pergunta";

export type ContagemIndice =
  | { tipo: "simples"; quantidade: number; unidade: UnidadeSimplesIndice }
  | { tipo: "parcial"; publicados: number; total: number; unidade: "capitulos_com_dados" };

export type Vitrine = {
  id: DominioId;
  /** Recorte da gravura editorial do próprio observatório (public/home). */
  imagem: string;
  /** Ponto focal da gravura (object-position) quando a lâmina é cortada na horizontal; ausente, o centro. */
  focoImagem?: string;
  /** Contagem principal, com a unidade própria de cada observatório. */
  contagem: { valor: string; unidade: string };
  /** Os mesmos inteiros, para localizar somente o índice sem alterar a vitrine portuguesa. */
  contagemIndice: ContagemIndice;
  paineis: PainelVitrine[];
  /** Fontes ao pé da lista; ausente quando a atualidade do observatório já as nomeia. */
  fontes?: string;
  /** Ressalva de escopo ou maturidade, exibida junto da vitrine. */
  situacao?: string;
  /** Página de método do observatório; ausente quando o método fica dentro de cada tema. */
  metodologia?: { href: string; rotulo: string };
};

type FormatarNumero = (n: number) => string;

function listaPt(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : itens.join("");
}

// ---------------------------------------------------------------- Crédito

const ABAS_INSTITUCIONAIS = new Set(["/suggestions", "/about"]);

function aba(caminho: string, descricao: string): PainelVitrine {
  const a = ABAS_OBSERVATORIO.find((x) => x.caminho === caminho);
  if (!a) throw new Error(`aba do Crédito fora do catálogo: ${caminho}`);
  return { titulo: a.titulo, href: `/observatorio${a.caminho}`, descricao };
}

function fontesCredito(): number | null {
  try {
    const meta = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "meta.json"), "utf-8"));
    return Array.isArray(meta?.fontes_reais) ? meta.fontes_reais.length : null;
  } catch {
    return null;
  }
}

function vitrineCredito(fmt: FormatarNumero): Vitrine {
  const temas = ABAS_OBSERVATORIO.filter((a) => !a.caminho.endsWith("/") && !ABAS_INSTITUCIONAIS.has(a.caminho));
  const quantidade = temas.length;
  const nFontes = fontesCredito();
  return {
    id: "credito",
    imagem: "/home/credito.webp",
    contagem: { valor: fmt(quantidade), unidade: "páginas temáticas" },
    contagemIndice: { tipo: "simples", quantidade, unidade: "paginas_tematicas" },
    paineis: [
      aba("/overview", "Diagnóstico do mês pelo IBCC, o que mudou e a inadimplência nas instituições."),
      aba("/credit", "Concessões, saldo, taxas e inadimplência por segmento, com marcos e exportação."),
      aba("/credit-panorama", "Carteira por estado, faixa de renda, ocupação e produto, por habitante."),
      aba("/institutions", "Capital, inadimplência e rentabilidade comparados dentro do segmento S1 a S5."),
      aba("/interest-rates", "Taxas de novas operações por instituição financeira e modalidade."),
      aba("/states", "As 27 unidades da Federação lado a lado, com uma página por UF."),
      aba("/pix", "Evolução do Pix comparada a cartões, TED e boleto, com geografia municipal."),
      aba("/compare", "Instituições lado a lado, com bloqueio de níveis de consolidação não comparáveis."),
    ],
    fontes:
      "Banco Central (SGS, SCR, IF.data, ESTBAN, Pix), CVM, IBGE, CNJ, PGFN, Tesouro e B3" +
      (nFontes ? `, entre ${fmt(nFontes)} bases registradas.` : "."),
    metodologia: { href: "/observatorio/methodology", rotulo: "Metodologia e fontes" },
  };
}

// ---------------------------------------------------------- Setor Elétrico

const DESTAQUES_ENERGIA = ["visao-geral", "territorio", "agua-e-clima", "geracao", "pld", "conta-de-luz", "qualidade", "expansao"];

function vitrineEnergia(fmt: FormatarNumero): Vitrine {
  const publicados = DESTINOS_NAVEGACAO.filter((d) => d.publicado);
  const quantidade = publicados.length;
  const paineis = DESTAQUES_ENERGIA.map((slug) => {
    const d = publicados.find((x) => x.slug === slug);
    if (!d) throw new Error(`destino do Setor Elétrico fora da navegação: ${slug}`);
    return { titulo: d.rotulo, href: d.href, descricao: d.pergunta };
  });
  const pub = publicacaoDados();
  const orgaos = orgaosDasFontes(pub).map((o) => o.orgao);
  const principais = orgaos.slice(0, 5);
  const restantes = orgaos.length - principais.length;
  return {
    id: "energia",
    imagem: "/home/energia.webp",
    contagem: { valor: fmt(quantidade), unidade: "seções publicadas" },
    contagemIndice: { tipo: "simples", quantidade, unidade: "secoes_publicadas" },
    paineis,
    fontes: pub
      ? `${listaPt(principais)}${restantes > 0 ? ` e mais ${restantes} órgãos` : ""}, em ${fmt(pub.conjuntos.length)} conjuntos de dados integrados.`
      : "ANEEL, ONS, CCEE, EPE e IBGE.",
    situacao:
      "Modelos de previsão do PLD aparecem como pesquisa, com arquivo das emissões; nenhum está em produção.",
    metodologia: { href: "/setor-eletrico/metodologia", rotulo: "Metodologia" },
  };
}

// ------------------------------------------------------ Eficiência Estatal

function vitrineEficiencia(fmt: FormatarNumero): Vitrine {
  const publicadas = DIMENSOES.filter((d) => d.href);
  const quantidade = publicadas.length;
  const semPainel = DIMENSOES.length - publicadas.length;
  return {
    id: "eficiencia",
    imagem: "/home/eficiencia.webp",
    contagem: { valor: fmt(quantidade), unidade: "temas publicados" },
    contagemIndice: { tipo: "simples", quantidade, unidade: "temas_publicados" },
    // painel Educação nos municípios (Serviços Públicos, 20/10/2026): abre a lista, porque responde à consulta pessoal do tema
    // (a escola pública da cidade do leitor); fora da contagem de temas da Eficiência Estatal, que ele não é
    paineis: [
      { titulo: TITULO_EDUCACAO, href: ROTA_EDUCACAO, descricao: PERGUNTA_EDUCACAO },
      ...publicadas.flatMap((d) => [{ titulo: d.titulo, href: d.href as string, descricao: d.descricao }, ...(d.id === "justica" ? [{ titulo: "Judiciário: filas e tempos", href: "/eficiencia-estatal/judiciario", descricao: "Despesas, filas e tempos em três ramos; 57 tribunais e comparação internacional WJP de acesso, demora e cumprimento, sem nota própria de eficiência." }] : [])]),
    ],
    fontes:
      "Tesouro (Siconfi), INEP, IBGE, Ministério da Saúde, MDS, Ministério das Cidades, CNJ, Sinesp e WJP, declaradas tema a tema, com a página de métodos de cada tema.",
    situacao:
      `O Ideb e as matrículas da escola pública de cada município, valores e referências por tema e um índice experimental de resultados nas 26 capitais, com memória de cálculo e testes de sensibilidade; sem conclusões sobre a gestão.` +
      (semPainel > 0 ? ` ${semPainel} temas do mapa ainda não têm painel publicado.` : ""),
  };
}

// ------------------------------------------------- Contas Públicas Federais

function vitrineContas(): Vitrine {
  const publicados = PAINEIS_COM_DADOS.length;
  const total = CAPITULOS.length;
  const paineis: { titulo: string; href: string; descricao: string }[] = PAINEIS_COM_DADOS.map(([id, rotulo]) => {
    const c = CAPITULOS.find((x) => x.id === id);
    if (!c) throw new Error(`capítulo das Contas Federais fora do catálogo: ${id}`);
    return { titulo: rotulo, href: `/contas-publicas/${id}`, descricao: c.pergunta };
  });
  // complemento do Panorama, não capítulo: entra entre os painéis, fora da contagem de capítulos com dados
  paineis.unshift({ titulo: PAINEL_AREAS.titulo, href: PAINEL_AREAS.href, descricao: PAINEL_AREAS.pergunta });
  // painel Previdência e INSS (20/10/2026): abre a lista, porque responde à consulta pessoal do tema (o INSS na cidade do leitor)
  paineis.unshift({ titulo: PAINEL_PREVIDENCIA.titulo, href: PAINEL_PREVIDENCIA.href, descricao: PAINEL_PREVIDENCIA.pergunta });
  return {
    id: "contas",
    imagem: "/home/contas.webp",
    contagem: { valor: `${publicados} de ${total}`, unidade: "capítulos com dados" },
    contagemIndice: { tipo: "parcial", publicados, total, unidade: "capitulos_com_dados" },
    paineis,
    situacao: `Orçamento, previdência e INSS, resultado fiscal, dívida, gastos tributários, restos a pagar, custos e entregas físicas com fonte e data em cada painel. Os outros ${CAPITULOS.length - PAINEIS_COM_DADOS.length} capítulos do desenho estão em preparação, fora da navegação.`,
    metodologia: { href: "/contas-publicas/metodologia", rotulo: "Metodologia" },
  };
}

// ------------------------------------------------ Contas Públicas Estaduais

function vitrineEstados(fmt: FormatarNumero): Vitrine {
  const c = primariosEstaduais.cobertura;
  const quantidade = c.ufs;
  const nIndicadores = (catalogoEstadual as { indicadores: unknown[] }).indicadores.length;
  const base = "/contas-publicas-estaduais";
  return {
    id: "estados",
    imagem: "/home/estados.webp",
    contagem: { valor: fmt(quantidade), unidade: "unidades da Federação" },
    contagemIndice: { tipo: "simples", quantidade, unidade: "unidades_federacao" },
    paineis: [
      { titulo: "Estados lado a lado", href: `${base}#comparacao`, descricao: `${MEDIDAS.length} medidas de execução, receita e despesa, com filtro por região.` },
      { titulo: "Ficha estadual", href: `${base}#ficha`, descricao: "Execução, condição fiscal, dívida, financiamento e composição da despesa." },
      { titulo: "Seis fichas de prova", href: `${base}#provas`, descricao: "PE, SP, MG, RS, AM e DF em ordem fixa, sem classificação de desempenho." },
      { titulo: "Cobertura", href: `${base}#cobertura`, descricao: `${fmt(c.observacoes)} observações reproduzidas de ${fmt(c.respostas)} respostas originais.` },
      { titulo: "Catálogo de indicadores", href: `${base}#catalogo`, descricao: `${nIndicadores} contratos preliminares com fórmula, fonte e ressalva.` },
      { titulo: "Método e fontes", href: `${base}#metodo`, descricao: "Respostas originais do Siconfi preservadas com data, consulta e SHA-256." },
    ],
    situacao: "Piloto. Indicadores de execução financeira; dados educacionais ainda não publicados.",
    metodologia: { href: `${base}#metodo`, rotulo: "Método e fontes" },
  };
}

// ------------------------------------------------ Saneamento

function vitrineSaneamento(): Vitrine {
  const comPainel = CAPITULOS_SANEAMENTO.filter((c) => c.situacao !== "em_preparacao");
  const publicados = comPainel.length;
  const total = CAPITULOS_SANEAMENTO.length;
  return {
    id: "saneamento",
    imagem: "/home/saneamento.webp",
    contagem: { valor: `${publicados} de ${total}`, unidade: "capítulos com dados" },
    contagemIndice: { tipo: "parcial", publicados, total, unidade: "capitulos_com_dados" },
    paineis: [
      ...comPainel.map((c) => ({ titulo: c.pergunta, href: rotaCapitulo(c), descricao: c.resumo })),
      { titulo: "Meu município", href: `${ROTA_SANEAMENTO}/municipio`, descricao: "Carência, prestador, regulador, plano, investimento e comparação com a UF." },
    ],
    situacao:
      "Primeira entrega. Capítulos com cobertura parcial declaram o que falta; tarifas em amostra de atos verificados; saúde e ambiente com três grupos de doenças e qualidade da água bruta em preparação.",
    metodologia: { href: `${ROTA_SANEAMENTO}/metodologia`, rotulo: "Método e fontes" },
  };
}

// ------------------------------------------------------------ Gás Natural

function vitrineGas(fmt: FormatarNumero): Vitrine {
  const meta = goldGas.meta();
  const orgaos = Array.from(new Set(meta.fontes.map((f) => f.orgao)));
  const quantidade = PAGINAS_GAS.length;
  return {
    id: "gas",
    imagem: "/home/gas.webp",
    focoImagem: "50% 22%",
    contagem: { valor: fmt(quantidade), unidade: "páginas por pergunta" },
    contagemIndice: { tipo: "simples", quantidade, unidade: "paginas_por_pergunta" },
    paineis: [
      ...PAGINAS_GAS.filter((p) => p.grupo !== "dados").map((p) => ({ titulo: p.rotulo, href: p.href, descricao: p.pergunta })),
      // coleção Combustíveis: painel próprio no Observatório de Energia e Infraestrutura, com a gold deste pipeline
      { titulo: "Combustíveis nos postos", href: ROTA_COMBUSTIVEIS, descricao: `${paginaCombustiveis("painel").pergunta} Coleção Combustíveis, pela mesma pesquisa de preços da ANP.` },
    ],
    fontes: `${fmt(meta.fontes.length)} conjuntos de ${listaPt(orgaos)}.`,
    metodologia: { href: "/gas-natural/dados", rotulo: "Dados e método" },
  };
}

export function vitrines(idioma: Idioma = "pt"): Record<DominioId, Vitrine> {
  const fmt = formatadorNumero(idioma, {}).format;
  return {
    credito: vitrineCredito(fmt),
    energia: vitrineEnergia(fmt),
    eficiencia: vitrineEficiencia(fmt),
    contas: vitrineContas(),
    estados: vitrineEstados(fmt),
    saneamento: vitrineSaneamento(),
    gas: vitrineGas(fmt),
    agro: {
      id: "agro",
      imagem: "/home/agro.svg",
      contagem: { valor: fmt(CAPITULOS_AGRO.length + PERGUNTAS_AGRO.length), unidade: "páginas por pergunta" },
      contagemIndice: { tipo: "simples", quantidade: CAPITULOS_AGRO.length + PERGUNTAS_AGRO.length, unidade: "paginas_por_pergunta" },
      paineis: [
        { titulo: "Tamanho na economia", href: "/agronegocio/tamanho", descricao: "Parcela da agropecuária no valor adicionado, crescimento em volume e peso nas exportações." },
        { titulo: "Conjuntura do ano", href: "/agronegocio/conjuntura", descricao: "Safra estimada pelo IBGE, ritmo trimestral, exportações do ano e crédito rural." },
        { titulo: "Insumos importados", href: "/agronegocio/insumos", descricao: "Fertilizantes e defensivos importados, valor por tonelada e relação com a soja exportada." },
        { titulo: "Mercados e dependência", href: "/agronegocio/mercados", descricao: "O que o agro exporta, para quais países, e de onde vêm os fertilizantes." },
        { titulo: "Produtores e trabalho", href: "/agronegocio/produtores", descricao: "Agricultura familiar e tamanho dos estabelecimentos no Censo Agro; ocupação e renda no campo." },
        { titulo: "Apoio público", href: "/agronegocio/apoio", descricao: "Juros do crédito rural por programa e subvenções pagas pelo Tesouro." },
        { titulo: "Desmatamento e emissões", href: "/agronegocio/ambiente", descricao: "Desmatamento PRODES por bioma, emissões do SEEG e uso da terra do MapBiomas." },
        { titulo: "Comida no prato", href: "/agronegocio/prato", descricao: "Inflação de alimentos, itens da cesta e segurança alimentar dos domicílios." },
      ],
      fontes: "IBGE, MDIC, BCB, Tesouro Nacional, INPE, SEEG e MapBiomas por coleta automática; BCB/MDCR, MTE/Novo Caged e IBGE por snapshots preservados na plataforma.",
      situacao: "Cobertura parcial: calendário agrícola, custos de referência da Conab, seguro rural e camadas ambientais territoriais ainda sem coleta validada. Explicações e cenários não substituem essas medições.",
      metodologia: { href: "/agronegocio/metodologia", rotulo: "Cobertura, fontes e método" },
    },
  };
}
