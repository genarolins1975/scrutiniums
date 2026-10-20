"""Coleta dos dados abertos da Anatel para o painel Conectividade.

Os três zips da Anatel somam mais de 4 GB; o servidor aceita HTTP Range, e a coleta lê de cada zip só o diretório e
os membros necessários (`RangeFile` é um arquivo "seekável" sobre HTTP, que o módulo zipfile lê como se fosse local).
Cada membro é descompactado em fluxo, com o sha256 calculado sobre os bytes descompactados, e agregado por município
sem gravar o CSV em disco. O seed de cada fonte traz a identificação do original (membro, bytes, CRC e sha256, data do
membro no zip e Last-Modified do zip), o instante da captura, o mês de referência e os agregados.

Nenhuma biblioteca fora da padrão. Estrutura inesperada (coluna faltando, membro ausente, unidade não reconhecida)
levanta ValueError: a coleta reprova e o seed anterior continua valendo.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from . import fontes as F


def agora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def numero(v) -> float | None:
    """Número no formato da Anatel ("27,026089688152"); vazio vira None."""
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)


def inteiro(v) -> int:
    s = str(v or "").strip()
    return int(s) if s else 0


def mes_iso(ano, mes) -> str:
    return f"{int(ano):04d}-{int(mes):02d}"


# ----------------------------------------------------------------------------------------------- leitura por faixa


class RangeFile(io.RawIOBase):
    """Arquivo somente leitura sobre HTTP com Range: cada leitura pede ao servidor só a faixa necessária."""

    def __init__(self, url: str, tentativas: int = 4, timeout: int = 300):
        self.url = url
        self.tentativas = tentativas
        self.timeout = timeout
        self.pos = 0
        self.pedidos = 0
        self.bytes_lidos = 0
        cab = self._cabecalho()
        self.size = int(cab["Content-Length"])
        self.last_modified = cab.get("Last-Modified")
        if cab.get("Accept-Ranges", "").lower() != "bytes":
            raise ValueError(f"o servidor não aceita leitura por faixa de bytes: {url}")

    def _cabecalho(self):
        erro = None
        for t in range(self.tentativas):
            try:
                req = urllib.request.Request(self.url, method="HEAD", headers={"User-Agent": F.USER_AGENT, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    return r.headers
            except urllib.error.HTTPError as e:
                erro = e
                if 400 <= e.code < 500:
                    break
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                erro = e
            time.sleep(min(60, 5 * (t + 1)))
        raise RuntimeError(f"falha ao consultar {self.url}: {erro}")

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        if whence == 0:
            self.pos = off
        elif whence == 1:
            self.pos += off
        else:
            self.pos = self.size + off
        return self.pos

    def readinto(self, b):
        if self.pos >= self.size:
            return 0
        fim = min(self.size - 1, self.pos + len(b) - 1)
        erro = None
        for t in range(self.tentativas):
            try:
                req = urllib.request.Request(self.url, headers={"User-Agent": F.USER_AGENT, "Accept": "*/*", "Range": f"bytes={self.pos}-{fim}"})
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    if r.status != 206:
                        raise ValueError(f"resposta {r.status} a um pedido por faixa de bytes")
                    dados = r.read()
                break
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
                erro = e
                time.sleep(min(60, 5 * (t + 1)))
        else:
            raise RuntimeError(f"falha ao ler {self.url} ({self.pos}-{fim}): {erro}")
        b[: len(dados)] = dados
        self.pos += len(dados)
        self.pedidos += 1
        self.bytes_lidos += len(dados)
        return len(dados)


class _ComHash(io.RawIOBase):
    """Envolve o fluxo descompactado de um membro e calcula o sha256 do que passou."""

    def __init__(self, fluxo):
        self.fluxo = fluxo
        self.sha = hashlib.sha256()
        self.bytes = 0

    def readable(self):
        return True

    def readinto(self, b):
        d = self.fluxo.read(len(b))
        if d:
            self.sha.update(d)
            self.bytes += len(d)
            b[: len(d)] = d
        return len(d)


class Zip:
    """Um zip da Anatel aberto por faixa de bytes, com a identificação de cada membro lido."""

    def __init__(self, url: str, arquivo=None):
        """`arquivo`: qualquer arquivo binário "seekável" (testes); sem ele, o zip é lido da URL por faixa de bytes."""
        self.url = url
        self.arquivo = arquivo if arquivo is not None else RangeFile(url)
        self.zip = zipfile.ZipFile(io.BufferedReader(self.arquivo, buffer_size=8 << 20) if isinstance(self.arquivo, io.RawIOBase) else self.arquivo)
        self.lidos: dict[str, dict] = {}

    @property
    def modificado_em(self) -> str | None:
        lm = getattr(self.arquivo, "last_modified", None)
        if not lm:
            return None
        return parsedate_to_datetime(lm).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def membros(self) -> list[str]:
        return self.zip.namelist()

    def linhas(self, membro: str):
        """Itera as linhas (dict) de um CSV do zip, com ';' e BOM, registrando bytes e sha256 ao terminar."""
        info = self.zip.getinfo(membro)
        with self.zip.open(membro) as bruto:
            h = _ComHash(bruto)
            texto = io.TextIOWrapper(io.BufferedReader(h, buffer_size=4 << 20), encoding="utf-8-sig", newline="")
            leitor = csv.DictReader(texto, delimiter=";")
            if leitor.fieldnames is None:
                raise ValueError(f"{membro}: CSV sem cabeçalho")
            yield from leitor
            self.lidos[membro] = {
                "membro": membro,
                "bytes": h.bytes,
                "crc32": f"{info.CRC:08x}",
                "sha256": h.sha.hexdigest(),
                "modificado_no_zip": datetime(*info.date_time).strftime("%Y-%m-%dT%H:%M:%S"),
            }

    def identificacao(self) -> dict:
        tamanho = getattr(self.arquivo, "size", None)
        if tamanho is None:
            pos = self.arquivo.tell()
            tamanho = self.arquivo.seek(0, 2)
            self.arquivo.seek(pos)
        return {"url": self.url, "zip_bytes": tamanho, "zip_modificado_em": self.modificado_em, "membros": self.lidos}


def exigir_colunas(nome: str, cabecalho, colunas) -> None:
    faltam = [c for c in colunas if c not in (cabecalho or [])]
    if faltam:
        raise ValueError(f"{nome}: colunas ausentes {faltam}; cabeçalho {list(cabecalho or [])}")


# --------------------------------------------------------------------------------------------- séries de densidade


def _densidade(z: Zip, membro: str) -> dict:
    """Densidade do mês mais recente do arquivo, para o Brasil, cada UF e cada município.

    Só o último mês: a série mensal publicada pela Anatel tem meses vazios e meses com valores incompatíveis com os
    acessos (na banda larga fixa, 20/10/2026: 2024-12 vazio, 2025-12 com 94,0 e 2026-01 com 55,6 contra 27,0 em
    2026-08; São Paulo com 0,03 em 2025-12). A evolução no tempo sai da série de acessos, que fecha com os municípios.
    A unidade é conferida na validação cruzada: acessos ÷ densidade reproduz a população, não os domicílios."""
    brasil: dict[str, float] = {}
    ufs: dict[str, dict[str, float]] = defaultdict(dict)
    municipios: dict[str, dict[str, float]] = defaultdict(dict)
    ultimo = ""
    primeiro = True
    for x in z.linhas(membro):
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Ano", "Mês", "UF", "Município", "Código IBGE", "Densidade", "Nível Geográfico Densidade"])
            primeiro = False
        d = numero(x["Densidade"])
        if d is None:
            continue
        m = mes_iso(x["Ano"], x["Mês"])
        nivel = x["Nível Geográfico Densidade"]
        if nivel == "Brasil":
            brasil[m] = d
            if m > ultimo:
                ultimo = m
        elif nivel == "UF":
            ufs[x["UF"]][m] = d
        elif nivel.startswith("Munic"):
            municipios[x["Código IBGE"]][m] = d
    if not brasil:
        raise ValueError(f"{membro}: sem linha do Brasil com densidade")
    return {
        "ultimo": ultimo,
        "brasil": round(brasil[ultimo], 2),
        "ufs": {uf: round(v[ultimo], 2) for uf, v in sorted(ufs.items()) if ultimo in v},
        "municipios": {cod: round(v[ultimo], 2) for cod, v in sorted(municipios.items()) if ultimo in v},
    }


def _total(z: Zip, membro: str) -> dict:
    serie = {}
    primeiro = True
    for x in z.linhas(membro):
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Ano", "Mês", "Acessos"])
            primeiro = False
        serie[mes_iso(x["Ano"], x["Mês"])] = inteiro(x["Acessos"])
    meses = sorted(serie)
    return {"meses": meses, "acessos": [serie[m] for m in meses]}


# ------------------------------------------------------------------------------------------------ banda larga fixa


def _faixa_velocidade(v: float | None) -> str:
    campo = F.FAIXAS_VELOCIDADE[0][1]
    for limite, nome in F.FAIXAS_VELOCIDADE:
        if v is not None and v >= limite:
            campo = nome
    return campo


def _agregar_fixa(linhas, membro: str) -> tuple[str, dict, dict]:
    """Agrega o mês mais recente do CSV por município e por UF, numa passada só (meses anteriores são descartados)."""
    atual = ""
    mun: dict[str, dict] = {}
    primeiro = True
    for x in linhas:
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Ano", "Mês", "Grupo Econômico", "CNPJ", "UF", "Município", "Código IBGE Município",
                                              "Velocidade", "Meio de Acesso", "Tipo de Pessoa", "Tipo de Produto", "Acessos"])
            primeiro = False
        m = mes_iso(x["Ano"], x["Mês"])
        if m > atual:
            atual, mun = m, {}
        elif m < atual:
            continue
        a = inteiro(x["Acessos"])
        cod = x["Código IBGE Município"]
        d = mun.get(cod)
        if d is None:
            d = mun[cod] = {"nome": x["Município"], "uf": x["UF"], "acessos": 0, "meio": Counter(), "vel": Counter(),
                            "pf": 0, "prest": set(), "grupo": Counter(), "produto": Counter()}
        d["acessos"] += a
        d["meio"][F.MEIOS.get(x["Meio de Acesso"], "outro")] += a
        d["vel"][_faixa_velocidade(numero(x["Velocidade"]))] += a
        if x["Tipo de Pessoa"] == "Pessoa Física":
            d["pf"] += a
        d["prest"].add(x["CNPJ"])
        d["grupo"][x["Grupo Econômico"]] += a
        d["produto"][x["Tipo de Produto"]] += a
    if not mun:
        raise ValueError(f"{membro}: nenhuma linha")
    return atual, mun, _por_uf_fixa(mun)


def _por_uf_fixa(mun: dict) -> dict:
    ufs: dict[str, dict] = {}
    for d in mun.values():
        u = ufs.get(d["uf"])
        if u is None:
            u = ufs[d["uf"]] = {"acessos": 0, "meio": Counter(), "vel": Counter(), "pf": 0, "prest": set(), "grupo": Counter(), "produto": Counter()}
        u["acessos"] += d["acessos"]
        u["meio"].update(d["meio"])
        u["vel"].update(d["vel"])
        u["pf"] += d["pf"]
        u["prest"].update(d["prest"])
        u["grupo"].update(d["grupo"])
        u["produto"].update(d["produto"])
    return ufs


def _linha_fixa(d: dict, grupos: list[str]) -> list:
    maior, n = d["grupo"].most_common(1)[0] if d["grupo"] else (None, 0)
    return [
        d["acessos"], d["meio"].get("fibra", 0), d["meio"].get("coaxial", 0), d["meio"].get("radio", 0), d["meio"].get("satelite", 0),
        d["meio"].get("metalico", 0), d["vel"].get("vel_ate_10", 0), d["vel"].get("vel_10_25", 0), d["vel"].get("vel_25_100", 0),
        d["vel"].get("vel_100_mais", 0), d["pf"], len(d["prest"]), grupos.index(maior) if maior is not None else None, n,
    ]


def _grupos(mun: dict) -> list[str]:
    total = Counter()
    for d in mun.values():
        total.update(d["grupo"])
    return [g for g, _ in total.most_common()]


def coletar_fixa(url: str = F.FIXA["url"], arquivo=None) -> dict:
    z = Zip(url, arquivo)
    anos = sorted(int(m.group(1)) for n in z.membros() if (m := re.fullmatch(r"Acessos_Banda_Larga_Fixa_(\d{4})\.csv", n)))
    if not anos:
        raise ValueError("zip da banda larga fixa sem o CSV anual de acessos")
    membro = F.FIXA["membro_acessos"].format(ano=anos[-1])
    referencia, mun, ufs = _agregar_fixa(z.linhas(membro), membro)
    grupos = _grupos(mun)
    densidade = _densidade(z, F.FIXA["membro_densidade"])
    total = _total(z, F.FIXA["membro_total"])
    brasil = {"acessos": 0, "meio": Counter(), "vel": Counter(), "pf": 0, "prest": set(), "grupo": Counter(), "produto": Counter()}
    for u in ufs.values():
        brasil["acessos"] += u["acessos"]
        for k in ("meio", "vel", "grupo", "produto"):
            brasil[k].update(u[k])
        brasil["pf"] += u["pf"]
        brasil["prest"].update(u["prest"])
    return {
        "fonte": {"orgao": F.ORGAO, "nome": F.FIXA["nome"], "pagina": F.FIXA["pagina"], "licenca": F.LICENCA, "ano_arquivo": anos[-1]},
        "capturado_em": agora_utc(),
        "arquivo": z.identificacao(),
        "referencia": referencia,
        "campos": list(F.CAMPOS_FIXA),
        "grupos": grupos,
        "brasil": {**{k: v for k, v in zip(F.CAMPOS_FIXA, _linha_fixa(brasil, grupos))},
                   "produto": dict(sorted(brasil["produto"].items())), "grupos": [[g, brasil["grupo"][g]] for g in grupos[:10]]},
        "ufs": {uf: _linha_fixa(ufs[uf], grupos) for uf in sorted(ufs)},
        "municipios": {cod: [d["nome"], d["uf"], _linha_fixa(d, grupos)] for cod, d in sorted(mun.items())},
        "total_mensal": total,
        "densidade": densidade,
    }


# ------------------------------------------------------------------------------------------------ telefonia móvel


def _agregar_movel(linhas, membro: str) -> tuple[str, dict, dict]:
    atual = ""
    mun: dict[str, dict] = {}
    primeiro = True
    for x in linhas:
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Ano", "Mês", "Grupo Econômico", "UF", "Município", "Código IBGE Município",
                                              "Modalidade de Cobrança", "Tecnologia Geração", "Tipo de Pessoa", "Tipo de Produto", "Acessos"])
            primeiro = False
        m = mes_iso(x["Ano"], x["Mês"])
        if m > atual:
            atual, mun = m, {}
        elif m < atual:
            continue
        a = inteiro(x["Acessos"])
        cod = x["Código IBGE Município"]
        d = mun.get(cod)
        if d is None:
            d = mun[cod] = {"nome": x["Município"], "uf": x["UF"], "acessos": 0, "ger": Counter(), "pre": 0, "pos": 0, "pf": 0, "m2m": 0, "ps": 0, "grupo": Counter()}
        d["acessos"] += a
        d["ger"][F.GERACOES.get(x["Tecnologia Geração"], "outra")] += a
        mod = x["Modalidade de Cobrança"]
        if mod.startswith("Pr"):
            d["pre"] += a
        elif mod.startswith("P"):
            d["pos"] += a
        if x["Tipo de Pessoa"] == "Pessoa Física":
            d["pf"] += a
        if x["Tipo de Produto"] == "M2M":
            d["m2m"] += a
        elif x["Tipo de Produto"] == "PONTO_DE_SERVICO":
            d["ps"] += a
        d["grupo"][x["Grupo Econômico"]] += a
    if not mun:
        raise ValueError(f"{membro}: nenhuma linha")
    ufs: dict[str, dict] = {}
    for d in mun.values():
        u = ufs.get(d["uf"])
        if u is None:
            u = ufs[d["uf"]] = {"acessos": 0, "ger": Counter(), "pre": 0, "pos": 0, "pf": 0, "m2m": 0, "ps": 0, "grupo": Counter()}
        u["acessos"] += d["acessos"]
        u["ger"].update(d["ger"])
        u["grupo"].update(d["grupo"])
        for k in ("pre", "pos", "pf", "m2m", "ps"):
            u[k] += d[k]
    return atual, mun, ufs


def _linha_movel(d: dict, grupos: list[str]) -> list:
    maior, n = d["grupo"].most_common(1)[0] if d["grupo"] else (None, 0)
    return [d["acessos"], d["ger"].get("g2", 0), d["ger"].get("g3", 0), d["ger"].get("g4", 0), d["ger"].get("g5", 0), d["pre"], d["pos"],
            d["pf"], d["m2m"], d["ps"], grupos.index(maior) if maior is not None else None, n]


def coletar_movel(url: str = F.MOVEL["url"], arquivo=None) -> dict:
    z = Zip(url, arquivo)
    sem = sorted((int(m.group(1)), m.group(2)) for n in z.membros() if (m := re.fullmatch(r"Acessos_Telefonia_Movel_(\d{4})_([12]S)\.csv", n)))
    if not sem:
        raise ValueError("zip da telefonia móvel sem o CSV semestral de acessos")
    membro = F.MOVEL["membro_acessos"].format(ano=sem[-1][0], semestre=sem[-1][1])
    referencia, mun, ufs = _agregar_movel(z.linhas(membro), membro)
    grupos = _grupos(mun)
    densidade = _densidade(z, F.MOVEL["membro_densidade"])
    total = _total(z, F.MOVEL["membro_total"])
    brasil = {"acessos": 0, "ger": Counter(), "pre": 0, "pos": 0, "pf": 0, "m2m": 0, "ps": 0, "grupo": Counter()}
    for u in ufs.values():
        brasil["acessos"] += u["acessos"]
        brasil["ger"].update(u["ger"])
        brasil["grupo"].update(u["grupo"])
        for k in ("pre", "pos", "pf", "m2m", "ps"):
            brasil[k] += u[k]
    return {
        "fonte": {"orgao": F.ORGAO, "nome": F.MOVEL["nome"], "pagina": F.MOVEL["pagina"], "licenca": F.LICENCA, "semestre_arquivo": f"{sem[-1][0]}_{sem[-1][1]}"},
        "capturado_em": agora_utc(),
        "arquivo": z.identificacao(),
        "referencia": referencia,
        "campos": list(F.CAMPOS_MOVEL),
        "grupos": grupos,
        "brasil": {**{k: v for k, v in zip(F.CAMPOS_MOVEL, _linha_movel(brasil, grupos))}, "grupos": [[g, brasil["grupo"][g]] for g in grupos[:10]]},
        "ufs": {uf: _linha_movel(ufs[uf], grupos) for uf in sorted(ufs)},
        "municipios": {cod: [d["nome"], d["uf"], _linha_movel(d, grupos)] for cod, d in sorted(mun.items())},
        "total_mensal": total,
        "densidade": densidade,
    }


# ---------------------------------------------------------------------------------------------- cobertura móvel


def _periodo_iso(p: str) -> str:
    """'09-2026' (arquivos da Anatel) vira '2026-09'."""
    m = re.fullmatch(r"(\d{2})-(\d{4})", p.strip())
    if not m:
        raise ValueError(f"período inesperado: {p!r}")
    return f"{m.group(2)}-{m.group(1)}"


def _pct(v: float | None, unidade: str) -> float | None:
    if v is None:
        return None
    return round(v * 100 if unidade == "fracao" else v, 2)


def _ler_cobertura_trimestre(z: Zip, membro: str, completo: bool) -> dict:
    """Um trimestre: por município, as medidas de cada tecnologia (operadora Todas) e, no trimestre completo, as
    operadoras. Os arquivos de 2026 trazem frações (0 a 1); os de 2021 também; a unidade é detectada pelo máximo."""
    linhas = []
    primeiro = True
    maximo = 0.0
    for x in z.linhas(membro):
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Código Município", "Município", "UF", "Tecnologia", "Operadora", "Período",
                                              "% área coberta", "% moradores cobertos", "% domicilios cobertos", "Área (km2)", "Moradores", "Domicílios"])
            primeiro = False
        cod = x["Código Município"]
        if cod in F.NAO_MUNICIPIOS:
            continue
        op = x["Operadora"]
        if not completo and op != F.OPERADORA_TODAS:
            continue
        vals = (numero(x["% moradores cobertos"]), numero(x["% domicilios cobertos"]), numero(x["% área coberta"]))
        maximo = max(maximo, *[v for v in vals if v is not None])
        linhas.append((cod, x["Município"], x["UF"], x["Tecnologia"], op, _periodo_iso(x["Período"]), vals,
                       numero(x["Área (km2)"]), inteiro(x["Moradores"]), inteiro(x["Domicílios"])))
    if not linhas:
        raise ValueError(f"{membro}: nenhuma linha")
    unidade = "fracao" if maximo <= 1.0001 else "percentual"
    if maximo > 100.0001:
        raise ValueError(f"{membro}: cobertura acima de 100% ({maximo})")
    periodos = {l[5] for l in linhas}
    if len(periodos) != 1:
        raise ValueError(f"{membro}: mais de um período {sorted(periodos)}")
    tec_rotulo = {rot: campo for campo, rot in F.TECNOLOGIAS_COBERTURA}
    mun: dict[str, dict] = {}
    operadoras = set()
    for cod, nome, uf, tec, op, _per, vals, area, mor, dom in linhas:
        d = mun.setdefault(cod, {"nome": nome, "uf": uf, "area": area, "moradores": mor, "domicilios": dom, "tec": {}, "op": {}})
        if op == F.OPERADORA_TODAS and tec in tec_rotulo:
            d["tec"][tec_rotulo[tec]] = [_pct(v, unidade) for v in vals]
        elif op != F.OPERADORA_TODAS and tec in ("4G5G", "Todas"):
            d["op"].setdefault(op, {})[tec] = _pct(vals[0], unidade)
            operadoras.add(op)
    return {"periodo": periodos.pop(), "unidade_arquivo": unidade, "municipios": mun, "operadoras": sorted(operadoras)}


def _evolucao_brasil(z: Zip, membro: str) -> dict:
    """Série nacional por trimestre (operadora Todas, cada tecnologia) e, no último, cada operadora. Valores em %."""
    serie: dict[str, dict] = defaultdict(dict)
    por_operadora: dict[str, dict] = defaultdict(dict)
    pop: dict[str, dict] = {}
    primeiro = True
    tec_rotulo = {rot: campo for campo, rot in F.TECNOLOGIAS_COBERTURA}
    for x in z.linhas(membro):
        if primeiro:
            exigir_colunas(membro, x.keys(), ["Período", "Operadora", "Tecnologia", "% área coberta", "% moradores cobertos",
                                              "% domicilios cobertos", "Moradores", "Domicílios", "Ano Censo"])
            primeiro = False
        p = _periodo_iso(x["Período"])
        vals = [numero(x["% moradores cobertos"]), numero(x["% domicilios cobertos"]), numero(x["% área coberta"])]
        if any(v is not None and v > 100.0001 for v in vals):
            raise ValueError(f"{membro}: cobertura acima de 100%")
        if x["Tecnologia"] in tec_rotulo:
            if x["Operadora"] == F.OPERADORA_TODAS:
                serie[p][tec_rotulo[x["Tecnologia"]]] = [None if v is None else round(v, 2) for v in vals]
                pop[p] = {"moradores": inteiro(x["Moradores"]), "domicilios": inteiro(x["Domicílios"]), "censo": inteiro(x["Ano Censo"])}
            elif x["Tecnologia"] in ("4G5G", "Todas"):
                por_operadora[p].setdefault(x["Operadora"], {})[tec_rotulo[x["Tecnologia"]]] = None if vals[0] is None else round(vals[0], 2)
    if not serie:
        raise ValueError(f"{membro}: sem linhas da operadora Todas")
    ultimo = max(serie)
    return {"trimestres": sorted(serie), "serie": {p: serie[p] for p in sorted(serie)}, "populacao": {p: pop[p] for p in sorted(pop)},
            "ultimo": ultimo, "operadoras_ultimo": dict(sorted(por_operadora[ultimo].items()))}


def coletar_cobertura(url: str = F.COBERTURA["url"], arquivo=None) -> dict:
    z = Zip(url, arquivo)
    membros = sorted((m.group(1), m.group(2), n) for n in z.membros() if (m := re.fullmatch(r"Cobertura_(\d{4})_(\d{2})_Municipios\.csv", n)))
    if not membros:
        raise ValueError("zip da cobertura sem os CSV municipais por trimestre")
    brasil = _evolucao_brasil(z, F.COBERTURA["membro_brasil"])
    trimestres = []
    serie_g4: dict[str, list] = defaultdict(list)
    serie_g5: dict[str, list] = defaultdict(list)
    ultimo = None
    # cada trimestre é lido uma vez: dos anteriores fica só a parte dos moradores coberta por 4G e por 5G (a série);
    # do mais recente, tudo (tecnologias, medidas e operadoras)
    for i, (_ano, _mes, membro) in enumerate(membros):
        completo = i == len(membros) - 1
        t = _ler_cobertura_trimestre(z, membro, completo)
        trimestres.append(t["periodo"])
        for cod, d in t["municipios"].items():
            serie_g4[cod].append((d["tec"].get("g4") or [None])[0])
            serie_g5[cod].append((d["tec"].get("g5") or [None])[0])
        for cod in set(serie_g4) - set(t["municipios"]):
            serie_g4[cod].append(None)
            serie_g5[cod].append(None)
        if completo:
            ultimo = t
    if ultimo is None:
        raise ValueError("sem trimestre completo")
    n = len(trimestres)
    for cod in ultimo["municipios"]:
        # município que só aparece em trimestres recentes: ausência (null) nos anteriores
        serie_g4[cod] = [None] * (n - len(serie_g4[cod])) + serie_g4[cod]
        serie_g5[cod] = [None] * (n - len(serie_g5[cod])) + serie_g5[cod]
    mun_out = {}
    for cod, d in sorted(ultimo["municipios"].items()):
        mun_out[cod] = [d["nome"], d["uf"], d["moradores"], d["domicilios"], None if d["area"] is None else round(d["area"], 3),
                        {campo: d["tec"].get(campo) for campo, _ in F.TECNOLOGIAS_COBERTURA},
                        {op: [v.get("4G5G"), v.get("Todas")] for op, v in sorted(d["op"].items())},
                        serie_g4[cod], serie_g5[cod]]
    return {
        "fonte": {"orgao": F.ORGAO, "nome": F.COBERTURA["nome"], "pagina": F.COBERTURA["pagina"], "licenca": F.LICENCA},
        "capturado_em": agora_utc(),
        "arquivo": z.identificacao(),
        "referencia": ultimo["periodo"],
        "unidade_arquivo": ultimo["unidade_arquivo"],
        "trimestres": trimestres,
        "tecnologias": [campo for campo, _ in F.TECNOLOGIAS_COBERTURA],
        "medidas": list(F.MEDIDAS_COBERTURA),
        "operadoras": ultimo["operadoras"],
        "campos_municipio": ["nome", "uf", "moradores", "domicilios", "area_km2", "tecnologias", "operadoras", "serie_g4_moradores", "serie_g5_moradores"],
        "brasil": brasil,
        "municipios": mun_out,
    }

