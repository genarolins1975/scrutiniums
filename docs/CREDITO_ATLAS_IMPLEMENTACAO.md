# Atlas interativo do crédito

Implementa o mock aprovado na página Mapa do Observatório, mantendo as sete etapas, as rotas, o menu, as perguntas, as trilhas, os conceitos e a tabela completa de fontes.

## Integração

`atlas.js` é uma extensão progressiva da camada `editorial.js`. O núcleo continua sendo a única origem do mapa e de seus links. A extensão move os elementos já renderizados; não duplica o catálogo nem altera o pipeline. Sem a extensão, o mapa anterior permanece utilizável. A inicialização é idempotente e reaplicada quando o núcleo renderiza novamente a página.

Os destaques leem `meta.carteira_conceitos.sgs`, `meta.if_contagens.cadastro_sedes` e `meta.inad_conceitos.scr`. Valores, referências e definições vêm da gold já carregada. O saldo mantém a unidade em bilhões; ausência não vira zero. As referências temporais permanecem próprias de cada medida.

## Interações

- Mapa orbital com sete botões nativos, painel correspondente e links originais. Tab, Enter, Espaço, setas, Home e End; o foco permanece no controle selecionado.
- Laboratório local: perda esperada = EAD × PD × LGD. EAD em milhões de reais; PD e LGD convertidas de porcentagem para fração. LGD = 100 − recuperação, em porcentagem.
- Referência fixa: EAD 100 milhões, PD 4%, recuperação 55%. Não é um indicador observado, previsão, provisão ou cálculo de capital. As hipóteses não entram em score, gold, armazenamento ou chamadas de rede.
- Comparação de taxas com escala comum de zero a 15%, correspondente ao limite de PD do controle e LGD máxima de 100%.
- Alternância didática entre estoque, fluxo e inadimplência, e seleção das trilhas originais por perfil.
- Catálogo completo em expansão, mantendo a busca existente.

O layout utiliza os tokens e fontes existentes. O bloco petróleo é deliberadamente escuro em ambos os temas. Estilos limitados a `#view-mapa`; não afetam os subpainéis. Movimento reduzido e impressão têm regras próprias.

## Verificação

Testes automatizados cobrem unidades, extremos, entradas inválidas, efeito da exposição e separação do laboratório. A inspeção visual deve verificar o mapa em 320, 390, 768 e 1440 px, temas claro/escuro, teclado, retorno de subpainel, busca, trilhas e controles do laboratório. Aprovação do mock não substitui esta inspeção da implementação.
