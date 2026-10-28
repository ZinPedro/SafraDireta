# Usa uma imagem do Node.js (necessário para rodar projetos TS/CSS locais)
FROM node:22-alpine

# Define a pasta de trabalho
WORKDIR /app

# Copia os arquivos de configuração de pacotes
COPY package*.json ./

# Instala as dependências travadas no lockfile.
RUN npm ci

# Copia o restante do código do frontend
COPY . .

# Expõe a porta do frontend.
# Se vocês usaram Vite, a porta padrão é 5173. Se foi React puro, é 3000.
EXPOSE 5173

# Comando para iniciar o servidor do frontend. Ajuste se for "npm start"
CMD ["npm", "run", "dev", "--", "--host"]