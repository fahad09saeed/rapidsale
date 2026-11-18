FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN adduser -D -u 10001 app
COPY --chown=app . .
USER app
EXPOSE 3000
CMD ["node", "server.js"]
