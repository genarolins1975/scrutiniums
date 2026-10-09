"""Padronização: do seed às observações tipadas do módulo Saúde.

Uma observação segue o contrato de `pipeline.eficiencia.padroniza` (indicador, ente, ano, componente, valor, status, nota,
nota_material, elegivel_comparacao, fonte, registro), com as dimensões próprias da Saúde quando a fonte as traz (competência,
gestão, esfera administrativa, natureza jurídica, residência ou local).

Nenhuma ausência vira zero. Zero só aparece quando a própria fonte informa zero.
"""
import os
import re

from pipeline.eficiencia import entes, padroniza as PE
from pipeline.eficiencia import derivados as DV
from pipeline.eficiencia_saude import base, conferencia as CF

ANOS_FINANCEIROS = list(range(2021, 2026))

_obs = PE._obs
fatores_ipca = PE.fatores_ipca


def _linhas_dca(cod, ano):
    caminho = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz")
    if not os.path.exists(caminho):
        return None
    return base.le_json_gz(caminho)


def despesa():
    """Despesa liquidada na função 10 (Saúde), exceto intraorçamentárias, nominal e em reais de 2025, e composição por
    subfunção. Fonte: DCA, Anexo I-E, conferida com o RREO do 6º bimestre e, se preciso, com a MSC."""
    fatores, _ = fatores_ipca()
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            linhas = _linhas_dca(cod, ano)
            reg = f"DCA {ano}, Anexo I-E, conta \"10 - Saúde\", coluna \"Despesas Liquidadas\""
            if linhas is None:
                obs.append(_obs("sau.despesa.funcao_saude", cod, ano, None, "AUSENTE_NA_COLETA", "siconfi_dca_anexo_i_e", reg,
                                componente="nominal", nota="Resposta do Siconfi não encontrada no seed"))
                continue
            liq = [x for x in linhas if x["coluna"] == "Despesas Liquidadas"]
            e = [x["valor"] for x in liq if x["conta"] == "10 - Saúde"]
            if not e:
                obs.append(_obs("sau.despesa.funcao_saude", cod, ano, None, "AUSENTE_NA_COLETA", "siconfi_dca_anexo_i_e", reg,
                                componente="nominal", nota="DCA sem a linha da função Saúde"))
                continue
            v = round(float(e[0]), 2)
            conf = CF.conferencia(cod, ano, v)
            eleg = conf["elegivel_comparacao"]
            material = conf["situacao"] in ("RECONCILIADA_MSC", "PENDENTE", "PERIMETRO_INTRA_MSC", "NAO_CONFERIDO")
            nota = None if conf["situacao"] == "CONFERE" else conf["explicacao"]
            comuns = dict(conferencia=conf, elegivel_comparacao=eleg, nota_material=material)
            obs.append(_obs("sau.despesa.funcao_saude", cod, ano, v, "OBSERVADO", "siconfi_dca_anexo_i_e", reg,
                            componente="nominal", nota=nota, **comuns))
            obs.append(_obs("sau.despesa.funcao_saude", cod, ano, round(v * fatores[ano], 2), "OBSERVADO", "siconfi_dca_anexo_i_e",
                            reg + "; corrigido pelo IPCA (média anual) para reais de 2025", componente="real_2025", nota=nota,
                            fator_ipca=fatores[ano], **comuns))
            nota_sub = None
            if material:
                nota_sub = ("Participação calculada sobre o total da função Saúde deste exercício, que tem ressalva: " + conf["explicacao"])
            subs = []
            for x in liq:
                m = re.match(r"^10\.(\d{3}) - ", x["conta"])
                if m:
                    subs.append((m.group(1), float(x["valor"]), x["conta"]))
                elif x["conta"].startswith("FU10 "):
                    subs.append(("FU10", float(x["valor"]), x["conta"]))
            soma = sum(s_[1] for s_ in subs)
            reconcilia = abs(soma - v) <= 1.0
            for codigo, valor, conta in sorted(subs, key=lambda s_: s_[0]):
                registro = f"DCA {ano}, Anexo I-E, conta \"{conta}\", coluna \"Despesas Liquidadas\""
                if reconcilia:
                    obs.append(_obs("sau.despesa.subfuncao", cod, ano, round(valor, 2), "OBSERVADO", "siconfi_dca_anexo_i_e", registro,
                                    componente=codigo, nota=nota_sub, elegivel_comparacao=eleg, nota_material=material,
                                    participacao=round(100 * valor / v, 4) if v else None))
                else:
                    obs.append(_obs("sau.despesa.subfuncao", cod, ano, None, "INCONSISTENTE", "siconfi_dca_anexo_i_e", registro,
                                    componente=codigo, nota_material=True,
                                    nota=f"Soma das subfunções ({CF.brl(soma)}) difere do total da função ({CF.brl(v)})"))
    return obs


def populacao():
    """População residente das capitais (IBGE), a mesma de Educação: denominador da despesa por habitante."""
    return PE.populacao()


def _conf_resumo(conf):
    return {k: conf.get(k) for k in ("versao_politica", "situacao", "rotulo", "elegivel_comparacao", "quebra_serie",
                                      "motivo_inelegibilidade", "explicacao")}


def despesa_por_habitante(despesa_obs, pop_obs):
    """Despesa liquidada na função Saúde ÷ população residente do mesmo exercício (nominal e real de 2025).

    Despesa do orçamento do município por habitante do território. Não é custo por usuário do SUS: a população
    do denominador inclui quem usa saúde suplementar e quem reside fora da rede municipal de referência."""
    pop = {(o["ente"], o["ano"]): o for o in pop_obs}
    obs = []
    for d in despesa_obs:
        if d["indicador"] != "sau.despesa.funcao_saude":
            continue
        p = pop[(d["ente"], d["ano"])]
        reg = (f"Despesa: DCA {d['ano']}, Anexo I-E, função 10, liquidada{'; em reais de 2025' if d['componente'] == 'real_2025' else ''}. "
               f"População: {p['registro']}")
        fonte = "ibge_populacao+siconfi_dca_anexo_i_e"
        if d["status"] != "OBSERVADO" or p["status"] != "OBSERVADO" or d["valor"] is None or p["valor"] is None:
            st, nota = (p["status"], p["nota"]) if p["status"] != "OBSERVADO" else (d["status"], d["nota"] or "Despesa sem valor observado")
            obs.append(_obs("sau.despesa.por_habitante", d["ente"], d["ano"], None, st, fonte, reg, componente=d["componente"],
                            nota=nota, nota_material=True))
            continue
        v = DV.razao(d["valor"], p["valor"])
        if v is None:
            obs.append(_obs("sau.despesa.por_habitante", d["ente"], d["ano"], None, "INCONSISTENTE", fonte, reg,
                            componente=d["componente"], nota_material=True,
                            nota="Denominador nulo ou numerador negativo: a razão não é calculada."))
            continue
        notas = [x for x in (d.get("nota"), p.get("nota")) if x]
        eleg = bool(d["elegivel_comparacao"] and p["elegivel_comparacao"])
        extra = dict(conferencia=_conf_resumo(d["conferencia"]), quebra_serie=bool(p.get("quebra_serie")),
                     calculo={"numerador": d["valor"], "numerador_ref": "sau.despesa.funcao_saude", "numerador_componente": d["componente"],
                              "denominador": p["valor"], "denominador_ref": "ctx.populacao.residente"})
        obs.append(_obs("sau.despesa.por_habitante", d["ente"], d["ano"], round(v, 6), "OBSERVADO", fonte, reg,
                        componente=d["componente"], nota=" ".join(notas) or None, elegivel_comparacao=eleg,
                        nota_material=bool(d.get("nota_material") or p.get("nota_material")), **extra))
    return obs


def despesa_natureza(despesa_obs):
    """Composição da despesa liquidada na função Saúde por categoria de natureza (pessoal, outras correntes e capital).

    A MSC de dezembro (função 10, contas de despesa liquidada, sem a modalidade 91) é aberta por natureza da despesa. A
    abertura só é publicada quando as três categorias, somadas, reproduzem a DCA (R$ 1,00 de tolerância): categoria completa
    e mutuamente exclusiva. Onde a MSC não reproduz a DCA, o par fica INCONSISTENTE com a diferença registrada, e nenhuma
    categoria é publicada ou rateada."""
    from pipeline.eficiencia_saude import derivados as DV2
    dca = {(o["ente"], o["ano"]): o for o in despesa_obs if o["indicador"] == "sau.despesa.funcao_saude" and o["componente"] == "nominal"}
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            d = dca[(cod, ano)]
            caminho = os.path.join(base.SEED, "siconfi", "msc_funcao10", f"{cod}_{ano}_12.json.gz")
            reg = f"MSC de dezembro de {ano}, função 10, contas 6.2.2.1.3.03, .04 e .07 (saldo líquido D e C), sem a modalidade 91; natureza da despesa"
            if d["status"] != "OBSERVADO" or not os.path.exists(caminho):
                obs.append(_obs("sau.despesa.natureza", cod, ano, None, "AUSENTE_NA_COLETA", "siconfi_msc_funcao10", reg, componente=None,
                                nota="DCA da função 10 ou MSC de dezembro indisponível no seed.", nota_material=True))
                continue
            soma, desconhecidos, intra = DV2.liquido_por_categoria(base.le_json_gz(caminho))
            total = round(sum(soma.values()), 2)
            if desconhecidos or not DV2.reconcilia(soma, d["valor"]):
                motivo = (f"A MSC aberta por natureza ({CF.brl(total)}, sem modalidade 91) não reproduz a DCA ({CF.brl(d['valor'])}); "
                          f"diferença de {CF.brl(round(total - d['valor'], 2))}. "
                          + (f"Linhas sem natureza identificável na MSC: {', '.join(desconhecidos)}. " if desconhecidos else "")
                          + "A abertura por natureza não é publicada para este exercício e nenhuma categoria é estimada.")
                for cat, rotulo, _ in DV2.CATEGORIAS:
                    obs.append(_obs("sau.despesa.natureza", cod, ano, None, "INCONSISTENTE", "siconfi_msc_funcao10", reg, componente=cat,
                                    nota=motivo, nota_material=True))
                continue
            nota = None if d["elegivel_comparacao"] else d.get("nota")
            for cat, rotulo, _ in DV2.CATEGORIAS:
                v = soma[cat]
                obs.append(_obs("sau.despesa.natureza", cod, ano, v, "OBSERVADO", "siconfi_msc_funcao10", reg, componente=cat,
                                nota=nota, elegivel_comparacao=d["elegivel_comparacao"], nota_material=bool(d.get("nota_material")),
                                participacao=round(100 * v / total, 4) if total else None))
    return obs


# ------------------------------------------------------------------ SIOPS: Anexo 12 do RREO (ASPS) e despesa por fonte

MINIMO_LC141_PCT = 15.0
"""Mínimo constitucional dos municípios: 15% da receita de impostos e transferências constitucionais e legais (art. 198 da
Constituição, LC 141/2012, art. 7º). Algumas leis orgânicas fixam percentual maior; o SIOPS informa o mínimo em reais."""

FONTES_RECURSO = [
    ("recursos_ordinarios", "Recursos ordinários (fonte livre)", "vl_coluna1"),
    ("impostos_saude", "Receitas de impostos e transferências de impostos da saúde", "vl_coluna2"),
    ("sus_uniao", "Transferências fundo a fundo do SUS, Governo Federal", "vl_coluna3"),
    ("sus_estado", "Transferências fundo a fundo do SUS, Governo Estadual", "vl_coluna4"),
    ("convenios", "Transferências de convênios destinadas à saúde", "vl_coluna5"),
    ("operacoes_credito", "Operações de crédito vinculadas à saúde", "vl_coluna6"),
    ("lc173_uniao", "Transferências da União, inciso I do art. 5º da LC 173/2020", "vl_coluna7"),
    ("royalties", "Royalties do petróleo destinados à saúde", "vl_coluna8"),
    ("outros", "Outros recursos destinados à saúde", "vl_coluna9"),
]


def _seed_siops(pasta, cod, ano):
    caminho = os.path.join(base.SEED, "siops", pasta, f"{cod}_{ano}.json.gz")
    return base.le_json_gz(caminho) if os.path.exists(caminho) else None


def _valor_siops(v):
    """Valor numérico do SIOPS; sentinelas negativas (−1 e −2, "não se aplica") não são valores."""
    if v is None:
        return None
    v = float(v)
    return None if v < 0 else v


def _item(linhas, padrao):
    achadas = [l for l in linhas if re.search(padrao, l.get("dsItem") or "", re.I)]
    return achadas[0] if len(achadas) == 1 else None


def asps():
    """Indicadores de ASPS (Anexo 12 do RREO, SIOPS), 6º bimestre: percentual aplicado, valor aplicado, base de cálculo e mínimo.

    Valores informados pelo município e homologados no SIOPS; o OBEE confere a aritmética do demonstrativo (XVI = XII − XIII −
    XIV − XV; percentual = XVI ÷ III) e não refaz o conteúdo do que é ASPS. Colunas do Anexo 12 no 6º bimestre: nas linhas de
    receita, a 3ª coluna é a realizada até o bimestre; nas de apuração (XII a XVI), a 1ª coluna é a despesa empenhada (a que
    determina o percentual oficial no último bimestre, nota 1 do demonstrativo), a 2ª a liquidada e a 3ª a paga."""
    fatores, _ = fatores_ipca()
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            linhas = _seed_siops("rreo_anexo_12", cod, ano)
            fonte = "siops_rreo_anexo_12"
            reg = f"SIOPS, RREO Anexo 12, {ano}, 6º bimestre"

            def sem(ind, componente, nota):
                obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", fonte, reg, componente=componente, nota=nota, nota_material=True))

            if linhas is None:
                for ind, comp in (("sau.asps.percentual_aplicado", None), ("sau.asps.valor_aplicado", "nominal"), ("sau.asps.valor_aplicado", "real_2025"),
                                  ("sau.asps.base_receita", "nominal"), ("sau.asps.base_receita", "real_2025")):
                    sem(ind, comp, "Resposta do SIOPS não encontrada no seed")
                continue
            iii = _item(linhas, r"\(III\)\s*=\s*\(I\)\s*\+\s*\(II\)")
            xvi = _item(linhas, r"\(XVI\)\s*=\s*\(XII")
            pct = _item(linhas, r"^PERCENTUAL DA RECEITA")
            minimo = _item(linhas, r"\(XVII\)\s*=\s*\(III\)\s*x\s*15%")
            minimo_lo = _item(linhas, r"\(XVII\)\s*=\s*\(III\)\s*x\s*%")
            if not (iii and xvi and pct):
                for ind, comp in (("sau.asps.percentual_aplicado", None), ("sau.asps.valor_aplicado", "nominal"), ("sau.asps.valor_aplicado", "real_2025"),
                                  ("sau.asps.base_receita", "nominal"), ("sau.asps.base_receita", "real_2025")):
                    obs.append(_obs(ind, cod, ano, None, "INCONSISTENTE", fonte, reg, componente=comp, nota_material=True,
                                    nota="O demonstrativo não traz uma linha única para a receita base (III), o valor aplicado (XVI) ou o percentual."))
                continue
            base_rec = _valor_siops(iii.get("vl_coluna3"))
            aplicado = _valor_siops(xvi.get("vl_coluna1"))
            percentual = _valor_siops(pct.get("vl_coluna1"))
            minimo_rs = _valor_siops(minimo.get("vl_coluna3")) if minimo else None
            minimo_lo_rs = _valor_siops(minimo_lo.get("vl_coluna3")) if minimo_lo else None
            nota_conf = None
            if None in (base_rec, aplicado, percentual) or not base_rec:
                nota_conf = "Valor ausente ou sentinela no demonstrativo."
            else:
                recalc = aplicado / base_rec * 100
                if abs(recalc - percentual) > 0.011:
                    nota_conf = f"O percentual informado ({percentual:.2f}%) difere do recalculado XVI ÷ III ({recalc:.4f}%)."
            if nota_conf:
                for ind, comp in (("sau.asps.percentual_aplicado", None), ("sau.asps.valor_aplicado", "nominal"), ("sau.asps.valor_aplicado", "real_2025"),
                                  ("sau.asps.base_receita", "nominal"), ("sau.asps.base_receita", "real_2025")):
                    obs.append(_obs(ind, cod, ano, None, "INCONSISTENTE", fonte, reg, componente=comp, nota=nota_conf, nota_material=True))
                continue
            minimo_pct = None
            nota_minimo = None
            if minimo_lo_rs is not None and minimo_lo_rs > 0:
                minimo_pct = round(minimo_lo_rs / base_rec * 100, 4)
                nota_minimo = (f"A lei orgânica do município fixa mínimo superior ao da LC 141/2012: o demonstrativo informa mínimo de "
                               f"{CF.brl(minimo_lo_rs)}, {minimo_pct:.2f}% da base.".replace(".", ","))
            elif minimo_rs is not None:
                minimo_pct = round(minimo_rs / base_rec * 100, 4)
            nota_homolog = ("Valor informado pelo município e homologado no SIOPS; o OBEE confere a aritmética do demonstrativo e não refaz o "
                            "conteúdo do que é despesa com ações e serviços públicos de saúde (ASPS).")
            comum = dict(nota_material=True)
            obs.append(_obs("sau.asps.percentual_aplicado", cod, ano, percentual, "OBSERVADO", fonte,
                            reg + ", linha PERCENTUAL ... (XVI / III), coluna da despesa empenhada", nota=" ".join(filter(None, [nota_homolog, nota_minimo])),
                            elegivel_comparacao=True, minimo_pct=minimo_pct,
                            calculo={"numerador": aplicado, "denominador": base_rec, "numerador_ref": "sau.asps.valor_aplicado", "denominador_ref": "sau.asps.base_receita"},
                            **comum))
            for comp, v in (("nominal", aplicado), ("real_2025", round(aplicado * fatores[ano], 2))):
                obs.append(_obs("sau.asps.valor_aplicado", cod, ano, v if comp == "nominal" else v, "OBSERVADO", fonte,
                                reg + ", linha (=) VALOR APLICADO EM ASPS (XVI), coluna da despesa empenhada" + ("; corrigido pelo IPCA para reais de 2025" if comp == "real_2025" else ""),
                                componente=comp, nota=nota_homolog, elegivel_comparacao=True, nota_material=True, fator_ipca=fatores[ano] if comp == "real_2025" else None))
            for comp, v in (("nominal", base_rec), ("real_2025", round(base_rec * fatores[ano], 2))):
                obs.append(_obs("sau.asps.base_receita", cod, ano, v, "OBSERVADO", fonte,
                                reg + ", linha TOTAL DAS RECEITAS RESULTANTES DE IMPOSTOS E TRANSFERÊNCIAS CONSTITUCIONAIS E LEGAIS (III), receita realizada até o bimestre"
                                + ("; corrigido pelo IPCA para reais de 2025" if comp == "real_2025" else ""),
                                componente=comp, nota="Receita realizada de impostos e transferências constitucionais e legais, base de cálculo do mínimo (LC 141/2012, art. 7º).",
                                elegivel_comparacao=True, nota_material=False, fator_ipca=fatores[ano] if comp == "real_2025" else None))
    return obs


def despesa_por_fonte():
    """Despesa total em Saúde (estágio empenhado) por fonte de recursos, segundo o SIOPS (despesas por subfunção, grupo Total).

    Perímetro declarado pelo município no SIOPS, diferente do da DCA (não se somam nem se igualam), e estágio empenhado. As nove
    fontes são completas e exclusivas: a soma precisa reproduzir o total informado (R$ 1,00 de tolerância)."""
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            linhas = _seed_siops("despesas_por_fonte", cod, ano)
            fonte = "siops_despesas_por_fonte"
            reg = f"SIOPS, despesa total em saúde por fonte e subfunção, {ano}, 6º bimestre, linha Total, estágio empenhado"
            total = [l for l in (linhas or []) if str(l.get("grupo")) == "17"]
            if linhas is None or len(total) != 1:
                obs.append(_obs("sau.despesa.por_fonte", cod, ano, None, "AUSENTE_NA_COLETA", fonte, reg, nota="Linha Total não encontrada na resposta do SIOPS.", nota_material=True))
                continue
            t = total[0]
            vs = {c: float(t.get(col) or 0) for c, _, col in FONTES_RECURSO}
            total_rs = float(t.get("vl_coluna10") or 0)
            if abs(sum(vs.values()) - total_rs) > 1.0 or total_rs <= 0:
                obs.append(_obs("sau.despesa.por_fonte", cod, ano, None, "INCONSISTENTE", fonte, reg, nota_material=True,
                                nota=f"A soma das fontes ({CF.brl(sum(vs.values()))}) difere do total informado ({CF.brl(total_rs)})."))
                continue
            nota = ("Perímetro declarado pelo município no SIOPS, estágio empenhado: não é o valor liquidado da DCA e não reconcilia com ele em todos os pares.")
            for c, _, _ in FONTES_RECURSO:
                obs.append(_obs("sau.despesa.por_fonte", cod, ano, round(vs[c], 2), "OBSERVADO", fonte, reg, componente=c, nota=nota,
                                elegivel_comparacao=True, nota_material=True, participacao=round(100 * vs[c] / total_rs, 4),
                                total_siops=round(total_rs, 2)))
    return obs
