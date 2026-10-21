"""Leitor do PASI (Portal de Acompanhamento e Informações dos Sistemas Isolados, EPE).

O PASI tem uma seção pública de downloads (https://pasi.epe.gov.br/Downloads). A opção
"Localização Geográfica" é exportada por GET, sem autenticação, em XLSX
(/Downloads/ExportarDadosLocalizacaoLocalidades?codCicloColeta=<ciclo>), com uma linha
por localidade isolada no ciclo de planejamento: UF, município, distribuidora,
previsão de interligação ao SIN, previsão de interconexão, programa de
universalização (Luz para Todos ou Mais Luz para a Amazônia), sigla, nome,
coordenadas e população. As demais opções (mercado, curvas de carga) exigem um
token de formulário da sessão e não são usadas pelo módulo.

Ciclos conhecidos em 30/09/2026 (lista publicada na própria página de downloads):
código 6 = ciclo 2023, 8 = ciclo 2024, 9 = ciclo 2025.
"""
import re

URL_PASI = "https://pasi.epe.gov.br"
URL_DOWNLOADS = URL_PASI + "/Downloads"
URL_LOCALIZACAO = URL_PASI + "/Downloads/ExportarDadosLocalizacaoLocalidades?codCicloColeta={cod}&codUF=&codDistribuidora=&codLocalidade="
COLUNAS = ("Ciclo", "UF", "Estado", "Município", "Distribuidora", "Previsão Interligação SIN",
           "Previsão Interconexão", "Localidade de Interconexão", "Programa de Universalização",
           "Sigla da Localidade", "Nome da Localidade", "Latitude", "Longitude", "População")


def ciclos_publicados(html):
    """Lista [(codigo, ano)] declarada na página de downloads (variável ciclosColeta)."""
    m = re.search(r"ciclosColeta\s*=\s*(\[[^\]]*\])", html or "")
    if not m:
        return []
    return [(int(a), int(b)) for a, b in re.findall(r'"codCicloColeta":\s*(\d+)\s*,\s*"numAnoColeta":\s*(\d+)', m.group(1))]


def _data_br(s):
    s = str(s or "").strip()
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def _num(s):
    try:
        return float(str(s).strip())
    except (TypeError, ValueError):
        return None


def le_localidades(planilhas):
    """Saída de ler_xlsx da exportação → (localidades, faltando). Cada localidade é um
    dict; população ausente fica None (não zero)."""
    linhas = next(iter(planilhas.values()), [])
    if not linhas:
        return [], list(COLUNAS)
    cab = [str(x or "").strip() for x in linhas[0]]
    faltando = [c for c in COLUNAS if c not in cab]
    ix = {c: cab.index(c) for c in COLUNAS if c in cab}

    def g(linha, c):
        i = ix.get(c)
        return linha[i] if i is not None and i < len(linha) else None

    out = []
    for linha in linhas[1:]:
        sigla = str(g(linha, "Sigla da Localidade") or "").strip()
        if not sigla:
            continue
        prog = str(g(linha, "Programa de Universalização") or "").strip()
        out.append({
            "ciclo": str(g(linha, "Ciclo") or "").strip(),
            "uf": str(g(linha, "UF") or "").strip(),
            "municipio": str(g(linha, "Município") or "").strip(),
            "distribuidora": str(g(linha, "Distribuidora") or "").strip(),
            "previsao_interligacao": _data_br(g(linha, "Previsão Interligação SIN")),
            "previsao_interconexao": _data_br(g(linha, "Previsão Interconexão")),
            "programa": prog or None,
            "sigla": sigla,
            "nome": str(g(linha, "Nome da Localidade") or "").strip(),
            "latitude": _num(g(linha, "Latitude")),
            "longitude": _num(g(linha, "Longitude")),
            "populacao": _num(g(linha, "População")),
        })
    return out, faltando


# ---------------------------------------------------------------- caderno do ciclo (PDF)

# Caderno "Planejamento do Atendimento aos Sistemas Isolados", ciclo 2025 (EPE): usado só
# para conferir a exportação do PASI por outro produto da mesma fonte (número de
# localidades e população total declarados no texto).
URL_CADERNO_2025 = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/"
                    "publicacao-942/Caderno_Planejamento%20SISOL_2025_FINAL.pdf")


def le_totais_caderno(texto):
    """Texto do caderno (pdftotext -layout; páginas separadas por \\f) → dict com
    localidades, localidades do ciclo anterior, população em milhões de pessoas e a
    página (1 = primeira página do PDF) de cada achado; campo não encontrado fica None."""
    out = {"localidades": None, "localidades_ciclo_anterior": None, "populacao_milhoes": None,
           "pagina_localidades": None, "pagina_populacao": None}
    m = re.search(r"localidades\s+isoladas\s+consideradas\s+no\s+ciclo\s+\d{4}\s+totaliza\s+(\d+)[^()]*\((\d+)\s+localidades\)",
                  texto, re.S)
    if m:
        out["localidades"], out["localidades_ciclo_anterior"] = int(m.group(1)), int(m.group(2))
        out["pagina_localidades"] = texto.count("\f", 0, m.start()) + 1
    m = re.search(r"TOTAL\s*\n.*?\d+\s+SISOL\s*\n[^\n]*?(\d+,\d+)\s+milh", texto, re.S)
    if m:
        out["populacao_milhoes"] = float(m.group(1).replace(",", "."))
        out["pagina_populacao"] = texto.count("\f", 0, m.start()) + 1
    return out
