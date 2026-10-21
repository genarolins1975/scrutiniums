/**
 * Segurança alimentar, bases complementares (21/10/2026): EBIA por estado, CadINSAN, PNAE, PAA,
 * IPCA dos alimentos e SISVAN. Confere que cada medida aparece com fonte e período, que ausência
 * continua ausência (nunca zero), que a página mostra o valor publicado e não um recálculo, e que
 * as rotas e os arquivos continuam com conta (só o método é aberto).
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { dadosComplementares, type MunicipioComplementar } from "@/lib/eficiencia/alimentar/complementos";
import { colunas } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import Panorama from "@/app/eficiencia-estatal/seguranca-alimentar/page";
import Necessidades from "@/app/eficiencia-estatal/seguranca-alimentar/necessidades/page";
import Acesso from "@/app/eficiencia-estatal/seguranca-alimentar/acesso/page";
import Qualidade from "@/app/eficiencia-estatal/seguranca-alimentar/qualidade/page";
import Recursos from "@/app/eficiencia-estatal/seguranca-alimentar/recursos/page";
import Metodos from "@/app/eficiencia-estatal/seguranca-alimentar/metodos/page";

const raiz = process.cwd();
const PUB = join(raiz, "public/eficiencia/seguranca-alimentar");
const c = dadosComplementares();
const html = (Pagina: () => JSX.Element) => renderToStaticMarkup(createElement(Pagina)).replace(/<!-- -->/g, "");
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\s+/g, " ");
const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

describe("Segurança alimentar, bases complementares: procedência", () => {
  it("o seed versionado tem o hash do manifesto e a gold é desse seed", () => {
    const man = JSON.parse(readFileSync(join(raiz, "pipeline/eficiencia_alimentar/seed/complementos-manifesto.json"), "utf8"));
    const seed = readFileSync(join(raiz, "pipeline/eficiencia_alimentar/seed/complementos.json.gz"));
    expect(createHash("sha256").update(seed).digest("hex")).toBe(man.seed_sha256);
    expect(c.manifesto.seed_sha256).toBe(man.seed_sha256);
    expect(JSON.parse(gunzipSync(seed).toString()).versao).toBe(c.versao);
  });

  it("toda fonte tem endereço oficial, período e hash; toda ficha aponta para uma fonte", () => {
    expect(c.manifesto.fontes.length).toBeGreaterThanOrEqual(10);
    for (const f of c.manifesto.fontes) {
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.pagina).toMatch(/^https:\/\//);
      expect(f.periodo).toBeTruthy();
      expect(f.sha256 ?? f.conteudo).toMatch(/^[0-9a-f]{64}$/);
    }
    const ids = new Set(c.manifesto.fontes.map((f) => f.id));
    for (const f of c.fichas) {
      expect(ids.has(f.fonte_id), f.id).toBe(true);
      for (const campo of ["definicao", "universo", "periodo", "unidade", "territorio", "formula", "ausencias", "limitacoes"] as const) expect(f[campo], `${f.id}.${campo}`).toBeTruthy();
    }
    expect(c.nao_integrados.every((n) => n.base && n.motivo)).toBe(true);
  });
});

describe("Segurança alimentar, bases complementares: valores e ausências", () => {
  it("EBIA usa o percentual publicado pelo IBGE e não traz recorte urbano ou rural por estado", () => {
    const br = c.ebia.find((e) => e.nivel === "brasil" && e.ano === 2024 && e.situacao === "total")!;
    expect(br.classes.insegura.pct).toBe(24.2);
    expect(br.classes.grave.pct).toBe(3.2);
    expect(c.ebia.filter((e) => e.nivel === "uf").every((e) => e.situacao === "total")).toBe(true);
    expect(new Set(c.ebia.filter((e) => e.nivel === "uf").map((e) => e.codigo)).size).toBe(27);
  });

  it("CadINSAN: estado e Brasil são razão das somas do anexo, não média de percentuais", () => {
    const br = c.cadinsan.brasil;
    expect(br.municipios).toBe(5570);
    expect(br.pct_com_pbf).toBe(Math.round((1000 * br.com_pbf) / br.cadastros) / 10);
    const somaUf = Object.values(c.cadinsan.ufs).reduce((s, u) => s + u.cadastros, 0);
    expect(somaUf).toBe(br.cadastros);
  });

  it("PAA: a soma declara quantos municípios têm dado; município sem dado não vira zero", () => {
    for (const ano of Object.keys(c.paa)) {
      const a = c.paa[ano].brasil;
      expect(a.fornecedores.municipios_com_dado).toBeLessThan(a.municipios_universo);
    }
    let municipios = 0, semDado = 0;
    for (const u of c.ufs) {
      const rows = JSON.parse(readFileSync(join(PUB, `complementos-uf-${u.sigla}.json`), "utf8")) as MunicipioComplementar[];
      municipios += rows.length;
      semDado += rows.filter((m) => m.paa["2025"]?.[0] === null).length;
      for (const m of rows) for (const v of Object.values(m.paa)) if (v) expect(v.every((x) => x === null || x >= 0)).toBe(true);
    }
    expect(municipios).toBeGreaterThanOrEqual(5570);
    expect(semDado).toBe(c.paa["2025"].brasil.municipios_universo - c.paa["2025"].brasil.fornecedores.municipios_com_dado);
  });

  it("consulta municipal escreve a ausência com o motivo, nunca zero", () => {
    const vazio: MunicipioComplementar = { codigo: "5101837", nome: "Boa Esperança do Norte", cadinsan: null, paa: { "2023": [null, null], "2024": null, "2025": [null, null] }, pnae2025: null };
    for (const tema of ["necessidades", "acesso", "recursos"] as const) {
      for (const col of colunas(tema)) {
        const v = col.valor(vazio);
        expect(v, `${tema}: ${col.titulo}`).toMatch(/^(Fora do anexo|Sem )/);
        expect(v).not.toMatch(/^0/);
      }
    }
    const comZero: MunicipioComplementar = { ...vazio, paa: { "2025": [0, 0] } };
    expect(colunas("recursos").find((c) => c.titulo === "PAA: agricultores fornecedores, 2025")!.valor(comZero)).toBe("0");
  });
});

describe("Segurança alimentar, bases complementares: páginas", () => {
  it("Necessidades mostra EBIA por estado e CadINSAN com fonte, período e unidade", () => {
    const t = texto(html(Necessidades));
    expect(t).toContain("Como a insegurança alimentar varia entre os estados?");
    expect(t).toContain("tabela 9552");
    expect(t).toContain("Período: 2023 e 2024");
    expect(t).toContain("% dos domicílios");
    expect(t).toContain("Pernambuco");
    expect(t).toContain("MDS · CadINSAN 2025");
    expect(t).toContain("Cadastro Único de janeiro de 2025");
    expect(t).toContain("21.460.006");
    expect(t).toContain(fmt(c.cadinsan.brasil.pct_com_pbf) + "%");
  });

  it("Acesso mostra PNAE e IPCA com fonte e período, e marca 2026 como exercício em curso", () => {
    const t = texto(html(Acesso));
    expect(t).toContain("Quantos alunos estão cobertos pela alimentação escolar?");
    expect(t).toContain("FNDE · Plataforma Antonieta de Barros");
    expect(t).toContain("2026 (em curso)");
    expect(t).toContain("IBGE · IPCA · tabela 7060");
    expect(t).toContain("janeiro de 2023 a setembro de 2026");
    expect(t).toContain("set/2026");
  });

  it("Qualidade mostra o acompanhamento do SISVAN como preliminar e sem prevalência", () => {
    const t = texto(html(Qualidade));
    expect(t).toContain("Relatório de Gestão Integrado 2025");
    expect(t).toContain("2025, dados preliminares");
    expect(t).toContain("Gestantes não estão contabilizadas");
    expect(t).toContain(fmt(c.sisvan[0].cobertura) + "%");
  });

  it("Recursos mostra repasses do PNAE e o PAA com a cobertura de municípios", () => {
    const t = texto(html(Recursos));
    expect(t).toContain("Repasses federais informados");
    expect(t).toContain("R$ nominais");
    expect(t).toContain("MDS · MI Social · PAA");
    const br = c.paa["2025"].brasil;
    expect(t).toContain(`${br.fornecedores.municipios_com_dado.toLocaleString("pt-BR")} de ${br.municipios_universo.toLocaleString("pt-BR")}`);
  });

  it("o panorama leva aos quatro capítulos e mostra números de universos diferentes com fonte", () => {
    const h = html(Panorama);
    for (const rota of ["necessidades", "acesso", "qualidade", "recursos", "dados", "metodos"]) expect(h).toContain(`href="/eficiencia-estatal/seguranca-alimentar/${rota}"`);
    const t = texto(h);
    expect(t).toContain("MDS, CadINSAN");
    expect(t).toContain("FNDE, PNAE");
    expect(t).toContain("IBGE, IPCA");
    expect(t).toContain("Não se somam nem se comparam entre si");
  });

  it("o método traz a ficha de cada medida, as fontes com hash e o que não foi integrado, sem valores dos dados", () => {
    const h = html(Metodos);
    for (const f of c.fichas) expect(h).toContain(`id="${f.id}"`);
    for (const f of c.manifesto.fontes) expect(h).toContain(f.sha256 ?? f.conteudo!);
    const t = texto(h);
    expect(t).toContain("Não integrado");
    for (const n of c.nao_integrados) expect(t).toContain(n.base);
    expect(t).not.toContain(fmt(c.cadinsan.brasil.pct_com_pbf) + "%");
  });
});

describe("Segurança alimentar, bases complementares: acesso", () => {
  it("os capítulos e os arquivos pedem conta; só o método é aberto", () => {
    for (const r of ["", "/necessidades", "/acesso", "/qualidade", "/recursos", "/dados"]) expect(ehRotaPublica(`/eficiencia-estatal/seguranca-alimentar${r}`), r || "panorama").toBe(false);
    expect(ehRotaPublica("/eficiencia-estatal/seguranca-alimentar/metodos")).toBe(true);
    for (const arq of ["complementos.json", "complementos-uf-PE.json", "cadinsan.csv", "paa.csv", "pnae.csv", "ebia-territorios.csv", "ipca-alimentacao.csv", "sisvan.csv"]) {
      expect(ehRotaPublica(`/eficiencia/seguranca-alimentar/${arq}`), arq).toBe(false);
    }
  });

  it("HTML gerado de cada capítulo cabe no teto de 600 kB (quando há build)", (ctx) => {
    const app = join(raiz, ".next/server/app/eficiencia-estatal");
    if (!existsSync(join(app, "seguranca-alimentar.html"))) ctx.skip("sem build local");
    for (const r of ["seguranca-alimentar", ...["necessidades", "acesso", "qualidade", "recursos", "dados", "metodos"].map((s) => `seguranca-alimentar/${s}`)]) {
      expect(statSync(join(app, `${r}.html`)).size, r).toBeLessThan(600_000);
    }
  });
});
