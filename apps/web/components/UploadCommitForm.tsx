"use client";

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UploadCloud, FileVideo, FileCode, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const UploadCommitForm = () => {
  const [projectName, setProjectName] = useState('');
  const [branchName, setBranchName] = useState('main');
  const [commitMessage, setCommitMessage] = useState('');
  const [proxyFile, setProxyFile] = useState<File | null>(null);
  const [fcpxmlFile, setFcpxmlFile] = useState<File | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'saving'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !branchName || !commitMessage || !proxyFile || !fcpxmlFile) {
      toast.error('Please fill in all fields and attach both files.');
      return;
    }

    setStatus('uploading');
    let uploadedProxyPath = '';

    try {
      // 1. Upload Proxy to Supabase Storage
      const fileExt = proxyFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectName.replace(/\s+/g, '_')}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proxies')
        .upload(filePath, proxyFile);

      if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);
      uploadedProxyPath = filePath;

      const { data: publicUrlData } = supabase.storage
        .from('proxies')
        .getPublicUrl(filePath);
      
      const proxyUrl = publicUrlData.publicUrl;

      // 2. Parse FCPXML via Python API
      setStatus('parsing');
      const formData = new FormData();
      formData.append('file', fcpxmlFile);

      const apiRes = await fetch('http://localhost:8000/convert/fcpxml-to-json', {
        method: 'POST',
        body: formData
      });

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        throw new Error(`API Parsing failed: ${errorText}`);
      }

      const otioManifest = await apiRes.json();

      // 3. Database Write Transaction
      setStatus('saving');

      // 3a. Check/Create Project
      let projectId = '';
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('name', projectName)
        .single();

      if (existingProject) {
        projectId = existingProject.id;
      } else {
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            name: projectName,
            asset_ledger: { proxy_url: proxyUrl }
          })
          .select('id')
          .single();

        if (projectError) throw new Error(`Project creation failed: ${projectError.message}`);
        projectId = newProject.id;
      }

      // 3b. Create Commit
      const { data: newCommit, error: commitError } = await supabase
        .from('commits')
        .insert({
          project_id: projectId,
          message: commitMessage,
          otio_manifest: otioManifest
        })
        .select('id')
        .single();

      if (commitError) throw new Error(`Commit creation failed: ${commitError.message}`);
      const commitId = newCommit.id;

      // 3c. Check/Create/Update Branch
      const { data: existingBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', branchName)
        .single();

      if (existingBranch) {
        const { error: branchUpdateError } = await supabase
          .from('branches')
          .update({ head_commit_id: commitId })
          .eq('id', existingBranch.id);
        if (branchUpdateError) throw new Error(`Branch update failed: ${branchUpdateError.message}`);
      } else {
        const { error: branchInsertError } = await supabase
          .from('branches')
          .insert({
            project_id: projectId,
            name: branchName,
            head_commit_id: commitId
          });
        if (branchInsertError) throw new Error(`Branch creation failed: ${branchInsertError.message}`);
      }

      setStatus('idle');
      toast.success('Commit successfully saved to the branch!');
      
      // Reset form
      setCommitMessage('');
      setProxyFile(null);
      setFcpxmlFile(null);
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An error occurred during submission.');
      
      // Rollback: Delete uploaded proxy if API failed
      if (uploadedProxyPath) {
        await supabase.storage.from('proxies').remove([uploadedProxyPath]);
      }
      setStatus('idle');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
      <div className="mb-8 border-b border-white/5 pb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="p-2 bg-maas-focus/10 border border-maas-focus/30 rounded-lg">
            <UploadCloud className="w-6 h-6 text-maas-focus" />
          </div>
          New Timeline Commit
        </h2>
        <p className="text-white/40 text-sm mt-3 leading-relaxed">
          Initialize a new project or push an updated timeline manifest to an existing branch. The proxy video will be uploaded to Supabase Storage, and the FCPXML will be parsed via the Python API.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Project Name</label>
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-maas-focus focus:ring-1 focus:ring-maas-focus outline-none transition-all placeholder:text-white/20 shadow-inner"
              placeholder="e.g., Apple Commercial"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Branch Name</label>
            <input 
              type="text" 
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-maas-focus focus:ring-1 focus:ring-maas-focus outline-none transition-all placeholder:text-white/20 shadow-inner"
              placeholder="main"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Commit Message</label>
          <textarea 
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-maas-focus focus:ring-1 focus:ring-maas-focus outline-none transition-all resize-none placeholder:text-white/20 h-24 shadow-inner"
            placeholder="Describe what changed in this timeline version..."
          />
        </div>

        <div className="grid grid-cols-2 gap-6 pt-2">
          {/* Proxy File Upload */}
          <div className="relative group h-32">
            <input 
              type="file" 
              accept=".mp4"
              onChange={(e) => setProxyFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all duration-300 ${proxyFile ? 'border-maas-add bg-maas-add/5' : 'border-white/10 bg-black group-hover:border-maas-focus/50 group-hover:bg-maas-focus/5'}`}>
              <FileVideo className={`w-8 h-8 mb-3 transition-colors ${proxyFile ? 'text-maas-add' : 'text-white/20 group-hover:text-maas-focus'}`} />
              <p className="text-sm font-bold text-white/80 text-center w-full truncate px-4">
                {proxyFile ? proxyFile.name : 'Upload Proxy Video'}
              </p>
              <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-wider">.mp4 format</p>
            </div>
          </div>

          {/* FCPXML File Upload */}
          <div className="relative group h-32">
            <input 
              type="file" 
              accept=".fcpxml"
              onChange={(e) => setFcpxmlFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all duration-300 ${fcpxmlFile ? 'border-maas-focus bg-maas-focus/5 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-white/10 bg-black group-hover:border-maas-focus/50 group-hover:bg-maas-focus/5'}`}>
              <FileCode className={`w-8 h-8 mb-3 transition-colors ${fcpxmlFile ? 'text-maas-focus' : 'text-white/20 group-hover:text-maas-focus'}`} />
              <p className="text-sm font-bold text-white/80 text-center w-full truncate px-4">
                {fcpxmlFile ? fcpxmlFile.name : 'Upload FCPXML'}
              </p>
              <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-wider">Resolve Export</p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            disabled={status !== 'idle'}
            className="w-full relative h-14 bg-white text-black font-extrabold rounded-xl hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {status === 'idle' ? (
              'Commit to Timeline'
            ) : (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-black/60" />
                <span className="text-black/80">
                  {status === 'uploading' && 'Uploading Proxy Video...'}
                  {status === 'parsing' && 'Parsing FCPXML...'}
                  {status === 'saving' && 'Writing to Ledger...'}
                </span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
