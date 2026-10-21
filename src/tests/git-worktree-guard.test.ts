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

  it('captura um patch maior que 64 MB sem estourar buffer ou memória e ainda detecta nova edição', () => {
    // 16/10/2026: o ciclo diário do crédito regenera a gold (96,6 MB) e, sem publicação
    // havia 22 dias, o git diff passou de 64 MB: o execFileSync lançou ENOBUFS e o vitest
    // abortou com código 134. Aqui o patch de 72 MB vem de um arquivo de uma linha só,
    // que o git compara sem custo; o que importa é o tamanho da saída.
    const linha = (c: string) => c.repeat(36_000_000) + '\n';
    writeFileSync(join(root, 'gold.json'), linha('a'));
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'gold grande');
    writeFileSync(join(root, 'gold.json'), linha('b'));
    // o teste só vale se o patch passa de fato do limite antigo de 64 MB
    const patch = execFileSync('git', ['diff', '--no-ext-diff', '--binary', 'HEAD'], { cwd: root, maxBuffer: 512 * 1024 * 1024 });
    expect(patch.length).toBeGreaterThan(64 * 1024 * 1024);
    const before = captureWorktree(root);
    expect(before.trackedDiff).toMatch(/^[0-9a-f]{64}$/);
    expect(before.status).toContain('gold.json');
    expect(() => assertWorktreeUnchanged(root, before)).not.toThrow();
    writeFileSync(join(root, 'gold.json'), linha('c'));
    expect(captureWorktree(root).status).toBe(before.status);
    expect(() => assertWorktreeUnchanged(root, before)).toThrow('A suíte alterou a árvore Git');
  }, 60_000);

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
