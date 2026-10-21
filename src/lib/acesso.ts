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
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { pt } from "@/i18n/pt";
import { fmtNumber } from "@/lib/format";
import type { Idioma } from "@/lib/idioma";

const EXTENSO: Record<number, string> = { 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove" };
// Representação lexical da quantidade; a mensagem completa pertence ao catálogo.
const EXTENSO_EN: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine" };

/** Os seis observatórios do reagrupamento de 17/10/2026; os oito domínios antigos são coleções dentro deles. */
export const N_OBSERVATORIOS = OBSERVATORIOS.length;

/** "cinco observatórios" (ou "Cinco observatórios" com `maiuscula`). */
export function observatoriosPorExtenso(maiuscula = false, idioma: Idioma = "pt"): string {
  if (idioma === "en") {
    const n = EXTENSO_EN[N_OBSERVATORIOS] ?? fmtNumber(N_OBSERVATORIOS, 0, idioma);
    const s = `${n} ${N_OBSERVATORIOS === 1 ? "observatory" : "observatories"}`;
    return maiuscula ? s[0].toUpperCase() + s.slice(1) : s;
  }
  const n = EXTENSO[N_OBSERVATORIOS] ?? String(N_OBSERVATORIOS);
  const s = `${n} observatórios`;
  return maiuscula ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "Famílias, Serviços Públicos, Contas Públicas, Energia e Infraestrutura, Economia e Território e Clima". */
export function listaObservatorios(idioma: Idioma = "pt"): string {
  const nomes = OBSERVATORIOS.map((o) => o.nomeCurto);
  const e = idioma === "en" ? "and" : "e";
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} ${e} ${nomes.at(-1)}` : nomes.join("");
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
   * consentimentos (/app/conta), o recorte salvo e compartilhável e o pacote
   * para citar (barra dos painéis, src/components/conta/FerramentasConta.tsx).
   * O alerta de atualização fica fora desta promessa enquanto o envio por
   * e-mail não estiver ligado (src/lib/conta/alertas.ts, envioLigado).
   */
  conta:
    "Com a conta, você acessa todos os painéis, downloads e arquivos de dados, salva recortes que pode compartilhar, " +
    "copia a citação de cada página (ABNT, BibTeX e RIS), pode se inscrever no boletim mensal " +
    "da central de alertas do crédito e administra senha, sessões e consentimentos.",
  /** Rótulo do botão de cadastro. */
  ctaConta: pt["acesso.criar_conta"],
} as const;
