/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de curadoria e gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fase 2 — clientes a partir dos releases de resultados. O contrato que este
 * arquivo protege: NENHUM valor chega ao gold sem status "aprovado" E
 * evidência completa (documento na CVM, página e trecho literal); a
 * comparabilidade é sempre C (conceito da companhia, nunca ranking); os
 * contadores públicos batem com a curadoria; e a descoberta de documentos é
 * estruturada (CVM/IPE), com regras explícitas por banco.
 */
const raiz = process.cwd();
const cur = JSON.parse(
  readFileSync(join(raiz, "pipeline/curated/fase2_observacoes.json"), "utf-8"),
);
const gold = JSON.parse(
  readFileSync(join(raiz, "public/obs/data/gold/operacional.json"), "utf-8"),
);

describe("famílias de métrica: cliente não é pessoa do quadro", () => {
  it("cada métrica pertence a uma família declarada no gold builder", () => {
    const oper = readFileSync(join(process.cwd(), "pipeline/operacional.py"), "utf-8");
    for (const id of Object.keys(cur.metricas)) {
      expect(oper, `métrica ${id} sem família em FAMILIA_FASE2`).toContain(`"${id}":`);
    }
    expect(oper).toContain('"empregados_reportado": "pessoal"');
    expect(oper).toContain('"colaboradores_reportado": "pessoal"');
  });

  it("quadro de pessoal reportado nunca entra na série do FRE", () => {
    const g = JSON.parse(
      readFileSync(join(process.cwd(), "public/obs/data/gold/operacional.json"), "utf-8"),
    );
    for (const i of g.instituicoes) {
      if (!i.pessoal_reportado) continue;
      // quem publica quadro próprio é justamente quem não tem FRE; se um dia
      // tiver os dois, eles seguem em campos separados e nunca somados
      for (const p of i.pessoal_reportado) {
        expect(p.natureza).toBe("reportado");
        expect(p.comparabilidade).toBe("C");
        expect(p.evidencia?.length).toBeGreaterThan(15);
        expect(p.documento.url).toMatch(/^https:\/\//);
      }
      const serie = i.empregados?.serie ?? [];
      for (const s of serie) {
        expect(s.total).not.toBe(i.pessoal_reportado[0].valor);
      }
    }
    // a tabela da aba precisa existir e declarar a separação
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain("Quadro de pessoal divulgado pela própria instituição");
    expect(app).toContain("NÃO entram na série do FRE");
  });
});

describe("curadoria: toda observação é completa e auditável", () => {
  it("campos obrigatórios, evidência e documento oficial em toda observação", () => {
    expect(cur.observacoes.length).toBeGreaterThan(0);
    // Domínios oficiais permitidos: CVM (listadas no Brasil), SEC/EDGAR
    // (listadas no exterior) e o canal de RI da própria instituição quando ela
    // não é companhia aberta — file manager MZ (Caixa) e site do Banco Safra.
    // Ampliar esta lista é decisão consciente: nenhum documento entra por
    // agregador, buscador ou espelho.
    const dominios =
      /^https:\/\/(www\.rad\.cvm\.gov\.br|www\.sec\.gov|api\.mziq\.com|www\.safra\.com\.br)\//;
    for (const o of cur.observacoes) {
      expect(o.evidencia?.length, o.id).toBeGreaterThan(15);
      expect(o.pagina, o.id).toBeGreaterThanOrEqual(1);
      expect(o.documento.url, o.id).toMatch(dominios);
      expect(o.documento.protocolo, o.id).toMatch(/IPE|^sec:|^mz:|^safra:/);
      expect(o.valor, o.id).toBeGreaterThan(0);
      expect(o.period_end, o.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["review", "aprovado", "rejeitado"]).toContain(o.status);
      expect(o.comparabilidade, o.id).toBe("C");
      expect(o.natureza, o.id).toBe("reportado");
      expect(Object.keys(cur.metricas)).toContain(o.metric_id);
      expect(o.extraido_em, o.id).toBeTruthy();
    }
  });

  it("ids únicos e ausências documentadas com motivo", () => {
    const ids = cur.observacoes.map((o: any) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of cur.ausencias) {
      expect(a.motivo.length, a.institution_id).toBeGreaterThan(20);
      // a ausência tem de apontar o documento efetivamente conferido, seja ele
      // da CVM/IPE, da SEC ou do canal de RI da instituição
      expect(a.documento, a.institution_id).toMatch(/IPE|SEC|MZ|site d|plataforma/i);
    }
  });

  it("toda métrica declara conceito e comparabilidade C", () => {
    for (const [id, m] of Object.entries<any>(cur.metricas)) {
      expect(m.conceito.length, id).toBeGreaterThan(30);
      expect(m.comparabilidade, id).toBe("C");
    }
  });
});

describe("gold: publica só o aprovado, com contadores honestos", () => {
  // TODAS as famílias publicadas entram na reconciliação: se uma família nova
  // aparecer no gold sem ser lida aqui, a contagem deixa de fechar — foi assim
  // que a separação clientes/pessoal foi pega.
  const publicados = gold.instituicoes.flatMap((i: any) =>
    [...(i.clientes ?? []), ...(i.pessoal_reportado ?? [])]
      .map((c: any) => ({ ...c, institution_id: i.id })));

  it("cada item publicado corresponde a uma observação aprovada da curadoria", () => {
    const aprovadas = new Map(
      cur.observacoes
        .filter((o: any) => o.status === "aprovado")
        .map((o: any) => [`${o.institution_id}:${o.metric_id}:${o.period_end}`, o]),
    );
    expect(publicados.length).toBe(aprovadas.size);
    for (const p of publicados) {
      const o: any = aprovadas.get(`${p.institution_id}:${p.metric_id}:${p.period_end}`);
      expect(o, `${p.institution_id}:${p.metric_id}:${p.period_end}`).toBeTruthy();
      expect(p.valor).toBe(o.valor);
      expect(p.evidencia).toBe(o.evidencia);
      expect(p.pagina).toBe(o.pagina);
    }
  });

  it("os contadores da fase 2 batem com a curadoria", () => {
    const conta = (s: string) => cur.observacoes.filter((o: any) => o.status === s).length;
    expect(gold.fase2.em_revisao).toBe(conta("review"));
    expect(gold.fase2.aprovadas).toBe(conta("aprovado"));
    expect(gold.fase2.rejeitadas).toBe(conta("rejeitado"));
    expect(gold.fase2.nota).toContain("Comparabilidade C");
  });
});

describe("descoberta estruturada e superfícies", () => {
  const coletor = readFileSync(join(raiz, "pipeline/sources/releases.py"), "utf-8");
  const app = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

  it("as regras cobrem os bancos S1/S2 listados, via CVM/IPE — sem raspagem de RI", () => {
    for (const b of ["itau", "bb", "bradesco", "santander", "btg", "banrisul", "nordeste"]) {
      expect(coletor, b).toContain(`"${b}"`);
    }
    expect(coletor).toContain("dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE");
    expect(coletor).not.toMatch(/itau\.com\.br|bradesco\.com|santander\.com/);
  });

  it("o pipeline agenda o coletor e o workflow instala a dependência de PDF", () => {
    const run = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");
    expect(run).toContain('("releases", releases)');
    const wf = readFileSync(join(raiz, ".github/workflows/atualizar-dados.yml"), "utf-8");
    expect(wf).toContain("pip install pypdf");
  });

  it("a SPA declara a comparabilidade C e só renderiza o que veio do gold aprovado", () => {
    expect(app).toContain("Comparabilidade C");
    expect(app).toContain("aguardando revisão editorial");
    expect(app).toMatch(/i\.clientes && i\.clientes\.length/);
  });
});
