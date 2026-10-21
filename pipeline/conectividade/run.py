"""Execução do pipeline Conectividade (Observatório de Energia e Infraestrutura).

    python3 -m pipeline.conectividade.run                            reconstrói a gold a partir dos seeds (sem rede)
    python3 -m pipeline.conectividade.run --check                    confere se a gold versionada é a dos seeds
    python3 -m pipeline.conectividade.run --coleta fixa              recoleta a banda larga fixa, grava o seed e reconstrói
    python3 -m pipeline.conectividade.run --coleta movel --so-coleta só recoleta a telefonia móvel (motor por grupo)

Fontes: fixa (acessos de banda larga fixa por município, mensal), movel (acessos de telefonia móvel, mensal) e cobertura
(cobertura das redes móveis por município, trimestral), ou todas. Os três zips da Anatel somam mais de 4 GB; a coleta lê
só os membros necessários por faixa de bytes (HTTP Range), cerca de 250 MB por execução. A coleta valida o que trouxe
antes de gravar o seed: arquivo com estrutura trocada, município faltando, soma que não fecha com o total da Anatel ou
revisão acima do limite não substituem o seed anterior (saída 1). A construção da gold valida de novo, com a conferência
cruzada entre as fontes, e não grava nada se reprovar; a publicação anterior continua no ar.

Só a biblioteca padrão, na coleta e na reconstrução.
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
SEED = RAIZ / "pipeline" / "conectividade" / "seed"
SEEDS = {"fixa": SEED / "fixa.json", "movel": SEED / "movel.json", "cobertura": SEED / "cobertura.json"}
PASTA = RAIZ / "public" / "conectividade" / "gold"
GOLD = PASTA / "conectividade.json"
PASTA_UF = PASTA / "municipios"


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
    g, por_uf = gold.construir(seeds)
    out = {GOLD: _json(g)}
    for uf, dados in por_uf.items():
        out[PASTA_UF / f"{uf}.json"] = _json(dados)
    return out


COLETORES = {"fixa": coleta.coletar_fixa, "movel": coleta.coletar_movel, "cobertura": coleta.coletar_cobertura}
VALIDADORES = {"fixa": validacoes.validar_fixa, "movel": validacoes.validar_movel, "cobertura": validacoes.validar_cobertura}


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
            print(f"seed {fonte} gravado ({SEEDS[fonte].stat().st_size / 1e3:.0f} kB), referência {novo['referencia']}")
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
        sobrando = [str(p.relative_to(RAIZ)) for p in PASTA_UF.glob("*.json") if p not in out] if PASTA_UF.exists() else []
        if difere or sobrando:
            print("a publicação versionada não é a dos seeds:", ", ".join(difere + sobrando), file=sys.stderr)
            return 1
        print("gold confere com os seeds")
        return 0
    for p, t in out.items():
        _gravar(p, t)
    g = json.loads(out[GOLD])
    r = g["referencia"]
    print(f"gold gravada: banda larga fixa {r['fixa']}, telefonia móvel {r['movel']}, cobertura {r['cobertura']}, "
          f"{g['destaques']['municipios']} municípios, hash {g['hash_dados'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
