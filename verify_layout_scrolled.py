from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # Scroll to table
        page.locator(".history-section").scroll_into_view_if_needed()

        # 3. Take screenshot of table
        page.screenshot(path="verification_mobile_layout_scrolled.png")
        browser.close()

if __name__ == "__main__":
    run()
