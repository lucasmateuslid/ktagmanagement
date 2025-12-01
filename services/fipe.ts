
// Service for FIPE Table Integration
// Uses the Parallelum Public API: https://deividfortuna.github.io/fipe/

export interface FipeReference {
  codigo: string;
  nome: string;
}

export interface FipeVehicleData {
  TipoVeiculo: number;
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

const BASE_URL = 'https://parallelum.com.br/fipe/api/v1';

export const fipeService = {
  // Get Brands (Marcas)
  getBrands: async (vehicleType: 'carros' | 'motos' | 'caminhoes') => {
    try {
      const response = await fetch(`${BASE_URL}/${vehicleType}/marcas`);
      if (!response.ok) throw new Error('Failed to fetch brands');
      return (await response.json()) as FipeReference[];
    } catch (error) {
      console.error('FIPE Service Error:', error);
      return [];
    }
  },

  // Get Models (Modelos)
  getModels: async (vehicleType: string, brandId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${vehicleType}/marcas/${brandId}/modelos`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.modelos as FipeReference[];
    } catch (error) {
      console.error('FIPE Service Error:', error);
      return [];
    }
  },

  // Get Years (Anos)
  getYears: async (vehicleType: string, brandId: string, modelId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${vehicleType}/marcas/${brandId}/modelos/${modelId}/anos`);
      if (!response.ok) throw new Error('Failed to fetch years');
      return (await response.json()) as FipeReference[];
    } catch (error) {
      console.error('FIPE Service Error:', error);
      return [];
    }
  },

  // Get Full Details
  getDetails: async (vehicleType: string, brandId: string, modelId: string, yearId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${vehicleType}/marcas/${brandId}/modelos/${modelId}/anos/${yearId}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      return (await response.json()) as FipeVehicleData;
    } catch (error) {
      console.error('FIPE Service Error:', error);
      return null;
    }
  }
};
