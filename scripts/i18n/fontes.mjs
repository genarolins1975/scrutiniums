import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const sob = (path, prefixo) => path === prefixo || path.startsWith(prefixo + '/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ordenar = xs => xs.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const TEXTO = /\.(?:[cm]?[jt]sx?|json|html|md|csv|xml|svg|css|gz|b64)$/;

/** Descoberta somente leitura. Nenhum módulo da aplicação ou materializador é executado. */
export function descobrirFontes(raiz, manifesto, { apenasCodigo = false } = {}) {
  if (manifesto.schema_version !== 1 || !Array.isArray(manifesto.dominios)) throw Error('Manifesto i18n inválido.');
  const base = realpathSync(raiz);
  const dominios = new Set(manifesto.dominios.map(d => d.id));
  if (dominios.size !== manifesto.dominios.length) throw Error('Domínio i18n duplicado.');
  const localizar = path => {
    if (typeof path !== 'string' || isAbsolute(path) || path.split('/').some(p => ['', '.', '..'].includes(p)) || path.includes('\\')) throw Error(`Caminho i18n inválido ou não normalizado: ${path}`);
    const real = realpathSync(resolve(base, path));
    if (real !== base && !real.startsWith(base + sep)) throw Error(`Fonte fora do repositório: ${path}`);
    return real;
  };
  const caminho = path => {
    const real = localizar(path);
    if (!statSync(real).isFile()) throw Error(`Fonte não é arquivo: ${path}`);
    return real;
  };
  for (const path of manifesto.ui.raizes) if (!statSync(localizar(path)).isDirectory()) throw Error(`Raiz de interface inválida: ${path}`);
  const ler = path => readFileSync(caminho(path));
  const resultado = { ui: [], gold: [], conteudo: [], naoClassificadas: [], excluidas: [], materializados: [] };
  const arquivos = new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: base, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }).split('\0').filter(Boolean));
  const integridade = new Set();
  const exigirDominio = dominio => { if (!dominios.has(dominio)) throw Error(`Domínio i18n desconhecido: ${dominio}`); };
  const dominioDe = (path, grupo) => {
    const opcoes = manifesto.dominios.flatMap(d => (d[grupo] ?? []).filter(p => sob(path, p)).map(p => ({ id: d.id, tamanho: p.length })));
    opcoes.sort((a, b) => b.tamanho - a.tamanho);
    if (opcoes.length > 1 && opcoes[0].tamanho === opcoes[1].tamanho) throw Error(`Domínio ambíguo: ${path}`);
    return opcoes[0]?.id;
  };

  for (const item of apenasCodigo ? [] : manifesto.materializados ?? []) {
    exigirDominio(item.dominio);
    const fonte = ler(item.origem);
    let comprimido = fonte;
    if (item.encoding === 'gzip-base64') {
      const b64 = fonte.toString('ascii').replace(/\s/g, '');
      if (!b64 || b64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw Error(`Base64 inválido: ${item.origem}`);
      comprimido = Buffer.from(b64, 'base64');
    } else if (item.encoding !== 'gzip') throw Error(`Encoding desconhecido: ${item.encoding}`);
    const descomprimido = gunzipSync(comprimido);
    JSON.parse(descomprimido.toString('utf8'));
    const registro = ler(item.hash.arquivo).toString('utf8');
    const esperado = item.hash.campo ? JSON.parse(registro)[item.hash.campo]
      : registro.match(new RegExp(`export\\s+const\\s+${item.hash.constante}\\s*=\\s*['"]([a-f0-9]{64})['"]`))?.[1];
    if (!['originais', 'descomprimidos'].includes(item.hash.bytes)) throw Error(`Alvo de hash inválido: ${item.id}`);
    const sha256 = hash(item.hash.bytes === 'originais' ? fonte : descomprimido);
    if (!/^[a-f0-9]{64}$/.test(esperado ?? '') || esperado !== sha256) throw Error(`Hash incompatível: ${item.origem}`);
    // SUAS/alimentar: hash do seed + saídas presentes e JSON válido. Não afirma
    // equivalência byte a byte com o gerador. Trabalho/Renda permite essa comparação.
    const nomes = [...item.arquivos, ...(item.por_uf ? UFS.map(uf => item.por_uf.replace('{uf}', uf)) : [])];
    const saidas = nomes.map(nome => `${item.diretorio}/${nome}`).sort();
    for (const path of saidas) {
      let bytes;
      try { bytes = ler(path); } catch (erro) { throw Error(`Saída esperada ausente ou inválida: ${path}; execute node ${item.gerador}.`, { cause: erro }); }
      if (path.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
      if (item.saida_identica && path === `${item.diretorio}/${item.saida_identica}` && !bytes.equals(descomprimido)) throw Error(`Saída diverge do payload canônico: ${path}`);
      arquivos.add(path);
    }
    integridade.add(item.origem);
    integridade.add(item.hash.arquivo);
    resultado.materializados.push({ id: item.id, dominio: item.dominio, origem: item.origem, sha256, alvo_hash: item.hash.bytes, gerador_sha256: hash(ler(item.gerador)), saidas,
      verificacao: item.saida_identica ? 'payload_e_saida_identicos' : 'hash_seed_presenca_json_saidas' });
  }

  const extras = new Map();
  const extrasDerivados = new Set();
  for (const item of manifesto.conteudo ?? []) {
    if (apenasCodigo && (item.dinamico || dominioDe(item.path, 'gold'))) {
      extrasDerivados.add(item.path);
      continue;
    }
    exigirDominio(item.dominio);
    if (!['markdown', 'html', 'json'].includes(item.formato) || extras.has(item.path)) throw Error(`Conteúdo inválido ou duplicado: ${item.path}`);
    caminho(item.path);
    extras.set(item.path, item);
    arquivos.add(item.path);
  }
  // Arquivos explicitamente declarados são obrigatórios mesmo que removidos do Git.
  for (const dominio of apenasCodigo ? [] : manifesto.dominios) for (const path of dominio.gold ?? []) {
    if (path.endsWith('.json')) { caminho(path); arquivos.add(path); }
    else if (!statSync(localizar(path)).isDirectory()) throw Error(`Raiz de dados inválida: ${path}`);
  }
  for (const path of [...arquivos].sort()) {
    // Um conteúdo derivado pode também estar sob uma raiz de UI, como public/obs.
    if (extrasDerivados.has(path)) continue;
    const extra = extras.get(path);
    // O relatório versionado não enumera, abre nem assina dados publicados.
    // Templates são fontes de código mesmo antes de terem consumidores.
    const template = sob(path, 'pipeline/i18n/templates') && path.endsWith('.json');
    if (apenasCodigo && !extra && !template && !(manifesto.ui.raizes.some(p => sob(path, p)) && /\.(?:[cm]?[jt]sx?|html|css|svg)$/.test(path))) continue;
    const observado = template || extra || (manifesto.observar ?? []).some(p => sob(path, p)) || dominioDe(path, 'gold');
    if (!observado || !TEXTO.test(path)) continue;
    caminho(path);
    if (extra) { resultado.conteudo.push({ ...extra }); continue; }
    if (integridade.has(path)) {
      resultado.excluidas.push({ path, motivo: 'Fonte canônica validada para materialização; a saída é contada uma única vez.' });
      continue;
    }
    const exclusao = (manifesto.exclusoes ?? []).find(e => (e.prefixo && sob(path, e.prefixo)) || (e.sufixo && path.endsWith(e.sufixo)));
    if (exclusao) { resultado.excluidas.push({ path, motivo: exclusao.motivo }); continue; }
    const gold = dominioDe(path, 'gold');
    if (path.endsWith('.json') && gold) { resultado.gold.push({ path, dominio: gold }); continue; }
    const ui = dominioDe(path, 'ui');
    if (ui && manifesto.ui.raizes.some(p => sob(path, p)) && /\.(?:[cm]?[jt]sx?|html)$/.test(path)) {
      resultado.ui.push({ path, dominio: ui, formato: path.endsWith('.html') ? 'html' : 'ts' });
      continue;
    }
    resultado.naoClassificadas.push({ path, dominio: gold ?? ui ?? null, motivo: 'Arquivo textual em raiz observada sem extrator declarado.' });
  }
  for (const key of ['ui', 'gold', 'conteudo', 'naoClassificadas', 'excluidas']) ordenar(resultado[key]);
  resultado.materializados.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return resultado;
}
