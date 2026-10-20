/**
 * Contratos do painel Conectividade (Energia e Infraestrutura, dados abertos da Anatel por município): registro e
 * navegação, princípio do aperitivo, gold fechada ao navegador, números da versão aberta iguais aos da gold, convite,
 * painel completo desenhado no servidor, arquivos CSV, camada aberta e frescor.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AperitivoPage from "@/app/aperitivo/conectividade/page";
import PainelPage from "@/app/conectividade/page";
import { csvBrasilMensal, csvPorEstado, csvPorMunicipio } from "@/lib/conectividade/csv";
import { comConta } from "@/lib/conectividade/convite";
import { arquivoUf, cobertos, consultarMunicipio, faixaNaDistribuicao, goldConectividade, UF_DO_PREFIXO } from "@/lib/conectividade/dados";
import { mesAcessos, mesExtenso, milhoes, num, pct } from "@/lib/conectividade/formato";
import { hrefMunicipio, nomeGrupo, PERGUNTA_APERITIVO, PERGUNTA_PAINEL, ROTA_CONECTIVIDADE, SECAO_APERITIVO, SECAO_PAINEL, VERSAO_ABERTA } from "@/lib/conectividade/paginas";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { donoDaRota, paineis } from "@/lib/observatorios/registro";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { CONSULTAS, portas } from "@/lib/perguntas/portas";
import { APERITIVOS, desvioDoAperitivo, ehRotaPublica } from "@/lib/rotasPublicas";
import { SECTION_LABELS, VIEW_SECTIONS } from "@/lib/telemetry";
import limiares from "@/lib/frescor/limiares.json";
import { extrairFrescor, situacaoDominio } from "@/lib/frescor/regras";

// as páginas usam componentes de cliente que leem o roteador (barra comum, busca): fora do Next, o caminho é fixo
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/conectividade",
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const raiz = process.cwd();
const g = goldConectividade();
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const municipioComTudo = () => arquivoUf("SP")!.municipios.find((m) => m.fixa && m.movel && m.cobertura && m.cobertura.operadoras.CLARO)!;

describe("registro, navegação e acesso", () => {
  it("o painel é da coleção Conectividade do Observatório de Energia e Infraestrutura, mantido por ele", () => {
    const p = paineis().find((x) => x.rota === ROTA_CONECTIVIDADE)!;
    expect(p).toBeDefined();
    expect(p.observatorio).toBe("energia-e-infraestrutura");
    expect(p.colecao).toBe("conectividade");
    expect(p.origem).toBeNull();
    expect(p.duplicataDe).toBeUndefined();
    expect(donoDaRota(ROTA_CONECTIVIDADE)?.observatorio).toBe("energia-e-infraestrutura");
    expect(donoDaRota(`${ROTA_CONECTIVIDADE}/por-estado.csv`)?.rota).toBe(ROTA_CONECTIVIDADE);
    expect(colecoesDe("energia-e-infraestrutura").find((c) => c.id === "conectividade")!.href).toBe(ROTA_CONECTIVIDADE);
    expect(OBSERVATORIOS.find((o) => o.id === "energia-e-infraestrutura")!.colecoes.find((c) => c.id === "conectividade")!.href).toBe(ROTA_CONECTIVIDADE);
  });

  it("princípio do aperitivo: o endereço público serve o aperitivo sem sessão e o painel com sessão; gold e CSV ficam fechados", () => {
    const a = APERITIVOS.find((x) => x.rota === ROTA_CONECTIVIDADE)!;
    expect(a).toEqual({ tema: "Conectividade", rota: ROTA_CONECTIVIDADE, versaoAberta: VERSAO_ABERTA, painelCompleto: ROTA_CONECTIVIDADE });
    expect(ehRotaPublica(ROTA_CONECTIVIDADE)).toBe(true);
    expect(desvioDoAperitivo(ROTA_CONECTIVIDADE)).toEqual({ tipo: "aperitivo", destino: VERSAO_ABERTA });
    expect(desvioDoAperitivo(VERSAO_ABERTA)).toEqual({ tipo: "interno" });
    for (const r of ["/conectividade/gold/conectividade.json", "/conectividade/gold/municipios/SP.json", "/conectividade/por-municipio.csv", "/conectividade/por-estado.csv", "/conectividade/brasil-mensal.csv", VERSAO_ABERTA]) {
      expect(ehRotaPublica(r), r).toBe(false);
    }
    expect(existsSync(join(raiz, "src/app", VERSAO_ABERTA, "page.tsx"))).toBe(true);
  });

  it("telemetria, frescor, sitemap e tracing conhecem o painel", () => {
    expect(VIEW_SECTIONS).toContain(SECAO_PAINEL);
    expect(VIEW_SECTIONS).toContain(SECAO_APERITIVO);
    expect(SECTION_LABELS[SECAO_PAINEL]).toContain("Conectividade");
    expect(limiares.dominios.conectividade.publicacao.map((o) => o.campo)).toEqual(["fontes.fixa.capturado_em", "fontes.movel.capturado_em"]);
    // uma base mensal retida enquanto a outra segue: a data publicada é a mais antiga, e a cobertura só conta como parte
    const ler = () => ({ capturado_em: "2026-10-20T17:30:39Z", fontes: { fixa: { capturado_em: "2026-07-12T12:00:00Z" }, movel: { capturado_em: "2026-10-20T17:30:39Z" }, cobertura: { capturado_em: "2026-10-20T17:30:39Z" } } });
    const f = extrairFrescor("conectividade", ler);
    expect(f.publicadoEm).toBe("2026-07-12T12:00:00Z");
    expect(f.parteMaisRecente).toBe("2026-10-20T17:30:39Z");
    expect(situacaoDominio(f, new Date("2026-10-21T00:00:00Z")).estado).toBe("retida");
    expect(readFileSync(join(raiz, "src/app/sitemap.ts"), "utf-8")).toContain(`rota("${ROTA_CONECTIVIDADE}"`);
    const cfg = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    expect(cfg).toContain('"/conectividade": ["./public/conectividade/gold/**/*.json"]');
    expect(cfg).toContain('"/aperitivo/conectividade": ["./public/conectividade/gold/**/*.json"]');
    expect(cfg).toContain('source: "/conectividade/gold/:path*"');
  });

  it("a camada aberta lista a consulta na porta de Energia e Infraestrutura", () => {
    expect(CONSULTAS.internet.href).toBe(ROTA_CONECTIVIDADE);
    expect(CONSULTAS.internet.pergunta).toBe(PERGUNTA_APERITIVO);
    const p = portas().find((x) => x.id === "energia-e-infraestrutura")!;
    expect(p.paraOSeuCaso.map((c) => c.href)).toContain(ROTA_CONECTIVIDADE);
  });
});

describe("gold publicada", () => {
  it("cobre todos os municípios uma vez, com UF pelo prefixo IBGE, e as somas fecham", () => {
    const ids: string[] = [];
    for (const uf of Object.values(UF_DO_PREFIXO).sort()) {
      const arq = arquivoUf(uf)!;
      expect(arq.uf).toBe(uf);
      for (const m of arq.municipios) {
        expect(UF_DO_PREFIXO[m.id.slice(0, 2)]).toBe(uf);
        ids.push(m.id);
        if (m.fixa) {
          const partes = (m.fixa.fibra_pct ?? 0) + (m.fixa.coaxial_pct ?? 0) + (m.fixa.radio_pct ?? 0) + (m.fixa.satelite_pct ?? 0) + (m.fixa.metalico_pct ?? 0);
          expect(Math.abs(partes - 100)).toBeLessThan(0.6);
        }
        for (const t of Object.values(m.cobertura?.tecnologias ?? {})) for (const v of t ?? []) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(g.destaques.municipios);
    expect(g.ufs.reduce((t, u) => t + (u.fixa?.acessos ?? 0), 0)).toBe(g.brasil.fixa.acessos);
    expect(g.ufs.reduce((t, u) => t + u.municipios, 0)).toBe(g.destaques.municipios);
    expect(g.brasil.movel.acessos).toBeLessThan(g.brasil.movel.linhas);
  });

  it("ausência é null com motivo, nunca zero; o hash e as fontes identificam o original", () => {
    for (const cod of g.destaques.sem_dado.cobertura) {
      const c = consultarMunicipio(cod);
      expect(c.estado).toBe("ok");
      if (c.estado === "ok") {
        expect(c.m.cobertura).toBeNull();
        expect(c.m.ausencias).toContain("cobertura");
      }
    }
    expect(g.hash_dados).toMatch(/^[0-9a-f]{64}$/);
    for (const f of Object.values(g.fontes)) {
      expect(f.url).toMatch(/^https:\/\/www\.anatel\.gov\.br\/dadosabertos\//);
      expect(f.membros.length).toBeGreaterThan(0);
      for (const m of f.membros) expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(g.notas.densidade).toContain("100 habitantes");
  });

  it("a consulta por código só aceita município da gold", () => {
    expect(consultarMunicipio(undefined)).toEqual({ estado: "vazia" });
    expect(consultarMunicipio("abc")).toEqual({ estado: "invalida", codigo: null });
    expect(consultarMunicipio("9999999")).toEqual({ estado: "invalida", codigo: "9999999" });
    expect(consultarMunicipio("3550308").estado).toBe("ok");
    expect(faixaNaDistribuicao(100, g.distribuicao.fixa_fibra_pct)).toContain("10% de municípios mais altos");
    expect(faixaNaDistribuicao(null, g.distribuicao.fixa_fibra_pct)).toBeNull();
  });
});

describe("versão aperitivo: só o município, com os números da gold", () => {
  it("sem município: o Brasil, a busca e o convite; sem tabela, gráfico ou CSV", () => {
    const html = renderToStaticMarkup(createElement(AperitivoPage, { searchParams: {} }));
    const t = texto(html);
    expect(html).toContain('data-aperitivo="conectividade"');
    expect(t).toContain(PERGUNTA_APERITIVO);
    expect(t).toContain(`${num(g.brasil.fixa.densidade, 1)} para cada 100 habitantes`);
    expect(t).toContain(`${pct(g.brasil.fixa.fibra_pct)} deles por fibra óptica`);
    expect(t).toContain(`${pct(g.brasil.cobertura.tecnologias.g5![0])} dos moradores`);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("cn-svg");
    expect(html).not.toContain(".csv");
    expect(html).toContain("data-convite-aperitivo");
    expect(html).toContain(`href="/entrar?de=${encodeURIComponent(ROTA_CONECTIVIDADE)}"`);
  });

  it("com município: três números do município, com fonte e data, e a volta do login leva o município", () => {
    const m = municipioComTudo();
    const html = renderToStaticMarkup(createElement(AperitivoPage, { searchParams: { ibge: m.id } }));
    const t = texto(html);
    expect(html).toContain("data-resultado-aperitivo");
    expect(t).toContain(m.nome);
    expect(t).toContain(num(m.fixa!.densidade, 1));
    expect(t).toContain(pct(m.fixa!.fibra_pct));
    expect(t).toContain(pct(cobertos(m, "g5")));
    expect(t).toContain(pct(cobertos(m, "g4")));
    expect(t).toContain(mesExtenso(g.referencia.fixa));
    expect(t).toContain("Dados capturados em");
    expect(html).toContain(`href="/entrar?de=${encodeURIComponent(hrefMunicipio(m.id))}"`);
    // o que fica com a conta não aparece: operadoras, série, posição e arquivos
    expect(t).not.toContain("no estado");
    expect(t).not.toContain("Claro");
    expect(html).not.toContain("<table");
  });

  it("código inválido explica e não chuta; o convite é dimensionado pela gold", () => {
    const t = texto(renderToStaticMarkup(createElement(AperitivoPage, { searchParams: { ibge: "1234567" } })));
    expect(t).toContain("Nenhum município da base da Anatel tem o código IBGE 1234567");
    const itens = comConta(g, "SP", municipioComTudo());
    expect(itens.length).toBeGreaterThanOrEqual(6);
    expect(itens.join(" ")).toContain(`${num(g.destaques.sem_fibra)} municípios sem acesso por fibra`);
    expect(itens.join(" ")).toContain(`${num(g.ufs.find((u) => u.uf === "SP")!.municipios)} do estado`);
    expect(itens.join(" ")).toContain(mesExtenso(g.trimestres_cobertura[0]));
  });
});

describe("painel completo", () => {
  it("abre com a pergunta, quatro números com fonte e período, e as seções por pergunta", () => {
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: {} }));
    const t = texto(html);
    expect(html).toContain('data-painel="conectividade"');
    expect(t).toContain(PERGUNTA_PAINEL);
    expect(html.match(/class="cn-numeros"/g)).toHaveLength(1);
    expect(t).toContain(`${num(g.brasil.fixa.densidade, 1)}`);
    expect(t).toContain(`${num(g.destaques.sem_5g)}`);
    for (const id of ["municipio", "fibra", "cobertura", "evolucao", "estados", "mecanismo", "metodo"]) expect(html).toContain(`id="${id}"`);
    expect(t).toContain("Modelo didático");
    for (const arq of ["por-municipio.csv", "por-estado.csv", "brasil-mensal.csv"]) expect(html).toContain(`href="${ROTA_CONECTIVIDADE}/${arq}"`);
    // o gráfico tem texto alternativo com o primeiro e o último valor; a tabela dos estados tem as 27 UFs e o Brasil
    expect(html).toContain('role="img" aria-label="Acessos de banda larga fixa no Brasil');
    expect((html.match(/<tr class="cn-forte">/g) ?? []).length).toBeGreaterThanOrEqual(1);
    for (const u of g.ufs) expect(t).toContain(u.nome);
  });

  it("com município: o retrato com posição, operadoras, série trimestral e o estado marcado na tabela", () => {
    const m = municipioComTudo();
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: m.id } }));
    const t = texto(html);
    expect(html).toContain("data-resultado-municipio");
    expect(t).toContain(`${num(m.posicao.fixa_densidade.uf)}ª de ${num(g.ufs.find((u) => u.uf === "SP")!.municipios)} no estado`);
    expect(t).toContain(pct(m.cobertura!.operadoras.CLARO.g4g5_moradores));
    expect(html).toContain(`aria-label="Parte dos moradores de ${m.nome} dentro da cobertura 4G e 5G por trimestre`);
    expect(html).toContain('<tr class=" cn-escolhido">');
    expect(t).not.toMatch(/\bNaN\b|undefined|null\b/);
  });

  it("nunca escreve NaN, undefined ou zero no lugar de ausência", () => {
    const sem = g.destaques.sem_dado.cobertura[0];
    if (!sem) return;
    const t = texto(renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: sem } })));
    expect(t).toContain("A Anatel não publica a cobertura deste município");
    expect(t).not.toMatch(/\bNaN\b|undefined/);
  });
});

describe("arquivos CSV", () => {
  it("por município: todos os municípios, ausência como campo vazio, partes de fibra como na gold", () => {
    const linhas = csvPorMunicipio().replace(/^﻿/, "").trimEnd().split("\n");
    expect(linhas.length).toBe(g.destaques.municipios + 1);
    const cab = linhas[0].split(";");
    expect(cab.slice(0, 3)).toEqual(["codigo_ibge", "municipio", "uf"]);
    const sp = linhas.find((l) => l.startsWith("3550308;"))!.split(";");
    const m = consultarMunicipio("3550308");
    if (m.estado === "ok") {
      expect(sp[cab.indexOf("fixa_fibra_pct")]).toBe(String(m.m.fixa!.fibra_pct));
      expect(sp[cab.indexOf("cobertura_5g_moradores_pct")]).toBe(String(cobertos(m.m, "g5")));
    }
    for (const sem of g.destaques.sem_dado.cobertura) {
      const l = linhas.find((x) => x.startsWith(`${sem};`))!.split(";");
      expect(l[cab.indexOf("cobertura_5g_moradores_pct")]).toBe("");
    }
    expect(csvPorMunicipio()).not.toMatch(/\bnull\b|NaN/);
  });

  it("por estado: 27 UFs e o Brasil; Brasil mensal: as duas séries da Anatel", () => {
    const est = csvPorEstado().replace(/^﻿/, "").trimEnd().split("\n");
    expect(est.length).toBe(29);
    expect(est[est.length - 1].startsWith("BR;Brasil;")).toBe(true);
    const br = csvBrasilMensal().replace(/^﻿/, "").trimEnd().split("\n");
    expect(br[0]).toBe("mes;banda_larga_fixa_acessos;telefonia_movel_acessos");
    const ultimo = br[br.length - 1].split(";");
    expect(ultimo[0]).toBe(g.brasil.fixa.acessos_mensal.meses.at(-1));
    expect(Number(ultimo[1])).toBe(g.brasil.fixa.acessos_mensal.acessos.at(-1));
  });
});

describe("Conectividade: achados do Codex no #309", () => {
  it("mês próprio de cada base: um só quando coincidem, os dois quando divergem", () => {
    expect(mesAcessos({ fixa: "2026-08", movel: "2026-08" })).toBe("acessos e linhas de agosto de 2026");
    expect(mesAcessos({ fixa: "2026-08", movel: "2026-07" }, true)).toBe("Acessos fixos de agosto de 2026 e linhas móveis de julho de 2026");
  });

  it("as partes em % das linhas móveis aparecem ao lado do total de linhas ativas, não do total sem M2M", () => {
    const g = goldConectividade();
    const m = g.brasil.movel;
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: {} }));
    expect(html).toContain(`${milhoes(m.linhas)} de linhas ativas, ${pct(m.g5_pct)} já em 5G`);
    expect(html).not.toContain(`${milhoes(m.acessos)} de linhas, ${pct(m.g5_pct)}`);
  });

  it("OUTROS não vira a maior prestadora: a soma dos provedores regionais aparece como soma", () => {
    const a = arquivoUf("AC")!;
    const m = a.municipios.find((x) => x.fixa && x.fixa.maior_grupo === "OUTROS")!;
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: m.id } }));
    expect(html).toContain(`Provedores regionais e locais, somados, têm ${pct(m.fixa!.maior_grupo_pct)} dos acessos`);
    expect(html).not.toContain("A maior, Provedores regionais e locais");
    const g = goldConectividade();
    expect(g.brasil.fixa.maior_grupo).toBe("OUTROS");
    expect(html).not.toContain("a maior delas, Provedores regionais e locais");
  });

  it("o aperitivo não revela a maior prestadora nem a parte dela", () => {
    const a = arquivoUf("SP")!;
    const m = a.municipios.find((x) => x.fixa && x.fixa.maior_grupo)!;
    const html = renderToStaticMarkup(createElement(AperitivoPage, { searchParams: { ibge: m.id } }));
    expect(html).not.toContain(nomeGrupo(m.fixa!.maior_grupo));
    expect(html).not.toContain(pct(m.fixa!.maior_grupo_pct));
    expect(html).toContain(`${num(m.fixa!.prestadoras)} empresas vendem banda larga fixa`);
  });
});
