"""Complemento de precisão da cesta v3; não altera nem recongela o pacote.

python3 scripts/obee_precisao_cesta.py [--check]
"""
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.eficiencia_resultados.cesta_conjunta import validate_baseline
from pipeline.eficiencia_resultados.habitacao import build as housing
from pipeline.eficiencia_resultados.conectividade import build as connectivity
from pipeline.eficiencia_resultados.coletar_expansao import violence

DOCS = ROOT / 'docs/obee/resultados'
EVIDENCE = DOCS / 'precisao-cesta-evidencias.json'
OUTPUT = DOCS / 'precisao-cesta-completa.json'
MEASURES = {
    'educacao': ('%', 'Crianças de 4 a 5 anos; frequência escolar nas redes pública e privada', ['10056'],
                 'Frequência não mede aprendizagem nem atribui resultado à rede municipal.'),
    'trabalho': ('R$', 'Moradores elegíveis da tabela 10295, excluídos pensionistas, empregados domésticos e seus parentes', ['10295'],
                 'Mediana nominal de julho de 2022, sem ajuste espacial de preços. Valores redondos e empates não demonstram equivalência de poder de compra.'),
    'mobilidade': ('%', 'Pessoas ocupadas que se deslocavam para trabalhar no universo da tabela 10330', ['10330'],
                   'Mais de uma hora até o trabalho; exclui trabalho em mais de um município ou país. Não mede toda a mobilidade urbana.'),
    'saneamento': ('%', 'Domicílios particulares permanentes ocupados', ['6805'],
                   'Rede geral/pluvial ou fossa ligada à rede, mais fossa séptica/filtro não ligada. Universo censitário não significa ausência de erros de cobertura e declaração; não mede tratamento.'),
    'seguranca': ('por 100 mil habitantes', 'População residente; município de residência dos óbitos', ['atlas2024'],
                  'Soma registros e homicídios ocultos estimados por modelo; parcela oculta não é erro-padrão nem intervalo de confiança. Incerteza municipal do modelo não obtida.'),
    'habitacao': ('%', 'Domicílios particulares permanentes ocupados com mais de dois moradores por dormitório', ['9934', '9940'],
                  'Definição principal preservada apenas para descrever a cesta congelada; 9940 sustenta a alternativa em moradores. Não mede déficit habitacional completo; unidade e limiar aguardam decisão.'),
    'conectividade': ('%', 'Domicílios particulares permanentes ocupados', ['9936'],
                      'Presença de Internet não informa velocidade, preço, continuidade ou capacidade digital.'),
}


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(payload):
    """Falha fechada: coorte completa, evidência da natureza e nenhuma precisão fictícia."""
    expected = set(validate_baseline(read(DOCS / 'piloto-2022-v2.json')))
    rows, evidence = payload['records'], payload['evidencias']
    if Counter(r['medida'] for r in rows) != Counter({k: 26 for k in MEASURES}):
        raise ValueError('Exigidos sete indicadores com 26 registros cada')
    for key in MEASURES:
        selected = [r for r in rows if r['medida'] == key]
        if {r['codigo_ibge'] for r in selected} != expected:
            raise ValueError('Capital ausente, adicional ou duplicada')
    for row in rows:
        if row['standard_error'] is not None or row['confidence_interval'] is not None:
            raise ValueError('Erros e intervalos não obtidos devem ser null, nunca zero')
        if row['precisao_municipal'] != 'nao_quantificada' or row['reference_year'] != 2022:
            raise ValueError('Precisão/referência incompatível')
        if not row['ressalva'] or not math.isfinite(row['valor_original']):
            raise ValueError('Valor ou ressalva ausente')
        nature = row['natureza']
        if nature not in {'amostra_censo', 'universo_censo', 'registro_mais_modelo', 'nao_verificada'}:
            raise ValueError('Natureza desconhecida')
        refs = row['evidencia_ids']
        if refs != MEASURES[row['medida']][2]:
            raise ValueError('Evidência não corresponde às fontes da medida')
        for ref in refs:
            e = evidence[ref]
            date.fromisoformat(e['data_acesso'])
            if nature != 'nao_verificada' and (e['natureza'] != nature or not e['verificada']
                    or not e['url'].startswith('https://') or not e['trecho'] or not e['localizador']):
                raise ValueError('Classificação sem evidência oficial registrada')
        if row['medida'] == 'seguranca':
            h = row['homicidios']
            if h['registrados'] + h['ocultos'] != h['total'] or h['total'] <= 0:
                raise ValueError('Homicídios não reconciliam')
            if not math.isclose(h['parcela_ocultos_pct'], 100 * h['ocultos'] / h['total'], abs_tol=1e-12):
                raise ValueError('Parcela de ocultos divergente')
    return payload


def build():
    pilot = read(DOCS / 'piloto-2022-v2.json')
    ids = validate_baseline(pilot)
    evidence = read(EVIDENCE)['evidencias']
    h = {r['id']: r for r in housing()['households']}
    c = {r['id']: r for r in connectivity()['rows']}
    seed = ROOT / 'pipeline/eficiencia_resultados/seed'
    expanded = read(seed / 'expansao-2022.json')
    capitals = [{'id': r['id'], 'name': r['name']} for r in pilot['rows']]
    vrows = violence((seed / 'atlas-tabela3.txt').read_text(), capitals,
                     {r['id']: r['uf'] for r in expanded['sanitation']})
    if vrows != expanded['violence']:
        raise ValueError('Extração da tabela 3 não reconcilia com o seed')
    v = {r['id']: r for r in vrows}
    if any(set(m) != set(ids) for m in (h, c, v)):
        raise ValueError('Fontes com coortes divergentes')
    records = []
    for city in pilot['rows']:
        ident = city['id']
        values = {**city['raw_values'], 'habitacao': h[ident]['above_two_pct'],
                  'conectividade': c[ident]['connected_pct']}
        for key, (unit, universe, refs, caveat) in MEASURES.items():
            nature = evidence[refs[0]]['natureza']
            if any(not evidence[ref]['verificada'] for ref in refs):
                nature = 'nao_verificada'
            row = {'medida': key, 'codigo_ibge': ident, 'capital': city['name'],
                   'reference_year': 2022, 'referencia': 'julho de 2022' if key == 'trabalho' else '2022',
                   'valor_original': values[key], 'unidade': unit, 'universo': universe,
                   'natureza': nature, 'evidencia_ids': refs,
                   'precisao_municipal': 'nao_quantificada', 'standard_error': None,
                   'confidence_interval': None,
                   'ressalva': caveat + ' Precisão municipal não quantificada; diferenças observadas não demonstram significância estatística.'}
            if key == 'seguranca':
                z = v[ident]
                row['homicidios'] = {'registrados': z['registered'], 'ocultos': z['hidden_estimated'],
                                    'total': z['total_estimated'],
                                    'parcela_ocultos_pct': 100 * z['hidden_estimated'] / z['total_estimated'],
                                    'tabela': 3, 'pagina': 18, 'linha': z['source_row'], 'edicao': 2024}
            records.append(row)
    sources = [DOCS / 'piloto-2022-v2.json', EVIDENCE, seed / 'expansao-2022.json', seed / 'atlas-tabela3.txt']
    sources += sorted((seed / 'habitacao').glob('*.json')) + sorted((seed / 'conectividade').glob('*.json'))
    return validate({'version': 'precisao-cesta-completa-v1', 'reference_year': 2022,
                     'scope': 'sete_medidas;26_capitais_estaduais;sem_DF',
                     'publication_ready': False, 'approved_weights': None,
                     'nota': 'Complemento externo ao pacote congelado. Verificar natureza não quantifica erro nem autoriza promoção editorial.',
                     'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in sources],
                     'evidencias': evidence, 'records': records})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    content = json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit('Precisão da cesta desatualizada; execute o gerador')
    else:
        OUTPUT.write_text(content)
    print('182 registros; sete medidas; precisão municipal não quantificada')
