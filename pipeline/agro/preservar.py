"""Cria candidato validado a partir de fontes JÁ versionadas, sem promover a edição.

python3 -m pipeline.agro.preservar --destino /tmp/agro-candidato --data 2026-10-17
Não coleta fontes oficiais nem modifica seed/gold aceitos. A revisão de datas,
licenças e mudanças de contrato continua obrigatória antes de substituir a edição.
"""
import argparse
from datetime import date
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from .run import ROOT, SEED, carregar_fontes, normalizar, serializar


def preparar(destino: Path, preservado_em: str):
    date.fromisoformat(preservado_em)
    if destino.exists():
        raise ValueError('Destino já existe; preserve o candidato anterior ou escolha outro.')
    manifest = json.loads((SEED / 'fontes.json').read_text())
    manifest['preservadoEm'] = preservado_em
    # O diretório temporário só é renomeado após validar todas as fontes e saídas.
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destino.parent) as temp:
        candidate = Path(temp) / 'seed'
        candidate.mkdir()
        for source in manifest['fontes']:
            path = source['arquivoRepositorio']
            commit = subprocess.check_output(['git', 'log', '-1', '--format=%H', '--', path], cwd=ROOT, text=True).strip()
            versioned = subprocess.check_output(['git', 'show', f'{commit}:{path}'], cwd=ROOT)
            raw = (ROOT / path).read_bytes()
            if raw != versioned:
                raise ValueError('Original diverge do commit de origem: ' + path)
            compressed = gzip.compress(raw, mtime=0)
            (candidate / source['arquivo']).write_bytes(compressed)
            source.update(commitRepositorio=commit, sha256Original=hashlib.sha256(raw).hexdigest(), sha256Arquivo=hashlib.sha256(compressed).hexdigest())
        (candidate / 'fontes.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        metadata, sources = carregar_fontes(candidate)
        outputs = serializar(normalizar(metadata, sources))
        if len(outputs) != 5:
            raise ValueError('Conjunto derivado incompleto')
        candidate.rename(destino)
    return {'candidato': str(destino), 'fontes': len(manifest['fontes']), 'promovido': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destino', required=True, type=Path)
    parser.add_argument('--data', required=True, help='Data de preservação, não data de captura oficial')
    args = parser.parse_args()
    print(json.dumps(preparar(args.destino, args.data), ensure_ascii=False))


if __name__ == '__main__':
    main()
