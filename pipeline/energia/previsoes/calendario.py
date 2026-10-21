"""Calendário da previsão do PLD: alvo, entregas, corte, prazo e elegibilidade.

Convenções (fixadas aqui e testadas; seção 12.1 da especificação):

* Hora local é a de Brasília (America/Sao_Paulo). O PLD horário da CCEE vem com a hora
  local de 0 a 23; desde 2019 não há horário de verão, então todo dia tem 24 horas. Uma
  hora "AAAA-MM-DDTHH:00" é o intervalo [HH:00, HH+1:00) daquele dia.
* Semana: de sábado 00h (incluído) ao sábado seguinte 00h (excluído), 168 horas; é a
  semana operativa da CCEE e do ONS (sábado a sexta). W1 é a primeira semana que começa
  depois do dia de origem: com origem numa sexta, W1 começa no dia seguinte; com origem
  num sábado, a semana que começou à meia-noite já está em curso e W1 é a do sábado
  seguinte. W2 a W4 são as três semanas depois de W1.
* Mês: mês civil, do dia 1º 00h (incluído) ao dia 1º do mês seguinte 00h (excluído). M1 é
  o primeiro mês que começa depois do dia de origem; M2 e M3, os dois seguintes.
* Alvo: média aritmética simples do PLD horário do submercado sobre todas as horas da
  entrega, em R$/MWh nominais. É média temporal, não ponderada pela carga. O realizado
  só existe quando todas as horas da entrega estão publicadas (168 na semana; 24 × dias
  no mês); entrega incompleta não tem realizado.
* Corte: 07h00 de Brasília do dia de origem; prazo de emissão: 08h00 do mesmo dia.
* Elegibilidade LATkD: um período [início, fim) é informação no corte c quando
  fim <= c − k dias. Como os períodos usados terminam à meia-noite e o corte é às 07h,
  isso equivale a fim (data) <= origem − k dias. LAT1D é a regra registrada dos modelos;
  LAT2D e LAT3D servem de sensibilidade a atrasos de publicação.

Separação entre o que já foi publicado e o desconhecido: a CCEE publica o PLD de cada
dia na véspera, então no corte das 07h o PLD das horas restantes do próprio dia de
origem já é conhecido. Nenhuma entrega começa antes do dia seguinte à origem, então a
fração conhecida de uma entrega no corte é, por construção, zero; a emissão confere isso
pela captura real (fracao_conhecida_no_corte) e nunca mistura PLD publicado com previsão.
"""
from datetime import date, datetime, time, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    FUSO = ZoneInfo("America/Sao_Paulo")
except Exception:  # sem base de fusos: Brasília sem horário de verão desde 2019
    FUSO = timezone(timedelta(hours=-3))

HORA_CORTE = time(7, 0)
HORA_PRAZO = time(8, 0)
HORIZONTES_W = ("W1", "W2", "W3", "W4")
HORIZONTES_M = ("M1", "M2", "M3")
HORIZONTES = HORIZONTES_W + HORIZONTES_M
SUBMERCADOS = ("SE", "S", "NE", "N")
SABADO = 5  # date.weekday(): segunda = 0 ... sábado = 5, domingo = 6
INICIO_PLD_HORARIO = date(2021, 1, 1)


def utc_iso(dt):
    """Instante com fuso → 'AAAA-MM-DDTHH:MM:SSZ' (UTC)."""
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def instante(valor):
    """'...Z' ou ISO com deslocamento → datetime em UTC. Sem fuso é erro (ambíguo)."""
    dt = datetime.fromisoformat(valor[:-1] + "+00:00" if valor.endswith("Z") else valor)
    if dt.tzinfo is None:
        raise ValueError(f"instante sem fuso: {valor!r}")
    return dt.astimezone(timezone.utc)


def local(d, hora=time(0, 0)):
    """Data e hora de Brasília como datetime com fuso."""
    return datetime.combine(d, hora, tzinfo=FUSO)


def corte_de(origem):
    """Corte da rodada do dia `origem`: 07h00 de Brasília, como datetime com fuso."""
    return local(origem, HORA_CORTE)


def prazo_de(origem):
    """Prazo de emissão da rodada do dia `origem`: 08h00 de Brasília."""
    return local(origem, HORA_PRAZO)


def origem_de(agora_utc):
    """Dia de origem (data de Brasília) de um instante."""
    return agora_utc.astimezone(FUSO).date()


def proximo_sabado(d):
    """Primeiro sábado estritamente depois de `d`."""
    dias = (SABADO - d.weekday()) % 7
    return d + timedelta(days=dias or 7)


def sabado_ate(d):
    """Último sábado em ou antes de `d`."""
    return d - timedelta(days=(d.weekday() - SABADO) % 7)


def primeiro_do_mes(d):
    return d.replace(day=1)


def soma_meses(d, n):
    """Primeiro dia do mês n meses depois do mês de `d`."""
    m = d.year * 12 + (d.month - 1) + n
    return date(m // 12, m % 12 + 1, 1)


def entrega(origem, horizonte):
    """Entrega de um horizonte: {horizonte, frequencia, id, inicio, fim} com datas locais
    e fim excluído, mais os instantes UTC de início e fim."""
    if horizonte in HORIZONTES_W:
        k = int(horizonte[1:])
        ini = proximo_sabado(origem) + timedelta(days=7 * (k - 1))
        fim = ini + timedelta(days=7)
        eid, freq = f"W{ini.isoformat()}", "W"
    elif horizonte in HORIZONTES_M:
        k = int(horizonte[1:])
        ini = soma_meses(origem, k)
        fim = soma_meses(ini, 1)
        eid, freq = f"M{ini.isoformat()[:7]}", "M"
    else:
        raise ValueError(f"horizonte desconhecido: {horizonte}")
    return {"horizonte": horizonte, "frequencia": freq, "id": eid, "inicio": ini, "fim": fim,
            "inicio_utc": utc_iso(local(ini)), "fim_utc": utc_iso(local(fim)), "horas": 24 * (fim - ini).days}


def entregas(origem):
    return [entrega(origem, h) for h in HORIZONTES]


def entrega_por_id(eid):
    """Entrega a partir do identificador ('W2026-10-03' ou 'M2026-10')."""
    if eid.startswith("W"):
        ini = date.fromisoformat(eid[1:])
        if ini.weekday() != SABADO:
            raise ValueError(f"semana que não começa no sábado: {eid}")
        fim = ini + timedelta(days=7)
        freq = "W"
    elif eid.startswith("M"):
        ini = date.fromisoformat(eid[1:] + "-01")
        fim = soma_meses(ini, 1)
        freq = "M"
    else:
        raise ValueError(f"entrega desconhecida: {eid}")
    return {"id": eid, "frequencia": freq, "inicio": ini, "fim": fim, "horas": 24 * (fim - ini).days}


def horas(inicio, fim):
    """Referências horárias locais 'AAAA-MM-DDTHH:00' de [inicio, fim)."""
    out = []
    d = inicio
    while d < fim:
        iso = d.isoformat()
        out.extend(f"{iso}T{h:02d}:00" for h in range(24))
        d += timedelta(days=1)
    return out


def limite_elegivel(origem, k=1):
    """Instante (com fuso) até o qual um período precisa ter terminado para ser informação
    no corte da origem sob LATkD: corte − k dias."""
    return corte_de(origem) - timedelta(days=k)


def elegivel(fim_periodo, origem, k=1):
    """Período que termina em `fim_periodo` (data local, 00h, excluída) é informação no
    corte da origem sob LATkD? Comparação entre instantes com fuso, não entre textos."""
    return local(fim_periodo) <= limite_elegivel(origem, k)


def ultimo_dia_elegivel(origem, k=1):
    """Último dia inteiro elegível: o dia X termina em X+1 00h."""
    x = origem - timedelta(days=k + 1)
    assert elegivel(x + timedelta(days=1), origem, k) and not elegivel(x + timedelta(days=2), origem, k)
    return x


def ultima_semana_elegivel(origem, k=1):
    """Início (sábado) da última semana completa elegível."""
    fim = sabado_ate(origem - timedelta(days=k))
    assert elegivel(fim, origem, k)
    return fim - timedelta(days=7)


def ultimo_mes_elegivel(origem, k=1):
    """Primeiro dia do último mês completo elegível."""
    fim = primeiro_do_mes(origem - timedelta(days=k))
    assert elegivel(fim, origem, k)
    return soma_meses(fim, -1)


def fim_de_informacao(entrega_):
    """Data em que o realizado da entrega passa a ser informação sob LAT1D numa origem:
    origem >= fim + 1 dia (usado para saber quando um resíduo pode treinar ou calibrar)."""
    return entrega_["fim"] + timedelta(days=1)
