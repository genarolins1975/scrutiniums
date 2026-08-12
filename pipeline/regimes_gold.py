"""Regimes de resolução — gold regimes.json: o risco realizado, ao vivo.

Publica a lista VIGENTE de instituições sob regime do BCB (intervenção,
RAET, liquidação extrajudicial) e a memória acumulada pelo silver (um
regime que sai da lista vigente permanece na história como 'encerrado ou
saído da lista'). A camada histórica pré-coleta (casos como 1995-2015)
fica declarada como fronteira — entra por curadoria em rodada futura."""
from pipeline import common


def _dt_br(iso_or_br):
    """A fonte publica dd/mm/aaaa; normaliza para aaaa-mm-dd para ordenar."""
    s = str(iso_or_br or "")
    if "/" in s:
        p = s.split("/")
        if len(p) == 3:
            return f"{p[2]}-{p[1]}-{p[0]}"
    return s


def build(con, cfg=None):
    try:
        vig = con.execute("""SELECT cnpj, cnpj8, nome, tipo, inicio, responsavel, municipio, uf
                             FROM regimes_vigentes""").fetchall()
    except Exception:
        vig = []
    if not vig:
        common.write_gold("regimes.json", {
            "disponivel": False,
            "motivo": "coleta dos regimes de resolução ainda sem dados nesta execução"})
        return {"ok": False}
    vigentes = sorted(({
        "cnpj": r[0], "cnpj8": r[1], "nome": r[2], "tipo": r[3],
        "inicio": r[4], "inicio_iso": _dt_br(r[4]),
        "responsavel": r[5], "municipio": r[6], "uf": r[7],
    } for r in vig), key=lambda x: x["inicio_iso"], reverse=True)
    cnpjs_vig = {v["cnpj"] for v in vigentes}
    try:
        hist = con.execute("""SELECT cnpj, cnpj8, nome, tipo, inicio, primeiro_visto, ultimo_visto
                              FROM regimes_hist""").fetchall()
    except Exception:
        hist = []
    encerrados = sorted(({
        "cnpj": h[0], "cnpj8": h[1], "nome": h[2], "tipo": h[3], "inicio": h[4],
        "inicio_iso": _dt_br(h[4]), "saiu_da_lista_apos": (h[6] or "")[:10],
    } for h in hist if h[0] not in cnpjs_vig), key=lambda x: x["inicio_iso"], reverse=True)
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Sob regime de resolução do BCB",
        "vigentes": vigentes,
        "encerrados_ou_saidos": encerrados,
        "leitura": ("As instituições que o Banco Central colocou sob regime de resolução — intervenção, "
                    "RAET ou liquidação extrajudicial — na lista oficial vigente, atualizada diariamente. "
                    "É o risco realizado do sistema: o desfecho que os indicadores prudenciais tentam "
                    "antecipar. Um regime que sai da lista permanece no histórico acumulado pelo Observatório."),
        "cautelas": [
            "A lista vigente é dominada por instituições pequenas e de pagamento — regime de resolução em instituição pequena NÃO é sinal sistêmico.",
            "A fonte publica só o estado ATUAL: o histórico acumula daqui para frente, a partir da primeira coleta do Observatório; casos anteriores (as grandes resoluções de 1995-2015) entram por curadoria própria em rodada futura — fronteira declarada.",
            "Decretação de regime tem rito legal próprio (Lei 6.024/74, DL 2.321/85) — a listagem não substitui os atos oficiais publicados pelo BCB.",
        ],
        "fonte": {"nome": "BCB — Dados Abertos, serviço regimes_especiais (lista vigente, atualização diária)",
                  "url": "https://dadosabertos.bcb.gov.br/dataset/instituicoes-submetidas-a-regimes-de-resolucao",
                  "nivel": "A"},
    }
    common.write_gold("regimes.json", g)
    return {"ok": True, "vigentes": len(vigentes), "historico": len(encerrados)}
