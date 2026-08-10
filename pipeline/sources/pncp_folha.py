"""Contratações de folha de pagamento com instituições financeiras — PNCP.

A "compra de folha" é o negócio em que um ente público cede a um banco a
gestão da folha dos seus servidores — em regra por leilão/pregão, muitas
vezes com o banco PAGANDO pelo direito (cessão onerosa: o contrato nasce
como receita do ente, não como despesa). O PNCP (Lei 14.133/2021) registra
editais e contratos de todos os entes desde 2023-24, com API pública.

Duas pontas coletadas:
- **editais**: o fluxo vivo — quem está licitando folha agora;
- **contratos**: quem venceu, com o detalhe por contrato trazendo o
  fornecedor (razão social + CNPJ), valor, vigência e o flag `receita`.

O que o dado NÃO permite, declarado desde já:
1. O `valor_global` tem semântica mista: na cessão onerosa é o que o banco
   paga ao ente (receita); em contratos de tarifa é o que o ente paga
   (despesa); em muitos registros é simbólico (R$ 0,01). Os valores NUNCA
   são somados entre si no gold — contagem sim, soma não.
2. Cobertura desde a obrigatoriedade do PNCP (2023-24): leilões anteriores
   (ex.: Fortaleza 2019) só existem na camada curada.
3. "Instituição financeira" é heurística sobre a razão social do fornecedor
   (marcas + BANCO/CAIXA/COOPERATIVA...), declarada no gold; contratos de
   software/assessoria de folha são excluídos pelo objeto.

A busca (api/search) é o índice; o detalhe (api/pncp/v1) é a fonte do
fornecedor. Incremental por numero_controle_pncp: só contratos novos ganham
chamada de detalhe.
"""
import json
import re
import time
import urllib.parse

from pipeline import common

BUSCA = "https://pncp.gov.br/api/search/"
DETALHE = "https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{seq}"
PORTAL = "https://pncp.gov.br"

# consultas complementares — a união (por numero_controle) cobre as variações
# de redação dos objetos; o filtro fino é feito no cliente, sobre o objeto
CONSULTAS = [
    "folha de pagamento servidores instituição financeira",
    "folha de pagamento serviços bancários instituição financeira",
]

# heurística declarada: fornecedor é IF quando a razão social carrega uma
# denominação típica do sistema financeiro ou uma marca bancária conhecida.
# "ITAU UNIBANCO S/A" não contém "BANCO" — daí a lista de marcas.
RE_IF = re.compile(
    r"\b(BANCO|BANCARIO|CAIXA ECONOMICA|COOPERATIVA DE CRED\w*|CREDITO, FINANCIAMENTO"
    r"|ITAU|BRADESCO|SANTANDER|SICREDI|SICOOB|CRESOL|UNICRED|BANRISUL|BANESTES"
    r"|BANPARA|BRB\b|CREFISA|MERCANTIL DO BRASIL|SAFRA|INTER\b|C6\b|BMG\b|PAN\b|DAYCOVAL)",
    re.I)

RE_FOLHA = re.compile(r"folha de pagamento", re.I)

# O PNCP derruba conexões sob carga contínua (medido em 08/2026: "Remote end
# closed" a partir da 3ª página em sequência rápida). As pausas abaixo são o
# ritmo que a fonte aceita; o backfill é RETOMÁVEL — cada execução avança o
# que conseguir e grava o progresso, até marcar o backfill como completo.
# Depois disso, vale a lógica de fronteira (para na primeira página sem novos).
PAGINAS_MAX = 25
TAM_PAGINA = 50
PAUSA_PAGINA_S = 1.0
PAUSA_DETALHE_S = 0.3


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS pncp_folha_contratos(
        numero_controle TEXT PRIMARY KEY, orgao_cnpj TEXT, orgao_nome TEXT,
        esfera TEXT, poder TEXT, municipio TEXT, uf TEXT, modalidade TEXT,
        assinatura TEXT, vig_inicio TEXT, vig_fim TEXT, valor_global REAL,
        receita INTEGER, fornecedor_ni TEXT, fornecedor_nome TEXT,
        eh_if INTEGER, objeto TEXT, item_url TEXT, coletado_em TEXT);
    CREATE TABLE IF NOT EXISTS pncp_folha_editais(
        numero_controle TEXT PRIMARY KEY, orgao_cnpj TEXT, orgao_nome TEXT,
        esfera TEXT, municipio TEXT, uf TEXT, modalidade TEXT, situacao TEXT,
        publicacao TEXT, objeto TEXT, item_url TEXT, coletado_em TEXT);
    CREATE TABLE IF NOT EXISTS pncp_folha_coleta(
        chave TEXT PRIMARY KEY, coletado_em TEXT, detalhe TEXT);
    """)


def _busca(q, tipo, pagina):
    url = (f"{BUSCA}?q={urllib.parse.quote(q)}&tipos_documento={tipo}"
           f"&ordenacao=-data&pagina={pagina}&tam_pagina={TAM_PAGINA}")
    body, _meta = common.http_get(url, timeout=60)
    return json.loads(body)


def _detalhe_contrato(cnpj, ano, seq):
    body, _meta = common.http_get(DETALHE.format(cnpj=cnpj, ano=ano, seq=seq), timeout=60)
    return json.loads(body)


def _backfill_completo(con, fase):
    return bool(con.execute("SELECT 1 FROM pncp_folha_coleta WHERE chave=?",
                            (f"backfill_{fase}",)).fetchone())


def _marca_backfill(con, fase, agora):
    con.execute("INSERT OR REPLACE INTO pncp_folha_coleta VALUES(?,?,?)",
                (f"backfill_{fase}", agora, "todas as páginas percorridas sem falha"))


def _absorve_edital(con, it, agora):
    nc = it.get("numero_controle_pncp")
    if not nc or not RE_FOLHA.search(it.get("description") or ""):
        return False
    existe = con.execute("SELECT 1 FROM pncp_folha_editais WHERE numero_controle=?", (nc,)).fetchone()
    con.execute(
        "INSERT OR REPLACE INTO pncp_folha_editais VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (nc, it.get("orgao_cnpj"), it.get("orgao_nome"), it.get("esfera_nome"),
         it.get("municipio_nome"), it.get("uf"), it.get("modalidade_licitacao_nome"),
         it.get("situacao_nome"), (it.get("data_publicacao_pncp") or "")[:10],
         (it.get("description") or "")[:400], it.get("item_url"), agora))
    return not existe


def _absorve_contrato(con, it, agora, detalhes):
    if not RE_FOLHA.search(it.get("description") or ""):
        return False
    nc = it.get("numero_controle_pncp")
    if not nc or con.execute(
            "SELECT 1 FROM pncp_folha_contratos WHERE numero_controle=?", (nc,)).fetchone():
        return False
    det = _detalhe_contrato(it["orgao_cnpj"], it["ano"], it["numero_sequencial"])
    time.sleep(PAUSA_DETALHE_S)
    fornecedor = (det.get("nomeRazaoSocialFornecedor") or "").strip()
    con.execute(
        "INSERT OR REPLACE INTO pncp_folha_contratos VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (nc, it.get("orgao_cnpj"), it.get("orgao_nome"), it.get("esfera_nome"),
         it.get("poder_nome"), it.get("municipio_nome"), it.get("uf"),
         it.get("modalidade_licitacao_nome"), det.get("dataAssinatura"),
         det.get("dataVigenciaInicio"), det.get("dataVigenciaFim"),
         det.get("valorGlobal"), 1 if det.get("receita") else 0,
         det.get("niFornecedor"), fornecedor,
         1 if RE_IF.search(fornecedor) else 0,
         (det.get("objetoContrato") or "")[:400], it.get("item_url"), agora))
    detalhes.append(det)
    return True


def _coleta_fase(con, fase, agora):
    """Percorre as consultas de uma fase (edital|contrato). Página falhada não
    derruba a fase: o progresso já absorvido fica commitado e a próxima
    execução retoma — o backfill só é dado por completo depois de uma
    passada inteira sem falha de conexão."""
    tipo = "edital" if fase == "editais" else "contrato"
    novos, falhas, detalhes = 0, 0, []
    completo = True
    backfill_feito = _backfill_completo(con, fase)
    for q in CONSULTAS:
        for pagina in range(1, PAGINAS_MAX + 1):
            try:
                d = _busca(q, tipo, pagina)
            except Exception:
                falhas += 1
                completo = False
                break  # esta consulta para aqui; a próxima execução retoma
            itens = d.get("items") or []
            pagina_teve_novo = False
            for it in itens:
                try:
                    if fase == "editais":
                        if _absorve_edital(con, it, agora):
                            novos += 1
                            pagina_teve_novo = True
                    else:
                        if _absorve_contrato(con, it, agora, detalhes):
                            novos += 1
                            pagina_teve_novo = True
                except Exception:
                    falhas += 1  # detalhe fora do ar: o item volta na próxima execução
                    completo = False
            con.commit()  # progresso por página: falha adiante não perde o absorvido
            if len(itens) < TAM_PAGINA:
                break  # fim real da lista desta consulta
            if backfill_feito and not pagina_teve_novo and pagina > 1:
                break  # fronteira: dali para trás é histórico já absorvido
            time.sleep(PAUSA_PAGINA_S)
    if detalhes:
        corpo = json.dumps(detalhes, ensure_ascii=False).encode()
        _, sha = common.save_bronze("pncp_folha", "contratos_novos.json", corpo,
                                    {"fonte": "PNCP api/pncp/v1 contratos", "novos": str(len(detalhes))})
        common.record_lineage(con, "folha_bancos.json", "pncp_folha/contratos_novos.json", sha,
                              "detalhe de contratos PNCP -> pncp_folha_contratos")
    if completo and not backfill_feito:
        _marca_backfill(con, fase, agora)
    return {"key": f"pncp_folha_{fase}", "ok": True, "novos": novos,
            "falhas": falhas, "backfill_completo": completo or backfill_feito}


def collect(con, cfg=None):
    _ensure(con)
    agora = common.now_utc()
    out = [_coleta_fase(con, "contratos", agora), _coleta_fase(con, "editais", agora)]
    con.execute("INSERT OR REPLACE INTO pncp_folha_coleta VALUES(?,?,?)",
                ("pncp_folha", agora, json.dumps(out, ensure_ascii=False)))
    con.commit()
    return out
