import json, sys, urllib.parse
from lib import *
SUJ={"despesa":"A despesa total em Educação","despesa_hab":"A despesa em Educação por habitante","despesa_mat":"A razão da despesa de aplicação direta por matrícula",
"matriculas":"O número de matrículas na rede municipal","conveniadas":"O número de matrículas em escolas conveniadas com o município","atu":"A média de alunos por turma","aprovacao":"A taxa de aprovação","ideb":"O Ideb","saeb":"A proficiência média no Saeb"}
ETF={"total":"em toda a educação básica","creche":"na creche","pre_escola":"na pré-escola","anos_iniciais":"nos anos iniciais","anos_finais":"nos anos finais","ensino_medio":"no ensino médio","eja":"na educação de jovens e adultos","profissional":"na educação profissional"}
ETAPAS_VALIDAS={"matriculas":None,"conveniadas":None,"atu":["creche","pre_escola","anos_iniciais","anos_finais"],"aprovacao":["anos_iniciais","anos_finais"],"ideb":["anos_iniciais","anos_finais"],"saeb":["anos_iniciais","anos_finais"]}
ANOS={"despesa":range(2021,2026),"despesa_hab":range(2021,2026),"despesa_mat":range(2021,2026),"matriculas":range(2021,2026),"conveniadas":range(2021,2026),"atu":range(2021,2026),"aprovacao":range(2021,2026),"ideb":[2005,2007,2009,2011,2013,2015,2017,2019,2021,2023,2025],"saeb":[2005,2007,2009,2011,2013,2015,2017,2019,2021,2023,2025]}
TEMA={"gastos":["despesa","despesa_hab","despesa_mat"],"atendimento":["matriculas","conveniadas","atu"],"resultados":["aprovacao","ideb","saeb"]}
PADRAO_ETAPA="anos_iniciais"
def nm(c): return f"{c['nome']} ({c['uf']})"
def lista(ns,mx=2):
    if len(ns)<=mx: return " e ".join(ns) if len(ns)==2 else "".join(ns)
    return ", ".join(ns[:mx])+f" e mais {len(ns)-mx}"
def ano_valido(m,a):
    anos=list(ANOS[m])
    if a in anos: return a
    antes=[x for x in anos if x<=a]
    return antes[-1] if antes else anos[0]
def etapa_ef(m,pedida):
    v=ETAPAS_VALIDAS.get(m,"nao")
    if v=="nao": return None
    if v is None: return pedida
    if pedida in v: return pedida
    return PADRAO_ETAPA if PADRAO_ETAPA in v else v[0]
def check(r):
    u=urllib.parse.urlparse(r['url']); tema=u.path.rsplit('/',1)[1]; q=dict(urllib.parse.parse_qsl(u.query))
    m=q.get('med',{"gastos":"despesa_hab","atendimento":"atu","resultados":"ideb"}.get(tema,"despesa_hab"))
    moeda=q.get('moeda','nominal'); disc=q.get('disc','matematica'); cap=q.get('cap') or None
    pedida=q.get('etapa',PADRAO_ETAPA)
    anoq=int(q['ano']) if q.get('ano','').isdigit() else 0
    ano=ano_valido(m,anoq) if anoq else list(ANOS[m])[-1]
    et=etapa_ef(m,pedida)
    items,sem,cv=eleg_list(m,ano,et,moeda,disc)
    txt=r['main']; errs=[]
    def need(s,why):
        if s not in txt: errs.append(f"falta [{why}]: {s!r}")
    if not items:
        return errs
    st=stats(m,items); n=st['n']
    cmin=sorted((nm(c) for c,o in items if o['valor']==st['minimo']),key=chave_pt); cmax=sorted((nm(c) for c,o in items if o['valor']==st['maximo']),key=chave_pt)
    comp=[]
    if m=='saeb': comp.append("em "+("Matemática" if disc=="matematica" else "Língua Portuguesa"))
    if ETAPAS_VALIDAS.get(m,"nao")!="nao": comp.append(ETF[et])
    suj=SUJ[m]+(" "+" ".join(comp) if comp else "")
    per=f"na edição {ano}" if m in("ideb","saeb") else f"em {ano}"
    if st['minimo']==st['maximo']:
        tit=f"{suj} é {fmt(m,st['minimo'])} nas {n} capitais com dado comparável {per}."
    else:
        tit=f"{suj} vai de {fmt(m,st['minimo'])} em {lista(cmin)} a {fmt(m,st['maximo'])} em {lista(cmax)} entre as {n} capitais com dado comparável {per}."
    need(tit,'título')
    need(("Há dados comparáveis para as 26 capitais." if n==26 else f"Há dados comparáveis para {n} das 26 capitais."),'cobertura')
    need(f"Mediana\n{fmt(m,st['mediana'])}\nMédia simples\n{fmt(m,st['media'])}\nMenor valor\n{fmt(m,st['minimo'])} · ",'refs-a')
    import re as _re
    mm_=_re.search(r"Menor valor\n[^\n·]*· ([^\n]*)\nMaior valor\n[^\n·]*· ([^\n]*)\nCapitais na comparação\n(\d+) de (\d+)",txt)
    if not mm_: errs.append('refs: bloco não encontrado')
    else:
        a=set(mm_.group(1).split(', ')); b=set(mm_.group(2).split(', '))
        if a!=set(cmin): errs.append(f'refs: capitais do mínimo {a} vs {set(cmin)}')
        if b!=set(cmax): errs.append(f'refs: capitais do máximo {b} vs {set(cmax)}')
        if int(mm_.group(3))!=n or int(mm_.group(4))!=26: errs.append('refs: n')
        if mm_.group(1).split(', ')!=cmin or mm_.group(2).split(', ')!=cmax: errs.append('ordem de empatados difere do título (alfabética)')
    need(f"Maior valor\n{fmt(m,st['maximo'])} · ",'refs-b')
    if n>=8: need(f"Metade central\n{fmt(m,st['q1'])} a {fmt(m,st['q3'])}",'quartis')
    # cartões
    if tema in TEMA:
        for mm in TEMA[tema]:
            a2=ano_valido(mm,anoq) if anoq else list(ANOS[mm])[-1]
            e2=etapa_ef(mm,pedida)
            it2,_,_=eleg_list(mm,a2,e2,moeda,disc); s2=stats(mm,it2)
            if cap:
                o=OBS.get((MED[mm][0],BYID[cap]['cod_ibge'],a2,e2,comp_key(mm,moeda,disc)))
                if o and o['status']=='OBSERVADO' and o['valor'] is not None:
                    need(f"{fmt(mm,o['valor'])}\n",f'cartão {mm} valor')
                    if s2: need(f"{'Fora da comparação. ' if not o['elegivel_comparacao'] else ''}Mediana das capitais: {fmt(mm,s2['mediana'])}",f'cartão {mm} mediana')
                else:
                    need("sem valor",f'cartão {mm} sem valor')
            elif s2:
                need(f"Mediana de {s2['n']} capitais · de {fmt(mm,s2['minimo'])} a {fmt(mm,s2['maximo'])}",f'cartão {mm}')
    # frase capital
    if cap:
        o=OBS.get((MED[m][0],BYID[cap]['cod_ibge'],ano,et,comp_key(m,moeda,disc)))
        c=BYID[cap]
        if o and o['status']=='OBSERVADO' and o['valor'] is not None and o['elegivel_comparacao']:
            need(f"{nm(c)} registra {fmt(m,o['valor'])}; a mediana das {n} capitais é {fmt(m,st['mediana'])}",'frase capital')
        elif o and o['status']!='OBSERVADO':
            need(f"{nm(c)} não tem valor observado para esta medida neste recorte.",'frase sem valor')
    if len(sem):
        need((f"{len(sem)} capital fora desta comparação" if len(sem)==1 else f"{len(sem)} capitais fora desta comparação").upper(),'lista fora')
        for c,o in sem: need(nm(c),'nome fora')
    return errs
if __name__=="__main__":
    out=json.load(open(sys.argv[1]))
    tot=bad=0
    for r in out:
        if r['name'].startswith('GC|'): continue
        if 'erro' in r: print('ERRO',r['name'],r['erro']); bad+=1; continue
        e=check(r); tot+=1
        if e: bad+=1; print('FALHA',r['name']); [print('   ',x) for x in e[:5]]
    print('cenarios',tot,'com falha',bad)
