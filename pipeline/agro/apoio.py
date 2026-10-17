"""Pergunta 6 do Agro: juros do crédito rural (BCB/Sicor) e pagamentos do Tesouro (subvenções).

A semente guarda só os agregados usados, com sha256 e tamanho de cada arquivo original.
Microdados por contrato não são versionados.
"""
import csv
import gzip
import hashlib
import io
import json
import time
import urllib.request
from datetime import date, timedelta

from .run import numero

SICOR = 'https://www.bcb.gov.br/htms/sicor/'
CKAN = 'https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=02a3f828-6fbb-4062-bf13-080bfc022298'
SELIC = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados?formato=json&dataInicial=01/01/{ano}'
# Código 9 da tabela de encargos complementares do Sicor: taxa sem indexador. Nos demais
# códigos (CDI, TLP, IPCA...), VL_JUROS é só a parte fixa e não se compara.
SEM_INDEXADOR = '9'
PROGRAMAS = {'0001': 'pronaf', '0050': 'pronamp'}
ACOES_AGRO = {'0281': 'Pronaf', '0294': 'Custeio agropecuário', '0301': 'Investimento rural', '0298': 'Comercialização', '0611': 'Alongamento de dívidas rurais (PESA e securitização)', '0265': 'Proagro, indenizações', '0297': 'Cacau', '00RW': 'Investimento de cerealistas', '00PL': 'FAT Giro Rural', '00GW': 'Garantia, agricultura familiar'}

FONTES = {
    'sicor': {'arquivo': 'sicor.json.gz', 'url': 'https://www.bcb.gov.br/estabilidadefinanceira/tabelas-credito-rural-proagro', 'nome': 'BCB, Sicor, microdados de operações de crédito rural', 'licenca': 'Dados abertos do BCB; citar a fonte', 'limite': 'Taxa contratada informada pela instituição, em % ao ano, média ponderada pelo valor de cada contrato. Só contratos sem indexador; os indexados (CDI, TLP, IPCA) ficam fora da média. O mês mais recente pode ser completado em revisões.'},
    'tesouro': {'arquivo': 'tesouro.json.gz', 'url': 'https://www.tesourotransparente.gov.br/ckan/dataset/subidios-financeiros', 'nome': 'Tesouro Nacional, pagamentos de subvenções econômicas (Tesouro Transparente)', 'licenca': 'Creative Commons Atribuição', 'limite': 'Pagamentos do ano, em R$ correntes; referem-se a contratos de safras anteriores. Não inclui subvenção ao prêmio do seguro rural (PSR), renúncia tributária nem o custo dos fundos constitucionais.'},
}


def _bytes(url, tentativas=4):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Scrutiniums Agro/1.0; public data, bounded requests'})
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read(200_000_001)
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


def _csv(raw, sep=';'):
    texto = raw.decode('latin1')
    return list(csv.reader(io.StringIO(texto), delimiter=sep))


def _grupo_fonte(descricao):
    d = descricao.upper()
    if 'EQUALIZ' in d:
        return 'equalizada'
    if 'NÃO CONTROLADA' in d or 'LIVRE/NÃO' in d:
        return 'livre'
    return 'controlada'


def _coletar_sicor(hoje=None):
    hoje = hoje or date.today()
    fontes_raw = _bytes(SICOR + 'FonteRecursos.csv')
    fontes = {l[0]: l[1] for l in _csv(fontes_raw)[1:] if len(l) >= 2}
    agregado, originais, ultima_data = {}, {}, ''
    for ano in (hoje.year - 1, hoje.year):
        nome = f'DadosBrutos/SICOR_OPERACAO_BASICA_ESTADO_{ano}.gz'
        raw = _bytes(SICOR + nome)
        originais[nome] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        leitor = csv.reader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw)), encoding='latin1'), delimiter=';')
        cab = [c.lstrip('#') for c in next(leitor)]
        ix = {c: i for i, c in enumerate(cab)}
        for l in leitor:
            dt = l[ix['DT_EMISSAO']]
            mes = dt[6:10] + '-' + dt[3:5]
            ultima_data = max(ultima_data, dt[6:10] + '-' + dt[3:5] + '-' + dt[0:2])
            valor = float(l[ix['VL_PARC_CREDITO']] or 0)
            programa = PROGRAMAS.get(l[ix['CD_PROGRAMA']], 'demais')
            fonte = _grupo_fonte(fontes.get(l[ix['CD_FONTE_RECURSO']], ''))
            chave = f'{mes}|{programa}|{fonte}'
            a = agregado.setdefault(chave, {'valorTotal': 0.0, 'contratosTotal': 0, 'valorTaxa': 0.0, 'somaTaxa': 0.0, 'contratosTaxa': 0})
            a['valorTotal'] += valor
            a['contratosTotal'] += 1
            juros = l[ix['VL_JUROS']]
            if l[ix['CD_TIPO_ENCARG_FINANC']] == SEM_INDEXADOR and juros and valor > 0:
                a['valorTaxa'] += valor
                a['somaTaxa'] += valor * float(juros)
                a['contratosTaxa'] += 1
    selic = json.loads(_bytes(SELIC.format(ano=hoje.year - 1)))
    return {'originais': originais, 'ultimaEmissao': ultima_data, 'fontesRecursos': {k: fontes[k] for k in sorted(fontes)}, 'agregado': {k: agregado[k] for k in sorted(agregado)}, 'selic': selic}


def _coletar_tesouro():
    pacote = json.loads(_bytes(CKAN))['result']
    recurso = next(r for r in pacote['resources'] if r['name'].strip().lower() == 'pagamentos')
    raw = _bytes(recurso['url'])
    linhas = _csv(raw)
    cab = linhas[0]
    ix = {c: i for i, c in enumerate(cab)}
    soma = {}
    for l in linhas[1:]:
        if len(l) < len(cab):
            continue
        acao = l[ix['CO_ACAO']]
        if acao not in ACOES_AGRO:
            continue
        ano = l[ix['DT_PAGAMENTO']][6:10]
        chave = f'{ano}|{acao}'
        soma[chave] = soma.get(chave, 0.0) + float(l[ix['VL_PAGAMENTO']].replace('.', '').replace(',', '.'))
    ultima = max(l[ix['DT_PAGAMENTO']][6:10] + '-' + l[ix['DT_PAGAMENTO']][3:5] for l in linhas[1:] if len(l) >= len(cab))
    return {'url': recurso['url'], 'atualizadoNaFonte': recurso.get('last_modified'), 'sha256Original': hashlib.sha256(raw).hexdigest(), 'bytesOriginal': len(raw), 'ultimoMesPagamento': ultima, 'pagamentos': {k: soma[k] for k in sorted(soma)}}


def coletar():
    return {'sicor': _coletar_sicor(), 'tesouro': _coletar_tesouro()}


# ---------------------------------------------------------------- normalização

def _media(rows):
    v = sum(r['valorTaxa'] for r in rows)
    return sum(r['somaTaxa'] for r in rows) / v if v > 0 else None


def normalizar_sicor(bundle):
    linhas = []
    for chave, a in bundle['agregado'].items():
        mes, programa, fonte = chave.split('|')
        if a['valorTaxa'] > a['valorTotal'] + 1e-6 or a['contratosTaxa'] > a['contratosTotal']:
            raise ValueError('Recorte da taxa maior que o total em ' + chave)
        linhas.append({'mes': mes, 'programa': programa, 'fonte': fonte, **a})
    meses = sorted({l['mes'] for l in linhas})
    # Completude pelo calendário da fonte: o mês da emissão mais recente só entra se essa data
    # for o último dia do mês. Volume contratado não decide, porque varia com a safra.
    ultima = bundle['ultimaEmissao']
    ano_u, mes_u, dia_u = int(ultima[:4]), int(ultima[5:7]), int(ultima[8:10])
    fim_mes = (date(ano_u + (mes_u == 12), mes_u % 12 + 1, 1) - timedelta(days=1)).day
    if meses and meses[-1] == ultima[:7] and dia_u < fim_mes:
        meses.pop()
    if meses and meses[-1] > ultima[:7]:
        raise ValueError('Mês de emissão posterior à última data da fonte')
    serie = []
    for m in meses:
        sel = [l for l in linhas if l['mes'] == m]
        item = {'mes': m, 'valor': sum(l['valorTotal'] for l in sel), 'contratos': sum(l['contratosTotal'] for l in sel), 'coberturaTaxa': sum(l['valorTaxa'] for l in sel) / max(1e-9, sum(l['valorTotal'] for l in sel)), 'geral': _media(sel)}
        for p in ['pronaf', 'pronamp', 'demais']:
            item[p] = _media([l for l in sel if l['programa'] == p])
        for f in ['equalizada', 'controlada', 'livre']:
            item[f] = _media([l for l in sel if l['fonte'] == f])
            item['valor_' + f] = sum(l['valorTotal'] for l in sel if l['fonte'] == f)
        serie.append(item)
    if [s['mes'] for s in serie] != meses or len(serie) < 12:
        raise ValueError('Série de juros do Sicor curta demais')
    selic = {f"{r['data'][6:10]}-{r['data'][3:5]}": numero(r['valor']) for r in bundle['selic']}
    for s in serie:
        s['selic'] = selic.get(s['mes'])
    return {'ultimoMes': meses[-1], 'meses': serie, 'gruposFonte': {k: _grupo_fonte(v) for k, v in bundle['fontesRecursos'].items()}, 'fonte': 'sicor'}


def normalizar_tesouro(bundle):
    anos = {}
    for chave, valor in bundle['pagamentos'].items():
        ano, acao = chave.split('|')
        anos.setdefault(int(ano), {})[acao] = valor
    linhas = [{'ano': a, 'total': sum(v.values()), 'acoes': {k: v.get(k, 0.0) for k in ACOES_AGRO}} for a, v in sorted(anos.items())]
    if len(linhas) < 5 or [l['ano'] for l in linhas] != list(range(linhas[0]['ano'], linhas[-1]['ano'] + 1)):
        raise ValueError('Série de pagamentos do Tesouro com ano ausente')
    ultimo = bundle['ultimoMesPagamento']
    return {'acoes': ACOES_AGRO, 'anos': linhas, 'ultimoMesPagamento': ultimo, 'atualizadoNaFonte': bundle['atualizadoNaFonte'], 'fonte': 'tesouro'}


def normalizar(coletas):
    return {'apoio': {'juros': normalizar_sicor(coletas['sicor']), 'pagamentos': normalizar_tesouro(coletas['tesouro'])}}
