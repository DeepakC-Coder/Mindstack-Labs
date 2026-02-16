"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============== Pupil ============== */
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil: React.FC<PupilProps> = ({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY,
}) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;
    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
      }}
    />
  );
};

/* ============== EyeBall ============== */
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall: React.FC<EyeBallProps> = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY,
}) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;
    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="flex items-center justify-center rounded-full transition-all duration-100 ease-out"
      style={{
        width: size,
        height: isBlinking ? 4 : size,
        backgroundColor: eyeColor,
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: pupilSize,
            height: pupilSize,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
          }}
        />
      )}
    </div>
  );
};

/* ============== Exported AnimatedLoginPage ============== */
export interface AnimatedLoginPageProps {
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>;
  onGoogleSignIn?: () => Promise<void>;
  onNavigateHome?: () => void;
  onToggleMode?: () => void;
  isLogin: boolean;
  displayName?: string;
  onDisplayNameChange?: (v: string) => void;
  isLoading?: boolean;
}

export function AnimatedLoginPage({
  onSubmit,
  onGoogleSignIn,
  onNavigateHome,
  onToggleMode,
  isLogin,
  displayName,
  onDisplayNameChange,
  isLoading = false,
}: AnimatedLoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Blinking
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    const scheduleBlink = (setter: React.Dispatch<React.SetStateAction<boolean>>): ReturnType<typeof setTimeout> => {
      const timeout = setTimeout(() => {
        setter(true);
        setTimeout(() => {
          setter(false);
          scheduleBlink(setter);
        }, 150);
      }, getRandomBlinkInterval());
      return timeout;
    };
    const purpleTimeout = scheduleBlink(setIsPurpleBlinking);
    const blackTimeout = scheduleBlink(setIsBlackBlinking);
    return () => {
      clearTimeout(purpleTimeout);
      clearTimeout(blackTimeout);
    };
  }, []);

  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const timer = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(timer);
    }
    setIsLookingAtEachOther(false);
  }, [isTyping]);

  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const id = setTimeout(() => {
        setIsPurplePeeking(true);
        setTimeout(() => setIsPurplePeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(id);
    }
    setIsPurplePeeking(false);
  }, [password, showPassword, isPurplePeeking]);

  const calculatePosition = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));
    return { faceX, faceY, bodySkew };
  };

  const purplePos = calculatePosition(purpleRef);
  const blackPos = calculatePosition(blackRef);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await onSubmit(email, password);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="min-h-screen flex bg-landing-gradient relative overflow-hidden">
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      {/* Left – Characters */}
      <div className="hidden lg:flex lg:w-1/2 relative items-end justify-center p-12 overflow-hidden">
        {/* Purple */}
        <div
          ref={purpleRef}
          className="absolute bottom-0 rounded-t-[10px] transition-transform duration-150 ease-out"
          style={{
            left: "15%",
            width: 100,
            height: password.length > 0 && !showPassword ? 440 : 400,
            backgroundColor: "#6C3FF5",
            transformOrigin: "bottom center",
            transform:
              password.length > 0 && showPassword
                ? "skewX(0deg)"
                : password.length > 0 && !showPassword
                ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                : `skewX(${purplePos.bodySkew || 0}deg)`,
          }}
        >
          <div
            className="absolute flex gap-2"
            style={{
              left: password.length > 0 && showPassword ? 20 : isLookingAtEachOther ? 55 : 45 + purplePos.faceX,
              top: password.length > 0 && showPassword ? 35 : isLookingAtEachOther ? 65 : 40 + purplePos.faceY,
            }}
          >
            <EyeBall
              isBlinking={isPurpleBlinking}
              forceLookX={
                password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
              }
              forceLookY={
                password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined
              }
            />
            <EyeBall
              isBlinking={isPurpleBlinking}
              forceLookX={
                password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
              }
              forceLookY={
                password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined
              }
            />
          </div>
        </div>

        {/* Black */}
        <div
          ref={blackRef}
          className="absolute bottom-0 rounded-t-[10px] z-10 transition-transform duration-150 ease-out"
          style={{
            left: "32%",
            width: 80,
            height: 200,
            backgroundColor: "#1a1a1a",
            transformOrigin: "bottom center",
            transform:
              password.length > 0 && showPassword
                ? "skewX(0deg)"
                : isLookingAtEachOther
                ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                : `skewX(${blackPos.bodySkew || 0}deg)`,
          }}
        >
          <div
            className="absolute flex gap-2"
            style={{
              left: password.length > 0 && showPassword ? 10 : isLookingAtEachOther ? 32 : 26 + blackPos.faceX,
              top: password.length > 0 && showPassword ? 28 : isLookingAtEachOther ? 12 : 32 + blackPos.faceY,
            }}
          >
            <EyeBall
              size={28}
              pupilSize={10}
              isBlinking={isBlackBlinking}
              forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
            />
            <EyeBall
              size={28}
              pupilSize={10}
              isBlinking={isBlackBlinking}
              forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
            />
          </div>
        </div>

        {/* Orange */}
        <div
          ref={orangeRef}
          className="absolute bottom-0 rounded-t-full z-20 transition-transform duration-150 ease-out"
          style={{
            left: "52%",
            width: 200,
            height: 120,
            backgroundColor: "hsl(22, 95%, 50%)",
            transformOrigin: "bottom center",
            transform: password.length > 0 && showPassword ? "skewX(0deg)" : `skewX(${orangePos.bodySkew || 0}deg)`,
          }}
        >
          <div
            className="absolute flex gap-3"
            style={{
              left: password.length > 0 && showPassword ? 50 : 82 + (orangePos.faceX || 0),
              top: password.length > 0 && showPassword ? 85 : 90 + (orangePos.faceY || 0),
            }}
          >
            <Pupil
              size={14}
              forceLookX={password.length > 0 && showPassword ? -5 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : undefined}
            />
            <Pupil
              size={14}
              forceLookX={password.length > 0 && showPassword ? -5 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : undefined}
            />
          </div>
        </div>

        {/* Yellow */}
        <div
          ref={yellowRef}
          className="absolute bottom-0 rounded-t-[10px] z-20 transition-transform duration-150 ease-out"
          style={{
            right: "10%",
            width: 110,
            height: 220,
            backgroundColor: "hsl(48, 96%, 52%)",
            transformOrigin: "bottom center",
            transform: password.length > 0 && showPassword ? "skewX(0deg)" : `skewX(${yellowPos.bodySkew || 0}deg)`,
          }}
        >
          <div
            className="absolute flex gap-3"
            style={{
              left: password.length > 0 && showPassword ? 20 : 52 + (yellowPos.faceX || 0),
              top: password.length > 0 && showPassword ? 35 : 40 + (yellowPos.faceY || 0),
            }}
          >
            <Pupil
              size={14}
              forceLookX={password.length > 0 && showPassword ? -5 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : undefined}
            />
            <Pupil
              size={14}
              forceLookX={password.length > 0 && showPassword ? -5 : undefined}
              forceLookY={password.length > 0 && showPassword ? -4 : undefined}
            />
          </div>
          <div
            className="absolute bg-black rounded-sm"
            style={{
              width: 28,
              height: 4,
              left: password.length > 0 && showPassword ? 40 : 40 + (yellowPos.faceX || 0),
              top: password.length > 0 && showPassword ? 88 : 88 + (yellowPos.faceY || 0),
            }}
          />
        </div>
      </div>

      {/* Right – Form */}
      <div className="relative w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-black/35 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          {/* Back to Home */}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6"
            >
              <span>← Home</span>
            </button>
          )}

          <h2 className="text-3xl font-bold text-white mb-1">{isLogin ? "Welcome back!" : "Create account"}</h2>
          <p className="text-white/50 mb-6">{isLogin ? "Please enter your details" : "Join us and start your journey"}</p>

          {/* Google */}
          {onGoogleSignIn && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 border-none mb-6"
                onClick={onGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-sm">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (signup) */}
            {!isLogin && onDisplayNameChange && (
              <div>
                <Label className="text-white/70 mb-1 block">Display Name</Label>
                <Input
                  type="text"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => onDisplayNameChange(e.target.value)}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <Label className="text-white/70 mb-1 block">Email</Label>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
              />
            </div>

            {/* Password */}
            <div>
              <Label className="text-white/70 mb-1 block">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className="h-12 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember */}
            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                  <Checkbox />
                  <span>Remember for 30 days</span>
                </label>
                <button type="button" className="text-blue-400 hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full h-12 bg-white hover:bg-gray-100 text-gray-800"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Log in" : "Create Account"}
            </Button>
          </form>

          {/* Toggle */}
          {onToggleMode && (
            <p className="mt-6 text-center text-white/50 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={onToggleMode} className="text-blue-400 hover:underline font-medium">
                {isLogin ? "Sign Up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const Component = AnimatedLoginPage;