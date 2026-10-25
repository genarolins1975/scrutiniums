# Revisão visual parcial do mapa PR2

Inspecionadas as capturas completas `depois/educacao_municipal_mapa-{390,768}-com-sessao.jpg`, Brasil, anos iniciais, 2025. Não revisei 1440 nem estados de seleção nesta etapa. Nenhum teste ou edição de implementação.

A hierarquia distingue pergunta, controles, cobertura, ressalva, legenda, mapa, motivos de ausência e tabela equivalente. As 20 classes de meio ponto estão presentes, ordenadas, com contagens. Em 390 a legenda ocupa quase uma coluna: é extensa, mas nenhum rótulo observado está sobreposto ou oculto. Há textura própria para sem dado, distinta do zero. A cobertura 5320/5571 é explícita e os sete motivos somam 251 ausências. O mapa cabe no contêiner nas duas larguras e preserva os controles de busca/zoom. As dimensões pequenas dos municípios no Brasil inteiro são inerentes a esse recorte; UF e busca oferecem acesso individual, mas não foram acionadas por esta revisão.

Achado de redação concreto, não impeditivo: sob o mapa, os extremos aparecem como «Valores de 3,3 Ideb, de 0 a 10 a 10,0 Ideb, de 0 a 10». A unidade completa repetida dificulta a leitura da faixa. Correção verificável: formatar os extremos como números e apresentar uma vez «Ideb, de 0 a 10».

A tabela mostra parte da última linha no fim do viewport e em 390 o motivo continua à direita. O agente principal confirmou componente rolável focável e contêiner de altura máxima 700px com overflow auto, além de testes aprovados sem rolagem horizontal da página. Portanto, não trato a linha parcial como truncamento do conjunto nem a coluna como dado perdido. A operação efetiva de rolagem não foi verificada manualmente aqui.

Rubrica apenas deste estado 390/768: arte 9, hierarquia 9, tipografia/acabamento 9, densidade/profundidade 9, didática 9 (ressalva pequena de redação acima), comparabilidade 9, interação/acessibilidade NV, responsividade 9 quanto à composição estática; operação da tabela NV. Não certifica 1440, outras UFs, anos finais, seleção, foco ou estados sem dado. A captura 390 foi reduzida de 390×7082 para 330×6000, ainda suficiente para ler as regiões citadas, mas sem medição de fonte/contraste.
