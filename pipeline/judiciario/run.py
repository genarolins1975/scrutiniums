"""Reprodução offline do recorte CNJ preservado pelo capítulo Acesso à Justiça.

Não realiza coleta processual nem presume atualização do portal. A semente é
verificada antes de qualquer escrita. Uma falha mantém a publicação anterior.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT = ROOT / 'pipeline/justica/seed/cnj-quadros.txt'
SEED = ROOT / 'pipeline/justica/seed/recorte.json.gz'
EXPANDED = ROOT / 'pipeline/judiciario/seed/cnj-ampliado.json.gz'
HISTORY = ROOT / 'pipeline/judiciario/seed/historico-tempos.json.gz'
OUT = ROOT / 'public/eficiencia/judiciario'
HASHES = {
    'texto': 'd60a87ae35dea2511f714798eaf2234696642eb7b6821b6061e6e29fa4b3bedb',
    'recorte': 'fe0164e193c577560f697012cdad38113d175ab1c6d3f9c8cddfee7a4fca58ef',
    'ampliado': 'dea4d493d2f7ba0cb2818f90ff708ec8d6913ca9ecd8a53e4b7d85d4e51562e8',
    'historico': '8588a6fe3b850a285bf273d962bdc09f2b996a87f3e9b024fafaf8ce3627db6b',
}
BRANCHES = [('estadual', 'Justiça Estadual'), ('federal', 'Justiça Federal'),
            ('trabalho', 'Justiça do Trabalho')]


def divide(numerator, denominator):
    """Ausência/denominador inválido não vira zero."""
    if any(v is None or isinstance(v, bool) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in [numerator, denominator]):
        return None
    return numerator / denominator if denominator > 0 else None


def weighted_rate(rows):
    """Taxa do universo completo; não exclui silenciosamente ausência de pares."""
    if not rows or any(divide(n, d) is None or n < 0 for n, d in rows):
        return None
    return divide(sum(n for n, _ in rows), sum(d for _, d in rows))


def months(text):
    years = re.search(r'(\d+)\s+anos?', text)
    months_match = re.search(r'(\d+)\s+m[eê]s(?:es)?', text)
    if not years and not months_match:
        raise ValueError('Duração sem unidade reconhecida: ' + text)
    return (int(years[1]) * 12 if years else 0) + (int(months_match[1]) if months_match else 0)


def page(text, number):
    match = re.search(rf'PÁGINA {number}\n(.*?)(?=\nPÁGINA \d+\n|\Z)', text, re.S)
    if not match:
        raise ValueError(f'Página {number} não preservada')
    return match[1]


def extract():
    for path, name in [(TEXT, 'texto'), (SEED, 'recorte')]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != HASHES[name]:
            raise ValueError('Integridade da semente divergente: ' + name)
    old = json.loads(gzip.decompress(SEED.read_bytes()))
    text = TEXT.read_text()
    # Os dois primeiros ramos estão na primeira linha; o Trabalho vem na seguinte.
    def volumes(part):
        values = re.findall(r'[•]\s*([\d,]+)\s+milhões', part)
        if len(values) < 3:
            raise ValueError('Quadro de volumes sem os três ramos')
        return [round(float(v.replace(',', '.')) * 1_000_000) for v in values[:3]]
    pending = volumes(page(text, 22))
    starts, ends = page(text, 23).split('Produtividade dos(as) juízes(as)')
    new, closed = volumes(starts), volumes(ends)
    rows = []
    for i, (identifier, name) in enumerate(BRANCHES):
        line = next(line for line in page(text, 24).splitlines() if line.startswith(name))
        durations = re.split(r'\s{2,}', line.strip())[1:]
        if len(durations) != 3:
            raise ValueError('Quadro de duração incompatível: ' + name)
        rows.append(dict(id=identifier, nome=name, ano=old['cnj']['ano'],
                         novos=new[i], baixados=closed[i], pendentes=pending[i],
                         idadePendente=months(durations[0]), conhecimento=months(durations[1]),
                         execucao=months(durations[2]), cejuscs=old['cnj']['cejuscs'][i]['valor'],
                         atendimentoAproximado=100 * divide(closed[i], new[i]),
                         resolucaoVolumes=100_000,
                         nota='Volumes arredondados a 0,1 milhão; razão derivada aproximada, não índice oficial.'))
    # Cejuscs no snapshot anterior têm ordem Estadual, Federal, Trabalho.
    tribunals = [dict(id=t['tribunal'].lower(), sigla=t['tribunal'], uf=t['uf'],
                      ramo='estadual', ano=old['cnj']['ano'], tempoBaixados=t['baixados'],
                      idadePendentes=t['pendentes'], pagina=t['pagina']) for t in old['tribunais']]
    source = next(s for s in old['fontes'] if s['id'] == 'cnj')
    result = dict(versao=1, calculo='judiciario-1', edicao=2026, ano=old['cnj']['ano'],
                  capturadoEm=old['capturadoEm'], fonte=source,
                  integridadeSementes=HASHES, ramos=rows, tribunais=tribunals,
                  unidades=dict(novos='processos', baixados='processos', pendentes='processos',
                                idadePendente='meses', conhecimento='meses', execucao='meses',
                                tempoBaixados='meses', idadePendentes='meses', cejuscs='unidades',
                                atendimentoAproximado='%', conciliacao='%', conciliacaoSerie='%'),
                  nacional=old['cnj'], conciliacaoSerie=old['cnj']['conciliacaoSerie'],
                  cobertura=dict(ramosAgregados=3, tribunaisEstaduais=27, tribunaisFederais=0,
                                 tribunaisTrabalho=0, anosTribunais=[2025],
                                 precisao='Volumes nacionais e por ramo arredondados; tempos em meses.',
                                 limite='Despesa, porte, IPC-Jus e satisfação do direito não disponíveis neste recorte.'),
                  revisao=dict(portalRevalidado=False,
                               nota='Reprodução da captura de 10/10/2026; consulta ao portal bloqueada em 17/10/2026. Variações anuais e pessoal da p. 22 excluídos por inconsistência de ano no texto preservado.'))
    result = history(expand(result))
    validate(result)
    return result


def expand(data):
    """Quadros adicionais do mesmo PDF, baixado e conferido em 17/10/2026."""
    if hashlib.sha256(EXPANDED.read_bytes()).hexdigest() != HASHES['ampliado']:
        raise ValueError('Integridade da semente ampliada divergente')
    seed = json.loads(gzip.decompress(EXPANDED.read_bytes()))
    pages = seed['paginas']
    if seed['sha256Original'] != data['fonte']['sha256']:
        raise ValueError('Recortes de originais diferentes')
    def short_months(value):
        years, rest = re.search(r'(\d+)a',value), re.search(r'(\d+)m',value)
        if not years and not rest:
            raise ValueError('Tempo ilegível: '+value)
        return (int(years[1])*12 if years else 0)+(int(rest[1]) if rest else 0)
    def percentages(number):
        return {sigla:float(value.replace(',','.')) for sigla,value in
                re.findall(r'^\s*(TJ[A-Z]+|TRF\d+|TRT\d+)\s+([\d,]+)%\s*$',pages[str(number)],re.M)}
    tribunals = []
    for branch,number,ipc_page,congestion_page,count in [
            ('estadual',333,353,313,27),('federal',397,407,384,6),('trabalho',459,473,440,24)]:
        ipc, congestion = percentages(ipc_page), percentages(congestion_page)
        rows = []
        for line in pages[str(number)].splitlines():
            match = re.match(r'^\s*(.*?)\s+(TJ[A-Z]+|TRF\d+|TRT\d+)\s+(.*?)\s*$',line)
            if not match:
                continue
            sigla = match[2]
            rows.append(dict(id=sigla.lower(),sigla=sigla,uf=('DF' if sigla=='TJDFT' else sigla[2:]) if branch=='estadual' else None,
                             ramo=branch,ano=data['ano'],tempoBaixados=short_months(match[1]),
                             idadePendentes=short_months(match[3]),pagina=number,
                             porte=None,despesaTotal=None,novos=None,pendentes=None,magistrados=None,servidores=None,
                             ipcJus=ipc.get(sigla),ipcPagina=ipc_page,congestionamento=congestion.get(sigla),
                             congestionamentoPagina=congestion_page,estruturaPagina=None))
        if len(rows)!=count or len(ipc)!=count or len(congestion)!=count:
            raise ValueError('Cobertura das figuras incompleta: '+branch)
        tribunals.extend(rows)
    by_sigla = {t['sigla']:t for t in tribunals}
    for number,expected in [(40,27),(41,24)]:
        found = 0
        for match in re.finditer(r'^\s*(Grande|Médio|Pequeno)\s+(TJ[A-Z]+|TRT\d+)\s+[-\d,]+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)',pages[str(number)],re.M):
            t = by_sigla[match[2]]
            t.update(porte=match[1],estruturaPagina=number)
            for key,value in zip(['despesaTotal','novos','pendentes','magistrados','servidores'],match.groups()[2:]):
                t[key] = int(value.replace('.',''))
            found += 1
        if found != expected:
            raise ValueError('Tabela de porte/recursos incompleta')
    all_branches = []
    for identifier,name in BRANCHES+[('eleitoral','Justiça Eleitoral'),('superiores','Tribunais Superiores'),('militar','Justiça Militar Estadual')]:
        match = re.search(re.escape(name)+r'\s+([\d.]+)\s*\(',pages['64'])
        if not match:
            raise ValueError('Despesa do ramo ausente: '+name)
        all_branches.append(dict(id=identifier,nome=name,valor=int(match[1].replace('.','')),pagina=64))
    finance_by_id = {r['id']:r['valor'] for r in all_branches}
    for r,number,congestion_page,label in zip(data['ramos'],[311,383,439],[313,384,440],['Estadual','Federal','Trabalho']):
        performance_text = (pages['438']+'\n' if r['id']=='trabalho' else '')+pages[str(number)]
        r['despesaTotal'] = finance_by_id[r['id']]
        r['despesaPorBaixaAproximada'] = divide(r['despesaTotal'],r['baixados'])
        r['iadOficial'] = float(re.search(r'IAD\)\s+foi de\s+([\d,]+)%',pages[str(number)])[1].replace(',','.'))
        r['congestionamentoLiquido'] = float(re.search(r'taxa de congestionamento líquida foi de\s+([\d,]+)%',performance_text)[1].replace(',','.'))
        r['congestionamentoBruto'] = float(re.search(r'^\s*'+label+r'\s+([\d,]+)%',pages[str(congestion_page)],re.M)[1].replace(',','.'))
        r['desempenhoPagina'] = number
        if r['id'] != 'federal':
            branch_rows=[t for t in tribunals if t['ramo']==r['id']]
            displayed_sum=sum(t['despesaTotal'] for t in branch_rows)
            # Fonte apresenta reais inteiros: erro máximo de arredondamento de
            # cada parcela e do total é 0,5 real. Resíduo permanece publicado.
            tolerance=(len(branch_rows)+1)*0.5
            r['conciliacaoDespesas']=dict(somaTribunais=displayed_sum,totalRamo=r['despesaTotal'],
                                          residuo=r['despesaTotal']-displayed_sum,tolerancia=tolerance,
                                          regra='Até R$ 0,50 por parcela e total, publicados em reais inteiros; sem corrigir parcelas.')
            if abs(r['despesaTotal']-displayed_sum)>tolerance:
                raise ValueError('Despesa dos tribunais não reconcilia com o ramo: '+r['id'])
    components = []
    component_lines=pages['71'].splitlines()
    for name in ['Pessoal e encargos','Benefícios','Outras','Terceirizados(as)','Estagiários(as)']:
        index=next(i for i,line in enumerate(component_lines) if name in line)
        column=component_lines[index].index(name)
        numbers=list(re.finditer(r'([\d.]+)\s*\(',component_lines[index+1]))
        if not numbers:
            raise ValueError('Composição de pessoal incompleta')
        # O PDF tem duas colunas de rótulos no mesmo y. A coluna do rótulo,
        # e não o primeiro número da linha, identifica a rubrica correspondente.
        match=min(numbers,key=lambda m:abs(m.start(1)-column))
        if abs(match.start(1)-column)>6:
            raise ValueError('Alinhamento da composição de pessoal mudou')
        components.append(dict(nome=name,valor=int(match[1].replace('.','')),pagina=71))
    def number(value):
        return float(value.replace('.','').replace(',','.'))
    def flat(page_number):
        # Quebras de linha e hifenização do PDF não podem separar o padrão buscado.
        return re.sub(r'-\n','',pages[str(page_number)]).replace('\n',' ')
    def found(pattern,page_number):
        match = re.search(pattern,flat(page_number))
        if not match:
            raise ValueError(f'Trecho ausente na p. {page_number}: {pattern}')
        return match
    cost = found(r'correspondem a ([\d,]+)% do PIB nacional ou a\s+([\d,]+)% dos gastos totais.*?R\$ ([\d.,]+) por habitante.*?'
                 r'([\d,]+)% das despesas são referentes a gastos com inativos.*?a despesa por habitante\s+é de R\$ ([\d.,]+) e representa ([\d,]+)% do PIB',64)
    per_capita = dict(valor=number(cost[3]),pib=number(cost[1]),gastosPublicos=number(cost[2]),
                      inativosPercentual=number(cost[4]),semInativos=number(cost[5]),pibSemInativos=number(cost[6]),
                      unidade='R$ por habitante, nominais de 2025',pagina=64,
                      nota='Valores publicados pelo CNJ com a população adotada pela fonte; a Scrutiniums não recalcula denominadores.')
    capita_rows = re.findall(r'^\s*([\d.]+,\d)\s+(TJ[A-Z]+)\s+([\d.]+,\d)\s*$',pages['113'],re.M)
    if len(capita_rows) != 27 or {s for _,s,_ in capita_rows} != {t['sigla'] for t in tribunals if t['ramo']=='estadual'}:
        raise ValueError('Despesa por habitante por TJ incompleta')
    for without,sigla,total in capita_rows:
        if number(without) > number(total):
            raise ValueError('Despesa sem inativos maior que a total: '+sigla)
        by_sigla[sigla].update(despesaPorHabitante=number(total),despesaPorHabitanteSemInativos=number(without),porHabitantePagina=113)
    for t in tribunals:
        t.setdefault('despesaPorHabitante',None)
        t.setdefault('despesaPorHabitanteSemInativos',None)
        t.setdefault('porHabitantePagina',None)
    branch_capita = re.search(r'^\s*([\d.]+,\d)\s+TJ\s+([\d.]+,\d)\s*$',pages['113'],re.M)
    if not branch_capita:
        raise ValueError('Despesa por habitante da Justiça Estadual ausente')
    data['ramos'][0].update(despesaPorHabitante=number(branch_capita[2]),despesaPorHabitanteSemInativos=number(branch_capita[1]))
    stopped = found(r'com ([\d,]+) milhões de processos pen-?\s*dentes.*?Destes, ([\d,]+) milhões, ou seja, ([\d,]+)%,\s+estavam suspensos, sobrestados ou em arquivo provisório',214)
    if number(stopped[1]) != data['nacional']['pendentesMilhoes']:
        raise ValueError('Acervo da p. 214 diverge do sumário')
    fiscal = found(r'execução fiscal representam aproximadamente ([\d,]+)% do total de\s+casos pendentes e ([\d,]+)% das execuções pendentes do Poder Judiciário, com taxa de congestionamento de ([\d,]+)%',229)
    fiscal_stock = found(r'Do total de ([\d,]+) milhões execuções fiscais pendentes: ([\d,]+) milhões \(([\d,]+)%\) estão\s+na Justiça Estadual e ([\d,]+) milhões \(([\d,]+)%\) estão na Justiça Federal',229)
    acervo = dict(suspensos=dict(processosMilhoes=number(stopped[2]),percentualPendentes=number(stopped[3]),pagina=214,
                                 definicao='Suspensos, sobrestados ou em arquivo provisório, aguardando situação jurídica futura: repercussão geral, recurso repetitivo, IRDR, IAC, precatório, captura de réu ou outra causa.'),
                  execucaoFiscal=dict(processosMilhoes=number(fiscal_stock[1]),percentualPendentes=number(fiscal[1]),
                                      percentualExecucoes=number(fiscal[2]),congestionamento=number(fiscal[3]),
                                      estadualPercentual=number(fiscal_stock[3]),federalPercentual=number(fiscal_stock[5]),pagina=229),
                  nota='Os dois recortes são publicados separadamente sobre o acervo pendente; a fonte não informa a sobreposição, por isso não se somam.')
    def section(page_number,start,end=None):
        """Trecho de uma figura numa página que reúne várias."""
        text=pages[str(page_number)]
        begin=text.index(start)
        return text[begin:text.index(end,begin)] if end else text[begin:]
    def pairs(text,value,expected,label):
        found={}
        for m in re.finditer(value+r'\s+(TJ[A-Z]+|TRF\d|TRT\d+)\s+'+value,text):
            found.setdefault(m[2],(m[1],m[3]))
        if set(found)!=set(expected):
            raise ValueError(f'{label}: tribunais divergentes {sorted(set(expected)^set(found))}')
        return found
    duration=r'(\d+a(?: e \d+m)?|\d+m)'
    percent=r'([\d,]+)%'
    for branch,page_number,start,end,interno_externo in [
            ('estadual',340,'Figura 290',None,(329,'Figura 282',None)),
            ('federal',400,'Figura 357',None,(394,'Figura 349','Figura 350')),
            ('trabalho',465,'Figura 421',None,(455,'Figura 413',None))]:
        expected=[t['sigla'] for t in tribunals if t['ramo']==branch]
        execution=pairs(section(page_number,start,end),duration,expected,'Execução '+branch)
        appeals=pairs(section(*interno_externo),percent,expected,'Recorribilidade '+branch)
        for sigla in expected:
            by_sigla[sigla].update(execucaoBaixados=short_months(execution[sigla][0]),execucaoPendentes=short_months(execution[sigla][1]),
                                   execucaoPagina=page_number,recorribilidadeInterna=number(appeals[sigla][0]),
                                   recorribilidadeExterna=number(appeals[sigla][1]),recorribilidadePagina=interno_externo[0])
    free=dict(re.findall(r'^\s*(TJ[A-Z]+)\s+(\d+)%\s*$',pages['303'],re.M))
    if set(free)!={t['sigla'] for t in tribunals if t['ramo']=='estadual'}:
        raise ValueError('Justiça gratuita por TJ incompleta')
    for t in tribunals:
        t['justicaGratuita']=float(free[t['sigla']]) if t['sigla'] in free else None
        t['justicaGratuitaPagina']=303 if t['sigla'] in free else None
    gratuity=found(r'casos solucionados com o benefício em 2025, de ([\d,]+)%\. Houve aumento de ([\d,]+) pontos percentuais',221)
    judges=dict(re.findall(r'^\s*(Justiça Estadual|Justiça do Trabalho|Justiça Federal|Tribunais Superiores|Poder Judiciário)\s+([\d,]+)\s*$',pages['51'],re.M))
    if len(judges)!=5:
        raise ValueError('Magistrados por cem mil habitantes incompletos')
    def table_row(label):
        match=re.search(re.escape(label)+r'\s+(\d+a e \d+m|\d+m|[\d.,]+%?)\s+(\d+a e \d+m|\d+m|[\d.,]+%?)(?=\s)',pages['231'])
        if not match:
            raise ValueError('Linha ausente na comparação europeia: '+label)
        return match[1],match[2]
    europe=[dict(indicador=label,uniaoEuropeia=ue,brasil=br) for label in
            ['Casos Novos por cem habitantes','Casos Pendentes por cem habitantes','Índice de Atendimento à Demanda',
             'Tempo de Giro do Acervo','Magistrados(as) por cem mil habitantes','Casos Novos por Magistrado(a)',
             'Processos Baixados por Magistrado(a)'] for ue,br in [table_row(label)]]
    criminal_text=found(r'ingressaram na Justiça Estadual no ano de\s+2025, ([\d,]+) milhões de casos novos criminais.*?foram iniciadas ([\d,]+) mil \(([\d,]+)%\)\s+execuções penais',286)
    penal=found(r'havia ([\d,]+) milhões de execuções penais pendentes, sendo ([\d,]+) milhão de penas privativas de liberdade \(([\d,]+)%\) e ([\d,]+) mil de penas alternativas\s+\(([\d,]+)%\)',286)
    share=found(r'Na área criminal, essa representatividade\s+aumenta para ([\d,]+)%',286)
    data.update(magistrados=dict(porCemMil=number(judges['Poder Judiciário']),
                                 porRamo={k:number(v) for k,v in judges.items() if k!='Poder Judiciário'},pagina=51,
                                 nota='Cargos de magistrado providos por cem mil habitantes, como publicados.'),
                comparacaoEuropa=dict(linhas=europe,pagina=231,
                                      nota='Comparação feita pelo CNJ com dados da CEPEJ; para comparabilidade, o CNJ soma todas as instâncias e usa cargos providos.'),
                justicaGratuita=dict(percentual=number(gratuity[1]),variacaoPontos=number(gratuity[2]),pagina=221,
                                     definicao='Processos arquivados definitivamente com assistência judiciária gratuita sobre o total arquivado, sem ações criminais e Juizados Especiais.'),
                criminal=dict(casosNovosEstadualMilhoes=number(criminal_text[1]),execucoesPenaisIniciadasMil=number(criminal_text[2]),
                              execucoesPenaisPendentesMilhoes=number(penal[1]),privativasMilhoes=number(penal[2]),privativasPercentual=number(penal[3]),
                              alternativasMil=number(penal[4]),alternativasPercentual=number(penal[5]),estadualPercentualCriminal=number(share[1]),pagina=286))
    data.update(versao=2,calculo='judiciario-4',capturadoEm=seed['capturadoEm'],tribunais=tribunals,porHabitante=per_capita,acervo=acervo,
                financeiro=dict(ramos=all_branches,total=sum(r['valor'] for r in all_branches),
                                pessoal=components,pessoalTotal=sum(r['valor'] for r in components),
                                series=seed['seriesDespesas'],convencao=seed['convencao'],
                                nominalHistoricoDisponivel=False),
                cobertura=dict(ramosAgregados=3,tribunaisEstaduais=27,tribunaisFederais=6,tribunaisTrabalho=24,
                               anosTribunais=[2025],anosFinanceiros=list(range(2009,2026)),
                               precisao='Volumes por ramo arredondados; tabelas de TJs/TRTs em unidades; tempos em meses; percentuais oficiais na precisão publicada.',
                               limite='Satisfação do direito, histórico individual de tribunais, despesa por TRF e nominal histórico não disponíveis.'),
                revisao=dict(portalRevalidado=True,originalBaixadoConferido=True,
                             nota='PDF integral da Biblioteca Digital e cópia do portal do CNJ (www.cnj.jus.br) baixados em 17/10/2026, com checksum idêntico; o portal lista a edição 2026 como a mais recente. Variações e pessoal do sumário p. 22 não utilizados por inconsistência de ano.'))
    data['fonte']['localizadores']='Páginas 22–24; tabelas 1/2 p. 40–41; finanças e despesa por habitante p. 62–71, 110–118, 132–139 e 157–165; acervo suspenso p. 214; execução fiscal p. 229; conciliação p. 232–234; desempenho e tempos p. 310–313, 333, 351–353, 383–384, 397, 407, 438–440, 459 e 473.'
    data['unidades'].update(despesaTotal='R$ nominais de 2025',despesaPorBaixaAproximada='R$/baixa (aproximação)',
                            ipcJus='%',congestionamento='%',iadOficial='%',despesaPorHabitante='R$ por habitante, nominais de 2025',execucaoBaixados='meses',execucaoPendentes='meses',recorribilidadeInterna='%',recorribilidadeExterna='%',justicaGratuita='%',despesaPorHabitanteSemInativos='R$ por habitante, nominais de 2025',congestionamentoBruto='%',
                            congestionamentoLiquido='%',magistrados='pessoas',servidores='pessoas')
    return data


def history(data):
    """Tempos por tribunal publicados nas edições 2022 a 2025; a edição 2026 é a corrente."""
    from pipeline.judiciario.historico import tempos
    if hashlib.sha256(HISTORY.read_bytes()).hexdigest() != HASHES['historico']:
        raise ValueError('Integridade da semente histórica divergente')
    seed = json.loads(gzip.decompress(HISTORY.read_bytes()))
    siglas = {t['sigla'] for t in data['tribunais']}
    editions = []
    for edition in seed['edicoes']:
        found = tempos('\n'.join(edition['paginas'].values()), siglas)
        tjs = [s for s in found if s.startswith('TJ')]
        if len(tjs) != 27:
            raise ValueError(f'Edição {edition["edicao"]}: Tribunais de Justiça incompletos')
        editions.append(dict(edicao=edition['edicao'], ano=edition['ano'], url=edition['url'], sha256=edition['sha256'],
                             paginas=sorted(int(p) for p in edition['paginas']), valores=found))
    years = [e['ano'] for e in editions] + [data['ano']]
    if years != sorted(years) or len(set(years)) != len(years):
        raise ValueError('Anos da série histórica fora de ordem')
    for t in data['tribunais']:
        t['historico'] = [dict(ano=e['ano'], edicao=e['edicao'], **e['valores'][t['sigla']]) if t['sigla'] in e['valores']
                          else dict(ano=e['ano'], edicao=e['edicao'], tempoBaixados=None, idadePendentes=None)
                          for e in editions] + [dict(ano=data['ano'], edicao=data['edicao'], tempoBaixados=t['tempoBaixados'],
                                                     idadePendentes=t['idadePendentes'])]
    data['historicoTempos'] = dict(
        anos=years, edicoes=[{k: e[k] for k in ['edicao', 'ano', 'url', 'sha256', 'paginas']} for e in editions],
        ausentes=sorted(f'{t["sigla"]} {h["ano"]}' for t in data['tribunais'] for h in t['historico'] if h['tempoBaixados'] is None),
        nota='Cada edição publica médias calculadas com os dados disponíveis à época; anos anteriores não são revisados. '
             'Mudanças de cadastro e de sistemas no DataJud podem alterar a série. Ausência significa valor não legível no texto da figura ou tribunal ainda não instalado (TRF6, criado em 2022), não zero.')
    data['integridadeSementes'] = HASHES
    return data


def validate(data):
    if data['versao'] != 2 or {r['id'] for r in data['ramos']} != {b[0] for b in BRANCHES} or len(data['ramos']) != 3:
        raise ValueError('Universo de ramos inválido')
    rows = data['tribunais']
    if len(rows) != 57 or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Tribunais ausentes ou duplicados')
    for branch,count in [('estadual',27),('federal',6),('trabalho',24)]:
        if sum(r['ramo']==branch for r in rows)!=count:
            raise ValueError('Ramo incompatível')
    for r in rows:
        if r['ramo'] not in {'estadual','federal','trabalho'} or r['ano'] != data['ano']:
            raise ValueError('Ramo/ano incompatível')
        for field in ['tempoBaixados', 'idadePendentes']:
            if isinstance(r[field], bool) or not isinstance(r[field], int) or r[field] < 0:
                raise ValueError('Duração inválida')
        for field in ['ipcJus','congestionamento']:
            if not isinstance(r[field],(int,float)) or not 0<=r[field]<=100:
                raise ValueError('Percentual oficial inválido')
        if r['ramo']!='estadual' and r['uf'] is not None:
            raise ValueError('Jurisdição regional indevidamente atribuída à UF da sede')
        for key in ['despesaTotal','novos','pendentes','magistrados','servidores']:
            if r[key] is not None and (isinstance(r[key],bool) or not isinstance(r[key],int) or r[key]<0):
                raise ValueError('Valor contábil ou contagem inválidos: '+key)
        if r['ramo']!='federal' and (r['porte'] not in {'Grande','Médio','Pequeno'} or r['despesaTotal'] is None):
            raise ValueError('Cobertura institucional incompleta')
    for r in data['ramos']:
        for key in ['novos', 'baixados', 'pendentes', 'idadePendente', 'conhecimento', 'execucao', 'cejuscs']:
            if not isinstance(r[key], (int, float)) or isinstance(r[key], bool) or not math.isfinite(r[key]) or r[key] < 0:
                raise ValueError('Valor inválido: ' + key)
        if r['novos'] <= 0 or not math.isclose(r['atendimentoAproximado'], 100 * r['baixados'] / r['novos']):
            raise ValueError('Razão incompatível')
    if sorted(p['ano'] for p in data['conciliacaoSerie']) != list(range(2015, 2026)):
        raise ValueError('Série de conciliação incompleta')
    for series in data['financeiro']['series'].values():
        if [p['ano'] for p in series]!=list(range(2009,2026)) or any(p['valor']<=0 for p in series):
            raise ValueError('Série financeira incompatível')
    finance=data['financeiro']
    if len(finance['ramos'])!=6 or len({r['id'] for r in finance['ramos']})!=6:
        raise ValueError('Perímetro financeiro inválido')
    if sum(r['valor'] for r in finance['ramos'])!=finance['total'] or sum(r['valor'] for r in finance['pessoal'])!=finance['pessoalTotal']:
        raise ValueError('Composição financeira divergente')
    if not 0<finance['pessoalTotal']<=finance['total']:
        raise ValueError('Pessoal fora do total financeiro')
    for r in data['ramos']:
        if 'conciliacaoDespesas' in r:
            c=r['conciliacaoDespesas']
            actual=sum(t['despesaTotal'] for t in rows if t['ramo']==r['id'])
            if actual!=c['somaTribunais'] or r['despesaTotal']-actual!=c['residuo'] or abs(c['residuo'])>c['tolerancia']:
                raise ValueError('Reconciliação financeira inválida')
    for r in rows:
        for key in ['execucaoBaixados','execucaoPendentes']:
            if not isinstance(r[key],int) or r[key]<0:
                raise ValueError('Tempo de execução inválido: '+r['sigla'])
        for key in ['recorribilidadeInterna','recorribilidadeExterna']:
            if not 0<=r[key]<=100:
                raise ValueError('Recorribilidade inválida: '+r['sigla'])
        if (r['ramo']=='estadual')!=(r['justicaGratuita'] is not None):
            raise ValueError('Justiça gratuita fora do universo dos TJs: '+r['sigla'])
        if len(r['historico'])!=len(data['historicoTempos']['anos']) or r['historico'][-1]['tempoBaixados']!=r['tempoBaixados']:
            raise ValueError('Série histórica incoerente: '+r['sigla'])
    if not 0<data['magistrados']['porCemMil']<100 or not 0<data['justicaGratuita']['percentual']<100:
        raise ValueError('Indicador nacional incoerente')
    capita=data['porHabitante']
    if not (0<capita['semInativos']<capita['valor'] and 0<capita['pibSemInativos']<=capita['pib']<100 and 0<capita['inativosPercentual']<100):
        raise ValueError('Despesa por habitante nacional incoerente')
    for r in rows:
        if r['ramo']=='estadual' and not (isinstance(r['despesaPorHabitante'],float) and 0<r['despesaPorHabitanteSemInativos']<=r['despesaPorHabitante']):
            raise ValueError('Despesa por habitante ausente: '+r['sigla'])
        if r['ramo']!='estadual' and r['despesaPorHabitante'] is not None:
            raise ValueError('Despesa por habitante regional atribuída sem fonte: '+r['sigla'])
    for key in ['suspensos','execucaoFiscal']:
        part=data['acervo'][key]
        if not (0<part['processosMilhoes']<data['nacional']['pendentesMilhoes'] and 0<part['percentualPendentes']<100):
            raise ValueError('Recorte do acervo incoerente: '+key)
    # Reconciliação admite exclusivamente arredondamento declarado, não corrige os valores.
    for key, national_key in [('novos', 'novosMilhoes'), ('baixados', 'baixadosMilhoes'), ('pendentes', 'pendentesMilhoes')]:
        if sum(r[key] for r in data['ramos']) > data['nacional'][national_key] * 1_000_000 + 200_000:
            raise ValueError('Soma dos três ramos excede o universo nacional')


def artifacts(data):
    def encoded(value):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n'
    files = {'snapshot.json': encoded(data)}
    for name, fields in [('ramos', ['id','nome','ano','novos','baixados','pendentes','idadePendente','conhecimento','execucao','cejuscs','atendimentoAproximado','resolucaoVolumes','nota','despesaTotal','despesaPorBaixaAproximada','iadOficial','congestionamentoBruto','congestionamentoLiquido','desempenhoPagina']),
                         ('tribunais', ['id','sigla','uf','ramo','ano','tempoBaixados','idadePendentes','pagina','porte','despesaTotal','novos','pendentes','magistrados','servidores','ipcJus','ipcPagina','congestionamento','congestionamentoPagina','estruturaPagina','despesaPorHabitante','despesaPorHabitanteSemInativos','porHabitantePagina','execucaoBaixados','execucaoPendentes','execucaoPagina','recorribilidadeInterna','recorribilidadeExterna','recorribilidadePagina','justicaGratuita','justicaGratuitaPagina'])]:
        stream = io.StringIO(newline='')
        writer = csv.DictWriter(stream, fields + ['unidades','fonte','url','captura'], delimiter=';')
        writer.writeheader()
        writer.writerows({**{field:r.get(field) for field in fields}, 'unidades':'; '.join(f'{field}={data["unidades"][field]}' for field in fields if field in data['unidades']), 'fonte':data['fonte']['nome'], 'url':data['fonte']['url'], 'captura':data['capturadoEm']} for r in data[name])
        files[name + '.csv'] = '\ufeff' + stream.getvalue()
    stream=io.StringIO(newline='')
    writer=csv.writer(stream,delimiter=';');writer.writerow(['Universo','Ano','Valor','Unidade','Resolucao','Pagina','Fonte','Convencao'])
    for branch,series in data['financeiro']['series'].items():
        for point in series:
            writer.writerow([branch,point['ano'],point['valor'],point['unidade'],point['resolucao'],point['pagina'],data['fonte']['url'],data['financeiro']['convencao']])
    files['despesas-historico.csv']='\ufeff'+stream.getvalue()
    stream=io.StringIO(newline='')
    writer=csv.writer(stream,delimiter=';');writer.writerow(['Tribunal','Ramo','Ano','Edicao','DuracaoMediaBaixados','IdadeMediaPendentes','Unidade','Fonte','Nota'])
    sources={e['edicao']:e['url'] for e in data['historicoTempos']['edicoes']}
    sources[data['edicao']]=data['fonte']['url']
    for t in data['tribunais']:
        for h in t['historico']:
            writer.writerow([t['sigla'],t['ramo'],h['ano'],h['edicao'],h['tempoBaixados'],h['idadePendentes'],'meses',sources[h['edicao']],'Vazio: valor ausente na figura extraída; não é zero.'])
    files['tribunais-historico.csv']='\ufeff'+stream.getvalue()
    manifest = dict(calculo=data['calculo'], fonte=data['fonte'], sementes=data['integridadeSementes'],
                    arquivos={name:hashlib.sha256(body.encode()).hexdigest() for name,body in files.items()})
    files['manifesto.json'] = encoded(manifest)
    return files


def publish(data, out=OUT, check=False):
    validate(data)
    files = artifacts(data)  # Valida tudo antes de escrever; nunca publica um snapshot vazio.
    if check:
        if any(not (out/name).exists() or (out/name).read_bytes() != body.encode() for name,body in files.items()):
            raise ValueError('Saídas publicadas divergentes do cálculo')
        return
    out.mkdir(parents=True, exist_ok=True)
    # Etapa completa em diretório temporário; snapshot é promovido por último.
    with tempfile.TemporaryDirectory(dir=out.parent) as temporary:
        staging = Path(temporary)
        for name, body in files.items():
            (staging/name).write_bytes(body.encode())
        for name in [n for n in files if n != 'snapshot.json'] + ['snapshot.json']:
            os.replace(staging/name, out/name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    publish(extract(), check=args.check)
    print('Judiciário: três ramos, 57 tribunais, 17 anos financeiros e 11 anos de conciliação; integridade verificada.')
