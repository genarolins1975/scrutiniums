"""Desastres registrados pela Defesa Civil (S2iD, via Atlas Digital de Desastres no Brasil).

Só biblioteca padrão. Segue o padrão de pipeline/agro/ambiente.py: coleta urllib com novas tentativas,
sha256 e tamanho de cada original, normalização em JSON.

Fonte usada: base consolidada do Atlas Digital (Sedec/MIDR com Ceped/UFSC), que é extraída do S2iD e
tratada (duplicidades, FIDEs estaduais de grupo de municípios, Covid-19 retirada). A fonte primária dos
reconhecimentos (relatórios gerenciais do S2iD) bloqueia acesso de fora do Brasil; o script registra a
tentativa em "bloqueios".

Unidade de contagem: registro municipal de desastre (um protocolo S2iD = um município, uma data de
ocorrência, uma tipologia COBRADE). "Reconhecido" = o protocolo obteve reconhecimento federal de
situação de emergência ou estado de calamidade pública. Não é número de portarias, nem de eventos
físicos, nem de decretos municipais.

Coleta chamada por pipeline/territorio/run.py. Os originais são baixados para uma pasta temporária
(ou para --cache) e só os agregados vão para o seed, com sha256, bytes e Last-Modified de cada um.
"""
import collections
import csv
import datetime
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request

ATLAS = 'https://atlasdigital.mdr.gov.br'
PAGINA_DOWNLOADS = ATLAS + '/paginas/downloads.xhtml'
S2ID_RELATORIOS = 'https://s2id.mi.gov.br/paginas/relatorios/'
UA = 'Scrutiniums Territorio/1.0; public data, bounded requests'

# Grupos editoriais a partir do código COBRADE (5 dígitos, Instrução Normativa MI 01/2012 e sucessoras).
SECAS = {'14110', '14120'}                      # estiagem, seca
CHUVAS = {'12100', '12200', '12300', '13214'}   # inundações, enxurradas, alagamentos, chuvas intensas
GRUPOS = ['secas_estiagens', 'chuvas_inundacoes_enxurradas_alagamentos', 'movimentos_de_massa', 'outros']
ROTULOS = {
    'secas_estiagens': 'Secas e estiagens (COBRADE 1.4.1.1.0 e 1.4.1.2.0)',
    'chuvas_inundacoes_enxurradas_alagamentos': 'Chuvas intensas, inundações, enxurradas e alagamentos (1.2.1.0.0, 1.2.2.0.0, 1.2.3.0.0, 1.3.2.1.4)',
    'movimentos_de_massa': 'Movimentos de massa: quedas, deslizamentos, corridas, subsidências (1.1.3.x)',
    'outros': 'Outros: vendaval, granizo, erosão, incêndio florestal, onda de frio ou calor, doenças, tecnológicos etc.',
}
DOC = {'F': 'FIDE (S2iD, 2012 em diante)', 'A': 'AVADAN', 'N': 'NOPRED', 'P': 'Portaria', 'D': 'Decreto',
       'J': 'Jornal', 'R': 'Relatório', 'C': 'não documentado no manual', 'O': 'Outros'}
DANOS = {'obitos': 'DH_MORTOS', 'desabrigados': 'DH_DESABRIGADOS', 'desalojados': 'DH_DESALOJADOS',
         'desaparecidos': 'DH_DESAPARECIDOS', 'feridos': 'DH_FERIDOS', 'enfermos': 'DH_ENFERMOS',
         'outros_afetados': 'DH_OUTROS AFETADOS', 'afetados_seca_estiagem': 'DH_AFETADOS_SECA_ESTIAGEM',
         'total_danos_humanos_diretos': 'DH_total_danos_humanos_diretos'}


def grupo(cobrade):
    if cobrade in SECAS:
        return 'secas_estiagens'
    if cobrade in CHUVAS:
        return 'chuvas_inundacoes_enxurradas_alagamentos'
    if cobrade.startswith('113'):
        return 'movimentos_de_massa'
    return 'outros'


def baixar(url, limite=200_000_000, tentativas=4):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read(limite + 1)
                if len(raw) > limite:
                    raise ValueError('Resposta acima do limite')
                return raw, dict(r.headers)
        except urllib.error.HTTPError as e:  # erro definitivo do servidor: não insistir
            corpo = e.read(2000).decode('latin1', 'ignore')
            raise RuntimeError(f'HTTP {e.code} em {url}: {" ".join(corpo.split())[:200]}')
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(4 * (i + 1))
    raise RuntimeError(f'Falha ao baixar {url}: {ultimo}')


def registrar(raw, url, cabecalhos, caminho):
    return {'url': url, 'arquivo': os.path.basename(caminho), 'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'last_modified': cabecalhos.get('Last-Modified'),
            'capturado_em': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}


def coletar(dir_originais):
    """Baixa o CSV, o manual e o log de correções do Atlas para dir_originais e tenta o S2iD.

    Se dir_originais já tem os arquivos com o índice originais.json (cache), confere o sha256 e os reaproveita.
    """
    os.makedirs(dir_originais, exist_ok=True)
    indice = os.path.join(dir_originais, 'originais.json')
    if os.path.exists(indice):
        salvo = json.load(open(indice, encoding='utf-8'))
        for meta in salvo['originais'].values():
            raw = open(os.path.join(dir_originais, meta['arquivo']), 'rb').read()
            if hashlib.sha256(raw).hexdigest() != meta['sha256'] or len(raw) != meta['bytes']:
                raise RuntimeError(f'Original alterado desde a captura: {meta["arquivo"]}')
        return salvo['originais'], salvo['bloqueios']
    originais, bloqueios = {}, []
    pagina, cab = baixar(PAGINA_DOWNLOADS)
    html = pagina.decode('utf-8', 'ignore')
    links = re.findall(r'href="(/arquivos/[^"]+)"', html)
    csvs = [l for l in links if l.lower().endswith('.csv') and 'BD_Atlas' in l]
    if len(csvs) != 1:
        raise RuntimeError(f'Esperado um CSV da base do Atlas na página de downloads, achados: {csvs}')
    alvos = {'atlas_csv': csvs[0]}
    for l in links:
        if 'Manual' in l:
            alvos['atlas_manual'] = l
        elif 'logs' in l.lower():
            alvos['atlas_log_correcoes'] = l
    for chave, caminho_url in alvos.items():
        url = ATLAS + caminho_url
        raw, cab = baixar(url)
        destino = os.path.join(dir_originais, os.path.basename(caminho_url))
        open(destino, 'wb').write(raw)
        originais[chave] = registrar(raw, url, cab, destino)
    try:  # fonte primária dos reconhecimentos; bloqueada por geolocalização fora do Brasil
        baixar(S2ID_RELATORIOS, tentativas=1)
        bloqueios.append({'url': S2ID_RELATORIOS, 'situacao': 'acessível nesta captura; integrar'})
    except Exception as e:
        bloqueios.append({'url': S2ID_RELATORIOS, 'situacao': str(e)[:300]})
    json.dump({'originais': originais, 'bloqueios': bloqueios}, open(indice, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return originais, bloqueios


def data(s):
    return datetime.datetime.strptime(s.strip(), '%d/%m/%Y').date()


def num(s):
    s = (s or '').strip()
    return float(s) if s else None


def normalizar(caminho_csv):
    with open(caminho_csv, encoding='latin-1', newline='') as f:
        linhas = list(csv.DictReader(f, delimiter=';'))
    vistos = set()
    por_ano = collections.defaultdict(lambda: {'registros': 0, 'reconhecidos': 0, **{g: 0 for g in GRUPOS},
                                                'municipios': set(), 'municipios_com_registro': set()})
    por_uf_ano = collections.defaultdict(lambda: {'reconhecidos': 0, 'municipios': set(), **{g: 0 for g in GRUPOS}})
    danos_ano = collections.defaultdict(lambda: collections.Counter())
    doc_ano = collections.defaultdict(collections.Counter)
    max_evento = max_registro = None
    for r in linhas:
        prot = r['Protocolo_S2iD'].strip()
        if prot in vistos:
            raise RuntimeError(f'Protocolo repetido na base: {prot}')
        vistos.add(prot)
        ev, rg = data(r['Data_Evento']), data(r['Data_Registro'])
        max_evento = max(max_evento or ev, ev)
        max_registro = max(max_registro or rg, rg)
        ano, uf, mun, g = ev.year, r['Sigla_UF'].strip(), r['Cod_IBGE_Mun'].strip(), grupo(r['Cod_Cobrade'].strip())
        rec = r['Status'].strip() == 'Reconhecido'
        if r['Status'].strip() not in ('Reconhecido', 'Registro'):
            raise RuntimeError(f'Status desconhecido: {r["Status"]}')
        a = por_ano[ano]
        a['registros'] += 1
        a['municipios_com_registro'].add(mun)
        doc_ano[ano][prot.split('-')[1]] += 1
        if rec:
            a['reconhecidos'] += 1
            a[g] += 1
            a['municipios'].add(mun)
            u = por_uf_ano[(uf, ano)]
            u['reconhecidos'] += 1
            u[g] += 1
            u['municipios'].add(mun)
        d = danos_ano[ano]
        vals = {k: num(r[c]) for k, c in DANOS.items()}
        for k, v in vals.items():
            if v is None:
                d['vazio_' + k] += 1
            else:
                d[k] += v
        d['registros'] += 1
        if all((v or 0) == 0 for v in vals.values()):
            d['registros_sem_nenhum_dano_humano'] += 1
        comp = sum((vals[k] or 0) for k in ('obitos', 'feridos', 'enfermos', 'desabrigados', 'desalojados', 'desaparecidos', 'outros_afetados'))
        tot = vals['total_danos_humanos_diretos'] or 0
        if abs(tot - comp) > 0.5 and abs(tot - comp - (vals['afetados_seca_estiagem'] or 0)) > 0.5:
            d['registros_total_diferente_da_soma'] += 1
    return linhas, por_ano, por_uf_ano, danos_ano, doc_ano, max_evento, max_registro


def montar(originais, bloqueios, dir_originais, hoje):
    caminho_csv = os.path.join(dir_originais, originais['atlas_csv']['arquivo'])
    linhas, por_ano, por_uf_ano, danos_ano, doc_ano, max_evento, max_registro = normalizar(caminho_csv)
    ultimo_completo = max_evento.year if max_evento.month == 12 and max_evento.day >= 28 else max_evento.year - 1
    ano_corrente = hoje.year
    serie = []
    for ano in sorted(por_ano):
        a = por_ano[ano]
        serie.append({'ano': ano, 'registros_municipais': a['registros'],
                      'registros_reconhecidos': a['reconhecidos'] if ano >= 2003 else None,
                      'por_grupo_reconhecidos': {g: a[g] for g in GRUPOS} if ano >= 2003 else None,
                      'municipios_distintos_com_reconhecimento': len(a['municipios']) if ano >= 2003 else None,
                      'municipios_distintos_com_registro': len(a['municipios_com_registro']),
                      'tipo_documento_de_origem': dict(sorted(doc_ano[ano].items()))})

    def uf_do_ano(ano):
        out = {}
        for (uf, a), v in sorted(por_uf_ano.items()):
            if a == ano:
                out[uf] = {'registros_reconhecidos': v['reconhecidos'], 'municipios_distintos': len(v['municipios']),
                           'por_grupo': {g: v[g] for g in GRUPOS}}
        return out

    danos = []
    for ano in sorted(danos_ano):
        d = danos_ano[ano]
        danos.append({'ano': ano, 'registros': d['registros'],
                      'registros_sem_nenhum_dano_humano_informado': d['registros_sem_nenhum_dano_humano'],
                      'registros_total_diferente_da_soma': d['registros_total_diferente_da_soma'],
                      'obitos': int(d['obitos']), 'desabrigados': int(d['desabrigados']),
                      'desalojados': int(d['desalojados']), 'desaparecidos': int(d['desaparecidos']),
                      'total_danos_humanos_diretos': int(d['total_danos_humanos_diretos']),
                      'publicavel': ano >= 2013})
    return {
        'modulo': 'territorio/desastres',
        'capturadoEm': min(o['capturado_em'] for o in originais.values()),
        'dataReferencia': hoje.isoformat(),
        'fonte': {
            'nome': 'Atlas Digital de Desastres no Brasil, base consolidada (Sedec/MIDR e Ceped/UFSC), extraída do S2iD',
            'pagina': PAGINA_DOWNLOADS, 'manual': ATLAS + '/arquivos/Atlas_Digital_Desastres_Manual_Aplicacao.pdf',
            'painel_oficial': ATLAS + '/paginas/graficos.xhtml',
            'licenca': 'Não declarada na página de downloads; dado público oficial (Lei de Acesso à Informação). Citar Sedec/MIDR, Atlas Digital de Desastres no Brasil.',
            'cobertura_eventos': {'inicio': '1991-01-01', 'fim': max_evento.isoformat()},
            'ultimo_registro_na_base': max_registro.isoformat(),
            'cadencia': f'Atualização anual declarada pela Sedec; a base capturada cobre ocorrências de 1991 a {max_evento.year}.',
        },
        'originais': originais,
        'bloqueios': bloqueios,
        'unidade': 'Registro municipal de desastre: um protocolo do S2iD (ou documento histórico digitalizado) para um município, uma data de ocorrência e uma tipologia COBRADE. "Reconhecido" indica que o protocolo obteve reconhecimento federal de situação de emergência ou estado de calamidade pública. Não é contagem de portarias, de decretos nem de eventos físicos: uma mesma chuva em 300 municípios gera 300 registros.',
        'ano_de_referencia': 'Ano da data de ocorrência do desastre (Data_Evento), não da publicação da portaria.',
        'grupos': ROTULOS,
        'tipos_documento': DOC,
        'serie_anual': serie,
        'por_uf': {
            'ultimo_ano_completo': {'ano': ultimo_completo, 'ufs': uf_do_ano(ultimo_completo)},
            'ano_corrente': {'ano': ano_corrente, 'disponivel': ano_corrente <= max_evento.year,
                             'motivo': None if ano_corrente <= max_evento.year else f'A base do Atlas termina em {max_evento.isoformat()}. Reconhecimentos de {ano_corrente} existem no S2iD, mas não nesta fonte; não são zero.',
                             'ufs': uf_do_ano(ano_corrente) if ano_corrente <= max_evento.year else None},
        },
        'danos_humanos': {
            'publicar': 'Só óbitos, desabrigados e desalojados, de 2013 em diante (FIDE no S2iD), como soma de registros e com a ressalva de que zero na base também significa campo não informado. Não publicar "afetados".',
            'serie': danos,
        },
        'ressalvas': [
            'Ausência vira zero na própria fonte: os campos de danos não têm vazio; antes de 2013 entre 48% e 95% dos registros de cada ano têm todos os danos humanos iguais a zero.',
            'Quebra de série em 2012/2013: o FIDE no S2iD substituiu AVADAN e NOPRED; o total de danos humanos diretos salta de 0,5 milhão (2012) para 5,9 milhões (2013).',
            'O total de danos humanos diretos não bate com a soma das categorias em cerca de um quarto dos registros; o log oficial lista 242 protocolos de 2024 com população afetada acima da população do município.',
            'Danos refletem o momento do registro; não há atualização posterior (um desaparecido que morre não vira óbito).',
            'O Atlas retirou os registros de Covid-19, os FIDEs estaduais que somam vários municípios e duplicidades evidentes (inclusive secas renovadas a cada 180 dias, mantendo o de maior dano), por isso não coincide com as contagens brutas do S2iD.',
            'Reconhecimento federal depende de pedido do município ou estado e de análise da Sedec; ausência de reconhecimento não significa ausência de desastre. O status "Registro" junta não pedidos, negados e pendentes.',
            'Critérios mudaram: IN MI 01/2012, IN MI 02/2016, IN MDR 36/2020 e Portaria MDR 260/2022 (alterada pela 3.646/2022). Comparações longas medem também mudança de regra e de adesão ao sistema.',
            'Status "Reconhecido" só aparece a partir de 2003 (início da série histórica de reconhecimentos do S2iD); antes disso a contagem de reconhecidos não existe e não é zero.',
            'O ano mais recente pode ser revisado: registros de eventos de dezembro ainda podiam ser incluídos ou reconhecidos depois da data de corte da base.',
        ],
    }
