"""Recordes automáticos nas séries macro — gold recordes.json.

Varre as séries do silver e detecta, para a observação MAIS RECENTE de cada
uma: máximo/mínimo de toda a série histórica ou 'maior/menor desde <mês>'.

Regras editoriais (declaradas no gold e testadas):
- Só séries de RAZÃO (%, p.p., meses, índice): séries nominais em R$ crescem
  com a inflação e fariam 'recorde histórico' todo mês — excluídas.
- Um 'desde' só é recorde se a janela for de pelo menos MIN_MESES (24):
  bater o vizinho de três meses atrás não é notícia.
- Recorde é posição aritmética na própria série — nunca juízo de mérito:
  menor inadimplência é boa notícia; menor spread para o banco talvez não.
  O painel não converte em nota.
- Séries do SGS são revisáveis: um recorde pode desaparecer com revisão da
  fonte — o gold é recalculado do zero a cada execução, sem memória.
"""
from datetime import date

from pipeline import common

MIN_MESES = 24
UNIDADES_ELEGIVEIS = ("%", "p.p.", "meses")  # índices de nível (IVG-R, IBC-Br) são trending como R$: recorde trivial, fora


def _meses_entre(ref_a, ref_b):
    """Meses entre duas refs ISO (aaaa-mm[-dd])."""
    a = date.fromisoformat(str(ref_a)[:10] if len(str(ref_a)) >= 10 else f"{ref_a}-01")
    b = date.fromisoformat(str(ref_b)[:10] if len(str(ref_b)) >= 10 else f"{ref_b}-01")
    return (b.year - a.year) * 12 + (b.month - a.month)


def _recorde_da_serie(s):
    """(tipo, desde_ref, meses) para a última observação, ou None."""
    if len(s) < MIN_MESES + 1:
        return None
    ref_u, v_u = s[-1]
    anteriores = s[:-1]
    # maior desde quando? (última ref anterior com valor >= atual)
    maiores = [r for r, v in anteriores if v >= v_u]
    menores = [r for r, v in anteriores if v <= v_u]
    out = []
    if not maiores:
        out.append(("maximo_historico", anteriores[0][0], _meses_entre(anteriores[0][0], ref_u)))
    else:
        gap = _meses_entre(maiores[-1], ref_u)
        if gap >= MIN_MESES:
            out.append(("maior_desde", maiores[-1], gap))
    if not menores:
        out.append(("minimo_historico", anteriores[0][0], _meses_entre(anteriores[0][0], ref_u)))
    else:
        gap = _meses_entre(menores[-1], ref_u)
        if gap >= MIN_MESES:
            out.append(("menor_desde", menores[-1], gap))
    if not out:
        return None
    return max(out, key=lambda x: x[2])  # o lado mais extremo vence


def build(con, cfg=None):
    metas = con.execute("SELECT key, name, unit FROM series_meta").fetchall()
    recordes = []
    elegiveis = 0
    for key, nome, unit in metas:
        u = str(unit or "")
        if not any(tag in u for tag in UNIDADES_ELEGIVEIS) or "R$" in u:
            continue
        s = common.get_series(con, key)
        if not s:
            continue
        elegiveis += 1
        r = _recorde_da_serie(s)
        if not r:
            continue
        tipo, desde, meses = r
        recordes.append({
            "serie": key, "nome": nome, "unidade": unit,
            "tipo": tipo, "valor": round(s[-1][1], 3), "ref": s[-1][0],
            "desde": desde, "meses": meses, "anos": round(meses / 12, 1),
            "rotulo": {
                "maximo_historico": f"máximo de toda a série (desde {str(desde)[:7]})",
                "minimo_historico": f"mínimo de toda a série (desde {str(desde)[:7]})",
                "maior_desde": f"maior desde {str(desde)[:7]}",
                "menor_desde": f"menor desde {str(desde)[:7]}",
            }[tipo],
        })
    recordes.sort(key=lambda x: -x["meses"])
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Recordes nas séries",
        "recordes": recordes,
        "series_elegiveis": elegiveis,
        "janela_minima_meses": MIN_MESES,
        "metodo": (f"Para a observação mais recente de cada série elegível: máximo/mínimo de toda a série "
                   f"histórica, ou 'maior/menor desde <mês>' quando a janela é de pelo menos {MIN_MESES} meses. "
                   f"Só séries de razão (%, p.p., meses) — séries nominais em R$ e índices de nível (IVG-R, IBC-Br) "
                   f"crescem com o tempo e fariam recorde trivial todo mês, então ficam fora. Recalculado do zero a cada execução."),
        "cautelas": [
            "Recorde é posição aritmética na própria série, nunca juízo de mérito: menor inadimplência é boa notícia; menor spread, depende de quem olha. O painel não converte em nota.",
            "As séries do SGS são revisáveis pela fonte: um recorde pode desaparecer com revisão — nada aqui é memorizado, tudo é recalculado.",
            "A janela mínima de 24 meses existe para separar recorde de ruído — bater o vizinho de três meses atrás não é notícia.",
        ],
        "fonte": {"nome": "Séries oficiais já integradas (BCB/SGS, IBGE); detecção do Observatório", "nivel": "A"},
    }
    common.write_gold("recordes.json", g)
    return {"ok": True, "recordes": len(recordes), "elegiveis": elegiveis}
