from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

NFE_NS = {"nfe": "http://www.portalfiscal.inf.br/nfe"}


class NFeParserError(ValueError):
    pass


@dataclass(slots=True)
class ParsedNFe:
    chave_acesso: str
    numero_nf: str
    serie: str
    data_emissao: str | None
    emitente: dict[str, Any]
    transportadora: dict[str, Any] | None
    valor_total: float
    itens: list[dict[str, Any]]


def _find_nfe_root(root: ET.Element) -> ET.Element:
    tag_name = root.tag.rsplit("}", 1)[-1]
    if tag_name == "NFe":
        return root
    if tag_name == "nfeProc":
        child = root.find("nfe:NFe", NFE_NS)
        if child is not None:
            return child
    raise NFeParserError("Estrutura XML NF-e não reconhecida.")


def _first_text(parent: ET.Element | None, path: str) -> str | None:
    if parent is None:
        return None
    node = parent.find(path, NFE_NS)
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value or None


def _decimal_to_float(value: str | None) -> float:
    try:
        return float(Decimal(value or "0"))
    except (InvalidOperation, TypeError, ValueError):
        return 0.0


def parse_nfe_file(path: str | Path) -> ParsedNFe:
    file_path = Path(path)
    try:
        root = ET.parse(file_path).getroot()
    except ET.ParseError as exc:
        raise NFeParserError(f"XML inválido: {file_path.name}") from exc

    nfe_root = _find_nfe_root(root)
    inf_nfe = nfe_root.find("nfe:infNFe", NFE_NS)
    if inf_nfe is None:
        raise NFeParserError(f"NF-e sem bloco infNFe: {file_path.name}")

    raw_id = (inf_nfe.attrib.get("Id") or "").strip()
    chave_acesso = raw_id[3:] if raw_id.startswith("NFe") else raw_id
    if len(chave_acesso) != 44 or not chave_acesso.isdigit():
        raise NFeParserError(f"Chave de acesso inválida em {file_path.name}")

    ide = inf_nfe.find("nfe:ide", NFE_NS)
    emit = inf_nfe.find("nfe:emit", NFE_NS)
    transp = inf_nfe.find("nfe:transp", NFE_NS)
    total = inf_nfe.find("nfe:total/nfe:ICMSTot", NFE_NS)

    itens: list[dict[str, Any]] = []
    for det in inf_nfe.findall("nfe:det", NFE_NS):
        prod = det.find("nfe:prod", NFE_NS)
        if prod is None:
            continue
        item = {
            "item": (det.attrib.get("nItem") or "").strip() or None,
            "codigo": _first_text(prod, "nfe:cProd"),
            "ean": _first_text(prod, "nfe:cEAN"),
            "descricao": _first_text(prod, "nfe:xProd"),
            "ncm": _first_text(prod, "nfe:NCM"),
            "cest": _first_text(prod, "nfe:CEST"),
            "cfop": _first_text(prod, "nfe:CFOP"),
            "unidade_comercial": _first_text(prod, "nfe:uCom"),
            "quantidade_comercial": _decimal_to_float(_first_text(prod, "nfe:qCom")),
            "unidade_tributaria": _first_text(prod, "nfe:uTrib"),
            "quantidade_tributaria": _decimal_to_float(_first_text(prod, "nfe:qTrib")),
            "marca": _first_text(prod, "nfe:xMarca"),
            "fabricante": _first_text(prod, "nfe:xFab"),
            "item_pedido": _first_text(prod, "nfe:nItemPed"),
        }
        itens.append(item)

    return ParsedNFe(
        chave_acesso=chave_acesso,
        numero_nf=_first_text(ide, "nfe:nNF") or "",
        serie=_first_text(ide, "nfe:serie") or "",
        data_emissao=_first_text(ide, "nfe:dhEmi"),
        emitente={
            "nome": _first_text(emit, "nfe:xNome"),
            "fantasia": _first_text(emit, "nfe:xFant"),
            "cnpj": _first_text(emit, "nfe:CNPJ"),
            "uf": _first_text(emit, "nfe:enderEmit/nfe:UF"),
        },
        transportadora={
            "nome": _first_text(transp, "nfe:transporta/nfe:xNome"),
            "placa": _first_text(transp, "nfe:veicTransp/nfe:placa"),
        } if transp is not None else None,
        valor_total=_decimal_to_float(_first_text(total, "nfe:vNF")),
        itens=itens,
    )


def blind_payload(parsed: ParsedNFe) -> dict[str, Any]:
    return {
        "chave_acesso": parsed.chave_acesso,
        "numero_nf": parsed.numero_nf,
        "serie": parsed.serie,
        "data_emissao": parsed.data_emissao,
        "emitente": parsed.emitente,
        "transportadora": parsed.transportadora,
        "produtos": [
            {
                "codigo": item.get("codigo"),
                "descricao": item.get("descricao"),
                "ncm": item.get("ncm"),
                "unidade_comercial": item.get("unidade_comercial"),
                "unidade_tributaria": item.get("unidade_tributaria"),
                "cest": item.get("cest"),
                "ean": item.get("ean"),
                "marca": item.get("marca") or item.get("fabricante"),
                "fabricante": item.get("fabricante"),
                "item_pedido": item.get("item_pedido"),
            }
            for item in parsed.itens
        ],
    }
