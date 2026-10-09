# n8n-nodes-juicer

n8n nodes for the [Juicer API](https://developers.juicer.io): social listening, social data lookups and social feeds in your workflows and AI agents.

- **Juicer**: search recent posts for a handle, hashtag or keyword across several platforms in one call, look up profiles and follower counts, and manage Juicer feeds, sources and post moderation. It can be used as a tool by n8n AI agents.
- **Juicer Trigger**: starts a workflow when Juicer finds new posts in your feeds, or when a connected social account expires.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Trigger](#trigger) · [Credits](#credits) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-juicer`.

## Credentials

1. Sign up at [juicer.io](https://www.juicer.io) and open the **Developer** page in your dashboard.
2. Create an API key. It starts with `jcr_`.
3. In n8n, create a **Juicer API** credential and paste the key. The **Test** button checks it against your account.

Use a key from the dashboard. Keys from the email-based quick start (`POST /v1/authorize`) expire, so they break scheduled workflows.

The Juicer API needs an API plan. The free Sandbox plan includes 30 credits to try it.

## Operations

### Social Data

One-off lookups. Nothing is stored in Juicer.

| Operation | What it does |
| --- | --- |
| Search Posts | Recent posts for a term on up to 14 platforms in one call: Bluesky, Facebook, Flickr, Giphy, Google reviews, Instagram, LinkedIn, Pinterest, Reddit, TikTok, Tumblr, Vimeo, X and YouTube |
| Look Up Profiles | Profile details and metrics (followers, posts, recent engagement) for up to 5 handles on each platform |

**Term Type** controls how the term is read:

| Term Type | Use it for |
| --- | --- |
| Auto-Detect | `#coffee` is a hashtag, anything else a username |
| Username | An account's own posts |
| Hashtag | Posts with a hashtag |
| Mentions / Keyword | Keyword search on Reddit and TikTok, @mentions on X |
| Channel | A subreddit on Reddit, a channel on YouTube |
| Reviews | Google reviews for a Google Place ID |

If one platform fails, the others still return. The node only errors when every platform fails, and then names the reason per platform. Set **Options > Output** to **Raw Response** to see the status and next-page cursor of each platform.

### Feed

A feed is a set of sources that Juicer keeps syncing in the background, with moderation and optional AI moderation. Feeds power both website embeds and listening.

Create, Get, Get Many, Update (name, sync interval, filters, AI moderation rules, AI sentiment filter), Get Embed Code and Delete.

### Source

Add, Get Many and Remove. The platform and term type lists load from your Juicer account, and term types that need a connected social account are marked.

### Post

Get Many (with status, date, text and source filters), Get, Approve and Reject.

## Trigger

**Juicer Trigger** registers a webhook in your Juicer account when you activate the workflow and deletes it when you deactivate it.

| Event | When |
| --- | --- |
| New Posts | A sync found new posts in one of your feeds |
| Social Account Expiring | A connected account expires within five days |
| Social Account Expired | A connected account stopped working |

Options:

- **Split Posts** (on by default): each new post becomes its own item, with the feed and source attached.
- **Feed IDs**: only posts from these feeds start the workflow.

Every delivery is checked against its `X-Juicer-Signature`, and unsigned or altered requests are rejected.

Juicer only delivers to HTTPS URLs. n8n Cloud works as is. A self-hosted n8n needs a public HTTPS address set in `WEBHOOK_URL`.

Posts held for moderation are included in New Posts with their `moderation_status` at the time they arrived.

## Credits

On credit-based API plans, fetching new posts spends credits. Reading data you already have is free.

- Search Posts and Look Up Profiles spend credits per platform on every run: 1 for most platforms, 3 for Instagram, LinkedIn and TikTok, 6 for Facebook. With **Return All** on, every extra page spends credits again.
- Feeds spend credits each time a source syncs, so an hourly feed costs about 24 times a daily one.
- Get, Get Many, moderation and the trigger itself are free.

When the balance runs out the node shows the error with a link to top up.

## Example workflows

The [`examples`](./examples) folder has three workflows to import:

- **Daily social digest**: searches Reddit and TikTok for your keyword every morning, summarizes it with an AI model and posts it to Slack.
- **Brand mention alert**: sends each new post from a Juicer listening feed to Telegram.
- **Weekly competitor tracker**: appends follower and post counts for a list of competitor accounts (one handle per platform) to Google Sheets every Monday, exact handle matches only.

## Compatibility

Built and tested with n8n 2.42 and `@n8n/node-cli` 0.51.

## Resources

- [Juicer API documentation](https://developers.juicer.io)
- [Authentication](https://developers.juicer.io/authentication)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](./LICENSE.md)
