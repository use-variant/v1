"use server";

import { supabase } from '../lib/supabase';
import { ActionResponse } from './collaboration';

export async function getProjectDAG(projectId: string): Promise<ActionResponse<{ branches: any[], commits: any[] }>> {
  try {
    const { data: branches, error: bError } = await supabase
      .from('branches')
      .select('*')
      .eq('project_id', projectId);

    if (bError) throw new Error(`Failed to fetch branches: ${bError.message}`);

    const { data: commits, error: cError } = await supabase
      .from('commits')
      .select('id, project_id, message, parent_ids, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (cError) throw new Error(`Failed to fetch commits: ${cError.message}`);

    return {
      success: true,
      data: { branches: branches || [], commits: commits || [] }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
