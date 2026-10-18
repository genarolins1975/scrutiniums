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
    'familia': 'Família do silver; vigência é determinada por (família, recurso). Uma captura pode ter registros em mais de uma família.',
    'recurso': 'Identificador do recurso na fonte.',
    'sha256': 'SHA-256 do conteúdo capturado, sem alteração.',
    'capturado_em': 'Data e hora UTC da captura integrada (ISO 8601).',
    'publicado_em': 'Data de publicação informada pela fonte; vazio quando ausente.',
    'origem': 'Origem da captura, como registrada no silver.',
    'vigente': 'true se a captura é vigente para (família, recurso); false se substituída.',
}


def dicionario_historico():
    descricao = '; '.join(f'{nome}: {texto}' for nome, texto in COLUNAS.items())
    return {URL_CSV: {'colunas': descricao, 'modulo': 'dados', 'gold': 'meta.json'}}


def fonte_de(con, dataset, *, familia, **atributos):
    snap = c.snapshot_de(con, dataset)
    return {'dataset': dataset, 'familia': familia, **atributos,
            'ultima_captura': c.ultima_captura(snap), 'snapshot': snap.get('id'),
            'snapshot_sha256': snap.get('sha256'), 'ultima_tentativa': base.ultima_coleta(con, dataset),
            'capturas': snap.get('capturas', []), 'historico': snap.get('historico', []),
            'recapturas_sem_mudanca': (snap.get('revisoes') or {}).get('recapturas_sem_mudanca')}


def fontes_do_modulo(con, registro):
    return {f"{registro['familia']}/{d['dataset_silver']}": fonte_de(con, d['dataset_silver'], modulo=registro['id'], familia=registro['familia'])
            for d in registro['datasets'] if d.get('dataset_silver')}


def publicar_historico(fontes, limiar_parquet=None):
    """Uma linha por vintage; vigentes representam exatamente a lista capturas.

    Resumo distingue recursos vigentes de vintages históricas. As datas são as
    capturas do histórico, nunca a execução atual; recapturas idênticas vêm do
    log de coletas, pois não criam vintage nem linha nova.
    """
    resultado, grupos = {}, {}
    linhas = []
    for fonte in fontes.values():
        ds, familia = fonte['dataset'], fonte['familia']
        familias = grupos.setdefault(ds, {})
        if familia in familias:
            raise ValueError(f'fonte repetida: {familia}/{ds}')
        familias[familia] = fonte
    for ds, familias in grupos.items():
        historico, capturas, snapshots = [], [], []
        for familia, fonte in familias.items():
            historico.extend({**h, 'familia': familia} for h in fonte.get('historico', []))
            capturas.extend({**h, 'familia': familia} for h in fonte.get('capturas', []))
            snapshots.append({**{k: v for k, v in fonte.items() if k not in ('capturas', 'historico')},
                              'familia': familia})
        # Logs podem ter sido copiados entre silvers: não estimar quantos
        # downloads únicos representam. Manter as contagens por família.
        recapturas = next(iter(familias.values())).get('recapturas_sem_mudanca') if len(familias) == 1 else None
        # Não inventar snapshot ou última tentativa que represente famílias
        # distintas. Cada identificação original fica em snapshots_familias.
        fonte = dict(next(iter(familias.values()))) if len(familias) == 1 else {
            'dataset': ds, 'familia': None, 'snapshot': None, 'snapshot_sha256': None, 'ultima_tentativa': None}
        datas = [x['capturado_em'] for x in historico]
        resumo = {
            'total_capturas': len(capturas),
            'total_historico': len(historico),
            'primeira': min(datas) if datas else None,
            'ultima': max(datas) if datas else None,
            'recapturas_sem_mudanca': recapturas,
            'limite_recentes': LIMITE_RECENTES,
        }
        def recentes(lista):
            return sorted(lista, key=lambda x: (x['capturado_em'], x['familia'], x['recurso'], x['sha256']),
                          reverse=True)[:LIMITE_RECENTES]
        resultado[ds] = {**fonte, 'ultima_captura': max(datas) if datas else None,
                         'recapturas_sem_mudanca': recapturas, 'snapshots_familias': snapshots,
                         'capturas': recentes(capturas), 'historico': recentes(historico),
                         'resumo_capturas': resumo, 'historico_csv': URL_CSV}
        for h in historico:
            linhas.append([ds] + [('true' if h[k] else 'false') if k == 'vigente' else h[k]
                                  for k in COLUNAS if k != 'dataset'])
    base.escreve_csv(NOME_CSV, COLUNAS, linhas)
    # Dados pode retornar stub antes de exportar arquivos (catálogos ausentes).
    # Mesmo nesse caso nunca deixar Parquet de ontem ao lado do CSV de hoje.
    from pathlib import Path
    from pipeline.energia.fontes import publicacao_dados as pub
    csv_path = Path(base.SERIES) / NOME_CSV
    parquet_path = csv_path.with_suffix('.parquet')
    limite = pub.LIMIAR_PARQUET_BYTES if limiar_parquet is None else limiar_parquet
    if csv_path.stat().st_size >= limite:
        pub.csv_para_parquet(str(csv_path), str(parquet_path), URL_CSV)
        ok, detalhe, *_ = pub.confere_parquet(str(csv_path), str(parquet_path))
        if not ok:
            raise ValueError(f'histórico de capturas: Parquet divergente do CSV: {detalhe}')
    elif parquet_path.exists() and pub.metadados_parquet(str(parquet_path)):
        parquet_path.unlink()
    return resultado
