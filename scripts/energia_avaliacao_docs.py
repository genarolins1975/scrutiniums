"""Documentos gerados a partir de public/energia/gold/avaliacao.json (ver scripts/energia_avaliacao.py):
AVALIACAO_PAGINAS.md e EVIDENCIAS_ACEITE.md. Não editar à mão: o conteúdo muda a cada rodada."""
import json
import os

PREF = "/setor-eletrico"
NOMES = {"didatismo": "Didat.", "visual": "Visual", "navegacao": "Naveg.", "interatividade": "Interat.", "acessibilidade": "Acess.",
         "completude": "Compl.", "correcao": "Correção", "rastreabilidade": "Rastr.", "atualidade": "Atual.", "desempenho": "Desemp."}
ESTADO_LETRA = {"nao_avaliada": "n.av.", "nao_aplicavel": "n.ap."}


def pt(n, casas=1):
    if n is None:
        return "n.av."
    return f"{n:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def nota(x):
    return pt(x["nota"]) if x["estado"] == "avaliada" else ESTADO_LETRA[x["estado"]]


def tabela(cab, linhas):
    out = ["| " + " | ".join(cab) + " |", "| " + " | ".join("---" for _ in cab) + " |"]
    for l in linhas:
        out.append("| " + " | ".join(str(c).replace("|", "/").replace("\n", " ") for c in l) + " |")
    return out


def escreve_documentos(a, docs):
    escreve_paginas(a, os.path.join(docs, "AVALIACAO_PAGINAS.md"))
    escreve_aceite(a, docs, os.path.join(docs, "EVIDENCIAS_ACEITE.md"))


def escreve_paginas(a, caminho):
    r = a["resumo"]
    rod = a["rodada"]
    L = ["# Avaliação das páginas do observatório", "",
         f"Gerado por `scripts/energia_avaliacao.py` a partir de `public/energia/gold/avaliacao.json` (rodada {rod['id']}, inspeção de {rod['data_inspecao'][8:10]}/{rod['data_inspecao'][5:7]}/{rod['data_inspecao'][:4]}, rubrica {a['versao_rubrica']}). "
         "Não editar à mão: a página `/setor-eletrico/metodologia/avaliacao` lê o mesmo arquivo e mostra a evidência de cada nota.", "",
         "A escala é uma ferramenta de revisão, não uma certificação externa. Nota só existe com evidência medida ou revisão registrada; dimensão não testada fica como não avaliada (n.av.) e não satisfaz o aceite; dimensão que não se aplica ao tipo de página fica como não aplicável (n.ap.) e sai do cálculo ponderado. Toda nota é truncada em uma casa decimal.", "",
         "## Resultado da rodada", "",
         f"- Páginas avaliadas: {r['paginas']} (de {rod['rotas_construidas']} rotas construídas; as famílias dinâmicas foram amostradas, ver limites).",
         f"- Nota ponderada média: {pt(r['nota_ponderada_media'])}.",
         f"- Páginas que atendem a meta de produto (todas as dimensões a partir de 9,0, didatismo e qualidade visual a partir de 9,5, nenhuma dimensão aplicável não avaliada, nenhum defeito crítico): {r['atendem_meta']} de {r['paginas']}.",
         f"- Páginas com todas as dimensões aplicáveis avaliadas: {r['completas']} de {r['paginas']}.",
         f"- Defeitos abertos: {r['defeitos']['abertos']} (críticos {r['defeitos']['por_severidade']['critico']}, altos {r['defeitos']['por_severidade']['alto']}, médios {r['defeitos']['por_severidade']['medio']}, baixos {r['defeitos']['por_severidade']['baixo']}); corrigidos desde a rodada anterior: {r['defeitos']['corrigidos_desde_a_rodada_anterior']}.",
         f"- Jornadas da seção 15.2: {r['jornadas']['cumpridas']} cumpridas, {r['jornadas']['interrompidas']} interrompidas, {r['jornadas']['falhas']} com falha, de {r['jornadas']['total']} (roteiro por script, sem participante humano).", ""]
    L += ["## Por dimensão", ""]
    linhas = []
    for d in a["rubrica"]["dimensoes"]:
        x = r["por_dimensao"][d["id"]]
        linhas.append([d["nome"], f"{d['peso']}%", pt(x["meta"]), x["avaliadas"], x["nao_avaliadas"], x["nao_aplicaveis"], pt(x["media"]), pt(x["minimo"]), f"{x['atendem_meta']} de {x['avaliadas']}"])
    L += tabela(["Dimensão", "Peso", "Meta", "Avaliadas", "Não avaliadas", "Não aplicáveis", "Média", "Mínimo", "Atendem a meta"], linhas) + [""]
    if len(a["rodadas"]) > 1:
        L += ["## Evolução entre rodadas", "",
              "A comparação só vale para dimensões avaliadas nas duas rodadas: uma média que inclui a revisão visual não se compara com outra que não a inclui.", ""]
        ids_ = [d["id"] for d in a["rubrica"]["dimensoes"]]
        linhas = []
        for x in a["rodadas"]:
            sev = x["defeitos_por_severidade"]
            nd = sum(1 for i in ids_ if x["medias_por_dimensao"].get(i) is not None)
            linhas.append([x["id"], x["data"], x["paginas"], f"{nd} de 10", pt(x["nota_ponderada_media"]), x["atendem_meta"], f"{sev['critico']}/{sev['alto']}/{sev['medio']}/{sev['baixo']}", x["jornadas_cumpridas"]])
        L += tabela(["Rodada", "Data", "Páginas", "Dimensões com nota", "Nota ponderada média das dimensões avaliadas", "Atendem a meta", "Defeitos crítico/alto/médio/baixo", "Jornadas cumpridas"], linhas) + [""]
        linhas = [[x["id"]] + [pt(x["medias_por_dimensao"].get(i)) for i in ids_] for x in a["rodadas"]]
        L += tabela(["Rodada"] + [NOMES[i] for i in ids_], linhas) + [""]
        L += ["Defeitos corrigidos desde a rodada anterior:", ""] + [f"- ({c['severidade']}) {c['descricao']}" for c in a["corrigidos"]] + [""]
    L += ["## Por entrega (média das páginas de cada módulo)", ""]
    ids = [d["id"] for d in a["rubrica"]["dimensoes"]]
    linhas = []
    for m in a["modulos"]:
        linhas.append([m["rotulo"], m["paginas"]] + [pt(m["dimensoes"][i]["media"]) if m["dimensoes"][i]["media"] is not None else ("n.av." if m["dimensoes"][i]["nao_avaliadas"] else "n.ap.") for i in ids] + [pt(m["nota_ponderada"]), f"{m['atendem_meta']}/{m['paginas']}"])
    L += tabela(["Entrega", "Págs."] + [NOMES[i] for i in ids] + ["Ponderada", "Atendem"], linhas) + [""]
    L += ["## Jornadas de usuário (seção 15.2)", "",
          "Execução de roteiro por script em Chromium headless. Cada passo verifica um fato observável (texto, URL, valor, arquivo baixado). Não é teste com pessoas.", ""]
    linhas = [[j["id"], j["perfil"], j["resultado"], f"{j['passos_ok']} de {j['passos_total']}", j["cliques"], len(j["erros_console"])] for j in a["jornadas"]]
    L += tabela(["Jornada", "Perfil", "Resultado", "Passos", "Interações", "Erros de console"], linhas) + [""]
    for j in a["jornadas"]:
        L += [f"### {j['id']}: {j['titulo']}", ""]
        for s in j["passos"]:
            L.append(f"- {'ok' if s['resultado'] == 'ok' else s['resultado']}: {s['descricao']}" + (f" ({s['observado']})" if s.get("observado") else ""))
        for t in j.get("atritos") or []:
            L.append(f"- atrito: {t}")
        if j.get("limite"):
            L.append(f"- limite: {j['limite']}")
        L.append("")
    L += ["## Defeitos abertos", ""]
    linhas = [[d["id"], d["severidade"], d["dimensao"], d["descricao"], d["n_paginas"]] for d in a["defeitos"]]
    L += (tabela(["Id", "Severidade", "Dimensão", "Descrição", "Páginas"], linhas) if linhas else ["Nenhum defeito aberto."]) + [""]
    L += ["## Por página", "",
          "Nota de cada dimensão (0 a 10); n.av. = não avaliada; n.ap. = não aplicável. A evidência de cada nota, com deduções e tetos, está em `public/energia/gold/avaliacao.json` e na página de avaliação.", ""]
    linhas = []
    for p in a["paginas"]:
        linhas.append([p["rota"].replace(PREF, "") or "/", p["tipo"] + (" (amostra)" if p["amostra"] else "")] + [nota(p["dimensoes"][i]) for i in ids] + [pt(p["nota_ponderada"]), "sim" if p["atende_meta"] else "não"])
    L += tabela(["Rota", "Tipo"] + [NOMES[i] for i in ids] + ["Ponderada", "Meta"], linhas) + [""]
    L += ["## Rubrica", ""]
    for d in a["rubrica"]["dimensoes"]:
        L += [f"### {d['nome']} (peso {d['peso']}%)", "", f"Evidência exigida: {d['evidencia']}.", ""] + [f"- {x}" for x in d["regras"]]
        for t in d["tetos"]:
            L.append(f"- Teto {pt(t['valor']) if t['valor'] is not None else 'variável'}: {t['motivo']}.")
        L.append("")
    L += ["## Limites desta avaliação", ""] + [f"- {x}" for x in a["limites"]] + [""]
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


def escreve_aceite(a, docs, caminho):
    """Mapa da definição final de pronto (seção 17) para a evidência, com o estado real de cada item."""
    status = json.load(open(os.path.join(docs, "status_paineis.json"), encoding="utf-8"))["paineis"]
    testes_p = os.path.join(docs, "avaliacao", "testes.json")
    testes = json.load(open(testes_p, encoding="utf-8")) if os.path.exists(testes_p) else {}
    r = a["resumo"]
    n_conc = sum(1 for v in status.values() if v["estado"] in ("concluido", "concluido_com_limitacao"))
    n_integral = sum(1 for v in status.values() if v["estado"] == "concluido")
    jor = {j["id"]: j for j in a["jornadas"]}

    def jr(i):
        j = jor.get(i)
        return f"{i} {j['resultado']} ({j['passos_ok']} de {j['passos_total']} passos)" if j else f"{i} não executada"

    home = next((p for p in a["paginas"] if p["rota"] == PREF), None)
    itens = [
        ("A home é o mapa didático do observatório, com propósito, perguntas, utilidade e conexão de todos os destinos.",
         "parcial", f"Página inicial medida: nota ponderada {pt(home['nota_ponderada']) if home else 'n.av.'}; {jr('J1')}. Os painéis vivos da home (task 19 da Fase 2) ainda não foram portados."),
        ("Todos os módulos obrigatórios existem e têm conteúdo real e útil.",
         "parcial", f"{len(a['modulos'])} entregas publicadas e medidas com resposta 200 em {a['rodada']['rotas_medidas']} rotas; a utilidade do conteúdo é lida pela revisão didática de cada página, não por contagem de módulos."),
        ("Todos os painéis obrigatórios foram concluídos, incluindo os itens de execução posterior do Anexo A.",
         "nao_atendido", f"{n_conc} de 71 painéis concluídos ({n_integral} sem limitação, {n_conc - n_integral} com limitação declarada), segundo status_paineis.json; o denominador é fixo em 71."),
        ("Mercado, Empresas, Expansão e Regulação deixaram de ser módulos vazios.",
         "parcial", "As quatro páginas publicam conteúdo lido das golds; o contrato de painel da seção 7.2 foi adotado só no Mercado (P032 a P035). Ver nota de Completude de cada página."),
        ("Conta de luz, Perdas, Qualidade, Inclusão e Transição estão plenamente integrados à experiência.",
         "parcial", "As páginas existem e foram medidas; a adoção do contrato de painel e a conclusão dos painéis correspondentes seguem pendentes em status_paineis.json."),
        ("O mapa de perdas funciona com geografia, indicadores e referências corretos.",
         "parcial", f"Interações do mapa exercitadas por roteiro ({jr('J6')}; {jr('J7')}); a geografia e as referências não foram reconferidas contra a fonte nesta avaliação."),
        ("Os conceitos pendentes foram tratados e as fontes conferidas.",
         "parcial", "Verbetes do Aprenda conferidos na fonte primária: ver a nota de Correção de cada verbete; GSF, REE e energia restringida seguem pendentes de fonte primária e declarados como tal."),
        ("Não há números de demonstração no caminho de produção.", "nao_verificado", "Não foi objeto desta avaliação; os testes de governança e de contrato das golds cobrem parte do requisito."),
        ("As comparações não misturam datas, universos ou denominadores incompatíveis.", "nao_verificado", "Não foi objeto desta avaliação além da nota de Correção por gold; a revisão adversarial das interfaces publicadas segue pendente."),
        ("Gráfico, tabela, texto e exportação derivam da mesma consulta e versão.", "parcial", f"{jr('J4')}: o agregado exibido foi recalculado a partir do CSV exportado."),
        ("O usuário consegue comprovar números e reproduzir agregados.", "parcial", f"Ficha Comprove aberta por roteiro em cada página que a oferece (ver Interatividade e Rastreabilidade); {jr('J3')}; {jr('J4')}. Reprodução por terceiros, fora do ambiente, não foi exercitada."),
        ("Todas as interações prometidas foram executadas em teste.", "parcial", "Controles visíveis acionados por roteiro em 390 e 1440 px em cada página (nota de Interatividade); as interações específicas de cada painel seguem nos testes de cada módulo."),
        ("As telas foram inspecionadas em desktop e celular, inclusive estados extremos e vazios legítimos.", "parcial", f"Capturas de 1440 e 390 px de {a['rodada']['rotas_medidas']} páginas abertas por revisores em contexto limpo; estados vazios e defasados: {jr('J9')}."),
        ("A atualização e o tratamento de falhas foram testados.", "parcial", "Testes do pipeline com falha simulada, revisão e período parcial (nota de Atualidade); sem exercício completo em produção."),
        ("O módulo de previsão cumpre as etapas aplicáveis de validação e publicação, sem contorná-las.", "nao_verificado", f"Não foi objeto desta avaliação; {jr('J10')} verificou a inspeção do arquivo de emissões."),
        ("Backtest, prospectivo, observado, estimado e cenário estão corretamente separados.", "nao_verificado", "Não foi objeto desta avaliação."),
        ("Avaliação por página e evidências estão registradas, sem notas inventadas.", "atendido" if r["paginas"] else "nao_atendido",
         f"{r['paginas']} páginas com nota por dimensão, evidência, deduções e tetos em avaliacao.json; dimensão sem teste ou revisão fica como não avaliada ({sum(v['nao_avaliadas'] for v in r['por_dimensao'].values())} ocorrências)."),
        ("Não há regressão conhecida nas áreas afetadas do Scrutiniums.", "parcial" if testes else "nao_verificado", testes.get("resumo_regressao", "Resultado dos testes não registrado nesta rodada.")),
        ("Build e verificações exigidas passaram.", "parcial" if testes else "nao_verificado", testes.get("resumo_build", "Resultado de build e testes não registrado nesta rodada.")),
        ("Qualquer limitação externa remanescente está descrita sem ser apresentada como cumprimento integral.", "atendido",
         "Limites da avaliação em avaliacao.json e em AVALIACAO_PAGINAS.md; limitações de cada painel em status_paineis.json e em DECISOES_E_LIMITACOES.md."),
    ]
    rot = {"atendido": "atendido", "parcial": "atendido em parte", "nao_atendido": "não atendido", "nao_verificado": "não verificado nesta rodada"}
    contagem = {k: sum(1 for i in itens if i[1] == k) for k in rot}
    L = ["# Evidências de aceite", "",
         f"Gerado por `scripts/energia_avaliacao.py` (rodada {a['rodada']['id']}). Mapeia cada item da definição final de pronto (seção 17 da especificação) para a evidência que existe e para o estado real do item. "
         "Item marcado como atendido em parte ou não verificado não é cumprimento integral.", "",
         f"Resumo: {contagem['atendido']} atendido, {contagem['parcial']} atendido em parte, {contagem['nao_atendido']} não atendido, {contagem['nao_verificado']} não verificado nesta rodada, de {len(itens)} itens.", ""]
    L += tabela(["Item da seção 17", "Estado", "Evidência e limite"], [[i[0], rot[i[1]], i[2]] for i in itens]) + [""]
    L += ["## Onde está a evidência", "",
          "- Notas, deduções, tetos e defeitos por página: `public/energia/gold/avaliacao.json` e `/setor-eletrico/metodologia/avaliacao`.",
          "- Medição por navegador (condensada): `docs/observatorios/energia/avaliacao/inspecao.json`; jornadas: `jornadas.json`; revisão visual e didática: `revisao_visual.json`; testes: `testes.json`; rodadas: `rodadas.json`.",
          "- Reprodução: `PW_CORE=... node scripts/energia-avaliacao.mjs --base http://localhost:3100 --rotas rotas.txt --saida saida`, `node scripts/energia-jornadas.mjs ...` e `python3 scripts/energia_avaliacao.py --relatorio saida/relatorio.json --jornadas jornadas/jornadas.json`.", ""]
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
