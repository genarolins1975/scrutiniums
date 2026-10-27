import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CATALOGO, combinarTarefas, dataOperacional, esquemaEstado, monitorVigente, quadro, tarefasSugeridas, type EstadoOperacoes } from "@/lib/operacoes/modelo";
import { IDS_DOMINIOS } from "@/lib/frescor/regras";
import { esquemaEdicao } from "@/lib/operacoes/tarefas";

const agora = new Date("2026-10-27T12:00:00Z");
const estado: EstadoOperacoes = { versao: 1, repositorio: "genarolins1975/scrutiniums", geradoEm: agora.toISOString(), erros: [], pendencias: [], execucoes: [] };
describe("quadro operacional do ADM", () => {
  it("cobre todos os domínios e aponta só para workflows e rotas existentes", () => {
    expect(CATALOGO.dominios.map((d) => d.id).sort()).toEqual([...IDS_DOMINIOS].sort());
    for (const d of CATALOGO.dominios) {
      const arquivo = d.rota === '/observatorio/credit' ? 'src/app/observatorio/[[...rota]]/route.ts' : `src/app${d.rota}/page.tsx`;
      expect(existsSync(arquivo), arquivo).toBe(true);
      for (const w of d.workflows) expect(Object.keys(CATALOGO.workflows)).toContain(w);
    }
    for (const w of Object.keys(CATALOGO.workflows)) expect(readFileSync(`.github/workflows/${w}`, "utf8")).toContain("schedule:");
  });
  it("não deixa uma nova rotina de atualização fora do quadro", () => {
    const rotinas = readdirSync(".github/workflows").filter((w) => w.startsWith("atualizar-"));
    for (const w of rotinas) {
      expect(Object.keys(CATALOGO.workflows), w).toContain(w);
      expect(CATALOGO.dominios.some((d) => d.workflows.includes(w)), w).toBe(true);
    }
  });
  it("preserva ausência e não infere frescor de uma execução verde", () => {
    const linhas = quadro(() => null, agora);
    expect(linhas).toHaveLength(IDS_DOMINIOS.length);
    for (const l of linhas) {
      expect(l.frescor.publicadoEm).toBeNull();
      expect(l.situacao.estado).toBe("sem-data");
    }
  });
  it("declara monitor vencido, ausente e com relógio futuro", () => {
    expect(monitorVigente(null, agora)).toBe(false);
    expect(monitorVigente(estado, agora)).toBe(true);
    expect(monitorVigente({ ...estado, geradoEm: "2026-10-27T08:59:00Z" }, agora)).toBe(false);
    expect(monitorVigente({ ...estado, geradoEm: "2026-10-27T13:00:00Z" }, agora)).toBe(false);
  });
  it("recusa contratos inválidos e links de outra origem", () => {
    expect(esquemaEstado.safeParse(estado).success).toBe(true);
    expect(esquemaEstado.safeParse({ ...estado, geradoEm: "NaN" }).success).toBe(false);
    const pendencia = { id: "issue-10", titulo: "Conferir", tipo: "issue", desde: agora.toISOString(), url: "https://outro.test/" };
    expect(esquemaEstado.safeParse({ ...estado, pendencias: [pendencia] }).success).toBe(false);
  });
  it("nova execução com falha não herda a conclusão anterior", () => {
    const r = { workflow: "atualizar-dados.yml", id: 10, tentativa: 1, status: "completed", conclusao: "failure", iniciadaEm: agora.toISOString(), atualizadaEm: agora.toISOString(), url: "https://github.com/genarolins1975/scrutiniums/actions/runs/10" };
    const antigas = tarefasSugeridas({ ...estado, execucoes: [r] });
    const encerrada = { ...antigas.find((t) => t.id === "execucao-10-1")!, estado: "concluida" as const, versao: 1 };
    const atuais = combinarTarefas(tarefasSugeridas({ ...estado, execucoes: [{ ...r, id: 11 }] }), [encerrada]);
    expect(atuais.find((t) => t.id === "execucao-11-1")).toMatchObject({ estado: "aberta", sinalAtivo: true });
    expect(atuais.find((t) => t.id === "execucao-10-1")).toMatchObject({ estado: "concluida", sinalAtivo: false });
    expect(combinarTarefas(antigas, [encerrada]).find((t) => t.id === "execucao-10-1")?.sinalAtivo).toBe(true);
  });
  it("reexecução do mesmo run_id volta à fila sem perder o histórico", () => {
    const r = { workflow: "atualizar-dados.yml", id: 42, tentativa: 1, status: "completed", conclusao: "failure", iniciadaEm: agora.toISOString(), atualizadaEm: agora.toISOString(), url: "https://github.com/genarolins1975/scrutiniums/actions/runs/42/attempts/1" };
    const encerrada = { ...tarefasSugeridas({ ...estado, execucoes: [r] }).find((t) => t.id === "execucao-42-1")!, estado: "concluida" as const, versao: 1 };
    const novas = combinarTarefas(tarefasSugeridas({ ...estado, execucoes: [{ ...r, tentativa: 2 }] }), [encerrada]);
    expect(novas.find((t) => t.id === "execucao-42-2")).toMatchObject({ estado: "aberta", sinalAtivo: true });
    expect(novas.find((t) => t.id === "execucao-42-1")).toMatchObject({ estado: "concluida", sinalAtivo: false });
  });
  it("preserva o dia da captura sem inventar horário e converte instantes para Brasília", () => {
    expect(dataOperacional("2026-10-17")).toBe("17/10/2026");
    expect(dataOperacional("2026-10-12")).toBe("12/10/2026");
    expect(dataOperacional("2026-10-27T00:30:00Z")).toContain("26/10/2026");
    expect(dataOperacional(null)).not.toMatch(/NaN|undefined|\d/);
  });
  it("recusa datas impossíveis e notas fora do limite", () => {
    const edicao = { estado: "aberta", nota: "", responsavel: "", prazo: "", versao: 0, titulo: "Conferir fonte" };
    expect(esquemaEdicao.safeParse(edicao).success).toBe(true);
    expect(esquemaEdicao.safeParse({ ...edicao, prazo: "2026-02-30" }).success).toBe(false);
    expect(esquemaEdicao.safeParse({ ...edicao, nota: "x".repeat(2001) }).success).toBe(false);
  });
});

it("auditoria reproduzível admite ADM sintético e celular estreito", async () => {
  const { lerArgumentos } = await import("../../scripts/evidencias.mjs");
  const opcoes = lerArgumentos(["--rotas", "/app/admin", "--saida", "evidencias", "--conta", "adm", "--larguras", "320,1440"]);
  expect(opcoes.conta).toBe("adm");
  expect(opcoes.larguras).toEqual([320, 1440]);
});

it("monitor é independente dos publicadores, sem push de gold e só na main", () => {
  const yaml = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => { on: Record<string, unknown>; concurrency: Record<string, unknown>; permissions: Record<string, string>; jobs: Record<string, { if: string; "timeout-minutes": number; steps: { run?: string }[] }> } };
  const w = yaml.load(readFileSync(".github/workflows/monitorar-operacoes.yml", "utf8"));
  expect(w.on).toHaveProperty("schedule");
  expect(w.on).toHaveProperty("workflow_dispatch");
  expect(w.on).not.toHaveProperty("pull_request_target");
  expect(w.permissions.actions).toBe("read");
  expect(w.concurrency["cancel-in-progress"]).toBe(false);
  for (const job of Object.values(w.jobs)) {
    expect(job.if).toContain("refs/heads/main");
    expect(job["timeout-minutes"]).toBeGreaterThan(0);
    expect(job.steps.map((s) => s.run ?? "").join("\n")).not.toMatch(/git (?:push|commit)|public\/.*gold/);
  }
});
