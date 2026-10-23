import { describe, expect, it } from "vitest";
import { formasDoLiteral, GATILHOS_SUITE_INTEIRA, literalCita, selecionar } from "../../scripts/testes-afetados.mjs";

/** O filtro de `npm run verificar:rapido` só pode errar para o lado de rodar a mais. */

describe("literais que nomeiam arquivos", () => {
  it("aceita caminhos relativos e URLs de public/, recusa texto comum e endereços externos", () => {
    expect(formasDoLiteral("public/energia/gold/conta.json")).toEqual(["public/energia/gold/conta.json"]);
    expect(formasDoLiteral("./src/lib/x.ts")).toEqual(["src/lib/x.ts"]);
    expect(formasDoLiteral("/energia/gold/conta.json")).toEqual(["energia/gold/conta.json", "public/energia/gold/conta.json"]);
    expect(formasDoLiteral("conta.json")).toEqual([]);
    expect(formasDoLiteral("Conta de luz / mês")).toEqual([]);
    expect(formasDoLiteral("https://dados.gov.br/x.json")).toEqual([]);
    expect(formasDoLiteral("/")).toEqual([]);
  });

  it("cita por igualdade, pasta, cabeça de template ou sufixo com pasta", () => {
    const p = "public/energia/gold/previsoes_desempenho.json";
    expect(literalCita("public/energia/gold/previsoes_desempenho.json", p)).toBe(true);
    expect(literalCita("public/energia/gold/", p)).toBe(true);
    expect(literalCita("public/energia/gold", p)).toBe(true);
    expect(literalCita("public/energia/gold/previsoes_", p)).toBe(true);
    expect(literalCita("gold/previsoes_desempenho.json", p)).toBe(true);
    expect(literalCita("/energia/gold/previsoes_desempenho.json", p)).toBe(true);
    expect(literalCita("public/energia/go", p)).toBe(false);
    expect(literalCita("public/saneamento/", p)).toBe(false);
    expect(literalCita("previsoes_desempenho.json", p)).toBe(false);
  });
});

describe("seleção", () => {
  const inventario = {
    "src/tests/energia-conta.test.ts": { strings: [{ texto: "public/energia/gold/conta.json" }] },
    "src/tests/design-tokens.test.ts": { strings: [{ texto: "src/components" }] },
    "src/tests/saneamento.test.ts": { strings: [{ texto: "public/saneamento/gold/" }] },
    "src/lib/energia/dados.ts": { strings: [{ texto: "/energia/gold/conta.json" }] },
    "src/lib/saneamento/dados.ts": { strings: [{ texto: "public/saneamento/gold/meta.json" }] },
  };

  it("teste alterado entra direto; código alterado vai para o grafo de importação", () => {
    const r = selecionar(["src/tests/x.test.ts", "src/app/setor-eletrico/page.tsx", "docs/notas.md"], inventario);
    expect(r.suiteInteira).toBeNull();
    expect([...r.testes.keys()]).toEqual(["src/tests/x.test.ts"]);
    expect([...r.fontes.keys()]).toEqual(["src/app/setor-eletrico/page.tsx"]);
  });

  it("dado alterado leva os testes e os módulos que o citam pelo caminho", () => {
    const r = selecionar(["public/energia/gold/conta.json"], inventario);
    expect([...r.testes.keys()]).toEqual(["src/tests/energia-conta.test.ts"]);
    expect([...r.fontes.keys()]).toEqual(["public/energia/gold/conta.json", "src/lib/energia/dados.ts"]);
    expect(r.testes.get("src/tests/energia-conta.test.ts")).toBe("cita public/energia/gold/conta.json");
  });

  it("componente alterado leva o teste que varre a pasta de componentes", () => {
    const r = selecionar(["src/components/energia/Grafico.tsx"], inventario);
    expect([...r.testes.keys()]).toEqual(["src/tests/design-tokens.test.ts"]);
  });

  it("um módulo não é selecionado por citar a si mesmo", () => {
    const r = selecionar(["src/lib/saneamento/dados.ts"], { "src/lib/saneamento/dados.ts": { strings: [{ texto: "src/lib/saneamento/dados.ts" }] } });
    expect(r.fontes.get("src/lib/saneamento/dados.ts")).toBe("código alterado");
  });

  it("configuração que afeta todos os testes roda a suíte inteira", () => {
    for (const gatilho of GATILHOS_SUITE_INTEIRA) expect(selecionar([gatilho, "src/app/x.tsx"], inventario).suiteInteira).toBe(gatilho);
    expect(GATILHOS_SUITE_INTEIRA).toContain("vitest.config.ts");
    expect(GATILHOS_SUITE_INTEIRA).toContain("package-lock.json");
  });
});
