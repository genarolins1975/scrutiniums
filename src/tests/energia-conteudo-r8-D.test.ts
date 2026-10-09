/* Trabalho de conteúdo depois da r7, área D (Dados e Metodologia): a ficha de conjunto em linguagem de leitor, as respostas
 * em duas camadas de /dados, /dados/saude, /dados/reproducao e /metodologia, o bloco "O que mudou" e as conciliações de
 * contagens e datas. Os números das conciliações são relidos de CSV e JSON publicados, não da fórmula do código. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DadosPage from "@/app/setor-eletrico/dados/page";
import SaudePage from "@/app/setor-eletrico/dados/saude/page";
import ReproducaoPage from "@/app/setor-eletrico/dados/reproducao/page";
import MetodologiaPage from "@/app/setor-eletrico/metodologia/page";
import DatasetPage from "@/app/setor-eletrico/dados/[dataset]/page";
import { DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import { carimbo } from "@/lib/energia/formato";
import { respostaCatalogo, respostaReproducao, respostaRegras, respostaSaude, resumoCatalogo, resumoMetricas, resumoSaude, situacaoDoConjunto } from "@/lib/energia/dados";
import {
  NOME_ODBL,
  corrigeGrafia,
  criterioDaSituacao,
  eApenasPaginaInicial,
  eTituloTecnico,
  escolheDescricao,
  fraseAbertura,
  fraseFormatos,
  fraseReferencia,
  licencaDoLeitor,
  licencaParaCitacao,
  nomeDoConjunto,
  notasDeQuebraPosterior,
  rotuloDoArquivo,
  rotuloDoLinkOficial,
  NOME_DO_CONJUNTO_TECNICO,
} from "@/lib/energia/dados-ficha";
import {
  conciliarCatalogoEIntegracoes,
  limitacaoInicioDoRegistro,
  quadroDeDatas,
  resumirAcessoCcee,
  separaIdentificadores,
  textoConciliacao,
  textoDatasDaColetaCcee,
  textoMudancaCatalogo,
  textoMudancaRegras,
  textoMudancaReproducao,
  textoMudancaSaude,
  textoRodapeDasFontes,
  tituloCurto,
  vereditoCatalogo,
  vereditoReproducao,
  vereditoRegras,
  vereditoSaude,
} from "@/lib/energia/dados-leitor";
import { conferirManifestoNoDisco, lerCsvComAspas, manifestoDados, metricasPublicadas, publicacaoDados } from "@/lib/energia/dados-servidor";
import type { ConjuntoIntegrado } from "@/lib/energia/tipos-dados";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T>(p: string) => JSON.parse(ler(p)) as T;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Texto que o leitor vê em Entender: sem os blocos de Analisar e de Auditar, sem tabela recolhida, janela, script e figura. */
function entender(html: string, tudo = false): string {
  const VAZIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  let out = "";
  let ultimo = 0;
  let pula = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [tag, fecha, nome, attrs, auto] = m;
    if (!pula) out += html.slice(ultimo, m.index);
    ultimo = m.index + tag.length;
    const n = nome.toLowerCase();
    if (fecha) {
      if (pula) pula--;
      else if (["p", "div", "li", "h1", "h2", "h3", "h4", "tr", "section", "header", "dt", "dd", "details", "summary", "button"].includes(n)) out += "\n";
      continue;
    }
    if (VAZIOS.has(n) || auto) continue;
    if (pula) {
      pula++;
      continue;
    }
    if ((!tudo && (/data-nivel="(analisar|auditar)"/.test(attrs) || /data-recolhivel="fechada"/.test(attrs))) || ["script", "style", "svg", "dialog"].includes(n)) pula = 1;
  }
  out += html.slice(ultimo);
  return out.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}

const cat = catalogoDados()!;
const pub = publicacaoDados()!;
const man = manifestoDados()!;
const paginas = {
  catalogo: renderToStaticMarkup(createElement(DadosPage)),
  saude: renderToStaticMarkup(createElement(SaudePage)),
  reproducao: renderToStaticMarkup(createElement(ReproducaoPage)),
  metodologia: renderToStaticMarkup(createElement(MetodologiaPage)),
};
const ficha = (slug: string) => renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: slug } }));
const OITO = ["aneel-agentes-geracao", "aneel-pautas-atas-diretoria", "aneel-scs", "ccee-lista-agente-associado", "ibge-pof-6715", "ibge-pof-cv", "ons-ena-diario-por-bacia", "senado-leis-feriados"];
// algumas fichas dividem o endereço entre conjuntos que um módulo integra juntos: uma ficha por endereço, a do primeiro conjunto
const unicos = DATASETS_INTEGRADOS.filter((d, i, todas) => todas.findIndex((x) => x.slug === d.slug) === i);
const fichas = Object.fromEntries(unicos.map((d) => [d.slug, ficha(d.slug)]));

// dados lidos dos CSV publicados (outro artefato que o das golds usadas pelo código)
const csvCatalogo = lerCsvComAspas(ler("public/energia/series/dados_catalogo.csv"));
const csvConjuntos = lerCsvComAspas(ler("public/energia/series/dados_conjuntos.csv"));
const colunas = (csv: string[][]) => Object.fromEntries(csv[0].map((c, i) => [c, i])) as Record<string, number>;
const cCat = colunas(csvCatalogo);
const cConj = colunas(csvConjuntos);
const linhasCat = csvCatalogo.slice(1);
const linhasConj = csvConjuntos.slice(1);

/* ---------------------------------------------------------------- vereditos de P067 a P070 */

describe("P067 a P070: veredito em duas camadas", () => {
  const rc = resumoCatalogo(cat);
  const rs = resumoSaude(pub);
  const conf = conferirManifestoNoDisco(man);
  const rm = resumoMetricas(metricasPublicadas());
  const casos = [
    { painel: "P067", pagina: "catalogo", veredito: vereditoCatalogo(rc), completa: respostaCatalogo(rc) },
    { painel: "P068", pagina: "saude", veredito: vereditoSaude(rs), completa: respostaSaude(rs) },
    { painel: "P069", pagina: "reproducao", veredito: vereditoReproducao(man, conf), completa: respostaReproducao(man, pub, conf) },
    { painel: "P070", pagina: "metodologia", veredito: vereditoRegras(rm), completa: respostaRegras(rm) },
  ] as const;

  it("cada veredito tem no máximo 50 palavras e 8 números, e é mais curto que a resposta completa", () => {
    for (const c of casos) {
      expect(c.veredito.length, c.painel).toBeGreaterThan(0);
      expect(palavras(c.veredito), c.painel).toBeLessThanOrEqual(50);
      expect(numeros(c.veredito), c.painel).toBeLessThanOrEqual(8);
      expect(palavras(c.veredito), c.painel).toBeLessThan(palavras(c.completa));
    }
  });

  it("o veredito fica à vista, antes do bloco de Analisar, e a resposta completa continua no HTML dentro dele", () => {
    for (const c of casos) {
      const html = paginas[c.pagina];
      const i = html.indexOf(`data-resposta="${c.painel}"`);
      expect(i, c.painel).toBeGreaterThan(-1);
      const trecho = html.slice(i);
      const fim = trecho.indexOf('data-nivel="analisar"');
      const antes = entender(trecho.slice(0, fim));
      expect(antes, c.painel).toContain(c.veredito);
      const completa = entender(html, true);
      expect(completa, c.painel).toContain(c.completa.slice(0, 80).replace(/\s+/g, " "));
      // a resposta completa não aparece em Entender
      expect(entender(html), c.painel).not.toContain(c.completa.slice(0, 80));
      expect(trecho.slice(fim), c.painel).toContain("Os números por trás da resposta");
    }
  });

  it("os números do veredito conferem com os artefatos publicados (CSV e JSON), não com a fórmula do código", () => {
    // P067: 415 conjuntos e 126 publicados, lidos de dados_catalogo.csv
    expect(linhasCat.length).toBe(415);
    const publicados = linhasCat.filter((l) => l[cCat.estado] === "PUBLICADO").length;
    expect(casos[0].veredito).toContain(`${linhasCat.length} conjuntos`);
    expect(casos[0].veredito).toContain(`${publicados} chegaram`);
    // P068: o maior atraso e o número de integrações com revisão, lidos de dados_conjuntos.csv
    const atrasadas = linhasConj.filter((l) => l[cConj.situacao] === "ATRASADO");
    expect(atrasadas.length).toBe(1);
    expect(casos[1].veredito).toContain(`${atrasadas[0][cConj.dias_atraso]} dias além do prazo`);
    const comRevisao = linhasConj.filter((l) => Number(l[cConj.revisoes_observacoes] || 0) > 0).length;
    expect(casos[1].veredito).toContain(`Em ${comRevisao} integrações`);
    expect(casos[1].veredito).toContain("não prova erro");
    expect(casos[1].veredito).toContain("sem prazo declarado não entram");
    // P069: o número de arquivos do manifesto publicado
    const arquivos = json<{ arquivos: unknown[] }>("public/energia/gold/manifesto.json").arquivos.length;
    expect(casos[2].veredito).toContain(`${arquivos} arquivos`);
    expect(casos[2].veredito).toContain("não refaz a coleta");
    // P070: indicadores e fórmulas de metricas.json
    const metricas = json<{ metricas: { formula?: string }[] }>("public/energia/gold/metricas.json").metricas;
    expect(casos[3].veredito).toContain(`${metricas.length} indicadores`);
    expect(casos[3].veredito).toContain(`${metricas.filter((m) => m.formula).length} têm fórmula`);
  });

  it("sem palavra proibida, sem travessão e sem jargão de coleta no veredito", () => {
    for (const c of casos) {
      expect(c.veredito, c.painel).not.toMatch(/[–—]/);
      expect(c.veredito, c.painel).not.toMatch(/\bhoje\b|undefined|NaN|sha256|pipeline|silver|vintage|SLA/i);
    }
  });

  it("os ramos do veredito da Saúde: nenhum atraso, vários atrasos, sem revisão", () => {
    const c = (dias: number, titulo = "SCS: Sistema de Controle (x)") => ({ titulo, atualidade: { dias_atraso: dias } }) as unknown as ConjuntoIntegrado;
    expect(vereditoSaude({ hoje: "2026-10-01", atrasados: [], comRevisao: [] })).toBe("Em 01/10/2026, nenhuma integração estava atrasada; as sem prazo declarado não entram nessa conta. Nenhuma revisão de valores já publicados foi detectada.");
    const varios = vereditoSaude({ hoje: "2026-10-01", atrasados: [c(5), c(12)], comRevisao: [c(0)] });
    expect(varios).toContain("2 integrações estavam atrasadas, a maior com 12 dias além do prazo");
    expect(varios).toContain("Em 1 integração a fonte revisou");
    expect(tituloCurto("SCS: Sistema de Controle de Subvenções (Tarifa Social)")).toBe("SCS");
    expect(tituloCurto("Balanço de Energia nos Subsistemas")).toBe("Balanço de Energia nos Subsistemas");
  });

  it("o veredito da Reprodução diz em parte quando algum arquivo não confere", () => {
    const v = vereditoReproducao(man, { total: 270, conferidos: 268, divergentes: ["/energia/a.csv"], ausentes: ["/energia/b.csv"] });
    expect(v).toContain("Em parte. De 270 arquivos publicados, 2 não conferiram");
  });
});

/* ---------------------------------------------------------------- "O que mudou" */

describe("O que mudou diz o que mudou", () => {
  it("catálogo: arquivos removidos das listagens, lidos de catalogo.json, e o que a página não compara", () => {
    const bruto = json<{ recursos: Record<string, { removidos?: number }> }>("public/energia/gold/catalogo.json");
    const removidos = Object.values(bruto.recursos).reduce((s, x) => s + (x.removidos ?? 0), 0);
    const t = textoMudancaCatalogo(cat);
    if (removidos === 0) expect(t).toContain("Nenhum arquivo sumiu das listagens");
    else expect(t).toMatch(/sumiu|sumiram/);
    expect(t).toContain("não compara as contagens com a publicação anterior");
    const e = entender(paginas.catalogo);
    expect(e).toContain(t);
    // os horários de coleta saíram de Entender e ficam em Analisar
    const bloco = e.slice(e.indexOf("O que mudou"), e.indexOf("Como interpretar"));
    expect(bloco).not.toContain("02:56");
    expect(entender(paginas.catalogo, true)).toContain("Listagens colhidas em");
  });

  it("saúde: valores revisados e o maior salto, com o conjunto e as duas capturas (dados_conjuntos.csv e publicacao.json)", () => {
    const maior = [...linhasConj].sort((a, b) => Number(b[cConj.maior_revisao_rel_pct] || 0) - Number(a[cConj.maior_revisao_rel_pct] || 0))[0];
    const observacoes = linhasConj.reduce((s, l) => s + Number(l[cConj.revisoes_observacoes] || 0), 0);
    const t = textoMudancaSaude(resumoSaude(pub));
    // o título do conjunto, lido do catálogo publicado em CSV (órgão e nome da linha da saúde)
    const tituloDoMaior = linhasCat.find((l) => l[cCat.id] === `${maior[cConj.orgao].toLowerCase()}:${maior[cConj.conjunto]}`)![cCat.titulo];
    expect(t).toContain(tituloDoMaior);
    expect(t).toContain(observacoes.toLocaleString("pt-BR"));
    expect(t).toContain("não prova erro");
    expect(entender(paginas.saude)).toContain(t);
    expect(textoMudancaSaude({ comRevisao: [], observacoesRevisadas: 0, referenciasRevisadas: 0 })).toBe("Nenhuma revisão de valores já guardados foi detectada nesta publicação.");
  });

  it("reprodução: a data da lista de arquivos vem de manifesto.json e a do processamento, de publicacao.json", () => {
    const m = json<{ gerado_em: string; totais: { arquivos: number } }>("public/energia/gold/manifesto.json");
    const p = json<{ gerado_em: string }>("public/energia/gold/publicacao.json");
    const t = textoMudancaReproducao(man, pub.gerado_em);
    expect(t).toContain(carimbo(m.gerado_em));
    expect(t).toContain(carimbo(p.gerado_em));
    expect(t).toContain(`${m.totais.arquivos} arquivos`);
    expect(t).not.toMatch(/\bhoje\b/i);
    expect(entender(paginas.reproducao)).toContain(t);
  });

  it("metodologia: a afirmação corrigida e quantas conferem, lidas de publicacao.json", () => {
    const p = json<{ afirmacoes: { afirmacao_anterior?: string }[] }>("public/energia/gold/publicacao.json");
    const corrigidas = p.afirmacoes.filter((a) => a.afirmacao_anterior);
    const t = textoMudancaRegras(pub.afirmacoes, pub.afirmacoes.length);
    expect(corrigidas.length).toBeGreaterThan(0);
    expect(t.startsWith(`${corrigidas.length} afirmação desta página foi corrigida`)).toBe(true);
    expect(t).toContain(corrigidas[0].afirmacao_anterior!);
    expect(t).toContain(`As outras ${p.afirmacoes.length - corrigidas.length} afirmações`);
    expect(textoMudancaRegras(pub.afirmacoes.map((a) => ({ ...a, afirmacao_anterior: undefined })), 8)).toBe("Nenhuma afirmação desta página foi corrigida nesta publicação.");
    expect(entender(paginas.metodologia)).toContain(t);
  });
});

/* ---------------------------------------------------------------- identificadores técnicos fora de Entender */

describe("identificadores técnicos só em Analisar e Auditar", () => {
  const PROIBIDO = [
    /\bsha256\w*\b/i,
    /\bpipeline\b/i,
    /\bsilvers?\b/i,
    /\bbronze\b/i,
    /\bgolds?\b/,
    /\bvintages?\b/i,
    /\bcommits?\b/i,
    /HTTP \d{3}/,
    /\bP0\d\d\b/,
    /\bachado A\d+/i,
    /\b[a-z]+_[a-z0-9_]+\b/,
    /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/,
    /\b[\w-]+\.(?:csv|json|parquet|py|zip|xlsx|db\.gz)\b/i,
    /package_(?:search|show)|\bCKAN\b/,
    /\bcurl\b|User-Agent|Cloudflare|\bbacktest\b|\bsnapshot\b/i,
    /\bSLA\b/,
    /\bhoje\b/i,
    /[–—]/,
    /undefined|NaN|\[object/,
    /…/,
  ];
  const alvo: [string, string][] = [
    ["/setor-eletrico/dados", paginas.catalogo],
    ["/setor-eletrico/dados/saude", paginas.saude],
    ["/setor-eletrico/dados/reproducao", paginas.reproducao],
    ["/setor-eletrico/metodologia", paginas.metodologia],
    ...OITO.map((s): [string, string] => [`/setor-eletrico/dados/${s}`, fichas[s]]),
  ];

  it("o texto de Entender das doze páginas não traz nome de campo, de arquivo, de código nem vocabulário de engenharia", () => {
    for (const [rota, html] of alvo) {
      const t = entender(html);
      for (const re of PROIBIDO) {
        const achou = re.exec(t);
        expect(achou ? `${rota}: ${t.slice(Math.max(0, achou.index - 40), achou.index + 60)}` : null, rota).toBeNull();
      }
    }
  });

  it("o mesmo vale para todas as fichas de conjunto: nenhum identificador, arquivo, reticência ou travessão em Entender", () => {
    expect(unicos.length).toBeGreaterThan(100);
    const COMUM = [/\bsha256\w*\b/i, /\bpipeline\b/i, /\bsilvers?\b/i, /\bbronze\b/i, /\bgolds?\b/, /\bvintages?\b/i, /\bcommits?\b/i, /HTTP \d{3}/, /\b[a-z]+_[a-z0-9_]+\b/, /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/, /\b[\w-]+\.(?:csv|json|parquet|py|zip|xlsx)\b/i, /CKAN|package_/, /\bSLA\b/, /…/, /[\u2013\u2014]/, /undefined|NaN/];
    for (const d of unicos) {
      const t = entender(fichas[d.slug]);
      for (const re of COMUM) {
        const achou = re.exec(t);
        expect(achou ? `${d.slug}: ${t.slice(Math.max(0, achou.index - 40), achou.index + 60)}` : null, d.slug).toBeNull();
      }
    }
  });

  it("os mesmos termos continuam disponíveis em Analisar e Auditar, na mesma página", () => {
    expect(entender(paginas.reproducao, true)).toContain("sha256");
    expect(entender(paginas.metodologia, true)).toMatch(/bronze[\s\S]*silver[\s\S]*gold/);
    expect(entender(paginas.metodologia, true)).toContain("HTTP 403");
    expect(entender(paginas.saude, true)).toMatch(/silvers/);
    expect(entender(fichas["aneel-agentes-geracao"], true)).toContain("empresas_ativos.csv");
    expect(entender(fichas["ccee-lista-agente-associado"], true)).toContain("LISTA_AGENTE_ASSOCIADO");
  });

  it("as fichas e as quatro páginas têm o seletor de profundidade; sem JavaScript tudo continua no HTML", () => {
    for (const [rota, html] of alvo) {
      expect(html, rota).toContain('class="modo-profundidade"');
      expect(html, rota).toContain('data-nivel="analisar"');
    }
  });

  it("as fontes das respostas não carregam o nome técnico da consulta nem o caminho de pasta", () => {
    expect(entender(paginas.catalogo)).not.toMatch(/CKAN|package_search/);
    expect(entender(paginas.reproducao)).not.toContain("public/energia");
  });

  it("peso das páginas abaixo da meta de 600 kB", () => {
    for (const [rota, html] of alvo) expect(Buffer.byteLength(html, "utf-8"), rota).toBeLessThan(600 * 1024);
  });
});

/* ---------------------------------------------------------------- ficha de conjunto */

describe("ficha de conjunto: nome, abertura e descrição", () => {
  const raw = cat.entradas.filter((e) => eTituloTecnico(e.titulo) && e.slug);

  it("há dezoito fichas com título técnico, e cada H1 é o nome que a integração registra (publicacao.json)", () => {
    expect(raw.length).toBe(18);
    const bruto = json<{ conjuntos: { id: string; titulo: string }[] }>("public/energia/gold/publicacao.json").conjuntos;
    for (const e of raw) {
      const h = fichas[e.slug!];
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h)![1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
      expect(h1, e.id).not.toMatch(/_/);
      const integ = bruto.find((c) => c.id === e.integracoes![0].id)!;
      const esperado = eTituloTecnico(integ.titulo) ? NOME_DO_CONJUNTO_TECNICO[integ.titulo] : integ.titulo;
      expect(h1, e.id).toBe(esperado);
      // o título da fonte continua na ficha, em Analisar
      expect(entender(h, true), e.id).toContain(`Título na fonte\n${e.titulo}.`);
      expect(entender(h), e.id).not.toContain(e.titulo);
    }
  });

  it("o nome com que o observatório chama o PLD horário é o que ele já publica (afirmação em publicacao.json)", () => {
    const temas = json<{ afirmacoes: { tema: string }[] }>("public/energia/gold/publicacao.json").afirmacoes.map((a) => a.tema);
    expect(temas).toContain(NOME_DO_CONJUNTO_TECNICO.PLD_HORARIO);
  });

  it("a grafia sem acento da fonte é corrigida no título e na citação, e o título original fica anotado", () => {
    expect(corrigeGrafia("Pautas e Atas das Reuniões Publicas da Diretoria")).toBe("Pautas e Atas das Reuniões Públicas da Diretoria");
    const h = fichas["aneel-pautas-atas-diretoria"];
    expect(entender(h)).toContain("Pautas e Atas das Reuniões Públicas da Diretoria");
    expect(entender(h)).not.toContain("Publicas");
    expect(entender(h, true)).toContain("Pautas e Atas das Reuniões Publicas da Diretoria. A fonte grafa esse título sem acento");
    for (const [slug, html] of Object.entries(fichas)) expect(entender(html), slug).not.toContain("Publicas");
  });

  it("nome do conjunto: identificador, grafia, nome técnico da consulta e travessão", () => {
    expect(nomeDoConjunto({ titulo: "MRE_MENSAL" }, [{ titulo: "MRE mensal: garantia física" }])).toEqual({ nome: "MRE mensal: garantia física", tituloNaFonte: "MRE_MENSAL", motivo: "identificador" });
    expect(nomeDoConjunto({ titulo: "PLD_HORARIO" }, [{ titulo: "PLD_HORARIO" }]).nome).toBe("PLD horário");
    expect(nomeDoConjunto({ titulo: "ALGUM_CONJUNTO_NOVO" }, []).nome).toBe("Algum conjunto novo");
    expect(nomeDoConjunto({ titulo: "Listagem dos conjuntos (API CKAN package_search)" }).nome).toBe("Listagem dos conjuntos");
    expect(nomeDoConjunto({ titulo: "RALIE – Relatório de Acompanhamento" }).nome).toBe("RALIE: Relatório de Acompanhamento");
    expect(nomeDoConjunto({ titulo: "Bandeiras Tarifárias" })).toEqual({ nome: "Bandeiras Tarifárias", tituloNaFonte: null, motivo: null });
  });

  it("a abertura é uma frase completa com o órgão, a frequência (ou a falta dela) e as páginas que usam o conjunto", () => {
    expect(fraseAbertura({ orgao: "ANEEL", cadencias: ["semanal"], paginas: [{ rotulo: "Regulação" }] })).toBe(
      "Este é um conjunto de dados abertos publicado pela ANEEL. A fonte declara atualização semanal. O observatório usa o conjunto na página Regulação.",
    );
    expect(fraseAbertura({ orgao: "IBGE", cadencias: [], paginas: [{ rotulo: "A" }, { rotulo: "B" }] })).toBe(
      "Este é um conjunto de dados abertos publicado pelo IBGE. A fonte não declara a frequência de atualização. O observatório usa o conjunto nas páginas A e B.",
    );
    for (const d of unicos) {
      const e = cat.entradas.find((x) => x.id === d.catalogoId)!;
      const t = entender(fichas[d.slug]);
      expect(t, d.slug).toContain(`Este é um conjunto de dados abertos publicado pel`);
      expect(t, d.slug).toMatch(new RegExp(`conjunto de dados abertos publicado pel[ao] ${e.orgao.replace(/[-.]/g, "\\$&")}\\.`));
      expect(t, d.slug).toMatch(/A fonte (declara atualização|não declara a frequência de atualização)/);
      expect(t, d.slug).not.toContain("…");
    }
  });

  it("a descrição cortada do catálogo compacto não aparece em Entender; em Analisar vai a íntegra publicada em dados_catalogo.csv, quando ela começa pelo texto guardado", () => {
    const bruto = json<{ entradas: { id: string; slug?: string; descricao?: string }[] }>("public/energia/gold/catalogo.json").entradas;
    let completas = 0;
    for (const d of unicos) {
      const guardada = bruto.find((x) => x.id === d.catalogoId)?.descricao ?? "";
      const linha = linhasCat.find((l) => l[cCat.id] === d.catalogoId)!;
      const integral = linha[cCat.descricao];
      const todo = entender(fichas[d.slug], true).replace(/\s+/g, " ");
      if (guardada.endsWith("…") && integral.startsWith(guardada.slice(0, -1)) && integral.length > guardada.length) {
        completas++;
        expect(todo, d.slug).toContain(integral.replace(/\s+/g, " "));
        expect(entender(fichas[d.slug]), d.slug).not.toContain(guardada);
      }
    }
    expect(completas).toBeGreaterThan(80);
    expect(escolheDescricao("Começo da frase…", "Começo da frase inteira.")).toEqual({ texto: "Começo da frase inteira.", origem: "csv", cortada: false });
    expect(escolheDescricao("Começo da frase…", "Outro texto")).toEqual({ texto: "Começo da frase…", origem: "catalogo", cortada: true });
    expect(escolheDescricao("", "")).toEqual({ texto: null, origem: "nenhuma", cortada: false });
    expect(escolheDescricao("Texto inteiro.", "Texto inteiro.")).toEqual({ texto: "Texto inteiro.", origem: "catalogo", cortada: false });
  });
});

describe("ficha de conjunto: situação dos dados com o critério", () => {
  const conj = (interno: string) => pub.conjuntos.find((c) => c.id.endsWith(`/${interno}`))!;

  it("atrasado: o prazo, de onde parte, e a data até a qual os dias contam (SCS)", () => {
    const e = entender(fichas["aneel-scs"]);
    const c = json<{ conjuntos: { id: string; atualidade: { prazo_proximo: string; dias_atraso: number; ultimo_periodo: string } }[]; referencia: { hoje: string } }>("public/energia/gold/publicacao.json");
    const scs = c.conjuntos.find((x) => x.id.endsWith("/aneel_scs"))!;
    // o atraso publicado é a distância, em dias, entre o prazo e a data de referência: o texto diz as duas datas
    const dias = Math.round((Date.parse(c.referencia.hoje) - Date.parse(scs.atualidade.prazo_proximo)) / 86_400_000);
    expect(dias).toBe(scs.atualidade.dias_atraso);
    expect(e).toContain(`Dado atrasado: ${scs.atualidade.dias_atraso} dias além do prazo de ${dmy(scs.atualidade.prazo_proximo)}`);
    expect(e).toContain(`Esse prazo venceu em ${dmy(scs.atualidade.prazo_proximo)}; os ${scs.atualidade.dias_atraso} dias além do prazo contam dessa data até ${dmy(c.referencia.hoje)}, a data de referência desta publicação.`);
    expect(e).toContain("60 dias (a tolerância para atualização mensal)");
  });

  it("atrasado: a mudança de regra posterior ao último período é ligada ao período (05/07/2025 depois de 06/2025)", () => {
    const e = entender(fichas["aneel-scs"]);
    expect(e).toContain("A mudança de 05/07/2025");
    expect(e).toContain("é posterior ao último período disponível, 06/2025: os dados disponíveis ainda não refletem essa mudança.");
    // a mudança de 2022 é anterior ao último período e não recebe a nota
    expect(e).not.toContain("A mudança de 01/01/2022");
    expect(notasDeQuebraPosterior([{ data: "2025-07-05", descricao: "Regra nova." }], { atualidade: { situacao: "ATRASADO", ultimo_periodo: "2025-06", fim_ultimo_periodo: "2025-06-30" } })).toHaveLength(1);
    expect(notasDeQuebraPosterior([{ data: "2022-01-01", descricao: "Regra antiga." }], { atualidade: { situacao: "ATRASADO", ultimo_periodo: "2025-06", fim_ultimo_periodo: "2025-06-30" } })).toHaveLength(0);
  });

  it("em dia: o prazo vem do JSON publicado e a ficha diz que ele ainda não tinha vencido", () => {
    for (const slug of ["ons-ena-diario-por-bacia", "ccee-lista-agente-associado", "aneel-agentes-geracao", "aneel-pautas-atas-diretoria"]) {
      const d = DATASETS_INTEGRADOS.find((x) => x.slug === slug)!;
      const c = json<{ conjuntos: { id: string; atualidade: { prazo_proximo: string } }[] }>("public/energia/gold/publicacao.json").conjuntos.find((x) => x.id.endsWith(`/${d.interno}`))!;
      const e = entender(fichas[slug]);
      expect(e, slug).toContain(`Dado em dia`);
      expect(e, slug).toContain(dmy(c.atualidade.prazo_proximo) + ".");
      expect(e, slug).toContain("esse prazo ainda não tinha vencido");
    }
  });

  it("cadastro sem período: o prazo parte da data de publicação da fonte, que a ficha diz", () => {
    const e = entender(fichas["aneel-pautas-atas-diretoria"]);
    expect(e).toContain("A lista não traz um período de referência.");
    expect(e).toContain("O prazo parte da data da última publicação informada pela fonte (25/09/2026), mais um período semanal e 7 dias de tolerância: 09/10/2026.");
  });

  it("sem prazo declarado: a consequência para o leitor e a referência registrada (POF, dados de 2017-2018)", () => {
    const e = entender(fichas["ibge-pof-cv"]);
    expect(e).toContain("Sem prazo de atualização declarado");
    expect(e).toContain("Isso não indica se o dado está ou não desatualizado.");
    expect(e).toContain("Os dados se referem a 2017-2018.");
    expect(entender(fichas["senado-leis-feriados"])).toContain("Isso não indica se o dado está ou não desatualizado.");
  });

  it("POF 6715: a frequência anual e a falta de série regular deixam de parecer contradição", () => {
    const e = entender(fichas["ibge-pof-6715"]);
    expect(e).toContain("A fonte declara atualização anual.");
    expect(e).toContain("Atraso não medido");
    expect(e).toContain("A fonte declara atualização anual, mas o conjunto tem uma única referência registrada (2017-2018) e não forma uma série que se renove no tempo.");
    expect(conj("ibge_pof_6715").frequencia.cadencias).toEqual(["anual"]);
    expect(conj("ibge_pof_6715").atualidade.situacao).toBe("SEM DADO");
  });

  it("o critério em cada caso, com a regra de tolerância da publicação", () => {
    const sla = pub.regras.sla;
    const base = { capturas: { ultima: "2026-09-30T20:00:00Z", ultima_publicacao_fonte: "2026-09-25T03:00:00Z" }, frequencia: { cadencias: ["semanal"] }, dado: { granularidade: "anual" } };
    const caso = (atualidade: object, extra: object = {}) => ({ ...base, ...extra, atualidade }) as unknown as Parameters<typeof criterioDaSituacao>[0];
    expect(criterioDaSituacao(caso({ situacao: "EM DIA", caso: "B", base: "periodo_de_referencia", cadencia: "mensal", ultimo_periodo: "2026-08", prazo_proximo: "2026-12-30", dias_atraso: 0 }), sla, "2026-10-01")).toContain("O dado sai em lotes: a próxima remessa deve chegar até o fim do último período disponível (08/2026) mais um período mensal e 60 dias de tolerância: 30/12/2026.");
    expect(criterioDaSituacao(caso({ situacao: "EM DIA", caso: "E", base: "publicacao_da_fonte", cadencia: "mensal", prazo_proximo: "2026-12-30" }), sla, "2026-10-01")).toContain("A fonte declara atualização mensal, mais frequente que o período dos próprios dados (anual).");
    expect(criterioDaSituacao(caso({ situacao: "EM DIA", caso: "A", base: "periodo_de_referencia", cadencia: "anual", ultimo_periodo: "2026", prazo_proximo: "2027-12-31", periodo_parcial: true }), sla, "2026-10-01")).toContain("O último período ainda não terminou e não alonga o prazo");
    expect(criterioDaSituacao(caso({ situacao: "EM DIA", caso: "D", base: "periodo_de_referencia", cadencia: "mensal", prazo_proximo: "2026-12-30", publicacao_nao_acompanha_conteudo: true }), sla, "2026-10-01")).toContain("A data de modificação informada pela fonte é anterior ao período mais recente do próprio arquivo");
    expect(criterioDaSituacao(caso({ situacao: "SEM SLA" }, { dado: { ref_min: "2017", ref_max: "2018", formato: "nao_temporal" } }), sla, "2026-10-01")).toBe("Isso não indica se o dado está ou não desatualizado. Os dados se referem a de 2017 a 2018.");
    // o título do atrasado continua o contrato antigo quando o prazo não vem
    expect(situacaoDoConjunto({ atualidade: { situacao: "ATRASADO", dias_atraso: 12 } } as Parameters<typeof situacaoDoConjunto>[0]).titulo).toBe("Dado atrasado: 12 dias além do prazo");
  });

  it("data de referência: período já publicado antes de terminar (CCEE), referência única (POF) e cadastro", () => {
    const e = entender(fichas["ccee-lista-agente-associado"]);
    const c = json<{ conjuntos: { id: string; capturas: { ultima_publicacao_fonte: string; ultima: string } }[] }>("public/energia/gold/publicacao.json").conjuntos.find((x) => x.id.endsWith("/ccee_lista_agente_associado"))!;
    expect(e).toContain(`último período disponível 09/2026. Esse período ainda não tinha terminado na última captura (${carimbo(c.capturas.ultima).slice(0, 10)}): a fonte já o havia publicado em ${carimbo(c.capturas.ultima_publicacao_fonte).slice(0, 10)}.`);
    expect(entender(fichas["ibge-pof-6715"])).toContain("uma única referência, 2017-2018: o conjunto não é uma série no tempo");
    expect(entender(fichas["senado-leis-feriados"])).toContain("sem período de referência: a lista não traz um período a que se refira");
    expect(fraseReferencia(undefined, true)).toBe("sem período registrado para este conjunto");
    // diário, com a captura depois do fim do período: sem a frase de período em curso
    expect(entender(fichas["ons-ena-diario-por-bacia"])).toContain("último período disponível 29/09/2026");
    expect(entender(fichas["ons-ena-diario-por-bacia"])).not.toContain("ainda não tinha terminado");
  });
});

describe("ficha de conjunto: licença, página oficial, formatos e arquivos", () => {
  it("a ODbL tem o mesmo nome em todas as páginas, qualquer que seja a grafia do catálogo", () => {
    const bruto = json<{ portais: Record<string, { licenca?: string }>; entradas: { id: string; slug?: string; orgao: string; licenca?: string | null }[] }>("public/energia/gold/catalogo.json");
    const variantes = new Set<string>();
    let paginasOdbl = 0;
    for (const d of DATASETS_INTEGRADOS) {
      const e = bruto.entradas.find((x) => x.id === d.catalogoId)!;
      const lic = e.licenca ?? bruto.portais[e.orgao]?.licenca ?? "";
      if (!/ODbL/.test(lic)) continue;
      paginasOdbl++;
      variantes.add(lic.split(",")[0]);
      const t = entender(fichas[d.slug]);
      expect(t, d.slug).toContain(`Licença\n${NOME_ODBL}`);
      expect(t, d.slug).not.toContain("Licença Aberta para Bases de Dados");
    }
    expect(paginasOdbl).toBeGreaterThan(10);
    expect(variantes.size).toBeGreaterThan(1); // o catálogo tem mais de uma grafia, e a página uniformiza
    expect(licencaDoLeitor("Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da CVM").nome).toBe(`${NOME_ODBL}, conforme o portal de dados abertos da CVM`);
    expect(licencaDoLeitor(NOME_ODBL).nome).toBe(NOME_ODBL);
    expect(licencaDoLeitor("Creative Commons Attribution").nome).toBe("Creative Commons Atribuição");
  });

  it("licença jurídica: a base legal sai do nome e vai para Analisar; a citação usa 'domínio público'", () => {
    const l = licencaDoLeitor("Texto normativo e metadados de legislação federal: domínio público (Lei nº 9.610/1998, art. 8º, IV), portal de Legislação Federal do Senado");
    expect(l.nome).toBe("Texto normativo e metadados de legislação federal: domínio público, portal de Legislação Federal do Senado");
    expect(l.baseLegal).toBe("Lei nº 9.610/1998, art. 8º, IV");
    expect(licencaParaCitacao(l.nome)).toBe("domínio público");
    const h = fichas["senado-leis-feriados"];
    expect(entender(h)).toContain("licença domínio público");
    expect(entender(h)).not.toContain("Lei nº 9.610");
    expect(entender(h, true)).toContain("(base legal: Lei nº 9.610/1998, art. 8º, IV)");
  });

  it("a nota da licença diz o que aconteceu, sem 'desafio de navegador' nem 'integração'", () => {
    const l = licencaDoLeitor("Uso livre com citação da fonte (IBGE). A página de termos de uso do IBGE respondeu com desafio de navegador em 30/09/2026 e não foi relida nesta integração.");
    expect(l.nome).toBe("Uso livre com citação da fonte (IBGE)");
    expect(l.nota).toBe("A página de termos de uso do IBGE recusou a consulta automática do observatório em 30/09/2026 e não foi relida ao integrar este conjunto.");
    for (const s of ["ibge-pof-6715", "ibge-pof-cv"]) expect(entender(fichas[s])).toContain("Observação sobre a licença: A página de termos de uso do IBGE recusou a consulta automática");
  });

  it("página oficial que é só a página inicial do portal: a ficha diz que o catálogo não guarda link direto (Senado)", () => {
    expect(eApenasPaginaInicial("https://legis.senado.leg.br/")).toBe(true);
    expect(eApenasPaginaInicial("https://dadosabertos.aneel.gov.br/dataset/x")).toBe(false);
    const t = entender(fichas["senado-leis-feriados"]);
    expect(t).toContain("Abrir a página inicial do portal do Senado Federal");
    expect(t).toContain("Este endereço é a página inicial do portal: o catálogo não guarda um link direto para o conjunto.");
    expect(entender(fichas["aneel-scs"])).not.toContain("página inicial do portal");
    expect(rotuloDoLinkOficial("https://ftp.ibge.gov.br/x/y.zip", "IBGE")).toBe("Abrir o arquivo oficial (.zip) no site do IBGE");
    // o endereço fica em Analisar
    expect(entender(fichas["senado-leis-feriados"], true)).toContain("https://legis.senado.leg.br/");
  });

  it("formatos: sem formato no catálogo, a ficha diz isso e o que o endereço oficial mostra (POF CV é um .zip)", () => {
    expect(fraseFormatos([], "https://ftp.ibge.gov.br/a/b.zip")).toBe("não informados no catálogo; o endereço oficial é um arquivo .zip");
    expect(fraseFormatos([], "https://sidra.ibge.gov.br/tabela/6715")).toBe("não informados no catálogo");
    expect(fraseFormatos(["CSV", "PDF"], null)).toBe("CSV, PDF");
    expect(entender(fichas["ibge-pof-cv"])).toContain("não informados no catálogo; o endereço oficial é um arquivo .zip");
  });

  it("arquivos para baixar: tabelas derivadas, nome legível e quantos conjuntos o arquivo reúne (lido de catalogo.json)", () => {
    const bruto = json<{ entradas: { id: string; slug?: string; downloads?: string[] }[] }>("public/energia/gold/catalogo.json").entradas;
    for (const slug of OITO) {
      const d = DATASETS_INTEGRADOS.find((x) => x.slug === slug)!;
      const t = entender(fichas[slug]);
      expect(t, slug).toContain("São tabelas derivadas: o observatório as monta e publica a partir dos dados deste conjunto");
      expect(t, slug).toContain("Os formatos publicados, acima, são os da fonte");
      for (const u of d.downloads) {
        const nome = u.split("/").pop()!;
        const rotulo = rotuloDoArquivo(u);
        expect(rotulo, u).not.toMatch(/_|\.csv/);
        const linha = t.split("\n").find((l) => l.startsWith(`${rotulo} (CSV)`));
        expect(linha, u).toBeTruthy();
        expect(t, u).not.toContain(nome);
        expect(entender(fichas[slug], true), u).toContain(`Arquivo ${nome}`);
        // fichas (endereços) distintas que oferecem o mesmo arquivo, lidas de catalogo.json
        const outros = new Set(bruto.filter((x) => x.slug && x.slug !== slug && (x.downloads ?? []).includes(u)).map((x) => x.slug)).size;
        if (outros > 0) expect(linha, u).toContain(`Reúne dados também de ${outros} ${outros === 1 ? "outro conjunto" : "outros conjuntos"}.`);
        else expect(linha, u).not.toContain("Reúne dados também");
      }
    }
    // o mesmo arquivo de POF aparece nas duas páginas, com o mesmo nome legível
    expect(entender(fichas["ibge-pof-cv"])).toContain(rotuloDoArquivo("/energia/series/inclusao_pof.csv"));
    expect(entender(fichas["ibge-pof-6715"])).toContain(rotuloDoArquivo("/energia/series/inclusao_pof.csv"));
  });

  it("arquivo fora da tabela de nomes: a descrição do dicionário antes das colunas, ou o nome sem sublinhado", () => {
    expect(rotuloDoArquivo("/energia/series/agua_mlt_mudancas.csv", "Mudanças da MLT por usina (ONS, ENA por reservatório). Colunas: data; cod_reservatorio")).toBe("Mudanças da MLT por usina (ONS, ENA por reservatório)");
    expect(rotuloDoArquivo("/energia/series/qualidade_brasil.csv", "periodo (AAAA ou AAAA-MM); tipo")).toBe("Qualidade Brasil");
  });

  it("o nome do arquivo sem descrição volta com siglas em maiúsculas e acento, e palavra desconhecida fica como está", () => {
    expect(rotuloDoArquivo("/energia/series/regulacao_limites_pld_conferencias.csv")).toBe("Regulação limites PLD conferências");
    expect(rotuloDoArquivo("/energia/series/pld_horario.csv")).toBe("PLD horário");
    expect(rotuloDoArquivo("/energia/series/geracao_matriz_horaria_12m.csv")).toBe("Geração matriz horária 12m");
    expect(rotuloDoArquivo("/energia/series/expansao_pde2035.csv")).toBe("Expansão PDE 2035");
    expect(rotuloDoArquivo("/energia/series/zzz_palavra_nova.csv")).toBe("Zzz palavra nova");
  });

  it("citação: sem identificador técnico e com o título como a fonte o usa para o leitor", () => {
    const t = entender(fichas["ccee-lista-agente-associado"]);
    expect(t).toContain("CCEE. Agentes associados por mês (CNPJ, classe, categoria, varejista). Dados abertos, licença Creative Commons Attribution 4.0.");
    expect(entender(fichas["ccee-lista-agente-associado"], true)).toContain("Título na fonte: LISTA_AGENTE_ASSOCIADO.");
  });
});

/* ---------------------------------------------------------------- conciliações */

describe("conciliação 1: 415 conjuntos de 18 órgãos no catálogo e 151 integrações de 13 órgãos no rodapé", () => {
  const conc = conciliarCatalogoEIntegracoes(cat, pub);

  it("as contagens do catálogo e da saúde batem com dados_catalogo.csv e dados_conjuntos.csv", () => {
    const ids = new Set<string>();
    for (const l of linhasCat) for (const i of (l[cCat.integracoes] || "").split("|").filter(Boolean)) ids.add(i);
    const orgaosCat = new Set(linhasCat.map((l) => l[cCat.orgao]));
    const orgaosInt = new Set(linhasConj.map((l) => l[cConj.orgao]));
    expect(conc.conjuntos).toBe(linhasCat.length);
    expect(conc.orgaos).toBe(orgaosCat.size);
    expect(conc.conjuntosComIntegracao).toBe(linhasCat.filter((l) => l[cCat.integracoes]).length);
    expect(conc.conjuntosComVariasIntegracoes).toBe(linhasCat.filter((l) => (l[cCat.integracoes] || "").split("|").filter(Boolean).length > 1).length);
    expect(conc.conjuntosSemIntegracao).toBe(linhasCat.filter((l) => !l[cCat.integracoes]).length);
    expect(conc.integracoes).toBe(linhasConj.length);
    expect(ids.size).toBe(linhasConj.length);
    expect(new Set(linhasConj.map((l) => l[cConj.id]))).toEqual(ids);
    expect(conc.orgaosComIntegracao).toBe(orgaosInt.size);
    expect(conc.orgaosSoNoCatalogo).toEqual(Array.from(orgaosCat).filter((o) => !orgaosInt.has(o)).sort((a, b) => a.localeCompare(b, "pt-BR")));
    // uma integração reunindo mais de um conjunto: lida das listas de integrações de cada linha do CSV
    const porInt = new Map<string, number>();
    for (const l of linhasCat) for (const i of (l[cCat.integracoes] || "").split("|").filter(Boolean)) porInt.set(i, (porInt.get(i) ?? 0) + 1);
    expect(conc.integracoesDeVariosConjuntos).toBe(Array.from(porInt.values()).filter((n) => n > 1).length);
  });

  it("o catálogo e a Saúde dizem a diferença, com os números", () => {
    const t = textoConciliacao(conc);
    expect(t).toContain(`O catálogo conta conjuntos: ${conc.conjuntos}, de ${conc.orgaos} órgãos.`);
    expect(t).toContain(`contam integrações: ${conc.integracoes}, de ${conc.orgaosComIntegracao} órgãos.`);
    expect(t).toContain("Integração é o uso de um conjunto por um módulo do observatório.");
    for (const o of conc.orgaosSoNoCatalogo) expect(t).toContain(o);
    expect(entender(paginas.catalogo)).toContain(t);
    expect(entender(paginas.saude)).toContain(t);
    expect(conc.conjuntos).toBe(415);
    expect(conc.orgaos).toBe(18);
    expect(conc.integracoes).toBe(151);
    expect(conc.orgaosComIntegracao).toBe(13);
  });

  it("a Saúde chama de integração o que conta (cartões e gráfico)", () => {
    const t = entender(paginas.saude);
    expect(t).toContain("Integrações em dia");
    expect(t).toContain("de 151 integrações");
    expect(t).not.toMatch(/de 151 integrados|conjuntos em dia/i);
  });

  it("o texto que o rodapé precisaria: integrações no lugar de conjuntos, com a ponte para o catálogo", () => {
    const orgaos = Array.from(new Set(linhasConj.map((l) => l[cConj.orgao])));
    const r = textoRodapeDasFontes(conc, orgaos);
    expect(r.resumo).toBe("13 órgãos, 151 integrações");
    expect(r.detalhe).toContain("em 151 integrações de conjuntos (132 dos 415 conjuntos do catálogo)");
    expect(r.detalhe).toContain("O catálogo traz 18 órgãos.");
  });
});

describe("conciliação 2: as datas e horários que as páginas mostram", () => {
  const manifesto = json<{ gerado_em: string; arquivos: { caminho: string; tipo: string; gerado_em?: string }[] }>("public/energia/gold/manifesto.json");
  const publicacao = json<{ gerado_em: string; referencia: { hoje: string; executado_em: string } }>("public/energia/gold/publicacao.json");
  const meta = json<{ gerado_em: string }>("public/energia/gold/meta.json");
  const metricas = json<{ gerado_em: string }>("public/energia/gold/metricas.json");

  it("o quadro diz o que cada data mede, com o rótulo próprio", () => {
    const q = quadroDeDatas({ referencia: publicacao.referencia.hoje, processadoEm: publicacao.gerado_em, manifestoEm: manifesto.gerado_em, metaEm: meta.gerado_em, indicadoresEm: metricas.gerado_em });
    expect(q.map((x) => x.rotulo)).toEqual(["Data de referência dos dados", "Catálogo e saúde processados em", "Lista de arquivos gerada em", "Catálogo de indicadores gerado em", "Último processamento completo em"]);
    expect(q[0].valor).toBe(dmy(publicacao.referencia.hoje));
    expect(q[1].valor).toBe(carimbo(publicacao.gerado_em));
    expect(q[2].valor).toBe(carimbo(manifesto.gerado_em));
    expect(new Set(q.map((x) => x.rotulo)).size).toBe(q.length);
  });

  it("cada página mostra a data certa com o rótulo certo (manifesto.json, publicacao.json, meta.json, metricas.json)", () => {
    const cab = (h: string) => entender(h).split("\n").find((l) => l.startsWith("Fontes e datas de referência")) ?? "";
    expect(cab(paginas.catalogo)).toContain(`Data de referência dos dados: ${dmy(publicacao.referencia.hoje)}. Catálogo e saúde processados em ${carimbo(publicacao.gerado_em)}.`);
    expect(cab(paginas.saude)).toContain(`Catálogo e saúde processados em ${carimbo(publicacao.gerado_em)}.`);
    expect(cab(paginas.reproducao)).toContain(`Catálogo e saúde processados em ${carimbo(publicacao.gerado_em)}. Lista de arquivos gerada em ${carimbo(manifesto.gerado_em)}.`);
    expect(cab(paginas.metodologia)).toContain(`Catálogo de indicadores gerado em ${carimbo(metricas.gerado_em)}.`);
    expect(cab(paginas.metodologia)).toContain(`Último processamento completo: ${carimbo(meta.gerado_em)}.`);
    // o rótulo antigo "Publicação processada em" misturava os três horários
    for (const [nome, h] of Object.entries(paginas)) expect(entender(h), nome).not.toContain("Publicação processada em");
  });

  it("a Reprodução explica por que a lista de arquivos é posterior ao processamento, e lista a hora de cada base (inclusive a Expansão)", () => {
    const e = entender(paginas.reproducao);
    expect(e).toContain("Que data é esta? Cada data mede uma coisa diferente");
    expect(Date.parse(manifesto.gerado_em)).toBeGreaterThan(Date.parse(publicacao.gerado_em));
    const todo = entender(paginas.reproducao, true);
    const expansao = manifesto.arquivos.find((a) => a.caminho === "/energia/gold/expansao.json")!;
    expect(todo).toContain(`expansao.json ${carimbo(expansao.gerado_em)}`);
    expect(todo).toContain(`publicacao.json ${carimbo(publicacao.gerado_em)}`);
    expect(todo).toContain(`catalogo.json ${carimbo(publicacao.gerado_em)}`);
    // as bases listadas são as golds do manifesto
    const golds = manifesto.arquivos.filter((a) => a.tipo === "gold" && a.gerado_em);
    for (const g of golds) expect(todo).toContain(`${g.caminho.split("/").pop()} ${carimbo(g.gerado_em)}`);
  });
});

describe("conciliação 3: a coleta autorizada em 06/10/2026 e a data de referência de 01/10/2026", () => {
  const mercado = json<{ acesso_ccee: { decisao: { decidida_em: string; registrada_em: string }; capturas: { ultima_captura: string }[] } }>("public/energia/gold/mercado.json");
  const publicacao = json<{ gerado_em: string; referencia: { hoje: string } }>("public/energia/gold/publicacao.json");

  it("a página explica a diferença entre a data da decisão e a data de referência, lendo as duas dos JSON publicados", () => {
    const decisao = mercado.acesso_ccee.decisao.decidida_em;
    const e = entender(paginas.metodologia);
    expect(e).toContain(`coleta autorizada pelo responsável em ${dmy(decisao)}`);
    expect(e).toContain(`${dmy(decisao)} é a data da decisão do responsável, um registro de autorização, e não uma data dos dados; a data de referência dos dados do catálogo e da saúde é ${dmy(publicacao.referencia.hoje)}.`);
    const depois = mercado.acesso_ccee.capturas.filter((c) => c.ultima_captura > publicacao.gerado_em);
    expect(depois.length).toBeGreaterThan(0);
    expect(e).toContain(`${depois.length} fontes da CCEE (conjuntos abertos e InfoMercado) foram capturadas depois dele`);
    expect(e).toContain(`a última captura é de ${carimbo(depois.map((c) => c.ultima_captura).sort().at(-1))}`);
    expect(e).toContain("A página Mercado já usa essas capturas; as contagens do catálogo e da saúde só as incluem na próxima atualização.");
  });

  it("a frase de captura posterior só aparece quando há captura posterior ao processamento", () => {
    const a = resumirAcessoCcee({ decisao: { decidida_em: "2026-10-06" }, capturas: [{ ultima_captura: "2026-09-30T10:00:00Z" }] }, "2026-10-01T11:22:00Z");
    expect(a.conjuntosCapturadosDepois).toBe(0);
    const t = textoDatasDaColetaCcee(a, "2026-10-01", "2026-10-01T11:22:00Z");
    expect(t).toContain("06/10/2026 é a data da decisão do responsável");
    expect(t).not.toContain("posterior ao processamento");
    expect(textoDatasDaColetaCcee({ decididaEm: null, ultimaCaptura: null, conjuntosCapturadosDepois: 0 }, "2026-10-01", "2026-10-01T11:22:00Z")).toBe("");
  });

  it("a limitação do início do registro junta a primeira captura, a reconstrução do histórico e a primeira revisão, lidas do calendário e da gold", () => {
    const calendario = pub.calendario;
    const primeira = calendario.filter((d) => d.capturas_novas + d.recapturas_sem_mudanca + d.falhas > 0).map((d) => d.dia).sort()[0];
    const revisao = calendario.filter((d) => d.observacoes_revisadas > 0).map((d) => d.dia).sort()[0];
    const t = limitacaoInicioDoRegistro(primeira, revisao, pub.proveniencia.saude.limitacoes);
    expect(t).toContain(`As primeiras capturas registradas são de ${dmy(primeira)}`);
    expect(t).toContain(`a primeira revisão de valores registrada é de ${dmy(revisao)}`);
    expect(t).toMatch(/foi reconstruído em 29 e 30\/09\/2026 e começa aí/);
    expect(entender(paginas.saude)).toContain(t);
    expect(limitacaoInicioDoRegistro(null, null, [])).toContain("Não há captura registrada");
  });
});

/* ---------------------------------------------------------------- funções de apoio */

describe("apoio: ressalvas, identificadores entre parênteses e leitura de CSV", () => {
  it("separa o identificador de conjunto e a frase do achado da auditoria", () => {
    const r = separaIdentificadores("CVU por usina térmica: integrado, validado e publicado (ons:cvu-usitermica).");
    expect(r.texto).toBe("CVU por usina térmica: integrado, validado e publicado.");
    expect(r.tecnico).toBe("(ons:cvu-usitermica)");
    const a = separaIdentificadores("Limites: não foram integrados. Integrados: Documentos (Submódulo 9.1) (ons:documentos-limites, publicado). Achado A06 (bloqueado): Não há recurso público.");
    expect(a.texto).toBe("Limites: não foram integrados. Integrados: Documentos (Submódulo 9.1).");
    expect(a.tecnico).toContain("(ons:documentos-limites, publicado)");
    expect(a.tecnico).toContain("Achado A06");
    const t = entender(paginas.metodologia);
    expect(t).not.toMatch(/ons:[\w-]+|Achado A\d+/);
    expect(entender(paginas.metodologia, true)).toContain("Achado A06");
  });

  it("lê CSV com aspas, com ponto e vírgula e aspas dentro do campo, sem confundir aspas no meio de um campo", () => {
    expect(lerCsvComAspas('a;b;c\n1;"x;y";3\n4;5"6;7\n')).toEqual([
      ["a", "b", "c"],
      ["1", "x;y", "3"],
      ["4", '5"6', "7"],
    ]);
    expect(lerCsvComAspas('a;b\n"linha ""com"" aspas";2')).toEqual([["a", "b"], ['linha "com" aspas', "2"]]);
    expect(lerCsvComAspas("﻿a;b\r\n1;2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(linhasCat.every((l) => l.length === csvCatalogo[0].length)).toBe(true);
  });

  it("nada novo de código usa travessão ou hífen como separador", () => {
    for (const f of [
      "src/lib/energia/dados-ficha.ts",
      "src/lib/energia/dados-leitor.ts",
      "src/lib/energia/dados-servidor.ts",
      "src/app/setor-eletrico/dados/[dataset]/page.tsx",
      "src/app/setor-eletrico/dados/page.tsx",
      "src/app/setor-eletrico/dados/saude/page.tsx",
      "src/app/setor-eletrico/dados/reproducao/page.tsx",
      "src/app/setor-eletrico/metodologia/page.tsx",
      "src/components/energia/DadosCatalogo.tsx",
      "src/components/energia/DadosPainel.tsx",
      "src/components/energia/DadosReproducao.tsx",
      "src/components/energia/DadosSaude.tsx",
    ]) {
      // os travessões que o código procura e troca (nome de conjunto da fonte) são escritos como escape, nunca como caractere
      expect(ler(f), f).not.toMatch(/[–—]/);
    }
  });
});
