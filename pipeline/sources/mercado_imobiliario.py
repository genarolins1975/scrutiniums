"""Informações do Mercado Imobiliário (BCB) — crédito habitacional por UF.

Fonte: Olinda `MercadoImobiliario/versao/v1/odata/mercadoimobiliario`.
Documentação: https://www.bcb.gov.br/content/estatisticas/mercadoimobiliario_docs/Metodologia.pdf

Por que esta fonte existe neste projeto, e o que ela resolve:

O ESTBAN é a única base pública do BCB com crédito imobiliário **municipal**, mas o seu
verbete 169 soma quatro contas COSIF heterogêneas — imóveis residenciais (1.6.4.30),
imóveis **não** residenciais (1.6.4.10), carteiras garantidoras de LIG (1.6.4.40) e
**financiamentos de infraestrutura e desenvolvimento** (1.6.6.10, cuja função contábil
oficial sequer menciona imóveis). Ele também não separa pessoa física de pessoa jurídica,
nem mutuário de construtora. Ver docs/AUDITORIA_MORADIA.md.

Esta publicação oferece exatamente os cortes que faltam ao 169 — residencial, PF/PJ,
segmento de funding (SFH, FGTS, livre, home equity, comercial) — mas a **granularidade
máxima é a unidade da federação**. A metodologia oficial não contém uma única ocorrência
da palavra "município". As duas bases são portanto complementares e não substitutas:
nenhuma série daqui é publicada em nível municipal, e nenhum saldo do ESTBAN é rebatizado
com o nome de um segmento daqui.

Convenção de nomes das séries: `{secao}_{metrica}_{recorte}_{uf}`, com sufixo de duas
letras da UF ou `br` para o total do sistema. Séries com sufixo `_NA` são agregados
nacionais alternativos e não são coletadas.

Defasagem: mensal, divulgação no último dia útil do mês, com 60 dias de atraso na seção
Crédito e 90 dias na seção Imóveis — as duas seções têm data-base mais recente diferente,
e o gold nunca as mistura numa mesma data.
"""
import json

from pipeline import common

BASE = ("https://olinda.bcb.gov.br/olinda/servico/MercadoImobiliario/versao/v1/odata/"
        "mercadoimobiliario")

UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt",
       "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"]
GEO = UFS + ["br"]

# Segmentos de funding do crédito imobiliário, na nomenclatura da própria publicação.
# `sfh` e `fgts` são recursos direcionados (poupança SBPE e FGTS); `livre` é taxa de
# mercado; `home_equity` é crédito com imóvel em garantia, que NÃO financia a compra do
# imóvel; `comercial` é imóvel não residencial. Só os quatro primeiros são habitacionais,
# e home equity é habitacional apenas no sentido da garantia.
SEGMENTOS = ["sfh", "fgts", "livre", "home_equity", "comercial"]

# Radicais coletados. Cada um é combinado com as 28 geografias.
RADICAIS_UF = (
    [f"credito_estoque_carteira_credito_pf_{s}" for s in SEGMENTOS]
    + [f"credito_estoque_inadimplencia_pf_{s}" for s in SEGMENTOS]
    + [f"credito_estoque_ativo_problematico_pf_{s}" for s in SEGMENTOS]
    + [f"credito_estoque_parcela_pf_{s}" for s in SEGMENTOS]
    + [f"credito_contratacao_taxa_pf_{s}" for s in SEGMENTOS]
    + [f"credito_contratacao_ltv_pf_{s}" for s in SEGMENTOS]
    + [f"credito_contratacao_contratado_pf_{s}" for s in SEGMENTOS]
    + [f"credito_estoque_carteira_credito_pj_{s}" for s in ("sfh", "fgts", "livre", "comercial")]
    + [f"credito_contratacao_indexador_pf_{i}" for i in ("ipca", "outros", "prefixado", "tr")]
    + ["imoveis_valor_avaliacao", "imoveis_valor_compra", "imoveis_area_privativa",
       "imoveis_tipo_casa", "imoveis_tipo_apartamento",
       "imoveis_garantia_alienacao_fiduciaria", "imoveis_garantia_hipoteca",
       "imoveis_dormitorio_1", "imoveis_dormitorio_2", "imoveis_dormitorio_3",
       "imoveis_dormitorio_4_mais"]
)

# Direcionamento dos recursos da poupança: só nacional. Apesar de não ter recorte
# territorial, a série leva o sufixo `_br` como todas as outras.
RADICAIS_BR = [f"direcionamento_{d}_{t}_br"
               for d in ("aquisicao", "construcao", "reforma_ampliacao", "aplicacao")
               for t in ("residencial", "comercial", "imobiliario")]

# Unidade de cada família de métrica, para o dicionário de indicadores. A publicação não
# expõe unidade por série, então o mapeamento é declarado aqui e verificado por ordem de
# grandeza no teste de coleta.
UNIDADES = {
    "carteira_credito": "R$", "contratado": "R$", "parcela": "R$",
    "valor_avaliacao": "R$", "valor_compra": "R$",
    "inadimplencia": "%", "ativo_problematico": "%", "taxa": "% a.a.", "ltv": "%",
    "indexador": "%", "area_privativa": "m²",
    "tipo_casa": "unidades", "tipo_apartamento": "unidades",
    "garantia_alienacao_fiduciaria": "unidades", "garantia_hipoteca": "unidades",
    "dormitorio_1": "unidades", "dormitorio_2": "unidades", "dormitorio_3": "unidades",
    "dormitorio_4_mais": "unidades", "direcionamento": "R$",
}


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS mi_serie(
        info TEXT, data TEXT, valor REAL,
        PRIMARY KEY(info, data));
    CREATE TABLE IF NOT EXISTS mi_coleta(
        info TEXT PRIMARY KEY, obs INTEGER, primeira TEXT, ultima TEXT, collected_at TEXT);
    """)


def _num(v):
    """Ausência é nulo, nunca zero — a publicação usa null e string vazia."""
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _baixar_tudo(timeout=900):
    """Baixa o dataset inteiro numa requisição só.

    Três coisas foram medidas antes de escrever isto: o filtro OData por lista de nomes
    estoura o limite de URL (são mais de mil séries alvo); `substringof` devolve HTTP 400
    neste endpoint; e **`$skip` devolve HTTP 500 para qualquer valor, inclusive zero** —
    paginar é impossível. A requisição única de ~48 MB responde em cerca de 20 segundos e
    é, na prática, o único caminho que funciona.
    """
    url = f"{BASE}?$top=1000000&$select=Info,Data,Valor&$format=json"
    body, meta = common.http_get(url, timeout=timeout)
    return json.loads(body).get("value", []), meta


def collect(con, cfg=None):
    _ensure(con)
    alvo = {f"{r}_{g}" for r in RADICAIS_UF for g in GEO} | set(RADICAIS_BR)
    try:
        linhas, meta = _baixar_tudo()
    except Exception as e:
        return [{"key": "mercado_imobiliario", "ok": False, "error": str(e)[:300]}]

    _, sha = common.save_bronze(
        "mercado_imobiliario", "series",
        json.dumps({"n": len(linhas)}).encode("utf-8"), {**meta, "url": BASE})

    guardadas, por_info = 0, {}
    for r in linhas:
        info = r.get("Info")
        if info not in alvo:
            continue
        v = _num(r.get("Valor"))
        if v is None:
            continue
        data = str(r.get("Data"))[:10]
        con.execute("INSERT OR REPLACE INTO mi_serie VALUES(?,?,?)", (info, data, v))
        guardadas += 1
        a = por_info.setdefault(info, [data, data])
        a[0] = min(a[0], data)
        a[1] = max(a[1], data)

    agora = common.now_utc()
    for info, (p, u) in por_info.items():
        n = con.execute("SELECT COUNT(*) FROM mi_serie WHERE info=?", (info,)).fetchone()[0]
        con.execute("INSERT OR REPLACE INTO mi_coleta VALUES(?,?,?,?,?)", (info, n, p, u, agora))
    con.commit()

    common.record_lineage(
        con, "moradia.json", "bronze/mercado_imobiliario/series", sha,
        "BCB Informações do Mercado Imobiliário -> crédito habitacional por UF "
        "(residencial/PF, segmentos SFH, FGTS, livre, home equity e comercial)")

    faltando = sorted(alvo - set(por_info))
    return [{"key": "mercado_imobiliario", "ok": True,
             "series_no_dataset": len({r.get("Info") for r in linhas}),
             "series_coletadas": len(por_info), "observacoes": guardadas,
             "series_sem_dado": len(faltando), "exemplos_sem_dado": faltando[:8]}]
