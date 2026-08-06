"""Gold presenca_mun.json — que tipo de presença bancária existe em cada município.

Junta, no nível do município, os dois cadastros do BC já coletados: dependências
próprias das instituições (agências, postos de atendimento, postos eletrônicos)
e correspondentes contratados. O resultado responde a pergunta que os agregados
nacionais não respondem: *no meu município, existe o quê?*

A classificação é deliberadamente grosseira e ordenada por profundidade do
atendimento, porque é isso que a fonte sustenta:

- **agencia** — há ao menos uma agência.
- **posto** — não há agência, mas há posto de atendimento ou posto eletrônico.
- **correspondente** — não há dependência nenhuma; o atendimento presencial
  existe só por terceiro contratado (lotérica, mercado, farmácia).
- **nenhum** — nada nos dois cadastros.

O que a classificação NÃO diz: qualidade, horário, distância percorrida pelo
morador, nem escopo de serviço. Um correspondente que só recebe boleto e um que
abre conta caem na mesma classe, porque o cadastro de correspondentes declara
serviço por contrato e não por ponto de forma comparável. Canais digitais não
entram — este é um mapa de presença física, e o painel diz isso na tela.

Denominador: a lista de municípios do IBGE carregada pelo pipeline, não um
literal. Foi um literal (5.570) que produziu a contagem errada de municípios
sem dependência na primeira versão desta cobertura.
"""
from pipeline import common

CLASSES = [
    {"id": "agencia", "rotulo": "Com agência",
     "def": "ao menos uma agência bancária cadastrada no município"},
    {"id": "posto", "rotulo": "Só posto ou terminal",
     "def": "sem agência, mas com posto de atendimento (PAB, PAC, PAA…) ou posto eletrônico"},
    {"id": "correspondente", "rotulo": "Só correspondente",
     "def": "sem dependência própria de instituição financeira; o atendimento presencial existe "
            "apenas por correspondente contratado — lotérica, mercado, farmácia"},
    {"id": "nenhum", "rotulo": "Nenhum ponto físico",
     "def": "nada nos cadastros de dependências e de correspondentes do BCB"},
]

LIMITACOES = [
    "Mapa de presença FÍSICA: canais digitais não entram, e a ausência de ponto não equivale a ausência de acesso.",
    "A classe não mede qualidade, horário, distância percorrida pelo morador nem escopo de serviço.",
    "Correspondentes com escopos muito diferentes caem na mesma classe: o cadastro declara serviço por contrato, não por ponto de forma comparável.",
    "Contagens de correspondente são por instituição contratante — o mesmo estabelecimento serve várias instituições e aparece uma vez para cada uma.",
    "Posição corrente dos cadastros, sem série histórica publicada pelo BCB.",
]


def _classe(agencia, posto, pae, corresp):
    if agencia:
        return "agencia"
    if posto or pae:
        return "posto"
    if corresp:
        return "correspondente"
    return "nenhum"


def build(con, cfg=None):
    try:
        muns = {r[0]: (r[1], r[2], r[3]) for r in con.execute(
            "SELECT cod_ibge, nome, uf, regiao FROM ibge_municipios")}
    except Exception:
        return None
    if not muns:
        return None

    dep = {}
    posicao_dep = None
    try:
        for tipo, mun, qtd, cnpj8, pos in con.execute(
                "SELECT tipo, municipio_ibge, qtd, cnpj8, posicao FROM dep_unidades"):
            if mun not in muns:
                continue
            d = dep.setdefault(mun, {"agencia": 0, "posto": 0, "pae": 0, "ifs": set()})
            d[tipo] = d.get(tipo, 0) + qtd
            d["ifs"].add(cnpj8)
            posicao_dep = posicao_dep or pos
    except Exception:
        return None

    corr = {}
    posicao_corr = None
    try:
        for mun, qtd, unicos, cnpj8, pos in con.execute(
                "SELECT municipio_ibge, qtd, correspondentes, cnpj8, posicao FROM corresp_pontos"):
            if mun not in muns:
                continue
            c = corr.setdefault(mun, {"pontos": 0, "unicos": 0, "ifs": set()})
            c["pontos"] += qtd
            c["unicos"] += unicos
            c["ifs"].add(cnpj8)
            posicao_corr = posicao_corr or pos
    except Exception:
        corr = {}

    lista, por_uf, por_classe = [], {}, {c["id"]: 0 for c in CLASSES}
    for cod, (nome, uf, regiao) in sorted(muns.items()):
        d = dep.get(cod, {})
        c = corr.get(cod, {})
        classe = _classe(d.get("agencia", 0), d.get("posto", 0), d.get("pae", 0), c.get("pontos", 0))
        por_classe[classe] += 1
        lista.append({
            "cod": cod, "nome": nome, "uf": uf, "regiao": regiao,
            "agencia": d.get("agencia", 0), "posto": d.get("posto", 0), "pae": d.get("pae", 0),
            "corresp": c.get("pontos", 0),
            # instituições com dependência e instituições que contratam correspondente
            # são universos distintos e ficam separadas: somar contaria duas vezes
            # quem tem os dois arranjos no mesmo município
            "ifs_dep": len(d.get("ifs", ())), "ifs_corresp": len(c.get("ifs", ())),
            "classe": classe,
        })
        u = por_uf.setdefault(uf, {"uf": uf, "municipios": 0,
                                   **{k["id"]: 0 for k in CLASSES},
                                   "agencia_qtd": 0, "posto_qtd": 0, "pae_qtd": 0, "corresp_qtd": 0})
        u["municipios"] += 1
        u[classe] += 1
        u["agencia_qtd"] += d.get("agencia", 0)
        u["posto_qtd"] += d.get("posto", 0)
        u["pae_qtd"] += d.get("pae", 0)
        u["corresp_qtd"] += c.get("pontos", 0)

    payload = {
        "gerado_em": common.now_utc(),
        "titulo": "Presença bancária física por município",
        "aviso": ("Mapa de presença FÍSICA. Canais digitais não entram, e a ausência de ponto não equivale "
                  "a ausência de acesso — assim como a presença de um correspondente não equivale à de uma agência."),
        "posicao": {"dependencias": posicao_dep, "correspondentes": posicao_corr},
        "fontes": [
            {"nome": "BCB — cadastro de agências, postos e postos eletrônicos (Unicad)",
             "url": "https://www.bcb.gov.br/fis/info/agencias.asp", "nivel": "A"},
            {"nome": "BCB — Correspondentes no País",
             "url": "https://www.bcb.gov.br/fis/info/correspondentes.asp", "nivel": "A"},
            {"nome": "IBGE — lista de municípios (denominador)",
             "url": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios", "nivel": "A"},
        ],
        "classes": CLASSES,
        "limitacoes": LIMITACOES,
        "totais": {"municipios": len(lista), **por_classe},
        "por_uf": sorted(por_uf.values(), key=lambda u: u["uf"]),
        "municipios": lista,
    }
    common.write_gold("presenca_mun.json", payload)
    return payload
