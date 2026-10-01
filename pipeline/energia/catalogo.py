"""Catálogo de datasets do setor elétrico: cinco estados derivados de evidência (P067).

Catalogar não é integrar, e integrar não é validar. O estado de cada conjunto é a
última etapa alcançada em sequência, cada uma com a sua evidência:

    CATALOGADO          existe na listagem oficial do portal (API CKAN colhida pelo
                        pipeline), num package_show versionado com sha256 (CCEE) ou no
                        REGISTRO de um módulo com URL e licença; entrada manual fica
                        aqui com metadados_verificados=false;
    RECURSO VERIFICADO  um arquivo do conjunto foi acessado pelo pipeline: baixado com
                        sha256 ou lido por requisição parcial, com status HTTP, formato
                        pela assinatura e cabeçalho real;
    INTEGRADO           coletado automaticamente para o silver: capturas com sha256 e
                        conteúdo extraído (observações ou registros), ou documento
                        guardado como original para citação;
    VALIDADO            validações automáticas registradas nesta publicação, nenhuma
                        reprovada (pipeline/energia/validacoes.py);
    PUBLICADO           alimenta gold íntegra publicada, cujo contrato não foi reprovado.

Uso (indicador, entrada de modelo, conferência, contexto) é um eixo separado do estado:
o PLD e a EAR e a ENA alimentam indicadores publicados e também modelos de previsão,
que estão em PESQUISA. O estado antigo "UTILIZADO EM MODELO" escondia essa diferença.

Recurso a recurso: cada arquivo (recurso CKAN) de cada conjunto listado recebe o seu
próprio estado (CATALOGADO, RECURSO VERIFICADO, ou o estado da integração que o
capturou), e o recurso que sumiu da listagem fica marcado como removido pela fonte.
O catálogo publicado leva o resumo por conjunto e, para a CCEE, a lista de recursos;
a tabela completa de recursos de cada portal sai em public/energia/series/
dados_recursos_<orgao>.csv (módulo dados).

Fontes: listagem package_search do ONS, da ANEEL e da CCEE (colhida e versionada pelo
módulo dados em data/energia/silver/publicacao.db), package_show da CCEE versionados
em pipeline/energia/seed/ccee_* (usados quando a listagem da CCEE falha), REGISTRO dos
módulos (pipeline/energia/modulos), capturas registradas nos silvers e o relatório de
validação da gold publicacao.json.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

PORTAIS = {
    "ONS": "https://dados.ons.org.br/api/3/action/package_search?rows=1000",
    "ANEEL": "https://dadosabertos.aneel.gov.br/api/3/action/package_search?rows=1000",
}
URL_DATASET = {"ONS": "https://dados.ons.org.br/dataset/", "ANEEL": "https://dadosabertos.aneel.gov.br/dataset/",
               "CCEE": "https://dadosabertos.ccee.org.br/dataset/"}
AQUI = os.path.dirname(os.path.abspath(__file__))
ESTADOS = ["CATALOGADO", "RECURSO VERIFICADO", "INTEGRADO", "VALIDADO", "PUBLICADO"]
ETAPAS = ["catalogado", "recurso_verificado", "integrado", "validado", "publicado"]
DEFINICOES_ESTADO = {
    "CATALOGADO": "Existe na listagem oficial do portal, num package_show versionado ou no registro de um módulo, com URL e licença. "
                  "Entrada cadastrada à mão fica aqui, com metadados não verificados.",
    "RECURSO VERIFICADO": "Um arquivo do conjunto foi acessado pelo pipeline: baixado com sha256 ou lido por requisição parcial, com "
                          "status HTTP, formato reconhecido pela assinatura e cabeçalho real.",
    "INTEGRADO": "Coletado automaticamente: cada captura tem o original guardado com sha256 e o conteúdo extraído entra no histórico "
                 "de capturas (documentos ficam guardados para citação).",
    "VALIDADO": "Integrado e com validações automáticas registradas nesta publicação, nenhuma reprovada: capturas com sha256, "
                "original conferido, horizonte das datas e esquema da fonte.",
    "PUBLICADO": "Validado e alimentando gold íntegra publicada no portal, cujo contrato (proveniência, links, esquema) não foi reprovado.",
}
CRITERIOS_ESTADO = {
    "CATALOGADO": "conjunto na resposta do package_search (ONS, ANEEL), em package_show versionado (CCEE), no REGISTRO de um módulo ou em catalogo_manual.json",
    "RECURSO VERIFICADO": "vintage com sha256 em algum silver, ou verificação parcial (Range de 64 KB) com HTTP 200/206 nos últimos dias",
    "INTEGRADO": "vintage(s) no silver da família declarada e observações ou registros extraídos (ou documento PDF/HTML guardado)",
    "VALIDADO": "checagens conjunto:<família>/<dataset>:* do relatório em publicacao.json sem nenhum resultado reprovado",
    "PUBLICADO": "dataset citado no snapshot de uma proveniência de gold íntegra ou declarado no REGISTRO do módulo dono de gold íntegra, sem checagem reprovada nessa gold",
}

# Conjuntos das golds de operação (pipeline/energia/gold/*.py, silver energia.db). Os
# conjuntos dos módulos temáticos vêm do REGISTRO de cada módulo, sem cópia aqui.
INTEGRADOS = {
    ("CCEE", "pld_horario"): {
        "dataset_silver": "ccee_pld_horario", "slug": "ccee-pld-horario", "titulo": "PLD_HORARIO",
        "golds": ["pld.json", "rede.json", "sintese.json"], "estado": "UTILIZADO EM INDICADOR", "modelos": ["B0", "C1", "C2-P", "C2-H", "S0"],
        "paginas": [{"rotulo": "PLD", "href": "/setor-eletrico/pld"}, {"rotulo": "Rede", "href": "/setor-eletrico/rede"},
                    {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"}],
        "downloads": ["/energia/series/pld_horario.csv", "/energia/series/pld_diario.csv"]},
    ("ONS", "ear-diario-por-subsistema"): {
        "dataset_silver": "ear_subsistema_di", "slug": "ons-ear-subsistema", "golds": ["hidrologia.json", "sintese.json"],
        "estado": "UTILIZADO EM INDICADOR", "modelos": ["C2-H"],
        "paginas": [{"rotulo": "Água e clima", "href": "/setor-eletrico/agua-e-clima"}, {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"},
                    {"rotulo": "PLD (formação)", "href": "/setor-eletrico/pld#formacao"}],
        "downloads": ["/energia/series/ear_diario.csv"]},
    ("ONS", "ena-diario-por-subsistema"): {
        "dataset_silver": "ena_subsistema_di", "slug": "ons-ena-subsistema", "golds": ["hidrologia.json", "sintese.json"],
        "estado": "UTILIZADO EM INDICADOR", "modelos": ["C2-H"],
        "paginas": [{"rotulo": "Água e clima", "href": "/setor-eletrico/agua-e-clima#ena"}, {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"},
                    {"rotulo": "PLD (formação)", "href": "/setor-eletrico/pld#formacao"}],
        "downloads": ["/energia/series/ena_diario.csv"]},
    ("ONS", "carga-energia"): {
        "dataset_silver": "carga_energia_di", "slug": "ons-carga-diaria", "golds": ["carga.json", "sintese.json"], "estado": "UTILIZADO EM INDICADOR",
        "paginas": [{"rotulo": "Carga", "href": "/setor-eletrico/carga"}, {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"},
                    {"rotulo": "PLD (formação)", "href": "/setor-eletrico/pld#formacao"}],
        "downloads": ["/energia/series/carga_diaria.csv"]},
    ("ONS", "balanco-energia-subsistema"): {
        "dataset_silver": "balanco_energia_subsistema_ho", "slug": "ons-balanco-energia", "golds": ["geracao.json", "rede.json", "sintese.json"],
        "estado": "UTILIZADO EM INDICADOR",
        "paginas": [{"rotulo": "Geração", "href": "/setor-eletrico/geracao"}, {"rotulo": "Rede", "href": "/setor-eletrico/rede"},
                    {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"}, {"rotulo": "PLD", "href": "/setor-eletrico/pld"}],
        "downloads": ["/energia/series/geracao_diaria.csv"]},
    ("ONS", "intercambio-nacional"): {
        "dataset_silver": "intercambio_nacional_ho", "slug": "ons-intercambio", "golds": ["rede.json"], "estado": "UTILIZADO EM INDICADOR",
        "paginas": [{"rotulo": "Rede", "href": "/setor-eletrico/rede"}, {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"},
                    {"rotulo": "PLD", "href": "/setor-eletrico/pld"}],
        "downloads": ["/energia/series/intercambio_diario.csv"]},
    ("ONS", "cmo-semanal"): {
        "dataset_silver": "cmo_se", "slug": "ons-cmo-semanal", "golds": ["cmo.json", "sintese.json"], "estado": "UTILIZADO EM INDICADOR",
        "paginas": [{"rotulo": "PLD (formação)", "href": "/setor-eletrico/pld#cmo"}, {"rotulo": "Visão geral", "href": "/setor-eletrico/visao-geral"}],
        "downloads": ["/energia/series/cmo_semanal.csv"]},
}
QUEBRAS = {
    ("ONS", "carga-energia"): [
        {"data": "2021-03-01", "origem": "FONTE", "descricao": "Passa a incluir a previsão de geração de usinas não despachadas pelo ONS."},
        {"data": "2023-04-29", "origem": "FONTE", "descricao": "Passa a incorporar o valor estimado da micro e minigeração distribuída (MMGD)."},
    ],
    ("ONS", "balanco-energia-subsistema"): [
        {"data": "2023-04-29", "origem": "PLATAFORMA", "descricao": "Identificada pela Scrutiniums no dado, não declarada na descrição do conjunto: a solar do SIN no balanço mais que dobra de um dia para o outro, na mesma data em que o ONS passa a incluir na carga a estimativa de MMGD."},
    ],
}
# Dicionário dos arquivos das golds de operação (pipeline/energia/gold/*.py), que não
# têm REGISTRO: publicado em publicacao.json junto com arquivos.json dos módulos.
ARQUIVOS_OPERACAO = {
    "/energia/series/pld_horario.csv":
        "data_hora_local: data e hora no horário de Brasília (AAAA-MM-DDTHH:MM); SE, S, NE, N: PLD de cada submercado naquela hora, em R$/MWh nominais.",
    "/energia/series/pld_diario.csv":
        "data: dia (AAAA-MM-DD); SE, S, NE, N: média simples das 24 horas do PLD, em R$/MWh nominais, calculada pela Scrutiniums; dias sem as 24 horas ficam de fora.",
    "/energia/series/ear_diario.csv":
        "data: dia; SE, S, NE, N: energia armazenada em % da EAR máxima, como publicada pelo ONS; SIN_calculado: soma das EAR dividida pela soma das máximas, calculada pela Scrutiniums.",
    "/energia/series/ena_diario.csv":
        "data: dia; colunas _pct_mlt: ENA bruta em % da MLT; colunas _mwmed: ENA bruta em energia (o dicionário do ONS descreve a unidade como MWmês); SIN calculado pela Scrutiniums.",
    "/energia/series/carga_diaria.csv":
        "data: dia; SE, S, NE, N: carga em MWmed, como publicada pelo ONS; SIN_calculado: soma dos quatro subsistemas.",
    "/energia/series/geracao_diaria.csv":
        "data: dia; hidraulica, termica, eolica e solar por região (SIN, SE, S, NE, N): média diária da geração verificada horária, em MWmed.",
    "/energia/series/intercambio_diario.csv":
        "data: dia; fluxo_: intercâmbio verificado médio do dia por fronteira, em MWmed, positivo no sentido indicado no nome (N_NE = do Norte para o Nordeste); programado_: valor programado pelo ONS.",
    "/energia/series/cmo_semanal.csv":
        "semana_operativa: data de referência da semana operativa informada pelo ONS; para cada subsistema, CMO semanal e por patamar de carga (leve, média, pesada), em R$/MWh.",
}
TEMAS = [
    ("preco", ["pld", "cmo", "preco", "preço", "cvu", "tarifa", "bandeira", "componentes-tarif"]),
    ("hidrologia", ["ear", "ena", "hidrolog", "reservat", "vazao", "vazão", "fluviom", "precipita", "bacia", "volume"]),
    ("geracao", ["geracao", "geração", "usina", "capacidade", "eolica", "eólica", "fotovolt", "termic", "térmic", "coff", "constrained", "disponibilidade", "fator-capacidade", "modalidade", "uge"]),
    ("carga", ["carga", "demanda", "curva"]),
    ("rede", ["intercambio", "intercâmbio", "linha", "transmiss", "subestac", "equipamento", "confiab", "fluxo", "reativo"]),
    ("distribuicao", ["distribu", "dec", "fec", "mmgd", "consumidor", "indqual", "atendimento", "interrup", "bdgd"]),
    ("expansao", ["leilo", "leilõ", "ralie", "outorga", "expans", "empreendimento", "acrescimo"]),
    ("regulacao", ["infra", "intima", "notifica", "audienc", "consulta", "reunio", "pauta", "fiscaliza", "tfsee"]),
    ("empresas", ["agentes", "societ", "cde", "subsid", "beneficiar"]),
    ("mercado", ["sumario", "compra_venda", "contabiliza", "mre", "gsf", "encargo"]),
]
# Tamanho da descrição no catálogo publicado (a íntegra fica em dados_catalogo.csv).
MAX_DESCRICAO = 130
ORDEM_RECURSO = ["CATALOGADO", "RECURSO VERIFICADO", "INTEGRADO", "VALIDADO", "PUBLICADO"]


def tema(nome, titulo):
    s = f"{nome} {titulo}".lower()
    for t, chaves in TEMAS:
        if any(k in s for k in chaves):
            return t
    return "outros"


def papel(estado_declarado):
    """Uso declarado pelo módulo, separado do estado do catálogo."""
    e = (estado_declarado or "").upper()
    if e.startswith("UTILIZADO EM INDICADOR"):
        return "indicador"
    if e.startswith("UTILIZADO EM MODELO"):
        return "modelo"
    if "VALIDA" in e:
        return "conferencia"
    if e.startswith("DESCONTINUADO"):
        return "historico"
    return "contexto"


def estado_por_etapas(etapas):
    """Última etapa alcançada em sequência: uma etapa sem evidência interrompe a
    escada, mesmo que as seguintes tenham (essa inconsistência vira ressalva)."""
    estado = None
    for nome, rotulo in zip(ETAPAS, ESTADOS):
        if (etapas.get(nome) or {}).get("ok"):
            estado = rotulo
        else:
            break
    return estado or "CATALOGADO"


def saltos(etapas):
    """Etapas com evidência depois de uma etapa sem evidência (ex.: publicado sem
    validação aprovada): o estado fica na etapa anterior e o salto é declarado."""
    vistos_falha = None
    out = []
    for nome in ETAPAS:
        ok = (etapas.get(nome) or {}).get("ok")
        if not ok and vistos_falha is None:
            vistos_falha = nome
        elif ok and vistos_falha:
            out.append(f"Há evidência de '{nome}', mas falta a etapa '{vistos_falha}': o estado fica antes de '{vistos_falha}'.")
    return out


_MODULOS = None


def integrados_de_modulos():
    """{(orgao, nome): entrada} dos módulos temáticos (mantido para compatibilidade)."""
    global _MODULOS
    if _MODULOS is None:
        from pipeline.energia import modulos
        _MODULOS = modulos.datasets_integrados()
    return _MODULOS


MODULOS_IGNORADOS = []


def modulos_validos():
    """Módulos com REGISTRO e construir(), tolerando módulo incompleto de outro autor (em
    construção, sem construir): ele fica de fora e é listado em MODULOS_IGNORADOS, em vez
    de derrubar o catálogo inteiro como modulos.descobrir() faria."""
    import importlib
    import pkgutil
    from pipeline.energia import modulos
    MODULOS_IGNORADOS.clear()
    mods = []
    for info in pkgutil.iter_modules([modulos.AQUI]):
        if info.name.startswith("_"):
            continue
        try:
            m = importlib.import_module(f"pipeline.energia.modulos.{info.name}")
        except Exception as e:  # erro de importação de módulo alheio
            MODULOS_IGNORADOS.append({"modulo": info.name, "motivo": f"importação falhou: {type(e).__name__}: {e}"[:200]})
            continue
        reg = getattr(m, "REGISTRO", None)
        if reg is None:
            continue
        faltam = [k for k in modulos.CAMPOS_OBRIGATORIOS if k not in reg]
        if faltam or not callable(getattr(m, "construir", None)):
            MODULOS_IGNORADOS.append({"modulo": info.name, "motivo": f"REGISTRO sem {faltam}" if faltam else "sem construir(con, ctx)"})
            continue
        mods.append(m)
    return sorted(mods, key=lambda m: (m.REGISTRO["ordem"], m.REGISTRO["id"]))


def integracoes():
    """Uma linha por (família, dataset do silver, módulo): golds de operação e REGISTRO
    de cada módulo temático. Genérico: um módulo novo aparece sem editar este arquivo."""
    out = []
    for (orgao, nome), d in INTEGRADOS.items():
        out.append({"orgao": orgao, "nome": nome, "slug": d["slug"], "dataset_silver": d["dataset_silver"], "familia": "energia",
                    "modulo": "operacao", "golds": list(d["golds"]), "paginas": list(d["paginas"]), "downloads": list(d["downloads"]),
                    "estado_declarado": d["estado"], "modelos": list(d.get("modelos", [])), "titulo": d.get("titulo"),
                    "url": URL_DATASET[orgao] + nome, "licenca": None, "quebras": QUEBRAS.get((orgao, nome), []),
                    "descricao": "", "tema": None, "formatos": []})
    for m in modulos_validos():
        r = m.REGISTRO
        for d in r["datasets"]:
            out.append({"orgao": d["orgao"], "nome": d["nome"], "slug": d.get("slug"), "dataset_silver": d.get("dataset_silver"),
                        "familia": r["familia"], "modulo": r["id"], "golds": [r["gold"]], "paginas": list(d.get("paginas") or []),
                        "downloads": list(d.get("downloads") or []), "estado_declarado": d.get("estado"),
                        "modelos": list(d.get("modelos") or []), "titulo": d.get("titulo"), "url": d.get("url"),
                        "licenca": d.get("licenca"), "quebras": list(d.get("quebras") or []), "descricao": d.get("descricao") or "",
                        "tema": d.get("tema"), "formatos": list(d.get("formatos") or []), "frequencia": d.get("frequencia"),
                        "descontinuado": str(d.get("estado") or "").upper().startswith("DESCONTINUADO")})
    return out


def estados_modelos():
    """{codigo: estado} do registro de modelos (PESQUISA, VALIDACAO, PRODUCAO, APOSENTADO)."""
    try:
        with open(os.path.join(AQUI, "registro_modelos.json"), encoding="utf-8") as f:
            return {m["codigo"]: m.get("estado") for m in json.load(f).get("modelos", [])}
    except Exception:
        return {}


def colhe(baixar=http_get):
    """Colhe as listagens do ONS e da ANEEL (e tenta a da CCEE) pelo coletor do módulo
    dados, que versiona a resposta no silver `publicacao`; reaproveita a listagem
    colhida há menos de uma hora (o run.py e o módulo não baixam duas vezes)."""
    from datetime import datetime, timedelta, timezone
    from pipeline.energia.fontes import ckan_dados as ck
    con = base.conecta_familia("publicacao")
    brutos = {}
    try:
        for orgao in ("ONS", "ANEEL", "CCEE"):
            cache = ck.cache_catalogo(orgao)
            if cache and cache.get("colhido_em"):
                try:
                    idade = datetime.now(timezone.utc) - datetime.fromisoformat(cache["colhido_em"].replace("Z", "+00:00"))
                    if idade < timedelta(hours=1):
                        brutos[orgao] = cache
                        continue
                except ValueError:
                    pass
            status, pacotes = ck.colhe_catalogo(con, orgao, baixar=baixar)
            if pacotes is not None:
                brutos[orgao] = ck.cache_catalogo(orgao)
            elif orgao != "CCEE":
                anterior = ck.cache_catalogo(orgao)
                brutos[orgao] = anterior or {"colhido_em": None, "resultado": [], "erro": status.get("erro")}
                brutos[orgao]["erro"] = status.get("erro")
    finally:
        con.commit()
        con.close()
    return brutos


def brutos_locais():
    """Listagens guardadas em data/energia/meta (sem rede)."""
    pasta = os.path.join(base.DADOS, "meta")
    out = {}
    for orgao in ("ONS", "ANEEL", "CCEE"):
        b = base.le_gold(f"_ckan_{orgao}.json", destino=pasta)
        if b:
            out[orgao] = b
    return out


def pacotes_seed_ccee():
    """package_show da CCEE versionados no repositório, um por conjunto: a versão mais
    recente de cada nome, com a lista de todas as versões guardadas (arquivo, sha256,
    captura) para a auditoria."""
    from pipeline.energia.fontes import ckan_dados as ck
    por_nome = {}
    for pasta, versao, arquivo in ck.seeds_ccee():
        caminho = os.path.join(base.SEED, pasta, versao, arquivo)
        with open(caminho, "rb") as f:
            corpo = f.read()
        pkg = json.loads(corpo.decode("utf-8"))["result"]
        try:
            with open(os.path.join(base.SEED, pasta, versao, "MANIFESTO.json"), encoding="utf-8") as f:
                manifesto = json.load(f)
        except (OSError, ValueError):
            manifesto = {}
        cap = ck._captura_do_seed(manifesto, arquivo, versao)
        info = {"arquivo": os.path.relpath(caminho, base.RAIZ), "sha256": base.sha256_bytes(corpo), "capturado_em": cap}
        nome = pkg.get("name")
        atual = por_nome.get(nome)
        versoes = (atual or {}).get("_seed_versoes", []) + [info]
        if atual is None or (cap or "") >= (atual["_seed"]["capturado_em"] or ""):
            por_nome[nome] = {**pkg, "_seed": info, "_seed_versoes": versoes}
        else:
            atual["_seed_versoes"] = versoes
    return [por_nome[n] for n in sorted(por_nome)]


def _formatos(pkg):
    return sorted({(r.get("format") or "").upper() for r in pkg.get("resources", []) if r.get("format")})


# ---------------------------------------------------------------- recursos (arquivos) de cada conjunto


def normaliza_url(url):
    """URL comparável entre a listagem do portal e a captura registrada no silver:
    esquema e host em minúsculas, caminho sem codificação percentual e sem barra final."""
    from urllib.parse import unquote, urlsplit
    if not url:
        return None
    try:
        p = urlsplit(str(url).strip())
    except ValueError:
        return str(url).strip()
    caminho = unquote(p.path).rstrip("/")
    return f"{p.scheme.lower()}://{p.netloc.lower()}{caminho}" + (f"?{p.query}" if p.query else "")


def indice_capturas(familias=None):
    """Capturas registradas em todos os silvers (somente leitura): {url normalizada:
    [{familia, dataset, recurso, capturas, ultima}]}. É a prova de que o pipeline
    baixou aquele arquivo com sha256 (base.registra_vintage)."""
    import sqlite3
    out = {}
    if not os.path.isdir(base.SILVER):
        return out
    nomes = sorted(n[:-3] for n in os.listdir(base.SILVER) if n.endswith(".db"))
    for fam in nomes:
        if familias is not None and fam not in familias:
            continue
        con = sqlite3.connect(f"file:{os.path.join(base.SILVER, fam + '.db')}?mode=ro", uri=True, timeout=60)
        try:
            linhas = con.execute("SELECT dataset, recurso, url, COUNT(*), MAX(capturado_em) FROM vintages "
                                 "WHERE url IS NOT NULL GROUP BY dataset, recurso, url").fetchall()
        except sqlite3.Error:
            linhas = []
        finally:
            con.close()
        for ds, rec, url, n, ult in linhas:
            u = normaliza_url(url)
            if u:
                out.setdefault(u, []).append({"familia": fam, "dataset": ds, "recurso": rec, "capturas": n, "ultima": ult})
    return out


def ler_recursos_registrados():
    """{orgao: {chave 'conjunto/recurso_id': campos}} dos recursos registrados a cada
    listagem (silver `publicacao`). Recurso com presente = '0' sumiu da listagem: foi
    removido ou renomeado pela fonte."""
    caminho = os.path.join(base.SILVER, "publicacao.db")
    if not os.path.exists(caminho):
        return {}
    import sqlite3
    from pipeline.energia.fontes import ckan_dados as ck
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)
    out = {}
    try:
        for orgao, ds in ck.DS_RECURSOS.items():
            out[orgao] = base.registros_como_estavam_em(con, ds)
    except sqlite3.Error:
        pass
    finally:
        con.close()
    return out


def _estado_capturado(caps, integ_estados):
    """Estado de um recurso capturado: o da integração declarada que o capturou (o
    recurso herda a validação e a publicação do conjunto do silver); captura por
    dataset não declarado para o conjunto prova só que o arquivo foi acessado."""
    melhores = [integ_estados[(c["familia"], c["dataset"])] for c in caps if (c["familia"], c["dataset"]) in integ_estados]
    melhores = [m for m in melhores if m in ORDEM_RECURSO]
    if melhores:
        return max(melhores, key=ORDEM_RECURSO.index), True
    return "RECURSO VERIFICADO", False


def recursos_do_conjunto(orgao, pkg, *, integ_estados, capturas, verificacao, registrados):
    """Linhas recurso a recurso de um conjunto listado (presentes e removidos)."""
    nome = pkg.get("name")
    linhas = []
    vistos = set()
    for r in pkg.get("resources") or []:
        rid = r.get("id")
        vistos.add(f"{nome}/{rid}")
        caps = capturas.get(normaliza_url(r.get("url"))) or []
        if caps:
            estado, declarado = _estado_capturado(caps, integ_estados)
            via = "captura com sha256" + ("" if declarado else " (dataset não declarado para o conjunto)")
        elif verificacao and verificacao.get("recurso_id") == rid and verificacao.get("resultado") == "ok" \
                and str(verificacao.get("http_status")) in ("200", "206"):
            estado, via = "RECURSO VERIFICADO", "requisição parcial (64 KB)"
        else:
            estado, via = "CATALOGADO", None
        linhas.append({
            "orgao": orgao, "conjunto": nome, "recurso_id": rid, "recurso": r.get("name"),
            "formato": (r.get("format") or "").upper() or None, "publicado_em": r.get("last_modified") or r.get("metadata_modified"),
            "tamanho": r.get("size"), "url": r.get("url"), "presente": True, "estado": estado, "via": via,
            "capturas": sum(c["capturas"] for c in caps), "ultima_captura": max((c["ultima"] for c in caps), default=None),
            "datasets_silver": sorted({f"{c['familia']}/{c['dataset']}" for c in caps}),
            "verificado_em": verificacao.get("verificado_em") if (verificacao and verificacao.get("recurso_id") == rid) else None,
        })
    for ch, campos in sorted((registrados or {}).items()):
        if not ch.startswith(f"{nome}/") or ch in vistos or campos.get("presente") != "0":
            continue
        linhas.append({
            "orgao": orgao, "conjunto": nome, "recurso_id": ch.split("/", 1)[1], "recurso": campos.get("nome"),
            "formato": campos.get("formato"), "publicado_em": campos.get("last_modified"), "tamanho": campos.get("tamanho"),
            "url": campos.get("url"), "presente": False, "estado": "CATALOGADO", "via": "removido da listagem pela fonte",
            "capturas": 0, "ultima_captura": None, "datasets_silver": [], "verificado_em": None,
        })
    return linhas


def resumo_recursos(linhas):
    presentes = [x for x in linhas if x["presente"]]
    cont = {s: 0 for s in ORDEM_RECURSO}
    for x in presentes:
        cont[x["estado"]] += 1
    pubs = sorted(str(x["publicado_em"])[:10] for x in presentes if x.get("publicado_em"))
    return _enxuto({"total": len(presentes), "por_estado": {k: v for k, v in cont.items() if v},
                    "acessados": sum(cont[s] for s in ORDEM_RECURSO[1:]),
                    "removidos": (len(linhas) - len(presentes)) or None,
                    "ultimo_publicado": pubs[-1] if pubs else None})


def _enxuto(d):
    """Sem chaves de valor None (o leitor trata chave ausente como não informado)."""
    return {k: v for k, v in d.items() if v is not None}


# ---------------------------------------------------------------- construção


def construir(brutos, publicacao=None, verificacoes=None, recursos_saida=None, capturas=None, registrados=None):
    """Catálogo publicado em catalogo.json. `publicacao` é a gold publicacao.json (lida
    do disco quando omitida): traz o estado de cada integração com as evidências e o
    relatório de validação. `verificacoes`: {chave: resultado} das verificações de
    recurso (lidas do silver `publicacao` quando omitidas). `capturas` e `registrados`
    (lidos dos silvers quando omitidos) dão o estado recurso a recurso. Com
    `recursos_saida` (lista), recebe a tabela completa de recursos de todos os portais."""
    from pipeline.energia.fontes import ckan_dados as ck
    if publicacao is None:
        publicacao = base.le_gold("publicacao.json") or {}
    if verificacoes is None:
        verificacoes = ler_verificacoes()
    if capturas is None:
        capturas = indice_capturas()
    if registrados is None:
        registrados = ler_recursos_registrados()
    por_integracao = {}
    conjuntos_pub = [_com_familia(it) for it in (publicacao.get("conjuntos") or [])]
    for it in conjuntos_pub:
        por_integracao.setdefault((it.get("orgao"), it.get("nome")), []).append(it)
    integ_estados = {(it.get("familia"), it.get("dataset_silver")): it.get("estado") for it in conjuntos_pub}
    mods = estados_modelos()
    entradas, status = [], {}
    presentes = set()
    todos_recursos = []

    def entrada_base(orgao, pkg, *, verificado=True, origem_catalogo, catalogado_em):
        nome = pkg.get("name")
        ex = ck.extras(pkg)
        desc = ck.descontinuacao(pkg, ex)
        notas = (pkg.get("notes") or "").split("-----")[0].strip()
        rec = recursos_do_conjunto(orgao, pkg, integ_estados=integ_estados, capturas=capturas,
                                   verificacao=verificacoes.get(f"{orgao}:{nome}"), registrados=registrados.get(orgao))
        todos_recursos.extend(rec)
        e = {
            "id": f"{orgao.lower()}:{nome}", "slug": None, "orgao": orgao, "nome": nome, "titulo": pkg.get("title"),
            "url": URL_DATASET.get(orgao, "") + nome if orgao in URL_DATASET else None,
            "licenca": pkg.get("license_title") or pkg.get("license_id"), "modificado_na_fonte": pkg.get("metadata_modified"),
            "descricao": _corta(notas), "n_recursos": pkg.get("num_resources") or len(pkg.get("resources", [])),
            "formatos": _formatos(pkg), "tema": tema(nome or "", pkg.get("title") or ""),
            "frequencia_declarada": ex["frequencia_declarada"], "referencia_publicacao": ex["referencia_publicacao"],
            "metadados_verificados": verificado, "descontinuado": bool(desc), "descontinuacao": desc,
            "etapas": {"catalogado": origem_catalogo},
            "recursos_resumo": resumo_recursos(rec),
        }
        # CCEE recurso a recurso no próprio catálogo para os conjuntos com algum arquivo
        # acessado pelo pipeline; a tabela de todos os recursos está em dados_recursos_ccee.csv
        if orgao == "CCEE" and any(x["estado"] in ORDEM_RECURSO[2:] for x in rec):
            e["recursos"] = [_enxuto({"nome": x["recurso"], "formato": x["formato"],
                                      "publicado_em": str(x["publicado_em"])[:10] if x.get("publicado_em") else None,
                                      "estado": x["estado"], "capturas": x["capturas"] or None,
                                      "removido": True if not x["presente"] else None}) for x in rec]
        if pkg.get("_seed_versoes"):
            e["metadados_versionados"] = pkg["_seed_versoes"]
        return e

    seeds = pacotes_seed_ccee()
    seed_por_nome = {p.get("name"): p for p in seeds}
    for orgao in ("ONS", "ANEEL", "CCEE"):
        b = brutos.get(orgao) or {}
        res = b.get("resultado") or []
        for pkg in res:
            if orgao == "CCEE" and pkg.get("name") in seed_por_nome:
                pkg = {**pkg, "_seed_versoes": seed_por_nome[pkg["name"]]["_seed_versoes"]}
            e = entrada_base(orgao, pkg, origem_catalogo={"ok": True, "origem": "listagem"}, catalogado_em=b.get("colhido_em"))
            entradas.append(e)
            presentes.add((orgao, pkg.get("name")))
        if orgao != "CCEE" or res:
            status[orgao] = {"colhido_em": b.get("colhido_em"), "conjuntos": len(res), "erro": b.get("erro"),
                             "origem": "API CKAN package_search", "url": ck.CATALOGOS[orgao]["url"],
                             "url_conjunto": URL_DATASET[orgao],
                             "recursos": sum(len(p.get("resources") or []) for p in res)}
    if not (brutos.get("CCEE") or {}).get("resultado"):
        # a listagem da CCEE falhou nesta execução: os package_show versionados no
        # repositório dão o catálogo recurso a recurso dos conjuntos que guardam
        for pkg in seeds:
            s = pkg["_seed"]
            e = entrada_base("CCEE", pkg, origem_catalogo={"ok": True, "origem": "package_show", "em": s["capturado_em"],
                                                           "arquivo": s["arquivo"], "sha256": s["sha256"]},
                             catalogado_em=s["capturado_em"])
            entradas.append(e)
            presentes.add(("CCEE", pkg.get("name")))
        erro_ccee = (brutos.get("CCEE") or {}).get("erro") or ultima_falha_ccee()
        status["CCEE"] = {"colhido_em": None, "conjuntos": len(seeds), "erro": erro_ccee, "url_conjunto": URL_DATASET["CCEE"],
                          "origem": "package_show versionados no repositório (pipeline/energia/seed/ccee_*), recurso a recurso",
                          "seed_capturado_em": sorted({p["_seed"]["capturado_em"] for p in seeds}),
                          "recursos": sum(len(p.get("resources") or []) for p in seeds)}
    # conjuntos integrados fora das listagens (IBGE, CVM, EPE, MCTI, NASA, atos normativos)
    for it in integracoes():
        chave = (it["orgao"], it["nome"])
        if chave in presentes:
            continue
        presentes.add(chave)
        entradas.append({
            "id": f"{it['orgao'].lower()}:{it['nome']}", "slug": None, "orgao": it["orgao"], "nome": it["nome"],
            "titulo": it.get("titulo"), "url": it.get("url"), "licenca": it.get("licenca"), "modificado_na_fonte": None,
            "descricao": _corta(it.get("descricao") or ""), "n_recursos": None, "formatos": it.get("formatos") or [],
            "tema": it.get("tema") or tema(it["nome"], it.get("titulo") or ""), "frequencia_declarada": it.get("frequencia"),
            "referencia_publicacao": None,
            "metadados_verificados": True, "descontinuado": bool(it.get("descontinuado")),
            "descontinuacao": {"motivo": "declarado pelo módulo", "evidencia": it.get("estado_declarado")} if it.get("descontinuado") else None,
            "etapas": {"catalogado": {"ok": bool(it.get("url") and it.get("licenca")), "origem": "registro", "modulo": it["modulo"]}},
        })
    # integrações: etapas vindas da gold publicacao.json (uma linha por dataset do silver)
    regs = {}
    for it in integracoes():
        regs.setdefault((it["orgao"], it["nome"]), []).append(it)
    for e in entradas:
        chave = (e["orgao"], e["nome"])
        lista = por_integracao.get(chave) or []
        declaradas = regs.get(chave) or []
        # id do conjunto em publicacao.json (família/dataset) e o estado de cada integração
        e["integracoes"] = [{"id": f"{x.get('familia')}/{x.get('dataset_silver')}", "estado": x.get("estado")} for x in lista]
        if declaradas and not lista:
            e["integracoes"] = [{"id": f"{d.get('familia')}/{d.get('dataset_silver')}", "estado": None} for d in declaradas]
        e["modulos"] = sorted({m for x in lista for m in (x.get("modulos") or [])} | {d["modulo"] for d in declaradas})
        ets = dict(e["etapas"])
        if lista:
            melhor = max(lista, key=lambda x: ESTADOS.index(x.get("estado") or "CATALOGADO"))
            for nome in ETAPAS[1:]:
                ets[nome] = (melhor.get("etapas") or {}).get(nome) or {"ok": False}
            e["ressalvas"] = sorted({r for x in lista for r in (x.get("ressalvas") or [])})
        else:
            v = verificacoes.get(f"{e['orgao']}:{e['nome']}")
            ets["recurso_verificado"] = _etapa_verificacao(v, e.get("recursos_resumo"))
            for nome in ETAPAS[2:]:
                ets[nome] = {"ok": False}
            e["ressalvas"] = []
            if declaradas:
                e["ressalvas"].append("Declarado no REGISTRO de módulo, mas sem estado calculado nesta publicação (gold publicacao.json ausente ou anterior à declaração).")
        e["estado"] = estado_por_etapas(ets)
        # etapa não alcançada e sem nenhuma evidência ({"ok": false}) não é escrita: chave
        # ausente = etapa não alcançada. Conjunto integrado leva só o essencial de cada
        # etapa; a evidência completa está no conjunto de publicacao.json (integracoes).
        if lista:
            e["etapas"] = {k: _enxuto({kk: vv for kk, vv in v.items() if kk in ("ok", "origem", "via")})
                           for k, v in ets.items() if v.get("ok") or len(v) > 1}
        else:
            e["etapas"] = {k: _enxuto(v) for k, v in ets.items() if v.get("ok") or len(v) > 1}
        e["ressalvas"] = e.get("ressalvas", []) + saltos(ets)
        golds = sorted({g for d in declaradas for g in d.get("golds", [])})
        paginas = []
        for d in declaradas:
            for p in d.get("paginas", []):
                if p not in paginas:
                    paginas.append(p)
        modelos = sorted({m for d in declaradas for m in d.get("modelos", [])})
        if declaradas:
            # papel de uso (eixo separado do estado); golds em usado_em, páginas em paginas,
            # códigos de modelo em modelos e o estado de cada modelo no cabeçalho
            e["papeis"] = sorted({papel(d.get("estado_declarado")) for d in declaradas})
        # campos lidos pela página inicial, por datasets.ts e pelos testes de reauditoria
        # (usado_em e quebras existem em toda entrada, mesmo vazios)
        e["usado_em"] = golds if e["estado"] != "CATALOGADO" else []
        e["quebras"] = [q for d in declaradas for q in d.get("quebras", [])] or QUEBRAS.get(chave, [])
        if declaradas or lista:
            primeira = (lista or declaradas or [{}])[0]
            e["modelos"] = modelos
            e["slug"] = primeira.get("slug")
            e["interno"] = primeira.get("dataset_silver")
            e["familia"] = primeira.get("familia")
            e["paginas"] = paginas
            declarados = sorted({u for d in declaradas for u in d.get("downloads", [])})
            # só o que existe em public/: download declarado e não publicado vira ressalva
            e["downloads"] = [u for u in declarados if os.path.exists(os.path.join(base.RAIZ, "public", u.lstrip("/")))]
            faltam = [u for u in declarados if u not in e["downloads"]]
            if faltam:
                e["ressalvas"] = (e.get("ressalvas") or []) + [f"Download declarado no REGISTRO e não publicado: {', '.join(faltam)}."]
        for k in ("slug", "interno", "familia", "descontinuacao", "referencia_publicacao", "modificado_na_fonte",
                  "frequencia_declarada", "n_recursos"):
            if e.get(k) is None:
                e.pop(k, None)
        for k in ("integracoes", "ressalvas"):
            if not e.get(k):
                e.pop(k, None)
        if not (declaradas or lista):
            # descrição integral em dados_catalogo.csv; o JSON leva só a dos integrados
            e.pop("descricao", None)
    with open(os.path.join(AQUI, "catalogo_manual.json"), encoding="utf-8") as f:
        for m in json.load(f)["entradas"]:
            v = verificacoes.get(f"MANUAL:{m['id']}")
            entradas.append({**m, "descricao": _corta(m.get("descricao") or ""), "estado": "CATALOGADO", "usado_em": [],
                             "quebras": [], "metadados_verificados": False, "descontinuado": False,
                             "etapas": {"catalogado": {"ok": True, "origem": "manual"},
                                        "recurso_verificado": {"ok": False}, "integrado": {"ok": False},
                                        "validado": {"ok": False}, "publicado": {"ok": False}},
                             "endereco_verificado": ({"http_status": v.get("http_status"), "resultado": v.get("resultado"),
                                                      "verificado_em": v.get("verificado_em"), "detalhe": v.get("detalhe")} if v else None)})
    entradas.sort(key=lambda e: (-ESTADOS.index(e["estado"]), e["orgao"], e.get("titulo") or ""))
    licencas = {}
    for o, st in status.items():
        cont = {}
        for e in entradas:
            if e["orgao"] == o and e.get("licenca"):
                cont[e["licenca"]] = cont.get(e["licenca"], 0) + 1
        st["licenca"] = max(cont, key=cont.get) if cont else None
        licencas[o] = st["licenca"]
    for e in entradas:
        _compacta_publicado(e, licencas)
    contagem = {s: 0 for s in ESTADOS}
    for e in entradas:
        contagem[e["estado"]] += 1
    if recursos_saida is not None:
        recursos_saida.extend(todos_recursos)
    rec_cont = {}
    for x in todos_recursos:
        if x["presente"]:
            rec_cont.setdefault(x["orgao"], {s: 0 for s in ORDEM_RECURSO})[x["estado"]] += 1
    return {
        "dominio": base.DOMINIO, "gold": "catalogo.json",
        # mesmo instante da publicação que trouxe as evidências: o catálogo reconstruído
        # pelo orquestrador com as mesmas entradas sai idêntico
        "gerado_em": publicacao.get("gerado_em") or base.agora_utc(),
        "versao_pipeline": base.VERSAO_PIPELINE, "disponivel": True,
        "estados": ESTADOS, "definicoes_estado": DEFINICOES_ESTADO, "criterios_estado": CRITERIOS_ESTADO,
        "eixos": {"estado": "Até onde o conjunto chegou na escada catalogado → publicado, cada etapa com evidência.",
                  "uso": "Para que o conjunto é usado (indicador, entrada de modelo, conferência, contexto, histórico); "
                         "modelos aparecem com o seu estado (PESQUISA, VALIDACAO, PRODUCAO, APOSENTADO)."},
        "regra_recurso": ("Cada recurso (arquivo) de um conjunto listado tem estado próprio: o recurso capturado com sha256 por uma "
                          "integração declarada herda o estado dessa integração; capturado por outro dataset ou lido por requisição "
                          "parcial está RECURSO VERIFICADO; os demais estão CATALOGADO. Recurso que sumiu da listagem fica como removido "
                          "pela fonte. A tabela completa está em dados_recursos_<órgão>.csv."),
        "compactacao": ("Para caber no limite de tamanho da gold: chave ausente = vazio ou não informado; 'nome' é o trecho do id "
                        "depois de 'órgão:'; url ausente = url_conjunto do portal seguida do nome; licença ausente = a do portal "
                        "(portais.<órgão>.licenca); descontinuado ausente = falso; etapa ausente = não alcançada. Entrada sem "
                        "integração não tem 'etapas': o cadastro está em 'catalogado' (origem; ausente = listagem do portal) e o acesso ao arquivo em "
                        "'verificacao' (etapa recurso verificado; ok ausente = êxito, via ausente = requisição parcial), as "
                        "demais etapas não foram alcançadas; nelas, modificado_na_fonte cede lugar a recursos_resumo."
                        "ultimo_publicado (data dos arquivos). Descrição só nos "
                        "conjuntos integrados (a íntegra de todos está em dados_catalogo.csv); a evidência completa das etapas de "
                        "um conjunto integrado está em publicacao.json (integracoes[].id)."),
        "modelos": {m: st for m, st in sorted(mods.items())},
        "portais": status, "contagem": contagem, "total": len(entradas),
        "descontinuados": sum(1 for e in entradas if e.get("descontinuado")),
        "recursos": {o: {"por_estado": {k: v for k, v in c.items() if v}, "total": sum(c.values()),
                         "removidos": sum(1 for x in todos_recursos if x["orgao"] == o and not x["presente"]),
                         "download": f"/energia/series/dados_recursos_{o.lower()}.csv"}
                     for o, c in sorted(rec_cont.items())},
        "entradas": entradas,
    }


def _com_familia(it):
    """Conjunto de publicacao.json com família e dataset do silver (o id é 'família/dataset')."""
    if it.get("familia") and it.get("dataset_silver"):
        return it
    fam, _, ds = str(it.get("id") or "").partition("/")
    return {**it, "familia": fam or None, "dataset_silver": ds or None}


def _compacta_publicado(e, licencas):
    """Forma publicada de uma entrada (ver 'compactacao' no cabeçalho do catálogo)."""
    if e.get("nome") is not None and e["id"] == f"{e['orgao'].lower()}:{e['nome']}":
        if e.get("url") and e["orgao"] in URL_DATASET and e["url"] == URL_DATASET[e["orgao"]] + e["nome"]:
            e.pop("url")
        e.pop("nome")
    e.pop("n_recursos", None)
    if not e.get("integracoes") and e.get("estado") in ("CATALOGADO", "RECURSO VERIFICADO"):
        # sem integração: a escada para em catalogado ou recurso verificado; as duas etapas
        # viram campos da entrada (origem do cadastro e a verificação do recurso)
        et = e.pop("etapas")
        cat_ = et.get("catalogado") or {}
        if not (cat_.get("ok") and cat_.get("origem") == "listagem" and len(cat_) == 2):
            # ausente = catalogado pela listagem do portal (o caso comum)
            e["catalogado"] = _enxuto({"origem": cat_.get("origem"), "ok": None if cat_.get("ok") else False,
                                       **{k: v for k, v in cat_.items() if k not in ("ok", "origem")}})
        rv = et.get("recurso_verificado")
        if rv:
            # ok ausente = verificação com êxito; via ausente = requisição parcial
            e["verificacao"] = {k: v for k, v in rv.items() if not (k == "ok" and v is True)
                                and not (k == "via" and v == "requisicao_parcial")}
        if (e.get("recursos_resumo") or {}).get("ultimo_publicado"):
            # data de modificação dos metadados do conjunto: a dos arquivos (ultimo_publicado)
            # é a que importa para a atualidade; a íntegra está em dados_catalogo.csv
            e.pop("modificado_na_fonte", None)
    if e.get("licenca") and e.get("licenca") == licencas.get(e["orgao"]):
        e.pop("licenca")
    if not e.get("descontinuado"):
        e.pop("descontinuado", None)
    e.pop("referencia_publicacao", None)
    if e.get("modificado_na_fonte"):
        e["modificado_na_fonte"] = str(e["modificado_na_fonte"])[:10]
    rr = e.get("recursos_resumo")
    if rr and not e.get("integracoes"):
        rr.pop("por_estado", None)
        if not rr.get("acessados"):
            rr.pop("acessados", None)
    for k in ("modelos", "downloads", "paginas", "modulos"):
        if k in e and not e[k]:
            e.pop(k)


def _corta(texto, n=MAX_DESCRICAO):
    t = " ".join(str(texto or "").split())
    if len(t) <= n:
        return t
    corte = t[:n].rsplit(" ", 1)[0]
    return corte.rstrip(",;:.") + "…"


def _etapa_verificacao(v, resumo=None):
    """Etapa 'recurso verificado' de um conjunto sem integração: verificação parcial
    registrada no silver ou recurso baixado com sha256 por algum dataset."""
    if resumo and resumo.get("acessados") and not (v and v.get("resultado") == "ok"):
        return {"ok": True, "via": "captura_outro_dataset", "arquivos": resumo["acessados"]}
    if not v:
        return {"ok": False}
    ok = v.get("resultado") == "ok" and str(v.get("http_status")) in ("200", "206")
    cab = v.get("cabecalho")
    if not ok:
        return _enxuto({"ok": False, "via": "requisicao_parcial", "em": v.get("verificado_em"),
                        "detalhe": str(v.get("detalhe") or v.get("http_status") or "")[:160] or None})
    # status HTTP e tamanho ficam em dados_recursos_<orgao>.csv (verificado_em, tamanho)
    return _enxuto({"ok": True, "via": "requisicao_parcial", "em": v.get("verificado_em"), "recurso": v.get("recurso"),
                    "formato": v.get("formato_detectado"), "colunas": len(cab.split(" | ")) if cab else None})


def ler_verificacoes():
    """{chave: campos} das verificações de recurso vigentes no silver `publicacao`."""
    caminho = os.path.join(base.SILVER, "publicacao.db")
    if not os.path.exists(caminho):
        return {}
    import sqlite3
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)
    try:
        return base.registros_como_estavam_em(con, "verificacao_recursos")
    except sqlite3.Error:
        return {}
    finally:
        con.close()


def ultima_falha_ccee():
    caminho = os.path.join(base.SILVER, "publicacao.db")
    if not os.path.exists(caminho):
        return None
    import sqlite3
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)
    try:
        row = con.execute("SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset='catalogo_ckan_ccee' ORDER BY rowid DESC LIMIT 1").fetchone()
    except sqlite3.Error:
        row = None
    finally:
        con.close()
    if not row:
        return None
    return None if row[1] else f"Última tentativa da listagem em {row[0]}: {row[2]}. Catálogo da CCEE vindo dos package_show versionados."
