/**
 * Fonte única da promessa de acesso e do escopo da plataforma.
 *
 * O que o código garante (src/middleware.ts): todas as páginas dos observatórios,
 * a SPA do crédito em /observatorio e /obs, /resumo, /dados e as páginas
 * institucionais são públicas. Só /app (conta, escolha de observatório e
 * administração) exige sessão. Até 13/10/2026 a home e o rodapé diziam "conta
 * opcional" enquanto /resumo, /dados e o formulário de cadastro diziam que o
 * cadastro era "a única exigência", e o layout falava em três observatórios com
 * cinco no registro.
 *
 * Toda página e metadado que fala de acesso, conta ou da quantidade de
 * observatórios lê daqui; src/tests/acesso-invariantes.test.ts reprova a frase
 * antiga e qualquer contagem divergente do registro.
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
  curto: "Leitura aberta, sem cadastro.",
  /** O que a conta não é. */
  leitura: "Todos os observatórios são abertos para leitura, sem cadastro e sem cobrança.",
  /**
   * O que a conta dá, apenas com o que existe no código: a inscrição no boletim
   * mensal da central de alertas (Conta → Boletim mensal, src/lib/boletim.ts) e a
   * gestão de senha, sessões e consentimentos (/app/conta).
   */
  conta:
    "A conta é opcional e gratuita. Com ela, você se inscreve no boletim mensal da central de alertas do crédito, " +
    "enviado por e-mail, e administra senha, sessões e consentimentos.",
  /** Rótulo do botão de cadastro. */
  ctaConta: "Criar conta gratuita",
} as const;
