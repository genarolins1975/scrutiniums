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

from pipeline.energia import base, catalogo, metricas, modulos, validacoes  # noqa: E402
from pipeline.energia.fontes import ccee, ons  # noqa: E402
from pipeline.energia.gold import carga, cmo, geracao, hidrologia, modelos, pld, rede  # noqa: E402
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
    capturas = {ds: c.ultima_captura(c.snapshot_de(con, ds)) for ds in list(ons.DATASETS) + [ccee.DATASET]}

    def construir_validado(nome, fn):
        novo = construir(nome, fn, con)
        erros = validacoes.viola_horizonte(nome, novo, capturas)
        return c.stub(nome, "; ".join(erros)) if erros else novo

    for nome, fn in (("pld.json", pld.construir), ("hidrologia.json", hidrologia.construir),
                     ("carga.json", carga.construir), ("geracao.json", geracao.construir),
                     ("rede.json", rede.construir), ("cmo.json", cmo.construir)):
        print(f"[energia] gold {nome}", flush=True)
        g[nome] = publicar(nome, construir_validado(nome, fn), regressoes, falhas)
    # sintese.json (Visão geral) é construída pelo módulo visao (pipeline/energia/modulos/visao.py,
    # ordem 98), depois de todos os módulos temáticos cujas golds ela lê
    # previsões e modelos: violação de governança derruba a publicação (a anterior fica)
    anterior = (base.le_gold("previsoes.json") or {}).get("arquivo")
    try:
        prev, mods = modelos.construir(anterior)
        base.escreve_gold("previsoes.json", prev)
        base.escreve_gold("modelos.json", mods)
    except Exception as e:
        traceback.print_exc()
        regressoes.append({"gold": "previsoes.json", "motivo": f"governança: {e}"[:300]})
    # módulos temáticos (pipeline/energia/modulos): coleta própria por família de fontes e
    # uma gold cada, com a mesma sentinela de regressão das golds de operação
    status_modulos = {}
    fontes_modulos = {}
    ctx = {"hoje": c.hoje_brasilia(), "golds": g, "con_principal": con, "sem_rede": sem_coleta}
    for mod in modulos.descobrir():
        reg = mod.REGISTRO
        nome = reg["gold"]
        con_f = base.conecta_familia(reg["familia"])
        try:
            if not sem_coleta and callable(getattr(mod, "coletar", None)):
                print(f"[energia] coletando módulo {reg['id']}…", flush=True)
                try:
                    status_modulos[reg["id"]] = mod.coletar(con_f, ctx)
                except Exception as e:  # coletor não pode derrubar os demais módulos
                    traceback.print_exc()
                    status_modulos[reg["id"]] = {"ok": False, "erro": str(e)[:300]}
                con_f.commit()
            print(f"[energia] gold {nome}", flush=True)
            g[nome] = publicar(nome, construir(nome, mod.construir, con_f, ctx), regressoes, falhas)
            for d in reg["datasets"]:
                ds = d.get("dataset_silver")
                if not ds:
                    continue
                snap = c.snapshot_de(con_f, ds)
                fontes_modulos[ds] = {"modulo": reg["id"], "familia": reg["familia"],
                                      "ultima_captura": c.ultima_captura(snap), "snapshot": snap.get("id"),
                                      "snapshot_sha256": snap.get("sha256"), "ultima_tentativa": base.ultima_coleta(con_f, ds),
                                      "capturas": snap.get("capturas", []),
                                      "recapturas_sem_mudanca": (snap.get("revisoes") or {}).get("recapturas_sem_mudanca")}
        finally:
            con_f.close()
    status_coleta["modulos"] = status_modulos
    # dicionário dos arquivos baixáveis dos módulos (REGISTRO["arquivos"]: url → colunas)
    arquivos = {}
    for mod in modulos.descobrir():
        for url, desc in (mod.REGISTRO.get("arquivos") or {}).items():
            arquivos[url] = {"colunas": desc, "modulo": mod.REGISTRO["id"], "gold": mod.REGISTRO["gold"]}
    base.escreve_gold("arquivos.json", {**c.cabecalho("arquivos.json"), "arquivos": arquivos})
    # catálogo único de métricas: a definição publicada é a mesma que o pipeline usa
    try:
        base.escreve_gold("metricas.json", {**c.cabecalho("metricas.json"), "metricas": metricas.todas()})
    except Exception as e:
        traceback.print_exc()
        regressoes.append({"gold": "metricas.json", "motivo": f"catálogo de métricas inválido: {e}"[:300]})
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
                      "capturas": snap.get("capturas", []), "historico": snap.get("historico", []),
                      "recapturas_sem_mudanca": (snap.get("revisoes") or {}).get("recapturas_sem_mudanca")}
    fontes.update(fontes_modulos)
    meta = {
        **c.cabecalho("meta.json"),
        "golds": {k: {"disponivel": _integro(v), "gerado_em": (v or {}).get("gerado_em")} for k, v in g.items()},
        "fontes": fontes,
        "regressoes": regressoes,
        "builders_falhos": falhas,
        "duracao_s": round(time.time() - t0, 1),
        "coleta_executada": not sem_coleta,
        "status_coleta_modulos": status_modulos,
    }
    base.escreve_gold("meta.json", meta)
    con.close()
    if regressoes:
        print("REGRESSOES_ENERGIA=" + json.dumps(regressoes, ensure_ascii=False))
    print(f"[energia] concluído em {meta['duracao_s']} s; falhas: {len(falhas)}; regressões: {len(regressoes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
