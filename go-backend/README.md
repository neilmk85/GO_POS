# POS Backend - Go 1.26 Migration

A modern Go backend for the POS system migration from Node.js to Go 1.26.

## Project Structure

```
go-backend/
├── cmd/
│   └── server/          # Application entry point
├── internal/
│   ├── config/          # Configuration management
│   ├── database/        # Database connection and setup
│   ├── util/            # Utility functions (JWT, bcrypt, validators, etc.)
│   └── handlers/        # HTTP handlers (TODO)
├── go.mod              # Go module definition
├── docker-compose.yml  # Local development environment
└── Dockerfile          # Production build configuration
```

## Setup

### Prerequisites

- Go 1.26 or higher
- MySQL 8.0+
- Docker & Docker Compose (optional, for containerized setup)

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your configuration

3. Install dependencies:
   ```bash
   go mod download
   ```

4. Run the server:
   ```bash
   go run ./cmd/server
   ```

### Using Docker Compose

```bash
docker-compose up
```

This will start both MySQL and the Go backend application.

## Configuration

Configuration is loaded from environment variables. See `.env.example` for all available options.

Key variables:
- `DB_DSN`: MySQL connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRY`: Access token expiration time
- `JWT_REFRESH_EXPIRY`: Refresh token expiration time
- `PORT`: Server port
- `ENV`: Environment (development/production)

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /api/health` - API health check

### Available Utilities

#### JWT
- `util.GenerateAccessToken(email)` - Generate access token
- `util.GenerateRefreshToken(email)` - Generate refresh token
- `util.VerifyToken(tokenString)` - Verify and decode token

#### Password Hashing
- `util.HashPassword(password)` - Hash password with bcrypt
- `util.ComparePassword(password, hash)` - Verify password

#### Validators
- `util.IsValidEmail(email)` - Email validation
- `util.ParseIntParam(r, name)` - Parse path parameter as int
- `util.ParseQueryInt(r, name, defaultVal)` - Parse query parameter as int
- `util.ParsePagination(r)` - Extract page/size from query

#### Response Helpers
- `util.SendSuccess(w, message, data)` - Send success response
- `util.SendError(w, statusCode, message)` - Send error response
- `util.SendPaginated(w, content, totalElements, totalPages, size, number)` - Send paginated response

#### Number Generation
- `util.GenerateOrderNumber(db, outletCode)` - Generate order number
- `util.GenerateInvoiceNumber(db)` - Generate invoice number
- `util.GenerateBarcode()` - Generate EAN-13 barcode

#### CSV
- `util.ParseCSVFile(file)` - Parse CSV file
- `util.WriteCSV(w, filename, headers, rows)` - Write CSV response

## Development Notes

TODO items in `cmd/server/main.go`:
- AutoMigrate models
- Seed initial data
- Setup complete router with all handlers
- Setup scheduled tasks/jobs

## Building for Production

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o pos-backend ./cmd/server
```

Or use the Dockerfile:
```bash
docker build -t pos-backend:latest .
```

## License

Proprietary - PPPipesProducts
