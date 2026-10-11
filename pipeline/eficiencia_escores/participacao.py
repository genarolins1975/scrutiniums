"""Concilia extração revisada de participação com a auditoria; nunca libera escore."""
import argparse
import copy
import csv
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from .cobertura import ROOT, build, number

FIELDS = ('territory', 'year', 'stage', 'subject', 'network', 'school_location', 'participants',
          'eligible_students', 'reported_pct', 'denominator_definition', 'source_locator')


def reconcile(report, rows, provenance):
    """Contrato OBEE intermediário, não leitor de um layout Inep ainda não inspecionado."""
    if provenance.get('review_status') != 'REVIEWED':
        raise ValueError('Extração precisa de revisão documentada')
    for field in ('source_url', 'source_sha256', 'extraction_sha256', 'reviewer', 'reviewed_at'):
        if not provenance.get(field):
            raise ValueError(f'Proveniência incompleta: {field}')
    parsed = urlparse(provenance['source_url'])
    if parsed.scheme != 'https' or parsed.hostname not in ('download.inep.gov.br', 'www.gov.br'):
        raise ValueError('Origem oficial Inep esperada')
    for field in ('source_sha256', 'extraction_sha256'):
        if len(provenance[field]) != 64 or any(c not in '0123456789abcdef' for c in provenance[field]):
            raise ValueError('SHA256 inválido')
    result = copy.deepcopy(report)
    index = {(r['territory'], str(r['year']), r['stage'], r['subject']): r
             for r in result['observations']}
    if len(index) != len(result['observations']):
        raise ValueError('Auditoria com chaves duplicadas')
    seen = set()
    for row in rows:
        if any(field not in row for field in FIELDS):
            raise ValueError('Extração sem campos obrigatórios')
        key = tuple(row[k] for k in ('territory', 'year', 'stage', 'subject'))
        if key not in index or row['network'] != 'municipal' or row['school_location'] != index[key].get('school_location'):
            raise ValueError('Rede, localização escolar, edição ou território incompatível')
        if key in seen:
            raise ValueError('Participação duplicada')
        seen.add(key)
        if not row['denominator_definition'].strip() or not row['source_locator'].strip():
            raise ValueError('Denominador e localizador obrigatórios')
        participants = number(row['participants'], 'Participantes')
        denominator = number(row['eligible_students'], 'Universo')
        if participants is None or denominator is None or denominator <= 0 or participants < 0 or participants > denominator:
            raise ValueError('Contagens ausentes ou incompatíveis')
        if not participants.is_integer() or not denominator.is_integer():
            raise ValueError('Contagens devem ser inteiras')
        computed = 100 * participants / denominator
        reported = number(row['reported_pct'], 'Percentual publicado')
        if reported is not None and (not 0 <= reported <= 100 or abs(reported-computed) > 0.051):
            raise ValueError('Percentual não concilia com contagens (tolerância 0,051 p.p.)')
        observation = index[key]
        existing = observation['participation_pct']
        if existing is not None and abs(existing-computed) > 0.051:
            raise ValueError('Conflito com participação existente')
        observation['participation_pct'] = computed
        observation['participation_available'] = True
        observation['participation_evidence'] = {
            'participants': int(participants), 'eligible_students': int(denominator),
            'reported_pct': reported, 'denominator_definition': row['denominator_definition'],
            'source_locator': row['source_locator']}
        observation['blockers'] = [b for b in observation['blockers'] if b != 'PARTICIPACAO_NAO_INTEGRADA']
    if not seen:
        raise ValueError('Extração vazia não constitui integração')
    result['participation_provenance'] = provenance
    result['summary']['participation_available'] = sum(r['participation_available'] for r in result['observations'])
    result['summary']['participation_reconciled'] = len(seen)
    for group in result['groups']:
        group['participation_available'] = sum(r['participation_available'] for r in result['observations']
            if r['stage'] == group['stage'] and r['subject'] == group['subject'])
    # Participação não valida metas, representatividade nem outros pilares.
    return result


def load_evidence(extraction, source, manifest):
    metadata = json.loads(manifest.read_text())
    for field, path in (('source_sha256', source), ('extraction_sha256', extraction)):
        if hashlib.sha256(path.read_bytes()).hexdigest() != metadata.get(field):
            raise ValueError(f'Arquivo diverge do manifesto: {field}')
    with extraction.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f)), metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('extraction', 'source', 'manifest', 'output'):
        parser.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    if args.output.resolve() == (ROOT/'public').resolve() or (ROOT/'public').resolve() in args.output.resolve().parents:
        parser.error('Resultado interno não deve ser salvo em public/')
    if args.output.resolve() in {p.resolve() for p in (args.extraction, args.source, args.manifest)}:
        parser.error('Saída não pode sobrescrever evidências')
    rows, metadata = load_evidence(args.extraction, args.source, args.manifest)
    result = reconcile(build(), rows, metadata)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    print(json.dumps(result['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
