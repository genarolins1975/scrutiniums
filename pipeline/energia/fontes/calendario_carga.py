"""Calendário oficial usado pelo módulo de Carga: feriados nacionais por lei federal,
Sexta-feira da Paixão e pontos facultativos federais, com a base legal de cada um.

Por que existe: comparar a carga de dois períodos só é justo quando os dois têm a mesma
composição de dias (dias úteis, fins de semana e feriados). A lista não é "a que todo
mundo conhece": cada data vem de uma lei federal identificada no portal de Legislação
Federal do Senado (metadados abertos em legis.senado.leg.br/dadosabertos, guardados no
bronze a cada coleta), e o que não é feriado por lei fica numa categoria separada.

- Feriados nacionais (Lei nº 662/1949, com a redação da Lei nº 10.607/2002): 1º/1,
  21/4, 1º/5, 7/9, 2/11, 15/11 e 25/12; 12/10 pela Lei nº 6.802/1980; 20/11 pela Lei
  nº 14.759/2023 (a partir de 2024).
- Sexta-feira da Paixão: feriado religioso da Lei nº 9.093/1995 (art. 2º, dias de guarda
  declarados em lei municipal, "neste incluída a Sexta-Feira da Paixão"); a portaria
  anual do governo federal a lista entre os feriados nacionais. O texto do art. 2º não
  pôde ser relido nesta integração (Planalto sem resposta e publicação do Senado vazia
  em 30/09/2026): a categoria fica separada e declarada.
- Pontos facultativos federais (portaria anual do ministério responsável pela gestão do
  serviço público federal, não lei): segunda e terça de Carnaval, Quarta-feira de Cinzas e
  Corpus Christi. Não são feriados nacionais; entram como variáveis próprias.

Datas móveis pelo domingo de Páscoa (algoritmo gregoriano anônimo): Carnaval = Páscoa −
48 e − 47 dias, Cinzas = − 46, Paixão = − 2, Corpus Christi = + 60.
A lista vale de 2003 em diante (depois da Lei nº 10.607/2002); datas anteriores não são
classificadas (a função devolve None) e não entram em análise que dependa do calendário.
"""
from datetime import date, timedelta

URL_SENADO_LISTA = "https://legis.senado.leg.br/dadosabertos/legislacao/lista.json?tipo=LEI&numero={numero}&ano={ano}"
URL_SENADO_NORMA = "https://legis.senado.leg.br/dadosabertos/legislacao/{id}"
LICENCA_SENADO = ("Texto normativo e metadados de legislação federal: domínio público (Lei nº 9.610/1998, art. 8º, IV), "
                  "portal de Legislação Federal do Senado")
PRIMEIRO_ANO = 2003

# Leis consultadas no Senado (número, ano) e o que cada uma estabelece neste módulo.
LEIS = [
    {"id": "lei_662_1949", "numero": 662, "ano": 1949, "norma": "LEI-662-1949-04-06",
     "estabelece": "feriados nacionais de 1º/1, 1º/5, 7/9, 15/11 e 25/12 (redação original)"},
    {"id": "lei_10607_2002", "numero": 10607, "ano": 2002, "norma": "LEI-10607-2002-12-19",
     "estabelece": "nova redação do art. 1º da Lei nº 662/1949: 1º/1, 21/4, 1º/5, 7/9, 2/11, 15/11 e 25/12"},
    {"id": "lei_6802_1980", "numero": 6802, "ano": 1980, "norma": "LEI-6802-1980-06-30",
     "estabelece": "feriado nacional de 12/10 (Nossa Senhora Aparecida)"},
    {"id": "lei_14759_2023", "numero": 14759, "ano": 2023, "norma": "LEI-14759-2023-12-21",
     "estabelece": "feriado nacional de 20/11 (Dia Nacional de Zumbi e da Consciência Negra)"},
    {"id": "lei_9093_1995", "numero": 9093, "ano": 1995, "norma": "LEI-9093-1995-09-12",
     "estabelece": "feriados religiosos declarados em lei municipal, incluída a Sexta-Feira da Paixão"},
]

FIXOS = [  # (mês, dia, nome, lei, ano inicial)
    (1, 1, "Confraternização Universal", "lei_10607_2002", PRIMEIRO_ANO),
    (4, 21, "Tiradentes", "lei_10607_2002", PRIMEIRO_ANO),
    (5, 1, "Dia do Trabalho", "lei_10607_2002", PRIMEIRO_ANO),
    (9, 7, "Independência do Brasil", "lei_10607_2002", PRIMEIRO_ANO),
    (10, 12, "Nossa Senhora Aparecida", "lei_6802_1980", PRIMEIRO_ANO),
    (11, 2, "Finados", "lei_10607_2002", PRIMEIRO_ANO),
    (11, 15, "Proclamação da República", "lei_10607_2002", PRIMEIRO_ANO),
    (11, 20, "Dia Nacional de Zumbi e da Consciência Negra", "lei_14759_2023", 2024),
    (12, 25, "Natal", "lei_10607_2002", PRIMEIRO_ANO),
]

NOMES_DIA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]


def pascoa(ano):
    """Domingo de Páscoa (calendário gregoriano, algoritmo anônimo de Meeus/Jones/Butcher)."""
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    mes, dia = divmod(h + l_ - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)


def eventos_do_ano(ano):
    """[(data, nome, categoria, base)] do ano. Categorias: feriado_nacional (lei),
    paixao (Lei nº 9.093/1995), ponto_facultativo (portaria anual, não lei)."""
    if ano < PRIMEIRO_ANO:
        return []
    out = [(date(ano, m, d), nome, "feriado_nacional", lei) for m, d, nome, lei, desde in FIXOS if ano >= desde]
    p = pascoa(ano)
    out.append((p - timedelta(days=2), "Sexta-feira da Paixão", "paixao", "lei_9093_1995"))
    out.append((p - timedelta(days=48), "Carnaval (segunda-feira)", "ponto_facultativo", "portaria_anual"))
    out.append((p - timedelta(days=47), "Carnaval (terça-feira)", "ponto_facultativo", "portaria_anual"))
    out.append((p - timedelta(days=46), "Quarta-feira de Cinzas (até as 14h)", "ponto_facultativo", "portaria_anual"))
    out.append((p + timedelta(days=60), "Corpus Christi", "ponto_facultativo", "portaria_anual"))
    return sorted(out)


_CACHE = {}


def _mapa(ano):
    if ano not in _CACHE:
        _CACHE[ano] = {d: (nome, cat, base) for d, nome, cat, base in eventos_do_ano(ano)}
    return _CACHE[ano]


def evento(dia):
    """(nome, categoria, base) do dia, ou None. Aceita date ou texto ISO."""
    x = dia if isinstance(dia, date) else date.fromisoformat(str(dia)[:10])
    return _mapa(x.year).get(x)


def classifica(dia):
    """Classe do dia para comparações e perfis:
    'util' (segunda a sexta sem feriado, Paixão nem Carnaval), 'sabado',
    'domingo_feriado' (domingo, feriado nacional, Paixão, segunda e terça de Carnaval).
    Cinzas e Corpus Christi (meio expediente ou facultativo) contam como útil aqui e
    ficam marcados à parte no modelo. None antes de 2003 (calendário não classificado)."""
    x = dia if isinstance(dia, date) else date.fromisoformat(str(dia)[:10])
    if x.year < PRIMEIRO_ANO:
        return None
    ev = evento(x)
    if ev and (ev[1] in ("feriado_nacional", "paixao") or ev[0].startswith("Carnaval")):
        return "domingo_feriado"
    wd = x.weekday()
    if wd == 6:
        return "domingo_feriado"
    if wd == 5:
        return "sabado"
    return "util"


def composicao(dias):
    """Contagem por dia da semana e por classe, e os eventos oficiais no conjunto de dias."""
    semana = [0] * 7
    classes = {"util": 0, "sabado": 0, "domingo_feriado": 0, "sem_classe": 0}
    eventos = []
    for d in dias:
        x = d if isinstance(d, date) else date.fromisoformat(str(d)[:10])
        semana[x.weekday()] += 1
        cl = classifica(x)
        classes[cl or "sem_classe"] += 1
        ev = evento(x) if x.year >= PRIMEIRO_ANO else None
        if ev:
            eventos.append({"data": x.isoformat(), "nome": ev[0], "categoria": ev[1], "dia_semana": NOMES_DIA[x.weekday()]})
    return {"dias_semana": semana, "classes": classes, "eventos": eventos}


def feriados_em_dia_util(dias):
    """Feriados por lei (e Paixão) que caíram de segunda a sexta nos dias dados."""
    out = []
    for d in dias:
        x = d if isinstance(d, date) else date.fromisoformat(str(d)[:10])
        ev = evento(x) if x.year >= PRIMEIRO_ANO else None
        if ev and ev[1] in ("feriado_nacional", "paixao") and x.weekday() < 5:
            out.append(x.isoformat())
    return out


def confere_senado(lei, dado):
    """Confere a resposta do Senado (JSON de /dadosabertos/legislacao/lista) com a lei
    esperada: mesma norma e ementa não vazia. Retorna (ok, ementa, id_senado)."""
    try:
        docs = dado["ListaDocumento"]["documentos"]["documento"]
    except (KeyError, TypeError):
        return False, None, None
    if isinstance(docs, dict):
        docs = [docs]
    for d in docs:
        if d.get("norma") == lei["norma"]:
            return bool(d.get("ementa")), d.get("ementa"), d.get("id")
    return False, None, None
