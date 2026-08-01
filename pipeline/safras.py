"""Safras de crédito (análise de coortes) — gold safras.json.

Situação do dado oficial (verificada em 01/08/2026): o BCB lançou em
29/01/2018 a publicação trimestral "Inadimplência Coorte" (SCR), com curvas
por safra de contratação para PF (empréstimo COM consignação em folha, SEM
consignação, veículos e habitacional; atraso >30/60/90 dias, prejuízo
acumulado e exclusões, horizonte de 90/180 meses). Hoje restam online apenas
as notas metodológicas e os exemplos gráficos; os arquivos de dados não
constam de nenhum canal estruturado (dados abertos/CKAN, Olinda, SGS) e a
página original saiu do ar. Este módulo:
1. Declara o conceito e o status com as URLs oficiais que sobrevivem;
2. Publica o MELHOR DADO REAL disponível hoje: inadimplência arrastada e
   atraso 15-90d do ESTOQUE por modalidade PF (SCR.data, agregação nacional
   do silver) — deixando explícito que estoque NÃO é safra;
3. Nunca digitaliza gráficos de PDF nem gera série sintética de coorte.
"""
from pipeline import common

# Modalidades PF exibidas na aba (produtos do mapa scr_data.produto_de)
PRODUTOS = [
    ("Crédito pessoal", "credito_pessoal", "empréstimo sem consignação em folha"),
    ("Consignado", "consignado", "empréstimo com consignação em folha"),
    ("Veículos", "veiculos", "aquisição de veículos"),
    ("Imobiliário", "imobiliario", "financiamento habitacional/imobiliário"),
    ("Cartão — parcelado/financiado", "cartao_parcelado", "fatura parcelada e saque financiado (inclui migração do rotativo)"),
]

CONCEITO = {
    "o_que_e": (
        "Análise de safra (coorte): acompanha TODAS as operações contratadas em um mesmo mês "
        "ao longo da vida delas, medindo que fração fica em atraso >30/60/90 dias ou vai a prejuízo "
        "N meses após a contratação. Separa a qualidade da ORIGINAÇÃO (quem emprestou para quem, em que condições) "
        "do efeito do CICLO econômico e da composição do estoque — a pergunta que o estoque não responde."
    ),
    "fonte_oficial": {
        "nome": "BCB — Inadimplência Coorte (SCR)",
        "lancamento": "2018-01-29",
        "frequencia_original": "trimestral",
        "metricas": ["atraso >30, >60 e >90 dias (% do coorte)", "prejuízo acumulado", "operações excluídas com sinais de deterioração (controle de viés)", "valor e quantidade de operações do coorte"],
        "modalidades": ["PF — empréstimo COM consignação em folha", "PF — empréstimo SEM consignação em folha (crédito pessoal)", "PF — veículos", "PF — habitacional"],
        "horizonte": "até 90 meses após a contratação (180 para habitacional)",
        "notas_metodologicas": "https://www.bcb.gov.br/content/estabilidadefinanceira/scr/inadimplencia_coorte/Notas_Metodologicas.pdf",
        "exemplos_graficos": "https://www.bcb.gov.br/content/estabilidadefinanceira/scr/inadimplencia_coorte/Exemplos_Graficos.pdf",
    },
    "status_dado": {
        "situacao": "indisponivel",
        "verificado_em": "2026-08-01",
        "detalhe": (
            "Os arquivos de dados da publicação não constam de nenhum canal estruturado do BC: "
            "sem dataset no portal de dados abertos (CKAN), sem serviço Olinda, sem série SGS com 'safra' ou 'coorte', "
            "sem link na página atual do SCR e com a rota original (p/txinadimplencia) fora do ar. "
            "Restam online as notas metodológicas e os exemplos gráficos (links acima)."
        ),
        "caminho_reativacao": (
            "Pedido via Fale Conosco/LAI ao BCB citando a publicação 'Inadimplência Coorte' (Depec/Desig): "
            "o produto é agregado e não sigiloso. Este painel passa a exibir as curvas oficiais assim que o dado reaparecer."
        ),
        "politica": "Sem dado público, o painel mostra a lacuna. Não digitalizamos gráficos de PDF nem geramos série sintética de coorte.",
    },
    "proxy": {
        "o_que_mostra": (
            "Enquanto o dado de safra não volta, exibimos o melhor dado real disponível: inadimplência arrastada e atraso 15-90 dias "
            "do ESTOQUE por modalidade PF (SCR.data, agregação nacional). É a fotografia da carteira inteira em cada mês — "
            "todas as safras misturadas."
        ),
        "por_que_nao_e_safra": (
            "O estoque mistura contratos novos e antigos: crescimento acelerado DILUI a inadimplência (denominador novo ainda saudável) "
            "e desaceleração a CONCENTRA, sem que a qualidade da originação tenha mudado. A leitura por safra remove esse efeito; "
            "a de estoque não. Compare níveis entre modalidades e tendências, nunca 'qualidade da originação'."
        ),
    },
}


def build(con):
    datas = [r[0] for r in con.execute("SELECT DISTINCT data FROM scr_uf_produto ORDER BY data")]
    series = {}
    for nome, key, descricao in PRODUTOS:
        obs = []
        for d, saldo, inad, v1590 in con.execute(
            "SELECT data, SUM(saldo), SUM(inad), SUM(v1590) FROM scr_uf_produto "
            "WHERE cliente='PF' AND produto=? GROUP BY data ORDER BY data", (nome,)):
            if not saldo:
                continue
            obs.append({
                "ref": f"{d}-01",
                "saldo": round(saldo),
                "inad": round(inad / saldo * 100, 2),
                "atraso15_90": round(v1590 / saldo * 100, 2),
            })
        if obs:
            series[key] = {"nome": nome, "descricao": descricao, "obs": obs}

    common.write_gold("safras.json", {
        "gerado_em": common.now_utc(),
        "conceito": CONCEITO,
        "proxy_series": {
            "tipo": "DADO OBSERVADO",
            "fonte": "BCB SCR.data v2 (dados abertos) — agregação nacional PF por modalidade",
            "conceitos": {
                "inad": "inadimplência ARRASTADA: operações com parcela vencida >90d contadas por inteiro / carteira ativa (≠ SGS 21082)",
                "atraso15_90": "parcelas vencidas de 15 a 90 dias / carteira ativa",
            },
            "periodo": f"{datas[0]} a {datas[-1]}" if datas else None,
            "series": series,
        },
    })
    return {"ok": True, "modalidades": len(series), "datas": len(datas)}
