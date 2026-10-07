import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DadosPage from "@/app/setor-eletrico/dados/page";
import SaudePage from "@/app/setor-eletrico/dados/saude/page";
import ReproducaoPage from "@/app/setor-eletrico/dados/reproducao/page";
import { RodapeEnergia } from "@/components/energia/RodapeEnergia";
import { listaEmPortugues, orgaosDasFontes } from "@/lib/energia/dados";
import MetodologiaPage from "@/app/setor-eletrico/metodologia/page";
import { NAO_SE_APLICA } from "@/lib/energia/escalas";
import { catalogoDados, commitDoBuild, urlVersaoGithub } from "@/lib/energia/datasets";
import {
  ESTADOS_ESCADA,
  ETAPAS,
  PAGINAS_DADOS,
  afirmacoesConferidas,
  conferirArquivo,
  conjuntosComRevisao,
  contagemCumulativa,
  evidenciaEtapas,
  inicioRegistroCapturas,
  janelaCalendario,
  lerCsv,
  linhasCatalogo,
  linhasManifesto,
  linhasMetricas,
  linhasRecursos,
  linhasSaude,
  matrizCalendario,
  moduloDoArquivo,
  naturezaCurta,
  resumoCatalogo,
  resumoMetricas,
  resumoSaude,
  situacaoEtapas,
  situacaoPorCadencia,
  urlVersao,
  MEDIDAS_CALENDARIO,
} from "@/lib/energia/dados";
import { conferirManifestoNoDisco, manifestoDados, metricasPublicadas, publicacaoDados } from "@/lib/energia/dados-servidor";
import type { EntradaDados } from "@/lib/energia/tipos-dados";
import { VIEW_SECTIONS } from "@/lib/telemetry";

/**
 * Dados e Metodologia, P067 a P070: escada do catálogo sem salto escondido, saúde e revisões
 * lidas das golds (a data do dado nunca renovada por falha), manifesto que bate com os arquivos
 * entregues, conferência de arquivo por sha256, regras por indicador completas, afirmações de
 * fonte integrada conferidas com o catálogo e as quatro páginas renderizadas no servidor sem
 * data crua e abaixo da meta de peso.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const cat = catalogoDados()!;
const pub = publicacaoDados()!;
const man = manifestoDados()!;
const metricas = metricasPublicadas();

const DATA_CRUA = /(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/;
const textoDe = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");
const rotaExiste = (href: string) => existsSync(join(raiz, "src/app", href.split("#")[0].split("?")[0], "page.tsx"));

describe("fontes de dados do módulo", () => {
  it("as golds estão íntegras e coerentes entre si", () => {
    expect(cat).toBeTruthy();
    expect(pub.disponivel).toBe(true);
    expect(man.disponivel).toBe(true);
    expect(metricas.length).toBeGreaterThan(200);
    expect(pub.catalogo.total).toBe(cat.total);
  });
});

describe("P067: catálogo e escada de estados", () => {
  const r = resumoCatalogo(cat);

  it("a escada é cumulativa: a primeira etapa vale o total, a última vale o publicado, e as pontas fecham com a contagem", () => {
    const c = contagemCumulativa(cat.contagem);
    expect(c.CATALOGADO).toBe(cat.total);
    expect(c.PUBLICADO).toBe(cat.contagem.PUBLICADO);
    for (let i = 1; i < ESTADOS_ESCADA.length; i++) expect(c[ESTADOS_ESCADA[i]], ESTADOS_ESCADA[i]).toBeLessThanOrEqual(c[ESTADOS_ESCADA[i - 1]]);
    expect(Object.values(r.exato).reduce((a, b) => a + b, 0)).toBe(cat.total);
    expect(r.cumulativo).toEqual(c);
  });

  it("nenhuma etapa vale sem as anteriores, e 'falhou' só aparece onde o pipeline registrou a falha do recurso", () => {
    for (const e of cat.entradas) {
      const s = situacaoEtapas(e);
      let anterior = true;
      for (const et of ETAPAS) {
        if (s[et.id] === "sim") expect(anterior, `${e.id}: ${et.id} sem a etapa anterior`).toBe(true);
        anterior = s[et.id] === "sim";
      }
      if (s.recurso_verificado === "falhou") expect(e.verificacao?.ok, e.id).toBe(false);
      expect(s.publicado === "sim", e.id).toBe(e.estado === "PUBLICADO");
    }
  });

  it("nenhum salto do catalogado para o uso fica sem aviso: todo conjunto em uso abaixo de publicado tem a ressalva escrita", () => {
    expect(r.usadasAbaixo.length).toBeGreaterThan(0);
    for (const e of r.usadasAbaixo) {
      expect(e.ressalvas?.length, e.id).toBeGreaterThan(0);
      expect(e.usado_em.length, e.id).toBeGreaterThan(0);
    }
    // e o contrário: quem é publicado alimenta alguma gold
    for (const e of cat.entradas.filter((x) => x.estado === "PUBLICADO")) expect(e.usado_em.length, e.id).toBeGreaterThan(0);
  });

  it("descontinuados identificados pela fonte, cada um com o critério e a evidência", () => {
    const d = cat.entradas.filter((e) => e.descontinuado);
    expect(d.length).toBe(cat.descontinuados);
    expect(pub.catalogo.descontinuados_lista.length).toBe(d.length);
    for (const e of d) {
      expect(e.descontinuacao?.motivo, e.id).toBeTruthy();
      expect(e.descontinuacao?.evidencia, e.id).toBeTruthy();
    }
    const ids = new Set(pub.catalogo.descontinuados_lista.map((x) => x.id));
    for (const e of d) expect(ids.has(e.id), e.id).toBe(true);
  });

  it("as linhas da tabela são uma por entrada, com id único e a posição que a ficha usa para ler a entrada completa", () => {
    const linhas = linhasCatalogo(cat);
    expect(linhas).toHaveLength(cat.total);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(cat.total);
    const bruto = JSON.parse(ler("public/energia/gold/catalogo.json")) as { entradas: EntradaDados[] };
    for (const l of linhas) {
      expect(bruto.entradas[Number(l.n)].id, String(l.id)).toBe(l.id);
      const e = cat.entradas[Number(l.n)];
      const s = situacaoEtapas(e);
      expect(l.etapas, String(l.id)).toBe(ETAPAS.filter((x) => s[x.id] === "sim").length);
    }
  });

  it("a evidência de cada etapa é escrita só com o que o catálogo publica; etapa não alcançada diz isso", () => {
    const publicado = cat.entradas.find((e) => e.estado === "PUBLICADO" && e.etapas?.integrado?.ok)!;
    const ev = evidenciaEtapas(publicado);
    expect(ev.map((x) => x.id)).toEqual(ETAPAS.map((x) => x.id));
    expect(ev.every((x) => x.situacao === "sim")).toBe(true);
    expect(ev[4].detalhe).toContain("alimenta");
    const falhou = cat.entradas.find((e) => e.verificacao?.ok === false && e.estado === "CATALOGADO")!;
    const evf = evidenciaEtapas(falhou);
    expect(evf[1].situacao).toBe("falhou");
    expect(evf[1].detalhe).toContain("sem êxito");
    expect(evf[2].situacao).toBe("nao");
    expect(evf[4].detalhe).toContain("não alimenta nenhuma gold");
  });

  it("recurso a recurso da CCEE: o CSV publicado fecha com a contagem do catálogo, estado por estado", () => {
    const csv = lerCsv(ler("public/energia/series/dados_recursos_ccee.csv"));
    expect(csv.length).toBe(cat.recursos.CCEE.total);
    const l = linhasRecursos(csv);
    expect(new Set(l.map((x) => x.id)).size).toBe(csv.length);
    for (const e of ESTADOS_ESCADA) {
      const n = csv.filter((x) => x.estado === e).length;
      expect(n, e).toBe(cat.recursos.CCEE.por_estado[e] ?? 0);
    }
  });
});

describe("P068: saúde e revisões", () => {
  const r = resumoSaude(pub);

  it("os resumos fecham com os números publicados pelo pipeline", () => {
    expect(r.integracoes).toBe(pub.conjuntos.length);
    expect(Object.values(r.porSituacao).reduce((a, b) => a + (b ?? 0), 0)).toBe(r.integracoes);
    expect(r.atrasados.length).toBe(r.porSituacao.ATRASADO ?? 0);
    expect(r.comRevisao.reduce((s, c) => s + (c.revisoes?.observacoes ?? 0), 0)).toBe(pub.resumo.observacoes_revisadas);
    expect(r.comFalha.length).toBeGreaterThanOrEqual(r.comFalhaRecente);
    const linhas = linhasSaude(pub);
    expect(linhas).toHaveLength(pub.conjuntos.length);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(linhas.length);
  });

  it("situação por cadência: soma o total e a tolerância é a da regra publicada", () => {
    const c = situacaoPorCadencia(pub);
    expect(c.reduce((s, x) => s + x.total, 0)).toBe(pub.conjuntos.length);
    for (const x of c) if (x.cadencia !== "sem") expect(x.tolerancia).toBe(pub.regras.sla[x.cadencia].tolerancia_dias);
    // sem cadência declarada só pode estar sem SLA
    const sem = c.find((x) => x.cadencia === "sem");
    expect(sem?.["SEM SLA"]).toBe(sem?.total);
  });

  it("falha de coleta nunca renova a data do dado: o prazo parte do fim do último período, e o último período não passa da maior referência", () => {
    for (const c of pub.conjuntos) {
      const a = c.atualidade;
      // medido pelo período de referência: o prazo parte do fim do último período; medido pela publicação da fonte
      // (casos D e E), parte da data de publicação informada pela fonte, nunca da captura
      if (a.prazo_proximo && a.fim_ultimo_periodo && a.base === "periodo_de_referencia") expect(a.prazo_proximo >= a.fim_ultimo_periodo, c.id).toBe(true);
      if (a.prazo_proximo && a.base === "publicacao_da_fonte" && c.capturas.ultima_publicacao_fonte) expect(a.prazo_proximo >= c.capturas.ultima_publicacao_fonte.slice(0, 10), c.id).toBe(true);
      if (a.ultimo_periodo && c.dado?.ref_max && c.dado.formato && c.dado.formato !== "nao_temporal" && c.dado.formato !== "misto") {
        expect(a.ultimo_periodo.slice(0, 7) <= c.dado.ref_max.slice(0, 7), c.id).toBe(true);
      }
      if (c.coleta.ultima_falha) {
        expect(c.coleta.falhas, c.id).toBeGreaterThan(0);
        expect(c.coleta.ultima_falha.detalhe, c.id).toBeTruthy();
      }
    }
    expect(pub.regras.falha).toContain("nunca renova a data do dado");
  });

  it("cada revisão traz as duas capturas, e a anterior continua guardada (regra publicada)", () => {
    const rev = conjuntosComRevisao(pub);
    expect(rev.length).toBe(r.comRevisao.length);
    for (const c of rev) {
      const e = c.revisoes!.maior_rel!;
      expect(e.capturado_de < e.capturado_para, c.id).toBe(true);
    }
    expect(pub.regras.revisao).toContain("entre capturas consecutivas do mesmo arquivo");
  });

  it("calendário: semanas começam na segunda, o dia sem registro antes da primeira captura é sem dado e depois dela é zero", () => {
    const hoje = pub.referencia.hoje;
    const janela = pub.referencia.janela_calendario_dias ?? 120;
    const ini = inicioRegistroCapturas(pub.calendario)!;
    for (const m of MEDIDAS_CALENDARIO) {
      const c = matrizCalendario(pub.calendario, hoje, janela, m.id);
      expect(c.dias).toHaveLength(7);
      expect(c.janela).toEqual(janelaCalendario(hoje, janela));
      expect(c.valores.every((l) => l.length === 7)).toBe(true);
      expect(new Date(`${c.semanas[0].id}T00:00:00Z`).getUTCDay(), m.id).toBe(1);
      const dentro = c.valores.flat().filter((v) => v !== NAO_SE_APLICA);
      expect(dentro, m.id).toHaveLength(janela);
      const soma = dentro.reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0);
      const esperada = pub.calendario
        .filter((d) => d.dia >= c.janela.inicio && d.dia <= hoje)
        .reduce((s, d) => s + Number(d[m.campo]), 0);
      expect(soma, m.id).toBe(esperada);
      if (m.deCaptura) {
        expect(dentro.filter((v) => v === null).length, m.id).toBe(Math.round((Date.parse(ini) - Date.parse(c.janela.inicio)) / 86_400_000));
      } else expect(dentro.every((v) => typeof v === "number"), m.id).toBe(true);
    }
  });
});

describe("P069: download e reprodução", () => {
  it("o manifesto é final e o sha256 e o tamanho de cada arquivo conferem com o arquivo entregue", () => {
    expect(man.completo).toBe(true);
    expect(man.fora_do_manifesto).toEqual([]);
    const c = conferirManifestoNoDisco(man);
    expect(c.divergentes).toEqual([]);
    expect(c.ausentes).toEqual([]);
    expect(c.conferidos).toBe(man.totais.arquivos);
    // os quatro arquivos que o orquestrador reescreve por último estão na lista
    for (const n of ["catalogo", "metricas", "arquivos", "meta"]) expect(man.arquivos.some((a) => a.caminho === `/energia/gold/${n}.json`), n).toBe(true);
  });

  it("o id da publicação é o sha256 da lista [caminho, bytes, sha256] em ordem de caminho", () => {
    const lista = [...man.arquivos].sort((a, b) => (a.caminho < b.caminho ? -1 : 1)).map((a) => [a.caminho, a.bytes, a.sha256]);
    expect(createHash("sha256").update(JSON.stringify(lista), "utf-8").digest("hex")).toBe(man.id_publicacao);
    expect(new Set(man.arquivos.map((a) => a.caminho)).size).toBe(man.arquivos.length);
    expect(man.totais.arquivos).toBe(man.arquivos.length);
  });

  it("os orquestradores regravam o manifesto final depois de reescrever os arquivos que o compõem", () => {
    expect(ler("pipeline/energia/run.py")).toContain("modulo_dados.escreve_manifesto(final=True)");
    expect(ler("pipeline/energia/executar_modulo.py")).toContain("modulo_dados.escreve_manifesto(final=True)");
    // depois de gravar meta.json no run.py, e depois de arquivos.json no executar_modulo.py
    const run = ler("pipeline/energia/run.py");
    expect(run.indexOf('base.escreve_gold("meta.json", meta)')).toBeLessThan(run.indexOf("escreve_manifesto(final=True)"));
    const um = ler("pipeline/energia/executar_modulo.py");
    expect(um.indexOf('base.escreve_gold("arquivos.json"')).toBeLessThan(um.indexOf("escreve_manifesto(final=True)"));
  });

  it("conferência de arquivo: igual pelo hash (qualquer nome), outra versão pelo nome, desconhecido", () => {
    const a = man.arquivos.find((x) => x.caminho.endsWith(".csv"))!;
    expect(conferirArquivo(a.sha256, "baixado (1).csv", man.arquivos).resultado).toBe("igual");
    expect(conferirArquivo(a.sha256.toUpperCase(), "x.bin", man.arquivos).resultado).toBe("igual");
    const outra = conferirArquivo("0".repeat(64), a.caminho.split("/").pop()!, man.arquivos);
    expect(outra.resultado).toBe("outra_versao");
    expect(conferirArquivo("0".repeat(64), "nao-publicado.csv", man.arquivos).resultado).toBe("desconhecido");
  });

  it("todo arquivo do manifesto tem módulo identificado; o Parquet herda o do CSV", () => {
    const dic = (JSON.parse(ler("public/energia/gold/arquivos.json")) as { arquivos: Record<string, { gold: string }> }).arquivos;
    for (const a of man.arquivos) expect(moduloDoArquivo(a.caminho, dic), a.caminho).not.toBe("módulo não identificado");
    const pq = man.arquivos.find((a) => a.caminho.endsWith("agua_ear_recortes_diario.parquet"))!;
    expect(moduloDoArquivo(pq.caminho, dic)).toBe("Água e clima");
    expect(linhasManifesto(man, dic)).toHaveLength(man.arquivos.length);
  });

  it("os Parquet publicados são equivalentes ao CSV e estão no manifesto junto do CSV", () => {
    expect(pub.arquivos.parquet.length).toBe(pub.resumo.parquet.arquivos);
    const caminhos = new Set(man.arquivos.map((a) => a.caminho));
    for (const p of pub.arquivos.parquet) {
      expect(p.equivalente, p.parquet).toBe(true);
      expect(caminhos.has(p.parquet), p.parquet).toBe(true);
      if (p.csv) expect(caminhos.has(p.csv), p.csv).toBe(true);
    }
  });

  it("a versão permanente segue a mesma regra da publicação: commit do build ou histórico do arquivo", () => {
    const c = "0123456789abcdef0123456789abcdef01234567";
    for (const caminho of ["/energia/series/pld_horario.csv", "energia/gold/pld.json"]) {
      expect(urlVersao(caminho, c)).toEqual(urlVersaoGithub(caminho, c));
      expect(urlVersao(caminho, null)).toEqual(urlVersaoGithub(caminho, null));
    }
    expect(urlVersao("/energia/x.csv", c).exata).toBe(true);
    expect(urlVersao("/energia/x.csv", null).exata).toBe(false);
  });
});

describe("P070: regras por indicador e afirmações", () => {
  it("todo indicador tem as regras completas e aponta páginas que existem", () => {
    const r = resumoMetricas(metricas);
    expect(r.total).toBe(metricas.length);
    expect(new Set(metricas.map((m) => m.id)).size).toBe(metricas.length);
    for (const m of metricas) {
      for (const k of ["titulo", "pergunta", "definicao", "unidade", "grao_geografico", "grao_temporal", "regra_agregacao", "regra_cobertura", "politica_ausencia", "arquivo"] as const) {
        expect(String(m[k]).trim(), `${m.id}.${k}`).not.toBe("");
      }
      expect(m.limitacoes.length, `${m.id}: limitações`).toBeGreaterThan(0);
      expect(m.validacoes.length, `${m.id}: validações`).toBeGreaterThan(0);
      expect(m.paginas.length, `${m.id}: páginas`).toBeGreaterThan(0);
      for (const p of m.paginas) expect(rotaExiste(p), `${m.id} → ${p}`).toBe(true);
    }
  });

  it("a posição da linha é a da regra no catálogo, que a ficha lê sob demanda", () => {
    const bruto = (JSON.parse(ler("public/energia/gold/metricas.json")) as { metricas: { id: string }[] }).metricas;
    const l = linhasMetricas(metricas);
    expect(l).toHaveLength(bruto.length);
    for (const x of l) expect(bruto[Number(x.n)].id, String(x.id)).toBe(x.id);
  });

  it("natureza curta: acento no cenário e natureza mista sem duplicar o texto da ficha", () => {
    expect(naturezaCurta("CENARIO")).toBe("Cenário");
    expect(naturezaCurta("OBSERVADO")).toBe("Observado");
    expect(naturezaCurta("MISTO: OBSERVADO (usinas) e ESTIMADO (MMGD do ONS)")).toBe("Mista");
    expect(naturezaCurta("OBSERVADO e PREVISTO")).toBe("Mista");
  });

  it("cada afirmação sobre fonte integrada corresponde a conjunto com recurso verificado, no estado que o catálogo registra", () => {
    const a = afirmacoesConferidas(pub);
    expect(a.length).toBeGreaterThanOrEqual(8);
    for (const x of a) {
      expect(x.conferida, `${x.afirmacao.id}: ${x.motivo}`).toBe(true);
      for (const c of x.afirmacao.conjuntos) {
        const e = cat.entradas.find((y) => y.id === c.id);
        expect(e, c.id).toBeTruthy();
        expect(e!.estado, c.id).toBe(c.estado);
        expect(ESTADOS_ESCADA.indexOf(e!.estado), c.id).toBeGreaterThanOrEqual(ESTADOS_ESCADA.indexOf("RECURSO VERIFICADO"));
      }
    }
  });

  it("limites de intercâmbio: a frase diz que não há conjunto público estruturado e guarda a afirmação corrigida", () => {
    const l = pub.afirmacoes.find((x) => x.id === "limites_intercambio")!;
    expect(l.texto).toContain("não há conjunto público estruturado");
    expect(l.texto).toContain("não foram integrados");
    expect(l.afirmacao_anterior).toBe("A metodologia afirmava que os limites de intercâmbio estavam catalogados.");
  });
});

describe("páginas P067 a P070", () => {
  const paginas = {
    catalogo: renderToStaticMarkup(createElement(DadosPage)),
    saude: renderToStaticMarkup(createElement(SaudePage)),
    reproducao: renderToStaticMarkup(createElement(ReproducaoPage)),
    metodologia: renderToStaticMarkup(createElement(MetodologiaPage)),
  };
  const resposta = { catalogo: "P067", saude: "P068", reproducao: "P069", metodologia: "P070" } as const;

  it("anatomia: resposta, recorte, prova, tabela, download, link e próxima pergunta; os três modos", () => {
    for (const [id, h] of Object.entries(paginas)) {
      expect(h, id).toContain(`data-resposta="${resposta[id as keyof typeof resposta]}"`);
      for (const t of ["Período", "Universo", "Unidade", "Comprove este número", "Como interpretar", "O que não é possível concluir", "Copiar link deste painel", "Próxima pergunta", "Baixar os dados deste painel", "Baixar CSV"]) {
        expect(h, `${id}: ${t}`).toContain(t);
      }
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      expect(h, id).toContain("Painéis de Dados e Metodologia");
      expect(h, id).not.toMatch(/\(em preparação\)/);
    }
  });

  it("a navegação entre os quatro painéis aponta rotas que existem, e cada painel marca a sua página", () => {
    for (const p of PAGINAS_DADOS) {
      expect(rotaExiste(p.href), p.href).toBe(true);
      for (const h of Object.values(paginas)) expect(h).toContain(`href="${p.href}"`);
    }
    expect(paginas.catalogo).toMatch(/aria-current="page"[^>]*>\s*Catálogo/);
    expect(paginas.saude).toMatch(/aria-current="page"[^>]*>\s*Saúde e revisões/);
    expect(paginas.reproducao).toMatch(/aria-current="page"[^>]*>\s*Download e reprodução/);
    expect(paginas.metodologia).toMatch(/aria-current="page"[^>]*>\s*Metodologia/);
    for (const s of ["energia:dados:saude", "energia:dados:reproducao"]) expect(VIEW_SECTIONS).toContain(s);
  });

  it("sem valor de reserva, sem data crua no texto, sem 'hoje' para a situação das fontes e abaixo da meta de peso", () => {
    for (const [id, h] of Object.entries(paginas)) {
      expect(h, id).not.toMatch(/NaN|undefined|\[object Object\]/);
      expect(textoDe(h), id).not.toMatch(DATA_CRUA);
      expect(Buffer.byteLength(h, "utf-8"), id).toBeLessThan(600 * 1024);
    }
    // a situação vale para a data de referência da publicação
    expect(textoDe(paginas.saude)).toContain(`situação em ${pub.referencia.hoje.split("-").reverse().join("/")}`);
    const jan = janelaCalendario(pub.referencia.hoje, pub.referencia.janela_calendario_dias ?? 120);
    expect(textoDe(paginas.saude)).toContain(`calendário de ${jan.inicio.split("-").reverse().join("/")} a ${jan.fim.split("-").reverse().join("/")}`);
    expect(textoDe(paginas.saude)).not.toMatch(/em dia hoje|atrasado hoje|estão em dia hoje/i);
  });

  it("P067: a escada, os conjuntos em uso abaixo de publicado com a ressalva e os descontinuados", () => {
    const h = paginas.catalogo;
    for (const s of ESTADOS_ESCADA) expect(h).toContain(`data-estado="${s}"`);
    const r = resumoCatalogo(cat);
    expect((h.match(/data-lista="em-uso-abaixo"[\s\S]*?<\/ul>/)?.[0].match(/<li/g) ?? []).length).toBe(r.usadasAbaixo.length);
    expect(h).toContain("Em uso, mas abaixo de publicado");
    expect((h.match(/data-lista="descontinuados"[\s\S]*?<\/ul>/)?.[0].match(/<li/g) ?? []).length).toBe(cat.descontinuados);
    expect(h).toContain("Recurso a recurso");
  });

  it("P068: calendário, revisões com as duas capturas, falhas e regras de SLA", () => {
    const h = paginas.saude;
    expect(h).toContain("Calendário de atualização e mudanças");
    expect((h.match(/data-lista="revisoes"[\s\S]*?<\/ul>/)?.[0].match(/<li/g) ?? []).length).toBe(conjuntosComRevisao(pub).length);
    expect(h).toContain("Falhas de coleta: a data do dado não é renovada");
    expect(textoDe(h)).toContain("tolerância");
    expect(h).toContain("Regras de atualidade, completude e revisão");
  });

  it("P069: conferência de arquivo no navegador, manifesto, Parquet e passos de reprodução", () => {
    const h = paginas.reproducao;
    expect(h).toContain('data-conferencia="arquivo"');
    expect(h).toContain('type="file"');
    expect(h).toContain(man.id_publicacao.slice(0, 12));
    expect(h).toContain('data-passos="reproducao"');
    expect(h).toContain("Formato colunar");
    expect(h).toContain(pub.reproducao.passos[1].replace(/&/g, "&amp;").replace(/'/g, "&#x27;").slice(0, 30));
    // o arquivo conferido não é enviado: não há envio de arquivo no componente
    const t = ler("src/components/energia/DadosReproducao.tsx");
    expect(t).not.toMatch(/FormData|XMLHttpRequest|sendBeacon|method:\s*"POST"/);
  });

  it("P070: regras por indicador, afirmações com a correção e as seções antigas com as âncoras que o mapa usa", () => {
    const h = paginas.metodologia;
    expect(h).toContain("Regras por indicador");
    expect(h).toContain("Afirmações sobre fontes integradas, conferidas com o catálogo");
    expect(h).toContain("A metodologia afirmava que os limites de intercâmbio estavam catalogados.");
    expect(h).toContain("Correção");
    expect((h.match(/data-afirmacao="/g) ?? []).length).toBe(pub.afirmacoes.length);
    for (const a of ["regras", "natureza", "unidades", "linhagem", "classificacao", "limitacoes", "versao", "afirmacoes", "eixos"]) expect(h, a).toContain(`id="${a}"`);
  });

  it("as limitações gerais não repetem o que deixou de ser verdade", () => {
    const t = textoDe(paginas.metodologia).replace(/\s+/g, " ");
    expect(t).not.toContain("não foram auditados");
    expect(t).not.toContain("negou acesso a requisições automatizadas em tentativas manuais");
    expect(t).not.toContain("fontes primárias (CCEE, legislação) não foram acessadas");
    expect(t).toContain("autorizada pelo responsável em 06/10/2026");
    expect(t).toContain("painel de limites da Regulação");
    expect(t).toMatch(/\d+ verbetes do Aprenda aparecem em preparação/);
  });

  it("copia nova sem travessão nem hífen usado como pontuação", () => {
    for (const f of [
      "src/app/setor-eletrico/dados/page.tsx",
      "src/app/setor-eletrico/dados/saude/page.tsx",
      "src/app/setor-eletrico/dados/reproducao/page.tsx",
      "src/app/setor-eletrico/metodologia/page.tsx",
      "src/components/energia/DadosCatalogo.tsx",
      "src/components/energia/DadosSaude.tsx",
      "src/components/energia/DadosReproducao.tsx",
      "src/components/energia/MetodologiaRegras.tsx",
      "src/components/energia/DadosPainel.tsx",
      "src/components/energia/DadosEscada.tsx",
    ]) {
      const t = ler(f);
      expect(t, f).not.toMatch(/[—–]/);
    }
  });
});

describe("integração com o commit do build", () => {
  it("sem variável de ambiente, o build não conhece o commit e a página aponta o histórico do arquivo", () => {
    expect(commitDoBuild({})).toBeNull();
  });
});

describe("fontes citadas no rodapé do observatório", () => {
  it("os órgãos vêm das integrações publicadas, do que tem mais conjuntos para o que tem menos", () => {
    const pub = { conjuntos: [{ orgao: "ONS" }, { orgao: "ANEEL" }, { orgao: "ANEEL" }, { orgao: "CCEE" }, { orgao: "ONS" }, { orgao: "ANEEL" }] } as Parameters<typeof orgaosDasFontes>[0];
    expect(orgaosDasFontes(pub)).toEqual([
      { orgao: "ANEEL", conjuntos: 3 },
      { orgao: "ONS", conjuntos: 2 },
      { orgao: "CCEE", conjuntos: 1 },
    ]);
    expect(orgaosDasFontes(null)).toEqual([]);
  });
  it("lista em português", () => {
    expect(listaEmPortugues([])).toBe("");
    expect(listaEmPortugues(["ONS"])).toBe("ONS");
    expect(listaEmPortugues(["ONS", "CCEE"])).toBe("ONS e CCEE");
    expect(listaEmPortugues(["ONS", "CCEE", "ANEEL"])).toBe("ONS, CCEE e ANEEL");
  });
  it("o rodapé cita todos os órgãos da publicação e a data da publicação, não a do meta.json antigo", () => {
    const html = renderToStaticMarkup(createElement(RodapeEnergia));
    const pub = JSON.parse(readFileSync(join(process.cwd(), "public/energia/gold/publicacao.json"), "utf-8")) as { conjuntos: { orgao: string }[]; gerado_em: string };
    Array.from(new Set(pub.conjuntos.map((c) => c.orgao))).forEach((o) => expect(html, o).toContain(o));
    expect(html).toContain("Catálogo e manifesto publicados em");
    expect(html).not.toContain("Dados processados em");
  });
});
