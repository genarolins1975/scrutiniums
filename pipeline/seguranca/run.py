"""Execução do pipeline Segurança pública por UF (Eficiência Estatal).

    python3 -m pipeline.seguranca.run                         reconstrói a gold e o CSV a partir dos seeds (sem rede)
    python3 -m pipeline.seguranca.run --check                 confere se a gold e o CSV versionados são os dos seeds
    python3 -m pipeline.seguranca.run --coleta sinesp         recoleta o Sinesp VDE, grava o seed e reconstrói
    python3 -m pipeline.seguranca.run --coleta sim --so-coleta    só recoleta o SIM e grava o seed (motor por grupo)

Fontes de coleta: sinesp (MJSP, Sinesp VDE), sim (DATASUS, TabNet do SIM), ibge (Projeções da População) ou
todas. A coleta valida o que trouxe antes de gravar o seed: resposta incompleta, planilha trocada ou revisão
acima do limite não substituem o seed anterior (saída 1). A construção da gold valida de novo e não grava
nada se reprovar; nesse caso a saída é 1 e a publicação anterior continua no ar.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from . import coleta, gold, validacoes

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / "pipeline" / "seguranca" / "seed"
SEEDS = {
    "sinesp": SEED / "sinesp_vde.json",
    "sim": SEED / "sim_tabnet.json",
    "ibge": SEED / "ibge_populacao.json",
    "siconfi": SEED / "siconfi_dca.json",
}
PASTA = RAIZ / "public" / "eficiencia" / "seguranca-publica" / "gold"
GOLD = PASTA / "seguranca.json"
CSV = PASTA / "taxas-por-uf.csv"


def _gravar(caminho: Path, texto: str) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=caminho.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    os.chmod(tmp, 0o644)
    os.replace(tmp, caminho)


def _json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def ler_seeds() -> dict:
    return {k: json.loads(p.read_text(encoding="utf-8")) for k, p in SEEDS.items()}


def saidas(seeds: dict) -> dict[Path, str]:
    g = gold.construir(seeds)
    return {GOLD: _json(g), CSV: gold.csv_taxas(g)}


COLETORES = {"sinesp": coleta.coletar_vde, "sim": coleta.coletar_sim, "ibge": coleta.coletar_ibge, "siconfi": coleta.coletar_siconfi}
VALIDADORES = {"sinesp": validacoes.validar_vde, "sim": validacoes.validar_sim, "ibge": validacoes.validar_ibge, "siconfi": validacoes.validar_siconfi}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta", choices=[*COLETORES, "todas"])
    ap.add_argument("--so-coleta", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)

    if a.coleta:
        for fonte in COLETORES if a.coleta == "todas" else [a.coleta]:
            print(f"coletando {fonte}...", flush=True)
            novo = COLETORES[fonte]()
            anterior = json.loads(SEEDS[fonte].read_text(encoding="utf-8")) if SEEDS[fonte].exists() else None
            problemas = VALIDADORES[fonte](novo, anterior)
            if problemas:
                print(f"coleta {fonte} reprovada; o seed anterior foi mantido:", file=sys.stderr)
                for p in problemas[:40]:
                    print(" -", p, file=sys.stderr)
                return 1
            _gravar(SEEDS[fonte], _json(novo))
            print(f"seed {fonte} gravado ({SEEDS[fonte].stat().st_size / 1e3:.0f} kB)")
        if a.so_coleta:
            return 0

    seeds = ler_seeds()
    try:
        out = saidas(seeds)
    except gold.GoldInvalida as e:
        print(str(e), file=sys.stderr)
        return 1
    if a.check:
        difere = [str(p.relative_to(RAIZ)) for p, t in out.items() if not p.exists() or p.read_bytes().decode("utf-8") != t]
        if difere:
            print("a publicação versionada não é a dos seeds:", ", ".join(difere), file=sys.stderr)
            return 1
        print("gold e CSV conferem com os seeds")
        return 0
    for p, t in out.items():
        _gravar(p, t)
    g = json.loads(out[GOLD])
    print(f"gold gravada: {g['anos'][0]} a {g['anos'][-1]}, {len(g['indicadores'])} indicadores, hash {g['hash_dados'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
