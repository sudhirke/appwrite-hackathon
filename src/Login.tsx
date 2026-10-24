import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, PawPrint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getCurrentUser, signIn, signUp, type AuthUser } from "./lib/auth";

type LoginProps = { onAuthenticated: (user: AuthUser) => void };

export function Login({ onAuthenticated }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    setIsLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        await signUp(String(formData.get("name")), email, password);
      } else {
        await signIn(email, password);
      }
      onAuthenticated(await getCurrentUser());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Welcome to Pets Heaven">
        <a className="brand" href="/" aria-label="Pets Heaven home">
          <span className="brand-mark"><PawPrint aria-hidden="true" /></span><span>Pets Heaven</span>
        </a>
        <div className="story-copy">
          <p className="eyebrow">Made for pet people</p>
          <h1>Every pet deserves a little piece of heaven.</h1>
          <p>Keep their world close—memories, milestones, and all the tiny moments that make life better.</p>
        </div>
        <p className="story-note">Loved by pets. Trusted by their humans.</p>
      </section>

      <section className="login-panel">
        <div className="mobile-brand brand">
          <span className="brand-mark"><PawPrint aria-hidden="true" /></span><span>Pets Heaven</span>
        </div>
        <div className="login-card">
          <header>
            <p className="eyebrow">{isSignup ? "Join the family" : "Welcome back"}</p>
            <h2>{isSignup ? "Create your account" : "Sign in to your account"}</h2>
            <p>{isSignup ? "Start keeping the moments that matter most." : "Enter your details to pick up where you left off."}</p>
          </header>
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {isSignup && (
              <div className="field-group">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" type="text" autoComplete="name" placeholder="Alex Morgan" minLength={2} required />
              </div>
            )}
            <div className="field-group">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="field-group">
              <div className="field-heading">
                <Label htmlFor="password">Password</Label>{!isSignup && <a href="#forgot-password">Forgot password?</a>}
              </div>
              <div className="password-field">
                <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            {!isSignup && <label className="remember-me"><input type="checkbox" name="remember" /><span>Keep me signed in</span></label>}
            <Button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? "Please wait…" : isSignup ? "Create account" : "Sign in"} {!isLoading && <ArrowRight aria-hidden="true" />}
            </Button>
            {message && <p className="form-message" role="status">{message}</p>}
          </form>
          <p className="signup-prompt">
            {isSignup ? "Already have an account?" : "New to Pets Heaven?"}{" "}
            <button type="button" onClick={() => { setIsSignup((value) => !value); setMessage(""); }}>
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
        <p className="legal-copy">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
      </section>
    </main>
  );
}

export default Login;
