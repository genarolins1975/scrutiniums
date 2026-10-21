import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MercadoPage from "@/app/setor-eletrico/mercado/page";
import { GraficoLivreUf } from "@/components/energia/GraficoLivreUf";
import { mesAno, num, pct } from "@/lib/energia/formato";
import { barrasUf } from "@/lib/energia/mercado";
import { barrasUfVolume, contrasteUf, textoContrasteUf, textoUfsSemJanela, ufsSemJanela } from "@/lib/energia/mercado-uf";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

/**
 * Mercado livre por UF em duas medidas (participação e volume de energia): o volume vem da gold, converte só a unidade (MWh para GWh),
 * usa a mesma janela e as mesmas UFs da participação, e fecha com a soma de 12 meses do CSV por UF, lido por outro caminho. Roraima não tem
 * consumo livre na série da EPE: fica fora dos dois gráficos e a ausência é escrita, nunca barra zero. As frases saem dos números da gold.
 */
const raiz = process.cwd();
const G: MercadoGold = JSON.parse(readFileSync(join(raiz, "public/energia/gold/mercado.json"), "utf-8"));
const clone = <T,>(x: T): T => structuredClone(x);
const ate = G.livre_regulado.epe_ultimo_mes_uf!;

/** Os 12 meses (AAAA-MM) que terminam em `fim`. */
function janela12(fim: string): string[] {
  const [a, m] = fim.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const k = a * 12 + (m - 1) - (11 - i);
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
  });
}

/** Soma de 12 meses por UF e tipo, e os meses presentes, direto do CSV por UF publicado (outro caminho que a gold). */
function doCsv() {
  const linhas = readFileSync(join(raiz, "public/energia/series/mercado_consumo_uf.csv"), "utf-8").trim().split(/\r?\n/);
  const cab = linhas[0].split(";");
  const [iMes, iUf, iTipo, iMwh] = ["mes", "uf", "tipo", "consumo_mwh"].map((c) => cab.indexOf(c));
  const meses = new Set(janela12(ate));
  const soma = new Map<string, number>();
  const presentes = new Map<string, Set<string>>();
  for (const l of linhas.slice(1)) {
    const c = l.split(";");
    if (!meses.has(c[iMes])) continue;
    const chave = `${c[iUf]}|${c[iTipo]}`;
    soma.set(chave, (soma.get(chave) ?? 0) + Number(c[iMwh]));
    if (!presentes.has(chave)) presentes.set(chave, new Set());
    presentes.get(chave)!.add(c[iMes]);
  }
  return { soma, presentes, meses };
}

describe("mercado por UF: volume de energia", () => {
  it("copia livre e cativo da gold em GWh, do maior para o menor volume livre, sem reordenar a gold", () => {
    const antes = G.livre_regulado.epe_uf_12m.map((u) => u.chave);
    const v = barrasUfVolume(G);
    expect(G.livre_regulado.epe_uf_12m.map((u) => u.chave)).toEqual(antes);
    expect(v).toHaveLength(26);
    for (let i = 1; i < v.length; i++) expect(v[i - 1].livre, v[i].uf).toBeGreaterThanOrEqual(v[i].livre);
    for (const x of v) {
      const g = G.livre_regulado.epe_uf_12m.find((u) => u.chave === x.uf)!;
      expect(x.livre, x.uf).toBe(g.livre_mwh! / 1e3);
      expect(x.cativo, x.uf).toBe(g.cativo_mwh! / 1e3);
      // a participação publicada é a razão das duas partes: o volume e a participação contam a mesma história
      expect(Math.abs((100 * x.livre) / (x.livre + x.cativo) - g.livre_pct!), x.uf).toBeLessThanOrEqual(0.0051);
    }
  });

  it("usa as mesmas UFs do gráfico de participação", () => {
    expect(new Set(barrasUfVolume(G).map((x) => x.uf))).toEqual(new Set(barrasUf(G).map((x) => x.uf)));
    // com ausência nas três medidas de uma UF, as duas visões a deixam de fora juntas
    const g = clone(G);
    const ap = g.livre_regulado.epe_uf_12m.find((u) => u.chave === "AP")!;
    Object.assign(ap, { livre_mwh: null, cativo_mwh: null, livre_pct: null, livre_uc: null });
    expect(new Set(barrasUfVolume(g).map((x) => x.uf))).toEqual(new Set(barrasUf(g).map((x) => x.uf)));
    expect(barrasUfVolume(g)).toHaveLength(25);
  });

  it("fecha com a soma de 12 meses do CSV por UF, lida por outro caminho", () => {
    const { soma } = doCsv();
    // a gold guarda MWh inteiros e o CSV, três casas por linha: a soma de 12 meses difere em até 1 MWh (0,001 GWh), 7 partes em 1 bilhão
    for (const x of barrasUfVolume(G)) {
      expect(Math.abs(x.livre - (soma.get(`${x.uf}|livre`) ?? NaN) / 1e3), `${x.uf} livre`).toBeLessThan(0.001);
      expect(Math.abs(x.cativo - (soma.get(`${x.uf}|cativo`) ?? NaN) / 1e3), `${x.uf} cativo`).toBeLessThan(0.001);
    }
  });

  it("as UFs sem janela completa na gold são as que o CSV não traz com os 12 meses nos dois tipos (Roraima não tem consumo livre)", () => {
    const { presentes, meses } = doCsv();
    const semJanelaNoCsv = Array.from(new Set(Array.from(presentes.keys()).map((k) => k.split("|")[0])))
      .concat(G.livre_regulado.epe_uf_12m.map((u) => u.chave))
      .filter((uf, i, todas) => todas.indexOf(uf) === i)
      .filter((uf) => ["livre", "cativo"].some((t) => (presentes.get(`${uf}|${t}`)?.size ?? 0) < meses.size))
      .sort();
    expect(ufsSemJanela(G).sort()).toEqual(semJanelaNoCsv);
    expect(ufsSemJanela(G)).toEqual(["RR"]);
    expect(presentes.get("RR|livre")).toBeUndefined();
    expect(barrasUfVolume(G).map((x) => x.uf)).not.toContain("RR");
  });
});

describe("mercado por UF: o que a ausência e o contraste escrevem", () => {
  it("a ausência vem escrita no singular e no plural, e some quando todas as UFs têm janela", () => {
    expect(textoUfsSemJanela(G)).toBe("Roraima fica de fora: a série da EPE por UF não tem a janela completa de 12 meses do estado, e ausência de dado não é zero.");
    const g = clone(G);
    for (const sigla of ["AP", "AC"]) Object.assign(g.livre_regulado.epe_uf_12m.find((u) => u.chave === sigla)!, { livre_mwh: null, cativo_mwh: null, livre_pct: null, livre_uc: null });
    expect(textoUfsSemJanela(g)).toBe("Acre, Amapá e Roraima ficam de fora: a série da EPE por UF não tem a janela completa de 12 meses dos estados, e ausência de dado não é zero.");
    const completa = clone(G);
    Object.assign(completa.livre_regulado.epe_uf_12m.find((u) => u.chave === "RR")!, { livre_mwh: 1000, cativo_mwh: 1000, livre_pct: 50, livre_uc: 1 });
    expect(textoUfsSemJanela(completa)).toBeNull();
    expect(barrasUfVolume(completa)).toHaveLength(27);
  });

  it("contraste: a maior participação e o maior volume saem da gold, com a posição de cada uma na outra medida", () => {
    const c = contrasteUf(G)!;
    const porPct = barrasUf(G);
    const porVol = barrasUfVolume(G);
    expect(c.total).toBe(26);
    expect(c.maiorParticipacao.uf).toBe(porPct[0].uf);
    expect(c.maiorParticipacao.pct).toBe(porPct[0].livre);
    expect(c.maiorParticipacao.posicaoVolume).toBe(porVol.findIndex((x) => x.uf === porPct[0].uf) + 1);
    expect(c.maiorVolume.uf).toBe(porVol[0].uf);
    expect(c.maiorVolume.livreGwh).toBe(porVol[0].livre);
    expect(c.maiorVolume.posicaoParticipacao).toBe(porPct.findIndex((x) => x.uf === porVol[0].uf) + 1);
    // os dois rankings não são o mesmo: é para isso que a opção de volume existe
    expect(c.maiorParticipacao.uf).not.toBe(c.maiorVolume.uf);
    expect(c.maiorParticipacao.posicaoVolume).toBeGreaterThan(1);
    const texto = textoContrasteUf(G)!;
    expect(texto).toBe(
      `Maior participação do livre: Pará, ${pct(c.maiorParticipacao.pct, 1)}, que é o ${c.maiorParticipacao.posicaoVolume}º em volume livre (${num(c.maiorParticipacao.livreGwh, 0)} GWh). ` +
        `Maior volume livre: São Paulo, ${num(c.maiorVolume.livreGwh, 0)} GWh, com participação de ${pct(c.maiorVolume.pct, 1)}, a ${c.maiorVolume.posicaoParticipacao}ª maior entre as 26 UFs com dado.`,
    );
  });

  it("contraste: quando a mesma UF lidera nas duas medidas a frase é uma só, e sem duas UFs com dado não há frase", () => {
    const g = clone(G);
    Object.assign(g.livre_regulado.epe_uf_12m.find((u) => u.chave === "PA")!, { livre_mwh: 900_000_000, cativo_mwh: 100_000_000, livre_pct: 90 });
    expect(contrasteUf(g)!.maiorParticipacao.uf).toBe("PA");
    expect(contrasteUf(g)!.maiorVolume.uf).toBe("PA");
    expect(textoContrasteUf(g)).toBe(`Maior participação e maior volume livre: Pará, 90,0% e ${num(900_000, 0)} GWh, entre as 26 UFs com dado.`);
    const quase = clone(G);
    quase.livre_regulado.epe_uf_12m = quase.livre_regulado.epe_uf_12m.filter((u) => u.chave === "SP");
    expect(contrasteUf(quase)).toBeNull();
    expect(textoContrasteUf(quase)).toBeNull();
  });
});

describe("mercado por UF: as duas visões no servidor", () => {
  const props = { janela: "jul/2026", participacao: barrasUf(G), volume: barrasUfVolume(G) };
  const padrao = renderToStaticMarkup(createElement(GraficoLivreUf, props));
  const volume = renderToStaticMarkup(createElement(GraficoLivreUf, { ...props, medidaInicial: "volume" }));
  /** O rádio marcado (o React escreve `checked` antes de `value`, então a ordem dos atributos não entra no teste). */
  const marcado = (h: string) => h.match(/<input[^>]*checked=""[^>]*>/)?.[0] ?? "";

  it("abre na participação, com a escolha entre as duas medidas e sem o gráfico de volume", () => {
    expect(padrao).toContain('data-livre-uf="participacao"');
    expect(padrao).toContain('aria-label="Ver por"');
    expect(padrao).toContain("Participação do livre (%)");
    expect(padrao).toContain("Volume de energia (GWh)");
    expect(marcado(padrao)).toContain('value="participacao"');
    expect(padrao).toContain("Participação do livre por UF, 12 meses até jul/2026");
    expect(padrao).not.toContain("Consumo na rede por UF");
    // uma barra e uma linha de tabela por UF
    expect(padrao.match(/<g[^>]*data-id="/g) ?? []).toHaveLength(26);
    expect(padrao.match(/<tr[^>]*data-id="/g) ?? []).toHaveLength(26);
  });

  it("no volume, as duas partes empilham em GWh, na ordem do volume livre, com a tabela de números", () => {
    expect(volume).toContain('data-livre-uf="volume"');
    expect(marcado(volume)).toContain('value="volume"');
    expect(volume).toContain("Consumo na rede por UF, livre e cativo, 12 meses até jul/2026");
    expect(volume).toContain(", em GWh");
    expect(volume).toContain("Valores em GWh");
    expect(volume).not.toContain("Participação do livre por UF, 12 meses");
    expect(volume.match(/data-serie="livre"/g) ?? []).toHaveLength(26);
    expect(volume.match(/data-serie="cativo"/g) ?? []).toHaveLength(26);
    expect(volume).toContain("Total (GWh)");
    // ordem das categorias no gráfico = ordem do volume livre
    const ids = Array.from(volume.matchAll(/<g[^>]*data-id="([A-Z]{2})"/g)).map((m) => m[1]);
    expect(ids).toEqual(barrasUfVolume(G).map((x) => x.uf));
    // o maior valor aparece na tabela com a mesma formatação da página
    const sp = barrasUfVolume(G)[0];
    expect(sp.uf).toBe("SP");
    expect(volume).toContain(num(sp.livre, 0));
    expect(volume).toContain(num(sp.cativo, 0));
    expect(volume).not.toContain('data-estado="sem-dado"');
  });

  it("sem UF com dado de volume não há escolha de medida", () => {
    const h = renderToStaticMarkup(createElement(GraficoLivreUf, { ...props, volume: [], medidaInicial: "volume" }));
    expect(h).not.toContain('aria-label="Ver por"');
    expect(h).toContain('data-livre-uf="participacao"');
  });

  it("sem vazamento de objeto nem data crua", () => {
    for (const h of [padrao, volume]) {
      expect(h).not.toMatch(/NaN|undefined|\[object Object\]/);
      expect(h.replace(/<[^>]+>/g, " ")).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(?=[\s).,;]|$)/);
    }
  });
});

describe("mercado por UF: na página", () => {
  const h = renderToStaticMarkup(createElement(MercadoPage));
  const secao = h.slice(h.indexOf('id="uf-classe"'), h.indexOf('id="ainda-nao"'));
  const texto = secao.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'");

  it("a seção abre na participação de sempre, com a opção de volume, a linha do Brasil, o contraste e a ausência de Roraima", () => {
    expect(secao).toContain('data-livre-uf="participacao"');
    expect(secao).toContain("Participação do livre por UF, 12 meses até jul/2026");
    // a linha do Brasil é a janela nacional da EPE, que pode terminar um mês depois da janela por UF (o CSV por UF atrasa): o rótulo diz até
    // quando vai, e a comparação com as barras não esconde a diferença de janelas
    const kEpe = G.livre_regulado.kpis.participacao_livre_12m!;
    expect(secao).toContain(`data-referencia="Brasil, 12 meses até ${mesAno(kEpe.periodo.fim)}"`);
    expect(secao).toContain(`Brasil, 12 meses até ${mesAno(kEpe.periodo.fim)}: ${pct(kEpe.valor_pct, 1)}`);
    expect(texto).toContain("com a opção de ver o volume de energia");
    expect(texto).toContain(textoContrasteUf(G)!);
    expect(texto).toContain(textoUfsSemJanela(G)!);
    // a participação por classe segue logo depois
    expect(secao).toContain("Participação do livre por classe de consumo");
  });

  it("nenhum número nem nome de UF do contraste fica digitado no código da página", () => {
    const fonte = readFileSync(join(raiz, "src/app/setor-eletrico/mercado/page.tsx"), "utf-8");
    expect(fonte).not.toMatch(/63,8|73\.460|17\.053|49,1|até ago\/2026/);
    expect(fonte).not.toMatch(/Roraima fica|Maior participação do livre/);
  });
});
