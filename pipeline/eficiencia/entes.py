"""Universo de entes e territórios do OBEE.

O modelo distingue ente (pessoa jurídica de direito público que responde pela
rede), território (área geográfica com código IBGE) e rede (conjunto de escolas
sob a mesma dependência administrativa). Nesta etapa só entram as 26 capitais
estaduais como entes municipais. O Distrito Federal fica registrado, fora do
universo municipal, porque acumula competências de estado e de município: a rede
pública do DF é distrital (dependência "Estadual" no Censo Escolar) e não há
prefeitura. Tratamento próprio fica para a expansão (docs/obee/CONTINUIDADE.md).
"""

REGIOES = {
    "N": "Norte", "NE": "Nordeste", "SE": "Sudeste", "S": "Sul", "CO": "Centro-Oeste",
}
UF_REGIAO = {
    "AC": "N", "AM": "N", "AP": "N", "PA": "N", "RO": "N", "RR": "N", "TO": "N",
    "AL": "NE", "BA": "NE", "CE": "NE", "MA": "NE", "PB": "NE", "PE": "NE", "PI": "NE", "RN": "NE", "SE": "NE",
    "ES": "SE", "MG": "SE", "RJ": "SE", "SP": "SE",
    "PR": "S", "RS": "S", "SC": "S",
    "DF": "CO", "GO": "CO", "MS": "CO", "MT": "CO",
}

# Código IBGE de 7 dígitos, conferido contra a lista de entes do Siconfi
# (https://apidatalake.tesouro.gov.br/ords/siconfi/tt/entes, campo capital = 1),
# capturada em 08/10/2026. A conferência roda em validacoes.py.
CAPITAIS = [
    (1200401, "Rio Branco", "AC"),
    (2704302, "Maceió", "AL"),
    (1600303, "Macapá", "AP"),
    (1302603, "Manaus", "AM"),
    (2927408, "Salvador", "BA"),
    (2304400, "Fortaleza", "CE"),
    (3205309, "Vitória", "ES"),
    (5208707, "Goiânia", "GO"),
    (2111300, "São Luís", "MA"),
    (5103403, "Cuiabá", "MT"),
    (5002704, "Campo Grande", "MS"),
    (3106200, "Belo Horizonte", "MG"),
    (1501402, "Belém", "PA"),
    (2507507, "João Pessoa", "PB"),
    (4106902, "Curitiba", "PR"),
    (2611606, "Recife", "PE"),
    (2211001, "Teresina", "PI"),
    (3304557, "Rio de Janeiro", "RJ"),
    (2408102, "Natal", "RN"),
    (4314902, "Porto Alegre", "RS"),
    (1100205, "Porto Velho", "RO"),
    (1400100, "Boa Vista", "RR"),
    (4205407, "Florianópolis", "SC"),
    (3550308, "São Paulo", "SP"),
    (2800308, "Aracaju", "SE"),
    (1721000, "Palmas", "TO"),
]

DISTRITO_FEDERAL = (5300108, "Brasília", "DF")


def slug(nome):
    import unicodedata
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return "-".join(p for p in "".join(c if c.isalnum() else " " for c in s).split())


def capitais():
    """Capitais elegíveis do painel, em ordem alfabética do nome (ordem neutra)."""
    out = []
    for cod, nome, uf in CAPITAIS:
        out.append({
            "id": slug(nome),
            "cod_ibge": cod,
            "nome": nome,
            "uf": uf,
            "regiao": UF_REGIAO[uf],
            "tipo_ente": "MUNICIPIO",
            "rede": "municipal",
        })
    return sorted(out, key=lambda c: chave_alfabetica(c["nome"]))


def chave_alfabetica(nome):
    import unicodedata
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()


def codigos_capitais():
    return {c for c, _, _ in CAPITAIS}


def excluidos():
    cod, nome, uf = DISTRITO_FEDERAL
    return [{
        "cod_ibge": cod,
        "nome": f"{nome} (Distrito Federal)",
        "uf": uf,
        "tipo_ente": "DISTRITO_FEDERAL",
        "motivo": (
            "O Distrito Federal não tem prefeitura nem rede municipal. A rede pública de Brasília é mantida pelo "
            "Governo do Distrito Federal, registrada no Censo Escolar com dependência administrativa estadual, e a "
            "despesa distrital com educação reúne competências de estado e de município. Incluí-la neste recorte "
            "misturaria redes de natureza diferente."
        ),
    }]
