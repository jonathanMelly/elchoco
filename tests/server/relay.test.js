import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRelay } from '../../server/relay.js';

function fakeMqtt() {
  const m = new EventEmitter();
  m.subscribe = vi.fn();
  m.end = vi.fn();
  return m;
}
function fakeClient() {
  const req = new EventEmitter();
  const res = {
    chunks: [],
    writeHead: vi.fn(),
    write: vi.fn((s) => { res.chunks.push(s); return true; }),
    end: vi.fn(),
  };
  return { req, res, text: () => res.chunks.join('') };
}
const msg = (m, topic, payload, retain = false) => m.emit('message', topic, Buffer.from(payload), { retain });

describe('relay logging', () => {
  it('logs broker connect, disconnect, error and refused subscriptions without leaking anything else', () => {
    const m = fakeMqtt();
    const log = vi.fn();
    const r = createRelay({ mqttClient: m, root: 'elchoco', log });
    m.emit('connect');
    m.emit('close');
    m.emit('error', new Error('Connection refused: Not authorized'));
    const lines = log.mock.calls.map((c) => c[0]);
    expect(lines).toContain('broker connected');
    expect(lines).toContain('broker disconnected');
    expect(lines.some((l) => l.includes('Not authorized'))).toBe(true);
    // subscribe callback: granted qos 128 = refused by the broker
    const cb = m.subscribe.mock.calls[0][2];
    cb(null, [{ topic: 'elchoco/#', qos: 128 }]);
    expect(log.mock.calls.map((c) => c[0]).some((l) => l.includes('subscription refused'))).toBe(true);
    r.close();
  });

  it('does not log a repeated disconnect (close then offline)', () => {
    const m = fakeMqtt();
    const log = vi.fn();
    const r = createRelay({ mqttClient: m, root: 'elchoco', log });
    m.emit('connect');
    m.emit('close');
    m.emit('offline');
    expect(log.mock.calls.filter((c) => c[0] === 'broker disconnected')).toHaveLength(1);
    r.close();
  });
});

describe('createRelay', () => {
  let mqtt, relay;
  beforeEach(() => {
    vi.useFakeTimers();
    mqtt = fakeMqtt();
    relay = createRelay({ mqttClient: mqtt, root: 'elchoco' });
  });
  afterEach(() => { relay.close(); vi.useRealTimers(); });

  it('subscribes to root/# with qos 1 on connect', () => {
    mqtt.emit('connect');
    expect(mqtt.subscribe).toHaveBeenCalledWith('elchoco/#', { qos: 1, rap: true }, expect.any(Function));
  });

  it('subscribes with the configured qos', () => {
    const m = fakeMqtt();
    const r = createRelay({ mqttClient: m, root: 'elchoco', qos: 0 });
    m.emit('connect');
    expect(m.subscribe).toHaveBeenCalledWith('elchoco/#', { qos: 0, rap: true }, expect.any(Function));
    r.close();
  });

  it('handleEvents sends SSE headers and retry', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    expect(c.res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }));
    expect(c.res.chunks[0]).toBe('retry: 2000\n\n');
  });

  it('forwards a message as one data frame', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    msg(mqtt, 'elchoco/time', '{"a":1}');
    expect(c.text()).toContain('data: {"topic":"elchoco/time","payload":"{\\"a\\":1}","retain":false}\n\n');
  });

  it('announces the HUD root as a config event on connect, before any replay', () => {
    const m = fakeMqtt();
    const r = createRelay({ mqttClient: m, root: 'cartel' });
    msg(m, 'cartel/r', 'keep', true);
    const c = fakeClient();
    r.handleEvents(c.req, c.res);
    expect(c.res.chunks[2]).toBe('event: config\ndata: {"root":"cartel"}\n\n');
    expect(c.res.chunks[3]).toContain('cartel/r');
    r.close();
  });

  it('replays retained cache to a new client', () => {
    msg(mqtt, 'elchoco/r', 'keep', true);
    msg(mqtt, 'elchoco/n', 'skip', false);
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    expect(c.res.chunks[1]).toBe('event: broker\ndata: "down"\n\n');
    expect(c.res.chunks[2]).toBe('event: config\ndata: {"root":"elchoco"}\n\n');
    expect(c.res.chunks[3]).toBe('data: {"topic":"elchoco/r","payload":"keep","retain":true}\n\n');
    expect(c.text()).not.toContain('elchoco/n');
  });

  it('empty retained payload clears the cache', () => {
    msg(mqtt, 'elchoco/x', 'x', true);
    const live = fakeClient();
    relay.handleEvents(live.req, live.res);
    msg(mqtt, 'elchoco/x', '', true);
    expect(live.text()).toContain('data: {"topic":"elchoco/x","payload":"","retain":true}');
    const late = fakeClient();
    relay.handleEvents(late.req, late.res);
    expect(late.text()).not.toContain('elchoco/x');
  });

  it('payload with newlines cannot split a frame', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    const before = c.res.chunks.length;
    const payload = 'a\n\ndata: forged\r\n\n';
    msg(mqtt, 'elchoco/t', payload);
    const chunk = c.res.chunks.slice(before).join('');
    expect(chunk.split('\n\n')).toHaveLength(2);
    expect(chunk).not.toContain('\r');
    const line = chunk.trimEnd().replace(/^data: /, '');
    expect(JSON.parse(line).payload).toBe(payload);
  });

  it('client close removes it', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    c.req.emit('close');
    c.res.write.mockClear();
    expect(() => msg(mqtt, 'elchoco/t', 'x')).not.toThrow();
    expect(c.res.write).not.toHaveBeenCalled();
  });

  it('drops a client whose write throws', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    c.res.write.mockImplementation(() => { throw new Error('EPIPE'); });
    expect(() => msg(mqtt, 'elchoco/t', 'x')).not.toThrow();
    c.res.write.mockClear();
    msg(mqtt, 'elchoco/t', 'y');
    expect(c.res.write).not.toHaveBeenCalled();
  });

  it('broker events', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    expect(c.res.chunks[1]).toBe('event: broker\ndata: "down"\n\n');
    c.res.chunks.length = 0;
    mqtt.emit('connect');
    expect(c.text()).toBe('event: broker\ndata: "up"\n\n');
    c.res.chunks.length = 0;
    mqtt.emit('connect');
    expect(c.text()).toBe('');
    mqtt.emit('close');
    expect(c.text()).toBe('event: broker\ndata: "down"\n\n');
    c.res.chunks.length = 0;
    mqtt.emit('offline');
    expect(c.text()).toBe('');
    mqtt.emit('connect');
    const d = fakeClient();
    relay.handleEvents(d.req, d.res);
    expect(d.res.chunks[1]).toBe('event: broker\ndata: "up"\n\n');
  });

  it('heartbeat', () => {
    const c = fakeClient();
    relay.handleEvents(c.req, c.res);
    c.res.chunks.length = 0;
    vi.advanceTimersByTime(20000);
    expect(c.text()).toBe(': ping\n\n');
    relay.close();
    c.res.chunks.length = 0;
    vi.advanceTimersByTime(60000);
    expect(c.text()).toBe('');
    expect(mqtt.end).toHaveBeenCalledWith(true);
    expect(c.res.end).toHaveBeenCalled();
  });
});
