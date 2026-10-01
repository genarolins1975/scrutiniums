"""Modelos de previsão do PLD médio por entrega: B0, S0, C2-P e C2-H.

* B0 (persistência): o b0 do construtor de variáveis, média das horas do último período
  completo elegível da mesma frequência. É a régua: um candidato só interessa se errar
  menos que ele.
* S0 (sazonal): média das horas do mesmo período um ano antes da entrega. Referência
  sazonal exigida pela seção 12.3; não é candidato.
* C2-P e C2-H (correção penalizada da persistência):
      C2 = B0 + Σ_j (x_j / escala_j) · β_j,
  sem intercepto, coeficiente de B0 fixo em 1, escala_j = raiz da média de x_j² no treino
  (escala RMS), β estimado por mínimos quadrados com penalização quadrática
  λ · n · Σβ² sobre o alvo y − B0. λ = ZERO desliga a correção (β = 0 ⇒ C2 = B0).
  C2-P usa as três variáveis de preço; C2-H soma a variação da EAR em 28 dias e a ENA
  média de 7 dias. Um modelo por segmento (horizonte × submercado).

Ajuste (fixado antes de qualquer avaliação; a configuração tem sha256 registrado):

* origem de ajuste semanal: os coeficientes são estimados a cada domingo e valem para as
  origens de domingo a sábado seguintes; a emissão diária usa os do último domingo;
* treino: só pares (variáveis na origem o, realizado da entrega de o) cuja entrega
  terminou e é informação sob LATkD no corte da origem de ajuste;
* mínimo de treino: 52 entregas distintas (W) e 24 meses completos (M); abaixo disso a
  célula fica indisponível (nunca vira B0 às escondidas);
* escolha de λ em cada origem de ajuste por validação interna no próprio passado: as
  últimas 25% das entregas do treino (mínimo 4) validam, o treino interno termina antes
  da primeira origem de validação menos k dias (sem sobreposição), critério erro
  quadrático; empate fica com a penalização maior.

Quantis: empíricos, a partir dos resíduos (realizado − previsão final) do próprio modelo no
segmento, só de entregas que já eram informação no corte da origem, nas últimas 52
semanas (W) ou 24 meses (M); exigem pelo menos 24 entregas distintas. Níveis 5, 10, 25,
50, 75, 90 e 95%. Resíduos de origens diárias sobre a mesma entrega entram todos (cada
origem é uma previsão), o que pesa as entregas pelo número de origens.

Restrição de preço: previsão e quantis ficam dentro da faixa [média diária do PLD mínimo,
média diária do teto estrutural] vigente nos dias da entrega segundo os atos da ANEEL já
publicados no dia da origem. Se o ato do ano da entrega ainda não saiu, vale o vigente no
dia da origem (faixa provisória, sinalizada). A média de uma entrega nunca fica abaixo do
piso nem acima do teto estrutural médio, porque cada hora está acima do piso e cada dia
tem média até o teto estrutural.
"""
import hashlib
import json
import math
import os
import sys
from bisect import bisect_right
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

NIVEIS = (0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95)
ROTULOS_NIVEIS = ("p05", "p10", "p25", "p50", "p75", "p90", "p95")
GRADE_LAMBDA = ("ZERO", 3.0, 1.0, 0.3, 0.1, 0.03, 0.01, 0.001)
MIN_TREINO = {"W": 52, "M": 24}
JANELA_RESIDUOS = {"W": 52, "M": 24}
MIN_RESIDUOS = 24
FRACAO_VALIDACAO = 0.25
MIN_VALIDACAO = 4

MODELOS = ("B0", "S0", "C2-P", "C2-H")
VERSOES = {"B0": "B0-v1", "S0": "S0-v1", "C2-P": "C2-P-obs1", "C2-H": "C2-H-obs1"}


def configuracao():
    """Configuração congelada dos modelos implementados (entra no sha256 registrado)."""
    from pipeline.energia.previsoes import variaveis as v
    return {
        "versoes": VERSOES, "niveis_quantis": list(NIVEIS), "grade_lambda": list(GRADE_LAMBDA),
        "min_treino_entregas": MIN_TREINO, "janela_residuos_entregas": JANELA_RESIDUOS,
        "min_residuos_entregas": MIN_RESIDUOS, "fracao_validacao": FRACAO_VALIDACAO, "min_validacao": MIN_VALIDACAO,
        "origem_de_ajuste": "domingo (semanal)", "criterio_lambda": "erro quadrático na validação interna",
        "k_media_movel": v.K_MM, "dias_d7": v.DIAS_D7, "dias_ear": v.DIAS_EAR, "dias_ena": v.DIAS_ENA,
        "serie_ear": v.SERIE_EAR, "serie_ena": v.SERIE_ENA, "variaveis_p": list(v.VARIAVEIS_P),
        "variaveis_h": list(v.VARIAVEIS_H), "elegibilidade": "LAT1D",
        "restricao_preco": "faixa [piso, teto estrutural] médios diários dos atos publicados até a origem",
    }


def sha_configuracao():
    return hashlib.sha256(json.dumps(configuracao(), sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- álgebra (sem numpy)

def resolve(a, b):
    """Resolve a · x = b (a quadrada, pequena) por eliminação com pivotamento parcial."""
    n = len(b)
    m = [list(a[i]) + [b[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda i: abs(m[i][col]))
        if abs(m[piv][col]) < 1e-12:
            raise ZeroDivisionError("sistema singular")
        m[col], m[piv] = m[piv], m[col]
        for i in range(col + 1, n):
            f = m[i][col] / m[col][col]
            if f:
                for j in range(col, n + 1):
                    m[i][j] -= f * m[col][j]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (m[i][n] - sum(m[i][j] * x[j] for j in range(i + 1, n))) / m[i][i]
    return x


class Acumulados:
    """Somas acumuladas de x·xᵀ, x·z, z² por linha, para ajustes em qualquer prefixo ou
    intervalo de linhas em tempo O(p³), sem reler as linhas."""

    def __init__(self, xs, zs):
        p = len(xs[0]) if xs else 0
        self.p = p
        self.sxx = [[[0.0] * p for _ in range(p)]]
        self.sxz = [[0.0] * p]
        self.szz = [0.0]
        for x, z in zip(xs, zs):
            ant_xx, ant_xz = self.sxx[-1], self.sxz[-1]
            self.sxx.append([[ant_xx[i][j] + x[i] * x[j] for j in range(p)] for i in range(p)])
            self.sxz.append([ant_xz[i] + x[i] * z for i in range(p)])
            self.szz.append(self.szz[-1] + z * z)

    def intervalo(self, a, b):
        p = self.p
        xx = [[self.sxx[b][i][j] - self.sxx[a][i][j] for j in range(p)] for i in range(p)]
        xz = [self.sxz[b][i] - self.sxz[a][i] for i in range(p)]
        return xx, xz, self.szz[b] - self.szz[a], b - a


def _escala(xx, n):
    return [math.sqrt(xx[i][i] / n) if n and xx[i][i] > 0 else 0.0 for i in range(len(xx))]


def ajuste_ridge(xx, xz, n, lam, escala):
    """β na escala padronizada para um λ (ZERO ⇒ zeros). Variável sem variação (escala 0)
    fica com β = 0."""
    p = len(xz)
    if lam == "ZERO" or n == 0:
        return [0.0] * p
    ativos = [i for i in range(p) if escala[i] > 0]
    if not ativos:
        return [0.0] * p
    a = [[xx[i][j] / (escala[i] * escala[j]) + (lam * n if i == j else 0.0) for j in ativos] for i in ativos]
    b = [xz[i] / escala[i] for i in ativos]
    sol = resolve(a, b)
    beta = [0.0] * p
    for k, i in enumerate(ativos):
        beta[i] = sol[k]
    return beta


def _sse(xx, xz, zz, beta, escala):
    """Σ (z − Σ β_j x_j / escala_j)² a partir das somas do intervalo de validação."""
    p = len(beta)
    g = [beta[i] / escala[i] if escala[i] > 0 else 0.0 for i in range(p)]
    return zz - 2 * sum(g[i] * xz[i] for i in range(p)) + sum(g[i] * g[j] * xx[i][j] for i in range(p) for j in range(p))


def ajusta_c2(acum, fins, origens, i_fim, k, freq):
    """Ajuste numa origem de ajuste usando as linhas [0, i_fim) do segmento (já maturadas).
    `fins` e `origens`: datas de fim da entrega e de origem de cada linha (ordem temporal).
    Devolve dict com λ, β na escala padronizada, escala, coeficientes na unidade original
    e contagens; ou None com motivo quando o treino é insuficiente."""
    entregas_treino = len(set(fins[:i_fim]))
    if entregas_treino < MIN_TREINO[freq]:
        return {"ok": False, "motivo": "TREINO_INSUFICIENTE", "entregas_treino": entregas_treino}
    distintas = sorted(set(fins[:i_fim]))
    n_val = max(MIN_VALIDACAO, int(round(FRACAO_VALIDACAO * len(distintas))))
    primeira_val_fim = distintas[-n_val]
    v0 = next(i for i in range(i_fim) if fins[i] >= primeira_val_fim)
    # treino interno: entregas que já eram informação na primeira origem de validação
    limite = origens[v0] - timedelta(days=k)
    j = bisect_right(fins, limite, 0, v0)
    melhor = ("ZERO", None)
    if j > 0:
        xx_t, xz_t, _, n_t = acum.intervalo(0, j)
        esc_t = _escala(xx_t, n_t)
        xx_v, xz_v, zz_v, _ = acum.intervalo(v0, i_fim)
        resultados = []
        for lam in GRADE_LAMBDA:
            try:
                beta = ajuste_ridge(xx_t, xz_t, n_t, lam, esc_t)
            except ZeroDivisionError:
                continue
            resultados.append((_sse(xx_v, xz_v, zz_v, beta, esc_t), lam))
        # empate (até 1e-9 relativo) fica com a penalização maior: ZERO primeiro na grade
        menor = min(s for s, _ in resultados)
        melhor = (next(lam for s, lam in resultados if s <= menor * (1 + 1e-9) + 1e-12), menor)
    lam = melhor[0]
    xx, xz, _, n = acum.intervalo(0, i_fim)
    esc = _escala(xx, n)
    beta = ajuste_ridge(xx, xz, n, lam, esc)
    coef = [beta[i] / esc[i] if esc[i] > 0 else 0.0 for i in range(len(beta))]
    return {"ok": True, "lambda": lam, "beta_escalado": beta, "escala_rms": esc, "coef": coef,
            "linhas_treino": n, "entregas_treino": entregas_treino, "linhas_validacao": i_fim - v0,
            "entregas_validacao": n_val, "linhas_treino_interno": j}


def preve_c2(b0, x, ajuste):
    return b0 + sum(c * xi for c, xi in zip(ajuste["coef"], x))


# ---------------------------------------------------------------- quantis empíricos

def quantil(xs_ordenados, q):
    """Quantil tipo 7 (interpolação linear; padrão de R e NumPy) de lista já ordenada."""
    n = len(xs_ordenados)
    if n == 1:
        return xs_ordenados[0]
    pos = (n - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return xs_ordenados[lo] + (xs_ordenados[hi] - xs_ordenados[lo]) * (pos - lo)


def quantis_residuos(residuos):
    """{p05..p95: quantil} dos resíduos (lista não vazia)."""
    xs = sorted(residuos)
    return {r: quantil(xs, q) for r, q in zip(ROTULOS_NIVEIS, NIVEIS)}


def pinball(y, q, nivel):
    """Perda quantílica de um quantil q de nível `nivel` para o realizado y (R$/MWh)."""
    return max(nivel * (y - q), (nivel - 1) * (y - q))


# ---------------------------------------------------------------- limites do PLD

class LimitesConhecidos:
    """Faixa de preço conhecida num dia de origem, a partir dos atos da ANEEL (módulo
    Regulação: pipeline.energia.regulatorio.limites_pld()). Ato só vale depois de publicado:
    publicação no próprio dia da origem não conta (às 07h o Diário Oficial pode não ter
    saído). Ato sem data de publicação registrada (REH nº 2.828/2020, para 2021) conta como
    publicado antes da sua vigência."""

    def __init__(self, atos):
        self.atos = [a for a in (atos or []) if a.get("vigencia_inicio") and a.get("vigencia_fim")]
        self._cache = {}

    def _publicado_ate(self, a, origem):
        pub = a.get("data_publicacao")
        if pub is None:
            return True
        return date.fromisoformat(pub) < origem

    def _campo_no_dia(self, campo, dia, conhecidos):
        cands = [a for a in conhecidos if a.get(campo) is not None and a["vigencia_inicio"] <= dia <= a["vigencia_fim"]]
        if not cands:
            return None, None
        topo = max(cands, key=lambda a: (a.get("data_publicacao") or "", a["vigencia_inicio"]))
        return topo[campo], topo["ato"]

    def faixa(self, entrega_, origem):
        """(piso médio, teto estrutural médio, provisória, atos usados) para a entrega.
        None nos dois limites quando nenhum ato é conhecido."""
        conhecidos = [a for a in self.atos if self._publicado_ate(a, origem)]
        chave = (entrega_["id"], len(conhecidos))
        if chave in self._cache:
            return self._cache[chave]
        pisos, tetos, atos, provisoria = [], [], set(), False
        d = entrega_["inicio"]
        oiso = origem.isoformat()
        while d < entrega_["fim"]:
            iso = d.isoformat()
            valores = []
            for campo in ("pld_min", "pld_max_estrutural"):
                v, ato = self._campo_no_dia(campo, iso, conhecidos)
                if v is None:
                    v, ato = self._campo_no_dia(campo, oiso, conhecidos)
                    if v is not None:
                        provisoria = True
                valores.append(v)
                if ato:
                    atos.add(ato)
            pisos.append(valores[0])
            tetos.append(valores[1])
            d += timedelta(days=1)
        lo = sum(pisos) / len(pisos) if pisos and all(p is not None for p in pisos) else None
        hi = sum(tetos) / len(tetos) if tetos and all(t is not None for t in tetos) else None
        out = (lo, hi, provisoria, sorted(atos))
        self._cache[chave] = out
        return out


def restringe(valor, lo, hi):
    """Valor dentro de [lo, hi] (limite None não restringe). Devolve (valor, ajustado)."""
    if valor is None:
        return None, False
    v = valor
    if lo is not None and v < lo:
        v = lo
    if hi is not None and v > hi:
        v = hi
    return v, v != valor


def quantis_finais(prev, qres, lo, hi):
    """Quantis = previsão + quantil do resíduo, restritos à faixa. A restrição é monótona,
    então os quantis continuam ordenados; a ordem é conferida mesmo assim."""
    out = {}
    for r in ROTULOS_NIVEIS:
        out[r], _ = restringe(prev + qres[r], lo, hi)
    vals = [out[r] for r in ROTULOS_NIVEIS]
    if any(vals[i] > vals[i + 1] + 1e-9 for i in range(len(vals) - 1)):
        raise AssertionError("quantis cruzados")
    return out
