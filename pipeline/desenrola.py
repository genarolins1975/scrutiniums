"""Gold do Desenrola Brasil.

Este módulo carrega mais texto do que a média porque a fonte carrega menos dado do que
a média. A base do BCB tem sete colunas; um painel honesto do Desenrola precisa dizer,
o tempo todo, o que ela permite e o que não permite concluir.

Três separações que o gold impõe e a página herda:

* **SCR ≠ programa.** A base cobre apenas operações informadas ao SCR como renegociações
  do Desenrola que viraram *nova operação de crédito*. Fica de fora o que foi quitado
  com recursos próprios no ato — que, depois de descontos médios de 83% no leilão da
  Faixa 1, foi o caminho da maior parte —, os credores não financeiros e os clientes com
  dívida total abaixo de R$ 200. Por isso o volume aqui (bilhões) é uma ordem de grandeza
  menor que os R$ 53 bi oficialmente regularizados, e o painel reconcilia isso em vez de
  escolher um número.
* **Faixas ≠ Pequenos Negócios.** Tipos 1 e 2 são pessoas físicas (Lei 14.690/2023).
  Tipo 3 é outro programa, de pessoas jurídicas (MP 1.213/2024). Nunca somados.
* **Desnegativação ≠ pagamento.** Dívidas de até R$ 100 tiveram baixa permanente no
  cadastro de inadimplentes. Isso não é renegociação, não é quitação e não é perdão —
  e explica boa parte da distância entre "15 milhões de beneficiados" e "menos de 5
  milhões que renegociaram", ambos números oficiais do mesmo relatório.
"""
from pipeline import common

FONTE_BCB = "BCB — Desenrola Brasil (dados agregados do SCR)"
URL_DATASET = "https://dadosabertos.bcb.gov.br/dataset/desenrola-brasil"
URL_AVALIACAO = ("https://www.gov.br/planejamento/pt-br/assuntos/avaliacao-de-politicas-publicas/"
                 "arquivos/avaliacoes-ex-ante/relatorio-de-avaliacao-desenrola-brasil.pdf")

FAIXAS_PF = ("faixa1", "faixa2")

AVISO_COBERTURA = (
    "Esta base cobre somente operações informadas ao SCR como renegociações do Desenrola que "
    "resultaram em nova operação de crédito. A própria fonte declara excluir: dívidas quitadas com "
    "recursos próprios no momento da renegociação, renegociações não elegíveis ao programa e "
    "clientes com dívida total inferior a R$ 200. Credores não financeiros — varejo, serviços "
    "públicos, telecomunicações — não reportam ao SCR e não aparecem aqui, embora tenham "
    "participado do programa."
)

AVISO_TIPO3 = (
    "O Desenrola Pequenos Negócios (MP 1.213/2024) é um programa distinto, de pessoas jurídicas. "
    "Aparece na mesma base do BCB como tipo 3, mas não se soma às faixas 1 e 2: público, porte e "
    "valor por operação são de outra ordem. Fica neste painel apenas como quadro de contexto."
)

AVISO_SETEMBRO = (
    "Na data-base de setembro de 2023 a fonte informa operações renegociadas no mês OU em meses "
    "anteriores. É o único mês acumulado da série: lido como fluxo mensal, cria um pico que não "
    "existiu."
)

# --------------------------------------------------------------------------------------
# Linha do tempo. Cada marco traz a fonte que o sustenta — nada aqui vem de memória.
# --------------------------------------------------------------------------------------
LINHA_DO_TEMPO = [
    {"data": "2023-06-05", "rotulo": "Medida Provisória 1.176/2023",
     "detalhe": "Institui o Programa Emergencial de Renegociação de Dívidas de Pessoas Físicas Inadimplentes.",
     "tipo": "norma", "fonte": "MP 1.176/2023"},
    {"data": "2023-07-17", "rotulo": "Anúncio do programa e início da Faixa 2",
     "detalhe": "Governo Federal anuncia o Desenrola; as negociações da Faixa 2 começam na mesma data.",
     "tipo": "marco", "fonte": "Relatório de Avaliação MPO/BID/BCB, seção 1"},
    {"data": "2023-09-01", "rotulo": "Leilão de descontos da Faixa 1",
     "detalhe": ("Seleção das dívidas por processo competitivo na modalidade de leilão de maior desconto, "
                 "com 654 credores. Desconto médio ofertado de 83%: R$ 137 bilhões em dívidas atualizadas "
                 "caíram para cerca de R$ 25 bilhões."),
     "tipo": "marco", "fonte": "Exposição de Motivos 1199/2023, citada no Relatório de Avaliação"},
    {"data": "2023-09-30", "rotulo": "Primeira data-base publicada no SCR",
     "detalhe": AVISO_SETEMBRO, "tipo": "dado", "fonte": "BCB, dados abertos do Desenrola"},
    {"data": "2023-10-03", "rotulo": "Lei 14.690/2023",
     "detalhe": "Converte a MP em lei e consolida o marco legal do programa.",
     "tipo": "norma", "fonte": "Lei 14.690/2023"},
    {"data": "2023-10-09", "rotulo": "Abertura da plataforma e início da Faixa 1",
     "detalhe": ("A Faixa 1 só começou em outubro porque exigiu plataforma própria. O acesso dependia de "
                 "conta Gov.br nos níveis prata ou ouro."),
     "tipo": "marco", "fonte": "Relatório de Avaliação MPO/BID/BCB, seção 1"},
    {"data": "2023-12-01", "rotulo": "Primeira prorrogação da Faixa 1",
     "detalhe": "Prazo da Faixa 1 estendido pela primeira vez.",
     "tipo": "marco", "fonte": "Relatório de Avaliação MPO/BID/BCB, seção 1"},
    {"data": "2024-01-01", "rotulo": "Ampliação do acesso e canais parceiros",
     "detalhe": ("Passa a admitir contas Gov.br de nível bronze e autoriza plataformas próprias de birôs "
                 "de crédito e instituições financeiras. Divulgação no Caixa Tem e piloto de WhatsApp."),
     "tipo": "ajuste", "fonte": "Considerações da SRE/Ministério da Fazenda no Relatório de Avaliação"},
    {"data": "2024-03-01", "rotulo": "Segunda prorrogação da Faixa 1",
     "detalhe": "Prazo da Faixa 1 estendido pela segunda vez.",
     "tipo": "marco", "fonte": "Relatório de Avaliação MPO/BID/BCB, seção 1"},
    {"data": "2024-04-23", "rotulo": "MP 1.213/2024 — Desenrola Pequenos Negócios",
     "detalhe": "Programa distinto, voltado a pessoas jurídicas. Aparece como tipo 3 na base do BCB.",
     "tipo": "norma", "fonte": "MP 1.213/2024, citada no dataset do BCB"},
    {"data": "2024-05-20", "rotulo": "Encerramento do Desenrola Brasil",
     "detalhe": "Fim do prazo de adesão ao programa de pessoas físicas.",
     "tipo": "marco", "fonte": "Relatório de Avaliação MPO/BID/BCB, seção 1"},
    {"data": "2026-01-12", "rotulo": "Publicação do Relatório de Avaliação",
     "detalhe": ("Avaliação experimental conduzida por MPO, BID e BCB sobre uma campanha de e-mails para "
                 "elevar a adesão."),
     "tipo": "avaliacao", "fonte": "Ministério do Planejamento e Orçamento"},
]

# --------------------------------------------------------------------------------------
# Arquitetura do programa. Comparação entre componentes, com a sobreposição declarada.
# --------------------------------------------------------------------------------------
COMPONENTES = [
    {"id": "faixa1", "nome": "Faixa 1", "publico": "Renda de até 2 salários mínimos ou inscrição no CadÚnico",
     "divida": "Dívidas de até R$ 5 mil, negativadas", "periodo": "out/2023 a mai/2024 (prorrogada em dez/2023 e mar/2024)",
     "canal": "Plataforma própria do Desenrola (Gov.br prata/ouro; depois bronze e canais parceiros)",
     "garantia": "Sim — Fundo Garantidor de Operações (FGO)",
     "dados": "Base do BCB (tipo 1), apenas quando a renegociação virou nova operação de crédito no SCR",
     "fonte": "Relatório de Avaliação MPO/BID/BCB"},
    {"id": "faixa2", "nome": "Faixa 2", "publico": "Renda de até R$ 20 mil",
     "divida": "Dívidas com registro negativo até o fim de 2022", "periodo": "jul/2023 a mai/2024",
     "canal": "Negociação direta com as instituições credoras",
     "garantia": "Não", "dados": "Base do BCB (tipo 2)",
     "fonte": "Relatório de Avaliação MPO/BID/BCB"},
    {"id": "desnegativacao", "nome": "Baixa de registro negativo (dívidas até R$ 100)",
     "publico": "Público da Faixa 1", "divida": "Dívidas de R$ 100 ou menos",
     "periodo": "a partir de 2023", "canal": "Automático, sem ação do devedor",
     "garantia": "Não se aplica",
     "dados": ("INDISPONÍVEL em base pública desagregada. Não aparece na base do BCB porque não gera "
               "operação de crédito."),
     "fonte": "Relatório de Avaliação MPO/BID/BCB",
     "alerta": ("Baixa de registro negativo NÃO é pagamento, renegociação nem perdão da dívida. O débito "
                "continua existindo; o que sai é a anotação no cadastro de inadimplentes.")},
    {"id": "pequenos_negocios", "nome": "Desenrola Pequenos Negócios", "publico": "Pessoas jurídicas (MEI, ME, EPP)",
     "divida": "Dívidas de pequenos negócios", "periodo": "a partir de mai/2024",
     "canal": "Instituições financeiras", "garantia": "Fundo garantidor próprio",
     "dados": "Base do BCB (tipo 3)", "fonte": "MP 1.213/2024",
     "alerta": AVISO_TIPO3, "contexto": True},
]

# --------------------------------------------------------------------------------------
# Números oficiais, com atribuição. Não são recalculados aqui — são citados.
# --------------------------------------------------------------------------------------
OFICIAIS = [
    {"id": "elegiveis", "rotulo": "Público potencialmente elegível", "valor": 30_000_000,
     "unidade": "pessoas", "selo": "reportado",
     "fonte": "Relatório de Avaliação MPO/BID/BCB, introdução",
     "nota": "Estimativa oficial de elegíveis à Faixa 1."},
    {"id": "beneficiados", "rotulo": "Pessoas beneficiadas pelo programa", "valor": 15_000_000,
     "unidade": "pessoas", "selo": "reportado",
     "fonte": "Considerações da SRE/Ministério da Fazenda no Relatório de Avaliação",
     "nota": ("Inclui a baixa de registros negativos, que não é renegociação. Não confundir com o número "
              "de quem renegociou.")},
    {"id": "renegociaram", "rotulo": "Pessoas que renegociaram dívidas", "valor": 5_000_000,
     "unidade": "pessoas (menos de)", "selo": "reportado",
     "fonte": "Relatório de Avaliação MPO/BID/BCB, introdução",
     "nota": "'Pouco menos de 5 milhões de indivíduos' procuraram o programa para renegociar."},
    {"id": "regularizado", "rotulo": "Dívidas regularizadas", "valor": 53_000_000_000,
     "unidade": "R$ (mais de)", "selo": "reportado",
     "fonte": "Considerações da SRE/Ministério da Fazenda no Relatório de Avaliação",
     "nota": "Valor das dívidas regularizadas pelo programa, em conceito mais amplo que o do SCR."},
    {"id": "leilao_antes", "rotulo": "Dívidas levadas ao leilão da Faixa 1", "valor": 137_000_000_000,
     "unidade": "R$", "selo": "reportado",
     "fonte": "Exposição de Motivos 1199/2023",
     "nota": "Valor atualizado das dívidas antes do desconto, com 654 credores participantes."},
    {"id": "leilao_depois", "rotulo": "Valor após o leilão de descontos", "valor": 25_000_000_000,
     "unidade": "R$ (cerca de)", "selo": "reportado",
     "fonte": "Exposição de Motivos 1199/2023",
     "nota": "Desconto médio ofertado de 83% no leilão de maior desconto da Faixa 1."},
]

# --------------------------------------------------------------------------------------
# Avaliação oficial com desenho causal válido. Único bloco do painel com selo "causal".
# --------------------------------------------------------------------------------------
AVALIACAO = {
    "titulo": "Relatório de Avaliação — Desenrola Brasil",
    "autores": "Ministério do Planejamento e Orçamento (SMA/MPO), Banco Interamericano de Desenvolvimento e Banco Central do Brasil",
    "url": URL_AVALIACAO,
    "publicado": "2026-01-12",
    "objeto": ("A avaliação NÃO mede o efeito do Desenrola sobre o endividamento. Ela mede o efeito de uma "
               "campanha de e-mails desenhada para aumentar a adesão ao programa — pergunta diferente, e "
               "é a única com desenho experimental disponível."),
    "desenho": ("Experimento aleatorizado. De 28 milhões de elegíveis no CadÚnico, 7,2 milhões tinham e-mail "
                "válido e consistente; destes, 3,63 milhões foram sorteados e estratificados em 6 amostras "
                "estatisticamente semelhantes. Cerca de 3 milhões receberam comunicação; 600 mil formaram o "
                "grupo de controle puro. Estimação por regressão em corte transversal, em painel e por "
                "diferenças em diferenças."),
    "resultados": [
        {"achado": "Na amostra completa, não foi possível encontrar impacto observável da campanha sobre "
                   "acesso à plataforma, renegociação ou pagamento das dívidas.",
         "selo": "causal", "forca": "Intenção de tratar, com aleatorização preservada."},
        {"achado": "Apenas 2,3% dos destinatários abriram os e-mails — a ausência de efeito médio é "
                   "explicada em parte pela falha de alcance da comunicação, não necessariamente por "
                   "ineficácia da mensagem.",
         "selo": "reportado", "forca": "Métrica de execução da campanha."},
        {"achado": "Entre quem abriu os e-mails, aumento de 0,4 a 0,6 ponto percentual em renegociação e "
                   "cumprimento dos pagamentos, e de 0,6 a 1 ponto percentual no acesso à plataforma, "
                   "sobretudo com cartilhas de passo a passo.",
         "selo": "associacao",
         "forca": ("Condicionar à abertura do e-mail seleciona sobre uma variável posterior ao sorteio: "
                   "quem abre difere de quem não abre em características não observadas. O próprio "
                   "relatório apresenta este resultado como condicionado, e ele não tem a mesma força "
                   "do resultado da amostra completa.")},
        {"achado": "Efeitos heterogêneos: não idosos e pessoas com menor escolaridade responderam melhor "
                   "às intervenções, com as cartilhas de passo a passo.",
         "selo": "associacao", "forca": "Subgrupos dentro da amostra condicionada à abertura."},
    ],
    "conclusao_dos_autores": ("Estratégias digitais de comunicação, isoladamente, não alcançam os grupos mais "
                              "vulneráveis, que são os principais beneficiários potenciais. Futuras políticas "
                              "deveriam investir em estratégias multicanais, apoio humano e correção de "
                              "barreiras estruturais."),
    "limite": ("Esta avaliação não permite afirmar qual foi o efeito do Desenrola sobre inadimplência, "
               "acesso a crédito ou bem-estar dos beneficiários — ela mede outra coisa. Uma avaliação desse "
               "efeito não existe em fonte pública verificável até esta data-base."),
}

# --------------------------------------------------------------------------------------
# Matriz de viabilidade: cada indicador pedido de um painel do Desenrola, e o veredito.
# --------------------------------------------------------------------------------------
def _matriz():
    V, P, I = "viavel", "parcial", "indisponivel"
    def m(area, ind, status, base, falta=None):
        return {"area": area, "indicador": ind, "status": status, "base": base, "falta": falta}
    return [
        m("Alcance", "Operações renegociadas por mês, faixa, UF e conglomerado", V, "BCB/SCR — base do Desenrola"),
        m("Alcance", "Volume renegociado (valor após desconto)", V, "BCB/SCR — base do Desenrola"),
        m("Alcance", "Valor médio por operação", V, "calculado: volume ÷ operações"),
        m("Alcance", "Pessoas beneficiadas (total do programa)", P, "citado do relatório oficial",
          "A base do BCB conta operações, não pessoas. Uma pessoa pode ter várias operações e a base não "
          "permite deduplicar."),
        m("Alcance", "Taxa de adesão sobre elegíveis", P, "razão entre números oficiais citados",
          "Numerador e denominador vêm de documentos diferentes e de conceitos diferentes; a razão é "
          "ilustrativa, não uma taxa medida."),
        m("Alcance", "Número médio de dívidas por beneficiário", I, None,
          "Exigiria contagem de pessoas distintas, que a base não traz."),
        m("Alcance", "Funil elegíveis → ofertas → contratos → pagos", I, None,
          "Ofertas realizadas e acordos pagos não são publicados em base aberta."),
        m("Condições", "Valor original da dívida", I, None,
          "A base publica somente o valor APÓS o desconto."),
        m("Condições", "Desconto médio e mediano por operação", I, None,
          "Exige valor original por operação. O desconto médio de 83% do leilão da Faixa 1 é agregado e "
          "vem de outra fonte."),
        m("Condições", "Entrada, número de parcelas, valor da parcela", I, None, "Não há essas colunas na base."),
        m("Condições", "Taxa de juros e prazo da renegociação", I, None, "Não há essas colunas na base."),
        m("Condições", "Distribuições, percentis e histogramas de valores", I, None,
          "A base é agregada por célula; não há microdado nem distribuição publicada."),
        m("Beneficiários", "Distribuição por UF e região", V, "BCB/SCR — base do Desenrola"),
        m("Beneficiários", "Operações por mil adultos na UF", V, "calculado com população IBGE"),
        m("Beneficiários", "Município", I, None, "A base tem UF como menor granularidade geográfica."),
        m("Beneficiários", "Sexo, idade, faixa de renda, CadÚnico", I, None,
          "Nenhuma variável demográfica na base. Cruzar por outra via seria reidentificação."),
        m("Beneficiários", "Produto de crédito da dívida renegociada", I, None, "Não há coluna de modalidade."),
        m("Credores", "Participação por conglomerado financeiro", V, "BCB/SCR — base do Desenrola"),
        m("Credores", "Concentração do programa entre credores", V, "calculado: participação e HHI"),
        m("Credores", "Renegociação como proporção da carteira da instituição", P, "cruzamento com IF.data",
          "O conglomerado do Desenrola é o financeiro; a carteira do IF.data é do prudencial. A comparação "
          "existe, mas os perímetros não são idênticos."),
        m("Credores", "Credores não financeiros (varejo, serviços, utilities)", I, None,
          "Não reportam ao SCR. Participaram do programa e não aparecem em nenhuma base aberta desagregada."),
        m("Credores", "Desconto médio por instituição", I, None, "Exige valor original, que a base não traz."),
        m("Depois", "Regularidade posterior dos acordos, atrasos e reincidência", I, None,
          "A base informa a renegociação no mês em que ocorreu e não acompanha a operação depois. Coorte, "
          "sobrevivência e reincidência exigiriam painel individual do SCR, que é sigiloso."),
        m("Depois", "Novo crédito obtido pelos beneficiários", I, None,
          "Exigiria ligar beneficiário a concessões posteriores — dado individual, não público."),
        m("Fiscal", "Garantias concedidas, acionadas e recuperações do FGO", I, None,
          "Não há base pública desagregada de acionamento do FGO no âmbito do Desenrola."),
        m("Fiscal", "Custo fiscal bruto, líquido e por beneficiário", I, None,
          "Exigiria execução orçamentária do subsídio e do FGO com identificação do programa."),
        m("Efeitos", "Séries macro de crédito com marcos do programa", V, "BCB/SGS, já no Observatório"),
        m("Efeitos", "Efeito causal do programa sobre inadimplência ou acesso a crédito", I, None,
          "Não existe avaliação com desenho de identificação válido publicada em fonte pública."),
        m("Efeitos", "Efeito causal da campanha de e-mails sobre a adesão", V,
          "Relatório de Avaliação MPO/BID/BCB — experimento aleatorizado"),
    ]


def _rows(con, sql, args=()):
    cur = con.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def build(con, cfg=None):
    try:
        col = _rows(con, "SELECT * FROM desenrola_coleta ORDER BY coletado_em DESC LIMIT 1")
    except Exception:
        col = []
    if not col:
        common.write_gold("desenrola.json", {"disponivel": False,
                                             "motivo": "base do Desenrola ainda não coletada"})
        return {"ok": False, "motivo": "sem dados"}
    col = col[0]

    try:
        geo = {r["uf"]: r for r in _rows(con, "SELECT cod, uf, nome, regiao, populacao, pop_ano, svg_d FROM geo_uf")}
    except Exception:
        geo = {}

    # ---- série mensal por tipo -------------------------------------------------------
    serie = {}
    for r in _rows(con, """SELECT data_base, tipo, SUM(n_operacoes) n, SUM(volume) v
                           FROM desenrola_op GROUP BY data_base, tipo ORDER BY data_base"""):
        m = serie.setdefault(r["data_base"], {"mes": r["data_base"], "acumulado": r["data_base"] == "2023-09"})
        m[r["tipo"]] = {"operacoes": r["n"], "volume": round(r["v"], 2)}
    serie = sorted(serie.values(), key=lambda x: x["mes"])

    # ---- totais por componente -------------------------------------------------------
    componentes = []
    for c in COMPONENTES:
        base = next((x for x in _rows(con, """SELECT tipo, SUM(n_operacoes) n, SUM(volume) v,
                                                     MIN(data_base) ini, MAX(data_base) fim,
                                                     COUNT(DISTINCT cod_congl) credores
                                              FROM desenrola_op WHERE tipo=? GROUP BY tipo""", (c["id"],))), None)
        d = dict(c)
        if base:
            d.update({"operacoes": base["n"], "volume": round(base["v"], 2),
                      "ticket_medio": round(base["v"] / base["n"]) if base["n"] else None,
                      "periodo_scr": f"{base['ini']} a {base['fim']}",
                      "conglomerados": base["credores"], "no_scr": True})
        else:
            d["no_scr"] = False
        componentes.append(d)

    pf = [c for c in componentes if c["id"] in FAIXAS_PF and c.get("no_scr")]
    tot_op = sum(c["operacoes"] for c in pf)
    tot_vol = sum(c["volume"] for c in pf)
    pn = next((c for c in componentes if c["id"] == "pequenos_negocios" and c.get("no_scr")), None)

    # ---- mapa por UF (somente faixas de pessoa física) --------------------------------
    mapa = []
    for r in _rows(con, """SELECT uf, SUM(n_operacoes) n, SUM(volume) v FROM desenrola_op
                           WHERE tipo IN ('faixa1','faixa2') GROUP BY uf"""):
        g = geo.get(r["uf"], {})
        pop = g.get("populacao")
        mapa.append({
            "uf": r["uf"], "nome": g.get("nome") or r["uf"], "regiao": g.get("regiao"), "cod": g.get("cod"),
            "operacoes": r["n"], "volume": round(r["v"], 2),
            "part_br": round(100 * r["v"] / tot_vol, 3) if tot_vol else None,
            "part_op": round(100 * r["n"] / tot_op, 3) if tot_op else None,
            "ticket_medio": round(r["v"] / r["n"]) if r["n"] else None,
            "op_por_mil_hab": round(1000 * r["n"] / pop, 2) if pop else None,
            "populacao": pop,
        })
    mapa.sort(key=lambda x: -x["operacoes"])

    # ---- credores: identidade é o código; rótulo é o nome mais recente ----------------
    rotulo = {}
    for r in _rows(con, """SELECT cod_congl, nome_congl, MAX(data_base) ult FROM desenrola_op
                           GROUP BY cod_congl, nome_congl ORDER BY ult"""):
        rotulo[r["cod_congl"]] = r["nome_congl"]
    instituicoes = []
    for r in _rows(con, """SELECT cod_congl, SUM(n_operacoes) n, SUM(volume) v,
                                  MIN(data_base) ini, MAX(data_base) fim, COUNT(DISTINCT uf) ufs
                           FROM desenrola_op WHERE tipo IN ('faixa1','faixa2')
                           GROUP BY cod_congl ORDER BY SUM(n_operacoes) DESC"""):
        por_faixa = {x["tipo"]: {"operacoes": x["n"], "volume": round(x["v"], 2)}
                     for x in _rows(con, """SELECT tipo, SUM(n_operacoes) n, SUM(volume) v FROM desenrola_op
                                            WHERE cod_congl=? AND tipo IN ('faixa1','faixa2') GROUP BY tipo""",
                                    (r["cod_congl"],))}
        instituicoes.append({
            "cod": r["cod_congl"], "nome": rotulo.get(r["cod_congl"], r["cod_congl"]),
            "operacoes": r["n"], "volume": round(r["v"], 2),
            "part_op": round(100 * r["n"] / tot_op, 3) if tot_op else None,
            "part_vol": round(100 * r["v"] / tot_vol, 3) if tot_vol else None,
            "ticket_medio": round(r["v"] / r["n"]) if r["n"] else None,
            "ufs": r["ufs"], "periodo": f"{r['ini']} a {r['fim']}", "por_faixa": por_faixa,
        })
    hhi = round(sum((i["part_op"] or 0) ** 2 for i in instituicoes), 1)
    top5 = round(sum(i["part_op"] or 0 for i in instituicoes[:5]), 1)

    # ---- reconciliação com os números oficiais ---------------------------------------
    ofic_valor = next(o for o in OFICIAIS if o["id"] == "regularizado")["valor"]
    reconciliacao = {
        "scr_volume": round(tot_vol, 2),
        "oficial_regularizado": ofic_valor,
        "razao": round(ofic_valor / tot_vol, 1) if tot_vol else None,
        "explicacao": (
            "Os dois números medem coisas diferentes e nenhum está errado. O valor oficial de dívidas "
            "regularizadas contempla todo o programa, inclusive o que foi quitado à vista com recursos "
            "próprios depois de descontos que chegaram a 90%, e as dívidas com credores não financeiros. "
            "O valor do SCR contempla apenas o que virou nova operação de crédito registrada no sistema, "
            "já líquido de desconto. Depois de um leilão com desconto médio de 83%, a maior parte da "
            "Faixa 1 foi liquidada à vista — e liquidação à vista, por definição da própria fonte, não "
            "entra nesta base."),
    }

    catalogo = [
        {"id": "op_renegociadas", "nome": "Operações renegociadas", "selo": "reportado",
         "definicao": "Número de operações de crédito resultantes de renegociações do Desenrola informadas ao SCR no mês.",
         "formula": "SUM(NUMERO_OPERACOES)", "unidade": "operações", "unidade_analise": "operação de crédito",
         "periodicidade": "mensal", "fonte": FONTE_BCB, "cobertura": "set/2023 a " + col["data_base_max"],
         "limitacoes": "Operação não é pessoa: a base não permite contar beneficiários distintos.",
         "versao": "v1.0"},
        {"id": "volume", "nome": "Volume renegociado (após desconto)", "selo": "reportado",
         "definicao": "Somatório dos valores das operações após a concessão do desconto.",
         "formula": "SUM(VOLUME_OPERACOES)", "unidade": "R$", "unidade_analise": "operação de crédito",
         "periodicidade": "mensal", "fonte": FONTE_BCB, "cobertura": "set/2023 a " + col["data_base_max"],
         "limitacoes": ("É o valor DEPOIS do desconto. Não é a dívida original, não é o valor pago e não "
                        "permite calcular desconto. Valores nominais, sem deflação."),
         "versao": "v1.0"},
        {"id": "ticket", "nome": "Valor médio por operação", "selo": "calculado",
         "definicao": "Volume renegociado dividido pelo número de operações.",
         "formula": "SUM(VOLUME_OPERACOES) ÷ SUM(NUMERO_OPERACOES)", "unidade": "R$ por operação",
         "unidade_analise": "operação de crédito", "periodicidade": "mensal", "fonte": FONTE_BCB,
         "cobertura": "set/2023 a " + col["data_base_max"],
         "limitacoes": "Média de agregados, não de microdados: não há mediana nem distribuição.",
         "versao": "v1.0"},
        {"id": "op_mil_hab", "nome": "Operações por mil habitantes", "selo": "calculado",
         "definicao": "Operações das faixas 1 e 2 na UF divididas pela população estimada.",
         "formula": "1000 × operações ÷ população", "unidade": "operações por mil habitantes",
         "unidade_analise": "UF", "periodicidade": "acumulado do período", "fonte": FONTE_BCB + " ÷ IBGE SIDRA 6579",
         "cobertura": "27 UFs",
         "limitacoes": ("O denominador é a população total, não o público elegível — que não é publicado por "
                        "UF. Serve para comparar intensidade relativa, não para medir adesão."),
         "versao": "v1.0"},
        {"id": "hhi", "nome": "Concentração entre credores (HHI)", "selo": "calculado",
         "definicao": "Soma dos quadrados das participações de cada conglomerado nas operações das faixas 1 e 2.",
         "formula": "Σ(participação em %)²", "unidade": "índice (0–10.000)", "unidade_analise": "conglomerado financeiro",
         "periodicidade": "acumulado do período", "fonte": FONTE_BCB, "cobertura": f"{len(instituicoes)} conglomerados",
         "limitacoes": ("Mede concentração entre os credores que reportam ao SCR. Credores não financeiros "
                        "participaram do programa e não estão neste denominador."),
         "versao": "v1.0"},
        {"id": "adesao_ilustrativa", "nome": "Razão entre quem renegociou e o público elegível", "selo": "estimado",
         "definicao": "Pessoas que renegociaram divididas pelo público potencialmente elegível, ambos citados de documentos oficiais.",
         "formula": "5.000.000 ÷ 30.000.000", "unidade": "%", "unidade_analise": "pessoa",
         "periodicidade": "todo o programa", "fonte": "Relatório de Avaliação MPO/BID/BCB",
         "cobertura": "Faixa 1",
         "limitacoes": ("Numerador e denominador vêm de conceitos e momentos diferentes do mesmo relatório. "
                        "É uma ordem de grandeza citada, não uma taxa de adesão medida sobre um cadastro."),
         "versao": "v1.0"},
    ]

    payload = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "fonte": FONTE_BCB,
        "url_dataset": URL_DATASET,
        "licenca": "Open Data Commons Open Database License (ODbL)",
        "coletado_em": col["coletado_em"],
        "bronze_sha": col["bronze_sha"],
        "data_base": col["data_base_max"],
        "data_base_min": col["data_base_min"],
        "meses": col["meses"],
        "linhas_base": col["linhas"],
        "aviso_cobertura": AVISO_COBERTURA,
        "aviso_tipo3": AVISO_TIPO3,
        "aviso_setembro": AVISO_SETEMBRO,
        "como_ler": [
            ["Pessoa", "Quem tinha a dívida. A base do BCB NÃO conta pessoas — uma pessoa com três dívidas "
                       "renegociadas aparece como três operações."],
            ["Dívida", "O débito original, com o credor original. Não está nesta base."],
            ["Operação de crédito", "O contrato novo criado pela renegociação, informado ao SCR. É a unidade "
                                    "desta base."],
            ["Credor", "Quem tinha o direito de receber. Aqui só aparecem os que reportam ao SCR — bancos, "
                       "financeiras e cooperativas."],
            ["Valor após desconto", "Quanto ficou a dever depois do abatimento. Não é o valor original nem o "
                                    "valor efetivamente pago."],
        ],
        "totais_scr": {
            "operacoes": tot_op, "volume": round(tot_vol, 2),
            "ticket_medio": round(tot_vol / tot_op) if tot_op else None,
            "conglomerados": len(instituicoes),
            "periodo": f"{col['data_base_min']} a {col['data_base_max']}",
        },
        "pequenos_negocios": pn,
        "oficiais": OFICIAIS,
        "reconciliacao": reconciliacao,
        "linha_do_tempo": LINHA_DO_TEMPO,
        "componentes": componentes,
        "serie": serie,
        "mapa": mapa,
        "instituicoes": instituicoes,
        "concentracao": {"hhi_operacoes": hhi, "top5_operacoes": top5, "n_conglomerados": len(instituicoes)},
        "avaliacao": AVALIACAO,
        "matriz_viabilidade": _matriz(),
        "catalogo": catalogo,
        "selos": {
            "reportado": "Divulgado diretamente pela fonte oficial.",
            "calculado": "Produzido aqui a partir de variáveis observadas, com fórmula publicada.",
            "estimado": "Depende de hipóteses explicitadas; não é medição.",
            "causal": "Proveniente de avaliação com estratégia válida de identificação.",
            "associacao": "Movimento simultâneo ou correlação; não sustenta afirmação de causa.",
        },
        "series_contexto": [
            {"chave": "inad_pf", "rotulo": "Inadimplência de pessoas físicas (>90 dias)", "unidade": "%"},
            {"chave": "endividamento", "rotulo": "Endividamento das famílias com o SFN", "unidade": "% da renda"},
            {"chave": "comprometimento", "rotulo": "Comprometimento de renda com o serviço da dívida", "unidade": "%"},
            {"chave": "concessoes_pf", "rotulo": "Concessões de crédito a pessoas físicas", "unidade": "R$ milhões"},
            {"chave": "taxa_pf", "rotulo": "Taxa média de juros — pessoas físicas", "unidade": "% a.a."},
        ],
        "lacunas": [
            {"tema": "Beneficiários", "falta": "Contagem de pessoas distintas, sexo, idade, renda, CadÚnico e município",
             "precisaria": "Microdados individuais do SCR ou tabulação demográfica publicada pelo BCB"},
            {"tema": "Condições", "falta": "Valor original, desconto, entrada, parcelas, prazo e taxa",
             "precisaria": "Publicação do valor pré-desconto e das condições contratuais agregadas"},
            {"tema": "Depois da renegociação", "falta": "Coortes, sobrevivência dos acordos, reincidência e novo crédito",
             "precisaria": "Painel longitudinal das operações do programa, hoje sigiloso"},
            {"tema": "Credores não financeiros", "falta": "Varejo, serviços públicos e telecomunicações",
             "precisaria": "Base do operador da plataforma do programa, não publicada"},
            {"tema": "Fiscal", "falta": "Garantias do FGO concedidas, acionadas e recuperadas; custo por beneficiário",
             "precisaria": "Execução orçamentária e relatórios do FGO com identificação do programa"},
        ],
    }
    if geo:
        primeiro = next(iter(geo.values()))
        payload["geo"] = {"paths": {g["cod"]: g["svg_d"] for g in geo.values() if g.get("svg_d") and g.get("cod")},
                          "populacao_fonte": f"IBGE SIDRA 6579 ({primeiro.get('pop_ano')})"}
        pan = common.ler_gold_opcional("panorama.json")
        if pan and pan.get("geo"):
            payload["geo"]["viewBox"] = pan["geo"].get("viewBox")
            payload["geo"]["transform"] = pan["geo"].get("transform")
    common.write_gold("desenrola.json", payload)
    return {"ok": True, "operacoes_pf": tot_op, "volume_pf_bi": round(tot_vol / 1e9, 2),
            "conglomerados": len(instituicoes), "meses": col["meses"]}
