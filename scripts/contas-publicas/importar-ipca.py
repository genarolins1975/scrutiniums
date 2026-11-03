"""Homologa a série mensal do IBGE; não usa rede nem altera a fonte RTN."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def serie_v3(dados):
    """Resposta da API de agregados v3 (servicodados.ibge.gov.br)."""
    if len(dados) != 1 or dados[0]['id'] != '2266' or dados[0]['unidade'] != 'Número-índice':
        raise ValueError('Variável ou unidade incompatível')
    resultados = dados[0]['resultados']
    if len(resultados) != 1 or resultados[0]['classificacoes'] != [] or len(resultados[0]['series']) != 1:
        raise ValueError('Recortes não exclusivos')
    s = resultados[0]['series'][0]
    if s['localidade']['id'] != '1' or s['localidade']['nivel']['id'] != 'N1':
        raise ValueError('Território deve ser Brasil')
    return s


def serie_sidra(dados):
    """Resposta da API de valores do SIDRA (apisidra.ibge.gov.br/values), a mesma tabela 1737 em linhas.

    Usada desde 03/11/2026, quando a API v3 recusou conexão do ambiente de captura; os 43 meses comuns
    às duas respostas conferiram iguais. Mesmas exigências: variável 2266, número-índice, só Brasil.
    """
    if not isinstance(dados, list) or len(dados) < 2 or dados[0].get('D3C') != 'Mês (Código)':
        raise ValueError('Cabeçalho do SIDRA incompatível')
    linhas = dados[1:]
    if any(r['D2C'] != '2266' or r['MN'] != 'Número-índice' for r in linhas):
        raise ValueError('Variável ou unidade incompatível')
    if any(r['NC'] != '1' or r['D1C'] != '1' for r in linhas):
        raise ValueError('Território deve ser Brasil')
    serie = {}
    for r in linhas:
        if r['D3C'] in serie:
            raise ValueError('Recortes não exclusivos')
        serie[r['D3C']] = r['V']
    return {'serie': serie}


def transformar(raw, manifesto):
    if hashlib.sha256(raw).hexdigest() != manifesto['sha256']:
        raise ValueError('Hash diverge do manifesto')
    dados = json.loads(raw)
    s = serie_sidra(dados) if manifesto.get('formato') == 'sidra-values' else serie_v3(dados)
    base = manifesto.get('basePrecos', '')
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', base) or base < '2023-01':
        raise ValueError('Base de preços inválida no manifesto da edição')
    esperados = [f'{a}{m:02d}' for a in range(2023, int(base[:4]) + 1) for m in range(1, 13)
                 if f'{a}{m:02d}' <= base.replace('-', '')]
    if set(s['serie']) != set(esperados):
        raise ValueError(f'Exige {len(esperados)} meses contínuos, janeiro/2023 até {base}')
    registros = [dict(periodo=k[:4]+'-'+k[4:], indice=float(s['serie'][k])) for k in esperados]
    if any(not math.isfinite(r['indice']) or r['indice'] <= 0 for r in registros):
        raise ValueError('Índice ausente, não finito ou não positivo')
    if manifesto['basePrecos'] != registros[-1]['periodo']:
        raise ValueError('Base de preços incompatível com esta edição')
    return dict(versao=1, transformacao='importar-ipca.py v1', fonte=manifesto,
                basePrecos=manifesto['basePrecos'],
                metodo='Cada fluxo mensal RTN é multiplicado por IPCA(base)/IPCA(mês do fluxo); somente depois os meses são somados. Mesma janela nos dois anos, sem anualização.',
                limite='IPCA mede preços do consumo das famílias, não os custos específicos do governo. A variação real não mede volume de serviços, qualidade ou eficiência. Valores calculados pela Scrutiniums, não série real oficial do Tesouro.',
                registros=registros)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verificar', action='store_true')
    ap.add_argument('--origem', type=Path, default=ROOT/'data/contas-publicas/ipca-2026-11-03')
    ap.add_argument('--destino', type=Path, default=ROOT/'src/lib/contas-publicas/snapshots/ipca.json')
    args = ap.parse_args()
    origem = args.origem
    out = transformar((origem/'ipca.json').read_bytes(), json.loads((origem/'manifesto.json').read_text()))
    destino = args.destino
    texto = json.dumps(out, ensure_ascii=False, indent=2)+'\n'
    if args.verificar:
        if destino.read_text() != texto:
            raise ValueError('Snapshot diverge da origem')
    else:
        temporario = destino.with_suffix('.tmp')
        temporario.write_text(texto)
        temporario.replace(destino)
    print(f"IPCA: {len(out['registros'])} meses, unidade, território e SHA256 conferidos.")


if __name__ == '__main__':
    main()
