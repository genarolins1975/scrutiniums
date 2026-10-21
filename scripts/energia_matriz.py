"""Gera docs/observatorios/energia/MATRIZ_PAINEIS.md a partir do Anexo A da
especificação (IDs P001 a P071, pergunta, prioridade, fontes, critério de aceite) e
do estado registrado em docs/observatorios/energia/status_paineis.json.

O denominador é fixo (71 painéis): um painel dividido em partes continua contando
como um, e só é concluído quando todas as partes estão concluídas.

Uso: python3 scripts/energia_matriz.py
"""
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESPEC = os.path.join(RAIZ, "docs", "observatorios", "energia", "ESPECIFICACAO.md")
STATUS = os.path.join(RAIZ, "docs", "observatorios", "energia", "status_paineis.json")
SAIDA = os.path.join(RAIZ, "docs", "observatorios", "energia", "MATRIZ_PAINEIS.md")

ESTADOS = {
    "concluido": "Concluído",
    "concluido_com_limitacao": "Concluído com limitação declarada",
    "parcial": "Parcial",
    "bloqueado": "Bloqueado (externo, com evidência)",
    "pendente": "Pendente",
}


def paineis():
    texto = open(ESPEC, encoding="utf-8").read()
    anexo = texto.split("## Anexo A", 1)[1].split("## Anexo B", 1)[0]
    blocos = re.split(r"\n### (P\d{3}) — ", anexo)[1:]
    out = []
    for pid, corpo in zip(blocos[::2], blocos[1::2]):
        titulo = corpo.split("\n", 1)[0].strip()
        campo = lambda nome: (re.search(rf"\*\*{nome}:\*\* (.+)", corpo) or [None, ""])[1].strip()
        grupo, _, nome = titulo.partition(" / ")
        out.append({
            "id": pid, "grupo": grupo, "painel": nome,
            "prioridade": campo("Prioridade de execução").split(";")[0],
            "estado_historico": campo("Estado no diagnóstico histórico"),
            "pergunta": campo("Pergunta"), "visualizacao": campo("Visualização principal"),
            "fontes": campo("Fontes de partida").split(".")[0],
            "aceite": campo("Critério específico de aceite"),
        })
    return out


def main():
    ps = paineis()
    assert len(ps) == 71, len(ps)
    st = json.load(open(STATUS, encoding="utf-8")) if os.path.exists(STATUS) else {"paineis": {}}
    linhas = [
        "# Matriz de painéis e critérios de aceite",
        "",
        "Gerada por `scripts/energia_matriz.py` a partir do Anexo A da especificação e de `status_paineis.json`. "
        "Denominador fixo: 71 painéis (P001 a P071). Estado inicial = inventário do código em 30/09/2026 (commit d95d8f8b4).",
        "",
    ]
    contagem = {}
    for p in ps:
        e = st["paineis"].get(p["id"], {})
        contagem[e.get("estado", "pendente")] = contagem.get(e.get("estado", "pendente"), 0) + 1
    linhas.append("| Estado | Painéis |")
    linhas.append("| --- | ---: |")
    for k, rot in ESTADOS.items():
        linhas.append(f"| {rot} | {contagem.get(k, 0)} |")
    linhas.append(f"| **Total** | **{len(ps)}** |")
    linhas.append("")
    grupo = None
    for p in ps:
        if p["grupo"] != grupo:
            grupo = p["grupo"]
            linhas += ["", f"## {grupo}", "",
                       "| ID | Painel | Pergunta | Prioridade | Rota | Fontes integradas | Estado inicial | Estado | Critério de aceite | Evidência |",
                       "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
        e = st["paineis"].get(p["id"], {})
        cel = lambda v: str(v or "").replace("|", "\\|").replace("\n", " ")
        linhas.append("| " + " | ".join(cel(x) for x in [
            p["id"], p["painel"], p["pergunta"], p["prioridade"], e.get("rota", ""), e.get("fontes", p["fontes"]),
            e.get("inicial", p["estado_historico"]), ESTADOS.get(e.get("estado", "pendente")), p["aceite"], e.get("evidencia", ""),
        ]) + " |")
    open(SAIDA, "w", encoding="utf-8").write("\n".join(linhas) + "\n")
    print(f"{SAIDA}: {len(ps)} painéis; {contagem}")


if __name__ == "__main__":
    main()
