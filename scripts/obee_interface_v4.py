"""Manifesto complementar da interface do índice v4.

O pacote congelado da edição (pacote-v4.json) fixa código de cálculo, saídas, documentos
e fontes, mas não os arquivos que apresentam o índice. Este manifesto identifica por
SHA-256 a interface examinada, para que uma revisão da apresentação fique vinculada a um
conteúdo exato. Não altera o pacote nem o seu packet_sha256.

Uso: `python3 scripts/obee_interface_v4.py` regrava o manifesto; `--check` só confere.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
V4 = ROOT / 'docs/obee/resultados/v4'
OUTPUT = V4 / 'interface-v4.json'
PACOTE = V4 / 'pacote-v4.json'
FILES = [
    'src/components/eficiencia/IndiceResultados.tsx',
    'src/components/eficiencia/IndiceResultados.module.css',
    'src/lib/eficiencia/indice-v4-nucleo.ts',
    'src/lib/eficiencia/indice-v4.ts',
]


def build():
    pacote = json.loads(PACOTE.read_text(encoding='utf-8'))
    return {
        'version': 1,
        'nature': 'manifesto_complementar_interface',
        'edition': pacote['edition'],
        'packet_sha256': pacote['packet_sha256'],
        'note': ('Identifica a interface do índice v4, que o pacote congelado não inclui. '
                 'Não altera o pacote; mudança na interface exige regravar este manifesto.'),
        'files': [{'path': p, 'sha256': hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in FILES],
    }


def render(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help='confere sem escrever')
    args = parser.parse_args(argv)
    text = render(build())
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != text:
            print('interface-v4.json desatualizado: rode python3 scripts/obee_interface_v4.py', file=sys.stderr)
            return 1
        print(json.dumps({'interface_v4': 'ok', 'files': len(FILES)}))
        return 0
    OUTPUT.write_text(text, encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
