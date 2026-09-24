import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://broker.hivemq.com:1883');
client.on('connect', () => {
  console.log('Connected. Listening to agrilink/soil/#');
  client.subscribe('agrilink/soil/#');
});

client.on('message', (topic, payload) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${topic} = ${payload.toString()}`);
});

setTimeout(() => process.exit(0), 30000);
