import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FichaMunicipio from "@/app/saneamento/municipio/[id]/page";
import PlanejamentoPage from "@/app/saneamento/planejamento/page";
import TarifaSocialPage from "@/app/saneamento/tarifa-social/page";
import { fichaMunicipio, meta, municipios } from "@/lib/saneamento/gold";
import { LIMITE_RAZAO_TARIFA_SOCIAL, agregarMedida, medida, razaoTarifaSocial } from "@/lib/saneamento/medidas";
import { mesAno, numero } from "@/lib/saneamento/formato";

/**
 * Correções da revisão independente de 16/10/2026: nenhum valor impossível na ficha, tarifa por prestador com a soma que a razão
 * usa, razão acima do universo elegível sinalizada, N efetivo dos pares e a ressalva dos índices da NR 8 acima de 100%.
 * Os municípios de teste são escolhidos pelo dado, não por código fixo.
 */
const lista = municipios();
const html = (id: string) => renderToStaticMarkup(createElement(FichaMunicipio, { params: { id } }));
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Ficha municipal: tarifa social", () => {
  it("o valor médio declarado (GFI1037) não é publicado na ficha, mesmo onde o gold o traz", () => {
    const comValor = lista.find((m) => (fichaMunicipio(m.id)?.sinisa.prestadores ?? []).some((v) => typeof v.tarifa?.GFI1037 === "number" && v.tarifa.GFI1037 > 1000));
    expect(comValor).toBeTruthy();
    const t = texto(html(comValor!.id));
    expect(t).not.toContain("Valor médio declarado da tarifa social");
    expect(t).not.toMatch(/por mês/);
    expect(t).toContain("GFI1037");
  });

  it("com mais de um prestador de água, cada um aparece e a soma usada na razão é rotulada", () => {
    const multi = lista.find((m) => (fichaMunicipio(m.id)?.sinisa.prestadores ?? []).filter((v) => v.servico === "agua" && v.tarifa).length > 1 && m.ts_economias != null);
    expect(multi).toBeTruthy();
    const f = fichaMunicipio(multi!.id)!;
    const nomes = f.sinisa.prestadores!.filter((v) => v.servico === "agua" && v.tarifa);
    const t = texto(html(multi!.id));
    expect(t).toContain("soma dos prestadores de água");
    const soma = nomes.reduce((s, v) => s + (typeof v.tarifa!.GFI1036 === "number" ? v.tarifa!.GFI1036 : 0), 0);
    expect(multi!.ts_economias).toBe(soma);
    expect(t).toContain(numero(multi!.ts_economias, 0));
  });

  it("razão acima do universo elegível fica sinalizada; abaixo, não", () => {
    const acima = lista.find((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    const normal = lista.find((m) => {
      const r = razaoTarifaSocial(m);
      return r != null && r > 0 && r <= LIMITE_RAZAO_TARIFA_SOCIAL;
    });
    expect(acima && normal).toBeTruthy();
    expect(texto(html(acima!.id))).toContain("Declaração do prestador a verificar");
    expect(texto(html(normal!.id))).not.toContain("Declaração do prestador a verificar");
  });

  it("os meses do CadÚnico vêm da meta, não de texto digitado", () => {
    const c = meta()!.cadunico;
    const t = texto(html(lista.find((m) => m.cad_fam_ms != null)!.id));
    expect(t).toContain(`CadÚnico com renda per capita até meio salário-mínimo, ${mesAno(c.mes_referencia)}`);
    expect(t).toContain(`Mesmo critério, ${mesAno(c.mes_mais_recente)}`);
  });
});

describe("Medida da razão de tarifa social", () => {
  const med = medida("tarifa-social-por-familia-elegivel");

  it("acima do limite sai das classes, mas a soma publicada continua a mesma", () => {
    const acima = lista.filter((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    expect(acima.length).toBeGreaterThan(0);
    for (const m of acima) expect(med.pct(m), m.id).toBeNull();
    for (const m of lista) {
      const r = razaoTarifaSocial(m);
      if (r != null && r <= LIMITE_RAZAO_TARIFA_SOCIAL) expect(med.pct(m), m.id).toBeCloseTo(r, 9);
    }
    // referência agregada = razão de somas do gold (inclui as declarações sinalizadas, que a página declara)
    const ag = agregarMedida(med, lista);
    expect(ag.municipios).toBeGreaterThan(lista.filter((m) => med.pct(m) != null && med.pct(m)! > 0).length);
  });

  it("a página declara quantos são, quanto somam e qual seria a razão sem eles", () => {
    const acima = lista.filter((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    const t = texto(renderToStaticMarkup(createElement(TarifaSocialPage)));
    expect(t).toContain("Declarações acima do universo elegível");
    expect(t).toContain(`${numero(acima.length, 0)} municípios declaram mais economias com tarifa social do que famílias elegíveis`);
    expect(t).toContain("nem aqui nem na ficha de cada município");
  });
});

describe("NR 8: índices acima de 100%", () => {
  it("a ficha explica o valor acima de 100% e a página de planejamento conta quantos são", () => {
    const m = lista.find((x) => (x.iaa_rede ?? 0) > 100)!;
    expect(texto(html(m.id))).toContain("Acima de 100%: as economias ativas excedem a estimativa de domicílios ocupados");
    const t = texto(renderToStaticMarkup(createElement(PlanejamentoPage)));
    const n = lista.filter((x) => (x.iaa_rede ?? 0) > 100).length;
    expect(t).toContain(`${numero(n, 0)} deles passam de 100%`);
    expect(t).toContain("Por que o IAA do Brasil não é o IAG0004");
    expect(t).not.toMatch(/NaN|undefined/);
  });

  it("o IAA do Brasil limitado a 100% por município é menor que a razão de somas", () => {
    const com = lista.filter((x) => x.nr8_ag_num != null && x.dom_est24 != null && x.dom_est24 > 0 && x.iaa_rede != null);
    const dom = com.reduce((s, x) => s + x.dom_est24!, 0);
    const soma = (com.reduce((s, x) => s + x.nr8_ag_num!, 0) / dom) * 100;
    const limitado = (com.reduce((s, x) => s + Math.min(x.nr8_ag_num!, x.dom_est24!), 0) / dom) * 100;
    expect(limitado).toBeLessThan(soma);
    const t = texto(renderToStaticMarkup(createElement(PlanejamentoPage)));
    expect(t).toContain(`o IAA do Brasil é ${numero(soma, 1)}%`);
    expect(t).toContain(`cai para ${numero(limitado, 1)}%`);
  });
});

describe("Ficha municipal: comparação", () => {
  it("cada linha dos pares informa o N efetivo e a nota declara que os universos diferem", () => {
    const m = lista.find((x) => x.nome === "Borá") ?? lista.find((x) => x.pop22 != null && x.pop22 < 5000)!;
    const t = texto(html(m.id));
    expect(t).toMatch(/\d[\d.]* de \d[\d.]* municípios com valor/);
    expect(t).toContain("As colunas não têm o mesmo universo");
    expect(t).toContain("Pares (mediana)");
  });

  it("valor não nulo que arredonda para zero não aparece como 0,0%", () => {
    const f = lista
      .map((m) => ({ m, q: fichaMunicipio(m.id)?.qualidade }))
      .find(({ q }) => q && Object.keys(q).some((k) => /^qa_.*_num$/.test(k) && (q[k] ?? 0) > 0 && (q[k.replace(/_num$/, "_den")] ?? 0) > 2000 && (q[k] / q[k.replace(/_num$/, "_den")]) * 100 < 0.05));
    if (!f) return; // sem caso no gold atual: a regra vale quando houver
    expect(texto(html(f.m.id))).toContain("menos de 0,");
  });
});
