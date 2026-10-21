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
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["submercado", "entrega"],
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
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
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
       regra_agregacao="média simples das células", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
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
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
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
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Com sete níveis, não é o CRPS; serve para comparar modelos nas mesmas células."],
       regra_cobertura="Células com quantis (24 entregas de resíduos no segmento).", politica_ausencia=_AUS,
       validacoes=["quantis ordenados em toda célula"], limitacoes=[_LAT1D, _DEP]),
    _m(id="previsao_cobertura_p10_p90", titulo="Cobertura da faixa P10 a P90",
       pergunta="A faixa que deveria conter o realizado em 80% dos casos conteve quantas vezes?",
       definicao=("Fração das células em que o realizado ficou entre o quantil de 10% e o de 90% (inclusive). O estado de "
                  "calibração usa entregas distintas como tamanho de amostra (regra da governança: 75% a 85% com n ≥ 100). "
                  "A comparação usa tolerância de 1e-6 R$/MWh: realizado igual ao piso que limitou o P10 conta como coberto "
                  "(as duas contas diferem só por ruído de ponto flutuante, da ordem de 1e-10)."),
       unidade="fração de 0 a 1", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="células com P10 − 1e-6 ≤ realizado ≤ P90 + 1e-6", denominador="células com quantis",
       formula="cobertura = n(P10 − ε ≤ y ≤ P90 + ε) ÷ n, ε = 1e-6 R$/MWh", regra_agregacao="razão de contagens",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Cobertura sozinha não basta: ver largura e perda quantílica."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS,
       validacoes=["calibração só com n ≥ 100 entregas distintas",
                   "cobertura refeita por outro leitor a partir do CSV do teste retrospectivo (células cobertas iguais a menos das "
                   "ambíguas pelo arredondamento a 2 casas)",
                   "realizado no piso com P10 limitado ao piso conta como coberto: semana real de 04/01/2025 (as 168 horas a "
                   "R$ 58,60/MWh nos quatro submercados), média por somas acumuladas 58,59999999997672 contra P10 no piso de "
                   "58,60000000000001 (pipeline/tests/test_energia_previsoes.py, "
                   "CoberturaNoPiso.test_semana_de_04_01_2025_no_piso_conta_como_coberta)"],
       limitacoes=[_DEP, "Faixa não calibrada não é publicada na previsão atual.",
                   "Registros do arquivo emitidos antes de 01/10/2026 gravaram a cobertura com comparação estrita e nunca são "
                   "reescritos. Enquanto os números de desempenho estiverem retidos, a partição pública do arquivo omite essa "
                   "cobertura e as rodadas novas não a gravam; depois da liberação, a gold publica ao lado o valor refeito com a "
                   "regra corrigida (prospectivo.calibracao_regra_antiga)."]),
    _m(id="previsao_largura_p10_p90", titulo="Largura média da faixa P10 a P90",
       pergunta="Quão larga é a faixa de incerteza?",
       definicao="Média de (P90 − P10) nas células com quantis.", unidade="R$/MWh",
       grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       formula="largura = Σ (P90 − P10) ÷ n", regra_agregacao="média simples", natureza_fonte="OBSERVADO",
       natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Faixa estreita só é boa se a cobertura estiver perto da nominal."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS, validacoes=["P90 ≥ P10 em toda célula"],
       limitacoes=[_DEP]),
    _m(id="previsao_rmse", titulo="Raiz do erro quadrático médio (RMSE)",
       pergunta="Quanto a previsão errou, pesando mais os erros grandes?",
       definicao="Raiz quadrada da média de (previsão − realizado)² sobre as células avaliadas do recorte.",
       unidade="R$/MWh", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       numerador="Σ (previsão − realizado)²", denominador="células avaliadas", formula="RMSE = √(Σ (ŷ − y)² ÷ n)",
       regra_agregacao="média simples dos quadrados das células, depois a raiz", natureza_fonte="OBSERVADO",
       natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["RMSE ≥ MAE sempre; a distância entre os dois indica erros grandes concentrados (extremos)."],
       regra_cobertura="Células com previsão e realizado completo.", politica_ausencia=_AUS,
       validacoes=["mesmas células do MAE"], limitacoes=[_LAT1D, _DEP]),
    _m(id="previsao_skill_mae_sobre_b0", titulo="Habilidade relativa ao B0 (skill de MAE)",
       pergunta="Que fração do erro da persistência o modelo elimina?",
       definicao=("1 − MAE do modelo ÷ MAE do B0, nas mesmas células: 0 = igual à persistência, positivo = melhor, negativo = pior. "
                  "Sem valor quando o MAE do B0 é zero."),
       unidade="fração (adimensional)", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="MAE do modelo nas células pareadas", denominador="MAE do B0 nas mesmas células",
       formula="skill = 1 − MAE_m ÷ MAE_B0", regra_agregacao="razão de médias nas mesmas células (não é média de razões)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Só compara com o B0 nas mesmas células; não aprova o modelo."],
       regra_cobertura="Células com previsão do modelo e do B0 e realizado completo.",
       politica_ausencia="MAE do B0 zero ou nenhuma célula pareada: sem valor (null), nunca zero.",
       validacoes=["mesmas células do ganho sobre o B0"], limitacoes=[_DEP]),
    _m(id="previsao_cobertura_p05_p95", titulo="Cobertura da faixa P5 a P95",
       pergunta="A faixa que deveria conter o realizado em 90% dos casos conteve quantas vezes?",
       definicao=("Fração das células em que o realizado ficou entre o quantil de 5% e o de 95% (inclusive), com a mesma "
                  "tolerância de 1e-6 R$/MWh da faixa P10 a P90."),
       unidade="fração de 0 a 1", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="células com P5 − 1e-6 ≤ realizado ≤ P95 + 1e-6", denominador="células com quantis",
       formula="cobertura90 = n(P5 − ε ≤ y ≤ P95 + ε) ÷ n, ε = 1e-6 R$/MWh", regra_agregacao="razão de contagens",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Nominal 90%; não entra na regra de calibração, que usa a faixa P10 a P90."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS,
       validacoes=["P5 ≤ P10 ≤ P90 ≤ P95 em toda célula"], limitacoes=[_DEP]),
    _m(id="previsao_fracao_abaixo_p10", titulo="Fração do realizado abaixo do P10",
       pergunta="Quantas vezes o preço ficou abaixo da ponta inferior da faixa?",
       definicao=("Fração das células com quantis em que o realizado ficou abaixo do P10 por mais de 1e-6 R$/MWh. Nominal 10%; "
                  "com a cobertura e a fração acima do P90 soma 1."),
       unidade="fração de 0 a 1", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="células com realizado < P10 − 1e-6", denominador="células com quantis",
       formula="abaixo_p10 = n(y < P10 − ε) ÷ n", regra_agregacao="razão de contagens", natureza_fonte="OBSERVADO",
       natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Assimetria entre abaixo do P10 e acima do P90 indica faixa deslocada, não só estreita."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS,
       validacoes=["abaixo_p10 + cobertura_p10_p90 + acima_p90 = 1"], limitacoes=[_DEP]),
    _m(id="previsao_fracao_acima_p90", titulo="Fração do realizado acima do P90",
       pergunta="Quantas vezes o preço ficou acima da ponta superior da faixa?",
       definicao="Fração das células com quantis em que o realizado ficou acima do P90 por mais de 1e-6 R$/MWh. Nominal 10%.",
       unidade="fração de 0 a 1", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período",
       fontes=[F_PLD], numerador="células com realizado > P90 + 1e-6", denominador="células com quantis",
       formula="acima_p90 = n(y > P90 + ε) ÷ n", regra_agregacao="razão de contagens", natureza_fonte="OBSERVADO",
       natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Ver a fração abaixo do P10 junto."],
       regra_cobertura="Células com quantis.", politica_ausencia=_AUS,
       validacoes=["abaixo_p10 + cobertura_p10_p90 + acima_p90 = 1"], limitacoes=[_DEP]),
    _m(id="previsao_tamanho_amostra", titulo="Tamanho da amostra da avaliação",
       pergunta="Sobre quantos casos cada métrica foi calculada?",
       definicao=("Contagens publicadas ao lado de cada métrica: células avaliadas (origem × submercado), entregas distintas "
                  "(tamanho efetivo, usado na calibração), origens, células e entregas com quantis, células pareadas com o B0."),
       unidade="contagem", grao_geografico="submercado ou os quatro juntos", grao_temporal="horizonte e período", fontes=[F_PLD],
       formula="contagem de células, de entregas distintas e de origens distintas no recorte",
       regra_agregacao="contagem", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=_DIM,
       regras_comparabilidade=["Células não são casos independentes: compare amostras pelo número de entregas distintas."],
       regra_cobertura="Todas as células do recorte com previsão e realizado completo.", politica_ausencia=_AUS,
       validacoes=["28 células por origem"], limitacoes=[_DEP]),
    _m(id="previsao_coeficiente_d7_acima_de_1", titulo="Ajustes do C2 com coeficiente de d7 − B0 acima de 1 (G23-R1)",
       pergunta="Com que frequência o C2 amplifica o sinal dos últimos 7 dias?",
       definicao=("Por segmento (modelo × horizonte × submercado): ajustes semanais concluídos em que o coeficiente da variável média "
                  "dos 7 últimos dias − B0, na unidade original, passou de 1; fração sobre os ajustes concluídos; também o maior "
                  "coeficiente e quantos ajustes escolheram λ = ZERO (correção desligada)."),
       unidade="contagem e fração de 0 a 1", grao_geografico="submercado", grao_temporal="origem de ajuste (domingo)",
       fontes=[F_PLD, F_EAR, F_ENA], numerador="ajustes com coeficiente de d7 − B0 > 1", denominador="ajustes concluídos (ok)",
       formula="fração = n(coef_d7 > 1) ÷ n(ajustes ok)", regra_agregacao="contagem por segmento; total = soma das contagens",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["modelo", "horizonte", "submercado"],
       regras_comparabilidade=["Ajustes de domingos vizinhos compartilham quase todo o treino: não são casos independentes."],
       regra_cobertura="Ajustes com treino suficiente (52 semanas ou 24 meses).",
       politica_ausencia="Segmento sem ajuste concluído: fração nula (null), nunca zero.",
       validacoes=["coeficientes por origem publicados em previsoes_ajustes_c2.csv"],
       limitacoes=["Coeficiente acima de 1 indica amplificação possível, não erro por si só."]),
    _m(id="previsao_brutas_fora_da_faixa", titulo="Previsões brutas fora da faixa de preço (G23-R1)",
       pergunta="Quantas previsões do C2 sairiam abaixo do piso, acima do teto ou negativas sem a restrição de preço?",
       definicao=("Por modelo e frequência: previsões brutas (antes da restrição à faixa [piso, teto estrutural] médios dos atos "
                  "publicados até a origem) abaixo do piso ou acima do teto por mais de 1e-6 R$/MWh, e negativas. O total é o "
                  "número de previsões brutas calculadas."),
       unidade="contagem de células", grao_geografico="os quatro submercados juntos", grao_temporal="frequência (semanal, mensal)",
       fontes=[F_PLD, F_EAR, F_ENA, F_LIM], numerador="previsões brutas fora da faixa", denominador="previsões brutas calculadas",
       formula="n(bruta < piso − ε), n(bruta > teto + ε), n(bruta < −ε), ε = 1e-6 R$/MWh",
       regra_agregacao="contagem", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["modelo", "frequência"],
       regras_comparabilidade=["A previsão publicada é sempre a restrita; a bruta só documenta o comportamento do modelo."],
       regra_cobertura="Todas as células com previsão bruta do C2.", politica_ausencia="Célula sem previsão bruta não entra.",
       validacoes=["mesma tolerância da cobertura: B0 no piso com λ = ZERO não conta como abaixo do piso"],
       limitacoes=["Faixa provisória (ato do ano seguinte ainda não publicado) usa os limites vigentes na origem."]),
    _m(id="previsao_limiares_de_regime", titulo="Limiares dos regimes de preço, armazenamento e extremo",
       pergunta="Onde termina o preço intermediário e começa o alto, e o armazenamento baixo ou alto?",
       definicao=("Fixados no período de desenvolvimento, por submercado e frequência, e aplicados sem mudança ao teste: percentil "
                  "75 do B0 (preço alto acima dele), percentil 90 do realizado (extremo acima dele), percentis 33 e 67 da EAR do "
                  "último dia elegível (armazenamento baixo, médio e alto). Percentil tipo 7 (interpolação linear)."),
       unidade="R$/MWh (B0 e realizado); % da capacidade (EAR)", grao_geografico="submercado", grao_temporal="frequência",
       fontes=[F_PLD, F_EAR], formula="limiar = quantil tipo 7 dos valores do desenvolvimento no submercado e frequência",
       regra_agregacao="percentil empírico", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["submercado", "frequência"],
       regras_comparabilidade=["O nível de preço subiu depois de 2024: no teste, a maior parte das células cai em preço alto."],
       regra_cobertura="Células do desenvolvimento com o valor presente.",
       politica_ausencia="Sem valores no desenvolvimento: limiar nulo e regime não atribuído.",
       validacoes=["limiares calculados só com o desenvolvimento"], limitacoes=["Grupos com menos de 10 entregas são marcados."]),
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

# Campo publicado (linhas de desempenho, regimes, sensibilidade, G23-R1, prospectivo) → id da
# métrica que o define. O teste do módulo confere que todo campo numérico publicado está aqui.
CAMPOS = {
    "mae": "previsao_erro_absoluto_medio", "mae_b0_pareado": "previsao_erro_absoluto_medio", "vies": "previsao_vies",
    "rmse": "previsao_rmse", "ganho_vs_b0": "previsao_ganho_sobre_b0", "ganho_ic90": "previsao_ganho_sobre_b0",
    "skill": "previsao_skill_mae_sobre_b0", "perda_quantilica": "previsao_perda_quantilica",
    "cobertura_p10_p90": "previsao_cobertura_p10_p90", "cobertura_p05_p95": "previsao_cobertura_p05_p95",
    "largura_p10_p90": "previsao_largura_p10_p90", "abaixo_p10": "previsao_fracao_abaixo_p10", "acima_p90": "previsao_fracao_acima_p90",
    "linhas": "previsao_tamanho_amostra", "entregas": "previsao_tamanho_amostra", "origens": "previsao_tamanho_amostra",
    "entregas_com_quantis": "previsao_tamanho_amostra", "linhas_pareadas": "previsao_tamanho_amostra",
    "celulas": "previsao_tamanho_amostra", "entregas_apuradas": "previsao_tamanho_amostra",
    "ajustes": "previsao_coeficiente_d7_acima_de_1", "ajustados": "previsao_coeficiente_d7_acima_de_1",
    "coef_d7_acima_de_1": "previsao_coeficiente_d7_acima_de_1", "fracao_coef_d7_acima_de_1": "previsao_coeficiente_d7_acima_de_1",
    "lambda_zero": "previsao_coeficiente_d7_acima_de_1", "coef_d7_maximo": "previsao_coeficiente_d7_acima_de_1",
    "ajustes_ok": "previsao_coeficiente_d7_acima_de_1", "acima_de_1": "previsao_coeficiente_d7_acima_de_1",
    "fracao": "previsao_coeficiente_d7_acima_de_1",
    "previsoes": "previsao_brutas_fora_da_faixa", "abaixo_do_piso": "previsao_brutas_fora_da_faixa",
    "acima_do_teto": "previsao_brutas_fora_da_faixa", "negativas": "previsao_brutas_fora_da_faixa",
    "b0_p75": "previsao_limiares_de_regime", "y_p90": "previsao_limiares_de_regime", "ear_p33": "previsao_limiares_de_regime",
    "ear_p67": "previsao_limiares_de_regime",
    # caso da origem 30/11/2024 (G23-R1): valores das próprias previsões e do realizado
    "realizado": "previsao_pld_realizado_entrega", "b0": "previsao_pld_retrospectiva", "piso": "previsao_pld_retrospectiva",
    "c2p_bruta": "previsao_pld_retrospectiva", "c2h_bruta": "previsao_pld_retrospectiva",
    "c2p_final": "previsao_pld_retrospectiva", "c2h_final": "previsao_pld_retrospectiva",
}


# ---------------------------------------------------------------- estado de publicação

# Medidas de desempenho do teste retrospectivo (P016). Sem a liberação formal pelo
# responsável (validacao_observatorio.decisao_publicacao no registro de modelos), elas são
# calculadas e validadas, mas não entram na gold publicada: ficam em
# data/energia/previsoes/validacao_interna/previsoes_desempenho_interno.json, fora do
# portal. O catálogo diz isso em vez de apontar para uma gold que não as contém.
RETIDAS_SEM_LIBERACAO = (
    "previsao_pld_retrospectiva", "previsao_erro_absoluto_medio", "previsao_vies", "previsao_ganho_sobre_b0",
    "previsao_perda_quantilica", "previsao_cobertura_p10_p90", "previsao_largura_p10_p90", "previsao_rmse",
    "previsao_skill_mae_sobre_b0", "previsao_cobertura_p05_p95", "previsao_fracao_abaixo_p10", "previsao_fracao_acima_p90",
    "previsao_brutas_fora_da_faixa", "previsao_limiares_de_regime",
)
GOLD_INTERNA = "previsoes_desempenho_interno.json"


def _desempenho_liberado():
    try:
        from pipeline.energia.previsoes import emissao as em
        return em.publicacao_desempenho(em.le_registro())[0]
    except (OSError, ValueError, ImportError):
        return False


def _aplica_publicacao(metricas, liberado):
    for m in metricas:
        if m["id"] not in RETIDAS_SEM_LIBERACAO:
            m["publicacao"] = {"estado": "PUBLICADA", "gold": GOLD}
        elif liberado:
            m["publicacao"] = {"estado": "PUBLICADA", "gold": GOLD}
        else:
            m["gold"] = GOLD_INTERNA
            m["publicacao"] = {
                "estado": "RETIDA",
                "gold": None,
                "gold_quando_liberada": GOLD,
                "local": "data/energia/previsoes/validacao_interna (fora do portal)",
                "motivo": ("Número de desempenho do teste retrospectivo: só entra no portal depois da liberação formal pelo "
                           "responsável pela plataforma (registro de modelos); até lá é calculado e validado, sem publicação."),
            }
    return metricas


_aplica_publicacao(METRICAS, _desempenho_liberado())
