"""Auditoria SIDRA 9936: acesso domiciliar, sem promoção ao escore."""
import hashlib
import json
import math
from .habitacao import ROOT, pearson, build as housing_audit
from .habitacao_cenarios import percentiles_lower

SEED = ROOT / 'pipeline/eficiencia_resultados/seed/conectividade'
CATEGORIES = ('77584', '77585', '77586')


def audit(metadata, data, cohort):
    if metadata['id'] != 9936 or metadata['periodicidade']['inicio'] != 2022 or metadata['periodicidade']['fim'] != 2022:
        raise ValueError('Tabela/período incompatível')
    if 'N6' not in metadata['nivelTerritorial']['Administrativo']:
        raise ValueError('Sem recorte municipal')
    if {str(v['id']): v['unidade'] for v in metadata['variaveis']} != {'381': 'Unidades', '1000381': '%'}:
        raise ValueError('Variáveis incompatíveis')
    if [c['id'] for c in metadata['classificacoes']] != [2072, 63, 125]:
        raise ValueError('Classificações incompatíveis')
    cats = metadata['classificacoes'][0]['categorias']
    if [(str(c['id']), c['nome'], c['nivel']) for c in cats] != [('77584', 'Total', 0), ('77585', 'Sim', 1), ('77586', 'Não', 1)]:
        raise ValueError('Categorias incompatíveis')
    expected = {r['id']: r['name'] for r in cohort}
    if len(expected) != 26 or '5300108' in expected or len(data) != 157 or data[0].get('D1C') != 'Município (Código)':
        raise ValueError('Coorte/cabeçalho/quantidade incompatível')
    cells = {}
    for r in data[1:]:
        ident, variable, category = r['D1C'], r['D2C'], r['D4C']
        if ident not in expected or r['D1N'].split(' (')[0] != expected[ident]:
            raise ValueError('Município divergente')
        if (r['NC'], r['D3C'], r['D5C'], r['D6C']) != ('6', '2022', '95826', '2932'):
            raise ValueError('Recorte divergente')
        if variable not in ('381', '1000381') or category not in CATEGORIES:
            raise ValueError('Medida divergente')
        if (r['MN'], r['MC']) != (('Unidades', '1020') if variable == '381' else ('Percentual', '2')):
            raise ValueError('Unidade divergente')
        key = (ident, variable, category)
        if key in cells or not isinstance(r['V'], str):
            raise ValueError('Duplicata/formato inválido')
        try:
            value = float(r['V'])
        except (ValueError, TypeError):
            raise ValueError('Ausência/marcador não imputado') from None
        if not math.isfinite(value) or value < 0 or (variable == '1000381' and value > 100) or (variable == '381' and not value.is_integer()):
            raise ValueError('Valor inválido')
        cells[key] = value
    rows = []
    for ident, name in expected.items():
        total, yes, no = [cells[(ident, '381', c)] for c in CATEGORIES]
        if total <= 0 or max(yes, no) > total or abs(yes + no - total) > 1.5:
            raise ValueError('Total/partição inválido')
        for c, count in zip(CATEGORIES, (total, yes, no)):
            if abs(100 * count / total - cells[(ident, '1000381', c)]) > .005 + 100 / total:
                raise ValueError('Percentual divergente')
        rows.append({'id': ident, 'name': name, 'total': total, 'connected': yes, 'not_connected': no,
                     'connected_pct': 100 * yes / total, 'partition_residual': yes + no - total})
    return rows


def build():
    manifest = json.loads((SEED / 'manifest.json').read_text())
    for source in manifest['sources']:
        if hashlib.sha256((SEED / source['path']).read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Hash divergente')
    pilot = json.loads((ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_text())
    rows = audit(json.loads((SEED / 'metadata.json').read_text()), json.loads((SEED / 'data.json').read_text()), pilot['rows'])
    ranks = percentiles_lower([-r['connected_pct'] for r in rows])
    housing = housing_audit()['households']
    if [r['id'] for r in rows] != [r['id'] for r in housing]:
        raise ValueError('Coortes divergentes')
    correlations = {d: pearson(ranks, [r['indicator_scores'][d] for r in pilot['rows']]) for d in ('trabalho', 'saneamento')}
    correlations['habitacao_gt2'] = pearson(ranks, percentiles_lower([r['above_two_pct'] for r in housing]))
    return {'version': 'conectividade-auditoria-v1', 'reference_year': 2022,
            'source_status': 'resultados_preliminares_da_amostra', 'publication_ready': False, 'score_eligible': False,
            'decision': 'candidato_adquirido_para_revisao', 'observations_checked': 156,
            'rank_correlations_oriented': correlations, 'rows': rows,
            'pending': ['precisao_municipal', 'validade_de_conteudo', 'ponderacao_conjunta'],
            'limits': ['Não mede velocidade, preço, continuidade ou uso de serviços públicos digitais.',
                       'Não representa todo o capítulo Energia e conectividade.']}


if __name__ == '__main__':
    path = ROOT / 'docs/obee/resultados/conectividade-auditoria.json'
    path.write_text(json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(path)
