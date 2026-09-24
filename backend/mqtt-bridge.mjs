import { PrismaClient } from '@prisma/client';
import mqtt from 'mqtt';

const prisma = new PrismaClient();

// ─── HiveMQ Public Broker ────────────────────────────────────────────────────
const BROKER_URL  = 'mqtt://broker.hivemq.com:1883';
const TOPIC_DATA_JSON = 'soil/npk/data';      // Old JSON format
const TOPIC_CONTROL   = 'soil/npk/control';
const TOPIC_AGRILINK  = 'agrilink/soil/#';    // New multi-topic format
// ─────────────────────────────────────────────────────────────────────────────

// Buffer to store individual sensor values until a full set arrives
let sensorBuffer = {};
let flushTimeout = null;

async function run() {

  console.log('AgriLink MQTT Bridge starting...');

  // 1. Resolve the IoT device record in Postgres
  let device = await prisma.iotDevice.findFirst({ where: { label: 'Local ESP8266' } });
  if (!device) {
    const farm  = await prisma.farm.findFirst();
    if (!farm) throw new Error('No farm found.');
    device = await prisma.iotDevice.create({
      data: {
        farmId      : farm.id,
        deviceCode  : 'SOIL-001',
        apiKeyHash  : 'mqtt-bridge',
        label       : 'Local ESP8266',
        createdById : farm.ownerId,
      },
    });
  }
  
  let lastPumpMode = device.pumpMode;

  // 2. Connect to HiveMQ
  const client = mqtt.connect(BROKER_URL, {
    clientId  : `agrilink-bridge-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log(`Connected to ${BROKER_URL}`);
    client.subscribe(TOPIC_DATA_JSON);
    client.subscribe(TOPIC_AGRILINK);
  });

  client.on('error', (err) => console.error('[MQTT error]', err.message));

  // 3. Handle incoming sensor data
  client.on('message', async (topic, payload) => {
    const msg = payload.toString();
    
    // --- FORMAT A: Old JSON format ---
    if (topic === TOPIC_DATA_JSON) {
      try {
        const data = JSON.parse(msg);
        const id = data.deviceId ?? data.deviceCode ?? '';
        if (id !== 'FARM-001') return; // ignore colliding messages
        
        await updateOnlineStatus();
        if (data.sensorOk === false) return; // skip if Modbus error

        await saveReading({
          moisturePct: data.moisture ?? null,
          temperatureC: data.temperature ?? null,
          ph: data.ph ?? null,
          nitrogenPpm: data.nitrogen ?? null,
          phosphorusPpm: data.phosphorus ?? null,
          potassiumPpm: data.potassium ?? null,
          pumpState: (data.pump === true || data.pump === 'ON' || data.pumpState === 'ON') ? 'ON' : 'OFF'
        });
      } catch (err) { }
      return;
    }
    
    // --- FORMAT B: New individual topics format (agrilink/soil/#) ---
    if (topic.startsWith('agrilink/soil/')) {
      const subtopic = topic.split('/').pop();
      
      // Update online status for any message
      await updateOnlineStatus();

      if (subtopic === 'moisture')    sensorBuffer.moisturePct = parseFloat(msg);
      if (subtopic === 'temperature') sensorBuffer.temperatureC = parseFloat(msg);
      if (subtopic === 'ph')          sensorBuffer.ph = parseFloat(msg);
      if (subtopic === 'ec')          sensorBuffer.ec = parseInt(msg, 10);
      if (subtopic === 'nitrogen')    sensorBuffer.nitrogenPpm = parseInt(msg, 10);
      if (subtopic === 'phosphorus')  sensorBuffer.phosphorusPpm = parseInt(msg, 10);
      if (subtopic === 'potassium')   sensorBuffer.potassiumPpm = parseInt(msg, 10);
      if (subtopic === 'pump')        sensorBuffer.pumpState = msg;
      if (subtopic === 'status')      sensorBuffer.status = msg;

      // Debounce: Wait 500ms for all topics in the burst to arrive
      if (flushTimeout) clearTimeout(flushTimeout);
      flushTimeout = setTimeout(async () => {
        if (sensorBuffer.status === 'OK') {
          // Pass a copy and clear the global buffer
          const dataToSave = { ...sensorBuffer };
          sensorBuffer = {};
          await saveReading(dataToSave);
        } else if (sensorBuffer.status) {
          console.log(`[${new Date().toLocaleTimeString()}] ESP connected – NPK sensor error (Status: ${sensorBuffer.status}), not storing.`);
          sensorBuffer = {};
        }
      }, 500);
    }
  });

  // Helper to save reading and broadcast to all devices
  async function saveReading(data) {
    try {
      const devices = await prisma.iotDevice.findMany({ where: { status: 'ACTIVE' } });
      for (const dev of devices) {
        await prisma.soilReading.create({
          data: {
            deviceId     : dev.id,
            farmId       : dev.farmId,
            moisturePct  : data.moisturePct ?? null,
            temperatureC : data.temperatureC ?? null,
            ph           : data.ph ?? null,
            nitrogenPpm  : data.nitrogenPpm ?? null,
            phosphorusPpm: data.phosphorusPpm ?? null,
            potassiumPpm : data.potassiumPpm ?? null,
            pumpState    : data.pumpState === 'ON' ? 'ON' : 'OFF',
          },
        });
      }
      console.log(`[${new Date().toLocaleTimeString()}] Broadcast to ${devices.length} devices: ` +
        `M=${data.moisturePct}% T=${data.temperatureC}°C N=${data.nitrogenPpm} P=${data.phosphorusPpm} K=${data.potassiumPpm} Pump=${data.pumpState}`
      );
    } catch (err) {
      console.error('DB save error:', err.message);
    }
  }

  // Helper to keep device online in dashboard
  async function updateOnlineStatus() {
    await prisma.iotDevice.updateMany({
      where: { deviceCode: { in: ['ESP-BEA7', 'ESP-B602', 'ESP-N3QC', 'SOIL-001', 'FARM-001'] } },
      data: { lastSeenAt: new Date() },
    });
  }

  // 4. Poll DB every 2 s — publish pump commands when mode changes
  setInterval(async () => {
    try {
      const fresh = await prisma.iotDevice.findUnique({ where: { id: device.id } });
      if (!fresh || fresh.pumpMode === lastPumpMode) return;

      console.log(`Pump mode: ${lastPumpMode} → ${fresh.pumpMode}`);
      lastPumpMode = fresh.pumpMode;

      if (fresh.pumpMode === 'AUTO') {
        client.publish(TOPIC_CONTROL, 'AUTO');
      } else if (fresh.pumpMode === 'ON') {
        client.publish(TOPIC_CONTROL, 'MANUAL');
        setTimeout(() => client.publish(TOPIC_CONTROL, 'PUMP_ON'), 300);
      } else if (fresh.pumpMode === 'OFF') {
        client.publish(TOPIC_CONTROL, 'MANUAL');
        setTimeout(() => client.publish(TOPIC_CONTROL, 'PUMP_OFF'), 300);
      }
    } catch (err) {}
  }, 2000);
}

run().catch(console.error);
