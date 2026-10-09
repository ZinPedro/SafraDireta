# Usa uma versão leve do Python
FROM python:3.10-slim

# Define a pasta de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo de dependências (ex: requirements.txt) e instala
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o restante do código do backend
COPY . .

# Expõe a porta da API FastAPI.
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]