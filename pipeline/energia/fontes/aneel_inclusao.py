"""Leitores das fontes da ANEEL usadas no módulo Inclusão energética.

1. SCS (Sistema de Controle de Subvenções e Programas Sociais), recurso
   sistema-controle-subvencoes-programas-sociais.csv: uma linha por distribuidora,
   competência, despacho e faixa de consumo (1 a 5). Contagens de unidades
   consumidoras (UC) da subclasse residencial baixa renda por modalidade, energia
   faturada, faturamento e o total da classe residencial; e a Diferença Mensal de
   Receita (DMR) aprovada, com a parcela custeada pela CDE.
   Armadilhas conferidas no arquivo de 20/09/2026:
   - a DMR e suas parcelas vêm REPETIDAS nas cinco linhas de faixa de um mesmo
     despacho (é um valor da distribuidora no mês, não da faixa): somar as faixas
     multiplicaria a DMR por cinco;
   - 1.018 pares (distribuidora, competência) aparecem em mais de um despacho; em 1.016
     os valores são idênticos (republicação) e em 2 diferem (abr/2020). Regra: vale o
     despacho mais recente (data de registro, depois competência do despacho, depois
     número), e os demais ficam registrados como alternativos.
2. Beneficiários da CDE, arquivos mensais cde-beneficiarios-01<mes><ano>.zip: um CSV
   por mês com uma linha por faturamento de cada UC beneficiada por desconto custeado
   pela CDE, com nome e CPF mascarado do cliente. O módulo lê o arquivo em fluxo e
   guarda SÓ agregados por distribuidora (CNPJ), município (código IBGE), subclasse e
   tipo de faturamento; nenhum campo pessoal é lido para o silver nem publicado.
3. Tarifa Social de Energia Elétrica: Beneficiários (conjunto descontinuado): série
   trimestral por grande região, 2012 a 2019. O recurso no portal redireciona para si
   mesmo (laço de HTTP 302 conferido em 30/09/2026); a cópia usada é a arquivada pelo
   Internet Archive em 29/07/2024, identificada como tal.
4. CDE: custeio dos benefícios tarifários: valores anuais por finalidade da CDE.
"""
import csv
import io
import re
import zipfile

from pipeline.energia import entidades

# ---------------------------------------------------------------- SCS

CAMPOS_SCS = ("DatGeracaoConjuntoDados", "AnmMesAnoCompetencia", "SigAgente", "NumCNPJAgente",
              "AnmCompetenciaDespacho", "NumDespacho", "DatRegistro", "IdcFaixa", "MdaMWhConsResTotal",
              "QtdConsResTotal", "VlrDMR", "VlrCDE", "VlrTarifa", "IdcSituacaoLote", "NumConsBaixaRenda",
              "NumConsIndigena", "NumConsQuilombola", "NumConsBPC", "NumConsMultifamiliar", "MdaMWhBaixaRenda",
              "MdaMWhIndigena", "MdaMWhQuilombola", "MdaMWhBPC", "MdaMWhMultifamiliar", "VlrFatRealBaixaRenda",
              "VlrFatRealIndigena", "VlrFatRealQuilombola", "VlrFatRealBPC", "VlrFatRealMultifamiliar",
              "VlrFatRealTotal")

# modalidades da subclasse residencial baixa renda (dicionário do SCS, versão 1.0 de 16/04/2024)
MODALIDADES = (("baixa_renda", "BaixaRenda"), ("indigena", "Indigena"), ("quilombola", "Quilombola"),
               ("bpc", "BPC"), ("multifamiliar", "Multifamiliar"))
FAIXAS = {"1": "até 30 kWh", "2": "31 a 50 kWh", "3": "51 a 100 kWh", "4": "101 a 220 kWh", "5": "acima de 220 kWh"}
SITUACAO_LOTE = {"2": "homologado previamente", "4": "aprovado com pendência",
                 "8": "aprovado com pendência anual"}


def numero(s):
    """Número no formato do SCS e da CDE ('1234,56', ',00', '1.234,56') → float; vazio é
    ausência (None), nunca zero."""
    if s is None:
        return None
    s = str(s).strip().strip('"')
    if not s or s.upper() in ("NA", "NULL", "-"):
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def competencia(aaaamm):
    s = str(aaaamm or "").strip()
    if not re.fullmatch(r"\d{6}", s):
        return None
    return f"{s[:4]}-{s[4:]}"


def le_scs(linhas):
    """Linhas do CSV do SCS (dicts) → (escolhidos, diagnostico).

    escolhidos: {(cnpj14, 'AAAA-MM'): registro} com o despacho vigente pela regra do
    módulo; registro = {cnpj, sigla, competencia, despacho, data_registro,
    competencia_despacho, situacao, alternativos: [...], divergentes: bool,
    faixas: {faixa: {campo: valor}}, dmr, dmr_cde, dmr_tarifa}.
    diagnostico: contagens para a auditoria (linhas, despachos repetidos, divergências,
    faixas incompletas, DMR variando entre faixas)."""
    grupos = {}
    diag = {"linhas": 0, "linhas_sem_competencia": 0, "cabecalho_faltando": [], "data_geracao": set()}
    primeira = True
    for r in linhas:
        if primeira:
            diag["cabecalho_faltando"] = [c for c in CAMPOS_SCS if c not in r]
            primeira = False
        diag["linhas"] += 1
        comp = competencia(r.get("AnmMesAnoCompetencia"))
        cnpj = entidades.cnpj(r.get("NumCNPJAgente"))
        if comp is None or cnpj is None:
            diag["linhas_sem_competencia"] += 1
            continue
        diag["data_geracao"].add((r.get("DatGeracaoConjuntoDados") or "").strip())
        chave_desp = ((r.get("DatRegistro") or "").strip(), (r.get("AnmCompetenciaDespacho") or "").strip(),
                      (r.get("NumDespacho") or "").strip())
        grupos.setdefault((cnpj, comp), {}).setdefault(chave_desp, []).append(r)
    escolhidos = {}
    repetidos = divergentes = faixas_incompletas = dmr_varia = 0
    for (cnpj, comp), desp in grupos.items():
        ordem = sorted(desp, key=lambda k: (k[0], k[1], _num_despacho(k[2])))
        vig = ordem[-1]
        rs = desp[vig]
        if len(desp) > 1:
            repetidos += 1
        assinaturas = {k: _assinatura(v) for k, v in desp.items()}
        diverge = len(set(assinaturas.values())) > 1
        if diverge:
            divergentes += 1
        faixas = {}
        for r in rs:
            f = (r.get("IdcFaixa") or "").strip()
            faixas[f] = {
                "uc_residencial": numero(r.get("QtdConsResTotal")),
                "mwh_residencial": numero(r.get("MdaMWhConsResTotal")),
                "fat_residencial": numero(r.get("VlrFatRealTotal")),
                **{f"uc_{m}": numero(r.get(f"NumCons{s}")) for m, s in MODALIDADES},
                **{f"mwh_{m}": numero(r.get(f"MdaMWh{s}")) for m, s in MODALIDADES},
                **{f"fat_{m}": numero(r.get(f"VlrFatReal{s}")) for m, s in MODALIDADES},
            }
        if sorted(faixas) != sorted(FAIXAS):
            faixas_incompletas += 1
        dmrs = {(r.get("VlrDMR"), r.get("VlrCDE"), r.get("VlrTarifa")) for r in rs}
        if len(dmrs) > 1:
            dmr_varia += 1
        r0 = rs[0]
        escolhidos[(cnpj, comp)] = {
            "cnpj": cnpj, "sigla": (r0.get("SigAgente") or "").strip(), "competencia": comp,
            "despacho": vig[2], "data_registro": vig[0], "competencia_despacho": competencia(vig[1]),
            "situacao": (r0.get("IdcSituacaoLote") or "").strip(),
            "alternativos": [f"{k[2]} ({k[0]})" for k in ordem[:-1]],
            "divergentes": diverge,
            "faixas": faixas,
            # valor da distribuidora no mês: lido uma vez, nunca somado entre faixas
            "dmr": numero(r0.get("VlrDMR")), "dmr_cde": numero(r0.get("VlrCDE")),
            "dmr_tarifa": numero(r0.get("VlrTarifa")),
        }
    diag.update(pares=len(escolhidos), pares_com_mais_de_um_despacho=repetidos,
                pares_com_despachos_divergentes=divergentes, pares_com_faixas_incompletas=faixas_incompletas,
                pares_com_dmr_variando_entre_faixas=dmr_varia, data_geracao=sorted(diag["data_geracao"]))
    return escolhidos, diag


def _num_despacho(s):
    m = re.match(r"(\d+)\s*/\s*(\d{4})", s or "")
    return (int(m.group(2)), int(m.group(1))) if m else (0, 0)


def _assinatura(rs):
    campos = ("IdcFaixa", "QtdConsResTotal", "NumConsBaixaRenda", "NumConsIndigena", "NumConsQuilombola",
              "NumConsBPC", "NumConsMultifamiliar", "MdaMWhBaixaRenda", "VlrDMR", "VlrCDE")
    return tuple(sorted(tuple((r.get(c) or "").strip() for c in campos) for r in rs))


def totais_scs(reg):
    """Somas por distribuidora e mês a partir das faixas de um registro escolhido."""
    out = {}
    for f in reg["faixas"].values():
        for k, v in f.items():
            if v is None:
                continue
            out[k] = out.get(k, 0.0) + v
    uc_tsee = [out.get(f"uc_{m}") for m, _ in MODALIDADES]
    out["uc_tsee"] = sum(x for x in uc_tsee if x is not None) if any(x is not None for x in uc_tsee) else None
    mwh = [out.get(f"mwh_{m}") for m, _ in MODALIDADES]
    out["mwh_tsee"] = sum(x for x in mwh if x is not None) if any(x is not None for x in mwh) else None
    fat = [out.get(f"fat_{m}") for m, _ in MODALIDADES]
    out["fat_tsee"] = sum(x for x in fat if x is not None) if any(x is not None for x in fat) else None
    out["dmr"] = reg["dmr"]
    out["dmr_cde"] = reg["dmr_cde"]
    out["dmr_tarifa"] = reg["dmr_tarifa"]
    return out


def observacoes_scs(escolhidos):
    """(serie, ref, valor) para o silver: totais por distribuidora e mês e as contagens
    de UC por faixa de consumo (a faixa é informação própria do SCS)."""
    for (cnpj, comp), reg in escolhidos.items():
        tot = totais_scs(reg)
        for k, v in tot.items():
            if v is not None:
                yield (f"{cnpj}.{k}", comp, v)
        for f, vals in reg["faixas"].items():
            tsee = [vals.get(f"uc_{m}") for m, _ in MODALIDADES]
            if any(x is not None for x in tsee):
                yield (f"{cnpj}.f{f}.uc_tsee", comp, sum(x for x in tsee if x is not None))
            if vals.get("uc_residencial") is not None:
                yield (f"{cnpj}.f{f}.uc_residencial", comp, vals["uc_residencial"])


def registros_scs(escolhidos):
    """(chave, campo, valor) textuais: despacho vigente, alternativos e sigla."""
    for (cnpj, comp), reg in escolhidos.items():
        ch = f"{cnpj}|{comp}"
        yield (ch, "sigla", reg["sigla"])
        yield (ch, "despacho", reg["despacho"])
        yield (ch, "data_registro", reg["data_registro"])
        yield (ch, "situacao", reg["situacao"])
        yield (ch, "alternativos", "; ".join(reg["alternativos"]) or None)
        yield (ch, "divergentes", "sim" if reg["divergentes"] else None)


# ---------------------------------------------------------------- Beneficiários da CDE

CAMPOS_CDE = ("DatGeracaoConjuntoDados", "AnmReferencia", "SigAgente", "NumCNPJDistribuidora", "CodIbgeMunicipio",
              "IdcTipoFaturamento", "IdcClasseConsumidor", "IdcSubclasse", "IdcSubgrupoTarifario",
              "IdcTipoCompraEnergia", "NomCliente", "NumCPFCNPJCliente", "DscTipoSubsidio", "VlrSubsidio")
TIPO_TSEE = "SubsBaixaRenda"
TIPOS_FATURAMENTO = {"1": "faturamento", "2": "cancelamento", "3": "refaturamento tipo 1", "4": "refaturamento tipo 2"}
SUBCLASSES_TSEE = {"3.2": "baixa renda", "3.3": "baixa renda indígena", "3.4": "baixa renda quilombola",
                   "3.5": "baixa renda BPC", "3.6": "baixa renda multifamiliar"}
# campos que o agregador lê; os pessoais (NomCliente, NumCPFCNPJCliente) ficam de fora
_LIDOS_CDE = ("AnmReferencia", "SigAgente", "NumCNPJDistribuidora", "CodIbgeMunicipio", "IdcTipoFaturamento",
              "IdcSubclasse", "DscTipoSubsidio", "VlrSubsidio")


def municipio_valido(cod):
    """Código IBGE de município com 7 dígitos e UF existente; outro formato é inválido."""
    s = str(cod or "").strip()
    return s if re.fullmatch(r"[1-5]\d{6}", s) else None


def agrega_cde(fluxo_texto):
    """Agrega em fluxo o CSV mensal de beneficiários da CDE (texto já decodificado).

    Retorna {"chaves": {(cnpj14, mun7|'invalido', subclasse, tipo_fat): [n, soma_R$]},
    "siglas": {cnpj14: sigla}, "referencias": {...}, "linhas": n, "linhas_tsee": n,
    "cabecalho_faltando": [...], "valores_invalidos": n}. Só entram linhas com
    DscTipoSubsidio = SubsBaixaRenda (desconto da Tarifa Social). Nenhum campo pessoal
    é lido."""
    leitor = csv.reader(fluxo_texto)
    cab = [c.strip().lstrip("﻿").strip('"') for c in next(leitor)]
    faltando = [c for c in CAMPOS_CDE if c not in cab]
    if any(c in faltando for c in _LIDOS_CDE):
        raise ValueError(f"esquema do arquivo de beneficiários da CDE mudou: faltam {faltando}")
    ix = {c: cab.index(c) for c in _LIDOS_CDE}
    chaves, siglas, refs = {}, {}, {}
    n = n_tsee = invalidos = 0
    i_tipo, i_ref, i_cnpj, i_sig = ix["DscTipoSubsidio"], ix["AnmReferencia"], ix["NumCNPJDistribuidora"], ix["SigAgente"]
    i_mun, i_tf, i_sc, i_v = ix["CodIbgeMunicipio"], ix["IdcTipoFaturamento"], ix["IdcSubclasse"], ix["VlrSubsidio"]
    for row in leitor:
        if not row:
            continue
        n += 1
        if row[i_tipo].strip() != TIPO_TSEE:
            continue
        n_tsee += 1
        ref = row[i_ref].strip()
        refs[ref] = refs.get(ref, 0) + 1
        cnpj = entidades.cnpj(row[i_cnpj])
        if cnpj is None:
            invalidos += 1
            continue
        siglas[cnpj] = row[i_sig].strip()
        mun = municipio_valido(row[i_mun]) or "invalido"
        v = numero(row[i_v])
        if v is None:
            invalidos += 1
            v = 0.0
            chave = (cnpj, mun, row[i_sc].strip(), row[i_tf].strip())
            a = chaves.setdefault(chave, [0, 0.0, 0])
            a[0] += 1
            a[2] += 1  # linha sem valor: contada, sem somar valor
            continue
        chave = (cnpj, mun, row[i_sc].strip(), row[i_tf].strip())
        a = chaves.setdefault(chave, [0, 0.0, 0])
        a[0] += 1
        a[1] += v
    return {"chaves": chaves, "siglas": siglas, "referencias": refs, "linhas": n, "linhas_tsee": n_tsee,
            "cabecalho_faltando": faltando, "valores_invalidos": invalidos}


def agrega_cde_zip(caminho_ou_arquivo):
    """Abre o ZIP mensal (caminho ou objeto binário) e agrega o primeiro CSV em fluxo.
    A ANEEL publica em Latin-1 (acentos de nomes aparecem como '?' em parte das linhas);
    o agregador não depende de nenhum campo com acento."""
    z = zipfile.ZipFile(caminho_ou_arquivo)
    nome = next(n for n in z.namelist() if n.lower().endswith(".csv"))
    with z.open(nome) as bruto:
        texto = io.TextIOWrapper(bruto, encoding="latin-1", newline="")
        out = agrega_cde(texto)
    out["membro"] = nome
    return out


def mes_do_recurso(nome_ou_url):
    """'cde-beneficiarios-01may2026.zip' ou 'Beneficiários da CDE - mai/26' → '2026-05'."""
    s = (nome_ou_url or "").lower()
    en = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10,
          "nov": 11, "dec": 12}
    pt = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10,
          "nov": 11, "dez": 12}
    m = re.search(r"cde-beneficiarios-01([a-z]{3})(\d{4})", s)
    if m and m.group(1) in en:
        return f"{m.group(2)}-{en[m.group(1)]:02d}"
    m = re.search(r"-\s*([a-z]{3})/(\d{2})\b", s)
    if m and m.group(1) in pt:
        return f"20{m.group(2)}-{pt[m.group(1)]:02d}"
    return None


def observacoes_cde(agregado, mes):
    """(serie, ref, valor): n de faturas e soma do desconto por chave; ref = mês."""
    for (cnpj, mun, sc, tf), (n, soma, sem_valor) in agregado["chaves"].items():
        base_ = f"{cnpj}.{mun}.{sc}.{tf}"
        yield (f"{base_}.n", mes, float(n))
        if n - sem_valor > 0:
            yield (f"{base_}.valor", mes, round(soma, 2))
        if sem_valor:
            yield (f"{base_}.sem_valor", mes, float(sem_valor))


# ---------------------------------------------------------------- série antiga (descontinuada)

REGIOES_ANTIGA = {"Norte": "N", "Nordeste": "NE", "Sudeste": "SE", "Sul": "S", "Centro-Oeste": "CO"}


def le_ts_antiga(texto):
    """CSV da série antiga (vírgula, cabeçalho em camelCase) → [(regiao, 'AAAA-MM', residencial, baixa_renda, processado)]."""
    out = []
    for r in csv.DictReader(io.StringIO(texto)):
        reg = REGIOES_ANTIGA.get((r.get("nomRegiao") or "").strip())
        try:
            ano, mes = int(r["anoReferencia"]), int(r["mesReferencia"])
        except (KeyError, TypeError, ValueError):
            continue
        if reg is None:
            continue
        out.append((reg, f"{ano:04d}-{mes:02d}", numero(r.get("qtdUndConsumidorResidencial")),
                    numero(r.get("qtdUndConsumidorBaixaRenda")), (r.get("dthProcessamento") or "").strip()))
    return out


# ---------------------------------------------------------------- CDE: custeio dos benefícios

def le_cde_custeio(linhas):
    """Linhas (dicts) do CSV de custeio → [(ano, tipo, fonte, valor)]; 'RGR ' e 'RGR'
    (espaço sobrando na fonte) são a mesma rubrica."""
    out = []
    for r in linhas:
        ano = (r.get("AnoReferencia") or "").strip()
        if not re.fullmatch(r"\d{4}", ano):
            continue
        v = numero(r.get("VlrCusteio"))
        out.append((ano, (r.get("DscTipoFonte") or "").strip(), (r.get("DscFonte") or "").strip(), v))
    return out
