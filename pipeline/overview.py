"""Visão geral analítica: diagnóstico sintético, tabela de mudanças e conteúdo de metodologia viva.

O diagnóstico é RULE-BASED e auditável: cada frase deriva de indicadores citados como evidência,
com nível de confiança função da qualidade dos dados e da presença de componentes demonstrativos.
Nada aqui é texto livre de IA.
"""
from pipeline import common
from pipeline.indicators import _yoy, _zscore_series, series_quality

# séries monitoradas na tabela de mudanças: (key, sentido_bom, rótulo curto, área de drill-down)
MONITORED = [
    ("inad_total", "down", "Inadimplência total (>90d)", "pulse"),
    ("inad_pf", "down", "Inadimplência PF", "pulse"),
    ("inad_pj", "down", "Inadimplência PJ", "pulse"),
    ("concessoes_total", "up", "Concessões (nível)", "pulse"),
    ("saldo_total", "up", "Saldo de crédito", "pulse"),
    ("taxa_total", "down", "Taxa média de juros", "pulse"),
    ("spread_total", "down", "Spread médio", "pulse"),
    ("comprometimento", "down", "Comprometimento de renda", "pulse"),
    ("endividamento", "down", "Endividamento das famílias", "pulse"),
    ("desemprego", "down", "Taxa de desocupação", "pulse"),
    ("ibc_br", "up", "IBC-Br (atividade)", "pulse"),
    ("papelao", "up", "Papelão ondulado (antecedente)", "sectors"),
]


def _delta_stats(series, k):
    """Δ em k períodos + desvio-padrão histórico dos Δk (para normalizar a relevância)."""
    if len(series) <= k:
        return None, None
    deltas = [series[i][1] - series[i - k][1] for i in range(k, len(series))]
    if len(deltas) < 8:
        return series[-1][1] - series[-1 - k][1], None
    m = sum(deltas) / len(deltas)
    var = sum((d - m) ** 2 for d in deltas) / (len(deltas) - 1)
    sd = var ** 0.5
    return deltas[-1], (sd if sd > 1e-9 else None)


def build_changes(con):
    """Tabela 'mudanças desde a última atualização' + rankings de deterioração/melhora."""
    rows = []
    for key, good_dir, label, area in MONITORED:
        s = common.get_series(con, key)
        meta = common.get_meta(con, key)
        if not s or len(s) < 2 or not meta:
            continue
        d1, sd1 = _delta_stats(s, 1)
        d3, _ = _delta_stats(s, 3)
        if d1 is None:
            continue
        improving = (d1 > 0) == (good_dir == "up")
        rel = abs(d1) / sd1 if sd1 else 0.0  # relevância normalizada pelo histórico de variações
        if abs(d1) < 1e-9:
            classificacao, interp = "estável", "sem variação relevante no mês"
        else:
            classificacao = "melhora" if improving else "deterioração"
            mag = "acentuada" if rel > 1.5 else "moderada" if rel > 0.7 else "leve"
            interp = f"{classificacao} {mag} ({'acima' if rel > 1 else 'dentro'} do padrão histórico de variações mensais)"
        rows.append({
            "key": key, "indicador": label, "area": area,
            "anterior": round(s[-2][1], 3), "atual": round(s[-1][1], 3),
            "delta_1m": round(d1, 3), "delta_3m": round(d3, 3) if d3 is not None else None,
            "relevancia_z": round(rel, 2), "classificacao": classificacao, "interpretacao": interp,
            "unidade": meta["unit"], "fonte": meta["source"], "serie": meta["series_code"],
            "ref_anterior": s[-2][0], "ref_atual": s[-1][0],
        })
    det = sorted([r for r in rows if r["classificacao"] == "deterioração"], key=lambda r: -r["relevancia_z"])[:5]
    mel = sorted([r for r in rows if r["classificacao"] == "melhora"], key=lambda r: -r["relevancia_z"])[:5]
    return {"tabela": rows, "top_deterioracoes": det, "top_melhoras": mel}


def build_diagnosis(con, ibcc, changes, sectors, quality_avg, has_demo_components=True):
    """Frase analítica rule-based com evidências, confiança e limitações."""
    if not ibcc or not ibcc.get("ok"):
        return {"ok": False}
    atual = ibcc["atual"]
    serie = ibcc["serie"]
    vals = [p["valor"] for p in serie]
    pct = sum(1 for v in vals if v < atual["valor"]) / max(len(vals) - 1, 1) * 100
    fase = ibcc["fase_ciclo"]
    nivel = ("restritivas" if atual["valor"] < 97 else "próximas da média histórica" if atual["valor"] <= 103 else "favoráveis")

    evid = []
    # evidência 1: pior componente do IBCC
    worst_comp = min(atual["contribuicoes"].items(), key=lambda kv: kv[1])
    evid.append({"texto": f"componente mais negativo do IBCC: {ibcc['componentes'][worst_comp[0]]['label']} ({worst_comp[1]:+.2f})",
                 "area": "overview", "status": "calculado"})
    # evidência 2-3: principais mudanças
    for r in changes["top_deterioracoes"][:2]:
        evid.append({"texto": f"{r['indicador']}: {r['anterior']} → {r['atual']} {r['unidade']} ({r['delta_1m']:+.2f} em 1m)",
                     "area": r["area"], "status": "observado", "fonte": r["fonte"], "ref": r["ref_atual"]})
    # evidência 4: setor mais estressado
    if sectors and sectors.get("ok") and sectors["setores"]:
        s0 = sectors["setores"][0]
        evid.append({"texto": f"maior estresse setorial: {s0['nome']} (score {s0['score']}, {s0['tendencia']})",
                     "area": "sectors", "status": "calculado (componentes parcialmente demonstrativos)"})

    n_det = len(changes["top_deterioracoes"])
    n_mel = len(changes["top_melhoras"])
    dir_txt = ("com deterioração predominante nos indicadores monitorados" if n_det > n_mel
               else "com melhora predominante nos indicadores monitorados" if n_mel > n_det
               else "com sinais mistos entre os indicadores monitorados")
    frase = (f"As condições de crédito permanecem {nivel} (IBCC {atual['valor']:.1f}, "
             f"percentil histórico {pct:.0f}), em fase de {fase}, {dir_txt}.")

    conf = "moderada" if quality_avg and quality_avg >= 65 else "baixa"
    conf_motivo = (f"qualidade média dos dados {quality_avg:.0f}/100; "
                   + ("componentes setoriais de RJ/emprego ainda demonstrativos; " if has_demo_components else "")
                   + "IBCC com pesos iguais (v0.2); sem corte por porte/modalidade fina no MVP")
    return {
        "ok": True, "tipo": "DADO CALCULADO", "frase": frase,
        "ref": atual["ref"], "confianca": conf, "confianca_motivo": conf_motivo,
        "evidencias": evid, "percentil_ibcc": round(pct, 1),
        "metodo": "Frase montada por regras determinísticas a partir do IBCC (nível/fase/percentil), "
                  "da tabela de mudanças (Δ1m normalizado pelo desvio histórico) e do ranking setorial. "
                  "Não é texto gerado livremente.",
    }


def build_ibcc_position(ibcc):
    if not ibcc or not ibcc.get("ok"):
        return None
    serie = ibcc["serie"]
    vals = {p["ref"]: p["valor"] for p in serie}
    refs = sorted(vals)
    cur_ref = refs[-1]
    def back(n):
        return vals.get(refs[-1 - n]) if len(refs) > n else None
    allv = list(vals.values())
    pct = sum(1 for v in allv if v < vals[cur_ref]) / max(len(allv) - 1, 1) * 100
    return {"atual": vals[cur_ref], "ref": cur_ref, "percentil_historico": round(pct, 1),
            "m1": back(1), "m3": back(3), "m12": back(12),
            "delta_1m": round(vals[cur_ref] - back(1), 2) if back(1) else None,
            "delta_3m": round(vals[cur_ref] - back(3), 2) if back(3) else None,
            "delta_12m": round(vals[cur_ref] - back(12), 2) if back(12) else None}


# ---------------- metodologia viva ----------------

INDICATOR_DICTIONARY = [
    {"nome": "Inadimplência (>90 dias)", "definicao": "Parcela do saldo da carteira com ao menos uma parcela vencida há mais de 90 dias.",
     "formula": "saldo em atraso >90d ÷ saldo total da carteira", "numerador": "Operações com atraso >90d (R$)",
     "denominador": "Saldo total da modalidade (R$)", "interpretacao": "Alta = deterioração da qualidade da carteira; reage com defasagem ao ciclo econômico.",
     "limitacoes": "Renegociações podem mascarar atrasos; baixas para prejuízo retiram operações do indicador.", "periodicidade": "mensal"},
    {"nome": "Spread médio", "definicao": "Diferença entre a taxa média das operações de crédito e o custo de captação de referência.",
     "formula": "taxa média das concessões − custo de captação", "numerador": "—", "denominador": "—",
     "interpretacao": "Alta = crédito mais caro relativo ao funding; incorpora risco, custos, impostos e margem.",
     "limitacoes": "Composição de modalidades afeta a média agregada (efeito mix).", "periodicidade": "mensal"},
    {"nome": "Comprometimento de renda", "definicao": "Parcela da renda das famílias comprometida com o serviço da dívida no SFN.",
     "formula": "serviço da dívida (juros+amortização) ÷ renda disponível", "numerador": "Serviço mensal da dívida",
     "denominador": "Renda disponível das famílias", "interpretacao": "Alta = menor folga para novos compromissos; antecede atrasos de PF.",
     "limitacoes": "Não captura dívidas fora do SFN (crediários, fintechs não IF).", "periodicidade": "mensal"},
    {"nome": "IBCC", "definicao": "Índice sintético de condições de crédito (100 = média histórica; acima = condições melhores).",
     "formula": "100 + 10 × média dos z-scores dos 6 componentes (preço, qualidade, capacidade, atividade, oferta, antecedentes)",
     "numerador": "—", "denominador": "—", "interpretacao": "Resume o ciclo de crédito em um número comparável no tempo.",
     "limitacoes": "Pesos iguais entre componentes; sensível à janela histórica de cada série.", "periodicidade": "mensal"},
    {"nome": "Score de estresse setorial", "definicao": "Posição do setor no espectro de estresse (0 = mínimo, 100 = máximo).",
     "formula": "50 + 20 × Σ(peso × z) — só componentes observados: atividade 0,69; condições de crédito 0,31 (RJ e emprego em construção, peso zero)",
     "numerador": "—", "denominador": "—", "interpretacao": ">55 = atenção; >75 = crítico. Ler junto com tendência e velocidade.",
     "limitacoes": "Dois componentes demonstrativos no MVP; sem normalização por tamanho do setor.", "periodicidade": "mensal"},
    {"nome": "Score de risco de instituições", "definicao": "Risco relativo ao grupo de pares prudencial (0 = menor risco relativo, 100 = maior).",
     "formula": "média dos percentis de 4 razões contábeis dentro do grupo (ROE invertido, alavancagem, carteira/ativo, captações/ativo)",
     "numerador": "—", "denominador": "—", "interpretacao": "Posição relativa, não probabilidade de default.",
     "limitacoes": "Sem Basileia/liquidez; ROE não anualizado; ferramenta acadêmica, não é rating.", "periodicidade": "trimestral"},
]

CHANGELOG = [
    {"versao": "0.17.0", "data": "2026-07-28", "mudancas": [
        "Open Finance v2: subabas (Visão Geral, Consentimentos, APIs & Endpoints, Iniciação, Concentração, Índices, Alertas, Qualidade, Instituições) com síntese determinística.",
        "Novos dados reais: chamadas por ENDPOINT e por família em cada fase (Saldos da Conta lidera com 10,6 bi) e rankings nominais das 3 fases — incluindo iniciação de pagamentos (Nubank 18,8%, Itaú 13,6%).",
        "Concentração por fase: top-1/5/10, fora do top-5 e HHI parcial (rotulado como limite inferior sobre o universo divulgado); histórico de snapshots para mobilidade futura.",
        "Quatro índices separados (adoção, utilização, conversão, qualidade técnica) com componentes, pesos, cobertura e confiança — conversão declarada INDISPONÍVEL (funil não publicado) em vez de estimada.",
        "Alertas do OF com regra/limiar/persistência (sucesso <97% nas fases transacional e iniciação disparados); painel de qualidade dos dados com indisponibilidades explícitas.",
        "Relação exploratória OF×crédito: scatter share de chamadas × share de carteira (n=11 matches, Spearman ρ=0,40) — associação, não causalidade.",
    ]},
    {"versao": "0.16.0", "data": "2026-07-28", "mudancas": [
        "Inadimplência REAL por instituição (>90 dias): 790 conglomerados com carteira inadimplente, ativos problemáticos (Res. 4.966) e provisões de crédito, em 5 trimestres — relatório por instrumentos financeiros do IF.data (lids 148834/148833/140202), validado contra os grandes bancos (Itaú 2,25%, BB 5,39%, Caixa 3,68%).",
        "Visão geral: seção 'Inadimplência nas instituições financeiras' com mediana do sistema (4,75%) e por grupo de pares (nunca média ponderada), dispersão em quartis, contadores de alta, top-5 deteriorações com 3 critérios lado a lado (Δinad + Δcarteira + Δcobertura) e frases determinísticas com regra e base.",
        "Página da instituição: subaba 'Risco e Inadimplência' com série histórica vs. mediana/q3 do grupo, tendência por regras analíticas parametrizáveis (±0,20/0,50 p.p.), matriz crescimento×inadimplência, cobertura contábil aproximada com nota metodológica e alertas institucionais (5 regras transparentes).",
        "Tabela de instituições com coluna de inadimplência e ordenação por nível e por deterioração 4T.",
        "Rotulagem honesta: amostra inicia na estrutura 2025-T1 (sem quebra interna — máx/mín de 3 anos declarado indisponível); sem decomposição de inadimplência por modalidade/instituição (não existe no corte público); cobertura marcada como aproximação contábil, não razão regulatória.",
    ]},
    {"versao": "0.15.0", "data": "2026-07-28", "mudancas": [
        "Rotas de caminho compartilháveis (/overview, /credit, /sectors, /recoveries, /institutions/{cod}, /sectors/{cod}, /methodology…) com histórico do navegador e filtros na URL; hash mantido no ambiente local.",
        "Visão geral: painel de saúde dos dados (% séries atualizadas, pipelines com falha, demonstrativos remanescentes), coluna de cenário adverso nas projeções e mini-KPIs de estoque/concessões/spread no Bloco A.",
        "Fichas individuais de setor (produção, yoy, decomposição, exposição das instituições quando o CNAE corresponde, limitações declaradas).",
        "Página da instituição: subnavegação interna, resumo executivo em 5 blocos (avaliação, fortes, atenção, mudanças, limitações — cada frase com base), composição transparente do grupo de pares (critério, quartis, membros) e score com cobertura de dados e confiança.",
        "Central de alertas com estados geridos pelo usuário (ativo/em análise/acompanhado/resolvido/descartado, persistidos localmente); score cards na metodologia (§11.4).",
    ]},
    {"versao": "0.14.0", "data": "2026-07-28", "mudancas": [
        "Páginas individuais para TODO o universo: 1.422 conglomerados prudenciais com página própria (JSON sob demanda + busca por nome), no novo formato aprovado — cabeçalho com chips, cartão de score, KPIs com sparkline e Δ trimestral, destaques rule-based, composição da carteira (donut PF/PJ + modalidades + setores), evolução base-100, histograma de comparação com o grupo de pares completo e reclamações com histórico.",
        "Pares deixam de ser o top-30: percentis e medianas calculados no grupo prudencial COMPLETO (ex.: S5 com 808 instituições).",
        "Correção metodológica: variação trimestral do lucro suprimida (acúmulo anual do IF.data tornaria o Δ um artefato da virada de ano).",
        "Interface adaptativa: instituições sem carteira detalhada/score/reclamações mostram o motivo — nunca zero.",
    ]},
    {"versao": "0.13.0", "data": "2026-07-28", "mudancas": [
        "Páginas individuais de instituições — entrega inicial com 3 pilotos (Itaú, Daycoval, Banco Volkswagen): cabeçalho cadastral com nível de consolidação explícito, indicadores com Δ trimestral/anual, mediana e percentil dos pares e histórico de 5 trimestres, composição de carteira, score com vulnerabilidade, Open Finance, citações em RJs e síntese factual frase a frase com base declarada.",
        "Nova fonte real: Ranking de Reclamações do BCB (rdrweb, 4 trimestres) — indicador operacional/reputacional, nunca de solvência; Volkswagen com índice 243,7 vs. Itaú 46,9.",
        "Interface adaptativa: indicadores indisponíveis (LCR/NSFR, eficiência, qualidade por IF) declarados com motivo — ausência nunca vira zero; aviso de comparabilidade para modelo de negócio incompatível com o grupo de pares.",
        "Relatório de cobertura pré-escala (docs/RELATORIO_PILOTO_IF.md): capital 90%, carteiras 87%, reclamações 53%, OF 43% do top-30.",
    ]},
    {"versao": "0.12.0", "data": "2026-07-28", "mudancas": [
        "Open Finance REAL — o último módulo demonstrativo foi aposentado: consentimentos ativos semanais por papel (231 mi transmitidos), chamadas de API e taxa de sucesso por fase, ranking nominal de chamadas por organização (rotas públicas do Dashboard do Cidadão, descobertas empiricamente) e diretório oficial de participantes (107 organizações, papéis e famílias de API).",
        "Índice de maturidade demo descontinuado — conversão e latência por organização não são públicas; nenhum índice sintético o substitui.",
    ]},
    {"versao": "0.11.0", "data": "2026-07-28", "mudancas": [
        "Aba Pesquisa: assistente de consulta estruturada — motor DETERMINÍSTICO auditável (não é modelo de linguagem) que responde às perguntas do escopo do briefing consultando apenas os dados da plataforma, com selo epistemológico por afirmação, cálculo, fontes e recusa explícita fora do escopo; respostas exportáveis.",
        "Relatório automático diário gerado pelo pipeline (data/gold/report.html): 9 seções com cada parágrafo marcado OBSERVAÇÃO/INTERPRETAÇÃO/CALCULADO/PREVISÃO/CENÁRIO/DEMONSTRATIVO; imprimível para PDF.",
        "Alertas por assinatura: feed RSS (data/gold/alerts.xml) regenerado a cada execução — recepção por e-mail via qualquer serviço RSS-para-e-mail; links na central de alertas.",
    ]},
    {"versao": "0.10.0", "data": "2026-07-28", "mudancas": [
        "Séries mensais por marco processual: convolações de RJ em falência e extinções, extraídas doc a doc do DataJud (o índice não é nested — filtro a nível de documento + parse local das datas dos movimentos).",
        "Parser de QGC por classe (art. 41): subtotais trabalhista/garantia real/quirografário/ME-EPP extraídos dos editais quando publicados.",
        "Cascata de passivo completa por caso: QGC por classe → citado no ato → estimado (intervalo interquartil da janela) → não identificado; painel agregado exibe os níveis SEPARADOS, nunca somados silenciosamente.",
        "Cache-buster também nos JSONs de dados (APP_VERSION no fetch) — CDN não serve mais dados antigos após deploys.",
    ]},
    {"versao": "0.9.0", "data": "2026-07-28", "mudancas": [
        "Credores financeiros REAIS por caso: instituições citadas em publicações com 'relação de credores' (DJEN), com classificação em níveis — 'observada' (valor adjacente no texto) e 'parcialmente observada' (citação sem valor); casos sem menção = 'não identificada'.",
        "Passivo citado no ato por regex (nível 'declarado no ato', nunca apresentado como passivo total).",
        "Enriquecimento cadastral via BrasilAPI (dados públicos da Receita): CNAE, porte e município das recuperandas — associação CNPJ↔empresa validada por compatibilidade de razão social, senão descartada.",
        "Exposição agregada por banco na janela (contagem de casos + valores citados), com aviso metodológico obrigatório de que presença em lista ≠ exposição total.",
    ]},
    {"versao": "0.8.0", "data": "2026-07-28", "mudancas": [
        "Fichas nominais REAIS de recuperação judicial e falência via DJEN/Comunica PJe (API pública do CNJ): ~370 processos com publicação nos últimos 45 dias em 8 tribunais, com razão social (apenas pessoas jurídicas), classe, órgão, atos recentes e link de consulta.",
        "Extração com confiança declarada: empresas por heurística de forma societária; CNPJ e valores por regex sobre o texto oficial, sempre marcados como extração automática a conferir.",
        "Correção: meses parciais reintroduzidos pela recoleta de falência TJSP removidos; agregados reconstruídos.",
    ]},
    {"versao": "0.7.0", "data": "2026-07-28", "mudancas": [
        "Funil processual REAL da recuperação judicial: nº de processos com cada movimento-marco da TPU (Concessão, Decretação de falência/convolação, Indeferimento, Extinção, Homologação de Transação) por tribunal e agregado, via agregações do DataJud — substitui o painel demo de fases.",
        "Cobertura ampliada de 4 para 8 tribunais (+TJPR, TJSC, TJBA, TJGO) nas séries de RJ e falência.",
        "Falência TJSP recoletada sem truncamento (25,3 mil processos únicos); agregados reconstruídos a partir das séries por tribunal (imune a coletas parciais); meses parciais (M-1, M) omitidos e quantis de contagem truncados em zero.",
    ]},
    {"versao": "0.6.0", "data": "2026-07-27", "mudancas": [
        "Recuperações judiciais e falências REAIS via API pública do CNJ/DataJud (classes TPU 129 e 108): séries mensais de ajuizamentos por tribunal (TJSP/TJRJ/TJMG/TJRS) e agregado, desde 2019, com projeção de 12 meses.",
        "Robustez metodológica do conector: datas interpretadas localmente (o índice do DataJud confunde o formato SAJ yyyyMMddHHmmss com epoch-millis), dedupe por número de processo (G1/G2), datas inválidas contadas, truncamentos logados.",
        "Fichas nominais permanecem DEMONSTRATIVAS (a API pública omite partes por LGPD) — claramente separadas das séries reais na aba.",
        "Alerta novo: alta de ajuizamentos de RJ acima de 30% a/a; projeção de RJ na visão geral deixa de ser demo.",
    ]},
    {"versao": "0.5.0", "data": "2026-07-27", "mudancas": [
        "Carteiras reais por instituição: PJ por CNAE (9 grupos), PJ por porte do tomador (micro/pequena/média/grande), e modalidades PF e PJ — parser dinâmico dos templates da interface IF.data (trels 123/127/128/129), sem ids de categoria hardcoded.",
        "Exposição do sistema bancário por setor (CNAE) com maiores credores por volume e por exposição relativa (restrita a carteiras PJ >= R$ 1 bi); participação PME no sistema e ranking de crédito a micro/pequenas empresas.",
        "Score de instituições v3: 6ª dimensão de concentração setorial (HHI da carteira PJ doméstica individualizada).",
        "Ficha da instituição com composição da carteira: setores PJ, modalidades PF/PJ, share PME e HHI.",
    ]},
    {"versao": "0.4.0", "data": "2026-07-27", "mudancas": [
        "Capital real: Índice de Basileia, Capital Principal, Nível I, alavancagem regulatória, imobilização e RWA por conglomerado, via arquivos JSON da interface IF.data (relatório Informações de Capital, ausente na API Olinda). Mapeamento de entidades UI↔Olinda validado com os grandes bancos.",
        "Score de instituições v2: 5ª dimensão de capital (Basileia invertida); dimensões sem dado são omitidas e o nº de dimensões usado é exibido — nunca imputação.",
        "Histórico de score em 5 trimestres (2025-T1 a 2026-T1) com sparkline por instituição.",
        "Vulnerabilidade a choques (CENÁRIO): Basileia pós-cenário severo por instituição via Δinad (elasticidades empíricas, excluindo as de sinal contraintuitivo) × carteira × LGD 45% ÷ RWA — sempre em intervalo.",
        "Separação explícita entre condição atual e vulnerabilidade na ficha de cada instituição.",
    ]},
    {"versao": "0.3.0", "data": "2026-07-27", "mudancas": [
        "Protocolo estatístico completo de indicadores antecedentes (correlação cruzada 1–12m, Granger, ganho fora da amostra vs. AR(1), estabilidade por metades) com regra formal de promoção e nova aba dedicada.",
        "Detecção de regimes: CUSUM sobre resíduos AR(1) + quebra estrutural sup-F (aprox. Andrews) em 6 séries de crédito; quebras significativas geram alerta como hipótese estatística.",
        "Elasticidades dos cenários estimadas empiricamente por MQO sobre Δ12m da inadimplência (com fallback para ilustrativas e checagem de sinal econômico); origem e incerteza exibidas na interface.",
        "Corte PF/PJ/Total global (v0.2.1): IBCC segmentado, 15 previsões segmentadas, cenários por segmento, filtro na URL.",
        "Investigado relatório de capital (Basileia) na API Olinda do IF.data: indisponível em todos os cortes (tipos 1–4 expõem apenas Resumo/Ativo/Passivo/DRE) — capital real permanece na Fase 3 com fonte alternativa.",
    ]},
    {"versao": "0.2.0", "data": "2026-07-26", "mudancas": [
        "Visão geral reformulada: diagnóstico rule-based, blocos 'onde estamos/o que mudou/o que pode acontecer/onde investigar', tabela de mudanças.",
        "Score de instituições passa a usar grupos de pares por segmento prudencial (Sr) com mediana/quartis e variação vs. trimestre anterior.",
        "Estresse setorial reestruturado em 4 componentes com tendência e velocidade separadas; condições de crédito (observadas) adicionadas com peso 0,20.",
        "Cenários e Alertas separados em abas; central de alertas com histórico e agrupamento.",
        "Área dedicada a Recuperações & Falências (dados demonstrativos selados).",
        "Metodologia viva: catálogo de séries, dicionário de indicadores, model cards e histórico de versões.",
        "Quantis preditivos com calibração conformal (p10≤p50≤p90) — implementado em 0.1.1.",
    ]},
    {"versao": "0.1.0", "data": "2026-07-26", "mudancas": [
        "MVP inicial: 4 fontes reais (BCB/SGS, IF.data, IBGE, Ipeadata), 5 módulos, previsões com backtest, IBCC, alertas, PDF via impressão."]},
]


SCORE_CARDS = [
    {"nome": "Score de risco de instituições (v3)",
     "componentes": ["capital (Basileia, invertido)", "rentabilidade (ROE, invertido)", "alavancagem",
                     "concentração em crédito", "dependência de captações", "concentração setorial (HHI)"],
     "pesos": "iguais entre as dimensões disponíveis",
     "normalizacao": "percentil dentro do grupo de pares prudencial",
     "tratamento_ausencia": "dimensão omitida (nunca imputada); nº de dimensões exibido; cobertura e confiança reportadas",
     "cobertura": "30 maiores conglomerados (score completo); demais IFs sem score nesta versão",
     "sensibilidade": "efeito máximo aproximado de remover uma dimensão exibido na decomposição",
     "validacao": "faixas NÃO calibradas empiricamente; uso acadêmico", "versao": "0.5.0"},
    {"nome": "IBCC (total, PF, PJ)",
     "componentes": ["preço", "qualidade", "capacidade de pagamento (só total/PF)", "atividade", "oferta", "antecedentes"],
     "pesos": "iguais", "normalizacao": "z-score vs. histórico completo de cada série",
     "tratamento_ausencia": "componente omitido (PJ sem capacidade de pagamento — documentado)",
     "cobertura": "séries mensais desde 2012", "sensibilidade": "decomposição por componente exibida",
     "validacao": "interpretação por percentil histórico; PCA na Fase 2b", "versao": "0.2.0"},
    {"nome": "Estresse setorial",
     "componentes": ["atividade 0,69 (observado)", "condições de crédito 0,31 (observado)", "estresse empresarial (em construção — fora do score)", "capacidade financeira (em construção — fora do score)"],
     "pesos": "fixos documentados", "normalizacao": "z-scores; score = 50 + 20×Σ(peso×z), truncado [0,100]",
     "tratamento_ausencia": "setor sem série suficiente é excluído",
     "cobertura": "indústria (PIM); 2 componentes demonstrativos",
     "sensibilidade": "contribuições por componente exibidas", "validacao": "plena só após RJ/emprego reais", "versao": "0.2.0"},
]


def build_model_cards(forecasts, ibcc, inst, sectors):
    cards = []
    for target, f in (forecasts or {}).items():
        if not f.get("ok"):
            continue
        d12 = f["diagnostico"].get("12", {})
        cards.append({
            "nome": f"Ensemble univariado — {target}", "objetivo": "Previsão 1–12 meses com bandas de incerteza",
            "variavel_alvo": target, "algoritmo": "Ensemble (naive, sazonal, drift, média móvel, AR(1) em diferenças, Holt) ponderado por 1/MAE",
            "validacao": "Backtest walk-forward, janela expansiva, ~24 cortes, por horizonte; sem look-ahead",
            "benchmark": "Último valor (naive)",
            "desempenho": {"mae_h12": d12.get("mae_ensemble_backtest"), "mae_naive_h12": d12.get("mae_naive_backtest"),
                           "ganho_vs_naive_pct_h12": d12.get("ganho_vs_naive_pct"), "n_backtests": d12.get("n_backtests")},
            "incerteza": "Quantis preditivos p10/p50/p90 por deslocamento dos quantis dos resíduos fora da amostra (conformal)",
            "limitacoes": "Univariado; não modela quebras estruturais nem covariáveis; bandas refletem erro histórico recente",
            "versao": "0.2.0", "atualizado_em": None,
        })
    cards.append({
        "nome": "IBCC", "objetivo": "Índice sintético de condições de crédito", "variavel_alvo": "condições de crédito",
        "algoritmo": "Média de z-scores por componente; média igual entre 6 componentes; 100 + 10×z",
        "validacao": "Interpretação por percentil histórico; PCA/fatores dinâmicos previstos na Fase 2",
        "benchmark": "—", "desempenho": {"componentes": 6},
        "incerteza": "Sensível à janela histórica; pesos fixos", "limitacoes": ibcc.get("limitacoes") if ibcc else None,
        "versao": "0.2.0", "atualizado_em": None,
    })
    if inst and inst.get("ok"):
        cards.append({
            "nome": "Score de instituições", "objetivo": "Risco relativo a pares prudenciais", "variavel_alvo": "risco relativo",
            "algoritmo": "Percentil intra-grupo (Sr) de 4 razões contábeis; média das dimensões",
            "validacao": "Faixas ainda não calibradas empiricamente (Fase 3)", "benchmark": "mediana do grupo",
            "desempenho": {"instituicoes": len(inst["instituicoes"]), "periodo": inst["anomes"]},
            "incerteza": "Sem Basileia/liquidez; ROE não anualizado", "limitacoes": inst.get("limitacoes"),
            "versao": "0.2.0", "atualizado_em": None,
        })
    if sectors and sectors.get("ok"):
        cards.append({
            "nome": "Estresse setorial", "objetivo": "Ranking de estresse por atividade industrial", "variavel_alvo": "estresse setorial",
            "algoritmo": "50 + 20×Σ(peso×z), 4 componentes", "validacao": "Componentes demo impedem validação plena (Fase 4)",
            "benchmark": "—", "desempenho": {"setores": len(sectors["setores"])},
            "incerteza": "2 de 4 componentes demonstrativos", "limitacoes": sectors.get("limitacoes"),
            "versao": "0.2.0", "atualizado_em": None,
        })
    cards.append({
        "nome": "Protocolo de indicadores antecedentes", "objetivo": "Promoção formal de candidatos a antecedente",
        "variavel_alvo": "Δ mensal da inadimplência (total/PF/PJ)",
        "algoritmo": "Correlação cruzada k=0..12; Granger AR(3); ganho OOS de AR(1)+candidato vs AR(1) (walk-forward h=1); estabilidade por metades",
        "validacao": "4 critérios obrigatórios; candidatos ex-ante por racional econômico; nº de testes reportado",
        "benchmark": "AR(1)", "desempenho": {"criterio_ganho_oos": "> 2% de redução de MAE"},
        "incerteza": "F aproximado por qui-quadrado; sem correção de múltiplos testes formal; sem vintages em tempo real ainda",
        "limitacoes": "Ganho medido em h=1; integração ao ensemble de previsão na Fase 2b",
        "versao": "0.3.0", "atualizado_em": None,
    })
    cards.append({
        "nome": "Detector de regimes", "objetivo": "Sinalizar hipóteses de mudança de regime/quebra estrutural",
        "variavel_alvo": "6 séries de crédito estacionarizadas",
        "algoritmo": "CUSUM (k=0,5σ, h=5σ) sobre resíduos AR(1) + sup-F de quebra na média (trimming 15%)",
        "validacao": "Valores críticos aproximados (Andrews 8,85 a 5%); mudança tratada como hipótese",
        "benchmark": "—", "desempenho": {"series_monitoradas": 6},
        "incerteza": "Univariado; uma quebra por busca; sensível a revisões",
        "limitacoes": "Bai-Perron múltiplo e Markov-switching na Fase 2b",
        "versao": "0.3.0", "atualizado_em": None,
    })
    cards.append({
        "nome": "Elasticidades de cenário (empíricas)", "objetivo": "Parametrizar a transmissão de choques nos cenários",
        "variavel_alvo": "Δ12m da inadimplência total",
        "algoritmo": "MQO: Δ12 Selic (t-6), Δ12 desemprego, IBC-Br yoy (t-3, proxy PIB), câmbio yoy/10 (t-3)",
        "validacao": "Checagem de sinal econômico; fallback para ilustrativas se implausível",
        "benchmark": "elasticidades ilustrativas do config", "desempenho": {"intervalo": "±2 EP clássicos"},
        "incerteza": "Sem HAC (incerteza subestimada com dados sobrepostos); associação, não causalidade",
        "limitacoes": "Identificação causal e heterogeneidade por segmento na Fase 2b",
        "versao": "0.3.0", "atualizado_em": None,
    })
    return cards


def build_novidades():
    """'O que mudou' — o diff editorial da execução, consolidado dos gold já
    escritos nesta rodada (ler_gold_opcional: dependência nunca obrigatória).
    Regras determinísticas, régua declarada em cada item; nada é ranqueado
    entre famílias. Achado P1 da auditoria de 12/08: um produto de consulta
    vira produto de hábito quando diz o que mudou hoje."""
    from datetime import date, timedelta
    out = []
    corte45 = (date.today() - timedelta(days=45)).isoformat()

    ac = common.ler_gold_opcional("alertas_central.json") or {}
    novos = [a for a in ac.get("alertas", []) if not a.get("recorrente")]
    for a in novos[:3]:
        out.append({"tipo": "alerta_novo", "titulo": a.get("titulo"),
                    "detalhe": f"família {a.get('familia')} — primeiro disparo desta regra",
                    "link": {"view": "alerts"}})

    reg = common.ler_gold_opcional("regimes.json") or {}
    for v in (reg.get("vigentes") or []):
        if (v.get("inicio_iso") or "") >= corte45:
            out.append({"tipo": "regime", "titulo": f"{v.get('nome')} sob {v.get('tipo')} desde {v.get('inicio')}",
                        "detalhe": "entrada recente na lista oficial de regimes do BCB (janela de 45 dias)",
                        "link": {"view": "institutions", "sec": "sec-regimes"}})

    rec = common.ler_gold_opcional("recordes.json") or {}
    for r in (rec.get("recordes") or []):
        if (str(r.get("ref") or ""))[:10] >= corte45:
            out.append({"tipo": "recorde", "titulo": f"{r.get('nome')}: {r.get('rotulo')} ({r.get('valor')} {r.get('unidade')})",
                        "detalhe": f"referência {str(r.get('ref'))[:7]} — recorde na janela de 45 dias",
                        "link": {"view": "overview"}})

    gu = common.ler_gold_opcional("guidance.json") or {}
    # revisão de guidance é notícia enquanto o trimestre dela é o corrente ou o
    # anterior (rótulos civis calculados, nunca fixos)
    hoje = date.today()
    tri = (hoje.month - 1) // 3 + 1
    rot_atual = f"{tri}T{hoje.year % 100}"
    tri_ant = tri - 1 or 4
    ano_ant = hoje.year if tri > 1 else hoje.year - 1
    rot_ant = f"{tri_ant}T{ano_ant % 100}"
    for c in gu.get("ciclos", []):
        for a2 in c.get("acompanhamentos", []) or []:
            if a2.get("tipo") == "revisao" and a2.get("periodo") in (rot_atual, rot_ant):
                out.append({"tipo": "guidance", "titulo": f"{c.get('banco')}: guidance revisado no {a2.get('periodo')}",
                            "detalhe": (a2.get("resumo") or "")[:180],
                            "link": {"view": "institutions"}})
    # vaga por família (E12 da avaliação de 05/09): quatro liquidações de DTVM
    # ocupavam quatro das seis vagas. Cada família recebe até duas vagas na
    # primeira rodada; o que sobrar até oito é preenchido na ordem das famílias.
    por_tipo = {}
    for it in out:
        por_tipo.setdefault(it["tipo"], []).append(it)
    ordem_tipos = ["alerta_novo", "regime", "recorde", "guidance"]
    sel = []
    for t in ordem_tipos:
        sel.extend(por_tipo.get(t, [])[:2])
    for t in ordem_tipos:
        for it in por_tipo.get(t, [])[2:]:
            if len(sel) >= 8:
                break
            sel.append(it)
    return {"itens": sel[:8],
            "nota": ("Consolidado por regra determinística na execução diária: alertas em primeiro disparo, "
                     "entradas recentes em regimes (45 dias), recordes com referência recente e revisões de "
                     "guidance do trimestre corrente/anterior. Até duas vagas por família na primeira rodada; "
                     "famílias distintas — a ordem não é gravidade.")}
