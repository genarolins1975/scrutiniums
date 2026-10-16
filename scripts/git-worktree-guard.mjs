import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * SHA-256 da saída de um comando git, lida em blocos de 1 MB.
 *
 * Em 16/10/2026 o `git diff --binary HEAD` do ciclo diário passou de 64 MB: a gold
 * regenerada soma 96,6 MB em 3.894 arquivos de JSON indentado e, sem publicação havia
 * 22 dias, difere da publicada em muitas linhas (uma publicação diária típica muda
 * 441.792 linhas, medido no commit acc5c6e5f de 24/09/2026). O `execFileSync` com
 * `maxBuffer` lançou ENOBUFS e o vitest, ao tratar o erro, estourou a memória (código
 * 134). A saída vai para um arquivo temporário e entra no hash sem nunca ficar inteira
 * na memória, de modo que o tamanho do patch deixa de ser um limite.
 */
function hashDaSaida(root, args) {
  const dir = mkdtempSync(join(tmpdir(), 'wt-guard-'));
  const arquivo = join(dir, 'saida');
  try {
    const fd = openSync(arquivo, 'w');
    let r;
    try {
      r = spawnSync('git', args, { cwd: root, stdio: ['ignore', fd, 'pipe'] });
    } finally {
      closeSync(fd);
    }
    if (r.error) throw new Error(`git ${args.join(' ')}: ${r.error.message}`);
    if (r.status !== 0) {
      throw new Error(`git ${args.join(' ')} terminou com código ${r.status}: ${String(r.stderr ?? '').slice(0, 300)}`);
    }
    const hash = createHash('sha256');
    const leitura = openSync(arquivo, 'r');
    const bloco = Buffer.allocUnsafe(1 << 20);
    try {
      for (;;) {
        const n = readSync(leitura, bloco, 0, bloco.length, null);
        if (n === 0) break;
        hash.update(bloco.subarray(0, n));
      }
    } finally {
      closeSync(leitura);
    }
    return hash.digest('hex');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Capture status plus patch bytes: catches a second edit to an already dirty file. */
export function captureWorktree(root) {
  return {
    // o status é uma linha por arquivo (diretórios novos colapsam em uma): cabe com folga
    status: execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'),
    trackedDiff: hashDaSaida(root, ['diff', '--no-ext-diff', '--binary', 'HEAD']),
    stagedDiff: hashDaSaida(root, ['diff', '--no-ext-diff', '--binary', '--cached']),
  };
}

export function assertWorktreeUnchanged(root, before) {
  const after = captureWorktree(root);
  if (Object.keys(before).some(key => before[key] !== after[key])) {
    throw new Error('A suíte alterou a árvore Git. Confira git status e git diff.\n'
      + `Antes:\n${before.status || '(limpo)\n'}Depois:\n${after.status || '(limpo)\n'}`);
  }
}
