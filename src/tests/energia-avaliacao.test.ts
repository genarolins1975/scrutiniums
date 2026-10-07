import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AvaliacaoPage from "@/app/setor-eletrico/metodologia/avaliacao/page";
import {
  COLUNAS_DEFEITOS,
  COLUNAS_PAGINAS,
  ESCALA_AVALIACAO,
  compararRodadas,
  ORDEM_DIMENSOES,
  dadosPorDimensao,
  linhasDefeitos,
  linhasPaginas,
  matrizModulos,
  metaDaDimensao,
  respostaAvaliacao,
  textoNota,
  textoDeducao,
} from "@/lib/energia/avaliacao";
import { avaliacaoPublicada } from "@/lib/energia/avaliacao-servidor";
import { PAGINAS_DADOS } from "@/lib/energia/dados";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { VIEW_SECTIONS } from "@/lib/telemetry";
import type { AvaliacaoGold, NotaDimensao } from "@/lib/energia/tipos-avaliacao";

/**
 * P071, avaliação dos painéis. Os testes protegem o que a página promete: nota só com evidência,
 * dimensão sem teste que aparece como não avaliada (nunca zero), teto respeitado, média
 * ponderada que confere, revisão por agente que não se apresenta como teste com usuários e a
 * página renderizada no servidor sem data crua, sem valor de reserva e abaixo da meta de peso.
 */
const raiz = process.cwd();
const a = avaliacaoPublicada() as AvaliacaoGold;
const DATA_CRUA = /(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/;
const textoDe = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");
const TRAVESSAO = /[–—]/;

const nota = (n: number | null, estado: NotaDimensao["estado"] = "avaliada"): NotaDimensao => ({ nota: n, estado, evidencias: [], deducoes: [], tetos: [], defeitos: [] });

describe("derivações puras", () => {
  it("o estado da dimensão nunca vira zero no texto", () => {
    expect(textoNota(nota(9.3))).toBe("9,3");
    expect(textoNota(nota(0))).toBe("0,0");
    expect(textoNota(nota(null, "nao_avaliada"))).toBe("não avaliada");
    expect(textoNota(nota(null, "nao_aplicavel"))).toBe("não se aplica");
  });

  it("dedução em pontos com vírgula decimal", () => {
    expect(textoDeducao({ pontos: 2, motivo: "axe" })).toBe("menos 2: axe");
    expect(textoDeducao({ pontos: 0.15, motivo: "ressalva" })).toBe("menos 0,15: ressalva");
  });

  it("a escala da matriz tem uma cor e um rótulo por faixa", () => {
    expect(ESCALA_AVALIACAO.cores.length).toBe(ESCALA_AVALIACAO.limites.length + 1);
    expect(ESCALA_AVALIACAO.rotulos.length).toBe(ESCALA_AVALIACAO.cores.length);
    expect([...ESCALA_AVALIACAO.limites].sort((x, y) => x - y)).toEqual([...ESCALA_AVALIACAO.limites]);
  });

  it("colunas das tabelas com id único e uma coluna por dimensão", () => {
    for (const cols of [COLUNAS_PAGINAS, COLUNAS_DEFEITOS]) expect(new Set(cols.map((c) => c.id)).size).toBe(cols.length);
    for (const i of ORDEM_DIMENSOES) expect(COLUNAS_PAGINAS.map((c) => c.id)).toContain(i);
  });

  it.skipIf(!a)("tabela de páginas: dimensão não avaliada é célula sem dado, não zero", () => {
    expect(a).toBeTruthy();
    const linhas = linhasPaginas(a);
    expect(linhas.length).toBe(a.paginas.length);
    linhas.forEach((l, k) => {
      for (const i of ORDEM_DIMENSOES) {
        const x = a.paginas[k].dimensoes[i];
        if (x.estado === "avaliada") expect(l[i], `${l.rota} ${i}`).toBe(x.nota);
        else expect(l[i], `${l.rota} ${i}`).toBeNull();
      }
    });
  });

  it.skipIf(!a)("tabela de defeitos tem uma linha por defeito aberto", () => {
    expect(linhasDefeitos(a.defeitos).length).toBe(a.defeitos.length);
  });
});

describe.skipIf(!a)("gold avaliacao.json", () => {
  it("existe, está disponível e declara a rubrica e a rodada", () => {
    expect(a.disponivel).toBe(true);
    expect(a.painel).toBe("P071");
    expect(a.rodada.id).toBeTruthy();
    expect(a.rodada.rotas_medidas).toBe(a.paginas.length);
    expect(a.rubrica.dimensoes.map((d) => d.id)).toEqual(ORDEM_DIMENSOES);
  });

  it("pesos da seção 15.1 somam 100 e as metas são as da especificação", () => {
    const p = Object.fromEntries(a.rubrica.dimensoes.map((d) => [d.id, d.peso]));
    expect(Object.values(p).reduce((s, v) => s + v, 0)).toBe(100);
    expect(p).toMatchObject({ didatismo: 15, visual: 12, navegacao: 10, interatividade: 8, acessibilidade: 7, completude: 12, correcao: 15, rastreabilidade: 10, atualidade: 6, desempenho: 5 });
    expect(a.rubrica.metas).toEqual({ geral: 9, didatismo: 9.5, visual: 9.5 });
  });

  it("toda página tem as dez dimensões; nota existe só com evidência e fica no teto", () => {
    for (const p of a.paginas) {
      expect(Object.keys(p.dimensoes).sort(), p.rota).toEqual([...ORDEM_DIMENSOES].sort());
      for (const i of ORDEM_DIMENSOES) {
        const x = p.dimensoes[i];
        if (x.estado === "avaliada") {
          expect(x.nota, `${p.rota} ${i}`).not.toBeNull();
          expect(x.nota!).toBeGreaterThanOrEqual(0);
          expect(x.nota!).toBeLessThanOrEqual(10);
          expect(Math.round(x.nota! * 10) / 10, `${p.rota} ${i}: uma casa decimal`).toBe(x.nota);
          expect(x.evidencias.length, `${p.rota} ${i}: nota sem evidência`).toBeGreaterThan(0);
          for (const t of x.tetos) expect(x.nota!, `${p.rota} ${i}: acima do teto`).toBeLessThanOrEqual(t.valor + 1e-9);
          if (x.partida !== undefined) expect(x.nota!).toBeLessThanOrEqual(x.partida + 1e-9);
        } else {
          expect(x.nota, `${p.rota} ${i}`).toBeNull();
          expect(x.evidencias.length, `${p.rota} ${i}: o motivo do estado fica escrito`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("acessibilidade, correção, rastreabilidade, atualidade e desempenho nunca chegam a 10", () => {
    for (const p of a.paginas)
      for (const i of ["acessibilidade", "correcao", "rastreabilidade", "atualidade", "desempenho"] as const) {
        const x = p.dimensoes[i];
        if (x.estado === "avaliada") expect(x.nota!, `${p.rota} ${i}`).toBeLessThan(10);
      }
  });

  it("a nota ponderada de cada página confere com os pesos e ignora o que não se aplica", () => {
    const peso = Object.fromEntries(a.rubrica.dimensoes.map((d) => [d.id, d.peso]));
    for (const p of a.paginas) {
      const av = ORDEM_DIMENSOES.filter((i) => p.dimensoes[i].estado === "avaliada");
      const esperado = av.length ? Math.floor((av.reduce((s, i) => s + peso[i] * p.dimensoes[i].nota!, 0) / av.reduce((s, i) => s + peso[i], 0)) * 10 + 1e-6) / 10 : null;
      expect(p.nota_ponderada, p.rota).toBe(esperado);
    }
  });

  it("atender a meta exige todas as dimensões aplicáveis avaliadas, nota na meta e nenhum defeito crítico", () => {
    const criticos = new Set(a.defeitos.filter((d) => d.severidade === "critico").map((d) => d.id));
    for (const p of a.paginas) {
      const falta = ORDEM_DIMENSOES.some((i) => p.dimensoes[i].estado === "nao_avaliada" || (p.dimensoes[i].estado === "avaliada" && p.dimensoes[i].nota! < metaDaDimensao(a, i)));
      const critico = p.defeitos.some((d) => criticos.has(d));
      expect(p.atende_meta, p.rota).toBe(!falta && !critico);
      expect(p.completa, p.rota).toBe(!ORDEM_DIMENSOES.some((i) => p.dimensoes[i].estado === "nao_avaliada"));
    }
  });

  it("o resumo e os módulos fecham com as páginas", () => {
    expect(a.resumo.paginas).toBe(a.paginas.length);
    expect(a.resumo.atendem_meta).toBe(a.paginas.filter((p) => p.atende_meta).length);
    expect(a.modulos.reduce((s, m) => s + m.paginas, 0)).toBe(a.paginas.length);
    for (const m of a.modulos) expect(m.rotas.every((r) => a.paginas.find((p) => p.rota === r)?.modulo === m.id), m.id).toBe(true);
    expect(a.resumo.defeitos.abertos).toBe(a.defeitos.length);
    expect(Object.values(a.resumo.defeitos.por_severidade).reduce((s, v) => s + v, 0)).toBe(a.defeitos.length);
    for (const d of a.defeitos) for (const r of d.paginas) expect(a.paginas.some((p) => p.rota === r), `${d.id} → ${r}`).toBe(true);
    for (const i of ORDEM_DIMENSOES) {
      const r = a.resumo.por_dimensao[i];
      expect(r.avaliadas + r.nao_avaliadas + r.nao_aplicaveis, i).toBe(a.paginas.length);
    }
  });

  it("matriz de aceite: uma linha por entrega e uma coluna por dimensão, célula sem nota só quando nenhuma página tem nota", () => {
    const m = matrizModulos(a);
    expect(m.linhas.length).toBe(a.modulos.length);
    expect(m.colunas.length).toBe(10);
    m.valores.forEach((linha, k) => {
      linha.forEach((v, j) => {
        const d = a.modulos[k].dimensoes[m.ids[j]];
        expect(v === null, `${a.modulos[k].id} ${m.ids[j]}`).toBe(d.avaliadas === 0);
      });
    });
    expect(dadosPorDimensao(a).length).toBe(10);
  });

  it("são dez jornadas, cada uma com passos, resultado coerente e sem se chamar teste com usuários", () => {
    expect(a.jornadas.map((j) => j.id)).toEqual(["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10"]);
    for (const j of a.jornadas) {
      expect(j.passos.length, j.id).toBeGreaterThan(2);
      expect(j.passos_total, j.id).toBe(j.passos.length);
      expect(j.passos_ok, j.id).toBe(j.passos.filter((p) => p.resultado === "ok").length);
      if (j.resultado === "cumprida") expect(j.passos.every((p) => p.resultado === "ok"), j.id).toBe(true);
      else expect(j.passos.some((p) => p.resultado === "falhou"), j.id).toBe(true);
    }
    const textos = JSON.stringify([a.limites, a.metodo]);
    expect(textos).toMatch(/não é teste com pessoas/);
    expect(textos).not.toMatch(/teste com usuários reais/);
  });

  it("as fichas do Comprove passam na validação de evidência e conferem com o resumo", () => {
    for (const [k, e] of Object.entries(a.evidencias)) expect(problemasEvidencia(e), k).toEqual([]);
    expect(a.evidencias.atendem_meta.valor_calculo).toBe(a.resumo.atendem_meta);
    expect(a.evidencias.defeitos.valor_calculo).toBe(a.resumo.defeitos.abertos);
    expect(a.evidencias.nota_media.valor_calculo).toBe(a.resumo.nota_ponderada_media);
  });

  it("o texto publicado não usa travessão e a resposta não diz hoje", () => {
    expect(JSON.stringify([a.rubrica, a.metodo, a.limites, a.jornadas.map((j) => [j.titulo, j.perfil])])).not.toMatch(TRAVESSAO);
    const r = respostaAvaliacao(a);
    expect(r).not.toMatch(TRAVESSAO);
    expect(r).not.toMatch(/\bhoje\b/i);
    expect(r).toContain(a.rodada.id);
  });

  it("a revisão publica o método, os nove revisores e os problemas transversais; a correção posterior fica declarada", () => {
    expect(a.revisao.revisores.length).toBeGreaterThan(0);
    expect(a.revisao.revisores.reduce((s, r) => s + r.paginas, 0)).toBeGreaterThanOrEqual(a.paginas.filter((p) => p.dimensoes.didatismo.estado === "avaliada").length);
    for (const r of a.revisao.revisores) expect(a.revisao.problemas_entre_paginas[r.id]?.length, r.id).toBeGreaterThan(0);
    expect(a.revisao.metodo).toMatch(/não é teste com pessoas/);
    expect(Array.isArray(a.rodada.corrigido_depois_da_medicao)).toBe(true);
    expect(JSON.stringify(a.revisao)).not.toMatch(TRAVESSAO);
  });

  it("a rodada anterior fica resumida e a evolução só é afirmada quando existe rodada anterior", () => {
    expect(a.rodadas.length).toBeGreaterThan(0);
    expect(a.rodadas[a.rodadas.length - 1].id).toBe(a.rodada.id);
    if (a.rodadas.length === 1) expect(respostaAvaliacao(a)).toMatch(/primeira rodada registrada/);
    else {
      expect(respostaAvaliacao(a)).toMatch(/Em relação à rodada/);
      const c = compararRodadas(a);
      // a comparação usa só dimensões avaliadas nas duas rodadas
      for (const i of c?.comuns ?? []) {
        expect(c!.anterior.medias_por_dimensao[i], i).not.toBeNull();
        expect(a.resumo.por_dimensao[i].media, i).not.toBeNull();
      }
    }
  });
});

describe.skipIf(!a)("página /setor-eletrico/metodologia/avaliacao", () => {
  const html = renderToStaticMarkup(createElement(AvaliacaoPage));

  it("renderiza a anatomia do painel com resposta, números, matriz, Comprove, download, link e próxima pergunta", () => {
    for (const t of [
      "Como demonstrar que a qualidade evoluiu?",
      'data-resposta="P071"',
      "Comprove a nota média",
      "Comprove as páginas na meta",
      "Comprove os defeitos",
      'data-matriz="aceite"',
      "Matriz de aceite e evidência",
      "Período",
      "Universo",
      "Unidade",
      "Como interpretar",
      "O que não é possível concluir",
      "Copiar link deste painel",
      "Próxima pergunta",
      "Baixar os dados deste painel",
      "Painéis de Dados e Metodologia",
      'data-nivel="analisar"',
      'data-nivel="auditar"',
    ])
      expect(html, t).toContain(t);
  });

  it("a matriz tem uma linha por entrega e mostra n.av. só quando falta nota", () => {
    const linhas = html.match(/data-entrega="/g) ?? [];
    expect(linhas.length).toBe(a.modulos.length);
    const semNota = matrizModulos(a).valores.flat().some((v) => v === null);
    expect(/>n\.(av|ap)\.</.test(html)).toBe(semNota || a.modulos.some((m) => m.nota_ponderada === null));
  });

  it("a navegação de Dados e Metodologia inclui a avaliação e marca a página atual", () => {
    const p = PAGINAS_DADOS.find((x) => x.id === "avaliacao")!;
    expect(p.painel).toBe("P071");
    expect(existsSync(join(raiz, "src/app", p.href, "page.tsx"))).toBe(true);
    expect(html).toMatch(/aria-current="page"[^>]*>\s*Avaliação dos painéis/);
    expect(VIEW_SECTIONS).toContain("energia:dados:avaliacao");
  });

  it("deixa claro que a revisão é de agentes, que as jornadas são roteiro e que a escala não é certificação", () => {
    const t = textoDe(html);
    expect(t).toMatch(/revisores em contexto limpo/);
    expect(t).toMatch(/não é teste com pessoas/);
    expect(t).toMatch(/não uma certificação externa/);
    expect(t).toMatch(/roteiro por script/);
  });

  it("sem valor de reserva, sem data crua, sem travessão, sem hoje e abaixo da meta de peso", () => {
    expect(html).not.toMatch(/NaN|undefined|\[object Object\]/);
    const t = textoDe(html);
    expect(t).not.toMatch(DATA_CRUA);
    expect(t).not.toMatch(TRAVESSAO);
    // "hoje" é vetado na fala da própria página (resposta, destaques, dimensões e páginas). Defeitos, jornadas e rubrica citam o texto
    // observado ou nomeiam a regra ("frase com número e a palavra hoje"), e por isso ficam fora desta conferência.
    const corte = html.indexOf('id="defeitos"');
    expect(corte).toBeGreaterThan(0);
    expect(textoDe(html.slice(0, corte))).not.toMatch(/\bhoje\b/i);
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(600 * 1024);
  });

  it("os números de destaque saem do resumo da gold", () => {
    const t = textoDe(html).replace(/\s+/g, " ");
    expect(t).toContain(`${a.resumo.paginas.toLocaleString("pt-BR")} páginas`);
    expect(t).toContain(String(a.resumo.defeitos.abertos));
  });

  it("a página mostra os problemas dos revisores e o que foi corrigido depois da medição", () => {
    const t = textoDe(html);
    expect(t).toContain("Problemas que os revisores viram em várias páginas");
    expect(html).toContain('data-lista="revisao"');
    for (const c of a.rodada.corrigido_depois_da_medicao) expect(t.replace(/\s+/g, " ")).toContain(c.slice(0, 60));
  });

  it("a rubrica completa está no modo Auditar", () => {
    for (const d of a.rubrica.dimensoes) expect(html, d.nome).toContain(`data-rubrica="${d.id}"`);
    const t = textoDe(html);
    expect(t).toMatch(/nota inferior nunca é arredondada para cima/);
  });
});
