import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureWorktree, assertWorktreeUnchanged } from '../../scripts/git-worktree-guard.mjs';

describe('verificação da árvore Git após a suíte', () => {
  let root: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'obee-git-guard-'));
    git('init');
    writeFileSync(join(root, 'tracked.txt'), 'original');
    writeFileSync(join(root, '.gitignore'), 'generated.json\n');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('permite materialização ignorada e falha para alteração versionada', () => {
    const before = captureWorktree(root);
    writeFileSync(join(root, 'generated.json'), '{}');
    expect(() => assertWorktreeUnchanged(root, before)).not.toThrow();
    writeFileSync(join(root, 'tracked.txt'), 'modificado pela suíte');
    expect(() => assertWorktreeUnchanged(root, before)).toThrow('A suíte alterou a árvore Git');
  });

  it('não confunde edição preexistente com efeito da suíte e detecta nova edição', () => {
    writeFileSync(join(root, 'tracked.txt'), 'edição do desenvolvedor');
    const before = captureWorktree(root);
    expect(() => assertWorktreeUnchanged(root, before)).not.toThrow();
    writeFileSync(join(root, 'tracked.txt'), 'outra edição com o mesmo status M');
    expect(captureWorktree(root).status).toBe(before.status);
    expect(() => assertWorktreeUnchanged(root, before)).toThrow();
  });

  it('detecta arquivo novo, exclusão e mudança do índice', () => {
    const before = captureWorktree(root);
    writeFileSync(join(root, 'new.txt'), 'novo');
    expect(() => assertWorktreeUnchanged(root, before)).toThrow();
    rmSync(join(root, 'new.txt'));
    rmSync(join(root, 'tracked.txt'));
    expect(() => assertWorktreeUnchanged(root, before)).toThrow();
    writeFileSync(join(root, 'tracked.txt'), 'editado');
    const dirty = captureWorktree(root);
    git('add', 'tracked.txt');
    expect(() => assertWorktreeUnchanged(root, dirty)).toThrow();
  });
});
