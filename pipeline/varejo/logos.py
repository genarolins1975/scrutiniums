"""Símbolos (logotipos) das empresas da coleção Varejo, baixados do site da própria companhia.

Uso (manual, fora da execução diária; os arquivos mudam raramente):

    python3 -m pipeline.varejo.logos              # baixa, valida e reescreve o manifesto
    python3 -m pipeline.varejo.logos --conferir   # só confere o manifesto contra os arquivos, sem rede

Regras (skill observatorio-layout, anexo componentes-e-graficos, "Identidade de empresas"):
* só o arquivo publicado pela própria companhia, no site de relações com investidores ou no site
  institucional (inclusive o CDN do provedor do site de RI, quando é a página de RI da companhia
  que o publica). Nenhum logo é redesenhado, recortado, recolorido ou aproximado; nada de terceiros;
* o arquivo é servido localmente (public/varejo/logos/<slug>.<ext>), nunca por hotlink, e sem
  alteração: o sha256 do manifesto é o do arquivo baixado;
* vínculo entre o logo e a entidade só por prova escrita em `vinculo`: CNPJ ou razão social que a
  própria página de origem exibe, ou o endereço de e-mail de RI que o cadastro de companhias
  abertas da CVM registra para aquele CNPJ e que é do mesmo domínio do site. Sem prova, sem logo;
* `fundo` diz para que fundo a companhia desenhou o arquivo ("claro" ou "escuro"): a interface põe
  o logo sobre uma placa desse tom, em vez de alterar o arquivo;
* SVG com script, evento, conteúdo embutido (inclusive imagem em data:), entidade ou referência
  externa é recusado, não "limpo";
* quando nenhum arquivo oficial pôde ser obtido, o manifesto registra a ausência com o motivo e a
  interface mostra o nome em texto.

O manifesto (public/varejo/logos/manifesto.json) tem uma entrada por entidade da coleção: os grupos
do ranking e os líderes de segmento (pipeline/varejo/curadoria/ranking.json), as fichas
(pipeline/varejo/curadoria/fichas) e as companhias do comparador (public/varejo/gold/empresas.json).
Formato: {"versao", "gerado_em", "regras", "logos": [{slug, nome_exibicao, papel, cnpj, vinculo,
nota, arquivo, formato, fundo, largura, altura, url_origem, pagina_origem, capturado_em, sha256,
bytes, metodo, extraido_de, derivado_de, ausencia}]}; `ausencia` é null ou {"motivo": texto};
`derivado_de` é null enquanto todo arquivo for o original (reservado ao sha256 do original de um
raster reduzido). `metodo` diz como o arquivo foi obtido: "direto" (os bytes da URL de origem),
"extraido" (a companhia publica o logo como um PNG embutido em base64 num SVG que só o envolve; o
SVG segue recusado e os bytes exatos do PNG são publicados, com a URL e o sha256 do SVG em
`extraido_de`) ou "navegador" (arquivo que só um navegador obtém; nenhum neste ciclo). Quando a
requisição falha numa recaptura, o arquivo anterior da mesma origem é mantido.
"""
import base64
import glob
import hashlib
import json
import os
import re
import struct
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.logos_listadas import svg_com_conteudo_ativo  # noqa: E402

DESTINO = os.path.join(base.RAIZ, "public", "varejo", "logos")
MANIFESTO = os.path.join(DESTINO, "manifesto.json")
PREFIXO = "/varejo/logos/"
LIMITE_BYTES = 60_000

# Os sites de RI e institucionais do varejo recusam agentes não identificados como navegador; o pedido
# é um GET simples do mesmo arquivo que a página pública entrega a qualquer visitante.
AGENTE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

MZ = "https://cdn-sites-assets.mziq.com/wp-content"
CVM = ("cadastro de companhias abertas da CVM (dados.cvm.gov.br, cad_cia_aberta.csv, lido em 24/11/2026)")

# slug, nome de exibição, CNPJ (da gold ou o que a página de origem exibe), arquivo oficial, página em que é
# publicado, fundo para o qual foi desenhado, prova do vínculo, nota (ou None). url None = ausência, com o motivo
# no lugar da prova.
CURADORIA = [
    ("carrefour-brasil", "Grupo Carrefour Brasil", "75.315.333/0001-09", None, "https://grupocarrefourbrasil.com.br/", None,
     "O site institucional (grupocarrefourbrasil.com.br) respondeu 403 (\"Acesso Bloqueado\") à coleta de 24/11/2026; nenhum "
     "arquivo oficial foi obtido.", None),
    ("assai", "Assaí", "06.057.223/0001-71", "https://www.assai.com.br/sites/all/themes/assai_2024/logo.svg",
     "https://www.assai.com.br/", "escuro",
     "CNPJ 06.057.223/0001-71 (Sendas Distribuidora S.A., gold de empresas do Varejo). O rodapé da página de origem exibe "
     "\"Assaí Atacadista. Todos os direitos reservados Sendas Distribuidora S/A. CNPJ 06.057.223/0001-71\".",
     "Marca da bandeira Assaí Atacadista, pela qual a companhia se apresenta; o nome vem em branco, para fundo escuro."),
    ("rd-saude", "RD Saúde", "61.585.865/0001-51", None, "https://ri.rdsaude.com.br/", None,
     "O site de RI (ri.rdsaude.com.br) respondeu 403 (\"Acesso Bloqueado\") e o institucional (www.rdsaude.com.br) não "
     "aceitou a conexão na coleta de 24/11/2026; nenhum arquivo oficial foi obtido.", None),
    ("magazine-luiza", "Magazine Luiza", "47.960.950/0001-21", None, "https://ri.magazineluiza.com.br/", None,
     "O site de RI (ri.magazineluiza.com.br) e a loja (www.magazineluiza.com.br) responderam 403 à coleta de 24/11/2026; "
     "nenhum arquivo oficial foi obtido.", None),
    ("grupo-boticario", "Grupo Boticário", None, None, "https://www.grupoboticario.com.br/", None,
     "O cabeçalho de www.grupoboticario.com.br traz o logo como um PNG de 803 x 178 px embutido em base64 num SVG escrito "
     "dentro da página, e os bytes poderiam ser extraídos; mas nem a página inicial nem a de informações administrativas "
     "exibem razão social ou CNPJ, e o grupo não tem registro na CVM: sem prova de vínculo, sem logo (coleta de "
     "24/11/2026).", None),
    ("grupo-mateus", "Grupo Mateus", "24.990.777/0001-09", f"{MZ}/themes/mziq_grupo_mateus/img/logo.png",
     "https://ri.grupomateus.com.br/", "claro",
     f"CNPJ 24.990.777/0001-09 (Grupo Mateus S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail "
     "de RI ri@grupomateus.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.grupomateus.com.br, \"Home - "
     "Grupo Mateus\").", None),
    ("casas-bahia", "Grupo Casas Bahia", "33.041.260/0652-90", None, "https://ri.grupocasasbahia.com.br/", None,
     "O site de RI (ri.grupocasasbahia.com.br) e a loja (www.casasbahia.com.br) responderam 403 à coleta de 24/11/2026; "
     "nenhum arquivo oficial foi obtido.", None),
    ("natura", "Natura", "71.673.990/0001-77", f"{MZ}/themes/mziq_natura_2025_ri/public/img/logo-natura.svg",
     "https://ri.natura.com.br/", "claro",
     f"CNPJ 71.673.990/0001-77 (Natura Cosméticos S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o "
     "e-mail de RI ri@natura.net; o site de RI que publica o arquivo exibe o mesmo endereço em "
     "ri.natura.com.br/informacoes-aos-investidores/fale-com-ri/ (\"transparência e proximidade no relacionamento com o "
     "mercado. ri@natura.net\").",
     "O cabeçalho do site de RI publica o logo como um SVG que apenas envolve um PNG de 4000 x 886 px embutido em base64. O "
     "SVG é recusado pela regra; o arquivo publicado aqui são os bytes exatos desse PNG, extraídos sem alteração."),
    ("supermercados-bh", "Supermercados BH", None, None, "https://www.supermercadosbh.com.br/", None,
     "O site www.supermercadosbh.com.br encerrou a conexão na coleta de 24/11/2026; nenhum arquivo oficial foi obtido.", None),
    ("gpa", "GPA", "47.508.411/0001-56", f"{MZ}/uploads/sites/108/2022/11/gpa-logo.png", "https://www.gpari.com.br/", "escuro",
     f"CNPJ 47.508.411/0001-56 (Companhia Brasileira de Distribuição, gold de empresas do Varejo). O {CVM} registra para "
     "esse CNPJ o e-mail de RI gpa.ri@gpabr.com; o site institucional desse domínio (www.gpabr.com) aponta no menu "
     "\"Investidores\" para www.gpari.com.br, o site de RI (\"Home - GPA RI\") que publica o arquivo.",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("super-muffato", "Grupo Muffato", "76.430.438/0124-20", "https://www.grupomuffato.com.br/images/grupo_muffato.png",
     "https://www.grupomuffato.com.br/", "claro",
     "Grupo de capital fechado, sem registro na CVM. O rodapé da página de origem exibe \"Irmãos Muffato & Cia Ltda - CNPJ: "
     "76.430.438/0124-20 - Avenida Tiradentes, nº2667\"; o CNPJ registrado aqui é o que a página exibe (um "
     "estabelecimento da empresa, não a matriz).",
     "Marca do grupo (\"Grupo Muffato\"), não a da bandeira Super Muffato."),
    ("lojas-renner", "Lojas Renner S.A.", "92.754.738/0001-62",
     "https://www.lojasrennersa.com.br/wp-content/themes/temarenner2025/img/logo-lojas-renner-sa.svg",
     "https://www.lojasrennersa.com.br/", "claro",
     "CNPJ 92.754.738/0001-62 (Lojas Renner S.A., gold de empresas do Varejo). O rodapé da página de origem exibe "
     "\"Copyright Lojas Renner S.A. © - Av. Joaquim Porto Villanova, 401 - B. Jardim do Salso - Porto Alegre/RS CEP: "
     "91410-400 CNPJ: 92.754.738/0001-62\".",
     "Marca da companhia com as bandeiras (Renner, Camicado, Youcom, Realize, Ashua) na linha de baixo."),
    ("amazon-brasil", "Amazon", None, "https://assets.aboutamazon.com/6d/e4/a8a7371f474d8137487d49b51b39/logo-1.svg",
     "https://www.aboutamazon.com.br/", "claro",
     "Grupo estrangeiro, sem CNPJ na página. O rodapé da página de origem, o site institucional da Amazon no Brasil, exibe "
     "\"© 1996-2023 Amazon.com, Inc. ou suas afiliadas\"; o cabeçalho da mesma página publica o arquivo, servido de "
     "assets.aboutamazon.com.",
     "Marca do grupo Amazon; a página não cita a razão social nem o CNPJ da operação brasileira."),
    ("havan", "Havan", "79.379.491/0008-50",
     "https://www.havan.com.br/static/version1794937847/frontend/Havan/themeDefault/pt_BR/images/svg/logo-havan-slim-sidebar.svg",
     "https://www.havan.com.br/", "claro",
     "Companhia de capital fechado, sem registro na CVM. O rodapé da página de origem exibe \"Havan Labs © 1986 - 2026 HAVAN "
     "S.A. CNPJ: 79.379.491.0008-50 | Rod. Antônio Heil\"; o CNPJ registrado aqui é o que a página exibe (um "
     "estabelecimento da empresa, não a matriz).",
     "Versão em azul, publicada no menu lateral da loja; o cabeçalho usa a mesma marca em branco."),
    ("dpsp", "DPSP", None, None, "https://www.dpsp.com.br/", None,
     "O certificado de www.dpsp.com.br não corresponde ao nome do site e a conexão segura não se estabeleceu na coleta de "
     "24/11/2026; nenhum arquivo oficial foi obtido.", None),
    ("grupo-pereira", "Grupo Pereira", None, None, "https://www.grupopereira.com.br/", None,
     "O site www.grupopereira.com.br encerrou a conexão na coleta de 24/11/2026; nenhum arquivo oficial foi obtido.", None),
    ("americanas", "Americanas", "00.776.574/0001-56", f"{MZ}/themes/mziq_americanas_ri/public/img/logo.png",
     "https://ri.americanas.io/", "claro",
     f"CNPJ 00.776.574/0001-56 (Americanas S.A. - Em Recuperação Judicial, gold de empresas do Varejo). O {CVM} registra "
     "para esse CNPJ o e-mail de RI ri@americanas.io, do mesmo domínio do site de RI que publica o arquivo "
     "(ri.americanas.io), cujo rodapé exibe \"© 2026 — Americanas SA\".", None),
    ("pague-menos", "Pague Menos", "06.626.253/0001-51", f"{MZ}/themes/mziq_pague_menos_ri/img/logo22-07.png",
     "https://ri.paguemenos.com.br/", "escuro",
     f"CNPJ 06.626.253/0001-51 (Empreendimentos Pague Menos S.A., gold de empresas do Varejo). O {CVM} registra para esse "
     "CNPJ o e-mail de RI ri@pmenos.com.br; o site de RI que publica o arquivo exibe o mesmo endereço em "
     "ri.paguemenos.com.br/servicos-aos-investidores/fale-com-o-ri/ (\"Diretor Financeiro e de RI E-mail: "
     "ri@pmenos.com.br\").",
     "Arquivo com o nome em branco, para fundo escuro."),
    ("gazin", "Gazin", None, None, "https://www.gazin.com.br/", None,
     "O site www.gazin.com.br respondeu 403 à coleta de 24/11/2026; nenhum arquivo oficial foi obtido.", None),
    ("arcos-dorados", "Arcos Dorados", None, "https://www.arcosdorados.com/wp-content/themes/oxpitan/images/logo-mobile.png",
     "https://www.arcosdorados.com/", "claro",
     "Grupo estrangeiro, sem CNPJ na página. O site de origem identifica o titular: rodapé \"Copyright © 2025 - Arcos Dorados "
     "- All rights reserved\" e, na política de privacidade do mesmo site (www.arcosdorados.com/privacy-policy/, que usa o "
     "mesmo arquivo), \"Arcos Dorados S.A. [...] Roque Saenz Peña 432 Olivos (1636) Provincia de Buenos Aires\".",
     "Marca do grupo Arcos Dorados, operador do McDonald's na América Latina; a página não cita a subsidiária brasileira "
     "nem o CNPJ dela."),
    ("mercado-livre", "Mercado Livre", "03.007.331/0001-41",
     "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/7.53.2/mercadolibre/pt_logo_large_plus@2x.webp",
     "https://www.mercadolivre.com.br/", "claro",
     "Sem registro na CVM (a controladora MercadoLibre, Inc. é listada nos Estados Unidos). O rodapé da página de origem "
     "exibe \"Copyright © 1999-2026. Mercado Livre Brasil Ltda.\" e \"CNPJ n.º 03.007.331/0001-41 / Av. das Nações Unidas, nº "
     "3.003, Bonfim, Osasco/SP\"; o cabeçalho da mesma página (.nav-logo) usa o arquivo, servido de http2.mlstatic.com.",
     "Marca em português do cabeçalho da loja brasileira; o CNPJ é o da empresa brasileira que a página exibe."),
    ("cea", "C&A", "45.242.914/0001-05", f"{MZ}/uploads/sites/329/2020/11/Logo-Maior.png", "https://ri.cea.com.br/", "claro",
     f"CNPJ 45.242.914/0001-05 (C&A Modas S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de RI "
     "ri@cea.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.cea.com.br, \"Investidores C&A\").", None),
    ("guararapes", "Guararapes (Riachuelo)", "08.402.943/0001-52", None, "https://ri.riachuelo.com.br/", None,
     "O site de RI (ri.riachuelo.com.br) respondeu 403 (\"Access Denied\") à coleta de 24/11/2026; nenhum arquivo oficial "
     "foi obtido.", None),
    ("azzas", "Azzas 2154", "16.590.234/0001-76", f"{MZ}/uploads/sites/1381/2024/07/Camada_1-3.png",
     "https://ri.azzas2154.com.br/", "escuro",
     f"CNPJ 16.590.234/0001-76 (Azzas 2154 S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de "
     "RI ri@azzas2154.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.azzas2154.com.br, \"Home - Azzas "
     "2154 RI\").",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("grupo-sbf", "Grupo SBF", "13.217.485/0001-11", f"{MZ}/themes/mziq_Grupo_SBF_ri/img/logo-v3.png",
     "https://ri.gruposbf.com.br/", "escuro",
     f"CNPJ 13.217.485/0001-11 (Grupo SBF S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de RI "
     "ri@gruposbf.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.gruposbf.com.br, \"Home - Grupo SBF RI\").",
     "Marca do grupo, dono da Centauro; o verde-claro do arquivo foi desenhado para fundo escuro."),
    ("panvel", "Grupo Panvel", "92.665.611/0001-77", f"{MZ}/uploads/sites/1414/2024/09/Vector-5.png",
     "https://ri.grupopanvel.com.br/", "escuro",
     f"CNPJ 92.665.611/0001-77 (Dimed S.A. Distribuidora de Medicamentos, gold de empresas do Varejo). O {CVM} registra "
     "para esse CNPJ o e-mail relinvest@grupopanvel.com.br, do mesmo domínio do site de RI que publica o arquivo "
     "(ri.grupopanvel.com.br, rodapé \"© 2026 Grupo Panvel\").",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("vivara", "Vivara", "33.839.910/0001-11", None, "https://ri.vivara.com.br/", None,
     "A conexão segura com ri.vivara.com.br não se estabeleceu na coleta de 24/11/2026 (cadeia de certificado não "
     "verificável); nenhum arquivo oficial foi obtido.", None),
    ("zamp", "Zamp (Burger King Brasil)", "13.574.594/0001-96", None, "https://ri.zamp.com.br/", None,
     "O site de RI (ri.zamp.com.br) respondeu 403 (\"Acesso Bloqueado\") à coleta de 24/11/2026; nenhum arquivo oficial foi "
     "obtido.", None),
    ("leroy-merlin", "Leroy Merlin", None, None, None, None,
     "Líder de segmento citado no ranking, sem ficha nem linha no comparador; o site oficial não foi consultado na coleta "
     "de 24/11/2026 e o vínculo não foi provado.", None),
]

CAMPOS = ("slug", "nome_exibicao", "papel", "cnpj", "vinculo", "nota", "arquivo", "formato", "fundo", "largura", "altura",
          "url_origem", "pagina_origem", "capturado_em", "sha256", "bytes", "metodo", "extraido_de", "derivado_de", "ausencia")
METODOS = ("direto", "extraido", "navegador")

# Entidades cujo arquivo oficial é um SVG que só envolve um PNG em base64: publica-se o PNG, nunca o SVG.
EXTRAIDOS = {"natura"}
PNG_EMBUTIDO = re.compile(rb"data:image/png;base64,([A-Za-z0-9+/=\s]+)")


def png_embutido(corpo):
    """Os bytes do único PNG em base64 de um SVG que só o envolve; None quando o SVG tem outra coisa além dele."""
    achados = PNG_EMBUTIDO.findall(corpo)
    if len(achados) != 1:
        return None
    sem_imagem = PNG_EMBUTIDO.sub(b"", corpo)
    if svg_com_conteudo_ativo(sem_imagem) or len(sem_imagem) > 2000:
        return None
    png = base64.b64decode(achados[0])
    return png if formato_de(png) == "png" else None

# Conteúdo embutido que a expressão do Setor Elétrico não cobre: imagem raster dentro do SVG e qualquer data:.
SVG_EMBUTIDO = re.compile(rb"<\s*image\b|data\s*:", re.I)


def svg_recusado(corpo):
    """True quando o SVG traz script, evento, conteúdo embutido, entidade ou referência externa."""
    return svg_com_conteudo_ativo(corpo) or bool(SVG_EMBUTIDO.search(corpo))


def formato_de(corpo):
    if corpo[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if corpo[:4] == b"RIFF" and corpo[8:12] == b"WEBP":
        return "webp"
    if b"<svg" in corpo[:2000]:
        return "svg"
    return None


def _dimensoes_webp(corpo):
    """Largura e altura lidas do cabeçalho WebP (formatos com perda, sem perda e estendido)."""
    bloco = corpo[12:16]
    if bloco == b"VP8X":
        return int.from_bytes(corpo[24:27], "little") + 1, int.from_bytes(corpo[27:30], "little") + 1
    if bloco == b"VP8L":
        bits = int.from_bytes(corpo[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if bloco == b"VP8 ":
        w, h = struct.unpack("<HH", corpo[26:30])
        return w & 0x3FFF, h & 0x3FFF
    return None, None


def dimensoes(corpo, formato):
    if formato == "png":
        return struct.unpack(">II", corpo[16:24])
    if formato == "webp":
        return _dimensoes_webp(corpo)
    m = re.search(rb'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', corpo[:2000])
    if m:
        return float(m.group(1)), float(m.group(2))
    w = re.search(rb'<svg[^>]*\swidth="([\d.]+)', corpo[:2000])
    h = re.search(rb'<svg[^>]*\sheight="([\d.]+)', corpo[:2000])
    return (float(w.group(1)) if w else None, float(h.group(1)) if h else None)


def slugs_da_colecao():
    """Slug -> papéis na coleção, lidos das três fontes que as páginas usam."""
    papeis = {}

    def soma(slug, papel):
        if slug:
            papeis.setdefault(slug, [])
            if papel not in papeis[slug]:
                papeis[slug].append(papel)

    curadoria = os.path.join(base.RAIZ, "pipeline", "varejo", "curadoria")
    with open(os.path.join(curadoria, "ranking.json"), encoding="utf-8") as f:
        ranking = json.load(f)
    for g in ranking.get("grupos", []):
        soma(g.get("slug"), "grupo do ranking")
    for g in ranking.get("lideres_por_segmento", []):
        soma(g.get("slug"), "líder de segmento")
    for caminho in sorted(glob.glob(os.path.join(curadoria, "fichas", "*.json"))):
        soma(os.path.basename(caminho)[:-5], "ficha")
    with open(os.path.join(base.RAIZ, "public", "varejo", "gold", "empresas.json"), encoding="utf-8") as f:
        for slug in json.load(f)["empresas"]:
            soma(slug, "companhia do comparador")
    return papeis


def conferir(manifesto=None):
    """Erros do manifesto contra os arquivos publicados e contra a coleção; lista vazia quando tudo confere."""
    if manifesto is None:
        with open(MANIFESTO, encoding="utf-8") as f:
            manifesto = json.load(f)
    erros = []
    logos = manifesto.get("logos", [])
    vistos = [x.get("slug") for x in logos]
    for slug in slugs_da_colecao():
        if slug not in vistos:
            erros.append(f"{slug}: entidade da coleção sem entrada no manifesto")
    for slug in set(vistos):
        if vistos.count(slug) > 1:
            erros.append(f"{slug}: entrada repetida")
    usados = set()
    for x in logos:
        s = x.get("slug")
        faltam = [c for c in CAMPOS if c not in x]
        if faltam:
            erros.append(f"{s}: campos ausentes {faltam}")
            continue
        if not x["arquivo"]:
            if not (x["ausencia"] and len(x["ausencia"].get("motivo", "")) > 20):
                erros.append(f"{s}: sem arquivo e sem motivo de ausência")
            if any(x[c] is not None for c in ("formato", "fundo", "largura", "altura", "sha256", "bytes", "metodo", "extraido_de")):
                erros.append(f"{s}: ausência com dados de arquivo")
            continue
        if x["ausencia"] is not None:
            erros.append(f"{s}: arquivo e ausência ao mesmo tempo")
        if x["arquivo"] != f"{PREFIXO}{s}.{x['formato']}":
            erros.append(f"{s}: caminho fora do padrão ({x['arquivo']})")
            continue
        usados.add(os.path.basename(x["arquivo"]))
        caminho = os.path.join(DESTINO, os.path.basename(x["arquivo"]))
        if not os.path.exists(caminho):
            erros.append(f"{s}: arquivo não publicado")
            continue
        with open(caminho, "rb") as f:
            corpo = f.read()
        if hashlib.sha256(corpo).hexdigest() != x["sha256"]:
            erros.append(f"{s}: sha256 não confere")
        if len(corpo) != x["bytes"]:
            erros.append(f"{s}: tamanho não confere")
        if len(corpo) > LIMITE_BYTES:
            erros.append(f"{s}: arquivo acima de {LIMITE_BYTES} bytes")
        fmt = formato_de(corpo)
        if fmt != x["formato"]:
            erros.append(f"{s}: formato declarado {x['formato']}, conteúdo {fmt}")
            continue
        if fmt == "svg" and svg_recusado(corpo):
            erros.append(f"{s}: SVG com conteúdo ativo, embutido ou externo")
        w, h = dimensoes(corpo, fmt)
        if (w, h) != (x["largura"], x["altura"]) or not w or not h:
            erros.append(f"{s}: dimensões não conferem ({w} x {h})")
        if x["metodo"] not in METODOS:
            erros.append(f"{s}: método de captura inválido")
        ext = x["extraido_de"]
        if (x["metodo"] == "extraido") != bool(ext) or (ext and not (str(ext.get("url", "")).startswith("https://")
                                                                    and re.fullmatch(r"[0-9a-f]{64}", str(ext.get("sha256", ""))))):
            erros.append(f"{s}: extração sem a origem e o sha256 do arquivo que envolvia a imagem")
        if x["fundo"] not in ("claro", "escuro"):
            erros.append(f"{s}: fundo inválido")
        if len(x["vinculo"] or "") < 40:
            erros.append(f"{s}: logo sem prova de vínculo")
        if not str(x["url_origem"] or "").startswith("https://") or not str(x["pagina_origem"] or "").startswith("https://"):
            erros.append(f"{s}: origem sem https")
        if not x["capturado_em"]:
            erros.append(f"{s}: sem data de captura")
    for nome in sorted(os.listdir(DESTINO)):
        if nome != "manifesto.json" and nome not in usados:
            erros.append(f"{nome}: arquivo na pasta sem entrada no manifesto")
    return erros


def main():
    os.makedirs(DESTINO, exist_ok=True)
    papeis = slugs_da_colecao()
    anterior = {}
    if os.path.exists(MANIFESTO):
        with open(MANIFESTO, encoding="utf-8") as f:
            anterior = {x.get("slug"): x for x in json.load(f).get("logos", [])}
    logos = []
    for slug, nome, cnpj, url, pagina, fundo, prova, nota in CURADORIA:
        item = dict.fromkeys(CAMPOS)
        item.update({"slug": slug, "nome_exibicao": nome, "papel": ", ".join(papeis.get(slug, ["fora da coleção"])), "cnpj": cnpj,
                     "nota": nota, "pagina_origem": pagina})
        ant = anterior.get(slug) or {}
        tem_anterior = bool(ant.get("sha256")) and ant.get("url_origem") == url

        def ausente(motivo):
            item.update({"vinculo": None, "ausencia": {"motivo": motivo}})
            logos.append(item)

        if url is None:
            ausente(prova)
            continue
        item.update({"vinculo": prova, "url_origem": url})
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=60) as r:
                corpo = r.read()
        except Exception as e:  # mantém o arquivo anterior da mesma origem, se houver; senão registra a ausência
            if tem_anterior:
                logos.append({c: ant.get(c) for c in CAMPOS} | {"papel": item["papel"]})
            else:
                ausente(f"Falha ao baixar o arquivo oficial de {url}: {e}"[:300])
            continue
        fmt = formato_de(corpo)
        if fmt is None:
            ausente(f"O endereço oficial ({url}) não devolveu PNG, WebP nem SVG.")
            continue
        item["metodo"] = "direto"
        if slug in EXTRAIDOS:
            png = png_embutido(corpo) if fmt == "svg" else None
            if png is None:
                item["metodo"] = None
                ausente(f"O arquivo oficial ({url}) deixou de ser um SVG que só envolve um PNG; a extração não se aplica.")
                continue
            item.update({"metodo": "extraido", "extraido_de": {"url": url, "sha256": hashlib.sha256(corpo).hexdigest(), "bytes": len(corpo)}})
            corpo, fmt = png, "png"
        if fmt == "svg" and svg_recusado(corpo):
            item.update({"metodo": None, "extraido_de": None})
            ausente(f"O SVG oficial ({url}) traz script, evento, conteúdo embutido ou referência externa e não é publicado.")
            continue
        if len(corpo) > LIMITE_BYTES:
            item.update({"metodo": None, "extraido_de": None})
            ausente(f"O arquivo oficial ({url}) tem {len(corpo)} bytes, acima do limite de {LIMITE_BYTES} da pasta de logos.")
            continue
        sha = hashlib.sha256(corpo).hexdigest()
        nome_arq = f"{slug}.{fmt}"
        with open(os.path.join(DESTINO, nome_arq), "wb") as f:
            f.write(corpo)
        w, h = dimensoes(corpo, fmt)
        item.update({"arquivo": PREFIXO + nome_arq, "formato": fmt, "fundo": fundo, "largura": w, "altura": h,
                     "capturado_em": ant["capturado_em"] if ant.get("sha256") == sha else base.agora_utc(),
                     "sha256": sha, "bytes": len(corpo)})
        logos.append(item)
    for slug in papeis:  # entidade nova na coleção nunca fica sem entrada
        if slug not in {x["slug"] for x in logos}:
            item = dict.fromkeys(CAMPOS)
            item.update({"slug": slug, "nome_exibicao": slug, "papel": ", ".join(papeis[slug]),
                         "ausencia": {"motivo": "Entidade ainda sem curadoria de logo (pipeline/varejo/logos.py)."}})
            logos.append(item)
    logos.sort(key=lambda x: x["slug"])
    publicados = {os.path.basename(x["arquivo"]) for x in logos if x["arquivo"]}
    for nome in os.listdir(DESTINO):  # arquivo de uma captura anterior que deixou de ter entrada
        if nome != "manifesto.json" and nome not in publicados:
            os.remove(os.path.join(DESTINO, nome))
    man = {
        "versao": 3,
        "gerado_em": base.agora_utc(),
        "regras": ("Arquivo oficial publicado pela própria companhia (site de RI ou institucional), baixado e servido localmente, sem "
                   "alteração. 'vinculo' é a prova de que o site de origem é o da entidade: CNPJ ou razão social exibidos na própria "
                   "página, ou o e-mail de RI que o cadastro de companhias abertas da CVM registra para o CNPJ, do mesmo domínio do "
                   "site; nunca semelhança de nome. 'fundo' indica o fundo para o qual o arquivo foi desenhado; a interface usa uma "
                   "placa desse tom. SVG com script, evento, conteúdo embutido, entidade ou referência externa é recusado; 'metodo' "
                   "'extraido' marca o PNG que a companhia publica embutido num SVG e que foi extraído sem alteração. Ausência "
                   "registrada com motivo; nesse caso a interface mostra o nome em texto."),
        "logos": logos,
    }
    with open(MANIFESTO, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for x in logos:
        print(x["slug"], x["arquivo"] or "AUSENTE", x["fundo"] or "", (x["ausencia"] or {}).get("motivo", "")[:70])
    erros = conferir(man)
    for e in erros:
        print("ERRO", e, file=sys.stderr)
    return 1 if erros else 0


if __name__ == "__main__":
    if "--conferir" in sys.argv[1:]:
        problemas = conferir()
        for p in problemas:
            print("ERRO", p, file=sys.stderr)
        print("manifesto de logos do Varejo:", "confere" if not problemas else f"{len(problemas)} problema(s)")
        sys.exit(1 if problemas else 0)
    sys.exit(main())
