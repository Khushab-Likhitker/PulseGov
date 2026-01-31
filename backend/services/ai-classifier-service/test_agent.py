from classifier import ComplaintClassificationAgent

def test_agent():
    print("🤖 Testing AI Agent...")
    agent = ComplaintClassificationAgent()
    
    test_cases = [
        {
            "text": "The garbage has not been collected for 3 days. It smells bad.",
            "expected": "MUN"
        },
        {
            "text": "Streetlight on Main Road is broken and it is very dark.",
            "expected": "ELC"
        },
        {
            "text": "Water pipe burst near the junction, lot of water wasting.",
            "expected": "WTR"
        },
        {
            "text": "Someone stole my wallet at the market.",
            "expected": "POL"
        },
        {
            "text": "I lost my keys.", 
            "expected": None # Low confidence expected
        }
    ]
    
    passed = 0
    for case in test_cases:
        result = agent.classify(case['text'])
        print(f"\n📝 Text: {case['text']}")
        print(f"👉 Predicted: {result['department_code']} (Confidence: {result['confidence']})")
        print(f"ℹ️  Explanation: {result['explanation']}")
        
        if result['department_code'] == case['expected'] or (case['expected'] is None and result['needs_manual_review']):
            print("✅ PASS")
            passed += 1
        else:
            print(f"❌ FAIL (Expected {case['expected']})")
            
    print(f"\nResult: {passed}/{len(test_cases)} passed.")

if __name__ == "__main__":
    test_agent()
