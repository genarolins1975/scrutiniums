"""Pacote de fatos da nota mensal de conjuntura (piloto da camada de agentes, PR 1).

O pacote é a ÚNICA origem de número que uma nota de conjuntura pode citar. Nenhum
agente calcula, estima ou redige número: o texto referencia fatos por id e o valor
é inserido depois, a partir daqui. Cada fato carrega o ponteiro exato para a gold
publicada (arquivo, série, campo, data de referência), de modo que qualquer leitor
refaz a conta com a mesma gold e chega ao mesmo valor (docs/CONSTITUICAO.md, art. 1).

Três tipos de fato, declarados em cada um:
- observado: valor lido da gold tal como publicado (série BCB/SGS);
- calculado_pipeline: valor já calculado pelo pipeline determinístico e publicado na
  gold (variação em 12 meses nominal e real);
- calculado_pacote: diferença ou variação percentual entre dois valores observados da
  gold, com fórmula e insumos explícitos. Nada além dessas duas operações.

Dado ausente não é estimado: o fato não entra e a lacuna é declarada com motivo.

Uso (somente leitura; não escreve em data/ nem em public/):
    python3 -m pesquisa.fatos_conjuntura                         # imprime o pacote
    python3 -m pesquisa.fatos_conjuntura --saida pacote.json     # grava o pacote
    python3 -m pesquisa.fatos_conjuntura --verificar pacote.json # confere contra a gold
"""
import argparse
import hashlib
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOLD_PUBLICADA = os.path.join(RAIZ, "public", "obs", "data", "gold")
ARQUIVO = "pulse.json"
VERSAO_CONTRATO = 1

# Série que define a data base da nota: o saldo total da carteira (SGS 20539) abre a
# divulgação mensal de estatísticas de crédito do BCB.
SERIE_ANCORA = "saldo_total"

# Escopo do piloto: séries da divulgação de estatísticas monetárias e de crédito do
# BCB já presentes em pulse.json. Selic, IPCA e atividade ficam fora (lacuna declarada
# em ESCOPO_EXCLUIDO): a nota do piloto trata de crédito, não de macro geral.
ESCOPO = [
    ("saldo_total", "Saldo da carteira de crédito, total", "estoque"),
    ("saldo_pf", "Saldo da carteira de crédito, pessoas físicas", "estoque"),
    ("saldo_pj", "Saldo da carteira de crédito, pessoas jurídicas", "estoque"),
    ("concessoes_total", "Concessões de crédito no mês, total", "fluxo"),
    ("concessoes_pf", "Concessões de crédito no mês, pessoas físicas", "fluxo"),
    ("concessoes_pj", "Concessões de crédito no mês, pessoas jurídicas", "fluxo"),
    ("taxa_total", "Taxa média de juros das operações de crédito, total", "taxa"),
    ("taxa_pf", "Taxa média de juros, pessoas físicas", "taxa"),
    ("taxa_pj", "Taxa média de juros, pessoas jurídicas", "taxa"),
    ("spread_total", "Spread médio das operações de crédito, total", "taxa"),
    ("spread_pf", "Spread médio, pessoas físicas", "taxa"),
    ("spread_pj", "Spread médio, pessoas jurídicas", "taxa"),
    ("inad_total", "Inadimplência acima de 90 dias, total", "taxa"),
    ("inad_pf", "Inadimplência acima de 90 dias, pessoas físicas", "taxa"),
    ("inad_pj", "Inadimplência acima de 90 dias, pessoas jurídicas", "taxa"),
    ("credito_pib", "Saldo da carteira de crédito em relação ao PIB", "taxa"),
    ("endividamento", "Endividamento das famílias com o SFN em relação à renda de 12 meses", "taxa"),
    ("comprometimento", "Comprometimento de renda das famílias com o serviço da dívida", "taxa"),
]
ESCOPO_EXCLUIDO = ["selic_meta", "ipca", "ibc_br", "desemprego", "papelao", "cambio"]

UNIDADES_ACEITAS = {"R$ milhões", "%", "% a.a.", "p.p."}
MENOS = "−"  # sinal de menos tipográfico: número negativo não usa hífen


# ---------------------------------------------------------------- formatação

def _num_br(v, casas):
    s = f"{abs(v):,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _sinal(v, casas):
    if round(v, casas) == 0:
        return "0"
    return "+" if v > 0 else MENOS


def _com_sinal(v, casas, sufixo):
    s = _sinal(v, casas)
    corpo = f"{_num_br(v, casas)}{sufixo}"
    return corpo if s == "0" else f"{s}{corpo}"


def _nivel_texto(v, unidade):
    if unidade == "R$ milhões":
        if abs(v) >= 1_000_000:
            return f"R$ {_num_br(v / 1_000_000, 2)} trilhões"
        if abs(v) >= 1_000:
            return f"R$ {_num_br(v / 1_000, 1)} bilhões"
        return f"R$ {_num_br(v, 0)} milhões"
    if unidade == "%":
        return f"{_num_br(v, 2)}%"
    if unidade == "% a.a.":
        return f"{_num_br(v, 2)}% a.a."
    if unidade == "p.p.":
        return f"{_num_br(v, 2)} p.p."
    raise ValueError(f"unidade não prevista no contrato: {unidade!r}")


# ---------------------------------------------------------------- leitura da gold

def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _ler_json(gold_dir, nome):
    with open(os.path.join(gold_dir, nome), encoding="utf-8") as f:
        return json.load(f)


def _valor_em(pulse, origem):
    """Resolve um ponteiro {serie, campo, ref} contra a gold; None se não houver."""
    serie = pulse.get("series", {}).get(origem["serie"]) or {}
    for o in serie.get(origem["campo"]) or []:
        if o.get("ref") == origem["ref"]:
            return o.get("v")
    return None


def _mes_anterior(ref, meses):
    ano, mes = int(ref[:4]), int(ref[5:7])
    total = ano * 12 + (mes - 1) - meses
    return f"{total // 12:04d}-{total % 12 + 1:02d}-01"


def _ultima_ref_ate(serie, data_base):
    refs = [o["ref"] for o in serie.get("obs") or [] if o.get("v") is not None and o["ref"] <= data_base]
    return max(refs) if refs else None


# ---------------------------------------------------------------- construção

def _origem(serie, campo, ref):
    return {"arquivo": ARQUIVO, "serie": serie, "campo": campo, "ref": ref}


def _fato(fid, rotulo, tipo, valor, unidade, texto, data_ref, fonte, origem=None,
          formula=None, insumos=None, texto_abs=None, sinal=None):
    f = {"id": fid, "rotulo": rotulo, "tipo": tipo, "valor": valor, "unidade": unidade,
         "texto": texto, "data_ref": data_ref[:7], "fonte": fonte}
    if texto_abs is not None:
        f["texto_abs"] = texto_abs
        f["sinal"] = sinal
    if origem is not None:
        f["origem"] = origem
    if formula is not None:
        f["formula"] = formula
        f["insumos"] = insumos
    return f


def _aplica(formula, a, b):
    if formula == "diferenca":
        return round(a - b, 6)
    if formula == "variacao_pct":
        return round((a / b - 1) * 100, 6)
    raise ValueError(f"fórmula fora do contrato: {formula!r}")


def _derivado(fatos, lacunas, fid, rotulo, key, ref_a, ref_b, formula, pulse, fonte, unidade_saida, casas):
    oa, ob = _origem(key, "obs", ref_a), _origem(key, "obs", ref_b)
    a, b = _valor_em(pulse, oa), _valor_em(pulse, ob)
    if a is None or b is None:
        falta = ref_b if b is None else ref_a
        lacunas.append({"fato": fid, "motivo": f"observação de {falta[:7]} ausente na gold; não estimada"})
        return
    if formula == "variacao_pct" and b == 0:
        lacunas.append({"fato": fid, "motivo": "base zero; variação percentual indefinida"})
        return
    v = _aplica(formula, a, b)
    sufixo = " p.p." if unidade_saida == "p.p." else "%"
    fatos.append(_fato(fid, rotulo, "calculado_pacote", v, unidade_saida,
                       _com_sinal(v, casas, sufixo), ref_a, fonte,
                       formula=formula, insumos=[oa, ob],
                       texto_abs=f"{_num_br(v, casas)}{sufixo}", sinal=_sinal(v, casas)))


def _do_pipeline(fatos, lacunas, fid, rotulo, key, campo, ref, pulse, fonte):
    o = _origem(key, campo, ref)
    v = _valor_em(pulse, o)
    if v is None:
        lacunas.append({"fato": fid, "motivo": f"campo {campo} sem valor em {ref[:7]} na gold; não estimado"})
        return
    fatos.append(_fato(fid, rotulo, "calculado_pipeline", v, "%", _com_sinal(v, 1, "%"), ref, fonte,
                       origem=o, texto_abs=f"{_num_br(v, 1)}%", sinal=_sinal(v, 1)))


def construir(gold_dir=GOLD_PUBLICADA):
    """Função pura da gold: mesma gold, mesmo pacote (sem relógio, sem rede)."""
    pulse = _ler_json(gold_dir, ARQUIVO)
    series = pulse.get("series") or {}
    ancora = series.get(SERIE_ANCORA)
    if not ancora or not ancora.get("obs"):
        raise ValueError(f"série âncora {SERIE_ANCORA} ausente em {ARQUIVO}: sem data base não há nota")
    data_base = _ultima_ref_ate(ancora, "9999-12-31")

    fatos, lacunas, defasagens, avisos = [], [], [], []
    for key, rotulo, familia in ESCOPO:
        s = series.get(key)
        if not s:
            lacunas.append({"fato": f"{key}.*", "motivo": f"série {key} ausente em {ARQUIVO}"})
            continue
        meta = s.get("meta") or {}
        unidade = meta.get("unit")
        if unidade not in UNIDADES_ACEITAS:
            lacunas.append({"fato": f"{key}.*", "motivo": f"unidade {unidade!r} fora do contrato"})
            continue
        fonte = f"{meta.get('source', '?')} {meta.get('series_code', '?')}"
        ref = _ultima_ref_ate(s, data_base)
        if ref is None:
            lacunas.append({"fato": f"{key}.*", "motivo": "sem observação até a data base"})
            continue
        if ref != data_base:
            defasagens.append({"serie": key, "data_ref": ref[:7], "data_base": data_base[:7],
                               "nota": "divulgação com defasagem própria; citar com a data de referência do fato"})
        o = _origem(key, "obs", ref)
        v = _valor_em(pulse, o)
        fatos.append(_fato(f"{key}.nivel", rotulo, "observado", v, unidade,
                           _nivel_texto(v, unidade), ref, fonte, origem=o))

        if familia == "estoque":
            _derivado(fatos, lacunas, f"{key}.var_mes_pct", f"{rotulo}: variação no mês",
                      key, ref, _mes_anterior(ref, 1), "variacao_pct", pulse, fonte, "%", 1)
        if familia in ("estoque", "fluxo"):
            _do_pipeline(fatos, lacunas, f"{key}.var_12m_pct", f"{rotulo}: variação em 12 meses, nominal",
                         key, "yoy", ref, pulse, fonte)
            _do_pipeline(fatos, lacunas, f"{key}.var_12m_real_pct",
                         f"{rotulo}: variação em 12 meses, real (IPCA)", key, "yoy_real", ref, pulse, fonte)
        if familia == "taxa":
            _derivado(fatos, lacunas, f"{key}.delta_mes_pp", f"{rotulo}: diferença no mês",
                      key, ref, _mes_anterior(ref, 1), "diferenca", pulse, fonte, "p.p.", 2)
            _derivado(fatos, lacunas, f"{key}.delta_12m_pp", f"{rotulo}: diferença em 12 meses",
                      key, ref, _mes_anterior(ref, 12), "diferenca", pulse, fonte, "p.p.", 2)

    gold = {ARQUIVO: {"sha256": _sha256(os.path.join(gold_dir, ARQUIVO)),
                      "gerado_em": pulse.get("gerado_em")}}
    meta_path = os.path.join(gold_dir, "meta.json")
    if os.path.exists(meta_path):
        meta = _ler_json(gold_dir, "meta.json")
        vintage = (meta.get("vintages") or {}).get("sgs")
        gold["meta.json"] = {"sha256": _sha256(meta_path), "gerado_em": meta.get("gerado_em"),
                             "vintage_sgs": vintage}
        if vintage and vintage != data_base[:7]:
            avisos.append(f"meta.json declara vintage SGS {vintage} e a série âncora termina em "
                          f"{data_base[:7]}: conferir antes de redigir")
    else:
        avisos.append("meta.json ausente: vintage SGS não conferido")

    return {
        "tipo": "pacote_fatos_conjuntura",
        "versao_contrato": VERSAO_CONTRATO,
        "data_base": data_base[:7],
        "serie_ancora": SERIE_ANCORA,
        "gold": gold,
        "escopo_excluido": ESCOPO_EXCLUIDO,
        "fatos": fatos,
        "sha256_fatos": sha256_fatos(fatos),
        "lacunas": lacunas,
        "defasagens": defasagens,
        "avisos": avisos,
    }


def sha256_fatos(fatos):
    canon = json.dumps(fatos, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- verificação

def verificar(pacote, gold_dir=GOLD_PUBLICADA):
    """Refaz cada fato a partir do seu ponteiro na gold informada. Devolve a lista de
    divergências (vazia = pacote reproduzível contra esta gold). Revisão posterior da
    fonte aparece aqui como divergência: é informação, não defeito do pacote."""
    pulse = _ler_json(gold_dir, ARQUIVO)
    div = []
    if sha256_fatos(pacote.get("fatos", [])) != pacote.get("sha256_fatos"):
        div.append({"fato": "*", "problema": "sha256_fatos não confere com o conteúdo: pacote alterado após gerado"})
    for f in pacote.get("fatos", []):
        if f["tipo"] in ("observado", "calculado_pipeline"):
            v = _valor_em(pulse, f["origem"])
        elif f["tipo"] == "calculado_pacote":
            a, b = (_valor_em(pulse, o) for o in f["insumos"])
            v = None if a is None or b is None else _aplica(f["formula"], a, b)
        else:
            div.append({"fato": f["id"], "problema": f"tipo desconhecido {f['tipo']!r}"})
            continue
        if v is None:
            div.append({"fato": f["id"], "problema": "ponteiro não resolve na gold informada"})
        elif abs(v - f["valor"]) > 1e-9:
            div.append({"fato": f["id"], "problema": "valor diverge da gold", "pacote": f["valor"], "gold": v})
    return div


# ---------------------------------------------------------------- linha de comando

def main(argv=None):
    ap = argparse.ArgumentParser(description="Pacote de fatos da nota de conjuntura (somente leitura).")
    ap.add_argument("--gold", default=GOLD_PUBLICADA, help="diretório da gold (padrão: a publicada)")
    ap.add_argument("--saida", help="grava o pacote neste arquivo em vez de imprimir")
    ap.add_argument("--verificar", metavar="PACOTE", help="confere um pacote existente contra a gold")
    args = ap.parse_args(argv)

    if args.verificar:
        with open(args.verificar, encoding="utf-8") as f:
            pacote = json.load(f)
        div = verificar(pacote, args.gold)
        for d in div:
            print(json.dumps(d, ensure_ascii=False))
        print(f"{len(pacote.get('fatos', []))} fatos conferidos; {len(div)} divergências")
        return 1 if div else 0

    pacote = construir(args.gold)
    texto = json.dumps(pacote, ensure_ascii=False, indent=1)
    if args.saida:
        with open(args.saida, "w", encoding="utf-8") as f:
            f.write(texto + "\n")
        print(f"{len(pacote['fatos'])} fatos, data base {pacote['data_base']}, "
              f"{len(pacote['lacunas'])} lacunas → {args.saida}")
    else:
        print(texto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
