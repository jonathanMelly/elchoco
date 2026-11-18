import { describe, it, expect } from 'vitest';
import { brokerOptions } from '../../server/mqtt-options.js';

describe('brokerOptions', () => {
  const cfg = { reconnectPeriod: 5000, username: 'u', password: 'p' };
  it('uses MQTT 5 so retain-as-published keeps the retain flag on live messages', () => {
    expect(brokerOptions(cfg, 'abcd1234').protocolVersion).toBe(5);
  });
  it('sets client id, reconnect period and clean start', () => {
    const o = brokerOptions(cfg, 'abcd1234');
    expect(o).toMatchObject({ clientId: 'hud-relay-abcd1234', reconnectPeriod: 5000, clean: true });
  });
  it('omits credentials when unset', () => {
    const o = brokerOptions({ reconnectPeriod: 1 }, 'x');
    expect(o).not.toHaveProperty('username');
    expect(o).not.toHaveProperty('password');
  });
  it('includes credentials when set', () => {
    expect(brokerOptions(cfg, 'x')).toMatchObject({ username: 'u', password: 'p' });
  });
});
