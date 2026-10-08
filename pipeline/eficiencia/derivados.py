"""Indicadores derivados da despesa: por habitante e por matrícula da rede municipal.

Duas razões, cada uma com numerador, denominador, universo e período explícitos:

1. Despesa por habitante = despesa liquidada na função Educação (DCA) ÷ população residente (IBGE)
   do mesmo ano. Divisão pela população do território: não é tributo pago por pessoa, nem benefício
   recebido, nem despesa por aluno.

2. Despesa por matrícula da rede municipal própria = despesa liquidada de aplicação direta do município
   na função Educação, excluídas as parcelas sem matrícula correspondente no denominador ÷ matrículas
   das escolas de dependência municipal (Censo Escolar). O numerador sai da Matriz de Saldos Contábeis
   (MSC) de dezembro, que traz, para cada linha da função 12, a subfunção, a modalidade de aplicação e o
   elemento de despesa da natureza. A ponte do total declarado na DCA ao numerador usa uma regra de
   atribuição única: cada linha da MSC cai em exatamente um balde, na ordem abaixo.

        1. modalidade diferente de 90 (aplicação direta) → transferências:
              50 e 60  instituições privadas (sem e com fins lucrativos)
              demais   outras modalidades (transferências a outros entes, consórcios, etc.)
        2. subfunção 364 (ensino superior)                → sem matrícula no denominador
        3. elemento 01, 03 ou 05 do grupo 3.1.90          → aposentadorias, pensões e outros benefícios
                                                             previdenciários (inativos)
        4. demais linhas                                  → despesa de aplicação direta na rede própria

   Linha sem natureza da despesa na MSC (campo vazio) não pode ser atribuída a nenhum balde: fica no balde
   `sem_natureza` e, acima de R$ 1,00, impede a razão do par capital × exercício (nada é rateado).

   Escolas privadas conveniadas ficam fora do denominador: as transferências a instituições privadas
   ficam fora do numerador. Nenhuma matrícula é somada ao denominador para "corrigir" o perímetro, e
   nenhuma despesa é rateada por etapa. A razão só é publicada quando a MSC reconcilia com a DCA.
"""
import os

from pipeline.eficiencia import base

MSC_CONTAS_LIQUIDADO = ("6221303", "6221304", "6221307")
TOL = 1.0            # reais, igual à política de conferência (conferencia.TOL_ARREDONDAMENTO)
TOL_RELATIVA = 0.001  # 0,1% da DCA, igual à política de conferência (conferencia.TOL_RELATIVA)

BALDES = ("rede_propria", "inativos", "ensino_superior", "transf_privadas", "transf_outras", "sem_natureza", "intra")

ROTULO_BALDE = {
    "rede_propria": "Aplicação direta na rede própria (numerador)",
    "inativos": "Aposentadorias, pensões e outros benefícios previdenciários (elementos 01, 03 e 05 do grupo 3.1.90)",
    "ensino_superior": "Subfunção 364, ensino superior",
    "transf_privadas": "Transferências a instituições privadas (modalidades 50 e 60)",
    "transf_outras": "Transferências a outros entes e demais modalidades que não a aplicação direta",
    "sem_natureza": "Linhas da MSC sem natureza da despesa (modalidade, elemento e grupo desconhecidos)",
    "intra": "Intraorçamentárias (modalidade 91), fora do total da DCA",
}

INATIVOS = ("01", "03", "05")


def caminho_msc(cod, ano):
    return os.path.join(base.SEED, "siconfi", "msc_funcao12", f"{cod}_{ano}_12.json.gz")


def balde(linha):
    """Balde de uma linha da MSC. Exige natureza da despesa de 8 dígitos; senão levanta ValueError."""
    nd = str(linha.get("natureza_despesa") or "")
    if nd == "":
        return "sem_natureza"
    if len(nd) != 8 or not nd.isdigit():
        raise ValueError(f"natureza da despesa inválida na MSC: {nd!r}")
    modalidade, elemento, grupo = nd[2:4], nd[4:6], nd[0:2]
    if modalidade == "91":
        return "intra"
    if modalidade in ("50", "60"):
        return "transf_privadas"
    if modalidade != "90":
        return "transf_outras"
    if str(linha.get("subfuncao")) == "364":
        return "ensino_superior"
    if grupo == "31" and elemento in INATIVOS:
        return "inativos"
    return "rede_propria"


def ponte(cod, ano, dca):
    """Ponte do total da DCA ao numerador por matrícula, a partir da MSC preservada no seed.

    Devolve None sem captura. Caso contrário, um dicionário com os baldes (R$, soma exata das linhas
    da MSC em contas de despesa liquidada da função 12), o total sem intraorçamentárias e a
    reconciliação com a DCA: CONFERE (|diferença| ≤ R$ 1,00), DIFERENCA_MENOR (≤ 0,1% da DCA, a mesma regra da
    política de conferência 1.1; a diferença fica na ponte, sem ser atribuída a balde algum), SEM_LINHAS (a
    MSC não traz linhas da função 12) ou NAO_RECONCILIA. Só as duas primeiras reconciliam."""
    caminho = caminho_msc(cod, ano)
    if not os.path.exists(caminho):
        return None
    linhas = base.le_json_gz(caminho)
    soma = {b: 0.0 for b in BALDES}
    n = 0
    for x in linhas:
        if str(x.get("funcao")) != "12" or str(x.get("conta_contabil", ""))[:7] not in MSC_CONTAS_LIQUIDADO:
            continue
        soma[balde(x)] += float(x["valor"])
        n += 1
    soma = {k: round(v, 2) for k, v in soma.items()}
    sem_intra = round(sum(v for k, v in soma.items() if k != "intra"), 2)
    dif = None if dca is None else round(sem_intra - dca, 2)
    if dca is None:
        situacao = "SEM_DCA"
    elif n == 0:
        situacao = "SEM_LINHAS"
    elif abs(dif) <= TOL:
        situacao = "CONFERE"
    elif dca > 0 and abs(dif) <= TOL_RELATIVA * dca:
        situacao = "DIFERENCA_MENOR"
    else:
        situacao = "NAO_RECONCILIA"
    return {
        "baldes": soma, "total_sem_intra": sem_intra, "linhas_msc": n, "sha256_msc": base.sha256_arquivo(caminho),
        "diferenca_dca": dif, "situacao": situacao, "reconcilia": situacao in ("CONFERE", "DIFERENCA_MENOR"),
        "diferenca_pct_dca": None if not dca else round(100 * dif / dca, 4),
        "classificavel": abs(soma["sem_natureza"]) <= TOL,
    }


def razao(num, den):
    """num ÷ den; None quando o denominador é nulo, ausente ou o numerador é ausente ou negativo."""
    if num is None or den is None or den <= 0 or num < 0:
        return None
    return num / den
