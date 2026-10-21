"""Reimplementação independente da elegibilidade (DCA x RREO x MSC) e do numerador/razão por matrícula, a partir das sementes."""
import gzip, json, os, csv, collections
from lib import *
SEED=f"{R}/pipeline/eficiencia/seed"
def lj(p):
    with gzip.open(p,"rt",encoding="utf-8") as f: return json.load(f)
def dca(cod,ano):
    a=[r for r in lj(f"{SEED}/siconfi/dca_anexo_i_e/{cod}_{ano}.json.gz") if r["cod_conta"]=="TotalDespesas" and r["conta"]=="12 - Educação" and r["coluna"]=="Despesas Liquidadas"]
    return a[0]["valor"]
def rreo(cod,ano):
    p=f"{SEED}/siconfi/rreo_anexo_02_b6/{cod}_{ano}.json.gz"
    if not os.path.exists(p): return None
    ex=None; it=None
    for x in lj(p):
        if x.get("conta")=="Educação" and str(x.get("coluna","")).startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE"):
            if "Exceto" in x.get("rotulo",""): ex=x["valor"]
            else: it=x["valor"]
    return ex
def msc_lines(cod,ano):
    p=f"{SEED}/siconfi/msc_funcao12/{cod}_{ano}_12.json.gz"
    return lj(p) if os.path.exists(p) else None
def sinal(x): return x["valor"] if x["natureza_conta"]=="C" else -x["valor"]
res=[];dif=0
for c in CAPS:
    cod=c["cod_ibge"]
    for ano in range(2021,2026):
        d=dca(cod,ano); r=rreo(cod,ano); L=msc_lines(cod,ano)
        o=OBS[("edu.despesa.funcao_educacao",cod,ano,None,"nominal")]
        if r is None: sit="NAO_CONFERIDO"; el=False
        else:
            df=d-r
            if abs(df)<=1: sit="CONFERE";el=True
            elif abs(df)<=0.001*d: sit="DIFERENCA_MENOR";el=True
            else:
                sit="PENDENTE";el=False
                if L:
                    tot=sum(sinal(x) for x in L if str(x["funcao"])=="12" and str(x["conta_contabil"])[:7] in("6221303","6221304","6221307"))
                    intra=sum(sinal(x) for x in L if str(x["funcao"])=="12" and str(x["conta_contabil"])[:7] in("6221303","6221304","6221307") and str(x.get("natureza_despesa") or "")[2:4]=="91")
                    if abs(d-(tot-intra))<=1: sit="RECONCILIADA_MSC";el=True
                    elif abs(d-tot)<=1 and intra>1: sit="PERIMETRO_INTRA_MSC";el=False
        g_sit=o["conferencia"]["situacao"]; g_el=o["elegivel_comparacao"]
        ok=(sit==g_sit and el==g_el)
        if not ok: dif+=1; print("DIVERGE",c["nome"],ano,sit,el,g_sit,g_el)
        res.append((c["nome"],ano,sit,el))
print("pares",len(res),"divergências de elegibilidade",dif)
print(collections.Counter(s for _,_,s,_ in res))
