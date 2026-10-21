"""Valores permitidos e regras de contagem do capítulo 15 (contratado desde o novo marco).

As fontes não têm API: o seed é curadoria manual (pipeline/saneamento_contratos/seed), uma linha por leilão ou lote,
uma por contrato, ano e indicador, e o vínculo versionado entre cada bloco e os códigos IBGE abrangidos. A vigília mensal
(run.py --vigiar) baixa de novo cada documento com sha256 e procura aditivos; nada entra sem PR.
"""
from __future__ import annotations

TIPOS = ("concessao", "ppp", "privatizacao", "alienacao_de_acoes")
RESULTADOS = ("adjudicado", "sem_propostas", "suspenso", "anulado")
GRAUS = ("V", "S")  # V: conferido na página ou no arquivo da fonte; S: só em trecho de busca ou fonte secundária não aberta
TIPOS_FONTE = ("documento_oficial", "noticia_oficial", "imprensa")
SERVICOS = ("agua_esgoto", "agua", "esgoto")
INDICADORES = ("ICA", "ICE", "IEC", "IPL")  # cobertura de água, de esgoto, tratamento do esgoto coletado, perdas
SITUACOES_CONTRATO = ("transcrito", "documento_nao_localizado", "documento_sem_metas_por_ano")
CALENDARIOS = ("civil", "contratual")  # civil: o documento fixa o ano-calendário; contratual: conta anos do contrato, sem conversão por inferência
NIVEIS = ("contrato", "por_municipio", "por_area")
GRAUS_ABRANGENCIA = ("oficial", "secundaria")
NATUREZAS_CUSTO = ("custo_universalizacao", "contratado")

# Contrato de serviço (concessão ou PPP) efetivamente adjudicado e conferido na fonte: só essas linhas entram nos totais.
TIPOS_DE_SERVICO = ("concessao", "ppp")
ANO_MARCO = 2020
ANO_META_LEGAL = 2033

# Instrumento declarado ao SINISA que o proxy conta como concessão iniciada depois do marco.
INSTRUMENTO_CONCESSAO = "Contrato de Concessão"


def conta_nos_totais(linha: dict) -> bool:
    return linha["tipo"] in TIPOS_DE_SERVICO and linha["resultado"] == "adjudicado" and linha["fonte"]["grau"] == "V"
