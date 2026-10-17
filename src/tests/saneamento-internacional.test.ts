import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PaginaInternacional from "@/app/saneamento/internacional/page";
import { agregado, jmpPaises, meta } from "@/lib/saneamento/gold";
import {
  DEFINICOES_JMP,
  FONTE_BRASIL_ROTULO,
  INDICADORES_JMP,
  conciliacao,
  decimo,
  fontesDoBrasil,
  grupos,
  mediana,
  medianaDoGrupo,
  posicao,
  valorJmp,
} from "@/lib/saneamento/internacional";
import { FERRAMENTAS } from "@/lib/saneamento/capitulos";
import { inteiro, numero } from "@/lib/saneamento/formato";

/**
 * Comparação internacional: estimativas do JMP (OMS e UNICEF) por país, 2000 a 2024, lidas do arquivo de agosto de 2025.
 * Os valores do Brasil abaixo foram lidos direto das abas `wat` e `san` do arquivo em 17/10/2026.
 */
const raiz = process.cwd();
const { paises, brasil } = jmpPaises();
const m = meta()!.jmp!;
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const bra = paises.find((p) => p.iso3 === "BRA")!;

describe("Comparação internacional: gold", () => {
  it("há uma linha por país ou área no ano comparado, com código único e nome em português quando o IBGE lista", () => {
    expect(paises).toHaveLength(m.areas);
    expect(new Set(paises.map((p) => p.iso3)).size).toBe(paises.length);
    expect(paises.every((p) => p.ano === m.ano_comparado)).toBe(true);
    expect(bra.nome).toBe("Brasil");
    expect(bra.nome_origem).toBe("IBGE");
    expect(paises.filter((p) => p.nome_origem === "JMP")).toHaveLength(m.sem_nome_ibge.length);
    for (const p of paises.filter((x) => x.nome_origem === "JMP")) expect(p.nome).toBe(p.nome_jmp);
  });

  it("os degraus de cada serviço somam 100% e gerenciado nunca passa de pelo menos básico, em todos os países e áreas", () => {
    const tol = m.regras.tolerancia_escada_pct;
    for (const p of paises) {
      for (const servico of ["agua", "esgoto"] as const) {
        for (const area of ["t", "u", "r"] as const) {
          const b = p[servico]?.[area];
          if (!b || b.basica == null) continue;
          expect(Math.abs((b.basica ?? 0) + (b.limitada ?? 0) + (b.nao_melhorada ?? 0) + (b.ruim ?? 0) - 100), `${p.iso3} ${servico} ${area}`).toBeLessThanOrEqual(tol + 1e-9);
          if (b.gerenciada != null) expect(b.gerenciada, `${p.iso3} ${servico} ${area}`).toBeLessThanOrEqual(b.basica + 0.01);
        }
      }
    }
  });

  it("os valores do Brasil em 2024 são os do arquivo do JMP", () => {
    expect(bra.agua!.t.gerenciada!).toBeCloseTo(88.62, 2);
    expect(bra.agua!.t.basica!).toBeCloseTo(100, 1);
    expect(bra.esgoto!.t.gerenciada!).toBeCloseTo(54.96, 2);
    expect(bra.esgoto!.t.basica!).toBeCloseTo(92.4, 1);
    expect(bra.esgoto!.t.ruim!).toBeCloseTo(0, 1);
    expect(bra.esgoto!.r.gerenciada).toBeNull(); // o JMP não tem estimativa de gerenciado no rural do Brasil
  });

  it("a série do Brasil cobre 2000 a 2024 e o último ano é o ano comparado", () => {
    expect(brasil.map((e) => e.ano)).toEqual(Array.from({ length: 25 }, (_, i) => 2000 + i));
    expect(brasil[brasil.length - 1].agua).toEqual(bra.agua);
    expect(brasil[brasil.length - 1].esgoto).toEqual(bra.esgoto);
    expect(brasil[0].esgoto!.t.ruim!).toBeGreaterThan(8); // 2000: 8,8% de defecação a céu aberto
  });

  it("a meta registra edição, sha256 do original e as 83 fontes do Brasil que o JMP lista", () => {
    expect(m.edicao_mes).toBe("2025-08");
    expect(m.periodo).toEqual([2000, 2024]);
    expect(m.xlsx.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(m.brasil_xlsx.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(m.brasil_fontes).toHaveLength(m.brasil_xlsx.fontes);
    const por = Object.fromEntries(fontesDoBrasil(m.brasil_fontes).map((f) => [f.sigla, f.n]));
    expect(por.CEN).toBe(4);
    expect(m.brasil_fontes.filter((f) => f.ano === 2022).map((f) => f.sigla).sort()).toEqual(["CEN", "PNAD", "SISAGUA", "SNIS"]);
    for (const f of fontesDoBrasil(m.brasil_fontes)) expect(FONTE_BRASIL_ROTULO[f.sigla], f.sigla).toBeDefined();
  });

  it("o CSV acompanha o JSON, uma linha por país ou área", () => {
    const csv = join(raiz, "public", "saneamento", "gold", "jmp_paises.csv");
    expect(existsSync(csv)).toBe(true);
    expect(readFileSync(csv, "utf-8").trim().split("\n")).toHaveLength(paises.length + 1);
  });
});

describe("Comparação internacional: posição e grupos", () => {
  it("a posição conta áreas melhores, iguais e piores ao décimo de ponto, recalculada por fora", () => {
    for (const ind of INDICADORES_JMP) {
      const v = valorJmp(bra, ind)!;
      let melhores = 0, iguais = 0, piores = 0;
      for (const p of paises) {
        const x = valorJmp(p, ind);
        if (x == null) continue;
        const a = Math.round(x * 10), b = Math.round(v * 10);
        if (a === b) iguais += 1;
        else if (ind.melhorQuando === "maior" ? a > b : a < b) melhores += 1;
        else piores += 1;
      }
      const pos = posicao(paises, ind, v);
      expect({ m: pos.melhores, i: pos.iguais, p: pos.piores, n: pos.comEstimativa }, ind.id).toEqual({ m: melhores, i: iguais, p: piores, n: melhores + iguais + piores });
      expect(pos.iguais, ind.id).toBeGreaterThanOrEqual(1); // o próprio Brasil
    }
    expect(decimo(88.62396)).toBe(88.6);
  });

  it("as contagens de cobertura da meta conferem com os dados", () => {
    expect(m.com_agua_gerenciada).toBe(paises.filter((p) => p.agua?.t.gerenciada != null).length);
    expect(m.com_esgoto_gerenciado).toBe(paises.filter((p) => p.esgoto?.t.gerenciada != null).length);
    expect(posicao(paises, INDICADORES_JMP[0], 50).comEstimativa).toBe(m.com_agua_gerenciada);
  });

  it("grupos vêm das classificações do JMP e a mediana ignora área sem estimativa", () => {
    const [mundo, regiao, renda] = grupos(paises);
    expect(mundo.membros).toHaveLength(paises.length);
    expect(regiao.membros.every((p) => p.regiao_ods === "Latin America and the Caribbean")).toBe(true);
    expect(renda.membros.every((p) => p.renda === "Upper middle income")).toBe(true);
    expect(regiao.membros).toContain(bra);
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
    const g = medianaDoGrupo(regiao, INDICADORES_JMP[2]);
    const v = regiao.membros.map((p) => p.esgoto?.t.gerenciada).filter((x): x is number => x != null);
    expect(g.n).toBe(v.length);
    expect(g.valor).toBeCloseTo(mediana(v)!, 9);
  });
});

describe("Comparação internacional: conciliação com o Censo e o SINISA", () => {
  const br = agregado("BR")!;
  const linhas = conciliacao(br, brasil.find((e) => e.ano === 2022)!);
  const c = br.censo2022.moradores!;

  it("recalcula o Censo 2022 a partir dos moradores e a diferença é JMP menos Censo", () => {
    const por = Object.fromEntries(linhas.map((l) => [l.id, l]));
    expect(por["agua-rede"].censo.valor!).toBeCloseTo(((c.agua.rede! + c.agua.lig_outra!) / c.agua.total!) * 100, 9);
    expect(por["esgoto-basico"].censo.valor!).toBeCloseTo(((c.esgoto.rede! + c.esgoto.septica!) / c.esgoto.total!) * 100, 9);
    expect(por["esgoto-rede"].censo.valor!).toBeCloseTo((c.esgoto.rede! / c.esgoto.total!) * 100, 9);
    expect(por["ceu-aberto"].censo.valor!).toBeCloseTo((c.esgoto.sem_banheiro! / c.esgoto.total!) * 100, 9);
    for (const l of linhas) expect(l.diferenca!, l.id).toBeCloseTo(l.jmp.valor! - l.censo.valor!, 9);
    expect(por["agua-rede"].sinisa!.valor).toBe(br.sinisa.agua.indicadores.IAG0001);
    expect(por["esgoto-rede"].sinisa!.valor).toBe(br.sinisa.esgoto.indicadores.IES0001);
    expect(por["agua-rede"].jmp.valor!).toBeCloseTo(99.61, 2);
    expect(por["esgoto-rede"].jmp.valor!).toBeCloseTo(71.19, 2);
  });

  it("cada linha diz o que muda entre as medidas, sem travessão", () => {
    for (const l of linhas) {
      expect(l.nota.length, l.id).toBeGreaterThan(80);
      expect(l.nota, l.id).not.toMatch(/—|–/);
    }
  });
});

describe("Comparação internacional: página", () => {
  it("mostra os quatro indicadores, as definições, as tabelas e a ressalva de que as fontes não são a mesma medida", () => {
    const h = texto(renderToStaticMarkup(createElement(PaginaInternacional)));
    expect(h).not.toMatch(/NaN|undefined|—|–/);
    expect(h).toContain("O Brasil em comparação internacional");
    expect(h).toContain(`${numero(bra.agua!.t.gerenciada, 1)}%`);
    expect(h).toContain(`${numero(bra.esgoto!.t.gerenciada, 1)}%`);
    expect(h).toContain(`de ${inteiro(m.com_agua_gerenciada)} países e áreas com estimativa`);
    expect(h).toContain("O que o JMP mede?");
    for (const d of DEFINICOES_JMP) expect(h).toContain(d.degrau);
    expect(h).toContain("nenhuma linha é a mesma medida");
    expect(h).toContain("Em 2022, as fontes listadas são Censo Demográfico, PNAD, SISAGUA, SNIS (hoje SINISA)");
    expect(h).toContain("Mediana: América Latina e Caribe");
    expect(h).not.toContain("−0,0");
    expect(h).toContain("Todos os países e áreas do JMP");
  });

  it("a ferramenta está na lista de ferramentas e no cabeçalho do observatório", () => {
    expect(FERRAMENTAS.some((f) => f.slug === "internacional")).toBe(true);
    const h = renderToStaticMarkup(createElement(PaginaInternacional));
    expect(h).toContain('href="/saneamento/internacional"');
  });

  it("a metodologia lista o arquivo e a fonte, e o README descreve o comando de coleta", () => {
    const doc = readFileSync(join(raiz, "docs", "saneamento", "README.md"), "utf-8");
    expect(doc).toContain("pipeline.observatorio_saneamento.jmp --coletar");
    expect(doc).toContain("`/saneamento/internacional`");
    expect(readFileSync(join(raiz, "docs", "saneamento", "METODOLOGIA.md"), "utf-8")).toContain("## Comparação internacional (JMP)");
  });
});
