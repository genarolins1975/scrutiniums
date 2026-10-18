"""Histórico integral auditável em CSV; meta.json só carrega resumo e amostra.

Não limita snapshot_de: builders continuam recebendo todas as vintages. A redução
acontece apenas ao montar meta.json, depois de construir os módulos.
"""
from pipeline.energia import base
from pipeline.energia.gold import comum as c

LIMITE_RECENTES = 10  # por fonte e por lista; custo do JSON independe dos dias coletados
NOME_CSV = 'capturas_fontes.csv'
URL_CSV = f'/energia/series/{NOME_CSV}'
COLUNAS = {
    'dataset': 'Identificador do conjunto no silver; chave de fontes em meta.json.',
    'recurso': 'Identificador do recurso na fonte.',
    'sha256': 'SHA-256 do conteúdo capturado, sem alteração.',
    'capturado_em': 'Data e hora UTC da captura integrada (ISO 8601).',
    'publicado_em': 'Data de publicação informada pela fonte; vazio quando ausente.',
    'origem': 'Origem da captura, como registrada no silver.',
    'vigente': 'true se a captura é vigente para o recurso; false se substituída.',
}


def dicionario_historico():
    descricao = '; '.join(f'{nome}: {texto}' for nome, texto in COLUNAS.items())
    return {URL_CSV: {'colunas': descricao, 'modulo': 'dados', 'gold': 'meta.json'}}


def fonte_de(con, dataset, **atributos):
    snap = c.snapshot_de(con, dataset)
    return {**atributos, 'ultima_captura': c.ultima_captura(snap), 'snapshot': snap.get('id'),
            'snapshot_sha256': snap.get('sha256'), 'ultima_tentativa': base.ultima_coleta(con, dataset),
            'capturas': snap.get('capturas', []), 'historico': snap.get('historico', []),
            'recapturas_sem_mudanca': (snap.get('revisoes') or {}).get('recapturas_sem_mudanca')}


def fontes_do_modulo(con, registro):
    return {d['dataset_silver']: fonte_de(con, d['dataset_silver'], modulo=registro['id'], familia=registro['familia'])
            for d in registro['datasets'] if d.get('dataset_silver')}


def publicar_historico(fontes):
    """Uma linha por vintage; vigentes representam exatamente a lista capturas.

    Resumo distingue recursos vigentes de vintages históricas. As datas são as
    capturas do histórico, nunca a execução atual; recapturas idênticas vêm do
    log de coletas, pois não criam vintage nem linha nova.
    """
    resultado = {}
    linhas = []
    for ds, fonte in fontes.items():
        historico = fonte.get('historico', [])
        capturas = fonte.get('capturas', [])
        datas = [x['capturado_em'] for x in historico]
        resumo = {
            'total_capturas': len(capturas),
            'total_historico': len(historico),
            'primeira': min(datas) if datas else None,
            'ultima': max(datas) if datas else None,
            'recapturas_sem_mudanca': fonte.get('recapturas_sem_mudanca'),
            'limite_recentes': LIMITE_RECENTES,
        }
        def recentes(lista):
            return sorted(lista, key=lambda x: (x['capturado_em'], x['recurso'], x['sha256']),
                          reverse=True)[:LIMITE_RECENTES]
        resultado[ds] = {**fonte, 'capturas': recentes(capturas), 'historico': recentes(historico),
                         'resumo_capturas': resumo, 'historico_csv': URL_CSV}
        for h in historico:
            linhas.append([ds] + [('true' if h[k] else 'false') if k == 'vigente' else h[k]
                                  for k in COLUNAS if k != 'dataset'])
    base.escreve_csv(NOME_CSV, COLUNAS, linhas)
    return resultado
