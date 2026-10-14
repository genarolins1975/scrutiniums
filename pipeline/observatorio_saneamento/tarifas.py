"""Tarifas residenciais verificadas em atos oficiais (curadoria) → src/lib/saneamento/dados/tarifas.json.

Cada tabela foi lida no ato do regulador (ou na publicação oficial do ato) e conferida com
uma segunda fonte quando o ato traz a tabela em imagem. Os originais e seus sha256 estão
listados em cada registro. O gerador:
  1. monta as regras no formato do simulador (src/lib/saneamento/conta.ts);
  2. recalcula as contas de 10 e 20 m³ e compara com os exemplos conferidos à mão;
  3. associa os municípios onde a tabela se aplica, a partir do prestador declarado ao
     SINISA 2024 e das exceções documentadas no ato.

Formato de uma tabela de serviço:
  fixo   valor mensal cobrado sempre (R$/mês), quando o ato prevê tarifa fixa;
  minimo {m3, valor}: valor que cobre os primeiros m3 (consumo mínimo faturável);
  faixas [{de, ate, preco}]: R$/m³ do volume acima de `de` até `ate` (ate null = sem limite).
Esgoto: tabela própria ou {"percentual": p} da conta de água.

Uso:
    python3 -m pipeline.observatorio_saneamento.tarifas
"""
import json
import os
from decimal import ROUND_HALF_UP, Decimal

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
DESTINO = os.path.join(RAIZ, "src", "lib", "saneamento", "dados", "tarifas.json")
GOLD = os.path.join(RAIZ, "public", "saneamento", "gold")

ACESSO = "2026-10-14"


def f(de, ate, preco):
    return {"de": de, "ate": ate, "preco": preco}


def progressivo(precos, cortes):
    """Faixas a partir de cortes [c0, c1, ...]: (c0, c1], (c1, c2], ..., (cn, ∞)."""
    out = []
    for i, p in enumerate(precos):
        out.append(f(cortes[i], cortes[i + 1] if i + 1 < len(cortes) else None, p))
    return out


def tab(fixo=None, minimo=None, faixas=()):
    t = {"faixas": list(faixas)}
    if fixo is not None:
        t["fixo"] = fixo
    if minimo is not None:
        t["minimo"] = {"m3": minimo[0], "valor": minimo[1]}
    return t


# ---------------------------------------------------------------- COMPESA (ARPE)
COMPESA_FAIXAS = [8.42, 11.59, 13.74, 26.40]
compesa = {
    "id": "compesa-2025",
    "prestador": "Companhia Pernambucana de Saneamento (COMPESA)",
    "prestadorSinisa": "compesa-companhia-pernambucana-de-saneamento",
    "uf": "PE",
    "regulador": "ARPE",
    "modelo": "Tarifa fixa até 10 m³ e faixas progressivas; esgoto como percentual da água",
    "ato": "Resolução ARPE nº 289, de 26/03/2025",
    "vigencia": "30 dias após a publicação (art. 6º); data de publicação no DOE-PE não verificada em fonte oficial",
    "ultimoReajuste": "Reequilíbrio médio de 8,72% e reajuste de 1,16%; reposição de 9,98% (arts. 3º a 5º)",
    "area": "Serviços prestados pela COMPESA em Pernambuco (tabela estadual única)",
    "fontes": [
        {"rotulo": "Resolução ARPE 289/2025", "url": "https://www.arpe.pe.gov.br/images/RESOLUCAO/RESOLUCOES2025/Resoluo-Arpe-289-2025---Tarifa-Social-Pernambucana._compressed.pdf", "sha256": "11abb52d94935edde14e411ada0a9b15bce2ceb61a5df0747930a35626bfcd4b", "localizador": "Anexo Único, PDF p.3-5"},
        {"rotulo": "Estrutura tarifária publicada pela ARPE", "url": "https://www.arpe.pe.gov.br/images/COORDENADORIAS/TARIFAS/SANEAMENTO/Estrutura-Tarifria-Compesa-2025---Resoluo-ARPE-n-289-2025.pdf", "sha256": "d4073c6c24589833a72be3ccb0c850ffcc438445c5988821755d7a7b55146f00", "localizador": "p.1-2"},
        {"rotulo": "Regulamento Geral da COMPESA (Decreto estadual 18.251/1994)", "url": "https://servicos.compesa.com.br/wp-content/uploads/2018/10/Regulamento-Geral-da-Compesa-decreto_18251_211294_.pdf", "sha256": "caf9d817029a8ba8aba4ef11bf0668a05adb1badc2477a5807d702ea51f717a0", "localizador": "arts. 68 e 72 (fatura mínima de 10 m³ por economia)"},
        {"rotulo": "Resolução ARPE 292/2025 (Tarifa Social Pernambucana)", "url": "https://www.arpe.pe.gov.br/images/RESOLUCAO/RESOLUCOES2025/Resoluo-Arpe-292-2025---Tarifa-Social-Pernambucana.pdf", "sha256": "4663c2bff364aa8775c1aba9dc2b2a6bbe03ffcfb7978135d879b287cb7c9d9d", "localizador": "art. 3º, §§ 1º e 2º"},
    ],
    "unidade": "por economia",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial",
            "agua": tab(minimo=(10, 61.77), faixas=progressivo([7.09] + COMPESA_FAIXAS, [10, 20, 30, 50, 90])),
            "esgoto": {"percentual": 100},
        },
        "social_pernambucana": {
            "rotulo": "Tarifa Social Pernambucana",
            "agua": tab(minimo=(10, 27.50), faixas=[f(10, 15, 0.0), f(15, 20, 7.09)] + progressivo(COMPESA_FAIXAS, [20, 30, 50, 90])),
            "esgotoNaoVerificado": "A cobrança de esgoto da Tarifa Social Pernambucana não foi verificada em ato ou fatura; a simulação mostra só a água.",
        },
        "vulneraveis": {
            "rotulo": "Tarifa de Vulneráveis",
            "agua": tab(minimo=(10, 10.39), faixas=progressivo([7.09] + COMPESA_FAIXAS, [10, 20, 30, 50, 90])),
            "esgotoNaoVerificado": "O Regulamento Geral de 1994 cobra só a água na antiga tarifa social; a aplicação à categoria renomeada não foi verificada. A simulação mostra só a água.",
        },
    },
    "observacoes": [
        "Esgoto convencional a 100% da conta de água (Anexo Único, PDF p.5). Ramal condominial, sistema simplificado e dreno têm percentuais menores, não simulados.",
        "Fatura mínima de 10 m³ por economia; várias economias com um medidor dividem o consumo (Regulamento Geral, arts. 68 e 72).",
        "Em 2026 as microrregiões do Sertão e da RMR-Pajeú foram concedidas à iniciativa privada; a Resolução ARPE 347/2026 estende às concessionárias as resoluções aplicáveis à COMPESA. Desconto de leilão e data de início da operação não verificados.",
        "Não há nova resolução de reajuste da COMPESA na lista oficial da ARPE até a Resolução 351, de 23/09/2026.",
    ],
    "exemplos": {"residencial": {"10": 123.54, "20": 265.34}, "social_pernambucana": {"10": 27.50, "15": 27.50, "20": 62.95}},
}

# ---------------------------------------------------------------- COPASA (ARSAE-MG)
C5 = [0, 5, 10, 15, 20, 40]
copasa = {
    "id": "copasa-2026",
    "prestador": "Companhia de Saneamento de Minas Gerais (COPASA)",
    "prestadorSinisa": "copasa-companhia-de-saneamento-de-minas-gerais",
    "uf": "MG",
    "regulador": "ARSAE-MG",
    "modelo": "Tarifa fixa por economia e faixas progressivas sem consumo mínimo; esgoto com tabela própria",
    "ato": "Resolução ARSAE-MG nº 217, de 22/12/2025 (3ª Revisão Tarifária Periódica)",
    "vigencia": "Desde 22/01/2026, sobre volumes usados a partir dessa data (art. 1º, § 3º)",
    "ultimoReajuste": "Índice de reposicionamento de 4,04% e efeito tarifário médio de 6,56% (art. 1º, §§ 1º e 2º)",
    "area": "Municípios atendidos pela COPASA e regulados pela ARSAE-MG; Rio Pomba tem tabela própria (Resolução ARSAE-MG 232/2026)",
    "fontes": [
        {"rotulo": "Jornal Minas Gerais, Diário do Executivo de 23/12/2025 (Resolução ARSAE-MG 217/2025)", "url": "https://www.jornalminasgerais.mg.gov.br/api/v1/Caderno/ObterArquivoCadernoPorId?id=326039", "sha256": "b53b1e09135a8e070e54c33d94c2085d1287e698917b728090d20ef0983e58c9", "localizador": "p.78-79, Anexo I"},
        {"rotulo": "Jornal Minas Gerais de 19/11/2019 (Resolução ARSAE-MG 131/2019, condições gerais)", "url": "https://www.jornalminasgerais.mg.gov.br/api/v1/Caderno/ObterArquivoCadernoPorId?id=6220", "sha256": "08aa1ad632284fe928c93376175223ecfb161c7a9c9cb57f2e76c1ddc1d16961", "localizador": "art. 2º LX a LXIII e art. 89"},
    ],
    "unidade": "por economia (unidade usuária)",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial",
            "agua": tab(fixo=25.77, faixas=progressivo([2.69, 5.334, 8.056, 10.83, 13.658, 16.538], C5)),
            "esgoto": tab(fixo=19.07, faixas=progressivo([1.98, 3.948, 5.962, 8.014, 10.106, 12.239], C5)),
        },
        "social_1": {
            "rotulo": "Residencial Social, nível I",
            "agua": tab(fixo=9.02, faixas=progressivo([0.94, 1.867, 2.82, 3.79, 4.78, 5.788], C5)),
            "esgoto": tab(fixo=6.67, faixas=progressivo([0.70, 1.381, 2.087, 2.804, 3.536, 4.283], C5)),
        },
        "social_2": {
            "rotulo": "Residencial Social, nível II",
            "agua": tab(fixo=11.59, faixas=progressivo([1.35, 2.668, 4.028, 5.416, 6.829, 8.27], C5)),
            "esgoto": tab(fixo=8.58, faixas=progressivo([1.00, 1.974, 2.981, 4.007, 5.054, 6.119], C5)),
        },
    },
    "observacoes": [
        "Esgoto dinâmico (coleta e afastamento) cobrado igualmente com ou sem tratamento (art. 2º); esgoto estático a 30% da água (art. 3º), não simulado.",
        "Ciclo de faturamento com duas tabelas é cobrado pro rata die (Resolução 131/2019, art. 83, § 4º); a simulação usa só a tabela vigente.",
        "Regras de tarifa social de 2026: Resoluções 150/2021 e 199/2024 (art. 4º). A Resolução ARSAE-MG 227/2026 muda as regras a partir do próximo reajuste.",
        "O site da ARSAE-MG não respondeu a este ambiente (HTTP 403); a verificação usou a publicação oficial no Jornal Minas Gerais.",
    ],
    "exemplos": {"residencial": {"10": 114.60, "20": 278.91}, "social_1": {"10": 40.13, "20": 97.64}, "social_2": {"10": 55.13, "20": 137.29}},
}

# ---------------------------------------------------------------- SABESP (ARSESP), Tabela 1
S = [10, 20, 50]
sabesp = {
    "id": "sabesp-2026-t1",
    "prestador": "Companhia de Saneamento Básico do Estado de São Paulo (SABESP)",
    "prestadorSinisa": "sabesp-companhia-de-saneamento-basico-do-estado-de-sao-paulo",
    "uf": "SP",
    "regulador": "ARSESP",
    "modelo": "Consumo mínimo de 10 m³ e faixas progressivas; esgoto igual à água na Tabela 1",
    "ato": "Deliberação ARSESP nº 1.749, de 01/12/2025 (Tarifa de Aplicação, Contrato de Concessão 01/2024, URAE-1)",
    "vigencia": "Desde 01/01/2026 (art. 3º)",
    "ultimoReajuste": "6,1106% (IPCA de junho de 2024 a outubro de 2025) e PIS/Cofins efetivo de 7,2331%",
    "area": "Tabela 1: unidades de negócio OC, OL, OO, ON (com exceções) e OS, Guararema e Santa Isabel, o que inclui a capital. O simulador associa só o município de São Paulo, citado expressamente; as demais nove tabelas não foram associadas a municípios",
    "fontes": [
        {"rotulo": "Deliberação ARSESP 1.749/2025", "url": "https://www.arsesp.sp.gov.br/LegislacaoArquivos/1749.pdf", "sha256": "f04bef7935f7657f066281822c49c6ecbbdb64421b54c1f56e16affbf5a84316", "localizador": "Anexo I, Tabela 1, PDF p.20 (tabela em imagem)"},
        {"rotulo": "Comunicado Sabesp 01/26 (mesmos valores em texto)", "url": "https://www.sabesp.com.br/site/toq/comunicado-sabesp-urae-v5.pdf", "sha256": "e23daf8f9df1e1647c48afb03c63bd8460f6d308196e2cf7615e94dec811b9c9", "localizador": "Tabela 1 e item 8.1 (TRCF)"},
        {"rotulo": "Decreto estadual 41.446/1996 (Regulamento do Sistema Tarifário)", "url": "https://www.al.sp.gov.br/repositorio/legislacao/decreto/1996/decreto-41446-16.12.1996.html", "sha256": "403c9529186aed312ee9bea7fe0a4b0a1f1931fcb884a40e91c7c60a37699c21", "localizador": "arts. 4º a 6º"},
        {"rotulo": "Deliberação ARSESP 1.699/2025 (Residencial Social II)", "url": "https://www.arsesp.sp.gov.br/LegislacaoArquivos/ldl16992025.pdf", "sha256": "15a4d63265cccdac115fa62044d128a232b1374a5b953d867db4f3f9b1fa21b6", "localizador": "categoria Social II"},
    ],
    "unidade": "por economia",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial",
            "agua": tab(minimo=(10, 40.42), faixas=progressivo([6.40, 15.95, 17.57], S)),
            "esgoto": {"percentual": 100},
        },
        "social_2": {
            "rotulo": "Residencial Social II",
            "agua": tab(minimo=(10, 20.21), faixas=[f(10, 15, 3.20), f(15, 20, 6.40), f(20, 50, 15.95), f(50, None, 17.57)]),
            "esgoto": {"percentual": 100},
        },
        "social": {
            "rotulo": "Residencial Social",
            "agua": tab(minimo=(10, 11.46), faixas=progressivo([2.18, 7.79, 11.10, 12.26], [10, 20, 30, 50])),
            "esgoto": {"percentual": 100},
        },
        "vulneravel": {
            "rotulo": "Residencial Vulnerável",
            "agua": tab(minimo=(10, 8.74), faixas=progressivo([1.10, 3.67, 11.10, 12.26], [10, 20, 30, 50])),
            "esgoto": {"percentual": 100},
        },
    },
    "adicionais": [
        {"id": "trcf", "rotulo": "Taxa de Regulação, Controle e Fiscalização (TRCF), 0,5% da fatura", "percentual": 0.5,
         "nota": "Cobrada nos municípios listados no item 8.1 do Comunicado 01/26, entre eles São Paulo; base exata e arredondamento não verificados."},
    ],
    "observacoes": [
        "Não há tabela estadual única: a Deliberação traz 10 tabelas por região. Esta é a Tabela 1.",
        "Consumo mínimo de 10 m³ por economia, também para o esgoto; o volume de esgoto é igual ao de água faturado (Decreto 41.446/1996, arts. 4º e 5º).",
        "Imóvel não ligado a rede de esgoto disponível paga tarifa de disponibilidade igual à tarifa mínima (Comunicado 1/25), não simulada.",
        "A tabela da Deliberação é imagem; os valores residenciais foram conferidos com o texto do Comunicado Sabesp 01/26.",
    ],
    "exemplos": {"residencial": {"10": 80.84, "20": 208.84}, "social_2": {"15": 72.42}},
}

# ---------------------------------------------------------------- SANEPAR (AGEPAR)
SN = [5, 10, 15, 20, 30]
SANEPAR_FONTES = [
    {"rotulo": "Diário Oficial do Paraná nº 12127, de 16/04/2026 (Resolução AGEPAR 23/2026)", "url": "https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=downloadDioe&idEdicao=16749&numero=12127", "sha256": "94f6eb75662dfe8df84a6a2ee7bd90361f61abfddc0bc867dee209a7d8c3151c", "localizador": "p.132-134, Anexo Único"},
    {"rotulo": "Resolução AGEPAR 36/2025 (tarifa social)", "url": "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=368129", "sha256": "13e26b3c9bbcdeebbc033ff3c156f72398271fb2799d5ac7bc3631da2aefac9e", "localizador": "art. 1º, § 1º"},
]


def sanepar(pct, sufixo, area):
    return {
        "id": f"sanepar-2026-{sufixo}",
        "prestador": "Companhia de Saneamento do Paraná (SANEPAR)",
        "prestadorSinisa": "sanepar-companhia-de-saneamento-do-parana-s-a",
        "uf": "PR",
        "regulador": "AGEPAR",
        "modelo": "Valor da primeira faixa até 5 m³ e faixas progressivas; esgoto como percentual da conta de água",
        "ato": "Resolução AGEPAR nº 23, de 15/04/2026 (reajuste tarifário anual)",
        "vigencia": "Desde 17/05/2026 (art. 2º)",
        "ultimoReajuste": "2,4993%; tarifa média de R$ 7,0032/m³",
        "area": area,
        "fontes": SANEPAR_FONTES,
        "unidade": "não verificada (economia ou ligação)",
        "categorias": {
            "residencial": {
                "rotulo": "Residencial normal",
                "agua": tab(minimo=(5, 55.09), faixas=progressivo([1.70, 9.49, 9.54, 9.62, 16.28], SN)),
                "esgoto": {"percentual": pct},
            },
            "social": {
                "rotulo": "Tarifa social de água e esgoto",
                "agua": tab(minimo=(5, 27.54), faixas=progressivo([5.51, 5.51, 9.54, 9.62, 16.28], SN)),
                "esgoto": {"percentual": pct},
            },
        },
        "observacoes": [
            f"Esgoto a {pct}% da fatura de água (art. 3º); os valores de esgoto da tabela são referenciais e podem diferir na segunda casa decimal (Nota 01).",
            "Pontal do Paraná, Matinhos e Guaratuba têm ajuste sazonal de 20% acima de 5 m³ (art. 6º); ficam fora do simulador.",
            "Na tarifa social, o valor da primeira faixa tem 50% de desconto e o preço por m³ correspondente (R$ 5,51) se estende até 15 m³ (Resolução AGEPAR 36/2025); entre 6 e 10 m³ ele é maior que o da categoria residencial (R$ 1,70). O Observatório registra a regra sem avaliar sua conformidade com a Lei 14.898/2024.",
            "Unidade de cobrança (economia ou ligação) e regra de arredondamento não verificadas.",
        ],
        "exemplos": {"residencial": {"10": 117.64 if pct == 85 else 114.46, "20": 293.67 if pct == 85 else 285.73}},
    }


# ---------------------------------------------------------------- CAESB (ADASA)
CB = [0, 7, 13, 20, 30, 45]
caesb = {
    "id": "caesb-2026",
    "prestador": "Companhia de Saneamento Ambiental do Distrito Federal (CAESB)",
    "prestadorSinisa": "caesb-companhia-de-saneamento-ambiental-do-distrito-federal",
    "uf": "DF",
    "regulador": "ADASA",
    "modelo": "Tarifa fixa por unidade de consumo e faixas progressivas sem consumo mínimo; esgoto como percentual da água",
    "ato": "Resolução ADASA nº 70, de 17/04/2026 (reajuste tarifário anual 2026)",
    "vigencia": "De 01/06/2026 a 31/05/2027 (art. 2º)",
    "ultimoReajuste": "3,98% sobre as tarifas da Resolução ADASA 53/2025",
    "area": "Distrito Federal (tabela única)",
    "fontes": [
        {"rotulo": "Resolução ADASA 70/2026", "url": "https://www.adasa.df.gov.br/images/storage/legislacao/resolucoes_adasa/2026/Resolu%C3%A7%C3%A3o_70_2026_1.pdf", "sha256": "5570a39fe526e88ce7b6348b9c91b9c3e377bd30570e62773b640f3752ba8581", "localizador": "Anexo, PDF p.1-2"},
        {"rotulo": "Tabela publicada pela CAESB (idêntica)", "url": "https://s3.caesb.df.gov.br/www/prod/site1/Tabela-01-06-2026-a-31-05-2027.pdf", "sha256": "9dd9f6b3b69fb10b2c7b5d872b05b4121cff66eef6953d8209f2cb54eb5c4da0", "localizador": "coluna Valor da Faixa"},
        {"rotulo": "Resolução ADASA 14/2011 consolidada (condições gerais)", "url": "https://www.adasa.df.gov.br/images/storage/legislacao/resolucoes_adasa/2011/ulitma_versao_n_14_2011/Resolu%C3%A7%C3%A3o_n%C2%BA_14_Consolidada.pdf", "sha256": "fbca6c413009aef22c3bfc7bd1ad31cef397da70dfc1253410afc8816a389791", "localizador": "arts. 99 a 106"},
    ],
    "unidade": "por unidade de consumo",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial padrão",
            "agua": tab(fixo=11.62, faixas=progressivo([4.30, 5.15, 10.21, 14.81, 22.22, 28.88], CB)),
            "esgoto": {"percentual": 100},
        },
        "social": {
            "rotulo": "Residencial social",
            "agua": tab(fixo=5.81, faixas=progressivo([2.15, 2.58, 5.11, 7.41, 22.22, 28.88], CB)),
            "esgoto": {"percentual": 100},
        },
    },
    "observacoes": [
        "Esgoto convencional a 100% da conta de água; ramal condominial interno a 60% (Resolução 14/2011, art. 103), não simulado.",
        "Tarifa social com 50% de desconto até 30 m³ (Resolução 14/2011, art. 101, II).",
        "Publicação no DODF não verificada (site inacessível a partir deste ambiente).",
    ],
    "exemplos": {"residencial": {"10": 114.34, "20": 288.18}, "social": {"10": 57.20, "20": 144.22}},
}



def d(x):
    return Decimal(str(x))


def conta_servico(t, c):
    c = d(c)
    total = d(t.get("fixo", 0))
    if "minimo" in t:
        total += d(t["minimo"]["valor"])
    for fx in t["faixas"]:
        de = d(fx["de"])
        ate = d(fx["ate"]) if fx["ate"] is not None else None
        vol = (min(c, ate) if ate is not None else c) - de
        if vol > 0:
            total += vol * d(fx["preco"])
    return total


def conta(cat, c):
    agua = conta_servico(cat["agua"], c)
    if "esgoto" not in cat:
        esgoto = Decimal(0)
    elif "percentual" in cat["esgoto"]:
        esgoto = agua * d(cat["esgoto"]["percentual"]) / 100
    else:
        esgoto = conta_servico(cat["esgoto"], c)
    return (agua + esgoto).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def municipios_por_prestador():
    with open(os.path.join(GOLD, "prestadores.json"), encoding="utf-8") as fh:
        ps = {p["id"]: p for p in json.load(fh)}
    return ps


def main():
    ps = municipios_por_prestador()
    with open(os.path.join(GOLD, "reguladores.json"), encoding="utf-8") as fh:
        regs = json.load(fh)
    arsae = {m for r in regs if (r.get("sigla") or "").startswith("ARSAE") for m in r["municipios_agua"]}

    sp_curitiba = sanepar(85, "curitiba", "Curitiba (esgoto a 85% da fatura de água)")
    sp_demais = sanepar(80, "demais", "Demais localidades operadas pela SANEPAR (esgoto a 80% da fatura de água), exceto Pontal do Paraná, Matinhos e Guaratuba")
    lista = [compesa, copasa, sabesp, sp_curitiba, sp_demais, caesb]

    def mun(pid):
        p = ps.get(pid)
        if not p:
            raise SystemExit(f"prestador {pid} não encontrado na gold")
        return p["municipios_agua"]

    compesa["municipios"] = mun(compesa["prestadorSinisa"])
    # Rio Pomba (3155801) tem tabela própria; municípios fora da ARSAE-MG ficam fora
    copasa["municipios"] = sorted(m for m in mun(copasa["prestadorSinisa"]) if m != "3155801" and m in arsae)
    sabesp["municipios"] = ["3550308"]
    sanepar_mun = mun(sp_curitiba["prestadorSinisa"])
    sp_curitiba["municipios"] = ["4106902"]
    sp_demais["municipios"] = sorted(m for m in sanepar_mun if m not in ("4106902", "4119954", "4115705", "4109609"))
    caesb["municipios"] = ["5300108"]

    erros = []
    for t in lista:
        t["acessado"] = ACESSO
        for cat, ex in t.get("exemplos", {}).items():
            for c, esperado in ex.items():
                obtido = conta(t["categorias"][cat], int(c))
                if obtido != d(esperado):
                    erros.append(f"{t['id']} {cat} {c} m³: obtido {obtido}, esperado {esperado}")
    if erros:
        raise SystemExit("exemplos não conferem:\n" + "\n".join(erros))
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8") as fh:
        json.dump({"acessado": ACESSO, "tarifas": lista}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"{len(lista)} tabelas; municípios associados: " + ", ".join(f"{t['id']}={len(t['municipios'])}" for t in lista))


if __name__ == "__main__":
    main()
