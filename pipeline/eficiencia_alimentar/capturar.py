"""Recria o recorte a partir dos originais locais; não baixa nem publica automaticamente.

python -m pipeline.eficiencia_alimentar.capturar --munic arquivo.xlsx --pnadc informativo.pdf
Usa o leitor XLSX stdlib do OBEE e pdftotext (Poppler) para a página impressa 6.
"""
import argparse,gzip,hashlib,json,re,subprocess
from pathlib import Path
from pipeline.eficiencia.fontes.xlsx import linhas
from pipeline.eficiencia_alimentar.run import BASE,le,valida

def captura(munic,pdf):
    old,manifest,catalog=le();metrics=[];towns={}
    # Source fingerprint prevents replacing the reviewed edition silently.
    for path,source in zip((munic,pdf),manifest['sources']):
        if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Edição oficial diferente: requer nova captura, manifesto e revisão')
    for m in old['metrics']:
        rows=list(linhas(munic,m['sheet']));head=rows[0];idx=head.index(m['id']);values=[]
        for row in rows[1:]:
            if not row or row[0] is None:continue
            code=str(int(row[0]));raw=row[idx] if idx<len(row) else None
            if isinstance(raw,float) and raw.is_integer():raw=int(raw)
            towns[code]={'code':code,'city':row[3],'uf':row[1]}
            status='OBSERVADO'
            if raw is None:status='AUSENTE'
            elif raw=='-':status='NAO_APLICAVEL_OU_SEM_REGISTRO'
            elif 'Não sabe' in str(raw):status='NAO_SABE_INFORMAR'
            elif 'Não informou' in str(raw) or 'Não respondeu' in str(raw):status='NAO_INFORMADO'
            values.append({'code':code,'raw':raw,'status':status})
        metrics.append(dict(m,rows=values))
    text=subprocess.check_output(['pdftotext','-layout',str(pdf),'-']).decode();page=text.split('\f')[5];year=None;needs=[]
    for line in page.splitlines():
        if 'PNADC 2023' in line:year=2023
        if 'PNADC 2024' in line:year=2024
        match=re.match(r'\s*(Brasil|Norte|Nordeste|Sudeste|Sul|Centro-Oeste)\s+100,0\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)',line)
        if match and year:needs.append(dict(zip(['territory','year','secure','insecure','mild','moderate','severe'],[match[1],year,*[float(v.replace(',','.')) for v in match.groups()[1:]]])))
    data=dict(old,metrics=metrics,towns=sorted(towns.values(),key=lambda t:t['city']),needs=needs);valida(data,catalog)
    if data!=old:raise ValueError('Recorte diverge do snapshot revisado')
    # Replay is exact; retain capture time and reviewed source identity.
    print('Reextração dos originais confere com o seed revisado; nenhuma edição alterada.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--munic',type=Path,required=True);p.add_argument('--pnadc',type=Path,required=True);a=p.parse_args();captura(a.munic,a.pnadc)
