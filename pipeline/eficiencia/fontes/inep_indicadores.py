"""Indicadores educacionais oficiais do INEP por município: recorte das capitais.

* Média de alunos por turma (ATU)
* Taxas de rendimento (aprovação, reprovação e abandono)
* Ideb (anos iniciais e anos finais do ensino fundamental)

Todos são publicados pelo INEP em .xlsx dentro de um .zip, com uma linha por
município, localização e dependência administrativa (Ideb: por município e
rede). A coleta confere o MD5 publicado no pacote quando existe, registra o
sha256 do .zip e grava no seed só as linhas das capitais e do DF, com os
códigos de coluna do próprio INEP. Nenhum valor é transformado aqui: o texto
"--" e as células vazias seguem como estão, e o significado de cada um é
tratado em padroniza.py.
"""
import os
import re
import tempfile
import zipfile

from pipeline.eficiencia import base, entes
from pipeline.eficiencia.fontes import ods, xlsx

PAGINA_INDICADORES = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais"
PAGINA_IDEB = "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados"

FONTES = {
    "atu": {
        "url": "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/{ano}/ATU_{ano}_MUNICIPIOS.zip",
        "conjunto": "Média de Alunos por Turma, municípios, {ano}",
        "pagina": PAGINA_INDICADORES,
    },
    "rendimento": {
        "url": "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/{ano}/tx_rend_municipios_{ano}.zip",
        "conjunto": "Taxas de Rendimento Escolar, municípios, {ano}",
        "pagina": PAGINA_INDICADORES,
    },
    "ideb_ai": {
        "url": "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_municipios_{ano}.zip",
        "conjunto": "Ideb {ano}: resultados por município, anos iniciais do ensino fundamental",
        "pagina": PAGINA_IDEB,
    },
    "ideb_af": {
        "url": "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_municipios_{ano}.zip",
        "conjunto": "Ideb {ano}: resultados por município, anos finais do ensino fundamental",
        "pagina": PAGINA_IDEB,
    },
}


def _md5_publicado(zf, nome_xlsx):
    for n in zf.namelist():
        if n.lower().endswith(".txt") and "md5" in n.lower():
            txt = zf.read(n).decode("latin1")
            # o INEP alterna maiúsculas e minúsculas no hash entre edições
            m = re.search(r"([0-9a-fA-F]{32})\s+\*?" + re.escape(os.path.basename(nome_xlsx)), txt)
            if m:
                return m.group(1).lower()
    return None


def _linha_codigos(linhas, marcador):
    """Índice da linha de cabeçalho com os códigos de coluna do INEP."""
    for i, r in enumerate(linhas):
        if r and any(isinstance(c, str) and c.strip() == marcador for c in r):
            return i
    raise ValueError(f"cabeçalho com {marcador} não encontrado")


def _texto(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() and abs(v) >= 1000 else repr(v)
    return str(v).strip()


def extrai(tipo, ano, caminho_zip, url=None, capturado_em=None):
    cfg = FONTES[tipo]
    capturado_em = capturado_em or base.agora_utc()
    url = url or cfg["url"].format(ano=ano)
    sha_zip = base.sha256_arquivo(caminho_zip)
    codigos = {float(c) for c in entes.codigos_capitais()} | {float(entes.DISTRITO_FEDERAL[0])}
    with zipfile.ZipFile(caminho_zip) as zf:
        planilhas = [n for n in zf.namelist()
                     if n.lower().endswith((".xlsx", ".ods")) and not os.path.basename(n).startswith("~$")]
        if not planilhas:
            raise ValueError(f"{tipo} {ano}: pacote sem planilha")
        # Integridade: lê a planilha cujo MD5 confere com o publicado no pacote.
        # Preferência pelo .xlsx; o .ods entra quando só ele confere.
        conferencia = []
        for n in sorted(planilhas, key=lambda n: (not n.lower().endswith(".xlsx"), n)):
            pub = _md5_publicado(zf, n)
            calc = base.md5_arquivo_membro(zf, n)
            conferencia.append({"membro": n, "md5_publicado_inep": pub, "md5_calculado": calc,
                                "confere": None if pub is None else pub == calc})
        com_md5 = [c for c in conferencia if c["md5_publicado_inep"]]
        if com_md5:
            validas = [c for c in com_md5 if c["confere"]]
            if not validas:
                raise ValueError(f"{tipo} {ano}: nenhuma planilha confere com o MD5 publicado")
            escolhida = validas[0]
        else:
            escolhida = conferencia[0]
        membro = escolhida["membro"]
        data_pub = "%04d-%02d-%02d" % zf.getinfo(membro).date_time[:3]
        with tempfile.TemporaryDirectory() as tmp:
            caminho = zf.extract(membro, tmp)
            leitor = ods.linhas if membro.lower().endswith(".ods") else xlsx.linhas
            todas = list(leitor(caminho))
    marcador = "CO_MUNICIPIO"
    i_cab = _linha_codigos(todas, marcador)
    cab = [(_texto(c) or f"COL_{j}") for j, c in enumerate(todas[i_cab])]
    # rótulos legíveis das linhas acima dos códigos (para o dicionário do recorte)
    rotulos = {}
    for j in range(len(cab)):
        partes = []
        for r in todas[max(0, i_cab - 3):i_cab]:
            if j < len(r) and isinstance(r[j], str) and r[j].strip():
                partes.append(" ".join(r[j].split()))
        rotulos[cab[j]] = " / ".join(partes)
    i_mun = cab.index(marcador)
    linhas = []
    notas = []
    for r in todas[i_cab + 1:]:
        if not r:
            continue
        if i_mun < len(r) and isinstance(r[i_mun], float) and r[i_mun] in codigos:
            linhas.append({cab[j]: _texto(r[j]) if j < len(r) else "" for j in range(len(cab))})
        elif r and isinstance(r[0], str) and r[0].strip() and not isinstance(r[i_mun] if i_mun < len(r) else None, float):
            notas.append(" ".join(r[0].split()))
    destino = os.path.join(base.SEED, f"inep_{tipo}", f"{tipo}_capitais_{ano}.csv.gz")
    sha_rec = base.grava_csv_gz(destino, cab, linhas)
    base.registra_captura(f"inep_{tipo}_{ano}", {
        "instituicao": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)",
        "conjunto": cfg["conjunto"].format(ano=ano),
        "pagina": cfg["pagina"],
        "url": url,
        "membro": membro,
        "capturado_em": capturado_em,
        "publicado_em": data_pub,
        "sha256_original": sha_zip,
        "bytes_original": os.path.getsize(caminho_zip),
        "md5_publicado_inep": escolhida["md5_publicado_inep"],
        "md5_conferido": escolhida["md5_calculado"],
        "conferencia_integridade": conferencia,
        "parametros": "linhas com CO_MUNICIPIO entre as 26 capitais e o DF; todas as colunas",
        "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha_rec,
        "linhas_recorte": len(linhas),
        "rotulos_colunas": rotulos,
        "notas_da_fonte": notas,
    })
    return len(linhas)
