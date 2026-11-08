FROM python:3.12.7-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir pytest==8.3.3 httpx==0.27.2
WORKDIR /tests
# Guarda la salida en /salida (evidencias/u2/pytest) y devuelve el codigo de pytest
ENTRYPOINT ["sh", "-c", "pytest -v -rA -p no:cacheprovider --junitxml=/salida/junit.xml . > /salida/resultado.txt 2>&1; c=$?; cat /salida/resultado.txt; exit $c"]
