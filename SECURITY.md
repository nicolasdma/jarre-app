# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue.**
2. Email the maintainers or use GitHub's private vulnerability reporting feature.
3. Include steps to reproduce, impact assessment, and any suggested fix.

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation within 7 days.

## Scope

- Authentication and authorization flaws
- API key or secret exposure
- Injection vulnerabilities (XSS, SQL injection, prompt injection)
- Insecure data handling

## Out of Scope

- Denial of service via rate limiting (Supabase/LLM provider handles this)
- Vulnerabilities in third-party dependencies (report upstream)
