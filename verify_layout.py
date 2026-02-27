from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose
        page.click("button:has-text('Acetaminophen')")

        # 2. Wait for row
        page.wait_for_selector("#history-body tr")

        # 3. Take screenshot of table
        page.screenshot(path="verification_mobile_layout.png")
        browser.close()

if __name__ == "__main__":
    run()
