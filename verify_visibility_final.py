from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")

        print("Waiting for app to load...")
        # Wait for data to load (Edit list button is disabled initially)
        try:
            page.wait_for_selector(".edit-list-btn:not([disabled])", timeout=10000)
        except:
            print("Timeout waiting for edit button to enable. Proceeding anyway.")

        # Open Edit List
        print("Opening Edit List...")
        page.click(".edit-list-btn")
        page.wait_for_selector("#edit-list-modal", state="visible")

        # Find the first medicine (Norco) and toggle visibility
        print("Toggling visibility of first item...")
        first_med_item = page.locator(".med-item").first
        med_name = first_med_item.locator(".med-label").inner_text()
        print(f"First medicine is: {med_name}")

        toggle_btn = first_med_item.locator(".visibility-toggle")

        # Click toggle
        toggle_btn.click()

        # Verify opacity class added
        if "hidden-med" in first_med_item.get_attribute("class"):
            print("Success: 'hidden-med' class added.")
        else:
            print("Failure: 'hidden-med' class NOT added.")

        page.screenshot(path="verification_final.png")

        # Close modal
        print("Closing modal...")
        page.click("#edit-list-modal .cancel-btn")
        page.wait_for_selector("#edit-list-modal", state="hidden")

        # Verify medicine is gone from main list
        print("Verifying main list...")
        # Wait a bit for re-render if needed (though it should be instant)
        page.wait_for_timeout(500)

        if page.locator(f"button.dose-btn:has-text('{med_name}')").count() == 0:
            print(f"Success: {med_name} is hidden from main list.")
        else:
            print(f"Failure: {med_name} is still visible in main list.")

        browser.close()

if __name__ == "__main__":
    run()
