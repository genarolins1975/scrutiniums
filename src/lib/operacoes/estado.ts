/** Somente servidor. O navegador nunca recebe tokens do GitHub ou a lista de administradores. */
import { readFile } from "node:fs/promises";
import { CATALOGO, esquemaEstado, type LeituraEstado } from "./modelo";

const URL_ESTADO = `https://github.com/${CATALOGO.repositorio}/releases/download/${CATALOGO.release}/${CATALOGO.ativo}`;
export async function lerEstadoOperacoes(): Promise<LeituraEstado> {
  try {
    let texto: string;
    // Fixture de auditoria isolada; indisponível na Vercel. Nunca é parâmetro de URL ou formulário.
    if (!process.env.VERCEL && process.env.OPERACOES_ESTADO_LOCAL) {
      texto = await readFile(process.env.OPERACOES_ESTADO_LOCAL, "utf8");
    } else {
      const r = await fetch(URL_ESTADO, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error("Monitor indisponível");
      texto = await r.text();
    }
    if (texto.length > 1_000_000) throw new Error("Resposta maior que o contrato");
    return { estado: esquemaEstado.parse(JSON.parse(texto)), aviso: null };
  } catch {
    return { estado: null, aviso: "Não foi possível consultar o monitor. As datas abaixo continuam sendo as desta publicação; confira as execuções no GitHub e tente atualizar a página." };
  }
}
