/**
 * Caminho de volta de um painel ao Aprenda (P066). Os links do Aprenda acrescentam
 * ?volta=trilha:<id>:<passo> ou ?volta=verbete:<slug>; RetornoContexto lê o parâmetro e
 * usa estas regras para montar o destino e o texto do botão. Sem dependências: roda no
 * navegador.
 */
export type RotulosRetorno = {
  /** slug → nome curto do verbete (sigla ou nome). */
  verbetes: Record<string, string>;
  /** id → título da trilha e títulos dos passos, na ordem. */
  trilhas: Record<string, { titulo: string; passos: string[] }>;
};

export type DestinoRetorno = { href: string; texto: string };

export const CHAVE_RETORNO = "scrutiniums:energia:volta";

export function destinoDaVolta(volta: string, rotulos: RotulosRetorno): DestinoRetorno | null {
  const [tipo, a, b] = volta.split(":");
  if (tipo === "verbete" && a && rotulos.verbetes[a]) return { href: `/setor-eletrico/aprenda/${a}#exemplo`, texto: `Voltar ao verbete ${rotulos.verbetes[a]}` };
  if (tipo === "trilha" && a && rotulos.trilhas[a]) {
    const t = rotulos.trilhas[a];
    const i = b ? t.passos.indexOf(b) : -1;
    return {
      href: `/setor-eletrico/aprenda/trilhas/${a}${i >= 0 ? `#passo-${b}` : ""}`,
      texto: `Voltar à trilha ${t.titulo}${i >= 0 ? `, passo ${i + 1}` : ""}`,
    };
  }
  return null;
}
