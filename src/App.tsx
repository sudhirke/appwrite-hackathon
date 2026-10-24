import "./index.css";
import { useEffect, useState } from "react";
import { Home } from "./Home";
import { Login } from "./Login";
import { getCurrentUser, signOut, type AuthUser } from "./lib/auth";

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsCheckingSession(false));
  }, []);

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (isCheckingSession) {
    return <div className="app-loading"><span className="loading-paw">🐾</span><p>Opening Pets Heaven…</p></div>;
  }

  return user ? <Home user={user} onSignOut={handleSignOut} /> : <Login onAuthenticated={setUser} />;
}

export default App;
