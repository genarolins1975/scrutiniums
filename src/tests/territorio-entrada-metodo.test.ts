import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => "/territorio",
}));

import EntradaTerritorio from "@/app/territorio/page";
import MetodologiaTerritorio from "@/app/territorio/metodologia/page";
import sitemap from "@/app/sitemap";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { OBSERVATORIOS, observatorio } from "@/lib/observatorios/registro";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { escalaTerritorio } from "@/lib/observatorios/entradas/territorio";
import { portas } from "@/lib/perguntas/portas";
import { ROTULO_NAO_CONCLUIR, ROTULO_VALIDACOES, fontesTerritorio, itemReadme, lacunasTerritorio, lerReadmeTerritorio } from "@/lib/territorio/metodo";

const gold = (nome: string) => JSON.parse(readFileSync(join(process.cwd(), "public", "territorio", "gold", nome), "utf-8"));
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
/** O HTML escapa aspas e acentos não; basta normalizar o espaço fino que o React não altera. */
const html = (el: () => unknown) => renderToStaticMarkup(createElement(el as never));

describe("Território e Clima: rotas da entrada e do método", () => {
  it("só o método é aberto; a entrada, os painéis, as golds e o endereço antigo exigem conta", () => {
    for (const p of ["/territorio/metodologia", "/territorio/metodologia/"]) expect(ehRotaPublica(p), p).toBe(true);
    for (const p of [
      "/territorio", "/territorio/", "/territorio/queimadas", "/territorio/desastres", "/territorio/emissoes",
      "/territorio/gold/queimadas.json", "/territorio/gold/queimadas_municipios.json", "/territorio/metodologiax",
      "/observatorios/territorio-e-clima",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("o registro aponta a entrada e o método, e o sitemap lista o método e não a entrada", () => {
    const o = observatorio("territorio-e-clima");
    expect(o.entrada).toBe("/territorio");
    expect(o.metodo).toBe("/territorio/metodologia");
    const urls = sitemap().map((u) => new URL(u.url).pathname);
    expect(urls).toContain("/territorio/metodologia");
    for (const u of ["/territorio", "/territorio/queimadas", "/territorio/desastres", "/territorio/emissoes"]) expect(urls).not.toContain(u);
  });

  it("a camada aberta lista o método do Território e declara as lacunas de emissões por estado e de área queimada", () => {
    const p = portas().find((x) => x.id === "territorio-e-clima")!;
    expect(p.metodos.map((m) => m.href)).toContain("/territorio/metodologia");
    for (const m of p.metodos) expect(ehRotaPublica(m.href), m.href).toBe(true);
    expect(p.lacunas.join(" ")).toMatch(/Emissões oficiais por estado/);
    expect(p.lacunas.join(" ")).toMatch(/Área queimada por estado/);
  });

  it("os painéis linkam a entrada nova, e nenhuma página aponta para o endereço antigo", () => {
    for (const f of ["queimadas", "desastres", "emissoes"]) {
      const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", f, "page.tsx"), "utf-8");
      expect(fonte, f).toContain('href="/territorio"');
      expect(fonte, f).not.toContain("/observatorios/territorio-e-clima");
    }
    expect(OBSERVATORIOS.some((o) => o.entrada === "/observatorios/territorio-e-clima")).toBe(false);
  });
});

describe("Território e Clima: README de método", () => {
  it("cada fonte declara o que o número não permite concluir e as validações que retêm a publicação", () => {
    for (const rota of ["/territorio/queimadas", "/territorio/desastres", "/territorio/emissoes"]) {
      const s = lerReadmeTerritorio().find((x) => x.rota === rota);
      expect(s, rota).toBeDefined();
      expect(itemReadme(s, ROTULO_NAO_CONCLUIR), rota).toBeTruthy();
      expect(itemReadme(s, ROTULO_VALIDACOES), rota).toBeTruthy();
    }
    const nao = (r: string) => itemReadme(lerReadmeTerritorio().find((x) => x.rota === r), ROTULO_NAO_CONCLUIR)!;
    expect(nao("/territorio/queimadas")).toMatch(/foco de calor não é incêndio nem área queimada/);
    expect(nao("/territorio/desastres")).toMatch(/reconhecimento federal não é contagem de desastres/);
    expect(nao("/territorio/emissoes")).toMatch(/inventário oficial tem defasagem/);
  });

  it("as lacunas declaram emissões por estado e área queimada só por bioma", () => {
    const rotulos = lacunasTerritorio().map((l) => l.rotulo);
    expect(rotulos).toContain("Emissões por estado");
    expect(rotulos).toContain("Área queimada por estado e por município");
    expect(lacunasTerritorio().find((l) => l.rotulo === "Área queimada por estado e por município")!.texto).toMatch(/só por bioma/);
  });
});

describe("Território e Clima: entrada com conta", () => {
  const h = html(EntradaTerritorio);
  const q = gold("queimadas.json");
  const d = gold("desastres.json");
  const e = gold("emissoes.json");

  it("renderiza sem NaN nem undefined, com a pergunta do registro e no máximo quatro números", () => {
    expect(h).not.toMatch(/NaN|undefined|Infinity|\[object Object\]/);
    expect(h).toContain(observatorio("territorio-e-clima").pergunta);
    expect(h).toContain(portas().find((p) => p.id === "territorio-e-clima")!.pergunta);
    const escala = escalaTerritorio();
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) {
      expect(n.valor, n.rotulo).not.toBeNull();
      expect(h).toContain(n.valor as string);
      expect(h).toContain(`${n.fonte} · ${n.periodo}`);
    }
  });

  it("os números são os das golds", () => {
    const ano = q.anual.filter((a: { parcial: boolean; focos: number | null }) => !a.parcial && a.focos !== null).at(-1);
    expect(h).toContain(br(ano.focos));
    expect(h).toContain(br(q.comparacao.focosAtual));
    const rec = d.serie_anual.filter((a: { registros_reconhecidos: number | null }) => a.registros_reconhecidos !== null).at(-1);
    expect(h).toContain(br(rec.municipios_distintos_com_reconhecimento));
    expect(h).toContain(br(rec.registros_reconhecidos));
    for (const v of Object.values(rec.por_grupo_reconhecidos) as number[]) expect(h).toContain(br(v));
    expect(h).toContain(br(e.anos.at(-1).totalLiquido / 1000));
    for (const v of Object.values(e.derivados.participacaoUltimoAnoPct) as number[]) expect(h).toContain(br(v, 1));
  });

  it("todo painel do observatório está a um clique, com o modelo didático, as lacunas e o método recolhido no fim", () => {
    for (const c of colecoesDe("territorio-e-clima")) for (const p of c.paineis) expect(h, p.href).toContain(`href="${p.href}"`);
    expect(h).toContain("Do satélite ao foco de calor");
    expect(h).toContain("Modelo didático");
    expect(h).toContain("Teve fogo perto de você?");
    expect(h).toContain("Emissões por estado");
    expect(h).toContain("Área queimada por estado e por município");
    const metodo = h.slice(h.lastIndexOf("<details"));
    expect(metodo).toContain('href="/territorio/metodologia"');
    expect(h.indexOf("O que estes dados ainda não mostram")).toBeLessThan(h.lastIndexOf("<details"));
  });
});

describe("Território e Clima: método aberto", () => {
  const h = html(MetodologiaTerritorio);

  it("renderiza sem NaN nem undefined, com as três fontes e as datas de captura das golds", () => {
    expect(h).not.toMatch(/NaN|undefined|Infinity|\[object Object\]/);
    for (const [nome, chave] of [["queimadas.json", "capturadoEm"], ["desastres.json", "capturadoEm"], ["emissoes.json", "capturadoEm"]] as const) {
      expect(h, nome).toContain(dataBr(gold(nome)[chave]));
    }
    expect(h).toContain("INPE, Programa Queimadas");
    expect(h).toContain("Atlas Digital de Desastres");
    expect(h).toContain("SIRENE");
  });

  it("mostra o sha256 de cada original das golds", () => {
    const q = gold("queimadas.json");
    const shas = [
      ...Object.values(q.originais).map((o) => (o as { sha256: string }).sha256),
      q.areaQueimada.original.sha256,
      ...Object.values(gold("desastres.json").originais).map((o) => (o as { sha256: string }).sha256),
      ...gold("emissoes.json").originais.map((o: { sha256: string }) => o.sha256),
    ];
    expect(shas.length).toBeGreaterThan(30);
    for (const s of shas) expect(h, s).toContain(s);
    expect(fontesTerritorio().flatMap((f) => f.originais).every((o) => /^[0-9a-f]{64}$/.test(o.sha256))).toBe(true);
  });

  it("diz o que cada número não permite concluir, as validações e as lacunas, e marca o que exige conta", () => {
    expect(h).toContain("Foco de calor não é incêndio nem área queimada");
    expect(h).toContain("Reconhecimento federal não é contagem de desastres");
    expect(h).toContain("O inventário oficial tem defasagem");
    expect(h.match(/Validações que retêm a publicação/g)?.length).toBe(3);
    expect(h).toContain("Emissões por estado");
    expect(h).toContain("Área queimada por estado e por município");
    for (const r of ["/territorio/queimadas", "/territorio/desastres", "/territorio/emissoes", "/territorio/gold/queimadas.json"]) {
      const i = h.indexOf(`href="${r}"`);
      expect(i, r).toBeGreaterThan(-1);
      expect(h.slice(i, i + 600), r).toContain("com conta");
    }
    // links internos sem selo apontam para páginas abertas
    for (const m of h.matchAll(/href="(\/[^"#]*)"/g)) {
      const alvo = m[1];
      if (!ehRotaPublica(alvo)) expect(h.slice(m.index!, m.index! + 600), alvo).toContain("com conta");
    }
  });
});
