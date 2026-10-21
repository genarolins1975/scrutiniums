#!/usr/bin/env python3
"""Efeito da composição variável sobre a série da mediana das capitais (visão Evolução sem capital escolhida):
compara a mediana publicada (capitais elegíveis em cada ano) com a mediana de um painel equilibrado (as mesmas capitais em todos os anos)."""
import csv, statistics, sys
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E
linhas = []
for m in E.MEDIDA:
    ets = E.ETAPAS_MEDIDA.get(m, [None])
    for et in ets:
        for moeda in (["nominal", "real"] if m.startswith("despesa") else ["nominal"]):
            for disc in (["matematica", "portugues"] if m == "saeb" else ["matematica"]):
                ser = {}
                for a in E.ANOS[m]:
                    c = E.comparacao(m, a, et, moeda, disc)
                    ser[a] = {cc["cod_ibge"]: o["valor"] for cc, o in c["inc"]}
                anos = [a for a in E.ANOS[m] if ser[a]]
                if len(anos) < 2: continue
                comuns = set.intersection(*[set(ser[a]) for a in anos])
                if not comuns: continue
                a0, a1 = anos[0], anos[-1]
                if statistics.median(ser[a0].values()) == 0 or statistics.median([ser[a0][c] for c in comuns]) == 0: continue  # variação relativa indefinida (base zero)
                pub0, pub1 = statistics.median(ser[a0].values()), statistics.median(ser[a1].values())
                bal0, bal1 = statistics.median([ser[a0][c] for c in comuns]), statistics.median([ser[a1][c] for c in comuns])
                ns = [len(ser[a]) for a in anos]
                linhas.append((m, et or "", moeda, disc if m == "saeb" else "", a0, a1, min(ns), max(ns), len(comuns), round(pub0, 3), round(pub1, 3), round(100 * (pub1 / pub0 - 1), 1), round(bal0, 3), round(bal1, 3), round(100 * (bal1 / bal0 - 1), 1), round(100 * (pub1 / pub0 - 1) - 100 * (bal1 / bal0 - 1), 1)))
with open("/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados/composicao_mediana_serie.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["medida", "etapa", "moeda", "disciplina", "primeiro_ano", "ultimo_ano", "n_min", "n_max", "n_painel_equilibrado", "mediana_publicada_inicio", "mediana_publicada_fim", "variacao_publicada_pct", "mediana_equilibrada_inicio", "mediana_equilibrada_fim", "variacao_equilibrada_pct", "diferenca_pontos_pct"])
    w.writerows(linhas)
linhas.sort(key=lambda r: -abs(r[-1]))
for r in linhas[:14]: print(r)
print(len(linhas), "séries; com n variável:", sum(1 for r in linhas if r[6] != r[7]))
