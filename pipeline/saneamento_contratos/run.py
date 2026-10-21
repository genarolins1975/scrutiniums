"""Execução do pipeline do capítulo 15 do Saneamento (o que está contratado desde o novo marco).

    python3 -m pipeline.saneamento_contratos.run            reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.saneamento_contratos.run --check    confere se a gold versionada é a do seed
    python3 -m pipeline.saneamento_contratos.run --vigiar   baixa de novo cada documento do seed e compara o sha256;
                                                             PDF trocado na mesma URL, URL que não responde ou aditivo
                                                             anunciado vira saída 1 (o motor abre a issue); nada muda no seed

As fontes não têm API: leilão novo, aditivo ou repactuação entra por PR, com a fonte e o novo hash.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

from . import gold

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "public" / "saneamento" / "contratos"
GOLD = PASTA / "contratado.json"
RESUMO = PASTA / "resumo.json"
CSV = PASTA / "leiloes.csv"


def _gravar(caminho: Path, texto: str) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=caminho.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    os.chmod(tmp, 0o644)
    os.replace(tmp, caminho)


def saidas(seed: dict) -> dict[Path, str]:
    g = gold.construir(seed)
    return {
        GOLD: json.dumps(g, ensure_ascii=False, separators=(",", ":")) + "\n",
        RESUMO: json.dumps(gold.resumo(g), ensure_ascii=False, separators=(",", ":")) + "\n",
        CSV: gold.csv_texto(g["leiloes"]),
    }


def vigiar(seed: dict, baixar=None) -> list[str]:
    """Documentos dos contratos transcritos: baixa de novo e compara o sha256. Devolve as pendências (vazio = tudo igual)."""
    baixar = baixar or _baixar
    pendencias = []
    for c in seed["metas"]["contratos"]:
        d = c.get("documento") or {}
        if not d.get("url"):
            continue
        try:
            corpo = baixar(d["url"])
        except Exception as e:  # noqa: BLE001 - a vigília relata, não corrige
            pendencias.append(f"{c['id']}: documento não responde ({e}); URL {d['url']}")
            continue
        h = hashlib.sha256(corpo).hexdigest()
        if h != d.get("sha256"):
            pendencias.append(f"{c['id']}: documento trocado na mesma URL (sha256 {d.get('sha256')} registrado, {h} baixado); rever metas e aditivos: {d['url']}")
    return pendencias


def _baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "scrutiniums-vigilia/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:  # noqa: S310 - URLs do seed versionado
        return r.read()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--vigiar", action="store_true")
    a = ap.parse_args(argv)
    seed = gold.ler_seed()
    if a.vigiar:
        pend = vigiar(seed)
        for p in pend:
            print(f"::warning::{p}" if os.environ.get("GITHUB_ACTIONS") else p, file=sys.stderr)
        print("vigília: " + ("tudo igual ao registrado" if not pend else f"{len(pend)} pendência(s); nada foi alterado no seed"))
        return 1 if pend else 0
    try:
        out = saidas(seed)
    except gold.GoldInvalida as e:
        print(str(e), file=sys.stderr)
        return 1
    if a.check:
        difere = [str(p.relative_to(RAIZ)) for p, t in out.items() if not p.exists() or p.read_bytes().decode("utf-8") != t]
        if difere:
            print("a publicação versionada não é a do seed:", ", ".join(difere), file=sys.stderr)
            return 1
        print("gold confere com o seed")
        return 0
    for p, t in out.items():
        _gravar(p, t)
    g = json.loads(out[GOLD])
    t = g["totais"]
    print(f"gold gravada: {t['leiloes_registrados']} leilões, {t['nos_totais']} nos totais, {len(g['contratos'])} contratos, {len(g['abrangencia'])} blocos com abrangência, hash {g['hash_dados'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
