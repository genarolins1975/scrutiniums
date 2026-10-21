"""Identidade de entidades do setor elétrico, comum a todos os módulos.

Regra: a chave canônica de uma pessoa jurídica é o CNPJ com 14 dígitos (texto,
zeros à esquerda). Distribuidora, gerador e comercializador são identificados pelo
CNPJ informado pela própria fonte oficial (SAMP, indicadores de continuidade,
tarifas, SIGA, CVM). Vínculo por semelhança de nome é proibido: onde a fonte não
traz CNPJ, o módulo mantém uma tabela de correspondência explícita, versionada no
código, com a origem de cada linha, e o que não casa fica identificado como não
vinculado (nunca descartado nem atribuído por aproximação).

Mudança societária ou de concessão (ex.: troca de controlador com o mesmo CNPJ, ou
novo CNPJ para a mesma área) é registrada como evento com data e fonte; séries
não são emendadas sem esse registro.
"""
import re
import unicodedata


def cnpj(valor):
    """CNPJ canônico (14 dígitos) ou None. Aceita número, texto com máscara ou CPF/CNPJ
    numérico sem zeros à esquerda (como no SAMP). Não valida dígito verificador de
    propósito: a fonte é a autoridade, e um CNPJ que ela publica é mantido como veio."""
    if valor is None:
        return None
    s = re.sub(r"\D", "", str(valor).split(".")[0] if isinstance(valor, float) else str(valor))
    if not s or len(s) > 14:
        return None
    return s.zfill(14)


def cnpj_formatado(c14):
    c14 = cnpj(c14)
    if not c14:
        return None
    return f"{c14[:2]}.{c14[2:5]}.{c14[5:8]}/{c14[8:12]}-{c14[12:]}"


def raiz_cnpj(c14):
    """Oito primeiros dígitos: identificam a empresa (matriz e filiais)."""
    c14 = cnpj(c14)
    return c14[:8] if c14 else None


def slug(texto):
    """Slug estável para URL a partir de um nome oficial (sem acento, minúsculas)."""
    s = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or None


def normaliza_nome(texto):
    """Forma de comparação para exibição e busca (NUNCA para vincular entidades)."""
    s = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()
