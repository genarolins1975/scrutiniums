"""Contornos oficiais das 26 capitais estaduais para a entrada do OBEE.

Fonte: IBGE, API de malhas territoriais v3, malha municipal de 2022 (qualidade
máxima) e metadados de área. A figura da capital na página inicial é desenhada a
partir destes contornos: não há silhueta inventada.

O script baixa as respostas originais para `--cache`, grava um recorte versionado
(`seed/contornos/malhas-2022.json.gz`, com as respostas inteiras e o sha256 de
cada uma) e gera `src/lib/eficiencia/contornos-capitais.json` só com o que a
página usa: caminho SVG simplificado, escala em km e área oficial.

Uso:
  python3 scripts/obee_contornos_capitais.py --acquire   # baixa e regrava o recorte
  python3 scripts/obee_contornos_capitais.py             # regera a saída a partir do recorte
  python3 scripts/obee_contornos_capitais.py --check     # confere sem escrever
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'pipeline/eficiencia_resultados/seed/contornos/malhas-2022.json.gz'
OUTPUT = ROOT / 'src/lib/eficiencia/contornos-capitais.json'
INDICE = ROOT / 'docs/obee/resultados/v4/indice-resultados-v4.json'
URL_MALHA = 'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{id}?formato=application/vnd.geo+json&qualidade=maxima&periodo=2022'
URL_META = 'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{id}/metadados'
CAIXA = 1000.0          # maior lado do desenho, em unidades do SVG
TOLERANCIA = 1.6        # Douglas-Peucker, em unidades do SVG (0,16% do maior lado)
AREA_MINIMA = 4.0       # partes menores que isto (unidades²) não aparecem no desenho
DISTANCIA_MAXIMA = 3.0  # partes além de 3 vezes o maior lado da parte principal ficam fora do enquadramento


def capitais():
    rows = json.loads(INDICE.read_text(encoding='utf-8'))['rows']
    return [(r['id'], r['name']) for r in rows]


def baixar(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        if r.status != 200:
            raise RuntimeError(f'{url}: HTTP {r.status}')
        corpo = r.read()
    # o endpoint de metadados responde comprimido mesmo sem pedido; o hash vale para o corpo descomprimido
    return gzip.decompress(corpo) if corpo[:2] == b'\x1f\x8b' else corpo


def adquirir():
    respostas = []
    for cid, nome in capitais():
        malha, meta = baixar(URL_MALHA.format(id=cid)), baixar(URL_META.format(id=cid))
        respostas.append({'id': cid, 'nome': nome,
                          'url_malha': URL_MALHA.format(id=cid), 'url_metadados': URL_META.format(id=cid),
                          'sha256_malha': hashlib.sha256(malha).hexdigest(),
                          'sha256_metadados': hashlib.sha256(meta).hexdigest(),
                          'malha': malha.decode('utf-8'), 'metadados': meta.decode('utf-8')})
        print(f'{nome}: {len(malha)} bytes', file=sys.stderr)
    recorte = {'fonte': 'IBGE, API de malhas territoriais v3, municípios, periodo=2022, qualidade=maxima',
               'capturado_em': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
               'respostas': respostas}
    SEED.parent.mkdir(parents=True, exist_ok=True)
    SEED.write_bytes(gzip.compress(json.dumps(recorte, ensure_ascii=False, indent=1).encode('utf-8'), mtime=0))


def area(anel):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(anel, anel[1:] + anel[:1]))) / 2


def douglas(pts, tol):
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    norma = math.hypot(dx, dy)
    pior, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + x1 * y0 - y1 * x0) / norma if norma else math.hypot(px - x0, py - y0)
        if d > pior:
            pior, idx = d, i
    if pior <= tol:
        return [pts[0], pts[-1]]
    return douglas(pts[:idx + 1], tol)[:-1] + douglas(pts[idx:], tol)


def simplificar(anel, tol):
    # fecha o anel em dois trechos para que o primeiro ponto não seja privilegiado
    meio = len(anel) // 2
    return douglas(anel[:meio + 1], tol)[:-1] + douglas(anel[meio:] + anel[:1], tol)[:-1]


def desenhar(resposta):
    geo = json.loads(resposta['malha'])
    meta = json.loads(resposta['metadados'])[0]
    feats = geo['features']
    if len(feats) != 1 or feats[0]['properties'].get('codarea') != resposta['id']:
        raise ValueError(f"{resposta['nome']}: malha não corresponde ao município")
    g = feats[0]['geometry']
    poligonos = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    lat0 = meta['centroide']['latitude']
    k = math.cos(math.radians(lat0))
    proj = [[[(lon * k, -lat) for lon, lat in anel[:-1]] for anel in poli] for poli in poligonos]
    # Enquadramento pela parte principal e pelas partes próximas a ela. Partes remotas, como as
    # ilhas oceânicas de Trindade e Martim Vaz em Vitória, achatariam o desenho: ficam fora e são contadas.
    caixa = lambda anel: (min(x for x, _ in anel), min(y for _, y in anel), max(x for x, _ in anel), max(y for _, y in anel))
    principal = caixa(max((poli[0] for poli in proj), key=area))
    lado = max(principal[2] - principal[0], principal[3] - principal[1])
    cx, cy = (principal[0] + principal[2]) / 2, (principal[1] + principal[3]) / 2
    def proxima(poli):
        b = caixa(poli[0])
        return math.hypot((b[0] + b[2]) / 2 - cx, (b[1] + b[3]) / 2 - cy) <= DISTANCIA_MAXIMA * lado
    perto = [poli for poli in proj if proxima(poli)]
    distantes = len(proj) - len(perto)
    xs = [x for poli in perto for anel in poli for x, _ in anel]
    ys = [y for poli in perto for anel in poli for _, y in anel]
    largura, altura = max(xs) - min(xs), max(ys) - min(ys)
    s = CAIXA / max(largura, altura)
    caminhos, desenhadas, pequenas = [], 0, 0
    for poli in perto:
        aneis = [[((x - min(xs)) * s, (y - min(ys)) * s) for x, y in anel] for anel in poli]
        if area(aneis[0]) < AREA_MINIMA:
            pequenas += 1
            continue
        desenhadas += 1
        for anel in aneis:
            simples = simplificar(anel, TOLERANCIA)
            if len(simples) < 3:
                continue
            caminhos.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in simples) + 'Z')
    return {'id': resposta['id'], 'nome': resposta['nome'],
            'largura': round(largura * s, 1), 'altura': round(altura * s, 1),
            'd': ''.join(caminhos),
            # um grau de latitude ≈ 111,32 km; o eixo y não foi deformado pela projeção
            'km_por_unidade': round(111.32 / s, 6),
            'area_km2': float(meta['area']['dimensao']),
            'partes_desenhadas': desenhadas,
            'partes_pequenas_omitidas': pequenas,
            'partes_distantes_omitidas': distantes,
            'sha256_malha': resposta['sha256_malha']}


def gerar():
    recorte = json.loads(gzip.decompress(SEED.read_bytes()))
    esperado = {cid for cid, _ in capitais()}
    obtidos = [r['id'] for r in recorte['respostas']]
    if set(obtidos) != esperado or len(obtidos) != 26:
        raise ValueError('O recorte não cobre exatamente as 26 capitais do índice')
    for r in recorte['respostas']:
        if hashlib.sha256(r['malha'].encode('utf-8')).hexdigest() != r['sha256_malha']:
            raise ValueError(f"{r['nome']}: hash da malha não confere")
        if hashlib.sha256(r['metadados'].encode('utf-8')).hexdigest() != r['sha256_metadados']:
            raise ValueError(f"{r['nome']}: hash dos metadados não confere")
    return {
        'fonte': 'IBGE · malha municipal de 2022 (API de malhas territoriais v3) e área territorial oficial',
        'fonte_url': 'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3',
        'capturado_em': recorte['capturado_em'],
        'tratamento': ('Projeção equirretangular centrada na latitude do município, simplificação de Douglas-Peucker '
                       f'com tolerância de {TOLERANCIA} em {int(CAIXA)} unidades. Ilhas muito pequenas para o desenho e partes '
                       'remotas (como Trindade e Martim Vaz, em Vitória) ficam fora e são contadas. A área exibida é a oficial do IBGE, não a do desenho.'),
        'sha256_recorte': hashlib.sha256(SEED.read_bytes()).hexdigest(),
        'capitais': [desenhar(r) for r in sorted(recorte['respostas'], key=lambda r: r['nome'])],
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--acquire', action='store_true', help='baixa as malhas e regrava o recorte')
    p.add_argument('--check', action='store_true', help='confere a saída sem escrever')
    a = p.parse_args(argv)
    if a.acquire:
        adquirir()
    texto = json.dumps(gerar(), ensure_ascii=False, separators=(',', ':')) + '\n'
    if a.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != texto:
            print('contornos-capitais.json desatualizado: rode python3 scripts/obee_contornos_capitais.py', file=sys.stderr)
            return 1
        print(json.dumps({'contornos': 'ok', 'capitais': 26}))
        return 0
    OUTPUT.write_text(texto, encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
