import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32 as crcZlib } from "node:zlib";
import {
  CHAVE_SEM_DADO,
  aplicarConsulta,
  crc32,
  descreverRecorte,
  filtrarLinhas,
  gerarCsv,
  gerarXlsx,
  letraColuna,
  matrizExportacao,
  nomeArquivo,
  normalizarBusca,
  opcoesFiltro,
  ordenarLinhas,
  paginar,
  textoCelula,
  valorColuna,
  type ColunaTabela,
  type Consulta,
  type LinhaTabela,
} from "@/lib/energia/tabela";
import { TabelaInterativa, type TabelaInterativaProps } from "@/components/energia/TabelaInterativa";

/**
 * Tabela interativa: lógica pura (src/lib/energia/tabela.ts) e o HTML que o
 * servidor entrega (TabelaInterativa). O que este teste protege:
 *
 *  1. ausência nunca vira zero: fica no fim da ordenação nas duas direções,
 *     aparece como "sem dado" na tela e como célula vazia nos arquivos;
 *  2. ordenação estável (empates mantêm a ordem) e busca sem acento e caixa;
 *  3. o XLSX é um zip válido conferido por uma implementação independente de
 *     CRC (zlib do Node), com as partes do Office Open XML referenciadas;
 *  4. CSV e XLSX carregam exatamente as mesmas linhas, na ordem do recorte;
 *  5. a tabela no servidor já é acessível: aria-sort, botões de ordenação,
 *     contagem "n de N", linha selecionada com aria-pressed, estado vazio,
 *     paginação e recorte vindo da URL.
 */

const colunas: ColunaTabela[] = [
  { id: "nome", rotulo: "Distribuidora", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "perda", rotulo: "Perda", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "pct", rotulo: "Perdas não técnicas", tipo: "percentual", casas: 1 },
  { id: "ref", rotulo: "Referência", tipo: "data" },
];

const linhas: LinhaTabela[] = [
  { id: "a", nome: "Águas Claras Energia", uf: "SP", perda: 120.5, pct: 12.25, ref: "2025-12-31" },
  { id: "b", nome: "Cemig D", uf: "MG", perda: null, pct: 8, ref: "2025-12-31" },
  { id: "c", nome: "São João Luz", uf: "SP", perda: 0, pct: null, ref: "2024-06-30" },
  { id: "d", nome: 'Zeta; "Norte" <&>', uf: null, perda: -3.2, pct: 0, ref: null },
  { id: "e", nome: "Equatorial Pará", uf: "PA", perda: 120.5, pct: 40, ref: "2025-12-31" },
];

const ids = (ls: LinhaTabela[]) => ls.map((l) => l.id);
const semFiltro: Consulta = { busca: "", filtros: {}, ordem: null };

describe("ordenação", () => {
  it("número: ausência no fim nas duas direções; empates mantêm a ordem original", () => {
    expect(ids(ordenarLinhas(linhas, colunas, { coluna: "perda", direcao: "asc" }))).toEqual(["d", "c", "a", "e", "b"]);
    expect(ids(ordenarLinhas(linhas, colunas, { coluna: "perda", direcao: "desc" }))).toEqual(["a", "e", "c", "d", "b"]);
  });

  it("texto: collation pt-BR (Águas antes de Cemig) e ausência no fim nas duas direções", () => {
    expect(ids(ordenarLinhas(linhas, colunas, { coluna: "nome", direcao: "asc" }))).toEqual(["a", "b", "e", "c", "d"]);
    const uf = (d: "asc" | "desc") => ordenarLinhas(linhas, colunas, { coluna: "uf", direcao: d }).map((l) => l.uf ?? null);
    expect(uf("asc")).toEqual(["MG", "PA", "SP", "SP", null]);
    expect(uf("desc")).toEqual(["SP", "SP", "PA", "MG", null]);
  });

  it("data: mais recente primeiro em decrescente, ausência no fim", () => {
    expect(ids(ordenarLinhas(linhas, colunas, { coluna: "ref", direcao: "desc" }))).toEqual(["a", "b", "e", "c", "d"]);
  });

  it("zero é dado (entra na ordem); texto numa coluna numérica é ausência, não número", () => {
    const l = [...linhas, { id: "f", nome: "Texto", perda: "12" as unknown as number }];
    const asc = ids(ordenarLinhas(l, colunas, { coluna: "perda", direcao: "asc" }));
    expect(asc.indexOf("c")).toBe(1);
    expect(asc.slice(-2)).toEqual(["b", "f"]);
    expect(valorColuna(l[5], colunas[2])).toBeNull();
  });

  it("mês escrito como na página ordena pelo calendário, não pelo alfabeto; o texto exibido não muda", () => {
    const col: ColunaTabela[] = [{ id: "mes", rotulo: "Mês", tipo: "texto" }];
    const meses: LinhaTabela[] = ["set/2025", "ago/2026", "out/2025", "dez/2024", "mar/2026 (parcial)"].map((m) => ({ id: m, mes: m }));
    expect(ordenarLinhas(meses, col, { coluna: "mes", direcao: "desc" }).map((l) => l.mes)).toEqual(["ago/2026", "mar/2026 (parcial)", "out/2025", "set/2025", "dez/2024"]);
    expect(ordenarLinhas(meses, col, { coluna: "mes", direcao: "asc" }).map((l) => l.mes)).toEqual(["dez/2024", "set/2025", "out/2025", "mar/2026 (parcial)", "ago/2026"]);
    // texto comum segue a collation pt-BR
    const nomes: LinhaTabela[] = ["setor", "agosto"].map((m) => ({ id: m, mes: m }));
    expect(ordenarLinhas(nomes, col, { coluna: "mes", direcao: "asc" }).map((l) => l.mes)).toEqual(["agosto", "setor"]);
  });

  it("sem ordem ou com coluna desconhecida, mantém a ordem recebida (cópia, não a mesma lista)", () => {
    const r = ordenarLinhas(linhas, colunas, { coluna: "nao-existe", direcao: "asc" });
    expect(ids(r)).toEqual(["a", "b", "c", "d", "e"]);
    expect(r).not.toBe(linhas);
  });
});

describe("busca e filtros", () => {
  it("busca sem acento e sem caixa, todos os termos em qualquer coluna buscável", () => {
    expect(normalizarBusca("  São   JOÃO ")).toBe("sao joao");
    const busca = (b: string) => ids(filtrarLinhas(linhas, colunas, { busca: b, filtros: {} }));
    expect(busca("sao joao")).toEqual(["c"]);
    expect(busca("AGUAS")).toEqual(["a"]);
    expect(busca("pará equatorial")).toEqual(["e"]);
    expect(busca("cemig mg")).toEqual(["b"]);
    expect(busca("")).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("data só entra na busca quando pedida: '12' não acha toda linha de dezembro", () => {
    expect(ids(filtrarLinhas(linhas, colunas, { busca: "12", filtros: {} }))).toEqual([]);
    const comData = colunas.map((c) => (c.id === "ref" ? { ...c, buscavel: true } : c));
    const busca = (b: string) => ids(filtrarLinhas(linhas, comData, { busca: b, filtros: {} }));
    // no formato brasileiro e no ISO
    expect(busca("31/12/2025")).toEqual(["a", "b", "e"]);
    expect(busca("2024-06")).toEqual(["c"]);
  });

  it("filtro categórico, com a ausência como opção própria; coluna não categórica é ignorada", () => {
    const f = (filtros: Consulta["filtros"]) => ids(filtrarLinhas(linhas, colunas, { busca: "", filtros }));
    expect(f({ uf: ["SP"] })).toEqual(["a", "c"]);
    expect(f({ uf: [CHAVE_SEM_DADO] })).toEqual(["d"]);
    expect(f({ uf: ["SP", "PA"] })).toEqual(["a", "c", "e"]);
    expect(f({ nome: ["Cemig D"] })).toEqual(["a", "b", "c", "d", "e"]);
    expect(f({ uf: [] })).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("filtrar depois de ordenar dá o mesmo que ordenar depois de filtrar (a tela faz na primeira ordem)", () => {
    const consulta: Consulta = { busca: "a", filtros: { uf: ["SP", "PA", CHAVE_SEM_DADO] }, ordem: { coluna: "perda", direcao: "desc" } };
    const a = aplicarConsulta(linhas, colunas, consulta);
    const b = ordenarLinhas(filtrarLinhas(linhas, colunas, consulta), colunas, consulta.ordem);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).toEqual(["a", "e", "c", "d"]);
  });

  it("opções de filtro: lista completa, contagem na faceta, 'sem dado' por último", () => {
    const base = filtrarLinhas(linhas, colunas, { busca: "energia", filtros: {} });
    expect(opcoesFiltro(linhas, colunas[1], base)).toEqual([
      { valor: "MG", rotulo: "MG", n: 0 },
      { valor: "PA", rotulo: "PA", n: 0 },
      { valor: "SP", rotulo: "SP", n: 1 },
      { valor: CHAVE_SEM_DADO, rotulo: "sem dado", n: 0 },
    ]);
  });
});

describe("texto das células", () => {
  it("pt-BR com sinal de menos tipográfico; ausência é 'sem dado', zero é zero", () => {
    expect(textoCelula(-3.2, colunas[2])).toBe("−3,2");
    expect(textoCelula(1234.56, colunas[2])).toBe("1.234,6");
    expect(textoCelula(0, colunas[3])).toBe("0,0");
    expect(textoCelula(null, colunas[2])).toBe("sem dado");
    expect(textoCelula("2025-12-31", colunas[4])).toBe("31/12/2025");
    expect(textoCelula("2025-12", colunas[4])).toBe("12/2025");
    expect(textoCelula("2025-12-31T16:00", colunas[4])).toBe("31/12/2025 16:00");
  });
});

describe("paginação", () => {
  it("página limitada ao intervalo; início inclusivo, fim exclusivo", () => {
    expect(paginar(6000, 1, 25)).toEqual({ pagina: 1, paginas: 240, inicio: 0, fim: 25 });
    expect(paginar(6000, 999, 25)).toEqual({ pagina: 240, paginas: 240, inicio: 5975, fim: 6000 });
    expect(paginar(6001, 241, 25)).toEqual({ pagina: 241, paginas: 241, inicio: 6000, fim: 6001 });
    expect(paginar(10, Number.NaN, 25).pagina).toBe(1);
    expect(paginar(0, 3, 25)).toEqual({ pagina: 1, paginas: 1, inicio: 0, fim: 0 });
  });
});

describe("recorte e nome de arquivo", () => {
  const consulta: Consulta = { busca: "São João", filtros: { uf: ["SP", CHAVE_SEM_DADO] }, ordem: { coluna: "perda", direcao: "desc" } };

  it("o nome do arquivo diz o recorte e a versão", () => {
    const r = descreverRecorte(colunas, consulta);
    expect(r.map((x) => `${x.rotulo}: ${x.valor}`)).toEqual(["Busca: “São João”", "UF: SP, sem dado", "Ordem: Perda, decrescente"]);
    expect(nomeArquivo("Perdas por distribuidora", r, "csv", "2026-09-30")).toBe(
      "perdas-por-distribuidora_busca-sao-joao_uf-sp-sem-dado_ordem-perda-desc_v2026-09-30.csv",
    );
    expect(nomeArquivo("perdas", descreverRecorte(colunas, semFiltro), "xlsx", "2026-09-30")).toBe("perdas_completo_v2026-09-30.xlsx");
  });

  it("recorte longo não passa de 150 caracteres antes da extensão", () => {
    const muitos: Consulta = { busca: "x".repeat(200), filtros: { uf: Array.from({ length: 40 }, (_, i) => `UF${i}`) }, ordem: null };
    const nome = nomeArquivo("perdas", descreverRecorte(colunas, muitos), "csv", "2026-09-30");
    expect(nome.length).toBeLessThanOrEqual(150 + ".csv".length);
    expect(nome.endsWith("_v2026-09-30.csv")).toBe(true);
  });
});

/* ---------- arquivos ---------- */

const dec = new TextDecoder();

/** Leitor de zip do próprio teste: assinaturas, tamanhos, posições e CRC conferido pelo zlib do Node. */
function lerZip(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true), "assinatura PK\\3\\4 no início").toBe(0x04034b50);
  const fim = buf.length - 22;
  expect(dv.getUint32(fim, true), "registro de fim do diretório central").toBe(0x06054b50);
  const n = dv.getUint16(fim + 10, true);
  expect(dv.getUint16(fim + 8, true)).toBe(n);
  const tamanhoCentral = dv.getUint32(fim + 12, true);
  const inicioCentral = dv.getUint32(fim + 16, true);
  expect(inicioCentral + tamanhoCentral).toBe(fim);
  const arquivos = new Map<string, Uint8Array>();
  let o = inicioCentral;
  let fimDados = 0;
  for (let k = 0; k < n; k++) {
    expect(dv.getUint32(o, true), "assinatura do diretório central").toBe(0x02014b50);
    const metodo = dv.getUint16(o + 10, true);
    const crc = dv.getUint32(o + 16, true);
    const comprimido = dv.getUint32(o + 20, true);
    const original = dv.getUint32(o + 24, true);
    const [nl, el, cl] = [dv.getUint16(o + 28, true), dv.getUint16(o + 30, true), dv.getUint16(o + 32, true)];
    const local = dv.getUint32(o + 42, true);
    const nome = dec.decode(buf.subarray(o + 46, o + 46 + nl));
    expect(metodo, nome).toBe(0);
    expect(comprimido, nome).toBe(original);
    expect(dv.getUint32(local, true), `cabeçalho local de ${nome}`).toBe(0x04034b50);
    expect(dv.getUint16(local + 8, true)).toBe(0);
    expect(dv.getUint32(local + 14, true)).toBe(crc);
    expect(dv.getUint32(local + 18, true)).toBe(comprimido);
    const [lnl, lel] = [dv.getUint16(local + 26, true), dv.getUint16(local + 28, true)];
    expect(dec.decode(buf.subarray(local + 30, local + 30 + lnl))).toBe(nome);
    const inicio = local + 30 + lnl + lel;
    const dados = buf.subarray(inicio, inicio + comprimido);
    expect(crcZlib(dados), `CRC de ${nome}`).toBe(crc);
    fimDados = Math.max(fimDados, inicio + comprimido);
    arquivos.set(nome, dados);
    o += 46 + nl + el + cl;
  }
  expect(o).toBe(fim);
  expect(fimDados).toBe(inicioCentral);
  return arquivos;
}

/** Tags balanceadas e nenhum & solto: o suficiente para pegar XML malformado gerado por concatenação. */
function xmlBemFormado(x: string): boolean {
  const pilha: string[] = [];
  const semDeclaracao = x.replace(/^<\?xml[^>]*\?>\s*/, "");
  for (const m of Array.from(semDeclaracao.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g))) {
    if (m[3]) continue;
    if (m[1]) {
      if (pilha.pop() !== m[2]) return false;
    } else pilha.push(m[2]);
  }
  const texto = semDeclaracao.replace(/<[^>]*>/g, "");
  return pilha.length === 0 && !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(texto) && !/[<>]/.test(texto.replace(/&[a-z]+;/g, ""));
}

function indiceColuna(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function desescaparXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/** Planilha como matriz: inlineStr vira texto, <v> vira número, célula omitida vira null. */
function lerPlanilha(xmlPlanilha: string, largura: number): (string | number | null)[][] {
  const out: (string | number | null)[][] = [];
  for (const r of Array.from(xmlPlanilha.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g))) {
    const linha: (string | number | null)[] = Array.from({ length: largura }, () => null);
    for (const c of Array.from(r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g))) {
      const j = indiceColuna(c[1]);
      if (c[2].includes('t="inlineStr"')) linha[j] = desescaparXml(c[3].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      else linha[j] = Number(c[3].match(/<v>([^<]*)<\/v>/)?.[1]);
    }
    out[Number(r[1]) - 1] = linha;
  }
  return out;
}

/** CSV do teste: ";" com aspas duplas (RFC 4180), linhas em CRLF. */
function lerCsv(texto: string): string[][] {
  const out: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ";") {
      linha.push(campo);
      campo = "";
    } else if (ch === "\r" && texto[i + 1] === "\n") {
      linha.push(campo);
      out.push(linha);
      linha = [];
      campo = "";
      i++;
    } else campo += ch;
  }
  if (campo || linha.length) out.push([...linha, campo]);
  return out;
}

const BOM = String.fromCharCode(0xfeff);

describe("CSV", () => {
  const csv = gerarCsv(colunas, linhas);

  it("BOM UTF-8, ';' como separador, ponto decimal, CRLF e cabeçalho com unidade", () => {
    expect(csv.startsWith(BOM)).toBe(true);
    const linhasCsv = csv.slice(1).split("\r\n");
    expect(linhasCsv[0]).toBe("Distribuidora;UF;Perda (GWh);Perdas não técnicas (%);Referência");
    expect(linhasCsv).toHaveLength(linhas.length + 2); // cabeçalho, 5 linhas e o vazio após o último CRLF
    // valor completo (12.25), não o arredondado da tela (12,3); data em ISO
    expect(linhasCsv[1]).toBe("Águas Claras Energia;SP;120.5;12.25;2025-12-31");
  });

  it("ausência é campo vazio, zero é 0, sinal é hífen de máquina, texto com ; e aspas vai entre aspas", () => {
    const l = csv.slice(1).split("\r\n");
    expect(l[2]).toBe("Cemig D;MG;;8;2025-12-31");
    expect(l[3]).toBe("São João Luz;SP;0;;2024-06-30");
    expect(l[4]).toBe('"Zeta; ""Norte"" <&>";;-3.2;0;');
  });
});

describe("XLSX", () => {
  const meta = { titulo: "Perdas", fonte: "ANEEL, SAMP", versao: "2026-09-30", recorte: "UF: SP" };
  const xlsx = gerarXlsx(colunas, linhas, meta);
  // lido num gancho (e não na coleta): zip inválido aparece como falha nomeada de cada teste
  let arquivos = new Map<string, Uint8Array>();
  beforeAll(() => {
    arquivos = lerZip(xlsx);
  });

  it("CRC32 da implementação própria bate com o valor de referência e com o zlib", () => {
    const enc = new TextEncoder();
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    const amostra = enc.encode("Águas Claras; ç ã é\n".repeat(50));
    expect(crc32(amostra)).toBe(crcZlib(amostra));
  });

  it("zip válido com as partes obrigatórias do Office Open XML, todas referenciadas", () => {
    for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
      expect(arquivos.has(parte), parte).toBe(true);
    }
    const tipos = dec.decode(arquivos.get("[Content_Types].xml"));
    for (const m of Array.from(tipos.matchAll(/PartName="\/([^"]+)"/g))) expect(arquivos.has(m[1]), m[1]).toBe(true);
    const rels = dec.decode(arquivos.get("xl/_rels/workbook.xml.rels"));
    const idsRel = new Set(Array.from(rels.matchAll(/Id="([^"]+)"/g), (m) => m[1]));
    for (const m of Array.from(rels.matchAll(/Target="([^"]+)"/g))) expect(arquivos.has(`xl/${m[1]}`), m[1]).toBe(true);
    const wb = dec.decode(arquivos.get("xl/workbook.xml"));
    for (const m of Array.from(wb.matchAll(/r:id="([^"]+)"/g))) expect(idsRel.has(m[1])).toBe(true);
    expect(dec.decode(arquivos.get("_rels/.rels"))).toContain('Target="xl/workbook.xml"');
    for (const [nome, dados] of Array.from(arquivos)) expect(xmlBemFormado(dec.decode(dados)), nome).toBe(true);
  });

  it("CSV e XLSX têm as mesmas linhas, na mesma ordem, iguais à matriz de exportação", () => {
    const recorte = aplicarConsulta(linhas, colunas, { busca: "", filtros: {}, ordem: { coluna: "perda", direcao: "desc" } });
    const m = matrizExportacao(colunas, recorte);
    const planilha = lerPlanilha(dec.decode(lerZip(gerarXlsx(colunas, recorte)).get("xl/worksheets/sheet1.xml")), colunas.length);
    const csv = lerCsv(gerarCsv(colunas, recorte).slice(1));
    const numericas = colunas.map((c) => c.tipo === "numero" || c.tipo === "percentual");
    const csvTipado = csv.map((l, i) => (i === 0 ? l : l.map((v, j) => (v === "" ? null : numericas[j] ? Number(v) : v))));
    expect(planilha).toEqual([m.cabecalho, ...m.linhas]);
    expect(csvTipado).toEqual([m.cabecalho, ...m.linhas]);
    expect(m.linhas.map((l) => l[0])).toEqual(["Águas Claras Energia", "Equatorial Pará", "São João Luz", 'Zeta; "Norte" <&>', "Cemig D"]);
  });

  it("ausência é célula omitida, número é valor com o formato de casas da tela, texto é inlineStr", () => {
    const s = dec.decode(arquivos.get("xl/worksheets/sheet1.xml"));
    const linhaB = s.match(/<row r="3">([\s\S]*?)<\/row>/)?.[1] ?? "";
    expect(linhaB).not.toContain('r="C3"'); // perda de Cemig D: sem dado
    expect(s).toContain('<c r="C2" s="3"><v>120.5</v></c>');
    expect(s).toContain('<c r="C4" s="3"><v>0</v></c>'); // zero é dado
    expect(s).toContain("Zeta; &quot;Norte&quot; &lt;&amp;&gt;");
    expect(s).toContain('state="frozen"');
  });

  it("aba Sobre com fonte, versão, recorte, linhas e dicionário de colunas", () => {
    const sobre = lerPlanilha(dec.decode(arquivos.get("xl/worksheets/sheet2.xml")), 4);
    const valor = (chave: string) => sobre.find((l) => l?.[0] === chave)?.[1];
    expect(valor("Fonte")).toBe("ANEEL, SAMP");
    expect(valor("Versão dos dados")).toBe("2026-09-30");
    expect(valor("Recorte")).toBe("UF: SP");
    expect(valor("Linhas exportadas")).toBe(5);
    expect(sobre.find((l) => l?.[0] === "Perdas não técnicas (%)")?.[1]).toBe("percentual (0 a 100)");
  });

  it("caracteres proibidos no XML somem sem quebrar o arquivo", () => {
    const sujo = [{ id: "x", nome: `a${String.fromCharCode(1)}b${String.fromCharCode(0xd800)}c`, uf: "SP", perda: 1, pct: 1, ref: "2025-01-01" }];
    const s = dec.decode(lerZip(gerarXlsx(colunas, sujo)).get("xl/worksheets/sheet1.xml"));
    expect(s).toContain(">abc<");
    expect(xmlBemFormado(s)).toBe(true);
  });

  it("mesma entrada, mesmos bytes (arquivo conferível por hash)", () => {
    expect(Buffer.from(gerarXlsx(colunas, linhas, meta)).equals(Buffer.from(xlsx))).toBe(true);
  });

  it("~6.000 linhas: zip válido e mesmas linhas no CSV e no XLSX", () => {
    const muitas: LinhaTabela[] = Array.from({ length: 6000 }, (_, i) => ({
      id: `m${i}`,
      nome: `Município ${i}`,
      uf: ["SP", "MG", "BA"][i % 3],
      perda: i % 7 === 0 ? null : i * 1.5,
      pct: i % 11 === 0 ? null : (i % 100) / 3,
      ref: i % 13 === 0 ? null : "2025-12-31",
    }));
    const planilha = lerPlanilha(dec.decode(lerZip(gerarXlsx(colunas, muitas)).get("xl/worksheets/sheet1.xml")), colunas.length);
    const csv = lerCsv(gerarCsv(colunas, muitas).slice(1));
    expect(planilha).toHaveLength(6001);
    expect(csv).toHaveLength(6001);
    expect(letraColuna(26)).toBe("AA");
    const m = matrizExportacao(colunas, muitas);
    expect(planilha.slice(1)).toEqual(m.linhas);
    expect(csv.slice(1).map((l) => l[2])).toEqual(m.linhas.map((l) => (l[2] === null ? "" : String(l[2]))));
  });
});

/* ---------- componente no servidor ---------- */

const html = (p: Partial<TabelaInterativaProps> = {}) =>
  renderToStaticMarkup(
    createElement(TabelaInterativa, {
      titulo: "Perdas por distribuidora",
      colunas,
      linhas,
      chaveLinha: "id",
      fonte: "ANEEL, SAMP",
      versao: "2026-09-30",
      nomeArquivo: "perdas",
      ...p,
    }),
  );
const texto = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const corpo = (h: string) => h.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";

describe("TabelaInterativa: recolher em Entender", () => {
  const muitas = Array.from({ length: 13 }, (_, i) => ({ id: `l${i}`, nome: `Linha ${i}`, uf: "SP", perda: i, pct: i, ref: "2025-12-31" }));

  it("tabela com mais de 12 linhas traz o botão que a abre e começa fechada", () => {
    const h = html({ linhas: muitas });
    expect(h).toMatch(/<button type="button" aria-expanded="false" aria-controls="[^"]+-conteudo" class="tabela-recolher-btn">Ver a tabela completa \(13 linhas\)<\/button>/);
    expect(h).toContain('data-recolhivel="fechada"');
  });

  it("tabela curta, ou com recolher desligado, fica sempre aberta e sem o botão", () => {
    expect(html()).not.toContain("tabela-recolher-btn");
    expect(html()).not.toContain("data-recolhivel");
    expect(html({ linhas: muitas, recolher: false })).not.toContain("tabela-recolher-btn");
    expect(html({ recolher: true })).toContain('data-recolhivel="fechada"');
  });

  it("a barra só aparece em Entender; nos outros modos a tabela completa segue à vista", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.tabela-recolher\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.modo-profundidade\[data-modo="entender"\]\s+\.tabela-recolher\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/\.modo-profundidade\[data-modo="entender"\]\s+\[data-recolhivel="fechada"\]\s*\{[^}]*display:\s*none/);
  });
});

describe("TabelaInterativa no servidor", () => {
  it("tabela dentro de região rolável com foco, legenda e cabeçalhos de coluna", () => {
    const h = html();
    expect(h).toMatch(/<div class="tabela-scroll[^"]*" role="region" tabindex="0" aria-label="Perdas por distribuidora \(tabela rolável\)">/);
    expect(h).toMatch(/<caption class="sr-only">Perdas por distribuidora\. 5 de 5 linhas/);
    expect(Array.from(h.matchAll(/<th scope="col"/g))).toHaveLength(5);
    expect(h).toContain(">Perda (GWh)<");
    expect(h).toContain(">Perdas não técnicas (%)<");
    expect(Array.from(corpo(h).matchAll(/<th scope="row"/g))).toHaveLength(5);
  });

  it("cabeçalho ordenável é botão; aria-sort só na coluna ordenada", () => {
    const h = html({ ordemInicial: { coluna: "perda", direcao: "desc" } });
    const sorts = Array.from(h.matchAll(/aria-sort="([a-z]+)"/g)).map((m) => m[1]);
    expect(sorts).toEqual(["descending"]);
    expect(h).toMatch(/<th scope="col" aria-sort="descending"[^>]*><button type="button"[^>]*><span>Perda \(GWh\)<\/span>/);
    expect(Array.from(h.matchAll(/<th scope="col"[^>]*><button type="button"/g))).toHaveLength(5);
    // ordem aplicada já no HTML do servidor: ausência no fim
    expect(Array.from(corpo(h).matchAll(/data-id="([a-z])"/g)).map((m) => m[1])).toEqual(["a", "e", "c", "d", "b"]);
  });

  it("ausência é 'sem dado' marcado; zero e negativo são números", () => {
    const h = corpo(html());
    const linhaB = h.match(/<tr[^>]*data-id="b"[\s\S]*?<\/tr>/)?.[0] ?? "";
    expect(linhaB).toContain('<span data-estado="sem-dado" class="italic text-mineral">sem dado</span>');
    const linhaC = texto(h.match(/<tr[^>]*data-id="c"[\s\S]*?<\/tr>/)?.[0] ?? "");
    expect(linhaC).toContain("0,0");
    expect(texto(h)).toContain("−3,2");
  });

  it("contagem 'n de N linhas' em região de status e botões de exportação", () => {
    const h = html();
    expect(h).toMatch(/role="status"[^>]*><span[^>]*>5<\/span> de 5 linhas<\/p>/);
    expect(texto(h)).toContain("Baixar CSV");
    expect(texto(h)).toContain("Baixar XLSX");
    // na tela a versão sai no formato do site; no arquivo exportado segue ISO (ver o teste dos metadados)
    expect(texto(h)).toContain("Fonte: ANEEL, SAMP. Versão dos dados: 30/09/2026.");
  });

  it("linha selecionável: botão com aria-pressed; só a selecionada fica pressionada e marcada", () => {
    const h = html({ selecionado: "c", onSelecionar: () => {} });
    const pressed = Array.from(h.matchAll(/aria-pressed="(true|false)"/g)).map((m) => m[1]);
    expect(pressed.filter((p) => p === "true")).toHaveLength(1);
    expect(pressed).toHaveLength(5);
    expect(h).toMatch(/<tr data-id="c" data-selecionada="true"/);
    // sem onSelecionar não há botão de seleção
    expect(html({ selecionado: "c" })).not.toContain("aria-pressed");
  });

  it("sem dado em linha selecionada usa carvão-muted (mineral não passa AA sobre energia-fundo)", () => {
    const h = html({ selecionado: "b", onSelecionar: () => {} });
    const linhaB = h.match(/<tr[^>]*data-id="b"[\s\S]*?<\/tr>/)?.[0] ?? "";
    expect(linhaB).toContain('class="italic text-carvao-muted">sem dado');
  });

  it("~6.000 linhas: só uma página no DOM, com navegação de páginas", () => {
    const muitas = Array.from({ length: 6000 }, (_, i) => ({ id: `m${i}`, nome: `Município ${i}`, uf: "SP", perda: i, pct: null, ref: null }));
    const h = html({ linhas: muitas });
    expect(Array.from(corpo(h).matchAll(/<tr /g))).toHaveLength(25);
    expect(texto(h)).toContain("Página 1 de 240 · linhas 1 a 25");
    expect(h).toContain('aria-label="Paginação: Perdas por distribuidora"');
    expect(texto(h)).toContain("6.000 de 6.000 linhas");
  });

  it("recorte vindo da URL: filtros aplicados no servidor, resumo com ação de remover, ?modo= ignorado", () => {
    const h = html({ chaveUrl: "perdas", buscaInicial: "?modo=auditar&perdas.q=sao&perdas.f.uf=SP&perdas.ord=-perda" });
    expect(texto(h)).toContain("1 de 5 linhas");
    expect(h).toContain('aria-label="Remover filtro Busca: “sao”"');
    expect(h).toContain('aria-label="Remover filtro UF: SP"');
    expect(texto(h)).toContain("Limpar todos");
    expect(h).toMatch(/aria-sort="descending"/);
  });

  it("valores inválidos na URL voltam ao padrão (ordem inicial e página 1)", () => {
    const h = html({ chaveUrl: "t", buscaInicial: "?t.ord=-inexistente&t.pag=abc", ordemInicial: { coluna: "nome", direcao: "asc" } });
    expect(Array.from(h.matchAll(/aria-sort="([a-z]+)"/g)).map((m) => m[1])).toEqual(["ascending"]);
    expect(texto(h)).toContain("5 de 5 linhas");
  });

  it("estado vazio legítimo: nenhuma linha com os filtros, exportação indisponível", () => {
    const h = html({ chaveUrl: "t", buscaInicial: "?t.q=zzzz" });
    expect(texto(h)).toContain("Nenhuma linha com esses filtros.");
    expect(texto(h)).toContain("Limpar filtros");
    expect(Array.from(h.matchAll(/<button type="button" aria-disabled="true"[^>]*>Baixar/g))).toHaveLength(2);
    expect(texto(html({ linhas: [] }))).toContain("Nenhuma linha publicada para esta tabela.");
  });

  it("sem chaveUrl, a busca da página não é aplicada (estado só local)", () => {
    expect(texto(html({ buscaInicial: "?perdas.q=sao" }))).toContain("5 de 5 linhas");
  });
});
