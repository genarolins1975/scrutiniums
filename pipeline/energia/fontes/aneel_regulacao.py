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
_RESULTADO = re.compile(r"Resultados?\s+d[ao]s?\s+(?:[\wçãéíóú]+\s+){0,3}?(Consulta|Audiência)\s+Pública\s+(?:n[º°o.]*\s*)?([\d.]+)\s*/\s*(\d{4})", re.I)


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


_FAIXA = re.compile(
    r"(?:de|entre)\s+(\d{1,2})(?:\s+(?:de\s+)?" + _MES + r")?(?:\s+de\s+(\d{4}))?\s*,?\s+(?:a|até|e)\s+"
    r"(?:o\s+dia\s+)?(\d{1,2})\s+(?:de\s+)?" + _MES + r"(?:\s+de\s+(\d{4}))?", re.I)
_DURACAO = re.compile(r"(?:prazo|duração|período)\s+de\s+(\d{1,3})\s*(?:\([^)]*\)\s*)?dias", re.I)
_SESSAO = re.compile(r"(?:realizar-se|realizada|a ser realizada)?\s*(?:no dia|em)\s+(\d{1,2})\s+de\s+" + _MES + r"\s+de\s+(\d{4})", re.I)


def periodos_da_decisao(texto, data_reuniao):
    """Janelas de contribuição citadas numa decisão: lista de dicts {inicio, fim, trecho}.

    Regras (testadas em pipeline/tests/test_energia_regulacao.py):
    * "de D [de MÊS] [de AAAA] a|até D de MÊS [de AAAA]" e "entre ... e ...";
    * mês ou ano omitidos no início herdam os do fim; ano omitido no fim é o da reunião,
      ou o seguinte quando o mês do fim é anterior ao mês da reunião;
    * janela aceita só se início ≤ fim, termina no máximo 7 dias antes da reunião, começa no
      máximo 60 dias antes dela (uma prorrogação repete a data de início já transcorrida) e
      dura no máximo 400 dias; isso descarta períodos de referência citados no texto, como
      "de 1º de janeiro a 31 de dezembro de 2024".
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
        if not (ini <= fim and fim >= dr - timedelta(days=7) and ini >= dr - timedelta(days=60)
                and (fim - ini).days <= 400):
            continue
        out.append({"inicio": ini.isoformat(), "fim": fim.isoformat(), "trecho": m.group(0).strip()})
    return out


def duracao_da_decisao(texto):
    """Duração em dias quando a decisão informa só o prazo ("prazo de 45 dias"); None se não informa."""
    m = _DURACAO.search(_limpa_datas(texto))
    return int(m.group(1)) if m else None


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
    if _RESULTADO.search(a["assunto"]) or _REF_PART.search(a["assunto"]):
        return True
    if "Preço de Liquidação de Diferenças" in txt or "Preço de Liquidação das Diferenças" in txt or "PLD" in txt:
        return True
    if "Agenda Regulatória" in a["assunto"]:
        return True
    return tipo in ("Resolução Normativa", "Resolução Homologatória", "Portaria") and a["resultado"] in DELIBERADO


def chave_ata(a):
    return f"{a['data']}|{a['reuniao']}|{a['ordem']}|{a['num_ato']}|{'-'.join(processos(a['processo']))}"


def _decidiu(a):
    return a["resultado"] in DELIBERADO


def consultas_das_atas(atas):
    """Consultas e audiências públicas reconstituídas das atas: {id: consulta}.

    Identidade: (modalidade, número, ano). O número é o NumAtoAdministrativo da linha de
    abertura, que é o número do aviso (conferido nas linhas que citam 'Consulta Pública nº
    N/AAAA'); o ano é o da reunião que deliberou a abertura. Fases, reaberturas e
    prorrogações entram pela citação explícita 'nº N/AAAA'; na falta dela, pelo
    NumAtoAdministrativo da linha com o mesmo processo. Resultado entra só pela citação
    explícita 'Resultado da Consulta Pública nº N/AAAA'."""
    cons, por_processo = {}, {}
    ordenadas = sorted(atas, key=lambda a: (a["data"], _int(a["ordem"]) or 0))
    for a in ordenadas:
        mod = TIPOS_ABERTURA.get(a["tipo_ato"])
        n = _int(a["num_ato"])
        if not mod or not n or not _decidiu(a):
            continue
        ano = int(a["data"][:4])
        cid = f"{'CP' if mod.startswith('Consulta') else 'AP'}-{n}-{ano}"
        procs = processos(a["processo"])
        if cid in cons and not set(procs) & set(cons[cid]["processos"]):
            # mesmo número e ano em processos diferentes: a fonte repete o número; as duas
            # aberturas ficam separadas e marcadas, sem escolher qual está certa
            cons[cid]["numero_em_conflito"] = True
            k = 2
            while f"{cid}-{k}" in cons:
                k += 1
            cid = f"{cid}-{k}"
        janelas = periodos_da_decisao(a["decisao"], a["data"])
        c = cons.setdefault(cid, {
            "id": cid, "modalidade": mod, "numero": n, "ano": ano, "tema": a["assunto"],
            "processos": procs, "relator": a["relator"] or None,
            "abertura": {"data": a["data"], "reuniao": a["reuniao"], "decisao": limpa_decisao(a["decisao"]),
                         "tipo_ato": a["tipo_ato"], "chave": chave_ata(a)},
            "fases": [], "resultado": None, "citacoes_numero": 0,
            "numero_em_conflito": cid != f"{'CP' if mod.startswith('Consulta') else 'AP'}-{n}-{ano}"})
        c["fases"].append({"fase": "abertura", "data_deliberacao": a["data"], "reuniao": a["reuniao"],
                           "inicio": min((j["inicio"] for j in janelas), default=None),
                           "fim": max((j["fim"] for j in janelas), default=None),
                           "janelas": len(janelas), "trecho_periodo": " […] ".join(j["trecho"] for j in janelas) or None,
                           "duracao_dias": None if janelas else duracao_da_decisao(a["decisao"]),
                           "sessao": sessao_da_decisao(a["decisao"], a["data"]) if mod.startswith("Audiência") else None,
                           "chave": chave_ata(a)})
        for p in c["processos"]:
            por_processo.setdefault(p, set()).add(cid)
    for a in ordenadas:
        # citações explícitas conferem o número; fases e resultados se ligam a elas
        refs = [(("CP" if r[0].lower().startswith("consulta") else "AP"), _int(r[1]), int(r[2]))
                for r in _REF_PART.findall(a["assunto"] + " " + a["decisao"])]
        for sig, n, ano in refs:
            cid = f"{sig}-{n}-{ano}"
            if cid in cons and chave_ata(a) != cons[cid]["abertura"]["chave"]:
                cons[cid]["citacoes_numero"] += 1
        tf = TIPOS_FASE.get(a["tipo_ato"])
        if tf and _decidiu(a):
            sig = "CP" if tf[0].startswith("Consulta") else "AP"
            alvo = [f"{sig}-{n}-{ano}" for s, n, ano in refs if s == sig and f"{sig}-{n}-{ano}" in cons]
            if not alvo:
                n = _int(a["num_ato"])
                alvo = [cid for p in processos(a["processo"]) for cid in por_processo.get(p, ())
                        if cons[cid]["numero"] == n and cid.startswith(sig)]
            janelas = periodos_da_decisao(a["decisao"], a["data"])
            for cid in dict.fromkeys(alvo):
                cons[cid]["fases"].append({
                    "fase": tf[1], "data_deliberacao": a["data"], "reuniao": a["reuniao"],
                    "inicio": min((j["inicio"] for j in janelas), default=None),
                    "fim": max((j["fim"] for j in janelas), default=None), "janelas": len(janelas),
                    "trecho_periodo": " […] ".join(j["trecho"] for j in janelas) or None,
                    "duracao_dias": None if janelas else duracao_da_decisao(a["decisao"]), "sessao": None,
                    "chave": chave_ata(a)})
        m = _RESULTADO.search(a["assunto"])
        if m:
            sig = "CP" if m.group(1).lower().startswith("consulta") else "AP"
            cid = f"{sig}-{_int(m.group(2))}-{int(m.group(3))}"
            if cid in cons:
                n_ato = _int(a["num_ato"])
                ato = f"{a['tipo_ato']} nº {numero_ato(n_ato)}/{a['data'][:4]}" if a["tipo_ato"] and n_ato else None
                res = {"data": a["data"], "reuniao": a["reuniao"], "resultado_julgamento": a["resultado"],
                       "decidido": _decidiu(a), "ato": ato, "decisao": limpa_decisao(a["decisao"]), "chave": chave_ata(a),
                       "vinculo": "numero_citado"}
                atual = cons[cid]["resultado"]
                # a última deliberação decide; 'retirado de pauta' não apaga uma decisão já tomada
                if atual is None or (res["decidido"] or not atual["decidido"]):
                    cons[cid]["resultado"] = res
    # Resultado sem número citado ("Resultado da Revisão Tarifária Periódica de 2026 da ..."):
    # liga pelo número do processo, chave exata do SEI, quando um único aviso aberto antes
    # tem o mesmo processo e ainda não tem resultado pela citação explícita.
    for a in ordenadas:
        if not re.match(r"\s*Resultados?\b", a["assunto"]) or _RESULTADO.search(a["assunto"]):
            continue
        alvo = {cid for p in processos(a["processo"]) for cid in por_processo.get(p, ())
                if cons[cid]["abertura"]["data"] < a["data"]}
        alvo = [cid for cid in alvo if cons[cid]["resultado"] is None or cons[cid]["resultado"]["vinculo"] == "processo"]
        if len(alvo) != 1:
            continue
        cid = alvo[0]
        n_ato = _int(a["num_ato"])
        ato = f"{a['tipo_ato']} nº {numero_ato(n_ato)}/{a['data'][:4]}" if a["tipo_ato"] and n_ato else None
        res = {"data": a["data"], "reuniao": a["reuniao"], "resultado_julgamento": a["resultado"],
               "decidido": _decidiu(a), "ato": ato, "decisao": limpa_decisao(a["decisao"]), "chave": chave_ata(a),
               "vinculo": "processo"}
        atual = cons[cid]["resultado"]
        if atual is None or (res["decidido"] or not atual["decidido"]):
            cons[cid]["resultado"] = res
    return cons


def numero_ato(n):
    """1167 → '1.167' (como a ANEEL numera os atos)."""
    return f"{n:,}".replace(",", ".") if isinstance(n, int) else str(n)


SITUACOES = {
    "aberta": "Recebendo contribuições",
    "a_abrir": "Abertura deliberada, período ainda não começou",
    "encerrada_aguardando": "Contribuições encerradas, sem resultado deliberado em reunião pública registrada",
    "resultado_em_pauta": "Resultado levado à reunião, sem decisão (retirado de pauta ou pedido de vista)",
    "decidida": "Resultado deliberado pela Diretoria",
    "prazo_nao_datado": "A ata informa só a duração, sem data de encerramento; situação não derivável",
}


def fase_atual(consulta):
    """Fase deliberada por último (abertura, 2ª fase, reabertura ou prorrogação)."""
    return max(consulta["fases"], key=lambda f: (f["data_deliberacao"], f["fim"] or "")) if consulta["fases"] else None


def janela_vigente(consulta):
    """Janela datada da fase deliberada por último; None quando essa fase não traz datas
    (uma fase posterior sem data não deixa a janela anterior valer em seu lugar)."""
    f = fase_atual(consulta)
    return f if f and f.get("inicio") and f.get("fim") else None


def situacao(consulta, hoje):
    """Situação derivada da data `hoje` (AAAA-MM-DD, horário de Brasília). Regra única,
    repetida sem alteração em src/lib/energia/tipos-regulacao.ts (situacaoConsulta):
    1. resultado deliberado → decidida;
    2. fase deliberada por último sem datas → prazo_nao_datado (nunca 'aberta');
    3. hoje antes do início → a_abrir; entre início e fim (inclusive) → aberta;
    4. depois do fim: resultado levado à pauta sem decisão → resultado_em_pauta; senão
       encerrada_aguardando."""
    res = consulta.get("resultado")
    if res and res.get("decidido"):
        return "decidida"
    j = janela_vigente(consulta)
    if not j:
        return "prazo_nao_datado"
    if hoje < j["inicio"]:
        return "a_abrir"
    if hoje <= j["fim"]:
        return "aberta"
    return "resultado_em_pauta" if res else "encerrada_aguardando"


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

_ARQ_PRODIST = re.compile(r"a?ren(\d{4})(\d+)_Prodist_modulo_(\d+)_v(\d+)\.pdf", re.I)
_ARQ_PRORET = re.compile(r"Proret_Submod_([\dA-Z.]+?)_V_([\d.]+[A-Z]?)_a?ren(\d{4})(\d+)\.pdf", re.I)
_TITULO_PROC = re.compile(r"^(Módulo\s+\d+|Submódulo\s+[\d.]+\s?[A-Z]?)\s*[-–]\s*(.+?):?$")


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
            mp, mr = _ARQ_PRODIST.search(url), _ARQ_PRORET.search(url)
            if mp:
                atual["versao"], atual["ano_ato"] = f"v{mp.group(4)}", int(mp.group(1))
                atual["ato"] = f"Resolução Normativa nº {numero_ato(int(mp.group(2)))}/{mp.group(1)}"
            elif mr:
                atual["versao"], atual["ano_ato"] = mr.group(2), int(mr.group(3))
                atual["ato"] = f"Resolução Normativa nº {numero_ato(int(mr.group(4)))}/{mr.group(3)}"
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


def vigencias_bandeiras(linhas):
    """Tabela de vigências por patamar: cada valor vale da sua data até a véspera do
    próximo valor do mesmo patamar; o último fica sem fim (a fonte não informa término)."""
    por_patamar = {}
    for r in linhas:
        if r["vigencia_inicio"] and r["patamar"]:
            por_patamar.setdefault(r["patamar"], []).append(r)
    out = []
    for pat, rs in por_patamar.items():
        rs = sorted(rs, key=lambda x: x["vigencia_inicio"])
        for i, r in enumerate(rs):
            fim = None
            if i + 1 < len(rs):
                fim = (date.fromisoformat(rs[i + 1]["vigencia_inicio"]) - timedelta(days=1)).isoformat()
            out.append({**r, "vigencia_fim": fim})
    ordem = {p: i for i, p in enumerate(PATAMARES)}
    return sorted(out, key=lambda x: (x["vigencia_inicio"], ordem.get(x["patamar"], 99)))


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
