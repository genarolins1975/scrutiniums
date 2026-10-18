/**
 * Os seis observatórios: identidade e coleções, sem leitura de catálogo.
 * Arquivo leve, importável por componentes do navegador e pela promessa de
 * acesso (src/lib/acesso.ts). A posse de cada painel fica em registro.ts.
 */
import type { Dominio, DominioId } from "@/lib/dominios";

export type ObservatorioId =
  | "familias" | "servicos-publicos" | "contas-publicas" | "energia-e-infraestrutura" | "economia" | "territorio-e-clima";

export type Colecao = {
  id: string;
  nome: string;
  /** Porta de entrada da coleção (painel com conta). */
  href: string;
};

export type Observatorio = {
  id: ObservatorioId;
  nome: string;
  nomeCurto: string;
  /** Pergunta que o observatório responde, usada na home, na página aberta e na escolha pós login. */
  pergunta: string;
  /** Entrada com conta do observatório, quando ele já tem uma (src/app/observatorios/[id]). */
  entrada?: string;
  acento: Dominio["acento"];
  colecoes: Colecao[];
};

export type Painel = {
  rota: string;
  titulo: string;
  observatorio: ObservatorioId;
  colecao: string;
  /** Domínio de origem, que mantém a rota, a gold e o cabeçalho; null quando o próprio observatório mantém o painel (Território e Clima). */
  origem: DominioId | null;
  /** Outro painel que trata do mesmo tema; a escolha do dono depende de comparar os conteúdos. */
  duplicataDe?: string;
};

export type Atalho = { rota: string; observatorio: ObservatorioId; colecao: string };

export const OBSERVATORIOS: Observatorio[] = [
  {
    id: "familias",
    nome: "Observatório das Famílias",
    nomeCurto: "Famílias",
    pergunta: "Quanto custa viver e quanto pesa a dívida das famílias?",
    entrada: "/observatorios/familias",
    acento: "bronze",
    colecoes: [
      { id: "renda", nome: "Renda e trabalho", href: "/eficiencia-estatal/trabalho-renda" },
      { id: "divida", nome: "Dívida e crédito das famílias", href: "/observatorio/payroll-lending-aging" },
      { id: "protecao", nome: "Proteção social", href: "/eficiencia-estatal/assistencia-social" },
      { id: "moradia", nome: "Moradia", href: "/eficiencia-estatal/habitacao" },
      { id: "custo-de-vida", nome: "Custo de vida", href: "/agronegocio/prato" },
    ],
  },
  {
    id: "servicos-publicos",
    nome: "Observatório dos Serviços Públicos",
    nomeCurto: "Serviços Públicos",
    pergunta: "Escola, saúde, segurança e justiça chegam a quem precisa?",
    entrada: "/observatorios/servicos-publicos",
    acento: "obee",
    colecoes: [
      { id: "educacao", nome: "Educação", href: "/eficiencia-estatal/educacao-municipal-capitais" },
      { id: "saude", nome: "Saúde", href: "/eficiencia-estatal/saude-capitais" },
      { id: "seguranca", nome: "Segurança pública", href: "/eficiencia-estatal/seguranca-publica" },
      { id: "justica", nome: "Justiça", href: "/eficiencia-estatal/judiciario" },
      { id: "cultura", nome: "Cultura", href: "/eficiencia-estatal/cultura" },
      { id: "sintese", nome: "Síntese das capitais", href: "/eficiencia-estatal" },
    ],
  },
  {
    id: "contas-publicas",
    nome: "Observatório das Contas Públicas",
    nomeCurto: "Contas Públicas",
    pergunta: "De onde vem e para onde vai o dinheiro dos impostos?",
    entrada: "/observatorios/contas-publicas",
    acento: "energia",
    colecoes: [
      { id: "federais", nome: "Contas Federais", href: "/contas-publicas" },
      { id: "estaduais", nome: "Contas Estaduais", href: "/contas-publicas-estaduais" },
      { id: "divida-governos", nome: "Dívida e crédito dos governos", href: "/observatorio/subnational-credit" },
    ],
  },
  {
    id: "energia-e-infraestrutura",
    nome: "Observatório de Energia e Infraestrutura",
    nomeCurto: "Energia e Infraestrutura",
    pergunta: "De onde vêm a energia e a água, e quanto custam?",
    entrada: "/observatorios/energia-e-infraestrutura",
    acento: "energia",
    colecoes: [
      { id: "setor-eletrico", nome: "Setor Elétrico", href: "/setor-eletrico" },
      { id: "gas", nome: "Gás Natural", href: "/gas-natural" },
      { id: "saneamento", nome: "Saneamento", href: "/saneamento" },
      { id: "mobilidade", nome: "Mobilidade", href: "/eficiencia-estatal/mobilidade-transporte" },
      { id: "conectividade", nome: "Conectividade", href: "/eficiencia-estatal/energia-conectividade" },
    ],
  },
  {
    id: "economia",
    nome: "Observatório da Economia",
    nomeCurto: "Economia",
    pergunta: "O que o Brasil produz, vende ao mundo e financia?",
    entrada: "/observatorios/economia",
    acento: "gas",
    colecoes: [
      { id: "credito", nome: "Crédito e sistema financeiro", href: "/observatorio" },
      { id: "pagamentos", nome: "Pagamentos", href: "/observatorio/pix" },
      { id: "empresas", nome: "Empresas e risco", href: "/observatorio/sectors" },
      { id: "agro", nome: "Agronegócio", href: "/agronegocio" },
    ],
  },
  {
    id: "territorio-e-clima",
    nome: "Observatório do Território e Clima",
    nomeCurto: "Território e Clima",
    pergunta: "O que está mudando no ambiente e quem sente primeiro?",
    entrada: "/observatorios/territorio-e-clima",
    acento: "obee",
    colecoes: [
      { id: "desmatamento", nome: "Desmatamento e emissões", href: "/agronegocio/ambiente" },
      { id: "cidades-clima", nome: "Cidades e clima", href: "/eficiencia-estatal/meio-ambiente-clima" },
      { id: "fogo", nome: "Fogo e queimadas", href: "/territorio/queimadas" },
      { id: "desastres", nome: "Desastres", href: "/territorio/desastres" },
    ],
  },
];

/**
 * Observatório em que está o núcleo de cada domínio de origem. O Crédito
 * alimenta também Famílias e Contas Públicas, e o Agronegócio também Famílias
 * e Território e Clima (registro.ts); aqui fica onde a coleção inteira é
 * apresentada: cabeçalhos dos painéis, seletor e escolha pós login.
 */
export const OBSERVATORIO_PRINCIPAL: Record<DominioId, ObservatorioId> = {
  credito: "economia",
  agro: "economia",
  energia: "energia-e-infraestrutura",
  gas: "energia-e-infraestrutura",
  saneamento: "energia-e-infraestrutura",
  eficiencia: "servicos-publicos",
  contas: "contas-publicas",
  estados: "contas-publicas",
};

/** Destino de um observatório para quem tem conta: a entrada própria ou a sua seção na escolha pós login. */
export function destinoObservatorio(o: Observatorio): string {
  return o.entrada ?? `/app/observatorios#obs-${o.id}`;
}

/**
 * Allowlist da escolha por observatório na tela pós login: a coleção pedida
 * ou, sem coleção, a entrada própria do observatório. Nunca aceita destino
 * arbitrário; sem correspondência no registro, devolve undefined.
 */
export function escolhaObservatorio(obs: unknown, colecao: unknown): { observatorio: Observatorio; href: string } | undefined {
  const o = typeof obs === "string" ? OBSERVATORIOS.find((x) => x.id === obs) : undefined;
  if (!o) return undefined;
  if (colecao === null || colecao === undefined || colecao === "") return o.entrada ? { observatorio: o, href: o.entrada } : undefined;
  const c = typeof colecao === "string" ? o.colecoes.find((x) => x.id === colecao) : undefined;
  return c ? { observatorio: o, href: c.href } : undefined;
}

