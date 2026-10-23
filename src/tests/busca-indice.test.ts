import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indiceDeBusca, nomesDasListas } from "@/lib/busca/indice";
import { buscar } from "@/lib/busca/buscar";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { normalizar } from "@/lib/busca/normalizar";
import { rotaExiste } from "./suporte/rota-existe";

/**
 * Índice da busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026): montado do registro e dos catálogos, sem
 * destino inexistente, sem página prevista com link, com `aberta` igual à regra de acesso, leve para o navegador e sem
 * nenhum campo além dos de títulos, resumos, endereços, situação e termos.
 */
// o índice lê os catálogos e as golds que as consultas usam; com a suíte em paralelo, 5 s não bastam
vi.setConfig({ testTimeout: 60_000 });

const raiz = process.cwd();
const indice = () => indiceDeBusca();

const CAMPOS_ENTRADA = new Set(["id", "tipo", "titulo", "resumo", "href", "observatorio", "colecao", "situacao", "aberta", "termos", "lugares"]);
const CAMPOS_INDICE = new Set(["versao", "observatorios", "colecoes", "exemplos", "lugares", "entradas"]);
/** Peso alvo do arquivo que o campo baixa ao receber foco (antes da compressão do servidor). */
const PESO_MAXIMO = 150 * 1024;

describe("índice da busca", () => {
  it("cobre os seis observatórios, as 28 coleções, páginas, perguntas, consultas, verbetes e métodos", () => {
    const i = indice();
    const tipos = new Set(i.entradas.map((e) => e.tipo));
    for (const t of ["observatorio", "colecao", "pagina", "pergunta", "consulta", "verbete", "metodo"]) expect(tipos, t).toContain(t);
    expect(i.observatorios.map((o) => o.id)).toEqual(OBSERVATORIOS.map((o) => o.id));
    expect(i.colecoes).toHaveLength(28);
    expect(i.entradas.filter((e) => e.tipo === "colecao")).toHaveLength(28);
    expect(i.exemplos).toHaveLength(3);
  });

  it("nenhum destino inexistente: todo href é uma página do App Router ou uma vista da aplicação do Crédito", () => {
    const fora = indice().entradas.filter((e) => e.href && !rotaExiste(e.href)).map((e) => `${e.titulo} → ${e.href}`);
    expect(fora).toEqual([]);
  });

  it("página prevista aparece sem link e só ela não tem link", () => {
    for (const e of indice().entradas) {
      if (e.situacao === "previsto") expect(e.href, e.titulo).toBeNull();
      else expect(e.href, e.titulo).toMatch(/^\//);
    }
  });

  it("`aberta` é a regra de acesso (ehRotaPublica), sem query nem âncora", () => {
    for (const e of indice().entradas) {
      if (!e.href) continue;
      expect(e.aberta, e.href).toBe(ehRotaPublica(e.href.split(/[?#]/)[0] || "/"));
    }
  });

  it("cada observatório e coleção da entrada existe no registro; ids únicos", () => {
    const i = indice();
    const colecoes = new Set(i.colecoes.map((c) => `${c.observatorio}/${c.id}`));
    const ids = new Set<string>();
    for (const e of i.entradas) {
      expect(i.observatorios.some((o) => o.id === e.observatorio), e.id).toBe(true);
      if (e.colecao) expect(colecoes.has(`${e.observatorio}/${e.colecao}`), `${e.titulo}: ${e.observatorio}/${e.colecao}`).toBe(true);
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
    }
  });

  it("o JSON fica abaixo do peso alvo e só leva os campos permitidos", () => {
    const i = indice();
    const json = JSON.stringify(i);
    expect(Buffer.byteLength(json)).toBeLessThan(PESO_MAXIMO);
    expect(Object.keys(i).filter((k) => !CAMPOS_INDICE.has(k))).toEqual([]);
    for (const e of i.entradas) expect(Object.keys(e).filter((k) => !CAMPOS_ENTRADA.has(k)), e.id).toEqual([]);
  });

  it("nenhum número de painel: resumos e termos não trazem valores com unidade (R$, %, kWh) lidos das bases", () => {
    // os resumos vêm dos catálogos (perguntas, respostas curtas, definições); um valor com centavos, decimal ou percentual
    // seria dado ("cada R$ 100", sem decimal, é o enquadramento da pergunta, não um valor)
    const comValor = indice().entradas.filter((e) => /R\$\s?\d+(\.\d{3})*,\d|\d+,\d+\s?(%|kWh|MW)|\d+\s?%/.test(`${e.resumo} ${e.termos.join(" ")}`)).map((e) => `${e.titulo}: ${e.resumo}`);
    expect(comValor).toEqual([]);
  });

  it("os sinônimos vêm de um único arquivo, com chave e lista", () => {
    const s = JSON.parse(readFileSync(join(raiz, "src/lib/busca/sinonimos.json"), "utf-8")) as Record<string, unknown>;
    const grupos = Object.entries(s).filter(([k]) => !k.startsWith("_"));
    expect(grupos.length).toBeGreaterThanOrEqual(40);
    expect(grupos.length).toBeLessThanOrEqual(70);
    for (const [k, v] of grupos) expect(Array.isArray(v) && v.length > 0, k).toBe(true);
  });

  const arquivo = () => JSON.parse(readFileSync(join(raiz, "src/lib/busca/sinonimos.json"), "utf-8")) as Record<string, unknown> & { _nomes: Record<string, string[]>; _exemplos: string[] };
  const temas = () => Object.entries(arquivo()).filter(([k]) => !k.startsWith("_")) as [string, string[]][];

  it("todo grupo temático alcança ao menos um destino (diagnóstico da busca de 23/10/2026, achado A3: seis grupos estavam mortos)", () => {
    const destinos = indice().entradas.map((e) => new Set([e.titulo, ...e.termos].map(normalizar)));
    const mortos = temas()
      .filter(([chave, lista]) => !destinos.some((d) => [chave, ...lista].some((x) => d.has(normalizar(x)))))
      .map(([chave]) => chave);
    expect(mortos).toEqual([]);
  });

  it("as listas de bancos e distribuidoras só levam os nomes das bases e os apelidos de _nomes, nunca os grupos temáticos", () => {
    const i = indice();
    const brutas = nomesDasListas();
    const apelidos = new Set(Object.values(arquivo()._nomes).flat().map(normalizar));
    const tematicas = new Set(temas().flatMap(([chave, lista]) => [chave, ...lista]).map(normalizar));
    for (const tipo of ["banco", "distribuidora"] as const) {
      const base = new Set(brutas[tipo].map(normalizar));
      const intrusos = i.lugares[tipo].filter((n) => !base.has(normalizar(n)) && !apelidos.has(normalizar(n)));
      expect(intrusos, tipo).toEqual([]);
      // nenhum apelido é expressão de grupo temático (o grupo voltaria a entrar pela porta dos nomes)
      expect(i.lugares[tipo].filter((n) => !base.has(normalizar(n)) && tematicas.has(normalizar(n))), tipo).toEqual([]);
    }
  });

  it("todo apelido de _nomes aponta para um nome que existe na lista de bancos ou de distribuidoras", () => {
    const brutas = nomesDasListas();
    const existentes = new Set([...brutas.banco, ...brutas.distribuidora].map(normalizar));
    expect(brutas.distribuidora.length).toBeGreaterThan(50);
    expect(brutas.banco.length).toBeGreaterThan(50);
    const soltos = Object.keys(arquivo()._nomes).filter((nome) => !existentes.has(normalizar(nome)));
    expect(soltos).toEqual([]);
  });

  it("os três exemplos do campo continuam entre os termos fortes: resultado completo no título ou nos termos e mais de dois destinos", () => {
    for (const t of arquivo()._exemplos) {
      const r = buscar(indice(), t);
      expect(r.parcial, t).toBeUndefined();
      expect(r.resultados.length, t).toBeGreaterThan(2);
      expect(r.resultados[0].nivel, t).toBeLessThanOrEqual(2);
    }
  });

  it("a busca entra pelo registro: nenhuma lista de destinos escrita em src/lib/busca", () => {
    // o índice só pode citar endereços que são regra (as duas consultas que recebem nomes de distribuidoras e bancos) ou
    // modelos de endereço dos glossários e portas; destino de página vem sempre do registro e dos catálogos
    const fonte = readFileSync(join(raiz, "src/lib/busca/indice.ts"), "utf-8");
    const literais = Array.from(fonte.matchAll(/"(\/[a-z][a-z0-9/-]*)"/g)).map((m) => m[1]);
    expect(literais.sort()).toEqual(["/observatorio-do-credito/quanto-meu-banco-cobra", "/setor-eletrico/conta-de-luz"]);
  });

  it("a âncora de cada verbete do Agro é a mesma que a página do glossário desenha", () => {
    const comp = readFileSync(join(raiz, "src/components/agro/Aprendizado.tsx"), "utf-8");
    expect(comp).toContain("id={ancoraConceitoAgro(r.termo)}");
    const agro = indice().entradas.filter((e) => e.href?.startsWith("/agronegocio/glossario#"));
    expect(agro.length).toBeGreaterThan(5);
    for (const e of agro) expect(e.href!.split("#")[1], e.titulo).toBe(normalizar(e.titulo).replace(/ /g, "-"));
  });
});
