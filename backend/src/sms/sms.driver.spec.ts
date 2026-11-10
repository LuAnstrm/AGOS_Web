import { SemaphoreSmsDriver } from './sms.driver';

function fakeFetch(
  handler: (url: string, body: URLSearchParams) => unknown,
  status = 200,
) {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  const impl = ((url: string, init: { body: URLSearchParams }) => {
    calls.push({ url, body: init.body });
    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(handler(url, init.body)),
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('SemaphoreSmsDriver', () => {
  it('uses the priority route for alerts and maps statuses per number', async () => {
    const f = fakeFetch((_url, body) =>
      body
        .get('number')!
        .split(',')
        .map((n, i) => ({
          message_id: 100 + i,
          recipient: n,
          status: i === 1 ? 'Failed' : 'Queued',
        })),
    );
    const d = new SemaphoreSmsDriver('KEY', 'AGOS', f.impl);
    const r = await d.send(
      ['+639171234567', '+639181234567'],
      'AGOS CRITICAL: test',
      true,
    );

    expect(f.calls[0].url).toBe('https://api.semaphore.co/api/v4/priority');
    expect(f.calls[0].body.get('number')).toBe('639171234567,639181234567');
    expect(f.calls[0].body.get('apikey')).toBe('KEY');
    expect(f.calls[0].body.get('sendername')).toBe('AGOS');
    expect(r.map((x) => [x.status, x.providerId])).toEqual([
      ['queued', '100'],
      ['failed', '101'],
    ]);
  });

  it('broadcasts use the bulk route in batches of 1000', async () => {
    const f = fakeFetch((_u, body) =>
      body
        .get('number')!
        .split(',')
        .map((n) => ({ recipient: n, status: 'Pending' })),
    );
    const d = new SemaphoreSmsDriver('KEY', undefined, f.impl);
    const phones = Array.from(
      { length: 2500 },
      (_, i) => `+63917${String(i).padStart(7, '0')}`,
    );
    const r = await d.send(phones, 'hello', false);
    expect(f.calls.map((c) => c.url)).toEqual(
      Array(3).fill('https://api.semaphore.co/api/v4/messages'),
    );
    expect(f.calls.map((c) => c.body.get('number')!.split(',').length)).toEqual(
      [1000, 1000, 500],
    );
    expect(r).toHaveLength(2500);
  });

  it('OTP goes to the OTP route with our own code', async () => {
    const f = fakeFetch(() => [
      { recipient: '639171234567', status: 'Queued', code: 123456 },
    ]);
    const d = new SemaphoreSmsDriver('KEY', undefined, f.impl);
    await d.sendOtp('+639171234567', 'Code {otp}', '123456');
    expect(f.calls[0].url).toBe('https://api.semaphore.co/api/v4/otp');
    expect(f.calls[0].body.get('code')).toBe('123456');
  });

  it('an HTTP error marks every number failed instead of throwing', async () => {
    const f = fakeFetch(() => ({}), 500);
    const d = new SemaphoreSmsDriver('KEY', undefined, f.impl);
    const r = await d.send(['+639171234567'], 'x', true);
    expect(r[0]).toMatchObject({ status: 'failed', error: 'HTTP 500' });
  });
});
