import dotenv from "dotenv";

dotenv.config();

const qos = Number(process.env.QOS);

export default {
    host: process.env.MQTT_HOST || 'localhost',
    port: Number(process.env.MQTT_PORT || 1883),
    protocol: process.env.MQTT_PROTOCOL || 'mqtt',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    topicRoot: process.env.TOPIC_ROOT || 'chat',
    reconnectPeriod: Number(process.env.RECONNECT_PERIOD || 5000),
    qos: [0, 1, 2].includes(qos) && process.env.QOS !== '' ? qos : 1,
    hudRoot: process.env.HUD_ROOT || 'elchoco',
    hudHost: process.env.HUD_HOST || '127.0.0.1',
    hudPort: Number(process.env.HUD_PORT || 3000),
    // Slug of the family this HUD backend publishes for (vitrine, presence, heartbeat); empty = publish nothing.
    hudFamily: process.env.HUD_FAMILY || ''
};
