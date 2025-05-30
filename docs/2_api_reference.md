# API Reference

Complete API documentation for the Last Frontier platform, including authentication, endpoints, request/response formats, and error handling.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
- [Status Codes](#status-codes)
- [Examples](#examples)

## Base URL

### Development
```
http://localhost:3000
```

### Production
```
https://api.lastfrontier.parallaxanalytics.com
```

## Authentication

The Last Frontier API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header for protected endpoints.

### Authentication Header

```http
Authorization: Bearer <jwt-token>
```

### JWT Token Structure

```json
{
  "userId": "uuid-string",
  "email": "user@example.com",
  "role": "explorer|professional|enterprise|admin",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `explorer` | Basic user access | Limited API calls, basic features |
| `professional` | Professional user | Higher limits, advanced features |
| `enterprise` | Enterprise user | High limits, all features |
| `admin` | Administrator | Full system access |

## Rate Limiting

API requests are rate-limited to prevent abuse and ensure fair usage.

### Limits

| Environment | Requests per Window | Window Duration |
|-------------|-------------------|-----------------|
| Development | 1000 requests | 15 minutes |
| Production | 100 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Exceeded Response

```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

## Response Format

All API responses follow a consistent JSON format.

### Success Response

```json
{
  "data": {
    // Response data
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": "Additional error details (development only)"
}
```

## Error Handling

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for the requested resource |
| `NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Endpoints

### Health Check

#### `GET /health`

Check the health status of the API and its dependencies.

**Authentication**: None required

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "server": "healthy"
  }
}
```

**Status Codes**:
- `200`: All services healthy
- `503`: One or more services unhealthy

---

### System Status

#### `GET /api/v1/status`

Get basic system information and version details.

**Authentication**: None required

**Response**:
```json
{
  "service": "Last Frontier Platform",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes**:
- `200`: Success

---

### User Profile

#### `GET /api/v1/profile`

Retrieve the authenticated user's profile information.

**Authentication**: Required (JWT token)

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "professional",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized (missing or invalid token)
- `404`: User not found
- `500`: Internal server error

**Error Examples**:

Missing token:
```json
{
  "error": "Access token required",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Invalid token:
```json
{
  "error": "Invalid or expired token",
  "code": "FORBIDDEN",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Status Codes

### Success Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request successful |
| `201` | Created - Resource created successfully |
| `204` | No Content - Request successful, no content returned |

### Client Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid request format or parameters |
| `401` | Unauthorized - Authentication required |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Resource conflict |
| `422` | Unprocessable Entity - Validation error |
| `429` | Too Many Requests - Rate limit exceeded |

### Server Error Codes

| Code | Description |
|------|-------------|
| `500` | Internal Server Error - Unexpected server error |
| `502` | Bad Gateway - Upstream service error |
| `503` | Service Unavailable - Service temporarily unavailable |
| `504` | Gateway Timeout - Upstream service timeout |

## Examples

### Basic Health Check

```bash
curl -X GET http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "database": "healthy",
    "server": "healthy"
  }
}
```

### Get System Status

```bash
curl -X GET http://localhost:3000/api/v1/status
```

Response:
```json
{
  "service": "Last Frontier Platform",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Get User Profile (Authenticated)

```bash
curl -X GET http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "role": "professional",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Response Example

```bash
curl -X GET http://localhost:3000/api/v1/profile
```

Response (401 Unauthorized):
```json
{
  "error": "Access token required",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Rate Limit Example

After exceeding rate limits:

```bash
curl -X GET http://localhost:3000/api/v1/status
```

Response (429 Too Many Requests):
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

## Security Headers

All API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
```

## CORS Configuration

### Development
- All origins allowed
- Credentials supported

### Production
- Specific origins only (configured via `ALLOWED_ORIGINS`)
- Credentials supported
- Methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- Headers: `Content-Type`, `Authorization`

## Testing the API

### Using curl

```bash
# Health check
curl -v http://localhost:3000/health

# Get status
curl -v http://localhost:3000/api/v1/status

# Get profile (requires token)
curl -v -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/profile
```

### Using Postman

1. Import the API collection (if available)
2. Set base URL to `http://localhost:3000`
3. Add Authorization header with Bearer token for protected endpoints
4. Test each endpoint with various scenarios

### Response Time Expectations

| Endpoint | Expected Response Time |
|----------|----------------------|
| `/health` | < 100ms |
| `/api/v1/status` | < 50ms |
| `/api/v1/profile` | < 200ms |

---

**Next Steps**: 
- Review [Security Guide](3_security_guide.md) for authentication best practices
- Check [Development Guide](5_development_guide.md) for testing procedures
- See [Troubleshooting Guide](6_troubleshooting_guide.md) for common API issues