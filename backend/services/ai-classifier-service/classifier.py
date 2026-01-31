import numpy as np
import re
from typing import Dict, List, Tuple
import json

class ComplaintClassifier:
    """
    Hybrid Rule-based + ML Classifier for complaints
    Phase 1: Rule-based keyword matching
    Phase 2: Could integrate BERT/TensorFlow model for advanced classification
    """
    
    def __init__(self, model_path: str = './models'):
        self.model_path = model_path
        
        # Load category definitions (in production, load from database)
        self.categories = self._load_categories()
        self.confidence_threshold = 0.75
        
    def _load_categories(self) -> List[Dict]:
        """Load category definitions with keywords"""
        return [
            {
                "id": 1,
                "name": "Streetlight Not Working",
                "code": "LIGHT-001",
                "department_id": 1,
                "keywords": ["streetlight", "street light", "light", "bulb", "dark", "night", "lamp post"],
                "priority": "medium"
            },
            {
                "id": 2,
                "name": "Power Outage",
                "code": "POWER-001",
                "department_id": 1,
                "keywords": ["power", "electricity", "outage", "blackout", "supply", "current", "voltage"],
                "priority": "high"
            },
            {
                "id": 3,
                "name": "Water Leakage",
                "code": "WATER-001",
                "department_id": 2,
                "keywords": ["water", "leak", "leakage", "pipe", "burst", "overflow", "dripping"],
                "priority": "high"
            },
            {
                "id": 4,
                "name": "No Water Supply",
                "code": "WATER-002",
                "department_id": 2,
                "keywords": ["water", "supply", "tap", "shortage", "no water", "dry"],
                "priority": "high"
            },
            {
                "id": 5,
                "name": "Pothole on Road",
                "code": "ROAD-001",
                "department_id": 3,
                "keywords": ["pothole", "road", "damage", "crater", "hole", "damaged road"],
                "priority": "medium"
            },
            {
                "id": 6,
                "name": "Garbage Not Collected",
                "code": "GARB-001",
                "department_id": 4,
                "keywords": ["garbage", "waste", "trash", "collection", "not collected", "rubbish"],
                "priority": "medium"
            },
            {
                "id": 7,
                "name": "Overflowing Dustbin",
                "code": "GARB-002",
                "department_id": 4,
                "keywords": ["dustbin", "overflow", "bin", "full", "overflowing"],
                "priority": "low"
            },
            {
                "id": 8,
                "name": "Stray Animals",
                "code": "HEALTH-001",
                "department_id": 5,
                "keywords": ["dog", "stray", "animal", "bite", "dogs", "animals"],
                "priority": "medium"
            },
            {
                "id": 9,
                "name": "Mosquito Menace",
                "code": "HEALTH-002",
                "department_id": 5,
                "keywords": ["mosquito", "dengue", "malaria", "insect", "mosquitoes", "breeding"],
                "priority": "medium"
            },
            {
                "id": 10,
                "name": "Illegal Parking",
                "code": "POLICE-001",
                "department_id": 6,
                "keywords": ["parking", "illegal", "vehicle", "block", "parked", "blocking"],
                "priority": "low"
            },
            {
                "id": 11,
                "name": "Noise Pollution",
                "code": "ENV-001",
                "department_id": 8,
                "keywords": ["noise", "sound", "loud", "pollution", "disturbance"],
                "priority": "low"
            },
            {
                "id": 12,
                "name": "Tree Fallen",
                "code": "ENV-002",
                "department_id": 8,
                "keywords": ["tree", "fallen", "branch", "blocking", "fell", "collapse"],
                "priority": "high"
            }
        ]
    
    def preprocess_text(self, text: str) -> str:
        """Clean and normalize text"""
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s]', '', text)
        return text
    
    def keyword_matching(self, text: str) -> List[Tuple[Dict, float, List[str]]]:
        """
        Match keywords from categories
        Returns: List of (category, confidence, matched_keywords)
        """
        text = self.preprocess_text(text)
        matches = []
        
        for category in self.categories:
            matched_keywords = []
            keyword_count = 0
            
            for keyword in category['keywords']:
                keyword_lower = keyword.lower()
                if keyword_lower in text:
                    matched_keywords.append(keyword)
                    keyword_count += 1
            
            if keyword_count > 0:
                # Calculate confidence based on keyword matches
                confidence = min(keyword_count / len(category['keywords']), 1.0)
                
                # Boost confidence if multiple keywords match
                if keyword_count >= 2:
                    confidence = min(confidence * 1.3, 0.95)
                
                matches.append((category, confidence, matched_keywords))
        
        # Sort by confidence
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches
    
    def classify(self, text: str, title: str = "") -> Dict:
        """
        Main classification method
        """
        # Combine title and text for better context
        full_text = f"{title} {text}"
        
        matches = self.keyword_matching(full_text)
        
        if not matches:
            # No matches - needs manual review
            return {
                "category_id": None,
                "category_name": "Unclassified",
                "confidence": 0.0,
                "department_id": None,
                "keywords_matched": [],
                "needs_manual_review": True
            }
        
        # Get top match
        top_category, confidence, keywords = matches[0]
        
        # Check if confidence is above threshold
        needs_manual_review = confidence < self.confidence_threshold
        
        return {
            "category_id": top_category['id'],
            "category_name": top_category['name'],
            "confidence": round(confidence, 4),
            "department_id": top_category['department_id'],
            "keywords_matched": keywords,
            "needs_manual_review": needs_manual_review
        }
    
    def get_similar_categories(self, text: str, top_k: int = 3) -> List[Dict]:
        """Get top K similar categories for suggestions"""
        matches = self.keyword_matching(text)
        return [
            {
                "category_id": cat['id'],
                "category_name": cat['name'],
                "confidence": conf,
                "keywords_matched": kw
            }
            for cat, conf, kw in matches[:top_k]
        ]
