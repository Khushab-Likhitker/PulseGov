from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from classifier import ComplaintClassificationAgent
from rabbitmq_consumer import start_consumer
import threading
import time

load_dotenv()

# Initialize AI Agent
classifier = ComplaintClassificationAgent()

def run_consumer_safely(agent):
    """Run consumer with retry logic or graceful failure"""
    try:
        start_consumer(agent)
    except Exception as e:
        print(f"⚠️  RabbitMQ Consumer failed to start: {e}")
        print("ℹ️  Service will continue in API-only mode.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start RabbitMQ consumer in background
    consumer_thread = threading.Thread(target=run_consumer_safely, args=(classifier,), daemon=True)
    consumer_thread.start()
    print("✅ Background tasks initialized")
    yield
    # Shutdown logic (if any) goes here

app = FastAPI(title="PulseGov AI Classifier Service", lifespan=lifespan)

class ClassificationRequest(BaseModel):
    text: str
    title: str
    
class ClassificationResponse(BaseModel):
    department_code: Optional[str]
    department_name: Optional[str]
    confidence: float
    explanation: str
    needs_manual_review: bool

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-classifier"}

@app.post("/classify", response_model=ClassificationResponse)
async def classify_complaint(request: ClassificationRequest):
    """
    Classify a complaint using Rule-Based AI Agent
    """
    try:
        result = classifier.classify(request.text, request.title)
        return ClassificationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv('PORT', 8001)))
