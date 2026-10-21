"""Atos regulatórios curados pelo módulo Regulação: leitura, validação e vigência.

Arquivos deste pacote (dados conferidos à mão no documento primário, com trecho literal):

    limites_pld.json              limites anuais do PLD (piso, teto horário, teto estrutural)
    limites_pld_conferencia.json  como cada ato foi conferido, TEO e TEO de Itaipu, pendências e bloqueios
    linha_do_tempo.json           marcos que mudam a leitura dos painéis (P045)
    documentos.json               registro dos documentos citados (URL oficial, cópia pública, sha256)

O esquema de limites_pld.json é consumido também pelo módulo PLD (painel de permanência
nos limites, achado A04) e não pode mudar sem acordo entre os dois módulos. Por isso a
validação aqui é estrita: chave a mais ou a menos é erro, e cada valor numérico tem de
aparecer, escrito como no ato, dentro do trecho literal citado. Assim um número digitado
errado no JSON não passa despercebido.

Regra de vigência campo a campo (a mesma do módulo PLD): num dia, cada limite vale pelo
ato em vigor que informa aquele campo e tem a publicação mais recente. Um ato que só
atualiza os tetos deixa o piso com o ato anterior. Quando a ordem de publicação não
reflete a precedência (em 2021 o despacho que atualizou os tetos de 2022 saiu antes da
resolução que o autorizou), o ato substituído registra como vigente só o campo que
continua valendo; o valor substituído fica em limites_pld_conferencia.json.
"""
import json
import os
import re
from datetime import date, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
CAMPOS_LIMITE = ("pld_min", "pld_max_horario", "pld_max_estrutural")
CHAVES_ATO = ("ano", "ato", "data_publicacao", "vigencia_inicio", "vigencia_fim", "pld_min", "pld_max_horario",
              "pld_max_estrutural", "unidade", "dispositivo", "url", "trecho", "altera_ou_revoga")
SEPARADOR_TRECHO = " […] "


def _ler(nome):
    with open(os.path.join(AQUI, nome), encoding="utf-8") as f:
        return json.load(f)


def _iso(v):
    if not isinstance(v, str) or len(v) != 10:
        return None
    try:
        return date.fromisoformat(v).isoformat()
    except ValueError:
        return None


def numero_br(v, casas=2):
    """1326.5 → '1.326,50' (como os atos escrevem valores em reais)."""
    s = f"{v:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def normaliza_texto(s):
    """Espaços, quebras de linha e tabulações viram um espaço: a extração de PDF muda
    a quebra de linha conforme a versão da ferramenta, não o texto."""
    return re.sub(r"\s+", " ", s or "").strip()


def pedacos_do_trecho(trecho):
    return [p.strip() for p in normaliza_texto(trecho).split("[…]") if p.strip()]


def trecho_confere(trecho, texto_documento):
    """(ok, pedaços ausentes): cada passagem literal do trecho está no documento."""
    doc = normaliza_texto(texto_documento)
    faltam = [p for p in pedacos_do_trecho(trecho) if p not in doc]
    return not faltam, faltam


def validar_limites(dado):
    """Lista de erros de esquema e de coerência (vazia = válido)."""
    erros = []
    if not isinstance(dado, dict) or set(dado) != {"conferido_em", "atos"}:
        return ["o arquivo deve ter exatamente as chaves conferido_em e atos"]
    if not _iso(dado["conferido_em"]):
        erros.append("conferido_em não é data AAAA-MM-DD")
    atos = dado["atos"]
    if not isinstance(atos, list) or not atos:
        return erros + ["atos vazio"]
    vistos = set()
    for i, a in enumerate(atos):
        rot = f"atos[{i}] ({a.get('ato') if isinstance(a, dict) else '?'})"
        if not isinstance(a, dict) or set(a) != set(CHAVES_ATO):
            faltam = sorted(set(CHAVES_ATO) - set(a or {})) if isinstance(a, dict) else []
            sobram = sorted(set(a or {}) - set(CHAVES_ATO)) if isinstance(a, dict) else []
            erros.append(f"{rot}: chaves diferentes do esquema (faltam {faltam}, sobram {sobram})")
            continue
        if not isinstance(a["ano"], int) or isinstance(a["ano"], bool):
            erros.append(f"{rot}: ano não inteiro")
        if not isinstance(a["ato"], str) or not a["ato"].strip():
            erros.append(f"{rot}: ato vazio")
        if (a["ato"], a["ano"]) in vistos:
            erros.append(f"{rot}: ato repetido no mesmo ano")
        vistos.add((a["ato"], a["ano"]))
        ini, fim = _iso(a["vigencia_inicio"]), _iso(a["vigencia_fim"])
        if not ini or not fim:
            erros.append(f"{rot}: vigência sem data AAAA-MM-DD")
        elif fim < ini:
            erros.append(f"{rot}: vigência termina antes de começar")
        elif isinstance(a["ano"], int) and not (ini[:4] == fim[:4] == str(a["ano"])):
            erros.append(f"{rot}: vigência fora do ano {a['ano']}")
        if a["data_publicacao"] is not None and not _iso(a["data_publicacao"]):
            erros.append(f"{rot}: data_publicacao não é data AAAA-MM-DD nem nula")
        if a["data_publicacao"] and fim and a["data_publicacao"] > fim:
            erros.append(f"{rot}: publicado depois do fim da vigência")
        if a["unidade"] != "R$/MWh":
            erros.append(f"{rot}: unidade {a['unidade']!r}")
        if not str(a["url"]).startswith("https://"):
            erros.append(f"{rot}: url sem https")
        if not isinstance(a["dispositivo"], str) or not a["dispositivo"].strip():
            erros.append(f"{rot}: dispositivo vazio")
        if a["altera_ou_revoga"] is not None and not str(a["altera_ou_revoga"]).strip():
            erros.append(f"{rot}: altera_ou_revoga deve ser nulo ou texto")
        trecho = normaliza_texto(a["trecho"] if isinstance(a["trecho"], str) else "")
        if not trecho:
            erros.append(f"{rot}: trecho vazio")
        valores = {k: a[k] for k in CAMPOS_LIMITE}
        if all(v is None for v in valores.values()):
            erros.append(f"{rot}: nenhum limite informado")
        for k, v in valores.items():
            if v is None:
                continue
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not v > 0:
                erros.append(f"{rot}: {k} não é número positivo")
                continue
            if numero_br(float(v)) not in trecho:
                erros.append(f"{rot}: {k}={v} não aparece como {numero_br(float(v))} no trecho")
    if erros:
        return erros
    # cada ano precisa ter os três limites informados por algum ato, e o piso abaixo dos tetos
    for ano in sorted({a["ano"] for a in atos}):
        do_ano = [a for a in atos if a["ano"] == ano]
        for k in CAMPOS_LIMITE:
            if all(a[k] is None for a in do_ano):
                erros.append(f"{ano}: nenhum ato informa {k}")
        ef = limites_em(f"{ano}-12-31", atos)
        if None not in (ef["pld_min"], ef["pld_max_estrutural"], ef["pld_max_horario"]):
            if not ef["pld_min"] < ef["pld_max_estrutural"] < ef["pld_max_horario"]:
                erros.append(f"{ano}: esperado piso < teto estrutural < teto horário")
    return erros


def ordena_atos(atos):
    return sorted(atos, key=lambda a: (a["ano"], a["vigencia_inicio"], a["data_publicacao"] or "", a["ato"]))


def limites_pld():
    """{conferido_em, atos} de limites_pld.json, validado e com os atos ordenados por ano,
    início de vigência e publicação. Lança ValueError se o arquivo violar o esquema."""
    dado = _ler("limites_pld.json")
    erros = validar_limites(dado)
    if erros:
        raise ValueError("limites_pld.json inválido: " + "; ".join(erros[:10]))
    return {"conferido_em": dado["conferido_em"], "atos": ordena_atos(dado["atos"])}


def limites_em(dia, atos=None):
    """Limites vigentes em `dia` (AAAA-MM-DD), campo a campo, com o ato de origem.
    Campo sem ato vigente fica None (ausência, nunca o menor preço observado)."""
    atos = limites_pld()["atos"] if atos is None else atos
    out = {}
    for campo in CAMPOS_LIMITE:
        cands = [a for a in atos if a[campo] is not None and a["vigencia_inicio"] <= dia <= a["vigencia_fim"]]
        if not cands:
            out[campo], out[f"ato_{campo}"] = None, None
            continue
        topo = max(cands, key=lambda a: (a["data_publicacao"] or "", a["vigencia_inicio"]))
        out[campo], out[f"ato_{campo}"] = topo[campo], topo["ato"]
    return out


def vigentes_por_ano(atos=None):
    """Um registro por ano: limites efetivos em cada trecho de vigência do ano (em geral
    um só), com o ato de origem de cada campo."""
    atos = limites_pld()["atos"] if atos is None else atos
    out = []
    for ano in sorted({a["ano"] for a in atos}):
        do_ano = [a for a in atos if a["ano"] == ano]
        marcos = sorted({a["vigencia_inicio"] for a in do_ano} | {
            (date.fromisoformat(a["vigencia_fim"]) + timedelta(days=1)).isoformat() for a in do_ano})
        fim_ano = max(a["vigencia_fim"] for a in do_ano)
        for i, ini in enumerate(marcos):
            if ini > fim_ano:
                break
            fim = (date.fromisoformat(marcos[i + 1]) - timedelta(days=1)).isoformat() if i + 1 < len(marcos) else fim_ano
            ef = limites_em(ini, atos)
            out.append({"ano": ano, "inicio": ini, "fim": min(fim, fim_ano), **ef})
    return out


def conferencia_limites():
    return _ler("limites_pld_conferencia.json")


def documentos():
    """{id: documento} do registro de documentos primários."""
    return {d["id"]: d for d in _ler("documentos.json")["documentos"]}


CHAVES_EVENTO = ("id", "titulo", "orgao", "ato", "tipo_ato", "data_ato", "data_publicacao", "vigencia_inicio",
                 "vigencia_regra", "vigencia_calculada", "dispositivo", "resumo", "efeito_declarado",
                 "impacto_estimado", "temas", "paineis", "documento", "trecho", "nivel_conferencia", "observacoes")
NIVEIS = ("texto_do_ato", "documento_oficial_do_processo", "documento_oficial_que_cita_o_ato", "ata_da_diretoria")


def validar_linha_do_tempo(dado, docs=None):
    docs = documentos() if docs is None else docs
    erros, ids = [], set()
    for i, e in enumerate(dado.get("eventos", [])):
        rot = f"eventos[{i}] ({e.get('id')})"
        if set(e) != set(CHAVES_EVENTO):
            erros.append(f"{rot}: chaves diferentes do esquema")
            continue
        if e["id"] in ids:
            erros.append(f"{rot}: id repetido")
        ids.add(e["id"])
        for k in ("data_ato", "data_publicacao", "vigencia_inicio"):
            if e[k] is not None and not _iso(e[k]):
                erros.append(f"{rot}: {k} inválida")
        if not e["vigencia_inicio"]:
            erros.append(f"{rot}: vigência de início ausente")
        if e["data_publicacao"] and e["data_ato"] and e["data_publicacao"] < e["data_ato"]:
            erros.append(f"{rot}: publicado antes da data do ato")
        if e["impacto_estimado"] is not None:
            erros.append(f"{rot}: impacto_estimado deve ficar vazio (o observatório não estima efeito aqui)")
        if e["documento"] not in docs:
            erros.append(f"{rot}: documento {e['documento']} fora do registro")
        if e["nivel_conferencia"] not in NIVEIS:
            erros.append(f"{rot}: nível de conferência desconhecido")
        if not pedacos_do_trecho(e["trecho"]):
            erros.append(f"{rot}: trecho vazio")
        if not e["paineis"] or not all(str(p.get("href", "")).startswith("/setor-eletrico") for p in e["paineis"]):
            erros.append(f"{rot}: painéis afetados sem rota do observatório")
    return erros


def linha_do_tempo():
    dado = _ler("linha_do_tempo.json")
    erros = validar_linha_do_tempo(dado)
    if erros:
        raise ValueError("linha_do_tempo.json inválido: " + "; ".join(erros[:10]))
    return dado


def vigencia_por_vacancia(publicacao, dias):
    """Lei Complementar nº 95/1998, art. 8º, § 1º: conta-se o dia da publicação e o último
    dia do prazo, e a norma vigora no dia seguinte. Publicação em D com prazo de N dias:
    último dia D + N - 1, vigência D + N."""
    return (date.fromisoformat(publicacao) + timedelta(days=dias)).isoformat()
