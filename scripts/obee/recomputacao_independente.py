"""Recomputação separada do pipeline: refaz despesa por habitante e a razão da despesa de aplicação direta por matrícula direto das sementes
versionadas (DCA, IBGE, MSC, Censo Escolar), sem importar nada de pipeline.eficiencia, e compara com a gold.

Escrita pelo autor do pipeline: serve de conferência reproduzível por outro código, não de revisão externa.
Uso: python3 -I scripts/obee/recomputacao_independente.py [ano] [capital ...]
Sai com código 1 se qualquer comparação divergir de R$ 0,01 (reais) ou de uma matrícula.
"""
import csv
import gzip
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(RAIZ, "pipeline", "eficiencia", "seed")
GOLD = os.path.join(RAIZ, "public", "eficiencia", "gold", "educacao_capitais.json")
CAPITAIS_PADRAO = ["sao-paulo", "palmas", "recife", "natal", "boa-vista", "porto-alegre", "rio-de-janeiro", "campo-grande"]


def lj(caminho):
    with gzip.open(caminho, "rt", encoding="utf-8") as f:
        return json.load(f)


def despesa_dca(cod, ano):
    # conta "12 - Educação", coluna "Despesas Liquidadas", total geral por função do Anexo I-E
    achadas = [r for r in lj(os.path.join(SEED, "siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz"))
               if r.get("cod_conta") == "TotalDespesas" and r.get("conta") == "12 - Educação" and r.get("coluna") == "Despesas Liquidadas"]
    if len(achadas) != 1:
        return None
    return float(achadas[0]["valor"])


def populacao(cod, ano):
    ach = [r for r in lj(os.path.join(SEED, "ibge_populacao", "populacao_capitais.json.gz")) if r["cod"] == cod and r["ano"] == ano]
    return ach[0]["valor"] if len(ach) == 1 else None


def matriculas(cod, ano):
    # soma de QT_MAT_BAS das escolas com TP_DEPENDENCIA = 3 no município
    caminho = os.path.join(SEED, "inep_censo", f"escolas_capitais_{ano}.csv.gz")
    with gzip.open(caminho, "rt", encoding="utf-8") as f:
        linhas = [r for r in csv.DictReader(f) if r["CO_MUNICIPIO"] == str(cod) and r["TP_DEPENDENCIA"] == "3"]
    return sum(int(r["QT_MAT_BAS"] or 0) for r in linhas)


MODALIDADES = {"20", "22", "30", "31", "32", "35", "36", "40", "41", "42", "45", "46", "50", "60", "67", "70", "71", "72", "73", "74", "75", "76",
               "80", "90", "91", "92", "93", "94", "95", "96", "99"}   # as 31 da tabela oficial (MCASP 11ª edição / MTO 2025)


def numerador_msc(cod, ano):
    """Refaz, por outro código, o numerador da razão por matrícula (versão 1.3 da metodologia).

    Função 12, contas de despesa liquidada (6221303, 6221304, 6221307), saldo líquido por linha (natureza C soma, D subtrai).
    Numerador: modalidades 90 (aplicação direta) e 93 e 94 (compras de consórcio, desdobramento da 90), exceto subfunção 364
    (ensino superior) e elementos 01, 03 e 05 do grupo 31 (inativos). Fora: 91 (intra), 92, 67, 95, 96, 99, transferências.
    A parcela indeterminada é a do numerador em elementos 18, 39, 41, 45 e 48 (fora do grupo 31) e nas modalidades 93 e 94.
    Devolve (numerador, total sem intra, sem natureza, modalidade fora da lista, parcela indeterminada)."""
    caminho = os.path.join(SEED, "siconfi", "msc_funcao12", f"{cod}_{ano}_12.json.gz")
    if not os.path.exists(caminho):
        return None
    num = sem_intra = sem_nat = fora_lista = indet = 0.0
    for x in lj(caminho):
        if str(x["funcao"]) != "12" or str(x["conta_contabil"])[:7] not in ("6221303", "6221304", "6221307"):
            continue
        v = float(x["valor"]) * (1 if x["natureza_conta"] == "C" else -1 if x["natureza_conta"] == "D" else float("nan"))
        nd = str(x.get("natureza_despesa") or "")
        if not nd:
            sem_nat += v
            sem_intra += v
            continue
        mod, grupo, elem = nd[2:4], nd[:2], nd[4:6]
        if mod == "91":
            continue
        sem_intra += v
        if mod not in MODALIDADES:
            fora_lista += v
            continue
        if mod not in ("90", "93", "94") or str(x["subfuncao"]) == "364" or (grupo == "31" and elem in ("01", "03", "05")):
            continue
        num += v
        if mod in ("93", "94") or (grupo != "31" and elem in ("18", "39", "41", "45", "48")):
            indet += v
    return round(num, 2), round(sem_intra, 2), round(sem_nat, 2), round(fora_lista, 2), round(indet, 2)


def main():
    ano = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    ids = sys.argv[2:] or CAPITAIS_PADRAO
    g = json.load(open(GOLD, encoding="utf-8"))
    caps = {c["id"]: c for c in g["universo"]["capitais"]}
    obs = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
    divergencias = 0
    print(f"Recomputação independente, exercício {ano}, valores nominais (R$ correntes)")
    for i in ids:
        c = caps[i]
        cod = c["cod_ibge"]
        d, pop, mat = despesa_dca(cod, ano), populacao(cod, ano), matriculas(cod, ano)
        hab = None if d is None or not pop else d / pop
        m = numerador_msc(cod, ano)
        mat_valor = None
        if m and d is not None and mat and m[2] <= 1.0 and m[3] <= 1.0 and abs(m[1] - d) <= max(1.0, 0.001 * d):
            mat_valor = m[0] / mat
        gh = obs.get(("edu.despesa.por_habitante", cod, ano, None, "nominal"))
        gm = obs.get(("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, "nominal"))
        gd = obs.get(("edu.despesa.funcao_educacao", cod, ano, None, "nominal"))
        gmat = obs.get(("edu.matriculas.rede_municipal", cod, ano, "total", None))
        linhas = [
            ("despesa DCA", d, gd and gd["valor"], 0.01),
            ("população", pop, gh and gh.get("calculo", {}).get("denominador"), 0.5),
            ("despesa por habitante", hab, gh and gh["valor"], 0.01),
            ("matrículas", mat, gmat and gmat["valor"], 0.5),
            ("razão por matrícula", mat_valor, gm and gm["valor"], 0.01),
        ]
        print(f"\n{c['nome']} ({c['uf']}), código {cod}")
        for nome, a, b, tol in linhas:
            if a is None and b is None:
                st = "ambos sem valor"
            elif a is None or b is None:
                st = "DIVERGE (um lado sem valor)"
                divergencias += 1
            elif abs(a - b) <= tol:
                st = "confere"
            else:
                st = "DIVERGE"
                divergencias += 1
            fa = "sem valor" if a is None else f"{a:,.2f}"
            fb = "sem valor" if b is None else f"{b:,.2f}"
            print(f"  {nome:<24} recomputado {fa:>22}   gold {fb:>22}   {st}")
        if m:
            print(f"  ponte: aplicação direta (numerador) {m[0]:,.2f}, dos quais beneficiário indeterminado {m[4]:,.2f}; total da MSC sem intra {m[1]:,.2f}; sem natureza {m[2]:,.2f}; modalidade fora da lista {m[3]:,.2f}")
    print(f"\n{'sem divergências' if divergencias == 0 else str(divergencias) + ' divergência(s)'}")
    return 0 if divergencias == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
