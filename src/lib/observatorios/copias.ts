/**
 * Painel principal de cada tema que aparece em mais de um endereço (achado A8
 * da banca de 19/10/2026, docs/BANCA_2026-10-19.md, Onda 1).
 *
 * Regras:
 * 1. Nenhuma cópia é apagada: a página continua publicada, com o seu conteúdo.
 * 2. Toda cópia mostra o aviso <PainelPrincipal rota="..."/>, que lê esta
 *    tabela; o texto, o link e o desenho são os mesmos em todas as cópias.
 * 3. O registro (registro.ts) marca como duplicata (`duplicataDe`) o painel
 *    registrado que é cópia integral; cópia parcial (uma seção da página) não
 *    sai das listas, porque o resto da página é próprio.
 * 4. O teste observatorios-copias.test.ts percorre o registro e esta tabela e
 *    reprova cópia sem aviso, principal inexistente ou cadeia de cópias.
 *
 * Arquivo leve, sem leitura de catálogo: importável por qualquer página.
 */
export type Copia = {
  /** Endereço da cópia. */
  rota: string;
  /** Endereço do painel principal do tema. */
  principal: string;
  /** Nome do painel principal, como aparece no link. */
  titulo: string;
  /** Onde o painel principal está, como complemento do link ("na coleção Saneamento"). */
  onde: string;
  /** O que o painel principal tem e a cópia não, ou como as duas fontes diferem. */
  texto: string;
  /** Tema, quando a cópia ocupa só parte da página ("emissões de gases de efeito estufa"). */
  tema?: string;
  /** A cópia é uma seção da página; o resto da página é próprio. */
  parcial?: boolean;
};

const SANEAMENTO = "na coleção Saneamento";
const CIDADES_CLIMA = "na coleção Cidades e clima, do Observatório do Território e Clima";
const EMISSOES_OFICIAIS = "no Observatório do Território e Clima";

export const COPIAS: Copia[] = [
  // Saneamento: o painel principal é o Observatório Brasileiro do Saneamento, por município.
  {
    rota: "/eficiencia-estatal/saneamento",
    principal: "/saneamento",
    titulo: "Saneamento",
    onde: SANEAMENTO,
    texto:
      "Mesma publicação do SINISA, por município, com o Censo 2022, os prestadores, as tarifas, o investimento e a ficha de cada município. Esta página resume água, esgoto e recursos por Brasil, regiões e UF; resíduos e drenagem, que o painel principal não trata, têm o painel principal em Meio ambiente e clima.",
  },
  {
    rota: "/eficiencia-estatal/saneamento/agua",
    principal: "/saneamento/acesso",
    titulo: "Sem atendimento",
    onde: SANEAMENTO,
    texto: "Mesmos indicadores do SINISA, com acesso à água por município, Censo 2022 e SINISA 2024, com ficha de cada município.",
  },
  {
    rota: "/eficiencia-estatal/saneamento/esgoto",
    principal: "/saneamento/esgoto",
    titulo: "Destino do esgoto",
    onde: SANEAMENTO,
    texto: "Mesmos indicadores do SINISA, com esgoto por município, do Censo 2022 e do SINISA 2024, com ficha de cada município.",
  },
  {
    rota: "/eficiencia-estatal/saneamento/recursos",
    principal: "/saneamento/investimento",
    titulo: "Onde o investimento chega",
    onde: SANEAMENTO,
    texto: "Mesmos indicadores do SINISA, com investimento por município e por prestador.",
  },
  {
    rota: "/eficiencia-estatal/saneamento/dados",
    principal: "/saneamento/metodologia",
    titulo: "Método e fontes",
    onde: SANEAMENTO,
    texto:
      "Fontes com data e SHA-256, conferências entre bases e limitações do painel principal. Os arquivos desta página cobrem só o recorte por Brasil, regiões e UF.",
  },
  // Drenagem e resíduos: clima fica no Território e Clima, na coleção Cidades e clima.
  {
    rota: "/eficiencia-estatal/saneamento/drenagem",
    principal: "/eficiencia-estatal/meio-ambiente-clima",
    titulo: "Meio ambiente e clima",
    onde: CIDADES_CLIMA,
    texto:
      "Os mesmos quatro indicadores de drenagem do SINISA, lidos como exposição a inundações e prevenção, ao lado dos painéis de desastres, queimadas e emissões.",
  },
  {
    rota: "/eficiencia-estatal/saneamento/residuos",
    principal: "/eficiencia-estatal/meio-ambiente-clima/residuos",
    titulo: "Meio ambiente e clima: pressões ambientais",
    onde: CIDADES_CLIMA,
    texto: "Os mesmos três indicadores de resíduos do SINISA. O tema fica na coleção Cidades e clima, ao lado de drenagem, desastres, queimadas e emissões.",
  },
  // Emprego formal: o painel principal é o do Crédito, com série mais longa.
  {
    rota: "/eficiencia-estatal/trabalho-renda/emprego-formal",
    principal: "/observatorio/formal-employment",
    titulo: "Emprego formal",
    onde: "na coleção Crédito",
    texto:
      "Mesma fonte (Novo Caged, Banco Central), com série mais longa, ajuste sazonal, admissões e desligamentos, as 21 seções de atividade e as 27 UFs. As capturas podem diferir em um mês.",
  },
  // Energia: o Setor Elétrico aprofunda acesso, Tarifa Social e qualidade.
  {
    rota: "/eficiencia-estatal/energia-conectividade",
    principal: "/setor-eletrico/inclusao-energetica",
    titulo: "Inclusão energética",
    onde: "na coleção Setor Elétrico",
    texto:
      "Os números de energia desta página vêm das mesmas bases do Setor Elétrico, que aprofunda acesso, Tarifa Social, qualidade do serviço e conta de luz por distribuidora, UF e município. O uso da internet fica aqui.",
  },
  // Emissões: a série principal é o inventário oficial (MCTI, SIRENE); o SEEG é explicado onde aparece.
  {
    rota: "/agronegocio/ambiente",
    principal: "/territorio/emissoes",
    titulo: "Emissões pelo inventário oficial",
    onde: EMISSOES_OFICIAIS,
    tema: "emissões de gases de efeito estufa",
    parcial: true,
    texto:
      "A série principal é o inventário oficial do governo (MCTI, SIRENE), referência da meta climática do Brasil, publicado com alguns anos de defasagem. Os números desta seção são do SEEG, estimativa da sociedade civil que chega a anos mais recentes, com dados de atividade e regras próprias para o uso da terra. As duas séries não se somam nem se emendam.",
  },
  {
    rota: "/agronegocio/clima-ambiente",
    principal: "/territorio/emissoes",
    titulo: "Emissões pelo inventário oficial",
    onde: EMISSOES_OFICIAIS,
    tema: "emissões de gases de efeito estufa",
    parcial: true,
    texto:
      "A série principal é o inventário oficial do governo (MCTI, SIRENE). O número de emissões deste capítulo é do SEEG, estimativa da sociedade civil, e não se soma nem se emenda à série oficial.",
  },
  // Justiça: Defensorias em Acesso à Justiça; tempos dos processos no Judiciário.
  {
    rota: "/eficiencia-estatal/judiciario/acesso",
    principal: "/eficiencia-estatal/acesso-justica/cobertura",
    titulo: "Cobertura das Defensorias",
    onde: "em Acesso à Justiça",
    tema: "assistência jurídica e Defensorias",
    parcial: true,
    texto:
      "Cobertura regular, parcial e ausente das Defensorias por comarca, com consulta por UF, e os recursos das Defensorias. Este capítulo mostra o que o Judiciário publica: centros de solução de conflitos e Justiça gratuita.",
  },
  {
    rota: "/eficiencia-estatal/acesso-justica/tempo-resposta",
    principal: "/eficiencia-estatal/judiciario/tempo",
    titulo: "Tempo de resposta",
    onde: "no painel do Judiciário",
    texto:
      "Mesma fonte (CNJ, Justiça em Números), com os três ramos de Justiça, o tempo da execução em cada tribunal e a evolução dos tempos de cada tribunal nas edições anteriores do relatório.",
  },
];

/** A cópia registrada para um endereço, ou undefined. */
export function copiaDe(rota: string): Copia | undefined {
  return COPIAS.find((c) => c.rota === rota);
}
