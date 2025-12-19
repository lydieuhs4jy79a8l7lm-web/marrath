# Étape 1 : Build de l'application React
FROM node:20-alpine as build
WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code source et compilation
COPY . .
RUN npm run build

# Étape 2 : Serveur web Nginx
FROM nginx:alpine
# Copie des fichiers compilés (dist) vers le dossier par défaut de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copie de la configuration Nginx personnalisée
# Note : On utilise nginx.txt car c'est le nom du fichier présent dans le projet
COPY nginx.txt /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]