"""Validação de horizonte de publicação (docs/observatorios/ARQUITETURA_DADOS_ENERGIA.md).

Dado observado não pode ter referência além do que a fonte já poderia ter
publicado no momento da captura:
- PLD: até o fim do dia seguinte à captura (o PLD de cada hora é publicado na véspera);
- CMO semanal: até a semana operativa seguinte (14 dias após a captura);
- demais séries do ONS: até a data da captura.
Referência além do horizonte indica erro de parsing, de fuso ou de fonte: a gold
é recusada e a publicação anterior fica no ar.
"""
from datetime import date, datetime, timedelta, timezone

BRASILIA = timezone(timedelta(hours=-3))

# gold → [(campo de referência, dataset, folga em dias sobre a data local da captura)]
HORIZONTE = {
    "pld.json": [("ultima_hora", "ccee_pld_horario", 1)],
    "hidrologia.json": [("dia_referencia_ear", "ear_subsistema_di", 0), ("dia_referencia_ena", "ena_subsistema_di", 0)],
    "carga.json": [("dia_referencia", "carga_energia_di", 0)],
    "geracao.json": [("dia_referencia", "balanco_energia_subsistema_ho", 0)],
    "rede.json": [("dia_referencia", "intercambio_nacional_ho", 0), ("dia_referencia_liquido", "balanco_energia_subsistema_ho", 0)],
    "cmo.json": [("semana_referencia", "cmo_se", 14)],
}


def data_local_captura(capturado_em):
    """Data, no horário de Brasília, de um instante de captura em UTC (AAAA-MM-DDTHH:MM:SSZ)."""
    dt = datetime.fromisoformat(capturado_em.replace("Z", "+00:00"))
    return dt.astimezone(BRASILIA).date()


def viola_horizonte(nome, gold, capturas):
    """Lista de violações. `capturas`: {dataset: último capturado_em (UTC)}."""
    v = []
    if not isinstance(gold, dict) or gold.get("disponivel") is not True:
        return v
    for campo, ds, folga in HORIZONTE.get(nome, []):
        ref, cap = gold.get(campo), capturas.get(ds)
        if not ref or not cap:
            continue
        limite = data_local_captura(cap) + timedelta(days=folga)
        if date.fromisoformat(ref[:10]) > limite:
            v.append(f"{nome}: {campo}={ref} além do horizonte de publicação ({limite.isoformat()}, captura {cap} de {ds})")
    return v
