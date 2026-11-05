# Local OAuth and API token testing

The local development server supports optional Google OpenID Connect sign-in. Configure a Google OAuth web client with this redirect URI:

```text
http://127.0.0.1:8000/api/auth/google/callback
```

Set the client values in `backend/.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback
AUTH_FRONTEND_URL=http://127.0.0.1:5173
AUTH_LOCAL_TOKEN_DEBUG=true
```

After restarting the backend, the login page shows the Google button. Google identity is used only to create or reuse a PRINTFILM account; the Google access token is not stored. The callback returns a PRINTFILM JWT in the browser fragment, and the frontend removes it from the URL after storing it.

For local API testing, send the PRINTFILM JWT as a bearer token. The local-only endpoint can echo the current token for copying:

```text
GET http://127.0.0.1:8000/api/auth/dev-token
Authorization: Bearer <printfilm-jwt>
```

The endpoint returns `404` unless the request uses a loopback host, `DEBUG=true`, and `AUTH_LOCAL_TOKEN_DEBUG=true`. Do not enable that flag in a public deployment.

Generic ChatGPT OAuth is not enabled. OpenAI's Sign in with ChatGPT is currently limited to participating partners and does not provide an app with a ChatGPT or OpenAI API token. Use the configured model-provider API key for model calls instead.
