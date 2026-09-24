"""Registro público de erros (docs/CONSTITUICAO.md, art. 10): validação e resumo.

Uso: python3 -m pesquisa.registro   (valida o registro e imprime o resumo)
"""
import json
import os
import re
import sys
from datetime import date

ARQUIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registro_erros.json")
GRAVIDADES = {"factual", "relevante"}
CANAIS = {"teste", "vigilia", "sentinela_gold", "auditoria", "avaliacao", "editor", "validador", "leitor"}
TIPOS = {"numero", "rotulo", "atribuicao", "data", "texto", "ficcao", "sinal", "unidade", "fonte"}
OBRIGATORIOS = ("id", "superficie", "descricao", "tipo", "gravidade", "publicado", "data_publicacao",
                "data_deteccao", "canal_deteccao", "correcao", "fonte_registro", "tipo_nota")


def carregar(path=ARQUIVO):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _data_ok(v):
    if v is None:
        return True
    try:
        date.fromisoformat(v)
        return True
    except (TypeError, ValueError):
        return False


def validar(reg):
    """Lista de problemas do registro (vazia = válido)."""
    prob, ids = [], set()
    for e in reg.get("erros", []):
        eid = e.get("id", "?")
        for c in OBRIGATORIOS:
            if c not in e:
                prob.append(f"{eid}: campo {c} ausente")
        if not re.fullmatch(r"E\d{3}", eid):
            prob.append(f"{eid}: id fora do padrão E000")
        if eid in ids:
            prob.append(f"{eid}: id repetido")
        ids.add(eid)
        if e.get("gravidade") not in GRAVIDADES:
            prob.append(f"{eid}: gravidade inválida")
        if e.get("canal_deteccao") not in CANAIS:
            prob.append(f"{eid}: canal inválido")
        if e.get("tipo") not in TIPOS:
            prob.append(f"{eid}: tipo inválido")
        for c in ("data_publicacao", "data_deteccao"):
            if not _data_ok(e.get(c)):
                prob.append(f"{eid}: {c} não é data ISO")
        if not _data_ok((e.get("correcao") or {}).get("data")):
            prob.append(f"{eid}: data de correção não é data ISO")
        if e.get("data_deteccao") is None:
            prob.append(f"{eid}: sem data de detecção")
        if e.get("data_publicacao") and e.get("data_deteccao") and e["data_publicacao"] > e["data_deteccao"]:
            prob.append(f"{eid}: detectado antes de publicado")
    return prob


def resumo(reg, tipo_nota=None):
    """Contagens por gravidade e canal; latência de detecção só onde as duas datas existem."""
    es = [e for e in reg.get("erros", []) if tipo_nota is None or e.get("tipo_nota") == tipo_nota]
    lat = [(date.fromisoformat(e["data_deteccao"]) - date.fromisoformat(e["data_publicacao"])).days
           for e in es if e.get("data_publicacao") and e.get("data_deteccao")]
    por = lambda campo: {k: sum(1 for e in es if e.get(campo) == k) for k in sorted({e.get(campo) for e in es})}
    return {"n": len(es), "publicados": sum(1 for e in es if e.get("publicado")),
            "por_gravidade": por("gravidade"), "por_canal": por("canal_deteccao"),
            "sem_correcao_datada": sum(1 for e in es if not (e.get("correcao") or {}).get("data")),
            "latencia_deteccao_dias": {"n_com_datas": len(lat), "valores": sorted(lat)}}


def erro_relevante_publicado(reg, tipo_nota):
    """True se o tipo de nota tem erro relevante publicado (rebaixa ao degrau 1, art. 9.4)."""
    return any(e.get("tipo_nota") == tipo_nota and e.get("gravidade") == "relevante" and e.get("publicado")
               for e in reg.get("erros", []))


def main():
    reg = carregar()
    prob = validar(reg)
    for p in prob:
        print("PROBLEMA", p)
    print(json.dumps(resumo(reg), ensure_ascii=False, indent=1))
    return 1 if prob else 0


if __name__ == "__main__":
    sys.exit(main())
