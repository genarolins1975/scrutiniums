"""Construtor de variáveis da previsão do PLD, sem olhar para o futuro.

Duas travas, nesta ordem:

1. Captura: os valores vêm de `base.como_estava_em(con, dataset, serie, instante)`, a
   única consulta que devolve o dado como o sistema o tinha num instante (a vintage mais
   recente capturada até ali). Numa emissão real o instante é o corte da rodada; valor
   capturado depois do corte não existe para ela.
2. Elegibilidade: mesmo capturado, um período só é informação se terminou até k dias
   antes do corte (regra LATkD de calendario.py). A regra dos modelos registrados é LAT1D.

No teste retrospectivo, o sistema não tinha capturas nas origens antigas (a primeira
captura do PLD é de 27/09/2026), então o instante de captura é o do snapshot e só a trava
2 atua: é uma reconstrução sob a hipótese LAT1D, declarada como tal (achado A09), nunca
confundida com o teste prospectivo, em que as duas travas atuam.

Variáveis (definições do registro de modelos, com as escolhas que o registro não fixava
escritas aqui e na ficha de cada modelo):

* b0: média das horas do último período completo elegível da mesma frequência (semana de
  sábado a sábado para W, mês civil para M);
* mm: média móvel recente, média das horas dos últimos K períodos completos elegíveis da
  mesma frequência (K = 4 semanas para W; K = 3 meses para M), incluído o período do b0;
* saz: média das horas do mesmo período um ano antes da entrega (para W, a semana que
  começa 364 dias antes, também um sábado; para M, o mesmo mês do ano anterior);
* d7: média das horas dos 7 últimos dias completos elegíveis;
* ear28: EAR do submercado (% da capacidade, ONS) no último dia elegível menos a do 28º dia
  anterior, em pontos percentuais;
* ena7: média da ENA bruta (% da MLT, ONS) nos 7 últimos dias elegíveis.

Ausência nunca é preenchida: se faltar uma hora num período, a variável daquele período
fica None e a célula que depende dela fica indisponível, com motivo.
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.previsoes import calendario as cal  # noqa: E402

DS_PLD = "ccee_pld_horario"
DS_EAR = "ear_subsistema_di"
DS_ENA = "ena_subsistema_di"
SERIE_EAR = "ear_pct"
SERIE_ENA = "ena_bruta_pct_mlt"
K_MM = {"W": 4, "M": 3}
DIAS_D7 = 7
DIAS_EAR = 28
DIAS_ENA = 7

VARIAVEIS_P = ("mm_menos_b0", "saz_menos_b0", "d7_menos_b0")
VARIAVEIS_H = VARIAVEIS_P + ("ear28", "ena7_menos_100")
ROTULOS = {
    "mm_menos_b0": "Média móvel recente − B0 (R$/MWh)",
    "saz_menos_b0": "Mesmo período do ano anterior − B0 (R$/MWh)",
    "d7_menos_b0": "Média dos 7 últimos dias − B0 (R$/MWh)",
    "ear28": "Variação da EAR em 28 dias (p.p.)",
    "ena7_menos_100": "ENA bruta média de 7 dias (% da MLT) − 100",
}


class Informacao:
    """Dado disponível num instante de captura: PLD horário, EAR e ENA por submercado.

    `instante` None = vigente (todas as capturas). Guarda somas acumuladas por hora para
    médias exatas de qualquer intervalo em tempo constante; um intervalo com hora ausente
    não tem média."""

    def __init__(self, con, instante=None, submercados=cal.SUBMERCADOS, hidrologia=True, inicio=cal.INICIO_PLD_HORARIO):
        self.instante = base.instante_utc(instante) if instante else None
        self.inicio = inicio
        self.submercados = tuple(submercados)
        self._acum = {}
        self.ultima_hora = {}
        for sm in self.submercados:
            pontos = base.como_estava_em(con, DS_PLD, f"pld.{sm}", self.instante)
            self._indexa(sm, pontos)
        self.ear, self.ena = {}, {}
        if hidrologia:
            for sm in self.submercados:
                self.ear[sm] = {date.fromisoformat(r): v for r, v in base.como_estava_em(con, DS_EAR, f"{SERIE_EAR}.{sm}", self.instante)}
                self.ena[sm] = {date.fromisoformat(r): v for r, v in base.como_estava_em(con, DS_ENA, f"{SERIE_ENA}.{sm}", self.instante)}

    @classmethod
    def de_pontos(cls, pld, ear=None, ena=None, instante=None, inicio=cal.INICIO_PLD_HORARIO):
        """Informação a partir de pontos já lidos ({sm: [(ref, valor)]}, {sm: {data: valor}}).
        Usado nos testes, com amostras reais recortadas."""
        obj = cls.__new__(cls)
        obj.instante = instante
        obj.inicio = inicio
        obj.submercados = tuple(pld)
        obj._acum = {}
        obj.ultima_hora = {}
        for sm, pontos in pld.items():
            obj._indexa(sm, sorted(pontos))
        obj.ear = {sm: dict(v) for sm, v in (ear or {}).items()}
        obj.ena = {sm: dict(v) for sm, v in (ena or {}).items()}
        return obj

    def _indice(self, ref):
        d = date.fromisoformat(ref[:10])
        return 24 * (d - self.inicio).days + int(ref[11:13])

    def _indexa(self, sm, pontos):
        n = 0
        valores = {}
        for ref, v in pontos:
            i = self._indice(ref)
            if i < 0:
                continue
            valores[i] = v
            n = max(n, i + 1)
        soma, conta = [0.0] * (n + 1), [0] * (n + 1)
        s, c = 0.0, 0
        for i in range(n):
            v = valores.get(i)
            if v is not None:
                s += v
                c += 1
            soma[i + 1], conta[i + 1] = s, c
        self._acum[sm] = (soma, conta, n)
        self.ultima_hora[sm] = max((r for r, _ in pontos), default=None)

    def media_horas(self, sm, inicio, fim):
        """Média do PLD nas horas de [inicio, fim) (datas locais). None se faltar hora."""
        soma, conta, n = self._acum[sm]
        a = 24 * (inicio - self.inicio).days
        b = 24 * (fim - self.inicio).days
        if a < 0 or b > n or b <= a:
            return None
        if conta[b] - conta[a] != b - a:
            return None
        return (soma[b] - soma[a]) / (b - a)

    def horas_disponiveis(self, sm, inicio, fim):
        """Quantas horas de [inicio, fim) existem nesta informação."""
        soma, conta, n = self._acum[sm]
        a = max(0, 24 * (inicio - self.inicio).days)
        b = min(n, 24 * (fim - self.inicio).days)
        return max(0, conta[b] - conta[a]) if b > a else 0


def _var(valor, serie, inicio, fim, dataset):
    return {"valor": valor, "serie": serie, "inicio": inicio.isoformat(), "fim": fim.isoformat(), "dataset": dataset}


def basicas(info, origem, freq, sm, k=1, hidrologia=False):
    """Variáveis que não dependem da entrega: b0, mm, d7 (e ear28, ena7 com hidrologia).
    Cada uma com o período usado (fim excluído) para auditoria."""
    out = {}
    if freq == "W":
        ini = cal.ultima_semana_elegivel(origem, k)
        fim = ini + timedelta(days=7)
        ini_mm = ini - timedelta(days=7 * (K_MM["W"] - 1))
    else:
        ini = cal.ultimo_mes_elegivel(origem, k)
        fim = cal.soma_meses(ini, 1)
        ini_mm = cal.soma_meses(ini, -(K_MM["M"] - 1))
    serie = f"pld.{sm}"
    out["b0"] = _var(info.media_horas(sm, ini, fim), serie, ini, fim, DS_PLD)
    out["mm"] = _var(info.media_horas(sm, ini_mm, fim), serie, ini_mm, fim, DS_PLD)
    ult = cal.ultimo_dia_elegivel(origem, k)
    d7_ini, d7_fim = ult - timedelta(days=DIAS_D7 - 1), ult + timedelta(days=1)
    out["d7"] = _var(info.media_horas(sm, d7_ini, d7_fim), serie, d7_ini, d7_fim, DS_PLD)
    if hidrologia:
        ear = info.ear.get(sm, {})
        a, b = ear.get(ult - timedelta(days=DIAS_EAR)), ear.get(ult)
        out["ear28"] = _var(None if a is None or b is None else b - a, f"{SERIE_EAR}.{sm}",
                            ult - timedelta(days=DIAS_EAR), ult + timedelta(days=1), DS_EAR)
        ena = info.ena.get(sm, {})
        dias = [ult - timedelta(days=i) for i in range(DIAS_ENA)]
        vals = [ena.get(x) for x in dias]
        out["ena7"] = _var(None if any(v is None for v in vals) else sum(vals) / len(vals), f"{SERIE_ENA}.{sm}",
                           dias[-1], ult + timedelta(days=1), DS_ENA)
    return out


def sazonal(info, entrega_, sm):
    """Mesmo período um ano antes da entrega (sempre elegível: terminou há quase um ano)."""
    if entrega_["frequencia"] == "W":
        ini = entrega_["inicio"] - timedelta(days=364)
        fim = ini + timedelta(days=7)
    else:
        ini = entrega_["inicio"].replace(year=entrega_["inicio"].year - 1)
        fim = cal.soma_meses(ini, 1)
    return _var(info.media_horas(sm, ini, fim), f"pld.{sm}", ini, fim, DS_PLD)


def vetor(bas, saz, hidrologia):
    """Vetor x do C2 (None se faltar qualquer componente) e o dicionário nomeado."""
    b0 = bas["b0"]["valor"]
    comp = {}
    if b0 is None or bas["mm"]["valor"] is None or saz["valor"] is None or bas["d7"]["valor"] is None:
        return None, None
    comp["mm_menos_b0"] = bas["mm"]["valor"] - b0
    comp["saz_menos_b0"] = saz["valor"] - b0
    comp["d7_menos_b0"] = bas["d7"]["valor"] - b0
    nomes = VARIAVEIS_P
    if hidrologia:
        if bas.get("ear28", {}).get("valor") is None or bas.get("ena7", {}).get("valor") is None:
            return None, None
        comp["ear28"] = bas["ear28"]["valor"]
        comp["ena7_menos_100"] = bas["ena7"]["valor"] - 100.0
        nomes = VARIAVEIS_H
    return [comp[n] for n in nomes], comp


def realizado(info, entrega_, sm):
    """Realizado da entrega: média de todas as horas; None se a entrega não estiver completa."""
    return info.media_horas(sm, entrega_["inicio"], entrega_["fim"])


def capturas_usadas(con, dataset, serie, inicio, fim, instante, horaria=True):
    """Instante da captura mais recente, até `instante`, entre as vintages que deram o valor
    vigente de cada referência de [inicio, fim). É metadado de auditoria da emissão (os
    valores vêm de como_estava_em); None se nada foi capturado até o instante."""
    a = inicio.isoformat() + ("T00:00" if horaria else "")
    b = fim.isoformat() + ("T00:00" if horaria else "")
    filtro, extra = ("AND v.capturado_em <= ?", (base.instante_utc(instante),)) if instante else ("", ())
    row = con.execute(
        f"""SELECT MAX(v.capturado_em), COUNT(DISTINCT v.vintage_id) FROM observacoes o
            JOIN vintages v ON v.vintage_id = o.vintage_id
            WHERE o.dataset=? AND o.serie=? AND o.ref >= ? AND o.ref < ? {filtro}""",
        (dataset, serie, a, b, *extra)).fetchone()
    return {"capturado_em": row[0], "vintages": row[1]} if row and row[0] else {"capturado_em": None, "vintages": 0}
