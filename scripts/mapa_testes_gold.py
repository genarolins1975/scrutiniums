"""Deriva protetores de conteúdo; a unidade conservadora é o ARQUIVO de teste.

TS: literais da AST (sem comentários), nomes estáticos, concatenações/templates
com listas de nomes e famílias enumeradas. Imports de leitores de gold também
contam. Exceções dinâmicas têm justificativa versionada. Python: AST de imports
identifica testes dos builders, além de referências diretas à gold publicada.
O mapa completo, com evidências/linhas, é artefato de cada execução.
"""
import ast
import json
from pathlib import Path
import posixpath
from scripts.publicar_gold import corresponde, validar


def gerar(raiz, pasta_gold, manifesto, inventario):
    raiz = Path(raiz)
    donos = validar(pasta_gold, manifesto)
    aliases = {}
    for arquivo, grupo in donos.items():
        for alias in ({arquivo, Path(arquivo).stem} if '/' not in arquivo else {arquivo, arquivo.split('/')[0]}):
            aliases.setdefault(alias, set()).add(grupo)
    stems = {Path(a).stem for a in donos if '/' not in a}
    excecoes = json.loads((raiz / 'config/gold-testes-excecoes.json').read_text())
    def leitores(nome, vistos=None):
        vistos = set() if vistos is None else vistos
        if nome in vistos or nome not in inventario:
            return []
        vistos.add(nome)
        fonte = inventario[nome]
        ts = fonte['strings']
        leitura = fonte['le_fs'] and (any('public/obs/data/gold' in s['texto'] for s in ts)
                                     or all(any(s['texto'] == p for s in ts) for p in ('public', 'obs', 'data', 'gold')))
        fontes = [(nome, ts)] if leitura else []
        for imp in fonte['imports']:
            if imp.startswith('@/'):
                base = imp.replace('@/', 'src/', 1)
            elif imp.startswith('.'):
                base = posixpath.normpath(posixpath.join(posixpath.dirname(nome), imp))
            else:
                continue
            for sufixo in ('.ts', '.tsx', '/index.ts', '/index.tsx'):
                modulo = base + sufixo
                if modulo in inventario:
                    fontes.extend(leitores(modulo, vistos))
                    break
        return fontes

    saida = {}
    for nome, fonte in sorted(inventario.items()):
        if not nome.startswith('src/tests/') or not nome.endswith('.test.ts'):
            continue
        # Import estático ou import() literal; acompanha também wrappers relativos.
        fontes = leitores(nome)
        grupos, provas = set(), []
        for origem, literais in fontes:
            for s in literais:
                if s.get('assertion'):
                    continue
                texto = s['texto']
                chaves = {texto, texto.removeprefix('public/obs/data/gold/'), texto.rstrip('/').split('/')[-1]}
                for chave in chaves:
                    if chave in stems and not s.get('nome_gold'):
                        continue
                    encontrados = aliases.get(chave, set())
                    grupos.update(encontrados)
                    if encontrados:
                        prova = f'{origem}:{s["linha"]}: {texto}'
                        if prova not in provas:
                            provas.append(prova)
        override = excecoes.get(nome)
        if override:
            grupos.update(override.get('adicionar', []))
            if override.get('todos'):
                grupos.update(manifesto['grupos'])
            if 'somente' in override:
                grupos = set(override['somente'])
            provas.append('Exceção conferível: ' + override['motivo'])
        if fontes and not grupos and not override:
            raise ValueError(f'Leitura dinâmica de gold sem classificação: {nome}')
        saida[nome] = {'grupos': sorted(grupos), 'evidencias': provas}
    for pasta in ('pipeline/tests', 'pesquisa/tests'):
        for caminho in sorted((raiz / pasta).glob('test_*.py')):
            nome = caminho.relative_to(raiz).as_posix()
            arvore = ast.parse(caminho.read_text())
            modulos, strings = set(), []
            for no in ast.walk(arvore):
                if isinstance(no, ast.ImportFrom):
                    modulos.add(no.module or '')
                    modulos.update(f'{no.module}.{a.name}' for a in no.names)
                if isinstance(no, ast.Constant) and isinstance(no.value, str):
                    strings.append(no.value)
            grupos, provas = set(), []
            for g, c in manifesto['grupos'].items():
                for produtor in c.get('produtores', []):
                    modulo = produtor.removesuffix('.py').replace('/', '.')
                    # gold.py é orquestrador, não associa todo unitário do pipeline.
                    if modulo != 'pipeline.gold' and modulo in modulos:
                        grupos.add(g)
                        provas.append(f'AST import: {modulo} -> {g}')
            if any('public/obs/data/gold' in s for s in strings) or all(p in strings for p in ('public', 'obs', 'data', 'gold')):
                for a, g in donos.items():
                    if a in strings or Path(a).stem in strings:
                        grupos.add(g)
                        provas.append('AST literal: ' + a)
            override = excecoes.get(nome)
            if override:
                grupos.update(override.get('adicionar', []))
                if override.get('todos'):
                    grupos.update(manifesto['grupos'])
                if 'somente' in override:
                    grupos = set(override['somente'])
                provas.append('Exceção conferível: ' + override['motivo'])
            saida[nome] = {'grupos': sorted(grupos), 'evidencias': sorted(set(provas))}
    if set(excecoes) - saida.keys():
        raise ValueError('Exceções apontam para teste inexistente: ' + ', '.join(set(excecoes) - saida.keys()))
    for nome, item in saida.items():
        if set(item['grupos']) - manifesto['grupos'].keys():
            raise ValueError(f'{nome}: grupo de teste inexistente')
    return saida
