"""Textos normativos primários sobre o que o PLD remunera e como é formado (painel P008).

As regras de comercialização da CCEE, que detalham o cálculo, respondem HTTP 403
("Acesso bloqueado") ao ambiente de construção e não são contornadas. Ficam as normas
que a própria Convenção de Comercialização cita como base:

- Decreto nº 5.163/2004, arts. 57 e 58, na norma atualizada publicada pela Câmara dos
  Deputados (legin): contabilização e liquidação no mercado de curto prazo com base no
  PLD; PLD calculado a partir do CMO, limitado por preços mínimo e máximo; critérios da
  ANEEL para cada limite; submercados definidos por restrições de transmissão.
- Resolução Normativa ANEEL nº 957/2021 (Convenção de Comercialização), texto
  compilado: definição do mercado de curto prazo como liquidação das diferenças entre
  montantes contratados e verificados, exposições valoradas ao PLD, liquidação
  multilateral no máximo mensal. O endereço oficial (www2.aneel.gov.br/cedoc) responde
  com desafio de navegador; a cópia usada é a do Internet Archive, com o endereço oficial
  e o instante da cópia registrados e o sha256 do arquivo no bronze.

Cada passagem citada fica escrita aqui como está no ato e é CONFERIDA a cada coleta
contra o texto baixado (espaços normalizados). Passagem que não confere não é publicada
como citação: a gold lista o que não conferiu, sem reescrever o ato.
"""
import html
import os
import re
import shutil
import subprocess
import tempfile

URL_DECRETO = ("https://www2.camara.leg.br/legin/fed/decret/2004/"
               "decreto-5163-30-julho-2004-533148-normaatualizada-pe.html")
URL_DECRETO_ORIGINAL = ("https://www2.camara.leg.br/legin/fed/decret/2004/"
                        "decreto-5163-30-julho-2004-533148-publicacaooriginal-16354-pe.html")
URL_REN957_OFICIAL = "https://www2.aneel.gov.br/cedoc/ren2021957.pdf"
URL_REN957_COPIA = "https://web.archive.org/web/20250601132442id_/https://www2.aneel.gov.br/cedoc/ren2021957.pdf"
COPIA_REN957_EM = "2025-06-01T13:24:42Z"

DOCUMENTOS = {
    "decreto_5163_2004": {
        "orgao": "Presidência da República (texto publicado pela Câmara dos Deputados)",
        "titulo": "Decreto nº 5.163, de 30 de julho de 2004 (norma atualizada)",
        "url": URL_DECRETO, "url_oficial": URL_DECRETO, "ext": "html",
        "licenca": "Ato normativo federal: texto oficial de domínio público (Lei nº 9.610/1998, art. 8º, IV)",
        "nota": ("Norma atualizada mantida pela Câmara dos Deputados (Legislação Informatizada). O caput e o § 6º do art. 57 "
                 "têm redação dada pelo Decreto nº 9.143/2017; a publicação original está em " + URL_DECRETO_ORIGINAL + "."),
    },
    "ren_aneel_957_2021": {
        "orgao": "ANEEL",
        "titulo": "Resolução Normativa ANEEL nº 957, de 7 de dezembro de 2021 (Convenção de Comercialização), texto compilado",
        "url": URL_REN957_COPIA, "url_oficial": URL_REN957_OFICIAL, "ext": "pdf",
        "licenca": "Ato normativo da ANEEL: texto oficial de domínio público (Lei nº 9.610/1998, art. 8º, IV)",
        "nota": ("O endereço oficial respondeu HTTP 403 com desafio de navegador (Cloudflare) em 30/09/2026. A cópia é a do "
                 "Internet Archive de " + COPIA_REN957_EM[:10] + " do mesmo endereço oficial; o texto compilado traz as alterações "
                 "até a data da cópia."),
    },
}

# (id, documento, dispositivo, passagem literal). A passagem é conferida no texto baixado.
TRECHOS = (
    ("d5163_art57_caput", "decreto_5163_2004", "art. 57, caput (redação do Decreto nº 9.143/2017)",
     "Art. 57. A contabilização e a liquidação no mercado de curto prazo serão realizadas com base no PLD."),
    ("d5163_art57_p1", "decreto_5163_2004", "art. 57, § 1º",
     "§ 1º O PLD, a ser publicado pela CCEE, será calculado antecipadamente, com periodicidade máxima semanal e terá como "
     "base o custo marginal de operação, limitado por preços mínimo e máximo, e deverá observar o seguinte:"),
    ("d5163_art57_p1_v", "decreto_5163_2004", "art. 57, § 1º, V",
     "V - as restrições de transmissão entre submercados;"),
    ("d5163_art57_p2", "decreto_5163_2004", "art. 57, § 2º",
     "§ 2º O valor máximo do PLD, a ser estabelecido pela ANEEL, será calculado levando em conta os custos variáveis de "
     "operação dos empreendimentos termelétricos disponíveis para o despacho centralizado."),
    ("d5163_art57_p3", "decreto_5163_2004", "art. 57, § 3º",
     "§ 3º O valor mínimo do PLD, a ser estabelecido pela ANEEL, será calculado levando em conta os custos de operação e "
     "manutenção das usinas hidrelétricas, bem como os relativos à compensação financeira pelo uso dos recursos hídricos e royalties."),
    ("d5163_art57_p4", "decreto_5163_2004", "art. 57, § 4º",
     "§ 4º O critério determinante para a definição dos submercados será a presença e duração de restrições relevantes de "
     "transmissão aos fluxos de energia elétrica no SIN."),
    ("d5163_art57_p5", "decreto_5163_2004", "art. 57, § 5º",
     "§ 5º O cálculo do PLD em cada submercado levará em conta o ajuste de todas as quantidades de energia pela aplicação do "
     "fator de perdas de transmissão, relativamente a um ponto comum de referência, definido para cada submercado."),
    ("d5163_art57_p6", "decreto_5163_2004", "art. 57, § 6º (redação do Decreto nº 9.143/2017)",
     "§ 6º A contabilização e a liquidação no mercado de curto prazo serão realizadas no máximo em base mensal."),
    ("d5163_art58", "decreto_5163_2004", "art. 58",
     "Art. 58. O processo de contabilização e liquidação de energia elétrica, realizado segundo as regras e os procedimentos "
     "de comercialização da CCEE, identificará as quantidades comercializadas no mercado e as liquidadas ao PLD."),
    ("ren957_art2_xiii", "ren_aneel_957_2021", "art. 2º, XIII",
     "XIII – Mercado de Curto Prazo – MCP: denominação do processo em que se procede à contabilização e liquidação financeira "
     "das diferenças apuradas entre os montantes de energia elétrica seguintes: a) contratados, registrados e validados pelos "
     "agentes da CCEE, cujo registro tenha sido efetivado pela Câmara; e b) de geração ou de consumo efetivamente verificados e "
     "atribuídos aos respectivos agentes da CCEE;"),
    ("ren957_art5_p4", "ren_aneel_957_2021", "art. 5º, § 4º",
     "§ 4º As operações realizadas no MCP serão contabilizadas pela CCEE de acordo com as Regras e Procedimentos de "
     "Comercialização, inclusive as relativas ao intercâmbio internacional de energia elétrica e Energia de Reserva, definidas "
     "por regulamentação específica, devendo as exposições dos agentes da CCEE serem valoradas ao PLD."),
    ("ren957_art76", "ren_aneel_957_2021", "art. 76",
     "Art. 76. A CCEE identificará os montantes de energia comercializados pelos Agentes no MCP, por intermédio do processo de "
     "Contabilização, considerando os dados verificados de geração, de consumo e os montantes de energia elétrica contratados e registrados."),
    ("ren957_art78", "ren_aneel_957_2021", "art. 78",
     "Art. 78. O PLD a ser divulgado pela CCEE será calculado antecipadamente, terá como base o Custo Marginal de Operação, "
     "será limitado por preços mínimo e máximo e deverá observar o disposto nos incisos I a VII do § 1º e no § 6º do art. 57 "
     "do Decreto nº 5.163, de 2004, e regulamentação da ANEEL."),
    ("ren957_art82", "ren_aneel_957_2021", "art. 82",
     "Art. 82. A Liquidação Financeira das operações de compra e venda de energia elétrica realizadas no âmbito MCP far-se-á de "
     "forma multilateral, com periodicidade máxima mensal, conforme Procedimentos de Comercialização específicos."),
)


def normaliza(s):
    """Espaços, quebras e tabulações viram um espaço; some o espaço antes de pontuação
    (a extração de HTML deixa "royalties ." quando o termo está em itálico). Hífen
    e travessão de inciso ficam como estão: são parte do texto do ato."""
    s = (s or "").replace(" ", " ").replace("­", "")
    s = re.sub(r"\s+", " ", s).strip()
    return re.sub(r" ([.,;:)])", r"\1", s)


def texto_html(conteudo):
    """Bytes de uma página HTML (a Câmara declara UTF-8; sem declaração, Latin-1) → texto."""
    cab = conteudo[:5000].lower()
    enc = "utf-8" if b"utf-8" in cab else "latin-1"
    t = conteudo.decode(enc, errors="replace")
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    return normaliza(html.unescape(t))


def texto_pdf(conteudo):
    """Bytes de um PDF → texto pelo pdftotext (fluxo de leitura, sem -layout). Sem a
    ferramenta, devolve None e as passagens do documento ficam como não conferidas."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(conteudo)
        saida = subprocess.run([exe, tmp, "-"], capture_output=True, timeout=120).stdout
    finally:
        os.remove(tmp)
    return normaliza(saida.decode("utf-8", errors="replace"))


def confere_trechos(doc_id, texto):
    """[(id, dispositivo, passagem, confere)] das passagens do documento `doc_id`.
    `texto` None (documento ilegível) deixa todas como não conferidas."""
    out = []
    for tid, doc, disp, passagem in TRECHOS:
        if doc != doc_id:
            continue
        out.append((tid, disp, passagem, bool(texto) and normaliza(passagem) in texto))
    return out
