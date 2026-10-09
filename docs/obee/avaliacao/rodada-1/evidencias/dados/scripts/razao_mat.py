from elegib import lj, msc_lines, dca, SEED
from lib import *
import csv, gzip
def censo_mat(cod,ano):
    with gzip.open(f"{SEED}/inep_censo/escolas_capitais_{ano}.csv.gz","rt",encoding="utf-8") as f:
        return sum(int(float(r["QT_MAT_BAS"] or 0)) for r in csv.DictReader(f) if r["CO_MUNICIPIO"]==str(cod) and r["TP_DEPENDENCIA"]=="3")
out=[];bad=0;n=0;semg=0
for c in CAPS:
    cod=c["cod_ibge"]
    for ano in range(2021,2026):
        L=msc_lines(cod,ano); g=OBS.get(("edu.despesa.aplicacao_direta_por_matricula",cod,ano,None,"nominal"))
        if not L:
            out.append((c["nome"],ano,"sem MSC",None,g["status"])); continue
        num=0.0;tot_semintra=0.0
        for x in L:
            if str(x["funcao"])!="12" or str(x["conta_contabil"])[:7] not in("6221303","6221304","6221307"): continue
            v=x["valor"] if x["natureza_conta"]=="C" else -x["valor"]
            nd=str(x.get("natureza_despesa") or "")
            mod=nd[2:4]
            if mod=="91": continue
            tot_semintra+=v
            if mod in("90","93","94") and str(x["subfuncao"])!="364" and not (nd[:2]=="31" and nd[4:6] in("01","03","05")):
                num+=v
        d=dca(cod,ano)
        fecha=abs(tot_semintra-d)<=max(1.0,0.001*d)
        mat=censo_mat(cod,ano)
        val=num/mat if fecha else None
        gv=g["valor"] if g["status"]=="OBSERVADO" else None
        if (val is None)!=(gv is None) or (val is not None and abs(val-gv)>0.01):
            bad+=1; print("DIVERGE",c["nome"],ano,val,gv,g["status"])
        n+=1
        out.append((c["nome"],ano,round(num,2),round(val,4) if val else None,g["status"]))
print("pares",n,"divergências",bad)
