import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContaReajustesPage from "@/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page";
import { emReaisDoMesBase, fatoresReaisPorAno, lerIpcaCsv, linhasSubsidios, categoriasSubsidio } from "@/lib/energia/conta";
import { mesAno, reais } from "@/lib/energia/formato";
import type { ContaGold } from "@/lib/energia/tipos-conta";

/**
 * O painel de subsídios e da CDE com "Em reais" escolhido (?valores=real), renderizado de verdade: o gancho que lê a URL é trocado por um
 * que lê "?valores=real", e a página inteira sai no servidor como o leitor a veria depois de escolher. O bloqueio que a avaliação achou:
 * o gráfico e a tabela mostravam R$ 19,68 bilhões em 2025, enquanto o número de destaque, a frase e o "o que mudou" seguiam em R$ 18,82
 * bilhões nominais, sem rótulo. Este teste falharia com a página de antes: o número, a frase e o "o que mudou" não liam a escolha.
 */

vi.mock("@/components/energia/useEstadoUrl", async () => {
  const lib = await import("@/lib/energia/estadoUrl");
  return {
    useEstadoUrl: (esquema: Parameters<typeof lib.lerEstado>[0]) => [lib.lerEstado(esquema, "?valores=real"), () => undefined],
  };
});

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const gold = JSON.parse(ler("public/energia/gold/conta.json")) as ContaGold;
const disponivel = gold.disponivel === true;
const semEspacoDuro = (t: string) => t.replace(/\s/g, " ");
const texto = (h: string) =>
  semEspacoDuro(
    h
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " "),
  );

describe.skipIf(!disponivel)("painel de subsídios com 'Em reais' escolhido: o número, a frase e o que mudou dizem o mesmo que o gráfico", () => {
  const html = renderToStaticMarkup(createElement(ContaReajustesPage));
  const inicio = html.indexOf('id="subsidios"');
  const painel = html.slice(inicio);
  const t = texto(painel);
  const sub = gold.subsidios;
  const ipca = lerIpcaCsv(ler("public/energia/series/conta_ipca.csv"));
  const baseIso = gold.reajustes.comparacao_inflacao!.ultimo_ipca!;
  const base = mesAno(`${baseIso}-01`);
  const fatores = fatoresReaisPorAno(ipca, Array.from(new Set(sub.anual.map((a) => a.ano))), baseIso);
  const doGrafico = emReaisDoMesBase(linhasSubsidios(sub), ["soma", ...categoriasSubsidio(sub)], fatores, "ano");
  const ano = sub.anual.find((a) => a.ano === sub.ultimo_ano_completo)!;
  const real25 = (doGrafico.find((l) => l.ano === ano.ano)!.soma as number);
  const nominal25 = ano.soma_categorias! / 1e9;

  it("todas as peças que falam em dinheiro estão na versão em reais (nenhuma ficou nominal sem rótulo)", () => {
    expect(painel).toContain('data-moeda="real"');
    expect(painel).not.toContain('data-moeda="nominal"');
    expect((painel.match(/data-moeda="real"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    // o gráfico escolhido também está em reais
    expect(painel).toContain('data-valores="real"');
  });

  it("o valor de 2025 em reais é o mesmo no gráfico, na frase, no número de destaque e no que mudou", () => {
    expect(real25).toBeGreaterThan(nominal25);
    const alvo = semEspacoDuro(reais(real25, 2));
    // a frase de abertura (o veredito) e a resposta completa
    expect(t).toContain(`foram homologados ${alvo} bilhões para repasse da Conta de Desenvolvimento Energético (CDE)`);
    expect(t).toContain(`valores em reais de ${base}`);
    // o número de destaque, com a moeda dita no recorte e o nominal só como referência
    expect(t).toContain(`Subsídios tarifários em ${ano.ano}`);
    expect(t).toContain(`Em reais de ${base}`);
    expect(t).toContain(semEspacoDuro(reais(real25, 1)));
    expect(t).toContain(`O valor nominal é ${semEspacoDuro(reais(nominal25, 2))} bilhões`);
    // o "o que mudou": total de cada ano em reais, cada um pelo seu fator
    const completos = sub.anual.filter((a) => !a.parcial);
    const [a0, a1] = completos.slice(-2);
    const g0 = doGrafico.find((l) => l.ano === a0.ano)!.soma as number;
    const g1 = doGrafico.find((l) => l.ano === a1.ano)!.soma as number;
    expect(t).toContain(`O total passou de ${semEspacoDuro(reais(g0, 2))} bilhões para ${semEspacoDuro(reais(g1, 2))} bilhões`);
    expect(t).toContain(`Valores em reais de ${base}`);
    // a tabela equivalente do gráfico traz o mesmo valor do ano
    expect(t).toContain(semEspacoDuro(reais(real25, 2).replace("R$ ", "")));
  });

  it("o valor nominal de 2025 não aparece como valor principal: só como o nominal ao lado do valor em reais", () => {
    const nominal = semEspacoDuro(reais(nominal25, 2));
    expect(t).not.toContain(`foram homologados ${nominal} bilhões`);
    expect(t).not.toContain(`Valores nominais, na moeda da época.`);
    // cada menção ao nominal vem junto da palavra nominal
    for (const m of Array.from(t.matchAll(new RegExp(nominal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")))) {
      const ao_redor = t.slice(Math.max(0, m.index! - 80), m.index! + nominal.length + 60);
      expect(ao_redor, `menção ao nominal sem rótulo: ${ao_redor}`).toMatch(/nominal/);
    }
  });

  it("a ficha 'Comprove este número' do valor nominal fica fora do número em reais, com o caminho dito: escolher Nominais", () => {
    expect(t).toContain('o da ficha "Comprove este número": escolha Nominais');
  });

  it("os arquivos para baixar dizem que trazem valores nominais", () => {
    expect(t).toContain("os arquivos para baixar trazem os valores nominais");
  });
});
