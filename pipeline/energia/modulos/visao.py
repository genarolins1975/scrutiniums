"""Módulo Visão geral (painéis P004 a P007, seção 9.1 da especificação).

A Visão geral não coleta fonte própria: ela lê as golds que os outros módulos acabaram de
construir (ctx["golds"], ordem 98, depois de todos) e a série de origem no silver
principal, e publica `sintese.json`, o mesmo nome que a página já lia. Por que um módulo
e não mais um builder do run.py: a síntese precisa das golds dos módulos temáticos (conta,
qualidade, perdas, inclusão, PLD detalhado, regulação, geração detalhada, dados), que só
existem depois do laço de módulos.

O que publica:

* P004, o sistema em 60 segundos: frases montadas por modelos fixos (gold/sintese.py) a
  partir de valores lidos das golds de operação, cada uma com os valores e o caminho de
  origem (a frase é refeita a partir deles), a qualidade do dado (natureza, defasagem até a
  data de processamento em Brasília, atualidade pela frequência declarada, revisões entre
  capturas na janela da frase), as versões das golds e a evidência. Fatos e hipóteses ficam
  separados: frases são fatos; hipóteses aparecem só como lista fixa por regra, rotuladas,
  com o painel onde a verificação seria feita. Destaques: no máximo três, escolhidos entre
  regras em alerta (duração mínima atingida), da mais rara para a mais frequente no
  histórico.
* P005, determinantes em pequenos múltiplos: preço, água, geração, carga e rede, com os
  mesmos números das golds de origem copiados sem recálculo, alinhados pelo calendário dos
  últimos 90 dias e com a data de referência de cada painel explícita (as séries terminam
  em dias diferentes; o eixo comum não sugere simultaneidade). A rede mostra fluxo
  verificado, sem alegação de congestionamento.
* P006, energia e sociedade: tarifa residencial de referência (conta.json), continuidade
  (qualidade.json), perdas (perdas.json) e alcance da Tarifa Social (inclusao.json), cada
  um com o período de referência próprio (vigência, ano ou mês), a defasagem e a
  cobertura, e a evidência do módulo de origem. Nada disso é apresentado como situação do
  dia.
* P007, o que observar: regras com limiar, duração mínima, regra de retorno e
  materialidade documentados, inclusive piso e teto do PLD, restrição de eólicas e
  fotovoltaicas e revisões materiais das séries de origem. Para cada regra, a frequência
  de disparo no histórico desde 2021 (episódios, duração, acionamentos curtos filtrados
  pela duração mínima e sensibilidade a outras durações) e o registro dos alertas
  efetivamente publicados (silver `sintese`, conjunto interno `_visao_alertas`, gravado a
  partir da gold aceita pela sentinela), para medir quantos deixaram de se confirmar
  quando os dados foram revisados. Alerta descreve condição medida; não implica causa.

Execução: python3 pipeline/energia/executar_modulo.py visao (não há coleta; `--sem-coleta`
dá o mesmo resultado).
"""
import csv
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base, evidencia as ev  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402
from pipeline.energia.gold import sintese as s  # noqa: E402

GOLD = "sintese.json"
FAMILIA = "sintese"
ROTA = "/setor-eletrico/visao-geral"
DS_ALERTAS = "_visao_alertas"         # registro interno dos alertas emitidos em cada processamento
INICIO_HISTORICO = "2021-01-01"       # início comum do histórico das regras (primeiro ano do PLD horário integrado)
JANELA_MULTIPLOS = 90                 # dias do recorte alinhado de P005
MAX_DESTAQUES = 3
REVISAO_REL_PCT = 1.0                 # revisão material: variação relativa mínima
# e variação absoluta mínima, pela unidade da série (a diferença de uma série em % é em p.p.)
REVISAO_PISO = {"%": 0.1, "% da MLT": 0.1, "MWmed": 10.0, "MWmês": 10.0, "R$/MWh": 0.01}

U = {
    "regras": "/energia/series/sintese_regras_diario.csv",
    "episodios": "/energia/series/sintese_episodios.csv",
    "multiplos": "/energia/series/sintese_multiplos.csv",
    "revisoes": "/energia/series/sintese_revisoes.csv",
}
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py visao --sem-coleta (lê as golds publicadas e o silver principal)"

REGISTRO = {
    "id": "visao",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 98,
    # nenhum conjunto novo: a Visão geral reutiliza as golds e os conjuntos dos módulos de
    # origem (que já os declaram); declarar de novo aqui sobrescreveria a família e o
    # dataset do silver no catálogo
    "datasets": [],
    "arquivos": {
        U["regras"]: ("data (AAAA-MM-DD, data de referência do dado avaliado); regra (id); condicao (1 = condição da regra "
                      "satisfeita no dia, 0 = não satisfeita, vazio = dia sem dado ou não avaliável); estado (A = alerta exibido, "
                      "o = condição sem a duração mínima, . = normal, - = sem dado); valor (número avaliado, na unidade da regra: "
                      "EAR do SIN em % da EAR máxima, ENA do SIN em 30 dias em % da MLT, participação térmica e taxas de restrição "
                      "em %, carga em MWmed, amplitude entre submercados em R$/MWh, maior número de horas de um submercado no piso "
                      "ou no teto horário, revisões materiais na janela de 7 dias); limiar_inferior e limiar_superior (na mesma "
                      "unidade: 5º e 95º percentis nas regras de distribuição, 95º percentil da carga, limiar do dia do "
                      "descolamento, 24 horas no piso, 0 hora no teto horário; vazio quando não se aplica; a comparação, estrita "
                      "ou não, é a da condição de cada regra em sintese.json#observar[].condicao); detalhe (texto: faixa do SIN, "
                      "horas por submercado no piso ou no teto, submercados do descolamento, revisões por captura)"),
        U["episodios"]: ("regra; inicio (primeiro dia com a condição); confirmado_em (dia em que a duração mínima foi atingida); "
                         "fim (último dia com a condição); normalizado_em (dia em que o retorno foi confirmado; vazio = em curso); "
                         "dias_condicao (dias com a condição dentro do episódio); duracao_dias (de início a fim, inclusive); "
                         "em_curso (1/0)"),
        U["multiplos"]: ("d (data); preco_SE, preco_S, preco_NE, preco_N (PLD médio diário, R$/MWh, de pld.json#diario); "
                         "agua_SIN (EAR do SIN, % da EAR máxima, de hidrologia.json#serie_ear) e agua_p10, agua_p90 (faixa da data, "
                         "de hidrologia.json#bandas_ear); geracao_termica_7d (participação térmica em 7 dias, %, de "
                         "geracao.json#serie_termica_7d); carga_SIN e carga_ano_anterior (MWmed, de carga.json#serie; ano anterior "
                         "= mesmo dia da semana 364 dias antes, só no mesmo regime); rede_N_NE, rede_N_SE, rede_NE_SE, rede_S_SE (fluxo médio "
                         "diário, MWmed, positivo da primeira para a segunda ponta, de rede.json#serie_fluxos). Vazio = sem dado "
                         "naquela data (nunca zero)."),
        U["revisoes"]: ("dataset; serie; ref; valor_anterior; valor_novo; diferenca (na unidade da série; em p.p. quando a "
                        "série é percentual); diferenca_relativa_pct; unidade (unidade da série: % ou % da MLT, MWmês para a EAR, "
                        "MWmed para ENA, carga, balanço e intercâmbio, R$/MWh para PLD e CMO); material (1 quando |diferença| ≥ 1% "
                        "do valor anterior e ≥ o piso da unidade: 0,1 p.p., 10 MWmed ou MWmês, R$ 0,01/MWh); usada_na_pagina (1 "
                        "quando a série entra em algum número da Visão geral; só essas contam na regra revisao_material e na "
                        "qualidade das frases); capturado_anterior; capturado_novo (UTC); dia_captura (Brasília)"),
    },
}

ROTAS = {"pld": "/setor-eletrico/pld", "agua": "/setor-eletrico/agua-e-clima", "geracao": "/setor-eletrico/geracao",
         "carga": "/setor-eletrico/carga", "rede": "/setor-eletrico/rede", "conta": "/setor-eletrico/conta-de-luz",
         "qualidade": "/setor-eletrico/qualidade", "perdas": "/setor-eletrico/perdas",
         "inclusao": "/setor-eletrico/inclusao-energetica", "regulacao": "/setor-eletrico/regulacao", "dados": "/setor-eletrico/dados"}

NAO_IMPLICA = ("Alerta descreve uma condição medida nos dados publicados; não implica causa, não é previsão e não "
               "recomenda decisão.")

# Regras do "o que observar". Limiar, duração mínima, retorno e materialidade são publicados
# com a frequência de disparo no histórico; a sensibilidade a outras durações também.
REGRAS = [
    {"id": "ear_faixa", "tipo": "regra", "titulo": "Armazenamento em nível extremo para a data",
     "condicao": "EAR do SIN abaixo do 5º ou acima do 95º percentil do mesmo dia do calendário nos anos completos anteriores (desde 2001).",
     "limiar": "5º e 95º percentis da data para o SIN (a faixa usual do painel Água, do 10º ao 90º, fica como contexto)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos com o SIN entre o 5º e o 95º percentil da data.",
     "materialidade": ("O 5º e o 95º percentis deixam de fora um em cada dez anos para a data: o alerta é para nível extremo, não para "
                       "nível apenas fora do usual. Com a faixa usual (10º a 90º) a regra ficaria em alerta em cerca de um quarto dos "
                       "dias desde 2021 e, somada às demais, ocuparia a caixa de destaques na maior parte do tempo (alternativas "
                       "publicadas com a frequência). A EAR muda devagar: 7 dias seguidos separam situação persistente de oscilação "
                       "perto da borda. A regra olha o SIN; o detalhe por subsistema vai no texto e no painel Água."),
     "nao_implica": "Nível extremo não quer dizer risco de suprimento nem explica o preço; a capacidade máxima de armazenamento mudou ao longo do tempo.",
     "hipoteses": [{"texto": "Afluência acima ou abaixo da média nas semanas anteriores", "onde_verificar": "/setor-eletrico/agua-e-clima/afluencia#ena"},
                   {"texto": "Mudança no uso da água para geração (despacho hidráulico)", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/agua-e-clima#padrao", "gold": "hidrologia.json", "metrica": "visao_regra_ear_faixa",
     "dataset": "ear_subsistema_di", "unidade": "% da EAR máxima"},
    {"id": "ena_faixa", "tipo": "regra", "titulo": "Afluência de 30 dias em nível extremo",
     "condicao": "ENA do SIN acumulada em 30 dias (% da MLT) abaixo do 5º ou acima do 95º percentil da mesma janela nos anos completos anteriores (desde 2001).",
     "limiar": "5º e 95º percentis da mesma janela para o SIN (a faixa usual do painel Água, do 10º ao 90º, fica como contexto)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos com o SIN entre o 5º e o 95º percentil da janela.",
     "materialidade": ("A janela de 30 dias já suaviza eventos curtos; 7 dias seguidos além do 5º ou do 95º percentil indicam um mês "
                       "extremamente úmido ou seco frente à mesma janela dos anos anteriores. Com a faixa usual a regra dispararia em "
                       "cerca de um quarto dos dias desde 2021, e com os quatro subsistemas em cerca de dois de cada três (alternativas "
                       "publicadas)."),
     "nao_implica": "Afluência extrema não diz quanto vira armazenamento nem como o preço reage.",
     "hipoteses": [{"texto": "Chuva acima ou abaixo da média nas bacias", "onde_verificar": "/setor-eletrico/agua-e-clima"}],
     "href": "/setor-eletrico/agua-e-clima/afluencia#ena", "gold": "hidrologia.json", "metrica": "visao_regra_ena_faixa",
     "dataset": "ena_subsistema_di", "unidade": "% da MLT"},
    {"id": "termica", "tipo": "regra", "titulo": "Participação térmica extrema",
     "condicao": "Participação térmica dos últimos 7 dias acima do 95º ou abaixo do 5º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes, todas no regime do balanço iniciado em 29/04/2023.",
     "limiar": "5º e 95º percentis das 365 janelas anteriores (a faixa usual de geracao.json#termica_contexto, do 10º ao 90º, fica como contexto)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos entre o 5º e o 95º percentil.",
     "materialidade": ("A janela de 7 dias tira o ciclo da semana; o 5º e o 95º percentis marcam o extremo do último ano, e 7 dias "
                       "seguidos além deles evitam que uma semana atípica isolada vire alerta."),
     "nao_implica": "Participação térmica alta ou baixa não indica, sozinha, escassez de água nem custo maior para o consumidor.",
     "hipoteses": [{"texto": "Despacho por razão elétrica, por segurança energética ou por ordem de mérito", "onde_verificar": "/setor-eletrico/geracao"},
                   {"texto": "Variação da geração hidráulica, eólica ou solar", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/geracao#termica", "gold": "geracao.json", "metrica": "visao_regra_termica",
     "dataset": "balanco_energia_subsistema_ho", "unidade": "% da geração do balanço"},
    {"id": "carga_extrema", "tipo": "regra", "titulo": "Carga diária entre as mais altas do ano",
     "condicao": "Carga do SIN no dia acima do 95º percentil dos 364 dias anteriores, todos no mesmo regime metodológico declarado pelo ONS.",
     "limiar": "95º percentil dos 364 dias anteriores",
     "duracao_minima_dias": 2, "retorno_dias": 3,
     "regra_retorno": "Volta ao normal depois de 3 dias seguidos abaixo do 95º percentil.",
     "materialidade": "O 95º percentil marca os cerca de 18 dias mais altos de um ano; exigir 2 dias seguidos tira o pico isolado de um único dia útil.",
     "nao_implica": "Carga alta não mede atividade econômica nem indica, por si, falta de capacidade.",
     "hipoteses": [{"texto": "Temperatura acima da média", "onde_verificar": "/setor-eletrico/carga"},
                   {"texto": "Calendário (dias úteis seguidos, ausência de feriados)", "onde_verificar": "/setor-eletrico/carga"}],
     "href": "/setor-eletrico/carga", "gold": "carga.json", "metrica": "visao_regra_carga_extrema",
     "dataset": "carga_energia_di", "unidade": "MWmed"},
    {"id": "descolamento", "tipo": "regra", "titulo": "Preços separados entre submercados",
     "condicao": "Diferença entre o maior e o menor PLD médio diário dos quatro submercados de pelo menos 10% da média dos quatro e de pelo menos R$ 5,00/MWh.",
     "limiar": "max(R$ 5,00/MWh; 10% da média dos quatro PLD médios do dia)",
     "duracao_minima_dias": 3, "retorno_dias": 3,
     "regra_retorno": "Volta ao normal depois de 3 dias seguidos com a diferença abaixo do limiar.",
     "materialidade": "O limiar relativo acompanha o nível de preço (R$ 5 é muito perto do piso e pouco num preço alto); 3 dias seguidos separam separação persistente de horas isoladas.",
     "nao_implica": "Preços diferentes entre submercados não identificam qual restrição de transmissão atuou; os limites de intercâmbio não fazem parte desta regra.",
     "hipoteses": [{"texto": "Fluxo entre subsistemas perto de algum limite operativo", "onde_verificar": "/setor-eletrico/rede"}],
     "href": "/setor-eletrico/pld/diferencas-regionais#diferencas-regionais", "gold": "pld.json", "metrica": "visao_regra_descolamento",
     "dataset": "ccee_pld_horario", "unidade": "R$/MWh"},
    {"id": "pld_piso", "tipo": "regra", "titulo": "PLD no piso o dia inteiro",
     "condicao": "Algum submercado com as 24 horas do dia no PLD mínimo vigente (igual ao centavo).",
     "limiar": "PLD mínimo do ano (ato da ANEEL), conferido hora a hora no módulo PLD",
     "duracao_minima_dias": 3, "retorno_dias": 3,
     "regra_retorno": "Volta ao normal depois de 3 dias seguidos em que nenhum submercado passa o dia inteiro no piso.",
     "materialidade": "O piso é limite regulatório: um dia inteiro nele indica que o limite, e não o custo marginal, determinou o preço em todas as horas; 3 dias seguidos tiram dias isolados de carga baixa.",
     "nao_implica": "Preço no piso não quer dizer energia sem custo nem sobra garantida de água.",
     "hipoteses": [{"texto": "Custo marginal de operação abaixo do piso (CMO do DESSEM)", "onde_verificar": "/setor-eletrico/pld/cmo-e-formacao#cmo-e-formacao"}],
     "href": "/setor-eletrico/pld/limites#limites", "gold": "pld_detalhe.json", "metrica": "visao_regra_pld_piso",
     "dataset": "ccee_pld_horario", "unidade": "horas"},
    {"id": "pld_teto", "tipo": "regra", "titulo": "PLD no teto horário ou estrutural",
     "condicao": "Alguma hora no PLD máximo horário ou média diária no PLD máximo estrutural, em algum submercado.",
     "limiar": "PLD máximo horário e estrutural do ano (ato da ANEEL)",
     "duracao_minima_dias": 1, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos sem hora no teto horário e sem média no teto estrutural.",
     "materialidade": "Atingir o teto é material por definição (o limite regulatório determinou o preço); por isso basta um dia, e o retorno exige uma semana para não alternar o alerta.",
     "nao_implica": "Preço no teto não identifica a causa nem indica, sozinho, risco de suprimento.",
     "hipoteses": [{"texto": "Custo marginal acima do teto em horas de carga alta", "onde_verificar": "/setor-eletrico/pld/cmo-e-formacao#cmo-e-formacao"}],
     "href": "/setor-eletrico/pld/limites#limites", "gold": "pld_detalhe.json", "metrica": "visao_regra_pld_teto",
     "dataset": "ccee_pld_horario", "unidade": "horas"},
    {"id": "restricao_eolica", "tipo": "regra", "titulo": "Restrição de geração eólica entre as maiores do último ano",
     "condicao": "Taxa de restrição eólica do SIN em 7 dias (energia não gerada ÷ geração verificada mais não gerada) acima do 95º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.",
     "limiar": "95º percentil das 365 janelas anteriores",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos abaixo do 95º percentil.",
     "materialidade": ("Comparação com o próprio último ano, porque a taxa cresceu muito desde 2021; só o lado de cima importa (restrição "
                       "baixa não é alerta); o 95º percentil e 7 dias seguidos separam mudança persistente de dias de vento atípico. "
                       "Com o 90º percentil a regra ficaria em alerta em cerca de um quarto dos dias (alternativa publicada)."),
     "nao_implica": "A taxa vem de estimativa do ONS da geração possível; restrição alta não identifica sozinha a razão (elétrica, energética ou de confiabilidade).",
     "hipoteses": [{"texto": "Limitação de transmissão no Nordeste (razão elétrica)", "onde_verificar": "/setor-eletrico/geracao"},
                   {"texto": "Sobra de energia frente à carga (razão energética)", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/geracao", "gold": "geracao_detalhe.json", "metrica": "visao_regra_restricao",
     "dataset": "ons_coff_eolica", "unidade": "% da geração possível"},
    {"id": "restricao_solar", "tipo": "regra", "titulo": "Restrição de geração solar centralizada entre as maiores do último ano",
     "condicao": "Taxa de restrição fotovoltaica do SIN em 7 dias acima do 95º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.",
     "limiar": "95º percentil das 365 janelas anteriores",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos abaixo do 95º percentil.",
     "materialidade": "Mesma regra da eólica; o registro de restrições fotovoltaicas começa em abril de 2024, então o histórico avaliável é mais curto.",
     "nao_implica": "Não inclui micro e minigeração distribuída, que não é restringida pelo ONS; restrição alta não identifica a razão.",
     "hipoteses": [{"texto": "Sobra de energia nas horas de sol (razão energética)", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/geracao", "gold": "geracao_detalhe.json", "metrica": "visao_regra_restricao",
     "dataset": "ons_coff_fotovoltaica", "unidade": "% da geração possível"},
    {"id": "revisao_material", "tipo": "regra", "assunto": "dados", "titulo": "Revisão material de dado já publicado",
     "condicao": "Alguma captura dos últimos 7 dias trouxe revisão material de série usada nesta página (EAR, ENA, carga, balanço, intercâmbio, PLD, CMO): variação de pelo menos 1% do valor anterior e acima do piso da unidade (0,1 p.p., 10 MWmed ou MWmês, R$ 0,01/MWh).",
     "limiar": "1% do valor anterior e piso por unidade",
     "duracao_minima_dias": 1, "retorno_dias": 1,
     "regra_retorno": "Volta ao normal quando passam 7 dias sem captura com revisão material (a janela de 7 dias está na própria condição).",
     "materialidade": "Revisão abaixo de 1% raramente muda o número exibido com uma casa; o piso por unidade ignora variações de centésimos em valores perto de zero.",
     "nao_implica": "Revisão é prática normal da fonte (dados verificados substituem dados preliminares) e não indica erro.",
     "hipoteses": [{"texto": "Consolidação de medição pela fonte nos dias mais recentes", "onde_verificar": "/setor-eletrico/dados"}],
     "href": "/setor-eletrico/dados", "gold": "publicacao.json", "metrica": "visao_regra_revisao_material",
     "dataset": None, "unidade": "revisões"},
    {"id": "pld_defasagem", "tipo": "dados", "titulo": "Série de PLD sem atualização recente",
     "condicao": "Último dia de PLD integrado mais de 2 dias antes da data de processamento, contada no horário de Brasília.",
     "limiar": "2 dias", "duracao_minima_dias": None, "retorno_dias": None,
     "regra_retorno": "Volta ao normal na primeira publicação com o PLD de até 2 dias antes do processamento.",
     "materialidade": "A CCEE publica o PLD do dia seguinte na véspera; mais de 2 dias de distância indica coleta parada, não oscilação.",
     "nao_implica": "Atraso de integração não diz nada sobre o preço.",
     "hipoteses": [], "href": "/setor-eletrico/dados/ccee-pld-horario", "gold": "pld.json", "metrica": "visao_regra_pld_defasagem",
     "dataset": "ccee_pld_horario", "unidade": "dias"},
    {"id": "atualidade_fontes", "tipo": "dados", "titulo": "Fonte desta página com atualização atrasada",
     "condicao": "Algum conjunto usado nesta página com situação ATRASADO no painel de saúde dos dados (prazo derivado da frequência declarada pela fonte).",
     "limiar": "tolerância por cadência do módulo Dados (diária 2 dias, semanal 7, mensal 60, anual 365)",
     "duracao_minima_dias": None, "retorno_dias": None,
     "regra_retorno": "Volta ao normal quando todos os conjuntos usados estão em dia ou sem prazo declarado.",
     "materialidade": "Um número de fonte atrasada continua válido para o seu período, mas não descreve o presente.",
     "nao_implica": "Atraso pode ser da fonte (não publicou) ou da integração; o painel Dados separa os dois casos.",
     "hipoteses": [], "href": "/setor-eletrico/dados", "gold": "publicacao.json", "metrica": "visao_regra_atualidade_fontes",
     "dataset": None, "unidade": "conjuntos"},
    {"id": "cmo_semana", "tipo": "evento", "titulo": "CMO publicado pelo ONS para a semana operativa mais recente",
     "condicao": "Evento conhecido: publicação semanal do CMO (modelo DECOMP). Não é previsão da Scrutiniums.",
     "limiar": None, "duracao_minima_dias": None, "retorno_dias": None,
     "regra_retorno": "Substituído pela publicação da semana seguinte.",
     "materialidade": "Evento de calendário; sempre listado.",
     "nao_implica": "CMO é resultado de modelo do ONS; não é o PLD nem previsão de preço.",
     "hipoteses": [], "href": "/setor-eletrico/pld/cmo-e-formacao#cmo-e-formacao", "gold": "cmo.json", "metrica": None,
     "dataset": "cmo_se", "unidade": "R$/MWh"},
]

# conjuntos da Visão geral no silver principal (qualidade das frases e revisões)
DATASETS_OPERACAO = ("ear_subsistema_di", "ena_subsistema_di", "carga_energia_di", "balanco_energia_subsistema_ho",
                     "intercambio_nacional_ho", "ccee_pld_horario", "cmo_se")
# séries que entram em algum número da página: as das frases, mais a EAR de cada subsistema
# (texto da regra de armazenamento) e o CMO semanal (evento). Revisão de série fora daqui
# (ENA armazenável, carga e subsistemas do balanço, CMO por patamar) não muda número exibido.
SERIES_PAGINA = frozenset(x for xs in s.SERIES_FRASE.values() for x in xs) | {f"ear_pct.{sm}" for sm in s.SMS} | \
    {f"cmo_semanal.{sm}" for sm in s.SMS}
# conjuntos de cada regra e frase, para a regra de atualidade (o que a página publica de fato)
CONJUNTOS_PAINEL = {"preco": "ccee_pld_horario", "agua": "ear_subsistema_di", "geracao": "balanco_energia_subsistema_ho",
                    "carga": "carga_energia_di", "rede": "intercambio_nacional_ho"}


# ---------------------------------------------------------------- utilidades

def versao_regra(meta):
    """Identificador da definição da regra (condição, limiar, durações): a conferência das
    emissões passadas só compara alertas emitidos pela mesma definição."""
    corpo = json.dumps({k: meta.get(k) for k in ("condicao", "limiar", "duracao_minima_dias", "retorno_dias")},
                       sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(corpo.encode()).hexdigest()[:12]


def _ok(g):
    return isinstance(g, dict) and g.get("disponivel") is True


def _dia_brasilia(instante_utc):
    """Dia civil em Brasília (UTC−3 fixo desde 2019) de um carimbo UTC das vintages."""
    utc = datetime.fromisoformat(base.instante_utc(instante_utc).replace("Z", "+00:00"))
    return (utc - timedelta(hours=3)).date().isoformat()


def _num(x):
    if x is None or x == "":
        return None
    try:
        return float(x)
    except ValueError:
        return None


def _le_csv(nome):
    caminho = os.path.join(base.SERIES, os.path.basename(nome))
    if not os.path.exists(caminho):
        return None, None
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    with open(caminho, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";")), h.hexdigest()


def _abre_ro(familia):
    """Silver de outra família só para leitura (sem criar tabela nem trocar o modo do diário)."""
    caminho = os.path.join(base.SILVER, f"{familia}.db")
    if not os.path.exists(caminho):
        return None
    return sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=60)


def _vintages(con, dataset, anos=None):
    """Vintage vigente de cada recurso do dataset (opcionalmente só recursos com um dos anos no nome)."""
    if con is None:
        return []
    rows = con.execute(
        """SELECT recurso, url, capturado_em, publicado_em, sha256, arquivo FROM vintages WHERE dataset=?
           ORDER BY capturado_em""", (dataset,)).fetchall()
    ult = {}
    for rec, url, cap, pub, sha, arq in rows:
        ult[rec] = {"recurso": rec, "url": url, "capturado_em": cap, "publicado_em": pub, "sha256": sha, "arquivo": arq}
    out = [v for k, v in sorted(ult.items()) if not anos or any(str(a) in k for a in anos)]
    return out


def _fonte_evidencia(orgao, conjunto, url, vs):
    """Bloco fonte da evidência a partir das vintages vigentes (uma ou várias)."""
    if not vs:
        return {"orgao": orgao, "conjunto": conjunto, "recurso": None, "url": url, "arquivo": None, "sha256": None,
                "capturado_em": None, "publicado_em": None}
    if len(vs) == 1:
        return ev.fonte_de_vintage(orgao, conjunto, url, vs[0])
    f = ev.fonte_de_vintage(orgao, conjunto, url, vs[-1])
    f.update({"arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None, "recurso": "; ".join(v["recurso"] for v in vs),
              "arquivos": [ev.arquivo_de_vintage(v) for v in vs]})
    return f


# ---------------------------------------------------------------- silver principal

def _serie(con, ds, serie):
    return dict(base.serie_vigente(con, ds, serie))


def _serie_janela(con, ds, serie, ini, fim):
    """{ref: valor} vigente de uma série só entre `ini` e `fim` (refs ISO, inclusive; refs
    horárias "AAAA-MM-DDTHH:MM" entram pelo prefixo do dia). Leitura direta do silver
    principal, sem passar pela gold de origem: é o caminho independente das reconciliações."""
    rows = con.execute(
        """SELECT o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id = o.vintage_id
           WHERE o.dataset=? AND o.serie=? AND o.ref >= ? AND o.ref <= ? ORDER BY v.capturado_em, o.rowid""",
        (ds, serie, ini, fim + "T99")).fetchall()
    out = {}
    for ref, valor in rows:
        out[ref] = valor
    return out


def _unidade_serie(serie):
    """(unidade da série, piso da revisão material). A diferença de uma série em % é em p.p."""
    p = serie.split(".")[0]
    if p.endswith("pct_mlt"):
        un = "% da MLT"
    elif "pct" in p:
        un = "%"
    elif p.startswith("ear_"):
        un = "MWmês"
    elif p.startswith(("pld", "cmo")):
        un = "R$/MWh"
    else:
        un = "MWmed"  # ENA em MWmed, carga, balanço e intercâmbio (médias por intervalo)
    return un, REVISAO_PISO[un]


def material(serie, de, para):
    """Revisão material: |Δ| ≥ 1% do valor anterior e ≥ piso da unidade (valor anterior zero:
    só o piso)."""
    un, piso = _unidade_serie(serie)
    dif = abs(para - de)
    if dif < piso:
        return False
    return de == 0 or 100.0 * dif / abs(de) >= REVISAO_REL_PCT


def revisoes_silver(con, datasets=DATASETS_OPERACAO):
    """Revisões entre capturas consecutivas de cada (série, referência), lidas do silver
    principal (só leitura). Devolve (lista de revisões, {dataset: dias de captura
    comparáveis em Brasília})."""
    revs, dias_comp = [], {}
    for ds in datasets:
        rows = con.execute(
            """SELECT o.serie, o.ref, o.valor, v.capturado_em FROM observacoes o
               JOIN vintages v ON v.vintage_id = o.vintage_id
               JOIN (SELECT serie, ref FROM observacoes WHERE dataset=? GROUP BY serie, ref HAVING COUNT(*) > 1) r
                 ON r.serie = o.serie AND r.ref = o.ref
               WHERE o.dataset=? ORDER BY o.serie, o.ref, v.capturado_em, o.rowid""", (ds, ds)).fetchall()
        ant = None
        for serie, ref, valor, cap in rows:
            if ant and ant[0] == serie and ant[1] == ref and abs(ant[2] - valor) > 1e-9:
                un, _ = _unidade_serie(serie)
                dif = valor - ant[2]
                revs.append({"dataset": ds, "serie": serie, "ref": ref, "de": ant[2], "para": valor, "diferenca": dif,
                             "relativa_pct": (100.0 * abs(dif) / abs(ant[2])) if ant[2] else None, "unidade": un,
                             "material": material(serie, ant[2], valor), "usada_na_pagina": serie in SERIES_PAGINA,
                             "capturado_de": ant[3], "capturado_para": cap, "dia_captura": _dia_brasilia(cap)})
            ant = (serie, ref, valor, cap)
        # dias de captura em que havia captura anterior do mesmo recurso (comparação possível)
        vs = con.execute("SELECT recurso, capturado_em FROM vintages WHERE dataset=? ORDER BY recurso, capturado_em", (ds,)).fetchall()
        vistos, dias = set(), set()
        for rec, cap in vs:
            if rec in vistos:
                dias.add(_dia_brasilia(cap))
            vistos.add(rec)
        dias_comp[ds] = sorted(dias)
    return revs, dias_comp


# ---------------------------------------------------------------- P005: pequenos múltiplos

def _por_dia(xs, chave="d"):
    return {x[chave]: x for x in xs or []}


def multiplos(golds, hoje):
    """Determinantes alinhados pelo calendário dos últimos 90 dias, com os valores
    copiados das golds de origem (sem recálculo) e a data de referência de cada painel."""
    pld, hid, ger, carga, rede = (golds.get(k) for k in ("pld.json", "hidrologia.json", "geracao.json", "carga.json", "rede.json"))
    paineis, refs = [], {}
    if _ok(pld):
        refs["preco"] = pld["dia_referencia"]
    if _ok(hid):
        refs["agua"] = hid["dia_referencia_ear"]
    if _ok(ger):
        refs["geracao"] = ger["dia_referencia"]
    if _ok(carga):
        refs["carga"] = carga["dia_referencia"]
    if _ok(rede):
        refs["rede"] = rede["dia_referencia"]
    if not refs:
        return None
    fim = max(refs.values())
    inicio = (s.d(fim) - timedelta(days=JANELA_MULTIPLOS - 1)).isoformat()
    dias = s.calendario(inicio, fim)
    linhas = {k: {"d": k} for k in dias}

    def put(col, fonte, chave):
        for k in dias:
            v = (fonte.get(k) or {}).get(chave)
            linhas[k][col] = v

    if _ok(pld):
        di = _por_dia(pld["diario"])
        for sm in s.SMS:
            put(f"preco_{sm}", di, sm)
        se = next(x for x in pld["cartoes"] if x["sm"] == "SE")
        q = se["posicao"]["quartis"]
        paineis.append({
            "id": "preco", "titulo": "Preço", "pergunta": "Em que nível está o PLD médio diário?",
            "metrica": "visao_pld_media_diaria", "unidade": "R$/MWh", "casas": 2,
            "colunas": [{"id": f"preco_{sm}", "rotulo": c.NOME_SUBMERCADO[sm]} for sm in s.SMS],
            "referencia": {"tipo": "faixa_constante", "rotulo": "25º a 75º percentil das médias diárias do Sudeste/Centro-Oeste desde 2021",
                           "inferior": q["p25"], "superior": q["p75"], "caminho": "pld.json#cartoes[SE].posicao.quartis"},
            "data_referencia": pld["dia_referencia"], "gold": "pld.json", "caminho": "pld.json#diario",
            "proveniencia": "pld.json#proveniencia.diario", "natureza": pld["proveniencia"]["diario"]["natureza"],
            "frequencia": "diária (publicada pela CCEE na véspera do dia de referência)", "href": ROTAS["pld"],
            "valor_atual": {"rotulo": "Sudeste/Centro-Oeste", "valor": se["media_dia"], "caminho": "pld.json#cartoes[SE].media_dia"},
            "nota": "Média simples das 24 horas de cada dia, em valores nominais; não é a tarifa do consumidor.",
            "download": pld.get("downloads") or []})
    if _ok(hid):
        se = _por_dia(hid["serie_ear"])
        bandas = {b["md"]: b for b in hid["bandas_ear"]}
        put("agua_SIN", se, "SIN")
        for k in dias:
            b = bandas.get(s._md(k)) or {}
            linhas[k]["agua_p10"], linhas[k]["agua_p90"] = b.get("SIN_p10"), b.get("SIN_p90")
        sin = next(x for x in hid["subsistemas"] if x["sm"] == "SIN")
        paineis.append({
            "id": "agua", "titulo": "Água", "pergunta": "Quanto da capacidade de armazenamento está ocupado?",
            "metrica": "agua_ear_sin_pct", "unidade": "% da EAR máxima", "casas": 1,
            "colunas": [{"id": "agua_SIN", "rotulo": "EAR do SIN"}],
            "referencia": {"tipo": "faixa_por_data", "rotulo": "10º a 90º percentil da data (2001 ao ano anterior)",
                           "inferior": "agua_p10", "superior": "agua_p90", "caminho": "hidrologia.json#bandas_ear (SIN_p10, SIN_p90)"},
            "data_referencia": hid["dia_referencia_ear"], "gold": "hidrologia.json", "caminho": "hidrologia.json#serie_ear",
            "proveniencia": "hidrologia.json#proveniencia.ear_sin", "natureza": hid["proveniencia"]["ear_sin"]["natureza"],
            "frequencia": "diária", "href": ROTAS["agua"],
            "valor_atual": {"rotulo": "SIN", "valor": sin["ear"]["valor"], "caminho": "hidrologia.json#subsistemas[SIN].ear.valor"},
            "nota": "Razão das somas da energia armazenada e da capacidade dos quatro subsistemas.",
            "download": hid.get("downloads") or []})
    if _ok(ger):
        st = _por_dia(ger["serie_termica_7d"])
        put("geracao_termica_7d", st, "termica_7d")
        t = ger["termica_contexto"]
        paineis.append({
            "id": "geracao", "titulo": "Geração", "pergunta": "Quanto da geração veio de térmicas?",
            "metrica": "visao_participacao_termica_7d", "unidade": "% da geração verificada", "casas": 1,
            "colunas": [{"id": "geracao_termica_7d", "rotulo": "Térmica, janela de 7 dias"}],
            "referencia": {"tipo": "faixa_constante", "rotulo": "10º a 90º percentil das janelas de 7 dias dos 365 dias anteriores",
                           "inferior": t["p10_365d"], "superior": t["p90_365d"], "caminho": "geracao.json#termica_contexto"},
            "data_referencia": ger["dia_referencia"], "gold": "geracao.json", "caminho": "geracao.json#serie_termica_7d",
            "proveniencia": "geracao.json#proveniencia.termica_7d", "natureza": ger["proveniencia"]["termica_7d"]["natureza"],
            "frequencia": "diária (janela móvel de 7 dias)", "href": ROTAS["geracao"],
            "valor_atual": {"rotulo": "SIN, 7 dias", "valor": t["participacao_7d"], "caminho": "geracao.json#termica_contexto.participacao_7d"},
            "nota": "Participação na soma da geração verificada hidráulica, térmica, eólica e solar do balanço do ONS (a solar inclui a MMGD estimada desde 29/04/2023).",
            "download": ger.get("downloads") or []})
    if _ok(carga):
        sc = _por_dia(carga["serie"])
        regimes = carga.get("regimes") or []
        put("carga_SIN", sc, "SIN")
        for k in dias:
            # mesmo dia da semana do ano anterior (364 dias antes): a mesma data do calendário
            # cai em outro dia da semana, e a diferença entre segunda e domingo é de calendário,
            # não de carga
            ka = (s.d(k) - timedelta(days=364)).isoformat()
            mesmo = s.regime_de(ka, regimes) == s.regime_de(k, regimes)
            linhas[k]["carga_ano_anterior"] = (sc.get(ka) or {}).get("SIN") if mesmo else None
        sin = next(x for x in carga["subsistemas"] if x["sm"] == "SIN")
        paineis.append({
            "id": "carga", "titulo": "Carga", "pergunta": "Quanto o sistema está consumindo?",
            "metrica": "visao_carga_diaria_sin", "unidade": "MWmed", "casas": 0,
            "colunas": [{"id": "carga_SIN", "rotulo": "Carga do SIN"}],
            "referencia": {"tipo": "serie", "rotulo": "Mesmo dia da semana do ano anterior, 364 dias antes (só no mesmo regime metodológico)",
                           "coluna": "carga_ano_anterior", "caminho": "carga.json#serie (data − 364 dias)"},
            "data_referencia": carga["dia_referencia"], "gold": "carga.json", "caminho": "carga.json#serie",
            "proveniencia": "carga.json#proveniencia.sin", "natureza": carga["proveniencia"]["sin"]["natureza"],
            "frequencia": "diária", "href": ROTAS["carga"],
            "valor_atual": {"rotulo": "SIN", "valor": sin["dia"], "caminho": "carga.json#subsistemas[SIN].dia"},
            "nota": "Inclui a estimativa de micro e minigeração distribuída do ONS desde 29/04/2023; temperatura e calendário não são ajustados.",
            "download": carga.get("downloads") or []})
    if _ok(rede):
        sf = _por_dia(rede["serie_fluxos"])
        cols = []
        for f in rede["fronteiras"]:
            put(f"rede_{f['par']}", sf, f["par"])
            cols.append({"id": f"rede_{f['par']}", "rotulo": f["nome"]})
        maior = max((f for f in rede["fronteiras"] if f.get("fluxo_media_30d") is not None), key=lambda f: abs(f["fluxo_media_30d"]), default=None)
        paineis.append({
            "id": "rede", "titulo": "Rede", "pergunta": "Para onde a energia está fluindo entre as regiões?",
            "metrica": "visao_fluxo_diario_fronteira", "unidade": "MWmed", "casas": 0,
            "colunas": cols,
            "referencia": {"tipo": "zero", "rotulo": "Zero separa os dois sentidos de cada fronteira", "valor": 0},
            "data_referencia": rede["dia_referencia"], "gold": "rede.json", "caminho": "rede.json#serie_fluxos",
            "proveniencia": "rede.json#proveniencia.fluxo", "natureza": rede["proveniencia"]["fluxo"]["natureza"],
            "frequencia": "horária, agregada por dia", "href": ROTAS["rede"],
            "valor_atual": {"rotulo": maior["nome"] if maior else None, "valor": maior["fluxo_dia"] if maior else None,
                            "caminho": f"rede.json#fronteiras[{maior['par']}].fluxo_dia" if maior else None},
            "nota": ("Fluxo médio verificado, positivo da primeira para a segunda ponta de cada fronteira. Este painel não compara "
                     "o fluxo com limites de intercâmbio: fluxo alto não indica congestionamento."),
            "download": rede.get("downloads") or []})
    for p in paineis:
        p["defasagem_dias"] = s.defasagem_dias(p["data_referencia"], hoje)
        p["texto_defasagem"] = s.texto_defasagem(p["data_referencia"], hoje)
        cols = [x["id"] for x in p["colunas"]]
        com_dado = [k for k in dias if any(linhas[k].get(cl) is not None for cl in cols)]
        p["ultimo_dia_com_dado"] = max(com_dado) if com_dado else None
        p["dias_com_dado"] = len(com_dado)
    datas = {}
    for p in paineis:
        datas.setdefault(p["data_referencia"], []).append(p["titulo"].lower())
    partes = [f"{', '.join(v)} até {c.data_br(k)}" for k, v in sorted(datas.items(), reverse=True)]
    aviso = ("Os painéis estão alinhados pelo calendário e terminam em datas diferentes: " + "; ".join(partes) + ". "
             "O trecho sem dado fica em branco. Valores da mesma data não vêm da mesma publicação e não indicam que uma "
             "série explica a outra.") if len(datas) > 1 else (
             f"Os painéis estão alinhados pelo calendário e terminam todos em {c.data_br(next(iter(datas)))}.")
    return {"janela": {"inicio": inicio, "fim": fim, "dias": JANELA_MULTIPLOS}, "chave_x": "d",
            "datas_referencia": {p["id"]: p["data_referencia"] for p in paineis}, "aviso_datas": aviso,
            "paineis": paineis, "dados": [linhas[k] for k in dias],
            "regra": ("Valores copiados das golds de origem, sem recálculo nem preenchimento: dia sem valor na origem fica sem "
                      "valor aqui. Escala vertical própria de cada painel (unidades diferentes)."),
            "download": [{"rotulo": "Determinantes alinhados, últimos 90 dias (CSV)", "url": U["multiplos"]}]}


def confere_multiplos(m, golds):
    """Cada célula de P005 igual à célula da gold de origem (P005: mesmos números)."""
    origem = {
        "preco_": ("pld.json", "diario"), "agua_SIN": ("hidrologia.json", "serie_ear"),
        "geracao_termica_7d": ("geracao.json", "serie_termica_7d"), "carga_SIN": ("carga.json", "serie"),
        "rede_": ("rede.json", "serie_fluxos")}
    erros, conferidas = [], 0
    for linha in m["dados"]:
        for col, v in linha.items():
            if col == "d" or col in ("agua_p10", "agua_p90", "carga_ano_anterior"):
                continue
            chave = next((k for k in origem if col == k or (k.endswith("_") and col.startswith(k))), None)
            if not chave:
                continue
            gname, arr = origem[chave]
            campo = {"agua_SIN": "SIN", "geracao_termica_7d": "termica_7d", "carga_SIN": "SIN"}.get(col, col.split("_", 1)[1])
            o = next((x for x in golds[gname][arr] if x["d"] == linha["d"]), None)
            esperado = (o or {}).get(campo)
            conferidas += 1
            if esperado != v:
                erros.append(f"{col} {linha['d']}: {v} ≠ {esperado} ({gname})")
    return conferidas, erros


# ---------------------------------------------------------------- P006: energia e sociedade

def _meses_entre(fim_periodo, hoje):
    """Meses completos entre o fim do período de referência (AAAA, AAAA-MM ou AAAA-MM-DD) e
    a data de processamento."""
    if len(fim_periodo) == 4:
        a, m = int(fim_periodo), 12
    else:
        a, m = int(fim_periodo[:4]), int(fim_periodo[5:7])
    return (hoje.year - a) * 12 + (hoje.month - m)


def _horas_minutos(h):
    if h is None:
        return None
    total = round(h * 60)
    return f"{total // 60} h {total % 60:02d} min"


def sociedade(golds, conjuntos, hoje):
    """Indicadores de como custo e qualidade chegam ao consumidor, cada um com o período de
    referência próprio. Valores e evidências são os dos módulos de origem."""
    itens, ausentes = [], []
    conta, qual, perd, incl = (golds.get(k) for k in ("conta.json", "qualidade.json", "perdas.json", "inclusao.json"))

    def atual(ds):
        a = ((conjuntos or {}).get(ds) or {}).get("atualidade") or {}
        return {"conjunto": ds, "situacao": a.get("situacao"), "cadencia": a.get("cadencia"), "dias_atraso": a.get("dias_atraso"),
                "ultimo_periodo": a.get("ultimo_periodo")} if a else None

    if _ok(conta) and (conta.get("tarifas") or {}).get("resumo", {}).get("mediana") is not None:
        t = conta["tarifas"]
        rs = t["resumo"]
        e = t["evidencia_mediana"]
        ref = conta["data_referencia"]
        itens.append({
            "id": "tarifa", "titulo": "Tarifa residencial de referência",
            "pergunta": "Quanto custa a energia para uma residência, antes de tributos?",
            "valor": rs["mediana"], "unidade": "R$/MWh", "valor_exibido": e["valor_exibido"],
            "complementos": [
                {"rotulo": "25º a 75º percentil entre distribuidoras", "valor": [rs["p25"], rs["p75"]], "unidade": "R$/MWh"},
                {"rotulo": "Custo mensal de 200 kWh na tarifa mediana", "valor": rs["perfis_mediana"].get("200"), "unidade": "R$/mês"}],
            "periodo": {"tipo": "vigencia", "inicio": ref, "fim": ref,
                        "rotulo": f"Tarifas homologadas vigentes em {c.data_br(ref)}; cada distribuidora tem reajuste anual em data própria"},
            "defasagem": {"dias": s.defasagem_dias(ref, hoje), "texto": s.texto_defasagem(ref, hoje)},
            "cobertura": f"{e['universo']}. {e['cobertura']}. Ponderação: {rs['ponderacao']}.",
            "natureza": t["proveniencia"]["natureza"], "frequencia": t["proveniencia"]["frequencia"],
            "nao_e_situacao_do_dia": True,
            "aviso": "Sem tributos, sem bandeira e sem iluminação pública; não é a conta de luz nem o preço da energia no dia.",
            "metrica": "conta_tarifa_b1_aplicacao", "gold": "conta.json", "caminho": "conta.json#tarifas.resumo.mediana",
            "evidencia_caminho": "conta.json#tarifas.evidencia_mediana", "evidencia": e,
            "atualidade": atual((t["proveniencia"].get("snapshot") or {}).get("id", "").split("@")[0]),
            "href": ROTAS["conta"]})
    else:
        ausentes.append({"id": "tarifa", "motivo": "conta.json indisponível ou sem mediana da tarifa B1"})

    if _ok(qual):
        anual = [a for a in qual["brasil"]["anual"] if a.get("completo") and a.get("dec") is not None]
        if anual:
            a = anual[-1]
            e_dec, e_fec = qual["evidencias"]["dec_brasil"], qual["evidencias"]["fec_brasil"]
            pa = qual.get("parcial") or {}
            itens.append({
                "id": "continuidade", "titulo": "Continuidade do fornecimento",
                "pergunta": "Quanto tempo e quantas vezes, em média, cada consumidor ficou sem energia no ano?",
                "valor": a["dec"], "unidade": "horas por unidade consumidora (DEC)", "valor_exibido": e_dec["valor_exibido"],
                "equivalente": _horas_minutos(e_dec["valor_calculo"]),
                "complementos": [
                    {"rotulo": "FEC (interrupções por unidade consumidora)", "valor": a["fec"], "unidade": "interrupções",
                     "valor_exibido": e_fec["valor_exibido"]},
                    {"rotulo": "Limite regulatório agregado do DEC", "valor": a.get("dec_limite"), "unidade": "horas"},
                    {"rotulo": f"DEC parcial de {pa.get('ano')} ({len(pa.get('meses_incluidos') or [])} meses) e mesmos meses do ano anterior",
                     "valor": [pa.get("dec"), pa.get("dec_mesmos_meses_ano_anterior")], "unidade": "horas",
                     "aviso": pa.get("aviso")}],
                "periodo": {"tipo": "anual", "inicio": f"{a['ano']}-01", "fim": f"{a['ano']}-12",
                            "rotulo": f"Ano de {a['ano']} completo"},
                "defasagem": {"meses": _meses_entre(f"{a['ano']}-12", hoje),
                              "texto": f"Ano encerrado em 12/{a['ano']}; o último mês completo publicado é {c.mes_br(qual['ultimo_mes_completo'])}."},
                "cobertura": f"{e_dec['universo']}. {e_dec['cobertura']}.",
                "natureza": qual["proveniencia"]["distribuidoras"]["natureza"], "frequencia": qual["proveniencia"]["distribuidoras"]["frequencia"],
                "nao_e_situacao_do_dia": True,
                "aviso": "Média anual ponderada pelas unidades consumidoras de cada conjunto; centésimos de hora não são minutos.",
                "metrica": "qualidade_dec_distribuidora", "gold": "qualidade.json", "caminho": f"qualidade.json#brasil.anual[{a['ano']}].dec",
                "evidencia_caminho": "qualidade.json#evidencias.dec_brasil", "evidencia": e_dec,
                "evidencias_complementares": [{"caminho": "qualidade.json#evidencias.fec_brasil", "evidencia": e_fec}],
                "atualidade": atual("aneel_continuidade"), "href": ROTAS["qualidade"]})
        else:
            ausentes.append({"id": "continuidade", "motivo": "qualidade.json sem ano completo com DEC"})
    else:
        ausentes.append({"id": "continuidade", "motivo": "qualidade.json indisponível"})

    if _ok(perd):
        ref = perd["referencia"]
        nac = [x for x in perd["nacional"] if x.get("universo") == "concessionarias" and not x.get("parcial") and x.get("taxa_total_pct") is not None]
        if nac:
            a = nac[-1]
            e = perd["evidencias"]["taxa_nacional"]
            acc = next((x for x in (perd.get("acumulado") or {}).get("agregados", []) if x.get("universo") == "concessionarias"), None)
            comp = []
            if acc:
                comp.append({"rotulo": f"Acumulado de jan a {c.MESES[perd['acumulado']['mes_fim'] - 1]} de {perd['acumulado']['ano']} e mesmo período do ano anterior",
                             "valor": [acc["atual"]["taxa_total_pct"], acc["anterior"]["taxa_total_pct"]], "unidade": "% da energia injetada",
                             "aviso": ref.get("aviso_parcial")})
            itens.append({
                "id": "perdas", "titulo": "Perdas na distribuição",
                "pergunta": "Quanto da energia injetada nas redes de distribuição se perdeu?",
                "valor": a["taxa_total_pct"], "unidade": "% da energia injetada", "valor_exibido": e["valor_exibido"],
                "complementos": comp,
                "periodo": {"tipo": "anual", "inicio": f"{a['ano']}-01", "fim": f"{a['ano']}-12", "rotulo": f"Ano de {a['ano']} completo"},
                "defasagem": {"meses": _meses_entre(f"{a['ano']}-12", hoje),
                              "texto": f"Ano encerrado em 12/{a['ano']}; última competência publicada {c.mes_br(ref['ultima_competencia'])}."},
                "cobertura": f"{e['universo']}. {e['cobertura']}.",
                "natureza": perd["proveniencia"]["taxas"]["natureza"], "frequencia": perd["proveniencia"]["taxas"]["frequencia"],
                "nao_e_situacao_do_dia": True,
                "aviso": "Perdas técnicas e não técnicas somadas; a separação só existe para parte das distribuidoras.",
                "metrica": "perdas_taxa_total_injetada", "gold": "perdas.json", "caminho": f"perdas.json#nacional[{a['ano']},concessionarias].taxa_total_pct",
                "evidencia_caminho": "perdas.json#evidencias.taxa_nacional", "evidencia": e,
                "atualidade": atual("aneel_samp_balanco"), "href": ROTAS["perdas"]})
        else:
            ausentes.append({"id": "perdas", "motivo": "perdas.json sem ano completo nacional"})
    else:
        ausentes.append({"id": "perdas", "motivo": "perdas.json indisponível"})

    if _ok(incl):
        k = (incl.get("tarifa_social") or {}).get("kpis") or {}
        uc, part = k.get("uc_tsee"), k.get("participacao_pct")
        if uc and uc.get("valor") is not None:
            e = uc["evidencia"]
            fat = k.get("faturas_cde_mapa") or {}
            comp = []
            if part and part.get("valor") is not None:
                comp.append({"rotulo": "Participação nas unidades consumidoras residenciais", "valor": part["valor"], "unidade": part["unidade"],
                             "mes": part.get("mes")})
            if fat.get("valor") is not None:
                comp.append({"rotulo": "Faturas com desconto da Tarifa Social no arquivo de Beneficiários da CDE (outra fonte, mês mais recente)",
                             "valor": fat["valor"], "unidade": fat.get("unidade"), "mes": fat.get("mes")})
            at = atual("aneel_scs")
            itens.append({
                "id": "beneficios", "titulo": "Alcance da Tarifa Social",
                "pergunta": "Quantas unidades consumidoras recebem o desconto da Tarifa Social?",
                "valor": uc["valor"], "unidade": uc["unidade"], "valor_exibido": e["valor_exibido"],
                "complementos": comp,
                "periodo": {"tipo": "mensal", "inicio": uc["mes"], "fim": uc["mes"], "rotulo": f"Mês de {c.mes_br(uc['mes'])}"},
                "defasagem": {"meses": _meses_entre(uc["mes"], hoje),
                              "texto": (f"Mês de referência {c.mes_br(uc['mes'])}, {_meses_entre(uc['mes'], hoje)} meses antes do processamento"
                                        + (f"; o conjunto SCS está ATRASADO no painel de saúde dos dados ({at['dias_atraso']} dias além do prazo)"
                                           if at and at.get("situacao") == "ATRASADO" else "") + ".")},
                "cobertura": f"{e['universo']}. {e['cobertura']}.",
                "natureza": "CALCULADO", "frequencia": "mensal",
                "nao_e_situacao_do_dia": True,
                "aviso": "Contagem de unidades consumidoras com desconto, não de famílias; a cobertura frente às famílias elegíveis é uma aproximação (painel Inclusão).",
                "metrica": "inclusao.tsee_uc", "gold": "inclusao.json", "caminho": "inclusao.json#tarifa_social.kpis.uc_tsee.valor",
                "evidencia_caminho": "inclusao.json#tarifa_social.kpis.uc_tsee.evidencia", "evidencia": e,
                "atualidade": at, "href": ROTAS["inclusao"]})
        else:
            ausentes.append({"id": "beneficios", "motivo": "inclusao.json sem contagem de UC com Tarifa Social"})
    else:
        ausentes.append({"id": "beneficios", "motivo": "inclusao.json indisponível"})
    return {"itens": itens, "ausentes": ausentes,
            "regra": ("Cada indicador mantém o período de referência do módulo de origem (vigência, ano ou mês) e a cobertura "
                      "declarada; nenhum é apresentado como situação do dia. Valores, evidências e definições são os dos módulos.")}


# ---------------------------------------------------------------- P007: séries das regras

def _restricao_diaria(linhas, fonte):
    """{dia: (não gerada, verificada + não gerada)} do SIN: soma das linhas TOTAL das regiões."""
    num, den = {}, {}
    for ln in linhas or []:
        if ln["fonte"] != fonte or ln["razao"] != "TOTAL":
            continue
        ng, ver = _num(ln["energia_nao_gerada_mwh"]), _num(ln["geracao_verificada_mwh"])
        if ng is None or ver is None:
            continue
        num[ln["data"]] = num.get(ln["data"], 0.0) + ng
        den[ln["data"]] = den.get(ln["data"], 0.0) + ver + ng
    return num, den


def _int(x):
    """Contagem do CSV: vazio é ausência (None), nunca zero."""
    return int(x) if x not in (None, "") else None


def _limites_linhas(linhas):
    out = []
    for ln in linhas or []:
        out.append({"data": ln["data"], "sm": ln["sm"], "horas": _int(ln["horas"]),
                    "horas_no_piso": _int(ln["horas_no_piso"]),
                    "horas_no_teto_horario": _int(ln["horas_no_teto_horario"]),
                    "media_no_teto_estrutural": _int(ln["media_no_teto_estrutural"]),
                    "pld_min": _num(ln["pld_min"]), "pld_max_horario": _num(ln["pld_max_horario"]),
                    "pld_max_estrutural": _num(ln["pld_max_estrutural"]), "pld_media_dia": _num(ln["pld_media_dia"])})
    return out


def condicoes_das_regras(golds, con_p, entradas):
    """{regra: série de condições com detalhe}, controles contra as golds de origem,
    alternativas avaliadas ({regra: [(id, descrição, série)]}) e os insumos do silver usados
    pelas evidências (EAR e ENA por subsistema)."""
    out, controles, alternativas, insumos = {}, [], {}, {}
    hid, ger, carga, pld = (golds.get(k) for k in ("hidrologia.json", "geracao.json", "carga.json", "pld.json"))
    if con_p is not None and _ok(hid):
        todos = s.SMS + ("SIN",)
        ear = {sm: _serie(con_p, "ear_subsistema_di", f"ear_pct.{sm}") for sm in s.SMS}
        ear_mw = {sm: _serie(con_p, "ear_subsistema_di", f"ear_mwmes.{sm}") for sm in s.SMS}
        ear_mx = {sm: _serie(con_p, "ear_subsistema_di", f"ear_max_mwmes.{sm}") for sm in s.SMS}
        ear["SIN"] = s.ear_sin(ear_mw, ear_mx)
        insumos.update({"ear_mwmes": ear_mw, "ear_max_mwmes": ear_mx, "ear_pct": ear})
        fim = hid["dia_referencia_ear"]
        out["ear_faixa"] = s.condicoes_ear(ear, INICIO_HISTORICO, fim, entidades=("SIN",), q=s.Q_EXTREMO)
        # variantes rejeitadas, publicadas com a frequência que as reprovou
        alternativas["ear_faixa"] = [
            ("faixa_usual_sin", "EAR do SIN fora da faixa usual da data (10º a 90º percentil), regra da versão anterior da síntese.",
             s.condicoes_ear(ear, INICIO_HISTORICO, fim, entidades=("SIN",), q=s.Q_USUAL)),
            ("qualquer_subsistema", "Algum dos quatro subsistemas fora da faixa usual da data (10º a 90º percentil), regra original da síntese.",
             s.condicoes_ear(ear, INICIO_HISTORICO, fim, entidades=s.SMS, q=s.Q_USUAL))]
        ult = s.condicoes_ear(ear, fim, fim, entidades=todos, q=s.Q_USUAL)[-1]
        gold = {x["sm"]: x["ear"]["faixa"] for x in hid["subsistemas"]}
        calc = {sm: ult[2]["valores"].get(sm, {}).get("faixa") for sm in todos}
        controles.append({"nome": "ear_faixa: faixa usual do dia (SIN e subsistemas) igual à de hidrologia.json",
                          "resultado": "aprovado" if gold == calc else "ressalva", "detalhe": f"gold {gold}; reavaliada {calc}"})
        ena_mw = {sm: _serie(con_p, "ena_subsistema_di", f"ena_bruta_mwmed.{sm}") for sm in s.SMS}
        ena_pc = {sm: _serie(con_p, "ena_subsistema_di", f"ena_bruta_pct_mlt.{sm}") for sm in s.SMS}
        mw_sin, pct_sin = s.ena_sin(ena_mw, ena_pc)
        insumos.update({"ena_bruta_mwmed": ena_mw, "ena_bruta_pct_mlt": ena_pc})
        e30 = {sm: s.ena30_serie(ena_mw[sm], ena_pc[sm]) for sm in s.SMS}
        e30["SIN"] = s.ena30_serie(mw_sin, pct_sin)
        fim = hid["dia_referencia_ena"]
        out["ena_faixa"] = s.condicoes_ena(e30, INICIO_HISTORICO, fim, entidades=("SIN",), q=s.Q_EXTREMO)
        alternativas["ena_faixa"] = [
            ("faixa_usual_sin", "ENA de 30 dias do SIN fora da faixa usual da janela (10º a 90º percentil), regra da versão anterior da síntese.",
             s.condicoes_ena(e30, INICIO_HISTORICO, fim, entidades=("SIN",), q=s.Q_USUAL)),
            ("qualquer_subsistema", "Algum dos quatro subsistemas fora da faixa usual da janela (10º a 90º percentil), regra original da síntese.",
             s.condicoes_ena(e30, INICIO_HISTORICO, fim, entidades=s.SMS, q=s.Q_USUAL))]
        ult = s.condicoes_ena(e30, fim, fim, entidades=todos, q=s.Q_USUAL)[-1]
        gold = {x["sm"]: x["ena"]["faixa_30d"] for x in hid["subsistemas"]}
        calc = {sm: ult[2]["valores"].get(sm, {}).get("faixa") for sm in todos}
        vals = {sm: (c.r(ult[2]["valores"].get(sm, {}).get("valor"), 1),
                     next(x["ena"]["pct_mlt_30d"] for x in hid["subsistemas"] if x["sm"] == sm)) for sm in todos}
        controles.append({"nome": "ena_faixa: faixa usual e ENA de 30 dias (SIN e subsistemas) iguais às de hidrologia.json",
                          "resultado": "aprovado" if gold == calc and all(a == b for a, b in vals.values()) else "ressalva",
                          "detalhe": f"faixas gold {gold}, reavaliadas {calc}; ENA 30 dias (reavaliada, gold) {vals}"})
    if _ok(ger) and ger.get("serie_sin"):
        fontes = ("hidraulica", "termica", "eolica", "solar")
        num = {x["d"]: x["termica"] for x in ger["serie_sin"] if all(x.get(f) is not None for f in fontes)}
        den = {x["d"]: sum(x[f] for f in fontes) for x in ger["serie_sin"] if all(x.get(f) is not None for f in fontes)}
        out["termica"] = s.condicoes_janela_movel(num, den, INICIO_HISTORICO, ger["dia_referencia"], regime_inicio=ger["inicio_regime_atual"],
                                                  q=s.Q_EXTREMO)
        usual = s.condicoes_janela_movel(num, den, INICIO_HISTORICO, ger["dia_referencia"], regime_inicio=ger["inicio_regime_atual"], q=s.Q_USUAL)
        alternativas["termica"] = [("faixa_usual", "Participação térmica fora do 10º ao 90º percentil das 365 janelas anteriores, regra da versão anterior da síntese.", usual)]
        u = usual[-1][2]
        t = ger["termica_contexto"]
        ok = (u.get("valor") is not None and t.get("participacao_7d") is not None and abs(u["valor"] - t["participacao_7d"]) <= 0.05
              and abs(u["p_inf"] - t["p10_365d"]) <= 0.05 and abs(u["p_sup"] - t["p90_365d"]) <= 0.05) if u.get("p_inf") is not None else False
        controles.append({"nome": "termica: participação de 7 dias e faixa usual reavaliadas a partir de geracao.json#serie_sin",
                          "resultado": "aprovado" if ok else "ressalva",
                          "detalhe": (f"reavaliada {c.r(u.get('valor'), 3)}% (10º e 90º percentis {c.r(u.get('p_inf'), 3)} e {c.r(u.get('p_sup'), 3)}); gold "
                                      f"{t.get('participacao_7d')}% ({t.get('p10_365d')} e {t.get('p90_365d')}); tolerância 0,05 p.p.: MWmed diários "
                                      "arredondados ao inteiro e valores da gold com uma casa")})
    if _ok(carga):
        # base longa: carga_diaria.csv, publicado pelo mesmo builder de carga.json (dias em
        # quarentena ficam vazios, valores sem arredondar); carga.json#serie só traz três anos
        # e deixaria a regra sem base antes de 24/08/2024
        serie_gold = {x["d"]: x["SIN"] for x in carga["serie"] if x.get("SIN") is not None}
        sc = entradas.get("carga_diaria") or serie_gold
        insumos["carga_fonte"] = "carga_diaria.csv" if entradas.get("carga_diaria") else "carga.json#serie"
        out["carga_extrema"] = s.condicoes_carga(sc, carga.get("regimes") or [], INICIO_HISTORICO, carga["dia_referencia"])
        if entradas.get("carga_diaria"):
            ref = carga["dia_referencia"]
            difs = [abs(sc[k] - serie_gold[k]) for k in serie_gold if k in sc]
            fora = [k for k in serie_gold if k not in sc]
            ok = sc.get(ref) is not None and not fora and max(difs, default=0) <= 0.5
            controles.append({"nome": "carga_extrema: carga_diaria.csv igual a carga.json#serie nos dias publicados pelos dois",
                              "resultado": "aprovado" if ok else "ressalva",
                              "detalhe": (f"{len(difs)} dias comparados, maior diferença {c.r(max(difs, default=0), 4)} MWmed (tolerância 0,5 MWmed: a gold "
                                          f"arredonda ao inteiro); dias da gold ausentes do CSV: {len(fora)}; último dia do CSV {max(sc)}, carga.json {ref}")})
    if _ok(pld):
        out["descolamento"] = s.condicoes_descolamento(pld["diario"], INICIO_HISTORICO, pld["dia_referencia"])
        amp = out["descolamento"][-1][2].get("amplitude")
        controles.append({"nome": "descolamento: amplitude do dia igual a pld.json#amplitude_dia",
                          "resultado": "aprovado" if amp is not None and pld.get("amplitude_dia") is not None and abs(amp - pld["amplitude_dia"]) <= 0.02 else "ressalva",
                          "detalhe": f"amplitude das médias arredondadas {c.r(amp, 2)}; pld.json {pld.get('amplitude_dia')} (tolerância R$ 0,02/MWh: duas médias arredondadas ao centavo)"})
    lim = entradas.get("limites")
    if lim:
        fim = max(x["data"] for x in lim)
        out["pld_piso"] = s.condicoes_limites(lim, INICIO_HISTORICO, fim, "piso")
        out["pld_teto"] = s.condicoes_limites(lim, INICIO_HISTORICO, fim, "teto")
        if _ok(pld) and fim != pld["dia_referencia"]:
            controles.append({"nome": "pld_limites_diario.csv atualizado com pld.json", "resultado": "ressalva",
                              "detalhe": f"último dia no CSV {fim}; pld.json {pld['dia_referencia']}"})
    rest = entradas.get("restricoes")
    if rest:
        for fonte, rid in (("eolica", "restricao_eolica"), ("solar", "restricao_solar")):
            num, den = _restricao_diaria(rest, fonte)
            if num:
                # só o lado de cima: restrição baixa não é alerta
                out[rid] = s.condicoes_janela_movel(num, den, INICIO_HISTORICO, max(num), lados=("acima",), q=s.Q_EXTREMO)
                alternativas[rid] = [("p90", "Taxa de 7 dias acima do 90º percentil das 365 janelas anteriores, regra da versão anterior da síntese.",
                                      s.condicoes_janela_movel(num, den, INICIO_HISTORICO, max(num), lados=("acima",), q=s.Q_USUAL))]
    return out, controles, alternativas, insumos


# ---------------------------------------------------------------- P007: avaliação e textos

def _contexto_faixa_usual(hid, chave):
    """Subsistemas fora da faixa usual do painel Água (10º a 90º percentil), como contexto do
    texto da regra (a regra em si olha o SIN no extremo)."""
    if not _ok(hid):
        return ""
    if chave == "ear":
        fora = [x for x in hid["subsistemas"] if x["sm"] != "SIN" and x["ear"]["faixa"] in ("abaixo", "acima")]
        partes = [f"{x['nome']} com {s.nbr(x['ear']['valor'])}% ({x['ear']['faixa']} da faixa de {s.nbr(x['ear']['p10'])}% a "
                  f"{s.nbr(x['ear']['p90'])}%)" for x in fora]
    else:
        fora = [x for x in hid["subsistemas"] if x["sm"] != "SIN" and x["ena"]["faixa_30d"] in ("abaixo", "acima")]
        partes = [f"{x['nome']} com {s.nbr(x['ena']['pct_mlt_30d'], 1)}% da MLT ({x['ena']['faixa_30d']} da faixa de "
                  f"{s.nbr(x['ena']['p10_30d'], 1)}% a {s.nbr(x['ena']['p90_30d'], 1)}%)" for x in fora]
    return (" Subsistemas fora da faixa usual do painel Água (10º a 90º percentil): " + "; ".join(partes) + ".") if partes else ""


def _texto_regra(rid, golds, ult):
    """Texto de evidência do dia, com os números que a própria regra avaliou (e, como
    contexto rotulado, a faixa usual publicada pela gold de origem)."""
    hid, ger = golds.get("hidrologia.json"), golds.get("geracao.json")
    det = ult[2] if ult else {}
    dia = ult[0] if ult else None
    if rid in ("ear_faixa", "ena_faixa"):
        x = (det.get("valores") or {}).get("SIN")
        if not x:
            return f"Em {c.data_br(dia)}, EAR ou ENA do SIN sem distribuição comparável."
        ano = int(dia[:4])
        if rid == "ear_faixa":
            txt = (f"Em {c.data_br(dia)}, EAR do SIN de {s.nbr(x['valor'], 1)}% da EAR máxima; o alerta exige ficar abaixo de "
                   f"{s.nbr(x['p_inf'], 1)}% (5º percentil da data) ou acima de {s.nbr(x['p_sup'], 1)}% (95º percentil), com mediana de "
                   f"{s.nbr(x['mediana'], 1)}% em {x['anos']} anos (2001 a {ano - 1}).")
        else:
            txt = (f"Nos 30 dias até {c.data_br(dia)}, ENA do SIN de {s.nbr(x['valor'], 1)}% da MLT; o alerta exige ficar abaixo de "
                   f"{s.nbr(x['p_inf'], 1)}% (5º percentil da mesma janela) ou acima de {s.nbr(x['p_sup'], 1)}% (95º percentil), com "
                   f"mediana de {s.nbr(x['mediana'], 1)}% em {x['anos']} anos (2001 a {ano - 1}).")
        return txt + _contexto_faixa_usual(hid, "ear" if rid == "ear_faixa" else "ena")
    if rid == "termica" and det.get("valor") is not None:
        if det.get("p_inf") is None:
            return f"{s.nbr(det['valor'])}% nos 7 dias até {c.data_br(dia)}; dia não avaliável (menos de 365 janelas anteriores no regime)."
        txt = (f"{s.nbr(det['valor'])}% nos 7 dias até {c.data_br(dia)}; o alerta exige ficar abaixo de {s.nbr(det['p_inf'])}% "
               f"(5º percentil) ou acima de {s.nbr(det['p_sup'])}% (95º percentil) das 365 janelas anteriores, com mediana de "
               f"{s.nbr(det['p50'])}%.")
        if _ok(ger) and ger.get("dia_referencia") == dia:
            t = ger["termica_contexto"]
            txt += f" Faixa usual do painel Geração (10º a 90º percentil): de {s.nbr(t['p10_365d'])}% a {s.nbr(t['p90_365d'])}%."
        return txt
    if rid == "carga_extrema" and det.get("valor") is not None:
        v, p95 = det.get("valor"), det.get("p95")
        return (f"{s.nbr(v, 0)} MWmed em {c.data_br(dia)}; 95º percentil dos 364 dias anteriores: {s.nbr(p95, 0)} MWmed."
                if p95 is not None else f"{s.nbr(v, 0)} MWmed em {c.data_br(dia)}; dia não avaliável (base de 364 dias fora do mesmo regime ou incompleta).")
    if rid == "descolamento" and det.get("amplitude") is not None:
        return (f"Em {c.data_br(dia)}, diferença de R$ {s.nbr(det['amplitude'], 2)}/MWh entre {c.NOME_SUBMERCADO[det['maior']]} e "
                f"{c.NOME_SUBMERCADO[det['menor']]}; limiar do dia R$ {s.nbr(det['limiar'], 2)}/MWh.")
    if rid == "pld_piso" and det:
        hp = det.get("horas_no_piso") or {}
        return (f"Em {c.data_br(dia)}, horas no piso de R$ {s.nbr(det.get('pld_min'), 2)}/MWh: "
                + "; ".join(f"{c.NOME_SUBMERCADO[sm]} {hp.get(sm) if hp.get(sm) is not None else 'sem dado'}" for sm in s.SMS) + " (de 24).")
    if rid == "pld_teto" and det:
        ht = det.get("horas_no_teto_horario") or {}
        return (f"Em {c.data_br(dia)}, horas no teto horário de R$ {s.nbr(det.get('pld_max_horario'), 2)}/MWh: "
                + "; ".join(f"{c.NOME_SUBMERCADO[sm]} {ht.get(sm) if ht.get(sm) is not None else 'sem dado'}" for sm in s.SMS)
                + f". Teto estrutural (média diária) de R$ {s.nbr(det.get('pld_max_estrutural'), 2)}/MWh "
                + ("atingido em " + ", ".join(c.NOME_SUBMERCADO[sm] for sm in s.SMS if (det.get('media_no_teto_estrutural') or {}).get(sm)) + "."
                   if any((det.get("media_no_teto_estrutural") or {}).values()) else "não atingido."))
    if rid in ("restricao_eolica", "restricao_solar") and det:
        if det.get("p_sup") is None:
            return f"Taxa de {s.nbr(det.get('valor'), 1)}% nos 7 dias até {c.data_br(dia)}; dia não avaliável (menos de 365 janelas anteriores)."
        return (f"Taxa de restrição de {s.nbr(det['valor'], 1)}% nos 7 dias até {c.data_br(dia)}; 95º percentil das janelas "
                f"anteriores {s.nbr(det['p_sup'], 1)}% (mediana {s.nbr(det['p50'], 1)}%).")
    if rid == "revisao_material":
        cap = det.get("capturas") or {}
        if not cap:
            return "Nenhuma captura comparável nos últimos 7 dias."
        return "Capturas dos últimos 7 dias: " + "; ".join(
            f"{c.data_br(k)} com {n} {'revisão material' if n == 1 else 'revisões materiais'} em séries usadas nesta página"
            for k, n in sorted(cap.items())) + "."
    return None


def _num_regra(rid, ult):
    """(valor, limiar_inferior, limiar_superior) do dia, na unidade da regra, para o CSV, o
    bloco `valor` e a evidência. Ausência fica None (nunca zero)."""
    det = ult[2] if ult else {}
    if rid in ("ear_faixa", "ena_faixa"):
        x = (det.get("valores") or {}).get("SIN") or {}
        return x.get("valor"), x.get("p_inf"), x.get("p_sup")
    if rid == "termica":
        return det.get("valor"), det.get("p_inf"), det.get("p_sup")
    if rid in ("restricao_eolica", "restricao_solar"):
        return det.get("valor"), None, det.get("p_sup")
    if rid == "carga_extrema":
        return det.get("valor"), None, det.get("p95")
    if rid == "descolamento":
        return det.get("amplitude"), None, det.get("limiar")
    if rid == "pld_piso" and det.get("horas_no_piso"):
        hs = list(det["horas_no_piso"].values())
        return (max(hs) if None not in hs else None), None, 24
    if rid == "pld_teto" and det.get("horas_no_teto_horario"):
        hs = list(det["horas_no_teto_horario"].values())
        return (max(hs) if None not in hs else None), None, 0
    if rid == "revisao_material" and "capturas" in det:
        return sum(det["capturas"].values()), None, 0
    return None, None, None


def _detalhe_csv(rid, det):
    if not det:
        return ""
    if rid in ("ear_faixa", "ena_faixa"):
        x = (det.get("valores") or {}).get("SIN")
        return f"SIN:{x['faixa']}" if x else ""
    if rid in ("termica", "restricao_eolica", "restricao_solar"):
        return det.get("faixa") or ""
    if rid == "pld_piso":
        hp = det.get("horas_no_piso") or {}
        return ("horas no piso " + " ".join(f"{sm}:{hp.get(sm)}" for sm in s.SMS)
                + (("; dia inteiro " + " ".join(det["submercados"])) if det.get("submercados") else ""))
    if rid == "pld_teto":
        ht, me = det.get("horas_no_teto_horario") or {}, det.get("media_no_teto_estrutural") or {}
        est = [sm for sm in s.SMS if me.get(sm)]
        return ("horas no teto horário " + " ".join(f"{sm}:{ht.get(sm)}" for sm in s.SMS)
                + "; média no teto estrutural " + (" ".join(est) if est else "nenhum"))
    if rid == "descolamento" and det.get("maior"):
        return f"{det['maior']}>{det['menor']}"
    if rid == "revisao_material":
        return " ".join(f"{k}:{n}" for k, n in sorted((det.get("capturas") or {}).items()))
    return ""


def _resumo_alternativa(meta, aid, adesc, aserie):
    a2 = [(dd, cc) for dd, cc, _ in aserie]
    while a2 and a2[-1][1] is None:
        a2.pop()
    ha = s.resumo_historico(a2, meta["duracao_minima_dias"], meta["retorno_dias"]) if a2 else None
    ra = s.episodios(a2, meta["duracao_minima_dias"], meta["retorno_dias"]) if a2 else None
    item = {"id": aid, "condicao": adesc, "adotada": False,
            "pct_dias_exibidos": (ha or {}).get("pct_dias_exibidos"), "episodios": (ha or {}).get("episodios"),
            "pct_dias_com_condicao": (ha or {}).get("pct_dias_com_condicao"),
            "primeiro_dia_avaliado": (ha or {}).get("primeiro_dia_avaliado"),
            "motivo": ("Frequência de alerta alta demais para uma síntese: somada às demais regras, ocupa a caixa de destaques "
                       "na maior parte dos dias (ruído); mantida aqui para comparação.")}
    return item, (s.dias_em_alerta(a2, ra) if ra else {})


def _texto_coleta_ccee(pld, pld_det):
    """Última tentativa de coleta direta na CCEE, com data e hora, cruzada com os bloqueios
    que o módulo PLD publicou (sem afirmar o que a CCEE responde agora)."""
    coleta = (pld or {}).get("coleta_direta") or {}
    bloq = [b for b in (((pld_det or {}).get("conceito") or {}).get("bloqueios") or [])
            if str(b.get("fonte", "")).startswith("CCEE") and "403" in str(b.get("evidencia", ""))]
    if not coleta.get("tentado_em"):
        txt = " Sem registro de tentativa de coleta direta na CCEE em pld.json."
    else:
        quando = coleta["tentado_em"]
        txt = (f" Última tentativa de coleta direta na CCEE registrada em pld.json: {c.data_br(quando[:10])} às {quando[11:16]} UTC, "
               + ("bem-sucedida." if coleta.get("ok") else "sem sucesso."))
    if bloq:
        txt += (f" O módulo PLD registrou também resposta {bloq[0]['evidencia']} (pld_detalhe.json#conceito.bloqueios); "
                "enquanto a origem recusar o acesso, a série só avança com nova coleta bem-sucedida.")
    return txt, coleta, bloq


def avaliar_regras(golds, cond, conjuntos, hoje, alternativas=None, usados=None):
    """Lista `observar` completa (compatível com a página), linhas dos CSV, dias com alerta
    exibido por regra (para a frequência conjunta e para conferir emissões passadas), o
    último dia avaliado de cada regra (para as evidências) e as regras sem dado."""
    pld, cmo = golds.get("pld.json"), golds.get("cmo.json")
    out, linhas_csv, linhas_ep, exibidos, sem_dado, ultimos, alt_alertas = [], [], [], {}, [], {}, {}
    for meta in REGRAS:
        rid = meta["id"]
        item = {k: meta[k] for k in ("id", "tipo", "titulo", "condicao", "limiar", "duracao_minima_dias", "retorno_dias", "regra_retorno",
                                     "materialidade", "nao_implica", "hipoteses", "href", "gold", "metrica", "unidade")}
        item["assunto"] = meta.get("assunto") or ("dados" if meta["tipo"] == "dados" else "sistema")
        item["versao_regra"] = versao_regra(meta)
        item["alerta_nao_implica_causa"] = NAO_IMPLICA
        if meta["tipo"] == "regra":
            serie = cond.get(rid)
            serie2 = [(dd, cc) for dd, cc, _ in serie or []]
            # dias finais sem avaliação (ex.: base incompleta) não definem o estado: a regra
            # é avaliada até o último dia com dado
            while serie2 and serie2[-1][1] is None:
                serie2.pop()
            if not serie2:
                sem_dado.append({"id": rid, "motivo": "série de origem indisponível nesta execução ou sem dia avaliável"})
                continue
            r = s.episodios(serie2, meta["duracao_minima_dias"], meta["retorno_dias"])
            hist = s.resumo_historico(serie2, meta["duracao_minima_dias"], meta["retorno_dias"])
            ult = next(x for x in reversed(serie) if x[1] is not None)
            ultimos[rid] = ult
            ep = next((e for e in r["episodios"] if e["em_curso"]), None)
            item.update({
                "ativo": r["estado"] in ("ativo", "em_retorno"), "estado": r["estado"],
                "referencia": ult[0], "defasagem_dias": s.defasagem_dias(ult[0], hoje),
                "condicao_no_dia": bool(ult[1]),
                "evidencia": _texto_regra(rid, golds, ult) or "",
                "episodio_atual": ({**ep, "duracao_dias": s._duracao(ep, serie2[-1][0]),
                                    "dias_desde_confirmacao": (s.d(ult[0]) - s.d(ep["confirmado_em"])).days} if ep else None),
                "sequencia_atual": r["sequencia_atual"],
                "dias_sem_condicao_no_retorno": r["dias_sem_condicao_no_retorno"],
                "historico": hist, "linha_estado": s.estado_compacto(serie2, r),
            })
            alts = []
            for aid, adesc, aserie in (alternativas or {}).get(rid) or []:
                a_item, a_alertas = _resumo_alternativa(meta, aid, adesc, aserie)
                alts.append(a_item)
                alt_alertas.setdefault(rid, {})[aid] = a_alertas
            if alts:
                item["alternativas_avaliadas"] = alts
            v, li, ls = _num_regra(rid, ult)
            item["valor"] = {"valor": c.r(v, 4), "limiar_inferior": c.r(li, 4), "limiar_superior": c.r(ls, 4)}
            alertas = s.dias_em_alerta(serie2, r)  # dias com o alerta exibido → dia da confirmação
            for e in r["episodios"]:
                linhas_ep.append([rid, e["inicio"], e["confirmado_em"], e["fim"], e.get("normalizado_em"), e["dias_condicao"],
                                  s._duracao(e, serie2[-1][0]), 1 if e["em_curso"] else 0])
            exibidos[rid] = (alertas, {dd for dd, cc in serie2 if cc is not None})
            for dd, cc, det in serie:
                vv, a, b = _num_regra(rid, (dd, cc, det))
                est = "A" if dd in alertas else ("-" if cc is None else ("o" if cc else "."))
                linhas_csv.append([dd, rid, "" if cc is None else (1 if cc else 0), est, c.r(vv, 4), c.r(a, 4), c.r(b, 4), _detalhe_csv(rid, det)])
        elif rid == "pld_defasagem":
            if not _ok(pld):
                continue
            atraso = s.defasagem_dias(pld["dia_referencia"], hoje)
            txt_col, coleta, bloq = _texto_coleta_ccee(pld, golds.get("pld_detalhe.json"))
            item.update({
                "ativo": atraso > 2, "estado": "ativo" if atraso > 2 else "normal", "referencia": pld["dia_referencia"],
                "defasagem_dias": atraso, "condicao_no_dia": atraso > 2,
                "evidencia": f"Último dia integrado: {c.data_br(pld['dia_referencia'])}. " + s.texto_defasagem(pld["dia_referencia"], hoje) + txt_col,
                "coleta_direta": {"tentado_em": coleta.get("tentado_em"), "ok": coleta.get("ok"), "fonte": "pld.json#coleta_direta"} if coleta else None,
                "bloqueios_registrados": [{"fonte": b.get("fonte"), "evidencia": b.get("evidencia"), "origem": "pld_detalhe.json#conceito.bloqueios"} for b in bloq],
                "historico": None,
                "historico_nao_se_aplica": ("Regra sobre o estado da integração, avaliada a cada processamento; o registro das publicações "
                                            "está no silver sintese, conjunto _visao_alertas.")})
        elif rid == "atualidade_fontes":
            lista = sorted(usados or [])
            atrasados = [(ds, conjuntos[ds]["atualidade"]) for ds in lista if ds in (conjuntos or {})
                         and (conjuntos[ds].get("atualidade") or {}).get("situacao") == "ATRASADO"]
            sem = [ds for ds in lista if ds not in (conjuntos or {})]
            item.update({
                "ativo": bool(atrasados), "estado": "ativo" if atrasados else "normal", "referencia": hoje.isoformat(),
                "defasagem_dias": 0, "condicao_no_dia": bool(atrasados),
                "evidencia": ("; ".join(f"{ds}: último período {a.get('ultimo_periodo')}, {a.get('dias_atraso')} dias além do prazo da cadência {a.get('cadencia')}"
                                        for ds, a in atrasados) + "." if atrasados else
                              f"Os {len(lista) - len(sem)} conjuntos usados nesta página estão em dia ou sem prazo declarado.")
                + (f" Sem situação publicada: {', '.join(sem)}." if sem else ""),
                "conjuntos_avaliados": lista, "historico": None,
                "historico_nao_se_aplica": ("A situação vem do painel de saúde dos dados (publicacao.json), recalculada a cada processamento; "
                                            "os conjuntos avaliados são os das frases, dos determinantes, de energia e sociedade e das regras publicadas.")})
        elif rid == "cmo_semana":
            if not _ok(cmo):
                continue
            se = next(x for x in cmo["ultima_semana"] if x["sm"] == "SE")
            item.update({
                "ativo": True, "estado": "evento", "referencia": cmo["semana_referencia"],
                "defasagem_dias": s.defasagem_dias(cmo["semana_referencia"], hoje), "condicao_no_dia": True,
                "evidencia": (f"Semana de referência {c.data_br(cmo['semana_referencia'])}: Sudeste/Centro-Oeste R$ {s.nbr(se['semanal'], 2)}/MWh; "
                              + "; ".join(f"{x['nome']} R$ {s.nbr(x['semanal'], 2)}" for x in cmo["ultima_semana"] if x["sm"] != "SE") + "."),
                "historico": None, "historico_nao_se_aplica": "Evento de calendário, não regra de alerta."})
        out.append(item)
    return out, linhas_csv, linhas_ep, exibidos, sem_dado, ultimos, alt_alertas


def conjuntos_usados(frases_pub, mult, soc, regras_com_dado):
    """Conjuntos que a página publicada usa de fato: os das frases emitidas, dos painéis de
    P005, dos itens de energia e sociedade e das regras avaliadas (inclusive as restrições
    eólica e fotovoltaica e o CMO semanal), para a regra de atualidade."""
    usados = {f["versoes"]["dataset"] for f in frases_pub}
    usados |= {CONJUNTOS_PAINEL[p["id"]] for p in (mult or {}).get("paineis", []) if p["id"] in CONJUNTOS_PAINEL}
    usados |= {(i.get("atualidade") or {}).get("conjunto") for i in soc.get("itens", []) if (i.get("atualidade") or {}).get("conjunto")}
    meta = {r["id"]: r for r in REGRAS}
    usados |= {meta[rid]["dataset"] for rid in regras_com_dado if meta.get(rid, {}).get("dataset")}
    return sorted(usados)


def condicao_revisoes(revs, dias_comp, fim):
    """Condição diária de revisao_material: só revisões materiais de séries que a página usa."""
    eventos = {}
    for ds, dias in dias_comp.items():
        for dd in dias:
            eventos.setdefault(dd, 0)
    for r in revs:
        if r["material"] and r.get("usada_na_pagina"):
            eventos[r["dia_captura"]] = eventos.get(r["dia_captura"], 0) + 1
    if not eventos:
        return None
    return s.condicoes_revisao(eventos, INICIO_HISTORICO, max(fim, max(eventos)))


# ---------------------------------------------------------------- registro das publicações aceitas

def registra_publicacao_aceita(con, publicada):
    """Grava no silver da família o estado de cada regra da gold que está publicada em
    public/energia/gold (a que a sentinela aceitou), uma vez por publicação: a chave é o
    `processado_em` dela. Por que a partir do arquivo publicado e não do que esta execução
    construiu: uma gold que vira stub ou que a sentinela rejeita nunca chegou ao leitor e
    não pode contar como alerta emitido. A publicação desta execução entra no registro na
    execução seguinte. Devolve True quando gravou."""
    if not _ok(publicada) or not publicada.get("processado_em") or not isinstance(publicada.get("observar"), list):
        return False
    cap = base.instante_utc(publicada["processado_em"])
    if con.execute("SELECT 1 FROM vintages WHERE dataset=? AND capturado_em=?", (DS_ALERTAS, cap)).fetchone():
        return False
    estados = {o["id"]: {"estado": o.get("estado"), "ativo": "1" if o.get("ativo") else "0", "referencia": o.get("referencia"),
                         "versao_regra": o.get("versao_regra"), "inicio_episodio": (o.get("episodio_atual") or {}).get("inicio"),
                         "processado_em_brasilia": publicada.get("data_processamento")}
               for o in publicada["observar"] if o.get("id")}
    corpo = json.dumps(estados, sort_keys=True, ensure_ascii=False).encode()
    sha = base.sha256_bytes(corpo + cap.encode())
    vid, _ = base.registra_vintage(con, DS_ALERTAS, "estados", None, cap, None, sha, len(corpo), "publicacao_aceita", f"gold/{GOLD}")
    linhas = [(rid, campo, v) for rid, e in estados.items() for campo, v in e.items() if campo != "processado_em_brasilia"]
    base.grava_registros(con, DS_ALERTAS, vid, linhas)
    con.commit()
    return True


def estados_emitidos(con):
    """[(capturado_em, {regra: {campo: valor}})] com o estado completo de cada regra em cada
    publicação registrada (uma passada: grava_registros só guarda o que mudou)."""
    rows = con.execute(
        """SELECT v.capturado_em, r.chave, r.campo, r.valor FROM registros r JOIN vintages v ON v.vintage_id = r.vintage_id
           WHERE r.dataset=? ORDER BY v.capturado_em, r.rowid""", (DS_ALERTAS,)).fetchall()
    caps = [x[0] for x in con.execute("SELECT capturado_em FROM vintages WHERE dataset=? ORDER BY capturado_em", (DS_ALERTAS,))]
    por_cap = {}
    for cap, ch, campo, valor in rows:
        por_cap.setdefault(cap, []).append((ch, campo, valor))
    estado, out = {}, []
    for cap in caps:
        for ch, campo, valor in por_cap.get(cap, []):
            estado.setdefault(ch, {})[campo] = valor
        out.append((cap, {k: dict(v) for k, v in estado.items()}))
    return out


def confere_emissoes(con, observar, exibidos):
    """Para cada regra com histórico: alertas publicados (registro das publicações aceitas)
    cuja data de referência, reavaliada com os dados de hoje, já não fica em alerta. É o
    falso alarme mensurável: alerta que a revisão da fonte desfez."""
    registros = estados_emitidos(con)
    nao_conf = []
    for o in observar:
        rid = o["id"]
        emitidos, nao, mudancas, anterior = [], [], 0, None
        for cap, est in registros:
            e = est.get(rid) or {}
            if e.get("ativo") != anterior:
                mudancas += 1
                anterior = e.get("ativo")
            # só emissões da mesma versão da regra: mudança de regra não é revisão de dado
            if e.get("ativo") == "1" and e.get("referencia") and e.get("versao_regra") == o.get("versao_regra"):
                emitidos.append((cap, e["referencia"]))
        if rid in exibidos:
            exib, avaliados = exibidos[rid]
            nao = [(cap, ref) for cap, ref in emitidos if ref in avaliados and ref not in exib]
        refs = sorted({ref for _, ref in emitidos})
        o["registro_emissoes"] = {
            "inicio": registros[0][0] if registros else None, "publicacoes_registradas": len(registros), "mudancas_de_estado": mudancas,
            "emitidos": len(emitidos), "referencias_em_alerta": len(refs),
            "nao_confirmados_apos_revisao": len({ref for _, ref in nao}) if rid in exibidos else None,
            "exemplos_nao_confirmados": [{"capturado_em": a, "referencia": b} for a, b in nao[:5]],
            "nota": ("Estados das publicações aceitas (gold em public/energia/gold), registrados a partir da publicação seguinte; "
                     "uma gold que virou stub ou que a sentinela rejeitou não entra. Mede quantos alertas publicados deixaram de "
                     "se confirmar quando a fonte revisou os dados (regras sem histórico diário não são conferidas).")}
        nao_conf.extend({"regra": rid, "capturado_em": a, "referencia": b} for a, b in nao)
    return nao_conf


# ---------------------------------------------------------------- destaques (P004)

def destaques(observar):
    """Caixa de destaques: regras de sistema em alerta confirmadas há menos de
    NOVIDADE_DIAS dias (o que mudou), da mais rara para a mais frequente no histórico, no
    máximo três; texto montado por regra fixa, com duração, retorno, histórico avaliável e
    a evidência do número avaliado."""
    cand = [o for o in observar if o["tipo"] == "regra" and o.get("assunto") == "sistema"
            and o.get("estado") in ("ativo", "em_retorno") and o.get("historico") and o.get("episodio_atual")]
    cand.sort(key=lambda o: (o["historico"]["pct_dias_exibidos"], o["id"]))
    novos = [o for o in cand if s.em_destaque(o["referencia"], o["episodio_atual"]["confirmado_em"])]
    antigos = [o for o in cand if o not in novos]
    out = []
    for o in novos[:MAX_DESTAQUES]:
        ep, h = o["episodio_atual"], o["historico"]
        dias = ep["duracao_dias"]
        retorno = ""
        if o["estado"] == "em_retorno":
            k = o.get("dias_sem_condicao_no_retorno") or 0
            retorno = (f" A condição não se verificou nos últimos {k} {'dia' if k == 1 else 'dias'} avaliados; o retorno exige "
                       f"{o['retorno_dias']}.")
        txt = (f"{o['titulo']}: {o['evidencia']} Condição desde {c.data_br(ep['inicio'])}, alerta desde {c.data_br(ep['confirmado_em'])} "
               f"({dias} {'dia' if dias == 1 else 'dias'} de episódio até {c.data_br(ep['fim'])}).{retorno} {o['regra_retorno']} "
               f"No histórico avaliável desde {c.data_br(h['primeiro_dia_avaliado'])} ({h['dias_avaliados']} dias), esta regra ficou em "
               f"alerta em {s.nbr(h['pct_dias_exibidos'], 1)}% dos dias ({h['episodios']} {'episódio' if h['episodios'] == 1 else 'episódios'}).")
        out.append({"regra": o["id"], "titulo": o["titulo"], "texto": txt, "tipo": "fato", "estado": o["estado"],
                    "desde": ep["inicio"], "confirmado_em": ep["confirmado_em"], "dias": dias,
                    "dias_desde_confirmacao": ep["dias_desde_confirmacao"], "referencia": o["referencia"],
                    "normaliza_quando": o["regra_retorno"], "frequencia_historica_pct": h["pct_dias_exibidos"],
                    "historico_avaliavel_desde": h["primeiro_dia_avaliado"], "dias_avaliados": h["dias_avaliados"],
                    "valor": o.get("valor"), "evidencia_caminho": f"sintese.json#observar[{o['id']}].evidencia_numero",
                    "evidencia": o.get("evidencia_numero"),
                    "hipoteses_a_verificar": [{**x, "tipo": "hipotese"} for x in o["hipoteses"]],
                    "nao_implica": o["nao_implica"], "href": o["href"]})
    resto = ([{"regra": o["id"], "motivo": f"além do limite de {MAX_DESTAQUES} destaques"} for o in novos[MAX_DESTAQUES:]]
             + [{"regra": o["id"], "motivo": (f"em alerta desde {c.data_br(o['episodio_atual']['confirmado_em'])}, há "
                                             f"{o['episodio_atual']['dias_desde_confirmacao']} dias; a caixa mostra os primeiros "
                                             f"{s.NOVIDADE_DIAS} dias de cada alerta, e a regra segue na lista completa")} for o in antigos])
    return {"itens": out, "outras_regras_em_alerta": resto, "limite": MAX_DESTAQUES, "novidade_dias": s.NOVIDADE_DIAS,
            "criterio": (f"Só regras sobre o sistema (as de qualidade dos dados ficam na lista completa), com a duração mínima atingida "
                         f"e confirmadas há menos de {s.NOVIDADE_DIAS} dias: a caixa responde o que mudou, e uma condição que já dura "
                         f"mais que isso continua no o que observar com a duração do episódio. Ordem pela raridade no histórico (menor "
                         f"fração de dias em alerta primeiro); no máximo três. Hipóteses listadas por regra são fixas, não testadas aqui, "
                         f"e indicam o painel onde a verificação seria feita."),
            "vazio": None if out else f"Nenhuma regra de sistema com alerta confirmado nos últimos {s.NOVIDADE_DIAS} dias nesta publicação."}


# regra anterior à recalibração, por regra: a variante publicada em alternativas_avaliadas
ALTERNATIVA_ANTERIOR = {"ear_faixa": "faixa_usual_sin", "ena_faixa": "faixa_usual_sin", "termica": "faixa_usual",
                        "restricao_eolica": "p90", "restricao_solar": "p90"}


def frequencia_destaques(observar, exibidos, alt_alertas):
    """Frequência conjunta da caixa de destaques: em quantos dias ao menos uma regra de
    sistema estaria na caixa, no período em que todas são avaliáveis e desde 2021, com a
    sensibilidade ao limite de novidade e a calibração anterior (seção 9.1: não alarmar por
    ruído). É a medida que fixou os limiares extremos e o limite de novidade."""
    sistema = [o["id"] for o in observar if o["tipo"] == "regra" and o.get("assunto") == "sistema" and o["id"] in exibidos]
    if not sistema:
        return None
    al = {r: exibidos[r][0] for r in sistema}
    ini = max(min(exibidos[r][1]) for r in sistema)
    fim = min(max(exibidos[r][1]) for r in sistema)
    comum = s.frequencia_conjunta(al, ini, fim)
    desde = s.frequencia_conjunta(al, INICIO_HISTORICO, fim)
    sens = []
    for k in (7, 14, 21, 30, None):
        sens.append({"novidade_dias": k, "pct_periodo_comum": s.frequencia_conjunta(al, ini, fim, k)["pct_dias_com_destaque"],
                     "pct_desde_inicio": s.frequencia_conjunta(al, INICIO_HISTORICO, fim, k)["pct_dias_com_destaque"]})
    ant = {r: (alt_alertas.get(r) or {}).get(ALTERNATIVA_ANTERIOR.get(r), al[r]) for r in sistema}
    anterior = s.frequencia_conjunta(ant, ini, fim, None)
    meta = c.r(s.META_DIAS_COM_DESTAQUE_PCT, 1)
    return {
        "criterio": (f"Materialidade da caixa de destaques: no período em que todas as regras de sistema são avaliáveis, a caixa fica "
                     f"ocupada em no máximo um terço dos dias ({s.nbr(meta, 1)}%); o normal é a caixa vazia. Limiares extremos (5º e "
                     f"95º percentis) e o limite de novidade de {s.NOVIDADE_DIAS} dias foram fixados por esse critério; a tabela de "
                     f"sensibilidade mostra o efeito de outros limites."),
        "meta_pct": meta, "atende_meta": comum["pct_dias_com_destaque"] is not None and comum["pct_dias_com_destaque"] <= meta,
        "novidade_dias": s.NOVIDADE_DIAS, "regras": sistema,
        "periodo_comum": comum, "desde_inicio": desde, "sensibilidade_novidade": sens,
        "calibracao_anterior": {"descricao": ("Faixa usual (10º a 90º percentil) nas regras de armazenamento, afluência e térmica, 90º "
                                              "percentil nas restrições e nenhum limite de novidade (versão anterior desta página)."),
                                "pct_periodo_comum": anterior["pct_dias_com_destaque"],
                                "distribuicao_regras_simultaneas": anterior["distribuicao_regras_simultaneas"]},
    }


# ---------------------------------------------------------------- evidências

def _resolve_caminho(golds, caminho):
    """Leitor dos caminhos publicados ("gold#a[CHAVE].b.c", [CHAVE] = elemento cujo sm, par ou
    id é CHAVE), escrito à parte de valores_frase: a evidência relê cada valor da frase por
    ele. Devolve (encontrado, valor)."""
    try:
        nome, resto = caminho.split("#", 1)
        x = golds[nome]
        for parte in resto.split("."):
            if "[" in parte:
                campo, chave = parte[:-1].split("[")
                x = next(e for e in x[campo] if chave in (e.get("sm"), e.get("par"), e.get("id")))
            else:
                x = x[parte]
        return True, x
    except (KeyError, StopIteration, ValueError, TypeError, AttributeError):
        return False, None


def confere_valores_frase(f, golds):
    """Relê cada valor da frase na gold de origem pelo caminho publicado. Caminhos com
    anotação têm conferência própria: '(módulo)' compara o valor absoluto; o sentido da rede
    é conferido pelo sinal da média; o início da janela da rede, pela data de referência
    menos 29 dias; a amplitude do PLD, pelo campo amplitude_dia. Devolve (resultado, detalhe)."""
    ok, falhas, notas = 0, [], []
    for k, x in f["valores"].items():
        cam, v = x["caminho"], x["valor"]
        if cam.endswith(" (módulo)"):
            achou, lido = _resolve_caminho(golds, cam[:-len(" (módulo)")])
            igual = achou and isinstance(lido, (int, float)) and abs(lido) == v
        elif cam.endswith(" (sentido pelo sinal da média)"):
            achou, fr_ = _resolve_caminho(golds, cam.split(" (", 1)[0])
            if achou:
                de, para = (fr_["de"], fr_["para"]) if fr_["fluxo_media_30d"] >= 0 else (fr_["para"], fr_["de"])
                igual = v == (de if k == "de" else para)
            else:
                igual = False
        elif cam.startswith("rede.json#regras.fluxo"):
            achou, fim = _resolve_caminho(golds, "rede.json#dia_referencia")
            igual = achou and v == (s.d(fim) - timedelta(days=29)).isoformat()
        elif cam.startswith("pld.json#cartoes[*]"):
            achou = True
            meds = [c_["media_dia"] for c_ in golds["pld.json"]["cartoes"]]
            igual = abs((max(meds) - min(meds)) - v) <= 0.005
            notas.append("amplitude refeita das médias dos cartões")
        else:
            achou, lido = _resolve_caminho(golds, cam)
            igual = achou and lido == v
        if igual:
            ok += 1
        else:
            falhas.append(f"{k}: publicado {v}, lido {'nada' if not achou else 'outro valor'} em {cam}")
    resultado = "aprovado" if not falhas and ok else "reprovado"
    return resultado, (f"{ok} de {len(f['valores'])} valores relidos na gold de origem e iguais ao publicado"
                       + (f"; divergências: {'; '.join(falhas)}" if falhas else "") + (f" ({'; '.join(notas)})" if notas else ""))[:900]


def _soma_sm(con, ds, prefixo, dias):
    """{dia: Σ dos quatro subsistemas} lido do silver; dia sem os quatro fica de fora."""
    por = {sm: _serie_janela(con, ds, f"{prefixo}.{sm}", min(dias), max(dias)) for sm in s.SMS}
    return {k: sum(por[sm][k] for sm in s.SMS) for k in dias if all(k in por[sm] for sm in s.SMS)}


def calculo_frase(fid, f, golds, con_p):
    """Número da frase antes do arredondamento, com numerador e denominador, relido do silver
    principal por um caminho que não passa pela gold de origem, e a reconciliação com o valor
    exibido. None sem silver ou sem todas as referências."""
    if con_p is None:
        return None
    v = f["valores"]
    if fid == "reservatorios":
        dia = v["dia"]["valor"]
        num, den = _soma_sm(con_p, "ear_subsistema_di", "ear_mwmes", [dia]).get(dia), _soma_sm(con_p, "ear_subsistema_di", "ear_max_mwmes", [dia]).get(dia)
        if num is None or not den:
            return None
        return {"valor": 100.0 * num / den, "exibido": v["ear_pct"]["valor"], "casas": 1, "tolerancia": "0,05 p.p. (meia unidade da casa exibida)",
                "numerador": {"descricao": f"EAR verificada dos quatro subsistemas em {dia} (Σ MWmês)", "valor": c.r(num, 3)},
                "denominador": {"descricao": f"EAR máxima dos quatro subsistemas em {dia} (Σ MWmês)", "valor": c.r(den, 3)},
                "chaves": [f"ear_subsistema_di/{k}.{sm}/{dia}" for k in ("ear_mwmes", "ear_max_mwmes") for sm in s.SMS],
                "formula": "EAR_SIN = 100 × Σ EAR verificada ÷ Σ EAR máxima (quatro subsistemas, mesmo dia)"}
    if fid == "afluencias":
        fim = v["dia"]["valor"]
        dias = s.calendario((s.d(fim) - timedelta(days=29)).isoformat(), fim)
        mw = {sm: _serie_janela(con_p, "ena_subsistema_di", f"ena_bruta_mwmed.{sm}", dias[0], fim) for sm in s.SMS}
        pc = {sm: _serie_janela(con_p, "ena_subsistema_di", f"ena_bruta_pct_mlt.{sm}", dias[0], fim) for sm in s.SMS}
        if not all(k in mw[sm] and pc[sm].get(k) for sm in s.SMS for k in dias):
            return None
        num = sum(mw[sm][k] for sm in s.SMS for k in dias)
        den = sum(mw[sm][k] / (pc[sm][k] / 100.0) for sm in s.SMS for k in dias)
        return {"valor": 100.0 * num / den, "exibido": v["ena30_pct_mlt"]["valor"], "casas": 1, "tolerancia": "0,05 p.p. (meia unidade da casa exibida)",
                "numerador": {"descricao": f"ENA bruta dos quatro subsistemas de {dias[0]} a {fim} (Σ MWmed diários)", "valor": c.r(num, 3)},
                "denominador": {"descricao": "MLT implícita (ENA ÷ percentual da MLT) dos mesmos dias e subsistemas (Σ MWmed diários)", "valor": c.r(den, 3)},
                "chaves": [f"ena_subsistema_di/{k}.{{SE,S,NE,N}}/{dias[0]} a {fim}" for k in ("ena_bruta_mwmed", "ena_bruta_pct_mlt")],
                "formula": "ENA30_SIN = 100 × Σ ENA bruta ÷ Σ MLT implícita, 30 dias e quatro subsistemas"}
    if fid == "carga":
        jan = s.janela_da_frase(fid, v)
        medias = []
        for a, b in jan:
            dias = s.calendario(a, b)
            sin = _soma_sm(con_p, "carga_energia_di", "carga_mwmed", dias)
            if len(sin) != len(dias):
                return None
            medias.append(sum(sin.values()) / len(dias))
        return {"valor": 100.0 * (medias[0] / medias[1] - 1), "exibido": c.r(v["variacao_pct"]["valor"], 1), "casas": 1,
                "tolerancia": "0,05 p.p. (meia unidade da casa exibida)",
                "numerador": {"descricao": f"carga média do SIN de {jan[0][0]} a {jan[0][1]} (MWmed, soma dos subsistemas)", "valor": c.r(medias[0], 3)},
                "denominador": {"descricao": f"carga média do SIN de {jan[1][0]} a {jan[1][1]} (MWmed)", "valor": c.r(medias[1], 3)},
                "chaves": [f"carga_energia_di/carga_mwmed.{{SE,S,NE,N}}/{a} a {b}" for a, b in jan],
                "formula": "variação = 100 × (média dos 7 dias ÷ média dos mesmos dias do ano anterior − 1)"}
    if fid == "termica":
        fim = v["dia"]["valor"]
        ini = (s.d(fim) - timedelta(days=6)).isoformat()
        dia = {fo: c.agrega_diario(sorted(_serie_janela(con_p, "balanco_energia_subsistema_ho", f"{fo}.SIN", ini, fim).items()))
               for fo in ("hidraulica", "termica", "eolica", "solar")}
        dias = s.calendario(ini, fim)
        if not all(k in dia[fo] for fo in dia for k in dias):
            return None
        num = sum(dia["termica"][k] for k in dias)
        den = sum(dia[fo][k] for fo in dia for k in dias)
        return {"valor": 100.0 * num / den, "exibido": v["participacao_7d"]["valor"], "casas": 1, "tolerancia": "0,05 p.p. (meia unidade da casa exibida)",
                "numerador": {"descricao": f"geração térmica do SIN no balanço de {ini} a {fim} (Σ das médias diárias, MWmed)", "valor": c.r(num, 3)},
                "denominador": {"descricao": "geração hidráulica, térmica, eólica e solar do SIN no balanço, mesmos dias (Σ das médias diárias, MWmed)", "valor": c.r(den, 3)},
                "chaves": [f"balanco_energia_subsistema_ho/{fo}.SIN/{ini}T00:00 a {fim}T23:00" for fo in ("hidraulica", "termica", "eolica", "solar")],
                "formula": "participação = 100 × Σ térmica ÷ Σ (hidráulica + térmica + eólica + solar), médias diárias das 24 horas, 7 dias"}
    if fid == "pld":
        dia = v["dia"]["valor"]
        h = _serie_janela(con_p, "ccee_pld_horario", "pld.SE", dia, dia)
        if len(h) != 24:
            return None
        return {"valor": sum(h.values()) / 24, "exibido": v["media_se"]["valor"], "casas": 2, "tolerancia": "R$ 0,005/MWh (meio centavo)",
                "numerador": None, "denominador": None, "chaves": [f"ccee_pld_horario/pld.SE/{dia}T00:00 a {dia}T23:00 (24 horas)"],
                "formula": "PLD médio do dia = (1/24) × Σ PLD horário do Sudeste/Centro-Oeste"}
    if fid == "rede":
        par, fim, ini = v["par"]["valor"], v["fim"]["valor"], v["inicio"]["valor"]
        h = _serie_janela(con_p, "intercambio_nacional_ho", f"fluxo.{par}", ini, fim)
        n_esp = 24 * len(s.calendario(ini, fim))
        if len(h) != n_esp:
            return None
        return {"valor": abs(sum(h.values()) / len(h)), "exibido": v["fluxo_mwmed"]["valor"], "casas": 0, "tolerancia": "0,5 MWmed (meia unidade exibida)",
                "numerador": None, "denominador": None, "chaves": [f"intercambio_nacional_ho/fluxo.{par}/{ini}T00:00 a {fim}T23:00 ({n_esp} horas)"],
                "formula": "fluxo médio = |(1/n) × Σ intercâmbio verificado horário|, 30 dias (n horas)"}
    return None


def _evidencia_frase(f, golds, con_p):
    g = golds[f["versoes"]["gold"]]
    nome_prov = s.ORIGEM_FRASE[f["id"]][1]
    prov = g["proveniencia"][nome_prov]
    anos = sorted({j["inicio"][:4] for j in f["qualidade"]["janelas"]} | {j["fim"][:4] for j in f["qualidade"]["janelas"]})
    if f["id"] == "reservatorios":
        # o desvio da frase compara com a mediana de 2001 ao ano anterior: os arquivos desses anos entram na fonte
        anos = [str(a) for a in range(2001, int(f["ref"][:4]) + 1)]
    vs = _vintages(con_p, f["versoes"]["dataset"], anos)
    fonte = _fonte_evidencia(prov["fonte"]["orgao"], prov["fonte"]["dataset"], prov["fonte"]["url_dataset"], vs)
    janelas = f["qualidade"]["janelas"]
    calc = calculo_frase(f["id"], f, golds, con_p)
    trechos_ok = s.texto_de(s.MODELOS[f["id"]](f["valores"])) == f["texto"]
    res_val, det_val = confere_valores_frase(f, golds)
    testes = [ev.teste("frase refeita a partir dos valores publicados", "aprovado" if trechos_ok else "reprovado",
                       f"MODELOS['{f['id']}'](valores) reproduz o texto exibido: {'sim' if trechos_ok else 'não'}"),
              ev.teste("valores relidos na gold de origem pelos caminhos publicados", res_val, det_val)]
    numeros = [(k, v) for k, v in f["valores"].items() if isinstance(v["valor"], (int, float)) and not isinstance(v["valor"], bool)]
    k0, v0 = numeros[0]
    if calc:
        igual = c.r(calc["valor"], calc["casas"]) == c.r(calc["exibido"], calc["casas"])
        rec = ev.reconciliacao(
            f"Valor refeito do silver principal (observações vigentes, sem passar pela gold de origem): {c.r(calc['valor'], 4)}; "
            f"exibido {calc['exibido']}", "aprovado" if igual else "reprovado", calc["tolerancia"])
        valor_calculo, num, den, chaves, formula = calc["valor"], calc["numerador"], calc["denominador"], calc["chaves"], calc["formula"]
    else:
        rec = ev.reconciliacao("Silver principal indisponível nesta execução: o valor não foi refeito por outro caminho (pendência).",
                               "ressalva", "não se aplica (sem conferência)")
        valor_calculo, num, den, chaves = v0["valor"], None, None, []
        formula = prov.get("formula") or f["regra"] or "valor publicado pela fonte"
    consulta = (f"silver energia.db: observacoes do dataset {f['versoes']['dataset']}, séries {', '.join(s.SERIES_FRASE[f['id']])}, nas referências "
                + "; ".join(f"{j['inicio']} a {j['fim']}" for j in janelas) + " (valor da captura mais recente)")
    return ev.construir(
        numerador=num, denominador=den,
        indicador=f"Visão geral, frase '{f['id']}'", valor_exibido=next(t["texto"] for t in f["trechos"] if t.get("evidencia")),
        valor_calculo=valor_calculo, unidade=v0.get("unidade") or prov["unidade"],
        periodo={"inicio": janelas[0]["inicio"], "fim": janelas[0]["fim"]},
        entidade="SIN" if f["id"] != "pld" else "Sudeste/Centro-Oeste", universo=prov["indicador"],
        fonte=fonte, chaves_origem=chaves, consulta=consulta, formula=formula,
        cobertura=f"Cobertura da série de origem: {prov['cobertura_historica']['inicio']} a {prov['cobertura_historica']['fim']}.",
        tratamento_ausencia="Sem o valor na gold de origem, a frase não é emitida (ausência declarada); sem todas as referências no silver, a reconciliação fica pendente.",
        revisoes=f["qualidade"]["revisoes"]["texto"], testes=testes, reconciliacao=rec,
        download=[{"rotulo": d["rotulo"], "url": d["url"]} for d in g.get("downloads") or []] or [{"rotulo": "Gold de origem", "url": f"/energia/gold/{f['versoes']['gold']}"}],
        reproducao=REPRODUCAO)


def valor_exibido_painel(p):
    """Valor atual do determinante como a página o escreve (mesma regra de src/lib/energia/visao.ts,
    valorAtualTexto): R$ antes do número, percentual colado à unidade, demais com espaço."""
    va, u, casas = p["valor_atual"]["valor"], p["unidade"], p["casas"]
    if va is None:
        return None
    if u == "R$/MWh":
        return f"R$ {s.nbr(va, casas)}/MWh"
    if u.startswith("%"):
        return f"{s.nbr(va, casas)}{u}"
    return f"{s.nbr(va, casas)} {u}"


def calculo_painel(p, golds, con_p):
    """Valor atual de cada determinante (P005) refeito do silver principal, por um caminho que
    não passa pela gold de origem. Preço, água e geração usam a mesma conta das frases (o número
    é o mesmo); carga e rede somam ou fazem a média das observações vigentes do dia. None sem
    silver ou sem todas as observações do dia."""
    va = p["valor_atual"]
    if con_p is None or va["valor"] is None:
        return None
    dia = p["data_referencia"]
    if p["id"] == "preco":
        return calculo_frase("pld", {"valores": {"dia": {"valor": dia}, "media_se": {"valor": va["valor"]}}}, golds, con_p)
    if p["id"] == "agua":
        return calculo_frase("reservatorios", {"valores": {"dia": {"valor": dia}, "ear_pct": {"valor": va["valor"]}}}, golds, con_p)
    if p["id"] == "geracao":
        return calculo_frase("termica", {"valores": {"dia": {"valor": dia}, "participacao_7d": {"valor": va["valor"]}}}, golds, con_p)
    if p["id"] == "carga":
        por = {sm: _serie_janela(con_p, "carga_energia_di", f"carga_mwmed.{sm}", dia, dia).get(dia) for sm in s.SMS}
        if any(x is None for x in por.values()):
            return None
        return {"valor": sum(por.values()), "exibido": va["valor"], "casas": 0, "tolerancia": "0,5 MWmed (meia unidade exibida)",
                "numerador": None, "denominador": None, "parcelas": {sm: c.r(x, 3) for sm, x in por.items()},
                "chaves": [f"carga_energia_di/carga_mwmed.{sm}/{dia}" for sm in s.SMS],
                "formula": "carga do SIN no dia = Σ carga de energia diária dos quatro subsistemas (MWmed)"}
    if p["id"] == "rede":
        cam = va.get("caminho") or ""
        if "[" not in cam:
            return None
        par = cam.split("[", 1)[1].split("]", 1)[0]
        h = _serie_janela(con_p, "intercambio_nacional_ho", f"fluxo.{par}", dia, dia)
        if len(h) != 24:
            return None
        return {"valor": sum(h.values()) / 24, "exibido": va["valor"], "casas": 0, "tolerancia": "0,5 MWmed (meia unidade exibida)",
                "numerador": None, "denominador": None,
                "chaves": [f"intercambio_nacional_ho/fluxo.{par}/{dia}T00:00 a {dia}T23:00 (24 horas)"],
                "formula": "fluxo médio do dia = (1/24) × Σ intercâmbio verificado horário (positivo da primeira para a segunda ponta da fronteira)"}
    return None


def _evidencia_painel(p, golds, con_p, dados):
    """'Comprove este número' do valor atual de um determinante (P005): o número refeito do silver,
    o valor relido na gold de origem pelo caminho publicado e a célula do dia no recorte alinhado."""
    g = golds[p["gold"]]
    prov = g["proveniencia"][p["proveniencia"].split("#proveniencia.", 1)[1]]
    va = p["valor_atual"]
    dia = p["data_referencia"]
    ds = CONJUNTOS_PAINEL[p["id"]]
    anos = [dia[:4]]
    if p["id"] == "geracao":
        anos = sorted({(s.d(dia) - timedelta(days=6)).isoformat()[:4], dia[:4]})
    vs = _vintages(con_p, ds, anos)
    fonte = _fonte_evidencia(prov["fonte"]["orgao"], prov["fonte"]["dataset"], prov["fonte"]["url_dataset"], vs)
    calc = calculo_painel(p, golds, con_p)
    achou, lido = _resolve_caminho(golds, va["caminho"]) if va.get("caminho") else (False, None)
    igual = achou and isinstance(lido, (int, float)) and lido == va["valor"]
    testes = [ev.teste("valor relido na gold de origem pelo caminho publicado", "aprovado" if igual else "reprovado",
                       f"{va['caminho']}: lido {lido if achou else 'nada'}, publicado {va['valor']}")]
    # a célula do dia no recorte alinhado vem da série da gold de origem, com mais casas que o cartão:
    # as duas têm de coincidir na casa exibida (meia unidade)
    linha = next((x for x in dados if x["d"] == dia), None)
    col = {"preco": "preco_SE", "agua": "agua_SIN", "geracao": "geracao_termica_7d", "carga": "carga_SIN"}.get(p["id"])
    if p["id"] == "rede" and va.get("caminho") and "[" in va["caminho"]:
        col = "rede_" + va["caminho"].split("[", 1)[1].split("]", 1)[0]
    cel = (linha or {}).get(col) if col else None
    meia = 0.5 * 10 ** (-p["casas"])
    if cel is None:
        testes.append(ev.teste("célula do dia no recorte alinhado (P005)", "ressalva", f"{col} sem valor em {dia} no recorte"))
    else:
        perto = abs(cel - va["valor"]) <= meia + 1e-9
        testes.append(ev.teste("célula do dia no recorte alinhado (P005)", "aprovado" if perto else "reprovado",
                               f"{col} em {dia}: {cel}; valor atual {va['valor']}; tolerância {meia} {p['unidade']} (meia unidade da casa exibida)"))
    if calc:
        iguais = c.r(calc["valor"], calc["casas"]) == c.r(calc["exibido"], calc["casas"])
        parc = calc.get("parcelas")
        rec = ev.reconciliacao(
            f"Valor refeito do silver principal (observações vigentes, sem passar pela gold de origem): {c.r(calc['valor'], 4)}; exibido {calc['exibido']}"
            + (f"; parcelas {', '.join(f'{sm} {x}' for sm, x in parc.items())}" if parc else ""),
            "aprovado" if iguais else "reprovado", calc["tolerancia"])
        valor_calculo, num, den, chaves, formula = calc["valor"], calc["numerador"], calc["denominador"], calc["chaves"], calc["formula"]
    else:
        rec = ev.reconciliacao("Silver principal sem todas as observações do dia nesta execução: o valor não foi refeito por outro caminho (pendência).",
                               "ressalva", "não se aplica (sem conferência)")
        valor_calculo, num, den, chaves = va["valor"], None, None, []
        formula = prov.get("formula") or p["nota"]
    periodo = {"inicio": (s.d(dia) - timedelta(days=6)).isoformat() if p["id"] == "geracao" else dia, "fim": dia}
    return ev.construir(
        numerador=num, denominador=den,
        indicador=f"Visão geral, determinante '{p['id']}': {p['titulo'].lower()}, valor atual ({va['rotulo']})",
        valor_exibido=valor_exibido_painel(p), valor_calculo=valor_calculo, unidade=p["unidade"], periodo=periodo,
        entidade=va["rotulo"] or "SIN", universo=prov["indicador"], fonte=fonte, chaves_origem=chaves,
        consulta=f"silver energia.db: observacoes do dataset {ds} em {periodo['inicio']} a {periodo['fim']} (valor da captura mais recente)",
        formula=formula,
        cobertura=f"Cobertura da série de origem: {prov['cobertura_historica']['inicio']} a {prov['cobertura_historica']['fim']}.",
        tratamento_ausencia="Sem o valor na gold de origem, o painel mostra 'sem dado'; sem todas as observações do dia no silver, a reconciliação fica pendente.",
        revisoes=prov.get("revisoes_conhecidas"), testes=testes, reconciliacao=rec,
        download=[{"rotulo": d["rotulo"], "url": d["url"]} for d in p.get("download") or []] or [{"rotulo": "Gold de origem", "url": f"/energia/gold/{p['gold']}"}],
        reproducao=REPRODUCAO)


def _le_regras_publicadas():
    """{(data, regra): linha} e sha256 do CSV de estados diários como foi escrito em disco
    (leitura independente do que a avaliação montou em memória)."""
    linhas, sha = _le_csv(os.path.basename(U["regras"]))
    if not linhas:
        return {}, None
    return {(ln["data"], ln["regra"]): ln for ln in linhas}, sha


def _testes_csv_regra(o, csv_regras):
    """Conferências da regra contra o CSV publicado: a linha do dia (condição e valor) e o
    estado refeito a partir da coluna condicao do arquivo."""
    rid, ref = o["id"], o["referencia"]
    ln = csv_regras.get((ref, rid))
    v = (o.get("valor") or {}).get("valor")
    if not ln:
        t1 = ev.teste("linha do dia relida do CSV publicado", "reprovado", f"sem linha {ref} da regra {rid} em {U['regras']}")
    else:
        cond_ok = ln["condicao"] == ("1" if o["condicao_no_dia"] else "0")
        val_ok = (ln["valor"] == "" and v is None) or (ln["valor"] != "" and v is not None and abs(float(ln["valor"]) - v) <= 1e-4)
        t1 = ev.teste("linha do dia relida do CSV publicado", "aprovado" if cond_ok and val_ok else "reprovado",
                      f"{U['regras']}, {ref}: condicao {ln['condicao']!r}, valor {ln['valor']!r}; publicado: condição {o['condicao_no_dia']}, valor {v}")
    serie = sorted((d_, (None if x["condicao"] == "" else x["condicao"] == "1")) for (d_, r_), x in csv_regras.items() if r_ == rid)
    while serie and serie[-1][1] is None:
        serie.pop()
    if not serie:
        t2 = ev.teste("estado refeito a partir do CSV publicado", "reprovado", "sem série da regra no CSV")
    else:
        est = s.episodios(serie, o["duracao_minima_dias"], o["retorno_dias"])["estado"]
        t2 = ev.teste("estado refeito a partir do CSV publicado", "aprovado" if est == o["estado"] else "reprovado",
                      f"{len(serie)} dias da coluna condicao relidos do arquivo; estado {est}, publicado {o['estado']}")
    return [t1, t2]


def _evidencia_regra(o, ult, ctxe):
    """Evidência do número que a regra avalia no dia (nível, taxa, participação, amplitude,
    horas no limite, revisões), com numerador e denominador quando é razão."""
    rid = o["id"]
    v, li, ls = _num_regra(rid, ult)
    if v is None or ult is None:
        return None
    con_p, ref, det = ctxe["con_p"], o["referencia"], ult[2]
    h = o.get("historico") or {}
    num = den = rec = None
    filtros, chaves = [], []
    testes = _testes_csv_regra(o, ctxe["csv_regras"])
    download = [{"rotulo": "Estados diários das regras (CSV)", "url": U["regras"]}]
    if rid in ("ear_faixa", "ena_faixa"):
        ano = int(ref[:4])
        x = det["valores"]["SIN"]
        ins = ctxe["insumos"]
        if rid == "ear_faixa":
            ds, nome, url = "ear_subsistema_di", "EAR Diário por Subsistema", "https://dados.ons.org.br/dataset/ear-diario-por-subsistema"
            n_, d_ = sum(ins["ear_mwmes"][sm][ref] for sm in s.SMS), sum(ins["ear_max_mwmes"][sm][ref] for sm in s.SMS)
            num = {"descricao": f"EAR verificada dos quatro subsistemas em {ref} (Σ MWmês)", "valor": c.r(n_, 3)}
            den = {"descricao": f"EAR máxima dos quatro subsistemas em {ref} (Σ MWmês)", "valor": c.r(d_, 3)}
            formula = "EAR_SIN = 100 × Σ EAR verificada ÷ Σ EAR máxima; condição: EAR_SIN < 5º ou > 95º percentil do mesmo dia nos anos de 2001 ao anterior"
            un, ini = "% da EAR máxima", ref
            gold_v = next((y["ear"]["valor"] for y in ctxe["golds"]["hidrologia.json"]["subsistemas"] if y["sm"] == "SIN"), None)
        else:
            ds, nome, url = "ena_subsistema_di", "ENA Diário por Subsistema", "https://dados.ons.org.br/dataset/ena-diario-por-subsistema"
            dias = s.calendario((s.d(ref) - timedelta(days=29)).isoformat(), ref)
            mw, pc = ins["ena_bruta_mwmed"], ins["ena_bruta_pct_mlt"]
            n_ = sum(mw[sm][k] for sm in s.SMS for k in dias)
            d_ = sum(mw[sm][k] / (pc[sm][k] / 100.0) for sm in s.SMS for k in dias)
            num = {"descricao": f"ENA bruta dos quatro subsistemas de {dias[0]} a {ref} (Σ MWmed diários)", "valor": c.r(n_, 3)}
            den = {"descricao": "MLT implícita (ENA ÷ percentual da MLT) dos mesmos dias e subsistemas (Σ MWmed diários)", "valor": c.r(d_, 3)}
            formula = "ENA30_SIN = 100 × Σ ENA bruta ÷ Σ MLT implícita (30 dias); condição: < 5º ou > 95º percentil da mesma janela nos anos de 2001 ao anterior"
            un, ini = "% da MLT", dias[0]
            gold_v = next((y["ena"]["pct_mlt_30d"] for y in ctxe["golds"]["hidrologia.json"]["subsistemas"] if y["sm"] == "SIN"), None)
        vs = _vintages(con_p, ds, [str(a) for a in range(2001, ano + 1)])
        fonte = _fonte_evidencia("ONS", nome, url, vs)
        consulta = (f"silver energia.db, {ds}: séries dos quatro subsistemas em {ini} a {ref} (valor) e nas mesmas datas de 2001 a {ano - 1} "
                    f"(distribuição de {x['anos']} anos)")
        filtros = [f"5º percentil: {c.r(x['p_inf'], 2)}", f"95º percentil: {c.r(x['p_sup'], 2)}", f"mediana: {c.r(x['mediana'], 2)}",
                   f"anos na distribuição: {x['anos']} (2001 a {ano - 1})", f"faixa do dia: {x['faixa']}"]
        if gold_v is not None:
            rec = ev.reconciliacao(f"Valor do SIN refeito do silver ({c.r(v, 4)}) contra hidrologia.json ({gold_v}, uma casa)",
                                   "aprovado" if c.r(v, 1) == gold_v else "reprovado", "0,05 p.p. (meia unidade da casa publicada)")
        casas = 1
    elif rid in ("restricao_eolica", "restricao_solar"):
        fo = "eolica" if rid == "restricao_eolica" else "solar"
        ds = "ons_coff_eolica" if fo == "eolica" else "ons_coff_fotovoltaica"
        con = _abre_ro("ons_geracao")
        try:
            ms = sorted({(s.d(ref) - timedelta(days=i)).strftime("%Y_%m") for i in range(7)})
            vs = [x for x in _vintages(con, ds) if any(m in x["recurso"] for m in ms)]
        finally:
            if con is not None:
                con.close()
        fonte = _fonte_evidencia("ONS", "Restrição de operação por constrained-off de usinas " + ("eólicas" if fo == "eolica" else "fotovoltaicas"),
                                 f"https://dados.ons.org.br/dataset/{'restricao_coff_eolica_usi' if fo == 'eolica' else 'restricao_coff_fotovoltaica'}", vs)
        consulta = (f"public/energia/series/geracao_restricao_diaria.csv (sha256 {ctxe['sha_csv'].get('restricoes')}): linhas razao=TOTAL e "
                    f"fonte={fo}, de {(s.d(ref) - timedelta(days=6)).isoformat()} a {ref}, somadas nas regiões")
        n, dd = _restricao_diaria(ctxe["entradas"].get("restricoes"), fo)
        ks = [(s.d(ref) - timedelta(days=i)).isoformat() for i in range(7)]
        num = {"descricao": "energia não gerada estimada pelo ONS, 7 dias (MWh)", "valor": c.r(sum(n[k] for k in ks), 3)}
        den = {"descricao": "geração verificada + não gerada, 7 dias (MWh)", "valor": c.r(sum(dd[k] for k in ks), 3)}
        formula = "taxa_7d = 100 × Σ não gerada ÷ Σ (verificada + não gerada), 7 dias; condição: taxa_7d > 95º percentil das 365 janelas anteriores"
        filtros = [f"95º percentil das janelas anteriores: {c.r(ls, 4)}", f"mediana: {c.r(det.get('p50'), 4)}", f"janelas na base: {det.get('janelas')}"]
        download.append({"rotulo": "Restrições por dia, razão e origem (CSV)", "url": "/energia/series/geracao_restricao_diaria.csv"})
        un, ini, casas = "%", (s.d(ref) - timedelta(days=6)).isoformat(), 1
    elif rid in ("pld_piso", "pld_teto"):
        vs = _vintages(con_p, "ccee_pld_horario", [ref[:4]])
        fonte = _fonte_evidencia("CCEE", "PLD_HORARIO", "https://dadosabertos.ccee.org.br/dataset/pld_horario", vs)
        consulta = (f"public/energia/series/pld_limites_diario.csv (sha256 {ctxe['sha_csv'].get('limites')}), linhas de {ref} dos quatro "
                    f"submercados (contagem hora a hora feita pelo módulo PLD sobre o arquivo da CCEE)")
        lim = ctxe.get("lim_vig") or {}
        if rid == "pld_piso":
            hp = det["horas_no_piso"]
            filtros = [f"horas no piso {sm}: {hp[sm]}" for sm in s.SMS] + [f"PLD mínimo vigente: {det.get('pld_min')} ({lim.get('ato_pld_min') or 'ato na gold de Regulação'})"]
            formula = "condição = algum submercado com horas no piso (|PLD − mínimo| ≤ R$ 0,005/MWh) igual às horas do dia"
        else:
            ht, me = det["horas_no_teto_horario"], det["media_no_teto_estrutural"]
            filtros = ([f"horas no teto horário {sm}: {ht[sm]}" for sm in s.SMS] + [f"média no teto estrutural {sm}: {me[sm]}" for sm in s.SMS]
                       + [f"PLD máximo horário vigente: {det.get('pld_max_horario')} ({lim.get('ato_pld_max_horario') or 'ato na gold de Regulação'})",
                          f"PLD máximo estrutural vigente: {det.get('pld_max_estrutural')} ({lim.get('ato_pld_max_estrutural') or 'ato na gold de Regulação'})"])
            formula = "condição = algum submercado com hora no teto horário ou média diária no teto estrutural"
        if o.get("conferencia_limites"):
            rec = ev.reconciliacao("Limites do CSV do módulo PLD contra os atos vigentes publicados pela Regulação: " + o["conferencia_limites"]["detalhe"],
                                   o["conferencia_limites"]["resultado"], "R$ 0,005/MWh (valores em centavos)")
        download.append({"rotulo": "Horas no piso e no teto por dia e submercado (CSV)", "url": "/energia/series/pld_limites_diario.csv"})
        un, ini, casas = "horas", ref, 0
    elif rid == "revisao_material":
        janela = [k for k in (det.get("capturas") or {})]
        revs = [r for r in ctxe["revs"] if r["material"] and r.get("usada_na_pagina") and r["dia_captura"] in janela]
        # arquivos: as capturas comparáveis da janela (com ou sem revisão), lidas das vintages do silver
        vs, dss = [], set()
        for ds in DATASETS_OPERACAO:
            for rec_, url_, cap, pub_, sha_, arq in con_p.execute(
                    "SELECT recurso, url, capturado_em, publicado_em, sha256, arquivo FROM vintages WHERE dataset=? ORDER BY capturado_em", (ds,)):
                if _dia_brasilia(cap) in janela:
                    vs.append({"recurso": rec_, "url": url_, "capturado_em": cap, "publicado_em": pub_, "sha256": sha_, "arquivo": arq})
                    dss.add(ds)
        orgaos = sorted({"CCEE" if ds.startswith("ccee") else "ONS" for ds in dss}) or ["ONS"]
        fonte = _fonte_evidencia(" e ".join(orgaos), "conjuntos de operação da Visão geral (capturas com revisão material)",
                                 "https://dados.ons.org.br", vs)
        consulta = (f"{U['revisoes']}: linhas com material = 1, usada_na_pagina = 1 e dia_captura em {', '.join(sorted(janela)) or 'nenhum dia'}")
        por_serie = {}
        for r in revs:
            por_serie[r["serie"].split(".")[0]] = por_serie.get(r["serie"].split(".")[0], 0) + 1
        filtros = [f"{k}: {n}" for k, n in sorted(por_serie.items())]
        formula = "revisões materiais = contagem de (série usada, referência) cuja captura nos últimos 7 dias mudou o valor em ≥ 1% e ≥ o piso da unidade"
        pub, _ = _le_csv(os.path.basename(U["revisoes"]))
        recont = sum(1 for x in pub or [] if x["material"] == "1" and x.get("usada_na_pagina") == "1" and x["dia_captura"] in janela)
        testes.append(ev.teste("contagem refeita do CSV de revisões publicado", "aprovado" if recont == v else "reprovado",
                               f"{recont} linhas materiais em séries usadas no arquivo; publicado {v}"))
        download = [{"rotulo": "Revisões entre capturas (CSV)", "url": U["revisoes"]}] + download
        un, ini, casas = "revisões", min(janela) if janela else ref, 0
    else:
        ds = {"termica": "balanco_energia_subsistema_ho", "carga_extrema": "carga_energia_di", "descolamento": "ccee_pld_horario"}[rid]
        vs = _vintages(con_p, ds, [ref[:4]])
        orgao = "CCEE" if ds == "ccee_pld_horario" else "ONS"
        nome = {"termica": "Balanço de Energia nos Subsistemas", "carga_extrema": "Carga de Energia Diária", "descolamento": "PLD_HORARIO"}[rid]
        url = {"termica": "https://dados.ons.org.br/dataset/balanco-energia-subsistema", "carga_extrema": "https://dados.ons.org.br/dataset/carga-energia",
               "descolamento": "https://dadosabertos.ccee.org.br/dataset/pld_horario"}[rid]
        fonte = _fonte_evidencia(orgao, nome, url, vs)
        ini = (s.d(ref) - timedelta(days=6)).isoformat() if rid == "termica" else ref
        consulta = {"termica": f"geracao.json#serie_sin de {ini} a {ref} (SIN)",
                    "carga_extrema": (f"public/energia/series/carga_diaria.csv (sha256 {ctxe['sha_csv'].get('carga')}), coluna SIN_calculado, {ref} e os 364 dias anteriores"
                                      if ctxe["insumos"].get("carga_fonte") == "carga_diaria.csv" else f"carga.json#serie, SIN, {ref} e os 364 dias anteriores"),
                    "descolamento": f"pld.json#diario, {ref}, quatro submercados"}[rid]
        formula = {"termica": "participação_7d = 100 × Σ térmica ÷ Σ (hidráulica + térmica + eólica + solar), 7 dias; condição: < 5º ou > 95º percentil das 365 janelas anteriores",
                   "carga_extrema": "condição = carga(dia) > quantil 0,95 dos 364 dias anteriores",
                   "descolamento": "amplitude = max_s PLD_dia(s) − min_s PLD_dia(s); condição: amplitude ≥ max(R$ 5; 10% da média dos quatro)"}[rid]
        if rid == "termica":
            ger = ctxe["golds"].get("geracao.json") or {}
            por = {x["d"]: x for x in ger.get("serie_sin") or []}
            ks = s.calendario(ini, ref)
            if all(k in por for k in ks):
                n_ = sum(por[k]["termica"] for k in ks)
                d_ = sum(por[k][f] for k in ks for f in ("hidraulica", "termica", "eolica", "solar"))
                num = {"descricao": f"geração térmica do SIN de {ini} a {ref} (Σ MWmed diários de geracao.json#serie_sin)", "valor": c.r(n_, 3)}
                den = {"descricao": "geração hidráulica, térmica, eólica e solar do SIN, mesmos dias (Σ MWmed diários)", "valor": c.r(d_, 3)}
            filtros = [f"5º percentil: {c.r(li, 4)}", f"95º percentil: {c.r(ls, 4)}", f"mediana: {c.r(det.get('p50'), 4)}", f"janelas na base: {det.get('janelas')}"]
        elif rid == "carga_extrema":
            filtros = [f"95º percentil dos 364 dias anteriores: {c.r(ls, 2)}", f"dias na base: {det.get('dias_base')}",
                       f"série da base: {ctxe['insumos'].get('carga_fonte')}"]
            download.append({"rotulo": "Carga diária por subsistema e SIN (CSV)", "url": "/energia/series/carga_diaria.csv"})
        else:
            filtros = [f"limiar do dia: {c.r(ls, 4)}", f"média dos quatro: {c.r(det.get('media'), 4)}", f"maior: {det.get('maior')}", f"menor: {det.get('menor')}"]
        un = {"termica": "%", "carga_extrema": "MWmed", "descolamento": "R$/MWh"}[rid]
        casas = 0 if rid == "carga_extrema" else (2 if rid == "descolamento" else 1)
    exib = f"{s.nbr(v, casas)}{'%' if un.startswith('%') else ' ' + un}"
    return ev.construir(
        indicador=f"Regra '{rid}' do o que observar", valor_exibido=exib,
        valor_calculo=v, unidade=un, periodo={"inicio": ini, "fim": ref},
        entidade={"descolamento": "quatro submercados", "pld_piso": "quatro submercados", "pld_teto": "quatro submercados",
                  "revisao_material": "conjuntos da Visão geral"}.get(rid, "SIN"),
        universo=o["condicao"], fonte=fonte, consulta=consulta, chaves_origem=chaves, filtros=filtros, formula=formula,
        numerador=num, denominador=den,
        cobertura=(f"Histórico avaliável de {h.get('primeiro_dia_avaliado')} a {h.get('ultimo_dia_avaliado')}: {h.get('dias_avaliados')} dias "
                   f"com avaliação (série desde {h.get('inicio')})."),
        tratamento_ausencia="Dia sem dado ou sem base completa não é avaliado e interrompe a contagem de duração; nulo não vira zero.",
        revisoes="Reavaliado a cada processamento com os dados vigentes; ver a regra revisao_material.",
        testes=testes, reconciliacao=rec, download=download, reproducao=REPRODUCAO)


# ---------------------------------------------------------------- construção

NOMES_ORIGEM = ("pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json", "pld_detalhe.json",
                "regulacao.json", "geracao_detalhe.json", "conta.json", "qualidade.json", "perdas.json", "inclusao.json", "publicacao.json")


def _gerado_em_publicado(nome):
    """gerado_em do arquivo publicado em public/energia/gold, lido do cabeçalho (os primeiros
    bytes) sem carregar a gold inteira de novo."""
    caminho = os.path.join(base.GOLD, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        ini = f.read(4096)
    m = re.search(r'"gerado_em":\s*"([^"]+)"', ini)
    return m.group(1) if m else None


def _golds(ctx):
    """Golds desta execução (contexto do orquestrador); o que faltar vem do arquivo publicado."""
    golds = dict((ctx or {}).get("golds") or {})
    do_disco = []
    for nome in NOMES_ORIGEM:
        if nome not in golds:
            g = base.le_gold(nome)
            if g is not None:
                golds[nome] = g
                do_disco.append(nome)
    return golds, do_disco


def _origens(golds, do_disco, agora):
    """De onde veio cada gold lida: do contexto da execução (run.py ou executar_modulo) ou do
    arquivo publicado, se o conteúdo é o do arquivo publicado (mesmo gerado_em) e a idade
    da gold no momento da leitura."""
    out = []
    t = datetime.fromisoformat(agora.replace("Z", "+00:00"))
    for n in sorted(x for x in golds if x in NOMES_ORIGEM):
        g = golds[n] or {}
        pub = _gerado_em_publicado(n)
        ger = g.get("gerado_em")
        if n in do_disco:
            origem = "arquivo publicado (lido pela Visão geral; ausente do contexto da execução)"
        elif pub is not None and pub == ger:
            origem = "contexto da execução, igual ao arquivo publicado (mesmo gerado_em)"
        else:
            origem = "contexto da execução, diferente do arquivo publicado (gold construída nesta execução e ainda não publicada, ou rejeitada)"
        idade = None
        if ger:
            try:
                idade = c.r((t - datetime.fromisoformat(ger.replace("Z", "+00:00"))).total_seconds() / 3600.0, 1)
            except ValueError:
                idade = None
        out.append({"gold": n, "disponivel": _ok(g), "gerado_em": ger, "versao_codigo": g.get("versao_codigo"), "origem": origem,
                    "igual_ao_publicado": pub is not None and pub == ger, "arquivo_publicado_gerado_em": pub,
                    "lida_em": agora, "idade_horas": idade})
    return out


def _limites_vigentes(golds):
    reg = golds.get("regulacao.json")
    if not _ok(reg):
        return None
    v = (reg.get("limites_pld") or {}).get("vigente_hoje") or (reg.get("resumo") or {}).get("limites_hoje")
    return {**v, "fonte": "regulacao.json#limites_pld.vigente_hoje"} if v else None


def _csv_regras(linhas):
    base.escreve_csv(os.path.basename(U["regras"]), ["data", "regra", "condicao", "estado", "valor", "limiar_inferior", "limiar_superior", "detalhe"],
                     sorted(linhas, key=lambda x: (x[1], x[0])))


def construir(con, ctx):
    ctx = ctx or {}
    hoje = ctx.get("hoje") or c.hoje_brasilia()
    agora = base.agora_utc()
    golds, do_disco = _golds(ctx)
    operacao = [n for n in ("pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json") if _ok(golds.get(n))]
    if not operacao:
        return c.stub(GOLD, "nenhuma gold de operação disponível (PLD, hidrologia, carga, geração, rede)")
    # a publicação anterior aceita (arquivo em public/energia/gold) entra no registro das
    # emissões agora: só o que chegou ao leitor conta como alerta emitido
    registrou = registra_publicacao_aceita(con, base.le_gold(GOLD))
    con_p = ctx.get("con_principal")
    pub = golds.get("publicacao.json")
    conjuntos = {}
    if _ok(pub):
        # o mesmo dataset pode aparecer em mais de uma família (cópias de conferência): vale a
        # linha com situação de atualidade publicada, e entre elas a da família principal
        # o esquema de publicacao.json traz o dataset em dataset_silver ou no id "família/dataset"
        def chave(x):
            ident = str(x.get("id") or "")
            return (x.get("dataset_silver") or (ident.split("/", 1)[1] if "/" in ident else None),
                    x.get("familia") or (ident.split("/", 1)[0] if "/" in ident else None))

        for x in pub.get("conjuntos") or []:
            ds, fam = chave(x)
            if not ds:
                continue
            atual = conjuntos.get(ds)
            pontos = (bool((x.get("atualidade") or {}).get("situacao")), fam == "energia")
            if atual is None or pontos > (bool((atual.get("atualidade") or {}).get("situacao")), chave(atual)[1] == "energia"):
                conjuntos[ds] = x

    # revisões entre capturas no silver principal (qualidade das frases e regra revisao_material)
    revs, dias_comp, rev_por_conjunto = [], {}, None
    if con_p is not None:
        revs, dias_comp = revisoes_silver(con_p)
        rev_por_conjunto = {ds: [r for r in revs if r["dataset"] == ds] for ds in DATASETS_OPERACAO}

    # entradas publicadas pelos módulos PLD e Geração (mesmos números das páginas deles)
    lim_csv, sha_lim = _le_csv("pld_limites_diario.csv")
    rest_csv, sha_rest = _le_csv("geracao_restricao_diaria.csv")
    car_csv, sha_car = _le_csv("carga_diaria.csv")
    car = {ln["data"]: _num(ln["SIN_calculado"]) for ln in car_csv or []}
    entradas = {"limites": _limites_linhas(lim_csv) if lim_csv else None, "restricoes": rest_csv,
                "carga_diaria": {k: x for k, x in car.items() if x is not None} or None}
    sha_csv = {"limites": sha_lim, "restricoes": sha_rest, "carga": sha_car}

    # P004: frases
    fr = s.frases(golds, {"conjuntos": conjuntos, "revisoes_por_conjunto": rev_por_conjunto}, hoje)
    ausentes_frases = [fid for fid in s.ORDEM_FRASES if fid not in {f["id"] for f in fr}]

    # P007: condições de cada regra
    cond, controles, alternativas, insumos = condicoes_das_regras(golds, con_p, entradas)
    cr = condicao_revisoes(revs, dias_comp, hoje.isoformat()) if con_p is not None else None
    if cr:
        cond["revisao_material"] = cr

    # P005 e P006
    mult = multiplos(golds, hoje)
    conferidas, erros_mult = confere_multiplos(mult, golds) if mult else (0, ["sem painéis"])
    if erros_mult:
        return c.stub(GOLD, "pequenos múltiplos divergem das golds de origem: " + "; ".join(erros_mult[:5]))
    soc = sociedade(golds, conjuntos, hoje)

    # P007: estado e histórico de cada regra; a regra de atualidade avalia os conjuntos que
    # a página publica de fato
    com_dado = [k for k, v in cond.items() if v] + [rid for rid, gn in (("pld_defasagem", "pld.json"), ("cmo_semana", "cmo.json")) if _ok(golds.get(gn))]
    usados = conjuntos_usados(fr, mult, soc, com_dado)
    observar, linhas_csv, linhas_ep, exibidos, regras_sem_dado, ultimos, alt_alertas = avaliar_regras(
        golds, cond, conjuntos, hoje, alternativas, usados)
    lim_vig = _limites_vigentes(golds)
    for o in observar:
        if o["id"] in ("pld_piso", "pld_teto") and lim_vig:
            o["limites_vigentes"] = lim_vig
            # conferência: limite do CSV do módulo PLD igual ao ato vigente publicado pela Regulação
            ult = next((ln for ln in reversed(entradas["limites"] or []) if ln["sm"] == "SE"), None)
            if ult:
                pares = [(ult["pld_min"], lim_vig["pld_min"]), (ult["pld_max_horario"], lim_vig["pld_max_horario"]),
                         (ult["pld_max_estrutural"], lim_vig["pld_max_estrutural"])]
                iguais = all(a is not None and b is not None and abs(a - b) < 0.005 for a, b in pares)
                o["conferencia_limites"] = {"resultado": "aprovado" if iguais else "ressalva",
                                            "detalhe": (f"pld_limites_diario.csv em {ult['data']}: mínimo {ult['pld_min']}, máximo horário {ult['pld_max_horario']}, "
                                                        f"estrutural {ult['pld_max_estrutural']}; regulacao.json em {lim_vig['data']}: {lim_vig['pld_min']}, "
                                                        f"{lim_vig['pld_max_horario']}, {lim_vig['pld_max_estrutural']} (tolerância R$ 0,005/MWh: valores em centavos)")}

    # validação física e de domínio (contrato 5.2): violação crítica vira stub, antes de escrever qualquer arquivo
    validacao = []
    for f in fr:
        if s.texto_de(s.MODELOS[f["id"]](f["valores"])) != f["texto"]:
            return c.stub(GOLD, f"frase {f['id']} não se refaz a partir dos valores publicados")
    for p in (mult or {}).get("paineis", []):
        if p["data_referencia"] > (s.d(hoje.isoformat()) + timedelta(days=1)).isoformat():
            return c.stub(GOLD, f"painel {p['id']} com data de referência além do horizonte da fonte: {p['data_referencia']}")
    for linha in (mult or {}).get("dados", []):
        for k in ("agua_SIN", "geracao_termica_7d"):
            v = linha.get(k)
            if v is not None and not (0 <= v <= 100):
                return c.stub(GOLD, f"{k} fora de 0 a 100 em {linha['d']}: {v}")
        v = linha.get("carga_SIN")
        if v is not None and v <= 0:
            return c.stub(GOLD, f"carga não positiva em {linha['d']}")
    validacao.append({"nome": "P005: cada célula igual à gold de origem", "resultado": "aprovado", "detalhe": f"{conferidas} células conferidas"})

    # downloads (depois das validações que viram stub: arquivo e gold andam juntos)
    _csv_regras(linhas_csv)
    base.escreve_csv(os.path.basename(U["episodios"]), ["regra", "inicio", "confirmado_em", "fim", "normalizado_em", "dias_condicao", "duracao_dias", "em_curso"], linhas_ep)
    if mult:
        cols = ["d"] + [k for k in mult["dados"][0] if k != "d"]
        base.escreve_csv(os.path.basename(U["multiplos"]), cols, [[ln.get(k) for k in cols] for ln in mult["dados"]])
    base.escreve_csv(os.path.basename(U["revisoes"]),
                     ["dataset", "serie", "ref", "valor_anterior", "valor_novo", "diferenca", "diferenca_relativa_pct", "unidade", "material",
                      "usada_na_pagina", "capturado_anterior", "capturado_novo", "dia_captura"],
                     [[r["dataset"], r["serie"], r["ref"], r["de"], r["para"], r["diferenca"], r["relativa_pct"], r["unidade"],
                       1 if r["material"] else 0, 1 if r["usada_na_pagina"] else 0, r["capturado_de"], r["capturado_para"], r["dia_captura"]] for r in revs])

    # evidências: as das regras releem o CSV que acabou de ser escrito; as das frases refazem o número no silver
    for f in fr:
        try:
            f["evidencia"] = _evidencia_frase(f, golds, con_p)
        except ev.EvidenciaInvalida as e:
            f["evidencia"] = None
            f["evidencia_problemas"] = e.problemas
    for p in (mult or {}).get("paineis", []):
        p["valor_atual"]["valor_exibido"] = valor_exibido_painel(p)
        try:
            p["evidencia"] = _evidencia_painel(p, golds, con_p, mult["dados"])
        except ev.EvidenciaInvalida as e:
            p["evidencia"] = None
            p["evidencia_problemas"] = e.problemas
    csv_regras, sha_regras = _le_regras_publicadas()
    ctxe = {"con_p": con_p, "entradas": entradas, "sha_csv": sha_csv, "insumos": insumos, "csv_regras": csv_regras,
            "lim_vig": lim_vig, "revs": revs, "golds": golds}
    for o in observar:
        o["evidencia_numero"] = None
        if o["tipo"] != "regra":
            continue
        try:
            o["evidencia_numero"] = _evidencia_regra(o, ultimos.get(o["id"]), ctxe)
        except ev.EvidenciaInvalida as e:
            o["evidencia_problemas"] = e.problemas

    # registro das publicações aceitas e conferência com a reavaliação de hoje
    nao_conf = confere_emissoes(con, observar, exibidos)
    dest = destaques(observar)
    freq = frequencia_destaques(observar, exibidos, alt_alertas)
    dest["frequencia_conjunta"] = freq

    # toda medida citada tem definição no catálogo (falha de outro módulo no catálogo não derruba a síntese)
    try:
        from pipeline.energia import metricas
        ids = {m["id"] for m in metricas.todas()}
        citadas = {o.get("metrica") for o in observar if o.get("metrica")} | {p["metrica"] for p in (mult or {}).get("paineis", [])} | \
                  {i["metrica"] for i in soc["itens"]} | {"visao_frequencia_conjunta_destaques"}
        faltam = sorted(x for x in citadas if x not in ids)
        validacao.append({"nome": "medidas citadas existem no catálogo de métricas", "resultado": "aprovado" if not faltam else "ressalva",
                          "detalhe": f"{len(citadas)} medidas; sem definição: {faltam}"})
    except Exception as e:  # catálogo inválido por outro módulo: registra e segue
        validacao.append({"nome": "medidas citadas existem no catálogo de métricas", "resultado": "ressalva", "detalhe": f"catálogo indisponível: {e}"[:300]})
    validacao.append({"nome": "P004: frases refeitas a partir dos valores", "resultado": "aprovado", "detalhe": f"{len(fr)} frases"})
    if freq:
        validacao.append({"nome": "P004: caixa de destaques ocupada em no máximo um terço dos dias do período comum",
                          "resultado": "aprovado" if freq["atende_meta"] else "ressalva",
                          "detalhe": (f"{freq['periodo_comum']['dias_com_destaque']} de {freq['periodo_comum']['dias']} dias "
                                      f"({freq['periodo_comum']['pct_dias_com_destaque']}%) de {freq['periodo_comum']['inicio']} a "
                                      f"{freq['periodo_comum']['fim']}; meta {freq['meta_pct']}%")})
    validacao.extend(controles)
    for o in observar:
        if o.get("conferencia_limites"):
            validacao.append({"nome": f"{o['id']}: limites do CSV do PLD iguais aos da Regulação", **o["conferencia_limites"]})
    validacao.append({"nome": "alertas publicados antes e não confirmados após revisão", "resultado": "aprovado" if not nao_conf else "ressalva",
                      "detalhe": f"{len(nao_conf)} casos"})
    for o in observar:
        if o.get("evidencia_problemas"):
            validacao.append({"nome": f"evidência da regra {o['id']}", "resultado": "ressalva", "detalhe": "; ".join(o["evidencia_problemas"])[:400]})
        ev_ = o.get("evidencia_numero") or {}
        ruins = [t for t in ev_.get("testes") or [] if t["resultado"] != "aprovado"] + \
                ([ev_["reconciliacao"]] if (ev_.get("reconciliacao") or {}).get("resultado") not in (None, "aprovado") else [])
        if ruins:
            validacao.append({"nome": f"evidência da regra {o['id']}: conferências", "resultado": "ressalva",
                              "detalhe": "; ".join(f"{t.get('nome') or t.get('descricao')}: {t['resultado']}" for t in ruins)[:400]})
    for p in (mult or {}).get("paineis", []):
        if p.get("evidencia_problemas"):
            validacao.append({"nome": f"evidência do determinante {p['id']}", "resultado": "ressalva", "detalhe": "; ".join(p["evidencia_problemas"])[:400]})
        ev_ = p.get("evidencia") or {}
        ruins = [t for t in ev_.get("testes") or [] if t["resultado"] != "aprovado"] + \
                ([ev_["reconciliacao"]] if (ev_.get("reconciliacao") or {}).get("resultado") not in (None, "aprovado") else [])
        if ruins:
            validacao.append({"nome": f"evidência do determinante {p['id']}: conferências", "resultado": "ressalva",
                              "detalhe": "; ".join(f"{t.get('nome') or t.get('descricao')}: {t['resultado']}" for t in ruins)[:400]})
    for f in fr:
        if f.get("evidencia_problemas"):
            validacao.append({"nome": f"evidência da frase {f['id']}", "resultado": "ressalva", "detalhe": "; ".join(f["evidencia_problemas"])[:400]})
        ev_ = f.get("evidencia") or {}
        ruins = [t for t in ev_.get("testes") or [] if t["resultado"] != "aprovado"] + \
                ([ev_["reconciliacao"]] if (ev_.get("reconciliacao") or {}).get("resultado") not in (None, "aprovado") else [])
        if ruins:
            validacao.append({"nome": f"evidência da frase {f['id']}: conferências", "resultado": "ressalva",
                              "detalhe": "; ".join(f"{t.get('nome') or t.get('descricao')}: {t['resultado']}" for t in ruins)[:400]})

    resumo_rev = []
    for ds in DATASETS_OPERACAO:
        rr = [r for r in revs if r["dataset"] == ds]
        mat = [r for r in rr if r["material"]]
        mat_u = [r for r in mat if r["usada_na_pagina"]]
        maior = max(mat_u, key=lambda r: abs(r["diferenca"]) if r["relativa_pct"] is None else r["relativa_pct"], default=None)
        resumo_rev.append({"dataset": ds, "revisoes": len(rr), "materiais": len(mat), "materiais_em_series_usadas": len(mat_u),
                           "referencias_de": min((r["ref"] for r in rr), default=None), "referencias_ate": max((r["ref"] for r in rr), default=None),
                           "dias_de_captura": sorted({r["dia_captura"] for r in rr}),
                           "maior_material": {k: maior[k] for k in ("serie", "ref", "de", "para", "relativa_pct", "unidade", "capturado_para")} if maior else None,
                           "dias_comparaveis": dias_comp.get(ds, [])})
    rev_modulos = []
    for ds in ("aneel_tarifas_aplicacao", "aneel_continuidade", "aneel_samp_balanco", "aneel_scs", "aneel_componentes_tarifarias_b1"):
        r = (conjuntos.get(ds) or {}).get("revisoes")
        if r is not None:
            rev_modulos.append({"dataset": ds, "eventos": r.get("eventos"), "referencias_de": r.get("ref_min"), "referencias_ate": r.get("ref_max"),
                                "maior_relativa_pct": (r.get("maior_rel") or {}).get("relativa_pct"), "por_captura": r.get("por_captura"),
                                "fonte": "publicacao.json#conjuntos[].revisoes"})

    sintese_regras = {"ativas": [o["id"] for o in observar if o["tipo"] != "evento" and o.get("ativo")],
                      "em_observacao": [o["id"] for o in observar if o.get("estado") == "em_observacao"],
                      "total_regras": len([o for o in observar if o["tipo"] != "evento"])}
    g = {
        **c.cabecalho(GOLD),
        "modulo": "visao",
        "paineis": ["P004", "P005", "P006", "P007"],
        "data_processamento": hoje.isoformat(),
        "fuso_processamento": "America/Sao_Paulo (data civil de Brasília; comum.hoje_brasilia)",
        "processado_em": agora,
        "frases": fr,
        "frases_ausentes": ausentes_frases,
        "destaques": dest,
        "fatos_e_hipoteses": ("Frases e destaques são fatos: cada número vem de uma gold de origem com caminho e versão. Hipóteses "
                              "aparecem só nos destaques, rotuladas, como lista fixa por regra, sem teste nesta página; o link indica "
                              "onde os dados para verificá-las estão."),
        "multiplos": mult,
        "sociedade": soc,
        "observar": observar,
        "observar_resumo": sintese_regras,
        "observar_sem_dado": regras_sem_dado,
        "alertas_nao_confirmados": nao_conf[:20],
        "revisoes": {"operacao": resumo_rev, "modulos": rev_modulos,
                     "series_da_pagina": sorted(SERIES_PAGINA),
                     "regra_material": REGRAS[[r["id"] for r in REGRAS].index("revisao_material")]["condicao"],
                     "download": [{"rotulo": "Revisões entre capturas (CSV)", "url": U["revisoes"]}]},
        "origens": _origens(golds, do_disco, agora),
        "historico_regras": {"inicio": INICIO_HISTORICO,
                             "regra": ("Cada regra é reavaliada em todos os dias desde 01/01/2021 com os dados vigentes hoje (já revisados): "
                                       "mostra quantas vezes teria disparado e por quanto tempo, não o que se via na época. Cada regra só é "
                                       "avaliável quando a base dela existe (primeiro_dia_avaliado no histórico de cada uma). O registro dos "
                                       "alertas publicados fica no silver sintese, conjunto _visao_alertas, gravado a partir da gold aceita."),
                             "registro_publicacoes": {"publicacao_anterior_registrada_nesta_execucao": registrou},
                             "falso_alarme": ("Não há verdade de referência para chamar um alerta de falso. Publicam-se a frequência de "
                                              "disparo, os acionamentos curtos que a duração mínima descartou, a sensibilidade a outras "
                                              "durações, a frequência conjunta da caixa de destaques e, com o registro das publicações, os "
                                              "alertas que deixaram de se confirmar quando a fonte revisou os dados.")},
        "validacao": validacao,
        "nota": "Frases e alertas montados por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada número leva à evidência.",
        "downloads": [{"rotulo": "Estados diários das regras desde 2021 (CSV)", "url": U["regras"]},
                      {"rotulo": "Episódios de alerta das regras (CSV)", "url": U["episodios"]},
                      {"rotulo": "Determinantes alinhados, últimos 90 dias (CSV)", "url": U["multiplos"]},
                      {"rotulo": "Revisões entre capturas das séries da Visão geral (CSV)", "url": U["revisoes"]}],
        "limitacoes": [
            "A síntese reutiliza os números das golds de origem; limitações de cada fonte valem aqui e estão na proveniência de cada painel de origem.",
            "O histórico das regras usa os dados de hoje, já revisados; não reproduz o que um leitor via em cada data passada.",
            "Cada regra tem o próprio histórico avaliável (primeiro_dia_avaliado e dias_avaliados): a carga extrema só é avaliada com os 364 dias anteriores no mesmo regime do ONS (de 01/01 a 28/02/2021, de 28/02/2022 a 28/04/2023 e desde 27/04/2024); a térmica, a restrição eólica e a fotovoltaica começam depois de 2021 por exigirem 365 janelas anteriores no mesmo regime ou universo.",
            "As revisões entre capturas só existem a partir das capturas versionadas (silver principal desde 27/09/2026); antes disso não há como medi-las.",
            "Restrições de eólicas e fotovoltaicas usam a geração possível estimada pelo ONS; o registro fotovoltaico começa em abril de 2024.",
            "Os indicadores de energia e sociedade têm períodos de referência diferentes (vigência, ano, mês) e não descrevem o dia.",
        ],
    }
    return g
