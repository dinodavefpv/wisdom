
from playwright.sync_api import sync_playwright

def test_verify_buttons_exist():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:8000")

        # Capture console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        # Check if action buttons exist
        # Wait for potential Airtable sync (simulate loading delay)
        page.wait_for_timeout(2000)

        button_count = page.locator(".dose-btn").count()
        print(f"Dose buttons count: {button_count}")

        # Inspect medicineConfig
        config = page.evaluate("JSON.stringify(medicineConfig)")
        print(f"medicineConfig: {config}")

        if button_count == 0:
            print("FAILURE: No medicine buttons found!")
        else:
            print("SUCCESS: Medicine buttons are visible.")

        page.screenshot(path="verification_fix_logs.png")
        browser.close()

if __name__ == "__main__":
    test_verify_buttons_exist()
