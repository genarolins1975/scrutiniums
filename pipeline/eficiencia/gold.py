"""Publicação: gold do painel Educação municipal nas capitais e séries para download.

Saídas:
    public/eficiencia/gold/educacao_capitais.json   lida pela página no build
    public/eficiencia/series/<indicador>.csv         todas as observações, com estado e fonte

A interface, a tabela e o download usam o mesmo conjunto de observações: a
página não recalcula nada que não esteja aqui, salvo filtros e ordenação.
"""
import csv
import hashlib
import io
import json
import os

from pipeline.eficiencia import base, conferencia as CF, entes, padroniza as P, validacoes as V

ARQUIVO_GOLD = os.path.join(base.GOLD, "educacao_capitais.json")


def _catalogo():
    return base.le_json(base.CATALOGO)


def _hash_dados(obs):
    txt = json.dumps(obs, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(txt.encode("utf-8")).hexdigest()


def cobertura(obs, catalogo):
    """Por indicador, ano e etapa: capitais elegíveis, com valor observado e sem valor (com estado)."""
    out = {}
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    for ind in catalogo["indicadores"]:
        sel = [o for o in obs if o["indicador"] == ind["id"]]
        if not sel:
            continue
        # componente principal de cada indicador (os demais seguem a mesma cobertura)
        principal = {"edu.despesa.funcao_educacao": "nominal", "edu.ideb.rede_municipal": "ideb",
                     "edu.saeb.rede_municipal": "matematica"}.get(ind["id"])
        grupos = {}
        for o in sel:
            if ind["id"] == "edu.despesa.subfuncao":
                chave = (o["ano"], None)
                if o["ente"] not in grupos.get(chave, {}):
                    grupos.setdefault(chave, {})[o["ente"]] = (o["status"], o.get("elegivel_comparacao", False))
                continue
            if principal and o["componente"] != principal:
                continue
            chave = (o["ano"], o["etapa"])
            grupos.setdefault(chave, {})[o["ente"]] = (o["status"], o.get("elegivel_comparacao", False))
        linhas = []
        for (ano, etapa), por_ente in sorted(grupos.items(), key=lambda x: (x[0][0], x[0][1] or "")):
            sem = [{"ente": e, "nome": nomes[e], "status": st} for e, (st, _) in sorted(por_ente.items()) if st != "OBSERVADO"]
            fora = [{"ente": e, "nome": nomes[e]} for e, (st, el) in sorted(por_ente.items()) if st == "OBSERVADO" and not el]
            linhas.append({"ano": ano, "etapa": etapa, "elegiveis": len(entes.CAPITAIS),
                           "com_valor": sum(1 for st, _ in por_ente.values() if st == "OBSERVADO"),
                           "comparaveis": sum(1 for st, el in por_ente.values() if st == "OBSERVADO" and el),
                           "sem_valor": sem, "fora_da_comparacao": fora})
        out[ind["id"]] = linhas
    return out


def _primeira_capital_com_valor(obs, indicador, ano, etapa=None, componente=None):
    ordem = [c["cod_ibge"] for c in entes.capitais()]
    for cod in ordem:
        for o in obs:
            if (o["indicador"] == indicador and o["ente"] == cod and o["ano"] == ano and o["etapa"] == etapa
                    and (componente is None or o["componente"] == componente) and o["status"] == "OBSERVADO"):
                return o
    return None


def trilhas(obs):
    """Uma trilha completa de reprodução por indicador publicado. Regra de escolha neutra e fixa: a
    primeira capital, em ordem alfabética, com valor observado no período mais recente."""
    m = base.le_manifesto()["capturas"]
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    out = []

    o = _primeira_capital_com_valor(obs, "edu.despesa.funcao_educacao", 2025, componente="nominal")
    if o:
        arq = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{o['ente']}_2025.json.gz")
        cap = m["siconfi_dca_anexo_i_e"]["arquivos"][f"{o['ente']}_2025"]
        out.append({"indicador": "edu.despesa.funcao_educacao", "ente": o["ente"], "nome": nomes[o["ente"]], "ano": 2025, "passos": [
            f"Consulta à API do Siconfi: {cap['url']} (capturada em {cap['capturado_em']}).",
            f"Resposta preservada em {os.path.relpath(arq, base.RAIZ)} (sha256 do conteúdo {cap['sha256']}).",
            "Linha com conta \"12 - Educação\" e coluna \"Despesas Liquidadas\".",
            f"Valor lido: {P.brl(o['valor'])}.",
            f"Conferência: {o['conferencia']['rotulo']} (política {o['conferencia']['versao_politica']}).",
        ], "valor": o["valor"]})
        subs = [x for x in obs if x["indicador"] == "edu.despesa.subfuncao" and x["ente"] == o["ente"] and x["ano"] == 2025
                and x["status"] == "OBSERVADO"]
        if subs:
            s0 = max(subs, key=lambda x: x["valor"])
            out.append({"indicador": "edu.despesa.subfuncao", "ente": o["ente"], "nome": nomes[o["ente"]], "ano": 2025, "passos": [
                "Mesma resposta da DCA 2025.",
                f"Linhas das subfunções da função 12: {len(subs)}; soma = {P.brl(sum(x['valor'] for x in subs))}, igual ao total da função ({P.brl(o['valor'])}).",
                f"Subfunção {s0['componente']} ({P.SUBFUNCOES_ROTULO.get(s0['componente'], s0['componente'])}): {P.brl(s0['valor'])} ÷ {P.brl(o['valor'])} = {str(round(s0['participacao'], 2)).replace('.', ',')}%.",
            ], "valor": s0["participacao"]})

    o = _primeira_capital_com_valor(obs, "edu.matriculas.rede_municipal", 2025, etapa="total")
    if o:
        c = m["inep_censo_2025"]
        out.append({"indicador": "edu.matriculas.rede_municipal", "ente": o["ente"], "nome": nomes[o["ente"]], "ano": 2025, "passos": [
            f"Pacote oficial {c['url']} (sha256 {c['sha256_original']}; MD5 do CSV conferido com o publicado pelo INEP: {c['md5_conferido']}).",
            f"Arquivo {c['membro']}; recorte das capitais em {c['recorte']}.",
            f"Escolas com CO_MUNICIPIO = {o['ente']} e TP_DEPENDENCIA = 3: {o['escolas']}.",
            f"Soma de QT_MAT_BAS: {o['valor']:,}.".replace(",", "."),
            "Conferência com a Sinopse Estatística 2025, tabela 1.2, coluna Municipal: valor idêntico (validação V06).",
        ], "valor": o["valor"]})

    alvo = None
    for cap in entes.capitais():
        for x in obs:
            if (x["indicador"] == "edu.matriculas.conveniadas_municipais" and x["etapa"] == "total" and x["ano"] == 2025
                    and x["ente"] == cap["cod_ibge"] and x["status"] == "OBSERVADO" and x["valor"] > 0):
                alvo = x
                break
        if alvo:
            break
    if alvo:
        out.append({"indicador": "edu.matriculas.conveniadas_municipais", "ente": alvo["ente"], "nome": nomes[alvo["ente"]], "ano": 2025, "passos": [
            "Mesmo recorte do Censo Escolar 2025 (Tabela_Matricula).",
            f"Escolas com CO_MUNICIPIO = {alvo['ente']}, TP_DEPENDENCIA = 4, IN_PODER_PUBLICO_PARCERIA = 1 e TP_PODER_PUBLICO_PARCERIA = 1: {alvo['escolas']}.",
            f"Soma de QT_MAT_BAS: {alvo['valor']:,}.".replace(",", "."),
            "Conferência com a Sinopse Estatística 2025, tabela 1.3, coluna Município: valor idêntico (validação V06).",
            "Regra de escolha desta trilha: primeira capital em ordem alfabética com valor maior que zero.",
        ], "valor": alvo["valor"]})

    for ind, tipo, col, etapa in (("edu.atu.rede_municipal", "atu", "FUN_AI_CAT_0", "anos_iniciais"),
                                  ("edu.aprovacao.rede_municipal", "rendimento", "1_CAT_FUN_AI", "anos_iniciais")):
        o = _primeira_capital_com_valor(obs, ind, 2025, etapa=etapa)
        if o:
            c = m[f"inep_{tipo}_2025"]
            out.append({"indicador": ind, "ente": o["ente"], "nome": nomes[o["ente"]], "ano": 2025, "passos": [
                f"Pacote oficial {c['url']} (sha256 {c['sha256_original']}; MD5 conferido: {c['md5_conferido']}).",
                f"Planilha {c['membro']}; linha com CO_MUNICIPIO = {o['ente']}, NO_CATEGORIA = Total, NO_DEPENDENCIA = Municipal.",
                f"Coluna {col}: {str(o['valor']).replace('.', ',')}. Valor reproduzido sem recálculo.",
            ], "valor": o["valor"]})

    o = _primeira_capital_com_valor(obs, "edu.ideb.rede_municipal", 2025, etapa="anos_iniciais", componente="ideb")
    if o:
        comp = {x["componente"]: x["valor"] for x in obs if x["indicador"] == "edu.ideb.rede_municipal" and x["ente"] == o["ente"]
                and x["ano"] == 2025 and x["etapa"] == "anos_iniciais"}
        c = m["inep_ideb_ai_2025"]
        out.append({"indicador": "edu.ideb.rede_municipal", "ente": o["ente"], "nome": nomes[o["ente"]], "ano": 2025, "passos": [
            f"Pacote oficial {c['url']} (sha256 {c['sha256_original']}; MD5 conferido: {c['md5_conferido']}).",
            f"Linha com CO_MUNICIPIO = {o['ente']} e REDE = Municipal.",
            f"VL_INDICADOR_REND_2025 (P) = {str(comp.get('p_rendimento')).replace('.', ',')}; VL_NOTA_MEDIA_2025 (N) = {str(comp.get('n_nota_padronizada')).replace('.', ',')}.",
            f"N × P = {str(round(comp['n_nota_padronizada'] * comp['p_rendimento'], 4)).replace('.', ',')}; VL_OBSERVADO_2025 (Ideb publicado) = {str(o['valor']).replace('.', ',')} (validação V11).",
        ], "valor": o["valor"]})
        s = _primeira_capital_com_valor(obs, "edu.saeb.rede_municipal", 2025, etapa="anos_iniciais", componente="matematica")
        if s:
            out.append({"indicador": "edu.saeb.rede_municipal", "ente": s["ente"], "nome": nomes[s["ente"]], "ano": 2025, "passos": [
                "Mesma planilha do Ideb 2025, anos iniciais.",
                f"Linha com CO_MUNICIPIO = {s['ente']} e REDE = Municipal; coluna VL_NOTA_MATEMATICA_2025 = {str(s['valor']).replace('.', ',')}.",
            ], "valor": s["valor"]})
    return out


def fontes():
    m = base.le_manifesto()["capturas"]
    grupos = {
        "siconfi_dca_anexo_i_e": ["siconfi_dca_anexo_i_e"],
        "siconfi_rreo_anexo_02_b6": ["siconfi_rreo_anexo_02_b6"],
        "siconfi_entes": ["siconfi_entes"],
        "ibge_ipca": ["ibge_ipca"],
        "inep_censo": sorted(k for k in m if k.startswith("inep_censo_")),
        "inep_sinopse": sorted(k for k in m if k.startswith("inep_sinopse_")),
        "inep_atu": sorted(k for k in m if k.startswith("inep_atu_")),
        "inep_rendimento": sorted(k for k in m if k.startswith("inep_rendimento_")),
        "inep_ideb": sorted(k for k in m if k.startswith("inep_ideb_")),
    }
    papel = {
        "siconfi_dca_anexo_i_e": "Fonte da despesa liquidada na função Educação e da composição por subfunção.",
        "siconfi_rreo_anexo_02_b6": "Somente conferência cruzada da DCA; nunca somado.",
        "siconfi_entes": "Conferência dos códigos IBGE e da marcação de capital.",
        "ibge_ipca": "Correção monetária opcional para reais de 2025.",
        "inep_censo": "Fonte das matrículas da rede municipal e das escolas privadas conveniadas com o município.",
        "inep_sinopse": "Somente conferência independente das somas dos microdados.",
        "inep_atu": "Fonte da média de alunos por turma.",
        "inep_rendimento": "Fonte da taxa de aprovação.",
        "inep_ideb": "Fonte do Ideb, dos seus componentes e das médias do Saeb.",
    }
    out = []
    for gid, chaves in grupos.items():
        caps = []
        for k in chaves:
            c = dict(m[k])
            c.pop("rotulos_colunas", None)
            if "arquivos" in c:
                arqs = c.pop("arquivos")
                c["arquivos_capturados"] = len(arqs)
                c["arquivos_com_erro"] = sum(1 for a in arqs.values() if "erro" in a)
                c["capturado_em"] = max(a["capturado_em"] for a in arqs.values())
            caps.append({"chave": k, **c})
        out.append({"id": gid, "papel": papel[gid], "capturas": caps})
    return out


CAMPOS_CSV = [
    "indicador_id", "indicador", "codigo_ibge", "capital", "uf", "periodo_tipo", "ano", "etapa", "componente",
    "valor", "unidade", "base_monetaria", "universo", "status", "elegivel_comparacao", "situacao_conferencia",
    "motivo_inelegibilidade", "nota", "nota_material", "participacao_pct", "fonte", "registro",
    "versao_metodologica", "dados_gerados_em", "hash_dados",
]

PERIODO_TIPO = {"exercicios": "exercício financeiro", "censo": "ano do Censo Escolar (referência em maio)",
                "edicoes_ideb": "edição bienal do Ideb/Saeb"}


def _universo(ficha):
    p = ficha["perimetro"]
    return f"{p['territorial']} {p['institucional']} {p['servico']}"


def _csv(obs, caminho, nomes, catalogo, meta):
    """CSV analítico: valor numérico com ponto decimal e precisão da fonte; vazio quando não há valor
    (nunca zero); estado, elegibilidade, conferência, nota, universo, fonte e versão em colunas próprias."""
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    etapas = {e["id"]: e["nome"] for e in catalogo["etapas"]}
    fichas = {i["id"]: i for i in catalogo["indicadores"]}
    ufs = {c: u for c, _, u in entes.CAPITAIS}
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CAMPOS_CSV, lineterminator="\n")
    w.writeheader()
    for o in obs:
        f = fichas[o["indicador"]]
        conf = o.get("conferencia") or {}
        w.writerow({
            "indicador_id": o["indicador"], "indicador": f["nome"], "codigo_ibge": o["ente"], "capital": nomes[o["ente"]],
            "uf": ufs[o["ente"]], "periodo_tipo": PERIODO_TIPO[f["granularidade"]["anos"]], "ano": o["ano"],
            "etapa": etapas.get(o["etapa"], "") if o["etapa"] else "", "componente": o["componente"] or "",
            "valor": "" if o["valor"] is None else repr(o["valor"]) if isinstance(o["valor"], float) else o["valor"],
            "unidade": f["unidade"],
            "base_monetaria": ("R$ de 2025 (IPCA, média anual)" if o["componente"] == "real_2025" else
                               "R$ correntes do exercício" if o["indicador"].startswith("edu.despesa") else ""),
            "universo": _universo(f), "status": o["status"],
            "elegivel_comparacao": "sim" if o.get("elegivel_comparacao") else "nao",
            "situacao_conferencia": conf.get("situacao", ""), "motivo_inelegibilidade": conf.get("motivo_inelegibilidade") or "",
            "nota": o["nota"] or "", "nota_material": "sim" if o.get("nota_material") else "nao",
            "participacao_pct": o.get("participacao", "") if o.get("participacao") is not None else "",
            "fonte": o["fonte"], "registro": o["registro"], "versao_metodologica": f["versao_metodologica"],
            "dados_gerados_em": meta["gerado_em"], "hash_dados": meta["hash_dados"],
        })
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())


def constroi(gerado_em=None):
    catalogo = _catalogo()
    obs = P.todas()
    validacoes = V.todas(obs)
    fatores, medias = P.fatores_ipca()
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    manif = base.le_manifesto()["capturas"]
    capturas = [c.get("capturado_em") for c in manif.values() if c.get("capturado_em")]
    for c in manif.values():
        for a in (c.get("arquivos") or {}).values():
            capturas.append(a.get("capturado_em"))
    gold = {
        "meta": {
            "dominio": base.DOMINIO,
            "painel": catalogo["painel"]["id"],
            "versao_pipeline": base.VERSAO_PIPELINE,
            "versao_catalogo": catalogo["versao_catalogo"],
            "versao_codigo": base.versao_codigo(),
            "gerado_em": gerado_em or base.agora_utc(),
            "dados_capturados_ate": max(c for c in capturas if c),
            "hash_dados": _hash_dados(obs),
            "observacoes": len(obs),
        },
        "painel": catalogo["painel"],
        "universo": {"capitais": entes.capitais(), "excluidos": entes.excluidos(),
                     "regioes": entes.REGIOES},
        "periodos": {"financeiros": P.ANOS_FINANCEIROS, "censo": P.ANOS_CENSO, "ideb": P.EDICOES_IDEB},
        "etapas": catalogo["etapas"],
        "subfuncoes": P.SUBFUNCOES_ROTULO,
        "ipca": {"fatores_para_2025": {str(a): f for a, f in fatores.items()},
                 "media_anual_numero_indice": {str(a): round(v, 4) for a, v in medias.items()}},
        "indicadores": catalogo["indicadores"],
        "cobertura": cobertura(obs, catalogo),
        "validacoes": validacoes,
        "trilhas": trilhas(obs),
        "fontes": fontes(),
        "status": base.STATUS,
        "politica_conferencia": {"versao": CF.VERSAO_POLITICA, "tolerancia_arredondamento_reais": CF.TOL_ARREDONDAMENTO,
                                 "tolerancia_relativa": CF.TOL_RELATIVA, "elegiveis": sorted(CF.ELEGIVEIS),
                                 "rotulos": CF.ROTULO},
        "observacoes": obs,
    }
    return gold


DIAGNOSTICO = os.path.join(base.DADOS, "diagnostico")


def reprovadas(gold):
    return [v["id"] for v in gold["validacoes"] if v["resultado"] == "reprovada"]


def publica(gold, raiz_publica=None):
    """Escreve a gold e as séries. raiz_publica: diretório equivalente a public/ (padrão: o público)."""
    raiz = raiz_publica or os.path.join(base.RAIZ, "public")
    arquivo = os.path.join(raiz, "eficiencia", "gold", "educacao_capitais.json")
    base.grava_json(arquivo, gold)
    catalogo = {"indicadores": gold["indicadores"], "etapas": gold["etapas"]}
    nomes = {c["cod_ibge"]: c["nome"] for c in gold["universo"]["capitais"]}
    for ind in gold["indicadores"]:
        if not ind.get("download"):
            continue
        sel = [o for o in gold["observacoes"] if o["indicador"] == ind["id"]]
        _csv(sel, os.path.join(raiz, ind["download"].lstrip("/")), nomes, catalogo, gold["meta"])
    return arquivo


def promove(gold, raiz_publica=None, diagnostico=None):
    """Gera tudo primeiro numa área de trabalho; só substitui a saída pública se nenhuma validação
    foi reprovada. Com reprovação, o conjunto fica em data/eficiencia/diagnostico para inspeção e a
    saída pública anterior fica intacta. Devolve (promovido, caminho)."""
    import shutil
    import tempfile
    diagnostico = diagnostico or DIAGNOSTICO
    raiz = raiz_publica or os.path.join(base.RAIZ, "public")
    ruins = reprovadas(gold)
    if ruins:
        if os.path.isdir(diagnostico):
            shutil.rmtree(diagnostico)
        caminho = publica(gold, diagnostico)
        return False, caminho
    with tempfile.TemporaryDirectory(dir=os.path.dirname(raiz.rstrip("/")) or None) as tmp:
        publica(gold, tmp)
        for sub in ("gold", "series"):
            origem = os.path.join(tmp, "eficiencia", sub)
            destino = os.path.join(raiz, "eficiencia", sub)
            os.makedirs(destino, exist_ok=True)
            for nome in os.listdir(origem):
                os.replace(os.path.join(origem, nome), os.path.join(destino, nome))
    return True, os.path.join(raiz, "eficiencia", "gold", "educacao_capitais.json")


def resumo_validacoes(gold):
    return [(v["id"], v["resultado"]) for v in gold["validacoes"]]


