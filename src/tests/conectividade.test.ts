/**
 * Contratos do painel Conectividade (Energia e Infraestrutura, dados abertos da Anatel por município): registro e
 * navegação, princípio do aperitivo, gold fechada ao navegador, números da versão aberta iguais aos da gold, convite,
 * painel completo desenhado no servidor, arquivos CSV, camada aberta e frescor.
 */
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AperitivoPage from "@/app/aperitivo/conectividade/page";
import PainelPage from "@/app/conectividade/page";
import { GraficoLinhas } from "@/components/conectividade/Graficos";
import { csvBrasilMensal, csvPorEstado, csvPorMunicipio } from "@/lib/conectividade/csv";
import { comConta } from "@/lib/conectividade/convite";
import { lerManifestoLogosConectividade, logosConectividade } from "@/lib/conectividade/logos";
import { arquivoUf, cobertos, consultarMunicipio, faixaNaDistribuicao, goldConectividade, linhaEstado, UF_DO_PREFIXO } from "@/lib/conectividade/dados";
import { dataCaptura, frequenciaSerie, mesAcessos, mesExtenso, milhoes, num, pct } from "@/lib/conectividade/formato";
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
    // o convite só promete o que o cartão mostra, e não promete líder única onde a fonte só traz a soma dos regionais
    expect(itens[1]).toContain("em acessos fixos por 100 habitantes e a faixa em que ele cai, entre os municípios do país, em fibra, a colocação estadual em cobertura 4G");
    // município publicado sem telefonia móvel nem cobertura: o convite diz a ausência em vez de prometer o que o painel não mostra
    const sem = arquivoUf("MT")!.municipios.find((x) => x.id === "5101837")!;
    expect(sem.movel).toBeNull();
    expect(sem.cobertura).toBeNull();
    const c = comConta(g, "MT", sem);
    expect(c[0]).toContain("este não tem telefonia móvel na base");
    expect(c[0]).toContain("ainda não tem cobertura publicada");
    expect(c[1]).not.toContain("cobertura 4G");
    expect(c[2]).toContain("nos municípios com cobertura publicada");
    // município sem a banda larga fixa (até três diferenças entre as bases passam na validação cruzada)
    const semFixa = { ...municipioComTudo(), fixa: null };
    const cf = comConta(g, "SP", semFixa);
    expect(cf[0]).toContain("não registra acessos de banda larga fixa nele");
    expect(cf[0]).not.toContain("velocidade contratada por faixa");
    expect(cf[1]).toContain("as posições em acessos fixos e em fibra ficam sem dado");
    expect(cf[1]).toContain("colocação estadual em cobertura 4G");
    // fixa sem densidade publicada: o convite não promete a posição em acessos fixos por 100 habitantes (26ª revisão do Codex)
    const semDens = { ...municipioComTudo(), fixa: { ...municipioComTudo().fixa!, densidade: null } };
    const cd = comConta(g, "SP", semDens);
    expect(cd[1]).toContain("não publica a densidade de acessos fixos deste município");
    expect(cd[1]).not.toContain("A posição do município entre os");
    expect(cd[1]).toContain("em fibra e a colocação estadual em cobertura 4G");
    // registro de cobertura sem o valor de 5G: o convite não promete a faixa nacional em 5G (25ª revisão do Codex)
    const base = municipioComTudo();
    const semG5 = { ...base, cobertura: { ...base.cobertura!, tecnologias: { ...base.cobertura!.tecnologias, g5: null } } };
    const c5 = comConta(g, "SP", semG5);
    expect(c5[1]).toContain("a colocação estadual em cobertura 4G");
    expect(c5[1]).not.toContain("faixa nacional em cobertura 5G");
    const semG4 = { ...base, cobertura: { ...base.cobertura!, tecnologias: { ...base.cobertura!.tecnologias, g4: null } } };
    expect(comConta(g, "SP", semG4)[1]).not.toContain("colocação estadual em cobertura 4G");
    expect(itens[1]).not.toMatch(/em fibra, velocidade, 5G e cobertura/);
    const outros = arquivoUf("AC")!.municipios.find((x) => x.fixa && x.fixa.maior_grupo === "OUTROS")!;
    expect(comConta(g, "AC", outros)[0]).toContain("provedores regionais e locais, que ali é a maior");
    expect(comConta(g, "AC", outros)[0]).not.toContain("a parte da maior delas");
    expect(comConta(g, null)[0]).toContain("se um grande grupo lidera");
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
    // o cartão dos municípios sem 5G usa o universo da cobertura publicada, não o das três fontes (12ª revisão do Codex)
    const d = g.destaques;
    expect(d.municipios_com_5g_publicado).toBeLessThanOrEqual(d.municipios - d.sem_dado.cobertura.length);
    expect(d.municipios_com_5g_publicado).toBe(g.ufs.reduce((t, u) => t + u.cobertura.municipios_com_5g_publicado, 0));
    expect(html).toContain(`<span class="cn-unidade">de ${num(d.municipios_com_5g_publicado)}</span>`);
    expect(html).not.toContain(`<span class="cn-unidade">de ${num(d.municipios)}</span>`);
    expect(t).toContain(`${num(d.sem_5g)} dos ${num(d.municipios_com_5g_publicado)} municípios com cobertura 5G publicada`);
    expect(t).toContain(`${num(d.g4_abaixo_50)} dos ${num(d.municipios_com_4g_publicado)} com cobertura 4G publicada`);
    // distribuição: o universo de cada linha é o seu próprio n (24ª revisão do Codex)
    expect(html).toContain(`<th scope="row">Moradores dentro da cobertura 5G</th><td>${num(g.distribuicao.cobertura_g5_moradores!.n)}</td>`);
    expect(html).toContain(`<th scope="row">Acessos fixos por 100 habitantes</th><td>${num(g.distribuicao.fixa_densidade!.n)}</td>`);
    expect(t).toContain("a coluna Municípios diz quantos entram em cada linha");
    // o título dos maiores do estado conta a lista: o DF tem um município só
    const hdf = texto(renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: "5300108" } })));
    expect(hdf).toContain("O único município do Distrito Federal com mais acessos fixos por 100 habitantes");
    expect(hdf).not.toContain("Os dez municípios do Distrito Federal");
    // 5G acima do 4G em trimestres antigos é contado e declarado, não escondido (22ª revisão do Codex)
    const acima = g.brasil.cobertura.g5_acima_do_4g;
    expect(acima.pares).toBeGreaterThan(0);
    expect(acima.trimestre_atual).toBe(0);
    expect(t).toContain(`${num(acima.pares)} pares município-trimestre em ${num(acima.municipios)} municípios`);
    const ar = consultarMunicipio("2301406");                        // Aratuba (CE): 5G acima do 4G em mar/2023 no seed real
    if (ar.estado !== "ok") throw new Error("Aratuba fora da gold");
    expect(ar.m.cobertura!.trimestres_5g_acima_do_4g).toContain("2023-03");
    const ht = texto(renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: "2301406" } })));
    expect(ht).toContain("a Anatel publicou o 5G acima do 4G neste município; o gráfico mostra os valores como publicados");
    expect(ht).toContain("Neste trimestre, em nenhum município a Anatel publica o 5G acima do 4G.");
    expect(ht).not.toContain("nunca alcança mais gente");
    // a série fixa antiga só tem os fins de trimestre: o texto não promete "mês a mês desde 2007" (19ª revisão do Codex)
    expect(frequenciaSerie(g.brasil.fixa.acessos_mensal.meses)).toBe("só os fins de trimestre de março de 2007 a dezembro de 2010 e mês a mês desde janeiro de 2011");
    expect(frequenciaSerie(g.brasil.movel.acessos_mensal.meses)).toBe("mês a mês desde fevereiro de 2005");
    expect(frequenciaSerie(["2024-01", "2024-02", "2024-03"])).toBe("mês a mês desde janeiro de 2024");
    expect(t).toContain("só os fins de trimestre de março de 2007 a dezembro de 2010 e mês a mês desde janeiro de 2011");
    expect(t).not.toContain("mês a mês desde março de 2007");
    // linha de estado sem uma fonte fica sem dado: o Brasil nunca entra no lugar de um estado (17ª revisão do Codex)
    const df = g.ufs.find((u) => u.uf === "DF")!;
    const semFixaUf = linhaEstado(g, { ...df, fixa: null, movel: null });
    expect(semFixaUf.fixa).toBeNull();
    expect(semFixaUf.movel).toBeNull();
    expect(linhaEstado(g, null).fixa).toBe(g.brasil.fixa);
    // universo dos agregados por fonte (20ª revisão do Codex): MT tem 142 municípios, 141 com móvel e com cobertura
    const mtFontes = g.ufs.find((u) => u.uf === "MT")!;
    expect(mtFontes.municipios_por_fonte).toEqual({ fixa: mtFontes.municipios, movel: mtFontes.municipios - 1, cobertura: mtFontes.municipios - 1 });
    expect(linhaEstado(g, mtFontes).universo).toBe(`fixa ${num(mtFontes.municipios)} · móvel ${num(mtFontes.municipios - 1)} · 4G ${num(mtFontes.municipios - 1)} · 5G ${num(mtFontes.municipios - 1)}`);
    // universo por geração: município com registro de cobertura mas sem o valor de 5G sai só do universo do 5G (21ª revisão do Codex)
    const semG5 = { ...mtFontes, cobertura: { ...mtFontes.cobertura, municipios_com_5g_publicado: mtFontes.cobertura.municipios_com_5g_publicado - 1 } };
    expect(linhaEstado(g, semG5).universo).toBe(`fixa ${num(mtFontes.municipios)} · móvel ${num(mtFontes.municipios - 1)} · 4G ${num(mtFontes.municipios - 1)} · 5G ${num(mtFontes.municipios - 2)}`);
    expect(linhaEstado(g, g.ufs.find((u) => u.uf === "SP")!).universo).toBe(num(g.ufs.find((u) => u.uf === "SP")!.municipios));
    // linha do Brasil: a cobertura é o número nacional da Anatel, não um agregado municipal (25ª revisão do Codex)
    expect(linhaEstado(g, null).universo).toBe(`fixa ${num(g.destaques.municipios_por_fonte.fixa)} · móvel ${num(g.destaques.municipios_por_fonte.movel)} · 4G e 5G: número nacional da Anatel`);
    expect(t).toContain("na linha do Brasil, a cobertura 4G e 5G é o número nacional publicado pela Anatel");
    expect(html).toContain(`<td>fixa ${num(mtFontes.municipios)} · móvel ${num(mtFontes.municipios - 1)} · 4G ${num(mtFontes.municipios - 1)} · 5G ${num(mtFontes.municipios - 1)}</td>`);
    expect(t).toContain("nos municípios que a Anatel publica (nesta edição, 1 sem telefonia móvel e 1 sem cobertura)");
    expect(t).not.toContain("Para cada um dos");
    expect(t).toContain("se duas das bases diferirem entre si em mais de três municípios (fixa e móvel, fixa e cobertura, móvel e cobertura");
    expect(t).not.toContain("se faltar município");
    // densidade móvel rotulada como acessos (o numerador exclui M2M e pontos de serviço) e a coluna de 5G por estado com o seu universo (16ª revisão do Codex)
    expect(t).not.toContain("Linhas móveis por 100");
    expect(t).toContain("Acessos móveis por 100 hab.");
    const mtUf = g.ufs.find((u) => u.uf === "MT")!;
    expect(html).toContain(`<td>${num(mtUf.cobertura.municipios_sem_5g)} de ${num(mtUf.cobertura.municipios_com_5g_publicado)}</td>`);
    expect(html).toContain(`<td>${num(g.destaques.sem_5g)} de ${num(g.destaques.municipios_com_5g_publicado)}</td>`);
    // a série histórica móvel é a de acessos (sem M2M e pontos de serviço), não a de linhas ativas
    expect(html).toContain('aria-label="Acessos de telefonia móvel no Brasil (sem máquinas e pontos de serviço)');
    const evolucao = html.slice(html.indexOf('id="evolucao"'), html.indexOf('id="estados"'));
    expect(evolucao).not.toContain("milhões de linhas");
    expect(evolucao).toContain("milhões de acessos");
    // o bloco didático nomeia os dois totais da móvel: linhas ativas (tudo) e acessos (sem M2M e pontos de serviço, base da densidade)
    expect(t).toContain("A Anatel publica dois totais: as linhas ativas");
    expect(t).not.toContain("só as primeiras entram no total");
    // o método não atribui o número nacional de cobertura ao cálculo local
    expect(t).toContain("O número do Brasil é o publicado pela Anatel");
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
    const sp = g.ufs.find((u) => u.uf === "SP")!;
    expect(t).toContain(`${num(m.posicao.fixa_densidade.uf)}ª de ${num(sp.ranqueados.fixa_densidade)} no estado`);
    // denominador de cada posição é o universo ranqueado da medida, não o total de municípios (15ª revisão do Codex)
    expect(t).toContain(`${num(m.posicao.cobertura_g4_moradores.uf)}ª de ${num(sp.ranqueados.cobertura_g4_moradores)} no estado`);
    const mt = g.ufs.find((u) => u.uf === "MT")!;
    expect(mt.ranqueados.cobertura_g4_moradores).toBe(mt.municipios - 1);                     // Boa Esperança do Norte não é ranqueado
    expect(g.destaques.ranqueados.cobertura_g5_moradores).toBe(g.distribuicao.cobertura_g5_moradores!.n);
    expect(t).toContain(pct(m.cobertura!.operadoras.CLARO.g4g5_moradores));
    expect(html).toContain(`aria-label="Parte dos moradores de ${m.nome} dentro da cobertura 4G e 5G por trimestre`);
    expect(html).toContain('<tr class=" cn-escolhido">');
    expect(t).not.toMatch(/\bNaN\b|undefined|null\b/);
  });

  it("nunca escreve NaN, undefined ou zero no lugar de ausência", () => {
    const sem = g.destaques.sem_dado.cobertura[0];
    if (!sem) return;
    const t = texto(renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: sem } })));
    expect(t).toContain("A Anatel não publica a cobertura deste município nesta edição; o motivo não vem na fonte.");
    expect(t).not.toContain("instalado depois do Censo");                       // a gold registra a ausência, não o motivo (19ª revisão do Codex)
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
    // cada contagem de cobertura sai ao lado do seu universo (municípios com o valor da tecnologia publicado), não do total de municípios
    const cab = est[0].split(";");
    expect(cab.slice(-4)).toEqual(["municipios_com_5g_publicado", "municipios_sem_5g", "municipios_com_4g_publicado", "municipios_4g_abaixo_de_50pct"]);
    const mt = est.find((l) => l.startsWith("MT;"))!.split(";");
    const ufMT = g.ufs.find((u) => u.uf === "MT")!;
    expect(mt[cab.indexOf("municipios")]).toBe(String(ufMT.municipios));
    expect(mt[cab.indexOf("municipios_com_movel")]).toBe(String(ufMT.municipios_por_fonte.movel));
    expect(mt[cab.indexOf("municipios_com_5g_publicado")]).toBe(String(ufMT.cobertura.municipios_com_5g_publicado));
    expect(ufMT.cobertura.municipios_com_5g_publicado).toBeLessThan(ufMT.municipios);        // Boa Esperança do Norte não tem cobertura
    const brasil = est[est.length - 1].split(";");
    expect(brasil[cab.indexOf("municipios_com_5g_publicado")]).toBe(String(g.destaques.municipios_com_5g_publicado));
    expect(brasil[cab.indexOf("municipios_sem_5g")]).toBe(String(g.destaques.sem_5g));
    const br = csvBrasilMensal().replace(/^﻿/, "").trimEnd().split("\n");
    expect(br[0]).toBe("mes;banda_larga_fixa_acessos;telefonia_movel_acessos");
    const ultimo = br[br.length - 1].split(";");
    expect(ultimo[0]).toBe(g.brasil.fixa.acessos_mensal.meses.at(-1));
    expect(Number(ultimo[1])).toBe(g.brasil.fixa.acessos_mensal.acessos.at(-1));
  });
});

describe("Conectividade: símbolos oficiais das operadoras (contrato de logos)", () => {
  const m = lerManifestoLogosConectividade()!;
  const g = goldConectividade();

  it("toda operadora da cobertura está no manifesto, com arquivo publicado íntegro ou ausência com motivo e vínculo declarado", () => {
    expect(m).toBeTruthy();
    for (const o of g.operadoras) {
      const l = m.logos.find((x) => x.operadora === o);
      expect(l, o).toBeTruthy();
      expect(l!.vinculo.length, o).toBeGreaterThan(20);
      if (l!.arquivo) {
        expect(l!.cnpj, o).toMatch(/^\d{14}$/);
        expect(l!.arquivo, o).toBe(`/conectividade/logos/${l!.cnpj}.${l!.formato}`);
        const caminho = join(raiz, "public", l!.arquivo.replace(/^\//, ""));
        expect(existsSync(caminho), o).toBe(true);
        const bytes = readFileSync(caminho);
        expect(bytes.length, o).toBe(l!.bytes);
        expect(createHash("sha256").update(bytes).digest("hex"), o).toBe(l!.sha256);
        expect(l!.url_origem, o).toMatch(/^https:\/\//);
        expect(l!.ausencia, o).toBeNull();
        if (l!.formato === "svg") {
          const svg = bytes.toString("utf-8");
          expect(svg, o).not.toMatch(/<script|\son\w+\s*=|<foreignObject|<!ENTITY|(xlink:)?href\s*=\s*["'](https?:|\/\/|data:)/i);
        }
      } else {
        expect(l!.ausencia?.motivo.length, o).toBeGreaterThan(20);
      }
    }
  });

  it("o painel marca o símbolo de quem o tem, mostra o nome de todas e declara no método quem ficou sem", () => {
    const logos = logosConectividade();
    const m3 = arquivoUf("SP")!.municipios.find((x) => x.cobertura && Object.keys(x.cobertura.operadoras).length >= 3)!;
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: { ibge: m3.id } }));
    for (const o of g.operadoras) {
      const l = logos.get(o)!;
      expect(html, o).toContain(nomeGrupo(o));
      if (l.arquivo) {
        expect(html, o).toContain(`data-logo="${l.papel}"`);
        expect(html, o).toContain(`src="${l.arquivo}"`);
      } else {
        expect(html, o).toContain(`${nomeGrupo(o)} (${l.motivo!.slice(0, 20)}`); // o motivo inteiro pode ter aspas, que o HTML escapa
      }
    }
    expect(html).toContain("/conectividade/logos/manifesto.json");
    const cfg = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    expect(cfg).toContain('source: "/conectividade/logos/:path*"');
  });
});

describe("Conectividade: achados do Codex no #309", () => {
  it("mês próprio de cada base: um só quando coincidem, os dois quando divergem", () => {
    expect(mesAcessos({ fixa: "2026-08", movel: "2026-08" })).toBe("acessos e linhas de agosto de 2026");
    expect(mesAcessos({ fixa: "2026-08", movel: "2026-07" }, true)).toBe("Acessos fixos de agosto de 2026 e linhas móveis de julho de 2026");
  });

  it("data de captura por fonte: uma só no mesmo dia, uma por fonte quando uma base ficou retida", () => {
    const mesmo = { fixa: { capturado_em: "2026-10-20T17:30:39Z" }, movel: { capturado_em: "2026-10-20T09:00:00Z" }, cobertura: { capturado_em: "2026-10-20T17:30:39Z" } };
    expect(dataCaptura(mesmo, ["fixa", "movel", "cobertura"])).toBe("20/10/2026");
    const retida = { ...mesmo, fixa: { capturado_em: "2026-07-12T12:00:00Z" } };
    expect(dataCaptura(retida, ["fixa", "cobertura"])).toBe("12/07/2026 (banda larga fixa) e 20/10/2026 (cobertura)");
    expect(dataCaptura(retida, ["fixa", "movel", "cobertura"])).toBe("12/07/2026 (banda larga fixa), 20/10/2026 (telefonia móvel) e 20/10/2026 (cobertura)");
  });

  it("valor isolado entre ausências ganha uma marca no gráfico", () => {
    const pontos = [{ x: 0, y: 40 }, { x: 1, y: null }, { x: 2, y: null }, { x: 3, y: 50 }, { x: 4, y: 55 }];
    const svg = renderToStaticMarkup(createElement(GraficoLinhas, { series: [{ nome: "5G", classe: "cn-linha", pontos }], marcasX: [{ x: 0, rotulo: "a" }, { x: 4, rotulo: "b" }], unidade: "%", maximo: 100, descricao: "t" }));
    expect(svg.match(/<circle /g)?.length).toBe(2); // uma marca por versão (larga e estreita)
    expect(svg).toContain('class="cn-ponto-cn-linha"');
    // na gold real, novembro de 2021 é seguido de vazios: o gráfico do Brasil carrega a marca
    const html = renderToStaticMarkup(createElement(PainelPage, { searchParams: {} }));
    expect(html).toMatch(/class="cn-ponto-cn-linha(-suave|-ref)?"/);
  });

  it("a grade de trimestres da cobertura é completa e o trimestre não publicado fica vazio", () => {
    const g = goldConectividade();
    const tri = g.brasil.cobertura.trimestres;
    expect(tri).toEqual(g.trimestres_cobertura);
    for (let i = 1; i < tri.length; i++) expect(Number(tri[i].slice(5, 7)) % 3).toBe(0);
    const vazio = tri.indexOf("2023-09");
    expect(vazio).toBeGreaterThan(0);
    expect(g.brasil.cobertura.serie.g5[vazio]).toBeNull();
    expect(g.brasil.cobertura.serie.g5[tri.indexOf("2024-03")]).not.toBeNull();
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
