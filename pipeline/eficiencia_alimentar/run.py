"""Validação e promoção atômica do recorte oficial; execução stdlib, sem rede."""
import csv,gzip,hashlib,io,json,os,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];BASE=Path(__file__).resolve().parent
CAMPOS=('id','nome','definicao','universo','periodo','frequencia','formula','numerador','denominador','unidade','fonte','registro','cobertura','ausencias','quebras','papel_escore','peso','referencia','estado','limitacoes')
def le():
    manifest=json.loads((BASE/'seed/manifesto.json').read_text())
    raw=(BASE/'seed/recorte_ibge.json.gz').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=manifest['seed_sha256']:raise ValueError('Integridade do seed reprovada')
    return json.loads(gzip.decompress(raw)),manifest,json.loads((BASE/'catalogo.json').read_text())
def valida(data,catalog):
    towns={t['code']:t for t in data['towns']}
    if len(towns)!=5570 or len(data['towns'])!=5570:raise ValueError('Cobertura municipal inválida')
    if len(data['metrics'])!=10 or len(data['needs'])!=12:raise ValueError('Cobertura de indicadores inválida')
    for ficha in catalog['indicadores']:
        if any(k not in ficha for k in CAMPOS):raise ValueError('Ficha incompleta')
    if len(catalog['indicadores'])!=15:raise ValueError('Catálogo incompleto')
    for m in data['metrics']:
        if len(m['rows'])!=5570 or {r['code'] for r in m['rows']}!=set(towns):raise ValueError('Chaves municipais inválidas')
        for r in m['rows']:
            if not r['status'] or 'raw' not in r:raise ValueError('Observação inválida')
            if r['raw'] in (None,'-','Não sabe informar') and r['status']=='OBSERVADO':raise ValueError('Ausência convertida em observado')
    if len({(r['territory'],r['year']) for r in data['needs']})!=12:raise ValueError('PNAD duplicada')
    for r in data['needs']:
        values=[r[k] for k in ('secure','insecure','mild','moderate','severe')]
        if any(not isinstance(v,(int,float)) or not 0<=v<=100 for v in values):raise ValueError('Percentual inválido')
        if abs(r['secure']+r['insecure']-100)>.11 or abs(sum(values[2:])-r['insecure'])>.16:raise ValueError('Arredondamento inconsistente')
    return towns

def promove(data,manifest,catalog,dest=None):
    towns=valida(data,catalog) # gate before ANY public write
    out=Path(dest) if dest else ROOT/'public/eficiencia/seguranca-alimentar'
    files={}
    gold={'version':'2026-10-10.1','manifest':manifest,'needs':data['needs'],'catalog':catalog['indicadores'],'ufs':sorted({t['uf'] for t in towns.values()}),'municipal_records':55700,'score_status':'DATA_AND_REFERENCE_PENDING'}
    files['panorama.json']=json.dumps(gold,ensure_ascii=False,separators=(',',':')).encode()
    for uf in gold['ufs']:
        local=[dict(t,values={m['id']:next(r for r in m['rows'] if r['code']==t['code']) for m in data['metrics']}) for t in towns.values() if t['uf']==uf]
        files[f'uf-{uf}.json']=json.dumps(local,ensure_ascii=False,separators=(',',':')).encode()
    def csvbytes(head,rows):
        f=io.StringIO();w=csv.writer(f,delimiter=';');w.writerow(head);w.writerows(rows);return ('\ufeff'+f.getvalue()).encode()
    files['municipios.csv']=csvbytes(['codigo_ibge','municipio','uf','variavel','indicador','periodo','unidade','valor_original','status','papel_escore','fonte','registro'],[[r['code'],towns[r['code']]['city'],towns[r['code']]['uf'],m['id'],m['name'],m['period'],m['unit'],r['raw'],r['status'],m['role'],'IBGE MUNIC 2024',m['sheet']+' / '+m['id']] for m in data['metrics'] for r in m['rows']])
    files['pnad.csv']=csvbytes(['territorio','ano','seguranca_pct','inseguranca_pct','leve_pct','moderada_pct','grave_pct','fonte','pagina'],[[r[k] for k in ('territory','year','secure','insecure','mild','moderate','severe')]+['IBGE PNADC 2024',6] for r in data['needs']])
    files['dicionario.json']=json.dumps(catalog,ensure_ascii=False,indent=2).encode()
    files['manifesto.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
    # Prepare all outputs first; never promote a partially validated snapshot.
    out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=out.parent) as staging:
        for name,body in files.items():(Path(staging)/name).write_bytes(body)
        for name in files:os.replace(Path(staging)/name,out/name)
    return gold
if __name__=='__main__':
    data,manifest,catalog=le();promove(data,manifest,catalog)
    print('Segurança alimentar: 15 fichas, 55700 respostas MUNIC, 12 recortes PNADC; gate aprovado.')
