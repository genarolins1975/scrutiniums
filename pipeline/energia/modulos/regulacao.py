"""Módulo Regulação (painéis P044 a P046, seção 9.10 da especificação; achado A04 com o PLD).

O que o módulo publica:

* P044, limites e regras de preço: os atos anuais da ANEEL que fixaram piso, teto horário e
  teto estrutural do PLD de 2021 a 2026 (curadoria em pipeline/energia/regulatorio/, cada
  valor lido no texto do ato ou, quando o ato não está acessível, em documento oficial do
  mesmo processo), com publicação separada de vigência, o dispositivo e o trecho literal. A
  gold confere de novo, a cada execução, o trecho contra o PDF guardado no bronze; confere o
  número e a data da deliberação nas atas da Diretoria (dados abertos da ANEEL, caminho
  independente) e reproduz os tetos de cada ano a partir dos publicados no ano anterior pela
  variação do IPCA de novembro (IBGE): é o encadeamento anual que os atos da ANEEL praticam,
  não o texto literal do art. 23, § 1º, da REN nº 1.032/2022 (que parte dos valores de
  setembro de 2019; a diferença da aplicação literal é calculada e publicada). Acrescenta os
  adicionais das bandeiras tarifárias por vigência (dados abertos da ANEEL) e a versão
  vigente de cada módulo do PRODIST e submódulo do PRORET segundo as páginas oficiais.
* P045, linha do tempo: atos que mudam a leitura dos painéis, com dispositivo, publicação,
  vigência, resumo editorial e efeito declarado pelo regulador (literal); impacto estimado
  fica sempre vazio. Os eventos de bandeiras vêm do conjunto de dados, sem texto do ato.
* P046, consultas e agenda: consultas e audiências públicas cuja abertura foi deliberada
  em reunião pública da Diretoria, reconstituídas das atas publicadas, com o período de
  contribuições lido no texto da decisão e a situação derivada da data de hoje (horário de
  Brasília); a Agenda Regulatória 2026-2027 como aprovada (Anexo I da Portaria nº 7.030/2025).

O que não publica, e por quê (detalhe em docs/observatorios/energia/modulos/regulacao.md):
a origem dos atos da ANEEL (www2.aneel.gov.br/cedoc, biblioteca.aneel.gov.br,
git.aneel.gov.br, antigo.aneel.gov.br) responde com desafio de navegador do Cloudflare e o
Diário Oficial (www.in.gov.br) encerra a conexão; não contornamos. Os PDFs vêm da cópia
pública do Internet Archive no modo id_ (bytes originais), conferida pelo sha256
registrado. O InfoPLD da CCEE está em domínio bloqueado e não é fonte de ato.
"""
import csv
import io
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base, evidencia as ev, regulatorio as rg  # noqa: E402
from pipeline.energia.fontes import aneel_regulacao as ar  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "regulacao.json"
FAMILIA = "regulacao"

DS_DOCS = "regulacao_documentos"            # PDFs e páginas de lei citados (um recurso por documento)
DS_CURADORIA = "regulacao_curadoria"        # os JSON curados do pacote regulatorio (vintage = sha256 do arquivo)
DS_ATAS = "aneel_pautas_atas_diretoria"     # pautas e atas das reuniões públicas da Diretoria
DS_PART = "aneel_audiencias_consultas"      # contagens anuais de consultas, audiências e tomadas de subsídios
DS_BAND = "aneel_bandeiras_adicional"       # adicional das bandeiras por resolução e vigência
DS_PAG = "aneel_paginas_regulatorias"       # páginas gov.br (agenda, PRODIST, PRORET, consultas)
DS_IPCA = "ibge_ipca_1737"                  # IPCA número-índice

LIC_ANEEL = "Open Data Commons Open Database License (ODbL)"
LIC_GOVBR = "Conteúdo de portal do Governo Federal (gov.br), uso livre com citação da fonte"
LIC_ATOS = "Ato oficial publicado no Diário Oficial da União; texto normativo de domínio público (Lei nº 9.610/1998, art. 8º, IV)"
LIC_SENADO = "Texto normativo de domínio público (Lei nº 9.610/1998, art. 8º, IV), no portal de Legislação Federal do Senado"
LIC_IBGE = "Dados públicos do IBGE, uso livre com citação da fonte (política de dados abertos do IBGE)"

URL_ATAS = "https://dadosabertos.aneel.gov.br/dataset/pautas-e-atas-das-reunioes-publicas-da-diretoria"
URL_PART = "https://dadosabertos.aneel.gov.br/dataset/audiencias-e-consultas-publicas"
URL_BAND = "https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias"
URL_SIDRA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all"
URL_TABELA_IPCA = "https://sidra.ibge.gov.br/tabela/1737"
PAGINAS = {
    "agenda": "https://www.gov.br/aneel/pt-br/assuntos/governanca-regulatoria/agenda-regulatoria",
    "prodist": "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-regulatorios/prodist",
    "proret": "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-regulatorios/proret",
    "consultas": "https://www.gov.br/aneel/pt-br/acesso-a-informacao/participacao-social/consultas-publicas",
}
URL_REPO = "https://github.com/scrutiniums/scrutiniums/blob/main/pipeline/energia/regulatorio/"
ARQUIVOS_CURADOS = ("limites_pld.json", "limites_pld_conferencia.json", "linha_do_tempo.json", "documentos.json")

ROTA = "/setor-eletrico/regulacao"
PAG = [{"rotulo": "Regulação", "href": ROTA}]
PAG_PLD = [{"rotulo": "Regulação", "href": ROTA}, {"rotulo": "PLD", "href": "/setor-eletrico/pld"}]

CSV_ATOS = "regulacao_limites_pld_atos.csv"
CSV_VIG = "regulacao_limites_pld_vigencias.csv"
CSV_CONF = "regulacao_limites_pld_conferencias.csv"
CSV_BAND = "regulacao_bandeiras_adicionais.csv"
CSV_PROC = "regulacao_procedimentos_vigentes.csv"
CSV_LT = "regulacao_linha_do_tempo.csv"
CSV_CONS = "regulacao_consultas.csv"
CSV_AGENDA = "regulacao_agenda_2026_2027.csv"

# Tolerâncias (seção 11.6: específicas por unidade e precisão).
# Os atos publicam reais com dois decimais. Refazer o teto de um ano a partir do teto
# publicado do ano anterior acumula dois arredondamentos: o do valor anterior (até R$ 0,005,
# multiplicado pelo fator anual do IPCA, no máximo 1,11 no período) e o do valor atual (até
# R$ 0,005). Tolerância: R$ 0,011/MWh. Acima disso a diferença não é arredondamento.
TOL_IPCA_RS = 0.011
TOL_TEXTO = "R$ 0,011/MWh (dois arredondamentos a centavos)"
# Janela da gold para consultas (o CSV traz o histórico inteiro desde set/2017)
JANELA_CONSULTAS_DIAS = 200
# Atividade da Agenda que trata dos limites do PLD (texto da própria atividade)
REGRA_LIMITES_AGENDA = re.compile(r"PLD\s*m[íi]nimo|PLDmin|PLD_?max|limites?\s+m[áa]ximos?|limites?\s+m[íi]nimos?|"
                                  r"limites?\s+do\s+(?:PLD|Preço de Liquidação)", re.I)


def _u(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "regulacao", "gold": GOLD, "familia": FAMILIA, "ordem": 10,
    "datasets": [
        {"orgao": "ANEEL", "nome": "atos-limites-pld", "slug": "aneel-atos-limites-pld", "dataset_silver": DS_DOCS,
         "titulo": "Atos anuais da ANEEL que fixam os limites do PLD (2021 a 2026) e atos da linha do tempo",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://www2.aneel.gov.br/cedoc/",
         "licenca": LIC_ATOS, "paginas": PAG_PLD, "downloads": [_u(CSV_ATOS), _u(CSV_VIG), _u(CSV_CONF), _u(CSV_LT)],
         "quebras": [
             {"data": "2021-01-01", "descricao": "PLD passa a ser horário e o teto horário passa a valer ao lado do teto estrutural (Portaria MME nº 301/2019)."},
             {"data": "2025-01-01", "descricao": "Os limites passam a ser fixados por despacho da superintendência (delegação da Portaria nº 6.828/2023), não mais por resolução homologatória da Diretoria."},
         ]},
        {"orgao": "Senado Federal", "nome": "legislacao-federal", "slug": "senado-legislacao-federal", "dataset_silver": DS_DOCS,
         "titulo": "Legislação Federal (texto da publicação original das leis citadas)", "estado": "UTILIZADO EM INDICADOR",
         "url": "https://legis.senado.leg.br/", "licenca": LIC_SENADO, "paginas": PAG, "downloads": [_u(CSV_LT)], "quebras": []},
        {"orgao": "ANEEL", "nome": "pautas-e-atas-das-reunioes-publicas-da-diretoria", "slug": "aneel-pautas-atas-diretoria",
         "dataset_silver": DS_ATAS, "titulo": "Pautas e atas das reuniões públicas da Diretoria",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_ATAS, "licenca": LIC_ANEEL, "paginas": PAG,
         "downloads": [_u(CSV_CONS), _u(CSV_ATOS)], "quebras": []},
        {"orgao": "ANEEL", "nome": "audiencias-e-consultas-publicas", "slug": "aneel-audiencias-consultas-publicas",
         "dataset_silver": DS_PART, "titulo": "Audiências e consultas públicas (contagens anuais)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_PART, "licenca": LIC_ANEEL, "paginas": PAG, "downloads": [], "quebras": []},
        {"orgao": "ANEEL", "nome": "bandeiras-tarifarias", "slug": "aneel-bandeiras-tarifarias", "dataset_silver": DS_BAND,
         "titulo": "Bandeiras tarifárias: adicional por resolução e vigência", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_BAND, "licenca": LIC_ANEEL, "paginas": PAG, "downloads": [_u(CSV_BAND)], "quebras": []},
        {"orgao": "ANEEL", "nome": "paginas-procedimentos-e-agenda", "slug": "aneel-paginas-regulatorias", "dataset_silver": DS_PAG,
         "titulo": "Páginas oficiais: Agenda Regulatória, PRODIST, PRORET e consultas públicas", "estado": "UTILIZADO EM INDICADOR",
         "url": PAGINAS["agenda"], "licenca": LIC_GOVBR, "paginas": PAG, "downloads": [_u(CSV_PROC), _u(CSV_AGENDA)], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-1737", "slug": "ibge-ipca-1737", "dataset_silver": DS_IPCA,
         "titulo": "IPCA: número-índice (base dezembro de 1993 = 100), tabela SIDRA 1737", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_TABELA_IPCA, "licenca": LIC_IBGE, "paginas": PAG_PLD, "downloads": [_u(CSV_CONF)], "quebras": []},
    ],
    "arquivos": {
        _u(CSV_ATOS): "ano; ato; data_publicacao (DOU, vazia quando não conferida); data_deliberacao (reunião da Diretoria, pelas atas; vazia para despacho de superintendência); reuniao; vigencia_inicio; vigencia_fim; pld_min; pld_max_horario; pld_max_estrutural (R$/MWh; vazio = o ato não fixa aquele limite); dispositivo; nivel_conferencia (texto_do_ato ou documento_oficial_do_processo); documento (id do registro de documentos); url_oficial; copia_publica; sha256 (do PDF conferido); pagina (do trecho no PDF); trecho_confere (1 = todas as passagens do trecho estão no PDF; vazio = conferência não executada); altera_ou_revoga.",
        _u(CSV_VIG): "ano; inicio; fim; pld_min; ato_pld_min; pld_max_horario; ato_pld_max_horario; pld_max_estrutural; ato_pld_max_estrutural. Limites efetivos em cada trecho de vigência, campo a campo (vale o ato em vigor que informa o campo e tem a publicação mais recente). R$/MWh nominais.",
        _u(CSV_CONF): "conferencia (trecho_no_pdf, deliberacao_na_ata, valor_na_ata, regra_ipca, piso_teo, publicacao_no_extrato); ano; ato; campo; valor_ato; valor_esperado; diferenca; tolerancia; resultado (aprovado, ressalva, reprovado, nao_executada); detalhe. Valores em R$/MWh quando numéricos.",
        _u(CSV_BAND): "ato (resolução, como a fonte escreve); patamar (Amarela, Vermelha P1, Vermelha P2, Escassez Hídrica); vigencia_inicio; vigencia_fim (vazio = valor sem término na fonte); vigencia_fim_origem (valor_seguinte = véspera do valor seguinte do mesmo patamar; ultimo_acionamento = patamar extinto, fim no último dia do último mês com acionamento no recurso Acionamento, grão mensal); ultimo_acionamento (AAAA-MM); ultimo_acionamento_rs_mwh (valor do mês no recurso Acionamento); rs_mwh (adicional em R$/MWh). A bandeira verde não tem adicional e não consta do recurso Adicional.",
        _u(CSV_PROC): "conjunto (PRODIST ou PRORET); modulo; titulo; versao_na_pagina e ato_na_pagina (lidos do nome do arquivo que a página oficial publica como versão vigente); ano_ato; conferencia (confirmada_por_ato_integrado, sem_conferencia_externa ou pagina_possivelmente_desatualizada); ato_vigente (vazio quando há ato posterior que aprova nova versão: a versão vigente não é conhecida); atos_posteriores (ato, data e fonte: ata da Diretoria ou anexo de Resolução Normativa lida); url_vigente; url_versoes; observacao (nota da própria página); verificado_em.",
        _u(CSV_LT): "id; data_publicacao; vigencia_inicio; vigencia_calculada (1 = pela LC nº 95/1998, art. 8º, § 1º); orgao; ato; tipo_ato; dispositivo; titulo; resumo (editorial, conferido no texto); efeito_declarado (literal do ato); impacto_estimado (sempre vazio); temas; paineis; documento; nivel_conferencia; trecho_confere; origem (curadoria ou conjunto_de_dados).",
        _u(CSV_CONS): "id (modalidade, NumAtoAdministrativo e ano da abertura; estável); modalidade (tipo do aviso na ata); numero (o da ata ou, quando suspeito, o único outro número citado pelo mesmo processo); numero_na_ata (NumAtoAdministrativo da abertura); ano; numero_citado (vezes em que outra linha do mesmo processo cita 'nº N/AAAA'); numero_em_conflito (1 = o mesmo número e ano aparecem em outro processo); numero_suspeito (1 = acima do total anual publicado pela ANEEL em ano completo, ou não citado pelo próprio processo, que cita outro); motivo_numero_suspeito; processos; data_deliberacao; reuniao; relator; tema (assunto da pauta); fase_atual; inicio; fim (janela da fase atual; vazio = a ata não data a fase); janela_origem (datas_explicitas ou inicio_e_duracao); fim_calculado (1 = fim calculado de início e duração, contando o dia do início); duracao_dias (declarada na ata); sessao (data de sessão de audiência); situacao (derivada da data de referência); data_referencia; resultado_data; resultado_ato; resultado_julgamento; vinculo_resultado (numero_citado ou processo); decisao_abertura (primeira frase da decisão).",
        _u(CSV_AGENDA): "codigo; atividade; ano_previsto (para edição da norma, como no Anexo I da Portaria nº 7.030/2025); paineis_relacionados (regra por palavra-chave do texto); consultas_citando_codigo; versao_da_agenda.",
    },
}


# ======================================================================= utilidades

def _hoje(ctx):
    """Data de referência no horário de Brasília (a situação das consultas muda à meia-noite
    de Brasília, não de UTC). ctx['data_referencia'] fixa a data nos testes."""
    ref = (ctx or {}).get("data_referencia")
    if ref:
        return ref if isinstance(ref, str) else ref.isoformat()
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    except Exception:  # sem base de fusos: Brasília sem horário de verão desde 2019
        return (datetime.now(timezone.utc) - timedelta(hours=3)).date().isoformat()


def _escreve_csv(ctx, nome, cab, linhas):
    """CSV com ';', ponto decimal e vazio = ausência, como base.escreve_csv, mas com aspas
    (RFC 4180) nos campos que contêm ';', aspas ou quebra de linha: dispositivos, trechos e
    decisões citam o texto dos atos, que tem ponto e vírgula e não pode ser alterado.
    ctx['destino_csv'] desvia a escrita (testes)."""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    w.writerow(cab)
    for linha in linhas:
        w.writerow(["" if v is None else (repr(round(v, 4)) if isinstance(v, float) else v) for v in linha])
    destino = (ctx or {}).get("destino_csv") or base.SERIES
    return base._escreve_atomico(os.path.join(destino, nome), buf.getvalue())


def _data_escrita(texto, iso):
    """A data `iso` está escrita no texto? Regra própria da evidência, independente da leitura
    do período: 'dd/mm/aaaa', ou o dia (com ou sem zero e ordinal) seguido, a até 30
    caracteres sem ponto final nem outro número, do nome do mês; e o ano aparece em algum
    lugar do texto."""
    d = date.fromisoformat(iso)
    t = re.sub(r"\s+", " ", (texto or "").replace("\xa0", " "))
    if f"{d.day:02d}/{d.month:02d}/{d.year}" in t:
        return True
    nomes = "|".join(k for k, v in ar.MESES.items() if v == d.month)
    # entre o dia e o mês não pode haver outro número, salvo o par "D e|a|até D" de uma faixa
    # ("entre os dias 7 e 30 de abril"); assim "3 de setembro a 2 de outubro" não escreve 3 de outubro
    padrao = (rf"(?<!\d)0?{d.day}\s*[º°]?(?!\d)(?:\s+(?:a|e|até)\s+\d{{1,2}}\s*[º°]?(?!\d))?[^.;\d]{{0,30}}?"
              rf"\b(?:{nomes})\b")
    return bool(re.search(padrao, t, re.I)) and str(d.year) in t


def _bytes_bronze(arquivo):
    if not arquivo:
        return None
    try:
        with base.abre_bronze(arquivo) as f:
            return f.read()
    except OSError:
        return None


def _processados(con):
    con.execute("CREATE TABLE IF NOT EXISTS regulacao_processados(dataset TEXT, marca TEXT, processado_em TEXT,"
                " PRIMARY KEY(dataset, marca))")


# Versão do processamento de cada dataset: mudar o número reprocessa a vintage vigente do
# bronze. Atas v2: entram também as decisões que aprovam versões do PRODIST e do PRORET.
VERSAO_PROC = {DS_ATAS: "2", DS_BAND: "1", DS_PAG: "1", DS_PART: "1", DS_IPCA: "1", DS_CURADORIA: "1"}


def _ja(con, ds, vid):
    _processados(con)
    return con.execute("SELECT 1 FROM regulacao_processados WHERE dataset=? AND marca=?",
                       (ds, f"{vid}#v{VERSAO_PROC.get(ds, '1')}")).fetchone() is not None


def _marca(con, ds, vid):
    _processados(con)
    con.execute("INSERT OR IGNORE INTO regulacao_processados VALUES(?,?,?)",
                (ds, f"{vid}#v{VERSAO_PROC.get(ds, '1')}", base.agora_utc()))


# ======================================================================= coleta

def _coleta_documentos(con, status):
    """Cada documento do registro vira um recurso do dataset DS_DOCS. PDF da ANEEL: baixado
    da cópia pública do Internet Archive (modo id_, bytes originais) e aceito só se o
    sha256 for o registrado; divergência é falha de coleta, nunca substituição. Página de
    lei do Senado: baixada do endereço oficial (o texto é conferido na gold)."""
    st = {"novos": 0, "iguais": 0, "falhas": []}
    for doc in rg.documentos().values():
        rec = doc["id"]
        ult = base.ultima_vintage(con, DS_DOCS, rec)
        esperado = doc.get("sha256")
        if doc["formato"] == "pdf":
            if ult and esperado and ult["sha256"] == esperado:
                st["iguais"] += 1
                continue
            url = doc.get("copia_publica")
            if not url:
                st["falhas"].append(f"{rec}: sem cópia pública acessível")
                continue
            res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=DS_DOCS, recurso=rec, url=url, ext="pdf",
                                      publicado_em=None, max_idade_dias=0, forcar=True)
            v = res.get("vintage")
            if res["status"] == "falha" or not v:
                st["falhas"].append(f"{rec}: {res['detalhe']}")
            elif esperado and v["sha256"] != esperado:
                # a vintage divergente fica registrada para auditoria, mas não é usada (ver _texto_documento)
                st["falhas"].append(f"{rec}: sha256 {v['sha256'][:12]} difere do registrado {esperado[:12]}")
            else:
                st["novos" if res["status"] == "nova" else "iguais"] += 1
        else:
            res = ckan.baixar_recurso(con, orgao="SENADO", dataset=DS_DOCS, recurso=rec, url=doc["url_oficial"], ext="html",
                                      publicado_em=None, max_idade_dias=30)
            if res["status"] == "falha":
                st["falhas"].append(f"{rec}: {res['detalhe']}")
            else:
                st["novos" if res["status"] == "nova" else "iguais"] += 1
    con.commit()
    status[DS_DOCS] = st


def _coleta_curadoria(con, status):
    """Os JSON curados entram como vintages (origem 'curadoria'): uma edição de valor ou
    de data fica registrada como revisão, com o sha256 do arquivo."""
    st = {}
    for nome in ARQUIVOS_CURADOS:
        caminho = os.path.join(rg.AQUI, nome)
        if not os.path.exists(caminho):
            st[nome] = "ausente"
            continue
        corpo = open(caminho, "rb").read()
        sha = base.sha256_bytes(corpo)
        ult = base.ultima_vintage(con, DS_CURADORIA, nome)
        if ult and ult["sha256"] == sha:
            st[nome] = "igual"
            continue
        cap = base.agora_utc()
        vid, _ = base.registra_vintage(con, DS_CURADORIA, nome, URL_REPO + nome, cap, None, sha, len(corpo),
                                       "curadoria", os.path.relpath(caminho, base.RAIZ))
        st[nome] = "nova"
        if nome == "limites_pld.json":
            dado = json.loads(corpo.decode("utf-8"))
            linhas = [(f"{campo}|{a['ato']}", str(a["ano"]), a[campo]) for a in dado.get("atos", [])
                      for campo in rg.CAMPOS_LIMITE if isinstance(a.get(campo), (int, float))]
            base.grava_observacoes(con, DS_CURADORIA, vid, linhas)
    con.commit()
    status[DS_CURADORIA] = st


def _processa_atas(con, v):
    """Só as linhas que interessam ao módulo vão para o silver, como registros textuais
    (a chave junta data, reunião, ordem, número do ato e processo)."""
    linhas, n, rel = [], 0, 0
    for row in ckan.le_csv_bronze(v["arquivo"]):
        n += 1
        a = ar.linha_ata(row)
        if not ar.ata_relevante(a):
            continue
        rel += 1
        ch = ar.chave_ata(a)
        for campo in ("data", "reuniao", "ordem", "processo", "relator", "classificacao", "assunto", "decisao",
                      "num_ato", "tipo_ato", "resultado", "gerado_em"):
            linhas.append((ch, campo, a[campo] if a[campo] != "" else None))
    novas, revs = base.grava_registros(con, DS_ATAS, v["vintage_id"], linhas)
    # contagem de aberturas por ano, sobre o arquivo inteiro (para a cobertura)
    return {"linhas": n, "relevantes": rel, "novas": novas, "revisoes": revs}


def _processa_participacao(con, v):
    corpo = _bytes_bronze(v["arquivo"])
    obs = []
    for r in ar.le_csv(corpo):
        ano = (r.get("AnoReferencia") or "").strip().strip('"')
        for campo, serie in (("QtdConsultasPublicas", "consultas"), ("QtdAudienciasPublicas", "audiencias"),
                             ("QtdTomadasSubsidios", "tomadas_subsidios")):
            val = ckan.numero_br(r.get(campo))
            if ano.isdigit() and val is not None:
                obs.append((serie, ano, val))
        ger = (r.get("DatGeracaoConjuntoDados") or "").strip().strip('"')
        if ano.isdigit() and ger:
            base.grava_registros(con, DS_PART, v["vintage_id"], [(ano, "gerado_em", ger)])
    novas, revs = base.grava_observacoes(con, DS_PART, v["vintage_id"], obs)
    return {"observacoes": len(obs), "novas": novas, "revisoes": revs}


def _processa_bandeiras(con, v):
    """Recurso 'Adicional' (valor por patamar e vigência) ou 'Acionamento' (patamar acionado em
    cada mês de competência); o cabeçalho decide qual é."""
    corpo = _bytes_bronze(v["arquivo"])
    linhas = ar.le_csv(corpo)
    if linhas and "DatCompetencia" in linhas[0]:
        ac = ar.bandeiras_acionamento(linhas)
        reg = [(f"acionamento|{x['competencia']}", k, None if x[k] is None else str(x[k]))
               for x in ac for k in ("patamar", "rs_mwh", "gerado_em")]
        return {"meses": len(ac), "registros": base.grava_registros(con, DS_BAND, v["vintage_id"], reg)}
    rs = ar.bandeiras_adicional(linhas)
    obs = [(f"adicional|{r['patamar']}", r["vigencia_inicio"], r["rs_mwh"]) for r in rs]
    reg = [(f"{r['patamar']}|{r['vigencia_inicio']}", k, r[k]) for r in rs for k in ("ato", "gerado_em")]
    n1 = base.grava_observacoes(con, DS_BAND, v["vintage_id"], obs)
    n2 = base.grava_registros(con, DS_BAND, v["vintage_id"], reg)
    return {"linhas": len(rs), "observacoes": n1, "registros": n2}


def _processa_pagina(con, rec, v):
    corpo = _bytes_bronze(v["arquivo"])
    if rec in ("prodist", "proret"):
        itens = ar.procedimentos_da_pagina(corpo, rec.upper())
        reg = [(f"{i['conjunto']}|{i['modulo']}", k, i[k]) for i in itens
               for k in ("titulo", "versao", "ato", "url_vigente", "url_versoes", "observacao")]
        return {"itens": len(itens), "registros": base.grava_registros(con, DS_PAG, v["vintage_id"], reg)}
    if rec == "agenda":
        rev = ar.revisao_da_agenda(corpo)
        reg = [("agenda", k, rev[k]) for k in ("aprovada_por", "atualizada_por", "trecho")]
        return {"revisao": rev, "registros": base.grava_registros(con, DS_PAG, v["vintage_id"], reg)}
    return {"guardada": True}


def _processa_ipca(con, v):
    serie = ar.ipca_sidra(_bytes_bronze(v["arquivo"]))
    return dict(zip(("novas", "revisoes"), base.grava_observacoes(con, DS_IPCA, v["vintage_id"],
                                                                  [("ipca.indice", k, x) for k, x in serie.items()])))


def coletar(con, ctx):
    status = {}
    _coleta_curadoria(con, status)
    if (ctx or {}).get("sem_rede"):
        status["rede"] = "execução sem rede: só a curadoria foi registrada"
        return status
    _coleta_documentos(con, status)

    def pacote(nome, ds, filtro, idade, proc):
        st, _meta, vints = ckan.coleta_pacote(con, orgao="ANEEL", nome=nome, dataset=ds, filtro_recurso=filtro,
                                              max_idade_dias=idade)
        status[ds] = st
        for rec, vt in sorted(vints.items()):
            if rec.lower().endswith(".csv") or (vt.get("url") or "").lower().endswith(".csv"):
                if not _ja(con, ds, vt["vintage_id"]):
                    try:
                        status[f"{ds}:{rec}"] = proc(con, vt)
                        _marca(con, ds, vt["vintage_id"])
                    except Exception as e:  # leitura falhou: registrada, o silver anterior continua
                        base.registra_coleta(con, ds, rec, False, f"processamento: {e}")
                        status[f"{ds}:{rec}"] = f"falha: {e}"
                    con.commit()

    fmt = lambda r: (r.get("format") or "").upper()  # noqa: E731
    pacote("pautas-e-atas-das-reunioes-publicas-da-diretoria", DS_ATAS, lambda r: fmt(r) in ("CSV", "PDF"), 6, _processa_atas)
    pacote("audiencias-e-consultas-publicas", DS_PART, lambda r: fmt(r) in ("CSV", "PDF"), 30, _processa_participacao)
    # Acionamento: mês a mês, qual patamar valeu; usado para fechar a vigência de patamar extinto
    # (escassez hídrica). O dicionário do Acionamento escreve a vigência desse patamar.
    pacote("bandeiras-tarifarias", DS_BAND,
           lambda r: (r.get("name") or "") in ("Bandeira Tarifária - Adicional", "Dicionário de dados - Adicional",
                                               "Bandeira Tarifária - Acionamento", "Dicionário de dados - Acionamento"), 15,
           _processa_bandeiras)

    st_pag = {}
    for rec, url in PAGINAS.items():
        res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=DS_PAG, recurso=rec, url=url, ext="html",
                                  publicado_em=None, max_idade_dias=6)
        st_pag[rec] = res["status"] if res["status"] != "falha" else f"falha: {res['detalhe']}"
        v = res.get("vintage")
        if v and res["status"] in ("nova", "identica", "pulada") and not _ja(con, DS_PAG, v["vintage_id"]):
            try:
                st_pag[f"{rec}:processamento"] = _processa_pagina(con, rec, v)
                _marca(con, DS_PAG, v["vintage_id"])
            except Exception as e:
                base.registra_coleta(con, DS_PAG, rec, False, f"processamento: {e}")
                st_pag[f"{rec}:processamento"] = f"falha: {e}"
        con.commit()
    status[DS_PAG] = st_pag

    res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IPCA, recurso="ipca_numero_indice", url=URL_SIDRA,
                              ext="json", publicado_em=None, max_idade_dias=10)
    status[DS_IPCA] = res["status"]
    v = res.get("vintage")
    if v and not _ja(con, DS_IPCA, v["vintage_id"]):
        try:
            status[f"{DS_IPCA}:processamento"] = _processa_ipca(con, v)
            _marca(con, DS_IPCA, v["vintage_id"])
        except Exception as e:
            base.registra_coleta(con, DS_IPCA, "ipca_numero_indice", False, f"processamento: {e}")
            status[f"{DS_IPCA}:processamento"] = f"falha: {e}"
    con.commit()
    return status


# ======================================================================= leitura do silver

def _texto_documento(con, doc):
    """{vintage, textos:[...], paginado, layout, status} do documento no bronze. Usa só a
    vintage cujo sha256 é o registrado (PDF); sem pdftotext, status 'sem_extrator'."""
    vs = [v for v in base.vintages_do_dataset(con, DS_DOCS) if v["recurso"] == doc["id"]]
    if doc.get("sha256"):
        vs = [v for v in vs if v["sha256"] == doc["sha256"]]
    if not vs:
        return {"vintage": None, "textos": [], "paginado": None, "status": "sem_arquivo"}
    v = max(vs, key=lambda x: x["capturado_em"])
    corpo = _bytes_bronze(v["arquivo"])
    if corpo is None:
        return {"vintage": v, "textos": [], "paginado": None, "status": "bronze_ausente"}
    if doc["formato"] == "pdf":
        raw, lay = ar.texto_pdf(corpo), ar.texto_pdf(corpo, layout=True)
        if raw is None and lay is None:
            return {"vintage": v, "textos": [], "paginado": None, "status": "sem_extrator"}
        return {"vintage": v, "textos": [t for t in (raw, lay) if t], "paginado": raw or lay, "layout": lay, "status": "ok"}
    return {"vintage": v, "textos": [ar.texto_html(corpo)], "paginado": None, "status": "ok"}


def _atas(con):
    regs = base.registros_como_estavam_em(con, DS_ATAS)
    campos = ("data", "reuniao", "ordem", "processo", "relator", "classificacao", "assunto", "decisao", "num_ato",
              "tipo_ato", "resultado", "gerado_em")
    return [{k: r.get(k, "") or "" for k in campos} for r in regs.values()]


def _serie(con, ds, serie):
    return dict(base.serie_vigente(con, ds, serie))


def _ata_do_ato(atas, tipo, numero, ano):
    """Linha da ata que deliberou o ato (tipo, número e ano da reunião)."""
    cands = [a for a in atas if a["tipo_ato"] == tipo and ar._int(a["num_ato"]) == numero and a["data"][:4] == str(ano)
             and a["resultado"] in ar.DELIBERADO]
    return min(cands, key=lambda a: a["data"]) if cands else None


_ATO = re.compile(r"(Resolução Homologatória|Resolução Normativa|Despacho|Portaria)\s+(?:ANEEL\s+)?nº\s*([\d.]+)(?:/(\d{4})|,\s*de\s+\d{1,2}º?\s+de\s+\w+\s+de\s+(\d{4}))")


def _tipo_numero_ano(texto_ato):
    m = _ATO.search(texto_ato or "")
    if not m:
        return None
    return m.group(1), ar._int(m.group(2)), int(m.group(3) or m.group(4))


def _vintage_fonte(v):
    return {"recurso": v.get("recurso"), "arquivo": v.get("arquivo"), "sha256": v.get("sha256"),
            "capturado_em": v.get("capturado_em"), "publicado_em": v.get("publicado_em")} if v else None


def _fonte(orgao, dataset, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": dataset, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


# ======================================================================= P044: limites do PLD

def _mes_extenso(mes):
    """'2019-09' → 'setembro de 2019'."""
    nome = next(k for k, v in ar.MESES.items() if v == int(mes[5:7]) and k != "marco")
    return f"{nome} de {mes[:4]}"


def _base_art23(textos):
    """Valores-base do art. 23, § 1º, da REN nº 1.032/2022 lidos no texto do ato guardado no
    bronze: {pld_max_estrutural, pld_max_horario, mes_base 'AAAA-MM'}; None sem o texto."""
    t = textos.get("ren20221032") or {}
    if t.get("status") != "ok":
        return None
    txt = re.sub(r"\s+", " ", t["textos"][0])
    i = txt.find("§ 1º Os limites máximos do PLD serão atualizados")
    if i < 0:
        return None
    trecho = txt[i:i + 600]
    mb = re.search(r"a preços de\s+(\w+)\s+de\s+(\d{4})", trecho)
    vals = {("pld_max_" + ("horario" if k.startswith("hor") else "estrutural")): float(v.replace(".", "").replace(",", "."))
            for v, k in re.findall(r"R\$\s*([\d.]+,\d{2})\s*/\s*MWh,\s*para o (?:para o )?PLDmax_(estrutural|horário)", trecho)}
    if not mb or mb.group(1).lower() not in ar.MESES or len(vals) != 2:
        return None
    return {**vals, "mes_base": f"{mb.group(2)}-{ar.MESES[mb.group(1).lower()]:02d}"}


def _conferencias_limites(atos, conf, docs, textos, atas, ipca):
    """Conferências de cada ato (linhas do CSV de conferências e resumo por ato)."""
    linhas, por_ato = [], {}
    conf_por = {(x["ato"], x["ano"]): x for x in conf["atos"]}

    def add(tipo, a, campo, valor_ato, esperado, tol, resultado, detalhe):
        dif = None if (valor_ato is None or esperado is None) else round(valor_ato - esperado, 4)
        linhas.append({"conferencia": tipo, "ano": a["ano"] if a else None, "ato": a["ato"] if a else None,
                       "campo": campo, "valor_ato": valor_ato, "valor_esperado": esperado, "diferenca": dif,
                       "tolerancia": tol, "resultado": resultado, "detalhe": detalhe})
        if a:
            por_ato.setdefault((a["ato"], a["ano"]), []).append(linhas[-1])

    for a in atos:
        cf = conf_por.get((a["ato"], a["ano"]), {})
        did = cf.get("documento_valores")
        t = textos.get(did) or {}
        if t.get("status") == "ok":
            ok, faltam = ar.confere_trecho(a["trecho"], t["textos"])
            add("trecho_no_pdf", a, "trecho", None, None, "igualdade de texto normalizado (espaços e quebras de linha)",
                "aprovado" if ok else "reprovado",
                f"{len(ar.pedacos(a['trecho']))} passagens do trecho encontradas em {did}" if ok else f"ausentes: {'; '.join(x[:80] for x in faltam)}")
        else:
            add("trecho_no_pdf", a, "trecho", None, None, "igualdade de texto normalizado", "nao_executada",
                f"documento {did}: {t.get('status', 'sem registro')}")
        # publicação: a data do DOU impressa no extrato
        dpub = cf.get("documento_publicacao")
        tp = textos.get(dpub) or {}
        if a["data_publicacao"] and tp.get("status") == "ok":
            dd = date.fromisoformat(a["data_publicacao"])
            marca = f"{dd.day:02d}.{dd.month:02d}.{dd.year}"
            ok = any(marca in ar.normaliza(x) for x in tp["textos"])
            add("publicacao_no_extrato", a, "data_publicacao", None, None, "igualdade da data (dd.mm.aaaa)",
                "aprovado" if ok else "reprovado", f"'D.O. de {marca}' {'encontrado' if ok else 'ausente'} em {dpub}")
        elif a["data_publicacao"] is None:
            add("publicacao_no_extrato", a, "data_publicacao", None, None, "igualdade da data (dd.mm.aaaa)", "ressalva",
                "data de publicação não conferida: extrato do ato não acessível; campo mantido vazio")
        # deliberação da Diretoria (caminho independente: atas em dados abertos)
        tna = None if a["ato"].startswith("Retificação") else _tipo_numero_ano(a["ato"])
        if tna and tna[0] == "Resolução Homologatória":
            ata = _ata_do_ato(atas, tna[0], tna[1], tna[2])
            if ata:
                add("deliberacao_na_ata", a, "numero_e_data", None, None, "igualdade do número do ato",
                    "aprovado", f"{tna[0]} nº {ar.numero_ato(tna[1])} deliberada em {c.data_br(ata['data'])} ({ata['reuniao']}), "
                                f"processo {ar.processo_formatado(ar.processos(ata['processo'])[0]) if ar.processos(ata['processo']) else '?'}")
                for campo in rg.CAMPOS_LIMITE:
                    if a[campo] is None:
                        continue
                    alvo = rg.numero_br(float(a[campo]))
                    if alvo in ata["decisao"]:
                        add("valor_na_ata", a, campo, a[campo], a[campo], "igualdade a centavos", "aprovado",
                            f"R$ {alvo}/MWh escrito na decisão da ata de {c.data_br(ata['data'])}")
            else:
                add("deliberacao_na_ata", a, "numero_e_data", None, None, "igualdade do número do ato", "ressalva",
                    "deliberação não localizada nas atas publicadas")
        # piso = maior entre TEO e TEO de Itaipu (REN nº 1.032/2022, art. 24), com valores do próprio ato
        if a["pld_min"] is not None:
            teo, teoi = cf.get("teo"), cf.get("teo_itaipu")
            if teo is not None and teoi is not None:
                esp = max(teo, teoi)
                add("piso_teo", a, "pld_min", a["pld_min"], esp, "R$ 0,00/MWh (mesmo ato, mesma precisão)",
                    "aprovado" if abs(a["pld_min"] - esp) < 1e-9 else "reprovado",
                    f"TEO R$ {rg.numero_br(teo)}/MWh e TEO de Itaipu R$ {rg.numero_br(teoi)}/MWh")
            elif teoi is not None:
                add("piso_teo", a, "pld_min", a["pld_min"], teoi, "R$ 0,00/MWh", "ressalva",
                    "TEO das demais usinas não lida no ato; conferido só contra a TEO de Itaipu")
    # encadeamento anual praticado pelos atos: teto(ano) = teto publicado(ano-1) × IPCA(nov/ano-1) ÷ IPCA(nov/ano-2)
    vig = {x["ano"]: x for x in rg.vigentes_por_ano(atos) if x["fim"][5:] == "12-31"}
    for ano in sorted(vig):
        ant = vig.get(ano - 1)
        if not ant:
            continue
        i1, i0 = ipca.get(f"{ano - 1}-11"), ipca.get(f"{ano - 2}-11")
        for campo in ("pld_max_estrutural", "pld_max_horario"):
            atual, anterior = vig[ano][campo], ant[campo]
            a_ref = next((x for x in atos if x["ato"] == vig[ano][f"ato_{campo}"] and x["ano"] == ano), None)
            if None in (atual, anterior):
                continue
            if i1 is None or i0 is None:
                add("regra_ipca", a_ref, campo, atual, None, TOL_TEXTO, "nao_executada", "IPCA de novembro ausente no silver")
                continue
            esperado = round(anterior * i1 / i0, 4)
            ok = abs(esperado - atual) <= TOL_IPCA_RS
            add("regra_ipca", a_ref, campo, atual, esperado, TOL_TEXTO, "aprovado" if ok else "reprovado",
                f"{rg.numero_br(anterior)} × IPCA nov/{ano - 1} ({rg.numero_br(i1)}) ÷ IPCA nov/{ano - 2} ({rg.numero_br(i0)}) = "
                f"{rg.numero_br(esperado, 4)}")
    # aplicação literal do art. 23, § 1º, da REN nº 1.032/2022: valores de setembro de 2019
    # atualizados pelo IPCA acumulado até novembro do ano anterior. Não é critério de aprovação
    # (os atos encadeiam o teto publicado do ano anterior); a diferença fica registrada.
    lit = _base_art23(textos)
    for ano in sorted(vig):
        if not lit or ano < 2021:
            continue
        i1, i0 = ipca.get(f"{ano - 1}-11"), ipca.get(lit["mes_base"])
        for campo in ("pld_max_estrutural", "pld_max_horario"):
            atual = vig[ano][campo]
            a_ref = next((x for x in atos if x["ato"] == vig[ano][f"ato_{campo}"] and x["ano"] == ano), None)
            if atual is None or lit.get(campo) is None:
                continue
            if i1 is None or i0 is None:
                add("art23_literal", a_ref, campo, atual, None, "informativa", "nao_executada", "IPCA ausente no silver")
                continue
            esperado = round(lit[campo] * i1 / i0, 4)
            add("art23_literal", a_ref, campo, atual, esperado, "informativa (não é critério de aprovação)", "ressalva",
                f"aplicação literal do art. 23, § 1º: {rg.numero_br(lit[campo])} (preços de {_mes_extenso(lit['mes_base'])}) × IPCA "
                f"nov/{ano - 1} ({rg.numero_br(i1)}) ÷ IPCA {_mes_extenso(lit['mes_base'])} ({rg.numero_br(i0)}) = "
                f"{rg.numero_br(esperado, 4)}; o ato publicou "
                f"{rg.numero_br(atual)} (diferença {rg.numero_br(atual - esperado, 2)}). Os atos encadeiam o teto publicado no ano "
                "anterior (conferência regra_ipca)")
    # o valor original de 2023 (antes da retificação) reproduz a atualização a partir dos tetos
    # a preços de novembro de 2021 da REH nº 2.994/2021: é o erro que a retificação corrigiu
    orig = next((x for x in atos if x["ato"] == "Resolução Homologatória ANEEL nº 3.167/2022"), None)
    base21 = conf_por.get(("Resolução Homologatória ANEEL nº 2.994/2021", 2022), {}).get("valores_nao_vigentes") or {}
    i1, i0 = ipca.get("2022-11"), ipca.get("2021-11")
    if orig and base21 and i1 and i0:
        for campo in ("pld_max_estrutural", "pld_max_horario"):
            if orig[campo] is None or base21.get(campo) is None:
                continue
            esperado = round(base21[campo] * i1 / i0, 4)
            add("regra_ipca", orig, campo, orig[campo], esperado, TOL_TEXTO,
                "aprovado" if abs(esperado - orig[campo]) <= TOL_IPCA_RS else "reprovado",
                f"valor original, depois retificado: {rg.numero_br(base21[campo])} (REH nº 2.994/2021, preços de nov/2021) × "
                f"IPCA nov/2022 ÷ nov/2021 = {rg.numero_br(esperado, 4)}; a retificação passou a partir do Despacho nº 4.046/2021")
    return linhas, por_ato


def _bloco_limites(con, ctx, hoje, docs, textos, atas, ipca):
    lim = rg.limites_pld()
    conf = rg.conferencia_limites()
    atos = lim["atos"]
    linhas_conf, por_ato = _conferencias_limites(atos, conf, docs, textos, atas, ipca)
    reprovadas = [x for x in linhas_conf if x["resultado"] == "reprovado"]
    conf_por = {(x["ato"], x["ano"]): x for x in conf["atos"]}
    saida = []
    for a in atos:
        cf = conf_por.get((a["ato"], a["ano"]), {})
        did = cf.get("documento_valores")
        d = docs.get(did, {})
        t = textos.get(did) or {}
        pag = ar.pagina_do_trecho(t.get("paginado"), a["trecho"]) if t.get("status") == "ok" else None
        tna = None if a["ato"].startswith("Retificação") else _tipo_numero_ano(a["ato"])
        ata = _ata_do_ato(atas, tna[0], tna[1], tna[2]) if tna and tna[0] == "Resolução Homologatória" else None
        cs = por_ato.get((a["ato"], a["ano"]), [])
        trecho_ok = next((x["resultado"] for x in cs if x["conferencia"] == "trecho_no_pdf"), None)
        saida.append({
            **a,
            "nivel_conferencia": cf.get("nivel"), "data_do_ato": cf.get("data_do_ato"), "dou": cf.get("dou"),
            "documento": did, "documento_titulo": d.get("titulo"), "url_oficial": d.get("url_oficial"),
            "copia_publica": d.get("copia_publica"), "sha256": (t.get("vintage") or {}).get("sha256"),
            "pagina": pag, "trecho_confere": None if trecho_ok in (None, "nao_executada") else trecho_ok == "aprovado",
            "deliberacao": ({"data": ata["data"], "reuniao": ata["reuniao"],
                             "processo": ar.processo_formatado(ar.processos(ata["processo"])[0]) if ar.processos(ata["processo"]) else None}
                            if ata else None),
            "teo": cf.get("teo"), "teo_itaipu": cf.get("teo_itaipu"),
            "observacoes": cf.get("observacoes") or [],
            "conferencias": [{k: x[k] for k in ("conferencia", "campo", "resultado", "detalhe")} for x in cs],
        })
    vig = rg.vigentes_por_ano(atos)
    hoje_lim = rg.limites_em(hoje, atos)
    _escreve_csv(ctx, CSV_ATOS, ["ano", "ato", "data_publicacao", "data_deliberacao", "reuniao", "vigencia_inicio", "vigencia_fim",
                                 "pld_min", "pld_max_horario", "pld_max_estrutural", "unidade", "dispositivo", "nivel_conferencia",
                                 "documento", "url_oficial", "copia_publica", "sha256", "pagina", "trecho_confere", "altera_ou_revoga"],
                 [[s["ano"], s["ato"], s["data_publicacao"], (s["deliberacao"] or {}).get("data"), (s["deliberacao"] or {}).get("reuniao"),
                   s["vigencia_inicio"], s["vigencia_fim"], s["pld_min"], s["pld_max_horario"], s["pld_max_estrutural"], s["unidade"],
                   s["dispositivo"], s["nivel_conferencia"], s["documento"], s["url_oficial"], s["copia_publica"], s["sha256"],
                   s["pagina"], None if s["trecho_confere"] is None else int(s["trecho_confere"]), s["altera_ou_revoga"]] for s in saida])
    _escreve_csv(ctx, CSV_VIG, ["ano", "inicio", "fim", "pld_min", "ato_pld_min", "pld_max_horario", "ato_pld_max_horario",
                                "pld_max_estrutural", "ato_pld_max_estrutural"],
                 [[x["ano"], x["inicio"], x["fim"], x["pld_min"], x["ato_pld_min"], x["pld_max_horario"], x["ato_pld_max_horario"],
                   x["pld_max_estrutural"], x["ato_pld_max_estrutural"]] for x in vig])
    _escreve_csv(ctx, CSV_CONF, ["conferencia", "ano", "ato", "campo", "valor_ato", "valor_esperado", "diferenca", "tolerancia",
                                 "resultado", "detalhe"],
                 [[x[k] for k in ("conferencia", "ano", "ato", "campo", "valor_ato", "valor_esperado", "diferenca", "tolerancia",
                                  "resultado", "detalhe")] for x in linhas_conf])
    resumo_conf = {}
    for x in linhas_conf:
        resumo_conf.setdefault(x["conferencia"], {"aprovado": 0, "ressalva": 0, "reprovado": 0, "nao_executada": 0})[x["resultado"]] += 1
    return {"conferido_em": lim["conferido_em"], "atos": saida, "vigencias": vig, "vigente_hoje": {"data": hoje, **hoje_lim},
            "conferencias": resumo_conf, "reprovadas": reprovadas,
            "conferencias_detalhe": [{k: x[k] for k in ("conferencia", "ano", "ato", "campo", "valor_ato", "valor_esperado",
                                                         "diferenca", "tolerancia", "resultado", "detalhe")}
                                     for x in linhas_conf if x["conferencia"] in ("regra_ipca", "art23_literal", "piso_teo", "valor_na_ata")],
            "pendencias": conf.get("pendencias", []), "bloqueios": conf.get("bloqueios", []), "metodo": conf.get("metodo")}


def _evidencias_limites(bl, textos, docs, snap_docs):
    """'Comprove este número' dos três limites vigentes na data de referência."""
    out = {}
    hoje_lim = bl["vigente_hoje"]
    nomes = {"trecho_no_pdf": "Trecho literal encontrado no PDF do ato", "publicacao_no_extrato": "Data do DOU no extrato oficial",
             "deliberacao_na_ata": "Número e data da deliberação nas atas da Diretoria", "valor_na_ata": "Valor escrito na ata da Diretoria",
             "piso_teo": "Piso igual ao maior entre TEO e TEO de Itaipu",
             "regra_ipca": "Teto publicado no ano anterior encadeado pela variação do IPCA de novembro",
             "art23_literal": "Aplicação literal do art. 23, § 1º, da REN nº 1.032/2022 (informativa)"}
    for campo, rot in (("pld_min", "Piso do PLD (PLD mínimo)"), ("pld_max_horario", "Teto horário do PLD"),
                       ("pld_max_estrutural", "Teto estrutural do PLD")):
        ato_nome = hoje_lim.get(f"ato_{campo}")
        a = next((x for x in bl["atos"] if x["ato"] == ato_nome and x[campo] == hoje_lim.get(campo)), None)
        if not a:
            continue
        t = textos.get(a["documento"]) or {}
        v = t.get("vintage")
        if not v:
            continue
        cs = [x for x in a["conferencias"] if x.get("campo") in (campo, "trecho", "data_publicacao", "numero_e_data")]
        testes = [ev.teste(nomes.get(x["conferencia"], x["conferencia"]),
                           x["resultado"] if x["resultado"] != "nao_executada" else "ressalva", x["detalhe"]) for x in cs]
        ipca = next((x for x in bl["conferencias_detalhe"] if x["conferencia"] == "regra_ipca" and x["ano"] == a["ano"]
                     and x["campo"] == campo), None)
        rec = (ev.reconciliacao("Encadeamento anual do teto publicado pela variação do IPCA de novembro (IBGE), prática dos atos "
                                f"da ANEEL: {ipca['detalhe']}. A aplicação literal do art. 23, § 1º, da REN nº 1.032/2022 (valores "
                                "de setembro de 2019) dá outro valor; a diferença está na conferência art23_literal",
                                ipca["resultado"], TOL_TEXTO)
               if ipca and ipca["valor_esperado"] is not None else
               ev.reconciliacao("Piso igual ao maior valor entre TEO e TEO de Itaipu fixados no mesmo ato (REN nº 1.032/2022, art. 24)",
                                next((x["resultado"] for x in a["conferencias"] if x["conferencia"] == "piso_teo"), "ressalva"),
                                "R$ 0,00/MWh") if campo == "pld_min" else None)
        out[campo] = ev.construir(
            indicador=f"{rot} vigente", valor_exibido=f"R$ {rg.numero_br(a[campo])}/MWh", valor_calculo=a[campo],
            unidade="R$/MWh", periodo={"inicio": a["vigencia_inicio"], "fim": a["vigencia_fim"]},
            entidade="Mercado de Curto Prazo (todos os submercados)", universo=f"limite fixado para {a['ano']}",
            fonte={"orgao": "ANEEL", "conjunto": a["ato"], "recurso": v["recurso"], "url": a["url_oficial"] or a["url"],
                   "arquivo": v["arquivo"], "sha256": v["sha256"], "capturado_em": v["capturado_em"], "publicado_em": a["data_publicacao"]},
            extracao_pdf={"documento": a["documento_titulo"] or a["ato"], "edicao": a["dou"] or "publicação no DOU não conferida",
                          "pagina": str(a["pagina"]) if a["pagina"] else "não localizada",
                          "conferencia": ("passagens do trecho literal conferidas no texto extraído do PDF a cada execução; PDF obtido na "
                                          f"cópia pública {a['copia_publica']} e aceito pelo sha256 registrado")
                                         if a["trecho_confere"] else "conferência automática não executada neste ambiente"},
            chaves_origem=[f"{a['ato']} | {a['dispositivo'][:120]}"],
            formula="valor fixado pelo ato; vigente campo a campo (ato em vigor que informa o campo, publicação mais recente)",
            cobertura=f"ano de {a['ano']}", tratamento_ausencia="campo que o ato não fixa fica vazio e vale o ato anterior do mesmo ano; nunca o menor preço observado",
            revisoes="Curadoria versionada: edição do valor no arquivo curado vira revisão registrada no silver (dataset regulacao_curadoria).",
            testes=testes or [ev.teste("esquema", "aprovado", "limites_pld.json válido")], reconciliacao=rec,
            download=[{"rotulo": "Atos e limites (CSV)", "url": _u(CSV_ATOS)}, {"rotulo": "Conferências (CSV)", "url": _u(CSV_CONF)}],
            reproducao="python3 pipeline/energia/executar_modulo.py regulacao --sem-coleta",
        )
    return out


# ======================================================================= bandeiras e procedimentos

def _bloco_bandeiras(con, ctx):
    obs = {}
    for serie in ar.PATAMARES:
        for ref, val in base.serie_vigente(con, DS_BAND, f"adicional|{serie}"):
            obs[(serie, ref)] = val
    regs = base.registros_como_estavam_em(con, DS_BAND)
    linhas = [{"ato": (regs.get(f"{p}|{ref}") or {}).get("ato"), "vigencia_inicio": ref, "patamar": p, "rs_mwh": v,
               "gerado_em": (regs.get(f"{p}|{ref}") or {}).get("gerado_em")} for (p, ref), v in obs.items()]
    acion = sorted(({"competencia": ch.split("|", 1)[1], "patamar": r.get("patamar"),
                     "rs_mwh": float(r["rs_mwh"]) if r.get("rs_mwh") not in (None, "") else None, "gerado_em": r.get("gerado_em")}
                    for ch, r in regs.items() if ch.startswith("acionamento|") and r.get("patamar")),
                   key=lambda x: x["competencia"])
    vig = ar.vigencias_bandeiras(linhas, acion or None)
    # conferência independente: a vigência que o dicionário do recurso Acionamento escreve
    dic = {}
    vd = [v for v in base.vintages_do_dataset(con, DS_BAND) if v["recurso"] == "Dicionário de dados - Acionamento"]
    if vd:
        txt = ar.texto_pdf(_bytes_bronze(max(vd, key=lambda v: v["capturado_em"])["arquivo"]) or b"")
        dic = ar.vigencia_no_dicionario(txt) if txt else {}
    for x in vig:
        x["conferencia_fim"] = None
        if x["vigencia_fim_origem"] == "ultimo_acionamento":
            d = dic.get(x["patamar"])
            ua = x["ultimo_acionamento"]["competencia"]
            x["conferencia_fim"] = (
                {"resultado": "aprovado" if d[1] == ua else "reprovado",
                 "detalhe": f"o dicionário do recurso Acionamento escreve a vigência do patamar de {d[0]} a {d[1]}; "
                            f"último mês com acionamento no recurso: {ua}"}
                if d else {"resultado": "nao_executada", "detalhe": "dicionário do recurso Acionamento sem texto legível neste ambiente"})
    _escreve_csv(ctx, CSV_BAND, ["ato", "patamar", "vigencia_inicio", "vigencia_fim", "vigencia_fim_origem", "ultimo_acionamento",
                                 "ultimo_acionamento_rs_mwh", "rs_mwh"],
                 [[x["ato"], x["patamar"], x["vigencia_inicio"], x["vigencia_fim"], x["vigencia_fim_origem"],
                   (x["ultimo_acionamento"] or {}).get("competencia"), (x["ultimo_acionamento"] or {}).get("rs_mwh"), x["rs_mwh"]]
                  for x in vig])
    gerado = max((x["gerado_em"] for x in linhas if x.get("gerado_em")), default=None)
    gerado_acion = max((x["gerado_em"] for x in acion if x.get("gerado_em")), default=None)
    return {"vigencias": [{k: x[k] for k in ("ato", "patamar", "vigencia_inicio", "vigencia_fim", "vigencia_fim_origem",
                                             "ultimo_acionamento", "resolucao_seguinte_sem_patamar", "conferencia_fim", "rs_mwh")}
                          for x in vig],
            "gerado_pela_fonte_em": gerado, "acionamento_gerado_pela_fonte_em": gerado_acion,
            "acionamento_meses": len(acion),
            "acionamento_periodo": {"inicio": acion[0]["competencia"], "fim": acion[-1]["competencia"]} if acion else None}


_TITULO_REN = re.compile(r"Resolução Normativa nº ([\d.]+), de (\d{1,2})º? de (\w+) de (\d{4})")


def _ren_do_documento(doc):
    """(número, ano, data ISO) de um documento do registro que é Resolução Normativa."""
    m = _TITULO_REN.search(doc.get("titulo") or "")
    if not m or m.group(3).lower() not in ar.MESES:
        return None
    return ar._int(m.group(1)), int(m.group(4)), date(int(m.group(4)), ar.MESES[m.group(3).lower()], int(m.group(2))).isoformat()


def _bloco_procedimentos(con, ctx, atas, textos, docs):
    """Versão vigente segundo as páginas oficiais, conferida com os atos integrados.

    A página publica o arquivo da "versão vigente" e o nome do arquivo traz o ato
    ('aren2021956_Prodist_modulo_11_v2.pdf' = REN nº 956/2021). Esse ato é conferido com duas
    fontes que o módulo já integra: as decisões das atas da Diretoria que aprovam versões de
    módulos (`ar.aprovacoes_de_procedimentos`) e os anexos das Resoluções Normativas guardadas
    no bronze (`ar.anexos_de_procedimentos`). Ato posterior ao da página que aprova nova versão
    do mesmo módulo deixa o item como 'página oficial possivelmente desatualizada', sem
    afirmar o ato da página como vigente."""
    regs = base.registros_como_estavam_em(con, DS_PAG)
    vs = {v["recurso"]: v for v in base.vintages_do_dataset(con, DS_PAG)}
    itens = []
    for ch, r in regs.items():
        if "|" not in ch:
            continue
        conj, mod = ch.split("|", 1)
        tna = _tipo_numero_ano(r.get("ato") or "")
        itens.append({"conjunto": conj, "modulo": mod, "titulo": r.get("titulo"), "versao_na_pagina": r.get("versao"),
                      "ato_na_pagina": r.get("ato"), "ano_ato": tna[2] if tna else None, "numero_ato": tna[1] if tna else None,
                      "url_vigente": r.get("url_vigente"), "url_versoes": r.get("url_versoes"), "observacao": r.get("observacao")})

    # evidências: atas (decisões que aprovam versões) e anexos das REN guardadas no bronze
    evid = {}
    for e in ar.aprovacoes_de_procedimentos(atas):
        evid.setdefault((e["conjunto"], ar.canonico_procedimento(e["modulo"])), []).append(e)
    titulos = {(i["conjunto"], ar.canonico_procedimento(i["modulo"])): i["titulo"] for i in itens}
    for did, d in docs.items():
        ren = _ren_do_documento(d) if d.get("formato") == "pdf" else None
        if not ren:
            continue
        t = textos.get(did)
        if t is None:
            t = textos[did] = _texto_documento(con, d)
        if t.get("status") != "ok":
            continue
        for conj in ("PRODIST", "PRORET"):
            tit = {k[1]: v for k, v in titulos.items() if k[0] == conj}
            for an in ar.anexos_de_procedimentos(t["textos"][0], tit):
                evid.setdefault((conj, ar.canonico_procedimento(an["modulo"])), []).append({
                    "conjunto": conj, "modulo": an["modulo"], "ato": f"Resolução Normativa nº {ar.numero_ato(ren[0])}/{ren[1]}",
                    "numero": ren[0], "ano": ren[1], "tipo_ato": "Resolução Normativa", "data": ren[2],
                    "fonte": f"texto do ato ({did}, sha256 {(t.get('vintage') or {}).get('sha256', '')[:12]})", "trecho": an["trecho"]})
    for i in itens:
        data_pag = None
        if i["numero_ato"]:
            ata = _ata_do_ato(atas, "Resolução Normativa", i["numero_ato"], i["ano_ato"])
            data_pag = ata["data"] if ata else next((r[2] for r in (_ren_do_documento(d) for d in docs.values()) if r
                                                     and (r[0], r[1]) == (i["numero_ato"], i["ano_ato"])), None)
        cf = ar.confere_versao({"numero_ato": i["numero_ato"], "ano_ato": i["ano_ato"], "ato": i["ato_na_pagina"]},
                               evid.get((i["conjunto"], ar.canonico_procedimento(i["modulo"])), []), data_pag)
        lim = lambda xs: [{**{k: e[k] for k in ("ato", "data", "fonte", "trecho")}, "versao_aprovada": e.get("versao_aprovada")}  # noqa: E731
                          for e in sorted(xs, key=lambda e: e["data"])]
        i.update({"data_ato_na_pagina": data_pag, "conferencia": cf["situacao"], "ato_vigente": cf["ato_vigente"],
                  "atos_posteriores": lim(cf["atos_posteriores"]), "confirmacoes": lim(cf["confirmacoes"])})

    def chave(i):
        nums = [int(x) if x.isdigit() else 0 for x in re.findall(r"\d+", i["modulo"])]
        return (i["conjunto"], nums, i["modulo"])
    itens.sort(key=chave)
    verif = {k: (vs.get(k) or {}).get("capturado_em") for k in ("prodist", "proret")}
    _escreve_csv(ctx, CSV_PROC, ["conjunto", "modulo", "titulo", "versao_na_pagina", "ato_na_pagina", "ano_ato", "conferencia",
                                 "ato_vigente", "atos_posteriores", "url_vigente", "url_versoes", "observacao", "verificado_em"],
                 [[i["conjunto"], i["modulo"], i["titulo"], i["versao_na_pagina"], i["ato_na_pagina"], i["ano_ato"], i["conferencia"],
                   i["ato_vigente"], " | ".join(f"{e['ato']} ({e['data']}, {e['fonte']})" for e in i["atos_posteriores"]) or None,
                   i["url_vigente"], i["url_versoes"], i["observacao"], verif.get(i["conjunto"].lower())] for i in itens])
    contagem = {k: sum(1 for i in itens if i["conferencia"] == k)
                for k in ("confirmada_por_ato_integrado", "sem_conferencia_externa", "pagina_possivelmente_desatualizada")}
    return {"itens": itens, "verificado_em": verif, "paginas": {"PRODIST": PAGINAS["prodist"], "PRORET": PAGINAS["proret"]},
            "contagem_conferencia": contagem,
            "regra_conferencia": ("A versão e o ato vêm do nome do arquivo que a página oficial publica como versão vigente. O ato é "
                                  "conferido com as decisões das atas da Diretoria que aprovam versões de módulos e com os anexos das "
                                  "Resoluções Normativas lidas no bronze: ato posterior que aprova nova versão do mesmo módulo marca o "
                                  "item como página oficial possivelmente desatualizada (ato_vigente vazio); o mesmo ato da página "
                                  "confirma; sem ato integrado sobre o módulo, fica sem conferência externa.")}


# ======================================================================= P045: linha do tempo

def _bloco_linha_do_tempo(ctx, docs, textos, atas, bandeiras):
    lt = rg.linha_do_tempo()
    eventos = []
    for e in lt["eventos"]:
        t = textos.get(e["documento"]) or {}
        if t.get("status") == "ok":
            oks = [ar.confere_trecho(e[k], t["textos"]) for k in ("trecho", "efeito_declarado", "vigencia_regra")]
            confere = all(o for o, _ in oks)
            detalhe = "trecho, efeito declarado e regra de vigência encontrados no documento" if confere else \
                "; ".join(f for _, fs in oks for f in fs)[:300]
        else:
            confere, detalhe = None, f"conferência não executada: {t.get('status', 'documento sem registro')}"
        tna = _tipo_numero_ano(e["ato"])
        ata = _ata_do_ato(atas, tna[0], tna[1], tna[2]) if tna and e["orgao"] == "ANEEL" else None
        d = docs.get(e["documento"], {})
        eventos.append({**e, "origem": "curadoria", "trecho_confere": confere, "conferencia_detalhe": detalhe,
                        "url_oficial": d.get("url_oficial"), "copia_publica": d.get("copia_publica"),
                        "sha256": (t.get("vintage") or {}).get("sha256") if d.get("formato") == "pdf" else None,
                        "deliberacao": {"data": ata["data"], "reuniao": ata["reuniao"]} if ata else None})
    # bandeiras: um evento por resolução que mudou os adicionais (conjunto de dados, sem texto do ato)
    por_ato = {}
    for x in bandeiras["vigencias"]:
        por_ato.setdefault((x["ato"], x["vigencia_inicio"]), []).append(x)
    for (ato, ini), xs in sorted(por_ato.items(), key=lambda k: k[0][1]):
        valores = "; ".join(f"{x['patamar']} R$ {rg.numero_br(x['rs_mwh'])}/MWh" for x in xs if x["rs_mwh"] is not None)
        novo_patamar = any(x["patamar"] == "Escassez Hídrica" for x in xs)
        eventos.append({
            "id": f"bandeiras-{ini}", "titulo": ("Criação do patamar de escassez hídrica" if novo_patamar
                                                 else "Novos valores dos adicionais das bandeiras tarifárias"),
            "orgao": "ANEEL" if ato and ato.startswith("REH") else "CREG" if ato and "CREG" in ato else "ANEEL",
            "ato": ato, "tipo_ato": "Resolução Homologatória" if ato and ato.startswith("REH") else "Resolução",
            "data_ato": None, "data_publicacao": None, "vigencia_inicio": ini,
            "vigencia_regra": "data de vigência informada pelo conjunto de dados da ANEEL (DatVigencia)", "vigencia_calculada": False,
            "dispositivo": "não lido: o texto do ato não foi acessado; valores do recurso 'Bandeira Tarifária - Adicional'",
            "resumo": f"Adicionais por patamar a partir de {c.data_br(ini)}: {valores}.",
            "efeito_declarado": None, "impacto_estimado": None, "temas": ["tarifa", "bandeiras"],
            "paineis": [{"rotulo": "Conta de luz", "href": "/setor-eletrico/conta-de-luz"}],
            "documento": None, "trecho": "; ".join(f"{ato};{ini};{x['patamar']};{rg.numero_br(x['rs_mwh'])}" for x in xs),
            "nivel_conferencia": "registro_em_conjunto_de_dados_oficial", "observacoes": [
                "Evento derivado do conjunto de dados, sem leitura do ato; a data de publicação não é informada pela fonte."],
            "origem": "conjunto_de_dados", "trecho_confere": None, "conferencia_detalhe": "valores do recurso CSV guardado no bronze",
            "url_oficial": URL_BAND, "copia_publica": None, "sha256": None, "deliberacao": None})
    eventos.sort(key=lambda e: (e["vigencia_inicio"], e["id"]), reverse=True)
    temas = sorted({t for e in eventos for t in e["temas"]})
    paineis = sorted({(p["rotulo"], p["href"]) for e in eventos for p in e["paineis"]})
    _escreve_csv(ctx, CSV_LT, ["id", "data_publicacao", "vigencia_inicio", "vigencia_calculada", "orgao", "ato", "tipo_ato",
                               "dispositivo", "titulo", "resumo", "efeito_declarado", "impacto_estimado", "temas", "paineis",
                               "documento", "nivel_conferencia", "trecho_confere", "origem"],
                 [[e["id"], e["data_publicacao"], e["vigencia_inicio"], int(bool(e["vigencia_calculada"])), e["orgao"], e["ato"],
                   e["tipo_ato"], e["dispositivo"], e["titulo"], e["resumo"], e["efeito_declarado"], None, "|".join(e["temas"]),
                   "|".join(p["href"] for p in e["paineis"]), e["documento"], e["nivel_conferencia"],
                   None if e["trecho_confere"] is None else int(e["trecho_confere"]), e["origem"]] for e in eventos])
    return {"conferido_em": lt["conferido_em"], "nota": lt["nota"], "eventos": eventos, "temas": temas,
            "paineis": [{"rotulo": r, "href": h} for r, h in paineis]}


# ======================================================================= P046: consultas e agenda

def _convencao_de_contagem(atas):
    """Como as atas contam o prazo quando escrevem as duas datas e a duração: {inclusiva (fim =
    início + duração − 1), exclusiva (fim = início + duração), outra, casos}. Sustenta e
    delimita o fim calculado de `ar.fim_pela_duracao` (convenção inclusiva, a mais frequente,
    que nunca estende uma consulta além do que a outra convenção daria)."""
    c = {"inclusiva": 0, "exclusiva": 0, "outra": 0}
    for a in atas:
        if not ((a["tipo_ato"] in ar.TIPOS_ABERTURA or a["tipo_ato"] in ar.TIPOS_FASE) and a["resultado"] in ar.DELIBERADO):
            continue
        js, dur = ar.periodos_da_decisao(a["decisao"], a["data"]), ar.duracao_da_decisao(a["decisao"])
        if len(js) != 1 or not dur:
            continue
        n = (date.fromisoformat(js[0]["fim"]) - date.fromisoformat(js[0]["inicio"])).days + 1
        c["inclusiva" if n == dur else "exclusiva" if n - 1 == dur else "outra"] += 1
    return {**c, "casos": sum(c.values())}


ORDEM_SITUACAO = {"aberta": 0, "a_abrir": 1, "resultado_em_pauta": 2, "prazo_nao_datado": 3, "sessao_sem_periodo": 4,
                  "sem_periodo_na_ata": 5, "encerrada_aguardando": 6, "decidida": 7}


def _totais_completos(con):
    """{(sig, ano): total} das contagens anuais da ANEEL, só anos completos: o ano em que a
    fonte gerou o arquivo é parcial e não serve de teto para o número de uma consulta."""
    ger = base.registros_como_estavam_em(con, DS_PART)
    out = {}
    for sig, serie in (("CP", "consultas"), ("AP", "audiencias")):
        for a, v in _serie(con, DS_PART, serie).items():
            if v is not None and (ger.get(a) or {}).get("gerado_em", "")[:4] != a:
                out[(sig, int(a))] = v
    return out


def _bloco_consultas(con, ctx, hoje, atas, agenda_codigos):
    cons = ar.consultas_das_atas(atas, _totais_completos(con))
    por_chave = {ar.chave_ata(a): a for a in atas}
    data_ult = max((a["data"] for a in atas), default=None)
    gerado = max((a["gerado_em"] for a in atas if a.get("gerado_em")), default=None)
    lim = (date.fromisoformat(hoje) - timedelta(days=JANELA_CONSULTAS_DIAS)).isoformat()
    todos, itens, integrais = [], [], {}
    for cid, cn in cons.items():
        sit = ar.situacao(cn, hoje)
        f = ar.fase_atual(cn)
        j = ar.janela_vigente(cn)
        res = cn["resultado"]
        # códigos da Agenda no texto integral da abertura e das fases (o resumo da decisão é cortado)
        txt = " ".join([cn["texto_integral"]] + [(por_chave.get(x["chave"]) or {}).get("decisao", "") for x in cn["fases"]])
        cods = sorted({ar.codigo_canonico(m) for m in ar._CODIGO.findall(txt)} & agenda_codigos)
        integrais[cid] = {x["chave"]: (por_chave.get(x["chave"]) or {}).get("decisao", "") for x in cn["fases"]}
        item = {
            "id": cid, "modalidade": cn["modalidade"], "numero": cn["numero"], "numero_na_ata": cn["numero_na_ata"],
            "ano": cn["ano"], "rotulo": f"{cn['modalidade']} nº {cn['numero']}/{cn['ano']}", "numero_citado": cn["citacoes_numero"],
            "numero_em_conflito": bool(cn.get("numero_em_conflito")), "numero_suspeito": cn["numero_suspeito"],
            "motivo_numero_suspeito": cn["motivo_numero_suspeito"], "numero_citado_no_processo": cn["numero_citado_no_processo"],
            "tema": cn["tema"], "processos": [ar.processo_formatado(p) for p in cn["processos"]], "relator": cn["relator"],
            "deliberacao_abertura": {"data": cn["abertura"]["data"], "reuniao": cn["abertura"]["reuniao"],
                                     "decisao": cn["abertura"]["decisao"]},
            "fases": [{k: x[k] for k in ("fase", "data_deliberacao", "reuniao", "inicio", "fim", "janela_origem", "fim_calculado",
                                         "duracao_dias", "sessao", "trecho_periodo")} for x in cn["fases"]],
            "fase_atual": f["fase"] if f else None, "inicio": j["inicio"] if j else None, "fim": j["fim"] if j else None,
            "janela_origem": j["janela_origem"] if j else None, "fim_calculado": bool(j and j["fim_calculado"]),
            "duracao_dias": f["duracao_dias"] if f else None, "sessao": f["sessao"] if f else None,
            "situacao": sit, "situacao_rotulo": ar.SITUACOES[sit],
            "resultado": ({k: res[k] for k in ("data", "reuniao", "ato", "resultado_julgamento", "decidido", "decisao", "vinculo")}
                          if res else None),
            "agenda_codigos": cods,
        }
        todos.append(item)
        recente = (item["fim"] or "") >= lim or (res and res["data"] >= lim) or \
            (sit not in ("encerrada_aguardando", "decidida") and cn["abertura"]["data"] >= lim)
        if recente:
            itens.append(item)
    itens.sort(key=lambda i: (ORDEM_SITUACAO[i["situacao"]], i["fim"] or "9999", i["deliberacao_abertura"]["data"]))
    todos.sort(key=lambda i: (i["deliberacao_abertura"]["data"], i["id"]), reverse=True)
    _escreve_csv(ctx, CSV_CONS, ["id", "modalidade", "numero", "numero_na_ata", "ano", "numero_citado", "numero_em_conflito",
                                 "numero_suspeito", "motivo_numero_suspeito", "processos", "data_deliberacao", "reuniao", "relator",
                                 "tema", "fase_atual", "inicio", "fim", "janela_origem", "fim_calculado", "duracao_dias", "sessao",
                                 "situacao", "data_referencia", "resultado_data", "resultado_ato", "resultado_julgamento",
                                 "vinculo_resultado", "decisao_abertura"],
                 [[i["id"], i["modalidade"], i["numero"], i["numero_na_ata"], i["ano"], i["numero_citado"], int(i["numero_em_conflito"]),
                   int(i["numero_suspeito"]), i["motivo_numero_suspeito"], "|".join(i["processos"]), i["deliberacao_abertura"]["data"],
                   i["deliberacao_abertura"]["reuniao"], i["relator"], i["tema"], i["fase_atual"], i["inicio"], i["fim"],
                   i["janela_origem"], int(i["fim_calculado"]), i["duracao_dias"], i["sessao"], i["situacao"], hoje,
                   (i["resultado"] or {}).get("data"), (i["resultado"] or {}).get("ato"),
                   (i["resultado"] or {}).get("resultado_julgamento"), (i["resultado"] or {}).get("vinculo"),
                   i["deliberacao_abertura"]["decisao"]] for i in todos])
    # cobertura: aberturas nas atas × total anual publicado pela ANEEL, por modalidade
    totais, totais_ap = _serie(con, DS_PART, "consultas"), _serie(con, DS_PART, "audiencias")
    ger_part = base.registros_como_estavam_em(con, DS_PART)
    abertas_ano, ap_ano = {}, {}
    for i in todos:
        alvo = abertas_ano if i["modalidade"] == "Consulta Pública" else ap_ano
        alvo[i["ano"]] = alvo.get(i["ano"], 0) + 1
    cobertura = [{"ano": int(a), "nas_atas": abertas_ano.get(int(a), 0), "total_anual_aneel": int(v),
                  "audiencias_nas_atas": ap_ano.get(int(a), 0),
                  "audiencias_total_anual_aneel": int(totais_ap[a]) if totais_ap.get(a) is not None else None,
                  "parcial": (ger_part.get(a) or {}).get("gerado_em", "")[:4] == a,
                  "gerado_em": (ger_part.get(a) or {}).get("gerado_em")}
                 for a, v in sorted(totais.items()) if int(a) >= 2018]

    def faixa(campo_n, campo_t, de=2020, ate=2025):
        xs = [100 * x[campo_n] / x[campo_t] for x in cobertura if de <= x["ano"] <= ate and x.get(campo_t)]
        return {"de": de, "ate": ate, "min_pct": round(min(xs), 1), "max_pct": round(max(xs), 1)} if xs else None
    contagem = {s: sum(1 for i in todos if i["situacao"] == s) for s in ar.SITUACOES}
    return {"data_referencia": hoje, "atas_ate": data_ult, "atas_geradas_em": gerado, "janela_dias": JANELA_CONSULTAS_DIAS,
            "itens": itens, "total_historico": len(todos), "contagem_por_situacao": contagem, "cobertura": cobertura,
            "cobertura_faixa": {"consultas": faixa("nas_atas", "total_anual_aneel"),
                                "audiencias": faixa("audiencias_nas_atas", "audiencias_total_anual_aneel")},
            "numeros_suspeitos": sum(1 for i in todos if i["numero_suspeito"]),
            "convencao_contagem_prazo": _convencao_de_contagem(atas),
            "situacoes": ar.SITUACOES,
            "regra_situacao": ("Situação derivada da data de referência (horário de Brasília): resultado deliberado = decidida; "
                               "resultado levado à reunião sem decisão depois da deliberação da fase atual = resultado em pauta; "
                               "fase atual sem janela = prazo não datado (só a duração), sessão sem período (audiência com data de "
                               "sessão) ou sem período na ata, nunca aberta; antes do início = a abrir; entre início e fim, inclusive "
                               "= aberta; depois do fim = encerrada aguardando resultado. A janela vem das duas datas escritas na "
                               "ata ou, quando a ata dá só o início e a duração, do fim calculado (fim_calculado = true, contando o "
                               "dia do início)."),
            "_todos": todos, "_integrais": integrais}


def _bloco_agenda(con, ctx, docs, textos, cons_todos):
    doc = docs.get("prt20257030", {})
    t = textos.get("prt20257030") or {}
    regs = base.registros_como_estavam_em(con, DS_PAG).get("agenda") or {}
    revisao = {"aprovada_por": regs.get("aprovada_por"), "atualizada_por": regs.get("atualizada_por"), "trecho": regs.get("trecho"),
               "pagina": PAGINAS["agenda"]}
    if t.get("status") != "ok" or not t.get("layout"):
        return {"disponivel": False, "motivo": f"texto da Portaria nº 7.030/2025 indisponível ({t.get('status', 'sem registro')})",
                "itens": [], "revisao": revisao}
    try:
        itens = ar.agenda_do_anexo(t["layout"])
    except ValueError as e:
        return {"disponivel": False, "motivo": f"leitura do Anexo I falhou: {e}", "itens": [], "revisao": revisao}
    por_cod = {}
    for cn in cons_todos:
        for cod in cn["agenda_codigos"]:
            por_cod.setdefault(cod, []).append(cn["id"])
    for i in itens:
        i["paineis"] = ar.paineis_da_atividade(i["atividade"])
        i["consultas"] = por_cod.get(i["codigo"], [])
    versao = "Anexo I da Portaria ANEEL nº 7.030/2025 (versão aprovada em 02/12/2025)"
    _escreve_csv(ctx, CSV_AGENDA, ["codigo", "atividade", "ano_previsto", "paineis_relacionados", "consultas_citando_codigo",
                                   "versao_da_agenda"],
                 [[i["codigo"], i["atividade"], i["ano_previsto"], "|".join(p["href"] for p in i["paineis"]),
                   "|".join(i["consultas"]), versao] for i in itens])
    v = t.get("vintage") or {}
    return {"disponivel": True, "versao": versao, "portaria": "Portaria ANEEL nº 7.030, de 2 de dezembro de 2025",
            "data_publicacao": "2025-12-05", "url_oficial": doc.get("url_oficial"), "copia_publica": doc.get("copia_publica"),
            "sha256": v.get("sha256"), "revisao": revisao, "itens": itens,
            "por_ano": {str(a): sum(1 for i in itens if i["ano_previsto"] == a) for a in sorted({i["ano_previsto"] for i in itens})},
            "regra_paineis": "painel relacionado por palavra-chave do texto da atividade (lista publicada em fontes/aneel_regulacao.py, REGRAS_PAINEL); não é inferência de efeito"}


# ======================================================================= construção

def construir(con, ctx):
    ctx = ctx or {}
    hoje = _hoje(ctx)
    try:
        rg.limites_pld()
    except ValueError as e:
        return c.stub(GOLD, f"limites_pld.json inválido: {e}")
    try:
        rg.linha_do_tempo()
    except ValueError as e:
        return c.stub(GOLD, f"linha_do_tempo.json inválido: {e}")
    docs = rg.documentos()
    usados = {x["documento_valores"] for x in rg.conferencia_limites()["atos"]} | \
             {x["documento_publicacao"] for x in rg.conferencia_limites()["atos"] if x.get("documento_publicacao")} | \
             {e["documento"] for e in rg.linha_do_tempo()["eventos"]} | {"prt20257030"}
    textos = {d: _texto_documento(con, docs[d]) for d in usados if d in docs}
    atas = _atas(con)
    ipca = _serie(con, DS_IPCA, "ipca.indice")

    bl = _bloco_limites(con, ctx, hoje, docs, textos, atas, ipca)
    # conferência crítica: valor que não aparece no PDF, deliberação com número divergente ou
    # regra do IPCA violada viram stub (a sentinela mantém a última publicação válida)
    criticas = [x for x in bl["reprovadas"] if x["conferencia"] in ("trecho_no_pdf", "regra_ipca", "piso_teo")]
    if criticas:
        return c.stub(GOLD, "conferência reprovada: " + "; ".join(f"{x['ano']} {x['conferencia']} {x['campo']}: {x['detalhe']}"
                                                                    for x in criticas)[:280])
    snap_docs, snap_atas, snap_ipca = c.snapshot_de(con, DS_DOCS), c.snapshot_de(con, DS_ATAS), c.snapshot_de(con, DS_IPCA)
    snap_band, snap_pag, snap_part = c.snapshot_de(con, DS_BAND), c.snapshot_de(con, DS_PAG), c.snapshot_de(con, DS_PART)
    snap_cur = c.snapshot_de(con, DS_CURADORIA)
    evid = _evidencias_limites(bl, textos, docs, snap_docs)
    band = _bloco_bandeiras(con, ctx)
    proc = _bloco_procedimentos(con, ctx, atas, textos, docs)
    lt = _bloco_linha_do_tempo(ctx, docs, textos, atas, band)

    agenda_codigos = set()
    t_ag = textos.get("prt20257030") or {}
    if t_ag.get("layout"):
        try:
            agenda_codigos = {i["codigo"] for i in ar.agenda_do_anexo(t_ag["layout"])}
        except ValueError:
            agenda_codigos = set()
    if atas:
        cons = _bloco_consultas(con, ctx, hoje, atas, agenda_codigos)
    else:
        cons = {"disponivel": False, "motivo": "atas da Diretoria ainda não integradas ao silver", "itens": [], "_todos": [],
                "data_referencia": hoje, "cobertura": [], "contagem_por_situacao": {}, "situacoes": ar.SITUACOES}
    agenda = _bloco_agenda(con, ctx, docs, textos, cons.get("_todos", []))
    cons.pop("_todos", None)
    integrais = cons.pop("_integrais", {})
    cons.setdefault("disponivel", True)

    # agenda que pode mudar os limites do PLD (P044): só atividades cujo texto trata dos limites
    # (piso, PLD mínimo, limites máximos); ligação ao painel do PLD por palavra-chave não basta
    # (a dupla contabilização ex-ante/ex-post cita o PLD e não trata de limites)
    em_revisao = [i for i in agenda.get("itens", []) if REGRA_LIMITES_AGENDA.search(i["atividade"])]

    cap_docs = c.ultima_captura(snap_docs)
    lim_comuns = ["Origem dos atos da ANEEL (www2.aneel.gov.br/cedoc) bloqueada por desafio de navegador; PDFs lidos na cópia "
                  "pública do Internet Archive (bytes originais, modo id_), aceita só com o sha256 registrado."]
    prov = {
        "limites": c.proveniencia(
            indicador="Limites do PLD por ato e vigência", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Atos anuais de limites do PLD (REH e despachos)", "PDF do texto do ato ou do voto/nota técnica do processo",
                         "https://www2.aneel.gov.br/cedoc/", bl["atos"][-1]["url_oficial"] or bl["atos"][-1]["url"], LIC_ATOS),
            unidade="R$/MWh", frequencia="anual (ato publicado em dezembro para o ano seguinte)",
            periodo={"inicio": bl["atos"][0]["vigencia_inicio"], "fim": bl["atos"][-1]["vigencia_fim"]},
            cobertura={"inicio": bl["atos"][0]["vigencia_inicio"], "fim": bl["atos"][-1]["vigencia_fim"]},
            capturado_em=cap_docs, snapshot=snap_docs, publicado_em=bl["atos"][-1]["data_publicacao"],
            transformacoes=["valor transcrito do ato com trecho literal; conferido automaticamente no texto extraído do PDF",
                            "vigência campo a campo: vale o ato em vigor que informa o campo, com a publicação mais recente",
                            "conferência independente: número e data da deliberação nas atas da Diretoria; teto publicado no ano "
                            "anterior encadeado pela variação do IPCA de novembro (prática dos atos)",
                            "aplicação literal do art. 23, § 1º, da REN nº 1.032/2022 calculada e publicada como informação "
                            "(art23_literal), sem ser critério de aprovação"],
            limitacoes=lim_comuns + [
                "2021: texto e extrato da REH nº 2.828/2020 não acessados; valores lidos no voto do processo da REH nº 2.994/2021 e data de publicação vazia.",
                "2023: texto da REH nº 3.167/2022 e da retificação não acessados; valores lidos no voto e na Nota Técnica nº 01/2023-SGT/ANEEL.",
                "Limites anteriores a 2021 não integrados (PLD horário só existe desde 2021).",
                "O menor preço observado nunca substitui o piso: sem ato, o campo fica vazio."],
            download=_u(CSV_ATOS)),
        "bandeiras": c.proveniencia(
            indicador="Adicional das bandeiras tarifárias por vigência", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Bandeiras Tarifárias", "Bandeira Tarifária - Adicional (CSV); Bandeira Tarifária - Acionamento (CSV)",
                         URL_BAND, URL_BAND, LIC_ANEEL),
            unidade="R$/MWh", frequencia="por resolução",
            periodo={"inicio": min((x["vigencia_inicio"] for x in band["vigencias"]), default=None) or "",
                     "fim": max((x["vigencia_inicio"] for x in band["vigencias"]), default=None) or ""},
            cobertura={"inicio": min((x["vigencia_inicio"] for x in band["vigencias"]), default=None) or "",
                       "fim": max((x["vigencia_inicio"] for x in band["vigencias"]), default=None) or ""},
            capturado_em=c.ultima_captura(snap_band), snapshot=snap_band,
            transformacoes=["fim de vigência = véspera do valor seguinte do mesmo patamar",
                            "patamar extinto (ausente da resolução seguinte do recurso Adicional e sem acionamento depois): fim no "
                            "último dia do último mês com acionamento no recurso 'Bandeira Tarifária - Acionamento', conferido com a "
                            "vigência escrita no dicionário desse recurso"],
            limitacoes=["A fonte informa a data de vigência, não a de publicação do ato; o texto das resoluções não foi lido.",
                        "Valores sem fim (" + (", ".join(x["patamar"] for x in band["vigencias"] if x["vigencia_fim"] is None) or "nenhum")
                        + "): não há valor posterior no recurso Adicional e o patamar não foi extinto.",
                        "O fim de patamar extinto tem grão mensal: o recurso Acionamento é mensal e não informa o dia"
                        + "".join(f" ({x['patamar']}: R$ {rg.numero_br(x['ultimo_acionamento']['rs_mwh'])}/MWh em "
                                  f"{x['ultimo_acionamento']['competencia']}, contra adicional de R$ {rg.numero_br(x['rs_mwh'])}/MWh)"
                                  for x in band["vigencias"] if x.get("ultimo_acionamento") and x["ultimo_acionamento"].get("rs_mwh") is not None)
                        + ".",
                        f"Arquivo gerado pela fonte em {band['gerado_pela_fonte_em'] or 'data não informada'} (Adicional) e "
                        f"{band.get('acionamento_gerado_pela_fonte_em') or 'data não informada'} (Acionamento); resolução posterior não "
                        "aparece até a ANEEL atualizar o recurso."],
            download=_u(CSV_BAND)),
        "procedimentos": c.proveniencia(
            indicador="Versão vigente dos módulos do PRODIST e do PRORET", natureza="OBSERVADO",
            fonte=_fonte("ANEEL", "Páginas oficiais do PRODIST e do PRORET", "HTML das páginas gov.br", PAGINAS["prodist"],
                         PAGINAS["proret"], LIC_GOVBR),
            unidade="versão", frequencia="quando a ANEEL aprova nova versão",
            periodo={"inicio": hoje, "fim": hoje}, cobertura={"inicio": hoje, "fim": hoje},
            capturado_em=c.ultima_captura(snap_pag), snapshot=snap_pag,
            transformacoes=["ato e versão lidos do nome do arquivo que a página publica como versão vigente",
                            "ato da página conferido com as decisões das atas da Diretoria que aprovam versões de módulos e com os "
                            "anexos das Resoluções Normativas lidas no bronze (regra_conferencia)"],
            limitacoes=["Os PDFs dos módulos estão em git.aneel.gov.br, bloqueado por desafio de navegador; o conteúdo de cada versão não foi lido.",
                        "A data de início de vigência de cada versão não é informada pela página, exceto nas notas transcritas.",
                        f"{proc['contagem_conferencia']['pagina_possivelmente_desatualizada']} itens têm ato posterior ao da página que "
                        "aprova nova versão do mesmo módulo: a página oficial pode estar desatualizada e o número da versão vigente "
                        "não é conhecido (ato_vigente vazio).",
                        "Itens sem conferência externa: nenhuma ata nem ato integrado trata do módulo depois do ato da página; isso "
                        "não prova que a versão está atualizada (atos decididos fora das reuniões públicas não aparecem)."],
            download=_u(CSV_PROC)),
        "linha_do_tempo": c.proveniencia(
            indicador="Linha do tempo regulatória", natureza="OBSERVADO",
            fonte=_fonte("ANEEL; Congresso Nacional; MME", "Atos normativos citados", "PDF dos atos e texto das leis no portal do Senado",
                         "https://www2.aneel.gov.br/cedoc/", "https://legis.senado.leg.br/", f"{LIC_ATOS}; {LIC_SENADO}"),
            unidade="evento", frequencia="por ato",
            periodo={"inicio": min(e["vigencia_inicio"] for e in lt["eventos"]), "fim": max(e["vigencia_inicio"] for e in lt["eventos"])},
            cobertura={"inicio": min(e["vigencia_inicio"] for e in lt["eventos"]), "fim": max(e["vigencia_inicio"] for e in lt["eventos"])},
            capturado_em=cap_docs, snapshot=snap_docs,
            transformacoes=["resumo editorial conferido no texto; efeito declarado e regra de vigência são literais do ato",
                            "vigência calculada, quando marcada, pela LC nº 95/1998, art. 8º, § 1º",
                            "eventos de bandeiras derivados do conjunto de dados da ANEEL, sem leitura do ato"],
            limitacoes=lim_comuns + [
                "Impacto estimado não é calculado: coincidência entre data de norma e movimento de gráfico não é evidência de causa.",
                "Portaria MME nº 301/2019 citada por documento da ANEEL (texto da portaria não acessado).",
                "Seleção editorial de atos que mudam a leitura dos painéis; não é um repositório completo de normas."],
            download=_u(CSV_LT)),
        "consultas": c.proveniencia(
            indicador="Consultas e audiências públicas: período e situação", natureza="CALCULADO",
            fonte=_fonte("ANEEL", "Pautas e atas das reuniões públicas da Diretoria", "pautas-atas-reunioes-publicas-diretoria.csv",
                         URL_ATAS, URL_ATAS, LIC_ANEEL),
            unidade="consulta", frequencia="semanal (atualização da fonte)",
            periodo={"inicio": hoje, "fim": hoje},
            cobertura={"inicio": min((a["data"] for a in atas), default=hoje), "fim": cons.get("atas_ate") or hoje},
            capturado_em=c.ultima_captura(snap_atas), snapshot=snap_atas,
            formula="situação = f(data de referência, janela de contribuições da fase deliberada por último, resultado deliberado); ver regra_situacao",
            transformacoes=["período de contribuições lido do texto da decisão por expressões regulares testadas (datas por extenso, "
                            "numéricas e redações 'entre os dias', 'com início em ... até', 'iniciando em ... e finalizando em')",
                            "quando a ata dá só o início e a duração, fim calculado e rotulado (fim_calculado)",
                            "número da consulta = número do aviso na linha de abertura, conferido pelas citações 'nº N/AAAA' do mesmo "
                            "processo e pelo total anual publicado; número suspeito marcado e substituído no rótulo pelo número que o "
                            "processo cita, quando único",
                            "resultado ligado pela citação explícita de todas as consultas da oração do resultado, preferindo a do "
                            "mesmo processo, ou, na falta de número, pelo processo"],
            limitacoes=["Só entram consultas cuja abertura foi deliberada em reunião pública registrada nas atas; a cobertura anual "
                        "frente ao total publicado pela ANEEL está em 'cobertura'"
                        + (f": consultas públicas de {rg.numero_br(cons['cobertura_faixa']['consultas']['min_pct'], 1)}% a "
                           f"{rg.numero_br(cons['cobertura_faixa']['consultas']['max_pct'], 1)}% por ano e audiências públicas de "
                           f"{rg.numero_br(cons['cobertura_faixa']['audiencias']['min_pct'], 1)}% a "
                           f"{rg.numero_br(cons['cobertura_faixa']['audiencias']['max_pct'], 1)}% "
                           f"por ano entre {cons['cobertura_faixa']['consultas']['de']} e {cons['cobertura_faixa']['consultas']['ate']}."
                           if (cons.get("cobertura_faixa") or {}).get("consultas") and (cons.get("cobertura_faixa") or {}).get("audiencias")
                           else "."),
                        f"{cons.get('numeros_suspeitos', 0)} consultas têm número suspeito (acima do total anual publicado ou não citado "
                        "pelo próprio processo, que cita outro): o rótulo usa o número citado pelo processo quando ele é único.",
                        "Fim calculado (início e duração escritos na ata): conta o dia do início, a convenção mais frequente nas atas que "
                        "escrevem as duas datas e a duração (convencao_contagem_prazo); pela outra convenção o prazo terminaria um dia depois.",
                        "Prorrogação ou reabertura decidida fora da reunião pública não aparece; o aviso publicado pode ter datas diferentes das da decisão.",
                        "A situação vale para a data de referência e depende das atas publicadas até a última reunião registrada.",
                        "Tomadas de subsídios não são deliberadas em reunião e ficam de fora."],
            download=_u(CSV_CONS)),
        "agenda": c.proveniencia(
            indicador="Agenda Regulatória 2026-2027", natureza="PREVISTO",
            fonte=_fonte("ANEEL", "Agenda Regulatória 2026-2027", "Anexo I da Portaria ANEEL nº 7.030/2025 (PDF)", PAGINAS["agenda"],
                         docs.get("prt20257030", {}).get("url_oficial") or PAGINAS["agenda"], LIC_ATOS),
            unidade="atividade", frequencia="bienal, com revisões",
            periodo={"inicio": "2026-01-01", "fim": "2027-12-31"}, cobertura={"inicio": "2026-01-01", "fim": "2027-12-31"},
            capturado_em=cap_docs, snapshot=snap_docs, publicado_em="2025-12-05",
            transformacoes=["tabela do Anexo I lida do PDF com leiaute preservado; código, atividade e ano previsto"],
            limitacoes=lim_comuns + [
                "A primeira revisão (Portaria nº 7.157, de 8 de setembro de 2026) consta da página oficial e da ata de 08/09/2026, "
                "mas o texto não pôde ser lido: anos previstos e atividades podem ter mudado.",
                "Cronograma referencial de etapas (portalrelatorios.aneel.gov.br) não respondeu; o eixo temático não é extraído.",
                "Ano previsto é previsão da agência, reprogramável; não é compromisso nem data de decisão."],
            download=_u(CSV_AGENDA)),
    }

    # evidência do número de consultas abertas (P046)
    abertas = [i for i in cons.get("itens", []) if i["situacao"] == "aberta"]
    v_atas = max((v for v in base.vintages_do_dataset(con, DS_ATAS) if v["recurso"].lower().endswith(".csv")),
                 key=lambda v: v["capturado_em"], default=None)
    evid_cons = None
    # controles sobre as abertas, por caminhos independentes da leitura que derivou a janela:
    # (1) as datas da janela estão escritas no texto INTEGRAL da decisão (CSV original, não o
    #     trecho que a expressão regular capturou), por outra regra: dia e nome do mês a até 30
    #     caracteres, ou dd/mm/aaaa, e o ano presente no texto;
    # (2) a duração que a própria decisão declara bate com a janela (diferença de até 1 dia,
    #     pelas duas convenções de contagem que as atas usam);
    # (3) nenhuma linha posterior das atas, no mesmo processo, leva resultado ou encerramento à
    #     Diretoria (varredura direta das linhas, sem a ligação por número).
    escritas, coerentes, com_duracao, incoerentes, posteriores = 0, 0, 0, [], []
    for i in abertas:
        f = next((x for x in i["fases"] if x["inicio"] == i["inicio"] and x["fim"] == i["fim"]), None)
        cn_txt = integrais.get(i["id"], {})
        txt = next((t for ch, t in cn_txt.items() if f and ch.startswith(f["data_deliberacao"] + "|")), "")
        datas = [i["inicio"]] if i["fim_calculado"] else [i["inicio"], i["fim"]]
        escritas += bool(txt) and all(_data_escrita(txt, d) for d in datas)
        if f and f["duracao_dias"]:
            com_duracao += 1
            n = (date.fromisoformat(i["fim"]) - date.fromisoformat(i["inicio"])).days + 1
            if abs(n - f["duracao_dias"]) <= 1:
                coerentes += 1
            else:
                incoerentes.append(f"{i['rotulo']}: {n} dias na janela, {f['duracao_dias']} declarados")
        procs = {re.sub(r"\D", "", p) for p in i["processos"]}
        for a in atas:
            if (a["data"] > (f or {}).get("data_deliberacao", "9999") and procs & set(ar.processos(a["processo"]))
                    and re.match(r"\s*(Resultados?|Encerramento|Fechamento)\b", a["assunto"])):
                posteriores.append(f"{i['rotulo']}: {a['data']} {a['assunto'][:60]}")
    testes_abertas = [
        ev.teste("Datas da janela escritas no texto integral da decisão (releitura independente)",
                 "aprovado" if escritas == len(abertas) else "reprovado",
                 f"{escritas} de {len(abertas)} janelas: início e fim (ou início, quando o fim é calculado) encontrados no texto "
                 "integral da decisão no CSV das atas, por regra distinta da leitura do período"),
        ev.teste("Duração declarada coerente com a janela",
                 "aprovado" if not incoerentes else "ressalva",
                 f"{coerentes} de {com_duracao} decisões que declaram a duração têm janela com diferença de até 1 dia"
                 + (f"; divergências da fonte: {'; '.join(incoerentes)}" if incoerentes else "")),
        ev.teste("Sem resultado posterior no mesmo processo",
                 "aprovado" if not posteriores else "reprovado",
                 "nenhuma linha posterior das atas, no mesmo processo, leva resultado ou encerramento à Diretoria"
                 if not posteriores else "; ".join(posteriores)[:300])]
    if v_atas and cons.get("disponivel", True) and atas:
        evid_cons = ev.construir(
            indicador="Consultas e audiências públicas recebendo contribuições", valor_exibido=str(len(abertas)),
            valor_calculo=len(abertas), unidade="consultas", periodo={"inicio": hoje, "fim": hoje},
            entidade="ANEEL", universo="avisos com abertura deliberada em reunião pública registrada nas atas",
            fonte=ev.fonte_de_vintage("ANEEL", "Pautas e atas das reuniões públicas da Diretoria", URL_ATAS, v_atas),
            chaves_origem=[f"{i['rotulo']} | reunião {i['deliberacao_abertura']['reuniao']} | {i['inicio']} a {i['fim']}" for i in abertas],
            formula="contagem de avisos cuja fase deliberada por último tem início ≤ data de referência ≤ fim e sem resultado deliberado",
            cobertura=f"atas publicadas até a reunião de {c.data_br(cons['atas_ate'])}" if cons.get("atas_ate") else "atas publicadas",
            tratamento_ausencia=("fase sem datas na ata (só duração, só sessão de audiência ou nada) não é contada como aberta; "
                                 "fim calculado de início e duração conta como janela, rotulado (fim_calculado)"),
            revisoes=c.snapshot_de(con, DS_ATAS).get("revisoes"),
            testes=testes_abertas,
            download=[{"rotulo": "Consultas e audiências (CSV)", "url": _u(CSV_CONS)}],
            reproducao="python3 pipeline/energia/executar_modulo.py regulacao --sem-coleta")

    g = c.cabecalho(GOLD, modulo="regulacao", data_referencia=hoje)
    g.update({
        "paineis": ["P044", "P045", "P046"],
        "resumo": {
            "limites_hoje": bl["vigente_hoje"],
            "ano_limites": int(hoje[:4]),
            "atos_limites": len(bl["atos"]),
            "anos_cobertos": sorted({a["ano"] for a in bl["atos"]}),
            "eventos_linha_do_tempo": len(lt["eventos"]),
            "consultas_abertas": len(abertas),
            "consultas_na_janela": len(cons.get("itens", [])),
            "atividades_agenda": len(agenda.get("itens", [])),
        },
        "limites_pld": {k: v for k, v in bl.items() if k != "reprovadas"},
        "limites_em_revisao": [{"codigo": i["codigo"], "atividade": i["atividade"], "ano_previsto": i["ano_previsto"]} for i in em_revisao],
        "regras_limites": next(({"ato": e["ato"], "dispositivo": e["dispositivo"], "resumo": e["resumo"], "trecho": e["trecho"],
                                 "vigencia_inicio": e["vigencia_inicio"], "documento": e["documento"], "url_oficial": e["url_oficial"]}
                                for e in lt["eventos"] if e["id"] == "ren-1032-2022"), None),
        "bandeiras": band,
        "procedimentos": proc,
        "linha_do_tempo": lt,
        "consultas": cons,
        "agenda": agenda,
        "evidencias": {"limites": evid, "consultas_abertas": evid_cons},
        "proveniencia": prov,
        "curadoria": {"snapshot": {"id": snap_cur.get("id"), "sha256": snap_cur.get("sha256")},
                      "arquivos": [{"arquivo": x["recurso"], "sha256": x["sha256"], "registrado_em": x["capturado_em"]}
                                   for x in snap_cur.get("capturas", [])]},
        "downloads": [{"rotulo": r, "url": _u(n)} for r, n in (
            ("Atos de limites do PLD", CSV_ATOS), ("Limites vigentes por período", CSV_VIG), ("Conferências dos limites", CSV_CONF),
            ("Adicionais das bandeiras", CSV_BAND), ("Procedimentos vigentes (PRODIST e PRORET)", CSV_PROC),
            ("Linha do tempo", CSV_LT), ("Consultas e audiências públicas (histórico)", CSV_CONS), ("Agenda Regulatória 2026-2027", CSV_AGENDA))],
        "limitacoes": [
            "Os atos da ANEEL foram lidos em cópias públicas do Internet Archive porque a origem oficial exige navegador; cada PDF é aceito só com o sha256 registrado.",
            "O Diário Oficial da União (www.in.gov.br) não respondeu; datas de publicação vêm da linha 'publicado no D.O.' impressa pela ANEEL no próprio ato.",
            "O InfoPLD da CCEE (S20) está em domínio bloqueado e não é fonte do ato; não foi usado.",
            "A situação das consultas é derivada da data de referência e das atas publicadas; decisões posteriores à última reunião registrada não aparecem.",
            "Nenhum efeito das normas é estimado aqui; a linha do tempo não sustenta causalidade.",
        ],
    })
    # validação de domínio antes de publicar (seção 5.2 do contrato)
    problemas = _valida_gold(g, hoje)
    if problemas:
        return c.stub(GOLD, "validação: " + "; ".join(problemas)[:280])
    return g


def _valida_gold(g, hoje):
    p = []
    for a in g["limites_pld"]["atos"]:
        for k in rg.CAMPOS_LIMITE:
            if a[k] is not None and not (0 < a[k] < 10000):
                p.append(f"{a['ato']}: {k} fora de faixa")
    for i in g["consultas"].get("itens", []):
        if i["situacao"] not in ar.SITUACOES:
            p.append(f"{i['id']} com situação desconhecida {i['situacao']}")
        if i["situacao"] == "aberta" and not (i["inicio"] and i["fim"] and i["inicio"] <= hoje <= i["fim"]):
            p.append(f"{i['id']} marcada como aberta fora da janela")
        if i["fim"] and i["fim"] < hoje and i["situacao"] in ("aberta", "a_abrir"):
            p.append(f"{i['id']} vencida marcada como {i['situacao']}")
        if i["situacao"] == "decidida" and not (i["resultado"] or {}).get("decidido"):
            p.append(f"{i['id']} decidida sem resultado deliberado")
        if i.get("fim_calculado") and i.get("janela_origem") != "inicio_e_duracao":
            p.append(f"{i['id']} com fim calculado sem origem em início e duração")
    for i in g.get("procedimentos", {}).get("itens", []):
        if i["conferencia"] == "pagina_possivelmente_desatualizada" and (i["ato_vigente"] or not i["atos_posteriores"]):
            p.append(f"{i['conjunto']} {i['modulo']}: página desatualizada com ato vigente afirmado ou sem ato posterior")
    for x in g.get("bandeiras", {}).get("vigencias", []):
        if x["vigencia_fim"] and x["vigencia_fim"] < x["vigencia_inicio"]:
            p.append(f"bandeira {x['patamar']} {x['vigencia_inicio']}: fim antes do início")
    ids = [e["id"] for e in g["linha_do_tempo"]["eventos"]]
    if len(ids) != len(set(ids)):
        p.append("ids repetidos na linha do tempo")
    if any(e["impacto_estimado"] is not None for e in g["linha_do_tempo"]["eventos"]):
        p.append("impacto_estimado preenchido")
    return p
