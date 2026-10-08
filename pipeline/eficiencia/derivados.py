"""Indicadores derivados da despesa: por habitante e por matrícula da rede municipal.

Duas razões, cada uma com numerador, denominador, universo e período explícitos:

1. Despesa por habitante = despesa liquidada na função Educação (DCA) ÷ população residente (IBGE)
   do mesmo ano. Divisão pela população do território: não é tributo pago por pessoa, nem benefício
   recebido, nem despesa por aluno.

2. Despesa de aplicação direta por matrícula da rede municipal (rodada 6; antes "da rede própria") =
   despesa liquidada de aplicação direta do município na função Educação, sem o ensino superior e sem inativos e
   pensionistas ÷ matrículas das escolas de dependência municipal (Censo Escolar). É uma razão entre um agregado
   orçamentário e o tamanho da rede. NÃO afirma que a despesa atenda exclusivamente as matrículas do denominador.

   O que a classificação da despesa permite inferir (MCASP 11ª ed., 4.2.4.4; MTO 2025, 4.6.2.1.3): a modalidade de
   aplicação indica o tipo de destinatário imediato do recurso e se ele é aplicado diretamente ou entregue por
   transferência. Ela NÃO identifica aluno, escola, dependência administrativa nem credor; a MSC não traz esses
   campos. Por isso "modalidade 90" significa "aplicação direta pela unidade", e não "serve à rede própria": ela
   inclui o pessoal das escolas, mas também compras de serviços que podem atender alunos de fora da rede, como vagas
   contratadas de instituições privadas (3.3.90.39, voucher em 3.3.90.48 ou 3.3.90.18).

   A ponte do total da DCA ao numerador usa uma regra de atribuição única: cada linha da MSC cai em exatamente um
   balde, na ordem abaixo. O texto de cada balde diz o que está identificado e o que permanece indeterminado.

        1. modalidade 91                              intraorçamentária: fora do total da DCA
        2. modalidades 50 e 60                        transferências a instituições privadas
        3. modalidades 20, 22, 30, 31, 32, 35, 36, 40, 41, 42, 45, 46, 70 a 76 e 80
                                                      transferências e delegações a outros entes, consórcios,
                                                      instituições multigovernamentais e exterior
        4. modalidade 92                              aplicação de recursos recebidos por delegação, para ações
                                                      do ente delegante (MCASP: "responsabilidade exclusiva do
                                                      ente delegante ou descentralizador")
        5. modalidade 67                              contrato de parceria público-privada (nem transferência,
                                                      nem aplicação direta rotulada pela norma)
        6. modalidades 95, 96 e 99                    uso atípico na função (95 e 96 só saúde; 99 a definir)
        7. modalidade fora da lista                   modalidade não reconhecida
        8. demais, modalidades 90, 93 e 94 (aplicação direta):
              subfunção 364                           ensino superior
              grupo 3.1, elementos 01, 03 e 05        aposentadorias, pensões e outros benefícios previdenciários
              modalidades 93 e 94                     compras de consórcio público: o fornecedor é o consórcio e o
                                                      beneficiário não é identificado
              elementos 18, 39, 41, 45 e 48           beneficiário indeterminado: serviços de terceiros pessoa
                                                      jurídica, auxílios financeiros a estudantes e a pessoas físicas,
                                                      contribuições e subvenções econômicas; podem conter vagas
                                                      contratadas fora da rede
              demais elementos                        pessoal ativo, material, obras, equipamentos e outros

   Numerador = os dois últimos baldes (aplicação direta com beneficiário indeterminado + demais elementos). A parcela
   indeterminada é quantificada por par e publicada; nenhum limite de aceitabilidade a usa para liberar ou bloquear
   o indicador.

   Linha sem natureza da despesa na MSC (campo vazio) ou com modalidade fora da lista não pode ser atribuída a balde
   algum: acima de R$ 1,00 impede a razão do par capital × exercício (nada é rateado).

   Escolas privadas conveniadas ficam fora do denominador e as transferências a instituições privadas ficam fora
   do numerador. Nenhuma matrícula é somada ao denominador para "corrigir" o perímetro, e nenhuma despesa é rateada
   por etapa. A razão só é publicada quando a MSC reconcilia com a DCA.
"""
import os

from pipeline.eficiencia import base
from pipeline.eficiencia import conferencia as CF

MSC_CONTAS_LIQUIDADO = CF.MSC_CONTAS_LIQUIDADO
TOL = CF.TOL_ARREDONDAMENTO          # reais: a regra efetiva é a da política de conferência, sem cópia local
TOL_RELATIVA = CF.TOL_RELATIVA       # 0,1% da DCA, idem

BALDES = ("ad_demais_elementos", "ad_beneficiario_indeterminado", "inativos", "ensino_superior", "transf_privadas",
          "transf_outros_entes", "delegacao_recebida", "ppp", "uso_atipico", "modalidade_nao_reconhecida", "sem_natureza", "intra")
NUMERADOR = ("ad_demais_elementos", "ad_beneficiario_indeterminado")

ROTULO_BALDE = {
    "ad_demais_elementos": "Aplicação direta: pessoal ativo, material, obras, equipamentos e demais elementos (numerador)",
    "ad_beneficiario_indeterminado": "Aplicação direta com beneficiário indeterminado: serviços de terceiros pessoa jurídica, auxílios financeiros, contribuições e compras de consórcio (numerador)",
    "inativos": "Aposentadorias, pensões e outros benefícios previdenciários (elementos 01, 03 e 05 do grupo 3.1)",
    "ensino_superior": "Subfunção 364, ensino superior",
    "transf_privadas": "Transferências a instituições privadas (modalidades 50 e 60)",
    "transf_outros_entes": "Transferências e delegações a outros entes, consórcios, instituições multigovernamentais e exterior",
    "delegacao_recebida": "Aplicação de recursos recebidos por delegação de outro ente (modalidade 92), para ações do ente delegante",
    "ppp": "Contratos de parceria público-privada (modalidade 67)",
    "uso_atipico": "Modalidades de uso atípico na função Educação (95 e 96, só saúde; 99, a definir)",
    "modalidade_nao_reconhecida": "Linhas da MSC com modalidade de aplicação fora da lista da norma",
    "sem_natureza": "Linhas da MSC sem natureza da despesa (modalidade, elemento e grupo desconhecidos)",
    "intra": "Intraorçamentárias (modalidade 91), fora do total da DCA",
}

INATIVOS = ("01", "03", "05")
# Elementos de despesa em aplicação direta que não identificam se o beneficiário é a rede municipal. Base: a norma não
# dá código a "vaga contratada"; a compra de vaga em instituição com fins lucrativos só cabe em 3.3.90.39 (MA 60 não
# admite o elemento 39), o voucher à família tende a 3.3.90.48 ou 3.3.90.18, e 41 e 45 são contribuição e subvenção
# econômica. Serviços de terceiros que atendem alunos da própria rede (transporte, alimentação) também estão aqui:
# a MSC não separa. Não é lista de exclusão: é a medida do que a classificação não permite afirmar.
ELEMENTOS_INDETERMINADOS = ("18", "39", "41", "45", "48")
MODALIDADES_TRANSFERENCIA_OU_DELEGACAO = ("20", "22", "30", "31", "32", "35", "36", "40", "41", "42", "45", "46",
                                           "70", "71", "72", "73", "74", "75", "76", "80")
MODALIDADES_COMPRA_DE_CONSORCIO = ("93", "94")
MODALIDADES_USO_ATIPICO = ("95", "96", "99")
MODALIDADES_CONHECIDAS = (set(MODALIDADES_TRANSFERENCIA_OU_DELEGACAO) | {"50", "60", "67", "90", "91", "92"} | set(MODALIDADES_COMPRA_DE_CONSORCIO)
                          | set(MODALIDADES_USO_ATIPICO))


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
    if modalidade in MODALIDADES_TRANSFERENCIA_OU_DELEGACAO:
        return "transf_outros_entes"
    if modalidade == "92":
        return "delegacao_recebida"
    if modalidade == "67":
        return "ppp"
    if modalidade in MODALIDADES_USO_ATIPICO:
        return "uso_atipico"
    if modalidade not in MODALIDADES_CONHECIDAS:
        return "modalidade_nao_reconhecida"
    # aplicação direta: modalidades 90, 93 e 94
    if str(linha.get("subfuncao")) == "364":
        return "ensino_superior"
    if grupo == "31" and elemento in INATIVOS:
        return "inativos"
    if modalidade in MODALIDADES_COMPRA_DE_CONSORCIO or (grupo != "31" and elemento in ELEMENTOS_INDETERMINADOS):
        return "ad_beneficiario_indeterminado"
    return "ad_demais_elementos"


def ponte(cod, ano, dca):
    """Ponte do total da DCA ao numerador por matrícula, a partir da MSC preservada no seed.

    Devolve None sem captura. Caso contrário, um dicionário com os baldes (R$, saldo líquido das linhas da MSC em
    contas de despesa liquidada da função 12, com o sinal da natureza D ou C: política de conferência 1.2), o total sem
    intraorçamentárias, o numerador, a parcela de beneficiário indeterminado e a reconciliação com a DCA: CONFERE
    (|diferença| ≤ R$ 1,00), DIFERENCA_MENOR (≤ 0,1% da DCA, a mesma regra da política de conferência; a diferença fica
    na ponte, sem ser atribuída a balde algum), SEM_LINHAS (a MSC não traz linhas da função 12) ou NAO_RECONCILIA. Só as
    duas primeiras reconciliam."""
    caminho = caminho_msc(cod, ano)
    if not os.path.exists(caminho):
        return None
    linhas = base.le_json_gz(caminho)
    soma = {b: 0.0 for b in BALDES}
    n = 0
    n_debito, valor_debito = 0, 0.0
    for x in linhas:
        if str(x.get("funcao")) != "12" or str(x.get("conta_contabil", ""))[:7] not in MSC_CONTAS_LIQUIDADO:
            continue
        v = CF.saldo_liquido(x)  # C soma, D subtrai (política de conferência 1.2)
        soma[balde(x)] += v
        n += 1
        if v < 0:
            n_debito += 1
            valor_debito += -v
    soma = {k: round(v, 2) for k, v in soma.items()}
    sem_intra = round(sum(v for k, v in soma.items() if k != "intra"), 2)
    numerador = round(sum(soma[b] for b in NUMERADOR), 2)
    indet = soma["ad_beneficiario_indeterminado"]
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
        "baldes": soma, "total_sem_intra": sem_intra, "linhas_msc": n,
        "linhas_debito": n_debito, "valor_debito": round(valor_debito, 2),
        "numerador": numerador, "parcela_indeterminada": indet,
        "parcela_indeterminada_pct": round(100 * indet / numerador, 4) if numerador > 0 else None,
        "sha256_msc": base.sha256_arquivo(caminho),
        "diferenca_dca": dif, "situacao": situacao, "reconcilia": situacao in ("CONFERE", "DIFERENCA_MENOR"),
        "diferenca_pct_dca": None if not dca else round(100 * dif / dca, 4),
        "classificavel": abs(soma["sem_natureza"]) <= TOL and abs(soma["modalidade_nao_reconhecida"]) <= TOL,
    }


def razao(num, den):
    """num ÷ den; None quando o denominador é nulo, ausente ou o numerador é ausente ou negativo."""
    if num is None or den is None or den <= 0 or num < 0:
        return None
    return num / den
