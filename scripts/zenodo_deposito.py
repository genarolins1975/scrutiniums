"""Depósito mensal das séries do crédito em repositório com DOI (Zenodo), SEM publicar.

Uso:
    python3 scripts/zenodo_deposito.py                 # prepara o pacote do mês da última publicação
    python3 scripts/zenodo_deposito.py --mes 2026-09   # mês explícito
    python3 scripts/zenodo_deposito.py --rascunho      # também cria um RASCUNHO no Zenodo

O pacote vai para dist/zenodo/AAAA-MM/: séries em CSV (as republicadas das
fontes oficiais e o IBCC calculado), o meta.json da publicação, LEIAME.md, zenodo.json (metadados no
formato da API de depósito) e SHA256SUMS.

--rascunho cria a deposição, envia os arquivos e grava os metadados, e PARA:
nenhuma chamada de publicação existe neste script. A publicação, que cunha o DOI,
é feita à mão no Zenodo por quem responde pelo depósito. Exige ZENODO_TOKEN; o
destino padrão é o sandbox (ZENODO_URL=https://sandbox.zenodo.org); para o
Zenodo de produção, ZENODO_URL=https://zenodo.org.

Campos de decisão do mantenedor (config/institucional.json → zenodo, dados):
criadores, licença dos dados derivados e comunidade. Sem criadores e licença o
pacote é preparado com a pendência registrada, mas o rascunho é recusado.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GOLD = RAIZ / "public" / "obs" / "data" / "gold"
CONFIG = RAIZ / "config" / "institucional.json"
SAIDA = RAIZ / "dist" / "zenodo"


def _json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def csv_series(pulse):
    """Uma linha por observação de cada série do pulso, com fonte e código."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["chave", "nome", "fonte", "codigo_serie", "unidade", "referencia", "valor", "natureza"])
    for chave in sorted(pulse["series"]):
        s = pulse["series"][chave]
        m = s.get("meta") or {}
        for o in s.get("obs") or []:
            # ausência é campo vazio, nunca zero
            w.writerow([chave, m.get("name", ""), m.get("source", ""), m.get("series_code", ""), m.get("unit", ""),
                        o["ref"][:7], "" if o.get("v") is None else o["v"], "dado observado"])
    return buf.getvalue()


def csv_ibcc(ibcc):
    comps = list(ibcc.get("componentes") or [])
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["referencia", "ibcc"] + [f"contribuicao_{c}" for c in comps] + ["natureza"])
    for p in ibcc.get("serie") or []:
        c = p.get("contribuicoes") or {}
        w.writerow([p["ref"][:7], p["valor"]] + ["" if c.get(k) is None else c[k] for k in comps] + ["dado calculado"])
    return buf.getvalue()


def fontes_do_pulso(pulse):
    return sorted({(s.get("meta") or {}).get("source", "") for s in pulse["series"].values()} - {""})


def metadados(mes, meta, inst, fontes):
    z = inst.get("zenodo") or {}
    criadores = [
        {k: v for k, v in (("name", c.get("nome")), ("affiliation", c.get("afiliacao")), ("orcid", c.get("orcid"))) if v}
        for c in z.get("criadores") or [] if c.get("nome")
    ]
    licenca = (inst.get("dados") or {}).get("licenca_derivados") or ""
    pendencias = []
    if not criadores:
        pendencias.append("criadores (config/institucional.json → zenodo.criadores)")
    if not licenca:
        pendencias.append("licença dos dados derivados (config/institucional.json → dados.licenca_derivados)")
    md = {
        "upload_type": "dataset",
        "title": f"Observatório Brasileiro de Crédito: séries mensais do crédito no Brasil ({mes})",
        "description": (
            f"<p>Séries mensais do crédito no Brasil republicadas das fontes oficiais ({', '.join(fontes)}), com fonte e "
            "código de cada série, e o Índice Brasileiro de Condições de Crédito (IBCC), calculado pela Scrutiniums com metodologia aberta. "
            f"Publicação processada em {meta.get('gerado_em', '')[:16]} UTC. Ausência é campo vazio, nunca zero.</p>"
            "<p>Documentação da API pública de leitura: https://scrutiniums.com/dados/api</p>"
        ),
        "creators": criadores,
        "keywords": ["crédito", "Brasil", "inadimplência", "juros", "spread", "condições de crédito", *fontes],
        "language": "por",
        "version": mes,
        "publication_date": meta.get("gerado_em", "")[:10],
        "related_identifiers": [
            {"identifier": "https://scrutiniums.com/dados/api", "relation": "isDocumentedBy", "resource_type": "other"},
            {"identifier": "https://scrutiniums.com/dados", "relation": "isSupplementTo", "resource_type": "other"},
        ],
    }
    if licenca:
        md["license"] = licenca
    if z.get("comunidade"):
        md["communities"] = [{"identifier": z["comunidade"]}]
    if z.get("doi_conceito"):
        md["related_identifiers"].append({"identifier": z["doi_conceito"], "relation": "isVersionOf", "scheme": "doi"})
    return {"metadata": md}, pendencias


def preparar(mes=None, saida=SAIDA):
    meta = _json(GOLD / "meta.json")
    mes = mes or meta["gerado_em"][:7]
    inst = _json(CONFIG)
    destino = Path(saida) / mes
    destino.mkdir(parents=True, exist_ok=True)
    pulse = _json(GOLD / "pulse.json")
    fontes = fontes_do_pulso(pulse)
    arquivos = {
        "series_mensais.csv": csv_series(pulse),
        "ibcc.csv": csv_ibcc(_json(GOLD / "ibcc.json")),
        "meta.json": json.dumps(meta, ensure_ascii=False, indent=1) + "\n",
    }
    zmd, pendencias = metadados(mes, meta, inst, fontes)
    arquivos["zenodo.json"] = json.dumps(zmd, ensure_ascii=False, indent=1) + "\n"
    arquivos["LEIAME.md"] = "\n".join([
        f"# Observatório Brasileiro de Crédito: séries mensais ({mes})",
        "",
        f"Publicação processada em {meta['gerado_em'][:16]} UTC.",
        "",
        "- `series_mensais.csv`: séries republicadas das fontes oficiais (" + ", ".join(fontes) + "), uma linha por observação, com fonte, código, unidade e referência (AAAA-MM).",
        "- `ibcc.csv`: Índice Brasileiro de Condições de Crédito e as contribuições de cada componente (dado calculado).",
        "- `meta.json`: data de processamento e data-base de cada fonte da publicação.",
        "",
        "Ausência é campo vazio, nunca zero. Método: https://scrutiniums.com/dados/ibcc e https://scrutiniums.com/observatorio/methodology",
        "",
        *(["## Pendências antes do depósito", "", *[f"- {p}" for p in pendencias], ""] if pendencias else []),
    ])
    for nome, conteudo in arquivos.items():
        (destino / nome).write_text(conteudo, encoding="utf-8")
    somas = [f"{hashlib.sha256((destino / n).read_bytes()).hexdigest()}  {n}" for n in sorted(arquivos)]
    (destino / "SHA256SUMS").write_text("\n".join(somas) + "\n", encoding="utf-8")
    return destino, pendencias


def _req(metodo, url, token, corpo=None, tipo="application/json"):
    dados = corpo if isinstance(corpo, (bytes, type(None))) else json.dumps(corpo).encode()
    r = urllib.request.Request(url, data=dados, method=metodo,
                               headers={"Authorization": f"Bearer {token}", "Content-Type": tipo})
    with urllib.request.urlopen(r, timeout=120) as resp:
        txt = resp.read()
    return json.loads(txt) if txt else {}


def criar_rascunho(destino, pendencias):
    """Cria a deposição e envia arquivos e metadados. NÃO publica."""
    if pendencias:
        raise SystemExit("rascunho recusado: preencher antes " + "; ".join(pendencias))
    token = os.environ.get("ZENODO_TOKEN")
    if not token:
        raise SystemExit("rascunho recusado: ZENODO_TOKEN ausente")
    # variável vazia (repositório sem ZENODO_URL) vale como ausente: o padrão é o sandbox
    base = (os.environ.get("ZENODO_URL") or "https://sandbox.zenodo.org").rstrip("/")
    dep = _req("POST", f"{base}/api/deposit/depositions", token, {})
    bucket = dep["links"]["bucket"]
    for nome in sorted(p.name for p in destino.iterdir() if p.name != "zenodo.json"):
        _req("PUT", f"{bucket}/{nome}", token, (destino / nome).read_bytes(), "application/octet-stream")
    _req("PUT", f"{base}/api/deposit/depositions/{dep['id']}", token, _json(destino / "zenodo.json"))
    return dep["links"].get("html", f"{base}/deposit/{dep['id']}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--mes")
    ap.add_argument("--saida", default=str(SAIDA))
    ap.add_argument("--rascunho", action="store_true")
    a = ap.parse_args(argv)
    destino, pendencias = preparar(a.mes, a.saida)
    print(f"pacote preparado em {destino}")
    for p in pendencias:
        print(f"pendência: {p}")
    if a.rascunho:
        print(f"rascunho criado (não publicado): {criar_rascunho(destino, pendencias)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
