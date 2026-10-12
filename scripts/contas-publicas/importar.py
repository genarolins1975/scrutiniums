"""RTN/SIOP: captura explícita, validação e snapshot; nunca executado no build.
Requer Python 3.9+, requests e openpyxl. Uso: python3 scripts/contas-publicas/importar.py --cache /tmp/contas-fontes
Sem --cache, baixa fontes oficiais para diretório temporário.
"""
import argparse, datetime as dt, hashlib, json, math, pathlib, tempfile
import openpyxl, requests
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = 'https://www.tesourotransparente.gov.br/ckan/dataset/ab56485b-9c40-4efb-8563-9ce3e1973c4b/resource/527ccdb1-3059-42f3-bf23-b5e3ab4c6dc6/download/seriehistoricajul26.xlsx'
ENDPOINT = 'https://www1.siop.planejamento.gov.br/sparql/'
FIELDS = ['inicial','atualizada','empenhado','liquidado','pago']
ROWS = {'receitaTotal':6,'transferencias':29,'receitaLiquida':38,'despesa':39,'previdencia':40,'pessoal':41,'outrasObrigatorias':42,'programacaoFinanceira':63,'resultado':66}
EXPECTED = {6:'1. RECEITA TOTAL',29:'2. TRANSF.',38:'3. RECEITA LÍQUIDA',39:'4. DESPESA TOTAL',40:'4.1',41:'4.2',42:'4.3',63:'4.4',66:'5. RESULTADO PRIMÁRIO'}
def check(ok, message):
    if not ok: raise ValueError(message)
def close(a,b):
    check(abs(a-b)<0.01, f'Totais incompatíveis: {a} / {b}')
def main():
    p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path);args=p.parse_args()
    cache=args.cache or pathlib.Path(tempfile.mkdtemp(prefix='contas-fontes-'))
    queries={name:(ROOT/f'scripts/contas-publicas/{name}.rq').read_text() for name in ['esferas','gnd']}
    if not args.cache:
        r=requests.get(URL,timeout=90);r.raise_for_status();(cache/'rtn.xlsx').write_bytes(r.content)
        for year in [2025,2026]:
            for name in queries:
                query=queries[name].replace('/2025/',f'/{year}/').replace('YEAR',str(year))
                r=requests.get(ENDPOINT,params={'query':query,'format':'application/sparql-results+json'},timeout=90);r.raise_for_status()
                (cache/f'{"siop" if name=="esferas" else "gnd"}{year}.json').write_bytes(r.content)
    captured=dt.datetime.now(dt.timezone.utc).isoformat()
    w=openpyxl.load_workbook(cache/'rtn.xlsx',data_only=True,read_only=True)
    def extract(sheet,monthly):
        cells=list(w[sheet].values)
        check('Milhões' in cells[2][0] and 'Correntes' in cells[2][0], 'Unidade RTN alterada')
        for row,label in EXPECTED.items():check(cells[row-1][0].strip().startswith(label),f'Linha RTN alterada: {sheet}:{row}')
        out=[]
        for col,date in enumerate(cells[4][1:],start=1):
            year=date.year if monthly else date
            if not isinstance(year,int) or year<2020:continue
            period=date.strftime('%Y-%m') if monthly else str(year)
            values={key:cells[row-1][col] for key,row in ROWS.items()}
            check(all(isinstance(v,(int,float)) and math.isfinite(v) for v in values.values()),f'RTN incompleto: {period}')
            close(values['receitaTotal']-values['transferencias'],values['receitaLiquida'])
            close(values['receitaLiquida']-values['despesa'],values['resultado'])
            close(sum(values[k] for k in ['previdencia','pessoal','outrasObrigatorias','programacaoFinanceira']),values['despesa'])
            out.append({'periodo':period,'coluna':openpyxl.utils.get_column_letter(col+1),**values})
        return out
    monthly=extract('1.1',True);annual=extract('2.1',False)
    for a in annual:
        months=[m for m in monthly if m['periodo'].startswith(a['periodo'])]
        check(len(months)==12,'Ano incompleto em série anual')
        for key in ROWS:close(sum(m[key] for m in months),a[key])
    budget=[]
    for year in [2025,2026]:
        def read(name):return json.loads((cache/f'{name}{year}.json').read_text())['results']['bindings']
        spheres=[]
        for row in read('siop'):
            check(row['cod']['value'] in ['10','20'],'Esfera fora do OFSS')
            spheres.append({'codigo':row['cod']['value'],'nome':row['nome']['value'],'atualizacao':row['data']['value'],**{k:float(row[k]['value']) for k in FIELDS}})
        check(sorted(r['codigo'] for r in spheres)==['10','20'],'Esferas ausentes/duplicadas')
        groups=[]
        for row in read('gnd'):
            check(all(row['itens']['value']==row[k]['value'] for k in ['cobertura','coberturaAtualizada','coberturaEmpenhado','coberturaLiquidado','coberturaPago']),'Itens sem valores ou duplicados')
            groups.append({'codigo':row['cod']['value'],'nome':row['nome']['value'],**{k:float(row[k]['value']) for k in FIELDS}})
        totals={k:sum(s[k] for s in spheres) for k in FIELDS}
        residuos={key:totals[key]-sum(g[key] for g in groups) for key in FIELDS}
        check(all(abs(v)<=5 for v in residuos.values()), 'Divergência SIOP superior a R$ 5 entre agregações')
        check(all(math.isfinite(g[k]) for g in spheres+groups for k in FIELDS),'Valor SIOP inválido')
        budget.append({'ano':year,'esferas':spheres,'grupos':groups,'total':totals,'residuosEsferasMenosGND':residuos})
    files=['rtn.xlsx','siop2025.json','siop2026.json','gnd2025.json','gnd2026.json']
    data={'versao':1,'captura':captured,'publicacaoRTN':None,'unidadeRTN':'R$ milhões correntes','unidadeSIOP':'R$ correntes','fonteRTN':URL,'fonteSIOP':ENDPOINT,'referenciaRTN':monthly[-1]['periodo'],'linhasRTN':ROWS,'sha256':{f:hashlib.sha256((cache/f).read_bytes()).hexdigest() for f in files},'rtnMensal':monthly,'rtnAnual':annual,'orcamento':budget,'validacao':{'identidadesRTN':True,'mensalConciliadoAnual':True,'esferasConciliadasGND':True,'toleranciaRTNMilhoes':0.01,'toleranciaSIOPReais':5}}
    # Raw SIOP responses are small and retained; original XLSX is reproducible by URL + hash.
    dest=ROOT/'src/lib/contas-publicas/snapshots';dest.mkdir(exist_ok=True)
    (dest/'dados.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    raw=ROOT/'data/contas-publicas/fontes';raw.mkdir(parents=True,exist_ok=True)
    for f in files[1:]:(raw/f).write_bytes((cache/f).read_bytes())
    print('Snapshot validado:',len(monthly),'meses RTN;',len(annual),'anos;',len(budget),'exercícios SIOP')
if __name__=='__main__':main()
