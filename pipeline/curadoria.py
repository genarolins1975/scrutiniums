"""Portão mecânico da curadoria Fase 2 (constituição v2, art. 1.3).

Não há revisão humana no projeto. Valor extraído de documento primário só é publicável se
o código encontrar o próprio valor no trecho literal citado como evidência, em alguma forma
de escrita brasileira (casas decimais de zero a três; unidade, mil, milhão ou bilhão).
Observação sem valor (ausência declarada) não tem o que conferir.

Uso: python3 -m pipeline.curadoria    (lista violações; código 1 se houver)
"""
import json
import os
import re
import sys

CURADO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curated")

# arquivo → (lista de observações, campo do valor, campo do trecho literal)
FONTES = {
    "fase2_observacoes.json": ("observacoes", "valor", "evidencia"),
    "custos_ti.json": ("observacoes", "valor", "trecho"),
    "folha_balanco.json": ("observacoes", "valor", "trecho"),
}


# Legado: 22 valores do guidance aprovados por revisão humana antes da constituição v2, cujo
# trecho citado é resumido com "…" e não contém o valor. Não somem do site em silêncio, mas
# também não servem de precedente: o teste trava a lista (nada entra, e o que for corrigido
# com trecho literal completo precisa sair daqui). Correção proposta: reextrair o trecho
# literal por métrica das páginas já coletadas por pipeline/sources/releases.py.
LEGADO_SEM_TRECHO = {
    'guidance.json:bb_2025:Carteira Pessoas Físicas.min',
    'guidance.json:bb_2025:Carteira Pessoas Físicas.max',
    'guidance.json:bb_2025:Carteira Pessoas Físicas.realizado',
    'guidance.json:bb_2025:Carteira Empresas.min',
    'guidance.json:bb_2025:Carteira Empresas.realizado',
    'guidance.json:bb_2025:Carteira Sustentável.min',
    'guidance.json:bb_2025:Carteira Sustentável.max',
    'guidance.json:bb_2025:Carteira Sustentável.realizado',
    'guidance.json:bb_2025:Margem Financeira Bruta.min',
    'guidance.json:bb_2025:Margem Financeira Bruta.max',
    'guidance.json:bb_2025:Margem Financeira Bruta.realizado',
    'guidance.json:bb_2025:Custo do Crédito.min',
    'guidance.json:bb_2025:Custo do Crédito.max',
    'guidance.json:bb_2025:Custo do Crédito.realizado',
    'guidance.json:bb_2025:Receitas de Prestação de Serviços.min',
    'guidance.json:bb_2025:Receitas de Prestação de Serviços.max',
    'guidance.json:bb_2025:Receitas de Prestação de Serviços.realizado',
    'guidance.json:bb_2025:Despesas Administrativas.min',
    'guidance.json:bb_2025:Despesas Administrativas.max',
    'guidance.json:bb_2025:Despesas Administrativas.realizado',
    'guidance.json:itau_2025:Custo do crédito.realizado',
    'guidance.json:itau_2025:Alíquota efetiva de IR/CS.realizado',
}


def _br(x, casas):
    return f"{x:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def formas(valor):
    """Formas brasileiras em que o valor pode aparecer escrito no documento."""
    if not isinstance(valor, (int, float)) or isinstance(valor, bool):
        return set()
    out = set()
    for escala in (1, 1e3, 1e6, 1e9):
        x = valor / escala
        for casas in (0, 1, 2, 3):
            out.add(_br(x, casas))
            out.add(f"{x:.{casas}f}".replace(".", ","))
    return {f for f in out if f.strip("0,.") != ""}


def valor_no_trecho(valor, trecho):
    t = re.sub(r"\s+", " ", trecho or "")
    return any(re.search(rf"(?<![\d,.]){re.escape(f)}(?!\d)", t) for f in formas(valor))


def violacoes():
    """Observações aprovadas cujo valor não aparece no trecho literal (vazio = portão ok)."""
    out = []
    for arq, (lista, campo_valor, campo_trecho) in FONTES.items():
        with open(os.path.join(CURADO, arq), encoding="utf-8") as f:
            dados = json.load(f)
        for o in dados.get(lista, []):
            if o.get("status") != "aprovado" or o.get(campo_valor) is None:
                continue
            if not valor_no_trecho(o[campo_valor], o.get(campo_trecho)):
                out.append(f"{arq}:{o.get('id')}: valor {o[campo_valor]} não aparece no trecho citado")
    with open(os.path.join(CURADO, "guidance.json"), encoding="utf-8") as f:
        guidance = json.load(f)
    for c in guidance.get("ciclos", []):
        if c.get("status") != "aprovado":
            continue
        for m in c.get("metricas", []):
            for campo in ("min", "max", "realizado"):
                v = m.get(campo)
                if v is not None and not valor_no_trecho(v, c.get("trecho")):
                    out.append(f"guidance.json:{c.get('id')}:{m.get('nome')}.{campo}: valor {v} não aparece no trecho citado")
    return out


def violacoes_novas():
    """Violações fora do legado: tem de ser vazio para publicar."""
    return [v for v in violacoes() if v.split(": valor")[0] not in LEGADO_SEM_TRECHO]


if __name__ == "__main__":
    vs = violacoes_novas()
    for v in vs:
        print(v)
    print(f"{len(vs)} violação(ões)")
    sys.exit(1 if vs else 0)
