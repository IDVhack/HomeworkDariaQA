/**
 * Автотест для дефекта №2 из BUGS.md:
 * "[minor] Опция «шт» показывает «0 г/шт» при дробном весе одной штуки < 0,5 г
 *  вместо реального значения"
 *
 * Стек: Node.js + `playwright` (тот же пакет, что уже используется в проекте
 * для ручных проверок в сессиях 3 и 4). Пакет `@playwright/test` в этой
 * песочнице установить не удалось — npm-реестр блокирует новые пакеты
 * (403 Forbidden), поэтому тест написан на голом Playwright API +
 * встроенный `assert` вместо `@playwright/test` + `expect`. Ассерты и exit
 * code делают ровно то же самое: не совпало ожидание — тест красный.
 *
 * Запуск:  node tests/defect-02-pcs-label-rounding.test.js
 * Перед запуском должен быть поднят локальный сервер с index.html, например:
 *   python3 -m http.server 8765
 * (переменной BASE_URL можно переопределить адрес, по умолчанию
 *  http://localhost:8765/index.html)
 */

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8765/index.html';

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL);
    await page.waitForSelector('#calc-ing-search');

    // Шаг 1: создать ингредиент с дробным весом одной штуки (0.1 г) —
    // такой же вход, каким дефект был впервые найден в BUGS.md.
    await page.locator(".nav-btn[data-tab='ingredients']").click();
    await page.fill('#ing-name', 'АвтотестШтуки01');
    await page.fill('#ing-kcal', '100');
    await page.fill('#ing-protein', '10');
    await page.fill('#ing-fat', '5');
    await page.fill('#ing-carbs', '5');
    await page.fill('#ing-piece-grams', '0.1');
    await page.locator('#ing-add-btn').click();

    // Шаг 2: выбрать этот ингредиент в калькуляторе через комбобокс поиска.
    await page.locator(".nav-btn[data-tab='calc']").click();
    const search = page.locator('#calc-ing-search');
    await search.fill('АвтотестШтуки01');
    await page.waitForTimeout(150);
    await page
      .locator('#calc-ing-dropdown .ing-dropdown-item', { hasText: 'АвтотестШтуки01' })
      .first()
      .click();
    await page.waitForTimeout(100);

    // Шаг 3: прочитать подпись пункта «шт» в селекторе единиц измерения.
    const actualLabel = await page
      .locator("#calc-ing-unit option[value='pcs']")
      .evaluate((el) => el.textContent);

    const expectedLabel = 'шт (0,1 г/шт)';

    console.log(`Ожидалось: "${expectedLabel}"`);
    console.log(`Получено:  "${actualLabel}"`);

    // Это и есть проверка дефекта №2: подпись должна показывать реальный
    // заданный вес одной штуки (0,1 г), а не округлённый до целого «0».
    assert.equal(
      actualLabel,
      expectedLabel,
      `Дефект №2 воспроизведён: подпись опции "шт" округляет вес одной штуки ` +
      `до целого числа (fmt(ing.pieceGrams, 0) в updateCalcUnitOptions) — ` +
      `при pieceGrams=0.1 показывает "${actualLabel}" вместо "${expectedLabel}".`
    );

    console.log('PASS: defect-02-pcs-label-rounding');
    process.exitCode = 0;
  } catch (err) {
    console.error('FAIL: defect-02-pcs-label-rounding');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
