from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose
        page.click("button:has-text('Acetaminophen')")

        # 2. Add note to it via edit modal
        page.click("#history-body tr:first-child")
        page.wait_for_selector("#edit-modal:not(.hidden)")
        page.fill("#edit-notes", "Testing popup layout")
        page.click(".save-btn")

        # Wait for modal to close
        page.wait_for_selector("#edit-modal.hidden")

        # 3. Open Popup
        page.click(".notes-col button")
        page.wait_for_selector(".notes-popup-container")

        # 4. Screenshot
        page.screenshot(path="verification_mobile_popup.png")
        browser.close()

if __name__ == "__main__":
    run()
