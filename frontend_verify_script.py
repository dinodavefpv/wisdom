from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto("http://localhost:8080")

            # Wait for app load
            page.wait_for_selector(".edit-list-btn:not([disabled])", timeout=15000)

            # Ensure we have a dose logged (from previous runs or log new)
            # If no dose, log one
            if page.locator(".notes-icon-btn").count() == 0:
                print("Logging a dose...")
                page.click(".dose-btn >> nth=0")
                page.wait_for_selector(".notes-icon-btn", timeout=5000)

            print("Opening notes modal (initially Edit)...")
            notes_btn = page.locator(".notes-icon-btn").first
            notes_btn.click()

            page.wait_for_selector(".notes-modal-content", state="visible", timeout=5000)

            # Add a note if empty to force view mode later
            textarea = page.locator(".notes-modal-textarea")
            if textarea.is_visible():
                print("Adding note text...")
                textarea.fill("Frontend Verification Note")
                page.click(".notes-modal-btn.save")
                page.wait_for_selector(".notes-modal-content", state="hidden")

                # Re-open in view mode
                print("Re-opening in View Mode...")
                notes_btn.click()
                page.wait_for_selector(".notes-modal-content", state="visible")

            # Wait for view mode elements
            page.wait_for_selector(".notes-modal-view")

            # Take screenshot of the modal
            # We can screenshot just the modal or the whole page
            # Let's target the modal content to see the spacing clearly
            modal_content = page.locator(".notes-modal-content")
            modal_content.screenshot(path="frontend_verification.png")
            print("Screenshot saved to frontend_verification.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="frontend_error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
