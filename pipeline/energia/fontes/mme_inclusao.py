"""Leitor do conjunto "Luz para Todos" do portal de dados abertos do MME.

Fonte: https://dadosabertos.mme.gov.br/dataset/luz-para-todos (CKAN do Ministério de
Minas e Energia, licença declarada "Outra (Aberta)"), conferido em 30/09/2026:

1. domicilios_atendidos.csv: uma linha por lote de atendimento homologado, com
   programa ("LPT - Rural", "LPT - Regiões Remotas da Amazônia Legal", "Recurso da
   Distribuidora"), quantidade de DOMICÍLIOS atendidos (ligações novas, não pessoas nem
   unidades consumidoras com benefício), mês e ano do atendimento, município e estado
   por NOME (sem código IBGE) e a data de homologação. Latin-1, ';', CRLF.
2. recursos_aplicados.csv: uma linha por contrato do programa, com valores contratados
   e pagos por fonte (subvenção da CDE, empréstimo da RGR, Caixa ou outras fontes,
   contrapartida do agente executor), meses da primeira e da última liberação e o
   estado. Números no formato brasileiro ("53.772.800,00").

Armadilha do dicionário (dicionario-de-dados-template_v1.2lpt.pdf): descreve
vlrpagocaixa como "Valor pago da RGR" e vlrpago como "Valor da participação do Agente
Executor". O módulo segue a correspondência dos campos contratados (caixa com caixa,
contrapartida com vlrpago) e registra a divergência do dicionário no documento.

O arquivo não tem código IBGE de município: o vínculo com o código usa o nome exato,
sem acento, sem pontuação e sem espaços, dentro da mesma UF, contra a lista de municípios
do Cadastro Único (MDS, código IBGE); nome sem correspondência exata fica sem código e é
contado no diagnóstico (nada de semelhança aproximada).
"""
import re
import unicodedata

URL_PORTAL = "https://dadosabertos.mme.gov.br"
PACOTE = "luz-para-todos"
URL_DATASET = URL_PORTAL + "/dataset/" + PACOTE
URL_PACKAGE_SHOW = URL_PORTAL + "/api/3/action/package_show?id=" + PACOTE
LICENCA = "Outra (Aberta), conforme o campo de licença do portal de dados abertos do MME"

# chaves já normalizadas (normaliza_nome troca o hífen por espaço): "LPT - Rural" → "LPT RURAL"
PROGRAMAS = {
    "LPT RURAL": "rural",
    "LPT REGIOES REMOTAS DA AMAZONIA LEGAL": "regioes_remotas",
    "RECURSO DA DISTRIBUIDORA": "recurso_distribuidora",
}
PROGRAMA_ROTULO = {"rural": "Luz para Todos: rural", "regioes_remotas": "Luz para Todos: regiões remotas da Amazônia Legal",
                   "recurso_distribuidora": "Recurso da distribuidora"}

ESTADOS = {"ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM", "BAHIA": "BA", "CEARA": "CE",
           "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", "GOIAS": "GO", "MARANHAO": "MA", "MATO GROSSO": "MT",
           "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG", "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR",
           "PERNAMBUCO": "PE", "PIAUI": "PI", "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN",
           "RIO GRANDE DO SUL": "RS", "RONDONIA": "RO", "RORAIMA": "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP",
           "SERGIPE": "SE", "TOCANTINS": "TO"}

CAMPOS_DOMICILIOS = ("programa", "qtddomicilios", "mes", "ano", "municipio", "estado", "DtHomologacao")
CAMPOS_RECURSOS = ("contrato", "vlrempenhadocde", "vlrempenhadorgr", "vlrempenhadocaixa", "vlrempenhadoae",
                   "vlrpagocde", "vlrpagorgr", "vlrpagocaixa", "vlrpago", "mespi", "anopi", "mesup", "anoup", "estado")
# campo do arquivo → (fonte, situação) usado na gold
VALORES_RECURSOS = {
    "vlrempenhadocde": ("cde", "contratado"), "vlrpagocde": ("cde", "pago"),
    "vlrempenhadorgr": ("rgr", "contratado"), "vlrpagorgr": ("rgr", "pago"),
    "vlrempenhadocaixa": ("caixa_outras", "contratado"), "vlrpagocaixa": ("caixa_outras", "pago"),
    "vlrempenhadoae": ("agente_executor", "contratado"), "vlrpago": ("agente_executor", "pago"),
}


def normaliza_nome(s):
    """Nome sem acento, em maiúsculas, com pontuação trocada por espaço e espaços únicos.
    'Santa Bárbara d'Oeste' → 'SANTA BARBARA D OESTE'."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^A-Za-z0-9]+", " ", s).strip().upper()
    return re.sub(r"\s+", " ", s)


def uf_do_estado(nome):
    return ESTADOS.get(normaliza_nome(nome))


def programa_id(nome):
    return PROGRAMAS.get(normaliza_nome(nome))


def _inteiro(s):
    s = str(s or "").strip()
    return int(s) if re.fullmatch(r"\d+", s) else None


def valor_br(s):
    """'53.772.800,00' → 53772800.0; vazio ou ilegível → None (ausência, nunca zero)."""
    s = str(s or "").strip()
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def agrega_domicilios(linhas):
    """Linhas (dicts) de domicilios_atendidos.csv → agregados e diagnóstico.

    mensal: {(uf, programa, 'AAAA-MM'): domicílios}; municipal: {(uf, nome_normalizado,
    programa, 'AAAA'): domicílios}; nomes: {(uf, nome_normalizado): nome como veio}.
    Linha com quantidade não inteira, mês fora de 1 a 12, estado ou programa desconhecido
    não entra em nenhum agregado e fica contada no diagnóstico."""
    mensal, municipal, nomes = {}, {}, {}
    diag = {"linhas": 0, "linhas_usadas": 0, "quantidade_invalida": 0, "data_invalida": 0,
            "estado_desconhecido": {}, "programa_desconhecido": {}, "cabecalho_faltando": [],
            "domicilios": 0, "homologacao_mais_recente": None}
    primeira = True
    for r in linhas:
        if primeira:
            diag["cabecalho_faltando"] = [c for c in CAMPOS_DOMICILIOS if c not in r]
            primeira = False
        diag["linhas"] += 1
        q = _inteiro(r.get("qtddomicilios"))
        if q is None:
            diag["quantidade_invalida"] += 1
            continue
        ano, mes = _inteiro(r.get("ano")), _inteiro(r.get("mes"))
        if ano is None or mes is None or not 1 <= mes <= 12 or not 1990 <= ano <= 2100:
            diag["data_invalida"] += 1
            continue
        uf = uf_do_estado(r.get("estado"))
        if uf is None:
            e = (r.get("estado") or "").strip()
            diag["estado_desconhecido"][e] = diag["estado_desconhecido"].get(e, 0) + 1
            continue
        prog = programa_id(r.get("programa"))
        if prog is None:
            p = (r.get("programa") or "").strip()
            diag["programa_desconhecido"][p] = diag["programa_desconhecido"].get(p, 0) + 1
            continue
        ref = f"{ano:04d}-{mes:02d}"
        mensal[(uf, prog, ref)] = mensal.get((uf, prog, ref), 0) + q
        nome = (r.get("municipio") or "").strip()
        nn = normaliza_nome(nome)
        municipal[(uf, nn, prog, f"{ano:04d}")] = municipal.get((uf, nn, prog, f"{ano:04d}"), 0) + q
        nomes.setdefault((uf, nn), nome)
        diag["linhas_usadas"] += 1
        diag["domicilios"] += q
        h = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", (r.get("DtHomologacao") or "").strip())
        if h:
            iso = f"{h.group(3)}-{h.group(2)}-{h.group(1)}"
            if diag["homologacao_mais_recente"] is None or iso > diag["homologacao_mais_recente"]:
                diag["homologacao_mais_recente"] = iso
    return {"mensal": mensal, "municipal": municipal, "nomes": nomes}, diag


def le_recursos(linhas):
    """Linhas de recursos_aplicados.csv → (contratos, diagnóstico). Cada contrato:
    {contrato, uf, inicio 'AAAA-MM'|None, fim 'AAAA-MM'|None, valores {campo: R$|None}}."""
    out = []
    diag = {"linhas": 0, "estado_desconhecido": 0, "cabecalho_faltando": []}
    primeira = True
    for r in linhas:
        if primeira:
            diag["cabecalho_faltando"] = [c for c in CAMPOS_RECURSOS if c not in r]
            primeira = False
        diag["linhas"] += 1
        uf = uf_do_estado(r.get("estado"))
        if uf is None:
            diag["estado_desconhecido"] += 1
            continue

        def am(a, m):
            a, m = _inteiro(r.get(a)), _inteiro(r.get(m))
            return f"{a:04d}-{m:02d}" if a and m and 1 <= m <= 12 else None
        out.append({"contrato": (r.get("contrato") or "").strip(), "uf": uf, "inicio": am("anopi", "mespi"),
                    "fim": am("anoup", "mesup"), "valores": {c: valor_br(r.get(c)) for c in VALORES_RECURSOS}})
    return out, diag


def chave_nome(s):
    """Chave de comparação: nome normalizado sem nenhum espaço. Resolve de forma exata o
    apóstrofo que o arquivo do MME omite ('Machadinho Doeste' e 'MACHADINHO D'OESTE' dão
    'MACHADINHODOESTE'); nome trocado ou grafado de outro jeito (Parati e Paraty) continua
    sem correspondência, de propósito."""
    return normaliza_nome(s).replace(" ", "")


def indice_municipios(pares):
    """[(cod6, nome, uf)] → {(uf, chave_nome): cod6}; chave repetida na mesma UF
    (não acontece no cadastro do IBGE, mas não se presume) fica fora do índice."""
    idx, repetidos = {}, set()
    for cod, nome, uf in pares:
        k = (uf, chave_nome(nome))
        if k in idx and idx[k] != cod:
            repetidos.add(k)
        idx[k] = cod
    for k in repetidos:
        idx.pop(k, None)
    return idx
