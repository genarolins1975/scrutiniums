import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MercadoPage from "@/app/setor-eletrico/mercado/page";
import MercadoAgentesPage from "@/app/setor-eletrico/mercado/agentes/page";
import MercadoMreGsfPage from "@/app/setor-eletrico/mercado/mre-e-gsf/page";
import MercadoEncargosPage from "@/app/setor-eletrico/mercado/encargos/page";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import {
  PAGINAS_MERCADO,
  barrasDesligamentos,
  lacunasLiquidacao,
  linhasLiquidacao,
  linhasPagamento,
  linhasSamp,
  provenienciaLegivel,
  reaisCurto,
  serieAmbientesCcee,
  serieEss,
  serieLiquidacao,
  textoEstado,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

/**
 * Interface do módulo Mercado (P032 a P035): derivações puras (lacuna nunca vira zero, mês
 * incompleto fora da comparação, rótulo de ano parcial), renderização das quatro páginas no
 * servidor com a anatomia da seção 7.2, ausência de valor de reserva e de data crua no texto,
 * peso abaixo da meta e navegação com o módulo integrado.
 */
const raiz = process.cwd();
const G: MercadoGold = JSON.parse(readFileSync(join(raiz, "public/energia/gold/mercado.json"), "utf-8"));
const clone = <T,>(x: T): T => structuredClone(x);

describe("mercado: derivações das séries e tabelas", () => {
  it("liquidação: só meses liquidados têm barra; os demais ficam nulos e rotulados com o motivo", () => {
    const s = serieLiquidacao(G);
    expect(s).toHaveLength(G.encargos.liquidacao_mensal.length);
    G.encargos.liquidacao_mensal.forEach((l, i) => {
      if (l.situacao === "liquidada") {
        expect(s[i].liquidado, l.mes).toBeCloseTo(l.liquidado! / 1e6, 6);
        expect(s[i].inadimplencia, l.mes).toBeCloseTo(l.inadimplencia! / 1e6, 6);
      } else {
        expect(s[i].liquidado, l.mes).toBeNull();
        expect(s[i].inadimplencia, l.mes).toBeNull();
        expect(s[i].rotulo, l.mes).toContain("sem dado");
      }
    });
    const lac = lacunasLiquidacao(G);
    expect(lac.find((x) => x.mes === "2025-04")?.motivo).toBe("mês ausente do conjunto da CCEE");
    expect(lac.every((x) => x.motivo.length > 0)).toBe(true);
    expect(linhasLiquidacao(G).find((x) => x.id === "2025-04")?.a_liquidar).toBeNull();
  });

  it("pagamento de ESS zerado em sequência sai nulo, com a situação escrita", () => {
    const seq = G.encargos.controles_pagamento.series.pagamento_ess[0];
    const linhas = linhasPagamento(G).filter((x) => String(x.id) >= seq.inicio && String(x.id) <= seq.fim);
    expect(linhas).toHaveLength(seq.meses);
    for (const l of linhas) {
      expect(l.pagamento_ess, String(l.id)).toBeNull();
      expect(String(l.situacao)).toContain("não confirmado");
    }
  });

  it("ESS: o grupo dos demais tipos só soma quando os quatro foram publicados", () => {
    const g = clone(G);
    const ultimo = g.encargos.ess_mensal.at(-1)!;
    const antes = serieEss(g).at(-1)!;
    const esperado = (ultimo.seguranca_energetica! + ultimo.deslocamento_hidraulico! + ultimo.importacao! + ultimo.reserva_operativa!) / 1e6;
    expect(antes.outros).toBeCloseTo(esperado, 6);
    ultimo.importacao = null;
    expect(serieEss(g).at(-1)!.outros).toBeNull();
    // restrição e ancilares não mudam com a ausência de outro tipo
    expect(serieEss(g).at(-1)!.restricao).toBe(antes.restricao);
  });

  it("CCEE por ambiente copia ACR, ACL e exportação da gold, sem somar nem recalcular", () => {
    const s = serieAmbientesCcee(G);
    G.livre_regulado.ccee_mensal.forEach((m, i) => {
      expect(s[i].acr).toBe(m.acr_mwmed);
      expect(s[i].acl).toBe(m.acl_mwmed);
      expect(s[i].exportacao).toBe(m.exportacao_mwmed);
    });
  });

  it("SAMP: mês incompleto ou não comparável não tem razão com a EPE", () => {
    const linhas = linhasSamp(G);
    G.livre_regulado.samp_nacional_mensal.forEach((s, i) => {
      if (!s.comparavel) expect(linhas[i].razao, s.mes).toBeNull();
      else expect(linhas[i].razao, s.mes).toBe(s.samp_sobre_epe_uc_pct);
    });
    expect(linhas.some((l) => l.situacao === "incompleto")).toBe(true);
  });

  it("desligamentos: o ano parcial leva o último mês coberto no rótulo", () => {
    const d = barrasDesligamentos(G);
    const aberto = G.agentes_migracao.desligamentos_por_ano.find((x) => !x.completo)!;
    const linha = d.find((x) => x.ano === aberto.ano)!;
    expect(linha.rotulo).toMatch(new RegExp(`^${aberto.ano} \\(até [a-z]{3}/\\d{4}\\)$`));
    expect(d.filter((x) => x.rotulo === x.ano).every((x) => G.agentes_migracao.desligamentos_por_ano.filter((y) => y.ano === x.ano).every((y) => y.completo))).toBe(true);
  });

  it("textos curtos: estado do painel conta as ressalvas; reais em bilhão, milhão e ausência", () => {
    const p = G.paineis.find((x) => x.id === "P035")!;
    const r = p.verificacoes.filter((v) => v.resultado !== "aprovado").length;
    expect(textoEstado(p)).toContain(`${r} com ressalva`);
    expect(reaisCurto(1_602_904_433.09)).toBe("R$ 1,60 bilhão");
    expect(reaisCurto(10_195_848_810.71)).toBe("R$ 10,20 bilhões");
    expect(reaisCurto(958_066_000)).toBe("R$ 958,1 milhões");
    expect(reaisCurto(null)).toBe("sem dado");
  });

  it("proveniência legível: datas soltas viram mês por extenso; identificadores ficam", () => {
    const p = provenienciaLegivel({ ...G.proveniencia.encargos_ccee, notas_fonte: "ESS: 2023-07 a 2026-08; chave VALOR_INAD@2026-07." });
    expect(p.notas_fonte).toBe("ESS: jul/2023 a ago/2026; chave VALOR_INAD@2026-07.");
  });
});

describe("mercado: páginas", () => {
  const paginas = {
    "livre-regulado": renderToStaticMarkup(createElement(MercadoPage)),
    agentes: renderToStaticMarkup(createElement(MercadoAgentesPage)),
    "mre-gsf": renderToStaticMarkup(createElement(MercadoMreGsfPage)),
    encargos: renderToStaticMarkup(createElement(MercadoEncargosPage)),
  } as const;
  const ids = { "livre-regulado": "P032", agentes: "P033", "mre-gsf": "P034", encargos: "P035" } as const;

  it("anatomia da seção 7.2 em cada painel: resposta da gold, prova, recorte, tabela, download, link e próxima pergunta", () => {
    for (const [pag, h] of Object.entries(paginas) as [keyof typeof paginas, string][]) {
      const p = G.paineis.find((x) => x.id === ids[pag])!;
      expect(h, pag).toContain(`data-resposta="${p.id}"`);
      expect(h, pag).toContain(p.resposta!.slice(0, 60).replace(/'/g, "&#x27;"));
      expect(h, pag).toContain("Comprove");
      for (const t of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Copiar link deste painel", "Próxima pergunta", "Baixar os dados deste painel", "Resumo em tabela"]) {
        expect(h, `${pag}: ${t}`).toContain(t);
      }
      expect(h, pag).toContain('data-nivel="analisar"');
      expect(h, pag).toContain('data-nivel="auditar"');
      expect(h, pag).toContain(`data-estado="${p.estado_dados}"`);
      expect(h, pag).toContain("As outras perguntas sobre o mercado");
    }
  });

  it("sem valor de reserva, sem vazamento de objeto, sem data crua no texto e abaixo da meta de peso", () => {
    for (const [pag, h] of Object.entries(paginas)) {
      expect(h, pag).not.toMatch(/NaN|undefined|\[object Object\]/);
      const texto = h.replace(/<[^>]+>/g, " ");
      // a mesma regra da auditoria das páginas pré-renderizadas (energia-reauditoria)
      expect(texto, pag).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
      // o HTML do servidor fica abaixo de 400 KB; com as props dos clientes, abaixo dos ~600 KB da meta (seção 5.1)
      expect(Buffer.byteLength(h, "utf-8"), pag).toBeLessThan(400 * 1024);
    }
  });

  it("lacunas da liquidação e zeros não confirmados aparecem escritos na página de encargos", () => {
    const h = paginas.encargos;
    expect(h).toContain('data-lacunas="liquidacao"');
    expect(h).toContain("abr/2025, mês ausente do conjunto da CCEE");
    expect(h).toContain('data-zeros="pagamento_ess"');
    // as tabelas longas não vêm no HTML: são lidas da gold publicada sob demanda
    expect(h).toContain('data-tabelas="encargos-analise"');
    expect(h).toContain('data-tabelas="encargos-auditoria"');
    expect(paginas["livre-regulado"]).toContain('data-tabelas="livre-auditoria"');
  });

  it("decisão de acesso à CCEE publicada na auditoria do primeiro painel", () => {
    expect(paginas["livre-regulado"]).toContain(`data-acesso-ccee="${G.acesso_ccee.decisao.situacao}"`);
    expect(paginas["livre-regulado"]).toContain("06/10/2026");
  });

  it("linguagem causal só negada", () => {
    for (const [pag, h] of Object.entries(paginas)) {
      for (const m of Array.from(h.matchAll(/caus\w*/gi))) {
        const ctx = h.slice(Math.max(0, m.index! - 80), m.index! + 20).toLowerCase();
        expect(/nunca|não|nenhuma|sem /.test(ctx), `${pag}: ...${ctx}...`).toBe(true);
      }
    }
  });
});

describe("mercado: navegação e glossário", () => {
  it("o módulo está integrado e publicado, com as quatro rotas e a página atual marcada", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "mercado")!;
    expect(d.integrado).toBe(true);
    expect(d.publicado).toBe(true);
    for (const p of PAGINAS_MERCADO) expect(existsSync(join(raiz, "src/app", p.href, "page.tsx")), p.href).toBe(true);
    const h = renderToStaticMarkup(createElement(MercadoAgentesPage));
    expect(h).toMatch(/aria-current="page"[^>]*>Agentes e migração|href="\/setor-eletrico\/mercado\/agentes"[^>]*aria-current="page"/);
    expect(h).not.toContain("ModuloEmIntegracao");
  });

  it("MRE conferido com o glossário do InfoMercado; ACR, ACL, garantia física e ESS no Decreto nº 5.163/2004; GSF segue pendente e sem definição", () => {
    const mre = conceito("mre")!;
    expect(mre.estado).toBe("CONFERIDO");
    expect(mre.conferidoEm).toBe("2026-10-06");
    expect(mre.fontes[0].trecho).toContain("Mecanismo de compartilhamento dos riscos hidrológicos");
    for (const s of ["acl", "acr", "garantia-fisica", "ess"]) {
      const c = conceito(s)!;
      expect(c.estado, s).toBe("CONFERIDO");
      expect(c.conferidoEm, s).toBe("2026-10-06");
      expect(c.fontes[0].documento, s).toContain("Decreto nº 5.163");
      expect(c.fontes[0].url, s).toBe("https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5163.htm");
    }
    const gsf = conceito("gsf")!;
    expect(gsf.estado).toBe("PENDENTE");
    expect(gsf.emUmaFrase).toBeUndefined();
    expect(gsf.fontePlanejada).toContain("Regras de Comercialização da CCEE");
    for (const s of ["acl", "acr", "gsf", "ess"]) expect(conceito(s)!.vejaNoPortal.every((v) => !v.rotulo.includes("em integração")), s).toBe(true);
  });
});
