"""Sinopse Estatística da Educação Básica (INEP): conferência independente.

A Sinopse é a publicação tabular oficial do Censo Escolar. O painel não usa a
Sinopse como fonte dos números: ela serve para conferir, capital por capital,
as somas feitas a partir dos microdados (validacoes.py). Por isso o seed guarda
apenas as linhas das capitais e o cabeçalho das tabelas usadas.
https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica
"""
import os
import re
import tempfile
import zipfile

from pipeline.eficiencia import base, entes
from pipeline.eficiencia.fontes import xlsx

PAGINA = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica"
URL = {
    2021: "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopses_estatisticas_censo_escolar_2021.zip",
    2024: "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_2024.zip",
    2025: "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_2025.zip",
}

# Tabelas procuradas pelo título (a numeração muda entre edições).
# A tabela de matrículas em escolas privadas conveniadas existe a partir da edição 2025.
TABELAS = {
    "total": r"Matrículas da Educação Básica, por Localização(,| e) Dependência Administrativa",
    "conveniadas": r"Rede Privada em estabelecimentos conveniados",
    "creche": r"Creche( Regular)?, por Localização(,| e) Dependência Administrativa",
    "pre_escola": r"Pré-Escola( Regular)?, por Localização(,| e) Dependência Administrativa",
}


def _titulo(caminho, aba):
    for i, r in enumerate(xlsx.linhas(caminho, aba)):
        if i > 6:
            return ""
        for c in r:
            if isinstance(c, str) and re.match(r"\s*\d+\.\d+\s*[–-]", c):
                return " ".join(c.split())
    return ""


def extrai(ano, caminho_zip, url=None, capturado_em=None):
    capturado_em = capturado_em or base.agora_utc()
    url = url or URL[ano]
    sha_zip = base.sha256_arquivo(caminho_zip)
    codigos = {float(c) for c in entes.codigos_capitais()} | {float(entes.DISTRITO_FEDERAL[0])}
    with zipfile.ZipFile(caminho_zip) as zf:
        membro = next(n for n in zf.namelist() if n.lower().endswith(".xlsx"))
        txt_md5 = next((zf.read(n).decode("latin1") for n in zf.namelist() if "md5" in n.lower()), "")
        m = re.search(r"([0-9a-fA-F]{32})\s+\*?[^\r\n]*\.xlsx", txt_md5)
        md5_pub = m.group(1).lower() if m else None
        md5_calc = base.md5_arquivo_membro(zf, membro)
        data_pub = "%04d-%02d-%02d" % zf.getinfo(membro).date_time[:3]
        with tempfile.TemporaryDirectory() as tmp:
            caminho = zf.extract(membro, tmp)
            abas = [a for a in xlsx.nomes_abas(caminho) if re.search(r"(^|\s)1\.\d+$", a)]
            saida = {}
            for chave, padrao in TABELAS.items():
                for aba in abas:
                    t = _titulo(caminho, aba)
                    if re.search(padrao, t):
                        cab, linhas = [], []
                        for i, r in enumerate(xlsx.linhas(caminho, aba)):
                            if 4 <= i <= 12 and not (len(r) > 3 and isinstance(r[3], float)):
                                cab.append(r)
                            if len(r) > 3 and r[3] in codigos:
                                linhas.append(r)
                        saida[chave] = {"aba": aba, "titulo": t, "cabecalho": cab, "linhas": linhas}
                        break
    destino = os.path.join(base.SEED, "inep_sinopse", f"sinopse_capitais_{ano}.json.gz")
    sha = base.grava_json_gz(destino, saida)
    base.registra_captura(f"inep_sinopse_{ano}", {
        "instituicao": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)",
        "conjunto": f"Sinopse Estatística da Educação Básica {ano}",
        "pagina": PAGINA, "url": url, "membro": membro, "capturado_em": capturado_em,
        "publicado_em": data_pub, "sha256_original": sha_zip, "bytes_original": os.path.getsize(caminho_zip),
        "md5_publicado_inep": md5_pub, "md5_conferido": md5_calc,
        "parametros": "tabelas de matrículas por dependência administrativa (total, creche, pré-escola) e de "
                      "matrículas em escolas privadas conveniadas; linhas das capitais e do DF",
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha,
        "tabelas": {k: {"aba": v["aba"], "titulo": v["titulo"], "linhas": len(v["linhas"])} for k, v in saida.items()},
    })
    return {k: (v["aba"], len(v["linhas"])) for k, v in saida.items()}
