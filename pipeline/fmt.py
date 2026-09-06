"""Auxiliares de formatação e de calendário compartilhados pelos builders.

Até 06/09/2026 `_r`, `_share`, `_mes_menos`, `_mil` e `_dec` existiam em até doze
módulos, copiados um do outro, com duas variantes de `_share` e duas de
`_mes_menos` (auditoria de 06/09/2026, achado T5). Um só lugar evita que uma
correção de arredondamento ou de unidade valha numa página e não noutra.
Regras: ausência é None e continua None; nada aqui converte None em zero.
"""


def _r(v, d=2):
    """Arredonda preservando ausência."""
    return None if v is None else round(v, d)


def _share(v, tot):
    """Participação percentual; None quando falta numerador ou denominador."""
    return _r(v / tot * 100) if v is not None and tot else None


def _mes_menos(mes, n):
    """'2026-07' menos n meses -> 'AAAA-MM'."""
    y, m = int(mes[:4]), int(mes[5:7])
    t = y * 12 + (m - 1) - n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def _mil(v):
    """Inteiro com ponto de milhar (padrão brasileiro) para a síntese."""
    return f"{v:,.0f}".replace(",", ".")


def _dec(v, d=1):
    """Decimal com vírgula (padrão brasileiro) para a síntese."""
    return f"{v:.{d}f}".replace(".", ",")
