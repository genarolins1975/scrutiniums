"""Referências externas ao grupo de capitais: nacionais oficiais, nacionais calculadas e normativas.

Só entra referência de conceito reproduzível. Cada uma declara origem (oficial publicado ou calculado pelo OBEE) e comparabilidade (direta, contexto
ou incompatível) com o indicador da capital. Não se produz indicador nacional somando apenas capitais. Referências incompatíveis ficam só na matriz
de fontes. Contexto internacional (contas nacionais de saúde) não foi obtido nesta rodada (ver matriz, linha F13).
"""
import os

from pipeline.eficiencia_saude import base, padroniza as P

MINIMO_NORMATIVO = {
    "id": "norma.minimo_asps_municipal",
    "indicador": "sau.asps.percentual_aplicado",
    "componente": None,
    "ano": None,
    "tipo": "normativa",
    "rotulo": "Mínimo constitucional dos municípios",
    "valor": 15.0,
    "unidade": "% da receita de impostos e transferências",
    "escopo": ("Municípios aplicam, no mínimo, 15% da arrecadação dos impostos a que se referem o art. 156 e dos recursos de que tratam o art. 158 e a alínea b do inciso I e o § 3º do art. 159 "
               "da Constituição em ações e serviços públicos de saúde (LC 141/2012, art. 7º). Algumas leis orgânicas fixam percentual maior, informado no demonstrativo."),
    "fonte": "Lei Complementar nº 141, de 13 de janeiro de 2012, art. 7º, https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp141.htm",
    "registro": "LC 141/2012, art. 7º; texto lido em 09/10/2026.",
    "origem": "norma",
    "comparabilidade": "direta",
    "classe": "Referência normativa (não é meta)",
}


def _csv(*partes):
    caminho = os.path.join(base.SEED, *partes)
    return base.le_csv_gz(caminho) if os.path.exists(caminho) else []


def nacionais():
    """Lista das referências nacionais publicáveis, a partir do seed."""
    out = [MINIMO_NORMATIVO]
    # cobertura potencial da APS, Brasil, dezembro: mesmo serviço, mesma fórmula
    caminho = os.path.join(base.SEED, "relatorio_aps", "cobertura_aps_brasil.json.gz")
    if os.path.exists(caminho):
        for l in base.le_json_gz(caminho):
            comp = str(l["nuComp"])
            if comp.startswith("12/") and int(comp[3:]) in P.ANOS_FINANCEIROS:
                ano = int(comp[3:])
                out.append({
                    "id": f"br.aps.cobertura_potencial.{ano}", "indicador": "sau.aps.cobertura_potencial", "componente": None, "ano": ano, "tipo": "nacional_oficial",
                    "rotulo": "Brasil (Relatório APS)", "valor": float(l["qtCobertura"]), "unidade": "% da população de referência",
                    "escopo": "Cobertura potencial estimada da APS do Brasil na competência de dezembro, publicada pelo mesmo serviço e pela mesma fórmula que a das capitais (Nota Técnica nº 2/2025). O Brasil inclui as capitais.",
                    "fonte": "Ministério da Saúde, SAPS, Relatório APS (serviço /cobertura/aps, unidadeGeografica=BRASIL)", "registro": f"Relatório APS, Brasil, competência {comp}; capacidade {int(l['qtCapacidadeEquipe'])}; população de referência {int(l['qtPopulacao'])}",
                    "origem": "oficial_publicado", "comparabilidade": "direta" if ano >= P.ANO_INICIO_REGRA_VIGENTE else "contexto", "classe": "Oficial publicado"})
    # ICSAP, Brasil e Brasil sem as 26 capitais: soma de todos os municípios do próprio arquivo do RIPSA
    for r in _csv("ripsa", "mrb402_icsap_nacional_2021_2024.csv.gz"):
        ano = int(r["ano"])
        n, pop = int(r["icsap_total"]), int(r["populacao_denominador"])
        nc, pc = int(r["icsap_26_capitais"]), int(r["populacao_26_capitais"])
        escopo = (f"Soma das internações ICSAP de {int(r['municipios']):,} municípios do arquivo do RIPSA dividida pela soma das populações do mesmo arquivo, por 100 mil, no mesmo ano e pela mesma regra; "
                  "razão agregada, que pesa cada município pela população. Municípios de todos os portes não são comparáveis às capitais automaticamente.").replace(",", ".")
        out.append({"id": f"br.icsap.taxa.{ano}", "indicador": "sau.icsap.taxa", "componente": "ripsa", "ano": ano, "tipo": "nacional_calculado", "rotulo": "Brasil, todos os municípios (calculado pelo OBEE)",
                    "valor": n / pop * 100000, "unidade": "internações por 100 mil habitantes", "escopo": escopo,
                    "fonte": "RIPSA MRB.4.02, arquivo mgdi_ms_qu3.csv.zip (soma dos municípios)", "registro": f"Soma de {n} internações ICSAP e {pop} habitantes, {ano}",
                    "origem": "calculado_obee", "comparabilidade": "direta", "classe": "Calculado pelo OBEE com o mesmo arquivo"})
        if pop - pc > 0:
            out.append({"id": f"br_sem_capitais.icsap.taxa.{ano}", "indicador": "sau.icsap.taxa", "componente": "ripsa", "ano": ano, "tipo": "nacional_calculado",
                        "rotulo": "Brasil sem as 26 capitais (calculado pelo OBEE)", "valor": (n - nc) / (pop - pc) * 100000, "unidade": "internações por 100 mil habitantes",
                        "escopo": escopo.replace("de " + f"{int(r['municipios']):,}".replace(",", ".") + " municípios", "dos demais municípios"),
                        "fonte": "RIPSA MRB.4.02, arquivo mgdi_ms_qu3.csv.zip (soma dos municípios, menos as 26 capitais)", "registro": f"Soma de {n - nc} internações ICSAP e {pop - pc} habitantes, {ano}",
                        "origem": "calculado_obee", "comparabilidade": "contexto", "classe": "Calculado pelo OBEE com o mesmo arquivo"})
    return out
