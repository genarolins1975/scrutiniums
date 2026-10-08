"""Diagnóstico reproduzível dos pares capital × exercício cuja MSC de dezembro não fechava com a DCA (rodada 6).

Cada par recebe a mesma bateria de hipóteses, calculada só com as sementes versionadas (DCA, MSC e extrato de
entregas), sem rede. O diagnóstico não altera nenhum valor oficial, não aumenta tolerância e não ratea resíduo:
ele separa o que foi um defeito do próprio pipeline (corrigido), o que é conteúdo da MSC entregue ao Siconfi
(externo) e o que permanece em aberto.

Hipóteses examinadas (H):
  H1  sinal da natureza do valor: linhas "D" somadas como positivas (política 1.1) contra saldo líquido (1.2);
  H2  intraorçamentárias: a modalidade 91 explica a diferença?
  H3  a MSC traz linhas da função 12?
  H4  a MSC fica abaixo da DCA em todas as funções (entrega incompleta) ou só na Educação?
  H5  duplicidade: linhas idênticas repetidas na resposta da MSC;
  H6  seleção de contas: a conta 6.2.2.1.3.05 (empenhado a liquidar inscrito em RP não processados) explicaria?
  H7  retificação ou entrega ausente: o extrato de entregas traz a MSC de dezembro?
"""
import json
import os
import re

from pipeline.eficiencia import base
from pipeline.eficiencia import conferencia as CF
from pipeline.eficiencia import derivados as DV

CAUSAS = {
    "SINAL_CORRIGIDO": "Defeito do pipeline, corrigido: a política 1.1 somava em módulo as linhas D da MSC",
    "MSC_SEM_FUNCAO_12": "Externa: a MSC entregue ao Siconfi não traz a função 12 (a despesa vem em outra função ou sem função)",
    "MSC_ABAIXO_EM_TODAS_AS_FUNCOES": "Externa: a MSC entregue fica abaixo da DCA em todas as funções, não só na Educação",
    "PERIMETRO_INTRA": "Perímetro: a DCA inclui intraorçamentárias na função Educação (política 1.1 de conferência)",
    "EM_ABERTO": "Em aberto: a diferença não é explicada pelas hipóteses examinadas",
    "RECONCILIA": "Reconcilia",
}


def _msc_linhas(cod, ano):
    c = DV.caminho_msc(cod, ano)
    return base.le_json_gz(c) if os.path.exists(c) else None


def _soma(linhas, assinado):
    """(total sem intra, intra, valor débito) das linhas da função 12 nas contas de despesa liquidada."""
    sem_intra = intra = debito = 0.0
    n_debito = 0
    for x in linhas:
        if str(x.get("funcao")) != "12" or str(x.get("conta_contabil", ""))[:7] not in DV.MSC_CONTAS_LIQUIDADO:
            continue
        v = float(x["valor"])
        if assinado and x.get("natureza_conta") == "D":
            v = -v
        if x.get("natureza_conta") == "D":
            n_debito += 1
            debito += float(x["valor"])
        if str(x.get("natureza_despesa") or "")[2:4] == "91":
            intra += v
        else:
            sem_intra += v
    return round(sem_intra, 2), round(intra, 2), round(debito, 2), n_debito


def _situacao(dif, dca):
    if dif is None:
        return "SEM_DCA"
    if abs(dif) <= CF.TOL_ARREDONDAMENTO:
        return "CONFERE"
    if dca and abs(dif) <= CF.TOL_RELATIVA * dca:
        return "DIFERENCA_MENOR"
    return "NAO_RECONCILIA"


def _dca_por_funcao(cod, ano):
    caminho = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz")
    t = {}
    for r in base.le_json_gz(caminho):
        if r.get("cod_conta") == "TotalDespesas" and r.get("coluna") == "Despesas Liquidadas" and re.match(r"^\d\d - ", str(r.get("conta", ""))):
            t[r["conta"][:2]] = float(r["valor"])
    return t


def _duplicadas(linhas):
    vistos, dup = set(), 0
    for x in linhas:
        k = json.dumps(x, sort_keys=True, ensure_ascii=False)
        if k in vistos:
            dup += 1
        vistos.add(k)
    return dup


def _manifesto_msc(cod, ano):
    m = base.le_manifesto()["capturas"]
    arq = (m.get("siconfi_msc_funcao12") or {}).get("arquivos", {}).get(f"{cod}_{ano}", {})
    ent = (m.get("siconfi_msc_entregas") or {}).get("arquivos", {}).get(f"{cod}_{ano}")
    return arq, ent


def _entregas(cod, ano):
    c = os.path.join(base.SEED, "siconfi", "msc_entregas", f"{cod}_{ano}.json.gz")
    return base.le_json_gz(c) if os.path.exists(c) else None


def par(cod, ano, nome, dca):
    """Diagnóstico de um par. `dca`: despesa liquidada da função 12 na DCA, exceto intraorçamentárias."""
    linhas = _msc_linhas(cod, ano)
    arq, ent_m = _manifesto_msc(cod, ano)
    if linhas is None:
        return {"ente": cod, "nome": nome, "ano": ano, "dca": dca, "causa": "EM_ABERTO", "situacao_12": "SEM_MSC",
                "evidencia": "MSC não coletada para o par."}
    s_mod, intra_mod, debito, n_debito = _soma(linhas, False)
    s_liq, intra_liq, _, _ = _soma(linhas, True)
    dif_11 = round(s_mod - dca, 2)
    dif_12 = round(s_liq - dca, 2)
    sit_11, sit_12 = _situacao(dif_11, dca), _situacao(dif_12, dca)
    resumo = arq.get("resumo_resposta")
    funcs = (resumo or {}).get("linhas_por_funcao", {})
    liq_func = (resumo or {}).get("liquidado_liquido_sem_intra_por_funcao", {})
    dca_f = _dca_por_funcao(cod, ano)
    abaixo = [f for f, v in dca_f.items() if v > 0 and liq_func.get(f, 0.0) < v - 1.0] if resumo else None
    n_func = len([f for f, v in dca_f.items() if v > 0]) if resumo else None
    razao_func = {f: round(liq_func.get(f, 0.0) / v, 3) for f, v in dca_f.items() if v > 0} if resumo else None
    entregas = _entregas(cod, ano)
    dec = [e for e in (entregas or []) if e.get("entregavel") == "MSC Agregada" and e.get("periodo") in (12, "12")]
    sem_funcao_12 = len(linhas) == 0 or (resumo is not None and funcs.get("12", 0) == 0)

    # H6: a conta 6221305 explicaria? (apenas teste; não entra em nenhum valor)
    s305 = round(sum(CF.saldo_liquido(x) for x in linhas if str(x.get("funcao")) == "12" and str(x.get("conta_contabil", ""))[:7] == "6221305" and str(x.get("natureza_despesa") or "")[2:4] != "91"), 2)
    h6 = abs(round(s_liq + s305 - dca, 2)) <= CF.TOL_ARREDONDAMENTO

    if sit_12 in ("CONFERE", "DIFERENCA_MENOR") and sit_11 in ("CONFERE", "DIFERENCA_MENOR"):
        causa = "RECONCILIA"
    elif sit_12 in ("CONFERE", "DIFERENCA_MENOR"):
        causa = "SINAL_CORRIGIDO"
    elif sem_funcao_12:
        causa = "MSC_SEM_FUNCAO_12"
    elif intra_liq > 1.0 and abs(round(s_liq + intra_liq - dca, 2)) <= CF.TOL_ARREDONDAMENTO:
        causa = "PERIMETRO_INTRA"
    elif resumo and n_func and len(abaixo) == n_func:
        causa = "MSC_ABAIXO_EM_TODAS_AS_FUNCOES"
    else:
        causa = "EM_ABERTO"

    ev = []
    if n_debito:
        ev.append(f"H1: {n_debito} linhas D somam R$ {debito:,.2f}; em módulo a MSC difere da DCA em R$ {dif_11:,.2f}, pelo saldo líquido em R$ {dif_12:,.2f}")
    else:
        ev.append("H1: sem linhas D nas contas de despesa liquidada da função 12")
    ev.append(f"H2: intraorçamentárias (modalidade 91) somam R$ {intra_liq:,.2f}; " + ("explicam a diferença" if causa == "PERIMETRO_INTRA" else "não explicam a diferença com a DCA exceto intra"))
    ev.append("H3: " + ("a MSC não traz linhas da função 12" + (f" (linhas por função: {funcs})" if funcs else "") if sem_funcao_12 else f"{len(linhas)} linhas da função 12 nas contas de despesa liquidada"))
    if sit_12 in ("CONFERE", "DIFERENCA_MENOR"):
        ev.append("H4: não aplicável, a MSC reconcilia com a DCA")
    elif resumo:
        ev.append(f"H4: MSC abaixo da DCA em {len(abaixo)} de {n_func} funções" + (f"; razão MSC/DCA da função 12: {razao_func.get('12')}" if razao_func and "12" in razao_func else ""))
    else:
        ev.append("H4: resumo da resposta completa não coletado para este par")
    ev.append(f"H5: {_duplicadas(linhas)} linhas idênticas repetidas no recorte")
    ev.append(f"H6: somar a conta 6.2.2.1.3.05 (R$ {s305:,.2f}) " + ("fecharia a conta, mas é empenho a liquidar e não entra no liquidado" if h6 else "não fecha a conta"))
    if sit_12 in ("CONFERE", "DIFERENCA_MENOR"):
        h7 = "não aplicável, a MSC reconcilia com a DCA"
    elif dec:
        h7 = f"MSC Agregada de dezembro entregue em {dec[0]['data_status'][:10]} ({dec[0]['forma_envio']}); o extrato não informa retificação"
    elif entregas is None:
        h7 = "extrato de entregas não coletado para este par"
    else:
        h7 = "o extrato não traz a MSC de dezembro"
    ev.append("H7: " + h7)
    return {
        "ente": cod, "nome": nome, "ano": ano, "dca": dca,
        "msc_em_modulo_sem_intra": s_mod, "msc_liquida_sem_intra": s_liq, "intra_mod91": intra_liq,
        "diferenca_politica_1_1": dif_11, "situacao_politica_1_1": sit_11,
        "diferenca_politica_1_2": dif_12, "situacao_politica_1_2": sit_12,
        "diferenca_pct_dca": round(100 * dif_12 / dca, 4) if dca else None,
        "linhas_d": n_debito, "valor_d": debito, "linhas_msc": len(linhas),
        "msc_capturada_em": arq.get("capturado_em"), "msc_sha256_resposta": arq.get("sha256_resposta_completa"),
        "razao_msc_dca_por_funcao": razao_func, "linhas_por_funcao": funcs or None,
        "entrega_dezembro": dec[0]["data_status"][:10] if dec else None,
        "causa": causa, "causa_texto": CAUSAS[causa], "evidencia": ev,
    }


def todos(despesas):
    """Diagnóstico dos 130 pares. `despesas`: {(ente, ano): (nome, dca)}."""
    return [par(c, a, n, d) for (c, a), (n, d) in sorted(despesas.items())]


def abertos_da_politica_1_1(diag):
    """Os pares que a política 1.1 deixava sem reconciliação (28 em 08/10/2026)."""
    return [d for d in diag if d.get("situacao_politica_1_1") == "NAO_RECONCILIA"]


def _n(x):
    return f"{x:,}".replace(",", ".")


def _pct(x):
    return str(round(abs(x), 2)).replace(".", ",") + "%"


def nota_para_par(d, total_msc, diferenca_pct):
    """Texto público da razão sem valor, específico da causa encontrada (nunca "retificação municipal" sem evidência)."""
    ano = d["ano"]
    ent = d.get("entrega_dezembro")
    quando = f", entregue em {ent[8:]}/{ent[5:7]}/{ent[:4]}," if ent else ""
    if d["causa"] == "MSC_SEM_FUNCAO_12":
        funcs = d.get("linhas_por_funcao") or {}
        com_funcao = {f: n for f, n in funcs.items() if f != "sem_funcao"}
        if com_funcao:
            onde = "As linhas de despesa da resposta estão em: " + ", ".join(f"função {f} ({_n(n)} linhas)" for f, n in com_funcao.items())
            onde += f"; {_n(funcs['sem_funcao'])} linhas não trazem função." if funcs.get("sem_funcao") else "."
        else:
            onde = f"Nenhuma das {_n(funcs.get('sem_funcao', 0))} linhas da resposta traz código de função."
        return (f"A Matriz de Saldos Contábeis de dezembro de {ano}{quando} não traz linhas de despesa liquidada na função 12 (Educação). "
                f"{onde} A despesa de aplicação direta da Educação não pode ser separada. A DCA segue válida para a despesa total.")
    if d["causa"] == "MSC_ABAIXO_EM_TODAS_AS_FUNCOES":
        r = (d.get("razao_msc_dca_por_funcao") or {}).get("12")
        return (f"A MSC de dezembro de {ano}{quando} sem intraorçamentárias, soma {CF.brl(total_msc)} na função 12 e a DCA informa {CF.brl(d['dca'])}: "
                f"a MSC está {_pct(diferenca_pct)} abaixo da DCA. A MSC entregue fica abaixo da DCA em todas as funções, não só na Educação"
                + (f" (na função 12, {str(round(100 * r, 1)).replace('.', ',')}% da DCA)" if r is not None else "")
                + ": não é um problema de classificação da Educação. O numerador por matrícula não é publicado.")
    if d["causa"] == "PERIMETRO_INTRA":
        return None
    return (f"A MSC de dezembro de {ano}{quando} sem intraorçamentárias, soma {CF.brl(total_msc)} e a DCA informa {CF.brl(d['dca'])} "
            f"(a MSC está {_pct(diferenca_pct)} {'abaixo' if diferenca_pct < 0 else 'acima'} da DCA). As hipóteses examinadas (sinal D/C, intraorçamentárias, função, duplicidade, contas) "
            "não explicam a diferença; a causa permanece em aberto. O numerador por matrícula não é publicado.")
