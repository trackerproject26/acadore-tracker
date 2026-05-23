import { useState } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  white:'#ffffff', bg:'#f4f6f9',
  primary:'#1a6fe8', primaryD:'#1558c0', primaryL:'#e8f0fd',
  navy:'#1e2d3d', txt:'#1e2d3d', txt2:'#5a6a7a', txt3:'#9aaabb',
  bd:'#e2e8f0', red:'#dc2626', redL:'#fee2e2',
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:T.white, borderRadius:20, border:`1px solid ${T.bd}`, padding:'48px 40px', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,.08)', textAlign:'center' }}>

        {/* Logo */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
          <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1a6fe8"/><stop offset="100%" stopColor="#0dada6"/></linearGradient>
              <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0dada6"/><stop offset="100%" stopColor="#1a6fe8"/></linearGradient>
            </defs>
            <path d="M50 8 L85 25 L85 55 C85 74 68 88 50 94 C32 88 15 74 15 55 L15 25 Z" fill="url(#lg1)" opacity=".15"/>
            <path d="M50 8 L85 25 L85 55 C85 74 68 88 50 94 C32 88 15 74 15 55 L15 25 Z" fill="none" stroke="url(#lg1)" strokeWidth="3"/>
            <ellipse cx="50" cy="51" rx="26" ry="34" fill="none" stroke="url(#lg2)" strokeWidth="2.5"/>
            <ellipse cx="50" cy="51" rx="13" ry="34" fill="none" stroke="url(#lg1)" strokeWidth="2"/>
            <line x1="24" y1="43" x2="76" y2="43" stroke="url(#lg2)" strokeWidth="2"/>
            <line x1="24" y1="60" x2="76" y2="60" stroke="url(#lg1)" strokeWidth="2"/>
          </svg>
        </div>

        {/* Heading */}
        <div style={{ fontSize:13, color:T.txt3, letterSpacing:'.12em', textTransform:'uppercase', marginBottom:8 }}>Acadore Skills</div>
        <h1 style={{ fontSize:26, fontWeight:700, color:T.navy, marginBottom:8, letterSpacing:'-.02em' }}>Project Tracker</h1>
        <p style={{ fontSize:14, color:T.txt2, marginBottom:36, lineHeight:1.5 }}>Sign in with your Google account to access your team workspace.</p>

        {/* Error */}
        {error && (
          <div style={{ background:T.redL, border:`1px solid ${T.red}30`, borderRadius:10, padding:'10px 14px', fontSize:13, color:T.red, marginBottom:20, textAlign:'left' }}>
            {error}
          </div>
        )}

        {/* Google Sign In Button */}
        <button onClick={signInWithGoogle} disabled={loading}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'13px 20px', borderRadius:10, border:`1.5px solid ${T.bd}`, background:loading?T.bg:T.white, cursor:loading?'not-allowed':'pointer', fontSize:15, fontWeight:500, color:T.navy, transition:'all .2s', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}
          onMouseEnter={e=>{ if(!loading){ e.currentTarget.style.borderColor=T.primary; e.currentTarget.style.background=T.primaryL; e.currentTarget.style.color=T.primary; }}}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.bd; e.currentTarget.style.background=T.white; e.currentTarget.style.color=T.navy; }}>

          {/* Google icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>

          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        <p style={{ fontSize:12, color:T.txt3, marginTop:28, lineHeight:1.6 }}>
          Only team members added by your admin can access this workspace.
        </p>
      </div>
    </div>
  );
}
