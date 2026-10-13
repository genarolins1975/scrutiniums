import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DOMINIOS } from "@/lib/dominios";
import { ACESSO, N_OBSERVATORIOS, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";

/**
 * Uma só promessa sobre cadastro e escopo. Até 13/10/2026 a home e o rodapé diziam
 * "leitura aberta, conta opcional" e /resumo, /dados, /dados/[slug] e o formulário
 * de perfil diziam "o cadastro é a única exigência"; o layout dizia "Três
 * observatórios" com cinco no registro. O middleware só protege /app.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

function arquivos(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(join(raiz, dir))) {
    const p = join(raiz, dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(relative(raiz, p), ext));
    else if (ext.test(nome)) out.push(relative(raiz, p));
  }
  return out;
}

// texto que chega ao leitor: código da interface e da SPA, sem os testes e sem linhas de comentário
const FONTES = [
  ...arquivos("src", /\.(tsx?|mjs)$/).filter((p) => !p.startsWith("src/tests/")),
  "public/obs/index.html",
  "public/obs/app.js",
];
const linhasVisiveis = (p: string) =>
  ler(p)
    .split("\n")
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => !/^\s*(\/\/|\/?\*)/.test(l));

// Desde 13/10/2026 os painéis exigem conta: nenhum texto visível volta a prometer leitura sem cadastro.
const FRASES_ANTIGAS = [
  /leitura (é )?aberta/i,
  /abert[oa]s? para leitura/i,
  /aberto,? sem cadastro/i,
  /abertos,? sem cadastro/i,
  /sem cadastro e sem (cobrança|chave)/i,
  /acesso gratuito sem cadastro/i,
  /a conta é opcional/i,
  /guarda preferências e a área de painéis/i,
];

const EXTENSO: Record<string, number> = { um: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };

describe("acesso: uma promessa", () => {
  it("o middleware só libera a lista pública; painéis exigem sessão", () => {
    const m = ler("src/middleware.ts");
    expect(m).toContain("if (ehRotaPublica(pathname)) return NextResponse.next();");
    expect(m).toContain('matcher: ["/((?!_next/static|_next/image).*)"]');
  });

  it("nenhuma página volta a prometer leitura sem cadastro", () => {
    const achados: string[] = [];
    for (const p of FONTES)
      for (const { l, n } of linhasVisiveis(p))
        for (const re of FRASES_ANTIGAS) if (re.test(l)) achados.push(`${p}:${n}: ${l.trim().slice(0, 120)}`);
    expect(achados).toEqual([]);
  });

  it("as páginas que falam de acesso leem a fonte única", () => {
    for (const p of [
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/components/layout/Footer.tsx",
      "src/components/home/SecaoAcesso.tsx",
      "src/components/onboarding/PerfilForm.tsx",
      "src/components/dados/ChamadaObservatorio.tsx",
      "src/app/observatorio-do-credito/page.tsx",
    ])
      expect(ler(p), p).toMatch(/from "@\/lib\/acesso"/);
    for (const p of ["src/app/resumo/page.tsx", "src/app/dados/page.tsx", "src/app/dados/[slug]/page.tsx"])
      expect(ler(p), p).toContain("<ChamadaObservatorio");
  });

  it("a conta só promete o que existe no código", () => {
    // boletim mensal: consentimento gerenciável na conta e envio pela rota do boletim
    expect(ACESSO.conta).toMatch(/boletim mensal/);
    expect(ler("src/app/app/(foco)/conta/page.tsx")).toMatch(/title="Boletim mensal"/);
    expect(ler("src/lib/boletim.ts")).toContain("marketingOptIn");
    expect(ACESSO.conta).toMatch(/painéis/);
    expect(ACESSO.leitura).toMatch(/quem tem conta/);
    expect(ACESSO.leitura).toMatch(/gratuito/);
  });
});

describe("escopo: a contagem vem do registro", () => {
  it("a fonte única conta o registro", () => {
    expect(N_OBSERVATORIOS).toBe(DOMINIOS.length);
    for (const d of DOMINIOS) expect(listaObservatorios()).toContain(d.nomeCurto);
    expect(EXTENSO[observatoriosPorExtenso().split(" ")[0]]).toBe(DOMINIOS.length);
  });

  it("nenhum texto visível traz contagem de observatórios divergente do registro", () => {
    const re = /\b(um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove)\s+observatórios\b/gi;
    const achados: string[] = [];
    for (const p of FONTES)
      for (const { l, n } of linhasVisiveis(p))
        for (const m of l.matchAll(re))
          if (EXTENSO[m[1].toLowerCase()] !== DOMINIOS.length) achados.push(`${p}:${n}: ${m[0]}`);
    expect(achados).toEqual([]);
  });

  it("metadados do layout e da home usam a lista do registro", () => {
    expect(ler("src/app/layout.tsx")).toMatch(/observatoriosPorExtenso\(true\)/);
    expect(ler("src/app/layout.tsx")).not.toMatch(/Três observatórios/);
    expect(ler("src/app/page.tsx")).toContain("listaObservatorios()");
  });
});
