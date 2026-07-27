import client from '../../shared/api/client';

let cachedCountries = null;

/**
 * Fetch active countries from GET /api/v1/countries.
 * Returns null on failure so callers can fall back to static constants.
 */
export async function fetchCountriesFromApi() {
  if (cachedCountries) return cachedCountries;
  try {
    const { data } = await client.get('/api/v1/countries');
    const list = data?.data;
    if (!Array.isArray(list) || list.length === 0) return null;
    cachedCountries = list;
    return list;
  } catch {
    return null;
  }
}

export function clearCountriesCache() {
  cachedCountries = null;
}
