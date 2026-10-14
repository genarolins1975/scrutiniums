/**
 * Vitrine da página inicial: o que cada observatório já publica.
 *
 * Nada aqui é escrito à mão quando existe registro no código. Títulos, rotas,
 * perguntas e contagens vêm dos catálogos de cada domínio (abas do Crédito,
 * navegação do Setor Elétrico, dimensões da Eficiência Estatal, capítulos das
 * Contas Federais, medidas e catálogo das Contas Estaduais). Um painel que sai
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
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { orgaosDasFontes } from "@/lib/energia/dados";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { CAPITULOS, PAINEIS_COM_DADOS } from "@/lib/contas-publicas/catalogo";
import { MEDIDAS } from "@/lib/contas-estaduais/comparacao";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import catalogoEstadual from "@/lib/contas-estaduais/catalogo.json";
import { CAPITULOS as CAPITULOS_SANEAMENTO, ROTA as ROTA_SANEAMENTO, rotaCapitulo } from "@/lib/saneamento/capitulos";

export type PainelVitrine = { titulo: string; href: string; descricao: string };

export type Vitrine = {
  id: DominioId;
  /** Recorte da gravura editorial do próprio observatório (public/home). */
  imagem: string;
  /** Contagem principal, com a unidade própria de cada observatório. */
  contagem: { valor: string; unidade: string };
  paineis: PainelVitrine[];
  /** Fontes ao pé da lista; ausente quando a atualidade do observatório já as nomeia. */
  fontes?: string;
  /** Ressalva de escopo ou maturidade, exibida junto da vitrine. */
  situacao?: string;
  /** Página de método do observatório; ausente quando o método fica dentro de cada tema. */
  metodologia?: { href: string; rotulo: string };
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

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

function vitrineCredito(): Vitrine {
  const temas = ABAS_OBSERVATORIO.filter((a) => !a.caminho.endsWith("/") && !ABAS_INSTITUCIONAIS.has(a.caminho));
  const nFontes = fontesCredito();
  return {
    id: "credito",
    imagem: "/home/credito.webp",
    contagem: { valor: fmt(temas.length), unidade: "páginas temáticas" },
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

function vitrineEnergia(): Vitrine {
  const publicados = DESTINOS_NAVEGACAO.filter((d) => d.publicado);
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
    contagem: { valor: fmt(publicados.length), unidade: "seções publicadas" },
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

function vitrineEficiencia(): Vitrine {
  const publicadas = DIMENSOES.filter((d) => d.href);
  const semPainel = DIMENSOES.length - publicadas.length;
  return {
    id: "eficiencia",
    imagem: "/home/eficiencia.webp",
    contagem: { valor: fmt(publicadas.length), unidade: "temas publicados" },
    paineis: publicadas.map((d) => ({ titulo: d.titulo, href: d.href as string, descricao: d.descricao })),
    fontes:
      "Tesouro (Siconfi), INEP, IBGE, Ministério da Saúde, MDS, Ministério das Cidades, CNJ e Sinesp, declaradas tema a tema, com a página de métodos de cada tema.",
    situacao:
      `Valores e referências por tema e um índice experimental de resultados nas 26 capitais, com memória de cálculo e testes de sensibilidade; sem conclusões sobre a gestão.` +
      (semPainel > 0 ? ` ${semPainel} temas do mapa ainda não têm painel publicado.` : ""),
  };
}

// ------------------------------------------------- Contas Públicas Federais

function vitrineContas(): Vitrine {
  const paineis = PAINEIS_COM_DADOS.map(([id, rotulo]) => {
    const c = CAPITULOS.find((x) => x.id === id);
    if (!c) throw new Error(`capítulo das Contas Federais fora do catálogo: ${id}`);
    return { titulo: rotulo, href: `/contas-publicas/${id}`, descricao: c.pergunta };
  });
  return {
    id: "contas",
    imagem: "/home/contas.webp",
    contagem: { valor: `${PAINEIS_COM_DADOS.length} de ${CAPITULOS.length}`, unidade: "capítulos com dados" },
    paineis,
    situacao: `Projeto metodológico: os outros ${CAPITULOS.length - PAINEIS_COM_DADOS.length} capítulos apresentam o método proposto, ainda sem série publicada.`,
    metodologia: { href: "/contas-publicas/metodologia", rotulo: "Metodologia" },
  };
}

// ------------------------------------------------ Contas Públicas Estaduais

function vitrineEstados(): Vitrine {
  const c = primariosEstaduais.cobertura;
  const nIndicadores = (catalogoEstadual as { indicadores: unknown[] }).indicadores.length;
  const base = "/contas-publicas-estaduais";
  return {
    id: "estados",
    imagem: "/home/estados.webp",
    contagem: { valor: fmt(c.ufs), unidade: "unidades da Federação" },
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
  return {
    id: "saneamento",
    imagem: "/home/saneamento.webp",
    contagem: { valor: `${comPainel.length} de ${CAPITULOS_SANEAMENTO.length}`, unidade: "capítulos com dados" },
    paineis: [
      ...comPainel.map((c) => ({ titulo: c.pergunta, href: rotaCapitulo(c), descricao: c.resumo })),
      { titulo: "Meu município", href: `${ROTA_SANEAMENTO}/municipio`, descricao: "Carência, prestador, regulador, plano, investimento e comparação com a UF." },
    ],
    situacao:
      "Primeira entrega. Capítulos com cobertura parcial declaram o que falta; preço regulado em amostra de atos verificados; saúde, ambiente e desigualdades em preparação.",
    metodologia: { href: `${ROTA_SANEAMENTO}/metodologia`, rotulo: "Método e fontes" },
  };
}

export function vitrines(): Record<DominioId, Vitrine> {
  return {
    credito: vitrineCredito(),
    energia: vitrineEnergia(),
    eficiencia: vitrineEficiencia(),
    contas: vitrineContas(),
    estados: vitrineEstados(),
    saneamento: vitrineSaneamento(),
  };
}
