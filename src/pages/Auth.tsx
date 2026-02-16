import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable/index";
import { AnimatedLoginPage } from "@/components/ui/animated-characters-login-page";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, isAuthenticated, loading: authLoading } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    // Validate
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) return { error: emailResult.error.errors[0].message };
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) return { error: pwResult.error.errors[0].message };

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error.message.includes("Invalid login") ? "Invalid email or password." : error.message;
          toast({ title: "Login failed", description: msg, variant: "destructive" });
          return { error: msg };
        }
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        navigate("/");
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({ title: "Account exists", description: "This email is already registered.", variant: "destructive" });
            setIsLogin(true);
            return { error: "This email is already registered." };
          }
          toast({ title: "Signup failed", description: error.message, variant: "destructive" });
          return { error: error.message };
        }
        toast({ title: "Account created!", description: "Welcome!" });
        navigate("/");
      }
    } catch (e) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      return { error: "Something went wrong." };
    } finally {
      setLoading(false);
    }
    return {};
  }, [isLogin, signIn, signUp, displayName, toast, navigate]);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast({ title: "Google Sign In failed", description: error.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to sign in with Google", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <AnimatedLoginPage
      isLogin={isLogin}
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onNavigateHome={() => navigate("/")}
      onToggleMode={() => setIsLogin(!isLogin)}
      displayName={displayName}
      onDisplayNameChange={setDisplayName}
      isLoading={loading}
    />
  );
};

export default Auth;