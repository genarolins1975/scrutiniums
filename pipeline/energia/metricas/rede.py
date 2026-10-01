"""Métricas do módulo Rede (detalhe): definição única das medidas publicadas em
public/energia/gold/rede_detalhe.json. A fórmula roda em pipeline/energia/modulos/rede_detalhe.py;
a interface só lê o valor calculado.

Convenções comuns: horário de Brasília (início da hora, como o ONS publica); fronteiras na
orientação N→NE, N→SE/CO, NE→SE/CO e S→SE/CO (positivo = da primeira para a segunda
região); exterior positivo = exportação do Brasil; cada valor horário em MWmed vale a mesma
quantidade em MWh; fluxo com módulo até 1 MWmed conta como nulo nas contagens de sentido.
Nenhuma medida usa limite de intercâmbio: os limites operativos com vigência não estão
publicados como conjunto estruturado (achado A06).
"""

GOLD = "rede_detalhe.json"
PAGINA = ["/setor-eletrico/rede"]
F_IN = "ons_rede_intercambio_nacional"
F_II = "ons_rede_intercambio_internacional"
F_BAL = "ons_rede_balanco"
F_ITA = "ons_rede_itaipu"
F_ATLS = "ons_rede_atls"
F_IC = "ons_rede_interrupcao_carga"
F_PDO = "ons_rede_pdo_conversoras"
F_PLD = "ccee_pld_horario"

_AUS = "Hora sem valor publicado fica fora das somas e das contagens; nada é preenchido, interpolado ou repetido."
_SEM_LIMITE = "Não diz se a fronteira estava no limite: os limites operativos de intercâmbio não são públicos em formato estruturado."
_CONSISTENCIA = "Dados em consistência recorrente do ONS: valores recentes podem ser revisados."
# Balanço de Energia nos Subsistemas: desde 29/04/2023 a solar e a carga incluem a MMGD estimada pelo ONS
# (seção 11.3: agregado oficial com componente estimado preserva essa informação)
_NAT_BALANCO = [
    {"componente": "geração das usinas, carga e intercâmbio verificados", "natureza": "OBSERVADO", "desde": None},
    {"componente": "parcela da MMGD estimada pelo ONS na geração solar e na carga", "natureza": "ESTIMADO", "desde": "2023-04-29"},
]
_MMGD_LIMITACAO = ("Desde 29/04/2023 a geração solar e a carga do balanço incluem a estimativa da MMGD feita pelo ONS, somada sem "
                   "separação; o conjunto do balanço não declara a mudança (data declarada para o conjunto Carga de Energia e "
                   "degrau conferido no arquivo). O resíduo e o intercâmbio não são afetados.")
_MMGD_COMPARABILIDADE = ("Geração e carga mensais de antes e de depois de 29/04/2023 não são comparáveis diretamente "
                         "(marcação mmgd_estimada: sem, parcial em abril de 2023, com).")


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINA, "versao_formula": "1.0"}
    base.update(kw)
    return base


METRICAS = [
    _m(id="rede_fluxo_liquido", titulo="Saldo líquido de energia na fronteira",
       pergunta="Quanta energia passou, no saldo, de uma região para a outra?",
       definicao="Energia no sentido canônico menos energia no sentido inverso, somando os valores horários do intercâmbio verificado.",
       unidade="MWh", grao_geografico="fronteira entre subsistemas", grao_temporal="dia, mês e janela de 30 dias",
       fontes=[F_IN], formula="líquido = Σ_h fluxo_h (MWmed × 1 h), com sinal da orientação canônica",
       regra_agregacao="soma de energia horária", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["fronteira", "dia", "mês"],
       regras_comparabilidade=["Meses e dias com horas faltantes são comparáveis só com o número de horas ao lado (coluna horas)."],
       regra_cobertura="Todas as horas publicadas; dia com menos de 24 horas é marcado pela contagem.", politica_ausencia=_AUS,
       validacoes=["orientação de cada linha do arquivo convertida para a canônica (verificado e programado com o mesmo sinal)",
                   "releitura igual à do silver principal nos arquivos idênticos (resultado em conferencia_silver_principal)",
                   "sem duas linhas da mesma fronteira na mesma hora"],
       limitacoes=["O saldo esconde a energia que circulou no sentido oposto (ver rede_fluxo_contra_saldo).", _SEM_LIMITE, _CONSISTENCIA]),
    _m(id="rede_fluxo_por_sentido", titulo="Energia em cada sentido da fronteira",
       pergunta="Quanta energia foi de uma região para a outra, e quanta voltou?",
       definicao="Soma dos valores horários positivos (sentido canônico) e soma do módulo dos negativos (sentido inverso).",
       unidade="MWh", grao_geografico="fronteira entre subsistemas", grao_temporal="dia, mês e janela de 30 dias",
       fontes=[F_IN], formula="canônico = Σ max(f_h, 0); inverso = Σ max(−f_h, 0)",
       regra_agregacao="soma de energia horária por sentido", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["fronteira", "sentido", "dia", "mês"],
       regras_comparabilidade=["É bruto entre horas: dentro da hora, o valor publicado já é o saldo médio das linhas da fronteira."],
       regra_cobertura="Horas publicadas.", politica_ausencia=_AUS,
       validacoes=["canônico − inverso = líquido", "reconferido contra o arquivo original do ONS por outro código (documento do módulo)"],
       limitacoes=["A fonte não publica o fluxo de cada linha: sentidos opostos em linhas diferentes na mesma hora não aparecem.", _SEM_LIMITE]),
    _m(id="rede_fluxo_contra_saldo", titulo="Energia contra o saldo",
       pergunta="Quanto do fluxo o saldo líquido esconde?",
       definicao="O menor dos dois sentidos no período: energia que circulou no sentido oposto ao saldo e que o saldo anula.",
       unidade="MWh", grao_geografico="fronteira entre subsistemas", grao_temporal="dia e janela de 30 dias",
       fontes=[F_IN], formula="contra_saldo = min(canônico, inverso)",
       regra_agregacao="calculada sobre as somas do período (a soma dos valores diários também é publicada)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["fronteira", "dia"],
       regras_comparabilidade=["A soma dos valores diários é menor ou igual ao valor da janela de 30 dias: a janela também conta dias inteiros no sentido oposto ao saldo do período."],
       regra_cobertura="Horas publicadas.", politica_ausencia=_AUS,
       validacoes=["mesma conta pelo silver principal nas horas comuns (tolerância 0,001 MWh por hora)"],
       limitacoes=["Reversão de fluxo não é, por si, sinal de problema: resulta do despacho e da geração variável.", _SEM_LIMITE]),
    _m(id="rede_reversoes", titulo="Reversões de sentido na fronteira",
       pergunta="Quantas vezes o fluxo trocou de sentido?",
       definicao="Número de trocas de sentido entre horas consecutivas com fluxo acima de 1 MWmed em módulo.",
       unidade="trocas", grao_geografico="fronteira entre subsistemas", grao_temporal="dia",
       fontes=[F_IN], formula="Σ_h 1[sentido(h) ≠ sentido(h anterior com fluxo)]",
       regra_agregacao="contagem por dia (horas nulas não interrompem a sequência; hora ausente interrompe)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["fronteira", "dia"],
       regras_comparabilidade=["A faixa de 1 MWmed é a mesma do módulo PLD."], regra_cobertura="Horas publicadas.",
       politica_ausencia=_AUS, validacoes=["casos de teste com sequências reais recortadas do arquivo de 2026"],
       limitacoes=["Contagem horária: oscilações dentro da hora não aparecem."]),
    _m(id="rede_subsistema_bruto", titulo="Exportação e importação brutas do subsistema",
       pergunta="Quanto cada região exportou e importou ao mesmo tempo?",
       definicao="Soma, hora a hora, das fronteiras em que o subsistema exporta (exportação bruta) e das em que importa (importação bruta); no Sul, Argentina e Uruguai entram como fronteiras.",
       unidade="MWh", grao_geografico="subsistema", grao_temporal="dia e mês",
       fontes=[F_IN, F_II], formula="exp = Σ_h Σ_f max(p_f,h, 0); imp = Σ_h Σ_f max(−p_f,h, 0); líquido = exp − imp",
       regra_agregacao="soma de energia horária", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["subsistema", "dia", "mês"],
       regras_comparabilidade=["O líquido é igual ao intercâmbio do balanço do ONS (identidade conferida hora a hora, achado A05)."],
       regra_cobertura="Hora com todas as fronteiras do subsistema (e o exterior, no Sul).", politica_ausencia=_AUS,
       validacoes=["identidade com o intercâmbio do balanço de energia"],
       limitacoes=["Horas de trânsito (exporta por uma fronteira e importa por outra) não dizem de onde vem a energia consumida."]),
    _m(id="rede_pld_mesma_hora", titulo="Preço nas pontas da fronteira na mesma hora",
       pergunta="Os preços das duas regiões se separaram nas horas em que a energia circulou?",
       definicao="Contagem de horas com PLD das duas pontas diferente em mais de R$ 0,01/MWh e, nessas horas, do sentido do fluxo verificado em relação ao preço.",
       unidade="horas", grao_geografico="fronteira entre subsistemas", grao_temporal="dia, mês e janela de 30 dias",
       fontes=[F_IN, F_PLD], formula="separada(h) = |PLD_para − PLD_de| > 0,01; para o mais caro = sinal(fluxo_h) = sinal(ΔPLD_h)",
       regra_agregacao="contagem de horas", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["fronteira", "dia"],
       regras_comparabilidade=["PLD e fluxo na mesma hora local; horas sem PLD (depois da última captura da CCEE) ficam fora."],
       regra_cobertura="Horas com fluxo e PLD nas duas pontas.", politica_ausencia=_AUS,
       validacoes=["mesma tolerância de centavo do módulo PLD"],
       limitacoes=["Diferença de preço não demonstra fronteira congestionada; o PLD sai de modelo com restrições não publicadas.",
                   "Associação descritiva: não identifica causa."]),
    _m(id="rede_residuo_balanco", titulo="Resíduo do balanço de energia",
       pergunta="Geração menos carga fecha com o intercâmbio publicado no mesmo balanço?",
       definicao="Geração hidráulica + térmica + eólica + solar − carga − intercâmbio, hora a hora, no Balanço de Energia nos Subsistemas.",
       unidade="MWmed por hora; MWh por mês; horas", grao_geografico="subsistema e SIN", grao_temporal="hora e mês",
       fontes=[F_BAL], formula="r_h = hid + ter + eol + sol − carga − intercâmbio; hora com resíduo quando |r_h| > 0,1 MWmed",
       regra_agregacao="contagem de horas e soma mensal do resíduo, geração, carga e intercâmbio sobre as mesmas horas completas",
       natureza_fonte="OBSERVADO e ESTIMADO", natureza_componentes=_NAT_BALANCO, natureza_transformacao="CALCULADO",
       dimensoes=["subsistema", "hora", "mês"],
       regras_comparabilidade=["Contagens também acima de 1, 10 e 100 MWmed, para separar arredondamento de diferença material.",
                               _MMGD_COMPARABILIDADE],
       regra_cobertura="Horas com as seis parcelas publicadas.", politica_ausencia="Hora com parcela ausente fica fora (não vira zero).",
       validacoes=["tolerância de 0,1 MWmed justificada pela precisão de três casas dos arquivos",
                   "em cada linha mensal, geração − carga − intercâmbio = resíduo do balanço (mesmas horas)",
                   "degrau da solar em 29/04/2023 conferido no arquivo original do balanço, com o balanço fechando nas 24 horas do dia"],
       limitacoes=["Resíduo não é atribuído a perdas nem ao exterior: a fonte não informa a causa.", _MMGD_LIMITACAO, _CONSISTENCIA]),
    _m(id="rede_residuo_perimetro", titulo="Resíduo de perímetro do intercâmbio",
       pergunta="O intercâmbio do balanço é a soma das fronteiras e do exterior?",
       definicao="Intercâmbio do subsistema no balanço menos a soma das suas fronteiras no conjunto de intercâmbio (no Sul, mais Argentina e Uruguai; no SIN, o intercâmbio internacional).",
       unidade="MWmed por hora; horas", grao_geografico="subsistema e SIN", grao_temporal="hora e mês",
       fontes=[F_BAL, F_IN, F_II], formula="r_h = intercâmbio_balanço − Σ fronteiras (− exterior)",
       regra_agregacao=("contagem de horas e soma mensal; intercâmbio do perímetro, fronteiras e exterior e resíduo somados nas "
                        "mesmas horas (horas_perimetro)"), natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["subsistema", "hora", "mês"],
       regras_comparabilidade=["Compara três conjuntos do ONS publicados separadamente.",
                               "O intercâmbio do perímetro pode ser menor que o intercâmbio do balanço do mesmo mês: dia sem exterior "
                               "no conjunto internacional entra no balanço e não no perímetro (ver horas_perimetro)."],
       regra_cobertura="Horas com balanço, fronteiras e exterior publicados.", politica_ausencia=_AUS,
       validacoes=["diagnóstico das horas com resíduo: coerência interna do balanço (SIN = Sul − fronteira S→SE)",
                   "em cada linha mensal, intercâmbio do perímetro − fronteiras e exterior = resíduo do perímetro (mesmas horas)"],
       limitacoes=["O sinal do intercâmbio do balanço não está no dicionário; foi conferido por esta identidade."]),
    _m(id="rede_exterior", titulo="Intercâmbio internacional por país",
       pergunta="Quanta energia o Brasil exportou e importou de cada país vizinho?",
       definicao="Soma mensal dos valores horários positivos (exportação) e do módulo dos negativos (importação) do intercâmbio verificado nas conversoras de fronteira.",
       unidade="MWh", grao_geografico="país", grao_temporal="mês e 12 meses",
       fontes=[F_II], formula="exportação = Σ max(v_h, 0); importação = Σ max(−v_h, 0)",
       regra_agregacao="soma de energia horária", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["país", "mês"], regras_comparabilidade=["Meses com horas ausentes trazem a contagem de horas."],
       regra_cobertura="Horas publicadas.",
       politica_ausencia=_AUS + " País sem nenhuma hora publicada no período (Paraguai desde 21/02/2024) fica com exportação e importação nulas, não zero.",
       validacoes=["saldo de 12 meses igual ao intercâmbio do SIN no balanço nas horas comuns (tolerância 0,1 MWmed por hora)"],
       limitacoes=["Itaipu é geração no conjunto do ONS, não intercâmbio.", "Paraguai (Acaray) aparece no arquivo até fevereiro de 2024, sempre com fluxo nulo."]),
    _m(id="rede_itaipu_nao_brasil", titulo="Geração de Itaipu não destinada ao Brasil",
       pergunta="Quanto da geração de Itaipu não foi destinada ao Brasil?",
       definicao="Geração total da usina menos a parcela destinada ao Brasil (setor de 60 Hz mais a parte do setor de 50 Hz medida nos conversores de Foz do Iguaçu).",
       unidade="MWh", grao_geografico="usina", grao_temporal="mês", fontes=[F_ITA],
       formula="não Brasil = Σ_h (total_h − Brasil_h)", regra_agregacao="soma de energia horária",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["mês"],
       regras_comparabilidade=["Não é intercâmbio internacional nem consumo do Paraguai medido: é uma diferença entre duas medidas."],
       regra_cobertura="Horas com total e parcela do Brasil.", politica_ausencia=_AUS,
       validacoes=["total = 60 Hz + 50 Hz e Brasil = 60 Hz + 50 Hz do Brasil em todas as linhas (tolerância 0,5 MWmed)"],
       limitacoes=["O ONS removeu em 30/07/2026 o campo com a parcela destinada ao Paraguai; a diferença inclui o que não é medido separadamente."]),
    _m(id="rede_atls_horas_violacao", titulo="Horas acima do limite sistêmico (ATLS)",
       pergunta="Quando há evidência publicada de fluxo acima do limite de segurança?",
       definicao="Tempo em que cada fluxo sistêmico monitorado pelo ONS ficou acima do limite estabelecido pelos estudos elétricos, como publicado no indicador ATLS (Submódulo 9.1).",
       unidade="horas", grao_geografico="fluxo sistêmico do ONS", grao_temporal="mês e 12 meses", fontes=[F_ATLS],
       formula="horas_12m = Σ num_horasviolacao mensal dos 12 últimos meses publicados (soma feita pelo observatório)",
       regra_agregacao="valores mensais como publicados; somas de 12 meses e do histórico calculadas pelo observatório",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["fluxo", "mês"],
       regras_comparabilidade=["Fluxos mudam ao longo do tempo; compare só meses em que o fluxo é publicado."],
       regra_cobertura="Meses publicados.", politica_ausencia="Mês não publicado fica fora (não vira zero).",
       validacoes=["acumulado no ano publicado = soma dos meses", "ATLS publicado = 1 − horas ÷ período (o valor vem em fração, não em %)"],
       limitacoes=["O valor do limite não é publicado; o indicador não mede quanto da capacidade foi usada.",
                   "Violações de menos de 10 minutos e dentro da banda morta (50 MW ou 5% do limite) não entram."]),
    _m(id="rede_interrupcao_ens", titulo="Energia não suprida em interrupções de carga",
       pergunta="Quanta carga ficou sem energia por perturbações na rede?",
       definicao="Soma da energia não suprida dos registros de interrupção de carga publicados pelo ONS.",
       unidade="MWh", grao_geografico="SIN e subsistema", grao_temporal="ano e 12 meses", fontes=[F_IC],
       formula="Σ val_energianaosuprida_mwh", regra_agregacao="soma de registros",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["subsistema", "ano", "rede básica"],
       regras_comparabilidade=["Ano corrente é parcial."], regra_cobertura="Registros publicados desde 2007.",
       politica_ausencia="Registro sem energia informada fica fora da soma.",
       validacoes=["energia = carga interrompida × tempo médio ÷ 60 em todos os registros da janela"],
       limitacoes=["Interrupção de carga é perturbação, não prova de limite de intercâmbio atingido.",
                   "A descrição do conjunto cita cortes acima de 100 MW, mas o arquivo traz registros menores (contados à parte)."]),
    _m(id="rede_desvio_programado", titulo="Desvio entre intercâmbio verificado e programado",
       pergunta="Quanto o fluxo divergiu do programa?",
       definicao="Verificado menos programado, hora a hora, na mesma orientação; desvio material quando o módulo chega a 1.000 MWmed.",
       unidade="MWmed por hora; MWh por dia; horas", grao_geografico="fronteira e país", grao_temporal="hora, dia e mês",
       fontes=[F_IN, F_II, F_PDO], formula="desvio_h = verificado_h − programado_h; material = |desvio_h| ≥ 1.000 MWmed",
       numerador="Σ |desvio_h|", denominador="horas com os dois valores",
       regra_agregacao="média do desvio absoluto; contagem de horas materiais e de inversões de sentido",
       natureza_fonte="OBSERVADO e PREVISTO", natureza_componentes=[
           {"componente": "intercâmbio verificado", "natureza": "OBSERVADO"},
           {"componente": "intercâmbio programado (programa do dia anterior)", "natureza": "PREVISTO"}],
       natureza_transformacao="CALCULADO", dimensoes=["par", "hora", "dia", "mês"],
       regras_comparabilidade=["Limiar único para todas as fronteiras; sensibilidade publicada em 500 e 2.000 MWmed.",
                               "Dias com programado repetido por 6 horas ou mais numa fronteira entre subsistemas (22/08/2026: "
                               "NE→SE/CO exatamente 0 nas 24 horas) são rotulados; a distribuição sai com e sem eles."],
       regra_cobertura="Horas desde janeiro de 2026 (o programado não existe nos arquivos anteriores).", politica_ausencia=_AUS,
       validacoes=["programado internacional igual ao PDO das conversoras em todas as horas da amostra conferida"],
       limitacoes=["Desvio não é falha: a operação em tempo real corrige o programa.",
                   "A fonte não identifica a revisão do programa das fronteiras entre subsistemas."]),
]
