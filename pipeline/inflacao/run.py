"""Execução do pipeline do IPCA por área (Observatório das Famílias, coleção Custo de vida).

    python3 -m pipeline.inflacao.run                    reconstrói a gold e os arquivos a partir do seed (sem rede)
    python3 -m pipeline.inflacao.run --check            confere se a gold e os arquivos versionados são os do seed
    python3 -m pipeline.inflacao.run --coleta           recoleta o SIDRA, grava o seed e reconstrói
    python3 -m pipeline.inflacao.run --coleta --so-coleta   só recoleta e grava o seed (usado pelo motor por grupo)

A coleta valida o que trouxe antes de gravar o seed: resposta incompleta não substitui o seed anterior. A
construção da gold valida de novo (pesos, meses, faixas, encadeamento e contribuições) e não grava nada se
reprovar; nesse caso a saída é 1 e a publicação anterior continua no ar.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from . import coleta, gold
from .validacoes import validar_seed

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / "pipeline" / "inflacao" / "seed"
SEED_ARQ = SEED / "ipca_7060.json"
MANIFESTO = SEED / "manifesto.json"
GOLD = RAIZ / "public" / "inflacao" / "gold" / "ipca.json"
SERIES = RAIZ / "public" / "inflacao" / "series"
CSV_GRUPOS = SERIES / "ipca-geral-e-grupos-mensal.csv"
CSV_SUBITENS = SERIES / "ipca-subitens-12-meses.csv"


def _gravar(caminho: Path, texto: str) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=caminho.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    os.chmod(tmp, 0o644)
    os.replace(tmp, caminho)


def _json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def ler_seed() -> dict:
    return json.loads(SEED_ARQ.read_text(encoding="utf-8"))


def saidas(seed: dict, publicada: dict | None) -> dict[Path, str]:
    g = gold.construir(seed, publicada)
    return {GOLD: _json(g), CSV_GRUPOS: gold.csv_grupos(seed), CSV_SUBITENS: gold.csv_subitens(g)}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta", action="store_true")
    ap.add_argument("--so-coleta", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)

    if a.coleta:
        seed, manifesto = coleta.coletar()
        problemas = validar_seed(seed)
        if problemas:
            print("coleta reprovada; o seed anterior foi mantido:", file=sys.stderr)
            for p in problemas[:40]:
                print(" -", p, file=sys.stderr)
            return 1
        _gravar(SEED_ARQ, _json(seed))
        _gravar(MANIFESTO, json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n")
        print(f"seed gravado: {seed['meses'][0]} a {seed['meses'][-1]}, {len(manifesto['originais'])} respostas originais")
        if a.so_coleta:
            return 0

    seed = ler_seed()
    publicada = json.loads(GOLD.read_text(encoding="utf-8")) if GOLD.exists() else None
    try:
        out = saidas(seed, None if a.check else publicada)
    except gold.GoldInvalida as e:
        print(str(e), file=sys.stderr)
        return 1
    if a.check:
        difere = [str(p.relative_to(RAIZ)) for p, t in out.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        if difere:
            print("a publicação versionada não é a do seed:", ", ".join(difere), file=sys.stderr)
            return 1
        print("gold e arquivos conferem com o seed")
        return 0
    for p, t in out.items():
        _gravar(p, t)
    g = json.loads(out[GOLD])
    print(f"gold gravada: {g['primeiro_mes']} a {g['ultimo_mes']}, {len(g['areas'])} áreas, hash {g['hash_dados'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
