# Single deployable full-stack image: builds the React app and serves it
# from the Express server alongside the API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/web/package.json web/package.json
RUN npm ci --omit=dev
COPY --from=build /app/server/prisma server/prisma
RUN cd server && npx prisma generate
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
EXPOSE 4000
# Apply migrations, then start the API (which also serves web/dist).
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
