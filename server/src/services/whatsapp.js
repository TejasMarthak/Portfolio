const {
  default: makeWASocket, initAuthCreds, BufferJSON
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const WhatsAppAuth = require('../models/WhatsAppAuth');

let socket;
let reconnectDelay = 1000;
let reconnectTimer;
const maxReconnectDelay = 60000;

function encode(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function decode(value) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

async function mongoAuthState() {
  const credentialsRow = await WhatsAppAuth.findOne({ key: 'creds' }).lean();
  const creds = credentialsRow ? decode(credentialsRow.value) : initAuthCreds();
  if (!credentialsRow) await WhatsAppAuth.create({ key: 'creds', value: encode(creds) });
  const keys = {
    get: async (type, ids) => {
      const rows = await WhatsAppAuth.find({ key: { $in: ids.map((id) => `${type}:${id}`) } }).lean();
      return Object.fromEntries(rows.map((row) => [row.key.slice(type.length + 1), decode(row.value)]));
    },
    set: async (data) => {
      const writes = [];
      for (const [type, records] of Object.entries(data)) {
        for (const [id, value] of Object.entries(records)) {
          const key = `${type}:${id}`;
          if (value) writes.push(WhatsAppAuth.updateOne({ key }, { $set: { value: encode(value) } }, { upsert: true }));
          else writes.push(WhatsAppAuth.deleteOne({ key }));
        }
      }
      await Promise.all(writes);
    }
  };
  return {
    state: { creds, keys },
    saveCreds: () => WhatsAppAuth.updateOne({ key: 'creds' }, { $set: { value: encode(creds) } }, { upsert: true })
  };
}

async function connect() {
  const { state, saveCreds } = await mongoAuthState();
  socket = makeWASocket({ auth: state, printQRInTerminal: false, markOnlineOnConnect: false });
  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      console.log('[whatsapp] scan this QR code once to link the session:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      reconnectDelay = 1000;
      console.log('[whatsapp] connected');
    }
    if (connection === 'close') scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error) => {
      console.error('[whatsapp] reconnect failed:', error.code || error.name);
      scheduleReconnect();
    });
  }, delay);
}

function startWhatsApp() {
  if (!process.env.YOUR_WHATSAPP_JID) {
    console.warn('[whatsapp] YOUR_WHATSAPP_JID is not configured');
    return;
  }
  connect().catch((error) => {
    console.error('[whatsapp] startup failed:', error.code || error.name);
    scheduleReconnect();
  });
}

async function sendWhatsAppMessage(_jid, text) {
  try {
    if (!socket || !process.env.YOUR_WHATSAPP_JID) return { sent: false };
    await socket.sendMessage(process.env.YOUR_WHATSAPP_JID, { text });
    return { sent: true };
  } catch (error) {
    console.error('[whatsapp] message send failed:', error.code || error.name);
    return { sent: false };
  }
}

module.exports = { startWhatsApp, sendWhatsAppMessage };
