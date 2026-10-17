import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import PaginaPrestadores from "@/app/saneamento/prestadores/page";
import PaginaPrestador from "@/app/saneamento/prestadores/[id]/page";
import PaginaMetodologia from "@/app/saneamento/metodologia/page";
import { agregado, controleDoPrestador, controleSocietario, meta, prestador, prestadores } from "@/lib/saneamento/gold";
import { achatar, controladoresDiretos, pctSocietario, referenciaPosteriorAoRecebimento, resumoControlador } from "@/lib/saneamento/controle";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { VIABILIDADE } from "@/lib/saneamento/viabilidade";
import { inteiro, numero } from "@/lib/saneamento/formato";
import type { Acionista } from "@/lib/saneamento/tipos";

/**
 * Capítulo 7: posição acionária das companhias abertas (CVM, Formulário de Referência), ligada aos prestadores do SINISA por CNPJ.
 */
const raiz = process.cwd();
const companhias = controleSocietario();
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const bruto = (arquivo: string) => readFileSync(join(raiz, "public", "saneamento", "gold", arquivo), "utf-8");
const CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/;

describe("Controle societário: gold", () => {
  it("as companhias abertas declaradas no SINISA têm ficha, uma ficha por companhia, e o documento é o FRE do ano", () => {
    const m = meta()!.cvm!;
    expect(companhias).toHaveLength(m.companhias);
    expect(companhias.length).toBeGreaterThanOrEqual(10);
    expect(m.sem_ficha).toEqual([]);
    expect(m.sem_posicao).toEqual([]);
    const usados = companhias.map((c) => c.prestador);
    expect(new Set(usados).size).toBe(usados.length);
    for (const c of companhias) {
      expect(prestador(c.prestador!), c.cnpj).not.toBeNull();
      expect(c.cobertura_municipios_ficha!, c.cnpj).toBeGreaterThanOrEqual(m.regras.limiar_ficha);
      expect(c.documento.recebido_em, c.cnpj).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.documento.link, c.cnpj).toMatch(/^https?:\/\/www\.rad\.cvm\.gov\.br\//);
      expect(controleDoPrestador(c.prestador!)?.cnpj).toBe(c.cnpj);
    }
    expect(m.zip.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(m.membros)).toHaveLength(2);
  });

  it("as posições diretas somam 100% e os acionistas de cada acionista fecham 100%, dentro do arredondamento da fonte", () => {
    const tol = meta()!.cvm!.regras.tolerancia_pct;
    const filhosSomam = (nos: Acionista[], campo: "pct_on" | "pct_total") => {
      const pais: Acionista[] = nos.filter((n) => n.filhos.length > 0);
      for (const n of pais) {
        const s = n.filhos.reduce((a, f) => a + (f[campo] ?? 0), 0);
        // soma exata só quando todos os filhos aparecem; filhos zerados saem da árvore sem alterar a soma
        expect(Math.abs(s - 100), `${n.nome} ${campo}`).toBeLessThanOrEqual(tol + 1e-9);
        filhosSomam(n.filhos, campo);
      }
    };
    for (const c of companhias) {
      for (const campo of ["pct_on", "pct_total"] as const) {
        expect(Math.abs(c.acionistas.reduce((a, n) => a + (n[campo] ?? 0), 0) - 100), `${c.cnpj} ${campo}`).toBeLessThanOrEqual(tol + 1e-9);
        filhosSomam(c.acionistas, campo);
      }
    }
  });

  it("pessoa física só aparece com nome se controla ou participa de acordo; as demais entram somadas, e não há CPF", () => {
    for (const c of companhias) {
      for (const { no } of achatar(c)) {
        if (no.tipo === "PF" && no.agregado == null) expect(no.controlador || no.acordo, `${c.cnpj} ${no.nome}`).toBe(true);
        if (no.agregado != null) {
          expect(no.nome).toMatch(/pessoas? físicas? não controladoras?/);
          expect(no.filhos).toEqual([]);
        }
        if (no.tipo === "PF") expect(no.cnpj).toBeNull();
      }
    }
    for (const arquivo of ["controle_societario.json", "controle_societario.csv"]) expect(bruto(arquivo), arquivo).not.toMatch(CPF);
    expect(bruto("controle_societario.json")).not.toMatch(/Representante|CPF_CNPJ/i);
  });

  it("o contrato de dado pessoal declara a exceção do capítulo 7 na metodologia e nada diz que nenhum dado de pessoa física é publicado", () => {
    const h = texto(renderToStaticMarkup(createElement(PaginaMetodologia)));
    expect(h).toContain("Sem dado pessoal, com uma exceção declarada");
    expect(h).toContain("CPF não é coletado nem publicado");
    expect(h).not.toContain("Nenhum dado de pessoa física é coletado ou publicado");
    const doc = readFileSync(join(raiz, "docs", "saneamento", "METODOLOGIA.md"), "utf-8");
    expect(doc).toContain("Sem dado pessoal, com uma exceção declarada");
    expect(doc).not.toMatch(/\*\*Sem dado pessoal\.\*\*/);
  });

  it("o seed da CVM no repositório não traz CPF nem as colunas de representante legal", () => {
    const seed = join(raiz, "pipeline", "observatorio_saneamento", "seed", "cvm");
    for (const arquivo of ["posicao_acionaria.csv.gz", "documentos.csv.gz"]) {
      const texto = gunzipSync(readFileSync(join(seed, arquivo))).toString("utf-8");
      expect(texto, arquivo).not.toMatch(CPF);
      expect(texto, arquivo).not.toMatch(/Representante|Nacionalidade/);
    }
  });

  it("o CSV tem uma linha por acionista da árvore, mais o cabeçalho", () => {
    const n = companhias.reduce((a, c) => a + achatar(c).length, 0);
    expect(bruto("controle_societario.csv").trim().split("\n")).toHaveLength(n + 1);
    expect(existsSync(join(raiz, "public", "saneamento", "gold", "controle_societario.csv"))).toBe(true);
  });

  it("a Sanepar declara o Estado do Paraná como controlador, com 60,082% das ordinárias e 20,027% do total", () => {
    const c = companhias.find((x) => x.cnpj === "76.484.013/0001-45")!;
    expect(c.prestador).toBe("sanepar-companhia-de-saneamento-do-parana-s-a");
    const [ctrl] = controladoresDiretos(c);
    expect(ctrl.nome).toBe("Estado do Paraná");
    expect(pctSocietario(ctrl, "pct_on")).toBe(`${numero(60.082, 3)}%`);
    expect(pctSocietario(ctrl, "pct_total")).toBe(`${numero(20.027, 3)}%`);
    expect(resumoControlador(c)).toContain("Estado do Paraná");
  });

  it("companhia sem controlador declarado é dita assim, sem inferir controle; posição minúscula com ações não vira zero", () => {
    const sabesp = companhias.find((x) => x.cnpj === "43.776.517/0001-80")!;
    expect(sabesp.controlador_declarado).toBe(false);
    expect(resumoControlador(sabesp)).toBe("Nenhum controlador declarado");
    const cpp = sabesp.acionistas.find((a) => a.nome.startsWith("COMPANHIA PAULISTA DE PARCERIAS"))!;
    expect(cpp.pct_total).toBe(0);
    expect(cpp.acoes).toBeGreaterThan(0);
    expect(pctSocietario(cpp, "pct_total")).toBe("menos de 0,001%");
  });
});

describe("Controle societário: páginas", () => {
  it("o capítulo 7 abre a seção de controle, com as companhias, o controlador declarado e a ressalva de cobertura", () => {
    const h = texto(renderToStaticMarkup(createElement(PaginaPrestadores)));
    expect(h).not.toMatch(/NaN|undefined|—|–/);
    expect(h).toContain("Quem controla as companhias abertas?");
    expect(h).toContain(`De ${inteiro(prestadores().length)} prestadores declarados; os outros ${inteiro(prestadores().length - companhias.length)}`);
    for (const c of companhias) expect(h, c.cnpj).toContain(c.nome);
    expect(h).toContain("Estado do Paraná");
    expect(h).toContain("Sem controlador declarado não significa sem controle");
    expect(h).toContain("empresas fechadas, sociedades sem registro na CVM");
    // população atendida com água por essas companhias, recalculada por fora da página
    const pop = companhias.reduce((a, c) => a + (prestador(c.prestador!)?.populacao_atendida_agua ?? 0), 0);
    const total = agregado("BR")!.sinisa.agua.pop_atendida!;
    expect(h).toContain(`${numero((pop / total) * 100, 1)}%`);
  });

  it("a ficha de cada companhia mostra o quadro societário, o documento da CVM e o aviso da data de referência", () => {
    for (const c of companhias) {
      const h = texto(renderToStaticMarkup(createElement(PaginaPrestador, { params: { id: c.prestador! } })));
      expect(h, c.cnpj).not.toMatch(/NaN|undefined|—|–/);
      expect(h, c.cnpj).toContain("Quem controla a empresa?");
      expect(h, c.cnpj).toContain(`versão ${c.documento.versao}`);
      expect(h, c.cnpj).toContain("Abrir o documento na CVM");
      const rotulo = (nome: string) => (nome === "Outros" ? "Outros acionistas" : nome === "Ações Tesouraria" ? "Ações em tesouraria" : nome).replace(/\s+/g, " ");
      for (const { no } of achatar(c)) expect(h, `${c.cnpj} ${no.nome}`).toContain(rotulo(no.nome));
      if (referenciaPosteriorAoRecebimento(c)) expect(h, c.cnpj).toContain("não é a data da posição");
    }
  });

  it("prestador sem registro na CVM não ganha seção de controle nem afirmação sobre quem o controla", () => {
    const sem = prestadores().find((p) => !controleDoPrestador(p.id) && p.natureza === "Empresa privada")!;
    const h = texto(renderToStaticMarkup(createElement(PaginaPrestador, { params: { id: sem.id } })));
    expect(h).not.toContain("Quem controla a empresa?");
  });

  it("o capítulo 7 e a matriz de viabilidade deixam de dizer que o controle societário não está integrado", () => {
    const cap = capituloPorSlug("prestadores")!;
    expect(cap.situacao).toBe("parcial");
    expect(cap.pendencia).toMatch(/17 companhias abertas|companhias abertas/);
    const v = VIABILIDADE.find((x) => x.capitulo === "7" && x.pergunta === "Quem controla as empresas?")!;
    expect(v.situacao).toBe("parcial");
    expect(v.fonte).toMatch(/CVM/);
    expect(readFileSync(join(raiz, "docs", "saneamento", "VIABILIDADE.md"), "utf-8")).toContain("Integrado em parte");
  });
});
