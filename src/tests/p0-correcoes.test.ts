/**
 * Travas dos sete P0 da avaliação de 06/09/2026 (docs/AVALIACAO_PAINEIS_2026-09-06.md §7):
 * quatro de dados (D1 a D4) e três técnicos (T1 a T3). Cada teste lê o arquivo
 * que carrega a correção e falha se ela for desfeita.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("D1: SCR.data com revisão detectada, piso de linhas e download em fluxo", () => {
  const src = read("pipeline/sources/scr_data.py");
  it("registra a carga por data-base (CRC do CSV, linhas, saldo)", () => {
    expect(src).toContain("CREATE TABLE IF NOT EXISTS scr_carga");
    expect(src).toContain("info.CRC");
  });
  it("recusa arquivo abaixo do piso de linhas em vez de publicar número parcial", () => {
    expect(src).toMatch(/PISO_LINHAS = 0\.\d+/);
    expect(src).toContain("arquivo possivelmente truncado; nada gravado");
  });
  it("não baixa o zip de ano fechado já carregado e usa download em fluxo com retry", () => {
    expect(src).toContain("ano fechado com 12 datas-base carregadas");
    expect(src).toContain("common.http_download(");
    expect(read("pipeline/common.py")).toContain("def http_download(");
  });
  it("http_get retenta IncompleteRead (HTTPException)", () => {
    expect(read("pipeline/common.py")).toMatch(/http\.client\.HTTPException\) as e:/);
  });
  it("panorama publica aviso de variação atípica de carteira por UF", () => {
    const pano = read("pipeline/panorama.py");
    expect(pano).toMatch(/VARIACAO_SALDO_ATIPICA = 0\.0\d/);
    expect(pano).toContain('"tipo": "uf_variacao_saldo"');
  });
});

describe("D2: candidatos do IF.data gerados pela data corrente", () => {
  it("config declara auto e load_config resolve para fins de trimestre", () => {
    expect(read("config/config.json")).toMatch(/"anomes_candidates":\s*"auto:\d+"/);
    const out = execFileSync("python3", ["-c", [
      "import sys, json; sys.path.insert(0, '.')",
      "from pipeline import common; from datetime import date",
      "print(json.dumps([common.anomes_candidatos(5, date(2026, 9, 6)), common.anomes_candidatos(2, date(2026, 1, 15)), common.load_config()['ifdata']['anomes_candidates'][:1]]))",
    ].join("\n")], { cwd: RAIZ, encoding: "utf8" });
    const [set26, jan26, cfg] = JSON.parse(out);
    expect(set26).toEqual(["202606", "202603", "202512", "202509", "202506"]);
    expect(jan26).toEqual(["202512", "202509"]);
    expect(cfg[0]).toMatch(/^\d{6}$/);
  });
  it("coletores do REST do IF.data tratam período não publicado como ausência, não pane", () => {
    for (const f of ["pipeline/sources/ifdata_ui.py", "pipeline/sources/ifdata_carteiras.py", "pipeline/sources/ifdata_funding.py"]) {
      expect(read(f), f).toContain('"pulado": "período ainda não publicado na fonte"');
    }
  });
});

describe("D3: builders de Comparar e Consignado e sentinela que declara restauração", () => {
  it("compare ignora métrica sem CodInst e o coletor não a grava", () => {
    expect(read("pipeline/compare.py")).toMatch(/if not cod:\n\s+continue/);
    expect(read("pipeline/sources/ifdata.py")).toContain('not row.get("CodInst")');
  });
  it("sanidade_gold escreve `restaurados` em meta.json e a vigília acusa", () => {
    expect(read("scripts/sanidade_gold.py")).toContain('meta["restaurados"] = restaurados');
    const vig = read("scripts/vigilancia.py");
    expect(vig).toContain('meta.get("restaurados")');
    expect(vig).toContain('meta.get("builders_falhos")');
  });
});

describe("D4: vintages e prazos de vigília para as seis fontes", () => {
  const chaves = ["fidc", "pix", "estban", "openfinance", "pgfn", "desenrola"];
  it("gold.py calcula o vintage de cada uma", () => {
    const gold = read("pipeline/gold.py");
    for (const k of chaves) expect(gold, k).toMatch(new RegExp(`"${k}": _vg`));
  });
  it("vigilancia.py tem prazo para cada uma", () => {
    const vig = read("scripts/vigilancia.py");
    const bloco = vig.slice(vig.indexOf("PRAZO_VINTAGE_DIAS = {"), vig.indexOf("RESTAURADO_MAX_DIAS"));
    for (const k of chaves) expect(bloco, k).toMatch(new RegExp(`"${k}": \\d+`));
  });
});

describe("T1: fetchGold com response.ok e sem refetch infinito", () => {
  const app = read("public/obs/app.js");
  it("fetchGold rejeita resposta não ok e memoriza a falha", () => {
    expect(app).toMatch(/async function fetchGold\(f\) \{[\s\S]*?if \(!r\.ok\) throw/);
    expect(app).toContain("GOLD_FALHAS[f] =");
  });
  it("screener distingue não pedido (undefined) de falhou (null)", () => {
    expect(app).toContain('if (S === undefined) { fetchGold("screener")');
    expect(app).toContain('if (!S) return goldIndisponivel("screener", "screener");');
  });
  it("cache de UF do panorama marca o voo e a falha", () => {
    expect(app).toContain("state.panoCache[uf] = null; // em voo");
    expect(app).toContain("state.panoCache[uf] = { erro: true }");
  });
});

describe("T2: CI e vigília encadeados ao pipeline", () => {
  it("ci.yml e vigilancia.yml disparam por workflow_run do pipeline", () => {
    for (const f of [".github/workflows/ci.yml", ".github/workflows/vigilancia.yml"]) {
      const y = read(f);
      expect(y, f).toMatch(/workflow_run:\n\s+workflows: \["Atualizar dados do Observatório"\]\n\s+types: \[completed\]/);
    }
    expect(read(".github/workflows/vigilancia.yml")).toContain('"${{ github.event_name }}" = "workflow_run"');
  });
});

describe("T3: gold atômico e builders protegidos", () => {
  it("write_gold grava em temporário e renomeia", () => {
    const c = read("pipeline/common.py");
    expect(c).toContain("def _escreve_atomico(");
    expect(c).toContain("os.replace(tmp, path)");
    const out = execFileSync("python3", ["-c", [
      "import sys, os, json, tempfile; sys.path.insert(0, '.')",
      "from pipeline import common",
      "d = tempfile.mkdtemp(); common.GOLD = d",
      "common.write_gold('x.json', {'a': 1}); common.stub('y.json', RuntimeError('boom'))",
      "print(json.dumps({'x': json.load(open(os.path.join(d, 'x.json'))), 'y': json.load(open(os.path.join(d, 'y.json'))), 'tmp': [f for f in os.listdir(d) if f.endswith('.tmp')], 'falhas': [f['gold'] for f in common.FALHAS_BUILD]}))",
    ].join("\n")], { cwd: RAIZ, encoding: "utf8" });
    const r = JSON.parse(out.trim().split("\n").pop() as string);
    expect(r.x).toEqual({ a: 1 });
    expect(r.y).toMatchObject({ disponivel: false, ok: false, error: "boom" });
    expect(r.tmp).toEqual([]);
    expect(r.falhas).toEqual(["y.json"]);
  });
  it("nenhum except de build_all grava stub à mão; meta publica builders_falhos", () => {
    const gold = read("pipeline/gold.py");
    expect(gold).not.toMatch(/common\.write_gold\("[^"]+", \{"(ok|disponivel)": False, "error": str\(e\)\}\)/);
    expect(gold).toContain('"builders_falhos":');
    for (const g of ["exposures.json", "openfinance.json", "rj.json", "antecedentes.json"]) {
      expect(gold, g).toContain(`common.stub("${g}", e)`);
    }
  });
});
