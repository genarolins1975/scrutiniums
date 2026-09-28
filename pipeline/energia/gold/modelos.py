"""Gold do registro de modelos e do arquivo de previsões do PLD.

Fontes de verdade versionadas no git:
- pipeline/energia/registro_modelos.json  (estados, fórmulas, limitações, evidências)
- pipeline/energia/previsoes/arquivo.jsonl (append only; um registro por célula)
- pipeline/energia/previsoes/apuracoes.jsonl (realizado e erro, chaveados por forecast_id)

A publicação falha (ViolacaoGovernanca) se qualquer regra de governança for violada.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import governanca as g  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRO = os.path.join(AQUI, "registro_modelos.json")
ARQUIVO = os.path.join(AQUI, "previsoes", "arquivo.jsonl")
APURACOES = os.path.join(AQUI, "previsoes", "apuracoes.jsonl")

MOTIVOS = {
    "NENHUM_MODELO_EM_PRODUCAO": "Nenhum modelo de previsão do PLD está em produção. Os quatro candidatos estão em pesquisa e não podem alimentar a previsão oficial.",
    "SEM_PLD_CAPTURADO_ATE_O_CORTE": "Nenhum PLD do período exigido havia sido capturado até o corte da rodada.",
}


def _atual_com_producao(cod, publicacoes, ultima_interna):
    """Modelo em produção só vira previsão principal quando há publicação disponível
    dele no arquivo; promovido sem publicação continua indisponível, com motivo."""
    pubs = [r for r in publicacoes if r["modelo"] == cod and r["status"] == "DISPONIVEL"]
    if pubs:
        return {"disponivel": True, "modelo": cod, "ultima_publicacao": max(pubs, key=lambda r: r["emitido_em"])["forecast_id"]}
    return {
        "disponivel": False,
        "motivo_codigo": "MODELO_EM_PRODUCAO_SEM_PUBLICACAO",
        "motivo": f"O modelo {cod} está em produção, mas ainda não há publicação disponível dele no arquivo imutável.",
        "ultima_execucao": ultima_interna,
        "informacao_faltante": ["Primeira rodada de publicação do modelo em produção registrada no arquivo."],
        "estado_pipeline": "Modelo promovido; aguardando a primeira publicação.",
    }


def construir(anterior=None):
    with open(REGISTRO, encoding="utf-8") as f:
        registro = json.load(f)
    arquivo = g.le_jsonl(ARQUIVO)
    apuracoes = g.le_jsonl(APURACOES) if os.path.exists(APURACOES) else []
    por_codigo = {m["codigo"]: m for m in registro["modelos"]}
    violacoes = g.valida_registro_modelos(registro) + g.valida_arquivo(arquivo, por_codigo)
    if anterior:
        violacoes += g.valida_append_only(anterior, arquivo)
    if violacoes:
        raise g.ViolacaoGovernanca("; ".join(violacoes[:10]))
    pode, cod = g.pode_publicar_previsao(registro["modelos"])
    rodadas = {}
    for r in arquivo:
        rodadas.setdefault(r["run_id"], []).append(r)
    resumo_rodadas = []
    for run_id, rs in sorted(rodadas.items(), key=lambda kv: kv[1][0]["emitido_em"], reverse=True):
        resumo_rodadas.append({
            "run_id": run_id, "tipo": rs[0]["tipo"], "origem": rs[0]["origem"], "cutoff": rs[0]["cutoff"],
            "emitido_em": rs[0]["emitido_em"], "modelo": rs[0]["modelo"], "versao_modelo": rs[0]["versao_modelo"],
            "estado_modelo": rs[0]["estado_modelo"], "celulas": len(rs),
            "com_numero": sum(1 for x in rs if x["previsao"] is not None),
            "motivos": sorted({x["motivo"] for x in rs if x.get("motivo")}),
            "alertas": sorted({a for x in rs for a in (x.get("alertas") or [])}),
        })
    publicacoes = [r for r in arquivo if r["tipo"] == "PUBLICACAO"]
    ultima_interna = resumo_rodadas[0] if resumo_rodadas else None
    atual = {
        "disponivel": False,
        "motivo_codigo": "NENHUM_MODELO_EM_PRODUCAO" if not pode else None,
        "motivo": MOTIVOS["NENHUM_MODELO_EM_PRODUCAO"] if not pode else None,
        "ultima_execucao": ultima_interna,
        "informacao_faltante": [
            "Modelo promovido a PRODUÇÃO pelos gates de validação e produção.",
            "Conclusão da última etapa de validação da pesquisa (etapa G4) e documentação de uma limitação encontrada na revisão (registro G23-R1).",
            "Captura do PLD antes do corte de cada rodada (07h00 de Brasília).",
        ],
        "estado_pipeline": "Registro e arquivo de previsões ativos; nenhuma publicação oficial; agendamento das rodadas não instalado.",
    } if not pode else _atual_com_producao(cod, publicacoes, ultima_interna)
    return {
        **c.cabecalho("previsoes.json"),
        "atual": atual,
        "publicacoes": len(publicacoes),
        "rodadas": resumo_rodadas,
        "arquivo": arquivo,
        "apuracoes": apuracoes,
        "regras": {
            "estados": "PESQUISA e VALIDAÇÃO nunca alimentam a previsão principal; só PRODUÇÃO.",
            "imutabilidade": "Cada registro tem sha256 do conteúdo canônico; correção cria novo registro com substitui e motivo, sem apagar o original.",
            "calibracao": f"Faixa P10 a P90 só é chamada de faixa de 80% quando a cobertura empírica fora do ajuste fica entre {int(g.CALIBRACAO_MIN * 100)}% e {int(g.CALIBRACAO_MAX * 100)}% com pelo menos {g.CALIBRACAO_N_MIN} casos (regra proposta, a ratificar).",
            "look_ahead": "Toda variável de entrada precisa ter sido capturada até o horário de corte da previsão.",
        },
    }, {
        **c.cabecalho("modelos.json"),
        "fonte": registro["fonte"],
        "publicacao_resultados": registro["publicacao_resultados"],
        "definicoes": registro["definicoes"],
        "modelos": registro["modelos"],
        "em_producao": [m["codigo"] for m in registro["modelos"] if m["estado"] == "PRODUCAO"],
    }
