"""Publicação seletiva do Crédito; somente biblioteca padrão.

Decisão, composição e instalação separadas para testar exatamente os bytes que
serão publicados. Nenhum grupo é instalado antes da validação do conjunto inteiro.
"""
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
MANIFESTO = RAIZ / 'config/gold-grupos.json'


def ler_json(arquivo):
    return json.loads(Path(arquivo).read_text(encoding='utf-8'))


def gravar_json(arquivo, objeto):
    Path(arquivo).write_text(json.dumps(objeto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def arquivos(pasta):
    return sorted(p.relative_to(pasta).as_posix() for p in Path(pasta).rglob('*') if p.is_file())


def corresponde(arquivo, padrao):
    # '*' não atravessa diretório: uma família não absorve arquivos novos fora dela.
    return len(arquivo.split('/')) == len(padrao.split('/')) and fnmatch.fnmatchcase(arquivo, padrao)


def validar(pasta, manifesto, exigir_todos=True):
    grupos = manifesto['grupos']
    nomes = arquivos(pasta)
    donos = {}
    for grupo, contrato in grupos.items():
        for dep in contrato['depende_de']:
            if dep not in grupos:
                raise ValueError(f'{grupo}: dependência inexistente: {dep}')
        for padrao in contrato['arquivos']:
            if padrao.startswith('/') or '..' in Path(padrao).parts:
                raise ValueError(f'Padrão inseguro: {padrao}')
            encontrados = [n for n in nomes if corresponde(n, padrao)]
            if not encontrados and exigir_todos:
                raise ValueError(f'{grupo}: arquivo/padrão inexistente: {padrao}')
            for nome in encontrados:
                if (Path(pasta) / nome).is_symlink():
                    raise ValueError(f'Symlink não permitido: {nome}')
                if nome in donos:
                    raise ValueError(f'{nome}: mais de um grupo ({donos[nome]}, {grupo})')
                donos[nome] = grupo
    faltantes = sorted(set(nomes) - donos.keys())
    if faltantes:
        raise ValueError('Gold sem grupo no manifesto: ' + ', '.join(faltantes))
    return donos


CAMPOS_COMPARTILHADOS = ('inad_conceitos', 'carteira_conceitos', 'if_contagens')


def compartilhados(meta):
    """Só os números transversais usados nos painéis, sem replicar logs/fontes."""
    return {k: meta[k] for k in CAMPOS_COMPARTILHADOS if k in meta}


def metadados_grupos(pasta, manifesto):
    meta = ler_json(Path(pasta) / 'meta.json')
    anteriores = meta.get('grupos', {})
    registros = {}
    for g, c in manifesto['grupos'].items():
        registro = dict(anteriores.get(g, {}))
        if not registro:
            registro = {'gerado_em': meta.get('gerado_em') if any(any(Path(pasta).glob(p)) for p in c['arquivos']) else None,
                        'arquivos': c['arquivos'], 'vintages': meta.get('vintages', {})}
        snapshot = meta.get('snapshots', {}).get(registro.get('snapshot'), registro.get('meta', meta))
        registro['meta'] = compartilhados(snapshot)
        registros[g] = registro
    return registros


def empacotar_meta(meta, registros):
    """Referências por hash: cada snapshot numérico é serializado uma só vez."""
    grupos, snapshots = {}, {}
    for grupo, registro in registros.items():
        valores = compartilhados(registro['meta'])
        codigo = hashlib.sha256(json.dumps(valores, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        snapshots[codigo] = valores
        grupos[grupo] = {k: v for k, v in registro.items() if k not in ('meta', 'fontes_status', 'snapshot')}
        grupos[grupo]['snapshot'] = codigo
    return {**meta, 'grupos': grupos, 'snapshots': snapshots}


def preparar_meta(candidata, manifesto):
    """Enriquece a candidata ANTES dos testes; tudo verde copia estes bytes exatos."""
    validar(candidata, manifesto)
    caminho = Path(candidata) / 'meta.json'
    meta = ler_json(caminho)
    meta.pop('grupos', None)
    meta.pop('snapshots', None)
    registros = {g: {'gerado_em': meta.get('gerado_em'), 'arquivos': c['arquivos'],
                     'vintages': meta.get('vintages', {}), 'meta': compartilhados(meta)}
                 for g, c in manifesto['grupos'].items()}
    gravar_json(caminho, empacotar_meta(meta, registros))


def selecionar(manifesto, mapa, resultados, retidos=None, inconclusivo=False):
    motivos = {g: list(ms) for g, ms in (retidos or {}).items()}
    grupos = manifesto['grupos']
    if inconclusivo:
        motivos = {g: ['Infraestrutura: execução inconclusiva após uma repetição'] for g in grupos}
    else:
        for teste, protecao in mapa.items():
            if not protecao['grupos']:
                continue
            estado = resultados.get(teste, {}).get('estado', 'ausente')
            if estado != 'passed':
                for g in protecao['grupos']:
                    motivos.setdefault(g, []).append(f'{teste}: {estado}')
        # Falha de teste não inventariado não pode ser silenciosamente ignorada.
        desconhecidos = set(resultados) - mapa.keys()
        if desconhecidos:
            raise ValueError('Testes sem classificação: ' + ', '.join(sorted(desconhecidos)))
    while True:
        antes = set(motivos)
        # meta é o envelope de controle da seleção inteira, não um painel isolado.
        if 'meta' in motivos:
            for g in grupos:
                motivos.setdefault(g, ['Dependência: envelope meta reprovado'])
        for g, c in grupos.items():
            for dep in c['depende_de']:
                if dep in motivos:
                    motivo = f'Dependência retida: {dep}'
                    if motivo not in motivos.setdefault(g, []):
                        motivos[g].append(motivo)
        # setdefault acima só ocorre no ramo de dependência reprovada.
        if antes == set(motivos):
            break
    return {'publicados': sorted(set(grupos) - motivos.keys()), 'retidos': motivos,
            'inconclusivo': inconclusivo}


def recompor_ufs(pasta, gerado_em):
    # O próprio builder é puro sobre a gold, não abre silver nem rede.
    from pipeline import common, ufs
    anterior = common.GOLD
    try:
        common.GOLD = str(pasta)
        payload = ufs.build()
        if payload.get('disponivel') is False:
            raise ValueError('Recomposição de ufs.json indisponível')
        payload['gerado_em'] = gerado_em
        gravar_json(Path(pasta) / 'ufs.json', payload)
    finally:
        common.GOLD = anterior


def conferir_retidos(anterior, final, manifesto, retidos):
    """Invariante em produção, além do teste: nomes e SHA-256 devem coincidir."""
    def hashes(pasta):
        donos = validar(pasta, manifesto, exigir_todos=False)
        resultado = {}
        for n, g in donos.items():
            if g in retidos:
                with (Path(pasta) / n).open('rb') as f:
                    resultado[n] = hashlib.file_digest(f, 'sha256').hexdigest()
        return resultado
    antes, depois = hashes(anterior), hashes(final)
    diferentes = sorted(n for n in antes.keys() | depois.keys() if antes.get(n) != depois.get(n))
    if diferentes:
        raise ValueError('Bytes de grupo retido foram alterados: ' + ', '.join(diferentes))


def compor(candidata, anterior, destino, manifesto, decisao, recompositor=recompor_ufs):
    """Produz um diretório para retestar. Retidos preservam cada byte da base."""
    candidata, anterior, destino = map(Path, (candidata, anterior, destino))
    donos_novos = validar(candidata, manifesto)
    donos_antigos = validar(anterior, manifesto, exigir_todos=False)
    if destino.exists():
        raise ValueError(f'Destino de composição já existe: {destino}')
    shutil.copytree(anterior, destino)
    publicados = set(decisao['publicados'])
    for nome, g in donos_antigos.items():
        if g in publicados:
            (destino / nome).unlink()
    for nome, g in donos_novos.items():
        if g in publicados:
            alvo = destino / nome
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(candidata / nome, alvo)
    datas_novas = metadados_grupos(candidata, manifesto)
    for g in publicados:
        regra = manifesto['grupos'][g].get('recompor')
        if regra and set(regra['insumos']) & decisao['retidos'].keys():
            recompositor(destino, datas_novas[g]['gerado_em'])
    if decisao['retidos'] and 'meta' in publicados:
        meta = ler_json(destino / 'meta.json')
        base = ler_json(anterior / 'meta.json')
        datas_antigas = metadados_grupos(anterior, manifesto)
        meta['grupos'] = {g: (datas_novas if g in publicados else datas_antigas)[g]
                          for g in manifesto['grupos']}
        # Metadados compartilhados contêm números de vários temas (conceitos de
        # inadimplência/carteira, contagens de IF). Num lote parcial, um grupo
        # aprovado não pode vazar por esse snapshot números de uma fonte retida.
        valores_base = compartilhados(base)
        for g in publicados:
            meta['grupos'][g] = {**meta['grupos'][g], 'meta': valores_base}
        datas = [v['gerado_em'] for v in meta['grupos'].values()]
        # Ausência continua ausência. O global é deliberadamente conservador.
        meta = {**base, 'grupos': meta['grupos'],
                'gerado_em': min(datas) if all(datas) else None}
        gravar_json(destino / 'meta.json', empacotar_meta(meta, meta['grupos']))
    validar(destino, manifesto, exigir_todos=False)
    conferir_retidos(anterior, destino, manifesto, decisao['retidos'])
    return destino


def instalar(origem, destino):
    """Troca a árvore completa já aprovada; rollback se a instalação falhar."""
    origem, destino = Path(origem), Path(destino)
    with tempfile.TemporaryDirectory(prefix='.gold-troca-', dir=destino.parent) as tmp:
        pronta, reserva = Path(tmp) / 'nova', Path(tmp) / 'anterior'
        shutil.copytree(origem, pronta)
        os.replace(destino, reserva)
        try:
            os.replace(pronta, destino)
        except BaseException:
            os.replace(reserva, destino)
            raise


def relatorio(decisao, anterior, final, manifesto):
    antigas = metadados_grupos(anterior, manifesto)
    novas = metadados_grupos(final, manifesto)
    return {**decisao,
            'datas_anteriores': {g: v['gerado_em'] for g, v in antigas.items()},
            'datas_publicadas': {g: novas[g]['gerado_em'] for g in decisao['publicados']}}
