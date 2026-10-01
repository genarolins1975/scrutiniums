"""Módulo Dados e metodologia: catálogo, saúde, revisões, download e reprodução (P067 a P070).

Gold: public/energia/gold/publicacao.json; manifesto da publicação em
public/energia/gold/manifesto.json; catálogo em public/energia/gold/catalogo.json
(pipeline/energia/catalogo.py); tabelas em public/energia/series/dados_*.csv; Parquet
ao lado de cada CSV grande de public/energia/series.

Por que existe: "o que está validado, o que é antigo, o que foi revisado e qual
cobertura a análise tem" (seção 9.17) não pode vir de selos fixos nem do que cada
módulo declara de si. Este módulo lê o que o pipeline realmente guardou e publicou,
sem lista fixa de conjuntos (tudo vem dos REGISTRO dos módulos, dos silvers e das
golds presentes), e calcula:

1. P067: o estado de cada conjunto na escada catalogado, recurso verificado,
   integrado, validado e publicado, cada etapa com evidência; o uso (indicador, modelo
   com o seu estado, conferência) como eixo separado; a CCEE recurso a recurso a partir
   dos package_show versionados (o portal responde 403 a este ambiente); descontinuados.
2. P068: por conjunto, último período disponível, captura, tentativa e falha (a falha
   nunca renova a data do dado), frequência declarada pela fonte e SLA de atualidade
   derivado dela, completude interna das séries e cobertura do último período, e
   revisões com magnitude e alcance (referências, séries, período afetado, maior
   mudança absoluta e relativa); calendário de capturas, falhas e revisões.
3. P069: Parquet ao lado dos CSV grandes (mesmo conteúdo, conferido célula a célula),
   manifesto com sha256 de cada arquivo publicado e id da publicação, dicionário de
   colunas e instruções de reprodução pelo histórico do git.
4. P070: validador genérico (pipeline/energia/validacoes.py) aplicado a todas as
   golds, CSV e conjuntos; natureza e situação da validação como eixos separados (11.3),
   afirmações de integração geradas do estado real do catálogo.

Fontes próprias (família `publicacao`): listagem package_search do ONS e da ANEEL,
package_show versionados da CCEE, verificação parcial de recursos e metadados de
frequência de fontes fora dos portais (SIDRA, CVM, MME).
"""
import csv
import json
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base, catalogo  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia import validacoes as val  # noqa: E402
from pipeline.energia.fontes import ckan_dados as ck  # noqa: E402
from pipeline.energia.fontes import publicacao_dados as pub  # noqa: E402
from pipeline.energia.fontes import silver_dados as sd  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "publicacao.json"
MANIFESTO = "manifesto.json"
FAMILIA = "publicacao"
SITE = "https://scrutiniums.com/setor-eletrico/dados"
PAGINAS = [{"rotulo": "Dados e metodologia", "href": "/setor-eletrico/dados"},
           {"rotulo": "Metodologia", "href": "/setor-eletrico/metodologia"}]
CSV = {
    "conjuntos": "dados_conjuntos.csv", "validacoes": "dados_validacoes.csv", "revisoes": "dados_revisoes.csv",
    "calendario": "dados_calendario.csv", "catalogo": "dados_catalogo.csv", "eixos": "dados_eixos.csv",
    "recursos_ons": "dados_recursos_ons.csv", "recursos_aneel": "dados_recursos_aneel.csv", "recursos_ccee": "dados_recursos_ccee.csv",
}
PORTAIS_RECURSOS = ("ONS", "ANEEL", "CCEE")
U = {k: f"/energia/series/{v}" for k, v in CSV.items()}
# saídas deste módulo não são validadas por ele mesmo (o relatório não se autovalida;
# o teste pipeline/tests/test_energia_dados.py cobre o formato)
PROPRIOS = {GOLD, MANIFESTO, *CSV.values()}
# golds de controle: catálogo, metadados e registros, sem indicador com proveniência
GOLDS_CONTROLE = {"catalogo.json", "meta.json", "metricas.json", "arquivos.json", MANIFESTO, GOLD, "avaliacao.json",
                  "modelos.json"}
# reescritos pelo orquestrador depois deste módulo (run.py e executar_modulo.py): o sha256
# calculado aqui não seria o publicado. Saem do manifesto até o orquestrador chamar
# escreve_manifesto(final=True) no fim da execução (pedido ao integrador).
POSTERIORES = ("arquivos.json", "metricas.json", "catalogo.json", "meta.json")
LIMIAR_PARQUET = 2 * 1024 * 1024
# SLA de atualidade: o período seguinte ao último disponível deve chegar até o fim dele
# mais a tolerância da cadência declarada pela fonte.
TOLERANCIA_DIAS = {"diaria": 2, "semanal": 7, "quinzenal": 15, "mensal": 60, "trimestral": 90, "anual": 365}
PERIODO_DIAS = {"diaria": 1, "semanal": 7, "quinzenal": 15, "mensal": 31, "trimestral": 92, "anual": 366}
JANELA_CALENDARIO_DIAS = 120
LICENCA_PROPRIA = ("Sem licença declarada no repositório para os metadados do pipeline; os dados de origem seguem a licença "
                   "de cada fonte, registrada no catálogo.")

SITUACOES_VALIDACAO = {
    "reconciliacao_aprovada": "Reconciliação por caminho independente aprovada (outro arquivo, total oficial ou releitura por outro código).",
    "controles_aprovados": "Controles internos aprovados, sem reconciliação externa registrada.",
    "ressalva": "Ressalva: algum teste ou a reconciliação aponta limitação declarada.",
    "divergencia": "Divergência: teste ou reconciliação reprovado.",
    "pendencia": "Pendência: número publicado sem ficha de evidência com testes.",
}
NATUREZAS = {
    "OBSERVADO": "Medido ou publicado pela fonte como observação.",
    "ESTIMADO": "Estimado pela fonte (ou pelo observatório, quando a ficha diz).",
    "CALCULADO": "Calculado pelo observatório a partir de dados da fonte, com fórmula publicada.",
    "PREVISTO": "Previsão de modelo.",
    "CENARIO": "Cenário de planejamento.",
}
# afirmações de integração que a página Metodologia faz: o texto sai do estado real
AFIRMACOES = [
    {"id": "limites_intercambio", "tema": "Limites de intercâmbio entre subsistemas", "conjuntos": ["ons:documentos-limites-intercambio"],
     "gold_achado": ("rede_detalhe.json", "A06"),
     "afirmacao_anterior": "A metodologia afirmava que os limites de intercâmbio estavam catalogados.",
     # vale enquanto o achado estiver bloqueado: se o módulo Rede integrar um recurso
     # estruturado com os limites, o texto volta a ser o do estado do catálogo
     "texto_bloqueado": ("Limites de intercâmbio entre subsistemas: não há conjunto público estruturado com os limites operativos e "
                         "as suas vigências; os limites estão no Relatório Quadrimestral de Limites de Intercâmbio, no SINtegre do "
                         "ONS (acesso autenticado), e não foram integrados. Nenhum percentual de uso do limite é calculado.")},
    {"id": "intercambio_verificado", "tema": "Intercâmbio verificado entre subsistemas", "conjuntos": ["ons:intercambio-nacional"]},
    {"id": "cvu_usina", "tema": "CVU por usina térmica", "conjuntos": ["ons:cvu-usitermica"]},
    {"id": "geracao_usina", "tema": "Geração por usina", "conjuntos": ["ons:geracao-usina-2"]},
    {"id": "despacho_termico", "tema": "Geração térmica por motivo de despacho", "conjuntos": ["ons:geracao-termica-despacho-2"]},
    {"id": "pld_horario", "tema": "PLD horário", "conjuntos": ["ccee:pld_horario"]},
    {"id": "cmo", "tema": "CMO semanal e semi-horário", "conjuntos": ["ons:cmo-semanal", "ons:cmo-semi-horario"]},
    # conjuntos da CCEE além do PLD: a lista sai do catálogo (todo conjunto da CCEE que
    # chegou pelo menos a INTEGRADO), sem cópia à mão de quais o módulo Mercado integrou
    {"id": "mercado_ccee", "tema": "Conjuntos da CCEE integrados (mercado de curto prazo e cadastro de agentes)",
     "conjuntos": "CCEE_INTEGRADOS"},
]

REGISTRO = {
    "id": "dados",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 95,
    "datasets": [
        {"orgao": "ONS", "nome": "api-package-search", "slug": "ons-catalogo-ckan", "dataset_silver": "catalogo_ckan_ons",
         "titulo": "Listagem dos conjuntos do portal de dados abertos do ONS (API CKAN package_search)",
         "estado": "UTILIZADO EM INDICADOR", "url": ck.CATALOGOS["ONS"]["url"], "licenca": c.LICENCA_ONS, "tema": "outros",
         "formatos": ["JSON"],
         "descricao": ("Resposta completa da API (conjuntos, recursos, datas de modificação e campos extras, como o horário de "
                       "atualização declarado), versionada com sha256 a cada mudança: base dos estados catalogado e recurso "
                       "verificado e do histórico de publicação pela fonte."),
         "paginas": PAGINAS, "downloads": [U["catalogo"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "api-package-search", "slug": "aneel-catalogo-ckan", "dataset_silver": "catalogo_ckan_aneel",
         "titulo": "Listagem dos conjuntos do portal de dados abertos da ANEEL (API CKAN package_search)",
         "estado": "UTILIZADO EM INDICADOR", "url": ck.CATALOGOS["ANEEL"]["url"],
         "licenca": "Open Data Commons Open Database License (ODbL), conforme o portal de dados abertos da ANEEL", "tema": "outros",
         "formatos": ["JSON"],
         "descricao": ("Resposta completa da API (conjuntos, recursos, frequência de atualização declarada, situação e "
                       "descontinuação), versionada com sha256 a cada mudança."),
         "paginas": PAGINAS, "downloads": [U["catalogo"]], "quebras": []},
        {"orgao": "CCEE", "nome": "api-package-search", "slug": "ccee-catalogo-ckan", "dataset_silver": ck.CATALOGOS["CCEE"]["dataset"],
         "titulo": "Listagem dos conjuntos do portal de dados abertos da CCEE (API CKAN package_search)",
         "estado": "UTILIZADO EM INDICADOR", "url": ck.CATALOGOS["CCEE"]["url"], "licenca": c.LICENCA_CCEE, "tema": "mercado",
         "formatos": ["JSON"],
         "descricao": ("Resposta completa da API (conjuntos e recursos, com data de modificação de cada arquivo), versionada com "
                       "sha256 a cada mudança: base do catálogo da CCEE recurso a recurso. Pedida pelo cliente HTTP do pipeline "
                       "com o User-Agent do projeto; quando o portal recusa, a falha fica registrada e valem os package_show "
                       "versionados no repositório."),
         "paginas": PAGINAS, "downloads": [U["catalogo"], U["recursos_ccee"]], "quebras": []},
        {"orgao": "CCEE", "nome": "package-show-versionados", "slug": "ccee-package-show-versionados", "dataset_silver": ck.DS_SEED_CCEE,
         "titulo": "Metadados oficiais (package_show) de conjuntos da CCEE versionados no repositório",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://dadosabertos.ccee.org.br/", "licenca": c.LICENCA_CCEE, "tema": "mercado",
         "formatos": ["JSON"],
         "descricao": ("Todo package_show guardado em pipeline/energia/seed/ccee_* (PLD_HORARIO, conjuntos do mercado de curto "
                       "prazo e os do módulo Mercado), conferido por sha256 com o MANIFESTO da pasta: alternativa do catálogo da "
                       "CCEE quando a listagem do portal falha, e histórico dos metadados de cada conjunto."),
         "paginas": PAGINAS, "downloads": [U["catalogo"]], "quebras": []},
    ],
    "arquivos": {
        U["conjuntos"]: (
            "Uma linha por conjunto integrado (família e dataset do silver): estado (CATALOGADO, RECURSO VERIFICADO, INTEGRADO, "
            "VALIDADO, PUBLICADO); papeis (uso declarado: indicador, modelo, conferencia, contexto, historico); golds; "
            "frequencia_declarada (texto da fonte), campo_frequencia (campo de onde foi lida), caso_sla (A a D, regra em "
            "publicacao.json, regras.sla_texto) e cadencia_sla; granularidade, ref_min e ultimo_periodo (maior referência até "
            "hoje); prazo_proximo (data até a qual o período seguinte deve chegar) e situacao (EM DIA, ATRASADO, SEM SLA, "
            "SEM DADO) com dias_atraso; capturas, primeira_captura e ultima_captura (UTC); ultima_publicacao_fonte (last_modified "
            "informado pela fonte, vazio quando não informado); tentativas, falhas, ultima_falha_em e falhas_consecutivas; series, "
            "linhas e completude_interna (0 a 1); series_no_ultimo e series_no_anterior; revisoes_eventos, revisoes_referencias, "
            "revisoes_series, revisao_ref_min, revisao_ref_max, maior_revisao_abs (unidade da série) e maior_revisao_rel_pct; "
            "validacao (aprovado, ressalva, reprovado) e contagem de checagens; originais_ausentes e sha256_divergentes no bronze. "
            "Vazio = não se aplica ou não informado."),
        U["validacoes"]: (
            "Uma linha por checagem automática: id; alvo (gold, CSV, conjunto ou identidade); tipo; resultado (aprovado, "
            "ressalva, reprovado, nao_aplicavel); detalhe; criterio; verificados (itens conferidos); problemas; exemplos (JSON "
            "com até 5 casos)."),
        U["revisoes"]: (
            "Revisões da fonte detectadas entre capturas: familia; dataset; serie; ref (período de referência revisado); "
            "valor_anterior e valor_novo (unidade da série); diferenca; diferenca_relativa_pct (vazio quando o valor anterior é "
            "zero); capturado_anterior e capturado_novo (UTC); recurso. Até 300 maiores revisões relativas por conjunto; a "
            "contagem completa está em dados_conjuntos.csv."),
        U["calendario"]: (
            "dia (data UTC da captura); familia; dataset; capturas_novas (vintages com conteúdo novo); recapturas_sem_mudanca "
            "(downloads idênticos à vintage vigente); falhas (tentativas sem êxito); referencias_revisadas (valores alterados "
            "pela captura do dia); publicacoes_fonte (arquivos com last_modified informado pela fonte naquele dia)."),
        U["catalogo"]: (
            "Uma linha por conjunto do catálogo: id (órgão:nome); orgao; nome; titulo; estado; papeis; descontinuado (1/0) e "
            "motivo; frequencia_declarada; recurso_verificado_em (UTC); integracoes (datasets do silver); golds; recursos "
            "(arquivos na listagem atual), recursos_acessados (baixados com sha256 ou lidos por requisição parcial), "
            "recursos_integrados e recursos_removidos (sumiram da listagem); url; licenca; metadados_verificados (0 = cadastro "
            "manual); descricao (texto integral da fonte, com ';' trocado por ',')."),
        **{U[f"recursos_{o.lower()}"]: (
            f"Uma linha por recurso (arquivo) de cada conjunto da listagem do portal {o}: orgao; conjunto (nome no portal); "
            "recurso_id; recurso (nome); formato; publicado_em (last_modified informado pela fonte; vazio quando não informado); "
            "tamanho (bytes, quando a fonte informa); presente (1 = na listagem atual, 0 = removido ou renomeado pela fonte); "
            "estado (CATALOGADO, RECURSO VERIFICADO, INTEGRADO, VALIDADO, PUBLICADO; o recurso capturado por integração "
            "declarada herda o estado dela); via (como o estado foi obtido); capturas (vintages com sha256 nos silvers); "
            "ultima_captura (UTC); datasets_silver (família/dataset que o capturou); verificado_em (requisição parcial, UTC); url.")
          for o in PORTAIS_RECURSOS},
        U["eixos"]: (
            "Uma linha por ficha 'Comprove este número' publicada: gold; indicador; natureza (da proveniência de mesmo nome, vazio "
            "se não houver); situacao_validacao (reconciliacao_aprovada, controles_aprovados, ressalva, divergencia, "
            "pendencia); reconciliacao (resultado); testes_aprovados, testes_ressalva, testes_reprovados."),
    },
}


# ---------------------------------------------------------------- coleta


def coletar(con, ctx):
    """Listagens dos portais, package_show versionados da CCEE, verificação parcial dos
    recursos ainda não integrados e metadados de frequência fora dos portais."""
    status = {"ok": True}
    if ctx.get("sem_rede"):
        status["seed_ccee"] = ck.importa_seed_ccee(con)[0]
        return status
    pacotes = {}
    for orgao in ("ONS", "ANEEL", "CCEE"):
        cache = ck.cache_catalogo(orgao)
        if cache and cache.get("colhido_em") and _horas_desde(cache["colhido_em"]) < 1:
            status[orgao] = {"ok": True, "reaproveitado": cache["colhido_em"]}
            pacotes[orgao] = cache.get("resultado") or []
            continue
        st, pk = ck.colhe_catalogo(con, orgao)
        status[orgao] = st
        if pk is not None:
            pacotes[orgao] = pk
    status["seed_ccee"] = ck.importa_seed_ccee(con)[0]
    integrados = {(i["orgao"], i["nome"]) for i in catalogo.integracoes()}
    alvos = []
    for orgao in ("ONS", "ANEEL", "CCEE"):
        for p in pacotes.get(orgao) or []:
            if (orgao, p.get("name")) in integrados:
                continue
            r = ck.escolhe_recurso(p)
            if r:
                alvos.append((f"{orgao}:{p['name']}", r, {"orgao": orgao, "conjunto": p["name"], "tipo": "recurso"}))
    with open(os.path.join(base.RAIZ, "pipeline", "energia", "catalogo_manual.json"), encoding="utf-8") as f:
        for m in json.load(f)["entradas"]:
            if m.get("url"):
                alvos.append((f"MANUAL:{m['id']}", m["url"], {"orgao": m.get("orgao"), "conjunto": m["id"], "tipo": "endereco"}))
    status["verificacao"] = ck.verifica_recursos(con, alvos)
    status["metadados_fontes"] = ck.colhe_metadados_fontes(con, [i for i in catalogo.integracoes() if i["orgao"] not in ("ONS", "ANEEL")])
    con.commit()
    status["ok"] = all((v.get("ok", True) if isinstance(v, dict) else True) for k, v in status.items() if k in ("ONS", "ANEEL"))
    return status


def _enxuto(d):
    """Dicionário sem as chaves de valor None (chave ausente = não se aplica ou não
    informado; o tipo em src/lib/energia/tipos-dados.ts marca esses campos como opcionais)."""
    return {k: v for k, v in (d or {}).items() if v is not None}


def _horas_desde(iso):
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 3600
    except ValueError:
        return 1e9


# ---------------------------------------------------------------- validação das golds e arquivos


def dicionario_arquivos():
    """{url: descrição} dos arquivos para download: REGISTRO de todos os módulos
    (arquivos.json é derivado deles) e as golds de operação (catalogo.ARQUIVOS_OPERACAO)."""
    out = dict(catalogo.ARQUIVOS_OPERACAO)
    for m in catalogo.modulos_validos():
        for url, desc in (m.REGISTRO.get("arquivos") or {}).items():
            out[url] = desc
    return out


def valida_golds(hoje):
    """{nome: {...}} de toda gold em public/energia/gold (sem lista fixa)."""
    out = {}
    for nome in sorted(os.listdir(base.GOLD)):
        if not nome.endswith(".json") or nome.startswith("_") or nome in (GOLD, MANIFESTO):
            continue
        caminho = os.path.join(base.GOLD, nome)
        anterior = val.gold_no_git(nome, base.RAIZ)
        chks = val.valida_gold(nome, caminho, base.RAIZ, hoje=hoje, anterior=anterior,
                               sem_proveniencia=GOLDS_CONTROLE)
        g, _ = val.le_json_estrito(caminho)
        snap = set()
        provs = val.proveniencias(g) if g is not None else []
        for p in provs:
            sid = str((p.get("snapshot") or {}).get("id") or "")
            if sid:
                snap.add(sid.split("@")[0])
        out[nome] = {"checagens": chks, "veredito": val.veredito(chks), "bytes": os.path.getsize(caminho),
                     "disponivel": isinstance(g, dict) and g.get("disponivel") is True,
                     "gerado_em": g.get("gerado_em") if isinstance(g, dict) else None,
                     "datasets_citados": sorted(snap), "_gold": g}
    return out


def valida_csvs(hoje, dicionario):
    out = {}
    for nome in sorted(os.listdir(base.SERIES)):
        if not nome.endswith(".csv") or nome in PROPRIOS:
            continue
        url = "/energia/series/" + nome
        chks = val.valida_csv(os.path.join(base.SERIES, nome), url, dicionario=dicionario, hoje=hoje)
        out[nome] = {"checagens": chks, "veredito": val.veredito(chks)}
    return out


def exporta_e_confere_parquet():
    res = pub.exporta_parquet(base.SERIES, limiar=LIMIAR_PARQUET)
    chks = []
    for r in res:
        if not r.get("csv") or str(r.get("status", "")).startswith("removido"):
            continue
        cpath = os.path.join(base.RAIZ, "public", r["csv"].lstrip("/"))
        ppath = os.path.join(base.RAIZ, "public", r["parquet"].lstrip("/"))
        ok, det, linhas, div, ex = pub.confere_parquet(cpath, ppath)
        r.update({"equivalente": ok, "linhas": linhas})
        chks.append(val.checagem(f"parquet:{os.path.basename(ppath)}", os.path.basename(ppath), "equivalencia",
                                 "aprovado" if ok else "reprovado", det,
                                 criterio="Parquet relido em lotes igual ao CSV: mesmas colunas e linhas, texto igual, número igual "
                                          "ao número escrito no CSV, vazio = nulo",
                                 verificados=linhas, problemas=div, exemplos=ex))
    return res, chks


# ---------------------------------------------------------------- conjuntos (P067 e P068)


def _grupos_integracao():
    grupos = defaultdict(list)
    for it in catalogo.integracoes():
        if it.get("dataset_silver"):
            grupos[(it["familia"], it["dataset_silver"])].append(it)
    return grupos


def _analises(grupos, hoje, cache_hash):
    """Análise de cada (família, dataset) declarado, uma conexão somente leitura por família."""
    por_familia = defaultdict(list)
    for fam, ds in grupos:
        por_familia[fam].append(ds)
    out, nao_declarados = {}, []
    for fam in sd.familias_disponiveis():
        con = sd.abre(fam)
        try:
            presentes = sd.datasets_no_silver(con)
            for ds in sorted(por_familia.get(fam, [])):
                if ds not in presentes:
                    continue
                out[(fam, ds)] = sd.analisa(con, ds, regra_horizonte=val.HORIZONTE_SILVER.get(ds), hoje=hoje,
                                            cache_hash=cache_hash)
            for ds, info in sorted(presentes.items()):
                if ds not in por_familia.get(fam, []):
                    nao_declarados.append({"familia": fam, "dataset": ds, "vintages": info.get("vintages", 0),
                                           "observacoes": bool(info.get("observacoes")), "registros": bool(info.get("registros"))})
        finally:
            con.close()
    return out, nao_declarados


# Extensões de documento guardado para citação (atos em PDF, páginas HTML, metadados XML
# de legislação): conjunto só com elas é integrado como documento, sem tabela extraída.
EXTENSOES_DOCUMENTO = (".pdf.gz", ".pdf", ".html.gz", ".html", ".htm.gz", ".htm", ".xml.gz", ".xml")


def _documental(an):
    vs = (an or {}).get("_vintages") or []
    return bool(vs) and all(str(v.get("arquivo") or "").lower().endswith(EXTENSOES_DOCUMENTO) for v in vs)


def _frequencia(it, brutos, seeds, metadados):
    """Frequência declarada pela fonte e de onde ela vem."""
    orgao, nome = it["orgao"], it["nome"]
    origem, texto, campo, ref_pub, extra = None, None, None, None, {}
    if orgao in ("ONS", "ANEEL", "CCEE"):
        pkg = next((p for p in (brutos.get(orgao) or {}).get("resultado") or [] if p.get("name") == nome), None)
        if pkg is None and orgao == "CCEE":
            pkg = next((p for p in seeds if p.get("name") == nome), None)
        if pkg is not None:
            ex = ck.extras(pkg)
            texto, campo, ref_pub = ex["frequencia_declarada"], ex["campo_frequencia"], ex["referencia_publicacao"]
            origem = "portal"
    m = metadados.get(f"{orgao}:{nome}")
    if texto is None and m:
        texto, campo = m.get("frequencia_declarada"), m.get("campo_frequencia")
        origem = "metadados"
        extra["url_metadados"] = m.get("url_metadados")
        if m.get("ultimo_periodo_fonte"):
            extra["ultimo_periodo_fonte"] = m["ultimo_periodo_fonte"]
    if texto is None and it.get("frequencia"):
        texto, campo, origem = it["frequencia"], "frequencia", "registro"
        extra["modulo"] = it["modulo"]
    cad, sem_sla = ck.frequencias_canonicas(texto, ref_pub)
    # origem: portal (campo extra do conjunto no CKAN), metadados (SIDRA, CKAN da CVM e do
    # MME) ou registro (declarado no REGISTRO do módulo); None quando ninguém declara
    return {"declarada": texto, "campo": campo, "referencia_publicacao": ref_pub, "origem": origem,
            "cadencias": cad, "sem_sla": sem_sla, **extra}


ORDEM_CADENCIA = ["diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual"]


def cadencia_do_grao(formato, passo):
    """Cadência natural de uma série regular pelo seu grão: dado horário ou diário
    chega a cada dia, mensal a cada mês, e assim por diante (None se não há)."""
    if formato == "horaria":
        return "diaria"
    if formato == "diaria":
        return {1: "diaria", 7: "semanal", 14: "quinzenal", 15: "quinzenal"}.get(passo or 1)
    if formato == "mensal":
        return {1: "mensal", 3: "trimestral", 12: "anual"}.get(passo or 1)
    if formato == "trimestral":
        return "trimestral"
    if formato == "anual":
        return "anual" if (passo or 1) == 1 else None
    return None


def regra_sla(cadencias, regular, cad_grao):
    """Qual cadência e qual base usar no SLA (seção 'sla_texto' das regras):

    A. série regular cujo grão corresponde a uma cadência declarada: o período seguinte
       deve chegar até o fim dele mais a tolerância dessa cadência;
    B. série regular publicada em lotes (a fonte declara cadência mais longa que o grão):
       a próxima remessa cobre até o fim do último período mais um período da cadência
       declarada (a mais curta entre as mais longas que o grão);
    C. série regular com cadência declarada mais curta que o grão (a fonte atualiza o
       arquivo dentro do período, ou declara o horário da rotina do portal): vale o grão
       do dado, com a tolerância do grão;
    D. sem série regular (cadastro, vigências, cadência irregular): data de publicação
       informada pela fonte mais um período da cadência declarada (a mais longa).
    Devolve (caso, cadência, origem da cadência)."""
    if not cadencias:
        return None, None, None
    if regular and cad_grao:
        if cad_grao in cadencias:
            return "A", cad_grao, "declarada pela fonte e igual ao grão do dado"
        mais_longas = [c for c in cadencias if ORDEM_CADENCIA.index(c) > ORDEM_CADENCIA.index(cad_grao)]
        if mais_longas:
            return "B", min(mais_longas, key=ORDEM_CADENCIA.index), "declarada pela fonte, mais longa que o grão (publicação em lotes)"
        return "C", cad_grao, "grão do dado (a cadência declarada é mais curta que o grão)"
    return "D", cadencias[-1], "declarada pela fonte (a mais longa, sem série regular de referência)"


def _publicacao_atrasada_do_conteudo(ultimo_periodo, formato, pub):
    """True quando o arquivo traz período que começa depois da data de modificação que a
    fonte informa para ele: a data informada não acompanha o conteúdo."""
    if not ultimo_periodo or not pub:
        return False
    ini = sd.inicio_ref(ultimo_periodo, formato)
    try:
        pubd = datetime.fromisoformat(str(pub)[:19]).date()
    except ValueError:
        return False
    return ini is not None and ini > pubd


def atualidade(an, freq, hoje, descontinuado):
    """SLA de atualidade derivado da frequência declarada pela fonte (regra_sla). A
    base é o último período de referência disponível até hoje, nunca a data da captura:
    falha ou recaptura não renovam o dado. Sem série regular, a base é a data de
    publicação informada pela própria fonte (last_modified do portal)."""
    obs = (an or {}).get("observacoes") or {}
    grupos = obs.get("grupos") or []
    principal = next((g for g in grupos if g["formato"] == obs.get("principal")), grupos[0] if grupos else None)
    out = {"situacao": None, "caso": None, "base": None, "cadencia": None, "origem_cadencia": None, "tolerancia_dias": None,
           "ultimo_periodo": None, "fim_ultimo_periodo": None, "prazo_proximo": None, "dias_atraso": None, "causa": None,
           "motivo_sem_sla": None, "publicacao_nao_acompanha_conteudo": None}
    formato = principal["formato"] if principal else None
    passo = (principal or {}).get("passo")
    regular = bool(principal and formato in sd.REGULARES and passo and (principal.get("aderencia_passo") or 0) >= 0.5)
    if principal:
        ref = principal.get("ref_max_ate_hoje")
        out["ultimo_periodo"] = ref
        if ref:
            fim = sd.fim_ref(ref, formato, passo if (regular and formato in ("diaria", "mensal", "anual")) else None)
            out["fim_ultimo_periodo"] = fim.isoformat() if fim else None
    if descontinuado:
        out.update(situacao="SEM SLA", motivo_sem_sla="Conjunto descontinuado pela fonte: não há atualização a esperar.")
        return out
    if freq["sem_sla"] and not freq["cadencias"]:
        out.update(situacao="SEM SLA", motivo_sem_sla=f"A fonte declara atualização sem cadência: {freq['declarada']!r}.")
        return out
    caso, cad, origem = regra_sla(freq["cadencias"], regular, cadencia_do_grao(formato, passo) if regular else None)
    if not cad:
        out.update(situacao="SEM SLA", motivo_sem_sla="A fonte não declara frequência de atualização em metadado legível.")
        return out
    out.update(caso=caso, cadencia=cad, origem_cadencia=origem, tolerancia_dias=TOLERANCIA_DIAS[cad])
    pub = ((an or {}).get("vintages") or {}).get("ultima_publicacao_fonte")
    if caso in ("A", "C") and out["ultimo_periodo"]:
        out["base"] = "periodo_de_referencia"
        prox = sd._ref_anterior(out["ultimo_periodo"], formato, -passo)
        fim_prox = sd.fim_ref(prox, formato, passo if formato in ("diaria", "mensal", "anual") else None) if prox else None
        if fim_prox is None:
            fim_prox = date.fromisoformat(out["fim_ultimo_periodo"]) + timedelta(days=PERIODO_DIAS[cad])
        prazo = fim_prox + timedelta(days=TOLERANCIA_DIAS[cad])
    elif caso == "B" and out["ultimo_periodo"]:
        out["base"] = "periodo_de_referencia"
        prazo = date.fromisoformat(out["fim_ultimo_periodo"]) + timedelta(days=PERIODO_DIAS[cad] + TOLERANCIA_DIAS[cad])
    elif pub and not _publicacao_atrasada_do_conteudo(out["ultimo_periodo"], formato, pub):
        out["base"] = "publicacao_da_fonte"
        pubd = datetime.fromisoformat(str(pub)[:19]).date()
        prazo = pubd + timedelta(days=PERIODO_DIAS[cad] + TOLERANCIA_DIAS[cad])
    elif pub and out["fim_ultimo_periodo"]:
        # a data de modificação informada pela fonte é anterior ao período mais recente
        # que o próprio arquivo traz: ela não acompanha o conteúdo (como no PLD da CCEE) e
        # não serve de base; vale o fim do último período mais a cadência declarada
        out["base"] = "periodo_de_referencia"
        out["publicacao_nao_acompanha_conteudo"] = True
        prazo = date.fromisoformat(out["fim_ultimo_periodo"]) + timedelta(days=PERIODO_DIAS[cad] + TOLERANCIA_DIAS[cad])
    elif out["fim_ultimo_periodo"] and formato == "intervalo":
        out["base"] = "periodo_de_referencia"
        prazo = date.fromisoformat(out["fim_ultimo_periodo"]) + timedelta(days=PERIODO_DIAS[cad] + TOLERANCIA_DIAS[cad])
    else:
        out.update(situacao="SEM DADO", motivo_sem_sla=("Sem série regular de referência e sem data de publicação informada pela "
                                                       "fonte: não há como medir atraso sem usar a data da captura."))
        return out
    out["prazo_proximo"] = prazo.isoformat()
    if hoje <= prazo:
        out.update(situacao="EM DIA", dias_atraso=0)
    else:
        out.update(situacao="ATRASADO", dias_atraso=(hoje - prazo).days)
        co = (an or {}).get("coletas") or {}
        uf, uo = co.get("ultima_falha"), co.get("ultimo_ok")
        if uf and (not uo or uf["tentado_em"] > uo):
            out["causa"] = f"Falha de coleta: a última tentativa ({uf['tentado_em']}) falhou: {uf['detalhe']}"
        elif uo and _horas_desde(uo) <= 72:
            out["causa"] = f"A fonte não publicou período mais recente até a última coleta bem-sucedida ({uo})."
        else:
            out["causa"] = f"Sem coleta bem-sucedida recente (última em {uo or 'nunca'})."
    return out


def _resumo_revisao(an):
    rv = (an or {}).get("revisoes")
    rr = (an or {}).get("revisoes_registros")
    conflitos = (rv or {}).get("conflitos_entre_recursos") or 0
    exemplos_conflito = (rv or {}).get("exemplos_conflito") or []
    rv = rv if rv and rv.get("eventos") else None
    rr = rr if rr and rr.get("mudancas") else None
    if not rv and not rr and not conflitos:
        return None

    def ev_(x):
        if not x:
            return None
        return {"serie": x["serie"], "ref": x["ref"], "de": c.r(x["de"], 6), "para": c.r(x["para"], 6),
                "diferenca": c.r(x["delta"], 6), "relativa_pct": c.r(100 * x["relativa"], 4) if x["relativa"] is not None else None,
                "capturado_de": x["capturado_de"], "capturado_para": x["capturado_para"], "recurso": x["recurso"]}
    out = {}
    if rv:
        out.update({"eventos": rv["eventos"], "referencias": rv["referencias_revisadas"], "series": rv["series_afetadas"],
                    "ref_min": rv["ref_min"], "ref_max": rv["ref_max"], "a_partir_de_zero": rv["a_partir_de_zero"],
                    "maior_abs": ev_(rv["maior_abs"]), "maior_rel": ev_(rv["maior_rel"]), "por_captura": rv["por_captura"]})
    if rr:
        out["registros"] = {"mudancas": rr["mudancas"], "chaves": rr["chaves_afetadas"], "campos": rr["campos"],
                            "apagados_pela_fonte": rr["apagados_pela_fonte"], "por_captura": rr["por_captura"]}
    if conflitos:
        # mesma (série, referência) em arquivos diferentes com valores diferentes: não é
        # revisão da fonte; o módulo dono decide qual arquivo vale
        out["conflitos_entre_recursos"] = {"referencias": conflitos, "exemplos": exemplos_conflito[:2]}
    return out


def _etapas(grupo, an, chks, golds_res, brutos, seeds, documento, agora):
    """Etapas da escada com a evidência de cada uma em campos estruturados (o texto é
    montado na interface a partir deles; ver tipos-dados.ts). Toda etapa tem `ok`."""
    it = grupo[0]
    orgao, nome = it["orgao"], it["nome"]
    na_listagem = any(p.get("name") == nome for p in (brutos.get(orgao) or {}).get("resultado") or [])
    seed = next((p for p in seeds if p.get("name") == nome), None) if orgao == "CCEE" else None
    if na_listagem:
        cat = {"ok": True, "origem": "listagem", "em": (brutos.get(orgao) or {}).get("colhido_em")}
    elif seed is not None:
        cat = {"ok": True, "origem": "package_show", "em": seed["_seed"]["capturado_em"], "arquivo": seed["_seed"]["arquivo"]}
    else:
        decl = [g for g in grupo if g.get("url") and g.get("licenca")]
        cat = {"ok": bool(decl), "origem": "registro", "modulo": (decl or grupo)[0]["modulo"]}
    vs = (an or {}).get("vintages") or {}
    n = vs.get("n") or 0
    rec = {"ok": n > 0, "via": "captura", "em": vs.get("primeira_captura"), "capturas": n, "arquivos": vs.get("recursos") or 0}
    conteudo = bool((an or {}).get("observacoes")) or bool((an or {}).get("registros"))
    integ = _enxuto({"ok": n > 0 and (conteudo or documento), "em": vs.get("primeira_captura") if n else None,
                     "observacoes": ((an or {}).get("observacoes") or {}).get("linhas"),
                     "registros": ((an or {}).get("registros") or {}).get("chaves"),
                     "documento": True if (documento and not conteudo) else None})
    verd = val.veredito(chks)
    cont = Counter(x["resultado"] for x in chks)
    valid = {"ok": integ["ok"] and verd in ("aprovado", "ressalva"), "resultado": verd, "aprovadas": cont.get("aprovado", 0),
             "ressalvas": cont.get("ressalva", 0), "reprovadas": cont.get("reprovado", 0)}
    golds_decl = sorted({g for x in grupo for g in x["golds"]})
    citam = sorted(n_ for n_, r in golds_res.items() if it["dataset_silver"] in r["datasets_citados"])
    consumidoras = sorted(set(golds_decl) | set(citam))
    integras = []
    problemas = []
    for gname in consumidoras:
        if gname == GOLD:
            integras.append(gname)
            continue
        r = golds_res.get(gname)
        if not r:
            problemas.append(f"{gname} não está publicada")
        elif not r["disponivel"]:
            problemas.append(f"{gname} indisponível")
        elif r["veredito"] == "reprovado":
            reprov = [x["tipo"] for x in r["checagens"] if x["resultado"] == "reprovado"]
            problemas.append(f"{gname} reprovada em {', '.join(sorted(set(reprov)))}")
        else:
            integras.append(gname)
    paginas = [p for x in grupo for p in x.get("paginas", [])]
    publ = _enxuto({"ok": valid["ok"] and bool(integras) and (bool(paginas) or bool(set(citam) & set(integras))),
                    "golds": integras, "citado_por": sorted(set(citam) & set(integras)) or None, "problemas": problemas or None})
    return {"catalogado": cat, "recurso_verificado": rec, "integrado": integ, "validado": valid, "publicado": publ}, consumidoras


def conjuntos(grupos, analises, golds_res, brutos, seeds, metadados, hoje, agora):
    mods = catalogo.estados_modelos()
    out, checagens = [], []
    for (fam, ds), grupo in sorted(grupos.items()):
        it = grupo[0]
        an = analises.get((fam, ds))
        chave = f"{fam}/{ds}"
        documento = _documental(an)
        if an is None:
            chks = [val.checagem(f"conjunto:{chave}:capturas", chave, "capturas", "reprovado",
                                 f"Dataset {ds} declarado no REGISTRO, sem capturas no silver {fam}",
                                 criterio="toda captura com sha256 do arquivo original e instante UTC", verificados=0, problemas=1)]
        else:
            chks = val.valida_conjunto(chave, an, regra_horizonte=val.HORIZONTE_SILVER.get(ds), documento=documento)
        checagens.extend(chks)
        etapas, consumidoras = _etapas(grupo, an, chks, golds_res, brutos, seeds, documento, agora)
        estado = catalogo.estado_por_etapas(etapas)
        papeis = sorted({catalogo.papel(x.get("estado_declarado")) for x in grupo})
        descontinuado = any(x.get("descontinuado") for x in grupo) or "historico" in papeis
        pkg_desc = None
        for p in (brutos.get(it["orgao"]) or {}).get("resultado") or []:
            if p.get("name") == it["nome"]:
                pkg_desc = ck.descontinuacao(p)
        descontinuado = descontinuado or bool(pkg_desc)
        freq = _frequencia(it, brutos, seeds, metadados)
        atual = atualidade(an, freq, hoje, descontinuado)
        obs = (an or {}).get("observacoes") or {}
        gp = next((g for g in obs.get("grupos") or [] if g["formato"] == obs.get("principal")), None)
        ressalvas = [x["detalhe"] for x in chks if x["resultado"] == "ressalva"]
        ressalvas += catalogo.saltos(etapas)
        declarados = sorted({x.get("estado_declarado") for x in grupo if x.get("estado_declarado")})
        if any(d.startswith("UTILIZADO EM INDICADOR") for d in declarados) and estado != "PUBLICADO":
            ressalvas.append(f"O módulo declara uso em indicador, mas o estado calculado é {estado}.")
        if freq.get("ultimo_periodo_fonte") and gp and gp.get("ref_max_ate_hoje"):
            fonte_ult = freq["ultimo_periodo_fonte"]
            nosso = gp["ref_max_ate_hoje"].replace("-", "")[:len(fonte_ult)]
            if fonte_ult > nosso:
                ressalvas.append(f"A fonte informa período {fonte_ult} e o silver tem até {gp['ref_max_ate_hoje']}: integração defasada.")
        modelos = sorted({m for x in grupo for m in x.get("modelos", [])})
        rv = _resumo_revisao(an)
        br = (an or {}).get("bronze") or {}
        co = (an or {}).get("coletas") or {}
        vs = (an or {}).get("vintages") or {}
        cont = Counter(x["resultado"] for x in chks)
        slugs = sorted({x["slug"] for x in grupo if x.get("slug")})
        out.append({
            "id": chave, "familia": fam, "dataset_silver": ds, "orgao": it["orgao"], "nome": it["nome"],
            "catalogo_id": f"{it['orgao'].lower()}:{it['nome']}",
            "slug": next((x["slug"] for x in grupo if x.get("slug")), None),
            **({"slugs": slugs} if len(slugs) > 1 else {}),
            "titulo": next((x["titulo"] for x in grupo if x.get("titulo")), None) or _titulo_portal(brutos, seeds, it) or it["nome"],
            "modulos": sorted({x["modulo"] for x in grupo}), "golds": consumidoras,
            "paginas": [p for i_, x in enumerate(grupo) for p in x.get("paginas", []) if p not in
                        [q for y in grupo[:i_] for q in y.get("paginas", [])]],
            "estado": estado, "etapas": {k: _enxuto(v) for k, v in etapas.items()}, "ressalvas": ressalvas[:8],
            "uso": {"papeis": papeis, "declarado": declarados,
                    "modelos": [{"codigo": m, "estado": mods.get(m)} for m in modelos]},
            "descontinuado": descontinuado, "descontinuacao": pkg_desc,
            "frequencia": freq, "atualidade": atual,
            "dado": ({"granularidade": gp.get("granularidade"), "formato": gp["formato"], "ref_min": gp["ref_min"],
                      "ref_max": gp["ref_max"], "series": obs.get("series"), "linhas": obs.get("linhas"),
                      "completude_interna": gp.get("completude_interna"), "series_com_lacuna": gp.get("series_com_lacuna"),
                      "ultimo_periodo": gp.get("ultimo_periodo"), "series_no_ultimo": gp.get("series_no_ultimo"),
                      "periodo_anterior": gp.get("periodo_anterior"), "series_no_anterior": gp.get("series_no_anterior")}
                     if gp else ({"granularidade": "cadastro (sem período de referência)", "chaves": an["registros"]["chaves"],
                                  "preenchimento_minimo": an["registros"].get("preenchimento_minimo")}
                                 if an and an.get("registros") else None)),
            "capturas": {"vintages": vs.get("n", 0), "recursos": vs.get("recursos", 0),
                         "anteriores_preservadas": vs.get("recursos_com_anterior", 0), "primeira": vs.get("primeira_captura"),
                         "ultima": vs.get("ultima_captura"), "ultima_publicacao_fonte": vs.get("ultima_publicacao_fonte"),
                         "origens": vs.get("origens", {})},
            "coleta": {"tentativas": co.get("tentativas", 0), "falhas": co.get("falhas", 0),
                       "ultima_tentativa": co.get("ultima_tentativa"), "ultimo_ok": co.get("ultimo_ok"),
                       "ultima_falha": co.get("ultima_falha"), "falhas_consecutivas": co.get("falhas_consecutivas", 0)},
            "revisoes": rv,
            "bronze": ({"presentes": br.get("arquivos_presentes"), "ausentes": br.get("arquivos_ausentes"),
                        "sha256_conferidos": br.get("sha256_conferidos"), "sha256_divergentes": br.get("sha256_divergentes"),
                        "drift": br.get("drift_total"), "esquema_diferente_entre_recursos": br.get("recursos_com_esquema_diferente_total")}
                       if br else None),
            "validacao": {"resultado": val.veredito(chks), "aprovadas": cont.get("aprovado", 0),
                          "ressalvas": cont.get("ressalva", 0), "reprovadas": cont.get("reprovado", 0),
                          "itens": [{"tipo": x["tipo"], "resultado": x["resultado"], "detalhe": x["detalhe"]}
                                    for x in chks if x["resultado"] in ("ressalva", "reprovado")][:4]},
            "_an": an,
        })
    return out, checagens


def _titulo_portal(brutos, seeds, it):
    """Título do conjunto na listagem do portal (quando o REGISTRO não traz título)."""
    for p in ((brutos.get(it["orgao"]) or {}).get("resultado") or []) + (seeds if it["orgao"] == "CCEE" else []):
        if p.get("name") == it["nome"]:
            return p.get("title")
    return None


def publico(x):
    """Registro de um conjunto como publicado em publicacao.json: sem duplicar o que já
    está nas etapas (quantidade de capturas, arquivos, primeira captura, linhas e contagem
    de checagens) e sem chaves de valor None (ausente = não se aplica ou não informado).
    A versão completa de cada campo está em dados_conjuntos.csv."""
    vs, co, br = x["capturas"], x["coleta"], x["bronze"]
    # id = 'família/dataset do silver'; entrada do catálogo = '<órgão em minúsculas>:<nome>';
    # páginas e downloads estão na entrada do catálogo
    out = {k: x[k] for k in ("id", "orgao", "nome", "slug", "titulo", "modulos", "golds", "estado")}
    if x.get("slugs"):
        out["slugs"] = x["slugs"]
    # instantes repetidos saem: o da listagem está em catalogo.portais e o da integração
    # é a primeira captura (etapas.recurso_verificado.em)
    et = {k: dict(v) for k, v in x["etapas"].items()}
    if et["catalogado"].get("origem") == "listagem":
        et["catalogado"].pop("em", None)
    et["integrado"].pop("em", None)
    et["recurso_verificado"].pop("via", None)  # sempre captura com sha256 num conjunto integrado
    if et["publicado"].get("golds") == x["golds"]:
        et["publicado"].pop("golds")  # ausente = todas as golds do conjunto
    out["etapas"] = et
    # a ressalva que vem de checagem já está em validacao.itens
    ja = {i["detalhe"] for i in x["validacao"]["itens"]}
    out["ressalvas"] = [r for r in x["ressalvas"] if r not in ja]
    out["uso"] = _enxuto({"papeis": x["uso"]["papeis"], "modelos": x["uso"]["modelos"] or None})
    out["descontinuado"] = x["descontinuado"]
    if x.get("descontinuacao"):
        out["descontinuacao"] = x["descontinuacao"]
    # o nome do campo de onde a frequência foi lida fica em dados_conjuntos.csv
    out["frequencia"] = _enxuto({k: v for k, v in x["frequencia"].items()
                                 if not (k == "sem_sla" and v is False) and not (k == "campo" and x["frequencia"].get("origem") == "portal")})
    # a origem da cadência é a do caso (A a D), descrito em regras.sla_texto
    out["atualidade"] = _enxuto({k: v for k, v in x["atualidade"].items() if k != "origem_cadencia"})
    out["dado"] = _enxuto({k: v for k, v in (x["dado"] or {}).items() if k not in ("linhas", "chaves", "ultimo_periodo")}) or None
    out["capturas"] = _enxuto({"ultima": vs.get("ultima"), "ultima_publicacao_fonte": vs.get("ultima_publicacao_fonte"),
                               "anteriores_preservadas": vs.get("anteriores_preservadas") or None,
                               "origens": vs.get("origens") if set(vs.get("origens") or {}) - {"coleta_direta"} else None})
    out["coleta"] = _enxuto({"tentativas": co["tentativas"], "falhas": co["falhas"], "ultimo_ok": co.get("ultimo_ok"),
                             "ultima_falha": co.get("ultima_falha"), "falhas_consecutivas": co["falhas_consecutivas"]})
    out["revisoes"] = x["revisoes"]
    out["bronze"] = (_enxuto({"presentes": br.get("presentes"), "ausentes": br.get("ausentes") or None,
                              "sha256_conferidos": br.get("sha256_conferidos"), "sha256_divergentes": br.get("sha256_divergentes") or None,
                              "drift": br.get("drift") or None, "esquema_diferente_entre_recursos": br.get("esquema_diferente_entre_recursos") or None})
                     if br else None)
    # resultado e contagens em etapas.validado; aqui os itens que pedem atenção
    if x["validacao"]["itens"]:
        out["validacao"] = {"itens": x["validacao"]["itens"]}
    return out


# ---------------------------------------------------------------- calendário, eixos, afirmações


def calendario(lista, hoje):
    """Por dia (UTC) e por conjunto: capturas novas, recapturas sem mudança, falhas,
    referências revisadas e arquivos publicados pela fonte naquele dia."""
    inicio = (hoje - timedelta(days=JANELA_CALENDARIO_DIAS)).isoformat()
    linhas = []
    total = defaultdict(lambda: Counter())
    for x in lista:
        an = x["_an"]
        if not an:
            continue
        dias = defaultdict(Counter)
        for v in an["_vintages"]:
            dias[v["capturado_em"][:10]]["capturas_novas"] += 1
            if v.get("publicado_em"):
                dias[str(v["publicado_em"])[:10]]["publicacoes_fonte"] += 1
        for dia, (ok, falhas) in (an.get("coletas_por_dia") or {}).items():
            dias[dia]["falhas"] += falhas
            dias[dia]["_ok"] += ok
        for dia, n in ((an.get("revisoes") or {}).get("por_captura") or {}).items():
            dias[dia]["referencias_revisadas"] += n
        for dia, cnt in dias.items():
            if dia < inicio or dia > hoje.isoformat():
                continue
            rec = max(0, cnt["_ok"] - cnt["capturas_novas"])
            row = {"dia": dia, "familia": x["familia"], "dataset": x["dataset_silver"], "capturas_novas": cnt["capturas_novas"],
                   "recapturas_sem_mudanca": rec, "falhas": cnt["falhas"], "referencias_revisadas": cnt["referencias_revisadas"],
                   "publicacoes_fonte": cnt["publicacoes_fonte"]}
            linhas.append(row)
            t = total[dia]
            for k in ("capturas_novas", "recapturas_sem_mudanca", "falhas", "referencias_revisadas", "publicacoes_fonte"):
                t[k] += row[k]
            t["conjuntos_com_evento"] += 1
    agregado = [{"dia": d, **{k: total[d][k] for k in ("capturas_novas", "recapturas_sem_mudanca", "falhas",
                                                       "referencias_revisadas", "publicacoes_fonte", "conjuntos_com_evento")}}
                for d in sorted(total)]
    linhas.sort(key=lambda r: (r["dia"], r["familia"], r["dataset"]))
    return agregado, linhas


def _evidencias(o, out=None):
    out = [] if out is None else out
    if isinstance(o, dict):
        if "valor_exibido" in o and "testes" in o and "fonte" in o:
            out.append(o)
        for v in o.values():
            _evidencias(v, out)
    elif isinstance(o, list):
        for v in o:
            _evidencias(v, out)
    return out


def _eh_proveniencia(o):
    return isinstance(o, dict) and "natureza" in o and "fonte" in o and "limitacoes" in o


def fichas_com_proveniencia(o, ctx=None, out=None):
    """[(ficha, proveniência mais próxima)] de uma gold: a proveniência irmã da ficha no
    mesmo objeto (chave proveniencia ou objeto com natureza, fonte e limitações) ou a do
    objeto que a contém, subindo na árvore. É o vínculo que a própria gold faz entre o
    número e a série de onde ele vem."""
    out = [] if out is None else out
    if isinstance(o, dict):
        if "valor_exibido" in o and "testes" in o and "fonte" in o:
            out.append((o, ctx))
        local = next((v for v in o.values() if _eh_proveniencia(v)), None)
        if _eh_proveniencia(o):
            local = o
        prox = local or ctx
        for v in o.values():
            fichas_com_proveniencia(v, prox, out)
    elif isinstance(o, list):
        for v in o:
            fichas_com_proveniencia(v, ctx, out)
    return out


def situacao_validacao(e):
    """Situação da validação de uma ficha (seção 11.3), separada da natureza."""
    rec = e.get("reconciliacao") if isinstance(e.get("reconciliacao"), dict) else None
    testes = [t for t in (e.get("testes") or []) if isinstance(t, dict)]
    rs = Counter(t.get("resultado") for t in testes)
    if (rec and rec.get("resultado") == "reprovado") or rs.get("reprovado"):
        return "divergencia"
    if (rec and rec.get("resultado") == "ressalva") or rs.get("ressalva"):
        return "ressalva"
    if rec and rec.get("resultado") == "aprovado":
        return "reconciliacao_aprovada"
    if testes and all(t.get("resultado") == "aprovado" for t in testes):
        return "controles_aprovados"
    return "pendencia"


def eixos(golds_res):
    linhas = []
    matriz = defaultdict(Counter)
    por_gold = {}
    for nome, r in sorted(golds_res.items()):
        g = r["_gold"]
        if not isinstance(g, dict):
            continue
        provs = val.proveniencias(g)
        nat = Counter(p.get("natureza") for p in provs)
        por_indicador = {p.get("indicador"): p.get("natureza") for p in provs}
        sits = Counter()
        # mesma chave em g["evidencias"] e g["proveniencia"]: a gold liga a ficha à série
        por_chave = {}
        if isinstance(g.get("evidencias"), dict) and isinstance(g.get("proveniencia"), dict):
            for k, e_ in g["evidencias"].items():
                p_ = g["proveniencia"].get(k)
                if isinstance(e_, dict) and _eh_proveniencia(p_):
                    por_chave[id(e_)] = p_.get("natureza")
        for e, prov in fichas_com_proveniencia(g):
            s = situacao_validacao(e)
            sits[s] += 1
            natureza = (e.get("natureza") if e.get("natureza") in NATUREZAS else None) or por_chave.get(id(e)) \
                or por_indicador.get(e.get("indicador")) or (prov or {}).get("natureza")
            matriz[natureza or "SEM_VINCULO"][s] += 1
            rs = Counter(t.get("resultado") for t in (e.get("testes") or []) if isinstance(t, dict))
            linhas.append({"gold": nome, "indicador": e.get("indicador"), "natureza": natureza, "situacao_validacao": s,
                           "reconciliacao": (e.get("reconciliacao") or {}).get("resultado") if isinstance(e.get("reconciliacao"), dict) else None,
                           "testes_aprovados": rs.get("aprovado", 0), "testes_ressalva": rs.get("ressalva", 0),
                           "testes_reprovados": rs.get("reprovado", 0)})
        if provs or sits:
            por_gold[nome] = {"naturezas": dict(nat), "situacoes": dict(sits), "fichas": sum(sits.values()), "proveniencias": len(provs)}
    return {"naturezas": NATUREZAS, "situacoes": SITUACOES_VALIDACAO,
            "matriz": {k: dict(v) for k, v in sorted(matriz.items(), key=lambda kv: str(kv[0]))},
            "por_gold": por_gold, "fichas": len(linhas),
            "fichas_sem_natureza_vinculada": sum(1 for x in linhas if not x["natureza"]),
            "regra_vinculo": ("A natureza de uma ficha é a declarada na própria ficha (campo natureza), a da proveniência de mesma chave "
                              "em evidencias e proveniencia, a da proveniência de mesmo indicador na mesma gold, ou a da proveniência "
                              "mais próxima na estrutura da gold (no mesmo objeto da ficha ou num objeto que a contém); sem nenhuma, "
                              "SEM_VINCULO: a gold não liga a ficha à série, e a situação da validação é publicada sem a natureza.")}, linhas


def afirmacoes(cat, golds_res):
    """Texto de cada afirmação de integração que a Metodologia faz, gerado do estado real."""
    por_id = {e["id"]: e for e in cat["entradas"]}
    out = []
    for a in AFIRMACOES:
        if a["conjuntos"] == "CCEE_INTEGRADOS":
            ids = sorted(e["id"] for e in cat["entradas"] if e["orgao"] == "CCEE" and e["estado"] not in ("CATALOGADO", "RECURSO VERIFICADO")
                         and e["id"] not in ("ccee:pld_horario", "ccee:api-package-search", "ccee:package-show-versionados"))
        else:
            ids = a["conjuntos"]
        ents = [por_id[i] for i in ids if i in por_id]
        estados = [e["estado"] for e in ents]
        item = {"id": a["id"], "tema": a["tema"], "conjuntos": [{"id": e["id"], "estado": e["estado"], "titulo": e.get("titulo"),
                                                                    "paginas": e.get("paginas") or []} for e in ents],
                "ausentes_no_catalogo": [i for i in ids if i not in por_id]}
        if a.get("gold_achado"):
            gname, achado = a["gold_achado"]
            g = (golds_res.get(gname) or {}).get("_gold") or {}
            ac = ((g.get("achados") or {}).get(achado) or {}) if isinstance(g, dict) else {}
            item["achado"] = ({"id": achado, "gold": gname, "status": ac.get("status"), "conclusao": ac.get("conclusao"),
                               "correcao_metodologia": ac.get("correcao_metodologia")} if ac else None)
        if not ents:
            texto = f"{a['tema']}: nenhum conjunto correspondente no catálogo desta publicação."
        elif all(s == "PUBLICADO" for s in estados):
            texto = (f"{a['tema']}: integrado, validado e publicado ({', '.join(e['id'] for e in ents)})." if len(ents) <= 4 else
                     f"{a['tema']}: {len(ents)} conjuntos integrados, validados e publicados.")
        elif len(ents) > 4:
            cont = Counter(estados)
            texto = f"{a['tema']}: {len(ents)} conjuntos; " + ", ".join(f"{n} {s_.lower()}" for s_, n in sorted(
                cont.items(), key=lambda kv: -catalogo.ESTADOS.index(kv[0]))) + "."
        else:
            partes = [f"{e['id']} está {e['estado'].lower()}" for e in ents]
            texto = f"{a['tema']}: " + "; ".join(partes) + "."
        bloqueado = bool(item.get("achado") and "bloquead" in str(item["achado"].get("status") or "").lower())
        if a.get("texto_bloqueado") and bloqueado:
            docs = [e for e in ents if e["estado"] != "CATALOGADO"]
            texto = a["texto_bloqueado"] + (" Integrados, só para citação: " + "; ".join(f"{e.get('titulo')} ({e['id']}, "
                                                                                       f"{e['estado'].lower()})" for e in docs) + "."
                                            if docs else "")
        if a.get("afirmacao_anterior"):
            item["afirmacao_anterior"] = a["afirmacao_anterior"]
        if item.get("achado") and item["achado"].get("conclusao"):
            texto += f" Achado {item['achado']['id']} ({item['achado']['status']}): {item['achado']['conclusao']}"
            if item["achado"].get("correcao_metodologia"):
                item["correcao_metodologia"] = item["achado"]["correcao_metodologia"]
        item["texto"] = texto
        out.append(item)
    return out


# ---------------------------------------------------------------- CSV de download


def _csv(nome, cabecalho, linhas):
    base.escreve_csv(nome, cabecalho, linhas)


def escreve_csvs(lista, todas_checagens, cal_linhas, cat, eixos_linhas, descricoes=None):
    _csv(CSV["conjuntos"], [
        "id", "familia", "dataset", "orgao", "conjunto", "slug", "modulos", "estado", "papeis", "golds", "frequencia_declarada",
        "campo_frequencia", "caso_sla",
        "cadencia_sla", "granularidade", "ref_min", "ultimo_periodo", "prazo_proximo", "situacao", "dias_atraso", "capturas",
        "primeira_captura", "ultima_captura", "ultima_publicacao_fonte", "tentativas", "falhas", "ultima_falha_em",
        "falhas_consecutivas", "series", "linhas", "completude_interna", "series_no_ultimo", "series_no_anterior",
        "revisoes_eventos", "revisoes_referencias", "revisoes_series", "revisao_ref_min", "revisao_ref_max", "maior_revisao_abs",
        "maior_revisao_rel_pct", "validacao", "checagens_aprovadas", "checagens_ressalva", "checagens_reprovadas",
        "originais_ausentes", "sha256_divergentes"], [
        [x["id"], x["familia"], x["dataset_silver"], x["orgao"], x["nome"], x["slug"], "|".join(x["modulos"]), x["estado"],
         "|".join(x["uso"]["papeis"]), "|".join(x["golds"]), _limpa(x["frequencia"].get("declarada")),
         _limpa(x["frequencia"].get("campo")), x["atualidade"].get("caso"), x["atualidade"]["cadencia"],
         (x["dado"] or {}).get("granularidade"), (x["dado"] or {}).get("ref_min"), x["atualidade"]["ultimo_periodo"],
         x["atualidade"]["prazo_proximo"], x["atualidade"]["situacao"], x["atualidade"]["dias_atraso"],
         x["capturas"]["vintages"], x["capturas"]["primeira"], x["capturas"]["ultima"], x["capturas"]["ultima_publicacao_fonte"],
         x["coleta"]["tentativas"], x["coleta"]["falhas"], (x["coleta"]["ultima_falha"] or {}).get("tentado_em"),
         x["coleta"]["falhas_consecutivas"], (x["dado"] or {}).get("series"), (x["dado"] or {}).get("linhas"),
         (x["dado"] or {}).get("completude_interna"), (x["dado"] or {}).get("series_no_ultimo"),
         (x["dado"] or {}).get("series_no_anterior"), (x["revisoes"] or {}).get("eventos"), (x["revisoes"] or {}).get("referencias"),
         (x["revisoes"] or {}).get("series"), (x["revisoes"] or {}).get("ref_min"), (x["revisoes"] or {}).get("ref_max"),
         ((x["revisoes"] or {}).get("maior_abs") or {}).get("diferenca"), ((x["revisoes"] or {}).get("maior_rel") or {}).get("relativa_pct"),
         x["validacao"]["resultado"], x["validacao"]["aprovadas"], x["validacao"]["ressalvas"], x["validacao"]["reprovadas"],
         (x["bronze"] or {}).get("ausentes"), (x["bronze"] or {}).get("sha256_divergentes")] for x in lista])
    _csv(CSV["validacoes"], ["id", "alvo", "tipo", "resultado", "detalhe", "criterio", "verificados", "problemas", "exemplos"],
         [[k["id"], k["alvo"], k["tipo"], k["resultado"], _limpa(k["detalhe"]), _limpa(k["criterio"]), k["verificados"],
           k["problemas"], json.dumps(k["exemplos"], ensure_ascii=False, separators=(",", ":"), default=str).replace(";", ",") if k["exemplos"] else None]
          for k in todas_checagens])
    rev = []
    for x in lista:
        for e in ((x["_an"] or {}).get("revisoes") or {}).get("maiores", []):
            rev.append([x["familia"], x["dataset_silver"], _limpa(e["serie"]), _limpa(e["ref"]), e["de"], e["para"], e["delta"],
                        100 * e["relativa"] if e["relativa"] is not None else None, e["capturado_de"], e["capturado_para"], e["recurso"]])
    _csv(CSV["revisoes"], ["familia", "dataset", "serie", "ref", "valor_anterior", "valor_novo", "diferenca",
                           "diferenca_relativa_pct", "capturado_anterior", "capturado_novo", "recurso"], rev)
    _csv(CSV["calendario"], ["dia", "familia", "dataset", "capturas_novas", "recapturas_sem_mudanca", "falhas",
                             "referencias_revisadas", "publicacoes_fonte"],
         [[r["dia"], r["familia"], r["dataset"], r["capturas_novas"], r["recapturas_sem_mudanca"], r["falhas"],
           r["referencias_revisadas"], r["publicacoes_fonte"]] for r in cal_linhas])
    _csv(CSV["catalogo"], ["id", "orgao", "nome", "titulo", "estado", "papeis", "descontinuado", "motivo_descontinuacao",
                           "frequencia_declarada", "recurso_verificado_em", "integracoes", "golds", "recursos", "recursos_acessados",
                           "recursos_integrados", "recursos_removidos", "url", "licenca", "metadados_verificados", "descricao"],
         [[e["id"], e["orgao"], e.get("nome") or e["id"].split(":", 1)[1], _limpa(e.get("titulo")), e["estado"], "|".join(e.get("papeis") or []),
           1 if e.get("descontinuado") else 0, _limpa(((e.get("descontinuacao") or {}).get("motivo"))), _limpa(e.get("frequencia_declarada")),
           _verificado_em(e),
           "|".join(i.get("id") or "" for i in e.get("integracoes") or []),
           "|".join(e.get("usado_em") or []), (e.get("recursos_resumo") or {}).get("total"),
           (e.get("recursos_resumo") or {}).get("acessados"),
           sum(((e.get("recursos_resumo") or {}).get("por_estado") or {}).get(k, 0) for k in ("INTEGRADO", "VALIDADO", "PUBLICADO"))
           if e.get("recursos_resumo") else None,
           (e.get("recursos_resumo") or {}).get("removidos"),
           e.get("url") or ((cat["portais"].get(e["orgao"]) or {}).get("url_conjunto") or "") + e["id"].split(":", 1)[1],
           _limpa(e.get("licenca") or (cat["portais"].get(e["orgao"]) or {}).get("licenca")),
           1 if e.get("metadados_verificados") else 0, _limpa((descricoes or {}).get(e["id"]) or e.get("descricao"))]
          for e in cat["entradas"]])
    _csv(CSV["eixos"], ["gold", "indicador", "natureza", "situacao_validacao", "reconciliacao", "testes_aprovados",
                        "testes_ressalva", "testes_reprovados"],
         [[r["gold"], _limpa(r["indicador"]), r["natureza"], r["situacao_validacao"], r["reconciliacao"], r["testes_aprovados"],
           r["testes_ressalva"], r["testes_reprovados"]] for r in eixos_linhas])


def _verificado_em(e):
    """Instante em que um arquivo do conjunto foi acessado (etapa ou verificação parcial)."""
    rv = (e.get("etapas") or {}).get("recurso_verificado") or {}
    if rv.get("ok"):
        return rv.get("em")
    v = e.get("verificacao") or {}
    return v.get("em") if v and v.get("ok", True) else None


def _descricoes(brutos, seeds):
    """{id do catálogo: descrição completa da fonte} (o catálogo JSON leva só o início)."""
    out = {}
    for orgao in ("ONS", "ANEEL", "CCEE"):
        for p in ((brutos.get(orgao) or {}).get("resultado") or []) + (seeds if orgao == "CCEE" else []):
            notas = " ".join(str(p.get("notes") or "").split("-----")[0].split())
            out.setdefault(f"{orgao.lower()}:{p.get('name')}", notas)
    for it in catalogo.integracoes():
        out.setdefault(f"{it['orgao'].lower()}:{it['nome']}", " ".join(str(it.get("descricao") or "").split()))
    return out


def escreve_csv_recursos(recursos):
    """dados_recursos_<orgao>.csv: o catálogo recurso a recurso de cada portal."""
    por_orgao = defaultdict(list)
    for x in recursos:
        por_orgao[x["orgao"]].append(x)
    for o in PORTAIS_RECURSOS:
        linhas = sorted(por_orgao.get(o, []), key=lambda x: (x["conjunto"] or "", x["recurso"] or "", x["recurso_id"] or ""))
        _csv(CSV[f"recursos_{o.lower()}"], ["orgao", "conjunto", "recurso_id", "recurso", "formato", "publicado_em", "tamanho",
                                             "presente", "estado", "via", "capturas", "ultima_captura", "datasets_silver",
                                             "verificado_em", "url"],
             [[x["orgao"], _limpa(x["conjunto"]), x["recurso_id"], _limpa(x["recurso"]), x["formato"], x["publicado_em"],
               x["tamanho"] if str(x.get("tamanho") or "").isdigit() else None, 1 if x["presente"] else 0, x["estado"],
               _limpa(x["via"]), x["capturas"], x["ultima_captura"], "|".join(x["datasets_silver"]) or None,
               x["verificado_em"], _limpa(x["url"])] for x in linhas])


def _limpa(t):
    """Texto livre dentro do CSV com ';': o separador e a quebra de linha viram vírgula e espaço."""
    if t is None:
        return None
    return str(t).replace(";", ",").replace("\r", " ").replace("\n", " ")


# ---------------------------------------------------------------- manifesto


def escreve_manifesto(final=False, publicacao_bytes=None):
    """Manifesto da publicação. Chamado no fim de construir() (sem os arquivos que o
    orquestrador reescreve depois, listados em fora_do_manifesto) e, quando o
    orquestrador o chamar no fim da execução, com final=True e todos os arquivos."""
    excluir = {f"/energia/gold/{MANIFESTO}"}
    if not final:
        excluir |= {f"/energia/gold/{n}" for n in POSTERIORES}
    dic = dicionario_arquivos()
    for url in REGISTRO["arquivos"]:
        dic[url] = REGISTRO["arquivos"][url]
    parquets = {}
    for nome in os.listdir(base.SERIES):
        if nome.endswith(".parquet"):
            parquets["/energia/series/" + nome[:-8] + ".csv"] = "/energia/series/" + nome
    itens = []
    for rel in pub.lista_publicados(excluir=excluir):
        conteudo = publicacao_bytes if (rel == f"energia/gold/{GOLD}" and publicacao_bytes is not None) else None
        itens.append(pub.item_manifesto(rel, conteudo=conteudo, dicionario=dic, parquets=parquets))
    if publicacao_bytes is not None and not any(i["caminho"] == f"/energia/gold/{GOLD}" for i in itens):
        itens.append(pub.item_manifesto(f"energia/gold/{GOLD}", conteudo=publicacao_bytes, dicionario=dic, parquets=parquets))
        itens.sort(key=lambda i: i["caminho"])
    ident = pub.id_publicacao(itens)
    tipos = Counter(i["tipo"] for i in itens)
    m = {
        **c.cabecalho(MANIFESTO),
        "id_publicacao": ident,
        "regra_id": ("sha256 da lista JSON [caminho, bytes, sha256] de todos os arquivos listados, em ordem de caminho "
                     "(separadores sem espaço, UTF-8): o mesmo conjunto de bytes tem o mesmo id."),
        "completo": final,
        "fora_do_manifesto": ([] if final else [
            {"caminho": f"/energia/gold/{n}", "motivo": ("Reescrito pelo orquestrador depois do módulo dados (gerado_em novo): o sha256 "
                                                         "calculado aqui não seria o publicado. Entra quando o orquestrador chamar "
                                                         "escreve_manifesto(final=True) no fim da execução.")} for n in POSTERIORES]),
        "repositorio": pub.REPOSITORIO,
        "totais": {"arquivos": len(itens), "bytes": sum(i["bytes"] for i in itens), **{f"{k}s": v for k, v in tipos.items()}},
        "arquivos": itens,
    }
    base.escreve_gold(MANIFESTO, m)
    return m


# ---------------------------------------------------------------- proveniência e evidência


def _snapshot_silvers(lista):
    import hashlib
    partes = sorted(f"{x['id']}:{v['recurso']}:{v['sha256']}" for x in lista if x["_an"]
                    for v in _vigentes(x["_an"]["_vintages"]))
    caps = sorted(x["capturas"]["ultima"] for x in lista if x["capturas"]["ultima"])
    return {"id": f"silvers@{caps[-1] if caps else 'sem-captura'}", "sha256": hashlib.sha256("\n".join(partes).encode()).hexdigest()}


def _vigentes(vs):
    ult = {}
    for v in vs:
        if v["recurso"] not in ult or v["capturado_em"] > ult[v["recurso"]]["capturado_em"]:
            ult[v["recurso"]] = v
    return list(ult.values())


def _max_ref_direto(familia, dataset, formato, hoje):
    """Maior referência até hoje lida por consulta direta ao silver (conferência do
    último período publicado, por caminho diferente da análise de completude)."""
    con = sd.abre(familia)
    if con is None:
        return None
    try:
        lim = sd.limite_hoje(formato, hoje)
        glob = sd.GLOB_FORMATO.get(formato)
        if not lim or not glob:
            return None
        return con.execute("SELECT MAX(ref) FROM observacoes WHERE dataset=? AND ref <= ? AND ref GLOB ?",
                           (dataset, lim, glob)).fetchone()[0]
    finally:
        con.close()


def _valor_nas_vintages(familia, dataset, serie, ref, vintage_ids):
    """Valores de uma (série, referência) gravados em cada vintage, na ordem da captura."""
    con = sd.abre(familia)
    if con is None or not vintage_ids:
        return []
    try:
        marcas = ",".join("?" * len(vintage_ids))
        return [v for (v,) in con.execute(
            f"""SELECT o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
                WHERE o.dataset=? AND o.serie=? AND o.ref=? AND o.vintage_id IN ({marcas}) ORDER BY v.capturado_em""",
            (dataset, serie, ref, *vintage_ids))]
    finally:
        con.close()


def _fonte_catalogo(con):
    return [v for v in (base.ultima_vintage(con, ck.CATALOGOS[o]["dataset"], "package_search") for o in ("ONS", "ANEEL", "CCEE")) if v]


def proveniencias(con, lista, cat, hoje, agora):
    snap_ons = c.snapshot_de(con, ck.CATALOGOS["ONS"]["dataset"])
    snap_sil = _snapshot_silvers(lista)
    caps = [x["capturas"]["ultima"] for x in lista if x["capturas"]["ultima"]]
    ini = min((x["capturas"]["primeira"] for x in lista if x["capturas"]["primeira"]), default=None)
    fonte_portais = {"orgao": "ONS, ANEEL e CCEE", "dataset": "Listagem de conjuntos dos portais de dados abertos (API CKAN package_search)",
                     "recurso": "package_search?rows=1000", "url_dataset": ck.CATALOGOS["ONS"]["url"],
                     "url_primaria": ck.CATALOGOS["ANEEL"]["url"],
                     "urls": [ck.CATALOGOS[o]["url"] for o in ("ONS", "ANEEL", "CCEE")],
                     "licenca": f"{c.LICENCA_ONS}; ANEEL: Open Data Commons Open Database License (ODbL); {c.LICENCA_CCEE}"}
    fonte_silver = {"orgao": "Scrutiniums (pipeline do observatório)", "dataset": "Silvers e golds do domínio Energia",
                    "recurso": "data/energia/silver/*.db e public/energia/gold/*.json",
                    "url_dataset": "https://github.com/genarolins1975/scrutiniums/tree/main/pipeline/energia",
                    "url_primaria": "https://github.com/genarolins1975/scrutiniums/tree/main/public/energia", "licenca": LICENCA_PROPRIA}
    snap_cat = snap_ons if snap_ons.get("id") else snap_sil
    return {
        "catalogo": c.proveniencia(
            indicador="Estado de cada conjunto no catálogo (catalogado, recurso verificado, integrado, validado, publicado)",
            natureza="CALCULADO", fonte=fonte_portais, unidade="conjuntos", frequencia="a cada execução do pipeline",
            periodo={"inicio": hoje.isoformat(), "fim": hoje.isoformat()}, cobertura={"inicio": hoje.isoformat(), "fim": hoje.isoformat()},
            capturado_em=snap_cat.get("capturas", [{}])[-1].get("capturado_em") if snap_cat.get("capturas") else max(caps, default=agora),
            snapshot=snap_cat,
            formula="estado = última etapa alcançada em sequência; cada etapa exige a evidência descrita em criterios_estado",
            transformacoes=["listagem CKAN versionada com sha256", "verificação parcial de recursos (Range 64 KB)",
                            "estado recurso a recurso pelas capturas registradas nos silvers",
                            "etapas por integração calculadas dos silvers e do relatório de validação"],
            limitacoes=["O portal da CCEE recusa (HTTP 403, página 'Acesso bloqueado') pedidos feitos com curl e respondeu ao cliente do "
                        "pipeline, com o User-Agent do projeto; quando recusa também o pipeline, o catálogo da CCEE volta aos package_show "
                        "versionados no repositório, que cobrem só os conjuntos guardados lá.",
                        "Recurso verificado lê só os primeiros 64 KB de um arquivo por conjunto; não atesta o arquivo inteiro.",
                        "Entradas manuais (EPE, MME, ANA, INMET, B3, ANP, IBGE) têm metadados não verificados na fonte."],
            download=U["catalogo"], validado_em=agora),
        "saude": c.proveniencia(
            indicador="Atualidade, completude, capturas e falhas por conjunto integrado", natureza="CALCULADO",
            fonte=fonte_silver, unidade="por conjunto", frequencia="a cada execução do pipeline",
            periodo={"inicio": ini[:10] if ini else hoje.isoformat(), "fim": hoje.isoformat()},
            cobertura={"inicio": ini[:10] if ini else hoje.isoformat(), "fim": hoje.isoformat()},
            capturado_em=max(caps, default=agora), snapshot=snap_sil, publicado_em=None, revisoes={"total": 0, "detectado_em": agora, "exemplos": []},
            formula=("situação = EM DIA se hoje ≤ fim do período seguinte ao último disponível + tolerância da cadência declarada "
                     "(diária 2, semanal 7, quinzenal 15, mensal 60, trimestral 90, anual 365 dias); completude interna = referências "
                     "presentes ÷ esperadas entre a primeira e a última de cada série, no passo modal"),
            transformacoes=["leitura somente leitura dos silvers", "agregação por conjunto"],
            limitacoes=["A frequência só é usada quando declarada em metadado legível da fonte; sem ela o SLA não é aplicado.",
                        "Os silvers deste ambiente foram reconstruídos em 29 e 30/09/2026: o histórico de capturas e revisões começa aí.",
                        "Completude interna não acusa série que começa depois ou termina antes; só lacunas entre a primeira e a última referência."],
            download=U["conjuntos"], validado_em=agora),
        "revisoes": c.proveniencia(
            indicador="Revisões da fonte entre capturas: alcance e magnitude", natureza="CALCULADO", fonte=fonte_silver,
            unidade="unidade de cada série (diferença absoluta) e % (diferença relativa)", frequencia="a cada execução do pipeline",
            periodo={"inicio": ini[:10] if ini else hoje.isoformat(), "fim": hoje.isoformat()},
            cobertura={"inicio": ini[:10] if ini else hoje.isoformat(), "fim": hoje.isoformat()},
            capturado_em=max(caps, default=agora), snapshot=snap_sil, publicado_em=None,
            revisoes={"total": sum(((x["revisoes"] or {}).get("referencias") or 0) for x in lista), "detectado_em": agora, "exemplos": []},
            formula="revisão = troca de valor de uma mesma (série, referência) entre capturas consecutivas; relativa = |novo − anterior| ÷ |anterior|",
            transformacoes=["comparação das vintages no silver (append only)"],
            limitacoes=["Só há revisão detectável a partir da segunda captura de um mesmo arquivo.",
                        "A diferença absoluta está na unidade da série e só se compara dentro da mesma série.",
                        "Mudança a partir de zero não tem diferença relativa e é contada à parte."],
            download=U["revisoes"], validado_em=agora),
        "validacao": c.proveniencia(
            indicador="Resultado das validações automáticas da publicação", natureza="CALCULADO", fonte=fonte_silver,
            unidade="checagens", frequencia="a cada execução do pipeline", periodo={"inicio": hoje.isoformat(), "fim": hoje.isoformat()},
            cobertura={"inicio": hoje.isoformat(), "fim": hoje.isoformat()}, capturado_em=max(caps, default=agora), snapshot=snap_sil,
            publicado_em=None, revisoes={"total": 0, "detectado_em": agora, "exemplos": []},
            formula="veredito = pior resultado entre as checagens aplicáveis (reprovado > ressalva > aprovado)",
            transformacoes=["pipeline/energia/validacoes.py sobre todas as golds, CSV e conjuntos"],
            limitacoes=["A chave única dos CSV é inferida pelo nome e pelo tipo das colunas; ressalva de chave pede conferência humana.",
                        "Identidades de agregação são as declaradas em validacoes.IDENTIDADES; arquivo sem identidade declarada não é testado nesse eixo."],
            download=U["validacoes"], validado_em=agora),
    }


def _evidencia_kpis(con, lista, cat, agora, hoje, todas=(), golds_res=None):
    """Fichas 'Comprove este número' dos números principais da página. Cada teste
    confere o número por um caminho diferente do que o calculou (relatório de
    checagens, golds publicadas, vintages do silver), não repete a fórmula."""
    fichas = {}
    golds_res = golds_res or {}
    vint = _fonte_catalogo(con)
    versao = {"pipeline": base.VERSAO_PIPELINE, "codigo": base.versao_codigo(), "publicacao": agora}
    reprovados_por_alvo = Counter(k["alvo"] for k in todas if k["resultado"] == "reprovado")
    if vint:
        pubs = [e for e in cat["entradas"] if e["estado"] == "PUBLICADO"]
        n_pub = len(pubs)
        # caminho independente: para cada publicado, (a) nenhuma checagem reprovada no
        # relatório para os seus conjuntos do silver e (b) alguma gold que o consome
        # está íntegra na varredura das golds
        sem_reprov = sum(1 for e in pubs if not any(reprovados_por_alvo.get(i_.get("id")) for i_ in e.get("integracoes") or []))
        golds_por_conj = {x["id"]: x["golds"] for x in lista}
        com_gold = sum(1 for e in pubs if any(g == GOLD or ((golds_res.get(g) or {}).get("disponivel")
                                                            and (golds_res.get(g) or {}).get("veredito") != "reprovado")
                                              for i_ in e.get("integracoes") or [] for g in golds_por_conj.get(i_.get("id"), [])))
        fonte = {"orgao": "ONS, ANEEL e CCEE", "conjunto": "Listagem de conjuntos (API CKAN package_search)", "recurso": "package_search",
                 "url": ck.CATALOGOS["ONS"]["url"], "arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None,
                 "arquivos": [ev.arquivo_de_vintage(v) for v in vint]}
        fichas["conjuntos_publicados"] = ev.construir(
            indicador="Conjuntos publicados no catálogo", valor_exibido=f"{n_pub}", valor_calculo=float(n_pub), unidade="conjuntos",
            periodo={"inicio": hoje.isoformat(), "fim": hoje.isoformat()}, entidade="catálogo do observatório",
            universo=f"{cat['total']} conjuntos catalogados", fonte=fonte,
            consulta="entradas de catalogo.json com estado = PUBLICADO",
            formula="contagem de conjuntos cuja escada catalogado → publicado chega ao fim com evidência em cada etapa",
            cobertura=(f"{cat['total']} entradas: listagens do ONS, da ANEEL e da CCEE, package_show versionados da CCEE, REGISTRO "
                       "dos módulos e cadastro manual"),
            tratamento_ausencia="conjunto sem evidência de uma etapa para na etapa anterior",
            testes=[ev.teste("sem checagem reprovada no relatório", "aprovado" if sem_reprov == n_pub else "reprovado",
                             f"{sem_reprov} de {n_pub} publicados sem checagem reprovada nos seus conjuntos (dados_validacoes.csv)"),
                    ev.teste("consumido por gold íntegra", "aprovado" if com_gold == n_pub else "reprovado",
                             f"{com_gold} de {n_pub} publicados com gold consumidora íntegra na varredura das golds")],
            download=[{"rotulo": "Catálogo (CSV)", "url": U["catalogo"]}, {"rotulo": "Validações (CSV)", "url": U["validacoes"]}],
            reproducao="python3 pipeline/energia/executar_modulo.py dados --sem-coleta", versao=versao)
    atrasados = [x for x in lista if x["atualidade"]["situacao"] == "ATRASADO"]
    com_sla = [x for x in lista if x["atualidade"]["situacao"] in ("EM DIA", "ATRASADO")]
    if lista:
        # caminho independente: o prazo publicado é refeito com a data de hoje e o último
        # período lido de novo do silver, e a falha de coleta não pode ter mudado o período
        incoerentes = [x["id"] for x in atrasados if not x["atualidade"].get("prazo_proximo")
                       or date.fromisoformat(x["atualidade"]["prazo_proximo"]) >= hoje]
        renovados, conferidos = [], 0
        for x in lista:
            if not x["coleta"].get("falhas") or not x["atualidade"].get("ultimo_periodo") or not x["dado"]:
                continue
            direto = _max_ref_direto(x["familia"], x["dataset_silver"], x["dado"].get("formato"), hoje)
            conferidos += 1
            if direto != x["atualidade"]["ultimo_periodo"]:
                renovados.append({"conjunto": x["id"], "publicado": x["atualidade"]["ultimo_periodo"], "silver": direto})
        fichas["conjuntos_atrasados"] = ev.construir(
            indicador="Conjuntos com atualização atrasada", valor_exibido=f"{len(atrasados)}", valor_calculo=float(len(atrasados)),
            unidade="conjuntos", periodo={"inicio": hoje.isoformat(), "fim": hoje.isoformat()}, entidade="conjuntos integrados",
            universo=f"{len(com_sla)} conjuntos com SLA aplicável de {len(lista)} integrados", fonte={
                "orgao": "Scrutiniums (pipeline do observatório)", "conjunto": "Silvers do domínio Energia",
                "recurso": ("vintages vigentes de todos os conjuntos integrados; o sha256 é o da lista ordenada "
                            "conjunto:recurso:sha256 de cada vintage vigente (o mesmo snapshot da proveniência 'saude')"),
                "url": "https://github.com/genarolins1975/scrutiniums/tree/main/pipeline/energia",
                "arquivo": "data/energia/silver/*.db", "sha256": _snapshot_silvers(lista)["sha256"],
                "capturado_em": max((x["capturas"]["ultima"] for x in lista if x["capturas"]["ultima"]), default=None),
                "publicado_em": None},
            chaves_origem=[x["id"] for x in atrasados],
            formula="contagem de conjuntos com hoje > prazo_proximo (regra de SLA por cadência declarada, casos A a D)",
            cobertura="conjuntos com frequência declarada em metadado legível; sem ela, SEM SLA (não entram)",
            tratamento_ausencia="sem frequência declarada: SEM SLA; sem período nem data de publicação da fonte: SEM DADO",
            testes=[ev.teste("prazo vencido em todo atrasado", "aprovado" if not incoerentes else "reprovado",
                             f"{len(atrasados) - len(incoerentes)} de {len(atrasados)} atrasados com prazo anterior a {hoje.isoformat()}"),
                    ev.teste("falha não renova a data do dado", "aprovado" if not renovados else "reprovado",
                             (f"{conferidos} conjuntos com falha de coleta registrada: último período publicado igual ao MAX(ref) "
                              "lido de novo no silver por consulta direta") if not renovados else
                             f"conjuntos com período diferente do silver: {renovados[:5]}")],
            download=[{"rotulo": "Saúde por conjunto (CSV)", "url": U["conjuntos"]}],
            reproducao="python3 pipeline/energia/executar_modulo.py dados --sem-coleta", versao=versao)
    reprov = [x for x in lista if x["validacao"]["resultado"] == "reprovado"]
    rv = [x for x in lista if (x["revisoes"] or {}).get("maior_rel")]
    if rv:
        top = max(rv, key=lambda x: x["revisoes"]["maior_rel"]["relativa_pct"] or 0)
        e = top["revisoes"]["maior_rel"]
        vs = [v for v in top["_an"]["_vintages"] if v["recurso"] == e["recurso"] and v["capturado_em"] in (e["capturado_de"], e["capturado_para"])]
        if len(vs) == 2:
            # releitura direta das duas vintages no silver (outra consulta que não a da análise)
            relidos = _valor_nas_vintages(top["familia"], top["dataset_silver"], e["serie"], e["ref"], [v["vintage_id"] for v in vs
                                                                                                         if v.get("vintage_id")])
            esperado = [e["de"], e["para"]]
            confere = len(relidos) == 2 and all(abs(a - b) <= 1e-6 for a, b in zip(relidos, esperado))
            fichas["maior_revisao_relativa"] = ev.construir(
                indicador=f"Maior revisão relativa detectada ({top['titulo']})", valor_exibido=f"{e['relativa_pct']:.1f}%".replace(".", ","),
                valor_calculo=e["relativa_pct"], unidade="%", periodo={"inicio": e["ref"], "fim": e["ref"]},
                entidade=f"série {e['serie']} de {top['dataset_silver']}", universo=f"{top['revisoes']['referencias']} referências revisadas no conjunto",
                fonte={"orgao": top["orgao"], "conjunto": top["titulo"], "recurso": e["recurso"], "url": vs[-1].get("url") or "https://dados.ons.org.br/",
                       "arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None,
                       "arquivos": [ev.arquivo_de_vintage(v) for v in sorted(vs, key=lambda v: v["capturado_em"])]},
                chaves_origem=[f"{top['dataset_silver']}|{e['serie']}|{e['ref']}"],
                formula="100 × |valor novo − valor anterior| ÷ |valor anterior|",
                numerador={"descricao": "|valor novo − valor anterior|", "valor": abs(e["diferenca"])},
                denominador={"descricao": "|valor anterior|", "valor": abs(e["de"])},
                cobertura="todas as (série, referência) com mais de um valor entre capturas do silver",
                tratamento_ausencia="referência ausente numa captura não conta como revisão (ausência não é zero)",
                revisoes=top["revisoes"]["referencias"],
                testes=[ev.teste("valores relidos nas duas vintages", "aprovado" if confere else "reprovado",
                                 f"consulta direta às observações das vintages de {e['capturado_de']} e {e['capturado_para']}: "
                                 f"{relidos} (esperado {esperado})")],
                download=[{"rotulo": "Revisões detectadas (CSV)", "url": U["revisoes"]}],
                reproducao="python3 pipeline/energia/executar_modulo.py dados --sem-coleta", versao=versao)
    return fichas, len(reprov)


# ---------------------------------------------------------------- gold


def construir(con, ctx):
    t0 = time.time()
    hoje = val.hoje_brasilia()
    g = c.cabecalho(GOLD)
    agora = g["gerado_em"]
    brutos = catalogo.brutos_locais()
    if not (brutos.get("ONS") or {}).get("resultado") or not (brutos.get("ANEEL") or {}).get("resultado"):
        return c.stub(GOLD, "Listagens do ONS e da ANEEL ausentes em data/energia/meta: rode a coleta do módulo dados.")
    seeds = catalogo.pacotes_seed_ccee()
    metadados = base.registros_como_estavam_em(con, ck.DS_METADADOS)
    verificacoes = base.registros_como_estavam_em(con, ck.DS_VERIFICACAO)
    tempos = {}

    t = time.time()
    golds_res = valida_golds(hoje)
    tempos["golds"] = round(time.time() - t, 1)
    t = time.time()
    dic = dicionario_arquivos()
    csv_res = valida_csvs(hoje, dic)
    ident = [val.valida_identidade(i, base.SERIES) for i in val.IDENTIDADES]
    tempos["csv"] = round(time.time() - t, 1)
    t = time.time()
    parquets, chk_parquet = exporta_e_confere_parquet()
    tempos["parquet"] = round(time.time() - t, 1)
    t = time.time()
    cache_hash_caminho = os.path.join(base.DADOS, "meta", "_conferencia_bronze.json")
    cache_hash = base.le_gold("_conferencia_bronze.json", destino=os.path.join(base.DADOS, "meta")) or {}
    grupos = _grupos_integracao()
    analises, nao_declarados = _analises(grupos, hoje, cache_hash)
    base.escreve_gold(os.path.basename(cache_hash_caminho), cache_hash, destino=os.path.dirname(cache_hash_caminho))
    tempos["silvers"] = round(time.time() - t, 1)
    lista, chk_conj = conjuntos(grupos, analises, golds_res, brutos, seeds, metadados, hoje, agora)

    todas = [k for r in golds_res.values() for k in r["checagens"]] + [k for r in csv_res.values() for k in r["checagens"]]
    todas += ident + chk_parquet + chk_conj
    cont = Counter(k["resultado"] for k in todas)
    cal_agregado, cal_linhas = calendario(lista, hoje)
    eix, eixos_linhas = eixos(golds_res)

    g.update({
        "referencia": {"hoje": hoje.isoformat(), "fuso": "America/Sao_Paulo (UTC−3)", "executado_em": agora},
        "regras": {
            "estados": catalogo.DEFINICOES_ESTADO, "criterios_estado": catalogo.CRITERIOS_ESTADO,
            "uso": ("Uso é eixo separado do estado: indicador, modelo (com o estado do modelo no registro), conferência, contexto ou "
                    "histórico. Um conjunto que alimenta modelo em PESQUISA não é 'utilizado em modelo' em produção."),
            "sla": {k: {"tolerancia_dias": TOLERANCIA_DIAS[k], "periodo_dias_aprox": PERIODO_DIAS[k]} for k in TOLERANCIA_DIAS},
            "sla_texto": ("Tolerâncias por cadência: diária 2 dias, semanal 7, quinzenal 15, mensal 60, trimestral 90, anual 365. "
                          "A) Série regular cujo grão corresponde a uma cadência declarada pela fonte: o período seguinte ao último "
                          "disponível deve chegar até o fim dele mais a tolerância. B) Série publicada em lotes (cadência declarada "
                          "mais longa que o grão): a próxima remessa até o fim do último período mais um período da cadência "
                          "declarada e a tolerância. C) Cadência declarada mais curta que o grão (a fonte reescreve o arquivo dentro "
                          "do período, ou declara só o horário da rotina do portal, como o ONS): vale o grão do dado, como em A. "
                          "D) Sem série regular (cadastro, vigências, cadência irregular): data de publicação informada pela fonte "
                          "mais um período da cadência declarada e a tolerância; sem essa data, SEM DADO. Se o arquivo traz período "
                          "que começa depois da data de modificação informada, essa data não acompanha o conteúdo e vale o fim do "
                          "último período mais a cadência e a tolerância (publicacao_nao_acompanha_conteudo). Sem frequência declarada "
                          "em metadado legível, o SLA não é aplicado (SEM SLA), em vez de inventar uma."),
            "falha": ("Falha de coleta nunca renova a data do dado: o último período vem das referências do silver, a última "
                      "captura da última vintage com conteúdo, e a falha aparece separada, com data e motivo. A captura anterior "
                      "fica preservada no silver (append only) e no bronze com sha256."),
            "completude": ("Completude interna de uma série = referências distintas presentes ÷ esperadas entre a primeira e a "
                           "última, no passo modal do conjunto. Cobertura do último período = séries com valor na maior "
                           "referência comparada com a referência anterior."),
            "revisao": ("Revisão = troca de valor de uma mesma (série, referência) entre capturas consecutivas do mesmo arquivo "
                        "(recurso); a mesma referência com valores diferentes em arquivos diferentes é conflito entre recursos, "
                        "contado à parte. Publica-se quantas "
                        "referências e séries mudaram, o período afetado e a maior mudança absoluta (na unidade da série) e "
                        "relativa, além da data de cada captura que trouxe valores novos."),
            "validacao": ("Checagens com resultado aprovado, ressalva, reprovado ou não aplicável; o veredito de um alvo é o pior "
                          "resultado. Divergência entre total e partes publicados pela própria fonte é ressalva documentada; total "
                          "calculado pela plataforma que não fecha é reprovado."),
            "horizonte": {ds: r["motivo"] for ds, r in val.HORIZONTE_SILVER.items()},
            "tempo": {
                "periodo_referencia": "Início e fim do período a que o dado se refere, no fuso e convenção da fonte.",
                "publicado_pela_fonte_em": "Data de modificação do arquivo informada pela fonte (last_modified do CKAN); vazia quando a fonte não informa ou quando não acompanha o conteúdo (PLD da CCEE).",
                "capturado_em": "Primeira captura observada pelo pipeline de cada vintage (UTC).",
                "gerado_em": "Processamento que gerou a gold (UTC).",
                "validado_em": "Execução das validações registradas (UTC).",
                "vigencia": "Período de validade de regra, tarifa, ato, entidade ou geometria, quando o dado tem vigência.",
                "versoes": "Versão do pipeline, commit do código (versao_codigo) e id da publicação (manifesto.json).",
            },
        },
        "resumo": {
            "integracoes": len(lista),
            "por_estado": dict(Counter(x["estado"] for x in lista)),
            "por_situacao": dict(Counter(x["atualidade"]["situacao"] for x in lista)),
            "com_revisao": sum(1 for x in lista if ((x["revisoes"] or {}).get("referencias") or 0) > 0),
            "referencias_revisadas": sum(((x["revisoes"] or {}).get("referencias") or 0) for x in lista),
            "com_falha_recente": sum(1 for x in lista if x["coleta"]["falhas_consecutivas"]),
            "descontinuados": sum(1 for x in lista if x["descontinuado"]),
            "validacao": {k: cont.get(k, 0) for k in val.RESULTADOS} | {"checagens": len(todas)},
            "golds": {"total": len(golds_res), "integras": sum(1 for r in golds_res.values() if r["disponivel"]),
                      "por_veredito": dict(Counter(r["veredito"] for r in golds_res.values()))},
            "csv": {"total": len(csv_res), "por_veredito": dict(Counter(r["veredito"] for r in csv_res.values()))},
            "parquet": {"arquivos": len([p for p in parquets if p.get("csv")]),
                        "equivalentes": sum(1 for p in parquets if p.get("equivalente")),
                        "bytes": sum(p.get("bytes_parquet") or 0 for p in parquets)},
            "duracao_s": None,
        },
        "conjuntos": [publico(x) for x in lista],
        # datasets citados por cada gold: ver conjuntos[].etapas.publicado.citado_por
        "golds": [{"gold": n, "disponivel": r["disponivel"], "gerado_em": r["gerado_em"], "bytes": r["bytes"],
                   "veredito": r["veredito"],
                   "checagens": {k["tipo"]: k["resultado"] for k in r["checagens"]},
                   "problemas": [{"tipo": k["tipo"], "resultado": k["resultado"], "detalhe": k["detalhe"]}
                                 for k in r["checagens"] if k["resultado"] in ("reprovado", "ressalva")][:5]}
                  for n, r in sorted(golds_res.items())],
        "arquivos": {
            "csv_com_problema": [{"arquivo": n, "veredito": r["veredito"],
                                  "problemas": [{"tipo": k["tipo"], "resultado": k["resultado"], "detalhe": k["detalhe"]}
                                                for k in r["checagens"] if k["resultado"] in ("reprovado", "ressalva")][:4]}
                                 for n, r in sorted(csv_res.items()) if r["veredito"] in ("reprovado", "ressalva")],
            "parquet": [{k: p.get(k) for k in ("csv", "parquet", "status", "bytes_csv", "bytes_parquet", "linhas", "equivalente", "csv_sha256")}
                        for p in parquets],
            "limiar_parquet_bytes": LIMIAR_PARQUET,
        },
        "identidades": [{k: i[k] for k in ("id", "alvo", "resultado", "detalhe", "verificados", "problemas")} for i in ident],
        "calendario": cal_agregado,
        "silver_nao_declarados": nao_declarados,
        "eixos": eix,
        "avaliacao": {"arquivo": "/energia/gold/avaliacao.json" if os.path.exists(os.path.join(base.GOLD, "avaliacao.json")) else None,
                      "caminho_previsto": "public/energia/gold/avaliacao.json",
                      "existe": os.path.exists(os.path.join(base.GOLD, "avaliacao.json")),
                      "nota": ("A avaliação dos painéis (P071) só existe depois da inspeção final; enquanto o arquivo não existir, "
                               "a página declara a ausência e não exibe nota.")},
        "reproducao": {
            "repositorio": pub.REPOSITORIO,
            "url_versao_modelo": pub.REPOSITORIO + "/blob/{commit}/public{caminho}",
            "historico_arquivo_modelo": pub.REPOSITORIO + "/commits/main/public{caminho}",
            "commit": ("O commit exato é o do build que gerou a página (variável VERCEL_GIT_COMMIT_SHA na Vercel). Sem ela, a página "
                       "aponta o histórico do arquivo; o sha256 do manifesto identifica a versão em qualquer commit."),
            "passos": [
                f"git clone {pub.REPOSITORIO}.git && cd scrutiniums",
                "git log --format='%H %cI' -- public/energia/gold/manifesto.json  (uma linha por publicação)",
                "git checkout <commit>  (a publicação daquele dia, com todas as golds, séries e geometrias)",
                "sha256sum public/energia/series/<arquivo>.csv  (igual ao sha256 do arquivo no manifesto.json do mesmo commit)",
                "python3 -c \"import pyarrow.parquet as pq; print(pq.read_table('public/energia/series/<arquivo>.parquet').num_rows)\"",
                "python3 pipeline/energia/executar_modulo.py <modulo> --sem-coleta  (reconstrói a gold do silver; o silver não vai para o git)",
            ],
            "pacote_por_consulta": ("A tabela de cada painel exporta CSV e XLSX das linhas filtradas. O pacote documenta os filtros "
                                    "aplicados, a fórmula do indicador (metricas.json), o id da publicação e o sha256 do arquivo "
                                    "completo de origem; refazer a conta sobre as linhas exportadas dá o mesmo agregado exibido."),
            "silver": ("O silver com as vintages não é publicado no git (centenas de MB); a cópia durável fica no asset "
                       "energia-silver.db.gz da release energia-estado do repositório, sobrescrita a cada execução."),
        },
        "dicionario_operacao": catalogo.ARQUIVOS_OPERACAO,
        "downloads": [{"rotulo": "Conjuntos integrados: estado, saúde e revisões (CSV)", "url": U["conjuntos"]},
                      {"rotulo": "Catálogo completo com estados (CSV)", "url": U["catalogo"]},
                      {"rotulo": "Validações automáticas (CSV)", "url": U["validacoes"]},
                      {"rotulo": "Revisões detectadas (CSV)", "url": U["revisoes"]},
                      {"rotulo": "Calendário de capturas, falhas e revisões (CSV)", "url": U["calendario"]},
                      {"rotulo": "Natureza e situação da validação por ficha (CSV)", "url": U["eixos"]},
                      {"rotulo": "Manifesto da publicação (JSON)", "url": f"/energia/gold/{MANIFESTO}"}],
    })
    recursos = []
    cat = catalogo.construir(brutos, publicacao=g, verificacoes=verificacoes, recursos_saida=recursos)
    ccee = [e for e in cat["entradas"] if e["orgao"] == "CCEE"]
    g["catalogo"] = {"total": cat["total"], "contagem": cat["contagem"], "descontinuados": cat["descontinuados"],
                     "portais": cat["portais"], "recursos": cat["recursos"],
                     "ccee": {"conjuntos": len(ccee), "por_estado": dict(Counter(e["estado"] for e in ccee)),
                              "recursos": cat["recursos"].get("CCEE"),
                              "integrados": [{"id": e["id"], "titulo": e["titulo"], "estado": e["estado"],
                                              "recursos": e.get("recursos_resumo"), "modulos": e.get("modulos") or []}
                                             for e in ccee if e["estado"] not in ("CATALOGADO", "RECURSO VERIFICADO")]},
                     "descontinuados_lista": [{"id": e["id"], "titulo": e["titulo"], "motivo": (e.get("descontinuacao") or {}).get("motivo"),
                                               "evidencia": (e.get("descontinuacao") or {}).get("evidencia"), "estado": e["estado"]}
                                              for e in cat["entradas"] if e.get("descontinuado")],
                     "recursos_removidos": [{"orgao": x["orgao"], "conjunto": x["conjunto"], "recurso": x["recurso"],
                                             "publicado_em": x["publicado_em"]} for x in recursos if not x["presente"]][:50]}
    escreve_csv_recursos(recursos)
    g["afirmacoes"] = afirmacoes(cat, golds_res)
    g["proveniencia"] = proveniencias(con, lista, cat, hoje, agora)
    fichas, _ = _evidencia_kpis(con, lista, cat, agora, hoje, todas=todas, golds_res=golds_res)
    g["evidencias"] = fichas
    escreve_csvs(lista, todas, cal_linhas, cat, eixos_linhas, descricoes=_descricoes(brutos, seeds))
    base.escreve_gold("catalogo.json", cat)
    g["resumo"]["duracao_s"] = round(time.time() - t0, 1)
    g["resumo"]["tempos_s"] = tempos
    corpo = pub.serializa_gold(g)
    escreve_manifesto(final=False, publicacao_bytes=corpo)
    return g
