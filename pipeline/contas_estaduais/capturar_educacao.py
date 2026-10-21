"""Captura os pacotes oficiais, sem promover observações educacionais."""
import argparse
from datetime import datetime, timezone
import hashlib
import http.client
import io
import json
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

FONTES = {
    "ideb": "https://download.inep.gov.br/ideb/resultados/divulgacao_regioes_ufs_ideb_2025.zip",
    "sinopse": "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_2025.zip",
}
AGENTE = "Scrutiniums/contas-estaduais"
# download.inep.gov.br envia só o certificado folha. O intermediário oficial vai versionado,
# com origem no próprio arquivo, e vale apenas para esse host; a raiz vem do sistema.
CADEIAS_ADICIONAIS = {
    "download.inep.gov.br": (
        Path(__file__).with_name("certificados") / "rnp-icpedu-gr46-ov-tls-ca-2025.pem",
        "e10747d4da7bab09cba9952f019d3534cb9fba070bf13d8791b1699cd2ff59dd",
    ),
}
ESPERAS = (10, 30)


class FonteIndisponivel(Exception):
    """Transporte falhou em todas as tentativas; nada se conclui sobre o dado."""


def contexto_tls(host):
    contexto = ssl.create_default_context()
    if host in CADEIAS_ADICIONAIS:
        caminho, sha256 = CADEIAS_ADICIONAIS[host]
        texto = caminho.read_text()
        bloco = texto[texto.index("-----BEGIN CERTIFICATE-----"):]
        if hashlib.sha256(ssl.PEM_cert_to_DER_cert(bloco)).hexdigest() != sha256:
            raise ValueError(f"Intermediário de {host} difere do SHA256 documentado")
        contexto.load_verify_locations(cadata=bloco)
        # O intermediário completa a cadeia, mas não vira âncora: a raiz continua obrigatória.
        contexto.verify_flags &= ~ssl.VERIFY_X509_PARTIAL_CHAIN
    return contexto


def transitorio(erro):
    if isinstance(erro, urllib.error.HTTPError):
        return erro.code == 429 or erro.code >= 500
    if isinstance(erro, urllib.error.URLError):
        erro = erro.reason
    if isinstance(erro, ssl.SSLCertVerificationError):
        return False
    return isinstance(erro, (OSError, http.client.HTTPException))


def baixar(url, tentativas, esperas):
    contexto = contexto_tls(urllib.parse.urlsplit(url).hostname)
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    for tentativa in range(1, tentativas + 1):
        try:
            with urllib.request.urlopen(req, timeout=90, context=contexto) as resposta:
                return resposta.read()
        except Exception as erro:
            if not transitorio(erro):
                raise
            if tentativa == tentativas:
                raise FonteIndisponivel(
                    f"{type(erro).__name__}: {erro} (após {tentativa} tentativa(s))") from erro
            time.sleep(esperas[min(tentativa, len(esperas)) - 1])


def coletar(destino, tentativas=1, esperas=ESPERAS):
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    manifesto = {"capturado_em": datetime.now(timezone.utc).isoformat(), "ano": 2025, "fontes": []}
    for nome, url in FONTES.items():
        registro = {"fonte": nome, "url": url}
        try:
            dados = baixar(url, tentativas, esperas)
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
            motivo = "fonte_indisponivel" if isinstance(erro, FonteIndisponivel) else "captura_invalida"
            registro.update(status="falha", motivo=motivo, erro=f"{type(erro).__name__}: {erro}")
        manifesto["fontes"].append(registro)
        print(f"{nome}: {registro['status']} — {registro.get('erro', registro.get('sha256'))}")
    (destino / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2)+"\n")
    return manifesto


def capturar(destino, tentativas=1, esperas=ESPERAS):
    manifesto = coletar(destino, tentativas, esperas)
    return all(f["status"] == "capturado" for f in manifesto["fontes"])


def codigo_saida(manifesto, tolerar_indisponivel):
    """Fonte inacessível pode virar aviso; pacote inválido, TLS reprovado ou HTTP 4xx sempre falham."""
    falhas = [f for f in manifesto["fontes"] if f["status"] != "capturado"]
    toleradas = [f for f in falhas if tolerar_indisponivel and f.get("motivo") == "fonte_indisponivel"]
    for f in toleradas:
        print(f"::warning title=Inep indisponível ({f['fonte']})::{f['erro']}. "
              "Nada foi capturado; isso não indica dado divergente.")
    return 1 if len(falhas) > len(toleradas) else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destino", required=True)
    parser.add_argument("--tentativas", type=int, default=3)
    parser.add_argument("--tolerar-indisponivel", action="store_true",
                        help="fonte inacessível após as tentativas vira aviso, sem código de erro")
    args = parser.parse_args()
    raise SystemExit(codigo_saida(coletar(args.destino, args.tentativas), args.tolerar_indisponivel))
