/**
 * Painel "Educação nos municípios" (Observatório dos Serviços Públicos, coleção Educação; aprovado pelo dono em
 * 20/10/2026): fonte única de rota, títulos, pergunta, seção de telemetria e textos de definição. Registro, navegação,
 * vitrine, camada aberta, "Para você", sitemap e páginas leem daqui.
 *
 * Princípio do aperitivo: o endereço público /educacao-municipal serve, sem sessão, a versão aperitivo
 * (src/app/aperitivo/educacao-municipal, por rewrite do middleware) e, com sessão, o painel completo
 * (src/app/educacao-municipal). APERITIVOS em src/lib/rotasPublicas.ts declara as duas.
 *
 * Relação com "Educação nas capitais" (Eficiência Estatal, /eficiencia-estatal/educacao-municipal-capitais): aquele é o
 * painel canônico da eficiência da rede municipal das 26 capitais (despesa por matrícula, alunos por turma, Ideb e Saeb
 * lado a lado com o gasto). Este cobre a rede pública dos municípios do país pelo resultado (Ideb, Saeb, aprovação) e
 * pelo tamanho da rede (Censo Escolar), sem análise de gasto; para uma capital, leva ao painel das capitais como
 * aprofundamento. O Ideb das capitais nos dois painéis sai das mesmas planilhas do INEP e é conferido igual
 * (pipeline/tests/test_educacao.py).
 *
 * O painel mantém pipeline e gold próprios (pipeline/educacao, public/educacao/gold) e a fonte de frescor "educacao"
 * (src/lib/frescor/limiares.json). Nomes de exibição sem hífen: a plataforma não usa hífen como pontuação.
 */
import type { Etapa, Motivo, Rede } from "./tipos";

export const ROTA_EDUCACAO = "/educacao-municipal";
export const VERSAO_ABERTA = "/aperitivo/educacao-municipal";
export const TITULO_PAINEL = "Educação nos municípios";
export const PERGUNTA_PAINEL = "Como está a escola pública em cada município?";
export const PERGUNTA_APERITIVO = "Como está a escola pública da minha cidade?";
export const SECAO_PAINEL = "servicos:educacao-municipal";
export const SECAO_APERITIVO = "servicos:educacao-municipal-aperitivo";
/** Painel canônico da eficiência da rede municipal das capitais (Eficiência Estatal). */
export const ROTA_CAPITAIS = "/eficiencia-estatal/educacao-municipal-capitais";
export const TITULO_CAPITAIS = "Educação nas capitais";

/** Endereço público com o município escolhido (a busca e a volta do login usam o mesmo). */
export const hrefMunicipio = (ibge: string) => `${ROTA_EDUCACAO}?ibge=${ibge}`;

export const hrefFichaMunicipio = (ibge: string) => `${ROTA_EDUCACAO}/municipio/${ibge}`;

export const NOME_ETAPA: Record<Etapa, string> = { ai: "Anos iniciais", af: "Anos finais" };
export const SERIES_ETAPA: Record<Etapa, string> = { ai: "1º ao 5º ano", af: "6º ao 9º ano" };
export const NOME_REDE: Record<Rede, string> = { municipal: "Rede municipal", publica: "Rede pública" };
export const DESCRICAO_REDE: Record<Rede, string> = {
  municipal: "escolas da prefeitura",
  publica: "escolas municipais, estaduais e federais juntas",
};

/** Por que não há Ideb da rede no ano mais recente: textos das notas do próprio INEP, em palavras de leigo. */
export const TEXTO_MOTIVO: Record<Motivo, string> = {
  sem_matricula: "A rede não tem alunos nesta etapa no Censo Escolar: na cidade, essa etapa fica com outra rede, em geral a estadual.",
  nao_divulgado: "O INEP não publicou Ideb desta rede nesta etapa: a rede não aparece na planilha de resultados.",
  participacao: "Poucos alunos fizeram a prova do Saeb, e o INEP não divulga o resultado quando a participação fica abaixo de 50% (ou abaixo de 80% quando só uma escola é avaliada).",
  a_pedido: "Resultado não divulgado a pedido da rede, como permitem as Portarias do INEP nº 410/2011 e nº 304/2013.",
  extravio: "Pelo menos 20% das provas se perderam, e a participação ficou insuficiente para divulgar o resultado.",
  sem_aprovacao: "Sem taxa de aprovação: o rendimento dos alunos não foi informado ao Censo Escolar.",
  sem_saeb: "Sem nota do Saeb divulgada para a rede neste ano: escolas com menos de 10 alunos na série avaliada, por exemplo, não fazem a prova.",
};
export const ROTULO_MOTIVO: Record<Motivo, string> = {
  sem_matricula: "Rede sem alunos na etapa",
  nao_divulgado: "Rede fora da planilha do INEP",
  participacao: "Participação insuficiente no Saeb",
  a_pedido: "Não divulgado a pedido",
  extravio: "Provas extraviadas",
  sem_aprovacao: "Sem taxa de aprovação",
  sem_saeb: "Sem nota do Saeb",
};

/** O que cada marca do INEP na nota do Saeb quer dizer (notas da planilha). */
export const TEXTO_MARCA: Record<string, string> = {
  ND: "participação insuficiente para divulgar",
  "ND*": "não divulgado a pedido",
  "ND***": "provas extraviadas",
  "*": "média calculada com as avaliações estaduais, por extravio de provas do Saeb",
  "**": "média dos alunos com participação abaixo de 50%, por extravio de provas",
};

/** Arquivos para baixar, servidos por rotas com conta ao lado do painel. */
export const DOWNLOADS = [
  { arquivo: "ideb-anos-iniciais-por-municipio.csv", rotulo: "Ideb e componentes por município, anos iniciais, desde 2005", descricao: "Rede municipal e rede pública, 1º ao 5º ano: Ideb, aprovação, notas do Saeb, N, P e meta" },
  { arquivo: "ideb-anos-finais-por-municipio.csv", rotulo: "Ideb e componentes por município, anos finais, desde 2005", descricao: "Rede municipal e rede pública, 6º ao 9º ano: Ideb, aprovação, notas do Saeb, N, P e meta" },
  { arquivo: "censo-escolar-por-municipio.csv", rotulo: "Matrículas e escolas por município", descricao: "Censo Escolar: matrículas por rede e etapa e escolas por rede" },
  { arquivo: "resumo-por-estado.csv", rotulo: "Resumo por estado", descricao: "Ideb da rede pública da UF, mediana das redes municipais e matrículas, por etapa" },
] as const;
