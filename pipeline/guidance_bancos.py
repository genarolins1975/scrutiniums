"""Guidance × entregue — gold guidance.json (Fase 2: publica só aprovado).

Ciclos anuais de projeções dos grandes bancos listados, extraídos dos
documentos oficiais protocolados na CVM (IPE/ENET), com evidência completa.

As três regras editoriais viajam no gold e são testadas:
1. Cada banco SÓ contra o próprio guidance — conceitos gerenciais e bases
   ajustadas diferem por banco; nunca comparar cumprimento entre bancos,
   nunca médias nem ranking de cumprimento (o builder não computa nenhum
   agregado entre bancos, de propósito).
2. `situacao` (dentro/acima/abaixo) é posição ARITMÉTICA no intervalo
   declarado, não juízo de mérito — para despesa, acima é pior; para
   receita, melhor; o painel não converte isso em nota.
3. `aferido_por` declara quem pareou intervalo e realizado: a companhia
   (quando ela própria publica a reconciliação) ou o Observatório (linhas
   da mesma DRE gerencial do banco, com fórmula declarada por métrica).
"""
import json
from pathlib import Path

from pipeline import common

CURADO = Path(__file__).resolve().parent / "curated" / "guidance.json"


def build(con=None, cfg=None):
    cur = json.loads(CURADO.read_text())
    docs = cur.get("documentos", {})
    aprovados, em_revisao, acomp_em_revisao = [], 0, 0
    for c in cur.get("ciclos", []):
        if c.get("status") == "aprovado":
            # acompanhamentos trimestrais (revisões/manutenções do guidance em
            # curso) têm o próprio gate: só os aprovados são publicados
            acomps = []
            for a in c.get("acompanhamentos", []) or []:
                if a.get("status") == "aprovado":
                    da = docs.get(a.get("documento"), {})
                    acomps.append({k: a.get(k) for k in ("periodo", "tipo", "resumo", "mudancas",
                                                         "realizado_parcial", "pagina", "trecho", "revisor")}
                                  | {"documento": {"titulo": da.get("titulo"), "url": da.get("url")}})
                elif a.get("status") == "em_revisao":
                    acomp_em_revisao += 1
            aprovados.append({
                "acompanhamentos": acomps,
                "acompanhamento_pendente": c.get("acompanhamento_pendente"),
                "id": c["id"], "banco": c["banco"], "cnpj8": c.get("cnpj8"),
                "ano": c["ano"], "tipo": c["tipo"], "aferido_por": c["aferido_por"],
                "conceito": c["conceito"], "pagina": c.get("pagina"), "trecho": c.get("trecho"),
                "metricas": c.get("metricas", []),
                "documentos": {k: {"titulo": d.get("titulo"), "url": d.get("url")}
                               for k, d in ((k2, docs.get(c.get(k2))) for k2 in
                                            ("documento_guidance", "documento_realizado"))
                               if d},
                "revisor": c.get("revisor"),
            })
        elif c.get("status") == "em_revisao":
            em_revisao += 1
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Guidance × entregue",
        "ciclos": aprovados,
        "em_revisao": em_revisao,
        "acompanhamentos_em_revisao": acomp_em_revisao,
        "leitura": ("O que cada grande banco listado prometeu ao mercado para o ano — e o que entregou, "
                    "pela régua declarada pelo próprio banco. Ciclos fechados mostram intervalo × realizado; "
                    "o ciclo vigente mostra as promessas em curso, acompanhadas a cada divulgação."),
        "cautelas": [
            "Cada banco SÓ contra o próprio guidance: conceitos gerenciais e bases ajustadas diferem por banco — cumprimento NUNCA é comparado, somado ou ranqueado entre bancos.",
            "'Dentro/acima/abaixo' é posição aritmética no intervalo declarado, não juízo de mérito: para despesa, acima é pior; para receita, melhor — o painel não converte isso em nota.",
            "Guidance não é promessa jurídica: são projeções sujeitas a riscos e revisões, como os próprios documentos declaram.",
            "Quando o banco muda a base de cálculo entre ciclos (ex.: DRE ajustada do Itaú para 2026), os ciclos não são comparáveis entre si — a mudança é declarada no conceito.",
        ],
        "fonte": {"nome": "CVM/IPE — documentos de resultados protocolados pelos próprios bancos (ENET)",
                  "nivel": "A",
                  "nota": "evidência por ciclo: documento oficial, página e trecho; extração aprovada por revisor"},
    }
    common.write_gold("guidance.json", g)
    return {"ok": True, "ciclos_publicados": len(aprovados), "em_revisao": em_revisao}
