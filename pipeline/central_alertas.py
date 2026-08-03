"""Consolidação dos alertas do Observatório numa única fonte normalizada.

Antes deste módulo cada painel guardava os seus próprios alertas com um formato
diferente — macro em ``alerts.json``, carteira em ``panorama.json``, Open Finance
em ``openfinance.json``, antecedentes em ``leading.json``. Quem quisesse saber
"o que exige atenção hoje" tinha de visitar quatro páginas, e o contador do
cabeçalho mostrava apenas a família macro (2 de 24).

O que este módulo NÃO faz, deliberadamente:

* não soma alertas de famílias diferentes num placar único;
* não cria uma escala de severidade comum;
* não reordena famílias entre si por gravidade.

As famílias observam universos distintos (agregado do SFN, submodalidade do
SCR.data, API do Open Finance, subíndice antecedente) em periodicidades
distintas (mensal, data-base trimestral, semanal). "Três alertas de carteira"
e "três alertas macro" não são a mesma quantidade de nada. A consolidação é de
lugar — um só endereço —, não de escala: cada alerta chega com o universo, a
periodicidade, a regra que o disparou, a evidência de persistência da própria
família e o link para a página onde ele está contextualizado.

A ordenação existe apenas DENTRO de cada família, pelo critério que faz sentido
para aquele universo, declarado em ``ordenacao``.
"""
import json
import os

from pipeline import common

# Cada família declara o que a torna incomparável com as outras. Estes textos vão
# para a interface: são a razão de o painel ser dividido em seções, não uma lista.
FAMILIAS = [
    {
        "id": "macro",
        "nome": "Macro do sistema",
        "universo": "Agregados do Sistema Financeiro Nacional",
        "periodicidade": "mensal",
        "fonte": "BCB/SGS + detector de regimes",
        "regra_geral": "limiares determinísticos sobre nível, Δ3m ou variação interanual, definidos em config.json",
        "ordenacao": "excedente relativo ao limiar (|valor − limiar| ÷ |limiar|), decrescente",
        "persistencia": "número de execuções anteriores em que a mesma regra disparou",
        "limitacao": "Séries agregadas: um alerta macro descreve o sistema, nunca uma instituição.",
        "view": "pulse",
    },
    {
        "id": "carteira",
        "nome": "Carteira por submodalidade",
        "universo": "SCR.data — submodalidades de crédito com carteira ≥ R$ 20 bi",
        "periodicidade": "data-base (trimestral)",
        "fonte": "BCB/SCR.data",
        "regra_geral": ("alta em 2 datas-base consecutivas e (Δ3m ≥ 0,30 p.p. ou Δ12m ≥ 0,75 p.p.), "
                        "carteira ≥ R$ 20 bi e base estável (±30% em 3 datas)"),
        "ordenacao": "variação em 12 meses (p.p.), decrescente",
        "persistencia": "a própria regra exige alta em 2 datas-base consecutivas",
        "limitacao": ("Inadimplência arrastada por submodalidade: o ciclo do cartão migra saldos entre "
                      "à vista, rotativo e parcelamento entre datas-base, então o nível por submodalidade "
                      "não é comparável às séries SGS por modalidade."),
        "view": "panorama",
    },
    {
        "id": "openfinance",
        "nome": "Open Finance",
        "universo": "APIs e endpoints do ecossistema Open Finance",
        "periodicidade": "semanal",
        "fonte": "Dashboard do Cidadão (Open Finance Brasil)",
        "regra_geral": "indicador técnico abaixo do limiar publicado, com persistência em semanas",
        "ordenacao": "semanas de persistência, decrescente",
        "persistencia": "semanas consecutivas fora do limiar",
        "limitacao": "Métrica de disponibilidade técnica do ecossistema; não mede risco de crédito.",
        "view": "openfinance",
    },
    {
        "id": "antecedentes",
        "nome": "Sinais antecedentes",
        "universo": "Subíndices antecedentes (FIDC e afins) padronizados",
        "periodicidade": "mensal",
        "fonte": "subíndices calculados sobre CVM/FIDC e séries do BCB",
        "regra_geral": "z > 1,0 com persistência ≥ 2 meses e alta em 3 meses",
        "ordenacao": "desvio padronizado (z), decrescente",
        "persistencia": "meses consecutivos acima do limiar",
        "limitacao": ("Antecedência é hipótese estatística sujeita a revisão, não previsão. "
                      "Ausência de alerta não significa ausência de risco."),
        "view": "leading",
    },
]

NIVEIS = ["informativo", "atencao", "relevante", "critico"]


def _gold(nome):
    caminho = os.path.join(common.GOLD, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as fh:
        return json.load(fh)


def _num(v):
    return v if isinstance(v, (int, float)) else None


def _macro(d):
    """alerts.json: já vem no formato mais rico — nível declarado e recorrência."""
    out = []
    for a in d.get("alertas", []):
        valor, limiar = _num(a.get("valor")), _num(a.get("limiar"))
        # excedente relativo: única ordenação possível numa família cujas regras
        # têm unidades diferentes (p.p., %, dias). Fica dentro da família.
        exc = abs(valor - limiar) / abs(limiar) if valor is not None and limiar not in (None, 0) else 0.0
        out.append({
            "id": f"macro:{a['id']}",
            "familia": "macro",
            "nivel": a.get("nivel"),
            "titulo": a.get("titulo"),
            "detalhe": a.get("explicacao"),
            "valor": valor,
            "limiar": limiar,
            "referencia": (a.get("ref") or "")[:7] or None,
            "fonte": a.get("fonte"),
            "evidencia_persistencia": (f"{a['disparos_anteriores']} execuções anteriores"
                                       if a.get("disparos_anteriores") else None),
            "recorrente": bool(a.get("recorrente")),
            "link": {"view": "pulse"} if a.get("serie") and a.get("serie") != "*" else {"view": "method"},
            "ordem": round(exc, 6),
        })
    return out


def _carteira(d):
    """panorama.json: a fonte não declara nível — e nós não inventamos um."""
    out = []
    for a in d.get("alertas", []):
        d12, d3 = _num(a.get("delta_12m_pp")), _num(a.get("delta_pp"))
        partes = []
        if d3 is not None:
            partes.append(f"Δ3m {d3:+.2f} p.p.")
        if d12 is not None:
            partes.append(f"Δ12m {d12:+.2f} p.p.")
        saldo = _num(a.get("saldo_grupo"))
        if saldo:
            partes.append(f"carteira R$ {saldo / 1e9:,.1f} bi".replace(",", "."))
        out.append({
            "id": f"carteira:{a.get('tipo')}:{a.get('grupo')}",
            "familia": "carteira",
            "nivel": None,  # a fonte não gradua; graduar aqui seria inventar
            "titulo": f"{a.get('grupo')} — {a.get('indicador')}",
            "detalhe": (f"{_num(a.get('anterior')):.2f}% → {_num(a.get('atual')):.2f}% "
                        f"({a.get('periodo')}). " + " · ".join(partes) + ". " + (a.get("nota") or "")).strip(),
            "valor": _num(a.get("atual")),
            "limiar": None,
            "referencia": (a.get("periodo") or "").split("→")[-1].strip() or None,
            "fonte": "BCB/SCR.data",
            "evidencia_persistencia": "alta em 2 datas-base consecutivas (exigido pela regra)",
            "recorrente": None,
            "link": a.get("link") or {"view": "panorama"},
            "ordem": round(d12 if d12 is not None else (d3 or 0), 6),
        })
    return out


def _openfinance(d):
    out = []
    for a in d.get("alertas_of", []):
        sem = _num(a.get("persistencia_semanas")) or 0
        out.append({
            "id": f"openfinance:{a.get('indicador')}",
            "familia": "openfinance",
            "nivel": a.get("severidade"),
            "titulo": a.get("indicador"),
            "detalhe": (f"{_num(a.get('valor')):.2f} contra limiar {a.get('limiar')} "
                        f"há {int(sem)} semanas (dado de {a.get('data')})."),
            "valor": _num(a.get("valor")),
            "limiar": _num(a.get("limiar")),
            "referencia": a.get("data"),
            "fonte": a.get("fonte"),
            "evidencia_persistencia": f"{int(sem)} semanas consecutivas fora do limiar" if sem else None,
            "recorrente": sem >= 4 if sem else None,
            "link": {"view": "openfinance"},
            "ordem": sem,
        })
    return out


def _antecedentes(d):
    out = []
    for a in d.get("alertas", []):
        z = _num(a.get("observed_value")) or 0
        fonte = a.get("fonte")
        out.append({
            "id": f"antecedentes:{a.get('id') or a.get('explanation', '')[:40]}",
            "familia": "antecedentes",
            "nivel": a.get("severity"),
            "titulo": a.get("explanation"),
            "detalhe": (f"z = {z:.2f} contra limiar {a.get('threshold')}, persistência "
                        f"{a.get('persistence')} meses (ref. {a.get('reference_date')})."),
            "valor": round(z, 4),
            "limiar": _num(a.get("threshold")),
            "referencia": a.get("reference_date"),
            "fonte": ", ".join(fonte) if isinstance(fonte, list) else fonte,
            "evidencia_persistencia": (f"{a['persistence']} meses consecutivos acima do limiar"
                                       if a.get("persistence") else None),
            "recorrente": None,
            "link": {"view": "leading"},
            "ordem": round(z, 6),
        })
    return out


EXTRATORES = {
    "macro": (_macro, "alerts.json"),
    "carteira": (_carteira, "panorama.json"),
    "openfinance": (_openfinance, "openfinance.json"),
    "antecedentes": (_antecedentes, "leading.json"),
}


def build():
    """Lê os gold já escritos e consolida. Sem dependência do warehouse:
    roda no fim do pipeline ou sozinho, sobre os JSON existentes."""
    familias, itens, ausentes = [], [], []
    for fam in FAMILIAS:
        extrair, arquivo = EXTRATORES[fam["id"]]
        d = _gold(arquivo)
        if d is None:
            ausentes.append({"familia": fam["id"], "arquivo": arquivo,
                             "motivo": "arquivo gold não encontrado nesta execução"})
            registros = []
        else:
            registros = extrair(d)
        registros.sort(key=lambda x: -(x.get("ordem") or 0))
        itens.extend(registros)
        familias.append({**fam, "ativos": len(registros), "arquivo": arquivo,
                         "disponivel": d is not None})

    payload = {
        "gerado_em": common.now_utc(),
        "familias": familias,
        "alertas": itens,
        "total": len(itens),
        "niveis": NIVEIS,
        "nao_comparavel": (
            "Os alertas vêm de universos e periodicidades diferentes — agregados do SFN (mensal), "
            "submodalidades do SCR.data (data-base trimestral), APIs do Open Finance (semanal) e "
            "subíndices antecedentes (mensal). Esta página reúne o LUGAR onde eles são consultados, "
            "não uma escala comum de gravidade: não some famílias, não compare contagens entre elas "
            "e não leia a ordem de uma seção como prioridade sobre outra."
        ),
        "sem_nivel": (
            "Onde a fonte não gradua severidade — é o caso da carteira do SCR.data — o alerta aparece "
            "sem nível. Atribuir um aqui seria criar informação que o dado não tem."
        ),
        "ausencia": (
            "Ausência de alerta significa que nenhuma regra publicada foi disparada nesta data-base. "
            "Não significa ausência de risco: as regras cobrem o que é observável nas fontes oficiais."
        ),
        "estado_local": (
            "O estado de cada alerta (em análise, acompanhado, resolvido, descartado) é seu e fica "
            "salvo apenas neste navegador. Nada é enviado ao servidor."
        ),
        "fontes_ausentes": ausentes,
    }
    common.write_gold("alertas_central.json", payload)
    return payload


def rss(payload, base_url="https://scrutiniums.com/observatorio/alerts"):
    """Feed único com todas as famílias. Cada item declara a família no título,
    porque o assinante não tem a página à frente para dar o contexto."""
    por_id = {f["id"]: f for f in payload["familias"]}
    itens = []
    for a in payload["alertas"]:
        fam = por_id.get(a["familia"], {})
        nivel = (a.get("nivel") or "sem nível declarado").upper()
        corpo = (f"{a.get('detalhe') or ''}\n\n"
                 f"Família: {fam.get('nome')} · universo: {fam.get('universo')} · "
                 f"periodicidade: {fam.get('periodicidade')} · fonte: {a.get('fonte')}\n"
                 f"Regra: {fam.get('regra_geral')}\n"
                 f"Limitação: {fam.get('limitacao')}")
        itens.append(
            f"<item><title>[{fam.get('nome', a['familia'])} · {nivel}] {common.xml_escape(a['titulo'])}</title>"
            f"<link>{base_url}</link>"
            f"<description><![CDATA[{corpo}]]></description>"
            f"<guid isPermaLink=\"false\">{common.xml_escape(a['id'])}:{payload['gerado_em'][:10]}</guid></item>")
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel>"
        "<title>Observatório Brasileiro de Crédito — Central de alertas</title>"
        f"<link>{base_url}</link>"
        "<description>Alertas das quatro famílias monitoradas (macro, carteira, Open Finance e "
        "sinais antecedentes). Universos e periodicidades diferentes: cada item declara o seu. "
        "Para receber por e-mail, assine este feed em qualquer serviço RSS-para-e-mail.</description>"
        + "".join(itens) + "</channel></rss>")


if __name__ == "__main__":  # pragma: no cover — uso manual sobre gold existente
    p = build()
    common.write_gold_text("alertas.xml", rss(p))
    print(f"alertas_central.json: {p['total']} alertas em {len(p['familias'])} famílias")
    for f in p["familias"]:
        print(f"  {f['id']:<14} {f['ativos']:>3} · {f['periodicidade']}")
