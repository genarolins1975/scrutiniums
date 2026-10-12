"""Pacote congelado e triagem documental; não concede aprovação de produção."""
import hashlib
import json
from pathlib import Path

from .habitacao import ROOT

DOCS = ROOT / 'docs/obee/resultados'
CRITERIA = ('conteudo', 'habitacao_definicao', 'pesos_compensacao',
            'precisao_divulgacao', 'reproducao', 'edicao_apresentacao')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def safe_file(root, relative):
    path = Path(relative)
    resolved = (root / path).resolve()
    if path.is_absolute() or not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
        raise ValueError('Evidência deve ser arquivo existente dentro do repositório')
    return resolved


def file_hash(root, relative):
    return hashlib.sha256(safe_file(root, relative).read_bytes()).hexdigest()


def freeze():
    docs = ['CESTA_CONJUNTA_V3.md', 'cesta-conjunta.json', 'cesta-conjunta.csv',
            'PARECER_CONTEUDO_PESOS_V3.md', 'parecer-conteudo-pesos-v3.json',
            'PRECISAO_CANDIDATAS.md', 'precisao-candidatas.json',
            'precisao-candidatas-evidencia.json', 'precisao-anexo-inventario.json',
            'piloto-2022-v2.json', 'REVISAO_INDEPENDENTE_V3.md']
    paths = [str((DOCS / name).relative_to(ROOT)) for name in docs]
    paths += [str(p.relative_to(ROOT)) for p in
              sorted((ROOT / 'pipeline/eficiencia_resultados').rglob('*'))
              if p.is_file() and p.suffix in ('.json', '.py', '.txt')]
    payload = {'version': 'pacote-revisao-v3-v1', 'edition': 'candidata-2022-v3',
               'scenario': 'conjunta__domicilios_gt2__materiais_40pct',
               'authors': ['codex-implementation'], 'criteria': list(CRITERIA),
               'files': [{'path': p, 'sha256': file_hash(ROOT, p)} for p in sorted(set(paths))]}
    return {**payload, 'packet_sha256': digest(payload)}


def evaluate(packet, reviews, root=ROOT):
    """Verifica vínculos documentais; identidade/autenticidade exigem conferência humana."""
    payload = {k: v for k, v in packet.items() if k != 'packet_sha256'}
    if digest(payload) != packet.get('packet_sha256'):
        raise ValueError('Identidade do pacote divergente')
    if packet.get('criteria') != list(CRITERIA) or not packet.get('authors'):
        raise ValueError('Contrato de revisão inválido')
    paths = [f['path'] for f in packet['files']]
    if not paths or len(paths) != len(set(paths)):
        raise ValueError('Inventário vazio ou duplicado')
    for source in packet['files']:
        if file_hash(root, source['path']) != source['sha256']:
            raise ValueError('Evidência alterada: ' + source['path'])
    if reviews.get('packet_sha256') != packet['packet_sha256']:
        raise ValueError('Pareceres pertencem a outra versão do pacote')
    records = reviews.get('records', [])
    if not isinstance(records, list):
        raise ValueError('Pareceres inválidos')
    by_criterion = {}
    for review in records:
        criterion = review.get('criterion')
        if criterion not in CRITERIA or criterion in by_criterion:
            raise ValueError('Critério desconhecido ou duplicado')
        if review.get('decision') not in ('approve', 'reject', 'changes_requested'):
            raise ValueError('Decisão inválida')
        for field in ('reviewer', 'reviewed_at', 'rationale', 'evidence_path', 'evidence_sha256'):
            if not isinstance(review.get(field), str) or not review[field].strip():
                raise ValueError('Parecer incompleto: ' + field)
        if review['reviewer'] in packet['authors'] or review.get('independence_declared') is not True:
            raise ValueError('Independência não declarada ou autor revisando o próprio trabalho')
        if file_hash(root, review['evidence_path']) != review['evidence_sha256']:
            raise ValueError('Arquivo do parecer divergente')
        by_criterion[criterion] = review
    pending = [c for c in CRITERIA if c not in by_criterion or by_criterion[c]['decision'] != 'approve']
    return {'version': 'triagem-revisao-v3-v1', 'packet_sha256': packet['packet_sha256'],
            'criteria': {c: by_criterion[c]['decision'] if c in by_criterion else 'pending' for c in CRITERIA},
            'pending': pending, 'documentary_review_complete': not pending,
            'human_authenticity_check_required': True, 'publication_ready': False,
            'production_gate_changed': False,
            'note': 'Triagem documental não autentica revisores nem promove edição. Exige decisão editorial e integração explícitas.'}


if __name__ == '__main__':
    packet = json.loads((DOCS / 'revisao-v3-pacote.json').read_text())
    reviews = json.loads((DOCS / 'revisao-v3-pareceres.json').read_text())
    result = evaluate(packet, reviews)
    (DOCS / 'revisao-v3-status.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
