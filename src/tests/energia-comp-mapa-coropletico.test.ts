import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NAO_SE_APLICA, quebrasFixas } from "@/lib/energia/escalas";
import {
  agruparPorChave,
  aplicarZoom,
  areaAssinada,
  caixaDoCaminho,
  caixaDoZoom,
  lerCaminho,
  lerViewBox,
  limitarZoom,
  paraTela,
  pontoNaRegiao,
  pontoRotulo,
  validaCamada,
  type CamadaGeo,
  type Caixa,
  type FeatureGeo,
} from "@/lib/energia/geo";
import {
  buscarRegioes,
  coresParaClasses,
  descreveRegiao,
  estadoRegiao,
  moverNaLista,
  preenchimento,
  resumoMapa,
  validaCores,
} from "@/lib/energia/mapa-coropletico";
import { MapaCoropletico, type MapaCoropleticoProps } from "@/components/energia/MapaCoropletico";

/**
 * Mapa coroplético e geometria publicada: leitura do caminho compacto, ponto de
 * rótulo que cai dentro da região (mesmo em forma de U e com buraco), zoom que
 * não sai da malha, agrupamento sem geometria inventada, os três estados
 * (zero tem classe, sem dado é hachura, não se aplica é cinza), busca sem
 * acento, e o contrato dos arquivos gerados pelo pipeline a partir do IBGE.
 */

const quadrado = (x: number, y: number, l = 10) => `M${x} ${y}l${l} 0 0 ${l}-${l} 0z`;

describe("leitura do caminho", () => {
  it("formato publicado: M absoluto, l relativo com sinal como separador, z", () => {
    expect(lerCaminho("M10 10l-3 2 0-8 8-1zM100 100l1 0 0-1z")).toEqual([
      [
        [10, 10],
        [7, 12],
        [7, 4],
        [15, 3],
      ],
      [
        [100, 100],
        [101, 100],
        [101, 99],
      ],
    ]);
  });

  it("m relativo depois de z parte do início do subcaminho anterior; H e V", () => {
    expect(lerCaminho("M10 10H20V20Zm5 5h1v1z")).toEqual([
      [
        [10, 10],
        [20, 10],
        [20, 20],
      ],
      [
        [15, 15],
        [16, 15],
        [16, 16],
      ],
    ]);
  });

  it("curva não é aceita (a malha só tem retas)", () => {
    expect(() => lerCaminho("M0 0C1 1 2 2 3 3z")).toThrow(/não suportado/);
  });

  it("caixa e área com sinal (horário na tela é positivo)", () => {
    expect(caixaDoCaminho(quadrado(5, 7, 4))).toEqual({ x: 5, y: 7, largura: 4, altura: 4 });
    const [anel] = lerCaminho(quadrado(0, 0, 10));
    expect(areaAssinada(anel)).toBe(100);
    expect(areaAssinada([...anel].reverse())).toBe(-100);
  });
});

describe("ponto de rótulo", () => {
  it("quadrado: o centro", () => {
    expect(pontoRotulo(quadrado(0, 0, 10))).toEqual([5, 5]);
  });

  it("forma em U: o centroide cai fora, o ponto de rótulo fica dentro", () => {
    // U de 30 × 30 com vão de 10 × 20 no meio, aberto para cima
    const u = "M0 0L10 0 10 20 20 20 20 0 30 0 30 30 0 30Z";
    const aneis = lerCaminho(u);
    const p = pontoRotulo(u)!;
    expect(pontoNaRegiao([15, 12], aneis)).toBe(false);
    expect(pontoNaRegiao(p, aneis)).toBe(true);
  });

  it("anel com buraco no meio: o ponto não cai no buraco", () => {
    const rosca = `M0 0L40 0 40 40 0 40ZM10 10L10 30 30 30 30 10Z`;
    const aneis = lerCaminho(rosca);
    const p = pontoRotulo(rosca)!;
    expect(pontoNaRegiao([20, 20], aneis)).toBe(false);
    expect(pontoNaRegiao(p, aneis)).toBe(true);
  });

  it("caminho vazio não tem ponto", () => {
    expect(pontoRotulo("")).toBeNull();
  });
});

describe("zoom e enquadramento", () => {
  const base: Caixa = { x: 0, y: 0, largura: 400, altura: 200 };

  it("escala entre 1 e o máximo; a janela nunca sai da malha", () => {
    expect(limitarZoom(base, { escala: 0.2, centro: [999, 999] }, 8)).toEqual({ escala: 1, centro: [200, 100] });
    const z = limitarZoom(base, { escala: 4, centro: [0, 0] }, 8);
    expect(z).toEqual({ escala: 4, centro: [50, 25] });
    expect(caixaDoZoom(base, z)).toEqual({ x: 0, y: 0, largura: 100, altura: 50 });
    expect(limitarZoom(base, { escala: 64, centro: [200, 100] }, 8).escala).toBe(8);
  });

  it("aproximar em torno do alvo (a seleção) e afastar de volta", () => {
    const z1 = aplicarZoom(base, { escala: 1, centro: [200, 100] }, 2, 8, [300, 60]);
    expect(z1).toEqual({ escala: 2, centro: [300, 60] });
    expect(aplicarZoom(base, z1, 0.5, 8).escala).toBe(1);
  });

  it("ponto da malha para pixel com ajuste 'meet' e faixas vazias nas laterais", () => {
    // janela 400 × 200 num quadro de 800 × 800: escala 2, 200 px vazios em cima e embaixo
    expect(paraTela([0, 0], base, 800, 800)).toEqual([0, 200]);
    expect(paraTela([400, 200], base, 800, 800)).toEqual([800, 600]);
  });
});

describe("agrupamento por chave", () => {
  const fs: FeatureGeo[] = [
    { id: "3100104", nome: "Abadia dos Dourados", uf: "MG", d: quadrado(0, 0) },
    { id: "3300100", nome: "Angra dos Reis", uf: "RJ", d: quadrado(10, 0) },
    { id: "3100203", nome: "Abaeté", uf: "MG", d: quadrado(20, 0) },
    { id: "3500105", nome: "Adamantina", uf: "SP", d: quadrado(30, 0) },
  ];

  it("grupo é o conjunto dos membros: caminho concatenado, sem geometria nova", () => {
    const g = agruparPorChave(fs, (f) => (f.uf === "SP" ? null : f.id.startsWith("33") ? "Área Leste" : "Área Oeste"), (k) => `Concessão ${k}`);
    expect(g.map((x) => x.id)).toEqual(["Área Leste", "Área Oeste"]);
    const oeste = g[1];
    expect(oeste.nome).toBe("Concessão Área Oeste");
    expect(oeste.membros).toEqual(["3100104", "3100203"]);
    expect(oeste.d).toBe(quadrado(0, 0) + quadrado(20, 0));
    expect(lerCaminho(oeste.d)).toHaveLength(2);
    // chave nula fica fora: nenhum membro some para dentro de outro grupo
    expect(g.flatMap((x) => x.membros)).not.toContain("3500105");
  });

  it("grupo que cruza UFs guarda as siglas", () => {
    const [g] = agruparPorChave(fs, () => "tudo");
    expect(g.uf).toBe("MG/RJ/SP");
  });
});

describe("paleta e estados", () => {
  const c = quebrasFixas([10, 20], [0, 5, 15, 25]);
  const fundos = { classes: ["var(--c0)", "var(--c1)", "var(--c2)"], semDado: "url(#h)", naoSeAplica: "var(--cor-linha)" };

  it("zero é valor e recebe a cor da classe; ausência é hachura; não se aplica é cinza liso", () => {
    expect(preenchimento(0, c, fundos)).toBe("var(--c0)");
    expect(preenchimento(null, c, fundos)).toBe("url(#h)");
    expect(preenchimento(undefined, c, fundos)).toBe("url(#h)");
    expect(preenchimento(Number.NaN, c, fundos)).toBe("url(#h)");
    expect(preenchimento(NAO_SE_APLICA, c, fundos)).toBe("var(--cor-linha)");
    expect(preenchimento(20, c, fundos)).toBe("var(--c2)");
    expect(estadoRegiao(0)).toBe("valor");
  });

  it("descrição: sem dado e não se aplica nunca levam classe", () => {
    expect(descreveRegiao(0, c, 1, "%")).toMatchObject({ estado: "valor", valor: "0,0%", classe: "menos de 10,0", indice: 0 });
    expect(descreveRegiao(null, c, 1, "%")).toEqual({ estado: "sem-dado", valor: "sem dado", classe: null, indice: null });
    expect(descreveRegiao(NAO_SE_APLICA, c, 1, "%")).toEqual({ estado: "nao-se-aplica", valor: "não se aplica", classe: null, indice: null });
    // sinal de menos tipográfico e espaço não separável antes da unidade
    expect(descreveRegiao(-2.5, c, 1, "p.p.").valor).toBe("\u22122,5\u00a0p.p.");
  });

  it("menos classes que cores: espalha pela paleta, das pontas para dentro", () => {
    const p = ["var(--a)", "var(--b)", "var(--c)", "var(--d)", "var(--e)"];
    expect(coresParaClasses(p, 3)).toEqual(["var(--a)", "var(--c)", "var(--e)"]);
    expect(coresParaClasses(p, 2)).toEqual(["var(--a)", "var(--e)"]);
    expect(coresParaClasses(p, 5)).toEqual(p);
    expect(coresParaClasses(p, 1)).toEqual(["var(--c)"]);
  });

  it("cor fora dos tokens e classes demais são recusadas", () => {
    const hex = "#" + "0e6170"; // montado em tempo de execução: o arquivo não tem hexadecimal literal
    expect(validaCores(["var(--a)", hex], 2).join(" ")).toMatch(/tokens/);
    expect(validaCores(["var(--a)", "var(--b)"], 3).join(" ")).toMatch(/3 classes e só 2 cores/);
    expect(validaCores(["var(--a)", "color-mix(in srgb, var(--cor-energia) 40%, transparent)"], 2)).toEqual([]);
  });

  it("resumo: zeros contados, ausência explícita não conta como valor fora da malha", () => {
    const r = resumoMapa(["a", "b", "c", "d"], { a: 0, b: null, c: NAO_SE_APLICA, d: 7, x: 3, y: undefined });
    expect(r).toMatchObject({ regioes: 4, comValor: 2, semDado: 1, naoSeAplica: 1, zeros: 1, minimo: 0, maximo: 7, foraDaMalha: ["x"] });
  });
});

describe("busca e teclado", () => {
  const itens = [
    { id: "4316907", nome: "Santa Maria", uf: "RS" },
    { id: "2411403", nome: "Santa Maria", uf: "RN" },
    { id: "3550308", nome: "São Paulo", uf: "SP" },
    { id: "3509502", nome: "Campinas", uf: "SP" },
    { id: "5208707", nome: "Goiânia", uf: "GO" },
    { id: "3170206", nome: "Uberlândia", uf: "MG" },
  ];

  it("sem acento e sem caixa; termo de UF filtra; código também acha", () => {
    expect(buscarRegioes(itens, "sao paulo").itens.map((i) => i.id)).toEqual(["3550308"]);
    expect(buscarRegioes(itens, "GOIANIA").itens[0].id).toBe("5208707");
    expect(buscarRegioes(itens, "santa maria rs").itens.map((i) => i.id)).toEqual(["4316907"]);
    expect(buscarRegioes(itens, "3509").itens.map((i) => i.id)).toEqual(["3509502"]);
    expect(buscarRegioes(itens, "lândia").itens.map((i) => i.id)).toEqual(["3170206"]);
  });

  it("nome que começa pela consulta vem antes do que só a contém; limite com total", () => {
    const r = buscarRegioes([...itens, { id: "1", nome: "Nova Campinas", uf: "XX" }], "campinas");
    expect(r.itens.map((i) => i.nome)).toEqual(["Campinas", "Nova Campinas"]);
    const todos = buscarRegioes(itens, "", 2);
    expect(todos.total).toBe(6);
    expect(todos.itens.map((i) => i.nome)).toEqual(["Campinas", "Goiânia"]);
  });

  it("setas e páginas respeitam as pontas da lista", () => {
    expect(moverNaLista(-1, "ArrowDown", 5)).toBe(0);
    expect(moverNaLista(-1, "ArrowUp", 5)).toBe(4);
    expect(moverNaLista(4, "ArrowDown", 5)).toBe(4);
    expect(moverNaLista(0, "ArrowUp", 5)).toBe(0);
    expect(moverNaLista(1, "PageDown", 50)).toBe(11);
    expect(moverNaLista(3, "PageUp", 50)).toBe(0);
    expect(moverNaLista(2, "a", 5)).toBeNull();
    expect(moverNaLista(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("arquivos publicados (malha oficial do IBGE, gerada por pipeline/energia/geo.py)", () => {
  const le = (n: string) => {
    const p = join(process.cwd(), "public/energia/geo", n);
    return { camada: JSON.parse(readFileSync(p, "utf-8")) as CamadaGeo, bytes: statSync(p).size };
  };

  for (const [nome, n, limite] of [
    ["uf.json", 27, 150 * 1024],
    ["municipios.json", 5500, 2.5 * 1024 * 1024],
  ] as const) {
    it(`${nome}: proveniência, contagem, tamanho e todo caminho com área dentro do viewBox`, () => {
      const { camada, bytes } = le(nome);
      expect(validaCamada(camada)).toEqual([]);
      expect(bytes).toBeLessThan(limite);
      expect(camada.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(camada.url).toMatch(/^https:\/\/servicodados\.ibge\.gov\.br\/api\/v4\/malhas\//);
      expect(typeof camada.malha.revisao).toBe("number");
      expect(camada.projecao.paralelos_padrao).toEqual([-2, -22]);
      expect(camada.contagem.poligonos).toBe(camada.contagem.poligonos_origem);
      if (nome === "uf.json") expect(camada.features).toHaveLength(n);
      else expect(camada.features.length).toBeGreaterThan(n);
      const vb = lerViewBox(camada.viewBox)!;
      let aneis = 0;
      for (const f of camada.features) {
        const as = lerCaminho(f.d);
        expect(as.length, f.id).toBeGreaterThan(0);
        for (const a of as) {
          aneis++;
          // nenhum anel degenerado: três vértices ou mais e área diferente de zero
          expect(a.length, f.id).toBeGreaterThanOrEqual(3);
          expect(areaAssinada(a), f.id).not.toBe(0);
          for (const [x, y] of a) {
            expect(x >= vb.x && x <= vb.x + vb.largura && y >= vb.y && y <= vb.y + vb.altura, f.id).toBe(true);
          }
        }
      }
      expect(aneis).toBe(camada.contagem.aneis);
    });
  }

  it("municípios: código de 7 dígitos com a UF certa e divisas de UF pela união exata", () => {
    const { camada } = le("municipios.json");
    const uf = le("uf.json").camada;
    const siglas = new Map(uf.features.map((f) => [f.id, f.uf]));
    for (const f of camada.features) {
      expect(f.id).toMatch(/^\d{7}$/);
      expect(siglas.get(f.id.slice(0, 2)), f.id).toBe(f.uf);
    }
    expect(camada.contornos?.uf).toHaveLength(27);
    // o contorno de uma UF (união dos municípios) tem bem menos anéis que a soma dos municípios
    const sp = camada.contornos!.uf.find((c) => c.uf === "SP")!;
    expect(lerCaminho(sp.d).length).toBeLessThan(camada.features.filter((f) => f.uf === "SP").length / 10);
  });
});

/* ---------- renderização no servidor ---------- */

const GEO: CamadaGeo = {
  camada: "uf",
  titulo: "Teste",
  fonte: "IBGE",
  url: "https://servicodados.ibge.gov.br/api/v4/malhas/paises/BR",
  url_nomes: "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
  capturado_em: "2026-09-30T22:09:00Z",
  sha256: "a".repeat(64),
  sha256_nomes: "b".repeat(64),
  bronze: "data/x",
  malha: { revisao: 2025, nota_liberacao: "n", data_nota: "27/04/2026", documentacao: "d", qualidade: "intermediaria", formato_original: "TopoJSON" },
  projecao: {
    nome: "Albers cônica equivalente",
    paralelos_padrao: [-2, -22],
    meridiano_central: -54,
    latitude_origem: -12,
    superficie: "esfera",
    unidade_svg_m: 100,
    origem_m: [0, 0],
    eixo_y: "baixo",
  },
  simplificacao: { metodo: "dp", tolerancia_m: 1000, arcos_com_tolerancia_reduzida: 0, garantia: "g" },
  viewBox: "0 0 50 10",
  contagem: { features: 5, poligonos: 5, poligonos_origem: 5, aneis: 5 },
  conciliacao: { nomes_sem_geometria: [] },
  features: [
    { id: "11", nome: "Rondônia", uf: "RO", d: quadrado(0, 0) },
    { id: "12", nome: "Acre", uf: "AC", d: quadrado(10, 0) },
    { id: "13", nome: "Amazonas", uf: "AM", d: quadrado(20, 0) },
    { id: "14", nome: "Roraima", uf: "RR", d: quadrado(30, 0) },
    { id: "15", nome: "Pará", uf: "PA", d: quadrado(40, 0) },
  ],
};

const CORES = ["var(--serie-5)", "var(--serie-3)", "var(--serie-6)"];
const BASE: MapaCoropleticoProps = {
  titulo: "Perdas totais sobre a energia injetada",
  geometria: GEO,
  valores: { "11": 0, "12": null, "13": NAO_SE_APLICA, "14": 12.5, "15": 30, "99": 4 },
  cores: CORES,
  classificacao: quebrasFixas([10, 20], [0, 12.5, 30]),
  unidade: "%",
};
const html = (p: Partial<MapaCoropleticoProps> = {}) => renderToStaticMarkup(createElement(MapaCoropletico, { ...BASE, ...p }));
const fills = (h: string) => Object.fromEntries(Array.from(h.matchAll(/<path d="[^"]*" fill="([^"]*)" data-id="([^"]*)"/g), (m) => [m[2], m[1]]));

describe("MapaCoropletico no servidor", () => {
  it("um path por região, com a classe certa para zero e padrões próprios para ausência", () => {
    const h = html();
    const f = fills(h);
    expect(Object.keys(f)).toEqual(["11", "12", "13", "14", "15"]);
    expect(f["11"]).toBe(CORES[0]); // zero: classe normal
    expect(f["12"]).toMatch(/^url\(#.+-sem-dado\)$/); // sem dado: hachura
    expect(h).toMatch(/<pattern id="[^"]+-sem-dado"/);
    expect(f["13"]).toBe("var(--cor-linha)"); // não se aplica: cinza liso
    expect(f["14"]).toBe(CORES[1]);
    expect(f["15"]).toBe(CORES[2]);
    // nenhuma região sem valor recebe cor de classe
    expect(CORES).not.toContain(f["12"]);
    expect(CORES).not.toContain(f["13"]);
  });

  it("estrutura acessível: SVG nomeado sem paradas de Tab, combobox ligado à lista, região viva", () => {
    const h = html();
    expect(h).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby="([^"]+)"/);
    const idTitulo = h.match(/<svg[^>]*aria-labelledby="([^"]+)"/)![1];
    expect(h).toContain(`<title id="${idTitulo}">`);
    expect(h).not.toMatch(/<path[^>]*tabindex/i);
    const controla = h.match(/role="combobox"[^>]*aria-controls="([^"]+)"/)![1];
    expect(h).toMatch(new RegExp(`id="${controla}" role="listbox"`));
    expect(h).toMatch(/role="combobox"[^>]*aria-expanded="false"/);
    expect(h).toContain('aria-live="polite"');
    expect(h).toMatch(/role="group" aria-label="Zoom do mapa"/);
  });

  it("legenda com unidade, os três estados e a nota do zero", () => {
    const h = html();
    expect(h).toContain("Classes em %");
    expect(h).toContain('data-estado="sem-dado"');
    expect(h).toContain('data-estado="nao-se-aplica"');
    expect(h).toMatch(/Zero é valor, não ausência: 1 UF tem valor 0, na classe menos de 10,0/);
  });

  it("tabela equivalente com todas as regiões, sem dado e não se aplica escritos, e o valor fora da malha avisado", () => {
    const h = html();
    const tabela = h.slice(h.indexOf("<table"));
    for (const nome of ["Rondônia", "Acre", "Amazonas", "Roraima", "Pará"]) expect(tabela).toContain(nome);
    expect(tabela).toMatch(/data-estado="sem-dado"[\s\S]*?sem dado/);
    expect(tabela).toMatch(/data-estado="nao-se-aplica"[\s\S]*?não se aplica/);
    expect(tabela).toContain(">0,0<");
    expect(tabela).toMatch(/aria-sort="ascending"/);
    expect(h).toMatch(/data-fora-da-malha="1"/);
  });

  it("seleção controlada: contorno de destaque, painel e ação para limpar", () => {
    const h = html({ selecionado: "14" });
    expect(h).toContain('data-selecionado="14"');
    expect(h).toMatch(/Roraima<\/strong> \(RR\): <span class="tabular-nums">12,5%/);
    expect(h).toContain("Limpar seleção");
    expect(html({ selecionado: null })).toContain("Sem seleção");
  });

  it("geometria buscada no cliente: HTML do servidor já com altura fixa e estado de carregamento", () => {
    const h = html({ geometria: undefined, fonteGeometria: "/energia/geo/municipios.json", alturaCelular: 360, altura: 540 });
    expect(h).toContain('role="status"');
    expect(h).toContain("--mapa-h:360px");
    expect(h).toContain("--mapa-h-sm:540px");
    expect(h).not.toContain("<svg");
    // sem malha, a tabela lista os valores pelo código
    expect(h).toContain("Dados do mapa em tabela");
  });

  it("configuração inconsistente falha em vez de desenhar", () => {
    expect(() => html({ cores: ["var(--a)", "#" + "0e6170", "var(--b)"] })).toThrow(/tokens/);
    expect(() => html({ geometria: undefined })).toThrow(/geometria ou fonteGeometria/);
  });
});
