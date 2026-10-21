"""Gera docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md a partir da gold publicada.

    python3 -m pipeline.eficiencia_saude.documenta

O documento é derivado: as fórmulas, fontes, períodos, coberturas e a matriz de fontes vêm do catálogo e da gold, para que o texto
não se afaste do que o módulo publica. Reexecute depois de cada reconstrução da gold.
"""
import json
import os

from pipeline.eficiencia_saude import base

SAIDA = os.path.join(base.RAIZ, "docs", "obee", "saude", "CATALOGO_COBERTURA_FORMULAS.md")


def _gold():
    with open(os.path.join(base.RAIZ, "public", "eficiencia", "gold", "saude_capitais.json"), encoding="utf-8") as f:
        return json.load(f)


def _cel(t):
    return str(t if t is not None else "").replace("|", "/").replace("\n", " ").strip()


def _cobertura(linhas):
    if not linhas:
        return "sem observações"
    partes = []
    for l in linhas:
        rot = f"{l['ano']}" + (f" {l['etapa']}" if l.get("etapa") else "")
        partes.append(f"{rot}: {l['comparaveis']}/{l['elegiveis']}")
    return "; ".join(partes)


def _fora(linhas):
    nomes = {}
    for l in linhas or []:
        for x in l.get("fora_da_comparacao", []):
            nomes.setdefault(x["nome"], []).append(l["ano"])
        for x in l.get("sem_valor", []):
            nomes.setdefault(x["nome"] + " (sem valor)", []).append(l["ano"])
    return "; ".join(f"{n} {', '.join(map(str, a))}" for n, a in sorted(nomes.items())) or "nenhuma"


def _nome_fonte(fonte, id_):
    """Instituição e conjunto da primeira captura; na falta, o identificador."""
    c = (fonte or {}).get("capturas") or []
    if not c:
        return id_
    inst, conj = c[0].get("instituicao"), c[0].get("conjunto") or c[0].get("nome")
    return f"{inst}, {conj}" if inst and conj else (inst or conj or id_)


def gera():
    g = _gold()
    m = g["meta"]
    s = [
        "# Catálogo, cobertura e fórmulas: Saúde nas capitais",
        "",
        f"Gerado de `public/eficiencia/gold/saude_capitais.json` (hash_dados `{m['hash_dados'][:16]}`, catálogo {m['versao_catalogo']}, pipeline {m['versao_pipeline']}, "
        f"dados capturados até {m['dados_capturados_ate'][:10]}). Reexecute `python3 -m pipeline.eficiencia_saude.documenta` depois de reconstruir a gold.",
        "",
        "Cobertura: capitais comparáveis sobre capitais do universo, por ano (`comparáveis/elegíveis`). Fora da comparação significa valor oficial disponível, mas excluído das medianas e variações, ou sem valor, conforme indicado.",
        "",
        "## Indicadores publicados",
        "",
        "| Indicador | Fórmula | Unidade | Fonte | Período | Cobertura (comparáveis/elegíveis) | Fora da comparação |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    fontes = {f["id"]: f for f in g["fontes"]}
    for f in g["indicadores"]:
        if f["estado"] == "NAO_PUBLICAVEL":
            continue
        cob = g["cobertura"].get(f["id"], [])
        fontes_txt = ", ".join(_nome_fonte(fontes.get(i), i) for i in f["fontes"])
        s.append(f"| `{f['id']}` {_cel(f['nome_curto'])} | {_cel(f['formula'])} | {_cel(f['unidade'])} | {_cel(fontes_txt)} | {_cel(f['periodo'])} | {_cel(_cobertura(cob))} | {_cel(_fora(cob))} |")
    s += ["", "## Indicadores avaliados e não publicados", "", "| Indicador | Motivo |", "| --- | --- |"]
    for f in g["indicadores"]:
        if f["estado"] == "NAO_PUBLICAVEL":
            motivo = f.get("motivo_nao_publicacao") or []
            s.append(f"| `{f['id']}` {_cel(f['nome_curto'])} | {_cel(' '.join(motivo) if isinstance(motivo, list) else motivo)} |")
    s += ["", "## Matriz de fontes e decisões", "", "| Id | Medida | Fonte | Acesso testado | Cobertura | Período | Decisão | Fundamento |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for l in g["matriz_fontes"]:
        s.append("| " + " | ".join(_cel(l[k]) for k in ("id", "medida", "fonte", "acesso_testado", "cobertura", "periodo", "decisao", "fundamento")) + " |")
    s += ["", "## Comparabilidade e o que cada medida não é", "", "| Indicador | O que não mede | Comparação |", "| --- | --- | --- |"]
    for f in g["indicadores"]:
        if f["estado"] == "NAO_PUBLICAVEL":
            continue
        nao = f.get("o_que_nao_mede")
        nao = " ".join(nao) if isinstance(nao, list) else nao
        s.append(f"| `{f['id']}` | {_cel(nao)} | {_cel(f.get('comparacao'))} |")
    s.append("")
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as fh:
        fh.write("\n".join(s))
    return SAIDA


if __name__ == "__main__":
    print(gera())
