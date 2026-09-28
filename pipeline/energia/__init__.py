"""Domínio Energia: pipeline do Observatório Brasileiro do Setor Elétrico.

Mesmo contrato do pipeline do Crédito (biblioteca padrão, bronze imutável com
sha256, escrita atômica, stub de falha), com uma diferença deliberada: o silver
guarda TODAS as vintages de cada observação, para que features de modelo e
backtests consultem o dado como ele estava num instante (como_estava_em).
"""
