import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { connectBus } from '../../web/src/bus.js';
import { VALID_VITRINE } from './fixtures.js';

function fakeMqtt() {
  const client = new EventEmitter();
  client.subscribe = vi.fn();
  client.end = vi.fn();
  const connect = vi.fn(() => client);
  return { client, mqtt: { connect } };
}

describe('connectBus', () => {
  it('subscribes to root/# on connect and reports status', () => {
    const { client, mqtt } = fakeMqtt();
    const onStatus = vi.fn();
    connectBus({ url: 'ws://x:9001', root: 'elchoco', store: { ingest: vi.fn() }, mqtt, onStatus });
    expect(onStatus).toHaveBeenCalledWith('connecting');
    const [url, opts] = mqtt.connect.mock.calls[0];
    expect(url).toBe('ws://x:9001');
    expect(opts.clientId).toMatch(/^hud-[0-9a-f]+$/);
    expect(opts.reconnectPeriod).toBe(2000);
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith('elchoco/#', { qos: 1 });
    expect(onStatus).toHaveBeenCalledWith('connected');
    client.emit('reconnect');
    expect(onStatus).toHaveBeenCalledWith('reconnecting');
    client.emit('offline');
    expect(onStatus).toHaveBeenCalledWith('offline');
  });

  it('passes username and password to mqtt.connect when set', () => {
    const { mqtt } = fakeMqtt();
    connectBus({ url: 'ws://x', username: 'ict', password: '321', root: 'elchoco', store: { ingest: vi.fn() }, mqtt });
    expect(mqtt.connect.mock.calls[0][1]).toMatchObject({ username: 'ict', password: '321' });
  });

  it('passes no credential keys when absent or empty', () => {
    for (const creds of [{}, { username: '', password: '' }]) {
      const { mqtt } = fakeMqtt();
      connectBus({ url: 'ws://x', ...creds, root: 'elchoco', store: { ingest: vi.fn() }, mqtt });
      const opts = mqtt.connect.mock.calls[0][1];
      expect('username' in opts).toBe(false);
      expect('password' in opts).toBe(false);
    }
  });

  it('decodes messages and passes the retain flag', () => {
    const { client, mqtt } = fakeMqtt();
    const store = { ingest: vi.fn() };
    connectBus({ url: 'ws://x', root: 'elchoco', store, mqtt });
    client.emit('message', 'elchoco/vitrine/maison-dubois', new TextEncoder().encode(VALID_VITRINE), { retain: true });
    expect(store.ingest).toHaveBeenCalledWith('elchoco/vitrine/maison-dubois', VALID_VITRINE, { retain: true });
  });

  it('retain defaults to false without packet', () => {
    const { client, mqtt } = fakeMqtt();
    const store = { ingest: vi.fn() };
    connectBus({ url: 'ws://x', root: 'elchoco', store, mqtt });
    client.emit('message', 'elchoco/time', new TextEncoder().encode('{}'));
    expect(store.ingest.mock.calls[0][2]).toEqual({ retain: false });
  });

  it('does not throw on error and reports offline', () => {
    const { client, mqtt } = fakeMqtt();
    const onStatus = vi.fn();
    connectBus({ url: 'ws://x', root: 'elchoco', store: { ingest: vi.fn() }, mqtt, onStatus });
    expect(() => client.emit('error', new Error('boom'))).not.toThrow();
    expect(onStatus).toHaveBeenCalledWith('offline');
  });

  it('close ends the client', () => {
    const { client, mqtt } = fakeMqtt();
    const bus = connectBus({ url: 'ws://x', root: 'elchoco', store: { ingest: vi.fn() }, mqtt });
    bus.close();
    expect(client.end).toHaveBeenCalledWith(true);
  });
});
