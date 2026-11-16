const {
  default: makeWASocket, initAuthCreds, BufferJSON, jidNormalizedUser, DisconnectReason
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const WhatsAppAuth = require('../models/WhatsAppAuth');

let socket;
let socketPromise;
let reconnectDelay = 1000;
let reconnectTimer;
let pendingCredentialWrite = Promise.resolve();
let credentialWriteError;
let reconnectEnabled = true;
let connectionStatus = 'disconnected';
let connectionMode = 'qr';
let qrDataUrl = '';
let pairingCode = '';
let linkedNumber = '';
let registeredSession = false;
let logoutWarning = false;
let connectionError = '';
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
  registeredSession = Boolean(creds.registered);
  const savedUserJid = creds.me?.id;
  linkedNumber = savedUserJid ? `+${jidNormalizedUser(savedUserJid).split('@')[0].split(':')[0]}` : '';
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

function saveCredentialUpdate(saveCreds, creds) {
  registeredSession = Boolean(creds.registered);
  pendingCredentialWrite = pendingCredentialWrite.then(async () => {
    await saveCreds();
    credentialWriteError = undefined;
  }).catch((error) => {
    credentialWriteError = error;
    console.error('[whatsapp] failed to persist session credentials:', error.code || error.name);
  });
  return pendingCredentialWrite;
}

async function createSocket() {
  if (socket) return socket;
  if (socketPromise) return socketPromise;

  socketPromise = (async () => {
    const { state, saveCreds } = await mongoAuthState();
    const currentSocket = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });
    socket = currentSocket;
    currentSocket.ev.on('creds.update', () => {
      if (socket === currentSocket) saveCredentialUpdate(saveCreds, state.creds);
    });
    currentSocket.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
      if (socket !== currentSocket) return;
      if (qr && connectionMode === 'qr') {
        connectionStatus = 'qr';
        connectionError = '';
        QRCode.toDataURL(qr, { width: 280, margin: 1 }).then((dataUrl) => {
          if (socket === currentSocket) qrDataUrl = dataUrl;
        }).catch((error) => {
          if (socket !== currentSocket) return;
          connectionStatus = 'error';
          connectionError = 'Could not render a WhatsApp QR code. Try phone-number pairing instead.';
          console.error('[whatsapp] QR rendering failed:', error.code || error.name);
        });
      }
      if (connection === 'open') {
        reconnectDelay = 1000;
        registeredSession = true;
        connectionStatus = 'connected';
        connectionError = '';
        qrDataUrl = '';
        pairingCode = '';
        const userJid = currentSocket.user?.id;
        linkedNumber = userJid ? `+${jidNormalizedUser(userJid).split('@')[0].split(':')[0]}` : '';
        console.log('[whatsapp] connected');
      }
      if (connection === 'close') {
        if (socket === currentSocket) socket = undefined;
        qrDataUrl = '';
        pairingCode = '';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          registeredSession = false;
          connectionStatus = 'disconnected';
          connectionError = 'WhatsApp logged out. Connect the account again from Settings.';
          WhatsAppAuth.deleteMany({}).catch((error) => {
            console.error('[whatsapp] failed to clear logged-out session:', error.code || error.name);
          });
          return;
        }
        connectionStatus = reconnectEnabled && registeredSession ? 'reconnecting' : 'disconnected';
        connectionError = reconnectEnabled && registeredSession
          ? 'WhatsApp connection was interrupted. The API is reconnecting.'
          : 'WhatsApp could not connect. Check the API internet connection and try again.';
        if (reconnectEnabled && registeredSession) scheduleReconnect();
      }
    });
    return currentSocket;
  })();

  try {
    return await socketPromise;
  } finally {
    socketPromise = undefined;
  }
}

function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    registered: registeredSession,
    phoneNumber: linkedNumber,
    qrDataUrl,
    pairingCode,
    logoutWarning,
    connectionError
  };
}

async function startWhatsAppLinking(mode = 'qr') {
  if (!['qr', 'pairing-code'].includes(mode)) {
    const error = new Error('Choose QR or phone-number pairing');
    error.status = 400;
    throw error;
  }
  if (registeredSession || connectionStatus === 'connected') {
    const error = new Error('Disconnect the linked WhatsApp account before pairing another');
    error.status = 409;
    throw error;
  }
  reconnectEnabled = true;
  connectionMode = mode;
  if (socket && ['error', 'disconnected'].includes(connectionStatus)) {
    const staleSocket = socket;
    socket = undefined;
    staleSocket.end(new Error('Replacing failed WhatsApp connection'));
  }
  qrDataUrl = '';
  pairingCode = '';
  logoutWarning = false;
  connectionError = '';
  connectionStatus = 'connecting';
  await createSocket();
  return getWhatsAppStatus();
}

async function requestWhatsAppPairingCode(phoneNumber) {
  const normalizedNumber = String(phoneNumber || '').replace(/[+\s()-]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(normalizedNumber)) {
    const error = new Error('Enter a valid phone number with its country code');
    error.status = 400;
    throw error;
  }
  await startWhatsAppLinking('pairing-code');
  const currentSocket = socket;
  if (!currentSocket) {
    const error = new Error('WhatsApp is still starting. Try requesting the code again.');
    error.status = 503;
    throw error;
  }
  try {
    await currentSocket.waitForSocketOpen();
    const code = await currentSocket.requestPairingCode(normalizedNumber);
    pairingCode = code;
    connectionStatus = 'pairing-code';
    connectionError = '';
    return getWhatsAppStatus();
  } catch (error) {
    connectionError = 'Could not get a pairing code. Check the number and API connection, then try again.';
    connectionStatus = 'error';
    console.error('[whatsapp] pairing code request failed:', error.code || error.name);
    throw error;
  }
}

async function disconnectWhatsApp() {
  reconnectEnabled = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
  if (socketPromise) await socketPromise;
  const currentSocket = socket;
  socket = undefined;
  qrDataUrl = '';
  pairingCode = '';
  linkedNumber = '';
  registeredSession = false;
  connectionStatus = 'disconnected';
  logoutWarning = false;
  connectionError = '';

  if (currentSocket) {
    if (currentSocket.user) {
      try {
        await currentSocket.logout();
      } catch (error) {
        logoutWarning = true;
        console.error('[whatsapp] remote logout failed:', error.code || error.name);
        currentSocket.end(new Error('WhatsApp disconnected by administrator'));
      }
    } else {
      currentSocket.end(new Error('WhatsApp connection cancelled by administrator'));
    }
  }

  await pendingCredentialWrite;
  await WhatsAppAuth.deleteMany({});
  return getWhatsAppStatus();
}

function scheduleReconnect() {
  if (reconnectTimer || !reconnectEnabled) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = undefined;
    try {
      await pendingCredentialWrite;
      if (credentialWriteError) throw credentialWriteError;
      await createSocket();
    } catch (error) {
      console.error('[whatsapp] reconnect failed:', error.code || error.name);
      scheduleReconnect();
    }
  }, delay);
}

async function startWhatsApp() {
  reconnectEnabled = true;
  try {
    const credentialsRow = await WhatsAppAuth.findOne({ key: 'creds' }).lean();
    if (!credentialsRow || !decode(credentialsRow.value).registered) {
      connectionStatus = 'disconnected';
      registeredSession = false;
      connectionError = '';
      return getWhatsAppStatus();
    }
    connectionStatus = 'reconnecting';
    registeredSession = true;
    connectionError = '';
    await createSocket();
    return getWhatsAppStatus();
  } catch (error) {
    connectionStatus = 'error';
    console.error('[whatsapp] startup failed:', error.code || error.name);
    return getWhatsAppStatus();
  }
}

async function sendWhatsAppMessage(_jid, text) {
  try {
    if (!socket || connectionStatus !== 'connected') {
      return { sent: false, error: 'WhatsApp is not connected. Link an account in CMS → General → Settings.' };
    }
    const configuredRecipient = String(_jid || process.env.YOUR_WHATSAPP_JID || '').trim();
    let recipient = socket.user?.id;
    if (configuredRecipient) {
      const digits = configuredRecipient.replace(/[+\s()-]/g, '');
      if (/^[1-9]\d{7,14}$/.test(digits)) recipient = `${digits}@s.whatsapp.net`;
      else if (configuredRecipient.includes('@')) recipient = jidNormalizedUser(configuredRecipient);
      else return { sent: false, error: 'YOUR_WHATSAPP_JID must be a phone number with country code or a WhatsApp JID.' };
    }
    if (!recipient) return { sent: false, error: 'No WhatsApp notification recipient is available.' };
    await socket.sendMessage(recipient, { text });
    return { sent: true };
  } catch (error) {
    console.error('[whatsapp] message send failed:', error.code || error.name);
    return { sent: false, error: 'WhatsApp could not send the message. Check the linked account and recipient setting.' };
  }
}

async function sendWhatsAppTestMessage() {
  return sendWhatsAppMessage(
    process.env.YOUR_WHATSAPP_JID,
    'Portfolio CMS test: WhatsApp notifications are connected.'
  );
}

module.exports = {
  startWhatsApp,
  startWhatsAppLinking,
  requestWhatsAppPairingCode,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppMessage,
  sendWhatsAppTestMessage
};
