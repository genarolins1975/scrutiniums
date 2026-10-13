import { fileURLToPath } from 'node:url';
import { captureWorktree, assertWorktreeUnchanged } from './git-worktree-guard.mjs';

export default async function setup() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const before = captureWorktree(root);
  // Capture first, including setup side effects in the post-suite assertion.
  // Os três artefatos derivados são gitignorados e nascem de sementes com hash
  // conferido. Materializá-los aqui, e não só no `pretest`, torna a suíte
  // autossuficiente em qualquer invocação: o ciclo diário chamava `npx vitest run`
  // direto, sem `pretest`, e de 10/10/2026 em diante reprovou toda gold do dia por
  // ENOENT em assistencia-social/panorama.json e seguranca-alimentar/uf-AC.json.
  await import('./materializar-assistencia.mjs');
  await import('./materializar-seguranca-alimentar.mjs');
  await import('./materializar-trabalho-renda.mjs');
  return () => assertWorktreeUnchanged(root, before);
}
