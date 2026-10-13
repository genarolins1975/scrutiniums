"""Auditoria doméstica de cobertura. Não calcula nem libera escores."""
import argparse
import csv
import hashlib
import io
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGES = ('Ensino fundamental, anos iniciais', 'Ensino fundamental, anos finais')
SUBJECTS = ('portugues', 'matematica')
SOURCE = 'public/eficiencia/series/edu_saeb_rede_municipal.csv'
ROSTER = 'src/lib/eficiencia/atlas-resumo.json'


def number(raw, label):
    if raw is None or str(raw).strip() == '':
        return None
    value = float(raw)
    if not math.isfinite(value):
        raise ValueError(f'{label}: número não finito')
    return value


def audit(rows, cities, year=2023):
    expected = {c['id']: c for c in cities}
    if not expected or len(expected) != len(cities):
        raise ValueError('Universo vazio ou duplicado')
    selected = {}
    for row in rows:
        if row['ano'] != str(year):
            continue
        key = (row['codigo_ibge'], row['etapa'], row['componente'])
        if key[0] not in expected or key[1] not in STAGES or key[2] not in SUBJECTS:
            raise ValueError('Registro fora do universo contratado')
        if key in selected:
            raise ValueError('Observação duplicada')
        if row['indicador_id'] != 'edu.saeb.rede_municipal':
            raise ValueError('Indicador inesperado')
        if row['elegivel_comparacao'] not in ('sim', 'nao'):
            raise ValueError('Elegibilidade desconhecida')
        selected[key] = row
    output = []
    for code, city in sorted(expected.items()):
        for stage in STAGES:
            for subject in SUBJECTS:
                row = selected.get((code, stage, subject))
                value = number(row.get('valor'), 'Proficiência') if row else None
                participation = number(row.get('participacao_pct'), 'Participação') if row else None
                if participation is not None and not 0 <= participation <= 100:
                    raise ValueError('Participação fora de 0–100')
                eligible = bool(row and row['status'] == 'OBSERVADO'
                    and row['elegivel_comparacao'] == 'sim' and value is not None)
                blockers = []
                if not row:
                    blockers.append('REGISTRO_AUSENTE')
                elif not eligible:
                    blockers.append('VALOR_AUSENTE_OU_INELEGIVEL')
                if participation is None:
                    blockers.append('PARTICIPACAO_NAO_INTEGRADA')
                blockers.extend(('REFERENCIA_OBEE_NAO_VALIDADA', 'REPRESENTATIVIDADE_NAO_AUDITADA'))
                output.append({
                    'territory': code, 'name': city['name'], 'uf': city['uf'],
                    'year': year, 'stage': stage, 'subject': subject, 'school_location': 'Urbana' if year == 2023 else 'NAO_AUDITADA',
                    'raw_value': value, 'raw_unit': 'pontos na escala Saeb',
                    'source_state': row['status'] if row else 'REGISTRO_AUSENTE',
                    'raw_comparison_eligible': eligible,
                    'source_reason': row.get('motivo_inelegibilidade', '') if row else '',
                    'participation_pct': participation,
                    'participation_available': participation is not None,
                    'source_id': row.get('fonte') if row else None,
                    'source_locator': row.get('registro') if row else None,
                    'score': None, 'score_eligible': False, 'blockers': blockers,
                })
    return output


def build(root=ROOT, year=2023):
    source, roster = root / SOURCE, root / ROSTER
    cities = json.loads(roster.read_text())['cities']
    if len(cities) != 26:
        raise ValueError('Universo esperado: 26 capitais estaduais; DF separado')
    with source.open(encoding='utf-8-sig', newline='') as f:
        rows = audit(list(csv.DictReader(f)), cities, year)
    groups = []
    for stage in STAGES:
        for subject in SUBJECTS:
            subset = [r for r in rows if r['stage'] == stage and r['subject'] == subject]
            groups.append({'stage': stage, 'subject': subject, 'expected': len(subset),
                'raw_eligible': sum(r['raw_comparison_eligible'] for r in subset),
                'participation_available': sum(r['participation_available'] for r in subset)})
    return {'schema_version': 1, 'purpose': 'AUDITORIA_COBERTURA_NAO_PUBLICA_ESCORE',
        'year': year, 'geography': ('26 capitais estaduais, escolas urbanas da rede municipal; não representa Brasil' if year == 2023 else '26 capitais estaduais, rede municipal; localização escolar não auditada'),
        'provenance': [{ 'path': path, 'sha256_bytes': hashlib.sha256((root/path).read_bytes()).hexdigest()}
            for path in (SOURCE, ROSTER)],
        'summary': {'territories': len(cities), 'expected_observations': len(rows),
            'raw_eligible': sum(r['raw_comparison_eligible'] for r in rows),
            'participation_available': sum(r['participation_available'] for r in rows),
            'score_eligible': 0, 'source_states': dict(Counter(r['source_state'] for r in rows))},
        'groups': groups, 'observations': rows}


def csv_text(report):
    buffer = io.StringIO(newline='')
    fields = list(report['observations'][0])
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    for r in report['observations']:
        writer.writerow({**r, 'blockers': ' | '.join(r['blockers'])})
    return buffer.getvalue()


def markdown(report):
    s = report['summary']
    lines = ['# Cobertura doméstica — Educação', '',
        f"Saeb {report['year']}; {report['geography']}.", '',
        f"{s['raw_eligible']} de {s['expected_observations']} observações elegíveis para comparação bruta segundo a base existente. "
        f"{s['participation_available']} registros com participação integrada. Nenhum escore OBEE liberado.", '',
        'A conciliação primária de 2023 está em AUDITORIA_FONTE_SAEB.md: 96 valores e oito ausências coincidem com o recorte urbano. Isso não valida participação, motivos de supressão ou representatividade.', '',
        '| Etapa | Disciplina | Esperados | Valores elegíveis | Participação disponível |',
        '|---|---|---:|---:|---:|']
    for g in report['groups']:
        lines.append(f"| {g['stage']} | {dict(portugues='Português', matematica='Matemática')[g['subject']]} | {g['expected']} | {g['raw_eligible']} | {g['participation_available']} |")
    lines += ['', '## Ausências e restrições', '', '| Capital | Etapa | Disciplina | Estado na fonte | Motivo |', '|---|---|---|---|---|']
    for r in report['observations']:
        if not r['raw_comparison_eligible']:
            lines.append(f"| {r['name']} | {r['stage']} | {dict(portugues='Português', matematica='Matemática')[r['subject']]} | {r['source_state']} | {r['source_reason'] or 'Não informado na base'} |")
    lines += ['', '## Próximo desbloqueio', '',
        '1. Obter a planilha oficial da mesma edição, com participantes e universo de referência por rede e etapa; conciliar código IBGE, etapa e disciplina.',
        '2. Auditar os critérios de divulgação da edição, sem tratar o critério mínimo como garantia de representatividade.',
        '3. Revisar as referências de normalização e a definição do pilar; proficiência não mede todos os aspectos da qualidade.',
        '4. Integrar acesso e resposta com denominadores próprios antes de calcular a nota do capítulo.', '',
        '## Fontes e diligência', '',
        '- [Inep: resultados Saeb 2023](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados/2023): página consultada em 11/10/2026; oferece planilhas e notas técnicas.',
        '- [Nota informativa do Ideb](https://download.inep.gov.br/educacao_basica/portal_ideb/o_que_e_o_ideb/nota_informativa_ideb.pdf): trecho indexado identifica referências históricas para normalização. São pistas metodológicas; não metas de aprendizagem nem referências OBEE aprovadas.',
        '- [Saeb 2023, volume 2](https://download.inep.gov.br/saeb/resultados/relatorio-saeb_volume_2_2023.pdf): trecho indexado distingue critérios de divulgação municipais e escolares.',
        'A obtenção integral desses PDFs retornou erro 502 nesta sessão. Nenhuma regra extraída de trecho indexado foi promovida a critério automático de elegibilidade.', '',
        'JSON e CSV mantêm valores brutos, estados, motivos e localizadores de cada registro. As ausências não são preenchidas por UF, média ou zero. As contagens não representam percentual de conclusão do escore.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    destination = args.output_dir.resolve()
    if destination == (ROOT/'public').resolve() or (ROOT/'public').resolve() in destination.parents:
        parser.error('Auditoria interna não deve ser publicada em public/')
    report = build()
    destination.mkdir(parents=True, exist_ok=True)
    (destination/'cobertura-educacao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    (destination/'cobertura-educacao.csv').write_text(csv_text(report), encoding='utf-8-sig')
    (destination/'COBERTURA_EDUCACAO.md').write_text(markdown(report))
    print(json.dumps(report['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
