import { fileURLToPath } from 'node:url';
import { captureWorktree, assertWorktreeUnchanged } from './git-worktree-guard.mjs';

export default async function setup() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const before = captureWorktree(root);
  // Capture first, including setup side effects in the post-suite assertion.
  await import('./materializar-trabalho-renda.mjs');
  return () => assertWorktreeUnchanged(root, before);
}
