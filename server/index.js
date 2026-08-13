require('dotenv').config();
const os = require('os');
const app = require('./app');

const PORT = process.env.PORT || 4173;

app.listen(PORT, () => {
  console.log(`Cart checkout server running at http://localhost:${PORT}`);
  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
  if (lanAddresses.length) {
    console.log('Other devices on the same wifi/network can use:');
    lanAddresses.forEach(addr => console.log(`  http://${addr}:${PORT}`));
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.log('No DATABASE_URL set — using local data.json for storage.');
  }
});
