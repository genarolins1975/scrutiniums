import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PaginaSaude from "@/app/saneamento/saude-ambiente/page";
import { agregados, meta, municipios, municipiosComSaude } from "@/lib/saneamento/gold";
import { ANOS_SAUDE, MEDIDAS_SAUDE, agregarMedida, medida } from "@/lib/saneamento/medidas";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { inteiro, numero } from "@/lib/saneamento/formato";

/**
 * Capítulo 13: internações (SIH) e óbitos (SIM) por infecções intestinais, leptospirose e esquistossomose, por município de residência,
 * de 2022 a 2024. Contagens na gold, taxa por 100 mil moradores do Censo 2022 ao ano na camada de apresentação.
 */
const raiz = process.cwd();
const lista = municipiosComSaude();
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const GRUPOS = ["intestinais", "leptospirose", "esquistossomose"] as const;
const SISTEMAS = [["sih", "int"], ["sih", "obt"], ["sim", "obt"]] as const;
const soma = (m: (typeof lista)[number], g: string, s: string, k: string) => (m[`sd_${g}_${s}_${k}`] as number | null) ?? 0;

describe("Saúde e ambiente: gold", () => {
  it("o complemento cobre os 5.571 municípios, com doze colunas de contagem inteira e nunca negativa", () => {
    expect(lista).toHaveLength(municipios().length);
    const campos = Object.keys(lista[0]).filter((k) => k.startsWith("sd_"));
    expect(campos).toHaveLength(12);
    for (const m of lista) for (const c of campos) {
      const v = m[c as `sd_${string}`];
      expect(Number.isInteger(v) && v! >= 0, `${m.id} ${c}`).toBe(true);
    }
    expect(Object.keys(municipios()[0]).some((k) => k.startsWith("sd_"))).toBe(false);
  });

  it("o total dos grupos é a soma dos três e internação hospitalar não é menor que óbito hospitalar", () => {
    for (const m of lista) {
      for (const [s, k] of SISTEMAS) expect(soma(m, "total", s, k), `${m.id} ${s} ${k}`).toBe(GRUPOS.reduce((a, g) => a + soma(m, g, s, k), 0));
      expect(soma(m, "total", "sih", "obt")).toBeLessThanOrEqual(soma(m, "total", "sih", "int"));
    }
  });

  it("a soma municipal mais os casos sem município é o total devolvido pelo TabNet, em cada consulta", () => {
    const sd = meta()!.saude!;
    expect(sd.periodo).toEqual([...ANOS_SAUDE]);
    expect(sd.consultas).toHaveLength(9);
    expect(sd.conferencias).toHaveLength(9);
    for (const c of sd.conferencias) {
      expect(c.diferenca, c.id).toBe(0);
      const [sistema, grupo, medidaId] = c.id.split("-");
      const k = medidaId === "int" ? "int" : "obt";
      const municipal = lista.reduce((a, m) => a + soma(m, grupo, sistema, k), 0);
      expect(municipal + c.municipio_ignorado + c.municipios_fora_do_cadastro, c.id).toBe(c.total_tabnet);
      expect(sd.totais_tabnet[c.id]).toBe(c.total_tabnet);
    }
    expect(sd.municipios_sem_linha).toEqual([]);
  });

  it("cada consulta registra o sha256 do original, os itens da seleção e as notas da própria fonte", () => {
    for (const c of meta()!.saude!.consultas) {
      expect(c.sha256, c.id).toMatch(/^[a-f0-9]{64}$/);
      expect(c.itens.length, c.id).toBeGreaterThan(0);
      expect(c.notas, c.id).toMatch(/^Fonte:/);
      expect(c.def, c.id).toMatch(/^(sim|sih)\/cnv\/(obt10br|nrbr)\.def$/);
    }
    for (const d of Object.values(meta()!.saude!.definicoes)) expect(d.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("o arquivo CSV acompanha o JSON", () => {
    const csv = join(raiz, "public", "saneamento", "gold", "saude_municipios.csv");
    expect(existsSync(csv)).toBe(true);
    expect(readFileSync(csv, "utf-8").trim().split("\n")).toHaveLength(lista.length + 1);
  });
});

describe("Saúde e ambiente: medidas", () => {
  it("seis medidas, uma por doença e sistema, com fonte, janela, ressalva e ausência declaradas", () => {
    expect(MEDIDAS_SAUDE).toHaveLength(6);
    for (const med of MEDIDAS_SAUDE) {
      expect(med.fonte).toBe("sih_sim");
      expect(med.periodo).toBe("2022 a 2024");
      expect(med.fator).toBe(100_000);
      expect(med.naoPermite).toMatch(/Atribuir/);
      expect(med.ausencia).toMatch(/Zero é zero/);
    }
  });

  it("a taxa é casos ÷ (três anos × moradores do Censo 2022) × 100 mil; zero continua zero; sem moradores fica sem valor", () => {
    const med = medida("sd-intestinais-sih-int");
    let conferidos = 0;
    for (const m of lista) {
      const n = soma(m, "intestinais", "sih", "int");
      if (m.pop22 == null || !(m.pop22 > 0)) {
        expect(med.pct(m), m.id).toBeNull();
        continue;
      }
      expect(med.pct(m)!, m.id).toBeCloseTo((n / (3 * m.pop22)) * 100_000, 9);
      conferidos += 1;
    }
    expect(conferidos).toBeGreaterThan(5000);
    const zero = lista.find((m) => soma(m, "intestinais", "sih", "int") === 0 && (m.pop22 ?? 0) > 0);
    expect(zero && med.pct(zero)).toBe(0);
  });

  it("a referência do Brasil é razão de somas e a das UFs somadas reproduz o Brasil", () => {
    const refs = referencias(agregados(), lista, MEDIDAS_SAUDE.map((m) => m.id));
    for (const med of MEDIDAS_SAUDE) {
      const casos = lista.filter((m) => m.pop22 != null && m.pop22 > 0).reduce((a, m) => a + ((m[`sd_${med.id.split("-")[1]}_${med.id.split("-")[2]}_${med.id.split("-")[3]}`] as number | null) ?? 0), 0);
      const mor = lista.reduce((a, m) => a + (m.pop22 != null && m.pop22 > 0 ? m.pop22 : 0), 0);
      expect(refs[med.id].BR.pct!, med.id).toBeCloseTo((casos / (3 * mor)) * 100_000, 9);
      const ufs = [...new Set(lista.map((m) => m.uf))];
      const numerador = ufs.reduce((a, uf) => a + (agregarMedida(med, lista.filter((m) => m.uf === uf)).pct! * 3 * lista.filter((m) => m.uf === uf && (m.pop22 ?? 0) > 0).reduce((s, m) => s + m.pop22!, 0)) / 100_000, 0);
      expect(numerador, med.id).toBeCloseTo(casos, 4);
    }
  });
});

describe("Saúde e ambiente: capítulo", () => {
  it("o capítulo 13 é parcial, tem página e declara o que falta", () => {
    const cap = capituloPorSlug("saude-ambiente")!;
    expect(cap.numero).toBe(13);
    expect(cap.situacao).toBe("parcial");
    expect(cap.pendencia).toMatch(/hepatite A/);
    expect(existsSync(join(raiz, "src", "app", "saneamento", "saude-ambiente", "page.tsx"))).toBe(true);
  });

  it("a página mostra os totais da fonte, a ressalva de associação e as taxas por quinto de carência, sem NaN nem travessão", () => {
    const sd = meta()!.saude!;
    const h = texto(renderToStaticMarkup(createElement(PaginaSaude)));
    expect(h).not.toMatch(/NaN|undefined|—|–/);
    expect(h).toContain(inteiro(sd.totais_tabnet["sih-intestinais-int"]));
    expect(h).toContain(inteiro(sd.totais_tabnet["sim-esquistossomose-obt"]));
    expect(h).toContain("Ele mostra onde as doenças aparecem, não por que aparecem");
    expect(h).toContain("Concluir que a carência de esgoto explica a diferença");
    expect(h).toContain("Zero é nenhum caso registrado na janela");
    expect(h).toContain("hepatite A");
    // primeiro e último quinto de carência, recalculados aqui por fora da página
    const comCarencia = lista
      .filter((m) => m.pop22 != null && m.pop22 > 0 && m.c22_es_precario != null && m.c22_es_sem_banheiro != null)
      .map((m) => ({ m, c: (m.c22_es_precario! + m.c22_es_sem_banheiro!) / m.pop22! }))
      .sort((a, b) => a.c - b.c || a.m.id.localeCompare(b.m.id));
    const n = comCarencia.length;
    const taxa = (fatia: typeof comCarencia) =>
      (fatia.reduce((a, v) => a + soma(v.m, "intestinais", "sih", "int"), 0) / (3 * fatia.reduce((a, v) => a + v.m.pop22!, 0))) * 100_000;
    const primeiro = taxa(comCarencia.slice(0, Math.floor(n / 5)));
    const ultimo = taxa(comCarencia.slice(Math.floor((4 * n) / 5), n));
    expect(h).toContain(`a taxa do primeiro quinto é ${numero(primeiro, 1)} e a do último é ${numero(ultimo, 1)} por 100 mil moradores ao ano`);
  });

  it("o texto de edição, a vitrine e a matriz de viabilidade deixam de dizer que o capítulo está em preparação", () => {
    const v = readFileSync(join(raiz, "src", "lib", "saneamento", "viabilidade.ts"), "utf-8");
    expect(v).toContain('pergunta: "Onde há mais internações e óbitos por doenças ligadas ao saneamento?"');
    expect(readFileSync(join(raiz, "docs", "saneamento", "VIABILIDADE.md"), "utf-8")).toContain("Infecções intestinais (CID-10 A00 a A09)");
  });
});
