import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP = process.env.LOCALY_CDP_URL ?? 'http://127.0.0.1:9222';
const APP = process.env.LOCALY_APP_URL ?? 'http://127.0.0.1:3011';
let browserProcess = null;
let appProcess = null;
const testDataDir = mkdtempSync(join(tmpdir(), 'localy-e2e-'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CRON_SECRET = 'localy-e2e-cron-secret';
/** Куда складывать мобильные скриншоты. Пусто — снимки не делаются. */
const SHOT_DIR = process.env.LOCALY_MOBILE_SHOTS ?? '';

/** Chrome лежит в разных местах: на Windows — Program Files, на macOS — /Applications. */
function defaultChromePath() {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env['PROGRAMFILES'] ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['LOCALAPPDATA'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? 'chrome.exe';
  }
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome';
}

async function ensureChrome() {
  try { if ((await fetch(`${CDP}/json/version`)).ok) return; } catch {}
  const executable = process.env.CHROME_BIN ?? defaultChromePath();
  browserProcess = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222', `--user-data-dir=${join(tmpdir(), `localy-e2e-${process.pid}`)}`, 'about:blank'], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(100);
    try { if ((await fetch(`${CDP}/json/version`)).ok) return; } catch {}
  }
  throw new Error('Headless Chrome не запустился');
}

async function ensureApp() {
  try { if ((await fetch(`${APP}/login`)).ok) return; } catch {}
  const port = new URL(APP).port || '3011';
  // Запускаем next через node напрямую: shim .bin/next на Windows — это .cmd,
  // и spawn без shell его не находит.
  appProcess = spawn(process.execPath, [join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port], { cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, LOCALY_DATA_FILE: join(testDataDir, 'localy.json'), LOCALY_SESSION_SECRET: 'localy-e2e-session-secret-at-least-32-characters', LOCALY_ALLOW_DEV_OTP: 'true', LOCALY_SECURE_COOKIES: 'false', LOCALY_CRON_SECRET: CRON_SECRET } });
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

async function waitForDifferentPath(client, previous) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(100);
    const current = await evaluate(client, 'location.pathname');
    if (current !== previous) return current;
  }
  throw new Error(`Ожидался переход с ${previous}`);
}

async function waitForText(client, text) {
  let lastBody = '';
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(100);
    lastBody = await evaluate(client, 'document.body.innerText');
    if (lastBody.toLocaleLowerCase('ru').includes(text.toLocaleLowerCase('ru'))) return;
  }
  throw new Error(`На странице не появился текст: ${text}; body=${lastBody.slice(-1200)}`);
}

async function login(client, login, destination, accountPassword = 'Localy2026') {
  await client.send('Network.clearBrowserCookies');
  await navigate(client, '/login');
  const submitted = await evaluate(client, `(() => {
    const login = document.querySelector('input[name="login"]');
    const password = document.querySelector('input[name="password"]');
    const form = login?.form;
    if (!login || !password || !form) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(login, ${JSON.stringify(login)}); login.dispatchEvent(new Event('input', { bubbles: true }));
    set.call(password, ${JSON.stringify(accountPassword)}); password.dispatchEvent(new Event('input', { bubbles: true }));
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
  await navigate(client, '/');
  await waitForText(client, 'Вход для бизнеса');
  await waitForText(client, 'Для клиентов');
  results.push('separate business/customer entry points');
  await login(client, 'owner@localy.kz', '/dashboard');
  const businessShellText = await evaluate(client, 'document.body.innerText');
  if (businessShellText.includes('Кабинет клиента') || businessShellText.includes('Мои карты')) throw new Error('Клиентская навигация попала в бизнес-панель');
  results.push('business shell has no personal customer area');
  for (const [path, marker] of [
    ['/dashboard', 'Что хотите сделать?'],
    ['/dashboard/crm', 'Клиенты'],
    ['/dashboard/promos', 'Акции'],
    ['/dashboard/campaigns', 'Рассылки'],
    ['/dashboard/site', 'Сайт бизнеса'],
    ['/dashboard/analytics', 'Аналитика'],
    ['/dashboard/subscription', 'Тариф'],
  ]) { await assertPage(client, path, marker); results.push(`owner ${path}`); }
  if (process.env.LOCALY_MOBILE_SCREENSHOT) {
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(client, '/dashboard');
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(process.env.LOCALY_MOBILE_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    await client.send('Emulation.clearDeviceMetricsOverride');
  }
  await assertPage(client, '/dashboard/crm?activity=at_risk', 'Под риском'); results.push('activity segment');

  await navigate(client, '/tools');
  await waitForText(client, 'Рабочие модули и сценарии');
  const socialToolReady = await evaluate(client, `(() => { const card = document.querySelector('[data-tool-id="tool_social"]'); if (!card) return false; const add = [...card.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('добавить в мои')); if (add) add.click(); return true; })()`);
  if (!socialToolReady) throw new Error('Шаблоны соцсетей отсутствуют в каталоге');
  for (let attempt = 0; attempt < 100; attempt += 1) { await sleep(100); if (await evaluate(client, `Boolean(document.querySelector('[data-tool-id="tool_social"] a[href="/tools/tool_social"]'))`)) break; }
  const socialHref = await evaluate(client, `document.querySelector('[data-tool-id="tool_social"] a[href="/tools/tool_social"]')?.getAttribute('href')`);
  if (socialHref !== '/tools/tool_social') throw new Error('Активация не открыла рабочий модуль соцсетей');
  await assertPage(client, socialHref, 'Скопировать');
  await assertPage(client, '/tools/tool_upsell', 'Подсказка');
  results.push('tool catalog activation + social templates + data-driven upsell');

  await navigate(client, '/onboarding');
  const expectedPresets = {
    coffee: ['Капучино', '2500', '5', 'Instagram'],
    barber: ['Мужская стрижка', '7000', '28', 'Telegram'],
    beauty: ['Маникюр', '12000', '24', 'Instagram'],
    flower: ['Авторский букет', '15000', '18', 'Telegram'],
    retail: ['Худи', '10000', '16', 'TikTok'],
    repair: ['Диагностика', '18000', '120', 'Telegram'],
  };
  for (const [typeCode, expected] of Object.entries(expectedPresets)) {
    await evaluate(client, `(() => { const select = document.querySelector('select[name="typeCode"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(select, ${JSON.stringify(typeCode)}); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(80);
    const preset = await evaluate(client, `(() => { const form = document.querySelector('form'); return [form.elements.namedItem('offerings').value, form.elements.namedItem('avgCheck').value, form.elements.namedItem('repeatVisitDays').value, form.elements.namedItem('socials').value]; })()`);
    if (!expected.every((value, index) => preset[index].includes(value))) throw new Error(`Неверный пресет ${typeCode}: ${JSON.stringify(preset)}`);
  }
  await evaluate(client, `(() => { const select = document.querySelector('select[name="typeCode"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(select, 'barber'); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(80);
  results.push('all six category presets');
  const onboardingSubmitted = await evaluate(client, `(() => {
    const form = document.querySelector('form'); if (!form) return false;
    const setInput = (name, value) => { const input = form.elements.namedItem(name); if (!input) return; const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
    setInput('name', 'Барбершоп E2E'); setInput('city', 'Алматы'); setInput('address', 'ул. Тестовая, 11'); setInput('employeeCount', '3'); setInput('branchCount', '1'); setInput('socials', 'Instagram: @e2e_barber, WhatsApp: +7 700 123 45 67, Telegram: @e2e_barber, TikTok: @e2e_barber, 2GIS');
    [...form.querySelectorAll('input[name="goals"]')].forEach((input) => { input.checked = ['create_site','return_customers','launch_loyalty'].includes(input.value); });
    form.requestSubmit(); return true;
  })()`);
  if (!onboardingSubmitted) throw new Error('Онбординг не найден');
  await waitForText(client, 'План роста для');
  const newPublicPath = await evaluate(client, `document.querySelector('a[href^="/b/"]')?.getAttribute('href')`);
  if (!newPublicPath) throw new Error('Онбординг не создал публичный сайт');
  await assertPage(client, newPublicPath, 'Мужская стрижка');
  await waitForText(client, 'Онлайн-запись');
  await waitForText(client, 'Telegram');
  const socialHrefs = await evaluate(client, `[...document.querySelectorAll('a')].map((node) => node.href)`);
  for (const expected of ['instagram.com/e2e_barber', 'wa.me/77001234567', 't.me/e2e_barber', 'tiktok.com/@e2e_barber']) if (!socialHrefs.some((href) => href.includes(expected))) throw new Error(`Соцсеть не распознана: ${expected}`);
  results.push('barbershop onboarding + exact growth plan + published site');

  const siteDescription = `Описание E2E ${Date.now()}`;
  const catalogTitle = `Капучино E2E ${Date.now()}`;
  const sectionTitle = `О проекте E2E ${Date.now()}`;
  const catalogHeading = `Услуги E2E ${Date.now()}`;
  const catalogCategory = 'Ужас';
  const sitePhone = '+7 700 123 45 67';
  const siteColor = '#a13f55';
  await navigate(client, '/dashboard/site');
  await waitForText(client, 'Живой предпросмотр');
  const siteEdited = await evaluate(client, `(() => {
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const setArea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    const description = document.querySelector('textarea');
    const color = document.querySelector('input[type="color"]');
    const font = [...document.querySelectorAll('select')].find((select) => select.parentElement?.innerText.includes('Шрифт сайта'));
    if (!description || !color || !font) return 'foundation-missing';
    setArea.call(description, ${JSON.stringify(siteDescription)}); description.dispatchEvent(new Event('input', { bubbles: true }));
    setInput.call(color, ${JSON.stringify(siteColor)}); color.dispatchEvent(new Event('input', { bubbles: true })); color.dispatchEvent(new Event('change', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(font, 'editorial'); font.dispatchEvent(new Event('change', { bubbles: true }));
    const phone = [...document.querySelectorAll('label')].find((label) => label.textContent.trim().startsWith('Телефон'))?.querySelector('input');
    if (!phone) return 'phone-missing'; setInput.call(phone, ${JSON.stringify(sitePhone)}); phone.dispatchEvent(new Event('input', { bubbles: true }));
    const fileInputs = [...document.querySelectorAll('input[type="file"]')]; const logoInput = fileInputs[0]; const coverInput = fileInputs[1]; if (!logoInput || !coverInput) return 'assets-missing';
    const binary = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'e2e-logo.png', { type: 'image/png' })); logoInput.files = transfer.files; logoInput.dispatchEvent(new Event('change', { bubbles: true }));
    const coverTransfer = new DataTransfer(); coverTransfer.items.add(new File([bytes], 'e2e-cover.png', { type: 'image/png' })); coverInput.files = coverTransfer.files; coverInput.dispatchEvent(new Event('change', { bubbles: true }));
    const catalogSummary = [...document.querySelectorAll('summary')].find((node) => node.innerText.toLocaleLowerCase('ru').startsWith('каталог'));
    const details = catalogSummary?.parentElement; if (!details) return 'catalog-missing'; details.open = true;
    [...details.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Добавить')?.click();
    return 'ok';
  })()`);
  if (siteEdited !== 'ok') throw new Error(`Редактор сайта не найден: ${siteEdited}`);
  await sleep(500);
  if (!(await evaluate(client, `Boolean(document.querySelector('[aria-label="Логотип"]'))`))) throw new Error('Логотип не появился в живом предпросмотре');
  if (!(await evaluate(client, `document.querySelector('[data-site-preview-hero]')?.style.backgroundImage.includes('data:image')`))) throw new Error('Обложка не появилась в живом предпросмотре');
  const sectionEdited = await evaluate(client, `(() => { const label = [...document.querySelectorAll('label')].find((node) => node.textContent.trim() === 'О нас'); const input = label?.parentElement?.querySelector('input:not([type="checkbox"])'); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(sectionTitle)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (!sectionEdited) throw new Error('Секции сайта не редактируются');
  const catalogEdited = await evaluate(client, `(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const headingLabel = [...document.querySelectorAll('label')].find((label) => label.textContent.includes('Заголовок каталога')); const heading = headingLabel?.querySelector('input'); if (!heading) return false; set.call(heading, ${JSON.stringify(catalogHeading)}); heading.dispatchEvent(new Event('input', { bubbles: true }));
    const values = [['Название позиции', ${JSON.stringify(catalogTitle)}], ['Цена', '2400'], ['Категория', ${JSON.stringify(catalogCategory)}], ['Описание', 'Проверенная позиция каталога']];
    for (const [label, value] of values) { const input = document.querySelector('input[aria-label="' + label + '"]'); if (!input) return false; set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  })()`);
  if (!catalogEdited) throw new Error('Каталог сайта не редактируется');
  await waitForText(client, catalogTitle);
  await waitForText(client, catalogHeading);
  await waitForText(client, catalogCategory);
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.trim().toLocaleLowerCase('ru') === 'опубликовать')?.click()`);
  await waitForText(client, 'Сайт опубликован и данные сохранены');
  await assertPage(client, newPublicPath, siteDescription);
  await waitForText(client, catalogTitle);
  await waitForText(client, catalogHeading);
  await waitForText(client, catalogCategory);
  await waitForText(client, sectionTitle);
  await waitForText(client, sitePhone);
  if (!(await evaluate(client, `Boolean(document.querySelector('[aria-label="Логотип"]'))`))) throw new Error('Логотип не появился на опубликованном сайте');
  const publicTheme = await evaluate(client, `(() => { const themed = document.querySelector('[style*="--color-brand"]'); return { color: themed?.style.getPropertyValue('--color-brand'), editorial: themed?.classList.contains('font-display') }; })()`);
  if (publicTheme.color !== siteColor || !publicTheme.editorial) throw new Error(`Тема публичного сайта не применилась: ${JSON.stringify(publicTheme)}`);
  await navigate(client, '/dashboard/site');
  const sitePersisted = await evaluate(client, `(() => ({ description: document.querySelector('textarea')?.value, catalog: document.querySelector('input[aria-label="Название позиции"]')?.value, category: document.querySelector('input[aria-label="Категория"]')?.value, heading: [...document.querySelectorAll('label')].find((label) => label.textContent.includes('Заголовок каталога'))?.querySelector('input')?.value, color: document.querySelector('input[type="color"]')?.value, font: [...document.querySelectorAll('select')].find((select) => select.parentElement?.textContent.includes('Шрифт сайта'))?.value, phone: [...document.querySelectorAll('label')].find((label) => label.textContent.trim().startsWith('Телефон'))?.querySelector('input')?.value, logo: [...document.querySelectorAll('[style*="background-image"]')].some((node) => node.style.backgroundImage.includes('data:image')) }))()`);
  if (sitePersisted.description !== siteDescription || sitePersisted.catalog !== catalogTitle || sitePersisted.category !== catalogCategory || sitePersisted.heading !== catalogHeading || sitePersisted.color !== siteColor || sitePersisted.font !== 'editorial' || sitePersisted.phone !== sitePhone || !sitePersisted.logo) throw new Error(`Настройки сайта не сохранились: ${JSON.stringify(sitePersisted)}`);
  results.push('site live preview + publish + persistence');

  await assertPage(client, '/dashboard/qr', 'QR-код бизнеса'); results.push('business QR');

  await navigate(client, '/dashboard/staff');
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('пригласить'))?.click()`);
  await waitForText(client, 'Новый сотрудник');
  const staffSubmitted = await evaluate(client, `(() => { const heading = [...document.querySelectorAll('h2')].find((node) => node.innerText.toLocaleLowerCase('ru').includes('новый сотрудник')); const card = heading?.parentElement; const inputs = card?.querySelectorAll('input'); if (!inputs || inputs.length < 3) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; ['Кассир E2E','e2e-cashier@localy.kz','Localy2026!X'].forEach((value, index) => { set.call(inputs[index], value); inputs[index].dispatchEvent(new Event('input', { bubbles: true })); }); [...card.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('создать доступ'))?.click(); return true; })()`);
  if (!staffSubmitted) throw new Error('Не удалось заполнить приглашение кассира');
  await waitForText(client, 'Сотрудник приглашён'); results.push('staff invite');

  await client.send('Network.clearBrowserCookies');
  const joinPath = newPublicPath.replace('/b/', '/join/');
  await navigate(client, joinPath);
  const joined = await evaluate(client, `(() => { const form = document.querySelector('form'); if (!form) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); set.call(name, 'Тестовый Клиент'); name.dispatchEvent(new Event('input', { bubbles: true })); set.call(phone, '+7 700 555 20 31'); phone.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!joined) throw new Error('Форма вступления не найдена');
  await waitForText(client, 'Код отправлен');
  const verified = await evaluate(client, `(() => { const codeNode = document.querySelector('[data-dev-code]'); const code = codeNode?.getAttribute('data-dev-code'); const input = document.querySelector('input[name="verificationCode"]'); if (!code || !input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, code); input.dispatchEvent(new Event('input', { bubbles: true })); input.form?.requestSubmit(); return true; })()`);
  if (!verified) throw new Error('Локальный OTP не найден');
  await waitForPath(client, '/me'); await waitForText(client, 'Ваш QR действует во всех заведениях'); await waitForText(client, 'Мои карты');
  const customerNavText = await evaluate(client, '[...document.querySelectorAll("[aria-label=\'Клиентская навигация\'], [aria-label=\'Мобильная клиентская навигация\']")].map((node) => node.innerText).join(" ")');
  if (customerNavText.includes('Заведения')) throw new Error('Ссылка «Заведения» осталась в клиентской навигации');
  results.push('customer join + isolated customer shell + universal QR');
  await assertPage(client, newPublicPath, 'Открыть мой профиль');
  if (!(await evaluate(client, `Boolean(document.querySelector('a[href="/me"]'))`))) throw new Error('Авторизованный клиент снова отправлен на регистрацию');
  results.push('public site sends signed-in customer directly to profile');

  await navigate(client, '/me');
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('реферальная система'))?.click()`);
  await waitForText(client, 'Ваш код');
  const stableCustomerCode = await evaluate(client, `(() => { const label = [...document.querySelectorAll('p')].find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'ваш код'); return label?.nextElementSibling?.innerText.trim() ?? null; })()`);
  if (!stableCustomerCode) throw new Error('Постоянный код клиента не найден');
  const customerBusinessHref = await evaluate(client, `(() => [...document.querySelectorAll('a[href^="/me/"]')].find((node) => node.innerText.includes('Барбершоп E2E'))?.getAttribute('href') ?? null)()`);
  if (!customerBusinessHref) throw new Error('Не найдена клиентская карточка нового бизнеса');
  const customerCookies = await client.send('Network.getAllCookies');

  await login(client, 'e2e-cashier@localy.kz', '/pos', 'Localy2026!X');
  const foundClient = await evaluate(client, `(() => { const input = document.querySelector('input[placeholder*="QR"]'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, ${JSON.stringify(stableCustomerCode)}); input.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('найти клиента'))?.click(); return true; })()`);
  if (!foundClient) throw new Error('Поиск клиента в кассе не найден');
  await waitForText(client, 'Тестовый Клиент');
  await evaluate(client, `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const amount = document.querySelector('input[placeholder="2400"]'); const items = document.querySelector('input[placeholder*="Капучино"]'); set.call(amount, '3500'); amount.dispatchEvent(new Event('input', { bubbles: true })); set.call(items, 'Капучино, Круассан'); items.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('провести'))?.click(); })()`);
  await waitForText(client, 'Покупка проведена'); results.push('POS purchase + points');

  await client.send('Network.clearBrowserCookies');
  await client.send('Network.setCookies', { cookies: customerCookies.cookies.filter((cookie) => cookie.name === 'localy_customer') });
  await navigate(client, customerBusinessHref);
  await waitForText(client, 'Капучино, Круассан');
  const currentHistory = await evaluate(client, `(() => { const heading = [...document.querySelectorAll('h2')].find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'последние покупки'); const rows = heading?.parentElement?.querySelectorAll('li') ?? []; return { path: location.pathname, heading: heading?.innerText ?? null, count: rows.length, newest: rows[0]?.innerText ?? null, page: document.body.innerText.slice(0, 600) }; })()`);
  if (currentHistory.heading?.toLocaleLowerCase('ru') !== 'последние покупки' || currentHistory.count > 6 || !currentHistory.newest?.includes('Капучино, Круассан')) throw new Error(`История клиента не обновилась после кассы: ${JSON.stringify(currentHistory)}`);
  results.push('customer profile shows current six-purchase history');

  await login(client, 'owner@localy.kz', '/dashboard');
  await assertPage(client, '/dashboard/crm', 'Тестовый Клиент'); results.push('purchase in CRM');
  const purchasedCustomerHref = await evaluate(client, `(() => { const row = [...document.querySelectorAll('a[href^="/dashboard/crm/"]')].find((node) => node.innerText.includes('Тестовый Клиент')); return row?.getAttribute('href') ?? null; })()`);
  if (!purchasedCustomerHref) throw new Error('После покупки нет ссылки на карточку клиента');
  await assertPage(client, purchasedCustomerHref, 'Капучино, Круассан');
  await waitForText(client, 'История');
  results.push('POS purchase linked to exact customer history');

  await navigate(client, '/tools');
  const depositsToolReady = await evaluate(client, `(() => { const card = document.querySelector('[data-tool-id="tool_deposits"]'); if (!card) return false; const add = [...card.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('добавить в мои')); if (add) add.click(); return true; })()`);
  if (!depositsToolReady) throw new Error('Сертификаты отсутствуют в каталоге барбершопа');
  for (let attempt = 0; attempt < 100; attempt += 1) { await sleep(100); if (await evaluate(client, `Boolean(document.querySelector('[data-tool-id="tool_deposits"] a[href="/tools/tool_deposits"]'))`)) break; }
  await navigate(client, '/tools/tool_deposits');
  await waitForText(client, 'Выпустить');
  const depositCreated = await evaluate(client, `(() => { const inputs = [...document.querySelectorAll('input')]; const title = inputs.find((input) => input.parentElement?.innerText.includes('Название')); const balance = inputs.find((input) => input.parentElement?.innerText.includes('Номинал')); if (!title || !balance) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(title, 'Сертификат E2E'); title.dispatchEvent(new Event('input', { bubbles: true })); set.call(balance, '15000'); balance.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.trim().toLocaleLowerCase('ru') === 'выпустить')?.click(); return true; })()`);
  if (!depositCreated) throw new Error('Форма выпуска сертификата не работает');
  await waitForText(client, 'Выпущено и сохранено');
  await waitForText(client, 'Сертификат E2E');
  const persistedDepositState = JSON.parse(readFileSync(join(testDataDir, 'localy.json'), 'utf8'));
  if (!persistedDepositState.deposits.some((deposit) => deposit.title === 'Сертификат E2E' && deposit.balance === 15000)) throw new Error('Сертификат не сохранился в постоянное хранилище');
  results.push('certificate issue persisted for a real CRM customer');

  const promoTitle = `Акция E2E ${Date.now()}`;
  await navigate(client, '/dashboard/promos/new');
  const acquisitionMode = await evaluate(client, `(() => { const select = document.querySelector('select[aria-label="Цель акции"]'); if (!select) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(select, 'new_customers'); select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  if (!acquisitionMode) throw new Error('Не удалось выбрать цель привлечения новых клиентов');
  await waitForText(client, 'Без выбора CRM-сегмента');
  if (await evaluate(client, `Boolean(document.querySelector('select[aria-label="Сегмент акции"]'))`)) throw new Error('Для новых клиентов ошибочно показан CRM-сегмент');
  const invalidForecastHandled = await evaluate(client, `(() => { const label = [...document.querySelectorAll('label')].find((node) => node.innerText.includes('Размер (')); const input = label?.querySelector('input'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, '0'); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (!invalidForecastHandled) throw new Error('Поле размера предложения не найдено');
  await waitForText(client, 'Укажите корректный размер предложения');
  const rawServerError = await evaluate(client, `document.body.innerText.includes('Server Components render') || Boolean(document.querySelector('nextjs-portal'))`);
  if (rawServerError) throw new Error('Ожидаемая ошибка формы попала в системный Server Components error');
  await evaluate(client, `(() => { const label = [...document.querySelectorAll('label')].find((node) => node.innerText.includes('Размер (')); const input = label?.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, '15'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitForText(client, 'Ожидаемая выручка');
  const acquisitionPlacementsReady = await evaluate(client, `(() => { const labels = [...document.querySelectorAll('label')]; const checked = (text) => labels.find((label) => label.innerText.includes(text))?.querySelector('input[type="checkbox"]')?.checked; const cashier = labels.find((label) => label.innerText.includes('Можно применить на кассе'))?.querySelector('input[type="checkbox"]'); return checked('На публичном сайте') && checked('На странице после QR') && cashier?.checked && cashier?.disabled; })()`);
  if (!acquisitionPlacementsReady) throw new Error('Публичные размещения или обязательная касса настроены неверно');
  await sleep(200);
  const promoCreated = await evaluate(client, `(() => {
    const title = [...document.querySelectorAll('label')].find((label) => label.innerText.includes('Заголовок'))?.querySelector('input');
    const body = document.querySelector('textarea');
    if (!title || !body) return false;
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const setArea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setInput.call(title, ${JSON.stringify(promoTitle)}); title.dispatchEvent(new Event('input', { bubbles: true }));
    setArea.call(body, 'Скидка для проверки полного сценария'); body.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('сохранить черновик'))?.click();
    return true;
  })()`);
  if (!promoCreated) throw new Error('Конструктор акции не найден');
  const promoPath = await waitForDifferentPath(client, '/dashboard/promos/new');
  if (!promoPath.startsWith('/dashboard/promos/')) throw new Error(`Акция открылась по неверному пути: ${promoPath}`);
  await waitForText(client, promoTitle);
  await waitForText(client, 'Привлечь новых клиентов');
  await waitForText(client, 'оценочный охват');
  await waitForText(client, 'Прогноз до запуска');
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.trim().toLocaleLowerCase('ru') === 'редактировать')?.click()`);
  await waitForText(client, 'После изменения механики Localy заново считает');
  const promoEdited = await evaluate(client, `(() => { const label = [...document.querySelectorAll('label')].find((node) => node.innerText.includes('Размер предложения')); const input = label?.querySelector('input'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, '20'); input.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.trim().toLocaleLowerCase('ru') === 'сохранить')?.click(); return true; })()`);
  if (!promoEdited) throw new Error('Редактор черновика акции не найден');
  await waitForText(client, 'Изменения и прогноз сохранены');
  await assertPage(client, '/dashboard/promos', promoTitle);
  await waitForText(client, 'публичный охват');
  await navigate(client, promoPath);
  await evaluate(client, `[...document.querySelectorAll('button')].find((button) => button.innerText.trim().toLocaleLowerCase('ru') === 'запустить акцию')?.click()`);
  await waitForText(client, 'Выручка с акции');
  results.push('public acquisition promo without fake CRM audience + edit + recalculated forecast + launch');

  await login(client, 'e2e-cashier@localy.kz', '/pos', 'Localy2026!X');
  const promoPurchase = await evaluate(client, `(() => {
    const search = document.querySelector('input[placeholder*="QR"]'); if (!search) return false;
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setInput.call(search, '+7 700 555 20 31'); search.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('найти клиента'))?.click();
    return true;
  })()`);
  if (!promoPurchase) throw new Error('Повторная покупка с акцией не началась');
  await waitForText(client, 'Тестовый Клиент');
  const promoApplied = await evaluate(client, `(() => {
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const amount = document.querySelector('input[placeholder="2400"]'); const items = document.querySelector('input[placeholder*="Капучино"]');
    const promoSelect = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.text.includes(${JSON.stringify(promoTitle)})));
    const promoOption = promoSelect && [...promoSelect.options].find((option) => option.text.includes(${JSON.stringify(promoTitle)}));
    if (!amount || !items || !promoSelect || !promoOption) return false;
    setInput.call(amount, '2800'); amount.dispatchEvent(new Event('input', { bubbles: true })); setInput.call(items, 'Капучино E2E'); items.dispatchEvent(new Event('input', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(promoSelect, promoOption.value); promoSelect.dispatchEvent(new Event('change', { bubbles: true }));
    [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('провести'))?.click(); return true;
  })()`);
  if (!promoApplied) throw new Error('Акция не появилась в кассе');
  await waitForText(client, 'Покупка проведена');
  const promoReceiptText = await evaluate(client, 'document.body.innerText');
  const normalizedPromoReceipt = promoReceiptText.replace(/\u00a0/g, ' ');
  if (!normalizedPromoReceipt.toLocaleLowerCase('ru').includes('скидка') || !normalizedPromoReceipt.includes('2 240 ₸')) throw new Error(`Выбранная скидка не изменила чек кассы: ${promoReceiptText.slice(-500)}`);
  await login(client, 'owner@localy.kz', '/dashboard');
  await assertPage(client, promoPath, 'Использовали');
  const redeemedCount = await evaluate(client, `(() => { const label = [...document.querySelectorAll('span')].find((node) => node.innerText.trim() === 'Использовали'); return label?.parentElement?.querySelectorAll('span')[1]?.innerText ?? ''; })()`);
  if (!redeemedCount || redeemedCount.trim().startsWith('0')) throw new Error(`Кассовое применение не попало в воронку: ${redeemedCount}`);
  results.push('promo redemption in POS + real funnel event');

  await navigate(client, '/dashboard/campaigns');
  const campaignStarted = await evaluate(client, `(() => { const textarea = document.querySelector('textarea'); if (!textarea) return false; const promoSelect = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.text.includes(${JSON.stringify(promoTitle)}))); if (!promoSelect) return false; const promoOption = [...promoSelect.options].find((option) => option.text.includes(${JSON.stringify(promoTitle)})); const setSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setSelect.call(promoSelect, promoOption.value); promoSelect.dispatchEvent(new Event('change', { bubbles: true })); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(textarea, '{name}, вернитесь за бонусами!'); textarea.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('запустить рассылку'))?.click(); return true; })()`);
  if (!campaignStarted) throw new Error('Конструктор рассылки не найден');
  await waitForText(client, 'Отправлено на');
  await assertPage(client, newPublicPath, promoTitle);
  results.push('campaign simulation + public promo visibility without fake delivery funnel');
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
  const leadUi = await evaluate(client, `(() => ({ heading: document.body.innerText.includes('Оставить заявку'), form: Boolean(document.querySelector('textarea[name="message"]')), anchor: Boolean(document.querySelector('#lead')) }))()`);
  if (leadUi.heading || leadUi.form || leadUi.anchor) throw new Error(`Публичная форма заявки осталась: ${JSON.stringify(leadUi)}`);
  results.push('public lead form removed');
  const browserCookies = await client.send('Network.getAllCookies');
  if (browserCookies.cookies.some((cookie) => cookie.name === 'localy_customer')) throw new Error('Публичная заявка выдала клиентскую сессию без OTP');
  results.push('public form does not authenticate');

  // ── Онлайн-запись по слотам ──
  // Берём сайт бизнеса, под которым сидит владелец: записи из этого сайта
  // видны в его кабинете, где дальше проверяем перенос и отмену.
  await login(client, 'owner@localy.kz', '/dashboard');
  await navigate(client, '/dashboard/qr');
  const qrPageText = await evaluate(client, `[...document.querySelectorAll('a')].map((node) => node.getAttribute('href') || '').join(' ') + ' ' + document.body.innerText`);
  const joinMatch = /\/join\/([a-z0-9-]+)/i.exec(qrPageText);
  if (!joinMatch) throw new Error(`На странице QR нет ссылки /join/<slug>: ${qrPageText.slice(0, 300)}`);
  const ownerSlug = joinMatch[1];
  const bookingPath = `/b/${ownerSlug}`;

  await client.send('Network.clearBrowserCookies');
  await navigate(client, bookingPath);
  const slotState = await evaluate(client, `(() => { const select = document.querySelector('select[name="at"]'); if (!select) return { ok: false }; const options = [...select.options].filter((option) => option.value); return { ok: true, count: options.length, first: options[0]?.value ?? null }; })()`);
  if (!slotState.ok || slotState.count === 0) throw new Error(`На сайте ${bookingPath} нет свободных слотов записи: ${JSON.stringify(slotState)}`);
  results.push(`public booking offers ${slotState.count} schedule slots`);

  // Негативный: время вне сетки расписания сервер не принимает.
  const outOfSchedule = new Date(Date.now() + 36 * 3_600_000);
  outOfSchedule.setUTCHours(1, 7, 0, 0);
  const injected = await evaluate(client, `(() => { const select = document.querySelector('select[name="at"]'); const form = select?.form; if (!form) return false; const option = document.createElement('option'); option.value = ${JSON.stringify(outOfSchedule.toISOString())}; option.textContent = 'вне расписания'; select.appendChild(option); select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); const service = form.elements.namedItem('service'); set.call(name, 'Слот E2E'); name.dispatchEvent(new Event('input', { bubbles: true })); set.call(phone, '+7 700 555 44 33'); phone.dispatchEvent(new Event('input', { bubbles: true })); service.value = [...service.options].filter((option) => option.value)[0]?.value ?? ''; service.dispatchEvent(new Event('change', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!injected) throw new Error('Форма записи не найдена');
  await sleep(1500);
  const rejection = await evaluate(client, `(() => { const alert = document.querySelector('[role="alert"]'); const success = document.querySelector('[role="status"]'); return { alert: alert?.innerText ?? null, success: success?.innerText ?? null }; })()`);
  if (!rejection.alert || !rejection.alert.toLocaleLowerCase('ru').includes('расписан')) {
    throw new Error(`Запись вне расписания не отклонена: ${JSON.stringify(rejection)}`);
  }
  results.push('negative: booking outside schedule rejected');

  // Позитивный: запись на реальный свободный слот.
  await navigate(client, bookingPath);
  const booked = await evaluate(client, `(() => { const select = document.querySelector('select[name="at"]'); const form = select?.form; if (!form) return false; const slot = [...select.options].filter((option) => option.value)[0]; if (!slot) return false; select.value = slot.value; select.dispatchEvent(new Event('change', { bubbles: true })); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); const service = form.elements.namedItem('service'); set.call(name, 'Слот E2E'); name.dispatchEvent(new Event('input', { bubbles: true })); set.call(phone, '+7 700 555 44 33'); phone.dispatchEvent(new Event('input', { bubbles: true })); service.value = [...service.options].filter((option) => option.value)[0]?.value ?? ''; service.dispatchEvent(new Event('change', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!booked) throw new Error('Не удалось записаться на свободный слот');
  await waitForText(client, 'Заявка на');
  results.push('public booking on a free slot');

  // Негативный: чужой реферальный код не выдаёт себя за приглашение.
  const joinSlug = ownerSlug;
  await navigate(client, `/join/${joinSlug}?ref=ZZZZZZ`);
  const fakeReferral = await evaluate(client, 'document.body.innerText.includes("Вас пригласил")');
  if (fakeReferral) throw new Error('Несуществующий реферальный код показан как настоящее приглашение');
  results.push('negative: unknown referral code is not attributed');

  // Негативный: планировщик без секрета.
  const cronDenied = await evaluate(client, `fetch('/api/cron/run', { method: 'POST' }).then((response) => response.status)`);
  if (cronDenied !== 401) throw new Error(`Cron без секрета вернул ${cronDenied}, ожидался 401`);
  const cronWrong = await evaluate(client, `fetch('/api/cron/run', { method: 'POST', headers: { 'x-localy-cron-secret': 'nope' } }).then((response) => response.status)`);
  if (cronWrong !== 401) throw new Error(`Cron с чужим секретом вернул ${cronWrong}, ожидался 401`);
  results.push('negative: cron requires secret');

  const cronOk = await evaluate(client, `fetch('/api/cron/run', { method: 'POST', headers: { 'x-localy-cron-secret': ${JSON.stringify(CRON_SECRET)} } }).then((response) => response.json()).then((data) => data.ok === true)`);
  if (!cronOk) throw new Error('Cron с верным секретом не отработал');
  results.push('cron runs automations with secret');

  // ── Кабинет: расписание, отмена с причиной, журнал доставки ──
  await login(client, 'owner@localy.kz', '/dashboard');
  await assertPage(client, '/dashboard/bookings', 'Когда клиенты могут записаться');
  results.push('booking schedule editor');

  const cancelStarted = await evaluate(client, `(() => { const buttons = [...document.querySelectorAll('button')].filter((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'отменить'); if (buttons.length === 0) return false; buttons[0].click(); return true; })()`);
  if (!cancelStarted) {
    const debugText = await evaluate(client, 'document.body.innerText.slice(0, 900)');
    throw new Error(`Нет активных записей для отмены: ${debugText}`);
  }
  await sleep(400);
  const cancelBlocked = await evaluate(client, `(() => { const button = [...document.querySelectorAll('button')].find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'отменить запись'); return Boolean(button?.disabled); })()`);
  if (!cancelBlocked) throw new Error('Отмена без причины не заблокирована');
  results.push('negative: cancel requires a reason');

  const cancelled = await evaluate(client, `(() => { const input = [...document.querySelectorAll('input')].find((node) => node.previousElementSibling?.innerText?.includes('Причина отмены') || node.placeholder === 'Клиент перенёс планы'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, 'Клиент не придёт'); input.dispatchEvent(new Event('input', { bubbles: true })); const button = [...document.querySelectorAll('button')].find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'отменить запись'); if (!button || button.disabled) return false; button.click(); return true; })()`);
  if (!cancelled) throw new Error('Не удалось отменить запись с причиной');
  await waitForText(client, 'Причина отмены: Клиент не придёт');
  const cancelledActions = await evaluate(client, `(() => { const card = [...document.querySelectorAll('div')].find((node) => node.innerText.includes('Причина отмены: Клиент не придёт')); return [...(card?.querySelectorAll('button') ?? [])].map((node) => node.innerText.trim()); })()`);
  if (cancelledActions.some((label) => label.toLocaleLowerCase('ru') === 'перенести')) throw new Error('У отменённой записи остался перенос');
  results.push('booking cancel with reason, no actions afterwards');

  await assertPage(client, '/dashboard/campaigns', 'История рассылок');
  const campaignSent = await evaluate(client, `(() => { const textarea = document.querySelector('textarea'); if (!textarea) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(textarea, '{name}, ждём вас снова — журнал доставки E2E'); textarea.dispatchEvent(new Event('input', { bubbles: true })); const button = [...document.querySelectorAll('button')].find((node) => node.innerText.trim().toLocaleLowerCase('ru') === 'запустить рассылку'); if (!button || button.disabled) return false; button.click(); return true; })()`);
  if (!campaignSent) throw new Error('Не удалось запустить рассылку для проверки журнала');
  await waitForText(client, 'Отправлено на');
  await navigate(client, '/dashboard/campaigns');
  const deliveryStatuses = await evaluate(client, `(() => { document.querySelectorAll('details').forEach((node) => { node.open = true; }); const summary = [...document.querySelectorAll('summary')].find((node) => node.innerText.toLocaleLowerCase('ru').includes('журнал доставки')); if (!summary) return null; summary.parentElement.open = true; return summary.parentElement.innerText; })()`);
  if (!deliveryStatuses || !/доставлено|открыто|переход/.test(deliveryStatuses.toLocaleLowerCase('ru'))) {
    const debugCampaigns = await evaluate(client, `(() => { document.querySelectorAll('details').forEach((node) => { node.open = true; }); return document.body.innerText.slice(-1200); })()`);
    throw new Error(`В журнале доставки нет статусов: ${String(deliveryStatuses).slice(0, 200)} | ${debugCampaigns}`);
  }
  results.push('delivery log with per-recipient statuses');

  // Реферальная связка: код клиента в CRM и рабочая ссылка приглашения.
  await navigate(client, '/dashboard/crm');
  const crmCustomerHref = await evaluate(client, `document.querySelector('a[href^="/dashboard/crm/"]')?.getAttribute('href') ?? null`);
  if (!crmCustomerHref) throw new Error('В CRM нет карточек клиентов');
  await assertPage(client, crmCustomerHref, 'Код приглашения');
  const referralCode = await evaluate(client, `(document.body.innerText.match(/Код приглашения\\s*—\\s*([A-Z0-9]{4,8})/) ?? [])[1] ?? null`);
  if (!referralCode) throw new Error('Код приглашения не найден в карточке клиента');
  await client.send('Network.clearBrowserCookies');
  await navigate(client, `/join/${ownerSlug}?ref=${referralCode}`);
  await waitForText(client, 'Вас пригласил');
  results.push('referral code is issued and attributed by link');

  // Награда обоим: приглашённый регистрируется по ссылке и делает покупку.
  const invitedPhone = '+7 700 555 21 42';
  const invitedJoined = await evaluate(client, `(() => { const form = document.querySelector('form'); if (!form) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const name = form.elements.namedItem('name'); const phone = form.elements.namedItem('phone'); set.call(name, 'Приглашённый E2E'); name.dispatchEvent(new Event('input', { bubbles: true })); set.call(phone, ${JSON.stringify(invitedPhone)}); phone.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit(); return true; })()`);
  if (!invitedJoined) throw new Error('Форма вступления по реферальной ссылке не найдена');
  await waitForText(client, 'Код отправлен');
  const invitedVerified = await evaluate(client, `(() => { const code = document.querySelector('[data-dev-code]')?.getAttribute('data-dev-code'); const input = document.querySelector('input[name="verificationCode"]'); if (!code || !input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, code); input.dispatchEvent(new Event('input', { bubbles: true })); input.form?.requestSubmit(); return true; })()`);
  if (!invitedVerified) throw new Error('Локальный OTP приглашённого не найден');
  await waitForPath(client, '/me');

  await login(client, 'e2e-cashier@localy.kz', '/pos', 'Localy2026!X');
  const invitedFound = await evaluate(client, `(() => { const input = document.querySelector('input[placeholder*="QR"]'); if (!input) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, ${JSON.stringify(invitedPhone)}); input.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('найти клиента'))?.click(); return true; })()`);
  if (!invitedFound) throw new Error('Поиск приглашённого в кассе не сработал');
  await waitForText(client, 'Приглашённый E2E');
  await evaluate(client, `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const amount = document.querySelector('input[placeholder="2400"]'); const items = document.querySelector('input[placeholder*="Капучино"]'); set.call(amount, '4000'); amount.dispatchEvent(new Event('input', { bubbles: true })); set.call(items, 'Стрижка'); items.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('button')].find((button) => button.innerText.toLocaleLowerCase('ru').includes('провести'))?.click(); })()`);
  await waitForText(client, 'Покупка проведена');

  await login(client, 'owner@localy.kz', '/dashboard');
  await navigate(client, crmCustomerHref);
  const referrerCard = await evaluate(client, 'document.body.innerText');
  const rewarded = /награда начислена\s*1/i.exec(referrerCard);
  if (!rewarded) throw new Error(`Реферальная награда не начислена пригласившему: ${referrerCard.slice(0, 400)}`);
  const invitedCardHref = await evaluate(client, `(() => { const link = [...document.querySelectorAll('a[href^="/dashboard/crm/"]')].find((node) => node.innerText.includes('Приглашённый E2E')); return link?.getAttribute('href') ?? null; })()`);
  await navigate(client, '/dashboard/crm');
  const invitedHref = invitedCardHref ?? await evaluate(client, `(() => { const row = [...document.querySelectorAll('a[href^="/dashboard/crm/"]')].find((node) => node.innerText.includes('Приглашённый E2E')); return row?.getAttribute('href') ?? null; })()`);
  if (!invitedHref) throw new Error('Карточка приглашённого не найдена в CRM');
  await navigate(client, invitedHref);
  await waitForText(client, 'награда начислена обоим');
  results.push('referral reward paid to both after first purchase');

  // ── Мобильные экраны: горизонтального скролла быть не должно ──
  await client.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  const mobilePaths = ['/', '/onboarding', '/dashboard', '/dashboard/site', '/dashboard/crm', '/dashboard/promos', '/dashboard/bookings', '/pos', bookingPath];
  for (const mobilePath of mobilePaths) {
    await navigate(client, mobilePath);
    await sleep(250);
    const overflow = await evaluate(client, '(() => { const doc = document.documentElement; return doc.scrollWidth - doc.clientWidth; })()');
    if (overflow > 2) throw new Error(`Горизонтальный скролл на ${mobilePath}: ${overflow}px`);
    if (SHOT_DIR) {
      const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(SHOT_DIR, `${mobilePath.replace(/[^a-z0-9]+/gi, '_') || 'home'}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  await client.send('Emulation.clearDeviceMetricsOverride');
  results.push(`mobile layout without horizontal scroll (${mobilePaths.length} screens)`);

  console.log(`E2E smoke OK (${results.length}):\n- ${results.join('\n- ')}`);
} finally {
  client.close();
  browserProcess?.kill('SIGTERM');
  appProcess?.kill('SIGTERM');
  rmSync(testDataDir, { recursive: true, force: true });
}
