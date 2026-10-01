"""Leitura dos silvers do domínio Energia para a página Dados e metodologia (módulo dados).

Por que existe: a saúde de um conjunto (P068) e o estado "integrado" e "validado" do
catálogo (P067) precisam ser derivados do que o pipeline realmente guardou, e não do
que cada módulo declara. Este arquivo lê, só para leitura, os bancos
data/energia/silver/*.db (o principal, energia.db, e um por família de fontes) e
devolve, por conjunto (dataset do silver):

* capturas (vintages) e o histórico de tentativas de coleta, sem nunca confundir
  tentativa com dado: a data do dado é a maior referência observada, e uma falha de
  coleta não a renova;
* grão temporal observado das referências, cobertura e completude interna de cada
  série (referências presentes ÷ esperadas entre a primeira e a última, no passo
  modal da própria série), e quantas séries chegaram ao último período;
* revisões da fonte com magnitude e alcance (quantas referências mudaram, em quantas
  séries, entre quais períodos, maior mudança absoluta e relativa, por captura);
* horizonte: referência posterior à data da captura que a trouxe (dado observado não
  vem do futuro);
* integridade do original no bronze (arquivo presente, sha256 recalculado) e drift
  do cabeçalho entre capturas do mesmo recurso.

Memória: tudo é agregado em fluxo a partir de cursores SQLite; nenhuma tabela é
carregada inteira. Abertura em modo somente leitura (mode=ro): os silvers são de
outros módulos e podem estar sendo escritos em paralelo.
"""
import gzip
import hashlib
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402

BRASILIA = timezone(timedelta(hours=-3))
FAMILIA_PRINCIPAL = "energia"  # data/energia/silver/energia.db (ONS e CCEE originais)

# Formatos de referência encontrados nos silvers (levantados em 01/10/2026 em todos os
# bancos). A ordem importa: o primeiro padrão que casa define o formato.
FORMATOS = (
    ("horaria", re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})")),
    ("intervalo", re.compile(r"^(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2})$")),
    ("vigencia", re.compile(r"^(\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})?\|")),
    ("diaria", re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")),
    ("mensal", re.compile(r"^(\d{4})-(\d{2})$")),
    ("trimestral", re.compile(r"^(\d{4})-?[QT]([1-4])$")),
    ("anual", re.compile(r"^(\d{4})$")),
)
# Formatos com passo regular, em que completude interna faz sentido.
REGULARES = ("horaria", "diaria", "mensal", "trimestral", "anual")
# Arquivo comprimido do bronze acima disto: confere-se presença e tamanho, sem
# recalcular o sha256 em toda execução (custo de CPU proporcional ao original).
LIMITE_HASH_BYTES = 64 * 1024 * 1024
LIMITE_EVENTOS_REVISAO = 300


def caminho_silver(familia):
    return os.path.join(base.SILVER, f"{familia}.db")


def familias_disponiveis():
    """Famílias com banco presente no disco (sem a extensão), em ordem alfabética."""
    if not os.path.isdir(base.SILVER):
        return []
    return sorted(n[:-3] for n in os.listdir(base.SILVER) if n.endswith(".db"))


def abre(familia):
    """Conexão somente leitura ao silver da família, ou None se o banco não existe.
    O modo ro impede escrita acidental num banco de outro módulo; o WAL pendente de
    uma escrita interrompida é lido normalmente pelo SQLite."""
    p = caminho_silver(familia)
    if not os.path.exists(p):
        return None
    con = sqlite3.connect(f"file:{p}?mode=ro", uri=True, timeout=60)
    return con


def datasets_no_silver(con):
    """{dataset: {'vintages': n, 'observacoes': bool, 'registros': bool}} de um banco."""
    out = {}
    for ds, n in con.execute("SELECT dataset, COUNT(*) FROM vintages GROUP BY dataset"):
        out[ds] = {"vintages": n}
    for (ds,) in con.execute("SELECT DISTINCT dataset FROM observacoes"):
        out.setdefault(ds, {"vintages": 0})["observacoes"] = True
    for (ds,) in con.execute("SELECT DISTINCT dataset FROM registros"):
        out.setdefault(ds, {"vintages": 0})["registros"] = True
    return out


# ---------------------------------------------------------------- referências


def formato_ref(ref):
    for nome, rx in FORMATOS:
        if rx.match(ref):
            return nome
    return "nao_temporal"


def inicio_ref(ref, formato=None):
    """Data de início do período de uma referência (None se não temporal)."""
    formato = formato or formato_ref(ref)
    try:
        if formato == "horaria":
            return date(int(ref[:4]), int(ref[5:7]), int(ref[8:10]))
        if formato in ("diaria", "intervalo", "vigencia"):
            return date.fromisoformat(ref[:10])
        if formato == "mensal":
            return date(int(ref[:4]), int(ref[5:7]), 1)
        if formato == "trimestral":
            m = FORMATOS[5][1].match(ref)
            return date(int(m.group(1)), 3 * (int(m.group(2)) - 1) + 1, 1)
        if formato == "anual":
            return date(int(ref), 1, 1)
    except ValueError:
        return None
    return None


def fim_ref(ref, formato=None, passo=None):
    """Último dia do período de uma referência (None se não temporal). Para a vigência
    e o intervalo, é a data final declarada; para série regular, o fim do passo."""
    formato = formato or formato_ref(ref)
    ini = inicio_ref(ref, formato)
    if ini is None:
        return None
    if formato == "horaria":
        return ini
    if formato == "diaria":
        return ini + timedelta(days=max(1, (passo or 1)) - 1)
    if formato == "intervalo":
        return date.fromisoformat(ref[11:21])
    if formato == "vigencia":
        m = FORMATOS[2][1].match(ref)
        return date.fromisoformat(m.group(2)) if m.group(2) else None
    if formato == "mensal":
        return _soma_meses(ini, max(1, passo or 1)) - timedelta(days=1)
    if formato == "trimestral":
        return _soma_meses(ini, 3) - timedelta(days=1)
    if formato == "anual":
        return date(ini.year + max(1, passo or 1) - 1, 12, 31)
    return None


def _soma_meses(d, n):
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def _indice(ref, formato):
    """Posição ordinal de uma referência no eixo do seu formato (para medir passos)."""
    if formato == "horaria":
        dt = datetime(int(ref[:4]), int(ref[5:7]), int(ref[8:10]), int(ref[11:13]), int(ref[14:16]))
        return int(dt.timestamp() // 60)  # minutos; a referência é hora local, sem fuso
    if formato == "diaria":
        return date.fromisoformat(ref).toordinal()
    if formato == "mensal":
        return int(ref[:4]) * 12 + int(ref[5:7]) - 1
    if formato == "trimestral":
        m = FORMATOS[5][1].match(ref)
        return int(m.group(1)) * 4 + int(m.group(2)) - 1
    if formato == "anual":
        return int(ref)
    raise ValueError(formato)


UNIDADE_PASSO = {"horaria": "minutos", "diaria": "dias", "mensal": "meses", "trimestral": "trimestres", "anual": "anos"}


def granularidade_rotulo(formato, passo):
    if formato == "horaria":
        return {60: "horária", 30: "semi-horária", 15: "15 minutos", 10: "10 minutos"}.get(passo, f"a cada {passo} minutos")
    if formato == "diaria":
        return {1: "diária", 7: "semanal"}.get(passo, f"a cada {passo} dias")
    if formato == "mensal":
        return {1: "mensal", 3: "trimestral", 12: "anual"}.get(passo, f"a cada {passo} meses")
    if formato == "trimestral":
        return "trimestral"
    if formato == "anual":
        return "anual" if passo == 1 else f"a cada {passo} anos"
    return {"intervalo": "períodos com início e fim", "vigencia": "vigências", "nao_temporal": "sem referência temporal"}.get(formato, formato)


def passo_modal(refs, formato):
    """Passo mais frequente entre referências consecutivas distintas (ordenadas) e a
    fração dos intervalos que o seguem. Passo modal fraco (< 50%) = cadência irregular."""
    idx = sorted({_indice(r, formato) for r in refs})
    if len(idx) < 2:
        return None, None
    gaps = Counter(b - a for a, b in zip(idx, idx[1:]))
    passo, n = gaps.most_common(1)[0]
    return passo, n / (len(idx) - 1)


# ---------------------------------------------------------------- coletas e vintages


def resumo_coletas(con, dataset):
    """Tentativas de coleta do dataset: totais, última tentativa, último êxito, última
    falha e a maior sequência final de falhas de um mesmo recurso. A data de uma
    tentativa nunca vira data do dado."""
    linhas = con.execute(
        "SELECT recurso, tentado_em, ok, detalhe FROM coletas WHERE dataset=? ORDER BY tentado_em, rowid", (dataset,)
    ).fetchall()
    if not linhas:
        return {"tentativas": 0, "ok": 0, "falhas": 0, "ultima_tentativa": None, "ultimo_ok": None,
                "ultima_falha": None, "falhas_consecutivas": 0, "recurso_em_falha": None}
    ok = sum(1 for x in linhas if x[2])
    ultima = linhas[-1]
    ult_ok = next((x for x in reversed(linhas) if x[2]), None)
    ult_falha = next((x for x in reversed(linhas) if not x[2]), None)
    seq = defaultdict(int)
    for rec, _, okx, _ in linhas:
        seq[rec] = 0 if okx else seq[rec] + 1
    pior = max(seq.items(), key=lambda kv: kv[1])
    return {
        "tentativas": len(linhas), "ok": ok, "falhas": len(linhas) - ok,
        "ultima_tentativa": {"recurso": ultima[0], "tentado_em": ultima[1], "ok": bool(ultima[2]), "detalhe": (ultima[3] or "")[:200]},
        "ultimo_ok": ult_ok[1] if ult_ok else None,
        "ultima_falha": ({"recurso": ult_falha[0], "tentado_em": ult_falha[1], "detalhe": (ult_falha[3] or "")[:200]}
                         if ult_falha else None),
        "falhas_consecutivas": pior[1], "recurso_em_falha": pior[0] if pior[1] else None,
    }


def vintages(con, dataset):
    return base.vintages_do_dataset(con, dataset)


def coletas_por_dia(con, dataset):
    """{dia UTC: [tentativas ok, falhas]} do log de coletas (calendário de atualização)."""
    out = {}
    for dia, ok, n in con.execute(
        "SELECT substr(tentado_em, 1, 10), ok, COUNT(*) FROM coletas WHERE dataset=? GROUP BY 1, 2", (dataset,)
    ):
        par = out.setdefault(dia, [0, 0])
        par[0 if ok else 1] += n
    return out


def resumo_vintages(vs):
    """Capturas por recurso: vigente (mais recente), anteriores preservadas, publicação
    informada pela fonte (last_modified do CKAN, quando há)."""
    por_rec = defaultdict(list)
    for v in vs:
        por_rec[v["recurso"]].append(v)
    caps = sorted(v["capturado_em"] for v in vs)
    pubs = sorted(v["publicado_em"] for v in vs if v.get("publicado_em"))
    return {
        "n": len(vs), "recursos": len(por_rec),
        "recursos_com_anterior": sum(1 for x in por_rec.values() if len(x) > 1),
        "primeira_captura": caps[0] if caps else None,
        "ultima_captura": caps[-1] if caps else None,
        "ultima_publicacao_fonte": pubs[-1] if pubs else None,
        "origens": dict(Counter(v["origem"] for v in vs)),
    }


# ---------------------------------------------------------------- observações


def series_e_refs(con, dataset):
    """[(serie, min_ref, max_ref, n_refs_distintas)] em fluxo (índice dataset, serie, ref)."""
    return con.execute(
        "SELECT serie, MIN(ref), MAX(ref), COUNT(DISTINCT ref) FROM observacoes WHERE dataset=? GROUP BY serie",
        (dataset,),
    )


GLOB_FORMATO = {
    "horaria": "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*",
    "diaria": "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]",
    "mensal": "[0-9][0-9][0-9][0-9]-[0-9][0-9]",
    "anual": "[0-9][0-9][0-9][0-9]",
    "intervalo": "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/*",
}


def limite_hoje(formato, hoje):
    """Maior referência possível até `hoje` no formato (comparação lexicográfica)."""
    if formato == "horaria":
        return f"{hoje.isoformat()}T23:59"
    if formato in ("diaria",):
        return hoje.isoformat()
    if formato == "intervalo":
        return f"{hoje.isoformat()}/9999-12-31"
    if formato == "mensal":
        return hoje.isoformat()[:7]
    if formato == "anual":
        return str(hoje.year)
    return None


def completude(con, dataset, hoje=None):
    """Grão, cobertura e completude interna das séries do dataset, por formato de
    referência. Completude interna de uma série = referências distintas presentes ÷
    esperadas entre a primeira e a última no passo modal do grupo; ela não acusa série
    que começou depois ou terminou antes (usina nova, distribuidora extinta), só
    lacuna no meio. A cobertura do último período conta quantas séries do grupo têm
    valor na maior referência e na anterior a ela."""
    grupos = defaultdict(list)
    n_linhas = con.execute("SELECT COUNT(*) FROM observacoes WHERE dataset=?", (dataset,)).fetchone()[0]
    for serie, mn, mx, n in series_e_refs(con, dataset):
        f1, f2 = formato_ref(mn), formato_ref(mx)
        grupos[f1 if f1 == f2 else "misto"].append((serie, mn, mx, n))
    if not grupos:
        return {"linhas": 0, "series": 0, "grupos": [], "principal": None}
    saida = []
    for formato, series in grupos.items():
        g = {"formato": formato, "series": len(series), "ref_min": min(s[1] for s in series),
             "ref_max": max(s[2] for s in series), "refs_presentes": sum(s[3] for s in series)}
        if formato in REGULARES:
            maior = max(series, key=lambda s: s[3])
            refs = [r for (r,) in con.execute(
                "SELECT DISTINCT ref FROM observacoes WHERE dataset=? AND serie=? ORDER BY ref", (dataset, maior[0]))]
            passo, aderencia = passo_modal(refs, formato)
            g["passo"] = passo
            g["unidade_passo"] = UNIDADE_PASSO[formato]
            g["aderencia_passo"] = round(aderencia, 4) if aderencia is not None else None
            g["granularidade"] = granularidade_rotulo(formato, passo) if passo else granularidade_rotulo(formato, 1)
            if passo and aderencia is not None and aderencia >= 0.5:
                esperadas = 0
                completas = 0
                lacunas = []
                for serie, mn, mx, n in series:
                    exp = (_indice(mx, formato) - _indice(mn, formato)) // passo + 1
                    exp = max(exp, 1)
                    esperadas += exp
                    if n >= exp:
                        completas += 1
                    else:
                        lacunas.append((serie, exp - n, exp))
                lacunas.sort(key=lambda x: (-x[1], x[0]))
                g["refs_esperadas"] = esperadas
                g["completude_interna"] = round(min(1.0, g["refs_presentes"] / esperadas), 6) if esperadas else None
                g["series_completas"] = completas
                g["series_com_lacuna"] = len(series) - completas
                g["piores"] = [{"serie": s, "faltam": f, "esperadas": e} for s, f, e in lacunas[:5]]
                # cobertura do último período: séries com valor na última referência
                # e na referência anterior (pelo passo), no mesmo grupo
                ult = g["ref_max"]
                ant = _ref_anterior(ult, formato, passo)
                g["ultimo_periodo"] = ult
                g["series_no_ultimo"] = con.execute(
                    "SELECT COUNT(DISTINCT serie) FROM observacoes WHERE dataset=? AND ref=?", (dataset, ult)).fetchone()[0]
                g["periodo_anterior"] = ant
                g["series_no_anterior"] = con.execute(
                    "SELECT COUNT(DISTINCT serie) FROM observacoes WHERE dataset=? AND ref=?", (dataset, ant)).fetchone()[0] if ant else None
            else:
                g["granularidade"] = "cadência irregular" if passo else g["granularidade"]
                g["completude_interna"] = None
        else:
            g["granularidade"] = granularidade_rotulo(formato, None)
            g["completude_interna"] = None
        # último período disponível até hoje: referência futura (limite regulatório de
        # ano seguinte, programação do dia seguinte) não é dado observado disponível
        lim = limite_hoje(formato, hoje) if hoje else None
        if lim and formato in GLOB_FORMATO:
            g["ref_max_ate_hoje"] = con.execute(
                "SELECT MAX(ref) FROM observacoes WHERE dataset=? AND ref <= ? AND ref GLOB ?",
                (dataset, lim, GLOB_FORMATO[formato])).fetchone()[0]
        else:
            g["ref_max_ate_hoje"] = None
        saida.append(g)
    saida.sort(key=lambda g: (-g["refs_presentes"], g["formato"]))
    principal = next((g for g in saida if g["formato"] in REGULARES), saida[0])
    return {"linhas": n_linhas, "series": sum(g["series"] for g in saida), "grupos": saida,
            "principal": principal["formato"]}


def _ref_anterior(ref, formato, passo):
    try:
        if formato == "diaria":
            return (date.fromisoformat(ref) - timedelta(days=passo)).isoformat()
        if formato == "mensal":
            i = _indice(ref, formato) - passo
            return f"{i // 12:04d}-{i % 12 + 1:02d}"
        if formato == "anual":
            return str(int(ref) - passo)
        if formato == "horaria":
            dt = datetime(int(ref[:4]), int(ref[5:7]), int(ref[8:10]), int(ref[11:13]), int(ref[14:16]))
            return (dt - timedelta(minutes=passo)).strftime("%Y-%m-%dT%H:%M") + ref[16:]
        if formato == "trimestral":
            i = _indice(ref, formato) - passo
            sep = "-" if "-" in ref else ""
            letra = "Q" if "Q" in ref else "T"
            return f"{i // 4:04d}{sep}{letra}{i % 4 + 1}"
    except ValueError:
        return None
    return None


def revisoes(con, dataset, limite_eventos=LIMITE_EVENTOS_REVISAO):
    """Revisões da fonte com magnitude e alcance. Uma revisão é a troca de valor de uma
    mesma (série, referência) entre duas capturas consecutivas DO MESMO RECURSO (arquivo);
    valores iguais em capturas seguidas (restauração de vintage importada fora de ordem)
    não contam. A mesma (série, referência) em arquivos diferentes com valores diferentes
    (arquivos anuais que se sobrepõem, por exemplo) não é revisão: é conflito entre
    recursos, contado à parte com exemplos.

    Devolve contagens exatas e os maiores eventos (por mudança relativa e absoluta);
    `por_captura` dá o calendário de revisões (dia da captura que trouxe o valor novo)."""
    cur = con.execute(
        """WITH rev AS (SELECT serie, ref FROM observacoes WHERE dataset=? GROUP BY serie, ref HAVING COUNT(*) > 1)
           SELECT o.serie, o.ref, o.valor, v.capturado_em, v.recurso
           FROM rev JOIN observacoes o ON o.dataset=? AND o.serie=rev.serie AND o.ref=rev.ref
           JOIN vintages v ON v.vintage_id=o.vintage_id
           ORDER BY o.serie, o.ref, v.recurso, v.capturado_em, o.rowid""",
        (dataset, dataset),
    )
    n_eventos = 0
    chaves = set()
    series = set()
    ref_min = ref_max = None
    maior_abs = maior_rel = None
    de_zero = 0
    por_captura = Counter()
    eventos = []
    conflitos, exemplos_conflito = 0, []
    atual_chave, ant = None, None
    atual_sr, ultimos = None, {}

    def fecha_conflito():
        nonlocal conflitos
        if len(ultimos) > 1 and max(ultimos.values()) - min(ultimos.values()) > 1e-9:
            conflitos += 1
            if len(exemplos_conflito) < 5:
                exemplos_conflito.append({"serie": atual_sr[0], "ref": atual_sr[1],
                                          "valores": {r: v for r, v in sorted(ultimos.items())}})

    for serie, ref, valor, cap, rec in cur:
        if (serie, ref) != atual_sr:
            if atual_sr is not None:
                fecha_conflito()
            atual_sr, ultimos = (serie, ref), {}
        ultimos[rec] = valor
        chave = (serie, ref, rec)
        if chave != atual_chave:
            atual_chave, ant = chave, (valor, cap)
            continue
        v0, c0 = ant
        ant = (valor, cap)
        if abs(valor - v0) <= 1e-9:
            continue
        n_eventos += 1
        chaves.add((serie, ref))
        series.add(serie)
        ref_min = ref if ref_min is None or ref < ref_min else ref_min
        ref_max = ref if ref_max is None or ref > ref_max else ref_max
        por_captura[cap[:10]] += 1
        delta = valor - v0
        rel = abs(delta) / abs(v0) if v0 != 0 else None
        if v0 == 0:
            de_zero += 1
        ev = {"serie": serie, "ref": ref, "de": v0, "para": valor, "delta": delta,
              "relativa": rel, "capturado_de": c0, "capturado_para": cap, "recurso": rec}
        if maior_abs is None or abs(delta) > abs(maior_abs["delta"]):
            maior_abs = ev
        if rel is not None and (maior_rel is None or rel > maior_rel["relativa"]):
            maior_rel = ev
        eventos.append(ev)
        if len(eventos) > 4 * limite_eventos:  # poda periódica: memória limitada
            eventos.sort(key=lambda e: -(e["relativa"] if e["relativa"] is not None else float("inf")))
            eventos = eventos[:limite_eventos]
    if atual_sr is not None:
        fecha_conflito()
    eventos.sort(key=lambda e: (-(e["relativa"] if e["relativa"] is not None else float("inf")), e["serie"], e["ref"]))
    return {
        "eventos": n_eventos, "referencias_revisadas": len(chaves), "series_afetadas": len(series),
        "ref_min": ref_min, "ref_max": ref_max, "maior_abs": maior_abs, "maior_rel": maior_rel,
        "a_partir_de_zero": de_zero, "por_captura": dict(sorted(por_captura.items())),
        "maiores": eventos[:limite_eventos], "truncado": n_eventos > limite_eventos,
        "conflitos_entre_recursos": conflitos, "exemplos_conflito": exemplos_conflito,
    }


def revisoes_registros(con, dataset):
    """Mudanças em campos textuais (cadastros, atos): chaves e campos alterados, campos
    apagados pela fonte e o dia de cada captura que trouxe mudança."""
    cur = con.execute(
        """WITH rev AS (SELECT chave, campo FROM registros WHERE dataset=? GROUP BY chave, campo HAVING COUNT(*) > 1)
           SELECT r.chave, r.campo, r.valor, v.capturado_em FROM rev
           JOIN registros r ON r.dataset=? AND r.chave=rev.chave AND r.campo=rev.campo
           JOIN vintages v ON v.vintage_id=r.vintage_id
           ORDER BY r.chave, r.campo, v.capturado_em, r.rowid""",
        (dataset, dataset),
    )
    mudancas, apagados = 0, 0
    chaves, campos = set(), Counter()
    por_captura = Counter()
    atual, ant = None, None
    for ch, campo, valor, cap in cur:
        k = (ch, campo)
        if k != atual:
            atual, ant = k, valor
            continue
        if valor == ant:
            continue
        ant = valor
        mudancas += 1
        chaves.add(ch)
        campos[campo] += 1
        if valor == "":
            apagados += 1
        por_captura[cap[:10]] += 1
    return {"mudancas": mudancas, "chaves_afetadas": len(chaves), "campos": dict(campos.most_common(10)),
            "apagados_pela_fonte": apagados, "por_captura": dict(sorted(por_captura.items()))}


def resumo_registros(con, dataset):
    """Chaves e preenchimento por campo (chaves com valor ÷ chaves do dataset)."""
    n_chaves = con.execute("SELECT COUNT(DISTINCT chave) FROM registros WHERE dataset=?", (dataset,)).fetchone()[0]
    if not n_chaves:
        return {"chaves": 0, "campos": 0, "preenchimento": {}}
    pre = {}
    for campo, n in con.execute(
        "SELECT campo, COUNT(DISTINCT chave) FROM registros WHERE dataset=? AND valor<>'' GROUP BY campo", (dataset,)
    ):
        pre[campo] = round(n / n_chaves, 4)
    piores = dict(sorted(pre.items(), key=lambda kv: (kv[1], kv[0]))[:8])
    return {"chaves": n_chaves, "campos": len(pre), "preenchimento_minimo": min(pre.values()) if pre else None,
            "preenchimento": piores}


def horizonte(con, dataset, folga_dias=0, excluir_series_like=None):
    """Referências posteriores à data (Brasília) da captura que as trouxe. Para cada
    vintage, compara o início do período da maior referência com a data da captura
    mais a folga. Vigências e chaves não temporais não entram (vigência futura é
    legítima: a tarifa aprovada passa a valer depois). `excluir_series_like` isenta as
    séries que casam o padrão LIKE (limites regulatórios de anos futuros, por exemplo)."""
    viol = []
    verificadas = 0
    filtro, extra = ("AND o.serie NOT LIKE ?", (excluir_series_like,)) if excluir_series_like else ("", ())
    for cap, mx in con.execute(
        f"""SELECT v.capturado_em, MAX(o.ref) FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? {filtro} GROUP BY o.vintage_id""",
        (dataset, *extra),
    ):
        f = formato_ref(mx)
        if f in ("vigencia", "nao_temporal", "misto"):
            continue
        ini = inicio_ref(mx, f)
        if ini is None:
            continue
        verificadas += 1
        limite = data_local(cap) + timedelta(days=folga_dias)
        if ini > limite:
            viol.append({"capturado_em": cap, "ref_max": mx, "limite": limite.isoformat()})
    viol.sort(key=lambda x: x["ref_max"], reverse=True)
    return {"vintages_verificadas": verificadas, "violacoes": len(viol), "exemplos": viol[:5]}


def data_local(instante_utc):
    dt = datetime.fromisoformat(instante_utc.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BRASILIA).date()


# ---------------------------------------------------------------- bronze


def _abs(caminho):
    return caminho if os.path.isabs(caminho) else os.path.join(base.RAIZ, caminho)


def sha256_do_bronze(caminho):
    """sha256 do conteúdo original (descomprimido em fluxo quando .gz)."""
    h = hashlib.sha256()
    p = _abs(caminho)
    abre_ = gzip.open if p.endswith(".gz") else open
    with abre_(p, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def cabecalho_bronze(caminho):
    """Colunas da primeira linha de um CSV do bronze (None se o arquivo não é CSV ou
    não está presente). Lê só os primeiros 64 KB."""
    p = _abs(caminho)
    nome = p[:-3] if p.endswith(".gz") else p
    if not nome.lower().endswith((".csv", ".txt")) or not os.path.exists(p):
        return None
    abre_ = gzip.open if p.endswith(".gz") else open
    try:
        with abre_(p, "rb") as f:
            bruto = f.read(65536)
    except (OSError, EOFError):
        return None
    try:
        texto = bruto.decode("utf-8")
    except UnicodeDecodeError:
        texto = bruto.decode("latin-1")
    linha = texto.lstrip("﻿").splitlines()[0] if texto.strip() else ""
    if not linha:
        return None
    sep = max((";", ",", "\t", "|"), key=linha.count)
    return [c.strip().strip('"').strip() for c in linha.split(sep)]


def confere_bronze(vs, limite_hash=LIMITE_HASH_BYTES, recalcular=True, cache=None, validade_dias=30, agora=None):
    """Para a vintage vigente e a anterior de cada recurso: arquivo presente no bronze,
    sha256 recalculado (até `limite_hash` bytes comprimidos) e cabeçalho do CSV.
    Devolve o resumo e as diferenças de cabeçalho entre capturas do mesmo recurso.

    `cache` ({arquivo: {sha256, bytes, mtime, conferido_em}}) evita recalcular, a cada
    execução, o hash de um original que não mudou de tamanho nem de data desde a última
    conferência (o bronze é imutável: o nome do arquivo leva o sha256); a conferência
    é refeita depois de `validade_dias`."""
    agora = agora or datetime.now(timezone.utc)
    por_rec = defaultdict(list)
    for v in vs:
        por_rec[v["recurso"]].append(v)
    presentes = ausentes = conferidos = divergentes = grandes = 0
    exemplos_ausentes, exemplos_divergentes = [], []
    drift = []
    cabecalhos = {}
    for rec, lista in sorted(por_rec.items()):
        lista.sort(key=lambda v: v["capturado_em"])
        alvo = lista[-2:]
        cabs = []
        for v in alvo:
            arq = v.get("arquivo")
            if not arq or not os.path.exists(_abs(arq)):
                ausentes += 1
                if len(exemplos_ausentes) < 5:
                    exemplos_ausentes.append({"recurso": rec, "capturado_em": v["capturado_em"], "arquivo": arq})
                cabs.append(None)
                continue
            presentes += 1
            tam = os.path.getsize(_abs(arq))
            if recalcular and tam <= limite_hash:
                mtime = int(os.path.getmtime(_abs(arq)))
                c = (cache or {}).get(arq)
                sha = None
                if c and c.get("bytes") == tam and c.get("mtime") == mtime and c.get("conferido_em"):
                    try:
                        idade = agora - datetime.fromisoformat(c["conferido_em"].replace("Z", "+00:00"))
                        if idade < timedelta(days=validade_dias):
                            sha = c.get("sha256")
                    except ValueError:
                        sha = None
                if sha is None:
                    sha = sha256_do_bronze(arq)
                    if cache is not None:
                        cache[arq] = {"sha256": sha, "bytes": tam, "mtime": mtime, "conferido_em": base.agora_utc()}
                conferidos += 1
                if sha != v["sha256"]:
                    divergentes += 1
                    if len(exemplos_divergentes) < 5:
                        exemplos_divergentes.append({"recurso": rec, "capturado_em": v["capturado_em"],
                                                     "sha256_registrado": v["sha256"], "sha256_recalculado": sha})
            elif tam > limite_hash:
                grandes += 1
            cabs.append(cabecalho_bronze(arq))
        if cabs and cabs[-1] is not None:
            cabecalhos[rec] = cabs[-1]
        if len(cabs) == 2 and cabs[0] is not None and cabs[1] is not None and cabs[0] != cabs[1]:
            drift.append({"recurso": rec, "capturado_antes": alvo[0]["capturado_em"], "capturado_depois": alvo[1]["capturado_em"],
                          "removidas": [c for c in cabs[0] if c not in cabs[1]],
                          "novas": [c for c in cabs[1] if c not in cabs[0]],
                          "ordem_mudou": sorted(cabs[0]) == sorted(cabs[1])})
    # heterogeneidade entre recursos do mesmo conjunto (anos diferentes com colunas diferentes)
    modal = Counter(tuple(c) for c in cabecalhos.values()).most_common(1)
    diferentes = []
    if modal:
        ref = list(modal[0][0])
        for rec, cab in sorted(cabecalhos.items()):
            if cab != ref:
                diferentes.append({"recurso": rec, "removidas": [c for c in ref if c not in cab],
                                   "novas": [c for c in cab if c not in ref]})
    return {
        "arquivos_presentes": presentes, "arquivos_ausentes": ausentes, "sha256_conferidos": conferidos,
        "sha256_divergentes": divergentes, "acima_do_limite_de_hash": grandes,
        "exemplos_ausentes": exemplos_ausentes, "exemplos_divergentes": exemplos_divergentes,
        "csv_com_cabecalho": len(cabecalhos), "drift": drift[:10], "drift_total": len(drift),
        "recursos_com_esquema_diferente": diferentes[:10], "recursos_com_esquema_diferente_total": len(diferentes),
        "esquema_modal": list(modal[0][0]) if modal else None,
    }


# ---------------------------------------------------------------- dataset inteiro


def analisa(con, dataset, *, regra_horizonte=None, bronze=True, recalcular_hash=True, hoje=None, cache_hash=None):
    """Tudo o que a página Dados precisa saber de um dataset do silver. `regra_horizonte`
    vem de validacoes.HORIZONTE_SILVER (folga de publicação da fonte, séries isentas)."""
    regra = regra_horizonte or {}
    vs = vintages(con, dataset)
    tem_obs = con.execute("SELECT 1 FROM observacoes WHERE dataset=? LIMIT 1", (dataset,)).fetchone() is not None
    tem_reg = con.execute("SELECT 1 FROM registros WHERE dataset=? LIMIT 1", (dataset,)).fetchone() is not None
    out = {
        "dataset": dataset,
        "vintages": resumo_vintages(vs),
        "coletas": resumo_coletas(con, dataset),
        "observacoes": completude(con, dataset, hoje) if tem_obs else None,
        "registros": resumo_registros(con, dataset) if tem_reg else None,
        "revisoes": revisoes(con, dataset) if tem_obs else None,
        "revisoes_registros": revisoes_registros(con, dataset) if tem_reg else None,
        "horizonte": horizonte(con, dataset, regra.get("folga_dias", 0), regra.get("series_like")) if tem_obs else None,
        "bronze": confere_bronze(vs, recalcular=recalcular_hash, cache=cache_hash) if bronze and vs else None,
        "coletas_por_dia": coletas_por_dia(con, dataset),
        "_vintages": vs,
    }
    return out
