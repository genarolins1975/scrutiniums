"""Quadro do ADM: metadados públicos do GitHub, sem log, segredo ou dado de conta.

27/10/2026: o monitor vive fora do deploy para registrar falhas que retêm a gold.
Falha parcial é explícita; uma consulta indisponível nunca vira execução aprovada.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import urllib.request

RAIZ = Path(__file__).resolve().parents[1]


def obter(caminho):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'scrutiniums-operacoes'}
    if os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    req = urllib.request.Request('https://api.github.com/' + caminho, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resposta:
        return json.load(resposta)


def coletar(catalogo, consultar=obter, agora=None):
    repo = catalogo['repositorio']
    prefixo = f'repos/{repo}'
    estado = {'versao': 1, 'geradoEm': agora or datetime.now(timezone.utc).isoformat(),
              'repositorio': repo, 'execucoes': [], 'pendencias': [], 'erros': []}
    for arquivo in catalogo['workflows']:
        try:
            # Só a main: PR verde não é evidência da coleta agendada publicada.
            runs = consultar(f'{prefixo}/actions/workflows/{arquivo}/runs?branch=main&per_page=1')['workflow_runs']
            r = runs[0] if runs else None
            estado['execucoes'].append({'workflow': arquivo, 'id': r['id'] if r else None,
                'tentativa': r.get('run_attempt', 1) if r else None, 'status': r['status'] if r else 'ausente', 'conclusao': r.get('conclusion') if r else None,
                'iniciadaEm': (r.get('run_started_at') or r['created_at']) if r else None, 'atualizadaEm': r['updated_at'] if r else None,
                'url': f'https://github.com/{repo}/actions/runs/{r["id"]}/attempts/{r.get("run_attempt", 1)}' if r else None})
        except (OSError, ValueError, KeyError, TypeError):
            estado['erros'].append(arquivo)
    # Issues abertas são encaminhamentos, não prova automática da causa do defeito.
    try:
        pagina = 1
        while True:
            issues = consultar(f'{prefixo}/issues?state=open&per_page=100&page={pagina}')
            for i in issues:
                if 'pull_request' in i:
                    continue
                estado['pendencias'].append({'id': f'issue-{i["number"]}', 'titulo': i['title'][:240],
                    'desde': i['created_at'], 'url': f'https://github.com/{repo}/issues/{i["number"]}',
                    'tipo': 'issue'})
            if len(issues) < 100:
                break
            pagina += 1
            if pagina > 10:
                raise ValueError('Paginação incompleta')
    except (OSError, ValueError, KeyError, TypeError):
        estado['erros'].append('issues')
    for d in catalogo['dependencias']:
        try:
            pr = consultar(f'{prefixo}/pulls/{d["numero"]}')
            if pr['state'] == 'open':
                estado['pendencias'].append({'id': f'pr-{d["numero"]}', 'titulo': d['titulo'],
                    'desde': pr['created_at'], 'url': f'https://github.com/{repo}/pull/{d["numero"]}', 'tipo': 'pr'})
        except (OSError, ValueError, KeyError, TypeError):
            estado['erros'].append(f'pr-{d["numero"]}')
    return estado


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--saida', type=Path, required=True)
    args = p.parse_args()
    estado = coletar(json.loads((RAIZ / 'config/operacoes.json').read_text()))
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(estado, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(estado["execucoes"])} rotinas consultadas; {len(estado["erros"])} consultas indisponíveis.')
