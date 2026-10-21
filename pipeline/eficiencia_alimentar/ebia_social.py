"""Recortes sociais da EBIA no Brasil: IBGE, PNAD Contínua, Segurança alimentar, tabelas SIDRA 9553 a 9562.

Follow-up do PR #325, aprovado pelo responsável em 21/10/2026. Cada tabela traz, só para o Brasil, 2023 e 2024,
os domicílios em mil unidades (variável 162) e a distribuição percentual (9784), cada um com o coeficiente de
variação publicado (5123 e 9785). A tabela 9561 não existe no SIDRA (a API responde "Tabela inválida" e o
catálogo de agregados da PNAD Contínua anual não a lista); isso fica registrado em `TABELA_AUSENTE`.

Atenção à orientação do percentual, conferida na fonte:
  * "composicao" (9553 a 9558): o percentual é a parcela dos domicílios de cada classe da EBIA que pertence ao
    grupo (ex.: dos domicílios com insegurança grave, 57,6% têm mulher como responsável). Os grupos somam 100% em
    cada classe; o grupo Total vale 100.
  * "distribuicao" (9559, 9560 e 9562): o percentual é a parcela dos domicílios do grupo em cada classe (ex.: dos
    domicílios com criança menor de 5 anos, 3,0% com insegurança grave). As classes somam 100% em cada grupo.

Dois usos, sem rede por padrão:

  python -m pipeline.eficiencia_alimentar.ebia_social --originais DIR [--coletar] [--gravar-seed]
      Confere o SHA-256 de cada original em DIR (só com --coletar baixa antes; original ausente reprova),
      reextrai e compara com o seed versionado. Edição nova exige --gravar-seed e revisão do manifesto.

  python -m pipeline.eficiencia_alimentar.complementos
      Lê este seed junto com o das bases complementares e grava a gold única complementos.json, com o portão
      deste módulo (`valida`) antes de qualquer escrita.

Regras: hífen, X, .. e ... do SIDRA viram ausência (None), nunca zero, e a ausência é listada; nenhuma taxa
publicada é recalculada. A única conta feita aqui é a parcela de cada grupo em cada classe nas tabelas de
composição (domicílios da classe no grupo ÷ domicílios do grupo), marcada como calculada e sem coeficiente
de variação, porque o IBGE não publica esse recorte nessas tabelas.
"""
import argparse
import gzip
import hashlib
import json
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
SEED = BASE / "seed/ebia-social.json.gz"
MANIFESTO = BASE / "seed/ebia-social-manifesto.json"
VERSAO = "2026-10-21.1"
CAPTURA = "2026-10-21"

EBIA = "Situação de segurança alimentar existente no domicílio"
SITUACAO = "Situação do domicílio"
CLASSES = {"109106": "total", "109098": "segura", "109099": "insegura", "109100": "leve", "109101": "moderada",
           "109102": "grave", "109107": "moderada_grave"}
CLASSES_PADRAO = ["total", "segura", "insegura", "leve", "moderada", "grave"]
CLASSES_RENDA = ["total", "segura", "insegura", "leve", "moderada_grave"]
VARIAVEIS = {"162": "mil_domicilios", "5123": "cv_domicilios", "9784": "pct", "9785": "cv_pct"}

# Limiar do painel (não é regra do IBGE) a partir do qual a estimativa é sinalizada como menos precisa.
LIMIAR_CV = 15.0
# Tolerâncias de arredondamento, por parcela somada: o IBGE publica percentuais com uma casa (erro máximo de
# 0,05 ponto por valor) e domicílios em mil unidades inteiras (erro máximo de 0,5 mil por valor).
TOL_PCT_POR_PARCELA = 0.05
TOL_MIL_POR_PARCELA = 0.5

TABELA_AUSENTE = {"tabela": "9561", "motivo": "A tabela 9561 não existe no SIDRA: a API de valores responde \"Tabela 9561: Tabela inválida\", a de metadados responde erro 500 e o catálogo de agregados da PNAD Contínua anual (assunto Segurança alimentar) não a lista. Conferido em 21/10/2026."}

# Cada recorte: tabela, dimensão social (nome exato no cabeçalho do SIDRA), grupos na ordem publicada e se os
# grupos formam partição do total (a soma dos domicílios dos grupos tem de fechar com o total).
RECORTES = [
    {"id": "sexo", "tabela": "9553", "classificacao": "293", "dimensao": "Sexo do responsável pelo domicílio",
     "rotulo": "Sexo da pessoa responsável", "orientacao": "composicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Homens", "Mulheres"]},
    {"id": "cor_raca", "tabela": "9554", "classificacao": "1828", "dimensao": "Cor ou raça do responsável pelo domicílio",
     "rotulo": "Cor ou raça da pessoa responsável", "orientacao": "composicao", "particao": False, "classes": CLASSES_PADRAO,
     "grupos": ["Branca", "Preta", "Parda"],
     "fora_da_particao": "O IBGE publica só branca, preta e parda; amarela, indígena e sem declaração ficam fora da tabela e a diferença para o total não é distribuída."},
    {"id": "instrucao", "tabela": "9555", "classificacao": "1829", "dimensao": "Nível de instrução do responsável pelo domicílio",
     "rotulo": "Escolaridade da pessoa responsável", "orientacao": "composicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Sem instrução", "Ensino fundamental incompleto ou equivalente", "Ensino fundamental completo ou equivalente",
                "Ensino médio incompleto ou equivalente", "Ensino médio completo ou equivalente",
                "Ensino superior incompleto ou equivalente", "Superior completo"]},
    {"id": "ocupacao", "tabela": "9556", "classificacao": "1830",
     "dimensao": "Posição na ocupação e categoria do emprego no trabalho principal do responsável pelo domicílio",
     "rotulo": "Trabalho da pessoa responsável", "orientacao": "composicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Trabalhador doméstico", "Empregado no setor privado com carteira de trabalho assinada",
                "Empregado no setor privado sem carteira de trabalho assinada",
                "Empregado no setor público, inclusive servidor estatutário e militar", "Conta própria", "Empregador", "Outros"]},
    {"id": "moradores", "tabela": "9557", "classificacao": "68", "dimensao": "Número de moradores",
     "rotulo": "Número de moradores", "orientacao": "composicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Até 3 moradores", "4 a 6 moradores", "7 moradores ou mais"]},
    {"id": "renda", "tabela": "9558", "classificacao": "652", "dimensao": "Faixas de rendimento mensal domiciliar per capita",
     "rotulo": "Renda por pessoa do domicílio", "orientacao": "composicao", "particao": True, "classes": CLASSES_RENDA,
     "situacao": True,
     "universo_menor": "O total desta tabela tem menos domicílios que a tabela 9552 (78.221 mil contra 78.280 mil em 2024; 76.612 mil contra 76.656 mil em 2023). A tabela não diz por quê; a diferença, menos de 0,1% dos domicílios, não é distribuída entre as faixas.",
     "grupos": ["Até ¼ salário mínimo", "Mais de 1/4 a 1/2 do salário mínimo", "Mais de 1/2 a 1 salário mínimo",
                "Mais de 1 a 2 salários mínimos", "Mais de 2 salários mínimos"]},
    {"id": "menores_5", "tabela": "9559", "classificacao": "1824", "dimensao": "Existência de moradores menores de 5 anos",
     "rotulo": "Criança menor de 5 anos em casa", "orientacao": "distribuicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Existe", "Não existe"]},
    {"id": "menores_18", "tabela": "9562", "classificacao": "1827", "dimensao": "Existência de moradores menores de 18 anos",
     "rotulo": "Morador menor de 18 anos em casa", "orientacao": "distribuicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Não existe", "Existe"]},
    {"id": "idosos", "tabela": "9560", "classificacao": "1825", "dimensao": "Existência de moradores com 60 anos ou mais",
     "rotulo": "Morador com 60 anos ou mais em casa", "orientacao": "distribuicao", "particao": True, "classes": CLASSES_PADRAO,
     "grupos": ["Existe", "Não existe"]},
]


def _url(r):
    cls = f"c{r['classificacao']}/all" + ("/c1/all" if r.get("situacao") else "") + "/c12404/all"
    return f"https://apisidra.ibge.gov.br/values/t/{r['tabela']}/n1/all/v/162,5123,9784,9785/p/all/{cls}"


# Hash de cada original conferido em 21/10/2026 (duas capturas idênticas byte a byte no mesmo dia).
_SHA = {
    "9553": "e1cbf2f9c52c4d1bdec79ba70ae95a30f1f38a7c2ebff1bfb8a028e42114eced",
    "9554": "b69dfbee38db9a3652f1df31339c9ab24a3c4f424b5543b6745d2ae4b2b1a87b",
    "9555": "c9a34a387d79dbb4f29940432201938c426ae641fa37199821802f092888a927",
    "9556": "4162dfe364f8dfa21ff20e73949ea076beeda0175114e51cc64fcc3bf15e8d7a",
    "9557": "75bf9308ce1a9db96a12bb03a8a866b9745e036e5fde8ab0000a4ed08685ca6f",
    "9558": "5a541b6b6283e06a3f81601466d2eb6708f7e5a61a2a3c06731fe553f05d2be8",
    "9559": "f5d4a118b2f1903eddd42453f3346b9adb2a95ee2a70c9163e1304ae8b11e908",
    "9560": "c8ce632f319b408aceb5630a7340bec9a9f85ae3e11d0a99bd9db9049d30b51f",
    "9562": "ed3f031f0695bd7ad77c5cb55ebdc0dde30f68723ef132acd072cee796257d4d",
}

FONTES = [
    {"id": f"sidra-{r['tabela']}", "arquivo": f"sidra-{r['tabela']}.json",
     "nome": f"IBGE · PNAD Contínua · Segurança alimentar · tabela {r['tabela']}, domicílios por situação de segurança alimentar e {r['rotulo'].lower()}, com coeficiente de variação",
     "url": _url(r), "pagina": f"https://sidra.ibge.gov.br/tabela/{r['tabela']}", "periodo": "2023 e 2024", "territorio": "Brasil",
     "sha256": _SHA[r["tabela"]]}
    for r in RECORTES
]


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def numero_sidra(v):
    """Hífen, X, .. e ... são ausência: célula não publicada, sigilo ou não aplicável. Nunca zero."""
    if v in ("-", "X", "..", "...", "", None):
        return None
    return float(v)


# ---------------------------------------------------------------- leitor (sem rede, sem efeitos)

def ler_tabela(raw, recorte):
    """Uma tabela SIDRA do recorte: confere o cabeçalho, os grupos e as classes publicados e devolve as linhas."""
    rows = json.loads(raw)
    cab = rows[0]
    nomes = {cab[k]: k[:-1] for k in cab if k.startswith("D") and k.endswith("N")}
    esperado = {"Brasil", "Variável", "Ano", recorte["dimensao"], EBIA} | ({SITUACAO} if recorte.get("situacao") else set())
    if set(nomes) != esperado:
        raise ValueError(f"Cabeçalho SIDRA {recorte['tabela']} diferente do revisado: {sorted(nomes)}")
    dim, ebia, sit = nomes[recorte["dimensao"]], nomes[EBIA], nomes.get(SITUACAO)
    linhas = {}
    for r in rows[1:]:
        if r["NC"] != "1":
            raise ValueError(f"Tabela {recorte['tabela']} com território diferente do Brasil")
        grupo = r[dim + "N"]
        if grupo != "Total" and grupo not in recorte["grupos"]:
            raise ValueError(f"Grupo não revisado na tabela {recorte['tabela']}: {grupo}")
        classe = CLASSES.get(r[ebia + "C"])
        if classe not in recorte["classes"]:
            raise ValueError(f"Classe EBIA não revisada na tabela {recorte['tabela']}: {r.get(ebia + 'N', r[ebia + 'C'])}")
        variavel = VARIAVEIS.get(r["D2C"])
        if variavel is None:
            raise ValueError(f"Variável não revisada na tabela {recorte['tabela']}: {r['D2C']}")
        situacao = {"Total": "total", "Urbana": "urbana", "Rural": "rural"}[r[sit + "N"]] if sit else "total"
        chave = (int(r["D3C"]), grupo, situacao)
        linha = linhas.setdefault(chave, {"ano": chave[0], "grupo": grupo, "situacao": situacao, "classes": {}})
        celula = linha["classes"].setdefault(classe, {})
        if variavel in celula:
            raise ValueError(f"Célula repetida na tabela {recorte['tabela']}: {chave} {classe} {variavel}")
        celula[variavel] = numero_sidra(r["V"])
    ordem = {g: i for i, g in enumerate(["Total", *recorte["grupos"]])}
    sit_ordem = {"total": 0, "urbana": 1, "rural": 2}
    return sorted(linhas.values(), key=lambda x: (x["ano"], sit_ordem[x["situacao"]], ordem[x["grupo"]]))


def extrai(originais):
    return {
        "versao": VERSAO,
        "tabela_ausente": TABELA_AUSENTE,
        "recortes": [{**{k: v for k, v in r.items() if k != "classificacao"}, "linhas": ler_tabela(originais[f"sidra-{r['tabela']}"], r)}
                     for r in RECORTES],
    }


# ---------------------------------------------------------------- portão

def _soma_confere(partes, total, tol_por_parcela):
    """Compara a soma das parcelas com o total, com tolerância de arredondamento proporcional ao número de parcelas."""
    return abs(sum(partes) - total) <= tol_por_parcela * len(partes) + 1e-9


def valida(rec):
    """Reprova antes de qualquer escrita. Devolve o registro das conferências e das ausências, que vai para a gold.

    Conferências que retêm a publicação:
      1. cobertura: os nove recortes, 2023 e 2024, todos os grupos e classes, as quatro variáveis em cada célula;
      2. classes da EBIA: segura + insegura = total e leve + moderada + grave (ou moderada ou grave) = insegura,
         nos domicílios de cada grupo e, nas tabelas de distribuição, nos percentuais (que somam 100%);
      3. grupos: nas tabelas de composição, os percentuais dos grupos somam 100% em cada classe; nas tabelas que
         formam partição, os domicílios dos grupos somam o total; na de cor ou raça (sem partição), não passam dele;
      4. percentuais entre 0 e 100, domicílios e coeficientes de variação não negativos.
    """
    if [r["id"] for r in rec["recortes"]] != [r["id"] for r in RECORTES]:
        raise ValueError("Recortes EBIA sociais diferentes dos revisados")
    conferencias = {"classes_mil": 0, "classes_pct": 0, "grupos_pct": 0, "grupos_mil": 0}
    ausencias = []
    for recorte in rec["recortes"]:
        tab = recorte["tabela"]
        situacoes = ["total", "urbana", "rural"] if recorte.get("situacao") else ["total"]
        esperadas = {(a, g, s) for a in (2023, 2024) for g in ["Total", *recorte["grupos"]] for s in situacoes}
        chaves = [(l["ano"], l["grupo"], l["situacao"]) for l in recorte["linhas"]]
        if set(chaves) != esperadas or len(chaves) != len(esperadas):
            raise ValueError(f"Cobertura da tabela {tab} inválida")
        por = {k: l for k, l in zip(chaves, recorte["linhas"])}
        insegura_partes = ["leve", "moderada_grave"] if "moderada_grave" in recorte["classes"] else ["leve", "moderada", "grave"]
        for (ano, grupo, sit), linha in por.items():
            if sorted(linha["classes"]) != sorted(recorte["classes"]):
                raise ValueError(f"Classes da tabela {tab} incompletas: {ano} {grupo}")
            for classe, cel in linha["classes"].items():
                if sorted(cel) != sorted(VARIAVEIS.values()):
                    raise ValueError(f"Variáveis da tabela {tab} incompletas: {ano} {grupo} {classe}")
                for var, v in cel.items():
                    if v is None:
                        # o CV de um percentual fixado em 100 não existe; qualquer outra ausência é declarada
                        estrutural = var == "cv_pct" and cel["pct"] == 100.0 and (grupo == "Total" if recorte["orientacao"] == "composicao" else classe == "total")
                        if not estrutural:
                            ausencias.append({"tabela": tab, "ano": ano, "grupo": grupo, "situacao": sit, "classe": classe, "variavel": var})
                        continue
                    if v < 0 or (var == "pct" and v > 100):
                        raise ValueError(f"Valor fora do domínio na tabela {tab}: {ano} {grupo} {classe} {var}={v}")
            c = linha["classes"]
            mil = {k: c[k]["mil_domicilios"] for k in c}
            if all(v is not None for v in mil.values()):
                if not _soma_confere([mil["segura"], mil["insegura"]], mil["total"], TOL_MIL_POR_PARCELA) \
                        or not _soma_confere([mil[k] for k in insegura_partes], mil["insegura"], TOL_MIL_POR_PARCELA):
                    raise ValueError(f"Domicílios das classes EBIA não fecham na tabela {tab}: {ano} {grupo} {sit}")
                conferencias["classes_mil"] += 1
            if recorte["orientacao"] == "distribuicao":
                pct = {k: c[k]["pct"] for k in c}
                if all(v is not None for v in pct.values()):
                    if pct["total"] != 100.0 or not _soma_confere([pct["segura"], pct["insegura"]], 100.0, TOL_PCT_POR_PARCELA) \
                            or not _soma_confere([pct[k] for k in insegura_partes], pct["insegura"], TOL_PCT_POR_PARCELA):
                        raise ValueError(f"Classes EBIA não somam 100% na tabela {tab}: {ano} {grupo}")
                    conferencias["classes_pct"] += 1
        for ano in (2023, 2024):
            for sit in situacoes:
                total = por[(ano, "Total", sit)]["classes"]
                grupos = [por[(ano, g, sit)]["classes"] for g in recorte["grupos"]]
                for classe in recorte["classes"]:
                    mil = [g[classe]["mil_domicilios"] for g in grupos]
                    mil_total = total[classe]["mil_domicilios"]
                    if None not in mil and mil_total is not None:
                        if recorte["particao"]:
                            if not _soma_confere(mil, mil_total, TOL_MIL_POR_PARCELA):
                                raise ValueError(f"Domicílios dos grupos não somam o total na tabela {tab}: {ano} {sit} {classe}")
                        elif sum(mil) > mil_total + TOL_MIL_POR_PARCELA * len(mil):
                            raise ValueError(f"Domicílios dos grupos passam do total na tabela {tab}: {ano} {sit} {classe}")
                        conferencias["grupos_mil"] += 1
                    if recorte["orientacao"] == "composicao":
                        pct = [g[classe]["pct"] for g in grupos]
                        if total[classe]["pct"] != 100.0:
                            raise ValueError(f"Grupo Total diferente de 100% na tabela {tab}: {ano} {sit} {classe}")
                        if None not in pct:
                            ok = _soma_confere(pct, 100.0, TOL_PCT_POR_PARCELA) if recorte["particao"] else sum(pct) <= 100.0 + TOL_PCT_POR_PARCELA * len(pct)
                            if not ok:
                                raise ValueError(f"Percentuais dos grupos não somam 100% na tabela {tab}: {ano} {sit} {classe}")
                            conferencias["grupos_pct"] += 1
    return {"conferencias": conferencias, "ausencias": ausencias}


def confere_com_9552(rec, ebia_territorial):
    """O grupo Total de cada recorte (Brasil, situação total) tem de repetir os domicílios da tabela 9552.

    Exceção declarada: recorte com `universo_menor` (a tabela de renda) pode ter menos domicílios, nunca mais;
    a diferença é devolvida para a gold, sem ser distribuída. Devolve (células conferidas, diferenças declaradas).
    """
    br = {e["ano"]: e["classes"] for e in ebia_territorial if e["nivel"] == "brasil" and e["situacao"] == "total"}
    conferidas, diferencas = 0, []
    for recorte in rec["recortes"]:
        for l in recorte["linhas"]:
            if l["grupo"] != "Total" or l["situacao"] != "total":
                continue
            for classe, cel in l["classes"].items():
                if classe not in br[l["ano"]]:
                    continue
                aqui, ref = cel["mil_domicilios"], br[l["ano"]][classe]["mil_domicilios"]
                if aqui != ref:
                    if not recorte.get("universo_menor") or aqui is None or ref is None or aqui > ref:
                        raise ValueError(f"Total da tabela {recorte['tabela']} diverge da 9552: {l['ano']} {classe}")
                    diferencas.append({"tabela": recorte["tabela"], "ano": l["ano"], "classe": classe, "mil_domicilios": aqui, "mil_domicilios_9552": ref})
                conferidas += 1
    return conferidas, diferencas


def agrega(rec, manifesto, ebia_territorial):
    """Bloco `ebia_social` da gold: recortes publicados, a parcela calculada do grupo em cada classe nas tabelas de
    composição, o registro das conferências e das ausências, limiar de CV e tolerâncias declarados."""
    registro = valida(rec)
    registro["conferencias"]["totais_9552"], registro["diferencas_9552"] = confere_com_9552(rec, ebia_territorial)
    recortes = []
    for r in rec["recortes"]:
        linhas = []
        for l in r["linhas"]:
            classes = {}
            for classe, cel in l["classes"].items():
                saida = dict(cel)
                if r["orientacao"] == "composicao":
                    num, den = cel["mil_domicilios"], l["classes"]["total"]["mil_domicilios"]
                    saida["pct_no_grupo_calculado"] = None if num is None or not den else round(100 * num / den, 1)
                classes[classe] = saida
            linhas.append({**l, "classes": classes})
        recortes.append({**r, "fonte_id": f"sidra-{r['tabela']}", "linhas": linhas})
    return {"versao": rec["versao"], "manifesto": manifesto, "limiar_cv": LIMIAR_CV,
            "tolerancias": {"pct_por_parcela": TOL_PCT_POR_PARCELA, "mil_por_parcela": TOL_MIL_POR_PARCELA},
            "tabela_ausente": rec["tabela_ausente"], "recortes": recortes, **registro}


# ---------------------------------------------------------------- originais, seed e manifesto

def _baixa(url, destino):
    with urllib.request.urlopen(url, timeout=180) as r:
        destino.write_bytes(r.read())


def confere_originais(pasta, coletar=False):
    """Devolve {id: bytes} depois de conferir cada hash; edição diferente reprova."""
    out = {}
    for f in FONTES:
        p = Path(pasta) / f["arquivo"]
        # sem rede por padrão: só baixa com --coletar; original ausente é reportado, nunca buscado em silêncio
        if coletar:
            _baixa(f["url"], p)
        elif not p.exists():
            raise FileNotFoundError(f"Original ausente: {p} ({f['id']}). Use --coletar para baixar de {f['url']}")
        raw = p.read_bytes()
        if sha256(raw) != f["sha256"]:
            raise ValueError(f"Edição diferente da revisada: {f['id']}")
        out[f["id"]] = raw
    return out


def le_seed():
    manifesto = json.loads(MANIFESTO.read_text())
    raw = SEED.read_bytes()
    if sha256(raw) != manifesto["seed_sha256"]:
        raise ValueError("Integridade do seed dos recortes sociais da EBIA reprovada")
    return json.loads(gzip.decompress(raw)), manifesto


def grava_seed(rec):
    corpo = gzip.compress(json.dumps(rec, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(), mtime=0)
    SEED.write_bytes(corpo)
    manifesto = {
        "versao": VERSAO, "capturado_em": CAPTURA,
        "origem": "Originais baixados da API de valores do SIDRA em 21/10/2026 (duas capturas idênticas) e metadados conferidos na API de agregados do IBGE; recorte extraído por este módulo.",
        "seed_arquivo": SEED.name, "seed_sha256": sha256(corpo),
        "fontes": [{k: v for k, v in f.items() if k != "arquivo"} for f in FONTES],
    }
    MANIFESTO.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    return manifesto


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--originais", type=Path, required=True)
    p.add_argument("--coletar", action="store_true")
    p.add_argument("--gravar-seed", action="store_true")
    a = p.parse_args()
    rec = extrai(confere_originais(a.originais, a.coletar))
    registro = valida(rec)
    if a.gravar_seed:
        grava_seed(rec)
        print(f"Seed dos recortes sociais da EBIA gravado ({registro['conferencias']}); revisar o manifesto antes de publicar.")
        return
    antigo, _ = le_seed()
    if json.loads(json.dumps(rec)) != antigo:
        raise ValueError("Reextração diverge do seed revisado")
    print("Reextração dos originais confere com o seed revisado.")


if __name__ == "__main__":
    main()
