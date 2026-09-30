import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faseAtual, situacaoConsulta, type GoldRegulacao } from "@/lib/energia/tipos-regulacao";

/**
 * Contrato da gold do módulo Regulação (P044 a P046) do lado da interface:
 * a regra de situação das consultas reaplicada na página (situacaoConsulta) dá o mesmo
 * resultado que o pipeline na data de referência da gold, e os limites do PLD mantêm os
 * campos separados que o painel de permanência do PLD consome.
 */
const gold = JSON.parse(readFileSync(join(process.cwd(), "public/energia/gold/regulacao.json"), "utf-8")) as GoldRegulacao;
const disponivel = gold.disponivel === true;

describe.skipIf(!disponivel)("gold regulacao.json", () => {
  it("situação das consultas: TypeScript reproduz o Python na data de referência", () => {
    const ref = gold.consultas.data_referencia;
    for (const c of gold.consultas.itens) expect(situacaoConsulta(c, ref), c.id).toBe(c.situacao);
  });

  it("consulta vencida nunca aparece como aberta, em qualquer data posterior", () => {
    for (const c of gold.consultas.itens) {
      const f = faseAtual(c);
      if (!f?.fim) continue;
      const depois = new Date(Date.parse(`${f.fim}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      expect(["aberta", "a_abrir"]).not.toContain(situacaoConsulta(c, depois));
    }
  });

  it("fase sem datas não vira aberta", () => {
    const semData = { fases: [{ fase: "abertura" as const, data_deliberacao: "2026-01-01", reuniao: "x", inicio: null, fim: null, duracao_dias: 45, sessao: null, trecho_periodo: null }], resultado: null };
    expect(situacaoConsulta(semData, "2026-01-10")).toBe("prazo_nao_datado");
  });

  it("limites: piso, teto horário e teto estrutural em campos separados, publicação distinta de vigência", () => {
    for (const a of gold.limites_pld.atos) {
      expect(a.unidade).toBe("R$/MWh");
      expect(a.vigencia_inicio <= a.vigencia_fim).toBe(true);
      if (a.pld_max_horario !== null && a.pld_max_estrutural !== null) expect(a.pld_max_horario).toBeGreaterThan(a.pld_max_estrutural);
    }
    for (const v of gold.limites_pld.vigencias) {
      expect(v.pld_min).not.toBeNull();
      expect(v.pld_max_horario).not.toBeNull();
      expect(v.pld_max_estrutural).not.toBeNull();
    }
  });

  it("linha do tempo nunca traz impacto estimado", () => {
    for (const e of gold.linha_do_tempo.eventos) expect(e.impacto_estimado).toBeNull();
  });
});
