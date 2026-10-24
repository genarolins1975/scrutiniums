"""Continua lotes confirmados do resumo, sem repetir requisição cujo envio falhou.

Executado só pelo workflow autorizado. Testes injetam o disparo; nunca enviam e-mail.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

URL = 'https://scrutiniums.com/api/resumo/enviar'
MAX_LOTES = 8  # 8 × 310 s + espera de deploy de 600 s cabem no job de 60 minutos


def dia_brasilia():
    return datetime.now(ZoneInfo('America/Sao_Paulo')).date()


def executar(disparar, *, simular=True, max_lotes=MAX_LOTES, dia=dia_brasilia, registrar=print):
    inicio = dia()
    total = 0
    for lote in range(1, max_lotes + 1):
        if dia() != inicio:
            raise RuntimeError('Janela diária de envio encerrou com destinatários pendentes; requer intervenção.')
        resposta = disparar(simular)
        if not isinstance(resposta, dict):
            raise ValueError('Resposta de envio fora do contrato.')
        if simular:
            if resposta.get('simulacao') is not True or resposta.get('enviados') != 0:
                raise ValueError('O destino não confirmou simulação sem envio.')
            registrar(json.dumps({'simulacao': True, 'destinatarios': resposta.get('destinatarios'),
                                  'assunto': resposta.get('assunto'), 'enviados': 0}, ensure_ascii=False))
            return 0
        for chave in ['enviados', 'falhas', 'pendentes']:
            if type(resposta.get(chave)) is not int or resposta[chave] < 0:
                raise ValueError(f'Resposta de envio com {chave} inválido.')
        total += resposta['enviados']
        registrar(json.dumps({'lote': lote, 'enviados': resposta['enviados'],
                              'falhas': resposta['falhas'], 'pendentes': resposta['pendentes']}))
        if resposta['falhas']:
            raise RuntimeError('Provedor informou falha; nenhuma repetição automática de envio.')
        if not resposta['pendentes']:
            return total
        # A próxima chamada seleciona somente as assinaturas ainda elegíveis;
        # reservas atômicas e a periodicidade continuam sendo decididas pela rota.
    raise RuntimeError(f'Limite de {max_lotes} lotes atingido com destinatários pendentes; não concluído.')


def main():
    secret = os.environ.get('BOLETIM_SECRET', '')
    if len(secret) < 16:
        print('BOLETIM_SECRET ausente ou inválido; conferir configuração autorizada.', file=sys.stderr)
        return 1
    simular = os.environ.get('SIMULAR', 'true').lower() == 'true'

    def disparar(modo_simulado):
        req = urllib.request.Request(URL + ('?simular=1' if modo_simulado else ''),
            method='GET' if modo_simulado else 'POST',
            headers={'Authorization': 'Bearer ' + secret})
        # Não repetir falha de transporte/HTTP: a confirmação de envio pode ter se perdido.
        with urllib.request.urlopen(req, timeout=310) as resposta:
            return json.load(resposta)
    try:
        executar(disparar, simular=simular)
        return 0
    except urllib.error.HTTPError as erro:
        print(f'Falha HTTP {erro.code}; lote não repetido.', file=sys.stderr)
    except Exception as erro:
        print(f'Falha no disparo: {type(erro).__name__}: {erro}', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
