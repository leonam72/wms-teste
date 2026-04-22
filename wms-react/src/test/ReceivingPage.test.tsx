import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReceivingPage from '../components/features/Receiving/ReceivingPage';
import { useWMSStore } from '../store/useWMSStore';

// Dummy XML for testing
const mockXML = `
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <det>
        <prod>
          <cProd>XML-001</cProd>
          <xProd>Produto Teste XML</xProd>
          <qCom>10</qCom>
          <uCom>UN</uCom>
          <vUnCom>1.5</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>
`;

describe('ReceivingPage (NFe Upload)', () => {
  beforeEach(() => {
    useWMSStore.setState({ productsAll: { dep1: {} }, activeDepotId: 'dep1' });
  });

  it('should render the upload button', () => {
    render(<ReceivingPage />);
    expect(screen.getByText('SELECIONAR XML DA NFe')).toBeInTheDocument();
  });

  it('should parse XML and display items on file upload', async () => {
    render(<ReceivingPage />);
    const file = new File([mockXML], 'nota.xml', { type: 'text/xml' });
    const input = screen.getByLabelText(/SELECIONAR XML DA NFe/i);

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Produto Teste XML')).toBeInTheDocument();
      expect(screen.getByText('XML-001')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('should add products to RECEBIMENTO drawer when clicking receive all', async () => {
    render(<ReceivingPage />);
    const file = new File([mockXML], 'nota.xml', { type: 'text/xml' });
    const input = screen.getByLabelText(/SELECIONAR XML DA NFe/i);

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('RECEBER TUDO (ENVIAR PARA DOCA)')).toBeInTheDocument();
    });

    // We need to mock alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    fireEvent.click(screen.getByText('RECEBER TUDO (ENVIAR PARA DOCA)'));

    const state = useWMSStore.getState();
    const docaProducts = state.productsAll['dep1']['RECEBIMENTO'];
    
    expect(docaProducts).toBeDefined();
    expect(docaProducts[0].code).toBe('XML-001');
    expect(alertMock).toHaveBeenCalled();
    alertMock.mockRestore();
  });
});
