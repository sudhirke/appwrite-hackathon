import "./index.css";
import { useEffect, useState } from "react";
import { Home } from "./Home";
import { Login } from "./Login";
import { PublicPet } from "./PublicPet";
import { getCurrentUser, signOut, type AuthUser } from "./lib/auth";

export function App() {
  const publicToken = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)?.[1];
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    if (publicToken) { setIsCheckingSession(false); return; }
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsCheckingSession(false));
  }, [publicToken]);

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (publicToken) return <PublicPet token={publicToken} />;

  if (isCheckingSession) {
    return <div className="app-loading"><span className="loading-paw">🐾</span><p>Opening Pets Heaven…</p></div>;
  }

  return user ? <Home user={user} onSignOut={handleSignOut} /> : <Login onAuthenticated={setUser} />;
}

export default App;
