import mqtt from 'mqtt';

const BROKER_URL = 'mqtt://broker.hivemq.com:1883';
const TOPIC_DATA = 'soil/npk/data';

const client = mqtt.connect(BROKER_URL, {
  clientId: `debug-listener-${Math.random().toString(16).slice(2, 8)}`,
});

client.on('connect', () => {
  console.log('Connected. Listening to', TOPIC_DATA);
  console.log('Waiting for ESP messages... (will print raw payload)');
  client.subscribe(TOPIC_DATA);
});

client.on('message', (topic, payload) => {
  const raw = payload.toString();
  console.log(`\n[${new Date().toLocaleTimeString()}] RAW:`, raw);
  try {
    const parsed = JSON.parse(raw);
    console.log('PARSED:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('Not valid JSON');
  }
});

client.on('error', (err) => console.error('MQTT error:', err.message));

// Auto-exit after 60s
setTimeout(() => { console.log('Done.'); process.exit(0); }, 60000);
