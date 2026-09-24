"""Verificador de fonte: confere cada valor do pacote na fonte primária no dia (piloto, PR 4).

Para cada série do pacote, busca na API do SGS do BCB os pontos usados pelos fatos
(origens e insumos no campo obs) e compara com o valor do pacote. Três estados por série:

    conferido       todos os pontos iguais na fonte
    divergente      algum ponto difere: revisão da fonte depois da gold, ou defeito
    nao_verificado  a fonte não respondeu; NUNCA vira conferido por omissão

Campos calculados pelo pipeline (yoy, yoy_real) não existem no SGS e ficam fora; são
conferidos pela verificação contra a gold (fatos_conjuntura --verificar).

Uso: python3 -m pesquisa.verificador_fonte pacote.json [--saida verificacao_fonte.json]
"""
import argparse
import json
import sys
import time
import urllib.request

URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial={ini}&dataFinal={fim}"


def _ref_br(ref):
    return f"01/{ref[5:7]}/{ref[:4]}"


def buscar_sgs(codigo, ini, fim, timeout=40, tentativas=3):
    """{'AAAA-MM-01': valor} da API do SGS entre as datas (inclusive). A API devolve 502
    de forma intermitente (24/09/2026): até três tentativas, com espera crescente."""
    url = URL_SGS.format(codigo=codigo, ini=_ref_br(ini), fim=_ref_br(fim))
    for n in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                dados = json.load(r)
            break
        except Exception:
            if n == tentativas - 1:
                raise
            time.sleep(2 * (n + 1))
    out = {}
    for x in dados:
        d, m, a = x["data"].split("/")
        out[f"{a}-{m}-{d}"] = float(x["valor"])
    return out


def pontos_por_serie(pacote):
    """{serie: {"codigo": str, "refs": {ref: valor_na_gold}}} para os pontos observados."""
    out = {}
    for f in pacote.get("fatos", []):
        pts = [f["origem"]] if f.get("origem") else []
        pts += f.get("insumos") or []
        codigo = f["fonte"].split()[-1] if f.get("fonte", "").startswith("BCB/SGS") else None
        for o in pts:
            if o.get("campo") != "obs" or not codigo:
                continue
            s = out.setdefault(o["serie"], {"codigo": codigo, "refs": {}})
            if f["tipo"] == "observado":
                s["refs"][o["ref"]] = f["valor"]
            else:
                s["refs"].setdefault(o["ref"], None)
    return out


def verificar(pacote, buscar=buscar_sgs, valores_gold=None):
    """`valores_gold`: {serie: {ref: valor}} para os insumos (a gold tem todos); sem ele,
    só os pontos com valor no próprio pacote são comparados."""
    res = {}
    for serie, s in sorted(pontos_por_serie(pacote).items()):
        refs = sorted(s["refs"])
        try:
            fonte = buscar(s["codigo"], refs[0], refs[-1])
        except Exception as e:  # rede, HTTP, corpo inválido: não verificado, com motivo
            res[serie] = {"estado": "nao_verificado", "codigo": s["codigo"], "motivo": str(e)[:200]}
            continue
        difs, conferidos = [], 0
        for ref in refs:
            esperado = s["refs"][ref]
            if esperado is None and valores_gold:
                esperado = valores_gold.get(serie, {}).get(ref)
            if esperado is None:
                continue
            v = fonte.get(ref)
            if v is None:
                difs.append({"ref": ref, "pacote": esperado, "fonte": None})
            elif abs(v - esperado) > 1e-9:
                difs.append({"ref": ref, "pacote": esperado, "fonte": v})
            else:
                conferidos += 1
        res[serie] = {"estado": "divergente" if difs else ("conferido" if conferidos else "nao_verificado"),
                      "codigo": s["codigo"], "pontos_conferidos": conferidos, "divergencias": difs}
        if not difs and not conferidos:
            res[serie]["motivo"] = "nenhum ponto com valor de referência para comparar"
    estados = [r["estado"] for r in res.values()]
    return {"series": res, "resumo": {e: estados.count(e) for e in ("conferido", "divergente", "nao_verificado")}}


def valores_da_gold(pacote, gold_dir):
    from pesquisa import fatos_conjuntura as fc
    with open(f"{gold_dir}/{fc.ARQUIVO}", encoding="utf-8") as f:
        pulse = json.load(f)
    return {k: {o["ref"]: o["v"] for o in s.get("obs") or []} for k, s in pulse.get("series", {}).items()}


def main(argv=None):
    from pesquisa import fatos_conjuntura as fc
    ap = argparse.ArgumentParser(description="Confere o pacote na API do SGS (fonte primária).")
    ap.add_argument("pacote")
    ap.add_argument("--gold", default=fc.GOLD_PUBLICADA, help="gold para os valores dos insumos")
    ap.add_argument("--saida")
    args = ap.parse_args(argv)
    with open(args.pacote, encoding="utf-8") as f:
        pacote = json.load(f)
    r = verificar(pacote, valores_gold=valores_da_gold(pacote, args.gold))
    for serie, x in r["series"].items():
        extra = x.get("motivo") or (f"{len(x['divergencias'])} divergência(s)" if x.get("divergencias") else f"{x['pontos_conferidos']} pontos")
        print(f"{serie:18s} SGS {x['codigo']:>6s}  {x['estado']:14s} {extra}")
    print(json.dumps(r["resumo"], ensure_ascii=False))
    if args.saida:
        with open(args.saida, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
    return 1 if r["resumo"]["divergente"] else 0


if __name__ == "__main__":
    sys.exit(main())
