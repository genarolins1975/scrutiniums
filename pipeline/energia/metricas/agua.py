"""Métricas do módulo Água e clima (detalhe): definição única das medidas publicadas em
public/energia/gold/agua_detalhe.json (painéis P017 a P020). A fórmula roda em
pipeline/energia/modulos/agua_detalhe.py; a interface só lê o valor calculado.

Convenções comuns: datas do ONS no dia civil de Brasília; EAR em MWmês (1 MWmês = 720 MWh,
"medida de armazenamento" no glossário do ONS); ENA e MLT em MWmed (média do dia; o
dicionário por subsistema diz MWmês, mas a soma das usinas, cujo dicionário diz MWmed,
reproduz o valor do subsistema, e o PMO publica a MLT em MWmed). Natureza da fonte: EAR, ENA
e vazões do ONS são OBSERVADAS pela fonte no sentido de publicação verificada, mas a ENA e a
MLT são calculadas pelo ONS a partir de vazões naturais reconstituídas; chuva por satélite e
temperatura de reanálise são ESTIMADAS.
"""

GOLD = "agua_detalhe.json"
PAGINA = ["/setor-eletrico/agua-e-clima"]
# cada métrica aponta para a página do painel que a exibe (um painel por página desde a fase de interface)
P_AFLUENCIA = ["/setor-eletrico/agua-e-clima/afluencia"]
P_CLIMA = ["/setor-eletrico/agua-e-clima/chuva-e-temperatura"]
P_RESERVATORIOS = ["/setor-eletrico/agua-e-clima/reservatorios"]
F_EAR_SM = "ear_subsistema_di"
F_ENA_SM = "ena_subsistema_di"
F_EAR_REE = "ons_ear_ree_di"
F_ENA_REE = "ons_ena_ree_di"
F_EAR_BAC = "ons_ear_bacia_di"
F_ENA_BAC = "ons_ena_bacia_di"
F_EAR_RES = "ons_ear_reservatorio_di"
F_ENA_RES = "ons_ena_reservatorio_di"
F_HIDRO = "ons_dados_hidrologicos_di"
F_CAD = "ons_reservatorio_cadastro"
F_PMO = "ons_pmo_relatorio_mlt"
F_BAL = "balanco_energia_subsistema_ho"
F_IMERG = "nasa_power_imerg"
F_MERRA = "nasa_power_merra2"
F_PR = "clima_precipitacao_bacia"
F_T = "clima_temperatura"
F_SHP = "ons_bacia_contorno"
F_LOC = "ibge_localidades_2022"
F_POP = "ibge_censo2022_populacao"
F_EST = "ons_precipitacao_estacao"
F_AREAS = "ons_carga_areas_verificacao"
F_EAR_SM_REC = "ons_ear_subsistema_conferencia"   # recaptura do módulo (a mais recente vale por ano)
F_ENA_SM_REC = "ons_ena_subsistema_conferencia"
F_PREV = "clima_previsao"

_LIM_ONS = "O ONS revisa dados recentes (consistência recorrente); revisões entram como novas vintages."
_NAO_CAUSAL = "Associação estatística: não identifica causa."


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINA, "versao_formula": "1.0"}
    base.update(kw)
    return base


METRICAS = [
    _m(id="agua_ear_sin_pct", titulo="EAR do SIN em % da capacidade",
       pergunta="Quanto da capacidade de armazenamento do SIN está ocupado?",
       definicao="Soma das energias armazenadas verificadas dos quatro subsistemas dividida pela soma das EAR máximas, no mesmo dia.",
       unidade="% da EAR máxima", grao_geografico="SIN", grao_temporal="dia",
       fontes=[F_EAR_SM, F_EAR_SM_REC], numerador="Σ EAR verificada dos subsistemas (MWmês)", denominador="Σ EAR máxima dos subsistemas (MWmês)",
       formula="EAR_SIN = 100 × Σ EAR(s) ÷ Σ EARmax(s), s ∈ {SE, S, NE, N}",
       regra_agregacao="razão de somas ponderada pela capacidade; nunca média dos percentuais",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia"],
       regras_comparabilidade=["Percentual de capacidades diferentes ao longo do tempo: a EAR máxima mudou várias vezes desde 2000 (ver agua_ear_max_eventos)."],
       regra_cobertura="Só dias com os quatro subsistemas; em cada ano vale a captura mais recente do arquivo anual (recaptura do módulo ou silver principal), e a revisão entre as duas fica publicada.",
       politica_ausencia="Dia sem algum subsistema fica sem SIN.",
       validacoes=["percentual publicado por subsistema = EAR ÷ EAR máxima (diferença máxima conferida em toda a série)",
                   "soma das bacias e soma dos REE da mesma captura = SIN em MWmês (0,05 MWmês)",
                   "soma dos reservatórios por subsistema = subsistema (por ano, com tolerância pela precisão publicada)"],
       limitacoes=["O Sudeste/Centro-Oeste tem cerca de 70% da capacidade e domina o agregado.", _LIM_ONS]),
    _m(id="agua_ear_mwmes", titulo="Energia armazenada em MWmês",
       pergunta="Quanta energia está guardada nos reservatórios, em valor absoluto?",
       definicao="EAR verificada publicada pelo ONS em MWmês, por subsistema, REE, bacia e reservatório; SIN pela soma dos subsistemas.",
       unidade="MWmês", grao_geografico="subsistema, REE, bacia, reservatório", grao_temporal="dia (série mensal pelo último dia do mês)",
       fontes=[F_EAR_SM, F_EAR_REE, F_EAR_BAC, F_EAR_RES], formula="EAR_SIN = Σ EAR(s); série mensal = EAR do último dia do mês",
       regra_agregacao="soma (grandeza de estoque); o mês usa o último dia, não a média",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["recorte", "dia"],
       regras_comparabilidade=["MWmês é estoque de energia; não somar com ENA em MWmed sem converter período e produtividade."],
       regra_cobertura="Recorte com valor publicado no dia.", politica_ausencia="Dia sem valor fica vazio.",
       validacoes=["EAR não negativa", "EAR ≤ EAR máxima com folga para volume acima do nível máximo operativo"],
       limitacoes=["A EAR de um reservatório usa a produtividade acumulada da cascata; muda com usinas novas a jusante.", _LIM_ONS]),
    _m(id="agua_ear_max_eventos", titulo="Mudanças da capacidade de armazenamento",
       pergunta="Quando e por que a EAR máxima de cada subsistema mudou?",
       definicao="Dias em que a EAR máxima do subsistema variou mais de 0,01 MWmês, com a variação atribuída aos reservatórios cuja EAR máxima (parte própria ou a jusante) entrou, saiu ou mudou no mesmo dia.",
       unidade="MWmês", grao_geografico="subsistema e reservatório", grao_temporal="evento (dia)",
       fontes=[F_EAR_SM, F_EAR_RES], formula="evento = EARmax(s, d) − EARmax(s, d−1); resíduo = evento − Σ variações dos reservatórios",
       regra_agregacao="soma das variações por reservatório no subsistema afetado (parte própria no subsistema da usina; parte a jusante no subsistema a jusante)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["subsistema", "reservatório", "data"],
       regras_comparabilidade=["Até 2017 os valores são inteiros: tolerância de 10 MWmês; desde 2018, 0,05 MWmês."],
       regra_cobertura="Todos os dias desde 2000.", politica_ausencia="Reservatório fora do arquivo não contribui (entrada e saída explícitas).",
       validacoes=["resíduo de cada evento dentro da tolerância pela precisão do ano"],
       limitacoes=["Mudança de produtividade (recálculo do ONS) altera a EAR máxima sem obra física."]),
    _m(id="agua_ear_faixa_sazonal", titulo="Faixa sazonal da EAR",
       pergunta="O armazenamento está dentro do usual para a data?",
       definicao="10º, 50º e 90º percentis do valor do mesmo dia do calendário nos anos completos anteriores, por subsistema, SIN, REE e bacia, em % e em MWmês.",
       unidade="% da EAR máxima e MWmês", grao_geografico="subsistema, SIN, REE, bacia", grao_temporal="dia do calendário",
       fontes=[F_EAR_SM, F_EAR_REE, F_EAR_BAC], formula="quantis tipo 7 de {EAR(ano, dd-mm) : ano = início..ano_ref − 1}",
       regra_agregacao="um valor por ano; 29/02 fora da distribuição (como referência usa 28/02)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["recorte", "dia"],
       regras_comparabilidade=["Base desde 2001 (subsistemas, SIN e bacias) e desde 2016 (REE); periodo_base traz o primeiro e o último ano realmente usados e anos_na_base o tamanho amostral.",
                               "REE com perímetro mudado na reconfiguração de 29 e 30/12/2017 (SUL, PARANA, NORTE e os novos IGUACU, PARANAPANEMA, MANAUS-AMAPA) só têm base desde 2018 (detecção nos próprios arquivos).",
                               "capacidade_mudou_na_base sinaliza, em todos os recortes (subsistemas e SIN inclusive), EAR máxima que variou mais de 5% dentro da base ou cuja mediana difere da atual em mais de 5%."],
       regra_cobertura="Anos com valor e EAR máxima positiva no dia do calendário; com menos de 5 anos não há faixa nem percentil.",
       politica_ausencia="Ano sem valor fica fora da distribuição. EAR máxima zero (recorte sem armazenamento) = não se aplica: percentual, faixa e percentil nulos.",
       validacoes=["n por data publicado", "faixa = abaixo, dentro ou acima pelos percentis 10 e 90",
                   "quebra de perímetro dos REE detectada pela conservação da soma das EAR máximas na repartição"],
       limitacoes=["Anos com capacidades diferentes têm o mesmo peso.", "Faixa não é previsão."]),
    _m(id="agua_ena_30d_pct_mlt", paginas=P_AFLUENCIA, titulo="ENA de 30 dias em % da MLT",
       pergunta="A água que chegou nos últimos 30 dias está acima do normal?",
       definicao="Soma da ENA bruta diária dos 30 dias dividida pela soma da MLT vigente em cada dia, por subsistema, SIN, REE e bacia.",
       unidade="% da MLT", grao_geografico="subsistema, SIN, REE, bacia", grao_temporal="janela móvel de 30 dias",
       fontes=[F_ENA_SM, F_ENA_SM_REC, F_ENA_REE, F_ENA_BAC], numerador="Σ ENA bruta diária (MWmed·dia)", denominador="Σ MLT implícita diária (MWmed·dia)",
       formula="ENA30 = 100 × Σ ENA(d) ÷ Σ MLT(d); MLT(d) = ENA(d) ÷ %MLT(d) × 100",
       regra_agregacao="razão de somas (equivale a ponderar cada dia pela sua MLT); SIN soma numeradores e denominadores dos subsistemas",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["recorte", "dia final da janela"],
       regras_comparabilidade=["A MLT do conjunto aberto muda (usinas novas, versões novas e retornos a versões anteriores) e difere da MLT do PMO em vários meses (agua_mlt_versao).",
                               "Faixa e percentil com a mesma janela nos anos da base (REE afetados pela reconfiguração de 2017 só desde 2018); menos de 5 anos: sem faixa."],
       regra_cobertura="Janela com os 30 dias publicados.", politica_ausencia="Janela com dia ausente não é calculada.",
       validacoes=["média simples dos percentuais diários calculada só para contraste no teste", "percentil frente à mesma janela dos anos da base"],
       limitacoes=["Janela de 30 dias suaviza eventos curtos.", _LIM_ONS]),
    _m(id="agua_mlt_versao", paginas=P_AFLUENCIA, titulo="Versão da MLT do conjunto aberto",
       pergunta="Qual MLT o ONS usa no percentual diário da ENA e ela é a mesma do PMO?",
       definicao="Comparação, mês a mês, da MLT implícita no conjunto diário de ENA com a MLT publicada na tabela \"MLT das ENAs (MWmed)\" do Relatório Executivo do PMO; e datas em que a MLT de usinas existentes mudou no conjunto por reservatório.",
       unidade="% de diferença e MWmed", grao_geografico="subsistema e usina", grao_temporal="mês e evento",
       fontes=[F_ENA_SM, F_ENA_RES, F_PMO], numerador="MLT implícita do conjunto aberto (MWmed)", denominador="MLT do PMO (MWmed)",
       formula="diferença = 100 × (MLT_aberto ÷ MLT_PMO − 1); revisão = mudança da MLT de uma usina fora do dia 1º; retorno = revisão cujos valores são iguais aos vigentes na mesma data 1 ou 2 anos antes",
       regra_agregacao="por subsistema e mês; dias coincidentes quando os quatro subsistemas ficam dentro de 0,05%",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["subsistema", "mês", "usina"],
       regras_comparabilidade=["O PMO publica MWmed inteiros; 0,05% cobre o arredondamento."],
       regra_cobertura="Meses com relatório do PMO coletado e extraído.", politica_ausencia="Mês sem relatório não é comparado.",
       validacoes=["tabela de 4 subsistemas × 2 meses lida inteira ou descartada", "soma das MLT por usina = MLT implícita do subsistema",
                   "comparação entre anos pela MLT vigente no último dia do mês (o dia 15 pode cair numa versão provisória)",
                   "cita o relatório do PMO do próprio mês e lista todos os que publicam o mês"],
       limitacoes=["O ONS não publica o período histórico da MLT; a versão é inferida das mudanças observadas, comparadas por igualdade com versões anteriores."]),
    _m(id="agua_precipitacao_bacia", paginas=P_CLIMA, titulo="Precipitação média na bacia",
       pergunta="Quanto choveu na área de cada bacia hidroenergética?",
       definicao="Média ponderada pela área da precipitação diária IMERG (NASA POWER) em pontos de grade dentro do polígono da bacia do ONS.",
       unidade="mm/dia (mm no mês e em 30 dias)", grao_geografico="bacia hidroenergética do ONS", grao_temporal="dia UTC, mês e 30 dias",
       fontes=[F_IMERG, F_SHP, F_PR], formula="P(b, d) = Σ cos(lat_i) passo_i² P_i(d) ÷ Σ cos(lat_i) passo_i²",
       regra_agregacao="média ponderada pela área; mês = soma dos dias (só mês completo)",
       natureza_fonte="ESTIMADO", natureza_transformacao="CALCULADO", dimensoes=["bacia", "dia", "mês"],
       regras_comparabilidade=["Climatologia 2001 a 2025 (não é a normal 1991 a 2020).", "Últimos ~3,5 meses em versão IMERG Late (preliminar)."],
       regra_cobertura="Dia publicado com ao menos 80% do peso da bacia com dado.", politica_ausencia="Dia abaixo da cobertura fica vazio; mês incompleto não soma.",
       validacoes=["não negativa", "conferência mensal com estações do ONS em 2020 e 2021 (viés e correlação publicados)"],
       limitacoes=["Estimativa por satélite, não medição.", "Amostragem em grade de 1° (adensada em bacias pequenas), não integral da área.",
                   "A bacia SANTA MARIA VIT não tem polígono no shapefile do ONS e fica sem chuva."]),
    _m(id="agua_precipitacao_anomalia", paginas=P_CLIMA, titulo="Anomalia de precipitação",
       pergunta="Choveu mais ou menos que o usual para o mês e para os últimos 30 dias?",
       definicao="Precipitação do mês (ou dos 30 dias) dividida pela média do mesmo mês (ou mesma janela) em 2001 a 2025, menos 1, em %; percentil na mesma distribuição.",
       unidade="%", grao_geografico="bacia", grao_temporal="mês e 30 dias",
       fontes=[F_PR], numerador="precipitação do período (mm)", denominador="média do mesmo período em 2001 a 2025 (mm)",
       formula="anomalia = 100 × (P ÷ média_2001_2025 − 1)", regra_agregacao="razão de somas de chuva",
       natureza_fonte="ESTIMADO", natureza_transformacao="CALCULADO", dimensoes=["bacia", "mês"],
       regras_comparabilidade=["Em meses secos a média é pequena e a anomalia percentual fica grande; ler junto com os milímetros."],
       regra_cobertura="Mês completo e base com os anos disponíveis (anos_base).", politica_ausencia="Sem média, sem anomalia.",
       validacoes=["p10 e p90 da base publicados"], limitacoes=["Anomalia não explica a ENA sozinha.", _NAO_CAUSAL]),
    _m(id="agua_associacao_chuva_ena", paginas=P_CLIMA, titulo="Associação entre chuva e ENA por bacia",
       pergunta="Meses de chuva acima do normal coincidem com ENA acima da MLT?",
       definicao="Correlação de Pearson entre a anomalia mensal de chuva da bacia e a ENA mensal em % da MLT (razão de somas no mês), no mesmo mês e com a ENA do mês seguinte.",
       unidade="coeficiente (−1 a 1)", grao_geografico="bacia", grao_temporal="mês (2001 a 2025)",
       fontes=[F_PR, F_ENA_BAC], formula="r = cov(anomalia, ENA%) ÷ (σ_anomalia σ_ENA%)",
       regra_agregacao="pares bacia-mês com os dois valores", natureza_fonte="ESTIMADO", natureza_transformacao="CALCULADO",
       dimensoes=["bacia", "defasagem"], regras_comparabilidade=["n de pares publicado; bacias com série de ENA mais curta têm menos pares."],
       regra_cobertura="Ao menos 10 pares.", politica_ausencia="Menos de 10 pares: sem coeficiente.",
       validacoes=["n de pares"], limitacoes=[_NAO_CAUSAL, "A ENA depende também de chuvas de meses anteriores, solo e regulação a montante."]),
    _m(id="agua_temperatura_subsistema", paginas=P_CLIMA, titulo="Temperatura do ar por subsistema",
       pergunta="Qual foi a temperatura nas áreas onde está a população de cada subsistema?",
       definicao="Temperatura a 2 m (média, máxima e mínima do dia) da reanálise MERRA-2/GEOS-IT (NASA POWER) nas células mais populosas de cada UF, ponderadas pela população; subsistema e SIN ponderados pela população das UF.",
       unidade="°C", grao_geografico="UF, subsistema, SIN", grao_temporal="dia (hora solar local)",
       fontes=[F_MERRA, F_LOC, F_POP, F_AREAS, F_T], formula="T(UF) = Σ pop_c T_c ÷ Σ pop_c; T(s) = Σ pop_UF T(UF) ÷ Σ pop_UF",
       regra_agregacao="média ponderada pela população (Censo 2022)", natureza_fonte="ESTIMADO", natureza_transformacao="CALCULADO",
       dimensoes=["recorte", "dia"],
       regras_comparabilidade=["Mapeamento UF → subsistema de 2026 (conferido contra a carga verificada por área do ONS) aplicado a toda a série.",
                               "Últimos 60 dias marcados como preliminares (GEOS-IT antes da substituição pelo MERRA-2)."],
       regra_cobertura="UF: células com ao menos 80% da população escolhida; subsistema: ao menos 90% da população.",
       politica_ausencia="Abaixo da cobertura, dia vazio.",
       validacoes=["intervalo físico", "soma das áreas de carga do ONS por subsistema reproduz a carga do subsistema (mapeamento)"],
       limitacoes=["Reanálise, não estação; INMET inacessível em 30/09/2026 impediu a conferência com observação.",
                   "Células escolhidas cobrem cerca de metade da população de cada UF."]),
    _m(id="agua_temperatura_anomalia", paginas=P_CLIMA, titulo="Anomalia de temperatura",
       pergunta="Os últimos 30 dias foram mais quentes ou mais frios que o usual?",
       definicao="Média dos 30 dias menos a média da mesma janela em 2001 a 2025; mensal: média do mês menos a média do mesmo mês na base.",
       unidade="°C", grao_geografico="subsistema e SIN", grao_temporal="30 dias e mês",
       fontes=[F_T], formula="anomalia = T_periodo − média_2001_2025(T_mesmo_periodo)", regra_agregacao="diferença de médias",
       natureza_fonte="ESTIMADO", natureza_transformacao="CALCULADO", dimensoes=["recorte", "período"],
       regras_comparabilidade=["Base 2001 a 2025."], regra_cobertura="Janela com os 30 dias.", politica_ausencia="Janela incompleta não é calculada.",
       validacoes=["percentil e p10/p90 publicados"], limitacoes=["Reanálise.", _NAO_CAUSAL]),
    _m(id="agua_balanco_reservatorio", paginas=P_RESERVATORIOS, titulo="Balanço hídrico de 30 dias por reservatório",
       pergunta="As entradas e saídas de água explicam a variação do volume do reservatório?",
       definicao="Variação do volume útil (hm³) comparada com a afluência menos a defluência acumuladas na janela; turbinamento, vertimento, outras estruturas e transferência publicados como componentes; resíduo explícito.",
       unidade="hm³", grao_geografico="reservatório", grao_temporal="janela de 30 dias (e dia no CSV)",
       fontes=[F_HIDRO, F_CAD], formula="resíduo = (V%_fim − V%_início) ÷ 100 × V_útil − Σ (Q_afl − Q_defl) × 0,0864",
       regra_agregacao="soma diária de vazões × 86.400 s ÷ 10⁶; volume útil total do cadastro",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["reservatório"],
       regras_comparabilidade=["Tolerância diária: 0,01% do volume útil (arredondamento do percentual) + 0,002 hm³.",
                               "Fração de dias dentro da tolerância publicada na janela de 30 dias e, à parte, em toda a série diária disponível (com o período)."],
       regra_cobertura="Janela com os 30 dias de afluência e defluência e volume no início e no fim.",
       politica_ausencia="Sem volume útil no cadastro ou dia sem dado: sem balanço (nunca completado).",
       validacoes=["fração de dias com resíduo dentro da tolerância (janela e série)",
                   "convenção da defluência detectada por reservatório nos dias com outras estruturas acima de 1 m³/s: defluência não discriminada = defluência − turbinada − vertida (− outras, quando a defluência as inclui); convenção indeterminada = nulo"],
       limitacoes=["A afluência do ONS é calculada pelo balanço na maioria dos reservatórios: fechar não prova a medição.",
                   "Convenção de sinal da transferência não documentada: resíduo com e sem transferência."]),
    _m(id="agua_previsao_chuva_bacia", paginas=P_CLIMA, titulo="Previsão de chuva por bacia",
       pergunta="Quanto o modelo de previsão espera de chuva em cada bacia nos próximos dias?",
       definicao="Precipitação diária prevista pela rodada de 00Z mais recente do ECMWF IFS 0,25° (Open-Meteo, API de rodadas individuais) nos mesmos pontos de grade da estimativa observada, média ponderada pela área; soma de 7 dias e do horizonte, ao lado da média 2001 a 2025 dos mesmos dias pelo IMERG.",
       unidade="mm/dia (mm em 7 dias e no horizonte)", grao_geografico="bacia hidroenergética do ONS", grao_temporal="dia UTC, rodada",
       fontes=[F_PREV, F_SHP, F_PR], formula="P(b, d) = Σ cos(lat_i) passo_i² P_i(d) ÷ Σ cos(lat_i) passo_i²",
       regra_agregacao="média ponderada pela área (dia com ao menos 80% do peso); só dias completos da rodada com valor em todas as bacias",
       natureza_fonte="PREVISTO", natureza_transformacao="PREVISTO", dimensoes=["bacia", "dia", "rodada"],
       regras_comparabilidade=["Previsão de modelo e climatologia de satélite são produtos diferentes: a comparação é de ordem de grandeza."],
       regra_cobertura="Rodada de 00Z de hoje ou de ontem (UTC), publicada até 48 horas depois da emissão.",
       politica_ausencia="Rodada indisponível ou lote com falha: nada é agregado e a pendência é publicada.",
       validacoes=["não negativa", "número de pontos devolvidos = pedidos", "emissão = rodada pedida"],
       limitacoes=["Previsão, não observação; substituída a cada rodada.", "Sem avaliação de acerto neste módulo."]),
    _m(id="agua_previsao_temperatura", paginas=P_CLIMA, titulo="Previsão de temperatura por subsistema",
       pergunta="Que temperatura o modelo de previsão espera nas áreas onde está a população de cada subsistema?",
       definicao="Temperatura média e máxima diárias previstas pela rodada de 00Z mais recente do ECMWF IFS 0,25° nas mesmas células populosas da estimativa observada, ponderadas pela população (Censo 2022).",
       unidade="°C", grao_geografico="subsistema e SIN", grao_temporal="dia UTC, rodada",
       fontes=[F_PREV, F_LOC, F_POP], formula="T(UF) = Σ pop_c T_c ÷ Σ pop_c; T(s) = Σ pop_UF T(UF) ÷ Σ pop_UF",
       regra_agregacao="média ponderada pela população (80% por UF, 90% por subsistema)",
       natureza_fonte="PREVISTO", natureza_transformacao="PREVISTO", dimensoes=["recorte", "dia", "rodada"],
       regras_comparabilidade=["Dia UTC na previsão e hora solar local na reanálise observada; a climatologia ao lado é do MERRA-2."],
       regra_cobertura="Mesma rodada da previsão de chuva.", politica_ausencia="Sem rodada válida, sem previsão (pendência publicada).",
       validacoes=["intervalo físico", "mesmas células e pesos da temperatura observada"],
       limitacoes=["Previsão, não observação.", "Sem avaliação de acerto neste módulo."]),
    _m(id="agua_decomposicao_delta_ear", paginas=P_RESERVATORIOS, titulo="Variação da EAR por reservatório",
       pergunta="Quais reservatórios explicam a variação do armazenamento do subsistema?",
       definicao="Variação de 30 dias da EAR de cada reservatório na parte própria (no subsistema da usina) e a jusante (no subsistema a jusante); a soma reproduz a variação do subsistema.",
       unidade="MWmês", grao_geografico="subsistema e reservatório", grao_temporal="janela de 30 dias",
       fontes=[F_EAR_RES, F_EAR_SM, F_ENA_SM, F_BAL], formula="ΔEAR(s) = Σ ΔEAR_própria(r ∈ s) + Σ ΔEAR_jusante(r com jusante em s); resíduo explícito",
       regra_agregacao="soma (identidade conferida contra o subsistema da mesma captura)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["subsistema", "reservatório"],
       regras_comparabilidade=["ENA, geração hidráulica e chuva aparecem como contexto: não fecham balanço com a EAR (produtividades e perímetros diferentes)."],
       regra_cobertura="Reservatórios com EAR no início e no fim da janela.", politica_ausencia="Reservatório sem um dos dias fica fora e o resíduo mostra a falta.",
       validacoes=["resíduo da decomposição por subsistema"], limitacoes=["Não explica a variação pela ENA isoladamente."]),
]
