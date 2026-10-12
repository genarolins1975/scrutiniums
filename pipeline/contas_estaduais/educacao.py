"""Regras de elegibilidade de CE-34 e pareamento com CE-35.

Não coleta nem promove observações. A conferência de metadados não substitui
a validação dos bytes, das contas e da documentação do perímetro na ingestão.
"""
from dataclasses import dataclass
from math import isfinite
import re
from urllib.parse import urlparse

UFS = frozenset("AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split())
ETAPAS = frozenset(("fundamental_anos_iniciais_regular", "fundamental_anos_finais_regular", "ensino_medio_regular"))


@dataclass(frozen=True)
class Recorte:
    uf: str
    ano: int
    rede: str
    etapa: str
    abrangencia: str
    # Identificador da população atendida, definido na documentação de ingestão.
    universo: str


@dataclass(frozen=True)
class Evidencia:
    url: str
    sha256: str
    arquivo: str
    campo: str


@dataclass(frozen=True)
class Despesa:
    recorte: Recorte
    valor: float | None
    evidencia: Evidencia
    estagio: str
    moeda: str
    periodo: str
    perimetro: str
    # Documento versionado que concilia contas, rateios e exclusões à rede/etapa.
    conciliacao: Evidencia | None


@dataclass(frozen=True)
class Matriculas:
    recorte: Recorte
    valor: int | None
    evidencia: Evidencia
    conceito: str


@dataclass(frozen=True)
class Resultado:
    recorte: Recorte
    valor: float | None
    evidencia: Evidencia
    indicador: str


@dataclass(frozen=True)
class Avaliacao:
    elegivel: bool
    valor: float | None
    unidade: str
    motivos: tuple[str, ...]


@dataclass(frozen=True)
class Pareamento:
    despesa_por_matricula: Avaliacao
    ideb: Avaliacao
    elegivel: bool
    motivos: tuple[str, ...]


def _evidencia(e):
    return (isinstance(e, Evidencia)
            and urlparse(e.url).scheme == "https" and bool(urlparse(e.url).netloc)
            and re.fullmatch(r"[0-9a-f]{64}", e.sha256) is not None
            and bool(e.arquivo.strip()) and bool(e.campo.strip()))


def _numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v)


def _recorte(r):
    motivos = []
    if r.uf not in UFS:
        motivos.append("uf_invalida")
    if type(r.ano) is not int or not 2000 <= r.ano <= 2100:
        motivos.append("ano_invalido")
    if r.rede != "estadual":
        motivos.append("rede_nao_estadual")
    if r.etapa not in ETAPAS:
        motivos.append("etapa_nao_elegivel")
    if r.abrangencia != "uf_inteira":
        motivos.append("territorio_incompleto")
    if not r.universo.strip():
        motivos.append("universo_nao_documentado")
    return motivos


def _diferencas(a, b):
    return [f"{campo}_incompativel" for campo in
            ("uf", "ano", "rede", "etapa", "abrangencia", "universo")
            if getattr(a, campo) != getattr(b, campo)]


def _avaliacao(valor, unidade, motivos):
    return Avaliacao(not motivos, None if motivos else valor, unidade,
                     tuple(dict.fromkeys(motivos)))


def avaliar_despesa_por_matricula(d, m):
    """CE-34: razão contábil nominal, nunca denominada custo por aluno."""
    motivos = _recorte(d.recorte) + _recorte(m.recorte)
    motivos += _diferencas(d.recorte, m.recorte)
    for nome, evidencia in (("despesa", d.evidencia), ("matriculas", m.evidencia)):
        if not _evidencia(evidencia):
            motivos.append(f"evidencia_{nome}_incompleta")
    if not _evidencia(d.conciliacao):
        motivos.append("conciliacao_perimetro_ausente")
    if d.estagio != "liquidada":
        motivos.append("estagio_incompativel")
    if d.moeda != "BRL_nominal":
        motivos.append("base_monetaria_incompativel")
    if d.periodo != "janeiro_dezembro":
        motivos.append("exercicio_incompleto")
    if d.perimetro != "rede_etapa_conciliada":
        motivos.append("perimetro_despesa_incompativel")
    if m.conceito != "matriculas_censo":
        motivos.append("conceito_denominador_incompativel")
    if d.valor is None:
        motivos.append("despesa_ausente")
    elif not _numero(d.valor) or d.valor < 0:
        motivos.append("despesa_invalida")
    if m.valor is None:
        motivos.append("matriculas_ausentes")
    elif type(m.valor) is not int or m.valor <= 0:
        motivos.append("matriculas_nao_positivas_ou_nao_inteiras")
    valor = None if motivos else d.valor / m.valor
    if valor is not None and not isfinite(valor):
        motivos.append("razao_nao_finita")
    return _avaliacao(valor, "BRL_nominal/matricula", motivos)


def avaliar_ideb(r):
    """Validação estrutural; critérios e supressões da fonte devem vir da ingestão."""
    motivos = _recorte(r.recorte)
    if not _evidencia(r.evidencia):
        motivos.append("evidencia_resultado_incompleta")
    if r.indicador != "ideb":
        motivos.append("indicador_resultado_incompativel")
    if r.valor is None:
        motivos.append("resultado_ausente")
    elif not _numero(r.valor) or not 0 <= r.valor <= 10:
        motivos.append("ideb_fora_da_escala")
    return _avaliacao(r.valor, "pontos_ideb", motivos)


def avaliar_pareamento(d, m, r):
    """Exige coincidência de recorte; não calcula eficiência, ranking ou causalidade."""
    gasto = avaliar_despesa_por_matricula(d, m)
    ideb = avaliar_ideb(r)
    motivos = list(gasto.motivos) + list(ideb.motivos)
    motivos += _diferencas(d.recorte, r.recorte)
    return Pareamento(gasto, ideb, not motivos, tuple(dict.fromkeys(motivos)))
