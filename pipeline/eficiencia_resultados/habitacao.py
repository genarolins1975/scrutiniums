"""Auditoria descritiva do adensamento; não promove indicador ao escore."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/eficiencia_resultados/seed/habitacao'
CATEGORIES = ('73086', '73087', '73088', '73089', '73090')
CONTRACTS = {9934: ('381', '1000381', 'Unidades', '73103', '73108'),
             9940: ('382', '1000382', 'Pessoas', '95251', '95253')}


def audit_table(metadata, data, cohort, table):
    variable, percentage, unit, total5, total6 = CONTRACTS[table]
    if metadata['id'] != table or metadata['periodicidade']['inicio'] != 2022 or metadata['periodicidade']['fim'] != 2022:
        raise ValueError('Tabela/período incompatível')
    if 'N6' not in metadata['nivelTerritorial']['Administrativo']:
        raise ValueError('Recorte não municipal')
    variables = {str(v['id']): v['unidade'] for v in metadata['variaveis']}
    if variables != {variable: unit, percentage: '%'}:
        raise ValueError('Variáveis/unidades incompatíveis')
    classes = metadata['classificacoes']
    if [c['id'] for c in classes] != ([1975, 1986, 1988] if table == 9934 else [1975, 86, 58]):
        raise ValueError('Classificações incompatíveis')
    if [(str(c['id']), c['nivel']) for c in classes[0]['categorias']] != [(c, 0 if i == 0 else 1) for i, c in enumerate(CATEGORIES)]:
        raise ValueError('Hierarquia incompatível')
    if len(data) != 261 or data[0].get('D1C') != 'Município (Código)':
        raise ValueError('Quantidade/cabeçalho inválido')
    expected = {r['id']: r['name'] for r in cohort}
    if len(expected) != 26 or '5300108' in expected:
        raise ValueError('Coorte incompatível')
    cells = {}
    for r in data[1:]:
        ident, var, cat = r['D1C'], r['D2C'], r['D4C']
        if ident not in expected or r['D1N'].split(' (')[0] != expected[ident]:
            raise ValueError('Município fora da coorte')
        if (r['NC'], r['D3C'], r['D5C'], r['D6C']) != ('6', '2022', total5, total6):
            raise ValueError('Recorte incompatível')
        if var not in (variable, percentage) or cat not in CATEGORIES or r['MN'] != (unit if var == variable else 'Percentual'):
            raise ValueError('Medida incompatível')
        if r['MC'] != (('1020' if table == 9934 else '45') if var == variable else '2'):
            raise ValueError('Código de unidade incompatível')
        key = (ident, var, cat)
        if key in cells:
            raise ValueError('Célula duplicada')
        # Ausência, sigilo e marcadores não são imputados; esta captura é numérica.
        if not isinstance(r['V'], str):
            raise ValueError('Formato inválido')
        try:
            value = float(r['V'])
        except (ValueError, TypeError):
            raise ValueError('Célula não numérica') from None
        if not math.isfinite(value) or value < 0 or (var == percentage and value > 100):
            raise ValueError('Valor inválido')
        if var == variable and not value.is_integer():
            raise ValueError('Estimativa publicada não inteira')
        cells[key] = value
    out = []
    for ident, name in expected.items():
        counts = {c: cells[(ident, variable, c)] for c in CATEGORIES}
        total = counts['73086']
        if total <= 0 or any(v > total for v in counts.values()):
            raise ValueError('Denominador/componente inválido')
        # Quatro parcelas e um total arredondados a unidades: erro máximo 2,5.
        residual = sum(counts[c] for c in CATEGORIES[1:]) - total
        if abs(residual) > 2.5:
            raise ValueError('Partição não reconcilia')
        for c in CATEGORIES:
            # Percentual a 2 casas + arredondamento independente da contagem.
            if abs(100 * counts[c] / total - cells[(ident, percentage, c)]) > 0.005 + 100 / total:
                raise ValueError('Percentual não reconcilia')
        numerator = counts['73089'] + counts['73090']
        if numerator > total:
            raise ValueError('Numerador excede total')
        out.append({'id': ident, 'name': name, 'total': total,
                    'above_two': numerator, 'above_two_pct': 100 * numerator / total,
                    'above_three_pct': 100 * counts['73090'] / total,
                    'partition_residual': residual})
    return out


def pearson(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    a, b = [v - mx for v in x], [v - my for v in y]
    return sum(u * v for u, v in zip(a, b)) / math.sqrt(sum(u*u for u in a) * sum(v*v for v in b))


def build():
    manifest = json.loads((SEED / 'manifest.json').read_text())
    for s in manifest['sources']:
        if hashlib.sha256((SEED / s['path']).read_bytes()).hexdigest() != s['sha256']:
            raise ValueError('Hash da fonte divergente')
    pilot = json.loads((ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_text())
    cohort = manifest['cohort']
    if cohort != [{'id': r['id'], 'name': r['name']} for r in pilot['rows']]:
        raise ValueError('Coorte divergente do piloto')
    rows = {t: audit_table(json.loads((SEED / f'{t}-metadata.json').read_text()),
                          json.loads((SEED / f'{t}-data.json').read_text()), cohort, t)
            for t in CONTRACTS}
    lower_better = [-r['above_two_pct'] for r in rows[9934]]
    ranks = [100 * (sum(v < x for v in lower_better) + sum(v == x for v in lower_better) / 2) / 26 for x in lower_better]
    correlations = {d: pearson(ranks, [r['indicator_scores'][d] for r in pilot['rows']]) for d in ('trabalho', 'saneamento')}
    return {'version': 'habitacao-auditoria-v1', 'reference_year': 2022,
            'source_status': 'resultados_preliminares_da_amostra',
            'publication_ready': False, 'score_eligible': False,
            'decision': 'candidato_adquirido_para_revisao',
            'pending': ['precisao_amostral_municipal', 'validade_de_conteudo_e_pesos', 'revisao_de_redundancia'],
            'observations_checked': 520, 'households': rows[9934], 'residents': rows[9940],
            'rank_correlations_oriented': correlations,
            'note': 'Percentis usados somente para diagnóstico de redundância; nenhum novo escore agregado.'}


if __name__ == '__main__':
    path = ROOT / 'docs/obee/resultados/habitacao-adensamento-auditoria.json'
    path.write_text(json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(path)
