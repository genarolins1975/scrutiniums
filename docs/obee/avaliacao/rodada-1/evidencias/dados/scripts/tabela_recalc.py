import json,re,csv,gzip
from elegib import lj, msc_lines, dca, SEED
from lib import *
ip=lj(f"{SEED}/ibge_ipca/ipca_numero_indice_2021_2025.json.gz")[0]["resultados"][0]["series"][0]["serie"]
media={a:sum(float(ip[f"{a}{m:02d}"]) for m in range(1,13))/12 for a in range(2021,2026)}
fator={a:media[2025]/media[a] for a in media}
pop_raw=lj(f"{SEED}/ibge_populacao/populacao_capitais.json.gz")
pop={(r["cod"],r["ano"]):r["valor"] for r in pop_raw}
for r in lj(f"{SEED}/ibge_populacao/relacao_2023_capitais.json.gz"): pop[(r["cod"],r["ano"])]=r["valor"]
def censo_mat(cod,ano):
    with gzip.open(f"{SEED}/inep_censo/escolas_capitais_{ano}.csv.gz","rt",encoding="utf-8") as f:
        return sum(int(float(r["QT_MAT_BAS"] or 0)) for r in csv.DictReader(f) if r["CO_MUNICIPIO"]==str(cod) and r["TP_DEPENDENCIA"]=="3")
def razao(cod,ano):
    L=msc_lines(cod,ano)
    if not L: return None
    num=tot=0.0
    for x in L:
        if str(x["funcao"])!="12" or str(x["conta_contabil"])[:7] not in("6221303","6221304","6221307"): continue
        v=x["valor"] if x["natureza_conta"]=="C" else -x["valor"]; nd=str(x.get("natureza_despesa") or ""); mod=nd[2:4]
        if mod=="91": continue
        tot+=v
        if mod in("90","93","94") and str(x["subfuncao"])!="364" and not (nd[:2]=="31" and nd[4:6] in("01","03","05")): num+=v
    d=dca(cod,ano)
    if abs(tot-d)>max(1.0,0.001*d): return None
    return num/censo_mat(cod,ano)
casos=[("sao-paulo",2024),("sao-paulo",2021),("porto-alegre",2021),("porto-alegre",2025),("campo-grande",2021),("campo-grande",2022),("boa-vista",2024),("palmas",2023),("recife",2025),("natal",2022),("natal",2025),("rio-de-janeiro",2024),("sao-luis",2022),("belem",2024)]
saida=[]
for cap,ano in casos:
    cod=BYID[cap]['cod_ibge']; d=dca(cod,ano); p=pop[(cod,ano)]; rz=razao(cod,ano)
    rec={('despesa','nominal'):d,('despesa','real'):d*fator[ano],('despesa_hab','nominal'):d/p,('despesa_hab','real'):d*fator[ano]/p,('despesa_mat','nominal'):rz,('despesa_mat','real'):None if rz is None else rz*fator[ano]}
    for (m,moeda),val in rec.items():
        nome=f"G|{cap}|{ano}|{m}|{moeda}"
        try: r=[r for r in json.load(open('oG.json')) if r['name']==nome][0]
        except IndexError: continue
        t=r['main']
        mm=re.search(r'registra (.+?)(?:; a mediana|, valor fora)',t) 
        # valor exibido nos cartões: usar a frase da capital; se "sem valor"
        if mm: exib=mm.group(1)
        elif 'não tem valor observado' in t or 'sem valor' in t.lower(): exib='sem valor'
        else: exib='?'
        esp=None if val is None else (fmt(m,val))
        # comparação em R$ inteiros
        if val is None: res='sem valor / sem valor' if exib=='sem valor' else 'DIVERGE'
        else: res='confere' if esp==exib else f'DIFERE ({esp} vs {exib})'
        saida.append((cap,ano,m,moeda,exib,'' if val is None else (f"{val:,.2f}"),res))
w=csv.writer(open('tabela_recalc.csv','w',newline='',encoding='utf-8')); w.writerow(['capital','ano','medida','valores','exibido_no_DOM','recalculado_independente','resultado']); w.writerows(saida)
import collections
print(collections.Counter(s[-1].split(' ')[0] for s in saida)); 
for s in saida: 
    if not s[-1].startswith('confere'): print(s)
