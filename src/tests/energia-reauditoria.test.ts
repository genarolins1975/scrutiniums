import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressões apontadas na reauditoria independente: proveniência de cada número
 * citado nos painéis, um único arredondamento, data de publicação da CCEE,
 * relação entre saldos e intercâmbio do SIN descrita a partir do dado e
 * linguagem causal sem rótulo em qualquer flexão.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

describe("proveniência por painel", () => {
  it("painéis da Visão geral e da Rede trazem a proveniência de cada número que citam", () => {
    const visao = ler("src/app/setor-eletrico/page.tsx");
    const rede = ler("src/app/setor-eletrico/rede/page.tsx");
    expect(visao).toContain("p: hid.proveniencia.ena30");
    expect(visao).toContain("ger.proveniencia.termica_7d");
    expect(visao).toContain("p: pld.proveniencia.diario");
    expect(rede).toContain("p: pld.proveniencia.diario");
    expect(ler("src/components/energia/PldPeriodos.tsx")).toContain('<SeloNatureza natureza="CALCULADO" />');
  });

  it("o cabeçalho do painel mostra um selo por natureza presente", () => {
    expect(ler("src/components/evidencia/PainelEvidencia.tsx")).toContain("complementares.map((c) => c.p.natureza)");
  });
});

describe("arredondamento único", () => {
  it("percentis e ENA de 30 dias são exibidos com uma casa, como na gold", () => {
    const arquivos = [
      "src/app/setor-eletrico/page.tsx",
      "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "src/app/setor-eletrico/geracao/page.tsx",
      "src/components/energia/CartoesPld.tsx",
      "src/lib/energia/conteudo/exemplos.ts",
    ];
    for (const f of arquivos) {
      const t = ler(f);
      expect(t, f).not.toMatch(/num\([^)]*percentil[^)]*,\s*0\)/);
      expect(t, f).not.toMatch(/pct\([^)]*pct_mlt_(30d|dia)[^)]*,\s*0\)/);
      expect(t, f).not.toMatch(/Math\.round\([^)]*percentil/);
      expect(t, f).not.toMatch(/percentil[^\n]*maximumFractionDigits: 0/);
    }
    const s = ler("pipeline/energia/gold/sintese.py");
    expect(s).not.toMatch(/nbr\([^)]*percentil[^)]*,\s*0\)/);
    expect(s).not.toMatch(/nbr\(n\['pct_mlt_30d'\],\s*0\)/);
  });
});

describe("datas e textos gerados a partir do dado", () => {
  it("nenhuma proveniência baseada no PLD da CCEE exibe data de publicação da fonte", () => {
    for (const g of ["pld.json", "rede.json"]) {
      const j = JSON.parse(ler(`public/energia/gold/${g}`));
      for (const p of Object.values(j.proveniencia) as { fonte: { orgao: string }; publicado_pela_fonte_em: string | null; indicador: string }[]) {
        if (p.fonte.orgao === "CCEE") expect(p.publicado_pela_fonte_em, `${g}: ${p.indicador}`).toBeNull();
      }
    }
  });

  it("a relação entre saldos e intercâmbio do SIN é descrita a partir do dado, sem afirmação fixa", () => {
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.balanco_sin).toBeTruthy();
    expect(r.balanco_sin.horas_total).toBeGreaterThan(0);
    expect(r.proveniencia.saldos.limitacoes[0]).toMatch(/intercâmbio do SIN/);
    for (const f of ["src/app/setor-eletrico/rede/page.tsx", "src/app/setor-eletrico/page.tsx", "pipeline/energia/gold/rede.py"]) {
      expect(ler(f), f).not.toMatch(/não se compensam|se compensam no SIN|que não é zero/);
    }
  });

  it("limitação do PLD lista as datas de captura por arquivo e a situação da última coleta", () => {
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    const lim = p.proveniencia.horario.limitacoes.join(" ");
    expect(lim).toMatch(/capturas primárias de \d{2}\/\d{2}\/\d{4} \(arquivo/);
    expect(lim).toMatch(/última tentativa de coleta direta|não foi tentada/);
  });
});

describe("linguagem causal sem rótulo", () => {
  it("não volta, em qualquer flexão", () => {
    const padroes = [/pression(a|am|ar|ando)\b/i, /rep(õe|or|ondo)\s+(o|esse|este)\s+estoque/i, /termômetro/i, /para a época/i];
    const arquivos = [
      "src/app/setor-eletrico/page.tsx",
      "src/app/setor-eletrico/pld/page.tsx",
      "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "src/app/setor-eletrico/geracao/page.tsx",
      "src/app/setor-eletrico/carga/page.tsx",
      "src/app/setor-eletrico/rede/page.tsx",
      "pipeline/energia/gold/sintese.py",
    ];
    for (const f of arquivos) for (const re of padroes) expect(ler(f), `${f}: ${re}`).not.toMatch(re);
    expect(ler("public/energia/gold/sintese.json")).not.toMatch(/para a época/);
  });
});
