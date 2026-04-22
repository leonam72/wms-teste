/**
 * NFe XML Parser Service (Ported from wms-neo)
 */
export type ParsedNFeItem = {
  code: string;
  name: string;
  qty: number;
  unit: string;
  kg: number;
  lot?: string;
  expiry?: string;
}

export const parseNFeXML = (xmlString: string): ParsedNFeItem[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  const items: ParsedNFeItem[] = [];
  const details = xmlDoc.getElementsByTagName("det");

  for (let i = 0; i < details.length; i++) {
    const det = details[i];
    const prod = det.getElementsByTagName("prod")[0];
    
    if (prod) {
      const code = prod.getElementsByTagName("cProd")[0]?.textContent || "";
      const name = prod.getElementsByTagName("xProd")[0]?.textContent || "";
      const qty = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0");
      const unit = prod.getElementsByTagName("uCom")[0]?.textContent || "UN";
      const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0");
      
      // Lógica de Lote/Validade (bloco rastro)
      const rastro = det.getElementsByTagName("rastro")[0];
      const lot = rastro?.getElementsByTagName("nLote")[0]?.textContent || undefined;
      const expiry = rastro?.getElementsByTagName("dVal")[0]?.textContent || undefined;

      items.push({
        code,
        name,
        qty,
        unit,
        kg: vUnCom, // Peso ou valor unitário dependendo da configuração
        lot,
        expiry
      });
    }
  }

  return items;
};
