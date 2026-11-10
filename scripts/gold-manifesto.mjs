#!/usr/bin/env node
/**
 * Manifesto de um domínio de dados publicado em public/ (docs/DADOS_FORA_DO_DEPLOY.md).
 *
 *   node scripts/gold-manifesto.mjs <dominio>            escreve config/gold-manifestos/<dominio>.json
 *   node scripts/gold-manifesto.mjs <dominio> --check    confere o manifesto gravado contra o disco
 *
 * Opções: --raiz <pasta> (padrão public), --saida <arquivo> (padrão config/gold-manifestos/<dominio>.json),
 * --stdout (imprime em vez de gravar).
 *
 * O manifesto lista cada arquivo de <raiz>/<dominio>/ com caminho, bytes e sha256. A edição é o SHA-256 das linhas
 * "caminho<TAB>bytes<TAB>sha256<LF>" em ordem de caminho: não entra data nem máquina, então os mesmos bytes dão sempre a
 * mesma edição. A regra é a mesma de src/lib/gold/manifesto.ts (calcularEdicao); src/tests/gold-leitor.test.ts confere
 * que os dois lados coincidem.
 *
 * Só lê e escreve arquivo local. Não envia nada a lugar nenhum: o envio ao armazenamento externo ainda não existe.
 * Saída: 0 certo; 1 manifesto divergente do disco (--check); 2 uso incorreto ou domínio ilegível.
 */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ESQUEMA = 1;
const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class ErroDeUso extends Error {}

function argumentos(argv) {
  const o = { dominio: null, check: false, stdout: false, raiz: "public", saida: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") o.check = true;
    else if (a === "--stdout") o.stdout = true;
    else if (a === "--raiz" || a === "--saida") {
      const v = argv[++i];
      if (!v) throw new ErroDeUso(`${a} exige um valor`);
      o[a.slice(2)] = v;
    } else if (a.startsWith("-")) throw new ErroDeUso(`opção desconhecida: ${a}`);
    else if (o.dominio === null) o.dominio = a;
    else throw new ErroDeUso(`argumento a mais: ${a}`);
  }
  if (!o.dominio) throw new ErroDeUso("informe o domínio (a pasta dentro de public/), por exemplo: agro");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.dominio)) throw new ErroDeUso(`domínio inválido: ${o.dominio}`);
  return o;
}

/** Arquivos da pasta, caminho relativo com "/". Link simbólico reprova: o manifesto descreve bytes, não atalhos. */
function listar(pasta, prefixo = "") {
  const saida = [];
  for (const nome of readdirSync(pasta).sort()) {
    const completo = join(pasta, nome);
    const relativo = prefixo ? `${prefixo}/${nome}` : nome;
    const s = lstatSync(completo);
    if (s.isSymbolicLink()) throw new ErroDeUso(`link simbólico não é aceito: ${relativo}`);
    if (s.isDirectory()) saida.push(...listar(completo, relativo));
    else if (s.isFile()) saida.push(relativo);
    else throw new ErroDeUso(`entrada que não é arquivo nem pasta: ${relativo}`);
  }
  return saida;
}

const ordenar = (arquivos) => [...arquivos].sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));

export function calcularEdicao(arquivos) {
  const h = createHash("sha256");
  for (const a of ordenar(arquivos)) h.update(`${a.caminho}\t${a.bytes}\t${a.sha256}\n`);
  return h.digest("hex");
}

/** Lê o domínio no disco e devolve o manifesto. */
export function gerarManifesto(dominio, raiz = join(RAIZ_REPO, "public")) {
  const pasta = join(raiz, dominio);
  let nomes;
  try {
    nomes = listar(pasta);
  } catch (e) {
    if (e instanceof ErroDeUso) throw e;
    throw new ErroDeUso(`não foi possível ler ${pasta}: ${e.message}`);
  }
  if (nomes.length === 0) throw new ErroDeUso(`${pasta} não tem arquivos: domínio vazio não vira manifesto`);
  const arquivos = ordenar(
    nomes.map((caminho) => {
      if (/[\\\u0000-\u001f\u007f]/.test(caminho)) throw new ErroDeUso(`nome de arquivo não aceito: ${JSON.stringify(caminho)}`);
      const bytes = readFileSync(join(pasta, ...caminho.split("/")));
      return { caminho, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    }),
  );
  return {
    esquema: ESQUEMA,
    dominio,
    edicao: calcularEdicao(arquivos),
    total_arquivos: arquivos.length,
    total_bytes: arquivos.reduce((s, a) => s + a.bytes, 0),
    arquivos,
  };
}

export const serializar = (manifesto) => JSON.stringify(manifesto, null, 2) + "\n";

/** Diferenças entre o manifesto gravado e o disco; lista vazia quando coincidem. */
export function conferir(gravado, atual) {
  const erros = [];
  if (gravado.esquema !== ESQUEMA) erros.push(`esquema ${gravado.esquema} desconhecido (esperado ${ESQUEMA})`);
  if (gravado.dominio !== atual.dominio) erros.push(`manifesto é do domínio ${gravado.dominio}, não de ${atual.dominio}`);
  if (!Array.isArray(gravado.arquivos)) return [...erros, "manifesto sem lista de arquivos"];
  const noManifesto = new Map(gravado.arquivos.map((a) => [a.caminho, a]));
  const noDisco = new Map(atual.arquivos.map((a) => [a.caminho, a]));
  for (const [caminho, a] of noManifesto) {
    const d = noDisco.get(caminho);
    if (!d) erros.push(`${caminho}: está no manifesto e não existe no disco`);
    else if (d.bytes !== a.bytes) erros.push(`${caminho}: ${a.bytes} bytes no manifesto, ${d.bytes} no disco`);
    else if (d.sha256 !== a.sha256) erros.push(`${caminho}: sha256 ${a.sha256} no manifesto, ${d.sha256} no disco`);
  }
  for (const caminho of noDisco.keys()) if (!noManifesto.has(caminho)) erros.push(`${caminho}: existe no disco e não está no manifesto`);
  if (gravado.arquivos.length !== noManifesto.size) erros.push("manifesto tem caminho repetido");
  const edicaoDaLista = calcularEdicao(gravado.arquivos);
  if (gravado.edicao !== edicaoDaLista) erros.push(`edição declarada ${gravado.edicao} não corresponde à lista do próprio manifesto (${edicaoDaLista})`);
  if (gravado.total_arquivos !== gravado.arquivos.length) erros.push("total_arquivos não corresponde à lista do manifesto");
  if (gravado.total_bytes !== gravado.arquivos.reduce((s, a) => s + a.bytes, 0)) erros.push("total_bytes não corresponde à lista do manifesto");
  if (erros.length === 0 && gravado.edicao !== atual.edicao) erros.push(`edição ${gravado.edicao} no manifesto, ${atual.edicao} no disco`);
  return erros;
}

function principal(argv) {
  const o = argumentos(argv);
  const raiz = resolve(RAIZ_REPO, o.raiz);
  const saida = resolve(RAIZ_REPO, o.saida ?? join("config", "gold-manifestos", `${o.dominio}.json`));
  const atual = gerarManifesto(o.dominio, raiz);
  if (o.check) {
    let gravado;
    try {
      gravado = JSON.parse(readFileSync(saida, "utf-8"));
    } catch (e) {
      throw new ErroDeUso(`não foi possível ler o manifesto ${saida}: ${e.message}`);
    }
    const erros = conferir(gravado, atual);
    if (erros.length) {
      console.error(`Manifesto de ${o.dominio} diverge do disco (${erros.length}):`);
      for (const e of erros) console.error(`  - ${e}`);
      return 1;
    }
    console.log(`Manifesto de ${o.dominio} confere: ${atual.total_arquivos} arquivos, ${atual.total_bytes} bytes, edição ${atual.edicao}`);
    return 0;
  }
  if (o.stdout) {
    process.stdout.write(serializar(atual));
    return 0;
  }
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, serializar(atual));
  console.log(`${saida}: ${atual.total_arquivos} arquivos, ${atual.total_bytes} bytes, edição ${atual.edicao}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof ErroDeUso)) throw e;
    console.error(`gold-manifesto: ${e.message}`);
    process.exitCode = 2;
  }
}
