"""Auditor das notas aprovadas (constituição v2, art. 10.3). Código, sem modelo de linguagem.

Sem revisão humana, é o auditor que procura erro depois da aprovação. Para cada ciclo com
decisão "aprovada", confere:

    integridade    hash dos fatos, hash da fonte da nota e texto final igual à renderização
                   da fonte com o pacote (o texto publicado não foi editado à mão)
    gold de origem cada fato reproduz na gold que gerou a nota (diretório do ciclo
                   retrospectivo ou commit registrado no manifesto)
    validador      a fonte da nota passa na versão ATUAL do validador (regressão de regra)
    revisões       quantos fatos a fonte revisou desde então (informação, não erro)
    fonte          opcional (--fonte): cada série na API do SGS no dia (informação)

Erro factual é qualquer falha nos três primeiros itens. Com --registrar, cada erro vira
errata datada no ciclo (errata.md, texto original preservado) e entrada no registro
público de erros; o tipo de nota é rebaixado ao degrau 1 pela regra do registro.

Uso: python3 -m pesquisa.auditor notas/ [--registrar] [--fonte]
Código de saída 3 se houver erro factual.
"""
import argparse
import datetime as dt
import glob
import json
import os
import subprocess
import sys
import tempfile

from pesquisa import fatos_conjuntura as fc
from pesquisa import nota as nt
from pesquisa import registro
from pesquisa import validador as vd

VERSAO = "auditor_v1"


def _json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _texto(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _gold_de_origem(ciclo, manifesto):
    """Diretório com a gold que gerou a nota: a do ciclo (retrospectivo) ou a do commit."""
    estado = _json(os.path.join(ciclo, "estado.json")) if os.path.exists(os.path.join(ciclo, "estado.json")) else {}
    local = os.path.join(fc.RAIZ, estado.get("gold_dir", "")) if estado.get("gold_dir") else None
    if local and os.path.exists(os.path.join(local, fc.ARQUIVO)) and os.path.realpath(local) != os.path.realpath(fc.GOLD_PUBLICADA):
        return local, None
    commit = (manifesto or {}).get("gold_commit")
    if not commit:
        return None, "sem gold local nem commit registrado no manifesto"
    tmp = tempfile.mkdtemp(prefix="gold_origem_")
    for nome in (fc.ARQUIVO, "meta.json"):
        r = subprocess.run(["git", "show", f"{commit}:public/obs/data/gold/{nome}"], cwd=fc.RAIZ,
                           capture_output=True, timeout=60)
        if r.returncode != 0:
            return None, f"commit {commit[:10]} não acessível: {r.stderr.decode()[:120]}"
        with open(os.path.join(tmp, nome), "wb") as f:
            f.write(r.stdout)
    return tmp, None


def auditar_ciclo(ciclo, fonte=False, busca=None):
    decisao_path = os.path.join(ciclo, "decisao.json")
    if not os.path.exists(decisao_path):
        return None
    decisao = _json(decisao_path)
    if decisao.get("decisao") != "aprovada":
        return {"ciclo": ciclo, "auditavel": False, "motivo": "nota não aprovada: nada foi publicado"}
    pacote = _json(os.path.join(ciclo, "pacote.json"))
    fonte_nota = _texto(os.path.join(ciclo, "nota.md"))
    final = _texto(os.path.join(ciclo, "nota_final.md"))
    manifesto = _json(os.path.join(ciclo, "manifesto.json")) if os.path.exists(os.path.join(ciclo, "manifesto.json")) else None
    erros, achados = [], []

    if fc.sha256_fatos(pacote["fatos"]) != pacote["sha256_fatos"]:
        erros.append({"verificacao": "integridade", "problema": "pacote alterado depois de gerado"})
    if manifesto and manifesto.get("nota_sha256") != nt.sha256_texto(fonte_nota):
        erros.append({"verificacao": "integridade", "problema": "fonte da nota alterada depois da aprovação"})
    if final != nt.renderizar(fonte_nota, pacote):
        erros.append({"verificacao": "integridade", "problema": "texto final difere da renderização da fonte com o pacote"})

    gold, motivo = _gold_de_origem(ciclo, manifesto)
    if gold:
        for d in fc.verificar(pacote, gold):
            erros.append({"verificacao": "gold de origem", "fato": d["fato"], "problema": d["problema"]})
    else:
        achados.append({"verificacao": "gold de origem", "problema": f"não verificada: {motivo}"})

    v = vd.validar(fonte_nota, pacote)
    if v["decisao"] == "bloquear":
        for i in v["itens"]:
            if i["codigo"] in vd.BLOQUEIAM:
                erros.append({"verificacao": f"validador atual ({vd.VERSAO})", "problema": f"{i['codigo']}: {i['motivo']}"})
    elif v["decisao"] == "devolver":
        achados += [{"verificacao": f"validador atual ({vd.VERSAO})", "problema": f"{i['codigo']}: {i['motivo']}"} for i in v["itens"]]

    revisados = len(fc.verificar(pacote, fc.GOLD_PUBLICADA)) if os.path.exists(os.path.join(fc.GOLD_PUBLICADA, fc.ARQUIVO)) else None
    res = {"ciclo": os.path.relpath(ciclo, fc.RAIZ), "auditavel": True, "versao_auditor": VERSAO,
           "auditado_em": dt.date.today().isoformat(), "erros_factuais": erros, "achados": achados,
           "fatos_revisados_pela_fonte": revisados,
           "nota": "revisão da fonte depois da nota não é erro (constituição, art. 1.4)"}
    if fonte:
        from pesquisa import verificador_fonte as vf
        kw = {"buscar": busca} if busca else {}
        res["fonte_primaria"] = vf.verificar(pacote, valores_gold=vf.valores_da_gold(pacote, gold or fc.GOLD_PUBLICADA), **kw)["resumo"]
    return res


def registrar(ciclo, res, reg_path=registro.ARQUIVO):
    """Errata no ciclo e entrada no registro público, uma por erro factual ainda não registrado."""
    reg = registro.carregar(reg_path)
    ja = {(e.get("superficie"), e.get("descricao")) for e in reg["erros"]}
    hoje = dt.date.today().isoformat()
    novos = []
    for e in res["erros_factuais"]:
        desc = f"{e['verificacao']}: {e.get('fato', '')} {e['problema']}".strip()
        chave = (res["ciclo"], desc)
        if chave in ja:
            continue
        n = max([int(x["id"][1:]) for x in reg["erros"]] + [0]) + 1
        entrada = {"id": f"E{n:03d}", "superficie": res["ciclo"], "descricao": desc, "tipo": "numero",
                   "gravidade": "relevante", "publicado": True, "data_publicacao": None, "data_deteccao": hoje,
                   "canal_deteccao": "auditor", "correcao": {"data": None, "onde": "errata no ciclo"},
                   "fonte_registro": f"{res['ciclo']}/auditoria.json", "tipo_nota": "conjuntura"}
        reg["erros"].append(entrada)
        novos.append(entrada)
    if novos:
        with open(reg_path, "w", encoding="utf-8") as f:
            json.dump(reg, f, ensure_ascii=False, indent=1)
            f.write("\n")
        errata = os.path.join(ciclo, "errata.md")
        antes = _texto(errata) if os.path.exists(errata) else "# Errata\n\nO texto original da nota é preservado; as correções ficam aqui.\n"
        linhas = [f"\n## {hoje}\n"] + [f"- {x['id']}: {x['descricao']}" for x in novos]
        with open(errata, "w", encoding="utf-8") as f:
            f.write(antes + "\n".join(linhas) + "\n")
    return novos


def main(argv=None):
    ap = argparse.ArgumentParser(description="Auditor mensal das notas aprovadas.")
    ap.add_argument("base", nargs="?", default=os.path.join(fc.RAIZ, "notas"))
    ap.add_argument("--registrar", action="store_true", help="grava errata e registro de erros")
    ap.add_argument("--fonte", action="store_true", help="confere também a API do SGS (rede)")
    args = ap.parse_args(argv)
    total = 0
    for dpath in sorted(glob.glob(os.path.join(args.base, "**", "decisao.json"), recursive=True)):
        ciclo = os.path.dirname(dpath)
        if os.path.basename(ciclo).startswith("teste_"):
            continue
        res = auditar_ciclo(ciclo, fonte=args.fonte)
        if not res or not res["auditavel"]:
            print(f"{os.path.relpath(ciclo, fc.RAIZ)}: {res and res.get('motivo')}")
            continue
        with open(os.path.join(ciclo, "auditoria.json"), "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
            f.write("\n")
        total += len(res["erros_factuais"])
        print(f"{res['ciclo']}: {len(res['erros_factuais'])} erro(s) factual(is), {len(res['achados'])} achado(s), "
              f"{res['fatos_revisados_pela_fonte']} fato(s) revisado(s) pela fonte")
        if args.registrar and res["erros_factuais"]:
            for x in registrar(ciclo, res):
                print(f"  registrado {x['id']}")
    return 3 if total else 0


if __name__ == "__main__":
    sys.exit(main())
