 import { useState, useCallback, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { CADState } from "../types/cad.types";
 import { useToast } from "@/hooks/use-toast";
 
 export interface CADDesign {
   id: string;
   name: string;
   description: string | null;
   design_data: CADState;
   thumbnail_url: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export function useCADDesigns() {
   const { user, isAuthenticated } = useAuth();
   const { toast } = useToast();
   const [designs, setDesigns] = useState<CADDesign[]>([]);
   const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);
   const [saving, setSaving] = useState(false);
 
   // Load all designs
   const loadDesigns = useCallback(async () => {
     if (!user) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("cad_designs")
         .select("*")
         .eq("user_id", user.id)
         .order("updated_at", { ascending: false });
 
       if (!error && data) {
         setDesigns(
           data.map((d) => ({
             ...d,
             design_data: d.design_data as unknown as CADState,
           }))
         );
       }
     } catch (error) {
       console.error("Failed to load designs:", error);
     } finally {
       setLoading(false);
     }
   }, [user]);
 
   useEffect(() => {
     if (isAuthenticated) {
       loadDesigns();
     }
   }, [isAuthenticated, loadDesigns]);
 
   // Create a new design
   const createDesign = useCallback(
     async (name: string, state: CADState): Promise<string | null> => {
       if (!user) return null;
       setSaving(true);
       try {
         const { data, error } = await supabase
           .from("cad_designs")
           .insert([
             {
               user_id: user.id,
               name,
               design_data: JSON.parse(JSON.stringify(state)),
             },
           ])
           .select()
           .single();
 
         if (error) throw error;
 
         const newDesign = {
           ...data,
           design_data: data.design_data as unknown as CADState,
         };
         setDesigns((prev) => [newDesign, ...prev]);
         setCurrentDesignId(data.id);
         toast({ title: "Design created", description: `"${name}" saved successfully` });
         return data.id;
       } catch (error) {
         console.error("Failed to create design:", error);
         toast({ title: "Error", description: "Failed to save design", variant: "destructive" });
         return null;
       } finally {
         setSaving(false);
       }
     },
     [user, toast]
   );
 
   // Update an existing design
   const updateDesign = useCallback(
     async (id: string, updates: { name?: string; description?: string; state?: CADState }) => {
       if (!user) return false;
       setSaving(true);
       try {
         const updateData: Record<string, unknown> = {
           updated_at: new Date().toISOString(),
         };
 
         if (updates.name) updateData.name = updates.name;
         if (updates.description !== undefined) updateData.description = updates.description;
         if (updates.state) updateData.design_data = JSON.parse(JSON.stringify(updates.state));
 
         const { error } = await supabase.from("cad_designs").update(updateData).eq("id", id);
 
         if (error) throw error;
 
         setDesigns((prev) =>
           prev.map((d) =>
             d.id === id
               ? {
                   ...d,
                   ...(updates.name && { name: updates.name }),
                   ...(updates.description !== undefined && { description: updates.description }),
                   ...(updates.state && { design_data: updates.state }),
                   updated_at: new Date().toISOString(),
                 }
               : d
           )
         );
 
         toast({ title: "Design saved" });
         return true;
       } catch (error) {
         console.error("Failed to update design:", error);
         toast({ title: "Error", description: "Failed to save design", variant: "destructive" });
         return false;
       } finally {
         setSaving(false);
       }
     },
     [user, toast]
   );
 
   // Delete a design
   const deleteDesign = useCallback(
     async (id: string) => {
       if (!user) return false;
       try {
         const { error } = await supabase.from("cad_designs").delete().eq("id", id);
 
         if (error) throw error;
 
         setDesigns((prev) => prev.filter((d) => d.id !== id));
         if (currentDesignId === id) {
           setCurrentDesignId(null);
         }
         toast({ title: "Design deleted" });
         return true;
       } catch (error) {
         console.error("Failed to delete design:", error);
         toast({ title: "Error", description: "Failed to delete design", variant: "destructive" });
         return false;
       }
     },
     [user, currentDesignId, toast]
   );
 
   // Get a specific design
   const getDesign = useCallback(
     (id: string): CADDesign | undefined => {
       return designs.find((d) => d.id === id);
     },
     [designs]
   );
 
   // Auto-save current design
   const autoSave = useCallback(
     async (state: CADState) => {
       if (!currentDesignId || !user) return;
       // Only update design_data, don't show toast for auto-save
       try {
         await supabase
           .from("cad_designs")
           .update({
             design_data: JSON.parse(JSON.stringify(state)),
             updated_at: new Date().toISOString(),
           })
           .eq("id", currentDesignId);
       } catch (error) {
         console.error("Auto-save failed:", error);
       }
     },
     [currentDesignId, user]
   );
 
   return {
     designs,
     currentDesignId,
     loading,
     saving,
     setCurrentDesignId,
     loadDesigns,
     createDesign,
     updateDesign,
     deleteDesign,
     getDesign,
     autoSave,
     isAuthenticated,
   };
 }