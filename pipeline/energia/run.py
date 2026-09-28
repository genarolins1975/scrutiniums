"""Orquestrador do domínio Energia.

Uso:
    python3 pipeline/energia/run.py              # coleta (ONS, CCEE, catálogo) + gold
    python3 pipeline/energia/run.py --sem-coleta # só reconstrói a gold do silver atual
    python3 pipeline/energia/run.py --sem-ccee-direta  # não tenta o portal da CCEE

Sentinela embutida: se um builder falhar e a publicação anterior estiver íntegra,
a anterior é mantida no ar e a regressão vai para meta.json e para o stdout
(o workflow abre issue). Falha nunca vira número.
"""
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, catalogo  # noqa: E402
from pipeline.energia.fontes import ccee, ons  # noqa: E402
from pipeline.energia.gold import carga, cmo, geracao, hidrologia, modelos, pld, rede, sintese  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402


def _integro(g):
    return isinstance(g, dict) and g.get("disponivel") is True


def publicar(nome, novo, regressoes, falhas):
    anterior = base.le_gold(nome)
    if not _integro(novo) and _integro(anterior):
        regressoes.append({"gold": nome, "motivo": (novo or {}).get("motivo")})
        return anterior
    base.escreve_gold(nome, novo)
    if not _integro(novo):
        falhas.append({"gold": nome, "motivo": (novo or {}).get("motivo")})
    return novo


def construir(nome, fn, *args):
    try:
        return fn(*args)
    except Exception as e:  # stub com o motivo; traceback no log
        traceback.print_exc()
        return c.stub(nome, f"falha na construção: {e}")


def main(argv):
    sem_coleta = "--sem-coleta" in argv
    tentar_ccee = "--sem-ccee-direta" not in argv
    t0 = time.time()
    con = base.conecta()
    status_coleta = {}
    ccee_seed = ccee.importa_seed(con)  # o seed entra sempre (idempotente, conferido por sha256)
    status_coleta["ccee_seed"] = ccee_seed
    brutos_catalogo = None
    if not sem_coleta:
        print("[energia] coletando ONS…", flush=True)
        status_coleta["ons"] = ons.coleta(con)
        print("[energia] tentando CCEE direta…", flush=True)
        status_coleta["ccee_direta"] = ccee.coleta_direta(con) if tentar_ccee else {"ok": False, "erro": "desativada"}
        print("[energia] colhendo catálogo…", flush=True)
        brutos_catalogo = catalogo.colhe()
    con.commit()

    regressoes, falhas = [], []
    g = {}
    for nome, fn in (("pld.json", pld.construir), ("hidrologia.json", hidrologia.construir),
                     ("carga.json", carga.construir), ("geracao.json", geracao.construir),
                     ("rede.json", rede.construir), ("cmo.json", cmo.construir)):
        print(f"[energia] gold {nome}", flush=True)
        g[nome] = publicar(nome, construir(nome, fn, con), regressoes, falhas)
    g["sintese.json"] = publicar("sintese.json",
                                 construir("sintese.json", sintese.construir, g["hidrologia.json"], g["carga.json"],
                                           g["geracao.json"], g["pld.json"], g["cmo.json"]), regressoes, falhas)
    # previsões e modelos: violação de governança derruba a publicação (a anterior fica)
    anterior = (base.le_gold("previsoes.json") or {}).get("arquivo")
    try:
        prev, mods = modelos.construir(anterior)
        base.escreve_gold("previsoes.json", prev)
        base.escreve_gold("modelos.json", mods)
    except Exception as e:
        traceback.print_exc()
        regressoes.append({"gold": "previsoes.json", "motivo": f"governança: {e}"[:300]})
    # catálogo: sem rede, reaproveita o bruto em cache local
    if brutos_catalogo is None:
        pasta = os.path.join(base.DADOS, "meta")
        brutos_catalogo = {o: base.le_gold(f"_ckan_{o}.json", destino=pasta) or {"resultado": []} for o in catalogo.PORTAIS}
    if any(b.get("resultado") for b in brutos_catalogo.values()) or not base.le_gold("catalogo.json"):
        base.escreve_gold("catalogo.json", catalogo.construir(brutos_catalogo))

    fontes = {}
    for ds in list(ons.DATASETS) + [ccee.DATASET]:
        snap = c.snapshot_de(con, ds)
        fontes[ds] = {"ultima_captura": c.ultima_captura(snap), "snapshot": snap.get("id"),
                      "snapshot_sha256": snap.get("sha256"), "ultima_tentativa": base.ultima_coleta(con, ds),
                      "capturas": snap.get("capturas", [])}
    meta = {
        **c.cabecalho("meta.json"),
        "golds": {k: {"disponivel": _integro(v), "gerado_em": (v or {}).get("gerado_em")} for k, v in g.items()},
        "fontes": fontes,
        "regressoes": regressoes,
        "builders_falhos": falhas,
        "duracao_s": round(time.time() - t0, 1),
        "coleta_executada": not sem_coleta,
    }
    base.escreve_gold("meta.json", meta)
    con.close()
    if regressoes:
        print("REGRESSOES_ENERGIA=" + json.dumps(regressoes, ensure_ascii=False))
    print(f"[energia] concluído em {meta['duracao_s']} s; falhas: {len(falhas)}; regressões: {len(regressoes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
