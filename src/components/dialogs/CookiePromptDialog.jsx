import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "./Modal";

function CookiePromptDialog({
  open,
  cookiePrompt,
  cookieBrowser,
  setCookieBrowser,
  cookieBrowserOptions,
  cookiesFilePath,
  onChooseCookiesFile,
  onRetryWithCookies,
  onRetryWithCookiesFile,
  onOpenCookieExtension,
  onOpenCookieGuide,
  onClose,
  cookieRetrying,
  cookieFileRetrying
}) {
  if (!open) return null;

  return (
    <Modal
      title="Authentication Required"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onRetryWithCookies} disabled={cookieRetrying || cookieFileRetrying}>
            {cookieRetrying ? "Retrying..." : "Retry With Cookies"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-app-muted">
        {cookiePrompt.message ||
          "This video needs a signed-in browser session. Choose a browser and retry metadata fetch."}
      </p>

      {cookiePrompt.detail && (
        <pre className="mt-4 max-h-32 overflow-auto rounded-2xl border border-app-border bg-app-bg p-3 text-xs text-app-muted">
          {cookiePrompt.detail}
        </pre>
      )}

      <div className="mt-4">
        <Input
          as="select"
          label="Browser cookies"
          value={cookieBrowser}
          onChange={(event) => setCookieBrowser(event.target.value)}
        >
          {cookieBrowserOptions
            .filter((item) => cookiePrompt.supportedBrowsers.includes(item.value))
            .map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
        </Input>
      </div>

      {cookiePrompt.canUseCookiesFile && (
        <div className="mt-4 rounded-2xl border border-app-border bg-app-cardMuted p-4">
          <p className="text-sm text-app-muted">
            Browser cookie access failed. Export a `cookies.txt` file and retry with file import.
          </p>

          <details className="mt-4 rounded-2xl border border-app-border bg-app-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-app-text">
              How to export `cookies.txt`
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-app-muted">
              <li>Open your browser and log in to YouTube.</li>
              <li>Install the recommended `Get cookies.txt LOCALLY` extension.</li>
              <li>Export YouTube cookies in Netscape format and save the file as `cookies.txt`.</li>
              <li>Select that file below, then retry using the cookies file path.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={onOpenCookieExtension}>
                Open extension
              </Button>
              <Button variant="ghost" onClick={onOpenCookieGuide}>
                Open official guide
              </Button>
            </div>
          </details>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <Input className="flex-1" label="Cookies file" value={cookiesFilePath} readOnly placeholder="Select cookies.txt..." />
            <Button variant="secondary" onClick={onChooseCookiesFile}>
              Choose file
            </Button>
          </div>

          <Button
            className="mt-4 w-full"
            variant="secondary"
            onClick={onRetryWithCookiesFile}
            disabled={!cookiesFilePath || cookieFileRetrying || cookieRetrying}
          >
            {cookieFileRetrying ? "Retrying With File..." : "Retry With Cookies File"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

export default CookiePromptDialog;
