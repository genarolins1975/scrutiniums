/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Central de alertas unificada. O teste mais importante deste módulo é negativo:
 * garantir que a consolidação NÃO tenha criado comparabilidade onde ela não
 * existe — nenhuma severidade inventada para fontes que não graduam, nenhum
 * placar somando famílias de universos e periodicidades diferentes.
 *
 * O segundo é de completude: se uma família parar de ser lida, o total tem de
 * denunciar. Alerta que some em silêncio é pior do que alerta que não existe.
 */
function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const G = "public/obs/data/gold/";
const C = load(G + "alertas_central.json");
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");

const FAMILIAS = ["macro", "carteira", "openfinance", "antecedentes", "operacional"];

/** Regra de consolidação da família operacional (central_alertas._sem_fre):
 *  FRE não entregue (total zerado ou variação de -100%) vira UM alerta por ano
 *  de referência; as demais flags seguem uma a uma. */
function operacionaisEsperados(flags: any[]): number {
  const semFre = new Set<string>();
  let demais = 0;
  for (const f of flags) {
    const v = Number(f.valor);
    const ausente = f.indicador === "empregados" &&
      (f.regra === "total_zerado" || (f.regra === "variacao_aa" && Number.isFinite(v) && v <= -99.5));
    if (ausente) semFre.add(String(f.referencia ?? "s-ref").slice(0, 4));
    else demais++;
  }
  return demais + semFre.size;
}

describe("alertas_central.json: estrutura das famílias", () => {
  it("as cinco famílias estão declaradas com universo, periodicidade e regra", () => {
    expect(C.familias.map((f: any) => f.id).sort()).toEqual([...FAMILIAS].sort());
    for (const f of C.familias) {
      for (const campo of ["nome", "universo", "periodicidade", "fonte", "regra_geral", "ordenacao", "limitacao", "view"]) {
        expect(f[campo], `${f.id}.${campo}`).toBeTruthy();
      }
    }
  });

  it("cada família declara quantos alertas trouxe e se a fonte estava disponível", () => {
    for (const f of C.familias) {
      expect(Number.isInteger(f.ativos), f.id).toBe(true);
      expect(typeof f.disponivel, f.id).toBe("boolean");
      const naFamilia = C.alertas.filter((a: any) => a.familia === f.id).length;
      expect(naFamilia, f.id).toBe(f.ativos);
    }
  });

  it("família sem dado nesta execução aparece em fontes_ausentes, não some", () => {
    for (const f of C.familias) {
      if (!f.disponivel) {
        expect(C.fontes_ausentes.some((x: any) => x.familia === f.id), f.id).toBe(true);
      }
    }
  });
});

describe("alertas_central.json: nada de comparabilidade inventada", () => {
  it("a página avisa explicitamente para não somar famílias", () => {
    expect(C.nao_comparavel).toMatch(/não some/i);
    expect(C.nao_comparavel).toMatch(/universos e periodicidades diferentes/i);
  });

  it("a carteira do SCR.data chega sem nível — a fonte não gradua severidade", () => {
    const carteira = C.alertas.filter((a: any) => a.familia === "carteira");
    expect(carteira.length).toBeGreaterThan(0);
    for (const a of carteira) expect(a.nivel, a.titulo).toBeNull();
    expect(C.sem_nivel).toMatch(/seria inventar|criar informação/i);
  });

  it("a família operacional tem nível pela regra declarada, e o texto explica a régua", () => {
    const oper = C.alertas.filter((a: any) => a.familia === "operacional");
    for (const a of oper) {
      expect(a.nivel, a.id).toBeTruthy();
      if (/:(queda_12m|variacao_aa):/.test(a.id)) expect(a.nivel, a.id).toBe("atencao");
      if (/:(troca_auditor|sem_fre)/.test(a.id)) expect(a.nivel, a.id).toBe("informativo");
    }
    expect(C.sem_nivel).toMatch(/operacional/);
  });

  it("todo nível presente pertence ao vocabulário declarado", () => {
    for (const a of C.alertas) {
      if (a.nivel != null) expect(C.niveis, a.id).toContain(a.nivel);
    }
  });

  it("ausência de alerta é declarada como ausência de regra disparada, não de risco", () => {
    expect(C.ausencia).toMatch(/não significa ausência de risco/i);
  });

  it("o estado do usuário é declarado como local", () => {
    expect(C.estado_local).toMatch(/navegador/i);
    expect(C.estado_local).toMatch(/nada é enviado|não é enviado/i);
  });
});

describe("alertas_central.json: integridade dos registros", () => {
  it("todo alerta traz id prefixado pela família, título, fonte e link de contexto", () => {
    for (const a of C.alertas) {
      expect(FAMILIAS, a.id).toContain(a.familia);
      expect(a.id.startsWith(a.familia + ":"), a.id).toBe(true);
      expect(a.titulo, a.id).toBeTruthy();
      expect(a.detalhe, a.id).toBeTruthy();
      expect(a.link?.view, a.id).toBeTruthy();
    }
  });

  it("ids são únicos — estado local por alerta depende disso", () => {
    const ids = C.alertas.map((a: any) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada lista está ordenada pelo critério que a própria família declara", () => {
    for (const f of C.familias) {
      const ordens = C.alertas.filter((a: any) => a.familia === f.id).map((a: any) => a.ordem ?? 0);
      for (let i = 1; i < ordens.length; i++) {
        expect(ordens[i], `${f.id} fora de ordem na posição ${i}`).toBeLessThanOrEqual(ordens[i - 1]);
      }
    }
  });

  it("total bate com a soma das famílias e com as fontes de origem", () => {
    expect(C.total).toBe(C.alertas.length);
    expect(C.total).toBe(C.familias.reduce((s: number, f: any) => s + f.ativos, 0));
    // guarda contra família que silenciosamente para de ser lida
    const origem =
      load(G + "alerts.json").alertas.length +
      load(G + "panorama.json").alertas.length +
      (load(G + "openfinance.json").alertas_of || []).length +
      (load(G + "leading.json").alertas || []).length +
      operacionaisEsperados(load(G + "operacional.json").flags || []);
    expect(C.total).toBe(origem);
  });
});

describe("pipeline: o consolidador roda depois de quem ele lê", () => {
  const gold = readFileSync(join(process.cwd(), "pipeline/gold.py"), "utf-8");

  it("é chamado após leading e panorama — antes, leria a execução anterior", () => {
    const consolidador = gold.indexOf("central_alertas.build()");
    expect(consolidador).toBeGreaterThan(-1);
    for (const dep of ["leading_mod.build", "panorama_mod.build", 'write_gold("openfinance.json"', 'write_gold("alerts.json"']) {
      expect(gold.indexOf(dep), `${dep} precisa vir antes do consolidador`).toBeLessThan(consolidador);
      expect(gold.indexOf(dep)).toBeGreaterThan(-1);
    }
  });

  it("o feed unificado sobrescreve alerts.xml — a URL dos assinantes não muda", () => {
    expect(gold).toContain('write_gold_text("alerts.xml", central_alertas.rss(central))');
    // o gerador antigo, só da família macro, não pode ter sobrado
    expect(gold).not.toContain("_rss_items");
  });
});

describe("feed RSS: uma URL, todas as famílias", () => {
  const xml = readFileSync(join(process.cwd(), G + "alerts.xml"), "utf-8");

  it("mantém a URL de sempre e traz um item por alerta", () => {
    expect((xml.match(/<item>/g) ?? []).length).toBe(C.total);
  });

  it("cada item declara a família no título — o assinante não tem a página à frente", () => {
    for (const f of C.familias) {
      if (f.ativos) expect(xml, f.nome).toContain(`[${f.nome} ·`);
    }
  });

  it("o feed é XML bem formado mesmo com & nos nomes", () => {
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?><rss/);
    const titulos = xml.match(/<title>[^<]*<\/title>/g) ?? [];
    for (const t of titulos) expect(t.replace(/&(amp|lt|gt|quot|apos);/g, "")).not.toContain("&");
  });
});

describe("SPA: a central lê o arquivo consolidado", () => {
  it("o arquivo entra no núcleo — o contador vale em qualquer página", () => {
    expect(app).toMatch(/const CORE_FILES = \[[^\]]*"alertas_central"/);
  });

  it("o badge do cabeçalho conta as quatro famílias, não só a macro", () => {
    const i = app.indexOf("function updateAlertBadge()");
    const corpo = app.slice(i, app.indexOf("\n}", i));
    expect(corpo).toContain("alertas_central");
    expect(corpo).toContain("alertasAbertos");
  });

  it("mudar o estado de um alerta atualiza o contador na hora", () => {
    const i = app.indexOf("window.setAlertState");
    expect(app.slice(i, i + 400)).toContain("updateAlertBadge()");
  });

  it("estado salvo antes da unificação continua valendo (id sem prefixo)", () => {
    const i = app.indexOf("function alertState(id)");
    expect(app.slice(i, app.indexOf("\n}", i))).toContain('split(":")');
  });

  it("o nível é exibido acentuado, embora a chave do dado não tenha acento", () => {
    expect(app).toMatch(/NIVEL_LABEL = \{[^}]*atencao: "atenção"/);
    expect(app).toMatch(/NIVEL_LABEL = \{[^}]*critico: "crítico"/);
  });

  it("a página monta uma seção por família, com a regra e o limite de cada uma", () => {
    const i = app.indexOf("function listasAlertas()");
    const corpo = app.slice(i, app.indexOf("\nfunction renderAlerts", i));
    for (const campo of ["fam.universo", "fam.regra_geral", "fam.ordenacao", "fam.limitacao"]) {
      expect(corpo, campo).toContain(campo);
    }
  });
});
