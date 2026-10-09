import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// Canonical bytes of the approved, source-backed snapshot. No fallback to legacy JSON.
export const SHA256_SNAPSHOT = '1e20187e13c89939b3b79254eedae8d619dcdfd18dc0e7e9b8696cad28ac979a';
const payloadUrl = new URL('../public/eficiencia/trabalho-renda/snapshot.payload.gz.b64', import.meta.url);
const snapshotUrl = new URL('../public/eficiencia/trabalho-renda/snapshot.json', import.meta.url);
const encoded = readFileSync(payloadUrl, 'ascii').replace(/\s/g, '');
if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
  throw new Error('Trabalho e Renda: payload base64 inválido.');
}
const canonical = gunzipSync(Buffer.from(encoded, 'base64'));
const hash = createHash('sha256').update(canonical).digest('hex');
if (hash !== SHA256_SNAPSHOT) {
  throw new Error(`Trabalho e Renda: SHA-256 incompatível; esperado ${SHA256_SNAPSHOT}, recebido ${hash}.`);
}
const parsed = JSON.parse(canonical.toString('utf8'));
if (parsed.versao !== 1 || !Array.isArray(parsed.observacoes) || !Array.isArray(parsed.indicadores)) {
  throw new Error('Trabalho e Renda: contrato do snapshot inválido.');
}
let current = null;
try {
  current = readFileSync(snapshotUrl);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!current?.equals(canonical)) {
  const temporary = new URL(`${snapshotUrl.href}.tmp`);
  writeFileSync(temporary, canonical);
  renameSync(temporary, snapshotUrl);
}
console.log(`Trabalho e Renda: snapshot materializado e verificado (${canonical.length} bytes; SHA-256 ${hash}).`);
