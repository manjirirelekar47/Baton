# Build context is the repo root (the API needs backend/, db/schema/ and contracts/samples/).
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY backend/requirements.txt backend/requirements.txt
COPY backend/requirements backend/requirements
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY db db
COPY contracts contracts
WORKDIR /srv/backend
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
