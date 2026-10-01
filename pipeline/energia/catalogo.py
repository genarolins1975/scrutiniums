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

Fontes: listagem package_search do ONS e da ANEEL (colhida e versionada pelo módulo
dados em data/energia/silver/publicacao.db), package_show da CCEE versionados em
pipeline/energia/seed (o portal responde 403 a este ambiente), REGISTRO dos módulos
(pipeline/energia/modulos) e o relatório de validação da gold publicacao.json.
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
SEEDS_CCEE = (
    ("ccee_pld_horario", "package_show.json"),
    ("ccee_documentos", "package_show_pld_horario_submercado.json"),
    ("ccee_documentos", "package_show_sumario_be_horario_submercado.json"),
    ("ccee_documentos", "package_show_sumario_mensal_compra_venda_submercado.json"),
)


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
    out = []
    for pasta, arquivo in SEEDS_CCEE:
        raiz = os.path.join(base.SEED, pasta)
        if not os.path.isdir(raiz):
            continue
        for versao in sorted(os.listdir(raiz)):
            caminho = os.path.join(raiz, versao, arquivo)
            if os.path.exists(caminho):
                with open(caminho, "rb") as f:
                    corpo = f.read()
                pkg = json.loads(corpo.decode("utf-8"))["result"]
                m = re.match(r"v(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z", versao)
                cap = f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{m.group(6)}Z" if m else None
                out.append({**pkg, "_seed": {"arquivo": os.path.relpath(caminho, base.RAIZ), "sha256": base.sha256_bytes(corpo),
                                              "capturado_em": cap}})
    return out


def _formatos(pkg):
    return sorted({(r.get("format") or "").upper() for r in pkg.get("resources", []) if r.get("format")})


def construir(brutos, publicacao=None, verificacoes=None):
    """Catálogo publicado em catalogo.json. `publicacao` é a gold publicacao.json (lida
    do disco quando omitida): traz o estado de cada integração com as evidências e o
    relatório de validação. `verificacoes`: {chave: resultado} das verificações de
    recurso (lidas do silver `publicacao` quando omitidas)."""
    from pipeline.energia.fontes import ckan_dados as ck
    if publicacao is None:
        publicacao = base.le_gold("publicacao.json") or {}
    if verificacoes is None:
        verificacoes = ler_verificacoes()
    por_integracao = {}
    for it in (publicacao.get("conjuntos") or []):
        por_integracao.setdefault((it.get("orgao"), it.get("nome")), []).append(it)
    mods = estados_modelos()
    entradas, status = [], {}
    presentes = set()

    def entrada_base(orgao, pkg, *, verificado=True, origem_catalogo, catalogado_em):
        nome = pkg.get("name")
        ex = ck.extras(pkg)
        desc = ck.descontinuacao(pkg, ex)
        notas = (pkg.get("notes") or "").split("-----")[0].strip()
        return {
            "id": f"{orgao.lower()}:{nome}", "slug": None, "orgao": orgao, "nome": nome, "titulo": pkg.get("title"),
            "url": URL_DATASET.get(orgao, "") + nome if orgao in URL_DATASET else None,
            "licenca": pkg.get("license_title") or pkg.get("license_id"), "modificado_na_fonte": pkg.get("metadata_modified"),
            "descricao": notas[:600], "n_recursos": pkg.get("num_resources") or len(pkg.get("resources", [])),
            "formatos": _formatos(pkg), "tema": tema(nome or "", pkg.get("title") or ""),
            "frequencia_declarada": ex["frequencia_declarada"], "campo_frequencia": ex["campo_frequencia"],
            "referencia_publicacao": ex["referencia_publicacao"],
            "metadados_verificados": verificado, "descontinuado": bool(desc), "descontinuacao": desc,
            "etapas": {"catalogado": {"ok": True, "evidencia": origem_catalogo, "em": catalogado_em}},
        }

    for orgao in ("ONS", "ANEEL", "CCEE"):
        b = brutos.get(orgao) or {}
        res = b.get("resultado") or []
        for pkg in res:
            e = entrada_base(orgao, pkg, origem_catalogo=f"Listagem package_search da API CKAN ({orgao}) colhida pelo pipeline",
                             catalogado_em=b.get("colhido_em"))
            entradas.append(e)
            presentes.add((orgao, pkg.get("name")))
        if orgao != "CCEE" or res:
            status[orgao] = {"colhido_em": b.get("colhido_em"), "conjuntos": len(res), "erro": b.get("erro"),
                             "origem": "API CKAN package_search"}
    if not (brutos.get("CCEE") or {}).get("resultado"):
        seeds = pacotes_seed_ccee()
        for pkg in seeds:
            s = pkg["_seed"]
            e = entrada_base("CCEE", pkg, origem_catalogo=(f"package_show versionado em {s['arquivo']} (sha256 {s['sha256'][:12]}…), "
                                                           f"capturado em {s['capturado_em']}"), catalogado_em=s["capturado_em"])
            e["recursos"] = [{"nome": r.get("name"), "formato": (r.get("format") or "").upper() or None, "url": r.get("url"),
                              "publicado_em": r.get("last_modified"), "estado": "CATALOGADO", "capturas": 0}
                             for r in pkg.get("resources", [])]
            entradas.append(e)
            presentes.add(("CCEE", pkg.get("name")))
        erro_ccee = (brutos.get("CCEE") or {}).get("erro") or ultima_falha_ccee()
        status["CCEE"] = {"colhido_em": None, "conjuntos": len(seeds), "erro": erro_ccee,
                          "origem": "package_show versionados no repositório (pipeline/energia/seed), recurso a recurso",
                          "seed_capturado_em": sorted({p["_seed"]["capturado_em"] for p in seeds})}
    # conjuntos integrados fora das listagens (IBGE, CVM, EPE, MCTI, NASA, atos normativos)
    for it in integracoes():
        chave = (it["orgao"], it["nome"])
        if chave in presentes:
            continue
        presentes.add(chave)
        entradas.append({
            "id": f"{it['orgao'].lower()}:{it['nome']}", "slug": None, "orgao": it["orgao"], "nome": it["nome"],
            "titulo": it.get("titulo"), "url": it.get("url"), "licenca": it.get("licenca"), "modificado_na_fonte": None,
            "descricao": (it.get("descricao") or "")[:600], "n_recursos": None, "formatos": it.get("formatos") or [],
            "tema": it.get("tema") or tema(it["nome"], it.get("titulo") or ""), "frequencia_declarada": it.get("frequencia"),
            "campo_frequencia": "REGISTRO do módulo" if it.get("frequencia") else None, "referencia_publicacao": None,
            "metadados_verificados": True, "descontinuado": bool(it.get("descontinuado")),
            "descontinuacao": {"motivo": "declarado pelo módulo", "evidencia": it.get("estado_declarado")} if it.get("descontinuado") else None,
            "etapas": {"catalogado": {"ok": bool(it.get("url") and it.get("licenca")),
                                      "evidencia": f"REGISTRO do módulo {it['modulo']}: URL e licença declaradas na integração",
                                      "em": None}},
        })
    # integrações: etapas vindas da gold publicacao.json (uma linha por dataset do silver)
    regs = {}
    for it in integracoes():
        regs.setdefault((it["orgao"], it["nome"]), []).append(it)
    for e in entradas:
        chave = (e["orgao"], e["nome"])
        lista = por_integracao.get(chave) or []
        declaradas = regs.get(chave) or []
        e["integracoes"] = [{"slug": x.get("slug"), "dataset_silver": x.get("dataset_silver"), "familia": x.get("familia"),
                             "modulos": x.get("modulos"), "estado": x.get("estado")} for x in lista]
        if declaradas and not lista:
            e["integracoes"] = [{"slug": d.get("slug"), "dataset_silver": d.get("dataset_silver"), "familia": d.get("familia"),
                                 "modulos": [d["modulo"]], "estado": None} for d in declaradas]
        ets = dict(e["etapas"])
        if lista:
            melhor = max(lista, key=lambda x: ESTADOS.index(x.get("estado") or "CATALOGADO"))
            for nome in ETAPAS[1:]:
                ets[nome] = (melhor.get("etapas") or {}).get(nome) or {"ok": False, "evidencia": None}
            e["ressalvas"] = sorted({r for x in lista for r in (x.get("ressalvas") or [])})
        else:
            v = verificacoes.get(f"{e['orgao']}:{e['nome']}")
            ets["recurso_verificado"] = _etapa_verificacao(v)
            for nome in ETAPAS[2:]:
                ets[nome] = {"ok": False, "evidencia": None}
            e["ressalvas"] = []
            if declaradas:
                e["ressalvas"].append("Declarado no REGISTRO de módulo, mas sem estado calculado nesta publicação (gold publicacao.json ausente ou anterior à declaração).")
        e["etapas"] = ets
        e["estado"] = estado_por_etapas(ets)
        e["ressalvas"] = e.get("ressalvas", []) + saltos(ets)
        golds = sorted({g for d in declaradas for g in d.get("golds", [])})
        paginas = []
        for d in declaradas:
            for p in d.get("paginas", []):
                if p not in paginas:
                    paginas.append(p)
        modelos = sorted({m for d in declaradas for m in d.get("modelos", [])})
        e["uso"] = {"papeis": sorted({papel(d.get("estado_declarado")) for d in declaradas}),
                    "declarado": sorted({d.get("estado_declarado") for d in declaradas if d.get("estado_declarado")}),
                    "golds": golds, "paginas": paginas,
                    "modelos": [{"codigo": m, "estado": mods.get(m)} for m in modelos]}
        # compatibilidade com leitores anteriores (página inicial, datasets.ts)
        e["usado_em"] = golds if e["estado"] != "CATALOGADO" else []
        e["modelos"] = modelos
        e["quebras"] = [q for d in declaradas for q in d.get("quebras", [])] or QUEBRAS.get(chave, [])
        primeira = (lista or declaradas or [{}])[0]
        e["slug"] = primeira.get("slug")
        e["interno"] = primeira.get("dataset_silver")
        e["familia"] = primeira.get("familia")
        e["paginas"] = paginas
        e["downloads"] = sorted({u for d in declaradas for u in d.get("downloads", [])})
        if e.get("recursos"):
            _estado_recursos_ccee(e, lista)
    with open(os.path.join(AQUI, "catalogo_manual.json"), encoding="utf-8") as f:
        for m in json.load(f)["entradas"]:
            v = verificacoes.get(f"MANUAL:{m['id']}")
            entradas.append({**m, "estado": "CATALOGADO", "usado_em": [], "modelos": [], "quebras": [], "metadados_verificados": False,
                             "descontinuado": False, "descontinuacao": None, "slug": None, "integracoes": [], "ressalvas": [],
                             "frequencia_declarada": None, "campo_frequencia": None, "referencia_publicacao": None,
                             "uso": {"papeis": [], "declarado": [], "golds": [], "paginas": [], "modelos": []},
                             "etapas": {"catalogado": {"ok": True, "evidencia": "Cadastro manual em pipeline/energia/catalogo_manual.json (metadados não verificados na fonte)", "em": None},
                                        "recurso_verificado": {"ok": False, "evidencia": None}, "integrado": {"ok": False, "evidencia": None},
                                        "validado": {"ok": False, "evidencia": None}, "publicado": {"ok": False, "evidencia": None}},
                             "endereco_verificado": ({"http_status": v.get("http_status"), "resultado": v.get("resultado"),
                                                      "verificado_em": v.get("verificado_em"), "detalhe": v.get("detalhe")} if v else None)})
    entradas.sort(key=lambda e: (-ESTADOS.index(e["estado"]), e["orgao"], e.get("titulo") or ""))
    contagem = {s: 0 for s in ESTADOS}
    for e in entradas:
        contagem[e["estado"]] += 1
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
        "portais": status, "contagem": contagem, "total": len(entradas),
        "descontinuados": sum(1 for e in entradas if e.get("descontinuado")),
        "entradas": entradas,
    }


def _etapa_verificacao(v):
    if not v:
        return {"ok": False, "evidencia": None}
    ok = v.get("resultado") == "ok" and str(v.get("http_status")) in ("200", "206")
    cab = v.get("cabecalho")
    return {"ok": ok, "em": v.get("verificado_em"),
            "evidencia": (f"Recurso {v.get('recurso')!r} lido por requisição parcial: HTTP {v.get('http_status')}, formato "
                          f"{v.get('formato_detectado')}" + (f", {len(cab.split(' | '))} colunas no cabeçalho" if cab else "")
                          + (f", {int(v['bytes_total']):,} bytes".replace(",", ".") if str(v.get("bytes_total") or "").isdigit() else ""))
            if ok else f"Verificação sem êxito: {v.get('detalhe') or v.get('http_status')}",
            "recurso": v.get("recurso"), "url": v.get("url"), "formato_detectado": v.get("formato_detectado"),
            "cabecalho": cab.split(" | ") if cab else None}


def _estado_recursos_ccee(e, integracoes_):
    """CCEE recurso a recurso: o recurso com capturas no silver herda o estado da integração."""
    caps = {}
    for it in integracoes_:
        for r, n in (it.get("recursos_capturados") or {}).items():
            caps[r] = (n, it.get("estado"))
    for r in e["recursos"]:
        if r["nome"] in caps:
            r["capturas"], r["estado"] = caps[r["nome"]][0], caps[r["nome"]][1]


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
