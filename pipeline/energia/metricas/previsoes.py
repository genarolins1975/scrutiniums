"""Métricas do módulo Previsões: definição única das medidas publicadas em
public/energia/gold/previsoes_desempenho.json (painéis P013 a P016). As fórmulas rodam em
pipeline/energia/previsoes/ (avaliacao.py, modelos_pld.py, emissao.py) e em
pipeline/energia/modulos/previsoes.py; a interface só lê o valor calculado.

Convenções comuns: horário de Brasília; PLD em R$/MWh nominais; entrega semanal de
sábado 00h ao sábado seguinte 00h (fim excluído) e mensal no mês civil; erro = previsão −
realizado; período de desenvolvimento = entregas que terminam até 01/01/2025, teste =
entregas que começam em 01/01/2025 ou depois; dado sob a regra LAT1D.
"""

GOLD = "previsoes_desempenho.json"
PAGINAS = ["/setor-eletrico/pld/previsoes", "/setor-eletrico/pld/modelos"]
F_PLD = "ccee_pld_horario"
F_EAR = "ear_subsistema_di"
F_ENA = "ena_subsistema_di"
F_LIM = "regulatorio:limites_pld"
F_ARQ = "previsoes:arquivo_de_emissoes"

_LAT1D = ("O teste retrospectivo é reconstrução sob a hipótese LAT1D (período usado só depois de terminado há 1 dia); a CCEE não "
          "informa quando publicou cada hora do passado (achado A09).")
_DEP = "Origens diárias vizinhas preveem a mesma entrega: o tamanho efetivo é o número de entregas distintas, publicado ao lado."
_AUS = "Célula sem previsão ou sem realizado completo fica fora do cálculo; ausência nunca vira zero."
_DIM = ["modelo", "horizonte (W1 a W4, M1 a M3)", "submercado", "período (desenvolvimento, teste)"]


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINAS, "versao_formula": "1.0"}
    base.update(kw)
    return base


METRICAS = [
    _m(id="previsao_pld_realizado_entrega", titulo="PLD médio realizado da entrega",
       pergunta="Qual foi o PLD médio da semana (ou do mês) que se queria prever?",
       definicao=("Média aritmética simples de todas as horas do PLD horário da CCEE na entrega: 168 horas na semana de sábado a "
                  "sábado; 24 × dias no mês civil. É média temporal, não ponderada pela carga."),
       unidade="R$/MWh", grao_geografico="submercado", grao_temporal="semana operativa ou mês civil", fontes=[F_PLD],
       numerador="Σ PLD_h nas horas da entrega", denominador="número de horas da entrega",
       formula="realizado = Σ PLD_h ÷ horas da entrega", regra_agregacao="média por duração (todas as horas têm 1 hora)",
       natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=["submercado", "entrega"],
       regras_comparabilidade=["Não é o preço médio ponderado pela carga nem o PLD de uma hora."],
       regra_cobertura="Só entregas com todas as horas publicadas.",
       politica_ausencia="Entrega com hora ausente não tem realizado (fica fora da avaliação, nunca completada).",
       validacoes=["realizado dentro de [piso, teto estrutural] médios vigentes (tolerância R$ 0,01/MWh)",
                   "contagem de horas igual à duração da entrega"],
       limitacoes=["O PLD pode ser republicado pela CCEE; a avaliação usa a versão vigente no silver (nenhuma revisão detectada até 30/09/2026)."]),
    _m(id="previsao_pld_referencia_b0", titulo="Referência experimental B0 (persistência)",
       pergunta="Se o PLD médio repetisse o do último período completo, quanto seria em cada entrega?",
       definicao=("Média das horas do último período completo da mesma frequência (semana de sábado a sábado ou mês civil) que "
                  "terminou até 1 dia antes do corte das 07h00 e que já estava capturado no corte, limitada à faixa "
                  "[piso, teto estrutural] dos atos da ANEEL publicados até a origem. Emitida diariamente como referência "
                  "experimental identificada (seção 12.4), não como previsão aprovada."),
       unidade="R$/MWh", grao_geografico="submercado", grao_temporal="entrega (W1 a W4, M1 a M3) por rodada diária",
       fontes=[F_PLD, F_LIM], formula="B0 = mín(máx(Σ PLD_h do último período elegível ÷ horas; piso), teto)",
       regra_agregacao="média por duração; restrição à faixa média diária de limites da entrega",
       natureza_fonte="OBSERVADO", natureza_transformacao="PREVISTO", dimensoes=["submercado", "horizonte", "rodada"],
       regras_comparabilidade=["Mesmo valor para W1 a W4 (e para M1 a M3) de uma rodada: é persistência.",
                               "Comparar com o realizado da mesma entrega, nunca com o PLD de um dia."],
       regra_cobertura="Rodada com o período elegível completo e capturado até o corte.",
       politica_ausencia="Sem período elegível capturado, a célula fica sem número com o motivo (ex.: SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE).",
       validacoes=["recálculo independente hora a hora em cada emissão (tolerância 1e-6 R$/MWh)",
                   "capturado_em de cada dado usado anterior ao corte", "reexecução do arquivo (tolerância R$ 0,005/MWh)"],
       limitacoes=["Não usa chuva, reservatórios nem vazões.", "Sem faixa de incerteza enquanto o segmento não estiver calibrado.",
                   "Modelo em pesquisa: não alimenta a previsão principal."]),
    _m(id="previsao_pld_retrospectiva", titulo="Previsão do teste retrospectivo",
       pergunta="O que cada modelo teria previsto em cada dia do passado, com o dado disponível sob LAT1D?",
       definicao=("Previsão de B0, S0 (mesmo período um ano antes), C2-P e C2-H para cada origem diária desde 01/01/2022, com "
                  "treino e quantis só com entregas encerradas antes do corte; restrita à faixa de preço."),
       unidade="R$/MWh", grao_geografico="submercado", grao_temporal="origem diária × entrega", fontes=[F_PLD, F_EAR, F_ENA, F_LIM],
       formula="C2 = B0 + Σ_j (x_j ÷ escala_j) · β_j, sem intercepto, β por mínimos quadrados penalizados (λ por validação interna)",
       regra_agregacao="não agregada (uma linha por célula no CSV)",
       natureza_fonte="OBSERVADO", natureza_transformacao="PREVISTO", dimensoes=_DIM,
       regras_comparabilidade=["Reconstrução sob hipótese: não é previsão emitida nem registrada antes do realizado."],
       regra_cobertura="C2 só com 52 entregas semanais (ou 24 meses) de treino; quantis com 24 entregas de resíduos.",
       politica_ausencia="Sem treino suficiente ou com variável ausente, a célula fica sem previsão (nunca vira B0).",
       validacoes=["treino só com entregas terminadas até o domingo de ajuste menos 1 dia", "quantis não cruzados",
                   "previsões dentro da faixa de preço"],
       limitacoes=[_LAT1D, "EAR e ENA do ONS são revisadas (consistência recorrente); o teste do C2-H usa o valor revisado."]),
    _m(id="previsao_erro_absoluto_medio", titulo="Erro médio absoluto (MAE)",
       pergunta="Quanto, em média, a previsão errou para mais ou para menos?",
       definicao="Média de |previsão − realizado| sobre as células avaliadas (origem × submercado) do recorte.",
       unidade="R$/MWh", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="Σ |previsão − realizado|", denominador="células avaliadas",
       formula="MAE = Σ |ŷ − y| ÷ n", regra_agregacao="média simples das células (cada origem pesa igual)",
       natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Comparar modelos só nas mesmas células (MAE pareado com o B0).",
                               "Desenvolvimento e teste têm níveis de preço diferentes: não compare MAE entre períodos como melhora."],
       regra_cobertura="Células com previsão e realizado completo.", politica_ausencia=_AUS,
       validacoes=["B0 refeito por outro caminho", "contagem de 28 células por origem"],
       limitacoes=[_LAT1D, _DEP]),
    _m(id="previsao_vies", titulo="Viés da previsão",
       pergunta="A previsão tende a ficar acima ou abaixo do realizado?",
       definicao="Média de (previsão − realizado): positivo = superestima o PLD em média.",
       unidade="R$/MWh", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       numerador="Σ (previsão − realizado)", denominador="células avaliadas", formula="viés = Σ (ŷ − y) ÷ n",
       regra_agregacao="média simples das células", natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Viés perto de zero não significa erro pequeno (erros de sinais opostos se compensam)."],
       regra_cobertura="Células com previsão e realizado completo.", politica_ausencia=_AUS,
       validacoes=["mesmas células do MAE"], limitacoes=[_LAT1D, _DEP]),
    _m(id="previsao_ganho_sobre_b0", titulo="Ganho de MAE sobre a persistência (B0)",
       pergunta="O modelo erra menos que repetir o último período?",
       definicao=("MAE do B0 menos MAE do modelo nas mesmas células; positivo = melhor que o B0. Intervalo de 90% por bootstrap de "
                  "blocos de calendário das origens (28 dias no semanal, 91 no mensal), 1.000 réplicas, semente fixa."),
       unidade="R$/MWh", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte, frequência e período",
       fontes=[F_PLD], formula="ganho = Σ(|ŷ_B0 − y| − |ŷ_m − y|) ÷ n pareadas; IC = percentis 5 e 95 das médias reamostradas por bloco",
       regra_agregacao="média das diferenças pareadas; blocos mantêm juntas todas as células das mesmas origens",
       natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Só diz se o modelo supera a persistência; não aprova o modelo.",
                               "Ganho no desenvolvimento é exploratório (período já examinado pela pesquisa)."],
       regra_cobertura="Intervalo só com pelo menos 5 blocos.", politica_ausencia="Menos de 5 blocos: intervalo nulo, declarado.",
       validacoes=["mesmas células para os dois modelos"], limitacoes=[_DEP, "Blocos de calendário aproximam, não eliminam, a dependência."]),
    _m(id="previsao_perda_quantilica", titulo="Perda quantílica média",
       pergunta="Quão boa é a distribuição prevista, e não só o ponto?",
       definicao=("Média, nos níveis 5, 10, 25, 50, 75, 90 e 95%, da perda de cada quantil: τ·(y − q) se y ≥ q, (1 − τ)·(q − y) "
                  "se y < q; média sobre as células com quantis."),
       unidade="R$/MWh", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       formula="PQ = média_células( média_τ( máx(τ(y − q_τ), (τ − 1)(y − q_τ)) ) )", regra_agregacao="média simples",
       natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Com sete níveis, não é o CRPS; serve para comparar modelos nas mesmas células."],
       regra_cobertura="Células com quantis (24 entregas de resíduos no segmento).", politica_ausencia=_AUS,
       validacoes=["quantis ordenados em toda célula"], limitacoes=[_LAT1D, _DEP]),
    _m(id="previsao_cobertura_p10_p90", titulo="Cobertura da faixa P10 a P90",
       pergunta="A faixa que deveria conter o realizado em 80% dos casos conteve quantas vezes?",
       definicao=("Fração das células em que o realizado ficou entre o quantil de 10% e o de 90% (inclusive). O estado de "
                  "calibração usa entregas distintas como tamanho de amostra (regra da governança: 75% a 85% com n ≥ 100)."),
       unidade="fração de 0 a 1", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="células com P10 ≤ realizado ≤ P90", denominador="células com quantis",
       formula="cobertura = n(P10 ≤ y ≤ P90) ÷ n", regra_agregacao="razão de contagens",
       natureza_fonte="CALCULADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Cobertura sozinha não basta: ver largura e perda quantílica."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS,
       validacoes=["calibração só com n ≥ 100 entregas distintas"], limitacoes=[_DEP, "Faixa não calibrada não é publicada na previsão atual."]),
    _m(id="previsao_largura_p10_p90", titulo="Largura média da faixa P10 a P90",
       pergunta="Quão larga é a faixa de incerteza?",
       definicao="Média de (P90 − P10) nas células com quantis.", unidade="R$/MWh",
       grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       formula="largura = Σ (P90 − P10) ÷ n", regra_agregacao="média simples", natureza_fonte="CALCULADO",
       natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Faixa estreita só é boa se a cobertura estiver perto da nominal."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS, validacoes=["P90 ≥ P10 em toda célula"],
       limitacoes=[_DEP]),
    _m(id="previsao_atraso_emissao", titulo="Atraso da emissão",
       pergunta="A rodada saiu até as 08h00 de Brasília?",
       definicao=("Minutos entre o prazo (08h00 de Brasília do dia de origem) e o horário real em que a rodada foi calculada e "
                  "registrada; zero quando saiu no prazo. Rodada ausente em dia de operação agendada é contada à parte."),
       unidade="minutos", grao_geografico="não se aplica", grao_temporal="rodada diária", fontes=[F_ARQ],
       formula="atraso = máx(0, emitido_em − prazo)", regra_agregacao="por rodada; contagens de rodadas no prazo, atrasadas e faltantes",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["rodada", "modo (agendada ou manual)"],
       regras_comparabilidade=["Rodada manual não comprova a rotina agendada."],
       regra_cobertura="Todas as rodadas do arquivo.", politica_ausencia="Dia sem rodada aparece como faltante, nunca como atraso zero.",
       validacoes=["emitido_em com fuso", "prazo calculado pelo fuso America/Sao_Paulo"],
       limitacoes=["O horário é o do cálculo; a publicação no site depende do commit, poucos minutos depois."]),
]
