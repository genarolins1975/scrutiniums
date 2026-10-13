/**
 * Fonte única da promessa de acesso e do escopo da plataforma.
 *
 * O que o código garante (src/middleware.ts e src/lib/rotasPublicas.ts): a
 * página inicial, a apresentação do Crédito, as páginas de método e glossário,
 * as institucionais e o fluxo de entrada e cadastro são públicas. Painéis,
 * downloads, API, feeds e gráficos incorporáveis exigem conta gratuita com
 * telefone verificado (decisão de produto de 13/10/2026; até então a leitura
 * era aberta).
 *
 * Toda página e metadado que fala de acesso, conta ou da quantidade de
 * observatórios lê daqui; src/tests/acesso-invariantes.test.ts reprova a
 * promessa antiga de leitura sem cadastro e qualquer contagem divergente do
 * registro.
 */
import { DOMINIOS } from "@/lib/dominios";

const EXTENSO: Record<number, string> = { 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove" };

export const N_OBSERVATORIOS = DOMINIOS.length;

/** "cinco observatórios" (ou "Cinco observatórios" com `maiuscula`). */
export function observatoriosPorExtenso(maiuscula = false): string {
  const n = EXTENSO[N_OBSERVATORIOS] ?? String(N_OBSERVATORIOS);
  const s = `${n} observatórios`;
  return maiuscula ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais e Contas Públicas Estaduais". */
export function listaObservatorios(): string {
  const nomes = DOMINIOS.map((d) => d.nomeCurto);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes.join("");
}

export const ACESSO = {
  /** Selo curto, para rodapé e metadados. */
  curto: "Painéis com cadastro gratuito.",
  /** Regra de acesso aos painéis. */
  leitura: "Os painéis dos observatórios são abertos a quem tem conta. O cadastro é gratuito e sem cobrança.",
  /**
   * O que a conta dá, apenas com o que existe no código: acesso aos painéis e
   * arquivos (middleware), a inscrição no boletim mensal da central de alertas
   * (Conta → Boletim mensal, src/lib/boletim.ts) e a gestão de senha, sessões e
   * consentimentos (/app/conta).
   */
  conta:
    "Com a conta, você acessa todos os painéis, downloads e arquivos de dados, pode se inscrever no boletim mensal " +
    "da central de alertas do crédito e administra senha, sessões e consentimentos.",
  /** Rótulo do botão de cadastro. */
  ctaConta: "Criar conta gratuita",
} as const;
