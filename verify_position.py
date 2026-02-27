from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Verify Mobile View
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto("http://localhost:8000")

        # 1. Add a dose (empty note)
        page.click("button:has-text('Acetaminophen')")

        # 2. Add note to it via edit modal (to have existing note)
        page.click("#history-body tr:first-child")
        page.wait_for_selector("#edit-modal")
        page.fill("#edit-notes", "Testing positioning")
        page.click(".save-btn")

        # 3. Open View Mode (should be positioned)
        print("Opening view mode...")
        page.click("#history-body tr:first-child .notes-icon-btn")
        page.wait_for_selector(".notes-modal-view:not(.hidden)")

        # 4. Screenshot View Mode
        page.screenshot(path="verification_view_position.png")

        # 5. Click overlay (tap away) - should close
        # To click overlay, we need to click outside content.
        # Overlay is full screen, content is small.
        # Click top left corner (0,0)
        print("Tapping away...")
        page.mouse.click(10, 10)

        # 6. Verify closed
        page.wait_for_selector(".notes-modal-overlay", state="hidden")

        browser.close()

if __name__ == "__main__":
    run()
