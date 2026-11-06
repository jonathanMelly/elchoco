import dotenv from "dotenv";

dotenv.config();
export default {
    host: process.env.MQTT_HOST || 'localhost',
    port: Number(process.env.MQTT_PORT || 1883),
    protocol: process.env.MQTT_PROTOCOL || 'mqtt',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    topicRoot: process.env.TOPIC_ROOT || 'chat',
    reconnectPeriod: Number(process.env.RECONNECT_PERIOD || 5000)
};
