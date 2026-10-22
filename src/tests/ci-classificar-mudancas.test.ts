import { describe, expect, it } from "vitest";
import {
  classificar, extrairImports, fechoDeImportacoes, literaisPython, resolver, sistemaDeArquivos, tudoVerdadeiro, VERIFICACOES,
} from "../../scripts/ci/classificar-mudancas.mjs";

/**
 * O classificador decide quais jobs do CI um pull request liga (.github/workflows/ci.yml,
 * job `mudancas`). Errar para menos deixaria passar sem teste uma mudança que o main depois
 * reprova; por isso os casos abaixo fixam o lado seguro de cada regra.
 */

type Arvore = Record<string, string>;

/** Árvore sintética com a mesma interface do sistema de arquivos real do script. */
function arvore(arquivos: Arvore) {
  const semBarra = (p: string) => p.replace(/\/$/, "");
  return {
    existe: (p: string) => Object.hasOwn(arquivos, p),
    ehPasta: (p: string) => Object.keys(arquivos).some((k) => k.startsWith(semBarra(p) + "/")),
    ler: (p: string) => arquivos[p],
    listar: (p: string) => {
      const prefixo = semBarra(p) + "/";
      const nomes = new Map<string, boolean>();
      for (const k of Object.keys(arquivos)) {
        if (!k.startsWith(prefixo)) continue;
        const [nome, ...resto] = k.slice(prefixo.length).split("/");
        nomes.set(nome, resto.length > 0 || nomes.get(nome) === true);
      }
      return [...nomes].map(([nome, pasta]) => ({ nome, pasta }));
    },
  };
}

const REPO: Arvore = {
  "src/app/layout.tsx": `import "./globals.css";\nimport { BarraPlataforma } from "@/components/layout/BarraPlataforma";`,
  "src/app/globals.css": "",
  "src/app/page.tsx": `import Home from "@/components/home/Home";`,
  "src/app/sitemap.ts": `import { ROTAS } from "@/lib/rotasPublicas";`,
  "src/app/en/page.tsx": `import Home from "@/components/home/Home";`,
  "src/app/entrar/page.tsx": `import { EntrarForm } from "@/components/onboarding/EntrarForm";`,
  "src/app/app/(foco)/layout.tsx": `import { sessao } from "@/lib/session";`,
  "src/app/app/(foco)/observatorios/page.tsx": `export default function P() {}`,
  "src/app/api/auth/eu/route.ts": `import { sessao } from "@/lib/session";`,
  "src/app/eficiencia-estatal/layout.tsx": `import "@/components/eficiencia/Eficiencia.module.css";`,
  "src/app/eficiencia-estatal/page.tsx": `import { Retrato } from "@/components/eficiencia/Retrato";`,
  "src/app/eficiencia-estatal/judiciario/page.tsx": `import { Figuras } from "@/components/eficiencia/judiciario/Figuras";\nexport { x } from "./dados";`,
  "src/app/eficiencia-estatal/judiciario/dados.ts": `import limiares from "@/lib/frescor/limiares.json";`,
  "src/app/eficiencia-estatal/acesso-justica/page.tsx": "",
  "src/app/agronegocio/page.tsx": `import { dados } from "@/lib/agro/dados";\nimport styles from "./Agro.module.css";`,
  "src/app/agronegocio/Agro.module.css": "",
  "src/app/api/agro/eventos/route.ts": `const m = await import("@/lib/telemetry");`,
  "src/app/api/telemetria/route.ts": "",
  "src/app/setor-eletrico/page.tsx": `import { Grafico } from "@/components/energia/Grafico";`,
  "src/app/saneamento/page.tsx": `import { Mapa } from "../../components/saneamento/Mapa";`,
  "src/middleware.ts": `import { ROTAS } from "@/lib/rotasPublicas";`,
  "src/components/layout/BarraPlataforma.tsx": `import { Busca } from "@/components/busca";`,
  "src/components/busca/index.tsx": `export const Busca = 1;`,
  "src/components/home/Home.tsx": `import { Footer } from "../layout/Footer";`,
  "src/components/layout/Footer.tsx": "",
  "src/components/onboarding/EntrarForm.tsx": "",
  "src/components/eficiencia/Eficiencia.module.css": "",
  "src/components/eficiencia/Retrato.tsx": "",
  "src/components/eficiencia/judiciario/Figuras.tsx": `import styles from "./Judiciario.module.css";`,
  "src/components/eficiencia/judiciario/Judiciario.module.css": "",
  "src/components/energia/Grafico.tsx": "",
  "src/components/saneamento/Mapa.tsx": "",
  "src/lib/rotasPublicas.ts": "",
  "src/lib/session.ts": `import { db } from "./db";`,
  "src/lib/db.ts": `import { schema } from "./schema";`,
  "src/lib/schema.ts": "",
  "src/lib/agro/dados.ts": "",
  "src/lib/telemetry.ts": "",
  "src/lib/frescor/limiares.json": "{}",
  "pipeline/tests/test_frescor.py": `LIMIARES = ROOT / 'src/lib/frescor/limiares.json'\nDOCS = 'docs/obee/resultados'\nX = f'docs/.../avaliacao/'\nFIXTURE = {'src/tests/outro.test.ts': {'grupos': []}}`,
  "scripts/vigilancia.py": `CASOS = "config/atualizacao"`,
  "scripts/nao-python.mjs": `"src/app/page.tsx"`,
};

function contexto(arquivos: Arvore = REPO) {
  const fs = arvore(arquivos);
  const fechos = Object.fromEntries(Object.entries(VERIFICACOES).map(([n, v]) => [n, fechoDeImportacoes(v.raizes, fs)])) as Record<"judiciario" | "agro", Set<string>>;
  return { fechos, literais: literaisPython(fs) };
}

const saidas = (alterados: string[], ctx = contexto()) => classificar(alterados, ctx).saidas;
const NADA = { interface: false, python: false, judiciario: false, agro: false, i18n: false };

describe("fecho de importações", () => {
  const fs = arvore(REPO);
  it("segue @/ e relativos, com e sem extensão, index e CSS, e ignora pacotes", () => {
    expect(resolver("@/components/busca", "src/components/layout/BarraPlataforma.tsx", fs)).toBe("src/components/busca/index.tsx");
    expect(resolver("../layout/Footer", "src/components/home/Home.tsx", fs)).toBe("src/components/layout/Footer.tsx");
    expect(resolver("./Judiciario.module.css", "src/components/eficiencia/judiciario/Figuras.tsx", fs)).toBe("src/components/eficiencia/judiciario/Judiciario.module.css");
    expect(resolver("next/server", "src/middleware.ts", fs)).toBeNull();
    expect(resolver("@/inexistente", "src/app/page.tsx", fs)).toBeNull();
  });
  it("aceita importação com extensão para fora de src/ mesmo sem o arquivo no checkout esparso", () => {
    expect(resolver("../../../../public/eficiencia/judiciario/snapshot.json", "src/lib/eficiencia/judiciario/dados.ts", fs))
      .toBe("public/eficiencia/judiciario/snapshot.json");
    expect(resolver("../../config/i18n-inventario.json", "src/lib/i18n-rotas.ts", fs)).toBe("config/i18n-inventario.json");
    expect(resolver("../../config/sem-extensao", "src/lib/i18n-rotas.ts", fs)).toBeNull();
    expect(resolver("../../../../fora.json", "src/lib/x.ts", fs)).toBeNull();
  });
  it("reconhece import, export from, import dinâmico e require", () => {
    expect(extrairImports(`import a from "x";\nimport "y";\nexport { b } from 'z';\nexport * from "w";\nconst c = await import("v");\nconst d = require('u');`).sort())
      .toEqual(["u", "v", "w", "x", "y", "z"]);
  });
  it("inclui os layouts dos segmentos ancestrais, inclusive grupos de rota", () => {
    const fecho = fechoDeImportacoes(["src/app/app"], fs);
    expect(fecho.has("src/app/app/(foco)/layout.tsx")).toBe(true);
    expect(fecho.has("src/app/layout.tsx")).toBe(true);
    expect(fecho.has("src/components/layout/BarraPlataforma.tsx")).toBe(true);
    expect(fecho.has("src/lib/schema.ts")).toBe(true);
  });
  it("o Judiciário alcança a barra comum, o middleware e o JSON importado; não alcança outros temas", () => {
    const { fechos } = contexto();
    for (const a of ["src/components/layout/BarraPlataforma.tsx", "src/components/busca/index.tsx", "src/lib/rotasPublicas.ts",
      "src/lib/frescor/limiares.json", "src/components/eficiencia/Retrato.tsx", "src/app/eficiencia-estatal/layout.tsx", "src/app/globals.css"]) {
      expect(fechos.judiciario.has(a), a).toBe(true);
    }
    for (const a of ["src/components/energia/Grafico.tsx", "src/components/saneamento/Mapa.tsx", "src/lib/agro/dados.ts", "src/app/agronegocio/page.tsx"]) {
      expect(fechos.judiciario.has(a), a).toBe(false);
    }
    expect(fechos.agro.has("src/lib/agro/dados.ts")).toBe(true);
    expect(fechos.agro.has("src/lib/telemetry.ts")).toBe(true);
    expect(fechos.agro.has("src/components/eficiencia/judiciario/Figuras.tsx")).toBe(false);
  });
});

describe("literais de caminho nos arquivos Python", () => {
  it("colhe src/, config/ e docs/ só de .py, descartando reticências e fixtures em src/tests/", () => {
    expect(literaisPython(arvore(REPO))).toEqual(["config/atualizacao", "docs/obee/resultados", "src/lib/frescor/limiares.json"]);
  });
});

describe("classificação", () => {
  it("página de um tema sem verificação própria liga só interface e i18n", () => {
    expect(saidas(["src/app/setor-eletrico/page.tsx"])).toEqual({ ...NADA, interface: true, i18n: true });
    expect(saidas(["src/components/saneamento/Mapa.tsx", "src/tests/saneamento.test.ts"])).toEqual({ ...NADA, interface: true, i18n: true });
  });
  it("componente da barra comum liga Judiciário e Agro, porque os dois scripts abrem a home e o seletor", () => {
    expect(saidas(["src/components/busca/index.tsx"])).toEqual({ ...NADA, interface: true, i18n: true, judiciario: true, agro: true });
    expect(saidas(["src/lib/rotasPublicas.ts"])).toEqual({ ...NADA, interface: true, i18n: true, judiciario: true, agro: true });
  });
  it("tema próprio liga só a sua verificação", () => {
    expect(saidas(["src/components/eficiencia/judiciario/Figuras.tsx"])).toEqual({ ...NADA, interface: true, i18n: true, judiciario: true });
    expect(saidas(["src/app/eficiencia-estatal/layout.tsx"])).toEqual({ ...NADA, interface: true, i18n: true, judiciario: true });
    expect(saidas(["public/eficiencia/judiciario/snapshot.json"])).toEqual({ ...NADA, python: true, judiciario: true });
    expect(saidas(["src/lib/agro/dados.ts"])).toEqual({ ...NADA, interface: true, i18n: true, agro: true });
    expect(saidas(["public/agro/gold/snapshot.json", "docs/agro/catalogo-artefatos.json"])).toEqual({ ...NADA, python: true, agro: true });
  });
  it("dados em public/ ligam Python; apresentação em public/ liga interface", () => {
    expect(saidas(["public/energia/gold/metricas.json"])).toEqual({ ...NADA, python: true });
    expect(saidas(["public/obs/data/gold/emprego.json", "public/saneamento/gold/uf/SP.json"])).toEqual({ ...NADA, python: true });
    expect(saidas(["public/obs/styles.css", "public/obs/app.js", "public/home/x.webp"])).toEqual({ ...NADA, interface: true });
  });
  it("código Python, dados, config e docs/obee ligam Python", () => {
    for (const a of ["pipeline/energia/x.py", "pesquisa/notas.py", "data/x.json", "config/gold-grupos.json", "docs/obee/resultados/v4/x.json", "scripts/novo.py"]) {
      expect(saidas([a]), a).toEqual({ ...NADA, python: true });
    }
  });
  it("arquivo de src/ citado por um teste Python liga Python além da interface", () => {
    expect(saidas(["src/lib/frescor/limiares.json"])).toEqual({ ...NADA, interface: true, i18n: true, python: true, judiciario: true });
  });
  it("mudança só de documentação de tradução liga só i18n; outra documentação não liga nada", () => {
    expect(saidas(["docs/i18n/PLANO.md", "config/i18n-inventario.json"])).toEqual({ ...NADA, i18n: true, python: true });
    expect(saidas(["docs/i18n/PLANO.md"])).toEqual({ ...NADA, i18n: true });
    expect(saidas(["docs/CICLO.md", "README.md"])).toEqual(NADA);
  });
  it("o próprio workflow ou scripts/ci ligam tudo; arquivos do build ligam as verificações de navegador", () => {
    const tudo = { interface: true, python: true, judiciario: true, agro: true, i18n: true };
    expect(saidas([".github/workflows/ci.yml"])).toEqual(tudo);
    expect(saidas(["scripts/ci/classificar-mudancas.mjs"])).toEqual(tudo);
    expect(saidas(["package-lock.json"])).toEqual({ ...NADA, interface: true, judiciario: true, agro: true });
    expect(saidas(["next.config.mjs", "tailwind.config.ts"])).toEqual({ ...NADA, interface: true, judiciario: true, agro: true });
  });
  it("registra até três arquivos por motivo e marca o restante", () => {
    const { motivos } = classificar(["pipeline/a.py", "pipeline/b.py", "pipeline/c.py", "pipeline/d.py", "pipeline/e.py"], contexto());
    expect(motivos.python).toEqual(["pipeline/a.py", "pipeline/b.py", "pipeline/c.py", "…"]);
    expect(motivos.judiciario).toEqual([]);
  });
  it("fora de pull_request tudo é verdadeiro", () => {
    const r = tudoVerdadeiro("evento push: suíte integral");
    expect(Object.values(r.saidas).every(Boolean)).toBe(true);
    expect(r.motivos.python).toEqual(["evento push: suíte integral"]);
  });
});

describe("no repositório real", () => {
  const fs = sistemaDeArquivos(process.cwd() + "/");
  const fechos = Object.fromEntries(Object.entries(VERIFICACOES).map(([n, v]) => [n, fechoDeImportacoes(v.raizes, fs)])) as Record<"judiciario" | "agro", Set<string>>;
  it("as raízes declaradas existem", () => {
    for (const v of Object.values(VERIFICACOES)) for (const r of v.raizes) expect(fs.existe(r) || fs.ehPasta(r), r).toBe(true);
    for (const v of Object.values(VERIFICACOES)) for (const c of v.caminhos) expect(fs.existe(c) || fs.ehPasta(c), c).toBe(true);
  });
  it("a barra comum e a política de acesso estão nos dois fechos; páginas de outros temas, em nenhum", () => {
    for (const a of ["src/components/layout/BarraPlataforma.tsx", "src/components/layout/Footer.tsx", "src/lib/rotasPublicas.ts", "src/middleware.ts", "src/app/layout.tsx"]) {
      expect(fechos.judiciario.has(a), a).toBe(true);
      expect(fechos.agro.has(a), a).toBe(true);
    }
    for (const a of ["src/app/setor-eletrico/page.tsx", "src/app/saneamento/page.tsx", "src/app/contas-publicas/page.tsx", "src/app/gas-natural/page.tsx"]) {
      expect(fechos.judiciario.has(a), a).toBe(false);
      expect(fechos.agro.has(a), a).toBe(false);
    }
    expect(fechos.judiciario.has("src/components/eficiencia/judiciario/Figuras.tsx")).toBe(true);
    expect(fechos.agro.has("src/components/agro/Figuras.tsx")).toBe(true);
    // dados e configuração importados de fora de src/ entram no fecho de quem os usa
    expect(fechos.judiciario.has("public/eficiencia/judiciario/snapshot.json")).toBe(true);
    expect(fechos.agro.has("public/energia/geo/uf.json")).toBe(true);
    expect(fechos.agro.has("docs/agro/catalogo-artefatos.json")).toBe(true);
  });
  it("o fecho é o mesmo com e sem os arquivos de fora de src/ (checkout esparso do job)", () => {
    const esparso = { ...fs, existe: (p: string) => (p.startsWith("src/") || p.startsWith("scripts/")) && fs.existe(p) };
    for (const [nome, v] of Object.entries(VERIFICACOES)) {
      const completo = [...fechos[nome as "judiciario" | "agro"]].sort();
      expect([...fechoDeImportacoes(v.raizes, esparso)].sort(), nome).toEqual(completo);
    }
  });
  it("o fecho é um filtro de fato: fica abaixo de metade dos arquivos de src/ fora de testes", () => {
    const total = fechoDeImportacoes(["src/app", "src/components", "src/lib", "src/i18n", "src/middleware.ts"], fs).size;
    expect(fechos.judiciario.size).toBeLessThan(total / 2);
    expect(fechos.agro.size).toBeLessThan(total / 2);
  });
  it("os caminhos de src/ que os testes Python leem de verdade estão entre os literais colhidos", () => {
    // Alguns literais são fixtures sintéticas (src/lib/leitor.ts em test_publicar_gold): colher a mais só liga o job a mais.
    const literais = literaisPython(fs);
    for (const l of ["src/lib/frescor/limiares.json", "src/lib/eficiencia/indice-v4.ts", "src/lib/eficiencia/contornos-capitais.json"]) {
      expect(literais, l).toContain(l);
      expect(fs.existe(l), l).toBe(true);
    }
  });
});
