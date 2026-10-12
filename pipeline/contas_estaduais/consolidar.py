"""Reproduz a base nacional exclusivamente a partir dos bytes Siconfi arquivados.

Executar: python3 -m pipeline.contas_estaduais.consolidar [--check]
Conferência da fonte significa identidade, campos e aritmética; não auditoria.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from pipeline.contas_estaduais.coletar import UFS, mapear_rgf, CONTAS
from pipeline.contas_estaduais.financiamento import mapear as mapear_financiamento, CAMPOS as CAMPOS_FINANCIAMENTO

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "public/contas-estaduais/evidencias/20261012-nacional"
OUT = ROOT / "src/lib/contas-estaduais/primarios.json"
RECEITA = "ReceitasExcetoIntraOrcamentarias"
DESPESA = "DespesasExcetoIntraOrcamentarias"
CAMPOS = {
    "receita_prevista": (RECEITA, "PREVISÃO INICIAL"),
    "receita_arrecadada": (RECEITA, "Até o Bimestre (c)"),
    "dotacao_inicial": (DESPESA, "DOTAÇÃO INICIAL (d)"),
    "dotacao_atualizada": (DESPESA, "DOTAÇÃO ATUALIZADA (e)"),
    "empenhada": (DESPESA, "DESPESAS EMPENHADAS ATÉ O BIMESTRE (f)"),
    "liquidada": (DESPESA, "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)"),
    "paga": (DESPESA, "DESPESAS PAGAS ATÉ O BIMESTRE (j)"),
}

def identidade(itens, uf, ano, fonte, periodo):
    for r in itens:
        esperado = dict(uf=uf, exercicio=ano, cod_ibge=UFS[uf], periodo=periodo,
                        esfera="E", periodicidade="Q" if fonte == "rgf" else "B",
                        anexo="RGF-Anexo 02" if fonte == "rgf" else "RREO-Anexo 01")
        if fonte == "rgf":
            esperado["co_poder"] = "E"
        if any(r.get(k) != v for k, v in esperado.items()):
            raise ValueError("Identidade, período ou perímetro incompatível")

def mapear_rreo(itens, uf, ano):
    identidade(itens, uf, ano, "rreo", 6)
    valores = {}
    for campo, (conta, coluna) in CAMPOS.items():
        linhas = [r for r in itens if r.get("cod_conta") == conta and r.get("coluna") == coluna]
        if len(linhas) != 1:
            raise ValueError(f"Campo ausente ou duplicado: {campo}")
        valor = linhas[0].get("valor")
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor) or valor < 0:
            raise ValueError(f"Valor inválido: {campo}")
        valores[campo] = valor
    v = valores
    if any(v[c] <= 0 for c in ("receita_prevista", "dotacao_atualizada", "empenhada", "liquidada")):
        raise ValueError("Denominador não positivo; não converter em zero")
    if v["paga"] > v["liquidada"] + .02 or v["liquidada"] > v["empenhada"] + .02 or v["empenhada"] > v["dotacao_atualizada"] + .02:
        raise ValueError("Ordem dos estágios incompatível; requer conferência")
    f = mapear_financiamento(itens, v["receita_arrecadada"])
    return dict(valores=v, financiamento=f, indicadores={
        **f["indicadores"],
        "CE-01": 100 * (v["receita_arrecadada"] / v["receita_prevista"] - 1),
        "CE-04": 100 * v["liquidada"] / v["dotacao_atualizada"],
        "CE-05": 100 * v["liquidada"] / v["empenhada"],
        "CE-06": 100 * v["paga"] / v["liquidada"],
    })

def ler(registro, pasta):
    if registro["status"] != "capturado":
        raise ValueError("Captura incompleta")
    itens, fontes, offset = [], [], 0
    paginas = registro["paginas"]
    for i, pagina in enumerate(paginas):
        caminho = pasta / (registro["uf"] + "-" + registro["fonte"]) / pagina["arquivo"]
        bruto = caminho.read_bytes()
        if hashlib.sha256(bruto).hexdigest() != pagina["sha256"]:
            raise ValueError("Integridade SHA-256 divergente")
        d = json.loads(bruto)
        if pagina["offset"] != offset or d.get("offset") != offset or d.get("hasMore") is not (i < len(paginas)-1):
            raise ValueError("Paginação inconsistente")
        if len(d["items"]) != pagina["linhas"]:
            raise ValueError("Contagem de linhas divergente")
        itens.extend(d["items"])
        offset += len(d["items"])
        fontes.append(dict(url=pagina["url"], capturado_em=pagina["capturado_em"],
                           sha256=pagina["sha256"], arquivo="/" + str(caminho.relative_to(ROOT / "public"))))
    if len(itens) != registro["linhas"]:
        raise ValueError("Total de linhas divergente")
    return itens, fontes

def consolidar():
    resultado = dict(versao="0.4.0", captura="2026-10-12", escopo_conferencia="Identidade do ente, período, campos, integridade dos bytes e aritmética. Não constitui auditoria, certificação do Tesouro ou avaliação de eficiência.",
                     perimetro_rreo="RREO Anexo 01, esfera estadual, acumulado janeiro a dezembro. Linhas de receitas e despesas exceto intra-orçamentárias; refinanciamento destacado fora dessas linhas. Valores nominais declarados; não inclui pagamentos de restos de exercícios anteriores.",
                     campos_rreo={k: dict(cod_conta=v[0], coluna=v[1]) for k, v in CAMPOS.items()},
                     campos_financiamento={k: dict(cod_conta=v[0], coluna=v[1]) for k, v in CAMPOS_FINANCIAMENTO.items()},
                     campos_rgf=CONTAS, rgf=[], rreo=[])
    chaves = set()
    for nome in ("anual", "parcial"):
        pasta = RAW / nome
        for registro in json.loads((pasta / "manifesto.json").read_text())["registros"]:
            uf, ano, fonte = (registro[k] for k in ("uf", "ano", "fonte"))
            periodo = registro["parametros"]["nr_periodo"]
            chave = (uf, ano, fonte, periodo)
            if chave in chaves:
                raise ValueError("Observação duplicada")
            chaves.add(chave)
            itens, fontes = ler(registro, pasta)
            identidade(itens, uf, ano, fonte, periodo)
            obs = dict(uf=uf, ano=ano, periodo=periodo, fontes=fontes, status="fonte_primaria_conferida")
            if fonte == "rgf":
                m = mapear_rgf(itens, uf, ano, periodo)
                if m["status"] != "mapeamento_candidato" or abs(m["diferenca_pp"]) > .005 + 1e-9:
                    raise ValueError("DCL/RCL não reconcilia às duas casas declaradas")
                obs.update(valores=m["valores"], percentual_calculado=m["percentual_calculado"], diferenca_pp=m["diferenca_pp"])
            else:
                obs.update(mapear_rreo(itens, uf, ano))
            resultado[fonte].append(obs)
    resultado["cobertura"] = dict(respostas=len(chaves), ufs=len({r["uf"] for r in resultado["rgf"] + resultado["rreo"]}), observacoes=len(resultado["rgf"])+6*len(resultado["rreo"]))
    return resultado

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    texto = json.dumps(consolidar(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if OUT.read_text() != texto:
            raise SystemExit("Dados publicados divergem da reprodução")
        print("81 capturas íntegras; 216 observações reproduzidas.")
    else:
        OUT.write_text(texto)
