import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agregado, agregados, meta, municipios, municipiosComDesigualdades, prestadores, reguladores } from "@/lib/saneamento/gold";
import { MEDIDAS_DESIGUALDADES, MEDIDAS, MEDIDAS_GERAIS, agregarMedida, formatarValor, medida } from "@/lib/saneamento/medidas";
import { referencias } from "@/lib/saneamento/referencias";
import { CAPITULOS, ROTA } from "@/lib/saneamento/capitulos";
import { VIABILIDADE } from "@/lib/saneamento/viabilidade";
import { MEDIDAS_PRESTADOR } from "@/lib/saneamento/prestadores";

/**
 * Invariantes da gold do Saneamento: somas que reproduzem os consolidados
 * oficiais, nenhuma média de percentuais, conferências publicadas e nenhum
 * número concorrente com o capítulo de saneamento da Eficiência Estatal.
 */
const raiz = process.cwd();

function csvObee(nome: string): Record<string, string>[] {
  const linhas = readFileSync(join(raiz, "public", "eficiencia", "saneamento", nome), "utf-8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const partir = (l: string) => {
    const out: string[] = [];
    let atual = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === ";" && !aspas) {
        out.push(atual);
        atual = "";
      } else atual += ch;
    }
    out.push(atual);
    return out;
  };
  const cab = partir(linhas[0]);
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

describe("Saneamento: gold e conferências", () => {
  const lista = municipios();
  const listaDes = municipiosComDesigualdades();
  const br = agregado("BR")!;

  it("cobre os 5.571 municípios do IBGE e os 5.570 do Censo 2022", () => {
    expect(lista).toHaveLength(5571);
    expect(lista.filter((m) => m.pop22 != null)).toHaveLength(5570);
    expect(meta()?.cobertura.municipios_ibge).toBe(5571);
  });

  it("desigualdades: colunas do capítulo 2 ficam fora da tabela municipal geral e do comparador", () => {
    expect(Object.keys(lista[0]).some((k) => k.startsWith("des_"))).toBe(false);
    expect(Object.keys(listaDes[0]).filter((k) => k.startsWith("des_"))).toHaveLength(28);
    expect(listaDes).toHaveLength(lista.length);
    expect(MEDIDAS_GERAIS.some((m) => m.id.startsWith("des-"))).toBe(false);
    expect(MEDIDAS_GERAIS.length + MEDIDAS_DESIGUALDADES.length).toBe(MEDIDAS.length);
  });

  it("desigualdades: referências usam tabulações oficiais mesmo sob supressão municipal", () => {
    expect(MEDIDAS_DESIGUALDADES).toHaveLength(14);
    const refs = referencias(agregados(), listaDes, MEDIDAS_DESIGUALDADES.map((m) => m.id));
    expect(refs["des-favelas-esgoto"].BR.contagem).toBe(4360958);
    expect(refs["des-favelas-esgoto"].BR.pct).toBeCloseTo(4360958 / 16349896 * 100, 9);
    expect(agregarMedida(medida("des-favelas-esgoto"), listaDes).contagem).toBe(4360279);
    for (const med of MEDIDAS_DESIGUALDADES) {
      const [num, den] = br.desigualdades[med.id.slice(4)];
      expect(refs[med.id].BR.pct).toBeCloseTo(num! / den! * 100, 9);
    }
  });

  it("desigualdades: zero de carência, universo vazio e supressão têm comportamentos diferentes", () => {
    const med = medida("des-amarela-agua");
    const vazio = listaDes.find((m) => m["des_amarela-agua_den"] === 0)!;
    expect(vazio).toBeTruthy();
    expect(med.pct(vazio)).toBeNull();
    const zero = listaDes.find((m) => m["des_amarela-agua_num"] === 0 && m["des_amarela-agua_den"]! > 0)!;
    expect(med.pct(zero)).toBe(0);
    const favela = medida("des-favelas-esgoto");
    const suprimido = listaDes.find((m) => m["des_favelas-esgoto_num"] == null && m["des_favelas-agua_den"]! > 0)!;
    expect(suprimido).toBeTruthy();
    expect(favela.pct(suprimido)).toBeNull();
    expect(favela.contagem!(suprimido)).toBeNull();
    expect(medida("des-favelas-agua").unidadeContagem).toBe("domicílios");
    expect(favela.unidadeContagem).toBe("moradores");
  });

  it("a soma municipal do Censo reproduz a tabulação do IBGE para o Brasil", () => {
    const r = agregarMedida(medida("c22-agua-sem-ligacao"), lista);
    expect(r.contagem).toBe(br.censo2022.moradores!.agua.sem_ligacao);
    expect(r.universo).toBe(br.censo2022.moradores!.agua.total);
  });

  it("a soma municipal do investimento reproduz o consolidado oficial do SINISA", () => {
    const somaAg = lista.reduce((s, m) => s + (m.inv_ag ?? 0), 0);
    const somaEs = lista.reduce((s, m) => s + (m.inv_es ?? 0), 0);
    expect(somaAg).toBeCloseTo(br.sinisa.agua.investimento!.total!, 0);
    expect(somaEs).toBeCloseTo(br.sinisa.esgoto.investimento!.total!, 0);
  });

  it("a população do esgoto concilia: participantes mais delegação sem atendimento = consolidado", () => {
    const c = meta()!.conferencias.find((x) => x.id === "esgoto_populacao_universos")!;
    expect(c.valores.soma).toBe(c.valores.dfe0001_consolidado_brasil);
    expect(lista.filter((m) => m.s_es === "delegacao_sem_atendimento")).toHaveLength(c.valores.municipios_delegacao_sem_atendimento as number);
    expect(lista.filter((m) => m.s_es === "participou")).toHaveLength(c.valores.municipios_com_indicadores as number);
  });

  it("todas as conferências publicadas fecham com diferença zero quando a têm", () => {
    for (const c of meta()!.conferencias) {
      if ("diferenca" in c.valores) expect(c.valores.diferenca, c.id).toBe(0);
    }
  });

  it("agrega pela soma, nunca pela média de percentuais", () => {
    const med = medida("c22-esgoto-sem-rede-nem-septica");
    const se = lista.filter((m) => m.uf === "SE");
    const soma = agregarMedida(med, se).pct!;
    const valores = se.map((m) => med.pct(m)).filter((v): v is number => v != null);
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const ibge = agregado("SE")!.censo2022.moradores!.esgoto;
    expect(soma).toBeCloseTo((ibge.sem_rede_nem_septica! / ibge.total!) * 100, 6);
    expect(Math.abs(soma - media)).toBeGreaterThan(0.5);
  });

  it("os indicadores consolidados são os mesmos do capítulo de saneamento da Eficiência Estatal", () => {
    const porNome = new Map(agregados().map((a) => [a.nome, a]));
    let comparados = 0;
    for (const [arq, servico] of [
      ["agua.csv", "agua"],
      ["esgoto.csv", "esgoto"],
    ] as const) {
      for (const r of csvObee(arq)) {
        const a = porNome.get(r.territorio);
        expect(a, r.territorio).toBeTruthy();
        const meu = a!.sinisa[servico].indicadores;
        if (!(r.indicador in meu)) continue;
        const deles = r.valor === "" ? null : Number(r.valor);
        expect(meu[r.indicador], `${r.territorio} ${r.indicador}`).toBe(deles);
        comparados += 1;
      }
    }
    expect(comparados).toBeGreaterThan(400);
  });

  it("a contagem agregada de cada medida soma a própria contagem municipal", () => {
    for (const med of MEDIDAS) {
      if (!med.contagem || !med.numerador || !med.denominador) continue;
      const r = agregarMedida(med, listaDes);
      const incluidos = listaDes.filter((m) => med.numerador!(m) != null && med.denominador!(m) != null && med.denominador!(m)! > 0);
      expect(r.contagem, med.id).toBe(incluidos.reduce((s, m) => s + (med.contagem!(m) ?? 0), 0));
    }
  });

  it("referências territoriais existem para todas as medidas e o investimento por habitante é razão de somas", () => {
    const refs = referencias(agregados(), lista);
    for (const m of MEDIDAS) expect(refs[m.id]?.BR, m.id).toBeTruthy();
    const inv = refs["sinisa-investimento-por-habitante"].BR.pct!;
    const num = lista.reduce((s, m) => s + (m.inv_ag == null && m.inv_es == null ? 0 : (m.inv_ag ?? 0) + (m.inv_es ?? 0)), 0);
    const den = lista.reduce((s, m) => s + (m.inv_ag == null && m.inv_es == null ? 0 : m.dfe0001 ?? 0), 0);
    expect(inv).toBeCloseTo(num / den, 6);
    expect(formatarValor(medida("sinisa-investimento-por-habitante"), 137.4)).toBe("137 R$/hab.");
    expect(formatarValor(medida("c22-agua-sem-ligacao"), null)).toBe("sem dado");
  });

  it("zero declarado continua zero e ausência continua ausência", () => {
    const med = medida("sinisa-investimento-por-habitante");
    const zero = lista.find((m) => m.inv_ag === 0 && m.inv_es === 0 && (m.dfe0001 ?? 0) > 0);
    const ausente = lista.find((m) => m.inv_ag == null && m.inv_es == null);
    expect(zero && med.pct(zero)).toBe(0);
    expect(ausente && med.pct(ausente)).toBeNull();
  });

  it("CadÚnico: soma municipal é o total do Brasil e a razão da tarifa social é razão de somas", () => {
    const mes = meta()!.cadunico.mes_referencia;
    expect(lista.reduce((s, m) => s + (m.cad_fam_ms ?? 0), 0)).toBe(br.cadunico[mes]);
    const ts = br.tarifa_social;
    const med = medida("tarifa-social-por-familia-elegivel");
    const r = agregarMedida(med, lista);
    // a contagem exibida é a da medida (famílias elegíveis), não o numerador (economias)
    expect(r.contagem).toBe(ts.familias_mesmo_universo);
    expect(r.universo).toBe(ts.familias_mesmo_universo);
    expect(referencias(agregados(), lista, [med.id])[med.id].BR.contagem).toBe(ts.familias_mesmo_universo);
    expect(r.municipios).toBe(ts.municipios_mesmo_universo);
    expect(referencias(agregados(), lista, [med.id])[med.id].BR.pct).toBeCloseTo((ts.economias! / ts.familias_mesmo_universo!) * 100, 9);
  });

  it("tarifa social: quem declara não oferecer conta zero; sem resposta fica sem dado", () => {
    const med = medida("tarifa-social-por-familia-elegivel");
    const nao = lista.filter((m) => m.ts_estado === "nao_oferece" && (m.cad_fam_ms ?? 0) > 0);
    const sem = lista.filter((m) => m.ts_estado === null);
    expect(nao.length).toBeGreaterThan(0);
    expect(sem.length).toBeGreaterThan(0);
    for (const m of nao) expect(med.pct(m), m.id).toBe(0);
    for (const m of sem) expect(med.pct(m), m.id).toBeNull();
    expect(br.tarifa_social.municipios_oferece + br.tarifa_social.municipios_nao_oferece + br.tarifa_social.municipios_sem_resposta).toBe(lista.length);
  });

  it("prestadores e reguladores: cadastros completos e medidas com fórmula declarada", () => {
    expect(prestadores().length).toBe(meta()!.cobertura.prestadores);
    expect(reguladores().length).toBe(meta()!.cobertura.reguladores_cnpj);
    for (const r of reguladores()) expect(r.cnpj).toMatch(/^\d{14}$/);
    for (const m of MEDIDAS_PRESTADOR) expect(m.nota.length, m.id).toBeGreaterThan(10);
    const sabesp = prestadores().find((p) => p.sigla === "SABESP")!;
    const perdas = MEDIDAS_PRESTADOR.find((m) => m.id === "perdas")!.valor(sabesp)!;
    const v = sabesp.volumes_mil_m3;
    const entrada = v.GTA1001! + v.GTA1009!;
    expect(perdas).toBeCloseTo(((entrada - v.GTA1207! - v.GTA1211! - v.GTA1203!) / entrada) * 100, 1);
  });
});

describe("Saneamento: capítulos sem promessa", () => {
  it("capítulo com painel tem página; capítulo em preparação não tem", () => {
    for (const c of CAPITULOS) {
      const pagina = join(raiz, "src", "app", "saneamento", ...c.slug.split("/"), "page.tsx");
      expect(existsSync(pagina), `${ROTA}/${c.slug}`).toBe(c.situacao !== "em_preparacao");
      if (c.situacao !== "publicado") expect(c.pendencia, c.slug).toBeTruthy();
      for (const s of c.subpaineis ?? []) {
        expect(existsSync(join(raiz, "src", "app", "saneamento", c.slug, s.slug, "page.tsx")), s.slug).toBe(true);
      }
    }
  });

  it("a matriz de viabilidade cobre todos os capítulos", () => {
    for (const c of CAPITULOS) expect(VIABILIDADE.some((v) => v.capitulo === String(c.numero)), String(c.numero)).toBe(true);
    for (const v of VIABILIDADE) {
      for (const campo of ["fonte", "periodo", "unidadeGeografica", "unidadeObservacao", "cobertura", "acesso", "limitacoes"] as const) {
        expect(v[campo].length, `${v.pergunta} ${campo}`).toBeGreaterThan(2);
      }
    }
  });

  it("nenhum texto do Observatório usa travessão", () => {
    const arquivos = [
      ...CAPITULOS.filter((c) => c.situacao !== "em_preparacao").map((c) => join("src", "app", "saneamento", ...c.slug.split("/"), "page.tsx")),
      join("src", "app", "saneamento", "metodologia", "page.tsx"),
      join("src", "app", "saneamento", "comparar", "page.tsx"),
      join("src", "lib", "saneamento", "viabilidade.ts"),
      join("src", "lib", "saneamento", "capitulos.ts"),
    ];
    for (const a of arquivos) expect(readFileSync(join(raiz, a), "utf-8"), a).not.toMatch(/—|–/);
  });
});
