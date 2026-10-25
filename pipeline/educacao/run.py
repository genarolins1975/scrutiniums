"""Execução do pipeline Educação nos municípios (Observatório dos Serviços Públicos).

    python3 -m pipeline.educacao.run                            reconstrói a gold a partir dos seeds (sem rede)
    python3 -m pipeline.educacao.run --check                    confere se a gold versionada é a dos seeds
    python3 -m pipeline.educacao.run --coleta ideb              recoleta o Ideb, grava o seed e reconstrói
    python3 -m pipeline.educacao.run --coleta censo --so-coleta só recoleta a Sinopse do Censo Escolar (motor por grupo)

Fontes de coleta: ideb (Ideb por município, UF e Brasil, INEP, bienal), censo (Sinopse Estatística do Censo Escolar,
INEP, anual) e populacao (estimativas do IBGE no ano do Ideb, só para o porte), ou todas. A coleta valida o que trouxe
antes de gravar o seed: planilha trocada, conta que não fecha ou revisão acima do limite não substituem o seed anterior
(saída 1). A construção da gold valida de novo, com a conferência cruzada entre as três fontes, e não grava nada se
reprovar; nesse caso a saída é 1 e a publicação anterior continua no ar. Tudo roda só com a biblioteca padrão.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import tempfile
from pathlib import Path

from . import gold, validacoes

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / "pipeline" / "educacao" / "seed"
# o seed do Ideb (todas as redes municipais e públicas, 2005 em diante, com os componentes) vai comprimido: 13 MB em JSON,
# cerca de 3 MB em gzip determinístico (sem data no cabeçalho), para o histórico do repositório não crescer a cada edição
SEEDS = {
    "ideb": SEED / "ideb.json.gz",
    "censo": SEED / "censo.json",
    "populacao": SEED / "populacao.json",
}
PASTA = RAIZ / "public" / "educacao" / "gold"
GOLD = PASTA / "educacao.json"
PASTA_UF = PASTA / "municipios"


def _gravar(caminho: Path, texto: str) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    dados = texto.encode("utf-8")
    if caminho.suffix == ".gz":
        dados = gzip.compress(dados, compresslevel=9, mtime=0)
    fd, tmp = tempfile.mkstemp(dir=caminho.parent, prefix=".tmp-")
    with os.fdopen(fd, "wb") as f:
        f.write(dados)
    os.chmod(tmp, 0o644)
    os.replace(tmp, caminho)


def ler_json(caminho: Path) -> dict:
    dados = caminho.read_bytes()
    if caminho.suffix == ".gz":
        dados = gzip.decompress(dados)
    return json.loads(dados.decode("utf-8"))


def _json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def ler_seeds() -> dict:
    return {k: ler_json(p) for k, p in SEEDS.items()}


def saidas(seeds: dict) -> dict[Path, str]:
    g, por_uf = gold.construir(seeds)
    mapa = gold.mapa_compacto(g, por_uf)
    problemas = validacoes.validar_mapa(mapa, g, por_uf)
    if problemas:
        raise gold.GoldInvalida("mapa não publicado: " + "; ".join(problemas[:20]))
    out = {GOLD: _json(g), PASTA / "mapa.json": _json(mapa)}
    for uf, dados in por_uf.items():
        out[PASTA_UF / f"{uf}.json"] = _json(dados)
    return out


def _coletar(fonte: str) -> dict:
    from . import coleta  # rede só na coleta

    if fonte == "ideb":
        return coleta.coletar_ideb()
    if fonte == "censo":
        return coleta.coletar_censo()
    # a população é a do ano do Ideb publicado (o porte do município na mesma data do resultado)
    ano = ler_json(SEEDS["ideb"])["ano"]
    return coleta.coletar_populacao(ano)


VALIDADORES = {"ideb": validacoes.validar_ideb, "censo": validacoes.validar_censo, "populacao": validacoes.validar_populacao}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleta", choices=[*SEEDS, "todas"])
    ap.add_argument("--so-coleta", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)

    if a.coleta:
        for fonte in SEEDS if a.coleta == "todas" else [a.coleta]:
            print(f"coletando {fonte}...", flush=True)
            novo = _coletar(fonte)
            anterior = ler_json(SEEDS[fonte]) if SEEDS[fonte].exists() else None
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
        f"gold gravada: Ideb {g['ideb']['ano']} ({g['ideb']['anos'][0]} a {g['ideb']['anos'][-1]}), Censo Escolar "
        f"{g['censo']['ano']}, população {g['fontes']['populacao']['ano']}, {g['municipios']['total']} municípios, "
        f"hash {g['hash_dados'][:12]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
