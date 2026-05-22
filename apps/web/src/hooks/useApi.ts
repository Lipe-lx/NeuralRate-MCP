import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

interface UseApiOptions {
  method?: 'GET' | 'POST';
  body?: any;
  immediate?: boolean;
}

export function useApi<T = any>(endpoint: string, options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(options.immediate !== false);
  const [error, setError] = useState<Error | null>(null);

  const { method = 'GET', body, immediate = true } = options;

  const execute = useCallback(async (overrideBody?: any) => {
    setLoading(true);
    setError(null);
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const finalBody = overrideBody || body;
      if (finalBody) {
        fetchOptions.body = JSON.stringify(finalBody);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      setData(json);
      return json;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method, body]);

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
  }, [execute, immediate]);

  return { data, loading, error, execute };
}
