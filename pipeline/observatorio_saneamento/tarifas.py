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
Categoria: consumoMaximo (m³/mês) quando o ato só define preço até um teto; acima dele o simulador não calcula.
Tabela: metodoNaoVerificado quando o ato não diz por extenso uma regra de cobrança que a simulação assume;
exemplosOficiais para contas calculadas por simulador ou planilha oficial do prestador ou do regulador.

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
    {"rotulo": "Resolução AGEPAR 36/2025 (tarifa social)", "url": "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=368129", "sha256": "13e26b3c9bbcdeebbc033ff3c156f72398271fb2799d5ac7bc3631da2aefac9e", "localizador": "art. 1º, § 1º; art. 8º, parágrafo único; art. 10; art. 11, parágrafo único"},
    {"rotulo": "Sanepar, tabela de tarifas publicada (acessada em 16/10/2026)", "url": "https://www.sanepar.com.br/tarifas", "sha256": "6d69e9e513fb0efd682e0719843ea357e02f715fef08cb3b8d1dc8dedff43f23", "localizador": "tabela Água Solidária (R$/m³), idêntica ao Anexo Único da Resolução 23/2026; Diferenciadas > Água Solidária: critérios de enquadramento (Decreto Estadual 9.606/2021)"},
    {"rotulo": "Sanepar, comunicado de 12/12/2025 (Água Solidária e Tarifa Social)", "url": "https://www.sanepar.com.br/noticias/com-agua-solidaria-e-nova-tarifa-social-sanepar-vai-beneficiar-608-mil-familias", "sha256": "4d4c73a197e32f9e20e6db0e61b2c358444ead4e463df5f521a20644772dd0ea", "localizador": "seção Água Solidária: desconto de cerca de 80% com consumo de até 10 m³ por mês"},
    {"rotulo": "Sanepar, página Tarifa Social de Água e Esgoto (acessada em 16/10/2026)", "url": "https://www.sanepar.com.br/tarifa-social-de-agua-e-esgoto", "sha256": "558192b74c102adaa2df4310a5c9b6149e1bf5ca313095b79763ce935dd7d662", "localizador": "Apenas matrículas residenciais; um benefício social ativo por CPF"},
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
            # Programa estadual mantido ao lado da tarifa social federal: tabela própria, esgoto a 50% da água
            "agua_solidaria": {
                "rotulo": "Água Solidária (programa estadual)",
                "agua": tab(minimo=(5, 14.74), faixas=progressivo([0.45, 1.70], [5, 10])),
                "esgoto": {"percentual": 50},
            },
        },
        "observacoes": [
            f"Esgoto a {pct}% da fatura de água (art. 3º); os valores de esgoto da tabela são referenciais e podem diferir na segunda casa decimal (Nota 01).",
            "Pontal do Paraná, Matinhos e Guaratuba têm ajuste sazonal de 20% acima de 5 m³ (art. 6º); ficam fora do simulador.",
            "Na tarifa social, o valor da primeira faixa tem 50% de desconto e o preço por m³ correspondente (R$ 5,51) se estende até 15 m³ (Resolução AGEPAR 36/2025); entre 6 e 10 m³ ele é maior que o da categoria residencial (R$ 1,70). O Observatório registra a regra sem avaliar sua conformidade com a Lei 14.898/2024.",
            "Água Solidária: programa estadual da Sanepar, mantido ao lado da tarifa social federal (comunicado de 12/12/2025). Tabela própria no Anexo Único da Resolução AGEPAR 23/2026; esgoto a 50% da tarifa de água (art. 3º, parágrafo único), não a 85% ou 80%; fora do ajuste sazonal litorâneo (art. 6º). Quem está no Água Solidária não recebe a tarifa social federal, e cada CPF tem um benefício social ativo (página da Sanepar).",
            "Água Solidária, critérios de enquadramento publicados pela Sanepar (Decreto Estadual 9.606/2021): imóvel residencial com até 70 m² de área construída; consumo de até 10 m³ por mês e, para famílias com mais de 4 pessoas e consumo acima de 10 m³, até 2,5 m³ por residente; renda de até meio salário mínimo por pessoa ou de até 2 salários mínimos para imóveis com até 4 ocupantes; um cadastro por CPF; validade de 24 meses. O texto do decreto não foi lido. O Observatório registra a tabela do ato e os critérios da Sanepar e não verifica o enquadramento: a conta mostrada vale para quem se enquadra.",
            "Unidade de cobrança (economia ou ligação) e regra de arredondamento não verificadas.",
        ],
        "acessado": "2026-10-16",
        "exemplos": {
            "residencial": {"10": 117.64 if pct == 85 else 114.46, "20": 293.67 if pct == 85 else 285.73},
            "agua_solidaria": {"10": 25.49, "20": 50.99},
        },
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

# ---------------------------------------------------------------- SANEAGO (AGR, AR, AMAE, ARM)
SG = [0, 10, 15, 20, 25, 30, 40, 50]
# Anexo Único da Resolução Conjunta 1/2026 (R$/m³): água, esgoto coleta e afastamento, esgoto tratamento.
SG_NORMAL = {
    "agua": [5.77, 6.51, 7.45, 8.45, 9.54, 10.89, 12.33, 14.06],
    "coleta": [4.61, 5.21, 5.96, 6.76, 7.63, 8.71, 9.86, 11.25],
    "tratamento": [1.15, 1.30, 1.49, 1.69, 1.91, 2.18, 2.47, 2.81],
}
SG_SOCIAL = {
    "agua": [2.73, 3.07, 3.52],
    "coleta": [2.18, 2.46, 2.82],
    "tratamento": [0.55, 0.61, 0.70],
}
# Anexo Único da Resolução Normativa AGR 283/2025, vigente de 01/04/2025 a 31/03/2026: base do reajuste linear de 4,845% de 2026.
SG_2025_NORMAL = {
    "agua": [5.50, 6.21, 7.11, 8.06, 9.10, 10.39, 11.76, 13.41],
    "coleta": [4.40, 4.97, 5.69, 6.45, 7.28, 8.31, 9.41, 10.72],
    "tratamento": [1.10, 1.24, 1.42, 1.61, 1.82, 2.08, 2.35, 2.68],
}
SG_2025_SOCIAL = {
    "agua": [2.60, 2.93, 3.36],
    "coleta": [2.08, 2.35, 2.69],
    "tratamento": [0.52, 0.59, 0.67],
}
SG_BASICA_2025 = {"normal": 16.65, "social": 8.32}
SG_BASICA_2026 = {"normal": 17.46, "social": 8.73}
SG_REAJUSTE_2026 = "1.04845"


def soma(a, b):
    """Soma de duas colunas de preço em Decimal: o esgoto cobra coleta e afastamento mais tratamento."""
    return [float(Decimal(str(x)) + Decimal(str(y))) for x, y in zip(a, b)]


def saneago_faixas(precos, cortes, ate_ultima=None):
    out = progressivo(precos, cortes)
    if ate_ultima is not None:
        out[-1]["ate"] = ate_ultima
    return out


saneago = {
    "id": "saneago-2026",
    "prestador": "Saneamento de Goiás S.A. (SANEAGO)",
    "prestadorSinisa": "saneago-saneamento-de-goias-s-a",
    "uf": "GO",
    "regulador": "AGR, AR, AMAE e ARM",
    "modelo": "Tarifa básica (custo mínimo fixo) por economia somada à conta; água e esgoto por faixas de consumo; esgoto soma coleta e afastamento e tratamento",
    "ato": "Resolução Conjunta nº 1/2026: AGR/AMAE (24/02/2026), AGR/AR (25/02/2026) e AGR/ARM (assinada em 27/02/2026), Anexo Único",
    "vigencia": "Desde 01/04/2026 (art. 3º)",
    "ultimoReajuste": "4,845% linear para as tarifas e para o custo mínimo fixo (art. 2º); em 2025 foram 4,196% (Resolução Normativa AGR 283/2025)",
    "area": "Municípios atendidos pela Saneago e por sua subdelegatária BRK Ambiental Goiás, em tabela única",
    "fontes": [
        {"rotulo": "Resolução Conjunta 1/2026 AGR/AMAE", "url": "https://www.saneago.com.br/2025/arquivos/Resolucao_Normativa_Conjunta_1-2026_AGR-AMAE_Reajuste_Tarifario_2026.pdf", "sha256": "ca21000ef84f0d6942351acffb0b8b781beb9dbeffb8f8801f9b703891479c3e", "localizador": "Anexo Único, PDF p.3-4 (tabela em texto)"},
        {"rotulo": "Resolução Conjunta 1/2026 AGR/AR", "url": "https://www.saneago.com.br/2025/arquivos/Resolucao_Normativa_Conjunta_1-2026_AGR-AR_Reajuste_Tarifario_2026.pdf", "sha256": "137daf61b4fcd6368f6c42eabfbc5e3e8592d50e8732a16525ec44873e383c8e", "localizador": "Anexo Único, PDF p.3-4 (tabela em imagem; valores idênticos aos da AGR/AMAE)"},
        {"rotulo": "Resolução Conjunta 1/2026 AGR/ARM", "url": "https://www.saneago.com.br/2025/arquivos/Resolucao_Normativa_Conjunta_1-2026_AGR-ARM_Reajuste_Tarifario_2026.pdf", "sha256": "d96ba4c448e31613b62e5e08cc28589432ab5d1d51fcf2576561065b89f38d39", "localizador": "Anexo Único, PDF p.3-4 (tabela em imagem; valores idênticos aos da AGR/AMAE)"},
        {"rotulo": "Resolução Normativa AGR 283/2025 (tabela anterior)", "url": "https://www.saneago.com.br/2025/arquivos/Res_Normativa_AGR_283_2025.pdf", "sha256": "ef2113d335dbb1eb2574c79b3278ba672ab196a1c38cba60050086417d49f852", "localizador": "art. 1º, II (fonte alternativa) e Anexo Único, PDF p.2-4: base do reajuste de 2026"},
        {"rotulo": "Resolução AGR 42/2005 CG (esgoto)", "url": "https://www.saneago.com.br/2016/arquivos/AGR_42_2005.pdf", "sha256": "770004ad152d9daf70752ab2ef36f482a2450b334c169ad518f3346a8486226e", "localizador": "arts. 2º e 3º, PDF p.2 (PDF em imagem): coleta e afastamento a 80% e tratamento a 20% da tarifa de água; tratamento só onde o esgoto é efetivamente tratado"},
        {"rotulo": "Resolução Normativa AGR 009/2014, texto consolidado de 11/10/2022", "url": "https://goias.gov.br/agr/wp-content/uploads/sites/43/2014/06/Resolucao-Normativa-n-0009.2014-CR-att-126.pdf", "sha256": "76c36904d4d1a134449e2ea4ff9e8a566feb9699286c9c8b3d0ce0c25d8f5573", "localizador": "arts. 82 e 83 (p.22/37) e art. 103, parágrafo único (p.26/37)"},
        {"rotulo": "AGR, Perguntas frequentes de saneamento (acessada em 17/10/2026)", "url": "https://goias.gov.br/agr/perguntas-frequentes-saneamento/", "sha256": "a36af0e50a21fe8c25ebfa1300f2f65a49585e222851b60931287434120e6505", "localizador": "perguntas 9 (tarifa básica independe do consumo), 10 (TRCF), 19, 20 (fonte alternativa) e 23 (tratamento sem tratamento efetivo)"},
    ],
    "unidade": "por economia",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial normal",
            "agua": tab(fixo=SG_BASICA_2026["normal"], faixas=saneago_faixas(SG_NORMAL["agua"], SG)),
            "esgoto": tab(faixas=saneago_faixas(soma(SG_NORMAL["coleta"], SG_NORMAL["tratamento"]), SG)),
        },
        "social": {
            "rotulo": "Residencial social",
            "consumoMaximo": 20,
            "agua": tab(fixo=SG_BASICA_2026["social"], faixas=saneago_faixas(SG_SOCIAL["agua"], SG[:3], 20)),
            "esgoto": tab(faixas=saneago_faixas(soma(SG_SOCIAL["coleta"], SG_SOCIAL["tratamento"]), SG[:3], 20)),
        },
    },
    "metodoNaoVerificado": "Cobrança por faixa não verificada em conta ou exemplo oficial: o anexo não diz por extenso se cada faixa incide só sobre o volume dentro dela. A simulação usa blocos progressivos, por inferência do art. 103, parágrafo único, da Resolução Normativa AGR 009/2014 (as diferenças de faturamento levam em conta \"a tarifa relativa a cada faixa complementar\"). Se cada faixa valesse para todo o volume, a água de 20 m³ da residencial normal iria de R$ 127,50 para R$ 149,00 (conta minha a partir do anexo). Até 10 m³ as duas leituras dão o mesmo valor.",
    "observacoes": [
        "Tarifa básica (custo mínimo fixo): R$ 17,46 na residencial normal e R$ 8,73 na social, por economia de água faturada (ou de esgoto, na ausência da água). A AGR a descreve como \"valor cobrado independentemente do consumo\" (Perguntas frequentes, nº 9); a simulação a soma à conta de água.",
        "Esgoto: o anexo traz coleta e afastamento e tratamento em colunas separadas, e a simulação soma as duas por faixa. Na faixa de 1 a 10 m³ da residencial normal a soma é R$ 5,76, um centavo abaixo da água (R$ 5,77); nas demais faixas as duas colunas somam o preço da água.",
        "Tratamento só pode ser cobrado onde o esgoto é efetivamente tratado (Resolução AGR 42/2005, art. 2º; Perguntas frequentes, nº 23). Onde há só coleta e afastamento, a conta de esgoto é a parcela de 80% da água; esse caso não é simulado, e a situação de cada município não foi verificada.",
        "Residencial social: o anexo define preço só até 20 m³ por mês, e acima disso o simulador não calcula. As faixas sociais ficam cerca de 53% abaixo das da residencial normal (conta minha a partir do anexo). Critérios de enquadramento não foram lidos em ato nesta etapa; a Lei 14.898/2024 fixa desconto de 50% até 15 m³ (Perguntas frequentes, nº 29).",
        "Fonte alternativa de água: cobrança equivalente a 10 m³ por economia e esgoto por estimativa (Resolução Normativa AGR 283/2025, art. 1º, II; Perguntas frequentes, nº 19 e 20); não simulado.",
        "Categorias comercial I e II, industrial e pública constam do anexo e não foram simuladas. A TRCF integra a estrutura tarifária (Perguntas frequentes, nº 10) e não é linha adicional no anexo.",
        "Verificação cruzada feita pelo gerador: todos os valores de água, coleta e tratamento da residencial normal e da social e a tarifa básica reproduzem a tabela de 2025 reajustada em 4,845% (água ao centavo; coleta e tratamento como 80% e 20% do preço de água reajustado, antes do arredondamento; básica social igual à metade da normal).",
        "Esgoto e tarifa básica da subdelegatária BRK Ambiental Goiás seguem a mesma estrutura (art. 2º e 3º); a BRK não aparece como prestador distinto do SINISA 2024 nesta base.",
        "A mesma tabela foi homologada em três resoluções conjuntas, com a AR (Goiânia), a AMAE (Rio Verde) e a ARM (Anápolis). Não localizei resolução da AGR só para os demais municípios em 2026; a associação aos municípios vem do vínculo da Saneago no SINISA 2024.",
        "Não achei exemplo oficial de conta nem simulador do regulador; os exemplos de 10 e 20 m³ são cálculo manual a partir do anexo.",
    ],
    "exemplos": {"residencial": {"10": 132.76, "20": 272.36}, "social": {"10": 63.33, "15": 94.03, "20": 129.23}},
    "acessado": "2026-10-17",
}


def confere_reajuste_2026():
    """Reproduz a tabela de 2026 a partir da de 2025: preço de água × 1,04845 ao centavo; coleta e tratamento
    como 80% e 20% desse preço antes do arredondamento (Resolução AGR 42/2005, art. 2º); tarifa básica normal × 1,04845
    e social como metade da normal."""
    fator = d(SG_REAJUSTE_2026)
    centavo = Decimal("0.01")
    erros = []

    def q(x):
        return d(x).quantize(centavo, rounding=ROUND_HALF_UP)

    for nome, atual, anterior in (("normal", SG_NORMAL, SG_2025_NORMAL), ("social", SG_SOCIAL, SG_2025_SOCIAL)):
        for i, velho in enumerate(anterior["agua"]):
            bruto = d(velho) * fator
            esperado = {"agua": q(bruto), "coleta": q(bruto * d("0.8")), "tratamento": q(bruto * d("0.2"))}
            for col, v in esperado.items():
                if v != d(atual[col][i]):
                    erros.append(f"{nome} {col} faixa {i + 1}: esperado {v} a partir de {velho} de 2025, o ato de 2026 traz {atual[col][i]}")
    if q(d(SG_BASICA_2025["normal"]) * fator) != d(SG_BASICA_2026["normal"]):
        erros.append(f"tarifa básica normal: {SG_BASICA_2025['normal']} × {fator} = {q(d(SG_BASICA_2025['normal']) * fator)}, o ato traz {SG_BASICA_2026['normal']}")
    if q(d(SG_BASICA_2026["normal"]) / 2) != d(SG_BASICA_2026["social"]):
        erros.append(f"tarifa básica social: metade da normal é {q(d(SG_BASICA_2026['normal']) / 2)}, o ato traz {SG_BASICA_2026['social']}")
    return erros



# ---------------------------------------------------------------- CASAN (ARESC, ARIS, AGIR, CISAM-SUL)
CS = [0, 10, 25, 50]
# Tabela publicada pela CASAN, em vigor desde 01/04/2026 (R$/m³ por faixa; TFDI em R$/mês por economia).
CASAN_2026 = {
    "residencial": {"tfdi": 46.34, "precos": [3.08, 14.31, 19.14, 24.08]},
    "social_anterior": {"tfdi": 8.63, "precos": [0.58, 4.11, 19.14, 24.08]},
}
# Aba "TABELA TARIFÁRIA 2025" da calculadora oficial: tabela anterior ao reajuste de 5,80%.
CASAN_2025 = {
    "residencial": {"tfdi": 43.80, "precos": [2.91, 13.53, 18.09, 22.76]},
    "social_anterior": {"tfdi": 8.16, "precos": [0.55, 3.88, 18.09, 22.76]},
}
CASAN_REAJUSTE_2026 = "1.058"
# Tarifa social da Lei 14.898/2024: metade da residencial na TFDI e na faixa de 0 a 15 m³; as demais faixas são as da residencial.
CASAN_SOCIAL_FEDERAL = {"tfdi": 23.17, "precos": [1.54, 14.31, 19.14, 24.08]}

casan = {
    "id": "casan-2026",
    "prestador": "Companhia Catarinense de Águas e Saneamento (CASAN)",
    "prestadorSinisa": "casan-companhia-catarinense-de-aguas-e-saneamento",
    "uf": "SC",
    "regulador": "ARESC, ARIS, AGIR e CISAM-SUL",
    "modelo": "Tarifa fixa de disponibilidade (TFDI) por economia e faixas progressivas sem consumo mínimo; esgoto a 100% do faturamento de água, inclusive a TFDI",
    "ato": "Resolução ARESC nº 389, de 12/02/2026, e tabela tarifária publicada pela CASAN em abril de 2026",
    "vigencia": "Tabela publicada pela CASAN como válida desde 01/04/2026; na Resolução ARESC 389 o reajuste é aplicável 30 dias após a publicação (art. 2º)",
    "ultimoReajuste": "5,80% sobre tarifas de água e esgoto e sobre a tabela de serviços e infrações, pelo IPCA de outubro de 2024 a dezembro de 2025 (Resolução ARESC 389/2026, art. 1º)",
    "area": "Municípios atendidos pela CASAN em Santa Catarina, em tabela estadual única",
    "fontes": [
        {"rotulo": "CASAN, Tabela tarifária de abril de 2026 (PDF)", "url": "https://www.casan.com.br/ckfinder/userfiles/files/Tarifas/2026/Tabela%20Tarif%C3%A1ria%2004-2026.pdf", "sha256": "30a8eeb2adf0ea8d9e6880c75f1238efedf9e26ad5c4a0f31b912b4ab7f6fc83", "localizador": "p.1: TFDI e faixas por categoria; tarifa social da Lei 14.898/2024; esgoto a 100% da água"},
        {"rotulo": "CASAN, Calculadora tarifária 2026 (planilha oficial)", "url": "https://www.casan.com.br/ckfinder/userfiles/files/Tarifas/2026/calculadora_casan_tfdi%20-%202026%20final.xlsx", "sha256": "c672c20c8bc4f506fdbecbd8f617988a45ca8f453ad42e44244bb8792978cfbf", "localizador": "abas CALCULADORA (fórmulas, células G14 a G22, P25 e AE25), TABELA TARIFÁRIA 2026 e TABELA TARIFÁRIA 2025; recalculada com LibreOffice"},
        {"rotulo": "CASAN, Calculadora da tarifa social, Lei 14.898/2024 (planilha oficial)", "url": "https://www.casan.com.br/ckfinder/userfiles/files/Tarifas/2026/calculadora_casan_tarifa_social%20-%202026%20final.xlsx", "sha256": "ac6fa62457e04f209c4967c2e708d0172f27f4e92290805d3567b9aac2b1d344", "localizador": "abas CALCULADORA (células G14 a G27) e TABELA TARIFÁRIA 2026; recalculada com LibreOffice"},
        {"rotulo": "Resolução ARESC 389/2026", "url": "https://aresc.sc.gov.br/wp-content/uploads/2026/02/RESOLUCAO-ARESC-No-389.pdf", "sha256": "2a2e5e9c1179286ece4436dbdc3b18ea166f41760ea9d6fe27de64d51f1b7a38", "localizador": "arts. 1º a 3º; a Nota Técnica ARESC 002/2026, parte integrante, não foi lida"},
        {"rotulo": "Resolução ARESC 321/2025 (reajuste anterior)", "url": "https://aresc.sc.gov.br/wp-content/uploads/2025/10/RESOLUCAO-ARESC-No-321.pdf", "sha256": "0bcf08b381daeec7a3a44e5ecbe7cfb62086a87d6e46475a0c2310a4e9f528bf", "localizador": "arts. 1º e considerandos: 5,56% e menção às Resoluções ARESC 258/2023 e 281/2024"},
        {"rotulo": "CASAN, página Tarifas (acessada em 17/10/2026)", "url": "https://www.casan.com.br/menu-conteudo/index/url/tarifas", "sha256": "6ef2694bbb205997d1b295e1474b63c42e93e4ef522746265cae92f348631bd7", "localizador": "tabela, esgoto a 100% da água e agências que autorizaram o reajuste"},
    ],
    "unidade": "por economia (unidade autônoma)",
    "categorias": {
        "residencial": {
            "rotulo": "Residencial",
            "agua": tab(fixo=CASAN_2026["residencial"]["tfdi"], faixas=progressivo(CASAN_2026["residencial"]["precos"], CS)),
            "esgoto": {"percentual": 100},
        },
        "social": {
            "rotulo": "Residencial social (tarifa social federal)",
            "agua": tab(fixo=CASAN_SOCIAL_FEDERAL["tfdi"], faixas=progressivo(CASAN_SOCIAL_FEDERAL["precos"], [0, 15, 25, 50])),
            "esgoto": {"percentual": 100},
        },
        "social_anterior": {
            "rotulo": "Residencial social anterior (solicitações até 10/12/2024)",
            "agua": tab(fixo=CASAN_2026["social_anterior"]["tfdi"], faixas=progressivo(CASAN_2026["social_anterior"]["precos"], CS)),
            "esgoto": {"percentual": 100},
        },
    },
    "observacoes": [
        "Método conferido na calculadora oficial da CASAN: cada faixa incide só sobre o volume dentro dela (a segunda faixa, rotulada \"11 a 25\", começa depois de 10 m³ nas fórmulas) e a TFDI soma-se ao volume. A planilha foi recalculada em 17/10/2026 para 10 consumos e todos os resultados são reproduzidos pelo gerador.",
        "Esgoto a 100% do faturamento de água, inclusive a TFDI: a calculadora manda considerar \"Faturamento de Água + 100% do Faturamento de Esgoto (TFDI + Volume)\", e o total da fatura é o dobro do subtotal de água.",
        "Barracão (PR) consta como atendido pela CASAN no SINISA 2024; a tabela é a estadual de Santa Catarina e a regulação desse município não foi verificada, por isso ele fica fora da associação.",
        "A calculadora divide o volume pelo número de unidades autônomas; a simulação usa uma economia. Arredondamento com volume fracionário não verificado.",
        "Tarifa social da Lei 14.898/2024: TFDI e faixa de 0 a 15 m³ à metade da residencial; as demais faixas, iguais às da residencial. A tabela social anterior vale só para solicitações recebidas até 10/12/2024 (nota da tabela da CASAN). Critérios de enquadramento não foram lidos em ato; a calculadora oficial da social não traz o total da fatura, e o dobro vem da nota da própria planilha.",
        "A tabela da residencial social anterior não tem calculadora oficial; seus exemplos são cálculo manual a partir da tabela.",
        "Comercial, micro e pequeno comércio, industrial, pública e pública especial constam da tabela e não foram simuladas; as soluções individuais de esgotamento sanitário têm tabela própria (Deliberação 021/2025 de ARIS, AGIR e CISAM-SUL) e também não.",
        "A página da CASAN data a Resolução ARESC 389 de 13/01/2026; o ato original é de 12/02/2026. Os atos de ARIS (Deliberação 003/2026), AGIR (Decisão 321) e CISAM-SUL (Resolução CREFISBA 07/2026), citados pela CASAN, não foram lidos, e a data de publicação no Diário Oficial de Santa Catarina não foi verificada em fonte oficial.",
        "Verificação cruzada feita pelo gerador: TFDI e faixas da residencial e da social anterior reproduzem a aba 2025 da calculadora vezes 1,058 ao centavo; a social da Lei 14.898/2024 é metade da residencial na TFDI e na primeira faixa. A tabela de março de 2025 (45,72) reproduz a de 2024 (43,31) vezes 1,0556, o reajuste da Resolução ARESC 321/2025.",
    ],
    "exemplosOficiais": {
        "residencial": {"0": 92.68, "5": 123.48, "10": 154.28, "11": 182.90, "20": 440.48, "25": 583.58, "30": 774.98, "50": 1540.58, "51": 1588.74, "60": 2022.18},
        "social": {"0": 46.34, "10": 77.14, "15": 92.54, "16": 121.16, "20": 235.64, "25": 378.74, "30": 570.14, "50": 1335.74, "51": 1383.90, "60": 1817.34},
    },
    "exemplos": {"social_anterior": {"10": 28.86, "20": 111.06}},
    "acessado": "2026-10-17",
}


def confere_reajuste_casan():
    """TFDI e faixas de 2026 = tabela de 2025 vezes 1,058 ao centavo; social federal = metade da residencial na TFDI e na faixa de 0 a 15 m³."""
    fator = d(CASAN_REAJUSTE_2026)
    centavo = Decimal("0.01")
    erros = []

    def q(x):
        return d(x).quantize(centavo, rounding=ROUND_HALF_UP)

    for cat, atual in CASAN_2026.items():
        antes = CASAN_2025[cat]
        if q(d(antes["tfdi"]) * fator) != d(atual["tfdi"]):
            erros.append(f"CASAN {cat} TFDI: {antes['tfdi']} × {fator} = {q(d(antes['tfdi']) * fator)}, a tabela traz {atual['tfdi']}")
        for i, (a, n) in enumerate(zip(antes["precos"], atual["precos"])):
            if q(d(a) * fator) != d(n):
                erros.append(f"CASAN {cat} faixa {i + 1}: {a} × {fator} = {q(d(a) * fator)}, a tabela traz {n}")
    res = CASAN_2026["residencial"]
    soc = CASAN_SOCIAL_FEDERAL
    if q(d(res["tfdi"]) / 2) != d(soc["tfdi"]):
        erros.append(f"CASAN social federal TFDI: metade de {res['tfdi']} é {q(d(res['tfdi']) / 2)}, a tabela traz {soc['tfdi']}")
    if q(d(res["precos"][0]) / 2) != d(soc["precos"][0]):
        erros.append(f"CASAN social federal 0 a 15 m³: metade de {res['precos'][0]} é {q(d(res['precos'][0]) / 2)}, a tabela traz {soc['precos'][0]}")
    if res["precos"][1:] != soc["precos"][1:]:
        erros.append("CASAN social federal: faixas acima de 15 m³ deveriam ser as da residencial")
    # reajuste anterior (Resolução ARESC 321/2025): 43,31 × 1,0556 = 45,72
    if q(d("43.31") * d("1.0556")) != d("45.72"):
        erros.append("CASAN: 43,31 × 1,0556 não dá a TFDI de março de 2025 (45,72)")
    return erros


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

    sp_curitiba = sanepar(85, "curitiba", "Curitiba (esgoto a 85% da fatura de água; 50% no Água Solidária)")
    sp_demais = sanepar(80, "demais", "Demais localidades operadas pela SANEPAR (esgoto a 80% da fatura de água; 50% no Água Solidária), exceto Pontal do Paraná, Matinhos e Guaratuba")
    lista = [compesa, copasa, sabesp, sp_curitiba, sp_demais, caesb, saneago, casan]

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
    saneago["municipios"] = mun(saneago["prestadorSinisa"])
    # Barracão (PR, 4102604) consta como atendido pela CASAN no SINISA 2024, mas a tabela estadual vale em Santa Catarina
    casan["municipios"] = sorted(m for m in mun(casan["prestadorSinisa"]) if m.startswith("42"))

    erros = confere_reajuste_2026() + confere_reajuste_casan()
    for t in lista:
        t.setdefault("acessado", ACESSO)
        for chave in ("exemplos", "exemplosOficiais"):
            for cat, ex in t.get(chave, {}).items():
                for c, esperado in ex.items():
                    obtido = conta(t["categorias"][cat], int(c))
                    if obtido != d(esperado):
                        erros.append(f"{t['id']} {cat} {c} m³ ({chave}): obtido {obtido}, esperado {esperado}")
    if erros:
        raise SystemExit("exemplos não conferem:\n" + "\n".join(erros))
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8") as fh:
        json.dump({"acessado": ACESSO, "tarifas": lista}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"{len(lista)} tabelas; municípios associados: " + ", ".join(f"{t['id']}={len(t['municipios'])}" for t in lista))


if __name__ == "__main__":
    main()
