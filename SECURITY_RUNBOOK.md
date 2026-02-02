# Security Runbook (Admin)

## Immediate Takedown (Stop Access Fast)
1. **Block traffic at the host**: Scale the backend service to zero or disable the deployment in your hosting provider dashboard (Railway/Render/Fly/Heroku/etc.).
2. **Disable the frontend**: Take down the frontend service or point DNS to a maintenance page.
3. **Rotate secrets immediately**:
   - `JWT_SECRET`
   - `DATABASE_URL` credentials
   - `SMTP_*` credentials
4. **Invalidate all family sessions**:
   - Delete rows in `family_sessions`
   - Update family password (forces re-verification)

## If You Suspect a Hack
1. **Containment**
   - Take services offline (above).
   - Rotate all secrets and database passwords.
2. **Preserve Evidence**
   - Export audit logs from the Admin Panel.
   - Save application logs from the hosting provider.
3. **Eradication**
   - Identify the entry point (credentials leak, vulnerable dependency, misconfig).
   - Patch the issue and redeploy from a clean commit.
4. **Recovery**
   - Restore from a known-good backup if needed.
   - Re-enable services and monitor traffic.
5. **Post-Incident**
   - Review audit logs and user list.
   - Add rate limits, tighten CORS, update dependencies.
   - Notify users if sensitive data was exposed.

## Routine Hardening Checklist
- Keep dependencies up to date (`npm audit`).
- Ensure `JWT_SECRET` is strong and rotated periodically.
- Keep `ADMIN_ALERT_EMAIL` and SMTP creds secure.
- Review audit logs weekly.
