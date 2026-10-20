import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { montarRetrato } from "@/lib/eficiencia/entrada";
import { INDICADORES_APERITIVO, montarAperitivoCapital, posicoes, textoPosicao } from "@/lib/eficiencia/aperitivo-capital";

/**
 * Versão aperitivo de /eficiencia-estatal (princípio do aperitivo, 20/10/2026): poucos números da capital
 * escolhida, recortados do mesmo retrato da entrada completa, sem nota composta nem o que é do painel.
 */
describe("aperitivo da Eficiência Estatal: Como está a minha capital?", () => {
  const retrato = montarRetrato();
  const dados = montarAperitivoCapital(retrato);

  it("traz as 26 capitais e de três a cinco condições, com os valores do retrato", () => {
    expect(dados.capitais).toHaveLength(26);
    expect(dados.indicadores.length).toBeGreaterThanOrEqual(3);
    expect(dados.indicadores.length).toBeLessThanOrEqual(5);
    expect(dados.indicadores.map((m) => m.id)).toEqual([...INDICADORES_APERITIVO]);
    for (const m of dados.indicadores) {
      const original = retrato.condicoes.find((c) => c.id === m.id)!;
      expect(m.unidade && m.periodo && m.fonte && m.fonteUrl, m.id).toBeTruthy();
      for (const c of dados.capitais) expect(m.valores[c.id], `${m.id} ${c.nome}`).toBe(original.valores[c.id]?.valor ?? null);
    }
  });

  it("não leva nota composta, contorno nem posição percentual ao navegador", () => {
    const json = JSON.stringify(dados);
    for (const proibido of ["score", "percentiles", "contorno", "band", "contributions"]) expect(json).not.toContain(proibido);
  });

  it("posição do maior para o menor, com empates e ausência fora do universo", () => {
    const p = posicoes({ a: 10, b: 30, c: 20, d: 20, e: null }, { a: "A", b: "B", c: "C", d: "D", e: "E" });
    expect(p.b).toEqual({ ordem: 1, universo: 4, empatadas: [] });
    expect(p.c).toEqual({ ordem: 2, universo: 4, empatadas: ["D"] });
    expect(p.a.ordem).toBe(4);
    expect(p.e).toBeUndefined();
    expect(textoPosicao(p.b, 5)).toBe("Maior valor entre as 4 capitais com dado");
    expect(textoPosicao(p.c, 4)).toBe("2º maior valor entre as 4 capitais, empatado com D");
    expect(textoPosicao(p.a, 4)).toBe("Menor valor entre as 4 capitais");
    expect(textoPosicao(undefined, 26)).toMatch(/^Sem posição/);
  });

  it("posição real de Recife confere com a ordem dos valores do retrato", () => {
    for (const m of dados.indicadores) {
      const v = m.valores["2611606"] as number;
      const maiores = Object.values(m.valores).filter((w) => w !== null && w > v).length;
      expect(m.posicoes["2611606"].ordem, m.id).toBe(maiores + 1);
    }
  });

  it("página: estática, canônico no endereço público, convite com a rota pública e nada do painel", () => {
    const fonte = readFileSync(join(process.cwd(), "src/app/aperitivo/minha-capital/page.tsx"), "utf8");
    const componente = readFileSync(join(process.cwd(), "src/components/eficiencia/entrada/MinhaCapitalAperitivo.tsx"), "utf8");
    expect(fonte).toContain("export const dynamic = 'force-static'");
    expect(fonte).toContain("canonical: '/eficiencia-estatal'");
    expect(componente).toMatch(/<ConviteAperitivo rota="\/eficiencia-estatal" comConta=\{comConta\}/);
    expect(fonte).toContain("comConta={COM_CONTA}");
    expect(fonte).toContain("<CabecalhoEntrada/>");
    for (const proibido of ["AtlasCidadao", "MapaCobertura", "ParaVoce", "PerguntasCapital", "RetratoCapital", "indice-de-resultados", ".csv", "download"]) {
      expect(fonte + componente, proibido).not.toContain(proibido);
    }
    // nenhum link interno: só as fontes oficiais, externas
    expect(componente).not.toMatch(/href=["{]['"`]?\//);
    expect(componente).not.toContain("next/link");
  });
});
