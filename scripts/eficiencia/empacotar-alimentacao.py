"""Empacota exclusivamente dados públicos, preservando todos os bytes e hashes."""
import pathlib,json,struct,hashlib,gzip,base64,textwrap,sys
root=pathlib.Path(__file__).resolve().parents[2]
source=root/'public/eficiencia/seguranca-alimentar'
out=root/'pipeline/eficiencia_alimentar/distribuicao'
out.mkdir(parents=True,exist_ok=True)
supplement=sys.argv[1] if len(sys.argv)>1 else None
if supplement and not supplement.replace('-','').isalnum():raise ValueError('Nome de suplemento inválido')
manifest_name=f'{supplement}-manifest.json' if supplement else 'manifest.json'
prefix=f'{supplement}-base-' if supplement else 'base-'
main=json.loads((out/'manifest.json').read_text()) if (out/'manifest.json').exists() else None
existing=json.loads((out/manifest_name).read_text()) if (out/manifest_name).exists() else None
selected={a['path'] for a in existing['arquivos']} if existing else None
if supplement and selected is None:
    already={a['path'] for a in main['arquivos']}
    for name in main.get('suplementos',[]):already.update(a['path'] for a in json.loads((out/name).read_text())['arquivos'])
    selected={p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file() and p.relative_to(source).parts[0] not in ['indices','chunks']} - already
items=[]; buffers=[]
for p in sorted(source.rglob('*')):
    if not p.is_file() or p.relative_to(source).parts[0] in ['indices','chunks']:continue
    if selected is not None and p.relative_to(source).as_posix() not in selected:continue
    b=p.read_bytes();items.append(dict(path=p.relative_to(source).as_posix(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()));buffers.append(b)
header=json.dumps(items,separators=(',',':')).encode()
payload=b'SAN1'+struct.pack('>I',len(header))+header+b''.join(buffers)
compressed=gzip.compress(payload,mtime=0)
b64=base64.b64encode(compressed).decode()
parts=[]
for i in range(0,len(b64),350000):
    name=f'{prefix}{i//350000+1:03}.gz.b64'
    (out/name).write_text('\n'.join(textwrap.wrap(b64[i:i+350000],76))+'\n');parts.append(name)
for p in out.glob(prefix+'*.gz.b64'):
    if p.name not in parts:p.unlink()
manifest=dict(versao=1,formato='SAN1: header de hashes JSON + bytes originais, gzip/base64',bytes=len(payload),sha256=hashlib.sha256(payload).hexdigest(),partes=parts,arquivos=items)
if not supplement and main and main.get('suplementos'):manifest['suplementos']=main['suplementos']
(out/manifest_name).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
if supplement:
    main['suplementos']=list(dict.fromkeys(main.get('suplementos',[])+[manifest_name]))
    (out/'manifest.json').write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n')
print(f'{len(items)} arquivos, {len(payload)} bytes originais, {len(compressed)} comprimidos, {len(parts)} partes.')
