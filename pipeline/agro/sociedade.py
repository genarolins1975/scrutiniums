"""Perguntas 5 a 8 do Agro: quem produz e trabalha, apoio público, ambiente e comida no prato.

Coleta e normalização das fontes desta fase. A gravação das sementes, os hashes e o
manifesto são os mesmos da economia (pipeline/agro/economia.py, `gravar`).
"""
import urllib.parse

from .run import numero

SIDRA = 'https://servicodados.ibge.gov.br/api/v3/agregados'

TIPOLOGIA = {'46302': 'total', '46303': 'naoFamiliar', '46304': 'familiar'}
GRUPOS_AREA = '220'
GRUPAMENTO_AGRO = '47947'
GRUPAMENTO_TOTAL = '47946'
IPCA_GRUPOS = {'7169': 'Índice geral', '7170': 'Alimentação e bebidas', '7171': 'Alimentação no domicílio', '7432': 'Alimentação fora do domicílio'}
IPCA_ITENS = {'7173': 'Arroz', '12222': 'Feijão-carioca', '7176': 'Feijão-preto', '7283': 'Carnes', '107617': 'Frango inteiro', '7355': 'Ovo de galinha', '12393': 'Leite longa vida', '7385': 'Óleo de soja', '7392': 'Café moído', '7375': 'Pão francês', '7220': 'Açúcar refinado', '7212': 'Tomate', '7202': 'Batata-inglesa'}

FONTES = {
    'censoagro': {'arquivo': 'censoagro.json.gz', 'url': 'https://sidra.ibge.gov.br/pesquisa/censo-agropecuario/censo-agropecuario-2017', 'nome': 'IBGE, Censo Agropecuário 2017 (SIDRA 6754, 6884 e 6898)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Retrato de 2017 (referência de outubro de 2016 a setembro de 2017). Estabelecimento não é produtor nem empresa. Agricultura familiar segue a Lei 11.326/2006 e o Decreto 9.064/2017.'},
    'pnadc': {'arquivo': 'pnadc.json.gz', 'url': 'https://sidra.ibge.gov.br/tabela/5434', 'nome': 'IBGE, PNAD Contínua trimestral (SIDRA 5434 e 5442)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Pessoas ocupadas no grupamento agricultura, pecuária, produção florestal, pesca e aquicultura, pelo trabalho principal. Rendimento habitual real do trabalho principal, a preços do último trimestre. Estimativa amostral.'},
    'ipca': {'arquivo': 'ipca.json.gz', 'url': 'https://sidra.ibge.gov.br/tabela/7060', 'nome': 'IBGE, IPCA (SIDRA 1419 e 7060)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Preços ao consumidor das famílias com renda de 1 a 40 salários mínimos, em 16 áreas urbanas. Mede o que a família paga, não o preço recebido pelo produtor.'},
}


def _url(tabela, periodos, variaveis, classificacao):
    q = urllib.parse.urlencode({'localidades': 'N1[all]', 'classificacao': classificacao}, safe='[],|')
    return f'{SIDRA}/{tabela}/periodos/{periodos}/variaveis/{variaveis}?{q}'


def coletar(baixar):
    """Baixa os recortes do IBGE desta fase; não grava nada."""
    def sidra(url):
        return {'url': url, 'resposta': baixar(url)}
    censo = {'consultas': {
        'estabelecimentos': sidra(_url(6754, '2017', '183|184', '829[46302,46303,46304]|221[111195]|12517[113601]|220[all]')),
        'pessoal': sidra(_url(6884, '2017', '185', '829[46302,46303,46304]|2[6794]|223[46571]|218[46502]|12517[113601]')),
        'valor': sidra(_url(6898, '2017', '40|1999', '829[46302,46303,46304]|12547[114017]|12894[46569]|220[110085]')),
    }}
    pnadc = {'consultas': {
        'ocupados': sidra(_url(5434, '201201-209904', '4090', f'888[{GRUPAMENTO_TOTAL},{GRUPAMENTO_AGRO}]')),
        'rendimento': sidra(_url(5442, '201201-209904', '5932', f'888[{GRUPAMENTO_TOTAL},{GRUPAMENTO_AGRO}]')),
    }}
    grupos = ','.join(IPCA_GRUPOS)
    ipca = {'consultas': {
        'serie2012': sidra(_url(1419, '201201-201912', '2265', f'315[{grupos}]')),
        'serie2020': sidra(_url(7060, '202001-209912', '2265', f'315[{grupos}]')),
        'itens': sidra(_url(7060, 'last', '2265|66', f'315[{grupos},{",".join(IPCA_ITENS)}]')),
    }}
    return {'censoagro': censo, 'pnadc': pnadc, 'ipca': ipca}


# ---------------------------------------------------------------- normalização

def _linhas(resposta):
    """[(variável, {classificação: categoria}, período, valor bruto)] de uma resposta v3."""
    out, chaves = [], set()
    for variavel in resposta:
        for resultado in variavel['resultados']:
            cats = {}
            for c in resultado['classificacoes']:
                if len(c['categoria']) != 1:
                    raise ValueError('Classificação SIDRA com mais de uma categoria por resultado')
                cats[str(c['id'])] = next(iter(c['categoria']))
            for serie in resultado['series']:
                if str(serie['localidade']['id']) != '1':
                    raise ValueError('Território fora do Brasil')
                for periodo, valor in serie['serie'].items():
                    chave = (str(variavel['id']), tuple(sorted(cats.items())), periodo)
                    if chave in chaves:
                        raise ValueError('Chave duplicada na resposta SIDRA')
                    chaves.add(chave)
                    out.append((str(variavel['id']), cats, periodo, valor))
    return out


def _nome_categorias(resposta, classificacao):
    nomes = {}
    for variavel in resposta:
        for resultado in variavel['resultados']:
            for c in resultado['classificacoes']:
                if str(c['id']) == classificacao:
                    nomes.update(c['categoria'])
    return nomes


def normalizar_censo(bundle):
    q = {k: v['resposta'] for k, v in bundle['consultas'].items()}
    tip = {t: {} for t in TIPOLOGIA.values()}
    faixas = {}
    for var, cats, _, bruto in _linhas(q['estabelecimentos']):
        t, area = TIPOLOGIA[cats['829']], cats[GRUPOS_AREA]
        campo = {'183': 'estabelecimentos', '184': 'area'}[var]
        if area == '110085':
            tip[t][campo] = numero(bruto)
        else:
            faixas.setdefault(area, {}).setdefault(t, {})[campo] = numero(bruto)
    for var, cats, _, bruto in _linhas(q['pessoal']):
        tip[TIPOLOGIA[cats['829']]]['pessoal'] = numero(bruto)
    for var, cats, _, bruto in _linhas(q['valor']):
        tip[TIPOLOGIA[cats['829']]][{'40': 'comProducao', '1999': 'valorProducao'}[var]] = numero(bruto) * (1000 if var == '1999' else 1)
    for t, v in tip.items():
        if set(v) != {'estabelecimentos', 'area', 'pessoal', 'comProducao', 'valorProducao'} or any(x is None for x in v.values()):
            raise ValueError('Censo Agro incompleto na tipologia ' + t)
    # Familiar e não familiar formam o total publicado; tolera só arredondamento da fonte.
    for campo in ['estabelecimentos', 'area', 'pessoal', 'valorProducao']:
        soma = tip['familiar'][campo] + tip['naoFamiliar'][campo]
        if abs(soma - tip['total'][campo]) > max(2, tip['total'][campo] * 1e-4):
            raise ValueError('Tipologias não somam o total: ' + campo)
    nomes = _nome_categorias(q['estabelecimentos'], GRUPOS_AREA)
    ordem = [c for c in nomes if c != '110085']
    grupos = []
    for c in ordem:
        v = faixas.get(c, {}).get('total', {})
        grupos.append({'id': c, 'nome': nomes[c], 'estabelecimentos': v.get('estabelecimentos'), 'area': v.get('area'), 'familiar': faixas.get(c, {}).get('familiar', {}).get('estabelecimentos')})
    soma = sum(g['estabelecimentos'] or 0 for g in grupos)
    if abs(soma - tip['total']['estabelecimentos']) > 2:
        raise ValueError('Grupos de área não somam o total de estabelecimentos')
    return {'ano': 2017, 'tipologia': tip, 'gruposArea': grupos, 'fonte': 'censoagro'}


def _trimestre(p):
    return f'{p[:4]}-T{int(p[4:])}'


def normalizar_pnadc(bundle):
    q = {k: v['resposta'] for k, v in bundle['consultas'].items()}
    serie = {}
    for chave, campo, fator in [('ocupados', 'ocupados', 1000), ('rendimento', 'rendimento', 1)]:
        for var, cats, periodo, bruto in _linhas(q[chave]):
            g = 'agro' if cats['888'] == GRUPAMENTO_AGRO else 'total'
            v = numero(bruto)
            serie.setdefault(periodo, {})[f'{campo}{g.capitalize()}'] = None if v is None else v * fator
    linhas = []
    for p in sorted(serie):
        # Medida ausente fica nula no trimestre: o eixo do tempo não perde o período.
        r = {k: serie[p].get(k) for k in ['ocupadosTotal', 'ocupadosAgro', 'rendimentoTotal', 'rendimentoAgro']}
        if r['ocupadosAgro'] is not None and r['ocupadosTotal'] is not None and r['ocupadosAgro'] > r['ocupadosTotal']:
            raise ValueError('Ocupados no agro acima do total em ' + p)
        part = 100 * r['ocupadosAgro'] / r['ocupadosTotal'] if r['ocupadosAgro'] is not None and r['ocupadosTotal'] else None
        razao = r['rendimentoAgro'] / r['rendimentoTotal'] if r['rendimentoAgro'] is not None and r['rendimentoTotal'] else None
        linhas.append({'periodo': _trimestre(p), **r, 'participacao': part, 'razaoRendimento': razao})
    for a, b in zip(linhas, linhas[1:]):
        ya, qa = int(a['periodo'][:4]), int(a['periodo'][-1])
        if (int(b['periodo'][:4]), int(b['periodo'][-1])) != ((ya, qa + 1) if qa < 4 else (ya + 1, 1)):
            raise ValueError('Série da PNAD Contínua com trimestre ausente: ' + b['periodo'])
    if linhas and any(linhas[-1][k] is None for k in ['ocupadosAgro', 'ocupadosTotal', 'rendimentoAgro', 'rendimentoTotal']):
        raise ValueError('Último trimestre da PNAD Contínua incompleto: ' + linhas[-1]['periodo'])
    if len(linhas) < 40:
        raise ValueError('Série da PNAD Contínua curta demais')
    return {'trimestres': linhas, 'fonte': 'pnadc'}


def normalizar_ipca(bundle):
    q = {k: v['resposta'] for k, v in bundle['consultas'].items()}
    serie = {}
    for chave in ['serie2012', 'serie2020']:
        for var, cats, periodo, bruto in _linhas(q[chave]):
            serie.setdefault(periodo, {})[cats['315']] = numero(bruto)
    for periodo, valores in serie.items():
        if set(valores) != set(IPCA_GRUPOS):
            raise ValueError('Série do IPCA com mês ausente em uma categoria: ' + periodo)
    meses = [{'mes': p[:4] + '-' + p[4:], **{c: serie[p].get(c) for c in IPCA_GRUPOS}} for p in sorted(serie)]
    for a, b in zip(meses, meses[1:]):
        ya, ma = int(a['mes'][:4]), int(a['mes'][5:])
        if (int(b['mes'][:4]), int(b['mes'][5:])) != ((ya, ma + 1) if ma < 12 else (ya + 1, 1)):
            raise ValueError('Série do IPCA com mês ausente: ' + b['mes'])
    itens, periodo = {}, None
    for var, cats, p, bruto in _linhas(q['itens']):
        periodo = periodo or p
        if p != periodo:
            raise ValueError('Itens do IPCA com períodos diferentes')
        itens.setdefault(cats['315'], {})[{'2265': 'doze', '66': 'peso'}[var]] = numero(bruto)
    ultimo = meses[-1]['mes']
    if periodo[:4] + '-' + periodo[4:] != ultimo:
        raise ValueError('Itens e série do IPCA terminam em meses diferentes')
    lista = [{'id': c, 'nome': n, 'doze': itens.get(c, {}).get('doze'), 'peso': itens.get(c, {}).get('peso')} for c, n in {**IPCA_GRUPOS, **IPCA_ITENS}.items()]
    if any(r['doze'] is None for r in lista[:3]):
        raise ValueError('IPCA sem variação dos grupos principais no último mês')
    return {'ultimoMes': ultimo, 'grupos': {c: n for c, n in IPCA_GRUPOS.items()}, 'meses': [{'mes': m['mes'], 'geral': m['7169'], 'alimentacaoBebidas': m['7170'], 'domicilio': m['7171'], 'fora': m['7432']} for m in meses], 'itens': lista, 'fonte': 'ipca'}


def normalizar(coletas):
    return {'produtores': normalizar_censo(coletas['censoagro']), 'trabalho': normalizar_pnadc(coletas['pnadc']), 'prato': normalizar_ipca(coletas['ipca'])}
