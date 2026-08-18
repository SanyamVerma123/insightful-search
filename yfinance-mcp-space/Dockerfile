FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    YF_TZ_CACHE=/tmp/yfinance-tz-cache

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt && mkdir -p /tmp/yfinance-tz-cache

COPY app.py ./

EXPOSE 7860

CMD ["python", "app.py"]
