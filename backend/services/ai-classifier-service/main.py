from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
from dotenv import load_dotenv
from classifier import ComplaintClassifier
from rabbitmq_consumer import start_consumer
import threading

load_dotenv()

app = FastAPI(title="PulseGov AI Classifier Service")

# Initialize classifier
classifier = ComplaintClassifier(model_path=os.getenv('MODEL_PATH', './models'))

class ClassificationRequest(BaseModel):
    text: str
    title: str
    
class ClassificationResponse(BaseModel):
    category_id: int
    category_name: str
    confidence: float
    department_id: int
    keywords_matched: List[str]
    needs_manual_review: bool

@app.on_event("startup")
async def startup_event():
    """Start RabbitMQ consumer in background"""
    consumer_thread = threading.Thread(target=start_consumer, args=(classifier,), daemon=True)
    consumer_thread.start()
    print("✅ RabbitMQ consumer started")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-classifier"}

@app.post("/classify", response_model=ClassificationResponse)
async def classify_complaint(request: ClassificationRequest):
    """
    Classify a complaint using AI/ML model
    """
    try:
        result = classifier.classify(request.text, request.title)
        return ClassificationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

@app.post("/train")
async def trigger_training():
    """
    Trigger model retraining (in production, this would be async)
    """
    try:
        # In real implementation, this would be a background task
        return {"message": "Training scheduled", "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv('PORT', 8001)))
