import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { native } from "./io";

type Account = { connected: boolean; balance: number; frozen: number };
export function TripoConnection() {
  const [account, setAccount] = useState<Account>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setError("");
    setAccount(undefined);
    try {
      setAccount(await invoke<Account>("tripo_account"));
    } catch (e) {
      setError(
        typeof e === "string" ? e : "Could not check Tripo. Please retry.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <details className="sculpt-library tripo-connection">
      <summary>Tripo connection</summary>
      <p className="field-note">
        Check your saved API key and available credits. This check does not
        generate models or spend credits.
      </p>
      <button
        className="wide-button"
        disabled={!native || checking}
        onClick={() => void check()}
      >
        {checking ? "Checking Tripo…" : "Check Tripo connection"}
      </button>
      <div role="status" aria-live="polite">
        {account && (
          <p className="field-note">
            <strong>Connected</strong> · {account.balance.toLocaleString()} API
            credits available · {account.frozen.toLocaleString()} reserved
            {account.balance === 0 && (
              <>
                <br />
                Add API credits in Tripo before generating or processing models.
              </>
            )}
          </p>
        )}
        {error && <p className="field-note">{error}</p>}
        {!native && (
          <p className="field-note">
            Open the desktop app to use the key saved on this Mac.
          </p>
        )}
      </div>
    </details>
  );
}
