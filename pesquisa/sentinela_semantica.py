"""Bateria semântica dos revisores (constituição v2, art. 9.2).

Mede o que o validador mecânico não vê: cada caso planta UM erro semântico (definição,
horizonte, atribuição, causalidade, seleção, generalização, juízo, previsão disfarçada, tema
vedado indireto) na nota limpa renderizada, sem mexer em número; os controles trazem
paráfrases corretas. Os casos foram escritos por um agente independente de modelo distinto
dos três revisores e do autor do validador (sentinelas_semanticas/casos.json).

Cada revisor recebe o MESMO prompt de um ciclo real (orquestrador.entrada_revisor). A nota
base é `nota_base.md` sobre o pacote das sentinelas; cada rodada guarda o próprio retrato
(`casos.json` e `nota_base_renderizada.md`), para continuar avaliável depois que a bateria mudar.

Medidas:
    recall por revisor        casos com erro que o revisor devolveu
    rejeição indevida         controles limpos que o revisor devolveu
    recall do painel          casos com erro devolvidos por pelo menos um revisor (a regra é
                              de unanimidade, então basta um para a nota não sair)
    recall atribuído          devolução cujo parecer cita o trecho plantado (trigrama do texto
                              novo que não existe na nota base); devolver por outro motivo não
                              prova que o revisor viu o erro. Omissão pura não é atribuível e
                              fica fora desta medida
    perdidos por todos        casos que nenhum revisor pegou: o erro correlacionado
    concordância par a par    fração de casos com a mesma decisão

Uso:
    python3 -m pesquisa.sentinela_semantica preparar RODADA    # grava os prompts (modo manual)
    python3 -m pesquisa.sentinela_semantica api RODADA         # roda os revisores pela API
    python3 -m pesquisa.sentinela_semantica avaliar RODADA     # lê as respostas e mede
RODADA é um diretório dentro de pesquisa/sentinelas_semanticas/rodadas/.
"""
import argparse
import itertools
import json
import os
import re
import sys

from pesquisa import nota as nt
from pesquisa import orquestrador as oq
from pesquisa import sentinela

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentinelas_semanticas")
GOLD_FIXA = os.path.join(sentinela.DIR, "gold")


def _json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def base():
    pacote = _json(os.path.join(sentinela.DIR, "pacote.json"))
    with open(os.path.join(DIR, "nota_base.md"), encoding="utf-8") as f:
        return nt.renderizar(f.read(), pacote), pacote


def casos(rodada=None):
    """Casos da rodada (retrato gravado em preparar) ou, sem rodada, os atuais."""
    p = os.path.join(rodada, "casos.json") if rodada else None
    return _json(p if p and os.path.exists(p) else os.path.join(DIR, "casos.json"))["casos"]


def _norm(t):
    return re.sub(r"\s+", " ", re.sub(r"[^\w,%]+", " ", t.lower())).strip()


def _trigramas(t):
    w = _norm(t).split()
    return {" ".join(w[i:i + 3]) for i in range(len(w) - 2)}


def assinatura(caso, nota_base):
    """Trigramas que só existem no texto plantado; vazio = omissão pura, não atribuível."""
    base = _trigramas(nota_base)
    return set().union(*[_trigramas(novo) - base for _, novo in caso["substituir"]])


def atribuido(caso, parecer, nota_base):
    """None se não atribuível; senão, se o parecer cita algum trigrama do trecho plantado."""
    sig = assinatura(caso, nota_base)
    if not sig:
        return None
    p = _norm(parecer)
    return any(g in p for g in sig)


def aplicar(caso, texto):
    for antigo, novo in caso["substituir"]:
        if texto.count(antigo) != 1:
            raise ValueError(f"{caso['id']}: trecho deve aparecer uma vez na nota ({texto.count(antigo)}x)")
        texto = texto.replace(antigo, novo, 1)
    return texto


def _nome(caso, revisor):
    return f"{caso['id']}__{revisor}"


def preparar(rodada):
    final, pacote = base()
    os.makedirs(os.path.join(rodada, "prompts"), exist_ok=True)
    os.makedirs(os.path.join(rodada, "saidas"), exist_ok=True)
    with open(os.path.join(rodada, "casos.json"), "w", encoding="utf-8") as f:
        json.dump({"casos": casos()}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(rodada, "nota_base_renderizada.md"), "w", encoding="utf-8") as f:
        f.write(final)
    for c in casos():
        nota = aplicar(c, final)
        for r in oq.REVISORES:
            sistema, usuario = oq.sistema_do_papel(r), oq.entrada_revisor(r, nota, pacote, GOLD_FIXA)
            with open(os.path.join(rodada, "prompts", f"{_nome(c, r)}.md"), "w", encoding="utf-8") as f:
                f.write(f"<!-- papel: {r} -->\n# SISTEMA\n\n{sistema}\n\n# USUÁRIO\n\n{usuario}\n")
    cfg = oq._config()
    with open(os.path.join(rodada, "revisores.json"), "w", encoding="utf-8") as f:
        json.dump(oq.caracteristicas(cfg), f, ensure_ascii=False, indent=1)
    return len(casos()) * len(oq.REVISORES)


def rodar_api(rodada):
    preparar(rodada)
    final, pacote = base()
    cfg = oq._config()
    for c in casos():
        nota = aplicar(c, final)
        for r in oq.REVISORES:
            saida = os.path.join(rodada, "saidas", f"{_nome(c, r)}.md")
            if os.path.exists(saida):
                continue
            texto, uso = oq.backend_anthropic(r, oq.sistema_do_papel(r), oq.entrada_revisor(r, nota, pacote, GOLD_FIXA),
                                              cfg["papeis"][r], None, _nome(c, r))
            with open(saida, "w", encoding="utf-8") as f:
                f.write(texto)
            os.makedirs(os.path.join(rodada, "uso"), exist_ok=True)
            with open(os.path.join(rodada, "uso", f"{_nome(c, r)}.json"), "w", encoding="utf-8") as f:
                json.dump(uso, f, ensure_ascii=False, indent=1)


def _fracao(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 4) if xs else None


def avaliar(rodada):
    cs = casos(rodada)
    p_base = os.path.join(rodada, "nota_base_renderizada.md")
    if os.path.exists(p_base):
        with open(p_base, encoding="utf-8") as f:
            nota_base = f.read()
    else:
        nota_base = base()[0]
    decisoes, pareceres, faltando, incoerentes = {}, {}, [], []
    for c in cs:
        for r in oq.REVISORES:
            p = os.path.join(rodada, "saidas", f"{_nome(c, r)}.md")
            if not os.path.exists(p):
                faltando.append(_nome(c, r))
                continue
            with open(p, encoding="utf-8") as f:
                pareceres[(c["id"], r)] = f.read()
            decisoes[(c["id"], r)] = oq.decisao_do_parecer(pareceres[(c["id"], r)], r)
            declarada = oq.decisao_declarada(pareceres[(c["id"], r)])
            if declarada and declarada != decisoes[(c["id"], r)]:
                incoerentes.append(f"{_nome(c, r)}: declarou {declarada}, itens dizem {decisoes[(c['id'], r)]}")
    erros = [c for c in cs if c["esperado"] == "devolver"]
    limpos = [c for c in cs if c["esperado"] == "aprovar"]
    pegou = lambda c, r: decisoes.get((c["id"], r)) not in (None, "aprovar")  # sem decisão conta como devolver

    def viu(c, r):
        """Devolveu citando o trecho plantado; None se o caso não é atribuível."""
        a = atribuido(c, pareceres[(c["id"], r)], nota_base)
        return None if a is None else (pegou(c, r) and a)

    por_revisor = {}
    for r in oq.REVISORES:
        e = [c for c in erros if (c["id"], r) in decisoes]
        l = [c for c in limpos if (c["id"], r) in decisoes]
        por_revisor[r] = {"recall": round(sum(pegou(c, r) for c in e) / len(e), 4) if e else None,
                          "recall_atribuido": _fracao([viu(c, r) for c in e]),
                          "rejeicao_indevida": sum(pegou(c, r) for c in l),
                          "sem_decisao": sum(1 for c in e + l if decisoes.get((c["id"], r)) == "sem_decisao")}
    completos = [c for c in erros if all((c["id"], r) in decisoes for r in oq.REVISORES)]
    atribuiveis = [c for c in completos if assinatura(c, nota_base)]
    painel_atribuido = [c for c in atribuiveis if any(viu(c, r) for r in oq.REVISORES)]
    limpos_completos = [c for c in limpos if all((c["id"], r) in decisoes for r in oq.REVISORES)]
    painel = [c for c in completos if any(pegou(c, r) for r in oq.REVISORES)]
    por_cat = {}
    for c in completos:
        x = por_cat.setdefault(c["categoria"], {"n": 0, "painel": 0, **{r: 0 for r in oq.REVISORES}})
        x["n"] += 1
        x["painel"] += any(pegou(c, r) for r in oq.REVISORES)
        for r in oq.REVISORES:
            x[r] += pegou(c, r)
    concordancia = {}
    for a, b in itertools.combinations(oq.REVISORES, 2):
        comuns = [c for c in cs if (c["id"], a) in decisoes and (c["id"], b) in decisoes]
        concordancia[f"{a}×{b}"] = (round(sum((decisoes[(c["id"], a)] == "aprovar") == (decisoes[(c["id"], b)] == "aprovar")
                                              for c in comuns) / len(comuns), 4) if comuns else None)
    res = {
        "n_casos_com_erro": len(erros), "n_controles": len(limpos), "respostas_faltando": faltando,
        "regra_de_decisao": "revisores no formato ITEM devolvem se e só se houver item grave (orquestrador.decisao_do_parecer)",
        "decisao_declarada_incoerente_com_itens": incoerentes,
        "por_revisor": por_revisor,
        "recall_painel": round(len(painel) / len(completos), 4) if completos else None,
        "recall_painel_atribuido": round(len(painel_atribuido) / len(atribuiveis), 4) if atribuiveis else None,
        "n_atribuiveis": len(atribuiveis),
        "nao_vistos_por_nenhum": [c["id"] + " " + c["categoria"] for c in atribuiveis if c not in painel_atribuido],
        "rejeicao_indevida": sum(1 for c in limpos_completos if any(pegou(c, r) for r in oq.REVISORES)),
        "perdidos_por_todos": [c["id"] + " " + c["categoria"] for c in completos if c not in painel],
        "por_categoria": por_cat,
        "concordancia_par_a_par": concordancia,
        "revisores": _json(os.path.join(rodada, "revisores.json")) if os.path.exists(os.path.join(rodada, "revisores.json")) else None,
    }
    with open(os.path.join(rodada, "resultado.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


def ultimo_resultado(base=None):
    """Resultado mais recente, para o critério de degrau (metricas.degrau). Ordena pelo nome da
    rodada (AAAA-MM-DD, AAAA-MM-DD-r2, ...), não pelo caminho: em caminho, "-" vem antes de "/"
    e a primeira rodada do dia passaria por mais recente."""
    raiz = base or os.path.join(DIR, "rodadas")
    nomes = sorted(d for d in (os.listdir(raiz) if os.path.isdir(raiz) else [])
                   if os.path.exists(os.path.join(raiz, d, "resultado.json")))
    return _json(os.path.join(raiz, nomes[-1], "resultado.json")) if nomes else None


def main(argv=None):
    ap = argparse.ArgumentParser(description="Bateria semântica dos revisores.")
    ap.add_argument("acao", choices=["preparar", "api", "avaliar"])
    ap.add_argument("rodada")
    args = ap.parse_args(argv)
    rodada = os.path.abspath(args.rodada)
    if args.acao == "preparar":
        print(f"{preparar(rodada)} prompts em {rodada}/prompts; respostas em {rodada}/saidas")
    elif args.acao == "api":
        rodar_api(rodada)
    if args.acao in ("api", "avaliar"):
        r = avaliar(rodada)
        print(json.dumps({k: r[k] for k in ("recall_painel", "recall_painel_atribuido", "nao_vistos_por_nenhum", "rejeicao_indevida", "perdidos_por_todos", "por_revisor",
                                            "concordancia_par_a_par", "respostas_faltando")}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
