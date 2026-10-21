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

Além das normas do PLD, entram os Procedimentos de Rede do ONS que descrevem o uso dos
modelos que produzem o CMO (painéis P008 e P009): Submódulo 2.4 (premissas e critérios
dos estudos energéticos: CMO semanal calculado pelo modelo de curto prazo; modelo de
curtíssimo prazo executado em D-1 com o dia D em 48 intervalos semi-horários),
Submódulo 4.3 (programação mensal: PMO e revisões semanais, prazo de sexta-feira) e
Submódulo 4.5 (programação diária: CMO semi-horário, prazo de 16h de D-1, envio à CCEE).
Os PDFs vêm do mesmo endereço do botão "Baixar" da página pública de Procedimentos de
Rede vigentes do ONS. Do CEPEL, que desenvolve os modelos, entra o Manual de Metodologia do
DESSEM (novembro de 2022), publicado no site do CEPEL: o DESSEM é usado pelo ONS na
programação diária e pela CCEE no preço horário, e o CMO do submercado é a média dos
custos marginais das barras ponderada pelas cargas. Os manuais de metodologia do DECOMP
e do NEWAVE não foram localizados entre os arquivos públicos do site do CEPEL (busca
registrada a cada coleta) e ficam como limitação declarada.

Cada passagem citada fica escrita aqui como está no ato e é CONFERIDA a cada coleta
contra o texto baixado (espaços normalizados). Uma passagem pode ter partes separadas
por " […] " (quando o texto original intercala marca de nota de rodapé ou trecho não
citado): cada parte é conferida. Passagem que não confere não é publicada como citação:
a gold lista o que não conferiu, sem reescrever o ato.
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

# Procedimentos de Rede do ONS: página pública e endereço do botão "Baixar" de cada
# submódulo (o mesmo montado pela página; nenhum cabeçalho especial é enviado).
URL_PR_PAGINA = "https://www.ons.org.br/paginas/sobre-o-ons/procedimentos-de-rede/vigentes"
_URL_PR_PDF = ("https://proxyportais.ons.org.br/ons.portalempregado.proxy/garapi/api/processo/retornarpdf"
               "?url=/sites/soumaisons/portalgar/ecmpdf/Subm%C3%B3dulo%20{arquivo}.pdf")
URL_CEPEL = "https://www.cepel.br/"
URL_CEPEL_MIDIA = "https://www.cepel.br/wp-json/wp/v2/media?search={termo}&per_page=100&mime_type=application/pdf"
URL_DESSEM_MANUAL = "https://www.cepel.br/wp-content/uploads/2022/12/DESSEM_ManualMetodologia_19.2.pdf"
LICENCA_PR = ("Documento público do ONS (Procedimentos de Rede, aprovados pela ANEEL). Os termos de uso do portal do ONS "
              "não foram relidos nesta integração; o uso aqui é a citação literal de passagens com indicação da fonte "
              "(Lei nº 9.610/1998, art. 46, III).")


def _pr(sub, tipo, revisao, vigencia, titulo, aprovacao):
    return {
        "orgao": "ONS",
        "titulo": f"Procedimentos de Rede, Submódulo {sub}: {titulo} ({tipo}, revisão {revisao}, vigência {vigencia})",
        "url": _URL_PR_PDF.format(arquivo=f"{sub}-{tipo[:2].upper()}_{revisao}"), "url_oficial": URL_PR_PAGINA, "ext": "pdf",
        "licenca": LICENCA_PR,
        "nota": (f"PDF do submódulo {sub}, revisão {revisao} ({aprovacao}), baixado pelo endereço do botão \"Baixar\" da "
                 "página de Procedimentos de Rede vigentes do ONS; a revisão e a vigência são conferidas no cabeçalho do documento."),
        "submodulo": sub, "revisao": revisao, "vigencia": vigencia,
    }

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
    "ons_pr_submodulo_2_4": _pr("2.4", "Critérios", "2024.12", "19/12/2024", "Premissas, critérios e metodologias para estudos energéticos",
                                "Despacho ANEEL 3.806/2024"),
    "ons_pr_submodulo_4_3": _pr("4.3", "Procedimental", "2024.10", "30/10/2024", "Programação mensal da operação energética",
                                "Resolução Normativa ANEEL nº 1.104/2024"),
    "ons_pr_submodulo_4_5": _pr("4.5", "Procedimental", "2025.02", "01/03/2025", "Programação Diária da Operação",
                                "Resolução Normativa ANEEL nº 1.112/2025"),
    "cepel_dessem_manual_metodologia": {
        "orgao": "CEPEL",
        "titulo": "Modelo DESSEM: Manual de Metodologia (CEPEL, novembro de 2022)",
        "url": URL_DESSEM_MANUAL, "url_oficial": URL_DESSEM_MANUAL, "ext": "pdf",
        "licenca": ("Documento técnico publicado pelo CEPEL no seu site; termos de uso não relidos nesta integração. O uso aqui é a "
                    "citação literal de passagens com indicação da fonte (Lei nº 9.610/1998, art. 46, III)."),
        "nota": ("Manual de metodologia do DESSEM publicado no site do CEPEL (arquivo DESSEM_ManualMetodologia_19.2.pdf). A versão do "
                 "modelo em uso pelo ONS e pela CCEE em cada data não é identificada pelos conjuntos de dados; o manual descreve a "
                 "metodologia, não a configuração de cada execução."),
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
    # Procedimentos de Rede do ONS (uso dos modelos que produzem o CMO)
    ("pr24_versao", "ons_pr_submodulo_2_4", "cabeçalho (revisão e vigência) e tabela de revisões",
     "Premissas, critérios e metodologias para estudos energéticos 2.4 Critérios 2024.12 19/12/2024 […] "
     "2024.12 Despacho ANEEL 3.806/2024 16/12/2024"),
    ("pr24_cmo_semanal", "ons_pr_submodulo_2_4", "item 2.4.3.1",
     "2.4.3.1 Os custos marginais de operação semanais são calculados diretamente pelo modelo para otimização da operação de "
     "curto prazo com base em usinas individualizadas para cada semana operativa do PMO,"),
    ("pr24_cmo_semi_horario", "ons_pr_submodulo_2_4", "item 2.5.1.1",
     "2.5.1.1 O modelo de despacho hidrotérmico de curtíssimo prazo no processo de programação diária eletroenergética recebe "
     "a função de custo futuro do modelo de curto prazo, inclui como dados de entrada a previsão de vazões, a previsão de carga, "
     "a previsão da geração eólica e a rede elétrica e, resulta no valor do custo marginal de operação (CMO) semi-horário, "
     "conforme processo descrito no Submódulo 4.5 – Programação Diária da Operação."),
    ("pr24_execucao_d1", "ons_pr_submodulo_2_4", "item 2.5.1.2",
     "2.5.1.2 O modelo de despacho hidrotérmico de curtíssimo prazo é executado diariamente em D-1, com horizonte de D até o "
     "final da semana operativa, em que é feita a consulta à função de custo futuro do modelo de curto prazo, conforme mostrado na Figura 1."),
    ("pr24_48_intervalos", "ons_pr_submodulo_2_4", "item 2.5.1.3",
     "2.5.1.3 O primeiro dia (D) é detalhado em 48 intervalos semi-horários, considerando a Rede de Transmissão. Os demais dias "
     "da semana operativa (D+1 até D+6) são divididos em patamares de carga."),
    ("pr43_versao", "ons_pr_submodulo_4_3", "cabeçalho (revisão e vigência) e tabela de revisões",
     "Programação mensal da operação energética 4.3 Procedimental 2024.10 30/10/2024 […] "
     "2024.10 Resolução Normativa ANEEL nº 1.104/2024 22/10/2024"),
    ("pr43_cmo_semanal", "ons_pr_submodulo_4_3", "item 1.4.1, alínea (a)",
     "1.4.1. O ONS incorpora as informações consistidas nos arquivos de dados do modelo de otimização de curto prazo, executa o "
     "modelo e obtém os seguintes resultados: (a) Custo Marginal de Operação (CMO) médio semanal, por subsistema, por patamar de carga;"),
    ("pr43_prazo_sexta", "ons_pr_submodulo_4_3", "item 1.5.2 (a nota de rodapé 1 trata de feriados)",
     "1.5.2. Caso o ONS não obtenha os resultados do modelo de curto prazo até as 12h00 de sexta-feira […] "
     "são utilizados os resultados válidos mais recentes disponíveis."),
    ("pr43_horizonte", "ons_pr_submodulo_4_3", "item 1.6.2",
     "1.6.2. O ONS disponibiliza o PMO e suas revisões semanais a todos os agentes envolvidos, com horizonte de análise mensal, "
     "discretizado em base semanal para o primeiro mês, que pode ser estendido por um período variável, desde que resguardada a base mensal."),
    ("pr43_versoes_modelos", "ons_pr_submodulo_4_3", "item 1.7.1.3",
     "1.7.1.3. As versões dos modelos computacionais utilizados pelo ONS são aquelas validadas com a participação dos agentes e "
     "homologadas pela ANEEL, por meio de ato específico."),
    ("pr45_versao", "ons_pr_submodulo_4_5", "cabeçalho (revisão e vigência) e tabela de revisões",
     "Programação Diária da Operação 4.5 Procedimental 2025.02 01/03/2025 […] "
     "2025.02 Resolução Normativa ANEEL nº 1.112/2025 11/02/2025"),
    ("pr45_cmo_semi_horario", "ons_pr_submodulo_4_5", "item 2.3.1",
     "2.3.1. O ONS atualiza os arquivos de dados do modelo de curtíssimo prazo e executa o modelo para definição dos valores de "
     "despacho de geração das usinas hidráulicas, usinas termelétricas e os intercâmbios entre subsistemas e o Custo Marginal de "
     "Operação (CMO) em base semi-horária."),
    ("pr45_envio_ccee", "ons_pr_submodulo_4_5", "item 2.3.3",
     "2.3.3. Após execução do modelo de curtíssimo prazo, o ONS encaminha o deck de dados e os resultados para CCEE."),
    ("pr45_prazo_16h", "ons_pr_submodulo_4_5", "item 2.4.1 (a marca da nota de rodapé 1 fica entre as partes)",
     "2.4.1. Na inviabilidade do ONS obter, até às 16h00min do dia D-1 […] os resultados do modelo de curtíssimo prazo para a "
     "elaboração da programação do dia D, são consideradas as seguintes ações do Plano de Contingência para a definição das propostas de geração:"),
    ("pr45_dia_d1", "ons_pr_submodulo_4_5", "nota de rodapé 1",
     "O dia “D-1” refere-se ao dia anterior ao da programação, ou seja, data de processamento do modelo de curtíssimo prazo para a "
     "elaboração da programação diária da operação eletroenergética do dia seguinte. O dia “D” refere-se ao dia a ser programado."),
    ("pr45_decomp", "ons_pr_submodulo_4_5", "item 2.4.1, alínea (c), (1), (i)",
     "o ONS considera os resultados do modelo de curto prazo (DECOMP) que forneceu a Função de Custo Futuro para a semana operativa do dia D."),
    ("pr45_dessem", "ons_pr_submodulo_4_5", "nota de rodapé 2",
     "Trata-se de interstício de tempo que, do ponto de vista da modelagem do DESSEM,"),
    # CEPEL: Manual de Metodologia do DESSEM
    ("dessem_versao", "cepel_dessem_manual_metodologia", "capa",
     "Manual de Metodologia – Modelo DESSEM – Novembro/2022"),
    ("dessem_objetivo", "cepel_dessem_manual_metodologia", "seção 1 (O modelo DESSEM)",
     "O programa DESSEM é um modelo de otimização desenvolvido pelo CEPEL (Centro de Pesquisas de Energia Elétrica) desde 1998 [1], "
     "que tem como principal objetivo determinar a programação diária da operação e formação de preço para sistemas hidrotérmicos, "
     "incluindo as fontes intermitentes, em um horizonte de algumas semanas e discretização de até meia-hora,"),
    ("dessem_uso_ons_ccee", "cepel_dessem_manual_metodologia", "seção 1 (O modelo DESSEM)",
     "O modelo vem sendo utilizado oficialmente pelo Operador Nacional do Sistema (ONS) desde Janeiro/2020 para a programação "
     "diária da operação do sistema brasileiro, e desde Janeiro/2021 pela Câmara de Comercialização de Energia Elétrica (CCEE) "
     "para a determinação do preço de energia horário para o dia seguinte [2]."),
    ("dessem_acoplamento", "cepel_dessem_manual_metodologia", "seção 1 (O modelo DESSEM)",
     "Mais especificamente, o DESSEM se acopla, ao final do horizonte de estudo, com a função de custo futuro fornecida pelo "
     "DECOMP, que por sua vez se acopla à função de custo futuro fornecida pelo NEWAVE."),
    ("dessem_resultado_cmo", "cepel_dessem_manual_metodologia", "seção 1, principais resultados",
     "os custos marginais de energia em base de meia hora, por barra ou submercado, que são utilizados como base para formação "
     "do preço horário;"),
    ("dessem_cmo_duais", "cepel_dessem_manual_metodologia", "seção 22 (Cálculo do CMO)",
     "é preciso mais uma resolução de PL-UCT-Fixo para se obter os valores das variáveis duais necessárias para o cálculo do "
     "custo marginal de Operação (CMO)."),
    ("dessem_cmo_submercado", "cepel_dessem_manual_metodologia", "seção 22.6 (Cálculo do custo marginal do submercado)",
     "O CMO do submercado é calculado como a média ponderada dos CMBs nas barras que pertencem a cada submercado, ponderados "
     "pelas respectivas cargas:"),
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


SEPARADOR = "[…]"


def partes(passagem):
    """Partes literais de uma passagem citada com elisão (" […] ")."""
    return [p.strip() for p in passagem.split(SEPARADOR) if p.strip()]


def confere(passagem, texto):
    """True quando cada parte da passagem está, com espaços normalizados, no texto."""
    return bool(texto) and all(normaliza(p) in texto for p in partes(passagem))


def confere_trechos(doc_id, texto):
    """[(id, dispositivo, passagem, confere)] das passagens do documento `doc_id`.
    `texto` None (documento ilegível) deixa todas como não conferidas."""
    out = []
    for tid, doc, disp, passagem in TRECHOS:
        if doc != doc_id:
            continue
        out.append((tid, disp, passagem, confere(passagem, texto)))
    return out
