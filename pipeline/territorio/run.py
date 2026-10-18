"""Execução do pipeline do Observatório do Território e Clima.

    python3 -m pipeline.territorio.run                 reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.territorio.run --check         confere se a gold versionada é a do seed
    python3 -m pipeline.territorio.run --coleta        recoleta as fontes (rede) e reconstrói
    python3 -m pipeline.territorio.run --coleta --cache <pasta>   reaproveita downloads já feitos

O seed guarda só os agregados usados, com sha256, bytes e Last-Modified de cada
arquivo original e a data de captura. A gold acrescenta o que é derivado do seed
(comparação com o mesmo período do ano anterior) e é validada antes de gravar.
"""
import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

from . import queimadas

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
    ap.add_argument('--coleta', action='store_true')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--cache')
    ap.add_argument('--hoje', help='data de referência AAAA-MM-DD (padrão: hoje)')
    a = ap.parse_args(argv)
    if a.coleta:
        hoje = date.fromisoformat(a.hoje) if a.hoje else date.today()
        if a.cache:
            os.makedirs(a.cache, exist_ok=True)
        seed = queimadas.montar(hoje, a.cache)
        seed['areaQueimada'] = queimadas.area_queimada(hoje, a.cache)
        validar_queimadas(seed)
        _gravar(SEED / 'queimadas.json', seed)
    seed = json.loads((SEED / 'queimadas.json').read_text(encoding='utf-8'))
    gold = gold_queimadas(seed)
    if a.check:
        atual = (GOLD / 'queimadas.json').read_text(encoding='utf-8')
        if atual != _texto(gold):
            print('Gold de queimadas difere do seed: rode python3 -m pipeline.territorio.run', file=sys.stderr)
            return 1
        print('Gold de queimadas confere com o seed.')
        return 0
    _gravar(GOLD / 'queimadas.json', gold)
    print(f"queimadas: {len(gold['anual'])} anos, comparação {gold['comparacao'] and gold['comparacao']['variacaoPct']}%")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
