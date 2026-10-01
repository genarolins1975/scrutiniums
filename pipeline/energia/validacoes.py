"""Validações automáticas do domínio Energia (seção 11.7 da especificação).

Dois usos:

1. `viola_horizonte` (chamado pelo run.py nas golds de operação): dado observado não
   pode ter referência além do que a fonte já poderia ter publicado no momento da
   captura (PLD até o dia seguinte, CMO semanal até a semana operativa seguinte, demais
   séries do ONS até a data da captura). Violação derruba a gold e a anterior fica.

2. Validador genérico aplicado ao que está publicado (módulo dados, gold
   publicacao.json): percorre TODAS as golds de public/energia/gold e TODOS os CSV de
   public/energia/series, sem lista fixa, e os conjuntos dos silvers. Cada checagem
   tem veredito explícito (aprovado, ressalva, reprovado, nao_aplicavel), critério,
   contagem e exemplos:

   * esquema da gold (cabeçalho do domínio, JSON sem NaN), proveniência completa,
     links de download existentes, período de referência além da geração, drift de
     esquema em relação à versão publicada no git e tamanho;
   * CSV legível, número de colunas constante, ausência escrita como texto ('nan',
     'None'), linhas duplicadas, chaves repetidas com valores diferentes, datas além de
     hoje, dicionário de colunas publicado e tamanho;
   * identidades de agregação declaradas (total = soma das partes, diferença, razão e
     média diária de valores horários), com tolerância justificada pela precisão de
     publicação e severidade pela origem do total (fonte ou plataforma);
   * por conjunto do silver: capturas com sha256, original no bronze com sha256
     recalculado, horizonte das referências e drift do cabeçalho do arquivo da fonte.

Valor atípico não é descartado aqui: a checagem aponta, e a conferência é feita no
arquivo original. Divergência da própria fonte (o total publicado pelo ONS que não
fecha com as partes) é ressalva documentada, não erro da plataforma.
"""
import csv
import json
import math
import os
import re
import subprocess
from collections import Counter
from datetime import date, datetime, timedelta, timezone

BRASILIA = timezone(timedelta(hours=-3))
RESULTADOS = ("aprovado", "ressalva", "reprovado", "nao_aplicavel")
NATUREZAS = ("OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO")
LIMITE_GOLD_BYTES = 400 * 1024       # contrato dos módulos, seção 1 ("até ~400 KB")
LIMITE_CSV_BYTES = 5 * 1024 * 1024   # contrato dos módulos, seção 1 ("até ~5 MB cada")
AUSENCIA_TEXTUAL = {"nan", "NaN", "None", "null", "undefined", "NULL", "NA", "N/A"}
_LINK = re.compile(r"^/energia/(series|gold|geo)/[\w./\-]+\.(csv|json|parquet|topojson|geojson|xlsx)$")
_SHA = re.compile(r"^[0-9a-f]{64}$")

# gold → [(campo de referência, dataset, folga em dias sobre a data local da captura)]
HORIZONTE = {
    "pld.json": [("ultima_hora", "ccee_pld_horario", 1)],
    "hidrologia.json": [("dia_referencia_ear", "ear_subsistema_di", 0), ("dia_referencia_ena", "ena_subsistema_di", 0)],
    "carga.json": [("dia_referencia", "carga_energia_di", 0)],
    "geracao.json": [("dia_referencia", "balanco_energia_subsistema_ho", 0)],
    "rede.json": [("dia_referencia", "intercambio_nacional_ho", 0), ("dia_referencia_liquido", "balanco_energia_subsistema_ho", 0)],
    "cmo.json": [("semana_referencia", "cmo_se", 14)],
}

# Conjuntos do silver cuja referência legitimamente passa da data da captura, com a
# razão conferida na fonte. Sem entrada aqui, referência futura é ressalva para revisão.
# `series_like`: só as séries que casam (LIKE do SQLite) ficam isentas.
HORIZONTE_SILVER = {
    "ccee_pld_horario": {"folga_dias": 1, "motivo": "O PLD de cada hora é publicado pela CCEE na véspera."},
    "cmo_se": {"folga_dias": 14, "motivo": "O CMO semanal é publicado para a semana operativa seguinte."},
    "ons_cmo_semanal_a02": {"folga_dias": 14, "motivo": "O CMO semanal é publicado para a semana operativa seguinte."},
    "ons_cmo_semihorario": {"folga_dias": 1, "motivo": "O CMO semi-horário do DESSEM é publicado na programação do dia seguinte."},
    "ons_rede_pdo_conversoras": {"folga_dias": 1, "motivo": "Programação diária da operação: valores programados para o dia seguinte."},
    "epe_pde": {"sem_limite": True, "motivo": "Cenário do Plano Decenal (PDE 2035): horizonte futuro por definição (natureza CENARIO)."},
    "aneel_continuidade": {"sem_limite": True, "series_like": "%.lim.%",
                           "motivo": "Limites regulatórios de DEC e FEC fixados pela ANEEL para anos futuros (séries de limite)."},
    "aneel_subsidios_tarifarios": {"sem_limite": True, "motivo": (
        "O dicionário do conjunto (versão 1.0, 01/03/2023) define DatSubsidio como competência do repasse de custeio homologado "
        "em ato normativo, com tipo de montante que inclui Previsão: competências futuras são repasses homologados, não observação.")},
    "regulacao_documentos": {"sem_limite": True, "motivo": "Atos normativos: o período é de vigência, que pode se estender ao futuro."},
    "ons_cvu_termica": {"folga_dias": 14, "motivo": "O CVU é publicado por semana operativa, inclusive a semana seguinte à publicação."},
}
# Arquivos publicados cuja coluna de tempo legitimamente passa de hoje, com a razão.
HORIZONTE_CSV = {
    "carga_calendario.csv": {"sem_limite": True, "motivo": "Calendário de feriados e dias especiais: datas futuras por definição."},
    "cmo_semanal.csv": {"folga_dias": 14, "motivo": "CMO semanal publicado para a semana operativa seguinte."},
    "pld_cmo_semanal.csv": {"folga_dias": 14, "motivo": "CMO semanal publicado para a semana operativa seguinte."},
}


def data_local_captura(capturado_em):
    """Data, no horário de Brasília, de um instante de captura em UTC (AAAA-MM-DDTHH:MM:SSZ)."""
    dt = datetime.fromisoformat(capturado_em.replace("Z", "+00:00"))
    return dt.astimezone(BRASILIA).date()


def viola_horizonte(nome, gold, capturas):
    """Lista de violações. `capturas`: {dataset: último capturado_em (UTC)}."""
    v = []
    if not isinstance(gold, dict) or gold.get("disponivel") is not True:
        return v
    for campo, ds, folga in HORIZONTE.get(nome, []):
        ref, cap = gold.get(campo), capturas.get(ds)
        if not ref or not cap:
            continue
        limite = data_local_captura(cap) + timedelta(days=folga)
        if date.fromisoformat(ref[:10]) > limite:
            v.append(f"{nome}: {campo}={ref} além do horizonte de publicação ({limite.isoformat()}, captura {cap} de {ds})")
    return v


# ---------------------------------------------------------------- resultado


def checagem(id_, alvo, tipo, resultado, detalhe, *, criterio, verificados=None, problemas=0, exemplos=None):
    assert resultado in RESULTADOS, resultado
    return {"id": id_, "alvo": alvo, "tipo": tipo, "resultado": resultado, "detalhe": detalhe, "criterio": criterio,
            "verificados": verificados, "problemas": problemas, "exemplos": list(exemplos or [])[:5]}


def veredito(checagens):
    """Pior resultado entre as checagens aplicáveis (nao_aplicavel não conta)."""
    rs = [c["resultado"] for c in checagens if c["resultado"] != "nao_aplicavel"]
    if not rs:
        return "nao_aplicavel"
    for r in ("reprovado", "ressalva", "aprovado"):
        if r in rs:
            return r
    return "aprovado"


def hoje_brasilia(agora=None):
    agora = agora or datetime.now(timezone.utc)
    return agora.astimezone(BRASILIA).date()


# ---------------------------------------------------------------- golds


def le_json_estrito(caminho):
    """(objeto, erro): JSON com NaN/Infinity é inválido (o navegador não lê)."""
    def recusa(x):
        raise ValueError(f"constante não JSON: {x}")
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f, parse_constant=recusa), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"[:300]


def proveniencias(o, out=None):
    """Todo objeto com natureza, fonte e limitações (o tipo Proveniencia), em qualquer nível."""
    out = [] if out is None else out
    if isinstance(o, dict):
        if "natureza" in o and "fonte" in o and "limitacoes" in o:
            out.append(o)
        for v in o.values():
            proveniencias(v, out)
    elif isinstance(o, list):
        for v in o:
            proveniencias(v, out)
    return out


def links(o, out=None):
    out = set() if out is None else out
    if isinstance(o, str):
        if _LINK.match(o):
            out.add(o)
    elif isinstance(o, dict):
        for v in o.values():
            links(v, out)
    elif isinstance(o, list):
        for v in o:
            links(v, out)
    return out


def problemas_proveniencia(p):
    """Campos obrigatórios ausentes ou inválidos numa proveniência (mesmo contrato de
    src/tests/energia-gold-contrato.test.ts)."""
    f = p.get("fonte") if isinstance(p.get("fonte"), dict) else {}
    per = p.get("periodo_referencia") if isinstance(p.get("periodo_referencia"), dict) else {}
    snap = p.get("snapshot") if isinstance(p.get("snapshot"), dict) else {}
    erros = []
    if p.get("natureza") not in NATUREZAS:
        erros.append(f"natureza {p.get('natureza')!r}")
    if not f.get("orgao"):
        erros.append("fonte.orgao")
    if not str(f.get("url_dataset") or "").startswith("https://"):
        erros.append("fonte.url_dataset")
    if not f.get("licenca"):
        erros.append("fonte.licenca")
    if not per.get("inicio") or not per.get("fim"):
        erros.append("periodo_referencia")
    if not snap.get("id"):
        erros.append("snapshot.id")
    if not _SHA.match(str(snap.get("sha256") or "")):
        erros.append("snapshot.sha256")
    if not p.get("capturado_em"):
        erros.append("capturado_em")
    if not (isinstance(p.get("limitacoes"), list) and p["limitacoes"]):
        erros.append("limitacoes")
    if p.get("natureza") == "CALCULADO" and not p.get("formula"):
        erros.append("formula (natureza CALCULADO)")
    return erros


def assinatura(o, prof=3, prefixo=""):
    """Estrutura da gold até `prof` níveis: {caminho: tipo}. Listas entram pelo primeiro
    item (o esquema do elemento); dicionários com chaves dinâmicas (datas, CNPJ) não
    são distinguíveis de campos e entram como estão."""
    out = {}
    if prof < 0:
        return out
    if isinstance(o, dict):
        for k, v in o.items():
            c = f"{prefixo}.{k}" if prefixo else k
            out[c] = type(v).__name__ if v is not None else "null"
            out.update(assinatura(v, prof - 1, c))
    elif isinstance(o, list) and o:
        out.update(assinatura(o[0], prof - 1, prefixo + "[]"))
    return out


def gold_no_git(nome, raiz, ref="HEAD"):
    """Versão publicada da gold no commit `ref` (None se não versionada)."""
    try:
        r = subprocess.run(["git", "-C", raiz, "show", f"{ref}:public/energia/gold/{nome}"],
                           capture_output=True, timeout=60)
        if r.returncode != 0:
            return None
        return json.loads(r.stdout.decode("utf-8"))
    except Exception:
        return None


def valida_gold(nome, caminho, raiz, *, hoje=None, anterior=None, regras_horizonte=None, sem_proveniencia=()):
    """Checagens de uma gold publicada. `anterior` = a mesma gold no último commit."""
    hoje = hoje or hoje_brasilia()
    regras_horizonte = regras_horizonte if regras_horizonte is not None else HORIZONTE_SILVER
    out = []
    pref = f"gold:{nome}"
    g, erro = le_json_estrito(caminho)
    tam = os.path.getsize(caminho)
    if erro:
        return [checagem(f"{pref}:json", nome, "json", "reprovado", erro, criterio="JSON válido, sem NaN ou Infinity")]
    out.append(checagem(f"{pref}:json", nome, "json", "aprovado", "JSON válido, sem NaN ou Infinity",
                        criterio="JSON válido, sem NaN ou Infinity", verificados=1))
    # cabeçalho do domínio
    falta = []
    if not isinstance(g, dict):
        falta.append("objeto na raiz")
    else:
        if g.get("dominio") != "energia":
            falta.append("dominio = energia")
        if "disponivel" not in g or not isinstance(g.get("disponivel"), bool):
            falta.append("disponivel booleano")
        if not isinstance(g.get("gerado_em"), str) or not g["gerado_em"].endswith("Z"):
            falta.append("gerado_em em UTC")
    disponivel = isinstance(g, dict) and g.get("disponivel") is True
    out.append(checagem(f"{pref}:cabecalho", nome, "esquema", "reprovado" if falta else ("aprovado" if disponivel else "ressalva"),
                        ("Falta: " + "; ".join(falta)) if falta else ("Cabeçalho completo e publicação íntegra" if disponivel else
                                                                       f"Publicação marcada como indisponível: {g.get('motivo')}"),
                        criterio="dominio = energia, disponivel booleano e verdadeiro, gerado_em em UTC", verificados=1,
                        problemas=len(falta) + (0 if disponivel else 1)))
    # proveniências
    provs = proveniencias(g)
    if nome in sem_proveniencia:
        out.append(checagem(f"{pref}:proveniencia", nome, "proveniencia", "nao_aplicavel",
                            "Gold de controle (catálogo, metadados, manifesto): não publica indicador.",
                            criterio="toda proveniência com natureza, fonte, período, snapshot, captura e limitações"))
    elif not provs:
        out.append(checagem(f"{pref}:proveniencia", nome, "proveniencia", "ressalva",
                            "Nenhuma proveniência no formato do contrato (natureza, fonte, limitações) foi encontrada.",
                            criterio="toda proveniência com natureza, fonte, período, snapshot, captura e limitações", verificados=0))
    else:
        ruins = [(p.get("indicador"), problemas_proveniencia(p)) for p in provs]
        ruins = [(i, e) for i, e in ruins if e]
        out.append(checagem(f"{pref}:proveniencia", nome, "proveniencia", "reprovado" if ruins else "aprovado",
                            f"{len(provs) - len(ruins)} de {len(provs)} proveniências completas" if ruins else
                            f"{len(provs)} proveniências completas",
                            criterio="toda proveniência com natureza válida, fonte (órgão, URL https, licença), período, snapshot "
                                     "com sha256, captura e limitações; CALCULADO com fórmula",
                            verificados=len(provs), problemas=len(ruins),
                            exemplos=[{"indicador": i, "faltam": e} for i, e in ruins]))
    # links publicados
    ls = sorted(links(g))
    quebrados = [u for u in ls if not os.path.exists(os.path.join(raiz, "public", u.lstrip("/")))]
    out.append(checagem(f"{pref}:links", nome, "downloads", "reprovado" if quebrados else ("aprovado" if ls else "nao_aplicavel"),
                        f"{len(quebrados)} de {len(ls)} arquivos citados não existem" if quebrados else
                        (f"{len(ls)} arquivos citados existem" if ls else "A gold não cita arquivos de download"),
                        criterio="todo caminho /energia/series, /energia/gold ou /energia/geo citado existe em public/",
                        verificados=len(ls), problemas=len(quebrados), exemplos=quebrados))
    # período além da geração
    futuros = []
    for p in provs:
        fim = str((p.get("periodo_referencia") or {}).get("fim") or "")
        d = _data_inicio_periodo(fim)
        if d is None or d <= hoje:
            continue
        if p.get("natureza") in ("PREVISTO", "CENARIO"):
            continue
        ds = str((p.get("snapshot") or {}).get("id") or "").split("@")[0]
        regra = regras_horizonte.get(ds)
        if regra and (regra.get("sem_limite") or d <= hoje + timedelta(days=regra.get("folga_dias", 0))):
            continue
        futuros.append({"indicador": p.get("indicador"), "fim": fim, "natureza": p.get("natureza"), "conjunto": ds or None})
    out.append(checagem(f"{pref}:datas_futuras", nome, "datas_futuras", "ressalva" if futuros else ("aprovado" if provs else "nao_aplicavel"),
                        f"{len(futuros)} proveniências com período além de {hoje.isoformat()} sem regra de horizonte" if futuros
                        else "Nenhum período observado ou calculado além da data da validação",
                        criterio="fim do período de referência até hoje (Brasília), salvo PREVISTO, CENARIO ou regra de horizonte da fonte",
                        verificados=len(provs), problemas=len(futuros), exemplos=futuros))
    # drift de esquema em relação à publicação anterior no git
    if anterior is None:
        out.append(checagem(f"{pref}:drift", nome, "drift_esquema", "nao_aplicavel", "Sem versão anterior desta gold no git.",
                            criterio="campos e tipos até 3 níveis iguais aos da publicação anterior"))
    elif isinstance(anterior, dict) and anterior.get("disponivel") is False:
        out.append(checagem(f"{pref}:drift", nome, "drift_esquema", "nao_aplicavel", "A versão anterior no git é um stub.",
                            criterio="campos e tipos até 3 níveis iguais aos da publicação anterior"))
    else:
        a, b = assinatura(anterior), assinatura(g)
        removidos = sorted(k for k in a if k not in b and not _dinamica(k))
        tipos = sorted(k for k in a if k in b and a[k] != b[k] and "null" not in (a[k], b[k]))
        novos = sorted(k for k in b if k not in a and not _dinamica(k))
        res = "ressalva" if (removidos or tipos) else "aprovado"
        out.append(checagem(f"{pref}:drift", nome, "drift_esquema", res,
                            f"{len(removidos)} campos removidos, {len(tipos)} com tipo alterado e {len(novos)} novos em relação ao último commit",
                            criterio="campos e tipos até 3 níveis iguais aos da publicação anterior (campo removido pode quebrar a página que o lê)",
                            verificados=len(a), problemas=len(removidos) + len(tipos),
                            exemplos=[{"removido": k} for k in removidos[:3]] + [{"tipo_alterado": k, "antes": a[k], "depois": b[k]} for k in tipos[:2]]))
    out.append(checagem(f"{pref}:tamanho", nome, "tamanho", "ressalva" if tam > LIMITE_GOLD_BYTES else "aprovado",
                        f"{tam / 1024:.0f} KB", criterio=f"até {LIMITE_GOLD_BYTES // 1024} KB (contrato dos módulos)",
                        verificados=1, problemas=int(tam > LIMITE_GOLD_BYTES)))
    return out


def _dinamica(caminho):
    """Chave que é dado, não campo (data, CNPJ, código numérico, sigla de submercado)."""
    ultimo = caminho.rsplit(".", 1)[-1].replace("[]", "")
    return bool(re.match(r"^(\d|[A-Z]{1,4}$|[A-Z]{2}_)", ultimo))


def _data_inicio_periodo(txt):
    txt = (txt or "").strip()
    try:
        if re.match(r"^\d{4}-\d{2}-\d{2}", txt):
            return date.fromisoformat(txt[:10])
        if re.match(r"^\d{4}-\d{2}$", txt):
            return date(int(txt[:4]), int(txt[5:7]), 1)
        if re.match(r"^\d{4}$", txt):
            return date(int(txt), 1, 1)
    except ValueError:
        return None
    return None


# ---------------------------------------------------------------- CSV

_COLUNAS_TEMPO = {"data", "data_hora", "data_hora_local", "dia", "mes", "competencia", "semana_operativa", "ano"}
# colunas que identificam a linha mesmo quando numéricas (ano, código IBGE, CNPJ…)
_ID = re.compile(r"^(data|data_hora\w*|dia|mes|ano\w*|competencia|periodo\w*|semana\w*|hora\w*|origem|horizonte|entrega|"
                 r"submercado|subsistema|sm|regiao|uf|cnpj\w*|cod\w*|id\w*|conjunto|ceg|nucleo_ceg|ug|recorte|tipo\w*|"
                 r"classe\w*|escopo|conta|cd_conta|modelo|serie|indicador|sigla|municipio|bacia|reservatorio|usina|"
                 r"estacao|par|fronteira|pais|patamar|ato|programa|base|subgrupo|subclasse|inicio|fim|vigencia\w*|"
                 r"versao|fonte|universo|faixa\w*|grupo\w*|recurso|evento|categoria|nivel|segmento|posto|rodada|run_id|"
                 r"forecast_id|area|cenario|item|nome|metodo|regime|variavel|tema|processo|numero|data_base\w*)$", re.I)
_NUMERO = re.compile(r"^-?\d+(\.\d+)?([eE][-+]?\d+)?$")


def valida_csv(caminho, url, *, dicionario=(), hoje=None, isentos_datas=("previsoes_",), regras_horizonte=None):
    """Checagens de um CSV publicado (separador ';', ponto decimal, vazio = ausência).
    Leitura em fluxo; a chave inferida guarda só um hash por linha."""
    hoje = hoje or hoje_brasilia()
    nome = os.path.basename(caminho)
    pref = f"csv:{nome}"
    tam = os.path.getsize(caminho)
    out = []
    try:
        fh = open(caminho, encoding="utf-8", newline="")
        leitor = csv.reader(fh, delimiter=";")
        cab = next(leitor)
    except Exception as e:
        return [checagem(f"{pref}:legivel", nome, "esquema", "reprovado", f"{type(e).__name__}: {e}"[:300],
                         criterio="UTF-8, separador ';' e cabeçalho")]
    repetidas = [c for c, n in Counter(cab).items() if n > 1]
    vazias = [i for i, c in enumerate(cab) if not c.strip()]
    ncol = len(cab)
    tempo = [i for i, c in enumerate(cab) if c in _COLUNAS_TEMPO]
    linhas = tortas = 0
    exemplos_tortas, textuais, exemplos_textuais = [], 0, []
    numericas = [True] * ncol
    vistos_linha, dup_exatas, exemplos_dup = set(), 0, []
    chaves = {}
    max_tempo = {}
    for row in leitor:
        if not row:
            continue
        linhas += 1
        if len(row) != ncol:
            tortas += 1
            if len(exemplos_tortas) < 5:
                exemplos_tortas.append({"linha": linhas + 1, "colunas": len(row)})
            continue
        h = hash(tuple(row))
        if h in vistos_linha:
            dup_exatas += 1
            if len(exemplos_dup) < 5:
                exemplos_dup.append({"linha": linhas + 1, "inicio": ";".join(row)[:120]})
        else:
            vistos_linha.add(h)
        for i, v in enumerate(row):
            if v in AUSENCIA_TEXTUAL:
                textuais += 1
                if len(exemplos_textuais) < 5:
                    exemplos_textuais.append({"linha": linhas + 1, "coluna": cab[i], "valor": v})
            if numericas[i] and v != "" and not _NUMERO.match(v):
                numericas[i] = False
        for i in tempo:
            v = row[i]
            if v and (i not in max_tempo or v > max_tempo[i]):
                max_tempo[i] = v
        chaves[h] = row
    fh.close()
    out.append(checagem(f"{pref}:legivel", nome, "esquema", "reprovado" if (repetidas or vazias or ncol < 1) else "aprovado",
                        (f"Colunas repetidas {repetidas} ou sem nome" if (repetidas or vazias) else f"{ncol} colunas, {linhas} linhas"),
                        criterio="UTF-8, ';', cabeçalho com nomes únicos e não vazios", verificados=linhas,
                        problemas=len(repetidas) + len(vazias)))
    out.append(checagem(f"{pref}:colunas", nome, "esquema", "reprovado" if tortas else "aprovado",
                        f"{tortas} linhas com número de colunas diferente do cabeçalho" if tortas else "Todas as linhas têm o número de colunas do cabeçalho",
                        criterio="toda linha com o mesmo número de colunas do cabeçalho", verificados=linhas, problemas=tortas,
                        exemplos=exemplos_tortas))
    out.append(checagem(f"{pref}:ausencia", nome, "ausencia", "reprovado" if textuais else "aprovado",
                        f"{textuais} células com ausência escrita como texto" if textuais else "Ausência sempre como campo vazio",
                        criterio="ausência é campo vazio, nunca 'nan', 'None', 'null' ou 'NA'", verificados=linhas * ncol,
                        problemas=textuais, exemplos=exemplos_textuais))
    out.append(checagem(f"{pref}:duplicadas", nome, "chaves_unicas", "ressalva" if dup_exatas else "aprovado",
                        f"{dup_exatas} linhas idênticas a outra" if dup_exatas else "Nenhuma linha repetida",
                        criterio="nenhuma linha idêntica a outra", verificados=linhas, problemas=dup_exatas, exemplos=exemplos_dup))
    # chave inferida: colunas de identificação (pelo nome) e as não numéricas; valores = o resto
    idx_chave = [i for i, c in enumerate(cab) if _ID.match(c) or not numericas[i]]
    idx_valor = [i for i in range(ncol) if i not in idx_chave]
    if idx_valor and idx_chave:
        vistos, conflitos, exemplos_conf = {}, 0, []
        for row in chaves.values():
            k = tuple(row[i] for i in idx_chave)
            v = tuple(row[i] for i in idx_valor)
            if k in vistos and vistos[k] != v:
                conflitos += 1
                if len(exemplos_conf) < 5:
                    exemplos_conf.append({"chave": dict(zip([cab[i] for i in idx_chave], k))})
            else:
                vistos.setdefault(k, v)
        out.append(checagem(f"{pref}:chave", nome, "chaves_unicas", "ressalva" if conflitos else "aprovado",
                            (f"{conflitos} linhas repetem a chave inferida com valores diferentes" if conflitos else
                             f"Chave inferida única: {', '.join(cab[i] for i in idx_chave)[:200]}"),
                            criterio="colunas de identificação (pelo nome) e não numéricas formam chave única; a inferência pode "
                                     "errar quando a coluna de identificação tem nome fora do padrão",
                            verificados=len(chaves), problemas=conflitos, exemplos=exemplos_conf))
    else:
        out.append(checagem(f"{pref}:chave", nome, "chaves_unicas", "nao_aplicavel",
                            "Sem separação entre colunas de identificação e de valor; vale a checagem de linhas idênticas.",
                            criterio="chave inferida única"))
    # datas além de hoje nas colunas de tempo
    futuras = []
    regra = (regras_horizonte if regras_horizonte is not None else HORIZONTE_CSV).get(nome) or {}
    folga = regra.get("folga_dias", 1)
    if not any(nome.startswith(p) for p in isentos_datas) and not regra.get("sem_limite"):
        for i, v in max_tempo.items():
            d = _data_inicio_periodo(v)
            if d and d > hoje + timedelta(days=folga):
                futuras.append({"coluna": cab[i], "maximo": v})
    out.append(checagem(f"{pref}:datas_futuras", nome, "datas_futuras",
                        "ressalva" if futuras else ("aprovado" if tempo else "nao_aplicavel"),
                        (f"Colunas de tempo com valores além de {hoje.isoformat()}: {futuras}" if futuras else
                         (f"Datas futuras legítimas: {regra['motivo']}" if regra.get("motivo") and tempo else
                          "Nenhuma data além do dia seguinte" if tempo else "Sem coluna de tempo reconhecida")),
                        criterio="colunas data, dia, mês, competência, semana operativa ou ano até o dia seguinte à validação "
                                 "(ou a folga de publicação registrada para o arquivo)",
                        verificados=len(tempo), problemas=len(futuras), exemplos=futuras))
    tem_dic = url in dicionario
    out.append(checagem(f"{pref}:dicionario", nome, "dicionario", "aprovado" if tem_dic else "ressalva",
                        "Dicionário de colunas publicado" if tem_dic else "Arquivo sem descrição de colunas em arquivos.json nem no dicionário de operação",
                        criterio="todo arquivo para download tem colunas, unidades e regra de ausência descritas", verificados=1,
                        problemas=int(not tem_dic)))
    out.append(checagem(f"{pref}:tamanho", nome, "tamanho", "ressalva" if tam > LIMITE_CSV_BYTES else "aprovado",
                        f"{tam / 1024 / 1024:.2f} MB", criterio="até 5 MB por arquivo (contrato dos módulos)", verificados=1,
                        problemas=int(tam > LIMITE_CSV_BYTES)))
    return out


# ---------------------------------------------------------------- identidades

# Identidades de agregação dos arquivos publicados. `origem_total`: quem calcula o
# total. Total da plataforma que não fecha = erro nosso (reprovado); total publicado
# pela fonte que não fecha com as partes publicadas pela mesma fonte = divergência da
# fonte (ressalva documentada, com os dias). Tolerância pela precisão de publicação.
_TOL_SOMA_ONS = ("A fonte publica cada parte com até 3 casas decimais: quatro partes arredondadas somam até "
                 "4 × 0,0005 = 0,002 MWmed de diferença, mais 0,0005 do arredondamento do total.")
IDENTIDADES = [
    {"id": "carga_diaria_sin", "arquivo": "carga_diaria.csv", "tipo": "soma", "total": "SIN_calculado",
     "partes": ["SE", "S", "NE", "N"], "tolerancia": 0.0025, "unidade": "MWmed", "origem_total": "plataforma",
     "justificativa": _TOL_SOMA_ONS},
    {"id": "carga_horaria_sin", "arquivo": "carga_horaria.csv", "tipo": "soma", "total": "SIN",
     "partes": ["SE", "S", "NE", "N"], "tolerancia": 0.0025, "unidade": "MWmed", "origem_total": "plataforma",
     "justificativa": _TOL_SOMA_ONS},
    *[{"id": f"carga_verificada_liquida_{s}", "arquivo": "carga_verificada_horaria.csv", "tipo": "diferenca",
       "total": f"liquida_{s}", "partes": [f"global_{s}", f"mmgd_{s}"], "tolerancia": 0.0015, "unidade": "MWmed",
       "origem_total": "fonte",
       "justificativa": "Três valores com 3 casas decimais: a diferença arredondada fica a até 3 × 0,0005 = 0,0015 MWmed."}
      for s in ("SE", "S", "NE", "N", "SIN")],
    {"id": "carga_verificada_global_sin", "arquivo": "carga_verificada_horaria.csv", "tipo": "soma", "total": "global_SIN",
     "partes": ["global_SE", "global_S", "global_NE", "global_N"], "tolerancia": 0.0025, "unidade": "MWmed",
     "origem_total": "fonte", "justificativa": _TOL_SOMA_ONS},
    *[{"id": f"geracao_sin_{f}", "arquivo": "geracao_diaria.csv", "tipo": "soma", "total": f"{f}_SIN",
       "partes": [f"{f}_{s}" for s in ("SE", "S", "NE", "N")], "tolerancia": 0.0025, "unidade": "MWmed",
       "origem_total": "fonte", "justificativa": _TOL_SOMA_ONS + " O SIN é a linha publicada pelo ONS no balanço."}
      for f in ("hidraulica", "termica", "eolica", "solar")],
    {"id": "carga_verificada_diaria_liquida", "arquivo": "carga_verificada_diaria.csv", "tipo": "diferenca",
     "total": "carga_liquida_mwmed", "partes": ["carga_global_mwmed", "mmgd_mwmed"], "tolerancia": 0.0015, "unidade": "MWmed",
     "origem_total": "plataforma", "justificativa": "Três valores com 3 casas decimais (3 × 0,0005)."},
    {"id": "carga_verificada_diaria_mmgd_pct", "arquivo": "carga_verificada_diaria.csv", "tipo": "razao",
     "total": "mmgd_pct", "partes": ["mmgd_mwmed", "carga_global_mwmed"], "fator": 100.0, "tolerancia": 0.0006, "unidade": "p.p.",
     "origem_total": "plataforma",
     "justificativa": "Percentual com 3 casas (0,0005) mais o efeito de numerador e denominador com 3 casas (< 0,0001 p.p.)."},
    {"id": "perdas_nacional_taxa_total", "arquivo": "perdas_nacional.csv", "tipo": "razao", "total": "taxa_total_pct",
     "partes": ["perdas_totais_mwh", "injetada_referencia_mwh"], "fator": 100.0, "tolerancia": 0.005, "unidade": "p.p.",
     "origem_total": "plataforma", "justificativa": "Taxa publicada com 2 casas decimais: meia unidade da última casa."},
    {"id": "pld_diario_media_horaria", "arquivo": "pld_diario.csv", "tipo": "media_diaria", "arquivo_base": "pld_horario.csv",
     "coluna_tempo": "data", "coluna_tempo_base": "data_hora_local", "colunas": ["SE", "S", "NE", "N"], "horas": 24,
     "tolerancia": 0.0001, "unidade": "R$/MWh", "origem_total": "plataforma",
     "justificativa": "Média diária gravada com 4 casas (0,00005) sobre preços horários com 2 casas; só dias com as 24 horas."},
]


def _num(v):
    if v is None or v == "":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return x if math.isfinite(x) else None


def valida_identidade(ident, dir_series):
    """Aplica uma identidade declarada; arquivo ausente = nao_aplicavel (genérico: a
    lista não obriga nenhum módulo a existir)."""
    cid = f"identidade:{ident['id']}"
    arq = os.path.join(dir_series, ident["arquivo"])
    crit = f"{ident['tipo']} com tolerância {ident['tolerancia']} {ident['unidade']}: {ident['justificativa']}"
    if not os.path.exists(arq):
        return checagem(cid, ident["arquivo"], "identidade", "nao_aplicavel", "Arquivo não publicado nesta versão.", criterio=crit)
    if ident["tipo"] == "media_diaria":
        return _valida_media_diaria(ident, dir_series, cid, crit)
    with open(arq, encoding="utf-8", newline="") as fh:
        leitor = csv.DictReader(fh, delimiter=";")
        cols = [ident["total"], *ident["partes"]]
        if any(c not in (leitor.fieldnames or []) for c in cols):
            return checagem(cid, ident["arquivo"], "identidade", "reprovado",
                            f"Colunas ausentes: {[c for c in cols if c not in (leitor.fieldnames or [])]}", criterio=crit)
        n = viol = 0
        pior, exemplos = 0.0, []
        tcol = next((c for c in (leitor.fieldnames or []) if c in _COLUNAS_TEMPO), None)
        for r in leitor:
            t = _num(r[ident["total"]])
            ps = [_num(r[p]) for p in ident["partes"]]
            if t is None or any(p is None for p in ps):
                continue
            if ident["tipo"] == "soma":
                esperado = sum(ps)
            elif ident["tipo"] == "diferenca":
                esperado = ps[0] - sum(ps[1:])
            elif ident["tipo"] == "razao":
                if ps[1] == 0:
                    continue
                esperado = ident.get("fator", 1.0) * ps[0] / ps[1]
            else:
                raise ValueError(ident["tipo"])
            n += 1
            d = t - esperado
            if abs(d) > ident["tolerancia"] + 1e-9:
                viol += 1
                if abs(d) > pior:
                    pior = abs(d)
                if len(exemplos) < 5 or abs(d) > min(abs(e["diferenca"]) for e in exemplos):
                    exemplos.append({"quando": r.get(tcol) if tcol else None, "publicado": t, "esperado": round(esperado, 6),
                                     "diferenca": round(d, 6)})
                    exemplos.sort(key=lambda e: -abs(e["diferenca"]))
                    exemplos = exemplos[:5]
    if n == 0:
        return checagem(cid, ident["arquivo"], "identidade", "nao_aplicavel", "Nenhuma linha com todas as colunas preenchidas.",
                        criterio=crit)
    sev = "reprovado" if ident["origem_total"] == "plataforma" else "ressalva"
    return checagem(cid, ident["arquivo"], "identidade", sev if viol else "aprovado",
                    (f"{viol} de {n} linhas fora da tolerância; maior diferença {pior:.4f} {ident['unidade']}"
                     + (" (divergência entre total e partes publicados pela fonte)" if ident["origem_total"] == "fonte" else ""))
                    if viol else f"{n} linhas dentro da tolerância",
                    criterio=crit, verificados=n, problemas=viol, exemplos=exemplos)


def _valida_media_diaria(ident, dir_series, cid, crit):
    base_arq = os.path.join(dir_series, ident["arquivo_base"])
    if not os.path.exists(base_arq):
        return checagem(cid, ident["arquivo"], "identidade", "nao_aplicavel", "Arquivo de base não publicado.", criterio=crit)
    somas = {}
    with open(base_arq, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            dia = r[ident["coluna_tempo_base"]][:10]
            for c in ident["colunas"]:
                v = _num(r.get(c))
                if v is None:
                    continue
                s = somas.setdefault((dia, c), [0.0, 0])
                s[0] += v
                s[1] += 1
    n = viol = 0
    pior, exemplos = 0.0, []
    with open(os.path.join(dir_series, ident["arquivo"]), encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            for c in ident["colunas"]:
                v = _num(r.get(c))
                s = somas.get((r[ident["coluna_tempo"]], c))
                if v is None or not s or s[1] != ident["horas"]:
                    continue
                n += 1
                d = v - s[0] / s[1]
                if abs(d) > ident["tolerancia"] + 1e-9:
                    viol += 1
                    pior = max(pior, abs(d))
                    if len(exemplos) < 5:
                        exemplos.append({"quando": r[ident["coluna_tempo"]], "coluna": c, "diferenca": round(d, 6)})
    if n == 0:
        return checagem(cid, ident["arquivo"], "identidade", "nao_aplicavel", "Nenhum dia completo nos dois arquivos.", criterio=crit)
    return checagem(cid, ident["arquivo"], "identidade", "reprovado" if viol else "aprovado",
                    f"{viol} de {n} médias diárias fora da tolerância (maior {pior:.6f})" if viol else
                    f"{n} médias diárias iguais à média das 24 horas de {ident['arquivo_base']}",
                    criterio=crit, verificados=n, problemas=viol, exemplos=exemplos)


# ---------------------------------------------------------------- conjuntos do silver


def valida_conjunto(chave, an, *, regra_horizonte=None, documento=False):
    """Checagens de um conjunto do silver a partir de silver_dados.analisa. O estado
    VALIDADO do catálogo exige que nenhuma delas esteja reprovada."""
    out = []
    vs = an.get("_vintages") or []
    pref = f"conjunto:{chave}"
    sem_sha = [v for v in vs if not _SHA.match(str(v.get("sha256") or "")) or not v.get("capturado_em")]
    out.append(checagem(f"{pref}:capturas", chave, "capturas", "reprovado" if (not vs or sem_sha) else "aprovado",
                        ("Nenhuma captura registrada no silver" if not vs else
                         f"{len(sem_sha)} capturas sem sha256 ou sem instante" if sem_sha else
                         f"{len(vs)} capturas com sha256 e instante de captura"),
                        criterio="toda captura com sha256 do arquivo original e instante UTC", verificados=len(vs),
                        problemas=len(sem_sha) if vs else 1))
    br = an.get("bronze")
    if br is None:
        out.append(checagem(f"{pref}:original", chave, "original", "nao_aplicavel", "Sem capturas para conferir.",
                            criterio="original presente no bronze com sha256 igual ao registrado"))
    else:
        if br["sha256_divergentes"]:
            res, det = "reprovado", f"{br['sha256_divergentes']} arquivos com sha256 diferente do registrado na captura"
        elif br["arquivos_ausentes"]:
            res, det = "ressalva", (f"{br['arquivos_ausentes']} originais ausentes do bronze neste ambiente (a cópia durável do "
                                    f"pipeline guarda só o silver); {br['sha256_conferidos']} conferidos")
        else:
            res, det = "aprovado", f"{br['sha256_conferidos']} originais com sha256 recalculado igual ao registrado"
        out.append(checagem(f"{pref}:original", chave, "original", res, det,
                            criterio="captura vigente e a anterior de cada recurso presentes no bronze; sha256 recalculado "
                                     "(arquivos comprimidos até 64 MB) igual ao registrado",
                            verificados=br["arquivos_presentes"] + br["arquivos_ausentes"],
                            problemas=br["sha256_divergentes"] + br["arquivos_ausentes"],
                            exemplos=br["exemplos_divergentes"] or br["exemplos_ausentes"]))
        if br["drift"]:
            out.append(checagem(f"{pref}:drift_fonte", chave, "drift_esquema", "ressalva",
                                f"Cabeçalho mudou entre capturas em {br['drift_total']} recursos",
                                criterio="mesmas colunas, na mesma ordem, entre a captura vigente e a anterior do mesmo recurso",
                                verificados=br["csv_com_cabecalho"], problemas=br["drift_total"], exemplos=br["drift"]))
        else:
            out.append(checagem(f"{pref}:drift_fonte", chave, "drift_esquema",
                                "aprovado" if br["csv_com_cabecalho"] else "nao_aplicavel",
                                (f"Cabeçalho estável em {br['csv_com_cabecalho']} recursos CSV"
                                 + (f"; {br['recursos_com_esquema_diferente_total']} recursos (anos) com colunas diferentes do modal"
                                    if br["recursos_com_esquema_diferente_total"] else "")) if br["csv_com_cabecalho"]
                                else "Recursos sem cabeçalho CSV legível (Parquet, XLSX, ZIP, PDF ou JSON)",
                                criterio="mesmas colunas, na mesma ordem, entre a captura vigente e a anterior do mesmo recurso",
                                verificados=br["csv_com_cabecalho"], problemas=0,
                                exemplos=br["recursos_com_esquema_diferente"][:3]))
    hz = an.get("horizonte")
    regra = regra_horizonte or {}
    if hz is None:
        out.append(checagem(f"{pref}:horizonte", chave, "datas_futuras", "nao_aplicavel",
                            "Conjunto sem observações numéricas com referência temporal.",
                            criterio="nenhuma referência posterior à data da captura que a trouxe"))
    elif hz["violacoes"] == 0:
        out.append(checagem(f"{pref}:horizonte", chave, "datas_futuras", "aprovado" if hz["vintages_verificadas"] else "nao_aplicavel",
                            f"{hz['vintages_verificadas']} capturas sem referência posterior à data da captura"
                            + (f" (folga de {regra.get('folga_dias')} dia(s): {regra.get('motivo')})" if regra.get("folga_dias") else "")
                            + (f" (séries isentas: {regra.get('motivo')})" if regra.get("series_like") else ""),
                            criterio="nenhuma referência posterior à data (Brasília) da captura que a trouxe, mais a folga de publicação da fonte",
                            verificados=hz["vintages_verificadas"]))
    elif regra.get("sem_limite") and not regra.get("series_like"):
        out.append(checagem(f"{pref}:horizonte", chave, "datas_futuras", "aprovado",
                            f"Referências futuras em {hz['violacoes']} capturas, legítimas: {regra['motivo']}",
                            criterio="referência futura só com razão conferida na fonte", verificados=hz["vintages_verificadas"],
                            exemplos=hz["exemplos"]))
    else:
        out.append(checagem(f"{pref}:horizonte", chave, "datas_futuras", "ressalva",
                            f"{hz['violacoes']} capturas trazem referência posterior à data da captura (sem razão registrada)",
                            criterio="nenhuma referência posterior à data (Brasília) da captura que a trouxe, mais a folga de publicação da fonte",
                            verificados=hz["vintages_verificadas"], problemas=hz["violacoes"], exemplos=hz["exemplos"]))
    tem_conteudo = bool(an.get("observacoes")) or bool(an.get("registros"))
    out.append(checagem(f"{pref}:conteudo", chave, "conteudo",
                        "aprovado" if tem_conteudo else ("nao_aplicavel" if documento else "ressalva"),
                        ("Observações ou registros extraídos do arquivo" if tem_conteudo else
                         "Documento guardado como original (PDF, página): o conteúdo é citado, não tabulado" if documento else
                         "Capturas sem observações nem registros extraídos no silver"),
                        criterio="conjunto integrado tem conteúdo extraído no silver (documentos são citados)", verificados=1,
                        problemas=0 if (tem_conteudo or documento) else 1))
    return out
