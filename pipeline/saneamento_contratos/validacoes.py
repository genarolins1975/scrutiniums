"""Validações que retêm a publicação do capítulo 15. Cada função devolve a lista de problemas (vazia quando está tudo certo).

O que reprova:
- leilão com tipo, resultado, grau, tipo de fonte ou serviço fora dos valores permitidos, sem fonte (URL, título, data) ou com
  data fora do período do marco; valor negativo; linha adjudicada sem vencedor; leilão sem propostas com vencedor;
- meta contratual com indicador desconhecido, valor fora de 0 a 100, ano anterior ao leilão, documento sem URL ou sha256
  quando a situação é "transcrito", ou série que cai de um ano para o seguinte no mesmo indicador (meta anual monotônica);
- abrangência de bloco que não existe nos leilões ou nos contratos, código IBGE que não está na gold municipal, município
  repetido no mesmo bloco, ou município em dois blocos com vigências sobrepostas (a mesma cidade dividida por zonas é
  permitida só quando as duas linhas declaram `parcial`);
- estimativa de custo sem base de preço, sem horizonte, sem fonte ou com natureza desconhecida.
"""
from __future__ import annotations

import datetime as dt

from . import fontes as F

Problema = tuple[str, str]


def _data(s: str | None) -> dt.date | None:
    if not s:
        return None
    try:
        return dt.date.fromisoformat(s if len(s) == 10 else f"{s}-01")
    except ValueError:
        return None


def validar_leiloes(linhas: list[dict]) -> list[Problema]:
    p: list[Problema] = []
    ids: set[str] = set()
    for l in linhas:
        i = l.get("id") or "?"
        if i in ids:
            p.append(("leilao_repetido", f"{i}: id repetido"))
        ids.add(i)
        if l.get("tipo") not in F.TIPOS:
            p.append(("tipo", f"{i}: tipo {l.get('tipo')!r} fora de {F.TIPOS}"))
        if l.get("resultado") not in F.RESULTADOS:
            p.append(("resultado", f"{i}: resultado {l.get('resultado')!r} fora de {F.RESULTADOS}"))
        if l.get("servicos") not in F.SERVICOS:
            p.append(("servicos", f"{i}: serviços {l.get('servicos')!r} fora de {F.SERVICOS}"))
        d = _data(l.get("data_leilao"))
        if d is None or d.year < F.ANO_MARCO:
            p.append(("data", f"{i}: data do leilão ausente, inválida ou anterior a {F.ANO_MARCO}"))
        f = l.get("fonte") or {}
        if not (f.get("url") and f.get("titulo") and f.get("data")):
            p.append(("fonte", f"{i}: fonte sem URL, título ou data"))
        if f.get("grau") not in F.GRAUS:
            p.append(("grau", f"{i}: grau {f.get('grau')!r} fora de {F.GRAUS}"))
        if f.get("tipo_fonte") not in F.TIPOS_FONTE:
            p.append(("tipo_fonte", f"{i}: tipo de fonte {f.get('tipo_fonte')!r} fora de {F.TIPOS_FONTE}"))
        for c in ("outorga_rs_mi", "contraprestacao_rs_mi", "investimento_previsto_rs_mi", "municipios", "populacao_mi", "prazo_anos"):
            v = l.get(c)
            if v is not None and (not isinstance(v, (int, float)) or v < 0):
                p.append(("valor", f"{i}: {c} precisa ser número não negativo ou null"))
        if l.get("resultado") == "adjudicado" and not l.get("vencedor"):
            p.append(("vencedor", f"{i}: adjudicado sem vencedor"))
        if l.get("resultado") == "sem_propostas" and l.get("vencedor"):
            p.append(("vencedor", f"{i}: sem propostas com vencedor"))
    return p


def validar_metas(contratos: list[dict], leiloes: list[dict]) -> list[Problema]:
    p: list[Problema] = []
    datas = {l["id"]: _data(l.get("data_leilao")) for l in leiloes}
    for c in contratos:
        i = c.get("id") or "?"
        if c.get("situacao") not in F.SITUACOES_CONTRATO:
            p.append(("situacao", f"{i}: situação {c.get('situacao')!r} fora de {F.SITUACOES_CONTRATO}"))
        if i not in datas:
            p.append(("contrato_sem_leilao", f"{i}: contrato sem linha correspondente em leiloes.json"))
        doc = c.get("documento") or {}
        cal = c.get("calendario")
        if c.get("situacao") == "transcrito":
            if not (doc.get("url") and doc.get("sha256") and doc.get("capturado_em")):
                p.append(("documento", f"{i}: contrato transcrito sem URL, sha256 ou data de captura do documento"))
            if not c.get("clausula"):
                p.append(("clausula", f"{i}: contrato transcrito sem cláusula"))
            if not c.get("metas"):
                p.append(("metas", f"{i}: contrato transcrito sem metas"))
            if cal not in F.CALENDARIOS:
                p.append(("calendario", f"{i}: calendário {cal!r} fora de {F.CALENDARIOS}"))
            if c.get("nivel") not in F.NIVEIS:
                p.append(("nivel", f"{i}: nível {c.get('nivel')!r} fora de {F.NIVEIS}"))
        por_ind: dict[str, list[tuple[int, float]]] = {}
        for m in c.get("metas") or []:
            if m.get("indicador") not in F.INDICADORES:
                p.append(("indicador", f"{i}: indicador {m.get('indicador')!r} fora de {F.INDICADORES}"))
                continue
            v = m.get("valor")
            # civil: ano-calendário, nunca anterior ao leilão; contratual: ano do contrato (0 = início), sem ano civil
            ano = m.get("ano") if cal == "civil" else m.get("ano_contrato")
            if not isinstance(v, (int, float)) or not 0 <= v <= 100:
                p.append(("meta_valor", f"{i}: {m['indicador']} {ano}: valor fora de 0 a 100"))
            if cal == "civil" and (not isinstance(ano, int) or (datas.get(i) and ano < datas[i].year) or m.get("ano_contrato") is not None):
                p.append(("meta_ano", f"{i}: {m['indicador']}: ano civil {ano!r} ausente, anterior ao leilão ou misturado com ano de contrato"))
            if cal == "contratual" and (not isinstance(ano, int) or ano < 0 or m.get("ano") is not None):
                p.append(("meta_ano", f"{i}: {m['indicador']}: ano de contrato {ano!r} ausente, negativo ou misturado com ano civil"))
            if isinstance(ano, int):
                por_ind.setdefault(m["indicador"], []).append((ano, v))
        for ind, serie in por_ind.items():
            serie.sort()
            anos = [a for a, _ in serie]
            if len(anos) != len(set(anos)):
                p.append(("meta_repetida", f"{i}: {ind} com o mesmo ano duas vezes"))
            # perdas (IPL) decrescem; cobertura e tratamento não podem cair de um ano para o seguinte
            for (a1, v1), (a2, v2) in zip(serie, serie[1:]):
                if ind == "IPL" and v2 > v1 + 1e-9:
                    p.append(("meta_monotonica", f"{i}: {ind} sobe de {v1} ({a1}) para {v2} ({a2})"))
                if ind != "IPL" and v2 < v1 - 1e-9:
                    p.append(("meta_monotonica", f"{i}: {ind} cai de {v1} ({a1}) para {v2} ({a2})"))
    return p


def validar_abrangencia(blocos: list[dict], leiloes: list[dict], contratos: list[dict], ibges: set[str]) -> list[Problema]:
    p: list[Problema] = []
    conhecidos = {l["id"] for l in leiloes} | {c["id"] for c in contratos}
    ocupacao: dict[str, list[tuple[str, dt.date, dt.date | None, bool]]] = {}
    for b in blocos:
        i = b.get("id") or "?"
        if b.get("contrato") not in conhecidos:
            p.append(("bloco_sem_contrato", f"{i}: contrato {b.get('contrato')!r} não está em leiloes.json nem em metas_contratuais.json"))
        f = b.get("fonte") or {}
        if not (f.get("url") and f.get("acessado_em")):
            p.append(("fonte", f"{i}: abrangência sem URL ou data de acesso da fonte"))
        if f.get("grau") not in F.GRAUS_ABRANGENCIA:
            p.append(("grau", f"{i}: grau {f.get('grau')!r} fora de {F.GRAUS_ABRANGENCIA}"))
        ini = _data(b.get("inicio"))
        fim = _data(b.get("fim")) if b.get("fim") else None
        if ini is None:
            p.append(("vigencia", f"{i}: bloco sem data de início de vigência"))
            continue
        vistos: set[str] = set()
        for m in b.get("municipios") or []:
            cod = str(m.get("ibge") or "")
            if cod not in ibges:
                p.append(("ibge", f"{i}: código IBGE {cod!r} não está na gold municipal"))
            if cod in vistos:
                p.append(("municipio_repetido", f"{i}: município {cod} repetido no bloco"))
            vistos.add(cod)
            ocupacao.setdefault(cod, []).append((i, ini, fim, bool(m.get("parcial"))))
    for cod, lista in ocupacao.items():
        for a in range(len(lista)):
            for b2 in range(a + 1, len(lista)):
                (ia, ia_ini, ia_fim, pa), (ib, ib_ini, ib_fim, pb) = lista[a], lista[b2]
                sobrepoe = (ia_fim is None or ia_fim >= ib_ini) and (ib_fim is None or ib_fim >= ia_ini)
                if sobrepoe and not (pa and pb):
                    p.append(("sobreposicao", f"município {cod} em {ia} e {ib} com vigências sobrepostas sem marca de divisão parcial"))
    return p


def validar_custos(estimativas: list[dict]) -> list[Problema]:
    p: list[Problema] = []
    for e in estimativas:
        i = e.get("id") or "?"
        if e.get("natureza") not in F.NATUREZAS_CUSTO:
            p.append(("natureza", f"{i}: natureza {e.get('natureza')!r} fora de {F.NATUREZAS_CUSTO}"))
        v = e.get("valor_rs_bi")
        if not isinstance(v, (int, float)) or v < 0:
            p.append(("valor", f"{i}: valor_rs_bi precisa ser número não negativo"))
        for c in ("autor", "titulo", "base_preco", "horizonte", "perimetro"):
            if not e.get(c):
                p.append((c, f"{i}: estimativa sem {c}"))
        f = e.get("fonte") or {}
        if not (f.get("url") and f.get("data")) or f.get("grau") not in F.GRAUS:
            p.append(("fonte", f"{i}: estimativa sem URL, data ou grau válido"))
    return p


def validar_metas_municipios(linhas: list[dict], contratos: list[dict]) -> list[Problema]:
    """Metas por município ou área: contrato conhecido e transcrito, indicador permitido, valor de 0 a 100 ou null com nota,
    e exatamente a chave de ano do calendário do contrato."""
    p: list[Problema] = []
    por_id = {c["id"]: c for c in contratos}
    for n, l in enumerate(linhas):
        c = por_id.get(l.get("contrato"))
        if not c or c.get("situacao") != "transcrito":
            p.append(("municipio_sem_contrato", f"linha {n}: contrato {l.get('contrato')!r} não é um contrato transcrito"))
            continue
        if l.get("indicador") not in F.INDICADORES:
            p.append(("indicador", f"linha {n} ({l.get('contrato')}): indicador {l.get('indicador')!r} fora de {F.INDICADORES}"))
        if not l.get("entidade"):
            p.append(("entidade", f"linha {n} ({l.get('contrato')}): sem município ou área"))
        v = l.get("valor")
        if v is None:
            if not l.get("nota"):
                p.append(("valor_nulo_sem_nota", f"linha {n} ({l.get('contrato')}, {l.get('entidade')}): valor null sem nota"))
        elif not isinstance(v, (int, float)) or not 0 <= v <= 100:
            p.append(("meta_valor", f"linha {n} ({l.get('contrato')}, {l.get('entidade')}): valor fora de 0 a 100"))
        chave = "ano" if c.get("calendario") == "civil" else "ano_contrato"
        # linha sem valor e com nota (ex.: esgoto fora do escopo) pode não ter coluna de ano
        if v is not None and not isinstance(l.get(chave), int):
            p.append(("meta_ano", f"linha {n} ({l.get('contrato')}, {l.get('entidade')}): sem {chave}"))
    return p
