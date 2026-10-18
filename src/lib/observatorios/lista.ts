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
  acento: Dominio["acento"];
  colecoes: Colecao[];
};

export type Painel = {
  rota: string;
  titulo: string;
  observatorio: ObservatorioId;
  colecao: string;
  /** Domínio de origem, que mantém a rota, a gold e o cabeçalho. */
  origem: DominioId;
  /** Outro painel que trata do mesmo tema; a escolha do dono depende de comparar os conteúdos. */
  duplicataDe?: string;
};

export type Atalho = { rota: string; observatorio: ObservatorioId; colecao: string };

export const OBSERVATORIOS: Observatorio[] = [
  {
    id: "familias",
    nome: "Observatório das Famílias",
    nomeCurto: "Famílias",
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
    acento: "obee",
    colecoes: [
      { id: "desmatamento", nome: "Desmatamento e emissões", href: "/agronegocio/ambiente" },
      { id: "cidades-clima", nome: "Cidades e clima", href: "/eficiencia-estatal/meio-ambiente-clima" },
    ],
  },
];
