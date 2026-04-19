import Button from "../ui/Button";
import Modal from "./Modal";

function NoFormatsDialog({ state, onClose }) {
  if (!state.open) return null;

  return (
    <Modal
      title={state.title}
      footer={
        <Button onClick={onClose}>
          OK
        </Button>
      }
    >
      <p className="whitespace-pre-line text-sm text-app-muted">{state.message}</p>
      <p className="mt-3 text-xs text-app-muted">
        This usually means the app could not extract a usable format list from YouTube yet. Authentication or a retry can still help.
      </p>
      {state.detail && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-app-border bg-app-bg p-3 text-xs text-app-muted">
          {state.detail}
        </pre>
      )}
    </Modal>
  );
}

export default NoFormatsDialog;
