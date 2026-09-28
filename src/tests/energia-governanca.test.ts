/* eslint-disable @typescript-eslint/no-explicit-any -- leitura da gold publicada */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Governança de previsão do PLD (docs/observatorios/PLD_GOVERNANCA_PREVISAO.md)
 * verificada sobre o que é publicado: nenhum modelo fora de produção vira
 * previsão, ausência não vira número, arquivo imutável confere por sha256 e
 * resultados retidos não vazam para a interface.
 */
const raiz = process.cwd();
const gold = (n: string) => JSON.parse(readFileSync(join(raiz, "public", "energia", "gold", n), "utf-8"));
const prev = gold("previsoes.json");
const mods = gold("modelos.json");

describe("estados de modelo e previsão principal", () => {
  it("todo modelo tem estado válido, limitações registradas e promoção só em produção", () => {
    for (const m of mods.modelos) {
      expect(["PESQUISA", "VALIDACAO", "PRODUCAO", "APOSENTADO"]).toContain(m.estado);
      expect(m.limitacoes.length, m.codigo).toBeGreaterThan(0);
      if (m.estado === "PRODUCAO") expect(m.promovido_em, m.codigo).toBeTruthy();
      else expect(m.promovido_em, m.codigo).toBeNull();
    }
  });

  it("sem modelo em produção, a previsão principal está indisponível com motivo, última execução e o que falta", () => {
    const emProducao = mods.modelos.filter((m: any) => m.estado === "PRODUCAO");
    expect(mods.em_producao.length).toBe(emProducao.length);
    if (emProducao.length === 0) {
      expect(prev.atual.disponivel).toBe(false);
      expect(prev.atual.motivo_codigo).toBe("NENHUM_MODELO_EM_PRODUCAO");
      expect(prev.atual.motivo).toBeTruthy();
      expect(prev.atual.ultima_execucao).toBeTruthy();
      expect(prev.atual.informacao_faltante.length).toBeGreaterThan(0);
      expect(prev.atual.estado_pipeline).toBeTruthy();
    }
  });

  it("toda publicação vem de modelo em produção, com versão, código, snapshot e cutoff", () => {
    const porCodigo = Object.fromEntries(mods.modelos.map((m: any) => [m.codigo, m]));
    for (const r of prev.arquivo.filter((x: any) => x.tipo === "PUBLICACAO")) {
      expect(porCodigo[r.modelo]?.estado, r.forecast_id).toBe("PRODUCAO");
      for (const c of ["versao_modelo", "versao_codigo", "snapshot", "cutoff", "emitido_em"]) expect(r[c], `${r.forecast_id} ${c}`).toBeTruthy();
    }
    expect(prev.publicacoes).toBe(prev.arquivo.filter((x: any) => x.tipo === "PUBLICACAO").length);
  });
});

describe("arquivo imutável", () => {
  it("indisponível nunca tem número; disponível sempre tem", () => {
    for (const r of prev.arquivo) {
      if (r.status === "INDISPONIVEL") {
        expect(r.previsao, r.forecast_id).toBeNull();
        expect(r.quantis, r.forecast_id).toBeNull();
        expect(r.motivo, r.forecast_id).toBeTruthy();
      } else {
        expect(typeof r.previsao, r.forecast_id).toBe("number");
      }
    }
  });

  it("identificadores únicos, sha256 bem formado e nenhum cenário no arquivo", () => {
    const ids = new Set(prev.arquivo.map((r: any) => r.forecast_id));
    expect(ids.size).toBe(prev.arquivo.length);
    for (const r of prev.arquivo) {
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.natureza).not.toBe("CENARIO");
    }
  });

  it("faixa só é rotulada de 80% com calibração CALIBRADO", () => {
    for (const r of prev.arquivo) {
      if (r.quantis?.rotulo_faixa === "faixa de 80%") expect(r.calibracao?.status, r.forecast_id).toBe("CALIBRADO");
    }
  });

  it("o validador Python confere o sha256 de cada registro e o registro de modelos", () => {
    const out = execFileSync(
      "python3",
      [
        "-c",
        [
          "import json,sys",
          "sys.path.insert(0,'.')",
          "from pipeline.energia import governanca as g",
          "reg=json.load(open('pipeline/energia/registro_modelos.json',encoding='utf-8'))",
          "arq=g.le_jsonl('pipeline/energia/previsoes/arquivo.jsonl')",
          "mods={m['codigo']:m for m in reg['modelos']}",
          "v=g.valida_registro_modelos(reg)+g.valida_arquivo(arq,mods,resultados_liberados=reg['publicacao_resultados']['liberada'])",
          "pub=json.load(open('public/energia/gold/previsoes.json',encoding='utf-8'))['arquivo']",
          "v+=g.valida_append_only(pub,arq)",
          "print(json.dumps(v))",
        ].join("\n"),
      ],
      { cwd: raiz, encoding: "utf-8" },
    );
    expect(JSON.parse(out)).toEqual([]);
  });
});

describe("imutabilidade contra a lista fixa de registros publicados", () => {
  it("todo registro já publicado continua no arquivo versionado, com o mesmo sha256", () => {
    // a lista fixa detecta edição mesmo quando o arquivo e a gold mudam juntos no mesmo commit
    const fixos: [string, string][] = JSON.parse(readFileSync(join(raiz, "src", "tests", "fixtures", "previsoes-publicadas.json"), "utf-8")).registros;
    const linhas = readFileSync(join(raiz, "pipeline", "energia", "previsoes", "arquivo.jsonl"), "utf-8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const porId = new Map(linhas.map((r: any) => [r.forecast_id, r.sha256]));
    expect(fixos.length).toBeGreaterThan(0);
    for (const [id, sha] of fixos) expect(porId.get(id), id).toBe(sha);
  });

  it("na interface, número de rodada interna nunca aparece como previsão", () => {
    const t = readFileSync(join(raiz, "src", "components", "energia", "ArquivoPrevisoes.tsx"), "utf-8");
    expect(t).toContain('r.tipo !== "PUBLICACAO" || r.estado_modelo !== "PRODUCAO"');
    expect(t).toContain("número retido");
    expect(t).toContain("registrado_no_portal_em");
  });
});

describe("resultados de pesquisa retidos não vazam para a interface", () => {
  it("com publicação retida, nenhuma métrica de desempenho está na gold nem nas páginas", () => {
    if (mods.publicacao_resultados.liberada) return;
    const texto = JSON.stringify(mods) + JSON.stringify(prev);
    // métricas do artefato de pesquisa (MAE, cobertura etc.) não entram na gold enquanto retidas
    expect(texto).not.toMatch(/"(mae|rmse|cob80|cob90|perda_quantis|largura80)"/i);
    const dir = join(raiz, "src", "app", "setor-eletrico");
    const arquivos: string[] = [];
    const varre = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) varre(p);
        else if (p.endsWith(".tsx")) arquivos.push(p);
      }
    };
    varre(dir);
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      // números da pesquisa retida (ex.: MAE 32,97; cobertura 48,8%) não podem ser escritos à mão
      expect(t, f).not.toMatch(/32,97|48,8%|35,30|63,2%/);
    }
  });
});

describe("mecanismos sem conferência não aparecem como fato nas páginas", () => {
  it("formulações causais conhecidas não voltam aos painéis", () => {
    const proibidas = [
      /se compensam no SIN/i,
      /pressiona fontes/i,
      /termômetro da pressão/i,
      /repõe o estoque/i,
      /preço de curto prazo/i,
      /modelos de otimização/i,
      /água que chegou/i,
      /tratou as regiões de forma separada/i,
    ];
    const dir = join(raiz, "src", "app", "setor-eletrico");
    const arquivos: string[] = [];
    const varre = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) varre(p);
        else if (p.endsWith(".tsx")) arquivos.push(p);
      }
    };
    varre(dir);
    arquivos.push(join(raiz, "src", "lib", "energia", "conteudo", "conceitos.ts"), join(raiz, "src", "lib", "energia", "conteudo", "pld.ts"));
    const sintese = readFileSync(join(raiz, "public", "energia", "gold", "sintese.json"), "utf-8");
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      for (const re of proibidas) expect(t, `${f}: ${re}`).not.toMatch(re);
    }
    for (const re of proibidas) expect(sintese, `sintese.json: ${re}`).not.toMatch(re);
  });
});

describe("contribuição de modelo nunca vira causa", () => {
  it("o vocabulário de causa só aparece negado no conteúdo do domínio", () => {
    const arquivos = [
      join(raiz, "src", "lib", "energia", "conteudo", "pld.ts"),
      join(raiz, "src", "lib", "energia", "conteudo", "conceitos.ts"),
      join(raiz, "src", "app", "setor-eletrico", "pld", "page.tsx"),
      join(raiz, "src", "app", "setor-eletrico", "page.tsx"),
    ];
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      for (const m of Array.from(t.matchAll(/caus\w*/gi))) {
        const ctx = t.slice(Math.max(0, m.index! - 60), m.index! + 20).toLowerCase();
        expect(/nunca|não|nenhuma|sem /.test(ctx), `${f}: ...${ctx}...`).toBe(true);
      }
    }
  });
});
