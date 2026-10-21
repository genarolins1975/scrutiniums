"""Monta os pacotes dos avaliadores independentes (produto e técnico do setor elétrico) por unidade de avaliação.

Entradas (todas geradas no HEAD que será avaliado):
  --capturas   pasta da coleta limpa (saída de energia-avaliacao.mjs --limpas 1 --capturas 1), com a subpasta capturas/
  --textos     pasta das transcrições (saída de energia-texto-visivel.mjs): <página>__entender.txt e <página>__auditar.txt
  --visoes     JSON do rastreamento das visões (saída de energia-visoes.mjs)
  --objetivo   (opcional) pasta da coleta objetiva (saída de energia-avaliacao.mjs sem --limpas), com relatorio.json
  --destino    pasta onde nasce o pacote
  --repositorio  (opcional) caminho do repositório no SHA avaliado, para os avaliadores lerem código, gold e documentos

Saída: <destino>/<unidade>/<página>/ com texto_entender.txt, texto_auditar.txt, as capturas (primeira dobra e até N trechos da
página inteira em 1440 e 390 px), visoes.json, objetivo.json e publico_tarefa.json; e <destino>/unidade_<NN>.json com a lista de
páginas da unidade, os papéis (produto e técnico), os critérios de cada papel e os caminhos de saída. Cada unidade tem páginas de
uma mesma família, para o avaliador aplicar as verificações da família (RUBRICA.md, seção 6).

Uso:
  python3 scripts/energia_pacote_avaliadores.py --capturas <rd> --textos <tx> --visoes <visoes.json> --destino <pacote> [--objetivo <obj>]
      [--repositorio <caminho>] [--max-1440 4] [--max-390 4]
Requer Pillow.
"""
import argparse
import json
import os
import re
import shutil

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AV = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao")
RD = os.path.join(RAIZ, "docs", "energia", "redesign")
P = "/setor-eletrico"

# unidade: (identificador, nome, função que diz se a rota pertence)
EMPRESAS_MODULO = {f"{P}/empresas", f"{P}/empresas/ativos", f"{P}/empresas/controle", f"{P}/empresas/distribuidoras", f"{P}/empresas/financas"}
DADOS_MODULO = {f"{P}/dados", f"{P}/dados/reproducao", f"{P}/dados/saude", f"{P}/metodologia"}


def sob(r, base):
    return r == base or r.startswith(base + "/")


UNIDADES = [
    ("U01", "Inicial, Visão geral e Território", lambda r: r in (P, f"{P}/visao-geral", f"{P}/territorio")),
    ("U02", "Aprenda: índice, trilhas e verbetes", lambda r: sob(r, f"{P}/aprenda")),
    ("U03", "Água e clima", lambda r: sob(r, f"{P}/agua-e-clima")),
    ("U04", "Geração", lambda r: sob(r, f"{P}/geracao")),
    ("U05", "Carga e Rede", lambda r: sob(r, f"{P}/carga") or sob(r, f"{P}/rede")),
    ("U06", "PLD", lambda r: sob(r, f"{P}/pld") and not sob(r, f"{P}/pld/modelos") and r != f"{P}/pld/previsoes"),
    ("U07", "Modelos e previsões do PLD", lambda r: sob(r, f"{P}/pld/modelos") or r == f"{P}/pld/previsoes"),
    ("U08", "Mercado e Regulação", lambda r: sob(r, f"{P}/mercado") or sob(r, f"{P}/regulacao")),
    ("U09", "Conta de luz e Qualidade", lambda r: sob(r, f"{P}/conta-de-luz") or sob(r, f"{P}/qualidade")),
    ("U10", "Perdas de energia", lambda r: sob(r, f"{P}/perdas")),
    ("U11", "Inclusão energética", lambda r: sob(r, f"{P}/inclusao-energetica")),
    ("U12", "Transição e Expansão", lambda r: sob(r, f"{P}/transicao") or sob(r, f"{P}/expansao")),
    ("U13", "Empresas: páginas do módulo", lambda r: r in EMPRESAS_MODULO),
    ("U14", "Empresas: fichas de entidade", lambda r: sob(r, f"{P}/empresas") and r not in EMPRESAS_MODULO),
    ("U15", "Dados e Metodologia", lambda r: r in DADOS_MODULO),
    ("U16", "Dados: fichas de conjunto", lambda r: sob(r, f"{P}/dados") and r not in DADOS_MODULO),
]

CRITERIOS = {
    "produto": ["A", "B", "C", "D", "I", "J", "K"],
    "tecnico": ["E", "F", "G", "H", "L"],
}


def slug(rota):
    return re.sub(r"[^a-z0-9]+", "_", re.sub(r"^/setor-eletrico/?", "", rota, flags=re.I)).strip("_") or "raiz"


def escolhe(n, maximo):
    if n <= maximo:
        return list(range(n))
    return sorted(set(round(i * (n - 1) / (maximo - 1)) for i in range(maximo)))


def publico_tarefa(rota, familias):
    melhor = None
    for pref in familias:
        if rota == pref or rota.startswith(pref + "/"):
            if melhor is None or len(pref) > len(melhor):
                melhor = pref
    return {"familia": melhor, **familias[melhor]} if melhor else None


def visoes_da_rota(reg):
    """Visões da rota em forma compacta: controles e arquivos viram atributos do painel que os contém."""
    visoes = reg["visoes"]
    por_painel = {}
    for v in visoes:
        if v["tipo"] in ("controle", "arquivo"):
            por_painel.setdefault(v.get("painel"), {"filtros": [], "arquivos": []})
            if v["tipo"] == "controle":
                if (v.get("titulo") or "").lower().startswith("nível de profundidade"):
                    continue
                por_painel[v.get("painel")]["filtros"].append({"rotulo": v.get("titulo"), "opcoes": v.get("opcoes") or v.get("campo")})
            else:
                por_painel[v.get("painel")]["arquivos"].append({"rotulo": v.get("titulo"), "href": v.get("href")})
    saida = []
    for v in visoes:
        if v["tipo"] in ("controle", "arquivo"):
            continue
        item = {k: v[k] for k in ("tipo", "titulo", "painel", "niveis", "forma", "orientacao", "referencias", "colunas", "linhas", "exportacao", "id", "subtitulo", "fonte", "download", "n") if k in v and v[k] not in (None, "", [])}
        if v["tipo"] == "painel":
            extra = por_painel.get(v.get("id"), {})
            if extra.get("filtros"):
                item["filtros_do_painel"] = extra["filtros"]
            if extra.get("arquivos"):
                item["arquivos_do_painel"] = extra["arquivos"]
        saida.append(item)
    semPainel = por_painel.get(None)
    if semPainel and (semPainel["filtros"] or semPainel["arquivos"]):
        saida.append({"tipo": "recursos_fora_de_painel", "filtros": semPainel["filtros"], "arquivos": semPainel["arquivos"]})
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--capturas", required=True)
    ap.add_argument("--textos", required=True)
    ap.add_argument("--visoes", required=True)
    ap.add_argument("--objetivo")
    ap.add_argument("--destino", required=True)
    ap.add_argument("--repositorio", default=RAIZ)
    ap.add_argument("--servidor", default="http://localhost:3100", help="servidor que serve o commit avaliado (cada onda de coleta tem o seu)")
    ap.add_argument("--max-1440", type=int, default=4)
    ap.add_argument("--max-390", type=int, default=4)
    a = ap.parse_args()

    rotas = [l.strip() for l in open(os.path.join(AV, "rotas.txt"), encoding="utf-8") if l.strip()]
    familias = json.load(open(os.path.join(RD, "publico_tarefa.json"), encoding="utf-8"))["familias"]
    visoes = {r["rota"]: r for r in json.load(open(a.visoes, encoding="utf-8"))["rotas"]}
    obj = {}
    if a.objetivo and os.path.exists(os.path.join(a.objetivo, "relatorio.json")):
        for r in json.load(open(os.path.join(a.objetivo, "relatorio.json"), encoding="utf-8"))["rotas"]:
            obj[r["rota"]] = r

    atribuidas = {}
    for uid, nome, pert in UNIDADES:
        for r in rotas:
            if pert(r):
                assert r not in atribuidas, f"{r} em duas unidades"
                atribuidas[r] = uid
    faltam = [r for r in rotas if r not in atribuidas]
    assert not faltam, f"rotas sem unidade: {faltam}"

    os.makedirs(a.destino, exist_ok=True)
    resumo = []
    for uid, nome, pert in UNIDADES:
        paginas = []
        for rota in [r for r in rotas if atribuidas[r] == uid]:
            sl = slug(rota)
            pasta = os.path.join(a.destino, uid, sl)
            os.makedirs(pasta, exist_ok=True)
            arquivos = []
            for modo in ("entender", "auditar"):
                t = os.path.join(a.textos, f"{sl}__{modo}.txt")
                if os.path.exists(t):
                    shutil.copy(t, os.path.join(pasta, f"texto_{modo}.txt"))
                    arquivos.append(os.path.join(pasta, f"texto_{modo}.txt"))
            for w, escala, altura, maxt in ((1440, 0.5, 1500, a.max_1440), (390, 1.0, 1500, a.max_390)):
                d = os.path.join(a.capturas, "capturas", f"{sl}__{w}_dobra.png")
                if os.path.exists(d):
                    im = Image.open(d).convert("RGB")
                    if escala != 1.0:
                        im = im.resize((int(im.width * escala), int(im.height * escala)))
                    dest = os.path.join(pasta, f"{w}_dobra.png")
                    im.save(dest)
                    arquivos.append(dest)
                i = os.path.join(a.capturas, "capturas", f"{sl}__{w}_inteira.png")
                if os.path.exists(i):
                    im = Image.open(i).convert("RGB")
                    if escala != 1.0:
                        im = im.resize((int(im.width * escala), int(im.height * escala)))
                    n = (im.height + altura - 1) // altura
                    for k in escolhe(n, maxt):
                        c = im.crop((0, k * altura, im.width, min(im.height, (k + 1) * altura)))
                        dest = os.path.join(pasta, f"{w}_inteira_{k + 1:02d}de{n:02d}.png")
                        c.save(dest)
                        arquivos.append(dest)
            reg = visoes.get(rota)
            if reg:
                json.dump({"rota": rota, "altura_pagina_px": {m: reg["modos"].get(m, {}).get("altura") for m in ("entender", "analisar", "auditar")}, "visoes": visoes_da_rota(reg)},
                          open(os.path.join(pasta, "visoes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                arquivos.append(os.path.join(pasta, "visoes.json"))
            if rota in obj:
                json.dump(obj[rota], open(os.path.join(pasta, "objetivo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                arquivos.append(os.path.join(pasta, "objetivo.json"))
            pt = publico_tarefa(rota, familias)
            json.dump(pt, open(os.path.join(pasta, "publico_tarefa.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            arquivos.append(os.path.join(pasta, "publico_tarefa.json"))
            paginas.append({"rota": rota, "pasta": pasta, "arquivos": arquivos, "publico_tarefa": pt})
        un = {
            "unidade": uid,
            "nome": nome,
            "repositorio_no_sha_avaliado": a.repositorio,
            "servidor_do_sha_avaliado": a.servidor,
            "rubrica": os.path.join(RD, "RUBRICA.md"),
            "criterios_por_papel": CRITERIOS,
            "saidas": {
                "produto": os.path.join(a.destino, "saida", f"{uid}_produto.json"),
                "tecnico": os.path.join(a.destino, "saida", f"{uid}_tecnico.json"),
            },
            "paginas": paginas,
        }
        json.dump(un, open(os.path.join(a.destino, f"unidade_{uid[1:]}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        resumo.append((uid, nome, len(paginas)))
    os.makedirs(os.path.join(a.destino, "saida"), exist_ok=True)
    print(sum(n for _, _, n in resumo), "páginas em", len(resumo), "unidades")
    for uid, nome, n in resumo:
        print(f"  {uid} {n:2d}  {nome}")


if __name__ == "__main__":
    main()
