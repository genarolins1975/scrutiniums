"""Execução do pipeline do OBEE.

    python3 -m pipeline.eficiencia.run                 reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.eficiencia.run --coleta-siconfi   recoleta DCA, RREO, entes e IPCA (rede)
    python3 -m pipeline.eficiencia.run --coleta-msc    recoleta a MSC de dezembro de todas as capitais (rede)
    python3 -m pipeline.eficiencia.run --coleta-populacao  recoleta a população do IBGE (rede)
    python3 -m pipeline.eficiencia.run --coleta-ocde   recoleta a OCDE (tamanho de turma, despesa por estudante) (rede)
    python3 -m pipeline.eficiencia.run --coleta-siope  recoleta os indicadores por aluno do SIOPE (examinados, não adotados) (rede)
    python3 -m pipeline.eficiencia.run --inep-nacional <pasta>  extrai as referências nacionais do INEP dos .zip da pasta
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
                      (2022, "sinopses_estatisticas_censo_escolar_2022.zip"),
                      (2023, "sinopse_estatistica_censo_escolar_2023.zip"),
                      (2024, "sinopse_estatistica_censo_escolar_2024.zip"),
                      (2025, "sinopse_estatistica_censo_escolar_2025.zip")):
        inep_sinopse.extrai(ano, os.path.join(pasta, nome))


def _msc_para_divergencias():
    """Captura a MSC de dezembro para cada DCA com diferença material em relação ao RREO."""
    from pipeline.eficiencia.fontes import siconfi
    for o in P.despesa():
        if o["componente"] != "nominal" or o["status"] != "OBSERVADO":
            continue
        if o["conferencia"]["situacao"] in ("PENDENTE", "RECONCILIADA_MSC", "PERIMETRO_INTRA_MSC"):
            siconfi.coleta_msc_educacao(o["ente"], o["ano"])


def _msc_todas():
    """Captura a MSC de dezembro de todos os pares capital × exercício: sustenta a ponte da despesa por
    matrícula (modalidade de aplicação, grupo de natureza e elemento) e a conferência de cada DCA."""
    from pipeline.eficiencia import entes
    from pipeline.eficiencia.fontes import siconfi
    for cod, nome, _ in entes.CAPITAIS:
        for ano in P.ANOS_FINANCEIROS:
            n, f = siconfi.coleta_msc_educacao(cod, ano)
            print(f"MSC {nome} {ano}: {n} linhas na resposta, {f} da função 12", flush=True)


def _msc_pares(pares):
    """Recoleta a MSC (com o resumo da resposta completa) e o extrato de entregas de pares "código:ano"."""
    from pipeline.eficiencia import entes
    from pipeline.eficiencia.fontes import siconfi
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    for par in pares.split(","):
        cod, ano = (int(x) for x in par.split(":"))
        n, f = siconfi.coleta_msc_educacao(cod, ano)
        e = siconfi.coleta_msc_entregas(cod, ano)
        print(f"MSC {nomes[cod]} {ano}: {n} linhas na resposta, {f} da função 12; {e} entregas de MSC no extrato", flush=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta-siconfi", action="store_true")
    ap.add_argument("--coleta-msc", action="store_true", help="recoleta a MSC de dezembro de todas as capitais e exercícios (rede)")
    ap.add_argument("--msc-pares", metavar="COD:ANO,...", help="recoleta a MSC, o resumo da resposta completa e o extrato de entregas só dos pares indicados (rede)")
    ap.add_argument("--coleta-nacional", metavar="ANO", type=int, help="coleta DCA e RREO de todos os municípios do exercício (rede; longa) e a população de todos os municípios")
    ap.add_argument("--recoleta-rreo-nacional", metavar="ANO", type=int, help="refaz o RREO dos municípios com resposta vazia, no demonstrativo simplificado (rede)")
    ap.add_argument("--coleta-populacao", action="store_true", help="recoleta a população do IBGE (rede)")
    ap.add_argument("--coleta-ocde", action="store_true", help="recoleta tamanho de turma e despesa por estudante da OCDE (rede)")
    ap.add_argument("--coleta-siope", action="store_true", help="recoleta os indicadores por aluno do SIOPE, examinados e não adotados (rede)")
    ap.add_argument("--inep-nacional", metavar="PASTA", help="extrai as referências nacionais dos .zip do INEP (ATU, rendimento e Ideb do Brasil; investimento por estudante)")
    ap.add_argument("--inep", metavar="PASTA")
    a = ap.parse_args(argv)
    if a.coleta_siconfi:
        from pipeline.eficiencia.fontes import ibge_ipca, siconfi
        siconfi.coleta(P.ANOS_FINANCEIROS)
        ibge_ipca.coleta(min(P.ANOS_FINANCEIROS), max(P.ANOS_FINANCEIROS))
        _msc_para_divergencias()
    if a.coleta_msc:
        _msc_todas()
    if a.coleta_nacional:
        from pipeline.eficiencia.fontes import siconfi_nacional, ibge_populacao_nacional
        n, e = siconfi_nacional.coleta(a.coleta_nacional)
        print(f"Siconfi nacional {a.coleta_nacional}: {n} municípios, {e} com erro de coleta", flush=True)
        ibge_populacao_nacional.coleta(a.coleta_nacional)
    if a.recoleta_rreo_nacional:
        from pipeline.eficiencia.fontes import siconfi_nacional
        siconfi_nacional.recoleta_rreo_vazio(a.recoleta_rreo_nacional)
    if a.msc_pares:
        _msc_pares(a.msc_pares)
    if a.coleta_populacao:
        from pipeline.eficiencia.fontes import ibge_populacao
        ibge_populacao.coleta()
        ibge_populacao.coleta_relacao_2023()
    if a.coleta_ocde:
        from pipeline.eficiencia.fontes import ocde
        ocde.coleta()
    if a.coleta_siope:
        from pipeline.eficiencia.fontes import siope
        siope.coleta()
    if a.inep_nacional:
        from pipeline.eficiencia.fontes import inep_nacional
        inep_nacional.extrai(a.inep_nacional)
    if a.inep:
        _inep(a.inep)
    g = gold.constroi()
    promovido, caminho = gold.promove(g)
    for v in g["validacoes"]:
        print(f"{v['id']}  {v['resultado']:<40} {v['titulo']}")
    print(f"gold: {os.path.relpath(caminho, base.RAIZ)} · {g['meta']['observacoes']} observações · hash {g['meta']['hash_dados'][:16]}")
    if not promovido:
        print(f"validação reprovada ({', '.join(gold.reprovadas(g))}): diagnóstico em {os.path.relpath(caminho, base.RAIZ)}; "
              "a saída pública anterior não foi alterada", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
