"""Leitores dos conjuntos da ANEEL usados no módulo Expansão (SIGA, RALIE, liberação
para operação comercial, atos de outorga, leilões de transmissão e SIGET).

Funções puras sobre linhas já lidas do CSV (dicts com o cabeçalho original da fonte)
ou sobre o Parquet oficial: não fazem rede nem escrevem no silver, para que os testes
possam exercitá-las com recortes reais dos arquivos.

Convenções verificadas nos arquivos de 30/09/2026 (e não presumidas):
- números com vírgula decimal (``"1400,00"``, ``",00"``), ponto decimal em alguns
  recursos do SIGET (``"150.00"``) e ruído de ponto flutuante nos atos
  (``"7,7000000000000002"``): tudo passa por ``ckan.numero_br``;
- datas em ISO (``2026-09-18``), ISO com hora (``2026-07-31 00:00:00``) ou
  ``dd/mm/aaaa`` (SIGET);
- o SIGA usa ``1900-01-03`` como data de entrada em operação de usina que ainda não
  entrou (2.465 linhas em 30/09/2026) e coordenada ``,00000000`` para localização
  não informada (442 linhas): as duas viram ausência, nunca data ou ponto (0, 0);
- a liberação comercial identifica às vezes um grupo de unidades numa só linha
  (``"1 a 5"``, ``"1, 2 e 3"``): o grupo é expandido para o vínculo com o RALIE, e a
  potência do grupo nunca é dividida por unidade.
"""
import os
import re
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import entidades  # noqa: E402
from pipeline.energia.fontes.ckan import numero_br  # noqa: E402

# Datas anteriores a este limite são marcadores de "sem data" usados pelas bases da
# ANEEL (1900-01-03 no SIGA; 1950 a 1952 em marcos que não se aplicam no RALIE), não
# eventos reais do parque atual. A usina mais antiga do SIGA entrou em 1883, mas a
# data mais antiga efetivamente preenchida em 30/09/2026 é de 1908: o limite de 1901
# só descarta os marcadores.
DATA_MINIMA = "1901-01-01"

TIPOS = ("UHE", "PCH", "CGH", "EOL", "UFV", "UTE", "UTN", "CGU")
NOME_TIPO = {
    "UHE": "Usina hidrelétrica", "PCH": "Pequena central hidrelétrica",
    "CGH": "Central geradora hidrelétrica", "EOL": "Central geradora eólica",
    "UFV": "Central geradora solar fotovoltaica", "UTE": "Usina termelétrica",
    "UTN": "Usina termonuclear", "CGU": "Central geradora undi-elétrica",
}
UFS = ("AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE",
       "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO")

# Fase do SIGA → estágio publicado. Fase desconhecida não é descartada: vira "outro"
# com o rótulo original preservado (drift de esquema fica visível).
ESTAGIO_DA_FASE = {
    "Operação": "operacao",
    "Construção": "construcao",
    "Construção não iniciada": "construcao_nao_iniciada",
}

# Atos que encerram a outorga (conjunto "Atos de Outorgas de Geração", campo DscObjeto).
# Revogação de DRO, DRI e DRS não entra: são registros anteriores à outorga (requerimento,
# intenção, sumário), não outorgas de usina.
OBJETOS_ENCERRAMENTO = {"Autorização - Revogação": "revogacao", "Concessão - Extinção": "extincao"}


def texto(v):
    """Texto aparado ou None (vazio é ausência)."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def data_iso(v):
    """'2026-09-18', '2026-07-31 00:00:00', '18/09/2026' ou date → 'AAAA-MM-DD'.
    Vazio, formato desconhecido ou marcador anterior a 1901 → None."""
    if v is None:
        return None
    if isinstance(v, datetime):
        v = v.date()
    if isinstance(v, date):
        s = v.isoformat()
    else:
        s = str(v).strip()
        if not s:
            return None
        m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})(?:\s.*)?", s)
        if m:
            s = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        else:
            m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(?:[ T].*)?", s)
            if not m:
                return None
            s = m.group(1)
        try:
            date.fromisoformat(s)
        except ValueError:
            return None
    return s if s >= DATA_MINIMA else None


def numero(v):
    """Número da fonte (vírgula ou ponto decimal) → float; vazio → None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return numero_br(v)


def coordenada(v):
    """Latitude/longitude em grau decimal; 0 exato é o marcador de não informado."""
    x = numero(v)
    if x is None or x == 0:
        return None
    return x


def nucleo(v):
    """Núcleo do CEG como inteiro (chave estável: o sufixo de versão do CEG muda
    quando a usina é alterada, o núcleo não)."""
    s = texto(v)
    if not s:
        return None
    s = s.split(".")[0] if re.fullmatch(r"\d+\.0+", s) else s
    return int(s) if s.isdigit() else None


def ugs_de(v):
    """Números de unidade geradora de um campo NumUgUsina: '3' → {3}; '1 a 5' →
    {1..5}; '1, 2 e 3' → {1, 2, 3}; '1 a 3 e 5 a 7' → {1, 2, 3, 5, 6, 7}. Texto que não
    é número (ex.: '16 (desativada)') → None: não é vinculado por aproximação."""
    s = texto(v)
    if s is None:
        return None
    s = s.lower()
    if re.search(r"[^0-9ae,\-\s]", s):
        return None
    s = re.sub(r",\s*e\s*", ",", s)
    s = re.sub(r"(?<=\d)\s*e\s*(?=\d)", ",", s)
    out = set()
    for p in s.split(","):
        p = p.strip()
        if not p:
            continue
        m = re.fullmatch(r"(\d+)\s*(?:a|-)\s*(\d+)", p)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if b < a or b - a > 2000:
                return None
            out.update(range(a, b + 1))
        elif p.isdigit():
            out.add(int(p))
        else:
            return None
    return out or None


def cnpjs_de_proprietarios(v):
    """CNPJs (14 dígitos) citados no texto de proprietários do SIGA, na ordem."""
    s = texto(v) or ""
    return [entidades.cnpj(m) for m in re.findall(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", s)]


def uf_valida(v):
    s = (texto(v) or "").upper()
    return s if s in UFS else None


# --------------------------------------------------------------------------- SIGA

def le_siga(linhas):
    """Linhas do CSV do SIGA → (registros por núcleo, ocorrências).

    Linhas repetidas com o mesmo núcleo e conteúdo idêntico (3 casos em 30/09/2026)
    contam uma vez; núcleo repetido com conteúdo diferente é mantido na primeira
    ocorrência e registrado em ocorrências (não é somado duas vezes)."""
    out, ocorr = {}, {"linhas": 0, "duplicadas_identicas": 0, "duplicadas_divergentes": [],
                      "sem_nucleo": 0, "sem_coordenada": 0, "data_operacao_marcador": 0,
                      "fases": {}, "data_geracao": None}
    for r in linhas:
        ocorr["linhas"] += 1
        k = nucleo(r.get("IdeNucleoCEG"))
        if k is None:
            ocorr["sem_nucleo"] += 1
            continue
        fase = texto(r.get("DscFaseUsina")) or "(vazio)"
        ocorr["fases"][fase] = ocorr["fases"].get(fase, 0) + 1
        ocorr["data_geracao"] = ocorr["data_geracao"] or data_iso(r.get("DatGeracaoConjuntoDados"))
        lat, lon = coordenada(r.get("NumCoordNEmpreendimento")), coordenada(r.get("NumCoordEEmpreendimento"))
        if lat is None or lon is None:
            lat = lon = None
            ocorr["sem_coordenada"] += 1
        entrada_bruta = texto(r.get("DatEntradaOperacao"))
        entrada = data_iso(entrada_bruta)
        if entrada_bruta and entrada is None:
            ocorr["data_operacao_marcador"] += 1
        gf = numero(r.get("MdaGarantiaFisicaKw"))
        reg = {
            "ceg": texto(r.get("CodCEG")),
            "nome": texto(r.get("NomEmpreendimento")),
            "uf": uf_valida(r.get("SigUFPrincipal")),
            "tipo": texto(r.get("SigTipoGeracao")),
            "fase": fase,
            "estagio": ESTAGIO_DA_FASE.get(fase, "outro"),
            "origem": texto(r.get("DscOrigemCombustivel")),
            "fonte": texto(r.get("DscFonteCombustivel")),
            "combustivel": texto(r.get("NomFonteCombustivel")),
            "outorga": texto(r.get("DscTipoOutorga")),
            "entrada_operacao": entrada,
            "kw_outorgado": numero(r.get("MdaPotenciaOutorgadaKw")),
            "kw_fiscalizado": numero(r.get("MdaPotenciaFiscalizadaKw")),
            # 0 no SIGA = sem garantia física homologada registrada (22.285 de 25.133
            # linhas): não é uma garantia física igual a zero
            "garantia_fisica_kwmed": gf if gf else None,
            "geracao_qualificada": texto(r.get("IdcGeracaoQualificada")),
            "lat": lat, "lon": lon,
            "vigencia_inicio": data_iso(r.get("DatInicioVigencia")),
            "vigencia_fim": data_iso(r.get("DatFimVigencia")),
            "proprietarios": texto(r.get("DscPropriRegimePariticipacao")),
            "sub_bacia": texto(r.get("DscSubBacia")),
            "municipios": texto(r.get("DscMuninicpios")),
        }
        if k in out:
            if out[k] == reg:
                ocorr["duplicadas_identicas"] += 1
            else:
                ocorr["duplicadas_divergentes"].append(k)
            continue
        out[k] = reg
    return out, ocorr


def ufs_dos_municipios(v):
    """UFs citadas na lista de municípios do SIGA ('Irineópolis - SC, Porto União - SC')."""
    return sorted({m for m in re.findall(r"-\s*([A-Z]{2})\b", texto(v) or "") if m in UFS})


# --------------------------------------------------------------------------- RALIE

CAMPOS_RALIE_USINA = {
    "ceg": "CodCEG", "nome": "NomEmpreendimento", "uf": "SigUFPrincipal", "tipo": "SigTipoGeracao",
    "origem": "DscOrigemCombustivel", "proprietarios": "DscPropriRegimePariticipacao",
    "conexao_tipo": "DscTipoConexao", "conexao_nome": "NomConexao", "conexao_empresa": "NomEmpresaConexao",
    "viabilidade": "DscViabilidade", "situacao_obra": "DscSituacaoObra",
    "situacao_cronograma": "DscSituacaoCronograma", "justificativa_previsao": "DscJustificativaPrevisao",
    "comercializacao": "DscComercializacaoEnergia", "sistema": "DscSistema", "complexo": "NomComplexo",
    "tipo_outorga": "DscTipoOutorga", "ato_outorga": "DscAtoOutorga", "numero_ato": "DscNumeroAto",
    "situacao_li": "DscSituacaoLI", "situacao_cust": "DscSitCust", "situacao_cusd": "DscSituacaoCusd",
}
DATAS_RALIE_USINA = {
    "emissao_ato": "DatEmissaoAto", "previsao_inicio_obra": "DatPrevisaoInicioObra",
    "inicio_obra_outorgado": "DatInicioObraOutorgado", "inicio_obra_realizado": "DatInicioObraRealizado",
    "montagem_outorgado": "DatMontagemOutorgado", "montagem_realizado": "DatMontagemRealizado",
    "rapeel": "DatRapeel", "emissao_li": "DatEmissaoLI",
}


def _normaliza_rotulo(v):
    """Rótulos com grafias variantes na fonte ('Fora ACR' e 'Fora do ACR';
    'Sistemas Isolados' com espaços à direita)."""
    s = texto(v)
    if s == "Fora do ACR":
        return "Fora ACR"
    return s


def le_ralie_usina(linhas):
    """Usinas do RALIE atual → {núcleo: registro}. Uma linha por usina por DatRalie."""
    out, dat = {}, set()
    for r in linhas:
        k = nucleo(r.get("IdeNucleoCEG"))
        if k is None:
            continue
        dat.add(data_iso(r.get("DatRalie")))
        reg = {c: _normaliza_rotulo(r.get(f)) for c, f in CAMPOS_RALIE_USINA.items()}
        reg["uf"] = uf_valida(reg["uf"])
        reg.update({c: data_iso(r.get(f)) for c, f in DATAS_RALIE_USINA.items()})
        reg["kw_outorgado"] = numero(r.get("MdaPotenciaOutorgadaKw"))
        reg["tensao_conexao_kv"] = numero(r.get("MdaTensaoConexao"))
        reg["cnpj_conexao"] = entidades.cnpj(r.get("NumCnpjEmpresaConexao"))
        out[k] = reg
    return out, sorted(d for d in dat if d)


def le_ralie_ug(linhas):
    """Unidades geradoras do RALIE atual → {(núcleo, ug): registro}."""
    out, dat = {}, set()
    for r in linhas:
        k = nucleo(r.get("IdeNucleoCEG"))
        ug = texto(r.get("NumUgUsina"))
        if k is None or ug is None or not ug.isdigit():
            continue
        dat.add(data_iso(r.get("DatRalie")))
        out[(k, int(ug))] = {
            "tipo": texto(r.get("SigTipoGeracao")), "uf": uf_valida(r.get("SigUFPrincipal")),
            "kw": numero(r.get("MdaPotenciaUnitaria")),
            "kw_teste": numero(r.get("MdaPotenciaLiberadaTeste")),
            "teste_outorgado": data_iso(r.get("DatInicioOpTesteOutorgada")),
            "teste_realizado": data_iso(r.get("DatLiberOpTesteRealizado")),
            "comercial_outorgado": data_iso(r.get("DatUGInicioOpComerOutorgado")),
            "previsao_sfg": data_iso(r.get("DatPrevisaoOpComercialSFG")),
        }
    return out, sorted(d for d in dat if d)


def le_ralie_leilao(linhas):
    """Vínculos usina × leilão do RALIE atual → {(núcleo, codigo): início do suprimento}.
    'Nenhum' (sem compromisso em leilão) é preservado como vínculo explícito."""
    out = {}
    for r in linhas:
        k = nucleo(r.get("IdeNucleoCEG"))
        cod = texto(r.get("CodLeilao"))
        if k is None or cod is None:
            continue
        cod = "Nenhum" if cod.lower() == "nenhum" else cod
        out[(k, cod)] = data_iso(r.get("DatInicioSuprimento"))
    return out


# --------------------------------------------------------------- liberação comercial

def le_liberacao(linhas):
    """Liberações para operação comercial (arquivo detalhado) → lista de linhas
    normalizadas e índice {(núcleo, ug): primeira data de liberação comercial}.

    A potência considerada é MdaPotenciaLiberadaComercial (kW): o campo de potência
    outorgada unitária mistura MW e kW em linhas antigas (ex.: REDUC '63,30' com
    63.300 kW liberados)."""
    linhas_out, indice, nao_vinculadas = [], {}, []
    for r in linhas:
        k = nucleo(r.get("IdeNucleoCEG"))
        d = data_iso(r.get("DatLiberOpComerRealizado"))
        bruto = texto(r.get("NumUgUsina"))
        ugs = ugs_de(bruto)
        linha = {
            "nucleo": k, "ceg": texto(r.get("CodCEG")), "nome": texto(r.get("NomUsina")),
            "tipo": texto(r.get("SigTipoGeracao")), "origem": texto(r.get("DscOrigemCombustivel")),
            "uf": uf_valida(r.get("SigUFUsina")), "sistema": texto(r.get("DscSistema")),
            "ug_bruto": bruto, "ugs": sorted(ugs) if ugs else None,
            "kw": numero(r.get("MdaPotenciaLiberadaComercial")),
            "comercial_outorgado": data_iso(r.get("DatUGInicioOpComerOutorgado")),
            "comercial_realizado": d,
            "despacho": texto(r.get("NumDespachoComercial")),
        }
        linhas_out.append(linha)
        if k is None or d is None:
            continue
        if not ugs:
            nao_vinculadas.append(bruto)
            continue
        for u in ugs:
            if (k, u) not in indice or d < indice[(k, u)]:
                indice[(k, u)] = d
    return linhas_out, indice, nao_vinculadas


def le_liberacao_resumida(linhas):
    """Resumo anual oficial (AnoReferencia × tipo) → {ano: {tipo: valor_bruto}}.

    O campo se chama MdaSomaPotenciaMW, mas a partir de 2014 os valores estão em kW
    (2014 UHE+...: 7.455.330 contra 7.455,3 MW somando o arquivo detalhado). A
    conversão é decidida por quem reconcilia, com o arquivo detalhado como referência;
    aqui o valor sai como publicado."""
    out = {}
    for r in linhas:
        ano = texto(r.get("AnoReferencia"))
        tipo = texto(r.get("SigTipoGeracao"))
        if not ano or not tipo:
            continue
        v = numero(r.get("MdaSomaPotenciaMW"))
        if v is None:
            continue
        out.setdefault(ano, {})
        out[ano][tipo] = out[ano].get(tipo, 0.0) + v
    return out


# -------------------------------------------------------------------- atos de outorga

def le_encerramentos(linhas, referencias=None):
    """Atos de revogação ou extinção de outorga de geração (desde 2015) → lista.

    MdaPotenciaInstaladaMW é a potência declarada no ato (MW); ruído de ponto
    flutuante da fonte é arredondado a 3 casas (1 kW). O campo não é confiável em
    todas as linhas: há atos com o valor em kW (Axinim - Powertech, 975 no ato e
    975 kW no SIGA), conferidos depois por `confere_potencia_ato`.

    `referencias` (dict opcional) recebe, na mesma passagem, a potência citada nos
    demais atos de outorga do mesmo núcleo do CEG ({núcleo: [[objeto, data, mw]]}),
    usada como corroboração independente nessa conferência."""
    out = []
    for r in linhas:
        tipo = OBJETOS_ENCERRAMENTO.get(texto(r.get("DscObjeto")) or "")
        if not tipo:
            if referencias is not None:
                n, mw_ref = nucleo(r.get("IdeNucleoCEG")), numero(r.get("MdaPotenciaInstaladaMW"))
                if n is not None and mw_ref:
                    referencias.setdefault(n, []).append(
                        [texto(r.get("DscObjeto")), data_iso(r.get("DatPublicacao")), round(mw_ref, 3)])
            continue
        mw = numero(r.get("MdaPotenciaInstaladaMW"))
        out.append({
            "nucleo": nucleo(r.get("IdeNucleoCEG")), "ceg": texto(r.get("CodCEG")),
            "nome": texto(r.get("DscEmpreendimento")), "tipo_geracao": texto(r.get("SigTipoGeracao")),
            "uf": texto(r.get("SigUF")), "publicacao": data_iso(r.get("DatPublicacao")),
            "ato": texto(r.get("DscTipoAto")), "numero": texto(r.get("DscNumAto")),
            "assunto": texto(r.get("DscAssunto")), "objeto": texto(r.get("DscObjeto")), "encerramento": tipo,
            "mw": round(mw, 3) if mw is not None else None, "agente": texto(r.get("NomAgente")),
            "processo": texto(r.get("DscProcesso")),
        })
    return out


# Limite legal de potência por tipo usado na conferência dos atos: central geradora
# hidrelétrica (CGH) é aproveitamento de até 5.000 kW (Lei nº 9.074/1995, art. 8º, na
# redação da Lei nº 13.360/2016). Os demais tipos não têm teto legal que sirva de
# controle (UTE, UFV e EOL vão de centenas de kW a milhares de MW).
LIMITE_MW_TIPO = {"CGH": 5.0}
# Fator 1.000: o valor do ato, lido como MW, coincide (até 1%) com a potência do
# cadastro em kW. Margem de 1% cobre o arredondamento a 3 casas dos dois lados.
TOLERANCIA_FATOR_MIL = 0.01


def confere_potencia_ato(mw_ato, tipo, ref_kw, outros_atos_mw=()):
    """Confere a potência declarada num ato de encerramento contra o cadastro da mesma
    usina (núcleo do CEG) e o limite legal do tipo.

    `ref_kw`: [(origem, kW)] do cadastro (SIGA, potência outorgada; RALIE histórico).
    `outros_atos_mw`: MW citado nos demais atos de outorga do mesmo núcleo.

    Retorna {situacao, mw_usado, ref_kw, ref_origem, motivo}:
    - 'sem_potencia': ato sem valor (não soma, conta como ato);
    - 'conferida': sem divergência de fator 1.000 com o cadastro (ou sem cadastro) e
      dentro do limite do tipo; mw_usado = valor do ato;
    - 'corrigida_kw': o valor do ato é igual ao do cadastro em kW e há confirmação
      independente de que o ato está em kW (o valor como MW excede o limite legal do
      tipo, ou outro ato de outorga do mesmo núcleo cita a potência do cadastro em
      MW); mw_usado = cadastro ÷ 1.000, com o rótulo da correção;
    - 'fora_da_soma': divergência de fator 1.000 sem confirmação de qual lado está
      certo, ou valor acima do limite do tipo sem cadastro para corrigir; mw_usado =
      None (o ato conta, a potência fica fora da soma e é listada à parte)."""
    if mw_ato is None:
        return {"situacao": "sem_potencia", "mw_usado": None, "ref_kw": None, "ref_origem": None, "motivo": None}
    limite = LIMITE_MW_TIPO.get(tipo or "")
    acima_limite = limite is not None and mw_ato > limite
    for origem, kw in ref_kw:
        if not kw or kw <= 0:
            continue
        if abs(mw_ato - kw) <= TOLERANCIA_FATOR_MIL * kw:
            mw_cad = kw / 1000
            confirma = [m for m in outros_atos_mw if m and abs(m - mw_cad) <= 0.05 * mw_cad]
            if acima_limite:
                motivo = (f"o valor do ato ({mw_ato:g}) é igual ao do cadastro em kW ({kw:g} kW, {origem}) e, lido como MW, "
                          f"excede o limite legal de {limite:g} MW do tipo {tipo}")
                return {"situacao": "corrigida_kw", "mw_usado": round(mw_cad, 6), "ref_kw": kw, "ref_origem": origem,
                        "motivo": motivo}
            if confirma:
                motivo = (f"o valor do ato ({mw_ato:g}) é igual ao do cadastro em kW ({kw:g} kW, {origem}) e outro ato de "
                          f"outorga da mesma usina cita {confirma[0]:g} MW")
                return {"situacao": "corrigida_kw", "mw_usado": round(mw_cad, 6), "ref_kw": kw, "ref_origem": origem,
                        "motivo": motivo}
            motivo = (f"o valor do ato ({mw_ato:g} MW) e o do cadastro ({kw:g} kW, {origem}) diferem por fator 1.000 "
                      "sem confirmação independente de qual lado está certo")
            return {"situacao": "fora_da_soma", "mw_usado": None, "ref_kw": kw, "ref_origem": origem, "motivo": motivo}
    if acima_limite:
        return {"situacao": "fora_da_soma", "mw_usado": None, "ref_kw": None, "ref_origem": None,
                "motivo": f"{mw_ato:g} MW excede o limite legal de {limite:g} MW do tipo {tipo} e não há cadastro para conferir"}
    return {"situacao": "conferida", "mw_usado": mw_ato, "ref_kw": None, "ref_origem": None, "motivo": None}


# ----------------------------------------------------------------- leilões transmissão

# Rótulos que a fonte põe no campo do vencedor quando o lote não foi contratado. Nesses
# lotes a ANEEL publica 0 em km, MVA, prazo, RAP vencedora e deságio como marcador (o
# lote 2 do leilão 001/2001, "LT Ouro Preto 2 - Vitória 345 kV, 370 km", vem com 0 km):
# o zero vira ausência, e investimento e RAP do edital ficam como valores ofertados.
SEM_VENCEDOR = {"SEM LANCE", "SEM INSCRITO APTO", "NÃO LEILOADO", "NAO LEILOADO"}


def lote_sem_vencedor(vencedor):
    return (texto(vencedor) or "").upper() in SEM_VENCEDOR


def le_leiloes_transmissao(linhas):
    """Resultado dos leilões de transmissão (um lote por linha).

    km, MVA, investimento e RAP ficam em campos separados. Em lote sem vencedor ('SEM
    LANCE', 'SEM INSCRITO APTO', 'NÃO LEILOADO') os zeros de km, MVA, prazo, RAP
    vencedora e deságio são marcadores da fonte e viram ausência (None). Em lote
    contratado, 0 km só é real quando a descrição do empreendimento não cita linha
    ('LT' ou extensão em km), e 0 MVA só quando não cita MVA: o lote 3 do 001/2001,
    'LT Itumbiara - Marimbondo 500 kV, 212 km', contratado, vem com 0 km (campo não
    preenchido, vira ausência); o lote 15 do 001/2024, só de linha, tem 0 MVA real.
    PctDesagio vem como fração (0,08 = 8%)."""
    out = []
    for r in linhas:
        sem = lote_sem_vencedor(r.get("NomVencedorLeilao"))
        x = {
            "ano": texto(r.get("AnoLeilao")), "data": data_iso(r.get("DatLeilao")),
            "leilao": texto(r.get("NumLeilao")), "lote": texto(r.get("NumLoteLeilao")),
            "empreendimento": texto(r.get("NomEmpreendimento")), "uf": texto(r.get("SigUFPrincipal")),
            "prazo_meses": numero(r.get("QtdPrazoConstrucaoMeses")),
            "km": numero(r.get("MdaExtensaoLinhaTransmissaoKm") if "MdaExtensaoLinhaTransmissaoKm" in r
                         else r.get("MdaTotalLinhaTransmissaoKm")),
            "mva": numero(r.get("MdaSubEstacoesMVA")),
            "investimento_rs": numero(r.get("VlrInvestimentoPrevisto")),
            "rap_edital_rs": numero(r.get("VlrRAPEditalLeilao")),
            "rap_vencedor_rs": numero(r.get("VlrRAPVencedorLeilao")),
            "desagio_fracao": numero(r.get("PctDesagio")),
            "vencedor": texto(r.get("NomVencedorLeilao")),
            "sem_vencedor": sem,
        }
        if sem:
            for campo in ("km", "mva", "prazo_meses", "rap_vencedor_rs", "desagio_fracao"):
                if x[campo] == 0:
                    x[campo] = None
        else:
            desc = (x["empreendimento"] or "").upper()
            if x["km"] == 0 and re.search(r"\bLT\b|\d\s*KM\b", desc):
                x["km"] = None
            if x["mva"] == 0 and "MVA" in desc:
                x["mva"] = None
        out.append(x)
    return out


# ------------------------------------------------------------------------------ SIGET

def le_siget_obras(linhas):
    """Contrato × empreendimento × obra × módulo do SIGET → {(obra, módulo): registro}."""
    out = {}
    for r in linhas:
        obra, mdl = texto(r.get("IdeObr")), texto(r.get("IdeMdl"))
        if not obra or not mdl:
            continue
        out[(obra, mdl)] = {
            "contrato": texto(r.get("IdeCcd")), "empreendimento": texto(r.get("IdeEpd")),
            "empreendimento_ons": texto(r.get("IdeOnsEpd")), "nome_empreendimento": texto(r.get("NomEpd")),
            "situacao_empreendimento": texto(r.get("DscSituacaoEpd")),
            "oper_efetiva_empreendimento": data_iso(r.get("DatEfeOprComEpd")),
            "conclusao_ato_legal": data_iso(r.get("DatCaoCgmAtoLgl")),
            "oper_ato_legal": data_iso(r.get("DatOprComEpd")),
            "descricao_obra": texto(r.get("DscObr")), "situacao_obra": texto(r.get("DscSitObr")),
            "oper_obra": data_iso(r.get("DatOprComObr")), "tipo_obra": texto(r.get("DscTipObr")),
            "modulo": texto(r.get("NomMdl")), "tipo_modulo": texto(r.get("SigTipMdl")),
            "classificacao": texto(r.get("SglClfMdl")),
            # fim do contrato na linha: igual ao do contrato para o objeto original; reforço
            # incorporado depois a um contrato antigo traz o próprio prazo (contrato 6427
            # tem 18 datas de fim diferentes)
            "fim_contrato_linha": data_iso(r.get("DatFimCcd")),
        }
    return out


def le_siget_contratos(linhas):
    """Contratos de concessão de transmissão (recurso 'SIGET - Contrato Agente') →
    {IdeCcd: registro}, com a data de assinatura (DatAsnCcd) e a de fim (DatFimCcd)
    publicadas pela fonte. O CNPJ vem sem zeros à esquerda em parte das linhas
    ('8635011000150') e é normalizado para 14 dígitos."""
    out = {}
    for r in linhas:
        k = texto(r.get("IdeCcd"))
        if not k:
            continue
        out[k] = {"numero": texto(r.get("NumCnaCcd")), "tipo": texto(r.get("IdcTipoCcd")),
                  "assinatura": data_iso(r.get("DatAsnCcd")), "fim": data_iso(r.get("DatFimCcd")),
                  "cnpj": entidades.cnpj(r.get("NumCNPJ")), "agente": texto(r.get("DscRazaoSocial")),
                  "uf_agente": uf_valida(r.get("SigUF"))}
    return out


def le_siget_linhas(linhas):
    """Módulos de linha de transmissão → {módulo: registro} com extensão em km."""
    out = {}
    for r in linhas:
        mdl = texto(r.get("IdeMdl"))
        if not mdl:
            continue
        out[mdl] = {
            "nome": texto(r.get("NomLinTms")), "situacao": texto(r.get("DscSitLinTms")),
            "km": numero(r.get("NumEtnLinTms")), "tensao_kv": numero(r.get("NumTensaoBaseLinhaTransm")),
            "uf_origem": uf_valida(r.get("SigUFSubestacaoOrigem")),
            "uf_destino": uf_valida(r.get("SigUFSubestacaoDestino")),
            "se_origem": texto(r.get("NomSubestacaoOrigem")), "se_destino": texto(r.get("NomSubestacaoDestino")),
        }
    return out


def le_siget_equipamentos(linhas):
    """Módulos de equipamento de subestação → {módulo: registro}. Só a potência de
    transformação (MdaPotAtvMdlEqp, MVA) de transformadores de potência entra na soma
    de MVA; reatores e capacitores (Mvar) são outra grandeza e ficam fora."""
    out = {}
    for r in linhas:
        mdl = texto(r.get("IdeMdl"))
        if not mdl:
            continue
        tipo = texto(r.get("DscTipEqp"))
        mva = numero(r.get("MdaPotAtvMdlEqp"))
        atual = out.get(mdl)
        reg = {"tipo": tipo, "mva": mva if tipo == "Transformador de Potência" else None,
               "uf": uf_valida(r.get("SigUFSubestacao")), "subestacao": texto(r.get("NomSubestacao"))}
        if atual and atual.get("mva") is not None and reg["mva"] is not None:
            reg["mva"] = atual["mva"] + reg["mva"]  # módulo com mais de um transformador
        out[mdl] = reg
    return out


# ----------------------------------------------------------- histórico do RALIE (Parquet)

def ultimo_por_mes(datas):
    """Das fotografias do RALIE (várias por mês em alguns meses), a última de cada mês."""
    ult = {}
    for d in sorted(x for x in datas if x):
        ult[d[:7]] = d
    return sorted(ult.values())


def mediana_ponderada(pares):
    """Mediana ponderada de [(valor, peso)]: menor valor cuja soma acumulada de pesos
    alcança metade do peso total. Pesos nulos ou não positivos são ignorados."""
    pares = sorted((v, p) for v, p in pares if v is not None and p and p > 0)
    total = sum(p for _, p in pares)
    if not total:
        return None
    acum = 0.0
    for v, p in pares:
        acum += p
        if acum >= total / 2:
            return v
    return pares[-1][0]


def _pa():
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    return pa, pc, pq


# O Parquet histórico de unidades geradoras do RALIE tem 18,9 milhões de linhas (177
# fotografias em 30/09/2026) e cresce a cada fotografia. Ler as colunas usadas de uma
# vez passava de 1,7 GB de memória residente; em lotes, cada função guarda só o que
# precisa (agregados parciais ou as linhas das fotografias pedidas) e o processo fica
# bem abaixo da meta de 2 GB mesmo com o arquivo dobrando de tamanho.
LOTE_PARQUET = 500_000


def abre_parquet(dados):
    """bytes do Parquet (ou caminho) → ParquetFile."""
    pa, _, pq = _pa()
    if isinstance(dados, (bytes, bytearray)):
        return pq.ParquetFile(pa.BufferReader(dados))
    return pq.ParquetFile(dados)


def _lotes(pf, colunas, lote=LOTE_PARQUET):
    """Tabelas pyarrow de até `lote` linhas com só as colunas pedidas."""
    pa, _, _ = _pa()
    for b in pf.iter_batches(columns=colunas, batch_size=lote):
        yield pa.Table.from_batches([b])


def _reagrega(parciais, chaves, regras):
    """Combina agregados parciais por lote: `regras` = [(coluna parcial, função de
    recombinação, nome final)]. Soma de somas, soma de contagens, máximo de máximos e
    mínimo de mínimos são exatos; média não se recombina assim e não entra aqui."""
    pa, _, _ = _pa()
    if not parciais:
        return None
    g = pa.concat_tables(parciais).group_by(chaves).aggregate([(col, fn) for col, fn, _ in regras])
    nomes = {f"{col}_{fn}": nome for col, fn, nome in regras}
    return g.rename_columns([nomes.get(c, c) for c in g.column_names])


def datas_ralie(pf):
    """Fotografias (DatRalie) presentes no Parquet histórico, em ISO."""
    _, pc, _ = _pa()
    datas = set()
    for t in _lotes(pf, ["DatRalie"]):
        datas.update(d for d in pc.unique(t["DatRalie"]).to_pylist() if d)
    return sorted(d.isoformat() for d in datas)


def agrega_historico_ug(pf):
    """Por fotografia e tipo de geração: unidades, kW e kW sem previsão de operação
    comercial (DatPrevisaoOpComercialSFG vazia). {DatRalie: {tipo: {...}}}."""
    pa, pc, _ = _pa()
    parciais = []
    for t in _lotes(pf, ["DatRalie", "SigTipoGeracao", "MdaPotenciaUnitaria", "DatPrevisaoOpComercialSFG"]):
        t = t.append_column("sem_prev", pc.if_else(pc.is_null(t["DatPrevisaoOpComercialSFG"]),
                                                    t["MdaPotenciaUnitaria"], pa.scalar(0.0)))
        parciais.append(t.group_by(["DatRalie", "SigTipoGeracao"]).aggregate(
            [("MdaPotenciaUnitaria", "sum"), ("MdaPotenciaUnitaria", "count"), ("sem_prev", "sum")]))
    g = _reagrega(parciais, ["DatRalie", "SigTipoGeracao"],
                  [("MdaPotenciaUnitaria_sum", "sum", "kw"), ("MdaPotenciaUnitaria_count", "sum", "n"),
                   ("sem_prev_sum", "sum", "kw_sem_previsao")])
    out = {}
    for r in (g.to_pylist() if g is not None else []):
        d = r["DatRalie"].isoformat()
        out.setdefault(d, {})[r["SigTipoGeracao"] or "?"] = {
            "kw": r["kw"], "n": r["n"], "kw_sem_previsao": r["kw_sem_previsao"]}
    return out


def agrega_historico_usina(pf):
    """Por fotografia: usinas e kW outorgado por tipo, e kW outorgado por situação da
    obra, viabilidade e situação do cronograma (classificações da fiscalização)."""
    dims = ((["SigTipoGeracao"], "tipo"), (["DscSituacaoObra"], "obra"),
            (["DscViabilidade"], "viabilidade"), (["DscSituacaoCronograma"], "cronograma"))
    parciais = {rot: [] for _, rot in dims}
    for t in _lotes(pf, ["DatRalie", "SigTipoGeracao", "MdaPotenciaOutorgadaKw", "DscSituacaoObra",
                         "DscViabilidade", "DscSituacaoCronograma"]):
        for chaves, rot in dims:
            parciais[rot].append(t.group_by(["DatRalie"] + chaves).aggregate(
                [("MdaPotenciaOutorgadaKw", "sum"), ("MdaPotenciaOutorgadaKw", "count")]))
    out = {}
    for chaves, rot in dims:
        g = _reagrega(parciais[rot], ["DatRalie"] + chaves,
                      [("MdaPotenciaOutorgadaKw_sum", "sum", "kw"), ("MdaPotenciaOutorgadaKw_count", "sum", "n")])
        for r in (g.to_pylist() if g is not None else []):
            d = r["DatRalie"].isoformat()
            val = (texto(r[chaves[0]]) or "(vazio)")
            x = out.setdefault(d, {}).setdefault(rot, {}).setdefault(val, {"kw": 0.0, "n": 0})
            # rótulos que só diferem por espaço à direita caem no mesmo valor aparado
            x["kw"] += r["kw"] or 0.0
            x["n"] += r["n"] or 0
    return out


def tabela_liberacoes(indice):
    """{(núcleo, ug): 'AAAA-MM-DD'} → Table pyarrow para junção."""
    pa, _, _ = _pa()
    ks = list(indice)
    return pa.table({
        "IdeNucleoCEG": pa.array([k[0] for k in ks], pa.int64()),
        "NumUgUsina": pa.array([k[1] for k in ks], pa.int64()),
        "lib": pa.array([date.fromisoformat(indice[k]) for k in ks], pa.date32()),
    })


def ug_mensal(pf, mensais):
    """Unidades geradoras só nas fotografias mensais (última de cada mês), lidas em
    lotes: só as linhas dessas fotografias ficam na memória."""
    pa, pc, _ = _pa()
    alvo = pa.array([date.fromisoformat(d) for d in mensais], pa.date32())
    colunas = ["DatRalie", "IdeNucleoCEG", "NumUgUsina", "SigTipoGeracao", "MdaPotenciaUnitaria",
               "DatUGInicioOpComerOutorgado", "DatPrevisaoOpComercialSFG"]
    partes = [t.filter(pc.is_in(t["DatRalie"], value_set=alvo)) for t in _lotes(pf, colunas)]
    partes = [t for t in partes if t.num_rows]
    if not partes:
        return pa.schema([pf.schema_arrow.field(c) for c in colunas]).empty_table()
    return pa.concat_tables(partes).combine_chunks()


def confiabilidade_previsoes(ugm, lib_tab, mensais, corte, horizonte_dias=365, folga_dias=15):
    """Para cada fotografia mensal S do RALIE cuja janela (S, S + horizonte] termina até
    `corte − folga` (data de geração do arquivo de liberações menos a defasagem de
    publicação), a potência das unidades com previsão de operação comercial (SFG)
    dentro da janela e o que aconteceu com ela segundo o arquivo de liberações:
    liberada no prazo, liberada depois do prazo (até o corte) ou não liberada até o corte.

    Unidades já liberadas antes de S e ainda listadas com previsão futura são
    inconsistências da fonte: saem do denominador e são contadas à parte."""
    pa, pc, _ = _pa()
    from datetime import timedelta
    corte_d = date.fromisoformat(corte)
    out = []
    for s in mensais:
        S = date.fromisoformat(s)
        fim = S + timedelta(days=horizonte_dias)
        if fim + timedelta(days=folga_dias) > corte_d:
            continue
        # junção só com as linhas da fotografia: a tabela mensal inteira não é duplicada
        x = ugm.filter(pc.equal(ugm["DatRalie"], pa.scalar(S, pa.date32())))
        x = x.join(lib_tab, keys=["IdeNucleoCEG", "NumUgUsina"], join_type="left outer")
        prev = x["DatPrevisaoOpComercialSFG"]
        y = x.filter(pc.and_(pc.greater(prev, pa.scalar(S, pa.date32())),
                             pc.less_equal(prev, pa.scalar(fim, pa.date32()))))
        ja = pc.fill_null(pc.less_equal(y["lib"], pa.scalar(S, pa.date32())), False)
        excl = y.filter(ja)
        y = y.filter(pc.invert(ja))
        no_prazo = pc.fill_null(pc.less_equal(y["lib"], pa.scalar(fim, pa.date32())), False)
        depois = pc.fill_null(pc.greater(y["lib"], pa.scalar(fim, pa.date32())), False)
        nunca = pc.is_null(y["lib"])

        def soma(mask):
            return pc.sum(y.filter(mask)["MdaPotenciaUnitaria"]).as_py() or 0.0

        por_tipo = {}
        for tipo in pc.unique(y["SigTipoGeracao"]).to_pylist():
            # mesma partição do total, dentro do tipo: no prazo + depois + não liberada
            yt = y.filter(pc.equal(y["SigTipoGeracao"], tipo))
            lib_t = yt["lib"]
            fim_s = pa.scalar(fim, pa.date32())

            def soma_t(mask, yt=yt):
                return pc.sum(yt.filter(mask)["MdaPotenciaUnitaria"]).as_py() or 0.0

            por_tipo[tipo] = {"ugs": yt.num_rows, "kw_prometido": pc.sum(yt["MdaPotenciaUnitaria"]).as_py() or 0.0,
                              "kw_no_prazo": soma_t(pc.fill_null(pc.less_equal(lib_t, fim_s), False)),
                              "kw_depois": soma_t(pc.fill_null(pc.greater(lib_t, fim_s), False)),
                              "kw_nao_liberado": soma_t(pc.is_null(lib_t)),
                              "ugs_excluidas_ja_liberadas": excl.filter(pc.equal(excl["SigTipoGeracao"], tipo)).num_rows}
        kw = pc.sum(y["MdaPotenciaUnitaria"]).as_py() or 0.0
        out.append({
            "ralie": s, "fim_janela": fim.isoformat(), "ugs": y.num_rows,
            "kw_prometido": kw, "kw_no_prazo": soma(no_prazo), "kw_depois": soma(depois), "kw_nao_liberado": soma(nunca),
            "ugs_excluidas_ja_liberadas": excl.num_rows,
            "kw_excluido_ja_liberado": pc.sum(excl["MdaPotenciaUnitaria"]).as_py() or 0.0,
            "por_tipo": por_tipo,
        })
    return out


# Data em bloco: previsão atribuída a pelo menos 100 usinas distintas na mesma
# fotografia. O maior complexo do RALIE tem 41 usinas (Santa Luzia, 2024), então uma
# data compartilhada por mais que o dobro disso não é o cronograma de um complexo: é a
# data convencional que a fiscalização atribui em lote a usinas sem obra, licença ou
# acesso, e que anda junto com a fotografia (cerca de 5 anos depois dela: 2029-07-04 na
# fotografia de 19/07/2024, 2031-09-13 na de 18/09/2026). Nas 64 fotografias mensais
# até set/2026, datas com 100 usinas ou mais estão todas a 3, 4, 5 ou 6 anos da
# fotografia (menos alguns dias).
MINIMO_USINAS_DATA_EM_BLOCO = 100


def datas_em_bloco(ugm, datas, minimo_usinas=MINIMO_USINAS_DATA_EM_BLOCO):
    """{fotografia: {previsão: {usinas, ugs, kw}}} das datas em bloco de cada fotografia
    pedida (previsão atribuída a pelo menos `minimo_usinas` usinas distintas)."""
    pa, pc, _ = _pa()
    out = {}
    for s in datas:
        x = ugm.filter(pc.equal(ugm["DatRalie"], pa.scalar(date.fromisoformat(s), pa.date32())))
        x = x.filter(pc.is_valid(x["DatPrevisaoOpComercialSFG"]))
        if x.num_rows == 0:
            out[s] = {}
            continue
        g = x.group_by(["DatPrevisaoOpComercialSFG"]).aggregate(
            [("IdeNucleoCEG", "count_distinct"), ("IdeNucleoCEG", "count"), ("MdaPotenciaUnitaria", "sum")])
        out[s] = {r["DatPrevisaoOpComercialSFG"].isoformat(): {"usinas": r["IdeNucleoCEG_count_distinct"],
                                                               "ugs": r["IdeNucleoCEG_count"],
                                                               "kw": r["MdaPotenciaUnitaria_sum"] or 0.0}
                  for r in g.to_pylist() if r["IdeNucleoCEG_count_distinct"] >= minimo_usinas}
    return out


def deslizamento_previsoes(ugm, mensais, meses=12, blocos=None):
    """Revisão da previsão de operação comercial de uma mesma unidade entre a fotografia
    mensal S e a fotografia do mês S + `meses`: variação em dias (positivo = adiada),
    ponderada pela potência. Só unidades presentes nas duas com previsão preenchida.

    Com `blocos` ({fotografia: conjunto de datas em bloco}), cada par também sai sem as
    unidades cuja previsão é data em bloco em S ou em S + `meses`: a data em bloco anda
    com a fotografia (cerca de um ano a cada ano), e o 'adiamento' dessas unidades é a
    convenção, não revisão de cronograma de obra."""
    pa, pc, _ = _pa()
    por_mes = {d[:7]: d for d in mensais}
    blocos = blocos or {}
    out = []
    for s in mensais:
        a, m = int(s[:4]), int(s[5:7]) + meses
        a, m = a + (m - 1) // 12, (m - 1) % 12 + 1
        s2 = por_mes.get(f"{a:04d}-{m:02d}")
        if not s2:
            continue
        x = ugm.filter(pc.equal(ugm["DatRalie"], pa.scalar(date.fromisoformat(s), pa.date32())))
        x2 = ugm.filter(pc.equal(ugm["DatRalie"], pa.scalar(date.fromisoformat(s2), pa.date32())))
        x = x.select(["IdeNucleoCEG", "NumUgUsina", "MdaPotenciaUnitaria", "DatPrevisaoOpComercialSFG"])
        x2 = x2.select(["IdeNucleoCEG", "NumUgUsina", "DatPrevisaoOpComercialSFG"]).rename_columns(
            ["IdeNucleoCEG", "NumUgUsina", "prev2"])
        j = x.join(x2, keys=["IdeNucleoCEG", "NumUgUsina"], join_type="inner")
        j = j.filter(pc.and_(pc.is_valid(j["DatPrevisaoOpComercialSFG"]), pc.is_valid(j["prev2"])))
        if j.num_rows == 0:
            continue
        p1 = j["DatPrevisaoOpComercialSFG"].to_pylist()
        p2 = j["prev2"].to_pylist()
        kw = j["MdaPotenciaUnitaria"].to_pylist()
        b1 = {d for d in blocos.get(s, ())}
        b2 = {d for d in blocos.get(s2, ())}
        pares, livres = [], []
        kw_bloco = kw_bloco_nas_duas = 0.0
        for a_, b, k in zip(p1, p2, kw):
            par = ((b - a_).days, k)
            pares.append(par)
            em1, em2 = a_.isoformat() in b1, b.isoformat() in b2
            if em1 or em2:
                kw_bloco += k or 0
                if em1 and em2:
                    kw_bloco_nas_duas += k or 0
            else:
                livres.append(par)
        tot = sum(k or 0 for _, k in pares)
        tot_l = sum(k or 0 for _, k in livres)
        out.append({
            "ralie": s, "ralie_seguinte": s2, "ugs": j.num_rows, "kw": tot,
            "kw_adiada": sum(k or 0 for d, k in pares if d > 0),
            "kw_mantida": sum(k or 0 for d, k in pares if d == 0),
            "kw_antecipada": sum(k or 0 for d, k in pares if d < 0),
            "mediana_dias_ponderada": mediana_ponderada(pares),
            # parcela em data em bloco (em S ou em S + meses) e o mesmo par sem ela
            "kw_data_em_bloco": kw_bloco, "kw_bloco_nas_duas": kw_bloco_nas_duas,
            "sem_bloco": {"ugs": len(livres), "kw": tot_l,
                          "kw_adiada": sum(k or 0 for d, k in livres if d > 0),
                          "kw_mantida": sum(k or 0 for d, k in livres if d == 0),
                          "kw_antecipada": sum(k or 0 for d, k in livres if d < 0),
                          "mediana_dias_ponderada": mediana_ponderada(livres)},
        })
    return out


def trajetorias_usinas(pf_ug, pf_usina):
    """Por usina que já passou pelo RALIE: primeira e última fotografia, potência
    outorgada na primeira aparição, maior previsão de operação comercial (SFG) e maior
    data outorgada entre as unidades na primeira e na última fotografia, e número de
    mudanças da maior previsão ao longo das fotografias."""
    pa, pc, _ = _pa()
    tu = pf_usina.read(columns=["DatRalie", "IdeNucleoCEG", "CodCEG", "NomEmpreendimento", "SigTipoGeracao",
                                "SigUFPrincipal", "MdaPotenciaOutorgadaKw"])
    usinas = {}
    for r in tu.sort_by([("IdeNucleoCEG", "ascending"), ("DatRalie", "ascending")]).to_pylist():
        k = r["IdeNucleoCEG"]
        d = r["DatRalie"].isoformat()
        u = usinas.get(k)
        if u is None:
            usinas[k] = u = {"nucleo": k, "ceg": r["CodCEG"], "nome": r["NomEmpreendimento"],
                             "tipo": r["SigTipoGeracao"], "uf": r["SigUFPrincipal"], "primeira": d,
                             "kw_primeira": r["MdaPotenciaOutorgadaKw"]}
        u["ultima"] = d
        u["kw_ultima"] = r["MdaPotenciaOutorgadaKw"]
        u["nome"] = r["NomEmpreendimento"] or u["nome"]
        u["ceg"] = r["CodCEG"] or u["ceg"]
    del tu
    # unidades: agregado por (usina, fotografia) em lotes e recombinado
    parciais = []
    for t in _lotes(pf_ug, ["DatRalie", "IdeNucleoCEG", "MdaPotenciaUnitaria", "DatUGInicioOpComerOutorgado",
                            "DatPrevisaoOpComercialSFG"]):
        parciais.append(t.group_by(["IdeNucleoCEG", "DatRalie"]).aggregate(
            [("DatPrevisaoOpComercialSFG", "max"), ("DatUGInicioOpComerOutorgado", "max"),
             ("MdaPotenciaUnitaria", "sum"), ("MdaPotenciaUnitaria", "count")]))
    g = _reagrega(parciais, ["IdeNucleoCEG", "DatRalie"],
                  [("DatPrevisaoOpComercialSFG_max", "max", "prev"), ("DatUGInicioOpComerOutorgado_max", "max", "outg"),
                   ("MdaPotenciaUnitaria_sum", "sum", "kw"), ("MdaPotenciaUnitaria_count", "sum", "n")])
    if g is None:
        return usinas
    g = g.sort_by([("IdeNucleoCEG", "ascending"), ("DatRalie", "ascending")])
    for r in g.to_pylist():
        u = usinas.get(r["IdeNucleoCEG"])
        if u is None:
            continue
        d = r["DatRalie"].isoformat()
        prev = r["prev"].isoformat() if r["prev"] else None
        outg = r["outg"].isoformat() if r["outg"] else None
        if "ug_primeira" not in u:
            u["ug_primeira"] = d
            u["prev_primeira"] = prev
            u["outorgado_primeira"] = outg
            u["kw_ug_primeira"] = r["kw"]
            u["mudancas_previsao"] = 0
            u["_ultima_prev"] = prev
        elif prev != u["_ultima_prev"]:
            u["mudancas_previsao"] += 1
            u["_ultima_prev"] = prev
        u["prev_ultima"] = prev
        u["outorgado_ultima"] = outg
        u["kw_ug_ultima"] = r["kw"]
        u["ugs_ultima"] = r["n"]
    for u in usinas.values():
        u.pop("_ultima_prev", None)
    return usinas


def ugs_da_primeira_aparicao(pf_ug):
    """{núcleo: [(ug, kW)]} das unidades listadas na primeira fotografia de cada usina
    (a promessa original), para verificar quantas foram liberadas depois. Duas
    passagens em lotes: a primeira acha a fotografia inicial de cada usina; a segunda
    guarda só as linhas dessa fotografia."""
    pa, pc, _ = _pa()
    parciais = [t.group_by(["IdeNucleoCEG"]).aggregate([("DatRalie", "min")])
                for t in _lotes(pf_ug, ["DatRalie", "IdeNucleoCEG"])]
    prim = _reagrega(parciais, ["IdeNucleoCEG"], [("DatRalie_min", "min", "DatRalie")])
    out = {}
    if prim is None:
        return out
    for t in _lotes(pf_ug, ["DatRalie", "IdeNucleoCEG", "NumUgUsina", "MdaPotenciaUnitaria"]):
        j = t.join(prim, keys=["IdeNucleoCEG", "DatRalie"], join_type="inner")
        for n_, u_, k_ in zip(j["IdeNucleoCEG"].to_pylist(), j["NumUgUsina"].to_pylist(),
                              j["MdaPotenciaUnitaria"].to_pylist()):
            out.setdefault(n_, []).append((u_, k_))
    return out


def potencias_outorgadas_historicas(pf_usina):
    """{núcleo: [kW outorgado distintos]} de todas as fotografias do Parquet histórico de
    usinas do RALIE: cadastro de potência das usinas que já saíram do SIGA aberto, usado
    para conferir a potência declarada nos atos de encerramento."""
    out = {}
    for t in _lotes(pf_usina, ["IdeNucleoCEG", "MdaPotenciaOutorgadaKw"]):
        for n, kw in zip(t["IdeNucleoCEG"].to_pylist(), t["MdaPotenciaOutorgadaKw"].to_pylist()):
            if n is not None and kw:
                out.setdefault(n, set()).add(kw)
    return {n: sorted(v) for n, v in out.items()}
