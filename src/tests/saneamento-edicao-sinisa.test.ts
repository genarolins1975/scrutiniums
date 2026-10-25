import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import { sinisa } from "../../public/saneamento/gold/meta.json";
import { goldContratado } from "@/lib/saneamento/contratos";
import { prestadores } from "@/lib/saneamento/gold";
import { apresentarEdicaoSinisa, rotuloSinisa } from "@/lib/saneamento/edicao";
import { htmlDe, subirServidor, type ServidorProducao } from "./suporte/servidor-producao";

/** Onda S1, pacote A, pedido do dono em 25/10/2026: edição e referência vêm da gold, sem fixar sua próxima publicação. */
function textoDoHtml(html: string): string {
  const no = parse(html);
  function ler(n: { nodeName: string; value?: string; childNodes?: unknown[] }): string {
    if (["script", "style"].includes(n.nodeName)) return "";
    if (n.nodeName === "#text") return n.value ?? "";
    return (n.childNodes ?? []).map((c) => ler(c as typeof n)).join(" ");
  }
  return ler(no).replace(/\s+/g, " ");
}

function conferir(html: string, rota: string): string {
  const texto = textoDoHtml(html);
  // O erro era usar o ano de referência como edição. A regra acompanha a próxima gold.
  const edicaoErrada = `SINISA ${sinisa.ano_referencia}`;
  // Contratado mantém a proveniência congelada: uma edição histórica com sua referência correta é legítima.
  const congelada = goldContratado()?.referencia_posicao;
  const fonteCongelada = congelada ? { edicao: congelada.sinisa_edicao, ano_referencia: congelada.sinisa_ano } : null;
  const semRotulosHistoricos = (conteudo: string) => fonteCongelada
    ? [rotuloSinisa("completa", fonteCongelada), rotuloSinisa("curta", fonteCongelada)]
      .reduce((resto, rotulo) => resto.split(rotulo).join(""), conteudo)
    : conteudo;
  if (sinisa.edicao !== edicaoErrada) {
    expect(semRotulosHistoricos(texto), rota).not.toContain(edicaoErrada);
    expect(semRotulosHistoricos(html), `${rota}: inclusive os dados de hidratação`).not.toContain(edicaoErrada);
  }
  expect(texto, rota).not.toMatch(/\b(?:undefined|NaN)\b/);
  return texto;
}

describe("rótulos do SINISA derivados da proveniência", () => {
  it("distingue edição, ano e as duas apresentações decididas no pacote A", () => {
    expect(rotuloSinisa()).toBe(`${sinisa.edicao}, ano de referência ${sinisa.ano_referencia}`);
    expect(rotuloSinisa("curta")).toBe(`${sinisa.edicao} (ref. ${sinisa.ano_referencia})`);
    expect(rotuloSinisa("ano")).toBe(String(sinisa.ano_referencia));
    expect(rotuloSinisa("edicao")).toBe(sinisa.edicao);
  });

  it("preserva a referência congelada quando a gold municipal avança", () => {
    const anterior = { edicao: `SINISA ${sinisa.ano_referencia}`, ano_referencia: sinisa.ano_referencia - 1 };
    expect(rotuloSinisa("completa", anterior)).toBe(`${anterior.edicao}, ano de referência ${anterior.ano_referencia}`);
    expect(rotuloSinisa("curta", anterior)).toBe(`${anterior.edicao} (ref. ${anterior.ano_referencia})`);
    expect(rotuloSinisa("ano", anterior)).toBe(String(anterior.ano_referencia));
    expect(rotuloSinisa("completa", anterior)).not.toBe(rotuloSinisa());
  });

  it("explicita edição ausente sem inferi-la do ano de referência", () => {
    const fonte = { edicao: null, ano_referencia: sinisa.ano_referencia };
    expect(rotuloSinisa("edicao", fonte)).toBe("SINISA, edição não informada");
    expect(rotuloSinisa("completa", fonte)).toBe(`SINISA, edição não informada, ano de referência ${fonte.ano_referencia}`);
    expect(rotuloSinisa("ano", fonte)).toBe(String(fonte.ano_referencia));
  });

  it("apresenta notas legadas sem alterar a nota original nem outra fonte", () => {
    const nota = "Vínculo do SINISA 2024; Censo 2022.";
    expect(apresentarEdicaoSinisa(nota)).toBe(`Vínculo do ${rotuloSinisa()}; Censo 2022.`);
    expect(nota).toBe("Vínculo do SINISA 2024; Censo 2022.");
  });
});

describe("edição no HTML do build do Saneamento", () => {
  let servidor: ServidorProducao | undefined;
  beforeAll(async () => {
    expect(existsSync(join(process.cwd(), ".next/BUILD_ID")), "rode npm run build antes deste teste de HTML").toBe(true);
    servidor = await subirServidor("saneamento-edicao");
  }, 120_000);
  afterAll(async () => { await servidor?.parar(); });

  it("nenhuma página estática confunde a edição com o ano dos dados", () => {
    const base = join(process.cwd(), ".next/server/app");
    const arquivos = readdirSync(join(base, "saneamento"), { recursive: true })
      .map(String).filter((p) => p.endsWith(".html"));
    expect(arquivos.length, "a verificação precisa percorrer os capítulos do build").toBeGreaterThan(15);
    for (const arquivo of ["saneamento.html", ...arquivos.map((p) => `saneamento/${p}`)]) {
      const html = readFileSync(join(base, arquivo), "utf8");
      conferir(html, arquivo);
    }
  });

  it.each([
    ["/saneamento", true],
    ["/saneamento/municipio/2611606", true],
    ["/saneamento/municipio?ibge=2611606", false],
    [`/saneamento/prestadores/${prestadores()[0].id}`, true],
  ] as const)("%s mostra a edição da gold no documento servido", async (rota, comSessao) => {
    const { status, html } = await htmlDe(servidor!, rota, comSessao);
    expect(status, rota).toBe(200);
    const texto = conferir(html, rota);
    expect(texto, rota).toContain(sinisa.edicao);
    if (rota === "/saneamento") expect(texto, rota).toContain(rotuloSinisa("curta"));
    if (rota.includes("municipio")) expect(texto, rota).toContain(rotuloSinisa());
    expect(texto, rota).toContain(String(sinisa.ano_referencia));
    if (rota.includes("municipio") && rota.includes("2611606")) {
      // O dono pediu a frase "Não permite: somar com o Censo" em vez de "Não permite concluir. Água: Somar".
      expect(texto, rota).toContain("Não permite: somar com o Censo");
      expect(texto, rota).not.toMatch(/Não permite concluir\.?\s*Água[.:]/);
    }
  }, 60_000);
});
