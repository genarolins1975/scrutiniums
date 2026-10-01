"""Utilitários da gold de energia: proveniência, estatística descritiva, datas.

A proveniência segue o contrato de docs/observatorios/MODELO_AUDITABILIDADE.md
e o tipo `Proveniencia` de src/lib/energia/tipos.ts.
"""
import math
import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402

NATUREZAS = ("OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO")

NOME_SUBMERCADO = {"SE": "Sudeste/Centro-Oeste", "S": "Sul", "NE": "Nordeste", "N": "Norte",
                   "SIN": "Sistema Interligado Nacional"}
ORDEM_SM = ("SE", "S", "NE", "N")

LICENCA_ONS = "Creative Commons Atribuição (CC-BY), conforme o portal de dados abertos do ONS"
LICENCA_CCEE = "Creative Commons Attribution 4.0 (CC-BY-4.0), conforme o portal de dados abertos da CCEE"


def r(v, casas=2):
    """Arredonda preservando None (ausência não vira zero)."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return round(float(v), casas)


def media(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def desvio_padrao(xs):
    xs = [x for x in xs if x is not None]
    if len(xs) < 2:
        return None
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def quantil(xs, q):
    """Quantil com interpolação linear (tipo 7, o padrão de R e NumPy)."""
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    if len(xs) == 1:
        return xs[0]
    pos = (len(xs) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def percentil_de(valor, xs):
    """Posição percentual de `valor` na distribuição `xs`: fração de valores
    menores + metade dos empates (rank médio), em 0..100."""
    xs = [x for x in xs if x is not None]
    if valor is None or not xs:
        return None
    menores = sum(1 for x in xs if x < valor)
    iguais = sum(1 for x in xs if x == valor)
    return 100.0 * (menores + 0.5 * iguais) / len(xs)


def faixa_por_quartis(p):
    """Regra publicada: abaixo de P25 = faixa baixa; P25 a P75 = central; acima de P75 = alta."""
    if p is None:
        return None
    if p < 25:
        return "baixa"
    if p > 75:
        return "alta"
    return "central"


def d(iso):
    return date.fromisoformat(iso[:10])


def dias(inicio, fim):
    x = inicio
    while x <= fim:
        yield x
        x += timedelta(days=1)


def agrega_diario(pontos_horarios, minimo_horas=24):
    """{dia_iso: média} a partir de [(ref 'AAAA-MM-DDTHH:00', valor)].
    Dia com menos de `minimo_horas` horas não entra (dia incompleto não é média)."""
    por_dia = {}
    for ref, v in pontos_horarios:
        por_dia.setdefault(ref[:10], []).append(v)
    return {k: sum(vs) / len(vs) for k, vs in por_dia.items() if len(vs) >= minimo_horas}


def agrega_mensal(diario, minimo_dias=None):
    """{AAAA-MM: média dos dias} (mês corrente parcial marcado por quem chama)."""
    por_mes = {}
    for k, v in diario.items():
        por_mes.setdefault(k[:7], []).append(v)
    out = {}
    for mes, vs in por_mes.items():
        if minimo_dias and len(vs) < minimo_dias:
            continue
        out[mes] = sum(vs) / len(vs)
    return out


def fonte_ons(dataset_ckan, dataset_s3, titulo):
    return {
        "orgao": "ONS",
        "dataset": titulo,
        "recurso": f"{dataset_s3} (arquivos CSV anuais)",
        "url_dataset": f"https://dados.ons.org.br/dataset/{dataset_ckan}",
        "url_primaria": f"https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/{dataset_s3}/",
        "licenca": LICENCA_ONS,
    }


FONTE_CCEE_PLD = {
    "orgao": "CCEE",
    "dataset": "PLD_HORARIO",
    "recurso": "pld_horario_2021 a pld_horario_2026",
    "url_dataset": "https://dadosabertos.ccee.org.br/dataset/pld_horario",
    "url_primaria": "https://dadosabertos.ccee.org.br/dataset/pld_horario",
    "licenca": LICENCA_CCEE,
}


# Fontes cuja data de modificação do arquivo não acompanha a atualização do conteúdo:
# a data existe no metadado, mas exibi-la como "publicado pela fonte" enganaria.
SEM_DATA_DE_PUBLICACAO_CONFIAVEL = {"ccee_pld_horario"}


def snapshot_de(con, dataset):
    """Identificador e sha256 do conjunto de vintages vigentes do dataset: sha256 dos
    sha256 das capturas mais recentes de cada recurso, em ordem de recurso."""
    import hashlib
    vs = base.vintages_do_dataset(con, dataset)
    ultimo = {}
    for v in vs:
        ultimo[v["recurso"]] = v
    if not ultimo:
        return {"id": None, "sha256": None, "capturas": []}
    h = hashlib.sha256("".join(ultimo[k]["sha256"] for k in sorted(ultimo)).encode()).hexdigest()
    caps = sorted(v["capturado_em"] for v in ultimo.values())
    return {
        "id": f"{dataset}@{caps[-1]}",
        "sha256": h,
        "revisoes": revisoes_do_dataset(con, dataset),
        "publicacao_confiavel": dataset not in SEM_DATA_DE_PUBLICACAO_CONFIAVEL,
        "capturas": [{"recurso": k, "sha256": ultimo[k]["sha256"], "capturado_em": ultimo[k]["capturado_em"],
                      "publicado_em": ultimo[k]["publicado_em"], "origem": ultimo[k]["origem"]}
                     for k in sorted(ultimo)],
        # todas as vintages, inclusive as substituídas por captura posterior do mesmo arquivo
        "historico": [{"recurso": v["recurso"], "sha256": v["sha256"], "capturado_em": v["capturado_em"],
                       "publicado_em": v["publicado_em"], "origem": v["origem"],
                       "vigente": v["sha256"] == ultimo[v["recurso"]]["sha256"]} for v in vs],
    }


def revisoes_do_dataset(con, dataset, limite=20):
    """Revisões detectadas: observações (série, referência) que têm mais de um valor
    entre as vintages integradas. grava_observacoes só grava valor novo ou alterado,
    então cada linha extra de uma mesma (série, referência) é uma revisão da fonte."""
    rows = con.execute(
        """SELECT serie, ref, COUNT(DISTINCT valor) FROM observacoes WHERE dataset=?
           GROUP BY serie, ref HAVING COUNT(DISTINCT valor) > 1 ORDER BY ref DESC, serie""",
        (dataset,),
    ).fetchall()
    vint, recursos, diretas = con.execute(
        "SELECT COUNT(*), COUNT(DISTINCT recurso), SUM(origem='coleta_direta') FROM vintages WHERE dataset=?",
        (dataset,),
    ).fetchone()
    # download bem-sucedido de arquivo idêntico a uma vintage existente não cria vintage,
    # mas é uma comparação feita: cada coleta direta ok gera no máximo uma vintage
    downloads, ultimo = con.execute(
        "SELECT COUNT(*), MAX(tentado_em) FROM coletas WHERE dataset=? AND ok=1", (dataset,)
    ).fetchone()
    return {
        "detectado_em": base.agora_utc(),
        "total": len(rows),
        "vintages_comparadas": vint,
        "arquivos": recursos,
        "recapturas_sem_mudanca": max(0, (downloads or 0) - (diretas or 0)),
        "ultimo_download_ok": ultimo,
        "exemplos": [{"serie": a, "ref": b, "valores": n} for a, b, n in rows[:limite]],
    }


def publicacao_mais_recente(snapshot):
    """Maior data de publicação informada pela fonte entre os arquivos do snapshot."""
    datas = [x.get("publicado_em") for x in snapshot.get("capturas", []) if x.get("publicado_em")]
    return max(datas) if datas else None


def proveniencia(*, indicador, natureza, fonte, unidade, frequencia, periodo, cobertura,
                 capturado_em, snapshot, limitacoes, transformacoes=(), formula=None,
                 publicado_em=None, revisoes=None, download=None, validado_em=None, notas_fonte=None,
                 publicacao_informada=True):
    assert natureza in NATUREZAS, natureza
    if natureza == "CALCULADO":
        assert formula, f"{indicador}: CALCULADO exige fórmula"
    assert limitacoes, f"{indicador}: limitações não podem ser vazias"
    # publicação e revisões vêm do snapshot quando o builder não informa: a fonte
    # informa a data de modificação de cada arquivo e as vintages guardam as revisões
    # publicacao_informada=False: a data de modificação da fonte existe mas não
    # acompanha a atualização do conteúdo (caso do PLD na CCEE); não é exibida
    if publicado_em is None and publicacao_informada and snapshot.get("publicacao_confiavel", True):
        publicado_em = publicacao_mais_recente(snapshot)
    if revisoes is None:
        revisoes = snapshot.get("revisoes")
    return {
        "indicador": indicador,
        "natureza": natureza,
        "fonte": fonte,
        "unidade": unidade,
        "frequencia": frequencia,
        "periodo_referencia": periodo,
        "publicado_pela_fonte_em": publicado_em,
        "capturado_em": capturado_em,
        "validado_em": validado_em or base.agora_utc(),
        "cobertura_historica": cobertura,
        "transformacoes": list(transformacoes),
        "formula": formula,
        "snapshot": {"id": snapshot.get("id"), "sha256": snapshot.get("sha256")},
        "versao_pipeline": base.VERSAO_PIPELINE,
        "versao_codigo": base.versao_codigo(),
        "revisoes_conhecidas": revisoes,
        "limitacoes": list(limitacoes),
        "download": download,
        "notas_fonte": notas_fonte,
    }


def cabecalho(nome, **extra):
    return {"dominio": base.DOMINIO, "gold": nome, "gerado_em": base.agora_utc(),
            "versao_pipeline": base.VERSAO_PIPELINE, "versao_codigo": base.versao_codigo(),
            "disponivel": True, **extra}


def stub(nome, motivo, **extra):
    return {"dominio": base.DOMINIO, "gold": nome, "gerado_em": base.agora_utc(),
            "versao_pipeline": base.VERSAO_PIPELINE, "disponivel": False, "ok": False,
            "motivo": str(motivo)[:300], **extra}


def meta_ons(dataset_s3):
    """Metadados CKAN guardados na última coleta (notas oficiais, licença)."""
    return base.le_gold(f"_meta_{dataset_s3}.json", destino=os.path.join(base.DADOS, "meta")) or {}


def ultima_captura(snapshot):
    caps = [c["capturado_em"] for c in snapshot.get("capturas", [])]
    return max(caps) if caps else None


def dia_semana_pt(iso):
    nomes = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
    return nomes[d(iso).weekday()]


def data_br(iso):
    x = d(iso)
    return f"{x.day:02d}/{x.month:02d}/{x.year}"


def carimbo_br(iso_utc):
    """Instante ISO em UTC ("...Z") → "28/09/2026, 07:55 (Brasília)"; mesmo formato da interface."""
    from datetime import datetime, timedelta, timezone
    try:
        from zoneinfo import ZoneInfo
        fuso = ZoneInfo("America/Sao_Paulo")
    except Exception:  # sem base de fusos: Brasília sem horário de verão desde 2019
        fuso = timezone(timedelta(hours=-3))
    x = datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).astimezone(fuso)
    return f"{x.day:02d}/{x.month:02d}/{x.year}, {x.hour:02d}:{x.minute:02d} (Brasília)"


MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def mes_br(anomes):
    return f"{MESES[int(anomes[5:7]) - 1]}/{anomes[:4]}"


def agora_date():
    return datetime.utcnow().date()


def hoje_brasilia():
    """Data civil corrente em Brasília: é a data de referência que os módulos usam para
    vigências, situação de consultas e ano parcial (o runner do Actions roda em UTC e,
    entre 21h e 24h de Brasília, a data UTC já é o dia seguinte)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    except Exception:  # sem base de fusos: Brasília sem horário de verão desde 2019
        from datetime import timezone
        return (datetime.now(timezone.utc) - timedelta(hours=3)).date()
