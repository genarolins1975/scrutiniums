"""Economia do agro observada: IBGE (Contas Nacionais Trimestrais e LSPA) e Comex Stat.

python3 -m pipeline.agro.economia --coleta    coleta oficial, valida e grava as sementes
python3 -m pipeline.agro.run                  reconstrói a gold a partir das sementes

A gold é sempre derivada das sementes versionadas em pipeline/agro/seed. A coleta só
grava depois de normalizar e validar todos os recortes; uma resposta idêntica à já
integrada não altera o manifesto, para o pipeline automático não gerar commit vazio.
"""
import argparse
import gzip
import hashlib
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from . import ambiente, apoio, producao, sociedade
from .run import ROOT, SEED, numero

MANIFESTO = 'coletas.json'
SIDRA = 'https://servicodados.ibge.gov.br/api/v3/agregados'
COMEX = 'https://api-comexstat.mdic.gov.br/general'
INICIO_COMEX = 2010

# Recorte agro por capítulo do Sistema Harmonizado: seções I a IV (capítulos 01 a 24:
# animais, vegetais, gorduras, alimentos, bebidas e fumo), peles e couros (41),
# madeira (44), celulose (47) e fibras têxteis naturais (50 a 53). Aproxima, mas não
# reproduz, a lista de NCM do Agrostat/MAPA.
CAPITULOS_AGRO = [f'{i:02d}' for i in range(1, 25)] + ['41', '44', '47', '50', '51', '52', '53']
FERTILIZANTES = {'3101': 'Adubos de origem animal ou vegetal', '3102': 'Nitrogenados', '3103': 'Fosfatados', '3104': 'Potássicos', '3105': 'Compostos e misturas (NPK, MAP, DAP)'}
DEFENSIVOS = '3808'
SOJA = '12019000'
# A NCM 12019000 existe desde 2012; antes a soja em grão tinha outro código.
INICIO_SOJA = 2012

SETORES = {'90687': 'agro', '90691': 'industria', '90696': 'servicos', '90705': 'va', '90707': 'pib'}
TAXAS = {'6561': 'trimestral', '6562': 'acumulado4', '6563': 'acumuladoAno'}
PRODUTOS_LSPA = {
    '39428': ('graos', 'Cereais, leguminosas e oleaginosas'),
    '39443': ('soja', 'Soja'),
    '39441': ('milho1', 'Milho, 1ª safra'),
    '39442': ('milho2', 'Milho, 2ª safra'),
    '39432': ('arroz', 'Arroz'),
    '39436': ('feijao1', 'Feijão, 1ª safra'),
    '39437': ('feijao2', 'Feijão, 2ª safra'),
    '39438': ('feijao3', 'Feijão, 3ª safra'),
    '39445': ('trigo', 'Trigo'),
    '39429': ('algodao', 'Algodão herbáceo'),
    '39456': ('cana', 'Cana-de-açúcar'),
}
VARIAVEIS_LSPA = {'35': 'producao', '216': 'area', '36': 'rendimento'}
ANOS_LSPA = 10

FONTES = {
    'cnt': {'arquivo': 'cnt.json.gz', 'url': 'https://sidra.ibge.gov.br/tabela/1846', 'nome': 'IBGE, Contas Nacionais Trimestrais (SIDRA 1846 e 5932)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Agropecuária no sentido das Contas Nacionais: produção dentro da porteira, com pesca e produção florestal. Não inclui insumos, agroindústria e serviços do agronegócio ampliado. Valores correntes; taxas de crescimento em volume.'},
    'lspa': {'arquivo': 'lspa.json.gz', 'url': 'https://sidra.ibge.gov.br/tabela/6588', 'nome': 'IBGE, Levantamento Sistemático da Produção Agrícola (SIDRA 6588)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Estimativa mensal da safra do ano, revista a cada mês e depois substituída pela PAM. Anos anteriores usam a estimativa de dezembro. Brasil, sem recorte por UF nesta coleta.'},
    **sociedade.FONTES,
    **apoio.FONTES,
    **ambiente.FONTES,
    **producao.FONTES,
    'comex': {'arquivo': 'comex.json.gz', 'url': 'https://comexstat.mdic.gov.br/', 'nome': 'MDIC, Comex Stat (exportação e importação por capítulo, posição, NCM e país)', 'licenca': 'Dados abertos do governo federal; citar a fonte', 'limite': 'Valores FOB em US$ correntes e massa líquida em kg. O recorte agro por capítulo SH não é o Agrostat/MAPA. Valor unitário de comércio não é preço pago ou recebido na fazenda.'},
}


def _baixar(url, corpo=None, tentativas=5):
    ultimo = None
    for i in range(tentativas):
        try:
            headers = {'User-Agent': 'Scrutiniums Agro/1.0; public data, bounded requests'}
            if corpo is not None:
                headers['Content-Type'] = 'application/json'
            req = urllib.request.Request(url, data=None if corpo is None else json.dumps(corpo).encode(), headers=headers)
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read(30_000_001)
                if len(raw) > 30_000_000:
                    raise ValueError('Resposta acima do limite; reduza o recorte')
                # O IBGE às vezes responde comprimido mesmo sem o pedido explícito.
                if raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
                return json.loads(raw)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            ultimo = e
            # Comex Stat limita a frequência de consultas: a espera cresce a cada tentativa.
            time.sleep(12 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


def _comex(corpo):
    time.sleep(11)
    resposta = _baixar(COMEX, corpo)
    if not resposta.get('success') or 'data' not in resposta:
        raise ValueError('Comex Stat sem dados: ' + json.dumps(resposta)[:200])
    return resposta['data']['list']


def _consulta_comex(fluxo, inicio, fim, detalhes, filtros=None, mensal=True):
    return {'flow': fluxo, 'monthDetail': mensal, 'period': {'from': inicio, 'to': fim}, 'filters': filtros or [], 'details': detalhes, 'metrics': ['metricFOB', 'metricKG']}


def coletar_bundles():
    """Baixa todos os recortes; não grava nada."""
    atualizado = _baixar(COMEX + '/dates/updated')['data']
    ano, mes = int(atualizado['year']), int(atualizado['monthNumber'])
    fim = f'{ano}-{mes:02d}'
    anterior = ano - 1 if mes < 12 else ano
    # Com monthDetail, o Comex Stat aplica o intervalo de meses do período a cada ano
    # (2010-01 a 2026-09 devolve só janeiro a setembro de cada ano). Por isso: séries
    # anuais só com anos fechados, acumulados do ano em consulta própria e meses ano a ano.
    acumulado = (f'{ano - 1}-01', fim)
    consultas = {
        'capitulosAnual': _consulta_comex('export', f'{INICIO_COMEX}-01', f'{anterior}-12', ['chapter'], mensal=False),
        'capitulosAcumulado': _consulta_comex('export', *acumulado, ['chapter'], mensal=False),
        'capitulosMensalAnterior': _consulta_comex('export', f'{ano - 1}-01', f'{ano - 1}-12', ['chapter']),
        'capitulosMensalAtual': _consulta_comex('export', f'{ano}-01', fim, ['chapter']),
        'destinosAgro': _consulta_comex('export', f'{anterior}-01', f'{anterior}-12', ['country'], [{'filter': 'chapter', 'values': CAPITULOS_AGRO}], mensal=False),
        'sojaAnual': _consulta_comex('export', f'{INICIO_COMEX}-01', f'{anterior}-12', ['ncm'], [{'filter': 'ncm', 'values': [SOJA]}], mensal=False),
        'sojaAcumulado': _consulta_comex('export', *acumulado, ['ncm'], [{'filter': 'ncm', 'values': [SOJA]}], mensal=False),
        'destinosSoja': _consulta_comex('export', f'{anterior}-01', f'{anterior}-12', ['country'], [{'filter': 'ncm', 'values': [SOJA]}], mensal=False),
        'insumosAnual': _consulta_comex('import', f'{INICIO_COMEX}-01', f'{anterior}-12', ['heading'], [{'filter': 'heading', 'values': [*FERTILIZANTES, DEFENSIVOS]}], mensal=False),
        'insumosAcumulado': _consulta_comex('import', *acumulado, ['heading'], [{'filter': 'heading', 'values': [*FERTILIZANTES, DEFENSIVOS]}], mensal=False),
        'origensFertilizantes': _consulta_comex('import', f'{anterior}-01', f'{anterior}-12', ['country'], [{'filter': 'chapter', 'values': ['31']}], mensal=False),
    }
    comex = {'atualizadoNaFonte': atualizado, 'consultas': {k: {'url': COMEX, 'corpo': c, 'resposta': _comex(c)} for k, c in consultas.items()}}

    def sidra(path):
        return {'url': SIDRA + path, 'resposta': _baixar(SIDRA + path)}
    setores = ','.join(SETORES)
    cnt = {'consultas': {
        'valores': sidra(f'/1846/periodos/199601-209904/variaveis/585?localidades=N1[all]&classificacao=11255[{setores}]'),
        'taxas': sidra(f'/5932/periodos/199601-209904/variaveis/{"|".join(TAXAS)}?localidades=N1[all]&classificacao=11255[90687,90691,90696,90707]'),
    }}
    periodos = [p['id'] for p in _baixar(SIDRA + '/6588/periodos')]
    ultimo = max(periodos)
    escolhidos = sorted({ultimo, *[f'{a}12' for a in range(int(ultimo[:4]) - ANOS_LSPA, int(ultimo[:4])) if f'{a}12' in periodos]})
    lspa = {'ultimoPeriodo': ultimo, 'consultas': {'safra': sidra(f'/6588/periodos/{"|".join(escolhidos)}/variaveis/{"|".join(VARIAVEIS_LSPA)}?localidades=N1[all]&classificacao=48[{",".join(PRODUTOS_LSPA)}]')}}
    return {'cnt': cnt, 'lspa': lspa, 'comex': comex, **sociedade.coletar(_baixar), **apoio.coletar(), **ambiente.coletar(), **producao.coletar(_baixar, _comex, _consulta_comex, atualizado)}


# ---------------------------------------------------------------- normalização

def _sidra_linhas(resposta, chave_classificacao):
    """[(variavel, categoria, periodo, valor bruto)] de uma resposta v3 do SIDRA."""
    linhas = []
    for variavel in resposta:
        for resultado in variavel['resultados']:
            cats = [c for c in resultado['classificacoes'] if str(c['id']) == chave_classificacao]
            if len(cats) != 1 or len(cats[0]['categoria']) != 1:
                raise ValueError('Classificação SIDRA inesperada')
            categoria = next(iter(cats[0]['categoria']))
            for serie in resultado['series']:
                if str(serie['localidade']['id']) != '1':
                    raise ValueError('Território fora do Brasil')
                for periodo, valor in serie['serie'].items():
                    linhas.append((str(variavel['id']), categoria, periodo, valor))
    chaves = [l[:3] for l in linhas]
    if len(chaves) != len(set(chaves)):
        raise ValueError('Chave duplicada na resposta SIDRA')
    return linhas


def _trimestre(p):
    return f'{p[:4]}-T{int(p[4:])}'


def normalizar_cnt(bundle):
    valores = {}
    for var, cat, periodo, bruto in _sidra_linhas(bundle['consultas']['valores']['resposta'], '11255'):
        if var != '585' or cat not in SETORES:
            raise ValueError('Variável ou setor inesperado em 1846')
        valores.setdefault(periodo, {})[SETORES[cat]] = numero(bruto)
    trimestres = []
    for p in sorted(valores):
        v = valores[p]
        if any(v.get(k) is None for k in SETORES.values()):
            continue
        # Os três setores somam o valor adicionado a preços básicos; tolera só arredondamento.
        if abs(v['agro'] + v['industria'] + v['servicos'] - v['va']) > max(10, v['va'] * 1e-4):
            raise ValueError('Setores não reconciliam com o valor adicionado em ' + p)
        trimestres.append({'periodo': _trimestre(p), **{k: v[k] for k in ['agro', 'industria', 'servicos', 'va', 'pib']}})
    if len(trimestres) < 40:
        raise ValueError('Série trimestral curta demais')
    anual = []
    for ano in sorted({t['periodo'][:4] for t in trimestres}):
        q = [t for t in trimestres if t['periodo'][:4] == ano]
        if len(q) == 4:
            soma = {k: sum(t[k] for t in q) for k in ['agro', 'industria', 'servicos', 'va', 'pib']}
            anual.append({'ano': int(ano), **soma, 'participacaoVa': 100 * soma['agro'] / soma['va'], 'participacaoPib': 100 * soma['agro'] / soma['pib']})
    ult = trimestres[-4:]
    for a, b in zip(ult, ult[1:]):
        ya, qa = int(a['periodo'][:4]), int(a['periodo'][-1])
        if (int(b['periodo'][:4]), int(b['periodo'][-1])) != ((ya, qa + 1) if qa < 4 else (ya + 1, 1)):
            raise ValueError('Últimos quatro trimestres não são consecutivos')
    soma = {k: sum(t[k] for t in ult) for k in ['agro', 'va', 'pib']}
    taxas = {}
    for var, cat, periodo, bruto in _sidra_linhas(bundle['consultas']['taxas']['resposta'], '11255'):
        if var not in TAXAS or cat not in ('90687', '90691', '90696', '90707'):
            raise ValueError('Taxa inesperada em 5932')
        taxas.setdefault(TAXAS[var], {}).setdefault(periodo, {})[SETORES[cat]] = numero(bruto)
    crescimento = {
        nome: [{'periodo': _trimestre(p), **{k: serie[p].get(k) for k in ['agro', 'industria', 'servicos', 'pib']}} for p in sorted(serie)]
        for nome, serie in taxas.items()
    }
    crescimento['anual'] = [{'ano': int(r['periodo'][:4]), **{k: r[k] for k in ['agro', 'industria', 'servicos', 'pib']}} for r in crescimento['acumuladoAno'] if r['periodo'].endswith('T4')]
    ultimo = crescimento['acumulado4'][-1]
    if ultimo['periodo'] != ult[-1]['periodo']:
        raise ValueError('Taxas e valores terminam em trimestres diferentes')
    return {
        'unidade': 'R$ milhões correntes',
        'trimestres': trimestres,
        'anual': anual,
        'ultimos4': {'inicio': ult[0]['periodo'], 'fim': ult[-1]['periodo'], **soma, 'participacaoVa': 100 * soma['agro'] / soma['va'], 'participacaoPib': 100 * soma['agro'] / soma['pib']},
        'crescimento': crescimento,
        'fonte': 'cnt',
    }


def normalizar_lspa(bundle):
    ultimo = bundle['ultimoPeriodo']
    obs = {}
    for var, cat, periodo, bruto in _sidra_linhas(bundle['consultas']['safra']['resposta'], '48'):
        if var not in VARIAVEIS_LSPA or cat not in PRODUTOS_LSPA:
            raise ValueError('Variável ou produto inesperado em 6588')
        obs.setdefault(PRODUTOS_LSPA[cat][0], {}).setdefault(periodo, {})[VARIAVEIS_LSPA[var]] = numero(bruto)
    produtos = []
    for cat, (pid, nome) in PRODUTOS_LSPA.items():
        anos = []
        for periodo in sorted(obs.get(pid, {})):
            v = obs[pid][periodo]
            rendimento = v.get('rendimento')
            # No agregado de grãos o SIDRA publica "-" no rendimento: com produção positiva,
            # não é zero absoluto, é medida não calculada para um conjunto de culturas.
            if rendimento == 0 and (v.get('producao') or 0) > 0:
                rendimento = None
            anos.append({'ano': int(periodo[:4]), 'mesEstimativa': periodo[:4] + '-' + periodo[4:], 'producao': v.get('producao'), 'area': v.get('area'), 'rendimento': rendimento})
        if not anos or anos[-1]['mesEstimativa'] != ultimo[:4] + '-' + ultimo[4:]:
            raise ValueError('Produto sem estimativa do último mês: ' + pid)
        produtos.append({'id': pid, 'nome': nome, 'anos': anos})
    porId = {p['id']: p for p in produtos}
    # Milho e feijão: somar a produção das safras é válido (mesma massa do mesmo produto);
    # somar as áreas contaria a mesma terra duas vezes, então área e rendimento ficam por safra.
    for total, partes, nome in [('milho', ['milho1', 'milho2'], 'Milho, total das safras'), ('feijao', ['feijao1', 'feijao2', 'feijao3'], 'Feijão, total das safras')]:
        anos = []
        for linha in porId[partes[0]]['anos']:
            valores = [next((a['producao'] for a in porId[p]['anos'] if a['mesEstimativa'] == linha['mesEstimativa']), None) for p in partes]
            anos.append({'ano': linha['ano'], 'mesEstimativa': linha['mesEstimativa'], 'producao': None if None in valores else sum(valores), 'area': None, 'rendimento': None})
        produtos.append({'id': total, 'nome': nome, 'anos': anos, 'somaDeSafras': partes})
    graos = porId['graos']['anos']
    if graos[-1]['producao'] is None or graos[-1]['producao'] <= 0:
        raise ValueError('Safra de grãos sem produção no último mês')
    return {'mesReferencia': ultimo[:4] + '-' + ultimo[4:], 'anoSafra': int(ultimo[:4]), 'unidades': {'producao': 't', 'area': 'ha', 'rendimento': 'kg/ha'}, 'produtos': produtos, 'fonte': 'lspa'}


def _f(v):
    n = numero(v)
    if n is None or n < 0:
        raise ValueError('Valor de comércio inválido: ' + str(v))
    return n


def _indexar(linhas, chave, mensal=False):
    """{(ano, mês ou 0, código): (FOB, kg, nome)}, recusando duplicatas."""
    out = {}
    for r in linhas:
        k = (int(r['year']), int(r['monthNumber']) if mensal else 0, r[chave])
        if k in out:
            raise ValueError('Linha duplicada no Comex Stat')
        nome = next((r[n] for n in ('chapter', 'heading', 'ncm') if n in r), '')
        out[k] = (_f(r['metricFOB']), _f(r['metricKG']), nome)
    return out


def _soma(dados, filtro):
    sel = [v for k, v in dados.items() if filtro(k)]
    fob, kg = sum(v[0] for v in sel), sum(v[1] for v in sel)
    return fob, kg, (1000 * fob / kg if kg > 0 else None)


def _paises(linhas, ano):
    if any(int(r['year']) != ano for r in linhas):
        raise ValueError('Ano inesperado no recorte por país')
    nomes = [r['country'] for r in linhas]
    if len(nomes) != len(set(nomes)):
        raise ValueError('País duplicado no recorte')
    total = sum(_f(r['metricFOB']) for r in linhas)
    paises = sorted(({'pais': r['country'], 'fob': _f(r['metricFOB']), 'kg': _f(r['metricKG']), 'participacao': 100 * _f(r['metricFOB']) / total} for r in linhas), key=lambda r: (-r['fob'], r['pais']))
    return {'ano': ano, 'fob': total, 'kg': sum(p['kg'] for p in paises), 'paises': paises}


def normalizar_comex(bundle):
    q = {k: v['resposta'] for k, v in bundle['consultas'].items()}
    atual = bundle['atualizadoNaFonte']
    ano, mes = int(atual['year']), int(atual['monthNumber'])
    completo = ano if mes == 12 else ano - 1
    agro = lambda c: c in CAPITULOS_AGRO

    # Exportações por ano fechado e capítulo.
    anual = _indexar(q['capitulosAnual'], 'chapterCode')
    anos = sorted({k[0] for k in anual})
    if anos != list(range(INICIO_COMEX, completo + 1)):
        raise ValueError('Série anual de exportações incompleta')
    serie = []
    for a in anos:
        total = _soma(anual, lambda k: k[0] == a)[0]
        fob, kg, _ = _soma(anual, lambda k: k[0] == a and agro(k[2]))
        serie.append({'ano': a, 'total': total, 'agro': fob, 'agroKg': kg, 'participacao': 100 * fob / total})
    composicao = sorted(({'capitulo': k[2], 'nome': v[2], 'fob': v[0], 'kg': v[1]} for k, v in anual.items() if k[0] == completo and agro(k[2])), key=lambda r: (-r['fob'], r['capitulo']))

    # Meses do ano anterior e do ano corrente, consultados ano a ano.
    mensal = {**_indexar(q['capitulosMensalAnterior'], 'chapterCode', True), **_indexar(q['capitulosMensalAtual'], 'chapterCode', True)}
    meses = []
    for a, ultimo in ((ano - 1, 12), (ano, mes)):
        if {k[1] for k in mensal if k[0] == a} != set(range(1, ultimo + 1)):
            raise ValueError(f'Meses incompletos nas exportações de {a}')
        for m in range(1, ultimo + 1):
            meses.append({'mes': f'{a}-{m:02d}', 'total': _soma(mensal, lambda k: k[:2] == (a, m))[0], 'agro': _soma(mensal, lambda k: k[:2] == (a, m) and agro(k[2]))[0]})
    if ano - 1 == completo:
        soma = sum(r['total'] for r in meses if r['mes'].startswith(str(completo)))
        if abs(soma - serie[-1]['total']) > 1e-6 * soma + 1:
            raise ValueError('Consultas mensal e anual de exportações divergem')

    # Acumulado do ano contra o mesmo período do ano anterior.
    acumulado = _indexar(q['capitulosAcumulado'], 'chapterCode')
    if {k[0] for k in acumulado} != {ano - 1, ano}:
        raise ValueError('Acumulado sem os dois anos comparados')
    soma_atual = sum(r['total'] for r in meses if r['mes'].startswith(str(ano)))
    if abs(soma_atual - _soma(acumulado, lambda k: k[0] == ano)[0]) > 1e-6 * soma_atual + 1:
        raise ValueError('Acumulado do ano diverge da soma dos meses')
    acum = {'ano': ano, 'meses': mes, 'agro': _soma(acumulado, lambda k: k[0] == ano and agro(k[2]))[0], 'agroAnterior': _soma(acumulado, lambda k: k[0] == ano - 1 and agro(k[2]))[0], 'total': _soma(acumulado, lambda k: k[0] == ano)[0], 'totalAnterior': _soma(acumulado, lambda k: k[0] == ano - 1)[0]}
    acum['variacaoAgro'] = 100 * (acum['agro'] / acum['agroAnterior'] - 1) if acum['agroAnterior'] > 0 else None
    acum['participacao'] = 100 * acum['agro'] / acum['total'] if acum['total'] > 0 else None

    def serie_produto(anual_q, acum_q, chave, codigos, inicio=INICIO_COMEX):
        """Anos fechados mais o ano corrente parcial, e o mesmo período dos dois anos."""
        fechado, parcial = _indexar(anual_q, chave), _indexar(acum_q, chave)
        if sorted({k[0] for k in fechado}) != list(range(inicio, completo + 1)):
            raise ValueError('Série anual de comércio incompleta: ' + ','.join(codigos))
        linhas = []
        for a in range(inicio, completo + 1):
            fob, kg, vu = _soma(fechado, lambda k: k[0] == a and k[2] in codigos)
            linhas.append({'ano': a, 'meses': 12, 'fob': fob, 'kg': kg, 'valorUnitario': vu})
        mesmo = []
        for a in (ano - 1, ano):
            fob, kg, vu = _soma(parcial, lambda k: k[0] == a and k[2] in codigos)
            mesmo.append({'ano': a, 'meses': mes, 'fob': fob, 'kg': kg, 'valorUnitario': vu})
        if completo < ano:
            linhas.append(mesmo[-1])
        return linhas, mesmo

    soja, soja_mesmo = serie_produto(q['sojaAnual'], q['sojaAcumulado'], 'coNcm', {SOJA}, INICIO_SOJA)
    fert, fert_mesmo = serie_produto(q['insumosAnual'], q['insumosAcumulado'], 'headingCode', set(FERTILIZANTES))
    defensivos, def_mesmo = serie_produto(q['insumosAnual'], q['insumosAcumulado'], 'headingCode', {DEFENSIVOS})
    posicoes = [{'posicao': p, 'nome': n, 'anos': serie_produto(q['insumosAnual'], q['insumosAcumulado'], 'headingCode', {p})[0]} for p, n in FERTILIZANTES.items()]
    razao = lambda f, s: f['valorUnitario'] / s['valorUnitario'] if f['valorUnitario'] and s['valorUnitario'] else None
    fert_por_ano = {f['ano']: f for f in fert}
    troca = [{'ano': s['ano'], 'meses': s['meses'], 'soja': s['valorUnitario'], 'fertilizantes': fert_por_ano[s['ano']]['valorUnitario'], 'relacao': razao(fert_por_ano[s['ano']], s)} for s in soja]
    mesmo = {'soja': soja_mesmo, 'fertilizantes': fert_mesmo, 'defensivos': def_mesmo, 'relacao': [razao(f, s) for s, f in zip(soja_mesmo, fert_mesmo)]}
    return {
        'atualizadoNaFonte': atual['updated'], 'ultimoMes': f'{ano}-{mes:02d}', 'anoCompleto': completo,
        'capitulosAgro': CAPITULOS_AGRO,
        'definicaoAgro': 'Capítulos 01 a 24 do Sistema Harmonizado (animais, vegetais, gorduras, alimentos, bebidas e fumo), 41 (peles e couros), 44 (madeira), 47 (celulose) e 50 a 53 (fibras naturais). Recorte por capítulo, não é a lista do Agrostat/MAPA.',
        'exportacoes': {'anual': serie, 'composicao': composicao, 'mensal': meses, 'acumulado': acum, 'destinos': _paises(q['destinosAgro'], completo)},
        'soja': {'ncm': SOJA, 'anual': soja, 'destinos': _paises(q['destinosSoja'], completo)},
        'insumos': {'fertilizantes': fert, 'defensivos': defensivos, 'posicoes': posicoes, 'origensFertilizantes': _paises(q['origensFertilizantes'], completo), 'mesmoPeriodo': mesmo},
        'relacaoTroca': troca,
        'fonte': 'comex',
    }


def normalizar(coletas):
    return {'pib': normalizar_cnt(coletas['cnt']), 'safra': normalizar_lspa(coletas['lspa']), 'comercio': normalizar_comex(coletas['comex']), **sociedade.normalizar(coletas), **apoio.normalizar(coletas), **ambiente.normalizar(coletas), **producao.normalizar(coletas)}


# ---------------------------------------------------------------- sementes

def _bytes(bundle):
    return (json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def carregar(seed=SEED):
    """Manifesto e conteúdo das coletas, com hashes conferidos. Sem manifesto, nada."""
    caminho = seed / MANIFESTO
    if not caminho.exists():
        return None, {}
    manifesto = json.loads(caminho.read_text())
    conteudo = {}
    for f in manifesto['fontes']:
        raw = (seed / f['arquivo']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != f['sha256Arquivo']:
            raise ValueError('Arquivo fonte alterado: ' + f['id'])
        original = gzip.decompress(raw)
        if hashlib.sha256(original).hexdigest() != f['sha256Original']:
            raise ValueError('Original divergente: ' + f['id'])
        conteudo[f['id']] = json.loads(original)
    return manifesto, conteudo


def gravar(bundles, seed=SEED, agora=None):
    """Valida tudo antes de gravar; resposta idêntica mantém a data de captura anterior."""
    normalizar(bundles)
    anterior, _ = carregar(seed)
    antigas = {f['id']: f for f in (anterior or {'fontes': []})['fontes']}
    agora = agora or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    fontes, arquivos = [], {}
    for fid, meta in FONTES.items():
        original = _bytes(bundles[fid])
        sha = hashlib.sha256(original).hexdigest()
        if fid in antigas and antigas[fid]['sha256Original'] == sha:
            fontes.append(antigas[fid])
            continue
        comprimido = gzip.compress(original, mtime=0)
        arquivos[meta['arquivo']] = comprimido
        fontes.append({'id': fid, **meta, 'arquivoRepositorio': 'pipeline/agro/seed/' + meta['arquivo'], 'commitRepositorio': '', 'sha256Original': sha, 'sha256Arquivo': hashlib.sha256(comprimido).hexdigest(), 'estadoAcesso': 'COLETA_OFICIAL', 'capturadoEm': agora})
    for nome, raw in arquivos.items():
        (seed / (nome + '.tmp')).write_bytes(raw)
    for nome in arquivos:
        (seed / (nome + '.tmp')).replace(seed / nome)
    texto = json.dumps({'versao': 1, 'nota': 'Coletas oficiais da economia do agro. Cada arquivo guarda as consultas e as respostas integrais; a gold é derivada só destas sementes.', 'fontes': fontes}, ensure_ascii=False, indent=2) + '\n'
    (seed / (MANIFESTO + '.tmp')).write_text(texto)
    (seed / (MANIFESTO + '.tmp')).replace(seed / MANIFESTO)
    return {'atualizadas': sorted(arquivos), 'mantidas': sorted(set(FONTES) - {f['id'] for f in fontes if f['arquivo'] in arquivos})}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--coleta', action='store_true', help='Consulta as fontes oficiais e grava as sementes validadas')
    args = p.parse_args()
    if args.coleta:
        print(json.dumps(gravar(coletar_bundles()), ensure_ascii=False))
    else:
        _, conteudo = carregar()
        e = normalizar(conteudo)
        print(json.dumps({'pib': e['pib']['ultimos4']['fim'], 'safra': e['safra']['mesReferencia'], 'comercio': e['comercio']['ultimoMes']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
