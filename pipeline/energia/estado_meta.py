"""Cópia durável dos metadados auxiliares, sem ampliar o cache do Actions.

Um tar.gz por geração; restauração acrescenta só arquivos ausentes. O upload e
a remoção da geração anterior são feitos, nessa ordem, pelo workflow.
"""
from pathlib import Path, PurePosixPath
import os
import shutil
import sys
import tarfile
import tempfile

RAIZ = Path(__file__).resolve().parents[2]
LIMITE_ASSET = 1_900_000_000  # abaixo dos 2 GB por asset da release


def guardar(destino, pasta=None):
    pasta = Path(pasta) if pasta is not None else RAIZ / 'data/energia/meta'
    arquivos = sorted(pasta.rglob('*'))
    if not pasta.is_dir() or not any(p.is_file() for p in arquivos):
        raise ValueError('pasta meta ausente ou vazia; cópia anterior deve ser preservada')
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(destino, 'w:gz') as tar:
        for p in arquivos:
            if p.is_symlink():
                raise ValueError(f'link não permitido na pasta meta: {p}')
            if p.is_file():
                tar.add(p, arcname=p.relative_to(pasta).as_posix(), recursive=False)
    if destino.stat().st_size > LIMITE_ASSET:
        raise ValueError(f'asset meta excede {LIMITE_ASSET} bytes; não publicar')
    return destino


def restaurar(arquivo, pasta=None):
    pasta = Path(pasta) if pasta is not None else RAIZ / 'data/energia/meta'
    restaurados = 0
    # Valida e descomprime todas as entradas antes de tocar no cache.
    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp)
        with tarfile.open(arquivo, 'r:gz') as tar:
            vistos = set()
            for item in tar:
                nome = PurePosixPath(item.name)
                if (not item.isfile() or nome.is_absolute() or '..' in nome.parts
                        or not nome.parts or item.name in vistos):
                    raise ValueError(f'entrada inválida no asset meta: {item.name}')
                vistos.add(item.name)
                alvo = staging / item.name
                alvo.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(item) as fonte, alvo.open('wb') as saida:
                    shutil.copyfileobj(fonte, saida)
        for nome in sorted(vistos):
            alvo = pasta / nome
            if alvo.exists():
                continue  # bytes do cache sempre prevalecem
            if not alvo.resolve().is_relative_to(pasta.resolve()):
                raise ValueError(f'destino fora da pasta meta: {nome}')
            alvo.parent.mkdir(parents=True, exist_ok=True)
            # Mesmo com cache concorrente, nunca substituir arquivo existente.
            fd, temporario = tempfile.mkstemp(dir=alvo.parent, prefix='.restaurando-')
            try:
                with os.fdopen(fd, 'wb') as saida, (staging / nome).open('rb') as fonte:
                    shutil.copyfileobj(fonte, saida)
                os.link(temporario, alvo)  # publicação atômica e sem sobrescrita
            except FileExistsError:
                continue
            finally:
                os.unlink(temporario)
            restaurados += 1
    return restaurados


if __name__ == '__main__':
    acao, caminho = sys.argv[1:]
    if acao == 'guardar':
        print(guardar(caminho))
    elif acao == 'restaurar':
        print(f'metadados restaurados: {restaurar(caminho)} arquivo(s) ausente(s)')
    else:
        raise ValueError(f'ação desconhecida: {acao}')
