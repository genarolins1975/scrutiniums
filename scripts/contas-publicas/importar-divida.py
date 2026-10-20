"""Dívida bruta do governo geral (Banco Central, SGS): coleta reprodutível, nunca no build.

Uso:
  python3 scripts/contas-publicas/importar-divida.py               # baixa as duas séries, valida e grava
  python3 scripts/contas-publicas/importar-divida.py --de-fontes   # refaz o snapshot das respostas guardadas, sem rede

Fonte: Sistema Gerenciador de Séries Temporais do Banco Central (API pública, sem credencial), metodologia
utilizada a partir de 2008:
  13761 · Dívida bruta do governo geral, R$ milhões (saldo no fim do mês);
  13762 · Dívida bruta do governo geral, % do PIB (PIB dos últimos 12 meses a preços correntes, estimado pelo
          Banco Central).
Governo geral = governo federal, INSS, estados e municípios; exclui Banco Central e empresas estatais. Não é a
Dívida Pública Federal do Tesouro (outro perímetro) nem a dívida líquida (que desconta ativos).

Conferências: as duas séries têm exatamente os mesmos meses, consecutivos e sem lacuna, a partir de dezembro de
2006; valores finitos e positivos. Qualquer falha reprova e nada é gravado. As respostas brutas ficam em
data/contas-publicas/fontes/bcb com o hash no snapshot; o teste refaz o snapshot a partir delas.
O Banco Central revisa os meses recentes: a coleta agendada regrava o snapshot quando a resposta muda.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
SERIES = {'13761': 'reais', '13762': 'pib'}
URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados?formato=json'
PAGINA = 'https://www.bcb.gov.br/estatisticas/estatisticasfiscais'
FONTES = ROOT / 'data/contas-publicas/fontes/bcb'
DESTINO = ROOT / 'src/lib/contas-publicas/snapshots/divida.json'
INICIO = '2006-12'


def check(ok, mensagem):
    if not ok:
        raise ValueError(mensagem)


def _serie(raw, codigo):
    dados = json.loads(raw)
    check(isinstance(dados, list) and dados, f'Série {codigo} vazia')
    pontos = {}
    for p in dados:
        d, m, a = p['data'].split('/')
        check(d == '01', f'Série {codigo}: data fora do padrão mensal ({p["data"]})')
        chave = f'{a}-{m}'
        check(chave not in pontos, f'Série {codigo}: mês repetido ({chave})')
        v = float(p['valor'])
        check(math.isfinite(v) and v > 0, f'Série {codigo}: valor inválido em {chave}')
        pontos[chave] = v
    return pontos


def transformar(brutos, capturas):
    series = {codigo: _serie(brutos[codigo], codigo) for codigo in SERIES}
    meses = sorted(series['13761'])
    check(meses == sorted(series['13762']), 'As séries em R$ e em % do PIB não cobrem os mesmos meses')
    check(meses[0] == INICIO, f'Série precisa começar em {INICIO}')
    for a, b in zip(meses, meses[1:]):
        ya, ma = map(int, a.split('-'))
        yb, mb = map(int, b.split('-'))
        check(yb * 12 + mb - (ya * 12 + ma) == 1, f'Lacuna entre {a} e {b}')
    return {
        'versao': 1,
        'transformacao': 'importar-divida.py v1',
        'fonte': {'nome': 'Banco Central · Estatísticas fiscais (SGS 13761 e 13762)', 'pagina': PAGINA,
                  'series': {c: URL.format(c) for c in SERIES}},
        'sha256': {c: hashlib.sha256(brutos[c]).hexdigest() for c in SERIES},
        'captura': max(capturas.values()),
        'perimetro': 'Governo geral: governo federal, INSS, estados e municípios; exclui Banco Central e empresas estatais',
        'metodologia': 'Metodologia utilizada a partir de 2008 (série retroativa a dezembro de 2006)',
        'unidade': {'reais': 'R$ milhões correntes, saldo no fim do mês', 'pib': '% do PIB dos últimos 12 meses, a preços correntes'},
        'registros': [{'periodo': m, 'milhoes': series['13761'][m], 'pctPIB': series['13762'][m]} for m in meses],
    }


def _arquivo(codigo):
    return FONTES / f'{codigo}.json'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--de-fontes', action='store_true', help='refaz o snapshot das respostas guardadas, sem rede')
    a = ap.parse_args()
    anterior = json.loads(DESTINO.read_text()) if DESTINO.exists() else None
    if a.de_fontes:
        check(anterior is not None, 'Sem snapshot anterior: rodar sem --de-fontes')
        brutos = {c: _arquivo(c).read_bytes() for c in SERIES}
        snapshot = transformar(brutos, {c: anterior['captura'] for c in SERIES})
    else:
        brutos = {c: urllib.request.urlopen(URL.format(c), timeout=120).read() for c in SERIES}
        agora = dt.datetime.now(dt.timezone.utc).isoformat()
        mudou = any(not _arquivo(c).exists() or _arquivo(c).read_bytes() != brutos[c] for c in SERIES)
        captura = agora if mudou or anterior is None else anterior['captura']
        snapshot = transformar(brutos, {c: captura for c in SERIES})  # valida antes de gravar
        if mudou:
            FONTES.mkdir(parents=True, exist_ok=True)
            for c in SERIES:
                _arquivo(c).write_bytes(brutos[c])
    DESTINO.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
    u = snapshot['registros'][-1]
    print(f"Dívida bruta do governo geral: {len(snapshot['registros'])} meses, {u['periodo']}: R$ {u['milhoes'] / 1e6:.2f} tri, {u['pctPIB']}% do PIB")


if __name__ == '__main__':
    main()
