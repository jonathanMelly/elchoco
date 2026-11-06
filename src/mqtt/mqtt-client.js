import mqtt from "mqtt";
export function createMqttClient(cfg,clientId){
    return mqtt.connect(
	`${cfg.protocol}://${cfg.host}:${cfg.port}`,
	{
	    clientId,
	    clean:false,
	    username: cfg.username || undefined,
	    password: cfg.password || undefined,
	    reconnectPeriod:cfg.reconnectPeriod,
	    will:{
		topic:`${cfg.topicRoot}/presence`,
		payload:JSON.stringify({clientId,status:'offline'}),
		retain:true
	    }
	}
    );}
