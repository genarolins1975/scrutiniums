import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LinhaDoTempo, type LinhaDoTempoProps } from "@/components/energia/LinhaDoTempo";
import {
  FILTRO_PADRAO,
  filtrarEventos,
  filtroAtivo,
  normalizarPeriodo,
  ordenarEventos,
  resumoFiltro,
  textoDefasagem,
  urlSegura,
  type EventoDatado,
} from "@/lib/energia/linha-do-tempo";

/**
 * Linha do tempo de atos (src/components/energia/LinhaDoTempo.tsx e
 * src/lib/energia/linha-do-tempo.ts). Os casos cobrem os erros que trocam o
 * sentido de uma cronologia regulatória: usar publicação no lugar de vigência,
 * sumir com eventos sem a data filtrada sem dizer quantos, pôr "sem data" no
 * topo da lista, chamar vigência retroativa de "−15 dias" e transformar um
 * endereço "javascript:" em link.
 */

const eventos: EventoDatado[] = [
  {
    id: "ren1000",
    titulo: "REN 1.000/2021: regras de prestação do serviço",
    categoria: "distribuicao",
    orgao: "ANEEL",
    publicacao: "2021-12-07",
    vigencia: "2022-01-03",
    dispositivo: "art. 1º",
    fonte: { rotulo: "ANEEL, biblioteca de atos", url: "https://www2.aneel.gov.br/cedoc/ren20211000.html" },
  },
  {
    id: "pld2024",
    titulo: "Limites do PLD para 2024",
    categoria: "pld",
    orgao: "ANEEL",
    publicacao: "2023-12-12",
    vigencia: "2024-01-01",
    fimVigencia: "2024-12-31",
    fonte: { rotulo: "Despacho", url: "https://www.aneel.gov.br/despacho-pld-2024" },
  },
  {
    id: "retro",
    titulo: "Ato com efeito retroativo",
    categoria: "tarifa",
    publicacao: "2024-03-20",
    vigencia: "2024-03-05",
    fonte: { rotulo: "Link suspeito", url: "javascript:alert(1)" },
  },
  { id: "semvig", titulo: "Ato sem vigência informada", categoria: "tarifa", publicacao: "2024-06-10", vigencia: null, fonte: null },
  { id: "sempub", titulo: "Ato sem data de publicação", categoria: "pld", publicacao: null, vigencia: "2024-03", fonte: null },
];

describe("filtro e ordenação", () => {
  it("categoria: null é todas, lista vazia é nenhuma", () => {
    expect(filtrarEventos(eventos, FILTRO_PADRAO).eventos).toHaveLength(5);
    expect(filtrarEventos(eventos, { ...FILTRO_PADRAO, categorias: [] }).eventos).toHaveLength(0);
    expect(filtrarEventos(eventos, { ...FILTRO_PADRAO, categorias: ["tarifa"] }).eventos.map((e) => e.id).sort()).toEqual(["retro", "semvig"]);
  });

  it("período vale para a data escolhida: vigência ≠ publicação", () => {
    const f = { ...FILTRO_PADRAO, inicio: "2024-01-01", fim: "2024-03-31" };
    expect(filtrarEventos(eventos, { ...f, base: "publicacao" }).eventos.map((e) => e.id)).toEqual(["retro"]);
    // por vigência, o PLD 2024 entra e o ato mensal "2024-03" também (conta pelo dia 1)
    expect(filtrarEventos(eventos, { ...f, base: "vigencia" }).eventos.map((e) => e.id).sort()).toEqual(["pld2024", "retro", "sempub"]);
  });

  it("eventos sem a data escolhida saem do recorte e são contados", () => {
    const r = filtrarEventos(eventos, { ...FILTRO_PADRAO, base: "vigencia", inicio: "2020-01-01" });
    expect(r.semDataNaBase).toBe(1);
    expect(r.eventos.map((e) => e.id)).not.toContain("semvig");
    // sem recorte de período, ninguém é excluído por falta de data
    expect(filtrarEventos(eventos, { ...FILTRO_PADRAO, base: "vigencia" }).semDataNaBase).toBe(0);
  });

  it("período invertido é desinvertido e ponta inválida é ignorada", () => {
    expect(normalizarPeriodo("2024-12-31", "2024-01-01")).toEqual({ inicio: "2024-01-01", fim: "2024-12-31" });
    expect(normalizarPeriodo("2024-02-30", null)).toEqual({ inicio: null, fim: null });
    expect(filtroAtivo({ ...FILTRO_PADRAO, inicio: "lixo" })).toBe(false);
  });

  it("sem a data da ordenação vai para o fim nas duas direções; empate desfeito pela outra data", () => {
    const rec = ordenarEventos(eventos, "publicacao", "recentes").map((e) => e.id);
    expect(rec).toEqual(["semvig", "retro", "pld2024", "ren1000", "sempub"]);
    const cron = ordenarEventos(eventos, "publicacao", "cronologica").map((e) => e.id);
    expect(cron).toEqual(["ren1000", "pld2024", "retro", "semvig", "sempub"]);
    const mesmoDia: EventoDatado[] = [
      { id: "b", titulo: "B", categoria: "x", publicacao: "2024-01-01", vigencia: "2024-03-01", fonte: null },
      { id: "a", titulo: "A", categoria: "x", publicacao: "2024-01-01", vigencia: "2024-02-01", fonte: null },
    ];
    expect(ordenarEventos(mesmoDia, "publicacao", "cronologica").map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("textos e segurança", () => {
  it("defasagem entre publicação e vigência, retroativa dita como tal", () => {
    expect(textoDefasagem("2021-12-07", "2022-01-03")).toBe("vigência 27 dias após a publicação");
    expect(textoDefasagem("2024-03-20", "2024-03-05")).toBe("vigência retroativa: 15 dias antes da publicação");
    expect(textoDefasagem("2024-03-20", "2024-03-20")).toBe("vigência na data da publicação");
    expect(textoDefasagem("2024-03-20", "2024-05")).toBe("vigência 2 meses após a publicação");
    expect(textoDefasagem(null, "2024-05-01")).toBeNull();
  });

  it("só http(s) vira link", () => {
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("/relativo")).toBeNull();
    expect(urlSegura("https://www.aneel.gov.br/x")).toBe("https://www.aneel.gov.br/x");
  });

  it("resumo do filtro com nomes das categorias e a data usada", () => {
    const cats = [
      { id: "tarifa", rotulo: "Tarifa" },
      { id: "pld", rotulo: "PLD" },
    ];
    expect(resumoFiltro({ categorias: ["tarifa", "pld"], inicio: "2023-01-01", fim: "2024-12-31", base: "vigencia" }, cats)).toBe(
      "categorias: Tarifa, PLD; vigência de 01/01/2023 a 31/12/2024",
    );
    expect(resumoFiltro({ ...FILTRO_PADRAO, fim: "2024-06-30" }, cats)).toBe("publicação até 30/06/2024");
  });
});

const categorias = [
  { id: "distribuicao", rotulo: "Distribuição" },
  { id: "pld", rotulo: "PLD" },
  { id: "tarifa", rotulo: "Tarifa" },
];
const html = (p: Partial<LinhaDoTempoProps> = {}) => renderToStaticMarkup(createElement(LinhaDoTempo, { titulo: "Atos regulatórios", eventos, categorias, ...p }));
const itens = (m: string) => Array.from(m.matchAll(/<li [^>]*data-id="([^"]+)"/g)).map((x) => x[1]);

describe("LinhaDoTempo no servidor", () => {
  const m = html();

  it("lista ordenada semântica com um item por evento, títulos como cabeçalho e categoria em texto", () => {
    expect(m).toMatch(/<ol aria-label="Atos regulatórios"/);
    expect(itens(m)).toEqual(["semvig", "retro", "pld2024", "ren1000", "sempub"]);
    expect(m).toMatch(/<h3 id="[^"]+" class="[^"]*">Limites do PLD para 2024<\/h3>/);
    expect(m).toMatch(/<article aria-labelledby="[^"]+"><p class="rotulo text-energia-dark">PLD · ANEEL<\/p>/);
  });

  it("publicação e vigência rotuladas e distintas, com <time> e 'não informada' na ausência", () => {
    const pld = m.match(/data-id="pld2024"[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(pld).toMatch(/<dt[^>]*>Publicação<\/dt><dd[^>]*><time dateTime="2023-12-12">12\/12\/2023<\/time><\/dd>/);
    expect(pld).toMatch(/<dt[^>]*>Vigência<\/dt><dd[^>]*>de <time dateTime="2024-01-01">01\/01\/2024<\/time> a <time dateTime="2024-12-31">31\/12\/2024<\/time>/);
    expect(pld).toContain("vigência 20 dias após a publicação");
    const semvig = m.match(/data-id="semvig"[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(semvig).toMatch(/<dt[^>]*>Vigência<\/dt><dd[^>]*><span class="italic text-mineral">não informada<\/span>/);
  });

  it("fonte primária: link externo seguro com aviso de nova aba; sem fonte ou link inseguro, o aviso de conferência", () => {
    expect(m).toMatch(/<a href="https:\/\/www2\.aneel\.gov\.br\/cedoc\/ren20211000\.html" target="_blank" rel="noopener noreferrer"[^>]*>Fonte primária: ANEEL, biblioteca de atos<span class="sr-only"> \(abre em nova aba\)<\/span><\/a>/);
    expect(m).not.toContain("javascript:");
    const retro = m.match(/data-id="retro"[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(retro).toContain('data-fonte="ausente"');
    expect(retro).toContain("vigência retroativa: 15 dias antes da publicação");
  });

  it("filtro controlado por props: categoria aplicada, resumo e contagem anunciados, limpar disponível", () => {
    const f = html({ filtro: { categorias: ["tarifa"], inicio: null, fim: null, base: "publicacao" } });
    expect(itens(f)).toEqual(["semvig", "retro"]);
    expect(f).toContain("Mostrando 2 de 5 eventos; categoria: Tarifa.");
    expect(f).toMatch(/aria-live="polite"/);
    expect(f).toMatch(/aria-disabled="false"[^>]*>Limpar filtros/);
    expect(m).toMatch(/aria-disabled="true"[^>]*>Limpar filtros/);
  });

  it("período por vigência diz quantos eventos ficaram fora por não ter a data", () => {
    const f = html({ filtroInicial: { base: "vigencia", inicio: "2024-01-01", fim: "2024-12-31" } });
    expect(itens(f)).toEqual(["retro", "sempub", "pld2024"]);
    expect(f).toContain("1 evento sem data de vigência fica fora do recorte por período.");
    expect(f).toMatch(/<input type="radio"(?=[^>]*checked="")(?=[^>]*value="vigencia")[^>]*\/>/);
    expect(f).toMatch(/<input type="date"[^>]*value="2024-01-01"/);
  });

  it("filtro que esvazia a lista diz isso em vez de uma lista vazia", () => {
    const f = html({ filtro: { categorias: [], inicio: null, fim: null, base: "publicacao" } });
    expect(f).not.toContain("<ol");
    expect(f).toContain("Nenhum evento no filtro atual.");
  });
});
