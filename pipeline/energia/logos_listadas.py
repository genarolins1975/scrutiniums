"""Símbolos (logotipos) das companhias da carteira do IEE, baixados do site da própria companhia.

Uso (manual, fora da execução diária; os arquivos mudam raramente):

    python3 -m pipeline.energia.logos_listadas

Regras:
* só o arquivo publicado pela própria companhia, no site de relações com investidores ou no site
  institucional (inclusive o CDN do provedor do site de RI, quando é a página de RI da companhia
  que o publica). Nenhum logo é redesenhado, recortado, recolorido ou aproximado; nada de logo de
  terceiros (bancos de imagem, Wikipédia, agregadores);
* SVG quando a companhia publica; senão PNG. O arquivo é servido localmente
  (public/energia/logos/<papel>.<ext>), nunca por hotlink;
* `fundo` diz para que fundo a companhia desenhou o arquivo ("claro" ou "escuro"): a interface
  põe o logo sobre uma placa neutra desse tom nos dois temas, em vez de alterar o arquivo;
* quando nenhum arquivo oficial pôde ser obtido, o manifesto registra a ausência com o motivo e a
  interface mostra o nome em texto.

O manifesto (public/energia/logos/manifesto.json) tem formato estável, lido também pela página de
leilões: {"gerado_em", "regras", "logos": [{papel, nome_exibicao, cnpj_holding, grupo_cnpj,
topo_igual_holding, arquivo, formato, fundo, largura, altura, url_origem, pagina_origem,
capturado_em, sha256, bytes, ausencia}]}. `grupo_cnpj` é o topo da cadeia de controladores únicos
declarada à ANEEL (o mesmo grupo_cnpj de empresas_ativos.csv e empresas_grupos.csv), calculado a
partir de empresas_cadeia.json; `ausencia` é null ou {"motivo": texto}.
"""
import hashlib
import json
import os
import re
import struct
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.common import USER_AGENT  # noqa: E402
from pipeline.energia import base  # noqa: E402

DESTINO = os.path.join(base.RAIZ, "public", "energia", "logos")

# papel, nome de exibição, CNPJ da holding listada, arquivo oficial, página em que ele é publicado,
# fundo para o qual foi desenhado. url None = ausência, com o motivo.
CURADORIA = [
    ("ALUP11", "Alupar", "08364948000138", "https://www.alupar.com.br/logo-alupar-caixa.png", "https://www.alupar.com.br/", "claro", None),
    ("AURE3", "Auren", "28594234000123", "https://www.aurenenergia.com.br/wp-content/themes/auren-1/assets/tempfiles/logo.svg",
     "https://www.aurenenergia.com.br/", "claro", None),
    # a marca completa da AXIA (axia.com.br, rodapé) é um quadrado com o símbolo e o nome em letras pequenas, ilegível no
    # tamanho do painel; o arquivo do cabeçalho do mesmo site traz o nome em branco, para fundo escuro
    ("AXIA3", "AXIA Energia", "00001180000126",
     "https://axia.com.br/documents/32426/91425/LOGO.svg/025cd5d7-0e5c-a74b-bd85-f00e1eb3511b?version=1.0&t=1779996625220",
     "https://axia.com.br/", "escuro", None),
    ("CMIG4", "Cemig", "17155730000164", "https://www.cemig.com.br/wp-content/themes/cemig-theme/assets/images/logo-cemig-svg.svg",
     "https://www.cemig.com.br/", "claro", None),
    ("CPLE3", "Copel", "76483817000120", "https://www.copel.com/site/wp-content/uploads/2024/08/logo-copel-cor-assinatura-email.png",
     "https://www.copel.com/site/", "claro", None),
    ("CPFE3", "CPFL Energia", "02429144000193", "https://ri.cpfl.com.br/images/logo-semi-white.png", "https://ri.cpfl.com.br/", "escuro", None),
    ("ENGI11", "Energisa", "00864214000106",
     "https://cdn-sites-assets.mziq.com/wp-content/uploads/sites/1290/2026/02/GRUPO-ENERGISA_LOGO_COR_1.png",
     "https://ri.energisa.com.br/", "claro", None),
    ("ENEV3", "Eneva", "04423567000121", "https://eneva.com.br/static/images/logo.ac5f7806cefa.svg", "https://eneva.com.br/", "escuro", None),
    ("EGIE3", "Engie Brasil Energia", "02474103000119", None, None, None,
     "O site de RI (ri.engie.com.br) respondeu 502 e os arquivos do site institucional (www.engie.com.br) responderam 403 a "
     "pedidos identificados do observatório em 16/10/2026; nenhum arquivo oficial foi obtido."),
    ("EQTL3", "Equatorial", "03220438000173", "https://cdn-sites-assets.mziq.com/wp-content/uploads/sites/812/2024/08/LOGO-EQUATORIAL-AZUL.png",
     "https://ri.equatorialenergia.com.br/", "claro", None),
    ("ISAE4", "ISA Energia Brasil", "02998611000104", "https://ri.isaenergiabrasil.com.br/Content/images/logo.svg",
     "https://ri.isaenergiabrasil.com.br/", "claro", None),
    ("TAEE11", "Taesa", "07859971000130", "https://ri.taesa.com.br/wp-content/themes/ri-taesa/imgs/logo-taesa.png?v2",
     "https://ri.taesa.com.br/", "claro", None),
]


def _topo(nos, cnpj):
    """Topo da cadeia de controladores únicos no arquivo publicado pelo módulo Empresas."""
    x, vistos = cnpj, set()
    while x in nos and nos[x][1] and nos[x][1] not in vistos:
        vistos.add(x)
        x = nos[x][1]
    return x


def _dimensoes(corpo, formato):
    if formato == "png":
        return struct.unpack(">II", corpo[16:24])
    m = re.search(rb'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', corpo[:2000])
    if m:
        return float(m.group(1)), float(m.group(2))
    w = re.search(rb'<svg[^>]*\swidth="([\d.]+)', corpo[:2000])
    h = re.search(rb'<svg[^>]*\sheight="([\d.]+)', corpo[:2000])
    return (float(w.group(1)) if w else None, float(h.group(1)) if h else None)


def _formato(corpo):
    if corpo[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b"<svg" in corpo[:2000]:
        return "svg"
    return None


def main():
    os.makedirs(DESTINO, exist_ok=True)
    caminho_cadeia = os.path.join(base.SERIES, "empresas_cadeia.json")
    with open(caminho_cadeia, encoding="utf-8") as f:
        nos = json.load(f)["nos"]
    anterior = {}
    caminho_man = os.path.join(DESTINO, "manifesto.json")
    if os.path.exists(caminho_man):
        with open(caminho_man, encoding="utf-8") as f:
            anterior = {x["papel"]: x for x in json.load(f).get("logos", [])}
    logos = []
    for papel, nome, cnpj, url, pagina, fundo, motivo in CURADORIA:
        topo = _topo(nos, cnpj)
        item = {"papel": papel, "nome_exibicao": nome, "cnpj_holding": cnpj, "grupo_cnpj": topo, "topo_igual_holding": topo == cnpj,
                "arquivo": None, "formato": None, "fundo": None, "largura": None, "altura": None, "url_origem": url,
                "pagina_origem": pagina, "capturado_em": None, "sha256": None, "bytes": None, "ausencia": None}
        if url is None:
            item["ausencia"] = {"motivo": motivo}
            logos.append(item)
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as r:
                corpo = r.read()
        except Exception as e:  # mantém o arquivo anterior, se houver; senão registra a ausência
            ant = anterior.get(papel)
            if ant and ant.get("arquivo"):
                logos.append(ant)
            else:
                item["ausencia"] = {"motivo": f"falha ao baixar o arquivo oficial: {e}"[:300]}
                logos.append(item)
            continue
        fmt = _formato(corpo)
        if fmt is None:
            item["ausencia"] = {"motivo": "o endereço oficial não devolveu PNG nem SVG"}
            logos.append(item)
            continue
        sha = hashlib.sha256(corpo).hexdigest()
        nome_arq = f"{papel.lower()}.{fmt}"
        with open(os.path.join(DESTINO, nome_arq), "wb") as f:
            f.write(corpo)
        w, h = _dimensoes(corpo, fmt)
        ant = anterior.get(papel) or {}
        item.update({"arquivo": f"/energia/logos/{nome_arq}", "formato": fmt, "fundo": fundo, "largura": w, "altura": h,
                     "capturado_em": ant["capturado_em"] if ant.get("sha256") == sha else base.agora_utc(),
                     "sha256": sha, "bytes": len(corpo)})
        logos.append(item)
    man = {
        "gerado_em": base.agora_utc(),
        "regras": ("Arquivo oficial publicado pela própria companhia (site de RI ou institucional), baixado e servido localmente, sem "
                   "alteração. 'fundo' indica o fundo para o qual o arquivo foi desenhado; a interface usa uma placa neutra desse tom. "
                   "grupo_cnpj = topo da cadeia de controladores únicos declarada à ANEEL (empresas_cadeia.json). Ausência registrada "
                   "com motivo; nesse caso a interface mostra o nome em texto."),
        "logos": logos,
    }
    with open(caminho_man, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for x in logos:
        print(x["papel"], x["arquivo"] or "AUSENTE", x["grupo_cnpj"], (x["ausencia"] or {}).get("motivo", "")[:80])


if __name__ == "__main__":
    main()
