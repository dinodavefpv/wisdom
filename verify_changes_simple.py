from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8000")

        # 1. Add a dose
        page.click("button:has-text('Acetaminophen')")

        # 2. Open edit modal
        page.click("#history-body tr:first-child")

        # 3. Modify Quantity and Notes
        page.fill("#edit-quantity", "1.5")
        page.fill("#edit-notes", "Headache relief")
        page.click(".save-btn")

        # 4. Verify Table
        page.wait_for_selector(".qty-col:has-text('1½')")
        page.wait_for_selector(".notes-col button")

        # 5. Open Notes Popup
        page.click(".notes-col button")
        page.wait_for_selector(".notes-popup-container")

        page.screenshot(path="verification_screenshot.png")
        browser.close()

if __name__ == "__main__":
    run()
