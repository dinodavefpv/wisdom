from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto("http://localhost:8080")

            page.wait_for_selector(".edit-list-btn:not([disabled])", timeout=15000)

            print("Logging a dose...")
            page.click(".dose-btn >> nth=0")

            page.wait_for_selector(".notes-icon-btn", timeout=5000)

            print("Opening notes modal (initially Edit)...")
            notes_btn = page.locator(".notes-icon-btn").first
            notes_btn.click()

            page.wait_for_selector(".notes-modal-content", state="visible", timeout=5000)

            # Type a note and save
            print("Adding note text...")
            page.fill(".notes-modal-textarea", "Test Note")

            # Save
            page.click(".notes-modal-btn.save")

            # Wait for modal to close
            page.wait_for_selector(".notes-modal-content", state="hidden")

            # Re-open (now should be View mode)
            print("Re-opening notes modal (View mode)...")
            notes_btn.click()

            page.wait_for_selector(".notes-modal-content", state="visible", timeout=5000)
            page.wait_for_timeout(1000)

            modal_content = page.locator(".notes-modal-content")
            view_div = page.locator(".notes-modal-view")
            hint_div = page.locator(".notes-modal-view-hint")

            content_box = modal_content.bounding_box()
            view_box = view_div.bounding_box()
            hint_box = hint_div.bounding_box()

            if not content_box:
                print("No modal content box")
                return

            print(f"Modal Content Height: {content_box['height']}")

            view_h = view_box['height'] if view_box else 0
            hint_h = hint_box['height'] if hint_box else 0

            print(f"View Div Height: {view_h}")
            print(f"Hint Div Height: {hint_h}")

            padding_top = page.eval_on_selector(".notes-modal-content", "el => parseFloat(window.getComputedStyle(el).paddingTop)")
            padding_bottom = page.eval_on_selector(".notes-modal-content", "el => parseFloat(window.getComputedStyle(el).paddingBottom)")
            gap = page.eval_on_selector(".notes-modal-content", "el => parseFloat(window.getComputedStyle(el).gap)")

            content_h = view_h + hint_h + gap
            expected_h = content_h + padding_top + padding_bottom

            print(f"Expected Height: {expected_h}")
            print(f"Actual Height: {content_box['height']}")

            excess = content_box['height'] - expected_h
            print(f"Excess Space: {excess}")

            page.screenshot(path="repro_measurement_fixed.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
