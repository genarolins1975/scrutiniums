"""Emissões de gases de efeito estufa do Brasil pelo inventário oficial (MCTI, SIRENE).

Fonte: planilhas de resultados do Relatório do Inventário Nacional (NIR 2024, série 1990 a 2022),
publicadas pelo MCTI no SIRENE e apontadas na tabela "Planilhas para download" do painel
"SIRENE - Emissões de GEE por Setor". Mesma base do inventário comunicado à UNFCCC no
Primeiro Relatório Bienal de Transparência (BTR1, dezembro de 2024).

Só biblioteca padrão e o curl do sistema (o firewall do gov.br recusa o urllib). Coleta chamada por
pipeline/territorio/run.py: descobre as planilhas vigentes pelo painel público do SIRENE (com as URLs
fixas do NIR 2024 como alternativa), baixa para uma pasta temporária (ou --cache) e guarda no seed só os
agregados, com sha256 e bytes de cada original.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import uuid
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

BASE = 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/arquivos/2024/nir_2024_1990-2022_{}.xlsx'
SETORES = [  # chave, arquivo, rótulo da linha no total Brasil
    ('energia', 'energia', '1. Energia'),
    ('ippu', 'ippu', '2. Processos industriais'),
    ('agropecuaria', 'agropecuaria', '3. Agropecuária'),
    ('lulucf', 'lulucf', '4. Uso da Terra'),
    ('residuos', 'residuos', '5. Resíduos'),
]
METRICAS = {'CO2e_GWP_AR5': 'GWP AR5 (100 anos)', 'CO2e_GTP_AR5': 'GTP AR5 (100 anos)', 'CO2e_GWP_SAR': 'GWP SAR (100 anos)'}
# GWP de 100 anos do AR5 (IPCC 2013, tabela 8.A.1, sem retroalimentação clima e carbono), usado
# só para converter as abas por gás em CO2e e conferir contra as abas CO2e oficiais.
GWP_AR5 = {'CO2': 1, 'CH4': 28, 'N2O': 265, 'HFC-23': 12400, 'HFC-32': 677, 'HFC-125': 3170, 'HFC-134a': 1300,
           'HFC-143a': 4800, 'HFC-152a': 138, 'HFC-227ea': 3350, 'HFC-365mfc': 804, 'CF4': 6630, 'C2F6': 11100, 'SF6': 23500}
PBI_HOST = 'https://wabi-brazil-south-b-primary-api.analysis.windows.net/public/reports/'
PBI_SETOR = ('f2c5cdb8-415c-4acf-8202-d8d49d67240e', 1821679)  # painel "SIRENE - Emissões de GEE por Setor"
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Scrutiniums/1.0'

# ------------------------------------------------------------------ rede

def _via_urllib(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read(30_000_001)


def _via_curl(url):
    # O firewall do gov.br (F5) devolve o desafio a toda requisição do urllib e deixa passar o
    # curl do sistema (diferença de assinatura TLS/HTTP2, por inferência). O curl é ferramenta do
    # sistema, não dependência Python; respeita HTTPS_PROXY e o certificado do ambiente.
    r = subprocess.run(['curl', '-sS', '-L', '--max-time', '180', '--max-filesize', '30000000', '-A', UA,
                        '-H', 'Accept-Language: pt-BR,pt;q=0.9', url], capture_output=True, timeout=200)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode('utf-8', 'ignore').strip())
    return r.stdout


def baixar(url, tentativas=6):
    """Baixa um .xlsx. O gov.br responde com uma página de desafio anti robô (HTML com status 200);
    isso não é dado, então a função tenta urllib e curl, espera e repete, e falha se persistir."""
    ultimo = None
    for i in range(tentativas):
        for meio in (_via_urllib, _via_curl):
            try:
                raw = meio(url)
                if len(raw) > 30_000_000:
                    raise ValueError('arquivo acima do limite')
                if raw[:2] == b'PK':
                    return raw
                ultimo = f'{meio.__name__}: resposta não é planilha (desafio anti robô do gov.br)'
            except Exception as e:  # rede instável
                ultimo = f'{meio.__name__}: {e}'
        time.sleep(5 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


def descobrir():
    """Lê a tabela 'Planilhas para download' do painel público do SIRENE e devolve, por setor,
    a planilha do inventário mais recente (prefixo nir_AAAA). Sem autenticação: é o mesmo pedido
    que o navegador faz ao abrir o painel publicado na web."""
    chave, modelo = PBI_SETOR
    sel = [{'Column': {'Expression': {'SourceRef': {'Source': 't'}}, 'Property': p}, 'Name': f'T.{p}'} for p in ('Planilhas para download', 'Link')]
    corpo = {'version': '1.0.0', 'modelId': modelo, 'cancelQueries': [], 'queries': [{'Query': {'Commands': [{'SemanticQueryDataShapeCommand': {
        'Query': {'Version': 2, 'From': [{'Name': 't', 'Entity': 'Tabela_links', 'Type': 0}], 'Select': sel},
        'Binding': {'Primary': {'Groupings': [{'Projections': [0, 1]}]}, 'DataReduction': {'DataVolume': 4, 'Primary': {'Window': {'Count': 500}}}, 'Version': 1}}}]}}]}
    req = urllib.request.Request(PBI_HOST + 'querydata?synchronous=true', data=json.dumps(corpo).encode(), headers={
        'X-PowerBI-ResourceKey': chave, 'Content-Type': 'application/json', 'ActivityId': str(uuid.uuid4()), 'RequestId': str(uuid.uuid4()),
        'Origin': 'https://app.powerbi.com', 'Referer': 'https://app.powerbi.com/', 'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        texto = r.read().decode('utf-8')
    links = sorted(set(re.findall(r'https://www\.gov\.br/mcti/[^"\\]+?\.xlsx', texto)))
    nir = {}
    for u in links:
        m = re.search(r'/nir_(\d{4})_1990-(\d{4})_([a-z]+)\.xlsx$', u)
        if m:
            ed, setor = (int(m.group(1)), int(m.group(2))), m.group(3)
            if setor not in nir or ed > nir[setor][0]:
                nir[setor] = (ed, u)
    if 'totalbrasil' not in nir:
        raise RuntimeError('Painel do SIRENE sem planilha nir_* do total Brasil')
    return {s: u for s, (_, u) in nir.items()}, links

# ------------------------------------------------------------------ planilha (zip + XML)

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def _col(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def ler_abas(caminho):
    """{nome da aba (sem espaços nas pontas): lista de linhas como texto}."""
    out = {}
    with zipfile.ZipFile(caminho) as z:
        sst = []
        if 'xl/sharedStrings.xml' in z.namelist():
            sst = [''.join(t.text or '' for t in si.iter(f"{{{NS['m']}}}t")) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for s in wb.find('m:sheets', NS):
            alvo = rels[s.get(f"{{{NS['r']}}}id")].lstrip('/')
            alvo = alvo if alvo.startswith('xl/') else 'xl/' + alvo
            linhas = []
            for row in ET.fromstring(z.read(alvo)).iter(f"{{{NS['m']}}}row"):
                vals = {}
                for c in row.findall('m:c', NS):
                    v = c.find('m:v', NS)
                    t = c.get('t')
                    if t == 's' and v is not None:
                        val = sst[int(v.text)]
                    elif t == 'inlineStr':
                        val = ''.join(x.text or '' for x in c.iter(f"{{{NS['m']}}}t"))
                    else:
                        val = v.text if v is not None else ''
                    vals[_col(c.get('r'))] = val
                linhas.append([vals.get(i, '') for i in range(max(vals) + 1)] if vals else [])
            out[s.get('name').strip()] = linhas
    return out


def tabela(linhas):
    """Acha o cabeçalho (primeira célula com a unidade, depois os anos) e devolve
    (rótulo da unidade, anos, [(rótulo, {ano: valor})]). Célula vazia vira None, nunca zero."""
    h = next(i for i, l in enumerate(linhas) if len(l) > 1 and l[1].strip() == '1990')
    cab = linhas[h]
    anos = []
    for c in cab[1:]:
        if not re.fullmatch(r'\d{4}', c.strip()):
            break
        anos.append(int(c))
    if anos != list(range(anos[0], anos[-1] + 1)):
        raise ValueError('Série com ano ausente no cabeçalho')
    corpo = []
    for l in linhas[h + 1:]:
        if not l or not l[0].strip():
            continue
        vals = {}
        for j, a in enumerate(anos):
            c = l[j + 1].strip() if j + 1 < len(l) else ''
            vals[a] = float(c) if c not in ('', '-', 'NO', 'NE', 'NA', 'IE') else None
        corpo.append((re.sub(r'\s+', ' ', l[0]).strip(), vals))
    return re.sub(r'\s+', ' ', cab[0]).strip(), anos, corpo


def _codigo(rotulo):
    m = re.match(r'^(\d(?:\.[A-Z](?:\.\d+(?:\.[a-z])?)?)?)\.?\s', rotulo)
    return m.group(1) if m else None

# ------------------------------------------------------------------ normalização


def normalizar(arquivos, urls, originais, capturado_em):
    m_ed = re.search(r'nir_(\d{4})_1990-(\d{4})', urls['totalbrasil'])
    if not m_ed:
        raise ValueError('URL do total Brasil sem a edição do inventário (nir_AAAA_1990-AAAA)')
    edicao = f'NIR {m_ed.group(1)} (1990-{m_ed.group(2)})'
    total = ler_abas(arquivos['totalbrasil'])
    titulo = next(l[0] for l in total['CO2e_GWP_AR5'] if l and 'INVENTÁRIO' in l[0].upper())
    metricas = {}
    for aba, nome in METRICAS.items():
        unidade, anos, corpo = tabela(total[aba])
        if '(kt)' not in unidade.replace(' ', '').replace('\n', ''):
            raise ValueError(f'Unidade inesperada em {aba}: {unidade}')
        tot = next(v for r, v in corpo if r == 'Total')
        setores = {}
        for chave, _, rot in SETORES:
            setores[chave] = next(v for r, v in corpo if r.startswith(rot))
        for a in anos:
            soma = sum(setores[k][a] for k in setores)
            if abs(soma - tot[a]) > 1e-6 * abs(tot[a]) + 1:
                raise ValueError(f'{aba}: soma dos setores difere do total em {a}')
        metricas[aba] = {'nome': nome, 'anos': anos, 'total': tot, 'setores': setores}

    m = metricas['CO2e_GWP_AR5']
    anos = m['anos']
    serie = []
    for a in anos:
        s = {k: m['setores'][k][a] for k, _, _ in SETORES}
        serie.append({'ano': a, 'totalLiquido': m['total'][a], 'totalSemLulucf': sum(v for k, v in s.items() if k != 'lulucf'), 'setores': s})

    subsetores, gases, conferencia = [], {}, {}
    for chave, arq, rot in SETORES:
        abas = ler_abas(arquivos[arq])
        _, anos_s, corpo = tabela(abas['CO2e_GWP_AR5'])
        if anos_s != anos:
            raise ValueError(f'{arq}: anos diferentes do total Brasil')
        topo = corpo[0][1]
        for a in anos:  # a linha do setor na planilha setorial tem de bater com o total Brasil
            if abs(topo[a] - m['setores'][chave][a]) > 1e-6 * abs(topo[a]) + 0.5:
                raise ValueError(f'{arq}: setor difere do total Brasil em {a}')
        for r, v in corpo[1:]:
            cod = _codigo(r)
            if cod and cod.count('.') == 1:  # primeiro nível de categoria do IPCC (1.A, 3.C, 4.C ...)
                subsetores.append({'setor': chave, 'codigo': cod, 'nome': r[len(cod):].lstrip('. ').strip(), 'valores': {str(a): v[a] for a in anos}})
        convertido = {a: 0.0 for a in anos}
        for aba, linhas in abas.items():
            if aba in METRICAS:
                continue
            if aba not in GWP_AR5:
                raise ValueError(f'{arq}: gás sem GWP conhecido: {aba}')
            unidade, anos_g, corpo_g = tabela(linhas)
            vals = corpo_g[0][1]
            g = gases.setdefault(aba, {'gas': aba, 'unidade': 'kt do gás', 'gwpAr5': GWP_AR5[aba], 'porSetor': {}})
            g['porSetor'][chave] = {str(a): vals[a] for a in anos}
            for a in anos:
                convertido[a] += (vals[a] or 0.0) * GWP_AR5[aba]
        desvio = max(abs(convertido[a] / m['setores'][chave][a] - 1) for a in anos if m['setores'][chave][a])
        conferencia[chave] = round(desvio, 6)
        if desvio > 0.002:
            raise ValueError(f'{arq}: abas por gás não reconciliam com CO2e (desvio {desvio:.4%})')

    porgas = []
    for g in gases.values():
        tot = {str(a): sum((g['porSetor'][k].get(str(a)) or 0.0) for k in g['porSetor']) for a in anos}
        porgas.append({**g, 'total': tot, 'totalCo2eAr5Derivado': {a: v * g['gwpAr5'] for a, v in tot.items()}})

    return {
        'fonte': {
            'nome': f'MCTI, Sistema de Registro Nacional de Emissões (SIRENE): Relatório do Inventário Nacional, {edicao.split(" (")[0]}',
            'titulo': titulo,
            'orgao': 'Ministério da Ciência, Tecnologia e Inovação',
            'pagina': 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/emissoes/emissoes-de-gee-por-setor-1',
            'relatorio': 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/publicacoes/relatorios-bienais-de-transparencia-btrs',
            'licenca': 'Dado público de governo (Lei 12.527/2011 e Decreto 8.777/2016); a página não declara licença explícita. Citar MCTI/SIRENE.',
            'natureza': 'Inventário oficial do governo brasileiro, base do relatório bienal de transparência enviado à UNFCCC (o NIR 2024 é a base do BTR1, de dezembro de 2024).',
        },
        'capturadoEm': capturado_em,
        'originais': [{'setor': s, 'url': urls[s], **originais[s]} for s in sorted(originais)],
        'edicao': edicao,
        'unidade': 'kt CO2e (mil toneladas de CO2 equivalente)',
        'metrica': 'GWP AR5, horizonte de 100 anos',
        'anoInicial': anos[0], 'anoFinal': anos[-1],
        'anos': serie,
        'metricasAlternativas': {aba: {'nome': v['nome'], 'totalLiquido': {str(a): v['total'][a] for a in v['anos']}} for aba, v in metricas.items() if aba != 'CO2e_GWP_AR5'},
        'subsetores': subsetores,
        'gases': {'unidade': 'kt do gás; CO2e derivado com GWP AR5 nesta captura, não publicado por gás pela fonte', 'conferenciaDesvioMaximoPorSetor': conferencia, 'series': porgas},
        'ressalvas': [
            'Total líquido inclui o setor LULUCF com remoções (valores negativos em florestas e produtos madeireiros). O total sem LULUCF soma os outros quatro setores.',
            'A fonte publica o LULUCF só como saldo líquido por categoria; emissão bruta e remoção não vêm separadas nas planilhas.',
            'Remoções em florestas manejadas, inclusive unidades de conservação e terras indígenas, entram no saldo, conforme a regra de terras manejadas do IPCC adotada pelo inventário.',
            'Combustível de navegação e aviação internacional (bunker) fica fora do total nacional, como manda a UNFCCC.',
            'Cada edição recalcula toda a série desde 1990; números de edições diferentes não se comparam.',
        ],
    }


def coletar(pasta, capturado_em):
    """Descobre as planilhas vigentes, baixa para pasta (reaproveita o que já estiver lá com o mesmo nome) e normaliza."""
    os.makedirs(pasta, exist_ok=True)
    urls = {s: BASE.format(s) for s in ['totalbrasil'] + [a for _, a, _ in SETORES]}
    try:
        achados, _ = descobrir()
        urls.update({s: u for s, u in achados.items() if s in urls})
    except Exception as e:  # painel indisponível: URLs fixas da edição conhecida; run.py recusa se forem anteriores ao seed
        print(f'emissoes: painel do SIRENE indisponível ({e}); usando as URLs fixas', file=sys.stderr)
    arquivos, originais = {}, {}
    for s, u in urls.items():
        caminho = os.path.join(pasta, os.path.basename(u))
        if os.path.exists(caminho):
            raw = open(caminho, 'rb').read()
        else:
            raw = baixar(u)
            with open(caminho, 'wb') as f:
                f.write(raw)
        arquivos[s] = caminho
        originais[s] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    return normalizar(arquivos, urls, originais, capturado_em)
