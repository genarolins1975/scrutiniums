"""Módulo Perdas de energia na distribuição (painéis P055 a P058, seções 9.13 e 10 da especificação).

O que o módulo publica, por distribuidora (CNPJ da própria fonte) e ano civil:
- volume de perdas totais medidas, técnicas e não técnicas (SAMP Balanço da ANEEL);
- taxas com denominador explícito: perdas totais e técnicas sobre a energia injetada, não
  técnicas sobre o mercado de baixa tensão medido (a base que a ANEEL adotou em 2025);
- o resíduo do balanço (injetada − fornecida − perdas), para que ninguém tome por fechada uma
  conta que a própria fonte não fecha;
- o percentual técnico regulatório implícito no SAMP (razão constante entre revisões);
- o custo unitário das perdas embutido na tarifa residencial B1 de cada processo tarifário
  (componentes tarifárias da ANEEL, R$/MWh, com resolução e vigência);
- a área de atuação como o conjunto dos municípios do IBGE ligados à distribuidora pela
  relação oficial conjunto elétrico × município (ANEEL), cada vínculo conferido contra o
  cadastro de micro e minigeração distribuída; município com mais de uma distribuidora fica
  marcado e nenhum volume ou taxa é rateado por área;
- contexto social agregado (Censo 2022 do IBGE) nos municípios da área, sem causalidade.

O que o módulo não publica, e por quê (bloqueios com evidência no documento do módulo): a
perda não técnica regulatória e o custo total reconhecido em reais de cada processo estão só
em PDF, planilhas e painéis servidos por git.aneel.gov.br, www2.aneel.gov.br,
calculostarifarios.aneel.gov.br e biblioteca.aneel.gov.br, que respondem com desafio do
Cloudflare (HTTP 403, cf-mitigated: challenge) a qualquer cliente sem navegador; o portal
de relatórios responde com conexão encerrada. Não contornamos.
"""
import collections
import io
import json
import os
import sys
import tempfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia.fontes import aneel_perdas as ap  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "perdas.json"
DS_SAMP = "aneel_samp_balanco"
DS_TARIFA = "aneel_componentes_tarifarias_b1"
DS_LIMITES = "aneel_continuidade_limites"
DS_INDQUAL = "aneel_indqual_municipio"
DS_MMGD = "aneel_mmgd_municipio"
DS_IBGE = "ibge_censo2022_municipio"

LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
LICENCA_IBGE = "Dados públicos do IBGE, uso livre com citação da fonte (política de dados abertos do IBGE)"
URL_SAMP = "https://dadosabertos.aneel.gov.br/dataset/samp-balanco"
URL_TARIFA = "https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias"
URL_CONT = "https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec"
URL_INDQUAL = "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio"
URL_MMGD = "https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida"
URL_IBGE = {
    "4714": "https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93%7C6318?localidades=N6[all]",
    "10295": ("https://servicodados.ibge.gov.br/api/v3/agregados/10295/periodos/2022/variaveis/13604%7C13431"
              "?localidades=N6[all]&classificacao=2[6794]%7C86[95251]%7C58[95253]"),
    "localidades": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
}
PAGINA = [{"rotulo": "Perdas", "href": "/setor-eletrico/perdas"}]

CSV_ANUAL = "perdas_distribuidoras.csv"
CSV_MENSAL = "perdas_mensal.csv"
CSV_NACIONAL = "perdas_nacional.csv"
CSV_PT = "perdas_tecnicas_regulatorias.csv"
CSV_TARIFA = "perdas_tarifa_b1.csv"
CSV_MUN = "perdas_municipios.csv"
CSV_CONTEXTO = "perdas_contexto_social.csv"
JSON_ANUAL = "perdas_anual.json"
JSON_MUN = "perdas_municipios.json"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "perdas", "gold": GOLD, "familia": "aneel_distribuicao", "ordem": 40,
    "datasets": [
        {"orgao": "ANEEL", "nome": "samp-balanco", "slug": "aneel-samp-balanco", "dataset_silver": DS_SAMP,
         "titulo": "SAMP: balanço energético das distribuidoras", "estado": "UTILIZADO EM INDICADOR", "url": URL_SAMP,
         "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_ANUAL), _url(CSV_MENSAL), _url(CSV_NACIONAL), _url(CSV_PT)],
         "quebras": [
             {"data": "2024-01-01", "descricao": "Leiaute da REN ANEEL 1.003/2022: linhas por nível de tensão com total próprio; a energia injetada publicada passa a ser bruta e deixa de fechar o balanço nas distribuidoras com geração conectada à rede; perdas técnicas e não técnicas deixam de ser publicadas para cerca de metade das distribuidoras."},
             {"data": "2025-01-01", "descricao": "A ANEEL passa a calcular energia requerida e perdas não técnicas sobre o mercado medido em vez do faturado (Despacho 1.220/2025-STR)."},
         ]},
        {"orgao": "ANEEL", "nome": "componentes-tarifarias", "slug": "aneel-componentes-tarifarias", "dataset_silver": DS_TARIFA,
         "titulo": "Componentes tarifárias da TE e da TUSD", "estado": "UTILIZADO EM INDICADOR", "url": URL_TARIFA,
         "licenca": LICENCA_ANEEL, "paginas": PAGINA, "downloads": [_url(CSV_TARIFA)], "quebras": []},
        {"orgao": "ANEEL", "nome": "indicadores-coletivos-de-continuidade-dec-e-fec", "slug": "aneel-continuidade-dec-fec",
         "dataset_silver": DS_LIMITES, "titulo": "Indicadores coletivos de continuidade (limites por conjunto)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_CONT, "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_MUN)], "quebras": []},
        {"orgao": "ANEEL", "nome": "indqual-municipio", "slug": "aneel-indqual-municipio", "dataset_silver": DS_INDQUAL,
         "titulo": "IndQual Município: conjuntos elétricos e municípios", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_INDQUAL, "licenca": LICENCA_ANEEL, "paginas": PAGINA, "downloads": [_url(CSV_MUN)], "quebras": []},
        {"orgao": "ANEEL", "nome": "relacao-de-empreendimentos-de-geracao-distribuida", "slug": "aneel-mmgd-empreendimentos",
         "dataset_silver": DS_MMGD, "titulo": "Relação de empreendimentos de micro e minigeração distribuída",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_MMGD, "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_MUN)], "quebras": []},
        {"orgao": "IBGE", "nome": "censo-2022-agregados-4714-10295", "slug": "ibge-censo-2022-municipios",
         "dataset_silver": DS_IBGE, "titulo": "Censo Demográfico 2022: população, área e rendimento domiciliar per capita por município",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://sidra.ibge.gov.br/pesquisa/censo-demografico/demografico-2022/inicial",
         "licenca": LICENCA_IBGE, "paginas": PAGINA, "downloads": [_url(CSV_CONTEXTO)], "quebras": []},
    ],
    "arquivos": {
        _url(CSV_ANUAL): "cnpj; sigla; nome; classificacao; ano; meses (competências publicadas no ano); completo (12 meses); injetada_publicada_mwh; injetada_referencia_mwh (denominador; ver origem_injetada); origem_injetada (publicada, requerida ou mista); perdas_totais_mwh (valor medido da fonte); taxa_total_pct (perdas totais ÷ injetada de referência); perdas_tecnicas_mwh (estimativa regulatória publicada pela fonte); taxa_tecnica_pct; pnt_mwh (perdas totais − técnicas, valor medido); pnt_injetada_pct; mercado_bt_mwh (energia medida em BT: cativo, consumo próprio e livre); pnt_bt_pct; perdas_totais_faturado_mwh; taxa_total_faturado_pct; perdas_linha_antiga_mwh (linha antiga Perdas do SAMP, base não identificada pela fonte; nunca somada à série medida); residuo_mwh (injetada publicada − fornecida − irregular − perdas); residuo_pct_injetada; reconciliacao (fecha, residuo_pequeno, residuo_relevante, sem_componentes); alertas. Energia em MWh; percentuais em %. Vazio = ausência (a fonte não publicou o componente em todos os meses do ano); zero é zero.",
        _url(CSV_MENSAL): "cnpj; competencia (AAAA-MM); valores em kWh como publicados no SAMP Balanço: injetada_publicada, injetada_referencia, origem_injetada, representacao (linha usada: todos=niveis, total=niveis, todos, total, niveis), fornecida_medida, outros_requisitos, irregular_faturada, perdas_totais_medidas, perdas_tecnicas, pnt_medidas, perdas_totais_faturadas, pnt_faturadas, perdas_linha_antiga, mercado_bt_medido, mmgd_injetada, residuo, conflitos. Vazio = linha ausente na fonte.",
        _url(CSV_NACIONAL): "ano; universo (concessionarias, permissionarias, todas); completo; n_distribuidoras (agentes com 12 meses e sem alerta físico); injetada_referencia_mwh; perdas_totais_mwh; taxa_total_pct; n_com_tecnica; injetada_com_tecnica_mwh; perdas_tecnicas_mwh; taxa_tecnica_pct; pnt_mwh; mercado_bt_mwh; pnt_bt_pct; excluidos (agentes-ano fora da soma e motivo). Taxas agregadas = 100 × Σ numeradores ÷ Σ denominadores do mesmo subconjunto.",
        _url(CSV_PT): "cnpj; sigla; inicio (AAAA-MM); fim (AAAA-MM); percentual (% da energia injetada, constante no trecho); meses; resolucao_tarifaria (REH cuja vigência começa no mês de transição, quando existe); inicio_vigencia_reh; dia_prorata (dia de início reconstituído da média pró-rata do mês de transição).",
        _url(CSV_TARIFA): "cnpj; sigla; resolucao; inicio_vigencia; fim_vigencia; base (Base Econômica ou Tarifa de Aplicação); tusd_pt; tusd_pnt; tusd_per_rb_d; te_per_rb; perdas (soma das quatro); tusd; te; total (TUSD + TE); participacao_perdas_pct; participacao_pnt_pct. Tarifa residencial B1 convencional, subclasse residencial, R$/MWh nominais, sem tributos.",
        _url(CSV_MUN): "cod_ibge; municipio; uf; cnpj; sigla; conjuntos (identificadores dos conjuntos elétricos que ligam o município à distribuidora); empreendimentos_mmgd (da distribuidora no município); confirmado_mmgd (1 = há ao menos um); distribuidoras_no_municipio; codigo_ibge_valido (1 = existe na lista de municípios do IBGE).",
        _url(CSV_CONTEXTO): "cnpj; sigla; municipios_confirmados; municipios_exclusivos; populacao_confirmados (Censo 2022, municípios inteiros, sem rateio); populacao_exclusivos; cobertura_exclusivos_pct; renda_media_pc_confirmados_rs (média domiciliar per capita, ponderada por moradores); renda_media_pc_exclusivos_rs; area_km2_confirmados.",
        _url(JSON_ANUAL): "Série anual por distribuidora (mesmos campos do CSV anual, em listas), para leitura sob demanda pela página.",
        _url(JSON_MUN): "Município IBGE → distribuidoras ligadas pela relação oficial, com a marca de confirmação pelo cadastro de MMGD; para o mapa.",
    },
}

CAMPOS_MES = ("injetada", "perdas_totais_med", "perdas_tecnicas", "pnt_med", "perdas_totais_fat", "pnt_fat",
              "perdas_legado", "fornecida_med", "outros_requisitos", "irregular", "bt_med", "mmgd", "n_linhas")


# ======================================================================= coleta
def _processados(con):
    con.execute("CREATE TABLE IF NOT EXISTS perdas_processados(dataset TEXT, vintage_id TEXT, processado_em TEXT,"
                " PRIMARY KEY(dataset, vintage_id))")


def _ja_processado(con, ds, vid):
    _processados(con)
    return con.execute("SELECT 1 FROM perdas_processados WHERE dataset=? AND vintage_id=?", (ds, vid)).fetchone() is not None


def _marca(con, ds, vid):
    con.execute("INSERT OR REPLACE INTO perdas_processados VALUES(?,?,?)", (ds, vid, base.agora_utc()))


def _bytes_bronze(v):
    with base.abre_bronze(v["arquivo"]) as f:
        return f.read()


def _processa_samp(con, v):
    import pyarrow as pa
    meses, cadastro, dup = ap.pivota(ap.linhas_parquet(pa.BufferReader(_bytes_bronze(v))))
    obs, regs = [], []
    por_agente = collections.defaultdict(list)
    for (cnpj, comp), d in meses.items():
        por_agente[cnpj].append(d)
    universo = {cnpj for cnpj, ds in por_agente.items() if ap.eh_distribuidora(ds)}
    distribuidoras = set()
    for (cnpj, comp), d in meses.items():
        if cnpj not in universo or not ap.tem_perda(d):
            continue  # só agentes com balanço de distribuição (geradoras antigas ficam fora) e meses com perda
        distribuidoras.add(cnpj)
        m = ap.mes_balanco(d)
        for campo in CAMPOS_MES:
            if m.get(campo) is not None:
                obs.append((f"{campo}.{cnpj}", comp, m[campo]))
        regs.append((f"{cnpj}|{comp}", "injetada_repr", m.get("injetada_repr")))
        regs.append((f"{cnpj}|{comp}", "conflitos", ",".join(m["conflitos"]) or None))
    for cnpj in distribuidoras:
        cad = cadastro[cnpj]
        regs.append((cnpj, "nomes", json.dumps(cad["nomes"], ensure_ascii=False, sort_keys=True)))
        regs.append((cnpj, "classificacoes", json.dumps(cad["classificacoes"], ensure_ascii=False, sort_keys=True)))
    regs.append(("_arquivo", "duplicadas", json.dumps([[a, b, list(k), list(x)] for a, b, k, x in dup], ensure_ascii=False)))
    regs.append(("_arquivo", "agentes_total", str(len(cadastro))))
    regs.append(("_arquivo", "agentes_distribuicao", str(len(distribuidoras))))
    n1 = base.grava_observacoes(con, DS_SAMP, v["vintage_id"], obs)
    n2 = base.grava_registros(con, DS_SAMP, v["vintage_id"], regs)
    return {"observacoes": n1, "registros": n2, "distribuidoras": len(distribuidoras), "duplicadas": len(dup)}


def _processa_tarifa(con, v):
    import pyarrow as pa
    sel = ap.filtra_componentes_b1(ap.linhas_componentes_parquet(pa.BufferReader(_bytes_bronze(v))))
    obs, regs = [], []
    for (cnpj, ini, base_t), e in sel.items():
        ab = "BE" if base_t == "Base Econômica" else "TA"
        for comp, val in e["valores"].items():
            obs.append((f"{ab}.{comp}.{cnpj}", ini, val))
        k = f"{cnpj}|{ini}"
        regs += [(k, "resolucao", e["resolucao"]), (k, "fim", e["fim"]), (k, "sigla", e["sigla"])]
    n1 = base.grava_observacoes(con, DS_TARIFA, v["vintage_id"], obs)
    n2 = base.grava_registros(con, DS_TARIFA, v["vintage_id"], regs)
    return {"processos": len({(a, b) for a, b, _ in sel}), "observacoes": n1, "registros": n2}


def _processa_limites(con, v, hoje):
    regs = []
    for r in ckan.le_csv_bronze(v["arquivo"]):
        try:
            ano = int(str(r.get("AnoLimiteQualidade")).strip())
        except ValueError:
            continue
        if ano < 2018 or ano > hoje.year + 1:
            continue
        k = f"{ano}|{str(r.get('IdeConjUndConsumidoras')).strip()}"
        regs += [(k, "cnpj", str(r.get("NumCNPJ") or "").strip().zfill(14)), (k, "sigla", (r.get("SigAgente") or "").strip() or None),
                 (k, "descricao", (r.get("DscConjUndConsumidoras") or "").strip() or None)]
    n = base.grava_registros(con, DS_LIMITES, v["vintage_id"], regs)
    return {"registros": n, "linhas": len(regs) // 3}


def _processa_indqual(con, v):
    regs = []
    for r in ckan.le_csv_bronze(v["arquivo"]):
        cid = str(r.get("IdeConjUnidConsumidoras") or r.get("IdeConjUndConsumidoras") or "").strip()
        cod = str(r.get("CodMunicipio") or "").strip()
        if cid and cod:
            regs.append((cid, f"mun.{cod}", json.dumps([(r.get("SigUF") or "").strip(), (r.get("NomMunicipio") or "").strip()],
                                                       ensure_ascii=False)))
    n = base.grava_registros(con, DS_INDQUAL, v["vintage_id"], regs)
    return {"registros": n, "vinculos": len(regs)}


def _processa_mmgd(con, v):
    import pyarrow as pa
    cont = ap.contagem_mmgd(ap.linhas_mmgd_parquet(pa.BufferReader(_bytes_bronze(v))))
    obs = [(f"mmgd.{cnpj}", cod, float(n)) for (cnpj, cod), n in cont.items()]
    n = base.grava_observacoes(con, DS_MMGD, v["vintage_id"], obs)
    return {"pares": len(obs), "observacoes": n}


def _processa_ibge(con, vints):
    obs, regs = [], []
    for recurso, v in vints.items():
        corpo = _bytes_bronze(v)
        if recurso == "4714":
            for cod, x in ap.serie_sidra_v3(corpo, 93).items():
                obs.append(("populacao", cod, x))
            for cod, x in ap.serie_sidra_v3(corpo, 6318).items():
                obs.append(("area_km2", cod, x))
        elif recurso == "10295":
            for cod, x in ap.serie_sidra_v3(corpo, 13604).items():
                obs.append(("moradores_dpp", cod, x))
            for cod, x in ap.serie_sidra_v3(corpo, 13431).items():
                obs.append(("renda_media_pc", cod, x))
        elif recurso == "localidades":
            for cod, (nome, uf) in ap.municipios_ibge(corpo).items():
                regs += [(cod, "nome", nome), (cod, "uf", uf)]
    # cada recurso grava na própria vintage (a revisão fica atribuída ao arquivo que a trouxe)
    out = {}
    for recurso, v in vints.items():
        series = {"4714": ("populacao", "area_km2"), "10295": ("moradores_dpp", "renda_media_pc")}.get(recurso, ())
        o = [x for x in obs if x[0] in series]
        if o:
            out[recurso] = base.grava_observacoes(con, DS_IBGE, v["vintage_id"], o)
        if recurso == "localidades" and regs:
            out[recurso] = base.grava_registros(con, DS_IBGE, v["vintage_id"], regs)
    return out


def _coleta_ibge(con, agora_idade_dias=365):
    """IBGE fora do CKAN: mesmo padrão de bronze com sha256 e vintage. O Censo 2022 é estático;
    a recoleta anual só confirma que nada mudou (revisão entraria como vintage nova)."""
    from datetime import datetime, timedelta, timezone
    vints, status = {}, {}
    for recurso, url in URL_IBGE.items():
        ult = base.ultima_vintage(con, DS_IBGE, recurso)
        if ult:
            cap = datetime.fromisoformat(ult["capturado_em"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - cap < timedelta(days=agora_idade_dias):
                vints[recurso] = ult
                status[recurso] = "pulada"
                continue
        fd, tmp = tempfile.mkstemp(prefix="ibge-", suffix=".json")
        os.close(fd)
        try:
            http_download(url, tmp, timeout=180)
            cap = base.agora_utc()
            arq, sha, nb = base.salva_bronze_arquivo("ibge", DS_IBGE, recurso, tmp, "json", cap)
            vid, nova = base.registra_vintage(con, DS_IBGE, recurso, url, cap, None, sha, nb, "coleta_direta", arq)
            base.registra_coleta(con, DS_IBGE, recurso, True, f"{nb} bytes")
            vints[recurso] = base.ultima_vintage(con, DS_IBGE, recurso)
            status[recurso] = "nova" if nova else "identica"
        except Exception as e:  # falha do IBGE fica registrada; a vintage anterior segue valendo
            base.registra_coleta(con, DS_IBGE, recurso, False, str(e)[:300])
            status[recurso] = f"falha: {str(e)[:120]}"
            if ult:
                vints[recurso] = ult
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    con.commit()
    return vints, status


def coletar(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    if ctx.get("sem_rede"):
        return {"ok": True, "detalhe": "execução sem rede: nada coletado"}
    status = {}

    def pacote(nome, ds, filtro, idade):
        st, meta, vints = ckan.coleta_pacote(con, orgao="ANEEL", nome=nome, dataset=ds, filtro_recurso=filtro,
                                             max_idade_dias=idade)
        status[ds] = st
        return vints

    v = pacote("samp-balanco", DS_SAMP, lambda r: (r.get("format") or "").upper() in ("PARQUET", "PDF"), 7)
    for rec, vt in v.items():
        if rec.endswith(".parquet") and not _ja_processado(con, DS_SAMP, vt["vintage_id"]):
            status[f"{DS_SAMP}:processamento"] = _processa_samp(con, vt)
            _marca(con, DS_SAMP, vt["vintage_id"])
            con.commit()
    v = pacote("componentes-tarifarias", DS_TARIFA,
               lambda r: (r.get("format") or "").upper() == "PARQUET" or (r.get("format") or "").upper() == "PDF", 7)
    proc = {}
    for rec, vt in sorted(v.items()):
        if rec.endswith(".parquet") and not _ja_processado(con, DS_TARIFA, vt["vintage_id"]):
            proc[rec] = _processa_tarifa(con, vt)
            _marca(con, DS_TARIFA, vt["vintage_id"])
            con.commit()
    status[f"{DS_TARIFA}:processamento"] = proc
    v = pacote("indicadores-coletivos-de-continuidade-dec-e-fec", DS_LIMITES,
               lambda r: (r.get("name") or "") in ("indicadores-continuidade-coletivos-limite", "Dicionário de dados - Limite"), 30)
    for rec, vt in v.items():
        if rec == "indicadores-continuidade-coletivos-limite" and not _ja_processado(con, DS_LIMITES, vt["vintage_id"]):
            status[f"{DS_LIMITES}:processamento"] = _processa_limites(con, vt, hoje)
            _marca(con, DS_LIMITES, vt["vintage_id"])
            con.commit()
    v = pacote("indqual-municipio", DS_INDQUAL, lambda r: (r.get("format") or "").upper() in ("CSV", "PDF"), 30)
    for rec, vt in v.items():
        if rec == "indqual-municipio" and not _ja_processado(con, DS_INDQUAL, vt["vintage_id"]):
            status[f"{DS_INDQUAL}:processamento"] = _processa_indqual(con, vt)
            _marca(con, DS_INDQUAL, vt["vintage_id"])
            con.commit()
    v = pacote("relacao-de-empreendimentos-de-geracao-distribuida", DS_MMGD,
               lambda r: (r.get("name") or "") == "empreendimento-geracao-distribuida.parquet", 30)
    for rec, vt in v.items():
        if not _ja_processado(con, DS_MMGD, vt["vintage_id"]):
            status[f"{DS_MMGD}:processamento"] = _processa_mmgd(con, vt)
            _marca(con, DS_MMGD, vt["vintage_id"])
            con.commit()
    vints, st_ibge = _coleta_ibge(con)
    status[DS_IBGE] = st_ibge
    novos = {r: vt for r, vt in vints.items() if not _ja_processado(con, DS_IBGE, vt["vintage_id"])}
    if novos:
        status[f"{DS_IBGE}:processamento"] = _processa_ibge(con, vints)
        for vt in vints.values():
            _marca(con, DS_IBGE, vt["vintage_id"])
        con.commit()
    ok = all((s.get("ok", True) if isinstance(s, dict) else True) for s in status.values())
    return {"ok": ok, "detalhe": status}


# ======================================================================= leitura do silver
def _observacoes_vigentes(con, dataset):
    """{(serie, ref): valor} com a vintage mais recente de cada (serie, ref), numa só consulta."""
    out = {}
    for serie, ref, valor in con.execute(
            """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? ORDER BY v.capturado_em, o.rowid""", (dataset,)):
        out[(serie, ref)] = valor
    return out


def _mensal_samp(con):
    obs = _observacoes_vigentes(con, DS_SAMP)
    regs = base.registros_como_estavam_em(con, DS_SAMP)
    mensal = collections.defaultdict(dict)
    for (serie, comp), valor in obs.items():
        campo, cnpj = serie.split(".", 1)
        mensal[cnpj].setdefault(comp, {})[campo] = int(round(valor))
    for cnpj, meses in mensal.items():
        for comp, m in meses.items():
            r = regs.get(f"{cnpj}|{comp}", {})
            m["injetada_repr"] = r.get("injetada_repr")
            m["conflitos"] = [x for x in (r.get("conflitos") or "").split(",") if x]
            ap.deriva_mes(m)
    return dict(mensal), regs


# ======================================================================= construção
def _r(v, casas=0):
    if v is None:
        return None
    return round(v) if casas == 0 else round(v, casas)


def _mwh(kwh):
    return None if kwh is None else kwh / 1000.0


def _nome_sigla(nomes):
    """Nome mais recente publicado pela fonte e sigla (prefixo antes de ' - ', como no SAMP)."""
    atual = max(nomes.items(), key=lambda x: x[1][1])[0]
    if " - " in atual:
        sig, nome = atual.split(" - ", 1)
        return sig.strip(), nome.strip()
    return None, atual.strip()


def _classe(classificacoes):
    atual = max(classificacoes.items(), key=lambda x: x[1][1])[0]
    return atual, ("concessionaria" if atual.startswith("Concession") else "permissionaria")


def _anual_distribuidora(mensal_cnpj, ano):
    a = ap.anual(mensal_cnpj, ano)
    a["completo"] = a["meses"] == 12 and a["meses_perdas_totais_med"] == 12 and a["meses_injetada_ref"] == 12
    a["reconciliacao"] = ap.estado_reconciliacao(a)
    a["alertas"] = ap.validade_anual(a)
    if a["meses_injetada_requerida"] == 0:
        a["origem_injetada"] = "publicada"
    elif a["meses_injetada_requerida"] == a["meses"]:
        a["origem_injetada"] = "requerida"
    else:
        a["origem_injetada"] = "mista"
    den = a["injetada_ref"]
    a["taxa_total"] = ap.taxa(a["perdas_totais_med"], den)
    a["taxa_tecnica"] = ap.taxa(a["perdas_tecnicas"], den)
    a["pnt_injetada"] = ap.taxa(a["pnt_med"], den)
    a["pnt_bt"] = ap.taxa(a["pnt_med"], a["bt_med"])
    a["taxa_total_fat"] = ap.taxa(a["perdas_totais_fat"], den)
    a["residuo_pct"] = ap.taxa(a["residuo"], a["injetada"])
    return a


def _valido_para_agregado(a):
    return a["completo"] and not a["alertas"] and a["injetada_ref"] is not None and a["perdas_totais_med"] is not None


def _nacional(anuais, grupos, anos):
    """Agregados por ano e universo: Σ numeradores ÷ Σ denominadores do mesmo subconjunto."""
    linhas = []
    for ano in anos:
        for universo in ("concessionarias", "permissionarias", "todas"):
            sel = [(cnpj, a) for (cnpj, y), a in anuais.items() if y == ano
                   and (universo == "todas" or grupos.get(cnpj) == universo[:-1])]
            validos = [(cnpj, a) for cnpj, a in sel if _valido_para_agregado(a)]
            if not sel:
                continue
            excl = collections.Counter()
            for cnpj, a in sel:
                if not a["completo"]:
                    excl["ano_incompleto"] += 1
                elif a["alertas"]:
                    excl[a["alertas"][0]] += 1
            inj = sum(a["injetada_ref"] for _, a in validos)
            ptot = sum(a["perdas_totais_med"] for _, a in validos)
            com_pt = [a for _, a in validos if a["perdas_tecnicas"] is not None]
            com_bt = [a for _, a in validos if a["pnt_med"] is not None and a["bt_med"] is not None]
            inj_pt = sum(a["injetada_ref"] for a in com_pt)
            pt = sum(a["perdas_tecnicas"] for a in com_pt)
            pnt = sum(a["pnt_med"] for a in com_bt)
            bt = sum(a["bt_med"] for a in com_bt)
            linhas.append({
                "ano": ano, "universo": universo, "n_distribuidoras": len(validos), "n_publicadas": len(sel),
                "injetada_mwh": _r(_mwh(inj)), "perdas_totais_mwh": _r(_mwh(ptot)),
                "taxa_total_pct": _r(ap.taxa(ptot, inj), 2),
                "n_com_tecnica": len(com_pt), "injetada_com_tecnica_mwh": _r(_mwh(inj_pt)),
                "cobertura_tecnica_pct": _r(ap.taxa(inj_pt, inj), 1),
                "perdas_tecnicas_mwh": _r(_mwh(pt)) if com_pt else None,
                "taxa_tecnica_pct": _r(ap.taxa(pt, inj_pt), 2) if com_pt else None,
                "n_com_pnt_bt": len(com_bt), "pnt_mwh": _r(_mwh(pnt)) if com_bt else None,
                "mercado_bt_mwh": _r(_mwh(bt)) if com_bt else None,
                "pnt_bt_pct": _r(ap.taxa(pnt, bt), 2) if com_bt else None,
                "excluidos": dict(excl),
            })
    return linhas


def _ano_referencia(anuais, hoje):
    """Último ano civil encerrado em que ao menos 90% das distribuidoras com dado no ano têm os
    12 meses publicados; o ano seguinte, se houver dado, é o parcial."""
    por_ano = collections.defaultdict(list)
    for (cnpj, ano), a in anuais.items():
        por_ano[ano].append(a["completo"])
    candidatos = [y for y, v in por_ano.items() if y < hoje.year and v and sum(v) / len(v) >= 0.9]
    ref = max(candidatos) if candidatos else None
    parcial = max(por_ano) if por_ano and max(por_ano) > (ref or 0) else None
    return ref, parcial


def _segmentos_com_reh(mensal_cnpj, processos):
    segs = ap.segmentos_pt(mensal_cnpj)
    inicios = sorted({p["inicio"] for p in processos})
    out = []
    for i, s in enumerate(segs):
        ano, mes = int(s["inicio"][:4]), int(s["inicio"][5:7])
        # mês de transição: o anterior ao início do trecho, quando há trecho antes
        ant = f"{ano - (1 if mes == 1 else 0):04d}-{(12 if mes == 1 else mes - 1):02d}"
        reh, dia = None, None
        cands = [x for x in inicios if x[:7] in (ant, s["inicio"])]
        if cands:
            p = next(p for p in processos if p["inicio"] == cands[-1])
            reh = {"resolucao": p["resolucao"], "inicio_vigencia": p["inicio"]}
        if i > 0 and ant in mensal_cnpj:
            m = mensal_cnpj[ant]
            if m.get("perdas_tecnicas") is not None and m.get("injetada"):
                pct_mes = 100.0 * m["perdas_tecnicas"] / m["injetada"]
                dia = ap.dia_inicio_prorata(pct_mes, segs[i - 1]["pct"], s["pct"], int(ant[:4]), int(ant[5:7]))
        out.append({**s, "reh": reh, "dia_inicio_prorata": dia,
                    "transicao": ant if i > 0 and segs[i - 1]["fim"] < ant else None})
    return out


def _processos_tarifa(con):
    obs = _observacoes_vigentes(con, DS_TARIFA)
    regs = base.registros_como_estavam_em(con, DS_TARIFA)
    proc = collections.defaultdict(lambda: {"valores": {}})
    for (serie, ini), valor in obs.items():
        ab, comp, cnpj = serie.split(".", 2)
        proc[(cnpj, ini, ab)]["valores"][comp] = valor
    por_cnpj = collections.defaultdict(list)
    for (cnpj, ini, ab), e in proc.items():
        r = regs.get(f"{cnpj}|{ini}", {})
        e.update({"cnpj": cnpj, "inicio": ini, "fim": r.get("fim"), "resolucao": r.get("resolucao"),
                  "sigla": r.get("sigla"), "base": "Base Econômica" if ab == "BE" else "Tarifa de Aplicação"})
        e["resumo"] = ap.resumo_tarifa(e)
        por_cnpj[cnpj].append(e)
    for v in por_cnpj.values():
        v.sort(key=lambda e: (e["inicio"], e["base"]))
    return por_cnpj


def _relacao(con, hoje):
    regs_lim = base.registros_como_estavam_em(con, DS_LIMITES)
    anos = sorted({int(k.split("|")[0]) for k in regs_lim if int(k.split("|")[0]) <= hoje.year})
    if not anos:
        return None
    ano = anos[-1]
    limites = [{"AnoLimiteQualidade": str(ano), "IdeConjUndConsumidoras": k.split("|")[1],
                "NumCNPJ": v.get("cnpj"), "SigAgente": v.get("sigla") or ""}
               for k, v in regs_lim.items() if k.startswith(f"{ano}|")]
    regs_iq = base.registros_como_estavam_em(con, DS_INDQUAL)
    indqual = []
    for cid, campos in regs_iq.items():
        for campo, val in campos.items():
            if campo.startswith("mun."):
                uf, nome = json.loads(val)
                indqual.append({"IdeConjUnidConsumidoras": cid, "CodMunicipio": campo[4:], "SigUF": uf, "NomMunicipio": nome})
    vinc, siglas, sem = ap.relacao_municipios(indqual, limites, ano)
    mmgd = {}
    for (serie, cod), n in _observacoes_vigentes(con, DS_MMGD).items():
        mmgd[(serie.split(".", 1)[1], cod)] = int(n)
    return {"ano": ano, "vinculos": vinc, "siglas": siglas, "conjuntos_sem_municipio": sem, "mmgd": mmgd}


def _ibge(con):
    obs = _observacoes_vigentes(con, DS_IBGE)
    series = collections.defaultdict(dict)
    for (serie, cod), v in obs.items():
        series[serie][cod] = v
    regs = base.registros_como_estavam_em(con, DS_IBGE)
    loc = {cod: (r.get("nome"), r.get("uf")) for cod, r in regs.items()}
    return series, loc


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _arquivo_vigente(snap, prefixo=None):
    caps = [x for x in snap.get("capturas", []) if not prefixo or x["recurso"].startswith(prefixo)]
    return caps[-1] if caps else None


def _evidencia(*, valor_exibido, valor_calculo, unidade, periodo, entidade, universo, fonte, captura, formula,
               numerador, denominador, cobertura, testes, reconciliacao, download, chaves, filtros=None,
               exclusoes=None, pesos=None, revisoes=None, tratamento_ausencia=None, reproducao=None):
    return {
        "valor_exibido": valor_exibido, "valor_calculo": valor_calculo, "unidade": unidade, "periodo": periodo,
        "entidade": entidade, "universo": universo, "filtros": filtros or [],
        "fonte": {**fonte, "arquivo": (captura or {}).get("recurso"), "sha256": (captura or {}).get("sha256"),
                  "capturado_em": (captura or {}).get("capturado_em"), "publicado_em": (captura or {}).get("publicado_em")},
        "chaves_origem": chaves, "formula": formula, "numerador": numerador, "denominador": denominador,
        "pesos": pesos, "exclusoes": exclusoes or [], "cobertura": cobertura,
        "tratamento_ausencia": tratamento_ausencia or "Mês sem a linha na fonte deixa a soma anual ausente; nada é completado nem vira zero.",
        "versao": {"pipeline": base.VERSAO_PIPELINE, "codigo": base.versao_codigo(), "publicacao": base.agora_utc()},
        "revisoes": revisoes, "testes": testes, "reconciliacao": reconciliacao, "download": download,
        "reproducao": reproducao or "python3 pipeline/energia/executar_modulo.py perdas --sem-coleta (a partir do silver data/energia/silver/aneel_distribuicao.db); o CSV mensal permite refazer cada soma.",
        "citacao": "Observatório do Setor Elétrico (Scrutinium), módulo Perdas, a partir de ANEEL, SAMP Balanço (dadosabertos.aneel.gov.br/dataset/samp-balanco), acesso em " + base.agora_utc()[:10] + ".",
    }


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    mensal, regs_samp = _mensal_samp(con)
    if not mensal:
        return c.stub(GOLD, "SAMP Balanço ausente no silver da família aneel_distribuicao")
    snap_samp = c.snapshot_de(con, DS_SAMP)
    cap_samp = _arquivo_vigente(snap_samp, "samp-balanco.parquet")
    cadastro = {}
    for cnpj in mensal:
        r = regs_samp.get(cnpj, {})
        nomes = json.loads(r.get("nomes") or "{}")
        classes = json.loads(r.get("classificacoes") or "{}")
        if not nomes or not classes:
            continue
        sig, nome = _nome_sigla(nomes)
        cl, grupo = _classe(classes)
        cadastro[cnpj] = {"sigla": sig, "nome": nome, "nomes": nomes, "classificacao": cl, "grupo": grupo}
    grupos = {cnpj: v["grupo"] for cnpj, v in cadastro.items()}

    # ---------------------------------------------------------------- validação de esquema e domínio
    ultima_comp = max(comp for m in mensal.values() for comp in m)
    cap_mes = (cap_samp or {}).get("capturado_em", base.agora_utc())[:7]
    criticas, ressalvas = [], []
    if ultima_comp > cap_mes:
        criticas.append(f"competência {ultima_comp} posterior ao mês da captura {cap_mes}")
    duplicadas = json.loads(regs_samp.get("_arquivo", {}).get("duplicadas") or "[]")
    if any(d[2][0].startswith("Perdas") or d[2][0] == ap.MOD_INJETADA for d in duplicadas):
        criticas.append("linhas de perdas ou de injetada duplicadas na mesma competência")
    elif duplicadas:
        ressalvas.append(f"{len(duplicadas)} linhas repetidas fora do balanço de distribuição (geradoras antigas); ignoradas")

    anos = sorted({int(comp[:4]) for m in mensal.values() for comp in m})
    anuais = {}
    for cnpj, m in mensal.items():
        if cnpj not in cadastro:
            continue
        for ano in anos:
            if any(k.startswith(f"{ano:04d}-") for k in m):
                anuais[(cnpj, ano)] = _anual_distribuidora(m, ano)
    ano_ref, ano_parcial = _ano_referencia(anuais, hoje)
    if ano_ref is None:
        return c.stub(GOLD, "nenhum ano civil encerrado com ao menos 90% das distribuidoras completas")
    nacional = _nacional(anuais, grupos, anos)
    nac_ref = next(x for x in nacional if x["ano"] == ano_ref and x["universo"] == "concessionarias")
    if not (5 <= (nac_ref["taxa_total_pct"] or 0) <= 30):
        criticas.append(f"taxa nacional {nac_ref['taxa_total_pct']}% fora da faixa física plausível de 5% a 30%")
    if criticas:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticas))
    ultimo_mes_parcial = None
    if ano_parcial:
        ultimo_mes_parcial = max(comp for m in mensal.values() for comp in m if comp.startswith(str(ano_parcial)))

    # ---------------------------------------------------------------- tarifa e percentual técnico
    processos = _processos_tarifa(con)
    snap_tarifa = c.snapshot_de(con, DS_TARIFA)

    # ---------------------------------------------------------------- relação municipal e IBGE
    rel = _relacao(con, hoje)
    ibge, loc = _ibge(con)
    snap_lim, snap_iq, snap_mmgd, snap_ibge = (c.snapshot_de(con, d) for d in (DS_LIMITES, DS_INDQUAL, DS_MMGD, DS_IBGE))
    municipios = {}
    por_dist = collections.defaultdict(lambda: {"confirmados": set(), "nao_confirmados": set()})
    if rel:
        for (cnpj, cod), e in rel["vinculos"].items():
            n = rel["mmgd"].get((cnpj, cod), 0)
            conf = n > 0
            municipios.setdefault(cod, {"uf": e["uf"], "nome": e["nome"], "dist": []})["dist"].append(
                {"cnpj": cnpj, "conjuntos": sorted(e["conjuntos"], key=lambda x: int(x) if x.isdigit() else 0),
                 "mmgd": n, "confirmado": conf})
            por_dist[cnpj]["confirmados" if conf else "nao_confirmados"].add(cod)
    for cod, m in municipios.items():
        m["valido"] = cod in loc if loc else None
        m["n_confirmadas"] = sum(1 for d in m["dist"] if d["confirmado"])

    # ---------------------------------------------------------------- por distribuidora
    distribuidoras, csv_anual, serie_json, csv_pt, eventos = [], [], {}, [], []
    csv_mensal = []
    for cnpj in sorted(cadastro, key=lambda x: (cadastro[x]["sigla"] or cadastro[x]["nome"])):
        cad = cadastro[cnpj]
        m = mensal[cnpj]
        comps = sorted(m)
        linhas_serie = []
        for ano in anos:
            a = anuais.get((cnpj, ano))
            if not a:
                continue
            linha = [cnpj, cad["sigla"], cad["nome"], cad["classificacao"], ano, a["meses"], int(a["completo"]),
                     _mwh(a["injetada"]), _mwh(a["injetada_ref"]), a["origem_injetada"], _mwh(a["perdas_totais_med"]),
                     _r(a["taxa_total"], 3), _mwh(a["perdas_tecnicas"]), _r(a["taxa_tecnica"], 3), _mwh(a["pnt_med"]),
                     _r(a["pnt_injetada"], 3), _mwh(a["bt_med"]), _r(a["pnt_bt"], 3), _mwh(a["perdas_totais_fat"]),
                     _r(a["taxa_total_fat"], 3), _mwh(a["perdas_legado"]), _mwh(a["residuo"]), _r(a["residuo_pct"], 3),
                     a["reconciliacao"], ",".join(a["alertas"])]
            csv_anual.append(linha)
            linhas_serie.append([ano, a["meses"], int(a["completo"]), _r(_mwh(a["injetada_ref"])), _r(_mwh(a["perdas_totais_med"])),
                                 _r(a["taxa_total"], 2), _r(_mwh(a["perdas_tecnicas"])), _r(a["taxa_tecnica"], 2),
                                 _r(_mwh(a["pnt_med"])), _r(a["pnt_bt"], 2), _r(_mwh(a["bt_med"])),
                                 _r(a["residuo_pct"], 2), a["reconciliacao"], a["alertas"], a["origem_injetada"]])
        serie_json[cnpj] = linhas_serie
        for comp in comps:
            x = m[comp]
            csv_mensal.append([cnpj, comp, x.get("injetada"), x.get("injetada_ref"), x.get("injetada_ref_origem"),
                               x.get("injetada_repr"), x.get("fornecida_med"), x.get("outros_requisitos"), x.get("irregular"),
                               x.get("perdas_totais_med"), x.get("perdas_tecnicas"), x.get("pnt_med"),
                               x.get("perdas_totais_fat"), x.get("pnt_fat"), x.get("perdas_legado"), x.get("bt_med"), x.get("mmgd"),
                               x.get("residuo"), ",".join(x.get("conflitos") or [])])
        # ano de referência e comparação com o ano anterior completo
        a = anuais.get((cnpj, ano_ref))
        ref = None
        if a:
            ref = {"ano": ano_ref, "meses": a["meses"], "completo": a["completo"],
                   "injetada_mwh": _r(_mwh(a["injetada_ref"])), "origem_injetada": a["origem_injetada"],
                   "perdas_totais_mwh": _r(_mwh(a["perdas_totais_med"])), "taxa_total_pct": _r(a["taxa_total"], 2),
                   "perdas_tecnicas_mwh": _r(_mwh(a["perdas_tecnicas"])), "taxa_tecnica_pct": _r(a["taxa_tecnica"], 2),
                   "pnt_mwh": _r(_mwh(a["pnt_med"])), "pnt_injetada_pct": _r(a["pnt_injetada"], 2),
                   "mercado_bt_mwh": _r(_mwh(a["bt_med"])), "pnt_bt_pct": _r(a["pnt_bt"], 2),
                   "residuo_pct_injetada": _r(a["residuo_pct"], 2), "reconciliacao": a["reconciliacao"],
                   "alertas": a["alertas"]}
        variacao = None
        ant = anuais.get((cnpj, ano_ref - 1))
        if a and ant and a["completo"] and ant["completo"] and not a["alertas"] and not ant["alertas"]:
            quebra = bool(ant["injetada_ref"]) and abs(a["injetada_ref"] / ant["injetada_ref"] - 1) > 0.30
            variacao = {
                "ano_base": ano_ref - 1,
                "taxa_total_pp": _r((a["taxa_total"] - ant["taxa_total"]) if None not in (a["taxa_total"], ant["taxa_total"]) else None, 2),
                "perdas_totais_pct": _r(ap.taxa(a["perdas_totais_med"] - ant["perdas_totais_med"], ant["perdas_totais_med"]), 1)
                if ant["perdas_totais_med"] and ant["perdas_totais_med"] > 0 else None,
                "pnt_bt_pp": _r((a["pnt_bt"] - ant["pnt_bt"]) if None not in (a["pnt_bt"], ant["pnt_bt"]) else None, 2),
                "quebra_escala": quebra, "atravessa_leiaute": ant["origem_injetada"] != a["origem_injetada"],
            }
        # percentual técnico implícito
        procs_be = [p for p in processos.get(cnpj, []) if p["base"] == "Base Econômica"]
        segs = _segmentos_com_reh(m, procs_be)
        for s in segs:
            csv_pt.append([cnpj, cad["sigla"], s["inicio"], s["fim"], s["pct"], s["meses"],
                           (s["reh"] or {}).get("resolucao"), (s["reh"] or {}).get("inicio_vigencia"), s["dia_inicio_prorata"]])
        # tarifa: processo vigente na data de hoje (ou o mais recente)
        tarifa = None
        vig = [p for p in procs_be if p["resumo"] and p["inicio"] <= hoje.isoformat()]
        if vig:
            p = vig[-1]
            tarifa = {"resolucao": p["resolucao"], "inicio": p["inicio"], "fim": p["fim"],
                      **{k: _r(v, 2) for k, v in p["resumo"].items()},
                      "n_processos": len({x["inicio"] for x in procs_be})}
        # território e contexto
        pd = por_dist.get(cnpj)
        terr, contexto = None, None
        if pd:
            conf = pd["confirmados"]
            excl = {cod for cod in conf if municipios[cod]["n_confirmadas"] == 1}
            ufs = sorted({municipios[cod]["uf"] for cod in conf if municipios[cod]["uf"]})
            ufs_nc = sorted({municipios[cod]["uf"] for cod in pd["nao_confirmados"] if municipios[cod]["uf"]} - set(ufs))
            terr = {"municipios": len(conf | pd["nao_confirmados"]), "confirmados": len(conf), "exclusivos": len(excl),
                    "compartilhados": len(conf - excl), "nao_confirmados": len(pd["nao_confirmados"]),
                    "ufs": ufs, "ufs_so_nao_confirmadas": ufs_nc}
            pop, ren, mor, area = (ibge.get(k, {}) for k in ("populacao", "renda_media_pc", "moradores_dpp", "area_km2"))
            pop_c = sum(pop.get(x, 0) for x in conf if x in pop)
            pop_e = sum(pop.get(x, 0) for x in excl if x in pop)
            rc, nrc = ap.media_ponderada(ren, mor, conf)
            re_, nre = ap.media_ponderada(ren, mor, excl)
            if pop:
                contexto = {"populacao_confirmados": _r(pop_c), "populacao_exclusivos": _r(pop_e),
                            "cobertura_exclusivos_pct": _r(ap.taxa(pop_e, pop_c), 1),
                            "renda_media_pc_confirmados": _r(rc, 2), "renda_media_pc_exclusivos": _r(re_, 2),
                            "municipios_com_renda": nrc, "area_km2_confirmados": _r(sum(area.get(x, 0) for x in conf), 0)}
        # eventos observados na própria fonte (sem inferir destino de incorporações)
        ev = []
        nomes = sorted(cad["nomes"].items(), key=lambda x: x[1][0])
        for (n1, (_, f1)), (n2, (i2, _)) in zip(nomes, nomes[1:]):
            ev.append({"tipo": "mudanca_nome", "competencia": i2, "de": n1, "para": n2})
        if comps[0] > "2003-01":
            ev.append({"tipo": "inicio_serie", "competencia": comps[0]})
        if comps[-1] < ultima_comp[:4] + "-01":
            ev.append({"tipo": "fim_serie", "competencia": comps[-1]})
        for e in ev:
            eventos.append({"cnpj": cnpj, "sigla": cad["sigla"], **e})
        distribuidoras.append({
            "cnpj": cnpj, "cnpj_formatado": entidades.cnpj_formatado(cnpj), "sigla": cad["sigla"], "nome": cad["nome"],
            "classificacao": cad["classificacao"], "grupo": cad["grupo"],
            "primeira_competencia": comps[0], "ultima_competencia": comps[-1],
            "ativa": comps[-1] >= f"{ano_ref}-12", "referencia": ref, "variacao": variacao,
            "tecnica_regulatoria": {"segmentos": segs[-4:], "n_segmentos": len(segs)} if segs else None,
            "tarifa": tarifa, "territorio": terr, "contexto": contexto, "eventos": ev,
        })

    # ---------------------------------------------------------------- associação descritiva (P058)
    xs, ys, zs = [], [], []
    for d in distribuidoras:
        if d["grupo"] != "concessionaria" or not d["referencia"] or not d["contexto"] or d["referencia"]["alertas"]:
            continue
        xs.append(d["contexto"]["renda_media_pc_confirmados"])
        ys.append(d["referencia"]["pnt_bt_pct"])
        zs.append(d["referencia"]["taxa_total_pct"])
    rho_pnt, n_pnt = ap.spearman(xs, ys)
    rho_tot, n_tot = ap.spearman(xs, zs)

    # ---------------------------------------------------------------- arquivos de download
    base.escreve_csv(CSV_ANUAL, ["cnpj", "sigla", "nome", "classificacao", "ano", "meses", "completo", "injetada_publicada_mwh",
                                 "injetada_referencia_mwh", "origem_injetada", "perdas_totais_mwh", "taxa_total_pct",
                                 "perdas_tecnicas_mwh", "taxa_tecnica_pct", "pnt_mwh", "pnt_injetada_pct", "mercado_bt_mwh",
                                 "pnt_bt_pct", "perdas_totais_faturado_mwh", "taxa_total_faturado_pct", "perdas_linha_antiga_mwh", "residuo_mwh",
                                 "residuo_pct_injetada", "reconciliacao", "alertas"], csv_anual)
    base.escreve_csv(CSV_MENSAL, ["cnpj", "competencia", "injetada_publicada_kwh", "injetada_referencia_kwh", "origem_injetada",
                                  "representacao", "fornecida_medida_kwh", "outros_requisitos_kwh", "irregular_faturada_kwh",
                                  "perdas_totais_medidas_kwh", "perdas_tecnicas_kwh", "pnt_medidas_kwh",
                                  "perdas_totais_faturadas_kwh", "pnt_faturadas_kwh", "perdas_linha_antiga_kwh", "mercado_bt_medido_kwh",
                                  "mmgd_injetada_kwh", "residuo_kwh", "conflitos"], csv_mensal)
    base.escreve_csv(CSV_NACIONAL, ["ano", "universo", "completo", "n_distribuidoras", "n_publicadas", "injetada_referencia_mwh",
                                    "perdas_totais_mwh", "taxa_total_pct", "n_com_tecnica", "injetada_com_tecnica_mwh",
                                    "perdas_tecnicas_mwh", "taxa_tecnica_pct", "n_com_pnt_bt", "pnt_mwh", "mercado_bt_mwh",
                                    "pnt_bt_pct", "excluidos"],
                     [[x["ano"], x["universo"], int(x["ano"] <= ano_ref), x["n_distribuidoras"], x["n_publicadas"], x["injetada_mwh"],
                       x["perdas_totais_mwh"], x["taxa_total_pct"], x["n_com_tecnica"], x["injetada_com_tecnica_mwh"],
                       x["perdas_tecnicas_mwh"], x["taxa_tecnica_pct"], x["n_com_pnt_bt"], x["pnt_mwh"], x["mercado_bt_mwh"],
                       x["pnt_bt_pct"], json.dumps(x["excluidos"], ensure_ascii=False)] for x in nacional])
    base.escreve_csv(CSV_PT, ["cnpj", "sigla", "inicio", "fim", "percentual", "meses", "resolucao_tarifaria",
                              "inicio_vigencia_reh", "dia_prorata"], csv_pt)
    linhas_tarifa = []
    for cnpj, procs in sorted(processos.items()):
        for p in procs:
            v = p["valores"]
            res = p["resumo"] or {}
            linhas_tarifa.append([cnpj, p["sigla"], p["resolucao"], p["inicio"], p["fim"], p["base"], v.get("TUSD_PT"),
                                  v.get("TUSD_PNT"), v.get("TUSD_Per_RB_D"), v.get("TE_Per_RB"), res.get("perdas"),
                                  v.get("TUSD"), v.get("TE"), res.get("total"), _r(res.get("participacao_perdas_pct"), 3),
                                  _r(res.get("participacao_pnt_pct"), 3)])
    base.escreve_csv(CSV_TARIFA, ["cnpj", "sigla", "resolucao", "inicio_vigencia", "fim_vigencia", "base", "tusd_pt", "tusd_pnt",
                                  "tusd_per_rb_d", "te_per_rb", "perdas", "tusd", "te", "total", "participacao_perdas_pct",
                                  "participacao_pnt_pct"], linhas_tarifa)
    sig = {x["cnpj"]: x["sigla"] for x in distribuidoras}
    linhas_mun = []
    for cod in sorted(municipios):
        mm = municipios[cod]
        for d in mm["dist"]:
            linhas_mun.append([cod, (loc.get(cod) or (mm["nome"],))[0] or mm["nome"], mm["uf"], d["cnpj"],
                               sig.get(d["cnpj"]) or (rel or {}).get("siglas", {}).get(d["cnpj"]),
                               " ".join(d["conjuntos"]), d["mmgd"], int(d["confirmado"]), len(mm["dist"]),
                               "" if mm["valido"] is None else int(mm["valido"])])
    base.escreve_csv(CSV_MUN, ["cod_ibge", "municipio", "uf", "cnpj", "sigla", "conjuntos", "empreendimentos_mmgd",
                               "confirmado_mmgd", "distribuidoras_no_municipio", "codigo_ibge_valido"], linhas_mun)
    base.escreve_csv(CSV_CONTEXTO, ["cnpj", "sigla", "municipios_confirmados", "municipios_exclusivos", "populacao_confirmados",
                                    "populacao_exclusivos", "cobertura_exclusivos_pct", "renda_media_pc_confirmados_rs",
                                    "renda_media_pc_exclusivos_rs", "area_km2_confirmados"],
                     [[d["cnpj"], d["sigla"], d["territorio"]["confirmados"], d["territorio"]["exclusivos"],
                       d["contexto"]["populacao_confirmados"], d["contexto"]["populacao_exclusivos"],
                       d["contexto"]["cobertura_exclusivos_pct"], d["contexto"]["renda_media_pc_confirmados"],
                       d["contexto"]["renda_media_pc_exclusivos"], d["contexto"]["area_km2_confirmados"]]
                      for d in distribuidoras if d["territorio"] and d["contexto"]])
    idx = {x["cnpj"]: i for i, x in enumerate(distribuidoras)}
    base.escreve_gold(JSON_ANUAL, {
        "gerado_em": base.agora_utc(), "unidades": "MWh e %",
        "campos": ["ano", "meses", "completo", "injetada_mwh", "perdas_totais_mwh", "taxa_total_pct", "perdas_tecnicas_mwh",
                   "taxa_tecnica_pct", "pnt_mwh", "pnt_bt_pct", "mercado_bt_mwh", "residuo_pct_injetada", "reconciliacao",
                   "alertas", "origem_injetada"],
        "distribuidoras": serie_json}, destino=base.SERIES)
    base.escreve_gold(JSON_MUN, {
        "gerado_em": base.agora_utc(), "ano_relacao": (rel or {}).get("ano"),
        "distribuidoras": [x["cnpj"] for x in distribuidoras],
        "campos": ["indice_distribuidora", "confirmado_mmgd"],
        "municipios": {cod: {"uf": mm["uf"], "valido": mm["valido"],
                             "d": [[idx[d["cnpj"]], int(d["confirmado"])] for d in mm["dist"] if d["cnpj"] in idx]}
                       for cod, mm in sorted(municipios.items())},
    }, destino=base.SERIES)

    # ---------------------------------------------------------------- proveniência
    fonte_samp = _fonte("ANEEL", "SAMP - Balanço", "samp-balanco.parquet (Parquet oficial, equivalente ao samp-balanco.csv)",
                        URL_SAMP, (cap_samp or {}).get("url") or URL_SAMP, LICENCA_ANEEL)
    fonte_samp["url_primaria"] = next((v["url"] for v in base.vintages_do_dataset(con, DS_SAMP)
                                       if v["recurso"] == "samp-balanco.parquet"), URL_SAMP)
    meta_samp = ckan.meta_local(DS_SAMP)
    cap = c.ultima_captura(snap_samp)
    per = {"inicio": min(k for m in mensal.values() for k in m), "fim": ultima_comp}
    lim_samp = [
        "Perdas técnicas publicadas no SAMP são estimativas regulatórias (percentual fixado na revisão tarifária aplicado à energia injetada), não medição; a parcela não técnica é a diferença entre a perda total e essa estimativa.",
        "A partir de 2024 (leiaute da REN 1.003/2022) a fonte deixou de publicar a separação técnica e não técnica para cerca de metade das distribuidoras e a energia injetada publicada passou a ser bruta; o denominador desses meses é a energia implícita no cálculo da própria fonte (fornecida + irregular + perdas), e a série tem quebra em 2024.",
        "Valores mensais oscilam com o calendário de leitura dos medidores; só o ano civil completo é comparado.",
        "Perdas medidas (base adotada pela ANEEL em 2025) diferem das faturadas: o faturado inclui o custo de disponibilidade e a compensação da MMGD.",
    ]
    prov = {
        "volumes": c.proveniencia(
            indicador="Perdas de energia na distribuição por distribuidora", natureza="OBSERVADO", fonte=fonte_samp,
            unidade="MWh", frequencia="mensal (publicação); anual (comparação)", periodo=per, cobertura=per,
            capturado_em=cap, snapshot=snap_samp, limitacoes=lim_samp, download=_url(CSV_ANUAL),
            transformacoes=["kWh → MWh (÷ 1.000)", "soma dos 12 meses do ano civil; ano com mês ausente fica ausente"],
            notas_fonte=meta_samp.get("notas")),
        "taxas": c.proveniencia(
            indicador="Taxas de perdas com denominador explícito", natureza="CALCULADO", fonte=fonte_samp, unidade="%",
            frequencia="anual", periodo={"inicio": str(anos[0]), "fim": str(ano_ref)}, cobertura=per, capturado_em=cap,
            snapshot=snap_samp, download=_url(CSV_ANUAL),
            transformacoes=["taxa total e técnica = 100 × Σ perdas ÷ Σ energia injetada de referência do ano",
                            "não técnica sobre BT = 100 × Σ perdas não técnicas medidas ÷ Σ mercado BT medido (cativo, consumo próprio e livre)",
                            "agregados: 100 × Σ numeradores ÷ Σ denominadores do mesmo subconjunto de distribuidoras"],
            formula="taxa_total = 100 × perdas_totais ÷ injetada_referência; pnt_bt = 100 × (perdas_totais − perdas_técnicas) ÷ mercado_BT_medido",
            limitacoes=lim_samp + ["Mercado BT separado por nível de tensão só existe a partir de 2010; antes disso a taxa não técnica sobre BT é ausente."]),
        "reconciliacao": c.proveniencia(
            indicador="Resíduo do balanço energético (injetada − fornecida − irregular − perdas)", natureza="CALCULADO",
            fonte=fonte_samp, unidade="MWh e % da injetada publicada", frequencia="mensal e anual", periodo=per, cobertura=per,
            capturado_em=cap, snapshot=snap_samp, download=_url(CSV_MENSAL),
            formula="resíduo = injetada publicada − (cativo + consumo próprio + suprimento + livre + uso por distribuidoras + contratos antigos) − irregular − perdas totais medidas",
            transformacoes=["representação de cada grandeza escolhida pela concordância com a soma dos níveis de tensão do mesmo mês"],
            limitacoes=["O resíduo mostra quanto da perda publicada não é explicado pelas linhas publicadas; não é atribuído a nenhuma causa.",
                        "Tolerância de fechamento: 1 kWh por linha do arquivo (os valores são inteiros em kWh)."]),
        "tecnica_regulatoria": c.proveniencia(
            indicador="Percentual de perdas técnicas implícito no SAMP", natureza="CALCULADO", fonte=fonte_samp,
            unidade="% da energia injetada", frequencia="por trecho de vigência", periodo=per, cobertura=per, capturado_em=cap,
            snapshot=snap_samp, download=_url(CSV_PT),
            formula="percentual = 100 × perdas técnicas ÷ energia injetada publicada, arredondado a 0,001 p.p.; trecho = meses consecutivos com o mesmo valor",
            limitacoes=["Só existe onde a fonte aplica um percentual fixo (a partir de 2016, na maior parte das distribuidoras); antes disso a razão varia mês a mês.",
                        "É a referência técnica que a própria fonte usou; comparar perda técnica publicada com esse percentual não mede desempenho (é igual por construção).",
                        "A referência regulatória de perdas não técnicas não está em base aberta acessível (ver bloqueios)."]),
        "tarifa": c.proveniencia(
            indicador="Custo unitário das perdas na tarifa residencial B1", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Componentes Tarifárias", "componentes-tarifarias-AAAA.parquet (2012 a 2026)", URL_TARIFA,
                         URL_TARIFA, LICENCA_ANEEL),
            unidade="R$/MWh (nominal, sem tributos)", frequencia="por processo tarifário", periodo={"inicio": "2012-01-01", "fim": hoje.isoformat()},
            cobertura={"inicio": "2012-01-01", "fim": hoje.isoformat()}, capturado_em=c.ultima_captura(snap_tarifa), snapshot=snap_tarifa,
            download=_url(CSV_TARIFA),
            transformacoes=["filtro: subgrupo B1, modalidade convencional, subclasse residencial, sem detalhe, base econômica",
                            "perdas = TUSD_PT + TUSD_PNT + TUSD_Per_RB_D + TE_Per_RB; participação = perdas ÷ (TUSD + TE)"],
            limitacoes=["É o valor por MWh que a tarifa residencial recupera, não o custo total reconhecido em reais no processo (planilha do processo inacessível, ver bloqueios).",
                        "Valores nominais: comparação entre anos sofre efeito da inflação e do preço da energia.",
                        "Não é o custo das perdas reais: é o nível regulatório reconhecido."]),
        "territorio": c.proveniencia(
            indicador="Área de atuação por municípios e vínculos confirmados", natureza="CALCULADO",
            fonte=_fonte("ANEEL", "IndQual Município e limites de continuidade por conjunto",
                         "indqual-municipio.csv; indicadores-continuidade-coletivos-limite.csv; empreendimento-geracao-distribuida.parquet",
                         URL_INDQUAL, URL_CONT, LICENCA_ANEEL),
            unidade="municípios", frequencia="relação vigente", periodo={"inicio": str((rel or {}).get("ano")), "fim": str((rel or {}).get("ano"))},
            cobertura={"inicio": str((rel or {}).get("ano")), "fim": str((rel or {}).get("ano"))},
            capturado_em=c.ultima_captura(snap_iq), snapshot=snap_iq, download=_url(CSV_MUN),
            formula="vínculo (distribuidora, município) = conjunto elétrico do ano com a distribuidora nos limites de continuidade e o município no IndQual; confirmado quando há ao menos um empreendimento de MMGD da distribuidora no município",
            limitacoes=["Não há polígono oficial de área de concessão acessível: SIGEL sem resposta e o polígono da BDGD (entidade ARAT) só em File Geodatabase por distribuidora e ano, sem biblioteca para lê-lo no ambiente; a área é desenhada pelos municípios inteiros do IBGE.",
                        "Município com mais de uma distribuidora aparece em todas, marcado como compartilhado; nenhum volume ou taxa é distribuído entre municípios.",
                        "A relação oficial tem erros evidentes de código (municípios homônimos de outra UF); o vínculo sem confirmação no cadastro de MMGD fica marcado, não é apagado."]),
        "contexto": c.proveniencia(
            indicador="População e renda domiciliar per capita dos municípios da área", natureza="CALCULADO",
            fonte=_fonte("IBGE", "Censo Demográfico 2022, tabelas 4714 e 10295", "API de agregados v3 (N6, todos os municípios)",
                         "https://sidra.ibge.gov.br/tabela/10295", URL_IBGE["10295"], LICENCA_IBGE),
            unidade="pessoas e R$ de 2022 por mês", frequencia="censitária (2022)", periodo={"inicio": "2022-08-01", "fim": "2022-08-01"},
            cobertura={"inicio": "2022-08-01", "fim": "2022-08-01"}, capturado_em=c.ultima_captura(snap_ibge), snapshot=snap_ibge,
            download=_url(CSV_CONTEXTO),
            formula="renda média da área = Σ(renda média per capita do município × moradores) ÷ Σ moradores, sobre os municípios confirmados (ou só os exclusivos)",
            limitacoes=["Municípios inteiros, inclusive os atendidos só em parte; o total exclusivo mostra quanto da população está em municípios de uma só distribuidora.",
                        "Censo de 2022 comparado com perdas de outro ano: é contexto, não explicação.",
                        "Associação entre renda e perdas não é causa, e perda não técnica não é atribuída às famílias da área."]),
    }

    # ---------------------------------------------------------------- evidências dos números principais
    snap_hist = snap_samp.get("revisoes")
    testes_build = [
        {"nome": "identidade_do_balanco", "resultado": "executado",
         "detalhe": f"{sum(1 for a in anuais.values() if a['completo'] and a['reconciliacao'] == 'fecha')} agentes-ano completos fecham dentro do arredondamento; "
                    f"{sum(1 for a in anuais.values() if a['completo'] and a['reconciliacao'] == 'residuo_relevante')} têm resíduo acima de 0,1% da injetada (publicados com o resíduo)."},
        {"nome": "limites_fisicos", "resultado": "aprovado",
         "detalhe": f"taxa nacional {nac_ref['taxa_total_pct']}% dentro de 5% a 30%; {sum(1 for a in anuais.values() if a['alertas'])} agentes-ano com alerta físico ficaram fora dos agregados."},
        {"nome": "horizonte_temporal", "resultado": "aprovado", "detalhe": f"última competência {ultima_comp} não excede o mês da captura {cap_mes}."},
    ]
    evid_nac = _evidencia(
        valor_exibido=f"{nac_ref['taxa_total_pct']:.1f}%".replace(".", ","), valor_calculo=nac_ref["taxa_total_pct"], unidade="%",
        periodo=str(ano_ref), entidade="Concessionárias de distribuição (Brasil)",
        universo=f"{nac_ref['n_distribuidoras']} concessionárias com os 12 meses de {ano_ref} e sem alerta físico",
        fonte=fonte_samp, captura=cap_samp,
        formula="100 × Σ perdas totais medidas ÷ Σ energia injetada de referência",
        numerador={"descricao": "Σ perdas totais medidas (MWh)", "valor": nac_ref["perdas_totais_mwh"]},
        denominador={"descricao": "Σ energia injetada de referência (MWh)", "valor": nac_ref["injetada_mwh"]},
        cobertura=f"{nac_ref['n_distribuidoras']} de {nac_ref['n_publicadas']} concessionárias com dado em {ano_ref}",
        exclusoes=[f"{k}: {v}" for k, v in nac_ref["excluidos"].items()],
        testes=testes_build,
        reconciliacao={"descricao": "Em 2024, a soma da energia injetada de referência das concessionárias é comparada ao intervalo implícito nos números da ANEEL (44,6 TWh = 7,4% e 40,2 TWh = 6,6% da injetada).",
                       "resultado": _reconc_2024(nacional), "tolerancia": "intervalo decorrente do arredondamento a uma casa decimal dos percentuais publicados"},
        download=[{"rotulo": "Série nacional (CSV)", "url": _url(CSV_NACIONAL)}, {"rotulo": "Por distribuidora e ano (CSV)", "url": _url(CSV_ANUAL)}],
        chaves=[f"SAMP Balanço: modalidade '{ap.MOD_PERDA_MED}', característica '{ap.CCT_TOTAIS}', ano {ano_ref}"], revisoes=snap_hist)
    evid_pnt = _evidencia(
        valor_exibido=f"{nac_ref['pnt_bt_pct']:.1f}%".replace(".", ",") if nac_ref["pnt_bt_pct"] is not None else "sem dado",
        valor_calculo=nac_ref["pnt_bt_pct"], unidade="% do mercado de baixa tensão medido", periodo=str(ano_ref),
        entidade="Concessionárias com separação técnica e não técnica publicada",
        universo=f"{nac_ref['n_com_pnt_bt']} concessionárias", fonte=fonte_samp, captura=cap_samp,
        formula="100 × Σ perdas não técnicas medidas ÷ Σ mercado BT medido",
        numerador={"descricao": "Σ perdas não técnicas medidas (MWh)", "valor": nac_ref["pnt_mwh"]},
        denominador={"descricao": "Σ mercado de baixa tensão medido (MWh)", "valor": nac_ref["mercado_bt_mwh"]},
        cobertura=f"{nac_ref['n_com_pnt_bt']} de {nac_ref['n_distribuidoras']} concessionárias válidas publicam a separação em todos os meses de {ano_ref}",
        testes=testes_build, reconciliacao=None,
        download=[{"rotulo": "Por distribuidora e ano (CSV)", "url": _url(CSV_ANUAL)}],
        chaves=[f"SAMP Balanço: '{ap.CCT_NAO_TECNICAS}' (valor medido) e linhas '{ap.MEDIDA} - {ap.BT}'"], revisoes=snap_hist)
    for d in distribuidoras:
        rf = d["referencia"]
        if not rf or rf["taxa_total_pct"] is None:
            continue
        d["evidencia"] = {
            "formula": "100 × perdas totais medidas ÷ energia injetada de referência",
            "numerador": {"descricao": f"perdas totais medidas {ano_ref} (MWh)", "valor": rf["perdas_totais_mwh"]},
            "denominador": {"descricao": f"energia injetada de referência {ano_ref} (MWh, {rf['origem_injetada']})", "valor": rf["injetada_mwh"]},
            "chaves_origem": [f"SAMP Balanço, CNPJ {d['cnpj']}, competências {ano_ref}-01 a {ano_ref}-12"],
            "reconciliacao": {"descricao": "Resíduo do balanço do ano", "resultado": rf["reconciliacao"],
                              "tolerancia": "1 kWh por linha; 0,1% da injetada para resíduo pequeno"},
        }

    # ---------------------------------------------------------------- bloqueios e decisões
    bloqueios = [
        {"item": "Perda não técnica regulatória e custo total reconhecido em reais por processo tarifário (P057, P058)",
         "tentativas": ["https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/relatorioseindicadores/tarifaeconomico/Relatorio_Perdas_Energia.pdf",
                        "https://calculostarifarios.aneel.gov.br/lista-publica (memórias de cálculo PCAT)",
                        "https://www2.aneel.gov.br/cedoc/ (resoluções homologatórias e PRORET 2.6)",
                        "https://portalrelatorios.aneel.gov.br/luznatarifa/perdasenergias (painel Perdas de Energia)",
                        "https://biblioteca.aneel.gov.br/acervo/detalhe/257294",
                        "dadosabertos.aneel.gov.br: busca por perdas, PNT, perdas regulatórias (só SAMP Balanço, subsídios e BDGD)"],
         "evidencia": "30/09/2026: HTTP 403 com cabeçalho cf-mitigated: challenge (desafio do Cloudflare) nos quatro primeiros hosts; portalrelatorios.aneel.gov.br encerra a conexão (curl 35).",
         "dependencia": "Recurso aberto da ANEEL com os percentuais regulatórios homologados (técnico e não técnico) e o valor reconhecido por processo, ou liberação de acesso automatizado aos hosts acima."},
        {"item": "Polígono oficial da área de concessão ou permissão (P055)",
         "tentativas": ["https://sigel.aneel.gov.br/ (portal e serviços ArcGIS)", "EPE WebMap (gisepeprd2.epe.gov.br): nenhuma camada de áreas de distribuição",
                        "BDGD (dadosabertos-aneel.opendata.arcgis.com): entidade ARAT dentro de 1.012 File Geodatabases por distribuidora e ano"],
         "evidencia": "30/09/2026: SIGEL com conexão encerrada; BDGD exige leitor de File Geodatabase (GDAL indisponível no ambiente) e download de centenas de MB por distribuidora.",
         "dependencia": "GDAL no ambiente do pipeline para extrair a entidade ARAT da BDGD mais recente de cada distribuidora, ou camada oficial de áreas no SIGEL acessível."},
    ]
    decisoes = [
        "Área desenhada como o conjunto dos municípios do IBGE ligados à distribuidora pela relação oficial conjunto × município (IndQual Município + limites de continuidade do ano), vínculo a vínculo, sem polígono inventado.",
        "Denominador das taxas: energia injetada publicada no leiaute antigo; no leiaute de 2024, a energia implícita no cálculo da própria fonte (fornecida + irregular + perdas).",
        "Base medida (não faturada) como principal, a mesma que a ANEEL adotou a partir de 2025; a faturada segue no CSV para comparação.",
        "Agregados só com distribuidoras de ano completo e sem alerta físico; as excluídas aparecem contadas por motivo.",
    ]
    # comparação informativa com o relatório da ANEEL (edição 2025/2024), obtido por cópia de terceiro
    rel2024 = next((x for x in nacional if x["ano"] == 2024 and x["universo"] == "concessionarias"), None)
    comparacao_relatorio = {
        "documento": "ANEEL/STR, Perdas de Energia Elétrica na Distribuição, edição 2025/2024 (16 p., extração do SAMP de maio de 2025)",
        "acesso": "Original em git.aneel.gov.br bloqueado por desafio do Cloudflare; cópia de terceiro (agenciainfra.com, sha256 58d6da5b4edd06f4cf3e2c6c6627a166404de17ad90e81b838a39c139d6aa706) usada só para conferência, não como fonte de número publicado.",
        "valores_relatorio": {"taxa_total_pct": 14.0, "perdas_tecnicas_twh": 44.6, "taxa_tecnica_pct": 7.4, "pnt_twh": 40.2,
                              "pnt_injetada_pct": 6.6, "mercado_bt_faturado_sobre_injetada_pct": 41.4, "base": "faturada"},
        "valores_observatorio": {"taxa_total_pct": (rel2024 or {}).get("taxa_total_pct"),
                                 "injetada_twh": _r((rel2024 or {}).get("injetada_mwh", 0) / 1e6, 1) if rel2024 else None,
                                 "base": "medida"},
        "leitura": "A injetada de referência de 2024 cai no intervalo implícito no relatório; a taxa total medida fica acima da faturada do relatório porque o mercado faturado inclui o custo de disponibilidade (a própria ANEEL registra essa diferença ao migrar para o mercado medido em 2025).",
    }

    nac_parcial = next((x for x in nacional if x["ano"] == ano_parcial and x["universo"] == "concessionarias"), None)
    gold = {
        **c.cabecalho(GOLD),
        "referencia": {"ano": ano_ref, "ano_parcial": ano_parcial, "ultima_competencia": ultima_comp,
                       "ultima_competencia_parcial": ultimo_mes_parcial,
                       "aviso_parcial": f"{ano_parcial} tem dados até {c.mes_br(ultimo_mes_parcial)} e não entra em comparações com anos completos." if ano_parcial else None},
        "definicoes": DEFINICOES,
        "nacional": nacional,
        "nacional_parcial": nac_parcial,
        "distribuidoras": distribuidoras,
        "associacao": {"variavel_territorial": "renda média domiciliar per capita (Censo 2022) dos municípios confirmados",
                       "spearman_pnt_bt": _r(rho_pnt, 3), "n_pnt_bt": n_pnt, "spearman_taxa_total": _r(rho_tot, 3), "n_taxa_total": n_tot,
                       "universo": f"concessionárias com ano {ano_ref} válido e território identificado",
                       "leitura": "Associação descritiva entre áreas, não causa: renda municipal média não descreve cada unidade consumidora e perdas dependem também de gestão, rede e fiscalização."},
        "mapa": {"ano_relacao": (rel or {}).get("ano"), "municipios": len(municipios),
                 "municipios_compartilhados": sum(1 for m in municipios.values() if m["n_confirmadas"] > 1),
                 "vinculos": sum(len(m["dist"]) for m in municipios.values()),
                 "vinculos_nao_confirmados": sum(1 for m in municipios.values() for d in m["dist"] if not d["confirmado"]),
                 "codigos_invalidos": sorted(cod for cod, m in municipios.items() if m["valido"] is False),
                 "conjuntos_sem_municipio": (rel or {}).get("conjuntos_sem_municipio", []),
                 "geometria": "public/energia/geo/municipios.json (malha municipal do IBGE, gerada por pipeline/energia/geo.py)",
                 "arquivo": _url(JSON_MUN),
                 "regra": "Cor da área = valor da distribuidora (nunca repartido entre municípios); município compartilhado aparece com marca própria; vínculo não confirmado aparece só com contorno."},
        "eventos": eventos,
        "qualidade": {
            "agentes_no_arquivo": int(regs_samp.get("_arquivo", {}).get("agentes_total") or 0),
            "agentes_com_balanco_de_distribuicao": len(cadastro),
            "agentes_ano_completos": sum(1 for a in anuais.values() if a["completo"]),
            "reconciliacao": dict(collections.Counter(a["reconciliacao"] for a in anuais.values() if a["completo"])),
            "alertas": dict(collections.Counter(x for a in anuais.values() for x in a["alertas"])),
            "linhas_duplicadas_ignoradas": len(duplicadas), "ressalvas": ressalvas,
            "comparacao_relatorio_aneel": comparacao_relatorio,
        },
        "bloqueios": bloqueios, "decisoes": decisoes,
        "proveniencia": prov,
        "evidencias": {"taxa_nacional": evid_nac, "pnt_bt_nacional": evid_pnt},
        "downloads": [
            {"rotulo": "Perdas por distribuidora e ano (CSV)", "url": _url(CSV_ANUAL)},
            {"rotulo": "Balanço mensal por distribuidora, para auditoria (CSV)", "url": _url(CSV_MENSAL)},
            {"rotulo": "Série nacional por universo (CSV)", "url": _url(CSV_NACIONAL)},
            {"rotulo": "Percentual técnico regulatório implícito (CSV)", "url": _url(CSV_PT)},
            {"rotulo": "Componentes de perdas na tarifa B1 (CSV)", "url": _url(CSV_TARIFA)},
            {"rotulo": "Municípios e distribuidoras (CSV)", "url": _url(CSV_MUN)},
            {"rotulo": "Contexto social por distribuidora (CSV)", "url": _url(CSV_CONTEXTO)},
        ],
        "series": {"anual": _url(JSON_ANUAL), "municipios": _url(JSON_MUN)},
    }
    return gold


def _reconc_2024(nacional):
    x = next((n for n in nacional if n["ano"] == 2024 and n["universo"] == "concessionarias"), None)
    if not x or x["injetada_mwh"] is None:
        return "sem dado de 2024"
    twh = x["injetada_mwh"] / 1e6
    # 44,6 TWh a 7,35%–7,45% e 40,2 TWh a 6,55%–6,65% (arredondamento de uma casa)
    lo = max(44.6 / 0.0745, 40.2 / 0.0665)
    hi = min(44.6 / 0.0735, 40.2 / 0.0655)
    ok = lo <= twh <= hi
    return f"{'aprovado' if ok else 'divergente'}: {twh:.1f} TWh; intervalo implícito [{lo:.1f}; {hi:.1f}] TWh"


DEFINICOES = {
    "perdas_totais": "Energia injetada na rede da distribuidora que não chega a ser entregue como consumo medido: diferença calculada pela ANEEL no SAMP Balanço (valor medido).",
    "perdas_tecnicas": "Parcela atribuída às leis da física (aquecimento de cabos e transformadores). No SAMP é o percentual regulatório da revisão tarifária aplicado à energia injetada: estimativa, não medição.",
    "perdas_nao_tecnicas": "Perdas totais menos as técnicas. Incluem furto, fraude, erros de medição, leitura e faturamento; a fonte não separa essas causas. Pode ser negativa quando a estimativa técnica supera a perda total medida.",
    "energia_injetada": "Energia inserida na rede para atender aos consumidores, incluindo as perdas. Denominador das taxas total e técnica.",
    "mercado_bt": "Energia medida entregue a consumidores de baixa tensão (cativos, consumo próprio e livres). Denominador da taxa não técnica, como na regulação da ANEEL.",
    "residuo": "Diferença entre a energia injetada publicada e a soma de energia fornecida, irregular e perdas. Mostra o que a fonte não explica; não é outra perda.",
    "tecnica_regulatoria": "Percentual de perdas técnicas sobre a energia injetada fixado na revisão tarifária, lido da própria série do SAMP onde ela é constante.",
    "custo_tarifa": "Parte da tarifa residencial B1 (sem tributos) que remunera perdas técnicas, não técnicas e na Rede Básica, em R$/MWh, por processo tarifário.",
}
