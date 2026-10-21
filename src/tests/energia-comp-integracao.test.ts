import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NAO_SE_APLICA as NAO_ESCALAS } from "@/lib/energia/escalas";
import { NAO_SE_APLICA as NAO_MAPA_CALOR, estadoCelula } from "@/lib/energia/mapa-calor";
import { estadoRegiao } from "@/lib/energia/mapa-coropletico";

/**
 * Integração da biblioteca de componentes do Setor Elétrico
 * (docs/observatorios/COMPONENTES_ENERGIA.md). Estes casos protegem contra
 * defeitos que só aparecem quando as peças são usadas juntas numa página do
 * App Router, e que os testes de cada componente não veem:
 *
 *  1. módulo "use client" só exporta componentes, hooks e tipos. Uma constante
 *     ou função utilitária exportada dali chega ao Server Component como
 *     referência de cliente: `URL_GEO.uf` lança erro no servidor e
 *     `NAO_SE_APLICA` deixa de ser o texto que a classificação reconhece, e o
 *     "não se aplica" vira "sem dado" em silêncio. Constantes e funções puras
 *     ficam em src/lib/energia;
 *  2. "não se aplica" é um marcador só no domínio: a mesma matriz ou o mesmo
 *     dicionário de valores serve ao mapa de calor e ao mapa coroplético;
 *  3. dica flutuante (position absolute) não usa w-max: com largura pelo
 *     conteúdo, perto da borda direita ela passava da borda do gráfico e criava
 *     rolagem horizontal na página do celular.
 */

const PASTA = join(process.cwd(), "src/components/energia");
const arquivos = readdirSync(PASTA).filter((n) => /\.(tsx|ts)$/.test(n));
const fonte = (n: string) => readFileSync(join(PASTA, n), "utf-8");
const ehCliente = (t: string) => /^\s*["']use client["'];?/.test(t);

describe("módulos 'use client' exportam só componentes, hooks e tipos", () => {
  for (const n of arquivos) {
    const t = fonte(n);
    if (!ehCliente(t)) continue;
    it(n, () => {
      const proibidos: string[] = [];
      for (const m of Array.from(t.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm))) {
        const [, tipo, nome] = m;
        const componente = (tipo === "function" || tipo === "class") && /^[A-Z]/.test(nome);
        const hook = tipo === "function" && /^use[A-Z]/.test(nome);
        if (!componente && !hook) proibidos.push(`${tipo} ${nome}`);
      }
      for (const m of Array.from(t.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm))) {
        if (m[1]) continue; // export type { ... }
        for (const item of m[2].split(",").map((x: string) => x.trim()).filter(Boolean)) {
          if (!item.startsWith("type ")) proibidos.push(`reexportação de valor: ${item}`);
        }
      }
      expect(proibidos, `${n}: mova para src/lib/energia (ou exporte só o tipo)`).toEqual([]);
    });
  }
});

describe("'não se aplica' é um marcador só", () => {
  it("escalas.ts e mapa-calor.ts usam o mesmo valor, e os dois mapas o reconhecem", () => {
    expect(NAO_MAPA_CALOR).toBe(NAO_ESCALAS);
    expect(estadoCelula(NAO_ESCALAS)).toBe("nao-se-aplica");
    expect(estadoRegiao(NAO_MAPA_CALOR)).toBe("nao-se-aplica");
    // zero continua valor e ausência continua "sem dado" nos dois
    expect(estadoCelula(0)).toBe("valor");
    expect(estadoRegiao(0)).toBe("valor");
    expect(estadoCelula(null)).toBe("sem-dado");
    expect(estadoRegiao(undefined)).toBe("sem-dado");
  });
});

describe("dica flutuante não cria rolagem horizontal", () => {
  for (const n of arquivos) {
    const t = fonte(n);
    it(n, () => {
      const classes = Array.from(t.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)).map((m) => m[1] ?? m[2]);
      const ruins = classes.filter((c) => /(^|\s)absolute(\s|$)/.test(c) && /(^|\s)w-max(\s|$)/.test(c));
      expect(ruins).toEqual([]);
    });
  }
});
