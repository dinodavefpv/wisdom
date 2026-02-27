from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load the app
        page.goto("http://localhost:8080")

        # Wait for data to load (simulated by timeout as we rely on airtable/localstorage)
        time.sleep(2)

        # Clear existing history for a clean slate
        page.evaluate("localStorage.clear()")
        page.reload()
        time.sleep(1)

        # 1. Log a dose (Norco)
        print("Logging a dose...")
        page.click("button:has-text('Norco')")
        time.sleep(1)

        # 2. Verify it appears in the table with Qty 1
        print("Verifying table entry...")
        qty_cell = page.locator("#history-body tr:first-child .qty-col")
        print(f"Initial Qty: {qty_cell.inner_text()}")
        assert qty_cell.inner_text() == "1"

        # 3. Open Edit Modal
        print("Opening Edit Modal...")
        page.click("#history-body tr:first-child")
        time.sleep(1)

        # 4. Edit Quantity to 1.5
        print("Editing Quantity...")
        page.fill("#edit-quantity", "1.5")

        # 5. Add a Note
        print("Adding Note...")
        page.fill("#edit-notes", "Taken with food")

        # 6. Save
        print("Saving...")
        page.click("button.save-btn")
        time.sleep(1)

        # 7. Verify Table Updates
        print("Verifying updates...")
        updated_qty = page.locator("#history-body tr:first-child .qty-col").inner_text()
        print(f"Updated Qty: {updated_qty}")
        # 1.5 should display as 1½
        assert updated_qty == "1½"

        # Verify Note Icon
        note_icon = page.locator("#history-body tr:first-child .notes-col button")
        assert note_icon.is_visible()

        # 8. Open Notes Popup
        print("Opening Notes Popup...")
        note_icon.click()
        time.sleep(0.5)

        # Verify Popup Content
        popup_textarea = page.locator(".notes-popup-textarea")
        assert popup_textarea.input_value() == "Taken with food"

        # Take Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
