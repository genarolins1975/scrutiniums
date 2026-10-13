"""Resumo municipal descritivo. Não calcula nem preenche escores."""
import base64
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    raw = (ROOT / path).read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def unique(rows, key):
    result = {}
    for row in rows:
        k = str(row[key])
        if k in result:
            raise ValueError(f'Observação duplicada: {k}')
        result[k] = row
    return result


def build():
    atlas, _ = read('src/lib/eficiencia/atlas-resumo.json')
    cities = [dict(id=c['id'], name=c['name']) for c in atlas['cities']]
    education, eh = read('src/lib/eficiencia/frequencia-escolar.json')
    if education['period'] != 2022 or education['table'] != '10056' or education['variable'] != '3795':
        raise ValueError('Recorte de frequência alterado; revisar a edição do panorama')
    health, hh = read('public/eficiencia/gold/saude_capitais.json')
    mobility, mh = read('data/eficiencia_mobilidade/gold.json')
    if mh != (ROOT/'data/eficiencia_mobilidade/gold.sha256').read_text().strip():
        raise ValueError('Hash de Mobilidade divergente')
    work_path = 'public/eficiencia/trabalho-renda/snapshot.payload.gz.b64'
    work_bytes = gzip.decompress(base64.b64decode((ROOT/work_path).read_bytes()))
    work = json.loads(work_bytes)
    wh = hashlib.sha256((ROOT/work_path).read_bytes()).hexdigest()
    ws = next(s for s in work['fontes'] if s['id']=='censo-renda')
    if hashlib.sha256((ROOT/('public'+ws['bruto'])).read_bytes()).hexdigest()!=ws['sha256']:
        raise ValueError('Hash da fonte de renda divergente')
    hs = next(s for s in health['fontes'] if s['id']=='relatorio_aps_cobertura')['capturas'][0]
    ms = next(s for s in mobility['sources'] if s['arquivo']=='censo_2022_tempo.json')
    em = unique([o for o in education['observations'] if o['age']=='47813'], 'territory')
    hm = unique([o for o in health['observacoes'] if o['indicador']=='sau.aps.cobertura_potencial' and o['ano']==2025 and o['componente'] is None], 'ente')
    wm = unique([o for o in work['observacoes'] if o['indicadorId']=='renda-mediana' and o['periodo']=='2022' and o['sexo']=='total' and o['grupo']=='Total'], 'territorioId')
    mm = unique([o for o in mobility['observations'] if o['metric']=='censo.tempo.longo' and o['period']=='2022'], 'territory')
    metrics = [
        dict(id='educacao', chapter='Educação', question='Estar na escola', title='Frequência escolar · 4 a 5 anos', period='2022', unit='%', kind='Condição dos moradores',
             universe='Crianças residentes de 4 a 5 anos, sexo e cor/raça totais.',
             warning='Inclui redes públicas e privadas. Frequência não mede vagas públicas, aprendizagem ou qualidade do atendimento.',
             source='IBGE · Censo 2022 · tabela 10056', sourceUrl='https://sidra.ibge.gov.br/tabela/10056', capturedAt=education['capturedAt'],
             sourcePath='src/lib/eficiencia/frequencia-escolar.json', sourceHash=eh, sourceQueries=[s['url'] for s in education['sources']],
             detailPath='#atlas-comparacao', methodPath='/eficiencia-estatal/educacao-municipal-capitais/metodos', scaleMax=100),
        dict(id='saude', chapter='Saúde', question='Capacidade de cuidar', title='Cobertura potencial da atenção primária', period='Dezembro de 2025', unit='%', kind='Capacidade do serviço',
             universe='Capacidade das equipes de APS ÷ população de referência do Ministério da Saúde.',
             warning='Capacidade teórica: não equivale a pessoas atendidas. Pode superar 100%. Mudanças da base populacional impedem interpretar a variação como mudança do atendimento.',
             source='Ministério da Saúde · Relatório APS', sourceUrl=hs['pagina'], capturedAt=hs['capturado_em'],
             sourcePath='public/eficiencia/gold/saude_capitais.json', sourceHash=hh, sourceQueries=[hs['url']],
             detailPath='/eficiencia-estatal/saude-capitais/comparar', methodPath='/eficiencia-estatal/saude-capitais/metodos', scaleMax=0),
        dict(id='trabalho', chapter='Trabalho e renda', question='Renda para viver', title='Renda domiciliar por pessoa · mediana', period='Julho de 2022', unit='R$', kind='Condição dos moradores',
             universe=next(i['universo'] for i in work['indicadores'] if i['id']=='renda-mediana'),
             warning='Reais nominais de julho de 2022; resultados preliminares da amostra. Não é salário, renda atual ou efeito de uma política pública.',
             source=ws['nome'], sourceUrl=ws['url'], capturedAt=ws['capturadoEm'], sourcePath=work_path, sourceHash=wh, sourceQueries=[ws['consulta']],
             detailPath='/eficiencia-estatal/trabalho-renda/renda-das-familias', methodPath='/eficiencia-estatal/trabalho-renda/metodos', scaleMax=0),
        dict(id='mobilidade', chapter='Mobilidade', question='Tempo no caminho', title='Mais de uma hora até o trabalho', period='2022', unit='%', kind='Condição dos moradores',
             universe=next(m['universe'] for m in mobility['metrics'] if m['id']=='censo.tempo.longo'),
             warning='Estimativa do Censo 2022. Soma das três faixas acima de uma hora ÷ total publicado; o resíduo não é redistribuído. Não é tempo médio ou viagem de ida e volta. Pequenas diferenças não sustentam rankings.',
             source='IBGE · Censo 2022 · tabela 10330', sourceUrl=ms['url'], capturedAt=ms['capturado_em'], sourcePath='data/eficiencia_mobilidade/gold.json', sourceHash=mh,
             sourceQueries=[s['url'] for s in ms['partes']], detailPath='/eficiencia-estatal/mobilidade-transporte/tempo', methodPath='/eficiencia-estatal/mobilidade-transporte/metodos', scaleMax=100),
    ]
    for metric, records in zip(metrics, [em, hm, wm, mm]):
        output = []
        for city in cities:
            o = records.get(city['id'])
            value = o.get('value',o.get('valor')) if o else None
            state = o.get('state',o.get('status','observado')) if o else 'ausente'
            eligible = value is not None and state in ('observado','OBSERVADO') and (metric['id']!='saude' or o.get('elegivel_comparacao') is True)
            if value is not None and (not isinstance(value,(int,float)) or not math.isfinite(value) or value<0):
                raise ValueError('Valor inválido')
            if metric['id'] in ('educacao','mobilidade') and value is not None and value>100:
                raise ValueError('Percentual fora do domínio')
            calc = o.get('calculo',{}) if o else {}
            output.append(dict(territory=city['id'], value=value, eligible=eligible, state=state,
                               numerator=o.get('numerator',calc.get('numerador')) if o else None,
                               denominator=o.get('denominator',calc.get('denominador')) if o else None,
                               locator=o.get('cell',o.get('registro',f"{metric['id']}/{city['id']}/{metric['period']}")) if o else None,
                               note=o.get('nota','') if o else 'Sem observação no recorte'))
        values = [o['value'] for o in output if o['eligible']]
        metric.update(observations=output, reference=dict(value=median(values) if values else None, count=len(values), total=len(cities), method='Mediana simples das capitais elegíveis; sem ponderação populacional. Não é meta nem agregado nacional.'))
        if not metric['scaleMax']:
            step=25 if metric['id']=='saude' else 500
            metric['scaleMax']=max(step,math.ceil(max(values,default=0)/step)*step)
        if metric['id']=='saude':
            metric['territoryKeys']={str(c['cod_ibge']):c['id'] for c in health['universo']['capitais']}
    return dict(version=1, role='PANORAMA_DESCRITIVO_NAO_ESCORE', cities=cities, metrics=metrics)


def write(data):
    (ROOT/'src/lib/eficiencia/panorama-atlas.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    with (ROOT/'public/eficiencia/atlas/panorama-capitais.csv').open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['codigo','capital','tema','indicador','periodo','unidade','valor','elegivel','estado','numerador','denominador','fonte','captura','localizador','arquivo_sha256'])
        names={c['id']:c['name'] for c in data['cities']}
        for m in data['metrics']:
            for o in m['observations']:
                w.writerow([o['territory'],names[o['territory']],m['chapter'],m['title'],m['period'],m['unit'],o['value'],o['eligible'],o['state'],o['numerator'],o['denominator'],m['sourceUrl'],m['capturedAt'],o['locator'],m['sourceHash']])

if __name__=='__main__':
    data=build();write(data)
    print([(m['id'],m['reference']['count'],m['reference']['value'],m['scaleMax']) for m in data['metrics']])
