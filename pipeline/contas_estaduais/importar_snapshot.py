"""Importa uma versão fixada da gold existente, sem promover validação primária.

python3 -m pipeline.contas_estaduais.importar_snapshot
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORIGEM = ROOT / "public/obs/data/gold/subnacional.json"
DESTINO = ROOT / "src/lib/contas-estaduais/snapshot.json"
COMMIT = "b02f2367786a02a8d3a3016ca076488991f280f1"
BLOB = "3735c67b2dd6d34b3db117ee07578eb0109fcfe9"


def importar(origem=ORIGEM, destino=DESTINO):
    bruto = origem.read_bytes()
    git_blob = hashlib.sha1(f"blob {len(bruto)}\0".encode() + bruto).hexdigest()
    if git_blob != BLOB:
        raise ValueError("Gold diferente da versão fixada: revisar proveniência antes de importar.")
    dados = json.loads(bruto)
    campos = ("uf", "nome", "regiao", "exercicio", "quadrimestre", "dcl", "rcl", "dcl_rcl_pct", "serie")
    ufs = [{k: u[k] for k in campos} for u in dados["divida"]["ufs"]]
    if len(ufs) != 27 or len({u["uf"] for u in ufs}) != 27:
        raise ValueError("Universo esperado: 27 UFs únicas")
    saida = {
        "versao": "0.1.0", "indicador": "CE-11",
        "proveniencia": {
            "tipo": "snapshot_herdado", "commit": COMMIT, "gitBlob": BLOB,
            "sha256": hashlib.sha256(bruto).hexdigest(),
            "url": f"https://github.com/genarolins1975/scrutiniums/blob/{COMMIT}/public/obs/data/gold/subnacional.json",
            "fontePrimaria": dados["divida"]["fonte"],
            "geracaoGold": dados["gerado_em"], "capturaPrimaria": None,
            "perimetro": "RGF, Anexo 02; poder Executivo estadual, conforme pipeline de origem",
            "rcl": "Pipeline de origem prioriza RCL ajustada e admite RCL sem ajuste como fallback. A gold não preserva a escolha por observação.",
            "limitacoes": [
                "Data de geração da gold não é a data de captura de cada demonstrativo.",
                "Sem resposta primária arquivada nesta versão; valores sujeitos à retificação.",
                "Série anual contém apenas percentuais, sem seus numeradores e denominadores.",
                "Conferência aritmética interna não comprova aderência ao conceito oficial.",
            ],
        },
        "ufs": ufs,
    }
    destino.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n")
    return saida


if __name__ == "__main__":
    resultado = importar()
    print(f"{len(resultado['ufs'])} UFs importadas; validação primária pendente.")
