"""Testes de retrato: conferem números de um retrato específico da fonte (por exemplo, as contagens do SIGA de
30/09/2026 refeitas por outro script) e não o comportamento do código, que vale para qualquer dado.

Decisão do dono de 24/10/2026: retrato não barra a publicação da gold nem o CI. Com TESTES_SEM_RETRATO=1 (barreira
do workflow de energia, jobs bloqueantes do CI, verificar:pr e verificar:rapido) o teste fica de fora, pulado com o
motivo; os retratos rodam à parte em `npm run testes:retrato` (scripts/testes-retrato.mjs), que relata quando divergem
da gold do dia, e a divergência vira issue para reconferência, não retenção.

Marcar como retrato só o teste cujo número fixo vem de um retrato datado da fonte; regra de coerência (somas que
fecham, texto que sai do dado, fichas sem reprovação) continua barrando.
"""
import os
import unittest

VARIAVEL = "TESTES_SEM_RETRATO"


def retrato(de_que):
    """Marca um teste (método ou classe) como retrato de `de_que` (fonte e data do retrato que ele fixa)."""
    def marca(obj):
        obj.__retrato__ = de_que
        return unittest.skipIf(os.environ.get(VARIAVEL) == "1",
                               f"retrato ({de_que}): roda à parte, em npm run testes:retrato")(obj)
    return marca
