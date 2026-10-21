"""Gold do capítulo 15: leilões desde o marco, metas contratuais, abrangência por bloco, posição 2024 e estimativas de custo.

Lê só o seed versionado (sem rede) e a gold municipal do Saneamento (public/saneamento/gold), valida (validacoes.py) e
calcula: totais só sobre contratos de serviço adjudicados e conferidos; outorga, contraprestação e investimento nunca
somados entre si; população só quando declarada; posição 2024 do SINISA por bloco com abrangência, ponderada pela
população; proxy do SINISA (concessões declaradas com início de 2020 em diante). Reprovada qualquer validação, levanta
GoldInvalida e nada é gravado.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from pathlib import Path

from . import fontes as F
from . import validacoes as V

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed"
RAIZ = AQUI.parents[1]
GOLD_SANEAMENTO = RAIZ / "public" / "saneamento" / "gold"

ARQUIVOS_SEED = {"leiloes": "leiloes.json", "metas": "metas_contratuais.json", "abrangencia": "abrangencia.json", "custos": "custos.json"}


class GoldInvalida(Exception):
    pass


def ler_seed(pasta: Path = SEED) -> dict:
    out = {}
    for chave, nome in ARQUIVOS_SEED.items():
        out[chave] = json.loads((pasta / nome).read_text(encoding="utf-8"))
    return out


def _hash(obj) -> str:
    return hashlib.sha256(json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


# ------------------------------------------------------------------ gold municipal

def ler_municipios(pasta: Path = GOLD_SANEAMENTO) -> dict[str, dict]:
    t = json.loads((pasta / "municipios.json").read_text(encoding="utf-8"))
    campos = t["campos"]
    return {str(l[0]): dict(zip(campos, l)) for l in t["linhas"]}


def ler_meta(pasta: Path = GOLD_SANEAMENTO) -> dict:
    return json.loads((pasta / "meta.json").read_text(encoding="utf-8"))


def proxy_sinisa(pasta: Path = GOLD_SANEAMENTO) -> dict:
    """Vínculos declarados ao SINISA como "Contrato de Concessão" com início de 2020 em diante: municípios e vínculos por ano.
    Autodeclaração do prestador, sem valor nem meta; serve de ordem de grandeza ao lado da tabela curada."""
    por_ano: dict[int, int] = {}
    municipios: set[str] = set()
    for arq in sorted((pasta / "uf").glob("*.json")):
        uf = json.loads(arq.read_text(encoding="utf-8"))
        for cod, m in uf.items():
            for pr in (m.get("sinisa") or {}).get("prestadores") or []:
                if pr.get("instrumento") != F.INSTRUMENTO_CONCESSAO or not pr.get("inicio"):
                    continue
                try:
                    ano = int(str(pr["inicio"])[-4:])
                except ValueError:
                    continue
                if ano >= F.ANO_MARCO:
                    por_ano[ano] = por_ano.get(ano, 0) + 1
                    municipios.add(str(cod))
    return {"instrumento": F.INSTRUMENTO_CONCESSAO, "desde": F.ANO_MARCO, "vinculos_por_ano": dict(sorted(por_ano.items())), "municipios": len(municipios)}


# ------------------------------------------------------------------ construção

def _soma(linhas: list[dict], campo: str) -> tuple[float, int]:
    vs = [l[campo] for l in linhas if l.get(campo) is not None]
    return round(sum(vs), 3), len(vs)


def totais_leiloes(linhas: list[dict]) -> dict:
    """Só contratos de serviço adjudicados e conferidos; cada natureza de valor somada em separado, com o número de linhas que informam."""
    base = [l for l in linhas if F.conta_nos_totais(l)]
    out = {
        "criterio": "concessão ou PPP, resultado adjudicado e fonte conferida (grau V); venda de ações, leilão sem propostas e linhas só com fonte secundária ficam fora",
        "leiloes_registrados": len(linhas),
        "contratos_de_servico_adjudicados": len([l for l in linhas if l["tipo"] in F.TIPOS_DE_SERVICO and l["resultado"] == "adjudicado"]),
        "nos_totais": len(base),
        "fora_dos_totais": [{"id": l["id"], "motivo": _motivo_fora(l)} for l in linhas if not F.conta_nos_totais(l)],
    }
    for campo in ("outorga_rs_mi", "contraprestacao_rs_mi", "investimento_previsto_rs_mi", "municipios", "populacao_mi"):
        v, n = _soma(base, campo)
        out[campo] = {"soma": v, "linhas_que_informam": n, "linhas_sem_dado": len(base) - n}
    return out


def _motivo_fora(l: dict) -> str:
    if l["tipo"] not in F.TIPOS_DE_SERVICO:
        return "venda de ações ou privatização, não contrato de serviço"
    if l["resultado"] != "adjudicado":
        return f"resultado: {l['resultado'].replace('_', ' ')}"
    return "fonte só secundária (grau S)"


def _pondera(ms: list[dict], campo: str, peso: str = "pop24") -> dict:
    pares = [(m[campo], m[peso]) for m in ms if m.get(campo) is not None and m.get(peso)]
    if not pares:
        return {"valor": None, "municipios_com_dado": 0, "populacao": 0}
    pop = sum(p for _, p in pares)
    return {"valor": round(sum(v * p for v, p in pares) / pop, 2), "municipios_com_dado": len(pares), "populacao": pop}


def _razao(ms: list[dict], num: str, den: str) -> float | None:
    n = sum(m[num] for m in ms if m.get(num) is not None and m.get(den))
    d = sum(m[den] for m in ms if m.get(num) is not None and m.get(den))
    return round(100 * n / d, 2) if d else None


def posicao_blocos(blocos: list[dict], municipios: dict[str, dict], contratos: dict[str, dict]) -> list[dict]:
    """Posição 2024 do SINISA e Censos por bloco com abrangência: médias ponderadas pela população, nunca selo de cumprimento."""
    out = []
    for b in blocos:
        ms = [municipios[str(m["ibge"])] for m in b.get("municipios") or [] if str(m["ibge"]) in municipios]
        parciais = [str(m["ibge"]) for m in b.get("municipios") or [] if m.get("parcial")]
        c = contratos.get(b["contrato"])
        meta_2024 = {}
        if c:
            for m in c.get("metas") or []:
                if m["ano"] <= 2024:
                    meta_2024[m["indicador"]] = m["valor"]  # a última meta até 2024 (série ordenada abaixo)
        out.append({
            "bloco": b["id"],
            "rotulo": b.get("rotulo") or b["id"],
            "contrato": b["contrato"],
            "municipios": len(ms),
            "municipios_divididos_por_zona": parciais,
            "pop24": sum(m["pop24"] or 0 for m in ms),
            "pop22": sum(m["pop22"] or 0 for m in ms),
            "sinisa_2024": {
                "IAG0001": _pondera(ms, "IAG0001"),
                "IES0001": _pondera(ms, "IES0001"),
                "IES0007": _pondera(ms, "IES0007"),
            },
            "censo": {
                "agua_rede_2010": _razao(ms, "c10_ag_rede", "c10_mor"),
                "agua_rede_2022": _razao(ms, "c22_ag_rede", "pop22"),
                "esgoto_rede_2010": _razao(ms, "c10_es_rede", "c10_mor"),
                "esgoto_rede_2022": _razao(ms, "c22_es_rede_pluvial", "pop22"),
            },
            "meta_contratual_ate_2024": meta_2024,
            "ressalva": "ICA e ICE do contrato não são os indicadores do SINISA nem a cobertura por rede do Censo; a comparação é de ordem de grandeza, não aferição.",
        })
    return out


def construir(seed: dict) -> dict:
    leiloes = seed["leiloes"]["linhas"]
    contratos = seed["metas"]["contratos"]
    blocos = seed["abrangencia"]["blocos"]
    custos = seed["custos"]["estimativas"]
    municipios = ler_municipios()
    problemas = (
        V.validar_leiloes(leiloes)
        + V.validar_metas(contratos, leiloes)
        + V.validar_abrangencia(blocos, leiloes, contratos, set(municipios))
        + V.validar_custos(custos)
    )
    if problemas:
        raise GoldInvalida("publicação retida:\n" + "\n".join(f"- [{t}] {m}" for t, m in problemas))

    leiloes_ord = sorted(leiloes, key=lambda l: (l["data_leilao"], l["id"]))
    for c in contratos:
        c["metas"] = sorted(c.get("metas") or [], key=lambda m: (m["indicador"], m["ano"]))
    por_contrato = {c["id"]: c for c in contratos}
    blocos_por_contrato: dict[str, list[str]] = {}
    for b in blocos:
        blocos_por_contrato.setdefault(b["contrato"], []).append(b["id"])
    meta_sinisa = ler_meta()
    g = {
        "versao": 1,
        "capturado_em": max([l["fonte"].get("acessado_em", "") for l in leiloes] + [c.get("documento", {}).get("capturado_em", "") for c in contratos]),
        "marco": {"lei": "Lei 14.026/2020", "ano": F.ANO_MARCO, "meta_legal": {"agua": meta_sinisa["metas"]["agua"], "esgoto": meta_sinisa["metas"]["esgoto"], "ano": F.ANO_META_LEGAL}},
        "leiloes": leiloes_ord,
        "totais": totais_leiloes(leiloes_ord),
        "proxy_sinisa": proxy_sinisa(),
        "contratos": [
            {**c, "blocos": blocos_por_contrato.get(c["id"], []), "ultimo_ano_meta": max((m["ano"] for m in c["metas"]), default=None)}
            for c in contratos
        ],
        "nao_lidos": seed["metas"].get("nao_lidos", []),
        "abrangencia": [
            {"id": b["id"], "rotulo": b.get("rotulo") or b["id"], "contrato": b["contrato"], "inicio": b["inicio"], "fim": b.get("fim"), "fonte": b["fonte"], "declarado_municipios": b.get("declarado_municipios"), "observacoes": b.get("observacoes"),
             "municipios": [{"ibge": str(m["ibge"]), "nome": municipios[str(m["ibge"])]["nome"], "uf": municipios[str(m["ibge"])]["uf"], "parcial": m.get("parcial")} for m in b.get("municipios") or []]}
            for b in blocos
        ],
        "posicao_2024": posicao_blocos(blocos, municipios, por_contrato),
        "abrangencia_nao_localizada": seed["abrangencia"].get("nao_localizadas", []),
        "em_estruturacao": seed["leiloes"].get("em_estruturacao", []),
        "custos": custos,
        "custos_nao_localizados": seed["custos"].get("nao_localizadas", []),
    }
    g["hash_dados"] = _hash({k: g[k] for k in ("leiloes", "contratos", "abrangencia", "custos", "proxy_sinisa", "abrangencia_nao_localizada", "em_estruturacao", "custos_nao_localizados")})
    return g


def resumo(g: dict) -> dict:
    """Contagens para a entrada, o aperitivo e o mapa logado, sem a série."""
    t = g["totais"]
    transcritos = [c for c in g["contratos"] if c["situacao"] == "transcrito"]
    return {
        "capturado_em": g["capturado_em"],
        "leiloes_registrados": t["leiloes_registrados"],
        "contratos_de_servico_adjudicados": t["contratos_de_servico_adjudicados"],
        "nos_totais": t["nos_totais"],
        "investimento_previsto_rs_mi": t["investimento_previsto_rs_mi"]["soma"],
        "investimento_linhas": t["investimento_previsto_rs_mi"]["linhas_que_informam"],
        "contratos_com_metas": len(transcritos),
        "indicadores_transcritos": sorted({m["indicador"] for c in transcritos for m in c["metas"]}),
        "blocos_com_abrangencia": len(g["abrangencia"]),
        "municipios_proxy_sinisa": g["proxy_sinisa"]["municipios"],
        "estimativas_de_custo": len(g["custos"]),
        "hash_dados": g["hash_dados"],
    }


CSV_CAMPOS = ["id", "uf", "poder_concedente", "objeto", "data_leilao", "tipo", "resultado", "vencedor", "outorga_rs_mi", "contraprestacao_rs_mi",
              "investimento_previsto_rs_mi", "municipios", "populacao_mi", "prazo_anos", "servicos", "nos_totais", "fonte_url", "fonte_titulo", "fonte_data", "grau", "tipo_fonte"]


def csv_texto(leiloes: list[dict]) -> str:
    s = io.StringIO()
    w = csv.writer(s, delimiter=";", lineterminator="\n")
    w.writerow(CSV_CAMPOS)
    for l in leiloes:
        f = l["fonte"]
        w.writerow([l["id"], l["uf"], l["poder_concedente"], l["objeto"], l["data_leilao"], l["tipo"], l["resultado"], l.get("vencedor") or "",
                    *("" if l.get(c) is None else l[c] for c in ("outorga_rs_mi", "contraprestacao_rs_mi", "investimento_previsto_rs_mi", "municipios", "populacao_mi", "prazo_anos")),
                    l["servicos"], "sim" if F.conta_nos_totais(l) else "nao", f["url"], f["titulo"], f["data"], f["grau"], f["tipo_fonte"]])
    return s.getvalue()
