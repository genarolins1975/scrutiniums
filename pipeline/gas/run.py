"""Execução do pipeline do Observatório Brasileiro de Gás Natural.

    python3 -m pipeline.gas.run                      reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.gas.run --coleta             recoleta todas as fontes (rede) e reconstrói
    python3 -m pipeline.gas.run --coleta anp_producao,ibge_ipca
    python3 -m pipeline.gas.run --coleta anp_movimentacao --pasta-movimentacao <pasta>
                                                     usa cópias locais dos arquivos mensais (nome: <ano>_<arquivo>.csv)
"""
import argparse
import sys

from pipeline.gas import fontes, gold


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta", nargs="?", const="todas", default=None, help="ids separados por vírgula, ou nada para todas")
    ap.add_argument("--pasta-movimentacao", default=None)
    a = ap.parse_args(argv)
    if a.coleta:
        ids = None if a.coleta == "todas" else a.coleta.split(",")
        falhas = fontes.coletar(ids, a.pasta_movimentacao)
        if falhas:
            # fonte que falhou mantém o seed anterior; a gold é reconstruída com ele e o manifesto guarda a data real da captura
            print(f"{len(falhas)} fonte(s) sem atualização: {', '.join(sorted(falhas))}", file=sys.stderr)
    s = gold.construir()
    print(f"gold do gás: {len(s.golds)} arquivos, {len(s.series)} séries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
