"""SIOP por função e subfunção: captura explícita, validação e snapshot; nunca executado no build.

Requer Python 3.9+ e requests (só para a coleta). Uso:
  python3 scripts/contas-publicas/importar-funcoes.py --todos       # todos os exercícios, de PRIMEIRO_ANO ao ano corrente
  python3 scripts/contas-publicas/importar-funcoes.py --recentes    # só o ano corrente e o anterior (atualização agendada)
  python3 scripts/contas-publicas/importar-funcoes.py --de-fontes   # reconstrói o snapshot das respostas guardadas, sem rede

Fonte: consulta SPARQL pública do SIOP (a mesma das esferas e dos grupos de despesa, importar.py), Orçamentos
Fiscal (10) e da Seguridade Social (20) da União, por função, subfunção e identificador de resultado primário
(RP 0 = despesa financeira; os demais, primária), nos cinco estágios: dotação inicial, dotação atualizada,
empenhado, liquidado e pago no exercício (sem restos a pagar). Valores em R$ correntes, sem deflação.

Cada exercício é conferido contra uma consulta independente por esfera (totais.rq): a soma das linhas por
função tem de fechar com o total das esferas em cada estágio, com tolerância de R$ 5. Estágio em que algum
item do orçamento não tem valor na fonte (2014: dotação atualizada de 77 itens) fica marcado como incompleto
e seus valores viram null, nunca zero; os demais estágios do exercício continuam conferidos. Função fora da
classificação (Portaria SOF/SETO/ME nº 42/1999, atualizada pela Portaria SOF/ME nº 2.520/2022), subfunção mal
formada, linha sem identificador de resultado primário, cobertura de linha que não bate com a do total,
valor não finito ou esfera ausente reprovam o exercício e nada é gravado.
As respostas brutas ficam em data/contas-publicas/fontes/funcoes (gzip sem data, bytes estáveis) com o hash
do conteúdo no snapshot; o teste refaz o snapshot a partir delas.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENDPOINT = 'https://www1.siop.planejamento.gov.br/sparql/'
# primeiro grafo do orçamento publicado no endpoint (http://orcamento.dados.gov.br/2000/); também o primeiro
# exercício da classificação funcional da Portaria nº 42/1999 na União
PRIMEIRO_ANO = 2000
CAMPOS = ['inicial', 'atualizada', 'empenhado', 'liquidado', 'pago']
COBERTURA = {'inicial': 'cobertura', 'atualizada': 'coberturaAtualizada', 'empenhado': 'coberturaEmpenhado',
             'liquidado': 'coberturaLiquidado', 'pago': 'coberturaPago'}
# 01 a 28 da Portaria nº 42/1999, 99 (Reserva de Contingência) e 98 ("Atípica", usada pela fonte só em 2007, em três
# itens com R$ 380 mil autorizados e nada empenhado)
FUNCOES_VALIDAS = {f'{i:02d}' for i in range(1, 29)} | {'98', '99'}
TOLERANCIA_REAIS = 5
# a fonte soma em ponto flutuante: em exercícios com centavos, duas agregações dos mesmos itens podem divergir em
# dezenas de reais num total de centenas de bilhões. Vale R$ 5 ou um décimo de bilionésimo do total, o maior.
TOLERANCIA_RELATIVA = 1e-10
FONTES = ROOT / 'data/contas-publicas/fontes/funcoes'
DESTINO = ROOT / 'src/lib/contas-publicas/snapshots/funcoes.json'
CONSULTAS = {nome: ROOT / f'scripts/contas-publicas/{nome}.rq' for nome in ('funcoes', 'totais')}
COLUNAS = ['ano', 'funcao', 'subfuncao', 'rp', *CAMPOS]


def check(ok, mensagem):
    if not ok:
        raise ValueError(mensagem)


def consulta(nome, ano):
    return CONSULTAS[nome].read_text().replace('YEAR', str(ano))


def _valor(linha, campo):
    v = float(linha[campo]['value'])
    check(math.isfinite(v), f'Valor SIOP não finito: {campo}')
    return round(v, 2)


def transformar(ano, bruto_funcoes, bruto_totais):
    """Um exercício: linhas por função, subfunção e RP, conferidas contra o total das esferas."""
    linhas_fonte = json.loads(bruto_funcoes)['results']['bindings']
    esferas = json.loads(bruto_totais)['results']['bindings']
    check(sorted(e['cod']['value'] for e in esferas) == ['10', '20'], f'{ano}: esferas ausentes ou duplicadas')
    datas = {e['data']['value'] for e in esferas}
    check(len(datas) == 1, f'{ano}: datas de atualização divergentes entre esferas')
    # estágio completo: todo item do orçamento tem valor na fonte; senão, ausência declarada (null), nunca zero
    completos = {c: all(e[COBERTURA[c]]['value'] == e['itens']['value'] for e in esferas) for c in CAMPOS}
    total = {c: round(sum(_valor(e, c) for e in esferas), 2) if completos[c] else None for c in CAMPOS}
    check(len(linhas_fonte) > 0, f'{ano}: consulta por função vazia')
    funcoes, subfuncoes, linhas, vistas = {}, {}, [], set()
    sem_valor = {c: 0 for c in CAMPOS}
    for l in linhas_fonte:
        f, sf = l['funcao']['value'], l['subfuncao']['value']
        check(f in FUNCOES_VALIDAS, f'{ano}: função fora da classificação: {f}')
        check(re.fullmatch(r'\d{3}', sf) is not None, f'{ano}: subfunção mal formada: {sf}')
        check('rp' in l, f'{ano}: linha sem identificador de resultado primário ({f}.{sf})')
        rp = l['rp']['value']
        check(re.fullmatch(r'\d', rp) is not None, f'{ano}: identificador de resultado primário inválido: {rp}')
        chave = (f, sf, rp)
        check(chave not in vistas, f'{ano}: linha duplicada {chave} (rótulo repetido com outro nome?)')
        vistas.add(chave)
        itens = int(l['itens']['value'])
        for c in CAMPOS:
            falta = itens - int(l[COBERTURA[c]]['value'])
            check(falta >= 0, f'{ano}: cobertura maior que os itens ({f}.{sf})')
            sem_valor[c] += falta
        funcoes.setdefault(f, l['nomeFuncao']['value'].strip())
        subfuncoes.setdefault(sf, l['nomeSubfuncao']['value'].strip())
        check(funcoes[f] == l['nomeFuncao']['value'].strip(), f'{ano}: função {f} com dois rótulos')
        check(subfuncoes[sf] == l['nomeSubfuncao']['value'].strip(), f'{ano}: subfunção {sf} com dois rótulos')
        linhas.append([ano, f, sf, rp, *[(_valor(l, c) if completos[c] else None) for c in CAMPOS]])
    itens_total = sum(int(e['itens']['value']) for e in esferas)
    itens_linhas = sum(int(l['itens']['value']) for l in linhas_fonte)
    # item sem função ou subfunção na fonte fica fora das linhas; o valor dele aparece no resíduo conferido abaixo
    check(itens_linhas <= itens_total, f'{ano}: mais itens por função ({itens_linhas}) que no total ({itens_total})')
    for c in CAMPOS:
        check(not completos[c] or sem_valor[c] == 0, f'{ano}: estágio {c} completo no total e com itens sem valor por função')
    residuos = {c: (round(total[c] - sum(r[4 + i] for r in linhas), 2) if completos[c] else None) for i, c in enumerate(CAMPOS)}
    check(any(completos.values()), f'{ano}: nenhum estágio completo')
    check(all(abs(residuos[c]) <= max(TOLERANCIA_REAIS, TOLERANCIA_RELATIVA * abs(total[c])) for c in CAMPOS if completos[c]), f'{ano}: soma por função diverge do total das esferas: {residuos}')
    return {
        'ano': ano,
        'atualizacao': datas.pop(),
        'total': total,
        'residuosEsferasMenosFuncoes': residuos,
        'itensSemValor': {c: v for c, v in sem_valor.items() if v},
        'itensForaDasFuncoes': itens_total - itens_linhas,
        'linhas': linhas,
        'funcoes': funcoes,
        'subfuncoes': subfuncoes,
    }


def montar(exercicios, capturas, hashes):
    """Snapshot colunar (o padrão de metas.json): uma linha por exercício, função, subfunção e RP."""
    exercicios = sorted(exercicios, key=lambda e: e['ano'])
    anos = [e['ano'] for e in exercicios]
    check(anos == list(range(anos[0], anos[-1] + 1)), 'Exercícios não contínuos')
    check(anos[0] == PRIMEIRO_ANO, f'Série precisa começar em {PRIMEIRO_ANO}')
    # rótulo exibido = o do exercício mais recente; os anteriores ficam registrados com a vigência
    rotulos = {'funcoes': {}, 'subfuncoes': {}}
    for e in exercicios:
        for tipo in rotulos:
            for cod, nome in e[tipo].items():
                hist = rotulos[tipo].setdefault(cod, [])
                if hist and hist[-1]['rotulo'] == nome and hist[-1]['ate'] == e['ano'] - 1:
                    hist[-1]['ate'] = e['ano']
                else:
                    hist.append({'rotulo': nome, 'de': e['ano'], 'ate': e['ano']})
    return {
        'versao': 1,
        'transformacao': 'importar-funcoes.py v1',
        'fonte': ENDPOINT,
        'consultas': ['scripts/contas-publicas/funcoes.rq', 'scripts/contas-publicas/totais.rq'],
        'perimetro': 'Orçamentos Fiscal e da Seguridade Social da União (esferas 10 e 20)',
        'unidade': 'R$ correntes',
        'classificacao': 'Funcional (Portaria SOF/SETO/ME nº 42/1999, atualizada pela Portaria SOF/ME nº 2.520/2022) e identificador de resultado primário (RP 0 = financeira)',
        'primeiroAno': anos[0],
        'ultimoAno': anos[-1],
        'exercicios': [{
            'ano': e['ano'],
            'atualizacao': e['atualizacao'],
            'captura': capturas[e['ano']],
            'sha256': hashes[e['ano']],
            'total': e['total'],
            'residuosEsferasMenosFuncoes': e['residuosEsferasMenosFuncoes'],
            'itensSemValor': e['itensSemValor'],
            'itensForaDasFuncoes': e['itensForaDasFuncoes'],
        } for e in exercicios],
        'funcoes': {c: h[-1]['rotulo'] for c, h in sorted(rotulos['funcoes'].items())},
        'subfuncoes': {c: h[-1]['rotulo'] for c, h in sorted(rotulos['subfuncoes'].items())},
        'vigencia': {tipo: {c: [{'de': x['de'], 'ate': x['ate'], 'rotulo': x['rotulo']} for x in h] for c, h in sorted(v.items())} for tipo, v in rotulos.items()},
        'validacao': {'toleranciaReais': TOLERANCIA_REAIS, 'toleranciaRelativa': TOLERANCIA_RELATIVA, 'esferasConciliadasFuncoes': True, 'estagioIncompletoViraNull': True},
        'colunas': COLUNAS,
        'registros': [r for e in exercicios for r in e['linhas']],
    }


def _arquivos(ano):
    return FONTES / f'funcoes{ano}.json.gz', FONTES / f'totais{ano}.json.gz'


def _ler(caminho):
    return gzip.decompress(caminho.read_bytes())


def _gravar(caminho, dados):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_bytes(gzip.compress(dados, compresslevel=9, mtime=0))


def baixar(ano, cache=None):
    """Respostas do SIOP; com cache (diretório), reaproveita o que já foi baixado nesta coleta."""
    import requests  # só a coleta usa rede
    respostas = {}
    for nome in ('funcoes', 'totais'):
        guardado = cache / f'{nome}{ano}.json' if cache else None
        if guardado and guardado.exists():
            respostas[nome] = guardado.read_bytes()
            continue
        r = requests.get(ENDPOINT, params={'query': consulta(nome, ano), 'format': 'application/sparql-results+json'}, timeout=300)
        r.raise_for_status()
        respostas[nome] = r.content
        if guardado:
            guardado.write_bytes(r.content)
    return respostas['funcoes'], respostas['totais']


def de_fontes(anterior):
    """Refaz todos os exercícios das respostas guardadas; capturas vêm do snapshot anterior."""
    capturas = {e['ano']: e['captura'] for e in anterior['exercicios']}
    exercicios, hashes = [], {}
    for ano in sorted(capturas):
        bf, be = (_ler(p) for p in _arquivos(ano))
        hashes[ano] = {'funcoes': hashlib.sha256(bf).hexdigest(), 'totais': hashlib.sha256(be).hexdigest()}
        exercicios.append(transformar(ano, bf, be))
    return montar(exercicios, capturas, hashes)


def main():
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument('--todos', action='store_true', help=f'coleta de {PRIMEIRO_ANO} ao ano corrente')
    g.add_argument('--recentes', action='store_true', help='coleta o ano corrente e o anterior e mantém os demais')
    g.add_argument('--de-fontes', action='store_true', help='reconstrói das respostas guardadas, sem rede')
    p.add_argument('--cache', type=pathlib.Path, help='diretório para guardar e reaproveitar as respostas desta coleta')
    args = p.parse_args()
    anterior = json.loads(DESTINO.read_text()) if DESTINO.exists() else None
    if args.de_fontes:
        check(anterior is not None, 'Sem snapshot anterior: rodar --todos')
        snapshot = de_fontes(anterior)
    else:
        hoje = dt.datetime.now(dt.timezone.utc)
        alvo = list(range(PRIMEIRO_ANO, hoje.year + 1)) if args.todos else [hoje.year - 1, hoje.year]
        check(args.todos or anterior is not None, 'Sem snapshot anterior: rodar --todos')
        novos = {}
        for ano in alvo:
            bf, be = baixar(ano, args.cache)
            novos[ano] = (bf, be, transformar(ano, bf, be))  # valida antes de gravar qualquer coisa
        captura = hoje.isoformat()
        capturas = {e['ano']: e['captura'] for e in anterior['exercicios']} if anterior else {}
        for ano, (bf, be, _) in novos.items():
            fa, ea = _arquivos(ano)
            mudou = not (fa.exists() and ea.exists() and _ler(fa) == bf and _ler(ea) == be)
            if mudou or ano not in capturas:
                _gravar(fa, bf)
                _gravar(ea, be)
                capturas[ano] = captura
        snapshot = de_fontes({'exercicios': [{'ano': a, 'captura': c} for a, c in capturas.items()]})
    DESTINO.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('Snapshot por função validado:', snapshot['primeiroAno'], 'a', snapshot['ultimoAno'], '·', len(snapshot['registros']), 'linhas')


if __name__ == '__main__':
    main()
