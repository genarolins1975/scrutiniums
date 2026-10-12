"""Captura imutável Siconfi para a fase estadual (stdlib, sem credenciais).

Exemplo: python3 -m pipeline.contas_estaduais.coletar --ano 2025 --ufs PE SP MG RS AM DF
A coleta NÃO altera dados publicados e NÃO aprova automaticamente indicadores.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import time
import ssl
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError, URLError
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/"
UFS = dict(RO=11, AC=12, AM=13, RR=14, PA=15, AP=16, TO=17,
           MA=21, PI=22, CE=23, RN=24, PB=25, PE=26, AL=27, SE=28, BA=29,
           MG=31, ES=32, RJ=33, SP=35, PR=41, SC=42, RS=43, MS=50, MT=51, GO=52, DF=53)
PROVAS = ["PE", "SP", "MG", "RS", "AM", "DF"]
CONTAS = {
    "DividaConsolidadaLiquida": "dcl",
    "ReceitaCorrenteLiquidaAjustadaParaCalculoDosLimitesDeEndividamento": "rcl_ajustada",
    "PercentualDaDCLSobreARCL": "percentual_declarado",
}

def agora():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def parametros(uf, ano, demonstrativo, periodo=None):
    if uf not in UFS or ano < 2015 or ano > dt.date.today().year:
        raise ValueError("UF ou exercício inválido")
    if demonstrativo == "rgf":
        p = periodo or 3
        if p not in (1, 2, 3):
            raise ValueError("Quadrimestre inválido")
        return dict(an_exercicio=ano, in_periodicidade="Q", nr_periodo=p,
                    co_tipo_demonstrativo="RGF", no_anexo="RGF-Anexo 02",
                    co_poder="E", id_ente=UFS[uf], limit=5000)
    if demonstrativo != "rreo":
        raise ValueError("Demonstrativo inválido")
    return dict(an_exercicio=ano, nr_periodo=6, co_tipo_demonstrativo="RREO",
                no_anexo="RREO-Anexo 01", co_esfera="E", id_ente=UFS[uf], limit=5000)

def espera_retry(valor, tentativa):
    """Respeita Retry-After; não antecipa esperas superiores ao orçamento local."""
    espera = 2 ** (tentativa + 1)
    if valor:
        try:
            espera = max(espera, int(valor))
        except ValueError:
            try:
                data = parsedate_to_datetime(valor)
                espera = max(espera, math.ceil((data - dt.datetime.now(dt.timezone.utc)).total_seconds()))
            except (ValueError, TypeError, OverflowError):
                pass
    if espera > 60:
        return None
    return espera


def requisitar(url):
    for tentativa in range(3):
        # Limita também chamadas bem-sucedidas para evitar rajadas nas 27 UFs.
        time.sleep(1)
        try:
            with urlopen(Request(url, headers={"User-Agent": "Scrutiniums-ContasEstaduais/0.1"}),
                         timeout=45) as resposta:
                return resposta.read()
        except HTTPError as erro:
            if erro.code not in (429, 500, 502, 503, 504) or tentativa == 2:
                raise
            espera = espera_retry(erro.headers.get("Retry-After"), tentativa)
            if espera is None:
                raise  # não ignora um prazo de espera longo imposto pelo servidor
            time.sleep(espera)
        except (URLError, TimeoutError) as erro:
            if isinstance(getattr(erro, "reason", None), ssl.SSLCertVerificationError):
                raise
            if tentativa == 2:
                raise
            time.sleep(2 ** (tentativa + 1))

def paginas(base, params, destino, fetch=requisitar):
    itens, arquivos, offset = [], [], 0
    for _ in range(50):
        url = API + base + "?" + urlencode({**params, "offset": offset})
        captura = agora()
        bruto = fetch(url)
        sha = hashlib.sha256(bruto).hexdigest()
        arquivo = destino / (sha + ".json")
        if not arquivo.exists():
            arquivo.write_bytes(bruto)
        pagina = json.loads(bruto)
        if not isinstance(pagina, dict) or not isinstance(pagina.get("items"), list):
            raise ValueError("Resposta sem lista items; não pode ser tratada como ausência")
        lote = pagina["items"]
        arquivos.append(dict(url=url, capturado_em=captura, sha256=sha,
                             arquivo=arquivo.name, linhas=len(lote), offset=offset))
        itens.extend(lote)
        if pagina.get("hasMore") is False:
            return itens, arquivos
        if pagina.get("hasMore") is not True or not lote:
            raise ValueError("Paginação inconclusiva; resultado bloqueado")
        offset += len(lote)
    raise ValueError("Limite de paginação atingido; captura incompleta")

def mapear_rgf(itens, uf, ano, periodo):
    coluna = f"Até o {periodo}º Quadrimestre"
    selecionados = {}
    for linha in itens:
        campo = CONTAS.get(linha.get("cod_conta"))
        if not campo or linha.get("coluna") != coluna:
            continue
        if linha.get("uf") != uf or int(linha.get("exercicio", -1)) != ano:
            raise ValueError("UF ou exercício divergente no conteúdo")
        if linha.get("cod_ibge") is not None and int(linha["cod_ibge"]) != UFS[uf]:
            raise ValueError("Código do ente divergente")
        if linha.get("periodo") is not None and int(linha["periodo"]) != periodo:
            raise ValueError("Período divergente")
        if campo in selecionados:
            raise ValueError("Conta duplicada: exige resolver versão/perímetro antes de calcular")
        valor = linha.get("valor")
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
            raise ValueError("Valor inválido; não converter ausência em zero")
        selecionados[campo] = valor
    faltantes = sorted(set(CONTAS.values()) - set(selecionados))
    if faltantes:
        return dict(status="campos_ausentes", campos_ausentes=faltantes, valores=selecionados)
    if selecionados["rcl_ajustada"] <= 0:
        return dict(status="denominador_invalido", valores=selecionados)
    calculado = 100 * selecionados["dcl"] / selecionados["rcl_ajustada"]
    return dict(status="mapeamento_candidato", valores=selecionados,
                percentual_calculado=calculado,
                diferenca_pp=calculado-selecionados["percentual_declarado"],
                validacao_primaria="revisao_humana_pendente",
                coluna=coluna, codigos=CONTAS)

def coletar(ufs, ano, pasta, periodo=3, incluir_rreo=True):
    pasta.mkdir(parents=True, exist_ok=False)
    registros = []
    for uf in ufs:
        for fonte in (["rgf", "rreo"] if incluir_rreo else ["rgf"]):
            params = parametros(uf, ano, fonte, periodo)
            registro = dict(uf=uf, ano=ano, fonte=fonte, parametros=params, iniciado_em=agora())
            destino = pasta / (uf + "-" + fonte)
            destino.mkdir()
            try:
                itens, arquivos = paginas(fonte, params, destino)
                registro.update(status="capturado" if itens else "sem_registro_na_consulta",
                                linhas=len(itens), paginas=arquivos)
                if itens and fonte == "rgf":
                    registro["mapeamento"] = mapear_rgf(itens, uf, ano, periodo)
            except Exception as erro:
                # Bytes já recebidos continuam no diretório, mesmo em erro parcial.
                registro.update(status="erro_coleta_ou_mapeamento", erro=str(erro),
                                arquivos_parciais=sorted(p.name for p in destino.glob("*.json")))
            registros.append(registro)
            (pasta / "manifesto.json").write_text(
                json.dumps(dict(versao="0.1.0", registros=registros), ensure_ascii=False, indent=2) + "\n")
            print(json.dumps(registro, ensure_ascii=False))
    return registros

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--ufs", nargs="+", choices=sorted(UFS), default=PROVAS)
    p.add_argument("--quadrimestre", type=int, choices=[1, 2, 3], default=3)
    p.add_argument("--somente-rgf", action="store_true")
    p.add_argument("--destino", type=Path)
    args = p.parse_args()
    destino = args.destino or Path("data/contas-estaduais/raw") / dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    registros = coletar(args.ufs, args.ano, destino, args.quadrimestre, not args.somente_rgf)
    print("Manifesto:", destino / "manifesto.json")
    raise SystemExit(1 if any(r["status"] == "erro_coleta_ou_mapeamento" for r in registros) else 0)
