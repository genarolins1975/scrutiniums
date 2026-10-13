import { type Institucional, INSTITUCIONAL, preenchido } from "./institucional";

/** Contato profissional do responsável pela plataforma (fonte única). */
export const LINKEDIN_URL = "https://www.linkedin.com/in/genaro-dueire-lins-40b88025/";

export type Contato = { principal: { rotulo: string; href: string }; secundario: { rotulo: string; href: string } | null };

/** E-mail institucional quando preenchido; o LinkedIn passa a secundário. */
export function contato(inst: Institucional = INSTITUCIONAL): Contato {
  const linkedin = { rotulo: "LinkedIn do responsável", href: LINKEDIN_URL };
  if (preenchido(inst.email_institucional)) {
    return { principal: { rotulo: inst.email_institucional, href: `mailto:${inst.email_institucional}` }, secundario: linkedin };
  }
  return { principal: { rotulo: "LinkedIn do responsável", href: LINKEDIN_URL }, secundario: null };
}
