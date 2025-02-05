# Usar imagen base de Node.js
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /

# Copiar archivos de dependencias primero
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto de los archivos
COPY . .

# Variables de entorno (asegúrate de manejarlas adecuadamente en producción)
ENV NODE_ENV=production
ENV PORT=3001

# Exponer el puerto
EXPOSE 3001

# Comando para iniciar la aplicación
CMD ["node", "index.js"]