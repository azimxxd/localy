import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP = process.env.LOCALY_CDP_URL ?? 'http://127.0.0.1:9222';
const APP = process.env.LOCALY_APP_URL ?? 'http://127.0.0.1:3011';
let browserProcess = null;
let appProcess = null;
const testDataDir = mkdtempSync(join(tmpdir(), 'localy-e2e-'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureChrome() {
  try { if ((await fetch(`${CDP}/json/version`)).ok) return; } catch {}
  const executable = process.env.CHROME_BIN ?? 'google-chrome';
  browserProcess = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222', `--user-data-dir=/tmp/localy-e2e-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(100);
    try { if ((await fetch(`${CDP}/json/version`)).ok) return; } catch {}
  }
  throw new Error('Headless Chrome не запустился');
}

async function ensureApp() {
  try { if ((await fetch(`${APP}/login`)).ok) return; } catch {}
  const port = new URL(APP).port || '3011';
  appProcess = spawn('./node_modules/.bin/next', ['start', '-p', port], { cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, LOCALY_DATA_FILE: join(testDataDir, 'localy.json') } });
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await sleep(100);
    try { if ((await fetch(`${APP}/login`)).ok) return; } catch {}
  }
  throw new Error('Localy не запустился на localhost:3000');
}

async function createClient() {
  const target = await fetch(`${CDP}/json/new?${encodeURIComponent(`${APP}/login`)}`, { method: 'PUT' }).then((response) => {
    if (!response.ok) throw new Error(`Chrome CDP недоступен: ${response.status}`);
    return response.json();
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  return { send, close: () => socket.close() };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(client, path) {
  await client.send('Page.navigate', { url: `${APP}${path}` });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(100);
    const ready = await evaluate(client, `document.readyState === 'complete'`);
    if (ready) return;
  }
  throw new Error(`Таймаут загрузки ${path}`);
}

async function waitForPath(client, path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(100);
    const current = await evaluate(client, 'location.pathname');
    if (current === path) return;
  }
  throw new Error(`Ожидался переход на ${path}`);
}

async function waitForText(client, text) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(100);
    const body = await evaluate(client, 'document.body.innerText');
    if (body.toLocaleLowerCase('ru').includes(text.toLocaleLowerCase('ru'))) return;
  }
  throw new Error(`На странице не появился текст: ${text}`);
}

async function login(client, login, destination) {
  await client.send('Network.clearBrowserCookies');
  await navigate(client, '/login');
  const submitted = await evaluate(client, `(() => {
    const login = document.querySelector('input[name="login"]');
    const password = document.querySelector('input[name="password"]');
    const form = login?.form;
    if (!login || !password || !form) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(login, ${JSON.stringify(login)}); login.dispatchEvent(new Event('input', { bubbles: true }));
    set.call(password, 'Localy2026'); password.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit(); return true;
  })()`);
  if (!submitted) throw new Error('Форма входа не найдена');
  await waitForPath(client, destination);
}

async function assertPage(client, path, marker) {
  await navigate(client, path);
  const page = await evaluate(client, `({ path: location.pathname, text: document.body.innerText, errors: [...document.querySelectorAll('nextjs-portal')].length })`);
  if (page.path === '/login' || page.path === '/forbidden') throw new Error(`${path}: неверные права (${page.path})`);
  if (!page.text.toLocaleLowerCase('ru').includes(marker.toLocaleLowerCase('ru')) || page.text.includes('Application error')) throw new Error(`${path}: нет маркера «${marker}» или есть runtime error; path=${page.path}, text=${page.text.slice(0, 500)}`);
}

await ensureApp();
await ensureChrome();
const client = await createClient();
try {
  const results = [];
  await login(client, 'owner@localy.kz', '/dashboard');
  for (const [path, marker] of [
    ['/dashboard', 'Что хотите сделать?'],
    ['/dashboard/crm', 'Клиенты'],
    ['/dashboard/promos', 'Акции'],
    ['/dashboard/campaigns', 'Рассылки'],
    ['/dashboard/site', 'Сайт бизнеса'],
    ['/dashboard/analytics', 'Аналитика'],
    ['/dashboard/subscription', 'Тариф'],
  ]) { await assertPage(client, path, marker); results.push(`owner ${path}`); }
  await assertPage(client, '/dashboard/crm?activity=at_risk', 'Под риском'); results.push('activity segment');

  await navigate(client, '/onboarding');
  const onboardingSubmitted = await evaluate(client, `(() => {
    const form = document.querySelector('form'); if (!form) return false;
    const setInput = (name, value) => { const input = form.elements.namedItem(name); if (!input) return; const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
    setInput('name', 'Кофейня E2E'); setInput('typeCode', 'coffee'); setInput('city', 'Алматы'); setInput('address', 'ул. Тестовая, 11'); setInput('employeeCount', '3'); setInput('branchCount', '1'); setInput('avgCheck', '2800'); setInput('offerings', 'Капучино, Круассан'); setInput('repeatVisitDays', '7');
    [...form.querySelectorAll('input[name="goals"]')].forEach((input) => { input.checked = ['create_site','return_customers','launch_loyalty'].includes(input.value); });
    form.requestSubmit(); return true;
  })()`);
  if (!onboardingSubmitted) throw new Error('Онбординг не найден');
  await waitForText(client, 'План роста для');
  const newPublicPath = await evaluate(client, `document.querySelector('a[href^="/b/"]')?.getAttribute('href')`);
  if (!newPublicPath) throw new Error('Онбординг не создал публичный сайт');
  results.push('onboarding + growth plan');
  await assertPage(client, '/dashboard/qr', 'QR-код бизнеса'); results.push('business QR');

  await navigate(client, '/dashboard/staff');
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('пригласить'))?.click()`);
  await waitForText(client, 'Новый сотрудник');
  const staffSubmitted = await evaluate(client, `(() => { const heading = [...document.querySelectorAll('h2')].find((node) => node.innerText.toLocaleLowerCase('ru').includes('новый сотрудник')); const card = heading?.parentElement; const inputs = card?.querySelectorAll('input'); if (!inputs || inputs.length < 3) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; ['Кассир E2E','e2e-cashier@localy.kz','Localy2026'].forEach((value, index) => { set.call(inputs[index], value); inputs[index].dispatchEvent(new Event('input', { bubbles: true })); }); [...card.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('создать доступ'))?.click(); return true; })()`);
  if (!staffSubmitted) throw new Error('Не удалось заполнить приглашение кассира');
  await waitForText(client, 'Сотрудник приглашён'); results.push('staff invite');

  await client.send('Network.clearBrowserCookies');
  const joinPath = newPublicPath.replace('/b/', '/join/');
  await navigate(client, joinPath);
  const joined = await evaluate(client, `(() => { const form = document.querySelector('form'); if (!form) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); set.call(name, 'Тестовый Клиент'); name.dispatchEvent(new Event('input', { bubbles: true })); set.call(phone, '+7 700 555 20 31'); phone.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!joined) throw new Error('Форма вступления не найдена');
  await waitForPath(client, '/me'); await waitForText(client, 'Ваш QR действует во всех заведениях'); results.push('customer join + universal QR');

  await login(client, 'e2e-cashier@localy.kz', '/pos');
  const foundClient = await evaluate(client, `(() => { const input = document.querySelector('input[placeholder*="QR"]'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, '+7 700 555 20 31'); input.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('найти клиента'))?.click(); return true; })()`);
  if (!foundClient) throw new Error('Поиск клиента в кассе не найден');
  await waitForText(client, 'Тестовый Клиент');
  await evaluate(client, `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const amount = document.querySelector('input[placeholder="2400"]'); const items = document.querySelector('input[placeholder*="Капучино"]'); set.call(amount, '3500'); amount.dispatchEvent(new Event('input', { bubbles: true })); set.call(items, 'Капучино, Круассан'); items.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('провести'))?.click(); })()`);
  await waitForText(client, 'Покупка проведена'); results.push('POS purchase + points');

  await login(client, 'owner@localy.kz', '/dashboard');
  await assertPage(client, '/dashboard/crm', 'Тестовый Клиент'); results.push('purchase in CRM');
  await navigate(client, '/dashboard/campaigns');
  const campaignStarted = await evaluate(client, `(() => { const textarea = document.querySelector('textarea'); if (!textarea) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(textarea, '{name}, вернитесь за бонусами!'); textarea.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('запустить рассылку'))?.click(); return true; })()`);
  if (!campaignStarted) throw new Error('Конструктор рассылки не найден');
  await waitForText(client, 'Отправлено на'); results.push('campaign send + result');
  await assertPage(client, '/dashboard/analytics', 'Выручка'); results.push('analytics after purchase');

  await login(client, 'cashier@localy.kz', '/pos');
  await assertPage(client, '/pos', 'Касса'); results.push('cashier /pos');
  await navigate(client, '/dashboard');
  if (await evaluate(client, 'location.pathname') !== '/forbidden') throw new Error('Кассир получил доступ к dashboard');
  results.push('cashier RBAC');

  await login(client, 'platform@localy.kz', '/admin');
  await assertPage(client, '/admin', 'Админ платформы'); results.push('platform /admin');
  const templateTitle = `E2E шаблон ${Date.now()}`;
  const templateEditing = await evaluate(client, `(() => { const section = [...document.querySelectorAll('section')].find((node) => node.querySelector('h2')?.innerText.toLocaleLowerCase('ru').startsWith('шаблоны')); const button = [...(section?.querySelectorAll('button') ?? [])].find((node) => node.innerText.trim() === 'Изменить'); button?.click(); return Boolean(button); })()`);
  if (!templateEditing) throw new Error('Редактор шаблона в админке не найден');
  await sleep(800);
  const templateSaved = await evaluate(client, `(() => { const section = [...document.querySelectorAll('section')].find((node) => node.querySelector('h2')?.innerText.toLocaleLowerCase('ru').startsWith('шаблоны')); const buttons = [...(section?.querySelectorAll('button') ?? [])]; const save = buttons.find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'сохранить'); const editor = save?.parentElement?.parentElement; const input = editor?.querySelector('input'); if (!save || !input) return { ok: false, buttons: buttons.map((node) => node.innerText.trim()).slice(0, 12), text: section?.innerText.slice(0, 300) }; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, ${JSON.stringify(templateTitle)}); input.dispatchEvent(new Event('input', { bubbles: true })); save.click(); return { ok: true }; })()`);
  if (!templateSaved.ok) throw new Error(`Не удалось изменить шаблон в админке: ${JSON.stringify(templateSaved)}`);
  await waitForText(client, templateTitle); results.push('admin template update');

  await client.send('Network.clearBrowserCookies');
  await assertPage(client, '/discover', 'Заведения на платформе'); results.push('public /discover');
  const publicPath = await evaluate(client, `document.querySelector('a[href^="/b/"]')?.getAttribute('href')`);
  if (!publicPath) throw new Error('В каталоге нет публичного бизнеса');
  await assertPage(client, publicPath, 'Получить бонусную карту'); results.push(`public ${publicPath}`);
  const leadSubmitted = await evaluate(client, `(() => { const message = document.querySelector('textarea[name="message"]'); const form = message?.form; if (!message || !form) return false; const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const setArea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); setInput.call(name, 'Лид E2E'); name.dispatchEvent(new Event('input', { bubbles: true })); setInput.call(phone, '+7 700 777 88 99'); phone.dispatchEvent(new Event('input', { bubbles: true })); setArea.call(message, 'Хочу узнать о заказе'); message.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!leadSubmitted) throw new Error('Публичная форма заявки не найдена');
  await waitForText(client, 'Заявка отправлена'); results.push('public lead form');

  console.log(`E2E smoke OK (${results.length}):\n- ${results.join('\n- ')}`);
} finally {
  client.close();
  browserProcess?.kill('SIGTERM');
  appProcess?.kill('SIGTERM');
  rmSync(testDataDir, { recursive: true, force: true });
}
