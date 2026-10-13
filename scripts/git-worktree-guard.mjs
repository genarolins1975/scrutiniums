import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/** Capture status plus patch bytes: catches a second edit to an already dirty file. */
export function captureWorktree(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return {
    status: git('status', '--porcelain=v1', '--untracked-files=normal').toString('utf8'),
    trackedDiff: createHash('sha256').update(git('diff', '--no-ext-diff', '--binary', 'HEAD')).digest('hex'),
    stagedDiff: createHash('sha256').update(git('diff', '--no-ext-diff', '--binary', '--cached')).digest('hex'),
  };
}

export function assertWorktreeUnchanged(root, before) {
  const after = captureWorktree(root);
  if (Object.keys(before).some(key => before[key] !== after[key])) {
    throw new Error('A suíte alterou a árvore Git. Confira git status e git diff.\n'
      + `Antes:\n${before.status || '(limpo)\n'}Depois:\n${after.status || '(limpo)\n'}`);
  }
}
