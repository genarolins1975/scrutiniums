# Revisão de navegação do Atlas — 11/10/2026

## Correções

A lista filtrada de capítulos e a ficha ao lado podiam divergir: ao procurar Justiça, a ficha anterior de Educação continuava visível. Agora a ficha pertence ao resultado atual. A seleção explícita é mantida quando ainda estiver visível; caso contrário, mostra o primeiro resultado. Sem resultados, a ficha explica o estado e oferece limpar busca e área. Limpar recupera a seleção anterior quando compatível.

A busca utiliza o contrato editorial compartilhado e consulta também recursos, acesso e resultados, além de título, verbo e descrição. Acentos são normalizados e todas as palavras procuradas precisam ocorrer no conteúdo do capítulo.

O acesso à cobertura dos capítulos publicados aponta à ficha correspondente, identificada por âncora própria, em vez de levar sempre ao início da seção geral. O destino é a expansão visível de escopo, fontes e acessos; o leitor abre a ficha pelo resumo. Temas ainda em desenvolvimento continuam levando à explicação geral da cobertura.

## Verificações

- As 13 entradas publicadas do catálogo têm rota correspondente na árvore Git do commit `a3d6b62`, incluindo a rota dinâmica de Mobilidade. Isso é conferência de código; não é uma verificação HTTP da publicação.
- As 13 fichas de cobertura têm identificadores correspondentes às entradas publicadas.
- Links do panorama foram conferidos contra os receptores: Saúde reconhece `cap`, `vs`, `med` e `ano`; Trabalho reconhece `ter`, `med`, `per`, `sexo` e `grp`; Mobilidade recebe o território na rota dinâmica `/tempo`; Educação aprofunda a comparação na própria página.
- 17 testes focados aprovados: nove da distribuição/interação e oito do catálogo, cobrindo áreas, busca, ausência de resultado, manutenção da seleção e renderização inicial com acesso específico à cobertura.
- Tipos de Atlas, Panorama, catálogo e dependências diretas aprovados na cópia local de revisão. A página de entrada foi alterada somente para incluir a âncora e margem de rolagem das fichas; seus imports de dados não estão disponíveis nessa cópia para um build completo.

Build e integração completa dependem do CI do novo commit. Browser, teclado, zoom e navegação real continuam pendentes por indisponibilidade da conexão do navegador registrada nas entregas anteriores. Nenhuma aprovação visual ou nota estética é inferida destes testes. Sem merge ou publicação em produção.
