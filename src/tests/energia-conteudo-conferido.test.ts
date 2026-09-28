import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { NOS_FORMACAO, PLD_NAO_E } from "@/lib/energia/conteudo/pld";

/**
 * Regra "nenhuma definição de memória" (auditoria independente, achado A1):
 * o que está marcado como conferido tem fonte primária com trecho; o que não
 * tem trecho fica como pendente. E cada número calculado da interface usa a
 * proveniência calculada correspondente (achado A2).
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

describe("verbetes conferidos", () => {
  it("todo verbete CONFERIDO tem data de conferência e ao menos uma fonte com trecho", () => {
    for (const c of CONCEITOS.filter((x) => x.estado === "CONFERIDO")) {
      expect(c.conferidoEm, c.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.fontes.some((f) => (f.trecho ?? "").length > 40), c.slug).toBe(true);
      for (const f of c.fontes) expect(f.url, `${c.slug}: ${f.documento}`).toMatch(/^https:\/\//);
    }
  });

  it("verbete PENDENTE não publica definição nem mecanismo", () => {
    for (const c of CONCEITOS.filter((x) => x.estado === "PENDENTE")) {
      expect(c.emUmaFrase, c.slug).toBeUndefined();
      expect(c.porQueImporta, c.slug).toBeUndefined();
      expect(c.fontePlanejada, c.slug).toBeTruthy();
    }
  });

  it("todo trecho citado aparece literalmente na captura primária quando ela está versionada", () => {
    // a descrição oficial do PLD está na captura package_show do seed da CCEE
    const pkg = ler("pipeline/energia/seed/ccee_pld_horario/v20260927T154402Z/package_show.json");
    const pld = CONCEITOS.find((c) => c.slug === "pld")!;
    const ccee = pld.fontes.find((f) => f.orgao === "CCEE")!;
    expect(JSON.parse(pkg).result.organization.description).toContain(ccee.trecho!);
  });
});

describe("diagrama de formação e \"o que o PLD não é\"", () => {
  it("relação CONFERIDA cita fonte; relação sem fonte primária acessada é PENDENTE", () => {
    for (const n of NOS_FORMACAO) {
      const r = n.relacaoSaida;
      if (!r) continue;
      if (r.conferencia === "CONFERIDO") expect(r.fonte, n.id).not.toMatch(/não acessada/);
      if (/não acessada/.test(r.fonte)) expect(r.conferencia, n.id).toBe("PENDENTE");
    }
  });

  it("item conferido não carrega mecanismo marcado como pendente", () => {
    for (const i of PLD_NAO_E) {
      if (i.conferencia === "CONFERIDO") expect(i.base, i.titulo).not.toMatch(/pendente/);
    }
  });
});

describe("contrato de proveniência da interface", () => {
  it("números calculados usam a proveniência calculada correspondente", () => {
    const agua = ler("src/app/setor-eletrico/agua-e-clima/page.tsx");
    expect(agua).toContain("proveniencia={h.proveniencia.ena30}");
    expect(agua).toContain("p: h.proveniencia.padrao");
    expect(agua).toContain("h.proveniencia.ear_mensal");
    const rede = ler("src/app/setor-eletrico/rede/page.tsx");
    expect(rede).toContain("r.proveniencia.saldos");
    const pld = ler("src/app/setor-eletrico/pld/page.tsx");
    expect(pld).toContain("pld.proveniencia.estatisticas");
    expect(pld).not.toMatch(/id="periodos"[\s\S]{0,200}natureza="OBSERVADO"/);
  });

  it("a gold traz as proveniências calculadas que a interface usa", () => {
    const h = JSON.parse(ler("public/energia/gold/hidrologia.json"));
    for (const k of ["ena30", "padrao", "ear_mensal"]) expect(h.proveniencia[k].natureza, k).toBe("CALCULADO");
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.proveniencia.saldos.natureza).toBe("CALCULADO");
    expect(r.proveniencia.saldos.fonte.dataset).toMatch(/Balanço/);
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    expect(p.proveniencia.estatisticas.natureza).toBe("CALCULADO");
  });

  it("revisões conhecidas vêm da detecção nas vintages, não de texto fixo", () => {
    for (const g of ["pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json"]) {
      const j = JSON.parse(ler(`public/energia/gold/${g}`));
      for (const p of Object.values(j.proveniencia) as { revisoes_conhecidas: { total: number; detectado_em: string } | null }[]) {
        expect(p.revisoes_conhecidas, g).not.toBeNull();
        expect(typeof p.revisoes_conhecidas!.total, g).toBe("number");
      }
    }
  });

  it("exemplo real de verbete marca a natureza de cada número", () => {
    const t = ler("src/lib/energia/conteudo/exemplos.ts");
    expect(t).not.toMatch(/natureza: "OBSERVADO", href/);
    expect(t).toContain('"CALCULADO"');
  });
});
