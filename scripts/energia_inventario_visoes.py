"""Gera o inventário de visões do redesenho (`docs/energia/INVENTARIO_VISOES_REDESENHO.md`) e o inventário de páginas
(`docs/energia/redesign/INVENTARIO.md`) a partir do rastreamento mecânico das visões (energia-visoes.mjs), das medidas da primeira
tela, do inventário de público e tarefa e do código das páginas.

Antes da migração (--antes) cada linha traz a localização atual e a localização proposta; depois da migração (--depois, com o
rastreamento do SHA final) o comparador (energia_visoes_compara.py) preenche a nova localização e a evidência de funcionamento.

Uso:
  python3 scripts/energia_inventario_visoes.py --antes docs/energia/redesign/dados/visoes_antes.json
      [--medidas docs/energia/redesign/dados/medidas_antes.json] [--situacao docs/energia/redesign/situacao_migracao.json]
Sem dependências além da biblioteca padrão.
"""
import argparse
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RD = os.path.join(RAIZ, "docs", "energia", "redesign")
P = "/setor-eletrico"

COMPONENTE = {
    "linhas": "GraficoLinhas",
    "barras": "GraficoBarras",
    "pontos": "GraficoPontos",
    "histograma": "GraficoHistograma",
    "dispersao": "GraficoDispersao",
    "mapa-calor": "MapaCalor",
    "pequenos-multiplos": "PequenosMultiplos",
    "linha-do-tempo": "LinhaDoTempo",
    "cronograma": "Cronograma",
}
TIPO_LEGIVEL = {
    "painel": "painel de evidência",
    "grafico": "gráfico",
    "tabela": "tabela analítica",
    "tabela-recolhida": "tabela equivalente do gráfico (recolhida)",
    "tabela-sob-demanda": "tabela carregada sob demanda",
    "visao-sob-demanda": "visão carregada sob demanda",
    "mapa": "mapa",
    "diagrama": "diagrama",
    "comprove": "fichas Comprove este número",
}


# visões da inicial que o rastreador mecânico não enxerga (componentes sem SVG nem atributo de gráfico)
MANUAIS = {
    P: [
        ("Busca por pergunta, conceito, página ou distribuidora", "busca", "BuscaObservatorio"),
        ("Mapa conceitual do setor elétrico: sete elos e tipos de ligação", "mapa conceitual interativo", "MapaConceitual"),
        ("Perguntas do dia a dia com seletor de distribuidora (perdas e qualidade)", "perguntas com seletor", "EscolhaDistribuidora"),
        ("Trilhas por interesse", "trilhas de leitura", "TRILHAS (mapa.ts)"),
        ("Atualidade das fontes principais (tabela por tema, fonte e período)", "tabela analítica", "tabela estática da página"),
        ("Exemplo real do arquivo à página, com ficha Comprove este número", "ficha de prova", "ComproveNumero"),
    ],
}


def slug(rota):
    return re.sub(r"[^a-z0-9]+", "_", re.sub(r"^/setor-eletrico/?", "", rota, flags=re.I)).strip("_") or "raiz"


def arquivo_da_pagina(rota):
    """Caminho do page.tsx de uma rota, resolvendo segmentos dinâmicos ([dataset], [entidade], [conceito], [modelo], [trilha])."""
    partes = [x for x in rota.replace(P, "").strip("/").split("/") if x]
    atual = os.path.join(RAIZ, "src", "app", "setor-eletrico")
    for x in partes:
        direto = os.path.join(atual, x)
        if os.path.isdir(direto):
            atual = direto
            continue
        dinamicos = [d for d in os.listdir(atual) if d.startswith("[") and os.path.isdir(os.path.join(atual, d))]
        if not dinamicos:
            return None
        atual = os.path.join(atual, dinamicos[0])
    f = os.path.join(atual, "page.tsx")
    return f if os.path.exists(f) else None


def contratos(arquivo):
    if not arquivo:
        return []
    t = open(arquivo, encoding="utf-8").read()
    achados = re.findall(r'lerGold<[^>]*>\(\s*"([^"]+\.json)"', t) + re.findall(r'lerGold\(\s*"([^"]+\.json)"', t)
    achados += [f"gold.{m}()" for m in re.findall(r"\bgold\.([a-z_]+)\(\)", t)]
    return list(dict.fromkeys(achados))


def componentes_da_pagina(arquivo):
    if not arquivo:
        return []
    t = open(arquivo, encoding="utf-8").read()
    comps = re.findall(r'import \{([^}]+)\} from "@/components/energia/([A-Za-z]+)"', t)
    nomes = []
    for _, mod in comps:
        if mod not in nomes and mod not in ("CabecalhoEnergia", "ComproveNumero", "Numero", "TabelaInterativa", "RespostaCurta", "CabecalhoModulo"):
            nomes.append(mod)
    return nomes


def limpa(s, n=160):
    s = re.sub(r"(◆|●|◐|◌|◇)Natureza do dado: [A-Za-zçãé]+", "", s or "")
    s = re.sub(r"\s+", " ", s).strip(" ·")
    return (s[: n - 1] + "…") if len(s) > n else s


def local(niveis):
    n = set(niveis)
    if "entender" in n:
        return "a partir de Entender"
    if "analisar" in n:
        return "a partir de Analisar"
    return "somente Auditar"


def componente(v):
    if v["tipo"] == "grafico":
        return COMPONENTE.get(v.get("forma", ""), "Grafico" + (v.get("forma", "") or "").title() if v.get("forma") else "gráfico")
    return {
        "painel": "PainelEvidencia",
        "tabela": "TabelaInterativa",
        "tabela-recolhida": "resumo em tabela do gráfico",
        "tabela-sob-demanda": "tabela sob demanda",
        "visao-sob-demanda": "visão sob demanda",
        "mapa": "mapa (SVG com geometria oficial)",
        "diagrama": "diagrama",
        "comprove": "ComproveNumero",
    }.get(v["tipo"], v["tipo"])


def proposta(v, abertura):
    t = v["tipo"]
    niv = local(v.get("niveis", []))
    if t in ("grafico", "mapa", "diagrama") and abertura and niv != "a partir de Entender":
        return "Mesma rota e mesmo painel; promovida a Entender como seção visível com pergunta própria"
    if t == "painel":
        return "Mesma rota e mesmo id; apresentação do sistema editorial (notas junto da figura, porque importa recolhido)"
    if t in ("tabela", "tabela-recolhida", "tabela-sob-demanda"):
        return "Mesma rota e mesmo painel; tabela equivalente mantida, recolhida em Entender e aberta em Analisar"
    return "Mesma rota e mesmo painel; mesmo nível, apresentação do sistema editorial"


def tipo_pagina(rota):
    r = rota.replace(P, "")
    if r == "":
        return "porta de entrada"
    if re.match(r"^/aprenda/(trilhas)?$", r) or r == "/aprenda":
        return "índice de conhecimento"
    if r.startswith("/aprenda/trilhas/"):
        return "trilha de leitura"
    if r.startswith("/aprenda/"):
        return "verbete"
    if r.startswith("/dados/") and r not in ("/dados/reproducao", "/dados/saude"):
        return "ficha de conjunto de dados"
    if r in ("/dados", "/dados/reproducao", "/dados/saude"):
        return "catálogo e documentação de dados"
    if r == "/metodologia":
        return "documento metodológico"
    if r.startswith("/empresas/") and r.split("/")[2] not in ("ativos", "controle", "distribuidoras", "financas"):
        return "ficha de entidade"
    if r.startswith("/pld/modelos/"):
        return "ficha de modelo"
    if r in ("/pld/modelos", "/pld/previsoes"):
        return "página analítica de previsão"
    if r.count("/") == 1:
        return "abertura temática"
    return "página analítica"


def principal(familias, rota):
    melhor = None
    for pref in familias:
        if rota == pref or rota.startswith(pref + "/"):
            if melhor is None or len(pref) > len(melhor):
                melhor = pref
    return familias[melhor] if melhor else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antes", required=True)
    ap.add_argument("--medidas")
    ap.add_argument("--situacao", default=os.path.join(RD, "situacao_migracao.json"))
    ap.add_argument("--saida-visoes", default=os.path.join(RAIZ, "docs", "energia", "INVENTARIO_VISOES_REDESENHO.md"))
    ap.add_argument("--saida-paginas", default=os.path.join(RD, "INVENTARIO.md"))
    a = ap.parse_args()

    rastreio = json.load(open(a.antes, encoding="utf-8"))
    familias = json.load(open(os.path.join(RD, "publico_tarefa.json"), encoding="utf-8"))["familias"]
    aberturas = {x["rota"]: x for x in json.load(open(os.path.join(RD, "aberturas.json"), encoding="utf-8"))}
    medidas = {}
    if a.medidas and os.path.exists(a.medidas):
        for m in json.load(open(a.medidas, encoding="utf-8"))["medidas"]:
            if "erro" not in m:
                medidas[(m["rota"], m["largura"])] = m
    situacao = json.load(open(a.situacao, encoding="utf-8")) if os.path.exists(a.situacao) else {}

    # ---------- inventário de visões ----------
    L = []
    L.append("# Inventário de visões do redesenho (linha de base do HEAD)\n")
    L.append("Gerado por `scripts/energia_inventario_visoes.py` a partir do rastreamento mecânico de `scripts/energia-visoes.mjs` (1.440 px, três níveis de profundidade, 94 rotas) em `docs/energia/redesign/dados/visoes_antes.json`. Uma linha por visão substantiva: painel de evidência, gráfico, mapa, diagrama, tabela analítica, tabela equivalente, visão ou tabela sob demanda. Filtros, referências e arquivos para baixar são colunas do painel que os contém. Os controles do próprio seletor de profundidade não entram.\n")
    L.append("Como ler as colunas: **Pergunta** é o título do painel que contém a visão (ou o H1, fora de painel). **Indicador e unidade** é o subtítulo do painel. **Fonte e contrato** traz a linha de fonte do painel e o contrato de dados detectado no código da página. **Localização atual** diz a partir de que nível de profundidade a visão aparece. **Localização proposta** é o plano de migração; a **nova localização** e a **evidência de funcionamento** saem do comparador antes e depois (`scripts/energia_visoes_compara.py`) e vão para `docs/energia/redesign/MATRIZ_PRESERVACAO.md`.\n")
    total = 0
    for reg in rastreio["rotas"]:
        rota = reg["rota"]
        arq = arquivo_da_pagina(rota)
        cont = contratos(arq)
        pt = principal(familias, rota)
        abertura = rota in aberturas
        paineis = {v["id"]: v for v in reg["visoes"] if v["tipo"] == "painel"}
        h1 = reg["modos"]["entender"].get("h1", "")
        estados = reg["modos"]["auditar"].get("estados", {}) or reg["modos"]["entender"].get("estados", {})
        L.append(f"\n## {rota.replace(P, '') or '/'}  ·  {tipo_pagina(rota)}\n")
        L.append(f"- Título atual: {h1}")
        L.append(f"- Arquivo da página: `{os.path.relpath(arq, RAIZ) if arq else 'não localizado'}`; contratos de dados detectados: {', '.join('`'+c+'`' for c in cont) if cont else 'nenhum na página (lidos por componente ou biblioteca do módulo)'}")
        if pt:
            L.append(f"- Público: {', '.join(pt['publico'])}. Tarefa: {pt['tarefa']} Tarefas da rubrica: {', '.join(pt['tarefas_rubrica']) or 'nenhuma específica'}.")
        if estados:
            L.append(f"- Estados de disponibilidade marcados na página: {', '.join(f'{k} ({v})' for k, v in estados.items())}.")
        L.append("")
        L.append("| Painel | Visão | Título da visão | Pergunta | Indicador e unidade | Fonte e contrato | Filtros do painel | Referências | Exportação | Componente atual | Localização atual | Localização proposta | Evidência de preservação |")
        L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
        linhas = 0
        for v in reg["visoes"]:
            if v["tipo"] in ("controle", "arquivo", "comprove"):
                continue
            pid = v.get("painel") or (v.get("id") if v["tipo"] == "painel" else None)
            pn = paineis.get(pid)
            pergunta = limpa(pn["titulo"], 110) if pn else limpa(h1, 110)
            indicador = limpa(pn.get("subtitulo", ""), 150) if pn else ""
            fonte = limpa(pn.get("fonte", ""), 120) if pn else ""
            filtros = "; ".join(limpa(f.get("rotulo") or "", 40) for f in (pn or {}).get("filtros_do_painel", [])) if pn else ""
            refs = "; ".join(v.get("referencias", []) or []) if v["tipo"] == "grafico" else ""
            exp = ", ".join(v.get("exportacao", []) or [])
            if v["tipo"] == "painel" and v.get("download"):
                exp = (exp + "; " if exp else "") + "CSV do painel"
            L.append(
                "| " + " | ".join(
                    x.replace("|", "/") for x in [
                        (pid or "página"),
                        TIPO_LEGIVEL.get(v["tipo"], v["tipo"]) + (f" ({v.get('forma')})" if v.get("forma") else ""),
                        limpa(v.get("titulo", ""), 110),
                        pergunta,
                        indicador,
                        (fonte + ("; contrato: " + ", ".join(cont[:2]) if cont and v["tipo"] == "painel" else "")).strip("; "),
                        filtros,
                        refs,
                        exp,
                        componente(v),
                        local(v.get("niveis", [])),
                        proposta(v, abertura),
                        "pendente: comparação antes e depois no SHA final",
                    ]
                ) + " |"
            )
            linhas += 1
        # páginas sem painel de evidência (inicial, verbetes, trilhas, catálogo, método): cada bloco de conteúdo (título fora de painel) é uma visão
        if not paineis:
            vistos = {}
            for modo in ("entender", "analisar", "auditar"):
                for h in reg["modos"].get(modo, {}).get("titulos_fora_de_painel", []) or []:
                    vistos.setdefault(h, []).append(modo)
            extra = list(MANUAIS.get(rota, []))
            for h, modos in vistos.items():
                if re.match(r"^\d+\.", h) and rota == P:
                    continue  # elos do mapa em texto: o mapa conceitual já é uma visão
                extra.append((h, "bloco de conteúdo", "seção da página", modos))
            for titulo, visao, comp, modos in [(x[0], x[1], x[2], x[3] if len(x) > 3 else ["entender", "analisar", "auditar"]) for x in extra]:
                L.append(
                    "| " + " | ".join(
                        x.replace("|", "/") for x in [
                            "página", visao, limpa(titulo, 110), limpa(h1, 110), "", ", ".join("`" + c + "`" for c in cont[:2]), "", "", "", comp, local(modos),
                            "Mesma rota; bloco de conteúdo mantido, reordenado conforme o desenho alvo", "pendente: comparação antes e depois no SHA final",
                        ]
                    ) + " |"
                )
                linhas += 1
        total += linhas
        L.append(f"\n{linhas} visões nesta rota.")
    L.insert(2, f"Total: **{total} visões** em {len(rastreio['rotas'])} rotas.\n")
    os.makedirs(os.path.dirname(a.saida_visoes), exist_ok=True)
    open(a.saida_visoes, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(total, "visões em", len(rastreio["rotas"]), "rotas →", os.path.relpath(a.saida_visoes, RAIZ))

    # ---------- inventário de páginas ----------
    I = []
    I.append("# Inventário de páginas do observatório de energia (HEAD antes do redesenho)\n")
    I.append("Gerado por `scripts/energia_inventario_visoes.py`. Uma linha por rota avaliada (as 94 de `docs/observatorios/energia/avaliacao/rotas.txt`, que incluem amostras de cada gabarito). As 22 aberturas da galeria vêm primeiro, com a medida da primeira tela. As rotas geradas por gabarito (fichas de conjunto, de empresa, verbetes) herdam a avaliação do gabarito.\n")
    I.append("## Aberturas (as 22 telas da galeria)\n")
    I.append("| ID | Rota | Tipo | Pergunta da abertura | Componente atual | Dado principal | Altura 1440 antes | H1 antes (palavras) | Primeiro gráfico em 1440 (px) | Altura 390 antes | Desenho alvo | Situação da migração |")
    I.append("| --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |")
    for ab in aberturas.values():
        rota = ab["rota"]
        arq = arquivo_da_pagina(rota)
        cont = contratos(arq)
        m14, m39 = medidas.get((rota, 1440)), medidas.get((rota, 390))
        comp = ", ".join(componentes_da_pagina(arq)[:4])
        g = (m14 or {}).get("primeiro_grafico")
        h1 = (m14 or {}).get("h1") or {}
        sit = situacao.get(rota, "pendente")
        I.append(
            f"| {ab['id']} | `{rota.replace(P, '') or '/'}` | {tipo_pagina(rota)} | {ab['pergunta']} | {comp or 'página própria'} | {', '.join('`'+c+'`' for c in cont[:3]) or 'lido por componente'} | "
            f"{(m14 or {}).get('altura_total', '')} | {h1.get('texto', '')} ({h1.get('palavras', '')}) | {g['topo'] if g else 'sem gráfico visível'} | {(m39 or {}).get('altura_total', '')} | {ab['composicao']} | {sit} |"
        )
    I.append("\n## Todas as rotas avaliadas\n")
    I.append("| Rota | Tipo | Visões | Painéis | Contratos de dados | Situação da migração |")
    I.append("| --- | --- | ---: | ---: | --- | --- |")
    for reg in rastreio["rotas"]:
        rota = reg["rota"]
        arq = arquivo_da_pagina(rota)
        cont = contratos(arq)
        vs = [v for v in reg["visoes"] if v["tipo"] not in ("controle", "arquivo", "comprove")]
        ps = [v for v in reg["visoes"] if v["tipo"] == "painel"]
        I.append(f"| `{rota.replace(P, '') or '/'}` | {tipo_pagina(rota)} | {len(vs)} | {len(ps)} | {', '.join('`'+c+'`' for c in cont[:3]) or 'lido por componente'} | {situacao.get(rota, 'pendente')} |")
    open(a.saida_paginas, "w", encoding="utf-8").write("\n".join(I) + "\n")
    print("páginas →", os.path.relpath(a.saida_paginas, RAIZ))


if __name__ == "__main__":
    main()
