/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Compra de folha de servidores pelos bancos. Os testes negativos são o
 * coração: valores de leilões distintos nunca somados; o ranking do PNCP é
 * por contagem (semântica de valor mista); vencer lote do INSS não é comprar
 * carteira de consignado. Lê o gold PUBLICADO (public/obs/data/gold) — a
 * lição do consignado: teste que lê workspace ausente pula para sempre no CI.
 */

const raiz = process.cwd();
const F = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/folha_bancos.json"), "utf-8"));
const curado = JSON.parse(readFileSync(join(raiz, "pipeline/curated/folha_leiloes.json"), "utf-8"));
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const runPy = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");

describe("camada curada: grandes leilões", () => {
  it("toda entrada tem vencedor, data, fonte com URL https e nível A ou B", () => {
    expect(curado.leiloes.length).toBeGreaterThanOrEqual(5);
    for (const l of curado.leiloes) {
      expect(l.vencedor, l.id).toBeTruthy();
      expect(String(l.data_resultado), l.id).toMatch(/^\d{4}/);
      expect(l.fontes.length, l.id).toBeGreaterThan(0);
      for (const f of l.fontes) {
        expect(f.url, l.id).toMatch(/^https:\/\//);
        expect(f.nivel, l.id).toMatch(/^[AB]$/);
      }
    }
  });

  it("valor ausente vem com nota de ausência declarada, nunca zero", () => {
    for (const l of curado.leiloes) {
      if (l.valor == null) {
        expect(l.valor_nota, l.id).toMatch(/ausência declarada|não.*homologado|projeção/i);
      } else {
        expect(l.valor, l.id).toBeGreaterThan(0);
      }
    }
  });

  it("o INSS declara os 26 lotes e que lote não é carteira de consignado", () => {
    const soma = curado.inss_lotes.vencedores.reduce((s: number, v: any) => s + v.lotes, 0);
    expect(soma).toBe(curado.inss_lotes.total_lotes);
    expect(curado.inss_lotes.total_lotes).toBe(26);
    expect(curado.inss_lotes.leitura).toMatch(/[Nn]ão é compra de carteira/);
  });
});

describe("gold folha_bancos.json", () => {
  it("publica as três camadas com as cautelas centrais", () => {
    expect(F.disponivel).toBe(true);
    expect(F.leiloes.length).toBeGreaterThanOrEqual(5);
    expect(F.inss.total_lotes).toBe(26);
    expect(F.pncp).toBeTruthy();
    const cautelas = F.cautelas.join(" ");
    expect(cautelas).toMatch(/NUNCA são somados/i);
    expect(cautelas).toMatch(/semântica mista/);
    expect(cautelas).toMatch(/Lei 14\.133/);
    expect(cautelas).toMatch(/heurística/i);
  });

  it("não existe nenhum total somando valores de leilões", () => {
    // a tentação óbvia — um "mercado de folha de R$ X bi" — seria número falso
    for (const chave of Object.keys(F)) {
      expect(chave).not.toMatch(/total_valor|valor_total|mercado_total/);
    }
  });

  it("o bloco do PNCP, quando disponível, rankeia por contagem com critério declarado", () => {
    if (!F.pncp.disponivel) {
      expect(F.pncp.motivo).toBeTruthy(); // ausência declarada, nunca silêncio
      return;
    }
    expect(F.pncp.total_contratos_if).toBeGreaterThan(0);
    expect(F.pncp.criterio_if).toMatch(/[Hh]eurística/);
    for (const r of F.pncp.ranking) {
      expect(r.cnpj8, r.banco).toMatch(/^\d{8}$/);
      expect(r.contratos).toBeGreaterThan(0);
      expect(r).not.toHaveProperty("valor_total");
    }
    // o ranking agrupa grafias pela raiz do CNPJ: raiz única por linha
    const raizes = F.pncp.ranking.map((r: any) => r.cnpj8);
    expect(new Set(raizes).size).toBe(raizes.length);
    for (const c of F.pncp.recentes) {
      expect(typeof c.receita, c.controle).toBe("boolean");
    }
  });

  it("todo item do catálogo declara conceito, fonte e limitações", () => {
    expect(F.catalogo.length).toBeGreaterThanOrEqual(3);
    for (const c of F.catalogo) {
      for (const campo of ["conceito", "fonte", "limitacoes", "unidade"]) {
        expect(c[campo], `${c.id}.${campo}`).toBeTruthy();
      }
    }
  });
});

describe("integração: coletor registrado e seção na SPA", () => {
  it("o coletor pncp_folha roda no pipeline diário", () => {
    expect(runPy).toContain('("pncp_folha", pncp_folha)');
  });

  it("a aba operacional carrega e renderiza a seção", () => {
    expect(appJs).toContain('"folha_bancos"');
    expect(appJs).toContain("Quem banca a folha dos servidores");
    // a ausência do PNCP é declarada na interface, nunca seção sumida
    expect(appJs).toMatch(/a camada volta sozinha na próxima execução/);
    // e a cautela de não-soma acompanha as tabelas
    expect(appJs).toMatch(/nunca são somados nem\s*\n?\s*comparados diretamente/i);
  });
});

describe("rodada 2: o lado do balanço (Fase 2 — publica só aprovado)", () => {
  const bal = JSON.parse(readFileSync(join(raiz, "pipeline/curated/folha_balanco.json"), "utf-8"));

  it("toda observação tem evidência completa e status do vocabulário", () => {
    for (const o of bal.observacoes) {
      expect(["em_revisao", "aprovado", "descartado"], o.id).toContain(o.status);
      expect(o.trecho, o.id).toBeTruthy();
      expect(o.pagina_pdf, o.id).toBeGreaterThan(0);
      expect(typeof o.exclusivo_folha, o.id).toBe("boolean");
      const doc = bal.documentos[o.documento];
      expect(doc, o.id).toBeTruthy();
      expect(doc.url, o.id).toMatch(/^https:\/\/www\.rad\.cvm\.gov\.br\//);
      expect(doc.identidade, o.id).toBeTruthy();
      // valor nulo só com ausência declarada na métrica
      if (o.valor == null) expect(o.metrica, o.id).toMatch(/AUSÊNCIA DECLARADA/);
      else expect(o.unidade, o.id).toMatch(/^R\$ (mil|milhões)$/);
    }
  });

  it("o gold reconcilia com a curadoria: aprovado publica, em revisão vira contagem", () => {
    const aprovadas = bal.observacoes.filter((o: any) => o.status === "aprovado");
    const emRevisao = bal.observacoes.filter((o: any) => o.status === "em_revisao");
    expect(F.balanco.observacoes.length).toBe(aprovadas.length);
    expect(F.balanco.em_revisao).toBe(emRevisao.length);
    for (const o of F.balanco.observacoes) {
      expect(o.trecho, o.id).toBeTruthy();
      expect(o.documento.url, o.id).toMatch(/^https:\/\//);
      expect(o.revisor, `${o.id}: aprovado exige revisor registrado`).toBeTruthy();
    }
    const cautelas = (F.balanco.cautelas || []).join(" ");
    expect(cautelas).toMatch(/NUNCA são somados nem ranqueados/);
  });

  it("a SPA declara a pendência de revisão e nunca inventa tabela vazia", () => {
    expect(appJs).toContain("O lado do balanço — intangível de folha nas DFP");
    expect(appJs).toMatch(/aguardando revisão\s*\n?\s*editorial/);
  });
});
