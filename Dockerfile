# Stage 1: Frontend Build
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=/api
ARG VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN npm run build

# Stage 2: Backend Runtime
FROM python:3.12-slim
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENABLE_LOCAL_AUTO_SHUTDOWN=0

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
