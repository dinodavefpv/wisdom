from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose (empty note)
        page.click("button:has-text('Acetaminophen')")

        # 2. Click existing note icon
        print("Opening existing note (View Mode)...")
        # We need a note to test View Mode visuals.
        # Add a note first
        page.click("#history-body tr:first-child .notes-icon-btn")
        page.fill(".notes-modal-textarea", "Visual test note")
        page.click(".notes-modal-btn.save")
        page.wait_for_selector(".notes-modal-overlay", state="hidden")

        # Open View Mode
        page.click("#history-body tr:first-child .notes-icon-btn")
        page.wait_for_selector(".notes-modal-view:not(.hidden)")

        # 3. Take screenshot of View Mode (Should be transparent bg)
        page.screenshot(path="verification_visuals_view_mode.png")

        # 4. Switch to Edit Mode
        print("Switching to Edit Mode...")
        page.click(".notes-modal-view")

        # 5. Take screenshot of Edit Mode (Should be dark/blurred bg)
        page.screenshot(path="verification_visuals_edit_mode.png")

        browser.close()

if __name__ == "__main__":
    run()
