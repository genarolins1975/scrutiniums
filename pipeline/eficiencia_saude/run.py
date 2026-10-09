"""Execução do pipeline do módulo Saúde nas capitais.

    python3 -m pipeline.eficiencia_saude.run                    reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.eficiencia_saude.run --coleta-siconfi   recoleta DCA, RREO 02 e MSC da função 10 (rede)
    python3 -m pipeline.eficiencia_saude.run --coleta-siops     recoleta o Anexo 12 e a despesa por fonte do SIOPS (rede)
    python3 -m pipeline.eficiencia_saude.run --coleta-cnes      recoleta o retrato do CNES e o histórico por estabelecimento (rede; longa)
    python3 -m pipeline.eficiencia_saude.run --coleta-aps       recoleta o Relatório APS (cobertura e equipes), capitais e Brasil (rede)
    python3 -m pipeline.eficiencia_saude.run --coleta-ripsa     reextrai ICSAP, internações e planos dos arquivos do RIPSA (rede, 80 MB)

A reconstrução sem rede imprime as validações e termina com código 1 se alguma for reprovada; nesse caso a saída pública anterior fica intacta.
Nenhuma etapa escreve em arquivos de Educação.
"""
import argparse
import sys

from pipeline.eficiencia_saude import gold, padroniza as P


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta-siconfi", action="store_true")
    ap.add_argument("--coleta-siops", action="store_true")
    ap.add_argument("--coleta-cnes", action="store_true")
    ap.add_argument("--coleta-aps", action="store_true")
    ap.add_argument("--coleta-ripsa", action="store_true")
    a = ap.parse_args(argv)
    if a.coleta_siconfi:
        from pipeline.eficiencia_saude.fontes import siconfi
        siconfi.coleta(P.ANOS_FINANCEIROS)
        siconfi.coleta_msc_todas(P.ANOS_FINANCEIROS)
    if a.coleta_siops:
        from pipeline.eficiencia_saude.fontes import siops
        siops.coleta(P.ANOS_FINANCEIROS)
    if a.coleta_cnes:
        from pipeline.eficiencia_saude.fontes import cnes
        cnes.retrato()
        print("histórico:", cnes.coleta_historico())
    if a.coleta_aps:
        from pipeline.eficiencia_saude.fontes import relatorio_aps
        relatorio_aps.coleta()
        relatorio_aps.coleta_brasil()
    if a.coleta_ripsa:
        from pipeline.eficiencia_saude.fontes import ripsa
        ripsa.extrai_icsap()
        ripsa.extrai_internacoes()
        ripsa.extrai_planos()
    g = gold.constroi()
    promovido, caminho = gold.promove(g)
    for id_, res in gold.resumo_validacoes(g):
        print(f"{id_}: {res}")
    print(f"observações: {g['meta']['observacoes']}; hash_dados: {g['meta']['hash_dados'][:16]}")
    if not promovido:
        print(f"validação reprovada ({', '.join(gold.reprovadas(g))}): gold NÃO promovida; diagnóstico em {caminho}", file=sys.stderr)
        return 1
    print(f"gold promovida: {caminho}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
