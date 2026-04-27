import axios from 'axios';
import type { Product } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

export const getDepots = async () => {
  const response = await api.get('/depots');
  return response.data;
};

export const getWMSState = async (depotId: string) => {
  const response = await api.get(`/state/${depotId}`);
  return response.data;
};

export const syncInventoryAdd = async (data: { 
  depotId: string, 
  shelfCode: string, 
  floor: number, 
  drawer: number, 
  product: Product, 
  qty: number 
}) => {
  const response = await api.post('/inventory/add', data);
  return response.data;
};

export const syncInventoryTransfer = async (data: {
    depotId: string,
    productCode: string,
    qty: number,
    fromLoc: string,
    toLoc: string
}) => {
    const response = await api.post('/inventory/transfer', data);
    return response.data;
};

export const syncFloorPlan = async (depotId: string, objects: any[]) => {
  const response = await api.post('/floorplan/sync', { depotId, objects });
  return response.data;
};

export const updateProductDetails = async (code: string, data: { name?: string }) => {
  const response = await api.patch(`/products/${code}`, data);
  return response.data;
};

export const logAuditAction = async (data: { action: string, detail: string, productCode?: string, qty?: number }) => {
  const response = await api.post('/audit', data);
  return response.data;
};

export default api;
