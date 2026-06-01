# TradeScans plugin marketplace

Public marketplace for the **TradeScans** Claude plugin — a trading journal,
options strategy engine, and community board, backed by your own TradeScans
account.

## Install (for users)

```
/plugin marketplace add jefferyvincent/tradescans-claude-plugin
/plugin install tradescans@tradescans
```

Then add a TradeScans API key as described in the plugin's own README
(`plugins/tradescans/README.md`). Each user supplies their own `ts_live_…` key —
no credentials are bundled here.

## Publish (one time, by the maintainer)

1. Create a new **public** GitHub repo named `tradescans-claude-plugin` under
   your account.
2. From this folder:

   ```bash
   git init
   git add .
   git commit -m "TradeScans plugin marketplace"
   git branch -M main
   git remote add origin https://github.com/jefferyvincent/tradescans-claude-plugin.git
   git push -u origin main
   ```

That's it — the marketplace is live. Share the two install commands above.

## Updating

Edit the plugin under `plugins/tradescans/`, bump `version` in
`plugins/tradescans/.claude-plugin/plugin.json`, then commit and push. Users
pick up changes with `/plugin marketplace update tradescans`.

## Layout

```
.claude-plugin/marketplace.json   catalog (lists the plugin + its source path)
plugins/tradescans/               the plugin itself
```
