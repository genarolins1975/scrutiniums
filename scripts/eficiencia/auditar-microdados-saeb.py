"""Inspeciona somente dicionário e TS_ESCOLA; não calcula escore ou reidentifica IDs."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import struct
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
import zlib

URL = 'https://download.inep.gov.br/microdados/microdados_saeb_2023.zip'
MEMBERS = ['Dicionario_Saeb_2023.xlsx', 'TS_ESCOLA.csv']

def acquire(root):
    with urllib.request.urlopen(urllib.request.Request(URL, method='HEAD'), timeout=20) as r:
        size = int(r.headers['Content-Length'])
    def part(start, end):
        with urllib.request.urlopen(urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}'}), timeout=40) as r:
            if r.status != 206 or r.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                raise ValueError('Resposta parcial incompatível')
            content = r.read(end-start+2)
            if len(content) != end-start+1:
                raise ValueError('Resposta incompleta')
            return content
    tail = part(size-65557, size-1)
    end = tail.rfind(b'PK\x05\x06')
    if end < 0:
        raise ValueError('Diretório ZIP ausente')
    directory = struct.unpack_from('<4s4H2LH', tail, end)
    if directory[1] or directory[2] or directory[5] > 65535:
        raise ValueError('Formato de ZIP não suportado nesta captura')
    pos = directory[6]-(size-len(tail))
    if pos < 0:
        raise ValueError('Diretório fora da janela')
    entries = []
    while tail[pos:pos+4] == b'PK\x01\x02':
        v = struct.unpack_from('<4s6H3I5H2I', tail, pos)
        name = tail[pos+46:pos+46+v[10]].decode('utf8' if v[3]&2048 else 'cp437')
        entries.append(dict(name=name,compressed=v[8],size=v[9],method=v[4],crc=v[7],offset=v[16]))
        pos += 46+v[10]+v[11]+v[12]
    manifest = []
    for suffix in MEMBERS:
        matches = [e for e in entries if e['name'].endswith('/'+suffix)]
        if len(matches) != 1:
            raise ValueError('Membro ausente ou duplicado')
        e = matches[0]
        if e['method'] != 8 or e['compressed'] > 8_000_000 or e['size'] > 30_000_000:
            raise ValueError('Formato ou tamanho fora do contrato')
        b = part(e['offset'], min(size-1,e['offset']+e['compressed']+4095))
        v = struct.unpack_from('<4s5H3I2H', b)
        if v[0] != b'PK\x03\x04':
            raise ValueError('Cabeçalho local inválido')
        start = 30+v[9]+v[10]
        raw = zlib.decompress(b[start:start+e['compressed']], -15)
        if len(raw) != e['size'] or zlib.crc32(raw) != e['crc']:
            raise ValueError('Integridade do membro inválida')
        (root/suffix).write_bytes(raw)
        manifest.append({**e,'sha256':hashlib.sha256(raw).hexdigest(),'captured_at':datetime.now(timezone.utc).isoformat()})
    (root/'acquisition-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

def audit(root):
    manifest = json.loads((root/'acquisition-manifest.json').read_text())
    for name in MEMBERS:
        e = next(e for e in manifest if e['name'].endswith('/'+name))
        raw = (root/name).read_bytes()
        if len(raw) != e['size'] or hashlib.sha256(raw).hexdigest() != e['sha256'] or zlib.crc32(raw) != e['crc']:
            raise ValueError('Arquivo local difere do manifesto')
    ns = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    wanted = {'ID_MUNICIPIO','ID_AREA','ID_UF','IN_PUBLICA','ID_LOCALIZACAO','NU_MATRICULADOS_CENSO_5EF','NU_PRESENTES_5EF','TAXA_PARTICIPACAO_5EF'}
    with zipfile.ZipFile(root/MEMBERS[0]) as z:
        strings = [''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
        sheets = ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',ns)
        sheet = next(s for s in sheets if s.attrib['name']=='TS_ESCOLA')
        relid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in rels if r.attrib['Id']==relid)
        target = target.lstrip('/') if target.startswith('/') else 'xl/'+target
        evidence = []
        for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row',ns):
            values = []
            for c in row:
                v = c.find('m:v',ns)
                if v is not None:
                    values.append(strings[int(v.text)] if c.attrib.get('t')=='s' else v.text)
            if values and values[0] in wanted:
                evidence.append({'excel_row':int(row.attrib['r']),'cells':values})
    with (root/MEMBERS[1]).open(encoding='latin1',newline='') as f:
        reader = csv.DictReader(f,delimiter=';')
        headers = reader.fieldnames
        count = sum(1 for _ in reader)
    if any('DEPEND' in h.upper() for h in headers):
        raise ValueError('Esquema mudou: revisar a identificação da rede')
    if not any(e['cells'][0]=='ID_MUNICIPIO' and 'fictícios' in ' '.join(e['cells']) for e in evidence):
        raise ValueError('Revisar semântica do identificador municipal')
    return {'source_url':URL,'reviewed_at':datetime.now(timezone.utc).isoformat(),'acquisition':'Dois membros obtidos por HTTP Range; ZIP integral não adquirido','integrity':'CRC32 e tamanho do diretório ZIP; SHA-256 dos membros locais','members':manifest,'school_rows':count,'school_headers':headers,'dictionary_sheet':'TS_ESCOLA','dictionary_evidence':evidence,'municipal_network_identifiable':False,'municipality_code_is_ibge':False,'participation_fields_present':wanted.intersection(headers)==wanted,'eligible_for_current_pilot':False,'blocking_reason':'IN_PUBLICA não separa redes municipal, estadual e federal; ID_MUNICIPIO é máscara fictícia. UF + ID_AREA permite recorte capital, mas não resolve a dependência administrativa. Não unir diretamente ao código IBGE nem substituir Municipal por Pública.'}

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cache-dir',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--acquire',action='store_true')
    args=parser.parse_args();args.cache_dir.mkdir(parents=True,exist_ok=True)
    if args.acquire:acquire(args.cache_dir)
    result=audit(args.cache_dir);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'school_rows':result['school_rows'],'eligible':result['eligible_for_current_pilot']},ensure_ascii=False))
