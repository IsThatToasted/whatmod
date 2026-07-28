# PulseLink static partner page

Copy this entire `toy` folder into the root of your GitHub Pages repository so it publishes at:

`https://whatmod.com/toy/`

The page contains no server-side code and stores no chat. It connects to the PulseLink WebSocket relay configured in the invite URL or in `config.js`.

## Important

GitHub Pages hosts only the interface. Remote sessions still require a public HTTPS/WSS relay. For a quick test, run `Start Public Test Relay.bat` from the full PulseLink package, copy the generated `https://*.trycloudflare.com` URL, and paste it into the extension's **Server URL** field.

Set the extension's **Invite base** to:

`https://whatmod.com/toy`

When an invite is created, the public relay URL is embedded in the invite's URL fragment. The partner can open it in Chrome, enter a name, and join without installing the extension. They can only control functions you explicitly permit, and your local bridge hard maximum still applies.

For a stable production URL, deploy the `server/` folder to a VPS or publish it through a named Cloudflare Tunnel, then place that stable HTTPS URL in `config.js` and in the extension's Server URL field.
