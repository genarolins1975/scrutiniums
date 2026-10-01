/* Testes da interface do módulo Rede (P028 a P031): contrato da gold, coerência entre
 * gráfico, tabela e exportação, textos derivados dos números e renderização das
 * páginas no servidor. As conferências numéricas releem os CSV publicados (outro
 * artefato, outro código), não repetem a fórmula de src/lib/energia/rede.ts. */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaCirculacao from "@/app/setor-eletrico/rede/page";
import PaginaBalanco from "@/app/setor-eletrico/rede/balanco-e-exterior/page";
import PaginaRestricoes from "@/app/setor-eletrico/rede/restricoes/page";
import PaginaProgramado from "@/app/setor-eletrico/rede/programado/page";
import { RedeIndisponivel } from "@/components/energia/RedePagina";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import * as R from "@/lib/energia/rede";
import { gerarCsv, matrizExportacao } from "@/lib/energia/tabela";
import type { FronteiraRede, GoldRedeDetalhe, JanelaHorariaRede, ResumoFronteira30d } from "@/lib/energia/tipos-rede";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const G = JSON.parse(ler("public/energia/gold/rede_detalhe.json")) as GoldRedeDetalhe;
const J = JSON.parse(ler("public/energia/series/rede_janela_horaria.json")) as JanelaHorariaRede;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function csv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));
const HORARIO_2026 = csv("rede_horario_2026.csv");

/* ---------------------------------------------------------------- contrato da gold */

describe("contrato da gold rede_detalhe.json", () => {
  it("cabeçalho do domínio, referência coerente e janela horária à parte", () => {
    expect(G.dominio).toBe("energia");
    expect(G.gold).toBe("rede_detalhe.json");
    expect(G.disponivel).toBe(true);
    expect(G.gerado_em).toMatch(/Z$/);
    expect(G.cobertura.fim).toBe(G.referencia.dia);
    expect(G.circulacao.diario.dias.at(-1)).toBe(G.referencia.dia);
    expect(G.circulacao.janela_horaria.url).toBe("/energia/series/rede_janela_horaria.json");
    expect(J.disponivel).toBe(true);
    expect(J.horas.length).toBe(G.circulacao.janela_horaria.horas);
    expect(J.horas[0]).toBe(G.circulacao.janela_horaria.inicio);
    expect(J.horas.at(-1)).toBe(G.circulacao.janela_horaria.fim);
    for (let i = 1; i < J.horas.length; i++) expect(Date.parse(`${J.horas[i]}:00Z`) - Date.parse(`${J.horas[i - 1]}:00Z`)).toBe(3_600_000);
    for (const bloco of [J.fluxo, J.programado, J.exterior, J.pld]) for (const v of Object.values(bloco)) expect(v.length).toBe(J.horas.length);
  });

  it("séries em colunas têm o mesmo comprimento do eixo do bloco", () => {
    const c = G.circulacao;
    for (const p of R.FRONTEIRAS) {
      for (const v of Object.values(c.diario.por_par[p])) expect(v.length, p).toBe(c.diario.dias.length);
      for (const v of Object.values(c.mensal.por_par[p])) expect(v.length, p).toBe(c.mensal.meses.length);
    }
    expect(c.mensal.horas_calendario.length).toBe(c.mensal.meses.length);
    for (const sm of R.SUBSISTEMAS) for (const v of Object.values(c.subsistemas_diario.por_sm[sm])) expect(v.length).toBe(c.subsistemas_diario.dias.length);
    for (const sm of R.REGIOES_BALANCO) for (const v of Object.values(G.balanco.mensal.por_sm[sm])) expect(v.length, sm).toBe(G.balanco.mensal.meses.length);
    expect(G.balanco.mensal.mmgd_estimada.length).toBe(G.balanco.mensal.meses.length);
    for (const p of R.PAISES) for (const [k, v] of Object.entries(G.exterior.por_pais[p])) if (Array.isArray(v)) expect(v.length, `${p}.${k}`).toBe(G.exterior.meses.length);
    for (const v of Object.values(G.exterior.itaipu)) expect(v.length).toBe(G.exterior.meses.length);
    for (const par of R.PARES_PROGRAMADO) {
      for (const v of Object.values(G.programado.diario.por_par[par])) expect(v.length, par).toBe(G.programado.diario.dias.length);
      for (const v of Object.values(G.programado.mensal.por_par[par])) expect(v.length, par).toBe(G.programado.mensal.meses.length);
    }
    expect(G.programado.mensal.dias_rotulados.length).toBe(G.programado.mensal.meses.length);
  });

  it("fronteiras na orientação das pontas e identidades do resumo de 30 dias", () => {
    expect(G.fronteiras.map((f) => f.par)).toEqual([...R.FRONTEIRAS]);
    for (const f of G.fronteiras) expect([f.de, f.para]).toEqual(R.PONTAS[f.par]);
    for (const r of G.circulacao.resumo_30d) {
      expect(Math.abs(r.liquido_mwh - (r.canonico_mwh - r.inverso_mwh)), r.par).toBeLessThanOrEqual(1);
      expect(Math.abs(r.contra_saldo_mwh - Math.min(r.canonico_mwh, r.inverso_mwh)), r.par).toBeLessThanOrEqual(1);
      expect(r.contra_saldo_dias_mwh, r.par).toBeLessThanOrEqual(r.contra_saldo_mwh + 1);
    }
  });

  it("identidades do balanço: horas que fecham mais horas com resíduo dão as horas; faixas encaixadas", () => {
    expect(G.balanco.identidades.length).toBe(11);
    for (const x of G.balanco.identidades) {
      expect(x.horas_fecham + x.horas_residuo, x.id).toBe(x.horas);
      expect(x.horas_acima["1"], x.id).toBeLessThanOrEqual(x.horas_residuo);
      expect(x.horas_acima["10"], x.id).toBeLessThanOrEqual(x.horas_acima["1"]);
      expect(x.horas_acima["100"], x.id).toBeLessThanOrEqual(x.horas_acima["10"]);
    }
  });

  it("ausência nunca vira zero: país sem hora na janela fica nulo; zero publicado continua zero", () => {
    const py = G.exterior.resumo_12m.PARAGUAI;
    expect(py.horas).toBe(0);
    expect(py.exportacao_mwh).toBeNull();
    expect(py.importacao_mwh).toBeNull();
    const ultimoPy = G.exterior.por_pais.PARAGUAI.ultima_hora!.slice(0, 7);
    const i = G.exterior.meses.indexOf(ultimoPy);
    expect(G.exterior.por_pais.PARAGUAI.exportacao_mwh.slice(i + 1).every((v) => v === null)).toBe(true);
    // Uruguai sem fluxo em ago/2026, mas com horas publicadas: zero, não ausência
    const k = G.exterior.meses.indexOf("2026-08");
    expect(G.exterior.por_pais.URUGUAI.horas[k]).toBeGreaterThan(0);
    expect(G.exterior.por_pais.URUGUAI.exportacao_mwh[k]).toBe(0);
  });

  it("nenhuma utilização da rede é publicada e os limites são declarados como não integrados", () => {
    expect(G.restricoes.limites.integrados).toBe(false);
    expect(ler("public/energia/gold/rede_detalhe.json")).not.toMatch(/"(utilizacao|percentual_utilizacao|uso_da_capacidade)[^"]*":/);
    expect(G.restricoes.limites.busca.length).toBeGreaterThanOrEqual(5);
  });

  it("evidências completas para cada fronteira, par e fluxo ativo; downloads existem", () => {
    for (const p of R.FRONTEIRAS) expect(G.evidencias[`contra_saldo_30d.${p}`], p).toBeTruthy();
    for (const p of R.PARES_PROGRAMADO) expect(G.evidencias[`desvio_medio.${p}`], p).toBeTruthy();
    for (const f of R.fluxosAtivos(G.restricoes.atls)) expect(G.evidencias[`atls_12m.${f.fluxo}`], f.fluxo).toBeTruthy();
    for (const k of ["a05_perimetro_sul", "a05_balanco_sin", "exterior_12m", "ens_12m"]) expect(G.evidencias[k], k).toBeTruthy();
    for (const [k, e] of Object.entries(G.evidencias)) expect(problemasEvidencia(e), k).toEqual([]);
    for (const d of G.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
    for (const p of Object.values(G.proveniencia)) if (p.download) expect(existsSync(join(raiz, "public", p.download)), p.download).toBe(true);
  });
});

/* ---------------------------------------------------------------- conferência com os CSV publicados */

describe("números das respostas conferidos nos CSV publicados (outro artefato, outro código)", () => {
  const r0 = G.circulacao.resumo_30d[0];
  const janela30 = HORARIO_2026.filter((l) => l.data_hora >= `${r0.inicio}T00:00` && l.data_hora <= `${r0.fim}T23:00`);

  it("P028: energia em cada sentido em 30 dias, refeita hora a hora do CSV de 2026, é a da resposta", () => {
    expect(janela30.length).toBe(720);
    const resposta = R.respostaCirculacao(G.circulacao.resumo_30d);
    for (const r of G.circulacao.resumo_30d) {
      const v = janela30.map((l) => n(l[`fluxo_${r.par}`])).filter((x): x is number => x !== null);
      const canon = v.reduce((s, x) => s + Math.max(x, 0), 0);
      const inv = v.reduce((s, x) => s + Math.max(-x, 0), 0);
      expect(Math.abs(canon - r.canonico_mwh), r.par).toBeLessThanOrEqual(1);
      expect(Math.abs(inv - r.inverso_mwh), r.par).toBeLessThanOrEqual(1);
      expect(resposta, r.par).toContain(`(${num(Math.round(Math.abs(canon - inv)), 0)} MWh)`);
      if (Math.min(canon, inv) >= 1) expect(resposta, r.par).toContain(`${num(Math.round(Math.min(canon, inv)), 0)} MWh ${R.entreFronteira(r.par)}`);
    }
  });

  it("P028: linhas do dia (mapa e tabela) batem com as 24 horas do CSV", () => {
    const dia = G.referencia.dia;
    const horas = HORARIO_2026.filter((l) => l.data_hora.startsWith(dia));
    expect(horas.length).toBe(24);
    for (const l of R.linhasFronteirasDia(G.circulacao, dia)) {
      const v = horas.map((h) => n(h[`fluxo_${l.id}`])!);
      expect(Math.abs(v.reduce((s, x) => s + Math.max(x, 0), 0) - l.canonico_mwh!), l.id).toBeLessThanOrEqual(1);
      expect(Math.abs(v.reduce((s, x) => s + Math.max(-x, 0), 0) - l.inverso_mwh!), l.id).toBeLessThanOrEqual(1);
    }
  });

  it("P028: a janela horária do mapa traz o fluxo e o PLD da mesma hora do CSV", () => {
    for (const hora of [J.horas[0], J.horas[100], J.horas.at(-1)!]) {
      const l = HORARIO_2026.find((x) => x.data_hora === hora)!;
      const linhas = R.linhasHora(J, R.indiceHora(J, hora));
      for (const x of linhas) {
        expect(Math.abs(x.fluxo_mwmed! - n(l[`fluxo_${x.id}`])!), `${hora} ${x.id}`).toBeLessThanOrEqual(0.05);
        expect(Math.abs(x.programado_mwmed! - n(l[`prog_${x.id}`])!), `${hora} ${x.id}`).toBeLessThanOrEqual(0.05);
        const [a, b] = R.PONTAS[x.id];
        expect(x.pld_de).toBeCloseTo(n(l[`pld_${a}`])!, 2);
        expect(x.pld_para).toBeCloseTo(n(l[`pld_${b}`])!, 2);
      }
    }
  });

  it("P029: exterior de 12 meses refeito do CSV mensal é o da resposta; o Paraguai é dito ausente", () => {
    const meses = csv("rede_exterior_mensal.csv");
    const res = G.exterior.resumo_12m.ARGENTINA;
    const ar = meses.filter((l) => l.pais === "ARGENTINA" && l.mes >= res.meses![0] && l.mes <= res.meses![1]);
    expect(ar.length).toBe(12);
    const exp = ar.reduce((s, l) => s + n(l.exportacao_mwh)!, 0);
    expect(Math.abs(exp - res.exportacao_mwh!)).toBeLessThanOrEqual(1);
    const t = R.respostaExterior(G.exterior);
    expect(t).toContain(`${num(Math.round(exp), 0)} MWh exportados`);
    expect(t).toContain(`De ${mesAno(res.meses![0])} a ${mesAno(res.meses![1])}`);
    expect(t).toMatch(/Paraguai não tem nenhuma hora publicada no período .*ausência, não zero/);
  });

  it("P029: março de 2025 no Sul, intercâmbio e fronteiras nas mesmas horas (744 contra 600)", () => {
    const l = R.linhasBalancoMensal(G.balanco, "S").find((x) => x.m === "2025-03")!;
    expect(l.horas_completas).toBe(744);
    expect(l.horas_perimetro).toBe(600);
    expect(l.intercambio_perimetro_mwh).toBe(l.fronteiras_exterior_mwh);
    expect(l.residuo_perimetro_mwh).toBe(0);
    expect(l.mmgd).toBe(R.ROTULO_MMGD.com);
    expect(R.linhasBalancoMensal(G.balanco, "S").find((x) => x.m === "2023-04")!.mmgd).toBe(R.ROTULO_MMGD.parcial);
  });

  it("P030: horas acima do limite em 12 meses refeitas das linhas mensais do CSV do ATLS", () => {
    const atls = csv("rede_atls.csv");
    const resposta = R.respostaRestricoes(G.restricoes);
    for (const f of R.fluxosAtivos(G.restricoes.atls)) {
      const j = f.ultimos_12_meses!;
      const soma = atls.filter((l) => l.fluxo === f.fluxo && l.periodicidade === "ME" && l.mes >= j.inicio && l.mes <= j.fim).reduce((s, l) => s + n(l.horas_violacao)!, 0);
      expect(Math.abs(soma - j.horas_violacao), f.fluxo).toBeLessThanOrEqual(0.01);
      const linha = R.linhasAtls([f])[0];
      expect(linha.horas_12m).toBe(j.horas_violacao);
      if (soma > 0) expect(resposta, f.fluxo).toContain(`${f.fluxo} ${num(soma, 1)} h`);
    }
    const sem = R.fluxosAtivos(G.restricoes.atls).filter((f) => f.ultimos_12_meses!.horas_violacao === 0);
    for (const f of sem) expect(resposta).toMatch(new RegExp(`${f.fluxo.replace("+", "\\+")}[^.]*não ficou|não ficaram`));
  });

  it("P031: desvio médio e desvio do dia refeitos do CSV horário com programado", () => {
    const comPar = HORARIO_2026.filter((l) => l.data_hora <= `${G.programado.fim}T23:00` && n(l.fluxo_N_NE) !== null && n(l.prog_N_NE) !== null);
    const medio = comPar.reduce((s, l) => s + Math.abs(n(l.fluxo_N_NE)! - n(l.prog_N_NE)!), 0) / comPar.length;
    expect(comPar.length).toBe(G.programado.distribuicao.N_NE!.horas);
    expect(Math.abs(medio - G.programado.distribuicao.N_NE!.desvio_abs_medio_mwmed)).toBeLessThanOrEqual(0.05);
    expect(R.respostaProgramado(G.programado, "N_NE", "com")).toContain(`${num(Math.round(medio * 10) / 10, 1)} MWmed por hora`);
    const dia = G.programado.diario.dias.at(-1)!;
    const horas = HORARIO_2026.filter((l) => l.data_hora.startsWith(dia));
    const desvio = horas.reduce((s, l) => s + Math.abs(n(l.fluxo_NE_SE)! - n(l.prog_NE_SE)!), 0);
    const linha = R.linhasProgramadoDiario(G.programado, "NE_SE").find((x) => x.d === dia)!;
    expect(Math.abs(desvio - linha.desvio_abs_mwh!)).toBeLessThanOrEqual(1);
  });
});

/* ---------------------------------------------------------------- gráfico, tabela e exportação */

describe("gráfico, tabela equivalente e exportação usam as mesmas linhas", () => {
  it("as linhas do dia trazem os valores da gold sem arredondar, e a exportação também", () => {
    const dia = G.circulacao.diario.dias[10];
    const linhas = R.linhasFronteirasDia(G.circulacao, dia);
    expect(linhas.map((l) => l.id)).toEqual([...R.FRONTEIRAS]);
    const m = matrizExportacao(R.COLUNAS_FRONTEIRAS_DIA, R.paraTabela(linhas));
    const iLiq = R.COLUNAS_FRONTEIRAS_DIA.findIndex((c) => c.id === "liquido_mwh");
    linhas.forEach((l, k) => {
      expect(l.liquido_mwh).toBe(G.circulacao.diario.por_par[l.id].liquido_mwh[10]);
      expect(m.linhas[k][iLiq]).toBe(l.liquido_mwh);
    });
    const texto = gerarCsv(R.COLUNAS_FRONTEIRAS_DIA, R.paraTabela(linhas));
    expect(texto.trim().split(/\r\n/).length).toBe(linhas.length + 1);
  });

  it("dia fora da janela: linhas vazias (ausência), nunca zero", () => {
    const linhas = R.linhasFronteirasDia(G.circulacao, "2020-01-01");
    for (const l of linhas) {
      expect(l.liquido_mwh).toBeNull();
      expect(l.sentido_saldo).toBe("sem dado");
    }
    const csvTexto = gerarCsv(R.COLUNAS_FRONTEIRAS_DIA, R.paraTabela(linhas));
    expect(csvTexto.split(/\r\n/)[1]).toMatch(/;;/);
  });

  it("série de 30 dias, mensal, subsistemas, identidades, exterior, ATLS e desvios: uma linha por ponto, valores da gold", () => {
    const diario = R.linhasDiarioFronteira(G.circulacao, "N_SE");
    expect(diario.length).toBe(30);
    expect(diario.map((l) => l.inverso_mwh)).toEqual(G.circulacao.diario.por_par.N_SE.inverso_mwh);
    const mensal = R.linhasMensalFronteira(G.circulacao, "S_SE");
    expect(mensal.length).toBe(G.circulacao.mensal.meses.length);
    const ultimo = mensal.at(-1)!;
    expect(ultimo.mes_completo).toBe(ultimo.horas === ultimo.horas_calendario ? "sim" : `não (${num(ultimo.horas, 0)} de ${num(ultimo.horas_calendario, 0)} horas)`);
    expect(R.linhasSubsistemasDia(G.circulacao, G.referencia.dia).map((l) => l.id)).toEqual([...R.SUBSISTEMAS]);
    const ids = R.linhasIdentidades(R.identidadesDa(G.balanco, "SIN"));
    expect(ids.map((x) => x.id)).toEqual(["balanco.SIN", "perimetro.SIN", "soma_sin"]);
    expect(R.linhasIdentidades(R.identidadesDa(G.balanco, "N")).map((x) => x.id)).toEqual(["balanco.N", "perimetro.N"]);
    const dist = R.linhasDistribuicao(G.programado, "sem");
    expect(dist.find((x) => x.id === "N_NE")!.desvio_abs_medio_mwmed).toBe(G.programado.distribuicao.N_NE!.sem_dias_rotulados!.desvio_abs_medio_mwmed);
    expect(dist.find((x) => x.id === "ARGENTINA")!.desvio_abs_medio_mwmed).toBe(G.programado.distribuicao.ARGENTINA!.desvio_abs_medio_mwmed);
    const cols = R.colunasDistribuicao(G.programado);
    const m = matrizExportacao(cols, R.paraTabela(dist));
    expect(m.linhas.length).toBe(R.PARES_PROGRAMADO.length);
    const i1000 = cols.findIndex((c) => c.id === `horas_${G.programado.limiar_material_mwmed}`);
    expect(cols[i1000].rotulo).toContain(`${num(G.programado.limiar_material_mwmed, 0)} MWmed ou mais (materiais)`);
    expect(m.linhas[0][i1000]).toBe(G.programado.distribuicao.N_NE!.sem_dias_rotulados!.horas_materiais["1000"]);
  });

  it("ATLS mensal: mês sem publicação do fluxo é nulo, distinto de zero hora", () => {
    const fluxos = G.restricoes.atls.fluxos.filter((f) => ["FNS", "FJUSC"].includes(f.fluxo));
    const serie = R.serieAtls(fluxos);
    const antes = serie.find((l) => l.m < (fluxos.find((f) => f.fluxo === "FJUSC")!.serie.meses[0] ?? ""))!;
    expect(antes.FJUSC).toBeNull();
    expect(typeof antes.FNS).toBe("number");
    expect(serie.map((l) => l.m)).toEqual([...serie.map((l) => l.m)].sort());
  });

  it("último ano: fluxo e diferença de preço juntos pela data, nunca pela posição", () => {
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    const linhas = R.linhasUltimoAno(r.serie_fluxos, r.serie_amplitude_pld);
    const ultimoPld = r.serie_amplitude_pld.at(-1);
    const l = linhas.find((x) => x.d === ultimoPld.d)!;
    expect(l.amplitude).toBe(ultimoPld.amplitude);
    if (!r.serie_fluxos.some((x: { d: string }) => x.d === ultimoPld.d)) expect(l.N_NE).toBeNull();
    const f = r.serie_fluxos[0];
    expect(linhas.find((x) => x.d === f.d)!.S_SE).toBe(f.S_SE);
  });

  it("nos componentes, o gráfico e a tabela equivalente recebem a mesma variável de linhas", () => {
    const pares: Record<string, string[]> = {
      "src/components/energia/RedeCirculacao.tsx": ["diario", "serieH", "subsistemas", "mensal"],
      "src/components/energia/RedeBalanco.tsx": ["ids", "mensal", "ext", "itaipu", "residuos"],
      "src/components/energia/RedeRestricoes.tsx": ["linhasAtivos", "serie", "anual"],
      "src/components/energia/RedeProgramado.tsx": ["dist", "diario", "materiais"],
      "src/app/setor-eletrico/rede/page.tsx": ["ultimoAno"],
    };
    for (const [arq, vars] of Object.entries(pares)) {
      const t = ler(arq);
      for (const v of vars) {
        expect(t, `${arq}: ${v}`).toMatch(new RegExp(`dados=\\{(paraTabela\\()?${v}\\)?\\}`));
        expect(t, `${arq}: ${v}`).toContain(`linhas={paraTabela(${v})}`);
      }
    }
  });
});

/* ---------------------------------------------------------------- textos derivados */

describe("respostas escritas por regra a partir dos números", () => {
  it("circulação: muda com os dados e não afirma sentido único quando houve horas no sentido contrário", () => {
    const resumo = copia(G.circulacao.resumo_30d);
    const t = R.respostaCirculacao(resumo);
    expect(t).toContain(`De ${dataBR(resumo[0].inicio)} a ${dataBR(resumo[0].fim)}`);
    const umSentido = resumo.map((r): ResumoFronteira30d => ({ ...r, horas_canonico: r.liquido_mwh >= 0 ? r.horas : 0, horas_inverso: r.liquido_mwh >= 0 ? 0 : r.horas, contra_saldo_mwh: 0 }));
    expect(R.respostaCirculacao(umSentido)).toContain("Em nenhuma das fronteiras o fluxo passou de 1 MWmed no sentido contrário");
    const semDado = resumo.map((r) => ({ ...r, horas: 0 }));
    expect(R.respostaCirculacao(semDado.slice(0, 1).concat(resumo.slice(1)))).toContain("Sem fluxo publicado entre Norte e Nordeste");
    const incompleto = resumo.map((r, i) => (i === 1 ? { ...r, dias_completos: r.dias - 1 } : r));
    expect(R.respostaCirculacao(incompleto)).toContain(`${resumo[1].dias - 1} de ${resumo[1].dias} dias com as 24 horas`);
    expect(t).not.toMatch(/limite|congestion|satura/);
  });

  it("dia e hora: sentido pelo sinal, programa no sentido contrário dito como tal", () => {
    const linhas = R.linhasFronteirasDia(G.circulacao, G.referencia.dia);
    const t = R.respostaDia(linhas, "N_SE");
    const l = linhas.find((x) => x.id === "N_SE")!;
    expect(t).toContain(`${num(Math.abs(l.liquido_mwh!), 0)} MWh ${l.liquido_mwh! > 0 ? "do Norte para o Sudeste/Centro-Oeste" : "do Sudeste/Centro-Oeste para o Norte"}`);
    const h = R.linhasHora(J, R.indiceHora(J, ""));
    expect(h[0].hora).toBe(J.horas.at(-1));
    const sintetica = [{ ...h[0], id: "N_NE" as FronteiraRede, fluxo_mwmed: 500, programado_mwmed: -300 }];
    expect(R.respostaHora(sintetica, "N_NE")).toContain("o programa previa 300 MWmed no sentido contrário");
    expect(R.respostaHora([{ ...sintetica[0], fluxo_mwmed: null }], "N_NE")).toContain("sem fluxo publicado");
  });

  it("balanço: 'fecha em todas' só sem resíduo; resíduo sem causa atribuída", () => {
    const per = { inicio: G.cobertura.inicio, fim: G.cobertura.fim };
    const tN = R.respostaBalanco(G.balanco, "N", per);
    const pN = G.balanco.identidades.find((x) => x.id === "perimetro.N")!;
    expect(pN.horas_residuo).toBe(0);
    expect(tN).toContain(`fecha com a soma das fronteiras em todas as ${num(pN.horas, 0)} horas`);
    const tS = R.respostaBalanco(G.balanco, "S", per);
    const pS = G.balanco.identidades.find((x) => x.id === "perimetro.S")!;
    expect(tS).toContain(`em ${num(pS.horas_fecham, 0)} de ${num(pS.horas, 0)} horas`);
    expect(tS).toContain("A fonte não informa a causa dos resíduos");
    expect(tS).not.toMatch(/perdas/);
    const zerado = copia(G.balanco);
    for (const x of zerado.identidades) Object.assign(x, { horas_fecham: x.horas, horas_residuo: 0 });
    expect(R.respostaBalanco(zerado, "SIN", per)).not.toContain("A fonte não informa a causa");
  });

  it("restrições: contagem de fluxos e cortes de carga lidos da gold; nunca utilização", () => {
    const t = R.respostaRestricoes(G.restricoes);
    const ativos = R.fluxosAtivos(G.restricoes.atls);
    const com = ativos.filter((f) => f.ultimos_12_meses!.horas_violacao > 0);
    expect(t).toContain(`${num(com.length, 0)} dos ${num(ativos.length, 0)} fluxos`);
    const u = G.restricoes.interrupcoes.ultimos_12_meses;
    expect(t).toContain(`${num(u.ens_mwh, 1)} MWh de energia não suprida`);
    expect(t).toContain("nenhuma utilização da rede é calculada");
    const semAtls = copia(G.restricoes);
    semAtls.atls.fluxos = semAtls.atls.fluxos.map((f) => ({ ...f, ativo: false }));
    expect(R.respostaRestricoes(semAtls)).toContain("não tem fluxo publicado no último mês");
  });

  it("programado: base sem dias rotulados dita, desvio nunca chamado de falha", () => {
    const com = R.respostaProgramado(G.programado, "N_NE", "com");
    const sem = R.respostaProgramado(G.programado, "N_NE", "sem");
    const d = G.programado.distribuicao.N_NE!;
    expect(com).toContain(`a média cai para ${num(d.sem_dias_rotulados!.desvio_abs_medio_mwmed, 1)} MWmed`);
    expect(sem).toContain(`exclui ${d.dias_rotulados === 1 ? "1 dia rotulado" : `${d.dias_rotulados} dias rotulados`}`);
    expect(sem).toContain(`${num(d.sem_dias_rotulados!.desvio_abs_medio_mwmed, 1)} MWmed por hora`);
    expect(R.respostaProgramado(G.programado, "ARGENTINA", "sem")).not.toContain("rotulado");
    for (const t of [com, sem]) expect(t).not.toMatch(/falha|erro/);
    expect(R.textoProgramaRepetido(G.programado)).toContain(dataBR(G.programado.programa_repetido.dias[0].dia));
    expect(R.textoConferenciaPdo(G.programado)).toContain(`${num(G.programado.versao_programa.conferencia_pdo.horas_conferem, 0)} de ${num(G.programado.versao_programa.conferencia_pdo.horas, 0)} horas`);
  });

  it("limiares de método dos textos são os declarados nas regras da gold", () => {
    expect(G.regras.nulo).toContain(`até ${num(R.LIMIAR_NULO_MWMED, 0)} MWmed`);
    expect(G.regras.pld).toContain(`R$ ${num(R.LIMIAR_PRECOS_RS_MWH, 2)}/MWh`);
    const cols = R.colunasIdentidades(G.balanco);
    expect(cols.find((c) => c.id === "horas_fecham")!.rotulo).toContain(`${num(G.balanco.tolerancia_mwmed, 1)} MWmed`);
    expect(cols.find((c) => c.id === "acima_100")!.rotulo).toContain(`${num(G.balanco.faixas_mwmed[2], 0)} MWmed`);
  });

  it("frases do A05 com datas brasileiras e regras sem caminhos internos da gold", () => {
    expect(R.datasLegiveis("entre 2026-01-01T00:00 e 2026-05-14T23:00; dia 2022-09-14")).toBe("entre 01/01/2026 às 00h e 14/05/2026 às 23h; dia 14/09/2022");
    for (const f of R.frasesA05(G.achados.A05)) expect(f).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(R.frasesA05(G.achados.A05).length).toBe(G.achados.A05.frases.length);
    expect(R.semCaminhosInternos("Texto (ver esquema_fonte e o achado A05). Fim (sem caminho).")).toBe("Texto. Fim (sem caminho).");
    for (const v of Object.values(G.regras)) expect(R.semCaminhosInternos(v)).not.toMatch(/\b[a-z]+_[a-z_]+\.[a-z_]+\b|justificativa_limiar|esquema_fonte/);
  });

  it("nenhum número da gold escrito à mão nas páginas e componentes da Rede", () => {
    const arquivos = [
      "src/app/setor-eletrico/rede/page.tsx",
      "src/app/setor-eletrico/rede/balanco-e-exterior/page.tsx",
      "src/app/setor-eletrico/rede/restricoes/page.tsx",
      "src/app/setor-eletrico/rede/programado/page.tsx",
      "src/components/energia/RedeCirculacao.tsx",
      "src/components/energia/RedeBalanco.tsx",
      "src/components/energia/RedeRestricoes.tsx",
      "src/components/energia/RedeProgramado.tsx",
      "src/components/energia/RedeMapaFluxos.tsx",
      "src/components/energia/RedePagina.tsx",
      "src/lib/energia/rede.ts",
    ];
    for (const a of arquivos) {
      const t = ler(a);
      expect(t, a).not.toMatch(/\d{1,3}\.\d{3}(,\d+)?\s*(MWh|MWmed|horas|h\b)/);
      expect(t, a).not.toMatch(/\b20(1|2)\d-\d{2}-\d{2}\b/);
      expect(t, a).not.toMatch(/—/);
    }
  });
});

/* ---------------------------------------------------------------- páginas no servidor */

describe("páginas renderizadas no servidor", () => {
  const paginas = { p028: PaginaCirculacao, p029: PaginaBalanco, p030: PaginaRestricoes, p031: PaginaProgramado } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const principal = (h: string) => h.slice(h.indexOf("<main"), h.indexOf("</main>"));
  const respostas = {
    p028: R.respostaCirculacao(G.circulacao.resumo_30d),
    p029: R.respostaBalanco(G.balanco, "SIN", { inicio: G.cobertura.inicio, fim: G.cobertura.fim }),
    p030: R.respostaRestricoes(G.restricoes),
    p031: R.respostaProgramado(G.programado, "N_NE", "com"),
  };
  const minimoTabelas = { p028: 6, p029: 6, p030: 6, p031: 5 };
  const escapa = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it("cada painel renderiza com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    for (const id of ["p028", "p029", "p030", "p031"] as const) {
      const h = html[id];
      expect(h, id).toContain(`id="${id}"`);
      expect(h, id).toContain(`id="${id}-titulo"`);
      expect(h, id).toContain(R.perguntaPainel(id));
      expect(h, id).toContain(`data-resposta="${id}"`);
      expect(h, id).toContain(escapa(respostas[id].slice(0, 60)));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${id}: ${parte}`).toContain(parte);
      }
      expect((h.match(/Comprove este número/g) ?? []).length, id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, id).toBeGreaterThanOrEqual(minimoTabelas[id]);
      expect(h, id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      for (const p of R.PAINEIS_REDE) expect(h, `${id} -> ${p.id}`).toContain(`href="${R.rotaPainel(p.id)}"`);
      expect(h, id).toMatch(new RegExp(`aria-current="page"[^>]*>${R.PAINEIS_REDE.find((p) => p.id === id)!.rotulo}<`));
      expect(h.length, id).toBeLessThan(600_000);
      const m = principal(h);
      expect(m, id).not.toMatch(/em breve|em integração|em construção|indisponíve/i);
      expect(m, id).not.toMatch(/—/);
    }
  });

  it("P028: título do módulo, esquema de fluxos com lista no celular e o painel do último ano com PLD", () => {
    const h = html.p028;
    expect(h).toContain(R.PERGUNTA_MODULO_REDE);
    expect(h).toContain("Esquema sem escala geográfica");
    expect(h).toContain('role="group"');
    expect((h.match(/aria-pressed="false"/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(h).toContain('id="fluxo-e-preco"');
    expect(h).toContain(`Energia escondida pelo saldo de 30 dias, ${R.nomeFronteira("N_SE")}`);
  });

  it("P029 e P030: frases do A05, bloqueio dos limites e documentos conferidos visíveis", () => {
    expect(html.p029).toContain('data-textos="a05"');
    expect(html.p029).toContain(escapa(R.frasesA05(G.achados.A05)[0].slice(0, 40)));
    expect(html.p030).toContain("bloqueio documentado (achado A06)");
    expect(html.p030).toContain(escapa(G.restricoes.limites.conclusao.slice(0, 60)));
    for (const b of G.restricoes.limites.busca) expect(html.p030).toContain(escapa(b.resultado.slice(0, 40)));
  });

  it("P031: programa e revisão identificados (ou dito que a fonte não identifica)", () => {
    expect(html.p031).toContain(escapa(G.programado.versao_programa.texto.slice(0, 60)));
    expect(html.p031).toContain("Programa repetido");
  });

  it("gold ausente: estado de indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(RedeIndisponivel, { motivo: "gold reprovada na validação" }));
    expect(h).toContain("Rede indisponível nesta publicação");
    expect(h).toContain("gold reprovada na validação");
    expect(h).not.toMatch(/\d{1,3}\.\d{3}/);
  });

  it("o destino Rede está publicado no menu com a pergunta do módulo", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "rede");
    expect(d?.publicado).toBe(true);
    expect(d?.pergunta).toBe(R.PERGUNTA_MODULO_REDE);
  });
});

/* ---------------------------------------------------------------- verbetes */

describe("verbetes do módulo conferidos nos trechos que a gold confere no arquivo original", () => {
  it("ATLS, intercâmbio e intercâmbio internacional citam trechos literais conferidos", () => {
    const atls = CONCEITOS.find((c) => c.slug === "atls")!;
    expect(atls.estado).toBe("CONFERIDO");
    expect(atls.conferidoEm).toBe("2026-09-30");
    const def = G.restricoes.documentos.ons_submodulo_9_1.trechos.find((t) => t.id === "atls_definicao")!;
    expect(def.confere).toBe(true);
    expect(atls.fontes.map((f) => f.trecho)).toContain(def.texto);
    for (const t of G.restricoes.documentos.ons_submodulo_9_1.trechos.filter((x) => x.id !== "atls_definicao")) {
      expect(atls.fontes.some((f) => (f.trecho ?? "").includes(t.texto)), t.id).toBe(true);
    }
    const intl = CONCEITOS.find((c) => c.slug === "intercambio-internacional")!;
    const sinal = G.achados.dicionarios.ons_rede_intercambio_internacional.trechos.find((t) => t.id === "sinal")!;
    expect(sinal.confere).toBe(true);
    expect(intl.fontes.map((f) => f.trecho)).toContain(sinal.texto);
    const inter = CONCEITOS.find((c) => c.slug === "intercambio")!;
    expect(inter.conferidoEm).toBe("2026-09-30");
    expect(G.proveniencia.fluxo.notas_fonte ?? "").toContain(inter.fontes[0].trecho!);
    const sul = G.achados.dicionarios.ons_rede_intercambio_nacional.trechos.find((t) => t.id === "exterior_sul")!;
    expect(inter.fontes.map((f) => f.trecho)).toContain(sul.texto);
    expect(inter.vejaNoPortal[0].href).toBe(R.ROTA_REDE);
  });
});
