"""Coletor dos conjuntos de mercado do portal de dados abertos da CCEE (CC-BY-4.0) para o módulo Mercado.

Situação de acesso (verificada em 01/10/2026): o portal dadosabertos.ccee.org.br, o servidor
de arquivos pda-download.ccee.org.br e o site www.ccee.org.br respondem HTTP 403 com a página
"Acesso bloqueado" a pedidos feitos com o curl (00:11 e 00:38 UTC), e responderam ao cliente
HTTP do próprio pipeline (pipeline.common.http_get e http_download, urllib da biblioteca
padrão, User-Agent do projeto) no mesmo intervalo (00:35 a 00:45 UTC). Nada foi alterado para
contornar o bloqueio. Ainda assim, a orientação recebida para este ambiente é que a CCEE
responde 403 pelo firewall da origem e que o bloqueio não deve ser contornado: usar um cliente
que por acaso passa pelo firewall é uma decisão que cabe ao responsável, não ao coletor. Por
isso, desde 01/10/2026 nenhuma requisição à CCEE sai deste módulo sem a variável de ambiente
ENERGIA_CCEE_COLETA=1 (ver `coleta_autorizada`); sem ela, o módulo só relê o que já está no
bronze (sem rede) e a gold declara a pendência de decisão. As capturas feitas em 01/10/2026
continuam no bronze, com sha256, e são identificadas na gold (`acesso_ccee`).

Esquema conferido na chegada e falha fechada: cada conjunto declara as colunas esperadas,
lidas do cabeçalho real dos arquivos e conferidas contra a descrição de cada campo nos
metadados oficiais (package_show), versionados em pipeline/energia/seed/ccee_mercado/. Arquivo
cujo cabeçalho difere (coluna a mais, a menos ou renomeada) fica guardado no bronze com sha256,
a falha é registrada e nenhum número dele entra no silver.

Os leitores agregam no grão publicado (mês, classe, submercado) e não guardam dado individual
de agente além do que o próprio painel precisa para contar entradas e saídas (CNPJ do agente,
código da parcela de carga). Valores financeiros individuais (contabilização por perfil) não
são coletados: o painel não infere exposição financeira de nenhum agente.
"""
import json
import os
import re
import sys
import time
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download, http_get  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402

PORTAL = "https://dadosabertos.ccee.org.br"
LICENCA = "Creative Commons Attribution 4.0 (CC-BY-4.0), conforme o portal de dados abertos da CCEE"
SEED_DIR = os.path.join(base.SEED, "ccee_mercado")
VERSAO_LEITOR = "ccee-mercado-1"
# Variável que autoriza requisições à CCEE a partir do ambiente em que o pipeline roda. Sem ela
# (valor "1"), coleta e coleta_infomercado não fazem nenhuma requisição e só relêem o bronze.
VAR_AUTORIZACAO = "ENERGIA_CCEE_COLETA"
PENDENCIA_ACESSO = ("Decisão pendente: o portal da CCEE responde HTTP 403 ('Acesso bloqueado') ao curl e respondeu ao cliente "
                    "do pipeline em 01/10/2026. A orientação recebida é não contornar o bloqueio; os números da CCEE publicados "
                    "aqui vêm das capturas de 01/10/2026 feitas por esse cliente e só valem como entrega depois que o "
                    "responsável decidir se essa coleta é aceitável (ou se ela fica só para o GitHub Actions).")


def coleta_autorizada(env=None):
    """True só quando o ambiente autoriza explicitamente requisições à CCEE (ENERGIA_CCEE_COLETA=1)."""
    return (os.environ if env is None else env).get(VAR_AUTORIZACAO) == "1"

SUBMERCADOS = {"NORTE": "N", "NORDESTE": "NE", "SUL": "S", "SUDESTE": "SE", "SUDESTE/CENTRO-OESTE": "SE",
               "N": "N", "NE": "NE", "S": "S", "SE": "SE"}
# Domínio documentado no package_show (oito classes) mais as que aparecem nos arquivos sem constar
# da lista do dicionário: "Varejista" (consumo por classe de 2026 e cadastro de perfis),
# "Importador" e "Transmissor" (cadastro de perfis). A falha fechada recusou esses arquivos na
# primeira leitura (01/10/2026); as classes foram conferidas nos próprios arquivos e acrescentadas
# aqui de forma explícita, com esta nota. Qualquer outra classe nova volta a ser recusada.
CLASSES = ("Autoprodutor", "Consumidor Especial", "Consumidor Livre", "Distribuidor", "Gerador", "Comercializador",
           "Exportador", "Produtor Independente", "Varejista", "Importador", "Transmissor")
CLASSES_NAO_DOCUMENTADAS = ("Varejista", "Importador", "Transmissor")

# Conjunto → painel, colunas exatas (cabeçalho real conferido com o package_show), leitor e
# quais recursos baixar ("todos" os anuais ou só o "ultimo", quando o recurso é uma posição do
# cadastro e não uma série).
CONJUNTOS = {
    "consumo_mensal_ambiente_comercializacao": {
        "painel": "P032", "titulo": "Consumo mensal por ambiente de contratação (ACR e ACL), contabilização do MCP",
        "colunas": ("MES_REFERENCIA", "CONSUMO_TOTAL_ACR", "CONSUMO_TOTAL_ACL"), "leitor": "mensal", "dims": (),
        "unidade": "MWmed", "quebras": [{"data": "2026-02-01", "descricao": "A classe de agente Comercializador deu lugar à classe Varejista; o conjunto CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO deixou de contar o consumo da Varejista no ACL (cerca de 2.500 MW médios), enquanto CONSUMO_CLASSE_AGENTE o publica como classe própria. O observatório soma o ACL pelas classes para manter a série comparável."}],},
    "consumo_classe_agente": {
        "painel": "P032", "titulo": "Consumo por classe de agente e ambiente (centro de gravidade e ponto de conexão)",
        "colunas": ("MES_REFERENCIA", "CLASSE_AGENTE", "CONSUMO", "CONSUMO_PONTO_CONEXAO_CLASSE_ACR",
                    "CONSUMO_PONTO_CONEXAO_CLASSE_ACL"), "leitor": "mensal", "dims": ("CLASSE_AGENTE",), "unidade": "MWmed",
        "quebras": [{"data": "2026-02-01", "descricao": "A classe de agente Comercializador deu lugar à classe Varejista; o conjunto CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO deixou de contar o consumo da Varejista no ACL (cerca de 2.500 MW médios), enquanto CONSUMO_CLASSE_AGENTE o publica como classe própria. O observatório soma o ACL pelas classes para manter a série comparável."}],},
    "agente_qtd_contabilizacao": {
        "painel": "P033", "titulo": "Quantidade de agentes na contabilização por classe",
        "colunas": ("MES_REFERENCIA", "CLASSE", "QUANTIDADE_AGENTE_CONTABILIZACAO"), "leitor": "mensal",
        "dims": ("CLASSE",), "unidade": "agentes"},
    "lista_agente_associado": {
        "painel": "P033", "titulo": "Agentes associados por mês (CNPJ, classe, categoria, varejista)",
        "colunas": ("CNPJ", "MES_REFERENCIA", "SIGLA_AGENTE", "RAZAO_SOCIAL", "CLASSE_AGENTE", "SITUACAO_COMERCIALIZADOR",
                    "SITUACAO_VAREJISTA", "ESTADO", "CATEGORIA_AGENTE", "INDICADOR_VAREJISTA"), "leitor": "associados"},
    "lista_perfil_v1": {
        "painel": "P033", "titulo": "Cadastro de perfis de agente (posição publicada)", "recursos": "ultimo",
        "colunas": ("COD_AGENTE", "SIGLA_AGENTE", "NOME_EMPRESARIAL", "CNPJ", "COD_PERF_AGENTE", "SIGLA_PERFIL_AGENTE",
                    "CLASSE_PERFIL_AGENTE", "STATUS_PERFIL", "CATEGORIA_AGENTE", "SUBMERCADO", "VAREJISTA", "TIPO_ENERG_PERF"),
        "leitor": "perfis"},
    "desligamento_voluntario": {
        "painel": "P033", "titulo": "Desligamentos voluntários da CCEE (com e sem sucessão)", "separador": ",",
        "colunas": ("AGENTE_DESLIGADO", "CNPJ_DESLIGADO", "CLASSE_DESLIGADO", "TIPO_SUCESSAO", "AGENTE_SUCESSOR",
                    "CNPJ_SUCESSOR", "CLASSE_SUCESSOR", "DATA_DESLIGAMENTO", "REUNIAO_CAD", "TIPO_DESLIGAMENTO"),
        "leitor": "desligamentos"},
    "desligamento_compulsorio": {
        "painel": "P033", "titulo": "Desligamentos compulsórios da CCEE", "separador": ",",
        "colunas": ("AGENTE_DESLIGADO", "CNPJ_DESLIGADO", "CLASSE_DESLIGADO", "TIPO_SUCESSAO", "AGENTE_SUCESSOR",
                    "CNPJ_SUCESSOR", "CLASSE_SUCESSOR", "DATA_DESLIGAMENTO", "REUNIAO_CAD", "TIPO_DESLIGAMENTO"),
        "leitor": "desligamentos"},
    "parcela_carga_consumo": {
        "painel": "P033", "titulo": "Parcelas de carga: consumo, perfil, data de migração",
        "colunas": ("MES_REFERENCIA", "COD_PERF_AGENTE", "SIGLA_PERFIL_AGENTE", "NOME_EMPRESARIAL", "COD_PARCELA_CARGA",
                    "SIGLA_PARCELA_CARGA", "CNPJ_CARGA", "CIDADE", "ESTADO_UF", "RAMO_ATIVIDADE", "SUBMERCADO",
                    "DATA_MIGRACAO", "COD_PERF_AGENTE_CONECTADO", "SIGLA_PERFIL_AGENTE_CONECTADO", "CAPACIDADE_CARGA",
                    "CONSUMO_ACL", "CONSUMO_CATIVO_PARC_LIVRE", "CONSUMO_TOTAL"), "leitor": "parcelas",
        # versão 2 do leitor (01/10/2026): separa as parcelas das distribuidoras (ACR) das do ACL.
        # A versão 1 somava as 139 parcelas das distribuidoras ao "consumo ACL"; as séries dela
        # (sem prefixo) continuam no silver e não são lidas.
        "versao_leitor": "2"},
    "geracao_submercado": {
        "painel": "P034", "titulo": "Geração das usinas do MRE por submercado",
        "colunas": ("SUBMERCADO", "MES_REFERENCIA", "GERACAO_MRE", "GERACAO_MRE_COTA_GF"), "leitor": "mensal",
        "dims": ("SUBMERCADO",), "unidade": "MWmed"},
    "garantia_fisica_sazo_mre_submercado": {
        "painel": "P034", "titulo": "Garantia física sazonalizada do MRE por submercado",
        "colunas": ("MES_REFERENCIA", "SUBMERCADO", "GARANTIA_FISICA_SAZO_MRE_OPCOM"), "leitor": "mensal",
        "dims": ("SUBMERCADO",), "unidade": "MWmed"},
    "mre_mensal": {
        "painel": "P034", "titulo": "MRE mensal: garantia física, fatores de ajuste, energia realocada e TEO",
        "colunas": ("MES_REFERENCIA", "GARANTIA_FISICA_SAZONALIZADA_MRE", "FATOR_PERDA_INTERNA", "FATOR_PERDA_REDE_BASICA",
                    "FATOR_DISPONIBILIDADE", "FATOR_REDUCAO_ACUMULADO", "GARANTIA_FISICA_MODULADA_FDISP",
                    "GARANTIA_FISICA_REDE_BASICA", "ENTREGA_MRE", "CUSTO_MRE", "VALOR_ALOCADO_MRE"),
        "leitor": "mensal", "dims": ()},
    "encargo_ess_ancilar": {
        "painel": "P035", "titulo": "Encargos de serviços do sistema por tipo",
        "colunas": ("MES_REFERENCIA", "ENCARGO_CONST_ON", "ENCARGO_CONST_OFF", "OUTROS_SERVICOS_ANCILARES", "ENCARGO_CS",
                    "ENCARGO_SEG_ENER", "RECEBIMENTO_ENCARGO_DH", "ENCARGO_REST_OP_UNIT_COMT", "ENCARGO_IMPORTACAO",
                    "RECEBIMENTO_ENCARGO_RESERVA_OP", "RESSARCIMENTO_SERVICOS_ANCILARES", "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP",
                    "RESSARCIMENTO_CUSTO_OP_MNT_EQUIP_CAG", "RESSARCIMENTO_CUSTO_IMPL_OP_MNT_SEP",
                    "RESSARCIMENTO_CUSTO_EMERGENCIAL", "RESSARCIMENTO_DIST_IMPL_OP_MNT"),
        "leitor": "mensal", "dims": (), "unidade": "R$"},
    "rd_encargos_contab_mensal": {
        "painel": "P035", "titulo": "Encargo de resposta da demanda contabilizado (repasse como ESS), por submercado",
        "colunas": ("MES_REFERENCIA", "SUBMERCADO", "RECEBIMENTO_ENCARGO_RD"), "leitor": "mensal",
        "dims": ("SUBMERCADO",), "unidade": "R$"},
    "reserva_encargo": {
        "painel": "P035", "titulo": "Encargo de energia de reserva e conta CONER",
        "colunas": ("MES_REFERENCIA", "ENCARGO_ENERGIA_RESERVA", "TOTAL_PAGAMENTO_LIQ_ER", "FUNDO_GARANTIA_OPER_CONTR_ER",
                    "TOTAL_RECEITA_RETIDA_CONER", "CUSTO_ADIMN_FIN_TRIB_CCEE", "SALDO_EFETIVO_CONER"),
        "leitor": "mensal", "dims": (), "unidade": "R$"},
    "encargo_pgto_mensal": {
        "painel": "P035", "titulo": "Pagamento de encargos e recursos de alívio do ESS",
        "colunas": ("MES_REFERENCIA", "RESERVA_ALIVIO_ESS", "TOTAL_PENALIDADES_ESS", "SOBRA_EXCED_FINANCEIRO_MA",
                    "FATOR_AJUSTE_ESS", "PAGAMENTO_ENCARGO_ESS", "PAGAMENTO_ENCARGO_SE", "EXCEDENTE_FINANCEIRO_IMPORT",
                    "VALOR_CUSTO_RAZAO_IMPORT"), "leitor": "mensal", "dims": (), "unidade": "R$"},
    "sumario_mensal_compra_venda_submercado": {
        "painel": "P035", "titulo": "Balanço energético e resultado do MCP por submercado",
        "colunas": ("MES_REFERENCIA", "SUBMERCADO", "BE_POSITIVO", "BE_NEGATIVO", "RESULTADO_MCP_VENDA", "RESULTADO_MCP_COMPRA"),
        "leitor": "mensal", "dims": ("SUBMERCADO",)},
    "sumario_mensal_liquidacao": {
        "painel": "P035", "titulo": "Liquidação financeira do MCP: valor a liquidar, liquidado e inadimplência",
        "colunas": ("MES_REFERENCIA", "VALOR_TOTAL_LIQ_PRE", "VALOR_TOTAL_LIQ_POS", "VALOR_INAD"), "leitor": "mensal",
        "dims": (), "unidade": "R$"},
}


def dataset(nome):
    return f"ccee_{nome}"


class EsquemaDivergente(ValueError):
    pass


# ---------------------------------------------------------------- conversões

def mes_ref(txt):
    """'202607' (ou '2026-07') → '2026-07'; outra coisa → None."""
    s = re.sub(r"\D", "", str(txt or ""))
    if len(s) < 6:
        return None
    a, m = int(s[:4]), int(s[4:6])
    return f"{a:04d}-{m:02d}" if 1 <= m <= 12 and 2000 <= a <= 2100 else None


def numero(txt):
    return ckan.numero_br(txt)


def data_br(txt):
    """'01/09/2026' → '2026-09-01'; vazio ou inválido → None."""
    m = re.fullmatch(r"\s*(\d{2})/(\d{2})/(\d{4})\s*", str(txt or ""))
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        return None


def confere_cabecalho(colunas_recebidas, esperadas):
    """Exatamente as colunas esperadas (ordem livre). Divergência levanta EsquemaDivergente."""
    rec = [c.strip().strip('"').lstrip("﻿") for c in colunas_recebidas]
    if sorted(rec) != sorted(esperadas):
        faltam = sorted(set(esperadas) - set(rec))
        sobram = sorted(set(rec) - set(esperadas))
        raise EsquemaDivergente(f"faltam {faltam}; sobram {sobram}")
    return rec


# ---------------------------------------------------------------- leitores (funções puras sobre linhas)

def leitor_mensal(linhas, colunas, dims=(), contagem=None):
    """Conjunto mensal genérico: série '<dim1>|...|<COLUNA>' por mês. Linha repetida com valor
    diferente para a mesma série e mês é conflito (contado; vale a última, como no silver)."""
    contagem = contagem if contagem is not None else {}
    vistos, obs = {}, []
    valores = [c for c in colunas if c not in ("MES_REFERENCIA", *dims)]
    for r in linhas:
        mes = mes_ref(r.get("MES_REFERENCIA"))
        if mes is None:
            contagem["mes_invalido"] = contagem.get("mes_invalido", 0) + 1
            continue
        chave_dims = []
        for d in dims:
            v = (r.get(d) or "").strip()
            if d == "SUBMERCADO":
                v = SUBMERCADOS.get(v.upper())
                if v is None:
                    raise EsquemaDivergente(f"submercado fora do domínio: {r.get(d)!r}")
            elif d in ("CLASSE", "CLASSE_AGENTE") and v not in CLASSES:
                raise EsquemaDivergente(f"classe fora do domínio documentado: {v!r}")
            chave_dims.append(v)
        for col in valores:
            v = numero(r.get(col))
            if v is None:
                contagem["vazios"] = contagem.get("vazios", 0) + 1
                continue
            serie = "|".join(chave_dims + [col])
            k = (serie, mes)
            if k in vistos and abs(vistos[k] - v) > 1e-9:
                contagem["conflitos"] = contagem.get("conflitos", 0) + 1
            vistos[k] = v
            obs.append((serie, mes, v))
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    return obs


def leitor_associados(linhas, contagem=None):
    """Agentes associados mês a mês: contagem de CNPJ distintos por classe e mês (observações) e,
    por CNPJ, os meses em que aparece e a última classe (registros), para contar entradas e
    saídas entre meses na gold. CNPJ é o identificador do agente (pessoa jurídica)."""
    contagem = contagem if contagem is not None else {}
    por_mes, meses_cnpj, info = {}, {}, {}
    for r in linhas:
        mes = mes_ref(r.get("MES_REFERENCIA"))
        cn = entidades.cnpj(r.get("CNPJ"))
        classe = (r.get("CLASSE_AGENTE") or "").strip()
        if mes is None or cn is None:
            contagem["sem_mes_ou_cnpj"] = contagem.get("sem_mes_ou_cnpj", 0) + 1
            continue
        if classe not in CLASSES:
            raise EsquemaDivergente(f"classe fora do domínio documentado: {classe!r}")
        por_mes.setdefault((classe, mes), set()).add(cn)
        meses_cnpj.setdefault(cn, set()).add(mes)
        if mes >= info.get(cn, {}).get("mes", ""):
            info[cn] = {"mes": mes, "classe": classe, "sigla": (r.get("SIGLA_AGENTE") or "").strip(),
                        "varejista": (r.get("INDICADOR_VAREJISTA") or "").strip()}
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    obs = [(f"associados|{classe}", mes, float(len(cs))) for (classe, mes), cs in por_mes.items()]
    regs = []
    for cn, ms in meses_cnpj.items():
        regs.append((f"cnpj|{cn}", "meses", ";".join(sorted(ms))))
        regs.append((f"cnpj|{cn}", "classe", info[cn]["classe"]))
        regs.append((f"cnpj|{cn}", "sigla", info[cn]["sigla"]))
    contagem["cnpjs"] = len(meses_cnpj)
    return obs, regs


def leitor_perfis(linhas, ref, contagem=None):
    """Posição do cadastro de perfis: perfis e agentes (COD_AGENTE) por classe do perfil e status,
    e a distribuição do número de perfis por agente. `ref` é a data da posição (a publicação do
    recurso: o arquivo não traz o mês)."""
    contagem = contagem if contagem is not None else {}
    perfis, agentes, por_agente = {}, {}, {}
    for r in linhas:
        classe = (r.get("CLASSE_PERFIL_AGENTE") or "").strip()
        status = (r.get("STATUS_PERFIL") or "").strip().upper() or "SEM_STATUS"
        cod_ag, cod_pf = (r.get("COD_AGENTE") or "").strip(), (r.get("COD_PERF_AGENTE") or "").strip()
        if not cod_ag or not cod_pf:
            contagem["sem_codigo"] = contagem.get("sem_codigo", 0) + 1
            continue
        if classe not in CLASSES:
            raise EsquemaDivergente(f"classe fora do domínio documentado: {classe!r}")
        perfis.setdefault((classe, status), set()).add(cod_pf)
        agentes.setdefault((classe, status), set()).add(cod_ag)
        if status == "ATIVO":
            por_agente.setdefault(cod_ag, set()).add(cod_pf)
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    obs = [(f"perfis|{c}|{s}", ref, float(len(v))) for (c, s), v in perfis.items()]
    obs += [(f"agentes|{c}|{s}", ref, float(len(v))) for (c, s), v in agentes.items()]
    dist = {}
    for pfs in por_agente.values():
        faixa = "1" if len(pfs) == 1 else ("2" if len(pfs) == 2 else "3_ou_mais")
        dist[faixa] = dist.get(faixa, 0) + 1
    obs += [(f"perfis_por_agente_ativo|{f}", ref, float(n)) for f, n in dist.items()]
    obs.append(("agentes_ativos_total", ref, float(len(por_agente))))
    obs.append(("perfis_ativos_total", ref, float(sum(len(v) for v in por_agente.values()))))
    return obs


def leitor_desligamentos(linhas, contagem=None):
    """Desligamentos (cancelamentos de participação na CCEE): contagem por mês, classe e tipo de
    sucessão; e o registro de cada desligamento (CNPJ e data) para a tabela baixável."""
    contagem = contagem if contagem is not None else {}
    cont, regs = {}, []
    for r in linhas:
        dia = data_br(r.get("DATA_DESLIGAMENTO"))
        cn = entidades.cnpj(r.get("CNPJ_DESLIGADO"))
        if dia is None:
            contagem["sem_data"] = contagem.get("sem_data", 0) + 1
            continue
        tipo = (r.get("TIPO_DESLIGAMENTO") or "").strip().lower() or "nao_informado"
        classe = (r.get("CLASSE_DESLIGADO") or "").strip() or "nao_informada"
        suc = (r.get("TIPO_SUCESSAO") or "").strip().lower() or "nao_informado"
        mes = dia[:7]
        for k in (f"desligamentos|{tipo}|{classe}", f"desligamentos_sucessao|{tipo}|{suc}"):
            cont[(k, mes)] = cont.get((k, mes), 0) + 1
        ch = f"desligamento|{cn or 'sem_cnpj'}|{dia}|{tipo}"
        regs += [(ch, "agente", (r.get("AGENTE_DESLIGADO") or "").strip()), (ch, "classe", classe),
                 (ch, "sucessao", suc), (ch, "cnpj_sucessor", entidades.cnpj(r.get("CNPJ_SUCESSOR"))),
                 (ch, "classe_sucessor", (r.get("CLASSE_SUCESSOR") or "").strip() or None),
                 (ch, "reuniao_cad", (r.get("REUNIAO_CAD") or "").strip() or None)]
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    return [(k, m, float(n)) for (k, m), n in cont.items()], regs


REF_SEM_DATA = "sem_data"
CLASSE_DISTRIBUIDOR = "Distribuidor"
CLASSE_EXPORTADOR = "Exportador"
SEM_CADASTRO = "sem_cadastro"


def leitor_parcelas(linhas, classe_perfil, contagem=None):
    """Parcelas de carga (a unidade de consumo modelada na CCEE, uma ou mais unidades
    consumidoras ligadas a um perfil de agente), por mês.

    O conjunto PARCELA_CARGA_CONSUMO traz também as parcelas das distribuidoras (139 em
    julho de 2026): cada uma é o consumo do ACR de uma área de concessão, na coluna
    CONSUMO_ACL apesar do nome. Somá-las ao resto, como fazia a versão 1 deste leitor, punha o
    ACR dentro do "consumo ACL" (51,1 TWh em julho de 2026, contra 21,8 TWh do ACL). A
    separação é pela classe do perfil no cadastro LISTA_PERFIL_V1 (`classe_perfil`:
    COD_PERF_AGENTE → classe), não pelo RAMO_ATIVIDADE vazio: em fevereiro de 2025, 215
    parcelas de consumidores especiais vieram com o ramo vazio. Conferência (no módulo):
    as parcelas dos perfis Distribuidor somam, mês a mês, o consumo da classe Distribuidor
    de CONSUMO_CLASSE_AGENTE.

    Séries: '<grupo>|parcelas', '|perfis_com_parcela', '|cnpj_carga', '|migracoes_no_mes',
    '|consumo_acl_mwh', '|consumo_total_mwh', '|consumo_cativo_parc_livre_mwh', com grupo
    'acl' (todos os perfis que não são de distribuidora, inclusive exportadores) ou
    'distribuidor'; 'classe|<classe do perfil>|parcelas' e '|consumo_acl_mwh' (perfil fora
    do cadastro vigente = 'sem_cadastro'); 'acl|parcelas_sm|<SM>' e 'acl|parcelas_uf|<UF>'.
    Sem o cadastro de perfis, nada é lido (EsquemaDivergente): parcela sem classificação
    misturaria os dois ambientes."""
    if not classe_perfil:
        raise EsquemaDivergente("cadastro de perfis (LISTA_PERFIL_V1) ausente: as parcelas das distribuidoras não podem ser separadas")
    contagem = contagem if contagem is not None else {}
    conj = {}      # (grupo, medida, mês) → set
    soma = {}      # (série, mês) → MWh

    def add(k, mes, v):
        conj.setdefault((k, mes), set()).add(v)

    for r in linhas:
        mes = mes_ref(r.get("MES_REFERENCIA"))
        cod = (r.get("COD_PARCELA_CARGA") or "").strip()
        if mes is None or not cod:
            contagem["sem_mes_ou_parcela"] = contagem.get("sem_mes_ou_parcela", 0) + 1
            continue
        perfil = (r.get("COD_PERF_AGENTE") or "").strip()
        classe = classe_perfil.get(perfil)
        grupo = "distribuidor" if classe == CLASSE_DISTRIBUIDOR else "acl"
        rotulo = classe or SEM_CADASTRO
        ramo_vazio = not (r.get("RAMO_ATIVIDADE") or "").strip()
        if classe is None:
            contagem["linhas_perfil_sem_cadastro"] = contagem.get("linhas_perfil_sem_cadastro", 0) + 1
        if ramo_vazio and grupo == "acl":
            contagem["ramo_vazio_fora_de_distribuidor"] = contagem.get("ramo_vazio_fora_de_distribuidor", 0) + 1
        if not ramo_vazio and grupo == "distribuidor":
            contagem["distribuidor_com_ramo"] = contagem.get("distribuidor_com_ramo", 0) + 1
        add(f"{grupo}|parcelas", mes, cod)
        add(f"{grupo}|perfis_com_parcela", mes, perfil)
        add(f"classe|{rotulo}|parcelas", mes, cod)
        cn = entidades.cnpj(r.get("CNPJ_CARGA"))
        if cn:
            add(f"{grupo}|cnpj_carga", mes, cn)
        dm = data_br(r.get("DATA_MIGRACAO"))
        if dm and dm[:7] == mes:
            add(f"{grupo}|migracoes_no_mes", mes, cod)
        if grupo == "acl":
            sm = SUBMERCADOS.get((r.get("SUBMERCADO") or "").strip().upper())
            uf = (r.get("ESTADO_UF") or "").strip().upper()
            if sm:
                add(f"acl|parcelas_sm|{sm}", mes, cod)
            if re.fullmatch(r"[A-Z]{2}", uf):
                add(f"acl|parcelas_uf|{uf}", mes, cod)
        for col, chave in (("CONSUMO_ACL", "consumo_acl_mwh"), ("CONSUMO_TOTAL", "consumo_total_mwh"),
                           ("CONSUMO_CATIVO_PARC_LIVRE", "consumo_cativo_parc_livre_mwh")):
            v = numero(r.get(col))
            if v is None:
                continue
            for serie in ([f"{grupo}|{chave}", f"classe|{rotulo}|{chave}"] if chave == "consumo_acl_mwh" else [f"{grupo}|{chave}"]):
                soma[(serie, mes)] = soma.get((serie, mes), 0.0) + v
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    meses = {m for (_, m) in conj}
    obs = [(k, m, float(len(v))) for (k, m), v in conj.items()]
    # contagem zero explícita onde o mês existe e o grupo não tem nenhuma migração
    for grupo in ("acl", "distribuidor"):
        for m in meses:
            if (f"{grupo}|parcelas", m) in conj and (f"{grupo}|migracoes_no_mes", m) not in conj:
                obs.append((f"{grupo}|migracoes_no_mes", m, 0.0))
    obs += [(k, m, v) for (k, m), v in soma.items()]
    return obs


def classes_de_perfil(con):
    """COD_PERF_AGENTE → CLASSE_PERFIL_AGENTE do cadastro LISTA_PERFIL_V1 mais recente no bronze
    (leitura em fluxo, sem rede). A classe é atributo do perfil: um perfil de distribuidora não
    muda de classe; perfil encerrado continua no cadastro com status ENCERRADO."""
    vs = base.vintages_do_dataset(con, dataset("lista_perfil_v1"))
    if not vs:
        return {}
    v = max(vs, key=lambda x: x["capturado_em"])
    out = {}
    for r in ckan.le_csv_bronze(v["arquivo"], separador=";"):
        r = {k.strip().strip('"').lstrip("\ufeff"): val for k, val in r.items()}
        cod = (r.get("COD_PERF_AGENTE") or "").strip()
        if cod:
            out[cod] = (r.get("CLASSE_PERFIL_AGENTE") or "").strip()
    return out


# ---------------------------------------------------------------- coleta

def metadados(nome, baixar=http_get):
    """package_show ao vivo; sem resposta, o mais recente versionado no seed (só para listar os
    recursos: o download continua dependendo do portal)."""
    try:
        corpo, _ = baixar(f"{PORTAL}/api/3/action/package_show?id={nome}", timeout=60)
        return json.loads(corpo.decode("utf-8"))["result"], "ao_vivo"
    except Exception as e:
        erro = str(e)
    if os.path.isdir(SEED_DIR):
        for versao in sorted(os.listdir(SEED_DIR), reverse=True):
            caminho = os.path.join(SEED_DIR, versao, f"package_show_{nome}.json")
            if os.path.isfile(caminho):
                with open(caminho, encoding="utf-8") as f:
                    return json.load(f)["result"], f"seed:{versao} (package_show ao vivo falhou: {erro[:120]})"
    raise RuntimeError(f"package_show {nome}: {erro}")


def versao_leitor(nome):
    """Versão do leitor de um conjunto: a geral mais a própria do conjunto, quando ele foi
    corrigido depois (só o conjunto corrigido é relido do bronze)."""
    extra = CONJUNTOS[nome].get("versao_leitor")
    return f"{VERSAO_LEITOR}.{extra}" if extra else VERSAO_LEITOR


def _ja_processada(con, ds, vid, versao=VERSAO_LEITOR):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? LIMIT 1",
                       (ds, f"__processada__|{vid}|{versao}")).fetchone() is not None


def processa_vintage(con, nome, v, classe_perfil=None):
    """Confere o cabeçalho do arquivo do bronze e grava as observações. Esquema divergente: falha
    registrada, nada gravado. Retorna o status. `classe_perfil` (parcelas de carga): classe de
    cada perfil; sem ele, é lida do cadastro de perfis do bronze."""
    spec, ds = CONJUNTOS[nome], dataset(nome)
    versao = versao_leitor(nome)
    if _ja_processada(con, ds, v["vintage_id"], versao):
        return {"reprocessada": False}
    sep = spec.get("separador", ";")
    linhas = ckan.le_csv_bronze(v["arquivo"], separador=sep)
    primeira = next(linhas, None)
    if primeira is None:
        base.registra_coleta(con, ds, v["recurso"], False, "arquivo vazio")
        con.commit()
        return {"reprocessada": False, "erro": "arquivo vazio"}
    try:
        confere_cabecalho(list(primeira.keys()), spec["colunas"])
    except EsquemaDivergente as e:
        base.registra_coleta(con, ds, v["recurso"], False, f"esquema divergente: {e}; colunas {list(primeira.keys())}"[:500])
        con.commit()
        return {"reprocessada": False, "erro": f"esquema divergente: {e}"}

    def todas():
        yield {k.strip().strip('"').lstrip("﻿"): val for k, val in primeira.items()}
        for r in linhas:
            yield {k.strip().strip('"').lstrip("﻿"): val for k, val in r.items()}

    contagem, regs = {}, []
    try:
        if spec["leitor"] == "mensal":
            obs = leitor_mensal(todas(), spec["colunas"], spec.get("dims", ()), contagem)
        elif spec["leitor"] == "associados":
            obs, regs = leitor_associados(todas(), contagem)
        elif spec["leitor"] == "perfis":
            # o arquivo não traz a data da posição; a referência é a data de modificação que o
            # portal informa para o recurso (last_modified do CKAN), rotulada como tal na gold.
            # Data de captura nunca substitui data do dado: sem a do portal, 'sem_data'.
            ref = (v.get("publicado_em") or "")[:10] or REF_SEM_DATA
            obs = leitor_perfis(todas(), ref, contagem)
        elif spec["leitor"] == "desligamentos":
            obs, regs = leitor_desligamentos(todas(), contagem)
        elif spec["leitor"] == "parcelas":
            obs = leitor_parcelas(todas(), classe_perfil if classe_perfil is not None else classes_de_perfil(con), contagem)
        else:
            raise EsquemaDivergente(f"leitor desconhecido {spec['leitor']}")
    except EsquemaDivergente as e:
        base.registra_coleta(con, ds, v["recurso"], False, f"domínio divergente: {e}"[:500])
        con.commit()
        return {"reprocessada": False, "erro": f"domínio divergente: {e}"}
    novas, rev = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    if regs:
        # meses de presença por recurso (arquivo anual): o campo leva o nome do recurso para que
        # o arquivo de um ano não apague o do outro
        regs = [(ch, f"{campo}|{v['recurso']}" if campo == "meses" else campo, val) for ch, campo, val in regs]
        base.grava_registros(con, ds, v["vintage_id"], regs)
    marca = [(f"__processada__|{v['vintage_id']}|{versao}", "ok", "1")]
    marca += [(f"__universo__|{v['vintage_id']}", k, str(val)) for k, val in sorted(contagem.items())]
    base.grava_registros(con, ds, v["vintage_id"], marca)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def reprocessa_bronze(con, nomes=None):
    """Relê do bronze, sem rede, as vintages ainda não processadas pela versão vigente do leitor
    de cada conjunto (por exemplo, depois de uma correção de leitor). Nunca lança."""
    status = {}
    classes = None
    for nome in CONJUNTOS:
        if nomes is not None and nome not in nomes:
            continue
        ds, versao = dataset(nome), versao_leitor(nome)
        st = status.setdefault(nome, {"ok": True, "recursos": {}})
        for v in sorted(base.vintages_do_dataset(con, ds), key=lambda x: x["capturado_em"]):
            if _ja_processada(con, ds, v["vintage_id"], versao):
                continue
            if CONJUNTOS[nome]["leitor"] == "parcelas" and classes is None:
                classes = classes_de_perfil(con)
            try:
                res = processa_vintage(con, nome, v, classes)
            except Exception as e:  # arquivo ilegível no bronze: registrado, nada gravado
                res = {"reprocessada": False, "erro": f"{type(e).__name__}: {e}"[:300]}
            st["recursos"][v["recurso"]] = res
            st["ok"] = st["ok"] and "erro" not in res
    return status


def coleta(con, baixar_meta=http_get, baixador=http_download, pausa_s=0.5, max_idade_dias=7, nomes=None, autorizada=None):
    """Coleta todos os conjuntos (ou só os de `nomes`). Nunca lança: falha vira registro em
    `coletas` e status. Sem autorização explícita (`coleta_autorizada`), não faz nenhuma
    requisição à CCEE: só relê o bronze (`reprocessa_bronze`)."""
    if not (coleta_autorizada() if autorizada is None else autorizada):
        return {"ok": True, "coleta": "suspensa", "motivo": PENDENCIA_ACESSO,
                "reprocessamento_do_bronze": reprocessa_bronze(con, nomes)}
    status = {}
    for nome, spec in CONJUNTOS.items():
        if nomes is not None and nome not in nomes:
            continue
        ds = dataset(nome)
        st = {"ok": False, "recursos": {}}
        status[nome] = st
        try:
            pac, origem = metadados(nome, baixar_meta)
        except Exception as e:
            base.registra_coleta(con, ds, "*", False, str(e)[:500])
            con.commit()
            st["erro"] = str(e)[:300]
            continue
        st["metadados"] = origem
        recursos = sorted([r for r in pac.get("resources", []) if (r.get("format") or "").upper() == "CSV"
                           and re.fullmatch(r"[a-z0-9_]{3,80}", (r.get("name") or "").strip())],
                          key=lambda r: r["name"])
        if spec.get("recursos") == "ultimo":
            recursos = recursos[-1:]
        for r in recursos:
            res = ckan.baixar_recurso(con, orgao="CCEE", dataset=ds, recurso=r["name"].strip(), url=r["url"],
                                      publicado_em=r.get("last_modified"), ext="csv", max_idade_dias=max_idade_dias,
                                      baixador=baixador)
            item = {"status": res["status"], "detalhe": res["detalhe"]}
            if res["vintage"] and res["status"] != "falha":
                item["processamento"] = processa_vintage(con, nome, res["vintage"])
            st["recursos"][r["name"]] = item
            if res["status"] in ("nova", "identica") and pausa_s:
                time.sleep(pausa_s)
        st["ok"] = bool(st["recursos"]) and all(x["status"] != "falha" and "erro" not in x.get("processamento", {})
                                                for x in st["recursos"].values())
    return status


def situacao(con):
    """Estado de cada conjunto a partir do silver (sem rede)."""
    out = []
    for nome, spec in CONJUNTOS.items():
        ds = dataset(nome)
        ultima = con.execute("SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset=? ORDER BY rowid DESC LIMIT 1",
                             (ds,)).fetchone()
        ultima_ok = con.execute("SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND ok=1", (ds,)).fetchone()[0]
        falhas = con.execute("SELECT COUNT(*) FROM coletas WHERE dataset=? AND ok=0", (ds,)).fetchone()[0]
        vint = base.vintages_do_dataset(con, ds)
        obs = con.execute("SELECT COUNT(*) FROM observacoes WHERE dataset=?", (ds,)).fetchone()[0]
        out.append({"conjunto": nome, "dataset": ds, "painel": spec["painel"], "titulo": spec["titulo"],
                    "url": f"{PORTAL}/dataset/{nome}", "colunas_esperadas": list(spec["colunas"]),
                    "ultima_tentativa": ultima[0] if ultima else None, "ultima_tentativa_ok": bool(ultima[1]) if ultima else None,
                    "ultimo_detalhe": (ultima[2] or "")[:300] if ultima else None, "ultima_coleta_ok": ultima_ok,
                    "falhas_registradas": falhas, "arquivos": len({x["recurso"] for x in vint}), "observacoes": obs})
    return out


# ---------------------------------------------------------------- InfoMercado mensal (conferência)

# InfoMercado mensal (PDF da CCEE): publicação oficial independente dos conjuntos abertos, usada
# para conferir os números calculados. O sumário executivo traz em texto o fator de ajuste do MRE
# (GSF), a geração do MRE, os agentes contabilizados, o "Consumo/Geração" (lado da geração, não é
# o consumo), o total de encargos e o total a liquidar do mês de contabilização; a seção de
# consumo traz "O consumo contabilizou X MW médios" (o consumo sem a exportação) e, em nota, a
# exportação do mês; a seção do MRE traz, desde 2026, o "ajuste médio do MRE" dos últimos doze
# meses; a seção de encargos traz a composição do total e o alívio. A página "Mercado Mensal" da CCEE expõe só a edição mais recente (campo
# url_documento_boletim, com a data de publicação ao lado): o coletor guarda a página no bronze,
# baixa a edição corrente em cada execução e acumula as edições no silver. As duas edições fixas
# abaixo (agosto e outubro de 2024) foram localizadas antes, no endereço de documentos da CCEE;
# edições intermediárias não são listadas pela página e não foram procuradas por adivinhação de endereço.
INFOMERCADO = [
    {"numero": "206", "url": "https://www.ccee.org.br/documents/80415/28517714/InfoMercado-mensal_ago_24_206.pdf/1bddcc1f-c240-cbe3-bae9-fc27f2fa98cf"},
    {"numero": "208", "url": "https://www.ccee.org.br/documents/80415/28965781/InfoMercado-mensal_out_24_208.pdf/d07ecb26-422f-f2ff-a5c4-2fab60997420"},
]
URL_MERCADO_MENSAL = "https://www.ccee.org.br/web/guest/dados-e-analises/dados-mercado-mensal"
DS_INFOMERCADO = "ccee_infomercado"
# Versão do extrator do InfoMercado, separada da dos conjuntos: mudar a extração dos PDFs não
# reprocessa os CSV grandes (parcelas de carga).
VERSAO_INFOMERCADO = "infomercado-5"
MESES_PT = {"janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
            "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}

# Rótulo da parcela no parágrafo "Do total de encargos (...)" → componente. O texto mudou entre
# 2024 ("restrição da operação", "serviços ancilares") e 2026 ("restrição de operação", "suporte
# de reativo", deslocamento hidráulico separado por perfis de geração e de consumo, "suporte de
# reativo vinculado ao sandbox"); rótulo fora desta lista é registrado e impede a conferência do
# total (nenhum componente é adivinhado).
COMPONENTES_ENCARGOS = {
    "restrição da operação": "restricao_operacao", "restrição de operação": "restricao_operacao",
    "serviços ancilares": "servicos_ancilares", "suporte de reativo": "suporte_reativo",
    "encargo de importação": "importacao", "importação de energia": "importacao",
    "deslocamento hidráulico": "deslocamento_hidraulico",
    "deslocamento hidráulico de perfis de geração": "deslocamento_hidraulico",
    "deslocamento hidráulico de perfis de consumo": "deslocamento_hidraulico",
    "segurança energética": "seguranca_energetica", "reserva operativa": "reserva_operativa",
    "resposta da demanda": "resposta_demanda", "suporte de reativo vinculado ao sandbox": "suporte_reativo_sandbox",
}
# Componentes publicados no InfoMercado que não são colunas do conjunto ENCARGO_ESS_ANCILAR.
COMPONENTES_FORA_DO_CONJUNTO = ("resposta_demanda", "suporte_reativo_sandbox")


def _num_br(txt):
    return float(txt.replace(".", "").replace(",", "."))


def infomercado_valores(texto):
    """Valores do sumário executivo de uma edição do InfoMercado mensal (texto do pdftotext).
    Retorna {"numero", "mes", "valores": {medida: valor}, "paginas": {medida: página},
    "rotulos_desconhecidos": [rótulo], "parcelas": {medida: quantas parcelas publicadas somam o
    componente}}; medida ausente fica de fora. A página (1 = primeira) vem
    das quebras de página (\f) que o pdftotext preserva, para a evidência apontar onde o número
    está no documento."""
    cab = re.search(r"Nº\s*(\d+)\s*[–-]\s*Contabilização de ([a-zç]+) de (\d{4})", texto)
    if not cab:
        raise ValueError("cabeçalho 'Nº … – Contabilização de <mês> de <ano>' não encontrado")
    mes = f"{cab.group(3)}-{MESES_PT[cab.group(2).lower()]:02d}"
    padroes = {
        "gsf_pct": r"[Ff]ator de ajuste do MRE foi de ([\d.,]+)%",
        "geracao_mre_mwmed": r"As usinas do MRE geraram ([\d.,]+) MW médios",
        "agentes_contabilizados": r"([\d.]+) agentes participaram da contabilização",
        "consumo_geracao_mwmed": r"O Consumo/Geração atingiu ([\d.,]+) MW médios",
        "consumo_contabilizado_mwmed": r"O consumo contabilizou ([\d.,]+) MW médios",
        "exportacao_mwmed": r"[Hh]ouve exportação de ([\d.,]+) MW médios",
        "gsf_12m_pct": r"[Nn]os últimos doze\s+meses,?\s+(?:o\s+)?ajuste médio do MRE (?:é|foi) de ([\d.,]+)%",
        "acl_variacao_sem_exportacao_pct": r"ACL avançou ([\d.,]+)% sem considerar os efeitos da\s+exportação",
        "encargos_milhoes_rs": r"O total de encargos foi de R\$ ([\d.,]+) milhões",
        "liquidar_bilhoes_rs": r"O total a liquidar foi de R\$ ([\d.,]+) bilhões",
    }
    valores, paginas, desconhecidos, parcelas = {}, {}, [], {}
    for k, p in padroes.items():
        m = re.search(p, texto)
        if m:
            valores[k] = _num_br(m.group(1))
            paginas[k] = texto.count("\f", 0, m.start()) + 1
    # composição do total de encargos, no parágrafo da seção de encargos (coluna da direita do
    # -layout): é ela que mostra que o total do InfoMercado inclui parcelas que não são colunas
    # do conjunto ENCARGO_ESS_ANCILAR (resposta da demanda, suporte de reativo do sandbox)
    par, inicio = _paragrafo_coluna(texto, "Do total de encargos", linhas=9)
    if par:
        pg = texto.count("\f", 0, inicio) + 1
        m = re.search(r"Do total de encargos \(R\$ ([\d.,]+) milhões\)", par)
        if m:
            valores["encargos_total_detalhe_milhoes_rs"] = _num_br(m.group(1))
            paginas["encargos_total_detalhe_milhoes_rs"] = pg
        for m in re.finditer(r"\((?:R\$\s*)?([\d.,]+)\s+milhões\)\s+(?:foi devido a|de)\s+(.+?)(?=,\s*\d|\s+e\s+\d|\.\s|\.$)", par):
            rot = m.group(2).strip()
            comp = COMPONENTES_ENCARGOS.get(rot)
            if comp is None:
                desconhecidos.append(rot)
                continue
            k = f"encargos_{comp}_milhoes_rs"
            valores[k] = valores.get(k, 0.0) + _num_br(m.group(1))
            paginas[k] = pg
            parcelas[k] = parcelas.get(k, 0) + 1
        m = re.search(r"Houve R\$ ([\d.,]+) milhões de alívio", par)
        if m:
            valores["alivio_ess_milhoes_rs"] = _num_br(m.group(1))
            paginas["alivio_ess_milhoes_rs"] = pg
    return {"numero": cab.group(1), "mes": mes, "valores": valores, "paginas": paginas,
            "rotulos_desconhecidos": desconhecidos, "parcelas": parcelas}


def _paragrafo_coluna(texto, marcador, linhas=7):
    """Parágrafo que começa no marcador, lido só na coluna em que ele está (o -layout põe duas
    colunas lado a lado na mesma linha). Retorna (texto em uma linha, posição do marcador)."""
    i = texto.find(marcador)
    if i < 0:
        return None, -1
    ini_linha = texto.rfind("\n", 0, i) + 1
    col = i - ini_linha
    partes = []
    for l in texto[ini_linha:].splitlines()[:linhas]:
        trecho = l[max(0, col - 3):].strip()
        if not trecho:
            break
        partes.append(trecho)
    return re.sub(r"\s+", " ", " ".join(partes)), i


def edicao_corrente(html):
    """(url do PDF, número da edição, data de publicação 'AAAA-MM-DD' | None) da edição mais
    recente exposta na página Mercado Mensal; None quando a página não traz o campo."""
    m = re.search(r'id="url_documento_boletim"[^>]*value="([^"]+\.pdf[^"]*)"', html)
    if not m:
        return None
    url = m.group(1)
    n = re.search(r"_(\d{3,4})\.pdf", url)
    d = re.search(r'id="data_publicacao_documento"[^>]*value="(\d{2})/(\d{2})/(\d{2})"', html)
    quando = f"20{d.group(3)}-{d.group(2)}-{d.group(1)}" if d else None
    return (url, n.group(1) if n else None, quando)


def _texto_pdf_bronze(arquivo):
    """Texto (pdftotext -layout) de um PDF guardado no bronze (.pdf.gz), descomprimido em fluxo
    para um temporário. None quando o pdftotext não está instalado."""
    import shutil
    import subprocess
    import tempfile
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(prefix="infomercado-", suffix=".pdf")
    os.close(fd)
    try:
        with base.abre_bronze(arquivo) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
        r = subprocess.run([exe, "-layout", tmp, "-"], capture_output=True, timeout=120)
        if r.returncode != 0:
            raise ValueError(f"pdftotext falhou: {r.stderr[:200]!r}")
        return r.stdout.decode("utf-8", errors="replace")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def _processa_edicao(con, numero, url, v, extrai_texto):
    """Extrai os números de uma edição do InfoMercado já no bronze e grava no silver. Retorna o
    item de status (com 'erro' quando nada foi gravado)."""
    recurso = f"InfoMercado-mensal_{numero}.pdf"
    item = {}
    if con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? LIMIT 1",
                   (DS_INFOMERCADO, f"__processada__|{v['vintage_id']}|{VERSAO_INFOMERCADO}")).fetchone():
        return item
    try:
        texto = extrai_texto(v["arquivo"])
        if texto is None:
            item["erro"] = "pdftotext ausente: extração adiada"
            return item
        vals = infomercado_valores(texto)
    except Exception as e:  # PDF fora do formato verificado: nada é gravado
        base.registra_coleta(con, DS_INFOMERCADO, recurso, False, f"extração: {e}"[:500])
        con.commit()
        item["erro"] = str(e)[:300]
        return item
    if vals["numero"] != numero:
        base.registra_coleta(con, DS_INFOMERCADO, recurso, False,
                             f"número da edição no PDF ({vals['numero']}) difere do esperado ({numero})")
        con.commit()
        item["erro"] = "edição divergente"
        return item
    obs = [(f"im|{vals['numero']}|{k}", vals["mes"], val) for k, val in vals["valores"].items()]
    ch = f"edicao|{vals['numero']}"
    regs = [(ch, "mes", vals["mes"]), (ch, "recurso", recurso), (ch, "vintage", v["vintage_id"]), (ch, "url", url),
            (ch, "rotulos_desconhecidos", json.dumps(vals["rotulos_desconhecidos"], ensure_ascii=False))]
    regs += [(ch, f"pagina|{k}", str(p)) for k, p in vals["paginas"].items()]
    regs += [(ch, f"parcelas|{k}", str(n)) for k, n in vals["parcelas"].items()]
    regs.append((f"__processada__|{v['vintage_id']}|{VERSAO_INFOMERCADO}", "ok", "1"))
    novas, rev = base.grava_observacoes(con, DS_INFOMERCADO, v["vintage_id"], obs)
    base.grava_registros(con, DS_INFOMERCADO, v["vintage_id"], regs)
    con.commit()
    item.update(medidas=sorted(vals["valores"]), novas=novas, revisoes=rev, rotulos_desconhecidos=vals["rotulos_desconhecidos"])
    return item


def reprocessa_infomercado(con, extrai_texto=_texto_pdf_bronze):
    """Relê do bronze, sem rede, as edições do InfoMercado ainda não extraídas pela versão vigente
    do extrator (a mais recente captura de cada edição)."""
    status = {"ok": True, "edicoes": {}}
    ultimas = {}
    for v in base.vintages_do_dataset(con, DS_INFOMERCADO):
        m = re.fullmatch(r"InfoMercado-mensal_(\d+)\.pdf", v["recurso"])
        if m and (m.group(1) not in ultimas or v["capturado_em"] > ultimas[m.group(1)]["capturado_em"]):
            ultimas[m.group(1)] = v
    for numero, v in sorted(ultimas.items()):
        item = _processa_edicao(con, numero, v["url"], v, extrai_texto)
        status["edicoes"][v["recurso"]] = item
        status["ok"] = status["ok"] and "erro" not in item
    return status


def coleta_infomercado(con, baixador=http_download, extrai_texto=_texto_pdf_bronze, baixar_pagina=http_get, autorizada=None):
    """Baixa as edições do InfoMercado mensal (as fixas de INFOMERCADO e a corrente da página
    Mercado Mensal) para o bronze (sha256, vintage) e grava no silver os números do sumário
    executivo, com a página de cada um. Edição publicada não é atualizada pela CCEE: a recoleta
    de cada PDF é anual. Nunca lança: falha vira registro em `coletas`. Sem autorização
    explícita (`coleta_autorizada`), não faz requisição à CCEE e só relê o bronze."""
    if not (coleta_autorizada() if autorizada is None else autorizada):
        return {"ok": True, "coleta": "suspensa", "motivo": PENDENCIA_ACESSO,
                "reprocessamento_do_bronze": reprocessa_infomercado(con, extrai_texto)}
    status = {"ok": True, "edicoes": {}}
    edicoes = [dict(it, publicado_em=None) for it in INFOMERCADO]
    try:
        corpo, _ = baixar_pagina(URL_MERCADO_MENSAL, timeout=60, accept="text/html")
        capturado = base.agora_utc()
        caminho, sha = base.salva_bronze("ccee", DS_INFOMERCADO, "pagina-mercado-mensal", corpo, "html", capturado)
        base.registra_vintage(con, DS_INFOMERCADO, "pagina-mercado-mensal", URL_MERCADO_MENSAL, capturado, None, sha,
                              len(corpo), "coleta_direta", caminho)
        base.registra_coleta(con, DS_INFOMERCADO, "pagina-mercado-mensal", True, f"{len(corpo)} bytes")
        cor = edicao_corrente(corpo.decode("utf-8", errors="replace"))
        status["edicao_corrente"] = cor and {"url": cor[0], "numero": cor[1], "publicado_em": cor[2]}
        if cor and cor[1] and cor[1] not in {e["numero"] for e in edicoes}:
            edicoes.append({"numero": cor[1], "url": cor[0], "publicado_em": cor[2]})
    except Exception as e:  # página fora do ar: as edições fixas continuam
        base.registra_coleta(con, DS_INFOMERCADO, "pagina-mercado-mensal", False, str(e)[:300])
        status["edicao_corrente"] = None
    con.commit()
    for it in edicoes:
        recurso = f"InfoMercado-mensal_{it['numero']}.pdf"
        res = ckan.baixar_recurso(con, orgao="CCEE", dataset=DS_INFOMERCADO, recurso=recurso, url=it["url"],
                                  publicado_em=it["publicado_em"], ext="pdf", max_idade_dias=365, baixador=baixador)
        item = {"status": res["status"], "detalhe": res["detalhe"]}
        status["edicoes"][recurso] = item
        v = res["vintage"]
        if res["status"] == "falha" or not v:
            status["ok"] = False
            continue
        item.update(_processa_edicao(con, it["numero"], it["url"], v, extrai_texto))
        if "erro" in item:
            status["ok"] = False
    return status
