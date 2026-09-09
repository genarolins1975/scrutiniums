"""Lacunas de entrega no IF.data, compartilhadas pelos painéis que leem `institution_metrics`.

A fonte publica a linha de quem consta da relação do trimestre e não entregou o balanço
com saldo nulo (atraso, RAET, retardatário). O coletor descarta saldo nulo, então uma
instituição pode faltar num trimestre e voltar no seguinte. Duas regras valem para
todos os painéis (auditoria de 09/09/2026, a partir do painel "Quem entra e quem sai"):

1. ausência num trimestre não é saída nem zero: quem consta da lista sem balanço é
   declarado como tal (`sem_balanco`), com a última entrega e o ativo dela;
2. "variação no trimestre" só existe entre trimestres VIZINHOS: se o anterior faltou,
   a variação é nula (declarada), nunca a diferença contra dois trimestres atrás.
"""


def tri_anterior(am):
    """AAAAMM do fim de trimestre anterior (202603 -> 202512)."""
    a, m = int(am[:4]), int(am[4:6])
    m -= 3
    if m <= 0:
        a, m = a - 1, m + 12
    return f"{a}{m:02d}"


def tri_menos(am, n):
    for _ in range(n):
        am = tri_anterior(am)
    return am


def adjacentes(am_anterior, am):
    """True se `am_anterior` é exatamente o trimestre anterior a `am`."""
    return bool(am_anterior) and bool(am) and tri_anterior(am) == am_anterior


def variacao_tri(vals, relativa=False, casas=2):
    """Variação entre os dois últimos pontos de `vals` ([(anomes, v), ...] em ordem) só
    quando são trimestres vizinhos; None (ausência declarada) quando há lacuna."""
    if len(vals) < 2 or not adjacentes(vals[-2][0], vals[-1][0]):
        return None
    a, b = vals[-2][1], vals[-1][1]
    if a is None or b is None:
        return None
    if relativa:
        return round((b / a - 1) * 100, casas) if a else None
    return round(b - a, casas)


def valor_ha_n_trimestres(vals, n):
    """Valor exatamente `n` trimestres antes do último ponto, ou None se aquele trimestre faltou."""
    if not vals:
        return None
    alvo = tri_menos(vals[-1][0], n)
    for a, v in vals:
        if a == alvo:
            return v
    return None


def ultima_entrega(con, ate=None):
    """cod_inst -> último trimestre com Ativo Total entregue (até `ate`, inclusive)."""
    try:
        if ate:
            rows = con.execute("SELECT cod_inst, MAX(anomes) FROM institution_metrics WHERE metric='ativo_total' AND anomes<=? GROUP BY cod_inst", (ate,))
        else:
            rows = con.execute("SELECT cod_inst, MAX(anomes) FROM institution_metrics WHERE metric='ativo_total' GROUP BY cod_inst")
        return {c: a for c, a in rows.fetchall()}
    except Exception:
        return {}


def sem_balanco(con, anomes):
    """Quem consta da lista do Resumo em `anomes` sem balanço entregue, com a última
    entrega e o ativo dela, do maior para o menor. None quando `ifdata_universo`
    ainda não cobre `anomes` (tabela criada em 09/2026; o backfill preenche)."""
    try:
        if not con.execute("SELECT 1 FROM ifdata_universo WHERE anomes=? LIMIT 1", (anomes,)).fetchone():
            return None
        rows = con.execute("SELECT cod_inst, nome, tcb, uf, sr, situacao FROM ifdata_universo WHERE anomes=? AND entregou=0", (anomes,)).fetchall()
    except Exception:
        return None
    ult = ultima_entrega(con, ate=anomes)
    out = []
    for cod, nome, tcb, uf, sr, sit in rows:
        ue = ult.get(cod)
        ativo = None
        if ue:
            r = con.execute("SELECT value FROM institution_metrics WHERE cod_inst=? AND anomes=? AND metric='ativo_total'", (cod, ue)).fetchone()
            ativo = r[0] if r else None
        out.append({"cod_inst": cod, "nome": nome or cod, "tcb": tcb, "uf": uf, "sr": sr, "situacao": sit,
                    "ultima_entrega": ue, "ativo_ultima_entrega": ativo, "nunca_entregou": ue is None})
    return sorted(out, key=lambda x: -(x["ativo_ultima_entrega"] or 0))


NOTA_SEM_BALANCO = ("Instituição que consta da lista do IF.data na data-base sem balanço entregue (saldo nulo na fonte: "
                    "atraso, RAET, retardatário) fica fora do corte até entregar; não é saída nem zero. A lista nominal "
                    "está em `sem_balanco_na_data_base`.")
