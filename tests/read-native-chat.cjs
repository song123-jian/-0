// Read-only observer for manual/Windows-native attachment acceptance.
const fs = require('node:fs/promises');
const path = require('node:path');
const sessionFile = path.resolve(__dirname, '../release/chat-native-20261024/native-session.json');

async function main() {
  const session = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
  const pages = await fetch(`http://127.0.0.1:${session.port}/json/list`, { signal: AbortSignal.timeout(15000) }).then((response) => response.json());
  const page = pages.find((item) => item.type === 'page');
  if (!page) throw new Error('Native test app is not running.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native observer connection timed out.')), 15000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Native observer connection failed.')); }, { once: true });
    });
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native observer response timed out.')), 15000);
      const failed = (message) => { clearTimeout(timer); reject(new Error(message)); };
      socket.addEventListener('close', () => failed('Native test app closed before responding.'), { once: true });
      socket.addEventListener('error', () => failed('Native observer connection failed.'), { once: true });
      socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error) failed(message.error.message);
        else if (message.result.exceptionDetails) failed(message.result.exceptionDetails.text);
        else resolve(message.result.result.value);
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: `window.scodex.getAppState().then(s=>({
          version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath,
          renderer:[...document.scripts].map(x=>x.src),title:document.title,url:location.href,
          files:[...document.querySelectorAll('.composer-attachment-list .chat-file-card')].map(e=>e.innerText),
          images:document.querySelectorAll('.composer-attachment-list img').length,
          permission:document.querySelector('.composer-permission')?.textContent,
          overlay:Boolean(document.querySelector('.chat-file-drop-overlay')),
          nativeEvents:window.__scodexNativeAttachmentEvents || [],
          notices:[...document.querySelectorAll('.toast')].map(e=>e.textContent),
          input:[...document.querySelectorAll('.composer-box input[type=file]')].map(e=>({label:e.getAttribute('aria-label'),accept:e.accept,multiple:e.multiple,disabled:e.disabled,value:e.value})),
          documentWidth:document.documentElement.scrollWidth,viewport:{width:innerWidth,height:innerHeight}
        }))`, awaitPromise: true, returnByValue: true,
      } }));
    });
    console.log(JSON.stringify(result));
  } finally { socket.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
