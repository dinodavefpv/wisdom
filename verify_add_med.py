
from playwright.sync_api import sync_playwright

def test_add_and_save_medicine():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:8000")

        # Click "Edit Medicine List" button
        page.click("text=Edit Medicine List")

        # Wait for the modal
        page.wait_for_selector("#edit-list-modal:not(.hidden)")

        # Count initial items
        initial_count = page.locator(".med-item").count()
        print(f"Initial item count: {initial_count}")

        # Click "Add New Medicine"
        page.click("text=Add New Medicine")

        # Wait for count to increase
        page.wait_for_function(f"document.querySelectorAll('.med-item').length > {initial_count}")

        new_count = page.locator(".med-item").count()
        print(f"New item count: {new_count}")

        # Wait for the new item to be expanded (Wait for details to be visible)
        last_item = page.locator(".med-item").last
        try:
            last_item.locator(".med-details").wait_for(state="visible", timeout=2000)
            print("New item is expanded.")
        except:
            print("New item did not expand in time.")

        # Verify default values
        name_val = last_item.locator(".name-input").input_value()
        if name_val != "New Medicine":
            print(f"Unexpected default name: {name_val}")

        # Change name
        last_item.locator(".name-input").fill("My Custom Med")

        # Take screenshot
        page.screenshot(path="verification_add_med.png")

        # Click the individual "Save" button
        # It's inside the expanded details
        save_btn = last_item.locator("button.med-item-btn.primary", has_text="Save")
        save_btn.click()

        # Verify it collapsed
        try:
            last_item.locator(".med-details").wait_for(state="hidden", timeout=2000)
            print("Item collapsed successfully.")
        except:
            print("Item did not collapse!")

        # Verify header updated
        header_text = last_item.locator(".med-label").inner_text()
        if header_text != "My Custom Med":
            print("Header text not updated!")

        # Click "Save Changes" at the bottom (Specific selector)
        page.click("#edit-list-modal .save-btn")

        # Wait for toast
        try:
            page.wait_for_selector(".toast.show", timeout=5000)
            print("Toast appeared, save successful.")
        except:
            print("Toast did not appear.")

        browser.close()

if __name__ == "__main__":
    test_add_and_save_medicine()
