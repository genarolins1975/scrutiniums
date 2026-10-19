import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConteudoFaixaFrescor } from "@/components/frescor/FaixaFrescorCliente";
import {
  IDS_DOMINIOS,
  cadencias,
  dataPublicacao,
  extrairFrescor,
  instante,
  referenciaNormal,
  rotuloReferencia,
  situacaoDominio,
  textoRegra,
  valoresNoCampo,
  type DadosFrescor,
} from "@/lib/frescor";
import { dadosFrescor } from "@/lib/frescor/dominios";
import { FRESCOR_DAS_COLECOES, FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";
import limiares from "@/lib/frescor/limiares.json";
import casos from "@/lib/frescor/casos.json";

/**
 * Faixa de frescor por domínio (banca de 19/10/2026): a entrada do Setor
 * Elétrico mostrava o PLD de 30/09 em 19/10 sem que o leitor soubesse do atraso,
 * e o Crédito ficou retido de 24/09 a 13/10 com execuções verdes. O que se trava:
 * - a regra e os limiares são os mesmos da vigília (casos.json nas duas linguagens
 *   e a extração dos arquivos reais comparada com a do script Python);
 * - ausência de data vira "data não informada", nunca uma data inventada;
 * - o atraso aparece em texto explícito, com marcador neutro, sem cor de julgamento;
 * - o HTML do build não afirma estar em dia: a situação é calculada no navegador;
 * - toda entrada com conta exibe a faixa na primeira tela e no rodapé de método.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const AGORA = new Date("2026-10-19T12:00:00Z");

describe("regra compartilhada com a vigília (casos.json)", () => {
  it.each(casos.situacao.map((c) => [c.nome, c] as const))("%s", (_n, c) => {
    const s = situacaoDominio(c.dados as DadosFrescor, new Date(c.agora));
    expect({ estado: s.estado, dias: s.dias, atrasoDias: s.atrasoDias }).toEqual(c.esperado);
  });

  it("caminhos de campo", () => {
    for (const c of casos.campos) expect(valoresNoCampo(c.objeto, c.campo)).toEqual(c.valores);
  });

  it("datas publicadas: sem hora é meia-noite de Brasília; sem fuso é UTC; o resto não é data", () => {
    for (const c of casos.instantes) expect(instante(c.valor)?.toISOString() ?? null).toBe(c.iso);
  });

  it("referências: ano, mês ou dia; texto livre não é referência", () => {
    for (const c of casos.referencias) expect(referenciaNormal(c.valor)).toBe(c.normal);
  });

  it.each(casos.extracao.map((c) => [c.nome, c] as const))("extração: %s", (_n, c) => {
    const arquivos = c.arquivos as Record<string, unknown>;
    const leitor = (a: string) => {
      if (!(a in arquivos)) throw new Error(`ausente: ${a}`);
      return arquivos[a];
    };
    expect(extrairFrescor(c.dominio as DadosFrescor["id"], leitor)).toEqual(c.esperado);
  });

  it("a extração dos arquivos publicados é a mesma no TypeScript e no script da vigília", () => {
    const py = execFileSync(
      "python3",
      ["-c", "import json,sys; sys.path.insert(0,'scripts'); import vigilancia_frescor as v; L=v.carregar_limiares(); print(json.dumps([v.extrair(L,d,v.ler_do_checkout) for d in L['dominios']]))"],
      { cwd: raiz, encoding: "utf-8" },
    );
    expect(dadosFrescor(IDS_DOMINIOS)).toEqual(JSON.parse(py));
  });

  it("todo domínio publicado traz data e referência; nenhum fica sem data por campo renomeado", () => {
    for (const d of dadosFrescor(IDS_DOMINIOS)) {
      expect(d.publicadoEm, d.id).not.toBeNull();
      expect(d.referencia, d.id).not.toBeNull();
    }
  });

  it("limiares: cada cadência tem limiar maior ou igual ao intervalo, e o selo do Crédito usa o da diária", () => {
    for (const c of cadencias()) expect(c.limite).toBeGreaterThanOrEqual(c.intervalo);
    const vig = ler("scripts/vigilancia.py");
    expect(vig).toContain('"src" / "lib" / "frescor" / "limiares.json"');
    expect(vig).toMatch(/LIMITE_DIAS = .*\["cadencias"\]\["diaria"\]\["limite"\]/);
    expect(ler("scripts/vigilancia_frescor.py")).toContain('"src" / "lib" / "frescor" / "limiares.json"');
  });

  it("a regra escrita para o leitor cita os limiares do arquivo", () => {
    const t = textoRegra();
    for (const c of Object.values(limiares.cadencias)) expect(t).toContain(`${c.rotulo}, ${c.limite}`);
  });
});

describe("datas legíveis", () => {
  it("publicação no calendário de Brasília; referência na granularidade da fonte", () => {
    expect(dataPublicacao("2026-09-30T02:20:25Z")).toBe("29/09/2026");
    expect(dataPublicacao("2026-10-17")).toBe("17/10/2026");
    expect(dataPublicacao("2026-09-30T02:20:25Z", "en")).toBe("Sep 29, 2026");
    expect(dataPublicacao(null)).toBeNull();
    expect(rotuloReferencia("2026-09-30")).toBe("30/09/2026");
    expect(rotuloReferencia("2026-08")).toBe("ago/2026");
    expect(rotuloReferencia("2024")).toBe("2024");
    expect(rotuloReferencia("2026-08", "en")).toBe("Aug 2026");
  });
});

describe("faixa renderizada", () => {
  const ENERGIA: DadosFrescor = { id: "energia", publicadoEm: "2026-09-30T02:20:25Z", parteMaisRecente: "2026-09-30T02:20:41Z", referencia: "2026-09-30" };
  const CREDITO: DadosFrescor = { id: "credito", publicadoEm: "2026-10-18T15:09:35+00:00", parteMaisRecente: null, referencia: "2026-08" };
  const html = (dados: DadosFrescor[], agora: Date | null, extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(ConteudoFaixaFrescor, { dados, variante: "linha", agora, ...extra }));
  const SEM_JULGAMENTO = /\b(text|bg|border)-(erro|red|green|emerald|rose|verde|vermelho|sucesso|alerta)\b/;

  it("o HTML do build traz as datas e não afirma situação", () => {
    const h = html([ENERGIA], null);
    expect(h).toContain('data-frescor-geral="calculando"');
    expect(h).toContain("29/09/2026");
    expect(h).toContain("30/09/2026");
    expect(h).toContain("diária");
    expect(h).not.toMatch(/Em dia|atrasada|retida|data-frescor-estado/);
  });

  it("atrasado: texto explícito com os dias, marcador neutro e nenhuma cor de julgamento", () => {
    const h = html([ENERGIA], AGORA);
    expect(h).toContain('data-frescor-estado="atrasado"');
    expect(h).toContain("Atualização atrasada há 18 dias");
    expect(h).toContain("<svg");
    expect(h).toContain("Dados diários de preço e operação");
    expect(h).toContain("(PLD)");
    expect(h).not.toMatch(SEM_JULGAMENTO);
  });

  it("em dia: sem marcador de aviso", () => {
    const h = html([CREDITO], AGORA);
    expect(h).toContain('data-frescor-estado="em-dia"');
    expect(h).toContain("Em dia");
    expect(h).not.toContain("<svg");
  });

  it("sem data: 'data não informada', nunca uma data inventada, e situação não avaliada", () => {
    const h = html([{ id: "gas", publicadoEm: null, parteMaisRecente: null, referencia: null }], AGORA);
    expect(h).toContain("data não informada");
    expect(h).toContain("Referência</span> <span class=\"tabular-nums text-carvao\">não informada");
    expect(h).toContain("Situação não avaliada");
    expect(h).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("retida em parte: diz que parte da publicação ficou para trás", () => {
    const h = html([{ ...CREDITO, publicadoEm: "2026-09-24T15:25:15+00:00", parteMaisRecente: "2026-10-18T15:09:35+00:00" }], AGORA);
    expect(h).toContain('data-frescor-estado="retida"');
    expect(h).toContain("Publicação retida em parte há 23 dias");
  });

  it("várias fontes: resumo numa linha com o domínio atrasado nomeado e a lista por fonte recolhida", () => {
    const h = html([CREDITO, ENERGIA], AGORA);
    expect(h).toContain("2 fontes");
    expect(h).toContain("Atualizadas entre 29/09/2026 e 18/10/2026");
    expect(h).toContain("Setor Elétrico: atualização atrasada há 18 dias");
    expect(h).toContain("<details");
    expect(h).toContain('data-frescor-dominio="credito"');
    expect(h).toContain('data-frescor-regra=""');
    expect(html([CREDITO], AGORA, { variante: "linha" })).not.toContain("<details");
    expect(html([CREDITO, { ...CREDITO, id: "agro", publicadoEm: "2026-10-17" }], AGORA)).toContain("Todas em dia");
  });

  it("método: lista por fonte com nota e regra", () => {
    const h = html([ENERGIA], AGORA, { variante: "metodo" });
    expect(h).toContain('data-frescor-faixa="metodo"');
    expect(h).toContain("sete publicações diárias");
    expect(h).toContain("O cálculo é feito no seu navegador");
  });

  it("inglês no Setor Elétrico", () => {
    const h = html([ENERGIA], AGORA, { idioma: "en" });
    expect(h).toContain("Data updates");
    expect(h).toContain("Update late by 18 days");
    expect(h).toContain("Sep 29, 2026");
    expect(h).toContain("Daily price and operation data");
    expect(h).not.toMatch(/Atualização|atrasada|diária/);
  });
});

describe("entradas com conta: faixa na primeira tela e no método", () => {
  it("o componente é de cliente e calcula a situação num efeito, com o relógio do leitor", () => {
    const c = ler("src/components/frescor/FaixaFrescorCliente.tsx");
    expect(c.startsWith('"use client"')).toBe(true);
    expect(c).toMatch(/useEffect\(\(\) => \{[\s\S]*setAgora\(new Date\(\)\)/);
  });

  const PAGINAS: Record<keyof typeof FRESCOR_DAS_COLECOES, string> = {
    "/setor-eletrico": "src/app/setor-eletrico/page.tsx",
    "/gas-natural": "src/app/gas-natural/page.tsx",
    "/saneamento": "src/app/saneamento/page.tsx",
    "/eficiencia-estatal": "src/app/eficiencia-estatal/page.tsx",
    "/contas-publicas": "src/app/contas-publicas/page.tsx",
    "/agronegocio": "src/app/agronegocio/page.tsx",
  };

  it.each(Object.entries(PAGINAS))("%s: linha antes do conteúdo e lista no rodapé de método", (rota, arquivo) => {
    const s = ler(arquivo);
    const usos = s.match(/<FaixaFrescor [^>]*\/>/g) ?? [];
    expect(usos).toHaveLength(2);
    expect(usos[0]).not.toContain('variante="metodo"');
    expect(usos[1]).toContain('variante="metodo"');
    for (const u of usos) expect(u).toMatch(new RegExp(`FRESCOR_DAS_COLECOES\\[["']${rota}["']\\]`));
    // a linha vem antes de qualquer título da página
    expect(s.indexOf(usos[0]!)).toBeLessThan(Math.max(s.indexOf("<h1"), s.indexOf("<AberturaFederal"), s.indexOf("<AtlasCidadao")));
  });

  it("entradas que reúnem coleções recebem a faixa e a lista por fonte", () => {
    const s = ler("src/app/observatorios/[id]/page.tsx");
    expect(s).toMatch(/frescor=\{<FaixaFrescor dominios=\{FRESCOR_DOS_OBSERVATORIOS\[id\]\}/);
    expect(s).toMatch(/frescorMetodo=\{<FaixaFrescor dominios=\{FRESCOR_DOS_OBSERVATORIOS\[id\]\} variante="metodo"/);
    const e = ler("src/components/observatorios/EntradaObservatorio.tsx");
    expect(e.indexOf("{frescor}")).toBeGreaterThan(0);
    expect(e.indexOf("{frescor}")).toBeLessThan(e.indexOf("<h1"));
    expect(e.indexOf("{frescorMetodo")).toBeGreaterThan(e.indexOf("Método e fontes"));
  });

  // De onde cada entrada que reúne coleções lê os números: cada domínio lido aparece na faixa.
  const DOMINIO_DA_PASTA: Record<string, string> = { obs: "credito", energia: "energia", gas: "gas", saneamento: "saneamento", agro: "agro", territorio: "territorio", eficiencia: "eficiencia" };
  const ARQUIVO_DA_ENTRADA: Record<keyof typeof FRESCOR_DOS_OBSERVATORIOS, string> = {
    familias: "familias",
    "servicos-publicos": "servicos",
    "territorio-e-clima": "territorio",
    "contas-publicas": "contas",
    "energia-e-infraestrutura": "energia",
    economia: "economia",
  };

  it.each(Object.entries(ARQUIVO_DA_ENTRADA))("%s: a faixa cobre todos os domínios de onde vêm os números", (id, arquivo) => {
    const s = ler(`src/lib/observatorios/entradas/${arquivo}.ts`);
    const lidos = new Set<string>();
    for (const m of s.matchAll(/lerPublico\(\s*"([a-z-]+)"/g)) lidos.add(DOMINIO_DA_PASTA[m[1]] ?? `desconhecido:${m[1]}`);
    if (/@\/lib\/contas-publicas\//.test(s)) lidos.add("contas-federais");
    if (/@\/lib\/contas-estaduais\//.test(s)) lidos.add("contas-estaduais");
    if (/from "\.\/familias"/.test(s)) lidos.add("credito"); // serieCredito, lida do pulse.json
    const declarados = new Set<string>(FRESCOR_DOS_OBSERVATORIOS[id as keyof typeof FRESCOR_DOS_OBSERVATORIOS]);
    expect(lidos.size).toBeGreaterThan(0);
    for (const d of lidos) expect(declarados, `${id} lê ${d}`).toContain(d);
  });
});
