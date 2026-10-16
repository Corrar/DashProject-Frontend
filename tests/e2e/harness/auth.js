const { open } = require('./lib');
(async () => {
  const { browser, page, logs, api } = await open({});
  await page.evaluate(() => window.__dashOpenAuth('login'));
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.waitForTimeout(200);
  console.log('empty email ->', await page.evaluate(() => document.body.innerText.match(/Informe seu e-mail acima[^\n]*/)?.[0]));
  // Simulate the backend being unreachable for login
  await page.route('https://dashproject-backend.onrender.com/auth/login', r => r.abort());
  await page.fill('input[type=email]', 'ana@exemplo.com');
  await page.fill('input[type=password]', 'qualquercoisa');
  await page.getByRole('button', { name: /^Entrar/ }).last().click();
  await page.waitForTimeout(800);
  console.log('offline login ->', await page.evaluate(() => document.querySelector('[role=alert]')?.innerText));
  console.log('refresh calls during login attempt:', api.calls.filter(c => c.includes('refresh')).length, '(1 = boot only)');
  await browser.close();
})();
