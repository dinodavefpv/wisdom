from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose
        page.click("button:has-text('Acetaminophen')")

        # 2. Click the empty notes icon (should be opacity 0.3)
        # We find the icon in the first row
        page.click("#history-body tr:first-child .notes-icon-btn")

        # 3. Wait for modal overlay
        page.wait_for_selector(".notes-modal-overlay")

        # 4. Fill text
        page.fill(".notes-modal-textarea", "Testing modal layout")

        # 5. Take screenshot of modal open
        page.screenshot(path="verification_notes_modal.png")

        # 6. Save
        page.click(".notes-modal-btn.save")

        # 7. Verify modal closes
        page.wait_for_selector(".notes-modal-overlay", state="hidden")

        # 8. Verify icon opacity is now 1 (no 'empty-note' class)
        # Note: We might need to reload or re-select to check class update if not reactive immediately,
        # but our code calls renderHistory() so it should be immediate.
        page.wait_for_selector("#history-body tr:first-child .notes-icon-btn:not(.empty-note)")

        browser.close()

if __name__ == "__main__":
    run()
