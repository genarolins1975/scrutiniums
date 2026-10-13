"""Homologa a série mensal do IBGE; não usa rede nem altera a fonte RTN."""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def transformar(raw, manifesto):
    if hashlib.sha256(raw).hexdigest() != manifesto['sha256']:
        raise ValueError('Hash diverge do manifesto')
    dados = json.loads(raw)
    if len(dados) != 1 or dados[0]['id'] != '2266' or dados[0]['unidade'] != 'Número-índice':
        raise ValueError('Variável ou unidade incompatível')
    resultados = dados[0]['resultados']
    if len(resultados) != 1 or resultados[0]['classificacoes'] != [] or len(resultados[0]['series']) != 1:
        raise ValueError('Recortes não exclusivos')
    s = resultados[0]['series'][0]
    if s['localidade']['id'] != '1' or s['localidade']['nivel']['id'] != 'N1':
        raise ValueError('Território deve ser Brasil')
    esperados = [f'{a}{m:02d}' for a in range(2023, 2027) for m in range(1, 13) if f'{a}{m:02d}' <= '202607']
    if set(s['serie']) != set(esperados):
        raise ValueError('Exige 43 meses contínuos, janeiro/2023 a julho/2026')
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
    args = ap.parse_args()
    origem = ROOT/'data/contas-publicas/ipca-2026-10-12'
    out = transformar((origem/'ipca.json').read_bytes(), json.loads((origem/'manifesto.json').read_text()))
    destino = ROOT/'src/lib/contas-publicas/snapshots/ipca.json'
    texto = json.dumps(out, ensure_ascii=False, indent=2)+'\n'
    if args.verificar:
        if destino.read_text() != texto:
            raise ValueError('Snapshot diverge da origem')
    else:
        temporario = destino.with_suffix('.tmp')
        temporario.write_text(texto)
        temporario.replace(destino)
    print('IPCA: 43 meses, unidade, território e SHA256 conferidos.')


if __name__ == '__main__':
    main()
