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
            est = {x["coluna"]: float(x["valor"]) for x in linhas if x["conta"] == "10 - Saúde"}
            if "Despesas Pagas" in est and "Despesas Liquidadas" in est and est["Despesas Pagas"] > est["Despesas Liquidadas"] + 1.0:
                aviso_estagio = (f"Na DCA desta declaração a despesa paga ({CF.brl(est['Despesas Pagas'])}) é maior que a liquidada ({CF.brl(est['Despesas Liquidadas'])}): a ordem dos estágios "
                                 "está violada na própria fonte. O módulo usa o valor liquidado e não corrige a fonte.")
                nota = f"{nota} {aviso_estagio}" if nota else aviso_estagio
                material = True
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


BASES_POPULACIONAIS = {
    "estimativa_pre_censo_2022": ("estimativa de 1º de julho anterior ao Censo 2022 (calculada a partir do Censo de 2010)", False),
    "censo": ("Censo 2022, população de 31 de julho de 2022", True),
    "censo_relacao_dou_2023": ("Censo 2022, população de 31 de julho de 2022 (repetida em 2023)", True),
    "censo_2022_resultado_dez_2023": ("Censo 2022, população de 31 de julho de 2022 (repetida em 2023)", True),
    "estimativa_pos_censo_2022": ("estimativa de 1º de julho posterior ao Censo 2022", False),
}
"""Bases da população do exercício. A marca `quebra_serie` alterna entre bases vizinhas: dois exercícios consecutivos só têm variação por habitante
comparável quando a marca é a mesma. 2021 (estimativa anterior ao Censo) e 2024 e 2025 (estimativas posteriores) têm a marca falsa; 2022 e 2023 usam
a mesma população do Censo 2022 e têm a marca verdadeira. Assim, a variação entre 2022 e 2023 é só da despesa, e as passagens 2021 para 2022 e
2023 para 2024 (duas gerações de população) ficam bloqueadas."""


def populacao():
    """População residente das capitais (IBGE), a mesma de Educação, com a base populacional de cada exercício explicitada.

    O valor, o registro e as notas são os de Educação. Só a marca de quebra de série é recalculada aqui, por base (ver BASES_POPULACIONAIS):
    Educação marca 2021 e 2023 e, por isso, bloqueia também a variação entre 2022 e 2023, que usa a mesma população."""
    obs = PE.populacao()
    for o in obs:
        base_pop = BASES_POPULACIONAIS.get(o.get("tipo_populacao"))
        if base_pop is None:
            continue
        o["base_populacional"], o["quebra_serie"] = base_pop
        if o.get("tipo_populacao") == "censo_relacao_dou_2023":
            o["tipo_populacao"] = "censo_2022_resultado_dez_2023"  # o arquivo usado é o dos Primeiros Resultados (22/12/2023), não a relação do DOU
            o["base_populacional"] = BASES_POPULACIONAIS["censo_2022_resultado_dez_2023"][0]
            if o["status"] == "OBSERVADO":
                _rotula_populacao_2023(o)
    return obs


NOTA_POPULACAO_2023 = (
    "População oficial do exercício de 2023: o IBGE adotou a população do Censo 2022 (segunda apuração), com referência em 31 de julho de 2022, "
    "em lugar de uma estimativa de 2023. Os valores deste módulo são os da tabela municipal dos Primeiros Resultados de População do Censo 2022, "
    "de 22/12/2023, iguais aos do SIDRA 4714 e à população de 2022. A relação publicada no DOU em 31/08/2023 não foi obtida (o site do IBGE "
    "responde 403 a consultas automáticas). Não é estimativa de população em julho de 2023: é a mesma população de 2022. "
    "A despesa por habitante de 2023 não acompanha o crescimento populacional posterior ao Censo e a variação entre 2022 e 2023 vem só da "
    "despesa; a variação entre 2023 e 2024 mistura dois anos de crescimento populacional.")


def _rotula_populacao_2023(o):
    """Rótulo de procedência da população de 2023 no módulo de Saúde: o arquivo realmente usado é o PDF dos Primeiros Resultados do Censo 2022
    (22/12/2023), conferido com o SIDRA; a relação do DOU não foi baixada. O texto de Educação (compartilhado) não é alterado."""
    nota = NOTA_POPULACAO_2023
    if "população judicial" in (o.get("nota") or ""):
        nota += " A publicação do IBGE traz, para este município, uma população judicial (nota de rodapé), que não é a usada aqui."
    o["nota"] = nota
    o["registro"] = (f"IBGE, Censo Demográfico 2022 (segunda apuração), Primeiros Resultados de População, tabela municipal de 22/12/2023, município {o['ente']}, "
                     f"referência {PE.DATA_REF_RELACAO_2023}")


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
        extra = dict(conferencia=_conf_resumo(d["conferencia"]), quebra_serie=bool(p.get("quebra_serie")), base_populacional=p.get("base_populacional"),
                     calculo={"numerador": d["valor"], "numerador_ref": "sau.despesa.funcao_saude", "numerador_componente": d["componente"],
                              "denominador": p["valor"], "denominador_ref": "ctx.populacao.residente"})
        obs.append(_obs("sau.despesa.por_habitante", d["ente"], d["ano"], round(v, 6), "OBSERVADO", fonte, reg,
                        componente=d["componente"], nota=" ".join(notas) or None, elegivel_comparacao=eleg,
                        nota_material=bool(d.get("nota_material") or p.get("nota_material")), **extra))
    return obs


def _pct_da_dca(valor, dca):
    """Percentual do valor sobre a despesa da DCA, com vírgula decimal, para a nota."""
    return f"{100 * valor / dca:.1f}".replace(".", ",") + "%" if dca else "sem base"


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
            linhas_msc = base.le_json_gz(caminho)
            soma, desconhecidos, intra = DV2.liquido_por_categoria(linhas_msc)
            n_linhas = sum(1 for x in linhas_msc if str(x.get("funcao")) == "10" and str(x.get("conta_contabil", ""))[:7] in CF.MSC_CONTAS_LIQUIDADO)
            total = round(sum(soma.values()), 2)
            if n_linhas == 0:
                motivo = ("A MSC de dezembro deste ente e exercício não traz linhas da função 10 nas contas de despesa liquidada (nenhum registro): a abertura por natureza "
                          "não pode ser calculada. Não é um valor zero. A abertura não é publicada para este exercício e nenhuma categoria é estimada.")
            elif desconhecidos:
                sem_nat = [x for x in linhas_msc if str(x.get("funcao")) == "10" and str(x.get("conta_contabil", ""))[:7] in CF.MSC_CONTAS_LIQUIDADO
                           and not (str(x.get("natureza_despesa") or "")[:2] in DV2.GRUPO_PARA_CATEGORIA or str(x.get("natureza_despesa") or "")[2:4] == "91")]
                liquido_sem_nat = round(sum(CF.saldo_liquido(x) for x in sem_nat), 2)
                creditos_sem_nat = round(sum(float(x["valor"]) for x in sem_nat if x.get("natureza_conta") == "C"), 2)
                debitos_sem_nat = round(sum(float(x["valor"]) for x in sem_nat if x.get("natureza_conta") == "D"), 2)
                relacao = "coincide com" if abs(total - d["valor"]) <= 1.0 else "difere de"
                motivo = (f"A MSC traz {len(sem_nat)} linhas da função 10 sem natureza da despesa identificável, que não podem ser classificadas em categoria; o saldo líquido dessas linhas "
                          f"(créditos menos débitos) é {CF.brl(liquido_sem_nat)}, mas os créditos somam {CF.brl(creditos_sem_nat)} e os débitos {CF.brl(debitos_sem_nat)} "
                          f"({_pct_da_dca(creditos_sem_nat, d['valor'])} da DCA), sem natureza identificável. A soma das categorias identificadas ({CF.brl(total)}) {relacao} a DCA ({CF.brl(d['valor'])}), "
                          "mas a abertura completa não é verificável: se esses créditos e débitos pertencessem a categorias diferentes, a composição mudaria sem alterar o total. A abertura por natureza não é publicada para este exercício e nenhuma categoria é estimada.")
            elif not DV2.reconcilia(soma, d["valor"]):
                motivo = (f"A MSC aberta por natureza ({CF.brl(total)}, sem modalidade 91) não reproduz a DCA ({CF.brl(d['valor'])}); "
                          f"diferença de {CF.brl(round(total - d['valor'], 2))}. A abertura por natureza não é publicada para este exercício e nenhuma categoria é estimada.")
            else:
                motivo = None
            if motivo:
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


# ------------------------------------------------------------------ Relatório APS: equipes e cobertura potencial

COMPETENCIA_DEZEMBRO = {ano: f"12/{ano}" for ano in ANOS_FINANCEIROS}
PARAM_ESF, PARAM_EAP20, PARAM_EAP30 = 3500, 1750, 2625
"""Parâmetros da Nota Técnica nº 2/2025 da SAPS/MS: pessoas cobertas por eSF, eAP de 20 h e eAP de 30 h."""
ANO_INICIO_REGRA_VIGENTE = 2022
"""A fórmula da NT 2/2025 reproduz todas as linhas do serviço de 01/2022 em diante; em 2021 o serviço segue regra anterior de eAP e de
cadastro (292 de 312 linhas divergem), então a cobertura de 2021 fica fora das comparações e das variações."""
ANO_BASE_POPULACAO_PRE_CENSO = 2021
ANO_BASE_POPULACAO_CENSO = 2023
"""Bases da população de referência do Ministério na cobertura potencial, pelo ano base (o ano anterior ao da competência):
até 2021 (dezembro de 2021 e de 2022): estimativa calculada a partir do Censo de 2010, anterior ao Censo 2022;
2022 e 2023 (dezembro de 2023 e de 2024): a mesma população do Censo 2022 (a população de 2023 repete a de 2022);
2024 em diante (dezembro de 2025): estimativa de 2024, posterior ao Censo, com dois anos de crescimento populacional de uma vez.
A marca de quebra de série alterna entre bases vizinhas (verdadeira, falsa, verdadeira): só dois meses consecutivos da mesma base têm variação comparável.
Por isso as passagens de dezembro de 2022 para 2023 e de dezembro de 2024 para 2025 não medem só a cobertura."""


def base_populacao_ms(ano_base):
    """(rótulo, marca de quebra de série) da base da população de referência do Ministério para um ano base."""
    ano_base = int(ano_base)
    if ano_base <= ANO_BASE_POPULACAO_PRE_CENSO:
        return "estimativa anterior ao Censo 2022", True
    if ano_base <= ANO_BASE_POPULACAO_CENSO:
        return "Censo 2022", False
    return "estimativa de 2024, posterior ao Censo 2022", True


def _seed_aps(cod):
    caminho = os.path.join(base.SEED, "relatorio_aps", f"cobertura_aps_{cod}.json.gz")
    return base.le_json_gz(caminho) if os.path.exists(caminho) else None


def _pop_por_ente(pop_obs):
    return {(o["ente"], o["ano"]): o for o in pop_obs}


def aps(pop_obs):
    """Equipes de atenção primária (eSF e eAP), por 10 mil habitantes, e Cobertura Potencial Estimada da APS, em dezembro de cada ano.

    Equipe: contagem do serviço do Relatório APS (equipes financiadas, ativas no CNES e validadas), tipos mantidos separados. Cobertura
    potencial: valor oficial do serviço, sem teto de 100%, com capacidade e população de referência do Ministério à vista. Equipes por
    10 mil habitantes usam a população do exercício do OBEE (IBGE), não a do serviço, e dizem isso. Não é cobertura efetiva, cadastro
    nem pessoas atendidas."""
    pop = _pop_por_ente(pop_obs)
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        linhas = _seed_aps(cod)
        por_comp = {l["nuComp"]: l for l in (linhas or [])}
        for ano in ANOS_FINANCEIROS:
            comp = COMPETENCIA_DEZEMBRO[ano]
            l = por_comp.get(comp)
            reg = f"Relatório APS, /cobertura/aps, município {str(cod)[:6]}, competência {comp}"
            if l is None:
                for ind, c in (("sau.aps.equipes", None), ("sau.aps.cobertura_potencial", None)):
                    obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", "relatorio_aps_cobertura", reg, componente=c,
                                    nota="Competência não encontrada na resposta do Relatório APS.", nota_material=True))
                continue
            tipos = [("esf", l["qtEsf"]), ("eap20", l["qtEap20"]), ("eap30", l["qtEap30"]), ("esfr", l["qtEsfr"]), ("ecr", l["qtEcr"]),
                     ("eapp20", l["qtEapp20"]), ("eapp30", l["qtEapp30"])]
            for comp_id, v in tipos:
                obs.append(_obs("sau.aps.equipes", cod, ano, int(v), "OBSERVADO", "relatorio_aps_cobertura", reg, componente=comp_id,
                                elegivel_comparacao=True, nota_material=False,
                                nota=("Contagem de equipes do serviço do Relatório APS na competência de dezembro; não distingue equipes completas, "
                                      "parciais ou com carga horária reduzida.") if comp_id == "esf" else None))
            p = pop.get((cod, ano))
            if p is not None and p["status"] == "OBSERVADO":
                esf, eap = int(l["qtEsf"]), int(l["qtEap20"]) + int(l["qtEap30"])
                for comp_id, num in (("esf", esf), ("eap", eap)):
                    obs.append(_obs("sau.aps.equipes_por_10mil", cod, ano, round(num / p["valor"] * 10000, 6), "OBSERVADO",
                                    "relatorio_aps_cobertura+ibge_populacao", reg + "; população: " + p["registro"], componente=comp_id,
                                    elegivel_comparacao=True, nota_material=bool(p.get("nota_material")), quebra_serie=bool(p.get("quebra_serie")), base_populacional=p.get("base_populacional"),
                                    nota=p.get("nota") if p.get("nota_material") else None,
                                    calculo={"numerador": num, "denominador": p["valor"], "numerador_ref": "sau.aps.equipes", "denominador_ref": "ctx.populacao.residente",
                                             "numerador_componente": "esf" if comp_id == "esf" else "eap20+eap30"}))
            else:
                obs.append(_obs("sau.aps.equipes_por_10mil", cod, ano, None, "AUSENTE_NA_COLETA", "ibge_populacao", reg, nota="População do exercício indisponível.", nota_material=True))
            # cobertura potencial: valor oficial; a fórmula é conferida linha a linha
            cap_formula = l["qtEsf"] * PARAM_ESF + l["qtEap20"] * PARAM_EAP20 + l["qtEap30"] * PARAM_EAP30 + l["qtCadastroEquipeEsfrEcrEapp"]
            confere = abs(cap_formula - l["qtCapacidadeEquipe"]) <= 1 and l["qtPopulacao"] > 0 and abs(l["qtCapacidadeEquipe"] / l["qtPopulacao"] * 100 - l["qtCobertura"]) <= 0.01
            antes_regra = ano < ANO_INICIO_REGRA_VIGENTE
            rotulo_base, marca_base = base_populacao_ms(l["nuAnoReferencia"])
            base_pre_censo = int(l["nuAnoReferencia"]) <= ANO_BASE_POPULACAO_PRE_CENSO
            notas = ["Cobertura Potencial Estimada: capacidade das equipes (eSF × 3.500, eAP 20 h × 1.750, eAP 30 h × 2.625, mais pessoas com cadastro vinculado de eCR, "
                     "eSFR e eAPP) dividida pela população que o Ministério adota (a do ano anterior ao da competência). Não é cadastro, atendimento nem pessoas "
                     "atendidas, e o serviço não limita o valor a 100%."]
            if l["qtCobertura"] > 100:
                notas.append(f"Capacidade acima da população de referência ({l['qtCobertura']:.2f}%)".replace(".", ",") + ": o valor oficial passa de 100% e não é truncado.")
            if antes_regra:
                notas.append("Dezembro de 2021 segue regra anterior de equipes e de cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025: fora das comparações e das variações.")
            if base_pre_censo and not antes_regra:
                notas.append("A população de referência do Ministério neste mês é estimativa anterior ao Censo 2022 (ano base " + str(l["nuAnoReferencia"]) + "); de dezembro de 2023 em diante a base é outra "
                             "(Censo 2022 e estimativas posteriores). A variação entre esse mês e os seguintes mistura a mudança do denominador e não é uma medida direta da cobertura.")
            elif int(l["nuAnoReferencia"]) > ANO_BASE_POPULACAO_CENSO:
                notas.append("A população de referência do Ministério neste mês é a estimativa de " + str(l["nuAnoReferencia"]) + ", posterior ao Censo 2022; a de dezembro de 2023 e a de dezembro de 2024 é a mesma população do Censo 2022. "
                             "A variação entre dezembro de 2024 e este mês mistura dois anos de crescimento populacional e não mede só a cobertura.")
            elif not antes_regra:
                notas.append("A população de referência do Ministério em dezembro de 2023 e em dezembro de 2024 é a mesma, a do Censo 2022: a variação entre os dois meses vem só da capacidade das equipes. "
                             "A de dezembro de 2022 é anterior ao Censo e a de dezembro de 2025 é estimativa posterior; as passagens para esses meses mudam o denominador.")
            if not confere and not antes_regra:
                obs.append(_obs("sau.aps.cobertura_potencial", cod, ano, None, "INCONSISTENTE", "relatorio_aps_cobertura", reg, nota_material=True,
                                nota="A capacidade informada não reproduz a fórmula da Nota Técnica nº 2/2025 ou a cobertura informada não é capacidade ÷ população."))
                continue
            obs.append(_obs("sau.aps.cobertura_potencial", cod, ano, float(l["qtCobertura"]), "OBSERVADO", "relatorio_aps_cobertura", reg,
                            elegivel_comparacao=not antes_regra, nota_material=True, nota=" ".join(notas), quebra_serie=antes_regra or marca_base,
                            populacao_referencia_ms=int(l["qtPopulacao"]), ano_base_populacao_ms=l["nuAnoReferencia"], origem_populacao_ms=l.get("tpOrigemBasePopulacao"),
                            base_populacional="população de referência do Ministério: " + rotulo_base + " (ano base " + str(l["nuAnoReferencia"]) + ")",
                            calculo={"numerador": float(l["qtCapacidadeEquipe"]), "denominador": float(l["qtPopulacao"]), "numerador_ref": "capacidade das equipes (Relatório APS)",
                                     "denominador_ref": "população de referência do Ministério da Saúde"}))
    return obs


# ------------------------------------------------------------------ RIPSA: ICSAP (MRB.4.02), internações SUS (COB.2.01) e planos privados (COB.5.01)

ANOS_RESULTADOS = [2021, 2022, 2023, 2024]
GRUPOS_ICSAP = {
    1: "Doenças preveníveis por imunização e condições sensíveis",
    2: "Gastroenterites infecciosas e complicações",
    3: "Anemia",
    4: "Deficiências nutricionais",
    5: "Infecções de ouvido, nariz e garganta",
    6: "Pneumonias bacterianas",
    7: "Asma",
    8: "Doenças pulmonares",
    9: "Hipertensão",
    10: "Angina",
    11: "Insuficiência cardíaca",
    12: "Doenças cerebrovasculares",
    13: "Diabetes mellitus",
    14: "Epilepsias",
    15: "Infecção no rim e trato urinário",
    16: "Infecção da pele e tecido subcutâneo",
    17: "Doença inflamatória de órgãos pélvicos femininos",
    18: "Úlcera gastrointestinal",
    19: "Doenças relacionadas ao pré-natal e parto",
}
RESSALVA_ICSAP = ("Internações pagas pelo SUS (AIH tipo 1, sem hospital dia), por município de residência e ano de processamento da AIH. "
                  "Não inclui internações custeadas por planos privados ou particulares e conta AIH, não pacientes. Não identifica falha de gestão nem de atenção primária: "
                  "a taxa também depende de oferta de leitos, critérios de internação e registro.")


def _cod7(cod6):
    return {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}[cod6]


def _seed_csv(*partes):
    caminho = os.path.join(base.SEED, *partes)
    return base.le_csv_gz(caminho) if os.path.exists(caminho) else None


def icsap(pop_obs):
    """Internações por condições sensíveis à atenção primária (ICSAP), por residência: número, taxa por 100 mil, participação nas
    internações SUS e composição pelos 19 grupos da Lista Brasileira (Portaria SAS/MS nº 221/2008).

    Fonte: RIPSA MRB.4.02 (e COB.2.01 para o conjunto de internações). A taxa usa a população do próprio indicador (série do Ministério da
    Saúde), publicada com a fonte declarada; a mesma contagem dividida pela população do exercício do OBEE (IBGE) entra como sensibilidade."""
    icsap_linhas = _seed_csv("ripsa", "mrb402_icsap_capitais_2021_2024.csv.gz")
    intern = _seed_csv("ripsa", "cob201_internacoes_capitais_2021_2024.csv.gz")
    pop = _pop_por_ente(pop_obs)
    obs = []
    ic = {(int(r["codigo_ibge_6"]), int(r["ano"])): r for r in (icsap_linhas or [])}
    it = {(int(r["codigo_ibge_6"]), int(r["ano"])): r for r in (intern or [])}
    for cod, nome, uf in entes.CAPITAIS:
        m6 = int(str(cod)[:6])
        for ano in ANOS_RESULTADOS:
            r = ic.get((m6, ano))
            reg = f"RIPSA MRB.4.02, município de residência {m6}, ano {ano}"
            fonte = "ripsa_mrb402_icsap"
            if r is None:
                for ind, c in (("sau.icsap.internacoes", None), ("sau.icsap.taxa", "ripsa"), ("sau.icsap.taxa", "populacao_ibge_obee"),
                               ("sau.icsap.participacao", None), ("sau.icsap.grupos", None)):
                    obs.append(_obs(ind, cod, ano, None, "AUSENTE_NA_COLETA", fonte, reg, componente=c, nota="Registro não encontrado no arquivo do RIPSA.", nota_material=True))
                continue
            total, pop_r = int(r["icsap_total"]), int(r["populacao_denominador"])
            grupos = {i: int(r[f"grupo_{i}"]) for i in range(1, 20)}
            soma_grupos = sum(grupos.values())
            elegivel = True
            obs.append(_obs("sau.icsap.internacoes", cod, ano, total, "OBSERVADO", fonte, reg, nota=RESSALVA_ICSAP, elegivel_comparacao=elegivel, nota_material=True))
            if pop_r > 0:
                taxa = total / pop_r * 100000
                obs.append(_obs("sau.icsap.taxa", cod, ano, round(taxa, 6), "OBSERVADO", fonte, reg, componente="ripsa",
                                nota=RESSALVA_ICSAP + " A taxa usa a população estimada do próprio indicador (série do Ministério da Saúde), que é maior que a do Censo 2022 nas capitais.",
                                elegivel_comparacao=elegivel, nota_material=True,
                                calculo={"numerador": total, "denominador": pop_r, "numerador_ref": "sau.icsap.internacoes", "denominador_ref": "população estimada do RIPSA MRB.4.02"}))
            else:
                obs.append(_obs("sau.icsap.taxa", cod, ano, None, "INCONSISTENTE", fonte, reg, componente="ripsa", nota="População do denominador nula.", nota_material=True))
            p = pop.get((cod, ano))
            if p is not None and p["status"] == "OBSERVADO" and p["valor"]:
                obs.append(_obs("sau.icsap.taxa", cod, ano, round(total / p["valor"] * 100000, 6), "OBSERVADO", fonte + "+ibge_populacao", reg + "; população: " + p["registro"],
                                componente="populacao_ibge_obee", nota=("Sensibilidade: a mesma contagem dividida pela população residente do exercício usada nos demais indicadores por habitante do OBEE "
                                                                         "(IBGE). " + ("Nesta capital e neste ano a população do RIPSA e a do IBGE coincidem, e as duas taxas são iguais. " if pop_r == p["valor"]
                                                                                       else "Difere da taxa principal porque as populações diferem. ") + RESSALVA_ICSAP),
                                elegivel_comparacao=elegivel, nota_material=True, quebra_serie=bool(p.get("quebra_serie")), base_populacional=p.get("base_populacional"),
                                calculo={"numerador": total, "denominador": p["valor"], "numerador_ref": "sau.icsap.internacoes", "denominador_ref": "ctx.populacao.residente"}))
            else:
                obs.append(_obs("sau.icsap.taxa", cod, ano, None, "AUSENTE_NA_COLETA", "ibge_populacao", reg, componente="populacao_ibge_obee", nota="População do exercício indisponível.", nota_material=True))
            i = it.get((m6, ano))
            if i is not None and int(i["internacoes_sus"]) > 0:
                tot_i = int(i["internacoes_sus"])
                obs.append(_obs("sau.icsap.participacao", cod, ano, round(total / tot_i * 100, 6), "OBSERVADO", "ripsa_mrb402_icsap+ripsa_cob201_internacoes",
                                reg + f"; internações SUS por residência: RIPSA COB.2.01, ano {ano}",
                                nota=("Parcela das internações SUS por residência classificadas como ICSAP. É composição do conjunto de internações, não medida de resultado: depende do que "
                                      "o restante das internações contém (obstetrícia, cirurgias, oferta hospitalar). " + RESSALVA_ICSAP),
                                elegivel_comparacao=elegivel, nota_material=True,
                                calculo={"numerador": total, "denominador": tot_i, "numerador_ref": "sau.icsap.internacoes", "denominador_ref": "internações SUS por residência (RIPSA COB.2.01)"}))
            else:
                obs.append(_obs("sau.icsap.participacao", cod, ano, None, "AUSENTE_NA_COLETA", "ripsa_cob201_internacoes", reg, nota="Total de internações SUS não encontrado no arquivo do RIPSA.", nota_material=True))
            if soma_grupos == total:
                for g, v in grupos.items():
                    obs.append(_obs("sau.icsap.grupos", cod, ano, v, "OBSERVADO", fonte, reg + f", grupo {g}", componente=f"g{g:02d}", elegivel_comparacao=elegivel,
                                    nota_material=False, participacao=round(100 * v / total, 4) if total else None))
            else:
                obs.append(_obs("sau.icsap.grupos", cod, ano, None, "INCONSISTENTE", fonte, reg, nota_material=True,
                                nota=f"A soma dos 19 grupos ({soma_grupos}) difere do total ({total})."))
    return obs


def planos():
    """Cobertura de planos de saúde privados (ANS, via RIPSA COB.5.01), em dezembro: contexto da taxa de ICSAP, não ajuste."""
    linhas = _seed_csv("ripsa", "cob501_planos_capitais_dezembro_2021_2024.csv.gz")
    d = {(int(r["codigo_ibge_6"]), int(r["competencia"][:4])): r for r in (linhas or [])}
    obs = []
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_RESULTADOS:
            r = d.get((int(str(cod)[:6]), ano))
            reg = f"RIPSA COB.5.01 (base ANS), município {str(cod)[:6]}, dezembro de {ano}, categoria Total"
            if r is None:
                obs.append(_obs("sau.ctx.cobertura_planos", cod, ano, None, "AUSENTE_NA_COLETA", "ripsa_cob501_planos", reg, nota="Registro não encontrado.", nota_material=True))
                continue
            obs.append(_obs("sau.ctx.cobertura_planos", cod, ano, round(float(r["percentual"]), 6), "OBSERVADO", "ripsa_cob501_planos", reg,
                            nota=("Percentual da população com plano de saúde privado em dezembro. Contexto: o SIH cobre só internações pagas pelo SUS. Não serve para estimar "
                                  "usuários do SUS subtraindo beneficiários da população."), elegivel_comparacao=True, nota_material=False))
    return obs


# ------------------------------------------------------------------ CNES: unidades básicas e postos de saúde (atenção primária)

TIPOS_APS = ("01", "02")
TIPOS_CONTEXTO = ("15", "32", "40", "71", "74")
ROTULO_TIPO = {"01": "Posto de saúde", "02": "Centro de saúde/unidade básica", "15": "Unidade mista", "32": "Unidade móvel fluvial",
               "40": "Unidade móvel terrestre", "71": "Centro de apoio à saúde da família", "74": "Polo academia da saúde"}
RESSALVA_UBS = ("Estabelecimentos de tipo 01 (posto de saúde) e 02 (centro de saúde/unidade básica), ativos no CNES e de natureza jurídica pública, localizados na "
                "capital. O cadastro não comprova funcionamento, acesso nem vaga disponível, e um estabelecimento situado na capital pode não ser municipal: "
                "a gestão (municipal, estadual ou dupla) e a natureza jurídica são campos distintos do local.")
RESSALVA_UBS_SERIE = (" A série de dezembro só acompanha os estabelecimentos que hoje têm tipo 01 ou 02: um estabelecimento que era unidade básica no ano e foi reclassificado "
                      "ou renumerado não entra, e a contagem dos anos anteriores pode ficar abaixo da registrada na época.")


def _tipo_codigo(txt):
    t = str(txt or "").strip()
    return t[:2] if t[:2].isdigit() else ""


def rede_serie(pop_obs):
    """UBS (tipos 01 e 02) ativas em dezembro de cada ano, pelo histórico mensal do CNES (API de dados abertos, família com competência).

    Recorte: estabelecimentos que, no retrato da captura, têm tipo 01 ou 02 (ativos e desabilitados). Em cada dezembro conta-se o
    estabelecimento pelo tipo, status e natureza que ele tinha naquela competência. Natureza pública é o grupo de natureza jurídica
    PUBLICO; gestão é o campo de gestão do CNES (municipal, estadual ou dupla), que não equivale a propriedade."""
    caminho = os.path.join(base.SEED, "cnes", "historico_aps_dezembros.json.gz")
    hist = base.le_json_gz(caminho) if os.path.exists(caminho) else None
    pop = _pop_por_ente(pop_obs)
    m6 = {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}
    obs = []
    if hist is None:
        return obs
    cont = {}
    for co, h in hist.items():
        for l in h["linhas"]:
            cod = m6.get(str(l.get("co_ibge") or "").strip())
            comp = str(l["nu_comp"])
            if cod is None or not comp.endswith("12") or not comp[:4].isdigit():
                continue
            c = cont.setdefault((cod, int(comp[:4])), {"total_ativas": 0, "publicas": 0, "gestao_municipal": 0, "gestao_estadual": 0, "gestao_dupla": 0})
            if _tipo_codigo(l.get("tp_unidade")) not in TIPOS_APS or str(l.get("ds_status") or "").strip().upper() != "ATIVO":
                continue
            c["total_ativas"] += 1
            if str(l.get("no_grupo_nat_jur") or "").strip().upper() == "PUBLICO":
                c["publicas"] += 1
            g = str(l.get("tp_gestao") or "").strip().upper()
            if g in ("MUNICIPAL", "ESTADUAL", "DUPLA"):
                c["gestao_" + g.lower()] += 1
    for cod, nome, uf in entes.CAPITAIS:
        for ano in ANOS_FINANCEIROS:
            c = cont.get((cod, ano))
            reg = f"CNES, API de dados abertos (assistencia-a-saude/cnes-estabelecimentos), competência dezembro de {ano}"
            if c is None:
                obs.append(_obs("sau.rede.ubs_publicas", cod, ano, None, "AUSENTE_NA_COLETA", "cnes_historico_estabelecimentos", reg, componente="publicas",
                                nota="Nenhum estabelecimento da capital com registro na competência no histórico coletado.", nota_material=True))
                continue
            comp_valores = {**c, "nao_publicas": c["total_ativas"] - c["publicas"]}
            for k, v in comp_valores.items():
                obs.append(_obs("sau.rede.ubs_publicas", cod, ano, v, "OBSERVADO", "cnes_historico_estabelecimentos", reg, componente=k,
                                nota=RESSALVA_UBS + RESSALVA_UBS_SERIE if k == "publicas" else None, elegivel_comparacao=True, nota_material=(k == "publicas")))
            p = pop.get((cod, ano))
            if p is not None and p["status"] == "OBSERVADO" and p["valor"]:
                obs.append(_obs("sau.rede.ubs_publicas_por_10mil", cod, ano, round(c["publicas"] / p["valor"] * 10000, 6), "OBSERVADO",
                                "cnes_historico_estabelecimentos+ibge_populacao", reg + "; população: " + p["registro"], componente="publicas",
                                nota=RESSALVA_UBS + RESSALVA_UBS_SERIE, elegivel_comparacao=True, nota_material=True, quebra_serie=bool(p.get("quebra_serie")), base_populacional=p.get("base_populacional"),
                                calculo={"numerador": c["publicas"], "denominador": p["valor"], "numerador_ref": "sau.rede.ubs_publicas", "denominador_ref": "ctx.populacao.residente",
                                         "numerador_componente": "publicas"}))
            else:
                obs.append(_obs("sau.rede.ubs_publicas_por_10mil", cod, ano, None, "AUSENTE_NA_COLETA", "ibge_populacao", reg, componente="publicas",
                                nota="População do exercício indisponível.", nota_material=True))
    return obs


def rede_retrato():
    """Retrato do CNES em 09/10/2026 (arquivo diário do OpenDataSUS): UBS ativas por natureza, gestão e atendimento SUS, e outros tipos de unidade
    de atenção primária como contexto. Sem competência: a data de captura é a única referência temporal (ano 2026 marca o retrato)."""
    linhas = _seed_csv("cnes", "estabelecimentos_aps_capitais.csv.gz")
    obs = []
    m6 = {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}
    por_cap = {}
    for r in linhas or []:
        cod = m6.get(r["CO_IBGE"])
        if cod is None or r["CO_MOTIVO_DESAB"]:
            continue
        c = por_cap.setdefault(cod, {k: 0 for k in ("tp01", "tp02", "total_ativas", "publicas", "publicas_sus", "nao_publicas", "gestao_municipal",
                                                     "gestao_municipal_nao_publica", "gestao_estadual", "gestao_dupla", "tp15", "tp32", "tp40", "tp71", "tp74")})
        tp = r["TP_UNIDADE"]
        if tp in TIPOS_CONTEXTO:
            c["tp" + tp] += 1
            continue
        if tp not in TIPOS_APS:
            continue
        c["tp" + tp] += 1
        c["total_ativas"] += 1
        publico = r["CO_NATUREZA_JUR"].startswith("1")
        c["publicas" if publico else "nao_publicas"] += 1
        if publico and r["CO_AMBULATORIAL_SUS"].upper() in ("SIM", "S", "1"):
            c["publicas_sus"] += 1
        g = {"M": "gestao_municipal", "E": "gestao_estadual", "D": "gestao_dupla"}.get(r["TP_GESTAO"])
        if g:
            c[g] += 1
        if g == "gestao_municipal" and not publico:
            c["gestao_municipal_nao_publica"] += 1
    reg = "CNES, retrato do arquivo cnes_estabelecimentos_csv.zip do OpenDataSUS, capturado em 09/10/2026"
    for cod, nome, uf in entes.CAPITAIS:
        c = por_cap.get(cod)
        if c is None:
            obs.append(_obs("sau.rede.ubs_retrato", cod, 2026, None, "AUSENTE_NA_COLETA", "cnes_estabelecimentos", reg, componente="total_ativas",
                            nota="Nenhum estabelecimento de tipo 01 ou 02 da capital no retrato.", nota_material=True))
            continue
        for k, v in c.items():
            obs.append(_obs("sau.rede.ubs_retrato", cod, 2026, v, "OBSERVADO", "cnes_estabelecimentos", reg, componente=k, elegivel_comparacao=True,
                            nota=RESSALVA_UBS if k == "total_ativas" else None, nota_material=(k == "total_ativas")))
    return obs


# ------------------------------------------------------------------ conjunto completo

def todas():
    """Todas as observações do módulo, em ordem estável."""
    pop = populacao()
    desp = despesa()
    obs = (pop + desp + despesa_natureza(desp) + despesa_por_habitante(desp, pop) + asps() + despesa_por_fonte()
           + rede_serie(pop) + rede_retrato() + aps(pop) + icsap(pop) + planos())
    return obs
