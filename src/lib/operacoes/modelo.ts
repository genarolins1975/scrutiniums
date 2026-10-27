import { z } from "zod";
import catalogo from "../../../config/operacoes.json";
import { fmtDateTime } from "@/lib/format";
import { dataPublicacao, instante, cadenciaDe, definicao, extrairFrescor, IDS_DOMINIOS, situacaoDominio, type DominioFrescorId } from "@/lib/frescor/regras";

export const CATALOGO = catalogo;
export const GITHUB = `https://github.com/${catalogo.repositorio}`;
const data = z.string().datetime({ offset: true });
const link = z.string().url().refine((s) => s.startsWith(`${GITHUB}/`) && !s.includes("@"));
export const esquemaEstado = z.object({
  versao: z.literal(1), repositorio: z.literal("genarolins1975/scrutiniums"), geradoEm: data,
  execucoes: z.array(z.object({ workflow: z.enum(Object.keys(catalogo.workflows) as [string, ...string[]]),
    id: z.number().int().positive().nullable(), tentativa: z.number().int().positive().nullable(), status: z.string().max(40), conclusao: z.string().max(40).nullable(),
    iniciadaEm: data.nullable(), atualizadaEm: data.nullable(), url: link.nullable(),
  })).max(100),
  pendencias: z.array(z.object({ id: z.string().regex(/^(issue|pr)-\d+$/), titulo: z.string().min(1).max(240),
    desde: data, url: link, tipo: z.enum(["issue", "pr"]),
  })).max(1000), erros: z.array(z.string().max(120)).max(100),
}).refine((v) => new Set(v.execucoes.map((r) => r.workflow)).size === v.execucoes.length);
export type EstadoOperacoes = z.infer<typeof esquemaEstado>;
export type LeituraEstado = { estado: EstadoOperacoes | null; aviso: string | null };
export const ESTADOS_TAREFA = ["aberta", "em-andamento", "aguardando", "concluida"] as const;
export type EstadoTarefa = typeof ESTADOS_TAREFA[number];
export const ROTULOS_TAREFA: Record<EstadoTarefa, string> = {
  aberta: "A fazer", "em-andamento": "Em andamento", aguardando: "Aguardando resposta", concluida: "Concluída",
};
export type Tarefa = { id: string; titulo: string; detalhe: string; origem: string | null; desde: string;
  tipo: "manual" | "procedimento" | "execucao" | "issue" | "pr"; sinalAtivo: boolean;
  estado: EstadoTarefa; nota: string; responsavel: string; prazo: string; versao: number };
export type RegistroTarefa = Omit<Tarefa, "sinalAtivo">;

/** Preserva a precisão: uma data de captura sem horário não ganha uma hora inventada. */
export function dataOperacional(s: string | null): string {
  if (!s) return "Não informada";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dataPublicacao(s) ?? "Não informada";
  const t = instante(s);
  return t ? fmtDateTime(t) : "Não informada";
}

export function monitorVigente(estado: EstadoOperacoes | null, agora: Date): boolean {
  if (!estado) return false;
  const idade = agora.getTime() - Date.parse(estado.geradoEm);
  return idade >= -300_000 && idade <= catalogo.validadeHoras * 3_600_000;
}

export function situacaoExecucao(r?: EstadoOperacoes["execucoes"][number]): string {
  if (!r || r.status === "ausente") return "Sem execução informada";
  if (r.status !== "completed") return "Execução em curso ou na fila";
  if (r.conclusao === "success") return "Execução aprovada";
  if (r.conclusao === "failure" || r.conclusao === "timed_out") return "Execução com falha";
  if (r.conclusao === "cancelled") return "Execução cancelada";
  return "Execução sem aprovação";
}

export function quadro(ler: (arquivo: string) => unknown, agora = new Date()) {
  return IDS_DOMINIOS.map((id) => {
    const d = catalogo.dominios.find((x) => x.id === id)!;
    const frescor = extrairFrescor(id, ler);
    return { ...d, id, frescor, situacao: situacaoDominio(frescor, agora), cadencia: cadenciaDe(id).rotulo,
      referenciaRotulo: definicao(id).referenciaRotulo, nota: definicao(id).nota };
  });
}
export type LinhaQuadro = ReturnType<typeof quadro>[number];
export function ehDominioOperacional(s: string): s is DominioFrescorId { return IDS_DOMINIOS.includes(s as DominioFrescorId); }

/** Leituras não escrevem no banco. Cada nova execução tem chave própria: não herda uma conclusão anterior. */
export function tarefasSugeridas(estado: EstadoOperacoes | null): Tarefa[] {
  const base = (id: string, titulo: string, detalhe: string, origem: string | null, desde: string, tipo: Tarefa["tipo"]): Tarefa =>
    ({ id, titulo, detalhe, origem, desde, tipo, sinalAtivo: true, estado: "aberta", nota: "", responsavel: "", prazo: "", versao: 0 });
  const tarefas = catalogo.pendencias.map((p) => base(p.id, p.titulo, p.detalhe, `${GITHUB}/blob/main/${p.origem}`, `${p.desde}T12:00:00Z`, "procedimento"));
  for (const r of estado?.execucoes ?? []) {
    if (r.status === "completed" && ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusao ?? "") && r.id && r.iniciadaEm) {
      const nome = catalogo.workflows[r.workflow as keyof typeof catalogo.workflows].nome;
      tarefas.push(base(`execucao-${r.id}-${r.tentativa ?? 1}`, nome, "Examinar o diagnóstico da execução, corrigir a causa e acompanhar a próxima tentativa. Uma falha do processo não comprova que todos os seus dados estão atrasados.", r.url, r.iniciadaEm, "execucao"));
    }
  }
  for (const p of estado?.pendencias ?? []) {
    const dep = p.tipo === "pr" ? catalogo.dependencias.find((d) => `pr-${d.numero}` === p.id) : null;
    tarefas.push(base(p.id, p.titulo, dep?.detalhe ?? "Conferir o relato e a evidência mais recente. O título da issue é um encaminhamento, não a confirmação da causa atual.", p.url, p.desde, p.tipo));
  }
  return tarefas;
}

export function combinarTarefas(sugeridas: Tarefa[], salvas: RegistroTarefa[]): Tarefa[] {
  const porId = new Map(salvas.map((t) => [t.id, t]));
  const ativas = new Set(sugeridas.map((t) => t.id));
  return [...sugeridas.map((t) => {
    const s = porId.get(t.id);
    return s ? { ...t, estado: s.estado, nota: s.nota, responsavel: s.responsavel, prazo: s.prazo, versao: s.versao } : t;
  }), ...salvas.filter((t) => !ativas.has(t.id)).map((t) => ({ ...t, sinalAtivo: false }))];
}
