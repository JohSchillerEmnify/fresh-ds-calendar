import { mockFetch } from '../helpers';
export function mockFetchConfig(cfg: unknown) {
  return mockFetch({ 'GET /api/config': () => cfg });
}
