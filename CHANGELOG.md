# Changelog

## 0.1.4

- Post > Search: find posts whose text or author contains a word, across one or more feeds, with optional date and platform filters and Return All. Feeds are required, because an account-wide text search can time out; a search that still takes too long now says how to narrow it.
- Fix: Return All dropped the other query parameters. Post and Feed > Get Many ignored their filters, and Social Data > Search Posts lost its term, when Return All was on.

## 0.1.3

Changes requested in n8n's verification review:

- Feed > Create: Sync Interval moved into an Additional Fields collection.
- Feed > Get: Include Sources moved into an Options collection.
- Social Data > Search Posts: Term Type is marked as a mode picker (no expressions), since Reddit and Google need it.

Workflows built on 0.1.2 or earlier with these two fields set need them re-entered in their new place.

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
