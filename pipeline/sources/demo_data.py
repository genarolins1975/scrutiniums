"""Dados DEMONSTRATIVOS para módulos sem fonte pública estável no MVP.

REGRAS (briefing §38):
- todo registro carrega demo=True e o front-end exibe selo "DADO DEMONSTRATIVO";
- jamais misturados a dados reais numa mesma série/tabela sem marcação;
- estrutura idêntica à esperada da fonte real, para substituição imediata.

Os valores são plausíveis em ordem de grandeza (inspirados em publicações públicas
do Open Finance Brasil e em estatísticas judiciais agregadas), mas NÃO são observações.
Gerados deterministicamente (sem aleatoriedade) para reprodutibilidade.
"""

OPEN_FINANCE_DEMO = {
    "demo": True,
    "selo": "DADO DEMONSTRATIVO",
    "motivo": "O dashboard público do Open Finance Brasil não possui API estável documentada; conector adaptável previsto (SPEC §5-6).",
    "ref_period": "2026-06",
    "instituicoes": [
        {"nome": "Banco A (demo)", "consentimentos_ativos_recebidos": 9800000, "consentimentos_transmitidos": 7200000, "novos_consentimentos_mes": 620000, "chamadas_api_mes": 410000000, "taxa_sucesso_pct": 99.1, "disponibilidade_pct": 99.6, "latencia_p95_ms": 380, "iniciacoes_pagamento_mes": 2100000},
        {"nome": "Banco B (demo)", "consentimentos_ativos_recebidos": 7600000, "consentimentos_transmitidos": 8900000, "novos_consentimentos_mes": 480000, "chamadas_api_mes": 350000000, "taxa_sucesso_pct": 98.4, "disponibilidade_pct": 99.2, "latencia_p95_ms": 520, "iniciacoes_pagamento_mes": 1500000},
        {"nome": "Fintech C (demo)", "consentimentos_ativos_recebidos": 12500000, "consentimentos_transmitidos": 2100000, "novos_consentimentos_mes": 950000, "chamadas_api_mes": 520000000, "taxa_sucesso_pct": 99.5, "disponibilidade_pct": 99.8, "latencia_p95_ms": 210, "iniciacoes_pagamento_mes": 4800000},
        {"nome": "Banco D (demo)", "consentimentos_ativos_recebidos": 5400000, "consentimentos_transmitidos": 6100000, "novos_consentimentos_mes": 310000, "chamadas_api_mes": 240000000, "taxa_sucesso_pct": 97.8, "disponibilidade_pct": 98.9, "latencia_p95_ms": 640, "iniciacoes_pagamento_mes": 900000},
        {"nome": "Cooperativa E (demo)", "consentimentos_ativos_recebidos": 1800000, "consentimentos_transmitidos": 2400000, "novos_consentimentos_mes": 140000, "chamadas_api_mes": 80000000, "taxa_sucesso_pct": 98.9, "disponibilidade_pct": 99.4, "latencia_p95_ms": 450, "iniciacoes_pagamento_mes": 350000},
        {"nome": "Banco F (demo)", "consentimentos_ativos_recebidos": 3100000, "consentimentos_transmitidos": 4000000, "novos_consentimentos_mes": 180000, "chamadas_api_mes": 150000000, "taxa_sucesso_pct": 96.9, "disponibilidade_pct": 98.2, "latencia_p95_ms": 780, "iniciacoes_pagamento_mes": 600000},
    ],
    "serie_consentimentos_total": [
        {"ref": "2025-07", "valor": 32100000}, {"ref": "2025-08", "valor": 33400000},
        {"ref": "2025-09", "valor": 34500000}, {"ref": "2025-10", "valor": 35900000},
        {"ref": "2025-11", "valor": 37000000}, {"ref": "2025-12", "valor": 38400000},
        {"ref": "2026-01", "valor": 39100000}, {"ref": "2026-02", "valor": 40300000},
        {"ref": "2026-03", "valor": 41800000}, {"ref": "2026-04", "valor": 42600000},
        {"ref": "2026-05", "valor": 43900000}, {"ref": "2026-06", "valor": 45200000},
    ],
}

RJ_DEMO = {
    "demo": True,
    "selo": "DADO DEMONSTRATIVO",
    "motivo": "Captura de RJ exige integração tribunal a tribunal (Fase 4). Esquema real implementado; casos abaixo são fictícios.",
    "casos": [
        {"razao_social": "Metalúrgica Exemplo S.A. (demo)", "cnpj_raiz": "00000001", "cnae_secao": "C", "cnae_desc": "Indústrias de transformação", "uf": "SP", "fase": "deferimento", "data_pedido": "2026-05-12", "tribunal": "TJSP", "divida_declarada_rmi": 850, "confianca_divida": "declarada", "n_credores": 420, "credores_financeiros_pct": 55},
        {"razao_social": "Construtora Modelo Ltda. (demo)", "cnpj_raiz": "00000002", "cnae_secao": "F", "cnae_desc": "Construção", "uf": "RJ", "fase": "plano_apresentado", "data_pedido": "2026-03-03", "tribunal": "TJRJ", "divida_declarada_rmi": 1200, "confianca_divida": "lista_credores", "n_credores": 890, "credores_financeiros_pct": 40},
        {"razao_social": "Varejo Ilustrativo S.A. (demo)", "cnpj_raiz": "00000003", "cnae_secao": "G", "cnae_desc": "Comércio", "uf": "MG", "fase": "assembleia", "data_pedido": "2025-11-20", "tribunal": "TJMG", "divida_declarada_rmi": 2400, "confianca_divida": "declarada", "n_credores": 1500, "credores_financeiros_pct": 62},
        {"razao_social": "Agro Fictícia S.A. (demo)", "cnpj_raiz": "00000004", "cnae_secao": "A", "cnae_desc": "Agropecuária", "uf": "MT", "fase": "pedido", "data_pedido": "2026-07-01", "tribunal": "TJMT", "divida_declarada_rmi": 640, "confianca_divida": "estimada", "n_credores": 210, "credores_financeiros_pct": 70},
        {"razao_social": "Transportes Hipotéticos Ltda. (demo)", "cnpj_raiz": "00000005", "cnae_secao": "H", "cnae_desc": "Transporte e armazenagem", "uf": "PR", "fase": "homologacao", "data_pedido": "2025-08-15", "tribunal": "TJPR", "divida_declarada_rmi": 310, "confianca_divida": "plano", "n_credores": 180, "credores_financeiros_pct": 48},
    ],
    "serie_pedidos_mensais": [
        {"ref": "2025-08", "valor": 112}, {"ref": "2025-09", "valor": 118}, {"ref": "2025-10", "valor": 125},
        {"ref": "2025-11", "valor": 121}, {"ref": "2025-12", "valor": 109}, {"ref": "2026-01", "valor": 130},
        {"ref": "2026-02", "valor": 127}, {"ref": "2026-03", "valor": 141}, {"ref": "2026-04", "valor": 138},
        {"ref": "2026-05", "valor": 149}, {"ref": "2026-06", "valor": 152},
    ],
    "componentes_setoriais": {
        "A": {"rj_z": 1.4, "emprego_z": -0.6}, "C": {"rj_z": 0.8, "emprego_z": -0.4},
        "F": {"rj_z": 0.9, "emprego_z": -0.7}, "G": {"rj_z": 1.1, "emprego_z": -0.2},
        "H": {"rj_z": 0.5, "emprego_z": 0.1}, "B": {"rj_z": 0.2, "emprego_z": 0.3},
    },
}
