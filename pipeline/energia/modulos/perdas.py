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
- o ano aberto como acumulado de janeiro até o último mês publicado por quase todas, contra o
  mesmo recorte do ano anterior e sobre as mesmas distribuidoras;
- a área de atuação como o conjunto dos municípios do IBGE ligados à distribuidora pela
  relação oficial conjunto elétrico × município (ANEEL), cada vínculo conferido contra o
  cadastro de micro e minigeração distribuída (MMGD); município fora da relação entra pelo
  cadastro de MMGD com critério mínimo e marca própria; município com mais de uma
  distribuidora fica marcado e nenhum volume ou taxa é rateado por área;
- contexto social agregado (Censo 2022 do IBGE) nos municípios da área, sem causalidade.

O que o módulo não publica, e por quê (bloqueios com evidência no documento do módulo): a
perda não técnica regulatória e o custo total reconhecido em reais de cada processo estão só
em PDF, planilhas e painéis servidos por git.aneel.gov.br, www2.aneel.gov.br,
calculostarifarios.aneel.gov.br e biblioteca.aneel.gov.br, que respondem com desafio do
Cloudflare (HTTP 403, cf-mitigated: challenge) a qualquer cliente sem navegador; o portal
de relatórios responde com conexão encerrada. Não contornamos.
"""
import collections
import json
import os
import sys
import tempfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as evid  # noqa: E402
from pipeline.energia.fontes import aneel_perdas as ap  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "perdas.json"
ANO_CENSO = 2022
MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
                 "novembro", "dezembro"]
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
CSV_ACUM = "perdas_acumulado_ano.csv"
JSON_ANUAL = "perdas_anual.json"
JSON_EVID = "perdas_evidencias.json"
JSON_EVID_TARIFA = "perdas_evidencias_tarifa.json"
JSON_EVID_TECNICA = "perdas_evidencias_tecnica.json"
JSON_MUN = "perdas_municipios.json"
JSON_NACIONAL = "perdas_nacional.json"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "perdas", "gold": GOLD, "familia": "aneel_distribuicao", "ordem": 40,
    "datasets": [
        {"orgao": "ANEEL", "nome": "samp-balanco", "slug": "aneel-samp-balanco", "dataset_silver": DS_SAMP,
         "titulo": "SAMP: balanço energético das distribuidoras", "estado": "UTILIZADO EM INDICADOR", "url": URL_SAMP,
         "licenca": LICENCA_ANEEL, "paginas": PAGINA,
         "downloads": [_url(CSV_ANUAL), _url(CSV_MENSAL), _url(CSV_NACIONAL), _url(CSV_PT), _url(CSV_ACUM)],
         "quebras": [
             {"data": "2024-01-01", "origem": "PLATAFORMA", "descricao": "Leiaute da REN ANEEL 1.003/2022: linhas por nível de tensão com total próprio; a energia injetada publicada deixa de fechar o balanço com a perda calculada pela própria fonte (a fonte não explica a diferença); perdas técnicas e não técnicas deixam de ser publicadas para parte das distribuidoras (contagem por ano na série nacional)."},
             {"data": "2025-01-01", "origem": "FONTE", "descricao": "A ANEEL passa a calcular energia requerida e perdas não técnicas sobre o mercado medido em vez do faturado (Despacho 1.220/2025-STR)."},
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
        _url(CSV_ANUAL): "cnpj; sigla; nome; classificacao; ano; meses (competências publicadas no ano); completo (12 meses); injetada_publicada_mwh; injetada_referencia_mwh (denominador; ver origem_injetada); origem_injetada (publicada, requerida ou mista); perdas_totais_mwh (valor medido da fonte); taxa_total_pct (perdas totais ÷ injetada de referência); perdas_tecnicas_mwh (estimativa regulatória publicada pela fonte, só a do valor medido); taxa_tecnica_pct (sobre a injetada de referência); pnt_mwh (linha publicada 'Perdas Não-Técnicas', valor medido); pnt_injetada_pct; mercado_bt_mwh (energia medida em BT: cativo, consumo próprio e livre); pnt_bt_pct; perdas_totais_faturado_mwh; taxa_total_faturado_pct; perdas_linha_antiga_mwh (linha antiga Perdas do SAMP, base não identificada pela fonte; nunca somada à série medida); residuo_mwh (injetada publicada − fornecida − irregular − perdas); residuo_pct_injetada; reconciliacao (fecha, residuo_pequeno, residuo_relevante, sem_componentes); alertas (perda_total_negativa, perda_total_maior_que_injetada, fornecida_maior_que_injetada, balanco_nao_fecha, injetada_nao_positiva, representacoes_conflitantes: fora de agregados e comparações); taxa_tecnica_injetada_publicada_pct (técnica sobre a injetada publicada, a base em que a fonte aplica o percentual regulatório); residuo_decomposicao_mwh (perdas totais − técnicas − não técnicas); decomposicao (fecha, diferenca_pequena, nao_fecha, sem_separacao; nao_fecha fica fora dos agregados de técnica e não técnica); variacao_injetada_ano_anterior_pct; quebra_escala_ano_anterior (1 = injetada de referência mudou mais de 30% entre dois anos completos); absorcao_ano_anterior (1 = absorção provável observada no SAMP entre os dois anos); vazio no primeiro ano da série. Energia em MWh; percentuais em %. Somas sobre os meses publicados no ano (coluna meses); só completo = 1 entra em agregados e comparações, e nada é escalado para 12 meses. Vazio = ausência (a fonte não publicou o componente em algum dos meses presentes); zero é zero.",
        _url(CSV_MENSAL): "cnpj; competencia (AAAA-MM); valores em kWh como publicados no SAMP Balanço: injetada_publicada, injetada_referencia, origem_injetada, representacao (linha usada: todos=niveis, total=niveis, todos, total, niveis), fornecida_medida, outros_requisitos, irregular_faturada, perdas_totais_medidas, perdas_tecnicas, pnt_medidas, perdas_totais_faturadas, pnt_faturadas, perdas_linha_antiga, mercado_bt_medido, mmgd_injetada, residuo, conflitos (grandezas cujas representações divergem no mês), conflitos_abertos (divergência que nem a soma dos níveis nem o fechamento do balanço arbitrou; gera alerta), perdas_tecnicas_faturadas (linha técnica do valor faturado, diferente da medida em 13% dos meses; nunca usada no lugar dela), residuo_decomposicao (perdas totais − técnicas − não técnicas medidas). perdas_tecnicas é só a do valor medido. Vazio = linha ausente na fonte.",
        _url(CSV_NACIONAL): "ano; universo (concessionarias, permissionarias, todas); completo (0 = ano aberto, sem soma anual); n_distribuidoras (agentes com 12 meses e sem alerta físico); injetada_referencia_mwh; perdas_totais_mwh; taxa_total_pct; n_com_tecnica; injetada_com_tecnica_mwh; perdas_tecnicas_mwh; taxa_tecnica_pct; pnt_mwh; mercado_bt_mwh; pnt_bt_pct; excluidos (agentes-ano fora da soma e motivo); cobertura_tecnica_pct (injetada das que entram na técnica ÷ injetada das válidas); taxa_tecnica_injetada_publicada_pct; cobertura_bt_pct (mercado BT das que entram na não técnica ÷ mercado BT das válidas); universo_*_igual_ano_anterior (1 = mesmo conjunto de distribuidoras do ano anterior naquela medida); n_mesmas_* e *_mesmas_ano_anterior / *_mesmas (a mesma medida no ano anterior e no ano, só sobre as distribuidoras válidas nos dois anos e sem mudança de escala entre eles: é aí que se lê a variação anual); fora_por_mudanca_de_universo. Taxas agregadas = 100 × Σ numeradores ÷ Σ denominadores do mesmo subconjunto; a diferença entre linhas de universos diferentes é composição, não variação.",
        _url(CSV_PT): "cnpj; sigla; inicio (AAAA-MM); fim (AAAA-MM); percentual (% da energia injetada, constante no trecho); meses; resolucao_tarifaria (REH cuja vigência começa no mês de transição, quando existe); inicio_vigencia_reh; dia_prorata_diagnostico (dia em que a nova taxa teria começado, reconstituído da média pró-rata do mês de transição; diagnóstico, não data de vigência: coincide com o início da REH em poucos casos); classe (referencia = 6 meses ou mais; curto = possível coincidência de arredondamento, fora da gold); troca_pp (variação contra o trecho anterior). A REH só é associada quando o percentual muda ao menos 0,02 p.p. e o início de vigência cai no mês da troca; é coincidência de datas, a fonte não liga o percentual ao ato.",
        _url(CSV_TARIFA): "cnpj; sigla; resolucao; inicio_vigencia; fim_vigencia; base (Base Econômica ou Tarifa de Aplicação); tusd_pt; tusd_pnt; tusd_per_rb_d; te_per_rb; perdas (soma das quatro); tusd; te; total (TUSD + TE); participacao_perdas_pct; participacao_pnt_pct. Tarifa residencial B1 convencional, subclasse residencial, R$/MWh nominais, sem tributos.",
        _url(CSV_MUN): "cod_ibge; municipio; uf; cnpj; sigla; conjuntos (identificadores dos conjuntos elétricos que ligam o município à distribuidora; vazio no vínculo só por MMGD); empreendimentos_mmgd (da distribuidora no município); confirmado_mmgd (1 = há ao menos um); origem_vinculo (relacao = conjunto × município da ANEEL; mmgd = município fora da relação, ligado pelo cadastro de MMGD com ao menos 10 empreendimentos e 5% dos do município); distribuidoras_no_municipio; codigo_ibge_valido (1 = existe na lista de municípios do IBGE); distribuidora_no_samp (1 = a distribuidora tem balanço no SAMP e, portanto, valor de perdas).",
        _url(CSV_CONTEXTO): "cnpj; sigla; municipios_confirmados; municipios_exclusivos; populacao_confirmados (Censo 2022, municípios inteiros, sem rateio); populacao_exclusivos; cobertura_exclusivos_pct; renda_media_pc_confirmados_rs (média domiciliar per capita, ponderada por moradores); renda_media_pc_exclusivos_rs; area_km2_confirmados.",
        _url(CSV_ACUM): "nivel (universo ou distribuidora); chave (universo ou CNPJ); sigla; ano (ano aberto); mes_fim (último mês do recorte janeiro..mes_fim, o mesmo para todas); meses_ou_n (meses publicados da distribuidora ou número de distribuidoras somadas); comparavel (1 = completa e sem alerta nos dois anos, sem quebra de escala nem absorção entre os dois recortes); perdas_totais_mwh; injetada_referencia_mwh; taxa_total_pct; pnt_bt_pct; os mesmos campos do mesmo período do ano anterior (sufixo _ano_anterior); alertas. Agregado por universo = Σ numeradores ÷ Σ denominadores das distribuidoras comparáveis. Vazio = ausência.",
        _url(JSON_EVID): "Evidência 'Comprove este número' da taxa de perdas totais do ano de referência de cada distribuidora (CNPJ → objeto de pipeline/energia/evidencia.py), lida sob demanda.",
        _url(JSON_EVID_TARIFA): "Evidência 'Comprove este número' das componentes de perdas na tarifa residencial B1 do processo apresentado de cada distribuidora (vigente ou último já iniciado), com o arquivo anual de componentes tarifárias e o sha256 de onde o valor foi lido (CNPJ → evidência), lida sob demanda.",
        _url(JSON_EVID_TECNICA): "Evidência 'Comprove este número' do percentual técnico regulatório implícito no trecho de referência mais recente de cada distribuidora (CNPJ → evidência), com as razões mensais mínima e máxima do trecho, lida sob demanda.",
        _url(JSON_ANUAL): "Série anual por distribuidora (mesmos campos do CSV anual, em listas), para leitura sob demanda pela página.",
        _url(JSON_NACIONAL): "Série nacional completa (concessionárias, permissionárias e todas), com os mesmos campos da linha nacional da gold (que traz só as concessionárias): cobertura, marca de universo e comparação com o ano anterior nas mesmas distribuidoras; lida sob demanda.",
        _url(JSON_MUN): "Município IBGE → [índice da distribuidora, estado do vínculo: 0 relação sem confirmação, 1 relação confirmada pelo cadastro de MMGD, 2 só pelo cadastro de MMGD]; para o mapa.",
    },
}

# Versão 3 do silver: a técnica medida e a faturada ficam em séries próprias (tecnica_med,
# tecnica_fat); a série antiga "perdas_tecnicas" misturava as duas e deixa de ser lida.
CAMPOS_MES = ("injetada", "perdas_totais_med", "tecnica_med", "tecnica_fat", "pnt_med", "perdas_totais_fat", "pnt_fat",
              "perdas_legado", "fornecida_med", "outros_requisitos", "irregular", "bt_med", "mmgd", "n_linhas")


# ======================================================================= coleta
def _processados(con):
    con.execute("CREATE TABLE IF NOT EXISTS perdas_processados(dataset TEXT, vintage_id TEXT, processado_em TEXT,"
                " PRIMARY KEY(dataset, vintage_id))")


# Versão do processamento bronze → silver por dataset. Quando a leitura muda de um jeito que
# exige reprocessar a mesma vintage (campo novo no silver), a versão sobe e a marca antiga deixa
# de valer; os valores iguais não geram linha nova (grava_* só grava o que mudou).
VERSAO_PROCESSAMENTO = {DS_SAMP: "3"}


def _marca_de(ds, vid):
    v = VERSAO_PROCESSAMENTO.get(ds)
    return f"{vid}#v{v}" if v else vid


def _ja_processado(con, ds, vid):
    _processados(con)
    return con.execute("SELECT 1 FROM perdas_processados WHERE dataset=? AND vintage_id=?",
                       (ds, _marca_de(ds, vid))).fetchone() is not None


def _marca(con, ds, vid):
    con.execute("INSERT OR REPLACE INTO perdas_processados VALUES(?,?,?)", (ds, _marca_de(ds, vid), base.agora_utc()))


def _bytes_bronze(v):
    """Conteúdo inteiro de um arquivo pequeno do bronze (respostas JSON do IBGE). A API do
    IBGE responde com Content-Encoding gzip e o download guarda o corpo como veio; a
    assinatura 1f 8b identifica essa segunda camada, que é aberta aqui sem tocar no bronze."""
    with base.abre_bronze(v["arquivo"]) as f:
        return ap.descomprime_camadas(f.read())


class _ParquetTemporario:
    """Descomprime o Parquet do bronze (.parquet.gz) em fluxo para um arquivo temporário e
    devolve o caminho: o pyarrow lê em lotes a partir do disco, sem o arquivo inteiro na
    memória (o cadastro de MMGD tem mais de 100 MB)."""

    def __init__(self, v):
        self.v = v
        self.caminho = None

    def __enter__(self):
        import shutil
        fd, self.caminho = tempfile.mkstemp(prefix="perdas-", suffix=".parquet")
        with os.fdopen(fd, "wb") as dst, base.abre_bronze(self.v["arquivo"]) as src:
            shutil.copyfileobj(src, dst, 1 << 20)
        return self.caminho

    def __exit__(self, *exc):
        try:
            os.remove(self.caminho)
        except OSError:
            pass
        return False


def _processa_samp(con, v):
    with _ParquetTemporario(v) as caminho:
        meses, cadastro, dup = ap.pivota(ap.linhas_parquet(caminho))
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
        regs.append((f"{cnpj}|{comp}", "conflitos_sem_niveis", ",".join(m["conflitos_sem_niveis"]) or None))
    for cnpj in distribuidoras:
        cad = cadastro[cnpj]
        regs.append((cnpj, "nomes", json.dumps(cad["nomes"], ensure_ascii=False, sort_keys=True)))
        regs.append((cnpj, "classificacoes", json.dumps(cad["classificacoes"], ensure_ascii=False, sort_keys=True)))
    regs.append(("_arquivo", "duplicadas", json.dumps([[a, b, list(k), list(x)] for a, b, k, x in dup], ensure_ascii=False)))
    regs.append(("_arquivo", "agentes_total", str(len(cadastro))))
    # versão 2: a divergência entre representações vem separada em arbitrada pela soma dos
    # níveis (conflitos) e não arbitrada (conflitos_sem_niveis)
    regs.append(("_arquivo", "versao_conflitos", "2"))
    # versão 3: técnica medida e faturada em séries separadas (sem substituição entre bases)
    regs.append(("_arquivo", "versao_tecnica", "3"))
    regs.append(("_arquivo", "agentes_distribuicao", str(len(distribuidoras))))
    n1 = base.grava_observacoes(con, DS_SAMP, v["vintage_id"], obs)
    n2 = base.grava_registros(con, DS_SAMP, v["vintage_id"], regs)
    return {"observacoes": n1, "registros": n2, "distribuidoras": len(distribuidoras), "duplicadas": len(dup)}


def _processa_tarifa(con, v):
    with _ParquetTemporario(v) as caminho:
        sel = ap.filtra_componentes_b1(ap.linhas_componentes_parquet(caminho))
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
    with _ParquetTemporario(v) as caminho:
        cont = ap.contagem_mmgd(ap.linhas_mmgd_parquet(caminho))
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
_COLS_VINTAGE = ["vintage_id", "recurso", "url", "capturado_em", "publicado_em", "sha256", "bytes", "origem", "arquivo"]


def _vintage_da_observacao(con, dataset, serie, ref):
    """Vintage (arquivo do bronze com sha256) em que o valor vigente de (série, referência) foi
    lido. O silver só grava valor novo ou alterado: a vintage é a da captura que trouxe o valor."""
    row = con.execute(
        """SELECT v.vintage_id, v.recurso, v.url, v.capturado_em, v.publicado_em, v.sha256, v.bytes, v.origem, v.arquivo
           FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie=? AND o.ref=? ORDER BY v.capturado_em DESC LIMIT 1""",
        (dataset, serie, ref)).fetchone()
    return dict(zip(_COLS_VINTAGE, row)) if row else None


def _vintages_recentes(con, dataset):
    """Vintage mais recente de cada recurso de dados de um conjunto (evidência que usa vários
    arquivos). Dicionários de dados ficam de fora: documentam o conjunto, nenhum número sai deles."""
    rows = con.execute(
        """SELECT vintage_id, recurso, url, capturado_em, publicado_em, sha256, bytes, origem, arquivo FROM vintages v
           WHERE dataset=? AND capturado_em = (SELECT MAX(capturado_em) FROM vintages w WHERE w.dataset=v.dataset AND w.recurso=v.recurso)
           ORDER BY recurso""", (dataset,)).fetchall()
    return [dict(zip(_COLS_VINTAGE, r)) for r in rows
            if not str(r[1]).lower().startswith("dicion") and not str(r[1]).lower().endswith(".pdf")]


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
    com_arbitragem = regs.get("_arquivo", {}).get("versao_conflitos") == "2"
    tecnica_separada = regs.get("_arquivo", {}).get("versao_tecnica") == "3"
    for (serie, comp), valor in obs.items():
        campo, cnpj = serie.split(".", 1)
        mensal[cnpj].setdefault(comp, {})[campo] = int(round(valor))
    for cnpj, meses in mensal.items():
        for comp, m in meses.items():
            r = regs.get(f"{cnpj}|{comp}", {})
            m["injetada_repr"] = r.get("injetada_repr")
            m["conflitos"] = [x for x in (r.get("conflitos") or "").split(",") if x]
            # silver gravado antes deste campo existir: toda divergência conta como não arbitrada
            sem = r.get("conflitos_sem_niveis") if com_arbitragem else r.get("conflitos")
            m["conflitos_sem_niveis"] = [x for x in (sem or "").split(",") if x]
            # silver da versão 3: a técnica é só a do valor medido (a série antiga, que usava a
            # faturada quando a medida faltava, fica no banco mas não é lida)
            if tecnica_separada:
                m["perdas_tecnicas"] = m.get("tecnica_med")
            ap.deriva_mes(m)
    return dict(mensal), regs


def _silver_com_tecnica_separada(regs):
    return regs.get("_arquivo", {}).get("versao_tecnica") == "3"


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


def _anual_distribuidora(mensal_cnpj, ano, ate_mes=None):
    """Ano civil (ou janeiro..ate_mes, no acumulado do ano aberto) de uma distribuidora, com
    taxas, reconciliação e alertas. Completo = todos os meses do período com perda total e
    injetada de referência."""
    a = ap.anual(mensal_cnpj, ano, ate_mes)
    n = ate_mes or 12
    a["completo"] = a["meses"] == n and a["meses_perdas_totais_med"] == n and a["meses_injetada_ref"] == n
    a["reconciliacao"] = ap.estado_reconciliacao(a)
    a["alertas"] = ap.validade_anual(a)
    if a["meses_injetada_requerida"] == 0:
        a["origem_injetada"] = "publicada"
    elif a["meses_injetada_requerida"] == a["meses"]:
        a["origem_injetada"] = "requerida"
    else:
        a["origem_injetada"] = "mista"
    a["decomposicao"] = ap.estado_decomposicao(a)
    den = a["injetada_ref"]
    a["taxa_total"] = ap.taxa(a["perdas_totais_med"], den)
    # Técnica sobre a injetada de referência: mesma base da taxa total, para que a composição
    # (técnica + não técnica) se leia sobre um só denominador. Técnica sobre a injetada
    # publicada: a base sobre a qual a fonte aplica o percentual regulatório, a que se compara
    # com ele. Até 2023 as duas coincidem; no leiaute de 2024 a publicada é maior.
    a["taxa_tecnica"] = ap.taxa(a["perdas_tecnicas"], den)
    a["taxa_tecnica_publicada"] = ap.taxa(a["perdas_tecnicas"], a["injetada"])
    a["pnt_injetada"] = ap.taxa(a["pnt_med"], den)
    a["pnt_bt"] = ap.taxa(a["pnt_med"], a["bt_med"])
    a["taxa_total_fat"] = ap.taxa(a["perdas_totais_fat"], den)
    a["residuo_pct"] = ap.taxa(a["residuo"], a["injetada"])
    return a


def _valido_para_agregado(a):
    return a["completo"] and not a["alertas"] and a["injetada_ref"] is not None and a["perdas_totais_med"] is not None


def _valido_tecnica(a):
    """Técnica publicada nos 12 meses e decomposição que não contradiz a linha técnica."""
    return _valido_para_agregado(a) and a["perdas_tecnicas"] is not None and a["decomposicao"] != "nao_fecha"


def _valido_pnt_bt(a):
    """Não técnica e mercado BT nos 12 meses, com a decomposição fechando."""
    return (_valido_para_agregado(a) and a["pnt_med"] is not None and a["bt_med"] is not None
            and a["decomposicao"] in ap.DECOMPOSICAO_OK)


def _soma_nacional(validos):
    """Razões de somas sobre um subconjunto de agentes-ano válidos. Sem agente válido, tudo
    é ausente (None): zero só aparece quando a soma de valores publicados dá zero.

    Técnica: só quem publica a técnica medida nos 12 meses e não tem a decomposição quebrada;
    não técnica sobre BT: só quem tem não técnica e mercado BT nos 12 meses com a decomposição
    fechando. As coberturas vão ao lado (técnica em % da injetada de referência; não técnica em
    % do mercado BT de todas as válidas), porque o universo dessas duas medidas muda muito de
    um ano para outro (a fonte deixou de publicar a separação de metade das distribuidoras em
    2024). A chave "_exato" guarda somas em kWh e razões sem arredondamento, para a evidência e
    as comparações; ela não é publicada (_sem_privados)."""
    com_pt = [a for a in validos if _valido_tecnica(a)]
    com_bt = [a for a in validos if _valido_pnt_bt(a)]
    bt_todos = [a["bt_med"] for a in validos if a["bt_med"] is not None]
    inj = sum(a["injetada_ref"] for a in validos) if validos else None
    ptot = sum(a["perdas_totais_med"] for a in validos) if validos else None
    inj_pt = sum(a["injetada_ref"] for a in com_pt) if com_pt else None
    inj_pub_pt = (sum(a["injetada"] for a in com_pt)
                  if com_pt and all(a["injetada"] is not None for a in com_pt) else None)
    pt = sum(a["perdas_tecnicas"] for a in com_pt) if com_pt else None
    pnt = sum(a["pnt_med"] for a in com_bt) if com_bt else None
    bt = sum(a["bt_med"] for a in com_bt) if com_bt else None
    exato = {"injetada_kwh": inj, "perdas_totais_kwh": ptot, "taxa_total": ap.taxa(ptot, inj),
             "injetada_com_tecnica_kwh": inj_pt, "perdas_tecnicas_kwh": pt, "taxa_tecnica": ap.taxa(pt, inj_pt),
             "pnt_kwh": pnt, "mercado_bt_kwh": bt, "pnt_bt": ap.taxa(pnt, bt),
             "cnpjs_total": frozenset(a.get("cnpj") for a in validos),
             "cnpjs_tecnica": frozenset(a.get("cnpj") for a in com_pt),
             "cnpjs_pnt_bt": frozenset(a.get("cnpj") for a in com_bt)}
    return {
        "injetada_mwh": _r(_mwh(inj)), "perdas_totais_mwh": _r(_mwh(ptot)), "taxa_total_pct": _r(exato["taxa_total"], 2),
        "n_com_tecnica": len(com_pt), "injetada_com_tecnica_mwh": _r(_mwh(inj_pt)),
        "cobertura_tecnica_pct": _r(ap.taxa(inj_pt, inj), 1),
        "perdas_tecnicas_mwh": _r(_mwh(pt)), "taxa_tecnica_pct": _r(exato["taxa_tecnica"], 2),
        "taxa_tecnica_injetada_publicada_pct": _r(ap.taxa(pt, inj_pub_pt), 2),
        "n_com_pnt_bt": len(com_bt), "pnt_mwh": _r(_mwh(pnt)), "mercado_bt_mwh": _r(_mwh(bt)),
        "cobertura_bt_pct": _r(ap.taxa(bt, sum(bt_todos)) if bt_todos else None, 1),
        "pnt_bt_pct": _r(exato["pnt_bt"], 2),
        "_exato": exato,
    }


def _razao_mesmas(anuais, cnpjs, anos, num, den):
    """Razão de somas de `num` por `den` sobre as mesmas distribuidoras em cada ano de `anos`."""
    out = []
    for ano in anos:
        n = sum(anuais[(c, ano)][num] for c in cnpjs)
        d = sum(anuais[(c, ano)][den] for c in cnpjs)
        out.append(_r(ap.taxa(n, d), 2) if cnpjs else None)
    return out


def _nacional(anuais, grupos, anos, ano_ref=None, afetados=frozenset()):
    """Agregados por ano e universo: Σ numeradores ÷ Σ denominadores do mesmo subconjunto.
    Ano posterior ao de referência sai marcado como parcial (a soma anual dele é ausente,
    porque nenhuma distribuidora tem os 12 meses).

    O conjunto de distribuidoras somadas muda de um ano para outro (ano incompleto, alerta,
    início e fim de série, e, na separação técnica, a fonte que deixa de publicar). Por isso
    cada linha diz se o universo de cada medida é igual ao do ano anterior e traz a comparação
    com o ano anterior feita só sobre as MESMAS distribuidoras válidas nos dois anos, sem as que
    mudaram de escala entre eles (`afetados`: pares (cnpj, ano) com quebra de escala ou
    absorção entre ano−1 e ano). A variação anual se lê nesse bloco, nunca pela diferença entre
    duas linhas de universos diferentes."""
    linhas, por_chave = [], {}
    for ano in anos:
        for universo in ("concessionarias", "permissionarias", "todas"):
            sel = [(cnpj, a) for (cnpj, y), a in anuais.items() if y == ano
                   and (universo == "todas" or grupos.get(cnpj) == universo[:-1])]
            if not sel:
                continue
            for cnpj, a in sel:
                a.setdefault("cnpj", cnpj)
            validos = [a for _, a in sel if _valido_para_agregado(a)]
            excl = collections.Counter()
            for _, a in sel:
                if not a["completo"]:
                    excl["ano_incompleto"] += 1
                elif a["alertas"]:
                    excl[a["alertas"][0]] += 1
            soma = _soma_nacional(validos)
            linha = {"ano": ano, "universo": universo, "parcial": bool(ano_ref and ano > ano_ref),
                     "n_distribuidoras": len(validos), "n_publicadas": len(sel), **soma, "excluidos": dict(excl),
                     "universo_igual_ano_anterior": None, "mesmas_ano_anterior": None}
            ant = por_chave.get((ano - 1, universo))
            if ant is not None and validos and ant["n_distribuidoras"]:
                ex, ea = soma["_exato"], ant["_exato"]
                linha["universo_igual_ano_anterior"] = {
                    "total": ex["cnpjs_total"] == ea["cnpjs_total"], "tecnica": ex["cnpjs_tecnica"] == ea["cnpjs_tecnica"],
                    "pnt_bt": ex["cnpjs_pnt_bt"] == ea["cnpjs_pnt_bt"]}
                fora = {c for c in ex["cnpjs_total"] & ea["cnpjs_total"] if (c, ano) in afetados}
                mesmas = {}
                for medida, chave, num, den in (("total", "cnpjs_total", "perdas_totais_med", "injetada_ref"),
                                                ("tecnica", "cnpjs_tecnica", "perdas_tecnicas", "injetada_ref"),
                                                ("pnt_bt", "cnpjs_pnt_bt", "pnt_med", "bt_med")):
                    comuns = sorted((ex[chave] & ea[chave]) - fora)
                    mesmas[f"n_{medida}"] = len(comuns)
                    mesmas[{"total": "taxa_total_pct", "tecnica": "taxa_tecnica_pct", "pnt_bt": "pnt_bt_pct"}[medida]] = \
                        _razao_mesmas(anuais, comuns, (ano - 1, ano), num, den) if comuns else None
                mesmas["fora_por_mudanca_de_universo"] = len(fora)
                linha["mesmas_ano_anterior"] = mesmas
            por_chave[(ano, universo)] = linha
            linhas.append(linha)
    return linhas


def _universo_fixo(anuais, grupos, anos, afetados=frozenset(), universo="concessionarias"):
    """Série com universo fixo: as mesmas distribuidoras, válidas para a não técnica sobre BT
    (e portanto para a técnica) em todos os `anos`, sem mudança de escala entre eles. É a
    leitura de tendência que a série nacional não permite quando a fonte muda de universo
    (48, 33 e 19 concessionárias com a separação em 2023, 2024 e 2025)."""
    conjuntos = []
    for ano in anos:
        conjuntos.append({cnpj for (cnpj, y), a in anuais.items() if y == ano and _valido_pnt_bt(a)
                          and (universo == "todas" or grupos.get(cnpj) == universo[:-1])})
    comuns = set.intersection(*conjuntos) if conjuntos else set()
    comuns = sorted(c for c in comuns if not any((c, ano) in afetados for ano in anos[1:]))
    linhas = []
    for ano in anos:
        sel = [anuais[(c, ano)] for c in comuns]
        bt_todas = [a["bt_med"] for (cnpj, y), a in anuais.items() if y == ano and _valido_para_agregado(a)
                    and a["bt_med"] is not None and (universo == "todas" or grupos.get(cnpj) == universo[:-1])]
        soma = lambda campo: sum(a[campo] for a in sel) if sel else None  # noqa: E731
        linhas.append({"ano": ano, "taxa_total_pct": _r(ap.taxa(soma("perdas_totais_med"), soma("injetada_ref")), 2),
                       "taxa_tecnica_pct": _r(ap.taxa(soma("perdas_tecnicas"), soma("injetada_ref")), 2),
                       "pnt_bt_pct": _r(ap.taxa(soma("pnt_med"), soma("bt_med")), 2),
                       "pnt_mwh": _r(_mwh(soma("pnt_med"))), "mercado_bt_mwh": _r(_mwh(soma("bt_med"))),
                       "cobertura_bt_pct": _r(ap.taxa(soma("bt_med"), sum(bt_todas)) if bt_todas and sel else None, 1)})
    return {"universo": universo, "anos": list(anos), "n_distribuidoras": len(comuns), "cnpjs": comuns,
            "criterio": ("mesmas distribuidoras com os 12 meses, sem alerta, com não técnica, técnica e mercado BT "
                         "publicados e decomposição fechando em todos os anos, sem mudança de escala entre eles"),
            "linhas": linhas}


def _sem_privados(obj):
    """Cópia sem as chaves iniciadas por "_" (valores exatos e conjuntos de trabalho)."""
    if isinstance(obj, dict):
        return {k: _sem_privados(v) for k, v in obj.items() if not (isinstance(k, str) and k.startswith("_"))}
    if isinstance(obj, list):
        return [_sem_privados(v) for v in obj]
    return obj


def _mes_fim_parcial(mensal, anuais, ano_ref, ano_parcial):
    """Último mês do ano aberto que ao menos 90% das distribuidoras válidas no ano de
    referência já publicaram sem lacuna desde janeiro. Define o recorte janeiro..mês do
    acumulado, igual para todas (comparar recortes diferentes seria comparar calendários)."""
    base_ref = [cnpj for (cnpj, y), a in anuais.items() if y == ano_ref and _valido_para_agregado(a)]
    if not base_ref:
        return None
    alcance = []
    for cnpj in base_ref:
        k = 0
        while k < 12 and mensal[cnpj].get(f"{ano_parcial:04d}-{k + 1:02d}", {}).get("perdas_totais_med") is not None:
            k += 1
        alcance.append(k)
    for m in range(12, 0, -1):
        if sum(1 for k in alcance if k >= m) / len(alcance) >= 0.9:
            return m
    return None


def _acumulado(mensal, cadastro, grupos, ano_parcial, mes_fim, afetados=frozenset()):
    """Acumulado janeiro..mes_fim do ano aberto e do mesmo período do ano anterior, por
    distribuidora e agregado (Σ numeradores ÷ Σ denominadores sobre as MESMAS distribuidoras
    nos dois anos, completas e sem alerta nos dois recortes e sem mudança de escala entre eles:
    quebra de escala entre os dois recortes ou absorção em `afetados`)."""
    por_dist, pares = {}, []
    for cnpj in cadastro:
        m = mensal[cnpj]
        atual = _anual_distribuidora(m, ano_parcial, mes_fim)
        ant = _anual_distribuidora(m, ano_parcial - 1, mes_fim)
        if atual["meses"] == 0:
            continue
        atual["cnpj"] = ant["cnpj"] = cnpj
        _, quebra = ap.quebra_escala(ant, atual)
        ok = (_valido_para_agregado(atual) and _valido_para_agregado(ant) and not quebra
              and (cnpj, ano_parcial) not in afetados)
        por_dist[cnpj] = {"atual": atual, "anterior": ant, "comparavel": ok}
        if ok:
            pares.append((cnpj, atual, ant))
    agregados = []
    for universo in ("concessionarias", "permissionarias", "todas"):
        sel = [(a, b) for cnpj, a, b in pares if universo == "todas" or grupos.get(cnpj) == universo[:-1]]
        if not sel:
            continue
        agregados.append({"universo": universo, "n_distribuidoras": len(sel),
                          "atual": _soma_nacional([a for a, _ in sel]), "anterior": _soma_nacional([b for _, b in sel])})
    return por_dist, agregados


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
    """Trechos do percentual técnico implícito com a resolução homologatória associada.

    A REH só é associada quando há troca observada de percentual: variação de ao menos
    LIMIAR_TROCA_PP (0,02 p.p.) contra o trecho anterior (ou, no primeiro trecho, contra a razão
    do mês anterior ao início) E início de vigência da REH no mês de transição ou no primeiro
    mês do trecho. Percentual igual ao anterior não tem troca, e a coincidência de mês com uma
    REH não é ligação (DCELT 7,28% em 2019, 2021 e 2022, cada vez com uma REH diferente)."""
    segs = ap.segmentos_pt(mensal_cnpj)
    inicios = sorted({p["inicio"] for p in processos})
    out = []
    for i, s in enumerate(segs):
        ano, mes = int(s["inicio"][:4]), int(s["inicio"][5:7])
        # mês de transição: o anterior ao início do trecho, quando há trecho antes
        ant = f"{ano - (1 if mes == 1 else 0):04d}-{(12 if mes == 1 else mes - 1):02d}"
        if i > 0:
            pct_antes = segs[i - 1]["pct"]
        else:
            m_ant = mensal_cnpj.get(ant) or {}
            pct_antes = (round(100.0 * m_ant["perdas_tecnicas"] / m_ant["injetada"], 3)
                         if m_ant.get("perdas_tecnicas") is not None and m_ant.get("injetada") else None)
        troca = None if pct_antes is None else round(s["pct"] - pct_antes, 3)
        reh, dia = None, None
        cands = [x for x in inicios if x[:7] in (ant, s["inicio"])]
        if cands and troca is not None and abs(troca) >= ap.LIMIAR_TROCA_PP:
            p = next(p for p in processos if p["inicio"] == cands[-1])
            reh = {"resolucao": p["resolucao"], "inicio_vigencia": p["inicio"]}
        if i > 0 and ant in mensal_cnpj:
            m = mensal_cnpj[ant]
            if m.get("perdas_tecnicas") is not None and m.get("injetada"):
                pct_mes = 100.0 * m["perdas_tecnicas"] / m["injetada"]
                dia = ap.dia_inicio_prorata(pct_mes, segs[i - 1]["pct"], s["pct"], int(ant[:4]), int(ant[5:7]))
        out.append({**s, "troca_pp": troca, "reh": reh, "dia_inicio_prorata": dia,
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


def _relacao(con, hoje, ano=None):
    """Relação conjunto × distribuidora (limites de continuidade do ano) × município
    (IndQual), no ano pedido ou, sem ano, no mais recente até o ano corrente."""
    regs_lim = base.registros_como_estavam_em(con, DS_LIMITES)
    anos = sorted({int(k.split("|")[0]) for k in regs_lim if int(k.split("|")[0]) <= hoje.year})
    if not anos or (ano is not None and ano not in anos):
        return None
    ano = anos[-1] if ano is None else ano
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


def _hoje_brasilia():
    """Data civil em America/Sao_Paulo (UTC−3 fixo, sem horário de verão desde 2019, quando a
    base de fusos não está disponível)."""
    from datetime import datetime, timedelta, timezone
    try:
        from zoneinfo import ZoneInfo
        fuso = ZoneInfo("America/Sao_Paulo")
    except Exception:
        fuso = timezone(timedelta(hours=-3))
    return datetime.now(timezone.utc).astimezone(fuso).date()


def _contexto(ibge, conf, excl):
    """População, área e renda domiciliar per capita (Censo) de um conjunto de municípios
    inteiros; renda = Σ(renda média × moradores) ÷ Σ moradores. None sem dado do IBGE."""
    pop, ren, mor, area = (ibge.get(k, {}) for k in ("populacao", "renda_media_pc", "moradores_dpp", "area_km2"))
    if not pop:
        return None
    pop_c = sum(pop.get(x, 0) for x in conf if x in pop)
    pop_e = sum(pop.get(x, 0) for x in excl if x in pop)
    rc, nrc = ap.media_ponderada(ren, mor, conf)
    re_, _ = ap.media_ponderada(ren, mor, excl)
    return {"populacao_confirmados": _r(pop_c), "populacao_exclusivos": _r(pop_e),
            "cobertura_exclusivos_pct": _r(ap.taxa(pop_e, pop_c), 1),
            "renda_media_pc_confirmados": _r(rc, 2), "renda_media_pc_exclusivos": _r(re_, 2),
            "municipios_com_renda": nrc, "area_km2_confirmados": _r(sum(area.get(x, 0) for x in conf), 0),
            "_renda_exata": rc}


def _municipios_do_ano(rel):
    """{cnpj: (municípios, modo)} de uma relação conjunto × distribuidora × município.

    modo "mmgd": vínculos confirmados pelo cadastro de MMGD (há empreendimento da distribuidora
    no município). O cadastro é o atual e registra a distribuidora de hoje: distribuidora
    incorporada depois do ano da relação não tem nenhum empreendimento nele (EBO e ENF em
    2022). Para essas, modo "uf_principal": valem os vínculos da UF da maior parte deles, o que
    barra o erro de código de município homônimo de outra UF, o único que a confirmação por
    MMGD pegava na relação oficial."""
    por = collections.defaultdict(lambda: {"conf": set(), "todos": set()})
    mmgd_total = collections.Counter()
    for (cnpj, cod), n in rel["mmgd"].items():
        mmgd_total[cnpj] += n
    for (cnpj, cod), e in rel["vinculos"].items():
        por[cnpj]["todos"].add((cod, e["uf"]))
        if rel["mmgd"].get((cnpj, cod), 0) > 0:
            por[cnpj]["conf"].add(cod)
    out = {}
    for cnpj, d in por.items():
        if mmgd_total[cnpj] > 0:
            out[cnpj] = (d["conf"], "mmgd")
        else:
            ufs = collections.Counter(uf for _, uf in d["todos"] if uf)
            principal = ufs.most_common(1)[0][0] if ufs else None
            out[cnpj] = ({cod for cod, uf in d["todos"] if uf == principal}, "uf_principal")
    return out


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _arquivo_vigente(snap, prefixo=None):
    caps = [x for x in snap.get("capturas", []) if not prefixo or x["recurso"].startswith(prefixo)]
    return caps[-1] if caps else None


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
    if not _silver_com_tecnica_separada(regs_samp):
        ressalvas.append("silver anterior à versão 3: técnica medida e faturada ainda misturadas; reprocessar o SAMP")
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
                anuais[(cnpj, ano)]["cnpj"] = cnpj
    ano_ref, ano_parcial = _ano_referencia(anuais, hoje)
    if ano_ref is None:
        return c.stub(GOLD, "nenhum ano civil encerrado com ao menos 90% das distribuidoras completas")

    # ---------------------------------------------------------------- mudanças de universo
    # Absorções e sucessões observadas no próprio SAMP e quebra de escala em todo par de anos
    # completos: o par (ano−1, ano) afetado não entra em variação anual nem na comparação das
    # mesmas distribuidoras da série nacional.
    absorcoes, sucessoes = ap.mudancas_de_universo({x: mensal[x] for x in cadastro}, ultima_comp)
    eventos_escala = collections.defaultdict(list)
    for e in absorcoes:
        eventos_escala[e["cnpj"]].append(e["competencia"])
    pares = {}
    for (cnpj, ano), a in anuais.items():
        ant = anuais.get((cnpj, ano - 1))
        variacao_inj, quebra = ap.quebra_escala(ant, a)
        absorcao = ap.par_afetado(eventos_escala.get(cnpj, []), ano) and ant is not None
        pares[(cnpj, ano)] = {"variacao_injetada": variacao_inj, "quebra_escala": quebra, "absorcao": absorcao,
                              "universo_muda": quebra or absorcao}
    afetados = frozenset(k for k, v in pares.items() if v["universo_muda"])
    nacional = _nacional(anuais, grupos, anos, ano_ref, afetados)
    universo_fixo = _universo_fixo(anuais, grupos, [ano_ref - 2, ano_ref - 1, ano_ref], afetados)
    nac_ref = next(x for x in nacional if x["ano"] == ano_ref and x["universo"] == "concessionarias")
    if not (5 <= (nac_ref["taxa_total_pct"] or 0) <= 30):
        criticas.append(f"taxa nacional {nac_ref['taxa_total_pct']}% fora da faixa física plausível de 5% a 30%")
    if criticas:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticas))
    ultimo_mes_parcial, mes_fim, acum_dist, acum_nac = None, None, {}, []
    if ano_parcial:
        ultimo_mes_parcial = max(comp for m in mensal.values() for comp in m if comp.startswith(str(ano_parcial)))
        mes_fim = _mes_fim_parcial(mensal, anuais, ano_ref, ano_parcial)
        if mes_fim:
            acum_dist, acum_nac = _acumulado(mensal, cadastro, grupos, ano_parcial, mes_fim, afetados)

    # ---------------------------------------------------------------- tarifa e percentual técnico
    processos = _processos_tarifa(con)
    snap_tarifa = c.snapshot_de(con, DS_TARIFA)

    # ---------------------------------------------------------------- relação municipal e IBGE
    rel = _relacao(con, hoje)
    ibge, loc = _ibge(con)
    snap_lim, snap_iq, snap_mmgd, snap_ibge = (c.snapshot_de(con, d) for d in (DS_LIMITES, DS_INDQUAL, DS_MMGD, DS_IBGE))
    municipios = {}
    por_dist = collections.defaultdict(lambda: {"confirmados": set(), "nao_confirmados": set(), "so_mmgd": set()})
    if rel:
        for (cnpj, cod), e in rel["vinculos"].items():
            n = rel["mmgd"].get((cnpj, cod), 0)
            conf = n > 0
            municipios.setdefault(cod, {"uf": e["uf"], "nome": e["nome"], "dist": []})["dist"].append(
                {"cnpj": cnpj, "conjuntos": sorted(e["conjuntos"], key=lambda x: int(x) if x.isdigit() else 0),
                 "mmgd": n, "confirmado": conf, "origem": "relacao"})
            por_dist[cnpj]["confirmados" if conf else "nao_confirmados"].add(cod)
        # Municípios da lista do IBGE que nenhum conjunto liga a uma distribuidora (emancipados
        # recentes, conjuntos batizados com o nome de outro município): o cadastro de MMGD indica
        # a distribuidora que conecta as unidades do município. Vínculo marcado como "só MMGD",
        # com critério mínimo contra erro de cadastro; nunca entra no contexto social.
        sem_vinculo = set(loc) - set(municipios) if loc else set()
        for cod, lista in ap.vinculos_so_mmgd(sem_vinculo, rel["mmgd"]).items():
            nome, uf = loc[cod]
            for cnpj, n in lista:
                municipios.setdefault(cod, {"uf": uf, "nome": nome, "dist": []})["dist"].append(
                    {"cnpj": cnpj, "conjuntos": [], "mmgd": n, "confirmado": True, "origem": "mmgd"})
                por_dist[cnpj]["so_mmgd"].add(cod)
    for cod, m in municipios.items():
        m["valido"] = cod in loc if loc else None
        m["n_confirmadas"] = sum(1 for d in m["dist"] if d["confirmado"])
    municipios_sem_vinculo = sorted(set(loc) - set(municipios)) if loc else []

    # ---------------------------------------------------------------- identidade e continuidade
    # CNPJ com dígito verificador inválido é mantido como a fonte publicou (a chave continua
    # sendo o CNPJ publicado) e marcado; CNPJs com a mesma raiz (8 dígitos, mesma empresa) no
    # universo ficam ligados por correspondência explícita, com a origem da ligação.
    sucessao_de = {e["cnpj"]: e for e in sucessoes}
    continua_em = collections.defaultdict(list)
    for e in sucessoes:
        continua_em[e["anterior"]].append({"cnpj": e["cnpj"], "tipo": "sucessao"})
    for e in absorcoes:
        for x in e["encerradas"]:
            continua_em[x].append({"cnpj": e["cnpj"], "tipo": "absorcao"})
    por_raiz = collections.defaultdict(list)
    for cnpj in cadastro:
        por_raiz[cnpj[:8]].append(cnpj)
    dv_valido = {cnpj: ap.cnpj_dv_valido(cnpj) for cnpj in cadastro}

    def _correspondencias(cnpj):
        out = []
        for outro in sorted(por_raiz[cnpj[:8]]):
            if outro == cnpj:
                continue
            origem = [f"mesma raiz de CNPJ ({cnpj[:8]}) nos agentes do SAMP Balanço"]
            for x in (cnpj, outro):
                if not dv_valido[x]:
                    origem.append(f"o CNPJ {entidades.cnpj_formatado(x)}, como publicado pela fonte, tem dígito verificador inválido")
            for x, y in ((cnpj, outro), (outro, cnpj)):
                e = sucessao_de.get(y)
                if e and e["anterior"] == x:
                    origem.append(f"a série de {entidades.cnpj_formatado(x)} termina em {max(mensal[x])} e a de "
                                  f"{entidades.cnpj_formatado(y)} começa em {e['competencia']}, com energia mensal "
                                  f"{str(e['razao_energia']).replace('.', ',')} vez a anterior")
            out.append({"cnpj": outro, "sigla": cadastro[outro]["sigla"], "regra": "mesma_raiz_cnpj", "origem": "; ".join(origem)})
        return out

    # ---------------------------------------------------------------- por distribuidora
    distribuidoras, csv_anual, serie_json, csv_pt = [], [], {}, []
    csv_mensal = []
    # vigência de tarifa se confere na data civil de Brasília (as datas das REH são locais; o
    # `hoje` do contexto é a data UTC, que vira o dia às 21h de Brasília)
    hoje_iso = (ctx.get("hoje_brasilia") or _hoje_brasilia()).isoformat()
    # dados das evidências por distribuidora do percentual técnico (P057) e da tarifa (P058)
    dados_ev_tecnica, dados_ev_tarifa = {}, {}
    for cnpj in sorted(cadastro, key=lambda x: (cadastro[x]["sigla"] or cadastro[x]["nome"])):
        cad = cadastro[cnpj]
        m = mensal[cnpj]
        comps = sorted(m)
        linhas_serie = []
        for ano in anos:
            a = anuais.get((cnpj, ano))
            if not a:
                continue
            par = pares[(cnpj, ano)]
            tem_par = anuais.get((cnpj, ano - 1)) is not None
            linha = [cnpj, cad["sigla"], cad["nome"], cad["classificacao"], ano, a["meses"], int(a["completo"]),
                     _mwh(a["injetada"]), _mwh(a["injetada_ref"]), a["origem_injetada"], _mwh(a["perdas_totais_med"]),
                     _r(a["taxa_total"], 3), _mwh(a["perdas_tecnicas"]), _r(a["taxa_tecnica"], 3), _mwh(a["pnt_med"]),
                     _r(a["pnt_injetada"], 3), _mwh(a["bt_med"]), _r(a["pnt_bt"], 3), _mwh(a["perdas_totais_fat"]),
                     _r(a["taxa_total_fat"], 3), _mwh(a["perdas_legado"]), _mwh(a["residuo"]), _r(a["residuo_pct"], 3),
                     a["reconciliacao"], ",".join(a["alertas"]),
                     _r(a["taxa_tecnica_publicada"], 3), _mwh(a["residuo_decomposicao"]), a["decomposicao"],
                     _r(100 * par["variacao_injetada"], 1) if par["variacao_injetada"] is not None else None,
                     int(par["quebra_escala"]) if tem_par else None, int(par["absorcao"]) if tem_par else None]
            csv_anual.append(linha)
            linhas_serie.append([ano, a["meses"], int(a["completo"]), _r(_mwh(a["injetada_ref"])), _r(_mwh(a["perdas_totais_med"])),
                                 _r(a["taxa_total"], 2), _r(_mwh(a["perdas_tecnicas"])), _r(a["taxa_tecnica"], 2),
                                 _r(_mwh(a["pnt_med"])), _r(a["pnt_bt"], 2), _r(_mwh(a["bt_med"])),
                                 _r(a["residuo_pct"], 2), a["reconciliacao"], a["alertas"], a["origem_injetada"],
                                 a["decomposicao"], _r(a["taxa_tecnica_publicada"], 2),
                                 int(par["universo_muda"]) if tem_par else None])
        serie_json[cnpj] = linhas_serie
        for comp in comps:
            x = m[comp]
            csv_mensal.append([cnpj, comp, x.get("injetada"), x.get("injetada_ref"), x.get("injetada_ref_origem"),
                               x.get("injetada_repr"), x.get("fornecida_med"), x.get("outros_requisitos"), x.get("irregular"),
                               x.get("perdas_totais_med"), x.get("perdas_tecnicas"), x.get("pnt_med"),
                               x.get("perdas_totais_fat"), x.get("pnt_fat"), x.get("perdas_legado"), x.get("bt_med"), x.get("mmgd"),
                               x.get("residuo"), ",".join(x.get("conflitos") or []), ",".join(x.get("conflitos_abertos") or []),
                               x.get("tecnica_fat"), x.get("residuo_decomposicao")])
        # ano de referência e comparação com o ano anterior completo
        a = anuais.get((cnpj, ano_ref))
        ref = None
        if a:
            ref = {"ano": ano_ref, "meses": a["meses"], "completo": a["completo"],
                   "injetada_mwh": _r(_mwh(a["injetada_ref"])), "origem_injetada": a["origem_injetada"],
                   "perdas_totais_mwh": _r(_mwh(a["perdas_totais_med"])), "taxa_total_pct": _r(a["taxa_total"], 2),
                   "perdas_tecnicas_mwh": _r(_mwh(a["perdas_tecnicas"])), "taxa_tecnica_pct": _r(a["taxa_tecnica"], 2),
                   "taxa_tecnica_injetada_publicada_pct": _r(a["taxa_tecnica_publicada"], 2),
                   "pnt_mwh": _r(_mwh(a["pnt_med"])), "pnt_injetada_pct": _r(a["pnt_injetada"], 2),
                   "mercado_bt_mwh": _r(_mwh(a["bt_med"])), "pnt_bt_pct": _r(a["pnt_bt"], 2),
                   "residuo_pct_injetada": _r(a["residuo_pct"], 2), "reconciliacao": a["reconciliacao"],
                   "decomposicao": a["decomposicao"], "residuo_decomposicao_mwh": _r(_mwh(a["residuo_decomposicao"])),
                   "alertas": a["alertas"]}
        variacao = None
        ant = anuais.get((cnpj, ano_ref - 1))
        if a and ant and _valido_para_agregado(a) and _valido_para_agregado(ant):
            par = pares[(cnpj, ano_ref)]
            comparavel = not par["universo_muda"]
            pnt_ok = comparavel and _valido_pnt_bt(a) and _valido_pnt_bt(ant)
            variacao = {
                "ano_base": ano_ref - 1, "comparavel": comparavel,
                "taxa_total_pp": _r(a["taxa_total"] - ant["taxa_total"], 2) if comparavel else None,
                "perdas_totais_pct": _r(ap.taxa(a["perdas_totais_med"] - ant["perdas_totais_med"], ant["perdas_totais_med"]), 1)
                if comparavel and ant["perdas_totais_med"] and ant["perdas_totais_med"] > 0 else None,
                "pnt_bt_pp": _r(a["pnt_bt"] - ant["pnt_bt"], 2) if pnt_ok else None,
                "variacao_injetada_pct": _r(100 * par["variacao_injetada"], 1) if par["variacao_injetada"] is not None else None,
                "quebra_escala": par["quebra_escala"], "absorcao": par["absorcao"],
                "atravessa_leiaute": ant["origem_injetada"] != a["origem_injetada"],
            }
        # acumulado do ano aberto contra o mesmo período do ano anterior (mesmos meses)
        parcial = None
        acd = acum_dist.get(cnpj)
        if acd:
            at, an = acd["atual"], acd["anterior"]
            parcial = {"ano": ano_parcial, "mes_fim": mes_fim, "meses": at["meses"], "completo": at["completo"],
                       "comparavel": acd["comparavel"], "origem_injetada": at["origem_injetada"],
                       "injetada_mwh": _r(_mwh(at["injetada_ref"])), "perdas_totais_mwh": _r(_mwh(at["perdas_totais_med"])),
                       "taxa_total_pct": _r(at["taxa_total"], 2), "pnt_bt_pct": _r(at["pnt_bt"], 2),
                       "anterior": {"perdas_totais_mwh": _r(_mwh(an["perdas_totais_med"])), "taxa_total_pct": _r(an["taxa_total"], 2),
                                    "pnt_bt_pct": _r(an["pnt_bt"], 2), "origem_injetada": an["origem_injetada"]},
                       "alertas": sorted(set(at["alertas"]) | set(an["alertas"]))}
        # percentual técnico implícito: trechos de referência (6 meses ou mais) na gold; os
        # curtos ficam só no CSV, com a classe, como possível coincidência de arredondamento
        procs_be = [p for p in processos.get(cnpj, []) if p["base"] == "Base Econômica"]
        segs = _segmentos_com_reh(m, procs_be)
        for s in segs:
            csv_pt.append([cnpj, cad["sigla"], s["inicio"], s["fim"], s["pct"], s["meses"],
                           (s["reh"] or {}).get("resolucao"), (s["reh"] or {}).get("inicio_vigencia"), s["dia_inicio_prorata"],
                           s["classe"], s["troca_pp"]])
        segs_ref = [x for x in segs if x["classe"] == "referencia"]
        if segs_ref:
            s_ult = segs_ref[-1]
            meses_s = [c for c in comps if s_ult["inicio"] <= c <= s_ult["fim"]]
            # razões mensais sem arredondamento: o trecho existe porque, arredondadas a 0,001 p.p., são iguais
            razoes = [100.0 * m[c]["perdas_tecnicas"] / m[c]["injetada"] for c in meses_s
                      if m[c].get("perdas_tecnicas") is not None and m[c].get("injetada")]
            dados_ev_tecnica[cnpj] = {"seg": s_ult, "meses": meses_s, "razoes": razoes, "n_ref": len(segs_ref)}
        # tarifa: só processo com início ≤ hoje ≤ fim; sem processo vigente, o último já iniciado
        # com a situação "vigencia_encerrada" e a data de fim (nunca apresentado como vigente)
        tarifa = None
        p, situacao = ap.tarifa_vigente(procs_be, hoje_iso)
        if p:
            dados_ev_tarifa[cnpj] = {"p": p, "situacao": situacao}
            tarifa = {"resolucao": p["resolucao"], "inicio": p["inicio"], "fim": p["fim"], "situacao": situacao,
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
            terr = {"municipios": len(conf | pd["nao_confirmados"] | pd["so_mmgd"]), "confirmados": len(conf), "exclusivos": len(excl),
                    "compartilhados": len(conf - excl), "nao_confirmados": len(pd["nao_confirmados"]),
                    "so_mmgd": len(pd["so_mmgd"]), "ufs": ufs, "ufs_so_nao_confirmadas": ufs_nc}
            contexto = _contexto(ibge, conf, excl)
        # eventos observados na própria fonte; continuidade provável pela energia, nunca por nome
        ev = []
        nomes = sorted(cad["nomes"].items(), key=lambda x: x[1][0])
        for (n1, (_, f1)), (n2, (i2, _)) in zip(nomes, nomes[1:]):
            ev.append({"tipo": "mudanca_nome", "competencia": i2, "de": n1, "para": n2})
        if comps[0] > "2003-01":
            e = {"tipo": "inicio_serie", "competencia": comps[0]}
            suc = sucessao_de.get(cnpj)
            if suc:
                e["sucessao_provavel_de"] = {"cnpj": suc["anterior"], "razao_energia": suc["razao_energia"],
                                             "mesma_raiz_cnpj": suc["mesma_raiz_cnpj"]}
            ev.append(e)
        for e in absorcoes:
            if e["cnpj"] == cnpj:
                ev.append({"tipo": "absorcao_provavel", "competencia": e["competencia"], "encerradas": e["encerradas"],
                           "salto_pct": e["salto_pct"], "salto_sobre_encerradas": e["salto_sobre_encerradas"]})
        if comps[-1] < ultima_comp[:4] + "-01":
            e = {"tipo": "fim_serie", "competencia": comps[-1]}
            if continua_em.get(cnpj):
                e["continuidade_provavel"] = continua_em[cnpj]
            ev.append(e)
        distribuidoras.append({
            "cnpj": cnpj, "cnpj_formatado": entidades.cnpj_formatado(cnpj), "cnpj_dv_valido": dv_valido[cnpj],
            "sigla": cad["sigla"], "nome": cad["nome"],
            "classificacao": cad["classificacao"], "grupo": cad["grupo"],
            "primeira_competencia": comps[0], "ultima_competencia": comps[-1],
            "ativa": comps[-1] >= f"{ano_ref}-12", "referencia": ref, "variacao": variacao, "parcial": parcial,
            # o dia reconstituído da média pró-rata fica só no CSV, como diagnóstico: coincide com o
            # início de vigência da REH em poucos casos (CEMIG-D 2018 e 2023) e não é data de vigência
            "tecnica_regulatoria": {"segmentos": [{k: v for k, v in x.items() if k not in ("dia_inicio_prorata", "classe")}
                                                  for x in segs_ref[-3:]],
                                    "n_segmentos": len(segs_ref), "n_curtos": len(segs) - len(segs_ref)} if segs else None,
            "tarifa": tarifa, "territorio": terr, "contexto": contexto, "eventos": ev,
            "correspondencias": _correspondencias(cnpj),
        })

    # ---------------------------------------------------------------- associação descritiva (P058)
    # Ano das perdas = ano do Censo (2022), para que renda e perdas descrevam o mesmo ano; se
    # 2022 não for ano completo na série, usa-se o ano de referência (e o texto diz qual). O
    # território também é o do ano das perdas: relação conjunto × distribuidora dos limites de
    # continuidade daquele ano (a de 2026 daria a EPB e à EMR municípios que em 2022 eram da EBO
    # e da ENF, e deixaria a EBO sem território).
    ano_assoc = ANO_CENSO if any(y == ANO_CENSO and a["completo"] for (_, y), a in anuais.items()) else ano_ref
    rel_assoc = rel if (rel and rel["ano"] == ano_assoc) else _relacao(con, hoje, ano_assoc)
    terr_assoc = _municipios_do_ano(rel_assoc) if rel_assoc else {}
    n_dist_mun = collections.Counter(cod for munis, _ in terr_assoc.values() for cod in munis)
    pontos, brutos, excluidas_assoc, confirmacao_assoc = [], [], [], collections.Counter()
    for d in distribuidoras:
        a = anuais.get((d["cnpj"], ano_assoc))
        if d["grupo"] != "concessionaria" or not a or not _valido_para_agregado(a):
            continue
        munis, modo = terr_assoc.get(d["cnpj"], (set(), None))
        ctx_a = _contexto(ibge, munis, {cod for cod in munis if n_dist_mun[cod] == 1}) if munis else None
        if not ctx_a or ctx_a["renda_media_pc_confirmados"] is None:
            excluidas_assoc.append({"cnpj": d["cnpj"], "sigla": d["sigla"],
                                    "motivo": f"sem município na relação conjunto × distribuidora de {ano_assoc}"})
            continue
        confirmacao_assoc[modo] += 1
        pnt_bt = a["pnt_bt"] if _valido_pnt_bt(a) else None
        pontos.append([d["cnpj"], ctx_a["renda_media_pc_confirmados"], _r(pnt_bt, 2), _r(a["taxa_total"], 2),
                       ctx_a["cobertura_exclusivos_pct"]])
        brutos.append((ctx_a["_renda_exata"], pnt_bt, a["taxa_total"]))
    # postos sobre os valores sem arredondamento (o arredondamento criaria empates artificiais)
    rho_pnt, n_pnt = ap.spearman([x[0] for x in brutos], [x[1] for x in brutos])
    rho_tot, n_tot = ap.spearman([x[0] for x in brutos], [x[2] for x in brutos])

    # ---------------------------------------------------------------- arquivos de download
    base.escreve_csv(CSV_ANUAL, ["cnpj", "sigla", "nome", "classificacao", "ano", "meses", "completo", "injetada_publicada_mwh",
                                 "injetada_referencia_mwh", "origem_injetada", "perdas_totais_mwh", "taxa_total_pct",
                                 "perdas_tecnicas_mwh", "taxa_tecnica_pct", "pnt_mwh", "pnt_injetada_pct", "mercado_bt_mwh",
                                 "pnt_bt_pct", "perdas_totais_faturado_mwh", "taxa_total_faturado_pct", "perdas_linha_antiga_mwh", "residuo_mwh",
                                 "residuo_pct_injetada", "reconciliacao", "alertas", "taxa_tecnica_injetada_publicada_pct",
                                 "residuo_decomposicao_mwh", "decomposicao", "variacao_injetada_ano_anterior_pct",
                                 "quebra_escala_ano_anterior", "absorcao_ano_anterior"], csv_anual)
    base.escreve_csv(CSV_MENSAL, ["cnpj", "competencia", "injetada_publicada_kwh", "injetada_referencia_kwh", "origem_injetada",
                                  "representacao", "fornecida_medida_kwh", "outros_requisitos_kwh", "irregular_faturada_kwh",
                                  "perdas_totais_medidas_kwh", "perdas_tecnicas_kwh", "pnt_medidas_kwh",
                                  "perdas_totais_faturadas_kwh", "pnt_faturadas_kwh", "perdas_linha_antiga_kwh", "mercado_bt_medido_kwh",
                                  "mmgd_injetada_kwh", "residuo_kwh", "conflitos", "conflitos_abertos", "perdas_tecnicas_faturadas_kwh",
                                  "residuo_decomposicao_kwh"], csv_mensal)
    base.escreve_csv(CSV_NACIONAL, ["ano", "universo", "completo", "n_distribuidoras", "n_publicadas", "injetada_referencia_mwh",
                                    "perdas_totais_mwh", "taxa_total_pct", "n_com_tecnica", "injetada_com_tecnica_mwh",
                                    "perdas_tecnicas_mwh", "taxa_tecnica_pct", "n_com_pnt_bt", "pnt_mwh", "mercado_bt_mwh",
                                    "pnt_bt_pct", "excluidos", "cobertura_tecnica_pct", "taxa_tecnica_injetada_publicada_pct",
                                    "cobertura_bt_pct", "universo_total_igual_ano_anterior", "universo_tecnica_igual_ano_anterior",
                                    "universo_pnt_bt_igual_ano_anterior", "n_mesmas_total", "taxa_total_pct_mesmas_ano_anterior",
                                    "taxa_total_pct_mesmas", "n_mesmas_tecnica", "taxa_tecnica_pct_mesmas_ano_anterior",
                                    "taxa_tecnica_pct_mesmas", "n_mesmas_pnt_bt", "pnt_bt_pct_mesmas_ano_anterior", "pnt_bt_pct_mesmas",
                                    "fora_por_mudanca_de_universo"],
                     [[x["ano"], x["universo"], int(x["ano"] <= ano_ref), x["n_distribuidoras"], x["n_publicadas"], x["injetada_mwh"],
                       x["perdas_totais_mwh"], x["taxa_total_pct"], x["n_com_tecnica"], x["injetada_com_tecnica_mwh"],
                       x["perdas_tecnicas_mwh"], x["taxa_tecnica_pct"], x["n_com_pnt_bt"], x["pnt_mwh"], x["mercado_bt_mwh"],
                       x["pnt_bt_pct"], json.dumps(x["excluidos"], ensure_ascii=False), x["cobertura_tecnica_pct"],
                       x["taxa_tecnica_injetada_publicada_pct"], x["cobertura_bt_pct"]]
                      + _colunas_comparacao(x) for x in nacional])
    base.escreve_csv(CSV_PT, ["cnpj", "sigla", "inicio", "fim", "percentual", "meses", "resolucao_tarifaria",
                              "inicio_vigencia_reh", "dia_prorata_diagnostico", "classe", "troca_pp"], csv_pt)
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
                               " ".join(d["conjuntos"]), d["mmgd"], int(d["confirmado"]), d["origem"], len(mm["dist"]),
                               "" if mm["valido"] is None else int(mm["valido"]), int(d["cnpj"] in sig)])
    base.escreve_csv(CSV_MUN, ["cod_ibge", "municipio", "uf", "cnpj", "sigla", "conjuntos", "empreendimentos_mmgd",
                               "confirmado_mmgd", "origem_vinculo", "distribuidoras_no_municipio", "codigo_ibge_valido",
                               "distribuidora_no_samp"], linhas_mun)
    base.escreve_csv(CSV_CONTEXTO, ["cnpj", "sigla", "municipios_confirmados", "municipios_exclusivos", "populacao_confirmados",
                                    "populacao_exclusivos", "cobertura_exclusivos_pct", "renda_media_pc_confirmados_rs",
                                    "renda_media_pc_exclusivos_rs", "area_km2_confirmados"],
                     [[d["cnpj"], d["sigla"], d["territorio"]["confirmados"], d["territorio"]["exclusivos"],
                       d["contexto"]["populacao_confirmados"], d["contexto"]["populacao_exclusivos"],
                       d["contexto"]["cobertura_exclusivos_pct"], d["contexto"]["renda_media_pc_confirmados"],
                       d["contexto"]["renda_media_pc_exclusivos"], d["contexto"]["area_km2_confirmados"]]
                      for d in distribuidoras if d["territorio"] and d["contexto"]])
    linhas_acum = []
    for x in acum_nac:
        linhas_acum.append(["universo", x["universo"], None, ano_parcial, mes_fim, x["n_distribuidoras"], 1,
                            x["atual"]["perdas_totais_mwh"], x["atual"]["injetada_mwh"], x["atual"]["taxa_total_pct"],
                            x["atual"]["pnt_bt_pct"], x["anterior"]["perdas_totais_mwh"], x["anterior"]["injetada_mwh"],
                            x["anterior"]["taxa_total_pct"], x["anterior"]["pnt_bt_pct"], None])
    for d in distribuidoras:
        pc = d["parcial"]
        if not pc:
            continue
        an = acum_dist[d["cnpj"]]["anterior"]
        linhas_acum.append(["distribuidora", d["cnpj"], d["sigla"], ano_parcial, mes_fim, pc["meses"], int(pc["comparavel"]),
                            pc["perdas_totais_mwh"], pc["injetada_mwh"], pc["taxa_total_pct"], pc["pnt_bt_pct"],
                            pc["anterior"]["perdas_totais_mwh"], _r(_mwh(an["injetada_ref"])), pc["anterior"]["taxa_total_pct"],
                            pc["anterior"]["pnt_bt_pct"], ",".join(pc["alertas"])])
    base.escreve_csv(CSV_ACUM, ["nivel", "chave", "sigla", "ano", "mes_fim", "meses_ou_n", "comparavel", "perdas_totais_mwh",
                                "injetada_referencia_mwh", "taxa_total_pct", "pnt_bt_pct", "perdas_totais_mwh_ano_anterior",
                                "injetada_referencia_mwh_ano_anterior", "taxa_total_pct_ano_anterior", "pnt_bt_pct_ano_anterior",
                                "alertas"], linhas_acum)
    idx = {x["cnpj"]: i for i, x in enumerate(distribuidoras)}
    base.escreve_gold(JSON_ANUAL, {
        "gerado_em": base.agora_utc(), "unidades": "MWh e %",
        "campos": ["ano", "meses", "completo", "injetada_mwh", "perdas_totais_mwh", "taxa_total_pct", "perdas_tecnicas_mwh",
                   "taxa_tecnica_pct", "pnt_mwh", "pnt_bt_pct", "mercado_bt_mwh", "residuo_pct_injetada", "reconciliacao",
                   "alertas", "origem_injetada", "decomposicao", "taxa_tecnica_injetada_publicada_pct",
                   "universo_muda_ano_anterior"],
        "distribuidoras": serie_json}, destino=base.SERIES)
    base.escreve_gold(JSON_NACIONAL, {"gerado_em": base.agora_utc(), "unidades": "MWh e %",
                                      "linhas": _sem_privados(nacional)}, destino=base.SERIES)
    base.escreve_gold(JSON_MUN, {
        "gerado_em": base.agora_utc(), "ano_relacao": (rel or {}).get("ano"),
        "distribuidoras": [x["cnpj"] for x in distribuidoras],
        "campos": ["indice_distribuidora", "estado_vinculo"],
        "estados_vinculo": {"0": "relação conjunto × município sem empreendimento de MMGD que confirme",
                            "1": "relação conjunto × município confirmada pelo cadastro de MMGD",
                            "2": "só pelo cadastro de MMGD (município fora da relação de conjuntos)"},
        "municipios": {cod: {"uf": mm["uf"], "valido": mm["valido"],
                             "d": [[idx[d["cnpj"]], 2 if d["origem"] == "mmgd" else int(d["confirmado"])]
                                   for d in mm["dist"] if d["cnpj"] in idx]}
                       for cod, mm in sorted(municipios.items())},
    }, destino=base.SERIES)

    # ---------------------------------------------------------------- proveniência
    fonte_samp = _fonte("ANEEL", "SAMP Balanço", "samp-balanco.parquet (Parquet oficial, equivalente ao samp-balanco.csv)",
                        URL_SAMP, (cap_samp or {}).get("url") or URL_SAMP, LICENCA_ANEEL)
    fonte_samp["url_primaria"] = next((v["url"] for v in base.vintages_do_dataset(con, DS_SAMP)
                                       if v["recurso"] == "samp-balanco.parquet"), URL_SAMP)
    meta_samp = ckan.meta_local(DS_SAMP)
    cap = c.ultima_captura(snap_samp)
    per = {"inicio": min(k for m in mensal.values() for k in m), "fim": ultima_comp}
    lim_samp = [
        "Perdas técnicas publicadas no SAMP são estimativas regulatórias (percentual fixado no processo tarifário aplicado à energia injetada publicada), não medição; a parcela não técnica publicada depende dessa estimativa.",
        f"A partir de 2024 (leiaute da REN 1.003/2022) a fonte deixou de publicar a separação técnica e não técnica para {_contagem_separacao(nacional, ano_ref)}, e a energia injetada publicada deixou de fechar o balanço com a perda calculada pela própria fonte; o denominador desses meses é a energia implícita no cálculo da fonte (fornecida + irregular + perdas), e a série tem quebra em 2024. A fonte não explica a diferença e o módulo não atribui causa a ela.",
        "Valores mensais oscilam com o calendário de leitura dos medidores; só o ano civil completo é comparado.",
        "Perdas medidas (base adotada pela ANEEL em 2025) diferem das faturadas: o faturado inclui o custo de disponibilidade e a compensação da MMGD.",
        "Agente-ano com balanço que não fecha (resíduo acima de 5% da injetada no leiaute antigo, fornecida maior que a injetada) fica fora de agregados e comparações, com alerta.",
    ]
    lim_separacao = [
        "A técnica é o percentual regulatório aplicado pela fonte à injetada publicada (estimativa, não medição); a não técnica publicada é a perda total menos essa estimativa e herda a estimativa.",
        "As linhas publicadas nem sempre obedecem a total = técnica + não técnica: a identidade é conferida mês a mês e o agente-ano que não fecha (acima de 2 kWh por mês e de 0,1% da perda total) sai dos agregados de técnica e não técnica.",
        "Técnica medida e faturada são linhas diferentes da fonte (diferem em 13% dos meses em que as duas existem); só a medida é usada, e o mês sem ela fica sem técnica.",
        f"O universo com separação publicada muda muito de um ano para outro ({_contagem_separacao(nacional, ano_ref)}): a variação anual só se lê nas mesmas distribuidoras (comparação com o ano anterior e série de universo fixo).",
    ]
    faixa_tarifa = sorted(p["inicio"] for procs in processos.values() for p in procs) or [None]
    refs_pt = [r for r in csv_pt if r[9] == "referencia"]
    periodo_pt = ({"inicio": min(r[2] for r in refs_pt), "fim": max(r[3] for r in refs_pt)} if refs_pt else per)
    prov = {
        "volumes": c.proveniencia(
            indicador="Perdas totais de energia na distribuição por distribuidora (valor medido publicado pela fonte)",
            natureza="OBSERVADO", fonte=fonte_samp,
            unidade="MWh", frequencia="mensal (publicação); anual (comparação)", periodo=per, cobertura=per,
            capturado_em=cap, snapshot=snap_samp, limitacoes=lim_samp, download=_url(CSV_ANUAL),
            transformacoes=["kWh → MWh (÷ 1.000)", "soma dos 12 meses do ano civil; ano com mês ausente fica ausente"],
            notas_fonte=meta_samp.get("notas")),
        "separacao": c.proveniencia(
            indicador="Perdas técnicas e não técnicas (estimadas pela fonte)", natureza="ESTIMADO", fonte=fonte_samp,
            unidade="MWh", frequencia="mensal (publicação); anual (comparação)", periodo=per, cobertura=per,
            capturado_em=cap, snapshot=snap_samp, limitacoes=lim_separacao, download=_url(CSV_ANUAL),
            transformacoes=["linhas 'Perdas Técnicas' e 'Perdas Não-Técnicas' do valor medido, somadas nos 12 meses",
                            "resíduo da decomposição = perdas totais − técnicas − não técnicas, mês a mês"]),
        "taxas": c.proveniencia(
            indicador="Taxas de perdas com denominador explícito", natureza="CALCULADO", fonte=fonte_samp, unidade="%",
            frequencia="anual", periodo={"inicio": str(anos[0]), "fim": str(ano_ref)}, cobertura=per, capturado_em=cap,
            snapshot=snap_samp, download=_url(CSV_ANUAL),
            transformacoes=["taxa total e técnica = 100 × Σ perdas ÷ Σ energia injetada de referência do ano",
                            "técnica sobre a injetada publicada = 100 × Σ técnicas ÷ Σ injetada publicada (a base em que a fonte aplica o percentual regulatório)",
                            "não técnica sobre BT = 100 × Σ perdas não técnicas medidas ÷ Σ mercado BT medido (cativo, consumo próprio e livre)",
                            "agregados: 100 × Σ numeradores ÷ Σ denominadores do mesmo subconjunto de distribuidoras, com a cobertura ao lado",
                            "comparação com o ano anterior só sobre as mesmas distribuidoras válidas nos dois anos, sem mudança de escala entre eles"],
            formula="taxa_total = 100 × perdas_totais ÷ injetada_referência; pnt_bt = 100 × perdas_não_técnicas_publicadas ÷ mercado_BT_medido",
            limitacoes=lim_samp + ["Mercado BT separado por nível de tensão só existe a partir de 2010; antes disso a taxa não técnica sobre BT é ausente.",
                                   "No leiaute de 2024 a técnica sobre a injetada de referência fica abaixo do percentual regulatório, que a fonte aplica à injetada publicada; as duas taxas técnicas são publicadas."]),
        "reconciliacao": c.proveniencia(
            indicador="Resíduo do balanço energético (injetada − fornecida − irregular − perdas)", natureza="CALCULADO",
            fonte=fonte_samp, unidade="MWh e % da injetada publicada", frequencia="mensal e anual", periodo=per, cobertura=per,
            capturado_em=cap, snapshot=snap_samp, download=_url(CSV_MENSAL),
            formula="resíduo = injetada publicada − (cativo + consumo próprio + suprimento + livre + uso por distribuidoras + contratos antigos) − irregular − perdas totais medidas",
            transformacoes=["representação de cada grandeza escolhida pela concordância com a soma dos níveis de tensão do mesmo mês"],
            limitacoes=["O resíduo mostra quanto da perda publicada não é explicado pelas linhas publicadas; não é atribuído a nenhuma causa.",
                        "Tolerância de fechamento: 1 kWh por linha do arquivo (os valores são inteiros em kWh).",
                        "Acima de 5% da injetada (leiaute antigo) o agente-ano sai de agregados e comparações: a taxa não pode ser confirmada pelas demais linhas."]),
        "tecnica_regulatoria": c.proveniencia(
            indicador="Percentual de perdas técnicas implícito no SAMP (inferido pelo observatório)", natureza="ESTIMADO",
            fonte=fonte_samp, unidade="% da energia injetada publicada", frequencia="por trecho de vigência", periodo=periodo_pt,
            cobertura=periodo_pt, capturado_em=cap, snapshot=snap_samp, download=_url(CSV_PT),
            formula=("percentual = 100 × perdas técnicas ÷ energia injetada publicada, arredondado a 0,001 p.p.; trecho = meses "
                     f"consecutivos com o mesmo valor; referência = trecho de {ap.MIN_MESES_REFERENCIA} meses ou mais"),
            limitacoes=["É inferência do observatório (razão constante na série da fonte), não o percentual homologado lido de um ato: a fonte não publica o percentual regulatório em base aberta.",
                        f"Trechos com menos de {ap.MIN_MESES_REFERENCIA} meses, em qualquer ano, ficam fora do bloco de referência como possível coincidência de arredondamento (publicados no CSV com a classe 'curto').",
                        "É a referência técnica que a própria fonte usou; comparar perda técnica publicada com esse percentual não mede desempenho (é igual por construção).",
                        f"A resolução homologatória só é associada quando o percentual muda ao menos {str(ap.LIMIAR_TROCA_PP).replace('.', ',')} p.p. e o início de vigência dela cai no mês da troca; é coincidência de datas, a fonte não publica essa ligação.",
                        "A referência regulatória de perdas não técnicas não está em base aberta acessível (ver bloqueios)."]),
        "tarifa": c.proveniencia(
            indicador="Custo unitário das perdas na tarifa residencial B1", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Componentes Tarifárias", "componentes-tarifarias-AAAA.parquet (2012 a 2026)", URL_TARIFA,
                         URL_TARIFA, LICENCA_ANEEL),
            unidade="R$/MWh (nominal, sem tributos)", frequencia="por processo tarifário", periodo={"inicio": faixa_tarifa[0], "fim": hoje_iso},
            cobertura={"inicio": faixa_tarifa[0], "fim": hoje_iso}, capturado_em=c.ultima_captura(snap_tarifa), snapshot=snap_tarifa,
            download=_url(CSV_TARIFA),
            transformacoes=["filtro: subgrupo B1, modalidade convencional, subclasse residencial, sem detalhe, base econômica",
                            "perdas = TUSD_PT + TUSD_PNT + TUSD_Per_RB_D + TE_Per_RB; participação = perdas ÷ (TUSD + TE)"],
            limitacoes=["É o valor por MWh que a tarifa residencial recupera, não o custo total reconhecido em reais no processo (planilha do processo inacessível, ver bloqueios).",
                        "O processo exibido é o vigente na data da consulta (início ≤ data ≤ fim); sem processo vigente no arquivo, aparece o último já iniciado com a situação 'vigencia_encerrada' e a data de fim.",
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

    # ---------------------------------------------------------------- evidências ("Comprove este número")
    # O texto exibido sai do valor sem arredondamento (razão das somas em kWh); numerador e
    # denominador vão em MWh com três casas (o kWh exato da fonte), para que qualquer leitor
    # refaça a conta e chegue ao mesmo texto. Arredondar duas vezes (2 casas e depois 1)
    # mostraria 14,8% para 14,748%.
    v_samp = base.ultima_vintage(con, DS_SAMP, "samp-balanco.parquet")
    fonte_ev = evid.fonte_de_vintage("ANEEL", "SAMP Balanço", URL_SAMP, v_samp)
    n_fecha = sum(1 for a in anuais.values() if a["completo"] and a["reconciliacao"] == "fecha")
    n_pequeno = sum(1 for a in anuais.values() if a["completo"] and a["reconciliacao"] == "residuo_pequeno")
    n_relev = sum(1 for a in anuais.values() if a["completo"] and a["reconciliacao"] == "residuo_relevante")
    n_alerta = sum(1 for a in anuais.values() if a["alertas"])
    n_balanco = sum(1 for a in anuais.values() if "balanco_nao_fecha" in a["alertas"] or "fornecida_maior_que_injetada" in a["alertas"])
    n_dec = sum(1 for a in anuais.values() if a["completo"] and a["decomposicao"] == "nao_fecha")
    testes_build = [
        evid.teste("identidade_do_balanco", "ressalva" if n_relev else "aprovado",
                   f"{n_fecha} agentes-ano completos fecham dentro de 1 kWh por linha; {n_pequeno} com resíduo até 0,1% da "
                   f"injetada; {n_relev} com resíduo maior, publicados com o resíduo à vista e sem causa atribuída; "
                   f"{n_balanco} deles (resíduo acima de 5% da injetada no leiaute antigo ou fornecida acima da injetada) "
                   f"ficaram fora dos agregados."),
        evid.teste("limites_fisicos", "aprovado",
                   f"taxa nacional {_pct_br(nac_ref['_exato']['taxa_total'], 2)} dentro de 5% a 30%; {n_alerta} agentes-ano com alerta "
                   f"(perda negativa ou acima da injetada, fornecida acima da injetada, balanço que não fecha ou representação "
                   f"não arbitrada) ficaram fora dos agregados e das comparações."),
        evid.teste("decomposicao", "ressalva" if n_dec else "aprovado",
                   f"total = técnica + não técnica conferido mês a mês; {n_dec} agentes-ano completos não fecham (acima de 2 kWh "
                   f"por mês e de 0,1% da perda total) e ficam fora dos agregados de técnica e não técnica."),
        evid.teste("horizonte_temporal", "aprovado", f"última competência {ultima_comp} não excede o mês da captura {cap_mes}."),
        evid.teste("releitura_independente_csv", "aprovado",
                   "pipeline/tests/test_energia_perdas.py relê o CSV oficial (recurso distinto do Parquet) com código próprio e "
                   "confere somas anuais de CEMIG-D 2023, Manaus Energia 2004 e 2006 e RGE 2019, a decomposição da ERO em "
                   "jul/2014 e a taxa nacional das concessionárias em 2004 e 2025."),
    ]
    res_2024, det_2024 = _reconc_2024(nacional)
    rec_2024 = evid.reconciliacao(
        "Injetada de referência das concessionárias em 2024 contra o intervalo implícito nos números do relatório da ANEEL "
        "(44,6 TWh = 7,4% e 40,2 TWh = 6,6% da injetada; cópia de terceiro do PDF, usada só como alvo desta conferência): " + det_2024,
        res_2024, "intervalo decorrente do arredondamento a 0,1 p.p. dos percentuais publicados (±0,05 p.p.)") if res_2024 else None
    reproducao = ("python3 pipeline/energia/executar_modulo.py perdas --sem-coleta (silver data/energia/silver/aneel_distribuicao.db); "
                  "o CSV mensal perdas_mensal.csv permite refazer cada soma a partir dos valores em kWh da fonte.")
    ausencia = "Mês sem a linha na fonte deixa a soma anual ausente; nada é completado nem vira zero."
    dl_nac = [{"rotulo": "Série nacional (CSV)", "url": _url(CSV_NACIONAL)}, {"rotulo": "Por distribuidora e ano (CSV)", "url": _url(CSV_ANUAL)}]
    excl_ref = [f"{k}: {v}" for k, v in nac_ref["excluidos"].items()]
    periodo_ref = {"inicio": f"{ano_ref}-01", "fim": f"{ano_ref}-12"}
    consulta_ref = (f"SAMP Balanço, AnoReferenciaBalanco = {ano_ref}, DscClassificacaoAgente = Concessionária, "
                    f"DscModalidadeBalanco = '{ap.MOD_PERDA_MED}', DscCctBalanco = '{ap.CCT_TOTAIS}'")
    ex = nac_ref["_exato"]
    evid_nac = evid.construir(
        indicador="Taxa de perdas totais na distribuição", valor_exibido=_pct_br(ex["taxa_total"], 1),
        valor_calculo=_r(ex["taxa_total"], 6), unidade="% da energia injetada", periodo=periodo_ref,
        entidade="Concessionárias de distribuição (Brasil)",
        universo=f"{nac_ref['n_distribuidoras']} concessionárias com os 12 meses de {ano_ref} e sem alerta",
        fonte=fonte_ev, consulta=consulta_ref, formula="100 × Σ perdas totais medidas ÷ Σ energia injetada de referência",
        numerador={"descricao": "Σ perdas totais medidas (MWh)", "valor": _mwh3(ex["perdas_totais_kwh"])},
        denominador={"descricao": "Σ energia injetada de referência (MWh)", "valor": _mwh3(ex["injetada_kwh"])},
        exclusoes=excl_ref, cobertura=f"{nac_ref['n_distribuidoras']} de {nac_ref['n_publicadas']} concessionárias com dado em {ano_ref}",
        tratamento_ausencia=ausencia, revisoes=snap_samp.get("revisoes"), testes=testes_build,
        reconciliacao=None, download=dl_nac, reproducao=reproducao)
    evid_vol = evid.construir(
        indicador="Perdas totais de energia na distribuição", valor_exibido=_twh_br(ex["perdas_totais_kwh"] / 1000.0),
        valor_calculo=_mwh3(ex["perdas_totais_kwh"]), unidade="MWh", periodo=periodo_ref,
        entidade="Concessionárias de distribuição (Brasil)",
        universo=f"{nac_ref['n_distribuidoras']} concessionárias com os 12 meses de {ano_ref} e sem alerta",
        fonte=fonte_ev, consulta=consulta_ref, formula="Σ_distribuidoras Σ_meses perdas totais medidas (kWh) ÷ 1.000",
        exclusoes=excl_ref, cobertura=f"{nac_ref['n_distribuidoras']} de {nac_ref['n_publicadas']} concessionárias com dado em {ano_ref}",
        tratamento_ausencia=ausencia, revisoes=snap_samp.get("revisoes"), testes=testes_build,
        download=dl_nac, reproducao=reproducao)
    # não técnica sobre BT: o universo muda de um ano para outro; a evidência diz quantas e
    # quanto do mercado BT ela cobre, e aponta a série de universo fixo para a tendência
    serie_n = [(x["ano"], x["n_com_pnt_bt"]) for x in nacional if x["universo"] == "concessionarias" and ano_ref - 2 <= x["ano"] <= ano_ref]
    uf_lin = {x["ano"]: x for x in universo_fixo["linhas"]}
    teste_universo = evid.teste(
        "universo_comparavel", "ressalva",
        "concessionárias com a separação publicada nos 12 meses e decomposição fechando: "
        + ", ".join(f"{n} em {a}" for a, n in serie_n)
        + f". Nas mesmas {universo_fixo['n_distribuidoras']} concessionárias em todos esses anos: "
        + ", ".join(f"{_pct_br(uf_lin[a]['pnt_bt_pct'], 2) or 'sem dado'} em {a}" for a in universo_fixo["anos"])
        + ". A diferença entre anos da série nacional é efeito de composição e não se lê como variação.")
    evid_pnt = evid.construir(
        indicador="Perdas não técnicas sobre o mercado de baixa tensão",
        valor_exibido=_pct_br(ex["pnt_bt"], 1) if ex["pnt_bt"] is not None else None,
        valor_calculo=_r(ex["pnt_bt"], 6), unidade="% do mercado de baixa tensão medido", periodo=periodo_ref,
        entidade=(f"{nac_ref['n_com_pnt_bt']} concessionárias com separação técnica e não técnica publicada "
                  f"(não é a perda não técnica de todas as {nac_ref['n_distribuidoras']} concessionárias válidas)"),
        universo=(f"{nac_ref['n_com_pnt_bt']} de {nac_ref['n_distribuidoras']} concessionárias válidas, com a separação nos 12 meses "
                  f"de {ano_ref} e a decomposição fechando; {_pct_br(nac_ref['cobertura_bt_pct'], 1) or 'sem dado'} do mercado BT delas"),
        fonte=fonte_ev, consulta=(f"SAMP Balanço, AnoReferenciaBalanco = {ano_ref}, DscCctBalanco = '{ap.CCT_NAO_TECNICAS}' "
                                  f"(valor medido) e DscDetalheBalanco = '{ap.MEDIDA} - {ap.BT}' de cativo, consumo próprio e livre"),
        formula="100 × Σ perdas não técnicas medidas ÷ Σ mercado BT medido",
        numerador={"descricao": "Σ perdas não técnicas medidas (MWh)", "valor": _mwh3(ex["pnt_kwh"])},
        denominador={"descricao": "Σ mercado de baixa tensão medido (MWh)", "valor": _mwh3(ex["mercado_bt_kwh"])},
        cobertura=(f"{nac_ref['n_com_pnt_bt']} de {nac_ref['n_distribuidoras']} concessionárias válidas, "
                   f"{_pct_br(nac_ref['cobertura_bt_pct'], 1) or 'sem dado'} do mercado BT delas; a fonte deixou de publicar a "
                   f"separação para {_contagem_separacao(nacional, ano_ref)} a partir de 2024"),
        tratamento_ausencia=ausencia + " Distribuidora sem a técnica ou a não técnica em algum mês fica fora do numerador e do denominador.",
        revisoes=snap_samp.get("revisoes"), testes=testes_build + [teste_universo], download=dl_nac, reproducao=reproducao)
    rel2024 = next((x for x in nacional if x["ano"] == 2024 and x["universo"] == "concessionarias"), None)
    evid_2024 = None
    if rel2024 and rel2024["injetada_mwh"] is not None:
        evid_2024 = evid.construir(
            indicador="Energia injetada de referência das concessionárias",
            valor_exibido=_twh_br(rel2024["_exato"]["injetada_kwh"] / 1000.0), valor_calculo=_mwh3(rel2024["_exato"]["injetada_kwh"]),
            unidade="MWh", periodo={"inicio": "2024-01", "fim": "2024-12"}, entidade="Concessionárias de distribuição (Brasil)",
            universo=f"{rel2024['n_distribuidoras']} concessionárias com os 12 meses de 2024 e sem alerta",
            fonte=fonte_ev, consulta="SAMP Balanço, AnoReferenciaBalanco = 2024, concessionárias; fornecida + irregular + perdas no leiaute novo",
            formula="Σ energia injetada de referência (leiaute antigo: linha publicada; leiaute de 2024: fornecida + irregular + perdas totais)",
            cobertura=f"{rel2024['n_distribuidoras']} de {rel2024['n_publicadas']} concessionárias",
            tratamento_ausencia=ausencia, revisoes=snap_samp.get("revisoes"), testes=testes_build, reconciliacao=rec_2024,
            download=dl_nac, reproducao=reproducao)
    evid_acum = None
    acum_conc = next((x for x in acum_nac if x["universo"] == "concessionarias"), None)
    if acum_conc and acum_conc["atual"]["taxa_total_pct"] is not None:
        at = acum_conc["atual"]["_exato"]
        evid_acum = evid.construir(
            indicador=f"Taxa de perdas totais acumulada em {ano_parcial}", valor_exibido=_pct_br(at["taxa_total"], 1),
            valor_calculo=_r(at["taxa_total"], 6), unidade="% da energia injetada",
            periodo={"inicio": f"{ano_parcial}-01", "fim": f"{ano_parcial}-{mes_fim:02d}"},
            entidade="Concessionárias de distribuição (Brasil)",
            universo=f"{acum_conc['n_distribuidoras']} concessionárias com janeiro a {MESES_EXTENSO[mes_fim - 1]} completos em {ano_parcial} e em {ano_parcial - 1}",
            fonte=fonte_ev, consulta=f"SAMP Balanço, competências {ano_parcial}-01 a {ano_parcial}-{mes_fim:02d}, concessionárias",
            formula="100 × Σ perdas totais medidas ÷ Σ energia injetada de referência, janeiro a mes_fim",
            numerador={"descricao": "Σ perdas totais medidas no período (MWh)", "valor": _mwh3(at["perdas_totais_kwh"])},
            denominador={"descricao": "Σ energia injetada de referência no período (MWh)", "valor": _mwh3(at["injetada_kwh"])},
            cobertura=f"{acum_conc['n_distribuidoras']} concessionárias; o recorte é o mesmo nos dois anos",
            tratamento_ausencia=ausencia + " Ano aberto: só compara com o mesmo período do ano anterior.",
            revisoes=snap_samp.get("revisoes"), testes=testes_build, download=[{"rotulo": "Acumulado do ano (CSV)", "url": _url(CSV_ACUM)}],
            reproducao=reproducao)

    # evidência por distribuidora: arquivo sob demanda (o painel abre ao clicar numa área)
    evid_dist = {}
    for d in distribuidoras:
        rf = d["referencia"]
        if not rf or rf["taxa_total_pct"] is None:
            continue
        a = anuais[(d["cnpj"], ano_ref)]
        testes_d = [evid.teste("ano_completo", "aprovado" if rf["completo"] else "ressalva", f"{rf['meses']} meses publicados em {ano_ref}"),
                    evid.teste("limites_fisicos", "reprovado" if rf["alertas"] else "aprovado",
                               ", ".join(rf["alertas"]) or "perda total entre zero e a energia injetada; fornecida abaixo da injetada"),
                    evid.teste("identidade_do_balanco", "aprovado" if rf["reconciliacao"] in ("fecha", "residuo_pequeno") else "ressalva",
                               f"{rf['reconciliacao']}; resíduo {_pct_br(a['residuo_pct'], 2) if a['residuo_pct'] is not None else 'sem componentes'} da injetada publicada")]
        evid_dist[d["cnpj"]] = evid.construir(
            indicador="Taxa de perdas totais", valor_exibido=_pct_br(a["taxa_total"], 1), valor_calculo=_r(a["taxa_total"], 6),
            unidade="% da energia injetada", periodo=periodo_ref, entidade=f"{d['sigla'] or d['nome']} (CNPJ {d['cnpj_formatado']})",
            universo="uma distribuidora, ano civil", fonte=fonte_ev,
            chaves_origem=[f"numerador: NumCPFCNPJ = {int(d['cnpj'])}, AnoReferenciaBalanco = {ano_ref}, MesReferenciaBalanco 1 a 12, "
                           f"DscModalidadeBalanco = '{ap.MOD_PERDA_MED}', DscCctBalanco = '{ap.CCT_TOTAIS}'",
                           f"denominador: mesmas competências, linha '{ap.MOD_INJETADA}' (leiaute antigo) ou fornecida + irregular + "
                           f"perdas (leiaute de 2024); origem {rf['origem_injetada']}"],
            formula="100 × perdas totais medidas ÷ energia injetada de referência",
            numerador={"descricao": f"perdas totais medidas {ano_ref} (MWh)", "valor": _mwh3(a["perdas_totais_med"])},
            denominador={"descricao": f"energia injetada de referência {ano_ref} (MWh, origem {rf['origem_injetada']})",
                         "valor": _mwh3(a["injetada_ref"])},
            cobertura=f"{rf['meses']} de 12 meses", tratamento_ausencia=ausencia, revisoes=snap_samp.get("revisoes"), testes=testes_d,
            download=[{"rotulo": "Balanço mensal (CSV)", "url": _url(CSV_MENSAL)}], reproducao=reproducao)
    base.escreve_gold(JSON_EVID, {"gerado_em": base.agora_utc(), "ano": ano_ref, "evidencias": evid_dist}, destino=base.SERIES)

    # percentual técnico regulatório implícito (P057): o trecho de referência mais recente
    evid_tec = {}
    for d in distribuidoras:
        x = dados_ev_tecnica.get(d["cnpj"])
        if not x:
            continue
        s, razoes = x["seg"], x["razoes"]
        amp = max(razoes) - min(razoes) if razoes else None
        testes_t = [
            evid.teste("trecho_de_referencia", "aprovado" if s["meses"] >= ap.MIN_MESES_REFERENCIA else "reprovado",
                       f"{s['meses']} meses seguidos com a mesma razão (referência a partir de {ap.MIN_MESES_REFERENCIA}); "
                       f"{x['n_ref']} trechos de referência na série da distribuidora"),
            evid.teste("razao_constante", "aprovado" if razoes and len(razoes) == s["meses"] else "reprovado",
                       (f"razões mensais sem arredondamento de {_num_br(min(razoes), 5)}% a {_num_br(max(razoes), 5)}% "
                        f"(amplitude {_num_br(amp, 5)} p.p.), todas iguais a {_num_br(s['pct'], 3)}% em 0,001 p.p.") if razoes else "sem razões mensais"),
            evid.teste("resolucao_associada", "aprovado" if s.get("reh") else "ressalva",
                       (f"{s['reh']['resolucao']}, início de vigência em {s['reh']['inicio_vigencia']}; troca de "
                        f"{_num_br(s['troca_pp'], 3)} p.p. contra o trecho anterior") if s.get("reh") else
                       "nenhuma resolução homologatória com início de vigência no mês da troca e troca de ao menos 0,02 p.p.; "
                       "o percentual é inferido da série, não lido de um ato"),
            evid.teste("unitarios", "aprovado", "pipeline/tests/test_energia_perdas.py: PercentualTecnicoRegulatorio e "
                       "ReferenciaRegulatoriaETarifa.test_reh_so_com_troca_real_de_percentual"),
        ]
        evid_tec[d["cnpj"]] = evid.construir(
            indicador="Percentual técnico regulatório implícito no SAMP (trecho mais recente)",
            valor_exibido=_pct_br(s["pct"], 3), valor_calculo=s["pct"], unidade="% da energia injetada publicada",
            periodo={"inicio": s["inicio"], "fim": s["fim"]}, entidade=f"{d['sigla'] or d['nome']} (CNPJ {d['cnpj_formatado']})",
            universo=f"um trecho de {s['meses']} meses com a mesma razão perdas técnicas ÷ energia injetada publicada",
            fonte=fonte_ev,
            chaves_origem=[f"numerador: NumCPFCNPJ = {int(d['cnpj'])}, competências {s['inicio']} a {s['fim']}, "
                           f"DscModalidadeBalanco = '{ap.MOD_PERDA_MED}', DscCctBalanco = '{ap.CCT_TECNICAS}'",
                           f"denominador: mesmas competências, linha '{ap.MOD_INJETADA}' publicada"],
            formula="100 × perdas técnicas medidas ÷ energia injetada publicada, mês a mês, arredondada a 0,001 p.p. e igual em "
                    f"todos os meses do trecho (inferência do observatório; trecho de {ap.MIN_MESES_REFERENCIA} meses ou mais)",
            cobertura=f"{s['meses']} meses seguidos, de {s['inicio']} a {s['fim']}",
            tratamento_ausencia="Mês sem a técnica medida ou sem a injetada publicada interrompe o trecho; nada é completado.",
            revisoes=snap_samp.get("revisoes"), testes=testes_t,
            download=[{"rotulo": "Percentual técnico regulatório implícito (CSV)", "url": _url(CSV_PT)}], reproducao=reproducao)
    base.escreve_gold(JSON_EVID_TECNICA, {"gerado_em": base.agora_utc(), "evidencias": evid_tec}, destino=base.SERIES)

    # componentes de perdas na tarifa B1 (P058): o arquivo anual de onde o processo foi lido
    evid_tar = {}
    for d in distribuidoras:
        x = dados_ev_tarifa.get(d["cnpj"])
        if not x or not d.get("tarifa"):
            continue
        p, sit, t = x["p"], x["situacao"], d["tarifa"]
        r_ = p["resumo"]
        vint_t = _vintage_da_observacao(con, DS_TARIFA, f"BE.TUSD_PT.{d['cnpj']}", p["inicio"])
        testes_c = [
            evid.teste("vigencia", "aprovado" if sit == "vigente" else "ressalva",
                       f"início {p['inicio']} ≤ {hoje_iso} ≤ fim {p['fim']}" if sit == "vigente" else
                       f"vigência encerrada em {p['fim']}; nenhum processo vigente em {hoje_iso} no arquivo da fonte"),
            evid.teste("soma_das_componentes", "aprovado",
                       f"TUSD_PT {_num_br(r_['pt'], 2)} + TUSD_PNT {_num_br(r_['pnt'], 2)} + Rede Básica (TUSD_Per_RB_D + TE_Per_RB) "
                       f"{_num_br(r_['rede_basica'], 2)} = {_num_br(r_['perdas'], 2)} R$/MWh"),
            evid.teste("unitarios", "aprovado", "pipeline/tests/test_energia_perdas.py: TarifaB1.test_componentes_de_perdas_da_reh_3459_2025 e "
                       "ReferenciaRegulatoriaETarifa.test_tarifa_vencida_nao_e_vigente"),
        ]
        evid_tar[d["cnpj"]] = evid.construir(
            indicador="Componentes de perdas na tarifa residencial B1", valor_exibido=f"{_num_br(r_['perdas'], 2)} R$/MWh",
            valor_calculo=_r(r_["perdas"], 6), unidade="R$/MWh", periodo={"inicio": p["inicio"], "fim": p["fim"] or p["inicio"]},
            entidade=f"{d['sigla'] or d['nome']} (CNPJ {d['cnpj_formatado']})",
            universo=(f"um processo tarifário ({p.get('resolucao') or 'resolução não informada'}), {'vigente' if sit == 'vigente' else 'com vigência encerrada'} "
                      f"em {hoje_iso}"),
            filtros=["DscBaseTarifaria = 'Base Econômica'", "DscSubGrupoTarifario = 'B1'", "DscModalidadeTarifaria = 'Convencional'",
                     "DscSubClasseConsumidor = 'Residencial'", "DscDetalheConsumidor = 'Não se aplica'", "DscUnidade = 'R$/MWh'"],
            fonte=evid.fonte_de_vintage("ANEEL", "Componentes Tarifárias", URL_TARIFA, vint_t),
            chaves_origem=[f"NumCPFCNPJ = {int(d['cnpj'])}, DatInicioVigencia = {p['inicio']}, DscComponenteTarifario em "
                           f"{', '.join(ap.COMPONENTES_PERDAS)} (e TUSD, TE para a participação)"],
            formula="TUSD_PT + TUSD_PNT + TUSD_Per_RB_D + TE_Per_RB (R$/MWh, sem tributos); participação = 100 × soma ÷ (TUSD + TE)",
            numerador=None, denominador=None,
            cobertura=f"processo de {p['inicio']} a {p['fim']}; {t['n_processos']} processos da distribuidora nos arquivos de 2012 a 2026",
            tratamento_ausencia="Processo sem alguma das quatro componentes ou sem TUSD e TE não tem resumo e não é apresentado.",
            revisoes=snap_tarifa.get("revisoes"), testes=testes_c,
            download=[{"rotulo": "Componentes de perdas na tarifa B1 (CSV)", "url": _url(CSV_TARIFA)}], reproducao=reproducao)
    base.escreve_gold(JSON_EVID_TARIFA, {"gerado_em": base.agora_utc(), "consultada_em": hoje_iso, "evidencias": evid_tar}, destino=base.SERIES)

    # associação descritiva com a renda (P058): ρ de Spearman com a taxa de perdas totais
    evid_assoc = None
    if rho_tot is not None:
        arquivos_assoc = [evid.arquivo_de_vintage(v_samp)] + [evid.arquivo_de_vintage(v) for ds in (DS_IBGE, DS_LIMITES, DS_INDQUAL, DS_MMGD)
                                                                for v in _vintages_recentes(con, ds)]
        cnpjs_assoc = [x[0] for x in pontos]
        evid_assoc = evid.construir(
            indicador="Associação entre renda média da área e taxa de perdas totais (ρ de Spearman)",
            valor_exibido=_num_br(rho_tot, 3), valor_calculo=_r(rho_tot, 6), unidade="ρ de Spearman (adimensional, de −1 a 1)",
            periodo={"inicio": f"{ano_assoc}-01", "fim": f"{ano_assoc}-12"}, entidade="Concessionárias de distribuição (Brasil)",
            universo=(f"{n_tot} concessionárias com {ano_assoc} completo, sem alerta e com território na relação de "
                      f"{rel_assoc['ano'] if rel_assoc else ano_assoc}"),
            fonte={**fonte_ev, "arquivos": arquivos_assoc},
            consulta=(f"concessionárias válidas em {ano_assoc} (12 meses, sem alerta) com municípios confirmados na relação conjunto × "
                      f"distribuidora de {ano_assoc}; renda: IBGE, tabela 10295, rendimento nominal médio domiciliar per capita × moradores. "
                      f"Os {len(cnpjs_assoc)} CNPJs e os pares (renda, taxa) estão em associacao.pontos da gold perdas.json"),
            formula=("ρ = correlação de Pearson entre os postos (empates com posto médio) da renda média domiciliar per capita dos "
                     "municípios confirmados da área (ponderada por moradores) e da taxa de perdas totais do mesmo ano"),
            exclusoes=[f"{x['sigla'] or x['cnpj']}: {x['motivo']}" for x in excluidas_assoc],
            cobertura=f"{n_tot} concessionárias; vínculos confirmados pelo cadastro de MMGD em {confirmacao_assoc.get('mmgd', 0)}, pela UF principal em {confirmacao_assoc.get('uf_principal', 0)}",
            tratamento_ausencia="Concessionária sem renda na área ou fora da comparação no ano não entra; nada é imputado.",
            revisoes=snap_samp.get("revisoes"),
            testes=[evid.teste("postos_sem_arredondamento", "aprovado", "postos calculados sobre a renda e a taxa sem arredondamento (o arredondamento criaria empates)"),
                    evid.teste("territorio_do_ano_das_perdas", "aprovado", f"perdas e território de {ano_assoc}; Censo de 2022"),
                    evid.teste("confirmacao_dos_vinculos", "ressalva" if confirmacao_assoc.get("uf_principal") else "aprovado",
                               f"{confirmacao_assoc.get('uf_principal', 0)} concessionárias incorporadas depois (sem empreendimento no cadastro atual de MMGD) entram pelos vínculos da UF principal"),
                    evid.teste("unitarios", "aprovado", "pipeline/tests/test_energia_perdas.py: test_spearman_com_empates, TerritorioDoAnoDasPerdas e "
                               "GoldPublicada.test_associacao_usa_territorio_do_ano_das_perdas")],
            download=[{"rotulo": "Contexto social por distribuidora (CSV)", "url": _url(CSV_CONTEXTO)}], reproducao=reproducao)

    # ---------------------------------------------------------------- bloqueios e decisões
    bloqueios = [
        {"item": "Perda não técnica regulatória e custo total reconhecido em reais por processo tarifário (P057, P058)",
         "tentativas": ["https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/relatorioseindicadores/tarifaeconomico/Relatorio_Perdas_Energia.pdf",
                        "https://calculostarifarios.aneel.gov.br/lista-publica (memórias de cálculo PCAT)",
                        "https://www2.aneel.gov.br/cedoc/ (resoluções homologatórias e PRORET 2.6)",
                        "https://portalrelatorios.aneel.gov.br/luznatarifa/perdasenergias (painel Perdas de Energia)",
                        "http://rap.aneel.gov.br/relatoriosRAP/?folder=ANEEL/SGT/PubSGT/Relatorios%20Externos&report=PerdasDIT",
                        "https://biblioteca.aneel.gov.br/acervo/detalhe/257294",
                        "dadosabertos.aneel.gov.br: busca por perdas, PNT, perdas regulatórias (só SAMP Balanço, subsídios e BDGD)"],
         "evidencia": "30/09/2026 (21h50 e 22h42 UTC): HTTP 403 com cabeçalho cf-mitigated: challenge (desafio do Cloudflare) em git.aneel.gov.br, calculostarifarios.aneel.gov.br, www2.aneel.gov.br e biblioteca.aneel.gov.br; portalrelatorios.aneel.gov.br e rap.aneel.gov.br (relatório PerdasDIT, ligado na página S6) encerram a conexão (curl 35). A página de conceito (S5) remete o histórico de perdas não técnicas à página S6, cujos arquivos estão nesses hosts. O relatório da ANEEL (edição 2025/2024) traz os valores regulatórios por distribuidora só em figuras, sem tabela.",
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
        "Agregados só com distribuidoras de ano completo e sem alerta físico (inclui balanço que não fecha acima de 5% da injetada e fornecida maior que a injetada); as excluídas aparecem contadas por motivo.",
        "Não técnica = linha publicada 'Perdas Não-Técnicas' (valor medido), com a identidade total = técnica + não técnica conferida mês a mês; agente-ano que não fecha sai dos agregados de técnica e não técnica. Técnica só do valor medido, nunca substituída pela faturada.",
        "Série nacional com cobertura e marca de universo por linha; variação anual só nas mesmas distribuidoras dos dois anos (sem mudança de escala entre eles) e série de universo fixo para os três últimos anos completos.",
        "Quebra de escala (injetada mais de 30% maior ou menor) e absorção provável observada no SAMP marcadas em todo par de anos; o par afetado não entra em variação anual.",
        "Percentual técnico regulatório: só trechos de 6 meses ou mais formam referência; resolução homologatória associada só com troca de ao menos 0,02 p.p.",
        "Tarifa: só o processo com início ≤ data da consulta ≤ fim é apresentado como vigente; sem ele, o último já iniciado sai com a situação 'vigencia_encerrada'.",
        "Ano aberto comparado só com o mesmo período do ano anterior (janeiro até o último mês publicado por ao menos 90% das distribuidoras), sobre as mesmas distribuidoras nos dois recortes.",
        "Divergência entre representações de uma grandeza (linha TOTAL, linha de todos os níveis, soma dos níveis) é arbitrada pela soma dos níveis ou pelo fechamento do balanço do mês; só a que nenhuma das duas confirma gera alerta.",
        "Associação com renda calculada com as perdas de 2022, o ano do Censo, e com o território de 2022 (limites de continuidade daquele ano), para que as três grandezas descrevam o mesmo ano.",
    ]
    # comparação informativa com o relatório da ANEEL (edição 2025/2024), obtido por cópia de terceiro
    comparacao_relatorio = {
        "documento": "ANEEL/STR, Perdas de Energia Elétrica na Distribuição, edição 2025/2024 (16 p., extração do SAMP de maio de 2025)",
        "acesso": "Original em git.aneel.gov.br bloqueado por desafio do Cloudflare; cópia de terceiro (agenciainfra.com, sha256 58d6da5b4edd06f4cf3e2c6c6627a166404de17ad90e81b838a39c139d6aa706). Os valores do relatório aparecem aqui só como alvo desta conferência, rotulados como do relatório; nenhum indicador do observatório é calculado a partir deles.",
        "valores_relatorio": {"taxa_total_pct": 14.0, "perdas_tecnicas_twh": 44.6, "taxa_tecnica_pct": 7.4, "pnt_twh": 40.2,
                              "pnt_injetada_pct": 6.6, "mercado_bt_faturado_sobre_injetada_pct": 41.4, "base": "faturada"},
        "valores_observatorio": {"taxa_total_pct": (rel2024 or {}).get("taxa_total_pct"),
                                 "injetada_twh": _r((rel2024 or {}).get("injetada_mwh", 0) / 1e6, 1) if rel2024 else None,
                                 "injetada_publicada_twh": _r(sum(a["injetada"] for (cnpj, y), a in anuais.items()
                                                                   if y == 2024 and grupos.get(cnpj) == "concessionaria"
                                                                   and _valido_para_agregado(a)) / 1e9, 1) if rel2024 else None,
                                 "base": "medida"},
        "leitura": "A injetada de referência de 2024 cai no intervalo implícito no relatório; a taxa total medida fica acima da faturada do relatório porque o mercado faturado inclui o custo de disponibilidade (a própria ANEEL registra essa diferença ao migrar para o mercado medido em 2025).",
    }

    aviso = None
    if ano_parcial:
        aviso = (f"{ano_parcial} tem dados até {c.mes_br(ultimo_mes_parcial)} e não entra em comparações com anos completos"
                 + (f"; o acumulado de janeiro a {MESES_EXTENSO[mes_fim - 1]} é comparado com o mesmo período de {ano_parcial - 1}." if mes_fim else "."))
    gold = {
        **c.cabecalho(GOLD),
        "referencia": {"ano": ano_ref, "ano_parcial": ano_parcial, "ultima_competencia": ultima_comp,
                       "ultima_competencia_parcial": ultimo_mes_parcial, "mes_fim_acumulado": mes_fim, "aviso_parcial": aviso,
                       "tarifa_consultada_em": hoje_iso},
        "definicoes": DEFINICOES,
        # só as concessionárias na gold (a série de destaque); os três universos completos
        # ficam em perdas_nacional.json, lido sob demanda, e no CSV nacional
        "nacional": [x for x in nacional if x["universo"] == "concessionarias"],
        "acumulado": {"ano": ano_parcial, "mes_fim": mes_fim, "agregados": acum_nac} if mes_fim else None,
        "distribuidoras": distribuidoras,
        "universo_fixo": universo_fixo,
        "associacao": {"variavel_territorial": "renda média domiciliar per capita (Censo 2022) dos municípios da área no ano das perdas",
                       "ano_perdas": ano_assoc, "ano_relacao": (rel_assoc or {}).get("ano"),
                       "confirmacao": dict(confirmacao_assoc), "excluidas": excluidas_assoc,
                       "spearman_pnt_bt": _r(rho_pnt, 3), "n_pnt_bt": n_pnt, "spearman_taxa_total": _r(rho_tot, 3), "n_taxa_total": n_tot,
                       "universo": (f"concessionárias com o ano {ano_assoc} completo, sem alerta e com território na relação de {ano_assoc}; "
                                    "não técnica só das que têm a separação publicada e fechando"),
                       "campos_pontos": ["cnpj", "renda_media_pc_confirmados", "pnt_bt_pct", "taxa_total_pct", "cobertura_exclusivos_pct"],
                       "pontos": pontos,
                       "leitura": "Associação descritiva entre áreas, não causa: renda municipal média não descreve cada unidade consumidora e perdas dependem também de gestão, rede e fiscalização. Perda não técnica não é atribuída às famílias da área."},
        "mapa": {"ano_relacao": (rel or {}).get("ano"), "municipios": len(municipios),
                 "municipios_compartilhados": sum(1 for m in municipios.values() if m["n_confirmadas"] > 1),
                 "vinculos": sum(len(m["dist"]) for m in municipios.values()),
                 "vinculos_nao_confirmados": sum(1 for m in municipios.values() for d in m["dist"] if not d["confirmado"]),
                 "codigos_invalidos": sorted(cod for cod, m in municipios.items() if m["valido"] is False),
                 "municipios_so_mmgd": sorted(cod for cod, m in municipios.items() if any(d["origem"] == "mmgd" for d in m["dist"])),
                 "municipios_sem_vinculo": municipios_sem_vinculo,
                 "vinculos_fora_do_samp": sum(1 for m in municipios.values() for d in m["dist"] if d["cnpj"] not in cadastro),
                 "conjuntos_sem_municipio": (rel or {}).get("conjuntos_sem_municipio", []),
                 "geometria": "public/energia/geo/municipios.json (malha municipal do IBGE, gerada por pipeline/energia/geo.py)",
                 "arquivo": _url(JSON_MUN),
                 "regra": "Cor da área = valor da distribuidora (nunca repartido entre municípios); município compartilhado aparece com marca própria; vínculo não confirmado aparece só com contorno; vínculo só pelo cadastro de MMGD tem marca própria; município sem vínculo fica sem cor e é listado."},
        "qualidade": {
            "agentes_no_arquivo": int(regs_samp.get("_arquivo", {}).get("agentes_total") or 0),
            "agentes_com_balanco_de_distribuicao": len(cadastro),
            "agentes_ano_completos": sum(1 for a in anuais.values() if a["completo"]),
            "reconciliacao": dict(collections.Counter(a["reconciliacao"] for a in anuais.values() if a["completo"])),
            "alertas": dict(collections.Counter(x for a in anuais.values() for x in a["alertas"])),
            "decomposicao": dict(collections.Counter(a["decomposicao"] for a in anuais.values() if a["completo"])),
            "limite_residuo_balanco_pct": 100 * ap.LIMITE_RESIDUO_BALANCO,
            "mudancas_de_universo": {"absorcoes": len(absorcoes), "sucessoes": len(sucessoes),
                                     "pares_com_quebra_de_escala": sum(1 for v in pares.values() if v["quebra_escala"]),
                                     "cnpj_com_digito_invalido": sorted(x for x, ok in dv_valido.items() if not ok)},
            "linhas_duplicadas_ignoradas": len(duplicadas), "ressalvas": ressalvas,
            "comparacao_relatorio_aneel": comparacao_relatorio,
        },
        "bloqueios": bloqueios, "decisoes": decisoes,
        "proveniencia": prov,
        "evidencias": {"taxa_nacional": evid_nac, "perdas_nacional": evid_vol, "pnt_bt_nacional": evid_pnt,
                       "injetada_2024": evid_2024, "acumulado": evid_acum, "associacao": evid_assoc},
        "downloads": [
            {"rotulo": "Perdas por distribuidora e ano (CSV)", "url": _url(CSV_ANUAL)},
            {"rotulo": "Balanço mensal por distribuidora, para auditoria (CSV)", "url": _url(CSV_MENSAL)},
            {"rotulo": "Série nacional por universo (CSV)", "url": _url(CSV_NACIONAL)},
            {"rotulo": "Percentual técnico regulatório implícito (CSV)", "url": _url(CSV_PT)},
            {"rotulo": "Componentes de perdas na tarifa B1 (CSV)", "url": _url(CSV_TARIFA)},
            {"rotulo": "Municípios e distribuidoras (CSV)", "url": _url(CSV_MUN)},
            {"rotulo": "Contexto social por distribuidora (CSV)", "url": _url(CSV_CONTEXTO)},
            {"rotulo": "Acumulado do ano aberto e mesmo período do ano anterior (CSV)", "url": _url(CSV_ACUM)},
        ],
        "series": {"anual": _url(JSON_ANUAL), "municipios": _url(JSON_MUN), "evidencias": _url(JSON_EVID),
                   "nacional": _url(JSON_NACIONAL), "evidencias_tarifa": _url(JSON_EVID_TARIFA),
                   "evidencias_tecnica": _url(JSON_EVID_TECNICA)},
    }
    return _sem_privados(gold)


def _contagem_separacao(nacional, ano_ref):
    """Concessionárias válidas com a separação técnica publicada nos 12 meses, por ano, de
    2023 até o ano de referência, lidas da própria série nacional (ex.: "48 de 50 em 2023,
    32 de 51 em 2024 e 18 de 51 em 2025"). Ano sem linha completa fica de fora."""
    partes = [f"{x['n_com_tecnica']} de {x['n_distribuidoras']} em {x['ano']}" for x in nacional
              if x["universo"] == "concessionarias" and not x.get("parcial") and 2023 <= x["ano"] <= ano_ref
              and x.get("n_distribuidoras")]
    if not partes:
        return "parte das distribuidoras (contagem por ano na série nacional)"
    texto = partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + " e " + partes[-1]
    return f"parte das concessionárias (com a separação publicada nos 12 meses: {texto})"


def _colunas_comparacao(x):
    """Colunas do CSV nacional sobre universo e comparação com o ano anterior nas mesmas
    distribuidoras (vazias no primeiro ano ou sem distribuidora válida)."""
    u, m = x.get("universo_igual_ano_anterior"), x.get("mesmas_ano_anterior")
    col = [None if u is None else int(u[k]) for k in ("total", "tecnica", "pnt_bt")]
    for n, chave in (("n_total", "taxa_total_pct"), ("n_tecnica", "taxa_tecnica_pct"), ("n_pnt_bt", "pnt_bt_pct")):
        par = (m or {}).get(chave) or [None, None]
        col += [(m or {}).get(n), par[0], par[1]]
    return col + [(m or {}).get("fora_por_mudanca_de_universo")]


def _reconc_2024(nacional):
    """(resultado, detalhe) da conferência da injetada de 2024 com o relatório da ANEEL; (None,
    motivo) sem dado de 2024. O relatório publica 44,6 TWh = 7,4% e 40,2 TWh = 6,6% da injetada;
    com o arredondamento a uma casa, a injetada fica em [max(44,6/0,0745; 40,2/0,0665);
    min(44,6/0,0735; 40,2/0,0655)]."""
    x = next((n for n in nacional if n["ano"] == 2024 and n["universo"] == "concessionarias"), None)
    if not x or x["injetada_mwh"] is None:
        return None, "sem dado de 2024"
    twh = x["injetada_mwh"] / 1e6
    lo = max(44.6 / 0.0745, 40.2 / 0.0665)
    hi = min(44.6 / 0.0735, 40.2 / 0.0655)
    ok = lo <= twh <= hi
    return ("aprovado" if ok else "reprovado"), f"{twh:.1f} TWh; intervalo implícito [{lo:.1f}; {hi:.1f}] TWh".replace(".", ",")


def _pct_br(v, casas=1):
    """Percentual no formato brasileiro ("14,7%"); None fica None (ausência não vira texto numérico)."""
    if v is None:
        return None
    return f"{v:.{casas}f}%".replace(".", ",")


def _num_br(v, casas=2):
    """Número no formato brasileiro com sinal de menos tipográfico ("−0,606"); None fica None."""
    if v is None:
        return None
    return f"{v:.{casas}f}".replace("-", "\u2212").replace(".", ",")


def _mwh3(kwh):
    """kWh → MWh com três casas: o valor exato da fonte (inteiro em kWh) em MWh."""
    return None if kwh is None else round(kwh / 1000.0, 3)


def _twh_br(mwh):
    """MWh → "90,2 TWh" (uma casa), para o texto exibido; o valor de cálculo segue em MWh."""
    if mwh is None:
        return None
    return f"{mwh / 1e6:.1f} TWh".replace(".", ",")


DEFINICOES = {
    "perdas_totais": "Energia injetada na rede da distribuidora que não chega a ser entregue como consumo medido: diferença calculada pela ANEEL no SAMP Balanço (valor medido).",
    "perdas_tecnicas": "Parcela atribuída às leis da física (aquecimento de cabos e transformadores). No SAMP é o percentual regulatório do processo tarifário aplicado à energia injetada publicada: estimativa, não medição. Usada só a linha do valor medido.",
    "perdas_nao_tecnicas": "Linha 'Perdas Não-Técnicas' publicada pela fonte (valor medido); pela definição da ANEEL, perdas totais menos as técnicas, identidade conferida mês a mês (quando não fecha, o agente-ano fica fora dos agregados de separação). Incluem furto, fraude, erros de medição, leitura e faturamento; a fonte não separa essas causas. Pode ser negativa quando a estimativa técnica supera a perda total medida.",
    "energia_injetada": "Energia inserida na rede para atender aos consumidores, incluindo as perdas. Denominador das taxas total e técnica.",
    "mercado_bt": "Energia medida entregue a consumidores de baixa tensão (cativos, consumo próprio e livres). Denominador da taxa não técnica, como na regulação da ANEEL.",
    "residuo": "Diferença entre a energia injetada publicada e a soma de energia fornecida, irregular e perdas. Mostra o que a fonte não explica; não é outra perda.",
    "tecnica_regulatoria": "Percentual de perdas técnicas sobre a energia injetada publicada, inferido pelo observatório da própria série do SAMP onde a razão fica constante por 6 meses ou mais; não é o percentual lido de um ato homologatório.",
    "custo_tarifa": "Parte da tarifa residencial B1 (sem tributos) que remunera perdas técnicas, não técnicas e na Rede Básica, em R$/MWh, por processo tarifário.",
}
