"""Catálogo de atos tarifários (curadoria) → src/lib/saneamento/dados/atos.json.

Base: curadoria/atos_2023_2026.csv, levantado em 14/10/2026 nos sites oficiais dos
reguladores e diários oficiais (coluna verificado_em_documento_oficial). Acréscimos e
correções de verificação ficam em ACRESCIMOS e VERIFICACOES abaixo, cada um com a fonte.
Atos sem verificação no texto oficial continuam no catálogo, marcados como tal.

Uso:
    python3 -m pipeline.observatorio_saneamento.atos
"""
import csv
import json
import os
import re

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
ORIGEM = os.path.join(AQUI, "curadoria", "atos_2023_2026.csv")
DESTINO = os.path.join(RAIZ, "src", "lib", "saneamento", "dados", "atos.json")

# Ato lido na publicação oficial por outra frente da mesma curadoria (tabelas tarifárias).
VERIFICACOES = {
    "Resolução ARSAE 217/2025": {
        "verificado": True,
        "url": "https://www.jornalminasgerais.mg.gov.br/api/v1/Caderno/ObterArquivoCadernoPorId?id=326039",
        "obs": "Verificado no Jornal Minas Gerais, Diário do Executivo de 23/12/2025, p.78-79: índice de reposicionamento de 4,04% e efeito médio de 6,56% (art. 1º); vigência a partir de 22/01/2026. O site da ARSAE-MG não respondeu a este ambiente.",
        "data": "2025-12-22",
    },
}

ACRESCIMOS = [
    {"prestador": "COPASA", "area": "Município de Rio Pomba", "regulador": "ARSAE-MG", "tipo": "reajuste", "pedido": "não verificado",
     "decisao": "4,64%", "ato": "Resolução ARSAE-MG 232/2026", "data": "2026-08-04", "vigencia": "a partir de 10/09/2026",
     "url": "https://www.jornalminasgerais.mg.gov.br/api/v1/Caderno/ObterArquivoCadernoPorId?id=330687", "verificado": True,
     "obs": "Tabela própria de Rio Pomba; Jornal Minas Gerais de 05/08/2026, p.13."},
    {"prestador": "CAESB", "area": "Distrito Federal", "regulador": "ADASA", "tipo": "reajuste", "pedido": "não publicado",
     "decisao": "3,98% sobre as tarifas da Resolução ADASA 53/2025", "ato": "Resolução ADASA 70, 17/04/2026", "data": "2026-04-17",
     "vigencia": "01/06/2026 a 31/05/2027", "url": "https://www.adasa.df.gov.br/images/storage/legislacao/resolucoes_adasa/2026/Resolu%C3%A7%C3%A3o_70_2026_1.pdf",
     "verificado": True, "obs": "Publicação no DODF não verificada (site inacessível)."},
    {"prestador": "COMPESA", "area": "Estado de Pernambuco", "regulador": "ARPE", "tipo": "estrutura (Tarifa Social Pernambucana, Lei 14.898/2024)", "pedido": "não se aplica",
     "decisao": "desconto mínimo de 50% sobre a primeira faixa residencial, aplicado no mínimo aos primeiros 15 m³", "ato": "Resolução ARPE 292, 25/04/2025",
     "data": "2025-04-25", "vigencia": "publicação", "url": "https://www.arpe.pe.gov.br/images/RESOLUCAO/RESOLUCOES2025/Resoluo-Arpe-292-2025---Tarifa-Social-Pernambucana.pdf",
     "verificado": True, "obs": ""},
    {"prestador": "COMPESA", "area": "Microrregiões do Sertão e da RMR-Pajeú (concessões de 2026)", "regulador": "ARPE", "tipo": "extensão de resoluções às concessionárias", "pedido": "não se aplica",
     "decisao": "aplica às concessionárias as resoluções válidas para a COMPESA", "ato": "Resolução ARPE 347, 12/08/2026", "data": "2026-08-12",
     "vigencia": "publicação", "url": "https://www.arpe.pe.gov.br/resolucao-arpe-n-347", "verificado": True,
     "obs": "Desconto de leilão citado na imprensa não verificado em ato."},
    {"prestador": "SABESP", "area": "Contrato de Concessão 01/2024, URAE-1", "regulador": "ARSESP", "tipo": "estrutura (Residencial Social II, Lei 14.898/2024)", "pedido": "não se aplica",
     "decisao": "50% de desconto sobre a tarifa residencial até 15 m³", "ato": "Deliberação 1.699/2025", "data": "2025",
     "vigencia": "01/06/2025", "url": "https://www.arsesp.sp.gov.br/LegislacaoArquivos/ldl16992025.pdf", "verificado": True,
     "obs": "Conferido nos valores da Tabela 1 de 2026: 20,21 = 40,42 ÷ 2 e 3,20 = 6,40 ÷ 2."},
]


def data_do_ato(ato):
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", ato)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.search(r"/(\d{4})", ato)
    return m.group(1) if m else None


def main():
    atos = []
    with open(ORIGEM, encoding="utf-8") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            if r["prestador"].startswith("ÁGUAS DO RIO"):
                continue  # nenhum ato verificado; a ausência fica registrada na metodologia
            a = {
                "prestador": r["prestador"],
                "area": r["contrato_area"],
                "regulador": r["regulador"],
                "tipo": r["tipo"],
                "pedido": r["pedido"],
                "decisao": r["decisao"],
                "ato": r["ato"],
                "data": data_do_ato(r["ato"]),
                "vigencia": r["vigencia"],
                "url": r["url"],
                "verificado": r["verificado_em_documento_oficial"] == "True",
                "obs": r["obs"],
            }
            for chave, v in VERIFICACOES.items():
                if a["ato"].startswith(chave):
                    a.update(v)
            atos.append(a)
    atos.extend(ACRESCIMOS)
    atos.sort(key=lambda a: (a["prestador"], a["data"] or "", a["ato"]))
    for i, a in enumerate(atos):
        a["id"] = f"ato-{i + 1:03d}"
    with open(DESTINO, "w", encoding="utf-8") as fh:
        json.dump({"levantado_em": "2026-10-14", "atos": atos}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"{len(atos)} atos; verificados {sum(a['verificado'] for a in atos)}")


if __name__ == "__main__":
    main()
