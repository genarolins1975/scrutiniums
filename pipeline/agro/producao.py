"""Cadeias do Agro: produção por estado (IBGE PAM, PPM, Abate, PEVS) e comércio por posição SH (Comex Stat).

Coleta e normalização. A gravação das sementes, os hashes e o manifesto são os mesmos da
economia (pipeline/agro/economia.py, `gravar`).
"""
from .run import numero, SIGLAS

SIDRA = 'https://servicodados.ibge.gov.br/api/v3/agregados'
ANOS = 10
INICIO_COMEX = 2010
# Total do trimestre, todos os tipos de inspeção e, nos bovinos, todos os tipos de rebanho.
ABATE_CLASSES = {'1092': '12716[115236]|18[992]|12529[118225]', '1093': '12716[115236]|12529[118225]', '1094': '12716[115236]|12529[118225]'}

# Critério das 12 cadeias: as maiores posições exportadas do agro (lente da exportação) e os
# alimentos de maior peso na cesta do IPCA (lente da mesa). Cada cadeia declara a medida física
# do IBGE que a representa e as posições SH que a representam no comércio.
CADEIAS = {
    'soja': {'pam': '40124', 'posicoes': {'1201': 'Soja em grão', '2304': 'Farelo de soja', '1507': 'Óleo de soja'}, 'ipca': '7385'},
    'milho': {'pam': '40122', 'posicoes': {'1005': 'Milho'}, 'ipca': None},
    'cana': {'pam': '40106', 'posicoes': {'1701': 'Açúcar', '2207': 'Álcool etílico'}, 'ipca': '7220'},
    'cafe': {'pam': '40139', 'posicoes': {'0901': 'Café'}, 'ipca': '7392'},
    'algodao': {'pam': '40099', 'posicoes': {'5201': 'Algodão em pluma'}, 'ipca': None},
    'arroz': {'pam': '40102', 'posicoes': {'1006': 'Arroz'}, 'ipca': '7173'},
    'feijao': {'pam': '40112', 'posicoes': {'0713': 'Leguminosas secas'}, 'ipca': '12222'},
    'bovinos': {'abate': '1092', 'rebanho': '2670', 'posicoes': {'0201': 'Carne bovina fresca ou refrigerada', '0202': 'Carne bovina congelada'}, 'ipca': '7283'},
    'frango': {'abate': '1094', 'posicoes': {'0207': 'Carnes e miudezas de aves'}, 'ipca': '107617'},
    'suinos': {'abate': '1093', 'rebanho': '32794', 'posicoes': {'0203': 'Carne suína'}, 'ipca': None},
    'leite': {'leite': '2682', 'posicoes': {'0401': 'Leite e nata', '0402': 'Leite concentrado e em pó', '0403': 'Iogurtes e leites fermentados', '0404': 'Soro de leite', '0405': 'Manteiga', '0406': 'Queijos'}, 'ipca': '12393'},
    'celulose': {'pevs': '3458', 'posicoes': {'4703': 'Celulose (pasta química de madeira)'}, 'ipca': None},
}
POSICOES = sorted({p for c in CADEIAS.values() for p in c['posicoes']})

FONTES = {
    'producao': {'arquivo': 'producao.json.gz', 'url': 'https://sidra.ibge.gov.br/pesquisa/pam/tabelas', 'nome': 'IBGE, Produção Agrícola Municipal, Pesquisa da Pecuária Municipal, Produção da Extração Vegetal e da Silvicultura e Pesquisa Trimestral do Abate de Animais (SIDRA 5457, 3939, 74, 291, 1092, 1093 e 1094)', 'licenca': 'Dados públicos do IBGE; citar a fonte', 'limite': 'Produção anual por estado; o abate é trimestral, só de estabelecimentos sob inspeção sanitária, e tem estados com dado sigiloso. Rebanho é estoque em 31 de dezembro, não produção. A PAM substitui a estimativa do LSPA quando sai, por volta de setembro do ano seguinte.'},
    'comexcadeias': {'arquivo': 'comexcadeias.json.gz', 'url': 'https://comexstat.mdic.gov.br/', 'nome': 'MDIC, Comex Stat (exportação e importação por posição SH e país)', 'licenca': 'Dados abertos do governo federal; citar a fonte', 'limite': 'Valores FOB em US$ correntes e massa líquida em kg, por posição de quatro dígitos do Sistema Harmonizado. Uma posição pode incluir produto de outra origem (álcool etílico de milho, leguminosas que não são feijão, aves que não são frango).'},
}


def _sidra(tabela, periodos, variaveis, classificacao):
    return f'{SIDRA}/{tabela}/periodos/{periodos}/variaveis/{variaveis}?localidades=N1[all]|N3[all]&classificacao={classificacao}'


def coletar(baixar, comex, consulta, atualizado):
    """Baixa os recortes das cadeias; não grava nada. `atualizado` é a data do Comex Stat."""
    def sidra(url):
        return {'url': url, 'resposta': baixar(url)}
    ultimo = int(max(p['id'] for p in baixar(f'{SIDRA}/5457/periodos')))
    anos = '|'.join(str(a) for a in range(ultimo - ANOS + 1, ultimo + 1))
    trimestres = sorted(p['id'] for p in baixar(f'{SIDRA}/1092/periodos'))
    ultimo_tri = trimestres[-1]
    tris = '|'.join(t for t in trimestres if int(t[:4]) >= ultimo - ANOS + 1)
    pam = ','.join(c['pam'] for c in CADEIAS.values() if 'pam' in c)
    rebanhos = ','.join(c['rebanho'] for c in CADEIAS.values() if 'rebanho' in c)
    producao = {'ultimoAno': ultimo, 'ultimoTrimestre': ultimo_tri, 'consultas': {
        'pam': sidra(_sidra(5457, anos, '214|216|215', f'782[{pam}]')),
        'rebanho': sidra(_sidra(3939, anos, '105', f'79[{rebanhos}]')),
        'leite': sidra(_sidra(74, anos, '106|215', '80[2682]')),
        'silvicultura': sidra(_sidra(291, anos, '142|143', '194[3458]')),
        **{f'abate{t}': sidra(_sidra(int(t), tris, '284|285', cls)) for t, cls in ABATE_CLASSES.items()},
    }}
    ano, mes = int(atualizado['year']), int(atualizado['monthNumber'])
    fim, anterior = f'{ano}-{mes:02d}', ano - 1 if mes < 12 else ano
    filtro = [{'filter': 'heading', 'values': POSICOES}]
    # Mesma regra da economia: anos fechados numa consulta e o acumulado do ano noutra,
    # porque o Comex Stat aplica o intervalo de meses do período a cada ano.
    consultas = {
        'exportAnual': consulta('export', f'{INICIO_COMEX}-01', f'{anterior}-12', ['heading'], filtro, mensal=False),
        'exportAcumulado': consulta('export', f'{ano - 1}-01', fim, ['heading'], filtro, mensal=False),
        'importAnual': consulta('import', f'{INICIO_COMEX}-01', f'{anterior}-12', ['heading'], filtro, mensal=False),
        'destinos': consulta('export', f'{anterior}-01', f'{anterior}-12', ['heading', 'country'], filtro, mensal=False),
    }
    comercio = {'atualizadoNaFonte': atualizado, 'consultas': {k: {'url': 'https://api-comexstat.mdic.gov.br/general', 'corpo': c, 'resposta': comex(c)} for k, c in consultas.items()}}
    return {'producao': producao, 'comexcadeias': comercio}


# ---------------------------------------------------------------- normalização

def _linhas(resposta):
    """{(variável, categoria, localidade, período): valor bruto}, recusando duplicatas."""
    out = {}
    for variavel in resposta:
        for resultado in variavel['resultados']:
            cats = [next(iter(c['categoria'])) for c in resultado['classificacoes']]
            if any(len(c['categoria']) != 1 for c in resultado['classificacoes']):
                raise ValueError('Classificação SIDRA com mais de uma categoria por resultado')
            for serie in resultado['series']:
                local = str(serie['localidade']['id'])
                if local != '1' and local not in SIGLAS:
                    raise ValueError('Território inesperado: ' + local)
                for periodo, valor in serie['serie'].items():
                    k = (str(variavel['id']), cats[0] if len(cats) == 1 else '|'.join(cats), local, periodo)
                    if k in out:
                        raise ValueError('Chave duplicada na resposta SIDRA')
                    out[k] = valor
    return out


def _ufs(linhas, variavel, categoria, periodo, total):
    """Estados com o valor do período e a parcela do total nacional; sigilo e ausência ficam None."""
    out = []
    for uf, sigla in SIGLAS.items():
        bruto = linhas.get((variavel, categoria, uf, periodo))
        v = numero(bruto) if bruto is not None else None
        out.append({'id': uf, 'sigla': sigla, 'valor': v, 'participacao': 100 * v / total if v is not None and total else None, 'sigilo': bruto == 'X'})
    conhecidos = sum(u['valor'] for u in out if u['valor'] is not None)
    if total and conhecidos > total * 1.002:
        raise ValueError('Soma dos estados acima do total nacional: ' + categoria)
    return sorted(out, key=lambda u: (u['valor'] is None, -(u['valor'] or 0), u['sigla']))


def _serie_anual(linhas, variavel, categoria, anos, escala=1.0):
    out = []
    for a in anos:
        bruto = linhas.get((variavel, categoria, '1', str(a)))
        if bruto is None:
            raise ValueError(f'Ano ausente na produção: {categoria} {a}')
        v = numero(bruto)
        out.append({'ano': a, 'valor': None if v is None else v * escala})
    return out


def _anual(linhas, variavel, categoria, ano, medida, unidade, escala=1.0, fonte_tabela=''):
    anos = list(range(ano - ANOS + 1, ano + 1))
    serie = _serie_anual(linhas, variavel, categoria, anos, escala)
    total = serie[-1]['valor']
    if total is None or total <= 0:
        raise ValueError('Total nacional ausente no último ano: ' + categoria)
    ufs = _ufs(linhas, variavel, categoria, str(ano), total / escala)
    for u in ufs:
        if u['valor'] is not None:
            u['valor'] *= escala
    return {'medida': medida, 'unidade': unidade, 'periodo': str(ano), 'tabela': fonte_tabela, 'serie': serie, 'ufs': ufs}


def _abate(linhas, tri_fim, ano):
    """Peso das carcaças (t) e cabeças: anos fechados e últimos quatro trimestres, Brasil e estados."""
    por_var = {v: sorted({k[3] for k in linhas if k[2] == '1' and k[0] == v}) for v in ('284', '285')}
    if por_var['284'] != por_var['285']:
        raise ValueError('Trimestre ausente numa das variáveis do abate')
    tris = por_var['285']
    if tris[-1] != tri_fim:
        raise ValueError('Último trimestre do abate divergente')
    anos = list(range(ano - ANOS + 1, ano + 1))
    serie = []
    for a in anos:
        qs = [f'{a}{t:02d}' for t in range(1, 5)]
        if any(q not in tris for q in qs):
            if a == anos[-1] and a == int(tri_fim[:4]):
                continue
            raise ValueError(f'Trimestre ausente no abate: {a}')
        peso = [numero(linhas[('285', _cat(linhas), '1', q)]) for q in qs]
        cab = [numero(linhas[('284', _cat(linhas), '1', q)]) for q in qs]
        if None in peso or None in cab:
            raise ValueError('Abate nacional sem valor')
        serie.append({'ano': a, 'valor': sum(peso) / 1000, 'cabecas': sum(cab)})
    ultimos = tris[-4:]
    a, t = int(ultimos[0][:4]), int(ultimos[0][4:])
    esperados = [f'{a + (t - 1 + i) // 4}{(t - 1 + i) % 4 + 1:02d}' for i in range(4)]
    if ultimos != esperados:
        raise ValueError('Trimestres do abate fora de sequência')
    cat = _cat(linhas)
    total = sum(numero(linhas[('285', cat, '1', q)]) for q in ultimos)
    ufs = []
    for uf, sigla in SIGLAS.items():
        brutos = [linhas.get(('285', cat, uf, q)) for q in ultimos]
        vals = [numero(b) if b is not None else None for b in brutos]
        valor = None if None in vals else sum(vals)
        ufs.append({'id': uf, 'sigla': sigla, 'valor': None if valor is None else valor / 1000, 'participacao': None if valor is None else 100 * valor / total, 'sigilo': any(b == 'X' for b in brutos)})
    if sum(u['valor'] or 0 for u in ufs) > total / 1000 * 1.002:
        raise ValueError('Soma dos estados acima do total do abate')
    ufs.sort(key=lambda u: (u['valor'] is None, -(u['valor'] or 0), u['sigla']))
    periodo = f'{ultimos[0][4:].lstrip("0")}º tri/{ultimos[0][:4]} a {ultimos[-1][4:].lstrip("0")}º tri/{ultimos[-1][:4]}'
    return {'medida': 'Peso das carcaças, abate sob inspeção', 'unidade': 't', 'periodo': periodo, 'trimestres': ultimos, 'totalUltimos4': total / 1000, 'serie': serie, 'ufs': ufs}


def _cat(linhas):
    cats = {k[1] for k in linhas}
    if len(cats) != 1:
        raise ValueError('Mais de uma categoria no abate')
    return next(iter(cats))


def normalizar_producao(bundle):
    q = {k: _linhas(v['resposta']) for k, v in bundle['consultas'].items()}
    ano, tri = int(bundle['ultimoAno']), bundle['ultimoTrimestre']
    out = {}
    for cid, c in CADEIAS.items():
        item = {}
        if 'pam' in c:
            item['producao'] = _anual(q['pam'], '214', c['pam'], ano, 'Quantidade produzida', 't', fonte_tabela='PAM, SIDRA 5457')
            item['area'] = _serie_anual(q['pam'], '216', c['pam'], range(ano - ANOS + 1, ano + 1))
            item['valorProducao'] = _serie_anual(q['pam'], '215', c['pam'], range(ano - ANOS + 1, ano + 1), 1000)
        if 'abate' in c:
            item['producao'] = {**_abate(q['abate' + c['abate']], tri, ano), 'tabela': f'Abate, SIDRA {c["abate"]}'}
        if 'rebanho' in c:
            item['rebanho'] = _anual(q['rebanho'], '105', c['rebanho'], ano, 'Efetivo do rebanho em 31/12', 'cabeças', fonte_tabela='PPM, SIDRA 3939')
        if 'leite' in c:
            item['producao'] = _anual(q['leite'], '106', c['leite'], ano, 'Leite produzido', 'mil litros', fonte_tabela='PPM, SIDRA 74')
            item['valorProducao'] = _serie_anual(q['leite'], '215', c['leite'], range(ano - ANOS + 1, ano + 1), 1000)
        if 'pevs' in c:
            item['producao'] = _anual(q['silvicultura'], '142', c['pevs'], ano, 'Madeira em tora para papel e celulose', 'm³', fonte_tabela='PEVS, SIDRA 291')
            item['valorProducao'] = _serie_anual(q['silvicultura'], '143', c['pevs'], range(ano - ANOS + 1, ano + 1), 1000)
        out[cid] = item
    return {'ultimoAno': ano, 'ultimoTrimestre': tri, 'cadeias': out}


def _indexar(linhas, chaves):
    out = {}
    for r in linhas:
        k = (int(r['year']), *[r[c] for c in chaves])
        if k in out:
            raise ValueError('Linha duplicada no Comex Stat')
        fob, kg = numero(r['metricFOB']), numero(r['metricKG'])
        if fob is None or kg is None or fob < 0 or kg < 0:
            raise ValueError('Valor de comércio inválido')
        out[k] = (fob, kg)
    return out


def normalizar_comercio(bundle):
    q = {k: v['resposta'] for k, v in bundle['consultas'].items()}
    atual = bundle['atualizadoNaFonte']
    ano, mes = int(atual['year']), int(atual['monthNumber'])
    completo = ano if mes == 12 else ano - 1
    exp, imp = _indexar(q['exportAnual'], ['headingCode']), _indexar(q['importAnual'], ['headingCode'])
    acum, dest = _indexar(q['exportAcumulado'], ['headingCode']), _indexar(q['destinos'], ['headingCode', 'country'])
    if sorted({k[0] for k in exp}) != list(range(INICIO_COMEX, completo + 1)):
        raise ValueError('Série anual de exportação das cadeias incompleta')
    if {k[1] for k in exp} != set(POSICOES):
        raise ValueError('Posição sem exportação registrada no período')
    if any(k[0] != completo for k in dest):
        raise ValueError('Ano inesperado nos destinos das cadeias')
    soma = lambda d, f: (sum(v[0] for k, v in d.items() if f(k)), sum(v[1] for k, v in d.items() if f(k)))
    out = {}
    for cid, c in CADEIAS.items():
        ps = set(c['posicoes'])
        anual = []
        for a in range(INICIO_COMEX, completo + 1):
            fob, kg = soma(exp, lambda k: k[0] == a and k[1] in ps)
            ifob, ikg = soma(imp, lambda k: k[0] == a and k[1] in ps)
            anual.append({'ano': a, 'fob': fob, 'kg': kg, 'importFob': ifob, 'importKg': ikg})
        mesmo = []
        for a in (ano - 1, ano):
            fob, kg = soma(acum, lambda k: k[0] == a and k[1] in ps)
            mesmo.append({'ano': a, 'meses': mes, 'fob': fob, 'kg': kg})
        por_posicao = [{'posicao': p, 'nome': n, 'fob': exp.get((completo, p), (0.0, 0.0))[0], 'kg': exp.get((completo, p), (0.0, 0.0))[1]} for p, n in c['posicoes'].items()]
        paises = {}
        for k, v in dest.items():
            if k[1] in ps:
                paises[k[2]] = paises.get(k[2], 0.0) + v[0]
        total = sum(paises.values())
        if abs(total - anual[-1]['fob']) > max(1.0, 1e-6 * total):
            raise ValueError('Destinos não somam a exportação da cadeia: ' + cid)
        destinos = sorted(({'pais': p, 'fob': v, 'participacao': 100 * v / total if total else None} for p, v in paises.items()), key=lambda r: (-r['fob'], r['pais']))
        out[cid] = {'posicoes': por_posicao, 'anual': anual, 'mesmoPeriodo': mesmo, 'destinos': destinos[:8], 'paisesDestino': len(destinos)}
    return {'ultimoMes': f'{ano}-{mes:02d}', 'anoCompleto': completo, 'cadeias': out}


def normalizar(coletas):
    p, c = normalizar_producao(coletas['producao']), normalizar_comercio(coletas['comexcadeias'])
    cadeias = {cid: {'producao': p['cadeias'][cid], 'comercio': c['cadeias'][cid], 'ipca': CADEIAS[cid]['ipca']} for cid in CADEIAS}
    return {'cadeias': {'ultimoAnoProducao': p['ultimoAno'], 'ultimoTrimestreAbate': p['ultimoTrimestre'], 'comercioUltimoMes': c['ultimoMes'], 'comercioAnoCompleto': c['anoCompleto'], 'itens': cadeias, 'fontes': ['producao', 'comexcadeias']}}
