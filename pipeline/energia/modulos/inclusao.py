"""Módulo Inclusão energética: Tarifa Social, cobertura potencial, peso da energia no
orçamento e acesso (painéis P059 a P062 da especificação).

Gold: public/energia/gold/inclusao.json; detalhe em public/energia/series/inclusao_*.csv.
Método, fontes verificadas, conferências e limitações: docs/observatorios/energia/modulos/inclusao.md.

Fontes e o papel de cada uma (unidades NUNCA se misturam sem declaração):
- ANEEL, SCS: unidades consumidoras (UC) da subclasse residencial baixa renda por
  distribuidora e mês, total de UC residenciais e a Diferença Mensal de Receita (DMR,
  R$), de 2011 a jun/2025. Base da série mensal e da tabela por distribuidora.
- ANEEL, Beneficiários da CDE: faturas com desconto da Tarifa Social por município,
  distribuidora e subclasse, meses processados pela regra de meses (abaixo). Base do
  mapa por UF e do numerador da cobertura potencial.
- ANEEL, série antiga (descontinuada): histórico trimestral por região, 2012 a 2019,
  usado só como histórico identificado e para conferir o SCS.
- ANEEL, CDE: custeio dos benefícios tarifários: valores anuais da CDE para Tarifa
  Social, Luz para Todos e CCC (sistemas isolados).
- MDS, Cadastro Único (MI Social): famílias com renda per capita até meio salário
  mínimo, por município e mês: denominador da cobertura potencial (proxy).
- IBGE, POF 2017-2018: tabela 6715, coeficientes de variação publicados e microdados.
- IBGE, PNAD Contínua anual: tabelas 6737, 6738 e 6731 (acesso à energia elétrica).
- EPE, PASI: localidades dos sistemas isolados por ciclo de planejamento, conferidas
  contra o caderno em PDF do ciclo 2025.
- MME, Luz para Todos (portal de dados abertos do MME): domicílios atendidos por
  município, programa e mês, e recursos por contrato.

Regra de meses dos Beneficiários da CDE (cada arquivo mensal tem cerca de 300 MB):
1. mês de conferência: o último mês completo do SCS (nenhuma distribuidora esperada
   faltando, regra em completude_scs); é relido da CDE e comparado distribuidora a
   distribuidora;
2. mês mais recente publicado;
3. mês do mapa: o mais recente cuja cobertura, medida pelas UC do SCS no mês de
   conferência das distribuidoras presentes no arquivo, é de pelo menos 99,5%;
   procurado do mais recente para trás (até 8 meses). Os meses sondados e rejeitados
   ficam registrados com a cobertura medida, sem cópia no bronze, e a gold publica deles
   só a cobertura e o motivo (sem o original, os valores não são reprodutíveis);
4. meses da série: todos os meses entre o de conferência e o do mapa, com o original no
   bronze. Depois do fim do SCS a evolução mensal (faturas, desconto das faturas, desconto
   líquido e desconto médio, Brasil e UF) vem daqui, inclusive a mudança de regra de
   05/07/2025.
"""
import collections
import hashlib
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import USER_AGENT, http_download, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_inclusao as fa  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import epe_inclusao as fe  # noqa: E402
from pipeline.energia.fontes import ibge_inclusao as fi  # noqa: E402
from pipeline.energia.fontes import mds_inclusao as fm  # noqa: E402
from pipeline.energia.fontes import mme_inclusao as fl  # noqa: E402
from pipeline.energia.fontes import planilha_inclusao as fp  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "inclusao.json"
FAMILIA = "aneel_social"
ROTA = "/setor-eletrico/inclusao-energetica"
PAGINAS = [{"rotulo": "Inclusão energética", "href": ROTA}]
# um painel por página na interface (síntese em ROTA): cada conjunto aponta para o painel que o usa
PAG_TSEE = [{"rotulo": "Tarifa Social", "href": ROTA + "/tarifa-social"}]
PAG_COB = [{"rotulo": "Cobertura potencial", "href": ROTA + "/cobertura"}]
PAG_POF = [{"rotulo": "Peso no orçamento", "href": ROTA + "/orcamento"}]
PAG_ACESSO = [{"rotulo": "Acesso e sistemas isolados", "href": ROTA + "/acesso"}]

DS_SCS = "aneel_scs"
DS_CDE = "aneel_cde_beneficiarios"
DS_ANTIGA = "aneel_tarifa_social_antiga"
DS_CUSTEIO = "aneel_cde_custeio"
DS_MDS = "mds_cadunico"
DS_POF = "ibge_pof_6715"
DS_POF_CV = "ibge_pof_cv"
DS_POF_MICRO = "ibge_pof_microdados"
DS_PNAD = "ibge_pnadc_energia"
DS_PASI = "epe_pasi_localidades"
DS_LPT = "mme_luz_para_todos"
DS_CONTROLE = "inclusao_controle"

PAC_SCS = "scs-sistema-de-controle-de-subvencoes-e-programas-sociais"
PAC_CDE = "beneficiarios-da-cde"
PAC_ANTIGA = "tarifa-social-de-energia-eletrica-beneficiarios"
PAC_CUSTEIO = "conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios"
URL_ANTIGA_CSV = ("https://dadosabertos.aneel.gov.br/dataset/0ffe45bc-b0bc-4c18-99ab-e97e94841418/resource/"
                  "e6cb4eb6-3ddb-4fc7-8780-29645f9b35cf/download/tarifasocial.csv")
URL_ANTIGA_ARQUIVADA = "https://web.archive.org/web/20240729194517id_/" + URL_ANTIGA_CSV
FTP_POF = "https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2017_2018"
URL_POF_TABELAS = FTP_POF + "/Primeiros_resultados/tabelas_despesas/tabelas_despesas_xls_20191108.zip"
URL_POF_MICRO_DIR = FTP_POF + "/Microdados/"
URL_ANEEL_TSEE = "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social"

LIC_ANEEL = "Open Data Commons Open Database License (ODbL), conforme o portal de dados abertos da ANEEL"
LIC_ANTIGA = ("O conjunto descontinuado não declara licença no portal (campo vazio no package_show); "
              "o portal de dados abertos da ANEEL publica sob ODbL. Cópia arquivada pelo Internet Archive.")
LIC_IBGE = ("Uso livre com citação da fonte (IBGE). A página de termos de uso do IBGE respondeu com desafio "
            "de navegador em 30/09/2026 e não foi relida nesta integração.")
LIC_MDS = ("Dados abertos do Ministério do Desenvolvimento e Assistência Social (SAGI, MI Social), de acesso "
           "público sem autenticação; o serviço não declara licença própria.")
LIC_EPE = ("Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), declarada no portal da EPE; o PASI "
           "não traz licença própria.")

COBERTURA_MINIMA = 0.995   # fração das UC do SCS de referência presentes no arquivo mensal da CDE
TOLERANCIA_ANTIGA_PCT = 2.0  # SCS versus série antiga: mesma grandeza (UC baixa renda) em sistemas diferentes
MESES_SONDADOS = 8
VARIACAO_RESIDENCIAL = 0.25  # salto do total residencial de uma distribuidora que marca o mês como inconsistente
BASE_PEQUENA = 50            # famílias no denominador abaixo das quais a razão municipal é instável
UC_MINIMA_DIFERENCAS = 1000  # UC no SCS para entrar em maiores_diferencas (as menores vão para lista própria)
LIMIARES = (3.0, 5.0, 10.0)  # % da renda ou da despesa: análise de sensibilidade, não definição oficial
CV_CAUTELA, CV_SUPRIME = 15.0, 30.0

UF_NOME = {"RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima", "PA": "Pará", "AP": "Amapá",
           "TO": "Tocantins", "MA": "Maranhão", "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte",
           "PB": "Paraíba", "PE": "Pernambuco", "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia",
           "MG": "Minas Gerais", "ES": "Espírito Santo", "RJ": "Rio de Janeiro", "SP": "São Paulo",
           "PR": "Paraná", "SC": "Santa Catarina", "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul",
           "MT": "Mato Grosso", "GO": "Goiás", "DF": "Distrito Federal"}
REGIAO_DA_UF = {uf: "RG-" + r for uf, r in {
    "RO": "N", "AC": "N", "AM": "N", "RR": "N", "PA": "N", "AP": "N", "TO": "N", "MA": "NE", "PI": "NE", "CE": "NE",
    "RN": "NE", "PB": "NE", "PE": "NE", "AL": "NE", "SE": "NE", "BA": "NE", "MG": "SE", "ES": "SE", "RJ": "SE",
    "SP": "SE", "PR": "S", "SC": "S", "RS": "S", "MS": "CO", "MT": "CO", "GO": "CO", "DF": "CO"}.items()}
REGIAO_NOME = {"RG-N": "Norte", "RG-NE": "Nordeste", "RG-SE": "Sudeste", "RG-S": "Sul", "RG-CO": "Centro-Oeste",
               "BR": "Brasil"}
REGIOES = ("RG-N", "RG-NE", "RG-SE", "RG-S", "RG-CO")
ORDEM_TERR = ["BR", *REGIOES] + list(UF_NOME)

REGISTRO = {
    "id": "inclusao", "gold": GOLD, "familia": FAMILIA, "ordem": 43,
    "datasets": [
        {"orgao": "ANEEL", "nome": PAC_SCS, "slug": "aneel-scs", "dataset_silver": DS_SCS,
         "titulo": "SCS: Sistema de Controle de Subvenções e Programas Sociais (Tarifa Social por distribuidora)",
         "estado": "UTILIZADO EM INDICADOR", "url": ckan.url_dataset("ANEEL", PAC_SCS), "licenca": LIC_ANEEL,
         "paginas": PAG_TSEE + PAG_COB, "downloads": ["/energia/series/inclusao_tsee_mensal.csv",
                                           "/energia/series/inclusao_tsee_distribuidoras.csv"],
         "quebras": [{"data": "2022-01-01", "origem": "FONTE", "descricao": "Concessão automática da Tarifa Social (Lei nº 14.203/2021), conforme a ANEEL."},
                     {"data": "2025-07-05", "origem": "FONTE", "descricao": "Nova regra de desconto: gratuidade até 80 kWh por mês (MPV nº 1.300/2025), conforme a ANEEL."}]},
        {"orgao": "ANEEL", "nome": PAC_CDE, "slug": "aneel-beneficiarios-cde", "dataset_silver": DS_CDE,
         "titulo": "Beneficiários da CDE (agregado por município; nenhum dado pessoal)",
         "estado": "UTILIZADO EM INDICADOR", "url": ckan.url_dataset("ANEEL", PAC_CDE), "licenca": LIC_ANEEL,
         "paginas": PAG_TSEE + PAG_COB, "downloads": ["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cde_mensal_uf.csv"],
         "quebras": [{"data": "2025-07-05", "origem": "FONTE", "descricao": "Nova regra de desconto: gratuidade até 80 kWh por mês (MPV nº 1.300/2025), conforme a ANEEL."}]},
        {"orgao": "ANEEL", "nome": PAC_ANTIGA, "slug": "aneel-tarifa-social-antiga", "dataset_silver": DS_ANTIGA,
         "titulo": "Tarifa Social de Energia Elétrica: Beneficiários (descontinuado; histórico identificado)",
         "estado": "DESCONTINUADO NA FONTE; HISTÓRICO IDENTIFICADO", "url": ckan.url_dataset("ANEEL", PAC_ANTIGA),
         "licenca": LIC_ANTIGA, "paginas": PAG_TSEE, "downloads": ["/energia/series/inclusao_tsee_antiga.csv"],
         "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_CUSTEIO, "slug": "aneel-cde-custeio", "dataset_silver": DS_CUSTEIO,
         "titulo": "CDE: custeio dos benefícios tarifários (Tarifa Social, Luz para Todos, CCC)",
         "estado": "UTILIZADO EM INDICADOR", "url": ckan.url_dataset("ANEEL", PAC_CUSTEIO), "licenca": LIC_ANEEL,
         "paginas": PAG_TSEE + PAG_ACESSO, "downloads": ["/energia/series/inclusao_cde_custeio.csv"], "quebras": []},
        {"orgao": "MDS", "nome": "misocial-cadastro-unico", "slug": "mds-cadunico-municipios", "dataset_silver": DS_MDS,
         "titulo": "Cadastro Único por município: famílias com renda per capita até meio salário mínimo (MI Social)",
         "estado": "UTILIZADO EM INDICADOR (DENOMINADOR DE PROXY)", "url": fm.URL_MISOCIAL, "licenca": LIC_MDS,
         "paginas": PAG_COB, "downloads": ["/energia/series/inclusao_municipios.csv",
                                           "/energia/series/inclusao_cobertura_mensal.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "pof-2017-2018-tabela-6715", "slug": "ibge-pof-6715", "dataset_silver": DS_POF,
         "titulo": "POF 2017-2018: despesa com energia elétrica por classe de rendimento (SIDRA 6715)",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://sidra.ibge.gov.br/tabela/6715", "licenca": LIC_IBGE,
         "paginas": PAG_POF, "downloads": ["/energia/series/inclusao_pof.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "pof-2017-2018-coeficientes-de-variacao", "slug": "ibge-pof-cv", "dataset_silver": DS_POF_CV,
         "titulo": "POF 2017-2018: coeficientes de variação das despesas (Brasil)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_POF_TABELAS, "licenca": LIC_IBGE,
         "paginas": PAG_POF, "downloads": ["/energia/series/inclusao_pof.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "pof-2017-2018-microdados", "slug": "ibge-pof-microdados", "dataset_silver": DS_POF_MICRO,
         "titulo": "POF 2017-2018: microdados (participação da energia por família, com plano amostral)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_POF_MICRO_DIR, "licenca": LIC_IBGE,
         "paginas": PAG_POF, "downloads": ["/energia/series/inclusao_pof.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "pnad-continua-energia-eletrica", "slug": "ibge-pnadc-energia", "dataset_silver": DS_PNAD,
         "titulo": "PNAD Contínua anual: domicílios com energia elétrica, fonte e fornecimento em tempo integral (SIDRA 6737, 6738 e 6731)",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://sidra.ibge.gov.br/tabela/6737", "licenca": LIC_IBGE,
         "paginas": PAG_ACESSO, "downloads": ["/energia/series/inclusao_acesso_pnad.csv"], "quebras": []},
        {"orgao": "EPE", "nome": "pasi-localidades-sistemas-isolados", "slug": "epe-pasi-localidades", "dataset_silver": DS_PASI,
         "titulo": "PASI: localidades dos sistemas isolados por ciclo de planejamento",
         "estado": "UTILIZADO EM INDICADOR", "url": fe.URL_DOWNLOADS, "licenca": LIC_EPE,
         "paginas": PAG_ACESSO, "downloads": ["/energia/series/inclusao_sistemas_isolados.csv"], "quebras": []},
        {"orgao": "MME", "nome": "luz-para-todos", "slug": "mme-luz-para-todos", "dataset_silver": DS_LPT,
         "titulo": "Luz para Todos: domicílios atendidos por município e mês e recursos por contrato",
         "estado": "UTILIZADO EM INDICADOR", "url": fl.URL_DATASET, "licenca": fl.LICENCA,
         "paginas": PAG_ACESSO, "downloads": ["/energia/series/inclusao_luz_para_todos_mensal.csv",
                                           "/energia/series/inclusao_luz_para_todos_municipios.csv",
                                           "/energia/series/inclusao_luz_para_todos_recursos.csv"], "quebras": []},
    ],
    "arquivos": {
        "/energia/series/inclusao_tsee_mensal.csv": (
            "mes (AAAA-MM); distribuidoras (n que informaram no SCS); completo (1 = nenhuma distribuidora esperada faltando, regra na gold); "
            "distribuidoras_faltantes; uc_tsee_faltantes_ultimo_informe (UC com Tarifa Social que as faltantes tinham no último mês informado); "
            "uc_tsee (unidades consumidoras com Tarifa Social, soma das modalidades); uc_baixa_renda, uc_bpc, uc_indigena, uc_quilombola, "
            "uc_multifamiliar (UC por modalidade); uc_residencial (UC da classe residencial das mesmas distribuidoras); "
            "participacao_pct (100 × UC com Tarifa Social ÷ UC residenciais, só distribuidoras sem inconsistência no mês); "
            "excluidas_participacao (distribuidoras fora da participação); dmr_reais (Diferença Mensal de Receita, R$ correntes); "
            "dmr_cde_reais (parcela custeada pela CDE); mwh_tsee (energia faturada das UC com Tarifa Social, MWh). Vazio = ausência."),
        "/energia/series/inclusao_tsee_distribuidoras.csv": (
            "cnpj (14 dígitos); sigla (a mais recente no SCS); mes; uc_tsee; uc_residencial; participacao_pct; dmr_reais; "
            "dmr_por_uc_reais (R$ por UC no mês); kwh_por_uc (energia faturada média por UC com Tarifa Social no mês, kWh); "
            "despacho (despacho ANEEL vigente); residencial_inconsistente (1 = total residencial fora da regra de consistência); "
            "ruptura_incorporacao (1 = primeiro mês em que a distribuidora informa as UC de uma incorporada, regra na gold). Vazio = ausência."),
        "/energia/series/inclusao_cde_mensal_uf.csv": (
            "mes (AAAA-MM do arquivo de Beneficiários da CDE; só meses com o original no bronze); territorio (BR ou sigla da UF); "
            "faturas_tsee (faturas de faturamento, tipo 1, com desconto da Tarifa Social nas subclasses 3.2 a 3.6); desconto_faturas_reais "
            "(soma do desconto dessas faturas, R$ correntes); desconto_medio_por_fatura_reais; desconto_liquido_reais (só BR: subclasses 3.2 "
            "a 3.6, tipos 1 a 4); desconto_fora_das_subclasses_reais (só BR: linhas SubsBaixaRenda de outras subclasses, diagnóstico, fora "
            "do líquido); faturas_municipio_invalido (só BR: formato inválido ou código inexistente, fora das UF); municipios_com_faturas "
            "(UF); cobertura_scs_pct (UC do SCS de referência em distribuidoras presentes no arquivo); mes_completo (1 = cobertura de pelo "
            "menos 99,5%). Vazio = ausência ou não se aplica."),
        "/energia/series/inclusao_municipios.csv": (
            "cod_ibge6 (município, 6 dígitos); municipio; uf; mes_cde (mês do arquivo de Beneficiários da CDE); "
            "faturas_tsee (faturas de faturamento, tipo 1, com desconto da Tarifa Social nas subclasses 3.2 a 3.6; em regra uma por UC no mês, mas a conferência com o SCS mostra distribuidoras com mais faturas que UC); "
            "desconto_reais (soma dos descontos dessas faturas, R$); mes_cadunico; familias_ate_meio_sm_atualizadas; familias_ate_meio_sm; "
            "razao_proxy_atualizadas (100 × faturas ÷ famílias atualizadas); razao_proxy_cadastradas; base_pequena (1 = menos de 50 famílias no denominador). "
            "PROXY: o numerador inclui beneficiários pelo BPC e por equipamento médico, que não estão no denominador. Vazio = ausência."),
        "/energia/series/inclusao_cobertura_mensal.csv": (
            "mes; uc_tsee_scs (UC com Tarifa Social no SCS, só meses completos); familias_ate_meio_sm_atualizadas; familias_ate_meio_sm "
            "(Cadastro Único, soma dos municípios); razao_proxy_atualizadas_pct; razao_proxy_cadastradas_pct. PROXY. Vazio = ausência."),
        "/energia/series/inclusao_tsee_antiga.csv": (
            "regiao; mes (mês de referência trimestral); uc_residencial; uc_baixa_renda; participacao_pct; processado_em (data de processamento declarada no arquivo). "
            "Série descontinuada pela ANEEL; cópia arquivada pelo Internet Archive em 29/07/2024."),
        "/energia/series/inclusao_cde_custeio.csv": (
            "ano; tipo (Despesa ou Receita da CDE); rubrica; valor_reais (R$ correntes, como informado pela ANEEL). "
            "O ano em curso é necessariamente valor orçado."),
        "/energia/series/inclusao_pof.csv": (
            "territorio (BR, região ou UF); classe (código SIDRA da classe de rendimento; 7999 = total); medida; valor; erro_padrao; cv_pct; "
            "fonte (SIDRA 6715, coeficientes publicados ou microdados); estado (publicado, cautela, suprimido; sensibilidade = medidas sens_*: "
            "média das participações na renda sem as famílias com energia acima da renda, número e peso % dessas famílias, "
            "soma das 3 maiores parcelas da média em ponto percentual). Valores em R$ de 15/01/2018 ou %."),
        "/energia/series/inclusao_acesso_pnad.csv": (
            "territorio; ano; situacao (total, urbana, rural); pct_com_energia; cv_pct_com_energia; pct_sem_energia (100 menos pct_com_energia, "
            "uma casa, como na gold; 0,0 quer dizer menos de 0,05%); pct_rede_geral; cv_pct_rede_geral; "
            "pct_integral_entre_rede (percentual dos domicílios ligados à rede geral com fornecimento em tempo integral); cv_pct_integral; "
            "domicilios_mil; domicilios_com_energia_mil; domicilios_sem_energia_mil (diferença calculada; vazio com estado menos_de_1_mil "
            "quando as duas estimativas arredondadas em milhares coincidem); domicilios_sem_energia_estado (calculado, menos_de_1_mil, ausente). Vazio = ausência."),
        "/energia/series/inclusao_sistemas_isolados.csv": (
            "ciclo; sigla; nome; uf; municipio; distribuidora; populacao (pessoas); previsao_interligacao; previsao_interconexao; "
            "programa (programa de universalização informado); latitude; longitude. "
            "O mesmo ciclo mais recente também sai em inclusao_sistemas_isolados_pontos.json (lista de listas, campos declarados no arquivo) para o mapa."),
        "/energia/series/inclusao_cde_mensal_uf.json": (
            "JSON lido sob demanda pela página: {gerado_em, fonte, unidades, meses, ufs, completo, faturas_tsee, desconto_faturas_reais}; "
            "faturas_tsee e desconto_faturas_reais são listas por UF (ordem de ufs) com um valor por mês (ordem de meses); null = UF sem "
            "fatura no mês. Mesmos números de inclusao_cde_mensal_uf.csv."),
        "/energia/series/inclusao_cobertura_mensal.json": (
            "JSON lido sob demanda pela página: {gerado_em, natureza_da_medida, unidade, campos, serie}; serie é a lista de "
            "{m, uc_tsee, familias_atualizadas, familias_cadastradas, razao_atualizadas_pct, razao_cadastradas_pct}, os mesmos "
            "números de inclusao_cobertura_mensal.csv. PROXY. null = ausência."),
        "/energia/series/inclusao_sistemas_isolados_pontos.json": (
            "JSON para o mapa, lido sob demanda: {ciclo, gerado_em, fonte, campos, localidades}; cada localidade é uma lista na ordem "
            "de campos (sigla, nome, uf, municipio, distribuidora, populacao em pessoas, previsao_interligacao, programa, latitude, longitude). "
            "null = ausência."),
        "/energia/series/inclusao_luz_para_todos_mensal.csv": (
            "uf; programa (rural, regioes_remotas = regiões remotas da Amazônia Legal, recurso_distribuidora); mes (AAAA-MM do atendimento); "
            "domicilios (domicílios atendidos, soma de qtddomicilios do MME). Mês sem atendimento não tem linha (não é zero publicado)."),
        "/energia/series/inclusao_luz_para_todos_municipios.csv": (
            "cod_ibge6 (código do município pelo nome exato na UF; vazio = sem correspondência exata); municipio (nome como no arquivo do MME); "
            "uf; programa; ano (do atendimento); domicilios."),
        "/energia/series/inclusao_luz_para_todos_recursos.csv": (
            "uf; contrato; primeira_liberacao e ultima_liberacao (AAAA-MM); vlrempenhadocde, vlrpagocde (subvenção da CDE), "
            "vlrempenhadorgr, vlrpagorgr (empréstimo da RGR), vlrempenhadocaixa, vlrpagocaixa (Caixa ou outras fontes), "
            "vlrempenhadoae, vlrpago (contrapartida do agente executor): R$ correntes, como informados pelo MME. Vazio = ausência."),
    },
}


# ================================================================ utilidades de silver

def _vigentes(con, dataset, prefixo=None):
    """{serie: {ref: valor}} com o valor da captura mais recente de cada (serie, ref)."""
    filtro, extra = "", ()
    if prefixo:
        filtro, extra = "AND o.serie LIKE ?", (prefixo + "%",)
    out = {}
    for serie, ref, valor in con.execute(
        f"""SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
            WHERE o.dataset=? {filtro} ORDER BY v.capturado_em, o.rowid""", (dataset, *extra)):
        out.setdefault(serie, {})[ref] = valor
    return out


def _importado(con, vintage_id):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? AND campo='importado'",
                       (DS_CONTROLE, vintage_id)).fetchone() is not None


def _marca_importado(con, vintage_id, detalhe=""):
    cap = con.execute("SELECT 1 FROM vintages WHERE vintage_id=?", (vintage_id,)).fetchone()
    if cap:
        base.grava_registros(con, DS_CONTROLE, vintage_id, [(vintage_id, "importado", base.agora_utc()),
                                                            (vintage_id, "detalhe", detalhe or None)])


def _salva_bytes(con, orgao, dataset, recurso, url, corpo, ext, publicado_em=None, origem="coleta_direta"):
    """Bronze + vintage para um corpo em memória (respostas pequenas de API)."""
    cap = base.agora_utc()
    arq, sha = base.salva_bronze(orgao.lower(), dataset, recurso, corpo, ext, cap)
    ult = base.ultima_vintage(con, dataset, recurso)
    if ult and ult["sha256"] == sha:
        base.registra_coleta(con, dataset, recurso, True, f"{len(corpo)} bytes, idêntico à vintage {ult['vintage_id']}")
        return ult, False
    vid, _ = base.registra_vintage(con, dataset, recurso, url, cap, publicado_em, sha, len(corpo), origem, arq)
    base.registra_coleta(con, dataset, recurso, True, f"{len(corpo)} bytes, vintage nova")
    return base.ultima_vintage(con, dataset, recurso), True


def _recente(con, dataset, recurso, dias):
    row = con.execute("SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND recurso=? AND ok=1",
                      (dataset, recurso)).fetchone()
    if not row or not row[0]:
        return False
    try:
        t = datetime.fromisoformat(row[0].replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) - t < timedelta(days=dias)


def _baixa_temp(url, sufixo, baixador=http_download):
    """Baixa para um temporário e devolve (caminho, sha256, bytes)."""
    fd, tmp = tempfile.mkstemp(prefix="inclusao-", suffix=sufixo)
    os.close(fd)
    baixador(url, tmp)
    h = hashlib.sha256()
    with open(tmp, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return tmp, h.hexdigest(), os.path.getsize(tmp)


# ================================================================ coleta

def coletar(con, ctx):
    status = {}
    etapas = [("scs", _coleta_scs), ("cde", _coleta_cde), ("antiga", _coleta_antiga), ("custeio", _coleta_custeio),
              ("mds", _coleta_mds), ("pof", _coleta_pof), ("pnad", _coleta_pnad), ("pasi", _coleta_pasi),
              ("luz_para_todos", _coleta_lpt)]
    for nome, f in etapas:
        t0 = time.time()
        try:
            status[nome] = f(con, ctx)
        except Exception as e:  # falha de uma fonte não derruba as demais nem vira número
            status[nome] = {"ok": False, "erro": f"{type(e).__name__}: {e}"[:400]}
        status[nome]["segundos"] = round(time.time() - t0, 1)
        con.commit()
    return status


def _coleta_scs(con, ctx):
    st, meta, vintages = ckan.coleta_pacote(
        con, orgao="ANEEL", nome=PAC_SCS, dataset=DS_SCS, max_idade_dias=7,
        filtro_recurso=lambda r: (r.get("format") or "").upper() in ("CSV", "PDF"))
    importados = 0
    for rec, v in vintages.items():
        if not rec.lower().endswith(".csv") or _importado(con, v["vintage_id"]):
            continue
        escolhidos, diag = fa.le_scs(ckan.le_csv_bronze(v["arquivo"], separador=";"))
        if diag["cabecalho_faltando"]:
            raise ValueError(f"esquema do SCS mudou: faltam {diag['cabecalho_faltando']}")
        novas, rev = base.grava_observacoes(con, DS_SCS, v["vintage_id"], fa.observacoes_scs(escolhidos))
        base.grava_registros(con, DS_SCS, v["vintage_id"], fa.registros_scs(escolhidos))
        _marca_importado(con, v["vintage_id"], json.dumps({k: diag[k] for k in diag if k != "data_geracao"},
                                                          ensure_ascii=False))
        base.grava_registros(con, DS_CONTROLE, v["vintage_id"], [("scs_diagnostico", "json", json.dumps(diag, ensure_ascii=False))])
        importados += 1
        st["observacoes_novas"], st["revisoes"] = novas, rev
    st["importados"] = importados
    return st


def _meses_scs(con):
    """{mes: {cnpj: uc_tsee}} a partir do silver do SCS (total da distribuidora no mês)."""
    out = collections.defaultdict(dict)
    for serie, pts in _vigentes(con, DS_SCS).items():
        partes = serie.split(".")
        if len(partes) != 2 or partes[1] != "uc_tsee":
            continue
        for mes, v in pts.items():
            out[mes][partes[0]] = v
    return out


MINIMO_INFORMANTES = 90   # abaixo disso o SCS ainda não cobre o país (anos de 2011 a 2013)
MESES_CAUDA = 3           # distribuidora que informou nos últimos 3 meses do arquivo ainda está ativa


def completude_scs(meses, minimo=MINIMO_INFORMANTES):
    """Completude de cada mês do SCS: {mes: {"completo", "faltantes": [cnpj...]}}.

    Uma distribuidora é esperada no mês m quando já informou antes de m e (a) volta a
    informar depois de m (a ausência é uma lacuna, não uma saída) ou (b) informou em
    algum dos últimos 3 meses do arquivo (na cauda não há como distinguir saída de
    atraso de homologação, e a ausência conta como falta). Distribuidora que para de
    informar e nunca mais aparece antes da cauda saiu do conjunto (incorporação: RGE
    em 2020, EBO e ENF em 2023, as quatro CPFL menores em 2018) e não torna
    incompletos os meses seguintes, que era o defeito de comparar com a mediana de
    informantes dos meses anteriores.
    Mês completo = nenhuma distribuidora esperada faltando e pelo menos 90 informantes
    (antes de 2014 o SCS tinha poucas distribuidoras)."""
    ordem = sorted(meses)
    if not ordem:
        return {}
    primeiro, ultimo = {}, {}
    for m in ordem:
        for cn in meses[m]:
            primeiro.setdefault(cn, m)
            ultimo[cn] = m
    cauda = _mes_menos(ordem[-1], MESES_CAUDA - 1)
    out = {}
    for m in ordem:
        presentes = meses[m]
        faltantes = sorted(cn for cn in primeiro
                           if cn not in presentes and primeiro[cn] < m and (ultimo[cn] > m or ultimo[cn] >= cauda))
        out[m] = {"completo": len(presentes) >= minimo and not faltantes, "faltantes": faltantes}
    return out


def meses_completos_scs(meses):
    """{mes: True|False} pela regra de completude_scs."""
    return {m: v["completo"] for m, v in completude_scs(meses).items()}


def _coleta_cde(con, ctx):
    st = {"ok": True, "meses": {}}
    pac = ckan.pacote("ANEEL", PAC_CDE)
    meta = ckan.metadados(pac, "ANEEL")
    base.escreve_gold(f"_meta_{DS_CDE}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    recursos = {}
    for r in pac.get("resources", []):
        if (r.get("format") or "").upper() != "ZIP":
            continue
        mes = fa.mes_do_recurso(r.get("url")) or fa.mes_do_recurso(r.get("name"))
        if mes:
            recursos[mes] = r
    # dicionário de dados (PDF) para a evidência de esquema
    for r in pac.get("resources", []):
        if (r.get("format") or "").upper() == "PDF":
            ckan.baixar_recurso(con, orgao="ANEEL", dataset=DS_CDE, recurso=(r.get("name") or "dicionario").strip(),
                                url=r.get("url"), publicado_em=r.get("last_modified"), ext="pdf", max_idade_dias=30)
    if not recursos:
        return {"ok": False, "erro": "nenhum arquivo mensal no pacote"}
    scs = _meses_scs(con)
    compl = meses_completos_scs(scs) if scs else {}
    ref_mes = max((m for m, ok in compl.items() if ok and m in recursos), default=None)
    ref_vol = scs.get(ref_mes, {}) if ref_mes else {}
    st["mes_conferencia"] = ref_mes

    def processa(mes, guardar):
        return _processa_cde_mes(con, recursos[mes], mes, guardar, ref_vol, ref_mes)

    ordem = sorted(recursos, reverse=True)
    if ref_mes:
        st["meses"][ref_mes] = processa(ref_mes, guardar=True)
    # mês mais recente e, se incompleto, os anteriores até o primeiro completo
    mapa = None
    for mes in ordem[:MESES_SONDADOS + 1]:
        info = processa(mes, guardar="se_completo")
        st["meses"][mes] = info
        cob = (info or {}).get("cobertura_scs")
        if cob is not None and cob >= COBERTURA_MINIMA:
            mapa = mes
            break
    # série mensal depois do fim do SCS: todos os meses entre o de conferência e o do mapa, com o
    # original no bronze. É o que mostra a mudança de regra de 05/07/2025, que o SCS não alcança.
    if ref_mes and mapa:
        for mes in sorted(m for m in recursos if ref_mes < m < mapa):
            st["meses"][mes] = processa(mes, guardar=True)
    st["mes_mapa"] = mapa
    st["mes_recente"] = ordem[0]
    return st


def _processa_cde_mes(con, r, mes, guardar, ref_vol, ref_mes):
    """Lê um arquivo mensal de Beneficiários da CDE e grava o agregado no silver.

    guardar: True (sempre guarda o original no bronze), False (só sonda) ou
    "se_completo" (guarda quando a cobertura atinge o mínimo). Mês já processado com a
    mesma data de publicação na fonte não é baixado de novo. O arquivo (cerca de 300 MB
    compactado, 2 GB de CSV) vai para um temporário em disco e é lido em fluxo."""
    rec = (r.get("name") or mes).strip()
    pub = ckan._normaliza_publicacao(r.get("last_modified"))
    ult = base.ultima_vintage(con, DS_CDE, rec)
    info = _info_mes(con, mes)
    if ult and info and ult.get("publicado_em") == pub:
        cob_ant = info.get("cobertura_scs")
        quer = guardar is True or (guardar == "se_completo" and cob_ant is not None and cob_ant >= COBERTURA_MINIMA)
        if ult.get("arquivo") or not quer:
            return info
    tmp, sha, nbytes = _baixa_temp(r.get("url"), ".zip")
    try:
        agg = fa.agrega_cde_zip(tmp)
        pres = {cn for (cn, _, sc, tf) in agg["chaves"] if tf == "1"}
        cob = (sum(v for cn, v in ref_vol.items() if cn in pres) / sum(ref_vol.values())) if ref_vol else None
        quer = guardar is True or (guardar == "se_completo" and cob is not None and cob >= COBERTURA_MINIMA)
        cap = base.agora_utc()
        arquivo = None
        if quer:
            arquivo, sha, nbytes = base.salva_bronze_arquivo("aneel", DS_CDE, rec, tmp, "zip", cap, sha=sha)
        vid, nova = base.registra_vintage(con, DS_CDE, rec, r.get("url"), cap, pub, sha, nbytes, "coleta_direta", arquivo)
        if not nova and arquivo:
            con.execute("UPDATE vintages SET arquivo=? WHERE vintage_id=? AND arquivo IS NULL", (arquivo, vid))
        base.registra_coleta(con, DS_CDE, rec, True, f"{nbytes} bytes; {agg['linhas']} linhas; {agg['linhas_tsee']} da Tarifa Social")
        base.grava_observacoes(con, DS_CDE, vid, fa.observacoes_cde(agg, mes))
        regs = [(mes, "recurso", rec), (mes, "url", r.get("url")), (mes, "sha256", sha), (mes, "bytes", nbytes),
                (mes, "linhas", agg["linhas"]), (mes, "linhas_tsee", agg["linhas_tsee"]),
                (mes, "distribuidoras", len(pres)),
                (mes, "cobertura_scs", None if cob is None else round(cob, 6)), (mes, "mes_referencia_cobertura", ref_mes),
                (mes, "referencias_no_arquivo", json.dumps(agg["referencias"])),
                (mes, "valores_invalidos", agg["valores_invalidos"]),
                (mes, "bronze", "sim" if arquivo else "não (mês sondado; original não guardado)"),
                (mes, "publicado_em", pub),
                (mes, "cabecalho_faltando", ", ".join(agg["cabecalho_faltando"]) or None)]
        regs += [(f"sigla|{cn}", "sigla", s_) for cn, s_ in agg["siglas"].items()]
        base.grava_registros(con, DS_CDE, vid, regs)
        con.commit()
        return _info_mes(con, mes)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def _info_mes(con, mes):
    reg = base.registros_como_estavam_em(con, DS_CDE).get(mes)
    if not reg:
        return None
    out = dict(reg)
    for k in ("cobertura_scs",):
        if out.get(k) not in (None, ""):
            out[k] = float(out[k])
    for k in ("linhas", "linhas_tsee", "distribuidoras", "valores_invalidos"):
        if out.get(k) not in (None, ""):
            out[k] = int(float(out[k]))
    return out


def _coleta_antiga(con, ctx):
    st = {"ok": True}
    # 1) metadados do conjunto descontinuado (nota de substituição)
    try:
        pac = ckan.pacote("ANEEL", PAC_ANTIGA)
        meta = ckan.metadados(pac, "ANEEL")
        base.escreve_gold(f"_meta_{DS_ANTIGA}.json", meta, destino=os.path.join(base.DADOS, "meta"))
        st["titulo"] = meta.get("titulo")
    except Exception as e:
        meta = None
        st["meta_erro"] = str(e)[:200]
    # 2) teste do recurso no portal sem seguir redirecionamento
    teste = _testa_redirecionamento(URL_ANTIGA_CSV)
    st["teste_portal"] = teste
    # 3) cópia arquivada (Internet Archive), identificada como tal
    rec = "tarifasocial.csv (cópia arquivada em 29/07/2024)"
    ult = base.ultima_vintage(con, DS_ANTIGA, rec)
    if ult is None:
        corpo, _ = http_get(URL_ANTIGA_ARQUIVADA, accept="*/*", timeout=90)
        v, _ = _salva_bytes(con, "ANEEL", DS_ANTIGA, rec, URL_ANTIGA_ARQUIVADA, corpo, "csv",
                            publicado_em="2021-11-30T19:18:37Z", origem="copia_arquivada")
    else:
        v = ult
    if not _importado(con, v["vintage_id"]):
        texto = base.abre_bronze(v["arquivo"]).read().decode("utf-8-sig")
        pts = fa.le_ts_antiga(texto)
        obs = []
        for reg, mes, res, br, _ in pts:
            obs += [(f"{reg}.uc_residencial", mes, res), (f"{reg}.uc_baixa_renda", mes, br)]
        base.grava_observacoes(con, DS_ANTIGA, v["vintage_id"], obs)
        base.grava_registros(con, DS_ANTIGA, v["vintage_id"], [(f"{reg}|{mes}", "processado_em", p) for reg, mes, _, _, p in pts])
        _marca_importado(con, v["vintage_id"], f"{len(pts)} linhas")
    evid = [("portal", "teste_status", teste.get("status")), ("portal", "teste_location", teste.get("location")),
            ("portal", "teste_conclusao", teste.get("conclusao")), ("portal", "testado_em", teste.get("testado_em")),
            ("portal", "notas", (meta or {}).get("notas")), ("portal", "titulo", (meta or {}).get("titulo"))]
    base.grava_registros(con, DS_ANTIGA, v["vintage_id"], evid)
    return st


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _testa_redirecionamento(url):
    """Pede o recurso sem seguir redirecionamento e registra o que a fonte responde."""
    abre = urllib.request.build_opener(_SemRedirecionar())
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    out = {"url": url, "testado_em": base.agora_utc()}
    try:
        with abre.open(req, timeout=60) as r:
            out.update(status=r.status, location=None, conclusao="recurso respondeu sem redirecionar")
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location")
        out.update(status=e.code, location=loc)
        if e.code in (301, 302, 303, 307, 308) and loc and loc.rstrip("/") == url.rstrip("/"):
            out["conclusao"] = "laço de redirecionamento: o recurso aponta para a própria URL"
        else:
            out["conclusao"] = f"HTTP {e.code}"
    except Exception as e:
        out.update(status=None, location=None, conclusao=f"sem resposta: {type(e).__name__}")
    return out


def _coleta_custeio(con, ctx):
    st, meta, vintages = ckan.coleta_pacote(
        con, orgao="ANEEL", nome=PAC_CUSTEIO, dataset=DS_CUSTEIO, max_idade_dias=7,
        filtro_recurso=lambda r: (r.get("format") or "").upper() in ("CSV", "PDF"))
    for rec, v in vintages.items():
        if not rec.lower().endswith(".csv") or _importado(con, v["vintage_id"]):
            continue
        linhas = fa.le_cde_custeio(ckan.le_csv_bronze(v["arquivo"], separador=";"))
        obs = [(f"{tipo}|{fonte.strip()}", ano, val) for ano, tipo, fonte, val in linhas]
        base.grava_observacoes(con, DS_CUSTEIO, v["vintage_id"], obs)
        _marca_importado(con, v["vintage_id"], f"{len(linhas)} linhas")
    return st


def _coleta_mds(con, ctx):
    st = {"ok": True}
    # totais nacionais por mês (estatísticas do serviço)
    rec = "totais_mensais"
    if not _recente(con, DS_MDS, rec, 7):
        url = fm.URL_MISOCIAL + "?" + urllib.parse.urlencode(fm.params_totais())
        corpo, _ = http_get(url, timeout=120)
        v, nova = _salva_bytes(con, "MDS", DS_MDS, rec, url, corpo, "json")
        if nova or not _importado(con, v["vintage_id"]):
            tot = fm.le_totais(corpo.decode("utf-8"))
            obs = []
            for (campo, mes), (soma, n, falt) in tot.items():
                obs += [(f"BR.{campo}", mes, soma), (f"BR.{campo}.municipios", mes, float(n))]
            base.grava_observacoes(con, DS_MDS, v["vintage_id"], obs)
            _marca_importado(con, v["vintage_id"], f"{len(tot)} pares")
        st["totais"] = "atualizado"
    # municipal: só o mês do mapa (o único usado no denominador municipal); os meses da série
    # mensal da CDE não precisam do cadastro por município
    infos = {m: i for m, i in base.registros_como_estavam_em(con, DS_CDE).items() if re.fullmatch(r"\d{4}-\d{2}", m)}
    completos = [m for m, i in infos.items() if (i.get("bronze") or "").startswith("sim")
                 and float(i.get("cobertura_scs") or 0) >= COBERTURA_MINIMA]
    meses = [max(completos)] if completos else []
    st["meses_municipais"] = []
    for mes in meses:
        rec = f"municipios_{mes}"
        if _recente(con, DS_MDS, rec, 30):
            continue
        am = mes.replace("-", "")
        url = fm.URL_MISOCIAL + "?" + urllib.parse.urlencode(fm.params_municipios(am))
        corpo, _ = http_get(url, timeout=120, accept="*/*")
        v, nova = _salva_bytes(con, "MDS", DS_MDS, rec, url, corpo, "csv")
        if nova or not _importado(con, v["vintage_id"]):
            linhas = fm.le_municipios(corpo.decode("utf-8"))
            obs, regs = [], []
            for cod, m, nome, uf, vals in linhas:
                for k, x in vals.items():
                    if x is not None:
                        obs.append((f"{cod}.{k}", m, x))
                regs += [(cod, "municipio", nome), (cod, "uf", uf)]
            base.grava_observacoes(con, DS_MDS, v["vintage_id"], obs)
            base.grava_registros(con, DS_MDS, v["vintage_id"], regs)
            _marca_importado(con, v["vintage_id"], f"{len(linhas)} municípios")
        st["meses_municipais"].append(mes)
        time.sleep(0.5)
    return st


def _coleta_pof(con, ctx):
    st = {"ok": True}
    # tabela 6715
    rec = "tabela_6715"
    if not _recente(con, DS_POF, rec, 30):
        corpo, _ = http_get(fi.URL_POF_6715, timeout=120)
        v, nova = _salva_bytes(con, "IBGE", DS_POF, rec, fi.URL_POF_6715, corpo, "json")
        if nova or not _importado(con, v["vintage_id"]):
            pts = fi.le_pof_6715(corpo.decode("utf-8"))
            base.grava_observacoes(con, DS_POF, v["vintage_id"],
                                   [(f"{t}.{cl}.{tp}.{var}", "2017-2018", x) for t, cl, tp, var, x in pts])
            _marca_importado(con, v["vintage_id"], f"{len(pts)} valores")
    # coeficientes de variação publicados (Brasil)
    rec = "tabelas_despesas_xls_20191108.zip"
    ult = base.ultima_vintage(con, DS_POF_CV, rec)
    if ult is None:
        res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_POF_CV, recurso=rec, url=URL_POF_TABELAS, ext="zip",
                                  max_idade_dias=3650)
        ult = res["vintage"]
    if ult and not _importado(con, ult["vintage_id"]):
        z = __import__("zipfile").ZipFile(base.abre_bronze(ult["arquivo"]))
        nome = next(n for n in z.namelist() if "Coeficientes" in n)
        cv = fi.le_cv_pof(fp.ler_xlsx(z.read(nome))["Tabela 1"])
        ordem_cl = ["7999", "47558", "47559", "47560", "47561", "47562", "47563", "47564"]
        obs = [(f"BR.{cl}.{tipo}.cv", "2017-2018", x) for tipo, vals in cv.items()
               for cl, x in zip(ordem_cl, vals) if x is not None]
        base.grava_observacoes(con, DS_POF_CV, ult["vintage_id"], obs)
        _marca_importado(con, ult["vintage_id"], f"{len(obs)} coeficientes; membro {nome}")
    # microdados e tradutor
    html, _ = http_get(URL_POF_MICRO_DIR, accept="text/html", timeout=60)
    nomes = re.findall(r'href="((?:Dados|Tradutores)_\d{8}\.zip)"', html.decode("utf-8", "replace"))
    dados = sorted(n for n in nomes if n.startswith("Dados_"))[-1:]
    trad = sorted(n for n in nomes if n.startswith("Tradutores_"))[-1:]
    if not dados or not trad:
        return {"ok": False, "erro": "arquivos de microdados não encontrados na listagem do FTP"}
    vint = {}
    for nome in dados + trad:
        ult = base.ultima_vintage(con, DS_POF_MICRO, nome)
        if ult is None:
            res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_POF_MICRO, recurso=nome, url=URL_POF_MICRO_DIR + nome,
                                      ext="zip", max_idade_dias=3650)
            ult = res["vintage"]
        vint[nome] = ult
    vd, vt = vint[dados[0]], vint[trad[0]]
    st["microdados"] = dados[0]
    # a chave leva a versão do estimador: medida nova (sensibilidade) reprocessa os mesmos microdados
    chave = f"{vd['vintage_id']}+{vt['vintage_id']}#{ESTIMADOR_POF}"
    if not _importado(con, chave):
        estimativas, diag = _estimativas_pof(vd["arquivo"], vt["arquivo"])
        base.grava_observacoes(con, DS_POF_MICRO, vd["vintage_id"],
                               [(k, "2017-2018", x) for k, x in estimativas.items() if x is not None])
        base.grava_registros(con, DS_CONTROLE, vd["vintage_id"], [(chave, "importado", base.agora_utc()),
                                                                 (chave, "diagnostico", json.dumps(diag, ensure_ascii=False))])
        st["estimativas"] = len(estimativas)
    return st


def _coleta_pnad(con, ctx):
    st = {"ok": True}
    for tab, url in (("6737", fi.URL_PNAD_6737), ("6738", fi.URL_PNAD_6738), ("6731", fi.URL_PNAD_6731)):
        rec = f"tabela_{tab}"
        if _recente(con, DS_PNAD, rec, 7):
            continue
        corpo, _ = http_get(url, timeout=120)
        v, nova = _salva_bytes(con, "IBGE", DS_PNAD, rec, url, corpo, "json")
        if nova or not _importado(con, v["vintage_id"]):
            pts = fi.le_pnad(corpo.decode("utf-8"), tab)
            base.grava_observacoes(con, DS_PNAD, v["vintage_id"],
                                   [(f"{tab}.{t}.{s}.{fo}.{var}", ano, x) for t, ano, s, var, fo, x in pts])
            _marca_importado(con, v["vintage_id"], f"{len(pts)} valores")
        st[tab] = "atualizado"
    return st


def _coleta_pasi(con, ctx):
    st = {"ok": True, "ciclos": []}
    html, _ = http_get(fe.URL_DOWNLOADS, accept="text/html", timeout=60)
    ciclos = fe.ciclos_publicados(html.decode("utf-8", "replace"))
    if not ciclos:
        return {"ok": False, "erro": "lista de ciclos não encontrada na página de downloads do PASI"}
    for cod, ano in ciclos:
        rec = f"localizacao_ciclo_{ano}"
        if _recente(con, DS_PASI, rec, 7):
            st["ciclos"].append(ano)
            continue
        url = fe.URL_LOCALIZACAO.format(cod=cod)
        corpo, _ = http_get(url, accept="*/*", timeout=120)
        v, nova = _salva_bytes(con, "EPE", DS_PASI, rec, url, corpo, "xlsx")
        if nova or not _importado(con, v["vintage_id"]):
            locs, falt = fe.le_localidades(fp.ler_xlsx(corpo))
            if falt:
                raise ValueError(f"esquema da exportação do PASI mudou: faltam {falt}")
            regs, obs = [], []
            for l in locs:
                ch = f"{ano}|{l['sigla']}"
                for k in ("uf", "municipio", "distribuidora", "previsao_interligacao", "previsao_interconexao",
                          "programa", "nome", "ciclo"):
                    regs.append((ch, k, l[k]))
                for k in ("populacao", "latitude", "longitude"):
                    if l[k] is not None:
                        obs.append((f"{l['sigla']}.{k}", str(ano), l[k]))
            base.grava_registros(con, DS_PASI, v["vintage_id"], regs)
            base.grava_observacoes(con, DS_PASI, v["vintage_id"], obs)
            _marca_importado(con, v["vintage_id"], f"{len(locs)} localidades")
        st["ciclos"].append(ano)
    st["caderno"] = _coleta_caderno_pasi(con)
    return st


def _coleta_caderno_pasi(con):
    """Caderno do ciclo 2025 (PDF da EPE) no bronze e os totais declarados no texto,
    extraídos com pdftotext; servem só para conferir a exportação do PASI."""
    import shutil
    import subprocess
    rec = "caderno_planejamento_sisol_ciclo_2025.pdf"
    res = ckan.baixar_recurso(con, orgao="EPE", dataset=DS_PASI, recurso=rec, url=fe.URL_CADERNO_2025, ext="pdf",
                              max_idade_dias=365)
    v = res["vintage"]
    if not v or _importado(con, v["vintage_id"]):
        return res["status"]
    if not shutil.which("pdftotext"):
        return "pdftotext ausente: conferência com o caderno não extraída"
    fd, tmp = tempfile.mkstemp(prefix="inclusao-sisol-", suffix=".pdf")
    os.close(fd)
    try:
        with base.abre_bronze(v["arquivo"]) as src, open(tmp, "wb") as dst:
            for bloco in iter(lambda: src.read(1 << 20), b""):
                dst.write(bloco)
        texto = subprocess.run(["pdftotext", "-layout", tmp, "-"], capture_output=True, timeout=120,
                               check=True).stdout.decode("utf-8", "replace")
    finally:
        os.remove(tmp)
    tot = fe.le_totais_caderno(texto)
    base.grava_registros(con, DS_PASI, v["vintage_id"], [("caderno_2025", k, None if x is None else str(x))
                                                         for k, x in tot.items()])
    _marca_importado(con, v["vintage_id"], json.dumps(tot))
    return tot


ESTIMADOR_POF = "estimador2"  # 1: medidas originais; 2: sensibilidade da média das participações na renda
LEITOR_LPT = "leitor3"  # versão do leitor do Luz para Todos (1: programas não reconhecidos por causa do hífen; 2: diagnóstico sem versão)


def _coleta_lpt(con, ctx):
    """Luz para Todos (portal de dados abertos do MME, CKAN próprio): domicílios atendidos
    por município e mês, recursos por contrato e o dicionário em PDF."""
    st = {"ok": True, "novas": 0, "falhas": []}
    corpo, _ = http_get(fl.URL_PACKAGE_SHOW, timeout=60)
    pac = json.loads(corpo.decode("utf-8"))
    if not pac.get("success"):
        return {"ok": False, "erro": "package_show do MME: success=false"}
    pac = pac["result"]
    # ckan.metadados só conhece os portais da ANEEL e do ONS: o dicionário é montado aqui
    meta = {"titulo": pac.get("title"), "nome": pac.get("name"), "licenca": pac.get("license_title"),
            "licenca_url": pac.get("license_url"), "modificado": pac.get("metadata_modified"),
            "notas": (pac.get("notes") or "").strip()[:4000], "url": fl.URL_DATASET,
            "recursos": [{"id": r.get("id"), "nome": r.get("name"), "formato": r.get("format"), "url": r.get("url"),
                          "tamanho": r.get("size"), "last_modified": r.get("last_modified") or r.get("metadata_modified")}
                         for r in pac.get("resources", [])]}
    base.escreve_gold(f"_meta_{DS_LPT}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    for r in pac.get("resources", []):
        fmt = (r.get("format") or "").upper()
        if fmt not in ("CSV", "PDF"):
            continue
        rec = (r.get("name") or r.get("url", "").rsplit("/", 1)[-1]).strip()
        res = ckan.baixar_recurso(con, orgao="MME", dataset=DS_LPT, recurso=rec, url=r.get("url"),
                                  publicado_em=r.get("last_modified") or r.get("metadata_modified"),
                                  ext=fmt.lower(), max_idade_dias=7)
        if res["status"] == "falha":
            st["falhas"].append(f"{rec}: {res['detalhe']}")
        v = res["vintage"]
        # a chave de importação leva a versão do leitor: correção no leitor reimporta a mesma vintage
        chave_imp = f"{v['vintage_id']}#{LEITOR_LPT}" if v else None
        if not v or fmt != "CSV" or _importado(con, chave_imp):
            continue
        linhas = ckan.le_csv_bronze(v["arquivo"], encoding="latin-1", separador=";")
        if rec.startswith("domicilios"):
            agg, diag = fl.agrega_domicilios(linhas)
            if diag["cabecalho_faltando"]:
                raise ValueError(f"esquema de domicilios_atendidos.csv mudou: faltam {diag['cabecalho_faltando']}")
            obs = [(f"{uf}.{prog}", ref, float(q)) for (uf, prog, ref), q in agg["mensal"].items()]
            obs += [(f"M|{uf}|{nn}|{prog}", ano, float(q)) for (uf, nn, prog, ano), q in agg["municipal"].items()]
            base.grava_observacoes(con, DS_LPT, v["vintage_id"], obs)
            base.grava_registros(con, DS_LPT, v["vintage_id"], [(f"{uf}|{nn}", "nome", nome) for (uf, nn), nome in agg["nomes"].items()])
        elif rec.startswith("recursos"):
            contratos, diag = fl.le_recursos(linhas)
            if diag["cabecalho_faltando"]:
                raise ValueError(f"esquema de recursos_aplicados.csv mudou: faltam {diag['cabecalho_faltando']}")
            chaves = collections.Counter((k["contrato"], k["uf"]) for k in contratos)
            diag["contratos_repetidos"] = sum(1 for n in chaves.values() if n > 1)
            obs, regs = [], []
            vistos = collections.Counter()
            for k in contratos:
                vistos[(k["contrato"], k["uf"])] += 1
                ch = f"R|{k['uf']}|{k['contrato']}|{vistos[(k['contrato'], k['uf'])]}"
                obs += [(f"{ch}.{campo}", "total", x) for campo, x in k["valores"].items() if x is not None]
                regs += [(ch, "inicio", k["inicio"]), (ch, "fim", k["fim"])]
            base.grava_observacoes(con, DS_LPT, v["vintage_id"], obs)
            base.grava_registros(con, DS_LPT, v["vintage_id"], regs)
        else:
            continue
        base.grava_registros(con, DS_CONTROLE, v["vintage_id"], [(f"lpt|{rec}|{LEITOR_LPT}", "diagnostico", json.dumps(diag, ensure_ascii=False)),
                                                                (chave_imp, "importado", base.agora_utc())])
        st["novas"] += 1
    st["ok"] = not st["falhas"]
    return st


# ================================================================ POF: estimação com plano amostral

def _estimativas_pof(arq_dados, arq_trad):
    """Refaz a despesa por família a partir dos microdados e calcula as estimativas
    publicadas no painel P061, com erros-padrão por linearização (estrato ESTRATO_POF,
    unidade primária COD_UPA, pesos PESO_FINAL). Devolve {chave: valor} e o diagnóstico."""
    import zipfile
    zt = zipfile.ZipFile(base.abre_bronze(arq_trad))
    nome_t = next(n for n in zt.namelist() if "Despesa_Geral" in n)
    tradutor = fi.le_tradutor_despesa(next(iter(fp.ler_xls(zt.read(nome_t)).values())))
    # o ZIP de microdados (cerca de 146 MB) vai para um temporário em disco, não para a
    # memória: o zipfile lê cada registro em fluxo a partir do arquivo
    fd, tmp = tempfile.mkstemp(prefix="inclusao-pof-", suffix=".zip")
    os.close(fd)
    try:
        with base.abre_bronze(arq_dados) as bruto, open(tmp, "wb") as dst:
            for bloco in iter(lambda: bruto.read(1 << 20), b""):
                dst.write(bloco)
        familias, diag = fi.familias_pof(tmp, tradutor)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    for f in familias.values():
        f["classe"] = fi.classe_renda(f["renda"])
        f["regiao"] = fi.REGIAO_CODIGO.get(f["uf"][:1])
        f["sigla_uf"] = fi.UF_SIGLA.get(f["uf"])
    return estimativas_pof(list(familias.values())), diag


class Plano:
    """Estrutura do plano amostral: UPAs (COD_UPA) por estrato (ESTRATO_POF). Uma UPA
    sem família no domínio contribui com zero, mas continua contando no seu estrato:
    é o que torna correto o erro-padrão de um domínio (subpopulação)."""

    def __init__(self, fams):
        upas = collections.defaultdict(set)
        for f in fams:
            upas[f["estrato"]].add(f["upa"])
        self.n_estrato = {h: len(u) for h, u in upas.items()}
        self.estrato_da_upa = {u: h for h, us in upas.items() for u in us}

    def razao(self, membros, y, x):
        """R = Σw·y / Σw·x no domínio `membros` e erro-padrão por linearização de Taylor
        (variáveis linearizadas z = (y − R·x) / X̂, totais por UPA, variância entre UPAs
        dentro do estrato, com reposição). Devolve (R, ep, n_amostra, soma_pesos_x)."""
        Y = X = 0.0
        for f in membros:
            Y += f["peso"] * y(f)
            X += f["peso"] * x(f)
        if not membros or X == 0:
            return None, None, len(membros), X
        R = Y / X
        z_upa = collections.defaultdict(float)
        for f in membros:
            z_upa[f["upa"]] += f["peso"] * (y(f) - R * x(f)) / X
        soma = collections.defaultdict(float)
        soma2 = collections.defaultdict(float)
        for u, z in z_upa.items():
            h = self.estrato_da_upa[u]
            soma[h] += z
            soma2[h] += z * z
        V = 0.0
        for h in soma:
            n_h = self.n_estrato[h]
            if n_h < 2:
                continue
            media = soma[h] / n_h
            V += n_h / (n_h - 1) * (soma2[h] - n_h * media * media)
        return R, math.sqrt(max(V, 0.0)), len(membros), X


def _mediana_ponderada(pares):
    pares = sorted(pares)
    tot = sum(w for _, w in pares)
    if not tot:
        return None
    acc = 0.0
    for v, w in pares:
        acc += w
        if acc >= tot / 2:
            return v
    return pares[-1][0]


def estimativas_pof(fams):
    """Estimativas por território (BR, regiões e UF) e classe de rendimento (classes só
    no Brasil e nas regiões: por UF a amostra de cada classe é pequena demais).

    Chaves '<terr>.<classe>.<medida>'; medidas: n (famílias na amostra), familias (soma
    dos pesos), energia_media(+_ep) e despesa_media (R$ por família e mês),
    razao_medias_pct(+_ep) (100 × média da energia ÷ média da despesa total, a mesma
    medida da distribuição publicada pelo IBGE), media_razoes_desp_pct(+_ep) e
    media_razoes_renda_pct(+_ep) (média das participações de cada família),
    mediana_desp_pct, mediana_renda_pct, sem_despesa_energia_pct(+_ep) e
    acima_<L>_renda_pct / acima_<L>_desp_pct (+_ep), para L em LIMIARES.
    Participações individuais só para famílias com despesa total (ou renda) positiva.
    Sensibilidade da média das participações na renda (sens_*): a mesma média sem as
    famílias com despesa de energia acima da renda, o número e o peso % dessas famílias e a
    soma das 3 maiores parcelas da média, em ponto percentual."""
    plano = Plano(fams)
    out = {}
    um = lambda f: 1.0  # noqa: E731
    energia = lambda f: f["energia"]  # noqa: E731
    classes = [("7999", None)] + [(cod, i) for cod, (i, _, _, _) in fi.CLASSES_POF.items() if i is not None]
    dominios = [("BR", lambda f: True, True)]
    dominios += [(r, (lambda f, r=r: f["regiao"] == r), True) for r in REGIOES]
    dominios += [(uf, (lambda f, uf=uf: f["sigla_uf"] == uf), False) for uf in UF_NOME]
    for terr, pertence, por_classe in dominios:
        do_terr = [f for f in fams if pertence(f)]
        for cod, idx in classes:
            if idx is not None and not por_classe:
                continue
            m = do_terr if idx is None else [f for f in do_terr if f["classe"] == idx]
            if not m:
                continue
            k = f"{terr}.{cod}"
            R, ep, n, W = plano.razao(m, energia, um)
            out[f"{k}.n"], out[f"{k}.familias"] = float(n), W
            out[f"{k}.energia_media"], out[f"{k}.energia_media_ep"] = R, ep
            out[f"{k}.despesa_media"] = plano.razao(m, lambda f: f["despesa"], um)[0]
            R2, ep2, _, _ = plano.razao(m, energia, lambda f: f["despesa"])
            out[f"{k}.razao_medias_pct"], out[f"{k}.razao_medias_pct_ep"] = _pct(R2), _pct(ep2)
            md = [f for f in m if f["despesa"] > 0]
            mr = [f for f in m if (f["renda"] or 0) > 0]
            R3, ep3, _, _ = plano.razao(md, lambda f: f["energia"] / f["despesa"], um)
            out[f"{k}.media_razoes_desp_pct"], out[f"{k}.media_razoes_desp_pct_ep"] = _pct(R3), _pct(ep3)
            R4, ep4, _, _ = plano.razao(mr, lambda f: f["energia"] / f["renda"], um)
            out[f"{k}.media_razoes_renda_pct"], out[f"{k}.media_razoes_renda_pct_ep"] = _pct(R4), _pct(ep4)
            # sensibilidade da média das participações na renda: famílias com renda declarada quase
            # nula geram razões enormes (despesa com energia acima da renda) e puxam a média
            W_r = sum(f["peso"] for f in mr)
            acima = [f for f in mr if f["energia"] > f["renda"]]
            out[f"{k}.sens_renda_familias_energia_acima_da_renda_n"] = float(len(acima))
            out[f"{k}.sens_renda_familias_energia_acima_da_renda_peso_pct"] = (
                100 * sum(f["peso"] for f in acima) / W_r if W_r else None)
            R6, ep6, _, _ = plano.razao([f for f in mr if f["energia"] <= f["renda"]], lambda f: f["energia"] / f["renda"], um)
            out[f"{k}.sens_media_razoes_renda_sem_acima_da_renda_pct"] = _pct(R6)
            out[f"{k}.sens_media_razoes_renda_sem_acima_da_renda_pct_ep"] = _pct(ep6)
            maiores = sorted((f["peso"] * f["energia"] / f["renda"] for f in mr), reverse=True)[:3]
            out[f"{k}.sens_media_razoes_renda_3_maiores_pp"] = 100 * sum(maiores) / W_r if W_r else None
            out[f"{k}.mediana_desp_pct"] = _pct(_mediana_ponderada([(f["energia"] / f["despesa"], f["peso"]) for f in md]))
            out[f"{k}.mediana_renda_pct"] = _pct(_mediana_ponderada([(f["energia"] / f["renda"], f["peso"]) for f in mr]))
            R5, ep5, _, _ = plano.razao(m, lambda f: 1.0 if f["energia"] <= 0 else 0.0, um)
            out[f"{k}.sem_despesa_energia_pct"], out[f"{k}.sem_despesa_energia_pct_ep"] = _pct(R5), _pct(ep5)
            for L in LIMIARES:
                lim = L / 100
                Rr, epr, _, _ = plano.razao(mr, lambda f, lim=lim: 1.0 if f["energia"] / f["renda"] > lim else 0.0, um)
                Rd, epd, _, _ = plano.razao(md, lambda f, lim=lim: 1.0 if f["energia"] / f["despesa"] > lim else 0.0, um)
                out[f"{k}.acima_{int(L)}_renda_pct"], out[f"{k}.acima_{int(L)}_renda_pct_ep"] = _pct(Rr), _pct(epr)
                out[f"{k}.acima_{int(L)}_desp_pct"], out[f"{k}.acima_{int(L)}_desp_pct_ep"] = _pct(Rd), _pct(epd)
    return out


def _pct(x):
    return None if x is None else 100 * x


# ================================================================ gold

def construir(con, ctx):
    try:
        scs = _vigentes(con, DS_SCS)
        if not scs:
            return c.stub(GOLD, "SCS ausente no silver da família aneel_social")
        blocos = {}
        blocos["tarifa_social"], ctx_ts = _bloco_tarifa_social(con, scs)
        blocos["cobertura"] = _bloco_cobertura(con, ctx_ts)
        blocos["orcamento"] = _bloco_orcamento(con)
        blocos["acesso"] = _bloco_acesso(con, ctx_ts)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return c.stub(GOLD, f"falha na construção da gold de inclusão: {type(e).__name__}: {e}")
    faltam = [k for k, v in blocos.items() if not v]
    if faltam:
        return c.stub(GOLD, f"blocos sem dado: {faltam}")
    criticos, ressalvas = validar_gold(blocos, datetime.now(timezone.utc).strftime("%Y-%m"))
    blocos["tarifa_social"].pop("_serie_cde_uf", None)
    if criticos:
        # violação crítica: a sentinela mantém a última publicação válida
        return c.stub(GOLD, "validação física e de domínio: " + "; ".join(criticos[:5]))
    return {
        **c.cabecalho(GOLD),
        "referencias": ctx_ts["referencias"],
        **blocos,
        "validacao": {"executada_em": base.agora_utc(), "criticos": criticos, "ressalvas": ressalvas},
        "downloads": [{"rotulo": _rotulo_csv(u), "url": u} for u in REGISTRO["arquivos"]],
    }


def validar_gold(b, mes_atual):
    """Limites físicos e de domínio (seção 5.2 do contrato) sobre os blocos prontos.
    Devolve (criticos, ressalvas): crítico impede a publicação; ressalva fica visível."""
    crit, ress = [], []

    def pct(nome, v, critico=True):
        if v is not None and not 0 <= v <= 100:
            (crit if critico else ress).append(f"{nome} fora de 0 a 100: {v}")

    def nao_neg(nome, v):
        if v is not None and v < 0:
            crit.append(f"{nome} negativo: {v}")

    ts, cob, orc, ac = b["tarifa_social"], b["cobertura"], b["orcamento"], b["acesso"]
    for l in ts["serie_mensal"]:
        pct(f"participação {l['m']}", l["participacao_pct"])
        for k in ("uc_tsee", "dmr_reais", "mwh_tsee"):
            nao_neg(f"{k} {l['m']}", l[k])
        if l["m"] > mes_atual:
            crit.append(f"mês futuro na série do SCS: {l['m']}")
    cnpjs = [d["cnpj"] for d in ts["distribuidoras"]]
    if len(cnpjs) != len(set(cnpjs)):
        crit.append("CNPJ repetido na tabela de distribuidoras")
    for d in ts["distribuidoras"]:
        pct(f"participação {d['sigla']}", d["participacao_pct"], critico=False)
        if d["uc_residencial"] is not None and d["uc_tsee"] is not None and d["uc_tsee"] > d["uc_residencial"] and not d["residencial_inconsistente"]:
            crit.append(f"{d['sigla']}: UC com Tarifa Social acima das residenciais sem marca de inconsistência")
    if ts["mes_mapa"]:
        mm = next(m for m in ts["cde_meses"] if m["mes"] == ts["mes_mapa"])
        if abs(sum(u["faturas_tsee"] for u in ts["ufs"]) + mm["faturas_municipio_invalido"] - mm["faturas_tsee"]) > 0.5:
            crit.append("faturas por UF mais inválidas não fecham com o total do arquivo")
    su = ts.get("_serie_cde_uf") or {}
    por_mes_cde = {m["mes"]: m for m in ts["cde_meses"]}
    for i, mes in enumerate(su.get("meses", [])):
        m = por_mes_cde[mes]
        soma = sum(linha[i] or 0 for linha in su["faturas_tsee"])
        if abs(soma + (m["faturas_municipio_invalido"] or 0) - (m["faturas_tsee"] or 0)) > 0.5:
            crit.append(f"CDE {mes}: faturas por UF mais inválidas não fecham com o total")
    for m in ts["cde_meses"]:
        tem_valor = m["faturas_tsee"] is not None
        if tem_valor != m["original_no_bronze"]:
            crit.append(f"CDE {m['mes']}: valores publicados sem o original no bronze (ou o contrário)")
        for k in ("faturas_tsee", "desconto_faturas_reais"):
            nao_neg(f"CDE {m['mes']} {k}", m.get(k))
    ufs = [u["uf"] for u in ts["ufs"]]
    if len(ufs) != len(set(ufs)):
        crit.append("UF repetida no mapa da Tarifa Social")
    # o arquivo da CDE pode trazer desconto líquido negativo numa UF no mês (a fonte não diz o motivo): o valor fica como publicado,
    # sem correção, e a ressalva diz onde está para a página nunca mostrá-lo como um desconto comum
    for u in ts["ufs"]:
        for k, rotulo in (("desconto_reais", "desconto"), ("desconto_medio_por_fatura_reais", "desconto médio por fatura")):
            if u.get(k) is not None and u[k] < 0:
                ress.append(f"{u['uf']}: {rotulo} negativo no arquivo da CDE de {ts.get('mes_mapa')} ({u[k]}); mantido como publicado, sem correção")
    br = cob.get("brasil") or {}
    if br.get("razao_cadastradas_pct") is not None and br.get("razao_atualizadas_pct") is not None \
            and br["razao_cadastradas_pct"] > br["razao_atualizadas_pct"]:
        crit.append("razão com todas as cadastradas acima da razão com as atualizadas (denominador menor)")
    for u in cob.get("ufs", []):
        if u["razao_atualizadas_pct"] is not None and u["razao_atualizadas_pct"] > 100:
            ress.append(f"cobertura proxy acima de 100% em {u['uf']} ({u['razao_atualizadas_pct']}%): numerador inclui BPC e equipamento médico")
    for l in orc["linhas"]:
        for med, (v, cv, est) in l["microdados"].items():
            if med.endswith("_pct"):
                pct(f"POF {l['territorio']} {l['classe']} {med}", v)
            else:
                nao_neg(f"POF {l['territorio']} {l['classe']} {med}", v)
    for l in ac["pnad_serie"] + ac["pnad_situacao"]:
        for k in ("pct_com_energia", "pct_rede_geral", "pct_integral_entre_rede"):
            pct(f"PNAD {l['territorio']} {l['ano']} {k}", l[k])
        if l["domicilios_sem_energia_mil"] is not None and l["domicilios_sem_energia_mil"] < 0:
            crit.append(f"PNAD {l['territorio']} {l['ano']}: domicílios com energia acima do total")
    lpt = (ac.get("universalizacao") or {}).get("luz_para_todos")
    if lpt:
        if lpt["ultimo_mes"] > mes_atual:
            crit.append(f"Luz para Todos com mês de atendimento futuro: {lpt['ultimo_mes']}")
        for a in lpt["serie_anual"]:
            nao_neg(f"Luz para Todos {a['ano']}", a["total"])
    iso = ac.get("sistemas_isolados") or {}
    conf = iso.get("conferencia_pdf")
    if conf and conf.get("resultado") != "aprovado":
        ress.append("exportação do PASI diverge do caderno em PDF do ciclo 2025")
    return crit, ress


def _rotulo_csv(u):
    return {
        "/energia/series/inclusao_tsee_mensal.csv": "Tarifa Social: série mensal nacional (SCS)",
        "/energia/series/inclusao_tsee_distribuidoras.csv": "Tarifa Social por distribuidora e mês (SCS)",
        "/energia/series/inclusao_municipios.csv": "Municípios: faturas com Tarifa Social e Cadastro Único (proxy)",
        "/energia/series/inclusao_cde_mensal_uf.csv": "Tarifa Social: faturas e desconto por mês e UF (Beneficiários da CDE)",
        "/energia/series/inclusao_cde_mensal_uf.json": "Tarifa Social: faturas e desconto por mês e UF (JSON do gráfico)",
        "/energia/series/inclusao_cobertura_mensal.csv": "Cobertura potencial nacional por mês (proxy)",
        "/energia/series/inclusao_cobertura_mensal.json": "Cobertura potencial nacional por mês (JSON do gráfico, proxy)",
        "/energia/series/inclusao_tsee_antiga.csv": "Série antiga da ANEEL por região (descontinuada)",
        "/energia/series/inclusao_cde_custeio.csv": "CDE: custeio anual por rubrica",
        "/energia/series/inclusao_pof.csv": "POF 2017-2018: energia no orçamento das famílias",
        "/energia/series/inclusao_acesso_pnad.csv": "PNAD Contínua: acesso à energia elétrica",
        "/energia/series/inclusao_sistemas_isolados.csv": "Sistemas isolados: localidades (PASI)",
        "/energia/series/inclusao_sistemas_isolados_pontos.json": "Sistemas isolados: localidades do ciclo mais recente (JSON do mapa)",
        "/energia/series/inclusao_luz_para_todos_mensal.csv": "Luz para Todos: domicílios atendidos por UF e mês",
        "/energia/series/inclusao_luz_para_todos_municipios.csv": "Luz para Todos: domicílios atendidos por município e ano",
        "/energia/series/inclusao_luz_para_todos_recursos.csv": "Luz para Todos: recursos por contrato",
    }.get(u, u)


# ================================================================ gold: utilidades

def _fonte(orgao, conjunto, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": conjunto, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _fonte_evid(con, dataset, recurso, orgao, conjunto, url):
    """Bloco 'fonte' da evidência a partir da vintage vigente do recurso."""
    v = base.ultima_vintage(con, dataset, recurso) if recurso else None
    return {"orgao": orgao, "conjunto": conjunto, "recurso": recurso, "url": (v or {}).get("url") or url,
            "arquivo": (v or {}).get("arquivo"), "sha256": (v or {}).get("sha256"),
            "capturado_em": (v or {}).get("capturado_em"), "publicado_em": (v or {}).get("publicado_em")}


def numero_exibido(valor, casas=0):
    """Número no formato brasileiro (milhar com ponto, decimal com vírgula); None fica None."""
    if valor is None:
        return None
    return f"{valor:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


PERIODO_POF = {"inicio": "2017-07", "fim": "2018-07"}
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py inclusao --sem-coleta (silver data/energia/silver/aneel_social.db)"


def _evidencia(*, valor, unidade, periodo, entidade, universo, fonte, formula, chaves_origem, filtros=None,
               numerador=None, denominador=None, pesos=None, exclusoes=None, cobertura=None, tratamento_ausencia=None,
               revisoes=None, testes=(), reconciliacao=None, download=(), reproducao=None, casas=0, indicador="",
               sufixo=""):
    """Evidência "Comprove este número" pelo construtor compartilhado (pipeline/energia/evidencia.py),
    que recusa na geração da gold a ficha que não comprova: sem arquivo com sha256, sem teste,
    sem download, razão sem um dos termos. `periodo` aceita 'AAAA-MM', 'AAAA' ou dict."""
    if isinstance(periodo, str):
        periodo = {"inicio": periodo, "fim": periodo}
    exib = numero_exibido(valor, casas)
    return ev.construir(
        indicador=indicador, valor_exibido=None if exib is None else exib + sufixo, valor_calculo=valor,
        unidade=unidade, periodo=periodo, entidade=entidade, universo=universo, fonte=fonte, formula=formula,
        chaves_origem=[chaves_origem] if isinstance(chaves_origem, str) else list(chaves_origem),
        filtros=filtros or (), numerador=numerador, denominador=denominador, pesos=pesos, exclusoes=exclusoes or (),
        cobertura=cobertura or universo,
        tratamento_ausencia=tratamento_ausencia or "Ausência na fonte não vira zero: o item fica sem valor e fora das somas.",
        revisoes=revisoes, testes=testes, reconciliacao=reconciliacao,
        download=[{"rotulo": _rotulo_csv(u), "url": u} for u in download],
        reproducao=reproducao or REPRODUCAO)


def _r(v, casas=2):
    return c.r(v, casas)


def _mes_menos(mes, n):
    a, m = int(mes[:4]), int(mes[5:7])
    t = a * 12 + (m - 1) - n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def _mediana(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    k = len(xs)
    return xs[k // 2] if k % 2 else (xs[k // 2 - 1] + xs[k // 2]) / 2


def residencial_inconsistente(res_por_mes, tsee_por_mes, mes, rupturas=()):
    """Regra publicada: o total de UC residenciais de uma distribuidora no mês é
    inconsistente quando falta, é zero, é menor que as próprias UC com Tarifa Social, ou
    se afasta mais de 25% da mediana dos três meses anteriores e três posteriores
    disponíveis. O valor da fonte continua publicado; ele só sai do numerador e do
    denominador da participação (as duas somas perdem a mesma distribuidora).

    `rupturas`: meses em que a distribuidora passou a informar as UC de uma incorporada
    (incorporacoes_scs). A mediana só usa vizinhos do mesmo lado da ruptura: o novo
    patamar depois de uma incorporação não é erro de dado, e o patamar antigo antes dela
    também não (o defeito era marcar RGE SUL de jan a mar/2020, ESS em jun e jul/2017 e
    CPFL JAGUARI em abr e mai/2018 e tirá-las da participação nacional)."""
    res = res_por_mes.get(mes)
    tsee = tsee_por_mes.get(mes)
    if res is None or res <= 0:
        return True
    if tsee is not None and res < tsee:
        return True
    ini = max((b for b in rupturas if b <= mes), default=None)
    fim = min((b for b in rupturas if b > mes), default=None)
    viz = []
    for k in (-3, -2, -1, 1, 2, 3):
        m = _mes_menos(mes, k)
        if (ini is None or m >= ini) and (fim is None or m < fim):
            viz.append(res_por_mes.get(m))
    med = _mediana([v for v in viz if v is not None and v > 0])
    return bool(med) and abs(res / med - 1) > VARIACAO_RESIDENCIAL


SALTO_MINIMO_SUCESSORA = 0.05  # salto do total residencial da sucessora, relativo ao patamar anterior


def _patamar(res_por_mes, meses, antes_de=None, a_partir_de=None, n=3):
    """Mediana dos n totais residenciais positivos mais próximos da ruptura, antes dela
    (antes_de) ou a partir dela (a_partir_de), numa janela de 6 meses."""
    if antes_de is not None:
        cand = [m for m in sorted(meses, reverse=True) if _mes_menos(antes_de, 6) <= m < antes_de]
    else:
        cand = [m for m in sorted(meses) if a_partir_de <= m < _mes_menos(a_partir_de, -6)]
    vals = [res_por_mes[m] for m in cand if (res_por_mes.get(m) or 0) > 0][:n]
    return _mediana(vals)


def incorporacoes_scs(res_por_dist, ultimo_mes, cauda, tolerancia=VARIACAO_RESIDENCIAL):
    """Incorporações detectadas no próprio SCS, sem lista externa.

    Saída: distribuidora X que informa pela última vez no mês L antes da cauda do
    arquivo e nunca volta (mesma regra de completude_scs). Sucessora: distribuidora S
    presente antes e depois de b = L + 1 cujo total residencial muda de patamar em b
    (mediana dos 3 totais positivos seguintes menos a dos 3 anteriores, Δ) de forma
    compatível com o total residencial das que saíram: |Δ − T| ≤ 25% de T, com T = soma
    das que saem no mesmo mês ou o total de uma delas, e Δ de pelo menos 5% do patamar
    anterior de S (o crescimento vegetativo de 2 a 3 meses fica abaixo de 1%).

    Devolve [{mes_ruptura, sucessora, incorporadas: [cnpj...], total_incorporadas,
    salto_sucessora, patamar_antes, patamar_depois}] em ordem de mês."""
    saidas = collections.defaultdict(list)
    for cn, u in ultimo_mes.items():
        if u < cauda and res_por_dist.get(cn, {}).get(u):
            saidas[u].append(cn)
    out = []
    for L, grupo in sorted(saidas.items()):
        b = _mes_menos(L, -1)
        alvos = [(tuple(sorted(grupo)), sum(res_por_dist[x][L] for x in grupo))]
        if len(grupo) > 1:
            alvos += [((x,), res_por_dist[x][L]) for x in grupo]
        melhor = None
        for cn, res in res_por_dist.items():
            if cn in grupo:
                continue
            antes = _patamar(res, res, antes_de=b)
            depois = _patamar(res, res, a_partir_de=b)
            if not antes or not depois:
                continue
            delta = depois - antes
            if delta < SALTO_MINIMO_SUCESSORA * antes:
                continue
            for inc, T in alvos:
                erro = abs(delta - T) / T
                if erro <= tolerancia and (melhor is None or erro < melhor[0]):
                    melhor = (erro, cn, inc, T, delta, antes, depois)
        if melhor:
            _, cn, inc, T, delta, antes, depois = melhor
            out.append({"mes_ruptura": b, "sucessora": cn, "incorporadas": list(inc), "total_incorporadas": T,
                        "salto_sucessora": delta, "patamar_antes": antes, "patamar_depois": depois})
    return out


def municipio_do_mapa(mun, validos=None):
    """Código de 6 dígitos do município de uma chave da CDE, ou None quando não entra no
    mapa: formato inválido (já marcado 'invalido' na leitura) ou código que não existe na
    lista de municípios do IBGE (a do Cadastro Único), como 1403205 em Roraima."""
    if not mun or mun == "invalido":
        return None
    cod = mun[:6]
    if validos is not None and cod not in validos:
        return None
    return cod


def resumo_cde_mes(chaves, validos=None):
    """Agregados de um mês de Beneficiários da CDE a partir das chaves do silver
    {(cnpj, mun7|'invalido', subclasse, tipo_faturamento): {'n', 'valor', 'sem_valor'}}.

    - faturas e desconto das faturas: SubsBaixaRenda, tipo 1, subclasses 3.2 a 3.6;
    - desconto líquido: subclasses 3.2 a 3.6, tipos 1 a 4 (cancelamentos e
      refaturamentos entram com o sinal da fonte); linhas SubsBaixaRenda de OUTRAS
      subclasses (iluminação pública, industrial, comercial) ficam fora e são publicadas à
      parte como diagnóstico (o defeito era somá-las ao líquido: R$ -26,1 milhões em
      mar/2026);
    - município: formato inválido ou código inexistente ficam só no total nacional."""
    r = {"faturas_tsee": 0.0, "faturas_outras_subclasses": 0.0, "desconto_faturas_reais": 0.0,
         "desconto_liquido_reais": 0.0, "desconto_fora_das_subclasses_reais": 0.0, "linhas_fora_das_subclasses": 0.0,
         "faturas_municipio_invalido": 0.0, "faturas_municipio_inexistente": 0.0,
         "codigos_inexistentes": collections.Counter(), "por_mun": {}, "por_dist": collections.Counter(),
         "valor_por_dist": collections.Counter(), "uf_por_dist": collections.defaultdict(collections.Counter)}
    for (cn, mun, sc, tf), v in chaves.items():
        n, val = v.get("n", 0.0), v.get("valor", 0.0)
        if sc not in SUBCLASSES_TSEE:
            r["desconto_fora_das_subclasses_reais"] += val
            r["linhas_fora_das_subclasses"] += n
            if tf == "1":
                r["faturas_outras_subclasses"] += n
            continue
        r["desconto_liquido_reais"] += val
        if tf != "1":
            continue
        r["faturas_tsee"] += n
        r["desconto_faturas_reais"] += val
        r["por_dist"][cn] += n
        r["valor_por_dist"][cn] += val
        cod = municipio_do_mapa(mun, validos)
        if cod is None:
            r["faturas_municipio_invalido"] += n
            if mun != "invalido":
                r["faturas_municipio_inexistente"] += n
                r["codigos_inexistentes"][mun] += n
            continue
        mm = r["por_mun"].setdefault(cod, {"faturas": 0.0, "valor": 0.0, "distribuidoras": set()})
        mm["faturas"] += n
        mm["valor"] += val
        mm["distribuidoras"].add(cn)
        r["uf_por_dist"][cn][fi.UF_SIGLA.get(cod[:2])] += n
    por_uf = collections.defaultdict(lambda: {"faturas": 0.0, "valor": 0.0, "municipios": 0})
    for cod, mm in r["por_mun"].items():
        p = por_uf[fi.UF_SIGLA.get(cod[:2])]
        p["faturas"] += mm["faturas"]
        p["valor"] += mm["valor"]
        p["municipios"] += 1
    r["por_uf"] = dict(por_uf)
    return r


# ================================================================ P059: Tarifa Social

MODS = [m for m, _ in fa.MODALIDADES]
# campos da série mensal nacional que vão para a gold (os demais ficam em inclusao_tsee_mensal.csv)
CAMPOS_SERIE_GOLD = ("m", "distribuidoras", "completo", "distribuidoras_faltantes", "uc_tsee_faltantes_ultimo_informe",
                     "uc_tsee", "participacao_pct", "excluidas_participacao", "dmr_reais", "mwh_tsee")
# medidas da POF publicadas na gold para as UF (amostra menor; todas as medidas no CSV)
MEDIDAS_POF_UF = ("energia_media", "razao_medias_pct", "media_razoes_desp_pct", "media_razoes_renda_pct",
                  "sem_despesa_energia_pct", "acima_5_renda_pct", "acima_10_renda_pct")
SUBCLASSES_TSEE = tuple(fa.SUBCLASSES_TSEE)


SIGLAS_NAO_INFORMADAS = {"", "não informado", "nao informado", "n/i", "-"}


def sigla_informada(s):
    """Sigla que identifica a empresa: 'Não Informado' (texto do SCS para um CNPJ) não é nome."""
    return bool(s) and s.strip().lower() not in SIGLAS_NAO_INFORMADAS


def municipios_validos(con):
    """Códigos de 6 dígitos dos municípios existentes, pela lista municipal do Cadastro
    Único (MI Social usa o código IBGE). Conjunto vazio quando o MDS não está no silver;
    aí só o formato do código é conferido (municipio_do_mapa recebe None)."""
    cods = {cod for cod, r in base.registros_como_estavam_em(con, DS_MDS).items()
            if re.fullmatch(r"\d{6}", cod) and r.get("uf")}
    return cods or None


def _texto_maiores_diferencas(reconc, mes_conf):
    grandes, pequenas = reconc.get("maiores_diferencas") or [], reconc.get("diferencas_distribuidoras_pequenas") or []
    txt = (f"Faturas não são UC: em {c.mes_br(mes_conf)} o arquivo tem {numero_exibido(reconc['diferenca_pct'], 2)}% de diferença "
           "nas faturas contra as UC do SCS das mesmas distribuidoras.")
    if grandes:
        g = grandes[0]
        txt += (f" Maior diferença entre distribuidoras com {numero_exibido(UC_MINIMA_DIFERENCAS)} UC ou mais: {g['sigla']}, "
                f"{numero_exibido(g['diferenca_pct'], 2)}%.")
    if pequenas:
        p = pequenas[0]
        txt += (f" Entre as menores, {p['sigla']}, {numero_exibido(p['diferenca_pct'], 2)}% "
                f"({numero_exibido(p['uc_scs'])} UC no SCS e {numero_exibido(p['faturas_cde'])} faturas).")
    return txt


def _cde_por_mes(con):
    """{mes: {(cnpj, mun, subclasse, tipo_fat): {'n', 'valor', 'sem_valor'}}} do silver da CDE."""
    out = collections.defaultdict(dict)
    for serie, pts in _vigentes(con, DS_CDE).items():
        partes = serie.split(".")
        if len(partes) < 6:
            continue
        # serie = cnpj.mun.subclasse(com ponto: '3.2').tipo.medida
        cnpj, mun = partes[0], partes[1]
        medida, tf = partes[-1], partes[-2]
        sc = ".".join(partes[2:-2])
        for mes, v in pts.items():
            out[mes].setdefault((cnpj, mun, sc, tf), {})[medida] = v
    return out


def _bloco_tarifa_social(con, scs):
    dist = collections.defaultdict(dict)
    faixa = collections.defaultdict(dict)
    for serie, pts in scs.items():
        p = serie.split(".")
        if len(p) == 2:
            dist[p[0]][p[1]] = pts
        elif len(p) == 3 and p[1].startswith("f"):
            faixa[p[0]][(p[1][1:], p[2])] = pts
    regs = base.registros_como_estavam_em(con, DS_SCS)
    sigla_hist = collections.defaultdict(dict)
    for ch, campos in regs.items():
        if "|" in ch and campos.get("sigla"):
            cn, mes = ch.split("|", 1)
            sigla_hist[cn][mes] = campos["sigla"]
    # sigla mais recente que identifica a empresa: o SCS traz "Não Informado" para ao menos
    # um CNPJ (89435598000155, CRERAL na CDE); nesse caso vale a da CDE (chave é o CNPJ)
    siglas_cde = {ch.split("|", 1)[1]: campos.get("sigla") for ch, campos in base.registros_como_estavam_em(con, DS_CDE).items()
                  if ch.startswith("sigla|")}
    sigla, origem_sigla = {}, {}
    for cn, h in sigla_hist.items():
        boas = [h[m] for m in sorted(h) if sigla_informada(h[m])]
        if boas:
            sigla[cn], origem_sigla[cn] = boas[-1], "SCS"
        elif sigla_informada(siglas_cde.get(cn)):
            sigla[cn], origem_sigla[cn] = siglas_cde[cn], "Beneficiários da CDE (SCS sem sigla informada)"
        else:
            sigla[cn], origem_sigla[cn] = None, None
    mudancas_sigla = []
    for cn, h in sigla_hist.items():
        ant = None
        for mes in sorted(h):
            if not sigla_informada(h[mes]):
                continue
            if ant is not None and h[mes] != ant:
                mudancas_sigla.append({"cnpj": cn, "mes": mes, "de": ant, "para": h[mes]})
            ant = h[mes]
    meses_por = collections.defaultdict(dict)
    for cn, campos in dist.items():
        for mes, v in campos.get("uc_tsee", {}).items():
            meses_por[mes][cn] = v
    completude = completude_scs(meses_por)
    completos = {m: v["completo"] for m, v in completude.items()}
    meses = sorted(meses_por)
    ref = max((m for m in meses if completos[m]), default=None)
    if ref is None:
        raise ValueError("nenhum mês completo no SCS")
    # incorporações detectadas no próprio SCS (saída definitiva e salto compatível da sucessora)
    primeiro_inf, ultimo_inf = {}, {}
    for m in meses:
        for cn in meses_por[m]:
            primeiro_inf.setdefault(cn, m)
            ultimo_inf[cn] = m
    incorporacoes = incorporacoes_scs({cn: d.get("uc_residencial", {}) for cn, d in dist.items()}, ultimo_inf,
                                      _mes_menos(meses[-1], MESES_CAUDA - 1))
    rupturas = collections.defaultdict(list)
    for inc in incorporacoes:
        rupturas[inc["sucessora"]].append(inc["mes_ruptura"])
    # inconsistência do total residencial por distribuidora e mês (vizinhos do mesmo lado da ruptura)
    flag, flag_sem_ruptura = {}, {}
    for cn, campos in dist.items():
        res, ts = campos.get("uc_residencial", {}), campos.get("uc_tsee", {})
        for mes in ts:
            flag[(cn, mes)] = residencial_inconsistente(res, ts, mes, rupturas.get(cn, ()))
            if rupturas.get(cn):
                flag_sem_ruptura[(cn, mes)] = residencial_inconsistente(res, ts, mes)
    # meses que a regra antiga (sem ruptura) excluiria e que a incorporação explica
    reincluidos = sorted((mes, cn) for (cn, mes), v in flag_sem_ruptura.items() if v and not flag[(cn, mes)])
    serie = []
    for mes in meses:
        cns = list(meses_por[mes])
        soma = lambda campo: sum(dist[cn].get(campo, {}).get(mes) or 0.0 for cn in cns  # noqa: E731
                                 if dist[cn].get(campo, {}).get(mes) is not None) if any(
            dist[cn].get(campo, {}).get(mes) is not None for cn in cns) else None
        ok = [cn for cn in cns if not flag.get((cn, mes))]
        num = sum(dist[cn]["uc_tsee"][mes] for cn in ok)
        den = sum(dist[cn].get("uc_residencial", {}).get(mes) or 0.0 for cn in ok)
        falt = completude[mes]["faltantes"]
        # UC que as faltantes tinham no último mês em que informaram: dá a materialidade da falta
        uc_falt = 0.0
        for cn in falt:
            ant = [x for x in dist[cn].get("uc_tsee", {}) if x < mes]
            uc_falt += dist[cn]["uc_tsee"][max(ant)] if ant else 0.0
        linha = {"m": mes, "distribuidoras": len(cns), "completo": completos[mes],
                 "distribuidoras_faltantes": len(falt), "uc_tsee_faltantes_ultimo_informe": uc_falt if falt else None,
                 "uc_tsee": soma("uc_tsee"), **{f"uc_{m}": soma(f"uc_{m}") for m in MODS},
                 "uc_residencial": soma("uc_residencial"),
                 "participacao_pct": _r(100 * num / den, 2) if den else None,
                 "participacao_numerador": num if den else None, "participacao_denominador": den if den else None,
                 "excluidas_participacao": len(cns) - len(ok),
                 "dmr_reais": _r(soma("dmr"), 2), "dmr_cde_reais": _r(soma("dmr_cde"), 2),
                 "mwh_tsee": _r(soma("mwh_tsee"), 3)}
        serie.append(linha)
    por_mes = {l["m"]: l for l in serie}
    lr = por_mes[ref]
    ref12 = _mes_menos(ref, 12)
    l12 = por_mes.get(ref12)
    janela = [por_mes.get(_mes_menos(ref, k)) for k in range(12)]
    dmr12 = sum(l["dmr_reais"] for l in janela if l and l["dmr_reais"] is not None) if all(janela) else None
    incompletos12 = sum(1 for l in janela if l and not l["completo"])
    # faixas de consumo no mês de referência e 12 meses antes
    def faixas_de(mes):
        out = []
        tot = sum(faixa[cn].get((f, "uc_tsee"), {}).get(mes) or 0.0 for cn in faixa for f in fa.FAIXAS)
        for f, rot in fa.FAIXAS.items():
            ucs = sum(faixa[cn].get((f, "uc_tsee"), {}).get(mes) or 0.0 for cn in faixa)
            res = sum(faixa[cn].get((f, "uc_residencial"), {}).get(mes) or 0.0 for cn in faixa)
            out.append({"faixa": f, "rotulo": rot, "uc_tsee": ucs, "uc_residencial": res,
                        "pct_das_uc_tsee": _r(100 * ucs / tot, 2) if tot else None})
        return out
    # CDE: meses processados. Só o mês com o original no bronze tem valores publicados; o mês
    # sondado e rejeitado pela cobertura publica só a cobertura e o motivo (não é reprodutível)
    cde = _cde_por_mes(con)
    infos = {m: _info_mes(con, m) for m in cde}
    no_bronze = {m for m, i in infos.items() if i and (i.get("bronze") or "").startswith("sim")}
    mes_mapa = max((m for m, i in infos.items() if i and (i.get("cobertura_scs") or 0) >= COBERTURA_MINIMA
                    and m in no_bronze), default=None)
    mes_conf = ref if ref in cde else None
    validos = municipios_validos(con)
    resumos = {m: resumo_cde_mes(cde[m], validos) for m in sorted(no_bronze)}
    cde_meses = []
    for mes in sorted(cde):
        i = infos.get(mes) or {}
        uso = []
        if mes == mes_mapa:
            uso.append("mapa e cobertura potencial")
        if mes == mes_conf:
            uso.append("conferência com o SCS")
        if mes in no_bronze and ref < mes and (mes_mapa is None or mes <= mes_mapa):
            uso.append("série mensal depois do fim do SCS")
        cob = i.get("cobertura_scs")
        # distribuidoras do SCS de referência sem fatura (tipo 1) no arquivo: o que falta para a cobertura
        presentes = {cn for (cn, _, _, tf) in cde[mes] if tf == "1"}
        ausentes = sorted((cn for cn in meses_por.get(ref, {}) if cn not in presentes), key=lambda cn: -meses_por[ref][cn])
        linha = {"mes": mes, "distribuidoras": i.get("distribuidoras"),
                 "cobertura_scs_pct": _r(100 * cob, 2) if cob is not None else None,
                 "distribuidoras_ausentes": [{"cnpj": cn, "sigla": sigla.get(cn) or siglas_cde.get(cn), "uc_scs_referencia": meses_por[ref][cn]}
                                             for cn in ausentes],
                 "completo": (cob or 0) >= COBERTURA_MINIMA, "original_no_bronze": mes in no_bronze, "uso": uso,
                 "sha256": i.get("sha256"), "recurso": i.get("recurso")}
        rs = resumos.get(mes)
        if rs:
            linha.update({
                "faturas_tsee": rs["faturas_tsee"], "faturas_outras_subclasses": rs["faturas_outras_subclasses"],
                "desconto_faturas_reais": _r(rs["desconto_faturas_reais"], 2),
                "desconto_medio_por_fatura_reais": _r(rs["desconto_faturas_reais"] / rs["faturas_tsee"], 2) if rs["faturas_tsee"] else None,
                "desconto_liquido_reais": _r(rs["desconto_liquido_reais"], 2),
                "desconto_fora_das_subclasses_reais": _r(rs["desconto_fora_das_subclasses_reais"], 2),
                "faturas_municipio_invalido": rs["faturas_municipio_invalido"],
                "faturas_municipio_inexistente": rs["faturas_municipio_inexistente"],
                "codigos_inexistentes": [{"codigo": k, "faturas": v} for k, v in sorted(rs["codigos_inexistentes"].items())],
                "motivo_sem_valores": None})
        else:
            linha.update({k: None for k in ("faturas_tsee", "faturas_outras_subclasses", "desconto_faturas_reais",
                                            "desconto_medio_por_fatura_reais", "desconto_liquido_reais",
                                            "desconto_fora_das_subclasses_reais", "faturas_municipio_invalido",
                                            "faturas_municipio_inexistente")})
            linha["codigos_inexistentes"] = []
            linha["motivo_sem_valores"] = (
                f"mês sondado: cobertura de {numero_exibido(linha['cobertura_scs_pct'], 2)}% das UC do SCS de "
                f"{c.mes_br(i.get('mes_referencia_cobertura') or ref)}, abaixo do mínimo de {numero_exibido(100 * COBERTURA_MINIMA, 1)}%; "
                f"o original (sha256 {str(i.get('sha256'))[:12]}...) não foi guardado no bronze, e sem ele os valores não são reprodutíveis")
        cde_meses.append(linha)
    # distribuidoras no mês do mapa: municípios e UF
    rs_mapa = resumos.get(mes_mapa) if mes_mapa else None
    uf_por_dist = rs_mapa["uf_por_dist"] if rs_mapa else {}
    mun_mapa = rs_mapa["por_mun"] if rs_mapa else {}
    # conferência SCS × CDE por distribuidora
    conf = {}
    if mes_conf:
        rs_conf = resumos.get(mes_conf) or resumo_cde_mes(cde[mes_conf], validos)
        cde_conf, val_conf = rs_conf["por_dist"], rs_conf["valor_por_dist"]
        for cn in set(meses_por[mes_conf]) | set(cde_conf):
            s_ = dist.get(cn, {}).get("uc_tsee", {}).get(mes_conf)
            d_ = cde_conf.get(cn)
            conf[cn] = {"uc_scs": s_, "faturas_cde": d_,
                        "diferenca_pct": _r(100 * (d_ / s_ - 1), 2) if s_ and d_ is not None else None,
                        "dmr_scs_reais": _r(dist.get(cn, {}).get("dmr", {}).get(mes_conf), 2),
                        "desconto_cde_reais": _r(val_conf.get(cn), 2) if cn in val_conf else None}
    comparaveis = [v for v in conf.values() if v["uc_scs"] and v["faturas_cde"] is not None]
    tot_s = sum(v["uc_scs"] for v in comparaveis)
    tot_c = sum(v["faturas_cde"] for v in comparaveis)
    # dinheiro: DMR do SCS contra a soma dos descontos das faturas da CDE, mesmas distribuidoras
    tot_dmr = sum(v["dmr_scs_reais"] for v in comparaveis if v["dmr_scs_reais"] is not None and v["desconto_cde_reais"] is not None)
    tot_desc = sum(v["desconto_cde_reais"] for v in comparaveis if v["dmr_scs_reais"] is not None and v["desconto_cde_reais"] is not None)
    dentro = sum(1 for v in conf.values() if v["diferenca_pct"] is not None and abs(v["diferenca_pct"]) <= 2.0)
    comparadas = sum(1 for v in conf.values() if v["diferenca_pct"] is not None)
    reconc = {
        "mes": mes_conf, "uc_scs": tot_s, "faturas_cde": tot_c,
        "diferenca_pct": _r(100 * (tot_c / tot_s - 1), 2) if tot_s else None,
        "dmr_scs_reais": _r(tot_dmr, 2), "desconto_cde_reais": _r(tot_desc, 2),
        "diferenca_valor_pct": _r(100 * (tot_desc / tot_dmr - 1), 2) if tot_dmr else None,
        "distribuidoras_comparadas": comparadas, "distribuidoras_ate_2pct": dentro,
        "tolerancia": ("±2% das contagens no total e em pelo menos 90% das distribuidoras; fora disso, ressalva com as maiores "
                       "diferenças listadas. As duas bases contam coisas próximas mas não idênticas: UC informada no pedido de "
                       "reembolso da DMR (SCS) versus faturas de faturamento com desconto no mês (CDE), que podem incluir "
                       "faturas de outras referências e mais de uma fatura por UC. A lista maiores_diferencas traz só "
                       f"distribuidoras com {numero_exibido(UC_MINIMA_DIFERENCAS)} UC ou mais no SCS; as menores com diferença acima "
                       "de ±2% ficam em diferencas_distribuidoras_pequenas, porque um percentual sobre poucas centenas de UC "
                       "pesa pouco no total mas não deve sumir da conferência."),
        "uc_minima_maiores_diferencas": UC_MINIMA_DIFERENCAS,
        "maiores_diferencas": sorted(
            [{"cnpj": cn, "sigla": sigla.get(cn) or siglas_cde.get(cn), **v} for cn, v in conf.items()
             if v["diferenca_pct"] is not None and abs(v["diferenca_pct"]) > 2.0 and (v["uc_scs"] or 0) >= UC_MINIMA_DIFERENCAS],
            key=lambda x: -abs(x["diferenca_pct"]))[:12],
        "diferencas_distribuidoras_pequenas": sorted(
            [{"cnpj": cn, "sigla": sigla.get(cn) or siglas_cde.get(cn), **v} for cn, v in conf.items()
             if v["diferenca_pct"] is not None and abs(v["diferenca_pct"]) > 2.0 and (v["uc_scs"] or 0) < UC_MINIMA_DIFERENCAS],
            key=lambda x: -abs(x["diferenca_pct"]))[:12],
        "so_no_scs": sorted(sigla.get(cn, cn) for cn, v in conf.items() if v["faturas_cde"] is None),
        "so_na_cde": sorted((siglas_cde.get(cn) or cn) for cn, v in conf.items() if v["uc_scs"] is None),
    } if mes_conf else None
    # tabela por distribuidora no mês de referência
    distribs = []
    for cn in sorted(meses_por[ref], key=lambda x: -meses_por[ref][x]):
        d = dist[cn]
        g = lambda campo, m=ref: d.get(campo, {}).get(m)  # noqa: E731
        uc = g("uc_tsee")
        res = g("uc_residencial")
        inc = flag.get((cn, ref))
        uc12 = g("uc_tsee", ref12)
        reg = regs.get(f"{cn}|{ref}", {})
        ufs = uf_por_dist.get(cn) or {}
        tot_uf = sum(ufs.values())
        distribs.append({
            "cnpj": cn, "sigla": sigla.get(cn), "uc_tsee": uc,
            **{f"uc_{m}": g(f"uc_{m}") for m in MODS},
            "uc_residencial": res, "residencial_inconsistente": bool(inc),
            "participacao_pct": None if inc or not res else _r(100 * uc / res, 2),
            "dmr_reais": _r(g("dmr"), 2), "dmr_por_uc_reais": _r(g("dmr") / uc, 2) if uc and g("dmr") is not None else None,
            "kwh_por_uc": _r(1000 * g("mwh_tsee") / uc, 1) if uc and g("mwh_tsee") is not None else None,
            "variacao_12m_pct": _r(100 * (uc / uc12 - 1), 2) if uc and uc12 else None,
            "despacho": reg.get("despacho"),
            "ufs_mapa": [{"uf": uf, "pct": _r(100 * n / tot_uf, 1)} for uf, n in ufs.most_common() if n / tot_uf >= 0.0005] if tot_uf else [],
            "conferencia_cde": conf.get(cn),
        })
    # UF no mês do mapa
    ufs_tab = []
    if mes_mapa:
        por_uf = rs_mapa["por_uf"]
        for uf in UF_NOME:
            p = por_uf.get(uf)
            if not p:
                continue
            ufs_tab.append({"uf": uf, "nome": UF_NOME[uf], "regiao": REGIAO_DA_UF[uf], "faturas_tsee": p["faturas"],
                            "desconto_reais": _r(p["valor"], 2),
                            "desconto_medio_por_fatura_reais": _r(p["valor"] / p["faturas"], 2) if p["faturas"] else None,
                            "municipios_com_faturas": p["municipios"]})
    # série mensal da CDE por UF (só meses com o original no bronze): faturas e desconto das faturas
    meses_serie_cde = sorted(resumos)
    serie_cde_uf = {"meses": meses_serie_cde, "ufs": list(UF_NOME),
                    "completo": [bool(((infos.get(m) or {}).get("cobertura_scs") or 0) >= COBERTURA_MINIMA) for m in meses_serie_cde],
                    "faturas_tsee": [[(resumos[m]["por_uf"].get(uf) or {}).get("faturas") for m in meses_serie_cde] for uf in UF_NOME],
                    "desconto_faturas_reais": [[_r((resumos[m]["por_uf"].get(uf) or {}).get("valor"), 2) for m in meses_serie_cde]
                                               for uf in UF_NOME]}
    linhas_cde = []
    for l in cde_meses:
        if not l["original_no_bronze"]:
            continue
        m = l["mes"]
        linhas_cde.append([m, "BR", l["faturas_tsee"], l["desconto_faturas_reais"], l["desconto_medio_por_fatura_reais"],
                           l["desconto_liquido_reais"], l["desconto_fora_das_subclasses_reais"], l["faturas_municipio_invalido"],
                           len(resumos[m]["por_mun"]), l["cobertura_scs_pct"], 1 if l["completo"] else 0])
        for uf in UF_NOME:
            p = resumos[m]["por_uf"].get(uf)
            if p:
                linhas_cde.append([m, uf, p["faturas"], round(p["valor"], 2), round(p["valor"] / p["faturas"], 4) if p["faturas"] else None,
                                   None, None, None, p["municipios"], l["cobertura_scs_pct"], 1 if l["completo"] else 0])
    # a série por UF vai para um JSON lido sob demanda (a gold só leva o endereço), como os pontos do PASI
    base.escreve_gold("inclusao_cde_mensal_uf.json", {"gerado_em": base.agora_utc(), "fonte": ckan.url_dataset("ANEEL", PAC_CDE),
                                                      "unidades": {"faturas_tsee": "faturas de faturamento com desconto no mês",
                                                                   "desconto_faturas_reais": "R$ correntes"},
                                                      **serie_cde_uf}, destino=base.SERIES)
    base.escreve_csv("inclusao_cde_mensal_uf.csv",
                     ["mes", "territorio", "faturas_tsee", "desconto_faturas_reais", "desconto_medio_por_fatura_reais",
                      "desconto_liquido_reais", "desconto_fora_das_subclasses_reais", "faturas_municipio_invalido",
                      "municipios_com_faturas", "cobertura_scs_pct", "mes_completo"], linhas_cde)
    # série antiga (descontinuada) e comparação com o SCS
    antiga = _bloco_antiga(con, por_mes)
    custeio = _bloco_custeio(con)
    # KPIs com evidência: os testes são controles executados nesta construção
    snap = c.snapshot_de(con, DS_SCS)
    rec_scs = "sistema-controle-subvencoes-programas-sociais.csv"
    f_scs = _fonte_evid(con, DS_SCS, rec_scs, "ANEEL", "SCS: Sistema de Controle de Subvenções e Programas Sociais",
                        ckan.url_dataset("ANEEL", PAC_SCS))
    diag_scs = None
    for ch, campos in base.registros_como_estavam_em(con, DS_CONTROLE).items():
        if ch == "scs_diagnostico" and campos.get("json"):
            diag_scs = json.loads(campos["json"])
    testes_scs = _testes_scs(diag_scs, completude, ref, antiga)
    rec_conf = None
    if reconc and reconc["diferenca_pct"] is not None:
        ok_total = abs(reconc["diferenca_pct"]) <= 2.0
        ok_dist = reconc["distribuidoras_comparadas"] and reconc["distribuidoras_ate_2pct"] >= 0.9 * reconc["distribuidoras_comparadas"]
        rec_conf = ev.reconciliacao(
            f"UC do SCS ({numero_exibido(reconc['uc_scs'])}) contra faturas com desconto no arquivo de Beneficiários da CDE "
            f"de {c.mes_br(mes_conf)} ({numero_exibido(reconc['faturas_cde'])}): {numero_exibido(reconc['diferenca_pct'], 2)}% no total; "
            f"{reconc['distribuidoras_ate_2pct']} de {reconc['distribuidoras_comparadas']} distribuidoras dentro de ±2%. "
            f"Em reais: DMR de R$ {numero_exibido(reconc['dmr_scs_reais'])} contra descontos de R$ {numero_exibido(reconc['desconto_cde_reais'])} "
            f"({numero_exibido(reconc['diferenca_valor_pct'], 2)}%)",
            "aprovado" if ok_total and ok_dist else "ressalva",
            "±2% das UC no total e em pelo menos 90% das distribuidoras (unidades de contagem próximas, não idênticas)")
    downloads_ts = ["/energia/series/inclusao_tsee_mensal.csv", "/energia/series/inclusao_tsee_distribuidoras.csv"]
    chave_ref = f"AnmMesAnoCompetencia = {ref.replace('-', '')}, despacho vigente de cada distribuidora"
    kpis = {
        "uc_tsee": {"valor": lr["uc_tsee"], "unidade": "unidades consumidoras", "mes": ref,
                    "evidencia": _evidencia(
                        valor=lr["uc_tsee"], unidade="unidades consumidoras", periodo=ref, entidade="Brasil",
                        universo=f"{lr['distribuidoras']} distribuidoras que informaram o SCS na competência",
                        fonte=f_scs, formula="Σ (NumConsBaixaRenda + NumConsIndigena + NumConsQuilombola + NumConsBPC + NumConsMultifamiliar) nas 5 faixas de cada distribuidora, no despacho vigente",
                        chaves_origem=[chave_ref],
                        cobertura=f"{lr['distribuidoras']} distribuidoras; mês completo pela regra do módulo (nenhuma distribuidora esperada faltando)",
                        revisoes=snap.get("revisoes"), testes=testes_scs, reconciliacao=rec_conf,
                        download=downloads_ts, indicador="Unidades consumidoras com Tarifa Social")},
        "participacao_pct": {"valor": lr["participacao_pct"], "unidade": "% das UC residenciais", "mes": ref,
                             "evidencia": _evidencia(
                                 valor=lr["participacao_pct"], unidade="%", periodo=ref, entidade="Brasil",
                                 universo=f"{lr['distribuidoras'] - lr['excluidas_participacao']} distribuidoras com total residencial consistente no mês",
                                 fonte=f_scs, formula="100 × Σ UC com Tarifa Social ÷ Σ UC residenciais (QtdConsResTotal), mesmas distribuidoras",
                                 chaves_origem=[chave_ref],
                                 numerador={"descricao": "UC com Tarifa Social das distribuidoras consistentes", "valor": lr["participacao_numerador"]},
                                 denominador={"descricao": "UC da classe residencial das mesmas distribuidoras", "valor": lr["participacao_denominador"]},
                                 exclusoes=[f"{lr['excluidas_participacao']} distribuidora(s) com total residencial inconsistente no mês (regra publicada)"] if lr["excluidas_participacao"] else [],
                                 casas=1, sufixo="%", revisoes=snap.get("revisoes"), testes=testes_scs, download=downloads_ts,
                                 indicador="Participação da Tarifa Social nas UC residenciais")},
        "dmr_mes_reais": {"valor": lr["dmr_reais"], "unidade": "R$ correntes no mês", "mes": ref,
                          "evidencia": _evidencia(
                              valor=lr["dmr_reais"], unidade="R$ correntes", periodo=ref, entidade="Brasil",
                              universo=f"{lr['distribuidoras']} distribuidoras do SCS", fonte=f_scs,
                              formula="Σ VlrDMR de cada distribuidora (lido uma vez por distribuidora e mês, no despacho vigente)",
                              chaves_origem=[chave_ref], casas=0, revisoes=snap.get("revisoes"), testes=testes_scs,
                              download=downloads_ts, indicador="Diferença Mensal de Receita da Tarifa Social")},
        "dmr_12m_reais": {"valor": _r(dmr12, 2), "unidade": "R$ correntes em 12 meses", "inicio": _mes_menos(ref, 11), "fim": ref,
                          "meses_incompletos": incompletos12},
        "variacao_12m_pct": {"valor": _r(100 * (lr["uc_tsee"] / l12["uc_tsee"] - 1), 2) if l12 and l12["uc_tsee"] else None,
                             "unidade": "%", "mes": ref, "mes_base": ref12,
                             "comparavel": bool(l12 and l12["completo"])},
        "kwh_por_uc": {"valor": _r(1000 * lr["mwh_tsee"] / lr["uc_tsee"], 1) if lr["mwh_tsee"] and lr["uc_tsee"] else None,
                       "unidade": "kWh por UC no mês", "mes": ref},
        "dmr_por_uc_reais": {"valor": _r(lr["dmr_reais"] / lr["uc_tsee"], 2) if lr["dmr_reais"] and lr["uc_tsee"] else None,
                             "unidade": "R$ por UC no mês", "mes": ref},
    }
    if mes_mapa:
        mm = next(m for m in cde_meses if m["mes"] == mes_mapa)
        f_cde = _fonte_evid(con, DS_CDE, mm["recurso"], "ANEEL", "Beneficiários da CDE", ckan.url_dataset("ANEEL", PAC_CDE))
        soma_ufs = sum(u["faturas_tsee"] for u in ufs_tab)
        kpis["faturas_cde_mapa"] = {
            "valor": mm["faturas_tsee"], "unidade": "faturas de faturamento com desconto no mês", "mes": mes_mapa,
            "evidencia": _evidencia(
                valor=mm["faturas_tsee"], unidade="faturas", periodo=mes_mapa, entidade="Brasil",
                universo=f"{mm['distribuidoras']} distribuidoras no arquivo de {c.mes_br(mes_mapa)}",
                fonte=f_cde, formula="número de linhas com DscTipoSubsidio = SubsBaixaRenda, IdcTipoFaturamento = 1 e IdcSubclasse de 3.2 a 3.6",
                chaves_origem=[f"arquivo {mm['recurso']} (sha256 {mm['sha256']})"],
                cobertura=f"{numero_exibido(mm['cobertura_scs_pct'], 2)}% das UC do SCS de {c.mes_br(mes_conf or ref)} estão em distribuidoras presentes no arquivo",
                exclusoes=["faturas de cancelamento e refaturamento (tipos 2 a 4)", "outras subclasses e outros subsídios da CDE",
                           "do mapa (não do total): código de município em formato inválido ou inexistente na lista do IBGE"],
                testes=[ev.teste("soma das UF mais faturas sem município válido igual ao total nacional",
                                 "aprovado" if abs(soma_ufs + mm["faturas_municipio_invalido"] - mm["faturas_tsee"]) < 0.5 else "reprovado",
                                 f"{numero_exibido(soma_ufs)} nas UF + {numero_exibido(mm['faturas_municipio_invalido'])} sem município válido = {numero_exibido(mm['faturas_tsee'])}"),
                        ev.teste("código de município conferido contra a lista de municípios do IBGE (Cadastro Único)",
                                 "aprovado" if validos else "ressalva",
                                 (f"{numero_exibido(len(validos))} municípios na lista; {numero_exibido(mm['faturas_municipio_inexistente'])} faturas com código "
                                  f"de formato válido mas inexistente ({', '.join(x['codigo'] for x in mm['codigos_inexistentes']) or 'nenhum'}) ficam só no total nacional")
                                 if validos else "lista de municípios ausente no silver: só o formato do código foi conferido"),
                        ev.teste("cobertura do arquivo pelo SCS de referência", "aprovado" if mm["completo"] else "ressalva",
                                 f"{numero_exibido(mm['cobertura_scs_pct'], 2)}% (mínimo {numero_exibido(100 * COBERTURA_MINIMA, 1)}%)")],
                download=["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cde_mensal_uf.csv"],
                indicador="Faturas com desconto da Tarifa Social")}
    lim_scs = [
        "O SCS registra a competência pelo despacho da ANEEL que aprovou a DMR; o último mês do arquivo costuma estar incompleto (distribuidoras ainda não homologadas) e não é tratado como dado nacional.",
        "A contagem é de unidades consumidoras (UC), não de famílias nem de pessoas; a subclasse multifamiliar reúne várias famílias numa só UC.",
        "Antes de 2014 poucas distribuidoras constam do arquivo; a série nacional começa quando o conjunto de informantes se estabiliza.",
        "A DMR é a receita que a distribuidora deixa de cobrar e recebe da CDE; não é o desconto por família.",
    ]
    prov_scs = c.proveniencia(
        indicador="Tarifa Social por distribuidora e mês (SCS)", natureza="OBSERVADO",
        fonte=_fonte("ANEEL", "SCS: Sistema de Controle de Subvenções e Programas Sociais", rec_scs,
                     ckan.url_dataset("ANEEL", PAC_SCS), f_scs["url"], LIC_ANEEL),
        unidade="unidades consumidoras; MWh; R$ correntes", frequencia="mensal",
        periodo={"inicio": meses[0], "fim": ref}, cobertura={"inicio": meses[0], "fim": meses[-1]},
        capturado_em=c.ultima_captura(snap), snapshot=snap, limitacoes=lim_scs,
        transformacoes=["despacho vigente por distribuidora e competência", "soma das 5 faixas de consumo",
                        "DMR lida uma vez por distribuidora e mês"],
        download="/energia/series/inclusao_tsee_mensal.csv", notas_fonte=ckan.meta_local(DS_SCS).get("notas"))
    prov_part = c.proveniencia(
        indicador="Participação da Tarifa Social nas UC residenciais", natureza="CALCULADO",
        fonte=prov_scs["fonte"], unidade="%", frequencia="mensal", periodo={"inicio": meses[0], "fim": ref},
        cobertura={"inicio": meses[0], "fim": meses[-1]}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        formula="participação = 100 × Σ UC com Tarifa Social ÷ Σ UC residenciais, somente distribuidoras com total residencial consistente no mês",
        transformacoes=["exclusão, das duas somas, de distribuidora com total residencial inconsistente (regra publicada)",
                        "incorporação detectada no SCS (saída definitiva e salto compatível da sucessora) separa a série da sucessora: "
                        "a mediana de consistência só compara meses do mesmo lado da incorporação"],
        limitacoes=lim_scs + ["A participação mede quanto das UC residenciais tem o benefício; não é cobertura do público elegível (ver cobertura potencial)."],
        download="/energia/series/inclusao_tsee_mensal.csv")
    snap_cde = c.snapshot_de(con, DS_CDE)
    prov_cde = c.proveniencia(
        indicador="Faturas com desconto da Tarifa Social por município e UF (Beneficiários da CDE)", natureza="CALCULADO",
        fonte=_fonte("ANEEL", "Beneficiários da Conta de Desenvolvimento Energético (CDE)",
                     (next((m["recurso"] for m in cde_meses if m["mes"] == mes_mapa), None) or "arquivos mensais"),
                     ckan.url_dataset("ANEEL", PAC_CDE), next((m.get("url") for m in [infos.get(mes_mapa) or {}]), None) or ckan.url_dataset("ANEEL", PAC_CDE),
                     LIC_ANEEL),
        unidade="faturas de faturamento com desconto no mês; R$", frequencia="mensal (meses processados)",
        periodo={"inicio": min(no_bronze) if no_bronze else "", "fim": mes_mapa or (max(no_bronze) if no_bronze else "")},
        cobertura={"inicio": min(cde) if cde else "", "fim": max(cde) if cde else ""},
        capturado_em=c.ultima_captura(snap_cde), snapshot=snap_cde,
        formula=("faturas = número de linhas com DscTipoSubsidio = SubsBaixaRenda, IdcTipoFaturamento = 1 e subclasse 3.2 a 3.6, por município; "
                 "desconto = soma de VlrSubsidio dessas linhas; desconto líquido = soma de VlrSubsidio das subclasses 3.2 a 3.6 nos tipos 1 a 4; "
                 "desconto médio por fatura = desconto ÷ faturas"),
        transformacoes=["leitura em fluxo do CSV mensal (cerca de 2 GB descompactado)", "agregação por distribuidora, município, subclasse e tipo de faturamento",
                        "nenhum campo pessoal (nome, CPF) é lido para o silver nem publicado"],
        limitacoes=["A ANEEL avisa que a base pode mudar a qualquer momento por retificação das distribuidoras.",
                    "Faturas de cancelamento e refaturamento (tipos 2 a 4) não entram na contagem; entram no desconto líquido do mês, que só soma as subclasses 3.2 a 3.6. Linhas SubsBaixaRenda de outras subclasses (iluminação pública, industrial, comercial) ficam fora e aparecem à parte como diagnóstico.",
                    "O arquivo mais recente pode não trazer todas as distribuidoras; o mês do mapa é o mais recente com cobertura de pelo menos 99,5% das UC do SCS. Meses sondados abaixo desse mínimo não guardam o original e publicam só a cobertura.",
                    "Linhas com código de município em formato inválido ou inexistente na lista de municípios do IBGE entram no total nacional mas não no mapa.",
                    "A série mensal da CDE começa no último mês completo do SCS (mai/2025) e vai até o mês do mapa; meses anteriores não foram processados (o SCS cobre o período)."]
                   + ([_texto_maiores_diferencas(reconc, mes_conf)] if reconc and reconc.get("diferenca_pct") is not None else []),
        # a ficha cobre o mapa por município e a série mensal por UF: os dois arquivos, cada um com o que o nome diz
        download=["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cde_mensal_uf.csv"])
    base.escreve_csv("inclusao_tsee_mensal.csv",
                     ["mes", "distribuidoras", "completo", "distribuidoras_faltantes", "uc_tsee_faltantes_ultimo_informe",
                      "uc_tsee", *[f"uc_{m}" for m in MODS], "uc_residencial",
                      "participacao_pct", "excluidas_participacao", "dmr_reais", "dmr_cde_reais", "mwh_tsee"],
                     [[l["m"], l["distribuidoras"], 1 if l["completo"] else 0, l["distribuidoras_faltantes"],
                       l["uc_tsee_faltantes_ultimo_informe"], l["uc_tsee"], *[l[f"uc_{m}"] for m in MODS],
                       l["uc_residencial"], l["participacao_pct"], l["excluidas_participacao"], l["dmr_reais"],
                       l["dmr_cde_reais"], l["mwh_tsee"]] for l in serie])
    linhas_d = []
    for cn in sorted(dist):
        d = dist[cn]
        for mes in sorted(d.get("uc_tsee", {})):
            uc = d["uc_tsee"][mes]
            res = d.get("uc_residencial", {}).get(mes)
            inc = flag.get((cn, mes))
            dmr = d.get("dmr", {}).get(mes)
            mwh = d.get("mwh_tsee", {}).get(mes)
            linhas_d.append([cn, sigla.get(cn), mes, uc, res,
                             None if inc or not res else round(100 * uc / res, 4), dmr,
                             round(dmr / uc, 4) if uc and dmr is not None else None,
                             round(1000 * mwh / uc, 4) if uc and mwh is not None else None,
                             regs.get(f"{cn}|{mes}", {}).get("despacho"), 1 if inc else 0,
                             1 if mes in rupturas.get(cn, ()) else 0])
    base.escreve_csv("inclusao_tsee_distribuidoras.csv",
                     ["cnpj", "sigla", "mes", "uc_tsee", "uc_residencial", "participacao_pct", "dmr_reais",
                      "dmr_por_uc_reais", "kwh_por_uc", "despacho", "residencial_inconsistente", "ruptura_incorporacao"], linhas_d)
    bloco = {
        "pergunta": "Onde e quanto a Tarifa Social alcança?",
        "mes_referencia": ref, "mes_mapa": mes_mapa,
        "kpis": kpis,
        # gold: série nacional sem o detalhe por modalidade (no CSV); modalidades do mês de referência à parte
        "serie_mensal": [{k: v for k, v in l.items() if k in CAMPOS_SERIE_GOLD} for l in serie if l["m"] >= "2014-01"],
        "modalidades_referencia": {"mes": ref, **{m: lr[f"uc_{m}"] for m in MODS}},
        "faixas_consumo": {"mes": ref, "linhas": faixas_de(ref), "mes_anterior": ref12, "linhas_anterior": faixas_de(ref12)},
        "distribuidoras": distribs,
        "ufs": ufs_tab,
        "cde_meses": cde_meses,
        "serie_cde_uf_json": "/energia/series/inclusao_cde_mensal_uf.json",
        "_serie_cde_uf": serie_cde_uf,  # só para a validação; sai antes da publicação
        "conferencia_scs_cde": reconc,
        "mudancas_de_sigla": mudancas_sigla,
        "siglas_de_outra_fonte": [{"cnpj": cn, "sigla": sigla[cn], "origem": o} for cn, o in sorted(origem_sigla.items())
                                  if o and o != "SCS"],
        "incorporacoes": [{**inc, "sigla_sucessora": sigla.get(inc["sucessora"]),
                           "siglas_incorporadas": [sigla.get(x) for x in inc["incorporadas"]]} for inc in incorporacoes],
        "participacao_mantida_por_incorporacao": [{"mes": m, "cnpj": cn, "sigla": sigla.get(cn)} for m, cn in reincluidos],
        "diagnostico_scs": diag_scs,
        "serie_antiga": antiga,
        "custeio_cde": custeio,
        "eventos": [
            {"data": "2022-01-01", "rotulo": "Concessão automática (Lei nº 14.203/2021)",
             "fonte": URL_ANEEL_TSEE, "detalhe": "A ANEEL informa que a Tarifa Social é concedida automaticamente desde janeiro de 2022 a quem tem direito e é titular da conta."},
            {"data": "2025-07-05", "rotulo": "Gratuidade até 80 kWh (MPV nº 1.300/2025)", "fonte": URL_ANEEL_TSEE,
             "detalhe": "Faturas emitidas a partir de 5 de julho de 2025 têm desconto de 100% até 80 kWh por mês e nenhum desconto acima disso, segundo a ANEEL."},
        ],
        "regras": {
            "mes_completo": ("Mês completo do SCS: pelo menos 90 distribuidoras informantes e nenhuma distribuidora esperada faltando. "
                             "Esperada é a que já informou antes e volta a informar depois (lacuna) ou que informou em algum dos 3 últimos meses do arquivo; "
                             "a que deixa de informar para sempre antes disso saiu do conjunto por incorporação e não torna o mês incompleto."),
            "residencial_inconsistente": ("Total residencial ausente, zero, menor que as UC com Tarifa Social ou mais de 25% distante da mediana dos 3 meses anteriores e 3 posteriores: a distribuidora sai das duas somas da participação naquele mês. "
                                          "Quando a distribuidora incorporou outra (incorporacoes), a mediana só usa meses do mesmo lado da incorporação: o novo patamar não é erro de dado."),
            "incorporacao": ("Incorporação detectada no próprio SCS: distribuidora que informa pela última vez antes dos 3 últimos meses do arquivo e nunca volta, "
                             "e sucessora cujo total residencial muda de patamar no mês seguinte (mediana dos 3 totais seguintes menos a dos 3 anteriores) "
                             "em valor a até 25% do total residencial das que saíram, com salto de pelo menos 5% do patamar anterior."),
            "maiores_diferencas": (f"A lista de maiores diferenças SCS × CDE considera distribuidoras com {numero_exibido(UC_MINIMA_DIFERENCAS)} UC ou mais no SCS; "
                                   "as menores com diferença acima de ±2% aparecem em diferencas_distribuidoras_pequenas."),
            "desconto_liquido": "Desconto líquido do mês: soma de VlrSubsidio das subclasses 3.2 a 3.6 nos tipos de faturamento 1 a 4; outras subclasses com SubsBaixaRenda ficam fora e são publicadas à parte.",
            "despacho_vigente": "Competência em mais de um despacho: vale o de data de registro mais recente; os demais ficam listados como alternativos.",
            "mes_mapa": "Arquivo mensal da CDE mais recente com cobertura de pelo menos 99,5% das UC do SCS no mês de conferência.",
            "mes_cde_sem_original": "Mês da CDE sondado e rejeitado pela cobertura não guarda o original no bronze; publica só a cobertura e o motivo, sem contagens nem valores.",
            "municipio_valido": "Código IBGE de 7 dígitos cujo prefixo de 6 dígitos está na lista de municípios do Cadastro Único (IBGE); outro código fica só no total nacional.",
        },
        "proveniencia": {"scs": prov_scs, "participacao": prov_part, "cde": prov_cde,
                         **({"antiga": antiga["proveniencia"]} if antiga else {}),
                         **({"custeio": custeio["proveniencia"]} if custeio else {})},
    }
    ctx = {"referencias": {"scs_mes_referencia": ref, "scs_ultimo_mes_no_arquivo": meses[-1], "cde_mes_mapa": mes_mapa,
                           "cde_mes_conferencia": mes_conf, "cde_mes_mais_recente": max(cde) if cde else None},
           "serie_scs": por_mes, "mun_mapa": mun_mapa, "mes_mapa": mes_mapa, "cde_meses": cde_meses,
           "custeio": custeio, "total_mapa_faturas": next((m["faturas_tsee"] for m in cde_meses if m["mes"] == mes_mapa), None)}
    return bloco, ctx


def _testes_scs(diag, completude, ref, antiga):
    """Controles executados sobre o SCS nesta construção, com veredito explícito."""
    out = []
    if diag:
        n_inc = diag.get("pares_com_faixas_incompletas")
        out.append(ev.teste("cinco faixas de consumo em cada despacho vigente", "aprovado" if n_inc == 0 else "ressalva",
                            f"{numero_exibido(n_inc)} de {numero_exibido(diag.get('pares'))} pares distribuidora e competência sem as 5 faixas"))
        n_var = diag.get("pares_com_dmr_variando_entre_faixas")
        out.append(ev.teste("DMR repetida nas faixas do despacho é lida uma vez (não somada)", "aprovado" if n_var == 0 else "ressalva",
                            f"{numero_exibido(n_var)} pares com DMR diferente entre faixas; a DMR entra uma vez por distribuidora e mês"))
        out.append(ev.teste("despacho vigente quando a competência aparece em mais de um despacho", "aprovado",
                            f"{numero_exibido(diag.get('pares_com_mais_de_um_despacho'))} pares em mais de um despacho, "
                            f"{numero_exibido(diag.get('pares_com_despachos_divergentes'))} com valores diferentes; vale o de registro mais recente"))
    falt = completude.get(ref, {}).get("faltantes", [])
    out.append(ev.teste("mês de referência completo (nenhuma distribuidora esperada faltando)", "aprovado" if not falt else "reprovado",
                        f"{len(falt)} distribuidora(s) esperada(s) ausente(s) em {ref}"))
    todos = [x for x in (antiga or {}).get("comparacao_scs", []) if x.get("diferenca_pct") is not None]
    comp = [x for x in todos if not x.get("repete_trimestre")]
    repetidos = [x["m"] for x in todos if x.get("repete_trimestre")]
    if comp:
        dif = [abs(x["diferenca_pct"]) for x in comp]
        fora = [f"{x['m']} ({numero_exibido(x['diferenca_pct'], 2)}%)" for x in comp if abs(x["diferenca_pct"]) > TOLERANCIA_ANTIGA_PCT]
        out.append(ev.teste("SCS contra a série antiga da ANEEL nos trimestres comuns",
                            "aprovado" if not fora else "ressalva",
                            f"{len(comp)} trimestres entre {comp[0]['m']} e {comp[-1]['m']}; mediana da diferença absoluta "
                            f"{numero_exibido(_mediana(dif), 2)}%; fora da tolerância de {numero_exibido(TOLERANCIA_ANTIGA_PCT, 1)}%: "
                            f"{', '.join(fora) if fora else 'nenhum'}"
                            + (f"; fora da estatística por repetir o trimestre anterior no arquivo original: {', '.join(repetidos)}"
                               if repetidos else "")))
    return out


def _bloco_antiga(con, por_mes_scs):
    obs = _vigentes(con, DS_ANTIGA)
    if not obs:
        return None
    regs = base.registros_como_estavam_em(con, DS_ANTIGA)
    pts = collections.defaultdict(dict)
    for serie, vals in obs.items():
        reg, campo = serie.split(".", 1)
        for mes, v in vals.items():
            pts[(reg, mes)][campo] = v
    linhas = []
    for (reg, mes), v in sorted(pts.items(), key=lambda x: (x[0][1], x[0][0])):
        res, br = v.get("uc_residencial"), v.get("uc_baixa_renda")
        linhas.append({"regiao": "RG-" + reg, "m": mes, "uc_residencial": res, "uc_baixa_renda": br,
                       "participacao_pct": _r(100 * br / res, 2) if res and br is not None else None,
                       "processado_em": regs.get(f"{reg}|{mes}", {}).get("processado_em")})
    nac = collections.defaultdict(lambda: [0.0, 0.0, 0])
    for l in linhas:
        a = nac[l["m"]]
        a[0] += l["uc_residencial"] or 0
        a[1] += l["uc_baixa_renda"] or 0
        a[2] += 1
    comparacao = []
    rep = []
    ant = None
    for mes, (res, br, n) in sorted(nac.items()):
        if n != 5:
            continue
        s_ = por_mes_scs.get(mes)
        # trimestre que repete a contagem do anterior no arquivo original (nov/2018 = set/2018) fica
        # marcado e fora da estatística de concordância: não é uma observação independente
        repete = ant["m"] if ant and br == ant["uc_baixa_renda_antiga"] else None
        if repete:
            rep.append({"m": mes, "repete": repete})
        l = {"m": mes, "uc_baixa_renda_antiga": br, "uc_residencial_antiga": res,
             "uc_tsee_scs": s_["uc_tsee"] if s_ and s_["completo"] else None,
             "diferenca_pct": _r(100 * (s_["uc_tsee"] / br - 1), 2) if s_ and s_["completo"] and br else None,
             "repete_trimestre": repete}
        comparacao.append(l)
        ant = l
    portal = regs.get("portal", {})
    snap = c.snapshot_de(con, DS_ANTIGA)
    base.escreve_csv("inclusao_tsee_antiga.csv", ["regiao", "mes", "uc_residencial", "uc_baixa_renda", "participacao_pct", "processado_em"],
                     [[l["regiao"], l["m"], l["uc_residencial"], l["uc_baixa_renda"], l["participacao_pct"], l["processado_em"]]
                      for l in linhas])
    prov = c.proveniencia(
        indicador="Série antiga da Tarifa Social por região (descontinuada)", natureza="OBSERVADO",
        fonte=_fonte("ANEEL", "Tarifa Social de Energia Elétrica: Beneficiários (descontinuado)",
                     "tarifasocial.csv (cópia arquivada em 29/07/2024)", ckan.url_dataset("ANEEL", PAC_ANTIGA),
                     URL_ANTIGA_ARQUIVADA, LIC_ANTIGA),
        unidade="unidades consumidoras", frequencia="trimestral", periodo={"inicio": linhas[0]["m"], "fim": linhas[-1]["m"]},
        cobertura={"inicio": linhas[0]["m"], "fim": linhas[-1]["m"]}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em="2021-11-30T19:18:37Z",
        limitacoes=["Conjunto descontinuado pela ANEEL e substituído, segundo o próprio catálogo, pela base de Beneficiários da CDE.",
                    "O recurso no portal redireciona para a própria URL; a cópia usada é a guardada pelo Internet Archive, conferida contra o SCS nos trimestres comuns.",
                    "A contagem de nov/2018 repete a de set/2018 no arquivo original." if any(r["m"] == "2018-11" for r in rep) else
                    "Valores repetidos entre trimestres ficam marcados na comparação."],
        download="/energia/series/inclusao_tsee_antiga.csv")
    return {"status": "descontinuado", "titulo_no_portal": portal.get("titulo"), "nota_do_portal": portal.get("notas"),
            "teste_do_recurso": {"status_http": portal.get("teste_status"), "location": portal.get("teste_location"),
                                 "conclusao": portal.get("teste_conclusao"), "testado_em": portal.get("testado_em")},
            "copia_usada": URL_ANTIGA_ARQUIVADA, "linhas_por_regiao": len(linhas), "comparacao_scs": comparacao,
            "valores_repetidos": rep, "proveniencia": prov}


RUBRICAS_CUSTEIO = {"Subsídio Baixa Renda": "tarifa_social", "Programa Luz para Todos - PLPT": "luz_para_todos",
                    "CCC": "ccc_sistemas_isolados"}


def _bloco_custeio(con):
    obs = _vigentes(con, DS_CUSTEIO)
    if not obs:
        return None
    anos = sorted({a for pts in obs.values() for a in pts})
    linhas = []
    csv_l = []
    for a in anos:
        l = {"ano": a}
        desp = [pts[a] for s, pts in obs.items() if s.startswith("Despesa|") and a in pts and pts[a] is not None]
        l["despesa_total_reais"] = _r(sum(desp), 2) if desp else None
        for rub, k in RUBRICAS_CUSTEIO.items():
            v = obs.get(f"Despesa|{rub}", {}).get(a)
            l[f"{k}_reais"] = _r(v, 2)
            l[f"{k}_pct_despesa"] = _r(100 * v / l["despesa_total_reais"], 2) if v is not None and l["despesa_total_reais"] else None
        linhas.append(l)
        for s, pts in obs.items():
            if a in pts:
                t, rub = s.split("|", 1)
                csv_l.append([a, t, rub, pts[a]])
    base.escreve_csv("inclusao_cde_custeio.csv", ["ano", "tipo", "rubrica", "valor_reais"], csv_l)
    snap = c.snapshot_de(con, DS_CUSTEIO)
    ano_corrente = str(datetime.now(timezone.utc).year)
    prov = c.proveniencia(
        indicador="CDE: valores anuais para Tarifa Social, Luz para Todos e CCC", natureza="OBSERVADO",
        fonte=_fonte("ANEEL", "Conta Desenvolvimento Energético (CDE): custeio dos benefícios tarifários",
                     "cde-custeio-beneficios-tarifarios.csv", ckan.url_dataset("ANEEL", PAC_CUSTEIO),
                     (base.ultima_vintage(con, DS_CUSTEIO, "cde-custeio-beneficios-tarifarios.csv") or {}).get("url"), LIC_ANEEL),
        unidade="R$ correntes", frequencia="anual", periodo={"inicio": anos[0], "fim": anos[-1]},
        cobertura={"inicio": anos[0], "fim": anos[-1]}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        limitacoes=["O conjunto não distingue valor orçado de valor executado; o ano em curso só pode ser valor orçado.",
                    "Os valores anuais da CDE não coincidem com a soma da DMR do SCS: a CDE registra o ano de referência do orçamento e dos repasses, o SCS a competência do desconto.",
                    "Valores nominais, sem correção pela inflação."],
        download="/energia/series/inclusao_cde_custeio.csv")
    return {"linhas": linhas, "ano_corrente": ano_corrente if ano_corrente in anos else None, "proveniencia": prov}


# ================================================================ P060: cobertura potencial (proxy)

REGRA_ELEGIBILIDADE = {
    "fonte": URL_ANEEL_TSEE,
    "consultado_em": "2026-09-30",
    "base_legal": "Lei nº 12.212/2010, Lei nº 10.438/2002, Portaria Interministerial MME/MS nº 630/2011; REN ANEEL nº 1.000/2021 (arts. 176 a 179 e 200); MPV nº 1.300/2025 (desconto a partir de 05/07/2025).",
    "criterios": [
        {"id": "I", "texto": "Família inscrita no Cadastro Único com renda familiar mensal por pessoa de até meio salário mínimo.",
         "no_denominador": True},
        {"id": "II", "texto": "Idoso com 65 anos ou mais ou pessoa com deficiência que recebe o BPC.", "no_denominador": False},
        {"id": "III", "texto": "Família no Cadastro Único com renda de até 3 salários mínimos e morador que depende de equipamento elétrico para tratamento de saúde.",
         "no_denominador": False},
    ],
    "requisitos": ["Cadastro Único atualizado nos últimos 2 anos.", "Uma única UC por família, residencial.",
                   "Endereço do cadastro na área da distribuidora.", "Concessão automática desde janeiro de 2022 quando um membro da família é titular da conta."],
    "vigencia": ("Os critérios de quem tem direito são os mesmos no período coberto pela comparação (a MPV nº 1.300/2025 mudou o "
                 "tamanho do desconto, não o público); a verificação foi feita na página da ANEEL em 30/09/2026."),
    "por_que_proxy": [
        "O numerador conta UC (SCS) ou faturas (CDE) com desconto; o denominador conta famílias. Uma família só pode ter o benefício em uma UC, mas pode não ser titular da conta (inquilino, conta em nome de terceiro, ligação compartilhada), e aí não aparece no numerador.",
        "O numerador inclui beneficiários pelos critérios II e III, que não estão (ou não estão todos) no denominador; por isso a razão pode passar de 100%.",
        "O município da fatura é o da UC; o do Cadastro Único é o da residência declarada.",
        "Famílias sem acesso à rede elétrica estão no denominador e não podem estar no numerador.",
    ],
}


def _bloco_cobertura(con, ctx):
    mds = _vigentes(con, DS_MDS)
    if not mds:
        return None
    br_at = mds.get("BR.familias_ate_meio_sm_atualizadas", {})
    br_cad = mds.get("BR.familias_ate_meio_sm", {})
    serie = []
    for mes, l in sorted(ctx["serie_scs"].items()):
        if not l["completo"] or mes not in br_at:
            continue
        serie.append({"m": mes, "uc_tsee": l["uc_tsee"], "familias_atualizadas": br_at.get(mes),
                      "familias_cadastradas": br_cad.get(mes),
                      "razao_atualizadas_pct": _r(100 * l["uc_tsee"] / br_at[mes], 2) if br_at.get(mes) else None,
                      "razao_cadastradas_pct": _r(100 * l["uc_tsee"] / br_cad[mes], 2) if br_cad.get(mes) else None})
    # série longa (desde abr/2015) lida sob demanda pela página; a gold leva o endereço e o último ponto
    base.escreve_gold("inclusao_cobertura_mensal.json",
                      {"gerado_em": base.agora_utc(), "natureza_da_medida": "PROXY",
                       "unidade": "UC com Tarifa Social (SCS, meses completos) por 100 famílias do Cadastro Único com renda per capita até meio salário mínimo",
                       "campos": ["m", "uc_tsee", "familias_atualizadas", "familias_cadastradas", "razao_atualizadas_pct", "razao_cadastradas_pct"],
                       "serie": serie}, destino=base.SERIES)
    base.escreve_csv("inclusao_cobertura_mensal.csv",
                     ["mes", "uc_tsee_scs", "familias_ate_meio_sm_atualizadas", "familias_ate_meio_sm",
                      "razao_proxy_atualizadas_pct", "razao_proxy_cadastradas_pct"],
                     [[s["m"], s["uc_tsee"], s["familias_atualizadas"], s["familias_cadastradas"],
                       s["razao_atualizadas_pct"], s["razao_cadastradas_pct"]] for s in serie])
    mes = ctx["mes_mapa"]
    regs = base.registros_como_estavam_em(con, DS_MDS)
    municipios = []
    brasil = None
    ufs = []
    distribuicao = None
    sem_mds = []
    if mes:
        at = {s.split(".")[0]: v.get(mes) for s, v in mds.items() if s.endswith(".familias_ate_meio_sm_atualizadas") and not s.startswith("BR.")}
        cad = {s.split(".")[0]: v.get(mes) for s, v in mds.items() if s.endswith(".familias_ate_meio_sm") and not s.startswith("BR.")}
        at = {k: v for k, v in at.items() if v is not None}
        cad = {k: v for k, v in cad.items() if v is not None}
        mun = ctx["mun_mapa"]
        cods = sorted(set(at) | set(cad) | set(mun))
        for cod in cods:
            m = mun.get(cod)
            a, cd = at.get(cod), cad.get(cod)
            if m is None and (a is not None or cd is not None):
                num = None  # município sem fatura no arquivo: ausência, não zero
            else:
                num = m["faturas"] if m else None
            if m is not None and a is None and cd is None:
                sem_mds.append(cod)
            r = regs.get(cod, {})
            uf = r.get("uf") or fi.UF_SIGLA.get(cod[:2])
            municipios.append({"cod": cod, "municipio": r.get("municipio"), "uf": uf, "faturas": num,
                               "desconto_reais": _r(m["valor"], 2) if m else None,
                               "familias_atualizadas": a, "familias_cadastradas": cd,
                               "razao_atualizadas_pct": _r(100 * num / a, 2) if num is not None and a else None,
                               "razao_cadastradas_pct": _r(100 * num / cd, 2) if num is not None and cd else None,
                               "base_pequena": bool(a is not None and a < BASE_PEQUENA)})
        # Brasil: todas as faturas do mês (inclusive com código de município inválido) ÷ total nacional do MDS
        tot_f = ctx["total_mapa_faturas"]
        a_br, c_br = br_at.get(mes), br_cad.get(mes)
        v_mds = base.ultima_vintage(con, DS_MDS, f"municipios_{mes}")
        rec_cde = next((m_["recurso"] for m_ in ctx["cde_meses"] if m_["mes"] == mes), None)
        v_cde = base.ultima_vintage(con, DS_CDE, rec_cde) if rec_cde else None
        f_cob = {"orgao": "ANEEL e MDS", "conjunto": "Beneficiários da CDE (numerador) e Cadastro Único por município, MI Social (denominador)",
                 "recurso": rec_cde, "url": ckan.url_dataset("ANEEL", PAC_CDE), "arquivo": (v_cde or {}).get("arquivo"),
                 "sha256": (v_cde or {}).get("sha256"), "capturado_em": (v_cde or {}).get("capturado_em"),
                 "publicado_em": (v_cde or {}).get("publicado_em"),
                 "arquivos": [ev.arquivo_de_vintage(v) for v in (v_cde, v_mds) if v]}
        soma_mun_at = sum(x["familias_atualizadas"] or 0 for x in municipios)
        soma_mun_f = sum(x["faturas"] or 0 for x in municipios)
        n_inval = next((m_["faturas_municipio_invalido"] for m_ in ctx["cde_meses"] if m_["mes"] == mes), 0) or 0
        testes_cob = [
            ev.teste("soma municipal do Cadastro Único igual ao total nacional do serviço",
                     "aprovado" if a_br is not None and abs(soma_mun_at - a_br) < 0.5 else "reprovado",
                     f"{numero_exibido(soma_mun_at)} somando os municípios; {numero_exibido(a_br)} nas estatísticas do serviço"),
            ev.teste("faturas dos municípios mais faturas sem município válido iguais ao total do arquivo",
                     "aprovado" if tot_f is not None and abs(soma_mun_f + n_inval - tot_f) < 0.5 else "reprovado",
                     f"{numero_exibido(soma_mun_f)} + {numero_exibido(n_inval)} = {numero_exibido(tot_f)}"),
            ev.teste("mesmo mês de referência no numerador e no denominador", "aprovado",
                     f"CDE {c.mes_br(mes)}; Cadastro Único anomes_s = {mes.replace('-', '')}"),
        ]
        valor_br = _r(100 * tot_f / a_br, 2) if tot_f and a_br else None
        brasil = {
            "mes": mes, "faturas_tsee": tot_f, "familias_atualizadas": a_br, "familias_cadastradas": c_br,
            "razao_atualizadas_pct": valor_br,
            "razao_cadastradas_pct": _r(100 * tot_f / c_br, 2) if tot_f and c_br else None,
            "proxy": True,
            "evidencia": _evidencia(
                valor=valor_br, unidade="faturas com desconto da Tarifa Social por 100 famílias elegíveis pelo critério de renda",
                periodo=mes, entidade="Brasil", universo="faturas de faturamento com desconto da Tarifa Social; famílias do Cadastro Único com renda per capita até meio salário mínimo e cadastro atualizado",
                fonte=f_cob, formula="100 × faturas com desconto da Tarifa Social (tipo 1, subclasses 3.2 a 3.6) ÷ famílias com renda per capita até ½ salário mínimo e cadastro atualizado (PROXY)",
                chaves_origem=[f"CDE: arquivo {rec_cde}", f"MDS: anomes_s = {mes.replace('-', '')}, campo cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i, soma dos municípios"],
                numerador={"descricao": "faturas com Tarifa Social (ANEEL, Beneficiários da CDE)", "valor": tot_f},
                denominador={"descricao": "famílias com renda per capita até meio salário mínimo e cadastro atualizado (MDS)", "valor": a_br},
                exclusoes=["o numerador inclui beneficiários pelo BPC e por equipamento médico, ausentes do denominador: por isso é proxy, não taxa de cobertura",
                           "o numerador conta faturas (em regra uma por UC no mês), não famílias nem UC"],
                cobertura=f"{len(municipios)} municípios no Cadastro Único do mês; faturas de todas as distribuidoras do arquivo",
                casas=1, testes=testes_cob, download=["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cobertura_mensal.csv"],
                indicador="Razão entre faturas com desconto da Tarifa Social e famílias elegíveis pela renda (proxy de cobertura)"),
        }
        por_uf = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0, 0])
        for m_ in municipios:
            if m_["faturas"] is None or m_["familias_atualizadas"] is None:
                continue
            p = por_uf[m_["uf"]]
            p[0] += m_["faturas"]
            p[1] += m_["familias_atualizadas"]
            p[2] += m_["familias_cadastradas"] or 0
            p[3] += 1
        for m_ in municipios:
            if m_["faturas"] is None and m_["uf"] in por_uf:
                por_uf[m_["uf"]][4] += 1
        for uf in UF_NOME:
            p = por_uf.get(uf)
            if not p:
                continue
            ufs.append({"uf": uf, "nome": UF_NOME[uf], "regiao": REGIAO_DA_UF[uf], "faturas_tsee": p[0],
                        "familias_atualizadas": p[1], "familias_cadastradas": p[2],
                        "razao_atualizadas_pct": _r(100 * p[0] / p[1], 2) if p[1] else None,
                        "razao_cadastradas_pct": _r(100 * p[0] / p[2], 2) if p[2] else None,
                        "municipios": p[3], "municipios_sem_fatura_no_arquivo": p[4]})
        razoes = [m_["razao_atualizadas_pct"] for m_ in municipios
                  if m_["razao_atualizadas_pct"] is not None and not m_["base_pequena"]]
        faixas = [(0, 40), (40, 60), (60, 80), (80, 100), (100, 120), (120, None)]
        distribuicao = {
            "municipios": len(razoes),
            "quantis": {k: _r(c.quantil(razoes, q), 1) for k, q in (("p10", .1), ("p25", .25), ("p50", .5), ("p75", .75), ("p90", .9))},
            "acima_de_100": sum(1 for x in razoes if x > 100),
            "histograma": [{"de": a, "ate": b, "municipios": sum(1 for x in razoes if x >= a and (b is None or x < b))} for a, b in faixas],
            "base_pequena_excluidos": sum(1 for m_ in municipios if m_["base_pequena"]),
            "sem_fatura_no_arquivo": sum(1 for m_ in municipios if m_["faturas"] is None),
            "faturas_sem_cadastro_mds": len(sem_mds),
        }
        mes_cad = mes
        base.escreve_csv("inclusao_municipios.csv",
                         ["cod_ibge6", "municipio", "uf", "mes_cde", "faturas_tsee", "desconto_reais", "mes_cadunico",
                          "familias_ate_meio_sm_atualizadas", "familias_ate_meio_sm", "razao_proxy_atualizadas",
                          "razao_proxy_cadastradas", "base_pequena"],
                         [[m_["cod"], m_["municipio"], m_["uf"], mes, m_["faturas"], m_["desconto_reais"], mes_cad,
                           m_["familias_atualizadas"], m_["familias_cadastradas"], m_["razao_atualizadas_pct"],
                           m_["razao_cadastradas_pct"], 1 if m_["base_pequena"] else 0] for m_ in municipios])
    snap = c.snapshot_de(con, DS_MDS)
    lim = [
        "PROXY: a razão compara UC com desconto e famílias elegíveis pelo critério de renda; não é a proporção de famílias elegíveis atendidas.",
        "O numerador inclui beneficiários pelo BPC e por equipamento médico, fora do denominador: a razão pode passar de 100% sem erro.",
        "Não se publica número de famílias fora do benefício: a diferença entre as duas contagens mistura titularidade da conta, falta de acesso à rede e os critérios fora do denominador.",
        "Municípios com menos de 50 famílias no denominador ficam fora da distribuição (razão instável).",
    ]
    prov = c.proveniencia(
        indicador="Cobertura potencial da Tarifa Social (proxy)", natureza="CALCULADO",
        fonte=_fonte("MDS", "Cadastro Único por município (MI Social)", "cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i",
                     fm.URL_MISOCIAL, fm.URL_MISOCIAL, LIC_MDS),
        unidade="UC com Tarifa Social (série mensal nacional, SCS) ou faturas com desconto (Brasil, UF e município no mês do mapa, CDE) por 100 famílias", frequencia="mensal", periodo={"inicio": serie[0]["m"] if serie else (mes or ""), "fim": mes or (serie[-1]["m"] if serie else "")},
        cobertura={"inicio": serie[0]["m"] if serie else "", "fim": serie[-1]["m"] if serie else ""},
        capturado_em=c.ultima_captura(snap), snapshot=snap,
        formula="razão = 100 × UC (ou faturas) com Tarifa Social ÷ famílias do Cadastro Único com renda per capita até ½ salário mínimo (atualizadas; faixa de sensibilidade com todas as cadastradas)",
        transformacoes=["numerador mensal nacional: SCS (meses completos)", "numerador municipal: Beneficiários da CDE no mês do mapa",
                        "denominador: MI Social, mesmo mês de referência", "vínculo de município pelos 6 primeiros dígitos do código IBGE"],
        limitacoes=lim, download="/energia/series/inclusao_municipios.csv")
    return {
        "pergunta": "Quem pode estar ficando de fora?",
        "natureza_da_medida": "PROXY",
        "regra_elegibilidade": REGRA_ELEGIBILIDADE,
        "brasil": brasil, "ufs": ufs, "distribuicao_municipal": distribuicao,
        "serie_mensal_json": "/energia/series/inclusao_cobertura_mensal.json",
        "serie_mensal_ultimo": serie[-1] if serie else None,
        "serie_mensal_meses": len(serie),
        "faixa_de_sensibilidade": "Denominador com todas as famílias cadastradas (limite inferior da razão) e só com as atualizadas (limite superior): não é intervalo estatístico, é sensibilidade à definição do denominador.",
        "proveniencia": {"cobertura": prov},
    }


# ================================================================ P061: peso no orçamento (POF)

MEDIDAS_POF = ("energia_media", "despesa_media", "razao_medias_pct", "media_razoes_desp_pct", "media_razoes_renda_pct",
               "mediana_desp_pct", "mediana_renda_pct", "sem_despesa_energia_pct") + tuple(
    f"acima_{int(L)}_{b}_pct" for L in LIMIARES for b in ("renda", "desp"))


# sensibilidade da média das participações na renda (só no CSV e no bloco sensibilidade_media_razoes_renda)
SENS_POF = ("sens_media_razoes_renda_sem_acima_da_renda_pct", "sens_renda_familias_energia_acima_da_renda_n",
            "sens_renda_familias_energia_acima_da_renda_peso_pct", "sens_media_razoes_renda_3_maiores_pp")


ROTULO_MEDIDA_POF = {
    "energia_media": "Despesa média com energia elétrica (R$ por família e mês)",
    "despesa_media": "Despesa total média (R$ por família e mês)",
    "razao_medias_pct": "Razão de médias: energia ÷ despesa total (%)",
    "media_razoes_desp_pct": "Média das participações da energia na despesa de cada família (%)",
    "media_razoes_renda_pct": "Média das participações da energia na renda de cada família (%)",
    "mediana_desp_pct": "Mediana da participação na despesa (%)",
    "mediana_renda_pct": "Mediana da participação na renda (%)",
    "sem_despesa_energia_pct": "Famílias sem despesa com energia elétrica (%)",
    **{f"acima_{int(L)}_renda_pct": f"Famílias com energia acima de {int(L)}% da renda (%)" for L in LIMIARES},
    **{f"acima_{int(L)}_desp_pct": f"Famílias com energia acima de {int(L)}% da despesa total (%)" for L in LIMIARES},
}


def estado_precisao(valor, ep):
    """Regra de publicação da precisão (CV = 100 × erro-padrão ÷ estimativa): até 15%,
    publicado; de 15% a 30%, publicado com cautela; acima de 30%, suprimido."""
    if valor is None:
        return "ausente", None
    if ep is None:
        return "sem_erro_padrao", None
    if valor == 0:
        # nenhuma família da amostra no domínio: zero amostral, não prova de zero na população
        return ("zero_na_amostra", None) if ep == 0 else ("suprimido", None)
    cv = 100 * ep / abs(valor)
    if cv > CV_SUPRIME:
        return "suprimido", cv
    return ("cautela" if cv > CV_CAUTELA else "publicado"), cv


def _texto_sensibilidade_renda(micro, g, cl="47558"):
    """Texto da sensibilidade da média das participações na renda (Brasil, classe cl), a
    partir das medidas sens_* dos microdados; sem as medidas, diz que não foram calculadas."""
    k = f"BR.{cl}"
    media, mediana = g(micro, f"{k}.media_razoes_renda_pct"), g(micro, f"{k}.mediana_renda_pct")
    sem, n = g(micro, f"{k}.sens_media_razoes_renda_sem_acima_da_renda_pct"), g(micro, f"{k}.sens_renda_familias_energia_acima_da_renda_n")
    peso, top3 = g(micro, f"{k}.sens_renda_familias_energia_acima_da_renda_peso_pct"), g(micro, f"{k}.sens_media_razoes_renda_3_maiores_pp")
    rot = fi.CLASSES_POF.get(cl, (None, cl))[1]
    rot = "todas as famílias" if cl == "7999" else f"famílias com rendimento {rot[0].lower()}{rot[1:]}"
    if sem is None:
        return (f"A média das participações da energia na renda ({rot}) é sensível a famílias com renda declarada quase nula; "
                "a medida de sensibilidade não foi calculada nesta publicação.")
    return (f"A média das participações da energia na renda ({rot}, {numero_exibido(media, 2)}%) depende de poucas famílias com renda "
            f"declarada quase nula: {numero_exibido(n)} famílias da amostra ({numero_exibido(peso, 2)}% do peso) têm despesa com energia "
            f"acima da renda; sem elas a média cai para {numero_exibido(sem, 2)}%; as 3 maiores parcelas somam "
            f"{numero_exibido(top3, 2)} ponto percentual; a mediana é {numero_exibido(mediana, 2)}%.")


def _bloco_orcamento(con):
    sidra = _vigentes(con, DS_POF)
    micro = _vigentes(con, DS_POF_MICRO)
    cvs = _vigentes(con, DS_POF_CV)
    if not sidra or not micro:
        return None
    g = lambda d, k: (d.get(k) or {}).get("2017-2018")  # noqa: E731
    terrs = ["BR", *REGIOES, *UF_NOME]
    linhas = []
    csv_l = []
    comparacoes = []
    for t in terrs:
        for cod, (idx, rot, lo, hi) in fi.CLASSES_POF.items():
            k = f"{t}.{cod}"
            if g(micro, f"{k}.n") is None and g(sidra, f"{k}.energia_eletrica.media_reais") is None:
                continue
            est = {}
            for med in (MEDIDAS_POF if g(micro, f"{k}.n") is not None else ()):
                v, ep = g(micro, f"{k}.{med}"), g(micro, f"{k}.{med}_ep")
                estado, cv = estado_precisao(v, ep)
                # compacto na gold: [valor, CV %, estado]; erro-padrão no CSV (inclusao_pof.csv)
                est[med] = [None if estado == "suprimido" else _r(v, 3 if med.endswith("pct") else 2), _r(cv, 1), estado]
                csv_l.append([t, cod, med, None if estado == "suprimido" else v, ep, cv, "microdados", estado])
            for sk in SENS_POF:
                v = g(micro, f"{k}.{sk}")
                if v is not None:
                    csv_l.append([t, cod, sk, v, g(micro, f"{k}.{sk}_ep"), None, "microdados", "sensibilidade"])
            s_en, s_dt, s_pct = (g(sidra, f"{k}.energia_eletrica.media_reais"), g(sidra, f"{k}.despesa_total.media_reais"),
                                 g(sidra, f"{k}.energia_eletrica.distribuicao_pct"))
            cv_ibge = g(cvs, f"{k}.energia_eletrica.cv")
            for med, v in (("energia_media", s_en), ("despesa_media", s_dt), ("razao_medias_pct", s_pct)):
                if v is not None:
                    csv_l.append([t, cod, med, v, None, cv_ibge if med == "energia_media" else None, "SIDRA 6715", "publicado"])
            if cv_ibge is not None:
                csv_l.append([t, cod, "cv_energia_media_ibge", cv_ibge, None, None, "coeficientes publicados", "publicado"])
            if g(micro, f"{k}.n") is None:
                continue  # UF por classe: só a tabela publicada, que fica no CSV (a gold leva os domínios com microdados)
            if t in UF_NOME:
                est = {m_: v_ for m_, v_ in est.items() if m_ in MEDIDAS_POF_UF}
            linhas.append({"territorio": t, "nome": REGIAO_NOME.get(t) or UF_NOME.get(t), "classe": cod, "classe_rotulo": rot,
                           "n_amostra": g(micro, f"{k}.n"), "familias": _r(g(micro, f"{k}.familias"), 0),
                           "sidra": {"energia_media": s_en, "despesa_media": s_dt, "distribuicao_pct": s_pct,
                                     "cv_energia_ibge_pct": cv_ibge},
                           "microdados": est})
            if s_en is not None and g(micro, f"{k}.energia_media") is not None:
                comparacoes.append({"territorio": t, "classe": cod,
                                    "energia_sidra": s_en, "energia_micro": _r(g(micro, f"{k}.energia_media"), 4),
                                    "despesa_sidra": s_dt, "despesa_micro": _r(g(micro, f"{k}.despesa_media"), 4),
                                    "distribuicao_sidra": s_pct, "razao_medias_micro": _r(g(micro, f"{k}.razao_medias_pct"), 4),
                                    "cv_ibge": cv_ibge, "cv_micro": _r(estado_precisao(g(micro, f"{k}.energia_media"), g(micro, f"{k}.energia_media_ep"))[1], 2)})
    base.escreve_csv("inclusao_pof.csv", ["territorio", "classe", "medida", "valor", "erro_padrao", "cv_pct", "fonte", "estado"], csv_l)
    dif_en = [abs(x["energia_micro"] - x["energia_sidra"]) for x in comparacoes]
    dif_dt = [abs(x["despesa_micro"] - x["despesa_sidra"]) for x in comparacoes if x["despesa_sidra"] is not None]
    dif_pct = [abs(x["razao_medias_micro"] - x["distribuicao_sidra"]) for x in comparacoes if x["distribuicao_sidra"] is not None]
    dif_cv = [abs(x["cv_micro"] - x["cv_ibge"]) for x in comparacoes if x["cv_ibge"] is not None and x["cv_micro"] is not None]
    reconc = {
        "comparacoes": len(comparacoes),
        "energia_max_diferenca_reais": _r(max(dif_en), 4) if dif_en else None,
        "energia_ate_1_centavo": sum(1 for d in dif_en if d <= 0.005 + 1e-9),
        "despesa_max_diferenca_reais": _r(max(dif_dt), 4) if dif_dt else None,
        "despesa_ate_1_centavo": sum(1 for d in dif_dt if d <= 0.005 + 1e-9),
        "distribuicao_max_diferenca_pp": _r(max(dif_pct), 3) if dif_pct else None,
        "distribuicao_ate_arredondamento": sum(1 for d in dif_pct if d <= 0.05 + 1e-9),
        "cv_max_diferenca_pp": _r(max(dif_cv), 2) if dif_cv else None,
        "tolerancias": {
            "medias": "meio centavo: o IBGE publica em reais com duas casas",
            "distribuicao": "0,05 ponto percentual: o IBGE publica a distribuição com uma casa",
            "cv": "comparação informativa: o IBGE calcula o CV com a calibração dos pesos por pós-estratos; aqui a linearização usa estrato e UPA sem refazer a calibração",
        },
        "comparacoes_brasil": [x for x in comparacoes if x["territorio"] == "BR"],
    }
    diag = None
    for ch, campos in base.registros_como_estavam_em(con, DS_CONTROLE).items():
        if campos.get("diagnostico") and "+" in ch:
            diag = json.loads(campos["diagnostico"])
    snap = c.snapshot_de(con, DS_POF_MICRO)
    snap_s = c.snapshot_de(con, DS_POF)
    lim = [
        "Estatística histórica: POF de julho de 2017 a julho de 2018, valores em reais de 15/01/2018. Não representa 2026; o observatório não publica atualização modelada.",
        "Domínios amostrais suportados: Brasil, grandes regiões e UF (total); classes de rendimento só para Brasil e regiões. Não há estimativa municipal.",
        "Limiares de 3%, 5% e 10% são análise de sensibilidade; não existe definição oficial brasileira de pobreza energética por limiar.",
        "Despesa com energia elétrica é a declarada pela família (conta paga no período); família sem conta própria (ligação irregular, energia incluída no aluguel ou condomínio, sem acesso) aparece com despesa zero.",
        "Estimativas com coeficiente de variação acima de 30% são suprimidas; entre 15% e 30% são publicadas com aviso.",
    ]
    prov_s = c.proveniencia(
        indicador="Despesa média com energia elétrica e participação na despesa total (SIDRA 6715)", natureza="ESTIMADO",
        fonte=_fonte("IBGE", "POF 2017-2018, tabela 6715", "valores da API SIDRA (variáveis 1201 e 1204)",
                     "https://sidra.ibge.gov.br/tabela/6715", fi.URL_POF_6715, LIC_IBGE),
        unidade="R$ por família e mês (15/01/2018); %", frequencia="pesquisa de 2017-2018",
        periodo={"inicio": "2017-07", "fim": "2018-07"}, cobertura={"inicio": "2017-07", "fim": "2018-07"},
        capturado_em=c.ultima_captura(snap_s), snapshot=snap_s, publicacao_informada=False,
        transformacoes=["nenhuma: valores da tabela 6715 como publicados; natureza ESTIMADO porque são estimativas amostrais "
                        "publicadas pelo IBGE (estimado pela fonte), não medições"],
        limitacoes=lim[:2] + ["A distribuição publicada é razão de médias (média da despesa com energia ÷ média da despesa total), não a média das participações das famílias."],
        download="/energia/series/inclusao_pof.csv")
    prov_m = c.proveniencia(
        indicador="Participação da energia no orçamento por família (microdados da POF)", natureza="ESTIMADO",
        fonte=_fonte("IBGE", "POF 2017-2018, microdados", "Dados_20230713.zip e Tradutores_20230713.zip",
                     URL_POF_MICRO_DIR, URL_POF_MICRO_DIR + "Dados_20230713.zip", LIC_IBGE),
        unidade="R$ por família e mês (15/01/2018); %", frequencia="pesquisa de 2017-2018",
        periodo={"inicio": "2017-07", "fim": "2018-07"}, cobertura={"inicio": "2017-07", "fim": "2018-07"},
        capturado_em=c.ultima_captura(snap), snapshot=snap, publicacao_informada=False,
        formula=("despesa da família = Σ valor deflacionado × fator de anualização (× meses nos quadros mensais) ÷ 12, "
                 "códigos do tradutor da despesa geral; média das razões = Σ w·(energia ÷ despesa) ÷ Σ w; "
                 "razão de médias = Σ w·energia ÷ Σ w·despesa; erro-padrão por linearização com estrato e UPA"),
        transformacoes=["estimativa do observatório a partir da amostra da POF (estimado pelo observatório): pesos, estrato e UPA do plano amostral",
                        "memória de cálculo do IBGE (Tabela de Despesa Geral.R) refeita em Python",
                        "conferência das médias contra a tabela 6715 em todos os territórios e classes"],
        limitacoes=lim + [_texto_sensibilidade_renda(micro, g)], download="/energia/series/inclusao_pof.csv")
    br = {x["classe"]: x for x in linhas if x["territorio"] == "BR"}
    def kpi_micro(cl, med):
        x = (br.get(cl) or {}).get("microdados", {}).get(med) or [None, None, "ausente"]
        return {"valor": x[0], "cv_pct": x[1], "estado": x[2]}
    v_dados = base.ultima_vintage(con, DS_POF_MICRO, "Dados_20230713.zip")
    v_trad = base.ultima_vintage(con, DS_POF_MICRO, "Tradutores_20230713.zip")
    f_micro = ev.fonte_de_vintage("IBGE", "POF 2017-2018, microdados", URL_POF_MICRO_DIR + "Dados_20230713.zip", v_dados)
    f_micro["arquivos"] = [ev.arquivo_de_vintage(v) for v in (v_dados, v_trad) if v]
    ok_medias = reconc["comparacoes"] and reconc["energia_ate_1_centavo"] == reconc["comparacoes"]
    ok_desp = reconc["comparacoes"] and reconc["despesa_ate_1_centavo"] == len(dif_dt)
    ok_dist = reconc["comparacoes"] and reconc["distribuicao_ate_arredondamento"] == len(dif_pct)
    testes_pof = [
        ev.teste("despesa média com energia refeita dos microdados igual à tabela 6715 (todos os territórios e classes)",
                 "aprovado" if ok_medias else "reprovado",
                 f"{reconc['energia_ate_1_centavo']} de {reconc['comparacoes']} dentro de meio centavo; diferença máxima R$ {numero_exibido(reconc['energia_max_diferenca_reais'], 4)}"),
        ev.teste("despesa total média refeita igual à tabela 6715", "aprovado" if ok_desp else "reprovado",
                 f"{reconc['despesa_ate_1_centavo']} de {len(dif_dt)} dentro de meio centavo; diferença máxima R$ {numero_exibido(reconc['despesa_max_diferenca_reais'], 4)}"),
        ev.teste("razão de médias refeita igual à distribuição publicada", "aprovado" if ok_dist else "reprovado",
                 f"{reconc['distribuicao_ate_arredondamento']} de {len(dif_pct)} dentro de 0,05 ponto percentual"),
    ]
    rec_pof = ev.reconciliacao(
        "Despesa média com energia elétrica por território e classe refeita dos microdados, contra a tabela 6715 do SIDRA (caminho independente: tabela publicada pelo IBGE)",
        "aprovado" if ok_medias and ok_desp else "reprovado", "R$ 0,005 por família e mês (o IBGE publica com duas casas)")
    # a reconciliação com a tabela 6715 confere a despesa média com energia (a base de todas as
    # medidas), não cada medida exibida: a ficha diz isso na própria descrição
    rec_pof_medida = dict(rec_pof, descricao=rec_pof["descricao"] + (
        ". Refere-se à despesa média com energia, a base comum das medidas; a medida exibida nesta ficha não é publicada "
        "pelo IBGE e não tem conferência externa própria."))
    rec_dist = ev.reconciliacao(
        "Razão de médias refeita dos microdados contra a distribuição da despesa com energia publicada na tabela 6715 do SIDRA "
        f"({reconc['distribuicao_ate_arredondamento']} de {len(dif_pct)} territórios e classes dentro da tolerância)",
        "aprovado" if ok_dist else "reprovado", "0,05 ponto percentual (o IBGE publica a distribuição com uma casa)")
    sens = {}
    for cl in ("7999", *[cod for cod, (i, _, _, _) in fi.CLASSES_POF.items() if i is not None]):
        k = f"BR.{cl}"
        if g(micro, f"{k}.media_razoes_renda_pct") is None:
            continue
        sens[cl] = {"media_razoes_renda_pct": _r(g(micro, f"{k}.media_razoes_renda_pct"), 3),
                    "mediana_renda_pct": _r(g(micro, f"{k}.mediana_renda_pct"), 3),
                    "media_sem_energia_acima_da_renda_pct": _r(g(micro, f"{k}.sens_media_razoes_renda_sem_acima_da_renda_pct"), 3),
                    "familias_amostra_energia_acima_da_renda": g(micro, f"{k}.sens_renda_familias_energia_acima_da_renda_n"),
                    "peso_energia_acima_da_renda_pct": _r(g(micro, f"{k}.sens_renda_familias_energia_acima_da_renda_peso_pct"), 3),
                    "tres_maiores_contribuicoes_pp": _r(g(micro, f"{k}.sens_media_razoes_renda_3_maiores_pp"), 3)}
    evidencias = {}
    for chave, cl, med, ent, univ, form, excl in (
        ("media_razoes_renda_classe_baixa", "47558", "media_razoes_renda_pct",
         "Brasil, famílias com rendimento total até R$ 1.908 (valores de 15/01/2018)", "famílias com rendimento total positivo na classe",
         "Σ w·(despesa com energia ÷ rendimento total) ÷ Σ w", ["famílias com rendimento total zero ou negativo"]),
        ("media_razoes_desp_brasil", "7999", "media_razoes_desp_pct", "Brasil, todas as famílias",
         "famílias com despesa total positiva", "Σ w·(despesa com energia ÷ despesa total) ÷ Σ w", ["famílias com despesa total zero"]),
        ("razao_medias_brasil", "7999", "razao_medias_pct", "Brasil, todas as famílias", "todas as famílias",
         "Σ w·despesa com energia ÷ Σ w·despesa total (a mesma medida da distribuição publicada na tabela 6715)", []),
    ):
        x = kpi_micro(cl, med)
        bruto = g(micro, f"BR.{cl}.{med}") if x.get("valor") is not None else None  # antes do arredondamento
        testes_ficha = list(testes_pof)
        cob_ficha = f"{numero_exibido(g(micro, f'BR.{cl}.n'))} famílias na amostra do domínio; coeficiente de variação {numero_exibido(x.get('cv_pct'), 1)}%"
        if med == "media_razoes_renda_pct" and sens.get(cl):
            sx = sens[cl]
            testes_ficha.append(ev.teste(
                "sensibilidade da média das participações na renda a famílias com renda declarada quase nula",
                # material quando muda o número exibido (uma casa decimal)
                "ressalva" if sx["media_sem_energia_acima_da_renda_pct"] is not None and bruto is not None
                and numero_exibido(bruto, 1) != numero_exibido(sx["media_sem_energia_acima_da_renda_pct"], 1) else "aprovado",
                _texto_sensibilidade_renda(micro, g, cl)))
            cob_ficha += f"; mediana da mesma participação {numero_exibido(sx['mediana_renda_pct'], 2)}% (menos sensível aos extremos)"
        evidencias[chave] = _evidencia(
            valor=bruto, unidade="%", periodo=PERIODO_POF, entidade=ent, universo=univ, fonte=f_micro, formula=form,
            chaves_origem=["MORADOR (PESO_FINAL, RENDA_TOTAL, ESTRATO_POF, COD_UPA)",
                           "registros de despesa com o tradutor da despesa geral; energia elétrica = nível 5 1102031"],
            pesos="PESO_FINAL (fator de expansão do IBGE); erro-padrão por linearização com estrato (ESTRATO_POF) e UPA (COD_UPA)",
            exclusoes=excl, casas=1, sufixo="%", testes=testes_ficha,
            reconciliacao=rec_dist if med == "razao_medias_pct" else rec_pof_medida,
            cobertura=cob_ficha,
            tratamento_ausencia="Estimativa com coeficiente de variação acima de 30% é suprimida (fica sem valor); entre 15% e 30% é publicada com aviso.",
            revisoes="Microdados de 13/07/2023; revisões anteriores do IBGE não são reconstituídas.",
            download=["/energia/series/inclusao_pof.csv"], indicador="Peso da energia no orçamento (POF 2017-2018)")
    return {
        "pergunta": "Para quem a energia pesa mais?",
        "referencia": "POF 2017-2018 (valores de 15/01/2018)",
        "classes": [{"codigo": cod, "rotulo": rot, "inferior": lo, "superior": hi} for cod, (i, rot, lo, hi) in fi.CLASSES_POF.items()],
        "medidas": [{"id": m_, "rotulo": ROTULO_MEDIDA_POF[m_]} for m_ in MEDIDAS_POF],
        "formato_microdados": ("cada medida é [valor, coeficiente de variação em %, estado]; estado: publicado, cautela (CV de 15% a 30%), "
                               "suprimido (CV acima de 30%, valor nulo), sem_erro_padrao (mediana), zero_na_amostra (nenhuma família da amostra; não prova zero na população), ausente. As UF trazem só as medidas de "
                               "medidas_uf; todas as medidas e os erros-padrão estão em inclusao_pof.csv"),
        "medidas_uf": list(MEDIDAS_POF_UF),
        "limiares_pct": list(LIMIARES),
        "regra_precisao": {"cautela_cv_pct": CV_CAUTELA, "suprime_cv_pct": CV_SUPRIME},
        "linhas": linhas,
        "conferencia": reconc,
        "diagnostico_microdados": diag,
        "evidencias": evidencias,
        # Brasil por classe: a média das participações na renda ao lado da mediana e do mesmo cálculo sem
        # as famílias com despesa de energia acima da renda (sensibilidade, não correção)
        "sensibilidade_media_razoes_renda": sens,
        "proveniencia": {"sidra": prov_s, "microdados": prov_m},
    }


# ================================================================ P062: acesso e sistemas isolados

def serie_anual_lpt(mensal, progs):
    """Domicílios atendidos por ano e programa a partir de {(uf, programa, 'AAAA-MM'): n}.
    Programa sem nenhuma linha no ano = None; programa com linhas que somam zero = 0.0 (o
    arquivo do MME traz linhas de "Recurso da Distribuidora" com qtddomicilios = 0 em 2015,
    2017 e 2018; o defeito era publicá-las como ausência). O último ano é parcial."""
    anual = collections.defaultdict(dict)
    for (uf, prog, mes), v in mensal.items():
        anual[mes[:4]][prog] = anual[mes[:4]].get(prog, 0.0) + v
    ano_ult = max(anual) if anual else None
    return [{"ano": a, **{p: anual[a].get(p) for p in progs}, "total": sum(anual[a].values()), "parcial": a == ano_ult}
            for a in sorted(anual)]


def _bloco_luz_para_todos(con):
    """Atendimentos do Luz para Todos (domicílios ligados) por ano, programa, UF e
    município, e os recursos por contrato, a partir do conjunto aberto do MME."""
    obs = _vigentes(con, DS_LPT)
    if not obs:
        return None
    progs = list(fl.PROGRAMA_ROTULO)
    mensal = collections.defaultdict(float)       # (uf, prog, mes)
    municipal = collections.defaultdict(float)    # (uf, nn, prog, ano)
    contratos = collections.defaultdict(dict)     # ch → {campo: valor}
    for serie, pts in obs.items():
        if serie.startswith("M|"):
            _, uf, nn, prog = serie.split("|", 3)
            for ano, v in pts.items():
                municipal[(uf, nn, prog, ano)] += v
        elif serie.startswith("R|"):
            ch, campo = serie.rsplit(".", 1)
            contratos[ch][campo] = pts.get("total")
        else:
            uf, prog = serie.split(".", 1)
            for mes, v in pts.items():
                mensal[(uf, prog, mes)] += v
    ultimo_mes = max(m for _, _, m in mensal)
    ano_ult = ultimo_mes[:4]
    serie = serie_anual_lpt(mensal, progs)
    por_uf = collections.defaultdict(lambda: collections.defaultdict(float))
    for (uf, prog, mes), v in mensal.items():
        por_uf[uf][prog] += v
        por_uf[uf]["total"] += v
        if mes[:4] >= "2023":
            por_uf[uf]["desde_2023"] += v
    # (as chaves só existem quando há linha; zero somado é zero publicado, chave ausente é null)
    # municípios com código IBGE pelo nome exato na UF (lista do Cadastro Único)
    regs_mds = base.registros_como_estavam_em(con, DS_MDS)
    idx = fl.indice_municipios([(cod, r.get("municipio"), r.get("uf")) for cod, r in regs_mds.items()
                                if re.fullmatch(r"\d{6}", cod) and r.get("municipio") and r.get("uf")])
    nomes = {ch: r.get("nome") for ch, r in base.registros_como_estavam_em(con, DS_LPT).items() if "|" in ch and not ch.startswith("R|")}
    mun_tot = collections.defaultdict(lambda: collections.defaultdict(float))
    for (uf, nn, prog, ano), v in municipal.items():
        mun_tot[(uf, nn)][prog] += v
        mun_tot[(uf, nn)]["total"] += v
        if ano >= "2023":
            mun_tot[(uf, nn)]["desde_2023"] += v
    cod_de = lambda uf, nn: idx.get((uf, nn.replace(" ", "")))  # noqa: E731  (nn já normalizado)
    sem_codigo = [(k, t["total"]) for k, t in mun_tot.items() if cod_de(*k) is None]
    mun_linhas = []
    for (uf, nn, prog, ano), v in sorted(municipal.items()):
        mun_linhas.append([cod_de(uf, nn), nomes.get(f"{uf}|{nn}"), uf, prog, ano, v])
    base.escreve_csv("inclusao_luz_para_todos_municipios.csv",
                     ["cod_ibge6", "municipio", "uf", "programa", "ano", "domicilios"], mun_linhas)
    base.escreve_csv("inclusao_luz_para_todos_mensal.csv", ["uf", "programa", "mes", "domicilios"],
                     [[uf, prog, mes, v] for (uf, prog, mes), v in sorted(mensal.items(), key=lambda x: (x[0][2], x[0][0], x[0][1]))])
    # recursos por UF
    rec_uf = collections.defaultdict(lambda: collections.defaultdict(float))
    n_contr = collections.Counter()
    csv_r = []
    regs_lpt = base.registros_como_estavam_em(con, DS_LPT)
    for ch, vals in contratos.items():
        _, uf, contrato, ordem = ch.split("|", 3)
        n_contr[uf] += 1
        for campo, x in vals.items():
            if x is None:
                continue
            fonte_, sit = fl.VALORES_RECURSOS[campo]
            rec_uf[uf][f"{fonte_}_{sit}_reais"] += x
        rg = regs_lpt.get(ch, {})
        csv_r.append([uf, contrato, rg.get("inicio"), rg.get("fim"), *[vals.get(c) for c in fl.VALORES_RECURSOS]])
    base.escreve_csv("inclusao_luz_para_todos_recursos.csv",
                     ["uf", "contrato", "primeira_liberacao", "ultima_liberacao", *fl.VALORES_RECURSOS], sorted(csv_r, key=lambda x: (x[0], x[1])))
    campos_r = sorted({k for d in rec_uf.values() for k in d})
    recursos = [{"uf": uf, "nome": UF_NOME.get(uf), "contratos": n_contr[uf], **{k: _r(rec_uf[uf].get(k), 2) for k in campos_r}}
                for uf in sorted(rec_uf, key=lambda u: -sum(v for k, v in rec_uf[u].items() if k.endswith("_pago_reais")))]
    total = sum(v for v in mensal.values())
    soma_uf = sum(t["total"] for t in por_uf.values())
    soma_mun = sum(t["total"] for t in mun_tot.values())
    diag = {}
    for ch, campos in base.registros_como_estavam_em(con, DS_CONTROLE).items():
        if ch.startswith("lpt|domicilios") and ch.endswith(f"|{LEITOR_LPT}") and campos.get("diagnostico"):
            diag = json.loads(campos["diagnostico"])
    v_dom = next((v for v in base.vintages_do_dataset(con, DS_LPT) if v["recurso"].startswith("domicilios")), None)
    v_dom = base.ultima_vintage(con, DS_LPT, v_dom["recurso"]) if v_dom else None
    f_lpt = ev.fonte_de_vintage("MME", "Luz para Todos (dados abertos do MME)", fl.URL_DATASET, v_dom)
    testes = [
        ev.teste("soma por UF igual ao total nacional", "aprovado" if abs(soma_uf - total) < 0.5 else "reprovado",
                 f"{numero_exibido(soma_uf)} somando as UF; {numero_exibido(total)} no total"),
        ev.teste("soma por município igual ao total nacional", "aprovado" if abs(soma_mun - total) < 0.5 else "reprovado",
                 f"{numero_exibido(soma_mun)} somando os municípios"),
        ev.teste("linhas do arquivo com quantidade, data, estado ou programa inválidos",
                 "aprovado" if diag and diag.get("linhas") == diag.get("linhas_usadas") else "ressalva",
                 f"{numero_exibido(diag.get('linhas'))} linhas; {numero_exibido(diag.get('linhas_usadas'))} usadas" if diag else "diagnóstico ausente"),
        ev.teste("municípios com código IBGE pelo nome exato na UF", "aprovado" if not sem_codigo else "ressalva",
                 f"{len(mun_tot) - len(sem_codigo)} de {len(mun_tot)} nomes com código; {len(sem_codigo)} sem correspondência exata "
                 f"({numero_exibido(sum(x for _, x in sem_codigo))} domicílios, que ficam na UF e no total)"),
    ]
    ev_total = _evidencia(
        valor=total, unidade="domicílios atendidos", periodo={"inicio": min(m for _, _, m in mensal), "fim": ultimo_mes},
        entidade="Brasil", universo="atendimentos homologados do Luz para Todos e com recurso da distribuidora no arquivo do MME",
        fonte=f_lpt, formula="Σ qtddomicilios de todas as linhas válidas de domicilios_atendidos.csv",
        chaves_origem=["domicilios_atendidos.csv, todas as linhas"], casas=0,
        cobertura=f"{len(por_uf)} UF; {len(mun_tot)} municípios; mês de atendimento de {c.mes_br(min(m for _, _, m in mensal))} a {c.mes_br(ultimo_mes)}",
        testes=testes, revisoes=c.snapshot_de(con, DS_LPT).get("revisoes"),
        download=["/energia/series/inclusao_luz_para_todos_mensal.csv", "/energia/series/inclusao_luz_para_todos_municipios.csv"],
        indicador="Domicílios atendidos pelo Luz para Todos")
    snap = c.snapshot_de(con, DS_LPT)
    prov = c.proveniencia(
        indicador="Domicílios atendidos pelo Luz para Todos e recursos por contrato", natureza="OBSERVADO",
        fonte=_fonte("MME", "Luz para Todos", "domicilios_atendidos.csv; recursos_aplicados.csv", fl.URL_DATASET,
                     (v_dom or {}).get("url"), fl.LICENCA),
        unidade="domicílios; R$ correntes", frequencia="atualização do portal (sem calendário declarado)",
        periodo={"inicio": min(m for _, _, m in mensal), "fim": ultimo_mes},
        cobertura={"inicio": min(m for _, _, m in mensal), "fim": ultimo_mes}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["soma de qtddomicilios por UF, programa e mês de atendimento", "soma por município e ano",
                        "código IBGE do município pelo nome exato na UF (lista do Cadastro Único)",
                        "recursos somados por UF e fonte (CDE, RGR, Caixa ou outras, agente executor)"],
        limitacoes=["Domicílio atendido é ligação nova registrada pelo programa; não é pessoa, não é unidade consumidora com benefício e não mede a qualidade do fornecimento depois da ligação.",
                    f"O ano de {ano_ult} está incompleto (último mês de atendimento no arquivo: {c.mes_br(ultimo_mes)}).",
                    "Atendimentos entram pela data do atendimento; a homologação pode vir meses depois e o arquivo muda quando novas homologações chegam.",
                    "O dicionário do MME descreve vlrpagocaixa como valor pago da RGR e vlrpago como participação do agente executor; o módulo segue a correspondência com os campos contratados.",
                    "Linha removida numa atualização da fonte não é apagada do silver: vale a última captura de cada município, programa e período."],
        download="/energia/series/inclusao_luz_para_todos_mensal.csv")
    return {
        "ultimo_mes": ultimo_mes, "ano_parcial": ano_ult,
        "programas": [{"id": p, "rotulo": fl.PROGRAMA_ROTULO[p]} for p in progs],
        "serie_anual": serie,
        "por_uf": [{"uf": uf, "nome": UF_NOME.get(uf), "regiao": REGIAO_DA_UF.get(uf), "total": t["total"],
                    "desde_2023": t.get("desde_2023"), **{p: t.get(p) for p in progs}}
                   for uf, t in sorted(por_uf.items(), key=lambda x: -x[1]["total"])],
        "municipios_mais_atendidos_desde_2023": [
            {"cod": cod_de(*k), "municipio": nomes.get(f"{k[0]}|{k[1]}"), "uf": k[0], "domicilios": t["desde_2023"]}
            for k, t in sorted(mun_tot.items(), key=lambda x: -x[1].get("desde_2023", 0))[:30] if t.get("desde_2023")],
        "municipios": {"total": len(mun_tot), "com_codigo_ibge": len(mun_tot) - len(sem_codigo), "sem_codigo_ibge": len(sem_codigo),
                       "domicilios_sem_codigo": sum(x for _, x in sem_codigo),
                       "maiores_sem_codigo": [{"uf": k[0], "municipio": nomes.get(f"{k[0]}|{k[1]}"), "domicilios": x}
                                              for k, x in sorted(sem_codigo, key=lambda z: -z[1])[:10]]},
        "recursos_por_uf": recursos,
        "diagnostico": diag,
        "evidencia_total": ev_total,
        "proveniencia": prov,
    }


def soma_populacao(locais):
    """{populacao, localidades_sem_populacao}: soma só das populações informadas; None
    quando nenhuma localidade do grupo informa população (ausência não vira zero)."""
    vals = [l["populacao"] for l in locais if l.get("populacao") is not None]
    return {"populacao": sum(vals) if vals else None, "localidades_sem_populacao": len(locais) - len(vals)}


def _conferencia_caderno(con, regs, locs):
    """Exportação do PASI (ciclo 2025) contra os totais escritos no caderno em PDF do
    mesmo ciclo: localidades exatas; população com a precisão do texto (milésimo de
    milhão, ou seja, ±500 pessoas)."""
    cad = regs.get("caderno_2025") or {}
    v = base.ultima_vintage(con, DS_PASI, "caderno_planejamento_sisol_ciclo_2025.pdf")
    if not cad or not v:
        return None
    num = lambda k, f=float: f(cad[k]) if cad.get(k) not in (None, "") else None  # noqa: E731
    n_pdf, pop_pdf = num("localidades", lambda x: int(float(x))), num("populacao_milhoes")
    n_ant_pdf = num("localidades_ciclo_anterior", lambda x: int(float(x)))
    l25, l24 = locs.get("2025", []), locs.get("2024", [])
    pop_xlsx = sum(l["populacao"] or 0 for l in l25)
    ok_n = n_pdf is not None and n_pdf == len(l25)
    ok_ant = n_ant_pdf is None or not l24 or n_ant_pdf == len(l24)
    ok_pop = pop_pdf is not None and abs(pop_xlsx / 1e6 - pop_pdf) <= 0.0005 + 1e-9
    return {"documento": "EPE, Planejamento do Atendimento aos Sistemas Isolados, Ciclo 2025 (caderno em PDF)",
            "url": fe.URL_CADERNO_2025, "arquivo": v.get("arquivo"), "sha256": v.get("sha256"),
            "capturado_em": v.get("capturado_em"),
            "pagina": num("pagina_localidades", lambda x: int(float(x))),
            "extracao": "pdftotext -layout; expressões regulares sobre o texto ('totaliza N ... (M localidades)' e o quadro TOTAL ... milhões de pessoas)",
            "localidades_pdf": n_pdf, "localidades_ciclo_anterior_pdf": n_ant_pdf, "populacao_milhoes_pdf": pop_pdf,
            "localidades_xlsx": len(l25), "localidades_ciclo_anterior_xlsx": len(l24) or None, "populacao_xlsx": pop_xlsx,
            "resultado": "aprovado" if ok_n and ok_pop and ok_ant else "reprovado",
            "tolerancia": "localidades: igualdade; população: 0,0005 milhão de pessoas (o caderno escreve três casas decimais)"}


def _evidencia_isolados(con, locais, ciclo, resumo, conf_pdf):
    """Ficha "Comprove este número" da população dos sistemas isolados no ciclo mais recente.
    O número vem da exportação XLSX do PASI (soma só das populações informadas, nunca zero
    no lugar da ausência); o caderno em PDF do mesmo ciclo é a reconciliação por outro
    produto da EPE, com a precisão que o texto do caderno permite."""
    v = base.ultima_vintage(con, DS_PASI, f"localizacao_ciclo_{ciclo}")
    if not v or not locais:
        return None
    agg = soma_populacao(locais)
    sem_pop = sorted(l["sigla"] for l in locais if l["populacao"] is None)
    por_uf = collections.defaultdict(float)
    for l in locais:
        if l["populacao"] is not None:
            por_uf[l["uf"]] += l["populacao"]
    testes = [
        ev.teste("soma das UF igual ao total do ciclo", "aprovado" if abs(sum(por_uf.values()) - (agg["populacao"] or 0)) < 0.5 else "reprovado",
                 f"{numero_exibido(sum(por_uf.values()))} pessoas somando {len(por_uf)} UF"),
        ev.teste("população ausente não vira zero", "aprovado",
                 f"{len(sem_pop)} localidades sem população ({', '.join(sem_pop) or 'nenhuma'}) ficam fora da soma e contadas à parte"),
    ]
    rec = None
    if conf_pdf:
        rec = ev.reconciliacao(
            f"{conf_pdf['documento']}, página {conf_pdf['pagina']} (sha256 {conf_pdf['sha256']}): o texto do caderno dá "
            f"{numero_exibido(conf_pdf['localidades_pdf'])} localidades e {str(conf_pdf['populacao_milhoes_pdf']).replace('.', ',')} milhões de pessoas; "
            f"a exportação dá {numero_exibido(conf_pdf['localidades_xlsx'])} localidades e {numero_exibido(conf_pdf['populacao_xlsx'])} pessoas. "
            f"Extração: {conf_pdf['extracao']}",
            conf_pdf["resultado"], conf_pdf["tolerancia"])
    c_ult = next((r for r in resumo if r["ciclo"] == ciclo), {})
    return _evidencia(
        valor=agg["populacao"], unidade="pessoas", periodo=ciclo, entidade="Brasil, sistemas isolados",
        universo=f"{len(locais)} localidades do ciclo {ciclo} do PASI ({len(locais) - len(sem_pop)} com população informada)",
        fonte=ev.fonte_de_vintage("EPE", "PASI: Localização Geográfica das localidades isoladas", fe.URL_DOWNLOADS, v),
        formula="Σ população informada pelas distribuidoras para cada localidade do ciclo (coluna População da exportação)",
        chaves_origem=[f"{v['recurso']}: {len(locais)} linhas (uma por localidade)"],
        exclusoes=[f"{s}: população não informada" for s in sem_pop],
        cobertura=f"{len(locais)} localidades em {len({l['uf'] for l in locais})} UF; "
                  f"{c_ult.get('sairam_da_lista', 0)} saíram da lista desde o ciclo anterior",
        tratamento_ausencia="Localidade sem população na fonte fica fora da soma e é contada à parte; o total nunca a trata como zero.",
        testes=testes, reconciliacao=rec, revisoes=c.snapshot_de(con, DS_PASI).get("revisoes"),
        download=["/energia/series/inclusao_sistemas_isolados.csv"], casas=0,
        indicador="População das localidades atendidas por sistemas isolados")


def domicilios_sem_energia(tot_mil, com_mil):
    """(valor, estado) dos domicílios sem energia, em mil: diferença de duas estimativas
    publicadas arredondadas em milhares. Diferença zero não prova zero: a verdadeira fica
    entre 0 e 1 mil, e o estado é 'menos_de_1_mil' (sem valor, nunca 0,0 mil)."""
    if tot_mil is None or com_mil is None:
        return None, "ausente"
    dif = tot_mil - com_mil
    if dif == 0:
        return None, "menos_de_1_mil"
    return dif, "calculado"


def _bloco_acesso(con, ctx):
    pn = _vigentes(con, DS_PNAD)
    if not pn:
        return None
    g = lambda serie, ano: (pn.get(serie) or {}).get(ano)  # noqa: E731
    anos = sorted({a for pts in pn.values() for a in pts})
    terrs = ["BR", *REGIOES, *UF_NOME]

    def linha(t, ano, sit):
        com = g(f"6737.{t}.{sit}.qualquer.pct", ano)
        cv_com = g(f"6737.{t}.{sit}.qualquer.cv_pct", ano)
        rede = g(f"6737.{t}.{sit}.rede_geral.pct", ano)
        cv_rede = g(f"6737.{t}.{sit}.rede_geral.cv_pct", ano)
        integ = g(f"6738.{t}.{sit}.rede_geral_integral.pct", ano)
        cv_int = g(f"6738.{t}.{sit}.rede_geral_integral.cv_pct", ano)
        tot = g(f"6731.{t}.{sit}.todos.domicilios_mil", ano)
        com_mil = g(f"6737.{t}.{sit}.qualquer.domicilios_mil", ano)
        if com is None and tot is None:
            return None
        sem, est_sem = domicilios_sem_energia(tot, com_mil)
        return {"territorio": t, "ano": ano, "situacao": sit,
                "pct_com_energia": com, "cv_pct_com_energia": cv_com,
                "pct_sem_energia": _r(100 - com, 1) if com is not None else None,
                # CV publicado com uma casa: 0,0 quer dizer menor que 0,05% (sem erro-padrão derivável)
                "pct_rede_geral": rede, "cv_pct_rede_geral": cv_rede,
                "pct_integral_entre_rede": integ, "cv_pct_integral": cv_int,
                "domicilios_mil": tot, "domicilios_com_energia_mil": com_mil,
                "domicilios_sem_energia_mil": sem, "domicilios_sem_energia_estado": est_sem}
    # gold: série completa para Brasil e regiões; UF no primeiro e no último ano (série inteira no CSV)
    serie = [l for t in terrs for a in anos for l in [linha(t, a, "total")] if l
             and (t == "BR" or t.startswith("RG-") or a in (anos[0], anos[-1]))]
    ult = anos[-1]
    # urbana e rural no último ano: Brasil e regiões nas duas situações; UF só rural (onde está a falta de acesso;
    # a situação urbana das UF fica no CSV)
    situacao = [l for t in terrs for s in ("urbana", "rural") for l in [linha(t, ult, s)] if l
                and (t == "BR" or t.startswith("RG-") or s == "rural")]
    base.escreve_csv("inclusao_acesso_pnad.csv",
                     ["territorio", "ano", "situacao", "pct_com_energia", "cv_pct_com_energia", "pct_sem_energia", "pct_rede_geral",
                      "cv_pct_rede_geral", "pct_integral_entre_rede", "cv_pct_integral", "domicilios_mil",
                      "domicilios_com_energia_mil", "domicilios_sem_energia_mil", "domicilios_sem_energia_estado"],
                     [[l["territorio"], l["ano"], l["situacao"], l["pct_com_energia"], l["cv_pct_com_energia"], l["pct_sem_energia"], l["pct_rede_geral"],
                       l["cv_pct_rede_geral"], l["pct_integral_entre_rede"], l["cv_pct_integral"], l["domicilios_mil"],
                       l["domicilios_com_energia_mil"], l["domicilios_sem_energia_mil"], l["domicilios_sem_energia_estado"]]
                      for t in terrs for a in anos for s in ("total", "urbana", "rural") for l in [linha(t, a, s)] if l])
    snap_p = c.snapshot_de(con, DS_PNAD)
    lim_p = [
        "Pesquisa amostral: o IBGE publica coeficiente de variação para cada estimativa; o número de domicílios sem energia é a diferença entre duas estimativas e não tem erro-padrão publicado.",
        "As duas contagens vêm arredondadas em milhares: diferença zero quer dizer menos de 1 mil domicílios sem energia, não zero (estado menos_de_1_mil); percentual com energia de 100,0 quer dizer pelo menos 99,95%.",
        "Domicílio com energia (de qualquer fonte, inclusive gerador ou painel próprio) e fornecimento da rede em tempo integral são dimensões distintas: a segunda mede interrupção declarada, não qualidade técnica.",
        "O percentual em tempo integral é sobre os domicílios ligados à rede geral, não sobre todos os domicílios.",
        "A carga do SIN não mede acesso: sistemas isolados e domicílios sem ligação ficam fora dela.",
    ]
    prov_p = c.proveniencia(
        indicador="Domicílios com energia elétrica e fornecimento em tempo integral (PNAD Contínua)", natureza="ESTIMADO",
        fonte=_fonte("IBGE", "PNAD Contínua anual (tabelas 6737, 6738 e 6731)", "valores da API SIDRA",
                     "https://sidra.ibge.gov.br/tabela/6737", fi.URL_PNAD_6737, LIC_IBGE),
        unidade="% e mil domicílios", frequencia="anual", periodo={"inicio": anos[0], "fim": ult},
        cobertura={"inicio": anos[0], "fim": ult}, capturado_em=c.ultima_captura(snap_p), snapshot=snap_p,
        publicacao_informada=False, limitacoes=lim_p, download="/energia/series/inclusao_acesso_pnad.csv",
        transformacoes=["percentuais, coeficientes de variação e contagens como publicados; natureza ESTIMADO porque são estimativas "
                        "amostrais do IBGE (estimado pela fonte)",
                        "domicílios sem energia = total − com energia (diferença calculada de duas estimativas); diferença zero entre "
                        "valores arredondados em milhares é publicada como 'menos de 1 mil', sem valor"])
    br_ult = next((l for l in serie if l["territorio"] == "BR" and l["ano"] == ult), None)
    v6737, v6731 = base.ultima_vintage(con, DS_PNAD, "tabela_6737"), base.ultima_vintage(con, DS_PNAD, "tabela_6731")
    f_p = ev.fonte_de_vintage("IBGE", "PNAD Contínua anual, tabelas 6731 e 6737", fi.URL_PNAD_6737, v6737)
    f_p["arquivos"] = [ev.arquivo_de_vintage(v) for v in (v6737, v6731) if v]
    ev_sem = None
    if br_ult and br_ult["domicilios_sem_energia_mil"] is not None:
        tot, com, pct = br_ult["domicilios_mil"], br_ult["domicilios_com_energia_mil"], br_ult["pct_com_energia"]
        pct_calc = 100 * com / tot
        ev_sem = _evidencia(
            valor=br_ult["domicilios_sem_energia_mil"], unidade="mil domicílios", periodo=ult, entidade="Brasil",
            universo="domicílios particulares permanentes (PNAD Contínua, visita anual)", fonte=f_p,
            formula="domicílios (tabela 6731, total) − domicílios com energia elétrica de qualquer fonte (tabela 6737)",
            chaves_origem=[f"6731: variável 162, situação Total, ano {ult}", f"6737: variável 5157, fonte = rede geral ou fonte alternativa, situação Total, ano {ult}"],
            cobertura="Brasil; estimativa amostral", casas=0,
            tratamento_ausencia="Diferença entre duas estimativas publicadas em mil domicílios; sem erro-padrão publicado para a diferença.",
            testes=[ev.teste("domicílios com energia não excedem o total", "aprovado" if com <= tot else "reprovado",
                             f"{numero_exibido(com)} mil com energia; {numero_exibido(tot)} mil no total"),
                    ev.teste("percentual publicado coerente com as contagens publicadas",
                             "aprovado" if pct is not None and abs(pct_calc - pct) <= 0.06 else "reprovado",
                             f"100 × {numero_exibido(com)} ÷ {numero_exibido(tot)} = {numero_exibido(pct_calc, 2)}%; publicado {numero_exibido(pct, 1)}% (tolerância 0,06 ponto percentual: arredondamento a uma casa e a mil unidades)")],
            revisoes="Reponderações do IBGE não são reconstituídas: vale a tabela vigente no SIDRA na data da captura.",
            download=["/energia/series/inclusao_acesso_pnad.csv"], indicador="Domicílios sem energia elétrica")
    # sistemas isolados (PASI)
    regs = base.registros_como_estavam_em(con, DS_PASI)
    obs = _vigentes(con, DS_PASI)
    locs = collections.defaultdict(list)
    for ch, campos in regs.items():
        if "|" not in ch:
            continue
        ciclo, sig = ch.split("|", 1)
        pop = (obs.get(f"{sig}.populacao") or {}).get(ciclo)
        lat = (obs.get(f"{sig}.latitude") or {}).get(ciclo)
        lon = (obs.get(f"{sig}.longitude") or {}).get(ciclo)
        locs[ciclo].append({"sigla": sig, "nome": campos.get("nome"), "uf": campos.get("uf"), "municipio": campos.get("municipio"),
                            "distribuidora": campos.get("distribuidora"), "populacao": pop,
                            "previsao_interligacao": campos.get("previsao_interligacao"),
                            "previsao_interconexao": campos.get("previsao_interconexao"),
                            "programa": campos.get("programa"), "latitude": _r(lat, 4), "longitude": _r(lon, 4)})
    ciclos = sorted(locs)
    isolados = None
    if ciclos:
        ultc = ciclos[-1]
        resumo = []
        for ci in ciclos:
            ls = locs[ci]
            resumo.append({"ciclo": ci, "localidades": len(ls), **soma_populacao(ls),
                           "com_previsao_interligacao": sum(1 for l in ls if l["previsao_interligacao"]),
                           "programas": dict(collections.Counter(l["programa"] or "não informado" for l in ls))})
        for i in range(1, len(ciclos)):
            a, b = {l["sigla"] for l in locs[ciclos[i - 1]]}, {l["sigla"] for l in locs[ciclos[i]]}
            resumo[i]["sairam_da_lista"] = len(a - b)
            resumo[i]["entraram_na_lista"] = len(b - a)
        # população ausente na fonte não vira zero: a soma usa só os valores informados e vem com a
        # contagem de localidades sem população; nenhuma informada = populacao null
        grupos_uf, grupos_dist = collections.defaultdict(list), collections.defaultdict(list)
        for l in locs[ultc]:
            grupos_uf[l["uf"]].append(l)
            grupos_dist[l["distribuidora"]].append(l)
        por_uf = {uf: {"localidades": len(ls), **soma_populacao(ls)} for uf, ls in grupos_uf.items()}
        por_dist = {d: {"localidades": len(ls), **soma_populacao(ls)} for d, ls in grupos_dist.items()}
        base.escreve_csv("inclusao_sistemas_isolados.csv",
                         ["ciclo", "sigla", "nome", "uf", "municipio", "distribuidora", "populacao", "previsao_interligacao",
                          "previsao_interconexao", "programa", "latitude", "longitude"],
                         [[ci, l["sigla"], l["nome"], l["uf"], l["municipio"], l["distribuidora"], l["populacao"],
                           l["previsao_interligacao"], l["previsao_interconexao"], l["programa"], l["latitude"], l["longitude"]]
                          for ci in ciclos for l in sorted(locs[ci], key=lambda x: x["sigla"])])
        base.escreve_gold("inclusao_sistemas_isolados_pontos.json",
                          {"ciclo": ultc, "gerado_em": base.agora_utc(), "fonte": fe.URL_DOWNLOADS,
                           "campos": ["sigla", "nome", "uf", "municipio", "distribuidora", "populacao", "previsao_interligacao",
                                      "programa", "latitude", "longitude"],
                           "localidades": [[l["sigla"], l["nome"], l["uf"], l["municipio"], l["distribuidora"], l["populacao"],
                                            l["previsao_interligacao"], l["programa"], l["latitude"], l["longitude"]]
                                           for l in sorted(locs[ultc], key=lambda x: x["sigla"])]},
                          destino=base.SERIES)
        snap_i = c.snapshot_de(con, DS_PASI)
        prov_i = c.proveniencia(
            indicador="Localidades e população dos sistemas isolados (PASI)", natureza="OBSERVADO",
            fonte=_fonte("EPE", "PASI: Portal de Acompanhamento e Informações dos Sistemas Isolados",
                         "Downloads > Localização Geográfica (XLSX por ciclo)", fe.URL_DOWNLOADS, fe.URL_LOCALIZACAO.format(cod="<ciclo>"), LIC_EPE),
            unidade="localidades; pessoas", frequencia="anual (ciclo de planejamento)", periodo={"inicio": ciclos[0], "fim": ultc},
            cobertura={"inicio": ciclos[0], "fim": ultc}, capturado_em=c.ultima_captura(snap_i), snapshot=snap_i,
            publicacao_informada=False,
            limitacoes=["População informada pelas distribuidoras no planejamento; não é contagem censitária.",
                        "Sair da lista de um ciclo para o seguinte costuma indicar interligação ao SIN, mas o PASI não informa o motivo em cada caso.",
                        "Localidade isolada tem energia (em geral térmica a óleo diesel); isolamento não é falta de acesso, é acesso fora do SIN com custo subsidiado pela CCC."],
            download="/energia/series/inclusao_sistemas_isolados.csv")
        conf_pdf = _conferencia_caderno(con, regs, locs)
        isolados = {"ciclo": ultc, "ciclos": resumo,
                    "por_uf": [{"uf": uf, "nome": UF_NOME.get(uf), **v} for uf, v in sorted(por_uf.items(), key=lambda x: -(x[1]["populacao"] or 0))],
                    "por_distribuidora": [{"distribuidora": d, **v} for d, v in sorted(por_dist.items(), key=lambda x: -(x[1]["populacao"] or 0))],
                    # gold: as 25 mais populosas; todas, com coordenadas, no JSON sob demanda e no CSV
                    "localidades_mais_populosas": sorted(locs[ultc], key=lambda x: -(x["populacao"] or 0))[:25],
                    "pontos_json": "/energia/series/inclusao_sistemas_isolados_pontos.json",
                    "conferencia_pdf": conf_pdf,
                    "evidencia_populacao": _evidencia_isolados(con, locs[ultc], ultc, resumo, conf_pdf),
                    "proveniencia": prov_i}
    custeio = ctx.get("custeio") or {}
    lpt = _bloco_luz_para_todos(con)
    universalizacao = {
        "luz_para_todos": lpt,
        "luz_para_todos_cde": [{"ano": l["ano"], "valor_reais": l["luz_para_todos_reais"]} for l in custeio.get("linhas", [])],
        "ccc_cde": [{"ano": l["ano"], "valor_reais": l["ccc_sistemas_isolados_reais"]} for l in custeio.get("linhas", [])],
        "ano_corrente_orcado": custeio.get("ano_corrente"),
        "limitacao": ("Os atendimentos do Luz para Todos vêm do conjunto aberto do MME (domicílios atendidos por município e mês); os "
                      "painéis Power BI da página de informações analíticas do MME não têm arquivo para download e não foram usados. "
                      "O arquivo não traz uma categoria chamada Mais Luz para a Amazônia: os atendimentos em regiões remotas da "
                      "Amazônia Legal aparecem como 'LPT - Regiões Remotas da Amazônia Legal'. Os valores anuais da CDE para o "
                      "programa (custeio) e os recursos por contrato do MME são grandezas diferentes e não se somam."),
        "fontes_tentadas": ["https://www.gov.br/mme/pt-br/assuntos/observatorio-de-minas-e-energia/energia-eletrica/outras-informacoes-analiticas (4 painéis Power BI, sem download)",
                            "https://dadosabertos.aneel.gov.br (busca por 'universalização': nenhum conjunto)",
                            "https://dados.ons.org.br (busca por 'isolados': nenhum conjunto)",
                            fl.URL_DATASET + " (integrado)"],
    }
    prov_acesso = {"pnad": prov_p, **({"isolados": isolados["proveniencia"]} if isolados else {}),
                   **({"luz_para_todos": lpt["proveniencia"]} if lpt else {})}
    return {
        "pergunta": "Quem ainda precisa de acesso adequado?",
        "ano_referencia": ult,
        "pnad_serie": serie, "pnad_situacao": situacao,
        "evidencia_sem_energia": ev_sem,
        "sistemas_isolados": isolados,
        "universalizacao": universalizacao,
        "proveniencia": prov_acesso,
    }
