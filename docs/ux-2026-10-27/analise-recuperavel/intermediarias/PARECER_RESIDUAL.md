# Revisão independente residual — recuperação e compartilhamento

> **Parecer intermediário.** O achado posterior de campo de consumo desatualizado ao voltar com foco alterou a conclusão desta rodada. Sua correção foi confirmada no commit `32db0c3d2`, build `zdkU37XJIzk4uJJiZ55kv`, em `/workspace/analise-mecanica-confirmacao-final/PARECER_FINAL.md`.

27/10/2026. Código renderizado: `29708ebdb690c35d9d0bba22c507d75f0df0915b`. Build: `7WK2sis8IxzPaxjBcAPJ5`. O checkout avançou durante a auditoria para `493e7bab754d96fdfeed2e4146820a20c81ebfd0`, alterando somente o roteiro `scripts/analise-recuperavel-energia.mjs`; a fonte da interface e o build permaneceram os mesmos. Os roteiros deste revisor são independentes e externos ao repositório.

## Parecer

As correções residuais funcionaram nas jornadas examinadas. O resumo identifica o recorte em linguagem corrente, o endereço completo permanece acessível por teclado e a entrelinha do endereço acompanha a ampliação das fontes. Os arquivos de citação exportam o recorte atual. A conta de luz preserva os parâmetros e o resultado ao passar da consulta pública ao painel autenticado, em português e inglês. Um recorte avançado que o aperitivo não calcula agora fica sem estimativa substituta e oferece acesso ao painel completo, preservando os parâmetros no retorno do login.

Não foram encontradas falhas funcionais impeditivas na rodada residual. Esse parecer se soma à rodada independente anterior de 320/390/768/1440 px; não representa auditoria integral de todos os painéis ou certificação WCAG.

| Before | After | Evidência |
| --- | --- | --- |
| Endereço com chaves internas ocupava o primeiro plano de Salvar e da conta. | `Pernambuco · 60 litros` identifica o recorte; endereço e parâmetros ficam em detalhes. | Salvar e Meus recortes, 390/1440. Capturas `salvar-resumo-*` e `conta-resumo-*`. |
| Fonte ampliada a 24 px conservava entrelinha de 16 px no endereço. | Fonte de 24 px apresenta entrelinha de 39 px; nenhuma rolagem horizontal em 390/1440. | Mesmo experimento de duplicação de tamanhos de fonte; `auditoria-residual.json`. |
| Citação aberta podia continuar com o endereço anterior. | Após voltar de SP para PE, apresentação, `.bib` e `.ris` contêm PE e 60 litros. | Arquivos `citacao-final.bib` e `citacao-final.ris`, obtidos por download real do navegador. |
| Parâmetros do aperitivo não eram o contrato do simulador autenticado. | `dist`, `skwh` e `conta_municipio` são compartilhados. Recife, Neoenergia PE, 450 kWh e R$ 367,97 permanecem. | Público→autenticado PT/EN em 390/1440, com sessão sintética real. |
| Parâmetros avançados poderiam resultar em outra estimativa na consulta pública. | Classe social, ligação trifásica e bandeira verde retêm a estimativa pública; convite leva ao login com todos os parâmetros. | PT/EN em 390, `auditoria-limites.json` e capturas `energia-limite-publico-*`. |
| Aviso de distribuidora municipal inválida dizia usar a referência, embora o resultado estivesse indisponível. | Aviso pede uma distribuidora válida e resultado permanece indisponível. | URL sintética com CNPJ não encontrado, PT/EN. Nenhum valor substituto exibido. |

## Interações e acessibilidade

Detalhes começaram recolhidos; Enter abriu, Espaço fechou e o endereço completo conservou os parâmetros. Axe no painel Salvar com detalhes abertos: zero violações nas regras WCAG 2 A/AA, 2.1 A/AA e 2.2 AA disponíveis, em 390 e 1440 px. As jornadas principais usaram preferência por movimento reduzido. Fontes duplicadas mantiveram endereço legível e largura da página igual à viewport.

A passagem pública→autenticada usou duas sessões locais separadas, uma sem cookie e outra com sessão sintética válida. O convite avançado foi clicado até a página real de login: o parâmetro `de` preservou distribuidora, município, consumo, classe, ligação, bandeira e âncora. Não foi realizado envio de email/OTP nem login com conta de produção.

## Ressalvas e limites

O estado de URL adulterada com distribuidora inexistente ainda contém acabamento textual menor: título sem nome de distribuidora e expressões como “vigência iniciada em sem data” e “indisponível para nesta classe”. O estado de ausência e a orientação estão corretos, sem número inventado ou substituição silenciosa. Não é bloqueio funcional destas jornadas.

Ampliação de fontes foi feita por alteração controlada dos tamanhos computados no DOM; zoom nativo do navegador e leitor de tela continuam não verificados. Não foram repetidas todas as jornadas da rodada anterior porque a auditoria residual se restringiu às superfícies e contratos modificados.

As primeiras comparações do roteiro usaram indevidamente caixa sensível para o nome da distribuidora e procuraram um parâmetro de retorno diferente de `de`. Essas duas condições do roteiro externo foram corrigidas e as jornadas completas repetidas; os resultados finais têm zero falhas. Nenhum teste, fonte ou arquivo do repositório foi alterado pelo revisor.

## Reprodução e evidências

- `/tmp/analise-auditoria-residual.mjs`: resumo, detalhes, fonte ampliada, citação exportada e público→autenticado PT/EN.
- `/tmp/analise-auditoria-limites.mjs`: parâmetros avançados no aperitivo, retorno de login e distribuidora municipal inválida.
- `auditoria-residual.json` e `auditoria-limites.json`: resultados finais, commit e build.
- Capturas e arquivos de citação nesta pasta.

Todos os servidores locais e navegadores temporários foram encerrados ao término.
