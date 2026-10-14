"""Índice de resultados na vida dos moradores, edição experimental v4 (referência 2022).

Decisões editoriais de 14/10/2026 (docs/obee/resultados/v4/DECISAO_EDICAO_V4.md):
sete indicadores com pesos iguais, habitação por moradores em domicílios com mais de
três moradores por dormitório, natureza de resultados sem atribuição causal.

Aritmética racional exata em percentis, notas, contribuições e testes de sensibilidade.
Lê as fontes congeladas da v2 e da candidata v3 sem alterá-las. Execute como módulo:

    python3 -m pipeline.eficiencia_resultados.indice_v4            # gera as saídas
    python3 -m pipeline.eficiencia_resultados.indice_v4 --check    # confere sem escrever
    python3 -m pipeline.eficiencia_resultados.indice_v4 --congelar # cria o pacote v4, uma única vez
"""
import argparse
import csv
import hashlib
import io
import json
import math
from fractions import Fraction as F
from itertools import combinations
from pathlib import Path

from .cesta_conjunta import validate_baseline
from .conectividade import build as audit_connectivity
from .habitacao import ROOT, build as audit_housing

EDITION = 'indice-resultados-2022-v4'
OUT = ROOT / 'docs/obee/resultados/v4'
PILOT = ROOT / 'docs/obee/resultados/piloto-2022-v2.json'
V3 = ROOT / 'docs/obee/resultados/cesta-conjunta.json'
EXPANSION = ROOT / 'pipeline/eficiencia_resultados/seed/expansao-2022.json'
INCOME = ROOT / 'public/eficiencia/trabalho-renda/brutos/censo-renda.json'
INCOME_SHA256 = 'f3a411db4391e3603e391837688935e2c5749244fbd80bec757f4592859af83a'
V3_SCENARIO = 'conjunta__domicilios_gt2__materiais_40pct'
PACKET = OUT / 'pacote-v4.json'

DIMS = ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca', 'habitacao', 'conectividade')
WEIGHTS = {d: F(1, 7) for d in DIMS}
HOUSING = ('residents', 'above_three_pct')
HOUSING_ALTERNATIVES = {'domicilios_gt2': ('households', 'above_two_pct'),
                        'domicilios_gt3': ('households', 'above_three_pct'),
                        'moradores_gt2': ('residents', 'above_two_pct')}
# Família de pesos declarada antes do cálculo: cada peso entre 75% e 125% de 1/7.
WEIGHT_BOX = (F(3, 4), F(5, 4))
WEIGHT_BOX_WIDE = (F(1, 2), F(3, 2))

INDICATORS = [
    {'id': 'educacao', 'label': 'Frequência escolar de 4 e 5 anos', 'unit': '%', 'direction': 'higher',
     'period': '2022', 'source': 'IBGE, Censo 2022, SIDRA 10056', 'source_url': 'https://sidra.ibge.gov.br/tabela/10056',
     'note': 'Crianças de 4 e 5 anos que frequentam escola ou creche, redes pública e privada.',
     'precision': 'Amostra do Censo; erro municipal não quantificado.'},
    {'id': 'trabalho', 'label': 'Renda domiciliar por pessoa, mediana', 'unit': 'R$', 'direction': 'higher',
     'period': 'Julho de 2022', 'source': 'IBGE, Censo 2022, SIDRA 10295', 'source_url': 'https://sidra.ibge.gov.br/tabela/10295',
     'note': 'Reais nominais de julho de 2022, sem ajuste de preços entre cidades.',
     'precision': 'Amostra do Censo; erro municipal não quantificado; valores redondos aparecem repetidos.'},
    {'id': 'mobilidade', 'label': 'Mais de uma hora até o trabalho', 'unit': '%', 'direction': 'lower',
     'period': '2022', 'source': 'IBGE, Censo 2022, SIDRA 10330', 'source_url': 'https://sidra.ibge.gov.br/tabela/10330',
     'note': 'Pessoas ocupadas que levam mais de uma hora no deslocamento habitual ao trabalho.',
     'precision': 'Amostra do Censo; erro municipal não quantificado.'},
    {'id': 'saneamento', 'label': 'Esgotamento por rede ou fossa séptica', 'unit': '%', 'direction': 'higher',
     'period': '2022', 'source': 'IBGE, Censo 2022, SIDRA 6805', 'source_url': 'https://sidra.ibge.gov.br/tabela/6805',
     'note': 'Domicílios com rede geral ou pluvial, ou fossa séptica ou filtro. Não mede tratamento.',
     'precision': 'Dado do universo do Censo; sem erro amostral, com erros não amostrais possíveis.'},
    {'id': 'seguranca', 'label': 'Homicídios estimados por 100 mil habitantes', 'unit': 'por 100 mil', 'direction': 'lower',
     'period': '2022', 'source': 'Ipea e FBSP, Atlas da Violência 2024, tabela 3',
     'source_url': 'https://repositorio.ipea.gov.br/bitstream/11058/14031/5/AtlasViolencia2024_Retrato_dos_municipios_brasileros.pdf',
     'note': 'Homicídios registrados mais homicídios ocultos estimados pelo modelo da fonte.',
     'precision': 'Registros mais modelo; incerteza municipal do modelo não quantificada.'},
    {'id': 'habitacao', 'label': 'Moradores em domicílios com mais de 3 por dormitório', 'unit': '%', 'direction': 'lower',
     'period': '2022', 'source': 'IBGE, Censo 2022, SIDRA 9940', 'source_url': 'https://sidra.ibge.gov.br/tabela/9940',
     'note': 'Adensamento excessivo no conceito do IBGE (SIS 2018, p. 63 do PDF), contado em pessoas.',
     'precision': 'Amostra do Censo; erro municipal não quantificado.'},
    {'id': 'conectividade', 'label': 'Domicílios com acesso à internet', 'unit': '%', 'direction': 'higher',
     'period': '2022', 'source': 'IBGE, Censo 2022, SIDRA 9936', 'source_url': 'https://sidra.ibge.gov.br/tabela/9936',
     'note': 'Domicílios particulares permanentes ocupados com acesso. Não mede velocidade nem preço.',
     'precision': 'Amostra do Censo; erro municipal não quantificado.'},
]


LABELS = {
    'saneamento_apenas_rede': 'Saneamento: apenas rede geral ou pluvial',
    'homicidios_apenas_registrados': 'Violência letal: apenas homicídios registrados',
    'renda_media': 'Renda: média em vez da mediana',
    'habitacao_domicilios_gt2': 'Habitação: domicílios com mais de 2 por dormitório',
    'habitacao_domicilios_gt3': 'Habitação: domicílios com mais de 3 por dormitório',
    'habitacao_moradores_gt2': 'Habitação: moradores em domicílios com mais de 2 por dormitório',
    **{'sem_' + i['id']: 'Sem ' + i['label'][0].lower() + i['label'][1:] for i in INDICATORS},
}


# ------------------------------------------------------------------ contratos


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def percentiles(values, direction):
    """Percentil orientado exato: 100 × (menos favoráveis + metade dos iguais) ÷ n."""
    if direction not in ('higher', 'lower'):
        raise ValueError('Direção desconhecida')
    if not isinstance(values, (list, tuple)) or not values:
        raise ValueError('Lista de valores vazia')
    if any(not finite_number(v) for v in values):
        raise ValueError('Valor ausente, não numérico ou não finito')
    n = len(values)
    worse = (lambda x, v: x < v) if direction == 'higher' else (lambda x, v: x > v)
    return [F(100 * (2 * sum(worse(x, v) for x in values) + values.count(v)), 2 * n) for v in values]


def validate_weights(weights):
    if not weights or any(not isinstance(w, F) or w <= 0 for w in weights.values()):
        raise ValueError('Pesos devem ser frações estritamente positivas')
    if sum(weights.values()) != 1:
        raise ValueError('Pesos devem somar exatamente 1')
    return weights


def aggregate(components, weights):
    validate_weights(weights)
    if set(components) != set(weights):
        raise ValueError('Cesta incompleta ou com componente extra')
    if any(not isinstance(v, F) or not 0 <= v <= 100 for v in components.values()):
        raise ValueError('Componente ausente ou fora de 0 a 100')
    return sum(components[k] * weights[k] for k in weights)


def box_extremes(values, base, box):
    """Mínimo e máximo exatos de Σ w·x com w_i em [lo·base_i, hi·base_i] e Σ w = 1.

    Problema linear com restrição de soma: preenche-se o orçamento restante, a partir
    dos limites inferiores, pelos maiores (máximo) ou menores (mínimo) coeficientes.
    """
    lo, hi = box
    keys = list(base)
    if set(values) != set(keys) or not 0 < lo <= 1 <= hi:
        raise ValueError('Família de pesos inválida')
    lower = {k: base[k] * lo for k in keys}
    upper = {k: base[k] * hi for k in keys}
    if sum(lower.values()) > 1 or sum(upper.values()) < 1:
        raise ValueError('Família de pesos vazia')

    def solve(order):
        w, budget = dict(lower), 1 - sum(lower.values())
        for k in order:
            step = min(budget, upper[k] - lower[k])
            w[k] += step
            budget -= step
        return sum(w[k] * values[k] for k in keys), w

    ranked = sorted(keys, key=lambda k: values[k])
    (minimum, w_min), (maximum, w_max) = solve(ranked), solve(ranked[::-1])
    return minimum, maximum, w_min, w_max


def sign(x):
    return (x > 0) - (x < 0)


def fraction_text(x):
    return f'{x.numerator}/{x.denominator}'


# ------------------------------------------------------------------ insumos


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def align(rows, ids, field):
    by_id = {r['id']: r for r in rows}
    if len(by_id) != len(rows) or set(by_id) != set(ids):
        raise ValueError('Coorte ausente, adicional ou duplicada')
    return [by_id[i][field] for i in ids]


def income_means(ids, medians):
    if sha(INCOME) != INCOME_SHA256:
        raise ValueError('Aquisição de renda divergente do hash registrado')
    found = {}
    for r in json.loads(INCOME.read_text())[1:]:
        if r['NC'] != '6' or r['D1C'] not in ids:
            continue
        if (r['D2C'] not in {'13431', '13534'} or r['D3C'] != '2022' or r['MC'] != '38'
                or r['D4C'] != '6794' or r['D5C'] != '95251' or r['D6C'] != '95253'):
            raise ValueError('Universo, variável, ano ou unidade de renda divergente')
        key = (r['D1C'], r['D2C'])
        if key in found:
            raise ValueError('Renda duplicada')
        found[key] = float(r['V'])
    for i, median in zip(ids, medians):
        if found.get((i, '13534')) != median:
            raise ValueError('Mediana de renda não reconcilia com a v2')
    return [found[(i, '13431')] for i in ids]


def load_inputs():
    pilot = json.loads(PILOT.read_text())
    ids = validate_baseline(pilot)
    names = [r['name'] for r in pilot['rows']]
    raw = {d: [r['raw_values'][d] for r in pilot['rows']] for d in DIMS[:5]}
    housing, connectivity = audit_housing(), audit_connectivity()
    if housing['reference_year'] != 2022 or connectivity['reference_year'] != 2022:
        raise ValueError('Ano de referência divergente')
    raw['habitacao'] = align(housing[HOUSING[0]], ids, HOUSING[1])
    raw['conectividade'] = align(connectivity['rows'], ids, 'connected_pct')
    expansion = json.loads(EXPANSION.read_text())
    sanitation = {r['id']: r for r in expansion['sanitation']}
    violence = {r['id']: r for r in expansion['violence']}
    if [sanitation[i]['value'] for i in ids] != raw['saneamento'] or [violence[i]['value'] for i in ids] != raw['seguranca']:
        raise ValueError('Fonte das definições alternativas não reconcilia com a v2')
    alternatives = {
        'saneamento_apenas_rede': ('saneamento', [sanitation[i]['network_only_value'] for i in ids]),
        'homicidios_apenas_registrados': ('seguranca', [violence[i]['registered_rate'] for i in ids]),
        'renda_media': ('trabalho', income_means(ids, raw['trabalho'])),
    }
    for key, (unit, field) in HOUSING_ALTERNATIVES.items():
        alternatives['habitacao_' + key] = ('habitacao', align(housing[unit], ids, field))
    return pilot, ids, names, raw, alternatives


# ------------------------------------------------------------------ cálculo


def build():
    pilot, ids, names, raw, alternatives = load_inputs()
    direction = {i['id']: i['direction'] for i in INDICATORS}
    pct = {d: percentiles(raw[d], direction[d]) for d in DIMS}
    for d in DIMS[:5]:
        for row, p in zip(pilot['rows'], pct[d]):
            if not math.isclose(float(p), row['indicator_scores'][d], abs_tol=1e-9):
                raise ValueError('Percentil não reconcilia com a v2: ' + d)
    n = len(ids)
    components = [{d: pct[d][i] for d in DIMS} for i in range(n)]
    scores = [aggregate(c, WEIGHTS) for c in components]

    # Cenários discretos: cada um muda uma única hipótese e mantém as demais.
    scenarios = {}
    for key, (dim, values) in alternatives.items():
        alt = percentiles(values, direction[dim])
        scenarios[key] = {'family': 'habitacao' if dim == 'habitacao' else 'definicoes', 'changes': dim,
                          'scores': [aggregate({**c, dim: alt[i]}, WEIGHTS) for i, c in enumerate(components)]}
    for dropped in DIMS:
        kept = {d: F(1, 6) for d in DIMS if d != dropped}
        scenarios['sem_' + dropped] = {'family': 'retirada', 'changes': dropped,
                                       'scores': [aggregate({d: c[d] for d in kept}, kept) for c in components]}

    families = {
        'pesos': 'Cada peso entre 75% e 125% de 1/7, com soma 1 (família contínua)',
        'habitacao': 'Três definições alternativas de habitação, uma por vez',
        'definicoes': 'Saneamento apenas rede; homicídios apenas registrados; renda média em vez da mediana',
        'retirada': 'Retirar um indicador por vez; os seis restantes com pesos iguais',
    }

    rows = []
    for i in range(n):
        c = components[i]
        w_lo, w_hi, _, _ = box_extremes(c, WEIGHTS, WEIGHT_BOX)
        by_family = {'pesos': [w_lo, w_hi]}
        for family in ('habitacao', 'definicoes', 'retirada'):
            values = [scores[i]] + [s['scores'][i] for s in scenarios.values() if s['family'] == family]
            by_family[family] = [min(values), max(values)]
        band = [min(v[0] for v in by_family.values()), max(v[1] for v in by_family.values())]
        rows.append({
            'id': ids[i], 'name': names[i],
            'score': float(scores[i]), 'score_fraction': fraction_text(scores[i]),
            'raw_values': {d: raw[d][i] for d in DIMS},
            'percentiles': {d: float(c[d]) for d in DIMS},
            'contributions': {d: float(c[d] * WEIGHTS[d]) for d in DIMS},
            'centered_contributions': {d: float((c[d] - 50) * WEIGHTS[d]) for d in DIMS},
            'sensitivity': {k: [float(a), float(b)] for k, (a, b) in by_family.items()},
            'band': [float(band[0]), float(band[1])],
            'scenario_scores': {k: float(s['scores'][i]) for k, s in scenarios.items()},
        })

    # Pares: limites calculados sempre com A e B sob a mesma hipótese.
    pairs, counts = [], {'mantida': 0, 'pode_empatar': 0, 'pode_inverter': 0, 'empate': 0}
    dominance = 0
    wide_reversals = 0
    for i, j in combinations(range(n), 2):
        diff = {d: components[i][d] - components[j][d] for d in DIMS}
        base = scores[i] - scores[j]
        lo, hi, _, _ = box_extremes(diff, WEIGHTS, WEIGHT_BOX)
        ranges = {'pesos': (lo, hi)}
        for family in ('habitacao', 'definicoes', 'retirada'):
            values = [base] + [s['scores'][i] - s['scores'][j] for s in scenarios.values() if s['family'] == family]
            ranges[family] = (min(values), max(values))
        wlo, whi, _, _ = box_extremes(diff, WEIGHTS, WEIGHT_BOX_WIDE)
        wide_reversals += int(base != 0 and (wlo * base < 0 or whi * base < 0))
        s = sign(base)
        reversing = [k for k, (a, b) in ranges.items() if s and (a * s < 0 or b * s < 0)]
        touching = [k for k, (a, b) in ranges.items() if s and k not in reversing and (a == 0 or b == 0)]
        status = 'empate' if s == 0 else 'pode_inverter' if reversing else 'pode_empatar' if touching else 'mantida'
        counts[status] += 1
        dominant = (all(v >= 0 for v in diff.values()) and any(v > 0 for v in diff.values())) or \
                   (all(v <= 0 for v in diff.values()) and any(v < 0 for v in diff.values()))
        dominance += int(dominant)
        pairs.append({'a': ids[i], 'b': ids[j], 'difference': float(base), 'status': status,
                      'families_reversing': reversing, 'families_tying': touching, 'dominance': dominant,
                      'ranges': {k: [float(a), float(b)] for k, (a, b) in ranges.items()}})

    comparison = compare_v3(ids, raw, components, scores, direction)
    inputs = [PILOT, EXPANSION, INCOME, V3,
              ROOT / 'pipeline/eficiencia_resultados/seed/habitacao/9940-data.json',
              ROOT / 'pipeline/eficiencia_resultados/seed/habitacao/9934-data.json',
              ROOT / 'pipeline/eficiencia_resultados/seed/conectividade/data.json']
    return {
        'edition': EDITION, 'reference_year': 2022, 'cohort': ids,
        'nature': 'indice_experimental_de_resultados_sem_atribuicao_causal',
        'title': 'Índice de resultados na vida dos moradores',
        'official_index': False,
        'publication_status': 'experimental_area_logada',
        'editorial_decisions': {
            'date': '2026-10-14', 'responsible': 'genarolins1975, titular do repositório',
            'record': 'docs/obee/resultados/v4/DECISAO_EDICAO_V4.md',
            'weights': 'iguais, 1/7 por indicador', 'housing': 'moradores_gt3',
            'promise': 'resultados na vida, sem atribuição de causa ou responsabilidade a um governo',
            'placement': 'página principal do OBEE, área logada'},
        'independent_review': 'pendente',
        'municipal_precision': 'nao_quantificada',
        'normalization': '100 × (capitais menos favoráveis + metade das iguais) ÷ 26; coorte fixa de 2022',
        'weights': {d: fraction_text(w) for d, w in WEIGHTS.items()},
        'indicators': INDICATORS,
        'families': families,
        'scenarios': {k: {'family': v['family'], 'changes': v['changes'], 'label': LABELS[k]} for k, v in scenarios.items()},
        'rows': rows,
        'pairs': pairs,
        'summary': {
            'cities': n, 'pairs': len(pairs), 'pair_status': counts, 'pairs_with_dominance': dominance,
            'pairs_reversing_with_weights_50pct': wide_reversals,
            'mean_score': float(sum(scores) / n),
            'score_min': float(min(scores)), 'score_max': float(max(scores)),
        },
        'comparison_v3': comparison,
        'input_evidence': [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p)} for p in inputs],
    }


def compare_v3(ids, raw, components, scores, direction):
    """Decompõe a mudança v3 → v4 em definição de habitação e pesos, sem arredondamento."""
    v3 = json.loads(V3.read_text())
    scenario = next(s for s in v3['scenarios'] if s['id'] == V3_SCENARIO)
    if [r['id'] for r in scenario['rows']] != ids:
        raise ValueError('Coorte da v3 divergente')
    v3_weights = {d: F(1, 5) if d in ('educacao', 'mobilidade', 'seguranca') else F(1, 10) for d in DIMS}
    v3_housing = percentiles(align(audit_housing()['households'], ids, 'above_two_pct'), 'lower')
    rows, before, after = [], [], []
    for i, ident in enumerate(ids):
        old = {**components[i], 'habitacao': v3_housing[i]}
        s3 = aggregate(old, v3_weights)
        if not math.isclose(float(s3), scenario['rows'][i]['scenario_score'], abs_tol=1e-9):
            raise ValueError('Nota da v3 não reconcilia')
        middle = aggregate(components[i], v3_weights)
        before.append(s3)
        after.append(scores[i])
        rows.append({'id': ident, 'v3_score': float(s3), 'v4_score': float(scores[i]),
                     'change': float(scores[i] - s3), 'housing_definition_effect': float(middle - s3),
                     'weights_effect': float(scores[i] - middle)})
    reversals = sum(sign(before[i] - before[j]) * sign(after[i] - after[j]) == -1
                    for i, j in combinations(range(len(ids)), 2))
    return {'v3_scenario': V3_SCENARIO, 'pairs_reversed': reversals,
            'max_absolute_change': max(abs(r['change']) for r in rows),
            'mean_absolute_change': sum(abs(r['change']) for r in rows) / len(rows), 'rows': rows}


# ------------------------------------------------------------------ saídas


def render(result):
    payload = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    stream = io.StringIO()
    writer = csv.writer(stream, lineterminator='\n')
    header = ['edition', 'reference_year', 'id', 'name', 'score', 'score_fraction', 'band_min', 'band_max']
    for d in DIMS:
        header += [f'{d}_raw', f'{d}_unit', f'{d}_percentile', f'{d}_weight', f'{d}_contribution']
    writer.writerow(header)
    units = {i['id']: i['unit'] for i in result['indicators']}
    for r in result['rows']:
        line = [EDITION, 2022, r['id'], r['name'], repr(r['score']), r['score_fraction'], repr(r['band'][0]), repr(r['band'][1])]
        for d in DIMS:
            line += [repr(r['raw_values'][d]), units[d], repr(r['percentiles'][d]), '1/7', repr(r['contributions'][d])]
        writer.writerow(line)
    return {'indice-resultados-v4.json': payload, 'indice-resultados-v4.csv': stream.getvalue()}


def write(result, check=False):
    files = render(result)
    changed = [name for name, text in files.items()
               if not (OUT / name).exists() or (OUT / name).read_text() != text]
    if check:
        if changed:
            raise SystemExit('Saídas divergentes: ' + ', '.join(changed))
        return files
    OUT.mkdir(parents=True, exist_ok=True)
    for name in changed:
        (OUT / name).write_text(files[name])
    return files


# ------------------------------------------------------------------ congelamento

FROZEN = [
    'docs/obee/resultados/v4/indice-resultados-v4.json',
    'docs/obee/resultados/v4/indice-resultados-v4.csv',
    'docs/obee/resultados/v4/DECISAO_EDICAO_V4.md',
    'docs/obee/resultados/v4/METODOLOGIA_V4.md',
    'pipeline/eficiencia_resultados/indice_v4.py',
    'pipeline/eficiencia_resultados/test_indice_v4.py',
    'pipeline/eficiencia_resultados/habitacao.py',
    'pipeline/eficiencia_resultados/conectividade.py',
    'pipeline/eficiencia_resultados/cesta_conjunta.py',
    'pipeline/eficiencia_resultados/habitacao_cenarios.py',
]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def packet(root=ROOT, result=None):
    result = result or json.loads((root / FROZEN[0]).read_text())
    files = sorted(set(FROZEN) | {e['path'] for e in result['input_evidence']})
    payload = {'version': 'pacote-v4-v1', 'edition': EDITION,
               'files': [{'path': p, 'sha256': hashlib.sha256((root / p).read_bytes()).hexdigest()} for p in files]}
    return {**payload, 'packet_sha256': digest(payload)}


def freeze(root=ROOT, target=None):
    """Cria o pacote da edição uma única vez; nunca sobrescreve um pacote diferente."""
    target = target or root / PACKET.relative_to(ROOT)
    new = packet(root)
    text = json.dumps(new, ensure_ascii=False, indent=2) + '\n'
    if target.exists():
        if target.read_text() != text:
            raise ValueError('Pacote v4 já congelado com conteúdo diferente; crie uma nova edição')
        return new
    target.write_text(text)
    return new


def verify(root=ROOT, target=None):
    target = target or root / PACKET.relative_to(ROOT)
    frozen = json.loads(target.read_text())
    if digest({k: v for k, v in frozen.items() if k != 'packet_sha256'}) != frozen['packet_sha256']:
        raise ValueError('Identidade do pacote v4 divergente')
    for item in frozen['files']:
        if hashlib.sha256((root / item['path']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Arquivo congelado alterado: ' + item['path'])
    return frozen


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='confere as saídas sem escrever')
    parser.add_argument('--congelar', action='store_true', help='cria o pacote v4 (uma única vez)')
    parser.add_argument('--verificar', action='store_true', help='confere os hashes do pacote v4')
    args = parser.parse_args()
    if args.verificar:
        print(json.dumps({'packet_sha256': verify()['packet_sha256'], 'ok': True}))
    else:
        result = build()
        write(result, check=args.check)
        if args.congelar:
            print(json.dumps({'packet_sha256': freeze()['packet_sha256']}))
        print(json.dumps(result['summary'], ensure_ascii=False))
