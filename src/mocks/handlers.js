import { http, HttpResponse } from 'msw';

export const handlers = [
  // Example handler for health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  })
];
