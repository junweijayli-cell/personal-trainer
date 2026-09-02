import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 500 },
    { duration: '10m', target: 500 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750'],
  },
};

const apiUrl = __ENV.RELAY_API_URL;

export default function relayLoadScenario() {
  if (!apiUrl) throw new Error('Set RELAY_API_URL to the regional get-billing-catalog function URL.');
  const response = http.get(apiUrl, { tags: { surface: 'regional-api' } });
  check(response, { 'regional API responds successfully': (result) => result.status === 200 });
  sleep(1);
}
