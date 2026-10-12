"""Reproduz denominadores IBGE a partir dos dois arquivos brutos versionados.

Não consulta rede durante build. Uma nova edição exige novo diretório/manifesto.
Python 3, sem dependências. Falha antes de substituir o snapshot em qualquer erro.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANOS = (2024, 2025)


def serie(raw, variavel, unidade, categoria=None):
    dados = json.loads(raw)
    assert len(dados) == 1, 'Variável duplicada ou ausente'
    dado = dados[0]
    assert dado['id'] == variavel and dado['unidade'] == unidade, 'Unidade/variável incompatível'
    assert len(dado['resultados']) == 1, 'Recortes não exclusivos'
    resultado = dado['resultados'][0]
    classificacoes = resultado['classificacoes']
    if categoria:
        assert len(classificacoes) == 1
        assert classificacoes[0]['id'] == '11255'
        assert classificacoes[0]['categoria'] == {'90707': 'PIB a preços de mercado'}
    else:
        assert classificacoes == []
    assert len(resultado['series']) == 1
    registro = resultado['series'][0]
    assert registro['localidade']['id'] == '1' and registro['localidade']['nivel']['id'] == 'N1', 'Não é Brasil'
    valores = {k: float(v) for k, v in registro['serie'].items()}
    assert all(math.isfinite(v) and v > 0 for v in valores.values()), 'Denominador ausente ou inválido'
    return valores


def transformar(pib_raw, pop_raw, manifesto):
    for chave, raw in [('pib', pib_raw), ('populacao', pop_raw)]:
        assert hashlib.sha256(raw).hexdigest() == manifesto[chave]['sha256'], 'Arquivo diverge do manifesto'
    pib = serie(pib_raw, '585', 'Milhões de Reais', '90707')
    pop = serie(pop_raw, '9324', 'Pessoas')
    assert set(pib) == {f'{ano}0{q}' for ano in ANOS for q in range(1, 5)}, 'Exige quatro trimestres por ano'
    assert set(pop) == set(map(str, ANOS)), 'População não cobre os mesmos anos'
    assert all(v.is_integer() for v in pop.values()), 'População fracionária'
    registros = [dict(ano=ano, populacao=int(pop[str(ano)]), referenciaPopulacao=f'{ano}-07-01',
                     pibMilhoes=sum(pib[f'{ano}0{q}'] for q in range(1, 5)),
                     trimestres=[dict(periodo=f'{ano}0{q}', valorMilhoes=pib[f'{ano}0{q}']) for q in range(1, 5)])
                 for ano in ANOS]
    return dict(versao=1, transformacao='importar-escala.py v1',
                captura=max(f['captura'] for f in manifesto.values()), fontes=manifesto,
                metodo='PIB anual: soma dos quatro trimestres a preços correntes, sem ajuste sazonal (IBGE 1846/585/90707). População residente estimada em 1º de julho (IBGE 6579/9324).',
                limite='Razões calculadas para anos completos. Por habitante é uma escala do agregado, não valor recebido por cada pessoa. Percentual do PIB não mede participação na produção, impacto ou eficiência. Estimativas sujeitas a revisão.',
                registros=registros)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--origem', type=Path, default=ROOT/'data/contas-publicas/escala-2026-10-12')
    ap.add_argument('--verificar', action='store_true')
    a = ap.parse_args()
    manifesto = json.loads((a.origem/'manifesto.json').read_text())
    out = transformar((a.origem/'pib.json').read_bytes(), (a.origem/'populacao.json').read_bytes(), manifesto)
    destino = ROOT/'src/lib/contas-publicas/snapshots/escala.json'
    texto = json.dumps(out, ensure_ascii=False, indent=2)+'\n'
    if a.verificar:
        assert destino.read_text() == texto, 'Snapshot não corresponde aos arquivos de origem'
    else:
        temporario = destino.with_suffix('.tmp')
        temporario.write_text(texto)
        temporario.replace(destino)
    print('IBGE: 8 trimestres, 2 populações, hashes e unidades conferidos.')


if __name__ == '__main__':
    main()
