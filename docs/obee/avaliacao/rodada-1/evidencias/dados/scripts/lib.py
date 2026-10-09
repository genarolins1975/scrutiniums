import json, math, re, unicodedata
from decimal import Decimal, ROUND_HALF_UP
R="/home/user/scrutiniums"
GOLD=json.load(open(f"{R}/public/eficiencia/gold/educacao_capitais.json",encoding="utf-8"))
CAPS=GOLD["universo"]["capitais"]
BYID={c["id"]:c for c in CAPS}
BYCOD={c["cod_ibge"]:c for c in CAPS}
OBS={}
for o in GOLD["observacoes"]:
    OBS[(o["indicador"],o["ente"],o["ano"],o["etapa"],o["componente"])]=o

def _fmt(v,casas):
    d=Decimal(repr(float(v))).quantize(Decimal(1).scaleb(-casas),rounding=ROUND_HALF_UP)
    s=f"{abs(d):,.{casas}f}".replace(",","§").replace(".",",").replace("§",".")
    return ("-" if d<0 else "")+s
def inteiro(v): return _fmt(v,0)
def d1(v): return _fmt(v,1)
def d2(v): return _fmt(v,2)
def reais_int(v): return "R$ "+inteiro(v)
def reais_ext(v):
    a=abs(v)
    if a>=1e9: return f"R$ {d2(v/1e9)} {'bilhão' if a<2e9 else 'bilhões'}"
    if a>=1e6: return f"R$ {d1(v/1e6)} {'milhão' if a<2e6 else 'milhões'}"
    if a>=1e3: return f"R$ {d1(v/1e3)} mil"
    return "R$ "+d2(v)

MED={"despesa":("edu.despesa.funcao_educacao",False),"despesa_hab":("edu.despesa.por_habitante",False),"despesa_mat":("edu.despesa.aplicacao_direta_por_matricula",False),
 "matriculas":("edu.matriculas.rede_municipal",True),"conveniadas":("edu.matriculas.conveniadas_municipais",True),"atu":("edu.atu.rede_municipal",True),
 "aprovacao":("edu.aprovacao.rede_municipal",True),"ideb":("edu.ideb.rede_municipal",True),"saeb":("edu.saeb.rede_municipal",True)}
def fmt(m,v):
    if m=="despesa": return reais_ext(v)
    if m in("despesa_hab","despesa_mat"): return reais_int(v)
    if m in("matriculas","conveniadas"): return inteiro(v)
    if m=="atu": return d1(v)
    if m=="aprovacao": return d1(v)+"%"
    if m=="ideb": return d1(v)
    if m=="saeb": return d2(v)
def comp_key(m,moeda,disc):
    if m.startswith("despesa"): return "real_2025" if moeda=="real" else "nominal"
    if m=="ideb": return "ideb"
    if m=="saeb": return disc
    return None
def eleg_list(m,ano,etapa,moeda="nominal",disc="matematica",grupo=None):
    ind,tem_et=MED[m]
    k=comp_key(m,moeda,disc)
    e=etapa if tem_et else None
    out=[];sem=[];com_valor=0
    for c in CAPS:
        if grupo and c["regiao"]!=grupo: continue
        o=OBS.get((ind,c["cod_ibge"],ano,e,k))
        if o is None or o["status"]!="OBSERVADO" or o["valor"] is None:
            sem.append((c,o)); continue
        com_valor+=1
        if not o["elegivel_comparacao"]: sem.append((c,o)); continue
        out.append((c,o))
    return out,sem,com_valor
def q7(vs,p):
    s=sorted(vs); pos=(len(s)-1)*p; lo=math.floor(pos); hi=math.ceil(pos)
    return s[lo]+(s[hi]-s[lo])*(pos-lo)
def med(vs):
    s=sorted(vs); n=len(s); 
    return s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2
def stats(m,items):
    vs=[o["valor"] for c,o in items]
    if not vs: return None
    st=dict(n=len(vs),mediana=med(vs),media=sum(vs)/len(vs),minimo=min(vs),maximo=max(vs),q1=q7(vs,.25),q3=q7(vs,.75))
    st["cmin"]=sorted(c["nome"] for c,o in items if o["valor"]==st["minimo"])
    st["cmax"]=sorted(c["nome"] for c,o in items if o["valor"]==st["maximo"])
    if all("calculo" in o for c,o in items):
        sn=sum(o["calculo"]["numerador"] for c,o in items); sd=sum(o["calculo"]["denominador"] for c,o in items)
        st["razao"]=sn/sd; st["sd"]=sd; st["sn"]=sn
    return st

def chave_pt(s): return ''.join(ch for ch in unicodedata.normalize('NFD',s) if unicodedata.category(ch)!='Mn').lower()
