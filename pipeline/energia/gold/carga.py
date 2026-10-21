"""Gold de carga (ONS, Carga de Energia Diária).

Regras publicadas:
- carga do SIN (CALCULADO): soma das cargas dos quatro subsistemas no dia;
- comparação anual: média dos últimos 7 (ou 30) dias contra os mesmos dias do ano
  anterior, SÓ quando os dois períodos estão no mesmo regime metodológico do ONS;
- regimes metodológicos (declarados pelo ONS): até 28/02/2021; de 01/03/2021 a
  28/04/2023 (inclui previsão de usinas não despachadas); desde 29/04/2023 (inclui
  estimativa da micro e minigeração distribuída, MMGD).

Validação física com quarentena (antes de publicar): a captura de 29/09/2026 02:42 UTC
trouxe a carga do Nordeste de 26/09/2026 igual a −668,879 MWmed, e o SIN daquele dia
teria saído com 63.185 MWmed; a captura seguinte (30/09/2026 02:19 UTC) trouxe 13.984,7.
Nada no pipeline impedia a publicação do valor negativo. Agora cada valor diário passa
por três regras antes de entrar na série publicada:

- F1, domínio: o dicionário do ONS (Carga de Energia Diária, v1.2) diz que
  `val_cargaenergiamwmed` não admite nulo, zero nem negativo. Violação = quarentena,
  sempre (não há conferência que torne válido um valor fora do domínio);
- F2, faixa plausível: entre 50% do menor e 150% do maior valor aceito do mesmo
  subsistema nos 1.095 dias anteriores (só com pelo menos 365 dias de histórico);
- F3, salto: desvio maior que 40% da mediana dos 7 dias anteriores aceitos (só com pelo
  menos 5 dias).

Valor atípico não é descartado sem conferência, e a conferência precisa de um produto
independente (seção 11.7: "nunca use plausibilidade como substituto de comprovação"). A
média das 24 horas da Curva de Carga Horária NÃO serve: é o mesmo produto em outro grão
(a média reproduz o valor diário por construção) e repete qualquer erro do valor diário.
Foi o que aconteceu com o Nordeste em 25/08/2018 (3.969,8 MWmed, contra cerca de 10.300
nos dias vizinhos): a versão anterior desta regra publicou o dia como "atípico
conferido" porque a curva repetia o número, mas o Balanço de Energia nos Subsistemas do
ONS mostra que a geração eólica do Nordeste caiu de 6.686,7 MWmed (24/08) para 219,7
(25/08) e voltou a 6.305,7 (26/08), com a queda e a volta exatamente à meia-noite: é
lacuna de dado de geração, não carga real. A carga do balanço é a mesma (carga = Σ
geração − intercâmbio); os COMPONENTES são a informação independente.

Conferência C1 (balanço de energia, família `ons_carga`, dataset `ons_balanco_carga_conferencia`):
um valor que viola F2 ou F3 é confirmado só se (a) o balanço tem o dia e pelo menos um
dia vizinho, (b) nenhum componente de geração (hidráulica, térmica, eólica, solar) tem
lacuna no dia: média do dia abaixo de 25% do menor valor dos vizinhos, quando esse valor
é material (pelo menos 100 MWmed e 5% da carga dos vizinhos), e (c) a carga do balanço é
igual ao valor diário (até 0,5% ou 5 MWmed). Confirmado, é publicado como "atípico
conferido", com ressalva; sem confirmação (lacuna, balanço divergente ou sem balanço), fica
em quarentena: fora da série publicada (ausência, nunca zero nem valor anterior), com o
registro visível na gold. Calibração no histórico inteiro (2000 a 2026): quatro dias
violam F2 ou F3; os três do Sul (6 a 8/01/2015, volta ao nível normal depois do feriado
de fim de ano) são confirmados pelo balanço (componentes contínuos, a hidráulica sobe com
a carga); o do Nordeste em 25/08/2018 fica em quarentena pela lacuna da eólica.

Ausência: o dicionário diz que o valor diário não admite nulo, mas a fonte tem dias sem
valor (2013-12-01, 2014-02-01 e 2015-04-09 nos quatro subsistemas). A validação conta os
registros esperados (todo dia do calendário entre o primeiro e o último dia publicado, por
subsistema) e registra cada dia ausente com o estado conferido no arquivo atual da fonte
(célula vazia, linha ausente ou valor presente que o silver não tem). O CSV publica a
linha do dia com as células vazias, em vez de pular o dia.
"""
import os
import statistics
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS = "carga_energia_di"
DS_CURVA = "ons_curva_carga_ho"
DS_BALANCO = "ons_balanco_carga_conferencia"      # família ons_carga (módulo Carga)
DS_DIARIA_FONTE = "ons_carga_diaria_conferencia"  # família ons_carga (módulo Carga)
FAMILIA_CURVA = "ons_carga"
SMS = c.ORDEM_SM
GERACAO = ("hidraulica", "termica", "eolica", "solar")
NOME_COMPONENTE = {"hidraulica": "hidráulica", "termica": "térmica", "eolica": "eólica", "solar": "solar",
                   "carga": "carga", "intercambio": "intercâmbio"}
# Datas declaradas pelo ONS (notas do CKAN). A inclusão da MMGD declarada para 29/04/2023
# aparece nos dados em 01/05/2023 (módulo Carga, bloco a11_carga de carga_detalhe.json):
# 29 e 30/04/2023 são transição.
MMGD_DECLARADA = "2023-04-29"
MMGD_OBSERVADA = "2023-05-01"
REGIMES = [
    {"inicio": "2000-01-01", "fim": "2021-02-28",
     "descricao": "Carga atendida por usinas despachadas ou programadas pelo ONS."},
    {"inicio": "2021-03-01", "fim": "2023-04-28",
     "descricao": "Inclui a previsão de geração de usinas não despachadas pelo ONS."},
    {"inicio": "2023-04-29", "fim": None,
     "descricao": ("Inclui também a estimativa da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos. "
                   "Data declarada pelo ONS: 29/04/2023; nos dados, a MMGD aparece na carga em 01/05/2023 (29 e 30/04/2023 são transição)."),
     "observado_nos_dados": MMGD_OBSERVADA},
]
# Natureza por regime (seção 11.3): "publicado pelo ONS" não quer dizer medido. A carga é
# observada (medição e supervisão das usinas despachadas), mas desde 01/03/2021 a fonte
# soma a previsão de geração das usinas que não despacha, e desde a inclusão da MMGD soma
# uma estimativa feita com dados meteorológicos previstos.
COMPONENTE_PREVISTO = {"natureza": "PREVISTO", "desde": "2021-03-01",
                       "descricao": "previsão de geração das usinas não despachadas pelo ONS, somada pela fonte (não é medição)"}
COMPONENTE_MMGD = {"natureza": "ESTIMADO", "desde": MMGD_DECLARADA, "observado_nos_dados_desde": MMGD_OBSERVADA,
                   "descricao": ("estimativa da MMGD com base em dados meteorológicos previstos, somada pela fonte e não publicada "
                                 "separada (declarada pelo ONS a partir de 29/04/2023; observada nos dados a partir de 01/05/2023)")}
NATUREZA_POR_REGIME = [
    {"regime": 1, "inicio": "2000-01-01", "fim": "2021-02-28", "natureza": "OBSERVADO", "componentes": []},
    {"regime": 2, "inicio": "2021-03-01", "fim": "2023-04-28", "natureza": "OBSERVADO", "componentes": [COMPONENTE_PREVISTO]},
    {"regime": 3, "inicio": "2023-04-29", "fim": None, "natureza": "OBSERVADO", "componentes": [COMPONENTE_PREVISTO, COMPONENTE_MMGD]},
]
NATUREZA_RESUMO = ("Observado com componentes da fonte que não são medição: previsão de usinas não despachadas desde 01/03/2021 "
                   "(PREVISTO) e estimativa de MMGD desde 01/05/2023 nos dados (ESTIMADO; data declarada 29/04/2023).")
REGRAS = {
    "carga_sin": "Carga do SIN = soma das cargas diárias dos quatro subsistemas.",
    "comparacao_anual": "Média dos últimos 7 ou 30 dias contra os mesmos dias do ano anterior, apenas quando os dois períodos estão no mesmo regime metodológico declarado pelo ONS.",
    "extremo_12m": "Maior carga diária dos últimos 365 dias.",
    "validacao_fisica": "Valor diário só é publicado se for positivo (domínio do dicionário do ONS), estiver na faixa plausível do subsistema e não saltar mais de 40% sobre a mediana da semana anterior; atípico é conferido nos componentes do balanço de energia do ONS (outro conjunto) antes de ser publicado ou posto em quarentena; dia ausente fica vazio.",
}

# Limites documentados (ver docstring). Mudar um deles exige recalibrar no histórico.
FAIXA_JANELA_DIAS = 1095
FAIXA_MIN_HISTORICO = 365
FAIXA_FATOR_MIN = 0.5
FAIXA_FATOR_MAX = 1.5
SALTO_JANELA = 7
SALTO_MIN_DIAS = 5
SALTO_LIMITE = 0.40
CONFERENCIA_REL = 0.005
CONFERENCIA_ABS = 5.0
# Lacuna de componente no balanço: média do dia abaixo de 25% do menor vizinho, só
# quando o vizinho é material (componente pequeno oscila muito sem ser lacuna: a eólica
# do Sul em 2015 ia de 55 a 353 MWmed de um dia para o outro).
LACUNA_FATOR = 0.25
LACUNA_MIN_MWMED = 100.0
LACUNA_MIN_FRACAO = 0.05
REGRAS_VALIDACAO = [
    {"id": "F1", "tipo": "dominio", "critica": True,
     "descricao": "Carga diária precisa ser positiva: o dicionário de dados do ONS (Carga de Energia Diária, versão 1.2) não admite valor nulo, zero nem negativo em val_cargaenergiamwmed."},
    {"id": "F2", "tipo": "faixa_plausivel", "critica": False,
     "descricao": "Entre 50% do menor e 150% do maior valor aceito do mesmo subsistema nos 1.095 dias anteriores (exige 365 dias de histórico)."},
    {"id": "F3", "tipo": "salto", "critica": False,
     "descricao": "Desvio de até 40% em relação à mediana dos 7 dias anteriores aceitos do mesmo subsistema (exige 5 dias)."},
    {"id": "C1", "tipo": "conferencia", "critica": False,
     "descricao": ("Valor que viola F2 ou F3 é conferido no Balanço de Energia nos Subsistemas do ONS (outro conjunto): confirmado só se "
                   "nenhum componente de geração (hidráulica, térmica, eólica, solar) tem lacuna no dia (média abaixo de 25% do menor dia "
                   "vizinho, quando o vizinho tem pelo menos 100 MWmed e 5% da carga) e se a carga do balanço é igual ao valor (até 0,5% ou "
                   "5 MWmed); sem confirmação ou sem balanço, quarentena. A curva horária não confere: é o mesmo produto em outro grão.")},
    {"id": "A1", "tipo": "registros_esperados", "critica": False,
     "descricao": ("Todo dia do calendário entre o primeiro e o último dia publicado é esperado em cada subsistema; dia ausente é "
                   "registrado com o estado conferido no arquivo atual da fonte e publicado como célula vazia, nunca zero nem interpolado.")},
]


def regime_de(dia):
    for i, rg in enumerate(REGIMES):
        if rg["inicio"] <= dia and (rg["fim"] is None or dia <= rg["fim"]):
            return i
    return None


def em_transicao(dia):
    """Dias entre a inclusão da MMGD declarada e a observada nos dados (29 e 30/04/2023):
    nenhum dos dois regimes vale com segurança, então não entram em variação."""
    return MMGD_DECLARADA <= dia < MMGD_OBSERVADA


def _curva_diaria(con_curva, sm):
    """Média das 24 horas da curva (só informativa no registro: não confere nada)."""
    if con_curva is None:
        return {}
    try:
        return dict(base.serie_vigente(con_curva, DS_CURVA, f"media_dia.{sm}"))
    except Exception:  # família ainda sem a tabela ou sem o dataset
        return {}


def balanco_diario(con_fam, sm):
    """{dia: {componente: média diária MWmed}} do balanço de energia de um subsistema."""
    if con_fam is None:
        return {}
    out = {}
    try:
        for comp in ("hidraulica", "termica", "eolica", "solar", "carga", "intercambio"):
            for dia, v in base.serie_vigente(con_fam, DS_BALANCO, f"{comp}_dia.{sm}"):
                out.setdefault(dia, {})[comp] = v
    except Exception:  # família sem o dataset: sem conferência (e o atípico fica em quarentena)
        return {}
    return out


def _arred_comp(b):
    return {k: c.r(v, 1) for k, v in b.items()} if b else None


def confere_balanco(dia, valor, bal):
    """Conferência C1 de um valor diário atípico no balanço de energia (outro conjunto do
    ONS). Retorna (confirma, texto, detalhe). Ver a docstring do módulo para a regra."""
    x = c.d(dia)
    ant, seg = (x - timedelta(days=1)).isoformat(), (x + timedelta(days=1)).isoformat()
    b0 = bal.get(dia)
    viz = [bal[k] for k in (ant, seg) if k in bal]
    det = {"dia": _arred_comp(b0), "anterior": _arred_comp(bal.get(ant)), "seguinte": _arred_comp(bal.get(seg)),
           "lacunas": [], "geracao_menos_intercambio": None}
    if not b0 or not viz:
        return False, "sem balanço de energia do ONS para o dia e um dia vizinho: sem conferência independente", det
    cargas_viz = [v["carga"] for v in viz if v.get("carga") is not None]
    carga_ref = sum(cargas_viz) / len(cargas_viz) if cargas_viz else None
    for comp in GERACAO:
        vv = [v[comp] for v in viz if v.get(comp) is not None]
        if not vv or carga_ref is None:
            continue
        ref = min(vv)
        if ref < max(LACUNA_MIN_MWMED, LACUNA_MIN_FRACAO * carga_ref):
            continue
        v0 = b0.get(comp)
        if v0 is None or v0 < LACUNA_FATOR * ref:
            det["lacunas"].append({"componente": comp, "valor_dia": c.r(v0, 1), "vizinhos": [c.r(z, 1) for z in vv]})
    if all(b0.get(k) is not None for k in GERACAO + ("intercambio",)):
        det["geracao_menos_intercambio"] = c.r(sum(b0[k] for k in GERACAO) - b0["intercambio"], 1)
    if det["lacunas"]:
        partes = []
        for l in det["lacunas"]:
            vz = " e ".join(_br(z, 1) for z in l["vizinhos"])
            partes.append(f"{NOME_COMPONENTE[l['componente']]} {_br(l['valor_dia'], 1) if l['valor_dia'] is not None else 'ausente'} "
                          f"MWmed no dia contra {vz} nos dias vizinhos")
        return False, "lacuna de dado de geração no balanço do ONS (" + "; ".join(partes) + "): o valor não é carga real", det
    cb = b0.get("carga")
    if cb is None or abs(cb - valor) > max(CONFERENCIA_REL * abs(valor), CONFERENCIA_ABS):
        return False, (f"a carga do balanço ({_br(cb, 1) if cb is not None else 'ausente'} MWmed) não reproduz o valor diário: "
                       "sem confirmação"), det
    fech = det["geracao_menos_intercambio"]
    return True, ("componentes de geração do balanço do ONS sem lacuna no dia"
                  + (f"; geração menos intercâmbio = {_br(fech, 1)} MWmed, igual ao valor" if fech is not None else "")), det


def valida_serie(sm, serie, curva=None, balanco=None):
    """Aplica F1, F2, F3 e a conferência C1 (balanço de energia) a uma série {dia: valor}
    de um subsistema. `curva` (média das 24 horas da curva horária) entra só no registro.

    Retorna (aceitos {dia: valor}, ocorrencias [...]). A referência de F2 e F3 usa só
    valores já aceitos e anteriores ao dia (nada do futuro)."""
    curva = curva or {}
    balanco = balanco or {}
    aceitos, ocorrencias = {}, []
    hist = []  # (dia, valor) aceitos, em ordem
    for dia in sorted(serie):
        v = serie[dia]
        violadas = []
        if v is None or v <= 0:
            violadas.append("F1")
        else:
            d0 = c.d(dia)
            lim = (d0 - timedelta(days=FAIXA_JANELA_DIAS)).isoformat()
            ref = [x for k, x in hist[-(FAIXA_JANELA_DIAS + 5):] if k >= lim]
            if len(ref) >= FAIXA_MIN_HISTORICO and not (FAIXA_FATOR_MIN * min(ref) <= v <= FAIXA_FATOR_MAX * max(ref)):
                violadas.append("F2")
            prev = [x for _, x in hist[-SALTO_JANELA:]]
            if len(prev) >= SALTO_MIN_DIAS:
                med = statistics.median(prev)
                if med > 0 and abs(v / med - 1) > SALTO_LIMITE:
                    violadas.append("F3")
        if not violadas:
            aceitos[dia] = v
            hist.append((dia, v))
            continue
        cv = curva.get(dia)
        if "F1" in violadas:
            confirma, texto, det = False, "fora do domínio do dicionário do ONS: quarentena sem conferência", None
        else:
            confirma, texto, det = confere_balanco(dia, v, balanco)
        situacao = "atipico_conferido" if confirma else "quarentena"
        ocorrencias.append({"sm": sm, "dia": dia, "valor": v, "regras": violadas, "situacao": situacao,
                            "curva_horaria_media": c.r(cv, 3) if cv is not None else None,
                            "conferencia": texto, "balanco": det})
        if situacao == "atipico_conferido":
            aceitos[dia] = v
            hist.append((dia, v))
    return aceitos, ocorrencias


def historico_violacoes(con):
    """Valores fora do domínio (≤ 0) em QUALQUER vintage do silver, com a revisão
    posterior da fonte quando houve: é o registro de que o ONS publicou e corrigiu."""
    rows = con.execute(
        """SELECT o.serie, o.ref, o.valor, v.capturado_em, v.vintage_id, v.recurso FROM observacoes o
           JOIN vintages v ON v.vintage_id = o.vintage_id
           WHERE o.dataset=? AND o.valor <= 0 ORDER BY o.ref, o.serie""", (DS,)).fetchall()
    out = []
    for serie, ref, valor, cap, vid, rec in rows:
        depois = con.execute(
            """SELECT o.valor, v.capturado_em FROM observacoes o JOIN vintages v ON v.vintage_id = o.vintage_id
               WHERE o.dataset=? AND o.serie=? AND o.ref=? AND v.capturado_em > ? ORDER BY v.capturado_em LIMIT 1""",
            (DS, serie, ref, cap)).fetchone()
        out.append({"sm": serie.split(".")[-1], "dia": ref, "valor": valor, "capturado_em": cap, "vintage": vid,
                    "recurso": rec, "revisado_para": depois[0] if depois else None,
                    "revisado_em": depois[1] if depois else None,
                    "situacao": "revisado_pela_fonte" if depois and depois[0] > 0 else "vigente_em_quarentena"})
    return out


def _dias_entre(ini, fim):
    x, f = c.d(ini), c.d(fim)
    out = []
    while x <= f:
        out.append(x.isoformat())
        x += timedelta(days=1)
    return out


def estados_ausencia(con_fam, ausentes):
    """Estado de cada (sm, dia) ausente da série, conferido no arquivo atual da fonte
    (família ons_carga): célula vazia, linha ausente, valor presente no arquivo atual
    (o silver principal não o tem) ou não conferido (ano sem arquivo capturado)."""
    if con_fam is None or not ausentes:
        return {k: ("nao_conferido", None) for k in ausentes}
    try:
        vazias = {ch for ch, campos in base.registros_como_estavam_em(con_fam, DS_DIARIA_FONTE).items() if campos.get("celula_vazia") == "1"}
        anos = set()
        for v in base.vintages_do_dataset(con_fam, DS_DIARIA_FONTE):
            nome = (v.get("url") or "").rsplit("/", 1)[-1]
            if nome.startswith("CARGA_ENERGIA_") and nome[14:18].isdigit():
                anos.add(nome[14:18])
        valores = {sm: dict(base.serie_vigente(con_fam, DS_DIARIA_FONTE, f"carga_mwmed.{sm}")) for sm in SMS}
    except Exception:
        return {k: ("nao_conferido", None) for k in ausentes}
    out = {}
    for sm, dia in ausentes:
        if f"{sm}|{dia}" in vazias:
            out[(sm, dia)] = ("celula_vazia_na_fonte", None)
        elif dia in valores.get(sm, {}):
            out[(sm, dia)] = ("presente_no_arquivo_atual", valores[sm][dia])
        elif dia[:4] in anos:
            out[(sm, dia)] = ("linha_ausente_na_fonte", None)
        else:
            out[(sm, dia)] = ("nao_conferido", None)
    return out


def validacao_fisica(con, con_curva=None):
    """Séries aceitas por subsistema e o registro publicado da validação."""
    brutas = {sm: dict(base.serie_vigente(con, DS, f"carga_mwmed.{sm}")) for sm in SMS}
    aceitos, ocorrencias = {}, []
    for sm in SMS:
        a, o = valida_serie(sm, brutas[sm], _curva_diaria(con_curva, sm), balanco_diario(con_curva, sm))
        aceitos[sm] = a
        ocorrencias += o
    # registros esperados (A1): todo dia entre o primeiro e o último publicados
    com_dado = [s for s in brutas.values() if s]
    esperados, ausentes = {}, []
    if com_dado:
        ini, fim = min(min(s) for s in com_dado), max(max(s) for s in com_dado)
        calendario = _dias_entre(ini, fim)
        for sm in SMS:
            falta = [d for d in calendario if d not in brutas[sm]]
            ausentes += [(sm, d) for d in falta]
            esperados[sm] = {"inicio": ini, "fim": fim, "esperados": len(calendario), "presentes": len(calendario) - len(falta),
                             "ausentes": len(falta), "quarentena": sum(1 for o in ocorrencias if o["sm"] == sm and o["situacao"] == "quarentena")}
    estados = estados_ausencia(con_curva, ausentes)
    return {
        "aceitos": aceitos, "brutas": brutas,
        "registro": {
            "regras": REGRAS_VALIDACAO,
            "quarentena": [o for o in ocorrencias if o["situacao"] == "quarentena"],
            "atipicos_conferidos": [o for o in ocorrencias if o["situacao"] == "atipico_conferido"],
            "historico_fora_do_dominio": historico_violacoes(con),
            "valores_verificados": sum(len(s) for s in brutas.values()),
            "registros_esperados": esperados,
            "ausentes": [{"sm": sm, "dia": d, "estado": estados[(sm, d)][0],
                          "valor_arquivo_atual": c.r(estados[(sm, d)][1], 3) if estados[(sm, d)][1] is not None else None}
                         for sm, d in sorted(ausentes, key=lambda x: (x[1], SMS.index(x[0])))],
        },
    }


def _br(v, casas):
    """Número no formato brasileiro (milhar com ponto, decimal com vírgula, menos tipográfico)."""
    txt = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("\u2212" if v < 0 else "") + txt


def _texto_ocorrencia(h):
    txt = (f"A captura de {c.carimbo_br(h['capturado_em'])} trouxe a carga do {c.NOME_SUBMERCADO[h['sm']]} de {c.data_br(h['dia'])} "
           f"igual a {_br(h['valor'], 3)} MWmed, fora do domínio do dicionário do ONS; o valor não entra na publicação")
    if h["revisado_para"] is not None:
        txt += f", e a fonte o revisou para {_br(h['revisado_para'], 1)} MWmed na captura de {c.carimbo_br(h['revisado_em'])}."
    else:
        txt += " e segue em quarentena."
    return txt


def construir(con):
    con_curva = None
    try:
        caminho = os.path.join(base.SILVER, f"{FAMILIA_CURVA}.db")
        if os.path.exists(caminho):
            con_curva = base.conecta_familia(FAMILIA_CURVA)
        val = validacao_fisica(con, con_curva)
    finally:
        if con_curva is not None:
            con_curva.close()
    carga = val["aceitos"]
    if not all(carga.values()):
        return c.stub("carga.json", "carga ausente no silver para algum subsistema")
    snap = c.snapshot_de(con, DS)
    todos_dias = sorted(set.union(*(set(s) for s in carga.values())))
    dias_sin = [k for k in todos_dias if all(k in carga[sm] for sm in SMS)]
    carga["SIN"] = {k: sum(carga[sm][k] for sm in SMS) for k in dias_sin}
    dia_ref = dias_sin[-1]
    fim = c.d(dia_ref)
    todos = SMS + ("SIN",)

    def janela(n, ano_desloc=0):
        ks = []
        for i in range(n):
            x = fim - timedelta(days=i)
            if ano_desloc:
                try:
                    x = x.replace(year=x.year - ano_desloc)
                except ValueError:
                    return None
            ks.append(x.isoformat())
        return ks

    def comparacao(sm, n):
        atual, ant = janela(n), janela(n, 1)
        if ant is None or not all(k in carga[sm] for k in atual + ant):
            return None
        mesmo = (regime_de(min(ant)) == regime_de(max(atual)) and regime_de(min(atual)) == regime_de(max(ant))
                 and not any(em_transicao(k) for k in atual + ant))
        ma, mb = c.media([carga[sm][k] for k in atual]), c.media([carga[sm][k] for k in ant])
        return {
            "media": c.r(ma, 0), "media_ano_anterior": c.r(mb, 0),
            "variacao_pct": c.r(100 * (ma / mb - 1), 1) if mesmo and mb else None,
            "mesmo_regime": mesmo,
            "inicio": min(atual), "fim": max(atual), "inicio_anterior": min(ant), "fim_anterior": max(ant),
        }

    subs = []
    for sm in todos:
        ult365 = [(k, carga[sm][k]) for k in janela(365) if k in carga[sm]]
        kmax, vmax = max(ult365, key=lambda x: x[1])
        subs.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm],
            "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
            "dia": c.r(carga[sm][dia_ref], 0),
            "ult7": comparacao(sm, 7),
            "ult30": comparacao(sm, 30),
            "max_12m": {"valor": c.r(vmax, 0), "dia": kmax},
        })
    ini = (fim - timedelta(days=3 * 365)).isoformat()
    # todo dia do calendário tem linha: dia em quarentena ou ausente na fonte fica vazio no
    # subsistema e no SIN (ausência visível, nunca zero nem interpolação)
    calendario = _dias_entre(todos_dias[0], dia_ref)
    serie = [{"d": k, **{sm: c.r(carga[sm].get(k), 0) for sm in todos}} for k in calendario if ini <= k]
    mensal = {}
    for k in todos_dias:
        if k <= dia_ref:
            mensal.setdefault(k[:7], []).append(k)
    serie_mensal = [{"m": m, "dias": sum(1 for k in ks if k in carga["SIN"]),
                     **{sm: c.r(c.media([carga[sm][k] for k in ks if k in carga[sm]]), 0) for sm in todos}}
                    for m, ks in sorted(mensal.items())]
    # CSV: uma linha por dia do calendário; célula vazia = ausência (quarentena ou ausente na fonte)
    base.escreve_csv("carga_diaria.csv", ["data", "SE", "S", "NE", "N", "SIN_calculado"],
                     [[k] + [carga[sm].get(k) for sm in todos] for k in calendario])
    meta = c.meta_ons(DS)
    reg = val["registro"]
    lim = [
        ("O ONS mudou o conteúdo da série em 01/03/2021 (previsão de usinas não despachadas) e na inclusão da estimativa de MMGD, "
         "declarada para 29/04/2023 e observada nos dados em 01/05/2023; comparações que atravessam essas datas (ou tocam 29 e "
         "30/04/2023, transição) não são homogêneas e não são exibidas como variação."),
        "Dados em processo de consistência recorrente do ONS, sujeitos a revisão após a publicação.",
        NATUREZA_RESUMO,
    ]
    ressalvas = [_texto_ocorrencia(h) for h in reg["historico_fora_do_dominio"]]
    for q in reg["quarentena"]:
        ressalvas.append(f"Em quarentena: carga do {c.NOME_SUBMERCADO[q['sm']]} em {c.data_br(q['dia'])} ({_br(q['valor'], 3)} MWmed), regras "
                         f"{', '.join(q['regras'])}; {q['conferencia']}. O dia fica sem valor para o subsistema e para o SIN.")
    if reg["atipicos_conferidos"]:
        ressalvas.append(f"{len(reg['atipicos_conferidos'])} valores atípicos (regras F2 ou F3) foram publicados porque o balanço de energia do ONS "
                         "(outro conjunto) os confirma, sem lacuna de geração: "
                         + "; ".join(f"{a['sm']} em {c.data_br(a['dia'])}" for a in reg["atipicos_conferidos"]) + ".")
    dias_aus = sorted({a["dia"] for a in reg["ausentes"]})
    if dias_aus:
        estados = sorted({a["estado"] for a in reg["ausentes"]})
        ressalvas.append(f"{len(reg['ausentes'])} valores diários ausentes na fonte em {len(dias_aus)} dias ("
                         + ", ".join(c.data_br(d) for d in dias_aus[:8]) + (" e outros" if len(dias_aus) > 8 else "")
                         + f"; estado conferido no arquivo atual: {', '.join(e.replace('_', ' ') for e in estados)}); "
                         "ficam vazios, nunca zero nem interpolados.")
    prov = c.proveniencia(
        indicador="Carga de energia diária por subsistema", natureza="OBSERVADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed", frequencia="diária", periodo={"inicio": todos_dias[0], "fim": dia_ref},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em=max((x["publicado_em"] or "" for x in snap["capturas"]), default=None) or None,
        transformacoes=["validação física antes da publicação (domínio, faixa plausível, salto) com conferência no balanço de energia do ONS e quarentena",
                        "uma linha por dia do calendário: dia ausente na fonte ou em quarentena fica vazio"],
        limitacoes=lim + ressalvas, download="/energia/series/carga_diaria.csv", notas_fonte=meta.get("notas"),
    )
    prov_sin = c.proveniencia(
        indicador="Carga do SIN e variação anual", natureza="CALCULADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed e %", frequencia="diária", periodo={"inicio": todos_dias[0], "fim": dia_ref},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["soma dos quatro subsistemas (só em dia com os quatro aceitos pela validação física)",
                        "médias móveis de 7 e 30 dias", "comparação com os mesmos dias do ano anterior"],
        formula="variação = média(últimos n dias) ÷ média(mesmos n dias do ano anterior) − 1",
        limitacoes=lim + ressalvas + ["Temperatura, dias úteis e feriados afetam a carga e não são ajustados aqui; comparações com os mesmos dias da semana e a decomposição por clima e calendário estão em carga_detalhe.json."],
    )
    prov_mensal = c.proveniencia(
        indicador="Carga média mensal do SIN e dos subsistemas", natureza="CALCULADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed", frequencia="mensal", periodo={"inicio": todos_dias[0][:7], "fim": dia_ref[:7]},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["média aritmética dos valores diários aceitos do mês", "SIN: soma dos quatro subsistemas em cada dia"],
        formula="carga_mensal(s, m) = média de carga(s, d) para os dias d do mês m com dado aceito; o mês corrente é parcial",
        limitacoes=lim + ressalvas + ["Médias de meses em regimes metodológicos diferentes não são comparáveis diretamente."],
    )
    # natureza por regime (seção 11.3): a carga publicada mistura medição e componentes
    # previstos e estimados pela fonte; o campo `natureza` fica com a base observada
    prov["natureza_por_regime"] = NATUREZA_POR_REGIME
    prov_sin["natureza_por_regime"] = NATUREZA_POR_REGIME
    prov_mensal["natureza_por_regime"] = NATUREZA_POR_REGIME
    return {
        **c.cabecalho("carga.json"),
        "dia_referencia": dia_ref, "unidade": "MWmed",
        "regras": REGRAS, "regimes": REGIMES,
        "subsistemas": subs, "serie": serie, "mensal": serie_mensal,
        "validacao": {k: v for k, v in reg.items()},
        "proveniencia": {"carga": prov, "sin": prov_sin, "mensal": prov_mensal},
        "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "Carga diária por subsistema e SIN (CSV)", "url": "/energia/series/carga_diaria.csv"}],
    }
