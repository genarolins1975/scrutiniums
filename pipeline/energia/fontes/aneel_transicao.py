"""Leitura e agregação da Relação de empreendimentos de MMGD (ANEEL) para o módulo Transição.

O arquivo oficial tem um registro por empreendimento de micro ou minigeração distribuída
(4,66 milhões de linhas em 29/09/2026). O silver guarda os agregados no grão publicado,
nunca as linhas: o original fica no bronze com sha256 e contém dados pessoais tarjados
(CPF parcial, CEP parcial, nome do titular pessoa jurídica) que não têm uso analítico aqui.

Decisões verificadas contra a fonte em 30/09/2026 (docs/observatorios/energia/modulos/transicao.md):

- A data do registro é `DthAtualizaCadastralEmpreend`. O dicionário de dados v2.3
  (17/11/2025) a descreve como "data da última atualização cadastral", mas a descrição
  do conjunto lista a "data da conexão" entre as variáveis e não há outro campo de data
  por empreendimento. O recurso de informações técnicas fotovoltaicas do mesmo conjunto
  traz `DatConexao` ("Data da conexão da Unidade Geradora"): nos 4.655.916 empreendimentos
  UFV, as duas datas coincidem em 100% dos casos. Tratamos o campo como data de conexão
  e publicamos essa conferência como controle.
- Datas-sentinela (ano 1900, 46 registros de cooperativas) não são datas: o registro
  entra no estoque, sem ano de conexão ("sem_data").
- Município: o código IBGE vem com 7 dígitos, exceto casos isolados com 6 (o código sem
  o dígito verificador). O código de 6 dígitos é completado apenas quando existe um único
  município IBGE com esse prefixo (regra do próprio código IBGE, não semelhança de nome).
- UF: derivada do código IBGE do município (os dois primeiros dígitos), que é o que
  localiza a unidade no território; divergência com `SigUF` é contada no controle.
- Distribuidora: identificada pelo CNPJ de 14 dígitos (entidades.cnpj). A sigla e o nome
  variam (ex.: "Âmbar Amazonas" com o CNPJ da antiga Amazonas Energia) e são guardados
  como atributos, nunca como chave.
- Potência em kW como publicada (soma das potências nominais das unidades geradoras).
  É capacidade cadastrada, não energia gerada.
"""
import os
import sys
from collections import Counter, defaultdict
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import entidades  # noqa: E402
from pipeline.energia.fontes.ckan import numero_br  # noqa: E402

# Código IBGE de UF (dois primeiros dígitos do código de município) → sigla. Tabela oficial
# de códigos de UF do IBGE; é identificação, não dado numérico.
UF_POR_CODIGO = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}
NOME_UF = {
    "RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima", "PA": "Pará", "AP": "Amapá", "TO": "Tocantins",
    "MA": "Maranhão", "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte", "PB": "Paraíba", "PE": "Pernambuco",
    "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia", "MG": "Minas Gerais", "ES": "Espírito Santo", "RJ": "Rio de Janeiro",
    "SP": "São Paulo", "PR": "Paraná", "SC": "Santa Catarina", "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul",
    "MT": "Mato Grosso", "GO": "Goiás", "DF": "Distrito Federal",
}

# SigTipoGeracao (dicionário v2.3) → grupo de fonte publicado. UTN e CGU constam do
# domínio do dicionário mas não aparecem na MMGD; se aparecerem, vão para "outra".
GRUPO_FONTE = {"UFV": "solar", "EOL": "eolica", "CGH": "hidraulica", "PCH": "hidraulica", "UHE": "hidraulica",
               "UTE": "termica", "UTN": "outra", "CGU": "outra"}
ROTULO_FONTE = {"solar": "Solar fotovoltaica", "eolica": "Eólica", "hidraulica": "Hidráulica",
                "termica": "Termelétrica (biogás, biomassa e outros combustíveis)", "outra": "Outra",
                "nao_informada": "Fonte não informada"}
ORDEM_FONTES = ("solar", "termica", "hidraulica", "eolica", "outra", "nao_informada")

SEM_DATA = "sem_data"
# Anos abaixo deste limite são tratados como sentinela (ex.: 1900-01-01), não como data.
# A MMGD foi regulamentada em 2012 e a própria ANEEL declara cobertura a partir de dez/2008;
# registros entre 2000 e 2012 são mantidos como publicados e contados no controle.
ANO_MINIMO_VALIDO = 2000
INICIO_COBERTURA_DECLARADA = "2008-12"

# Colunas lidas do Parquet (as de dado pessoal ficam de fora de propósito).
COLUNAS = ["DatGeracaoConjuntoDados", "NumCNPJDistribuidora", "SigAgente", "NomAgente", "DscClasseConsumo",
           "DscSubGrupoTarifario", "CodUFibge", "SigUF", "CodMunicipioIbge", "SigTipoConsumidor",
           "CodEmpreendimento", "DthAtualizaCadastralEmpreend", "DscModalidadeHabilitado", "QtdUCRecebeCredito",
           "SigTipoGeracao", "DscFonteGeracao", "DscPorte", "MdaPotenciaInstaladaKW"]
# Chave da duplicidade candidata: tudo que se observa do empreendimento, menos o código.
CHAVE_DUPLICIDADE = ["NumCNPJDistribuidora", "CodMunicipioIbge", "CodCEP", "DthAtualizaCadastralEmpreend",
                     "MdaPotenciaInstaladaKW", "DscClasseConsumo", "NumCPFCNPJ", "DscModalidadeHabilitado"]


def _txt(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _data(v):
    """date|None a partir de date, datetime ou texto 'AAAA-MM-DD' (CSV)."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v).strip()[:10])
    except ValueError:
        return None


def _num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return numero_br(v)


def codigo_municipio(bruto, ibge_por_prefixo6=None, ibge_validos=None):
    """(código IBGE de 7 dígitos | None, situação) a partir do valor publicado.

    situação: "ok", "completado_6" (6 dígitos completados pelo prefixo único no cadastro
    IBGE), "fora_ibge" (7 dígitos que não existem na lista IBGE usada), "invalido"."""
    s = _txt(bruto)
    if s is None:
        return None, "invalido"
    s = s.split(".")[0]
    if not s.isdigit():
        return None, "invalido"
    if len(s) == 7:
        if ibge_validos is not None and s not in ibge_validos:
            return s, "fora_ibge"
        return s, "ok"
    if len(s) == 6 and ibge_por_prefixo6:
        alvo = ibge_por_prefixo6.get(s)
        if alvo:
            return alvo, "completado_6"
    return None, "invalido"


def normaliza(raw, ibge_por_prefixo6=None, ibge_validos=None):
    """Registro normalizado (dict) a partir de uma linha do Parquet ou do CSV oficial."""
    mun, sit_mun = codigo_municipio(raw.get("CodMunicipioIbge"), ibge_por_prefixo6, ibge_validos)
    uf_mun = UF_POR_CODIGO.get(mun[:2]) if mun else None
    uf_pub = _txt(raw.get("SigUF"))
    dconx = _data(raw.get("DthAtualizaCadastralEmpreend"))
    if dconx is not None and dconx.year < ANO_MINIMO_VALIDO:
        periodo_ok = False
    else:
        periodo_ok = dconx is not None
    tipo = _txt(raw.get("SigTipoGeracao"))
    tipo = tipo.upper() if tipo else None
    grupo = GRUPO_FONTE.get(tipo, "outra") if tipo else "nao_informada"
    return {
        "codigo": _txt(raw.get("CodEmpreendimento")),
        "cnpj": entidades.cnpj(raw.get("NumCNPJDistribuidora")),
        "sigla": _txt(raw.get("SigAgente")),
        "nome_dist": _txt(raw.get("NomAgente")),
        "mun": mun, "situacao_mun": sit_mun,
        "uf": uf_mun or uf_pub,
        "uf_publicada": uf_pub,
        "classe": _txt(raw.get("DscClasseConsumo")),
        "subgrupo": (_txt(raw.get("DscSubGrupoTarifario")) or "").upper() or None,
        "tipo_consumidor": _txt(raw.get("SigTipoConsumidor")),
        "modalidade": _txt(raw.get("DscModalidadeHabilitado")),
        "ucs_credito": _num(raw.get("QtdUCRecebeCredito")),
        "tipo_geracao": tipo,
        "fonte_desc": _txt(raw.get("DscFonteGeracao")),
        "fonte": grupo,
        "porte": _txt(raw.get("DscPorte")),
        "kw": _num(raw.get("MdaPotenciaInstaladaKW")),
        "data": dconx if periodo_ok else None,
        "data_bruta": dconx,
        "data_conjunto": _data(raw.get("DatGeracaoConjuntoDados")),
    }


class Agregador:
    """Soma unidades (contagem de empreendimentos) e potência (kW) nos grãos publicados.

    Um empreendimento conta uma vez, pelo código; a potência ausente não vira zero (a
    unidade conta, a potência dela fica fora da soma e o caso é contado no controle)."""

    def __init__(self):
        self.mun_ano_fonte = defaultdict(lambda: [0, 0.0])
        self.uf_mes_fonte = defaultdict(lambda: [0, 0.0])
        self.dist_uf_ano = defaultdict(lambda: [0, 0.0])
        self.dist_mun = defaultdict(set)
        self.classe_ano = defaultdict(lambda: [0, 0.0])
        self.modalidade_ano = defaultdict(lambda: [0, 0.0])
        self.porte_ano = defaultdict(lambda: [0, 0.0])
        self.tipo_consumidor_ano = defaultdict(lambda: [0, 0.0])
        self.fonte_detalhe_ano = defaultdict(lambda: [0, 0.0])
        self.ucs_credito_uf_ano = defaultdict(float)
        self.nomes_dist = defaultdict(Counter)
        self.datas_conjunto = Counter()
        self.c = Counter()

    @staticmethod
    def _soma(d, chave, kw):
        a = d[chave]
        a[0] += 1
        if kw is not None:
            a[1] += kw

    def adiciona(self, r):
        c = self.c
        c["linhas"] += 1
        kw = r["kw"]
        if kw is None:
            c["potencia_ausente"] += 1
        elif kw < 0:
            c["potencia_negativa"] += 1
            kw = None  # grandeza sem sinal: valor negativo não entra na soma e fica no controle
        elif kw == 0:
            c["potencia_zero"] += 1
        if r["data"] is None:
            c["data_invalida" if r["data_bruta"] is not None else "data_ausente"] += 1
            ano, mes = SEM_DATA, SEM_DATA
        else:
            ano, mes = f"{r['data'].year:04d}", r["data"].strftime("%Y-%m")
            if mes < INICIO_COBERTURA_DECLARADA:
                c["anterior_cobertura_declarada"] += 1
            if r["data_conjunto"] and r["data"] > r["data_conjunto"]:
                c["data_posterior_ao_conjunto"] += 1
        c[f"municipio_{r['situacao_mun']}"] += 1
        if r["uf_publicada"] and r["uf"] and r["uf_publicada"] != r["uf"]:
            c["uf_publicada_diverge_do_municipio"] += 1
        if not r["uf_publicada"]:
            c["uf_publicada_ausente"] += 1
        if r["fonte"] == "nao_informada":
            c["fonte_nao_informada"] += 1
        if not r["sigla"]:
            c["sigla_distribuidora_ausente"] += 1
        if r["codigo"] and r["uf"] and len(r["codigo"]) > 5 and r["codigo"][3:5] != r["uf"]:
            c["uf_do_codigo_diverge"] += 1
        if r["data_conjunto"]:
            self.datas_conjunto[r["data_conjunto"].isoformat()] += 1
        mun = r["mun"] or "sem_municipio"
        uf = r["uf"] or "sem_uf"
        cnpj = r["cnpj"] or "sem_cnpj"
        self._soma(self.mun_ano_fonte, (mun, ano, r["fonte"]), kw)
        self._soma(self.uf_mes_fonte, (uf, mes, r["fonte"]), kw)
        self._soma(self.dist_uf_ano, (cnpj, uf, ano), kw)
        if r["mun"]:
            self.dist_mun[cnpj].add(r["mun"])
        self._soma(self.classe_ano, (r["classe"] or "nao_informada", ano), kw)
        self._soma(self.modalidade_ano, (r["modalidade"] or "nao_informada", ano), kw)
        self._soma(self.porte_ano, (r["porte"] or "nao_informado", ano), kw)
        self._soma(self.tipo_consumidor_ano, (r["tipo_consumidor"] or "nao_informado", ano), kw)
        self._soma(self.fonte_detalhe_ano, (r["tipo_geracao"] or "nao_informado", r["fonte_desc"] or "nao_informada", ano), kw)
        if r["ucs_credito"] is not None:
            self.ucs_credito_uf_ano[(uf, ano)] += r["ucs_credito"]
        else:
            c["ucs_credito_ausente"] += 1
        self.nomes_dist[cnpj][(r["sigla"] or "", r["nome_dist"] or "")] += 1

    def observacoes(self):
        """Linhas (serie, ref, valor) para base.grava_observacoes. Referência composta
        `entidade|período[|fonte]`: poucas séries e muitas referências, para o controle de
        revisão funcionar por combinação sem estourar o limite de parâmetros do SQLite."""
        def dois(serie, d, chave_ref):
            for k, (q, kw) in d.items():
                ref = chave_ref(k)
                yield f"qtd.{serie}", ref, float(q)
                yield f"kw.{serie}", ref, round(kw, 4)
        yield from dois("mun_ano_fonte", self.mun_ano_fonte, lambda k: "|".join(k))
        yield from dois("uf_mes_fonte", self.uf_mes_fonte, lambda k: "|".join(k))
        yield from dois("dist_uf_ano", self.dist_uf_ano, lambda k: "|".join(k))
        yield from dois("classe_ano", self.classe_ano, lambda k: "|".join(k))
        yield from dois("modalidade_ano", self.modalidade_ano, lambda k: "|".join(k))
        yield from dois("porte_ano", self.porte_ano, lambda k: "|".join(k))
        yield from dois("tipo_consumidor_ano", self.tipo_consumidor_ano, lambda k: "|".join(k))
        yield from dois("fonte_detalhe_ano", self.fonte_detalhe_ano, lambda k: "|".join(k))
        for (uf, ano), v in self.ucs_credito_uf_ano.items():
            yield "ucs_credito.uf_ano", f"{uf}|{ano}", float(v)
        for cnpj, muns in self.dist_mun.items():
            yield "municipios.dist", cnpj, float(len(muns))

    def controles(self):
        return dict(self.c)


def agrega(registros, ibge_por_prefixo6=None, ibge_validos=None):
    """Agregador preenchido a partir de dicts crus (linhas do Parquet ou do CSV)."""
    ag = Agregador()
    for raw in registros:
        ag.adiciona(normaliza(raw, ibge_por_prefixo6, ibge_validos))
    return ag


def linhas_parquet(caminho, lote=250_000):
    """Itera as linhas do Parquet oficial como dicts, em lotes (memória limitada)."""
    import pyarrow.parquet as pq
    arq = pq.ParquetFile(caminho)
    cols = [c for c in COLUNAS if c in arq.schema_arrow.names]
    for bloco in arq.iter_batches(batch_size=lote, columns=cols):
        d = bloco.to_pydict()
        nomes = list(d)
        for valores in zip(*(d[n] for n in nomes)):
            yield dict(zip(nomes, valores))


def controles_tabela(caminho):
    """Controles que pedem a tabela inteira, feitos no motor do pyarrow (sem carregar
    milhões de tuplas no Python): unicidade do código e duplicidade candidata."""
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    nomes = pq.ParquetFile(caminho).schema_arrow.names
    t = pq.read_table(caminho, columns=["CodEmpreendimento"])
    vc = pc.value_counts(t["CodEmpreendimento"])
    contagens = vc.field("counts")
    repetidos = pc.filter(vc, pc.greater(contagens, 1))
    out = {
        "codigos_distintos": len(vc),
        "codigos_repetidos": len(repetidos),
        "codigo_ausente": t["CodEmpreendimento"].null_count,
    }
    chave = [c for c in CHAVE_DUPLICIDADE if c in nomes]
    out.update(duplicidade_candidata(pq.read_table(caminho, columns=chave), chave))
    return out


def duplicidade_candidata(tabela, chave=None):
    """Grupos de empreendimentos com todos os atributos observáveis iguais (distribuidora,
    município, CEP, data, potência, classe, CPF/CNPJ tarjado e modalidade) e códigos
    distintos. Não é prova de duplicidade: o CPF e o CEP de pessoa física vêm tarjados na
    fonte, e uma mesma pessoa jurídica pode registrar várias unidades iguais no mesmo dia.
    O controle mede a magnitude; nada é removido."""
    import pyarrow.compute as pc
    chave = chave or [c for c in CHAVE_DUPLICIDADE if c in tabela.column_names]
    g = tabela.group_by(chave, use_threads=False).aggregate([([], "count_all")])
    n = g["count_all"]
    mask = pc.greater(n, 1)
    grupos = g.filter(mask)
    extras = pc.subtract(grupos["count_all"], 1)
    kw_extra = None
    if "MdaPotenciaInstaladaKW" in chave:
        kw = grupos["MdaPotenciaInstaladaKW"]
        kw_extra = pc.sum(pc.multiply(pc.cast(kw, "double"), pc.cast(extras, "double"))).as_py() or 0.0
    return {
        "duplicidade_candidata_grupos": len(grupos),
        "duplicidade_candidata_linhas_extras": int(pc.sum(extras).as_py() or 0),
        "duplicidade_candidata_kw_extras": round(kw_extra, 2) if kw_extra is not None else None,
        "duplicidade_candidata_maior_grupo": int(pc.max(n).as_py() or 0) if len(n) else 0,
    }


def concordancia_datas(caminho_relacao, caminho_tecnico_fv):
    """Controle semântico da data: DthAtualizaCadastralEmpreend (relação) × DatConexao
    (informações técnicas fotovoltaicas, "Data da conexão da Unidade Geradora"), pelo
    código do empreendimento. Também compara a potência instalada dos dois recursos."""
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    a = pq.read_table(caminho_relacao, columns=["CodEmpreendimento", "DthAtualizaCadastralEmpreend",
                                                "MdaPotenciaInstaladaKW", "SigTipoGeracao"])
    b = pq.read_table(caminho_tecnico_fv, columns=["CodGeracaoDistribuida", "DatConexao", "MdaPotenciaInstalada"])
    ufv = a.filter(pc.equal(a["SigTipoGeracao"], "UFV"))
    j = ufv.join(b, keys="CodEmpreendimento", right_keys="CodGeracaoDistribuida", join_type="inner")
    iguais = pc.equal(j["DthAtualizaCadastralEmpreend"], j["DatConexao"])
    pot = pc.less_equal(pc.abs(pc.subtract(j["MdaPotenciaInstaladaKW"], j["MdaPotenciaInstalada"])), 0.005)
    return {
        "ufv_na_relacao": ufv.num_rows,
        "registros_no_tecnico": b.num_rows,
        "pareados_por_codigo": j.num_rows,
        "datas_iguais": int(pc.sum(pc.cast(pc.fill_null(iguais, False), "int64")).as_py() or 0),
        "potencias_iguais": int(pc.sum(pc.cast(pc.fill_null(pot, False), "int64")).as_py() or 0),
    }
