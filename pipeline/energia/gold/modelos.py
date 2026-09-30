"""Gold do registro de modelos e do arquivo de previsões do PLD.

Fontes de verdade versionadas no git:
- pipeline/energia/registro_modelos.json  (estados, fórmulas, limitações, evidências)
- pipeline/energia/previsoes/arquivo.jsonl (registros anteriores ao particionamento; congelado)
- pipeline/energia/previsoes/emissoes/AAAA-MM.jsonl (registros novos, encadeados; append only)
- pipeline/energia/previsoes/apuracoes.jsonl (apurações registradas à mão, se houver; as
  apurações calculadas vão para previsoes_desempenho.json)

Publicação:
- public/energia/gold/previsoes.json: bloco principal (`atual`), resumo das rodadas, índice
  das partições (`emissoes`) e os registros anteriores ao particionamento (`arquivo`). Os
  registros novos NÃO entram inteiros aqui: o arquivo cresce todo dia e a gold é lida
  inteira pela página. Cada mês vai para public/energia/series/previsoes_emissoes_AAAA-MM.json,
  carregado sob demanda.
- public/energia/gold/modelos.json: registro de modelos.

A publicação falha (ViolacaoGovernanca) se qualquer regra de governança for violada, se a
cadeia de hashes quebrar ou se um registro já publicado num mês sumir ou mudar.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import governanca as g  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402
from pipeline.energia.previsoes import arquivo as arq  # noqa: E402

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRO = os.path.join(AQUI, "registro_modelos.json")
ARQUIVO = arq.LEGADO
APURACOES = os.path.join(AQUI, "previsoes", "apuracoes.jsonl")
PARTICAO_URL = "/energia/series/previsoes_emissoes_{mes}.json"
LIMITE_RODADAS = 60

MOTIVOS = {
    "NENHUM_MODELO_EM_PRODUCAO": "Nenhum modelo de previsão do PLD está em produção: todos estão em pesquisa, e modelo em pesquisa não pode alimentar a previsão oficial.",
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


def _resumo_rodadas(registros):
    rodadas = {}
    for r in registros:
        rodadas.setdefault(r["run_id"], []).append(r)
    out = []
    for run_id, rs in sorted(rodadas.items(), key=lambda kv: kv[1][0]["emitido_em"], reverse=True):
        out.append({
            "run_id": run_id, "tipo": rs[0]["tipo"], "origem": rs[0]["origem"], "cutoff": rs[0]["cutoff"],
            "emitido_em": rs[0]["emitido_em"], "modelo": rs[0]["modelo"], "versao_modelo": rs[0]["versao_modelo"],
            "estado_modelo": rs[0]["estado_modelo"], "celulas": len(rs),
            "com_numero": sum(1 for x in rs if x["previsao"] is not None),
            "motivos": sorted({x["motivo"] for x in rs if x.get("motivo")}),
            "alertas": sorted({a for x in rs for a in (x.get("alertas") or [])}),
            "modo": (rs[0].get("execucao") or {}).get("modo") or "manual",
        })
    return out


def _particoes_publicadas(destino):
    """{mês: [registros]} da publicação anterior (public/energia/series)."""
    out = {}
    if not os.path.isdir(destino):
        return out
    for nome in os.listdir(destino):
        if nome.startswith("previsoes_emissoes_") and nome.endswith(".json") and len(nome) == len("previsoes_emissoes_AAAA-MM.json"):
            with open(os.path.join(destino, nome), encoding="utf-8") as f:
                out[nome[19:26]] = json.load(f).get("registros", [])
    return out


def construir(anterior=None, pasta=arq.PASTA, legado=None, destino_series=None, escrever_particoes=True):
    """(previsoes.json, modelos.json). `anterior`: registros de `arquivo` da publicação
    anterior (o run.py passa os de previsoes.json); as partições são comparadas com a
    publicação anterior de cada mês em public/energia/series."""
    legado = legado or ARQUIVO
    destino_series = destino_series or base.SERIES
    with open(REGISTRO, encoding="utf-8") as f:
        registro = json.load(f)
    arquivo = g.le_jsonl(legado)
    particoes = arq.le_particoes(pasta)
    novos = [r for _, rs in sorted(particoes.items()) for r in rs]
    todos = arquivo + novos
    apuracoes = g.le_jsonl(APURACOES) if os.path.exists(APURACOES) else []
    por_codigo = {m["codigo"]: m for m in registro["modelos"]}
    liberados = (registro.get("publicacao_resultados") or {}).get("liberada")
    violacoes = g.valida_registro_modelos(registro) + g.valida_arquivo(todos, por_codigo, resultados_liberados=liberados)
    violacoes += arq.valida_particoes(pasta, legado)
    if anterior:
        violacoes += g.valida_append_only(anterior, arquivo)
    publicadas = _particoes_publicadas(destino_series)
    for mes, regs in publicadas.items():
        violacoes += g.valida_append_only(regs, particoes.get(mes, []))
    if violacoes:
        raise g.ViolacaoGovernanca("; ".join(violacoes[:10]))
    pode, cod = g.pode_publicar_previsao(registro["modelos"])
    resumo_rodadas = _resumo_rodadas(todos)
    publicacoes = [r for r in arquivo if r["tipo"] == "PUBLICACAO"]
    ultima_interna = resumo_rodadas[0] if resumo_rodadas else None
    indice = []
    for mes, regs in sorted(particoes.items()):
        conteudo = {"mes": mes, "registros": regs}
        texto = json.dumps(conteudo, ensure_ascii=False, sort_keys=True, allow_nan=False)
        if escrever_particoes:
            base._escreve_atomico(os.path.join(destino_series, f"previsoes_emissoes_{mes}.json"), texto)
        indice.append({"mes": mes, "url": PARTICAO_URL.format(mes=mes), "registros": len(regs),
                       "primeiro": regs[0]["forecast_id"] if regs else None, "ultimo_sha256": regs[-1]["sha256"] if regs else None,
                       "sha256_particao": base.sha256_bytes(texto.encode("utf-8")),
                       "por_tipo": {t: sum(1 for r in regs if r["tipo"] == t) for t in g.TIPOS_REGISTRO}})
    ref = [x for x in resumo_rodadas if x["tipo"] == "REFERENCIA_EXPERIMENTAL"]
    atual = {
        "disponivel": False,
        "motivo_codigo": "NENHUM_MODELO_EM_PRODUCAO" if not pode else None,
        "motivo": MOTIVOS["NENHUM_MODELO_EM_PRODUCAO"] if not pode else None,
        "ultima_execucao": ultima_interna,
        "informacao_faltante": [
            "Um modelo aprovado nas etapas de validação (revisão independente) e promovido a produção pelo responsável.",
            "Período prospectivo com rodadas registradas antes do realizado; para os candidatos, ele só começa depois da liberação "
            "formal de número em rodada interna.",
            "Rodadas agendadas reais no prazo (corte às 07h00 e emissão até 08h00 de Brasília) que comprovem a rotina.",
        ],
        "estado_pipeline": ("A rodada diária está implementada (pipeline/energia/previsoes/emissao.py) e agendada no workflow "
                            "previsao-pld.yml; a previsão principal segue sem número porque nenhum modelo está em produção. A "
                            "persistência (B0) aparece à parte como referência experimental identificada."),
    } if not pode else _atual_com_producao(cod, publicacoes, ultima_interna)
    return {
        **c.cabecalho("previsoes.json"),
        "atual": atual,
        "referencia_experimental": {
            "modelo": "B0", "ultima_rodada": ref[0] if ref else None,
            "detalhe": "public/energia/gold/previsoes_desempenho.json (previsao_atual)",
            "nota": ("Referência experimental de persistência, identificada como tal (seção 12.4 da especificação). Não é a "
                     "previsão principal nem previsão aprovada."),
        },
        "publicacoes": len(publicacoes),
        "rodadas": resumo_rodadas[:LIMITE_RODADAS],
        "rodadas_total": len(resumo_rodadas),
        "arquivo": arquivo,
        "emissoes": {"particoes": indice, "registros": len(novos), "cadeia": "íntegra",
                     "nota": ("Registros a partir do particionamento: um arquivo por mês de inclusão, carregado sob demanda. `arquivo` "
                              "guarda só os registros anteriores ao particionamento.")},
        "apuracoes": apuracoes,
        "regras": {
            "estados": "PESQUISA e VALIDAÇÃO nunca alimentam a previsão principal; só PRODUÇÃO.",
            "imutabilidade": ("Cada registro tem uma impressão digital do conteúdo (sha256) e guarda a do registro anterior: qualquer "
                              "alteração, remoção ou reordenação a denuncia. Correção cria um registro novo que aponta para o original e "
                              "declara o motivo; o original nunca é apagado."),
            "calibracao": f"Faixa P10 a P90 só é chamada de faixa de 80% quando a cobertura empírica fora do ajuste fica entre {int(g.CALIBRACAO_MIN * 100)}% e {int(g.CALIBRACAO_MAX * 100)}% com pelo menos {g.CALIBRACAO_N_MIN} casos (regra proposta, a ratificar).",
            "look_ahead": "Toda variável de entrada precisa ter sido capturada até o horário de corte da previsão.",
            "referencia_experimental": "B0 pode aparecer como referência experimental identificada, sem faixa não calibrada, sem promoção e fora do bloco principal.",
        },
    }, {
        **c.cabecalho("modelos.json"),
        "fonte": registro["fonte"],
        "publicacao_resultados": registro["publicacao_resultados"],
        "validacao_observatorio": registro.get("validacao_observatorio"),
        "definicoes": registro["definicoes"],
        "modelos": registro["modelos"],
        "pendencias": registro.get("pendencias", []),
        "em_producao": [m["codigo"] for m in registro["modelos"] if m["estado"] == "PRODUCAO"],
    }


def main():
    """Reconstrói previsoes.json, modelos.json e as partições (usado pelo workflow da rodada)."""
    anterior = (base.le_gold("previsoes.json") or {}).get("arquivo")
    prev, mods = construir(anterior)
    base.escreve_gold("previsoes.json", prev)
    base.escreve_gold("modelos.json", mods)
    print(f"[modelos] previsoes.json: {len(prev['rodadas'])} rodadas no resumo, {prev['emissoes']['registros']} registros particionados")
    return 0


if __name__ == "__main__":
    sys.exit(main())
