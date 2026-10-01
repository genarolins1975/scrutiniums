"""ONS, Carga de Energia Verificada (API apicarga.ons.org.br): componente de MMGD.

O conjunto "Carga de Energia Verificada" (dados.ons.org.br/dataset/carga-energia-verificada)
não publica arquivos: o CKAN aponta para o dicionário e para a API
`https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=&dat_fim=&cod_areacarga=`,
em base semi-horária, por área de carga. Campos usados (dicionário v1.1, 30/10/2023):

- val_cargammgd: "Carga atendida por MMGD em MWmed integralizada no final do intervalo
  da semi-hora" (não admite negativo);
- val_cargaglobal: carga global em MWmed;
- val_cargaglobalsmmgd: carga global líquida de MMGD (o dicionário a chama de
  `val_cargaglobalsmmg`; a API responde `val_cargaglobalsmmgd`).

Comportamentos observados em 30/09/2026 e tratados aqui:
- intervalos anteriores a 2019 vêm com o valor vazio (`"val_cargammgd": ,`), o que não é
  JSON válido: o vazio vira null (ausência), nunca zero;
- a API limita o tamanho da resposta (um ano pedido de uma vez voltou cortado em 105
  dias), por isso a coleta é mensal;
- o ONS revisa o histórico (há registros de 2023 com din_atualizacao de 2026), por isso
  meses antigos são recoletados periodicamente.

Energia: cada valor é MWmed de meia hora; energia do intervalo = valor × 0,5 h (MWh).
MWmed de um período = soma de MWh ÷ horas cobertas, nunca média de médias diárias.
"""
import json
import re
from collections import defaultdict

URL_API = "https://apicarga.ons.org.br/prd/cargaverificada"
URL_DATASET = "https://dados.ons.org.br/dataset/carga-energia-verificada"
URL_DICIONARIO = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.pdf"
# Áreas de carga do tipo submercado, na grafia da API; SE = Sudeste/Centro-Oeste ("SECO").
AREAS = {"SE": "SECO", "S": "S", "NE": "NE", "N": "N"}
HORAS_INTERVALO = 0.5
PRIMEIRO_MES = "2019-01"  # primeiro mês pedido; o primeiro dia com valor de MMGD é 15/02/2019 (antes vem vazio)
CAMPOS = ("val_cargammgd", "val_cargaglobal", "val_cargaglobalsmmgd")

_VAZIO = re.compile(r":\s*(?=[,}\]])")


def url(area, inicio, fim):
    return f"{URL_API}?dat_inicio={inicio}&dat_fim={fim}&cod_areacarga={area}"


def parse(texto):
    """Lista de dicts da resposta. Campo vazio vira None (a API emite `"campo": ,`)."""
    if isinstance(texto, bytes):
        texto = texto.decode("utf-8")
    corrigido = _VAZIO.sub(": null", texto)
    dados = json.loads(corrigido)
    if not isinstance(dados, list):
        raise ValueError("resposta da API não é lista")
    return dados


def agrega_diario(registros, dia_limite=None):
    """{(area, dia): {mmgd_mwh, global_mwh, semmmgd_mwh, n_mmgd, n_global}}.

    Um intervalo sem valor não entra na soma nem nas horas daquele campo (ausência não é
    zero); intervalo repetido (mesmo din_referenciautc) conta uma vez, com o último valor.

    `dia_limite` (AAAA-MM-DD, data de Brasília da captura): dias a partir dele são
    descartados. Em 30/09/2026 a API devolveu as 48 meias horas do próprio dia 30, com
    carga global 0 nas horas que ainda não tinham acontecido: zero ali é "ainda não
    verificado", não carga nula, e um dia em curso não é dia completo."""
    unicos = {}
    for x in registros:
        chave = (x.get("cod_areacarga"), x.get("din_referenciautc"))
        if not chave[0] or not chave[1]:
            continue
        unicos[chave] = x
    out = defaultdict(lambda: {"mmgd_mwh": 0.0, "global_mwh": 0.0, "semmmgd_mwh": 0.0,
                               "n_mmgd": 0, "n_global": 0, "n_semmmgd": 0})
    for (area, _), x in unicos.items():
        dia = x.get("dat_referencia")
        if not dia or (dia_limite and dia[:10] >= dia_limite):
            continue
        a = out[(area, dia[:10])]
        for campo, soma, n in (("val_cargammgd", "mmgd_mwh", "n_mmgd"), ("val_cargaglobal", "global_mwh", "n_global"),
                               ("val_cargaglobalsmmgd", "semmmgd_mwh", "n_semmmgd")):
            v = x.get(campo)
            if v is None:
                continue
            a[soma] += float(v) * HORAS_INTERVALO
            a[n] += 1
    return dict(out)


def observacoes(diario, sm_por_area=None):
    """Linhas (serie, ref, valor) por submercado e dia: energia (MWh) e horas cobertas."""
    sm_por_area = sm_por_area or {v: k for k, v in AREAS.items()}
    for (area, dia), a in diario.items():
        sm = sm_por_area.get(area)
        if not sm:
            continue
        if a["n_mmgd"]:
            yield f"mmgd_mwh.{sm}", dia, round(a["mmgd_mwh"], 4)
            yield f"horas_mmgd.{sm}", dia, a["n_mmgd"] * HORAS_INTERVALO
        if a["n_global"]:
            yield f"global_mwh.{sm}", dia, round(a["global_mwh"], 4)
            yield f"horas_global.{sm}", dia, a["n_global"] * HORAS_INTERVALO
        if a["n_semmmgd"]:
            yield f"semmmgd_mwh.{sm}", dia, round(a["semmmgd_mwh"], 4)
