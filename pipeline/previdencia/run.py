"""Execução do pipeline Previdência e INSS (Observatório das Contas Públicas).

    python3 -m pipeline.previdencia.run                          reconstrói a gold a partir dos seeds (sem rede)
    python3 -m pipeline.previdencia.run --check                  confere se a gold versionada é a dos seeds
    python3 -m pipeline.previdencia.run --coleta beps            recoleta o BEPS, grava o seed e reconstrói
    python3 -m pipeline.previdencia.run --coleta rtn --so-coleta só recoleta o RTN e grava o seed (motor por grupo)
    python3 -m pipeline.previdencia.run --coleta aeps            procura a edição seguinte do AEPS (ou recoleta a atual)

Fontes de coleta: beps (Boletim Estatístico da Previdência Social, mensal), municipios (benefícios emitidos por
município, anual), rtn (Resultado do Tesouro Nacional, série histórica) e aeps (Anuário Estatístico da Previdência
Social, anual: concessões, valor do ano, rede e atendimento, com a rede e o atendimento das edições anteriores desde a
de 2022), ou todas. A coleta valida o que trouxe antes
de gravar o seed: planilha trocada, tabela que não fecha ou revisão acima do limite não substituem o seed anterior
(saída 1). A construção da gold valida de novo, com a conferência cruzada entre o arquivo municipal e o BEPS, e não
grava nada se reprovar; nesse caso a saída é 1 e a publicação anterior continua no ar.

A coleta do BEPS lê planilha Excel 97 com a biblioteca xlrd; o arquivo municipal e o RTN, com openpyxl; o AEPS, páginas
HTML com a biblioteca padrão. As duas bibliotecas só são importadas na coleta: a reconstrução e os testes usam só a
biblioteca padrão.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from . import aeps, coleta, gold, validacoes

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / "pipeline" / "previdencia" / "seed"
SEEDS = {
    "beps": SEED / "beps.json",
    "municipios": SEED / "municipios.json",
    "rtn": SEED / "rtn.json",
    "aeps": SEED / "aeps.json",
}
PASTA = RAIZ / "public" / "previdencia" / "gold"
GOLD = PASTA / "previdencia.json"
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


# Cada coletor recebe o seed publicado: o do AEPS parte da edição publicada para procurar a seguinte.
COLETORES = {
    "beps": lambda _anterior: coleta.coletar_beps(),
    "municipios": lambda _anterior: coleta.coletar_municipios(),
    "rtn": lambda _anterior: coleta.coletar_rtn(),
    "aeps": aeps.coletar_aeps,
}
VALIDADORES = {"beps": validacoes.validar_beps, "municipios": validacoes.validar_municipios, "rtn": validacoes.validar_rtn, "aeps": validacoes.validar_aeps}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta", choices=[*COLETORES, "todas"])
    ap.add_argument("--so-coleta", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)

    if a.coleta:
        for fonte in COLETORES if a.coleta == "todas" else [a.coleta]:
            print(f"coletando {fonte}...", flush=True)
            anterior = json.loads(SEEDS[fonte].read_text(encoding="utf-8")) if SEEDS[fonte].exists() else None
            novo = COLETORES[fonte](anterior)
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
        sobrando = [str(p.relative_to(RAIZ)) for p in PASTA_UF.glob("*.json") if p not in out] if PASTA_UF.exists() else []
        if difere or sobrando:
            print("a publicação versionada não é a dos seeds:", ", ".join(difere + sobrando), file=sys.stderr)
            return 1
        print("gold confere com os seeds")
        return 0
    for p, t in out.items():
        _gravar(p, t)
    g = json.loads(out[GOLD])
    print(
        f"gold gravada: BEPS {g['referencia']}, municípios {g['anual']['anos'][0]} a {g['anual']['anos'][-1]} "
        f"({g['municipios']['total']}), RTN {g['rgps']['anos'][0]} a {g['rgps']['anos'][-1]}, AEPS {g['aeps']['edicao']}, "
        f"hash {g['hash_dados'][:12]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
