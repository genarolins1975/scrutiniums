/**
 * Tabela interativa do Setor Elétrico: lógica pura (sem React, testável em
 * node) usada por TabelaInterativa e pelo Comparador.
 *
 * - Ordenação estável com ausência sempre no fim, nas duas direções
 *   (reaproveita ordenarComNulos de escalas.ts, com collation pt-BR): inverter
 *   a ordem nunca põe "sem dado" no topo como se fosse o maior valor.
 * - Busca sem acento e sem caixa ("sao paulo" acha "São Paulo"); todos os
 *   termos precisam aparecer na linha.
 * - Filtros por coluna categórica, com a ausência como opção própria.
 * - Exportação CSV e XLSX a partir da MESMA matriz (as linhas do recorte
 *   exibido, na ordem exibida): o que se baixa é o que se vê.
 *   CSV: separador ";", ponto decimal, célula vazia = ausência, cabeçalho com
 *   unidade, BOM UTF-8 (o Excel reconhece os acentos).
 *   XLSX: Office Open XML mínimo e válido ([Content_Types].xml, _rels,
 *   workbook, estilos, planilhas "Dados" e "Sobre"), empacotado em zip no modo
 *   STORE (sem compressão) com CRC32 calculado aqui; nenhuma dependência.
 *   Bytes determinísticos: a mesma entrada gera o mesmo arquivo (data fixa
 *   nas entradas do zip), o que permite conferir o arquivo por hash.
 *
 * Três estados nunca confundidos: número (inclusive zero), ausência (null,
 * undefined, NaN, texto vazio) e texto. Coluna numérica só aceita número:
 * texto numa coluna numérica é tratado como ausência, não convertido às cegas.
 */
import { dataBR, num } from "@/lib/energia/formato";
import { ordenarComNulos, valido, type Direcao } from "@/lib/energia/escalas";

export type TipoColuna = "texto" | "numero" | "percentual" | "data";
export type ValorCelula = string | number | null | undefined;
export type LinhaTabela = Record<string, ValorCelula>;

export type ColunaTabela = {
  id: string;
  rotulo: string;
  tipo: TipoColuna;
  /** Unidade de coluna numérica (GWh, R$/MWh). Percentual já usa "%". */
  unidade?: string;
  /** Casas decimais exibidas (número e percentual; padrão 1). O arquivo exportado guarda o valor completo. */
  casas?: number;
  /** Oferece filtro por valores (UF, submercado, tipo de concessão). */
  categorica?: boolean;
  /** Entra na busca textual (padrão: só colunas de texto; data e número entram com buscavel: true, senão "12" acharia todo "2025-12-31"). */
  buscavel?: boolean;
  /** Pode ser ordenada (padrão: sim). */
  ordenavel?: boolean;
};

export type Ordem = { coluna: string; direcao: Direcao } | null;
export type Consulta = { busca: string; filtros: Record<string, readonly string[]>; ordem: Ordem };

/** Valor de filtro que seleciona as linhas sem dado na coluna ("~" é legível e não precisa de escape na URL). */
export const CHAVE_SEM_DADO = "~sem-dado";
export const TEXTO_SEM_DADO = "sem dado";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/* ---------- valores e texto ---------- */

export function ehNumerica(c: ColunaTabela): boolean {
  return c.tipo === "numero" || c.tipo === "percentual";
}

/** Valor da célula já normalizado: número finito, texto não vazio ou null (ausência). */
export function valorColuna(l: LinhaTabela, c: ColunaTabela): string | number | null {
  const v = l[c.id];
  if (ehNumerica(c)) return valido(v) ? (v === 0 ? 0 : v) : null;
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  return v.trim() === "" ? null : v;
}

/** Data de referência como texto local: "2026-09-27" → 27/09/2026; "2026-09" → 09/2026; com hora, "27/09/2026 16:00". */
export function textoData(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return `${dataBR(v)} ${v.slice(11, 16)}`;
  if (/^\d{4}(-\d{2}){0,2}$/.test(v)) return dataBR(v);
  return v;
}

/** Texto exibido na célula (pt-BR, sinal de menos tipográfico); ausência é "sem dado", nunca "0". */
export function textoCelula(v: string | number | null, c: ColunaTabela): string {
  if (v === null) return TEXTO_SEM_DADO;
  if (typeof v === "number") return num(v, c.casas ?? 1);
  if (c.tipo === "data") return textoData(v);
  // célula de texto que é só uma data ISO (mês, dia ou instante) sai no formato do site; o arquivo baixado segue ISO
  if (c.tipo === "texto" && /^\d{4}-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?Z?)?)?$/.test(v)) return textoData(v);
  return v;
}

/** Cabeçalho com unidade: "Perda (GWh)", "Participação (%)". Vale para a tela e para os arquivos. */
export function rotuloCabecalho(c: ColunaTabela): string {
  if (c.tipo === "percentual") return `${c.rotulo} (%)`;
  if (c.tipo === "numero" && c.unidade) return `${c.rotulo} (${c.unidade})`;
  return c.rotulo;
}

/* ---------- busca ---------- */

/** Sem acento, sem caixa e com espaços simples: "  São   PAULO " → "sao paulo". */
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function termosBusca(busca: string): string[] {
  const t = normalizarBusca(busca);
  return t ? t.split(" ") : [];
}

function ehBuscavel(c: ColunaTabela): boolean {
  return c.buscavel ?? c.tipo === "texto";
}

/**
 * Texto normalizado de cada linha nas colunas buscáveis, calculado uma vez por
 * linha (cache por objeto): com ~6.000 linhas, digitar não refaz a normalização.
 * Datas entram no formato ISO e no brasileiro; números, no bruto e no exibido.
 */
export function criarIndiceBusca(colunas: readonly ColunaTabela[]): (l: LinhaTabela) => string {
  const cache = new WeakMap<LinhaTabela, string>();
  const buscaveis = colunas.filter(ehBuscavel);
  return (l) => {
    let t = cache.get(l);
    if (t === undefined) {
      const partes: string[] = [];
      for (const c of buscaveis) {
        const v = valorColuna(l, c);
        if (v === null) continue;
        partes.push(String(v));
        const exibido = textoCelula(v, c);
        if (exibido !== String(v)) partes.push(exibido);
      }
      t = normalizarBusca(partes.join(" "));
      cache.set(l, t);
    }
    return t;
  };
}

/* ---------- filtros ---------- */

/** Chave de filtro de um valor: o próprio texto, ou CHAVE_SEM_DADO para ausência. */
export function chaveFiltro(l: LinhaTabela, c: ColunaTabela): string {
  const v = valorColuna(l, c);
  return v === null ? CHAVE_SEM_DADO : String(v);
}

/** Filtros efetivos: só colunas categóricas existentes e com ao menos um valor escolhido. */
function filtrosAtivos(colunas: readonly ColunaTabela[], filtros: Consulta["filtros"], exceto?: string) {
  const out: { c: ColunaTabela; aceitos: Set<string> }[] = [];
  for (const c of colunas) {
    if (!c.categorica || c.id === exceto) continue;
    const f = filtros[c.id];
    if (f && f.length) out.push({ c, aceitos: new Set(f) });
  }
  return out;
}

/**
 * Linhas que passam na busca e nos filtros, na ordem recebida (filtrar não
 * reordena; por isso filtrar(ordenar(x)) = ordenar(filtrar(x)) com ordenação
 * estável). `exceto` ignora o filtro de uma coluna: contagens por faceta.
 */
export function filtrarLinhas(
  linhas: readonly LinhaTabela[],
  colunas: readonly ColunaTabela[],
  consulta: Pick<Consulta, "busca" | "filtros">,
  indice: (l: LinhaTabela) => string = criarIndiceBusca(colunas),
  exceto?: string,
): LinhaTabela[] {
  const termos = termosBusca(consulta.busca);
  const fs = filtrosAtivos(colunas, consulta.filtros, exceto);
  if (!termos.length && !fs.length) return linhas.slice();
  return linhas.filter((l) => {
    for (const { c, aceitos } of fs) if (!aceitos.has(chaveFiltro(l, c))) return false;
    if (termos.length) {
      const t = indice(l);
      for (const termo of termos) if (!t.includes(termo)) return false;
    }
    return true;
  });
}

export type OpcaoFiltro = { valor: string; rotulo: string; n: number };

/**
 * Opções de filtro de uma coluna: todos os valores presentes em `linhas`
 * (a lista não encolhe quando outro filtro é aplicado, e uma opção marcada
 * nunca some), contados em `base` (as linhas do recorte, para mostrar quantas
 * sobram). Ordem pt-BR com números em ordem numérica; "sem dado" por último.
 */
export function opcoesFiltro(linhas: readonly LinhaTabela[], c: ColunaTabela, base: readonly LinhaTabela[] = linhas): OpcaoFiltro[] {
  const contagem = new Map<string, number>();
  const exemplo = new Map<string, string | number | null>();
  for (const l of linhas) {
    const k = chaveFiltro(l, c);
    if (!contagem.has(k)) {
      contagem.set(k, 0);
      exemplo.set(k, valorColuna(l, c));
    }
  }
  for (const l of base) {
    const k = chaveFiltro(l, c);
    if (contagem.has(k)) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const opcoes = Array.from(contagem, ([valor, n]) => ({ valor, rotulo: textoCelula(exemplo.get(valor) ?? null, c), n }));
  return opcoes.sort((a, b) => {
    if ((a.valor === CHAVE_SEM_DADO) !== (b.valor === CHAVE_SEM_DADO)) return a.valor === CHAVE_SEM_DADO ? 1 : -1;
    const va = exemplo.get(a.valor);
    const vb = exemplo.get(b.valor);
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return COLLATOR.compare(a.rotulo, b.rotulo);
  });
}

/* ---------- ordenação e consulta ---------- */

/** Cópia ordenada, estável, com ausência sempre no fim. Sem ordem (ou coluna desconhecida), mantém a ordem original. */
export function ordenarLinhas(linhas: readonly LinhaTabela[], colunas: readonly ColunaTabela[], ordem: Ordem): LinhaTabela[] {
  const c = ordem ? colunas.find((x) => x.id === ordem.coluna) : undefined;
  if (!ordem || !c) return linhas.slice();
  return ordenarComNulos(linhas, (l) => valorColuna(l, c), ordem.direcao);
}

/** Recorte completo: ordena e filtra. É a fonte única da tela e dos arquivos. */
export function aplicarConsulta(linhas: readonly LinhaTabela[], colunas: readonly ColunaTabela[], consulta: Consulta): LinhaTabela[] {
  return filtrarLinhas(ordenarLinhas(linhas, colunas, consulta.ordem), colunas, consulta);
}

/* ---------- paginação ---------- */

export type Pagina = { pagina: number; paginas: number; inicio: number; fim: number };

/** Página pedida limitada ao intervalo existente; inicio inclusivo, fim exclusivo. */
export function paginar(total: number, pagina: number, tamanho: number): Pagina {
  const t = Math.max(1, Math.floor(tamanho) || 1);
  const paginas = Math.max(1, Math.ceil(Math.max(0, total) / t));
  const p = Math.min(paginas, Math.max(1, Math.floor(pagina) || 1));
  const inicio = (p - 1) * t;
  return { pagina: p, paginas, inicio, fim: Math.min(Math.max(0, total), inicio + t) };
}

/* ---------- recorte (resumo dos filtros e nome de arquivo) ---------- */

export type ItemRecorte = { tipo: "busca" | "filtro" | "ordem"; coluna?: string; rotulo: string; valor: string; slug: string };

/** Slug de arquivo: sem acento, minúsculo, só letras, números e hífen. */
export function slug(s: string, max = 40): string {
  return normalizarBusca(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Recorte legível (chips de filtros ativos, aba "Sobre") e em slug (nome do arquivo). */
export function descreverRecorte(colunas: readonly ColunaTabela[], consulta: Consulta): ItemRecorte[] {
  const itens: ItemRecorte[] = [];
  const b = consulta.busca.trim();
  if (b) itens.push({ tipo: "busca", rotulo: "Busca", valor: `“${b}”`, slug: `busca-${slug(b, 30)}` });
  for (const { c, aceitos } of filtrosAtivos(colunas, consulta.filtros)) {
    const valores = Array.from(aceitos);
    const legiveis = valores.map((v) => (v === CHAVE_SEM_DADO ? TEXTO_SEM_DADO : c.tipo === "data" ? textoData(v) : v));
    itens.push({
      tipo: "filtro",
      coluna: c.id,
      rotulo: c.rotulo,
      valor: legiveis.join(", "),
      slug: `${slug(c.id, 20)}-${valores.map((v) => (v === CHAVE_SEM_DADO ? "sem-dado" : slug(v, 20))).join("-")}`.slice(0, 60),
    });
  }
  const o = consulta.ordem;
  const co = o ? colunas.find((x) => x.id === o.coluna) : undefined;
  if (o && co) {
    itens.push({
      tipo: "ordem",
      coluna: co.id,
      rotulo: "Ordem",
      valor: `${co.rotulo}, ${o.direcao === "asc" ? "crescente" : "decrescente"}`,
      slug: `ordem-${slug(co.id, 20)}-${o.direcao}`,
    });
  }
  return itens;
}

/**
 * Nome de arquivo com o recorte: "perdas_uf-mg-sp_ordem-perda-desc_v2026-09-30.csv";
 * sem filtros, "perdas_completo_v2026-09-30.csv". Partes que estourariam o
 * limite de tamanho são omitidas (o recorte completo está na aba "Sobre").
 */
export function nomeArquivo(base: string, recorte: readonly ItemRecorte[], extensao: "csv" | "xlsx", versao?: string): string {
  const partes = [slug(base, 60) || "tabela"];
  const filtros = recorte.filter((r) => r.tipo !== "ordem");
  if (!filtros.length) partes.push("completo");
  for (const r of recorte) partes.push(r.slug);
  const v = versao ? slug(versao, 24) : "";
  const fim = v ? `_v${v}.${extensao}` : `.${extensao}`;
  let nome = partes[0];
  for (const p of partes.slice(1)) {
    if (!p) continue;
    if (nome.length + 1 + p.length + fim.length > 150) break;
    nome += `_${p}`;
  }
  return nome + fim;
}

/* ---------- matriz de exportação ---------- */

export type CelulaExportada = string | number | null;
export type MatrizExportacao = { cabecalho: string[]; linhas: CelulaExportada[][] };

/**
 * Matriz única de onde saem CSV e XLSX: cabeçalho com unidade e, por célula,
 * número (valor completo, sem o arredondamento da tela), texto (datas em ISO,
 * legíveis por máquina) ou null (ausência).
 */
export function matrizExportacao(colunas: readonly ColunaTabela[], linhas: readonly LinhaTabela[]): MatrizExportacao {
  return {
    cabecalho: colunas.map(rotuloCabecalho),
    linhas: linhas.map((l) => colunas.map((c) => valorColuna(l, c))),
  };
}

/* ---------- CSV ---------- */

function campoCsv(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Número em formato de máquina: ponto decimal, hífen como sinal, sem separador de milhar. */
function numeroMaquina(v: number): string {
  return Object.is(v, -0) ? "0" : String(v);
}

/** CSV com ";" e ponto decimal, CRLF, BOM UTF-8; ausência é campo vazio. */
export function gerarCsv(colunas: readonly ColunaTabela[], linhas: readonly LinhaTabela[], { bom = true }: { bom?: boolean } = {}): string {
  const m = matrizExportacao(colunas, linhas);
  const out = [m.cabecalho.map(campoCsv).join(";")];
  for (const l of m.linhas) out.push(l.map((v) => (v === null ? "" : typeof v === "number" ? numeroMaquina(v) : campoCsv(v))).join(";"));
  return `${bom ? "\uFEFF" : ""}${out.join("\r\n")}\r\n`;
}

/* ---------- zip (modo STORE) ---------- */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (polinômio 0xEDB88320, o do zip e do PNG). */
export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 01/01/1980 00:00 no formato MS-DOS: data fixa torna o arquivo reproduzível byte a byte
const HORA_DOS = 0;
const DATA_DOS = (0 << 9) | (1 << 5) | 1;

/**
 * Zip sem compressão (método 0, STORE): cabeçalho local + dados por arquivo,
 * diretório central e registro de fim. Suficiente para o XLSX (o formato
 * aceita entradas armazenadas) e sem nenhuma dependência.
 */
export function zipArmazenado(arquivos: readonly { nome: string; dados: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const partes: { nome: Uint8Array; dados: Uint8Array; crc: number; offset: number }[] = [];
  let offset = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    partes.push({ nome, dados: a.dados, crc: crc32(a.dados), offset });
    offset += 30 + nome.length + a.dados.length;
  }
  const tamanhoCentral = partes.reduce((s, p) => s + 46 + p.nome.length, 0);
  const buf = new Uint8Array(offset + tamanhoCentral + 22);
  const dv = new DataView(buf.buffer);
  let o = 0;
  for (const p of partes) {
    dv.setUint32(o, 0x04034b50, true); // assinatura do cabeçalho local
    dv.setUint16(o + 4, 20, true); // versão mínima para extrair (2.0)
    dv.setUint16(o + 6, 0, true); // flags
    dv.setUint16(o + 8, 0, true); // método 0: armazenado
    dv.setUint16(o + 10, HORA_DOS, true);
    dv.setUint16(o + 12, DATA_DOS, true);
    dv.setUint32(o + 14, p.crc, true);
    dv.setUint32(o + 18, p.dados.length, true); // tamanho comprimido
    dv.setUint32(o + 22, p.dados.length, true); // tamanho original
    dv.setUint16(o + 26, p.nome.length, true);
    dv.setUint16(o + 28, 0, true); // campo extra
    buf.set(p.nome, o + 30);
    buf.set(p.dados, o + 30 + p.nome.length);
    o += 30 + p.nome.length + p.dados.length;
  }
  const inicioCentral = o;
  for (const p of partes) {
    dv.setUint32(o, 0x02014b50, true); // assinatura do diretório central
    dv.setUint16(o + 4, 20, true); // versão que criou
    dv.setUint16(o + 6, 20, true); // versão mínima para extrair
    dv.setUint16(o + 8, 0, true);
    dv.setUint16(o + 10, 0, true);
    dv.setUint16(o + 12, HORA_DOS, true);
    dv.setUint16(o + 14, DATA_DOS, true);
    dv.setUint32(o + 16, p.crc, true);
    dv.setUint32(o + 20, p.dados.length, true);
    dv.setUint32(o + 24, p.dados.length, true);
    dv.setUint16(o + 28, p.nome.length, true);
    dv.setUint16(o + 30, 0, true); // extra
    dv.setUint16(o + 32, 0, true); // comentário
    dv.setUint16(o + 34, 0, true); // disco
    dv.setUint16(o + 36, 0, true); // atributos internos
    dv.setUint32(o + 38, 0, true); // atributos externos
    dv.setUint32(o + 42, p.offset, true); // posição do cabeçalho local
    buf.set(p.nome, o + 46);
    o += 46 + p.nome.length;
  }
  dv.setUint32(o, 0x06054b50, true); // fim do diretório central
  dv.setUint16(o + 4, 0, true);
  dv.setUint16(o + 6, 0, true);
  dv.setUint16(o + 8, partes.length, true);
  dv.setUint16(o + 10, partes.length, true);
  dv.setUint32(o + 12, tamanhoCentral, true);
  dv.setUint32(o + 16, inicioCentral, true);
  dv.setUint16(o + 20, 0, true);
  return buf;
}

/* ---------- XLSX ---------- */

export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_CSV = "text/csv;charset=utf-8";

/** Referência de coluna da planilha: 0 → A, 25 → Z, 26 → AA. */
export function letraColuna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const RE_PROIBIDO_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/;

/** Remove caracteres proibidos no XML 1.0: controles, U+FFFE/U+FFFF e metades soltas de par substituto (pares válidos ficam). */
function limparXml(s: string): string {
  if (!RE_PROIBIDO_XML.test(s)) return s;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      }
      continue;
    }
    if ((c >= 0xdc00 && c <= 0xdfff) || c === 0xfffe || c === 0xffff) continue;
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) continue;
    out += s[i];
  }
  return out;
}

/** Escapa para XML (depois de limpar os caracteres proibidos). */
function xml(s: string): string {
  return limparXml(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAX_CASAS = 6;
/** Índices de estilo (cellXfs): 0 geral, 1 negrito (cabeçalho), 2 + casas para número com casas fixas. */
const ESTILO_NEGRITO = 1;
const estiloCasas = (casas: number) => 2 + Math.max(0, Math.min(MAX_CASAS, Math.round(casas)));

function estilosXml(): string {
  const formatos = Array.from({ length: MAX_CASAS + 1 }, (_, k) => `<numFmt numFmtId="${164 + k}" formatCode="${k ? `#,##0.${"0".repeat(k)}` : "#,##0"}"/>`);
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    ...Array.from({ length: MAX_CASAS + 1 }, (_, k) => `<xf numFmtId="${164 + k}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`),
  ];
  return (
    `${CABECALHO_XML}<styleSheet xmlns="${NS_MAIN}">` +
    `<numFmts count="${formatos.length}">${formatos.join("")}</numFmts>` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

type OpcoesPlanilha = { linhasNegrito?: ReadonlySet<number>; estiloNumero?: readonly (number | undefined)[]; larguras?: readonly number[]; congelarCabecalho?: boolean };

/** XML de uma planilha: texto como inlineStr (nunca vira fórmula), número como valor, ausência como célula omitida. */
function planilhaXml(linhas: readonly (readonly CelulaExportada[])[], op: OpcoesPlanilha = {}): string {
  const nCol = Math.max(1, ...linhas.map((l) => l.length));
  const partes: string[] = [`${CABECALHO_XML}<worksheet xmlns="${NS_MAIN}">`];
  partes.push(`<dimension ref="A1:${letraColuna(nCol - 1)}${Math.max(1, linhas.length)}"/>`);
  if (op.congelarCabecalho) {
    partes.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  }
  if (op.larguras?.length) {
    partes.push(`<cols>${op.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`);
  }
  partes.push("<sheetData>");
  linhas.forEach((l, r) => {
    const negrito = op.linhasNegrito?.has(r);
    const celulas: string[] = [];
    l.forEach((v, c) => {
      if (v === null) return;
      const ref = `${letraColuna(c)}${r + 1}`;
      if (typeof v === "number") {
        const s = negrito ? ESTILO_NEGRITO : op.estiloNumero?.[c];
        celulas.push(`<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${numeroMaquina(v)}</v></c>`);
      } else {
        celulas.push(`<c r="${ref}" t="inlineStr"${negrito ? ` s="${ESTILO_NEGRITO}"` : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`);
      }
    });
    partes.push(`<row r="${r + 1}">${celulas.join("")}</row>`);
  });
  partes.push("</sheetData></worksheet>");
  return partes.join("");
}

export type MetadadosExportacao = {
  titulo?: string;
  fonte?: string;
  versao?: string;
  /** Recorte legível ("UF: MG, SP; Ordem: Perda, decrescente"). */
  recorte?: string;
  /** Carimbo de geração (fica fora do padrão para o arquivo ser reproduzível). */
  geradoEm?: string;
};

const TIPO_LEGIVEL: Record<TipoColuna, string> = {
  texto: "texto",
  numero: "número",
  percentual: "percentual (0 a 100)",
  data: "data (AAAA-MM-DD)",
};

/**
 * XLSX com a aba "Dados" (a mesma matriz do CSV: cabeçalho em negrito e
 * congelado, números com as casas da tela como formato, valor completo na
 * célula, ausência como célula vazia) e a aba "Sobre" (título, fonte, versão,
 * recorte, número de linhas e dicionário de colunas), para o arquivo continuar
 * auditável fora do portal.
 */
export function gerarXlsx(colunas: readonly ColunaTabela[], linhas: readonly LinhaTabela[], meta: MetadadosExportacao = {}): Uint8Array<ArrayBuffer> {
  const m = matrizExportacao(colunas, linhas);
  const dados: CelulaExportada[][] = [m.cabecalho, ...m.linhas];
  const estiloNumero = colunas.map((c) => (ehNumerica(c) && typeof c.casas === "number" ? estiloCasas(c.casas) : undefined));
  const larguras = colunas.map((c, j) => {
    let w = m.cabecalho[j].length;
    for (let i = 0; i < Math.min(m.linhas.length, 500); i++) {
      const v = m.linhas[i][j];
      if (v !== null) w = Math.max(w, String(v).length);
    }
    return Math.min(60, Math.max(8, w + 2));
  });

  const sobre: CelulaExportada[][] = [
    ["Sobre este arquivo"],
    ["Título", meta.titulo ?? null],
    ["Fonte", meta.fonte ?? null],
    ["Versão dos dados", meta.versao ?? null],
    ["Recorte", meta.recorte || "sem filtros (todas as linhas)"],
    ["Linhas exportadas", m.linhas.length],
    ...(meta.geradoEm ? [["Gerado em", meta.geradoEm] as CelulaExportada[]] : []),
    ["Ausência", "Célula vazia significa sem dado na fonte; nunca é zero."],
    [],
    ["Dicionário de colunas"],
    ["Coluna", "Tipo", "Unidade", "Casas decimais exibidas no portal"],
    ...colunas.map((c) => [rotuloCabecalho(c), TIPO_LEGIVEL[c.tipo], c.tipo === "percentual" ? "%" : (c.unidade ?? null), ehNumerica(c) ? (c.casas ?? 1) : null]),
  ];
  const negritoSobre = new Set([0, sobre.findIndex((l) => l[0] === "Dicionário de colunas"), sobre.findIndex((l) => l[0] === "Coluna")]);

  const enc = new TextEncoder();
  const arquivo = (nome: string, conteudo: string) => ({ nome, dados: enc.encode(conteudo) });
  return zipArmazenado([
    arquivo(
      "[Content_Types].xml",
      `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>",
    ),
    arquivo(
      "_rels/.rels",
      `${CABECALHO_XML}<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>",
    ),
    arquivo(
      "xl/workbook.xml",
      `${CABECALHO_XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        '<sheets><sheet name="Dados" sheetId="1" r:id="rId1"/><sheet name="Sobre" sheetId="2" r:id="rId2"/></sheets>' +
        "</workbook>",
    ),
    arquivo(
      "xl/_rels/workbook.xml.rels",
      `${CABECALHO_XML}<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
        `<Relationship Id="rId3" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    arquivo("xl/styles.xml", estilosXml()),
    arquivo("xl/worksheets/sheet1.xml", planilhaXml(dados, { linhasNegrito: new Set([0]), estiloNumero, larguras, congelarCabecalho: true })),
    arquivo("xl/worksheets/sheet2.xml", planilhaXml(sobre, { linhasNegrito: negritoSobre, larguras: [26, 60, 14, 14] })),
  ]);
}

/* ---------- seleção para comparação (Comparador) ---------- */

/**
 * Limite de entidades comparadas lado a lado (seção 7.3: "até quatro"). Fica
 * aqui, e não no Comparador ("use client"), para que páginas do servidor
 * possam lê-lo: constante importada de módulo cliente chega ao servidor como
 * referência de cliente, não como o número.
 */
export const LIMITE_COMPARACAO = 4;

export type EntidadeBuscavel = { id: string; rotulo: string; detalhe?: string; sinonimos?: readonly string[] };

/**
 * Entidades que contêm todos os termos (sem acento e sem caixa) no rótulo,
 * no identificador, no detalhe ou nos sinônimos. Rótulo que começa com a
 * busca vem primeiro, depois palavra do rótulo que começa com ela, depois o
 * resto; empates mantêm a ordem recebida. Devolve no máximo `limite` itens e o
 * total encontrado (para "mostrando 50 de 312; refine a busca").
 */
export function buscarEntidades<E extends EntidadeBuscavel>(entidades: readonly E[], consulta: string, limite = 50): { itens: E[]; total: number } {
  const termos = termosBusca(consulta);
  if (!termos.length) return { itens: entidades.slice(0, limite), total: entidades.length };
  const q = termos.join(" ");
  const achados: { e: E; rank: number; i: number }[] = [];
  entidades.forEach((e, i) => {
    const rot = normalizarBusca(e.rotulo);
    const tudo = normalizarBusca([e.rotulo, e.id, e.detalhe ?? "", ...(e.sinonimos ?? [])].join(" "));
    if (!termos.every((t) => tudo.includes(t))) return;
    const rank = rot.startsWith(q) ? 0 : rot.split(/[^a-z0-9]+/).some((p) => p.startsWith(termos[0])) ? 1 : 2;
    achados.push({ e, rank, i });
  });
  achados.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return { itens: achados.slice(0, limite).map((a) => a.e), total: achados.length };
}

export type ResultadoSelecao = { ids: string[]; motivo: "entrou" | "saiu" | "limite" };

/** Liga ou desliga uma entidade na seleção, sem passar do limite; a ordem de escolha é preservada. */
export function alternarSelecao(ids: readonly string[], id: string, max: number): ResultadoSelecao {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), motivo: "saiu" };
  if (ids.length >= max) return { ids: ids.slice(), motivo: "limite" };
  return { ids: [...ids, id], motivo: "entrou" };
}
