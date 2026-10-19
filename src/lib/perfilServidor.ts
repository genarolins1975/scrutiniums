import { z } from "zod";
import { MENSAGENS_PERFIL, errosPerfil, normalizarPerfil, type CampoPerfil, type PerfilNormalizado } from "./perfilOpcoes";

/**
 * Validação do perfil nas rotas de API (cadastro e conta), com a mesma regra
 * do formulário (errosPerfil em perfilOpcoes.ts). O servidor nunca confia no
 * cliente: perfil de uso e UF obrigatórios; tipo de instituição, área e cargo
 * obrigatórios só nos perfis profissionais e gravados como null nos demais.
 */
export const camposPerfil = {
  perfilUso: z.string(),
  orgType: z.string().nullish(),
  orgArea: z.string().nullish(),
  orgRole: z.string().nullish(),
  uf: z.string(),
};

/** Aplica a regra e troca os campos do perfil pela versão normalizada (para usar em .transform). */
export function comPerfilNormalizado<T extends Partial<Record<CampoPerfil, unknown>>>(
  dados: T,
  ctx: z.RefinementCtx<T>,
): Omit<T, CampoPerfil> & PerfilNormalizado {
  const perfil = normalizarPerfil(dados);
  if (!perfil) {
    for (const [campo, mensagem] of Object.entries(errosPerfil(dados))) ctx.addIssue({ code: "custom", path: [campo], message: mensagem });
    return z.NEVER;
  }
  return { ...dados, ...perfil };
}

/** Mensagem do primeiro campo de perfil recusado, para a resposta 400 dizer o que corrigir. */
export function mensagemPerfil(issues: readonly { path: readonly PropertyKey[] }[]): string | undefined {
  for (const issue of issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && Object.prototype.hasOwnProperty.call(MENSAGENS_PERFIL, campo)) return MENSAGENS_PERFIL[campo as CampoPerfil];
  }
  return undefined;
}
