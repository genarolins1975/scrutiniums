/** Extrai apenas geometria territorial já publicada no Pix; não lê nem altera indicadores. */
import { readFileSync, writeFileSync } from 'node:fs';
const origem = new URL('../public/obs/data/gold/pix.json', import.meta.url);
const destino = new URL('../public/obs/data/gold/geometria_uf.json', import.meta.url);
const geo = JSON.parse(readFileSync(origem, 'utf8')).geografia.geo;
if (Object.keys(geo.paths).length !== 27) throw new Error('A geometria de origem deve conter 27 UFs.');
const conteudo = JSON.stringify({ viewBox: geo.viewBox, transform: geo.transform, paths: geo.paths });
if (process.argv.includes('--check')) {
  if (readFileSync(destino, 'utf8') !== conteudo) throw new Error('Geometria compartilhada divergiu do Pix; execute node scripts/materializar-geometria-uf.mjs.');
} else writeFileSync(destino, conteudo);
