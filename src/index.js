import readline from "node:readline/promises";
import config from './config.js';
import {generateClientId} from './domain/generate-client-id.js';
import {parseCommand} from './domain/parse-command.js';
import {createMqttClient} from './mqtt/mqtt-client.js';
import {globalTopic,privateTopic,presenceTopic} from './mqtt/topics.js';
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const nickname=await rl.question('Nickname: ');
const clientId=generateClientId(nickname);
const client=createMqttClient(config,clientId);
client.on('connect',()=>{
    console.log('Connected as',clientId);
    client.subscribe(globalTopic(config.topicRoot));
    client.subscribe(privateTopic(config.topicRoot,clientId));
    client.publish(presenceTopic(config.topicRoot),JSON.stringify({nickname,clientId,status:'online'}),{retain:true});
});
client.on('message',(t,m)=>console.log(`['+t+']`,m.toString()));

for await (const line of rl){
    const cmd=parseCommand(line);
    if(cmd.type==='quit') break;
    if(cmd.type==='private'){
	console.log("|priv")
	client.publish(privateTopic(config.topicRoot,cmd.target),JSON.stringify({from:nickname,text:cmd.text}));
    } else if(cmd.type==='global'){
	console.log("|glob")
	client.publish(globalTopic(config.topicRoot),JSON.stringify({from:nickname,text:cmd.text}));
    }
}
client.end(); rl.close();
