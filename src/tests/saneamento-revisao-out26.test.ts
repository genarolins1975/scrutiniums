import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FichaMunicipio from "@/app/saneamento/municipio/[id]/page";
import MetodologiaPage from "@/app/saneamento/metodologia/page";
import PlanejamentoPage from "@/app/saneamento/planejamento/page";
import ResilienciaPage from "@/app/saneamento/resiliencia/page";
import ResponsaveisPage from "@/app/saneamento/responsaveis/page";
import EsgotoPage from "@/app/saneamento/esgoto/page";
import TarifaSocialPage from "@/app/saneamento/tarifa-social/page";
import { acimaDaCapacidade, agregado, etes, fichaMunicipio, meta, municipios } from "@/lib/saneamento/gold";
import { LIMITE_RAZAO_TARIFA_SOCIAL, agregarMedida, medida, razaoTarifaSocial } from "@/lib/saneamento/medidas";
import { inteiro, mesAno, numero } from "@/lib/saneamento/formato";
import atos from "@/lib/saneamento/dados/atos.json";

/**
 * Correções da revisão independente de 16/10/2026: nenhum valor impossível na ficha, tarifa por prestador com a soma que a razão
 * usa, razão acima do universo elegível sinalizada, N efetivo dos pares e a ressalva dos índices da NR 8 acima de 100%.
 * Os municípios de teste são escolhidos pelo dado, não por código fixo.
 */
const lista = municipios();
const html = (id: string) => renderToStaticMarkup(createElement(FichaMunicipio, { params: { id } }));
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Ficha municipal: tarifa social", () => {
  it("o valor médio declarado (GFI1037) não é publicado na ficha, mesmo onde o gold o traz", () => {
    const comValor = lista.find((m) => (fichaMunicipio(m.id)?.sinisa.prestadores ?? []).some((v) => typeof v.tarifa?.GFI1037 === "number" && v.tarifa.GFI1037 > 1000));
    expect(comValor).toBeTruthy();
    const t = texto(html(comValor!.id));
    expect(t).not.toContain("Valor médio declarado da tarifa social");
    expect(t).not.toMatch(/por mês/);
    expect(t).toContain("GFI1037");
  });

  it("com mais de um prestador de água, cada um aparece e a soma usada na razão é rotulada", () => {
    const multi = lista.find((m) => (fichaMunicipio(m.id)?.sinisa.prestadores ?? []).filter((v) => v.servico === "agua" && v.tarifa).length > 1 && m.ts_economias != null);
    expect(multi).toBeTruthy();
    const f = fichaMunicipio(multi!.id)!;
    const nomes = f.sinisa.prestadores!.filter((v) => v.servico === "agua" && v.tarifa);
    const t = texto(html(multi!.id));
    expect(t).toContain("soma dos prestadores de água");
    const soma = nomes.reduce((s, v) => s + (typeof v.tarifa!.GFI1036 === "number" ? v.tarifa!.GFI1036 : 0), 0);
    expect(multi!.ts_economias).toBe(soma);
    expect(t).toContain(numero(multi!.ts_economias, 0));
  });

  it("razão acima do universo elegível fica sinalizada; abaixo, não", () => {
    const acima = lista.find((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    const normal = lista.find((m) => {
      const r = razaoTarifaSocial(m);
      return r != null && r > 0 && r <= LIMITE_RAZAO_TARIFA_SOCIAL;
    });
    expect(acima && normal).toBeTruthy();
    expect(texto(html(acima!.id))).toContain("Declaração do prestador a verificar");
    expect(texto(html(normal!.id))).not.toContain("Declaração do prestador a verificar");
  });

  it("os meses do CadÚnico vêm da meta, não de texto digitado", () => {
    const c = meta()!.cadunico;
    const t = texto(html(lista.find((m) => m.cad_fam_ms != null)!.id));
    expect(t).toContain(`CadÚnico com renda per capita até meio salário-mínimo, ${mesAno(c.mes_referencia)}`);
    expect(t).toContain(`Mesmo critério, ${mesAno(c.mes_mais_recente)}`);
  });
});

describe("Medida da razão de tarifa social", () => {
  const med = medida("tarifa-social-por-familia-elegivel");

  it("acima do limite sai das classes, mas a soma publicada continua a mesma", () => {
    const acima = lista.filter((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    expect(acima.length).toBeGreaterThan(0);
    for (const m of acima) expect(med.pct(m), m.id).toBeNull();
    for (const m of lista) {
      const r = razaoTarifaSocial(m);
      if (r != null && r <= LIMITE_RAZAO_TARIFA_SOCIAL) expect(med.pct(m), m.id).toBeCloseTo(r, 9);
    }
    // referência agregada = razão de somas do gold (inclui as declarações sinalizadas, que a página declara)
    const ag = agregarMedida(med, lista);
    expect(ag.municipios).toBeGreaterThan(lista.filter((m) => med.pct(m) != null && med.pct(m)! > 0).length);
  });

  it("a página declara quantos são, quanto somam e qual seria a razão sem eles", () => {
    const acima = lista.filter((m) => (razaoTarifaSocial(m) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
    const t = texto(renderToStaticMarkup(createElement(TarifaSocialPage)));
    expect(t).toContain("Declarações acima do universo elegível");
    expect(t).toContain(`${numero(acima.length, 0)} municípios declaram mais economias com tarifa social do que famílias elegíveis`);
    expect(t).toContain("nem aqui nem na ficha de cada município");
  });
});

describe("NR 8: índices acima de 100%", () => {
  it("a ficha explica o valor acima de 100% e a página de planejamento conta quantos são", () => {
    const m = lista.find((x) => (x.iaa_rede ?? 0) > 100)!;
    expect(texto(html(m.id))).toContain("Acima de 100%: as economias ativas excedem a estimativa de domicílios ocupados");
    const t = texto(renderToStaticMarkup(createElement(PlanejamentoPage)));
    const n = lista.filter((x) => (x.iaa_rede ?? 0) > 100).length;
    expect(t).toContain(`${numero(n, 0)} deles passam de 100%`);
    expect(t).toContain("Por que o IAA do Brasil não é o IAG0004");
    expect(t).not.toMatch(/NaN|undefined/);
  });

  it("o IAA do Brasil limitado a 100% por município é menor que a razão de somas", () => {
    const com = lista.filter((x) => x.nr8_ag_num != null && x.dom_est24 != null && x.dom_est24 > 0 && x.iaa_rede != null);
    const dom = com.reduce((s, x) => s + x.dom_est24!, 0);
    const soma = (com.reduce((s, x) => s + x.nr8_ag_num!, 0) / dom) * 100;
    const limitado = (com.reduce((s, x) => s + Math.min(x.nr8_ag_num!, x.dom_est24!), 0) / dom) * 100;
    expect(limitado).toBeLessThan(soma);
    const t = texto(renderToStaticMarkup(createElement(PlanejamentoPage)));
    expect(t).toContain(`o IAA do Brasil é ${numero(soma, 1)}%`);
    expect(t).toContain(`cai para ${numero(limitado, 1)}%`);
  });
});

describe("Ficha municipal: comparação", () => {
  it("cada linha dos pares informa o N efetivo e a nota declara que os universos diferem", () => {
    const m = lista.find((x) => x.nome === "Borá") ?? lista.find((x) => x.pop22 != null && x.pop22 < 5000)!;
    const t = texto(html(m.id));
    expect(t).toMatch(/\d[\d.]* de \d[\d.]* municípios com valor/);
    expect(t).toContain("As colunas não têm o mesmo universo");
    expect(t).toContain("Pares (mediana)");
  });

  it("valor não nulo que arredonda para zero não aparece como 0,0%", () => {
    const f = lista
      .map((m) => ({ m, q: fichaMunicipio(m.id)?.qualidade }))
      .find(({ q }) => q && Object.keys(q).some((k) => /^qa_.*_num$/.test(k) && (q[k] ?? 0) > 0 && (q[k.replace(/_num$/, "_den")] ?? 0) > 2000 && (q[k] / q[k.replace(/_num$/, "_den")]) * 100 < 0.05));
    if (!f) return; // sem caso no gold atual: a regra vale quando houver
    expect(texto(html(f.m.id))).toContain("menos de 0,");
  });
});

describe("Itens abertos da revisão 1.11 (c e f)", () => {
  const comMotivo = (motivo: string) => lista.find((m) => fichaMunicipio(m.id)?.sinisa.agua.motivos?.IAG3004 === motivo);

  it("c: duração média sem número por divisão por zero diz que o município declarou 0 paralisações", () => {
    const m = comMotivo("nao_calculado_divisao_zero");
    expect(m).toBeTruthy();
    const ag = fichaMunicipio(m!.id)!.sinisa.agua;
    expect(ag.tecnica?.GTA3001).toBe(0);
    const t = texto(html(m!.id));
    expect(t).toContain("Duração média: não se calcula, porque o município declarou 0 paralisações (horas divididas por zero eventos).");
    expect(t).not.toContain("Duração média: sem dado");
  });

  it("c: toda ausência classificada como divisão por zero tem 0 paralisações; com duração calculada há paralisações", () => {
    for (const m of lista) {
      const ag = fichaMunicipio(m.id)?.sinisa.agua;
      if (!ag) continue;
      const v = ag.indicadores?.IAG3004;
      if (ag.motivos?.IAG3004 === "nao_calculado_divisao_zero") expect(ag.tecnica?.GTA3001).toBe(0);
      if (v != null) expect(ag.tecnica?.GTA3001 ?? 0).toBeGreaterThan(0);
    }
  });

  it("c: município sem bloco técnico de água não ganha a explicação de divisão por zero", () => {
    const m = comMotivo("nao_informado");
    expect(m).toBeTruthy();
    expect(fichaMunicipio(m!.id)!.sinisa.agua.tecnica).toBeFalsy();
    const t = texto(html(m!.id));
    expect(t).toContain("Sem declaração de continuidade");
    expect(t).not.toContain("não se calcula, porque");
  });

  it("f: estação acima da capacidade é contada sem arredondar a utilização", () => {
    expect(acimaDaCapacidade({ capacidade_nominal_ls: 1, volume_tratado_mil_m3: 31.54 })).toBe(true);
    expect(acimaDaCapacidade({ capacidade_nominal_ls: 5.5, volume_tratado_mil_m3: 173.45 })).toBe(true);
    expect(acimaDaCapacidade({ capacidade_nominal_ls: 1, volume_tratado_mil_m3: 31.536 })).toBe(false);
    expect(acimaDaCapacidade({ capacidade_nominal_ls: 0, volume_tratado_mil_m3: 10 })).toBeNull();
    expect(acimaDaCapacidade({ capacidade_nominal_ls: 10 })).toBeNull();
  });

  it("f: a página de esgoto mostra a contagem sem arredondamento, acima da obtida com a utilização de uma casa", () => {
    const operando = etes().filter((e) => e.em_operacao === "Sim");
    const exata = operando.filter((e) => acimaDaCapacidade(e) === true).length;
    const arredondada = operando.filter((e) => (e.utilizacao_pct ?? 0) > 100).length;
    expect(exata).toBeGreaterThan(arredondada);
    const t = texto(renderToStaticMarkup(createElement(EsgotoPage)));
    expect(t).toContain(`acima da capacidade nominal ${inteiro(exata)}`);
  });

  it("e: municípios com interrupção sistemática sem motivo informado aparecem numa barra própria que fecha o total", () => {
    const c = agregado("BR")!.continuidade;
    const somaMotivos = Object.values(c.motivos_interrupcoes).reduce((a, b) => a + b, 0);
    const semMotivo = c.municipios_com_interrupcoes - somaMotivos;
    expect(semMotivo).toBeGreaterThan(0);
    const t = texto(renderToStaticMarkup(createElement(ResilienciaPage)));
    expect(t).toContain("Sem motivo informado");
    expect(t).toContain("A última barra reúne quem declarou interrupção sem informar o motivo.");
  });

  it("e: o KPI de respondentes sem regulador de água explica a diferença para a resposta Sim da tabela por UF", () => {
    const g = agregado("BR")!.gestao;
    const respondentes = lista.filter((m) => m.gm_respondeu === "Sim");
    const semReg = respondentes.filter((m) => m.reg_ag == null).length;
    const dif = g.regulacao_agua_sim - (respondentes.length - semReg);
    expect(dif).toBeGreaterThan(0);
    const t = texto(renderToStaticMarkup(createElement(ResponsaveisPage)));
    expect(t).toContain(`Respondentes sem entidade reguladora declarada para água ${inteiro(semReg)}`);
    expect(t).toContain(`Inclui ${inteiro(dif)} ${dif === 1 ? "município que respondeu" : "municípios que responderam"} Sim à pergunta de regulação sem informar a entidade`);
  });

  it("h: a Deliberação ARSESP 1.699 tem a data do ato (01/08/2025) e a vigência retroativa (01/06/2025), lidas no PDF", () => {
    const a = (atos as { atos: { ato: string; data: string; vigencia: string; obs: string }[] }).atos.find((x) => x.ato.startsWith("Deliberação 1.699"));
    expect(a).toBeTruthy();
    expect(a!.data).toBe("2025-08-01");
    expect(a!.vigencia).toBe("01/06/2025 (efeitos retroativos)");
    expect(a!.obs).toContain("art. 5º");
  });

  it("h: todo ato verificado traz data completa (AAAA-MM-DD); só atos não lidos ficam com o ano", () => {
    const lista = (atos as { atos: { ato: string; data: string | null; verificado: boolean }[] }).atos;
    for (const a of lista.filter((x) => x.verificado)) expect(a.data, a.ato).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const a of lista.filter((x) => x.data != null && !/^\d{4}-\d{2}-\d{2}$/.test(x.data!))) expect(a.verificado, a.ato).toBe(false);
  });

  it("d: a ficha de UF com colunas de contagem que não fecham avisa; a de UF que fecha não avisa", () => {
    const conf = meta()!.conferencias.find((c) => c.id === "agua_retificacao_contagens")!;
    expect(conf.detalhe!.length).toBeGreaterThan(0);
    const ufsComDiferenca = new Set(conf.detalhe!.map((d) => d.uf));
    const com = lista.find((m) => ufsComDiferenca.has(m.uf))!;
    const sem = lista.find((m) => !ufsComDiferenca.has(m.uf))!;
    const n = conf.detalhe!.filter((d) => d.uf === com.uf).length;
    const aviso = `(publicação de 18/12/2025, sem data de retificação) não fecha com a base municipal de água, retificada em 25/05/2026: em ${inteiro(n)} colunas de ligações e economias`;
    expect(texto(html(com.id))).toContain(aviso);
    expect(texto(html(com.id))).toContain("O efeito sobre os indicadores da UF não foi medido.");
    expect(texto(html(sem.id))).not.toContain("não fecha com a base municipal de água");
  });

  it("d: a metodologia lista as colunas que não fecham e a conclusão cita as datas das duas planilhas", () => {
    const conf = meta()!.conferencias.find((c) => c.id === "agua_retificacao_contagens")!;
    const t = texto(renderToStaticMarkup(createElement(MetodologiaPage)));
    expect(t).toContain("A planilha técnica municipal declara publicação em 18/12/2025 e retificação em 25/05/2026");
    expect(t).toContain("a consolidada por UF declara publicação em 18/12/2025, sem data de retificação");
    for (const d of conf.detalhe!) expect(t).toContain(`${d.uf}, ${d.codigo}: ${d.nome}`);
    const pop = meta()!.conferencias.find((c) => c.id === "agua_retificacao")!;
    expect(pop.valores.diferenca).toBe(0);
    expect(pop.conclusao).not.toContain("A diferença é publicada");
  });

  it("colunas sem soma: a metodologia publica GTA0019, GTA3006 e GTA1014 com os números da conferência", () => {
    const conf = meta()!.conferencias.find((c) => c.id === "agua_colunas_sem_soma")!;
    expect(conf.valores.gta0019_ufs_consolidado_igual_a_gta0001_mais_gta0002).toBe(27);
    expect(conf.valores.gta3006_ufs_consolidado_igual_a_media_truncada).toBe(27);
    const t = texto(renderToStaticMarkup(createElement(MetodologiaPage)));
    expect(t).toContain("GTA3006: em 27 das 27 UFs o consolidado é a parte inteira da média de dias por município que informou o campo");
    expect(t).toContain(`a coluna GTA0019 da planilha municipal está vazia em ${inteiro(conf.valores.gta0019_municipios_vazios!)} municípios`);
    // o painel de resiliência usa a soma municipal, que é o número que a conferência diz usar
    expect(texto(renderToStaticMarkup(createElement(ResilienciaPage)))).toContain(inteiro(conf.valores.gta3006_soma_municipal_dias!));
  });
});
