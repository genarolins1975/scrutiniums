import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

describe("auditoria final: regressões", () => {
  it("comparação anual da geração não atravessa a quebra de regime de 29/04/2023", () => {
    const g = JSON.parse(ler("public/energia/gold/geracao.json"));
    expect(g.inicio_regime_atual).toBe("2023-04-29");
    for (const a of g.comparacao_anual) {
      for (const j of ["7d", "30d"]) if (a[j]) expect(a[j].inicio >= g.inicio_regime_atual, `${a.ano} ${j}`).toBe(true);
    }
    for (const f of ["src/app/setor-eletrico/geracao/page.tsx", "pipeline/energia/gold/geracao.py"]) {
      expect(ler(f), f).not.toMatch(/não entra nesta conta|não faz parte do balanço|mostra a expansão de eólica e solar/);
    }
  });

  it("exemplo de liquidação não opera regra não conferida com número", () => {
    const t = ler("src/app/setor-eletrico/pld/page.tsx");
    expect(t).not.toMatch(/\d+\s*MWh\s*[×x]\s*R\$/);
    expect(t).toMatch(/não mostra valores de liquidação/);
  });

  it("amplitude entre submercados tem proveniência própria e sai de valores não arredondados", () => {
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.proveniencia.amplitude.natureza).toBe("CALCULADO");
    expect(r.proveniencia.amplitude.formula).toMatch(/max_s .* min_s/);
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    expect(typeof p.amplitude_dia).toBe("number");
    expect(ler("pipeline/energia/gold/sintese.py")).toContain('pld.get("amplitude_dia")');
    expect(typeof r.limiar_diferenca_dia).toBe("number");
    expect(ler("src/app/setor-eletrico/rede/page.tsx")).not.toMatch(/acima de R\$ 1[ ,]/);
  });

  it("nenhum percentual de ENA ou percentil é rearredondado para zero casas", () => {
    for (const f of ["pipeline/energia/gold/sintese.py"]) {
      expect(ler(f), f).not.toMatch(/nbr\([^)]*(pct_mlt_30d|percentil)[^)]*\]?\)?,\s*0\)/);
    }
  });

  it("revisões distinguem captura única de recaptura idêntica, e a página do conjunto lista todas as vintages", () => {
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    expect(typeof p.proveniencia.horario.revisoes_conhecidas.recapturas_sem_mudanca).toBe("number");
    const m = JSON.parse(ler("public/energia/gold/meta.json"));
    for (const [ds, f] of Object.entries(m.fontes) as [string, { historico: { vigente: boolean }[]; capturas: unknown[] }][]) {
      expect(f.historico.length, ds).toBeGreaterThanOrEqual(f.capturas.length);
      expect(f.historico.filter((x) => x.vigente).length, ds).toBe(f.capturas.length);
    }
    expect(ler("src/app/setor-eletrico/dados/[dataset]/page.tsx")).toContain("f?.historico");
    expect(ler("src/components/evidencia/SobreEsteDado.tsx")).toContain("recapturas_sem_mudanca");
  });

  it("conjuntos usados como entrada de modelo aparecem como UTILIZADO EM MODELO no catálogo", () => {
    const reg = JSON.parse(ler("pipeline/energia/registro_modelos.json"));
    const cat = JSON.parse(ler("public/energia/gold/catalogo.json"));
    const entrada = (id: string) => cat.entradas.find((e: { id: string }) => e.id === id);
    for (const m of reg.modelos) {
      if (/EAR/.test(m.dados_treinamento)) expect(entrada("ons:ear-diario-por-subsistema").modelos, m.codigo).toContain(m.codigo);
      if (/ENA/.test(m.dados_treinamento)) expect(entrada("ons:ena-diario-por-subsistema").modelos, m.codigo).toContain(m.codigo);
    }
  });

  it("documentação não afirma no presente o que ainda não está implementado", () => {
    expect(ler("docs/observatorios/ARQUITETURA_DADOS_ENERGIA.md")).not.toMatch(/Toda feature de modelo e todo backtest usam/);
    expect(ler("docs/observatorios/PLD_GOVERNANCA_PREVISAO.md")).not.toMatch(/\* Features vêm de/);
    expect(ler("src/app/setor-eletrico/metodologia/page.tsx")).not.toMatch(/\(bronze e silver\)/);
    for (const m of JSON.parse(ler("pipeline/energia/registro_modelos.json")).modelos) {
      expect(m.limitacoes.join(" "), m.codigo).not.toMatch(/não é revisado depois de publicado/);
    }
  });

  it("páginas pré-renderizadas não exibem undefined nem NaN (quando o build existe)", () => {
    const dir = join(raiz, ".next", "server", "app", "setor-eletrico");
    if (!existsSync(dir)) return;
    const htmls: string[] = [];
    const varre = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) varre(p);
        else if (e.name.endsWith(".html")) htmls.push(p);
      }
    };
    varre(dir);
    if (existsSync(join(raiz, ".next", "server", "app", "setor-eletrico.html"))) htmls.push(join(raiz, ".next", "server", "app", "setor-eletrico.html"));
    for (const h of htmls) {
      const texto = readFileSync(h, "utf-8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
      expect(texto, h).not.toMatch(/\bundefined\b|\bNaN\b/);
      // data crua (AAAA-MM, AAAA-MM-DD ou instante ISO) solta no texto; identificadores com "@" ou "_" ficam de fora
      expect(texto, h).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
    }
  });
});
