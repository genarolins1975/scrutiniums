"""Carrega observações tipadas já extraídas, verificando integridade antes de ler."""
import gzip,hashlib,json
from pathlib import Path
BASE=Path(__file__).parent

def le(base=BASE):
 manifest=json.loads((base/'seed/manifesto.json').read_text())
 packed=(base/'seed/recorte.json.gz').read_bytes()
 if hashlib.sha256(packed).hexdigest()!=manifest['seed_sha256']:raise ValueError('Hash SUAS divergente')
 return json.loads(gzip.decompress(packed)),manifest
