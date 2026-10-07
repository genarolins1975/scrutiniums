import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComproveNumero, ConteudoEvidencia, DialogoEvidencia } from "@/components/energia/ComproveNumero";
import { Numero } from "@/components/energia/Numero";
import {
  citacaoAcademica,
  citacaoBase,
  copiarComFallback,
  dataAbnt,
  descreverVariacao,
  numeroCompleto,
  numeroMaquina,
  problemasEvidencia,
  resumoChaves,
  resumoTestes,
  textoPeriodo,
  textoReproducao,
  unidadeDestaque,
  valorDestaque,
  type Evidencia,
} from "@/lib/energia/evidencia";

/**
 * "Comprove este número" (seção 11.5). O que este teste protege:
 *
 *  1. a citação da interface e a do pipeline (pipeline/energia/evidencia.py) são
 *     o mesmo texto: os dois testes usam o mesmo exemplo e o mesmo texto esperado,
 *     com carimbos UTC que mudam de dia (e de ano) no horário de Brasília;
 *  2. a data de acesso é do leitor, no dia de Brasília, no formato ABNT, e nunca
 *     aparece duas vezes;
 *  3. o valor "antes do arredondamento" mostra todos os algarismos, sem notação
 *     científica e sem arredondar (0,1 + 0,2 continua 0,30000000000000004);
 *  4. os passos de reprodução apontam o commit certo (sem "+alterado"), o hash de
 *     cada arquivo e o valor esperado em formato de máquina;
 *  5. a interface recusa exibir como completa uma prova incompleta (ausência com
 *     algarismo, número sem hash, razão sem denominador, veredito fora do domínio);
 *  6. a variação decide a direção depois de arredondar (+0,04 com uma casa é estável);
 *  7. a cópia desce os três degraus sem lançar erro;
 *  8. o HTML do servidor: botão e diálogo nomeados, dez seções em ordem, testes com
 *     rótulo textual, blocos copiáveis com região de status, "sem dado" para nulo.
 */

const SHA = "ab".repeat(32);

const TARIFA: Evidencia = {
  indicador: "Tarifa residencial mediana",
  valor_exibido: "R$ 0,8123/kWh",
  valor_calculo: 812.3456,
  unidade: "R$/MWh",
  periodo: { inicio: "2026-09-30", fim: "2026-09-30" },
  entidade: "distribuidoras com tarifa B1 vigente",
  universo: "105 distribuidoras",
  filtros: ["subgrupo B1", "modalidade convencional"],
  fonte: {
    orgao: "ANEEL",
    conjunto: "Tarifas de aplicação",
    recurso: "tarifas-vigentes.csv",
    url: "https://dadosabertos.aneel.gov.br/dataset/tarifas",
    arquivo: "bronze/aneel/tarifas/2026-09-30.csv.gz",
    sha256: SHA,
    capturado_em: "2026-10-01T01:30:00Z",
    publicado_em: null,
  },
  extracao_pdf: null,
  chaves_origem: ["tarifa|00394460000141|B1", "tarifa|04895728000180|B1"],
  chaves_total: null,
  consulta: null,
  manifesto: null,
  formula: "mediana(TE + TUSD) entre distribuidoras",
  numerador: null,
  denominador: null,
  pesos: null,
  exclusoes: ["distribuidoras sem tarifa homologada vigente"],
  cobertura: "105 de 108 distribuidoras",
  tratamento_ausencia: "distribuidora sem tarifa vigente fica fora do universo",
  versao: { pipeline: "energia-0.1.0", codigo: "abc123def456", publicacao: "2027-01-01T01:00:00Z" },
  revisoes: "Nenhuma revisão detectada entre as capturas integradas.",
  testes: [
    { nome: "TE e TUSD somam o total", resultado: "aprovado", detalhe: "105 de 105" },
    { nome: "Vigência sem sobreposição", resultado: "ressalva", detalhe: "2 distribuidoras com vigência retroativa" },
    { nome: "Unidade declarada", resultado: "reprovado", detalhe: "1 linha em R$/kWh" },
  ],
  reconciliacao: { descricao: "Mediana recalculada pelo painel da ANEEL", resultado: "aprovado", tolerancia: "0,005 R$/MWh" },
  download: [{ rotulo: "Tarifas vigentes (CSV)", url: "/energia/series/conta_tarifas.csv" }],
  reproducao: "python3 pipeline/energia/executar_modulo.py conta --sem-coleta",
  citacao: "",
};

// mesmo exemplo e mesmo texto de pipeline/tests/test_energia_evidencia.py
const CITACAO_TARIFA =
  "SCRUTINIUMS. Tarifa residencial mediana: R$ 0,8123/kWh, distribuidoras com tarifa B1 vigente, 30/09/2026. " +
  "Observatório Brasileiro do Setor Elétrico, 2026. " +
  "Dados primários: ANEEL, Tarifas de aplicação (recurso tarifas-vigentes.csv, capturado em 30/09/2026). " +
  "Versão energia-0.1.0, código abc123def456, publicada em 31/12/2026. " +
  "Disponível em: https://scrutiniums.com/setor-eletrico.";

const CARGA: Evidencia = {
  ...TARIFA,
  indicador: "Carga média",
  valor_exibido: "123,46",
  valor_calculo: 123.456,
  unidade: "MWmed",
  periodo: { inicio: "2026-09-30T10:00", fim: "2026-09-30T18:00" },
  entidade: "SIN",
  fonte: { ...TARIFA.fonte, orgao: "ONS", conjunto: "Carga horária", recurso: null },
  versao: { ...TARIFA.versao, codigo: null },
};

const CITACAO_CARGA =
  "SCRUTINIUMS. Carga média: 123,46 MWmed, SIN, 30/09/2026 10:00 a 30/09/2026 18:00. " +
  "Observatório Brasileiro do Setor Elétrico, 2026. " +
  "Dados primários: ONS, Carga horária (recurso não identificado, capturado em 30/09/2026). " +
  "Versão energia-0.1.0, código não registrado, publicada em 31/12/2026. " +
  "Disponível em: https://scrutiniums.com/setor-eletrico/carga#media.";

const AUSENTE: Evidencia = {
  ...TARIFA,
  valor_exibido: "sem dado",
  valor_calculo: null,
  numerador: { descricao: "energia injetada", valor: null },
  denominador: { descricao: "energia medida", valor: 1000 },
  fonte: { ...TARIFA.fonte, arquivo: null, sha256: null, capturado_em: null },
  testes: [],
  download: [],
  reconciliacao: null,
};

describe("citação espelhada no pipeline", () => {
  it("mesmo texto do Python: dia e ano de Brasília, unidade só quando o exibido é número puro", () => {
    expect(citacaoBase(TARIFA)).toBe(CITACAO_TARIFA);
    expect(citacaoBase(CARGA, "https://scrutiniums.com/setor-eletrico/carga#media")).toBe(CITACAO_CARGA);
  });

  it("período: instante único, intervalo, hora local e extremos faltantes", () => {
    expect(textoPeriodo({ inicio: "2026-09-30", fim: "2026-09-30" })).toBe("30/09/2026");
    expect(textoPeriodo({ inicio: "2026-01", fim: "2026-09" })).toBe("01/2026 a 09/2026");
    expect(textoPeriodo({ inicio: "2025", fim: "2025" })).toBe("2025");
    expect(textoPeriodo({ inicio: "2026-09-30T10:00", fim: "2026-09-30T10:00" })).toBe("30/09/2026 10:00");
    expect(textoPeriodo({ fim: "2026-09" })).toBe("até 09/2026");
    expect(textoPeriodo({ inicio: "2026-09" })).toBe("09/2026");
    expect(textoPeriodo(null)).toBe("período não informado");
  });
});

describe("citação acadêmica com data de acesso", () => {
  it("acesso no dia de Brasília, mês abreviado da ABNT, dia sem zero à esquerda", () => {
    expect(dataAbnt(new Date("2026-10-01T02:00:00Z"))).toBe("30 set. 2026");
    expect(dataAbnt("2026-05-05T12:00:00Z")).toBe("5 maio 2026");
    expect(citacaoAcademica(TARIFA, new Date("2026-10-01T02:00:00Z"))).toBe(`${CITACAO_TARIFA} Acesso em: 30 set. 2026.`);
  });

  it("usa a citação publicada; um acesso já gravado é trocado pelo do leitor, nunca duplicado", () => {
    const publicada = { ...TARIFA, citacao: "SCRUTINIUMS. Texto publicado. Acesso em: 1 jan. 2020." };
    const c = citacaoAcademica(publicada, "2026-09-30T15:00:00Z");
    expect(c).toBe("SCRUTINIUMS. Texto publicado. Acesso em: 30 set. 2026.");
    expect(c.match(/Acesso em/g)).toHaveLength(1);
  });

  it("com endereço, recalcula para apontar à página e à âncora do número", () => {
    const c = citacaoAcademica({ ...TARIFA, citacao: "texto antigo" }, "2026-09-30T15:00:00Z", "https://scrutiniums.com/setor-eletrico/conta#tarifa");
    expect(c).toContain("Disponível em: https://scrutiniums.com/setor-eletrico/conta#tarifa. Acesso em: 30 set. 2026.");
    expect(c).not.toContain("texto antigo");
  });
});

describe("valor antes do arredondamento", () => {
  it("todos os algarismos em pt-BR, sem notação científica", () => {
    expect(numeroCompleto(812.3456)).toBe("812,3456");
    expect(numeroCompleto(0.1 + 0.2)).toBe("0,30000000000000004");
    expect(numeroCompleto(1234567.5)).toBe("1.234.567,5");
    expect(numeroCompleto(-0.5)).toBe("−0,5");
    expect(numeroCompleto(1e-7)).toBe("0,0000001");
    expect(numeroCompleto(-2.5e-8)).toBe("−0,000000025");
    expect(numeroCompleto(1.5e21)).toBe("1.500.000.000.000.000.000.000");
    expect(numeroCompleto(0)).toBe("0");
    expect(numeroCompleto(null)).toBe("sem dado");
    expect(numeroCompleto(Number.NaN)).toBe("sem dado");
  });

  it("formato de máquina para comparar com a saída do programa", () => {
    expect(numeroMaquina(-1234567.25)).toBe("-1234567.25");
    expect(numeroMaquina(1e-7)).toBe("0.0000001");
    expect(numeroMaquina(1e21)).toBe("1000000000000000000000");
    expect(numeroMaquina(null)).toBe("sem dado");
  });
});

describe("texto de reprodução", () => {
  it("passos numerados com commit, hash, comando, observações, fórmula e valor esperado", () => {
    const t = textoReproducao(TARIFA);
    expect(t).toContain("git checkout abc123def456");
    expect(t).toContain(`sha256sum bronze/aneel/tarifas/2026-09-30.csv.gz deve resultar em ${SHA}`);
    expect(t).toContain("python3 pipeline/energia/executar_modulo.py conta --sem-coleta");
    expect(t).toContain("Chaves: tarifa|00394460000141|B1; tarifa|04895728000180|B1");
    expect(t).toContain("mediana(TE + TUSD) entre distribuidoras");
    expect(t).toContain("valor antes do arredondamento 812.3456 R$/MWh; exibido como R$ 0,8123/kWh");
    const passos = t.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => Number(l.split(".")[0]));
    expect(passos).toEqual([1, 2, 3, 4, 5, 6]);
    expect(t).not.toMatch(/undefined|null|NaN/);
  });

  it("código com alteração fora do commit: checkout do commit base e aviso", () => {
    const t = textoReproducao({ ...TARIFA, versao: { ...TARIFA.versao, codigo: "abc123def456+alterado" } });
    expect(t).toContain("git checkout abc123def456\n");
    expect(t).not.toContain("git checkout abc123def456+alterado");
    expect(t).toContain("Atenção");
    expect(textoReproducao(CARGA)).toContain("Código não registrado nesta publicação");
  });

  it("vários arquivos, lista truncada com manifesto, consulta e comando de várias linhas", () => {
    const t = textoReproducao({
      ...TARIFA,
      fonte: {
        ...TARIFA.fonte,
        arquivos: [
          { recurso: "CMO_2025.csv", arquivo: "bronze/ons/cmo_2025.csv.gz", sha256: "c".repeat(64), capturado_em: "2026-01-02T03:00:00Z", publicado_em: "2026-01-01" },
          { recurso: "CMO_2026.csv", arquivo: "bronze/ons/cmo_2026.csv.gz", sha256: null, capturado_em: "2026-09-30T03:00:00Z", publicado_em: null },
        ],
      },
      chaves_total: 1234,
      consulta: "SELECT * FROM observacoes WHERE serie LIKE 'cmo|%'",
      manifesto: { rotulo: "Manifesto das chaves (CSV)", url: "/energia/manifestos/cmo.csv" },
      reproducao: "cd pipeline\npython3 -m energia.run --modulo pld",
    });
    expect(t).toContain(`sha256sum bronze/ons/cmo_2025.csv.gz deve resultar em ${"c".repeat(64)}`);
    expect(t).toContain("Integridade: sha256 não registrado para este arquivo.");
    expect(t).not.toContain(SHA); // o arquivo único da fonte não entra quando há lista de arquivos
    expect(t).toContain("Lista truncada: 2 de 1234.");
    expect(t).toContain("Manifesto completo: /energia/manifestos/cmo.csv");
    expect(t).toContain("Consulta: SELECT * FROM observacoes");
    expect(t).toContain("   cd pipeline\n   python3 -m energia.run --modulo pld");
  });

  it("número ausente: diz que não há valor, sem inventar zero", () => {
    const t = textoReproducao(AUSENTE);
    expect(t).toContain('não há valor para este recorte');
    expect(t).toContain("Numerador: energia injetada = sem dado");
    expect(t).not.toMatch(/antes do arredondamento 0\b/);
  });
});

describe("conferência da evidência na interface", () => {
  it("evidência completa não tem problema; ausência sem arquivo nem teste também não", () => {
    expect(problemasEvidencia(TARIFA)).toEqual([]);
    expect(problemasEvidencia(AUSENTE)).toEqual([]);
  });

  it("recusa ausência exibida como número e número sem prova", () => {
    expect(problemasEvidencia({ ...AUSENTE, valor_exibido: "0,0" })).toContain("valor de cálculo ausente, mas a tela mostra um número");
    const semHash = problemasEvidencia({ ...TARIFA, fonte: { ...TARIFA.fonte, sha256: "ABC" }, testes: [], download: [] });
    expect(semHash).toEqual(expect.arrayContaining(["arquivo da fonte sem sha256 válido", "nenhum teste executado", "sem download dos dados"]));
    expect(problemasEvidencia({ ...TARIFA, chaves_origem: [] })).toContain("sem chaves nem consulta das observações de origem");
    expect(problemasEvidencia({ ...TARIFA, chaves_origem: [], consulta: "SELECT 1" })).toEqual([]);
    expect(problemasEvidencia({ ...TARIFA, valor_calculo: Number.POSITIVE_INFINITY })).toContain("valor de cálculo não é número finito nem ausência");
  });

  it("razão sem um dos termos, veredito fora do domínio e tolerância sem unidade", () => {
    expect(problemasEvidencia({ ...TARIFA, numerador: { descricao: "x", valor: 1 } })).toContain("numerador sem denominador (ou o contrário)");
    const legado = { ...TARIFA, testes: [{ nome: "t", resultado: "falhou", detalhe: "" }] } as unknown as Evidencia;
    expect(problemasEvidencia(legado)[0]).toMatch(/resultado fora de aprovado, ressalva, reprovado/);
    expect(problemasEvidencia({ ...TARIFA, reconciliacao: { ...TARIFA.reconciliacao!, tolerancia: "" } })).toContain("reconciliação sem tolerância com unidade");
  });
});

describe("resumos de testes e de chaves", () => {
  it("conta por veredito e escreve a frase", () => {
    const r = resumoTestes(TARIFA.testes);
    expect([r.aprovado, r.ressalva, r.reprovado, r.fora]).toEqual([1, 1, 1, 0]);
    expect(r.texto).toBe("3 testes: 1 aprovado, 1 com ressalva, 1 reprovado.");
    expect(resumoTestes([{ resultado: "aprovado" }, { resultado: "aprovado" }]).texto).toBe("2 testes: 2 aprovados, nenhum com ressalva, nenhum reprovado.");
    expect(resumoTestes([{ resultado: "executado" }]).texto).toBe("1 teste: nenhum aprovado, nenhum com ressalva, nenhum reprovado, 1 com resultado fora do padrão.");
    expect(resumoTestes([]).texto).toBe("Nenhum teste registrado para este número.");
  });

  it("lista, lista truncada com e sem manifesto, e consulta", () => {
    expect(resumoChaves(TARIFA)).toBe("2 chaves de origem.");
    expect(resumoChaves({ chaves_origem: ["a"], chaves_total: 12345, manifesto: { rotulo: "m", url: "/m.csv" } })).toBe(
      "Primeiras 1 de 12.345 chaves de origem. A lista completa está no manifesto para baixar.",
    );
    expect(resumoChaves({ chaves_origem: ["a", "b"], chaves_total: 3 })).toContain("não foi publicada");
    expect(resumoChaves({ chaves_origem: [], consulta: "SELECT" })).toMatch(/^Observações selecionadas pela consulta/);
  });
});

describe("número de destaque", () => {
  it("ausência é 'sem dado'; zero é valor", () => {
    expect(valorDestaque(null)).toBe("sem dado");
    expect(valorDestaque(Number.NaN, "reais")).toBe("sem dado");
    expect(valorDestaque(0)).toBe("0,0");
    expect(valorDestaque(812.3456, "reais", 2)).toBe("R$ 812,35");
    expect(valorDestaque(-12.34, "pct", 1)).toBe("−12,3%");
    expect(unidadeDestaque("R$/MWh", "reais")).toBe("/MWh");
    expect(unidadeDestaque("%", "pct")).toBe("");
    expect(unidadeDestaque("% da energia injetada", "pct")).toBe("da energia injetada");
    expect(unidadeDestaque("% da EAR máxima", "variacao_pct")).toBe("da EAR máxima");
    expect(unidadeDestaque("% da energia injetada")).toBe("% da energia injetada");
    expect(unidadeDestaque("MWmed")).toBe("MWmed");
  });

  it("variação decide a direção depois de arredondar", () => {
    expect(descreverVariacao({ valor: 0.04, casas: 1, sufixo: "%", referencia: "em relação ao dia anterior" })).toMatchObject({
      direcao: "estavel",
      glifo: "=",
      texto: "0,0%",
    });
    const q = descreverVariacao({ valor: -3.25, casas: 1, sufixo: "%", referencia: "em relação ao dia anterior" });
    expect(q).toEqual({ direcao: "queda", glifo: "▼", texto: "−3,3%", leitura: "Queda de 3,3% em relação ao dia anterior." });
    expect(descreverVariacao({ valor: 12.5, casas: 2, sufixo: " R$/MWh", referencia: "na semana" }).texto).toBe("+12,50 R$/MWh");
    expect(descreverVariacao({ valor: null, referencia: "na semana" })).toMatchObject({ direcao: null, glifo: null, texto: "sem dado" });
  });
});

describe("cópia com três degraus", () => {
  const erro = () => {
    throw new Error("bloqueado");
  };
  it("área de transferência, seleção com comando antigo, seleção só, e falha", async () => {
    const escrito: string[] = [];
    expect(await copiarComFallback("x", { clipboard: { writeText: async (t) => void escrito.push(t) } })).toBe("copiado");
    expect(escrito).toEqual(["x"]);
    const negado = { writeText: () => Promise.reject(new Error("negado")) };
    expect(await copiarComFallback("x", { clipboard: negado, selecionar: () => true, copiarSelecao: () => true })).toBe("copiado");
    expect(await copiarComFallback("x", { clipboard: negado, selecionar: () => true, copiarSelecao: () => false })).toBe("selecionado");
    expect(await copiarComFallback("x", { clipboard: null, selecionar: () => true, copiarSelecao: erro })).toBe("selecionado");
    expect(await copiarComFallback("x", { clipboard: null, selecionar: () => false })).toBe("falhou");
    expect(await copiarComFallback("x", { selecionar: erro })).toBe("falhou");
  });
});

/* ---------------------------------------------------------------- servidor */

const semTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("renderização no servidor", () => {
  it("ComproveNumero: botão nomeado que abre um diálogo rotulado; conteúdo só na primeira abertura", () => {
    const botao = renderToStaticMarkup(createElement(ComproveNumero, { evidencia: TARIFA }));
    expect(botao).toMatch(/<button type="button" aria-haspopup="dialog"[^>]*>Comprove este número<span class="sr-only">: Tarifa residencial mediana, R\$ 0,8123\/kWh<\/span><\/button>/);
    // o servidor não emite o <dialog> junto do botão: dentro de um <p>, ele fecharia o parágrafo e quebraria a hidratação
    expect(botao).not.toContain("<dialog");
    const ref = { current: null };
    const html = renderToStaticMarkup(createElement(DialogoEvidencia, { evidencia: TARIFA, dialogo: ref, gatilho: ref, montado: false, acesso: null }));
    const rotulado = html.match(/<dialog aria-labelledby="([^"]+)"/);
    expect(rotulado).not.toBeNull();
    expect(html).toContain(`<h2 id="${rotulado![1]}"`);
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Fechar"');
    expect(html).not.toContain("Valor de cálculo");
    const valor = renderToStaticMarkup(createElement(ComproveNumero, { evidencia: TARIFA, variante: "valor" }));
    expect(semTags(valor)).toContain("R$ 0,8123/kWh: comprove este número (Tarifa residencial mediana)");
  });

  it("ficha: dez seções numeradas em ordem, valor completo, testes com rótulo textual, blocos copiáveis", () => {
    const html = renderToStaticMarkup(createElement(ConteudoEvidencia, { evidencia: TARIFA, acesso: new Date("2026-10-01T02:00:00Z") }));
    const titulos = Array.from(html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g), (m) => semTags(m[1]));
    expect(titulos.map((t) => Number.parseInt(t, 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(titulos[0]).toContain("Valor exibido e valor de cálculo");
    expect(titulos[9]).toContain("Como citar");
    // cada seção é uma região nomeada pelo seu título
    const ids = Array.from(html.matchAll(/<section aria-labelledby="([^"]+)"/g), (m) => m[1]);
    expect(ids).toHaveLength(10);
    for (const id of ids) expect(html).toContain(`<h3 id="${id}"`);
    expect(html).toContain("812,3456");
    expect(html).toContain(SHA);
    const t = semTags(html);
    for (const r of ["✓Aprovado", "!Com ressalva", "✕Reprovado"]) expect(t).toContain(r);
    expect(t).toContain("3 testes: 1 aprovado, 1 com ressalva, 1 reprovado.");
    expect(t).toContain("Tolerância: 0,005 R$/MWh");
    expect(html).toMatch(/<a href="\/energia\/series\/conta_tarifas.csv" download=""/);
    expect(html).toMatch(/<a href="https:\/\/dadosabertos.aneel.gov.br\/dataset\/tarifas" target="_blank" rel="noopener noreferrer"/);
    expect(html.match(/role="status"/g)).toHaveLength(2);
    expect(html.match(/<button type="button"[^>]*>Copiar (passos|citação)<\/button>/g)).toHaveLength(2);
    expect(t).toContain(`${CITACAO_TARIFA} Acesso em: 30 set. 2026.`);
    expect(t).toContain("Não se aplica: o número não é uma razão.");
    expect(html).not.toContain('role="note"');
  });

  it("ficha de número ausente: 'sem dado' com hachura, nunca zero", () => {
    const html = renderToStaticMarkup(createElement(ConteudoEvidencia, { evidencia: AUSENTE, acesso: null }));
    const t = semTags(html);
    expect(t).toContain("sem dado");
    expect(t).toContain("ausência não é zero");
    expect(html).toContain("repeating-linear-gradient");
    expect(t).toContain("energia injetada");
    expect(t).not.toMatch(/Valor de cálculo\s*0/);
    expect(t).toContain("Acesso em: [data do seu acesso].");
    expect(t).toContain("sha256 não registrado");
  });

  it("ficha incompleta avisa em vez de parecer prova", () => {
    const html = renderToStaticMarkup(createElement(ConteudoEvidencia, { evidencia: { ...TARIFA, testes: [] }, acesso: null }));
    expect(html).toContain('role="note"');
    expect(semTags(html)).toContain("nenhum teste executado");
  });

  it("Numero: grupo nomeado, valor em pt-BR, unidade sem repetir R$, selo, variação lida em palavras e prova acoplada", () => {
    const html = renderToStaticMarkup(
      createElement(Numero, {
        rotulo: "Tarifa residencial mediana",
        natureza: "CALCULADO",
        formato: "reais",
        casas: 2,
        evidencia: TARIFA,
        variacao: { valor: -3.25, casas: 1, sufixo: "%", referencia: "em relação ao mês anterior" },
        cor: "var(--serie-1)",
      }),
    );
    expect(html).toContain('role="group" aria-label="Tarifa residencial mediana"');
    const t = semTags(html);
    expect(t).toContain("R$ 812,35/MWh");
    expect(t).toContain("30/09/2026");
    expect(t).toContain("Natureza do dado: Calculado");
    expect(html).toContain('<span class="sr-only">Queda de 3,3% em relação ao mês anterior.</span>');
    expect(html).toMatch(/<span aria-hidden="true"><span class="mr-1">▼<\/span>−3,3% em relação ao mês anterior<\/span>/);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("background:var(--serie-1)");
  });

  it("Numero ausente: 'sem dado' com motivo, nenhum algarismo no lugar do valor", () => {
    const html = renderToStaticMarkup(
      createElement(Numero, { rotulo: "Perdas não técnicas", valor: null, unidade: "%", periodo: "2025", natureza: "OBSERVADO", motivoAusencia: "A ANEEL não publicou 2025." }),
    );
    const t = semTags(html);
    expect(t).toContain("sem dado");
    expect(t).toContain("A ANEEL não publicou 2025.");
    expect(t).not.toMatch(/0,0/);
    expect(html).not.toContain("aria-haspopup");
  });
});
