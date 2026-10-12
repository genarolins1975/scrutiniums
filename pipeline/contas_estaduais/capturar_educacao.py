"""Captura os pacotes oficiais, sem promover observações educacionais."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

FONTES = {
    "ideb": "https://download.inep.gov.br/ideb/resultados/divulgacao_regioes_ufs_ideb_2025.zip",
    "sinopse": "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_2025.zip",
}


def capturar(destino):
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    manifesto = {"capturado_em": datetime.now(timezone.utc).isoformat(), "ano": 2025, "fontes": []}
    for nome, url in FONTES.items():
        registro = {"fonte": nome, "url": url}
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Scrutiniums/contas-estaduais"})
            with urllib.request.urlopen(req, timeout=90) as resposta:
                dados = resposta.read()
            with zipfile.ZipFile(io.BytesIO(dados)) as pacote:
                if pacote.testzip() is not None:
                    raise ValueError("CRC inválido no pacote")
                membros = pacote.namelist()
                if not any(n.lower().endswith((".xlsx", ".ods")) for n in membros):
                    raise ValueError("Pacote sem planilha")
            arquivo = url.rsplit("/", 1)[-1]
            (destino / arquivo).write_bytes(dados)
            registro.update(status="capturado", arquivo=arquivo, bytes=len(dados),
                            sha256=hashlib.sha256(dados).hexdigest(), membros=membros)
        except Exception as erro:
            registro.update(status="falha", erro=f"{type(erro).__name__}: {erro}")
        manifesto["fontes"].append(registro)
    (destino / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2)+"\n")
    return all(f["status"] == "capturado" for f in manifesto["fontes"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destino", required=True)
    args = parser.parse_args()
    raise SystemExit(0 if capturar(args.destino) else 1)
