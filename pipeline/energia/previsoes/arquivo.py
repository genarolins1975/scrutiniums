"""Arquivo imutável de emissões da previsão do PLD, particionado por mês.

Fonte de verdade versionada no git:

* pipeline/energia/previsoes/arquivo.jsonl: registros anteriores ao particionamento (a
  rodada interna de 27/09/2026, escrita a partir do artefato de pesquisa). Congelado: não
  recebe linha nova, e o teste de governança confere cada registro contra uma lista fixa.
* pipeline/energia/previsoes/emissoes/AAAA-MM.jsonl: registros novos, uma linha por célula
  (origem × horizonte × submercado × modelo), no mês de inclusão no arquivo
  (`registrado_no_portal_em`). Só recebem linhas no fim (append).

Por que particionar: o arquivo cresce 28 linhas por modelo por dia; carregado inteiro numa
gold lida pela página, ele passaria do limite de peso em poucos meses. A página carrega o
índice (gold) e cada mês sob demanda (public/energia/series/previsoes_emissoes_AAAA-MM.json).

Imutabilidade, em três camadas: sha256 do conteúdo canônico de cada registro; encadeamento
(cada registro novo guarda em `anterior` o sha256 do registro anterior, na ordem do
arquivo); e comparação com a publicação anterior de cada mês (nada some nem muda). Correção
nunca sobrescreve: cria registro novo com `substitui` e `motivo_correcao`.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import governanca as g  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
LEGADO = os.path.join(AQUI, "arquivo.jsonl")
PASTA = os.path.join(AQUI, "emissoes")


def particoes(pasta=PASTA):
    """[(AAAA-MM, caminho)] em ordem de mês."""
    if not os.path.isdir(pasta):
        return []
    out = []
    for nome in sorted(os.listdir(pasta)):
        if len(nome) == len("AAAA-MM.jsonl") and nome.endswith(".jsonl") and nome[4] == "-":
            out.append((nome[:7], os.path.join(pasta, nome)))
    return out


def le_legado(caminho=LEGADO):
    return g.le_jsonl(caminho) if os.path.exists(caminho) else []


def le_particoes(pasta=PASTA):
    """{mês: [registros]} na ordem das linhas."""
    return {mes: g.le_jsonl(c) for mes, c in particoes(pasta)}


def le_tudo(pasta=PASTA, legado=LEGADO):
    """Todos os registros na ordem do arquivo: legado e depois cada mês."""
    out = list(le_legado(legado))
    for _, regs in sorted(le_particoes(pasta).items()):
        out.extend(regs)
    return out


def ultimo_sha(pasta=PASTA, legado=LEGADO):
    regs = le_tudo(pasta, legado)
    return regs[-1]["sha256"] if regs else None


def sela(rec):
    """Registro com sha256 do conteúdo canônico (sem o próprio campo)."""
    rec = {k: v for k, v in rec.items() if k != "sha256"}
    rec["sha256"] = g.hash_registro(rec)
    return rec


def anexa(registros, pasta=PASTA, legado=LEGADO):
    """Acrescenta registros no fim da partição do mês de inclusão, encadeando cada um no
    anterior e selando o sha256. Recusa forecast_id repetido. Devolve os registros gravados."""
    existentes = le_tudo(pasta, legado)
    ids = {r["forecast_id"] for r in existentes}
    anterior = existentes[-1]["sha256"] if existentes else None
    gravados = []
    os.makedirs(pasta, exist_ok=True)
    for rec in registros:
        if rec["forecast_id"] in ids:
            raise g.ViolacaoGovernanca(f"{rec['forecast_id']}: já existe no arquivo (registro não é reescrito)")
        rec = sela({**rec, "anterior": anterior})
        mes = rec["registrado_no_portal_em"][:7]
        with open(os.path.join(pasta, f"{mes}.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False, sort_keys=True, allow_nan=False) + "\n")
        ids.add(rec["forecast_id"])
        anterior = rec["sha256"]
        gravados.append(rec)
    return gravados


def valida_particoes(pasta=PASTA, legado=LEGADO):
    """Violações estruturais: mês da partição igual ao mês de inclusão, ordem de inclusão
    não decrescente e cadeia íntegra."""
    v = []
    ultimo = ""
    for mes, regs in sorted(le_particoes(pasta).items()):
        for r in regs:
            if (r.get("registrado_no_portal_em") or "")[:7] != mes:
                v.append(f"{r.get('forecast_id')}: registrado em {r.get('registrado_no_portal_em')} mas está na partição {mes}")
            if (r.get("registrado_no_portal_em") or "") < ultimo:
                v.append(f"{r.get('forecast_id')}: inclusão fora de ordem no arquivo")
            ultimo = max(ultimo, r.get("registrado_no_portal_em") or "")
    v.extend(g.valida_cadeia(le_tudo(pasta, legado)))
    return v
