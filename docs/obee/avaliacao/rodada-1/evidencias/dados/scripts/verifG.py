import json, sys, re, urllib.parse
from lib import *
SUJ={"despesa":"A despesa total em Educação","despesa_hab":"A despesa em Educação por habitante","despesa_mat":"A razão da despesa de aplicação direta por matrícula"}
def nm(c): return f"{c['nome']} ({c['uf']})"
def lista(ns,mx=2):
    if len(ns)<=mx: return " e ".join(ns) if len(ns)==2 else "".join(ns)
    return ", ".join(ns[:mx])+f" e mais {len(ns)-mx}"
def nomes_ordenados(items, alvo):
    cs=[c for c,o in items if o["valor"]==alvo]
    return sorted([nm(c) for c in cs], key=chave_pt)  # localeCompare pt-BR ~ alfabetica

def check(scn,res):
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(scn['url']).query))
    m=q['med']; ano=int(q['ano']); moeda=q.get('moeda','nominal'); cap=q.get('cap')
    items,sem,cv=eleg_list(m,ano,None,moeda)
    st=stats(m,items)
    txt=res['main']
    errs=[]
    def need(s,why):
        if s not in txt: errs.append(f"falta [{why}]: {s!r}")
    n=st['n']
    # título
    cmin=nomes_ordenados(items,st['minimo']); cmax=nomes_ordenados(items,st['maximo'])
    tit=f"{SUJ[m]} vai de {fmt(m,st['minimo'])} em {lista(cmin)} a {fmt(m,st['maximo'])} em {lista(cmax)} entre as {n} capitais com dado comparável em {ano}."
    need(tit,'título')
    # cobertura
    need(("Há dados comparáveis para as 26 capitais." if n==26 else f"Há dados comparáveis para {n} das 26 capitais."),'cobertura')
    # referências
    need(f"Mediana\n{fmt(m,st['mediana'])}\nMédia simples\n{fmt(m,st['media'])}\nMenor valor\n{fmt(m,st['minimo'])} · {', '.join(cmin)}\nMaior valor\n{fmt(m,st['maximo'])} · {', '.join(cmax)}\nCapitais na comparação\n{n} de 26",'refs')
    if n>=8: need(f"Metade central\n{fmt(m,st['q1'])} a {fmt(m,st['q3'])}",'quartis')
    if m in('despesa_hab','despesa_mat'):
        den="dos habitantes" if m=="despesa_hab" else "das matrículas"
        need(f"Razão agregada {fmt(m,st['razao'])}: soma da despesa de {n} capitais ÷ soma {den} das mesmas {n} ({inteiro(st['sd'])})",'razão agregada')
    # cartões da família
    for mm in ("despesa","despesa_hab","despesa_mat"):
        it2,_,_=eleg_list(mm,ano,None,moeda); s2=stats(mm,it2)
        if cap:
            o=OBS.get((MED[mm][0],BYID[cap]['cod_ibge'],ano,None,comp_key(mm,moeda,None)))
            if o and o['status']=='OBSERVADO' and o['valor'] is not None:
                need(fmt(mm,o['valor']),f'cartão {mm} valor')
                need(f"{'Fora da comparação. ' if not o['elegivel_comparacao'] else ''}Mediana das capitais: {fmt(mm,s2['mediana'])}",f'cartão {mm} mediana')
        else:
            need(f"Mediana de {s2['n']} capitais · de {fmt(mm,s2['minimo'])} a {fmt(mm,s2['maximo'])}",f'cartão {mm}')
    # frase da capital (somente para a medida ativa)
    if cap:
        o=OBS.get((MED[m][0],BYID[cap]['cod_ibge'],ano,None,comp_key(m,moeda,None)))
        if o and o['status']=='OBSERVADO' and o['valor'] is not None:
            c=BYID[cap]
            if o['elegivel_comparacao']:
                d=o['valor']-st['mediana']
                dtxt=fmt(m,abs(d)) if m!='despesa' else reais_ext(abs(d))
                sentido='acima' if d>0 else 'abaixo'
                need(f"{nm(c)} registra {fmt(m,o['valor'])}; a mediana das {n} capitais é {fmt(m,st['mediana'])} ({dtxt} {sentido}).",'frase capital')
            else:
                need(f"{nm(c)} registra {fmt(m,o['valor'])}, valor fora da comparação entre capitais",'frase capital fora')
        else:
            pass
    # excluídas
    if len(sem):
        need((f"{len(sem)} capital fora desta comparação" if len(sem)==1 else f"{len(sem)} capitais fora desta comparação").upper(),'lista fora')
        for c,o in sem: need(nm(c),'nome fora')
    return errs
if __name__=="__main__":
    out=json.load(open(sys.argv[1]))
    tot=0;bad=0
    for r in out:
        if 'erro' in r: print('ERRO',r['name'],r['erro']); bad+=1; continue
        e=check(r,r); tot+=1
        if e: bad+=1; print('FALHA',r['name']); [print('   ',x) for x in e[:6]]
    print('cenarios',tot,'com falha',bad)
