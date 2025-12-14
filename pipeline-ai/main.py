from fastapi import FastAPI
from app.api import router as api_router

app = FastAPI(title="Pipeline AI Agent Service", version="1.0.0")

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "pipeline-ai"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
