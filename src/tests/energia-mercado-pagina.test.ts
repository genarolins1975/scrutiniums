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
import type { CatalogoDados } from "@/lib/energia/tipos-dados";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  PAGINAS_MERCADO,
  TITULO_PAGINA_MERCADO,
  barrasDesligamentos,
  lacunasLiquidacao,
  linhasLiquidacao,
  linhasPagamento,
  linhasCatalogoMercado,
  linhasSamp,
  itensAusentesMercado,
  provenienciaLegivel,
  razoesCceeSobEpe,
  reaisCurto,
  resumoCatalogoMercado,
  serieAmbientesCcee,
  serieEss,
  serieLiquidacao,
  textoAnos,
  textoContratosAusentes,
  textoEstado,
  textoFontesPublicadas,
  textoRazaoUniversos,
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
const CATALOGO: CatalogoDados = JSON.parse(readFileSync(join(raiz, "public/energia/gold/catalogo.json"), "utf-8"));
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

describe("mercado: seletores do estado honesto e da conciliação entre universos", () => {
  it("anos soltos ou seguidos viram texto: 2023 a 2025, 2023 e 2024, 2023, 2025 e 2026", () => {
    expect(textoAnos(["2025", "2023", "2024"])).toBe("2023 a 2025");
    expect(textoAnos(["2023", "2024"])).toBe("2023 e 2024");
    expect(textoAnos(["2023", "2025", "2026"])).toBe("2023, 2025 e 2026");
    expect(textoAnos(["2024"])).toBe("2024");
    expect(textoAnos([])).toBe("");
  });

  it("itens ausentes: um por pendência e por bloqueio da gold, com o efeito como texto e os anos com login no boletim do MME", () => {
    const itens = itensAusentesMercado(G);
    expect(itens.map((i) => i.id)).toEqual([...G.pendencias.map((x) => x.id), ...G.bloqueios.map((x) => x.id)]);
    for (const i of itens) {
      const origem = [...G.pendencias, ...G.bloqueios].find((x) => x.id === i.id)!;
      expect(i.texto, i.id).toContain(origem.efeito);
      expect(i.paineis, i.id).toEqual(origem.paineis);
      expect(`${i.titulo} ${i.texto}`, i.id).not.toMatch(/[A-Z]{3,}_[A-Z0-9_]+|\bP0\d\d\b|sha256|https?:/);
    }
    const boletim = itens.find((i) => i.id === "boletim_mme_anos_anteriores")!;
    const comLogin = G.bloqueios.find((b) => b.id === boletim.id)!.evidencia.pastas!.filter((x) => x.redireciona_login).map((x) => String(x.ano));
    expect(comLogin.length).toBeGreaterThan(0);
    expect(boletim.titulo).toBe(`Boletim de Monitoramento do MME, ${textoAnos(comLogin)}`);
    expect(boletim.texto).toContain(`As pastas de ${textoAnos(comLogin)} do Boletim de Monitoramento do MME pedem login`);
    expect(boletim.texto).toContain("o observatório não tentou outro caminho de acesso");
    // sem pastas com login, o texto é só o efeito
    const semLogin = clone(G);
    semLogin.bloqueios[0].evidencia.pastas = [];
    expect(itensAusentesMercado(semLogin).find((i) => i.id === boletim.id)!.texto).toBe(G.bloqueios[0].efeito);
  });

  it("catálogo: as fontes publicadas nas páginas de mercado fecham com as fontes da gold, e os conjuntos de contratos seguem sem integração", () => {
    const r = resumoCatalogoMercado(CATALOGO.entradas);
    // duas fontes independentes: o catálogo (estado PUBLICADO com página de mercado) e a lista de fontes da própria gold do módulo
    expect(r.publicadas).toBe(G.fontes.length);
    expect(r.porOrgao.reduce((s, o) => s + o.n, 0)).toBe(r.publicadas);
    for (let i = 1; i < r.porOrgao.length; i++) expect(r.porOrgao[i - 1].n).toBeGreaterThanOrEqual(r.porOrgao[i].n);
    const contratos = CATALOGO.entradas.filter((e) => e.orgao === "CCEE" && e.id.startsWith("ccee:contrato_montante_"));
    expect(contratos.length).toBeGreaterThan(0);
    expect(r.contratos).toBe(contratos.filter((e) => e.estado === "RECURSO VERIFICADO" || e.estado === "CATALOGADO").length);
    // nenhum deles é um conjunto que o módulo consome: são mesmo conjuntos sem integração
    const consumidos = new Set(G.ccee_conjuntos.map((c) => c.dataset));
    for (const e of contratos) expect(consumidos.has(`ccee_${e.id.slice(5)}`), e.id).toBe(false);
    expect(textoFontesPublicadas(r)).toMatch(new RegExp(`^${r.publicadas} fontes publicadas nestas páginas: .*\\.$`));
    expect(textoContratosAusentes(r)).toContain(`A CCEE publica ${r.contratos} conjuntos de dados abertos com montantes de contratos de energia.`);
    expect(textoContratosAusentes(r)).toContain("nenhum montante contratado aparece nestas páginas");
    expect(textoContratosAusentes(r)).toContain("O observatório também não publica preço de contrato.");
    // conjunto integrado deixa de contar, e sem nenhum a frase some
    const integrados = CATALOGO.entradas.map((e) => (e.id.startsWith("ccee:contrato_montante_") ? { ...e, estado: "INTEGRADO" as const } : e));
    expect(resumoCatalogoMercado(integrados).contratos).toBe(0);
    expect(textoContratosAusentes(resumoCatalogoMercado(integrados))).toBeNull();
    // tabela de Auditar: as publicadas primeiro, depois os conjuntos de contratos, cada um com órgão, estado e onde aparece
    const linhas = linhasCatalogoMercado(CATALOGO.entradas);
    expect(linhas).toHaveLength(r.publicadas + r.contratos);
    expect(linhas.slice(0, r.publicadas).every((l) => l[2] === "publicado")).toBe(true);
    expect(linhas.slice(r.publicadas).every((l) => String(l[2]).startsWith("recurso verificado") && l[3] === "nenhuma página")).toBe(true);
  });

  it("razão entre a CCEE e a EPE: relida dos CSV, o ACR da CCEE é 1,21 vez o cativo da EPE e o ACL, 1,04 vez o livre, e a frase da página sai desses valores", () => {
    const r = razoesCceeSobEpe(G)!;
    const ccee = G.livre_regulado.ccee_mensal.at(-1)!;
    expect(r.mes).toBe(ccee.mes);
    const linhasEpe = readFileSync(join(raiz, "public/energia/series/mercado_nacional_mensal.csv"), "utf-8").trim().split(/\r?\n/);
    const cab = linhasEpe[0].split(";");
    const doMes = Object.fromEntries(linhasEpe.slice(1).map((l) => l.split(";")).find((c) => c[0] === r.mes)!.map((v, i) => [cab[i], v]));
    const horas = new Date(Date.UTC(Number(r.mes.slice(0, 4)), Number(r.mes.slice(5, 7)), 0)).getUTCDate() * 24;
    const cativo = Number(doMes.total_mwh) - Number(doMes.livre_mwh);
    expect(r.regulado).toBeCloseTo((ccee.acr_mwmed * horas) / cativo, 2);
    expect(r.livre).toBeCloseTo((ccee.acl_mwmed * horas) / Number(doMes.livre_mwh), 2);
    expect(num(r.regulado, 2)).toBe("1,21");
    expect(num(r.livre, 2)).toBe("1,04");
    expect(textoRazaoUniversos(G)).toBe("em ago/2026 a CCEE mede 1,21 vez o consumo cativo da EPE no ambiente regulado e 1,04 vez o livre, ou seja, a diferença vem sobretudo do regulado");
    // a diferença vem do ambiente em que a razão se afasta mais de 1; razões parecidas aparecem nos dois
    const g2 = clone(G);
    const u = g2.livre_regulado.ccee_mensal.at(-1)!;
    const e = g2.livre_regulado.epe_mensal.find((x) => x.mes === u.mes)!;
    u.acr_mwh = e.cativo_mwh! * 1.05;
    u.acl_mwh = e.livre_mwh! * 1.3;
    expect(textoRazaoUniversos(g2)).toContain("sobretudo do livre");
    u.acl_mwh = e.livre_mwh! * 1.06;
    expect(textoRazaoUniversos(g2)).toContain("aparece nos dois ambientes");
    u.acl_mwh = null;
    g2.livre_regulado.ccee_mensal = [u];
    expect(razoesCceeSobEpe(g2)).toBeNull();
    expect(textoRazaoUniversos(g2)).toBe("");
    // a página escreve a frase derivada, e nenhum número da razão fica digitado no código
    const h = renderToStaticMarkup(createElement(MercadoPage));
    expect(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain(`a diferença entre a CCEE e a EPE não foi decomposta, e ${textoRazaoUniversos(G)}`);
    expect(readFileSync(join(raiz, "src/app/setor-eletrico/mercado/page.tsx"), "utf-8")).not.toMatch(/1,21 vez|1,04 vez/);
  });

  it("títulos das páginas: até 9 palavras e uma pergunta por página", () => {
    for (const p of PAGINAS_MERCADO) {
      const t = TITULO_PAGINA_MERCADO[p.id];
      expect(t.endsWith("?"), p.id).toBe(true);
      expect(t.split(/\s+/).length, p.id).toBeLessThanOrEqual(9);
    }
    expect(new Set(Object.values(TITULO_PAGINA_MERCADO)).size).toBe(4);
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

  it("GSF de 12 meses: a diferença com o InfoMercado diz a janela em que foi calculada, que não é a do cartão (r6, R4)", () => {
    const g = lerGold<MercadoGold>("mercado.json");
    const div = integra(g) ? g.mre_gsf.reconciliacao_infomercado.find((x) => x.medida === "gsf_12m_pct" && x.resultado !== "aprovado") : undefined;
    if (!div || div.calculado === null || div.diferenca === null) return;
    const html = paginas["mre-gsf"];
    expect(html).toContain("na mesma janela");
    expect(html).toContain(`${num(div.calculado, 2)}%`);
    expect(html).toContain(`${num(Math.abs(div.diferenca), 2)} pontos percentuais abaixo`);
    // o cartão mostra outra janela; o texto não pode sugerir que a diferença é contra o valor do cartão
    expect(html).toContain("O valor do cartão é o da janela mais recente");
  });

  it("anatomia da seção 7.2 em cada painel: resposta da gold, prova, recorte, tabela, download, link e próxima pergunta", () => {
    for (const [pag, h] of Object.entries(paginas) as [keyof typeof paginas, string][]) {
      const p = G.paineis.find((x) => x.id === ids[pag])!;
      expect(h, pag).toContain(`data-resposta="${p.id}"`);
      expect(h, pag).toContain(p.resposta!.slice(0, 60).replace(/'/g, "&#x27;"));
      expect(h, pag).toContain("Comprove");
      // o rodapé é o SeguirPainel compartilhado ("Baixar os dados"); o bloco "As outras perguntas" é só da abertura, e as filhas levam a faixa de irmãs
      for (const t of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Copiar link deste painel", "Próxima pergunta", "Baixar os dados", "Resumo em tabela"]) {
        expect(h, `${pag}: ${t}`).toContain(t);
      }
      expect(h, pag).not.toContain("Baixar os dados deste painel");
      expect(h, pag).toContain('data-nivel="analisar"');
      expect(h, pag).toContain('data-nivel="auditar"');
      expect(h, pag).toContain(`data-estado="${p.estado_dados}"`);
      if (pag === "livre-regulado") {
        expect(h, pag).toContain("As outras perguntas sobre o mercado");
        expect(h, pag).not.toContain('data-navegacao-local="faixa"');
      } else {
        expect(h, pag).not.toContain("As outras perguntas sobre o mercado");
        expect(h, pag).toContain('data-navegacao-local="faixa"');
      }
    }
  });

  it("título da página em até 9 palavras, pergunta do painel diferente do título, e a resposta vem depois das figuras (a faixa já traz os números)", () => {
    for (const [pag, h] of Object.entries(paginas) as [keyof typeof paginas, string][]) {
      const principal = h.slice(h.indexOf("<main"));
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(principal)?.[1].replace(/<[^>]+>/g, "") ?? "";
      expect(h1, pag).toBe(TITULO_PAGINA_MERCADO[pag]);
      const palavras = h1.trim().split(/\s+/).length;
      expect(palavras, `${pag}: ${h1}`).toBeGreaterThanOrEqual(5);
      expect(palavras, `${pag}: ${h1}`).toBeLessThanOrEqual(9);
      const titulos = Array.from(principal.matchAll(/<h2[^>]*id="painel-[a-z-]+-titulo"[^>]*>([\s\S]*?)<\/h2>/g)).map((m) => m[1].replace(/<[^>]+>/g, ""));
      expect(titulos.length, pag).toBe(1);
      expect(titulos[0], pag).not.toBe(h1);
      const resposta = principal.indexOf(`data-resposta="${ids[pag]}"`);
      expect(principal.slice(resposta - 10, resposta + 120), pag).toContain("data-resposta-depois");
      // a primeira figura (gráfico de barras ou de linhas) vem antes da resposta
      const figura = principal.search(/data-grafico="|<svg[^>]*role="img"/);
      expect(figura, pag).toBeGreaterThan(-1);
      expect(figura, pag).toBeLessThan(resposta);
    }
  });

  it("faixa de métricas: quatro números na abertura, três em Agentes e em MRE e GSF, quatro em Encargos, cada um com a ficha de prova", () => {
    const esperado = { "livre-regulado": 4, agentes: 3, "mre-gsf": 3, encargos: 4 } as const;
    for (const [pag, h] of Object.entries(paginas) as [keyof typeof paginas, string][]) {
      const principal = h.slice(h.indexOf("<main"));
      const faixa = principal.slice(principal.indexOf("data-faixa-metricas"), principal.indexOf('id="painel-'));
      expect((faixa.match(/data-metrica=/g) ?? []).length, pag).toBe(esperado[pag]);
      expect((faixa.match(/Comprove este número/g) ?? []).length, pag).toBe(esperado[pag]);
      // a faixa fica no cabeçalho, antes de qualquer figura
      expect(principal.indexOf("data-faixa-metricas"), pag).toBeLessThan(principal.search(/data-grafico="|<svg[^>]*role="img"/));
    }
    // a abertura guarda a âncora #resumo dos quatro números
    expect(paginas["livre-regulado"]).toContain('id="resumo"');
    expect(paginas["livre-regulado"].indexOf('id="resumo"')).toBeLessThan(paginas["livre-regulado"].indexOf("data-faixa-metricas"));
  });

  it("estado honesto: o que a abertura ainda não mostra sai do catálogo e da gold, com o efeito de cada item, sem número, código nem previsão de entrega", () => {
    const h = paginas["livre-regulado"];
    const principal = h.slice(h.indexOf("<main"));
    const secao = principal.slice(principal.indexOf('id="ainda-nao"'), principal.indexOf('id="livre-analise"'));
    expect(secao).toContain("O que o observatório ainda não mostra sobre o mercado?");
    // fontes publicadas, contadas no catálogo, e conjuntos de contratos verificados e não integrados
    const r = resumoCatalogoMercado(CATALOGO.entradas);
    expect(secao).toContain(textoFontesPublicadas(r));
    expect(secao).toContain(textoContratosAusentes(r)!);
    expect(secao).toContain('data-ausente="contratos"');
    for (const i of G.pendencias.concat(G.bloqueios as never[]) as { id: string; efeito: string }[]) {
      expect(secao, i.id).toContain(`data-ausente="${i.id}"`);
      expect(secao.replace(/&#x27;/g, "'"), i.id).toContain(i.efeito);
    }
    // nenhum identificador de conjunto, código de painel nem promessa de data entra no texto de Entender
    const texto = secao.replace(/data-ausente="[^"]*"/g, "").replace(/<[^>]+>/g, " ");
    expect(texto).not.toMatch(/\bP0\d\d\b|[A-Z]{3,}_[A-Z0-9_]+|\b(em breve|próxima atualização|será integrad|previsto para)\b/i);
    // as filhas só mostram o que toca o próprio painel
    expect(paginas.agentes).toContain('data-ausente="historico_perfis"');
    expect(paginas.agentes).not.toContain('data-ausente="boletim_mme_anos_anteriores"');
    expect(paginas.encargos).toContain('data-ausente="boletim_mme_anos_anteriores"');
    expect(paginas["mre-gsf"]).toContain('data-ausente="infomercado_dados_gerais"');
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

  it("MRE conferido com o glossário do InfoMercado; ACR, ACL, garantia física e ESS no Decreto nº 5.163/2004; GSF no boletim e no relatório do MME", () => {
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
    expect(gsf.estado).toBe("CONFERIDO");
    expect(gsf.conferidoEm).toBe("2026-10-07");
    expect(gsf.fontes.map((f) => f.orgao)).toEqual(expect.arrayContaining(["MME"]));
    expect(gsf.fontes.some((f) => f.trecho?.includes("GSF mensal de 80,51%"))).toBe(true);
    // a definição regulatória (Regras de Comercialização da CCEE) continua não acessada, e o verbete diz isso
    expect(gsf.limitacoes!.join(" ")).toContain("Regras de Comercialização da CCEE");
    for (const s of ["acl", "acr", "gsf", "ess"]) expect(conceito(s)!.vejaNoPortal.every((v) => !v.rotulo.includes("em integração")), s).toBe(true);
  });
});
