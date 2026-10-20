"""Execução do pipeline do capítulo 7.1 do Saneamento (dívida e alavancagem dos prestadores com registro na CVM).

    python3 -m pipeline.saneamento_divida.run                      reconstrói a gold a partir do seed (sem rede)
    python3 -m pipeline.saneamento_divida.run --check              confere se a gold versionada é a do seed
    python3 -m pipeline.saneamento_divida.run --coletar            recoleta cadastro, DFP e ITR da CVM e reconstrói
    python3 -m pipeline.saneamento_divida.run --coletar --so-coleta    só recoleta e grava o seed (motor por grupo)
    python3 -m pipeline.saneamento_divida.run --coletar --zips PASTA   coleta de uma cópia local dos arquivos do portal

A coleta grava o seed só se a gold construída com ele passar em todas as validações; reprovada, o seed anterior é
restaurado e a saída é 1. A construção da gold valida de novo e não grava nada se reprovar.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

from . import coleta, gold

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "public" / "saneamento" / "divida"
GOLD = PASTA / "divida.json"
RESUMO = PASTA / "resumo.json"  # contagens e datas para o convite da página aberta do Saneamento (sem série)
CSV_ANUAL = PASTA / "divida_anual.csv"
CSV_TRIMESTRAL = PASTA / "divida_trimestral.csv"


def _gravar(caminho: Path, texto: str) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=caminho.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    os.chmod(tmp, 0o644)
    os.replace(tmp, caminho)


def saidas(seed: dict) -> dict[Path, str]:
    g, linhas = gold.construir(seed)
    return {
        GOLD: json.dumps(g, ensure_ascii=False, separators=(",", ":")) + "\n",
        RESUMO: json.dumps(gold.resumo(g), ensure_ascii=False, separators=(",", ":")) + "\n",
        CSV_ANUAL: gold.csv_texto(linhas["anual"]),
        CSV_TRIMESTRAL: gold.csv_texto(linhas["trimestral"]),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coletar", action="store_true")
    ap.add_argument("--so-coleta", action="store_true")
    ap.add_argument("--zips", type=Path, default=None)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)

    if a.coletar:
        copia = Path(tempfile.mkdtemp(prefix="seed-divida-"))
        if gold.SEED.exists():
            shutil.copytree(gold.SEED, copia / "seed")
        try:
            coleta.coletar(a.zips)
            gold.construir(gold.ler_seed(), recalcular_universo=True)
        except Exception as e:  # noqa: BLE001 - qualquer falha devolve o seed anterior
            if (copia / "seed").exists():
                shutil.rmtree(gold.SEED, ignore_errors=True)
                shutil.copytree(copia / "seed", gold.SEED)
            print(f"coleta reprovada; o seed anterior foi mantido:\n{e}", file=sys.stderr)
            return 1
        finally:
            shutil.rmtree(copia, ignore_errors=True)
        if a.so_coleta:
            return 0

    try:
        out = saidas(gold.ler_seed())
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
    print(f"gold gravada: {len(g['companhias'])} companhias, DFP até {g['ultima_dfp']}, trimestre de referência {g['referencia_trimestral']}, hash {g['hash_dados'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
