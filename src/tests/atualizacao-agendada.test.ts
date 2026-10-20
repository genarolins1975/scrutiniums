import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Atualização agendada por domínio (banca de 19/10/2026, achado A13). Trava, para todo
 * `.github/workflows/atualizar-*.yml`, as correções permanentes dos incidentes do Crédito
 * (OPERACOES.md): agenda, concorrência sem cancelamento, teto de tempo, push com rebase,
 * execução vermelha e issue quando retém. E trava que Saneamento, Contas Públicas Federais,
 * Contas Públicas Estaduais e Eficiência Estatal têm o seu, ligado à configuração do motor.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
// js-yaml já vem no lockfile (dependência do ESLint); sem tipos publicados, tipado aqui.
const yaml = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };

type Passo = { name?: string; id?: string; run?: string; uses?: string; if?: string; "continue-on-error"?: boolean; env?: Record<string, string> };
type Job = { "timeout-minutes"?: number; steps?: Passo[]; needs?: string; if?: string; outputs?: Record<string, string>; permissions?: Record<string, string> };
type Workflow = {
  name: string;
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown };
  permissions?: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  env?: Record<string, string>;
  jobs: Record<string, Job>;
};

const arquivos = readdirSync(join(raiz, ".github/workflows")).filter((f) => /^atualizar-.*\.yml$/.test(f)).sort();
const wf = (f: string) => yaml.load(ler(`.github/workflows/${f}`)) as Workflow;
const passos = (w: Workflow) => Object.values(w.jobs).flatMap((j) => j.steps ?? []);
const texto = (w: Workflow) => passos(w).map((p) => p.run ?? "").join("\n");

describe("todo workflow atualizar-*.yml", () => {
  it("existe para os quatro domínios que dependiam de execução manual", () => {
    for (const f of ["atualizar-saneamento.yml", "atualizar-contas-publicas.yml", "atualizar-contas-estaduais.yml", "atualizar-eficiencia.yml"]) {
      expect(arquivos).toContain(f);
    }
  });

  it.each(arquivos)("%s tem agenda, disparo manual, concorrência sem cancelamento e teto de tempo", (f) => {
    const w = wf(f);
    expect(w.on.schedule?.length).toBeGreaterThan(0);
    for (const { cron } of w.on.schedule!) expect(cron.trim().split(/\s+/)).toHaveLength(5);
    expect(w.on).toHaveProperty("workflow_dispatch");
    expect(w.concurrency?.group).toBeTruthy();
    expect(w.concurrency?.["cancel-in-progress"]).toBe(false);
    for (const job of Object.values(w.jobs)) expect(job["timeout-minutes"]).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s só empurra para o main com rebase e novas tentativas", (f) => {
    const w = wf(f);
    if (w.permissions?.contents !== "write") return; // conferência sem publicação
    const t = texto(w);
    const pelo_motor = t.includes("scripts/atualizacao_por_grupo.py publicar");
    expect(pelo_motor || (/git rebase|pull --rebase/.test(t) && /for tentativa in/.test(t))).toBe(true);
  });

  it("aparece na tabela de agendas do OPERACOES.md", () => {
    const ops = ler("OPERACOES.md");
    const secao = ops.slice(ops.indexOf("## Atualização agendada por domínio"));
    expect(secao.length).toBeGreaterThan(100);
    for (const f of arquivos) expect(secao).toContain(`\`${f}\``);
  });
});

const MOTOR: [string, string][] = [
  ["atualizar-saneamento.yml", "saneamento"],
  ["atualizar-contas-publicas.yml", "contas-publicas"],
  ["atualizar-eficiencia.yml", "eficiencia"],
  // painel Inflação por cidade (IPCA, Observatório das Famílias), 20/10/2026: nasce no motor por grupo
  ["atualizar-inflacao.yml", "inflacao"],
  // painel Segurança pública por UF (Eficiência Estatal), 20/10/2026: Sinesp VDE, SIM, Siconfi e IBGE no motor por grupo
  ["atualizar-seguranca.yml", "seguranca"],
  // painel Previdência e INSS (Contas Públicas), 20/10/2026: BEPS, benefícios por município e RTN no motor por grupo
  ["atualizar-previdencia.yml", "previdencia"],
];

describe.each(MOTOR)("%s (motor por grupo)", (arquivo, dominio) => {
  const w = wf(arquivo);
  const p = passos(w);
  const ciclo = p.find((x) => x.id === "ciclo")!;
  const publicar = p.find((x) => x.id === "publicar")!;
  const issue = p.find((x) => x.id === "issue")!;

  it("aponta para a configuração versionada do domínio", () => {
    const config = w.env?.CONFIG;
    expect(config).toBe(`config/atualizacao/${dominio}.json`);
    const cfg = JSON.parse(ler(config!));
    expect(cfg.dominio).toBe(dominio);
    expect(cfg.grupos.length).toBeGreaterThan(0);
    expect(cfg.testes.length).toBeGreaterThan(0);
    for (const t of cfg.testes) expect(t.comando.join(" ")).not.toMatch(/--(passWithNoTests|bail)\b|\|\| *true/);
  });

  it("decide por grupo antes do commit e só publica o que foi aprovado", () => {
    expect(ciclo.run).toContain("scripts/atualizacao_por_grupo.py ciclo");
    expect(ciclo["continue-on-error"]).toBe(true);
    expect(publicar.if).toContain("steps.ciclo.outputs.publicavel == '1'");
    expect(publicar.run).toContain("scripts/atualizacao_por_grupo.py publicar");
    expect(p.indexOf(ciclo)).toBeLessThan(p.indexOf(publicar));
  });

  it("retenção abre ou comenta issue atribuída e deixa a execução vermelha", () => {
    expect(w.permissions?.issues).toBe("write");
    expect(issue.if).toMatch(/steps\.ciclo\.outcome != 'success'/);
    expect(issue.run).toContain(`.atualizacao/${dominio}/relatorio.md`);
    expect(issue.run).toContain("scripts/issue_dedup.sh");
    const sinal = p.find((x) => x.name === "Sinalizar publicação retida")!;
    expect(sinal.if).toBe(issue.if);
    expect(sinal.run).toMatch(/exit 1\s*$/);
    expect(w.jobs.alertar?.needs).toBe("pipeline");
    expect(w.jobs.alertar?.if).toContain("cancelled");
  });

  it("não interpola entrada do disparo manual no shell", () => {
    expect(ciclo.run).not.toContain("${{ inputs.");
    expect(ciclo.env?.GRUPOS).toBe("${{ inputs.grupos }}");
  });
});

describe("atualizar-contas-estaduais.yml (conferência, sem publicação)", () => {
  const w = wf("atualizar-contas-estaduais.yml");
  const t = texto(w);
  it("não tem permissão de escrita no repositório e confere a base publicada", () => {
    expect(w.permissions?.contents).toBe("read");
    expect(t).toContain("pipeline.contas_estaduais.consolidar --check");
    expect(t).toContain("pipeline.contas_estaduais.conferir");
    expect(t).not.toMatch(/git (push|commit)/);
  });
  it("conferência cega ou contrato reprovado deixam a execução vermelha com issue", () => {
    const sinal = passos(w).find((x) => x.name === "Sinalizar falha")!;
    expect(sinal.if).toContain("steps.contratos.outcome != 'success'");
    expect(sinal.if).toContain("steps.conferir.outcome != 'success'");
    expect(sinal.run).toMatch(/exit 1\s*$/);
  });
});

describe("atualizar-contas-publicas.yml vigia a edição do RTN", () => {
  it("roda o vigia e abre a issue própria, sem repetir a mesma assinatura", () => {
    const t = texto(wf("atualizar-contas-publicas.yml"));
    expect(t).toContain("scripts/contas-publicas/vigiar_rtn.py");
    expect(t).toContain("edição nova do RTN aguardando integração");
    expect(ler("scripts/issue_dedup.sh")).toContain("Assinatura: ");
  });
});

describe("issue_dedup.sh", () => {
  it("existe, é executável no Actions e atribui a issue nova ao dono do repositório", () => {
    expect(existsSync(join(raiz, "scripts/issue_dedup.sh"))).toBe(true);
    expect(statSync(join(raiz, "scripts/issue_dedup.sh")).mode & 0o111).toBeTruthy();
    const s = ler("scripts/issue_dedup.sh");
    expect(s.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(s).toContain("--assignee");
    expect(s).toContain("set -euo pipefail");
  });
});
