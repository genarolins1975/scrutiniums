"""Execução do pipeline do Observatório do Território e Clima.

    python3 -m pipeline.territorio.run                 reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.territorio.run --check         confere se a gold versionada é a do seed
    python3 -m pipeline.territorio.run --coleta        recoleta todas as fontes (rede) e reconstrói
    python3 -m pipeline.territorio.run --coleta desastres          recoleta só as fontes indicadas
    python3 -m pipeline.territorio.run --coleta --cache <pasta>   reaproveita downloads já feitos

O seed guarda só os agregados usados, com sha256, bytes e Last-Modified de cada
arquivo original e a data de captura. A gold acrescenta o que é derivado do seed
(comparação com o mesmo período do ano anterior, nas queimadas) e é validada antes
de gravar. Fontes: queimadas (INPE, Programa Queimadas), desastres (Atlas Digital
de Desastres no Brasil, Sedec/MIDR) e emissões (inventário oficial do MCTI, SIRENE).
"""
import argparse
import json
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

from . import desastres, emissoes, queimadas

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / 'pipeline' / 'territorio' / 'seed'
GOLD = RAIZ / 'public' / 'territorio' / 'gold'
VERSAO = 'territorio-1.0.0'


def _recorte(dados, rotulo):
    return next((r for r in dados['recortes'] if r['rotulo'] == rotulo), None)


def validar_queimadas(dados):
    """Invariantes que bloqueiam a publicação."""
    if dados['sateliteReferencia']['id'] != queimadas.SATELITE_REFERENCIA:
        raise ValueError('Satélite de referência do seed difere do pipeline')
    anos = [a['ano'] for a in dados['anual']]
    if anos != sorted(anos) or len(set(anos)) != len(anos):
        raise ValueError('Série anual fora de ordem ou com ano repetido')
    if any(b - a != 1 for a, b in zip(anos, anos[1:])):
        raise ValueError('Série anual com ano faltando')
    fechados = [a for a in dados['anual'] if not a['parcial']]
    if not fechados or any(not isinstance(a['focos'], int) or a['focos'] <= 0 for a in fechados):
        raise ValueError('Ano fechado sem contagem positiva')
    if sum(1 for a in dados['anual'] if a['parcial']) > 1:
        raise ValueError('Mais de um ano parcial')
    for r in dados['recortes']:
        if r.get('focos') is None:
            continue
        if sum(x['focos'] for x in r['porUF']) != r['focos'] or sum(x['focos'] for x in r['porBioma']) != r['focos']:
            raise ValueError(f'UF ou bioma não somam o total em {r["rotulo"]}')
    for ano, meses in dados['mensal'].items():
        for m in meses or []:
            if not m['mes'].startswith(ano):
                raise ValueError(f'Mês {m["mes"]} na série de {ano}')
    if not dados['originais']:
        raise ValueError('Seed sem originais')
    for url, o in dados['originais'].items():
        if len(o.get('sha256') or '') != 64 or not o.get('bytes'):
            raise ValueError(f'Original sem sha256 ou bytes: {url}')
    aq = dados.get('areaQueimada')
    if aq:
        for a in aq['anual']:
            if abs(sum(a['km2'].values()) - a['totalKm2']) > 1:
                raise ValueError(f'Área queimada por bioma não soma o total em {a["ano"]}')


def gold_queimadas(seed):
    validar_queimadas(seed)
    atual, anterior = _recorte(seed, 'acumuladoAnoCorrente'), _recorte(seed, 'mesmoPeriodoAnoAnterior')
    comparacao = None
    if atual and anterior and atual.get('focos') is not None and anterior.get('focos'):
        comparacao = {
            'periodoAtual': atual['periodo'],
            'periodoAnterior': anterior['periodo'],
            'focosAtual': atual['focos'],
            'focosAnterior': anterior['focos'],
            'variacaoPct': round(100 * (atual['focos'] - anterior['focos']) / anterior['focos'], 1),
            'nota': 'Mesmos meses completos nos dois anos, satélite de referência. O ano corrente é preliminar: o INPE pode regerar os arquivos mensais.',
        }
    return {'dominio': 'territorio', 'gold': 'queimadas', 'versaoPipeline': VERSAO, **seed, 'comparacao': comparacao}


GRUPOS_DESASTRES = desastres.GRUPOS


def validar_desastres(dados):
    """Invariantes que bloqueiam a publicação."""
    serie = dados['serie_anual']
    anos = [a['ano'] for a in serie]
    if anos != sorted(anos) or any(b - a != 1 for a, b in zip(anos, anos[1:])):
        raise ValueError('Série de desastres fora de ordem ou com ano faltando')
    for a in serie:
        if a['ano'] < 2003:
            if a['registros_reconhecidos'] is not None:
                raise ValueError(f'Reconhecimento antes de 2003 em {a["ano"]}: a contagem não existe e não é zero')
            continue
        if sum(a['por_grupo_reconhecidos'][g] for g in GRUPOS_DESASTRES) != a['registros_reconhecidos']:
            raise ValueError(f'Grupos não somam os reconhecidos em {a["ano"]}')
        if a['municipios_distintos_com_reconhecimento'] > a['registros_reconhecidos']:
            raise ValueError(f'Mais municípios que registros em {a["ano"]}')
    ult = dados['por_uf']['ultimo_ano_completo']
    nacional = next(a for a in serie if a['ano'] == ult['ano'])
    if sum(u['registros_reconhecidos'] for u in ult['ufs'].values()) != nacional['registros_reconhecidos']:
        raise ValueError('UFs não somam o total nacional no último ano completo')
    corrente = dados['por_uf']['ano_corrente']
    if not corrente['disponivel'] and (corrente['ufs'] is not None or not corrente['motivo']):
        raise ValueError('Ano corrente indisponível precisa de motivo e sem valores')
    for chave, o in dados['originais'].items():
        if len(o.get('sha256') or '') != 64 or not o.get('bytes'):
            raise ValueError(f'Original sem sha256 ou bytes: {chave}')


def gold_desastres(seed):
    validar_desastres(seed)
    return {'dominio': 'territorio', 'gold': 'desastres', 'versaoPipeline': VERSAO, **seed}


SETORES_EMISSOES = [k for k, _, _ in emissoes.SETORES]


def validar_emissoes(dados):
    """Invariantes que bloqueiam a publicação."""
    anos = [a['ano'] for a in dados['anos']]
    if anos != list(range(anos[0], anos[-1] + 1)) or anos[0] != 1990:
        raise ValueError('Série de emissões com ano faltando ou fora de ordem')
    if 2005 not in anos:
        raise ValueError('Série de emissões sem 2005, ano de referência da NDC')
    for a in dados['anos']:
        soma = sum(a['setores'][k] for k in SETORES_EMISSOES)
        if abs(soma - a['totalLiquido']) > 1e-6 * abs(a['totalLiquido']) + 1:
            raise ValueError(f'Setores não somam o total líquido em {a["ano"]}')
        if abs(a['totalLiquido'] - a['setores']['lulucf'] - a['totalSemLulucf']) > 1:
            raise ValueError(f'Total sem LULUCF incoerente em {a["ano"]}')
    if 'GWP AR5' not in dados['metrica'] or not dados['unidade'].startswith('kt CO2e'):
        raise ValueError('Métrica ou unidade inesperada no inventário')
    for o in dados['originais']:
        if len(o.get('sha256') or '') != 64 or not o.get('bytes'):
            raise ValueError(f'Original sem sha256 ou bytes: {o.get("setor")}')


def gold_emissoes(seed):
    validar_emissoes(seed)
    por_ano = {a['ano']: a for a in seed['anos']}
    ultimo = por_ano[seed['anoFinal']]
    ref = por_ano[2005]
    derivados = {
        'anoReferenciaNdc': 2005,
        'variacaoDesde2005Pct': {
            'totalLiquido': round(100 * (ultimo['totalLiquido'] / ref['totalLiquido'] - 1), 1),
            'totalSemLulucf': round(100 * (ultimo['totalSemLulucf'] / ref['totalSemLulucf'] - 1), 1),
            **{k: round(100 * (ultimo['setores'][k] / ref['setores'][k] - 1), 1) for k in SETORES_EMISSOES},
        },
        'participacaoUltimoAnoPct': {k: round(100 * ultimo['setores'][k] / ultimo['totalLiquido'], 1) for k in SETORES_EMISSOES},
    }
    return {'dominio': 'territorio', 'gold': 'emissoes', 'versaoPipeline': VERSAO, **seed, 'derivados': derivados}


FONTES = {
    'queimadas': {'gold': gold_queimadas},
    'desastres': {'gold': gold_desastres},
    'emissoes': {'gold': gold_emissoes},
}


def coletar(fonte, hoje, cache):
    if fonte == 'queimadas':
        if cache:
            os.makedirs(cache, exist_ok=True)
        seed = queimadas.montar(hoje, cache)
        seed['areaQueimada'] = queimadas.area_queimada(hoje, cache)
        validar_queimadas(seed)
        return seed
    if fonte == 'emissoes':
        pasta = os.path.join(cache, 'emissoes') if cache else tempfile.mkdtemp(prefix='territorio-emissoes-')
        from datetime import datetime, timezone
        seed = emissoes.coletar(pasta, datetime.now(timezone.utc).isoformat(timespec='seconds'))
        validar_emissoes(seed)
        return seed
    pasta = os.path.join(cache, 'desastres') if cache else tempfile.mkdtemp(prefix='territorio-desastres-')
    originais, bloqueios = desastres.coletar(pasta)
    seed = desastres.montar(originais, bloqueios, pasta, hoje)
    validar_desastres(seed)
    return seed


def _gravar(caminho, dados):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(dados, ensure_ascii=False, indent=1) + '\n'
    tmp = caminho.with_suffix('.tmp')
    tmp.write_text(texto, encoding='utf-8')
    os.replace(tmp, caminho)


def _texto(dados):
    return json.dumps(dados, ensure_ascii=False, indent=1) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--coleta', nargs='?', const='todas', help='fontes separadas por vírgula; sem valor, todas')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--cache')
    ap.add_argument('--hoje', help='data de referência AAAA-MM-DD (padrão: hoje)')
    a = ap.parse_args(argv)
    if a.coleta:
        hoje = date.fromisoformat(a.hoje) if a.hoje else date.today()
        fontes = list(FONTES) if a.coleta == 'todas' else a.coleta.split(',')
        for f in fontes:
            if f not in FONTES:
                ap.error(f'fonte desconhecida: {f}')
            _gravar(SEED / f'{f}.json', coletar(f, hoje, a.cache))
    falhou = False
    for f, cfg in FONTES.items():
        caminho_seed = SEED / f'{f}.json'
        if not caminho_seed.exists():
            continue
        gold = cfg['gold'](json.loads(caminho_seed.read_text(encoding='utf-8')))
        if a.check:
            atual = (GOLD / f'{f}.json').read_text(encoding='utf-8') if (GOLD / f'{f}.json').exists() else None
            if atual != _texto(gold):
                print(f'Gold de {f} difere do seed: rode python3 -m pipeline.territorio.run', file=sys.stderr)
                falhou = True
            else:
                print(f'Gold de {f} confere com o seed.')
            continue
        _gravar(GOLD / f'{f}.json', gold)
        print(f'{f}: gold gravada')
    return 1 if falhou else 0


if __name__ == '__main__':
    raise SystemExit(main())
