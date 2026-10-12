# Changelog

## 0.1.2

- Search Posts retries a platform once when it fails for a temporary reason (timeout or upstream error). Failed platforms spend no credits.
- When a platform still fails while others succeed, the output now includes one item for it with `error: true`, `platform`, `error_code` and `message`, instead of a silently partial result.

## 0.1.1

- No code changes. First release published through npm trusted publishing from GitHub Actions, with no stored token.

## 0.1.0

First release.

- Juicer node: Social Data (Search Posts, Look Up Profiles), Feed (Create, Get, Get Many, Update, Get Embed Code, Delete), Source (Add, Get Many, Remove) and Post (Get Many, Get, Approve, Reject). Usable as an AI agent tool.
- Juicer Trigger: New Posts, Social Account Expiring and Social Account Expired, with webhook signature checks.
- Example workflows: daily social digest, brand mention alert and weekly competitor tracker.
