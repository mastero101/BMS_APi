const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  locationId: process.env.FIREBASE_LOCATION_ID,
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Validación de configuración
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} no está definido en el archivo .env`);
    process.exit(1);
  }
}

// Inicializar Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const USER_PATH = "/UsersData/N5GOhtaSNhOkN2eXtA0sMhWss4I2/readings";

// Ruta para verificar el estado del servidor
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Ruta para obtener voltajes actuales
app.get('/api/voltages', async (req, res) => {
  try {
    const voltagesRef = ref(database, USER_PATH);
    const snapshot = await get(voltagesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const voltages = {
        voltage1: data.Voltage || "0",
        voltage2: data.Voltage2 || "0",
        voltage3: data.Voltage3 || "0",
        total: parseFloat(data.Voltage || 0) + 
               parseFloat(data.Voltage2 || 0) + 
               parseFloat(data.Voltage3 || 0),
        timestamp: Date.now()
      };
      res.json(voltages);
    } else {
      res.status(404).json({ error: 'No se encontraron datos' });
    }
  } catch (error) {
    console.error('Error al obtener voltajes:', error);
    res.status(500).json({ error: 'Error al obtener datos de Firebase' });
  }
});

// Ruta para obtener datos históricos
app.get('/api/voltages/history', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const timeLimit = Date.now() - (hours * 60 * 60 * 1000);
    
    const historyRef = ref(database, `${USER_PATH}/history`);
    const snapshot = await get(historyRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const history = Object.entries(data)
        .map(([key, value]) => ({
          timestamp: value.timestamp,
          ...value.voltages
        }))
        .filter(entry => entry.timestamp > timeLimit)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      res.json(history);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Ruta para obtener estadísticas
app.get('/api/voltages/stats', async (req, res) => {
  try {
    const historyRef = ref(database, `${USER_PATH}/history`);
    const snapshot = await get(historyRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const readings = Object.values(data)
        .map(entry => ({
          voltage1: parseFloat(entry.voltages.voltage1 || 0),
          voltage2: parseFloat(entry.voltages.voltage2 || 0),
          voltage3: parseFloat(entry.voltages.voltage3 || 0)
        }))
        .slice(-100); // Últimas 100 lecturas
      
      const stats = {
        averages: {
          voltage1: calculateAverage(readings.map(r => r.voltage1)),
          voltage2: calculateAverage(readings.map(r => r.voltage2)),
          voltage3: calculateAverage(readings.map(r => r.voltage3))
        },
        max: {
          voltage1: Math.max(...readings.map(r => r.voltage1)),
          voltage2: Math.max(...readings.map(r => r.voltage2)),
          voltage3: Math.max(...readings.map(r => r.voltage3))
        },
        min: {
          voltage1: Math.min(...readings.map(r => r.voltage1)),
          voltage2: Math.min(...readings.map(r => r.voltage2)),
          voltage3: Math.min(...readings.map(r => r.voltage3))
        },
        timestamp: Date.now()
      };
      
      res.json(stats);
    } else {
      res.status(404).json({ error: 'No se encontraron datos históricos' });
    }
  } catch (error) {
    console.error('Error al calcular estadísticas:', error);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

function calculateAverage(values) {
  if (values.length === 0) return "0.00";
  const sum = values.reduce((a, b) => a + b, 0);
  return (sum / values.length).toFixed(2);
}

// Manejo de errores general
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log(`Firebase configurado para: ${process.env.FIREBASE_PROJECT_ID}`);
});