from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose (empty note)
        page.click("button:has-text('Acetaminophen')")

        # 2. Click empty note icon
        print("Opening empty note (Edit Mode)...")
        page.click("#history-body tr:first-child .notes-icon-btn")

        # 3. Verify textarea is visible (Edit Mode)
        page.wait_for_selector(".notes-modal-textarea:not(.hidden)")
        # Check that view mode is hidden (by checking class presence or not being visible)
        # Note: wait_for_selector waits for visibility by default unless state="attached"
        page.wait_for_selector(".notes-modal-view", state="hidden")

        # 4. Fill and Save
        page.fill(".notes-modal-textarea", "Initial note")
        page.click(".notes-modal-btn.save")
        page.wait_for_selector(".notes-modal-overlay", state="hidden")

        # 5. Click existing note icon
        print("Opening existing note (View Mode)...")
        page.click("#history-body tr:first-child .notes-icon-btn")

        # 6. Verify view div is visible (View Mode)
        page.wait_for_selector(".notes-modal-view:not(.hidden)")
        page.wait_for_selector(".notes-modal-textarea", state="hidden")

        # 7. Take screenshot of View Mode
        page.screenshot(path="verification_notes_view_mode.png")

        # 8. Click to Edit
        print("Switching to Edit Mode...")
        page.click(".notes-modal-view")

        # 9. Verify textarea visible
        page.wait_for_selector(".notes-modal-textarea:not(.hidden)")

        # 10. Take screenshot of Edit Mode
        page.screenshot(path="verification_notes_edit_mode.png")

        browser.close()

if __name__ == "__main__":
    run()
