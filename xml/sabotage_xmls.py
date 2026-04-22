import os
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
ns = {'n': 'http://www.portalfiscal.inf.br/nfe'}
ET.register_namespace('', "http://www.portalfiscal.inf.br/nfe")

def sabotage(filename, error_type):
    file_path = os.path.join(path, filename)
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    if error_type == "CHAVE_DV_INVALIDO":
        # Altera o último dígito da chave no ID (Dígito Verificador errado)
        infNFe = root.find('.//n:infNFe', ns)
        if infNFe is not None:
            id_val = infNFe.get('Id')
            # Muda o último número de 1 para 2 (ou vice-versa)
            new_id = id_val[:-1] + ('0' if id_val[-1] != '0' else '1')
            infNFe.set('Id', new_id)
            
    elif error_type == "VALOR_TOTAL_DIVERGENTE":
        # Altera o valor total do produto para não bater com a soma
        vProd = root.find('.//n:prod/n:vProd', ns)
        if vProd is not None: vProd.text = "999999.99"
        
    elif error_type == "DATA_FUTURA":
        # Coloca uma data de emissão em 2027
        dhEmi = root.find('.//n:ide/n:dhEmi', ns)
        if dhEmi is not None: dhEmi.text = "2027-01-01T10:00:00-03:00"
        
    elif error_type == "LOTE_VENCIDO":
        # Coloca validade retroativa (vencida)
        dVal = root.find('.//n:rastro/n:dVal', ns)
        if dVal is not None: 
            dVal.text = "2020-01-01"
        else:
            # Se não tinha rastro, força um vencido
            det = root.find('.//n:det', ns)
            prod = det.find('n:prod', ns)
            rastro = ET.SubElement(prod, '{http://www.portalfiscal.inf.br/nfe}rastro')
            ET.SubElement(rastro, '{http://www.portalfiscal.inf.br/nfe}nLote').text = "VENCIDO999"
            ET.SubElement(rastro, '{http://www.portalfiscal.inf.br/nfe}qLote').text = "1.0000"
            ET.SubElement(rastro, '{http://www.portalfiscal.inf.br/nfe}dFab').text = "2019-01-01"
            ET.SubElement(rastro, '{http://www.portalfiscal.inf.br/nfe}dVal').text = "2020-01-01"

    tree.write(file_path, encoding="utf-8", xml_declaration=True)

# Aplica as armadilhas
sabotage("nfe_entrada_500.xml", "CHAVE_DV_INVALIDO")
sabotage("nfe_entrada_1000.xml", "VALOR_TOTAL_DIVERGENTE")
sabotage("nfe_entrada_1500.xml", "DATA_FUTURA")
sabotage("nfe_entrada_2000.xml", "LOTE_VENCIDO")

print("Sabotagem controlada aplicada para testes de sanidade.")
