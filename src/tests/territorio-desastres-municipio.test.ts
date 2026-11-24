import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GRUPOS, lerDesastres } from "@/lib/territorio/desastres";
import { fichaDesastres, lerDesastresMunicipios } from "@/lib/territorio/desastresMunicipio";
import { ROTA_DESASTRES_MUNICIPIO, rotaFichaDesastres } from "@/lib/territorio/consultaDesastres";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { donoDaRota } from "@/lib/observatorios/registro";
import { paraVoceDoMapa } from "@/lib/observatorios/paraVoce";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => ROTA_DESASTRES_MUNICIPIO,
  // a busca do município empurra a ficha pelo roteador; fora do App Router, um roteador vazio basta
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
}));

/**
 * Ficha "O meu município já teve desastre reconhecido?" (Território e Clima). Invariantes: a gold municipal
 * reconcilia com a série nacional do painel; município sem registro é "nenhum registro", nunca "nenhum desastre";
 * danos sem registro são indisponíveis, não zero; a rota é fechada como os painéis.
 */
describe("desastres por município", () => {
  const g = lerDesastresMunicipios()!;
  const nacional = lerDesastres();
  const indice = JSON.parse(readFileSync(join(process.cwd(), "public", "saneamento", "gold", "indice.json"), "utf-8")) as [string, string, string][];

  it("a gold municipal soma, ano a ano e por grupo, os reconhecidos da série nacional", () => {
    expect(g.periodo.inicio).toBe(2003);
    const soma = new Map<string, number>();
    for (const l of Object.values(g.linhas)) {
      for (const item of l.r) {
        const [dia, tipo] = item.split(" ");
        const chave = `${dia.slice(0, 4)}:${g.grupoDoTipo[tipo]}`;
        soma.set(chave, (soma.get(chave) ?? 0) + 1);
      }
    }
    for (const a of nacional.serie_anual.filter((x) => x.ano >= g.periodo.inicio && x.ano <= g.periodo.fim)) {
      for (const gr of GRUPOS) expect(soma.get(`${a.ano}:${gr}`) ?? 0, `${a.ano} ${gr}`).toBe(a.por_grupo_reconhecidos![gr]);
    }
  });

  it("a ficha conta os reconhecimentos da gold, e o estado é a soma dos seus municípios", () => {
    const f = fichaDesastres("3303906")!;
    expect(f.nome).toBe("Petrópolis");
    expect(f.reconhecimentos.length).toBe(g.linhas["3303906"].r.length);
    expect(f.porAno.reduce((s, a) => s + a.total, 0)).toBe(f.reconhecimentos.length);
    expect(f.porAno).toHaveLength(f.anosNoPeriodo);
    const daUf = indice.filter(([, , uf]) => uf === "RJ");
    expect(f.estado.municipios).toBe(daUf.length);
    expect(f.estado.reconhecimentos).toBe(daUf.reduce((s, [id]) => s + (g.linhas[id]?.r.length ?? 0), 0));
    expect(f.posicaoUf).toBeGreaterThanOrEqual(1);
    expect(f.posicaoUf!).toBeLessThanOrEqual(f.estado.comReconhecimento);
    expect(f.danos).not.toBeNull();
  });

  it("município sem registro na base: nenhum reconhecimento e danos indisponíveis, não zero; código desconhecido não tem ficha", () => {
    const sem = indice.find(([id]) => !g.linhas[id])!;
    const f = fichaDesastres(sem[0])!;
    expect(f.reconhecimentos).toEqual([]);
    expect(f.semReconhecimento).toBe(0);
    expect(f.danos).toBeNull();
    expect(f.posicaoUf).toBeNull();
    for (const id of ["1234567", "330390", "33039060", "abc1234", "../gold"]) expect(fichaDesastres(id), id).toBeNull();
  });

  it("renderiza a ficha com período, fonte, comparação com o estado e a lista, sem número inventado", async () => {
    const { default: Ficha } = await import("@/app/territorio/desastres/municipio/[ibge]/page");
    const html = renderToStaticMarkup(createElement(Ficha, { params: { ibge: "3303906" } }));
    expect(html).toContain("Desastres reconhecidos em Petrópolis (RJ)");
    expect(html).toContain("Comparado com Rio de Janeiro");
    expect(html).toContain("Sedec/MIDR, Atlas Digital de Desastres");
    expect(html).toMatch(/Captura em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain("Cada reconhecimento");
    expect(html).not.toMatch(/NaN|undefined|Infinity|\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain("desastres_municipios.json");

    const sem = indice.find(([id]) => !g.linhas[id])!;
    const vazio = renderToStaticMarkup(createElement(Ficha, { params: { ibge: sem[0] } }));
    expect(vazio).toContain("Isso não prova que não houve desastre");
    expect(vazio).toMatch(/Indisponível: .* Não é zero/);
    expect(vazio).not.toContain("Cada reconhecimento");
  });

  it("a rota é fechada, pertence à coleção Fogo e desastres e o \"Para você\" leva à ficha", () => {
    for (const r of [ROTA_DESASTRES_MUNICIPIO, rotaFichaDesastres("3303906"), "/territorio/gold/desastres_municipios.json"]) expect(ehRotaPublica(r), r).toBe(false);
    expect(donoDaRota(ROTA_DESASTRES_MUNICIPIO)).toMatchObject({ observatorio: "territorio-e-clima", colecao: "fogo" });
    const cartao = paraVoceDoMapa(null).cidade.find((c) => c.id === "cidade-desastres")!;
    expect(cartao.href).toBe(ROTA_DESASTRES_MUNICIPIO);
  });
});
