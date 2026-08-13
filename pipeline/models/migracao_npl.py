"""Estimativa da inadimplência >90d por PRODUTO × IF (modelo de migração 15→90).

O IF.data público não cruza NPL >90d com modalidade: por produto e IF existe o
atraso ≥15d (rel. 123/128); o >90d só existe (a) TOTAL por instituição
(Res. 4.966) e (b) por produto no AGREGADO do sistema (SCR.data). Este módulo
combina as duas margens observadas num modelo de calibração com passo
econométrico — e publica cada peça da conta:

    est(i,p) = phi_i * beta * m_p * atraso15(i,p)

- m_p  — perfil RELATIVO de migração do produto no sistema: razão
  inadimplência arrastada / atraso 15-90 do produto no SCR, normalizada pela
  média ponderada (media = 1). Conceitos do SCR diferem dos do IF.data
  (arrastada × parcela; banda exclusiva × >=15d): por isso o SCR entra apenas
  como PERFIL entre produtos, nunca como nível. Produto sem par no SCR recebe
  perfil neutro (1,0) — sinalizado.
- beta — MQO cross-section PELA ORIGEM entre as IFs da data-base corrente:
  NPL90_i = beta * X_i, com X_i = média ponderada por carteira de
  m_p * atraso15(i,p) nos produtos cobertos. R² (não centrado), EP e n
  publicados; a razão de não haver intercepto está em _ols_origem.
- phi_i — fator da instituição: NPL90_i observado / ajustado da regressão,
  winsorizado em [0,25; 4] (contado). Faz a média ponderada das estimativas
  da IF RECONCILIAR com o >90d total OBSERVADO dela (exata onde o phi não foi winsorizado).
- sem teto no atraso — decisão empírica documentada: o "vencido >=15d" dos
  rel. 123/128 comporta-se como BANDA CURTA (ex.: consignado do BB 0,45% ~
  banda 15-90 do SCR 0,42%), logo o >90d NÃO é subconjunto dele e a
  estimativa pode legitimamente excedê-lo — é a migração acumulada no
  estoque, não uma fração do atraso corrente. Piso 0 e teto de sanidade 100.
- cobertura — a soma do % da carteira da IF nos produtos cobertos viaja na
  decomposição; abaixo de 25%, a linha é sinalizada como baixa cobertura.

O que o modelo NÃO é: não é observação (selo ESTIMADO obrigatório), não capta
mix intra-produto da IF, garantias, renegociações nem baixas; a hipótese
central — dentro da IF, a migração relativa entre produtos segue a do
sistema — é declarada na tela junto do resultado.
"""

# produto (slug do IF.data) -> lista de pares (cliente, produto) do SCR cujo
# perfil de migração representa o produto; cartão combina as duas variantes
# ponderadas por saldo. Mapeamento por código de produto, NUNCA por heurística.
MAPA_SCR = {
    "cartao-de-credito-pf": [("PF", "Cartão — parcelado/financiado"), ("PF", "Cartão — rotativo")],
    "consignado-pf": [("PF", "Consignado")],
    "credito-pessoal-pf": [("PF", "Crédito pessoal")],
    "veiculos-pf": [("PF", "Veículos")],
    "capital-de-giro-pj": [("PJ", "Capital de giro")],
    "recebiveis-pj": [("PJ", "Recebíveis descontados")],
    "comercio-exterior-pj": [("PJ", "Comércio exterior")],
}

PHI_MIN, PHI_MAX = 0.25, 4.0


def _perfis_migracao(scr_pares):
    """m_p bruto por slug a partir dos agregados SCR {(cliente, produto): (inad, v1590, saldo)}."""
    brutos = {}
    for slug, pares in MAPA_SCR.items():
        num = den = 0.0
        for chave in pares:
            reg = scr_pares.get(chave)
            if not reg:
                continue
            inad, v1590, saldo = reg
            if inad is None or not v1590 or not saldo:
                continue
            num += inad / 100.0 * saldo
            den += v1590 / 100.0 * saldo
        if den > 0:
            brutos[slug] = num / den
    return brutos


def _ols_origem(xs, ys):
    """MQO PELA ORIGEM: NPL90 = beta·X. Sem intercepto de propósito — um
    intercepto de nível (≈2,8 p.p. na primeira estimação) dominava os produtos
    de atraso baixo e jogava 87% das estimativas no teto: o teto virava a
    estimativa. Num modelo de MIGRAÇÃO, atraso composto zero implica >90d
    estimado zero; o R² reportado é o não centrado (declarado)."""
    n = len(xs)
    sxx = sum(x * x for x in xs)
    if sxx <= 1e-12:
        return None
    beta = sum(x * y for x, y in zip(xs, ys)) / sxx
    ss_res = sum((y - beta * x) ** 2 for x, y in zip(xs, ys))
    ss_tot = sum(y * y for y in ys)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    ep_beta = (ss_res / max(n - 1, 1) / sxx) ** 0.5
    return {"beta": beta, "r2_nao_centrado": r2, "ep_beta": ep_beta, "n": n}


def estimar(produtos, scr_pares):
    """Anexa a estimativa às linhas das matrizes de `produtos` (lista de dicts
    com slug e matriz) e devolve o bloco de metodologia publicável.

    Cada linha da matriz precisa de: cod, carteira_brl, atraso15_pct,
    npl_inst_pct. A linha ganha npl_prod_est (dict) quando estimável.
    """
    brutos = _perfis_migracao(scr_pares)

    # normalização do perfil: média ponderada pela carteira dos produtos = 1
    pesos = {}
    for p in produtos:
        if p["slug"] in brutos:
            pesos[p["slug"]] = sum(r.get("carteira_brl") or 0 for r in p.get("matriz") or [])
    soma_p = sum(pesos.values())
    media_m = (sum(brutos[s] * pesos[s] for s in pesos) / soma_p) if soma_p else None
    m_norm = {s: brutos[s] / media_m for s in brutos} if media_m else {}

    # composto por IF sobre os produtos cobertos
    por_if = {}
    for p in produtos:
        m = m_norm.get(p["slug"], 1.0)
        for r in p.get("matriz") or []:
            if r.get("atraso15_pct") is None or r.get("npl_inst_pct") is None:
                continue
            w = r.get("carteira_brl") or 0
            if w <= 0:
                continue
            acc = por_if.setdefault(r["cod"], {"num": 0.0, "den": 0.0, "npl": r["npl_inst_pct"]})
            acc["num"] += w * m * r["atraso15_pct"]
            acc["den"] += w

    amostra = [(cod, a["num"] / a["den"], a["npl"]) for cod, a in por_if.items() if a["den"] > 0]
    if len(amostra) < 30 or not m_norm:
        return {"disponivel": False,
                "motivo": ("agregados do SCR indisponíveis nesta execução" if not m_norm
                           else f"amostra insuficiente ({len(amostra)} IFs)")}

    reg = _ols_origem([x for _, x, _ in amostra], [y for _, _, y in amostra])
    if not reg or reg["beta"] <= 0:
        return {"disponivel": False, "motivo": "regressão degenerada (beta não positivo)"}

    phi, winsorizados = {}, 0
    for cod, x, npl in amostra:
        ajustado = reg["beta"] * x
        f = npl / ajustado if ajustado > 0.1 else PHI_MAX
        f2 = min(max(f, PHI_MIN), PHI_MAX)
        if f2 != f:
            winsorizados += 1
        phi[cod] = f2

    # cobertura por IF: soma do % da carteira nos produtos cobertos pelo modelo
    cobertura = {}
    for p in produtos:
        for r in p.get("matriz") or []:
            if r.get("cod") in phi and r.get("pct_carteira_inst") is not None:
                cobertura[r["cod"]] = cobertura.get(r["cod"], 0.0) + r["pct_carteira_inst"]

    estimadas = baixa_cob = 0
    for p in produtos:
        m = m_norm.get(p["slug"])
        for r in p.get("matriz") or []:
            f = phi.get(r.get("cod"))
            if f is None or r.get("atraso15_pct") is None:
                continue
            bruta = f * reg["beta"] * (m or 1.0) * r["atraso15_pct"]
            est = min(max(bruta, 0.0), 100.0)
            cob = cobertura.get(r["cod"])
            baixa = cob is not None and cob < 25
            estimadas += 1
            baixa_cob += 1 if baixa else 0
            r["npl_prod_est"] = {
                "pct": round(est, 2),
                "m_produto": round(m, 2) if m is not None else None,
                "phi_if": round(f, 2),
                "cobertura_if_pct": round(cob, 1) if cob is not None else None,
                "baixa_cobertura": baixa,
                "perfil_neutro": m is None,
                # teto de sanidade mordeu: caso patológico (atrasos extremos de
                # micro-IF) — quebra a reconciliação da IF, por isso é marcado
                "teto_sanidade": bruta > 100.0,
            }

    return {
        "disponivel": True,
        "modelo": "est(i,p) = phi_i × beta × m_p × atraso15(i,p) — piso 0, teto de sanidade 100",
        "sem_intercepto": ("MQO pela origem, de propósito: um intercepto de nível dominava os produtos de "
                           "atraso baixo e o teto virava a estimativa. Migração: atraso zero ⇒ estimado zero."),
        "beta": round(reg["beta"], 3),
        "r2_nao_centrado": round(reg["r2_nao_centrado"], 3), "ep_beta": round(reg["ep_beta"], 4), "n_ifs": reg["n"],
        "m_produtos": {s: round(v, 2) for s, v in sorted(m_norm.items())},
        "phi_winsorizados": winsorizados, "phi_limites": [PHI_MIN, PHI_MAX],
        "estimativas": estimadas, "estimativas_baixa_cobertura": baixa_cob,
        "estimativas_teto_sanidade": sum(1 for p2 in produtos for r2 in p2.get("matriz") or []
                                         if (r2.get("npl_prod_est") or {}).get("teto_sanidade")),
        "reconciliacao": ("a média ponderada por carteira das estimativas de cada IF reproduz o >90d TOTAL "
                          "observado da instituição — exata, exceto onde o phi foi winsorizado (contado)"),
        "conceito_atraso": ("o \"vencido >=15d\" dos rel. 123/128 comporta-se empiricamente como banda curta "
                            "(consignado do BB: 0,45% vs banda 15-90 do SCR 0,42%) — por isso a estimativa de "
                            ">90d PODE exceder o atraso do produto: é a migração acumulada no estoque, não uma "
                            "fração do atraso corrente."),
        "hipoteses": ("(1) dentro da IF, a migração relativa entre produtos segue o perfil do sistema (SCR); "
                      "(2) o perfil do SCR (arrastada ÷ banda 15-90) vale como razão ENTRE produtos, nunca como nível; "
                      "(3) produtos sem par no SCR recebem perfil neutro 1,0, sinalizado por linha."),
        "nao_e": ("Não é observação: o IF.data público não divulga >90d por modalidade — este número é uma "
                  "ESTIMATIVA calibrada em dois observados (o >90d total da IF e o atraso >=15d do produto). "
                  "Não capta mix de clientes intra-produto, garantias, renegociações nem baixas para prejuízo."),
    }
