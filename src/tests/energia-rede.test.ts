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
import { RedeEsquemaFluxos } from "@/components/energia/RedeEsquemaFluxos";
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
    // frase de leitor antes da contagem: a menor parcela de horas que fecha, arredondada para baixo
    expect(R.respostaBalanco(zerado, "SIN", per)).toContain("fecham entre si em todas as horas conferidas");
    const sin = G.balanco.identidades.filter((x) => x.id.endsWith(".SIN") && x.horas > 0);
    const menor = Math.floor(Math.min(...sin.map((x) => x.horas_fecham / x.horas)) * 100);
    expect(R.respostaBalanco(G.balanco, "SIN", per)).toContain(`em pelo menos ${menor}% das horas conferidas`);
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
      "src/components/energia/RedeEsquemaFluxos.tsx",
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
      // navegação entre as páginas: na abertura (P028) as outras três aparecem como capítulos depois da figura principal; nas filhas, a faixa de
      // páginas irmãs traz a atual com aria-current. O mesmo rótulo não aparece nas duas formas na mesma página.
      for (const p of R.PAINEIS_REDE) expect(h, `${id} -> ${p.id}`).toContain(`href="${R.rotaPainel(p.id)}"`);
      if (id === "p028") expect(h, id).toContain('data-navegacao-local="capitulos"');
      else expect(h, id).toMatch(new RegExp(`aria-current="page"[^>]*>${R.PAINEIS_REDE.find((p) => p.id === id)!.rotulo}<`));
      expect(h.length, id).toBeLessThan(600_000);
      const m = principal(h);
      expect(m, id).not.toMatch(/em breve|em integração|em construção|indisponíve/i);
      expect(m, id).not.toMatch(/—/);
    }
  });

  it("P028: título da página, esquema de fluxos com lista no celular e o painel do último ano com PLD", () => {
    const h = html.p028;
    // o título da abertura é a pergunta do painel (a pergunta do módulo, mais longa, segue no menu: ver o teste do destino Rede)
    expect(h).toContain(`>${R.perguntaPainel("p028")}</h1>`);
    expect(h).toContain("Esquema sem escala geográfica");
    expect(h).toContain('role="group"');
    expect((h.match(/aria-pressed="false"/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(h).toContain('id="fluxo-e-preco"');
    expect(h).toContain(`Energia escondida pelo saldo de 30 dias, ${R.nomeFronteira("N_SE")}`);
  });

  it("P029 e P030: frases do A05, bloqueio dos limites e documentos conferidos visíveis", () => {
    expect(html.p029).toContain('data-textos="a05"');
    expect(html.p029).toContain(escapa(R.frasesA05(G.achados.A05)[0].slice(0, 40)));
    expect(html.p030).toContain("Limites operativos de intercâmbio: sem fonte aberta");
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

/* ---------------------------------------------------------------- revisão da interface (01/10/2026) */

describe("revisão da interface: defeitos corrigidos ficam cobertos", () => {
  const paginas = { p028: PaginaCirculacao, p029: PaginaBalanco, p030: PaginaRestricoes, p031: PaginaProgramado } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  /** Texto visível do conteúdo principal, sem marcação. */
  const visivel = (h: string) =>
    h
      .slice(h.indexOf("<main"), h.indexOf("</main>"))
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");

  it("nenhuma data ISO no texto visível: tabelas e frases usam DD/MM/AAAA (identificadores de versão e de snapshot à parte)", () => {
    for (const [id, h] of Object.entries(html)) {
      const t = visivel(h)
        .replace(/Versão dos dados: \S+/g, "")
        .replace(/@\d{4}-\d{2}-\d{2}T[\d:]+Z/g, "");
      expect(t.match(/\b20\d\d-\d\d(-\d\d)?([T ]\d\d:\d\d)?\b/g), id).toBeNull();
    }
  });

  it("P028: os saldos das fronteiras comparadas têm tabela equivalente com as mesmas linhas do gráfico", () => {
    const t = ler("src/components/energia/RedeCirculacao.tsx");
    for (const v of ["saldoDiario", "saldoMensal"]) {
      expect(t).toMatch(new RegExp(`dados=\\{${v}\\}`));
      expect(t).toContain(`linhas={paraTabela(${v})}`);
    }
    const pares = ["N_SE", "S_SE"] as const;
    const linhas = R.linhasSaldoMensal(G.circulacao, pares);
    const cols = R.colunasSaldoFronteiras("m", pares);
    const m = matrizExportacao(cols, R.paraTabela(linhas));
    expect(m.linhas.length).toBe(G.circulacao.mensal.meses.length);
    const k = G.circulacao.mensal.meses.length - 1;
    expect(m.linhas[k][2]).toBe(G.circulacao.mensal.por_par.S_SE.liquido_mwh[k]);
    expect(html.p028).toContain("Tabela equivalente: saldo mensal das fronteiras escolhidas");
  });

  it("P029: identidades de Itaipu nunca transformam contagem ausente em zero diferença", () => {
    expect(R.textoIdentidadesItaipu({ linhas: null, total_diferente_de_60_mais_50: null, brasil_diferente_de_60_mais_50_brasil: null })).toMatch(/não conferidas/);
    const parcial = R.textoIdentidadesItaipu({ linhas: 100, total_diferente_de_60_mais_50: 2, brasil_diferente_de_60_mais_50_brasil: null });
    expect(parcial).toContain("98 de 100 horas");
    expect(parcial).toContain("não conferido");
    expect(html.p029).toContain(R.textoIdentidadesItaipu(G.exterior.itaipu_identidades));
  });

  it("P030: início do arquivo do ATLS lido da gold confere com o primeiro mês do CSV; nenhum ano escrito à mão", () => {
    const meses = csv("rede_atls.csv").map((l) => l.mes).sort();
    expect(R.inicioArquivoAtls(G.restricoes.atls)).toBe(meses[0]);
    const t = ler("src/components/energia/RedeRestricoes.tsx");
    expect(t).not.toMatch(/desde 20\d\d/);
    expect(t).not.toMatch(/em uma hora/);
    // a perturbação sai com data e hora brasileiras na célula e com os segundos no arquivo baixado
    const p = R.linhasPerturbacoes(G.restricoes.interrupcoes.perturbacoes_recentes)[0];
    const bruto = G.restricoes.interrupcoes.perturbacoes_recentes[0].inicio;
    expect(p.inicio).toBe(bruto.replace(" ", "T"));
    expect(visivel(html.p030)).toContain(`${dataBR(bruto)} ${bruto.slice(11, 16)}`);
  });

  it("P031: nos países a regra do programa repetido não se aplica (nem zero nem 'não')", () => {
    expect(new Set(R.linhasProgramadoDiario(G.programado, "ARGENTINA").map((l) => l.dia_rotulado))).toEqual(new Set([R.NAO_SE_APLICA]));
    expect(R.linhasProgramadoMensal(G.programado, "URUGUAI").every((l) => l.dias_rotulados === null)).toBe(true);
    expect(R.colunasProgramadoMensal("URUGUAI").some((c) => c.id === "dias_rotulados")).toBe(false);
    expect(R.colunasProgramadoMensal("N_NE").some((c) => c.id === "dias_rotulados")).toBe(true);
    expect(R.linhasProgramadoDiario(G.programado, "N_NE").some((l) => l.dia_rotulado === "sim")).toBe(G.programado.programa_repetido.dias.some((d) => G.programado.diario.dias.includes(d.dia)));
  });

  it("P031: o aviso de mês incompleto só aparece quando as horas comparadas ficam abaixo do calendário (conferido no CSV horário)", () => {
    expect(R.horasDoMes("2024-02")).toBe(696);
    expect(R.horasDoMes("2026-02")).toBe(672);
    expect(R.avisoMesIncompleto("2026-08", 744)).toBeNull();
    const m = G.programado.mensal.meses.at(-1)!;
    const horasCsv = HORARIO_2026.filter((l) => l.data_hora.startsWith(m) && n(l.fluxo_N_NE) !== null && n(l.prog_N_NE) !== null).length;
    expect(G.programado.mensal.por_par.N_NE!.horas.at(-1)).toBe(horasCsv);
    const aviso = R.avisoMesIncompleto(m, horasCsv);
    if (horasCsv < R.horasDoMes(m)) expect(aviso).toContain(`${num(horasCsv, 0)} de ${num(R.horasDoMes(m), 0)} horas comparadas`);
    else expect(aviso).toBeNull();
  });

  it("limitações da proveniência: uma por item, sem lista aninhada nem caminho interno da gold", () => {
    const aninhada = { limitacoes: ["Primeira.", ["Segunda (9 sem dado; lista por país em cobertura.exterior): ausência.", "Terceira."]] as unknown as string[] };
    expect(R.provenienciaLegivel(aninhada).limitacoes).toEqual(["Primeira.", "Segunda (9 sem dado): ausência.", "Terceira."]);
    for (const k of Object.keys(G.proveniencia) as (keyof typeof G.proveniencia)[]) {
      const l = R.provenienciaLegivel(G.proveniencia[k]).limitacoes;
      for (const x of l) {
        expect(typeof x, k).toBe("string");
        expect(x, k).not.toMatch(/\b[a-z]+_[a-z0-9_]+\.[a-z0-9_.]+\b|\bcobertura\.[a-z]/);
      }
    }
    expect(visivel(html.p029)).not.toContain("não são preenchidas.País");
  });

  it("metadados das páginas sem data escrita à mão: lidos da gold", () => {
    for (const a of ["src/app/setor-eletrico/rede/page.tsx", "src/app/setor-eletrico/rede/balanco-e-exterior/page.tsx", "src/app/setor-eletrico/rede/programado/page.tsx"]) {
      const t = ler(a);
      expect(t, a).not.toMatch(/\d{2}\/\d{2}\/20\d\d|desde 20\d\d/);
    }
  });
});

/* ---------------------------------------------------------------- abertura editorial (faixa de métricas, esquema e carregamento da janela horária) */

describe("abertura editorial da Rede: faixas lidas dos mesmos seletores das figuras, e o esquema com as setas visíveis", () => {
  const paginas = { p028: PaginaCirculacao, p029: PaginaBalanco, p030: PaginaRestricoes, p031: PaginaProgramado } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const principal = (h: string) => h.slice(h.indexOf("<main"), h.indexOf("</main>"));
  const escapa = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it("cada página abre com a pergunta do painel como título (5 a 9 palavras), uma faixa de métricas e a figura depois da barra de profundidade", () => {
    for (const id of ["p028", "p029", "p030", "p031"] as const) {
      const h = html[id];
      expect(h, id).toContain(`>${R.perguntaPainel(id)}</h1>`);
      expect(R.perguntaPainel(id).split(/\s+/).length, id).toBeGreaterThanOrEqual(5);
      expect(R.perguntaPainel(id).split(/\s+/).length, id).toBeLessThanOrEqual(9);
      expect((h.match(/data-faixa-metricas=""/g) ?? []).length, id).toBe(1);
      // a faixa vem antes da barra de profundidade, e o painel (a figura principal) depois dela
      expect(h.indexOf('data-faixa-metricas=""'), id).toBeLessThan(h.indexOf('aria-label="Nível de profundidade"'));
      expect(h.indexOf('aria-label="Nível de profundidade"'), id).toBeLessThan(h.indexOf(`id="${id}"`));
      // o título da primeira figura não repete o da página
      expect(h, id).not.toContain(`id="${id}-titulo" class="ed-h2 font-serif text-carvao">${escapa(R.perguntaPainel(id))}<`);
      // nenhuma página chama o esquema de mapa
      expect(principal(h), id).not.toMatch(/\bmapa\b/i);
    }
  });

  it("P028: a faixa traz o saldo de cada fronteira em 30 dias, com o sentido no rótulo e o que passou no sentido contrário; o resumo confere com as horas do CSV", () => {
    const m = R.medidasFronteiras30d(G.circulacao.resumo_30d);
    expect(m.map((x) => x.par)).toEqual([...R.FRONTEIRAS]);
    for (const x of m) {
      const r = G.circulacao.resumo_30d.find((y) => y.par === x.par)!;
      expect(x.valor, x.par).toBe(Math.abs(r.liquido_mwh));
      expect(x.periodo, x.par).toBe(`${dataBR(r.inicio)} a ${dataBR(r.fim)}`);
      expect(x.rotulo, x.par).toContain(`Saldo em ${r.dias} dias, ${R.textoSentidoSaldo(x.par, r.liquido_mwh)}`);
      // o saldo nunca aparece sozinho: ou diz o que passou no sentido contrário, ou que o fluxo foi num só sentido
      if (r.horas_canonico > 0 && r.horas_inverso > 0) expect(x.nota, x.par).toContain(`No sentido contrário: ${num(r.contra_saldo_mwh, 0)} MWh`);
      else expect(x.nota, x.par).toContain("Fluxo num só sentido");
      if (r.dias_com_reversao > 0) expect(x.nota, x.par).toContain(`Troca de sentido em ${r.dias_com_reversao} de ${r.dias} dias`);
      // as mesmas contas refeitas das horas do CSV do ano (outro arquivo): saldo, energia em cada sentido e o que o saldo esconde
      const horas = HORARIO_2026.filter((l) => l.data_hora.slice(0, 10) >= r.inicio && l.data_hora.slice(0, 10) <= r.fim).map((l) => n(l[`fluxo_${x.par}`])).filter((v): v is number => v !== null);
      expect(horas.length, x.par).toBe(r.horas);
      const pos = horas.filter((v) => v > 0).reduce((a, v) => a + v, 0);
      const neg = -horas.filter((v) => v < 0).reduce((a, v) => a + v, 0);
      expect(Math.abs(pos - neg - r.liquido_mwh), x.par).toBeLessThan(2);
      expect(Math.abs(Math.min(pos, neg) - r.contra_saldo_mwh), x.par).toBeLessThan(2);
    }
    // as quatro fronteiras na faixa, com a unidade de energia
    const h = html.p028;
    const faixa = h.slice(h.indexOf('data-faixa-metricas=""'), h.indexOf('aria-label="Nível de profundidade"'));
    for (const x of m) expect(faixa).toContain(escapa(x.rotulo));
    expect(faixa).toContain("MWh");
    expect(faixa).toContain("limites operativos não são públicos");
    // sem fluxo publicado, ausência com motivo, nunca zero
    const vazio = R.medidasFronteiras30d([]);
    for (const x of vazio) expect(x.valor).toBeNull();
  });

  it("P029: a faixa lê as mesmas identidades da tabela (horas com resíduo, horas conferidas) e o saldo internacional de 12 meses", () => {
    const h = html.p029;
    const faixa = h.slice(h.indexOf('data-faixa-metricas=""'), h.indexOf('aria-label="Nível de profundidade"'));
    const sin = G.balanco.identidades.find((x) => x.id === "balanco.SIN")!;
    const sul = G.balanco.identidades.find((x) => x.id === "perimetro.S")!;
    expect(G.evidencias.a05_balanco_sin!.valor_calculo).toBe(sin.horas_residuo);
    expect(G.evidencias.a05_perimetro_sul!.valor_calculo).toBe(sul.horas_residuo);
    expect(faixa).toContain(`De ${num(sin.horas, 0)} horas conferidas`);
    expect(faixa).toContain(`De ${num(sul.horas, 0)} horas conferidas`);
    expect(faixa).toContain(escapa(G.evidencias.exterior_12m!.valor_exibido));
    expect((faixa.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // o perímetro está dito em palavras à vista: a segunda conta (intercâmbio contra fronteiras e exterior) tem nome e fórmula
    const corpo = principal(h);
    expect(corpo).toContain("intercâmbio menos as fronteiras e o exterior");
    expect(corpo).toContain("Resíduo é a diferença");
    // exterior, horas com resíduo por região e Itaipu continuam na página, com âncora
    for (const id of ["residuo-mensal", "residuo-horas", "exterior", "itaipu", "a05", "quebra-mmgd", "identidades", "cobertura-exterior", "dicionarios"]) expect(corpo, id).toContain(`id="${id}"`);
  });

  it("P030: a faixa conta os fluxos acima do limite e o de mais horas pelo mesmo arquivo do gráfico; os limites sem fonte aberta ficam à vista", () => {
    const m = R.medidasRestricoes(G.restricoes);
    const ativos = R.fluxosAtivos(G.restricoes.atls);
    expect(m.fluxosAcima!.de).toBe(ativos.length);
    expect(m.fluxosAcima!.valor).toBe(ativos.filter((f) => (f.ultimos_12_meses?.horas_violacao ?? 0) > 0).length);
    expect(m.maisHoras!.fluxo).toBe(ativos[0].fluxo);
    // refeito do CSV mensal do ATLS: soma dos 12 últimos meses publicados do fluxo de mais horas
    const linhas = csv("rede_atls.csv").filter((l) => l.fluxo === m.maisHoras!.fluxo && l.periodicidade === "ME");
    const meses = linhas.map((l) => l.mes).sort();
    const ultimos = new Set(meses.slice(-12));
    const soma = linhas.filter((l) => ultimos.has(l.mes)).reduce((a, l) => a + (n(l.horas_violacao) ?? 0), 0);
    expect(Math.abs(soma - m.maisHoras!.horas)).toBeLessThan(0.05);
    // o veredito diz a mesma contagem
    expect(R.vereditoRestricoes(G.restricoes)).toContain(`${m.fluxosAcima!.valor} dos ${m.fluxosAcima!.de} fluxos`);
    // o estado bloqueado: o bloco fica à vista, sem número de utilização inventado
    const h = html.p030;
    expect(h).toContain("Limites operativos de intercâmbio: sem fonte aberta");
    expect(principal(h)).not.toMatch(/\d+\s?% de utilização|utilização de \d/i);
    // sem fluxo publicado no último mês, a faixa não inventa contagem
    const sem = R.medidasRestricoes({ atls: { ...G.restricoes.atls, fluxos: G.restricoes.atls.fluxos.map((f) => ({ ...f, ativo: false })) } });
    expect(sem.fluxosAcima).toBeNull();
    expect(sem.maisHoras).toBeNull();
  });

  it("P031: a faixa acompanha o par e a base: desvio médio, mediana, horas materiais e sentido oposto refeitos das horas do CSV", () => {
    const lim = G.programado.limiar_material_mwmed;
    for (const par of ["N_NE", "S_SE"] as const) {
      const linhas = HORARIO_2026.filter((l) => n(l[`fluxo_${par}`]) !== null && n(l[`prog_${par}`]) !== null);
      const f = linhas.map((l) => n(l[`fluxo_${par}`])!);
      const p = linhas.map((l) => n(l[`prog_${par}`])!);
      const desvio = f.map((v, i) => Math.abs(v - p[i]));
      const ordenado = [...desvio].sort((a, b) => a - b);
      const mediana = ordenado.length % 2 ? ordenado[(ordenado.length - 1) / 2] : (ordenado[ordenado.length / 2 - 1] + ordenado[ordenado.length / 2]) / 2;
      const m = R.medidasProgramado(G.programado, par, "com")!;
      expect(m.horas, par).toBe(linhas.length);
      expect(Math.abs(m.desvio_abs_medio_mwmed - desvio.reduce((a, v) => a + v, 0) / desvio.length), par).toBeLessThan(0.5);
      expect(Math.abs(m.p50_abs_mwmed - mediana), par).toBeLessThan(0.5);
      expect(m.horas_materiais, par).toBe(desvio.filter((d) => d >= lim).length);
      expect(m.horas_inversao, par).toBe(f.filter((v, i) => Math.abs(v) > R.LIMIAR_NULO_MWMED && Math.abs(p[i]) > R.LIMIAR_NULO_MWMED && Math.sign(v) !== Math.sign(p[i])).length);
      expect(m.limiar_mwmed).toBe(lim);
      expect(m.dias_excluidos).toBe(0);
      // a base sem os dias rotulados exclui horas, nunca soma: menos horas, e os dias excluídos vêm da gold
      const s = R.medidasProgramado(G.programado, par, "sem")!;
      expect(s.horas, par).toBeLessThanOrEqual(m.horas);
      expect(s.dias_excluidos, par).toBe(G.programado.distribuicao[par]?.dias_rotulados ?? 0);
    }
    // o par sem horas comparáveis não vira zero
    const vazio = copia(G.programado);
    delete (vazio.distribuicao as Record<string, unknown>).N_NE;
    expect(R.medidasProgramado(vazio, "N_NE", "com")).toBeNull();
    // a faixa da página lê a mesma distribuição: quatro medidas, com a ressalva de que desvio não é falha
    const h = html.p031;
    const faixa = h.slice(h.indexOf('data-faixa-metricas=""'), h.indexOf('aria-label="Nível de profundidade"'));
    expect((faixa.match(/ed-faixa-grade/g) ?? []).length).toBe(1);
    expect(faixa).toContain("a fonte não informa o motivo");
    expect(faixa).toContain("Comprove este número");
    expect(faixa).toContain("Horas com o fluxo no sentido oposto ao programado");
  });

  it("esquema de fluxos: toda seta termina fora dos retângulos e à vista, o rótulo traz o sentido, o saldo e o contrário, e nada sai da área do desenho", () => {
    const fluxos = [
      { par: "N_NE" as const, valor: -94244, rotuloValor: "94.244 MWh", linhas: ["contrário: 0 MWh"] },
      { par: "N_SE" as const, valor: 36511, rotuloValor: "36.511 MWh", linhas: ["contrário: 3.077 MWh", "1 troca de sentido"] },
      { par: "NE_SE" as const, valor: 140730, rotuloValor: "140.730 MWh", linhas: ["contrário: 0 MWh"] },
      { par: "S_SE" as const, valor: 25528, rotuloValor: "25.528 MWh", linhas: ["contrário: 25.729 MWh", "2 trocas de sentido"] },
    ];
    const svg = renderToStaticMarkup(
      createElement(RedeEsquemaFluxos, {
        titulo: "Saldo de cada fronteira no dia",
        periodo: "29/09/2026",
        unidade: "MWh",
        fluxos,
        exterior: [
          { pais: "ARGENTINA" as const, valor: 138, rotuloValor: "138 MWmed" },
          { pais: "URUGUAI" as const, valor: -40, rotuloValor: "40 MWmed" },
        ],
        selecionado: null,
        onSelecionar: () => {},
      }),
    );
    const caixas = Array.from(svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="(150|112)" height="(52|36)"/g)).map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
    // quatro subsistemas e dois países
    expect(caixas.length).toBe(6);
    const linhasComSeta = Array.from(svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"[^>]*marker-end="url\(#rede-seta[^)]*\)"/g)).map((m) => ({ x2: +m[3], y2: +m[4] }));
    // uma seta por fronteira com saldo e uma por país com fluxo
    expect(linhasComSeta.length).toBe(6);
    for (const l of linhasComSeta) {
      for (const c of caixas) {
        const dentro = l.x2 > c.x && l.x2 < c.x + c.w && l.y2 > c.y && l.y2 < c.y + c.h;
        expect(dentro, `ponta da seta em (${l.x2.toFixed(0)}, ${l.y2.toFixed(0)}) dentro de um retângulo`).toBe(false);
      }
    }
    // os rótulos das fronteiras (156 de largura) e as caixas ficam dentro da área do desenho
    const area = svg.match(/viewBox="0 0 (\d+) (\d+)"/)!;
    for (const m of Array.from(svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g))) {
      expect(+m[1], "borda esquerda").toBeGreaterThanOrEqual(0);
      expect(+m[2], "borda de cima").toBeGreaterThanOrEqual(0);
      expect(+m[1] + +m[3], "borda direita").toBeLessThanOrEqual(+area[1]);
      expect(+m[2] + +m[4], "borda de baixo").toBeLessThanOrEqual(+area[2]);
    }
    // sentido por siglas, saldo e contrário escritos no rótulo; trocas de sentido à vista
    expect(svg).toContain("NE → N");
    expect(svg).toContain("N → SE/CO");
    expect(svg).toContain("S → SE/CO");
    expect(svg).toContain("contrário: 25.729 MWh");
    expect(svg).toContain("2 trocas de sentido");
    // esquema, não mapa: a legenda diz que não há escala geográfica nem capacidade
    const fig = svg.slice(svg.indexOf("<figcaption"), svg.indexOf("</figcaption>"));
    expect(fig).toContain("Esquema sem escala geográfica");
    expect(fig).toContain("não indica capacidade nem proximidade de limite");
    expect(svg).not.toMatch(/\bmapa\b/i);
  });

  it("a janela horária não cancela o próprio download: o efeito não depende do estado de carregamento e há 'Tentar de novo'", () => {
    const t = ler("src/components/energia/RedeCirculacao.tsx");
    // um efeito que dependesse de janela.estado seria refeito ao mudar para "carregando", e o resultado do download seria descartado
    const efeito = t.slice(t.indexOf("useEffect(() => {"), t.indexOf("const fr = (v.fr"));
    expect(efeito).toContain("[escala, c.janela_horaria.url, tentativa]");
    expect(efeito).not.toMatch(/\[[^\]]*janela\.estado[^\]]*\]/);
    expect(efeito).toContain("baixada.current = true");
    expect(t).toContain("setTentativa((t) => t + 1)");
  });
});
