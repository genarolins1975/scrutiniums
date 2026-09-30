"""Parsers do módulo Rede (detalhe): arquivos originais do ONS lidos em fluxo.

Por que um parser próprio em vez de reaproveitar fontes/ons.py: o silver principal
guarda o intercâmbio entre subsistemas já somado por fronteira, e o módulo precisa
conferir, linha a linha, o que o arquivo publica (orientação de cada linha, sinal,
presença do valor programado, duplicidades) para fechar o achado A05. Estas funções
recebem um iterável de dicts (ckan.le_csv_bronze) e devolvem (observações, relatório):
o relatório registra o esquema encontrado em cada arquivo, para que uma mudança de
formato da fonte apareça como fato documentado, e não como número errado.

Convenções verificadas nos arquivos (outubro de 2026):
- INTERCAMBIO_NACIONAL de 2021 a 2025: uma linha por fronteira e hora, sempre na mesma
  orientação (N→NE, N→SE, NE→SE e SE→S), valor com sinal;
- INTERCAMBIO_NACIONAL de 2026: uma linha por fronteira e hora, orientada no sentido do
  fluxo verificado naquela hora (valor verificado não negativo) e com o programado na
  mesma orientação da linha (pode ser negativo). O dicionário (versão 1.2, 04/05/2026)
  não descreve a mudança; a canonização abaixo trata as duas formas.
- INTERCAMBIO_INTERNACIONAL: uma linha por país e hora; positivo = exportação do Brasil
  (dicionário, versão 1.2).
Horários do ONS são locais (Brasília) e marcam o início da hora.
"""
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia.fontes.ckan import numero_br  # noqa: E402

# Fronteiras na orientação canônica do projeto (a mesma de fontes/ons.py): positivo =
# fluxo da primeira para a segunda ponta.
FRONTEIRAS = (("N", "NE"), ("N", "SE"), ("NE", "SE"), ("S", "SE"))
PARES = tuple(f"{a}_{b}" for a, b in FRONTEIRAS)
SUBSISTEMAS = ("SE", "S", "NE", "N")
CAMPOS_BALANCO = (("hidraulica", "val_gerhidraulica"), ("termica", "val_gertermica"),
                  ("eolica", "val_gereolica"), ("solar", "val_gersolar"),
                  ("carga", "val_carga"), ("intercambio", "val_intercambio"))
CAMPOS_ITAIPU = (("total", "val_itaipu_total"), ("setor_60hz", "val_itaipu_60hz"),
                 ("setor_50hz", "val_itaipu_50hz"), ("setor_50hz_brasil", "val_itaipu_50hz_br"),
                 ("brasil", "val_itaipu_br"))


def _sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


def sigla(s):
    """Sigla de subsistema como publicada, sem espaços de preenchimento ('SE ' → 'SE')."""
    return (s or "").strip().upper()


def pais(s):
    """Nome do país canônico: maiúsculas, sem acento e sem o preenchimento de 30 posições
    que o arquivo de 2026 traz ('Argentina                     ' → 'ARGENTINA')."""
    return re.sub(r"\s+", " ", _sem_acento(s)).strip().upper()


def hora_ref(din):
    """'AAAA-MM-DD HH:MM:SS' (início da hora, horário local) → 'AAAA-MM-DDTHH:00'.
    Instante fora da hora cheia devolve None: não cabe na grade horária e é contado à parte."""
    s = (din or "").strip()
    if len(s) < 16 or s[4] != "-" or s[13] != ":":
        return None
    if s[14:16] != "00" or (len(s) >= 19 and s[17:19] not in ("00", "")):
        return None
    return f"{s[:10]}T{s[11:13]}:00"


def canoniza(origem, destino):
    """(par canônico, sinal) de uma linha publicada de origem→destino; None se o par não é
    uma das quatro fronteiras monitoradas."""
    if (origem, destino) in FRONTEIRAS:
        return f"{origem}_{destino}", 1.0
    if (destino, origem) in FRONTEIRAS:
        return f"{destino}_{origem}", -1.0
    return None


def parse_intercambio_nacional(linhas):
    """Arquivo INTERCAMBIO_NACIONAL_<ano>.csv → observações `verificado.<par>` e
    `programado.<par>` (MWmed, orientação canônica) e o relatório do esquema.

    Cada linha é convertida para a orientação canônica multiplicando verificado e
    programado pelo mesmo sinal: a linha 'SE → NE, verificado 431,8, programado −504,5'
    vira 'NE_SE = −431,8 verificado e +504,5 programado'. Duas linhas da mesma fronteira
    na mesma hora não são somadas nem escolhidas: a hora fica sem valor e é listada em
    `conflitos` (ausência declarada, nunca número inventado)."""
    rel = {"linhas": 0, "colunas": None, "tem_programado": False, "orientacoes": Counter(),
           "sinais_verificado": Counter(), "pares_desconhecidos": Counter(), "instantes_fora_da_hora": 0,
           "verificado_ausente": 0, "programado_ausente": 0, "conflitos": [], "primeira": None, "ultima": None}
    vistos = defaultdict(list)
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
            rel["tem_programado"] = "val_intercambioprogmwmed" in r
        rel["linhas"] += 1
        a, b = sigla(r.get("id_subsistema_origem")), sigla(r.get("id_subsistema_destino"))
        ref = hora_ref(r.get("din_instante"))
        if ref is None:
            rel["instantes_fora_da_hora"] += 1
            continue
        can = canoniza(a, b)
        if can is None:
            rel["pares_desconhecidos"][f"{a}->{b}"] += 1
            continue
        par, sinal = can
        rel["orientacoes"][f"{a}->{b}"] += 1
        v = numero_br(r.get("val_intercambiomwmed"))
        p = numero_br(r.get("val_intercambioprogmwmed")) if rel["tem_programado"] else None
        if v is None:
            rel["verificado_ausente"] += 1
        else:
            rel["sinais_verificado"][f"{a}->{b}:" + ("positivo" if v > 0 else ("zero" if v == 0 else "negativo"))] += 1
        if rel["tem_programado"] and p is None:
            rel["programado_ausente"] += 1
        vistos[(par, ref)].append((None if v is None else sinal * v, None if p is None else sinal * p))
        rel["primeira"] = ref if rel["primeira"] is None or ref < rel["primeira"] else rel["primeira"]
        rel["ultima"] = ref if rel["ultima"] is None or ref > rel["ultima"] else rel["ultima"]
    obs = []
    for (par, ref), vals in vistos.items():
        if len(vals) > 1:
            rel["conflitos"].append(f"{par} {ref}")
            continue
        v, p = vals[0]
        obs.append((f"verificado.{par}", ref, v))
        obs.append((f"programado.{par}", ref, p))
    rel["horas"] = len({ref for (_, ref) in vistos})
    rel["orientacoes"] = dict(rel["orientacoes"])
    rel["sinais_verificado"] = dict(rel["sinais_verificado"])
    rel["pares_desconhecidos"] = dict(rel["pares_desconhecidos"])
    rel["conflitos"] = sorted(rel["conflitos"])[:50]
    return obs, rel


def parse_intercambio_internacional(linhas):
    """INTERCAMBIO_INTERNACIONAL_<ano>.csv → `verificado.<PAIS>` e `programado.<PAIS>`
    (MWmed; positivo = exportação do Brasil, negativo = importação, pelo dicionário)."""
    rel = {"linhas": 0, "colunas": None, "tem_programado": False, "paises": Counter(), "instantes_fora_da_hora": 0,
           "verificado_ausente": 0, "conflitos": [], "primeira": None, "ultima": None}
    vistos = defaultdict(list)
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
            rel["tem_programado"] = "val_intercambioprogmwmed" in r
        rel["linhas"] += 1
        ref = hora_ref(r.get("din_instante"))
        if ref is None:
            rel["instantes_fora_da_hora"] += 1
            continue
        p_ = pais(r.get("nom_paisdestino"))
        rel["paises"][p_] += 1
        v = numero_br(r.get("val_intercambiomwmed"))
        g = numero_br(r.get("val_intercambioprogmwmed")) if rel["tem_programado"] else None
        if v is None:
            rel["verificado_ausente"] += 1
        vistos[(p_, ref)].append((v, g))
        rel["primeira"] = ref if rel["primeira"] is None or ref < rel["primeira"] else rel["primeira"]
        rel["ultima"] = ref if rel["ultima"] is None or ref > rel["ultima"] else rel["ultima"]
    obs = []
    for (p_, ref), vals in vistos.items():
        if len(vals) > 1:
            rel["conflitos"].append(f"{p_} {ref}")
            continue
        v, g = vals[0]
        obs.append((f"verificado.{p_}", ref, v))
        obs.append((f"programado.{p_}", ref, g))
    rel["paises"] = dict(rel["paises"])
    rel["conflitos"] = sorted(rel["conflitos"])[:50]
    return obs, rel


def parse_balanco(linhas):
    """BALANCO_ENERGIA_SUBSISTEMA_<ano>.csv → `<campo>.<SM>` (MWmed) para geração por
    fonte, carga e intercâmbio de cada subsistema e do SIN. Campo vazio fica ausente e é
    contado por campo (o dicionário admite nulo na geração)."""
    rel = {"linhas": 0, "colunas": None, "subsistemas": Counter(), "instantes_fora_da_hora": 0,
           "nulos": Counter(), "conflitos": [], "primeira": None, "ultima": None}
    vistos = defaultdict(list)
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
        rel["linhas"] += 1
        ref = hora_ref(r.get("din_instante"))
        if ref is None:
            rel["instantes_fora_da_hora"] += 1
            continue
        sm = sigla(r.get("id_subsistema"))
        rel["subsistemas"][sm] += 1
        vals = {}
        for campo, col in CAMPOS_BALANCO:
            v = numero_br(r.get(col))
            if v is None:
                rel["nulos"][campo] += 1
            vals[campo] = v
        vistos[(sm, ref)].append(vals)
        rel["primeira"] = ref if rel["primeira"] is None or ref < rel["primeira"] else rel["primeira"]
        rel["ultima"] = ref if rel["ultima"] is None or ref > rel["ultima"] else rel["ultima"]
    obs = []
    for (sm, ref), lst in vistos.items():
        if len(lst) > 1:
            rel["conflitos"].append(f"{sm} {ref}")
            continue
        for campo, v in lst[0].items():
            obs.append((f"{campo}.{sm}", ref, v))
    rel["subsistemas"] = dict(rel["subsistemas"])
    rel["nulos"] = dict(rel["nulos"])
    rel["conflitos"] = sorted(rel["conflitos"])[:50]
    return obs, rel


def parse_itaipu(linhas, ano_inicial):
    """GERACAO_ITAIPU.csv (arquivo único desde 2000) → `<campo>` horário (MWmed) a partir
    de `ano_inicial`, lido em fluxo. O relatório confere, linha a linha, as duas
    identidades do dicionário: total = 60 Hz + 50 Hz e Brasil = 60 Hz + 50 Hz destinado
    ao Brasil (tolerância de 0,5 MWmed, metade da última casa inteira)."""
    rel = {"linhas": 0, "linhas_no_periodo": 0, "colunas": None, "instantes_fora_da_hora": 0, "nulos": Counter(),
           "identidade_total_falhas": 0, "identidade_brasil_falhas": 0, "primeira": None, "ultima": None, "conflitos": []}
    vistos = defaultdict(list)
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
        rel["linhas"] += 1
        ref = hora_ref(r.get("din_instante"))
        if ref is None:
            rel["instantes_fora_da_hora"] += 1
            continue
        if int(ref[:4]) < ano_inicial:
            continue
        rel["linhas_no_periodo"] += 1
        vals = {}
        for campo, col in CAMPOS_ITAIPU:
            v = numero_br(r.get(col))
            if v is None:
                rel["nulos"][campo] += 1
            vals[campo] = v
        if None not in (vals["total"], vals["setor_60hz"], vals["setor_50hz"]) and \
                abs(vals["total"] - vals["setor_60hz"] - vals["setor_50hz"]) > 0.5:
            rel["identidade_total_falhas"] += 1
        if None not in (vals["brasil"], vals["setor_60hz"], vals["setor_50hz_brasil"]) and \
                abs(vals["brasil"] - vals["setor_60hz"] - vals["setor_50hz_brasil"]) > 0.5:
            rel["identidade_brasil_falhas"] += 1
        vistos[ref].append(vals)
        rel["primeira"] = ref if rel["primeira"] is None or ref < rel["primeira"] else rel["primeira"]
        rel["ultima"] = ref if rel["ultima"] is None or ref > rel["ultima"] else rel["ultima"]
    obs = []
    for ref, lst in vistos.items():
        if len(lst) > 1:
            rel["conflitos"].append(ref)
            continue
        for campo, v in lst[0].items():
            obs.append((campo, ref, v))
    rel["nulos"] = dict(rel["nulos"])
    rel["conflitos"] = sorted(rel["conflitos"])[:50]
    return obs, rel


def parse_atls(linhas):
    """IND_CONFIARB_ATLS.csv → `atls.<FLUXO>.<ME|AN>` (fração de 0 a 1, como publicado) e
    `horas_violacao.<FLUXO>.<ME|AN>` (horas), referência AAAA-MM.

    O dicionário diz "valor do indicador ATLS, em %", mas os valores vêm entre 0 e 1: o
    relatório registra o maior valor lido para que a unidade seja conferida na gold (a
    relação ATLS = 1 − horas de violação ÷ horas do período fecha com a fração)."""
    rel = {"linhas": 0, "colunas": None, "fluxos": Counter(), "periodicidades": Counter(), "maior_atls": None,
           "menor_atls": None, "conflitos": [], "invalidas": 0}
    vistos = defaultdict(list)
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
        rel["linhas"] += 1
        fl = (r.get("nom_fluxo") or "").strip().upper()
        per = (r.get("id_periodicidade") or "").strip().upper()
        ref = (r.get("din_referencia") or "").strip()[:7]
        a, h = numero_br(r.get("val_atls")), numero_br(r.get("num_horasviolacao"))
        if not fl or per not in ("ME", "AN") or not re.fullmatch(r"\d{4}-\d{2}", ref):
            rel["invalidas"] += 1
            continue
        rel["fluxos"][fl] += 1
        rel["periodicidades"][per] += 1
        if a is not None:
            rel["maior_atls"] = a if rel["maior_atls"] is None else max(rel["maior_atls"], a)
            rel["menor_atls"] = a if rel["menor_atls"] is None else min(rel["menor_atls"], a)
        vistos[(fl, per, ref)].append((a, h))
    obs = []
    for (fl, per, ref), lst in vistos.items():
        if len(lst) > 1:
            rel["conflitos"].append(f"{fl} {per} {ref}")
            continue
        a, h = lst[0]
        obs.append((f"atls.{fl}.{per}", ref, a))
        obs.append((f"horas_violacao.{fl}.{per}", ref, h))
    rel["fluxos"] = dict(rel["fluxos"])
    rel["periodicidades"] = dict(rel["periodicidades"])
    return obs, rel


CAMPOS_INTERRUPCAO = ("cod_perturbacao", "din_interrupcaocarga", "id_subsistema", "nom_subsistema", "id_estado",
                      "nom_agente", "val_cargainterrompida_mw", "val_tempomedio_minutos", "val_energianaosuprida_mwh",
                      "flg_envolveuredebasica", "flg_envolveuredeoperacao")


def parse_interrupcoes(linhas):
    """INTERRUPCAO_CARGA.csv → lista de eventos (dicts com os campos do dicionário, números
    convertidos) com chave estável e relatório.

    Chave: perturbação | instante | UF | agente | ordem. A ordem desempata linhas com a
    mesma perturbação, instante, UF e agente pelo conteúdo (carga, tempo, energia), e não
    pela posição no arquivo, para que o ONS reordenar o arquivo não crie revisões falsas.
    Linhas inteiramente repetidas são mantidas (a fonte as publica) e contadas em
    `linhas_repetidas`: não há como saber se são dois registros legítimos."""
    rel = {"linhas": 0, "colunas": None, "sem_chave": 0, "linhas_repetidas": 0, "abaixo_de_100mw": 0,
           "valores_invalidos": 0, "primeira": None, "ultima": None}
    grupos = defaultdict(list)
    inteiras = Counter()
    for r in linhas:
        if rel["colunas"] is None:
            rel["colunas"] = list(r.keys())
        rel["linhas"] += 1
        ev = {k: (r.get(k) or "").strip() for k in CAMPOS_INTERRUPCAO}
        inteiras[tuple(ev.values())] += 1
        if not ev["cod_perturbacao"] or not ev["din_interrupcaocarga"]:
            rel["sem_chave"] += 1
            continue
        for k in ("val_cargainterrompida_mw", "val_tempomedio_minutos", "val_energianaosuprida_mwh"):
            ev[k] = numero_br(ev[k])
        if ev["val_cargainterrompida_mw"] is None or ev["val_energianaosuprida_mwh"] is None:
            rel["valores_invalidos"] += 1
        elif ev["val_cargainterrompida_mw"] < 100:
            rel["abaixo_de_100mw"] += 1
        chave = (ev["cod_perturbacao"], ev["din_interrupcaocarga"], ev["id_estado"], ev["nom_agente"])
        grupos[chave].append(ev)
        d = ev["din_interrupcaocarga"]
        rel["primeira"] = d if rel["primeira"] is None or d < rel["primeira"] else rel["primeira"]
        rel["ultima"] = d if rel["ultima"] is None or d > rel["ultima"] else rel["ultima"]
    rel["linhas_repetidas"] = sum(n - 1 for n in inteiras.values() if n > 1)
    eventos = []
    for chave, lst in grupos.items():
        lst.sort(key=lambda e: tuple(-1e18 if e[k] is None else e[k] for k in
                                     ("val_cargainterrompida_mw", "val_tempomedio_minutos", "val_energianaosuprida_mwh")))
        for i, ev in enumerate(lst, start=1):
            eventos.append({**ev, "chave": "|".join(chave) + f"|{i}"})
    eventos.sort(key=lambda e: (e["din_interrupcaocarga"], e["chave"]))
    return eventos, rel


# Conversoras de fronteira por país (texto do conjunto "Intercâmbio do SIN com Outros
# Países"): Argentina por Garabi I, Garabi II e Uruguaiana; Uruguai por Melo e Rivera.
# Nomes dos elementos no conjunto "Programados dos Elementos de Fluxo Controlado".
CONVERSORAS_PDO = {"GARABI 1B - T1": "ARGENTINA", "GARABI 2B - T1": "ARGENTINA", "CF URUGUAIANA - T1": "ARGENTINA",
                   "CF MELO - T1": "URUGUAI", "CF RIVERA - T1": "URUGUAI"}


def parse_pdo_conversoras(linhas):
    """PROGRAMACAO_FLUXO_CONTROLADO_<dia>.csv → `pdo.<elemento>` por meia hora (MW, como
    publicado), só para as conversoras de fronteira internacional. O patamar p (1 a 48)
    começa em (p − 1) × 30 minutos do dia de referência da programação."""
    rel = {"linhas": 0, "dia": None, "patamares": set(), "elementos": Counter(), "invalidas": 0}
    obs = []
    for r in linhas:
        rel["linhas"] += 1
        el = (r.get("nom_elementofluxocontrolado") or "").strip()
        if el not in CONVERSORAS_PDO:
            continue
        dia = (r.get("din_programacaodia") or "").strip()[:10]
        try:
            pat = int((r.get("num_patamar") or "").strip())
        except ValueError:
            rel["invalidas"] += 1
            continue
        v = numero_br(r.get("val_carga"))
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", dia) or not 1 <= pat <= 48:
            rel["invalidas"] += 1
            continue
        rel["dia"] = dia
        rel["patamares"].add(pat)
        rel["elementos"][el] += 1
        minutos = (pat - 1) * 30
        obs.append((f"pdo.{el}", f"{dia}T{minutos // 60:02d}:{minutos % 60:02d}", v))
    rel["patamares"] = len(rel["patamares"])
    rel["elementos"] = dict(rel["elementos"])
    return obs, rel


# ---------------------------------------------------------------------------
# Dicionários de dados e documentos públicos (texto do pdftotext -layout)
# ---------------------------------------------------------------------------

def versoes_dicionario(txt):
    """[(versão, data, descrição)] da seção "Evoluções do Conjunto de Dados". O ONS usa
    duas ordens: "26-08-2022  Versão 1.0  texto" e "Versão 1.0  02-05-2023  texto"."""
    out = []
    for m in re.finditer(r"(\d{2}-\d{2}-\d{4})\s+Vers[aã]o\s+(\d+\.\d+)\s+(.*?)(?=\n\s*\n|\n\s*\d{2}-\d{2}-\d{4}\s+Vers|\Z)",
                         txt or "", flags=re.S):
        out.append({"versao": m.group(2), "data": m.group(1), "descricao": " ".join(m.group(3).split())[:300]})
    for m in re.finditer(r"Vers[aã]o\s+(\d+\.\d+)\s+(\d{2}-\d{2}-\d{4})\s+(.*?)(?=\n\s*\n|\n\s*Vers[aã]o\s|\Z)",
                         txt or "", flags=re.S):
        out.append({"versao": m.group(1), "data": m.group(2), "descricao": " ".join(m.group(3).split())[:300]})
    return sorted({(v["versao"], v["data"]): v for v in out}.values(), key=lambda v: v["versao"])


def permissoes_dicionario(txt):
    """{campo: {nulo, zerado, negativo}} das colunas "Permite valor" dos campos numéricos."""
    out = {}
    for cod, nulo, zero, neg in re.findall(r"\b(val_\w+)\s+FLOAT\s+(?:\S+\s+)?(Sim|Não)\s+(Sim|Não)\s+(Sim|Não)", txt or ""):
        out[cod] = {"nulo": nulo == "Sim", "zerado": zero == "Sim", "negativo": neg == "Sim"}
    return out


def normaliza_texto(txt):
    """Texto para exibição de trechos: hífen invisível removido e espaços únicos. O hífen
    de fim de linha é mantido: nos documentos do ONS ele é quase sempre real
    ("Nordeste-\\nNorte")."""
    t = (txt or "").replace("­", "")
    return re.sub(r"\s+", " ", t).strip()


def _sem_espacos(txt):
    return re.sub(r"\s+", "", (txt or "").replace("­", "")).lower()


def confere_passagem(texto, passagem):
    """True quando a passagem citada aparece literalmente no texto extraído do documento,
    ignorando espaços e quebras de linha (o pdftotext parte linhas no meio de expressões)
    e sem diferenciar maiúsculas. Palavras não são reescritas: "Nordeste-Norte" só confere
    com o hífen."""
    return _sem_espacos(passagem) in _sem_espacos(texto)
