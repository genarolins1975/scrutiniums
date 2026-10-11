"""Gera somente o resumo da entrada OBEE a partir das bases já publicadas."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
csv_path = ROOT / 'public/eficiencia/series/edu_saeb_rede_municipal.csv'
food_path = ROOT / 'public/eficiencia/seguranca-alimentar/panorama.json'
cities = []
with csv_path.open(encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f):
        if r['ano'] != '2023' or r['etapa'] != 'Ensino fundamental, anos iniciais' or r['componente'] != 'portugues':
            continue
        observed = r['status'] == 'OBSERVADO' and r['elegivel_comparacao'] == 'sim' and r['valor'] != ''
        cities.append({'id': r['codigo_ibge'], 'name': r['capital'], 'uf': r['uf'],
            'value': float(r['valor']) if observed else None, 'state': r['status'],
            'reason': r['motivo_inelegibilidade'], 'sourceId': r['fonte'], 'locator': r['registro']})
if len(cities) != 26 or len({r['id'] for r in cities}) != 26:
    raise ValueError('Universo inesperado de capitais')
food = json.loads(food_path.read_text())
regions = [{'id': r['territory'], 'name': r['territory'], 'value': r['secure']}
    for r in food['needs'] if r['year'] == 2024]
if len(regions) != 6 or len({r['id'] for r in regions}) != 6:
    raise ValueError('Universo alimentar inesperado')
data = {'cities': sorted(cities, key=lambda r: r['name']), 'regions': regions,
    'education': {'period': '2023', 'unit': 'pontos na escala Saeb', 'source': 'INEP · Saeb',
        'universe': 'Português, anos iniciais do ensino fundamental, escolas urbanas da rede municipal participantes.',
        'path': str(csv_path.relative_to(ROOT)), 'sha256': hashlib.sha256(csv_path.read_bytes()).hexdigest()},
    'food': {'period': '2024', 'unit': '% de domicílios', 'source': 'IBGE · PNAD Contínua',
        'universe': 'Domicílios particulares permanentes em situação de segurança alimentar.',
        'path': str(food_path.relative_to(ROOT)), 'sha256': hashlib.sha256(food_path.read_bytes()).hexdigest(),
        'original': next(s['url'] for s in food['manifest']['sources'] if s['file'].endswith('.pdf'))}}
target = ROOT / 'src/lib/eficiencia/atlas-resumo.json'
target.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
print(f'{len(cities)} capitais; {len(regions)} recortes alimentares; nenhum escore derivado.')
