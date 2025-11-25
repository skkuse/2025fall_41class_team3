# Auth API Response Schemas

## POST /api/auth/signup
```json
{
  "status": "success",
  "nickname": "string",
  "token": "string",          // access token (JWT)
  "refreshToken": "string",   // refresh token
  "expires_in": 3600           // access token TTL (seconds)
}
```

## POST /api/auth/login
```json
{
  "token": "string",          // access token (JWT)
  "refreshToken": "string",   // refresh token
  "expires_in": 3600,          // access token TTL (seconds)
  "nickname": "string"
}
```

## POST /api/auth/refresh
```json
{
  "token": "string",          // new access token (JWT)
  "refreshToken": "string",   // new refresh token
  "expires_in": 3600           // access token TTL (seconds)
}
```
