"""Executa um único módulo temático (coleta + gold), para desenvolvimento e depuração.

Uso:
    python3 pipeline/energia/executar_modulo.py perdas              # coleta e gold
    python3 pipeline/energia/executar_modulo.py perdas --sem-coleta # só a gold
    python3 pipeline/energia/executar_modulo.py --listar

Escreve só a gold do módulo (e os CSV que o próprio módulo publicar) e reescreve
metricas.json e arquivos.json, que são derivados dos registros de todos os módulos.
A execução oficial continua sendo pipeline/energia/run.py.
"""
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas, modulos  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402


def main(argv):
    mods = {m.REGISTRO["id"]: m for m in modulos.descobrir()}
    if "--listar" in argv or not argv:
        for i, m in mods.items():
            print(i, m.REGISTRO["gold"], m.REGISTRO["familia"], m.REGISTRO["ordem"])
        return 0
    mid = argv[0]
    if mid not in mods:
        print(f"módulo desconhecido: {mid}; disponíveis: {sorted(mods)}")
        return 2
    mod = mods[mid]
    reg = mod.REGISTRO
    sem_coleta = "--sem-coleta" in argv
    t0 = time.time()
    con_p = base.conecta()
    golds = {}
    for nome in os.listdir(base.GOLD):
        if nome.endswith(".json"):
            golds[nome] = base.le_gold(nome)
    ctx = {"hoje": c.agora_date(), "golds": golds, "con_principal": con_p, "sem_rede": sem_coleta}
    con = base.conecta_familia(reg["familia"])
    if not sem_coleta and callable(getattr(mod, "coletar", None)):
        status = mod.coletar(con, ctx)
        con.commit()
        print("[coleta]", json.dumps(status, ensure_ascii=False, default=str)[:4000])
    try:
        g = mod.construir(con, ctx)
    except Exception as e:
        traceback.print_exc()
        g = c.stub(reg["gold"], f"falha na construção: {e}")
    anterior = base.le_gold(reg["gold"])
    if not (isinstance(g, dict) and g.get("disponivel") is True) and isinstance(anterior, dict) and anterior.get("disponivel") is True:
        print(f"[sentinela] {reg['gold']} regrediu: {g.get('motivo')}; a publicação anterior foi mantida")
    else:
        base.escreve_gold(reg["gold"], g)
    base.escreve_gold("metricas.json", {**c.cabecalho("metricas.json"), "metricas": metricas.todas()})
    arquivos = {}
    for m in mods.values():
        for url, desc in (m.REGISTRO.get("arquivos") or {}).items():
            arquivos[url] = {"colunas": desc, "modulo": m.REGISTRO["id"], "gold": m.REGISTRO["gold"]}
    base.escreve_gold("arquivos.json", {**c.cabecalho("arquivos.json"), "arquivos": arquivos})
    con.close()
    con_p.close()
    tam = os.path.getsize(os.path.join(base.GOLD, reg["gold"])) if os.path.exists(os.path.join(base.GOLD, reg["gold"])) else 0
    print(f"[{mid}] gold {reg['gold']} disponivel={g.get('disponivel')} {tam/1024:.0f} KB em {time.time()-t0:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
