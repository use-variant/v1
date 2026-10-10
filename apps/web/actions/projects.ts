"use server";

import { supabase } from '../lib/supabase';
import { ActionResponse } from './collaboration';

export async function getProjects(): Promise<ActionResponse<any[]>> {
  try {
    const { data: projects, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { success: true, data: projects || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProjectInvite(projectId: string): Promise<ActionResponse<any>> {
  try {
    const { data: invite, error } = await supabase.from('project_invites').select('token').eq('project_id', projectId).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return { success: true, data: invite };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
