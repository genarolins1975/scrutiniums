"""Módulo Expansão da oferta e da rede (painéis P040 a P043).

Perguntas e regras publicadas:

- Carteira (P040): o parque do SIGA separado por estágio (em operação; em construção;
  outorgado com construção não iniciada) e os encerramentos de outorga (revogação e
  extinção) registrados nos atos da ANEEL desde 2015. Outorga não é capacidade que
  certamente entrará: o desfecho observado das usinas que passaram pelo RALIE desde
  junho de 2021 (entraram em operação, tiveram a outorga encerrada, seguem em
  implantação ou saíram do acompanhamento sem desfecho identificado) é publicado ao
  lado da carteira. MW de potência não é energia firme.
- Cronograma (P041): atraso só com data-base conhecida. O RALIE publica fotografias
  históricas desde 17/06/2021 (campo DatRalie); cada previsão comparada tem a data da
  fotografia em que foi registrada. Nenhuma promessa antiga é reconstruída com o
  estoque atual. A partir da primeira captura deste observatório, cada coleta do RALIE
  atual também fica no silver (registros por usina e por unidade geradora).
- Rede (P042): leilões de transmissão e obras do SIGET com km, MVA, MW e reais em
  campos separados; nenhuma soma entre unidades diferentes.
- Cenários (P043): PDE 2035 (EPE/MME), selo CENÁRIO, edição, data-base e hipóteses;
  realizado, carteira e cenário em camadas distintas.
"""
import json
import os
import sys
import tempfile
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia.fontes import aneel_expansao as ax  # noqa: E402
from pipeline.energia.fontes import ckan, epe_pde  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "expansao.json"
FAMILIA = "aneel_geracao"
ROTA = "/setor-eletrico/expansao"
PAGINAS = [{"rotulo": "Expansão", "href": ROTA}]
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
LICENCA_EPE = "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), conforme o rodapé do portal da EPE"

DS_SIGA = "aneel_siga"
DS_RALIE = "aneel_ralie"
DS_LIB = "aneel_liberacao_comercial"
DS_ATOS = "aneel_atos_outorga_geracao"
DS_LEILOES = "aneel_leiloes_transmissao"
DS_SIGET = "aneel_siget"
DS_AGREG = "aneel_capacidade_agregada"
DS_PDE = "epe_pde"

URL_SIGA = "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel"
URL_RALIE = "https://dadosabertos.aneel.gov.br/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica"
URL_LIB = "https://dadosabertos.aneel.gov.br/dataset/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao"
URL_ATOS = "https://dadosabertos.aneel.gov.br/dataset/atos-de-outorgas-de-geracao"
URL_LEILOES = "https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes"
URL_SIGET = "https://dadosabertos.aneel.gov.br/dataset/sistema-de-gestao-da-transmissao-siget"
URL_CAP_UF = "https://dadosabertos.aneel.gov.br/dataset/capacidade-instalada-por-unidade-da-federacao"
URL_EMP_OP = "https://dadosabertos.aneel.gov.br/dataset/empreendimentos-em-operacao"
URL_PDE_PAGINA = "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/plano-decenal-de-expansao-de-energia-2035"
URL_PDE_DADOS = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/"
                 "PDE%202035_Dados_Relat%C3%B3rio%20Final.zip")
URL_PDE_RELATORIO = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/"
                     "PDE%202035_Relat%C3%B3rio%20Final_Aprovado.pdf")

# Conjuntos CKAN e recursos exatos (nome do arquivo na URL). intervalo_dias: menor
# intervalo entre downloads; recursos que a ANEEL regrava todo dia (SIGA diário,
# SIGET) mudariam de sha256 diariamente só pela data de geração, então são
# capturados no máximo uma vez por semana.
CONJUNTOS = [
    {"dataset": DS_SIGA, "nome": "siga-sistema-de-informacoes-de-geracao-da-aneel", "intervalo_dias": 7,
     "arquivos": ["siga-empreendimentos-geracao-diario.csv"]},
    {"dataset": DS_RALIE, "nome": "ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica",
     "intervalo_dias": 1,
     "arquivos": ["ralie-usina-atual.csv", "ralie-unidade-geradora-atual.csv", "ralie-leilao-atual.csv",
                  "ralie-usina-historico.parquet", "ralie-unidade-geradora-historico.parquet"]},
    {"dataset": DS_LIB, "nome": "liberacao-para-operacao-comercial-de-empreendimentos-de-geracao", "intervalo_dias": 1,
     "arquivos": ["unidades-geradoras-liberadas-operacao-comercial-detalhado.csv",
                  "unidades-geradoras-liberadas-operacao-comercial-resumido.csv"]},
    {"dataset": DS_ATOS, "nome": "atos-de-outorgas-de-geracao", "intervalo_dias": 1,
     "arquivos": ["atos-outorgas-aneel.csv"]},
    {"dataset": DS_LEILOES, "nome": "resultado-de-leiloes", "intervalo_dias": 1,
     "arquivos": ["resultado-leiloes-transmissao.csv"]},
    {"dataset": DS_SIGET, "nome": "sistema-de-gestao-da-transmissao-siget", "intervalo_dias": 7,
     "arquivos": ["siget-contrato-empreendimento-obra-modulo.csv", "siget-resolucao-empreendimento-obra-modulo.csv",
                  "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv",
                  "siget-contrato-moduloequipamento-subestacao.csv"]},
    {"dataset": DS_AGREG, "nome": "capacidade-instalada-por-unidade-da-federacao", "intervalo_dias": 1,
     "arquivos": ["capacidade-instalada-geracao-uf.csv"]},
    {"dataset": DS_AGREG, "nome": "empreendimentos-em-operacao", "intervalo_dias": 1,
     "arquivos": ["empreendimento-operacao-historico.csv"]},
]
# Fora do CKAN: caderno de dados, página e relatório do PDE 2035 (edição fixa).
EPE_RECURSOS = [
    {"recurso": "pde2035_dados_relatorio_final.zip", "url": URL_PDE_DADOS, "ext": "zip"},
    {"recurso": "pde2035_pagina.html", "url": URL_PDE_PAGINA, "ext": "html"},
    {"recurso": "pde2035_relatorio_final_aprovado.pdf", "url": URL_PDE_RELATORIO, "ext": "pdf"},
]

DOWNLOADS = {
    "usinas": "/energia/series/expansao_usinas_siga.csv",
    "pontos": "/energia/series/expansao_usinas_pontos.json",
    "carteira": "/energia/series/expansao_carteira_ralie.csv",
    "unidades": "/energia/series/expansao_unidades_ralie.csv",
    "trajetorias": "/energia/series/expansao_trajetorias_ralie.csv",
    "confiabilidade": "/energia/series/expansao_confiabilidade_previsoes.csv",
    "liberacoes": "/energia/series/expansao_liberacoes_anuais.csv",
    "encerramentos": "/energia/series/expansao_encerramentos_outorga.csv",
    "leiloes": "/energia/series/expansao_leiloes_transmissao.csv",
    "obras": "/energia/series/expansao_obras_transmissao.csv",
    "pde": "/energia/series/expansao_pde2035.csv",
    "capacidade_uf": "/energia/series/expansao_capacidade_uf_fonte.csv",
}

REGISTRO = {
    "id": "expansao", "gold": GOLD, "familia": FAMILIA, "ordem": 30,
    "datasets": [
        {"orgao": "ANEEL", "nome": "siga-sistema-de-informacoes-de-geracao-da-aneel", "slug": "aneel-siga",
         "dataset_silver": DS_SIGA, "titulo": "SIGA: empreendimentos de geração por fase",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SIGA, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["usinas"], DOWNLOADS["pontos"], DOWNLOADS["capacidade_uf"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica",
         "slug": "aneel-ralie", "dataset_silver": DS_RALIE,
         "titulo": "RALIE: acompanhamento da expansão da oferta de geração (atual e histórico desde jun/2021)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_RALIE, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["carteira"], DOWNLOADS["unidades"], DOWNLOADS["trajetorias"],
                       DOWNLOADS["confiabilidade"]],
         "quebras": [{"data": "2021-06-17", "descricao": "Primeira fotografia do histórico publicado do RALIE; antes dela não há previsão com data-base em dados abertos."}]},
        {"orgao": "ANEEL", "nome": "liberacao-para-operacao-comercial-de-empreendimentos-de-geracao",
         "slug": "aneel-liberacao-operacao-comercial", "dataset_silver": DS_LIB,
         "titulo": "Liberação para operação comercial de unidades geradoras", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_LIB, "licenca": LICENCA_ANEEL, "paginas": PAGINAS, "downloads": [DOWNLOADS["liberacoes"]],
         "quebras": [{"data": "2014-01-01", "descricao": "Antes de 2014 o arquivo detalhado não cobre toda a potência liberada no ano (nota do dicionário de dados da ANEEL)."}]},
        {"orgao": "ANEEL", "nome": "atos-de-outorgas-de-geracao", "slug": "aneel-atos-outorgas-geracao",
         "dataset_silver": DS_ATOS, "titulo": "Atos de outorgas de geração (revogações e extinções desde 2015)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_ATOS, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["encerramentos"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "resultado-de-leiloes", "slug": "aneel-resultado-leiloes",
         "dataset_silver": DS_LEILOES, "titulo": "Resultado de leilões de transmissão (desde 1999)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_LEILOES, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["leiloes"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "sistema-de-gestao-da-transmissao-siget", "slug": "aneel-siget",
         "dataset_silver": DS_SIGET, "titulo": "SIGET: empreendimentos, obras e módulos de transmissão",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SIGET, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["obras"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "capacidade-instalada-por-unidade-da-federacao", "slug": "aneel-capacidade-uf",
         "dataset_silver": DS_AGREG, "titulo": "Capacidade instalada por UF (usada para reconciliar o SIGA)",
         "estado": "INTEGRADO", "url": URL_CAP_UF, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [], "quebras": []},
        {"orgao": "ANEEL", "nome": "empreendimentos-em-operacao", "slug": "aneel-empreendimentos-operacao",
         "dataset_silver": DS_AGREG, "titulo": "Empreendimentos em operação por tipo (usado para reconciliar o SIGA)",
         "estado": "INTEGRADO", "url": URL_EMP_OP, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [], "quebras": []},
        {"orgao": "EPE", "nome": "pde-2035", "slug": "epe-pde-2035", "dataset_silver": DS_PDE,
         "titulo": "Plano Decenal de Expansão de Energia 2035: caderno de dados do relatório final",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_PDE_PAGINA, "licenca": LICENCA_EPE, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["pde"]], "formatos": ["XLSX", "PDF"],
         "descricao": "Planilhas por capítulo do PDE 2035 (aprovado pela Portaria MME nº 923/2026). Cenário de planejamento, nunca realizado.",
         "quebras": []},
    ],
    "arquivos": {
        DOWNLOADS["usinas"]: "nucleo_ceg; ceg; nome; tipo; origem; fonte; fase (SIGA); estagio; outorga; uf; municipios; lat; lon (grau decimal, vazio = não informado ou 0 na fonte); kw_outorgado; kw_fiscalizado; entrada_operacao (vazio = sem data, inclui o marcador 1900-01-03 do SIGA); garantia_fisica_kwmed (vazio = sem garantia física registrada); vigencia_inicio; vigencia_fim; cnpjs_proprietarios (14 dígitos, separados por |)",
        DOWNLOADS["pontos"]: "JSON colunar com as usinas do SIGA que têm coordenada oficial: nucleo, nome, tipo, estagio, uf, mw_outorgado, mw_fiscalizado, lat, lon",
        DOWNLOADS["capacidade_uf"]: "uf; tipo; origem; usinas; mw_fiscalizado; mw_outorgado (usinas do SIGA na fase Operação, atribuídas à UF principal)",
        DOWNLOADS["carteira"]: "usinas do RALIE atual: nucleo_ceg; ceg; nome; tipo; uf; kw_outorgado; kw_ugs_em_implantacao; ugs; situacao_obra; viabilidade; situacao_cronograma; justificativa_previsao; previsao_min; previsao_max (previsão SFG de operação comercial das unidades); outorgado_max; atraso_previsto_dias (previsao_max menos outorgado_max; vazio sem previsão); leiloes; fase_siga",
        DOWNLOADS["unidades"]: "unidades geradoras do RALIE atual: nucleo_ceg; ug; tipo; uf; kw; comercial_outorgado; previsao_sfg (vazio = sem previsão da fiscalização); teste_realizado",
        DOWNLOADS["trajetorias"]: "usinas que passaram pelo RALIE desde jun/2021: nucleo_ceg; ceg; nome; tipo; uf; primeira_fotografia; ultima_fotografia; kw_outorgado_primeira; previsao_primeira; outorgado_primeira; previsao_ultima; outorgado_ultima; mudancas_previsao; ugs_primeira; ugs_primeira_liberadas; kw_primeira_liberado; ultima_liberacao; desfecho; data_encerramento",
        DOWNLOADS["confiabilidade"]: "ralie; fim_janela; tipo (TOTAL ou tipo de geração); ugs; kw_prometido; kw_no_prazo; kw_depois; kw_nao_liberado; ugs_excluidas_ja_liberadas",
        DOWNLOADS["liberacoes"]: "ano; tipo; ugs; kw_liberado; kw_com_atraso; mediana_atraso_dias_ponderada (liberação comercial realizada menos data outorgada, ponderada por kW)",
        DOWNLOADS["encerramentos"]: "publicacao; encerramento (revogacao ou extincao); nucleo_ceg; ceg; nome; tipo; uf; mw (potência declarada no ato); assunto; ato; numero; agente",
        DOWNLOADS["leiloes"]: "ano; data; leilao; lote; empreendimento; uf; prazo_meses; km; mva; investimento_rs; rap_edital_rs; rap_vencedor_rs; desagio_pct; vencedor (reais nominais da data do leilão)",
        DOWNLOADS["obras"]: "empreendimento; empreendimento_ons; nome; situacao; oper_ato_legal; oper_efetiva; atraso_dias (efetiva menos ato legal); prazo_legal_vencido; km_lt; mva_tr; ufs; obras; origem_resolucao",
        DOWNLOADS["pde"]: "figura; titulo; referencia (ano ou mês); serie; valor; unidade (PDE 2035, CENÁRIO)",
    },
}

INTEGRADOR_VERSAO = "1"
DS_INTEGRACAO = "_integracao_expansao"
MESES_JANELA = 12


# ================================================================== coleta

def _ultima_coleta_ok(con, dataset, recurso):
    row = con.execute("SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND recurso=? AND ok=1",
                      (dataset, recurso)).fetchone()
    if not row or not row[0]:
        return None
    return datetime.fromisoformat(row[0].replace("Z", "+00:00"))


def _baixa_conjunto(con, cj, baixar_meta=http_get, baixador=http_download, agora=None):
    """Baixa os recursos escolhidos de um conjunto CKAN da ANEEL. Recurso ausente do
    pacote é registrado como falha (drift de catálogo visível)."""
    agora = agora or datetime.now(timezone.utc)
    ds = cj["dataset"]
    st = {"conjunto": cj["nome"], "dataset": ds, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    try:
        pac = ckan.pacote("ANEEL", cj["nome"], baixar=baixar_meta)
    except Exception as e:
        base.registra_coleta(con, ds, "*", False, f"package_show {cj['nome']}: {e}")
        con.commit()
        st["falhas"].append(f"package_show: {str(e)[:200]}")
        return st
    meta = ckan.metadados(pac, "ANEEL")
    base.escreve_gold(f"_meta_{ds}__{cj['nome']}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    achados = set()
    for r in pac.get("resources", []):
        arq = (r.get("url") or "").rsplit("/", 1)[-1]
        if arq not in cj["arquivos"]:
            continue
        achados.add(arq)
        ultima = base.ultima_vintage(con, ds, arq)
        ok_em = _ultima_coleta_ok(con, ds, arq)
        if ultima and ok_em and agora - ok_em < timedelta(days=cj["intervalo_dias"]):
            st["puladas"] += 1
            continue
        ext = arq.rsplit(".", 1)[-1].lower()
        res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=ds, recurso=arq, url=r["url"],
                                  publicado_em=r.get("last_modified") or r.get("metadata_modified"), ext=ext,
                                  max_idade_dias=30, baixador=baixador)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{arq}: {res['detalhe']}")
        time.sleep(0.3)
    for arq in sorted(set(cj["arquivos"]) - achados):
        base.registra_coleta(con, ds, arq, False, "recurso ausente do package_show")
        st["falhas"].append(f"{arq}: ausente do package_show")
    con.commit()
    return st


def _baixa_epe(con, baixador=http_download):
    st = {"dataset": DS_PDE, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    for rec in EPE_RECURSOS:
        # edição publicada e aprovada: o conteúdo não muda; conferência mensal basta
        res = ckan.baixar_recurso(con, orgao="EPE", dataset=DS_PDE, recurso=rec["recurso"], url=rec["url"],
                                  publicado_em=None, ext=rec["ext"], max_idade_dias=30, baixador=baixador)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{rec['recurso']}: {res['detalhe']}")
    return st


def _integrado(con, vid):
    row = con.execute("SELECT valor FROM registros WHERE dataset=? AND chave=? AND campo='versao'",
                      (DS_INTEGRACAO, vid)).fetchone()
    return bool(row) and row[0] == INTEGRADOR_VERSAO


def _marca_integrado(con, vid, detalhe):
    con.execute("DELETE FROM registros WHERE dataset=? AND chave=?", (DS_INTEGRACAO, vid))
    con.executemany("INSERT INTO registros VALUES(?,?,?,?,?)",
                    [(DS_INTEGRACAO, vid, "versao", INTEGRADOR_VERSAO, vid),
                     (DS_INTEGRACAO, vid, "integrado_em", base.agora_utc(), vid),
                     (DS_INTEGRACAO, vid, "detalhe", json.dumps(detalhe, ensure_ascii=False)[:2000], vid)])


def _fmt(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(round(v, 6))
    if isinstance(v, (list, tuple, dict)):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


def _grava_estado(con, dataset, vid, prefixo, estado):
    """Grava o estado completo de um recurso em registros: chaves presentes com seus
    campos; chaves conhecidas com o prefixo que sumiram do arquivo têm os campos
    apagados ('' pela semântica de base.grava_registros), o que preserva a data em que
    a unidade saiu da fonte (ex.: entrou em operação e deixou o RALIE)."""
    conhecidos = {k: v for k, v in base.registros_como_estavam_em(con, dataset).items() if k.startswith(prefixo)}
    linhas = []
    for k, campos in estado.items():
        ch = f"{prefixo}{k}"
        for campo, v in campos.items():
            linhas.append((ch, campo, _fmt(v)))
        for campo in conhecidos.get(ch, {}):
            if campo not in campos:
                linhas.append((ch, campo, None))
    atuais = {f"{prefixo}{k}" for k in estado}
    for ch, campos in conhecidos.items():
        if ch not in atuais:
            linhas.extend((ch, campo, None) for campo in campos)
    return base.grava_registros(con, dataset, vid, linhas)


def _compacto(reg, historicos=()):
    """Registro compacto para o silver: os campos cuja revisão importa para as análises
    (ex.: previsão de operação comercial) ficam como campos próprios, com histórico por
    captura; os demais vão num único campo 'dados' (JSON). Um campo por atributo
    multiplicaria por 20 as linhas do silver sem ganho: mudança em qualquer atributo
    também fica registrada, porque o JSON muda."""
    out = {h: reg.get(h) for h in historicos}
    resto = {k: v for k, v in reg.items() if k not in historicos and v is not None}
    out["dados"] = json.dumps(resto, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return out


def _le_csv(v):
    return ckan.le_csv_bronze(v["arquivo"])


def _bytes_bronze(v):
    with base.abre_bronze(v["arquivo"]) as f:
        return f.read()


def _integra(con, ds, rec, v):
    """Leva a vintage `v` do recurso `rec` para o silver. Idempotente."""
    if rec == "siga-empreendimentos-geracao-diario.csv":
        usinas, oc = ax.le_siga(_le_csv(v))
        est = {str(k): _compacto({**u, "cnpjs": "|".join(x for x in ax.cnpjs_de_proprietarios(u["proprietarios"]) if x) or None},
                                 ("fase",))
               for k, u in usinas.items()}
        r = _grava_estado(con, ds, v["vintage_id"], "usina:", est)
        oc["duplicadas_divergentes"] = oc["duplicadas_divergentes"][:50]
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", k, _fmt(x)) for k, x in oc.items()])
        return {"usinas": len(usinas), "registros": r}
    if rec == "ralie-usina-atual.csv":
        us, datas = ax.le_ralie_usina(_le_csv(v))
        r = _grava_estado(con, ds, v["vintage_id"], "usina:",
                          {str(k): _compacto(x, ("situacao_obra", "viabilidade", "situacao_cronograma"))
                           for k, x in us.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "datas_ralie", _fmt(datas)),
                                                        (f"meta:{rec}", "linhas", str(len(us)))])
        return {"usinas": len(us), "datas": datas, "registros": r}
    if rec == "ralie-unidade-geradora-atual.csv":
        ugs, datas = ax.le_ralie_ug(_le_csv(v))
        # tipo e UF são da usina (mesmo núcleo) e não se repetem por unidade no silver
        r = _grava_estado(con, ds, v["vintage_id"], "ug:",
                          {f"{k[0]}:{k[1]}": _compacto({kk: vv for kk, vv in x.items() if kk not in ("tipo", "uf")},
                                                       ("previsao_sfg",))
                           for k, x in ugs.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "datas_ralie", _fmt(datas)),
                                                        (f"meta:{rec}", "linhas", str(len(ugs)))])
        return {"ugs": len(ugs), "datas": datas, "registros": r}
    if rec == "ralie-leilao-atual.csv":
        le = ax.le_ralie_leilao(_le_csv(v))
        r = _grava_estado(con, ds, v["vintage_id"], "leilao:",
                          {f"{k[0]}:{k[1]}": {"inicio_suprimento": d, "presente": "1"} for k, d in le.items()})
        return {"vinculos": len(le), "registros": r}
    if rec == "ralie-usina-historico.parquet":
        pf = ax.abre_parquet(_bytes_bronze(v))
        h = ax.agrega_historico_usina(pf)
        linhas = []
        for d, dims in h.items():
            for dim, vals in dims.items():
                for val, x in vals.items():
                    linhas.append((f"usina.kw_outorgado.{dim}.{val}", d, round(x["kw"], 3)))
                    linhas.append((f"usina.n.{dim}.{val}", d, float(x["n"])))
        r = base.grava_observacoes(con, ds, v["vintage_id"], linhas)
        return {"fotografias": len(h), "observacoes": r}
    if rec == "ralie-unidade-geradora-historico.parquet":
        pf = ax.abre_parquet(_bytes_bronze(v))
        h = ax.agrega_historico_ug(pf)
        linhas = []
        for d, tipos in h.items():
            for t, x in tipos.items():
                # soma em ponto flutuante feita em paralelo pelo pyarrow varia na última
                # casa entre execuções: arredondar a 1 W evita "revisões" espúrias
                linhas.append((f"ug.kw.{t}", d, round(x["kw"], 3)))
                linhas.append((f"ug.n.{t}", d, float(x["n"])))
                linhas.append((f"ug.kw_sem_previsao.{t}", d, round(x["kw_sem_previsao"], 3)))
        r = base.grava_observacoes(con, ds, v["vintage_id"], linhas)
        return {"fotografias": len(h), "observacoes": r}
    if rec == "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv":
        linhas, _, nao = ax.le_liberacao(_le_csv(v))
        # uma chave por usina (núcleo do CEG) com a lista das liberações: nome, CEG e
        # origem ficam no SIGA; aqui só o que a análise usa. Linhas repetidas da fonte
        # (mesma unidade e mesma data) são preservadas como linhas distintas.
        est = {}
        for x in linhas:
            if x["nucleo"] is None or x["comercial_realizado"] is None:
                continue
            u = est.setdefault(str(x["nucleo"]), {"tipo": x["tipo"], "uf": x["uf"],
                                                  "si": 1 if (x["sistema"] or "").startswith("Sistemas Isolados") else 0,
                                                  "ugs": []})
            u["ugs"].append([x["ug_bruto"], x["kw"], x["comercial_outorgado"], x["comercial_realizado"]])
        for u in est.values():
            u["ugs"].sort(key=lambda z: (z[3] or "", str(z[0])))
        r = _grava_estado(con, ds, v["vintage_id"], "lib:", {k: _compacto(x) for k, x in est.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "nao_vinculadas", _fmt(nao)),
                                                        (f"meta:{rec}", "linhas", str(len(linhas)))])
        return {"linhas": len(linhas), "usinas": len(est), "registros": r}
    if rec == "unidades-geradoras-liberadas-operacao-comercial-resumido.csv":
        res = ax.le_liberacao_resumida(_le_csv(v))
        linhas = [(f"resumido.{t}", ano, val) for ano, tipos in res.items() for t, val in tipos.items()]
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "atos-outorgas-aneel.csv":
        enc = ax.le_encerramentos(_le_csv(v))
        est = {}
        for x in enc:
            ident = x["nucleo"] if x["nucleo"] is not None else (x["ceg"] or x["nome"] or "?")
            k = f"{ident}:{x['publicacao']}:{x['objeto']}:{x['numero'] or ''}"
            est[k] = x
        return {"encerramentos": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "enc:", {k: _compacto(x) for k, x in est.items()})}
    if rec == "resultado-leiloes-transmissao.csv":
        lotes = ax.le_leiloes_transmissao(_le_csv(v))
        est = {}
        for x in lotes:
            k = f"{x['leilao']}:{x['lote']}"
            n = 2
            while k in est:  # lote repetido na fonte: mantém as duas linhas, com sufixo
                k = f"{x['leilao']}:{x['lote']}#{n}"
                n += 1
            est[k] = x
        return {"lotes": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "lote:", {k: _compacto(x) for k, x in est.items()})}
    if rec == "siget-contrato-empreendimento-obra-modulo.csv":
        ob = ax.le_siget_obras(_le_csv(v))
        # uma chave por empreendimento, com a lista de obras × módulos; a descrição longa
        # da obra fica no bronze
        est = {}
        for (obra, mdl), x in ob.items():
            e = est.setdefault(x["empreendimento"] or f"sem:{obra}", {
                k: x[k] for k in ("contrato", "empreendimento_ons", "nome_empreendimento", "situacao_empreendimento",
                                  "oper_efetiva_empreendimento", "conclusao_ato_legal", "oper_ato_legal")})
            e.setdefault("obras", []).append([obra, mdl, x["situacao_obra"], x["tipo_obra"], x["oper_obra"],
                                              x["tipo_modulo"], x["modulo"]])
        for e in est.values():
            e["obras"].sort(key=lambda z: (z[0], z[1]))
        return {"obras_modulos": len(ob), "empreendimentos": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "epd:",
                                           {k: _compacto(x, ("situacao_empreendimento",)) for k, x in est.items()})}
    if rec == "siget-resolucao-empreendimento-obra-modulo.csv":
        ob = ax.le_siget_obras(_le_csv(v))
        est = {}
        for (obra, mdl), x in ob.items():
            est.setdefault(x["empreendimento"] or f"sem:{obra}", set()).add(obra)
        return {"obras_modulos": len(ob),
                "registros": _grava_estado(con, ds, v["vintage_id"], "resolucao:",
                                           {k: {"obras": sorted(o)} for k, o in est.items()})}
    if rec == "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv":
        lt = ax.le_siget_linhas(_le_csv(v))
        return {"linhas": len(lt),
                "registros": _grava_estado(con, ds, v["vintage_id"], "lt:", {k: _compacto(x) for k, x in lt.items()})}
    if rec == "siget-contrato-moduloequipamento-subestacao.csv":
        eq = ax.le_siget_equipamentos(_le_csv(v))
        return {"equipamentos": len(eq),
                "registros": _grava_estado(con, ds, v["vintage_id"], "eqp:", {k: _compacto(x) for k, x in eq.items()})}
    if rec == "capacidade-instalada-geracao-uf.csv":
        linhas = []
        for r in _le_csv(v):
            uf, ano, mes = ax.uf_valida(r.get("SigUF")), ax.texto(r.get("AnoReferencia")), ax.texto(r.get("MesReferencia"))
            if uf and ano and mes and mes.isdigit():
                linhas.append((f"cap_uf.kw.{uf}", f"{ano}-{int(mes):02d}", ax.numero(r.get("MdaPotenciaInstaladakW"))))
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "empreendimento-operacao-historico.csv":
        linhas = []
        for r in _le_csv(v):
            t, ano, mes = ax.texto(r.get("SigTipoGeracao")), ax.texto(r.get("AnoReferencia")), ax.texto(r.get("MesReferencia"))
            if t and ano and mes and mes.isdigit():
                ref = f"{ano}-{int(mes):02d}"
                linhas.append((f"emp_op.kw.{t}", ref, ax.numero(r.get("MdaPotenciaInstaladaKW"))))
                linhas.append((f"emp_op.n.{t}", ref, ax.numero(r.get("QtdUsinasPeriodo"))))
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "pde2035_dados_relatorio_final.zip":
        pde = epe_pde.extrai_pde2035(_bytes_bronze(v))
        linhas = []
        for fig, d in pde.items():
            if fig.startswith("_"):
                continue
            for lin in d["linhas"]:
                for col, val in lin["valores"].items():
                    linhas.append((f"pde2035.{fig}.{col}", lin["ref"], val))
        base.grava_registros(con, ds, v["vintage_id"], [("meta:pde2035", "atualizacao", _fmt(pde["_atualizacao"])),
                                                        ("meta:pde2035", "arquivos", _fmt(pde["_arquivos"]))])
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    return None  # recurso guardado no bronze sem integração (página e relatório do PDE)


def coletar(con, ctx):
    status = {"conjuntos": [], "integracoes": {}}
    if ctx.get("sem_rede"):
        status["sem_rede"] = True
    else:
        for cj in CONJUNTOS:
            status["conjuntos"].append(_baixa_conjunto(con, cj))
        status["conjuntos"].append(_baixa_epe(con))
    for ds in sorted({cj["dataset"] for cj in CONJUNTOS} | {DS_PDE}):
        for rec, v in ckan.vintages_vigentes(con, ds).items():
            if _integrado(con, v["vintage_id"]):
                continue
            try:
                det = _integra(con, ds, rec, v)
            except Exception as e:  # arquivo com esquema inesperado: registrado, sem número inventado
                base.registra_coleta(con, ds, rec, False, f"integração: {e}")
                status["integracoes"][rec] = f"falha: {str(e)[:300]}"
                con.commit()
                continue
            if det is not None:
                _marca_integrado(con, v["vintage_id"], det)
            status["integracoes"][rec] = det
            con.commit()
    status["ok"] = not any(s["falhas"] for s in status["conjuntos"]) and \
        not any(isinstance(x, str) and x.startswith("falha") for x in status["integracoes"].values())
    return status



# ================================================================== leitura do silver

def _estado(con, ds, prefixo, instante=None):
    """{chave sem prefixo: dict} com o estado dos registros (campos próprios + 'dados')."""
    out = {}
    for k, campos in base.registros_como_estavam_em(con, ds, instante).items():
        if not k.startswith(prefixo):
            continue
        d = json.loads(campos.get("dados") or "{}")
        for kk, vv in campos.items():
            if kk != "dados":
                d[kk] = vv
        if d:
            out[k[len(prefixo):]] = d
    return out


def _meta(con, ds, rec):
    m = base.registros_como_estavam_em(con, ds).get(f"meta:{rec}", {})
    out = {}
    for k, v in m.items():
        try:
            out[k] = json.loads(v)
        except (ValueError, TypeError):
            out[k] = v
    return out


def _f(x):
    """Texto numérico do silver → float (vazio/None = ausência)."""
    if x is None or x == "":
        return None
    return float(x)


def _mw(kw):
    return None if kw is None else kw / 1000.0


def _r(v, casas=1):
    return c.r(v, casas)


def _pct(num, den, casas=1):
    return c.r(100.0 * num / den, casas) if den else None


def _fonte(orgao, conjunto, recurso, url, licenca, vintage=None):
    f = {"orgao": orgao, "dataset": conjunto, "recurso": recurso, "url_dataset": url,
         "url_primaria": (vintage or {}).get("url") or url, "licenca": licenca}
    return f


def _fonte_ev(orgao, conjunto, recurso, url, vintage):
    """Bloco 'fonte' da evidência a partir da vintage vigente do recurso."""
    v = vintage or {}
    return {"orgao": orgao, "conjunto": conjunto, "recurso": recurso, "url": v.get("url") or url,
            "arquivo": v.get("arquivo"), "sha256": v.get("sha256"), "capturado_em": v.get("capturado_em"),
            "publicado_em": v.get("publicado_em")}


def _evidencia(*, valor_exibido, valor_calculo, unidade, periodo, entidade, universo, fonte, formula,
               chaves_origem, cobertura, tratamento_ausencia, download, filtros=None, numerador=None,
               denominador=None, pesos=None, exclusoes=None, testes=(), reconciliacao=None, revisoes=None,
               reproducao=None, publicacao=None):
    return {
        "valor_exibido": valor_exibido, "valor_calculo": valor_calculo, "unidade": unidade, "periodo": periodo,
        "entidade": entidade, "universo": universo, "filtros": filtros or [], "fonte": fonte,
        "chaves_origem": chaves_origem, "formula": formula, "numerador": numerador, "denominador": denominador,
        "pesos": pesos, "exclusoes": exclusoes or [], "cobertura": cobertura, "tratamento_ausencia": tratamento_ausencia,
        "versao": {"pipeline": base.VERSAO_PIPELINE, "codigo": base.versao_codigo(), "publicacao": publicacao},
        "revisoes": revisoes, "testes": list(testes), "reconciliacao": reconciliacao,
        "download": download,
        "reproducao": reproducao or "python3 pipeline/energia/executar_modulo.py expansao (coleta e gold); --sem-coleta refaz a gold a partir do silver.",
        "citacao": None,
    }


def _citacao(orgao, conjunto, url, captura):
    dia = (captura or "")[:10]
    return f"{orgao}. {conjunto}. Disponível em: {url}. Capturado em {dia}. Processado pelo Observatório do Setor Elétrico (módulo Expansão)."


# ================================================================== blocos

ROTULO_ESTAGIO = {
    "operacao": "Em operação",
    "construcao": "Em construção",
    "construcao_nao_iniciada": "Outorgado, construção não iniciada",
    "outro": "Outra fase (rótulo não previsto)",
}
ORDEM_ORIGEM = ("Hídrica", "Fóssil", "Eólica", "Solar", "Biomassa", "Nuclear")


def _bloco_capacidade(siga, agreg, lib_linhas, data_siga):
    """Capacidade instalada em operação (SIGA, fase Operação), por tipo, origem, fonte e
    UF, com reconciliação contra os agregados publicados pela própria ANEEL."""
    op = {k: u for k, u in siga.items() if u.get("fase") == "Operação"}
    tot_f = sum(u.get("kw_fiscalizado") or 0 for u in op.values())
    tot_o = sum(u.get("kw_outorgado") or 0 for u in op.values())

    def agrupa(chave):
        g = defaultdict(lambda: {"usinas": 0, "kw_f": 0.0, "kw_o": 0.0})
        for u in op.values():
            x = g[chave(u)]
            x["usinas"] += 1
            x["kw_f"] += u.get("kw_fiscalizado") or 0
            x["kw_o"] += u.get("kw_outorgado") or 0
        return g

    por_tipo = [{"tipo": t, "nome": ax.NOME_TIPO.get(t, t), "usinas": x["usinas"],
                 "mw_fiscalizado": _r(_mw(x["kw_f"])), "mw_outorgado": _r(_mw(x["kw_o"])),
                 "participacao_pct": _pct(x["kw_f"], tot_f, 2)}
                for t, x in sorted(agrupa(lambda u: u.get("tipo")).items(), key=lambda kv: -kv[1]["kw_f"])]
    por_origem = [{"origem": o, "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"])),
                   "participacao_pct": _pct(x["kw_f"], tot_f, 2)}
                  for o, x in sorted(agrupa(lambda u: u.get("origem")).items(), key=lambda kv: -kv[1]["kw_f"])]
    por_fonte = [{"origem": k[0], "fonte": k[1], "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"]))}
                 for k, x in sorted(agrupa(lambda u: (u.get("origem"), u.get("fonte"))).items(),
                                    key=lambda kv: -kv[1]["kw_f"])]
    uf_origem = agrupa(lambda u: (u.get("uf"), u.get("origem")))
    ufs = agrupa(lambda u: u.get("uf"))
    por_uf = []
    for uf, x in sorted(ufs.items(), key=lambda kv: -kv[1]["kw_f"]):
        por_uf.append({"uf": uf, "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"])),
                       "participacao_pct": _pct(x["kw_f"], tot_f, 2),
                       "por_origem": {o: _r(_mw(uf_origem[(uf, o)]["kw_f"])) for o in ORDEM_ORIGEM
                                      if (uf, o) in uf_origem}})
    multi = [u for u in op.values() if len(ax.ufs_dos_municipios(u.get("municipios"))) > 1]
    csv_linhas = []
    for (uf, tipo, origem), x in sorted(agrupa(lambda u: (u.get("uf"), u.get("tipo"), u.get("origem"))).items(),
                                         key=lambda kv: (kv[0][0] or "", kv[0][1] or "", kv[0][2] or "")):
        csv_linhas.append([uf, tipo, origem, x["usinas"], _mw(x["kw_f"]), _mw(x["kw_o"])])
    _csv(os.path.basename(DOWNLOADS["capacidade_uf"]),
                     ["uf", "tipo", "origem", "usinas", "mw_fiscalizado", "mw_outorgado"], csv_linhas)

    # reconciliação: agregado oficial mais recente por tipo (empreendimentos em operação)
    # e por UF (capacidade instalada por UF) contra o SIGA, com as liberações comerciais
    # entre o fim do mês do agregado e a data do SIGA como diferença esperada
    rec_tipo, rec_uf = [], []
    ref = max((r for r in agreg.get("emp_op_refs", [])), default=None)
    if ref:
        fim_ref = _fim_do_mes(ref)
        lib_intervalo = defaultdict(float)
        for x in lib_linhas:
            if fim_ref < (x["realizado"] or "") <= data_siga:
                lib_intervalo[x["tipo"]] += x["kw"] or 0
        tipos = agrupa(lambda u: u.get("tipo"))
        for t in sorted(set(tipos) | set(agreg["emp_op"].get(ref, {}))):
            agregado = agreg["emp_op"].get(ref, {}).get(t)
            siga_kw = tipos[t]["kw_f"] if t in tipos else 0.0
            if agregado is None:
                continue
            rec_tipo.append({
                "tipo": t, "siga_mw": _r(_mw(siga_kw), 3), "agregado_mw": _r(_mw(agregado), 3),
                "liberado_no_intervalo_mw": _r(_mw(lib_intervalo.get(t, 0.0)), 3),
                "diferenca_mw": _r(_mw(siga_kw - agregado), 3),
                "residuo_mw": _r(_mw(siga_kw - agregado - lib_intervalo.get(t, 0.0)), 3),
                "residuo_pct": _pct(siga_kw - agregado - lib_intervalo.get(t, 0.0), agregado, 3)})
    ref_uf = max((r for r in agreg.get("cap_uf_refs", [])), default=None)
    if ref_uf:
        for uf in sorted(agreg["cap_uf"].get(ref_uf, {})):
            agregado = agreg["cap_uf"][ref_uf][uf]
            siga_kw = ufs[uf]["kw_f"] if uf in ufs else 0.0
            rec_uf.append({"uf": uf, "siga_mw": _r(_mw(siga_kw), 3), "agregado_mw": _r(_mw(agregado), 3),
                           "diferenca_mw": _r(_mw(siga_kw - agregado), 3),
                           "diferenca_pct": _pct(siga_kw - agregado, agregado, 2)})
    return {
        "data_referencia": data_siga,
        "total": {"usinas": len(op), "mw_fiscalizado": _r(_mw(tot_f)), "mw_outorgado": _r(_mw(tot_o))},
        "por_tipo": por_tipo, "por_origem": por_origem, "por_fonte": por_fonte, "por_uf": por_uf,
        "multiestaduais": {"usinas": len(multi), "mw_fiscalizado": _r(_mw(sum(u.get("kw_fiscalizado") or 0 for u in multi)))},
        "reconciliacao": {"referencia_tipo": ref, "por_tipo": rec_tipo, "referencia_uf": ref_uf, "por_uf": rec_uf},
    }


def _csv(nome, cabecalho, linhas):
    """CSV de download (base.escreve_csv) com texto saneado: o separador é ';' e a
    fonte usa ';' dentro de campos (proprietários, municípios), então ';' vira ',' e
    quebras de linha viram espaço. Número e vazio passam intactos."""
    def limpa(v):
        if isinstance(v, str):
            return v.replace(";", ",").replace("\r", " ").replace("\n", " ").strip()
        return v
    return base.escreve_csv(nome, cabecalho, [[limpa(v) for v in lin] for lin in linhas])


def _fim_do_mes(ref):
    a, m = int(ref[:4]), int(ref[5:7])
    prox = date(a + (m == 12), m % 12 + 1, 1)
    return (prox - timedelta(days=1)).isoformat()


def _bloco_estagios(siga, encerramentos, ralie_us, ralie_ug, ralie_leilao, data_siga, data_ralie):
    """P040: estágios do SIGA, encerramentos de outorga e o detalhe do RALIE."""
    g = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    gt = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    gu = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    for u in siga.values():
        e = u.get("estagio") or "outro"
        for d, k in ((g, e), (gt, (u.get("tipo"), e)), (gu, (u.get("uf"), e))):
            d[k]["usinas"] += 1
            d[k]["kw_o"] += u.get("kw_outorgado") or 0
            d[k]["kw_f"] += u.get("kw_fiscalizado") or 0
    ordem = ("operacao", "construcao", "construcao_nao_iniciada", "outro")
    resumo = [{"estagio": e, "rotulo": ROTULO_ESTAGIO[e], "usinas": g[e]["usinas"],
               "mw_outorgado": _r(_mw(g[e]["kw_o"])), "mw_fiscalizado": _r(_mw(g[e]["kw_f"]))}
              for e in ordem if e in g]
    tipos = sorted({t for t, _ in gt}, key=lambda t: -sum(gt[(t, e)]["kw_o"] for e in ordem if (t, e) in gt))
    por_tipo = []
    for t in tipos:
        linha = {"tipo": t, "nome": ax.NOME_TIPO.get(t, t)}
        for e in ordem[:3]:
            x = gt.get((t, e), {"usinas": 0, "kw_o": 0.0})
            linha[f"{e}_usinas"] = x["usinas"]
            linha[f"{e}_mw_outorgado"] = _r(_mw(x["kw_o"]))
        por_tipo.append(linha)
    ufs = sorted({uf for uf, _ in gu if uf})
    por_uf = []
    for uf in ufs:
        linha = {"uf": uf}
        for e in ordem[:3]:
            x = gu.get((uf, e), {"usinas": 0, "kw_o": 0.0})
            linha[f"{e}_usinas"] = x["usinas"]
            linha[f"{e}_mw_outorgado"] = _r(_mw(x["kw_o"]))
        por_uf.append(linha)

    # encerramentos de outorga (atos da ANEEL)
    por_ano = defaultdict(lambda: {"atos": 0, "usinas": set(), "mw": 0.0, "mw_sem_valor": 0, "revogacao": 0, "extincao": 0})
    por_tipo_enc = defaultdict(lambda: {"atos": 0, "mw": 0.0})
    for x in encerramentos.values():
        ano = (x.get("publicacao") or "")[:4]
        if not ano:
            continue
        a = por_ano[ano]
        a["atos"] += 1
        a[x.get("encerramento")] += 1
        a["usinas"].add(x.get("nucleo") or x.get("ceg") or x.get("nome"))
        if x.get("mw") is None:
            a["mw_sem_valor"] += 1
        else:
            a["mw"] += x["mw"]
        por_tipo_enc[x.get("tipo_geracao")]["atos"] += 1
        por_tipo_enc[x.get("tipo_geracao")]["mw"] += x.get("mw") or 0
    enc_ano = [{"ano": a, "atos": x["atos"], "revogacoes": x["revogacao"], "extincoes": x["extincao"],
                "usinas": len(x["usinas"]), "mw_declarado": _r(x["mw"]), "atos_sem_potencia": x["mw_sem_valor"],
                "ano_parcial": a == data_siga[:4]} for a, x in sorted(por_ano.items())]

    # RALIE atual
    kw_ug = defaultdict(float)
    n_ug = defaultdict(int)
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        n_ug[n] += 1

    def agrupa_ralie(*campos):
        out = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_ug": 0.0})
        for n, u in ralie_us.items():
            k = tuple(u.get(cp) or "(vazio)" for cp in campos)
            out[k]["usinas"] += 1
            out[k]["kw_o"] += u.get("kw_outorgado") or 0
            out[k]["kw_ug"] += kw_ug.get(n, 0.0)
        return out

    def lista(grupos, nomes):
        return [{**dict(zip(nomes, k)), "usinas": x["usinas"], "mw_outorgado": _r(_mw(x["kw_o"])),
                 "mw_ugs_em_implantacao": _r(_mw(x["kw_ug"]))}
                for k, x in sorted(grupos.items(), key=lambda kv: -kv[1]["kw_o"])]

    com_leilao = {n for (n, cod) in (k.split(":", 1) for k in ralie_leilao) if cod != "Nenhum"}
    kw_lei = sum(ralie_us[n].get("kw_outorgado") or 0 for n in com_leilao if n in ralie_us)
    fase_siga = defaultdict(int)
    for n in ralie_us:
        fase_siga[(siga.get(n) or {}).get("fase") or "ausente do SIGA"] += 1
    ralie = {
        "data_ralie": data_ralie, "usinas": len(ralie_us), "ugs": len(ralie_ug),
        "mw_outorgado": _r(_mw(sum(u.get("kw_outorgado") or 0 for u in ralie_us.values()))),
        "mw_ugs_em_implantacao": _r(_mw(sum(kw_ug.values()))),
        "por_obra": lista(agrupa_ralie("situacao_obra"), ["situacao_obra"]),
        "por_viabilidade": lista(agrupa_ralie("viabilidade"), ["viabilidade"]),
        "por_cronograma": lista(agrupa_ralie("situacao_cronograma"), ["situacao_cronograma"]),
        "por_justificativa": lista(agrupa_ralie("justificativa_previsao"), ["justificativa"]),
        "obra_x_viabilidade": lista(agrupa_ralie("situacao_obra", "viabilidade"), ["situacao_obra", "viabilidade"]),
        "por_tipo": lista(agrupa_ralie("tipo"), ["tipo"]),
        "por_uf": lista(agrupa_ralie("uf"), ["uf"]),
        "leilao": {"usinas_com_compromisso": len(com_leilao & set(ralie_us)), "mw_outorgado_com_compromisso": _r(_mw(kw_lei)),
                   "usinas_sem_compromisso": len(set(ralie_us) - com_leilao)},
        "fase_no_siga": [{"fase": f, "usinas": n} for f, n in sorted(fase_siga.items(), key=lambda kv: -kv[1])],
    }
    return {
        "data_referencia": data_siga, "resumo": resumo, "por_tipo": por_tipo, "por_uf": por_uf,
        "encerramentos": {"desde": min((x["ano"] for x in enc_ano), default=None), "por_ano": enc_ano,
                          "por_tipo": [{"tipo": t, "atos": x["atos"], "mw_declarado": _r(x["mw"])}
                                       for t, x in sorted(por_tipo_enc.items(), key=lambda kv: -kv[1]["mw"])],
                          "total_atos": sum(x["atos"] for x in enc_ano),
                          "total_mw_declarado": _r(sum(x["mw"] for x in por_ano.values()))},
        "ralie": ralie,
    }


def _liberacoes(lib_estado):
    """Estado do silver de liberações → (linhas planas, índice {(núcleo, ug): data})."""
    linhas, indice = [], {}
    for n, u in lib_estado.items():
        nuc = int(n)
        for ug_bruto, kw, outorgado, realizado in u.get("ugs", []):
            linhas.append({"nucleo": nuc, "ug": ug_bruto, "kw": kw, "outorgado": outorgado, "realizado": realizado,
                           "tipo": u.get("tipo"), "uf": u.get("uf")})
            ugs = ax.ugs_de(ug_bruto)
            if not ugs or not realizado:
                continue
            for x in ugs:
                if (nuc, x) not in indice or realizado < indice[(nuc, x)]:
                    indice[(nuc, x)] = realizado
    return linhas, indice


def _atraso_realizado(lib_linhas, desde="2014"):
    """Por ano da liberação comercial: potência liberada e atraso em relação à data
    outorgada da unidade (realizado − outorgado), ponderado por kW."""
    por = defaultdict(list)
    for x in lib_linhas:
        if not x["realizado"] or x["realizado"][:4] < desde:
            continue
        atraso = None
        if x["outorgado"]:
            atraso = (date.fromisoformat(x["realizado"]) - date.fromisoformat(x["outorgado"])).days
        por[(x["realizado"][:4], "TOTAL")].append((atraso, x["kw"] or 0.0))
        por[(x["realizado"][:4], x["tipo"] or "?")].append((atraso, x["kw"] or 0.0))
    out = []
    for (ano, tipo), pares in sorted(por.items()):
        com = [(a, k) for a, k in pares if a is not None]
        kw = sum(k for _, k in pares)
        out.append({"ano": ano, "tipo": tipo, "linhas": len(pares), "kw": kw,
                    "kw_com_data_outorgada": sum(k for _, k in com),
                    "kw_com_atraso": sum(k for a, k in com if a > 0),
                    "kw_antecipado": sum(k for a, k in com if a < 0),
                    "mediana_dias": ax.mediana_ponderada(com)})
    return out


def _bloco_cronograma(con, ralie_us, ralie_ug, lib_linhas, lib_idx, data_ralie, data_lib, pf_ug, mensais):
    """P041: previsões atuais (com data-base = fotografia do RALIE), confiabilidade das
    previsões passadas, revisões entre fotografias e atraso realizado."""
    base_d = date.fromisoformat(data_ralie)
    # ---- previsões atuais por ano e viabilidade
    por_ano = defaultdict(lambda: defaultdict(float))
    n_ano = defaultdict(int)
    sem_prev = defaultdict(lambda: {"ugs": 0, "kw": 0.0})
    datas = defaultdict(lambda: {"ugs": 0, "usinas": set(), "kw": 0.0})
    prox = defaultdict(lambda: defaultdict(float))
    atraso_prev = []
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        u = ralie_us.get(n, {})
        viab = u.get("viabilidade") or "(vazio)"
        kw = x.get("kw") or 0.0
        p = x.get("previsao_sfg")
        if not p:
            j = u.get("justificativa_previsao") or "(vazio)"
            sem_prev[j]["ugs"] += 1
            sem_prev[j]["kw"] += kw
            continue
        por_ano[p[:4]][viab] += kw
        n_ano[p[:4]] += 1
        datas[p]["ugs"] += 1
        datas[p]["usinas"].add(n)
        datas[p]["kw"] += kw
        if p <= (base_d + timedelta(days=730)).isoformat():
            prox[p[:7]][viab] += kw
        if x.get("comercial_outorgado"):
            atraso_prev.append(((date.fromisoformat(p) - date.fromisoformat(x["comercial_outorgado"])).days, kw))
    viabs = ("Alta", "Média", "Baixa")
    previsoes_ano = [{"ano": a, "ugs": n_ano[a], "mw": _r(_mw(sum(v.values()))),
                      "por_viabilidade": {vb: _r(_mw(v.get(vb, 0.0))) for vb in viabs}}
                     for a, v in sorted(por_ano.items())]
    blocos = sorted(datas.items(), key=lambda kv: -kv[1]["ugs"])[:6]
    kw_prev_total = sum(k for _, k in atraso_prev)
    atual = {
        "data_ralie": data_ralie,
        "por_ano": previsoes_ano,
        "sem_previsao": [{"justificativa": j, "ugs": x["ugs"], "mw": _r(_mw(x["kw"]))}
                         for j, x in sorted(sem_prev.items(), key=lambda kv: -kv[1]["kw"])],
        "datas_mais_frequentes": [{"data": d, "ugs": x["ugs"], "usinas": len(x["usinas"]), "mw": _r(_mw(x["kw"]))}
                                  for d, x in blocos],
        "proximos_24_meses": [{"mes": m, "mw": _r(_mw(sum(v.values())), 2),
                               "por_viabilidade": {vb: _r(_mw(v.get(vb, 0.0)), 2) for vb in viabs}}
                              for m, v in sorted(prox.items())],
        "atraso_previsto": {
            "mw_com_previsao": _r(_mw(kw_prev_total)),
            "mw_previsao_apos_outorgado": _r(_mw(sum(k for d, k in atraso_prev if d > 0))),
            "mw_previsao_ate_outorgado": _r(_mw(sum(k for d, k in atraso_prev if d <= 0))),
            "pct_mw_apos_outorgado": _pct(sum(k for d, k in atraso_prev if d > 0), kw_prev_total),
            "mediana_dias_ponderada": ax.mediana_ponderada(atraso_prev),
        },
    }
    # ---- maiores usinas classificadas como atrasadas pela fiscalização
    kw_ug, prev_max, outg_max = defaultdict(float), {}, {}
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        if x.get("previsao_sfg"):
            prev_max[n] = max(prev_max.get(n, ""), x["previsao_sfg"])
        if x.get("comercial_outorgado"):
            outg_max[n] = max(outg_max.get(n, ""), x["comercial_outorgado"])
    atrasadas = [(n, u) for n, u in ralie_us.items() if u.get("situacao_cronograma") == "Atrasado"]
    atrasadas.sort(key=lambda nu: -(nu[1].get("kw_outorgado") or 0))
    maiores = []
    for n, u in atrasadas[:30]:
        pm, om = prev_max.get(n), outg_max.get(n)
        maiores.append({"nucleo": int(n), "ceg": u.get("ceg"), "nome": u.get("nome"), "tipo": u.get("tipo"),
                        "uf": u.get("uf"), "mw_outorgado": _r(_mw(u.get("kw_outorgado")), 2),
                        "mw_em_implantacao": _r(_mw(kw_ug.get(n)), 2), "situacao_obra": u.get("situacao_obra"),
                        "viabilidade": u.get("viabilidade"), "justificativa": u.get("justificativa_previsao"),
                        "outorgado_max": om, "previsao_max": pm,
                        "atraso_previsto_dias": (date.fromisoformat(pm) - date.fromisoformat(om)).days if pm and om else None})
    por_cron = defaultdict(lambda: {"usinas": 0, "kw": 0.0})
    for u in ralie_us.values():
        por_cron[u.get("situacao_cronograma") or "(vazio)"]["usinas"] += 1
        por_cron[u.get("situacao_cronograma") or "(vazio)"]["kw"] += u.get("kw_outorgado") or 0
    # ---- histórico da fonte (Parquet): confiabilidade e revisões
    lib_tab = ax.tabela_liberacoes(lib_idx)
    ugm = ax.ug_mensal(pf_ug, mensais)
    conf = ax.confiabilidade_previsoes(ugm, lib_tab, mensais, data_lib, horizonte_dias=365, folga_dias=15)
    desl = ax.deslizamento_previsoes(ugm, mensais, meses=MESES_JANELA)
    del ugm
    confiab = [{"ralie": x["ralie"], "fim_janela": x["fim_janela"], "ugs": x["ugs"],
                "mw_prometido": _r(_mw(x["kw_prometido"])), "mw_no_prazo": _r(_mw(x["kw_no_prazo"])),
                "mw_depois": _r(_mw(x["kw_depois"])), "mw_nao_liberado": _r(_mw(x["kw_nao_liberado"])),
                "pct_no_prazo": _pct(x["kw_no_prazo"], x["kw_prometido"]),
                "pct_depois": _pct(x["kw_depois"], x["kw_prometido"]),
                "pct_nao_liberado": _pct(x["kw_nao_liberado"], x["kw_prometido"]),
                "ugs_excluidas_ja_liberadas": x["ugs_excluidas_ja_liberadas"]} for x in conf]
    desliz = [{"ralie": x["ralie"], "ralie_seguinte": x["ralie_seguinte"], "ugs": x["ugs"], "mw": _r(_mw(x["kw"])),
               "pct_adiada": _pct(x["kw_adiada"], x["kw"]), "pct_mantida": _pct(x["kw_mantida"], x["kw"]),
               "pct_antecipada": _pct(x["kw_antecipada"], x["kw"]),
               "mediana_dias_ponderada": x["mediana_dias_ponderada"]} for x in desl]
    csv_conf = []
    for x in conf:
        csv_conf.append([x["ralie"], x["fim_janela"], "TOTAL", x["ugs"], x["kw_prometido"], x["kw_no_prazo"],
                         x["kw_depois"], x["kw_nao_liberado"], x["ugs_excluidas_ja_liberadas"]])
        for t, y in sorted(x["por_tipo"].items()):
            csv_conf.append([x["ralie"], x["fim_janela"], t, None, y["kw_prometido"], y["kw_no_prazo"], None, None, None])
    _csv(os.path.basename(DOWNLOADS["confiabilidade"]),
                     ["ralie", "fim_janela", "tipo", "ugs", "kw_prometido", "kw_no_prazo", "kw_depois", "kw_nao_liberado",
                      "ugs_excluidas_ja_liberadas"], csv_conf)
    ultima_conf = conf[-1] if conf else None
    por_tipo_ult = []
    if ultima_conf:
        for t, y in sorted(ultima_conf["por_tipo"].items(), key=lambda kv: -kv[1]["kw_prometido"]):
            por_tipo_ult.append({"tipo": t, "mw_prometido": _r(_mw(y["kw_prometido"])), "mw_no_prazo": _r(_mw(y["kw_no_prazo"])),
                                 "pct_no_prazo": _pct(y["kw_no_prazo"], y["kw_prometido"])})
    # ---- atraso realizado (liberações)
    atr = _atraso_realizado(lib_linhas)
    _csv(os.path.basename(DOWNLOADS["liberacoes"]),
                     ["ano", "tipo", "linhas", "kw_liberado", "kw_com_data_outorgada", "kw_com_atraso", "kw_antecipado",
                      "mediana_atraso_dias_ponderada"],
                     [[x["ano"], x["tipo"], x["linhas"], x["kw"], x["kw_com_data_outorgada"], x["kw_com_atraso"],
                       x["kw_antecipado"], x["mediana_dias"]] for x in atr])
    atraso_ano = [{"ano": x["ano"], "unidades_ou_grupos": x["linhas"], "mw_liberado": _r(_mw(x["kw"])),
                   "pct_mw_com_atraso": _pct(x["kw_com_atraso"], x["kw_com_data_outorgada"]),
                   "pct_mw_antecipado": _pct(x["kw_antecipado"], x["kw_com_data_outorgada"]),
                   "mediana_dias_ponderada": x["mediana_dias"], "ano_parcial": x["ano"] == data_lib[:4]}
                  for x in atr if x["tipo"] == "TOTAL"]
    # ---- histórico próprio (capturas do RALIE atual pelo observatório)
    caps = con.execute("SELECT capturado_em FROM vintages WHERE dataset=? AND recurso=? ORDER BY capturado_em",
                       (DS_RALIE, "ralie-unidade-geradora-atual.csv")).fetchall()
    revisadas = con.execute(
        """SELECT COUNT(*) FROM (SELECT chave FROM registros WHERE dataset=? AND campo='previsao_sfg' AND valor<>''
           GROUP BY chave HAVING COUNT(DISTINCT valor) > 1)""", (DS_RALIE,)).fetchone()[0]
    return {
        "data_ralie": data_ralie,
        "historico_fonte": {"primeira_fotografia": None, "fotografias": None, "fotografias_mensais": len(mensais)},
        "historico_proprio": {"primeira_captura": caps[0][0] if caps else None, "capturas": len(caps),
                              "ugs_com_previsao_revisada": revisadas},
        "previsoes_atuais": atual,
        "por_situacao_cronograma": [{"situacao": k, "usinas": x["usinas"], "mw_outorgado": _r(_mw(x["kw"]))}
                                    for k, x in sorted(por_cron.items(), key=lambda kv: -kv[1]["kw"])],
        "maiores_atrasadas": maiores,
        "confiabilidade": confiab,
        "confiabilidade_ultima_por_tipo": por_tipo_ult,
        "deslizamento": desliz,
        "atraso_realizado": atraso_ano,
        "data_liberacoes": data_lib,
    }


DESFECHOS = {
    "em_implantacao": "Segue em implantação (consta na fotografia mais recente do RALIE)",
    "operacao": "Entrou em operação (fase Operação no SIGA ou todas as unidades da primeira fotografia liberadas)",
    "outorga_encerrada": "Outorga revogada ou extinta (ato da ANEEL publicado após a primeira aparição)",
    "sem_desfecho": "Saiu do acompanhamento sem operação nem ato de encerramento identificados",
}


def _desfechos(trajs, prim_ugs, lib_idx, siga, encerramentos, ultima_ralie):
    """Classifica cada usina que já passou pelo RALIE (regra em DESFECHOS, nesta ordem)."""
    enc_por = defaultdict(list)
    for x in encerramentos.values():
        if x.get("nucleo") is not None and x.get("publicacao"):
            enc_por[int(x["nucleo"])].append(x["publicacao"])
    out = {}
    for n, t in trajs.items():
        ugs = prim_ugs.get(n, [])
        lib = [lib_idx.get((n, u)) for u, _ in ugs]
        liberadas = [d for d in lib if d]
        kw_lib = sum((k or 0) for (u, k), d in zip(ugs, lib) if d)
        fase = (siga.get(str(n)) or {}).get("fase")
        enc = sorted(d for d in enc_por.get(n, []) if d >= t["primeira"])
        if t["ultima"] == ultima_ralie:
            desf = "em_implantacao"
        elif fase == "Operação" or (ugs and len(liberadas) == len(ugs)):
            desf = "operacao"
        elif enc:
            desf = "outorga_encerrada"
        else:
            desf = "sem_desfecho"
        out[n] = {**t, "ugs_primeira": len(ugs), "ugs_primeira_liberadas": len(liberadas), "kw_primeira_liberado": kw_lib,
                  "ultima_liberacao": max(liberadas) if liberadas else None, "desfecho": desf,
                  "data_encerramento": enc[0] if enc else None, "fase_siga": fase}
    return out


def _bloco_coortes(desf, primeira_global):
    """Desfecho por coorte: estoque da primeira fotografia e entradas por ano."""
    g = defaultdict(lambda: defaultdict(lambda: {"usinas": 0, "kw": 0.0}))
    for x in desf.values():
        coorte = "estoque_inicial" if x["primeira"] == primeira_global else x["primeira"][:4]
        g[coorte][x["desfecho"]]["usinas"] += 1
        g[coorte][x["desfecho"]]["kw"] += x.get("kw_primeira") or 0
        g[coorte]["_total"]["usinas"] += 1
        g[coorte]["_total"]["kw"] += x.get("kw_primeira") or 0
    out = []
    for coorte in sorted(g, key=lambda k: "0" if k == "estoque_inicial" else k):
        tot = g[coorte]["_total"]
        out.append({
            "coorte": coorte,
            "rotulo": f"Estoque na primeira fotografia ({c.data_br(primeira_global)})" if coorte == "estoque_inicial"
            else f"Entraram no RALIE em {coorte}",
            "usinas": tot["usinas"], "mw_outorgado": _r(_mw(tot["kw"])),
            "desfechos": {d: {"usinas": g[coorte][d]["usinas"], "mw_outorgado": _r(_mw(g[coorte][d]["kw"])),
                              "pct_mw": _pct(g[coorte][d]["kw"], tot["kw"])} for d in DESFECHOS},
        })
    return out


def _bloco_leiloes(lotes, data_ref):
    """Leilões de transmissão por ano: km, MVA, investimento e RAP em campos separados.
    Deságio agregado do ano = 1 − Σ RAP vencedora / Σ RAP do edital (lotes com as duas)."""
    por = defaultdict(lambda: {"lotes": 0, "km": 0.0, "mva": 0.0, "inv": 0.0, "edital": 0.0, "venc": 0.0,
                               "edital_par": 0.0, "venc_par": 0.0, "sem_inv": 0})
    inconsist = []
    for k, x in lotes.items():
        ano = x.get("ano") or (x.get("data") or "")[:4]
        if not ano:
            continue
        a = por[ano]
        a["lotes"] += 1
        a["km"] += x.get("km") or 0
        a["mva"] += x.get("mva") or 0
        if x.get("investimento_rs") is None:
            a["sem_inv"] += 1
        a["inv"] += x.get("investimento_rs") or 0
        a["edital"] += x.get("rap_edital_rs") or 0
        a["venc"] += x.get("rap_vencedor_rs") or 0
        if x.get("rap_edital_rs") and x.get("rap_vencedor_rs"):
            a["edital_par"] += x["rap_edital_rs"]
            a["venc_par"] += x["rap_vencedor_rs"]
            calc = 1 - x["rap_vencedor_rs"] / x["rap_edital_rs"]
            if x.get("desagio_fracao") is not None and abs(calc - x["desagio_fracao"]) > 0.006:
                inconsist.append({"lote": k, "desagio_fonte_pct": _r(100 * x["desagio_fracao"], 2),
                                  "desagio_calculado_pct": _r(100 * calc, 2)})
    anos = [{"ano": a, "lotes": x["lotes"], "km": _r(x["km"]), "mva": _r(x["mva"]),
             "investimento_previsto_rs_mi": _r(x["inv"] / 1e6), "rap_edital_rs_mi": _r(x["edital"] / 1e6),
             "rap_vencedor_rs_mi": _r(x["venc"] / 1e6),
             "desagio_agregado_pct": _r(100 * (1 - x["venc_par"] / x["edital_par"]), 1) if x["edital_par"] else None,
             "lotes_sem_investimento": x["sem_inv"]} for a, x in sorted(por.items())]
    linhas = []
    for k, x in sorted(lotes.items(), key=lambda kv: (kv[1].get("data") or "", kv[0])):
        linhas.append([x.get("ano"), x.get("data"), x.get("leilao"), x.get("lote"), x.get("empreendimento"), x.get("uf"),
                       x.get("prazo_meses"), x.get("km"), x.get("mva"), x.get("investimento_rs"), x.get("rap_edital_rs"),
                       x.get("rap_vencedor_rs"), None if x.get("desagio_fracao") is None else 100 * x["desagio_fracao"],
                       x.get("vencedor")])
    _csv(os.path.basename(DOWNLOADS["leiloes"]),
                     ["ano", "data", "leilao", "lote", "empreendimento", "uf", "prazo_meses", "km", "mva", "investimento_rs",
                      "rap_edital_rs", "rap_vencedor_rs", "desagio_pct", "vencedor"], linhas)
    return {"data_referencia": data_ref, "por_ano": anos, "lotes": len(lotes),
            "desagio_inconsistente": inconsist[:20], "desagio_inconsistente_total": len(inconsist)}


def _bloco_obras(epds, lts, eqps, resol, data_siget):
    """Obras de transmissão do SIGET por empreendimento: extensão de linhas novas (km),
    transformação nova (MVA), prazo do ato legal e data efetiva. Só módulos cuja obra é
    do tipo Instalação somam km e MVA novos; adequação, ampliação, recapacitação e
    reconstrução alteram instalação existente e são contadas à parte, sem km novo."""
    hoje = data_siget
    obras_resol = set()
    for x in resol.values():
        obras_resol.update(x.get("obras") or [])
    emp = []
    por_sit = defaultdict(lambda: {"empreendimentos": 0, "obras": 0, "km": 0.0, "mva": 0.0})
    uf_and = defaultdict(lambda: {"km": 0.0, "mva": 0.0, "empreendimentos": set()})
    entrada = defaultdict(lambda: {"km": 0.0, "mva": 0.0, "modulos_lt": 0, "modulos_tr": 0})
    atraso_ano = defaultdict(list)
    for eid, e in epds.items():
        sit = e.get("situacao_empreendimento") or "(vazio)"
        km = mva = 0.0
        ufs = set()
        vistos_lt, vistos_tr = set(), set()
        n_obras, n_resol, outras = set(), 0, 0
        for obra, mdl, sit_obra, tipo_obra, oper_obra, tipo_mdl, nome_mdl in e.get("obras", []):
            n_obras.add(obra)
            if obra in obras_resol:
                n_resol += 1
            if tipo_obra != "Instalação":
                outras += 1
                continue
            if tipo_mdl == "LT" and mdl in lts and mdl not in vistos_lt:
                vistos_lt.add(mdl)
                lt = lts[mdl]
                km += lt.get("km") or 0
                for uf in (lt.get("uf_origem"), lt.get("uf_destino")):
                    if uf:
                        ufs.add(uf)
                if oper_obra and (lt.get("km") or 0) > 0:
                    entrada[oper_obra[:4]]["km"] += lt["km"]
                    entrada[oper_obra[:4]]["modulos_lt"] += 1
            elif tipo_mdl == "ME" and mdl in eqps and eqps[mdl].get("mva") and mdl not in vistos_tr:
                vistos_tr.add(mdl)
                mva += eqps[mdl]["mva"]
                if eqps[mdl].get("uf"):
                    ufs.add(eqps[mdl]["uf"])
                if oper_obra:
                    entrada[oper_obra[:4]]["mva"] += eqps[mdl]["mva"]
                    entrada[oper_obra[:4]]["modulos_tr"] += 1
        legal = e.get("oper_ato_legal")
        efetiva = e.get("oper_efetiva_empreendimento")
        atraso = (date.fromisoformat(efetiva) - date.fromisoformat(legal)).days if legal and efetiva else None
        vencido = sit in ("Em andamento", "Planejado") and legal is not None and legal < hoje
        dias_vencido = (date.fromisoformat(hoje) - date.fromisoformat(legal)).days if vencido else None
        if efetiva and atraso is not None:
            atraso_ano[efetiva[:4]].append(atraso)
        p = por_sit[sit]
        p["empreendimentos"] += 1
        p["obras"] += len(n_obras)
        p["km"] += km
        p["mva"] += mva
        if sit == "Em andamento":
            for uf in ufs:
                uf_and[uf]["km"] += sum((lts[m].get("km") or 0) for m in vistos_lt
                                        if uf in (lts[m].get("uf_origem"), lts[m].get("uf_destino")))
                uf_and[uf]["mva"] += sum(eqps[m]["mva"] for m in vistos_tr if eqps[m].get("uf") == uf)
                uf_and[uf]["empreendimentos"].add(eid)
        emp.append({"id": eid, "ons": e.get("empreendimento_ons"), "nome": e.get("nome_empreendimento"), "situacao": sit,
                    "oper_ato_legal": legal, "oper_efetiva": efetiva, "atraso_dias": atraso, "prazo_legal_vencido": vencido,
                    "dias_desde_prazo_legal": dias_vencido, "km_lt": km, "mva_tr": mva, "ufs": sorted(ufs),
                    "obras": len(n_obras), "obras_outras": outras, "obras_resolucao": n_resol})
    andamento = [x for x in emp if x["situacao"] == "Em andamento"]
    venc = [x for x in andamento if x["prazo_legal_vencido"]]
    linhas = [[x["id"], x["ons"], x["nome"], x["situacao"], x["oper_ato_legal"], x["oper_efetiva"], x["atraso_dias"],
               "sim" if x["prazo_legal_vencido"] else "não", x["km_lt"], x["mva_tr"], "|".join(x["ufs"]), x["obras"],
               x["obras_resolucao"]] for x in sorted(emp, key=lambda z: (z["situacao"], z["oper_ato_legal"] or ""))]
    _csv(os.path.basename(DOWNLOADS["obras"]),
                     ["empreendimento", "empreendimento_ons", "nome", "situacao", "oper_ato_legal", "oper_efetiva",
                      "atraso_dias", "prazo_legal_vencido", "km_lt", "mva_tr", "ufs", "obras", "obras_resolucao"], linhas)
    maiores_venc = sorted(venc, key=lambda x: -(x["dias_desde_prazo_legal"] or 0))[:20]
    return {
        "data_referencia": data_siget,
        "por_situacao": [{"situacao": s, "empreendimentos": x["empreendimentos"], "obras": x["obras"],
                          "km_lt_novas": _r(x["km"]), "mva_tr_novos": _r(x["mva"])}
                         for s, x in sorted(por_sit.items(), key=lambda kv: -kv[1]["empreendimentos"])],
        "em_andamento": {"empreendimentos": len(andamento), "km_lt_novas": _r(sum(x["km_lt"] for x in andamento)),
                         "mva_tr_novos": _r(sum(x["mva_tr"] for x in andamento)),
                         "com_prazo_legal_vencido": len(venc), "km_prazo_vencido": _r(sum(x["km_lt"] for x in venc)),
                         "mva_prazo_vencido": _r(sum(x["mva_tr"] for x in venc)),
                         "mediana_dias_desde_prazo_legal": c.quantil([x["dias_desde_prazo_legal"] for x in venc], 0.5)},
        "em_andamento_por_uf": [{"uf": uf, "empreendimentos": len(x["empreendimentos"]), "km_lt_toca_uf": _r(x["km"]),
                                 "mva_tr": _r(x["mva"])} for uf, x in sorted(uf_and.items(), key=lambda kv: -kv[1]["km"])],
        "maiores_prazos_vencidos": [{k: x[k] for k in ("id", "ons", "nome", "oper_ato_legal", "dias_desde_prazo_legal",
                                                         "km_lt", "mva_tr", "ufs")} for x in maiores_venc],
        "atraso_realizado_por_ano": [{"ano": a, "empreendimentos": len(v), "pct_com_atraso": _pct(sum(1 for d in v if d > 0), len(v)),
                                      "mediana_dias": c.quantil(v, 0.5), "p75_dias": c.quantil(v, 0.75)}
                                     for a, v in sorted(atraso_ano.items()) if a >= "2010"],
        "entrada_por_ano": [{"ano": a, "km_lt_novas": _r(x["km"]), "mva_tr_novos": _r(x["mva"]),
                             "modulos_lt": x["modulos_lt"], "modulos_tr": x["modulos_tr"]}
                            for a, x in sorted(entrada.items()) if a >= "2005"],
        "_emp": emp,
    }


# categorias da Figura 3-25 do PDE 2035 e a correspondência verificada com o SIGA/RALIE
CAMADAS_PDE = [
    {"categoria": "UHE (GW)", "rotulo": "Hidrelétricas (UHE)", "siga": lambda u: u.get("tipo") == "UHE",
     "correspondencia": "direta"},
    {"categoria": "PCH (GW)", "rotulo": "Pequenas centrais hidrelétricas (PCH)", "siga": lambda u: u.get("tipo") == "PCH",
     "correspondencia": "direta", "nota": "As centrais geradoras hidrelétricas (CGH) do SIGA não entram: a figura do PDE não informa se as inclui."},
    {"categoria": "Eólica (GW)", "rotulo": "Eólicas", "siga": lambda u: u.get("tipo") == "EOL", "correspondencia": "direta"},
    {"categoria": "Solar fotovoltaica (GW)", "rotulo": "Solar centralizada", "siga": lambda u: u.get("tipo") == "UFV",
     "correspondencia": "direta", "nota": "Geração centralizada; a MMGD é categoria separada no PDE e não está no SIGA."},
    {"categoria": "Biomassa (GW)", "rotulo": "Biomassa", "siga": lambda u: u.get("tipo") == "UTE" and u.get("origem") == "Biomassa",
     "correspondencia": "direta"},
    {"categoria": "UTE (GW)", "rotulo": "Termelétricas (PDE)", "siga": None, "correspondencia": "sem correspondência verificada",
     "nota": "A figura não detalha quais térmicas compõem a categoria (fósseis, nuclear, sistemas isolados, usinas sem contrato retiradas do Caso Base); o SIGA não é comparado."},
    {"categoria": "MMGD (GW)", "rotulo": "Micro e minigeração distribuída", "siga": None,
     "correspondencia": "fora do universo do SIGA e do RALIE"},
    {"categoria": "Baterias (GW)", "rotulo": "Baterias", "siga": None, "correspondencia": "fora do universo do SIGA e do RALIE"},
    {"categoria": "RD (GW)", "rotulo": "Resposta da demanda", "siga": None, "correspondencia": "não é geração"},
]

HIPOTESES_PDE2035 = [
    {"texto": "Data-base das premissas: janeiro de 2025.", "pagina": 92},
    {"texto": "Horizonte do plano: 2026 a 2035.", "pagina": None},
    {"texto": "Caso Base: oferta existente e contratada (leilões realizados até janeiro de 2025 e expansão prevista via ambiente livre), sem expansão indicativa.", "pagina": 72},
    {"texto": "Retirada do Caso Base de cerca de 11.200 MW de termelétricas existentes com fim de contrato regulado, fim de benefício da CDE/PPT ou sem contrato, por incerteza sobre sua disponibilidade futura.", "pagina": 72},
    {"texto": "Cerca de 14.300 MW de retrofit de termelétricas descontratadas oferecidos ao modelo de decisão de investimentos de forma escalonada.", "pagina": 72},
    {"texto": "Crescimento médio da carga global do SIN (sem abatimento da MMGD) de cerca de 3,2% ao ano no horizonte.", "pagina": 74},
    {"texto": "Micro e minigeração distribuída projetada para cerca de 78 GW em 2035 no Cenário de Referência.", "pagina": 73},
    {"texto": "Cenário de Referência considera a Lei nº 14.182/2021 (8.000 MW de termelétricas a gás com inflexibilidade de pelo menos 70%, contratação de centrais hidrelétricas de até 50 MW e prorrogação do PROINFA) e a Lei nº 14.299/2022 (manutenção do Complexo Jorge Lacerda).", "pagina": 92},
    {"texto": "Angra 3 com início de operação comercial em 2033, por diretriz do MME.", "pagina": 93},
    {"texto": "Expansão indicativa escolhida pelo menor custo total que atende aos critérios de suprimento de energia e potência.", "pagina": 93},
]


def _bloco_cenarios(con, pde_obs, siga, ralie_us, ralie_ug, html_pagina, vint_pde):
    """P043: PDE 2035 como CENÁRIO, com realizado (SIGA) e carteira (RALIE) em camadas
    separadas; nenhuma diferença entre camadas é calculada."""
    figs = {}
    for chave, spec in epe_pde.FIGURAS_PDE2035.items():
        series = {s.split(".", 2)[2]: dict(pts) for s, pts in pde_obs.items() if s.startswith(f"pde2035.{chave}.")}
        if not series:
            continue
        refs = sorted({r for pts in series.values() for r in pts})
        cols = [col for col in (spec["colunas"] or sorted(series)) if col in series]
        figs[chave] = {"titulo": spec["titulo"], "aba": spec["aba"], "unidade": spec["unidade"], "pagina": spec["pagina"],
                       "nota": spec["nota"], "colunas": cols,
                       "linhas": [{"ref": r, **{col: c.r(series[col].get(r), 3) for col in cols}} for r in refs]}
    aprov = None
    if html_pagina:
        import html as _html
        import re as _re
        txt = _re.sub(r"<[^>]+>", " ", html_pagina)
        txt = _re.sub(r"\s+", " ", _html.unescape(txt)).replace("​", "")
        m = _re.search(r"aprovado pela (Portaria MME n\S* ?[\d.]+, de \d{1,2} de \w+ de \d{4})", txt)
        if m:
            aprov = {"texto": m.group(1), "verificado_em": "página da EPE capturada", "fonte": URL_PDE_PAGINA}
    # camadas
    f325 = figs.get("fig_3_25", {"linhas": []})
    p25 = next((x for x in f325["linhas"] if x["ref"].startswith("2025")), {})
    p35 = next((x for x in f325["linhas"] if x["ref"].startswith("2035")), {})
    kw_ug = defaultdict(float)
    for k, x in ralie_ug.items():
        kw_ug[k.split(":")[0]] += x.get("kw") or 0
    camadas = []
    for cam in CAMADAS_PDE:
        linha = {"categoria": cam["categoria"].replace(" (GW)", ""), "rotulo": cam["rotulo"],
                 "pde_dez2025_gw": p25.get(cam["categoria"]), "pde_dez2035_gw": p35.get(cam["categoria"]),
                 "correspondencia": cam["correspondencia"], "nota": cam.get("nota"),
                 "realizado_siga_gw": None, "carteira_ralie_gw": None}
        if cam["siga"] is not None:
            linha["realizado_siga_gw"] = c.r(sum(u.get("kw_fiscalizado") or 0 for u in siga.values()
                                                 if u.get("fase") == "Operação" and cam["siga"](u)) / 1e6, 3)
            linha["carteira_ralie_gw"] = c.r(sum(kw_ug.get(n, 0.0) for n, u in ralie_us.items() if cam["siga"](u)) / 1e6, 3)
        camadas.append(linha)
    soma25 = sum(v for k, v in p25.items() if k != "ref" and v is not None)
    soma35 = sum(v for k, v in p35.items() if k != "ref" and v is not None)
    soma36 = None
    f36 = figs.get("fig_3_6")
    if f36:
        l25 = next((x for x in f36["linhas"] if x["ref"] == "2025"), None)
        if l25:
            soma36 = sum(v for k, v in l25.items() if k != "ref" and v is not None)
    return {
        "selo": "CENÁRIO", "edicao": "PDE 2035", "orgao": "EPE e Ministério de Minas e Energia",
        "aprovacao": aprov, "data_base_premissas": "janeiro de 2025", "horizonte": "2026 a 2035",
        "cenario": "Cenário de Referência (expansão indicativa) e Caso Base (existente e contratado)",
        "universo": "Figura 3-25: matriz elétrica nacional, incluindo MMGD, baterias e resposta da demanda; Figura 3-6: SIN, existente e contratado; Figuras 4-19, 4-24 e 4-27: expansão da Rede Básica.",
        "hipoteses": HIPOTESES_PDE2035,
        "relatorio": URL_PDE_RELATORIO, "caderno_de_dados": URL_PDE_DADOS,
        "figuras": figs, "camadas": camadas,
        "conferencia_relatorio": [
            {"descricao": "Soma das categorias da Figura 3-25 em dez/2025 contra o total rotulado no relatório (249 GW, p. 97)",
             "calculado_gw": c.r(soma25, 2), "relatorio_gw": 249, "diferenca_gw": c.r(soma25 - 249, 2), "tolerancia_gw": 0.5,
             "resultado": "aprovada" if abs(soma25 - 249) <= 0.5 else "divergente"},
            {"descricao": "Soma das categorias da Figura 3-25 em dez/2035 contra o total rotulado no relatório (359 GW, p. 97)",
             "calculado_gw": c.r(soma35, 2), "relatorio_gw": 359, "diferenca_gw": c.r(soma35 - 359, 2), "tolerancia_gw": 0.5,
             "resultado": "aprovada" if abs(soma35 - 359) <= 0.5 else "divergente"},
        ] + ([{"descricao": "Soma das fontes da Figura 3-6 em 2025 contra 'aproximadamente 251 GW' do texto (p. 72)",
               "calculado_gw": c.r(soma36, 2), "relatorio_gw": 251, "diferenca_gw": c.r(soma36 - 251, 2), "tolerancia_gw": 1.0,
               "resultado": "aprovada" if abs(soma36 - 251) <= 1.0 else "divergente"}] if soma36 is not None else []),
        "atualizacao_planilhas": (_meta(con, DS_PDE, "pde2035") or {}).get("atualizacao"),
        "vintage": {"arquivo": (vint_pde or {}).get("arquivo"), "sha256": (vint_pde or {}).get("sha256"),
                    "capturado_em": (vint_pde or {}).get("capturado_em")},
    }


# ================================================================== gold

def _series(con, ds, prefixo):
    rows = con.execute("SELECT DISTINCT serie FROM observacoes WHERE dataset=? AND serie LIKE ?",
                       (ds, prefixo + "%")).fetchall()
    return {s: base.serie_vigente(con, ds, s) for (s,) in rows}


def _agregados(con):
    cap = defaultdict(dict)
    for s, pts in _series(con, DS_AGREG, "cap_uf.kw.").items():
        uf = s.split(".")[-1]
        for ref, v in pts:
            cap[ref][uf] = v
    emp = defaultdict(dict)
    for s, pts in _series(con, DS_AGREG, "emp_op.kw.").items():
        t = s.split(".")[-1]
        for ref, v in pts:
            emp[ref][t] = v
    return {"cap_uf": cap, "cap_uf_refs": sorted(cap), "emp_op": emp, "emp_op_refs": sorted(emp)}


def _historico_mensal(con, mensais):
    """Série mensal do RALIE (última fotografia de cada mês) a partir do silver."""
    ug = _series(con, DS_RALIE, "ug.")
    us = _series(con, DS_RALIE, "usina.")
    ugd = {s: dict(p) for s, p in ug.items()}
    usd = {s: dict(p) for s, p in us.items()}
    out = []
    for d in mensais:
        def soma(prefixo, dic):
            return sum(v.get(d, 0.0) for s, v in dic.items() if s.startswith(prefixo))
        linha = {"ralie": d,
                 "usinas": int(soma("usina.n.tipo.", usd)),
                 "mw_outorgado": _r(_mw(soma("usina.kw_outorgado.tipo.", usd))),
                 "ugs": int(soma("ug.n.", ugd)),
                 "mw_ugs": _r(_mw(soma("ug.kw.", ugd))),
                 "mw_ugs_sem_previsao": _r(_mw(soma("ug.kw_sem_previsao.", ugd)))}
        for dim, vals in (("obra", ("Não Iniciada", "Em andamento", "Paralisada")),
                          ("viabilidade", ("Alta", "Média", "Baixa")),
                          ("cronograma", ("Normal", "Atrasado", "Adiantado"))):
            for val in vals:
                s = f"usina.kw_outorgado.{dim}.{val}"
                linha[f"mw_{dim}_{ax.entidades.slug(val).replace('-', '_')}"] = _r(_mw(usd.get(s, {}).get(d))) \
                    if d in usd.get(s, {}) else 0.0
        por_tipo = {}
        for s, v in ugd.items():
            if s.startswith("ug.kw.") and d in v:
                por_tipo[s.split(".")[-1]] = _r(_mw(v[d]))
        linha["mw_ugs_por_tipo"] = por_tipo
        out.append(linha)
    return out


def _valida(siga, ralie_ug, data_siga, hoje):
    """Controles físicos e de esquema (seção 5.2 do contrato). Retorna (críticos, ressalvas)."""
    criticos, ressalvas = [], []
    if len(siga) < 1000:
        criticos.append(f"SIGA com apenas {len(siga)} usinas")
    neg = [k for k, u in siga.items() if (u.get("kw_outorgado") or 0) < 0 or (u.get("kw_fiscalizado") or 0) < 0]
    if neg:
        criticos.append(f"{len(neg)} usinas do SIGA com potência negativa")
    fora = [k for k, u in siga.items() if u.get("lat") is not None and not (-34.5 <= u["lat"] <= 5.5 and -74.5 <= u["lon"] <= -28.5)]
    if fora:
        ressalvas.append(f"{len(fora)} usinas com coordenada fora do retângulo do território brasileiro: ficam fora do mapa.")
    if data_siga and data_siga > hoje.isoformat():
        criticos.append(f"data de geração do SIGA no futuro: {data_siga}")
    op_sem_pot = [k for k, u in siga.items() if u.get("fase") == "Operação" and not u.get("kw_fiscalizado")]
    if op_sem_pot:
        ressalvas.append(f"{len(op_sem_pot)} usinas na fase Operação com potência fiscalizada zero ou vazia no SIGA (mantidas; somam 0 kW).")
    fiscal_acima = [k for k, u in siga.items() if (u.get("kw_fiscalizado") or 0) > 1.2 * (u.get("kw_outorgado") or 0) > 0]
    if fiscal_acima:
        ressalvas.append(f"{len(fiscal_acima)} usinas com potência fiscalizada mais de 20% acima da outorgada (valor da fonte mantido).")
    negu = [k for k, x in ralie_ug.items() if (x.get("kw") or 0) < 0]
    if negu:
        criticos.append(f"{len(negu)} unidades do RALIE com potência negativa")
    return criticos, ressalvas


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    siga = {}
    for k, u in _estado(con, DS_SIGA, "usina:").items():
        u["fase"] = u.get("fase")
        siga[k] = u
    if not siga:
        return c.stub(GOLD, "SIGA ausente no silver da família aneel_geracao")
    vig = {ds: ckan.vintages_vigentes(con, ds) for ds in (DS_SIGA, DS_RALIE, DS_LIB, DS_ATOS, DS_LEILOES, DS_SIGET, DS_AGREG, DS_PDE)}
    meta_siga = _meta(con, DS_SIGA, "siga-empreendimentos-geracao-diario.csv")
    data_siga = meta_siga.get("data_geracao")
    ralie_us = _estado(con, DS_RALIE, "usina:")
    ralie_ug = _estado(con, DS_RALIE, "ug:")
    ralie_lei = _estado(con, DS_RALIE, "leilao:")
    if not ralie_us or not ralie_ug:
        return c.stub(GOLD, "RALIE atual ausente no silver")
    data_ralie = (_meta(con, DS_RALIE, "ralie-usina-atual.csv").get("datas_ralie") or [None])[-1]
    criticos, ressalvas = _valida(siga, ralie_ug, data_siga, hoje)
    if criticos:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticos))
    lib_linhas, lib_idx = _liberacoes(_estado(con, DS_LIB, "lib:"))
    v_lib = vig[DS_LIB].get("unidades-geradoras-liberadas-operacao-comercial-detalhado.csv")
    data_lib = max((x["realizado"] for x in lib_linhas if x["realizado"]), default=None)
    data_lib_arquivo = (v_lib or {}).get("publicado_em", "")[:10] or data_lib
    encerramentos = _estado(con, DS_ATOS, "enc:")
    lotes = _estado(con, DS_LEILOES, "lote:")
    epds = _estado(con, DS_SIGET, "epd:")
    lts = _estado(con, DS_SIGET, "lt:")
    eqps = _estado(con, DS_SIGET, "eqp:")
    resol = _estado(con, DS_SIGET, "resolucao:")
    agreg = _agregados(con)
    v_ug_hist = vig[DS_RALIE].get("ralie-unidade-geradora-historico.parquet")
    v_us_hist = vig[DS_RALIE].get("ralie-usina-historico.parquet")
    if not v_ug_hist or not v_us_hist:
        return c.stub(GOLD, "histórico do RALIE ausente no bronze")
    pf_ug = ax.abre_parquet(_bytes_bronze(v_ug_hist))
    pf_us = ax.abre_parquet(_bytes_bronze(v_us_hist))
    datas_hist = ax.datas_ralie(pf_us)
    mensais = ax.ultimo_por_mes(datas_hist)

    capacidade = _bloco_capacidade(siga, agreg, lib_linhas, data_siga)
    estagios = _bloco_estagios(siga, encerramentos, ralie_us, ralie_ug, ralie_lei, data_siga, data_ralie)
    # data de corte das liberações para a janela de confiabilidade: data de geração do
    # arquivo publicada pela ANEEL (last_modified do recurso)
    cronograma = _bloco_cronograma(con, ralie_us, ralie_ug, lib_linhas, lib_idx, data_ralie, data_lib_arquivo, pf_ug, mensais)
    cronograma["historico_fonte"].update({"primeira_fotografia": datas_hist[0], "fotografias": len(datas_hist),
                                          "ultima_fotografia": datas_hist[-1]})
    trajs = ax.trajetorias_usinas(pf_ug, pf_us)
    prim = ax.ugs_da_primeira_aparicao(pf_ug)
    del pf_ug
    desf = _desfechos(trajs, prim, lib_idx, siga, encerramentos, datas_hist[-1])
    estagios["coortes"] = _bloco_coortes(desf, datas_hist[0])
    estagios["desfechos_definicao"] = DESFECHOS
    estagios["historico_mensal"] = _historico_mensal(con, mensais)
    leiloes = _bloco_leiloes(lotes, (vig[DS_LEILOES].get("resultado-leiloes-transmissao.csv") or {}).get("publicado_em"))
    data_siget = ((vig[DS_SIGET].get("siget-contrato-empreendimento-obra-modulo.csv") or {}).get("publicado_em") or "")[:10] \
        or hoje.isoformat()
    obras = _bloco_obras(epds, lts, eqps, resol, data_siget)
    emp_siget = obras.pop("_emp")

    # geração e rede por UF (campos separados; nada é somado entre si)
    ger_uf = defaultdict(lambda: {"kw": 0.0, "kw24": 0.0})
    lim24 = (date.fromisoformat(data_ralie) + timedelta(days=730)).isoformat()
    for k, x in ralie_ug.items():
        u = ralie_us.get(k.split(":")[0], {})
        uf = u.get("uf")
        if not uf:
            continue
        ger_uf[uf]["kw"] += x.get("kw") or 0
        if x.get("previsao_sfg") and x["previsao_sfg"] <= lim24:
            ger_uf[uf]["kw24"] += x.get("kw") or 0
    rede_uf = {r["uf"]: r for r in obras["em_andamento_por_uf"]}
    ger_rede = [{"uf": uf, "mw_ugs_em_implantacao": _r(_mw(ger_uf[uf]["kw"])),
                 "mw_previsto_24_meses": _r(_mw(ger_uf[uf]["kw24"])),
                 "km_lt_em_andamento_toca_uf": (rede_uf.get(uf) or {}).get("km_lt_toca_uf", 0.0),
                 "mva_tr_em_andamento": (rede_uf.get(uf) or {}).get("mva_tr", 0.0),
                 "empreendimentos_transmissao_em_andamento": (rede_uf.get(uf) or {}).get("empreendimentos", 0)}
                for uf in sorted(set(ger_uf) | set(rede_uf))]
    lib_ano = defaultdict(float)
    for x in lib_linhas:
        if x["realizado"]:
            lib_ano[x["realizado"][:4]] += x["kw"] or 0
    ent = {x["ano"]: x for x in obras["entrada_por_ano"]}
    lei = {x["ano"]: x for x in leiloes["por_ano"]}
    serie_anual = [{"ano": a, "mw_geracao_liberada": _r(_mw(lib_ano.get(a))) if a in lib_ano else None,
                    "km_lt_energizados": (ent.get(a) or {}).get("km_lt_novas"),
                    "mva_tr_energizados": (ent.get(a) or {}).get("mva_tr_novos"),
                    "km_leiloados": (lei.get(a) or {}).get("km"), "mva_leiloados": (lei.get(a) or {}).get("mva"),
                    "ano_parcial": a == hoje.isoformat()[:4]}
                   for a in [str(y) for y in range(2005, hoje.year + 1)]]

    html_pde = None
    v_html = vig[DS_PDE].get("pde2035_pagina.html")
    if v_html:
        html_pde = _bytes_bronze(v_html).decode("utf-8", errors="replace")
    pde_obs = _series(con, DS_PDE, "pde2035.")
    cenarios = _bloco_cenarios(con, pde_obs, siga, ralie_us, ralie_ug, html_pde,
                               vig[DS_PDE].get("pde2035_dados_relatorio_final.zip"))

    _escreve_csvs(siga, ralie_us, ralie_ug, ralie_lei, desf, encerramentos, cenarios)

    gold = {
        **c.cabecalho(GOLD),
        "referencias": {"siga": data_siga, "ralie": data_ralie, "ralie_historico_desde": datas_hist[0],
                        "liberacoes_arquivo": data_lib_arquivo, "liberacoes_ultima_data": data_lib,
                        "atos": ((vig[DS_ATOS].get("atos-outorgas-aneel.csv") or {}).get("publicado_em") or "")[:10] or None,
                        "leiloes_transmissao": (leiloes["data_referencia"] or "")[:10] or None, "siget": data_siget,
                        "pde": "PDE 2035"},
        "regras": REGRAS,
        "ressalvas": ressalvas,
        "capacidade_instalada": capacidade,
        "estagios": estagios,
        "cronograma": cronograma,
        "transmissao": {"leiloes": leiloes, "obras": obras, "geracao_e_rede_por_uf": ger_rede, "serie_anual": serie_anual},
        "cenarios": cenarios,
    }
    gold["proveniencia"] = _proveniencias(con, gold, vig)
    gold["evidencias"] = _evidencias(gold, vig, siga, ralie_ug)
    gold["downloads"] = [{"rotulo": r, "url": DOWNLOADS[k]} for k, r in (
        ("usinas", "Usinas do SIGA com estágio, potência e coordenadas (CSV)"),
        ("pontos", "Pontos das usinas para mapa (JSON)"),
        ("capacidade_uf", "Capacidade em operação por UF, tipo e origem (CSV)"),
        ("carteira", "Carteira do RALIE por usina (CSV)"),
        ("unidades", "Unidades geradoras do RALIE com previsão (CSV)"),
        ("trajetorias", "Trajetória e desfecho das usinas do RALIE desde 2021 (CSV)"),
        ("confiabilidade", "Confiabilidade das previsões por fotografia (CSV)"),
        ("liberacoes", "Liberações comerciais e atraso por ano e tipo (CSV)"),
        ("encerramentos", "Atos de revogação e extinção de outorga (CSV)"),
        ("leiloes", "Leilões de transmissão por lote (CSV)"),
        ("obras", "Empreendimentos de transmissão do SIGET (CSV)"),
        ("pde", "PDE 2035: figuras usadas (CSV)"))]
    return gold


REGRAS = {
    "estagio": "Estágio = fase do SIGA: Operação; Construção; Construção não iniciada (outorgado sem obra). Encerramentos vêm dos atos de revogação (autorização) e extinção (concessão) publicados desde 2015.",
    "outorga": "Outorga não é capacidade que certamente entrará: o desfecho das usinas que passaram pelo RALIE é publicado ao lado da carteira.",
    "potencia": "Potência em MW (fiscalizada para usinas em operação; outorgada para a carteira). MW é potência, não energia: não equivale a energia firme nem a garantia física.",
    "previsao": "Previsão de operação comercial = campo DatPrevisaoOpComercialSFG do RALIE (previsão da fiscalização da ANEEL por unidade geradora), sempre com a data da fotografia em que foi registrada.",
    "confiabilidade": "Para cada fotografia mensal S (última do mês), potência das unidades com previsão em (S, S + 365 dias] e quanto dela foi liberada para operação comercial até S + 365 dias, depois disso ou não foi liberada até a data do arquivo de liberações. Só janelas encerradas pelo menos 15 dias antes dessa data.",
    "deslizamento": "Variação da previsão da mesma unidade entre a fotografia mensal S e a do mesmo mês do ano seguinte, ponderada pela potência (positivo = adiada).",
    "atraso_realizado": "Data de liberação comercial realizada menos a data outorgada da unidade no arquivo de liberações (cronograma outorgado vigente na publicação), mediana ponderada por kW.",
    "transmissao": "km de linhas novas e MVA de transformação nova (módulos de obras do tipo Instalação no SIGET) e investimento e RAP dos leilões ficam em campos separados; nunca são somados entre si.",
    "cenario": "PDE 2035 é CENÁRIO de uma edição específica (data-base janeiro de 2025), mostrado em camada separada do realizado (SIGA) e da carteira (RALIE).",
}


def _escreve_csvs(siga, ralie_us, ralie_ug, ralie_lei, desf, encerramentos, cenarios):
    linhas = []
    pontos = []
    for k in sorted(siga, key=int):
        u = siga[k]
        linhas.append([int(k), u.get("ceg"), u.get("nome"), u.get("tipo"), u.get("origem"), u.get("fonte"), u.get("fase"),
                       u.get("estagio"), u.get("outorga"), u.get("uf"), u.get("municipios"), u.get("lat"), u.get("lon"),
                       u.get("kw_outorgado"), u.get("kw_fiscalizado"), u.get("entrada_operacao"),
                       u.get("garantia_fisica_kwmed"), u.get("vigencia_inicio"), u.get("vigencia_fim"), u.get("cnpjs")])
        if u.get("lat") is not None and -34.5 <= u["lat"] <= 5.5 and -74.5 <= u["lon"] <= -28.5:
            pontos.append([int(k), u.get("nome"), u.get("tipo"), u.get("estagio"), u.get("uf"),
                           c.r(_mw(u.get("kw_outorgado")), 3), c.r(_mw(u.get("kw_fiscalizado")), 3),
                           round(u["lat"], 5), round(u["lon"], 5)])
    _csv(os.path.basename(DOWNLOADS["usinas"]),
                     ["nucleo_ceg", "ceg", "nome", "tipo", "origem", "fonte", "fase", "estagio", "outorga", "uf", "municipios",
                      "lat", "lon", "kw_outorgado", "kw_fiscalizado", "entrada_operacao", "garantia_fisica_kwmed",
                      "vigencia_inicio", "vigencia_fim", "cnpjs_proprietarios"],
                     linhas)
    base.escreve_gold(os.path.basename(DOWNLOADS["pontos"]),
                      {"colunas": ["nucleo", "nome", "tipo", "estagio", "uf", "mw_outorgado", "mw_fiscalizado", "lat", "lon"],
                       "linhas": pontos, "fonte": "ANEEL, SIGA (siga-empreendimentos-geracao-diario.csv)",
                       "nota": "Latitude e longitude oficiais do SIGA (centróide aproximado do empreendimento). Usinas sem coordenada (0 na fonte) não aparecem."},
                      destino=base.SERIES)
    kw_ug, n_ug, pmin, pmax, omax = defaultdict(float), defaultdict(int), {}, {}, {}
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        n_ug[n] += 1
        p = x.get("previsao_sfg")
        if p:
            pmin[n] = min(pmin.get(n, p), p)
            pmax[n] = max(pmax.get(n, p), p)
        if x.get("comercial_outorgado"):
            omax[n] = max(omax.get(n, ""), x["comercial_outorgado"])
    lei = defaultdict(list)
    for k in ralie_lei:
        n, cod = k.split(":", 1)
        lei[n].append(cod)
    cart = []
    for n in sorted(ralie_us, key=int):
        u = ralie_us[n]
        atraso = (date.fromisoformat(pmax[n]) - date.fromisoformat(omax[n])).days if n in pmax and omax.get(n) else None
        cart.append([int(n), u.get("ceg"), u.get("nome"), u.get("tipo"), u.get("uf"), u.get("kw_outorgado"), kw_ug.get(n),
                     n_ug.get(n), u.get("situacao_obra"), u.get("viabilidade"), u.get("situacao_cronograma"),
                     u.get("justificativa_previsao"), pmin.get(n), pmax.get(n), omax.get(n), atraso,
                     "|".join(sorted(lei.get(n, []))), (siga.get(n) or {}).get("fase")])
    _csv(os.path.basename(DOWNLOADS["carteira"]),
                     ["nucleo_ceg", "ceg", "nome", "tipo", "uf", "kw_outorgado", "kw_ugs_em_implantacao", "ugs", "situacao_obra",
                      "viabilidade", "situacao_cronograma", "justificativa_previsao", "previsao_min", "previsao_max",
                      "outorgado_max", "atraso_previsto_dias", "leiloes", "fase_siga"], cart)
    ugl = []
    for k in sorted(ralie_ug, key=lambda s: tuple(int(p) for p in s.split(":"))):
        n, ug = k.split(":")
        x = ralie_ug[k]
        u = ralie_us.get(n, {})
        ugl.append([int(n), int(ug), u.get("tipo"), u.get("uf"), x.get("kw"), x.get("comercial_outorgado"),
                    x.get("previsao_sfg"), x.get("teste_realizado")])
    _csv(os.path.basename(DOWNLOADS["unidades"]),
                     ["nucleo_ceg", "ug", "tipo", "uf", "kw", "comercial_outorgado", "previsao_sfg", "teste_realizado"], ugl)
    tr = []
    for n in sorted(desf):
        x = desf[n]
        tr.append([n, x.get("ceg"), x.get("nome"), x.get("tipo"), x.get("uf"), x.get("primeira"),
                   x.get("ultima"), x.get("kw_primeira"), x.get("prev_primeira"), x.get("outorgado_primeira"),
                   x.get("prev_ultima"), x.get("outorgado_ultima"), x.get("mudancas_previsao"), x.get("ugs_primeira"),
                   x.get("ugs_primeira_liberadas"), x.get("kw_primeira_liberado"), x.get("ultima_liberacao"),
                   x.get("desfecho"), x.get("data_encerramento")])
    _csv(os.path.basename(DOWNLOADS["trajetorias"]),
                     ["nucleo_ceg", "ceg", "nome", "tipo", "uf", "primeira_fotografia", "ultima_fotografia",
                      "kw_outorgado_primeira", "previsao_primeira", "outorgado_primeira", "previsao_ultima", "outorgado_ultima",
                      "mudancas_previsao", "ugs_primeira", "ugs_primeira_liberadas", "kw_primeira_liberado", "ultima_liberacao",
                      "desfecho", "data_encerramento"], tr)
    enc = []
    for k, x in sorted(encerramentos.items(), key=lambda kv: (kv[1].get("publicacao") or "", kv[0])):
        enc.append([x.get("publicacao"), x.get("encerramento"), x.get("nucleo"), x.get("ceg"), x.get("nome"),
                    x.get("tipo_geracao"), x.get("uf"), x.get("mw"), x.get("assunto"), x.get("ato"), x.get("numero"),
                    x.get("agente")])
    _csv(os.path.basename(DOWNLOADS["encerramentos"]),
                     ["publicacao", "encerramento", "nucleo_ceg", "ceg", "nome", "tipo", "uf", "mw", "assunto", "ato", "numero",
                      "agente"], enc)
    pde = []
    for chave, f in cenarios["figuras"].items():
        for lin in f["linhas"]:
            for col in f["colunas"]:
                pde.append([f["aba"], f["titulo"], lin["ref"], col, lin.get(col), f["unidade"]])
    _csv(os.path.basename(DOWNLOADS["pde"]), ["figura", "titulo", "referencia", "serie", "valor", "unidade"], pde)


FONTE_SIGA = {"orgao": "ANEEL", "dataset": "SIGA: Sistema de Informações de Geração da ANEEL",
              "recurso": "siga-empreendimentos-geracao-diario.csv", "url_dataset": URL_SIGA, "licenca": LICENCA_ANEEL}
FONTE_RALIE = {"orgao": "ANEEL", "dataset": "RALIE: Relatório de Acompanhamento da Expansão da Oferta de Geração",
               "recurso": "ralie-usina-atual.csv, ralie-unidade-geradora-atual.csv, ralie-leilao-atual.csv, ralie-usina-historico.parquet, ralie-unidade-geradora-historico.parquet",
               "url_dataset": URL_RALIE, "licenca": LICENCA_ANEEL}
FONTE_LIB = {"orgao": "ANEEL", "dataset": "Liberação para operação comercial de empreendimentos de geração",
             "recurso": "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv", "url_dataset": URL_LIB,
             "licenca": LICENCA_ANEEL}
FONTE_ATOS = {"orgao": "ANEEL", "dataset": "Atos de Outorgas de Geração", "recurso": "atos-outorgas-aneel.csv",
              "url_dataset": URL_ATOS, "licenca": LICENCA_ANEEL}
FONTE_LEILOES = {"orgao": "ANEEL", "dataset": "Resultado de leilões de geração e transmissão de energia elétrica",
                 "recurso": "resultado-leiloes-transmissao.csv", "url_dataset": URL_LEILOES, "licenca": LICENCA_ANEEL}
FONTE_SIGET = {"orgao": "ANEEL", "dataset": "Sistema de Gestão da Transmissão (SIGET)",
               "recurso": "siget-contrato-empreendimento-obra-modulo.csv, siget-resolucao-empreendimento-obra-modulo.csv, siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv, siget-contrato-moduloequipamento-subestacao.csv",
               "url_dataset": URL_SIGET, "licenca": LICENCA_ANEEL}
FONTE_PDE = {"orgao": "EPE", "dataset": "Plano Decenal de Expansão de Energia 2035", "recurso": "PDE 2035_Dados_Relatório Final.zip",
             "url_dataset": URL_PDE_PAGINA, "url_primaria": URL_PDE_DADOS, "licenca": LICENCA_EPE}


def _prov(con, ds, fonte, **kw):
    snap = c.snapshot_de(con, ds)
    f = {**fonte, "url_primaria": fonte.get("url_primaria") or fonte["url_dataset"]}
    return c.proveniencia(fonte=f, snapshot=snap, capturado_em=c.ultima_captura(snap), **kw)


def _proveniencias(con, g, vig):
    ref = g["referencias"]
    lim_siga = [
        "Potência em MW não é energia: a produção depende do fator de capacidade de cada fonte, e a garantia física (quando existe) é outra grandeza.",
        "Usina multiestadual é atribuída à UF principal informada pelo SIGA; a potência não é dividida entre UFs.",
        "O SIGA marca usina sem data de entrada em operação com 1900-01-03 e localização não informada com 0: os dois viram ausência.",
    ]
    lim_ralie = [
        "O RALIE só cobre usinas em implantação acompanhadas pela fiscalização; unidades que entram em operação comercial deixam de constar.",
        "A previsão é da fiscalização da ANEEL (SFG) e muda a cada fotografia; datas atribuídas em bloco a milhares de unidades sem licença de instalação ou sem acesso contratado indicam previsão convencional, não cronograma de obra.",
        "Outorga não é capacidade que certamente entrará; MW outorgado não é energia firme.",
    ]
    return {
        "capacidade": _prov(con, DS_SIGA, FONTE_SIGA, indicador="Capacidade instalada em operação por tipo, origem e UF",
                            natureza="CALCULADO", unidade="MW", frequencia="semanal (captura do arquivo diário)",
                            periodo={"inicio": ref["siga"], "fim": ref["siga"]}, cobertura={"inicio": ref["siga"], "fim": ref["siga"]},
                            transformacoes=["soma da potência fiscalizada (kW) das usinas na fase Operação", "kW ÷ 1.000 = MW"],
                            formula="capacidade(g) = Σ MdaPotenciaFiscalizadaKw das usinas com DscFaseUsina = Operação no grupo g ÷ 1.000",
                            limitacoes=lim_siga + ["Reconciliação com os agregados publicados pela ANEEL (por tipo e por UF) mostrada ao lado; os agregados têm mês de referência anterior ao SIGA."],
                            download=DOWNLOADS["capacidade_uf"]),
        "estagios": _prov(con, DS_SIGA, FONTE_SIGA, indicador="Parque do SIGA por estágio", natureza="CALCULADO", unidade="MW e usinas",
                          frequencia="semanal", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
                          cobertura={"inicio": ref["siga"], "fim": ref["siga"]},
                          transformacoes=["fase do SIGA → estágio", "soma da potência outorgada e da fiscalizada por estágio"],
                          formula="MW(estágio) = Σ MdaPotenciaOutorgadaKw das usinas na fase ÷ 1.000",
                          limitacoes=lim_siga + ["Potência fiscalizada de usina em construção é a parcela que já opera (ex.: parque com unidades liberadas)."],
                          download=DOWNLOADS["usinas"]),
        "encerramentos": _prov(con, DS_ATOS, FONTE_ATOS, indicador="Atos de revogação e extinção de outorga por ano", natureza="CALCULADO",
                               unidade="atos, usinas e MW declarado", frequencia="mensal",
                               periodo={"inicio": g["estagios"]["encerramentos"]["desde"], "fim": ref["atos"]},
                               cobertura={"inicio": "2015", "fim": ref["atos"]},
                               transformacoes=["filtro DscObjeto em {Autorização - Revogação, Concessão - Extinção}",
                                               "contagem por ano de publicação; soma da potência declarada no ato"],
                               formula="MW(ano) = Σ MdaPotenciaInstaladaMW dos atos de encerramento publicados no ano",
                               limitacoes=["O conjunto de atos começa em 2015; encerramentos anteriores não constam.",
                                           "Revogação de DRO, DRI e DRS (registros anteriores à outorga) não entra.",
                                           "A potência é a declarada no ato; atos sem potência contam como ato, não como 0 MW.",
                                           "O ano corrente é parcial."],
                               download=DOWNLOADS["encerramentos"]),
        "ralie": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Carteira em implantação (RALIE atual)", natureza="CALCULADO",
                       unidade="MW e usinas", frequencia="quinzenal", periodo={"inicio": ref["ralie"], "fim": ref["ralie"]},
                       cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                       transformacoes=["soma da potência outorgada por usina e da potência unitária das unidades listadas",
                                       "agrupamento pelas classificações da fiscalização (situação da obra, viabilidade, cronograma)"],
                       formula="MW em implantação = Σ MdaPotenciaUnitaria das unidades listadas ÷ 1.000",
                       limitacoes=lim_ralie, download=DOWNLOADS["carteira"]),
        "coortes": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Desfecho das usinas que passaram pelo RALIE", natureza="CALCULADO",
                         unidade="MW outorgado na primeira fotografia", frequencia="quinzenal",
                         periodo={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                         cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                         transformacoes=["primeira e última fotografia de cada usina (Parquet histórico)",
                                         "vínculo por núcleo do CEG com SIGA, liberações comerciais e atos de encerramento",
                                         "classificação em ordem: em implantação; operação; outorga encerrada; sem desfecho"],
                         formula="pct(desfecho) = 100 × Σ kW outorgado na primeira fotografia das usinas com o desfecho ÷ Σ kW da coorte",
                         limitacoes=lim_ralie + ["Usinas em operação parcial que seguem no RALIE contam como em implantação.",
                                                 "Sem desfecho não significa abandono: pode ser mudança de CEG, saída do acompanhamento ou ato fora do conjunto de atos."],
                         download=DOWNLOADS["trajetorias"]),
        "confiabilidade": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Confiabilidade das previsões de operação comercial em 12 meses",
                                natureza="CALCULADO", unidade="MW e %", frequencia="mensal (última fotografia do mês)",
                                periodo={"inicio": (g["cronograma"]["confiabilidade"] or [{}])[0].get("ralie"),
                                         "fim": (g["cronograma"]["confiabilidade"] or [{}])[-1].get("fim_janela")},
                                cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["liberacoes_arquivo"]},
                                transformacoes=["unidades com previsão SFG na janela (S, S + 365 dias]", "vínculo por núcleo do CEG e número da unidade com o arquivo de liberações (grupos '1 a 5' expandidos)",
                                                "unidades já liberadas antes de S excluídas do denominador"],
                                formula="pct_no_prazo(S) = 100 × Σ kW das unidades prometidas liberadas até S + 365 dias ÷ Σ kW prometido em S",
                                limitacoes=lim_ralie + ["Unidade renumerada pela fonte entre a fotografia e a liberação aparece como não liberada.",
                                                        "A data-base de cada previsão é a fotografia do RALIE; nenhuma previsão é reconstruída com o estoque atual."],
                                download=DOWNLOADS["confiabilidade"]),
        "atraso_realizado": _prov(con, DS_LIB, FONTE_LIB, indicador="Atraso realizado da liberação comercial em relação à data outorgada",
                                  natureza="CALCULADO", unidade="dias (mediana ponderada por kW) e %", frequencia="quinzenal",
                                  periodo={"inicio": "2014", "fim": ref["liberacoes_ultima_data"]},
                                  cobertura={"inicio": "2014", "fim": ref["liberacoes_ultima_data"]},
                                  transformacoes=["atraso = DatLiberOpComerRealizado − DatUGInicioOpComerOutorgado", "mediana ponderada pela potência liberada"],
                                  formula="mediana ponderada de (realizado − outorgado) com peso MdaPotenciaLiberadaComercial",
                                  limitacoes=["A data outorgada é a vigente na publicação do arquivo: se o cronograma foi alterado por ato posterior, o atraso é medido contra a data alterada.",
                                              "Antes de 2014 o arquivo detalhado não cobre toda a potência liberada no ano (nota da ANEEL).",
                                              "O ano corrente é parcial."],
                                  download=DOWNLOADS["liberacoes"]),
        "leiloes": _prov(con, DS_LEILOES, FONTE_LEILOES, indicador="Leilões de transmissão por ano", natureza="CALCULADO",
                         unidade="km, MVA, R$ milhões (nominais) e %", frequencia="mensal",
                         periodo={"inicio": (g["transmissao"]["leiloes"]["por_ano"] or [{}])[0].get("ano"),
                                  "fim": (g["transmissao"]["leiloes"]["por_ano"] or [{}])[-1].get("ano")},
                         cobertura={"inicio": "1999", "fim": ref["leiloes_transmissao"]},
                         transformacoes=["soma por ano do leilão de km, MVA, investimento previsto e RAP", "deságio agregado pela RAP"],
                         formula="deságio(ano) = 100 × (1 − Σ RAP vencedora ÷ Σ RAP do edital), lotes com as duas",
                         limitacoes=["Reais nominais da data de cada leilão, sem correção monetária: anos não são comparáveis em valor real.",
                                     "Investimento é o previsto no edital, não o realizado.", "km, MVA e reais são grandezas diferentes e nunca somadas."],
                         download=DOWNLOADS["leiloes"]),
        "obras": _prov(con, DS_SIGET, FONTE_SIGET, indicador="Empreendimentos de transmissão (SIGET)", natureza="CALCULADO",
                       unidade="km, MVA, empreendimentos e dias", frequencia="semanal (captura do arquivo diário)",
                       periodo={"inicio": ref["siget"], "fim": ref["siget"]}, cobertura={"inicio": "2005", "fim": ref["siget"]},
                       transformacoes=["km dos módulos de linha e MVA dos transformadores de potência com obra do tipo Instalação",
                                       "prazo legal vencido = em andamento ou planejado com data de operação do ato legal anterior à data do arquivo",
                                       "atraso realizado = data efetiva − data do ato legal"],
                       formula="km novos(empreendimento) = Σ NumEtnLinTms dos módulos LT distintos com obra de Instalação",
                       limitacoes=["As datas de previsão informadas pelas transmissoras não estão no arquivo aberto do SIGET: o atraso em andamento é medido contra o ato legal, não contra a previsão.",
                                   "Linha interestadual aparece nas duas UFs na tabela por UF: a soma das UFs supera o total nacional.",
                                   "Reatores e capacitores (Mvar) não entram no MVA de transformação.",
                                   "Sem geometria pública verificada das linhas (SIGEL da ANEEL não respondeu): o mapa é por UF."],
                       download=DOWNLOADS["obras"]),
        "cenarios": _prov(con, DS_PDE, FONTE_PDE, indicador="PDE 2035: capacidade, expansão indicativa, transmissão e geração",
                          natureza="CENARIO", unidade="GW, MW, km, MVA, R$ bilhões e TWh (por figura)", frequencia="por edição",
                          periodo={"inicio": "2025", "fim": "2035"}, cobertura={"inicio": "2025", "fim": "2035"},
                          transformacoes=["leitura das abas das figuras do caderno de dados, conferidas por título e rótulos de coluna"],
                          limitacoes=["Cenário de planejamento de uma edição (data-base janeiro de 2025), não previsão nem realizado.",
                                      "Categorias do PDE não correspondem uma a uma às do SIGA; só as correspondências diretas são mostradas lado a lado, sem diferença calculada.",
                                      "Valores monetários em reais conforme publicados pela EPE."],
                          download=DOWNLOADS["pde"]),
    }


def _evidencias(g, vig, siga, ralie_ug):
    ref = g["referencias"]
    v_siga = vig[DS_SIGA].get("siga-empreendimentos-geracao-diario.csv")
    v_ug = vig[DS_RALIE].get("ralie-unidade-geradora-historico.parquet")
    v_lib = vig[DS_LIB].get("unidades-geradoras-liberadas-operacao-comercial-detalhado.csv")
    v_lei = vig[DS_LEILOES].get("resultado-leiloes-transmissao.csv")
    v_siget = vig[DS_SIGET].get("siget-contrato-empreendimento-obra-modulo.csv")
    v_pde = vig[DS_PDE].get("pde2035_dados_relatorio_final.zip")
    cap = g["capacidade_instalada"]
    rec = cap["reconciliacao"]
    rec_ok = [x for x in rec["por_tipo"] if x["agregado_mw"] and abs(x["residuo_pct"] or 0) <= 0.5]
    ev = {}
    ev["capacidade_total"] = _evidencia(
        valor_exibido=f"{cap['total']['mw_fiscalizado']:,.0f} MW".replace(",", "."), valor_calculo=cap["total"]["mw_fiscalizado"],
        unidade="MW", periodo=ref["siga"], entidade="Brasil (SIN e sistemas isolados)",
        universo=f"{cap['total']['usinas']} usinas na fase Operação do SIGA", fonte=_fonte_ev("ANEEL", FONTE_SIGA["dataset"], FONTE_SIGA["recurso"], URL_SIGA, v_siga),
        formula="Σ MdaPotenciaFiscalizadaKw (fase Operação) ÷ 1.000", chaves_origem="IdeNucleoCEG das usinas na fase Operação (CSV de usinas)",
        cobertura="Todas as usinas do arquivo diário na fase Operação", tratamento_ausencia="Potência vazia não soma; linhas duplicadas idênticas contam uma vez.",
        download=[{"rotulo": "Usinas do SIGA (CSV)", "url": DOWNLOADS["usinas"]}],
        testes=[{"nome": "reconciliação por tipo com o agregado 'empreendimentos em operação'", "resultado": f"{len(rec_ok)} de {len(rec['por_tipo'])} tipos com resíduo até 0,5%",
                 "detalhe": "resíduo = SIGA − agregado − liberações comerciais entre o mês do agregado e a data do SIGA"}],
        reconciliacao={"descricao": f"Agregados publicados pela ANEEL (referência {rec['referencia_tipo']})", "resultado": rec["por_tipo"],
                       "tolerancia": "0,5% por tipo, depois de descontar as liberações comerciais do intervalo"},
        publicacao=(v_siga or {}).get("publicado_em"))
    ev["capacidade_total"]["citacao"] = _citacao("ANEEL", FONTE_SIGA["dataset"], URL_SIGA, (v_siga or {}).get("capturado_em"))
    nao_ini = next((x for x in g["estagios"]["resumo"] if x["estagio"] == "construcao_nao_iniciada"), None)
    if nao_ini:
        ev["outorgado_sem_obra"] = _evidencia(
            valor_exibido=f"{nao_ini['mw_outorgado']:,.0f} MW".replace(",", "."), valor_calculo=nao_ini["mw_outorgado"], unidade="MW",
            periodo=ref["siga"], entidade="Brasil", universo=f"{nao_ini['usinas']} usinas na fase Construção não iniciada",
            fonte=_fonte_ev("ANEEL", FONTE_SIGA["dataset"], FONTE_SIGA["recurso"], URL_SIGA, v_siga),
            formula="Σ MdaPotenciaOutorgadaKw (fase Construção não iniciada) ÷ 1.000", chaves_origem="IdeNucleoCEG (CSV de usinas, estagio = construcao_nao_iniciada)",
            cobertura="Arquivo diário do SIGA", tratamento_ausencia="Potência vazia não soma.",
            download=[{"rotulo": "Usinas do SIGA (CSV)", "url": DOWNLOADS["usinas"]}],
            testes=[{"nome": "outorga não somada à capacidade em operação", "resultado": "aprovado", "detalhe": "estágios disjuntos por fase"}],
            publicacao=(v_siga or {}).get("publicado_em"))
        ev["outorgado_sem_obra"]["citacao"] = _citacao("ANEEL", FONTE_SIGA["dataset"], URL_SIGA, (v_siga or {}).get("capturado_em"))
    est = next((x for x in g["estagios"]["coortes"] if x["coorte"] == "estoque_inicial"), None)
    if est:
        op = est["desfechos"]["operacao"]
        ev["coorte_inicial_operacao"] = _evidencia(
            valor_exibido=f"{op['pct_mw']:.1f}%".replace(".", ","), valor_calculo=op["pct_mw"], unidade="% do MW outorgado",
            periodo=f"{ref['ralie_historico_desde']} a {ref['ralie']}", entidade="Usinas na primeira fotografia do RALIE",
            universo=f"{est['usinas']} usinas, {est['mw_outorgado']} MW outorgados", fonte=_fonte_ev("ANEEL", FONTE_RALIE["dataset"], "ralie-usina-historico.parquet e ralie-unidade-geradora-historico.parquet", URL_RALIE, v_ug),
            formula="100 × Σ kW outorgado (primeira fotografia) das usinas com desfecho operação ÷ Σ kW da coorte",
            numerador={"descricao": "MW outorgado das usinas que entraram em operação", "valor": op["mw_outorgado"]},
            denominador={"descricao": "MW outorgado da coorte", "valor": est["mw_outorgado"]},
            chaves_origem="IdeNucleoCEG (CSV de trajetórias, coorte = primeira fotografia)", cobertura="Todas as usinas da primeira fotografia",
            tratamento_ausencia="Usina sem operação nem ato de encerramento fica em 'sem desfecho', nunca em operação.",
            download=[{"rotulo": "Trajetórias (CSV)", "url": DOWNLOADS["trajetorias"]}], publicacao=(v_ug or {}).get("publicado_em"))
        ev["coorte_inicial_operacao"]["citacao"] = _citacao("ANEEL", FONTE_RALIE["dataset"], URL_RALIE, (v_ug or {}).get("capturado_em"))
    conf = g["cronograma"]["confiabilidade"]
    if conf:
        u = conf[-1]
        ev["confiabilidade_ultima"] = _evidencia(
            valor_exibido=f"{u['pct_no_prazo']:.1f}%".replace(".", ","), valor_calculo=u["pct_no_prazo"], unidade="% do MW prometido",
            periodo=f"{u['ralie']} a {u['fim_janela']}", entidade="Unidades geradoras com previsão SFG nos 12 meses seguintes",
            universo=f"{u['ugs']} unidades, {u['mw_prometido']} MW", fonte=_fonte_ev("ANEEL", FONTE_RALIE["dataset"], "ralie-unidade-geradora-historico.parquet", URL_RALIE, v_ug),
            formula="100 × Σ kW liberado até o fim da janela ÷ Σ kW prometido na fotografia",
            numerador={"descricao": "MW liberado para operação comercial no prazo", "valor": u["mw_no_prazo"]},
            denominador={"descricao": "MW com previsão na janela", "valor": u["mw_prometido"]},
            exclusoes=[f"{u['ugs_excluidas_ja_liberadas']} unidades já liberadas antes da fotografia"],
            chaves_origem="(IdeNucleoCEG, NumUgUsina) na fotografia e no arquivo de liberações",
            cobertura="Fotografia mensal do RALIE e liberações até a data do arquivo", tratamento_ausencia="Unidade sem liberação conta como não liberada.",
            download=[{"rotulo": "Confiabilidade (CSV)", "url": DOWNLOADS["confiabilidade"]}], publicacao=(v_ug or {}).get("publicado_em"))
        ev["confiabilidade_ultima"]["citacao"] = _citacao("ANEEL", FONTE_RALIE["dataset"], URL_RALIE, (v_ug or {}).get("capturado_em"))
    atr = [x for x in g["cronograma"]["atraso_realizado"] if not x["ano_parcial"]]
    if atr:
        u = atr[-1]
        ev["atraso_realizado_ultimo_ano"] = _evidencia(
            valor_exibido=f"{u['mediana_dias_ponderada']} dias", valor_calculo=u["mediana_dias_ponderada"], unidade="dias",
            periodo=u["ano"], entidade="Unidades liberadas para operação comercial no ano", universo=f"{u['mw_liberado']} MW liberados",
            fonte=_fonte_ev("ANEEL", FONTE_LIB["dataset"], FONTE_LIB["recurso"], URL_LIB, v_lib),
            formula="mediana ponderada por kW de (DatLiberOpComerRealizado − DatUGInicioOpComerOutorgado)", pesos="MdaPotenciaLiberadaComercial",
            chaves_origem="linhas do arquivo detalhado com liberação no ano", cobertura="Arquivo detalhado de liberações",
            tratamento_ausencia="Linha sem data outorgada fica fora da mediana e é contada à parte.",
            download=[{"rotulo": "Liberações por ano (CSV)", "url": DOWNLOADS["liberacoes"]}], publicacao=(v_lib or {}).get("publicado_em"))
        ev["atraso_realizado_ultimo_ano"]["citacao"] = _citacao("ANEEL", FONTE_LIB["dataset"], URL_LIB, (v_lib or {}).get("capturado_em"))
    ob = g["transmissao"]["obras"]["em_andamento"]
    ev["transmissao_em_andamento"] = _evidencia(
        valor_exibido=f"{ob['km_lt_novas']:,.0f} km".replace(",", "."), valor_calculo=ob["km_lt_novas"], unidade="km",
        periodo=ref["siget"], entidade="Empreendimentos de transmissão em andamento", universo=f"{ob['empreendimentos']} empreendimentos",
        fonte=_fonte_ev("ANEEL", FONTE_SIGET["dataset"], "siget-contrato-empreendimento-obra-modulo.csv", URL_SIGET, v_siget),
        formula="Σ NumEtnLinTms dos módulos LT distintos com obra de Instalação em empreendimentos Em andamento",
        chaves_origem="IdeEpd, IdeObr, IdeMdl (CSV de obras)", cobertura="Rede Básica cadastrada no SIGET",
        tratamento_ausencia="Módulo sem extensão informada não soma.", download=[{"rotulo": "Obras de transmissão (CSV)", "url": DOWNLOADS["obras"]}],
        testes=[{"nome": "km e MVA em campos separados", "resultado": "aprovado", "detalhe": "nenhuma soma entre grandezas"}],
        publicacao=(v_siget or {}).get("publicado_em"))
    ev["transmissao_em_andamento"]["citacao"] = _citacao("ANEEL", FONTE_SIGET["dataset"], URL_SIGET, (v_siget or {}).get("capturado_em"))
    lei = g["transmissao"]["leiloes"]["por_ano"]
    if lei:
        u = lei[-1]
        ev["leiloes_ultimo_ano"] = _evidencia(
            valor_exibido=f"{u['km']:,.0f} km".replace(",", "."), valor_calculo=u["km"], unidade="km", periodo=u["ano"],
            entidade="Lotes de transmissão leiloados no ano", universo=f"{u['lotes']} lotes",
            fonte=_fonte_ev("ANEEL", FONTE_LEILOES["dataset"], FONTE_LEILOES["recurso"], URL_LEILOES, v_lei),
            formula="Σ MdaExtensaoLinhaTransmissaoKm dos lotes do ano", chaves_origem="NumLeilao e NumLoteLeilao (CSV de leilões)",
            cobertura="Leilões desde 1999", tratamento_ausencia="Lote sem linha soma 0 km (valor publicado pela fonte).",
            download=[{"rotulo": "Leilões de transmissão (CSV)", "url": DOWNLOADS["leiloes"]}], publicacao=(v_lei or {}).get("publicado_em"))
        ev["leiloes_ultimo_ano"]["citacao"] = _citacao("ANEEL", FONTE_LEILOES["dataset"], URL_LEILOES, (v_lei or {}).get("capturado_em"))
    f325 = g["cenarios"]["figuras"].get("fig_3_25")
    if f325:
        l35 = next((x for x in f325["linhas"] if x["ref"].startswith("2035")), None)
        if l35:
            tot = sum(v for k, v in l35.items() if k != "ref" and v is not None)
            ev["pde_capacidade_2035"] = _evidencia(
                valor_exibido=f"{tot:.0f} GW", valor_calculo=c.r(tot, 3), unidade="GW", periodo="dezembro de 2035 (CENÁRIO)",
                entidade="Matriz elétrica nacional no Cenário de Referência do PDE 2035", universo="categorias da Figura 3-25",
                fonte=_fonte_ev("EPE", FONTE_PDE["dataset"], "Capítulo 03, aba Figura 3-25", URL_PDE_DADOS, v_pde),
                formula="Σ das categorias da Figura 3-25 em 2035-12", chaves_origem="aba Figura 3-25 da planilha do Capítulo 03",
                cobertura="Edição PDE 2035", tratamento_ausencia="Não se aplica",
                reconciliacao={"descricao": "Total rotulado no relatório (p. 97)", "resultado": g["cenarios"]["conferencia_relatorio"],
                               "tolerancia": "0,5 GW (arredondamento do rótulo em GW inteiros)"},
                download=[{"rotulo": "PDE 2035 (CSV)", "url": DOWNLOADS["pde"]}], publicacao=None)
            ev["pde_capacidade_2035"]["citacao"] = "EPE/MME. Plano Decenal de Expansão de Energia 2035. Brasília: MME/EPE, 2026. Figura 3-25. Disponível em: " + URL_PDE_PAGINA
    return ev
