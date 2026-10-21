"""Gold do painel Conectividade (public/conectividade/gold).

- conectividade.json: o Brasil e as 27 UFs no mês mais recente de cada fonte (banda larga fixa, telefonia móvel e
  cobertura móvel), as séries nacionais (acessos mês a mês, densidade ano a ano, cobertura trimestre a trimestre), a
  distribuição entre municípios (quantis) para situar cada cidade, os destaques contados (municípios sem fibra, sem 5G,
  com uma só prestadora) e as fontes com sha256.
- municipios/{UF}.json: cada município da UF: banda larga fixa (acessos, densidade por 100 habitantes, parte por fibra,
  parte com 100 Mbps ou mais, prestadoras, maior grupo), telefonia móvel (acessos, densidade por 100 habitantes, parte
  5G, pré-pago, M2M), cobertura (moradores, domicílios e área cobertos por tecnologia, operadoras, série trimestral do
  4G e do 5G) e a posição entre os municípios do estado e do país.

As densidades são as da Anatel no mês mais recente, em acessos por 100 habitantes (ver fontes.py sobre a unidade); a
evolução no tempo sai da série de acessos (acessos_mensal), que fecha com a soma dos municípios.

Nada aqui estima. O que a gold calcula, sempre a partir de números publicados pela Anatel e marcado como cálculo da
Scrutiniums: partes em % (parcela ÷ total), médias por UF da cobertura ponderadas pelos moradores do Censo, posições e
quantis. Densidades são as da própria Anatel, em acessos por 100 habitantes nas duas bases (ver fontes.py).
Município sem dado numa fonte (Boa Esperança do Norte, instalado depois do Censo 2022, não tem cobertura) fica com
o campo vazio, nunca com zero.
"""
from __future__ import annotations

import hashlib
import json

from . import fontes as F
from .validacoes import validar_cobertura, validar_cruzado, validar_fixa, validar_movel

VERSAO = "conectividade-1.0.0"


class GoldInvalida(ValueError):
    pass


def pct(parte, total, casas: int = 1):
    if parte is None or not total:
        return None
    return round(100 * parte / total, casas)


def _quantis(valores: list[float]) -> dict | None:
    v = sorted(x for x in valores if x is not None)
    if not v:
        return None

    def q(p: float) -> float:
        k = (len(v) - 1) * p
        i = int(k)
        f = k - i
        return round(v[i] if f == 0 or i + 1 >= len(v) else v[i] + (v[i + 1] - v[i]) * f, 2)

    return {"n": len(v), "p10": q(0.10), "p25": q(0.25), "p50": q(0.50), "p75": q(0.75), "p90": q(0.90)}


def _posicoes(itens: list[tuple[str, float | None]]) -> dict[str, int]:
    """Posição 1 = maior valor; empates recebem a mesma posição; sem valor não entra."""
    ordem = sorted(((v, cod) for cod, v in itens if v is not None), key=lambda x: -x[0])
    pos = {}
    ultimo_v, ultima_pos = None, 0
    for i, (v, cod) in enumerate(ordem, start=1):
        if v != ultimo_v:
            ultima_pos, ultimo_v = i, v
        pos[cod] = ultima_pos
    return pos


# ------------------------------------------------------------------------------------------------------- blocos


def _fixa_de(linha: list, grupos: list[str]) -> dict:
    d = dict(zip(F.CAMPOS_FIXA, linha))
    a = d["acessos"]
    return {
        "acessos": a,
        "fibra_pct": pct(d["fibra"], a),
        "coaxial_pct": pct(d["coaxial"], a),
        "radio_pct": pct(d["radio"], a),
        "satelite_pct": pct(d["satelite"], a),
        "metalico_pct": pct(d["metalico"], a),
        "vel_ate_10_pct": pct(d["vel_ate_10"], a),
        "vel_10_25_pct": pct(d["vel_10_25"], a),
        "vel_25_100_pct": pct(d["vel_25_100"], a),
        "vel_100_mais_pct": pct(d["vel_100_mais"], a),
        "pessoa_fisica_pct": pct(d["pessoa_fisica"], a),
        "prestadoras": d["prestadoras"],
        "maior_grupo": None if d["maior_grupo"] is None else grupos[d["maior_grupo"]],
        "maior_grupo_pct": pct(d["maior_grupo_acessos"], a),
    }


def _movel_de(linha: list, grupos: list[str]) -> dict:
    d = dict(zip(F.CAMPOS_MOVEL, linha))
    a = d["acessos"]
    return {
        # "acessos" é o total que a Anatel publica e usa na densidade: sem M2M e sem pontos de serviço; "linhas" é tudo
        "acessos": a - d["m2m"] - d["ponto_servico"],
        "linhas": a,
        "g2_pct": pct(d["g2"], a), "g3_pct": pct(d["g3"], a), "g4_pct": pct(d["g4"], a), "g5_pct": pct(d["g5"], a),
        "pre_pct": pct(d["pre"], a), "pos_pct": pct(d["pos"], a),
        "pessoa_fisica_pct": pct(d["pessoa_fisica"], a),
        "m2m_pct": pct(d["m2m"], a),
        "ponto_servico_pct": pct(d["ponto_servico"], a),
        "maior_grupo": None if d["maior_grupo"] is None else grupos[d["maior_grupo"]],
        "maior_grupo_pct": pct(d["maior_grupo_acessos"], a),
    }


def _grade_trimestres(publicados: list[str]) -> list[str]:
    """Todos os trimestres entre o primeiro e o último publicado: o primeiro como está (a Anatel começou em
    2021-11, que vale pelo seu trimestre) e, depois dele, cada fim de trimestre seguinte (03, 06, 09, 12). Trimestre
    que a Anatel não publicou entra na grade e fica vazio nas séries, para o gráfico partir a linha em vez de ligar
    vizinhos distantes."""
    if not publicados:
        return []
    grade = [publicados[0]]
    ano, mes = int(publicados[0][:4]), int(publicados[0][5:7])
    mes = ((mes - 1) // 3 + 1) * 3                      # fim do trimestre do primeiro mês publicado
    while True:
        mes += 3
        if mes > 12:
            ano, mes = ano + 1, 3
        t = f"{ano:04d}-{mes:02d}"
        if t > publicados[-1]:
            break
        grade.append(t)
    for t in publicados:
        if t not in grade:
            raise ValueError(f"trimestre {t} fora dos fins de trimestre")
    return grade


def _na_grade(valores: list, publicados: list[str], grade: list[str]) -> list:
    """Reindexa uma série publicada para a grade completa, com None nos trimestres sem publicação."""
    por = dict(zip(publicados, valores))
    return [por.get(t) for t in grade]


def _cobertura_de(v: list, operadoras: list[str], publicados: list[str], grade: list[str]) -> dict:
    _nome, _uf, mor, dom, area, tec, ops, s4, s5 = v
    return {
        "moradores": mor, "domicilios": dom, "area_km2": area,
        "tecnologias": {campo: tec.get(campo) for campo in tec},
        "operadoras": {op: {"g4g5_moradores": ops[op][0], "todas_moradores": ops[op][1]} for op in operadoras if op in ops},
        "serie_g4_moradores": _na_grade(s4, publicados, grade), "serie_g5_moradores": _na_grade(s5, publicados, grade),
        # trimestres em que a Anatel publicou o 5G acima do 4G neste município: os valores ficam como publicados e o painel diz
        "trimestres_5g_acima_do_4g": [t for t, h4, h5 in zip(publicados, s4, s5) if h4 is not None and h5 is not None and h5 > h4 + 0.05],
    }


def _media_ponderada(pares: list[tuple[float | None, int]]) -> float | None:
    """Média da parte coberta ponderada pelos moradores (cálculo da Scrutiniums para UF e Brasil)."""
    num = sum(v * w for v, w in pares if v is not None and w)
    den = sum(w for v, w in pares if v is not None and w)
    return round(num / den, 2) if den else None


def _fontes(fixa: dict, movel: dict, cobertura: dict) -> dict:
    out = {}
    for seed in (fixa, movel, cobertura):
        f = seed["fonte"]
        arq = seed["arquivo"]
        out[{"Acessos de banda larga fixa (Serviço de Comunicação Multimídia)": "fixa",
             "Acessos de telefonia móvel (Serviço Móvel Pessoal)": "movel"}.get(f["nome"], "cobertura")] = {
            "orgao": f["orgao"], "nome": f["nome"], "pagina": f["pagina"], "licenca": f["licenca"],
            "url": arq["url"], "zip_bytes": arq["zip_bytes"], "zip_modificado_em": arq["zip_modificado_em"],
            "membros": [{"membro": m["membro"], "bytes": m["bytes"], "sha256": m["sha256"], "modificado_no_zip": m["modificado_no_zip"]}
                        for m in sorted(arq["membros"].values(), key=lambda m: m["membro"])],
            "capturado_em": seed["capturado_em"], "referencia": seed["referencia"],
        }
    return out


# proveniência volátil: muda quando a Anatel reempacota ou toca o zip sem alterar nenhum número
VOLATEIS = ("capturado_em", "sha256", "gerado_por", "hash_dados", "zip_modificado_em", "zip_bytes", "modificado_no_zip", "bytes", "crc32")


def _sem_captura(obj):
    """Cópia sem os carimbos de captura e sem a proveniência do zip: o hash da gold só muda quando um número muda."""
    if isinstance(obj, dict):
        return {k: _sem_captura(v) for k, v in obj.items() if k not in VOLATEIS}
    if isinstance(obj, list):
        return [_sem_captura(x) for x in obj]
    return obj


def construir(seeds: dict) -> tuple[dict, dict[str, dict]]:
    fixa, movel, cob = seeds["fixa"], seeds["movel"], seeds["cobertura"]
    problemas = validar_fixa(fixa) + validar_movel(movel) + validar_cobertura(cob) + validar_cruzado(fixa, movel, cob)
    if problemas:
        raise GoldInvalida("gold não construída; a publicação anterior continua:\n - " + "\n - ".join(problemas[:40]))

    ids = sorted(set(fixa["municipios"]) | set(movel["municipios"]) | set(cob["municipios"]))
    operadoras = cob["operadoras"]
    grade = _grade_trimestres(cob["trimestres"])

    municipios: dict[str, dict] = {}
    for cod in ids:
        uf = F.UF_DO_PREFIXO.get(cod[:2])
        if uf is None:
            raise GoldInvalida(f"município {cod} sem UF pelo prefixo")
        nome = (fixa["municipios"].get(cod) or movel["municipios"].get(cod) or cob["municipios"].get(cod))[0]
        f = fixa["municipios"].get(cod)
        m = movel["municipios"].get(cod)
        c = cob["municipios"].get(cod)
        municipios[cod] = {
            "id": cod, "nome": nome, "uf": uf,
            "fixa": None if f is None else {**_fixa_de(f[2], fixa["grupos"]), "densidade": fixa["densidade"]["municipios"].get(cod)},
            "movel": None if m is None else {**_movel_de(m[2], movel["grupos"]), "densidade": movel["densidade"]["municipios"].get(cod)},
            "cobertura": None if c is None else _cobertura_de(c, operadoras, cob["trimestres"], grade),
            "ausencias": [x for x, falta in (("fixa", f is None), ("movel", m is None), ("cobertura", c is None)) if falta],
        }

    # posições (1 = maior) no estado e no país
    def valor(mun: dict, caminho: tuple) -> float | None:
        v = mun
        for k in caminho:
            v = (v or {}).get(k) if isinstance(v, dict) else None
        return v if isinstance(v, (int, float)) else None

    medidas = {
        "fixa_densidade": ("fixa", "densidade"), "fixa_fibra_pct": ("fixa", "fibra_pct"), "fixa_vel_100_mais_pct": ("fixa", "vel_100_mais_pct"),
        "movel_densidade": ("movel", "densidade"), "movel_g5_pct": ("movel", "g5_pct"),
        "cobertura_g4_moradores": ("cobertura", "tecnologias", "g4"), "cobertura_g5_moradores": ("cobertura", "tecnologias", "g5"),
    }

    def medida(mun: dict, nome: str) -> float | None:
        v = valor(mun, medidas[nome])
        if v is None and nome.startswith("cobertura_"):
            t = (((mun.get("cobertura") or {}).get("tecnologias") or {}).get(medidas[nome][-1]) or [None])
            return t[0]
        return v

    por_uf_ids: dict[str, list[str]] = {}
    for cod, mun in municipios.items():
        por_uf_ids.setdefault(mun["uf"], []).append(cod)
    posicoes_br = {n: _posicoes([(cod, medida(municipios[cod], n)) for cod in ids]) for n in medidas}
    posicoes_uf = {n: {} for n in medidas}
    for uf, cods in por_uf_ids.items():
        for n in medidas:
            posicoes_uf[n].update(_posicoes([(cod, medida(municipios[cod], n)) for cod in cods]))
    for cod, mun in municipios.items():
        mun["posicao"] = {n: {"uf": posicoes_uf[n].get(cod), "brasil": posicoes_br[n].get(cod)} for n in medidas}

    # UFs
    ufs = []
    for uf in F.UFS:
        cods = por_uf_ids.get(uf, [])
        fl = fixa["ufs"].get(uf)
        ml = movel["ufs"].get(uf)
        cob_uf = [municipios[c]["cobertura"] for c in cods if municipios[c]["cobertura"]]
        moradores = sum(c["moradores"] or 0 for c in cob_uf)
        ufs.append({
            "uf": uf, "nome": F.NOME_UF[uf], "municipios": len(cods),
            # universo de cada ranking: quantos municípios da UF receberam posição naquela medida (sem valor não entra)
            "ranqueados": {n: sum(1 for c in cods if c in posicoes_uf[n]) for n in medidas},
            # universo dos agregados de cada fonte no estado: os municípios que a fonte traz (os sem dado ficam fora da soma e das médias)
            "municipios_por_fonte": {"fixa": sum(1 for c in cods if municipios[c]["fixa"]), "movel": sum(1 for c in cods if municipios[c]["movel"]), "cobertura": len(cob_uf)},
            "fixa": None if fl is None else {**_fixa_de(fl, fixa["grupos"]), "densidade": fixa["densidade"]["ufs"].get(uf)},
            "movel": None if ml is None else {**_movel_de(ml, movel["grupos"]), "densidade": movel["densidade"]["ufs"].get(uf)},
            "cobertura": {
                "moradores": moradores,
                "municipios_com_dado": len(cob_uf),
                **{f"{campo}_moradores": _media_ponderada([((c["tecnologias"].get(campo) or [None])[0], c["moradores"]) for c in cob_uf])
                   for campo in ("todas", "g4", "g5", "g4g5")},
                # ausência da tecnologia não é zero: município sem o valor fica fora das duas contagens e dos seus universos
                "municipios_com_5g_publicado": sum(1 for c in cob_uf if (c["tecnologias"].get("g5") or [None])[0] is not None),
                "municipios_com_4g_publicado": sum(1 for c in cob_uf if (c["tecnologias"].get("g4") or [None])[0] is not None),
                "municipios_sem_5g": sum(1 for c in cob_uf if (v := (c["tecnologias"].get("g5") or [None])[0]) is not None and v < 1),
                "municipios_4g_abaixo_50": sum(1 for c in cob_uf if (v := (c["tecnologias"].get("g4") or [None])[0]) is not None and v < 50),
            },
            "sem_fibra": sum(1 for c in cods if municipios[c]["fixa"] and municipios[c]["fixa"]["fibra_pct"] == 0),
            "uma_prestadora": sum(1 for c in cods if municipios[c]["fixa"] and municipios[c]["fixa"]["prestadoras"] == 1),
        })

    # pares (município, trimestre) em que a Anatel publicou o 5G acima do 4G
    por_tri: dict[str, int] = {}
    for m in municipios.values():
        for t in ((m.get("cobertura") or {}).get("trimestres_5g_acima_do_4g") or []):
            por_tri[t] = por_tri.get(t, 0) + 1
    g5_acima = {
        "pares": sum(por_tri.values()),
        "municipios": sum(1 for m in municipios.values() if (m.get("cobertura") or {}).get("trimestres_5g_acima_do_4g")),
        "por_trimestre": dict(sorted(por_tri.items())),
        "trimestre_atual": por_tri.get(cob["referencia"], 0),
    }

    # Brasil
    bf = fixa["brasil"]
    bm = movel["brasil"]
    bc = cob["brasil"]
    ref_cob = cob["referencia"]
    serie_cob = bc["serie"]
    brasil = {
        "fixa": {
            **_fixa_de([bf[c] for c in F.CAMPOS_FIXA], fixa["grupos"]),
            "densidade": fixa["densidade"]["brasil"],
            "acessos_mensal": fixa["total_mensal"],
            "produto": bf["produto"],
            "grupos": [{"grupo": g, "acessos": a, "pct": pct(a, bf["acessos"])} for g, a in bf["grupos"]],
        },
        "movel": {
            **_movel_de([bm[c] for c in F.CAMPOS_MOVEL], movel["grupos"]),
            "densidade": movel["densidade"]["brasil"],
            "acessos_mensal": movel["total_mensal"],
            "grupos": [{"grupo": g, "acessos": a, "pct": pct(a, bm["acessos"])} for g, a in bm["grupos"]],
        },
        "cobertura": {
            "populacao": bc["populacao"].get(ref_cob),
            "tecnologias": serie_cob[ref_cob],
            # 5G acima do 4G não é invariante da fonte: contado e declarado, nunca motivo de retenção nem de correção
            "g5_acima_do_4g": g5_acima,
            "operadoras": {op: {"g4g5_moradores": v.get("g4g5"), "todas_moradores": v.get("todas")} for op, v in bc["operadoras_ultimo"].items()},
            "trimestres": grade,
            "serie": {campo: [(serie_cob[t].get(campo) or [None])[0] if t in serie_cob else None for t in grade] for campo, _ in F.TECNOLOGIAS_COBERTURA},
            "populacao_por_trimestre": bc["populacao"],
        },
    }

    distribuicao = {n: _quantis([medida(municipios[c], n) for c in ids]) for n in medidas}
    destaques = {
        "municipios": len(ids),
        "sem_fibra": sum(u["sem_fibra"] for u in ufs),
        "uma_prestadora": sum(u["uma_prestadora"] for u in ufs),
        # universo de cada contagem de cobertura: só os municípios com o valor daquela tecnologia publicado (sem dado não é avaliado)
        "ranqueados": {n: len(posicoes_br[n]) for n in medidas},
        "municipios_com_5g_publicado": sum(u["cobertura"]["municipios_com_5g_publicado"] for u in ufs),
        "municipios_com_4g_publicado": sum(u["cobertura"]["municipios_com_4g_publicado"] for u in ufs),
        "sem_5g": sum(u["cobertura"]["municipios_sem_5g"] for u in ufs),
        "g4_abaixo_50": sum(u["cobertura"]["municipios_4g_abaixo_50"] for u in ufs),
        "sem_dado": {x: sorted(c for c in ids if x in municipios[c]["ausencias"]) for x in ("fixa", "movel", "cobertura")},
        "municipios_por_fonte": {x: sum(u["municipios_por_fonte"][x] for u in ufs) for x in ("fixa", "movel", "cobertura")},
        "nao_municipios_descartados": F.NAO_MUNICIPIOS,
    }

    gold = {
        "versao": VERSAO,
        "gerado_por": "pipeline/conectividade/gold.py",
        "capturado_em": max(fixa["capturado_em"], movel["capturado_em"], cob["capturado_em"]),
        "referencia": {"fixa": fixa["referencia"], "movel": movel["referencia"], "cobertura": cob["referencia"]},
        "trimestres_cobertura": grade,
        "notas": {
            "densidade": "Acessos por 100 habitantes, como a Anatel publica nos dois conjuntos (acessos ÷ densidade reproduz a população; "
                         "o Densidades.pdf de 2020 nos zips diz por 100 domicílios para a banda larga fixa, mas os números não dividem "
                         "pelos domicílios). Só o mês mais recente: a série mensal da Anatel tem meses vazios e valores incompatíveis.",
            "movel_acessos": "Na telefonia móvel, acessos é o total que a Anatel publica e usa na densidade, sem M2M (máquina a máquina) "
                             "e sem pontos de serviço; linhas é a soma de tudo o que a Anatel registra no município.",
            "cobertura": "Parte dos moradores, dos domicílios e da área de cada município dentro da mancha de cobertura declarada pelas "
                         "operadoras (setores censitários, Censo 2022 a partir de 2025 e Censo 2010 antes). O número do Brasil é o "
                         "publicado pela Anatel (evolucao_cobertura_brasil.csv); as médias por UF, ponderadas pelos moradores dos "
                         "municípios, são cálculo da Scrutiniums. A Anatel publica, em alguns trimestres e municípios, o 5G acima do 4G "
                         f"({g5_acima['pares']} pares município-trimestre em {g5_acima['municipios']} municípios nesta edição, "
                         f"{g5_acima['trimestre_atual']} no trimestre atual; contagem em brasil.cobertura.g5_acima_do_4g): os valores "
                         "ficam como publicados e o retrato do município diz em quais trimestres isso acontece.",
            "ausencia": "Município sem dado numa fonte fica com o campo vazio, nunca com zero; a lista está em destaques.sem_dado.",
        },
        "operadoras": operadoras,
        "fontes": _fontes(fixa, movel, cob),
        "brasil": brasil,
        "ufs": ufs,
        "distribuicao": distribuicao,
        "destaques": destaques,
    }
    gold["hash_dados"] = hashlib.sha256(json.dumps(_sem_captura(gold), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    por_uf = {}
    for uf in F.UFS:
        cods = por_uf_ids.get(uf, [])
        por_uf[uf] = {
            "uf": uf, "nome_uf": F.NOME_UF[uf],
            "referencia": gold["referencia"], "trimestres_cobertura": grade,
            "operadoras": operadoras, "municipios_brasil": len(ids),
            "municipios": [municipios[c] for c in sorted(cods, key=lambda c: municipios[c]["nome"])],
        }
    return gold, por_uf
