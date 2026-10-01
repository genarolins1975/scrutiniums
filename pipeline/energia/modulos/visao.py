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
  efetivamente emitidos em cada processamento (silver `sintese`, conjunto interno
  `_visao_alertas`), para medir quantos deixaram de se confirmar quando os dados foram
  revisados. Alerta descreve condição medida; não implica causa.

Execução: python3 pipeline/energia/executar_modulo.py visao (não há coleta; `--sem-coleta`
dá o mesmo resultado).
"""
import csv
import hashlib
import json
import os
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
REVISAO_PISO = {"pct": 0.1, "MW": 10.0, "R$": 0.01}  # e variação absoluta mínima, por unidade

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
                      "o = condição sem a duração mínima, . = normal, - = sem dado); valor (número avaliado, na unidade da regra; "
                      "vazio quando a regra avalia vários subsistemas); limiar_inferior e limiar_superior (na mesma unidade; vazio "
                      "quando não se aplica); detalhe (texto: subsistemas fora da faixa, submercados no limite, capturas)"),
        U["episodios"]: ("regra; inicio (primeiro dia com a condição); confirmado_em (dia em que a duração mínima foi atingida); "
                         "fim (último dia com a condição); normalizado_em (dia em que o retorno foi confirmado; vazio = em curso); "
                         "dias_condicao (dias com a condição dentro do episódio); duracao_dias (de início a fim, inclusive); "
                         "em_curso (1/0)"),
        U["multiplos"]: ("d (data); preco_SE, preco_S, preco_NE, preco_N (PLD médio diário, R$/MWh, de pld.json#diario); "
                         "agua_SIN (EAR do SIN, % da EAR máxima, de hidrologia.json#serie_ear) e agua_p10, agua_p90 (faixa da data, "
                         "de hidrologia.json#bandas_ear); geracao_termica_7d (participação térmica em 7 dias, %, de "
                         "geracao.json#serie_termica_7d); carga_SIN e carga_ano_anterior (MWmed, de carga.json#serie; ano anterior "
                         "= mesma data do calendário, só no mesmo regime); rede_N_NE, rede_N_SE, rede_NE_SE, rede_S_SE (fluxo médio "
                         "diário, MWmed, positivo da primeira para a segunda ponta, de rede.json#serie_fluxos). Vazio = sem dado "
                         "naquela data (nunca zero)."),
        U["revisoes"]: ("dataset; serie; ref; valor_anterior; valor_novo; diferenca (na unidade da série); diferenca_relativa_pct; "
                        "unidade (p.p., MW ou R$); material (1 quando |diferença| ≥ 1% do valor anterior e ≥ o piso da unidade: "
                        "0,1 p.p., 10 MWmed ou MWmês, R$ 0,01/MWh); capturado_anterior; capturado_novo (UTC); dia_captura "
                        "(Brasília)"),
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
    {"id": "ear_faixa", "tipo": "regra", "titulo": "Armazenamento fora da faixa usual para a data",
     "condicao": "EAR do SIN abaixo do 10º ou acima do 90º percentil do mesmo dia do calendário nos anos completos anteriores (desde 2001).",
     "limiar": "10º e 90º percentis da data para o SIN (mesma regra de hidrologia.json)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos com o SIN dentro da faixa.",
     "materialidade": ("A faixa usual contém 80% dos anos para a data. A EAR muda devagar: 7 dias seguidos fora dela separam situação "
                       "persistente de oscilação perto da borda. A regra olha o SIN: com os quatro subsistemas, algum deles fica fora da "
                       "faixa em cerca de sete de cada dez dias desde 2021 (alternativa publicada com a frequência), o que é ruído para "
                       "a síntese; o detalhe por subsistema vai no texto e no painel Água."),
     "nao_implica": "Fora da faixa usual não quer dizer risco de suprimento nem explica o preço; a capacidade máxima de armazenamento mudou ao longo do tempo.",
     "hipoteses": [{"texto": "Afluência acima ou abaixo da média nas semanas anteriores", "onde_verificar": "/setor-eletrico/agua-e-clima#ena"},
                   {"texto": "Mudança no uso da água para geração (despacho hidráulico)", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/agua-e-clima#padrao", "gold": "hidrologia.json", "metrica": "visao_regra_ear_faixa",
     "dataset": "ear_subsistema_di", "unidade": "% da EAR máxima"},
    {"id": "ena_faixa", "tipo": "regra", "titulo": "Afluência de 30 dias fora da faixa usual",
     "condicao": "ENA do SIN acumulada em 30 dias (% da MLT) abaixo do 10º ou acima do 90º percentil da mesma janela nos anos completos anteriores (desde 2001).",
     "limiar": "10º e 90º percentis da mesma janela para o SIN (mesma regra de hidrologia.json)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos com o SIN dentro da faixa.",
     "materialidade": ("A janela de 30 dias já suaviza eventos curtos; 7 dias seguidos fora da faixa indicam um mês persistentemente "
                       "úmido ou seco frente à mesma janela dos anos anteriores. Com os quatro subsistemas a regra dispararia em cerca de dois de cada três "
                       "dias desde 2021 (alternativa publicada), por isso a síntese olha o SIN."),
     "nao_implica": "Afluência fora da faixa não diz quanto vira armazenamento nem como o preço reage.",
     "hipoteses": [{"texto": "Chuva acima ou abaixo da média nas bacias", "onde_verificar": "/setor-eletrico/agua-e-clima"}],
     "href": "/setor-eletrico/agua-e-clima#ena", "gold": "hidrologia.json", "metrica": "visao_regra_ena_faixa",
     "dataset": "ena_subsistema_di", "unidade": "% da MLT"},
    {"id": "termica", "tipo": "regra", "titulo": "Participação térmica incomum",
     "condicao": "Participação térmica dos últimos 7 dias acima do 90º ou abaixo do 10º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes, todas no regime do balanço iniciado em 29/04/2023.",
     "limiar": "10º e 90º percentis das 365 janelas anteriores (geracao.json#termica_contexto)",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos dentro da faixa.",
     "materialidade": "A janela de 7 dias tira o ciclo da semana; 7 dias seguidos fora da faixa evitam que uma semana atípica isolada vire alerta.",
     "nao_implica": "Participação térmica alta ou baixa não indica, sozinha, escassez de água nem custo maior para o consumidor.",
     "hipoteses": [{"texto": "Despacho por razão elétrica, por segurança energética ou por ordem de mérito", "onde_verificar": "/setor-eletrico/geracao"},
                   {"texto": "Variação da geração hidráulica, eólica ou solar", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/geracao#termica", "gold": "geracao.json", "metrica": "visao_regra_termica",
     "dataset": "balanco_energia_subsistema_ho", "unidade": "% da geração verificada"},
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
     "href": "/setor-eletrico/pld#submercados", "gold": "pld.json", "metrica": "visao_regra_descolamento",
     "dataset": "ccee_pld_horario", "unidade": "R$/MWh"},
    {"id": "pld_piso", "tipo": "regra", "titulo": "PLD no piso o dia inteiro",
     "condicao": "Algum submercado com as 24 horas do dia no PLD mínimo vigente (igual ao centavo).",
     "limiar": "PLD mínimo do ano (ato da ANEEL), conferido hora a hora no módulo PLD",
     "duracao_minima_dias": 3, "retorno_dias": 3,
     "regra_retorno": "Volta ao normal depois de 3 dias seguidos em que nenhum submercado passa o dia inteiro no piso.",
     "materialidade": "O piso é limite regulatório: um dia inteiro nele indica que o limite, e não o custo marginal, determinou o preço em todas as horas; 3 dias seguidos tiram dias isolados de carga baixa.",
     "nao_implica": "Preço no piso não quer dizer energia sem custo nem sobra garantida de água.",
     "hipoteses": [{"texto": "Custo marginal de operação abaixo do piso (CMO do DESSEM)", "onde_verificar": "/setor-eletrico/pld#formacao"}],
     "href": "/setor-eletrico/pld#limites", "gold": "pld_detalhe.json", "metrica": "visao_regra_pld_piso",
     "dataset": "ccee_pld_horario", "unidade": "horas"},
    {"id": "pld_teto", "tipo": "regra", "titulo": "PLD no teto horário ou estrutural",
     "condicao": "Alguma hora no PLD máximo horário ou média diária no PLD máximo estrutural, em algum submercado.",
     "limiar": "PLD máximo horário e estrutural do ano (ato da ANEEL)",
     "duracao_minima_dias": 1, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos sem hora no teto horário e sem média no teto estrutural.",
     "materialidade": "Atingir o teto é material por definição (o limite regulatório determinou o preço); por isso basta um dia, e o retorno exige uma semana para não alternar o alerta.",
     "nao_implica": "Preço no teto não identifica a causa nem indica, sozinho, risco de suprimento.",
     "hipoteses": [{"texto": "Custo marginal acima do teto em horas de carga alta", "onde_verificar": "/setor-eletrico/pld#formacao"}],
     "href": "/setor-eletrico/pld#limites", "gold": "pld_detalhe.json", "metrica": "visao_regra_pld_teto",
     "dataset": "ccee_pld_horario", "unidade": "horas"},
    {"id": "restricao_eolica", "tipo": "regra", "titulo": "Restrição de geração eólica acima do usual",
     "condicao": "Taxa de restrição eólica do SIN em 7 dias (energia não gerada ÷ geração verificada mais não gerada) acima do 90º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.",
     "limiar": "90º percentil das 365 janelas anteriores",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos abaixo do 90º percentil.",
     "materialidade": "Comparação com o próprio último ano, porque a taxa cresceu muito desde 2021; 7 dias seguidos separam mudança persistente de dias de vento atípico.",
     "nao_implica": "A taxa vem de estimativa do ONS da geração possível; restrição alta não identifica sozinha a razão (elétrica, energética ou de confiabilidade).",
     "hipoteses": [{"texto": "Limitação de transmissão no Nordeste (razão elétrica)", "onde_verificar": "/setor-eletrico/geracao"},
                   {"texto": "Sobra de energia frente à carga (razão energética)", "onde_verificar": "/setor-eletrico/geracao"}],
     "href": "/setor-eletrico/geracao", "gold": "geracao_detalhe.json", "metrica": "visao_regra_restricao",
     "dataset": "ons_coff_eolica", "unidade": "% da geração possível"},
    {"id": "restricao_solar", "tipo": "regra", "titulo": "Restrição de geração solar centralizada acima do usual",
     "condicao": "Taxa de restrição fotovoltaica do SIN em 7 dias acima do 90º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.",
     "limiar": "90º percentil das 365 janelas anteriores",
     "duracao_minima_dias": 7, "retorno_dias": 7,
     "regra_retorno": "Volta ao normal depois de 7 dias seguidos abaixo do 90º percentil.",
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
     "hipoteses": [], "href": "/setor-eletrico/pld#formacao", "gold": "cmo.json", "metrica": None,
     "dataset": "cmo_se", "unidade": "R$/MWh"},
]

# conjuntos da Visão geral no silver principal (qualidade das frases e revisões)
DATASETS_OPERACAO = ("ear_subsistema_di", "ena_subsistema_di", "carga_energia_di", "balanco_energia_subsistema_ho",
                     "intercambio_nacional_ho", "ccee_pld_horario", "cmo_se")


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


def _unidade_serie(serie):
    p = serie.split(".")[0]
    if "pct" in p:
        return "p.p.", REVISAO_PISO["pct"]
    if p.startswith(("pld", "cmo")):
        return "R$", REVISAO_PISO["R$"]
    return "MW", REVISAO_PISO["MW"]


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
                             "material": material(serie, ant[2], valor), "capturado_de": ant[3], "capturado_para": cap,
                             "dia_captura": _dia_brasilia(cap)})
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
            x = s.d(k)
            try:
                ka = x.replace(year=x.year - 1).isoformat()
            except ValueError:  # 29/02 não tem a mesma data no ano anterior
                ka = None
            mesmo = ka is not None and s.regime_de(ka, regimes) == s.regime_de(k, regimes)
            linhas[k]["carga_ano_anterior"] = (sc.get(ka) or {}).get("SIN") if mesmo else None
        sin = next(x for x in carga["subsistemas"] if x["sm"] == "SIN")
        paineis.append({
            "id": "carga", "titulo": "Carga", "pergunta": "Quanto o sistema está consumindo?",
            "metrica": "visao_carga_diaria_sin", "unidade": "MWmed", "casas": 0,
            "colunas": [{"id": "carga_SIN", "rotulo": "Carga do SIN"}],
            "referencia": {"tipo": "serie", "rotulo": "Mesma data do ano anterior (só no mesmo regime metodológico)",
                           "coluna": "carga_ano_anterior", "caminho": "carga.json#serie (data − 1 ano)"},
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


def _limites_linhas(linhas):
    out = []
    for ln in linhas or []:
        out.append({"data": ln["data"], "sm": ln["sm"], "horas": int(ln["horas"]) if ln["horas"] else None,
                    "horas_no_piso": int(ln["horas_no_piso"]) if ln["horas_no_piso"] else 0,
                    "horas_no_teto_horario": int(ln["horas_no_teto_horario"]) if ln["horas_no_teto_horario"] else 0,
                    "media_no_teto_estrutural": int(ln["media_no_teto_estrutural"]) if ln["media_no_teto_estrutural"] else 0,
                    "pld_min": _num(ln["pld_min"]), "pld_max_horario": _num(ln["pld_max_horario"]),
                    "pld_max_estrutural": _num(ln["pld_max_estrutural"]), "pld_media_dia": _num(ln["pld_media_dia"])})
    return out


def condicoes_das_regras(golds, con_p, entradas):
    """{regra: (série de condições com detalhe, controles)} para as regras com histórico."""
    out, controles = {}, []
    hid, ger, carga, pld = (golds.get(k) for k in ("hidrologia.json", "geracao.json", "carga.json", "pld.json"))
    alternativas = {}
    if con_p is not None and _ok(hid):
        todos = s.SMS + ("SIN",)
        ear = {sm: _serie(con_p, "ear_subsistema_di", f"ear_pct.{sm}") for sm in s.SMS}
        ear_mw = {sm: _serie(con_p, "ear_subsistema_di", f"ear_mwmes.{sm}") for sm in s.SMS}
        ear_mx = {sm: _serie(con_p, "ear_subsistema_di", f"ear_max_mwmes.{sm}") for sm in s.SMS}
        ear["SIN"] = s.ear_sin(ear_mw, ear_mx)
        fim = hid["dia_referencia_ear"]
        serie = s.condicoes_ear(ear, INICIO_HISTORICO, fim, entidades=("SIN",))
        out["ear_faixa"] = serie
        # variante rejeitada (algum dos quatro subsistemas): publicada com a frequência que a reprovou
        alternativas["ear_faixa"] = ("qualquer_subsistema", "Algum dos quatro subsistemas fora da faixa usual da data (regra anterior da síntese).",
                                     s.condicoes_ear(ear, INICIO_HISTORICO, fim, entidades=s.SMS))
        ult = s.condicoes_ear(ear, fim, fim, entidades=todos)[-1]
        gold = {x["sm"]: x["ear"]["faixa"] for x in hid["subsistemas"]}
        calc = {sm: ult[2]["valores"].get(sm, {}).get("faixa") for sm in todos}
        controles.append({"nome": "ear_faixa: faixa do dia (SIN e subsistemas) igual à de hidrologia.json",
                          "resultado": "aprovado" if gold == calc else "ressalva", "detalhe": f"gold {gold}; reavaliada {calc}"})
        ena_mw = {sm: _serie(con_p, "ena_subsistema_di", f"ena_bruta_mwmed.{sm}") for sm in s.SMS}
        ena_pc = {sm: _serie(con_p, "ena_subsistema_di", f"ena_bruta_pct_mlt.{sm}") for sm in s.SMS}
        mw_sin, pct_sin = s.ena_sin(ena_mw, ena_pc)
        e30 = {sm: s.ena30_serie(ena_mw[sm], ena_pc[sm]) for sm in s.SMS}
        e30["SIN"] = s.ena30_serie(mw_sin, pct_sin)
        fim = hid["dia_referencia_ena"]
        serie = s.condicoes_ena(e30, INICIO_HISTORICO, fim, entidades=("SIN",))
        out["ena_faixa"] = serie
        alternativas["ena_faixa"] = ("qualquer_subsistema", "Algum dos quatro subsistemas fora da faixa usual da janela (regra anterior da síntese).",
                                     s.condicoes_ena(e30, INICIO_HISTORICO, fim, entidades=s.SMS))
        ult = s.condicoes_ena(e30, fim, fim, entidades=todos)[-1]
        gold = {x["sm"]: x["ena"]["faixa_30d"] for x in hid["subsistemas"]}
        calc = {sm: ult[2]["valores"].get(sm, {}).get("faixa") for sm in todos}
        vals = {sm: (c.r(ult[2]["valores"].get(sm, {}).get("valor"), 1),
                     next(x["ena"]["pct_mlt_30d"] for x in hid["subsistemas"] if x["sm"] == sm)) for sm in todos}
        controles.append({"nome": "ena_faixa: faixa e ENA de 30 dias (SIN e subsistemas) iguais às de hidrologia.json",
                          "resultado": "aprovado" if gold == calc and all(a == b for a, b in vals.values()) else "ressalva",
                          "detalhe": f"faixas gold {gold}, reavaliadas {calc}; ENA 30 dias (reavaliada, gold) {vals}"})
    if _ok(ger) and ger.get("serie_sin"):
        fontes = ("hidraulica", "termica", "eolica", "solar")
        num = {x["d"]: x["termica"] for x in ger["serie_sin"] if all(x.get(f) is not None for f in fontes)}
        den = {x["d"]: sum(x[f] for f in fontes) for x in ger["serie_sin"] if all(x.get(f) is not None for f in fontes)}
        serie = s.condicoes_janela_movel(num, den, INICIO_HISTORICO, ger["dia_referencia"], regime_inicio=ger["inicio_regime_atual"])
        out["termica"] = serie
        v = serie[-1][2].get("valor")
        t = ger["termica_contexto"]
        dif = abs(v - t["participacao_7d"]) if v is not None and t["participacao_7d"] is not None else None
        controles.append({"nome": "termica: participação de 7 dias reavaliada a partir de geracao.json#serie_sin",
                          "resultado": "aprovado" if dif is not None and dif <= 0.05 else "ressalva",
                          "detalhe": f"reavaliada {c.r(v, 3)}%, gold {t['participacao_7d']}% (tolerância 0,05 p.p.: MWmed diários arredondados ao inteiro e participação arredondada a uma casa)"})
    if _ok(carga):
        sc = {x["d"]: x["SIN"] for x in carga["serie"] if x.get("SIN") is not None}
        out["carga_extrema"] = s.condicoes_carga(sc, carga.get("regimes") or [], INICIO_HISTORICO, carga["dia_referencia"])
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
                out[rid] = s.condicoes_janela_movel(num, den, INICIO_HISTORICO, max(num), lados=("acima",))
    return out, controles, alternativas


# ---------------------------------------------------------------- P007: avaliação e textos

def _texto_ear(hid):
    sin = next(x for x in hid["subsistemas"] if x["sm"] == "SIN")["ear"]
    fora = [x for x in hid["subsistemas"] if x["sm"] != "SIN" and x["ear"]["faixa"] in ("abaixo", "acima")]
    txt = (f"Em {c.data_br(hid['dia_referencia_ear'])}, SIN com {s.nbr(sin['valor'])}% ({sin['faixa']} da faixa de "
           f"{s.nbr(sin['p10'])}% a {s.nbr(sin['p90'])}%).")
    if fora:
        txt += " Subsistemas fora da faixa: " + "; ".join(
            f"{x['nome']} com {s.nbr(x['ear']['valor'])}% ({x['ear']['faixa']} da faixa de {s.nbr(x['ear']['p10'])}% a {s.nbr(x['ear']['p90'])}%)"
            for x in fora) + "."
    return txt


def _texto_ena(hid):
    sin = next(x for x in hid["subsistemas"] if x["sm"] == "SIN")["ena"]
    fora = [x for x in hid["subsistemas"] if x["sm"] != "SIN" and x["ena"]["faixa_30d"] in ("abaixo", "acima")]
    txt = (f"Nos 30 dias até {c.data_br(hid['dia_referencia_ena'])}, SIN com {s.nbr(sin['pct_mlt_30d'], 1)}% da MLT ({sin['faixa_30d']} da "
           f"faixa de {s.nbr(sin['p10_30d'], 1)}% a {s.nbr(sin['p90_30d'], 1)}%).")
    if fora:
        txt += " Subsistemas fora da faixa: " + "; ".join(
            f"{x['nome']} com {s.nbr(x['ena']['pct_mlt_30d'], 1)}% da MLT ({x['ena']['faixa_30d']} da faixa de {s.nbr(x['ena']['p10_30d'], 1)}% a {s.nbr(x['ena']['p90_30d'], 1)}%)"
            for x in fora) + "."
    return txt


def _texto_regra(rid, golds, ult, entradas):
    """Texto de evidência do dia, com os números da gold de origem quando ela os publica."""
    hid, ger, carga, pld = (golds.get(k) for k in ("hidrologia.json", "geracao.json", "carga.json", "pld.json"))
    det = ult[2] if ult else {}
    dia = ult[0] if ult else None
    if rid == "ear_faixa" and _ok(hid):
        return _texto_ear(hid)
    if rid == "ena_faixa" and _ok(hid):
        return _texto_ena(hid)
    if rid == "termica" and _ok(ger):
        t = ger["termica_contexto"]
        return (f"{s.nbr(t['participacao_7d'])}% nos 7 dias até {c.data_br(ger['dia_referencia'])}; faixa usual de "
                f"{s.nbr(t['p10_365d'])}% a {s.nbr(t['p90_365d'])}% (percentil {s.nbr(t['percentil'], 1)}).")
    if rid == "carga_extrema" and _ok(carga):
        v, p95 = det.get("valor"), det.get("p95")
        return (f"{s.nbr(v, 0)} MWmed em {c.data_br(dia)}; 95º percentil dos 364 dias anteriores: {s.nbr(p95, 0)} MWmed."
                if p95 is not None else f"{s.nbr(v, 0)} MWmed em {c.data_br(dia)}; dia não avaliável (base de 364 dias fora do mesmo regime ou incompleta).")
    if rid == "descolamento" and det.get("amplitude") is not None:
        return (f"Em {c.data_br(dia)}, diferença de R$ {s.nbr(det['amplitude'], 2)}/MWh entre {c.NOME_SUBMERCADO[det['maior']]} e "
                f"{c.NOME_SUBMERCADO[det['menor']]}; limiar do dia R$ {s.nbr(det['limiar'], 2)}/MWh.")
    if rid == "pld_piso" and det:
        hp = det.get("horas_no_piso") or {}
        return (f"Em {c.data_br(dia)}, horas no piso de R$ {s.nbr(det.get('pld_min'), 2)}/MWh: "
                + "; ".join(f"{c.NOME_SUBMERCADO[sm]} {hp.get(sm)}" for sm in s.SMS) + " (de 24).")
    if rid == "pld_teto" and det:
        ht = det.get("horas_no_teto_horario") or {}
        return (f"Em {c.data_br(dia)}, horas no teto horário de R$ {s.nbr(det.get('pld_max_horario'), 2)}/MWh: "
                + "; ".join(f"{c.NOME_SUBMERCADO[sm]} {ht.get(sm)}" for sm in s.SMS)
                + f". Teto estrutural (média diária) de R$ {s.nbr(det.get('pld_max_estrutural'), 2)}/MWh "
                + ("atingido em " + ", ".join(c.NOME_SUBMERCADO[sm] for sm in s.SMS if (det.get('media_no_teto_estrutural') or {}).get(sm)) + "."
                   if any((det.get("media_no_teto_estrutural") or {}).values()) else "não atingido."))
    if rid in ("restricao_eolica", "restricao_solar") and det:
        if det.get("p90") is None:
            return f"Taxa de {s.nbr(det.get('valor'), 1)}% nos 7 dias até {c.data_br(dia)}; dia não avaliável (menos de 365 janelas anteriores)."
        return (f"Taxa de restrição de {s.nbr(det['valor'], 1)}% nos 7 dias até {c.data_br(dia)}; 90º percentil das janelas "
                f"anteriores {s.nbr(det['p90'], 1)}% (mediana {s.nbr(det['p50'], 1)}%).")
    if rid == "revisao_material":
        cap = det.get("capturas") or {}
        if not cap:
            return "Nenhuma captura comparável nos últimos 7 dias."
        return "Capturas dos últimos 7 dias: " + "; ".join(
            f"{c.data_br(k)} com {n} {'revisão material' if n == 1 else 'revisões materiais'}" for k, n in sorted(cap.items())) + "."
    return None


def _num_regra(rid, golds, ult):
    """(valor, unidade, limiar_inferior, limiar_superior) do dia, para CSV e evidência."""
    det = ult[2] if ult else {}
    if rid in ("termica", "restricao_eolica", "restricao_solar"):
        return det.get("valor"), det.get("p10"), det.get("p90")
    if rid == "carga_extrema":
        return det.get("valor"), None, det.get("p95")
    if rid == "descolamento":
        return det.get("amplitude"), None, det.get("limiar")
    return None, None, None


def avaliar_regras(golds, cond, conjuntos, hoje, alternativas=None):
    """Lista `observar` completa (compatível com a página), linhas dos CSV, dias com alerta
    exibido por regra (para conferir emissões passadas) e regras sem dado."""
    pld, cmo = golds.get("pld.json"), golds.get("cmo.json")
    out, linhas_csv, linhas_ep, exibidos, sem_dado = [], [], [], {}, []
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
            ep = next((e for e in r["episodios"] if e["em_curso"]), None)
            item.update({
                "ativo": r["estado"] in ("ativo", "em_retorno"), "estado": r["estado"],
                "referencia": ult[0], "defasagem_dias": s.defasagem_dias(ult[0], hoje),
                "condicao_no_dia": bool(ult[1]),
                "evidencia": _texto_regra(rid, golds, ult, {}) or "",
                "episodio_atual": ({**ep, "duracao_dias": s._duracao(ep, serie2[-1][0])} if ep else None),
                "sequencia_atual": r["sequencia_atual"],
                "dias_sem_condicao_no_retorno": r["dias_sem_condicao_no_retorno"],
                "historico": hist, "linha_estado": s.estado_compacto(serie2, r),
            })
            if (alternativas or {}).get(rid):
                aid, adesc, aserie = alternativas[rid]
                a2 = [(dd, cc) for dd, cc, _ in aserie]
                while a2 and a2[-1][1] is None:
                    a2.pop()
                ha = s.resumo_historico(a2, meta["duracao_minima_dias"], meta["retorno_dias"]) if a2 else None
                item["alternativas_avaliadas"] = [{
                    "id": aid, "condicao": adesc, "adotada": False,
                    "pct_dias_exibidos": (ha or {}).get("pct_dias_exibidos"), "episodios": (ha or {}).get("episodios"),
                    "pct_dias_com_condicao": (ha or {}).get("pct_dias_com_condicao"),
                    "motivo": "Frequência de alerta alta demais para uma síntese (ruído); mantida aqui para comparação."}]
            v, li, ls = _num_regra(rid, golds, ult)
            item["valor"] = {"valor": c.r(v, 4) if v is not None else None, "limiar_inferior": c.r(li, 4), "limiar_superior": c.r(ls, 4)}
            exib = set()  # dias com o alerta exibido, para o CSV e para conferir emissões passadas
            for e in r["episodios"]:
                x = s.d(e["confirmado_em"])
                f = s.d(e["normalizado_em"]) - timedelta(days=1) if e.get("normalizado_em") else s.d(serie2[-1][0])
                while x <= f:
                    exib.add(x.isoformat())
                    x += timedelta(days=1)
                linhas_ep.append([rid, e["inicio"], e["confirmado_em"], e["fim"], e.get("normalizado_em"), e["dias_condicao"],
                                  s._duracao(e, serie2[-1][0]), 1 if e["em_curso"] else 0])
            exibidos[rid] = (exib, {dd for dd, cc in serie2 if cc is not None})
            for dd, cc, det in serie:
                vv, a, b = _num_regra(rid, golds, (dd, cc, det))
                est = "A" if dd in exib else ("-" if cc is None else ("o" if cc else "."))
                linhas_csv.append([dd, rid, "" if cc is None else (1 if cc else 0), est, c.r(vv, 4), c.r(a, 4), c.r(b, 4), _detalhe_csv(rid, det)])
        elif rid == "pld_defasagem":
            if not _ok(pld):
                continue
            atraso = s.defasagem_dias(pld["dia_referencia"], hoje)
            coleta = (pld.get("coleta_direta") or {})
            item.update({
                "ativo": atraso > 2, "estado": "ativo" if atraso > 2 else "normal", "referencia": pld["dia_referencia"],
                "defasagem_dias": atraso, "condicao_no_dia": atraso > 2,
                "evidencia": (f"Último dia integrado: {c.data_br(pld['dia_referencia'])}. " + s.texto_defasagem(pld["dia_referencia"], hoje) +
                              (" A última coleta direta na CCEE foi bem-sucedida." if coleta.get("ok") else
                               " A última tentativa de coleta direta na CCEE falhou ou não foi feita.")),
                "historico": None,
                "historico_nao_se_aplica": "Regra sobre o estado da integração, avaliada a cada processamento; o registro das avaliações está em sintese_alertas (silver)."})
        elif rid == "atualidade_fontes":
            usados = [ds for ds in DATASETS_OPERACAO] + ["aneel_tarifas_aplicacao", "aneel_continuidade", "aneel_samp_balanco", "aneel_scs"]
            atrasados = [(ds, conjuntos[ds]["atualidade"]) for ds in usados if ds in (conjuntos or {})
                         and (conjuntos[ds].get("atualidade") or {}).get("situacao") == "ATRASADO"]
            sem = [ds for ds in usados if ds not in (conjuntos or {})]
            item.update({
                "ativo": bool(atrasados), "estado": "ativo" if atrasados else "normal", "referencia": hoje.isoformat(),
                "defasagem_dias": 0, "condicao_no_dia": bool(atrasados),
                "evidencia": ("; ".join(f"{ds}: último período {a.get('ultimo_periodo')}, {a.get('dias_atraso')} dias além do prazo da cadência {a.get('cadencia')}"
                                        for ds, a in atrasados) + "." if atrasados else
                              f"Os {len(usados) - len(sem)} conjuntos usados nesta página estão em dia ou sem prazo declarado.")
                + (f" Sem situação publicada: {', '.join(sem)}." if sem else ""),
                "conjuntos_avaliados": usados, "historico": None,
                "historico_nao_se_aplica": "A situação vem do painel de saúde dos dados (publicacao.json), recalculada a cada processamento."})
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
    return out, linhas_csv, linhas_ep, exibidos, sem_dado


def _detalhe_csv(rid, det):
    if not det:
        return ""
    if rid in ("ear_faixa", "ena_faixa"):
        return " ".join(f"{sm}:{det['valores'][sm]['faixa']}" for sm in det.get("fora", []) if sm in det.get("valores", {}))
    if rid in ("pld_piso", "pld_teto"):
        return " ".join(det.get("submercados") or [])
    if rid == "descolamento" and det.get("maior"):
        return f"{det['maior']}>{det['menor']}"
    if rid == "revisao_material":
        return " ".join(f"{k}:{n}" for k, n in sorted((det.get("capturas") or {}).items()))
    return ""


def condicao_revisoes(revs, dias_comp, fim):
    eventos = {}
    for ds, dias in dias_comp.items():
        for dd in dias:
            eventos.setdefault(dd, 0)
    for r in revs:
        if r["material"]:
            eventos[r["dia_captura"]] = eventos.get(r["dia_captura"], 0) + 1
    if not eventos:
        return None
    return s.condicoes_revisao(eventos, INICIO_HISTORICO, max(fim, max(eventos)))


# ---------------------------------------------------------------- registro dos alertas emitidos

def registro_alertas(con, observar, hoje, agora):
    """Grava no silver da família o estado de cada regra neste processamento (só o que mudou,
    pela semântica de base.grava_registros) e devolve o histórico de estados por regra.
    É a base para medir alerta emitido que deixou de se confirmar depois de revisão."""
    estados = {o["id"]: {"estado": o.get("estado"), "ativo": "1" if o.get("ativo") else "0", "referencia": o.get("referencia"),
                         "versao_regra": o.get("versao_regra"),
                         "inicio_episodio": (o.get("episodio_atual") or {}).get("inicio"), "processado_em_brasilia": hoje.isoformat()}
               for o in observar}
    corpo = json.dumps(estados, sort_keys=True, ensure_ascii=False).encode()
    sha = base.sha256_bytes(corpo + agora.encode())
    vid, _ = base.registra_vintage(con, DS_ALERTAS, "estados", None, agora, None, sha, len(corpo), "derivado_das_golds", None)
    linhas = [(rid, campo, v) for rid, e in estados.items() for campo, v in e.items() if campo != "processado_em_brasilia"]
    base.grava_registros(con, DS_ALERTAS, vid, linhas)
    con.commit()


def estados_emitidos(con):
    """[(capturado_em, {regra: {campo: valor}})] com o estado completo de cada regra em cada
    processamento registrado (uma passada: grava_registros só guarda o que mudou)."""
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
    """Para cada regra com histórico: alertas emitidos em processamentos registrados (silver)
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
            "inicio": registros[0][0] if registros else None, "processamentos": len(registros), "mudancas_de_estado": mudancas,
            "emitidos": len(emitidos), "referencias_em_alerta": len(refs),
            "nao_confirmados_apos_revisao": len({ref for _, ref in nao}) if rid in exibidos else None,
            "exemplos_nao_confirmados": [{"capturado_em": a, "referencia": b} for a, b in nao[:5]],
            "nota": ("Estados emitidos a cada processamento, registrados desde a primeira execução do módulo visao; mede quantos "
                     "alertas deixaram de se confirmar quando a fonte revisou os dados (regras sem histórico diário não são conferidas).")}
        nao_conf.extend({"regra": rid, "capturado_em": a, "referencia": b} for a, b in nao)
    return nao_conf


# ---------------------------------------------------------------- destaques (P004)

def destaques(observar):
    """No máximo três regras em alerta, da mais rara para a mais frequente no histórico;
    texto montado por regra fixa, com duração e condição de retorno."""
    cand = [o for o in observar if o["tipo"] == "regra" and o.get("assunto") == "sistema"
            and o.get("estado") in ("ativo", "em_retorno") and o.get("historico")]
    cand.sort(key=lambda o: (o["historico"]["pct_dias_exibidos"], o["id"]))
    out = []
    for o in cand[:MAX_DESTAQUES]:
        ep, h = o["episodio_atual"], o["historico"]
        dias = ep["duracao_dias"] if ep else None
        retorno = ""
        if o["estado"] == "em_retorno":
            k = o.get("dias_sem_condicao_no_retorno") or 0
            retorno = (f" A condição não se verificou nos últimos {k} {'dia' if k == 1 else 'dias'} avaliados; o retorno exige "
                       f"{o['retorno_dias']}.")
        txt = (f"{o['titulo']}: {o['evidencia']} Condição desde {c.data_br(ep['inicio'])}, alerta desde {c.data_br(ep['confirmado_em'])} "
               f"({dias} {'dia' if dias == 1 else 'dias'} de episódio até {c.data_br(ep['fim'])}).{retorno} {o['regra_retorno']} "
               f"No histórico desde {c.data_br(h['inicio'])}, esta regra ficou em alerta em {s.nbr(h['pct_dias_exibidos'], 1)}% dos dias "
               f"avaliados ({h['episodios']} {'episódio' if h['episodios'] == 1 else 'episódios'}).")
        out.append({"regra": o["id"], "titulo": o["titulo"], "texto": txt, "tipo": "fato", "estado": o["estado"],
                    "desde": ep["inicio"] if ep else None, "dias": dias, "referencia": o["referencia"],
                    "normaliza_quando": o["regra_retorno"], "frequencia_historica_pct": h["pct_dias_exibidos"],
                    "hipoteses_a_verificar": [{**x, "tipo": "hipotese"} for x in o["hipoteses"]],
                    "nao_implica": o["nao_implica"], "href": o["href"]})
    resto = [o["id"] for o in cand[MAX_DESTAQUES:]]
    return {"itens": out, "outras_regras_em_alerta": resto, "limite": MAX_DESTAQUES,
            "criterio": ("Só regras sobre o sistema (as de qualidade dos dados ficam na lista completa) com a duração mínima "
                         "atingida; ordem pela raridade no histórico (menor fração de dias em alerta primeiro); no máximo três. Hipóteses listadas por regra são fixas, não testadas aqui, e indicam o painel "
                         "onde a verificação seria feita."),
            "vazio": None if out else "Nenhuma regra com a duração mínima atingida nesta publicação."}


# ---------------------------------------------------------------- evidências

def _evidencia_frase(f, golds, con_p):
    g = golds[f["versoes"]["gold"]]
    nome_prov = s.ORIGEM_FRASE[f["id"]][1]
    prov = g["proveniencia"][nome_prov]
    anos = sorted({j["inicio"][:4] for j in f["qualidade"]["janelas"]} | {j["fim"][:4] for j in f["qualidade"]["janelas"]})
    vs = _vintages(con_p, f["versoes"]["dataset"], anos)
    fonte = _fonte_evidencia(prov["fonte"]["orgao"], prov["fonte"]["dataset"], prov["fonte"]["url_dataset"], vs)
    numeros = [(k, v) for k, v in f["valores"].items() if isinstance(v["valor"], (int, float)) and not isinstance(v["valor"], bool)]
    k0, v0 = numeros[0]
    janelas = f["qualidade"]["janelas"]
    consulta = (f"silver energia.db: observacoes do dataset {f['versoes']['dataset']} nas referências "
                + "; ".join(f"{j['inicio']} a {j['fim']}" for j in janelas) + " (valor da captura mais recente)")
    trechos_ok = s.texto_de(s.MODELOS[f["id"]](f["valores"])) == f["texto"]
    num = den = None
    if f["id"] == "carga":
        # razão publicada pela gold de Carga: média dos 7 dias ÷ média dos mesmos dias do ano anterior
        u7 = next(x for x in g["subsistemas"] if x["sm"] == "SIN")["ult7"]
        num = {"descricao": f"carga média do SIN de {u7['inicio']} a {u7['fim']} (MWmed)", "valor": u7["media"]}
        den = {"descricao": f"carga média do SIN de {u7['inicio_anterior']} a {u7['fim_anterior']} (MWmed)", "valor": u7["media_ano_anterior"]}
    return ev.construir(
        numerador=num, denominador=den,
        indicador=f"Visão geral, frase '{f['id']}'", valor_exibido=next(t["texto"] for t in f["trechos"] if t.get("evidencia")),
        valor_calculo=v0["valor"], unidade=v0.get("unidade") or prov["unidade"],
        periodo={"inicio": janelas[0]["inicio"], "fim": janelas[0]["fim"]},
        entidade="SIN" if f["id"] != "pld" else "Sudeste/Centro-Oeste", universo=prov["indicador"],
        fonte=fonte, consulta=consulta, formula=prov.get("formula") or f["regra"] or "valor publicado pela fonte",
        cobertura=f"Cobertura da série de origem: {prov['cobertura_historica']['inicio']} a {prov['cobertura_historica']['fim']}.",
        tratamento_ausencia="Sem o valor na gold de origem, a frase não é emitida (ausência declarada).",
        revisoes=f["qualidade"]["revisoes"]["texto"],
        testes=[ev.teste("frase refeita a partir dos valores publicados", "aprovado" if trechos_ok else "reprovado",
                         f"MODELOS['{f['id']}'](valores) reproduz o texto exibido: {trechos_ok}"),
                ev.teste("valores lidos da gold de origem", "aprovado",
                         "; ".join(f"{k} = {v['valor']} ({v['caminho']})" for k, v in f["valores"].items())[:900])],
        download=[{"rotulo": d["rotulo"], "url": d["url"]} for d in g.get("downloads") or []] or [{"rotulo": "Gold de origem", "url": f"/energia/gold/{f['versoes']['gold']}"}],
        reproducao=REPRODUCAO)


def _evidencia_regra(o, con_p, entradas, sha_csv):
    """Evidência do número que a regra avalia no dia (taxa, participação, amplitude)."""
    rid = o["id"]
    v = (o.get("valor") or {}).get("valor")
    if v is None or rid not in ("termica", "carga_extrema", "descolamento", "restricao_eolica", "restricao_solar"):
        return None
    ref = o["referencia"]
    if rid in ("restricao_eolica", "restricao_solar"):
        ds = "ons_coff_eolica" if rid == "restricao_eolica" else "ons_coff_fotovoltaica"
        con = _abre_ro("ons_geracao")
        try:
            ms = sorted({(s.d(ref) - timedelta(days=i)).strftime("%Y_%m") for i in range(7)})
            vs = [x for x in _vintages(con, ds) if any(m in x["recurso"] for m in ms)]
        finally:
            if con is not None:
                con.close()
        fonte = _fonte_evidencia("ONS", "Restrição de operação por constrained-off de usinas " + ("eólicas" if ds.endswith("eolica") else "fotovoltaicas"),
                                 f"https://dados.ons.org.br/dataset/{'restricao_coff_eolica_usi' if ds.endswith('eolica') else 'restricao_coff_fotovoltaica'}", vs)
        consulta = (f"public/energia/series/geracao_restricao_diaria.csv (sha256 {sha_csv.get('restricoes')}): linhas razao=TOTAL e "
                    f"fonte={'eolica' if rid == 'restricao_eolica' else 'solar'}, de {(s.d(ref) - timedelta(days=6)).isoformat()} a {ref}, somadas nas regiões")
        num = {"descricao": "energia não gerada estimada, 7 dias (MWh)", "valor": None}
        den = {"descricao": "geração verificada + não gerada, 7 dias (MWh)", "valor": None}
        n, dd = _restricao_diaria(entradas.get("restricoes"), "eolica" if rid == "restricao_eolica" else "solar")
        ks = [(s.d(ref) - timedelta(days=i)).isoformat() for i in range(7)]
        num["valor"] = c.r(sum(n[k] for k in ks), 3)
        den["valor"] = c.r(sum(dd[k] for k in ks), 3)
        formula = "taxa_7d = 100 × Σ não gerada ÷ Σ (verificada + não gerada), 7 dias"
        download = [{"rotulo": "Restrições por dia, razão e origem (CSV)", "url": "/energia/series/geracao_restricao_diaria.csv"}]
    else:
        ds = {"termica": "balanco_energia_subsistema_ho", "carga_extrema": "carga_energia_di", "descolamento": "ccee_pld_horario"}[rid]
        vs = _vintages(con_p, ds, [ref[:4]])
        orgao = "CCEE" if ds == "ccee_pld_horario" else "ONS"
        nome = {"termica": "Balanço de Energia nos Subsistemas", "carga_extrema": "Carga de Energia Diária", "descolamento": "PLD_HORARIO"}[rid]
        url = {"termica": "https://dados.ons.org.br/dataset/balanco-energia-subsistema", "carga_extrema": "https://dados.ons.org.br/dataset/carga-energia",
               "descolamento": "https://dadosabertos.ccee.org.br/dataset/pld_horario"}[rid]
        fonte = _fonte_evidencia(orgao, nome, url, vs)
        consulta = {"termica": f"geracao.json#serie_sin de {(s.d(ref) - timedelta(days=6)).isoformat()} a {ref} (SIN)",
                    "carga_extrema": f"carga.json#serie, SIN, {ref} e os 364 dias anteriores",
                    "descolamento": f"pld.json#diario, {ref}, quatro submercados"}[rid]
        num = den = None
        formula = {"termica": "participação_7d = 100 × Σ térmica ÷ Σ (hidráulica + térmica + eólica + solar), 7 dias",
                   "carga_extrema": "condição = carga(dia) > quantil 0,95 dos 364 dias anteriores",
                   "descolamento": "amplitude = max_s PLD_dia(s) − min_s PLD_dia(s)"}[rid]
        download = [{"rotulo": "Estados diários das regras (CSV)", "url": U["regras"]}]
    un = {"termica": "%", "carga_extrema": "MWmed", "descolamento": "R$/MWh", "restricao_eolica": "%", "restricao_solar": "%"}[rid]
    casas = 0 if rid == "carga_extrema" else (2 if rid == "descolamento" else 1)
    ini = (s.d(ref) - timedelta(days=6)).isoformat() if rid in ("termica", "restricao_eolica", "restricao_solar") else ref
    h = o.get("historico") or {}
    return ev.construir(
        indicador=f"Regra '{rid}' do o que observar", valor_exibido=f"{s.nbr(v, casas)}{'%' if un == '%' else ' ' + un}",
        valor_calculo=v, unidade=un, periodo={"inicio": ini, "fim": ref}, entidade="SIN" if rid != "descolamento" else "quatro submercados",
        universo=o["condicao"], fonte=fonte, consulta=consulta, formula=formula, numerador=num, denominador=den,
        cobertura=f"Histórico avaliado de {h.get('inicio')} a {h.get('fim')}: {h.get('dias_avaliados')} dias com avaliação.",
        tratamento_ausencia="Dia sem dado ou sem base completa não é avaliado e interrompe a contagem de duração.",
        revisoes="Reavaliado a cada processamento com os dados vigentes; ver revisao_material.",
        testes=[ev.teste("estado do dia reproduzido pela máquina de estados sobre a série publicada", "aprovado",
                         f"estado {o['estado']}; condição no dia {o['condicao_no_dia']}")],
        download=download, reproducao=REPRODUCAO)


# ---------------------------------------------------------------- construção

def _golds(ctx):
    """Golds desta execução; o que faltar vem da publicação em disco (registrado)."""
    golds = dict((ctx or {}).get("golds") or {})
    do_disco = []
    for nome in ("pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json", "pld_detalhe.json",
                 "regulacao.json", "geracao_detalhe.json", "conta.json", "qualidade.json", "perdas.json", "inclusao.json",
                 "publicacao.json"):
        if nome not in golds:
            g = base.le_gold(nome)
            if g is not None:
                golds[nome] = g
                do_disco.append(nome)
    return golds, do_disco


def _origens(golds, do_disco):
    return [{"gold": n, "disponivel": _ok(g), "gerado_em": (g or {}).get("gerado_em"), "versao_codigo": (g or {}).get("versao_codigo"),
             "lida_do_disco": n in do_disco} for n, g in sorted(golds.items())
            if n in ("pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json", "pld_detalhe.json",
                     "regulacao.json", "geracao_detalhe.json", "conta.json", "qualidade.json", "perdas.json", "inclusao.json", "publicacao.json")]


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
    revs, dias_comp, rev_refs = [], {}, None
    if con_p is not None:
        revs, dias_comp = revisoes_silver(con_p)
        rev_refs = {ds: {} for ds in DATASETS_OPERACAO}
        for r in revs:
            rev_refs[r["dataset"]].setdefault(r["ref"], []).append(r["relativa_pct"])

    # entradas publicadas pelos módulos PLD e Geração (mesmos números das páginas deles)
    lim_csv, sha_lim = _le_csv("pld_limites_diario.csv")
    rest_csv, sha_rest = _le_csv("geracao_restricao_diaria.csv")
    entradas = {"limites": _limites_linhas(lim_csv) if lim_csv else None, "restricoes": rest_csv}
    sha_csv = {"limites": sha_lim, "restricoes": sha_rest}

    # P004: frases
    contexto = {"conjuntos": conjuntos, "revisoes_refs": rev_refs}
    fr = s.frases(golds, contexto, hoje)
    for f in fr:
        try:
            f["evidencia"] = _evidencia_frase(f, golds, con_p)
        except ev.EvidenciaInvalida as e:
            f["evidencia"] = None
            f["evidencia_problemas"] = e.problemas
    ausentes_frases = [fid for fid in s.ORDEM_FRASES if fid not in {f["id"] for f in fr}]

    # P007: condições, histórico e estado de cada regra
    cond, controles, alternativas = condicoes_das_regras(golds, con_p, entradas)
    cr = condicao_revisoes(revs, dias_comp, hoje.isoformat()) if con_p is not None else None
    if cr:
        cond["revisao_material"] = cr
    observar, linhas_csv, linhas_ep, exibidos, regras_sem_dado = avaliar_regras(golds, cond, conjuntos, hoje, alternativas)
    for o in observar:
        o["evidencia_numero"] = None
        try:
            o["evidencia_numero"] = _evidencia_regra(o, con_p, entradas, sha_csv)
        except ev.EvidenciaInvalida as e:
            o["evidencia_problemas"] = e.problemas
    lim_vig = _limites_vigentes(golds)
    for o in observar:
        if o["id"] in ("pld_piso", "pld_teto") and lim_vig:
            o["limites_vigentes"] = lim_vig
            # conferência: limite do CSV do módulo PLD igual ao ato vigente publicado pela Regulação
            ult = next((ln for ln in reversed(entradas["limites"] or []) if ln["sm"] == "SE"), None)
            if ult:
                iguais = (abs((ult["pld_min"] or 0) - lim_vig["pld_min"]) < 0.005 and abs((ult["pld_max_horario"] or 0) - lim_vig["pld_max_horario"]) < 0.005
                          and abs((ult["pld_max_estrutural"] or 0) - lim_vig["pld_max_estrutural"]) < 0.005)
                o["conferencia_limites"] = {"resultado": "aprovado" if iguais else "ressalva",
                                            "detalhe": (f"pld_limites_diario.csv em {ult['data']}: mínimo {ult['pld_min']}, máximo horário {ult['pld_max_horario']}, "
                                                        f"estrutural {ult['pld_max_estrutural']}; regulacao.json em {lim_vig['data']}: {lim_vig['pld_min']}, "
                                                        f"{lim_vig['pld_max_horario']}, {lim_vig['pld_max_estrutural']} (tolerância R$ 0,005/MWh: valores em centavos)")}
    # registro dos alertas emitidos (silver da família) e conferência com a reavaliação
    registro_alertas(con, observar, hoje, agora)
    nao_conf = confere_emissoes(con, observar, exibidos)

    # P005 e P006
    mult = multiplos(golds, hoje)
    conferidas, erros_mult = confere_multiplos(mult, golds) if mult else (0, ["sem painéis"])
    if erros_mult:
        return c.stub(GOLD, "pequenos múltiplos divergem das golds de origem: " + "; ".join(erros_mult[:5]))
    soc = sociedade(golds, conjuntos, hoje)

    # validação física e de domínio (contrato 5.2)
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
    # toda medida citada tem definição no catálogo (falha de outro módulo no catálogo não derruba a síntese)
    try:
        from pipeline.energia import metricas
        ids = {m["id"] for m in metricas.todas()}
        citadas = {o.get("metrica") for o in observar if o.get("metrica")} | {p["metrica"] for p in (mult or {}).get("paineis", [])} | \
                  {i["metrica"] for i in soc["itens"]}
        faltam = sorted(x for x in citadas if x not in ids)
        validacao.append({"nome": "medidas citadas existem no catálogo de métricas", "resultado": "aprovado" if not faltam else "ressalva",
                          "detalhe": f"{len(citadas)} medidas; sem definição: {faltam}"})
    except Exception as e:  # catálogo inválido por outro módulo: registra e segue
        validacao.append({"nome": "medidas citadas existem no catálogo de métricas", "resultado": "ressalva", "detalhe": f"catálogo indisponível: {e}"[:300]})
    validacao.append({"nome": "P004: frases refeitas a partir dos valores", "resultado": "aprovado", "detalhe": f"{len(fr)} frases"})
    validacao.extend(controles)
    for o in observar:
        if o.get("conferencia_limites"):
            validacao.append({"nome": f"{o['id']}: limites do CSV do PLD iguais aos da Regulação", **o["conferencia_limites"]})
    validacao.append({"nome": "alertas emitidos antes e não confirmados após revisão", "resultado": "aprovado" if not nao_conf else "ressalva",
                      "detalhe": f"{len(nao_conf)} casos"})
    for o in observar:
        if o.get("evidencia_problemas"):
            validacao.append({"nome": f"evidência da regra {o['id']}", "resultado": "ressalva", "detalhe": "; ".join(o["evidencia_problemas"])[:400]})
    for f in fr:
        if f.get("evidencia_problemas"):
            validacao.append({"nome": f"evidência da frase {f['id']}", "resultado": "ressalva", "detalhe": "; ".join(f["evidencia_problemas"])[:400]})

    # downloads
    _csv_regras(linhas_csv)
    base.escreve_csv(os.path.basename(U["episodios"]), ["regra", "inicio", "confirmado_em", "fim", "normalizado_em", "dias_condicao", "duracao_dias", "em_curso"], linhas_ep)
    if mult:
        cols = ["d"] + [k for k in mult["dados"][0] if k != "d"]
        base.escreve_csv(os.path.basename(U["multiplos"]), cols, [[ln.get(k) for k in cols] for ln in mult["dados"]])
    base.escreve_csv(os.path.basename(U["revisoes"]),
                     ["dataset", "serie", "ref", "valor_anterior", "valor_novo", "diferenca", "diferenca_relativa_pct", "unidade", "material",
                      "capturado_anterior", "capturado_novo", "dia_captura"],
                     [[r["dataset"], r["serie"], r["ref"], r["de"], r["para"], r["diferenca"], r["relativa_pct"], r["unidade"],
                       1 if r["material"] else 0, r["capturado_de"], r["capturado_para"], r["dia_captura"]] for r in revs])

    resumo_rev = []
    for ds in DATASETS_OPERACAO:
        rr = [r for r in revs if r["dataset"] == ds]
        mat = [r for r in rr if r["material"]]
        maior = max(mat, key=lambda r: abs(r["diferenca"]) if r["relativa_pct"] is None else r["relativa_pct"], default=None)
        resumo_rev.append({"dataset": ds, "revisoes": len(rr), "materiais": len(mat),
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
        "destaques": destaques(observar),
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
                     "regra_material": REGRAS[[r["id"] for r in REGRAS].index("revisao_material")]["condicao"],
                     "download": [{"rotulo": "Revisões entre capturas (CSV)", "url": U["revisoes"]}]},
        "origens": _origens(golds, do_disco),
        "historico_regras": {"inicio": INICIO_HISTORICO,
                             "regra": ("Cada regra é reavaliada em todos os dias desde 01/01/2021 com os dados vigentes hoje (já revisados): "
                                       "mostra quantas vezes teria disparado e por quanto tempo, não o que se via na época. O registro dos "
                                       "alertas efetivamente emitidos começa nesta versão (silver sintese, conjunto _visao_alertas)."),
                             "falso_alarme": ("Não há verdade de referência para chamar um alerta de falso. Publicam-se a frequência de "
                                              "disparo, os acionamentos curtos que a duração mínima descartou, a sensibilidade a outras "
                                              "durações e, com o registro das emissões, os alertas que deixaram de se confirmar quando a "
                                              "fonte revisou os dados.")},
        "validacao": validacao,
        "nota": "Frases e alertas montados por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada número leva à evidência.",
        "downloads": [{"rotulo": "Estados diários das regras desde 2021 (CSV)", "url": U["regras"]},
                      {"rotulo": "Episódios de alerta das regras (CSV)", "url": U["episodios"]},
                      {"rotulo": "Determinantes alinhados, últimos 90 dias (CSV)", "url": U["multiplos"]},
                      {"rotulo": "Revisões entre capturas das séries da Visão geral (CSV)", "url": U["revisoes"]}],
        "limitacoes": [
            "A síntese reutiliza os números das golds de origem; limitações de cada fonte valem aqui e estão na proveniência de cada painel de origem.",
            "O histórico das regras usa os dados de hoje, já revisados; não reproduz o que um leitor via em cada data passada.",
            "As revisões entre capturas só existem a partir das capturas versionadas (silver principal desde 27/09/2026); antes disso não há como medi-las.",
            "Restrições de eólicas e fotovoltaicas usam a geração possível estimada pelo ONS; o registro fotovoltaico começa em abril de 2024.",
            "Os indicadores de energia e sociedade têm períodos de referência diferentes (vigência, ano, mês) e não descrevem o dia.",
        ],
    }
    return g
