# Hosted (Azure Container Apps) image. Local use does not need Docker: `python -m app`.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    APP_DB=/tmp/app.db

WORKDIR /srv
COPY app ./app

# Unprivileged user; the SQLite demo DB lives in /tmp (ephemeral, re-seeded on every start).
RUN useradd --system --uid 10001 --no-create-home appuser
USER 10001

EXPOSE 8000
# APP_REMOTE_HOSTS (the public FQDN) is injected by the platform; without it the server refuses to bind 0.0.0.0.
CMD ["python", "-m", "app", "--host", "0.0.0.0", "--port", "8000"]
