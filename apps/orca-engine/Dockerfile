FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -o /bin/orca-engine .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /bin/orca-engine /app/orca-engine
EXPOSE 9090
CMD ["/app/orca-engine"]
