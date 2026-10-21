import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capturasDoConjunto } from "../lib/energia/capturas-servidor";
import type { MetaGold } from "../lib/energia/tipos";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetPage from "../app/setor-eletrico/dados/[dataset]/page";
import { DATASETS_INTEGRADOS, catalogoDados } from "../lib/energia/datasets";
import { gold } from "../lib/energia/gold";
import * as capturasServidor from "../lib/energia/capturas-servidor";

const temporarios: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const p of temporarios.splice(0)) rmSync(p, { recursive: true }); });

function fixture(csv: string) {
  const raiz = mkdtempSync(join(tmpdir(), "energia-capturas-"));
  temporarios.push(raiz);
  mkdirSync(join(raiz, "energia/series"), { recursive: true });
  writeFileSync(join(raiz, "energia/series/capturas_fontes.csv"), csv);
  const fonte: MetaGold["fontes"][string] = {
    ultima_captura: "2026-10-18T00:00:00Z", snapshot: "ds@captura", snapshot_sha256: "hash",
    ultima_tentativa: null, capturas: [], historico: [],
    historico_csv: "/energia/series/capturas_fontes.csv",
    resumo_capturas: { total_capturas: 1, total_historico: 2, primeira: "2026-10-17T00:00:00Z", ultima: "2026-10-18T00:00:00Z", recapturas_sem_mudanca: 0, limite_recentes: 10 },
  };
  return { raiz, fonte };
}

const CSV = 'dataset;familia;recurso;sha256;capturado_em;publicado_em;origem;vigente\nds;energia;"recurso; com ""aspas""";antigo;2026-10-17T00:00:00Z;;coleta_direta;false\nds;energia;"recurso; com ""aspas""";atual;2026-10-18T00:00:00Z;2026-10-17T23:00:00Z;coleta_direta;true\noutro;energia;recurso;hash;2026-10-18T00:00:00Z;;seed;true\n';

describe("histórico completo na ficha, além da amostra do JSON", () => {
  it("lê todas as linhas do conjunto, preserva ausência e aspas e exclui outros conjuntos", () => {
    const { raiz, fonte } = fixture(CSV);
    const linhas = capturasDoConjunto(fonte, "ds", raiz);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({ familia: 'energia', recurso: 'recurso; com "aspas"', sha256: "antigo", capturado_em: "2026-10-17T00:00:00Z", publicado_em: null, origem: "coleta_direta", vigente: false });
    expect(linhas[1].vigente).toBe(true);
    expect(linhas[1].publicado_em).toBe("2026-10-17T23:00:00Z");
  });

  it("recusa CSV incompleto, vigência inválida e endereço fora do contrato", () => {
    for (const csv of [CSV.replace(/\nds;energia;.*false\n/, "\n"), CSV.replace(";true", ";desconhecida")]) {
      const { raiz, fonte } = fixture(csv);
      expect(() => capturasDoConjunto(fonte, "ds", raiz)).toThrow();
    }
    const { raiz, fonte } = fixture(CSV);
    expect(() => capturasDoConjunto({ ...fonte, historico_csv: "/outro.csv" }, "ds", raiz)).toThrow();
    rmSync(join(raiz, "energia/series/capturas_fontes.csv"));
    expect(() => capturasDoConjunto(fonte, "ds", raiz)).toThrow();
  });

  it("continua lendo o histórico da publicação anterior até a nova gold sair", () => {
    expect(capturasDoConjunto(undefined, "ausente")).toEqual([]);
    const { fonte } = fixture(CSV);
    const h = { familia: "energia", recurso: "recurso", sha256: "hash", capturado_em: "2026-10-17T00:00:00Z", publicado_em: null, origem: "seed", vigente: true };
    expect(capturasDoConjunto({ ...fonte, resumo_capturas: undefined, historico: [h] }, "ds")).toEqual([h]);
  });

  it("a ficha mostra os totais e a tabela integral do CSV mesmo com amostra JSON vazia", () => {
    const d = DATASETS_INTEGRADOS.find((x) => catalogoDados()?.entradas.some((e) => e.id === x.catalogoId))!;
    const { raiz, fonte } = fixture(CSV.replaceAll("\nds;", `\n${d.interno};`));
    const meta = gold.meta()!;
    vi.spyOn(gold, "meta").mockReturnValue({ ...meta, fontes: { ...meta.fontes, [d.interno]: fonte } });
    const original = capturasServidor.capturasDoConjunto;
    const leitura = vi.spyOn(capturasServidor, "capturasDoConjunto").mockImplementation((f, ds) => original(f, ds, raiz));
    const html = renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: d.slug } }));
    expect(leitura).toHaveBeenCalledWith(fonte, d.interno);
    expect(html).toContain("2 registros de captura, dos quais 1 vigente.");
    expect(html).toContain('href="/energia/series/capturas_fontes.csv"');
    expect(html).toContain("antigo");
    expect(html).toContain("atual");
    expect(html).not.toContain('data-sem-capturas="true"');
  });

  it("resumo e CSV divergentes: a ficha diz que o histórico está indisponível, sem derrubar o build nem mostrar amostra", () => {
    const d = DATASETS_INTEGRADOS.find((x) => catalogoDados()?.entradas.some((e) => e.id === x.catalogoId))!;
    const { raiz, fonte } = fixture(CSV.replaceAll("\nds;", `\n${d.interno};`));
    fonte.resumo_capturas = { ...fonte.resumo_capturas!, total_historico: 5 };
    const meta = gold.meta()!;
    vi.spyOn(gold, "meta").mockReturnValue({ ...meta, fontes: { ...meta.fontes, [d.interno]: fonte } });
    const original = capturasServidor.capturasDoConjunto;
    expect(() => original(fonte, d.interno, raiz)).toThrow();
    vi.spyOn(capturasServidor, "capturasDoConjunto").mockImplementation((f, ds) => original(f, ds, raiz));
    const html = renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: d.slug } }));
    expect(html).toContain('data-capturas-indisponiveis="true"');
    expect(html).toContain("histórico de capturas deste conjunto está indisponível");
    expect(html).not.toContain("antigo");
    expect(html).not.toContain('data-sem-capturas="true"');
    // sem totais do resumo nem download que a própria ficha declara incompatível
    expect(html).not.toContain('data-resumo-capturas="true"');
    expect(html).not.toContain('href="/energia/series/capturas_fontes.csv"');
  });

  it("mantém duas famílias com o mesmo recurso e mostra suas versões separadamente", () => {
    const d = DATASETS_INTEGRADOS.find((x) => catalogoDados()?.entradas.some((e) => e.id === x.catalogoId))!;
    const adicional = 'ds;familia_b;"recurso; com ""aspas""";antigo;2026-10-16T00:00:00Z;;reuso:aneel_geracao;true\n';
    const { raiz, fonte } = fixture((CSV + adicional).replaceAll("\nds;", `\n${d.interno};`));
    fonte.snapshot = null;
    fonte.snapshot_sha256 = null;
    fonte.recapturas_sem_mudanca = null;
    fonte.resumo_capturas = { ...fonte.resumo_capturas!, total_historico: 3, total_capturas: 2, primeira: "2026-10-16T00:00:00Z", recapturas_sem_mudanca: null };
    fonte.snapshots_familias = [
      { familia: "energia", snapshot: "ds@2026-10-18", snapshot_sha256: "sha-energia", ultima_captura: "2026-10-18T00:00:00Z", recapturas_sem_mudanca: 3,
        ultima_tentativa: { tentado_em: "2026-10-18T12:00:00Z", ok: true, detalhe: "conteúdo idêntico conferido" } },
      { familia: "familia_b", snapshot: "ds@2026-10-16", snapshot_sha256: "sha-b", ultima_captura: "2026-10-16T00:00:00Z", recapturas_sem_mudanca: null,
        ultima_tentativa: { tentado_em: "2026-10-18T13:00:00Z", ok: false, detalhe: "HTTP 503 na fonte" } },
    ];
    const original = capturasServidor.capturasDoConjunto;
    expect(original(fonte, d.interno, raiz).filter((h) => h.vigente).map((h) => h.familia).sort()).toEqual(["energia", "familia_b"]);
    const meta = gold.meta()!;
    vi.spyOn(gold, "meta").mockReturnValue({ ...meta, fontes: { ...meta.fontes, [d.interno]: fonte } });
    vi.spyOn(capturasServidor, "capturasDoConjunto").mockImplementation((f, ds) => original(f, ds, raiz));
    const html = renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: d.slug } }));
    expect(html).toContain("3 registros de captura, dos quais 2 vigentes.");
    expect(html).toContain('data-snapshots-familias="true"');
    expect(html).toContain("sha-energia");
    expect(html).toContain("sha-b");
    expect(html).toContain("Situação na família");
    expect(html).toMatch(/data-tentativa-familia="energia"[^>]*>[^<]*ok/);
    expect(html).toContain("conteúdo idêntico conferido");
    expect(html).toMatch(/data-tentativa-familia="familia_b"[^>]*>[^<]*falhou/);
    expect(html).toContain("HTTP 503 na fonte");
    expect(html).toContain("reuso:aneel_geracao");
  });
});
