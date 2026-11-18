// MQTT 5 is required for retain-as-published: on 3.1.1 brokers clear the RETAIN flag on live messages,
// which would keep the relay's retained cache stale.
export function brokerOptions(config, suffix, { will } = {}) {
  return {
    clientId: `hud-relay-${suffix}`,
    protocolVersion: 5,
    reconnectPeriod: config.reconnectPeriod,
    clean: true,
    ...(will && { will }),
    ...(config.username && { username: config.username }),
    ...(config.password && { password: config.password }),
  };
}
