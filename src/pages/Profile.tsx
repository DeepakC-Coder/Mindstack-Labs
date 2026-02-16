 import React, { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { motion } from "framer-motion";
 import { ArrowLeft, User, Camera, Loader2, Check, LogOut } from "lucide-react";
 import { useAuth } from "@/hooks/useAuth";
 import { useToast } from "@/hooks/use-toast";
 
 const Profile: React.FC = () => {
   const navigate = useNavigate();
   const { toast } = useToast();
   const { user, profile, loading: authLoading, isAuthenticated, updateProfile, signOut } = useAuth();
 
   const [displayName, setDisplayName] = useState("");
   const [avatarUrl, setAvatarUrl] = useState("");
   const [isSaving, setIsSaving] = useState(false);
   const [hasChanges, setHasChanges] = useState(false);
 
   // Redirect if not authenticated
   useEffect(() => {
     if (!authLoading && !isAuthenticated) {
       navigate("/auth");
     }
   }, [authLoading, isAuthenticated, navigate]);
 
   // Initialize form with profile data
   useEffect(() => {
     if (profile) {
       setDisplayName(profile.display_name || "");
       setAvatarUrl(profile.avatar_url || "");
     }
   }, [profile]);
 
   // Check for changes
   useEffect(() => {
     if (profile) {
       const nameChanged = displayName !== (profile.display_name || "");
       const avatarChanged = avatarUrl !== (profile.avatar_url || "");
       setHasChanges(nameChanged || avatarChanged);
     }
   }, [displayName, avatarUrl, profile]);
 
   const handleSave = async () => {
     if (!hasChanges) return;
 
     setIsSaving(true);
     try {
       const { error } = await updateProfile({
         display_name: displayName || null,
         avatar_url: avatarUrl || null,
       });
 
       if (error) {
         toast({
           title: "Failed to save",
           description: error.message,
           variant: "destructive",
         });
       } else {
         toast({
           title: "Profile updated",
           description: "Your changes have been saved.",
         });
         setHasChanges(false);
       }
     } catch (err) {
       toast({
         title: "Error",
         description: "Something went wrong. Please try again.",
         variant: "destructive",
       });
     } finally {
       setIsSaving(false);
     }
   };
 
   const handleSignOut = async () => {
     await signOut();
     navigate("/");
   };
 
   if (authLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
         <Loader2 className="w-8 h-8 text-white animate-spin" />
       </div>
     );
   }
 
   return (
      <div className="min-h-screen bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]">
       {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-black/20 backdrop-blur-sm">
         <div className="flex items-center gap-4">
           <button
             onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
           >
             <ArrowLeft className="w-5 h-5 text-white" />
           </button>
           <h1 className="text-lg font-semibold text-white">Profile Settings</h1>
         </div>
         <button
           onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
         >
           <LogOut className="w-4 h-4" />
           Sign Out
         </button>
       </header>
 
       {/* Content */}
       <div className="max-w-2xl mx-auto p-8">
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-8"
         >
           {/* Avatar Section */}
           <div className="flex flex-col items-center gap-4">
             <div className="relative">
                <div className="w-28 h-28 rounded-full bg-white/30 backdrop-blur-sm p-1">
                  <div className="w-full h-full rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                   {avatarUrl ? (
                     <img
                       src={avatarUrl}
                       alt="Avatar"
                       className="w-full h-full object-cover"
                       onError={() => setAvatarUrl("")}
                     />
                   ) : (
                     <User className="w-12 h-12 text-white/40" />
                   )}
                 </div>
               </div>
                <div className="absolute bottom-0 right-0 p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
                 <Camera className="w-4 h-4 text-white/60" />
               </div>
             </div>
              <p className="text-white/70 text-sm">
               {user?.email}
             </p>
           </div>
 
           {/* Form */}
            <div className="space-y-6 bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
             {/* Display Name */}
             <div className="space-y-2">
                <label className="text-sm text-white/80 font-medium">
                 Display Name
               </label>
               <input
                 type="text"
                 value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)}
                 placeholder="Enter your display name"
                  className="w-full bg-black/30 border border-white/20 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors"
               />
             </div>
 
             {/* Avatar URL */}
             <div className="space-y-2">
                <label className="text-sm text-white/80 font-medium">
                 Avatar URL
               </label>
               <input
                 type="url"
                 value={avatarUrl}
                 onChange={(e) => setAvatarUrl(e.target.value)}
                 placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-black/30 border border-white/20 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors"
               />
                <p className="text-xs text-white/50">
                 Enter a URL to an image for your profile picture
               </p>
             </div>
 
             {/* Account Info */}
              <div className="pt-4 border-t border-white/20 space-y-4">
                <h3 className="text-sm font-medium text-white/80">Account Information</h3>
               
               <div className="space-y-2">
                  <label className="text-xs text-white/60">Email</label>
                  <div className="py-2 px-4 bg-black/30 rounded-xl text-white/70 text-sm">
                   {user?.email}
                 </div>
               </div>
 
               <div className="space-y-2">
                  <label className="text-xs text-white/60">Account Created</label>
                  <div className="py-2 px-4 bg-black/30 rounded-xl text-white/70 text-sm">
                   {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", {
                     year: "numeric",
                     month: "long",
                     day: "numeric",
                   }) : "—"}
                 </div>
               </div>
             </div>
           </div>
 
           {/* Save Button */}
           <div className="flex justify-end">
             <button
               onClick={handleSave}
               disabled={!hasChanges || isSaving}
               className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSaving ? (
                 <Loader2 className="w-4 h-4 animate-spin" />
               ) : (
                 <Check className="w-4 h-4" />
               )}
               {isSaving ? "Saving..." : "Save Changes"}
             </button>
           </div>
         </motion.div>
       </div>
     </div>
   );
 };
 
 export default Profile;