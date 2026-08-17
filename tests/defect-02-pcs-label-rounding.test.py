"""
Автотест для дефекта №2 из BUGS.md:
"[minor] Опция «шт» показывает «0 г/шт» при дробном весе одной штуки < 0,5 г
 вместо реального значения"

Стек: Python + `playwright` (тот же пакет, которым в проекте уже пользовались
для ручных проверок в сессиях 3–4, через `python3 -m http.server` + Chromium).
Не pytest/pytest-playwright — их нет в этом окружении (pip install тоже не
пробовал сверх необходимого: раз в среде тестировщика уже запрещена установка
новых npm-пакетов, не стал напрашиваться на то же самое с pip; голого
Playwright + `assert` достаточно, чтобы тест был по-настоящему красным).

Запуск:  python3 tests/defect-02-pcs-label-rounding.test.py
Перед запуском должен быть поднят локальный сервер с index.html, например:
  python3 -m http.server 8765
(переменной окружения BASE_URL можно переопределить адрес, по умолчанию
 http://localhost:8765/index.html)
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8765/index.html")
CHROMIUM_PATH = os.environ.get("PW_CHROMIUM_PATH", "/opt/pw-browsers/chromium")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM_PATH)
        page = browser.new_page()

        try:
            page.goto(BASE_URL)
            page.wait_for_selector("#calc-ing-search")

            # Шаг 1: создать ингредиент с дробным весом одной штуки (0.1 г) —
            # такой же вход, каким дефект был впервые найден в BUGS.md.
            page.locator(".nav-btn[data-tab='ingredients']").click()
            page.fill("#ing-name", "АвтотестШтуки01")
            page.fill("#ing-kcal", "100")
            page.fill("#ing-protein", "10")
            page.fill("#ing-fat", "5")
            page.fill("#ing-carbs", "5")
            page.fill("#ing-piece-grams", "0.1")
            page.locator("#ing-add-btn").click()

            # Шаг 2: выбрать этот ингредиент в калькуляторе через комбобокс поиска.
            page.locator(".nav-btn[data-tab='calc']").click()
            search = page.locator("#calc-ing-search")
            search.fill("АвтотестШтуки01")
            page.wait_for_timeout(150)
            page.locator(
                "#calc-ing-dropdown .ing-dropdown-item", has_text="АвтотестШтуки01"
            ).first.click()
            page.wait_for_timeout(100)

            # Шаг 3: прочитать подпись пункта «шт» в селекторе единиц измерения.
            actual_label = page.eval_on_selector(
                "#calc-ing-unit option[value='pcs']", "el => el.textContent"
            )
            expected_label = "шт (0,1 г/шт)"

            print(f'Ожидалось: "{expected_label}"')
            print(f'Получено:  "{actual_label}"')

            # Это и есть проверка дефекта №2: подпись должна показывать реальный
            # заданный вес одной штуки (0,1 г), а не округлённый до целого «0».
            assert actual_label == expected_label, (
                f'Дефект №2 воспроизведён: подпись опции "шт" округляет вес '
                f"одной штуки до целого числа (fmt(ing.pieceGrams, 0) в "
                f'updateCalcUnitOptions) — при pieceGrams=0.1 показывает '
                f'"{actual_label}" вместо "{expected_label}".'
            )

            print("PASS: defect-02-pcs-label-rounding")
            return 0
        except AssertionError as err:
            print("FAIL: defect-02-pcs-label-rounding")
            print(str(err))
            return 1
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
