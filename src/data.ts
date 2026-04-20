export interface KPIData {
  category: string;
  type_code: string;
  dimension: string;
  option: string;
  kpi_name: string;
  target: string;
  score_1: string;
  score_2: string;
  score_3: string;
  score_4: string;
  score_5: string;
  measurement: string;
  level: string;
}

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzSmgpd3Q8oL9Gb8rg7ZVZwCPiSollWs-mubTuU0nwJE9rZQIyJWqKSuefTNf3zfRAZqQ/exec';

export const fetchKPIData = async (): Promise<KPIData[]> => {
  const res = await fetch(`${GAS_WEB_APP_URL}?sheet=kpi`);
  if (!res.ok) throw new Error(`GAS fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error('GAS returned non-array for kpi:', data);
    return [];
  }
  return data;
};
