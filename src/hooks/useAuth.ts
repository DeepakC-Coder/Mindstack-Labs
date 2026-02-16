 import { useState, useEffect, useCallback } from "react";
 import { User, Session } from "@supabase/supabase-js";
 import { supabase } from "@/integrations/supabase/client";
 
 interface Profile {
   id: string;
   user_id: string;
   display_name: string | null;
   avatar_url: string | null;
 }
 
 export function useAuth() {
   const [user, setUser] = useState<User | null>(null);
   const [session, setSession] = useState<Session | null>(null);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [loading, setLoading] = useState(true);
 
   const fetchProfile = useCallback(async (userId: string) => {
     const { data, error } = await supabase
       .from("profiles")
       .select("*")
       .eq("user_id", userId)
       .single();
 
     if (!error && data) {
       setProfile(data);
     }
   }, []);
 
   useEffect(() => {
     // Set up auth state listener FIRST
     const {
       data: { subscription },
     } = supabase.auth.onAuthStateChange((event, session) => {
       setSession(session);
       setUser(session?.user ?? null);
       setLoading(false);
 
       // Fetch profile in a deferred manner to avoid deadlock
       if (session?.user) {
         setTimeout(() => {
           fetchProfile(session.user.id);
         }, 0);
       } else {
         setProfile(null);
       }
     });
 
     // THEN check for existing session
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       setUser(session?.user ?? null);
       setLoading(false);
 
       if (session?.user) {
         fetchProfile(session.user.id);
       }
     });
 
     return () => subscription.unsubscribe();
   }, [fetchProfile]);
 
   const signUp = async (email: string, password: string, displayName?: string) => {
     const redirectUrl = `${window.location.origin}/`;
 
     const { data, error } = await supabase.auth.signUp({
       email,
       password,
       options: {
         emailRedirectTo: redirectUrl,
         data: {
           full_name: displayName,
         },
       },
     });
 
     return { data, error };
   };
 
   const signIn = async (email: string, password: string) => {
     const { data, error } = await supabase.auth.signInWithPassword({
       email,
       password,
     });
 
     return { data, error };
   };
 
   const signOut = async () => {
     const { error } = await supabase.auth.signOut();
     if (!error) {
       setUser(null);
       setSession(null);
       setProfile(null);
     }
     return { error };
   };
 
   const updateProfile = async (updates: Partial<Profile>) => {
     if (!user) return { error: new Error("No user logged in") };
 
     const { data, error } = await supabase
       .from("profiles")
       .update(updates)
       .eq("user_id", user.id)
       .select()
       .single();
 
     if (!error && data) {
       setProfile(data);
     }
 
     return { data, error };
   };
 
   return {
     user,
     session,
     profile,
     loading,
     signUp,
     signIn,
     signOut,
     updateProfile,
     isAuthenticated: !!session,
   };
 }