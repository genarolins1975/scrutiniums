"""Módulo Rede (detalhe): circulação, balanço e exterior, restrições e programado versus
verificado (painéis P028 a P031 da especificação; achados A05 e A06).

Gold: public/energia/gold/rede_detalhe.json e CSVs public/energia/series/rede_*.csv.
Complementa, sem substituir, a gold de operação rede.json (gold/rede.py), que continua
lendo o silver principal.

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/rede.md), todas
do portal de dados abertos do ONS (CKAN e arquivos no S3 do ONS), família de silver
`ons_rede`:
- Intercâmbios Entre Subsistemas: releitura dos arquivos originais, linha a linha, para
  conferir orientação, sinal e o valor programado (o silver principal guarda só a soma
  por fronteira);
- Intercâmbio do SIN com Outros Países (Argentina, Uruguai e Paraguai pela conversora de
  Acaray), verificado e programado;
- Balanço de Energia nos Subsistemas: releitura dos originais para fechar o achado A05;
- Geração de Itaipu Binacional: contexto do exterior (a usina é geração, não intercâmbio);
- Indicador ATLS (atendimento aos limites sistêmicos): horas em que fluxos sistêmicos
  ficaram acima do limite estabelecido pelos estudos elétricos (painel P030);
- Interrupção de Carga: perturbações com corte de carga (painel P030);
- Programados dos Elementos de Fluxo Controlado (amostra de dias): conferência de qual
  programa o conjunto de intercâmbio publica (painel P031);
- dicionários de dados dos conjuntos e três documentos públicos do ONS (Submódulo 9.1
  dos Procedimentos de Rede, sumário executivo do PEL 2019/2020 e RT-ONS DPL 0131/2023),
  com cada trecho citado conferido no arquivo baixado (achado A06).
O PLD horário da CCEE é lido do silver principal (só leitura), na mesma hora do fluxo.

Por que não há percentual de utilização da rede: os limites operativos de intercâmbio
com vigência não estão publicados como conjunto estruturado. O dicionário do próprio
conjunto de intercâmbio remete ao "Relatório Quadrimestral de Limites de Intercâmbio
para o Modelo Newave", disponível só no SINtegre (portal autenticado), e os documentos
públicos trazem limites que dependem de configuração da rede, patamar de carga e
cenário. Capacidade nominal de linha não é limite de transferência entre regiões; o
painel P030 responde outra pergunta, com o que o ONS publica: horas de violação dos
limites sistêmicos (ATLS) e interrupções de carga.
"""
import csv
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan, ons_rede  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "rede_detalhe.json"
FAMILIA = "ons_rede"
ANO_INICIAL = 2021  # início do PLD horário e do silver principal; anos anteriores existem na fonte

DS_IN = "ons_rede_intercambio_nacional"
DS_II = "ons_rede_intercambio_internacional"
DS_BAL = "ons_rede_balanco"
DS_ITA = "ons_rede_itaipu"
DS_ATLS = "ons_rede_atls"
DS_IC = "ons_rede_interrupcao_carga"
DS_PDO = "ons_rede_pdo_conversoras"
DS_DIC = "ons_rede_dicionarios"
DS_DOC = "ons_rede_documentos"
DS_CONTROLE = "ons_rede_controle"

# silver principal (só leitura)
DS_PLD = "ccee_pld_horario"
DS_INT_PRINCIPAL = "intercambio_nacional_ho"
DS_BAL_PRINCIPAL = "balanco_energia_subsistema_ho"

S3 = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset"
CONJUNTOS = {
    DS_IN: {"pacote": "intercambio-nacional", "s3": "intercambio_nacional_ho", "prefixo": "INTERCAMBIO_NACIONAL_",
            "titulo": "Intercâmbios Entre Subsistemas", "dic": "DicionarioDados_Intercambio_Nacional"},
    DS_II: {"pacote": "intercambio-internacional", "s3": "intercambio_internacional_ho", "prefixo": "INTERCAMBIO_INTERNACIONAL_",
            "titulo": "Intercâmbio do SIN com Outros Países", "dic": "DicionarioDados_Intercambio_Internacional"},
    DS_BAL: {"pacote": "balanco-energia-subsistema", "s3": "balanco_energia_subsistema_ho", "prefixo": "BALANCO_ENERGIA_SUBSISTEMA_",
             "titulo": "Balanço de Energia nos Subsistemas", "dic": "DicionarioDados_Balanco_Energia_Subsistema"},
    DS_ITA: {"pacote": "geracao_itaipu", "s3": "geracao_itaipu", "arquivo": "GERACAO_ITAIPU",
             "titulo": "Geração de Itaipu Binacional: base horária", "dic": "DicionarioDados_Geracao_Itaipu_Binacional"},
    DS_ATLS: {"pacote": "ind_confiarb_atls", "s3": "ind_confiarb_atls", "arquivo": "IND_CONFIARB_ATLS",
              "titulo": "Indicadores de confiabilidade da rede básica: ATLS (atendimento aos limites sistêmicos)",
              "dic": "DicionarioDados_Ind_Confiabilidade_RB_ATLS"},
    DS_IC: {"pacote": "interrupcao_carga", "s3": "interrupcao_carga", "arquivo": "INTERRUPCAO_CARGA",
            "titulo": "Interrupção de Carga", "dic": "DicionarioDados_InterrupcaoDadosl"},
    DS_PDO: {"pacote": "programacao_fluxo_controlado", "s3": "programacao_fluxo_controlado",
             "prefixo": "PROGRAMACAO_FLUXO_CONTROLADO_", "titulo": "Dados dos Programados dos Elementos de Fluxo Controlado",
             "dic": "DicionarioDados_Programacao_Fluxo_Controlado"},
}


def url_pacote(ds):
    return f"https://dados.ons.org.br/dataset/{CONJUNTOS[ds]['pacote']}"


# Trechos dos dicionários citados na gold: cada um só é publicado se conferido no PDF baixado.
TRECHOS_DICIONARIO = {
    DS_IN: [
        ("limites_sintegre", "A relação de linhas de transmissão de fronteira pode ser encontrada no produto"),
        ("limites_relatorio", "Relatório Quadrimestral de Limites de Intercâmbio para o Modelo Newave"),
        ("limites_portal", "disponível Portal SINtegre - ONS"),
        ("exterior_sul", "O intercâmbio do subsistema Sul com os países vizinhos não consta nesta consulta e pode ser obtido nos dados de intercâmbio do SIN."),
    ],
    DS_II: [
        ("sinal", "Dados positivos indicam exportação de energia do Brasil para outros países; dados negativos indicam importação de energia do Brasil de outros países."),
        ("conversoras", "O intercâmbio com o Paraguai pode ser realizado pela conversora de Acaray."),
    ],
    DS_BAL: [
        ("intercambio", "Valor verificado do intercâmbio"),
        ("intercambio_liquido", "líquido, em MWmed"),
    ],
    DS_ITA: [
        ("brasil", "Potência ativa média horária destinada ao Brasil"),
        ("remocao_paraguai", "Potência ativa média horária destinada ao Paraguai, em MWmed"),
    ],
    DS_ATLS: [
        ("unidade", "Valor do indicador ATLS, em %"),
        ("horas", "Tempo em que o fluxo permaneceu acima"),
        ("horas_limite", "do limite estabelecido no período, em horas"),
    ],
    DS_IC: [
        ("criterio", "quando maiores que 100 MW por 10 minutos ou mais"),
    ],
    DS_PDO: [
        ("unidade", "Valor da Carga, em MW"),
    ],
}

LICENCA_DOC_ONS = ("Documento público do ONS no portal ons.org.br (direitos reservados ao ONS); usado só por citação "
                   "de trechos conferidos, sem redistribuição do arquivo")

# Documentos públicos do ONS lidos para o achado A06 e para as definições dos fluxos do ATLS.
DOCUMENTOS = {
    "ons_submodulo_9_1": {
        "titulo": "Procedimentos de Rede, Submódulo 9.1: Indicadores de confiabilidade da Rede Básica (revisão 2020.12, vigência 01/01/2021)",
        "url": ("https://proxyportais.ons.org.br/ons.portalempregado.proxy/garapi/api/processo/retornarpdf?"
                "url=%2Fsites%2Fsoumaisons%2Fportalgar%2Fecmpdf%2FSubm%C3%B3dulo+9.1-IN_2020.12.pdf"),
        "trechos": [
            ("atls_definicao", "É o percentual de tempo em que os fluxos, definidos nos documentos normativos da operação e "
                               "selecionados como relevantes para avaliação da segurança elétrica, operaram dentro das faixas "
                               "de segurança recomendadas pelos estudos elétricos específicos."),
            ("atls_10min", "Não são considerados intervalos de tempo de violação com duração inferior a 10 (dez) minutos."),
            ("atls_banda_morta", "uma banda morta de 50 MW ou 5% do limite da faixa, o que for maior"),
        ],
    },
    "ons_pel_2019_2020": {
        "titulo": "Plano da Operação Elétrica 2019/2020 (PEL 2018): sumário executivo",
        "url": "https://www.ons.org.br/AcervoDigitalDocumentosEPublicacoes/PEL2019-2020_Sumario_Executivo.pdf",
        "trechos": [
            ("GIPU", "Geração de Itaipu (GIPU)"),
            ("RSE", "Recebimento pelo Sudeste (RSE)"),
            ("RSUL", "Recebimento pela Região Sul (RSUL)"),
            ("RNE", "Recebimento da Região Nordeste (RNE)"),
            ("FNS", "Fluxo sentido Norte-Sul (FNS)"),
        ],
    },
    "ons_rt_dpl_0131_2023": {
        "titulo": "RT-ONS DPL 0131/2023: Análise dos limites de transferência de energia entre as regiões N/NE e SE/CO com o bypass de BCS (revisão 01, julho de 2023)",
        "url": ("https://www.ons.org.br/AcervoDigitalDocumentosEPublicacoes/RT-ONS%20DPL%200131-2023%20-%20Limites%20NNE%20e%20"
                "SECO%20com%20bypass%20BCS%20-%20Revis%C3%A3o%2001.pdf"),
        "trechos": [
            ("FNESE", "Fluxo da Interligação Nordeste-Sudeste/Centro-Oeste (FNESE)"),
            ("FNEN", "Interligação Nordeste-Norte (FNEN)"),
            ("EXP_NE", "limite da ExpNE seja respeitado"),
            ("limite_configuracao", "O limite do Fluxo da Interligação Nordeste-Sudeste/Centro-Oeste (FNESE) é de 9.500 MW para a configuração 3"),
        ],
    },
}

# Fluxos do ATLS com definição localizada em documento público (a sigla do ATLS é a
# mesma do documento; EXP_NE corresponde a ExpNE, grafada sem sublinhado no RT-ONS).
DEFINICOES_ATLS = {
    "FNS": ("Fluxo sentido Norte-Sul", "ons_pel_2019_2020"),
    "FNESE": ("Fluxo da Interligação Nordeste-Sudeste/Centro-Oeste", "ons_rt_dpl_0131_2023"),
    "FNEN": ("Fluxo da Interligação Nordeste-Norte", "ons_rt_dpl_0131_2023"),
    "EXP_NE": ("Exportação Nordeste (ExpNE)", "ons_rt_dpl_0131_2023"),
    "RSE": ("Recebimento pelo Sudeste", "ons_pel_2019_2020"),
    "RSUL": ("Recebimento pela Região Sul", "ons_pel_2019_2020"),
    "RNE": ("Recebimento da Região Nordeste", "ons_pel_2019_2020"),
    "GIPU": ("Geração de Itaipu", "ons_pel_2019_2020"),
}

# Busca pelos limites operativos de intercâmbio (achado A06): o que foi consultado e o que
# se encontrou, para a gold e o documento do módulo.
BUSCA_LIMITES = [
    {"onde": "Portal de dados abertos do ONS (CKAN): lista completa de conjuntos e busca por 'limite', 'limites', "
             "'limite de intercâmbio', 'restrição', 'interligação' e 'fronteira'",
     "url": "https://dados.ons.org.br/api/3/action/package_search?q=limite",
     "resultado": "Nenhum conjunto com valores de limite de intercâmbio e vigência. O único resultado por 'limite' é o "
                  "indicador ATLS, que publica horas de violação dos limites sistêmicos, não os limites."},
    {"onde": "Dicionário de dados do conjunto Intercâmbios Entre Subsistemas (versão 1.2, 04/05/2026)",
     "url": f"{S3}/intercambio_nacional_ho/DicionarioDados_Intercambio_Nacional.pdf",
     "resultado": "Remete ao Relatório Quadrimestral de Limites de Intercâmbio para o Modelo Newave, disponível no Portal "
                  "SINtegre do ONS."},
    {"onde": "Portal SINtegre do ONS",
     "url": "https://sintegre.ons.org.br/",
     "resultado": "Portal autenticado: respondeu 403 ao acesso anônimo em 30/09/2026. Não é fonte pública e não foi "
                  "contornado."},
    {"onde": "Documentos públicos do ONS (acervo digital): RT-ONS DPL 0131/2023 e sumário executivo do PEL 2019/2020",
     "url": DOCUMENTOS["ons_rt_dpl_0131_2023"]["url"],
     "resultado": "Trazem limites em PDF que dependem de configuração da rede, patamar de carga e cenário (por exemplo, "
                  "FNESE de 9.500 MW na configuração 3), sem série com vigência que permita comparar com o fluxo hora a hora."},
    {"onde": "Mensagens operativas do Manual de Procedimentos da Operação sobre limites de FNS e FNESE (endereços em ons.org.br/MPO2)",
     "url": "https://ons.org.br/MPO2/Mensagem%20Operativa/Sist%C3%AAmica/CNOS/MOP-ONS%20394-S-2020.pdf",
     "resultado": "Endereços encontrados em busca pública responderam 404 em 30/09/2026."},
]

NULO = 1.0             # MWmed: fluxo de fronteira ou país tratado como nulo nesta faixa (o mesmo do módulo PLD)
TOL_IDENT = 0.1        # MWmed: tolerância das identidades do balanço (ver _TEXTO_TOL)
FAIXAS_RESIDUO = (1.0, 10.0, 100.0)
TOL_PLD = 0.01         # R$/MWh: preços separados quando a diferença passa de um centavo
LIMIAR_MATERIAL = 1000.0         # MWmed: desvio horário material entre programado e verificado
LIMIARES_SENSIBILIDADE = (500.0, 1000.0, 2000.0)
DIAS_JANELA_HORARIA = 7
DIAS_DIARIO = 60
DIAS_PDO_RECENTES = 30
PAISES = ("ARGENTINA", "URUGUAI", "PARAGUAI")
PAISES_SUL = ("ARGENTINA", "URUGUAI")   # conversoras no Sul (Garabi, Uruguaiana, Melo, Rivera): conferido no balanço
NOME_PAIS = {"ARGENTINA": "Argentina", "URUGUAI": "Uruguai", "PARAGUAI": "Paraguai"}
PARES = ons_rede.PARES
PARES_PROG = PARES + ("ARGENTINA", "URUGUAI")
# contribuição de cada fronteira ao saldo exportador do subsistema (positivo = exporta)
CONTRIB = {
    "N": (("N_NE", 1.0), ("N_SE", 1.0)),
    "NE": (("N_NE", -1.0), ("NE_SE", 1.0)),
    "SE": (("N_SE", -1.0), ("NE_SE", -1.0), ("S_SE", -1.0)),
    "S": (("S_SE", 1.0),),
}
_TEXTO_TOL = ("0,1 MWmed por hora: os arquivos publicam cada parcela com três casas decimais (2026) ou mais (anos "
              "anteriores), e somar seis parcelas arredondadas produz diferenças de alguns milésimos; no SIN, que o ONS "
              "publica já somado, aparecem diferenças de 0,01 MWmed. A tolerância fica uma ordem de grandeza acima disso. As "
              "horas entre 0,01 e 0,1 MWmed são contadas à parte (horas_entre_0_01_e_tolerancia), e as horas com resíduo "
              "também acima de 1, 10 e 100 MWmed.")

SITE = "https://scrutiniums.com/setor-eletrico/rede"
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py rede --sem-coleta"
META_DIR = os.path.join(base.DADOS, "meta")


def _fonte_prov(ds, recurso=None):
    cj = CONJUNTOS[ds]
    return {"orgao": "ONS", "dataset": cj["titulo"], "recurso": recurso or (
        f"{cj.get('prefixo', cj.get('arquivo', ''))}<ano>.csv" if cj.get("prefixo") else f"{cj['arquivo']}.csv"),
        "url_dataset": url_pacote(ds), "url_primaria": f"{S3}/{cj['s3']}/", "licenca": c.LICENCA_ONS}


def _csv_url(nome):
    return f"/energia/series/{nome}"


def _anos_disponiveis(hoje):
    return list(range(ANO_INICIAL, hoje.year + 1))


REGISTRO = {
    "id": "rede",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 23,
    "datasets": [
        {"orgao": "ONS", "nome": "intercambio-nacional", "slug": "ons-intercambio-nacional-releitura", "dataset_silver": DS_IN,
         "titulo": "Intercâmbios Entre Subsistemas: releitura dos arquivos originais (verificado e programado)",
         "estado": "UTILIZADO EM INDICADOR", "url": url_pacote(DS_IN), "licenca": c.LICENCA_ONS,
         "descricao": "Fluxo horário verificado e programado em cada fronteira entre subsistemas, relido linha a linha para conferir orientação e sinal.",
         "paginas": [{"rotulo": "Rede: circulação de energia", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_fronteiras_diario.csv", "/energia/series/rede_programado_horario.csv"], "quebras": [
             "A partir do arquivo de 2026 cada linha vem orientada no sentido do fluxo verificado da hora (valor não negativo); até 2025 a orientação era fixa e o valor tinha sinal. O dicionário não descreve a mudança."]},
        {"orgao": "ONS", "nome": "intercambio-internacional", "slug": "ons-intercambio-internacional", "dataset_silver": DS_II,
         "titulo": "Intercâmbio do SIN com Outros Países", "estado": "UTILIZADO EM INDICADOR", "url": url_pacote(DS_II),
         "licenca": c.LICENCA_ONS,
         "descricao": "Fluxo horário verificado e programado nas conversoras de fronteira com Argentina, Uruguai e Paraguai; positivo = exportação.",
         "paginas": [{"rotulo": "Rede: balanço e exterior", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_exterior_mensal.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "balanco-energia-subsistema", "slug": "ons-balanco-energia-subsistema-releitura", "dataset_silver": DS_BAL,
         "titulo": "Balanço de Energia nos Subsistemas: releitura dos arquivos originais", "estado": "UTILIZADO EM INDICADOR",
         "url": url_pacote(DS_BAL), "licenca": c.LICENCA_ONS,
         "paginas": [{"rotulo": "Rede: balanço e exterior", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_balanco_mensal.csv", "/energia/series/rede_balanco_residuos.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "geracao_itaipu", "slug": "ons-geracao-itaipu", "dataset_silver": DS_ITA,
         "titulo": "Geração de Itaipu Binacional: base horária", "estado": "UTILIZADO EM INDICADOR", "url": url_pacote(DS_ITA),
         "licenca": c.LICENCA_ONS,
         "paginas": [{"rotulo": "Rede: balanço e exterior", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_exterior_mensal.csv"], "quebras": [
             "Campo da parcela destinada ao Paraguai removido pelo ONS na versão 1.1 do dicionário (30/07/2026)."]},
        {"orgao": "ONS", "nome": "ind_confiarb_atls", "slug": "ons-ind-confiarb-atls", "dataset_silver": DS_ATLS,
         "titulo": "Indicador ATLS: atendimento aos limites sistêmicos", "estado": "UTILIZADO EM INDICADOR",
         "url": url_pacote(DS_ATLS), "licenca": c.LICENCA_ONS,
         "descricao": "Horas mensais em que cada fluxo sistêmico ficou acima do limite estabelecido pelos estudos elétricos.",
         "paginas": [{"rotulo": "Rede: restrições publicadas", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_atls.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "interrupcao_carga", "slug": "ons-interrupcao-carga", "dataset_silver": DS_IC,
         "titulo": "Interrupção de Carga", "estado": "UTILIZADO EM INDICADOR", "url": url_pacote(DS_IC), "licenca": c.LICENCA_ONS,
         "paginas": [{"rotulo": "Rede: restrições publicadas", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_interrupcoes_carga.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "programacao_fluxo_controlado", "slug": "ons-programacao-fluxo-controlado", "dataset_silver": DS_PDO,
         "titulo": "Programados dos Elementos de Fluxo Controlado (amostra de dias, conversoras internacionais)",
         "estado": "UTILIZADO EM INDICADOR", "url": url_pacote(DS_PDO), "licenca": c.LICENCA_ONS,
         "descricao": "Usado só para identificar qual programa o conjunto de intercâmbio internacional publica.",
         "paginas": [{"rotulo": "Rede: programado e verificado", "href": "/setor-eletrico/rede"}],
         "downloads": ["/energia/series/rede_pdo_conferencia.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "documentos-limites-intercambio", "slug": "ons-documentos-limites-intercambio", "dataset_silver": DS_DOC,
         "titulo": "Documentos públicos do ONS sobre limites sistêmicos (Submódulo 9.1, PEL 2019/2020, RT-ONS DPL 0131/2023)",
         "estado": "INTEGRADO", "url": DOCUMENTOS["ons_submodulo_9_1"]["url"], "licenca": LICENCA_DOC_ONS, "tema": "normas",
         "formatos": ["PDF"],
         "descricao": "Definição do ATLS e das siglas dos fluxos, e evidência de que os limites publicados dependem de configuração (achado A06).",
         "paginas": [{"rotulo": "Rede: restrições publicadas", "href": "/setor-eletrico/rede"}], "downloads": [], "quebras": []},
    ],
    "arquivos": {
        **{f"/energia/series/rede_horario_{a}.csv": (
            "data_hora (início da hora, Brasília); fluxo_N_NE, fluxo_N_SE, fluxo_NE_SE, fluxo_S_SE = intercâmbio verificado na "
            "fronteira em MWmed, positivo da primeira para a segunda ponta; prog_* = programado na mesma orientação (só a partir "
            "de 2026); ext_ARGENTINA, ext_URUGUAI, ext_PARAGUAI = intercâmbio internacional verificado (positivo = exportação); "
            "prog_ext_* = programado; pld_SE, pld_S, pld_NE, pld_N = PLD horário da CCEE na mesma hora, R$/MWh nominais; "
            "saldo_SE, saldo_S, saldo_NE, saldo_N, saldo_SIN = intercâmbio líquido do balanço de energia (positivo = exporta). "
            "Vazio = ausência na fonte.") for a in range(ANO_INICIAL, 2027)},
        "/energia/series/rede_fronteiras_diario.csv": (
            "data; par; horas (horas com valor); liquido_mwh (Σ fluxo horário × 1 h, com sinal); canonico_mwh (energia no sentido "
            "da primeira para a segunda ponta); inverso_mwh (sentido contrário); contra_saldo_mwh (menor dos dois: energia que "
            "o saldo líquido do dia esconde); horas_canonico, horas_inverso, horas_nulas (|fluxo| ≤ 1 MWmed); reversoes (trocas de "
            "sentido entre horas consecutivas com fluxo); max_canonico_mwmed, max_inverso_mwmed; horas_pld (horas com PLD nas "
            "duas pontas); horas_precos_separados (|ΔPLD| > R$ 0,01/MWh); horas_separados_fluxo_para_mais_caro e "
            "horas_separados_fluxo_para_mais_barato (sentido do fluxo verificado em relação ao preço, na mesma hora)."),
        "/energia/series/rede_subsistemas_diario.csv": (
            "data; sm; horas; exportacao_bruta_mwh e importacao_bruta_mwh (soma, hora a hora, das fronteiras em que o subsistema "
            "exporta e das em que importa, com o exterior no Sul); liquido_mwh (exportação menos importação); horas_transito "
            "(horas em que o subsistema exporta por uma fronteira e importa por outra ao mesmo tempo)."),
        "/energia/series/rede_balanco_mensal.csv": (
            "mes; sm (SE, S, NE, N, SIN); horas; horas_completas (todas as parcelas publicadas); geracao_mwh (hidráulica + "
            "térmica + eólica + solar), carga_mwh, intercambio_mwh (balanço do ONS, MWh); fronteiras_exterior_mwh (soma das "
            "fronteiras e, no Sul e no SIN, do intercâmbio internacional); residuo_balanco_mwh (geração − carga − intercâmbio); "
            "horas_residuo_balanco (|resíduo| > 0,1 MWmed); residuo_perimetro_mwh (intercâmbio do balanço − fronteiras e "
            "exterior); horas_residuo_perimetro."),
        "/energia/series/rede_balanco_residuos.csv": (
            "data_hora; identidade (balanco: geração − carga − intercâmbio; perimetro: intercâmbio do balanço − fronteiras e "
            "exterior; soma_sin: intercâmbio do SIN − soma dos quatro subsistemas); sm; residuo_mwmed; só horas com |resíduo| "
            "> 0,1 MWmed. Parcela ausente na fonte não gera linha (a hora fica como incompleta na tabela mensal)."),
        "/energia/series/rede_exterior_mensal.csv": (
            "mes; pais (ARGENTINA, URUGUAI, PARAGUAI) ou ITAIPU; horas; exportacao_mwh e importacao_mwh (intercâmbio verificado, "
            "positivo = exportação); liquido_mwh; horas_com_fluxo (|fluxo| > 1 MWmed); programado_liquido_mwh (2026 em diante); "
            "para ITAIPU: total_mwh, brasil_mwh (destinada ao Brasil) e nao_brasil_mwh (total − Brasil)."),
        "/energia/series/rede_atls.csv": (
            "fluxo (sigla do ONS); periodicidade (ME = mensal, AN = acumulado no ano até o mês); mes; atls (fração de 0 a 1, "
            "como publicada; o dicionário diz %); horas_violacao (horas acima do limite estabelecido); horas_periodo_implicitas "
            "(horas_violacao ÷ (1 − atls), vazio quando atls = 1); horas_calendario (mensal)."),
        "/energia/series/rede_interrupcoes_carga.csv": (
            "chave; cod_perturbacao; instante (Brasília); sm; uf; agente; carga_interrompida_mw; tempo_medio_min; "
            "energia_nao_suprida_mwh; rede_basica (S/N); rede_operacao (S/N); repetida (1 = linha idêntica a outra do arquivo). "
            "Como publicado pelo ONS."),
        "/energia/series/rede_programado_horario.csv": (
            "data_hora; par (fronteira na orientação canônica, ARGENTINA ou URUGUAI); programado_mwmed; verificado_mwmed; "
            "desvio_mwmed (verificado − programado); material (1 = |desvio| ≥ 1.000 MWmed); inversao (1 = programa e operação em "
            "sentidos opostos, ambos acima de 1 MWmed em módulo). Desvio não é falha: o programa é a previsão do dia anterior."),
        "/energia/series/rede_programado_diario.csv": (
            "data; par; horas; programado_mwh; verificado_mwh; desvio_mwh (Σ verificado − programado); desvio_abs_mwh "
            "(Σ |desvio|); horas_materiais; horas_inversao; maior_desvio_mwmed e hora_maior_desvio."),
        "/energia/series/rede_pdo_conferencia.csv": (
            "data_hora; pais; programado_conjunto_mwmed (intercâmbio internacional programado); pdo_mwmed (−média das duas meias "
            "horas das conversoras do país no PDO); diferenca_mwmed; confere (1 = diferença ≤ 0,5 MWmed)."),
    },
}


# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------

def _max_idade(ano, hoje):
    # ano corrente e anterior mudam (consistência recorrente do ONS e publicação diária);
    # anos fechados só voltam a ser baixados se o last_modified mudar ou a cada 30 dias
    return 0.4 if ano >= hoje.year - 1 else 30


def _importado(con, chave):
    return bool(base.registros_como_estavam_em(con, DS_CONTROLE).get(chave, {}).get("importado"))


def _marca_importado(con, vid, relatorio, chave=None):
    base.grava_registros(con, DS_CONTROLE, vid, [(chave or vid, "importado",
                                                  json.dumps(relatorio, ensure_ascii=False, sort_keys=True, default=str))])


def _recursos_anuais(pac, prefixo):
    """{ano: recurso CKAN} dos CSV anuais <prefixo><ano>.csv."""
    out = {}
    for r in pac.get("resources", []):
        nome = (r.get("url") or "").rsplit("/", 1)[-1]
        if (r.get("format") or "").upper() != "CSV" or not nome.startswith(prefixo) or not nome.endswith(".csv"):
            continue
        nucleo = nome[len(prefixo):-4]
        if nucleo.isdigit():
            out[int(nucleo)] = r
    return out


def _recurso_unico(pac, arquivo, formato="CSV"):
    for r in pac.get("resources", []):
        nome = (r.get("url") or "").rsplit("/", 1)[-1]
        if (r.get("format") or "").upper() == formato and nome.split(".")[0] == arquivo:
            return r
    return None


def _importa_obs(con, ds, vintage, parser, **kw):
    linhas = ckan.le_csv_bronze(vintage["arquivo"], encoding="utf-8-sig", separador=";")
    obs, rel = parser(linhas, **kw) if kw else parser(linhas)
    novas, revs = base.grava_observacoes(con, ds, vintage["vintage_id"], obs)
    rel.update(novas=novas, revisoes=revs, observacoes=len(obs))
    regs = [(vintage["recurso"], "esquema", json.dumps(rel, ensure_ascii=False, sort_keys=True, default=str))]
    base.grava_registros(con, ds, vintage["vintage_id"], regs)
    _marca_importado(con, vintage["vintage_id"], {k: rel[k] for k in ("observacoes", "novas", "revisoes")})
    con.commit()
    return {k: rel.get(k) for k in ("linhas", "observacoes", "novas", "revisoes", "conflitos")}


def _importa_interrupcoes(con, vintage):
    eventos, rel = ons_rede.parse_interrupcoes(ckan.le_csv_bronze(vintage["arquivo"], encoding="utf-8-sig", separador=";"))
    conhecidas = base.registros_como_estavam_em(con, DS_IC)
    presentes = {e["chave"] for e in eventos}
    regs = []
    for e in eventos:
        for k in ons_rede.CAMPOS_INTERRUPCAO:
            regs.append((e["chave"], k, e[k]))
        regs.append((e["chave"], "presente", "1"))
    # evento publicado antes e ausente desta versão do arquivo: registrado como retirado
    for ch, campos in conhecidas.items():
        if ch.startswith("_") or ch in presentes:
            continue
        if campos.get("presente") == "1":
            regs.append((ch, "presente", "0"))
    regs.append(("_arquivo", "esquema", json.dumps(rel, ensure_ascii=False, sort_keys=True, default=str)))
    novas, revs = base.grava_registros(con, DS_IC, vintage["vintage_id"], regs)
    rel.update(novas=novas, revisoes=revs)
    _marca_importado(con, vintage["vintage_id"], {"eventos": len(eventos), "novas": novas, "revisoes": revs})
    con.commit()
    return {"eventos": len(eventos), "novas": novas, "revisoes": revs}


def _texto_pdf(caminho_relativo):
    """Texto do PDF do bronze pelo pdftotext (-layout). Sem a ferramenta, None: a gold diz
    que os trechos não foram conferidos, em vez de citá-los sem conferência."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with base.abre_bronze(caminho_relativo) as f, open(tmp, "wb") as g:
            shutil.copyfileobj(f, g)
        return subprocess.run([exe, "-layout", tmp, "-"], capture_output=True, text=True, timeout=120).stdout
    finally:
        os.remove(tmp)


def _importa_dicionario(con, ds, vintage):
    txt = _texto_pdf(vintage["arquivo"])
    chave = ds
    regs = [(chave, "sha256", vintage["sha256"]), (chave, "url", vintage["url"]),
            (chave, "extracao", "pdftotext" if txt is not None else "pdftotext ausente")]
    if txt is not None:
        import re
        datas = re.findall(r"Data:\s*(\d{2}-\d{2}-\d{4})", txt)
        baixo = txt.lower()
        regs += [(chave, "versoes", json.dumps(ons_rede.versoes_dicionario(txt), ensure_ascii=False)),
                 (chave, "permissoes", json.dumps(ons_rede.permissoes_dicionario(txt), ensure_ascii=False)),
                 (chave, "data_documento", datas[0] if datas else None),
                 # o dicionário diz o que significa o sinal? (A05: o do balanço não diz)
                 (chave, "menciona_sinal", int("positivo" in baixo or "positivos" in baixo or "negativos indicam" in baixo))]
        for tid, passagem in TRECHOS_DICIONARIO.get(ds, []):
            regs += [(f"{chave}:{tid}", "texto", passagem),
                     (f"{chave}:{tid}", "confere", int(ons_rede.confere_passagem(txt, passagem)))]
    base.grava_registros(con, DS_DIC, vintage["vintage_id"], regs)
    _marca_importado(con, vintage["vintage_id"], {"extraido": txt is not None})
    con.commit()


def _importa_documento(con, doc_id, vintage):
    txt = _texto_pdf(vintage["arquivo"])
    regs = [(doc_id, "sha256", vintage["sha256"]), (doc_id, "url", vintage["url"]),
            (doc_id, "extracao", "pdftotext" if txt is not None else "pdftotext ausente"),
            (doc_id, "caracteres", len(txt) if txt else 0)]
    for tid, passagem in DOCUMENTOS[doc_id]["trechos"]:
        ok = ons_rede.confere_passagem(txt, passagem) if txt is not None else None
        regs += [(f"{doc_id}:{tid}", "texto", passagem), (f"{doc_id}:{tid}", "confere", None if ok is None else int(ok))]
    base.grava_registros(con, DS_DOC, vintage["vintage_id"], regs)
    _marca_importado(con, vintage["vintage_id"], {"extraido": txt is not None})
    con.commit()


def dias_amostra_pdo(hoje, disponiveis):
    """Dias da conferência do programa: os últimos DIAS_PDO_RECENTES dias publicados e os
    dias 1 e 15 de cada mês desde janeiro de 2026 (início do programado no conjunto de
    intercâmbio). Amostra fixa e documentada, não escolhida pelo resultado."""
    disp = sorted(disponiveis)
    recentes = set(disp[-DIAS_PDO_RECENTES:])
    fixos = {d for d in disp if d >= "2026-01-01" and d[8:10] in ("01", "15")}
    return sorted(recentes | fixos)


def coletar(con, ctx):
    """Coleta do módulo. Nunca lança por falha de fonte: cada falha vira registro em
    `coletas` e item em `falhas`; a gold anterior fica no ar pela sentinela."""
    hoje = ctx.get("hoje") or date.today()
    status = {"ok": True, "falhas": [], "arquivos": {}, "importacoes": {}}

    def falha(msg):
        status["falhas"].append(str(msg)[:300])

    pacotes = {}
    for ds, cj in CONJUNTOS.items():
        try:
            pac = ckan.pacote("ONS", cj["pacote"])
            pacotes[ds] = pac
            base.escreve_gold(f"_meta_{ds}.json", ckan.metadados(pac, "ONS"), destino=META_DIR)
        except Exception as e:  # pane do portal: registrada, sem dado inventado
            base.registra_coleta(con, ds, "*", False, f"package_show: {e}")
            falha(f"{cj['pacote']} package_show: {e}")

    # 1. arquivos anuais (intercâmbio nacional e internacional, balanço)
    for ds in (DS_IN, DS_II, DS_BAL):
        pac = pacotes.get(ds)
        if not pac:
            continue
        for ano, r in sorted(_recursos_anuais(pac, CONJUNTOS[ds]["prefixo"]).items()):
            if ano < ANO_INICIAL:
                continue
            recurso = f"{CONJUNTOS[ds]['prefixo']}{ano}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=ds, recurso=recurso, url=r["url"],
                                      publicado_em=r.get("last_modified"), ext="csv", max_idade_dias=_max_idade(ano, hoje))
            status["arquivos"][recurso] = res["status"]
            if res["status"] == "falha":
                falha(f"{recurso}: {res['detalhe']}")

    # 2. arquivos únicos (Itaipu, ATLS, interrupções): atualizados pela fonte todo dia
    for ds in (DS_ITA, DS_ATLS, DS_IC):
        pac = pacotes.get(ds)
        r = _recurso_unico(pac, CONJUNTOS[ds]["arquivo"]) if pac else None
        if pac and not r:
            falha(f"{CONJUNTOS[ds]['arquivo']}: recurso CSV não encontrado no pacote")
        if not r:
            continue
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=ds, recurso=CONJUNTOS[ds]["arquivo"], url=r["url"],
                                  publicado_em=r.get("last_modified"), ext="csv", max_idade_dias=0.4)
        status["arquivos"][CONJUNTOS[ds]["arquivo"]] = res["status"]
        if res["status"] == "falha":
            falha(f"{CONJUNTOS[ds]['arquivo']}: {res['detalhe']}")

    # 3. programa diário das conversoras (amostra): arquivos por dia, imutáveis na prática
    pac = pacotes.get(DS_PDO)
    if pac:
        diarios = {}
        for r in pac.get("resources", []):
            nome = (r.get("url") or "").rsplit("/", 1)[-1]
            if (r.get("format") or "").upper() == "CSV" and nome.startswith(CONJUNTOS[DS_PDO]["prefixo"]):
                dia = nome[len(CONJUNTOS[DS_PDO]["prefixo"]):-4].replace("_", "-")
                if len(dia) == 10:
                    diarios[dia] = r
        for dia in dias_amostra_pdo(hoje, diarios):
            r = diarios[dia]
            recurso = f"{CONJUNTOS[DS_PDO]['prefixo']}{dia.replace('-', '_')}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_PDO, recurso=recurso, url=r["url"],
                                      publicado_em=r.get("last_modified"), ext="csv", max_idade_dias=30)
            status["arquivos"][recurso] = res["status"]
            if res["status"] == "falha":
                falha(f"{recurso}: {res['detalhe']}")

    # 4. dicionários (PDF) de todos os conjuntos usados
    for ds, cj in CONJUNTOS.items():
        pac = pacotes.get(ds)
        r = _recurso_unico(pac, cj["dic"], "PDF") if pac else None
        if not r:
            continue
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=ds, url=r["url"],
                                  publicado_em=r.get("last_modified"), ext="pdf", max_idade_dias=7)
        status["arquivos"][f"dicionario:{ds}"] = res["status"]
        if res["status"] == "falha":
            falha(f"dicionário {ds}: {res['detalhe']}")

    # 5. documentos públicos do ONS (A06 e definições do ATLS)
    for doc_id, doc in DOCUMENTOS.items():
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DOC, recurso=doc_id, url=doc["url"], publicado_em=None,
                                  ext="pdf", max_idade_dias=30)
        status["arquivos"][doc_id] = res["status"]
        if res["status"] == "falha":
            falha(f"{doc_id}: {res['detalhe']}")

    # 6. importação das vintages ainda não lidas (inclusive as puladas pela política de recoleta)
    parsers = {DS_IN: ons_rede.parse_intercambio_nacional, DS_II: ons_rede.parse_intercambio_internacional,
               DS_BAL: ons_rede.parse_balanco, DS_ATLS: ons_rede.parse_atls, DS_PDO: ons_rede.parse_pdo_conversoras}
    for ds in (DS_IN, DS_II, DS_BAL, DS_ITA, DS_ATLS, DS_IC, DS_PDO):
        for rec, v in sorted(ckan.vintages_vigentes(con, ds).items()):
            if _importado(con, v["vintage_id"]):
                continue
            try:
                if ds == DS_IC:
                    status["importacoes"][rec] = _importa_interrupcoes(con, v)
                elif ds == DS_ITA:
                    status["importacoes"][rec] = _importa_obs(con, ds, v, ons_rede.parse_itaipu, ano_inicial=ANO_INICIAL)
                else:
                    status["importacoes"][rec] = _importa_obs(con, ds, v, parsers[ds])
            except Exception as e:  # arquivo do bronze ausente ou formato novo: registrado
                base.registra_coleta(con, ds, rec, False, f"importação: {e}")
                falha(f"{rec} importação: {e}")
    regs_dic = base.registros_como_estavam_em(con, DS_DIC)
    for rec, v in ckan.vintages_vigentes(con, DS_DIC).items():
        # trecho novo na lista (ou campo novo) exige reler o PDF já baixado
        incompleto = "menciona_sinal" not in regs_dic.get(rec, {}) or any(
            f"{rec}:{tid}" not in regs_dic for tid, _ in TRECHOS_DICIONARIO.get(rec, []))
        if not _importado(con, v["vintage_id"]) or incompleto:
            try:
                _importa_dicionario(con, rec, v)
            except Exception as e:
                falha(f"dicionário {rec} importação: {e}")
    for rec, v in ckan.vintages_vigentes(con, DS_DOC).items():
        if rec in DOCUMENTOS and not _importado(con, v["vintage_id"]):
            try:
                _importa_documento(con, rec, v)
            except Exception as e:
                falha(f"{rec} importação: {e}")
    con.commit()
    status["ok"] = not status["falhas"]
    return status


# ---------------------------------------------------------------------------
# Cálculos (funções puras; testes em pipeline/tests/test_energia_rede.py)
# ---------------------------------------------------------------------------

def sentido(v, nulo=NULO):
    """+1 (sentido canônico), −1 (inverso) ou 0 (|v| ≤ nulo); None sem valor."""
    if v is None:
        return None
    if v > nulo:
        return 1
    if v < -nulo:
        return -1
    return 0


def resumo_fluxo(valores):
    """Resumo de uma sequência de fluxos horários (MWmed, em ordem de hora, None = hora sem
    valor) de uma fronteira: energia em cada sentido e o que o saldo líquido esconde.

    Cada valor horário em MWmed vale a mesma quantidade em MWh (duração de 1 h). O saldo
    líquido é canônico − inverso; `contra_saldo_mwh` = min(canônico, inverso) é a energia
    que circulou no sentido oposto ao saldo e que o líquido anula. Reversões contam trocas
    de sentido entre horas consecutivas com fluxo acima de 1 MWmed em módulo (horas nulas
    não interrompem a sequência; hora sem valor interrompe)."""
    horas = [v for v in valores if v is not None]
    can = sum(v for v in horas if v > 0)
    inv = sum(-v for v in horas if v < 0)
    reversoes, ultimo = 0, None
    for v in valores:
        if v is None:
            ultimo = None
            continue
        s = sentido(v)
        if s == 0:
            continue
        if ultimo is not None and s != ultimo:
            reversoes += 1
        ultimo = s
    pos = [v for v in horas if v > NULO]
    neg = [-v for v in horas if v < -NULO]
    return {
        "horas": len(horas), "liquido_mwh": can - inv if horas else None, "canonico_mwh": can if horas else None,
        "inverso_mwh": inv if horas else None, "contra_saldo_mwh": min(can, inv) if horas else None,
        "horas_canonico": len(pos), "horas_inverso": len(neg), "horas_nulas": len(horas) - len(pos) - len(neg),
        "reversoes": reversoes, "max_canonico_mwmed": max(pos) if pos else None, "max_inverso_mwmed": max(neg) if neg else None,
    }


def horas_do_dia(dia):
    return [f"{dia}T{h:02d}:00" for h in range(24)]


def pld_na_hora(fluxo, pld_de, pld_para, tol=TOL_PLD):
    """Classificação de uma hora de fronteira quanto ao preço na mesma hora: None sem
    fluxo ou sem PLD em alguma ponta; 'juntos' se |ΔPLD| ≤ R$ 0,01/MWh; se separados,
    'para_mais_caro' (fluxo do submercado mais barato para o mais caro), 'para_mais_barato'
    ou 'fluxo_nulo'. Descreve a hora; não diz se a fronteira estava no limite."""
    if fluxo is None or pld_de is None or pld_para is None:
        return None
    dif = pld_para - pld_de
    if abs(dif) <= tol + 1e-9:
        return "juntos"
    s = sentido(fluxo)
    if s == 0:
        return "fluxo_nulo"
    return "para_mais_caro" if (s > 0) == (dif > 0) else "para_mais_barato"


def contribuicoes(sm, fluxos_h, exterior_h):
    """Parcelas com sinal (positivo = o subsistema exporta) de cada fronteira na hora, e do
    exterior no Sul (Argentina e Uruguai: conversoras no Sul, conferido no balanço). None
    se faltar alguma fronteira ou, no Sul, algum país."""
    out = []
    for par, sinal in CONTRIB[sm]:
        v = fluxos_h.get(par)
        if v is None:
            return None
        out.append(sinal * v)
    if sm == "S":
        for p in PAISES_SUL:
            v = exterior_h.get(p)
            if v is None:
                return None
            out.append(v)
    return out


def bruto_subsistema(partes):
    """(exportação bruta, importação bruta, trânsito) de uma hora a partir das parcelas."""
    exp = sum(x for x in partes if x > 0)
    imp = sum(-x for x in partes if x < 0)
    transito = any(x > NULO for x in partes) and any(x < -NULO for x in partes)
    return exp, imp, transito


PARCELAS_BALANCO = ("geracao", "carga", "intercambio")


def residuo_balanco(parcelas):
    """geração (hidráulica + térmica + eólica + solar, somada na leitura) − carga −
    intercâmbio, ou None se faltar parcela (ausência não vira zero)."""
    if any(parcelas.get(k) is None for k in PARCELAS_BALANCO):
        return None
    return parcelas["geracao"] - parcelas["carga"] - parcelas["intercambio"]


def material(desvio, limiar=LIMIAR_MATERIAL):
    return desvio is not None and abs(desvio) >= limiar - 1e-9


def inversao(prog, verif):
    sp, sv = sentido(prog), sentido(verif)
    return sp is not None and sv is not None and sp != 0 and sv != 0 and sp != sv


def atls_horas_implicitas(atls, horas_violacao):
    """Período de observação implícito B = A ÷ (1 − ATLS), com A = horas de violação e o
    ATLS como fração (Submódulo 9.1: ATLS = (1 − A/B) × 100%). None quando ATLS = 1."""
    if atls is None or horas_violacao is None or atls >= 1:
        return None
    return horas_violacao / (1 - atls)


def horas_calendario(mes):
    a, m = int(mes[:4]), int(mes[5:7])
    ini = date(a, m, 1)
    fim = date(a + (m == 12), m % 12 + 1, 1)
    return (fim - ini).days * 24


def runs(horas_ordenadas):
    """Agrupa horas ('AAAA-MM-DDTHH:00') em sequências contíguas: [(início, fim, n)]."""
    out = []
    for h in horas_ordenadas:
        t = datetime.fromisoformat(h)
        if out and t - datetime.fromisoformat(out[-1][1]) == timedelta(hours=1):
            out[-1] = (out[-1][0], h, out[-1][2] + 1)
        else:
            out.append((h, h, 1))
    return out


# ---------------------------------------------------------------------------
# Leitura do silver
# ---------------------------------------------------------------------------

def _serie(con, ds, serie, desde=None):
    pts = base.serie_vigente(con, ds, serie)
    return {k: v for k, v in pts if desde is None or k >= desde}


def _esquemas(con, ds):
    """{recurso: relatório do esquema} das vintages vigentes (registros gravados na importação)."""
    regs = base.registros_como_estavam_em(con, ds)
    out = {}
    for rec in ckan.vintages_vigentes(con, ds):
        txt = regs.get(rec, {}).get("esquema")
        if txt:
            out[rec] = json.loads(txt)
    return out


def _arquivos_fonte(con, ds):
    return [ev.arquivo_de_vintage(v) for _, v in sorted(ckan.vintages_vigentes(con, ds).items())]


def _fonte_ev(con, ds, conjunto=None, recursos=None):
    vig = ckan.vintages_vigentes(con, ds)
    escolhidas = [vig[r] for r in sorted(vig) if recursos is None or r in recursos]
    ult = max(escolhidas, key=lambda v: v["capturado_em"]) if escolhidas else None
    f = ev.fonte_de_vintage("ONS", conjunto or CONJUNTOS[ds]["titulo"], url_pacote(ds), ult)
    if len(escolhidas) > 1:
        f["arquivos"] = [ev.arquivo_de_vintage(v) for v in escolhidas]
    return f


# ---------------------------------------------------------------------------
# Construção da gold
# ---------------------------------------------------------------------------

def _colunas(linhas, campos):
    """Lista de dicts → dict de colunas (arrays paralelos), para a gold ficar compacta."""
    return {k: [x.get(k) for x in linhas] for k in campos}


def _r(v, casas=1):
    return c.r(v, casas)


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    con_p = ctx.get("con_principal")
    desde = f"{ANO_INICIAL}-01-01"

    # ---- séries horárias -------------------------------------------------------
    fluxo = {p: _serie(con, DS_IN, f"verificado.{p}", desde) for p in PARES}
    prog = {p: _serie(con, DS_IN, f"programado.{p}", desde) for p in PARES}
    ext = {p: _serie(con, DS_II, f"verificado.{p}", desde) for p in PAISES}
    prog_ext = {p: _serie(con, DS_II, f"programado.{p}", desde) for p in PAISES}
    if not all(fluxo.values()):
        return c.stub(GOLD, "intercâmbio entre subsistemas ausente no silver ons_rede (rode a coleta do módulo)")
    if not any(ext.values()):
        return c.stub(GOLD, "intercâmbio internacional ausente no silver ons_rede")
    bal = {(k, sm): _serie(con, DS_BAL, f"{k}.{sm}", desde)
           for k in PARCELAS_BALANCO for sm in ons_rede.SUBSISTEMAS + ("SIN",)}
    if not all(bal[("intercambio", sm)] for sm in ons_rede.SUBSISTEMAS + ("SIN",)):
        return c.stub(GOLD, "balanço de energia ausente no silver ons_rede")
    pld = {sm: _serie(con_p, DS_PLD, f"pld.{sm}", desde) if con_p is not None else {} for sm in ons_rede.SUBSISTEMAS}

    todas_horas = sorted(set().union(*(set(v) for v in fluxo.values())))
    ultima_hora = todas_horas[-1]
    # último dia com as 24 horas das quatro fronteiras
    dias_completos = sorted({h[:10] for h in todas_horas
                             if all(all(x in fluxo[p] for x in horas_do_dia(h[:10])) for p in PARES)})
    dia_ref = dias_completos[-1]
    if c.d(dia_ref) > hoje:
        return c.stub(GOLD, f"dia de referência {dia_ref} posterior à data de processamento {hoje}")

    # ---- validação física e de esquema -----------------------------------------
    esq_in, esq_ii, esq_bal = _esquemas(con, DS_IN), _esquemas(con, DS_II), _esquemas(con, DS_BAL)
    conflitos = sum(len(e.get("conflitos") or []) for e in list(esq_in.values()) + list(esq_ii.values()) + list(esq_bal.values()))
    desconhecidos = sum(sum((e.get("pares_desconhecidos") or {}).values()) for e in esq_in.values())
    ressalvas = []
    if conflitos:
        ressalvas.append(f"{conflitos} hora(s) com duas linhas da mesma fronteira, país ou subsistema nos arquivos: ficaram sem valor.")
    if desconhecidos:
        ressalvas.append(f"{desconhecidos} linha(s) com par de subsistemas fora das quatro fronteiras monitoradas: não integradas.")
    for sm in ons_rede.SUBSISTEMAS + ("SIN",):
        neg = sum(1 for v in bal[("carga", sm)].values() if v < 0)
        if neg:
            return c.stub(GOLD, f"carga negativa no balanço ({sm}, {neg} horas): violação física, publicação suspensa")
    maior_fluxo = max(abs(v) for p in PARES for v in fluxo[p].values())
    if maior_fluxo > 30000:
        return c.stub(GOLD, f"fluxo de fronteira de {maior_fluxo:.0f} MWmed: acima de qualquer valor físico plausível, conferir a fonte")

    circulacao = _circulacao(fluxo, prog, ext, pld, bal, dia_ref, todas_horas)
    balanco = _balanco(bal, fluxo, ext, con)
    exterior = _exterior(ext, prog_ext, con, dia_ref)
    restricoes = _restricoes(con, hoje)
    programado = _programado(fluxo, prog, ext, prog_ext, con, dia_ref)
    conferencia = _conferencia_principal(con, con_p, fluxo, bal)
    esquema = _resumo_esquema(esq_in, esq_ii, esq_bal)

    _escreve_csv_horarios(fluxo, prog, ext, prog_ext, pld, bal)

    gold = {
        **c.cabecalho(GOLD),
        "referencia": {"dia": dia_ref, "ultima_hora_fluxo": ultima_hora,
                       "ultima_hora_pld": max((max(v) for v in pld.values() if v), default=None),
                       "ano_inicial": ANO_INICIAL},
        "regras": _regras(),
        "fronteiras": [{"par": f"{a}_{b}", "de": a, "para": b, "nome": f"{c.NOME_SUBMERCADO[a]} → {c.NOME_SUBMERCADO[b]}"}
                       for a, b in ons_rede.FRONTEIRAS],
        "paises": [{"pais": p, "nome": NOME_PAIS[p]} for p in PAISES],
        "esquema_fonte": esquema,
        "cobertura": _cobertura(fluxo, ext, bal, dia_ref),
        "circulacao": circulacao,
        "balanco": balanco,
        "exterior": exterior,
        "restricoes": restricoes,
        "programado": programado,
        "conferencia_silver_principal": conferencia,
        "achados": _achados(balanco, esquema, restricoes, programado, con, ext, bal, fluxo),
        "ressalvas": ressalvas,
        "downloads": [{"rotulo": f"Série horária {a} (CSV)", "url": _csv_url(f"rede_horario_{a}.csv")}
                      for a in _anos_com_dado(todas_horas)] + [
            {"rotulo": "Fronteiras por dia (CSV)", "url": _csv_url("rede_fronteiras_diario.csv")},
            {"rotulo": "Subsistemas por dia (CSV)", "url": _csv_url("rede_subsistemas_diario.csv")},
            {"rotulo": "Balanço mensal (CSV)", "url": _csv_url("rede_balanco_mensal.csv")},
            {"rotulo": "Horas com resíduo no balanço (CSV)", "url": _csv_url("rede_balanco_residuos.csv")},
            {"rotulo": "Exterior e Itaipu por mês (CSV)", "url": _csv_url("rede_exterior_mensal.csv")},
            {"rotulo": "Indicador ATLS (CSV)", "url": _csv_url("rede_atls.csv")},
            {"rotulo": "Interrupções de carga (CSV)", "url": _csv_url("rede_interrupcoes_carga.csv")},
            {"rotulo": "Programado e verificado por hora (CSV)", "url": _csv_url("rede_programado_horario.csv")},
            {"rotulo": "Programado e verificado por dia (CSV)", "url": _csv_url("rede_programado_diario.csv")},
            {"rotulo": "Conferência do programa com o PDO (CSV)", "url": _csv_url("rede_pdo_conferencia.csv")},
        ],
    }
    snaps = {ds: c.snapshot_de(con, ds) for ds in (DS_IN, DS_II, DS_BAL, DS_ITA, DS_ATLS, DS_IC, DS_PDO)}
    snap_pld = c.snapshot_de(con_p, DS_PLD) if con_p is not None else {"id": None, "sha256": None, "capturas": []}
    gold["proveniencia"] = _proveniencias(gold, snaps, snap_pld, pld, dia_ref)
    gold["evidencias"] = _evidencias(gold, con, con_p, fluxo, dia_ref, ressalvas)
    return _limpa(gold)


def _limpa(x):
    """Remove as chaves internas (prefixo _) usadas entre as etapas da construção."""
    if isinstance(x, dict):
        return {k: _limpa(v) for k, v in x.items() if not (isinstance(k, str) and k.startswith("_"))}
    if isinstance(x, list):
        return [_limpa(v) for v in x]
    if isinstance(x, tuple):
        return [_limpa(v) for v in x]
    return x


def _cobertura(fluxo, ext, bal, dia_ref):
    """Dias sem as 24 horas em cada fonte, de 1º de janeiro do ano inicial ao dia de
    referência: a ausência fica listada, nunca preenchida."""
    ini = date(ANO_INICIAL, 1, 1)
    fim = c.d(dia_ref)
    todos = [d.isoformat() for d in c.dias(ini, fim)]

    def faltas(series):
        out = []
        for d in todos:
            n = min(sum(1 for h in horas_do_dia(d) if h in s_) for s_ in series)
            if n < 24:
                out.append({"dia": d, "horas": n})
        return out
    fr = faltas([fluxo[p] for p in PARES])
    ex = faltas([ext[p] for p in PAISES_SUL])
    ba = faltas([bal[("intercambio", sm)] for sm in ons_rede.SUBSISTEMAS + ("SIN",)])
    return {"inicio": ini.isoformat(), "fim": dia_ref, "dias": len(todos),
            "fronteiras": {"dias_incompletos": len(fr), "lista": fr[:40]},
            "exterior": {"dias_incompletos": len(ex), "lista": ex[:40]},
            "balanco": {"dias_incompletos": len(ba), "lista": ba[:40]}}


def _anos_com_dado(horas):
    return sorted({int(h[:4]) for h in horas})


def _regras():
    return {
        "orientacao": ("Fronteiras na orientação N→NE, N→SE/CO, NE→SE/CO e S→SE/CO: positivo = energia da primeira para a "
                       "segunda região. Os arquivos do ONS não usam sempre essa orientação (a de cada arquivo está em "
                       "esquema_fonte e no achado A05); o módulo converte cada linha, verificado e programado com o mesmo sinal."),
        "energia": "Cada valor horário em MWmed equivale à mesma quantidade em MWh (duração de uma hora); somas diárias e mensais em MWh.",
        "bruto_liquido": ("Líquido = energia no sentido canônico menos energia no sentido inverso. A energia contra o saldo "
                          "(o menor dos dois sentidos) é o que o líquido esconde: um dia com 10 GWh para um lado e 8 GWh para o "
                          "outro tem saldo de 2 GWh."),
        "nulo": f"Fluxo com módulo até {NULO:.0f} MWmed conta como nulo na contagem de horas por sentido e de reversões.",
        "pld": ("PLD e fluxo comparados na mesma hora (hora local do ONS e da CCEE). Preços separados quando a diferença passa de "
                "R$ 0,01/MWh. Diferença de preço e espessura da seta não demonstram que a fronteira estava no limite."),
        "balanco": ("Identidades conferidas hora a hora: geração − carga = intercâmbio do balanço; intercâmbio do balanço = soma "
                    "das fronteiras (no Sul, mais Argentina e Uruguai); intercâmbio do SIN = soma dos subsistemas = intercâmbio "
                    "internacional. Resíduo é publicado e sinalizado, nunca atribuído a perdas ou forçado a zero."),
        "tolerancia_balanco": _TEXTO_TOL,
        "limites": ("Limites operativos de intercâmbio com vigência não estão publicados como conjunto estruturado (achado A06): "
                    "nenhum percentual de utilização da rede é calculado, e capacidade nominal de linha não substitui limite "
                    "de transferência entre regiões."),
        "materialidade": (f"Desvio material: |verificado − programado| de pelo menos {_fmt(LIMIAR_MATERIAL)} MWmed na hora, o "
                          "mesmo limiar para todas as fronteiras (justificativa com os dados em programado.justificativa_limiar); "
                          "contagens com 500 e 2.000 MWmed são publicadas como sensibilidade. Desvio não é falha: a operação em "
                          "tempo real se ajusta a carga, vento, sol e disponibilidade depois de fechado o programa."),
    }


# ---------------------------------------------------------------------------
# P028: circulação
# ---------------------------------------------------------------------------

def _circulacao(fluxo, prog, ext, pld, bal, dia_ref, todas_horas):
    fim = c.d(dia_ref)
    dias = sorted({h[:10] for h in todas_horas if h[:10] <= dia_ref})
    diario = {p: {} for p in PARES}
    linhas_csv = []
    for dia in dias:
        hs = horas_do_dia(dia)
        for (a, b), p in zip(ons_rede.FRONTEIRAS, PARES):
            vals = [fluxo[p].get(h) for h in hs]
            if all(v is None for v in vals):
                continue
            rz = resumo_fluxo(vals)
            cls = [pld_na_hora(fluxo[p].get(h), pld[a].get(h), pld[b].get(h)) for h in hs]
            rz.update({
                "horas_pld": sum(1 for x in cls if x is not None),
                "horas_precos_separados": sum(1 for x in cls if x not in (None, "juntos")),
                "horas_separados_fluxo_para_mais_caro": sum(1 for x in cls if x == "para_mais_caro"),
                "horas_separados_fluxo_para_mais_barato": sum(1 for x in cls if x == "para_mais_barato"),
                "horas_separados_fluxo_nulo": sum(1 for x in cls if x == "fluxo_nulo"),
            })
            diario[p][dia] = rz
            linhas_csv.append([dia, p, rz["horas"], _r(rz["liquido_mwh"], 3), _r(rz["canonico_mwh"], 3), _r(rz["inverso_mwh"], 3),
                               _r(rz["contra_saldo_mwh"], 3), rz["horas_canonico"], rz["horas_inverso"], rz["horas_nulas"],
                               rz["reversoes"], _r(rz["max_canonico_mwmed"], 3), _r(rz["max_inverso_mwmed"], 3), rz["horas_pld"],
                               rz["horas_precos_separados"], rz["horas_separados_fluxo_para_mais_caro"],
                               rz["horas_separados_fluxo_para_mais_barato"]])
    base.escreve_csv("rede_fronteiras_diario.csv",
                     ["data", "par", "horas", "liquido_mwh", "canonico_mwh", "inverso_mwh", "contra_saldo_mwh", "horas_canonico",
                      "horas_inverso", "horas_nulas", "reversoes", "max_canonico_mwmed", "max_inverso_mwmed", "horas_pld",
                      "horas_precos_separados", "horas_separados_fluxo_para_mais_caro", "horas_separados_fluxo_para_mais_barato"],
                     linhas_csv)

    # janela diária recente e resumo de 30 dias
    ult = [(fim - timedelta(days=i)).isoformat() for i in range(DIAS_DIARIO - 1, -1, -1)]
    campos_d = ("liquido_mwh", "canonico_mwh", "inverso_mwh", "contra_saldo_mwh", "horas", "horas_inverso",
                "reversoes", "horas_precos_separados", "horas_separados_fluxo_para_mais_caro",
                "horas_separados_fluxo_para_mais_barato")
    diario_gold = {"dias": ult, "por_par": {p: {k: [(_r(diario[p][d][k], 0) if k.endswith("_mwh") else diario[p][d][k])
                                                    if d in diario[p] else None for d in ult] for k in campos_d}
                                            for p in PARES}}
    j30 = ult[-30:]
    resumo = []
    for (a, b), p in zip(ons_rede.FRONTEIRAS, PARES):
        ds = [diario[p][d] for d in j30 if d in diario[p]]
        completos = [x for x in ds if x["horas"] == 24]
        can = sum(x["canonico_mwh"] for x in ds)
        inv = sum(x["inverso_mwh"] for x in ds)
        resumo.append({
            "par": p, "de": a, "para": b, "inicio": j30[0], "fim": j30[-1], "dias": len(ds), "dias_completos": len(completos),
            "horas": sum(x["horas"] for x in ds),
            "liquido_mwh": _r(can - inv, 0), "canonico_mwh": _r(can, 0), "inverso_mwh": _r(inv, 0),
            "contra_saldo_mwh": _r(min(can, inv), 0),
            "contra_saldo_dias_mwh": _r(sum(x["contra_saldo_mwh"] for x in ds), 0),
            "dias_com_reversao": sum(1 for x in ds if x["reversoes"] > 0),
            "dias_com_os_dois_sentidos": sum(1 for x in ds if x["horas_canonico"] > 0 and x["horas_inverso"] > 0),
            "horas_canonico": sum(x["horas_canonico"] for x in ds), "horas_inverso": sum(x["horas_inverso"] for x in ds),
            "horas_pld": sum(x["horas_pld"] for x in ds), "horas_precos_separados": sum(x["horas_precos_separados"] for x in ds),
            "horas_separados_fluxo_para_mais_caro": sum(x["horas_separados_fluxo_para_mais_caro"] for x in ds),
            "horas_separados_fluxo_para_mais_barato": sum(x["horas_separados_fluxo_para_mais_barato"] for x in ds),
        })

    # mensal (histórico desde 2021)
    mensal = defaultdict(lambda: defaultdict(float))
    for p in PARES:
        for dia, rz in diario[p].items():
            m = mensal[(dia[:7], p)]
            for k in ("canonico_mwh", "inverso_mwh", "contra_saldo_mwh"):
                m[k] += rz[k]
            m["horas"] += rz["horas"]
            m["horas_inverso"] += rz["horas_inverso"]
            m["horas_canonico"] += rz["horas_canonico"]
            m["dias_com_reversao"] += 1 if rz["reversoes"] > 0 else 0
            m["horas_precos_separados"] += rz["horas_precos_separados"]
            m["horas_pld"] += rz["horas_pld"]
    meses = sorted({m for m, _ in mensal})
    mensal_gold = {"meses": meses, "horas_calendario": [horas_calendario(m) for m in meses], "por_par": {}}
    for p in PARES:
        col = {k: [] for k in ("liquido_mwh", "canonico_mwh", "inverso_mwh", "contra_saldo_dias_mwh", "horas",
                               "horas_inverso", "horas_precos_separados")}
        for m in meses:
            x = mensal.get((m, p))
            if not x:
                for k in col:
                    col[k].append(None)
                continue
            col["liquido_mwh"].append(_r(x["canonico_mwh"] - x["inverso_mwh"], 0))
            col["canonico_mwh"].append(_r(x["canonico_mwh"], 0))
            col["inverso_mwh"].append(_r(x["inverso_mwh"], 0))
            col["contra_saldo_dias_mwh"].append(_r(x["contra_saldo_mwh"], 0))
            for k in ("horas", "horas_inverso", "horas_precos_separados"):
                col[k].append(int(x[k]))
        mensal_gold["por_par"][p] = col

    # subsistemas: bruto × líquido, hora a hora
    sub_d = defaultdict(lambda: {"horas": 0, "exp": 0.0, "imp": 0.0, "transito": 0})
    for h in todas_horas:
        if h[:10] > dia_ref:
            continue
        fh = {p: fluxo[p].get(h) for p in PARES}
        eh = {p: ext[p].get(h) for p in PAISES}
        for sm in ons_rede.SUBSISTEMAS:
            partes = contribuicoes(sm, fh, eh)
            if partes is None:
                continue
            e_, i_, t_ = bruto_subsistema(partes)
            x = sub_d[(h[:10], sm)]
            x["horas"] += 1
            x["exp"] += e_
            x["imp"] += i_
            x["transito"] += 1 if t_ else 0
    base.escreve_csv("rede_subsistemas_diario.csv",
                     ["data", "sm", "horas", "exportacao_bruta_mwh", "importacao_bruta_mwh", "liquido_mwh", "horas_transito"],
                     [[d, sm, x["horas"], _r(x["exp"], 3), _r(x["imp"], 3), _r(x["exp"] - x["imp"], 3), x["transito"]]
                      for (d, sm), x in sorted(sub_d.items())])
    sub_gold = {"dias": ult, "por_sm": {sm: {
        "exportacao_bruta_mwh": [_r(sub_d[(d, sm)]["exp"], 0) if (d, sm) in sub_d else None for d in ult],
        "importacao_bruta_mwh": [_r(sub_d[(d, sm)]["imp"], 0) if (d, sm) in sub_d else None for d in ult],
        "liquido_mwh": [_r(sub_d[(d, sm)]["exp"] - sub_d[(d, sm)]["imp"], 0) if (d, sm) in sub_d else None for d in ult],
        "horas_transito": [sub_d[(d, sm)]["transito"] if (d, sm) in sub_d else None for d in ult],
    } for sm in ons_rede.SUBSISTEMAS}}
    sub_mensal = defaultdict(lambda: {"horas": 0, "exp": 0.0, "imp": 0.0, "transito": 0})
    for (d, sm), x in sub_d.items():
        y = sub_mensal[(d[:7], sm)]
        for k in ("horas", "exp", "imp", "transito"):
            y[k] += x[k]
    sub_mensal_gold = {"meses": meses, "por_sm": {sm: {
        "exportacao_bruta_mwh": [_r(sub_mensal[(m, sm)]["exp"], 0) if (m, sm) in sub_mensal else None for m in meses],
        "importacao_bruta_mwh": [_r(sub_mensal[(m, sm)]["imp"], 0) if (m, sm) in sub_mensal else None for m in meses],
        "horas": [sub_mensal[(m, sm)]["horas"] if (m, sm) in sub_mensal else None for m in meses],
        "horas_transito": [sub_mensal[(m, sm)]["transito"] if (m, sm) in sub_mensal else None for m in meses],
    } for sm in ons_rede.SUBSISTEMAS}}

    # janela horária (mapa e cursor): últimos DIAS_JANELA_HORARIA dias completos
    ini_j = (fim - timedelta(days=DIAS_JANELA_HORARIA - 1)).isoformat()
    hj = [h for d in c.dias(c.d(ini_j), fim) for h in horas_do_dia(d.isoformat())]
    janela = {
        "horas": hj,
        "fluxo": {p: [_r(fluxo[p].get(h), 1) for h in hj] for p in PARES},
        "programado": {p: [_r(prog[p].get(h), 1) for h in hj] for p in PARES},
        "exterior": {p: [_r(ext[p].get(h), 1) for h in hj] for p in PAISES_SUL},
        "pld": {sm: [c.r(pld[sm].get(h), 2) for h in hj] for sm in ons_rede.SUBSISTEMAS},
        # o saldo de cada subsistema na hora é a soma das fronteiras (identidade conferida em balanco.identidades);
        # a série do balanço fica em rede_horario_<ano>.csv (colunas saldo_*)
    }
    return {"diario": diario_gold, "resumo_30d": resumo, "mensal": mensal_gold, "subsistemas_diario": sub_gold,
            "subsistemas_mensal": sub_mensal_gold, "janela_horaria": janela, "_diario_completo": diario, "_sub_d": sub_d}


# ---------------------------------------------------------------------------
# P029: balanço e exterior
# ---------------------------------------------------------------------------

def _balanco(bal, fluxo, ext, con):
    horas = sorted(set(bal[("intercambio", "SIN")]) | set().union(*(set(bal[("intercambio", sm)]) for sm in ons_rede.SUBSISTEMAS)))
    ident = {k: {"horas": 0, "fecham": 0, "entre": 0, "residuo": 0, "faixas": {f: 0 for f in FAIXAS_RESIDUO}, "max_abs": 0.0, "max_em": None,
                 "horas_residuo_lista": []} for k in
             [f"balanco.{sm}" for sm in ons_rede.SUBSISTEMAS + ("SIN",)] + [f"perimetro.{sm}" for sm in ons_rede.SUBSISTEMAS + ("SIN",)]
             + ["soma_sin"]}
    mensal = defaultdict(lambda: defaultdict(float))
    residuos_csv = []

    def conta(chave, h, res):
        x = ident[chave]
        x["horas"] += 1
        if abs(res) <= TOL_IDENT:
            x["fecham"] += 1
            if abs(res) > 0.01 + 1e-6:
                x["entre"] += 1
            return
        x["residuo"] += 1
        for f in FAIXAS_RESIDUO:
            if abs(res) > f:
                x["faixas"][f] += 1
        if abs(res) > x["max_abs"]:
            x["max_abs"], x["max_em"] = abs(res), h
        x["horas_residuo_lista"].append(h)
        ident_nome, _, sm = chave.partition(".")
        residuos_csv.append([h, ident_nome, sm or "SIN", _r(res, 3)])

    for h in horas:
        fh = {p: fluxo[p].get(h) for p in PARES}
        eh = {p: ext[p].get(h) for p in PAISES}
        soma_sm = 0.0
        soma_ok = True
        for sm in ons_rede.SUBSISTEMAS + ("SIN",):
            parc = {k: bal[(k, sm)].get(h) for k in PARCELAS_BALANCO}
            m = mensal[(h[:7], sm)]
            m["horas"] += 1
            for k, v in parc.items():
                if v is not None:
                    m[f"{k}_mwh"] += v
            rb = residuo_balanco(parc)
            if rb is not None:
                m["horas_completas"] += 1
                m["residuo_balanco_mwh"] += rb
                if abs(rb) > TOL_IDENT:
                    m["horas_residuo_balanco"] += 1
                conta(f"balanco.{sm}", h, rb)
            ic = parc["intercambio"]
            if sm == "SIN":
                partes = [eh.get(p) for p in PAISES]
                partes = None if any(x is None for x in partes[:2]) else [x for x in partes if x is not None]
            else:
                partes = contribuicoes(sm, fh, eh)
                if ic is not None:
                    soma_sm += ic
                else:
                    soma_ok = False
            if ic is not None and partes is not None:
                rp = ic - sum(partes)
                m["fronteiras_exterior_mwh"] += sum(partes)
                m["residuo_perimetro_mwh"] += rp
                m["horas_perimetro"] += 1
                if abs(rp) > TOL_IDENT:
                    m["horas_residuo_perimetro"] += 1
                conta(f"perimetro.{sm}", h, rp)
        sin = bal[("intercambio", "SIN")].get(h)
        if soma_ok and sin is not None:
            conta("soma_sin", h, sin - soma_sm)

    residuos_csv.sort()
    base.escreve_csv("rede_balanco_residuos.csv", ["data_hora", "identidade", "sm", "residuo_mwmed"], residuos_csv)
    meses = sorted({m for m, _ in mensal})
    campos = ("geracao_mwh", "carga_mwh", "intercambio_mwh", "fronteiras_exterior_mwh", "residuo_balanco_mwh",
              "residuo_perimetro_mwh")
    linhas = []
    for m in meses:
        for sm in ons_rede.SUBSISTEMAS + ("SIN",):
            x = mensal.get((m, sm))
            if not x:
                continue
            linhas.append([m, sm, int(x["horas"]), int(x["horas_completas"])] + [_r(x[k], 3) if k in x else None for k in campos]
                          + [int(x["horas_residuo_balanco"]), int(x["horas_perimetro"]), int(x["horas_residuo_perimetro"])])
    base.escreve_csv("rede_balanco_mensal.csv",
                     ["mes", "sm", "horas", "horas_completas"] + list(campos) + ["horas_residuo_balanco", "horas_perimetro",
                                                                                 "horas_residuo_perimetro"], linhas)
    mensal_gold = {"meses": meses, "por_sm": {sm: {
        **{k: [_r(mensal[(m, sm)][k], 0) if (m, sm) in mensal and k in mensal[(m, sm)] else None for m in meses] for k in campos},
        "horas_completas": [int(mensal[(m, sm)]["horas_completas"]) if (m, sm) in mensal else None for m in meses],
        "horas_residuo_balanco": [int(mensal[(m, sm)]["horas_residuo_balanco"]) if (m, sm) in mensal else None for m in meses],
        "horas_residuo_perimetro": [int(mensal[(m, sm)]["horas_residuo_perimetro"]) if (m, sm) in mensal else None for m in meses],
    } for sm in ons_rede.SUBSISTEMAS + ("SIN",)}}

    identidades = []
    descr = {
        "balanco": "Geração (hidráulica + térmica + eólica + solar) − carga − intercâmbio, no mesmo balanço do ONS",
        "perimetro": "Intercâmbio do balanço − soma das fronteiras do conjunto de intercâmbio (no Sul, mais Argentina e Uruguai; no SIN, o intercâmbio internacional)",
        "soma_sin": "Intercâmbio do SIN − soma dos intercâmbios dos quatro subsistemas, no mesmo balanço",
    }
    for chave, x in ident.items():
        nome, _, sm = chave.partition(".")
        periodos = runs(x["horas_residuo_lista"])
        identidades.append({
            "id": chave, "identidade": nome, "sm": sm or "SIN", "descricao": descr[nome], "horas": x["horas"],
            "horas_fecham": x["fecham"], "horas_entre_0_01_e_tolerancia": x["entre"], "horas_residuo": x["residuo"],
            "horas_acima": {f"{int(f)}": n for f, n in x["faixas"].items()},
            "maior_residuo_mwmed": _r(x["max_abs"], 3) if x["residuo"] else None, "maior_residuo_em": x["max_em"],
            "periodos": [{"inicio": a, "fim": b, "horas": n} for a, b, n in sorted(periodos, key=lambda t: -t[2])[:12]],
            "n_periodos": len(periodos),
            "primeira_hora_residuo": x["horas_residuo_lista"][0] if x["horas_residuo_lista"] else None,
            "ultima_hora_residuo": x["horas_residuo_lista"][-1] if x["horas_residuo_lista"] else None,
        })
    return {"tolerancia_mwmed": TOL_IDENT, "faixas_mwmed": list(FAIXAS_RESIDUO), "identidades": identidades,
            "mensal": mensal_gold, "_ident": ident}


def _exterior(ext, prog_ext, con, dia_ref):
    ita = {k: _serie(con, DS_ITA, k, f"{ANO_INICIAL}-01-01") for k in ("total", "brasil")}
    mensal = defaultdict(lambda: defaultdict(float))
    for p in PAISES:
        for h, v in ext[p].items():
            if h[:10] > dia_ref:
                continue
            m = mensal[(h[:7], p)]
            m["horas"] += 1
            m["exportacao_mwh"] += max(v, 0.0)
            m["importacao_mwh"] += max(-v, 0.0)
            m["horas_com_fluxo"] += 1 if abs(v) > NULO else 0
            g = prog_ext[p].get(h)
            if g is not None:
                m["programado_liquido_mwh"] += g
                m["horas_programado"] += 1
    for h, v in ita["total"].items():
        if h[:10] > dia_ref:
            continue
        br = ita["brasil"].get(h)
        m = mensal[(h[:7], "ITAIPU")]
        m["horas"] += 1
        m["total_mwh"] += v
        if br is not None:
            m["brasil_mwh"] += br
            m["nao_brasil_mwh"] += v - br
            m["horas_brasil"] += 1
    meses = sorted({m for m, _ in mensal})
    linhas = []
    for m in meses:
        for p in PAISES + ("ITAIPU",):
            x = mensal.get((m, p))
            if not x:
                continue
            if p == "ITAIPU":
                linhas.append([m, p, int(x["horas"]), None, None, None, None, None, _r(x["total_mwh"], 3),
                               _r(x["brasil_mwh"], 3) if x["horas_brasil"] else None,
                               _r(x["nao_brasil_mwh"], 3) if x["horas_brasil"] else None])
            else:
                linhas.append([m, p, int(x["horas"]), _r(x["exportacao_mwh"], 3), _r(x["importacao_mwh"], 3),
                               _r(x["exportacao_mwh"] - x["importacao_mwh"], 3), int(x["horas_com_fluxo"]),
                               _r(x["programado_liquido_mwh"], 3) if x["horas_programado"] else None, None, None, None])
    base.escreve_csv("rede_exterior_mensal.csv", ["mes", "pais", "horas", "exportacao_mwh", "importacao_mwh", "liquido_mwh",
                                                  "horas_com_fluxo", "programado_liquido_mwh", "total_mwh", "brasil_mwh",
                                                  "nao_brasil_mwh"], linhas)
    por_pais = {}
    for p in PAISES:
        por_pais[p] = {
            "exportacao_mwh": [_r(mensal[(m, p)]["exportacao_mwh"], 0) if (m, p) in mensal else None for m in meses],
            "importacao_mwh": [_r(mensal[(m, p)]["importacao_mwh"], 0) if (m, p) in mensal else None for m in meses],
            "horas": [int(mensal[(m, p)]["horas"]) if (m, p) in mensal else None for m in meses],
            "horas_com_fluxo": [int(mensal[(m, p)]["horas_com_fluxo"]) if (m, p) in mensal else None for m in meses],
            "programado_liquido_mwh": [_r(mensal[(m, p)]["programado_liquido_mwh"], 0)
                                       if (m, p) in mensal and mensal[(m, p)]["horas_programado"] else None for m in meses],
        }
        ult = [h for h in ext[p] if h[:10] <= dia_ref]
        por_pais[p]["ultima_hora"] = max(ult) if ult else None
        nz = [h for h in ult if abs(ext[p][h]) > NULO]
        por_pais[p]["ultima_hora_com_fluxo"] = max(nz) if nz else None
    itaipu = {
        "total_mwh": [_r(mensal[(m, "ITAIPU")]["total_mwh"], 0) if (m, "ITAIPU") in mensal else None for m in meses],
        "brasil_mwh": [_r(mensal[(m, "ITAIPU")]["brasil_mwh"], 0) if (m, "ITAIPU") in mensal and mensal[(m, "ITAIPU")]["horas_brasil"] else None for m in meses],
        "nao_brasil_mwh": [_r(mensal[(m, "ITAIPU")]["nao_brasil_mwh"], 0) if (m, "ITAIPU") in mensal and mensal[(m, "ITAIPU")]["horas_brasil"] else None for m in meses],
        "horas": [int(mensal[(m, "ITAIPU")]["horas"]) if (m, "ITAIPU") in mensal else None for m in meses],
    }
    esq_ita = _esquemas(con, DS_ITA)
    rel_ita = next(iter(esq_ita.values()), {})
    # 12 meses completos até o mês anterior ao do dia de referência
    mref = dia_ref[:7]
    m12 = [m for m in meses if m < mref][-12:]
    resumo = {p: {"meses": [m12[0], m12[-1]] if m12 else None,
                  "exportacao_mwh": _r(sum(mensal[(m, p)]["exportacao_mwh"] for m in m12 if (m, p) in mensal), 0),
                  "importacao_mwh": _r(sum(mensal[(m, p)]["importacao_mwh"] for m in m12 if (m, p) in mensal), 0),
                  "horas_com_fluxo": int(sum(mensal[(m, p)]["horas_com_fluxo"] for m in m12 if (m, p) in mensal)),
                  "horas": int(sum(mensal[(m, p)]["horas"] for m in m12 if (m, p) in mensal))} for p in PAISES}
    return {"meses": meses, "por_pais": por_pais, "itaipu": itaipu, "resumo_12m": resumo,
            "itaipu_identidades": {"linhas": rel_ita.get("linhas_no_periodo"),
                                   "total_diferente_de_60_mais_50": rel_ita.get("identidade_total_falhas"),
                                   "brasil_diferente_de_60_mais_50_brasil": rel_ita.get("identidade_brasil_falhas")},
            "_mensal": mensal, "_m12": m12}


# ---------------------------------------------------------------------------
# P030: restrições publicadas (ATLS, interrupções) e busca dos limites (A06)
# ---------------------------------------------------------------------------

def _documentos(con):
    regs = base.registros_como_estavam_em(con, DS_DOC)
    vig = ckan.vintages_vigentes(con, DS_DOC)
    out = {}
    for doc_id, doc in DOCUMENTOS.items():
        v = vig.get(doc_id)
        r = regs.get(doc_id, {})
        trechos = []
        for tid, passagem in doc["trechos"]:
            t = regs.get(f"{doc_id}:{tid}", {})
            conf = t.get("confere")
            trechos.append({"id": tid, "texto": passagem, "confere": None if conf in (None, "") else conf == "1"})
        out[doc_id] = {"titulo": doc["titulo"], "url": doc["url"], "licenca": LICENCA_DOC_ONS,
                       "capturado_em": v["capturado_em"] if v else None, "sha256": v["sha256"] if v else None,
                       "arquivo": v["arquivo"] if v else None, "extracao": r.get("extracao"), "trechos": trechos}
    return out


def _dicionarios(con):
    regs = base.registros_como_estavam_em(con, DS_DIC)
    vig = ckan.vintages_vigentes(con, DS_DIC)
    out = {}
    for ds in CONJUNTOS:
        v = vig.get(ds)
        r = regs.get(ds, {})
        trechos = []
        for tid, passagem in TRECHOS_DICIONARIO.get(ds, []):
            t = regs.get(f"{ds}:{tid}", {})
            conf = t.get("confere")
            trechos.append({"id": tid, "texto": passagem, "confere": None if conf in (None, "") else conf == "1"})
        out[ds] = {"conjunto": CONJUNTOS[ds]["titulo"], "url": v["url"] if v else None,
                   "capturado_em": v["capturado_em"] if v else None, "sha256": v["sha256"] if v else None,
                   "data_documento": r.get("data_documento"),
                   "menciona_sinal": None if r.get("menciona_sinal") in (None, "") else r.get("menciona_sinal") == "1",
                   "versoes": json.loads(r["versoes"]) if r.get("versoes") else [],
                   "permissoes": json.loads(r["permissoes"]) if r.get("permissoes") else {},
                   "trechos": trechos}
    return out


def _restricoes(con, hoje):
    docs = _documentos(con)
    # --- ATLS
    esq = next(iter(_esquemas(con, DS_ATLS).values()), {})
    fluxos = sorted((esq.get("fluxos") or {}).keys())
    atls_rows, por_fluxo = [], []
    for fl in fluxos:
        me = {m: v for m, v in base.serie_vigente(con, DS_ATLS, f"atls.{fl}.ME")}
        hv = {m: v for m, v in base.serie_vigente(con, DS_ATLS, f"horas_violacao.{fl}.ME")}
        an = {m: v for m, v in base.serie_vigente(con, DS_ATLS, f"atls.{fl}.AN")}
        hva = {m: v for m, v in base.serie_vigente(con, DS_ATLS, f"horas_violacao.{fl}.AN")}
        meses = sorted(set(me) | set(hv))
        acum_ok = acum_n = 0
        for m in meses:
            b = atls_horas_implicitas(me.get(m), hv.get(m))
            atls_rows.append([fl, "ME", m, me.get(m), hv.get(m), _r(b, 3), horas_calendario(m)])
            # AN (acumulado no ano até o mês) contra a soma das horas mensais do mesmo ano: conferência pela própria fonte
            if m in hva:
                soma = sum(hv.get(f"{m[:4]}-{k:02d}", 0.0) for k in range(1, int(m[5:7]) + 1))
                acum_n += 1
                acum_ok += 1 if abs(soma - hva[m]) <= 0.01 else 0
        for m in sorted(an):
            atls_rows.append([fl, "AN", m, an.get(m), hva.get(m), _r(atls_horas_implicitas(an.get(m), hva.get(m)), 3), None])
        # período de observação implícito diferente das horas do calendário em mais de meia hora
        # (nos dados atuais, sempre exatamente uma hora: fevereiros com uma a mais, outubros e
        # novembros com uma a menos); registrado, sem causa atribuída
        denom_dif = [m for m in meses if atls_horas_implicitas(me.get(m), hv.get(m)) is not None
                     and abs(atls_horas_implicitas(me[m], hv[m]) - horas_calendario(m)) > 0.5]
        atls1_com_horas = [m for m in meses if me.get(m) is not None and me[m] >= 1 and (hv.get(m) or 0) > 0]
        ult12 = meses[-12:]
        d = DEFINICOES_ATLS.get(fl)
        conf = None
        if d:
            t = next((t for t in docs[d[1]]["trechos"] if t["id"] == fl), None)
            conf = t["confere"] if t else None
        por_fluxo.append({
            "fluxo": fl, "definicao": d[0] if d and conf else None, "documento_definicao": d[1] if d and conf else None,
            "inicio": meses[0] if meses else None, "fim": meses[-1] if meses else None, "meses": len(meses),
            "meses_com_violacao": sum(1 for m in meses if (hv.get(m) or 0) > 0),
            "horas_violacao_total": _r(sum(hv.get(m) or 0 for m in meses), 2),
            "ultimos_12_meses": {"inicio": ult12[0], "fim": ult12[-1], "horas_violacao": _r(sum(hv.get(m) or 0 for m in ult12), 2),
                                 "meses_com_violacao": sum(1 for m in ult12 if (hv.get(m) or 0) > 0)} if ult12 else None,
            "ativo": None,
            # série mensal na gold desde o ano inicial do módulo; o histórico inteiro fica em rede_atls.csv
            # (o ATLS em fração é 1 − horas ÷ período e fica no CSV, com o período implícito)
            "serie": {"meses": [m for m in meses if m >= f"{ANO_INICIAL}-01"],
                      "horas_violacao": [_r(hv.get(m), 3) for m in meses if m >= f"{ANO_INICIAL}-01"]},
            "conferencias": {"acumulado_anual_confere": acum_ok, "acumulado_anual_meses": acum_n,
                             "meses_denominador_diferente_do_calendario": denom_dif,
                             "meses_atls_1_com_horas": atls1_com_horas},
        })
    ultimo_mes = max((f["fim"] for f in por_fluxo if f["fim"]), default=None)
    for f in por_fluxo:
        f["ativo"] = f["fim"] == ultimo_mes
    atls_rows.sort(key=lambda r: (r[0], r[1], r[2]))
    base.escreve_csv("rede_atls.csv", ["fluxo", "periodicidade", "mes", "atls", "horas_violacao", "horas_periodo_implicitas",
                                       "horas_calendario"], atls_rows)

    # --- interrupções de carga
    regs = base.registros_como_estavam_em(con, DS_IC)
    eventos = []
    for ch, campos in regs.items():
        if ch.startswith("_") or campos.get("presente") != "1":
            continue
        e = {k: campos.get(k) for k in ons_rede.CAMPOS_INTERRUPCAO}
        for k in ("val_cargainterrompida_mw", "val_tempomedio_minutos", "val_energianaosuprida_mwh"):
            e[k] = float(e[k]) if e.get(k) not in (None, "") else None
        e["chave"] = ch
        eventos.append(e)
    eventos.sort(key=lambda e: (e["din_interrupcaocarga"], e["chave"]))
    rel_ic = json.loads(regs.get("_arquivo", {}).get("esquema") or "{}")
    inteiras = defaultdict(int)
    for e in eventos:
        inteiras[tuple(e[k] for k in ons_rede.CAMPOS_INTERRUPCAO)] += 1
    base.escreve_csv("rede_interrupcoes_carga.csv",
                     ["chave", "cod_perturbacao", "instante", "sm", "uf", "agente", "carga_interrompida_mw", "tempo_medio_min",
                      "energia_nao_suprida_mwh", "rede_basica", "rede_operacao", "repetida"],
                     [[e["chave"], e["cod_perturbacao"], e["din_interrupcaocarga"], e["id_subsistema"], e["id_estado"],
                       e["nom_agente"], e["val_cargainterrompida_mw"], e["val_tempomedio_minutos"],
                       _r(e["val_energianaosuprida_mwh"], 4), e["flg_envolveuredebasica"], e["flg_envolveuredeoperacao"],
                       1 if inteiras[tuple(e[k] for k in ons_rede.CAMPOS_INTERRUPCAO)] > 1 else 0] for e in eventos])
    anual = defaultdict(lambda: {"registros": 0, "perturbacoes": set(), "ens_mwh": 0.0, "registros_rede_basica": 0,
                                 "ens_rede_basica_mwh": 0.0, "registros_100mw": 0})
    for e in eventos:
        for chave in ((e["din_interrupcaocarga"][:4], "SIN"), (e["din_interrupcaocarga"][:4], e["id_subsistema"])):
            x = anual[chave]
            x["registros"] += 1
            x["perturbacoes"].add(e["cod_perturbacao"])
            x["ens_mwh"] += e["val_energianaosuprida_mwh"] or 0.0
            if e["flg_envolveuredebasica"] == "S":
                x["registros_rede_basica"] += 1
                x["ens_rede_basica_mwh"] += e["val_energianaosuprida_mwh"] or 0.0
            if (e["val_cargainterrompida_mw"] or 0) >= 100:
                x["registros_100mw"] += 1
    anos = sorted({a for a, _ in anual})
    ano_corrente = str(hoje.year)
    anual_gold = {"anos": anos, "parcial": [a == ano_corrente for a in anos], "por_sm": {sm: {
        "registros": [anual[(a, sm)]["registros"] if (a, sm) in anual else 0 for a in anos],
        "perturbacoes": [len(anual[(a, sm)]["perturbacoes"]) if (a, sm) in anual else 0 for a in anos],
        "ens_mwh": [_r(anual[(a, sm)]["ens_mwh"], 1) if (a, sm) in anual else 0 for a in anos],
        "registros_rede_basica": [anual[(a, sm)]["registros_rede_basica"] if (a, sm) in anual else 0 for a in anos],
        "ens_rede_basica_mwh": [_r(anual[(a, sm)]["ens_rede_basica_mwh"], 1) if (a, sm) in anual else 0 for a in anos],
        "registros_100mw": [anual[(a, sm)]["registros_100mw"] if (a, sm) in anual else 0 for a in anos],
    } for sm in ("SIN",) + ons_rede.SUBSISTEMAS}}
    # perturbações: soma dos registros de uma mesma perturbação (a fonte publica um registro por agente e UF)
    pert = defaultdict(lambda: {"registros": 0, "ens_mwh": 0.0, "carga_mw": 0.0, "ufs": set(), "sms": set(), "inicio": None,
                                "rede_basica": False})
    for e in eventos:
        x = pert[e["cod_perturbacao"]]
        x["registros"] += 1
        x["ens_mwh"] += e["val_energianaosuprida_mwh"] or 0.0
        x["carga_mw"] += e["val_cargainterrompida_mw"] or 0.0
        x["ufs"].add(e["id_estado"])
        x["sms"].add(e["id_subsistema"])
        x["inicio"] = e["din_interrupcaocarga"] if x["inicio"] is None else min(x["inicio"], e["din_interrupcaocarga"])
        x["rede_basica"] = x["rede_basica"] or e["flg_envolveuredebasica"] == "S"

    def _pert(cod, x):
        return {"cod_perturbacao": cod, "inicio": x["inicio"], "registros": x["registros"], "ens_mwh": _r(x["ens_mwh"], 1),
                "carga_interrompida_mw_soma": _r(x["carga_mw"], 1), "ufs": sorted(x["ufs"]), "subsistemas": sorted(x["sms"]),
                "rede_basica": x["rede_basica"]}
    maiores = [_pert(k, x) for k, x in sorted(pert.items(), key=lambda kv: -kv[1]["ens_mwh"])[:15]]
    recentes = [_pert(k, x) for k, x in sorted(pert.items(), key=lambda kv: kv[1]["inicio"], reverse=True)[:15]]
    fim12 = max((e["din_interrupcaocarga"][:10] for e in eventos), default=None)
    ini12 = (c.d(fim12) - timedelta(days=364)).isoformat() if fim12 else None
    ev12 = [e for e in eventos if fim12 and ini12 <= e["din_interrupcaocarga"][:10] <= fim12]
    resumo12 = {"inicio": ini12, "fim": fim12, "registros": len(ev12), "perturbacoes": len({e["cod_perturbacao"] for e in ev12}),
                "ens_mwh": _r(sum(e["val_energianaosuprida_mwh"] or 0 for e in ev12), 1),
                "registros_rede_basica": sum(1 for e in ev12 if e["flg_envolveuredebasica"] == "S"),
                "_ens": sum(e["val_energianaosuprida_mwh"] or 0 for e in ev12), "_n": len(ev12)}
    interrupcoes = {
        "registros": len(eventos), "perturbacoes": len(pert),
        "inicio": eventos[0]["din_interrupcaocarga"] if eventos else None, "fim": eventos[-1]["din_interrupcaocarga"] if eventos else None,
        "registros_abaixo_de_100mw": sum(1 for e in eventos if (e["val_cargainterrompida_mw"] or 0) < 100),
        "linhas_repetidas": rel_ic.get("linhas_repetidas"),
        "anual": anual_gold, "maiores_perturbacoes": maiores, "perturbacoes_recentes": recentes, "ultimos_12_meses": resumo12,
    }
    return {
        "limites": {"integrados": False, "busca": BUSCA_LIMITES,
                    "conclusao": ("Não há recurso público estruturado com os limites operativos de intercâmbio e suas vigências. "
                                  "O painel responde quando há evidência publicada de limitação: horas em que fluxos sistêmicos "
                                  "ficaram acima do limite estabelecido (ATLS) e perturbações com corte de carga. Nenhum "
                                  "percentual de utilização é calculado.")},
        "documentos": docs,
        "atls": {"fluxos": por_fluxo, "ultimo_mes": ultimo_mes,
                 "unidade_publicada": "fração de 0 a 1 (o dicionário diz %)", "maior_valor_lido": esq.get("maior_atls"),
                 "menor_valor_lido": esq.get("menor_atls")},
        "interrupcoes": interrupcoes,
        "_eventos": eventos,
    }


# ---------------------------------------------------------------------------
# P031: programado versus verificado
# ---------------------------------------------------------------------------

def _programado(fluxo, prog, ext, prog_ext, con, dia_ref):
    series = {p: (prog[p], fluxo[p]) for p in PARES}
    series.update({p: (prog_ext[p], ext[p]) for p in PAISES_SUL})
    linhas_h, por_dia, dist = [], defaultdict(dict), {}
    inicio = None
    for p, (pg, vf) in series.items():
        hs = sorted(h for h in pg if h in vf and h[:10] <= dia_ref)
        if not hs:
            continue
        inicio = hs[0] if inicio is None else min(inicio, hs[0])
        desvios = []
        for h in hs:
            d = vf[h] - pg[h]
            desvios.append(d)
            linhas_h.append([h, p, _r(pg[h], 3), _r(vf[h], 3), _r(d, 3), 1 if material(d) else 0, 1 if inversao(pg[h], vf[h]) else 0])
            x = por_dia[p].setdefault(h[:10], {"horas": 0, "prog": 0.0, "verif": 0.0, "desvio": 0.0, "abs": 0.0, "mat": 0,
                                                "inv": 0, "maior": None, "hora_maior": None})
            x["horas"] += 1
            x["prog"] += pg[h]
            x["verif"] += vf[h]
            x["desvio"] += d
            x["abs"] += abs(d)
            x["mat"] += 1 if material(d) else 0
            x["inv"] += 1 if inversao(pg[h], vf[h]) else 0
            if x["maior"] is None or abs(d) > abs(x["maior"]):
                x["maior"], x["hora_maior"] = d, h
        ab = [abs(d) for d in desvios]
        dist[p] = {"horas": len(hs), "inicio": hs[0], "fim": hs[-1], "vies_mwmed": _r(sum(desvios) / len(hs), 1),
                   "desvio_abs_medio_mwmed": _r(sum(ab) / len(hs), 1), "p50_abs_mwmed": _r(c.quantil(ab, 0.5), 1),
                   "p90_abs_mwmed": _r(c.quantil(ab, 0.9), 1), "p99_abs_mwmed": _r(c.quantil(ab, 0.99), 1),
                   "max_abs_mwmed": _r(max(ab), 1),
                   "horas_materiais": {f"{int(l)}": sum(1 for d in desvios if material(d, l)) for l in LIMIARES_SENSIBILIDADE},
                   "horas_inversao": sum(1 for h in hs if inversao(pg[h], vf[h])),
                   "programado_abs_mediano_mwmed": _r(c.quantil([abs(pg[h]) for h in hs], 0.5), 1),
                   "_desvios": desvios}
    linhas_h.sort()
    base.escreve_csv("rede_programado_horario.csv", ["data_hora", "par", "programado_mwmed", "verificado_mwmed", "desvio_mwmed",
                                                     "material", "inversao"], linhas_h)
    linhas_d = []
    for p in series:
        for d, x in sorted(por_dia[p].items()):
            linhas_d.append([d, p, x["horas"], _r(x["prog"], 3), _r(x["verif"], 3), _r(x["desvio"], 3), _r(x["abs"], 3), x["mat"],
                             x["inv"], _r(x["maior"], 3), x["hora_maior"]])
    linhas_d.sort()
    base.escreve_csv("rede_programado_diario.csv", ["data", "par", "horas", "programado_mwh", "verificado_mwh", "desvio_mwh",
                                                    "desvio_abs_mwh", "horas_materiais", "horas_inversao", "maior_desvio_mwmed",
                                                    "hora_maior_desvio"], linhas_d)
    fim = c.d(dia_ref)
    ult = [(fim - timedelta(days=i)).isoformat() for i in range(DIAS_DIARIO - 1, -1, -1)]
    diario = {"dias": ult, "por_par": {p: {
        "programado_mwh": [_r(por_dia[p][d]["prog"], 0) if d in por_dia[p] else None for d in ult],
        "verificado_mwh": [_r(por_dia[p][d]["verif"], 0) if d in por_dia[p] else None for d in ult],
        "desvio_abs_mwh": [_r(por_dia[p][d]["abs"], 0) if d in por_dia[p] else None for d in ult],
        "horas_materiais": [por_dia[p][d]["mat"] if d in por_dia[p] else None for d in ult],
        "horas_inversao": [por_dia[p][d]["inv"] if d in por_dia[p] else None for d in ult],
    } for p in series}}
    # mensal
    mensal = defaultdict(lambda: {"horas": 0, "prog": 0.0, "verif": 0.0, "abs": 0.0, "mat": 0, "inv": 0})
    for p in series:
        for d, x in por_dia[p].items():
            y = mensal[(d[:7], p)]
            for k in ("horas", "prog", "verif", "abs", "mat", "inv"):
                y[k] += x[k]
    meses = sorted({m for m, _ in mensal})
    mensal_gold = {"meses": meses, "por_par": {p: {
        "horas": [mensal[(m, p)]["horas"] if (m, p) in mensal else None for m in meses],
        "programado_mwh": [_r(mensal[(m, p)]["prog"], 0) if (m, p) in mensal else None for m in meses],
        "verificado_mwh": [_r(mensal[(m, p)]["verif"], 0) if (m, p) in mensal else None for m in meses],
        "desvio_abs_mwh": [_r(mensal[(m, p)]["abs"], 0) if (m, p) in mensal else None for m in meses],
        "horas_materiais": [mensal[(m, p)]["mat"] if (m, p) in mensal else None for m in meses],
        "horas_inversao": [mensal[(m, p)]["inv"] if (m, p) in mensal else None for m in meses],
    } for p in series}}
    # maiores desvios (horas), com o contexto necessário para não chamar de falha
    maiores = sorted(linhas_h, key=lambda r: -abs(r[4]))[:15]
    maiores_gold = [{"hora": r[0], "par": r[1], "programado_mwmed": _r(r[2], 1), "verificado_mwmed": _r(r[3], 1),
                     "desvio_mwmed": _r(r[4], 1), "inversao": bool(r[6])} for r in maiores]
    # conferência da versão do programa: intercâmbio internacional programado × PDO das conversoras
    pdo = _conferencia_pdo(con, prog_ext)
    revis = c.revisoes_do_dataset(con, DS_IN)
    revis_prog = sum(1 for e in con.execute(
        "SELECT serie, ref FROM observacoes WHERE dataset=? AND serie LIKE 'programado.%' GROUP BY serie, ref HAVING COUNT(DISTINCT valor) > 1",
        (DS_IN,)))
    medianas = {p: x["p50_abs_mwmed"] for p, x in dist.items() if p in PARES}
    abaixo = [p for p, m in medianas.items() if m is not None and m < LIMIAR_MATERIAL]
    justificativa = (
        f"Nas fronteiras entre subsistemas, o desvio horário mediano vai de {_fmt(min(medianas.values()))} a "
        f"{_fmt(max(medianas.values()))} MWmed; o limiar de {_fmt(LIMIAR_MATERIAL)} MWmed fica acima da mediana em "
        f"{len(abaixo)} de {len(medianas)} fronteiras e marca as horas com desvio acima do habitual. É uma escolha do "
        "observatório, não um critério do ONS."
        if medianas else None)
    return {
        "inicio": inicio, "fim": dia_ref, "limiar_material_mwmed": LIMIAR_MATERIAL, "justificativa_limiar": justificativa,
        "limiares_sensibilidade_mwmed": list(LIMIARES_SENSIBILIDADE),
        "distribuicao": {p: {k: v for k, v in x.items() if not k.startswith("_")} for p, x in dist.items()},
        "diario": diario, "mensal": mensal_gold, "maiores_desvios": maiores_gold,
        "versao_programa": {
            "identificada_pela_fonte": False,
            "texto": ("O conjunto publica um único valor programado por hora, sem identificar a revisão do programa. Para o "
                      "exterior, o valor coincide com o Programa Diário da Operação (PDO) das conversoras, publicado no conjunto "
                      "de elementos de fluxo controlado, em todos os dias da amostra conferida; para as fronteiras entre "
                      "subsistemas não há programa por fronteira em outro conjunto público para a mesma conferência."),
            "conferencia_pdo": {k: v for k, v in pdo.items() if not k.startswith("_")},
            "revisoes_do_programado_entre_capturas": revis_prog,
            "capturas_comparadas": revis.get("vintages_comparadas"),
        },
        "_dist": dist, "_pdo": pdo,
    }


def _conferencia_pdo(con, prog_ext):
    """Compara, hora a hora, o intercâmbio internacional programado com o PDO das conversoras
    do mesmo país nos dias da amostra (−média das duas meias horas; no PDO a importação vem
    com sinal positivo, o oposto do conjunto de intercâmbio: conferido nos dias com fluxo)."""
    vig = ckan.vintages_vigentes(con, DS_PDO)
    esq = _esquemas(con, DS_PDO)
    linhas, dias, horas, ok, horas_nao_nulas, ok_nao_nulas = [], [], 0, 0, 0, 0
    series = {el: dict(base.serie_vigente(con, DS_PDO, f"pdo.{el}")) for el in ons_rede.CONVERSORAS_PDO}
    for rec in sorted(vig):
        rel = esq.get(rec) or {}
        dia = rel.get("dia")
        if not dia or rel.get("patamares") != 48:
            continue
        dias.append(dia)
        for hh in range(24):
            h = f"{dia}T{hh:02d}:00"
            for pais in PAISES_SUL:
                g = prog_ext[pais].get(h)
                if g is None:
                    continue
                meias = []
                for el, p_ in ons_rede.CONVERSORAS_PDO.items():
                    if p_ != pais:
                        continue
                    a, b = series[el].get(f"{dia}T{hh:02d}:00"), series[el].get(f"{dia}T{hh:02d}:30")
                    if a is None or b is None:
                        meias = None
                        break
                    meias.append((a + b) / 2)
                if meias is None:
                    continue
                pdo = -sum(meias)
                dif = g - pdo
                conf = abs(dif) <= 0.5
                horas += 1
                ok += conf
                if abs(g) > NULO or abs(pdo) > NULO:
                    horas_nao_nulas += 1
                    ok_nao_nulas += conf
                linhas.append([h, pais, _r(g, 3), _r(pdo, 3), _r(dif, 3), 1 if conf else 0])
    linhas.sort()
    base.escreve_csv("rede_pdo_conferencia.csv", ["data_hora", "pais", "programado_conjunto_mwmed", "pdo_mwmed", "diferenca_mwmed",
                                                  "confere"], linhas)
    return {"dias": len(dias), "primeiro_dia": dias[0] if dias else None, "ultimo_dia": dias[-1] if dias else None,
            "horas": horas, "horas_conferem": ok, "horas_com_programa_ou_pdo": horas_nao_nulas,
            "horas_com_programa_ou_pdo_conferem": ok_nao_nulas, "tolerancia_mwmed": 0.5,
            "amostra": ("últimos 30 dias publicados e dias 1 e 15 de cada mês desde janeiro de 2026"),
            "_linhas": linhas}


# ---------------------------------------------------------------------------
# Conferência com o silver principal (outro coletor, outro código) e esquema
# ---------------------------------------------------------------------------

def _conferencia_principal(con, con_p, fluxo, bal):
    """Compara as séries relidas aqui com as do silver principal (fontes/ons.py), hora a
    hora. Onde o arquivo é o mesmo (mesmo sha256 nas duas capturas), a diferença tem de
    ser nula: são dois parsers lendo o mesmo arquivo. Onde o arquivo mudou entre as
    capturas, a diferença é revisão do ONS e é contada como tal."""
    if con_p is None:
        return None
    out = {}
    for ds_meu, ds_p, pref in ((DS_IN, DS_INT_PRINCIPAL, "INTERCAMBIO_NACIONAL_"), (DS_BAL, DS_BAL_PRINCIPAL, "BALANCO_ENERGIA_SUBSISTEMA_")):
        meus = ckan.vintages_vigentes(con, ds_meu)
        deles = ckan.vintages_vigentes(con_p, ds_p)
        mesmos = sorted(r for r in meus if r in deles and meus[r]["sha256"] == deles[r]["sha256"])
        anos_mesmos = {r[len(pref):] for r in mesmos}
        comparadas = iguais = difs_mesmo = difs_revisao = 0
        exemplo = None
        if ds_meu == DS_IN:
            pares_series = [(fluxo[p], dict(base.serie_vigente(con_p, ds_p, f"fluxo.{p}"))) for p in PARES]
        else:
            pares_series = [(bal[("intercambio", sm)], dict(base.serie_vigente(con_p, ds_p, f"intercambio.{sm}")))
                            for sm in ons_rede.SUBSISTEMAS + ("SIN",)]
        for meu, delas in pares_series:
            for h, v in delas.items():
                w = meu.get(h)
                if w is None:
                    continue
                comparadas += 1
                if abs(v - w) <= 1e-6:
                    iguais += 1
                elif h[:4] in anos_mesmos:
                    difs_mesmo += 1
                    exemplo = exemplo or (h, v, w)
                else:
                    difs_revisao += 1
        out[ds_meu] = {"arquivos_identicos": mesmos, "horas_comparadas": comparadas, "iguais": iguais,
                       "diferentes_no_mesmo_arquivo": difs_mesmo, "diferentes_por_revisao": difs_revisao,
                       "exemplo_divergencia": exemplo,
                       "captura_principal": max((v["capturado_em"] for v in deles.values()), default=None),
                       "captura_modulo": max((v["capturado_em"] for v in meus.values()), default=None)}
    return out


def _resumo_esquema(esq_in, esq_ii, esq_bal):
    arquivos = []
    for rec, e in sorted(esq_in.items()):
        ori = e.get("orientacoes") or {}
        sinais = e.get("sinais_verificado") or {}
        arquivos.append({"recurso": rec, "linhas": e.get("linhas"), "tem_programado": e.get("tem_programado"),
                         "orientacoes": ori, "verificado_negativo": sum(n for k, n in sinais.items() if k.endswith(":negativo")),
                         "verificado_zero": sum(n for k, n in sinais.items() if k.endswith(":zero")),
                         "orientacao_fixa": len(ori) == 4 and all(k.replace("->", "_") in PARES or k == "SE->S" for k in ori),
                         "primeira": e.get("primeira"), "ultima": e.get("ultima"), "conflitos": len(e.get("conflitos") or [])})
    internacional = [{"recurso": rec, "linhas": e.get("linhas"), "tem_programado": e.get("tem_programado"),
                      "paises": e.get("paises"), "primeira": e.get("primeira"), "ultima": e.get("ultima")}
                     for rec, e in sorted(esq_ii.items())]
    balanco = [{"recurso": rec, "linhas": e.get("linhas"), "nulos": e.get("nulos"), "subsistemas": e.get("subsistemas"),
                "primeira": e.get("primeira"), "ultima": e.get("ultima")} for rec, e in sorted(esq_bal.items())]
    return {"intercambio_nacional": arquivos, "intercambio_internacional": internacional, "balanco": balanco}


# ---------------------------------------------------------------------------
# Achados A05 e A06 e textos por regra
# ---------------------------------------------------------------------------

def diagnostico_perimetro_sul(horas, bal, fluxo, ext):
    """Nas horas em que o intercâmbio do Sul no balanço não fecha com a fronteira S→SE mais
    o exterior do conjunto internacional: em quantas o balanço é coerente consigo mesmo
    (SIN = Sul − fronteira S→SE, ou seja, o balanço usou outro valor de exterior), em
    quantas esse exterior do balanço é zero e em quais meses. Não atribui causa."""
    coerente = zero = menor = 0
    meses = set()
    for h in horas:
        sin, s_, sse = bal[("intercambio", "SIN")].get(h), bal[("intercambio", "S")].get(h), fluxo["S_SE"].get(h)
        ex = sum(ext[p].get(h) or 0.0 for p in PAISES_SUL)
        meses.add(h[:7])
        if None in (sin, s_, sse):
            continue
        if abs(sin - (s_ - sse)) <= TOL_IDENT:
            coerente += 1
            if abs(sin) <= TOL_IDENT and abs(ex) > TOL_IDENT:
                zero += 1
            elif abs(sin) < abs(ex):
                menor += 1
    return {"horas": len(horas), "balanco_coerente": coerente, "exterior_zero_no_balanco": zero,
            "exterior_menor_no_balanco": menor, "exterior_outro_no_balanco": coerente - zero - menor, "meses": sorted(meses)}


def _achados(balanco, esquema, restricoes, programado, con, ext, bal, fluxo):
    idm = {x["id"]: x for x in balanco["identidades"]}
    diag = diagnostico_perimetro_sul(balanco["_ident"]["perimetro.S"]["horas_residuo_lista"], bal, fluxo, ext)
    sul_fora = diag["exterior_zero_no_balanco"]
    py = ext.get("PARAGUAI") or {}
    py_nao_nulo = sum(1 for v in py.values() if abs(v) > NULO)
    py_periodo = (min(py), max(py)) if py else (None, None)
    per = {sm: idm[f"perimetro.{sm}"] for sm in ons_rede.SUBSISTEMAS + ("SIN",)}
    bl = {sm: idm[f"balanco.{sm}"] for sm in ons_rede.SUBSISTEMAS + ("SIN",)}
    soma = idm["soma_sin"]
    dic = _dicionarios(con)
    orient = esquema["intercambio_nacional"]
    fixos = [a["recurso"][-4:] for a in orient if a["orientacao_fixa"]]
    variaveis = [a["recurso"][-4:] for a in orient if not a["orientacao_fixa"]]
    frases = []
    for sm in ("N", "NE", "SE"):
        x = per[sm]
        frases.append(f"{c.NOME_SUBMERCADO[sm]}: o intercâmbio do balanço é igual à soma das fronteiras em {_fmt(x['horas_fecham'])} "
                      f"de {_fmt(x['horas'])} horas (tolerância de 0,1 MWmed).")
    xs = per["S"]
    frases.append(f"Sul: o intercâmbio do balanço é igual à fronteira com o Sudeste mais Argentina e Uruguai em "
                  f"{_fmt(xs['horas_fecham'])} de {_fmt(xs['horas'])} horas. Nas demais ({_fmt(xs['horas_residuo'])}, meses "
                  f"{', '.join(c.mes_br(m) for m in diag['meses'])}), o balanço é coerente consigo mesmo em "
                  f"{_fmt(diag['balanco_coerente'])} (intercâmbio do SIN = Sul − fronteira S→SE), mas usa um exterior diferente "
                  f"do conjunto internacional: zero em {_fmt(sul_fora)} horas, menor em módulo em "
                  f"{_fmt(diag['exterior_menor_no_balanco'])} e maior ou de sinal trocado em {_fmt(diag['exterior_outro_no_balanco'])}. "
                  "O resíduo está no perímetro do exterior, não em perdas.")
    xsin = per["SIN"]
    frases.append(f"SIN: o intercâmbio do balanço é igual ao intercâmbio internacional em {_fmt(xsin['horas_fecham'])} de "
                  f"{_fmt(xsin['horas'])} horas; o intercâmbio do SIN é igual à soma dos quatro subsistemas em "
                  f"{_fmt(soma['horas_fecham'])} de {_fmt(soma['horas'])} horas"
                  + (f" (as demais em {', '.join(sorted({p['inicio'][:10] for p in soma['periodos']}))})." if soma["horas_residuo"] else "."))
    xb = bl["SIN"]
    ident = balanco["_ident"]
    h_bal = set(ident["balanco.SIN"]["horas_residuo_lista"])
    h_per = set().union(*(set(ident[f"perimetro.{sm}"]["horas_residuo_lista"]) for sm in ons_rede.SUBSISTEMAS + ("SIN",)))
    em_comum = len(h_bal & h_per)
    frases.append(f"Balanço interno (geração − carga − intercâmbio) do SIN: {_fmt(xb['horas_residuo'])} horas com resíduo, entre "
                  f"{xb['primeira_hora_residuo']} e {xb['ultima_hora_residuo']}; em {_fmt(len(h_bal) - em_comum)} delas o intercâmbio "
                  "fecha com as fronteiras e o exterior, então o resíduo está nas parcelas de geração ou de carga publicadas no "
                  "balanço. A causa não é informada pela fonte."
                  if xb["horas_residuo"] else "Balanço interno (geração − carga − intercâmbio) do SIN fecha em todas as horas.")
    a05 = {
        "status": "fechado com resíduos sinalizados",
        "perimetro": ("O intercâmbio de cada subsistema no balanço é o saldo das fronteiras com os outros subsistemas; o do Sul "
                      "inclui Argentina e Uruguai; o do SIN é o intercâmbio internacional. Soma zero só acontece quando o "
                      "exterior é nulo."),
        "sinais": ("Positivo = exportação no balanço (conferido pela identidade com as fronteiras) e no intercâmbio internacional "
                   "(dicionário). No arquivo de fronteiras, a orientação é fixa com sinal nos anos "
                   f"{', '.join(fixos) or 'nenhum'} e segue o sentido do fluxo da hora, sem sinal, em {', '.join(variaveis) or 'nenhum'}."),
        "exterior": (f"Paraguai (conversora de Acaray): {_fmt(len(py))} horas publicadas entre {py_periodo[0]} e {py_periodo[1]}, "
                     f"{_fmt(py_nao_nulo)} com fluxo acima de 1 MWmed em módulo; o arquivo deixa de trazer o país depois disso. "
                     "Itaipu é uma usina no conjunto do ONS (geração), não intercâmbio. Argentina e Uruguai entram no Sul, como "
                     "mostra a identidade do balanço do Sul."),
        "perdas": (f"Nenhum resíduo é atribuído a perdas: as três identidades não têm termo de perdas e fecham em "
                   f"{_fmt(bl['SIN']['horas_fecham'])} de {_fmt(bl['SIN']['horas'])} horas no balanço interno do SIN e em todas "
                   "as horas nas fronteiras de Norte, Nordeste e Sudeste/Centro-Oeste."),
        "diagnostico_perimetro_sul": diag,
        "paraguai": {"horas": len(py), "horas_com_fluxo": py_nao_nulo, "inicio": py_periodo[0], "fim": py_periodo[1]},
        "frases": frases,
        "dicionario_balanco_define_sinal": dic[DS_BAL]["menciona_sinal"],
        "dicionario_internacional_define_sinal": dic[DS_II]["menciona_sinal"],
    }
    a06 = {
        "status": "bloqueado por fonte não pública (limites) e resolvido para a pergunta alternativa (evidências publicadas)",
        "conclusao": restricoes["limites"]["conclusao"],
        "busca": BUSCA_LIMITES,
        "trecho_dicionario": next((t for t in dic[DS_IN]["trechos"] if t["id"] == "limites_relatorio"), None),
        "correcao_metodologia": ("A página de metodologia dizia que os limites de intercâmbio estavam catalogados; não há "
                                 "conjunto público correspondente. A frase deve dizer que os limites estão no Relatório "
                                 "Quadrimestral do SINtegre (acesso autenticado) e não foram integrados."),
    }
    return {"A05": a05, "A06": a06, "dicionarios": dic}


# ---------------------------------------------------------------------------
# CSV horários por ano
# ---------------------------------------------------------------------------

def _escreve_csv_horarios(fluxo, prog, ext, prog_ext, pld, bal):
    horas = sorted(set().union(*(set(v) for v in fluxo.values())))
    por_ano = defaultdict(list)
    for h in horas:
        por_ano[h[:4]].append(h)
    cab = (["data_hora"] + [f"fluxo_{p}" for p in PARES] + [f"prog_{p}" for p in PARES] + [f"ext_{p}" for p in PAISES]
           + [f"prog_ext_{p}" for p in PAISES_SUL] + [f"pld_{sm}" for sm in ons_rede.SUBSISTEMAS]
           + [f"saldo_{sm}" for sm in ons_rede.SUBSISTEMAS + ("SIN",)])
    for ano, hs in por_ano.items():
        linhas = []
        for h in hs:
            linhas.append([h] + [_r(fluxo[p].get(h), 3) for p in PARES] + [_r(prog[p].get(h), 3) for p in PARES]
                          + [_r(ext[p].get(h), 3) for p in PAISES] + [_r(prog_ext[p].get(h), 3) for p in PAISES_SUL]
                          + [c.r(pld[sm].get(h), 2) for sm in ons_rede.SUBSISTEMAS]
                          + [_r(bal[("intercambio", sm)].get(h), 3) for sm in ons_rede.SUBSISTEMAS + ("SIN",)])
        base.escreve_csv(f"rede_horario_{ano}.csv", cab, linhas)


# ---------------------------------------------------------------------------
# Proveniência e evidências ("Comprove este número")
# ---------------------------------------------------------------------------

def _fmt(v, casas=0):
    """Número no formato brasileiro (ponto de milhar, vírgula decimal, sinal de menos)."""
    if v is None:
        return None
    txt = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 and round(abs(v), casas) != 0 else "") + txt


def _notas(ds):
    return (base.le_gold(f"_meta_{ds}.json", destino=META_DIR) or {}).get("notas")


def _proveniencias(gold, snaps, snap_pld, pld, dia_ref):
    circ = gold["circulacao"]
    ini = circ["mensal"]["meses"][0] + "-01" if circ["mensal"]["meses"] else f"{ANO_INICIAL}-01-01"
    lim_comum = ["Dados em processo de consistência recorrente do ONS, sujeitos a revisão após a publicação.",
                 "Limites operativos de intercâmbio não estão integrados (achado A06): fluxo alto não demonstra rede no limite."]
    p = {}
    p["fluxo"] = c.proveniencia(
        indicador="Fluxo verificado por fronteira: energia em cada sentido e saldo líquido", natureza="CALCULADO",
        fonte=_fonte_prov(DS_IN), unidade="MWh (soma de valores horários em MWmed × 1 h)", frequencia="horária, somada por dia e mês",
        periodo={"inicio": ini, "fim": dia_ref}, cobertura={"inicio": ini, "fim": dia_ref},
        capturado_em=c.ultima_captura(snaps[DS_IN]), snapshot=snaps[DS_IN],
        transformacoes=["releitura linha a linha do arquivo original, com conversão para a orientação canônica (verificado e "
                        "programado multiplicados pelo mesmo sinal)", "soma, por dia e mês, da energia em cada sentido",
                        "contagem de horas por sentido (|fluxo| > 1 MWmed) e de trocas de sentido entre horas consecutivas"],
        formula=("canônico = Σ max(f_h, 0); inverso = Σ max(−f_h, 0); líquido = canônico − inverso; "
                 "contra o saldo = min(canônico, inverso)"),
        limitacoes=["O fluxo da fronteira soma as linhas de transmissão entre os subsistemas; a fonte não publica o fluxo "
                    "de cada linha, então sentidos opostos em linhas diferentes na mesma hora não são visíveis.",
                    "A comparação bruto × líquido é entre horas: dentro da hora, o valor já é médio."] + lim_comum,
        download="/energia/series/rede_fronteiras_diario.csv", notas_fonte=_notas(DS_IN))
    p["subsistemas"] = c.proveniencia(
        indicador="Exportação e importação brutas de cada subsistema", natureza="CALCULADO", fonte=_fonte_prov(DS_IN),
        unidade="MWh", frequencia="horária, somada por dia e mês", periodo={"inicio": ini, "fim": dia_ref},
        cobertura={"inicio": ini, "fim": dia_ref}, capturado_em=c.ultima_captura(snaps[DS_IN]), snapshot=snaps[DS_IN],
        transformacoes=["parcela de cada fronteira com o sinal do subsistema (positivo = exporta)",
                        "no Sul, Argentina e Uruguai somados como fronteiras (conferido no balanço)",
                        "exportação bruta = soma das parcelas positivas da hora; importação bruta = soma das negativas"],
        formula="exp_bruta(s) = Σ_h Σ_f max(p_f,h, 0); imp_bruta(s) = Σ_h Σ_f max(−p_f,h, 0); líquido = exp − imp",
        limitacoes=["Trânsito (exportar por uma fronteira e importar por outra na mesma hora) não diz de onde vem a energia "
                    "consumida no subsistema: fluxos de potência não têm origem rastreável."] + lim_comum,
        download="/energia/series/rede_subsistemas_diario.csv", notas_fonte=_notas(DS_IN))
    ult_pld = gold["referencia"]["ultima_hora_pld"]
    p["pld_na_hora"] = c.proveniencia(
        indicador="Preço nas duas pontas da fronteira na mesma hora do fluxo", natureza="CALCULADO", fonte=c.FONTE_CCEE_PLD,
        unidade="horas", frequencia="horária", periodo={"inicio": ini, "fim": min(dia_ref, (ult_pld or dia_ref)[:10])},
        cobertura={"inicio": ini, "fim": (ult_pld or dia_ref)[:10]}, capturado_em=c.ultima_captura(snap_pld), snapshot=snap_pld,
        transformacoes=["PLD horário de cada submercado lido do silver principal (só leitura)",
                        "classificação da hora: preços juntos (|ΔPLD| ≤ R$ 0,01/MWh) ou separados, e sentido do fluxo verificado "
                        "em relação ao preço"],
        formula="separada(h) = |PLD_para(h) − PLD_de(h)| > 0,01; para o mais caro = sinal(fluxo_h) = sinal(ΔPLD_h)",
        limitacoes=["Diferença de preço entre submercados não demonstra fronteira no limite: o PLD sai do modelo de "
                    "despacho, com restrições e limites que não estão publicados.",
                    "O PLD vem das capturas da CCEE no silver principal (só leitura); horas depois da última captura ficam sem classificação."]
        + lim_comum[:1], publicacao_informada=False)
    p["balanco"] = c.proveniencia(
        indicador="Identidades do balanço de energia e resíduos", natureza="CALCULADO", fonte=_fonte_prov(DS_BAL),
        unidade="MWmed por hora; MWh por mês", frequencia="horária, agregada por mês", periodo={"inicio": ini, "fim": dia_ref},
        cobertura={"inicio": ini, "fim": dia_ref}, capturado_em=c.ultima_captura(snaps[DS_BAL]), snapshot=snaps[DS_BAL],
        transformacoes=["releitura dos arquivos originais do balanço", "resíduos hora a hora nas três identidades",
                        f"tolerância de {TOL_IDENT} MWmed por hora (arredondamento), com contagens acima de 1, 10 e 100 MWmed"],
        formula=("resíduo_balanço = hidráulica + térmica + eólica + solar − carga − intercâmbio; resíduo_perímetro = "
                 "intercâmbio_balanço − Σ fronteiras (− exterior no Sul e no SIN); resíduo_soma = intercâmbio_SIN − Σ subsistemas"),
        limitacoes=["O dicionário do balanço não descreve o sinal do intercâmbio; o sinal (positivo = exporta) foi conferido "
                    "pela identidade com as fronteiras.",
                    "Resíduo não é atribuído a perdas nem ao exterior por hipótese: é publicado com os períodos em que ocorre.",
                    "Parcela ausente na fonte deixa a hora como incompleta; nada é preenchido."] + lim_comum[:1],
        download="/energia/series/rede_balanco_mensal.csv", notas_fonte=_notas(DS_BAL))
    p["exterior"] = c.proveniencia(
        indicador="Intercâmbio internacional verificado por país", natureza="CALCULADO", fonte=_fonte_prov(DS_II),
        unidade="MWh", frequencia="horária, somada por mês", periodo={"inicio": ini, "fim": dia_ref},
        cobertura={"inicio": ini, "fim": dia_ref}, capturado_em=c.ultima_captura(snaps[DS_II]), snapshot=snaps[DS_II],
        transformacoes=["soma mensal da exportação (valores positivos) e da importação (negativos)",
                        "Itaipu: geração total e parcela destinada ao Brasil somadas por mês; a diferença é a parcela não destinada ao Brasil"],
        formula="exportação = Σ max(v_h, 0); importação = Σ max(−v_h, 0); Itaipu não Brasil = Σ (total_h − Brasil_h)",
        limitacoes=["Itaipu é geração no conjunto do ONS, não intercâmbio; a parcela não destinada ao Brasil não é medida "
                    "diretamente desde a remoção do campo do Paraguai (dicionário versão 1.1, 30/07/2026).",
                    (f"{gold['cobertura']['exterior']['dias_incompletos']} dia(s) sem as 24 horas no conjunto internacional "
                     "(lista em cobertura.exterior): horas ausentes não são preenchidas.")] + lim_comum[:1],
        download="/energia/series/rede_exterior_mensal.csv", notas_fonte=_notas(DS_II))
    p["atls"] = c.proveniencia(
        indicador="Horas de violação dos limites sistêmicos (ATLS)", natureza="OBSERVADO", fonte=_fonte_prov(DS_ATLS),
        unidade="horas; ATLS como fração de 0 a 1", frequencia="mensal e acumulada no ano",
        periodo={"inicio": min((f["inicio"] for f in gold["restricoes"]["atls"]["fluxos"] if f["inicio"]), default=None) or ini,
                 "fim": gold["restricoes"]["atls"]["ultimo_mes"] or dia_ref},
        cobertura={"inicio": min((f["inicio"] for f in gold["restricoes"]["atls"]["fluxos"] if f["inicio"]), default=None) or ini,
                   "fim": gold["restricoes"]["atls"]["ultimo_mes"] or dia_ref},
        capturado_em=c.ultima_captura(snaps[DS_ATLS]), snapshot=snaps[DS_ATLS],
        transformacoes=["valores como publicados", "soma de horas de violação em 12 meses",
                        "período de observação implícito = horas ÷ (1 − ATLS), para conferir a unidade"],
        limitacoes=["O ONS não publica o valor do limite nem o sentido da violação; o indicador diz quanto tempo o fluxo "
                    "ficou acima do limite recomendado, não quanto da capacidade foi usada.",
                    "Violações com menos de 10 minutos e dentro da banda morta (50 MW ou 5% do limite) não entram (Submódulo 9.1).",
                    "O conjunto de fluxos monitorados muda ao longo do tempo; siglas sem definição em documento público "
                    "ficam sem descrição."],
        download="/energia/series/rede_atls.csv", notas_fonte=_notas(DS_ATLS))
    p["interrupcoes"] = c.proveniencia(
        indicador="Interrupções de carga e energia não suprida", natureza="CALCULADO", fonte=_fonte_prov(DS_IC),
        unidade="MWh; registros", frequencia="por evento, agregada por ano",
        periodo={"inicio": (gold["restricoes"]["interrupcoes"]["inicio"] or "")[:10] or ini,
                 "fim": (gold["restricoes"]["interrupcoes"]["fim"] or "")[:10] or dia_ref},
        cobertura={"inicio": (gold["restricoes"]["interrupcoes"]["inicio"] or "")[:10] or ini,
                   "fim": (gold["restricoes"]["interrupcoes"]["fim"] or "")[:10] or dia_ref},
        capturado_em=c.ultima_captura(snaps[DS_IC]), snapshot=snaps[DS_IC],
        transformacoes=["registros como publicados (um por perturbação, agente e UF)", "somas anuais por subsistema",
                        "perturbação = soma dos seus registros"],
        formula="ENS(ano, s) = Σ energia não suprida dos registros do ano no subsistema s",
        limitacoes=["A descrição do conjunto cita cortes maiores que 100 MW por 10 minutos, mas o arquivo traz registros "
                    "menores; todos são publicados e contados à parte.",
                    "Interrupção de carga é evento de perturbação, não prova de limite de intercâmbio atingido.",
                    "O ano corrente é parcial e não compete com anos completos."],
        download="/energia/series/rede_interrupcoes_carga.csv", notas_fonte=_notas(DS_IC))
    prog = gold["programado"]
    p["programado"] = c.proveniencia(
        indicador="Desvio entre o intercâmbio verificado e o programado", natureza="CALCULADO", fonte=_fonte_prov(DS_IN),
        unidade="MWmed por hora; MWh por dia", frequencia="horária", periodo={"inicio": (prog["inicio"] or dia_ref)[:10], "fim": dia_ref},
        cobertura={"inicio": (prog["inicio"] or dia_ref)[:10], "fim": dia_ref}, capturado_em=c.ultima_captura(snaps[DS_IN]),
        snapshot=snaps[DS_IN],
        transformacoes=["programado e verificado da mesma linha do arquivo, na mesma orientação",
                        f"desvio material quando |desvio| ≥ {_fmt(LIMIAR_MATERIAL)} MWmed; sensibilidade em 500 e 2.000 MWmed",
                        "inversão quando programa e operação têm sentidos opostos"],
        formula="desvio_h = verificado_h − programado_h; material = |desvio_h| ≥ 1.000 MWmed",
        limitacoes=["O valor programado só existe nos arquivos a partir de 2026 (campo incluído no dicionário em 04/05/2026).",
                    "A fonte não identifica a revisão do programa; para o exterior o valor coincide com o PDO das conversoras "
                    "na amostra conferida.",
                    "Desvio não é falha: a operação em tempo real corrige o programa do dia anterior."] + lim_comum[:1],
        download="/energia/series/rede_programado_diario.csv", notas_fonte=_notas(DS_IN))
    return p


def _recursos_ano(prefixo, dias):
    return {f"{prefixo}{a}" for a in {d[:4] for d in dias}}


def _evidencias(gold, con, con_p, fluxo, dia_ref, ressalvas):
    out = {}
    circ = gold["circulacao"]
    down_f = [{"rotulo": "Fronteiras por dia (CSV)", "url": _csv_url("rede_fronteiras_diario.csv")},
              {"rotulo": f"Série horária {dia_ref[:4]} (CSV)", "url": _csv_url(f"rede_horario_{dia_ref[:4]}.csv")}]
    conf = gold.get("conferencia_silver_principal") or {}
    for r in circ["resumo_30d"]:
        p = r["par"]
        dias = [d for d in circ["diario"]["dias"][-30:]]
        hs = [h for d in dias for h in horas_do_dia(d)]
        vals = [fluxo[p].get(h) for h in hs]
        can = sum(v for v in vals if v is not None and v > 0)
        inv = sum(-v for v in vals if v is not None and v < 0)
        n = sum(1 for v in vals if v is not None)
        # caminho independente: mesmas horas no silver principal (outro coletor e outro parser)
        rec = None
        if con_p is not None:
            outro = dict(base.serie_vigente(con_p, DS_INT_PRINCIPAL, f"fluxo.{p}"))
            comuns = [h for h in hs if outro.get(h) is not None and fluxo[p].get(h) is not None]
            if comuns:
                meus = [fluxo[p][h] for h in comuns]
                deles = [outro[h] for h in comuns]
                a1 = min(sum(v for v in meus if v > 0), sum(-v for v in meus if v < 0))
                a2 = min(sum(v for v in deles if v > 0), sum(-v for v in deles if v < 0))
                dif = a1 - a2
                tol = 0.001 * len(comuns)
                mesmo = dia_ref[:4] in {x[-4:] for x in (conf.get(DS_IN) or {}).get("arquivos_identicos", [])}
                rec = ev.reconciliacao(
                    f"Mesma conta com o fluxo do silver principal (fontes/ons.py, outro coletor e outro parser) nas {len(comuns)} "
                    f"horas da janela que ele tem: {_fmt(a2, 1)} MWh contra {_fmt(a1, 1)} MWh aqui; diferença {_fmt(dif, 3)} MWh"
                    + ("" if len(comuns) == len(hs) else f" ({len(hs) - len(comuns)} horas mais recentes ainda não estavam na captura do silver principal)")
                    + ("" if mesmo else "; arquivos de capturas diferentes: diferença seria revisão do ONS"),
                    "aprovado" if abs(dif) <= tol else "ressalva", f"{_fmt(tol, 3)} MWh (0,001 MWh por hora, precisão dos arquivos)")
            else:
                rec = ev.reconciliacao("Silver principal sem as horas da janela: conferência não feita", "ressalva", "0,001 MWh por hora")
        nome = f"{c.NOME_SUBMERCADO[r['de']]} → {c.NOME_SUBMERCADO[r['para']]}"
        out[f"contra_saldo_30d.{p}"] = _ev(
            indicador="Energia no sentido contrário ao saldo em 30 dias", valor_exibido=f"{_fmt(min(can, inv))} MWh",
            valor_calculo=min(can, inv), unidade="MWh", periodo={"inicio": dias[0], "fim": dias[-1]},
            entidade=f"Fronteira {nome}", universo=f"{n} de {len(hs)} horas com fluxo publicado",
            fonte=_fonte_ev(con, DS_IN, recursos=_recursos_ano("INTERCAMBIO_NACIONAL_", dias)),
            consulta=(f"SELECT ref, valor FROM observacoes (vintage vigente) WHERE dataset='{DS_IN}' AND serie='verificado.{p}' "
                      f"AND ref BETWEEN '{hs[0]}' AND '{hs[-1]}'"),
            chaves_origem=[f"{DS_IN}:verificado.{p}:{hs[0]}..{hs[-1]}"],
            formula="min(Σ max(fluxo_h, 0), Σ max(−fluxo_h, 0)) nas horas da janela; o saldo líquido é a diferença entre os dois sentidos",
            cobertura=f"{n} de {len(hs)} horas", tratamento_ausencia="Hora sem valor fica fora das somas; nenhuma hora é preenchida.",
            revisoes=c.revisoes_do_dataset(con, DS_IN),
            testes=[ev.teste("Horas da janela publicadas", "aprovado" if n == len(hs) else "ressalva", f"{n} de {len(hs)}"),
                    ev.teste("Saldo líquido = canônico − inverso", "aprovado",
                             f"canônico {_fmt(can, 1)} MWh, inverso {_fmt(inv, 1)} MWh, líquido {_fmt(can - inv, 1)} MWh")]
            + [ev.teste("Ressalvas de esquema da fonte", "ressalva", x) for x in ressalvas],
            reconciliacao=rec, download=down_f,
            reproducao=f"{REPRODUCAO}; some as colunas fluxo_{p} positivas e negativas de rede_horario_{dia_ref[:4]}.csv nos 30 dias")

    # A05: perímetro do Sul e balanço interno do SIN
    idm = {x["id"]: x for x in gold["balanco"]["identidades"]}
    bal_sin = _serie(con, DS_BAL, "intercambio.SIN", f"{ANO_INICIAL}-01-01")
    diag = gold["achados"]["A05"]["diagnostico_perimetro_sul"]
    xs = idm["perimetro.S"]
    fonte_bal = _fonte_ev(con, DS_BAL)
    down_b = [{"rotulo": "Horas com resíduo no balanço (CSV)", "url": _csv_url("rede_balanco_residuos.csv")},
              {"rotulo": "Balanço mensal (CSV)", "url": _csv_url("rede_balanco_mensal.csv")}]
    out["a05_perimetro_sul"] = _ev(
        indicador="Horas em que o intercâmbio do Sul no balanço não inclui o exterior", valor_exibido=f"{_fmt(xs['horas_residuo'])} horas",
        valor_calculo=xs["horas_residuo"], unidade="horas", periodo={"inicio": f"{ANO_INICIAL}-01-01", "fim": dia_ref},
        entidade="Subsistema Sul", universo=f"{_fmt(xs['horas'])} horas com balanço, fronteira e exterior publicados",
        fonte=fonte_bal, consulta=("rede_balanco_residuos.csv, identidade = perimetro, sm = S"),
        chaves_origem=[f"{DS_BAL}:intercambio.S", f"{DS_IN}:verificado.S_SE", f"{DS_II}:verificado.ARGENTINA",
                       f"{DS_II}:verificado.URUGUAI"],
        formula="conta das horas com |intercâmbio_S − (fluxo S→SE + Argentina + Uruguai)| > 0,1 MWmed",
        cobertura=f"{_fmt(xs['horas'])} horas", tratamento_ausencia="Hora com parcela ausente fica fora da conta.",
        revisoes=c.revisoes_do_dataset(con, DS_BAL),
        testes=[ev.teste("Nas horas com resíduo, o balanço é coerente consigo mesmo (SIN = Sul − fronteira S→SE)",
                         "aprovado" if diag["balanco_coerente"] == xs["horas_residuo"] else "ressalva",
                         f"{diag['balanco_coerente']} de {xs['horas_residuo']} horas; exterior zero no balanço em "
                         f"{diag['exterior_zero_no_balanco']}, menor em módulo em {diag['exterior_menor_no_balanco']} e "
                         f"maior ou de sinal trocado em {diag['exterior_outro_no_balanco']}; "
                         f"meses: {', '.join(diag['meses'])}"),
                ev.teste("Norte, Nordeste e Sudeste fecham com as fronteiras", "aprovado" if all(
                    idm[f"perimetro.{sm}"]["horas_residuo"] == 0 for sm in ("N", "NE", "SE")) else "ressalva",
                    "; ".join(f"{sm}: {idm[f'perimetro.{sm}']['horas_residuo']} horas com resíduo" for sm in ("N", "NE", "SE")))],
        reconciliacao=ev.reconciliacao("Balanço do ONS contra dois outros conjuntos do ONS (fronteiras e intercâmbio internacional), "
                                       "hora a hora: as horas com resíduo são exatamente as em que o exterior do balanço difere do "
                                       "conjunto internacional", "aprovado" if diag["balanco_coerente"] == xs["horas_residuo"] else "ressalva",
                                       "0,1 MWmed por hora"),
        download=down_b, reproducao=f"{REPRODUCAO}; filtrar rede_balanco_residuos.csv por identidade=perimetro e sm=S")
    xb = idm["balanco.SIN"]
    out["a05_balanco_sin"] = _ev(
        indicador="Horas em que geração menos carga difere do intercâmbio no balanço do SIN",
        valor_exibido=f"{_fmt(xb['horas_residuo'])} horas", valor_calculo=xb["horas_residuo"], unidade="horas",
        periodo={"inicio": f"{ANO_INICIAL}-01-01", "fim": dia_ref}, entidade="Sistema Interligado Nacional",
        universo=f"{_fmt(xb['horas'])} horas com todas as parcelas publicadas", fonte=fonte_bal,
        consulta="rede_balanco_residuos.csv, identidade = balanco, sm = SIN",
        chaves_origem=[f"{DS_BAL}:{k}.SIN" for k in PARCELAS_BALANCO],
        formula="conta das horas com |hidráulica + térmica + eólica + solar − carga − intercâmbio| > 0,1 MWmed",
        cobertura=f"{_fmt(xb['horas'])} horas", tratamento_ausencia="Hora com parcela ausente fica fora da conta (não vira zero).",
        revisoes=c.revisoes_do_dataset(con, DS_BAL),
        testes=[ev.teste("Resíduo acima de 1, 10 e 100 MWmed", "ressalva" if xb["horas_residuo"] else "aprovado",
                         ", ".join(f"> {k} MWmed: {v} horas" for k, v in xb["horas_acima"].items())),
                ev.teste("Intercâmbio do SIN = soma dos subsistemas", "aprovado" if idm["soma_sin"]["horas_residuo"] == 0 else "ressalva",
                         f"{idm['soma_sin']['horas_residuo']} horas com diferença")],
        reconciliacao=None, download=down_b,
        reproducao=f"{REPRODUCAO}; filtrar rede_balanco_residuos.csv por identidade=balanco e sm=SIN")

    # exterior: saldo de 12 meses contra o intercâmbio do SIN no balanço (outro conjunto)
    ext_m = gold["exterior"]
    m12 = [m for m in ext_m["meses"] if m < dia_ref[:7]][-12:]
    if m12:
        hs = [h for h in bal_sin if h[:7] in m12]
        paises = {p: _serie(con, DS_II, f"verificado.{p}", f"{ANO_INICIAL}-01-01") for p in PAISES}
        liq = sum(v for p in PAISES for h, v in paises[p].items() if h[:7] in m12)
        horas_ext = sorted({h for p in PAISES for h in paises[p] if h[:7] in m12})
        comuns = [h for h in horas_ext if h in bal_sin]
        liq_comum = sum(paises[p].get(h) or 0 for p in PAISES for h in comuns)
        sin_comum = sum(bal_sin[h] for h in comuns)
        dif = liq_comum - sin_comum
        out["exterior_12m"] = _ev(
            indicador="Saldo do intercâmbio internacional em 12 meses (positivo = exportação)", valor_exibido=f"{_fmt(liq)} MWh",
            valor_calculo=liq, unidade="MWh", periodo={"inicio": m12[0], "fim": m12[-1]}, entidade="Brasil (SIN) com Argentina, Uruguai e Paraguai",
            universo=f"{len(horas_ext)} horas publicadas nos 12 meses", fonte=_fonte_ev(con, DS_II),
            consulta=f"SELECT serie, ref, valor FROM observacoes (vigente) WHERE dataset='{DS_II}' AND serie LIKE 'verificado.%' AND ref BETWEEN '{m12[0]}' AND '{m12[-1]}-31T23:00'",
            chaves_origem=[f"{DS_II}:verificado.{p}" for p in PAISES],
            formula="Σ_países Σ_h intercâmbio verificado (MWmed × 1 h)", cobertura=f"{len(horas_ext)} horas; {len(comuns)} com balanço",
            tratamento_ausencia="Hora ausente no arquivo do ONS fica fora da soma.", revisoes=c.revisoes_do_dataset(con, DS_II),
            testes=[ev.teste("Horas esperadas nos 12 meses", "aprovado" if len(horas_ext) == sum(horas_calendario(m) for m in m12) else "ressalva",
                             f"{len(horas_ext)} de {sum(horas_calendario(m) for m in m12)}")],
            reconciliacao=ev.reconciliacao(
                f"Mesmas {len(comuns)} horas pelo intercâmbio do SIN no balanço de energia (outro conjunto): {_fmt(sin_comum)} MWh; diferença {_fmt(dif, 1)} MWh",
                "aprovado" if abs(dif) <= 0.1 * max(1, len(comuns)) else "ressalva", "0,1 MWmed por hora (tolerância das identidades)"),
            download=[{"rotulo": "Exterior e Itaipu por mês (CSV)", "url": _csv_url("rede_exterior_mensal.csv")}],
            reproducao=f"{REPRODUCAO}; somar liquido_mwh dos países em rede_exterior_mensal.csv nos 12 meses")

    # ATLS: horas de violação nos últimos 12 meses por fluxo ativo
    fonte_atls = _fonte_ev(con, DS_ATLS)
    for f in gold["restricoes"]["atls"]["fluxos"]:
        if not f["ativo"] or not f["ultimos_12_meses"]:
            continue
        u = f["ultimos_12_meses"]
        cf = f["conferencias"]
        v = sum(x or 0 for x, m in zip(f["serie"]["horas_violacao"], f["serie"]["meses"]) if u["inicio"] <= m <= u["fim"])
        out[f"atls_12m.{f['fluxo']}"] = _ev(
            indicador="Horas acima do limite sistêmico em 12 meses (ATLS)", valor_exibido=f"{_fmt(v, 1)} horas", valor_calculo=v,
            unidade="horas", periodo={"inicio": u["inicio"], "fim": u["fim"]},
            entidade=f"Fluxo {f['fluxo']}" + (f" ({f['definicao']})" if f["definicao"] else ""), universo="12 meses publicados",
            fonte=fonte_atls, consulta=f"rede_atls.csv, fluxo = {f['fluxo']}, periodicidade = ME, mes entre {u['inicio']} e {u['fim']}",
            chaves_origem=[f"{DS_ATLS}:horas_violacao.{f['fluxo']}.ME:{u['inicio']}..{u['fim']}"],
            formula="Σ num_horasviolacao mensal (tempo acima do limite estabelecido, violações de 10 minutos ou mais)",
            cobertura=f"{u['meses_com_violacao']} de 12 meses com violação", tratamento_ausencia="Mês não publicado fica fora da soma.",
            revisoes=c.revisoes_do_dataset(con, DS_ATLS),
            testes=[ev.teste("Acumulado anual publicado = soma dos meses", "aprovado" if cf["acumulado_anual_confere"] == cf["acumulado_anual_meses"] else "ressalva",
                             f"{cf['acumulado_anual_confere']} de {cf['acumulado_anual_meses']} meses"),
                    ev.teste("ATLS publicado = 1 − horas ÷ horas do mês", "aprovado" if not cf["meses_denominador_diferente_do_calendario"] else "ressalva",
                             f"{len(cf['meses_denominador_diferente_do_calendario'])} mês(es) com período de observação implícito diferente das horas do calendário em mais de 0,5 h"
                             + (f": {', '.join(cf['meses_denominador_diferente_do_calendario'][:6])}" if cf["meses_denominador_diferente_do_calendario"] else ""))],
            reconciliacao=ev.reconciliacao("Horas mensais contra o acumulado no ano publicado pelo próprio ONS (outra série do mesmo arquivo)",
                                           "aprovado" if cf["acumulado_anual_confere"] == cf["acumulado_anual_meses"] else "ressalva",
                                           "0,01 hora por mês"),
            download=[{"rotulo": "Indicador ATLS (CSV)", "url": _csv_url("rede_atls.csv")}],
            reproducao=f"{REPRODUCAO}; somar horas_violacao de rede_atls.csv")

    # interrupções: ENS de 12 meses, com a energia recalculada de carga × tempo
    intr = gold["restricoes"]["interrupcoes"]["ultimos_12_meses"]
    eventos = gold["restricoes"].get("_eventos") or []
    ev12 = [e for e in eventos if intr["inicio"] and intr["inicio"] <= e["din_interrupcaocarga"][:10] <= intr["fim"]]
    recalc_ok = sum(1 for e in ev12 if e["val_cargainterrompida_mw"] is not None and e["val_tempomedio_minutos"] is not None
                    and e["val_energianaosuprida_mwh"] is not None
                    and abs(e["val_cargainterrompida_mw"] * e["val_tempomedio_minutos"] / 60 - e["val_energianaosuprida_mwh"])
                    <= max(0.01, 0.001 * e["val_energianaosuprida_mwh"]))
    recalc = sum((e["val_cargainterrompida_mw"] or 0) * (e["val_tempomedio_minutos"] or 0) / 60 for e in ev12)
    if intr["inicio"]:
        out["ens_12m"] = _ev(
            indicador="Energia não suprida em interrupções de carga, 12 meses", valor_exibido=f"{_fmt(intr['_ens'], 1)} MWh",
            valor_calculo=intr["_ens"], unidade="MWh", periodo={"inicio": intr["inicio"], "fim": intr["fim"]},
            entidade="Sistema Interligado Nacional", universo=f"{intr['_n']} registros de {intr['perturbacoes']} perturbações",
            fonte=_fonte_ev(con, DS_IC), consulta=f"rede_interrupcoes_carga.csv, instante entre {intr['inicio']} e {intr['fim']}",
            chaves_origem=[f"{DS_IC}:{e['chave']}" for e in ev12], manifesto={"rotulo": "Interrupções de carga (CSV)", "url": _csv_url("rede_interrupcoes_carga.csv")},
            formula="Σ val_energianaosuprida_mwh dos registros", cobertura=f"{intr['_n']} registros",
            tratamento_ausencia="Registro sem energia informada fica fora da soma.", revisoes=None,
            testes=[ev.teste("Energia = carga interrompida × tempo médio ÷ 60, registro a registro",
                             "aprovado" if recalc_ok == len(ev12) else "ressalva", f"{recalc_ok} de {len(ev12)} registros")],
            reconciliacao=ev.reconciliacao(f"Soma recalculada de carga × tempo: {_fmt(recalc, 1)} MWh",
                                           "aprovado" if abs(recalc - intr["_ens"]) <= max(1.0, 0.001 * intr["_ens"]) else "ressalva",
                                           "0,1% da soma ou 1 MWh"),
            download=[{"rotulo": "Interrupções de carga (CSV)", "url": _csv_url("rede_interrupcoes_carga.csv")}],
            reproducao=f"{REPRODUCAO}; somar energia_nao_suprida_mwh de rede_interrupcoes_carga.csv no período")

    # programado: desvio absoluto médio por par
    prog = gold["programado"]
    dist = prog.get("_dist") or {}
    pdo = prog.get("_pdo") or {}
    for p, x in dist.items():
        desv = x["_desvios"]
        mae = sum(abs(d) for d in desv) / len(desv)
        ds_ = DS_IN if p in PARES else DS_II
        pref = "INTERCAMBIO_NACIONAL_" if p in PARES else "INTERCAMBIO_INTERNACIONAL_"
        testes = [ev.teste("Horas com programado e verificado", "aprovado", f"{x['horas']} horas de {x['inicio']} a {x['fim']}"),
                  ev.teste(f"Horas com desvio material (≥ {_fmt(LIMIAR_MATERIAL)} MWmed)", "aprovado",
                           f"{x['horas_materiais'][str(int(LIMIAR_MATERIAL))]} horas; com 500 MWmed: {x['horas_materiais']['500']}; com 2.000 MWmed: {x['horas_materiais']['2000']}")]
        rec = None
        if p in PAISES_SUL and pdo.get("horas"):
            lin = [l for l in pdo["_linhas"] if l[1] == p]
            okp = sum(l[5] for l in lin)
            rec = ev.reconciliacao(f"Programado do conjunto contra o PDO das conversoras de {NOME_PAIS[p]} em {pdo['dias']} dias da amostra: "
                                   f"{okp} de {len(lin)} horas conferem", "aprovado" if okp == len(lin) else "ressalva", "0,5 MWmed por hora")
        out[f"desvio_medio.{p}"] = _ev(
            indicador="Desvio absoluto médio entre verificado e programado", valor_exibido=f"{_fmt(mae)} MWmed", valor_calculo=mae,
            unidade="MWmed", periodo={"inicio": x["inicio"][:10], "fim": x["fim"][:10]},
            entidade=(f"Fronteira {c.NOME_SUBMERCADO[p.split('_')[0]]} → {c.NOME_SUBMERCADO[p.split('_')[1]]}" if p in PARES else NOME_PAIS[p]),
            universo=f"{x['horas']} horas", fonte=_fonte_ev(con, ds_, recursos={f"{pref}{a}" for a in range(2026, int(dia_ref[:4]) + 1)}),
            consulta=f"rede_programado_horario.csv, par = {p}",
            chaves_origem=[f"{ds_}:programado.{p}", f"{ds_}:verificado.{p}"],
            formula="média de |verificado_h − programado_h| nas horas com os dois valores",
            numerador={"descricao": "Σ |desvio| (MWh)", "valor": sum(abs(d) for d in desv)},
            denominador={"descricao": "horas", "valor": len(desv)},
            cobertura=f"{x['horas']} horas", tratamento_ausencia="Hora sem programado ou sem verificado fica fora.",
            revisoes=c.revisoes_do_dataset(con, ds_), testes=testes, reconciliacao=rec,
            download=[{"rotulo": "Programado e verificado por hora (CSV)", "url": _csv_url("rede_programado_horario.csv")}],
            reproducao=f"{REPRODUCAO}; média de |desvio_mwmed| em rede_programado_horario.csv para o par")
    return out


def _ev(**kw):
    """evidencia.construir com a citação apontando para a página da Rede."""
    return ev.construir(endereco=SITE, **kw)
