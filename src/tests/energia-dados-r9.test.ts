import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MetodologiaPage from "@/app/setor-eletrico/metodologia/page";
import AvaliacaoPage from "@/app/setor-eletrico/metodologia/avaliacao/page";
import { DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import {
  COLUNAS_CATALOGO,
  COLUNAS_METRICAS,
  ESTADOS_ESCADA,
  ROTULO_ESTADO_DADOS,
  compactarLinhas,
  estadosAPartirDe,
  expandirLinhas,
  linhasCatalogo,
  linhasMetricas,
  resumoCatalogo,
  resumoSaude,
} from "@/lib/energia/dados";
import { contextoDoCatalogo, eTituloTecnico, fichasDasFontes } from "@/lib/energia/dados-ficha";
import { avisoDeSinal, textoChecagensReprovadas, textoEstadoDoArquivo, textoVersaoDoCodigo } from "@/lib/energia/dados-leitor";
import {
  contagemNoCsvDoCatalogo,
  estadoDoArquivo,
  manifestoDados,
  metricasPublicadas,
  publicacaoDados,
  validacoesDosCsv,
  versoesDoCodigoDasBases,
  type EstadoDoArquivo,
  type VersaoDoCodigo,
} from "@/lib/energia/dados-servidor";

/**
 * Rodada de migração de Dados e Metodologia: o catálogo em uma lista só com o estado mais avançado de cada conjunto (etapas cumulativas, nunca
 * fatias), o estado de cada arquivo para baixar, o sufixo +alterado, a porta de entrada por tarefa da Metodologia, a linhagem visual, o
 * exemplo reproduzível conferido com o arquivo que o leitor baixa e as fichas que cada regra de indicador cita.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const textoDe = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const cat = catalogoDados()!;
const pub = publicacaoDados()!;
const man = manifestoDados()!;
const metricas = metricasPublicadas();

const estadoFalso = (o: Partial<EstadoDoArquivo>): EstadoDoArquivo => ({ caminho: "/energia/series/exemplo.csv", veredito: "reprovado", problemas: [], releitura: null, outraVersao: null, ...o });

describe("catálogo: o estado mais avançado de cada conjunto e a escada cumulativa", () => {
  const fichas = new Set(DATASETS_INTEGRADOS.filter((d) => cat.entradas.some((e) => e.id === d.catalogoId)).map((d) => d.slug));
  const linhas = linhasCatalogo(cat, contextoDoCatalogo(cat, pub, fichas));
  const r = resumoCatalogo(cat);

  it("cada linha mostra um estado só, o mais avançado, e as etapas anteriores de um conjunto publicado valem todas", () => {
    expect(linhas).toHaveLength(cat.total);
    cat.entradas.forEach((e, i) => {
      expect(linhas[i].estado, e.id).toBe(ROTULO_ESTADO_DADOS[e.estado]);
      if (e.estado === "PUBLICADO") for (const k of ["verificado", "integrado", "validado", "publicado"]) expect(linhas[i][k], `${e.id}: ${k}`).toBe("sim");
    });
  });

  it("a contagem de cada etapa é cumulativa: as linhas que chegaram a ela fecham com o resumo, e as etapas não se somam ao total", () => {
    const chegaram = (campo: string) => linhas.filter((l) => l[campo] === "sim").length;
    expect(chegaram("publicado")).toBe(r.cumulativo.PUBLICADO);
    expect(chegaram("validado")).toBeGreaterThanOrEqual(r.cumulativo.PUBLICADO);
    expect(chegaram("integrado")).toBeGreaterThanOrEqual(chegaram("validado"));
    expect(chegaram("verificado")).toBeGreaterThanOrEqual(chegaram("integrado"));
    expect(r.cumulativo.CATALOGADO).toBe(cat.total);
    const somadas = ESTADOS_ESCADA.reduce((s, e) => s + r.cumulativo[e], 0);
    expect(somadas).toBeGreaterThan(cat.total);
    // e o estado exato, esse sim, fecha com o total
    expect(Object.values(r.exato).reduce((a, b) => a + b, 0)).toBe(cat.total);
  });

  it("'chegou a' é a lista da etapa em diante, e filtrar por ela devolve a contagem cumulativa", () => {
    expect(estadosAPartirDe("CATALOGADO")).toEqual(ESTADOS_ESCADA);
    expect(estadosAPartirDe("VALIDADO")).toEqual(["VALIDADO", "PUBLICADO"]);
    expect(estadosAPartirDe("PUBLICADO")).toEqual(["PUBLICADO"]);
    for (const e of ESTADOS_ESCADA) {
      const ate = new Set(estadosAPartirDe(e).map((s) => ROTULO_ESTADO_DADOS[s]));
      expect(linhas.filter((l) => ate.has(String(l.estado))).length, e).toBe(r.cumulativo[e]);
    }
  });

  it("o nome do conjunto é legível, a ficha só existe para quem tem página e o que não existe fica sem dado, nunca zero", () => {
    for (const l of linhas) {
      expect(eTituloTecnico(String(l.titulo)), String(l.id)).toBe(false);
      expect(l.ficha === "sim", String(l.id)).toBe(l.slug !== null);
      if (l.slug) expect(DATASETS_INTEGRADOS.some((d) => d.slug === l.slug), String(l.slug)).toBe(true);
      if (l.baixar !== null) expect(l.baixar, String(l.id)).toBeGreaterThan(0);
      if (l.recursos === null) expect(l.acessados, String(l.id)).toBeNull();
    }
    const colunas = new Set(COLUNAS_CATALOGO.map((c) => c.id));
    for (const l of linhas) for (const k of Object.keys(l)) expect(colunas.has(k) || ["n", "slug", "url", "id"].includes(k), k).toBe(true);
  });

  it("a matriz compacta devolve as mesmas linhas, com ausência como nulo", () => {
    const chaves = ["id", "n", "titulo", "estado", "periodo", "baixar"];
    const volta = expandirLinhas(compactarLinhas(linhas, chaves));
    expect(volta).toHaveLength(linhas.length);
    volta.forEach((l, i) => {
      for (const k of chaves) expect(l[k], `${linhas[i].id}: ${k}`).toEqual(linhas[i][k] === undefined ? null : linhas[i][k]);
    });
    const m = compactarLinhas([{ a: 1 }, { a: 2, b: "x" }], ["a", "b"]);
    expect(m.valores).toEqual([[1, null], [2, "x"]]);
  });
});

describe("regras por indicador: lista, matriz e fichas das fontes", () => {
  const linhas = linhasMetricas(metricas);

  it("a lista carrega os campos que a busca, os filtros e o detalhe usam, uma linha por indicador", () => {
    expect(linhas).toHaveLength(metricas.length);
    const ids = new Set(COLUNAS_METRICAS.map((c) => c.id));
    for (const k of ["titulo", "pergunta", "modulo", "natureza_fonte", "natureza_calculo", "unidade", "formula", "paginas"]) expect(ids.has(k), k).toBe(true);
    // a coluna de fórmula é só filtro: 'sim' e 'não' não entram na busca por texto
    expect(COLUNAS_METRICAS.find((c) => c.id === "formula")?.buscavel).toBe(false);
    expect(linhas.filter((l) => l.formula === "sim")).toHaveLength(metricas.filter((m) => m.formula).length);
  });

  it("cada fonte que uma regra cita resolve para a ficha do catálogo ou fica sem ficha, sem nome inventado", () => {
    const fontes = Array.from(new Set(metricas.reduce<string[]>((s, m) => s.concat(m.fontes), [])));
    const fichas = new Set(DATASETS_INTEGRADOS.map((d) => d.slug));
    const mapa = fichasDasFontes(fontes, cat, pub, fichas);
    const achadas = Object.keys(mapa);
    expect(achadas.length).toBeGreaterThan(fontes.length / 2);
    expect(achadas.length).toBeLessThan(fontes.length);
    for (const f of achadas) {
      expect(fichas.has(mapa[f].slug), f).toBe(true);
      expect(existsSync(join(raiz, "src/app/setor-eletrico/dados/[dataset]/page.tsx"))).toBe(true);
      expect(eTituloTecnico(mapa[f].nome), `${f}: ${mapa[f].nome}`).toBe(false);
      expect(mapa[f].nome, f).not.toMatch(/_/);
    }
    // uma fonte que o catálogo não conhece não ganha ficha
    expect(fichasDasFontes(["fonte_que_nao_existe"], cat, pub, fichas)).toEqual({});
    // sem ficha publicada para o endereço, a fonte também fica de fora
    expect(Object.keys(fichasDasFontes(fontes, cat, pub, new Set())).length).toBe(0);
  });
});

describe("estado de cada arquivo para baixar", () => {
  const vereditos = validacoesDosCsv();

  it("só os CSV publicados têm veredito; os demais arquivos e os CSV fora do relatório dizem isso, sem aprovar por omissão", () => {
    expect(estadoDoArquivo("/energia/gold/pld.json", pub, man).veredito).toBe("nao_se_aplica");
    expect(textoEstadoDoArquivo(estadoDoArquivo("/energia/gold/pld.json", pub, man)).frase).toBe("");
    const fora = estadoDoArquivo("/energia/series/arquivo_que_o_relatorio_nao_cobre.csv", pub, man);
    expect(fora.veredito).toBe("sem_validacao");
    expect(textoEstadoDoArquivo(fora).frase).toContain("não cobre este arquivo");
  });

  it("aprovado, com ressalva e reprovado têm a frase certa; o reprovado compara a impressão digital julgada com a publicada e relê o arquivo", () => {
    const por = (v: string) => Array.from(vereditos).filter((par) => par[1].veredito === v).map((par) => par[0]);
    const aprovado = por("aprovado")[0];
    expect(aprovado).toBeTruthy();
    expect(textoEstadoDoArquivo(estadoDoArquivo(`/energia/series/${aprovado}`, pub, man)).frase).toBe("Validação automática: aprovada.");
    const ressalva = por("ressalva")[0];
    if (ressalva) expect(textoEstadoDoArquivo(estadoDoArquivo(`/energia/series/${ressalva}`, pub, man)).frase).toContain("aprovada com ressalva");
    for (const nome of por("reprovado")) {
      const e = estadoDoArquivo(`/energia/series/${nome}`, pub, man);
      expect(e.veredito, nome).toBe("reprovado");
      expect(e.releitura, nome).not.toBeNull();
      const t = textoEstadoDoArquivo(e);
      expect(t.frase, nome).toContain("reprovada");
      if (e.outraVersao) {
        expect(e.outraVersao.julgada, nome).not.toBe(e.outraVersao.publicada);
        expect(t.frase, nome).toContain("o arquivo publicado é outra versão");
        expect(t.tecnico, nome).toContain(e.outraVersao.julgada);
        expect(t.tecnico, nome).toContain(e.outraVersao.publicada);
      }
      // a frase de leitor não leva nome de arquivo nem de campo
      expect(t.frase, nome).not.toMatch(/\.csv|_[a-z]/);
    }
  });

  it("os ramos da frase: mesma versão, outra versão com a releitura limpa e releitura que ainda diverge", () => {
    const problemas = [{ tipo: "esquema", resultado: "reprovado" as const, detalhe: "3 linhas com número de colunas diferente do cabeçalho" }];
    const mesma = textoEstadoDoArquivo(estadoFalso({ problemas, releitura: { linhas: 100, colunas: 8, divergentes: 0 } }));
    expect(mesma.frase).toContain("Validação automática: reprovada (3 linhas com número de colunas diferente do cabeçalho).");
    expect(mesma.frase).toContain("tem 8 colunas em todas as 100 linhas");
    const outra = textoEstadoDoArquivo(estadoFalso({ problemas, releitura: { linhas: 100, colunas: 8, divergentes: 0 }, outraVersao: { julgada: "a".repeat(64), publicada: "b".repeat(64), julgadaEm: "2026-10-01T11:22:00Z" } }));
    expect(outra.frase).toContain("reprovada na versão de 01/10/2026");
    expect(outra.tecnico).toContain("a".repeat(64));
    const diverge = textoEstadoDoArquivo(estadoFalso({ problemas, releitura: { linhas: 100, colunas: 8, divergentes: 2 } }));
    expect(diverge.frase).toContain("2 linhas com número de colunas diferente do cabeçalho, entre 100");
  });
});

describe("checagens reprovadas explicadas ao leitor", () => {
  const problemas = [{ tipo: "esquema", resultado: "reprovado" as const, detalhe: "18 linhas com número de colunas diferente do cabeçalho" }];
  const limpa = { linhas: 40, colunas: 6, divergentes: 0 };
  const outra = { julgada: "a".repeat(64), publicada: "b".repeat(64), julgadaEm: null };

  it("sem reprovação não há nota", () => {
    expect(textoChecagensReprovadas([], 0)).toEqual({ curta: "", frase: "", tecnico: "" });
    expect(textoChecagensReprovadas([estadoFalso({ veredito: "aprovado" })], 0).frase).toBe("");
  });

  it("arquivos reescritos depois da validação, com a releitura limpa, ficam ditos assim e nada é reaprovado", () => {
    const t = textoChecagensReprovadas([estadoFalso({ problemas, releitura: limpa, outraVersao: outra }), estadoFalso({ caminho: "/energia/series/outro.csv", problemas, releitura: limpa, outraVersao: outra })], 2);
    expect(t.curta).toBe("São de 2 arquivos reescritos depois da validação.");
    expect(t.frase).toContain("As 2 checagens reprovadas são de arquivos CSV: linhas com número de colunas diferente do cabeçalho.");
    expect(t.frase).toContain("a impressão digital que o relatório julgou é diferente da que está na lista de arquivos publicados");
    expect(t.frase).toContain("cada arquivo publicado tem o número de colunas do cabeçalho em todas as linhas");
    expect(t.frase).toContain("Nada foi reaprovado à mão");
    expect(t.tecnico).toContain("exemplo.csv");
    expect(t.tecnico).toContain("a".repeat(64));
  });

  it("a mesma versão julgada e a releitura que ainda diverge não são escondidas", () => {
    const t = textoChecagensReprovadas([estadoFalso({ problemas, releitura: { linhas: 40, colunas: 6, divergentes: 3 } })], 1);
    expect(t.frase).toContain("A checagem reprovada é de arquivos CSV");
    expect(t.frase).toContain("O relatório julgou a mesma versão que está publicada.");
    expect(t.frase).toContain("ainda tem linhas com número de colunas diferente do cabeçalho");
    expect(t.curta).toBe("1 arquivo reprovado; nenhum foi reescrito depois da validação.");
  });

  it("nos dados publicados, o número de arquivos reprovados fecha com as checagens que o relatório informa", () => {
    const reprovados = Array.from(validacoesDosCsv()).filter((par) => par[1].veredito === "reprovado");
    const checagens = reprovados.reduce((s, par) => s + par[1].problemas.filter((p) => p.resultado === "reprovado").length, 0);
    expect(checagens).toBe(pub.resumo.validacao.reprovado);
  });
});

describe("versão do código das bases e o sufixo +alterado", () => {
  const v = (arquivo: string, versao: string | null): VersaoDoCodigo => ({ arquivo, geradoEm: null, versao });

  it("conta as bases com o sufixo, as limpas e as sem versão, e explica o que o sufixo quer dizer", () => {
    const t = textoVersaoDoCodigo([v("a.json", "685bb4bc29fd+alterado"), v("b.json", "685bb4bc29fd+alterado"), v("c.json", "d3ad2c0ffee1"), v("d.json", null)]);
    expect(t.alterado).toBe(2);
    expect(t.limpas).toBe(1);
    expect(t.semVersao).toBe(1);
    expect(t.resumo).toContain("Das 4 bases publicadas, 2 foram geradas com código que tinha mudanças ainda não registradas (sufixo +alterado)");
    expect(t.resumo).toContain("1 com o código todo registrado e 1 sem versão de código registrada");
    expect(t.sufixo).toContain("refazê-la a partir dela pode dar um resultado diferente do publicado");
    expect(textoVersaoDoCodigo([v("a.json", "685bb4bc29fd+alterado")]).resumo).toContain("1 foi gerada");
  });

  it("lê o campo versao_codigo de cada base da lista de arquivos, e base sem o campo fica sem versão", () => {
    const bases = versoesDoCodigoDasBases(man);
    expect(bases.length).toBe(man.arquivos.filter((a) => a.tipo === "gold").length);
    expect(bases.map((b) => b.arquivo)).toEqual([...bases.map((b) => b.arquivo)].sort((x, y) => x.localeCompare(y)));
    for (const b of bases) if (b.versao !== null) expect(b.versao, b.arquivo).toMatch(/^[0-9a-f]{7,40}(\+alterado)?$/);
  });
});

describe("Metodologia: porta de entrada por tarefa, linhagem, exemplo reproduzível e lista de regras", () => {
  const h = renderToStaticMarkup(createElement(MetodologiaPage));
  const t = textoDe(h);

  it("o título é o da tela, a porta tem as três tarefas e a busca tem o mesmo parâmetro da lista", () => {
    expect(h).toMatch(/<h1[^>]*>Do arquivo ao número que você vê<\/h1>/);
    expect(h).toContain('data-tarefas=""');
    for (const x of ["Encontrar um indicador", "Ver a fórmula de um número", "Reproduzir um valor"]) expect(t, x).toContain(x);
    expect(h).toContain('name="reg.q"');
    expect(h).toContain("reg.f.formula=sim#regras");
    expect(ler("src/components/energia/MetodologiaTarefas.tsx")).toContain('param: "reg.q"');
    expect(ler("src/components/energia/MetodologiaRegras.tsx")).toContain('prefixo="reg"');
    expect(ler("src/components/energia/MetodologiaRegras.tsx")).toContain('paramAberto="m"');
    expect(ler("src/components/energia/MetodologiaTarefas.tsx")).toContain('param: "m"');
  });

  it("a ordem de leitura é a porta, a linhagem e a consulta das regras, depois natureza, unidades e limitações", () => {
    const ordem = ['id="tarefas"', 'id="linhagem"', 'id="regras"', 'id="natureza"', 'id="unidades"', 'id="limitacoes"', 'id="versao"'].map((x) => h.indexOf(x));
    ordem.forEach((p, i) => expect(p, String(i)).toBeGreaterThan(-1));
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("a linhagem visual tem cinco passos, cada um com o lugar de conferir, e o vocabulário de engenharia só em Analisar", () => {
    const li = h.match(/data-linhagem-visual=""[\s\S]*?<\/ol>/)?.[0].match(/<li/g) ?? [];
    expect(li).toHaveLength(5);
    const visual = h.match(/data-linhagem-visual=""[\s\S]*?<\/ol>/)![0];
    for (const href of ["/setor-eletrico/dados", "/setor-eletrico/dados/reproducao", "/setor-eletrico/dados/saude", "#regras"]) expect(visual, href).toContain(`href="${href}`);
    expect(textoDe(visual)).not.toMatch(/bronze|silver|gold|sha256|vintage|pipeline/i);
  });

  it("o exemplo reproduzível refaz a conta no arquivo que o leitor baixa e o resultado é o número publicado", () => {
    const c = contagemNoCsvDoCatalogo("PUBLICADO")!;
    expect(c.linhas).toBe(cat.total);
    expect(c.doEstado).toBe(resumoCatalogo(cat).cumulativo.PUBLICADO);
    expect(c.doEstado).toBe(pub.evidencias.conjuntos_publicados!.valor_calculo);
    expect(t).toContain(`Resultado: ${c.doEstado} de ${c.linhas} linhas.`);
    expect(t).toContain("É o mesmo número de Publicados no observatório");
    expect(h).toContain('data-passos="exemplo"');
    expect(h).toContain('href="/energia/series/dados_catalogo.csv"');
    expect(contagemNoCsvDoCatalogo("ESTADO_QUE_NAO_EXISTE")!.doEstado).toBe(0);
    expect(contagemNoCsvDoCatalogo("PUBLICADO", join(raiz, "pasta-que-nao-existe"))).toBeNull();
  });

  it("a nota das checagens reprovadas está na faixa e na seção própria, com o que a releitura mostra", () => {
    const reprovados = Array.from(validacoesDosCsv()).filter((par) => par[1].veredito === "reprovado").map((par) => estadoDoArquivo(`/energia/series/${par[0]}`, pub, man));
    const n = textoChecagensReprovadas(reprovados, pub.resumo.validacao.reprovado);
    expect(n.frase).not.toBe("");
    expect(t).toContain(n.curta);
    expect(t).toContain(n.frase);
    expect(h).toContain('id="checagens"');
  });

  it("a lista abre na primeira página, sem a regra de nenhum indicador no HTML, e a tabela completa fica em Analisar", () => {
    expect(h).toContain('data-componente="lista-consultavel" data-prefixo="reg"');
    expect((h.match(/data-lista="itens"[\s\S]*?<\/ol>/)?.[0].match(/data-id="/g) ?? []).length).toBe(10);
    expect(h).not.toContain("data-regra=");
    expect(h).toMatch(/id="tabela"[^>]*data-nivel="analisar"|data-nivel="analisar"[^>]*id="tabela"/);
    expect(t).toContain(`${metricas.length} indicadores`);
  });

  it("natureza, unidades, regra editorial, classificação, previsão e versão continuam na página, com as âncoras que o mapa usa", () => {
    for (const a of ["regras", "natureza", "unidades", "linhagem", "limitacoes", "classificacao", "sintese", "previsao", "versao", "editorial", "afirmacoes", "eixos"]) expect(h, a).toContain(`id="${a}"`);
    expect(t).toContain("Todo número exibido carrega um selo");
  });

  it("peso abaixo de 600 kB e sem valor de reserva", () => {
    expect(Buffer.byteLength(h, "utf-8")).toBeLessThan(600 * 1024);
    expect(h).not.toMatch(/NaN|undefined|\[object Object\]/);
  });
});

describe("Avaliação: faixa de métricas, matriz antes das notas e tabelas curtas", () => {
  const h = renderToStaticMarkup(createElement(AvaliacaoPage));

  it("o título é a pergunta da página, a faixa traz as quatro medidas com a prova em cada uma e a matriz vem antes das notas do painel", () => {
    expect(h).toMatch(/<h1[^>]*>Como demonstrar que a qualidade evoluiu\?<\/h1>/);
    expect(h).toContain('data-faixa-metricas=""');
    expect((h.match(/data-metrica=""/g) ?? []).length).toBe(4);
    expect(h.indexOf('data-matriz="aceite"')).toBeGreaterThan(-1);
    expect(h.indexOf('data-matriz="aceite"')).toBeLessThan(h.indexOf("data-notas-painel"));
    expect(h.indexOf("data-notas-painel")).toBeLessThan(h.indexOf('data-resposta="P071"'));
  });

  it("a lista de páginas cabe em páginas curtas e o HTML fica abaixo da meta", () => {
    expect(h).toContain('data-nivel="analisar"');
    expect(Buffer.byteLength(h, "utf-8")).toBeLessThan(600 * 1024);
  });
});

describe("aviso de troca de sinal na maior revisão", () => {
  it("só aparece quando o valor anterior é negativo e o novo, positivo, e não decide qual captura está certa", () => {
    const a = avisoDeSinal({ de: -668.879, para: 13984.696 });
    expect(a).toContain("O valor anterior é negativo");
    expect(a).toContain("pode ter vindo incompleta");
    expect(a).toContain("as duas continuam guardadas");
    expect(avisoDeSinal({ de: 10, para: 13 })).toBeNull();
    expect(avisoDeSinal({ de: -3, para: -1 })).toBeNull();
    expect(avisoDeSinal({ de: 3, para: -1 })).toBeNull();
    expect(avisoDeSinal(null)).toBeNull();
  });

  it("a gold publicada traz a carga do Nordeste de 26/09/2026 com valor anterior negativo, e a Saúde diz isso na linha do conjunto", () => {
    const comSinal = resumoSaude(pub).comRevisao.flatMap((c) => (c.revisoes?.maior_rel && avisoDeSinal(c.revisoes.maior_rel) ? [c] : []));
    expect(comSinal.length).toBeGreaterThanOrEqual(1);
    const ev = comSinal[0].revisoes!.maior_rel!;
    expect(ev.de).toBeLessThan(0);
    expect(ev.para).toBeGreaterThan(0);
  });
});
