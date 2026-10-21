"""Governança de previsão do PLD: bloqueios por arquitetura.

Estas funções são chamadas pelo builder de previsões (publicação) e pelos testes.
Cada regra corresponde a um item de docs/observatorios/PLD_GOVERNANCA_PREVISAO.md:

1. publicação só de modelo em PRODUCAO;
2. publicação exige versão de modelo, versão de código e snapshot;
3. nenhuma feature com capturado_em posterior ao cutoff;
4. registro publicado não muda de conteúdo sem nova versão (substitui + motivo);
5. faixa de 80% só com calibração CALIBRADO;
6. CENARIO nunca rotulado como previsão;
7. ausência de previsão nunca serializada como número;
8. referência experimental (seção 12.4 da especificação): só de modelo cujo registro a
   autoriza com as condições verificadas, identificada como tal, com corte, versões e
   variáveis auditáveis; nunca substitui a previsão principal nem vira PUBLICACAO;
9. arquivo encadeado: cada registro novo guarda o sha256 do anterior (`anterior`), então
   apagar, reordenar ou editar um registro do meio quebra a cadeia.
"""
import hashlib
import json
import math
import re
from datetime import datetime, timezone

ESTADOS_MODELO = ("PESQUISA", "VALIDACAO", "PRODUCAO", "APOSENTADO")
TIPOS_REGISTRO = ("PUBLICACAO", "RODADA_INTERNA", "REFERENCIA_EXPERIMENTAL")
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
    # faixa rotulada como 80% exige calibração CALIBRADO em qualquer tipo de registro,
    # publicado ou interno. Qualquer menção a 80 no rótulo conta ("80%", "80 pct",
    # "faixa de 80", "oitenta por cento", "0,8"), assim como "P10 a P90"
    q = rec.get("quantis") or {}
    rotulo = str(q.get("rotulo_faixa") or "").lower()
    if (re.search(r"(?<![\d,.])(80|oitenta)(?![\d])", rotulo) or re.search(r"(?<![\d,.])0[,.]8(?!\d)", rotulo)
            or re.search(r"p\s*10\s*(a|até|ao|-|–|—)\s*p\s*90", rotulo)) \
            and (rec.get("calibracao") or {}).get("status") != "CALIBRADO":
        v.append(f"{rec.get('forecast_id')}: faixa rotulada como 80% sem calibração CALIBRADO")
    # nenhum registro, publicado ou interno, pode usar dado capturado depois do corte;
    # sem instante com fuso no corte ou na captura, o look-ahead não é auditável
    feats = rec.get("features_usadas") or []
    corte = _instante(rec.get("cutoff"))
    if feats and corte is None:
        v.append(f"{rec.get('forecast_id')}: cutoff sem fuso em registro com features (look-ahead não auditável)")
    for feat in feats:
        cap = _instante(feat.get("capturado_em"))
        if cap is None:
            v.append(f"{rec.get('forecast_id')}: feature {feat.get('serie')} sem capturado_em com fuso")
        elif corte and cap > corte:
            v.append(f"{rec.get('forecast_id')}: feature {feat.get('serie')} capturada depois do cutoff (look-ahead)")
    # ausência nunca vira número
    if rec.get("status") == "INDISPONIVEL":
        if rec.get("previsao") is not None or rec.get("quantis"):
            v.append(f"{rec.get('forecast_id')}: indisponível com valor numérico")
        if not rec.get("motivo"):
            v.append(f"{rec.get('forecast_id')}: indisponível sem motivo")
    if rec.get("status") == "DISPONIVEL" and not _numero_finito(rec.get("previsao")):
        v.append(f"{rec.get('forecast_id')}: disponível sem valor numérico finito")
    # erro nunca vira valor: NaN e infinito não entram em nenhum campo numérico
    for campo, valor in [("previsao", rec.get("previsao"))] + [(f"quantis.{k}", x) for k, x in q.items() if k != "rotulo_faixa"]:
        if isinstance(valor, float) and not math.isfinite(valor):
            v.append(f"{rec.get('forecast_id')}: {campo} não finito")
    if rec.get("tipo") == "REFERENCIA_EXPERIMENTAL":
        v.extend(_valida_referencia_experimental(rec, modelos_por_codigo))
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


def _valida_referencia_experimental(rec, modelos_por_codigo):
    """Referência experimental (B0): número real permitido quando o registro do modelo a
    autoriza e as condições da seção 12.4 (cálculo e disponibilidade temporal validados)
    estão marcadas como verificadas, com evidência. A autorização vem da regra do
    responsável na especificação, não de liberação de resultados de pesquisa; por isso
    não depende de `resultados_liberados`, e não promove nem aprova o modelo."""
    v = []
    fid = rec.get("forecast_id")
    m = modelos_por_codigo.get(rec.get("modelo")) or {}
    ref = m.get("referencia_experimental") or {}
    if not ref.get("autorizada"):
        v.append(f"{fid}: modelo {rec.get('modelo')} sem autorização de referência experimental no registro")
    condicoes = ref.get("condicoes") or []
    if not condicoes or not all(c_.get("verificada") is True and c_.get("evidencia") for c_ in condicoes):
        v.append(f"{fid}: referência experimental sem as condições verificadas e com evidência")
    for campo in ("versao_modelo", "versao_codigo", "cutoff", "emitido_em", "rotulo"):
        if not rec.get(campo):
            v.append(f"{fid}: referência experimental sem {campo}")
    if "referência experimental" not in str(rec.get("rotulo") or "").lower():
        v.append(f"{fid}: referência experimental sem identificação no rótulo")
    if rec.get("natureza") != "PREVISTO":
        v.append(f"{fid}: referência experimental sem natureza PREVISTO")
    if rec.get("status") == "DISPONIVEL" and not rec.get("features_usadas"):
        v.append(f"{fid}: referência experimental disponível sem features_usadas")
    # faixa só com calibração aprovada: o modelo de persistência emite um ponto; banda
    # sem método validado seria incerteza inventada (seção 12.2)
    if rec.get("quantis") and (rec.get("calibracao") or {}).get("status") != "CALIBRADO":
        v.append(f"{fid}: referência experimental com quantis sem calibração CALIBRADO")
    return v


def valida_cadeia(registros):
    """Encadeamento: todo registro com o campo `anterior` aponta para o sha256 do registro
    imediatamente anterior na ordem do arquivo. Os registros antigos, anteriores ao
    encadeamento, não têm o campo; depois do primeiro registro encadeado, todos têm."""
    v = []
    anterior_sha, encadeado = None, False
    for rec in registros:
        if "anterior" in rec:
            encadeado = True
            if rec.get("anterior") != anterior_sha:
                v.append(f"{rec.get('forecast_id')}: cadeia quebrada (anterior não é o sha256 do registro anterior)")
        elif encadeado:
            v.append(f"{rec.get('forecast_id')}: registro sem encadeamento depois do início da cadeia")
        anterior_sha = rec.get("sha256")
    return v


def _numero_finito(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def valida_arquivo(registros, modelos_por_codigo, *, resultados_liberados):
    """O arquivo é publicado na íntegra, então a decisão sobre resultados de pesquisa é
    obrigatória e explícita (docs/observatorios/PLD_GOVERNANCA_PREVISAO.md):
    resultados_liberados=False: rodada interna não pode carregar número;
    resultados_liberados=True (liberação formal registrada): rodada interna pode carregar
    número, sempre com tipo RODADA_INTERNA; nunca vira PUBLICACAO."""
    if not isinstance(resultados_liberados, bool):
        raise ValueError("resultados_liberados deve ser True ou False: a decisão sobre números de pesquisa é explícita")
    v = []
    ids = set()
    for rec in registros:
        fid = rec.get("forecast_id")
        if fid in ids:
            v.append(f"{fid}: forecast_id duplicado")
        ids.add(fid)
        v.extend(valida_registro(rec, modelos_por_codigo))
        if resultados_liberados is False and rec.get("tipo") == "RODADA_INTERNA" and rec.get("previsao") is not None:
            v.append(f"{fid}: rodada interna com número enquanto a publicação de resultados está retida")
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
