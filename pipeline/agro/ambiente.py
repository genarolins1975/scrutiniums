"""Pergunta 7 do Agro: desmatamento (INPE PRODES), emissões (SEEG) e uso da terra (MapBiomas).

Coleta e normalização. As sementes guardam só o recorte usado (Brasil, unidade da
federação somada, classes nacionais), com o sha256 e o tamanho do arquivo original.
"""
import hashlib
import io
import json
import re
import tempfile
import time
import urllib.request

from .run import numero

PRODES = 'https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files/'
PAINEL = 'https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/'
SEEG = 'https://api.plataforma.seeg.eco.br/graphql'
MAPBIOMAS_PAGINA = 'https://brasil.mapbiomas.org/estatisticas/'
BIOMAS = {'cerrado': 'Cerrado', 'mata_atlantica': 'Mata Atlântica', 'caatinga': 'Caatinga', 'pantanal': 'Pantanal', 'pampa': 'Pampa', 'amazon': 'Amazônia (bioma)'}
SETORES_SEEG = {'1': 'agropecuaria', '241': 'mudancaUsoTerra'}

FONTES = {
    'prodes': {'arquivo': 'prodes.json.gz', 'url': 'https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/legal_amazon/rates', 'nome': 'INPE, PRODES (TerraBrasilis)', 'licenca': 'CC BY-SA 4.0, conforme o painel do TerraBrasilis', 'limite': 'Corte raso da vegetação nativa, não degradação. Ano PRODES vai de agosto a julho. A taxa oficial existe só para a Amazônia Legal; nos demais biomas há o incremento mapeado, que não é taxa e tem períodos plurianuais no início da série.'},
    'seeg': {'arquivo': 'seeg.json.gz', 'url': 'https://plataforma.seeg.eco.br/', 'nome': 'SEEG, Observatório do Clima (plataforma, API pública)', 'licenca': 'Citação obrigatória: SEEG, Observatório do Clima; licença de redistribuição não explícita na fonte', 'limite': 'Estimativa da sociedade civil, não o inventário oficial do governo. Toneladas de CO2 equivalente, GWP-AR5. Mudança de uso da terra inclui desmatamento por qualquer causa, não só agropecuária.'},
    'mapbiomas': {'arquivo': 'mapbiomas.json.gz', 'url': MAPBIOMAS_PAGINA, 'nome': 'MapBiomas, Coleção de cobertura e uso da terra (estatísticas por bioma e estado)', 'licenca': 'CC BY 4.0, conforme a página de estatísticas', 'limite': 'Mapeamento por satélite com acurácia própria por classe. Agropecuária reúne pastagem, agricultura, silvicultura e mosaico de usos. Área em hectares.'},
}


def _bytes(url, corpo=None, cabecalhos=None, tentativas=4):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=corpo, headers={'User-Agent': 'Scrutiniums Agro/1.0; public data, bounded requests', **(cabecalhos or {})})
            with urllib.request.urlopen(req, timeout=180) as r:
                raw = r.read(60_000_001)
                if len(raw) > 60_000_000:
                    raise ValueError('Resposta acima do limite')
                return raw
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(4 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


def _so_uf(dados):
    """Mantém só as feições por unidade da federação (loi 1), que somam o bioma sem duplicar."""
    for periodo in dados['periods']:
        periodo['features'] = [f for f in periodo['features'] if f['loi'] == 1]
    return dados


def _coletar_prodes():
    painel = _bytes(PAINEL + 'biomes/legal_amazon/rates').decode('utf-8', 'ignore')
    app = re.search(r'src="(/app/dashboard/deforestation/app\.[0-9a-f]+\.js)"', painel)
    if not app:
        raise RuntimeError('Código do painel PRODES não encontrado')
    js = _bytes('https://terrabrasilis.dpi.inpe.br' + app.group(1)).decode('utf-8', 'ignore')
    preliminar = re.search(r'"BARCHART_PRELIMINARY_DATA_YEAR",\{get:function\(\)\{return"(\d{4})"', js)
    taxas = re.search(r'DASHBOARD_API_HOST\+"(rates\d{4}\.json)"', js)
    if not preliminar or not taxas:
        raise RuntimeError('Constantes do painel PRODES não encontradas')
    out = {'anoPreliminar': preliminar.group(1), 'arquivoTaxas': taxas.group(1), 'atualizado': json.loads(_bytes(PRODES + 'last_update_date.json'))['last_date'], 'originais': {}}
    raw = _bytes(PRODES + taxas.group(1))
    out['originais'][taxas.group(1)] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    out['taxasAmazoniaLegal'] = _so_uf(json.loads(raw))
    out['incrementos'] = {}
    for bioma in BIOMAS:
        nome = f'data/prodes_{bioma}.json'
        raw = _bytes(PRODES + nome)
        out['originais'][nome] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        out['incrementos'][bioma] = _so_uf(json.loads(raw))
    return out


def _coletar_seeg():
    consulta = 'query { emissionsSummary(territoriesIds:[1], sectorId:[1,241], gasId:[8], emissionTypeId:[%s], grouping: Sector, ranking: Sector, language: pt_BR){ data } }'
    out = {'url': SEEG, 'consultas': {}}
    for nome, tipo in [('emissao', 1), ('remocao', 300)]:
        corpo = json.dumps({'query': consulta % tipo}).encode()
        out['consultas'][nome] = {'corpo': consulta % tipo, 'resposta': json.loads(_bytes(SEEG, corpo, {'Content-Type': 'application/json'}))}
    versao = json.loads(_bytes(SEEG, json.dumps({'query': '{ collectionVersion }'}).encode(), {'Content-Type': 'application/json'}))
    out['versao'] = versao.get('data', {}).get('collectionVersion')
    return out


def _somar_classes(linhas):
    """Soma nacional por classe e ano a partir das linhas da aba de cobertura."""
    linhas = iter(linhas)
    cab = next(linhas)
    i0, i1, i2 = cab.index('class_level_0'), cab.index('class_level_1'), cab.index('class_level_2')
    anos = [(i, int(c[1:])) for i, c in enumerate(cab) if re.fullmatch(r'y\d{4}', c)]
    soma = {}
    for linha in linhas:
        # Linhas inteiramente em branco no fim da aba não são dado; já uma linha com
        # classe e uma célula anual vazia é lacuna, e lacuna não vira zero.
        if not any(c not in ('', None) for c in linha):
            continue
        if len(linha) <= i2:
            raise ValueError('Linha do MapBiomas sem classe')
        chave = (linha[i0], linha[i1], linha[i2])
        alvo = soma.setdefault(chave, {})
        for i, ano in anos:
            v = linha[i] if i < len(linha) else ''
            if v in ('', None):
                raise ValueError(f'MapBiomas com célula vazia: {chave[2]}, {ano}')
            alvo[ano] = alvo.get(ano, 0.0) + float(v)
    return soma


def _coletar_mapbiomas():
    from pipeline.gas import xlsx
    pagina = _bytes(MAPBIOMAS_PAGINA).decode('utf-8', 'ignore')
    links = sorted(set(re.findall(r'https://brasil\.mapbiomas\.org/wp-content/uploads/[^"\']*BIOME_STATE\.xlsx', pagina)))
    if not links:
        raise RuntimeError('Planilha de estatísticas do MapBiomas não encontrada')
    url = links[-1]
    raw = _bytes(url)
    with tempfile.NamedTemporaryFile(suffix='.xlsx') as t:
        t.write(raw)
        t.flush()
        aba = next(a for a in xlsx.abas(t.name) if a.startswith('COVERAGE_'))
        linhas = xlsx.linhas(t.name, aba)
        soma = _somar_classes(linhas)
    return {'url': url, 'aba': aba, 'sha256Original': hashlib.sha256(raw).hexdigest(), 'bytesOriginal': len(raw), 'classes': [{'nivel0': k[0], 'nivel1': k[1], 'nivel2': k[2], 'anos': {str(a): v for a, v in sorted(anos_v.items())}} for k, anos_v in sorted(soma.items())]}


def coletar():
    return {'prodes': _coletar_prodes(), 'seeg': _coletar_seeg(), 'mapbiomas': _coletar_mapbiomas()}


# ---------------------------------------------------------------- normalização

def _periodos(dados):
    out = []
    for p in dados['periods']:
        ini, fim = p['startDate'], p['endDate']
        km2 = sum(a['area'] for f in p['features'] for a in f['areas'] if a['type'] == 1)
        out.append({'inicio': ini['year'], 'fim': fim['year'], 'km2': km2})
    return out


def normalizar_prodes(bundle):
    preliminar = int(bundle['anoPreliminar'])
    taxas = _periodos(bundle['taxasAmazoniaLegal'])
    for t in taxas:
        if t['fim'] - t['inicio'] != 1:
            raise ValueError('Taxa PRODES fora do ano agosto a julho')
        t['estimada'] = t['fim'] >= preliminar
    anos = [t['fim'] for t in taxas]
    if anos != list(range(anos[0], anos[-1] + 1)) or len(anos) < 30:
        raise ValueError('Série da taxa PRODES com ano ausente')
    biomas = []
    for b, nome in BIOMAS.items():
        periodos = [p for p in _periodos(bundle['incrementos'][b]) if p['inicio'] >= 1990]
        for p in periodos:
            p['anual'] = p['fim'] - p['inicio'] == 1
            p['parcial'] = p['fim'] >= preliminar
        biomas.append({'id': b, 'nome': nome, 'periodos': periodos})
    return {'atualizado': bundle['atualizado'], 'anoPreliminar': preliminar, 'taxaAmazoniaLegal': taxas, 'biomas': biomas, 'fonte': 'prodes'}


def normalizar_seeg(bundle):
    anos = {}
    for tipo in ['emissao', 'remocao']:
        dados = bundle['consultas'][tipo]['resposta']['data']['emissionsSummary']['data']
        for setor in dados:
            nome = setor['name']
            chave = 'agropecuaria' if nome.startswith('Agropecu') else 'mudancaUsoTerra' if nome.startswith('Mudança') else None
            if chave is None:
                raise ValueError('Setor SEEG inesperado: ' + nome)
            for r in setor['data']:
                anos.setdefault(int(r['year']), {})[f"{chave}{'Remocao' if tipo == 'remocao' else ''}"] = numero(str(r['value']))
    linhas = [{'ano': a, **{k: anos[a].get(k) for k in ['agropecuaria', 'mudancaUsoTerra', 'mudancaUsoTerraRemocao']}} for a in sorted(anos)]
    if any(l['agropecuaria'] is None or l['mudancaUsoTerra'] is None for l in linhas):
        raise ValueError('SEEG sem emissão bruta em algum ano')
    if [l['ano'] for l in linhas] != list(range(linhas[0]['ano'], linhas[-1]['ano'] + 1)):
        raise ValueError('Série SEEG com ano ausente')
    return {'versao': bundle.get('versao'), 'unidade': 't CO2e (GWP-AR5)', 'anos': linhas, 'fonte': 'seeg'}


def normalizar_mapbiomas(bundle):
    classes = bundle['classes']
    anos = sorted({int(a) for c in classes for a in c['anos']})
    for c in classes:
        if sorted(int(a) for a in c['anos']) != anos or any(v is None for v in c['anos'].values()):
            raise ValueError('MapBiomas com ano ausente na classe ' + c['nivel2'])
    def soma(filtro, ano):
        return sum(c['anos'].get(str(ano), 0.0) for c in classes if filtro(c))
    linhas = []
    for a in anos:
        linha = {'ano': a,
                 'pastagem': soma(lambda c: c['nivel2'].startswith('3.1.'), a),
                 'agricultura': soma(lambda c: c['nivel2'].startswith('3.2.'), a),
                 'silvicultura': soma(lambda c: c['nivel2'].startswith('3.3.'), a),
                 'mosaico': soma(lambda c: c['nivel2'].startswith('3.4.'), a),
                 'vegetacaoNativa': soma(lambda c: c['nivel0'] == 'Natural' and (c['nivel1'].startswith('1.') or c['nivel1'].startswith('2.')), a),
                 'total': soma(lambda c: True, a)}
        linha['agropecuaria'] = linha['pastagem'] + linha['agricultura'] + linha['silvicultura'] + linha['mosaico']
        # O território brasileiro tem cerca de 851 milhões de hectares; fora disso, a unidade mudou.
        if not 8.0e8 < linha['total'] < 9.0e8:
            raise ValueError(f'Área total do MapBiomas fora do território em {a}')
        linhas.append(linha)
    return {'url': bundle['url'], 'anos': linhas, 'unidade': 'ha', 'fonte': 'mapbiomas'}


def normalizar(coletas):
    return {'ambiente': {'prodes': normalizar_prodes(coletas['prodes']), 'emissoes': normalizar_seeg(coletas['seeg']), 'usoTerra': normalizar_mapbiomas(coletas['mapbiomas'])}}
