"""Coletor dos conjuntos de mercado do portal de dados abertos da CCEE (CC-BY-4.0) para o módulo Mercado.

Situação de acesso (verificada em 01/10/2026): o portal dadosabertos.ccee.org.br, o servidor
de arquivos pda-download.ccee.org.br e o site www.ccee.org.br respondem HTTP 403 com a página
"Acesso bloqueado" a pedidos feitos com o curl (00:11 e 00:38 UTC), e respondem normalmente ao
cliente HTTP do próprio pipeline (pipeline.common.http_get e http_download, urllib da
biblioteca padrão, User-Agent do projeto) no mesmo intervalo (00:35 a 00:45 UTC). Nada foi
alterado para contornar o bloqueio: o coletor usa o mesmo cliente e o mesmo User-Agent de todo
o pipeline, o mesmo que já coleta o PLD da CCEE no GitHub Actions. Se o portal recusar, a
falha fica em `coletas` e a gold é montada com o que o silver já tem.

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
        "unidade": "MWmed"},
    "consumo_classe_agente": {
        "painel": "P032", "titulo": "Consumo por classe de agente e ambiente (centro de gravidade e ponto de conexão)",
        "colunas": ("MES_REFERENCIA", "CLASSE_AGENTE", "CONSUMO", "CONSUMO_PONTO_CONEXAO_CLASSE_ACR",
                    "CONSUMO_PONTO_CONEXAO_CLASSE_ACL"), "leitor": "mensal", "dims": ("CLASSE_AGENTE",), "unidade": "MWmed"},
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
                    "CONSUMO_ACL", "CONSUMO_CATIVO_PARC_LIVRE", "CONSUMO_TOTAL"), "leitor": "parcelas"},
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


def leitor_parcelas(linhas, contagem=None):
    """Parcelas de carga (a unidade de consumo modelada na CCEE, uma ou mais unidades
    consumidoras ligadas a um perfil de agente), por mês: quantas parcelas, perfis e CNPJ de
    carga distintos; consumo no ACL e total (MWh); parcelas cuja data de migração cai no próprio
    mês (migrações efetivadas no mês); e a abertura por submercado e UF."""
    contagem = contagem if contagem is not None else {}
    parc, perf, cnpjs, migr, soma = {}, {}, {}, {}, {}
    por_sm, por_uf = {}, {}
    for r in linhas:
        mes = mes_ref(r.get("MES_REFERENCIA"))
        cod = (r.get("COD_PARCELA_CARGA") or "").strip()
        if mes is None or not cod:
            contagem["sem_mes_ou_parcela"] = contagem.get("sem_mes_ou_parcela", 0) + 1
            continue
        parc.setdefault(mes, set()).add(cod)
        perf.setdefault(mes, set()).add((r.get("COD_PERF_AGENTE") or "").strip())
        cn = entidades.cnpj(r.get("CNPJ_CARGA"))
        if cn:
            cnpjs.setdefault(mes, set()).add(cn)
        dm = data_br(r.get("DATA_MIGRACAO"))
        if dm and dm[:7] == mes:
            migr.setdefault(mes, set()).add(cod)
        sm = SUBMERCADOS.get((r.get("SUBMERCADO") or "").strip().upper())
        uf = (r.get("ESTADO_UF") or "").strip().upper()
        if sm:
            por_sm.setdefault((sm, mes), set()).add(cod)
        if re.fullmatch(r"[A-Z]{2}", uf):
            por_uf.setdefault((uf, mes), set()).add(cod)
        for col, chave in (("CONSUMO_ACL", "consumo_acl_mwh"), ("CONSUMO_TOTAL", "consumo_total_mwh"),
                           ("CONSUMO_CATIVO_PARC_LIVRE", "consumo_cativo_parc_livre_mwh")):
            v = numero(r.get(col))
            if v is not None:
                soma[(chave, mes)] = soma.get((chave, mes), 0.0) + v
        contagem["linhas"] = contagem.get("linhas", 0) + 1
    obs = []
    for mes in parc:
        obs += [("parcelas", mes, float(len(parc[mes]))), ("perfis_com_parcela", mes, float(len(perf[mes]))),
                ("cnpj_carga", mes, float(len(cnpjs.get(mes, ())))),
                ("migracoes_no_mes", mes, float(len(migr.get(mes, ()))))]
    obs += [(k, m, v) for (k, m), v in soma.items()]
    obs += [(f"parcelas_sm|{sm}", m, float(len(v))) for (sm, m), v in por_sm.items()]
    obs += [(f"parcelas_uf|{uf}", m, float(len(v))) for (uf, m), v in por_uf.items()]
    return obs


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


def _ja_processada(con, ds, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? LIMIT 1",
                       (ds, f"__processada__|{vid}|{VERSAO_LEITOR}")).fetchone() is not None


def processa_vintage(con, nome, v):
    """Confere o cabeçalho do arquivo do bronze e grava as observações. Esquema divergente: falha
    registrada, nada gravado. Retorna o status."""
    spec, ds = CONJUNTOS[nome], dataset(nome)
    if _ja_processada(con, ds, v["vintage_id"]):
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
            ref = (v.get("publicado_em") or v["capturado_em"])[:10]
            obs = leitor_perfis(todas(), ref, contagem)
        elif spec["leitor"] == "desligamentos":
            obs, regs = leitor_desligamentos(todas(), contagem)
        elif spec["leitor"] == "parcelas":
            obs = leitor_parcelas(todas(), contagem)
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
    marca = [(f"__processada__|{v['vintage_id']}|{VERSAO_LEITOR}", "ok", "1")]
    marca += [(f"__universo__|{v['vintage_id']}", k, str(val)) for k, val in sorted(contagem.items())]
    base.grava_registros(con, ds, v["vintage_id"], marca)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def coleta(con, baixar_meta=http_get, baixador=http_download, pausa_s=0.5, max_idade_dias=7):
    """Coleta todos os conjuntos. Nunca lança: falha vira registro em `coletas` e status."""
    status = {}
    for nome, spec in CONJUNTOS.items():
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

# Edições do InfoMercado mensal (PDF da CCEE) usadas como publicação oficial independente para
# conferir os números calculados a partir dos conjuntos abertos. A partir de junho de 2024 a CCEE
# passou a publicar os dados só no portal de dados abertos; estas edições trazem, em texto, o
# fator de ajuste do MRE (GSF), a geração do MRE, o número de agentes contabilizados, o consumo,
# o total de encargos e o total a liquidar do mês de contabilização.
INFOMERCADO = [
    {"numero": "206", "url": "https://www.ccee.org.br/documents/80415/28517714/InfoMercado-mensal_ago_24_206.pdf/1bddcc1f-c240-cbe3-bae9-fc27f2fa98cf"},
    {"numero": "208", "url": "https://www.ccee.org.br/documents/80415/28965781/InfoMercado-mensal_out_24_208.pdf/d07ecb26-422f-f2ff-a5c4-2fab60997420"},
]
DS_INFOMERCADO = "ccee_infomercado"
MESES_PT = {"janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
            "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}


def _num_br(txt):
    return float(txt.replace(".", "").replace(",", "."))


def infomercado_valores(texto):
    """Valores do sumário executivo de uma edição do InfoMercado mensal (texto do pdftotext).
    Retorna {"numero", "mes", "valores": {medida: valor}}; medida ausente fica de fora."""
    cab = re.search(r"Nº\s*(\d+)\s*[–-]\s*Contabilização de ([a-zç]+) de (\d{4})", texto)
    if not cab:
        raise ValueError("cabeçalho 'Nº … – Contabilização de <mês> de <ano>' não encontrado")
    mes = f"{cab.group(3)}-{MESES_PT[cab.group(2).lower()]:02d}"
    padroes = {
        "gsf_pct": r"[Ff]ator de ajuste do MRE foi de ([\d.,]+)%",
        "geracao_mre_mwmed": r"As usinas do MRE geraram ([\d.,]+) MW médios",
        "agentes_contabilizados": r"([\d.]+) agentes participaram da contabilização",
        "consumo_mwmed": r"O Consumo/Geração atingiu ([\d.,]+) MW médios",
        "encargos_milhoes_rs": r"O total de encargos foi de R\$ ([\d.,]+) milhões",
        "liquidar_bilhoes_rs": r"O total a liquidar foi de R\$ ([\d.,]+) bilhões",
    }
    valores = {}
    for k, p in padroes.items():
        m = re.search(p, texto)
        if m:
            valores[k] = _num_br(m.group(1))
    return {"numero": cab.group(1), "mes": mes, "valores": valores}
