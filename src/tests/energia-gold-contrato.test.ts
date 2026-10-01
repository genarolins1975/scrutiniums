/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATASETS_INTEGRADOS, commitDoBuild, urlVersaoGithub } from "@/lib/energia/datasets";
import type { CatalogoDados, ManifestoGold, PublicacaoGold } from "@/lib/energia/tipos-dados";

/**
 * Contrato da gold do domínio Energia (docs/observatorios/MODELO_AUDITABILIDADE.md):
 * todo indicador publicado tem natureza, fonte, período, snapshot e limitações;
 * calculado tem fórmula; ausência nunca vira zero; classificação só com regra.
 */
const DIR = join(process.cwd(), "public", "energia", "gold");
const ler = (n: string) => JSON.parse(readFileSync(join(DIR, n), "utf-8"));
const GOLDS = ["pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json", "sintese.json", "modelos.json", "previsoes.json", "catalogo.json", "meta.json"];
/** Toda gold publicada (operação, módulos temáticos e controle), sem lista fixa: uma gold nova entra no contrato sozinha. */
const TODAS = readdirSync(DIR).filter((n) => n.endsWith(".json") && !n.startsWith("_")).sort();
const NATUREZAS = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];
const ESTADOS = ["CATALOGADO", "RECURSO VERIFICADO", "INTEGRADO", "VALIDADO", "PUBLICADO"];
const LINK = /^\/energia\/(series|gold|geo)\/[\w./-]+\.(csv|json|parquet|topojson|geojson|xlsx)$/;

function links(o: any, out: Set<string> = new Set()): Set<string> {
  if (typeof o === "string") {
    if (LINK.test(o)) out.add(o);
  } else if (Array.isArray(o)) o.forEach((x) => links(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach((v) => links(v, out));
  return out;
}

function proveniencias(o: any, out: any[] = []): any[] {
  if (Array.isArray(o)) o.forEach((x) => proveniencias(x, out));
  else if (o && typeof o === "object") {
    if ("natureza" in o && "fonte" in o && "limitacoes" in o) out.push(o);
    Object.values(o).forEach((v) => proveniencias(v, out));
  }
  return out;
}

describe("gold de energia: presença e integridade", () => {
  it("todas as golds existem, são do domínio energia e estão íntegras", () => {
    for (const g of GOLDS) {
      expect(existsSync(join(DIR, g)), g).toBe(true);
      const j = ler(g);
      expect(j.dominio, g).toBe("energia");
      expect(j.disponivel, g).toBe(true);
    }
  });

  it("toda gold publicada (inclusive as dos módulos) tem o cabeçalho do domínio", () => {
    expect(TODAS.length).toBeGreaterThan(GOLDS.length);
    for (const g of TODAS) {
      const j = ler(g);
      expect(j.dominio, g).toBe("energia");
      expect(typeof j.disponivel, g).toBe("boolean");
      expect(j.gerado_em, g).toMatch(/Z$/);
      if (!j.disponivel) expect(j.motivo, g).toBeTruthy();
    }
  });

  it("a gold de cada módulo do dicionário de arquivos existe e está íntegra", () => {
    const arq = ler("arquivos.json").arquivos as Record<string, { gold: string; colunas: string }>;
    const golds = new Set(Object.values(arq).map((a) => a.gold));
    for (const g of Array.from(golds)) {
      expect(existsSync(join(DIR, g)), g).toBe(true);
      expect(ler(g).disponivel, g).toBe(true);
    }
    for (const [url, a] of Object.entries(arq)) {
      expect(existsSync(join(process.cwd(), "public", url)), url).toBe(true);
      expect(a.colunas.length, url).toBeGreaterThan(20);
    }
  });

  it("todo caminho /energia/... citado numa gold existe em public/", () => {
    for (const g of TODAS) {
      for (const u of Array.from(links(ler(g)))) expect(existsSync(join(process.cwd(), "public", u)), `${g}: ${u}`).toBe(true);
    }
  });

  it("meta.json não registra builder falho nem regressão retida", () => {
    const m = ler("meta.json");
    expect(m.builders_falhos).toEqual([]);
    expect(m.regressoes).toEqual([]);
  });
});

describe("proveniência: todo indicador leva ao dado primário", () => {
  // todas as golds publicadas, não só as de operação: o contrato vale para os módulos
  const todas = TODAS.flatMap((g) => proveniencias(ler(g)).map((p) => ({ g, p })));

  it("há proveniência em cada gold de indicador", () => {
    for (const g of ["pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json"]) {
      expect(todas.filter((x) => x.g === g).length, g).toBeGreaterThan(0);
    }
  });

  it("natureza válida, fonte com órgão e URL, período, snapshot e limitações não vazias", () => {
    for (const { g, p } of todas) {
      const id = `${g}: ${p.indicador}`;
      expect(NATUREZAS, id).toContain(p.natureza);
      expect(p.fonte.orgao, id).toBeTruthy();
      expect(p.fonte.url_dataset, id).toMatch(/^https:\/\//);
      expect(p.fonte.licenca, id).toBeTruthy();
      expect(p.periodo_referencia?.inicio, id).toBeTruthy();
      expect(p.periodo_referencia?.fim, id).toBeTruthy();
      expect(p.snapshot?.id, id).toBeTruthy();
      expect(p.snapshot?.sha256, id).toMatch(/^[0-9a-f]{64}$/);
      expect(p.capturado_em, id).toBeTruthy();
      expect(Array.isArray(p.limitacoes) && p.limitacoes.length > 0, id).toBe(true);
    }
  });

  it("indicador calculado sempre tem fórmula", () => {
    for (const { g, p } of todas) {
      if (p.natureza === "CALCULADO") expect(p.formula, `${g}: ${p.indicador}`).toBeTruthy();
    }
  });

  it("downloads declarados existem", () => {
    for (const { p } of todas) {
      if (p.download) expect(existsSync(join(process.cwd(), "public", p.download)), p.download).toBe(true);
    }
  });
});

describe("ausência nunca vira zero", () => {
  it("séries do PLD não têm zero nem valor não numérico (o PLD é positivo)", () => {
    const pld = ler("pld.json");
    for (const linha of [...pld.diario, ...pld.horario_30d]) {
      for (const sm of ["SE", "S", "NE", "N"]) {
        const v = linha[sm];
        expect(v === null || (typeof v === "number" && v > 0), `${linha.d ?? linha.t} ${sm}`).toBe(true);
      }
    }
  });

  it("EAR, carga e geração: nenhum ponto é zero exato disfarçando lacuna", () => {
    const h = ler("hidrologia.json");
    for (const l of h.serie_ear) for (const k of ["SE", "S", "NE", "N", "SIN"]) expect(l[k] === null || l[k] > 0, `EAR ${l.d} ${k}`).toBe(true);
    const c = ler("carga.json");
    for (const l of c.serie) for (const k of ["SE", "S", "NE", "N", "SIN"]) expect(l[k] === null || l[k] > 0, `carga ${l.d} ${k}`).toBe(true);
    const g = ler("geracao.json");
    for (const l of g.serie_sin) for (const k of ["hidraulica", "termica", "eolica"]) expect(l[k] === null || l[k] > 0, `geração ${l.d} ${k}`).toBe(true);
  });

  it("CSVs publicados: ausência é campo vazio, nunca 'nan', 'None' ou 'null'", () => {
    const dir = join(process.cwd(), "public", "energia", "series");
    for (const f of readdirSync(dir)) {
      const t = readFileSync(join(dir, f), "utf-8");
      expect(t, f).not.toMatch(/;(nan|NaN|None|null|undefined)(;|\n)/);
    }
  });
});

describe("classificação só com regra publicada", () => {
  it("toda faixa do PLD vem acompanhada da regra e dos quartis", () => {
    const pld = ler("pld.json");
    expect(pld.regras.posicao_historica).toMatch(/25º percentil/);
    for (const c of pld.cartoes) {
      if (c.posicao.faixa) {
        expect(["baixa", "central", "alta"]).toContain(c.posicao.faixa);
        expect(c.posicao.quartis.p25).not.toBeNull();
        expect(c.posicao.n_dias).toBeGreaterThan(365);
      }
    }
    expect(pld.regras.menor_valor_ano).toMatch(/Não é o piso regulatório/);
  });

  it("faixa usual da hidrologia vem da regra do 10º ao 90º percentil", () => {
    const h = ler("hidrologia.json");
    expect(h.regras.faixa_usual).toMatch(/10º e o 90º percentil/);
    for (const s of h.subsistemas) {
      if (s.ear.faixa) expect(s.ear.anos_na_base).toBeGreaterThanOrEqual(20);
    }
  });

  it("comparação anual da carga só aparece dentro do mesmo regime metodológico", () => {
    const c = ler("carga.json");
    for (const s of c.subsistemas) {
      for (const j of [s.ult7, s.ult30]) {
        if (j && !j.mesmo_regime) expect(j.variacao_pct).toBeNull();
      }
    }
  });

  it("síntese: toda frase tem regra e todo trecho com link tem evidência", () => {
    const s = ler("sintese.json");
    expect(s.frases.length).toBeGreaterThan(0);
    for (const f of s.frases) {
      expect(f.regra, f.id).toBeTruthy();
      for (const t of f.trechos) if (t.href) expect(t.evidencia, f.id).toBeTruthy();
    }
    for (const o of s.observar) expect(o.condicao, o.id).toBeTruthy();
  });
});

describe("catálogo coerente com o pipeline", () => {
  // Os estados antigos (UTILIZADO EM INDICADOR, UTILIZADO EM MODELO) viraram dois eixos:
  // estado na escada catalogado → publicado, com evidência, e papel de uso declarado.
  it("cada dataset integrado na interface existe no catálogo com o mesmo slug, validado e com papel de uso", () => {
    const cat = ler("catalogo.json") as CatalogoDados;
    for (const d of DATASETS_INTEGRADOS) {
      const e = cat.entradas.find((x) => x.id === d.catalogoId)!;
      expect(e, d.catalogoId).toBeTruthy();
      expect(e.slug).toBe(d.slug);
      expect(["VALIDADO", "PUBLICADO"], d.catalogoId).toContain(e.estado);
      expect(e.papeis?.length, d.catalogoId).toBeGreaterThan(0);
    }
  });

  it("estado de cada entrada na escada, sem salto: publicado exige validado, validado exige integrado", () => {
    const cat = ler("catalogo.json") as CatalogoDados;
    expect(cat.estados).toEqual(ESTADOS);
    let soma = 0;
    for (const e of cat.entradas) {
      expect(ESTADOS, e.id).toContain(e.estado);
      soma += 1;
      const i = ESTADOS.indexOf(e.estado);
      if (i >= 2) {
        expect(e.etapas, e.id).toBeTruthy();
        for (const etapa of ["catalogado", "recurso_verificado", "integrado", "validado", "publicado"].slice(0, i + 1)) {
          expect((e.etapas as any)[etapa]?.ok, `${e.id} ${etapa}`).toBe(true);
        }
        expect(e.integracoes?.length, e.id).toBeGreaterThan(0);
      }
      if (e.estado === "PUBLICADO") expect(e.usado_em.length, e.id).toBeGreaterThan(0);
    }
    expect(soma).toBe(cat.total);
    expect(ESTADOS.reduce((t, k) => t + (cat.contagem as any)[k], 0)).toBe(cat.total);
  });

  it("conjunto declarado por módulo que não chegou a INTEGRADO aparece com ressalva que explica", () => {
    const cat = ler("catalogo.json") as CatalogoDados;
    for (const e of cat.entradas) {
      if (e.integracoes?.length && ["CATALOGADO", "RECURSO VERIFICADO"].includes(e.estado)) {
        expect(e.ressalvas?.length, e.id).toBeGreaterThan(0);
        expect(DATASETS_INTEGRADOS.map((d) => d.catalogoId), e.id).not.toContain(e.id);
      }
    }
  });

  it("PLD, EAR e ENA são publicados em indicador; os modelos que os usam aparecem com o estado do registro", () => {
    const cat = ler("catalogo.json") as CatalogoDados;
    for (const id of ["ccee:pld_horario", "ons:ear-diario-por-subsistema", "ons:ena-diario-por-subsistema"]) {
      const e = cat.entradas.find((x) => x.id === id)!;
      expect(e.papeis, id).toContain("indicador");
      expect(e.papeis, id).not.toContain("modelo");
      for (const m of e.modelos ?? []) expect(Object.keys(cat.modelos), `${id} ${m}`).toContain(m);
    }
  });

  it("CCEE recurso a recurso: resumo por portal fecha com as entradas", () => {
    const cat = ler("catalogo.json") as CatalogoDados;
    const ccee = cat.entradas.filter((e) => e.orgao === "CCEE" && e.recursos_resumo);
    expect(ccee.length).toBeGreaterThan(0);
    expect(ccee.reduce((t, e) => t + e.recursos_resumo!.total, 0)).toBe(cat.recursos.CCEE.total);
    for (const e of cat.entradas.filter((x) => x.recursos)) {
      expect(e.recursos!.filter((r) => !r.removido).length, e.id).toBe(e.recursos_resumo!.total);
    }
  });

  it("nenhum dataset só catalogado aparece como fonte de indicador", () => {
    const cat = ler("catalogo.json");
    for (const e of cat.entradas) if (e.estado === "CATALOGADO") expect(e.usado_em, e.id).toEqual([]);
  });

  it("entrada manual nunca se apresenta como verificada", () => {
    const manual = JSON.parse(readFileSync(join(process.cwd(), "pipeline", "energia", "catalogo_manual.json"), "utf-8"));
    const cat = ler("catalogo.json");
    for (const m of manual.entradas) {
      const e = cat.entradas.find((x: any) => x.id === m.id);
      expect(e.metadados_verificados, m.id).toBe(false);
    }
  });
});

describe("publicação: saúde, revisões, manifesto e reprodução (módulo dados)", () => {
  const g = ler("publicacao.json") as PublicacaoGold;
  const m = ler("manifesto.json") as ManifestoGold;

  it("publicacao.json íntegra, dentro do limite de tamanho e com conjuntos únicos", () => {
    expect(g.disponivel).toBe(true);
    expect(readFileSync(join(DIR, "publicacao.json")).length).toBeLessThanOrEqual(400 * 1024);
    expect(readFileSync(join(DIR, "catalogo.json")).length).toBeLessThanOrEqual(400 * 1024);
    const ids = g.conjuntos.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.resumo.integracoes).toBe(g.conjuntos.length);
  });

  // Consistência interna da gold (não é conferência independente): a falha simulada no silver e o
  // período relido no original do bronze estão em pipeline/tests/test_energia_dados.py e na ficha
  // conjuntos_atrasados.
  it("consistência da atualidade: atrasado tem prazo vencido, em dia não, e nenhum período passa de hoje", () => {
    const hoje = g.referencia.hoje;
    for (const c of g.conjuntos) {
      const a = c.atualidade;
      expect(["EM DIA", "ATRASADO", "SEM SLA", "SEM DADO"], c.id).toContain(a.situacao);
      if (a.situacao === "ATRASADO") expect(a.prazo_proximo! < hoje, c.id).toBe(true);
      if (a.situacao === "EM DIA") expect(a.prazo_proximo! >= hoje, c.id).toBe(true);
      if (a.ultimo_periodo && a.ultimo_periodo.length >= 10) expect(a.ultimo_periodo.slice(0, 10) <= hoje, c.id).toBe(true);
      if (a.situacao === "SEM SLA" || a.situacao === "SEM DADO") expect(a.motivo_sem_sla, c.id).toBeTruthy();
      // período corrente parcial não alonga o prazo: o prazo nunca passa do fim do período
      // corrente mais a tolerância da cadência
      if (a.periodo_parcial && (a.caso === "A" || a.caso === "C") && a.cadencia && a.fim_ultimo_periodo && a.prazo_proximo) {
        const limite = new Date(a.fim_ultimo_periodo + "T00:00:00Z");
        limite.setUTCDate(limite.getUTCDate() + g.regras.sla[a.cadencia].tolerancia_dias);
        expect(a.prazo_proximo <= limite.toISOString().slice(0, 10), c.id).toBe(true);
      }
    }
  });

  it("revisão publicada com magnitude e alcance, não só contagem", () => {
    const revisados = g.conjuntos.filter((c) => (c.revisoes?.referencias ?? 0) > 0);
    for (const c of revisados) {
      const r = c.revisoes!;
      // pares (série, referência) nunca são menos que as referências distintas
      expect(r.observacoes ?? 0, c.id).toBeGreaterThanOrEqual(r.referencias ?? 0);
      expect(r.ref_min && r.ref_max, c.id).toBeTruthy();
      expect(r.maior_abs, c.id).toBeTruthy();
      expect(Math.abs(r.maior_abs!.para - r.maior_abs!.de - r.maior_abs!.diferenca)).toBeLessThan(1e-4);
      expect(r.maior_abs!.capturado_de < r.maior_abs!.capturado_para, c.id).toBe(true);
    }
    expect(g.resumo.com_revisao).toBe(revisados.length);
  });

  it("validação e natureza são eixos separados e o veredito agrega checagens registradas", () => {
    const v = g.resumo.validacao;
    expect(v.aprovado + v.ressalva + v.reprovado + v.nao_aplicavel).toBe(v.checagens);
    for (const nat of Object.keys(g.eixos.matriz)) expect([...NATUREZAS, "SEM_VINCULO"]).toContain(nat);
    for (const c of g.conjuntos) {
      if (c.estado === "VALIDADO" || c.estado === "PUBLICADO") expect(c.etapas.validado.reprovadas ?? 0, c.id).toBe(0);
    }
  });

  it("manifesto: id da publicação refeito pela regra publicada, sha256 e arquivos existentes", () => {
    const canon = JSON.stringify([...m.arquivos].sort((a, b) => (a.caminho < b.caminho ? -1 : 1)).map((i) => [i.caminho, i.bytes, i.sha256]));
    expect(createHash("sha256").update(canon, "utf8").digest("hex")).toBe(m.id_publicacao);
    expect(new Set(m.arquivos.map((i) => i.caminho)).size).toBe(m.arquivos.length);
    for (const i of m.arquivos) {
      expect(i.sha256, i.caminho).toMatch(/^[0-9a-f]{64}$/);
      expect(existsSync(join(process.cwd(), "public", i.caminho)), i.caminho).toBe(true);
    }
    for (const p of g.arquivos.parquet) if (p.csv) expect(p.equivalente, p.parquet).toBe(true);
  });

  it("link de versão no GitHub: commit do build quando conhecido, histórico do arquivo quando não", () => {
    expect(commitDoBuild({ VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567" })).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(commitDoBuild({ VERCEL_GIT_COMMIT_SHA: "" })).toBeNull();
    expect(commitDoBuild({ GITHUB_SHA: "texto qualquer" })).toBeNull();
    expect(urlVersaoGithub("/energia/gold/pld.json", "abc1234")).toEqual({
      url: "https://github.com/genarolins1975/scrutiniums/blob/abc1234/public/energia/gold/pld.json",
      exata: true,
    });
    expect(urlVersaoGithub("/energia/gold/pld.json", null).exata).toBe(false);
    expect(g.reproducao.url_versao_modelo).toContain("{commit}");
  });

  it("afirmação sobre limites de intercâmbio não diz que estão integrados enquanto o achado A06 estiver bloqueado", () => {
    const a = g.afirmacoes.find((x) => x.id === "limites_intercambio")!;
    expect(a).toBeTruthy();
    if (/bloquead/i.test(a.achado?.status ?? "")) {
      expect(a.texto).toMatch(/não foram integrados/);
      expect(a.texto).not.toMatch(/^Limites de intercâmbio entre subsistemas: integrado/);
    }
  });

  it("avaliação dos painéis: sem arquivo, sem nota", () => {
    expect(g.avaliacao.existe).toBe(existsSync(join(DIR, "avaliacao.json")));
    if (!g.avaliacao.existe) expect(g.avaliacao.arquivo).toBeNull();
  });

  it("toda medida do módulo dados está no catálogo de métricas", () => {
    const ids = (ler("metricas.json").metricas as { id: string }[]).map((x) => x.id);
    for (const id of ["dados_estado_catalogo", "dados_situacao_atualidade", "dados_revisoes_alcance", "dados_id_publicacao"]) {
      expect(ids, id).toContain(id);
    }
  });
});
