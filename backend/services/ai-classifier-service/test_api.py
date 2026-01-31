import requests
import json

def test_api():
    url = "http://localhost:8001/classify"
    print(f"📡 Testing API at {url}...")
    
    payload = {
        "title": "Streetlight broken",
        "text": "The street light in front of my house is flickering and then went off. It is pitch dark."
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        print("\n✅ API Response Received:")
        print(json.dumps(data, indent=2))
        
        if data['department_code'] == 'ELC':
            print("\n🎉 SUCCESS: Agent correctly identified Electricity Department!")
        else:
            print("\n⚠️  Unexpected result.")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Could not connect to the service. Make sure 'py main.py' is running!")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_api()
