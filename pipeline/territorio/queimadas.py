"""Queimadas: focos de calor do INPE pelo satélite de referência (AQUA_M-T) e área queimada.

Coleta chamada por pipeline/territorio/run.py (python3 -m pipeline.territorio.run --coleta).

Fontes (Programa Queimadas, INPE, servidor de dados abertos COIDS):
- anual/Brasil_sat_ref/focos_br_ref_AAAA.zip: só focos do satélite de referência,
  um arquivo por ano fechado (2003 em diante).
- mensal/Brasil/focos_mensal_br_AAAAMM.csv: focos de todos os satélites; para o ano
  corrente, sem arquivo anual de referência, filtra-se a coluna satelite == AQUA_M-T.

Nada é estimado: mês sem arquivo fica ausente (None), mês em curso é marcado parcial,
foco sem bioma ou UF reconhecida é contado à parte e nunca descartado em silêncio.
Só biblioteca padrão. Segue o padrão de pipeline/agro/ambiente.py (urllib, sha256 e
bytes do original, normalização em JSON).
"""
import csv
import hashlib
import io
import json
import os
import re
import shutil
import tempfile
import time
import urllib.request
import zipfile
from datetime import date, datetime, timezone

BASE = 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/'
ANUAL_REF = BASE + 'anual/Brasil_sat_ref/'
MENSAL = BASE + 'mensal/Brasil/'
SATELITE_REFERENCIA = 'AQUA_M-T'
LIMITE_BYTES = 1_000_000_000  # arquivos mensais de pico passam de 300 MB

UFS = {
    'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE',
    'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'GOIÁS': 'GO', 'MARANHÃO': 'MA',
    'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG', 'PARÁ': 'PA',
    'PARAÍBA': 'PB', 'PARANÁ': 'PR', 'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'RIO DE JANEIRO': 'RJ',
    'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', 'RONDÔNIA': 'RO', 'RORAIMA': 'RR',
    'SANTA CATARINA': 'SC', 'SÃO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO',
}
BIOMAS = ['Amazônia', 'Cerrado', 'Caatinga', 'Mata Atlântica', 'Pantanal', 'Pampa']
SEM = '(não informado na fonte)'


# ---------------------------------------------------------------- coleta

def _abrir(url, tentativas=5):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Scrutiniums Territorio/1.0; public data, bounded requests'})
            return urllib.request.urlopen(req, timeout=300)
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f'Falha ao abrir {url}: {ultimo}')


def listar(url):
    """Nomes, datas e tamanhos aproximados da listagem Apache do servidor."""
    with _abrir(url) as r:
        html = r.read(5_000_000).decode('utf-8', 'ignore')
    linhas = re.findall(r'href="([^"?/][^"]*)"[^<]*</a></td><td class="indexcollastmod">([^<]*)</td><td class="indexcolsize">\s*([^<]*?)\s*</td>', html)
    return [{'nome': n, 'modificado': m.strip(), 'tamanho': t.strip()} for n, m, t in linhas]


def baixar(url, cache=None, tentativas=5):
    """Baixa para arquivo (temporário ou cache), calcula sha256 e bytes do original."""
    nome = url.rsplit('/', 1)[1]
    if cache:
        destino = os.path.join(cache, nome)
        meta = destino + '.meta.json'
        if os.path.exists(destino) and os.path.exists(meta):
            return destino, json.load(open(meta))
    else:
        destino = tempfile.NamedTemporaryFile(delete=False, suffix='_' + nome).name
    ultimo = None
    for i in range(tentativas):
        try:
            h = hashlib.sha256()
            total = 0
            with _abrir(url) as r, open(destino, 'wb') as f:
                esperado = r.headers.get('Content-Length')
                modificado = r.headers.get('Last-Modified')
                while True:
                    bloco = r.read(1 << 20)
                    if not bloco:
                        break
                    total += len(bloco)
                    if total > LIMITE_BYTES:
                        raise ValueError('Arquivo acima do limite')
                    h.update(bloco)
                    f.write(bloco)
            if esperado is not None and int(esperado) != total:
                raise IOError(f'Transferência truncada: {total} de {esperado} bytes')
            info = {'url': url, 'sha256': h.hexdigest(), 'bytes': total, 'lastModified': modificado,
                    'baixadoEm': datetime.now(timezone.utc).isoformat(timespec='seconds')}
            if cache:
                json.dump(info, open(meta, 'w'))
            return destino, info
        except Exception as e:
            ultimo = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


# ---------------------------------------------------------------- leitura

class Contagem:
    """Contagens de um conjunto de focos: por mês, UF e bioma, mais data mínima e máxima."""

    def __init__(self):
        self.total = 0
        self.mes = {}
        self.uf = {}
        self.bioma = {}
        self.dia_min = None
        self.dia_max = None
        self.estranhos = {}

    def somar(self, data, estado, bioma, pais):
        if pais not in ('Brasil', 'BRASIL'):
            self.estranhos['pais:' + pais] = self.estranhos.get('pais:' + pais, 0) + 1
        dia = data[:10]
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', dia):
            raise ValueError('Data inválida na fonte: ' + data)
        self.total += 1
        self.mes[dia[:7]] = self.mes.get(dia[:7], 0) + 1
        sigla = UFS.get(estado.strip().upper(), SEM)
        if sigla == SEM:
            self.estranhos['estado:' + estado] = self.estranhos.get('estado:' + estado, 0) + 1
        self.uf[sigla] = self.uf.get(sigla, 0) + 1
        b = bioma.strip() or SEM
        if b not in BIOMAS and b != SEM:
            self.estranhos['bioma:' + b] = self.estranhos.get('bioma:' + b, 0) + 1
        self.bioma[b] = self.bioma.get(b, 0) + 1
        self.dia_min = dia if self.dia_min is None or dia < self.dia_min else self.dia_min
        self.dia_max = dia if self.dia_max is None or dia > self.dia_max else self.dia_max


def ler_anual_ref(caminho):
    """Arquivo anual do satélite de referência: zip com um CSV, sem coluna de satélite."""
    c = Contagem()
    with zipfile.ZipFile(caminho) as z:
        csvs = [n for n in z.namelist() if n.lower().endswith('.csv')]
        if len(csvs) != 1:
            raise ValueError(f'Zip anual com {len(csvs)} CSVs')
        with z.open(csvs[0]) as f:
            leitor = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8', newline=''))
            faltam = {'data_pas', 'estado', 'bioma', 'pais'} - set(leitor.fieldnames or [])
            if faltam:
                raise ValueError(f'Colunas ausentes no anual: {faltam}')
            for linha in leitor:
                c.somar(linha['data_pas'], linha['estado'], linha['bioma'], linha['pais'].strip())
    return c


def ler_mensal(caminho, satelite=SATELITE_REFERENCIA):
    """Arquivo mensal de todos os satélites: filtra a coluna satelite."""
    c = Contagem()
    satelites = {}
    with open(caminho, encoding='utf-8', newline='') as f:
        leitor = csv.DictReader(f)
        faltam = {'data_hora_gmt', 'satelite', 'estado', 'bioma', 'pais'} - set(leitor.fieldnames or [])
        if faltam:
            raise ValueError(f'Colunas ausentes no mensal: {faltam}')
        for linha in leitor:
            s = linha['satelite']
            satelites[s] = satelites.get(s, 0) + 1
            if s == satelite:
                c.somar(linha['data_hora_gmt'], linha['estado'], linha['bioma'], linha['pais'].strip())
    if satelite not in satelites and satelites:
        raise ValueError('Satélite de referência ausente do arquivo mensal; verificar mudança de referência')
    return c, satelites


# ---------------------------------------------------------------- montagem

def _juntar(contagens):
    """Soma contagens de meses distintos num só conjunto."""
    t = Contagem()
    for c in contagens:
        t.total += c.total
        for alvo, origem in ((t.mes, c.mes), (t.uf, c.uf), (t.bioma, c.bioma), (t.estranhos, c.estranhos)):
            for k, v in origem.items():
                alvo[k] = alvo.get(k, 0) + v
        if c.dia_min:
            t.dia_min = c.dia_min if t.dia_min is None or c.dia_min < t.dia_min else t.dia_min
            t.dia_max = c.dia_max if t.dia_max is None or c.dia_max > t.dia_max else t.dia_max
    return t


def _lista(contagens, nomes=None):
    itens = [{'id': k, 'focos': v} for k, v in contagens.items()]
    if nomes:
        for k in nomes:
            if k not in contagens:
                # Zero só quando o arquivo existe, foi lido inteiro e não tem foco ali.
                itens.append({'id': k, 'focos': 0})
    return sorted(itens, key=lambda x: (-x['focos'], x['id']))


AQ1KM_CSV = 'https://dataserver-coids.inpe.br/queimadas/queimadas/area_queimada/colecao2/csv/aq1km_biomas_v2.csv'


def area_queimada(hoje, cache=None):
    """AQ1km Coleção 2: área queimada mensal por bioma em km² (produto provisório do INPE)."""
    caminho, info = baixar(AQ1KM_CSV, cache)
    with open(caminho, encoding='utf-8-sig', newline='') as f:
        linhas = list(csv.reader(f))
    if not cache:
        os.unlink(caminho)
    cab = linhas[0]
    esperado = ['Ano', 'Mês'] + sorted(BIOMAS) + ['Total mensal']
    if cab != esperado:
        raise ValueError(f'Cabeçalho do AQ1km mudou: {cab}')
    meses, anuais, ano_atual, acum = [], [], None, None
    for l in linhas[1:]:
        if not any(l):
            continue
        valores = [float(v) if v != '' else None for v in l[2:]]
        if any(v is None for v in valores):
            raise ValueError('AQ1km com célula vazia: ' + ','.join(l))
        if l[0] == 'Total anual':
            if ano_atual is None or [round(a, 3) for a in valores] != [round(a, 3) for a in acum]:
                raise ValueError(f'Total anual do AQ1km não reconcilia em {ano_atual}')
            meses_do_ano = [m for m in meses if m['mes'].startswith(str(ano_atual))]
            completo = len(meses_do_ano) == 12
            anuais.append({'ano': ano_atual, 'km2': dict(zip(cab[2:-1], valores[:-1])), 'totalKm2': valores[-1],
                           'parcial': not completo, 'meses': len(meses_do_ano)})
            ano_atual, acum = None, None
            continue
        ano, mes = int(l[0]), int(l[1])
        if abs(sum(valores[:-1]) - valores[-1]) > 0.5:
            raise ValueError(f'Total mensal do AQ1km não reconcilia em {ano}-{mes:02d}')
        if ano_atual is None:
            ano_atual, acum = ano, [0.0] * len(valores)
        acum = [a + v for a, v in zip(acum, valores)]
        meses.append({'mes': f'{ano}-{mes:02d}', 'km2': dict(zip(cab[2:-1], valores[:-1])), 'totalKm2': valores[-1]})
    return {
        'id': 'aq1km_colecao2_biomas',
        'url': AQ1KM_CSV,
        'original': {k: info[k] for k in ('sha256', 'bytes', 'lastModified')},
        'unidade': 'km² de área queimada mapeada (pixel de 1 km, MODIS AQUA e TERRA)',
        'maturidade': 'Provisório (INPE): sujeito a revisão; publicações devem indicar a qualidade provisória',
        'mensal': meses,
        'anual': anuais,
        'ressalvas': [
            'Estimativa ampla em resolução de 1 km; o INPE recomenda produtos de 30 m para precisão geográfica.',
            'Sem recorte por UF no CSV; por UF exigiria cruzar shapefile mensal com a malha estadual.',
            'Não comparável diretamente com MapBiomas Fogo ou MCD64 (métodos e resoluções diferentes).',
            'Coleção 2 (fev/2026) reprocessou toda a série; números diferem da Coleção 1.',
        ],
    }


def montar(hoje, cache=None, anos=None):
    capturado = datetime.now(timezone.utc).isoformat(timespec='seconds')
    ultimo_ano_completo = hoje.year - 1
    ano_corrente = hoje.year
    ultimo_mes_completo = hoje.month - 1  # 0 quando estamos em janeiro
    originais = {}

    # 1) Série anual consolidada do satélite de referência.
    disponiveis = {int(m.group(1)): it for it in listar(ANUAL_REF) if (m := re.fullmatch(r'focos_br_ref_(\d{4})\.zip', it['nome']))}
    if anos:
        disponiveis = {a: v for a, v in disponiveis.items() if a in anos or a >= ultimo_ano_completo}
    anual, por_ano = [], {}
    for ano in sorted(disponiveis):
        caminho, info = baixar(ANUAL_REF + disponiveis[ano]['nome'], cache)
        c = ler_anual_ref(caminho)
        if not cache:
            os.unlink(caminho)
        originais[info['url']] = {k: info[k] for k in ('sha256', 'bytes', 'lastModified')}
        if c.dia_min[:4] != str(ano) or c.dia_max[:4] != str(ano):
            raise ValueError(f'Arquivo anual {ano} com datas fora do ano: {c.dia_min} a {c.dia_max}')
        por_ano[ano] = c
        anual.append({'ano': ano, 'focos': c.total, 'parcial': False, 'primeiroDia': c.dia_min, 'ultimoDia': c.dia_max,
                      'origem': 'anual_sat_ref', 'arquivo': info['url'], 'estranhos': c.estranhos or None})

    mensais = {it['nome']: it for it in listar(MENSAL)}

    # 1b) Em janeiro e início de fevereiro o consolidado do ano recém-encerrado ainda não existe
    # (o de 2025 saiu em 11/02/2026): o ano é montado dos 12 arquivos mensais filtrados para o
    # satélite de referência e marcado como preliminar, em vez de deixar a série com um buraco.
    meses_anterior_cont = None
    if ultimo_ano_completo not in disponiveis and disponiveis and max(disponiveis) == ultimo_ano_completo - 1:
        meses_anterior_cont = []
        for m in range(1, 13):
            nome = f'focos_mensal_br_{ultimo_ano_completo}{m:02d}.csv'
            if nome not in mensais:
                raise ValueError(f'Consolidado de {ultimo_ano_completo} ausente e mês {m:02d} sem arquivo mensal: série retida')
            caminho, info = baixar(MENSAL + nome, cache)
            c, _ = ler_mensal(caminho)
            if not cache:
                os.unlink(caminho)
            originais[info['url']] = {k: info[k] for k in ('sha256', 'bytes', 'lastModified')}
            if set(c.mes) - {f'{ultimo_ano_completo}-{m:02d}'}:
                raise ValueError(f'Arquivo mensal {ultimo_ano_completo}-{m:02d} com focos de outro mês')
            meses_anterior_cont.append(c)
        c = _juntar(meses_anterior_cont)
        por_ano[ultimo_ano_completo] = c
        anual.append({'ano': ultimo_ano_completo, 'focos': c.total, 'parcial': False, 'preliminar': True,
                      'primeiroDia': c.dia_min, 'ultimoDia': c.dia_max, 'origem': 'mensal_todos_sats_filtrado',
                      'nota': 'Consolidado anual do INPE ainda não publicado: soma dos 12 arquivos mensais filtrados para o satélite de referência; pode mudar quando o consolidado sair.'})

    # 2) Ano corrente: arquivos mensais de todos os satélites, filtrados.
    corrente = Contagem()
    meses_corrente = []
    satelites_vistos = {}
    for m in range(1, hoje.month + 1):
        nome = f'focos_mensal_br_{ano_corrente}{m:02d}.csv'
        chave = f'{ano_corrente}-{m:02d}'
        if nome not in mensais:
            meses_corrente.append({'mes': chave, 'focos': None, 'parcial': m == hoje.month, 'motivo': 'arquivo mensal ausente no servidor'})
            continue
        caminho, info = baixar(MENSAL + nome, cache)
        c, sats = ler_mensal(caminho)
        if not cache:
            os.unlink(caminho)
        originais[info['url']] = {k: info[k] for k in ('sha256', 'bytes', 'lastModified')}
        satelites_vistos[chave] = sats
        if set(c.mes) - {chave}:
            raise ValueError(f'Arquivo mensal {chave} com focos de outro mês: {sorted(c.mes)}')
        parcial = m == hoje.month
        meses_corrente.append({'mes': chave, 'focos': c.total, 'parcial': parcial,
                               'ultimoDiaComFoco': c.dia_max, 'origem': 'mensal_todos_sats_filtrado', 'arquivo': info['url']})
        if not parcial:
            for k, v in c.uf.items():
                corrente.uf[k] = corrente.uf.get(k, 0) + v
            for k, v in c.bioma.items():
                corrente.bioma[k] = corrente.bioma.get(k, 0) + v
            corrente.total += c.total
        corrente.estranhos.update({f'{chave}:{k}': v for k, v in c.estranhos.items()})

    # Meses do ano anterior, do arquivo anual consolidado.
    anterior = por_ano.get(ultimo_ano_completo)
    origem_anterior = 'mensal_todos_sats_filtrado' if meses_anterior_cont is not None else 'anual_sat_ref'
    meses_anterior = None
    if anterior:
        meses_anterior = [{'mes': f'{ultimo_ano_completo}-{m:02d}', 'focos': anterior.mes.get(f'{ultimo_ano_completo}-{m:02d}', 0), 'parcial': False,
                           'origem': origem_anterior} for m in range(1, 13)]

    completos = [x for x in meses_corrente if not x['parcial']]
    lacuna = any(x['focos'] is None for x in completos)
    acumulado = None if lacuna or not completos else sum(x['focos'] for x in completos)
    parcial_mes = next((x for x in meses_corrente if x['parcial']), None)
    anual.append({'ano': ano_corrente, 'focos': None if lacuna else sum(x['focos'] for x in meses_corrente if x['focos'] is not None),
                  'parcial': True, 'primeiroDia': f'{ano_corrente}-01-01',
                  'ultimoDia': parcial_mes.get('ultimoDiaComFoco') if parcial_mes else None,
                  'origem': 'mensal_todos_sats_filtrado',
                  'nota': 'Ano em curso: soma dos meses disponíveis, inclusive o mês corrente incompleto. Não comparar com anos fechados.'})

    # Mesmo período do ano anterior, para comparação justa.
    periodo_meses = [f'{ultimo_ano_completo}-{m:02d}' for m in range(1, ultimo_mes_completo + 1)]
    mesmo_periodo = None
    if anterior and ultimo_mes_completo >= 1:
        mesmo_periodo = sum(anterior.mes.get(k, 0) for k in periodo_meses)

    # UF e bioma do ano anterior no mesmo período exigem recontagem por mês; a Contagem
    # anual guarda só totais por UF, então refazemos a leitura com filtro de mês.
    uf_mesmo, bioma_mesmo = None, None
    if anterior and ultimo_mes_completo >= 1 and meses_anterior_cont is not None:
        cm = _juntar(meses_anterior_cont[:ultimo_mes_completo])
        if cm.total != mesmo_periodo:
            raise ValueError('Mesmo período do ano anterior não reconcilia')
        uf_mesmo, bioma_mesmo = cm.uf, cm.bioma
    elif anterior and ultimo_mes_completo >= 1:
        caminho, _ = baixar(ANUAL_REF + disponiveis[ultimo_ano_completo]['nome'], cache)
        cm = Contagem()
        with zipfile.ZipFile(caminho) as z:
            n = [x for x in z.namelist() if x.lower().endswith('.csv')][0]
            with z.open(n) as f:
                for linha in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8', newline='')):
                    if int(linha['data_pas'][5:7]) <= ultimo_mes_completo:
                        cm.somar(linha['data_pas'], linha['estado'], linha['bioma'], linha['pais'].strip())
        if not cache:
            os.unlink(caminho)
        if cm.total != mesmo_periodo:
            raise ValueError('Mesmo período do ano anterior não reconcilia')
        uf_mesmo, bioma_mesmo = cm.uf, cm.bioma

    def bloco(rotulo, periodo, total, uf, bioma, origem):
        if total is None:
            return {'rotulo': rotulo, 'periodo': periodo, 'focos': None, 'motivo': 'mês sem arquivo no período'}
        if sum(uf.values()) != total or sum(bioma.values()) != total:
            raise ValueError(f'UF ou bioma não reconciliam com o total em {rotulo}')
        return {'rotulo': rotulo, 'periodo': periodo, 'focos': total, 'origem': origem,
                'porUF': _lista(uf, list(UFS.values())), 'porBioma': _lista(bioma, BIOMAS)}

    recortes = []
    if anterior:
        recortes.append(bloco('ultimoAnoCompleto', {'inicio': f'{ultimo_ano_completo}-01-01', 'fim': f'{ultimo_ano_completo}-12-31'},
                              anterior.total, anterior.uf, anterior.bioma, origem_anterior))
    if ultimo_mes_completo >= 1:
        fim = date(ano_corrente, ultimo_mes_completo + 1, 1).toordinal() - 1
        recortes.append(bloco('acumuladoAnoCorrente', {'inicio': f'{ano_corrente}-01-01', 'fim': date.fromordinal(fim).isoformat()},
                              acumulado, corrente.uf, corrente.bioma, 'mensal_todos_sats_filtrado'))
        if uf_mesmo is not None:
            fim_a = date(ultimo_ano_completo, ultimo_mes_completo + 1, 1).toordinal() - 1
            recortes.append(bloco('mesmoPeriodoAnoAnterior', {'inicio': f'{ultimo_ano_completo}-01-01', 'fim': date.fromordinal(fim_a).isoformat()},
                                  mesmo_periodo, uf_mesmo, bioma_mesmo, origem_anterior))

    return {
        'id': 'queimadas_focos_referencia',
        'capturadoEm': capturado,
        'dataReferencia': hoje.isoformat(),
        'fonte': {
            'nome': 'INPE, Programa Queimadas, focos de calor (servidor de dados abertos COIDS)',
            'url': BASE,
            'portal': 'https://terrabrasilis.dpi.inpe.br/queimadas/portal/pages/secao_downloads/dados-abertos/',
            'licenca': 'Dados públicos e gratuitos (FAQ 3 do Programa Queimadas); citação obrigatória conforme FAQ 36 (INPE, Banco de Dados de Queimadas). Licença formal de redistribuição não declarada no servidor.',
        },
        'sateliteReferencia': {'id': SATELITE_REFERENCIA, 'sensor': 'MODIS, passagem do início da tarde', 'desde': '2002-07-04',
                               'antes': 'NOAA-12 (AVHRR, fim da tarde), 1998-06-01 a 2002-07-03; série anual de referência aberta começa em 2003'},
        'unidade': 'focos (pixels com fogo ativo detectados pelo satélite de referência; contagem, não área nem número de incêndios)',
        'anual': anual,
        'mensal': {str(ultimo_ano_completo): meses_anterior, str(ano_corrente): meses_corrente},
        'recortes': recortes,
        'satelitesNoArquivoMensal': satelites_vistos,
        'originais': originais,
        'ressalvas': [
            'Foco não é área queimada nem número de incêndios: um foco indica fogo ativo em um pixel (cerca de 1 km no MODIS); um incêndio grande gera vários focos e queimadas pequenas, rasteiras ou sob nuvem não são detectadas (FAQ 9 a 11 do INPE).',
            'Só o satélite de referência permite comparar anos e regiões; somar todos os satélites conta o mesmo fogo várias vezes e muda com a constelação disponível (FAQ 7, 16 e 17).',
            'O número indica uma fração das ocorrências reais; serve para tendência, não como medida absoluta (FAQ 10).',
            'O AQUA está muito além da vida útil prevista e teve dias sem imageamento de parte da América do Sul (por exemplo 10/07, 22/07 e 12/08/2026, aviso do INPE); nesses dias não há dado de referência para as áreas afetadas, o que reduz a contagem sem significar ausência de fogo.',
            'Ano e mês em curso são parciais; arquivos mensais podem ser regenerados pelo INPE (os de 2024 e do primeiro semestre de 2026 foram refeitos depois), então números recentes são preliminares.',
            'UF e bioma vêm da própria fonte (malha IBGE usada pelo INPE); focos sem bioma informado aparecem à parte, sem descarte.',
        ],
    }
