FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY api seed ./
RUN chmod +x api seed && mkdir -p /app/uploads && chown app /app/uploads
USER app
EXPOSE 8080
CMD ["/app/api"]
