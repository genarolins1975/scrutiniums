"""Pilar 3 (KM1) — gold pilar3.json: liquidez e capital regulatórios por IF.

Métricas-RAZÃO padronizadas pelo BCB (Res. BCB 54/2020), coletadas do arranjo
federado DASFN (registro central no BCB + endpoint de dados da própria
instituição). Ao contrário dos conceitos gerenciais (guidance, TI), os índices
KM1 seguem fórmula REGULATÓRIA única — a comparação entre bancos é legítima,
mas o painel lista sem ranking: o requerimento de LCR/NSFR só alcança S1/S2,
então ausência não é descumprimento (declarado nas cautelas).

O join com as fichas usa o conglomerado prudencial: o registrante do DASFN é
uma instituição (cnpj8); `cod_inst` publicado é o do conglomerado dela no
cadastro atual (ou o próprio cnpj8 quando independente)."""
from pipeline import common

METRICAS = {
    "icp_pct": {"nome": "Índice de Capital Principal", "minimo": 4.5},
    "nivel1_pct": {"nome": "Índice de Nível 1", "minimo": 6.0},
    "basileia_pct": {"nome": "Índice de Basileia", "minimo": 8.0},
    "acp_total_pct": {"nome": "Adicional de Capital Principal (ACP) requerido", "minimo": None},
    "margem_capital_principal_pct": {"nome": "Margem excedente de Capital Principal", "minimo": None},
    "alavancagem_pct": {"nome": "Razão de Alavancagem", "minimo": 3.0},
    "lcr_pct": {"nome": "LCR — liquidez de curto prazo", "minimo": 100.0},
    "nsfr_pct": {"nome": "NSFR — liquidez estrutural", "minimo": 100.0},
}


def build(con, cfg=None):
    try:
        rows = con.execute("""SELECT cnpj8, nome, periodo, metric, value_pct
                              FROM pilar3_km1 ORDER BY cnpj8, periodo""").fetchall()
    except Exception:
        rows = []
    if not rows:
        g = {"disponivel": False,
             "motivo": "coleta do Pilar 3 (DASFN) ainda sem valores absorvidos nesta execução"}
        common.write_gold("pilar3.json", g)
        return {"ok": False}
    congl = {r[0]: r[1] for r in con.execute(
        "SELECT cod_inst, cod_congl_prud FROM institutions WHERE cod_congl_prud IS NOT NULL")}
    por = {}
    for cnpj8, nome, periodo, metric, v in rows:
        d = por.setdefault(cnpj8, {"cnpj8": cnpj8, "nome": nome,
                                   "cod_inst": congl.get(cnpj8) or cnpj8,
                                   "series": {}, "ultimo": {}, "periodo_ultimo": ""})
        d["series"].setdefault(metric, []).append({"p": periodo, "v": v})
        if periodo >= d["periodo_ultimo"]:
            d["periodo_ultimo"] = periodo
    for d in por.values():
        for metric, serie in d["series"].items():
            serie.sort(key=lambda x: x["p"])
            d["ultimo"][metric] = serie[-1]["v"] if serie[-1]["p"] == d["periodo_ultimo"] else None
    insts = sorted(por.values(), key=lambda d: (d["nome"] or "").upper())
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Liquidez e capital — Pilar 3 (KM1)",
        "metricas": METRICAS,
        "instituicoes": insts,
        "cobertura": {
            "com_dados": len(insts),
            "ausencias_notaveis": [
                "Bradesco não registra o Pilar 3 no arranjo DASFN do BCB (verificado em 08/2026) — os relatórios existem em PDF no RI; extração fica para rodada futura.",
                "Caixa registra endpoints mas parou de atualizá-los em 2022 — ausência declarada.",
            ],
        },
        "leitura": ("As métricas-chave prudenciais (KM1) que cada instituição publica no padrão do BCB: "
                    "quanto capital regulamentar carrega sobre o risco (ICP, Nível 1, Basileia), o colchão "
                    "requerido e a margem sobre ele, a alavancagem e os dois índices de liquidez — LCR "
                    "(30 dias de estresse) e NSFR (estrutural). Mínimos regulatórios anotados por métrica."),
        "cautelas": [
            "Índices KM1 seguem fórmula regulatória única — comparáveis entre bancos; ainda assim o painel lista sem ranking.",
            "O requerimento de divulgação de LCR/NSFR alcança os segmentos maiores (S1/S2): instituição sem o índice não está 'descumprindo' — pode simplesmente não ser obrigada. Ausência não é zero.",
            "Fonte federada: cada banco serve o próprio endpoint e as escalas divergem (fração × por cento) — normalização por régua de plausibilidade declarada no coletor; valor fora de régua é omitido, nunca publicado.",
            "Cobertura é a do arranjo DASFN — quem não registra (Bradesco) ou não atualiza (Caixa) aparece nas ausências, nunca silenciosamente.",
        ],
        "fonte": {"nome": "BCB — Dados Abertos do SFN (DASFN), api pilar3/KM1; dados servidos pela própria instituição no padrão da Res. BCB 54/2020",
                  "url": "https://dadosabertos.bcb.gov.br/dataset/pilar3", "nivel": "A"},
    }
    common.write_gold("pilar3.json", g)
    return {"ok": True, "instituicoes": len(insts)}
