"""Governança de previsão do PLD: bloqueios por arquitetura.

Estas funções são chamadas pelo builder de previsões (publicação) e pelos testes.
Cada regra corresponde a um item de docs/observatorios/PLD_GOVERNANCA_PREVISAO.md:

1. publicação só de modelo em PRODUCAO;
2. publicação exige versão de modelo, versão de código e snapshot;
3. nenhuma feature com capturado_em posterior ao cutoff;
4. registro publicado não muda de conteúdo sem nova versão (substitui + motivo);
5. faixa de 80% só com calibração CALIBRADO;
6. CENARIO nunca rotulado como previsão;
7. ausência de previsão nunca serializada como número.
"""
import hashlib
import json
from datetime import datetime, timezone

ESTADOS_MODELO = ("PESQUISA", "VALIDACAO", "PRODUCAO", "APOSENTADO")
TIPOS_REGISTRO = ("PUBLICACAO", "RODADA_INTERNA")
STATUS_REGISTRO = ("DISPONIVEL", "INDISPONIVEL")
# Regra proposta nesta fase (a ratificar pelo dono): cobertura empírica da faixa
# P10–P90 entre 75% e 85% em amostra fora do ajuste com n >= 100.
CALIBRACAO_MIN, CALIBRACAO_MAX, CALIBRACAO_N_MIN = 0.75, 0.85, 100


class ViolacaoGovernanca(Exception):
    pass


def hash_registro(rec):
    """sha256 do conteúdo canônico do registro (sem o próprio campo sha256)."""
    x = {k: v for k, v in rec.items() if k != "sha256"}
    return hashlib.sha256(json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _instante(valor):
    """datetime UTC a partir de ISO com fuso ('Z' ou deslocamento). None se ausente ou
    sem fuso: comparar datas como texto erra quando os fusos diferem."""
    if not isinstance(valor, str) or "T" not in valor:
        return None
    try:
        dt = datetime.fromisoformat(valor[:-1] + "+00:00" if valor.endswith("Z") else valor)
    except ValueError:
        return None
    return dt.astimezone(timezone.utc) if dt.tzinfo else None


def status_calibracao(cobertura, n):
    if cobertura is None or n is None:
        return "SEM_AVALIACAO"
    if n < CALIBRACAO_N_MIN:
        return "AMOSTRA_INSUFICIENTE"
    if CALIBRACAO_MIN <= cobertura <= CALIBRACAO_MAX:
        return "CALIBRADO"
    return "DESCALIBRADO"


def valida_registro(rec, modelos_por_codigo):
    """Lista de violações de um registro do arquivo (vazia = conforme)."""
    v = []
    if rec.get("tipo") not in TIPOS_REGISTRO:
        v.append(f"{rec.get('forecast_id')}: tipo inválido {rec.get('tipo')}")
    if rec.get("status") not in STATUS_REGISTRO:
        v.append(f"{rec.get('forecast_id')}: status inválido {rec.get('status')}")
    if rec.get("sha256") != hash_registro(rec):
        v.append(f"{rec.get('forecast_id')}: sha256 não confere com o conteúdo")
    # o arquivo só guarda previsões: natureza, quando declarada, é PREVISTO; nenhum
    # campo do registro pode carregar a marca de cenário
    if rec.get("natureza") not in (None, "PREVISTO"):
        v.append(f"{rec.get('forecast_id')}: natureza {rec.get('natureza')} não pode entrar no arquivo de previsões")
    if "CENARIO" in json.dumps(rec, ensure_ascii=False).upper().replace("CENÁRIO", "CENARIO"):
        v.append(f"{rec.get('forecast_id')}: cenário não pode entrar no arquivo de previsões")
    # faixa de 80% exige calibração em qualquer tipo de registro, publicado ou interno
    q = rec.get("quantis") or {}
    if q.get("rotulo_faixa") == "faixa de 80%" and (rec.get("calibracao") or {}).get("status") != "CALIBRADO":
        v.append(f"{rec.get('forecast_id')}: faixa rotulada como 80% sem calibração CALIBRADO")
    # nenhum registro, publicado ou interno, pode usar dado capturado depois do corte
    corte = _instante(rec.get("cutoff"))
    for feat in rec.get("features_usadas") or []:
        cap = _instante(feat.get("capturado_em"))
        if feat.get("capturado_em") and cap is None:
            v.append(f"{rec.get('forecast_id')}: feature {feat.get('serie')} com capturado_em sem fuso")
        elif cap and corte and cap > corte:
            v.append(f"{rec.get('forecast_id')}: feature {feat.get('serie')} capturada depois do cutoff (look-ahead)")
    # ausência nunca vira número
    if rec.get("status") == "INDISPONIVEL":
        if rec.get("previsao") is not None or rec.get("quantis"):
            v.append(f"{rec.get('forecast_id')}: indisponível com valor numérico")
        if not rec.get("motivo"):
            v.append(f"{rec.get('forecast_id')}: indisponível sem motivo")
    if rec.get("status") == "DISPONIVEL" and not isinstance(rec.get("previsao"), (int, float)):
        v.append(f"{rec.get('forecast_id')}: disponível sem valor numérico")
    if rec.get("tipo") == "PUBLICACAO":
        m = modelos_por_codigo.get(rec.get("modelo"))
        if not m or m.get("estado") != "PRODUCAO" or rec.get("estado_modelo") != "PRODUCAO":
            v.append(f"{rec.get('forecast_id')}: publicação de modelo que não está em PRODUCAO")
        for campo in ("versao_modelo", "versao_codigo", "snapshot", "cutoff", "emitido_em"):
            if not rec.get(campo):
                v.append(f"{rec.get('forecast_id')}: publicação sem {campo}")
        if _instante(rec.get("cutoff")) is None:
            v.append(f"{rec.get('forecast_id')}: publicação com cutoff sem fuso")
        # sem a lista de features não há como auditar look-ahead: publicação a exige
        if not rec.get("features_usadas"):
            v.append(f"{rec.get('forecast_id')}: publicação sem features_usadas")
        if rec.get("natureza") != "PREVISTO":
            v.append(f"{rec.get('forecast_id')}: publicação sem natureza PREVISTO")
    return v


def valida_arquivo(registros, modelos_por_codigo):
    v = []
    ids = set()
    for rec in registros:
        fid = rec.get("forecast_id")
        if fid in ids:
            v.append(f"{fid}: forecast_id duplicado")
        ids.add(fid)
        v.extend(valida_registro(rec, modelos_por_codigo))
        if rec.get("substitui"):
            if rec["substitui"] not in ids:
                v.append(f"{fid}: substitui registro inexistente ou posterior")
            if not rec.get("motivo_correcao"):
                v.append(f"{fid}: correção sem motivo")
    return v


def valida_append_only(anterior, novo):
    """Todo registro do arquivo anterior continua no novo, idêntico (mesmo sha256)."""
    v = []
    novo_por_id = {r["forecast_id"]: r for r in novo}
    for r in anterior:
        n = novo_por_id.get(r["forecast_id"])
        if n is None:
            v.append(f"{r['forecast_id']}: registro publicado foi removido")
        elif n.get("sha256") != r.get("sha256"):
            v.append(f"{r['forecast_id']}: registro publicado foi alterado")
    return v


def valida_registro_modelos(registro):
    v = []
    for m in registro.get("modelos", []):
        if m.get("estado") not in ESTADOS_MODELO:
            v.append(f"{m.get('codigo')}: estado inválido {m.get('estado')}")
        if m.get("estado") == "PRODUCAO" and not m.get("promovido_em"):
            v.append(f"{m.get('codigo')}: PRODUCAO sem data de promoção")
        if not m.get("limitacoes"):
            v.append(f"{m.get('codigo')}: sem limitações registradas")
    pub = registro.get("publicacao_resultados") or {}
    if pub.get("liberada") is False and not pub.get("motivo"):
        v.append("publicação de resultados retida sem motivo")
    return v


def pode_publicar_previsao(modelos):
    """(pode, motivo). Só há bloco principal de previsão com modelo em PRODUCAO."""
    prod = [m for m in modelos if m.get("estado") == "PRODUCAO"]
    if not prod:
        return False, "NENHUM_MODELO_EM_PRODUCAO"
    return True, prod[0]["codigo"]


def le_jsonl(caminho):
    out = []
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha:
                out.append(json.loads(linha))
    return out
