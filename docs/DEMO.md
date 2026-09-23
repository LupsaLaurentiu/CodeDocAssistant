# Demo artifacts

The committed screenshots and `demo/ux-walkthrough.webm` show the real UI with an **isolated, explicitly labelled test fixture**. The question response is intercepted by Playwright. They demonstrate UX, not live generation quality; no fake-answer mode exists in the product.

The walkthrough opens an indexed repository, asks a controlled question, opens its real fixture chunk, switches to mobile and reloads the persisted conversation.

To regenerate, follow [TESTING.md](TESTING.md) to start the isolated test app, then:

```powershell
$env:CAPTURE_DEMO = '1'
npm run test:e2e -- e2e/demo.spec.ts
```

On macOS/Linux: `CAPTURE_DEMO=1 npm run test:e2e -- e2e/demo.spec.ts`.

For a live submission video, use a small public repository, show the actual indexing and verified source preview, then ask both an answerable and unanswerable question. Disclose the repository and model used. Do not display the terminal environment, provider dashboard or API keys. This live run is optional and incurs API usage.
