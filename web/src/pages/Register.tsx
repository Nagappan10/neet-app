import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, register } from "../lib/api";
import { AuthCard, Field } from "../components/AuthCard";

export function RegisterPage(): JSX.Element {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(username, password, displayName);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Username and password only — nothing else needed."
      onSubmit={(e) => void handleSubmit(e)}
      error={error}
      busy={busy}
      submitLabel="Create account"
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Field
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        autoComplete="name"
        autoFocus
        required
        maxLength={50}
      />
      <Field
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
        minLength={3}
        maxLength={30}
        pattern="[a-zA-Z0-9_]+"
        title="Letters, digits and underscore only"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        minLength={8}
      />
    </AuthCard>
  );
}
