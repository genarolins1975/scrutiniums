"""Contrato descritivo das candidatas; não estima erros nem autoriza produção.

python3.12 -m pipeline.eficiencia_resultados.precisao_candidatas
"""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

from .cesta_conjunta import BASE_PATH, align, validate_baseline
from .habitacao import ROOT, build as audit_housing
from .conectividade import build as audit_connectivity

DOCS = ROOT / 'docs/obee/resultados'
ZIP_SHA = '816400ea98a128b82e71b3f68cf084c3b5d5c895c3e3a070fcf5795e337f0acc'
XLSX_SHA = 'c4e844f8be9ce661b7c8b483da63286c9fbf3cfb643af915fdd8d1a058dd8045'
MEMBER = 'Coeficientes_de_variacao_regressao_amostra_CD2022.xlsx'


def inspect_annex(path):
    """Lê apenas o anexo oficial congelado, sem executar fórmulas ou macros."""
    import io
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != ZIP_SHA:
        raise ValueError('Anexo diferente da edição auditada')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        book = archive.read(MEMBER)
    if hashlib.sha256(book).hexdigest() != XLSX_SHA:
        raise ValueError('Planilha diferente da edição auditada')
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(book)) as archive:
        strings = [''.join(si.itertext()) for si in
                   ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', ns)]
        relationships = {r.attrib['Id']: r.attrib['Target'] for r in
                         ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = []
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', ns):
            rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = relationships[rid]
            xml_path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            cells = {}
            for cell in ET.fromstring(archive.read(xml_path)).findall('.//m:c', ns):
                value = cell.find('m:v', ns)
                if value is not None:
                    cells[cell.attrib['r']] = strings[int(value.text)] if cell.get('t') == 's' else value.text
            sheets.append({'name': sheet.attrib['name'], 'title': cells['A1'],
                           'estimate_types': [cells['A5'], cells['A6']],
                           'coefficients': {kind: {key: float(cells[f'{col}{row}'])
                                                  for key, col in [('A', 'B'), ('B', 'C')]}
                                            for kind, row in [('pessoas', 5), ('domicilios', 6)]}})
    return {'zip_sha256': ZIP_SHA, 'xlsx_sha256': XLSX_SHA, 'member': MEMBER,
            'sheet_count': len(sheets), 'sheets': sheets}


def descriptive_record(indicator, row, numerator_key, expected_ids, year=2022):
    if indicator not in ('habitacao', 'conectividade') or year != 2022 or row['id'] not in expected_ids:
        raise ValueError('Indicador, ano ou município fora do contrato')
    numerator, denominator = row[numerator_key], row['total']
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
           for v in (numerator, denominator)) or not 0 <= numerator <= denominator or denominator <= 0:
        raise ValueError('Estimativa ausente ou inválida')
    return {'indicator': indicator, 'id': row['id'], 'name': row['name'],
            'reference_year': year, 'unit': 'percentual_de_domicilios',
            'numerator_estimate': numerator, 'denominator_estimate': denominator,
            'estimate_pct': 100 * numerator / denominator,
            'precision_status': 'not_quantified_for_municipal_ratio',
            'standard_error_pp': None, 'confidence_interval_pct': None,
            'descriptive_use': 'eligible_with_mandatory_label',
            'statistical_difference_claim_allowed': False,
            'rank_confidence_claim_allowed': False, 'score_eligible': False}


def build():
    pilot = json.loads(BASE_PATH.read_text())
    ids = validate_baseline(pilot)
    housing, connectivity = audit_housing(), audit_connectivity()
    if any(audit['reference_year'] != 2022 for audit in (housing, connectivity)):
        raise ValueError('Referência divergente')
    rows = []
    for indicator, records, key in [('habitacao', housing['households'], 'above_two'),
                                    ('conectividade', connectivity['rows'], 'connected')]:
        rows.extend(descriptive_record(indicator, row, key, ids) for row in align(records, ids))
    sources = ['docs/obee/resultados/precisao-candidatas-evidencia.json',
               'docs/obee/resultados/precisao-anexo-inventario.json',
               'docs/obee/resultados/piloto-2022-v2.json']
    for directory in ('habitacao', 'conectividade'):
        folder = ROOT / 'pipeline/eficiencia_resultados/seed' / directory
        sources += [str(path.relative_to(ROOT)) for path in sorted(folder.glob('*.json'))]
    return {'version': 'precisao-candidatas-v1', 'reference_year': 2022,
            'scope': 'duas_definicoes_principais;26_capitais;sem_DF',
            'publication_ready': False, 'is_full_obee_score': False,
            'mandatory_label': 'Estimativa preliminar da amostra do Censo 2022. Precisão municipal não quantificada neste estudo; diferenças observadas não demonstram diferenças estatisticamente significativas.',
            'policy_scope': 'Recomendação de uso descritivo condicionado; não é aprovação editorial nem gate de produção.',
            'inputs': [{'path': p, 'sha256': hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in sources],
            'rows': rows}


if __name__ == '__main__':
    path = DOCS / 'precisao-candidatas.json'
    path.write_text(json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(path)
