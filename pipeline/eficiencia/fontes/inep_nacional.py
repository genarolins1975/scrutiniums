"""Referências nacionais oficiais do INEP, com o universo declarado pela própria fonte.

* Média de alunos por turma (ATU), Brasil, rede municipal, todas as localizações.
* Taxa de aprovação, Brasil, rede municipal, todas as localizações.
* Ideb, Saeb, rendimento (P) e nota padronizada (N), Brasil, rede municipal.
* Investimento público direto por estudante (INEP, consolidado de União, estados, DF e municípios),
  todas as redes públicas, 2000 a 2021: referência de OUTRO UNIVERSO, nunca comparação direta com a
  despesa por matrícula da rede municipal de uma capital.

Nada é recalculado: o valor é o da linha e da coluna da publicação, e a linha é identificada na
observação. O Ideb nacional não é a média dos Idebs municipais, e a ATU e a aprovação nacionais não são
a média das capitais.

Os pacotes (.zip) devem estar numa pasta com o nome original do INEP; a coleta confere o MD5 publicado
no pacote, registra o sha256 do .zip e grava um único recorte no seed.
"""
import os
import tempfile
import zipfile

from pipeline.eficiencia import base
from pipeline.eficiencia.fontes import inep_indicadores as II, xlsx

PAGINA_INDICADORES = II.PAGINA_INDICADORES
PAGINA_IDEB = II.PAGINA_IDEB
PAGINA_FINANCEIROS = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-financeiros-educacionais"
BASE_URL = "https://download.inep.gov.br"
ANOS = list(range(2021, 2026))

ATU_ETAPAS = {"creche": "CRE_CAT_0", "pre_escola": "PRE_CAT_0", "anos_iniciais": "FUN_AI_CAT_0", "anos_finais": "FUN_AF_CAT_0"}
REND_ETAPAS = {"anos_iniciais": "1_CAT_FUN_AI", "anos_finais": "1_CAT_FUN_AF"}
EDICOES_IDEB = list(range(2005, 2026, 2))
CAMPOS_IDEB = (("ideb", "VL_OBSERVADO_{a}"), ("p_rendimento", "VL_INDICADOR_REND_{a}"),
               ("n_nota_padronizada", "VL_NOTA_MEDIA_{a}"), ("matematica", "VL_NOTA_MATEMATICA_{a}"),
               ("portugues", "VL_NOTA_PORTUGUES_{a}"))
ABAS_IDEB = {"anos_iniciais": "Brasil (Anos Iniciais)", "anos_finais": "Brasil (Anos Finais)"}
NIVEIS_FINANCEIRO = {1: "todos", 2: "educacao_basica", 3: "educacao_infantil", 4: "fundamental_anos_iniciais",
                     5: "fundamental_anos_finais", 6: "ensino_medio", 7: "educacao_superior"}


def _abre(caminho_zip, preferida):
    """Planilha do pacote cujo MD5 confere com o publicado; devolve (membro, conferencia, caminho extraído, tmp)."""
    zf = zipfile.ZipFile(caminho_zip)
    planilhas = [n for n in zf.namelist() if n.lower().endswith(".xlsx") and not os.path.basename(n).startswith("~$")]
    conferencia, escolhida = [], None
    for n in planilhas + [n for n in zf.namelist() if n.lower().endswith(".ods")]:
        pub = II._md5_publicado(zf, n)
        calc = base.md5_arquivo_membro(zf, n)
        conferencia.append({"membro": n, "md5_publicado_inep": pub, "md5_calculado": calc, "confere": None if pub is None else pub == calc})
    # preferência pelo .xlsx; o .ods entra quando só ele confere com o MD5 publicado (caso da ATU 2022)
    for c in sorted(conferencia, key=lambda c: not c["membro"].lower().endswith(".xlsx")):
        if c["confere"] is not False:
            escolhida = c
            break
    if escolhida is None:
        raise ValueError(f"{caminho_zip}: nenhuma planilha confere com o MD5 publicado")
    return zf, escolhida, conferencia


def _captura(chave, caminho_zip, url, conjunto, pagina, membro, escolhida, conferencia, parametros, publicado_em, capturado_em):
    base.registra_captura(chave, {
        "instituicao": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)",
        "conjunto": conjunto, "pagina": pagina, "url": url, "membro": membro, "capturado_em": capturado_em,
        "publicado_em": publicado_em, "sha256_original": base.sha256_arquivo(caminho_zip),
        "bytes_original": os.path.getsize(caminho_zip), "md5_publicado_inep": escolhida["md5_publicado_inep"],
        "md5_conferido": escolhida["md5_calculado"], "conferencia_integridade": conferencia, "parametros": parametros,
    })


def _linhas_xlsx(zf, membro, aba=None):
    with tempfile.TemporaryDirectory() as tmp:
        caminho = zf.extract(membro, tmp)
        if membro.lower().endswith(".ods"):
            return list(II.ods.linhas(caminho))
        return list(xlsx.linhas(caminho, aba))


def _numero(v):
    """Número da célula ou None com o código original ('--', texto)."""
    if isinstance(v, (int, float)):
        return float(v), None
    t = str(v).strip() if v is not None else ""
    try:
        return float(t), None
    except ValueError:
        return None, t or "célula vazia"


def _brasil_municipal(todas, colunas, unidade_col="UNIDGEO"):
    """Linha Brasil, categoria Total, dependência Municipal, a partir da linha de códigos de coluna do INEP."""
    i_cab = II._linha_codigos(todas, unidade_col)
    cab = [(II._texto(c) or f"COL_{j}") for j, c in enumerate(todas[i_cab])]
    ix = {c: j for j, c in enumerate(cab)}
    for r in todas[i_cab + 1:]:
        if len(r) > ix["NO_DEPENDENCIA"] and r[ix[unidade_col]] == "Brasil" and r[ix["NO_CATEGORIA"]] == "Total" \
                and str(r[ix["NO_DEPENDENCIA"]]).strip() == "Municipal":
            return {c: _numero(r[ix[c]] if ix[c] < len(r) else None) for c in colunas}, ix
    raise ValueError("linha Brasil / Total / Municipal não encontrada")


def extrai(pasta, capturado_em=None):
    """Lê os pacotes nacionais da pasta, grava o recorte no seed e registra as capturas."""
    capturado_em = capturado_em or base.agora_utc()
    registros = []

    for tipo, modelo_zip, modelo_url, colunas, rotulo in (
        ("atu", "ATU_{ano}_BRASIL_REGIOES_UFS.zip", "informacoes_estatisticas/indicadores_educacionais/{ano}/ATU_{ano}_BRASIL_REGIOES_UFS.zip",
         ATU_ETAPAS, "Média de Alunos por Turma, Brasil, regiões e UFs"),
        ("rendimento", "tx_rend_brasil_regioes_ufs_{ano}.zip", "informacoes_estatisticas/indicadores_educacionais/{ano}/tx_rend_brasil_regioes_ufs_{ano}.zip",
         REND_ETAPAS, "Taxas de Rendimento Escolar, Brasil, regiões e UFs"),
    ):
        for ano in ANOS:
            cz = os.path.join(pasta, modelo_zip.format(ano=ano))
            zf, esc, conf = _abre(cz, ".xlsx")
            vals, _ = _brasil_municipal(_linhas_xlsx(zf, esc["membro"]), list(colunas.values()))
            for etapa, col in colunas.items():
                v, codigo = vals[col]
                registros.append({"tipo": tipo, "ano": ano, "etapa": etapa, "componente": None, "valor": v, "codigo": codigo,
                                  "coluna": col, "captura": f"inep_{tipo}_brasil_{ano}",
                                  "registro": f"INEP, {rotulo} {ano}, UNIDGEO = Brasil, NO_CATEGORIA = Total, NO_DEPENDENCIA = Municipal, coluna {col}"})
            _captura(f"inep_{tipo}_brasil_{ano}", cz, f"{BASE_URL}/" + modelo_url.format(ano=ano), f"{rotulo}, {ano}", PAGINA_INDICADORES,
                     esc["membro"], esc, conf, "só a linha Brasil, categoria Total, dependência Municipal", "%04d-%02d-%02d" % zf.getinfo(esc["membro"]).date_time[:3],
                     capturado_em)

    cz = os.path.join(pasta, "divulgacao_brasil_ideb_2025.zip")
    zf, esc, conf = _abre(cz, ".xlsx")
    with tempfile.TemporaryDirectory() as tmp:
        caminho = zf.extract(esc["membro"], tmp)
        for etapa, aba in ABAS_IDEB.items():
            todas = list(xlsx.linhas(caminho, aba))
            i_cab = II._linha_codigos(todas, "VL_OBSERVADO_2025")
            cab = [(II._texto(c) or f"COL_{j}") for j, c in enumerate(todas[i_cab])]
            linha = next(r for r in todas[i_cab + 1:] if len(r) > 1 and r[0] == "Brasil" and r[1] == "Municipal")
            for ed in EDICOES_IDEB:
                for comp, modelo in CAMPOS_IDEB:
                    col = modelo.format(a=ed)
                    if col not in cab:
                        continue
                    v, codigo = _numero(linha[cab.index(col)] if cab.index(col) < len(linha) else None)
                    registros.append({"tipo": "ideb", "ano": ed, "etapa": etapa, "componente": comp, "valor": v, "codigo": codigo,
                                      "coluna": col, "captura": "inep_ideb_brasil_2025",
                                      "registro": f"INEP, Ideb 2025, Brasil, {aba}, rede Municipal, coluna {col}"})
    _captura("inep_ideb_brasil_2025", cz, f"{BASE_URL}/ideb/resultados/divulgacao_brasil_ideb_2025.zip", "Ideb 2025: resultados do Brasil por rede (série 2005 a 2025)",
             PAGINA_IDEB, esc["membro"], esc, conf, "só a linha Brasil, rede Municipal, anos iniciais e anos finais", "%04d-%02d-%02d" % zf.getinfo(esc["membro"]).date_time[:3],
             capturado_em)

    for modo, arq in (("real", "Investimento_estudante_valor_real.zip"), ("nominal", "Investimento_estudante_valor_nominal.zip")):
        cz = os.path.join(pasta, arq)
        zf, esc, conf = _abre(cz, ".xlsx")
        nomes = zf.namelist()
        todas = _linhas_xlsx(zf, esc["membro"], "Aluno_real" if modo == "real" else None)
        notas = []
        for r in todas:
            if r and isinstance(r[0], str) and r[0].startswith("Notas"):
                notas = [" ".join(l.split()) for l in r[0].split("\n")[1:] if l.strip()]
        for r in todas:
            if len(r) >= 8 and isinstance(r[0], float) and 2000 <= r[0] <= 2021:
                for pos, nivel in NIVEIS_FINANCEIRO.items():
                    v = r[pos] if pos < len(r) else None
                    if nivel == "fundamental_anos_iniciais":
                        v = r[4] if len(r) > 4 else None
                    registros.append({"tipo": "investimento_estudante", "ano": int(r[0]), "etapa": nivel, "componente": modo,
                                      "valor": float(v) if isinstance(v, (int, float)) else None, "codigo": None, "coluna": f"col{pos}",
                                      "captura": f"inep_investimento_estudante_{modo}",
                                      "registro": f"INEP, Investimento público direto por estudante, valores {'reais (IPCA, 2021)' if modo == 'real' else 'nominais'}, Brasil, ano {int(r[0])}, nível {nivel}"})
        _captura(f"inep_investimento_estudante_{modo}", cz,
                 f"{BASE_URL}/informacoes_estatisticas/investimentos_publicos_em_educacao/indicadores_financeiros_educacionais/{arq}",
                 f"Investimento público direto por estudante, valores {'reais' if modo == 'real' else 'nominais'}, Brasil, 2000 a 2021",
                 PAGINA_FINANCEIROS, esc["membro"], esc, conf, "série nacional completa (consolidado de União, estados, DF e municípios)",
                 "%04d-%02d-%02d" % zf.getinfo(esc["membro"]).date_time[:3], capturado_em)
        m = base.le_manifesto()["capturas"][f"inep_investimento_estudante_{modo}"]
        m["notas_da_fonte"] = notas
        base.registra_captura(f"inep_investimento_estudante_{modo}", m)
        del nomes

    destino = os.path.join(base.SEED, "inep_nacional", "referencias_nacionais.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura("inep_nacional", {
        "instituicao": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)",
        "conjunto": "Referências nacionais oficiais: ATU, aprovação e Ideb da rede municipal do Brasil; investimento público direto por estudante",
        "pagina": PAGINA_INDICADORES, "url": PAGINA_INDICADORES, "capturado_em": capturado_em,
        "parametros": "recorte único com as linhas nacionais lidas dos pacotes inep_*_brasil_* e inep_investimento_estudante_*",
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(registros),
    })
    return len(registros)
