"""Validador mecânico da nota (piloto, PR 2). Código, sem modelo de linguagem.

Confere a FONTE da nota (com marcadores) contra o pacote de fatos e contra a constituição
(docs/CONSTITUICAO.md). Cada checagem devolve itens com linha e motivo. Decisão:

    bloquear  falha em M1 (pacote), M2 (fato inexistente), M3 (número digitado),
              M6 (direção contrária ao sinal) ou M11 (número no recorte errado)
              ou M10 (tema vedado)
    devolver  qualquer outra falha
    aprovar   nenhuma falha (a nota segue para as três revisões independentes)

Checagens:
    M1  pacote íntegro e o mesmo declarado na nota; opcionalmente reproduzível na gold
    M2  todo marcador aponta para fato existente no pacote
    M3  nenhum dígito fora de marcador (nem em título, nem em data)
    M4  fato com defasagem própria vem com a data de referência no mesmo parágrafo
    M5  classe em todo parágrafo; Evidência e Inferência citam fato; Inferência declara
        o que a refutaria; nenhuma Recomendação
    M6  palavra de direção coerente com o sinal do fato; valor sem sinal exige direção
    M7  léxico proibido: rating, recomendação, previsão, adjetivo valorativo sem régua,
        faixa verbal de risco
    M8  hífen ou travessão na prosa
    M9  lacunas do pacote declaradas quando existem
    M10 tema vedado (instituição nomeada, FGC, Open Finance, resolução): bloqueia sempre
    M11 recorte: o texto que antecede o número fala da mesma série e do mesmo segmento

Uso: python3 -m pesquisa.validador nota.md --pacote pacote.json [--gold DIR] [--saida validacao.json]
"""
import argparse
import json
import os
import re
import sys

from pesquisa import fatos_conjuntura as fc
from pesquisa import nota as nt

VERSAO = "validador_mecanico_v4"
BLOQUEIAM = {"M1", "M2", "M3", "M6", "M10", "M11"}
FRASE_REFUTACAO = "Refutaria esta leitura:"

DIRECAO = {
    "+": r"alta|altas|subiu|subiram|sobe|sobem|cresceu|cresceram|cresce|crescem|crescimento|avançou|avançaram"
         r"|avanço|aumentou|aumentaram|aumento|expansão|expandiu|elevou|elevação|acelerou|acréscimo",
    "−": r"queda|quedas|caiu|caíram|cai|caem|recuou|recuaram|recuo|diminuiu|diminuíram|diminuição|redução"
         r"|reduziu|retração|retraiu|contraiu|contração|cedeu|declínio",
    "0": r"estável|estáveis|estabilidade|inalterado|inalterada|inalterados|inalteradas|manteve|mantiveram",
}
RE_DIRECAO = {s: re.compile(rf"\b({p})\b", re.I) for s, p in DIRECAO.items()}

PROIBIDOS = [
    (r"\brating", "vocabulário de rating"),
    (r"recomend", "recomendação em nota"),
    (r"\bprojeç|\bprevis[ãaõo]|\bdeverá\b|\bdeverão\b|\btende a\b|\btendem a\b", "previsão fora da gold"),
    (r"\bfortes?\b|\bfortemente\b|\bfrac[oa]s?\b", "adjetivo valorativo sem régua"),
    (r"preocupante|alarmante|expressiv|robust|\brecorde|dramátic|explosiv|surpreendent|\bsólid|saudáve", "adjetivo valorativo sem régua"),
    (r"\brisco (muito )?(elevado|baixo)\b", "faixa verbal de risco"),
]

SENSIVEIS = ["FGC", "Fundo Garantidor", "Open Finance", "garantia de depósito", "garantias de depósito",
             "liquidação extrajudicial", "RAET", "intervenção", "regime de resolução", "regimes de resolução",
             "resolução bancária", "Associação Open Finance"]
INSTITUICOES = ["Itaú", "Bradesco", "Santander", "Caixa Econômica", "Banco do Brasil", "Nubank", "BTG",
                "Sicredi", "Sicoob", "Banrisul", "C6 Bank", "PicPay", "Mercado Pago", "PagBank", "Stone",
                "XP", "Safra", "Votorantim", "Daycoval", "BMG", "Agibank", "Pan", "Inter"]

FAMILIAS = {
    "saldo": r"saldo|carteira|estoque",
    "concessoes": r"concess",
    "taxa": r"\btaxa|juros",
    "spread": r"spread",
    "inad": r"inadimpl|atraso",
    "credito_pib": r"\bPIB\b|produto interno",
    "endividamento": r"endivid",
    "comprometimento": r"comprometimento",
}
SEGMENTOS = {"pf": r"pessoas? físicas?|\bPF\b", "pj": r"pessoas? jurídicas?|\bempresas\b|\bPJ\b",
             "total": r"\btotal\b"}


def _familia_segmento(fid):
    serie = fid.split(".")[0]
    for fam in FAMILIAS:
        if serie == fam or serie.startswith(fam + "_"):
            seg = serie[len(fam) + 1:] if serie != fam else None
            return fam, seg
    return None, None


def _item(codigo, linha, motivo):
    return {"codigo": codigo, "linha": linha, "motivo": motivo}


def _sem_marcadores(texto):
    return nt.MARCADOR.sub(" ", texto)


def _frases(texto):
    """Divide em frases sem quebrar ids de marcador (que têm ponto sem espaço)."""
    return [f for f in re.split(r"(?<=[.!?])\s+", texto) if f.strip()]


# ---------------------------------------------------------------- checagens

def _m1(cab, pacote, gold_dir):
    out = []
    if fc.sha256_fatos(pacote.get("fatos", [])) != pacote.get("sha256_fatos"):
        out.append(_item("M1", None, "sha256_fatos não confere com o conteúdo do pacote"))
    if cab.get("pacote_sha256") != pacote.get("sha256_fatos"):
        out.append(_item("M1", None, "a nota declara pacote_sha256 diferente do pacote recebido"))
    if cab.get("data_base") != pacote.get("data_base"):
        out.append(_item("M1", None, f"data_base da nota ({cab.get('data_base')}) difere da do pacote ({pacote.get('data_base')})"))
    if gold_dir:
        for d in fc.verificar(pacote, gold_dir):
            out.append(_item("M1", None, f"fato {d['fato']} não reproduz na gold: {d['problema']}"))
    return out


def _m2(blocos, fatos):
    out = []
    for b in blocos:
        for _i, _f, modo, fid, absoluto in nt.marcadores(b["texto"]):
            if fid in ("data_base", "lacunas") and not modo and not absoluto:
                continue
            if fid not in fatos:
                out.append(_item("M2", b["linha"], f"marcador aponta para fato inexistente: {fid}"))
            elif absoluto and "texto_abs" not in fatos[fid]:
                out.append(_item("M2", b["linha"], f"fato {fid} não tem forma sem sinal"))
    return out


def _m3(blocos):
    out = []
    for b in blocos:
        resto = _sem_marcadores(b["texto"])
        achados = re.findall(r"\S*\d\S*", resto)
        if achados:
            out.append(_item("M3", b["linha"], f"número digitado fora de marcador: {', '.join(achados[:5])}"))
    return out


def _m4(blocos, fatos, pacote):
    out = []
    for b in blocos:
        if b["tipo"] != "paragrafo":
            continue
        ms = nt.marcadores(b["texto"])
        # a data declarada vale para todos os fatos da mesma série com a mesma referência
        # (falso positivo achado no ciclo retrospectivo de jun/2026: "com referência em
        # {{data:comprometimento.nivel}}" cobre comprometimento.delta_mes_pp)
        datas = {(fid.split(".")[0], fatos[fid]["data_ref"]) for _i, _f, modo, fid, _a in ms
                 if modo == "data" and fid in fatos}
        for _i, _f, modo, fid, _a in ms:
            f = fatos.get(fid)
            if modo or not f:
                continue
            if f["data_ref"] != pacote["data_base"] and (fid.split(".")[0], f["data_ref"]) not in datas:
                out.append(_item("M4", b["linha"], f"{fid} tem referência {f['data_ref']}, diferente da data base; "
                                                   f"use {{{{data:{fid}}}}} no mesmo parágrafo"))
    return out


def _m5(cab, blocos, fatos):
    out = []
    for b in blocos:
        if b["tipo"] != "paragrafo":
            continue
        if not b["classe"]:
            out.append(_item("M5", b["linha"], "parágrafo sem classe ([EVIDÊNCIA], [INFERÊNCIA] ou [RECOMENDAÇÃO])"))
            continue
        ms = nt.marcadores(b["texto"])
        cita = any(fid in fatos and not modo for _i, _f, modo, fid, _a in ms)
        # declarar lacuna é evidência de ausência (art. 3); vale para Evidência, não para Inferência
        declara_lacuna = any(fid == "lacunas" for _i, _f, _m, fid, _a in ms)
        if b["classe"] == "EVIDÊNCIA" and not (cita or declara_lacuna):
            out.append(_item("M5", b["linha"], "parágrafo de evidência sem nenhum fato do pacote"))
        if b["classe"] == "INFERÊNCIA" and not cita:
            out.append(_item("M5", b["linha"], "parágrafo de inferência sem nenhum fato do pacote"))
        if b["classe"] == "INFERÊNCIA" and FRASE_REFUTACAO not in b["texto"]:
            out.append(_item("M5", b["linha"], f"inferência sem declarar o que a refutaria ('{FRASE_REFUTACAO}')"))
        if b["classe"] == "RECOMENDAÇÃO":
            out.append(_item("M5", b["linha"], "notas do Observatório não recomendam (constituição, art. 2)"))
    return out


SEPARADOR = re.compile(r",|;|:|\se\s")


def _trecho_proprio(trecho, tem_anterior):
    """Texto que qualifica o marcador, sem o complemento posposto do marcador anterior.

    Em "alta de {{a}} da taxa das pessoas físicas, e alta de {{b}} da inadimplência" o trecho
    antes de b começa com "da taxa das pessoas físicas", que qualifica a e não b. Com marcador
    anterior na frase, a primeira oração do trecho (até vírgula, ponto e vírgula, dois pontos ou
    " e ") é descartada quando não traz palavra de direção. Falso positivo achado no ciclo
    jul/2026 (rodadas 0 e 2); controles L07 e L08."""
    if not tem_anterior:
        return trecho
    m = SEPARADOR.search(trecho)
    if not m or _direcao_antes(trecho[:m.start()]) is not None:
        return trecho
    return trecho[m.start():]


def _direcao_antes(trecho):
    ult, sinal = -1, None
    for s, rx in RE_DIRECAO.items():
        for m in rx.finditer(trecho):
            if m.start() > ult:
                ult, sinal = m.start(), s
    return sinal


CONECTORES = {"no", "na", "nos", "mês", "e", "de", "em", "doze", "meses", "ano", "anual", "mensal",
              "últimos", "o", "a", "sobre", "período", "termos", "nominais", "nominal", "reais", "real"}


def _deltas_da_serie(fatos, fid):
    serie = fid.split(".")[0]
    return [f["sinal"] for k, f in fatos.items() if k.startswith(serie + ".") and "sinal" in f]


def _m6(blocos, fatos):
    """Direção coerente com o sinal. Três casos: (a) fato com sinal, palavra de direção antes
    ou logo depois ("alta de X", "X de alta"); (b) elipse ("alta de X no mês e de Y em doze
    meses") herda a direção anterior; (c) nível com palavra de direção ("subiu para X") é
    conferido contra os deltas da mesma série: conflito só se contrariar TODOS."""
    out = []
    for b in blocos:
        for frase in _frases(b["texto"]):
            ms = nt.marcadores(frase)
            fim_anterior, sinal_anterior = 0, None
            for i, (ini, fim, modo, fid, absoluto) in enumerate(ms):
                if modo:
                    continue
                f = fatos.get(fid)
                antes = _trecho_proprio(_sem_marcadores(frase[fim_anterior:ini]), fim_anterior > 0)
                fim_anterior = fim
                if not f:
                    continue
                sinal = _direcao_antes(antes)
                if sinal is None:
                    prox = ms[i + 1][0] if i + 1 < len(ms) else len(frase)
                    m = re.match(r"\s*(de|em)\s+(\w+)", frase[fim:prox])
                    if m:
                        sinal = _direcao_antes(m.group(2))
                if sinal is None and sinal_anterior is not None:
                    palavras = re.findall(r"[\wÀ-ú]+", antes.lower())
                    if palavras and set(palavras) <= CONECTORES:
                        sinal = sinal_anterior
                palavra = {"+": "alta", "−": "queda", "0": "estabilidade"}.get(sinal)
                if "sinal" in f:
                    if sinal is not None and sinal != f["sinal"]:
                        out.append(_item("M6", b["linha"], f"texto indica {palavra} e o fato {fid} tem sinal {f['sinal']} ({f['texto']})"))
                    elif sinal is None and absoluto:
                        out.append(_item("M6", b["linha"], f"{fid} citado sem sinal e sem palavra de direção"))
                    sinal_anterior = sinal if sinal is not None else f["sinal"]
                elif sinal is not None:
                    deltas = _deltas_da_serie(fatos, fid)
                    if deltas and all(d != sinal for d in deltas):
                        out.append(_item("M6", b["linha"], f"texto indica {palavra} junto de {fid}, e todas as variações da série no pacote contrariam ({', '.join(deltas)})"))
                    sinal_anterior = sinal
    return out


def _m7(blocos):
    out = []
    for b in blocos:
        resto = _sem_marcadores(b["texto"])
        for rx, motivo in PROIBIDOS:
            m = re.search(rx, resto, flags=re.I)
            if m:
                out.append(_item("M7", b["linha"], f"{motivo}: '{m.group(0)}'"))
    return out


def _m8(blocos):
    out = []
    for b in blocos:
        resto = _sem_marcadores(b["texto"])
        m = re.search(r"[-‐‑‒–—―]", resto)
        if m:
            out.append(_item("M8", b["linha"], f"hífen ou travessão na prosa: '{resto[max(0, m.start() - 15):m.end() + 15].strip()}'"))
    return out


def _m9(blocos, pacote):
    if not pacote.get("lacunas"):
        return []
    usa = any(fid == "lacunas" for b in blocos for _i, _f, _m, fid, _a in nt.marcadores(b["texto"]))
    return [] if usa else [_item("M9", None, f"o pacote declara {len(pacote['lacunas'])} lacuna(s); a nota precisa de {{{{lacunas}}}}")]


def _m10(cab, blocos, nomes_instituicoes):
    """Tema vedado (constituição v2, art. 5): bloqueia sempre. Sem revisão humana não há
    quem se declare impedido, então o tema fica fora da nota em qualquer degrau."""
    achados = set()
    for b in blocos:
        resto = _sem_marcadores(b["texto"])
        for termo in SENSIVEIS + list(nomes_instituicoes):
            if re.search(rf"(?<![\wÀ-ú]){re.escape(termo)}(?![\wÀ-ú])", resto):
                achados.add(termo)
    return [_item("M10", None, f"tema vedado: {termo}") for termo in sorted(achados)]


def _m11(blocos, fatos):
    out = []
    for b in blocos:
        for frase in _frases(b["texto"]):
            fim_anterior = 0
            for ini, fim, modo, fid, _a in nt.marcadores(frase):
                if modo:
                    continue
                if fid not in fatos:
                    fim_anterior = fim
                    continue
                fam, seg = _familia_segmento(fid)
                trecho = _trecho_proprio(_sem_marcadores(frase[fim_anterior:ini]), fim_anterior > 0)
                fim_anterior = fim
                if not fam:
                    continue
                citadas = {f for f, rx in FAMILIAS.items() if re.search(rx, trecho, flags=re.I)}
                if citadas and fam not in citadas:
                    out.append(_item("M11", b["linha"], f"o texto antes de {fid} fala de {', '.join(sorted(citadas))}, não de {fam}"))
                if seg in SEGMENTOS:
                    segs = {s for s, rx in SEGMENTOS.items() if re.search(rx, trecho, flags=re.I)}
                    if segs and seg not in segs:
                        out.append(_item("M11", b["linha"], f"o texto antes de {fid} fala de {', '.join(sorted(segs))}, não de {seg}"))
    return out


# ---------------------------------------------------------------- decisão

def validar(texto_nota, pacote, gold_dir=None, nomes_instituicoes=None):
    cab, blocos = nt.ler_nota(texto_nota)
    fatos = {f["id"]: f for f in pacote.get("fatos", [])}
    nomes = INSTITUICOES if nomes_instituicoes is None else nomes_instituicoes
    itens = (_m1(cab, pacote, gold_dir) + _m2(blocos, fatos) + _m3(blocos) + _m4(blocos, fatos, pacote)
             + _m5(cab, blocos, fatos) + _m6(blocos, fatos) + _m7(blocos) + _m8(blocos)
             + _m9(blocos, pacote) + _m10(cab, blocos, nomes) + _m11(blocos, fatos))
    codigos = sorted({i["codigo"] for i in itens}, key=lambda c: int(c[1:]))
    decisao = "bloquear" if BLOQUEIAM & set(codigos) else "devolver" if codigos else "aprovar"
    return {
        "versao_validador": VERSAO,
        "decisao": decisao,
        "falhas": codigos,
        "itens": itens,
        "nota_sha256": nt.sha256_texto(texto_nota),
        "sha256_fatos": pacote.get("sha256_fatos"),
        "degrau_declarado": cab.get("degrau"),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Validador mecânico da nota (sem modelo de linguagem).")
    ap.add_argument("nota")
    ap.add_argument("--pacote", required=True)
    ap.add_argument("--gold", help="confere também cada fato contra esta gold (M1)")
    ap.add_argument("--saida", help="grava o resultado em JSON")
    args = ap.parse_args(argv)
    with open(args.nota, encoding="utf-8") as f:
        texto = f.read()
    with open(args.pacote, encoding="utf-8") as f:
        pacote = json.load(f)
    r = validar(texto, pacote, args.gold)
    if args.saida:
        with open(args.saida, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
    for i in r["itens"]:
        print(f"{i['codigo']} linha {i['linha'] or '-'}: {i['motivo']}")
    print(f"decisão: {r['decisao']}" + (f" ({', '.join(r['falhas'])})" if r["falhas"] else ""))
    return {"aprovar": 0, "devolver": 2, "bloquear": 3}[r["decisao"]]


if __name__ == "__main__":
    sys.exit(main())
