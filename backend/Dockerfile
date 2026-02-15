FROM python:3.10-slim

WORKDIR /app

# install system deps untuk audio
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /app/voiceverification

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
