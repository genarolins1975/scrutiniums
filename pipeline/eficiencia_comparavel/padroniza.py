"""Leitura de células SIDRA sem imputação e com validação do universo municipal."""
import math

MISSING = {"...": "NAO_DISPONIVEL", "..": "NAO_APLICAVEL", "X": "SUPRIMIDO", "": "NAO_DISPONIVEL"}
SANITATION = {"46292", "46290", "72110", "72111", "72112", "72113", "92858", "72114", "72115", "92861"}
SANITATION_TOP = {"46290", "72112", "72113", "92858", "72114", "72115", "92861"}
HOUSING = {"73086", "73087", "73088", "73089", "73090"}


def cell(raw, *, zero_absoluto=False):
    if not isinstance(raw, str):
        raise ValueError("Célula SIDRA precisa preservar o texto original")
    if raw in MISSING:
        return None, MISSING[raw]
    # A legenda SIDRA define '-' como zero absoluto. Marcadores de ausência,
    # sigilo e não aplicabilidade acima permanecem ausentes.
    if raw == "-":
        return (0.0, "OBSERVADO") if zero_absoluto else (None, "NAO_DISPONIVEL")
    try:
        value = float(raw.replace(",", "."))
    except ValueError:
        raise ValueError("Marcador SIDRA não reconhecido: " + raw) from None
    if not math.isfinite(value) or value < 0:
        raise ValueError("Valor SIDRA inválido")
    return value, "OBSERVADO"


def cells(data, cities, table, variables, filters):
    if not data or data[0].get("D1C") != "Município (Código)":
        raise ValueError("Cabeçalho não municipal")
    ids = {c["id"] for c in cities}
    units = {"3795": ("2", "%"), "13534": ("38", "Reais"), "13376": ("45", "Pessoas"),
             "381": ("1020", "Unidades"), "382": ("45", "Pessoas"),
             "1000381": ("2", "Percentual"), "1000382": ("2", "Percentual")}
    result = {ident: {} for ident in ids}
    for row in data[1:]:
        ident, variable = row["D1C"], row["D2C"]
        if ident not in ids or row["NC"] != "6" or row["D3C"] != "2022" or variable not in variables:
            raise ValueError(f"Recorte, ano ou variável divergente na tabela {table}")
        if (row["MC"], row["MN"]) != units[variable]:
            raise ValueError("Unidade SIDRA divergente")
        for dimension, expected in filters.items():
            if row.get(dimension) not in expected:
                raise ValueError(f"Universo divergente na tabela {table}: {dimension}")
        city = next(c for c in cities if c["id"] == ident)
        if row["D1N"] != f"{city['nome']} ({city['uf']})":
            raise ValueError("Nome municipal ou UF divergente")
        category = row.get("D4C", "total")
        key = (variable, category)
        if key in result[ident]:
            raise ValueError("Célula municipal duplicada")
        value, state = cell(row["V"], zero_absoluto=variable in {"381", "382", "13376"})
        if value is not None and variable in {"381", "382", "13376"} and not value.is_integer():
            raise ValueError("Contagem SIDRA não inteira")
        result[ident][key] = {"valor": value, "estado": state, "original": row["V"]}
    return result


def scalar(row, variable):
    relevant = [value for (var, _), value in row.items() if var == variable]
    if len(relevant) != 1:
        raise ValueError("Medida escalar requer exatamente uma célula municipal")
    return relevant[0]["valor"]


def ratio(values, variable, numerator, denominator):
    keys = {(variable, c) for c in (*numerator, denominator)}
    if not keys.issubset(values):
        raise ValueError("Faltam categorias do numerador ou denominador")
    selected = [values[(variable, c)]["valor"] for c in (*numerator, denominator)]
    if any(v is None for v in selected):
        return {"valor": None, "numerador": None, "denominador": None}
    total = selected[-1]
    n = sum(selected[:-1])
    if total <= 0 or n > total:
        raise ValueError("Numerador ou denominador inválido")
    return {"valor": 100 * n / total, "numerador": n, "denominador": total}


def normalize(table, data, cities):
    settings = {
        10056: ({"3795"}, {"D4C": {"47813"}, "D5C": {"6794"}, "D6C": {"95251"}}),
        10295: ({"13534"}, {"D4C": {"6794"}, "D5C": {"95251"}, "D6C": {"95253"}}),
        10330: ({"13376"}, {"D4C": {"31609", "19432", "79191", "79192"}, "D5C": {"79488"}, "D6C": {"95251"}, "D7C": {"79176"}}),
        6805: ({"381"}, {"D4C": SANITATION}),
        9934: ({"381", "1000381"}, {"D4C": HOUSING, "D5C": {"73103"}, "D6C": {"73108"}}),
        9936: ({"381", "1000381"}, {"D4C": {"77584", "77585", "77586"}, "D5C": {"95826"}, "D6C": {"2932"}}),
        9940: ({"382", "1000382"}, {"D4C": HOUSING, "D5C": {"95251"}, "D6C": {"95253"}}),
    }
    variables, filters = settings[table]
    by_city = cells(data, cities, table, variables, filters)
    output = {}
    for ident, values in by_city.items():
        expected = len(filters["D4C"]) * len(variables)
        if len(values) != expected:
            raise ValueError("Cobertura incompleta de células municipais")
        if table in (10056, 10295):
            value = scalar(values, next(iter(variables)))
            output[ident] = {"valor": value, "numerador": None, "denominador": None}
        elif table == 10330:
            output[ident] = ratio(values, "13376", ("19432", "79191", "79192"), "31609")
        elif table == 6805:
            counts = {c: values[("381", c)]["valor"] for c in SANITATION}
            if all(v is not None for v in counts.values()):
                if counts["46290"] != counts["72110"] + counts["72111"]:
                    raise ValueError("Hierarquia do 6805 divergente")
                if sum(counts[c] for c in SANITATION_TOP) != counts["46292"]:
                    raise ValueError("Categorias de esgotamento não reconciliam")
            output[ident] = ratio(values, "381", ("46290", "72112"), "46292")
        elif table in (9934, 9940):
            variable, pct = ("381", "1000381") if table == 9934 else ("382", "1000382")
            counts = {c: values[(variable, c)]["valor"] for c in HOUSING}
            if all(v is not None for v in counts.values()):
                if abs(sum(counts[c] for c in HOUSING - {"73086"}) - counts["73086"]) > 2.5:
                    raise ValueError("Partição do adensamento divergente do arredondamento publicado")
            output[ident] = ratio(values, variable, ("73089", "73090"), "73086")
            output[ident]["alternativa_acima_tres"] = ratio(values, variable, ("73090",), "73086")["valor"]
            check_percentages(values, variable, pct, HOUSING, "73086")
        elif table == 9936:
            counts = [values[("381", c)]["valor"] for c in ("77584", "77585", "77586")]
            if all(v is not None for v in counts) and abs(counts[1] + counts[2] - counts[0]) > 1.5:
                raise ValueError("Partição de conectividade divergente")
            output[ident] = ratio(values, "381", ("77585",), "77584")
            check_percentages(values, "381", "1000381", {"77584", "77585", "77586"}, "77584")
        if output[ident]["valor"] is not None and table != 10295 and not 0 <= output[ident]["valor"] <= 100:
            raise ValueError("Percentual fora do domínio")
    return output


def check_percentages(values, count_var, pct_var, categories, total_cat):
    total = values[(count_var, total_cat)]["valor"]
    if total is None:
        return
    if total <= 0:
        raise ValueError("Total domiciliar inválido")
    for cat in categories:
        count, published = values[(count_var, cat)]["valor"], values[(pct_var, cat)]["valor"]
        if count is not None and published is not None and abs(100 * count / total - published) > .005 + 100 / total:
            raise ValueError("Percentual não reconcilia com contagem na precisão publicada")
