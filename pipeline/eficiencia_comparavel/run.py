"""Reproduz a BMC offline; --check valida os bytes sem escrever saídas."""
import argparse
import json
from .gold import OUT, build, serialize, csv_bytes, distribution_csv_bytes
from .validacoes import validate


def run(*, check=False, only_capitals=False):
    data = build(only_capitals=only_capitals)
    validate(data, require_universe=not only_capitals)
    outputs = {"base.json": serialize(data), "observacoes.csv": csv_bytes(data),
               "distribuicoes.csv": distribution_csv_bytes(data)}
    if check:
        for name, expected in outputs.items():
            if not (OUT / name).exists() or (OUT / name).read_bytes() != expected:
                raise ValueError("Gold difere da reprodução sem rede: " + name)
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for name, content in outputs.items():
            temporary = OUT / (name + ".tmp")
            temporary.write_bytes(content)
            temporary.replace(OUT / name)
    return {"estado": data["estado"], "capitais_observacoes": len(data["capitais"]),
            "municipios_referencia": len(data["municipios"]), "observacoes": len(data["observacoes"]), "hashes_v3": 54}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--somente-capitais", action="store_true", help="Etapa de trabalho local; não satisfaz o aceite dos 318 municípios")
    args = parser.parse_args()
    print(json.dumps(run(check=args.check, only_capitals=args.somente_capitais), ensure_ascii=False))
