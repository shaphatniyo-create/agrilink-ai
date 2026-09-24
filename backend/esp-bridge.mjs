import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const ESP_URL = 'http://192.168.1.121/data';
const ESP_PUMP_URL = 'http://192.168.1.121/pump';

async function run() {
  console.log('Starting ESP8266 Bridge...');
  
  // 1. Find or create a Farm
  let farm = await prisma.farm.findFirst();
  if (!farm) {
    const user = await prisma.user.findFirst();
    farm = await prisma.farm.create({
      data: {
        name: 'My Local Farm',
        size: 5,
        latitude: -1.94,
        longitude: 30.06,
        ownerId: user.id
      }
    });
  }

  // 2. Find or create an IoT device
  let device = await prisma.iotDevice.findFirst({
    where: { label: 'Local ESP8266' }
  });

  if (!device) {
    device = await prisma.iotDevice.create({
      data: {
        farmId: farm.id,
        deviceCode: 'ESP-' + Math.random().toString(36).substring(7).toUpperCase(),
        apiKeyHash: 'local-bridge',
        label: 'Local ESP8266',
        createdById: farm.ownerId,
      }
    });
    console.log('Created new virtual device:', device.deviceCode);
  } else {
    console.log('Using existing device:', device.deviceCode);
  }

  // 3. Poll loop
  setInterval(async () => {
    try {
      // Refresh device to get latest pumpMode
      device = await prisma.iotDevice.findUnique({ where: { id: device.id } });
      
      // Control pump on ESP if needed (assuming ESP has /pump?state=ON endpoint or similar)
      // If the ESP doesn't have an endpoint to control the pump, we can't control it from here.
      // But we will at least log the mode.

      // Fetch sensor data
      const res = await fetch(ESP_URL);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      // Insert reading
      await prisma.soilReading.create({
        data: {
          deviceId: device.id,
          farmId: farm.id,
          moisturePct: data.moisture,
          temperatureC: data.temperature,
          ph: data.ph,
          nitrogenPpm: data.nitrogen,
          phosphorusPpm: data.phosphorus,
          potassiumPpm: data.potassium,
          pumpState: data.pump ? 'ON' : 'OFF',
        }
      });
      
      // Update last seen
      await prisma.iotDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() }
      });
      
      console.log(`[${new Date().toLocaleTimeString()}] Pushed reading to DB: Moisture=${data.moisture}% Temp=${data.temperature}C`);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Failed to pull from ESP8266:`, err.message);
    }
  }, 10000); // 10 seconds
}

run().catch(console.error);
