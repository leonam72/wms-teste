import os
import random
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
os.makedirs(path, exist_ok=True)

# 20 Produtos fixos para garantir repetição
products = [
    {"name": "Arroz Integral 5kg", "shelf_life": 365},
    {"name": "Feijão Carioca 1kg", "shelf_life": 180},
    {"name": "Açúcar Refinado 1kg", "shelf_life": 730},
    {"name": "Óleo de Soja 900ml", "shelf_life": 365},
    {"name": "Leite Integral 1L", "shelf_life": 120},
    {"name": "Detergente 500ml", "shelf_life": 730},
    {"name": "Iogurte Natural 200ml", "shelf_life": 30},
    {"name": "Presunto Fatiado 200g", "shelf_life": 15},
    {"name": "Pão de Forma 500g", "shelf_life": 10},
    {"name": "Suco de Uva 1L", "shelf_life": 240}
]

suppliers = ["12345678000101", "23456789000102", "34567890000103"]

def get_random_date(start_year=2025):
    start = datetime(start_year, 1, 1)
    end = datetime(start_year, 12, 31)
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

for i in range(1, 2401):
    prod_info = random.choice(products)
    data_emissao = get_random_date()
    # Validade baseada na vida útil do produto + data de recebimento (emissão)
    # Adicionamos um "offset" aleatório para simular que alguns produtos já chegam com menos tempo de vida
    data_validade = data_emissao + timedelta(days=prod_info['shelf_life'] - random.randint(0, 30))
    
    lote = f"LOTE{data_emissao.strftime('%Y%m')}{random.randint(100, 999)}"
    cnpj = random.choice(suppliers)
    
    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <NFe>
        <infNFe Id="NFe{random.randint(10**43, 10**44-1)}" versao="4.00">
            <ide>
                <cUF>35</cUF>
                <nNF>{1000 + i}</nNF>
                <dhEmi>{data_emissao.isoformat()}-03:00</dhEmi>
                <mod>55</mod>
            </ide>
            <emit><CNPJ>{cnpj}</CNPJ><xNome>FORNECEDOR LOGISTICA</xNome></emit>
            <det nItem="1">
                <prod>
                    <cProd>SKU_{prod_info['name'][:3].upper()}</cProd>
                    <xProd>{prod_info['name']}</xProd>
                    <qCom>100.0000</qCom>
                    <uCom>UN</uCom>
                    <rastro>
                        <nLote>{lote}</nLote>
                        <qLote>100.0000</qLote>
                        <dFab>{(data_emissao - timedelta(days=5)).strftime('%Y-%m-%d')}</dFab>
                        <dVal>{data_validade.strftime('%Y-%m-%d')}</dVal>
                    </rastro>
                </prod>
            </det>
        </infNFe>
    </NFe>
</nfeProc>"""
    
    with open(os.path.join(path, f"nfe_fefo_fifo_{i}.xml"), 'w') as f:
        f.write(xml_content)

print("2400 XMLs preparados para testes de FEFO/FIFO.")
