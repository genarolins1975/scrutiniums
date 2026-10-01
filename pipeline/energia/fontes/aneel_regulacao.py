"""Leitores das fontes do módulo Regulação (painéis P044 a P046).

Tudo aqui é determinístico e sem rede: recebe bytes ou linhas já guardadas no bronze e
devolve estruturas simples, para que os testes rodem sobre recortes reais pequenos.

* Texto de documento: PDF (pdftotext do poppler, com e sem preservação de leiaute) e
  HTML (portal de Legislação Federal do Senado, páginas gov.br da ANEEL). A conferência
  de um trecho citado compara textos normalizados (espaços, quebras de linha e espaço
  antes de pontuação), porque a extração muda a quebra de linha conforme a ferramenta e o
  HTML insere espaço entre etiquetas; o texto em si não muda.
* Pautas e atas das reuniões públicas da Diretoria (dados abertos da ANEEL): abertura,
  fases, prorrogação e resultado de consultas e audiências públicas, e as deliberações que
  fixaram os limites do PLD. O período de contribuições é lido do texto da decisão por
  expressões regulares documentadas; decisão que só informa a duração ("prazo de 45
  dias") fica sem data, e isso é declarado, nunca estimado.
* Agenda Regulatória 2026-2027 (Anexo I da Portaria ANEEL nº 7.030/2025, PDF): código,
  atividade e ano previsto de edição da norma.
* Páginas de procedimentos regulatórios (PRODIST e PRORET no gov.br): versão vigente de
  cada módulo e o ato que a aprovou, lidos do nome do arquivo que a própria página publica.
* Bandeiras tarifárias, recurso "Adicional" (dados abertos da ANEEL).
* IPCA número-índice (IBGE, SIDRA 1737), para conferir a regra de atualização dos tetos.
"""
import csv
import html as html_mod
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import date, timedelta

MESES = {"janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
         "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
_MES = r"(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)"


# ------------------------------------------------------------------ texto de documento

def normaliza(s):
    """Espaços em branco viram um espaço; sem espaço antes de , . ; : ) ] ” ’ nem depois de
    ( [ “ ‘. Serve só para comparar trechos com o documento: não altera o texto citado."""
    s = re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()
    s = re.sub(r"\s+([,.;:)\]”’])", r"\1", s)
    s = re.sub(r"([(\[“‘])\s+", r"\1", s)
    return s


def pedacos(trecho):
    """Passagens literais de um trecho composto (separadas por '[…]')."""
    return [p.strip() for p in normaliza(trecho).split("[…]") if p.strip()]


def confere_trecho(trecho, textos):
    """(ok, ausentes): cada passagem do trecho aparece em algum dos textos (o mesmo
    documento extraído de mais de um jeito). Trecho vazio não confere."""
    docs = [normaliza(t) for t in textos if t]
    ps = pedacos(trecho)
    if not ps or not docs:
        return False, ps or ["trecho vazio"]
    faltam = [p for p in ps if not any(p in d for d in docs)]
    return not faltam, faltam


def pdftotext_disponivel():
    return shutil.which("pdftotext") is not None


def texto_pdf(dados, layout=False):
    """Texto de um PDF (bytes) pelo pdftotext; páginas separadas por \\f. None quando a
    ferramenta não está instalada ou falha (o chamador registra a conferência como não
    executada, sem supor resultado)."""
    if not pdftotext_disponivel() or not dados:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(dados)
        args = ["pdftotext"] + (["-layout"] if layout else []) + [tmp, "-"]
        out = subprocess.run(args, capture_output=True, timeout=120)
        if out.returncode != 0:
            return None
        return out.stdout.decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError):
        return None
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def pagina_do_trecho(texto_paginado, trecho):
    """Número (1..n) da primeira página que contém a primeira passagem do trecho; None se
    nenhuma contém. Usa o separador de página (\\f) do pdftotext."""
    if not texto_paginado:
        return None
    ps = pedacos(trecho)
    if not ps:
        return None
    for i, pag in enumerate(texto_paginado.split("\f"), start=1):
        if ps[0] in normaliza(pag):
            return i
    return None


def texto_html(dados):
    """Texto visível de uma página HTML: sem script e style, etiquetas viram espaço e as
    entidades são decodificadas."""
    t = dados.decode("utf-8", "replace") if isinstance(dados, bytes) else dados
    t = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", t)
    t = re.sub(r"(?s)<!--.*?-->", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    return normaliza(html_mod.unescape(t))


def conteudo_govbr(dados):
    """Trecho de uma página gov.br entre o início do conteúdo e o rodapé de navegação."""
    t = dados.decode("utf-8", "replace") if isinstance(dados, bytes) else dados
    t = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", t)
    ini = t.find('id="content"')
    if ini < 0:
        return t
    fim = t.find("Acesso à Informação", ini)
    return t[ini:fim if fim > ini else len(t)]


def linha_dou(texto):
    """'D.O. de 22.12.2023, seção 1, p. 110, ...' → ('2023-12-22', linha) ou (None, None).
    É a linha que a ANEEL imprime nos atos: 'Este texto não substitui o publicado no D.O. de ...'."""
    m = re.search(r"publicado no D\.\s?O\.\s*de\s*(\d{1,2})\.(\d{1,2})\.(\d{4})([^\n]*)", texto or "")
    if not m:
        return None, None
    d, mth, a = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(a, mth, d).isoformat(), normaliza(m.group(0))
    except ValueError:
        return None, None


# ------------------------------------------------------------------ pautas e atas

TIPOS_ABERTURA = {
    "Aviso de Abertura de Consulta Pública": "Consulta Pública",
    "Aviso de consulta Pública": "Consulta Pública",
    "Aviso de Abertura de Audiência Pública": "Audiência Pública",
    "Aviso de Audiência Pública": "Audiência Pública",
    "Aviso de Abertura de Audiência Pública Interna": "Audiência Pública",
}
TIPOS_FASE = {
    "Segunda Fase da Consulta Pública": ("Consulta Pública", "2ª fase"),
    "Terceira Fase da Consulta Pública": ("Consulta Pública", "3ª fase"),
    "Segunda Fase da Audiência Pública": ("Audiência Pública", "2ª fase"),
    "Aviso de Reabertura de Consulta Pública": ("Consulta Pública", "reabertura"),
    "Aviso de Reabertura de Audiência Pública": ("Audiência Pública", "reabertura"),
    "Aviso de Prorrogação de Consulta Pública": ("Consulta Pública", "prorrogação"),
}
DELIBERADO = ("Deliberado", "Parcialmente Deliberado")
_REF_PART = re.compile(r"(Consulta|Audiência)\s+Pública\s+(?:n[º°o.]*\s*)?([\d.]+)\s*/\s*(\d{4})", re.I)
# "Resultado da Consulta Pública nº 21/2025", "Resultado da Segunda Fase da Consulta Pública nº 37/2020",
# "Resultados da Primeira e da Segunda Fase da Consulta Pública nº 33/2019", "Resultado da abertura da
# Consulta Pública nº 35/2019". Entre "Resultado" e a modalidade só entram palavras de fase (lista fechada):
# "Resultado parcial" e "Resultado da Revisão Tarifária ..." não são resultado da consulta citada depois.
_PALAVRA_FASE = r"(?:d[ao]s?|e|primeira|segunda|terceira|[123]ª|fases?|abertura|reabertura)"
# "Resultado definitivo da Audiência Pública nº 16/2019" e "Resultado final" também decidem.
_RESULTADO = re.compile(r"Resultados?\s+(?:definitivos?\s+|finais\s+|final\s+)?d[ao]s?\s+(?:" + _PALAVRA_FASE
                        + r"\s+){0,7}?(Consulta|Audiência)\s+Pública\s+"
                        r"(?:n[º°o.]*\s*)?([\d.]+)\s*/\s*(\d{4})", re.I)


def _int(v):
    try:
        return int(str(v).replace(".", "").strip())
    except (TypeError, ValueError):
        return None


def processos(v):
    """'48500008579202691 - 48500002865202562' → ['48500008579202691', '48500002865202562']."""
    return [re.sub(r"\D", "", p) for p in str(v or "").split(" - ") if re.sub(r"\D", "", p)]


def processo_formatado(digitos):
    """17 dígitos → 48500.005474/2021-76 (formato do SEI da ANEEL)."""
    d = re.sub(r"\D", "", digitos or "")
    if len(d) != 17:
        return digitos
    return f"{d[:5]}.{d[5:11]}/{d[11:15]}-{d[15:]}"


def limpa_decisao(txt, limite=700):
    """Primeira frase da decisão (até o primeiro bloco de espaços duplos que a ANEEL usa
    entre frases), sem os registros de apresentação técnica e de sustentação oral, que
    nomeiam servidores e representantes e não fazem parte da decisão."""
    t = (txt or "").replace("\xa0", " ")
    t = re.split(r"\s{2,}(?=Houve |O processo acima|A Diretora? |O Diretor|Os Diretores)", t)[0]
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= limite else t[:limite].rsplit(" ", 1)[0] + " […]"


def _limpa_datas(t):
    t = (t or "").replace("\xa0", " ")
    t = re.sub(r"\((?:segunda|terça|quarta|quinta|sexta)-feira\)|\((?:sábado|domingo)\)", " ", t, flags=re.I)
    t = re.sub(r"(\d{1,2})\s*[º°]", r"\1", t)
    t = re.sub(r"\bde\s+de\b", "de", t)
    return re.sub(r"\s+", " ", t)


# Abertura de uma faixa de datas. As atas usam várias redações para o mesmo período; todas
# vieram de decisões reais (exemplos nos testes):
#   "no período de 3 de setembro a 2 de outubro de 2026", "entre 4 e 13 de fevereiro de 2022",
#   "entre os dias 30 de julho e 14 de setembro de 2026", "de 30/09/2026 a 14/11/2026",
#   "com início em 12 de maio até 27 de junho de 2022",
#   "iniciando em 30 de março e finalizando em 13 de abril de 2022",
#   "com início em 14 de setembro e término em 28 de outubro de 2017",
#   "no período de 13 de dezembro a e 11 de fevereiro de 2024" (erro de digitação da fonte).
_ABRE_FAIXA = (r"(?:\bde|\bentre(?:\s+os\s+dias)?|\bdo\s+dia|\bcom\s+início\s+em|\biniciando\s+em|\binício\s+em"
               r"|\ba\s+partir\s+de)")
_LIGA_FAIXA = (r"(?:a\s+e|a|até|e\s+término\s+em|e\s+terminando\s+em|e\s+finalizando\s+em|e\s+encerramento\s+em"
               r"|e\s+fim\s+em|e)")
_FAIXA = re.compile(
    _ABRE_FAIXA + r"\s+(\d{1,2})(?:\s+(?:de\s+)?" + _MES + r")?(?:\s+de\s+(\d{4}))?\s*,?\s+" + _LIGA_FAIXA + r"\s+"
    r"(?:o\s+dia\s+)?(\d{1,2})\s+(?:de\s+)?" + _MES + r"(?:\s+de\s+(\d{4}))?", re.I)
_FAIXA_NUM = re.compile(
    _ABRE_FAIXA + r"\s+(\d{1,2})/(\d{1,2})/(\d{4})\s*,?\s+" + _LIGA_FAIXA + r"\s+(?:o\s+dia\s+)?(\d{1,2})/(\d{1,2})/(\d{4})",
    re.I)
_DURACAO = re.compile(r"(?:prazo|duração|período(?:\s+de\s+contribuições)?|\bpor)\s+(?:de\s+)?(\d{1,3})\s*(?:\([^)]*\)\s*)?dias",
                      re.I)
# Início sem fim: "a partir de 8 de junho de 2026", "a contar do dia 18 de agosto de 2021",
# "iniciando em 7 de abril de 2022", "(início em 26 de outubro de 2017"
_INICIO = re.compile(r"(?:\ba\s+partir\s+d[eo]|\ba\s+contar\s+d[eo]|\biniciando\s+em|\bcom\s+início\s+em|\binício\s+em)\s+"
                     r"(?:o\s+)?(?:dia\s+)?(\d{1,2})\s+(?:de\s+)?" + _MES + r"(?:\s+de\s+(\d{4}))?", re.I)
_SESSAO = re.compile(r"(?:realizar-se|realizada|a ser realizada)?\s*(?:no dia|em)\s+(\d{1,2})\s+de\s+" + _MES + r"\s+de\s+(\d{4})", re.I)


def _janela_plausivel(ini, fim, dr):
    """Janela de contribuições plausível para uma decisão tomada em `dr`: início ≤ fim, termina
    no máximo 7 dias antes da reunião, começa no máximo 60 dias antes dela (uma prorrogação
    repete a data de início já transcorrida) e dura até 400 dias. Descarta períodos de
    referência citados no texto, como "de 1º de janeiro a 31 de dezembro de 2024"."""
    return (ini <= fim and fim >= dr - timedelta(days=7) and ini >= dr - timedelta(days=60)
            and (fim - ini).days <= 400)


def periodos_da_decisao(texto, data_reuniao):
    """Janelas de contribuição escritas com as duas datas numa decisão: lista de dicts
    {inicio, fim, trecho, origem='datas_explicitas'}.

    Regras (testadas em pipeline/tests/test_energia_regulacao.py):
    * por extenso: abertura ("de", "entre [os dias]", "do dia", "com início em", "iniciando em",
      "a partir de") + D [de MÊS] [de AAAA] + ligação ("a", "até", "e", "e término em",
      "e finalizando em") + D de MÊS [de AAAA];
    * numérica: a mesma abertura e ligação com dd/mm/aaaa nas duas pontas;
    * mês ou ano omitidos no início herdam os do fim; ano omitido no fim é o da reunião,
      ou o seguinte quando o mês do fim é anterior ao mês da reunião;
    * a janela só é aceita se for plausível (`_janela_plausivel`).
    """
    t = _limpa_datas(texto)
    dr = date.fromisoformat(data_reuniao)
    out = []
    for m in _FAIXA.finditer(t):
        d1, m1, a1, d2, m2, a2 = m.groups()
        mes2 = MESES[m2.lower()]
        mes1 = MESES[m1.lower()] if m1 else mes2
        ano2 = int(a2) if a2 else (dr.year + 1 if mes2 < dr.month - 1 else dr.year)
        ano1 = int(a1) if a1 else (ano2 if mes1 <= mes2 else ano2 - 1)
        try:
            ini, fim = date(ano1, mes1, int(d1)), date(ano2, mes2, int(d2))
        except ValueError:
            continue
        if _janela_plausivel(ini, fim, dr):
            out.append({"inicio": ini.isoformat(), "fim": fim.isoformat(), "trecho": m.group(0).strip(),
                        "origem": "datas_explicitas", "pos": m.start()})
    for m in _FAIXA_NUM.finditer(t):
        d1, m1, a1, d2, m2, a2 = (int(x) for x in m.groups())
        try:
            ini, fim = date(a1, m1, d1), date(a2, m2, d2)
        except ValueError:
            continue
        if _janela_plausivel(ini, fim, dr):
            out.append({"inicio": ini.isoformat(), "fim": fim.isoformat(), "trecho": m.group(0).strip(),
                        "origem": "datas_explicitas", "pos": m.start()})
    out.sort(key=lambda j: j["pos"])
    return [{k: v for k, v in j.items() if k != "pos"} for j in out]


def fim_pela_duracao(inicio, dias):
    """Último dia de um prazo de `dias` dias que começa em `inicio` (AAAA-MM-DD), contando o
    dia do início (convenção das atas: "15 dias, com início em 1 de novembro e término em 15 de
    novembro"; a adesão das atas que trazem as duas datas e a duração é medida na gold)."""
    return (date.fromisoformat(inicio) + timedelta(days=dias - 1)).isoformat()


def inicio_e_duracao(texto, data_reuniao):
    """Janelas derivadas quando a decisão dá o início e a duração, sem a data final ("pelo
    prazo de 93 dias, a partir de 8 de junho de 2026"): lista de dicts {inicio, fim, duracao_dias,
    trecho, origem='inicio_e_duracao'}. O fim é CALCULADO por `fim_pela_duracao` e assim
    rotulado; nunca substitui uma data escrita. A duração tem de estar na mesma oração do
    início (até 150 caracteres antes ou 80 depois, sem ponto final no meio). Início citado
    dentro de uma faixa com as duas datas é ignorado (a faixa já vale)."""
    t = _limpa_datas(texto)
    dr = date.fromisoformat(data_reuniao)
    faixas = [(m.start(), m.end()) for r in (_FAIXA, _FAIXA_NUM) for m in r.finditer(t)]
    duracoes = [(m.start(), m.end(), int(m.group(1))) for m in _DURACAO.finditer(t)]
    out = []
    for m in _INICIO.finditer(t):
        if any(a <= m.start() < b for a, b in faixas):
            continue
        d, mes, ano = int(m.group(1)), MESES[m.group(2).lower()], m.group(3)
        ano = int(ano) if ano else (dr.year + 1 if mes < dr.month - 1 else dr.year)
        try:
            ini = date(ano, mes, d)
        except ValueError:
            continue
        perto = [(abs(m.start() - b) if b <= m.start() else abs(a - m.end()), a, b, n) for a, b, n in duracoes
                 if (m.start() - 150 <= b <= m.start() or m.end() <= a <= m.end() + 80)
                 and "." not in t[min(b, m.end()):max(a, m.start())]]
        if not perto:
            continue
        _, a, b, n = min(perto)
        if not 1 <= n <= 400:
            continue
        fim = date.fromisoformat(fim_pela_duracao(ini.isoformat(), n))
        if _janela_plausivel(ini, fim, dr):
            trecho = t[min(a, m.start()):max(b, m.end())].strip()
            out.append({"inicio": ini.isoformat(), "fim": fim.isoformat(), "duracao_dias": n, "trecho": trecho,
                        "origem": "inicio_e_duracao"})
    return out


def duracao_da_decisao(texto):
    """Duração em dias quando a decisão informa o prazo ("prazo de 45 dias"); None se não informa."""
    m = _DURACAO.search(_limpa_datas(texto))
    return int(m.group(1)) if m else None


def janelas_da_decisao(texto, data_reuniao):
    """(janelas, origem): as janelas com as duas datas escritas, quando houver; senão as
    derivadas de início e duração; senão ([], None)."""
    j = periodos_da_decisao(texto, data_reuniao)
    if j:
        return j, "datas_explicitas"
    j = inicio_e_duracao(texto, data_reuniao)
    return (j, "inicio_e_duracao") if j else ([], None)


def sessao_da_decisao(texto, data_reuniao):
    """Data de sessão de audiência pública ("a realizar-se em 06 de novembro de 2025"), se houver."""
    dr = date.fromisoformat(data_reuniao)
    for m in _SESSAO.finditer(_limpa_datas(texto)):
        try:
            d = date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1)))
        except ValueError:
            continue
        if dr - timedelta(days=7) <= d <= dr + timedelta(days=400):
            return d.isoformat()
    return None


def linha_ata(row):
    """Linha do CSV de pautas e atas com os campos que o módulo usa, aparados."""
    g = lambda k: (row.get(k) or "").strip()  # noqa: E731
    return {"data": g("DatReuniao")[:10], "reuniao": g("IdeReuniao"), "ordem": g("NumOrdem"),
            "processo": g("NumProcesso"), "relator": g("NomDiretorRelator"), "classificacao": g("NomClassificacaoAssunto"),
            "assunto": g("TxtAssunto"), "decisao": g("TxtDecisaoJulgamento"), "num_ato": g("NumAtoAdministrativo"),
            "tipo_ato": g("NomTipoAtoAdministrativo"), "resultado": g("DscResultadoJulgamento"),
            "gerado_em": g("DatGeracaoConjuntoDados")[:10]}


def ata_relevante(a):
    """Linha que interessa ao módulo: participação social (abertura, fase, prorrogação,
    resultado), limites do PLD, agenda regulatória e os atos normativos que a linha do
    tempo cita."""
    tipo = a["tipo_ato"]
    if tipo in TIPOS_ABERTURA or tipo in TIPOS_FASE:
        return True
    txt = a["assunto"] + " " + a["decisao"]
    # a citação pode estar só na decisão ("aprovar a minuta do Edital ..., consolidada com os
    # aprimoramentos decorrentes da Consulta Pública nº 30/2023"): também é resultado da consulta
    if _RESULTADO.search(a["assunto"]) or _REF_PART.search(a["assunto"]) or _REF_PART.search(a["decisao"]):
        return True
    if "Preço de Liquidação de Diferenças" in txt or "Preço de Liquidação das Diferenças" in txt or "PLD" in txt:
        return True
    if "Agenda Regulatória" in a["assunto"]:
        return True
    # proposta de abertura sem número (a pauta da última reunião, antes de a ata registrar o
    # resultado e o número do aviso): entra para declarar a decisão ainda sem resultado formal
    if PROPOSTA_ABERTURA.search(a["assunto"]):
        return True
    # aprovação de versões do PRODIST e do PRORET (conferência da versão vigente das páginas oficiais)
    if re.search(r"PRODIST|Procedimentos de Distribuição|PRORET|Procedimentos de Regulação Tarifária", txt):
        return True
    return tipo in ("Resolução Normativa", "Resolução Homologatória", "Portaria") and a["resultado"] in DELIBERADO


PROPOSTA_ABERTURA = re.compile(r"(?:abertura|instauração)\s+d[ae]\s+(?:(?:segunda|terceira)\s+fase\s+d[ae]\s+)?(?:Consulta|Audiência)\s+Pública",
                               re.I)
_DECIDIU = re.compile(r"\bdecidiu\b", re.I)


def decisoes_sem_resultado_formal(atas, hoje):
    """Propostas de abertura cuja decisão está escrita na pauta ("A Diretoria, por unanimidade,
    decidiu: (i) realização de Consulta Pública, ..., de 30/09/2026 a 14/11/2026") mas sem
    resultado formal registrado (DscResultadoJulgamento vazio) nem número de aviso: não entram na
    contagem de consultas; ficam listadas com a situação que teriam em `hoje` se a ata confirmar a
    deliberação. [{data, reuniao, processos, assunto, decisao, inicio, fim, janela_origem,
    situacao_se_confirmada}]."""
    out = []
    for a in atas:
        if a["resultado"] or not PROPOSTA_ABERTURA.search(a["assunto"]) or not _DECIDIU.search(a["decisao"]):
            continue
        js, origem = janelas_da_decisao(a["decisao"], a["data"])
        ini = min((j["inicio"] for j in js), default=None)
        fim = max((j["fim"] for j in js), default=None)
        sit = None if not js else ("a_abrir" if hoje < ini else "aberta" if hoje <= fim else "encerrada_aguardando")
        out.append({"data": a["data"], "reuniao": a["reuniao"], "processos": [processo_formatado(p) for p in processos(a["processo"])],
                    "assunto": a["assunto"], "decisao": limpa_decisao(a["decisao"]), "inicio": ini, "fim": fim,
                    "janela_origem": origem, "situacao_se_confirmada": sit})
    return sorted(out, key=lambda x: (x["data"], x["inicio"] or ""))


def chave_ata(a):
    return f"{a['data']}|{a['reuniao']}|{a['ordem']}|{a['num_ato']}|{'-'.join(processos(a['processo']))}"


def _decidiu(a):
    return a["resultado"] in DELIBERADO


_RESULTADO_ALT = re.compile(
    r"(?:(?:Fechamento|Encerramento)\b[^.]{0,60}?|após\s+(?:a\s+)?(?:realização|análise\s+das\s+contribuições\s+recebidas)\s+)"
    r"(?:d|n)[ao]s?\s+(?:[\wçãéíóú]+\s+){0,3}?(Consulta|Audiência)\s+Pública\s+(?:n[º°o.]*\s*)?([\d.]+)\s*/\s*(\d{4})", re.I)
# A oração do resultado termina onde começa a descrição do objeto ("instituída com vistas a ...").
_FIM_CLAUSULA = re.compile(r",?\s+(?:instituíd|instaurad|com\s+vistas?|que\s+trat|referente|visando|para\s)", re.I)


def _sig(modalidade):
    return "CP" if modalidade.lower().startswith("consulta") else "AP"


def _refs(texto):
    """[(sig, número, ano)] das citações 'Consulta|Audiência Pública nº N/AAAA' num texto."""
    return [(_sig(r[0]), _int(r[1]), int(r[2])) for r in _REF_PART.findall(texto or "")]


# Decisão que consolida o documento submetido à consulta, sem a palavra "Resultado" (editais de
# leilão, revisões tarifárias e extinção do processo). Redações reais das atas:
#   "consolidado após avaliação das contribuições apresentadas na Consulta Pública nº 6/2026",
#   "consolidado após análise das contribuições apresentadas na Consulta Pública nº 28/2025",
#   "consolidados após a avaliação das contribuições trazidas na Audiência Pública nº 16/2018",
#   "consolidado após as contribuições recebidas na Consulta Pública nº 71/2020",
#   "após consolidação das contribuições recebidas por meio da Consulta Pública nº 4/2020 e da Audiência Pública nº 1/2020",
#   "consolidada com os aprimoramentos decorrentes da Consulta Pública nº 6/2026",
#   "consolidado com os aprimoramentos decorrentes da 1ª e 2ª fases da Consulta Pública nº 46/2019",
#   "declarar extinto o processo de instrução da Consulta Pública nº 20/2022".
# Sempre com "após" ou "consolidad": "até a análise definitiva das contribuições recebidas na
# Consulta Pública nº 33/2025" (medida cautelar) e "minuta prevista na abertura da Audiência
# Pública nº 29/2019" (impugnação) não decidem a consulta.
_CONSOLIDACAO = re.compile(
    r"\bconsolidad[oa]s?\s+(?:após\s+(?:a\s+)?(?:(?:avaliação|análise)\s+(?:d[ao]s\s+)?)?(?:as\s+)?contribuições"
    r"|com\s+os\s+aprimoramentos\s+decorrentes)"
    r"|\bapós\s+(?:a\s+)?(?:avaliação|análise|consolidação)\s+das\s+contribuições"
    r"|\bdeclar(?:ar|ou|ad[oa])\s+extint[oa]", re.I)
# Entre a fórmula e a primeira consulta citada só entram palavras de ligação (lista fechada):
# assim a citação pertence à fórmula, e não a uma norma ou consulta mencionada adiante.
_LIGACAO_CONSOLIDACAO = re.compile(
    r"(?:[\s,]+(?:apresentadas|recebidas|trazidas|colhidas|por|meio|n[ao]s?|d[ao]s?|e|primeira|segunda|terceira"
    r"|[123]ª|fases?|o|processo|de|instrução|âmbito))*[\s,]+(?=(?:Consulta|Audiência)\s+Pública)", re.I)


def alvos_da_consolidacao(texto):
    """Consultas que uma decisão sem a palavra "Resultado" consolida ou encerra ("Aprovação do
    Edital ..., consolidado após avaliação das contribuições apresentadas na Consulta Pública
    nº 6/2026"; "decidiu declarar extinto o processo de instrução da Consulta Pública nº
    20/2022"): [(sig, número, ano)]. A primeira citação tem de vir logo depois da fórmula
    (`_LIGACAO_CONSOLIDACAO`); entram as citadas na mesma oração ("da Consulta Pública nº 4/2020
    e da Audiência Pública nº 1/2020"), até a descrição do objeto ou o fim da frase."""
    t = re.sub(r"\s+", " ", (texto or "").replace("\xa0", " "))
    out = []
    for m in _CONSOLIDACAO.finditer(t):
        lig = _LIGACAO_CONSOLIDACAO.match(t, m.end())
        if not lig:
            continue
        resto = t[lig.end():]
        fim = re.search(r"[.;]\s|[-–]\s*\(|\(i+\)|" + _FIM_CLAUSULA.pattern, resto, re.I)
        out += _refs(resto[:fim.start() if fim else len(resto)][:400])
    return list(dict.fromkeys(out))


def alvos_do_resultado(assunto):
    """Consultas cujo resultado a linha de pauta delibera: [(sig, número, ano)].

    O assunto começa pelo resultado ("Resultado da Audiência Pública nº 33/2019 e da Consulta
    Pública nº 34/2019 (Segunda Fase da Audiência Pública nº 33/2019), instituídas com vistas
    a ...") ou registra o encerramento ("Encerramento, por perda de objeto, da Consulta
    Pública nº 41/2021", "Fechamento da segunda fase da Audiência Pública nº 032/2018", "...
    após a análise das contribuições recebidas na Consulta Pública nº 38/2024"). Entram
    todas as consultas citadas na oração do resultado, até a descrição do objeto; citações
    posteriores (normas e consultas mencionadas no objeto) ficam de fora."""
    m = _RESULTADO.search(assunto or "") or _RESULTADO_ALT.search(assunto or "")
    if not m:
        return []
    fim = _FIM_CLAUSULA.search(assunto, m.end())
    clausula = assunto[m.start():fim.start() if fim else len(assunto)]
    return list(dict.fromkeys(_refs(clausula)))


def _fase(nome, a, janelas, origem, sessao=None):
    """Registro de uma fase (abertura, 2ª fase, prorrogação...) com a janela lida da decisão."""
    return {"fase": nome, "data_deliberacao": a["data"], "reuniao": a["reuniao"],
            "inicio": min((j["inicio"] for j in janelas), default=None),
            "fim": max((j["fim"] for j in janelas), default=None), "janelas": len(janelas),
            "janela_origem": origem, "fim_calculado": origem == "inicio_e_duracao",
            "trecho_periodo": " […] ".join(j["trecho"] for j in janelas) or None,
            "duracao_dias": duracao_da_decisao(a["decisao"]), "sessao": sessao, "chave": chave_ata(a)}


def consultas_das_atas(atas, totais=None):
    """Consultas e audiências públicas reconstituídas das atas: {id: consulta}.

    Identidade: (modalidade, número, ano). O número é o NumAtoAdministrativo da linha de
    abertura, que costuma ser o número do aviso (conferido nas linhas que citam 'Consulta
    Pública nº N/AAAA'); o ano é o da reunião que deliberou a abertura.

    Número suspeito (`numero_suspeito`): acima do total anual da modalidade publicado pela
    ANEEL (`totais` = {('CP', 2020): 78, ...}, só anos completos), ou nunca citado por outra
    linha do mesmo processo enquanto o processo cita outro número da mesma modalidade e ano. Quando o processo cita um
    único outro número que não é o de outra consulta já reconstituída, ele é adotado como
    `numero_citado_no_processo` e serve de vínculo, só para linhas do mesmo processo.

    Fases, reaberturas e prorrogações entram pela citação explícita 'nº N/AAAA'; na falta
    dela, pelo NumAtoAdministrativo da linha com o mesmo processo. Resultado entra pela
    citação explícita de todas as consultas da oração do resultado (`alvos_do_resultado`),
    preferindo a consulta do mesmo processo; sem número citado, pelo processo."""
    cons, por_processo = {}, {}
    totais = totais or {}
    ordenadas = sorted(atas, key=lambda a: (a["data"], _int(a["ordem"]) or 0))
    for a in ordenadas:
        mod = TIPOS_ABERTURA.get(a["tipo_ato"])
        n = _int(a["num_ato"])
        if not mod or not n or not _decidiu(a):
            continue
        ano = int(a["data"][:4])
        cid = f"{_sig(mod)}-{n}-{ano}"
        procs = processos(a["processo"])
        if cid in cons and not set(procs) & set(cons[cid]["processos"]):
            # mesmo número e ano em processos diferentes: a fonte repete o número; as duas
            # aberturas ficam separadas e marcadas, sem escolher qual está certa
            cons[cid]["numero_em_conflito"] = True
            k = 2
            while f"{cid}-{k}" in cons:
                k += 1
            cid = f"{cid}-{k}"
        janelas, origem = janelas_da_decisao(a["decisao"], a["data"])
        c = cons.setdefault(cid, {
            "id": cid, "modalidade": mod, "numero": n, "numero_na_ata": n, "ano": ano, "tema": a["assunto"],
            "processos": procs, "relator": a["relator"] or None,
            "abertura": {"data": a["data"], "reuniao": a["reuniao"], "decisao": limpa_decisao(a["decisao"]),
                         "tipo_ato": a["tipo_ato"], "chave": chave_ata(a)},
            "texto_integral": a["assunto"] + " " + a["decisao"],
            "fases": [], "resultado": None, "citacoes_numero": 0,
            "numero_suspeito": False, "motivo_numero_suspeito": None, "numero_citado_no_processo": None,
            "numero_em_conflito": cid != f"{_sig(mod)}-{n}-{ano}"})
        c["fases"].append(_fase("abertura", a, janelas, origem,
                                sessao_da_decisao(a["decisao"], a["data"]) if mod.startswith("Audiência") else None))
        for p in c["processos"]:
            por_processo.setdefault(p, set()).add(cid)

    # 1) citações: conferem o número da abertura só quando vêm do mesmo processo (ou de linha
    # sem processo); citação vinda de outro processo é de outra consulta com o mesmo número.
    # O que cada processo cita fica guardado para a conferência de plausibilidade.
    citados_no_processo = {}
    for a in ordenadas:
        refs = _refs(a["assunto"] + " " + a["decisao"])
        procs = processos(a["processo"])
        for sig, n, ano in refs:
            cid = f"{sig}-{n}-{ano}"
            if (cid in cons and chave_ata(a) != cons[cid]["abertura"]["chave"]
                    and (not procs or set(procs) & set(cons[cid]["processos"]))):
                cons[cid]["citacoes_numero"] += 1
        for p in procs:
            citados_no_processo.setdefault(p, set()).update(refs)

    # 2) plausibilidade do número e número alternativo citado pelo próprio processo
    apelidos = {}
    for cid, c in cons.items():
        sig = _sig(c["modalidade"])
        total = totais.get((sig, c["ano"]))
        alternativos = sorted({n for p in c["processos"] for s, n, ano in citados_no_processo.get(p, ())
                               if s == sig and ano == c["ano"] and n and n != c["numero_na_ata"]
                               and not ({x for x in por_processo.get(p, ())} & {f"{sig}-{n}-{ano}"})})
        motivos = []
        if total is not None and c["numero_na_ata"] > total:
            motivos.append(f"número {c['numero_na_ata']} acima do total anual publicado pela ANEEL ({int(total)} em {c['ano']})")
        if c["citacoes_numero"] == 0 and alternativos:
            motivos.append(f"nenhuma outra linha do mesmo processo cita nº {c['numero_na_ata']}/{c['ano']}; o processo cita "
                           + ", ".join(f"nº {n}/{c['ano']}" for n in alternativos))
        if not motivos:
            continue
        c["numero_suspeito"], c["motivo_numero_suspeito"] = True, "; ".join(motivos)
        if len(alternativos) == 1 and f"{sig}-{alternativos[0]}-{c['ano']}" not in cons:
            c["numero_citado_no_processo"] = alternativos[0]
            c["numero"] = alternativos[0]
            apelidos[(sig, alternativos[0], c["ano"])] = cid

    def com_numero(sig, n, ano):
        """Consultas com o número citado: a da abertura, as repetidas em outros processos
        (sufixo -2, -3...) e a que adotou o número citado pelo próprio processo."""
        base_id = f"{sig}-{n}-{ano}"
        out = [base_id] if base_id in cons else []
        k = 2
        while f"{base_id}-{k}" in cons:
            out.append(f"{base_id}-{k}")
            k += 1
        apelido = apelidos.get((sig, n, ano))
        return out + ([apelido] if apelido and apelido not in out else [])

    def resolve(sig, n, ano, procs, data):
        """(id, vínculo) da consulta citada por (sig, n, ano) numa linha com os processos `procs`
        deliberada em `data`:
        1. a do mesmo processo com aquele número (o da abertura ou o citado no processo);
        2. senão, quando o processo da linha tem uma única consulta aberta antes, ela, pelo
           processo (revisões tarifárias registram o aviso como audiência e o citam como
           consulta, com outro número);
        3. senão, se o processo da linha não tem consulta reconstituída, a do número citado;
        4. senão nenhuma (número de outro processo e processo com mais de uma consulta)."""
        cid = f"{sig}-{n}-{ano}"
        for x in com_numero(sig, n, ano):
            if set(procs) & set(cons[x]["processos"]):
                return x, "numero_citado"
        mesmos = {y for p in procs for y in por_processo.get(p, ()) if cons[y]["abertura"]["data"] <= data}
        if len(mesmos) == 1:
            return mesmos.pop(), "processo"
        if not mesmos and cid in cons:
            return cid, "numero_citado"
        return None, None

    def registra_resultado(cid, a, vinculo, forma):
        """forma: 'resultado' (assunto "Resultado da Consulta Pública nº N"), 'encerramento'
        (encerramento ou fechamento), 'apos_contribuicoes' ("após a realização da Consulta
        Pública nº N", "após a análise das contribuições recebidas"), 'consolidacao' (decisão que consolida
        o documento submetido à consulta, sem a palavra "Resultado": edital de leilão, revisão
        tarifária, extinção do processo), 'resultado_sem_numero' (resultado de revisão tarifária
        ligado pelo processo) ou 'objeto_aprovado_no_processo' (decisão do mesmo processo que
        aprova o módulo de procedimento que a consulta tratava, sem citar o número)."""
        n_ato = _int(a["num_ato"])
        ato = f"{a['tipo_ato']} nº {numero_ato(n_ato)}/{a['data'][:4]}" if a["tipo_ato"] and n_ato else None
        res = {"data": a["data"], "reuniao": a["reuniao"], "resultado_julgamento": a["resultado"],
               "decidido": _decidiu(a), "ato": ato, "tipo_ato": a["tipo_ato"] or None, "numero_ato": n_ato,
               "decisao": limpa_decisao(a["decisao"]), "assunto": a["assunto"], "chave": chave_ata(a),
               "vinculo": vinculo, "forma": forma}
        atual = cons[cid]["resultado"]
        # a última deliberação decide; 'retirado de pauta' não apaga uma decisão já tomada, e
        # um vínculo só pelo processo não substitui um resultado que cita o número da consulta
        if atual is not None and vinculo != "numero_citado" and atual["vinculo"] == "numero_citado":
            return
        # a primeira decisão que consolida o documento é o resultado; linhas posteriores que
        # repetem a descrição do edital (recursos contra o leilão, ratificações) não o trocam
        if atual is not None and atual["decidido"] and forma in ("consolidacao", "objeto_aprovado_no_processo"):
            return
        if atual is None or (res["decidido"] or not atual["decidido"]):
            cons[cid]["resultado"] = res

    # 3) fases e resultados citados por número
    for a in ordenadas:
        procs = processos(a["processo"])
        tf = TIPOS_FASE.get(a["tipo_ato"])
        if tf and _decidiu(a):
            sig = _sig(tf[0])
            alvo = [resolve(s, n, ano, procs, a["data"])[0] for s, n, ano in _refs(a["assunto"] + " " + a["decisao"])
                    if s == sig]
            alvo = [x for x in alvo if x]
            if not alvo:
                n = _int(a["num_ato"])
                alvo = [cid for p in procs for cid in por_processo.get(p, ())
                        if n in (cons[cid]["numero_na_ata"], cons[cid]["numero"]) and cid.startswith(sig)]
            janelas, origem = janelas_da_decisao(a["decisao"], a["data"])
            for cid in dict.fromkeys(alvo):
                cons[cid]["fases"].append(_fase(tf[1], a, janelas, origem))
        # linha de aviso (abertura, fase, prorrogação) nunca é resultado, mesmo quando o assunto
        # repete "Resultado da Consulta Pública nº ..." (acontece na fonte)
        if a["tipo_ato"] in TIPOS_ABERTURA or tf:
            continue
        alvos = alvos_do_resultado(a["assunto"])
        for sig, n, ano in alvos:
            cid, vinculo = resolve(sig, n, ano, procs, a["data"])
            if cid:
                registra_resultado(cid, a, vinculo, forma_do_resultado(a["assunto"]))
        # decisão que consolida o documento da consulta sem a palavra "Resultado" (edital,
        # revisão tarifária, extinção): só liga consulta do MESMO processo com o número citado,
        # e todas as que tiverem aquele número no processo (aberturas repetidas na fonte)
        for sig, n, ano in alvos_da_consolidacao(a["assunto"]) + alvos_da_consolidacao(a["decisao"]):
            if (sig, n, ano) in alvos:
                continue
            for cid in com_numero(sig, n, ano):
                if set(procs) & set(cons[cid]["processos"]) and cons[cid]["abertura"]["data"] < a["data"]:
                    registra_resultado(cid, a, "numero_citado", "consolidacao")

    # 4) resultado sem número citado ("Resultado da Revisão Tarifária Periódica de 2026 da ..."):
    # liga pelo número do processo, chave exata do SEI, quando um único aviso aberto antes
    # tem o mesmo processo e ainda não tem resultado pela citação explícita.
    for a in ordenadas:
        if (not re.match(r"\s*Resultados?\b", a["assunto"]) or alvos_do_resultado(a["assunto"])
                or a["tipo_ato"] in TIPOS_ABERTURA or a["tipo_ato"] in TIPOS_FASE):
            continue
        alvo = {cid for p in processos(a["processo"]) for cid in por_processo.get(p, ())
                if cons[cid]["abertura"]["data"] < a["data"]}
        alvo = [cid for cid in alvo if cons[cid]["resultado"] is None or cons[cid]["resultado"]["vinculo"] == "processo"]
        if len(alvo) == 1:
            registra_resultado(alvo[0], a, "processo", "resultado_sem_numero")

    # 5) decisão sem número que aprova o objeto da consulta no mesmo processo (CP 3/2026: aviso
    # "aprimoramento do Submódulo 6.2 dos Procedimentos de Regulação Tarifária"; em 16/06/2026,
    # no mesmo processo, "aprovar os aprimoramentos do Submódulo 6.2 dos Procedimentos de
    # Regulação Tarifária"). Liga só quando: a linha é deliberada, posterior ao fim da janela da
    # fase atual (ou à sua deliberação, se a fase não tem data), aprova um módulo do PRODIST ou
    # do PRORET que o tema da consulta cita, e uma única consulta do processo, sem resultado
    # deliberado, cita aquele módulo. Vínculo próprio: 'processo_e_objeto'.
    for a in ordenadas:
        if not _decidiu(a) or a["tipo_ato"] in TIPOS_ABERTURA or a["tipo_ato"] in TIPOS_FASE:
            continue
        aprovados = {(e["conjunto"], canonico_procedimento(e["modulo"])) for e in aprovacoes_de_procedimentos([a])}
        if not aprovados:
            continue
        cand = []
        for cid in {y for p in processos(a["processo"]) for y in por_processo.get(p, ())}:
            c = cons[cid]
            f = fase_atual(c)
            limite = (f or {}).get("fim") or (f or {}).get("data_deliberacao") or c["abertura"]["data"]
            if (c["resultado"] or {}).get("decidido") or a["data"] <= limite:
                continue
            if procedimentos_citados(c["tema"]) & aprovados:
                cand.append(cid)
        if len(cand) == 1:
            registra_resultado(cand[0], a, "processo_e_objeto", "objeto_aprovado_no_processo")
    return cons


def forma_do_resultado(assunto):
    """'resultado' quando o assunto traz a fórmula "Resultado(s) da ... Consulta Pública";
    'encerramento' para encerramento ou fechamento; 'apos_contribuicoes' para "após a
    realização" ou "após a análise das contribuições recebidas" (ver alvos_do_resultado). As três
    seguem a regra de que a última deliberação decide."""
    if _RESULTADO.search(assunto or ""):
        return "resultado"
    m = _RESULTADO_ALT.search(assunto or "")
    if m and re.match(r"(Fechamento|Encerramento)", m.group(0), re.I):
        return "encerramento"
    return "apos_contribuicoes"


def numero_ato(n):
    """1167 → '1.167' (como a ANEEL numera os atos)."""
    return f"{n:,}".replace(",", ".") if isinstance(n, int) else str(n)


# ------------------------------------------------------------------ numeração dos atos
#
# O CSV das atas às vezes registra o número de um ato de outra série no campo do tipo (a
# "Resolução Normativa nº 3.354/2024" quando as REN de 2024 vão de 1.08x a 1.11x; "Portaria nº
# 1.160/2026" para a REN nº 1.160/2026; "Aviso de Convocação de Leilão nº 3.031/2022" para o
# Leilão nº 3/2022). A conferência usa a própria numeração das atas deliberadas, por tipo e ano:
# * séries contínuas entre anos (REN, REH, REA e Portaria da ANEEL): número fora de metade a uma
#   vez e meia a mediana dos números do mesmo tipo no ano, no anterior e no seguinte (pelo menos
#   5 atos); a faixa é larga de propósito: só pega número de outra série, não erro de um dígito;
# * Despacho (numeração recomeça a cada ano) e demais tipos: número acima do dobro do percentil
#   90 do mesmo tipo e ano (pelo menos 20 atos);
# * avisos de leilão: o número tem de ser o de um leilão citado no assunto da linha.
SERIES_CONTINUAS = ("Resolução Normativa", "Resolução Homologatória", "Resolução Autorizativa", "Portaria")


def numeracao_das_atas(atas):
    """{(tipo, ano): [números]} dos atos de linhas deliberadas (para `confere_numero_ato`)."""
    out = {}
    for a in atas:
        n = _int(a["num_ato"])
        if a["tipo_ato"] and n and _decidiu(a):
            out.setdefault((a["tipo_ato"], int(a["data"][:4])), []).append(n)
    return {k: sorted(v) for k, v in out.items()}


def _mediana(xs):
    xs = sorted(xs)
    k = len(xs) // 2
    return xs[k] if len(xs) % 2 else (xs[k - 1] + xs[k]) / 2


def _leiloes_citados(assunto):
    t = re.sub(r"\s+", " ", (assunto or "").replace("\xa0", " "))
    i = t.find("Leil")
    if i < 0:
        return set()
    # só a designação do leilão: até a descrição ou a citação de consulta que vem depois
    trecho = re.split(r"Consulta|Audiência|consolidad|destinad|incluindo|\(", t[i:i + 160])[0]
    return {int(x) for x in re.findall(r"(?:n[º°]\s*|\be\s+)(\d{1,3})(?=\s*(?:/|e\b|,|-\s*ANEEL))", trecho)}


def confere_numero_ato(tipo, numero, ano, numeracao, assunto=None):
    """(suspeito, motivo) do número de um ato registrado nas atas. suspeito = None quando a faixa
    não pôde ser conferida (tipo sem amostra suficiente) ou não há ato; o motivo diz por quê."""
    if not tipo or not numero:
        return None, None
    if "Leilão" in tipo:
        cit = _leiloes_citados(assunto)
        if not cit:
            return None, "assunto sem número de leilão para conferir"
        if numero in cit:
            return False, None
        return True, (f"{tipo} nº {numero_ato(numero)}/{ano}: o assunto cita o(s) leilão(ões) nº "
                      + ", ".join(str(x) for x in sorted(cit)) + f"/{ano}")
    if tipo in SERIES_CONTINUAS:
        xs = [n for a in (ano - 1, ano, ano + 1) for n in numeracao.get((tipo, a), [])]
        if len(xs) < 5:
            return None, f"faixa de {tipo} não conferida: {len(xs)} atos entre {ano - 1} e {ano + 1}"
        med = _mediana(xs)
        if 0.5 * med <= numero <= 1.5 * med:
            return False, None
        outras = []
        for t2 in SERIES_CONTINUAS:
            ys = [n for a in (ano - 1, ano, ano + 1) for n in numeracao.get((t2, a), [])]
            if t2 != tipo and len(ys) >= 5 and 0.5 * _mediana(ys) <= numero <= 1.5 * _mediana(ys):
                outras.append(t2)
        return True, (f"{tipo} nº {numero_ato(numero)}/{ano} fora da faixa da série: mediana de {numero_ato(int(med))} "
                      f"entre {len(xs)} atos do tipo deliberados de {ano - 1} a {ano + 1} (aceito de metade a uma vez e meia)"
                      + (f"; o número cabe na faixa de {' e de '.join(outras)}" if outras else ""))
    xs = numeracao.get((tipo, ano), [])
    if len(xs) < 20:
        return None, f"faixa de {tipo} não conferida: {len(xs)} atos em {ano}"
    p90 = xs[min(len(xs) - 1, int(0.9 * len(xs)))]
    if numero <= 2 * p90:
        return False, None
    return True, (f"{tipo} nº {numero_ato(numero)}/{ano} acima do dobro do percentil 90 da numeração do tipo em {ano} "
                  f"({numero_ato(p90)}, {len(xs)} atos deliberados)")


SITUACOES = {
    "aberta": "Recebendo contribuições",
    "a_abrir": "Abertura deliberada, período ainda não começou",
    "encerrada_aguardando": "Contribuições encerradas, sem resultado deliberado em reunião pública registrada",
    "resultado_em_pauta": "Resultado levado à reunião, sem decisão (retirado de pauta ou pedido de vista)",
    "decidida": "Resultado deliberado pela Diretoria",
    "prazo_nao_datado": "A ata informa a duração, mas não a data de início nem a de encerramento; situação não derivável",
    "sessao_sem_periodo": "Audiência com data de sessão, sem período de contribuições na ata; situação não derivável",
    "sem_periodo_na_ata": "A ata não informa período, duração nem sessão; situação não derivável",
}


def fase_atual(consulta):
    """Fase deliberada por último (abertura, 2ª fase, reabertura ou prorrogação)."""
    return max(consulta["fases"], key=lambda f: (f["data_deliberacao"], f["fim"] or "")) if consulta["fases"] else None


def janela_vigente(consulta):
    """Janela datada da fase deliberada por último; None quando essa fase não traz datas
    (uma fase posterior sem data não deixa a janela anterior valer em seu lugar). A janela
    pode ter o fim calculado (início e duração escritos na ata; `fim_calculado`)."""
    f = fase_atual(consulta)
    return f if f and f.get("inicio") and f.get("fim") else None


def situacao(consulta, hoje):
    """Situação derivada da data `hoje` (AAAA-MM-DD, horário de Brasília). Regra única,
    repetida sem alteração em src/lib/energia/tipos-regulacao.ts (situacaoConsulta):
    1. resultado deliberado → decidida;
    2. resultado levado à reunião, sem decisão, depois da deliberação da fase atual →
       resultado_em_pauta (levar o resultado à Diretoria prova que as contribuições
       daquela fase acabaram, mesmo quando a ata não datou a fase);
    3. fase atual sem janela: só a duração → prazo_nao_datado; só a sessão da audiência →
       sessao_sem_periodo; nada → sem_periodo_na_ata (nunca 'aberta');
    4. hoje antes do início → a_abrir; entre início e fim (inclusive) → aberta;
    5. depois do fim → encerrada_aguardando."""
    res = consulta.get("resultado")
    if res and res.get("decidido"):
        return "decidida"
    f = fase_atual(consulta)
    if res and f and res["data"] > f["data_deliberacao"]:
        return "resultado_em_pauta"
    j = janela_vigente(consulta)
    if not j:
        if f and f.get("duracao_dias"):
            return "prazo_nao_datado"
        if f and f.get("sessao"):
            return "sessao_sem_periodo"
        return "sem_periodo_na_ata"
    if hoje < j["inicio"]:
        return "a_abrir"
    if hoje <= j["fim"]:
        return "aberta"
    return "encerrada_aguardando"


# ------------------------------------------------------------------ agenda regulatória

_CODIGO = re.compile(r"(?<![\w&])((?:AR|TRA|TRV|P&E|GER|C&M|R&C|TAR)\d{2}\s?[-–]\s?\d{2}(?:\[[A-Z]\])?)(?!\w)")
_ANO_FIM = re.compile(r"\s{2,}(20\d{2})\s*$")
_CABECALHO_AGENDA = ("Ano previsto", "Eixo Temático", "para edição da", "Norma (RPO)", "* A previsão",
                     "Regulatório ou de mudanças", "ANEXO I da PORTARIA", "Agenda Regulatória 20")


def codigo_canonico(c):
    return re.sub(r"\s*[-–]\s*", "-", c.strip())


def agenda_do_anexo(texto_layout):
    """Atividades do Anexo I da Portaria ANEEL nº 7.030/2025 a partir do texto com leiaute.

    Cada linha da tabela tem o código e o ano na mesma linha (centralizados na célula) e a
    atividade espalhada em uma ou mais linhas da coluna central, sempre terminada em ponto.
    A leitura junta a coluna central em ordem e corta nas linhas que terminam em ponto;
    a n-ésima atividade pertence ao n-ésimo código. Contagens diferentes levantam erro (nunca
    se casa atividade com código por aproximação). O eixo temático fica de fora: é célula
    mesclada cujo rótulo não indica onde começa e termina."""
    ini = texto_layout.find("ANEXO I da PORTARIA")
    if ini < 0:
        raise ValueError("Anexo I não encontrado no texto da portaria")
    codigos, fragmentos = [], []
    for linha in texto_layout[ini:].splitlines():
        if not linha.strip() or any(k in linha for k in _CABECALHO_AGENDA):
            continue
        ano = None
        m = _ANO_FIM.search(linha)
        if m:
            ano, linha = int(m.group(1)), linha[:m.start()]
        mc = _CODIGO.search(linha)
        if mc and mc.start() >= 20:
            if ano is None:
                raise ValueError(f"código {mc.group(1)} sem ano previsto na mesma linha")
            codigos.append((codigo_canonico(mc.group(1)), ano))
            resto = linha[mc.end():]
        else:
            if ano is not None:
                raise ValueError(f"ano previsto sem código na linha: {linha.strip()[:80]}")
            resto = linha[40:] if len(linha) > 40 else ""
        resto = resto.strip()
        if resto:
            fragmentos.append(resto)
    atividades, atual = [], []
    for f in fragmentos:
        atual.append(f)
        if f.rstrip().endswith("."):
            atividades.append(re.sub(r"\s+", " ", " ".join(atual)).replace(" .", "."))
            atual = []
    if atual:
        raise ValueError(f"atividade sem ponto final: {' '.join(atual)[:80]}")
    if len(atividades) != len(codigos):
        raise ValueError(f"{len(codigos)} códigos e {len(atividades)} atividades no Anexo I")
    vistos = [c for c, _ in codigos]
    if len(set(vistos)) != len(vistos):
        raise ValueError("código repetido no Anexo I")
    return [{"codigo": c, "atividade": a, "ano_previsto": ano} for (c, ano), a in zip(codigos, atividades)]


# Painéis relacionados a cada atividade por palavra-chave do texto da própria atividade
# (regra publicada; não é inferência de efeito). A primeira regra que casa entra; uma
# atividade pode ligar a mais de um painel.
REGRAS_PAINEL = (
    (r"\bPLD\b|Preço de Liquidação|Tarifa de Energia de Otimização", "PLD", "/setor-eletrico/pld"),
    (r"[Pp]erdas", "Perdas", "/setor-eletrico/perdas"),
    (r"MMGD|[Mm]icrogeração|14\.300|Recursos Energéticos Distribuídos", "Transição e ambiente", "/setor-eletrico/transicao"),
    (r"[Aa]bertura d[eo] mercado|Grupo B|autoprodução|Regras de Comercialização|mercado de energia|Mercado de Curto Prazo",
     "Mercado", "/setor-eletrico/mercado"),
    (r"[Rr]esiliência|Interrupção|[Qq]ualidade|Atendimento de\s+Mercado|Prestação do Serviço", "Qualidade", "/setor-eletrico/qualidade"),
    (r"tarifas de distribuição|Parcela B|TUSD|CDE|tarif", "Conta de luz", "/setor-eletrico/conta-de-luz"),
    (r"transmissão|[Aa]rmazenamento|Constrained|redução ou limitação de geração|usinas", "Rede e geração", "/setor-eletrico/rede"),
)


def paineis_da_atividade(texto):
    out = []
    for pad, rot, href in REGRAS_PAINEL:
        if re.search(pad, texto) and href not in [p["href"] for p in out]:
            out.append({"rotulo": rot, "href": href})
    return out


# ------------------------------------------------------------------ PRODIST e PRORET

# Nome do arquivo da versão vigente, como as páginas publicam (exemplos reais):
#   aren2021956_Prodist_modulo_11_v2.pdf          REN nº 956/2021, versão 2
#   Proret_Submod_2.1_V_2.5_aren20251114.pdf       REN nº 1.114/2025, versão 2.5
#   Proret_Submod_2.1A_V_2.2_ren20251114.pdf       sem o "a" do prefixo
#   Proret_Submod_3.1A_v1.2_aren20251114.pdf       "v" minúsculo e sem sublinhado
#   Proret_Submod_4.1_V1.0C_aren20221003.pdf       versão com sufixo de letra
#   Proret_Submod_9.3_V_1.2_adsp20253606.pdf       Despacho nº 3.606/2025
_PREFIXO_ATO = {"ren": "Resolução Normativa", "dsp": "Despacho"}
_ARQ_PRODIST = re.compile(r"a?(ren|dsp)(\d{4})(\d+)_Prodist_modulo_(\d+)_v_?(\d+(?:\.\d+)*[A-Z]?)\.pdf", re.I)
_ARQ_PRORET = re.compile(r"Proret_Submod_([\dA-Z.]+?)_V_?([\d.]+[A-Z]?)_a?(ren|dsp)(\d{4})(\d+)\.pdf", re.I)
_TITULO_PROC = re.compile(r"^(Módulo\s+\d+|Submódulo\s+[\d.]+\s?[A-Z]?)\s*[-–]\s*(.+?):?$")


def versao_e_ato_do_arquivo(url):
    """{versao, tipo_ato, numero_ato, ano_ato, ato} lidos do nome do arquivo da versão vigente;
    None quando o nome não segue nenhum dos padrões acima (o item fica sem versão e sem ato,
    e isso é declarado, nunca deduzido)."""
    mp, mr = _ARQ_PRODIST.search(url or ""), _ARQ_PRORET.search(url or "")
    if mp:
        pref, ano, num, versao = mp.group(1), int(mp.group(2)), int(mp.group(3)), f"v{mp.group(5)}"
    elif mr:
        pref, ano, num, versao = mr.group(3), int(mr.group(4)), int(mr.group(5)), mr.group(2).upper()
    else:
        return None
    tipo = _PREFIXO_ATO[pref.lower()]
    return {"versao": versao, "tipo_ato": tipo, "numero_ato": num, "ano_ato": ano,
            "ato": f"{tipo} nº {numero_ato(num)}/{ano}"}


def procedimentos_da_pagina(dados, conjunto):
    """[{conjunto, modulo, titulo, modulo_pai, versao, ato, ano_ato, url_vigente, url_versoes, observacao}]
    a partir da página gov.br do PRODIST ou do PRORET. O ato é o que aparece no nome do
    arquivo da versão vigente publicado pela página ('aren20251137' = REN nº 1.137/2025)."""
    corpo = conteudo_govbr(dados)
    corpo = re.sub(r'(?is)<a[^>]+href="([^"]+)"[^>]*>\s*versão vigente\s*</a>', r"\n[[VIGENTE \1]]\n", corpo)
    corpo = re.sub(r'(?is)<a[^>]+href="([^"]+)"[^>]*>\s*todas as versões\s*</a>', r"\n[[VERSOES \1]]\n", corpo)
    corpo = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</div>", "\n", corpo)
    texto = html_mod.unescape(re.sub(r"<[^>]+>", " ", corpo))
    linhas = [re.sub(r"\s+", " ", x).strip() for x in texto.splitlines()]
    linhas = [x for x in linhas if x and x != "|"]
    itens, atual, pai = [], None, None
    for x in linhas:
        m = _TITULO_PROC.match(x)
        if m and not x.startswith("[["):
            nome, titulo = re.sub(r"\s+", " ", m.group(1)).strip(), m.group(2).strip()
            if nome.startswith("Módulo") and conjunto == "PRORET":
                pai = f"{nome} - {titulo}"
            atual = {"conjunto": conjunto, "modulo": nome, "titulo": titulo,
                     "modulo_pai": pai if nome.startswith("Submódulo") else None,
                     "versao": None, "ato": None, "ano_ato": None, "url_vigente": None, "url_versoes": None,
                     "observacao": None}
            itens.append(atual)
            continue
        if atual is None:
            continue
        if x.startswith("[[VIGENTE"):
            url = x[10:-2].strip()
            atual["url_vigente"] = url
            va = versao_e_ato_do_arquivo(url)
            if va:
                atual["versao"], atual["ano_ato"], atual["ato"] = va["versao"], va["ano_ato"], va["ato"]
        elif x.startswith("[[VERSOES"):
            atual["url_versoes"] = x[10:-2].strip()
        elif re.match(r"^-?\s*OBS", x) or "terá vigência" in x:
            nota = re.sub(r"^[-.\s]*", "", x).strip()
            atual["observacao"] = (atual["observacao"] + " " if atual["observacao"] else "") + nota
    # módulos do PRORET só como agrupador (sem link próprio) ficam de fora
    return [i for i in itens if i["url_vigente"] or i["url_versoes"]]


def revisao_da_agenda(dados):
    """Na página da Agenda Regulatória: portaria que aprovou e portaria que atualizou a agenda
    vigente, como a página as cita. Devolve {aprovada_por, atualizada_por, trecho}."""
    t = texto_html(conteudo_govbr(dados))
    m = re.search(r"aprovada pela (Portaria ANEEL nº [\d.]+, de \d{1,2} de \w+ de \d{4})\s*,?\s*atualizada pela\s*"
                  r"(Portaria nº [\d.]+, de \d{1,2} de \w+ de \d{4})", t)
    if not m:
        m2 = re.search(r"aprovada pela (Portaria ANEEL nº [\d.]+, de \d{1,2} de \w+ de \d{4})", t)
        return {"aprovada_por": m2.group(1) if m2 else None, "atualizada_por": None,
                "trecho": normaliza(m2.group(0)) if m2 else None}
    return {"aprovada_por": m.group(1), "atualizada_por": m.group(2), "trecho": normaliza(m.group(0))}


def link_revisao_agenda(dados):
    """Endereço que a página da Agenda Regulatória publica para a portaria que a atualizou
    ("atualizada pela <a href=...>Portaria nº 7.157, de 8 de setembro de 2026</a>"); None se a
    página não traz o link."""
    t = dados.decode("utf-8", "replace") if isinstance(dados, bytes) else (dados or "")
    m = re.search(r'atualizada\s+pela\s*<a[^>]+href="([^"]+)"', t)
    return html_mod.unescape(m.group(1)) if m else None


_CONJ_PROC = re.compile(r"Procedimentos de Distribuição|PRODIST|Procedimentos de Regulação Tarifária|PRORET")
_NUM_PROC = re.compile(r"\b(\d{1,2}(?:\.\d{1,2})?(?:\s?[A-Z])?)\b")


def canonico_procedimento(nome):
    """'Submódulo 2.1 A' → 'submódulo 2.1a'; 'Módulos 11' → 'módulo 11' (para comparar nomes)."""
    t = re.sub(r"\s+", "", (nome or "").lower()).replace("módulos", "módulo").replace("submódulos", "submódulo")
    return re.sub(r"^(sub)?módulo", lambda m: m.group(0) + " ", t)


def procedimentos_citados(texto):
    """{(conjunto, módulo canônico)} dos módulos do PRODIST e submódulos do PRORET que um texto
    cita ("aprimoramento do Submódulo 6.2 dos Procedimentos de Regulação Tarifária – PRORET" →
    {('PRORET', 'submódulo 6.2')}). Cada menção ao conjunto liga à última palavra "Módulo(s)"
    ou "Submódulo(s)" nos 160 caracteres anteriores, sem atravessar a menção anterior."""
    d = (texto or "").replace("\xa0", " ")
    out, ult = set(), 0
    for m in _CONJ_PROC.finditer(d):
        janela = d[max(ult, m.start() - 160):m.start()]
        ult = m.end()
        mks = list(re.finditer(r"(Subm[óo]dulos?|M[óo]dulos?)\s", janela))
        if not mks:
            continue
        mk = mks[-1]
        tipo = "Submódulo" if mk.group(1).lower().startswith("sub") else "Módulo"
        conjunto = "PRORET" if m.group(0) in ("PRORET", "Procedimentos de Regulação Tarifária") else "PRODIST"
        seg = re.sub(r"\([^)]*\)", " ", janela[mk.end():])
        for n in _NUM_PROC.findall(seg):
            out.add((conjunto, canonico_procedimento(f"{tipo} {n.replace(' ', '')}")))
    return out


def aprovacoes_de_procedimentos(atas):
    """Decisões da Diretoria que aprovam versão, revisão ou alteração de módulos do PRODIST ou
    submódulos do PRORET: [{conjunto, modulo, ato, numero, ano, data, fonte='ata', trecho}].

    Leitura: cada menção a "Procedimentos de Distribuição", "PRODIST", "Procedimentos de
    Regulação Tarifária" ou "PRORET" na decisão é ligada ao "aprovar" mais próximo antes dela
    (até 220 caracteres, sem ';' e sem atravessar a menção anterior); os números que seguem
    a palavra "Módulo(s)" ou "Submódulo(s)" nesse trecho, sem os parênteses, são os itens
    aprovados ("aprovar novas versões dos Módulos 1, 4, 6, 8 e 11 dos Procedimentos de
    Distribuição"). Só linhas deliberadas."""
    out = []
    for a in atas:
        if not _decidiu(a):
            continue
        d = (a["decisao"] or "").replace("\xa0", " ")
        ult = 0
        for m in _CONJ_PROC.finditer(d):
            janela = d[max(ult, m.start() - 220):m.start()]
            ult = m.end()
            k = janela.rfind("aprovar")
            if k < 0 or ";" in janela[k:]:
                continue
            seg = re.sub(r"\([^)]*\)", " ", janela[k:])
            mk = re.search(r"(Subm[óo]dulos?|M[óo]dulos?)\s", seg)
            if not mk:
                continue
            tipo = "Submódulo" if mk.group(1).lower().startswith("sub") else "Módulo"
            conjunto = "PRORET" if m.group(0) in ("PRORET", "Procedimentos de Regulação Tarifária") else "PRODIST"
            nums = [x.replace(" ", "") for x in _NUM_PROC.findall(seg[mk.end():])]
            mv = re.search(r"\bvers(?:ão|ões)\s+(\d+(?:\.\d+)*[A-Z]?)\b", seg)
            n_ato = _int(a["num_ato"])
            for n in dict.fromkeys(nums):
                out.append({"conjunto": conjunto, "modulo": f"{tipo} {n}", "ato": f"{a['tipo_ato']} nº {numero_ato(n_ato)}/{a['data'][:4]}"
                            if a["tipo_ato"] and n_ato else None, "numero": n_ato, "ano": int(a["data"][:4]),
                            "tipo_ato": a["tipo_ato"], "data": a["data"], "fonte": "ata da reunião pública da Diretoria",
                            "versao_aprovada": mv.group(1) if mv and len(nums) == 1 else None,
                            "trecho": normaliza(janela[k:] + m.group(0))})
    return out


_ANEXO_PROC = re.compile(r"Anexo\s+[IVXLC]+\s*[-–]\s*(Subm[óo]dulo|M[óo]dulo)\s+([\d.]+\s?[A-Z]?)\s*[-–]\s*([^\n]+)")


def anexos_de_procedimentos(texto, titulos):
    """Módulos que um ato publica em anexo ("Anexo V - Módulo 11 - FATURA DE ENERGIA ELÉTRICA E
    INFORMAÇÕES SUPLEMENTARES"): [{modulo, titulo_no_ato, trecho}]. Só entra o anexo cujo título
    começa como o título do item na página oficial (`titulos` = {'módulo 11': 'Fatura de
    Energia Elétrica e Informações Suplementares'}), para não confundir com módulos de outros
    procedimentos (Regras de Transmissão, Procedimentos de Rede)."""
    out = []
    for m in _ANEXO_PROC.finditer(texto or ""):
        nome = f"{'Submódulo' if m.group(1).lower().startswith('sub') else 'Módulo'} {m.group(2).strip()}"
        tit_pag = titulos.get(canonico_procedimento(nome))
        tit_ato = normaliza(m.group(3))
        if tit_pag and tit_ato.lower()[:20] == normaliza(tit_pag).lower()[:20]:
            out.append({"modulo": nome, "titulo_no_ato": tit_ato, "trecho": normaliza(m.group(0))})
    return out


# "Art. 2º Aprovar as versões dos Submódulos dos Procedimentos de Regulação Tarifária – I) Submódulo
# 2.1, versão 2.5; II) Submódulo 2.6, versão 3.0; ..." (REN nº 1.114/2025) e "... PRORET: I -
# Submódulo 5.2, versão 1.5; e II - Submódulo 7.1, versão 2.9." (REN nº 1.147/2025)
_ITEM_VERSAO = re.compile(r"(Subm[óo]dulo|M[óo]dulo)\s+(\d{1,2}(?:\.\d{1,2})?\s?[A-Z]?)\s*,\s*vers[ãa]o\s+(\d+(?:\.\d+)*[A-Z]?)")


def versoes_aprovadas_no_ato(texto):
    """[{conjunto, modulo, versao, trecho}] das versões que um ato aprova por enumeração. Uma
    enumeração só conta quando os 300 caracteres antes do primeiro item trazem "provar" e o
    nome do conjunto (PRODIST ou PRORET); os itens seguintes entram enquanto vierem separados
    só por pontuação, conectivos e numeração romana ou arábica."""
    t = re.sub(r"\s+", " ", (texto or "").replace("\xa0", " "))
    out, fim_ult = [], -1
    for m in _ITEM_VERSAO.finditer(t):
        entre = t[fim_ult:m.start()] if fim_ult >= 0 else None
        continua = entre is not None and re.fullmatch(r"[\s;,.e]*(?:[IVXLC]+\s*[)\-–]|\d+\s*[)\-–]|[a-z]\s*\))?\s*", entre)
        if not continua:
            antes = t[max(0, m.start() - 300):m.start()]
            k = antes.rfind("provar")
            conj = _CONJ_PROC.search(antes[k:]) if k >= 0 else None
            if not conj:
                fim_ult = -1
                continue
            conjunto = "PRORET" if conj.group(0) in ("PRORET", "Procedimentos de Regulação Tarifária") else "PRODIST"
        tipo = "Submódulo" if m.group(1).lower().startswith("sub") else "Módulo"
        out.append({"conjunto": conjunto, "modulo": f"{tipo} {m.group(2).replace(' ', '')}", "versao": m.group(3),
                    "trecho": m.group(0)})
        fim_ult = m.end()
    return out


def _versao_canonica(v):
    """'v12' → '12'; '1.10C' → '1.10' (a letra final não muda o número da versão)."""
    return re.sub(r"[^\d.]", "", str(v or "")).strip(".")


def confere_numero_da_versao(versao_pagina, evidencias_do_mesmo_ato):
    """Confronta a versão que a página publica com a que o próprio ato da página aprova:
    'confere', 'diverge' (o ato aprova outra versão) ou None (o ato não escreve a versão)."""
    vs = {_versao_canonica(e["versao_aprovada"]) for e in evidencias_do_mesmo_ato if e.get("versao_aprovada")}
    if not vs or not versao_pagina:
        return None
    return "confere" if _versao_canonica(versao_pagina) in vs else "diverge"


def confere_versao(item, evidencias, data_ato_pagina):
    """Confronta a versão vigente que a página oficial publica com os atos integrados.

    `evidencias`: [{ato, numero, ano, data, fonte, trecho}] de atos que aprovaram nova versão
    do mesmo módulo. `data_ato_pagina`: data da deliberação do ato citado no nome do arquivo
    (None quando desconhecida; aí só conta ato de ano posterior). Devolve {situacao, ato_vigente,
    atos_posteriores, confirmacoes}:
    * pagina_possivelmente_desatualizada: há ato posterior ao da página que aprova nova versão;
      o ato da página não é afirmado como vigente (ato_vigente = None);
    * confirmada_por_ato_integrado: um ato integrado aprova este módulo e é o mesmo da página;
    * sem_conferencia_externa: nenhum ato integrado trata do módulo depois do ato da página."""
    num_pag, ano_pag = item.get("numero_ato"), item.get("ano_ato")

    def mesmo(e):
        return e.get("numero") == num_pag and e.get("ano") == ano_pag

    def posterior(e):
        if mesmo(e) or not ano_pag:
            return False
        return e["data"] > data_ato_pagina if data_ato_pagina else e["data"][:4] > str(ano_pag)
    post = [e for e in evidencias if posterior(e)]
    conf = [e for e in evidencias if mesmo(e)]
    if post:
        sit, vig = "pagina_possivelmente_desatualizada", None
    elif conf:
        sit, vig = "confirmada_por_ato_integrado", item.get("ato")
    else:
        sit, vig = "sem_conferencia_externa", item.get("ato")
    return {"situacao": sit, "ato_vigente": vig, "atos_posteriores": post, "confirmacoes": conf}


# ------------------------------------------------------------------ bandeiras e IPCA

PATAMARES = ("Amarela", "Vermelha P1", "Vermelha P2", "Escassez Hídrica")


def bandeiras_adicional(linhas):
    """[{ato, vigencia_inicio, patamar, rs_mwh}] do recurso 'Bandeira Tarifária - Adicional'.
    Valor vazio é ausência (não vira zero)."""
    out = []
    for r in linhas:
        g = lambda k: (r.get(k) or "").strip().strip('"')  # noqa: E731
        v = g("VlrAdicionalBandeiraRSMWh")
        try:
            val = float(v.replace(".", "").replace(",", ".")) if v else None
        except ValueError:
            val = None
        out.append({"ato": g("DscResolucao"), "vigencia_inicio": g("DatVigencia")[:10], "patamar": g("NomBandeiraAcionada"),
                    "rs_mwh": val, "gerado_em": g("DatGeracaoConjuntoDados")[:10]})
    return out


def bandeiras_acionamento(linhas):
    """[{competencia: 'AAAA-MM', patamar, rs_mwh}] do recurso 'Bandeira Tarifária - Acionamento'
    (um registro por mês de competência; a bandeira verde vem com valor zero, que é zero de
    fato: não há adicional). Valor vazio é ausência."""
    out = []
    for r in linhas:
        g = lambda k: (r.get(k) or "").strip().strip('"')  # noqa: E731
        comp, pat, v = g("DatCompetencia")[:7], g("NomBandeiraAcionada"), g("VlrAdicionalBandeira")
        if not re.match(r"^\d{4}-\d{2}$", comp) or not pat:
            continue
        try:
            val = float(v.replace(".", "").replace(",", ".")) if v else None
        except ValueError:
            val = None
        out.append({"competencia": comp, "patamar": pat, "rs_mwh": val, "gerado_em": g("DatGeracaoConjuntoDados")[:10]})
    return sorted(out, key=lambda x: x["competencia"])


def vigencia_no_dicionario(texto):
    """{patamar: (inicio 'AAAA-MM', fim 'AAAA-MM')} das vigências que o dicionário do recurso
    Acionamento escreve ("Bandeira escassez hídrica: Tarifa criada para a seca de 2021
    (vigência: setembro/21 a abril/22)")."""
    out = {}
    t = re.sub(r"\s+", " ", texto or "")
    for m in re.finditer(r"Bandeira ([\wÀ-ú ]+?):[^()]{0,120}\(vigência:\s*" + _MES + r"\s*/\s*(\d{2})\s+a\s+" + _MES
                         + r"\s*/\s*(\d{2})\)", t, re.I):
        nome = m.group(1).strip().lower()
        pat = next((p for p in PATAMARES if p.lower() == nome), None)
        if pat:
            out[pat] = (f"20{m.group(3)}-{MESES[m.group(2).lower()]:02d}", f"20{m.group(5)}-{MESES[m.group(4).lower()]:02d}")
    return out


def _ultimo_dia(mes):
    a, mm = int(mes[:4]), int(mes[5:7])
    return (date(a + (mm == 12), mm % 12 + 1, 1) - timedelta(days=1)).isoformat()


def _mes_seguinte(mes):
    a, mm = int(mes[:4]), int(mes[5:7])
    return f"{a + (mm == 12)}-{mm % 12 + 1:02d}"


def _meses_entre(mes_a, mes_b):
    """Número de meses de mes_a até mes_b ('AAAA-MM'); 1 = meses consecutivos."""
    return (int(mes_b[:4]) - int(mes_a[:4])) * 12 + int(mes_b[5:7]) - int(mes_a[5:7])


def vigencias_bandeiras(linhas, acionamentos=None):
    """Tabela de vigências por patamar, conferida mês a mês com o recurso Acionamento.

    * Cada valor vale da sua data até a véspera do próximo valor do mesmo patamar
      (vigencia_fim_origem = 'valor_seguinte', grão diário).
    * O último valor de um patamar fica aberto, salvo quando o patamar foi extinto: uma
      resolução posterior do mesmo recurso fixou os demais patamares sem ele, e o recurso
      Acionamento não registra o patamar depois do mês anterior à vigência dessa resolução.
      Aí o fim é o último mês com acionamento (vigencia_fim_origem = 'ultimo_acionamento',
      grão mensal: o recurso é mensal e não informa o dia, então o dia fica vazio).
    * Conferência com o Acionamento: cada mês em que o patamar foi acionado dentro da vigência
      tem de trazer o mesmo valor. O recurso Adicional é incompleto (faltam resoluções de
      2015 e de 2017); quando um mês traz outro valor, o fim deduzido pelo valor seguinte é
      contrariado pela fonte: o fim passa a ser o último mês coerente antes do primeiro mês
      divergente (vigencia_fim_origem = 'acionamento_diverge', grão mensal), com `fim_incerto`
      quando há mais de um mês entre os dois, e os meses divergentes ficam listados. O mês
      final de um patamar extinto com valor menor que o adicional é parcial (acionamento em
      parte do mês) e não conta como divergência.
    * Sem o recurso Acionamento, o último valor fica sem fim (a fonte Adicional não informa
      término) e nada é conferido.

    Campos de fim: vigencia_fim (AAAA-MM-DD, só com grão diário), vigencia_fim_mes (AAAA-MM),
    vigencia_fim_grao ('dia', 'mes' ou None), fim_pelo_recurso_adicional (o que a véspera do
    valor seguinte daria), fim_incerto, conferencia_acionamento."""
    por_patamar = {}
    for r in linhas:
        if r["vigencia_inicio"] and r["patamar"]:
            por_patamar.setdefault(r["patamar"], []).append(r)
    resolucoes = {}
    for r in linhas:
        if r["vigencia_inicio"] and r["patamar"]:
            resolucoes.setdefault((r["vigencia_inicio"], r["ato"]), set()).add(r["patamar"])
    ult_acion, acion_pat = {}, {}
    for x in acionamentos or []:
        ult_acion[x["patamar"]] = x  # ordenados por competência: fica o último
        acion_pat.setdefault(x["patamar"], []).append(x)
    ultimo_mes = max((x["competencia"] for x in acionamentos or []), default=None)
    out = []
    for pat, rs in por_patamar.items():
        rs = sorted(rs, key=lambda x: x["vigencia_inicio"])
        for i, r in enumerate(rs):
            fim, origem, ultimo, extinto_por = None, None, None, None
            if i + 1 < len(rs):
                fim = (date.fromisoformat(rs[i + 1]["vigencia_inicio"]) - timedelta(days=1)).isoformat()
                origem = "valor_seguinte"
            elif acionamentos:
                ua = ult_acion.get(pat)
                depois = sorted((v, ato) for (v, ato), pats in resolucoes.items() if v > r["vigencia_inicio"] and pat not in pats)
                if ua and depois and ua["competencia"] < depois[0][0][:7]:
                    origem = "ultimo_acionamento"
                    ultimo = {"competencia": ua["competencia"], "rs_mwh": ua["rs_mwh"]}
                    extinto_por = {"ato": depois[0][1], "vigencia_inicio": depois[0][0]}
            v = {**r, "vigencia_fim": fim, "vigencia_fim_mes": fim[:7] if fim else (ultimo or {}).get("competencia"),
                 "vigencia_fim_grao": "dia" if fim else ("mes" if ultimo else None), "vigencia_fim_origem": origem,
                 "fim_pelo_recurso_adicional": fim, "fim_incerto": False, "ultimo_acionamento": ultimo,
                 "resolucao_seguinte_sem_patamar": extinto_por, "conferencia_acionamento": None}
            if acionamentos and r["rs_mwh"] is not None:
                # meses do Acionamento com o patamar dentro da vigência (do mês do início até o mês do fim,
                # ou até o último mês publicado quando a vigência está aberta)
                ate = v["vigencia_fim_mes"] or ultimo_mes
                meses = [x for x in acion_pat.get(pat, []) if r["vigencia_inicio"][:7] <= x["competencia"] <= ate]
                parcial = [x for x in meses if ultimo and x["competencia"] == ultimo["competencia"]
                           and x["rs_mwh"] is not None and x["rs_mwh"] < r["rs_mwh"]]
                coerentes = [x for x in meses if x["rs_mwh"] is not None and abs(x["rs_mwh"] - r["rs_mwh"]) < 0.005]
                divergentes = [x for x in meses if x not in coerentes and x not in parcial and x["rs_mwh"] is not None]
                conf = {"meses_conferidos": len(meses), "meses_coerentes": len(coerentes),
                        "meses_divergentes": [{"competencia": x["competencia"], "rs_mwh": x["rs_mwh"]} for x in divergentes],
                        "mes_parcial": ({"competencia": parcial[0]["competencia"], "rs_mwh": parcial[0]["rs_mwh"]} if parcial else None),
                        "ultimo_mes_coerente": None, "primeiro_mes_divergente": None}
                if divergentes:
                    prim = divergentes[0]["competencia"]
                    antes = [x["competencia"] for x in coerentes if x["competencia"] < prim]
                    conf["primeiro_mes_divergente"] = prim
                    conf["ultimo_mes_coerente"] = antes[-1] if antes else None
                    v.update({"vigencia_fim": None, "vigencia_fim_mes": conf["ultimo_mes_coerente"], "vigencia_fim_grao": "mes",
                              "vigencia_fim_origem": "acionamento_diverge",
                              "fim_incerto": not antes or _meses_entre(antes[-1], prim) > 1})
                v["conferencia_acionamento"] = conf
            out.append(v)
    ordem = {p: i for i, p in enumerate(PATAMARES)}
    return sorted(out, key=lambda x: (x["vigencia_inicio"], ordem.get(x["patamar"], 99)))


def acionamentos_sem_resolucao(vigencias, acionamentos):
    """Trechos do recurso Acionamento cujo valor não é o de nenhuma vigência do recurso Adicional
    para o patamar naquele mês: [{patamar, rs_mwh, inicio 'AAAA-MM', fim 'AAAA-MM', meses,
    motivo}], com motivo 'valor_diferente' (há vigência no mês, com outro valor) ou
    'sem_vigencia' (nenhuma resolução do Adicional cobre o mês). Meses consecutivos com o mesmo
    patamar e valor formam um trecho. A bandeira verde não tem adicional e fica de fora; o mês
    parcial do fim de um patamar extinto também."""
    parciais = {(v["patamar"], (v.get("conferencia_acionamento") or {}).get("mes_parcial", {}).get("competencia"))
                for v in vigencias if (v.get("conferencia_acionamento") or {}).get("mes_parcial")}
    soltos = []
    for x in acionamentos or []:
        if x["patamar"] == "Verde" or x["rs_mwh"] is None or (x["patamar"], x["competencia"]) in parciais:
            continue
        ini_mes, fim_mes = x["competencia"] + "-01", _ultimo_dia(x["competencia"])
        cobrem = [v for v in vigencias if v["patamar"] == x["patamar"] and v["vigencia_inicio"] <= fim_mes
                  and (v["fim_pelo_recurso_adicional"] or "9999") >= ini_mes]
        if any(v["rs_mwh"] is not None and abs(v["rs_mwh"] - x["rs_mwh"]) < 0.005 for v in cobrem):
            continue
        soltos.append({**x, "motivo": "valor_diferente" if cobrem else "sem_vigencia"})
    trechos = []
    for x in soltos:
        t = trechos[-1] if trechos else None
        if (t and t["patamar"] == x["patamar"] and abs(t["rs_mwh"] - x["rs_mwh"]) < 0.005 and t["motivo"] == x["motivo"]
                and _mes_seguinte(t["fim"]) == x["competencia"]):
            t["fim"] = x["competencia"]
            t["meses"] += 1
        else:
            trechos.append({"patamar": x["patamar"], "rs_mwh": x["rs_mwh"], "inicio": x["competencia"], "fim": x["competencia"],
                            "meses": 1, "motivo": x["motivo"]})
    return trechos


def ipca_sidra(corpo):
    """{AAAA-MM: número-índice} da resposta JSON da API SIDRA (tabela 1737, variável 2266).
    Valores não numéricos ('...', '-') são ausência."""
    dado = json.loads(corpo.decode("utf-8") if isinstance(corpo, bytes) else corpo)
    out = {}
    for r in dado[1:]:
        per, v = r.get("D3C") or "", (r.get("V") or "").strip()
        if len(per) != 6 or not per.isdigit():
            continue
        try:
            out[f"{per[:4]}-{per[4:]}"] = float(v)
        except ValueError:
            continue
    return out


def publicacao_original_senado(xml):
    """{data, fonte, dispositivo} da "Publicação Original" nos metadados abertos do portal de
    Legislação Federal do Senado (/dadosabertos/legislacao/<código>, XML DetalheDocumento);
    None quando o XML não traz essa publicação. Lido com a biblioteca padrão."""
    import xml.etree.ElementTree as ET
    try:
        raiz = ET.fromstring(xml if isinstance(xml, bytes) else xml.encode("utf-8"))
    except ET.ParseError:
        return None
    for p in raiz.iter("publicacao"):
        disp = (p.findtext("dispositivo") or "").strip()
        dt = (p.findtext("data") or "").strip()
        if disp.startswith("Publicação Original") and re.fullmatch(r"\d{2}/\d{2}/\d{4}", dt):
            return {"data": f"{dt[6:]}-{dt[3:5]}-{dt[:2]}", "fonte": re.sub(r"\s+", " ", p.findtext("fonte") or "").strip(),
                    "dispositivo": re.sub(r"\s+", " ", disp)}
    return None


def le_csv(dados, encoding=None, separador=";"):
    """Linhas de um CSV pequeno em bytes (UTF-8 com ou sem BOM, ou Latin-1) como dicts."""
    if encoding is None:
        try:
            texto = dados.decode("utf-8-sig")
        except UnicodeDecodeError:
            texto = dados.decode("latin-1")
    else:
        texto = dados.decode(encoding)
    leitor = csv.reader(io.StringIO(texto, newline=""), delimiter=separador)
    cab = [c.strip().lstrip("﻿").strip('"') for c in next(leitor)]
    return [dict(zip(cab, r)) for r in leitor if r]
