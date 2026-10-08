"""Execução do pipeline do OBEE.

    python3 -m pipeline.eficiencia.run                 reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.eficiencia.run --coleta-siconfi   recoleta DCA, RREO, entes e IPCA (rede)
    python3 -m pipeline.eficiencia.run --inep <pasta>  reextrai os recortes do INEP a partir dos .zip
                                                       oficiais já baixados nessa pasta

A coleta do INEP não baixa os pacotes (até 540 MB cada): a pasta informada deve
conter os .zip com o nome original do INEP. O seed versionado registra URL,
sha256 e MD5 conferido de cada pacote (pipeline/eficiencia/seed/manifesto.json).
"""
import argparse
import os
import sys

from pipeline.eficiencia import base, gold, padroniza as P


def _inep(pasta):
    from pipeline.eficiencia.fontes import inep_censo, inep_indicadores, inep_sinopse
    for ano in P.ANOS_CENSO:
        nome = f"microdados_censo_escolar_{ano}{inep_censo.SUFIXO.get(ano, '')}.zip"
        inep_censo.extrai(ano, os.path.join(pasta, nome))
        inep_indicadores.extrai("atu", ano, os.path.join(pasta, f"ATU_{ano}_MUNICIPIOS.zip"))
        inep_indicadores.extrai("rendimento", ano, os.path.join(pasta, f"tx_rend_municipios_{ano}.zip"))
    inep_indicadores.extrai("ideb_ai", 2025, os.path.join(pasta, "divulgacao_anos_iniciais_municipios_2025.zip"))
    inep_indicadores.extrai("ideb_af", 2025, os.path.join(pasta, "divulgacao_anos_finais_municipios_2025.zip"))
    for ano, nome in ((2021, "sinopses_estatisticas_censo_escolar_2021.zip"),
                      (2024, "sinopse_estatistica_censo_escolar_2024.zip"),
                      (2025, "sinopse_estatistica_censo_escolar_2025.zip")):
        inep_sinopse.extrai(ano, os.path.join(pasta, nome))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta-siconfi", action="store_true")
    ap.add_argument("--inep", metavar="PASTA")
    a = ap.parse_args(argv)
    if a.coleta_siconfi:
        from pipeline.eficiencia.fontes import ibge_ipca, siconfi
        siconfi.coleta(P.ANOS_FINANCEIROS)
        ibge_ipca.coleta(min(P.ANOS_FINANCEIROS), max(P.ANOS_FINANCEIROS))
    if a.inep:
        _inep(a.inep)
    g = gold.constroi()
    gold.publica(g)
    reprovadas = [v for v in g["validacoes"] if v["resultado"] == "reprovada"]
    for v in g["validacoes"]:
        print(f"{v['id']}  {v['resultado']:<40} {v['titulo']}")
    print(f"gold: {os.path.relpath(gold.ARQUIVO_GOLD, base.RAIZ)} · {g['meta']['observacoes']} observações · hash {g['meta']['hash_dados'][:16]}")
    if reprovadas:
        print("validação reprovada: a gold foi escrita para inspeção, mas não deve ser publicada", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
