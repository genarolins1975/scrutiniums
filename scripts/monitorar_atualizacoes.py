"""Inventário operacional somente leitura: fonte, captura, versão e causa não se confundem.

Não coleta fontes nem envia mensagens. Datas de produção não são inferidas de commits.
Os prazos vêm da vigília existente e dos SLAs já publicados por conjunto da Energia.
"""
import argparse
import calendar
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.vigilancia import PRAZO_VINTAGE_DIAS  # noqa: E402
WORKFLOWS = {'energia': 'atualizar-energia.yml', 'credito': 'atualizar-dados.yml',
             'rtn': 'atualizar-contas-publicas.yml', 'resumo': 'resumo-email.yml',
             'alertas': 'alertas-atualizacao.yml'}


def diagnosticar(*, referencia, captura, prazo=None, hoje, falha=None, retida=False,
                 fonte_verificada=False, referencia_fonte=None):
    if retida:
        return 'retida', 'publicacao_retida', 'Corrigir e reproduzir os testes da candidata; preservar a versão íntegra.'
    if falha:
        causa = 'coleta_falhou_com_dado_disponivel' if referencia_fonte else 'coleta_falhou_disponibilidade_na_origem_nao_confirmada'
        return ('retida' if referencia else 'indisponivel'), causa, 'Diagnosticar a resposta oficial sem contornar bloqueios; conservar dados anteriores.'
    if not referencia:
        return 'indisponivel', 'referencia_nao_informada', 'Conferir metadados e cobertura; ausência não é zero.'
    atrasada = bool(prazo and prazo[:10] < hoje[:10])
    if fonte_verificada and referencia_fonte == referencia:
        return ('defasada' if atrasada else 'atual'), 'fonte_sem_edicao_nova_confirmada', 'Aguardar a periodicidade da fonte e manter a referência explícita.'
    return ('defasada' if atrasada else 'atual' if prazo else 'indisponivel'), 'origem_nao_verificada', 'Confirmar disponibilidade na fonte; o envelhecimento sozinho não identifica a causa.'


def ler(root, caminho):
    return json.loads((root/caminho).read_text())


def historico(root, caminho):
    r = subprocess.run(['git', '-C', str(root), 'log', '-2', '--format=%H %cI', '--', caminho],
                       capture_output=True, text=True, check=True)
    linhas = [x.split(' ', 1) for x in r.stdout.splitlines()]
    return ({'repositorio_em': linhas[0][1], 'commit': linhas[0][0], 'producao_em': None} if linhas else None,
            linhas[1][0] if len(linhas) > 1 else None)


def prazo_vintage(referencia, chave):
    if not referencia or chave not in PRAZO_VINTAGE_DIAS:
        return None
    from datetime import date, timedelta
    ano, mes = map(int, referencia[:7].split('-'))
    # Mesma convenção da vigília existente: contar a partir do primeiro dia seguinte ao mês.
    fim = date(ano, mes, calendar.monthrange(ano, mes)[1]) + timedelta(days=1)
    return (fim + timedelta(days=PRAZO_VINTAGE_DIAS[chave])).isoformat()


def consultar_execucoes(repo):
    saida = {}
    for dominio, workflow in WORKFLOWS.items():
        def api(path):
            return json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/{path}'], text=True))
        runs = api(f'actions/workflows/{workflow}/runs?branch=main&per_page=1')['workflow_runs']
        if not runs:
            saida[dominio] = {'erro_consulta': 'nenhuma execução encontrada'}; continue
        run = runs[0]
        jobs = api(f"actions/runs/{run['id']}/jobs")['jobs']
        falhas = [s['name'] for j in jobs for s in j.get('steps', []) if s.get('conclusion') == 'failure']
        saida[dominio] = {'id': run['id'], 'url': run['html_url'], 'commit': run['head_sha'],
                         'em': run['created_at'], 'conclusao': run['conclusion'], 'passos_falhos': falhas,
                         'retida': any('publicação retida' in s.lower() for s in falhas)}
    return saida


def relatorio(root=ROOT, hoje=None, execucoes=None):
    hoje = hoje or datetime.now(timezone.utc).isoformat()
    execucoes = execucoes or {}
    registros, historicos = [], {}
    metadados_credito_em = None

    def adicionar(dominio, id_, arquivo, fonte, referencia, captura, periodicidade, integridade,
                  prazo=None, falha=None, retida=False, snapshot=None):
        if arquivo not in historicos: historicos[arquivo] = historico(root, arquivo)
        publicacao, anterior = historicos[arquivo]
        execucao = execucoes.get(dominio, {})
        # Crédito publica por grupo: a retenção global do job não retém automaticamente Pix/SCR.
        retida = retida or (dominio == 'energia' and bool(execucao.get('retida')))
        estado, causa, acao = diagnosticar(referencia=referencia, captura=captura, prazo=prazo,
                                          hoje=hoje, falha=falha, retida=retida)
        registros.append({'id': id_, 'dominio': dominio, 'fonte': fonte, 'referencia': referencia,
                          'captura': captura, 'publicacao': publicacao, 'periodicidade': periodicidade,
                          'prazo_existente': prazo, 'integridade_declarada': integridade, 'situacao': estado,
                          'historico': {'commit_anterior': anterior, 'snapshot': snapshot},
                          'falha': falha or (execucao if retida else None),
                          'falha_registrada_em': metadados_credito_em if dominio == 'credito' and falha else None,
                          'diagnostico': causa, 'acao': acao,
                          'evidencia': arquivo, 'execucao': execucao or None,
                          'disponivel_na_origem': None})

    pub = ler(root, 'public/energia/gold/publicacao.json')
    conjuntos = {c['id'].split('/')[-1]: c for c in pub.get('conjuntos', [])}
    for path in sorted((root/'public/energia/gold').glob('*.json')):
        d = json.loads(path.read_text())
        prov = d.get('proveniencia', {})
        if not isinstance(prov, dict): continue
        for key, p in prov.items():
            if not isinstance(p, dict) or not isinstance(p.get('fonte'), dict): continue
            snapshot = p.get('snapshot') or {}
            conjunto = conjuntos.get(str(snapshot.get('id', '')).split('@')[0], {})
            adicionar('energia', f'energia:{path.stem}:{key}', path.relative_to(root).as_posix(), p['fonte'],
                      (p.get('periodo_referencia') or {}).get('fim'), p.get('capturado_em'), p.get('frequencia'),
                      {'validado_em': p.get('validado_em'), 'etapas': conjunto.get('etapas')},
                      prazo=conjunto.get('atualidade', {}).get('prazo_proximo'), snapshot=snapshot)

    meta_path = 'public/obs/data/gold/meta.json'
    meta = ler(root, meta_path); quality = ler(root, 'public/obs/data/gold/quality.json')
    metadados_credito_em = meta.get('gerado_em')
    cfg = ler(root, 'config/config.json')
    falhas_sgs = {f['key']: f.get('erro') for f in meta.get('fontes_status', {}).get('bcb_sgs', {}).get('falhas', [])}
    for serie in cfg['sgs_series']:
        q = quality.get(serie['key'], {}); ref = q.get('ultima_ref')
        adicionar('credito', 'sgs:'+serie['key'], 'public/obs/data/gold/quality.json',
                  {'orgao': 'Banco Central do Brasil', 'url': serie['url'], 'codigo': serie['code']},
                  ref, None, serie['freq'], {'medidas_publicadas': q, 'nao_substitui_validacao_da_coleta': True},
                  prazo=prazo_vintage(ref, 'sgs'), falha=falhas_sgs.get(serie['key']))

    fontes = [('desenrola', 'desenrola', 'desenrola.json', 'BCB', 'https://dadosabertos.bcb.gov.br/dataset/desenrola-brasil', 'mensal'),
              ('judicial', 'judicial', 'judicial.json', 'CNJ / TST', 'https://datajud-wiki.cnj.jus.br/api-publica/', 'por edição'),
              ('scr', 'scr_data', 'panorama.json', 'BCB', 'https://www.bcb.gov.br/estabilidadefinanceira/scrdata', 'mensal'),
              ('ifdata', 'ifdata', 'sfn.json', 'BCB', 'https://www3.bcb.gov.br/ifdata/', 'trimestral'),
              ('pix', 'pix_bcb', 'pix.json', 'BCB', 'https://www.bcb.gov.br/estabilidadefinanceira/estatisticaspix', 'mensal')]
    for grupo, coletor, nome, orgao, url, periodicidade in fontes:
        arquivo = 'public/obs/data/gold/'+nome; d = ler(root, arquivo)
        ref = d.get('data_base') or d.get('mes') or meta.get('vintages', {}).get('datajud' if grupo == 'judicial' else grupo)
        st = meta.get('fontes_status', {}).get(coletor, {})
        adicionar('credito', grupo, arquivo, {'orgao': orgao, 'url': url}, ref, d.get('coletado_em'),
                  periodicidade, {'disponivel': d.get('disponivel')}, prazo=prazo_vintage(ref, grupo),
                  falha=st.get('falhas') or None, retida=nome in meta.get('restaurados', {}), snapshot=d.get('bronze_sha'))
    for coletor in ['djen', 'djen_credores']:
        for f in meta.get('fontes_status', {}).get(coletor, {}).get('falhas', []):
            adicionar('credito', f['key'], meta_path, {'orgao': 'CNJ / DJEN', 'url': cfg['djen']['base_url']},
                      None, None, 'janela móvel definida em config/config.json', None, falha=f.get('erro'))

    # Fontes auxiliares também ficam visíveis; o erro pode pertencer a um snapshot retido.
    auxiliares = [
        ('datajud', 'CNJ / DataJud', cfg['datajud']['base_url'], 'janela mensal com meses parciais omitidos'),
        ('pilar3', 'BCB / cadastro DASFN e instituições registradas',
         'https://olinda.bcb.gov.br/olinda/servico/DASFN/versao/v1/odata/Recursos', 'trimestral'),
        ('reclamacoes_consig', 'Senacon / consumidor.gov.br',
         'https://www.consumidor.gov.br/pages/publicacao/externo/', 'mensal'),
        ('trends_manual', 'Google Trends / arquivo manual documentado',
         'https://trends.google.com/trends/', 'importação manual; sem SLA automático'),
    ]
    for coletor, orgao, url, periodicidade in auxiliares:
        for falha in meta.get('fontes_status', {}).get(coletor, {}).get('falhas', []):
            chave = falha['key']
            adicionar('credito', coletor+':'+chave, meta_path, {'orgao': orgao, 'url': url},
                      quality.get(chave, {}).get('ultima_ref'), None, periodicidade, None,
                      falha=falha.get('erro'))

    arquivo = 'src/lib/contas-publicas/snapshots/dados.json'; d = ler(root, arquivo)
    adicionar('rtn', 'rtn', arquivo, {'orgao': 'Tesouro Nacional', 'url': d['fonteRTN']}, d['referenciaRTN'],
              d['captura'], 'mensal; integração por edição', d.get('validacao'), snapshot=d.get('sha256'))
    return {'versao': 1, 'avaliado_em': hoje, 'escopo': 'arquivos do repositório; produção não verificada',
            'limites': ['Data de geração não é captura nem publicação.',
                       'Campo nulo significa não informado, nunca zero ou sucesso.',
                       'Sem consulta oficial não se presume que a instituição deixou de atualizar.',
                       'Ausência de SLA não autoriza inventar prazo; situacao indisponivel pode indicar diagnóstico inconclusivo.'],
            'execucoes': execucoes, 'registros': registros}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--saida', type=Path, required=True)
    p.add_argument('--repo', default='genarolins1975/scrutiniums')
    p.add_argument('--consultar-execucoes', action='store_true')
    args = p.parse_args()
    resultado = relatorio(execucoes=consultar_execucoes(args.repo) if args.consultar_execucoes else {})
    args.saida.mkdir(parents=True, exist_ok=True)
    (args.saida/'atualizacoes.json').write_text(json.dumps(resultado, ensure_ascii=False, indent=2)+'\n')
    contagens = {s: sum(r['situacao'] == s for r in resultado['registros']) for s in ['atual', 'defasada', 'retida', 'indisponivel']}
    (args.saida/'resumo.md').write_text('# Monitoramento das atualizações\n\n'+resultado['escopo']+'\n\n'+
        '\n'.join(f'- {s}: {n}' for s, n in contagens.items())+'\n\nDetalhes, fontes e limites em `atualizacoes.json`.\n')
    print(json.dumps(contagens, ensure_ascii=False))


if __name__ == '__main__':
    main()
