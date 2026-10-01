"""Previsão do PLD: calendário do alvo, construtor de variáveis, modelos, avaliação e emissão.

Este pacote é o código de previsão do observatório (painéis P013 a P016). Até 30/09/2026
o repositório não tinha construtor de variáveis nem modelo: o arquivo de emissões foi
escrito à mão a partir de um artefato externo de pesquisa. Aqui cada peça é pública e
reexecutável a partir do silver com vintages:

* calendario.py: alvo, semanas de sábado 00h a sábado 00h, meses civis, corte às 07h e
  prazo às 08h de Brasília, regra de elegibilidade LATkD;
* variaveis.py: construtor de variáveis que só enxerga o dado como estava num instante
  (base.como_estava_em) e só usa períodos elegíveis no corte;
* modelos_pld.py: B0 (persistência), S0 (sazonal), C2-P e C2-H (correção penalizada da
  persistência), quantis empíricos de resíduos passados e restrição aos limites do PLD;
* avaliacao.py: teste retrospectivo fora da amostra, métricas e bootstrap por blocos;
* arquivo.py: arquivo imutável de emissões particionado por mês, com encadeamento de hash;
* emissao.py: rodada diária (verificação antes do corte, emissão, registro de atraso e falha).

A gold é montada por pipeline/energia/modulos/previsoes.py (previsoes_desempenho.json) e
por pipeline/energia/gold/modelos.py (previsoes.json e modelos.json).
"""
