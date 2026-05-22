export interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

export interface FredResponse {
  realtime_start: string;
  realtime_end: string;
  observation_start: string;
  observation_end: string;
  units: string;
  output_type: number;
  file_type: string;
  orderBy: string;
  sort_order: string;
  count: number;
  offset: number;
  limit: number;
  observations: FredObservation[];
}

export class FredService {
  constructor(private cacheKv: KVNamespace, private apiKey: string) {}

  /**
   * Fetches the latest 3-Month Treasury Bill Secondary Market Rate (Discount Basis)
   * Series ID: DGS3MO
   */
  async getLatestTBillRate(): Promise<number> {
    if (!this.apiKey || this.apiKey === "COLOQUE_SUA_CHAVE_DO_FRED_AQUI") {
      throw new Error("FRED API Key is missing or invalid.");
    }

    const cacheKey = `fred_tbill_3mo_latest`;
    const cached = await this.cacheKv.get(cacheKey);
    if (cached) {
      return parseFloat(cached);
    }

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS3MO&api_key=${this.apiKey}&file_type=json&sort_order=desc&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FRED API error: ${response.statusText}`);
    }

    const json = (await response.json()) as FredResponse;
    if (!json.observations || json.observations.length === 0) {
      throw new Error("No observations returned from FRED.");
    }

    const latestObservation = json.observations[0];
    const value = parseFloat(latestObservation.value);

    if (isNaN(value)) {
      // Sometimes FRED returns "." for holidays. We should fetch limit=5 and find the first valid number.
      return this.getLatestValidTBillRateFallback();
    }

    // Cache for 1 hour
    await this.cacheKv.put(cacheKey, value.toString(), { expirationTtl: 3600 });
    return value;
  }

  private async getLatestValidTBillRateFallback(): Promise<number> {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS3MO&api_key=${this.apiKey}&file_type=json&sort_order=desc&limit=5`;
    const response = await fetch(url);
    const json = (await response.json()) as FredResponse;
    
    for (const obs of json.observations) {
      const val = parseFloat(obs.value);
      if (!isNaN(val)) {
        return val;
      }
    }
    throw new Error("Could not find a valid T-Bill rate in the recent observations.");
  }
}
