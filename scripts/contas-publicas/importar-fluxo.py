"""Fluxo do dinheiro federal: da arrecadação ao gasto, RTN tabela 2.2 (anual, valores correntes).

Lê a mesma edição do RTN do snapshot publicado (src/lib/contas-publicas/snapshots/dados.json): o
SHA-256 do arquivo tem de coincidir, para o fluxo e os demais painéis falarem do mesmo boletim.
Requer Python 3.9+, openpyxl e requests. Nunca executado no build.

    python3 scripts/contas-publicas/importar-fluxo.py --cache /tmp/contas-fontes   (usa rtn.xlsx do cache)
    python3 scripts/contas-publicas/importar-fluxo.py                              (baixa a edição do snapshot)

Regras: receita pelo ingresso efetivo na Conta Única (caixa); despesa pelo pagamento efetivo;
resultado primário acima da linha, sem juros. Cada agrupamento soma linhas do próprio demonstrativo
e é conferido contra o total que o demonstrativo declara; nada é estimado.
"""
import argparse, datetime as dt, hashlib, json, math, pathlib, re, tempfile
import openpyxl, requests

ROOT = pathlib.Path(__file__).resolve().parents[2]
DADOS = ROOT / 'src/lib/contas-publicas/snapshots/dados.json'
OUT = ROOT / 'src/lib/contas-publicas/snapshots/fluxo.json'
ABA = '2.2'
ANO = 2025
TOLERANCIA = 0.01  # R$ milhões

# (id, rótulo, [(código da linha, rótulo da parte)])
FONTES = [
    ('ir', 'Imposto de Renda', [('1.1.03.3', 'Retido na fonte'), ('1.1.03.2', 'Pessoa jurídica'), ('1.1.03.1', 'Pessoa física')]),
    ('inss', 'Contribuição ao INSS', [('1.3.1', 'Urbana'), ('1.3.2', 'Rural')]),
    ('cofins', 'Cofins e PIS/Pasep', [('1.1.05', 'Cofins'), ('1.1.06', 'PIS/Pasep')]),
    ('iof', 'IOF, IPI e importação', [('1.1.01', 'Imposto de importação'), ('1.1.02', 'IPI'), ('1.1.04', 'IOF')]),
    ('csll', 'CSLL', [('1.1.07', 'CSLL')]),
    ('outras_rfb', 'Outras receitas federais', [('1.1.10', 'Outras administradas pela Receita'), ('1.1.09', 'CIDE-Combustíveis'), ('1.1.08', 'CPMF'), ('1.2', 'Incentivos fiscais')]),
    ('nao_adm', 'Royalties, dividendos e outras', [('1.4.4', 'Exploração de recursos naturais'), ('1.4.2', 'Dividendos e participações'), ('1.4.6', 'Salário-educação'), ('1.4.5', 'Receitas próprias'), ('1.4.3', 'Contribuição dos servidores (CPSS)'), ('1.4.1', 'Concessões e permissões'), ('1.4.7', 'Complemento do FGTS'), ('1.4.8', 'Demais')]),
]
REPASSE = [('2.1', 'FPM, FPE e IPI-Exportação'), ('2.4', 'Royalties e exploração de recursos naturais'), ('2.3', 'Salário-educação'), ('2.2', 'Fundos constitucionais (líquido)'), ('2.5', 'CIDE-Combustíveis'), ('2.6', 'Demais')]
USOS = [
    ('inss', 'Aposentadorias e pensões (INSS)', 'obrigatória', [('4.1.1', 'Urbano'), ('4.1.2', 'Rural')]),
    ('pessoal', 'Servidores ativos e inativos', 'obrigatória', [('4.2', 'Pessoal e encargos sociais')]),
    ('saude', 'Saúde (parte obrigatória)', 'obrigatória', [('4.4.1.3', 'Saúde, obrigatória com controle de fluxo')]),
    ('bolsa', 'Bolsa Família', 'obrigatória', [('4.4.1.2', 'Bolsa Família e Auxílio Brasil')]),
    ('bpc', 'BPC (idosos e PcD)', 'obrigatória', [('4.3.05', 'Benefício de Prestação Continuada e RMV')]),
    ('abono', 'Abono e seguro-desemprego', 'obrigatória', [('4.3.01.2', 'Seguro-desemprego'), ('4.3.01.1', 'Abono salarial')]),
    ('fundeb', 'Fundeb (complemento da União)', 'obrigatória', [('4.3.10', 'Complemento da União ao Fundeb')]),
]
OUTRAS_43 = {'4.3.02': 'Anistiados', '4.3.03': 'Apoio financeiro a estados e municípios', '4.3.04': 'Benefícios de legislação especial e indenizações',
             '4.3.06': 'Complemento do FGTS', '4.3.07': 'Créditos extraordinários', '4.3.08': 'Compensação ao RGPS pelas desonerações da folha',
             '4.3.09': 'Fabricação de cédulas e moedas', '4.3.11': 'Fundo Constitucional do DF', '4.3.12': 'Legislativo, Judiciário, MPU e DPU',
             '4.3.13': 'Lei Kandir e LC 176/2020', '4.3.14': 'Sentenças judiciais e precatórios', '4.3.15': 'Subsídios, subvenções e Proagro',
             '4.3.16': 'Transferências à ANA', '4.3.17': 'Transferências de multas da ANEEL', '4.3.18': 'Impacto primário do FIES',
             '4.3.19': 'Financiamento de campanha eleitoral', '4.3.20': 'Demais obrigatórias'}
OUTRAS_441 = {'4.4.1.1': 'Benefícios a servidores públicos', '4.4.1.4': 'Educação (obrigatória com controle de fluxo)', '4.4.1.5': 'Demais obrigatórias com controle de fluxo'}
DISCRICIONARIAS = [('4.4.2.1', 'Saúde'), ('4.4.2.2', 'Educação'), ('4.4.2.4', 'Transporte'), ('4.4.2.3', 'Defesa'), ('4.4.2.6', 'Ciência e tecnologia'), ('4.4.2.8', 'Assistência social'), ('4.4.2.5', 'Administração'), ('4.4.2.7', 'Segurança pública'), ('4.4.2.9', 'Demais')]
ESPERADOS = {'1': 'RECEITA TOTAL', '2': 'TRANSF. POR REPARTIÇÃO', '3': 'RECEITA LÍQUIDA', '4': 'DESPESA TOTAL', '5': 'RESULTADO PRIMÁRIO', '9': 'JUROS NOMINAIS',
             '4.3': 'Outras Despesas Obrigatórias', '4.4.1': 'Obrigatórias com Controle de Fluxo', '4.4.2': 'Despesas Discricionárias'}
CODIGO = re.compile(r'^\s*(\d+(?:\.\d+)*)\.?\s')


def check(ok, msg):
    if not ok:
        raise ValueError(msg)


def ler_linhas(caminho):
    w = openpyxl.load_workbook(caminho, data_only=True, read_only=True)
    cells = list(w[ABA].values)
    check('Milhões' in str(cells[2][0]) and 'Correntes' in str(cells[2][0]), 'Unidade da tabela 2.2 alterada')
    colunas = [i for i, v in enumerate(cells[4]) if v == ANO]
    check(len(colunas) == 1, f'Coluna de {ANO} ausente ou duplicada na tabela 2.2')
    j = colunas[0]
    linhas, rotulos = {}, {}
    for row in cells[5:]:
        rotulo = str(row[0] or '')
        if rotulo.startswith('Memorando'):
            break
        m = CODIGO.match(rotulo)
        if not m:
            continue
        cod = m.group(1)
        if cod in linhas:
            # A fonte repete alguns códigos em subníveis de subsídios (ex.: 4.1.15.1.2); só a primeira ocorrência
            # de um código usado aqui é aceita, e um código usado não pode aparecer duas vezes.
            rotulos.setdefault('_repetidos', []).append(cod)
            continue
        v = row[j]
        check(isinstance(v, (int, float)) and math.isfinite(v), f'Valor ausente ou inválido: {rotulo}')
        linhas[cod] = float(v)
        rotulos[cod] = rotulo.strip()
    for cod, texto in ESPERADOS.items():
        check(cod in rotulos and texto in rotulos[cod], f'Linha {cod} alterada na tabela 2.2')
    return linhas, rotulos


def montar(linhas, rotulos):
    usados = set()

    def v(cod):
        check(cod in linhas, f'Linha {cod} ausente')
        check(cod not in rotulos.get('_repetidos', []), f'Linha {cod} repetida na fonte')
        usados.add(cod)
        return linhas[cod]

    def perto(a, b, msg):
        check(abs(a - b) <= TOLERANCIA, f'{msg}: {a} ≠ {b}')

    fontes = []
    for id_, nome, partes in FONTES:
        p = [[r, v(c)] for c, r in partes]
        fontes.append(dict(id=id_, nome=nome, valor=sum(x[1] for x in p), partes=[x for x in p if len(partes) > 1 and abs(x[1]) > TOLERANCIA]))
    perto(v('1.1.03'), v('1.1.03.1') + v('1.1.03.2') + v('1.1.03.3'), 'Imposto de Renda não fecha')
    perto(v('1.3'), v('1.3.1') + v('1.3.2'), 'RGPS não fecha')
    perto(v('1.4'), sum(v(f'1.4.{i}') for i in range(1, 9)), 'Receitas não administradas não fecham')
    perto(v('1.1'), sum(v(f'1.1.{i:02d}') for i in range(1, 11)), 'Receitas administradas não fecham')
    arrecadacao = v('1')
    perto(sum(f['valor'] for f in fontes), arrecadacao, 'Fontes não somam a receita total')

    repasse_partes = [[r, v(c)] for c, r in REPASSE]
    repasse = v('2')
    perto(sum(x[1] for x in repasse_partes), repasse, 'Repartição de receitas não fecha')
    receita_liquida = v('3')
    perto(arrecadacao - repasse, receita_liquida, 'Receita líquida não fecha')

    usos = []
    for id_, nome, natureza, partes in USOS:
        p = [[r, v(c)] for c, r in partes]
        usos.append(dict(id=id_, nome=nome, natureza=natureza, valor=sum(x[1] for x in p), partes=[x for x in p if len(partes) > 1]))
    perto(v('4.1'), v('4.1.1') + v('4.1.2'), 'Benefícios previdenciários não fecham')
    perto(v('4.3.01'), v('4.3.01.1') + v('4.3.01.2'), 'Abono e seguro-desemprego não fecham')
    outras = [[r, v(c)] for c, r in {**OUTRAS_43, **OUTRAS_441}.items()]
    perto(v('4.3'), sum(v(c) for c in ['4.3.01', '4.3.05', '4.3.10'] + list(OUTRAS_43)), 'Outras obrigatórias (4.3) não fecham')
    perto(v('4.4.1'), sum(v(c) for c in ['4.4.1.2', '4.4.1.3'] + list(OUTRAS_441)), 'Obrigatórias com controle de fluxo não fecham')
    outras = sorted([x for x in outras if abs(x[1]) > TOLERANCIA], key=lambda x: -x[1])
    usos.append(dict(id='outras', nome='Outras obrigatórias', natureza='obrigatória', valor=sum(x[1] for x in outras), partes=outras))
    discr = [[r, v(c)] for c, r in DISCRICIONARIAS]
    perto(v('4.4.2'), sum(x[1] for x in discr), 'Discricionárias não fecham')
    usos.append(dict(id='discricionarias', nome='Gastos discricionários', natureza='discricionária', valor=v('4.4.2'), partes=discr))
    gasto = v('4')
    perto(sum(u['valor'] for u in usos), gasto, 'Usos não somam a despesa total')
    perto(v('4'), v('4.1') + v('4.2') + v('4.3') + v('4.4.1') + v('4.4.2'), 'Despesa total não fecha')
    resultado = v('5')
    perto(receita_liquida - gasto, resultado, 'Resultado primário não fecha')
    return dict(fontes=fontes, arrecadacao=arrecadacao, repasse=dict(valor=repasse, partes=repasse_partes),
                receita_liquida=receita_liquida, gasto=gasto, resultado=resultado, usos=usos,
                juros_nominais=v('9'), linhas_usadas=sorted(usados, key=lambda c: [int(x) for x in c.split('.')]))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=pathlib.Path)
    p.add_argument('--check', action='store_true', help='só confere que o publicado se reproduz do arquivo do cache')
    args = p.parse_args()
    dados = json.loads(DADOS.read_text())
    cache = args.cache or pathlib.Path(tempfile.mkdtemp(prefix='contas-fontes-'))
    arquivo = cache / 'rtn.xlsx'
    if not arquivo.exists():
        r = requests.get(dados['fonteRTN'], timeout=180)
        r.raise_for_status()
        arquivo.write_bytes(r.content)
    sha = hashlib.sha256(arquivo.read_bytes()).hexdigest()
    check(sha == dados['sha256']['rtn.xlsx'], 'O RTN baixado não é a edição do snapshot; integrar a edição nova pelo importar.py primeiro')
    linhas, rotulos = ler_linhas(arquivo)
    fluxo = montar(linhas, rotulos)
    anual = next(a for a in dados['rtnAnual'] if a['periodo'] == str(ANO))
    for chave, campo in (('arrecadacao', 'receitaTotal'), ('receita_liquida', 'receitaLiquida'), ('gasto', 'despesa'), ('resultado', 'resultado')):
        check(abs(fluxo[chave] - anual[campo]) <= TOLERANCIA, f'Tabela 2.2 diverge da 2.1 publicada em {chave}')
    saida = dict(versao=1, ano=ANO, unidade='R$ milhões correntes', tabela='RTN, tabela 2.2 (anual)',
                 referenciaRTN=dados['referenciaRTN'], fonte=dados['fonteRTN'], sha256=sha,
                 captura=dados['captura'][:10] if args.check else dt.date.today().isoformat(),
                 criterio='Receita pelo ingresso efetivo na Conta Única (caixa); despesa pelo pagamento efetivo; resultado primário acima da linha, sem juros.',
                 **fluxo)
    texto = json.dumps(saida, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        publicado = json.loads(OUT.read_text())
        publicado['captura'] = saida['captura']
        check(json.dumps(publicado, ensure_ascii=False, indent=1) + '\n' == texto, 'Fluxo publicado diverge da reprodução')
        print('Fluxo federal reproduzido a partir do RTN', dados['referenciaRTN'])
        return
    OUT.write_text(texto)
    print('Gravado', OUT.relative_to(ROOT), '·', len(fluxo['linhas_usadas']), 'linhas do RTN conferidas')


if __name__ == '__main__':
    main()
