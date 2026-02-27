import requests
import json

AIRTABLE_API_URL = "https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4"
AIRTABLE_API_KEY = "patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea"
HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}"
}

def delete_test_records():
    # Fetch records
    try:
        response = requests.get(AIRTABLE_API_URL, headers=HEADERS)
        response.raise_for_status()
        records = response.json().get("records", [])
    except Exception as e:
        print(f"Error fetching records: {e}")
        return

    ids_to_delete = []
    for record in records:
        fields = record.get("fields", {})
        notes = fields.get("Notes", "")
        # Identify test records
        if notes in ["Taken with food", "Headache relief"]:
            ids_to_delete.append(record["id"])
            print(f"Found test record: {fields.get('Medicine')} - {notes}")

    if not ids_to_delete:
        print("No test records found.")
        return

    print(f"Deleting {len(ids_to_delete)} records...")

    # Delete in chunks of 10
    for i in range(0, len(ids_to_delete), 10):
        chunk = ids_to_delete[i:i+10]
        params = [('records[]', id) for id in chunk]
        try:
            del_response = requests.delete(AIRTABLE_API_URL, headers=HEADERS, params=params)
            del_response.raise_for_status()
            print(f"Deleted chunk: {chunk}")
        except Exception as e:
            print(f"Error deleting chunk {chunk}: {e}")

if __name__ == "__main__":
    delete_test_records()
