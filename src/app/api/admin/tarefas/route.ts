import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { esquemaEdicao, salvarTarefa } from "@/lib/operacoes/tarefas";
import { tarefasSugeridas } from "@/lib/operacoes/modelo";
import { lerEstadoOperacoes } from "@/lib/operacoes/estado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resposta = (dados: unknown, status = 200) => NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return resposta({ error: "Acesso negado." }, 403);
  // Origin obrigatório, inclusive com sessão válida. Host encaminhado só no proxy de confiança.
  const host = (process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1")
    ? req.headers.get("x-forwarded-host") ?? req.headers.get("host") : req.headers.get("host");
  try {
    const bruto = req.headers.get("origin") ?? "";
    const origem = new URL(bruto);
    if (origem.origin !== bruto || !["http:", "https:"].includes(origem.protocol) || origem.host !== host) throw new Error();
  } catch { return resposta({ error: "Origem da solicitação inválida." }, 403); }
  let texto = "";
  try {
    const leitor = req.body?.getReader();
    if (!leitor) throw new Error();
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 16_384) { await leitor.cancel(); return resposta({ error: "Texto maior que o limite." }, 413); }
      partes.push(value);
    }
    texto = Buffer.concat(partes).toString("utf8");
  } catch { return resposta({ error: "Não foi possível ler os dados." }, 400); }
  const entrada = esquemaEdicao.safeParse((() => { try { return JSON.parse(texto); } catch { return null; } })());
  if (!entrada.success) return resposta({ error: "Confira o título, o prazo e os limites dos campos." }, 400);
  try {
    const { estado } = entrada.data.id ? await lerEstadoOperacoes() : { estado: null };
    const r = await salvarTarefa(user.id, entrada.data, tarefasSugeridas(estado));
    if (r.tipo === "invalida") return resposta({ error: "Tarefa não encontrada. Atualize a página." }, 400);
    if (r.tipo === "conflito") return resposta({ error: "Esta tarefa mudou em outra sessão. Atualize a página antes de salvar novamente." }, 409);
    return resposta({ tarefa: r.tarefa });
  } catch { return resposta({ error: "Não foi possível salvar. Seu texto foi mantido; tente novamente." }, 503); }
}
