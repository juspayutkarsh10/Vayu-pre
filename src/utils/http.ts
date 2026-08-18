import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: unknown;
}

export interface HttpResponse {
  status: number;
  data: unknown;
}

class HttpError extends Error {
  response: { data: unknown; status: number };
  constructor(data: unknown, status: number) {
    super(`HTTP ${status}`);
    this.response = { data, status };
  }
}

function parseBody(raw: string, contentType: string): unknown {
  return contentType.includes('application/json') && raw ? JSON.parse(raw) : raw;
}

// Node's fetch (undici) refuses to attach a body to a GET/HEAD request per the
// Fetch spec, but a few of the ported test cases (analytics trackers) genuinely
// need to send one on GET, as axios (raw Node http) previously allowed. Fall
// back to the raw http/https client for just that case — it has no such
// restriction.
function requestWithBody(opts: RequestOptions, body: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(opts.url);
    const client = target.protocol === 'http:' ? http : https;
    const req = client.request(
      target,
      {
        method: opts.method,
        headers: {
          'content-type': 'application/json',
          ...opts.headers,
          'content-length': Buffer.byteLength(body).toString()
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const contentType = (res.headers['content-type'] as string) ?? '';
          let data: unknown;
          try {
            data = parseBody(raw, contentType);
          } catch (parseErr) {
            reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
            return;
          }
          const status = res.statusCode ?? 0;
          if (status >= 400) {
            reject(new HttpError(data, status));
          } else {
            resolve({ status, data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function request(opts: RequestOptions): Promise<HttpResponse> {
  const method = opts.method.toUpperCase();

  if (opts.data !== undefined && (method === 'GET' || method === 'HEAD')) {
    const body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
    return requestWithBody(opts, body);
  }

  const res = await fetch(opts.url, {
    method: opts.method,
    headers:
      opts.data !== undefined
        ? { 'content-type': 'application/json', ...opts.headers }
        : opts.headers,
    body:
      opts.data !== undefined
        ? typeof opts.data === 'string'
          ? opts.data
          : JSON.stringify(opts.data)
        : undefined
  });

  let data: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    throw new HttpError(data, res.status);
  }

  return { status: res.status, data };
}
