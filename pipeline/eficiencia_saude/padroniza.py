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
