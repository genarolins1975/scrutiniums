import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ETAPAS_AGRO, ETAPAS_PR } from "../../scripts/verificar.mjs";

/**
 * `npm run verificar:pr` existe para reproduzir o CI na máquina, sem empurrar commit atrás de
 * commit. Se um passo novo entra no ci.yml e não entra em scripts/verificar.mjs, o comando local
 * passa e o CI reprova: exatamente o ciclo que ele deveria encerrar. Este teste fecha a porta.
 */

/** Linhas de comando dos `run:` de um workflow, sem depender de parser YAML. */
function comandosRun(yaml: string): string[] {
  const linhas = yaml.split("\n");
  const cmds: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^(\s*(?:- )?)run:\s*(.*)$/);
    if (!m) continue;
    const recuoChave = m[1].length;
    if (m[2] && m[2] !== "|") { cmds.push(m[2].trim()); continue; }
    while (i + 1 < linhas.length) {
      const l = linhas[i + 1];
      if (l.trim() !== "" && (l.match(/^\s*/)?.[0].length ?? 0) <= recuoChave) break;
      if (l.trim() !== "") cmds.push(l.trim());
      i++;
    }
  }
  return cmds;
}

/**
 * Comandos que verificam algo (não instalação, cache ou orquestração do próprio CI). Um comando que só grava um arquivo em
 * $RUNNER_TEMP para upload publica um artefato; a verificação dele é outro passo (caso do relatório de cobertura bilíngue,
 * que sai como artefato desde 22/10/2026, enquanto a validação continua no `--check`).
 */
const ehVerificacao = (c: string) =>
  /^(npm run |npx tsc|npx vitest|node scripts\/|python3 |git diff --exit-code docs\/)/.test(c) && !c.startsWith("node scripts/ci/") && !/>\s*"\$RUNNER_TEMP\//.test(c);
/** O shard é paralelismo do CI: localmente a suíte inteira roda numa invocação. */
const normaliza = (c: string) => c.replace(/\s+--shard=\$\{\{\s*matrix\.shard\s*\}\}/, "");
const locais = (etapas: { cmds: string[] }[]) => new Set(etapas.flatMap((e) => e.cmds));

describe("verificar:pr acompanha o CI", () => {
  it("extrai comandos de run de uma linha e de blocos, nas duas formas de passo", () => {
    const yaml = [
      "steps:",
      "  - run: npm ci",
      "  - name: Tipos",
      "    run: npx tsc --noEmit",
      "  - name: Bloco",
      "    env:",
      "      X: \"1\"",
      "    run: |",
      "      python3 -m unittest a",
      "",
      "      python3 -m unittest b",
      "  - run: |",
      "      node scripts/x.mjs",
      "    env:",
      "      Y: \"2\"",
    ].join("\n");
    expect(comandosRun(yaml)).toEqual(["npm ci", "npx tsc --noEmit", "python3 -m unittest a", "python3 -m unittest b", "node scripts/x.mjs"]);
  });

  it("todo comando de verificação do ci.yml está em scripts/verificar.mjs", () => {
    const ci = comandosRun(readFileSync(".github/workflows/ci.yml", "utf8")).filter(ehVerificacao).map(normaliza);
    expect(ci.length).toBeGreaterThan(20);
    const faltando = ci.filter((c) => !locais(ETAPAS_PR).has(c));
    expect(faltando).toEqual([]);
  });

  it("todo comando de verificação do agro-interface.yml está nas etapas opcionais do Agronegócio", () => {
    const agro = comandosRun(readFileSync(".github/workflows/agro-interface.yml", "utf8")).filter(ehVerificacao);
    expect(agro.length).toBeGreaterThanOrEqual(5);
    expect(agro.filter((c) => !locais(ETAPAS_AGRO).has(c))).toEqual([]);
  });

  it("o build e o Vitest com EXIGIR_BUILD_HTML=1 estão no verificar:pr, nessa ordem", () => {
    const ids = ETAPAS_PR.map((e) => e.id);
    expect(ids.indexOf("build")).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf("vitest")).toBeGreaterThan(ids.indexOf("build"));
    expect(ETAPAS_PR.find((e) => e.id === "vitest")?.env).toEqual({ EXIGIR_BUILD_HTML: "1", TESTES_SEM_RETRATO: "1" });
  });

  it("retrato fica fora das barreiras e roda à parte, sem reprovar (decisão do dono de 24/10/2026)", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const energia = readFileSync(".github/workflows/atualizar-energia.yml", "utf8");
    // os passos que barram (Python e Vitest do CI, testes antes de publicar a gold) pulam os retratos
    expect(ci).toMatch(/name: Testes Python \(pipeline e camada de pesquisa\)[\s\S]*?TESTES_SEM_RETRATO: "1"[\s\S]*?python3 -m unittest discover -s pipeline\/tests/);
    expect(ci).toMatch(/EXIGIR_BUILD_HTML: "1"\n\s+TESTES_SEM_RETRATO: "1"\n\s+run: npx vitest run --shard/);
    expect(energia).toMatch(/name: Testes antes de publicar[\s\S]*?TESTES_SEM_RETRATO: "1"[\s\S]*?npx vitest run/);
    // e rodam num job que não entra no CI verde, e num passo do workflow de energia que relata em issue
    expect(ci).toContain("run: node scripts/testes-retrato.mjs");
    expect(ci.match(/needs: \[mudancas, estatico, python, testes, judiciario\]/)).not.toBeNull();
    expect(energia).toContain("node scripts/testes-retrato.mjs --saida retratos.md");
    expect(energia).toContain('TITULO="Setor Elétrico: retratos divergem da gold do dia; reconferir"');
    expect(ETAPAS_PR.find((e) => e.id === "python")?.env).toEqual({ TESTES_SEM_RETRATO: "1" });
    expect(ETAPAS_PR.find((e) => e.id === "retratos")).toMatchObject({ cmds: ["node scripts/testes-retrato.mjs"], informativa: true });
  });
});
