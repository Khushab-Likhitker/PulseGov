import re
from typing import Dict, List, Tuple

class ComplaintClassificationAgent:
    """
    Rule-Based AI Agent for Citizen Grievance Redressal.
    Deterministic, explainable, and audit-ready.
    """
    
    def __init__(self):
        self.confidence_threshold = 0.7
        # Define department rules (Keywords -> Department Code)
        self.department_rules = self._load_rules()
        
    def _load_rules(self) -> List[Dict]:
        """Load keyword mapping for all 13 departments"""
        return [
            {
                "code": "MUN",
                "name": "Municipal Services",
                "keywords": ["garbage", "trash", "waste", "sanitation", "cleanliness", "dustbin", "rubbish", "sweeping", "debris"]
            },
            {
                "code": "ELC",
                "name": "Electricity Department",
                "keywords": ["power", "electricity", "voltage", "current", "poles", "street light", "streetlight", "dark", "no light", "wire", "transformer"]
            },
            {
                "code": "WTR",
                "name": "Water Supply Department",
                "keywords": ["water", "leakage", "supply", "pipe", "tap", "drinking water", "dirty water", "pressure", "no water", "tanker"]
            },
            {
                "code": "PWD",
                "name": "Public Works Department",
                "keywords": ["road", "bridge", "pothole", "drainage", "construction", "repair", "footpath", "pavement", "building", "flyover"]
            },
            {
                "code": "POL",
                "name": "Police Department",
                "keywords": ["theft", "crime", "police", "safety", "traffic", "law", "order", "harassment", "cyber", "robbery", "assault", "stole", "steal", "pickpocket"]
            },
            {
                "code": "FIR",
                "name": "Fire & Emergency Services",
                "keywords": ["fire", "smoke", "flame", "burn", "blast", "emergency", "rescue", "cylinder", "explosion"]
            },
            {
                "code": "HLT",
                "name": "Health Department",
                "keywords": ["hospital", "doctor", "medicine", "health", "disease", "food poisoning", "clinic", "ambulance", "vaccination", "dengue", "malaria"]
            },
            {
                "code": "WLF",
                "name": "Women & Child Welfare",
                "keywords": ["women", "child", "domestic violence", "dowry", "harassment", "abuse", "protection", "kid", "shelter"]
            },
            {
                "code": "SOC",
                "name": "Social Welfare Department",
                "keywords": ["pension", "scholarship", "subsidy", "welfare", "scheme", "senior citizen", "disability", "caste", "ration"]
            },
            {
                "code": "EDU",
                "name": "Education Department",
                "keywords": ["school", "college", "teacher", "student", "admission", "fees", "syllabus", "exam", "education", "books", "university"]
            },
            {
                "code": "EMP",
                "name": "Employment & Skill Development",
                "keywords": ["job", "employment", "unemployment", "skill", "training", "vacancy", "work", "recruitment", "placement"]
            },
            {
                "code": "TRN",
                "name": "Transport Department",
                "keywords": ["bus", "transport", "license", "registration", "vehicle", "driver", "ticket", "fare", "rto", "traffic signal"]
            },
            {
                "code": "URB",
                "name": "Urban Development Authority",
                "keywords": ["zoning", "layout", "plot", "approval", "encroachment", "planning", "urban", "khata", "property", "illegal construction"]
            }
        ]
    
    def preprocess_text(self, text: str) -> str:
        """Normalize text for consistent matching"""
        text = text.lower()
        # Remove special chars but keep spaces
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        # Collapse multiple spaces
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def classify(self, text: str, title: str = "") -> Dict:
        """
        Analyze text and return predicted department with confidence score.
        """
        # Combine title and body for better context
        full_text = f"{title} {text}"
        normalized_text = self.preprocess_text(full_text)
        
        matches = []
        
        for rule in self.department_rules:
            matched_keywords = []
            
            for keyword in rule['keywords']:
                # Look for whole word matches to avoid substrings (e.g., 'car' in 'scar')
                # Using regex word boundary \b
                if re.search(r'\b' + re.escape(keyword) + r'\b', normalized_text):
                    matched_keywords.append(keyword)
            
            if matched_keywords:
                # Calculate confidence
                # Base score: 0.5 for 1 keyword
                # +0.2 for each additional keyword
                # Cap at 0.95 (leave 0.05 uncertainty)
                score = 0.5 + (len(matched_keywords) - 1) * 0.2
                confidence = min(score, 0.95)
                
                matches.append({
                    "department_code": rule['code'],
                    "department_name": rule['name'],
                    "confidence": confidence,
                    "matched_keywords": matched_keywords
                })
        
        # If no matches found
        if not matches:
            return {
                "department_code": None,
                "department_name": None,
                "confidence": 0.0,
                "explanation": "No relevant keywords found in the complaint text.",
                "needs_manual_review": True
            }
            
        # Sort matches by confidence (highest first)
        matches.sort(key=lambda x: x['confidence'], reverse=True)
        top_match = matches[0]
        
        # Generate explanation
        keywords_str = ", ".join(f"'{k}'" for k in top_match['matched_keywords'])
        explanation = (
            f"Classified as {top_match['department_name']} ({top_match['department_code']}) "
            f"because it contains keywords: {keywords_str}."
        )
        
        needs_review = top_match['confidence'] < self.confidence_threshold
        
        return {
            "department_code": top_match['department_code'],
            "department_name": top_match['department_name'],
            "confidence": top_match['confidence'],
            "explanation": explanation,
            "needs_manual_review": needs_review
        }
