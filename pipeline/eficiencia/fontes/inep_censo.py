"""Censo Escolar da Educação Básica (INEP): recorte das capitais.

Fonte: microdados do Censo Escolar, arquivo de escolas (uma linha por escola,
com quantidades de matrículas por etapa e modalidade).
https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar

A coleta:
1. baixa o .zip oficial (ou usa um já baixado, informado em --origem);
2. confere o MD5 publicado pelo INEP dentro do próprio pacote;
3. registra sha256 e tamanho do .zip no manifesto do seed;
4. grava no seed somente as escolas localizadas nas capitais e no DF, com as
   colunas usadas pelo painel, sem nenhuma agregação.

A agregação por rede e etapa acontece depois, em padroniza.py, sobre o seed:
quem audita refaz a soma a partir das linhas de escola.
"""
import csv
import io
import os
import re
import zipfile

from pipeline.eficiencia import base, entes

URL = "https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_{ano}{sufixo}.zip"
# 2025: o INEP publicou o pacote com sufixo "_" no nome (página oficial, consulta de 08/10/2026)
SUFIXO = {2025: "_"}
PAGINA = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar"

COLUNAS = [
    "NU_ANO_CENSO", "CO_MUNICIPIO", "CO_ENTIDADE", "NO_ENTIDADE", "TP_DEPENDENCIA",
    "TP_LOCALIZACAO", "TP_SITUACAO_FUNCIONAMENTO", "TP_CATEGORIA_ESCOLA_PRIVADA",
    "IN_PODER_PUBLICO_PARCERIA", "TP_PODER_PUBLICO_PARCERIA",
    "QT_MAT_BAS", "QT_MAT_INF", "QT_MAT_INF_CRE", "QT_MAT_INF_PRE",
    "QT_MAT_FUND", "QT_MAT_FUND_AI", "QT_MAT_FUND_AF", "QT_MAT_MED", "QT_MAT_PROF",
    "QT_MAT_EJA", "QT_MAT_EJA_FUND", "QT_MAT_EJA_MED", "QT_MAT_ESP", "QT_MAT_ESP_CC", "QT_MAT_ESP_CE",
]
# Até 2021 as variáveis de parceria tinham outro nome (dicionário de dados do INEP, 2023:
# "Entre 2007 e 2021 a variável TP_CONVENIO_PODER_PUBLICO foi renomeada para TP_PODER_PUBLICO_PARCERIA").
RENOMEADAS = {
    "IN_PODER_PUBLICO_PARCERIA": ["IN_CONVENIADA_PP"],
    "TP_PODER_PUBLICO_PARCERIA": ["TP_CONVENIO_PODER_PUBLICO"],
}


def _nome_legivel(n):
    """Nomes de membro gravados sem a marca UTF-8 do zip: o INEP usa a página de código 850."""
    try:
        return n.encode("cp437").decode("cp850")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return n


def _membro(zf, padrao):
    for n in zf.namelist():
        if re.search(padrao, n):
            return n
    raise FileNotFoundError(padrao)


# A partir de 2025 o INEP passou a publicar tabelas separadas (escola, matrícula,
# turma, docente, gestor); as quantidades de matrícula por escola estão na
# Tabela_Matricula, que traz também dependência e parceria com o poder público.
# A situação de funcionamento fica só na Tabela_Escola e não é usada nas somas.
LAYOUT = {
    "unico": {"membro": r"microdados_ed_basica_{ano}\.csv$", "md5": r"microdados_ed_basica_{ano}\.csv"},
    "tabelas": {"membro": r"Tabela_Matricula_{ano}_V\d+\.csv$", "md5": r"Tabela_Matricula_{ano}_v\d+\.csv"},
}
OPCIONAIS = {"TP_SITUACAO_FUNCIONAMENTO"}


def _layout(ano):
    return LAYOUT["tabelas"] if ano >= 2025 else LAYOUT["unico"]


def extrai(ano, caminho_zip, url=None, capturado_em=None):
    capturado_em = capturado_em or base.agora_utc()
    url = url or URL.format(ano=ano, sufixo=SUFIXO.get(ano, ""))
    sha_zip = base.sha256_arquivo(caminho_zip)
    codigos = {str(c) for c in entes.codigos_capitais()} | {str(entes.DISTRITO_FEDERAL[0])}
    lay = _layout(ano)
    with zipfile.ZipFile(caminho_zip) as zf:
        membro = _membro(zf, lay["membro"].format(ano=ano))
        md5_publicado = None
        try:
            txt = zf.read(_membro(zf, rf"md5_microdados_ed_basica_{ano}\.txt$")).decode("latin1")
            # o INEP alterna maiúsculas e minúsculas no hash e no nome do arquivo entre edições
            m = re.search(r"([0-9a-fA-F]{32})\s+\*?" + lay["md5"].format(ano=ano), txt, re.IGNORECASE)
            md5_publicado = m.group(1).lower() if m else None
        except FileNotFoundError:
            pass
        md5_calculado = base.md5_arquivo_membro(zf, membro)
        if md5_publicado and md5_publicado != md5_calculado:
            raise ValueError(f"Censo {ano}: MD5 do CSV ({md5_calculado}) difere do publicado ({md5_publicado})")
        info = zf.getinfo(membro)
        with zf.open(membro) as bruto:
            leitor = csv.reader(io.TextIOWrapper(bruto, encoding="latin1", newline=""), delimiter=";")
            cab = next(leitor)
            idx = {}
            for col in COLUNAS:
                nomes = [col] + RENOMEADAS.get(col, [])
                achado = next((cab.index(n) for n in nomes if n in cab), None)
                if achado is None:
                    if col in OPCIONAIS:
                        continue
                    raise KeyError(f"Censo {ano}: coluna {col} ausente")
                idx[col] = achado
            i_mun = idx["CO_MUNICIPIO"]
            linhas = []
            total_escolas = 0
            for r in leitor:
                total_escolas += 1
                if r[i_mun] not in codigos:
                    continue
                linhas.append({c: (r[idx[c]] if c in idx else "") for c in COLUNAS})
    linhas.sort(key=lambda l: (int(l["CO_MUNICIPIO"]), int(l["CO_ENTIDADE"])))
    destino = os.path.join(base.SEED, "inep_censo", f"escolas_capitais_{ano}.csv.gz")
    sha_recorte = base.grava_csv_gz(destino, COLUNAS, linhas)
    base.registra_captura(f"inep_censo_{ano}", {
        "instituicao": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)",
        "conjunto": f"Microdados do Censo Escolar da Educação Básica {ano}",
        "pagina": PAGINA,
        "url": url,
        "membro": _nome_legivel(membro),
        "capturado_em": capturado_em,
        "publicado_em": "%04d-%02d-%02d" % info.date_time[:3],
        "sha256_original": sha_zip,
        "bytes_original": os.path.getsize(caminho_zip),
        "md5_publicado_inep": md5_publicado,
        "md5_conferido": md5_calculado,
        "escolas_no_arquivo": total_escolas,
        "parametros": "escolas com CO_MUNICIPIO entre as 26 capitais e o DF; colunas: " + ", ".join(COLUNAS),
        "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha_recorte,
        "linhas_recorte": len(linhas),
        "periodo_referencia": f"{ano} (data de referência do Censo: última quarta-feira de maio)",
        "observacao": ("situação de funcionamento não consta da Tabela_Matricula; coluna vazia no recorte"
                       if ano >= 2025 else None),
    })
    return len(linhas), total_escolas
