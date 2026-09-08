import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Correções da primeira execução diária completa (07/09/2026, run 34134336452), que publicou sem
 * falha mas com três golds defeituosos: consórcios e cobrança sem per capita (população vinha de
 * ufs.json, que no runner não existe antes de ufs.py rodar), rural sem gênero (o recurso leve do
 * Sicor era o último da fila e a cota acabava antes) e BNDES sem operações (hash guardado numa
 * absorção que falhou). O que se trava: a fonte primária da população é o silver, a fila do Sicor
 * é mês-maior e o hash inalterado não vale com tabela vazia.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("população por UF vem do silver, não do gold anterior", () => {
  it("common.populacao_uf lê geo_uf e usa ufs.json só como reserva; consórcios e cobrança usam o auxiliar", () => {
    const c = read("pipeline/common.py");
    expect(c).toContain("def populacao_uf(con):");
    expect(c).toContain('SELECT uf, populacao FROM geo_uf');
    expect(c).toContain("if len(pop) < 27:");
    expect(read("pipeline/consorcios.py")).toContain("pop = common.populacao_uf(con)");
    const cb = read("pipeline/cobranca.py");
    expect(cb).toContain("pop_uf = common.populacao_uf(con)");
    expect(cb).toContain('pan = common.ler_gold_opcional("panorama.json") or {}');
    expect(cb).not.toMatch(/ufs_gold = \{u\["uf"\]: u for u in .*\n    ufs = \[\]/);
  });
});

describe("Sicor: recursos leves em ordem de mês", () => {
  it("o laço externo é o mês (recente primeiro) e o interno o recurso, para gênero receber a janela de 12 meses na primeira execução", () => {
    const s = read("pipeline/sources/sicor.py");
    const i = s.indexOf("for mes in _meses_historia():\n        for recurso, fn in leves:");
    expect(i).toBeGreaterThan(0);
    expect(s).not.toContain("for recurso, fn in leves:\n        for mes in _meses_historia():");
  });
});

describe("BNDES: hash inalterado não vale com tabela vazia", () => {
  it("collect força a absorção quando a tabela alvo está vazia", () => {
    const b = read("pipeline/sources/bndes.py");
    expect(b).toContain('if not mudou and con.execute(f"SELECT COUNT(*) FROM {tabela}").fetchone()[0] == 0:');
    expect(b).toContain("mudou = True");
  });
});

describe("orçamento de tempo da coleta (08/09/2026: job cancelado aos 150 min sem publicar)", () => {
  it("run.py pula coletores depois do orçamento, cronometra cada um e escreve sem buffer; job com teto de 300 min", () => {
    const r = read("pipeline/run.py");
    expect(r).toContain('ORCAMENTO_COLETA_MIN = float(os.environ.get("OBS_ORCAMENTO_COLETA_MIN", "120"))');
    expect(r).toContain("if decorrido_min > ORCAMENTO_COLETA_MIN:");
    expect(r).toContain('"segundos": round(time.monotonic() - t0)');
    expect(r).toContain("print(msg, flush=True)");
    const w = read(".github/workflows/atualizar-dados.yml");
    expect(w).toContain("timeout-minutes: 300");
    expect(w).toContain("python3 -u pipeline/run.py");
    expect(read("pipeline/sources/pilar3.py")).toContain("_fetch(url, timeout=60, tentativas=1)");
    const sc = read("pipeline/sources/sicor.py");
    expect(sc).toContain("ORCAMENTO_S = 1500");
    expect(sc).toContain("if gasto_leve >= CAP_LEVES or estourou():");
    expect(sc).toContain("if gasto >= CAP_PESADOS or estourou():");
  });
});

