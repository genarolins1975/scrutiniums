"""Reconstitui o snapshot versionado a partir das respostas originais, sem rede."""
from __future__ import annotations
import argparse
import base64
import gzip
import hashlib
import io
import json
import pathlib
import re
import tarfile
try:
    from .censo import gerar
except ImportError:
    from censo import gerar


def reproduzir(seed:pathlib.Path,saida:pathlib.Path):
    saida.mkdir(parents=True,exist_ok=True)
    encoded=(seed/'originais.tar.gz.b64').read_bytes()
    if len(encoded)>48*1024*1024:raise ValueError('Pacote compactado excede o limite')
    with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(encoded,validate=True))) as gz:
        raw=gz.read(128*1024*1024+1)
    if len(raw)>128*1024*1024:raise ValueError('Pacote descompactado excede o limite')
    origem=saida/'originais';origem.mkdir(exist_ok=True);seen=set()
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as tar:
        for member in tar.getmembers():
            if not member.isfile() or not re.fullmatch(r'[A-Za-z0-9_.-]+',member.name) or member.name in {'.','..'} or member.name in seen:
                raise ValueError('Entrada insegura ou duplicada no pacote')
            if member.size>64*1024*1024:raise ValueError('Original excede o limite')
            seen.add(member.name)
            handle=tar.extractfile(member)
            if handle is None:raise ValueError('Original sem conteúdo')
            with handle:(origem/member.name).write_bytes(handle.read())
    gold=gerar(origem,saida/'reproduzido',offline=True)
    expected=(seed/'gold.json').read_bytes();actual=(saida/'reproduzido/gold.json').read_bytes()
    sha=hashlib.sha256(expected).hexdigest()
    if sha!=(seed/'gold.sha256').read_text().strip():raise ValueError('Hash versionado diverge')
    if expected!=actual:raise ValueError('Reextração dos originais diverge do snapshot versionado')
    report={'estado':'aprovado','reproducao':'identidade byte a byte','sha256':sha,'bytes':len(actual),'originais':len(seen),'indicadores':len(gold['metrics']),'observacoes':len(gold['observations']),'territorios':len(gold['territories']),'sem_rede':True}
    (saida/'resultado.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REPRODUCAO',json.dumps(report,ensure_ascii=False))
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--seed',type=pathlib.Path,default=pathlib.Path('data/eficiencia_mobilidade'));p.add_argument('--saida',type=pathlib.Path,required=True);a=p.parse_args();reproduzir(a.seed,a.saida)
