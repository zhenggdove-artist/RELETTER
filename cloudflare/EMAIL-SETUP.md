# RELETTER email notifications

The deployed backend queues one notification per successful player session,
new garden entry, and new chat message. Both recipients are fixed on the server:
`zhenggdove@gmail.com` and `partoftheszene@gmail.com`.

## Current setup: EmailJS without a postal address

EmailJS is active in production as of 2026-10-16. Gmail service
`service_dzz7nob` is connected. Template `template_00sseq2` has fixed To
`zhenggdove@gmail.com` and CC `partoftheszene@gmail.com`, subject `{{subject}}`
and escaped `{{message}}` content. Private message history storage is disabled.

The owner approved non-browser API access with mandatory Private Key verification.
All four EMAILJS_* settings are stored in Cloudflare Worker secrets, never in
frontend assets or Git. A real setup test was accepted and EmailJS history shows
OK for production outbox deliveries. This confirms provider acceptance, not each
recipient's inbox delivery.

Free plan: 200 requests/month. The worker sends one event per alarm, at least one
second apart; HTTP 429 defers retry for one minute. Older pending notifications
from setup are delivered automatically. EmailJS has no provider idempotency
guarantee, so a lost success response can cause a duplicate on retry.

https://www.emailjs.com/pricing/
https://www.emailjs.com/docs/rest-api/send/

## Previous alternative: Brevo (not activated)

The user requested an alternative after the Google consent flow remained blocked.
Brevo's free plan currently allows 300 email sends/day, about 150 events when
each event has two recipients. Signup is open in the browser and awaiting the
owner's signup. The owner accepted Brevo's terms in chat on 2026-10-15, but
Google signup returned "We could not process your sign-up request" and
"Could not connect to the reCAPTCHA service", including after a reload.
Owner handoff is needed to finish signup in their browser. No account or
API key has been created yet. No paid plan should be activated.

Verify `zhenggdove@gmail.com` as a sender named RELETTER in Brevo. Free-provider
sender addresses can be rewritten by Brevo for authentication/deliverability;
actual sending availability is subject to account approval. Then store these
Worker secrets (never in frontend, Git, logs, or chat):

* `BREVO_API_KEY`: transactional email API credential.
* `BREVO_SENDER_EMAIL`: the verified sender email address.

Brevo takes precedence when both secrets exist. Its transport uses plaintext,
fixed recipients, a stable UUID idempotency key per event, and deferred retries
for quota exhaustion. Brevo idempotency lasts 15 minutes; a timeout followed by
a retry beyond that window can duplicate a message. Provider acceptance is not
proof of inbox delivery. Confirm a real notification reaches both inboxes after
activation. Until credentials are configured, events remain queued and unsent.

Official references:
https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email
https://developers.brevo.com/reference/send-transac-email
https://developers.brevo.com/docs/heterogenous-versions-batch-emails

## Previous Google option (not activated)

Use the Google Apps Script source `GoogleMailRelay.gs`, owned by
`zhenggdove@gmail.com`. The project was created in the browser:
https://script.google.com/u/7/home/projects/1qpKyRC3EwwniF6uhlHai9rnaoOyQ48O7EI6BHCX73-85XhtZyDd506ys/edit

The first `initializeRelay` execution is awaiting the owner's Google mail-sending
consent. It requests MailApp sending only, not Gmail inbox reading. Browser
controls could read the OAuth warning but timed out trying to interact with it;
owner handoff was requested. No Google consent has been granted by the agent.

After owner consent: run initializeRelay, deploy as a web app executing as owner,
accessible to anyone (requests are protected by RELETTER_TOKEN and recipients
are fixed in the script). Store the deployment URL and token as Worker secrets
`GOOGLE_MAIL_RELAY_URL` and `GOOGLE_MAIL_RELAY_TOKEN`. Never commit the token.
The public URL must be `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`.
This Google option takes precedence over the optional Resend credentials below.

Free consumer Gmail Apps Script quota is 100 recipients/day (about 50 two-recipient
notifications). QUOTA responses remain pending and retry hourly without consuming
regular retry attempts. See https://developers.google.com/apps-script/guides/services/quotas .

## Optional Resend activation

No email credential or verified sending address was configured when this feature
was built. Queued events are **not delivered** until both Worker secrets exist:

* `RESEND_API_KEY`: a Resend sending key, stored using `wrangler secret put`.
* `NOTIFICATION_FROM`: a sender on your verified domain, e.g.
  `RELETTER <garden@your-domain.example>`.

Do not put credentials in the repository, frontend assets, or chat messages.
The Resend test sender is not sufficient for arbitrary recipient addresses.
See https://resend.com/docs/api-reference/emails/send-email .

After configuring the secrets, an authenticated request wakes pending delivery.
`GET /api/notifications/status` reports configuration state and pending/sent/failed
counts without exposing credentials or message contents. Activating delivery also
sends queued events, including events that occurred while configuration was pending.

## Delivery behavior

Notifications use the Durable Object SQLite outbox and alarm scheduler. Provider
idempotency keys prevent duplicate retries; duplicate garden saves and reconnects
within the same login session do not enqueue duplicate notifications. Both
recipients are included in the same provider request. Errors use exponential
backoff, up to eight attempts; exhausted attempts remain visible as failed.
Provider acceptance is tracked as sent; inbox delivery depends on the mail provider.
Automatic notifications are implemented in the production Cloudflare backend;
the standalone local Node preview does not send email.

Timestamp labels use Asia/Taipei and preserve each existing entry/message's stored
creation time. New labels are appended below content, aligned right, without
absolute positioning that could overlap text or images.

## Tests (no real email sent)

`node --test tests/notifications.test.js` tests payloads, recipients, idempotency
headers and failure handling with a mock provider. `node tests/cloudflare.mjs`
checks persisted event counts and duplicate-save handling against an isolated
local Wrangler instance with no email credentials configured.
