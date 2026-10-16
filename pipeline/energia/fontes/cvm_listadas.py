"""Leitura dos formulários da CVM usados pelo módulo Listadas (https://dados.cvm.gov.br/,
licença ODbL declarada no portal). Um zip por ano de referência, CSV em Latin-1 com ";".

* FCA, Formulário Cadastral (fca_cia_aberta_AAAA.zip):
  - fca_cia_aberta_geral_AAAA.csv: nome empresarial e o anterior, setor, descrição da atividade
    escrita pela própria companhia, espécie de controle acionário, página na internet;
  - fca_cia_aberta_valor_mobiliario_AAAA.csv: cada valor mobiliário com o código de negociação,
    o segmento de listagem e as datas de início e fim de negociação. É a ponte papel → CNPJ.
* FRE, Formulário de Referência (fre_cia_aberta_AAAA.zip):
  - fre_cia_aberta_posicao_acionaria_AAAA.csv: acionistas com 5% ou mais de uma classe, os
    controladores e os participantes de acordo de acionistas, com quantidade e percentual de
    ações ordinárias, preferenciais e do total; a árvore de cada acionista pessoa jurídica vem
    nas linhas com ID_Acionista_Relacionado. Só o primeiro nível (acionistas diretos da
    companhia) é usado aqui.
* IPE, documentos periódicos e eventuais (ipe_cia_aberta_AAAA.zip): categoria (ex.: Fato
  Relevante), assunto escrito pela companhia, data de entrega e link do documento no sistema da
  CVM (rad.cvm.gov.br).

Regras: para cada documento (CNPJ, data de referência) vale a maior versão presente no arquivo;
pessoa física acionista nunca tem nome nem CPF republicado (vira "pessoas físicas", com a soma
das participações e a contagem); o CNPJ é normalizado para 14 dígitos (entidades.cnpj).
"""
import csv
import io
import zipfile

from pipeline.energia import entidades


def _membro(z, prefixo):
    for n in z.namelist():
        base = n.rsplit("/", 1)[-1]
        if base.startswith(prefixo) and base.endswith(".csv"):
            return n
    return None


def linhas_zip(caminho, prefixo):
    """Linhas (dict) do CSV do zip cujo nome começa por `prefixo` (ex.: 'fca_cia_aberta_geral_')."""
    z = zipfile.ZipFile(caminho)
    n = _membro(z, prefixo)
    if n is None:
        return []
    with z.open(n) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"))


def _c14(v):
    try:
        c = entidades.cnpj(v)
    except Exception:  # documento malformado
        return None
    # acionista estrangeiro sem CNPJ vem como "00.000.000/0000-00"
    return None if not c or c == "0" * 14 else c


def _num(v):
    t = (v or "").strip()
    if not t:
        return None
    try:
        return float(t.replace(",", "."))
    except ValueError:
        return None


def ultima_versao(linhas, chave=("CNPJ_Companhia", "Data_Referencia")):
    """Só as linhas da maior versão de cada documento."""
    vmax = {}
    for r in linhas:
        k = tuple(r.get(c) for c in chave)
        vmax[k] = max(vmax.get(k, 0), int(r.get("Versao") or 0))
    return [r for r in linhas if int(r.get("Versao") or 0) == vmax[tuple(r.get(c) for c in chave)]]


def le_fca_geral(linhas, cnpjs):
    """{cnpj: dict} do documento mais recente (data de referência, depois versão)."""
    out = {}
    for r in ultima_versao(linhas):
        c = _c14(r.get("CNPJ_Companhia"))
        if c not in cnpjs:
            continue
        atual = out.get(c)
        if atual and atual["data_referencia"] >= r["Data_Referencia"]:
            continue
        out[c] = {
            "data_referencia": r["Data_Referencia"],
            "versao": int(r["Versao"]),
            "id_documento": r.get("ID_Documento"),
            "nome": (r.get("Nome_Empresarial") or "").strip(),
            "nome_anterior": (r.get("Nome_Empresarial_Anterior") or "").strip() or None,
            "data_nome": r.get("Data_Nome_Empresarial") or None,
            "codigo_cvm": (r.get("Codigo_CVM") or "").lstrip("0") or None,
            "setor": (r.get("Setor_Atividade") or "").strip() or None,
            "descricao_atividade": (r.get("Descricao_Atividade") or "").strip() or None,
            "especie_controle": (r.get("Especie_Controle_Acionario") or "").strip() or None,
            "pagina_web": (r.get("Pagina_Web") or "").strip() or None,
            "situacao_emissor": (r.get("Situacao_Emissor") or "").strip() or None,
        }
    return out


def le_fca_valores(linhas):
    """Valores mobiliários com código de negociação, do documento mais recente de cada CNPJ
    neste arquivo: [{cnpj, codigo, valor_mobiliario, segmento, inicio, fim, data_referencia}]."""
    out = []
    ultima_ref = {}
    validas = ultima_versao(linhas)
    for r in validas:
        c = _c14(r.get("CNPJ_Companhia"))
        if c:
            ultima_ref[c] = max(ultima_ref.get(c, ""), r["Data_Referencia"])
    for r in validas:
        c = _c14(r.get("CNPJ_Companhia"))
        cod = (r.get("Codigo_Negociacao") or "").strip().upper()
        if not c or not cod or r["Data_Referencia"] != ultima_ref.get(c):
            continue
        out.append({
            "cnpj": c, "codigo": cod,
            "valor_mobiliario": (r.get("Valor_Mobiliario") or "").strip(),
            "classe_preferencial": (r.get("Sigla_Classe_Acao_Preferencial") or "").strip() or None,
            "segmento": (r.get("Segmento") or "").strip() or None,
            "mercado": (r.get("Mercado") or "").strip() or None,
            "inicio_negociacao": r.get("Data_Inicio_Negociacao") or None,
            "fim_negociacao": r.get("Data_Fim_Negociacao") or None,
            "inicio_listagem": r.get("Data_Inicio_Listagem") or None,
            "fim_listagem": r.get("Data_Fim_Listagem") or None,
            "data_referencia": r["Data_Referencia"],
        })
    return out


def classe_do_valor(valor_mobiliario, classe_pref=None):
    v = (valor_mobiliario or "").lower()
    if v.startswith("ações ordinárias"):
        return "ON"
    if v.startswith("ações preferenciais"):
        return "PN" + (classe_pref[-1] if classe_pref and classe_pref[-1] in "ABC" and classe_pref.upper().startswith("PN") else "")
    if v.startswith("units"):
        return "UNT"
    return None


ROTULOS_COLETIVOS = {"ações tesouraria": "tesouraria", "outros": "outros"}


def le_posicao_acionaria(linhas, cnpjs):
    """Primeiro nível da posição acionária do documento mais recente de cada companhia:
    {cnpj: {"data_referencia", "versao", "id_documento", "acionistas": [...], "pessoas_fisicas": {...}}}.
    Pessoa física: nome e CPF descartados; entra na soma e na contagem de pessoas físicas, com a
    marca de controlador. Percentuais como publicados (%)."""
    docs = {}
    for r in ultima_versao(linhas):
        c = _c14(r.get("CNPJ_Companhia"))
        if c not in cnpjs:
            continue
        ref = r["Data_Referencia"]
        atual = docs.get(c)
        if atual is None or ref > atual["data_referencia"]:
            docs[c] = {"data_referencia": ref, "versao": int(r["Versao"]), "id_documento": r.get("ID_Documento"), "linhas": []}
            atual = docs[c]
        if ref != atual["data_referencia"]:
            continue
        if (r.get("ID_Acionista_Relacionado") or "").strip():
            continue
        atual["linhas"].append(r)
    out = {}
    for c, d in docs.items():
        acionistas = []
        pf = {"quantidade": 0, "controladores": 0, "pct_on": 0.0, "pct_pn": 0.0, "pct_total": 0.0}
        for r in d["linhas"]:
            tipo = (r.get("Tipo_Pessoa_Acionista") or "").strip().upper()
            nome = (r.get("Acionista") or "").strip()
            ctrl = (r.get("Acionista_Controlador") or "").strip().upper() == "S"
            p_on, p_pn, p_tot = _num(r.get("Percentual_Acao_Ordinaria_Circulacao")), _num(r.get("Percentual_Acao_Preferencial_Circulacao")), _num(r.get("Percentual_Total_Acoes_Circulacao"))
            if tipo == "PF":
                pf["quantidade"] += 1
                pf["controladores"] += 1 if ctrl else 0
                pf["pct_on"] += p_on or 0.0
                pf["pct_pn"] += p_pn or 0.0
                pf["pct_total"] += p_tot or 0.0
                continue
            coletivo = ROTULOS_COLETIVOS.get(nome.lower()) if not tipo else None
            acionistas.append({
                "nome": nome,
                "tipo": "coletivo" if coletivo else (tipo or None),
                "rotulo_coletivo": coletivo,
                "cnpj": _c14(r.get("CPF_CNPJ_Acionista")) if tipo == "PJ" else None,
                "pct_on": p_on, "pct_pn": p_pn, "pct_total": p_tot,
                "acoes_total": _num(r.get("Quantidade_Total_Acoes_Circulacao")),
                "controlador": ctrl,
                "acordo": (r.get("Participante_Acordo_Acionistas") or "").strip().upper() == "S",
                "nacionalidade": (r.get("Nacionalidade") or "").strip() or None,
                "ultima_alteracao": r.get("Data_Ultima_Alteracao") or None,
            })
        acionistas = _junta_matriz_filial(acionistas)
        acionistas.sort(key=lambda a: (a["tipo"] == "coletivo", -(a["pct_total"] or 0.0), a["nome"]))
        for k in ("pct_on", "pct_pn", "pct_total"):
            pf[k] = round(pf[k], 3)
        out[c] = {"data_referencia": d["data_referencia"], "versao": d["versao"], "id_documento": d["id_documento"],
                  "acionistas": acionistas, "pessoas_fisicas": pf if pf["quantidade"] else None}
    return out


def _junta_matriz_filial(acionistas):
    """Linhas do mesmo acionista declaradas pela matriz e por uma filial (mesma raiz de CNPJ, como a
    AXIA na ISA Energia) viram uma só: percentuais e quantidades somados, controlador e acordo se
    qualquer linha marca. Fica o CNPJ da matriz (ou o menor) e a lista dos CNPJ declarados."""
    por_raiz, out = {}, []
    for a in acionistas:
        if not a["cnpj"]:
            out.append(a)
            continue
        r = a["cnpj"][:8]
        if r not in por_raiz:
            por_raiz[r] = {**a, "cnpjs_declarados": [a["cnpj"]]}
            out.append(por_raiz[r])
            continue
        b = por_raiz[r]
        for k in ("pct_on", "pct_pn", "pct_total", "acoes_total"):
            if a[k] is not None:
                b[k] = round((b[k] or 0.0) + a[k], 6)
        b["controlador"] = b["controlador"] or a["controlador"]
        b["acordo"] = b["acordo"] or a["acordo"]
        b["cnpjs_declarados"].append(a["cnpj"])
        b["cnpj"] = min(b["cnpjs_declarados"])
        b["ultima_alteracao"] = max(x for x in (b["ultima_alteracao"], a["ultima_alteracao"]) if x) if (b["ultima_alteracao"] or a["ultima_alteracao"]) else None
    return out


def le_ipe(linhas, cnpjs, categorias=("Fato Relevante",), desde=None):
    """Documentos do IPE das companhias, nas categorias pedidas, entregues a partir de `desde`
    (AAAA-MM-DD): só a maior versão de cada protocolo."""
    melhor = {}
    for r in linhas:
        c = _c14(r.get("CNPJ_Companhia"))
        if c not in cnpjs or (r.get("Categoria") or "").strip() not in categorias:
            continue
        ent = (r.get("Data_Entrega") or "").strip()
        if desde and ent < desde:
            continue
        prot = (r.get("Protocolo_Entrega") or "").strip()
        k = (c, prot or (ent, r.get("Assunto")))
        v = int(r.get("Versao") or 0)
        if k in melhor and melhor[k][0] >= v:
            continue
        melhor[k] = (v, {
            "cnpj": c,
            "categoria": r["Categoria"].strip(),
            "tipo": (r.get("Tipo") or "").strip() or None,
            "assunto": " ".join((r.get("Assunto") or "").split()) or None,
            "data_referencia": r.get("Data_Referencia") or None,
            "data_entrega": ent,
            "protocolo": prot or None,
            "versao": v,
            "link": (r.get("Link_Download") or "").strip() or None,
        })
    return sorted((x for _, x in melhor.values()), key=lambda x: (x["data_entrega"], x["protocolo"] or ""), reverse=True)
