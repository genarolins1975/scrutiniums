"""Orquestra gates, repetição de infraestrutura e publicação seletiva (stdlib).

Executar após sanidade_gold.py. Arquivos de resultado e logs ficam fora da gold.
A publicação só é instalada depois de conferir a composição final. Até lá, a
árvore pública é apenas o alvo temporário de testes e é restaurada no finally.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from scripts import publicar_gold as pg  # noqa: E402
from scripts.mapa_testes_gold import gerar  # noqa: E402

INFRA = re.compile(r'ENOBUFS|ENOMEM|heap out of memory|browserType\.launch|Executable doesn.t exist|'
                   r'Failed to launch.*(?:browser|chrom)|error while loading shared libraries|'
                   r'Target (?:page, context or browser|closed)|browser has been closed|'
                   r'Chromium.*(?:failed|não carregou)|TimeoutError|Test timed out|Hook timed out|'
                   r'ModuleNotFoundError|Cannot find package', re.I)


def executar(comando, log, timeout=1200):
    log = Path(log)
    with log.open('w') as saida:
        try:
            processo = subprocess.Popen(comando, cwd=RAIZ, stdout=saida, stderr=subprocess.STDOUT,
                                        start_new_session=True, env={**os.environ, "NODE_OPTIONS": "--max-old-space-size=4096",
                                            "EXIGIR_BUILD_HTML": "1"})
        except OSError as erro:
            saida.write(str(erro))
            return 127, str(erro)
        try:
            codigo = processo.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(processo.pid, signal.SIGKILL)
            processo.wait()
            saida.write('\nTempo esgotado: execução inconclusiva\n')
            codigo = 124
    texto = log.read_text(errors='replace')
    print(f'{comando[0]}: saída {codigo}; log {log}', flush=True)
    print(texto[-3500:], flush=True)
    return codigo, texto


def repetir_uma_vez(tentativa):
    """Uma repetição SOMENTE quando inconclusivo; nunca transforma vermelho em verde."""
    historico = []
    for numero in (1, 2):
        resultado = tentativa(numero)
        historico.append(resultado)
        if not resultado['inconclusivo']:
            break
    return {**historico[-1], 'tentativas': historico}


def classificar(codigo, texto, relatorio, suite):
    motivo = None
    resultados = {}
    if codigo in (124, 134, 137, 139, 143) or codigo < 0:
        motivo = f'processo interrompido/tempo esgotado (saída {codigo})'
    achado = INFRA.search(texto) if codigo else None
    if achado:
        motivo = achado.group(0)
    if suite == 'preparo':
        if codigo:
            motivo = 'preparo do ambiente falhou'
    elif not relatorio:
        motivo = 'relatório JSON ausente ou ilegível'
    elif suite == 'vitest':
        total = relatorio.get('numTotalTests', 0)
        concluidos = sum(relatorio.get(k, 0) for k in ('numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'))
        if not total or concluidos < total or not relatorio.get('testResults'):
            motivo = 'vitest não concluiu todos os testes'
        for arquivo in relatorio.get('testResults', []):
            nome = Path(arquivo['name']).resolve().relative_to(RAIZ).as_posix()
            assertions = arquivo.get('assertionResults', [])
            falhas = [a for a in assertions if a['status'] == 'failed']
            # Skip não é aprovação de conteúdo. Não alteramos skips existentes.
            estado = 'failed' if falhas or arquivo.get('status') == 'failed' else (
                'skipped' if not assertions or any(a['status'] in ('pending', 'skipped', 'todo') for a in assertions) else 'passed')
            detalhe = '\n'.join(str(m) for a in falhas for m in a.get('failureMessages', [])) or arquivo.get('message', '')
            if INFRA.search(detalhe):
                motivo = INFRA.search(detalhe).group(0)
            resultados[nome] = {'estado': estado, 'detalhe': detalhe}
        if (codigo or relatorio.get('success') is False) and not any(r['estado'] == 'failed' for r in resultados.values()):
            motivo = 'vitest saiu com erro sem teste reprovado'
    elif suite in ('pipeline', 'pesquisa'):
        if not relatorio.get('terminou') or not relatorio.get('testsRun'):
            motivo = 'unittest não concluiu a descoberta/execução'
        for item in relatorio.get('itens', []):
            nome = item['arquivo']
            if nome == '?' or not nome.startswith(suite + '/tests/'):
                motivo = 'unittest não carregou módulo de teste: ' + item['teste']
            atual = resultados.setdefault(nome, {'estado': 'passed', 'detalhe': ''})
            if item['estado'] == 'failed' or (item['estado'] == 'skipped' and atual['estado'] != 'failed'):
                atual['estado'] = item['estado']
            if item['detalhe']:
                atual['detalhe'] += item['teste'] + ': ' + item['detalhe'] + '\n'
        if codigo and not any(r['estado'] == 'failed' for r in resultados.values()):
            motivo = 'unittest saiu com erro sem teste reprovado'
    return {'codigo': codigo, 'inconclusivo': bool(motivo), 'motivo': motivo,
            'trecho_log': (texto[max(0, achado.start()-300):achado.end()+1500] if achado else texto[-2000:]) if motivo else '',
            'resultados': resultados}


def rodar_suite(suite, diretorio):
    def tentativa(numero):
        caminho = diretorio / f'{suite}-{numero}.json'
        log = diretorio / f'{suite}-{numero}.log'
        caminho.unlink(missing_ok=True)  # relatório antigo NUNCA prova execução nova
        if suite == 'vitest':
            comando = ['npx', '--no-install', 'vitest', 'run', '--maxWorkers=2', '--reporter=default',
                       '--reporter=json', f'--outputFile.json={caminho}']
        else:
            comando = [sys.executable, 'scripts/unittest_gold.py', f'{suite}/tests', str(caminho)]
        codigo, texto = executar(comando, log)
        try:
            rel = pg.ler_json(caminho)
        except (OSError, ValueError):
            rel = None
        return classificar(codigo, texto, rel, suite)
    return repetir_uma_vez(tentativa)


def suites(diretorio):
    diretorio.mkdir(parents=True)
    # 27/10/2026: a candidata muda em cada rodada. HTML de build anterior não prova
    # a composição que será publicada; build ausente tampouco autoriza skips.
    preparo = repetir_uma_vez(lambda n: classificar(
        *executar(['npm', 'run', 'build'], diretorio / f'build-{n}.log'), None, 'preparo'))
    execucoes = {'build': preparo}
    if not preparo['inconclusivo']:
        execucoes['vitest'] = rodar_suite('vitest', diretorio)
    # Python continua mesmo se o build/vitest reprovar. Build falho retém tudo.
    for suite in ('pipeline', 'pesquisa'):
        execucoes[suite] = rodar_suite(suite, diretorio)
    return execucoes


def resultados_das_suites(execucoes):
    return {n: r for suite in execucoes.values() for n, r in suite['resultados'].items()}


def contratos(candidata, manifesto):
    mapa, resultados = {}, {}
    for g, c in manifesto['grupos'].items():
        nome = 'contrato:' + g
        mapa[nome] = {'grupos': [g], 'evidencias': ['config/gold-grupos.json: JSON íntegro de cada membro']}
        try:
            for arquivo in pg.arquivos(candidata):
                if arquivo.endswith('.json') and any(pg.corresponde(arquivo, p) for p in c['arquivos']):
                    pg.ler_json(candidata / arquivo)
            resultados[nome] = {'estado': 'passed'}
        except (OSError, ValueError) as erro:
            resultados[nome] = {'estado': 'failed', 'detalhe': str(erro)}
    return mapa, resultados


def validar_e_publicar(candidata, publica, manifesto, mapa, rodar, trabalho):
    """Injetável: testes sintéticos exercitam as MESMAS decisões do workflow."""
    candidata, publica, trabalho = map(Path, (candidata, publica, trabalho))
    pg.validar(candidata, manifesto)
    pg.validar(publica, manifesto, exigir_todos=False)
    base = trabalho / 'anterior'
    shutil.copytree(publica, base)
    pg.preparar_meta(candidata, manifesto)
    mcontrato, rcontrato = contratos(candidata, manifesto)
    mapa = {**mapa, **mcontrato}
    restaurados = pg.ler_json(candidata / 'meta.json').get('restaurados', {})
    donos = pg.validar(candidata, manifesto)
    retidos = {}
    for nome, motivo in restaurados.items():
        if nome in donos:
            retidos.setdefault(donos[nome], []).append('Sentinela de regressão: ' + str(motivo))
    historico, decisao = [], None
    try:
        testada = candidata
        pg.instalar(testada, publica)
        for rodada in range(len(manifesto['grupos']) + 1):
            execucoes = rodar(trabalho / f'rodada-{rodada}')
            historico.append(execucoes)
            resultados = {**resultados_das_suites(execucoes), **rcontrato}
            infra = any(s['inconclusivo'] for s in execucoes.values())
            nova = pg.selecionar(manifesto, mapa, resultados, retidos, infra)
            pg.instalar(base, publica)
            if infra:
                decisao = nova
                break
            estavel = decisao is not None and set(nova['retidos']) == set(decisao['retidos'])
            decisao = nova
            retidos = decisao['retidos']
            # Instala os bytes que acabaram de ser testados, sem regenerá-los.
            if not retidos or estavel:
                pg.instalar(testada, publica)
                break
            if not decisao['publicados']:
                break  # a base já foi restaurada; não há grupo aprovado a instalar
            final = trabalho / f'composicao-{rodada}'
            pg.compor(candidata, base, final, manifesto, decisao)
            pg.instalar(final, publica)
            testada = final

        else:
            raise RuntimeError('Seleção não convergiu')
    except BaseException:
        pg.instalar(base, publica)
        raise
    return {**pg.relatorio(decisao, base, publica, manifesto), 'execucoes': historico,
            'mapa': mapa, 'resultados': resultados,
            'falhas_sem_gold': {n: r for n, r in resultados.items()
                               if not mapa[n]['grupos'] and r['estado'] == 'failed'}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidata', type=Path, default=RAIZ / 'data/gold')
    parser.add_argument('--publica', type=Path, default=RAIZ / 'public/obs/data/gold')
    parser.add_argument('--saida', type=Path, default=RAIZ / '.gold-publicacao')
    args = parser.parse_args()
    if args.saida.exists() and any(args.saida.iterdir()):
        raise ValueError('Diretório de resultados já preenchido; use uma saída nova: ' + str(args.saida))
    args.saida.mkdir(exist_ok=True)
    manifesto = pg.ler_json(pg.MANIFESTO)
    # Falha de cobertura é detectada antes de npm/testes e antes de qualquer troca.
    pg.validar(args.candidata, manifesto)
    pg.validar(args.publica, manifesto, exigir_todos=False)
    preparo = []
    for i, comando in enumerate((['npm', 'ci'], ['npx', '--no-install', 'playwright', 'install', '--with-deps', 'chromium'],
                                 ['node', 'scripts/minify-obs.mjs'])):
        res = repetir_uma_vez(lambda n: classificar(*executar(comando, args.saida / f'preparo-{i}-{n}.log'), None, 'preparo'))
        preparo.append(res)
        if res['inconclusivo']:
            dec = pg.selecionar(manifesto, {}, {}, inconclusivo=True)
            pg.gravar_json(args.saida / 'resultado.json', {**pg.relatorio(dec, args.publica, args.publica, manifesto), 'preparo': preparo, 'execucoes': []})
            return 1
    inventario = args.saida / 'inventario.json'
    subprocess.run(['node', 'scripts/mapear-testes-gold.mjs', str(inventario)], cwd=RAIZ, check=True)
    mapa = gerar(RAIZ, args.candidata, manifesto, pg.ler_json(inventario))
    pg.gravar_json(args.saida / 'mapa-testes.json', mapa)
    with tempfile.TemporaryDirectory(prefix='gold-publicacao-') as temporario:
        resultado = validar_e_publicar(args.candidata, args.publica, manifesto, mapa, suites, Path(temporario))
        # Preserva relatórios completos e logs de TODAS as tentativas antes de apagar scratch.
        for rodada in Path(temporario).glob('rodada-*'):
            shutil.copytree(rodada, args.saida / rodada.name, dirs_exist_ok=True)
    resultado['preparo'] = preparo
    pg.gravar_json(args.saida / 'resultado.json', resultado)
    return 1 if resultado['retidos'] or resultado['falhas_sem_gold'] else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as erro:
        print(f'::error::Publicação não realizada: {erro}', file=sys.stderr)
        sys.exit(2)
