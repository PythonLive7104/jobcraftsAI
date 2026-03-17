FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build deps for pycairo (pulled in by svglib -> rlpycairo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "resumeai_backend.wsgi:application", "--bind", "0.0.0.0:8000"]
