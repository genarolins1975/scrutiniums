export type IntroducaoHero = `{observatorios}${string}`;
export type ContagemParcialIndice = `{publicados}${string}{total}`;

export const pt = {
  "idioma.portugues": "Português",
  "idioma.ingles": "Inglês",
  "idioma.seletor": "Idioma",
  "traducao.portugues_apenas": "Somente em português",
  "home.hero.titulo_inicio": "Da informação dispersa ao conhecimento ",
  "home.hero.titulo_destaque": "verificável",
  "acesso.criar_conta": "Criar conta gratuita",
  "home.hero.ja_cadastrado": "Já tenho cadastro",
  "home.hero.rotulo": "As coleções de dados",
  "home.hero.introducao": "{observatorios}, das Famílias aos Serviços Públicos, das Contas Públicas à Energia e Infraestrutura, da Economia ao Território e Clima, construídos sobre bases oficiais. Cada painel informa a fonte, o período de referência e o que o dado não permite afirmar." satisfies IntroducaoHero,
  "home.hero.beneficio_conta": "Todos os painéis com uma conta gratuita",
  "home.hero.beneficio_evidencia": "Fonte, período e limitações em cada número",
  "home.hero.beneficio_gratuidade": "Gratuito, sem assinatura",
  "home.indice.rotulo": "Índice das coleções",
  "home.indice.ilustracoes": "Ilustrações editoriais de cada coleção. Não representam dados nem lugares específicos.",
  "home.indice.paginas_tematicas": "páginas temáticas",
  "home.indice.secoes_publicadas": "seções publicadas",
  "home.indice.temas_publicados": "temas publicados",
  "home.indice.capitulos_com_dados": "capítulos com dados",
  "home.indice.unidades_federacao": "unidades da Federação",
  "home.indice.paginas_por_pergunta": "páginas por pergunta",
  "home.indice.contagem_parcial": "{publicados} de {total}" satisfies ContagemParcialIndice,
} as const;
