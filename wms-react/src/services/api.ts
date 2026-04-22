import axios from 'axios';
import type { Product } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

export const getWMSState = async (depotId: string) => {
  const response = await api.get(`/state/${depotId}`);
  return response.data;
};

export const addProduct = async (data: { 
  depotId: string, 
  shelfId: string, 
  floor: number, 
  drawer: number, 
  product: Product, 
  qty: number 
}) => {
  const response = await api.post('/inventory/add', data);
  return response.data;
};

export const updateFloorPlanPos = async (data: { id: string, x: number, y: number, width: number, height: number }) => {
  const response = await api.put('/floorplan/update', data);
  return response.data;
};

export default api;
