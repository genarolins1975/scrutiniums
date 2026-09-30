"""Leitores das fontes do IBGE usadas no módulo Inclusão energética.

1. POF 2017-2018, tabela SIDRA 6715 (despesa monetária e não monetária média mensal
   familiar por classes de rendimento total e variação patrimonial, com a
   distribuição percentual): despesa com energia elétrica e despesa total, Brasil,
   grandes regiões e UF. A "distribuição" publicada é razão de médias
   (média da despesa com energia ÷ média da despesa total), não média das
   participações de cada família.
2. POF 2017-2018, "Tabelas de Coeficientes_despesas" (arquivo de primeiros resultados
   no FTP do IBGE): coeficientes de variação publicados, só para o Brasil.
3. POF 2017-2018, microdados (Dados_20230713.zip) e tradutor da tabela de despesa
   geral (Tradutores_20230713.zip): o módulo refaz, família a família, a despesa com
   energia elétrica e a despesa total pela memória de cálculo publicada pelo IBGE
   ("Tabela de Despesa Geral.R"), confere as médias contra a tabela 6715 e só então
   calcula o que o IBGE não publica: média das participações, mediana, proporção de
   famílias acima de limiares e erros-padrão pelo plano amostral (estrato e UPA).
4. PNAD Contínua anual, tabelas SIDRA 6737 (domicílios com energia elétrica, por fonte),
   6738 (com energia de rede geral em tempo integral) e 6731 (total de domicílios),
   com os coeficientes de variação publicados.
"""
import io
import json
import re
import zipfile

# ---------------------------------------------------------------- SIDRA

URL_SIDRA = "https://apisidra.ibge.gov.br/values"
URL_POF_6715 = (URL_SIDRA + "/t/6715/n1/all/n2/all/n3/all/v/1201,1204/p/all/c339/all/c12190/103536,8018")
URL_PNAD_6737 = URL_SIDRA + "/t/6737/n1/all/n2/all/n3/all/v/5157,5160,5074,5077/p/all/c1/all/c827/all"
URL_PNAD_6738 = URL_SIDRA + "/t/6738/n1/all/n2/all/n3/all/v/9992,9993,9994,9995/p/all/c1/all"
URL_PNAD_6731 = URL_SIDRA + "/t/6731/n1/all/n2/all/n3/all/v/162,5123/p/all/c1/all/c825/47937"

CLASSES_POF = {  # código SIDRA da classe 339 → (índice, rótulo, limite inferior exclusivo, superior inclusivo), R$ de 15/01/2018
    "7999": (None, "Total", None, None),
    "47558": (0, "Até R$ 1.908", None, 1908.0),
    "47559": (1, "Mais de R$ 1.908 a R$ 2.862", 1908.0, 2862.0),
    "47560": (2, "Mais de R$ 2.862 a R$ 5.724", 2862.0, 5724.0),
    "47561": (3, "Mais de R$ 5.724 a R$ 9.540", 5724.0, 9540.0),
    "47562": (4, "Mais de R$ 9.540 a R$ 14.310", 9540.0, 14310.0),
    "47563": (5, "Mais de R$ 14.310 a R$ 23.850", 14310.0, 23850.0),
    "47564": (6, "Mais de R$ 23.850", 23850.0, None),
}
TIPOS_POF = {"103536": "despesa_total", "8018": "energia_eletrica"}
UF_SIGLA = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA",
            "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
            "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
            "51": "MT", "52": "GO", "53": "DF"}
# regiões com prefixo: "SE" sozinho seria ambíguo (Sudeste ou Sergipe)
REGIAO_CODIGO = {"1": "RG-N", "2": "RG-NE", "3": "RG-SE", "4": "RG-S", "5": "RG-CO"}


def territorio_sidra(nivel, codigo):
    """Código SIDRA → chave do módulo: 'BR', região ('RG-N'...) ou sigla da UF."""
    codigo = str(codigo)
    if nivel == "1" or codigo == "1" and nivel is None:
        return "BR"
    if nivel == "2":
        return REGIAO_CODIGO.get(codigo)
    if nivel == "3":
        return UF_SIGLA.get(codigo)
    return None


def valor_sidra(v):
    """Valor da API SIDRA → float ou None. '-', '..', '...' e 'X' são convenções do IBGE
    para zero absoluto não resultante de arredondamento, não aplicável, não disponível
    e suprimido: o módulo guarda só números e trata os demais como ausência, com o
    símbolo preservado pelo chamador quando precisar distinguir."""
    s = str(v or "").strip()
    if s in ("", "-", "..", "...", "X", "x"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def le_pof_6715(texto):
    """Resposta JSON da tabela 6715 → [(territorio, classe_codigo, tipo, variavel, valor)]."""
    dados = json.loads(texto)
    out = []
    for r in dados[1:]:
        terr = territorio_sidra(str(r.get("NC")), r.get("D1C"))
        classe = str(r.get("D4C"))
        tipo = TIPOS_POF.get(str(r.get("D5C")))
        var = {"1201": "media_reais", "1204": "distribuicao_pct"}.get(str(r.get("D2C")))
        v = valor_sidra(r.get("V"))
        if terr and tipo and var and classe in CLASSES_POF and v is not None:
            out.append((terr, classe, tipo, var, v))
    return out


def le_pnad(texto, tabela):
    """Resposta JSON das tabelas 6737, 6738 e 6731 → [(territorio, ano, situacao, variavel, fonte, valor)].
    situacao: 'total' | 'urbana' | 'rural'; fonte (6737): 'qualquer' | 'rede_geral'."""
    dados = json.loads(texto)
    sit = {"6795": "total", "1": "urbana", "2": "rural"}
    fontes = {"46296": "qualquer", "46297": "rede_geral"}
    variaveis = {
        "6737": {"5157": "domicilios_mil", "5160": "cv_domicilios", "5074": "pct", "5077": "cv_pct"},
        "6738": {"9992": "domicilios_mil", "9993": "cv_domicilios", "9994": "pct", "9995": "cv_pct"},
        "6731": {"162": "domicilios_mil", "5123": "cv_domicilios"},
    }[tabela]
    out = []
    for r in dados[1:]:
        terr = territorio_sidra(str(r.get("NC")), r.get("D1C"))
        var = variaveis.get(str(r.get("D2C")))
        s = sit.get(str(r.get("D4C")))
        fonte = fontes.get(str(r.get("D5C"))) if tabela == "6737" else ("rede_geral_integral" if tabela == "6738" else "todos")
        v = valor_sidra(r.get("V"))
        ano = str(r.get("D3C") or "")
        if terr and var and s and fonte and v is not None and re.fullmatch(r"\d{4}", ano):
            out.append((terr, ano, s, var, fonte, v))
    return out


# ---------------------------------------------------------------- POF: coeficientes de variação

def le_cv_pof(linhas_planilha):
    """Tabela 1 de 'Tabelas de Coeficientes_despesas' → {tipo: [cv_total, cv_classe0, ..., cv_classe6]}
    para despesa total e energia elétrica (Brasil). A planilha traz o rótulo do tipo de
    despesa na primeira coluna, com recuo de espaços."""
    alvo = {"despesa total": "despesa_total", "energia elétrica": "energia_eletrica"}
    out = {}
    for linha in linhas_planilha:
        if not linha or not isinstance(linha[0], str):
            continue
        rot = linha[0].strip().lower()
        if rot in alvo and alvo[rot] not in out:
            vals = []
            for x in linha[1:9]:
                try:
                    vals.append(float(x))
                except (TypeError, ValueError):
                    vals.append(None)
            if len(vals) == 8:
                out[alvo[rot]] = vals
    return out


# ---------------------------------------------------------------- POF: microdados

# Larguras e nomes dos registros, copiados do programa oficial de leitura do IBGE
# ("Leitura dos Microdados - R.R", Programas_de_Leitura_20230713.zip). Só os registros
# usados na tabela de despesa geral.
LAYOUT_POF = {
    "MORADOR": ([2, 4, 1, 9, 2, 1, 2, 2, 1, 2, 2, 4, 3, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 14, 14, 10, 1, 20, 20, 20, 20],
                ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC", "COD_INFORMANTE",
                 "V0306", "V0401", "V04021", "V04022", "V04023", "V0403", "V0404", "V0405", "V0406", "V0407",
                 "V0408", "V0409", "V0410", "V0411", "V0412", "V0413", "V0414", "V0415", "V0416", "V041711",
                 "V041712", "V041721", "V041722", "V041731", "V041732", "V041741", "V041742", "V0418", "V0419",
                 "V0420", "V0421", "V0422", "V0423", "V0424", "V0425", "V0426", "V0427", "V0428", "V0429",
                 "V0430", "ANOS_ESTUDO", "PESO", "PESO_FINAL", "RENDA_TOTAL", "NIVEL_INSTRUCAO", "RENDA_DISP_PC",
                 "RENDA_MONET_PC", "RENDA_NAO_MONET_PC", "DEDUCAO_PC"]),
    "ALUGUEL_ESTIMADO": ([2, 4, 1, 9, 2, 1, 2, 7, 2, 10, 2, 2, 12, 10, 1, 2, 14, 14, 10],
                         ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC", "QUADRO",
                          "V9001", "V9002", "V8000", "V9010", "V9011", "DEFLATOR", "V8000_DEFLA",
                          "COD_IMPUT_VALOR", "FATOR_ANUALIZACAO", "PESO", "PESO_FINAL", "RENDA_TOTAL"]),
    "DESPESA_COLETIVA": ([2, 4, 1, 9, 2, 1, 2, 2, 7, 2, 4, 10, 2, 2, 1, 10, 1, 12, 10, 10, 1, 1, 2, 14, 14, 10, 5],
                         ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC", "QUADRO",
                          "SEQ", "V9001", "V9002", "V9005", "V8000", "V9010", "V9011", "V9012", "V1904", "V1905",
                          "DEFLATOR", "V8000_DEFLA", "V1904_DEFLA", "COD_IMPUT_VALOR", "COD_IMPUT_QUANTIDADE",
                          "FATOR_ANUALIZACAO", "PESO", "PESO_FINAL", "RENDA_TOTAL", "V9004"]),
    "CADERNETA_COLETIVA": ([2, 4, 1, 9, 2, 1, 2, 3, 7, 2, 10, 12, 10, 1, 2, 14, 14, 10, 9, 4, 5, 9, 5],
                           ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC", "QUADRO",
                            "SEQ", "V9001", "V9002", "V8000", "DEFLATOR", "V8000_DEFLA", "COD_IMPUT_VALOR",
                            "FATOR_ANUALIZACAO", "PESO", "PESO_FINAL", "RENDA_TOTAL", "V9005", "V9007", "V9009",
                            "QTD_FINAL", "V9004"]),
    "DESPESA_INDIVIDUAL": ([2, 4, 1, 9, 2, 1, 2, 2, 2, 7, 2, 10, 2, 2, 1, 1, 1, 12, 10, 1, 2, 14, 14, 10, 5],
                           ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC",
                            "COD_INFORMANTE", "QUADRO", "SEQ", "V9001", "V9002", "V8000", "V9010", "V9011",
                            "V9012", "V4104", "V4105", "DEFLATOR", "V8000_DEFLA", "COD_IMPUT_VALOR",
                            "FATOR_ANUALIZACAO", "PESO", "PESO_FINAL", "RENDA_TOTAL", "V9004"]),
    "RENDIMENTO_TRABALHO": ([2, 4, 1, 9, 2, 1, 2, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 7, 7, 7, 7, 2, 2, 3, 1, 12, 10, 10,
                             10, 10, 1, 1, 14, 14, 10, 4, 5],
                            ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC",
                             "COD_INFORMANTE", "QUADRO", "SUB_QUADRO", "SEQ", "V9001", "V5302", "V53021", "V5303",
                             "V5304", "V5305", "V5307", "V8500", "V531112", "V531122", "V531132", "V9010", "V9011",
                             "V5314", "V5315", "DEFLATOR", "V8500_DEFLA", "V531112_DEFLA", "V531122_DEFLA",
                             "V531132_DEFLA", "COD_IMPUT_VALOR", "FATOR_ANUALIZACAO", "PESO", "PESO_FINAL",
                             "RENDA_TOTAL", "V53011", "V53061"]),
    "OUTROS_RENDIMENTOS": ([2, 4, 1, 9, 2, 1, 2, 2, 2, 7, 10, 10, 2, 2, 12, 10, 10, 1, 1, 14, 14, 10],
                           ["UF", "ESTRATO_POF", "TIPO_SITUACAO_REG", "COD_UPA", "NUM_DOM", "NUM_UC",
                            "COD_INFORMANTE", "QUADRO", "SEQ", "V9001", "V8500", "V8501", "V9010", "V9011",
                            "DEFLATOR", "V8500_DEFLA", "V8501_DEFLA", "COD_IMPUT_VALOR", "FATOR_ANUALIZACAO",
                            "PESO", "PESO_FINAL", "RENDA_TOTAL"]),
}

# Variável de valor que cada registro fornece e os quadros cujos valores são mensais
# (entram multiplicados pelo número de meses V9011), conforme "Tabela de Despesa Geral.R".
VARIAVEIS_REGISTRO = {
    "DESPESA_COLETIVA": ("V8000_DEFLA", "V1904_DEFLA"),
    "CADERNETA_COLETIVA": ("V8000_DEFLA",),
    "DESPESA_INDIVIDUAL": ("V8000_DEFLA",),
    "ALUGUEL_ESTIMADO": ("V8000_DEFLA",),
    "RENDIMENTO_TRABALHO": ("V531112_DEFLA", "V531122_DEFLA", "V531132_DEFLA"),
    "OUTROS_RENDIMENTOS": ("V8501_DEFLA",),
}
CODIGO_ENERGIA_NIVEL5 = 1102031  # "Energia eletrica" no tradutor (código de item 6001)


def usa_meses(registro, quadro, variavel):
    """True quando o valor do registro é mensal e deve ser multiplicado por V9011."""
    if registro in ("ALUGUEL_ESTIMADO", "RENDIMENTO_TRABALHO"):
        return True
    if registro == "DESPESA_COLETIVA":
        return variavel == "V1904_DEFLA" or quadro in (10, 19)
    if registro == "DESPESA_INDIVIDUAL":
        return quadro in (44, 47, 48, 49, 50)
    if registro == "OUTROS_RENDIMENTOS":
        return quadro == 54
    return False


def fatias(registro):
    larg, nomes = LAYOUT_POF[registro]
    out, pos = {}, 0
    for w, n in zip(larg, nomes):
        out[n] = (pos, pos + w)
        pos += w
    return out


def _f(s):
    s = s.strip()
    return float(s) if s else None


def le_tradutor_despesa(linhas_planilha):
    """Tradutor_Despesa_Geral (lista de linhas) → {codigo5: [(variavel, nivel0..nivel5)]}.
    Um mesmo código pode aparecer mais de uma vez com variáveis diferentes (ex.: 19001
    entra como despesa de manutenção do lar e como contribuição trabalhista)."""
    cab = [str(x or "").strip().lower() for x in linhas_planilha[0]]
    i_cod, i_var = cab.index("codigo"), cab.index("variavel")
    niveis = [cab.index(f"nivel_{k}") for k in range(6)]
    out = {}
    for linha in linhas_planilha[1:]:
        if not linha or linha[i_cod] in (None, ""):
            continue
        cod = int(float(linha[i_cod]))
        nv = []
        for i in niveis:
            x = linha[i] if i < len(linha) else None
            nv.append(int(float(x)) if x not in (None, "") else None)
        out.setdefault(cod, []).append((str(linha[i_var]).strip(), tuple(nv)))
    return out


def familias_pof(zip_dados, tradutor):
    """Microdados (ZIP oficial, caminho ou arquivo) → {chave_uc: {...}} com, por unidade
    de consumo (família): uf, estrato, upa, peso, renda (rendimento total e variação
    patrimonial mensal), despesa total mensal e despesa mensal com energia elétrica,
    ambas em R$ de 15/01/2018 (deflacionadas pelo IBGE), sem expansão (o peso fica à
    parte para a estimação).

    Reproduz a memória de cálculo oficial: valor × fator de anualização (× meses nos
    quadros mensais) ÷ 12, somado por família para os códigos do tradutor com nível 0
    "Despesa Total"; energia = códigos com nível 5 = 1102031."""
    z = zipfile.ZipFile(zip_dados)
    nomes = {n.rsplit("/", 1)[-1].upper(): n for n in z.namelist()}

    def linhas(reg):
        with z.open(nomes[f"{reg}.TXT"]) as f:
            for linha in io.TextIOWrapper(f, encoding="latin-1"):
                if linha.strip():
                    yield linha

    F = fatias("MORADOR")
    familias = {}
    for l in linhas("MORADOR"):
        k = (l[slice(*F["COD_UPA"])].strip(), l[slice(*F["NUM_DOM"])].strip(), l[slice(*F["NUM_UC"])].strip())
        if k in familias:
            continue
        familias[k] = {"uf": l[slice(*F["UF"])].strip(), "estrato": l[slice(*F["ESTRATO_POF"])].strip(),
                       "upa": k[0], "peso": _f(l[slice(*F["PESO_FINAL"])]), "renda": _f(l[slice(*F["RENDA_TOTAL"])]),
                       "despesa": 0.0, "energia": 0.0}
    diag = {"familias": len(familias), "registros": {}}
    for reg, variaveis in VARIAVEIS_REGISTRO.items():
        F = fatias(reg)
        n_uso = sem_trad = sem_familia = 0
        for l in linhas(reg):
            cod = int(l[slice(*F["V9001"])]) // 100
            regras = tradutor.get(cod)
            if not regras:
                sem_trad += 1
                continue
            k = (l[slice(*F["COD_UPA"])].strip(), l[slice(*F["NUM_DOM"])].strip(), l[slice(*F["NUM_UC"])].strip())
            fam = familias.get(k)
            if fam is None:
                sem_familia += 1
                continue
            quadro = int(l[slice(*F["QUADRO"])])
            fator = _f(l[slice(*F["FATOR_ANUALIZACAO"])]) or 0.0
            for variavel, niveis in regras:
                if variavel not in variaveis or niveis[0] != 0:
                    continue
                v = _f(l[slice(*F[variavel])])
                if v is None:
                    continue
                if usa_meses(reg, quadro, variavel):
                    meses = _f(l[slice(*F["V9011"])]) if "V9011" in F else None
                    valor = v * (meses or 0.0) * fator / 12.0
                else:
                    valor = v * fator / 12.0
                fam["despesa"] += valor
                if niveis[5] == CODIGO_ENERGIA_NIVEL5:
                    fam["energia"] += valor
                n_uso += 1
        diag["registros"][reg] = {"linhas_usadas": n_uso, "codigos_fora_do_tradutor": sem_trad,
                                  "sem_familia": sem_familia}
    return familias, diag


def classe_renda(renda):
    """Índice da classe de rendimento da tabela 6715 (0 a 6) ou None."""
    if renda is None:
        return None
    for cod, (i, _, lo, hi) in CLASSES_POF.items():
        if i is None:
            continue
        if (lo is None or renda > lo) and (hi is None or renda <= hi):
            return i
    return None
