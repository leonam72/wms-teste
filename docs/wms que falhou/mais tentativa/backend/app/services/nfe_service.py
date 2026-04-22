import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, List, Dict, Optional
from dataclasses import dataclass

NFE_NS = {"nfe": "http://www.portalfiscal.inf.br/nfe"}

@dataclass(slots=True)
class ParsedNFe:
    chave_acesso: str
    numero_nf: str
    serie: str
    emitente_nome: Optional[str]
    emitente_cnpj: Optional[str]
    itens: List[Dict[str, Any]]

class NFeService:
    @staticmethod
    def _find_nfe_root(root: ET.Element) -> ET.Element:
        tag_name = root.tag.rsplit("}", 1)[-1]
        if tag_name == "NFe": return root
        if tag_name == "nfeProc":
            child = root.find("nfe:NFe", NFE_NS)
            if child is not None: return child
        raise ValueError("Estrutura XML NF-e não reconhecida.")

    @staticmethod
    def _get_text(parent: Optional[ET.Element], path: str) -> Optional[str]:
        if parent is None: return None
        node = parent.find(path, NFE_NS)
        return node.text.strip() if node is not None and node.text else None

    @staticmethod
    def convert_to_base_unit(unit_str: str, qty: float) -> float:
        """Converte unidades comerciais para unidades base (UN) baseadas em dicionário básico."""
        conversions = {'CX': 12, 'FD': 20, 'UN': 1, 'KG': 1, 'PC': 1}
        factor = conversions.get(unit_str.upper(), 1)
        return qty * factor

    @classmethod
    def extract_lot_info(cls, det: ET.Element) -> Dict[str, Optional[str]]:
        """Extrai lote e validade do bloco rastro."""
        prod = det.find("nfe:prod", NFE_NS)
        if prod is not None:
            rastro = prod.find("nfe:rastro", NFE_NS)
            if rastro is not None:
                return {
                    "lote": cls._get_text(rastro, "nfe:nLote"),
                    "validade": cls._get_text(rastro, "nfe:dVal")
                }
        return {"lote": None, "validade": None}

    @classmethod
    def parse_xml(cls, xml_content: bytes) -> ParsedNFe:
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError:
            raise ValueError("XML inválido ou corrompido.")

        nfe_root = cls._find_nfe_root(root)
        inf_nfe = nfe_root.find("nfe:infNFe", NFE_NS)
        if inf_nfe is None: raise ValueError("NF-e sem bloco infNFe.")

        raw_id = (inf_nfe.attrib.get("Id") or "").strip()
        chave = raw_id[3:] if raw_id.startswith("NFe") else raw_id
        
        ide = inf_nfe.find("nfe:ide", NFE_NS)
        emit = inf_nfe.find("nfe:emit", NFE_NS)

        itens = []
        for det in inf_nfe.findall("nfe:det", NFE_NS):
            prod = det.find("nfe:prod", NFE_NS)
            if prod is None: continue
            
            unit = cls._get_text(prod, "nfe:uCom") or "UN"
            qty = float(cls._get_text(prod, "nfe:qCom") or 0.0)
            lot_data = cls.extract_lot_info(det)
            
            itens.append({
                "codigo": cls._get_text(prod, "nfe:cProd"),
                "ean": cls._get_text(prod, "nfe:cEAN"),
                "descricao": cls._get_text(prod, "nfe:xProd"),
                "quantidade": qty,
                "unidade": unit,
                "quantidade_base": cls.convert_to_base_unit(unit, qty),
                "lote": lot_data["lote"],
                "validade": lot_data["validade"]
            })

        return ParsedNFe(
            chave_acesso=chave,
            numero_nf=cls._get_text(ide, "nfe:nNF") or "",
            serie=cls._get_text(ide, "nfe:serie") or "",
            emitente_nome=cls._get_text(emit, "nfe:xNome"),
            emitente_cnpj=cls._get_text(emit, "nfe:CNPJ"),
            itens=itens
        )
