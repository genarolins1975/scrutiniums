"""Coleta de descoberta. Nunca promove observações a public/ nem modifica escores.

Uso: python3 pipeline/eficiencia_mobilidade/coletar.py --destino /tmp/mobilidade
Somente URLs públicas explicitamente permitidas; originais, datas e hashes preservados.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import re
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

FONTES = {
    "pemob_municipal_2025.xlsx": "https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_municipal_2025.xlsx",
    "pemob_metropolitana_2025.xlsx": "https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_metropolitana_2025.xlsx",
    "ibge_agregados_2022.json": "https://servicodados.ibge.gov.br/api/v3/agregados?periodo=2022",
    "ipea_dados.html": "https://www.ipea.gov.br/acessooportunidades/dados/",
    "ipea_dicionario.html": "https://ipea.github.io/aopdata/articles/data_dictionary_pt.html",
}
LIMITE_BYTES = 64 * 1024 * 1024
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def baixar(nome: str, url: str, destino: pathlib.Path) -> dict:
    registro = {"arquivo": nome, "url": url, "estado": "nao_coletado"}
    for tentativa in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Scrutiniums-OBEE/1.0 (public-data audit)", "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=45) as resposta:
                corpo = resposta.read(LIMITE_BYTES + 1)
                if len(corpo) > LIMITE_BYTES:
                    raise ValueError("Resposta excede o limite de coleta")
                if not corpo:
                    raise ValueError("Resposta vazia")
                if nome.endswith(".xlsx") and not corpo.startswith(b"PK"):
                    raise ValueError("Resposta não é um arquivo XLSX")
                if nome.endswith(".json"):
                    json.loads(corpo)
                destino.joinpath(nome).write_bytes(corpo)
                registro.update(estado="coletado", capturado_em=datetime.now(timezone.utc).isoformat(), url_final=resposta.url,
                                bytes=len(corpo), sha256=hashlib.sha256(corpo).hexdigest(), tipo=resposta.headers.get("Content-Type"))
                return registro
        except (OSError, ValueError) as erro:
            registro["erro"] = str(erro)
            if tentativa == 0:
                time.sleep(1)
    return registro


def estrutura_xlsx(caminho: pathlib.Path) -> dict:
    """Inspeciona estrutura, não valores pessoais dos respondentes."""
    with zipfile.ZipFile(caminho) as z:
        workbook = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        result = []
        for s in workbook.findall("s:sheets/s:sheet", NS):
            rid = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = targets[rid]
            path = target.lstrip("/") if target.startswith("/") else "xl/" + target
            root = ET.fromstring(z.read(path))
            rows = root.findall("s:sheetData/s:row", NS)
            dim = root.find("s:dimension", NS)
            result.append({"nome": s.attrib["name"], "linhas_fisicas": len(rows), "dimensao": dim.attrib.get("ref") if dim is not None else None})
        return {"abas": result, "nota": "Linhas físicas não equivalem a municípios nem observações elegíveis."}


def descobrir_ibge(destino: pathlib.Path) -> list[dict]:
    arquivo = destino / "ibge_agregados_2022.json"
    if not arquivo.exists():
        return []
    blocos = json.loads(arquivo.read_bytes())
    tabelas = []
    for pesquisa in blocos:
        if "censo" not in pesquisa.get("nome", "").lower():
            continue
        for agregado in pesquisa.get("agregados", []):
            nome = agregado.get("nome", "")
            if re.search(r"desloc|meio de transporte|tempo habitual", nome, re.I):
                tabelas.append({"pesquisa": pesquisa.get("nome"), **agregado})
    for t in tabelas:
        identificador = str(t["id"])
        if not identificador.isdigit():
            raise ValueError("Identificador IBGE inválido")
        nome = "ibge_metadados_" + identificador + ".json"
        t["coleta_metadados"] = baixar(nome, "https://servicodados.ibge.gov.br/api/v3/agregados/" + identificador + "/metadados", destino)
    return tabelas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destino", type=pathlib.Path, required=True)
    args = parser.parse_args()
    args.destino.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(baixar, nome, url, args.destino) for nome, url in FONTES.items()]
        fontes = [f.result() for f in futures]
    estruturas = {}
    for f in fontes:
        if f["estado"] == "coletado" and f["arquivo"].endswith(".xlsx"):
            estruturas[f["arquivo"]] = estrutura_xlsx(args.destino / f["arquivo"])
    tabelas = descobrir_ibge(args.destino)
    manifesto = {"versao": "0.1-descoberta", "promocao_publica": False, "fontes": fontes, "estruturas": estruturas, "tabelas_ibge": tabelas}
    (args.destino / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"fontes": [{"arquivo": f["arquivo"], "estado": f["estado"], "erro": f.get("erro")} for f in fontes], "estruturas": estruturas, "tabelas_ibge": [{"id": t["id"], "nome": t["nome"]} for t in tabelas]}, ensure_ascii=False, indent=2))
    # A coleta pode ser parcial, mas nunca é declarada concluída silenciosamente.
    return 0 if all(f["estado"] == "coletado" for f in fontes[:3]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
