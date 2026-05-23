import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, X, Search, Clock, CheckCircle2, AlertCircle,
  LayoutGrid, List, GitBranch, Share2, Edit2, Trash2,
  Layers, MoreHorizontal, Target, Filter, Users, ChevronDown
} from 'lucide-react';

// ── Design Tokens ─────────────────────────────────────────────
const T = {
  white:'#ffffff', bg:'#f4f6f9', bgCard:'#ffffff', sidebar:'#ffffff',
  primary:'#1a6fe8', primaryD:'#1558c0', primaryL:'#e8f0fd',
  navy:'#1e2d3d', txt:'#1e2d3d', txt2:'#5a6a7a', txt3:'#9aaabb',
  bd:'#e2e8f0', bdS:'#cbd5e1',
  teal:'#0dada6', tealL:'#e0f7f6',
  green:'#16a34a', greenL:'#dcfce7',
  amber:'#d97706', amberL:'#fef3c7',
  red:'#dc2626', redL:'#fee2e2',
  violet:'#7c3aed', violetL:'#ede9fe',
  sky:'#0284c7', skyL:'#e0f2fe',
};

const STATUS = {
  backlog:     { label:'Backlog',      bg:'#f1f5f9', col:'#64748b' },
  todo:        { label:'Todo',         bg:T.skyL,    col:T.sky     },
  in_progress: { label:'In Progress',  bg:T.primaryL,col:T.primary },
  review:      { label:'Review',       bg:T.violetL, col:T.violet  },
  done:        { label:'Done',         bg:T.greenL,  col:T.green   },
  blocked:     { label:'Blocked',      bg:T.redL,    col:T.red     },
};

const PRIORITY = {
  critical: { label:'Critical', col:T.red,    sym:'!!' },
  high:     { label:'High',     col:'#ea580c',sym:'!'  },
  medium:   { label:'Medium',   col:T.amber,  sym:'▶'  },
  low:      { label:'Low',      col:T.txt3,   sym:'▽'  },
};

const PALETTE = [T.primary,'#0dada6','#7c3aed','#db2777','#ea580c','#16a34a','#0284c7','#9333ea'];

// ── Helpers ───────────────────────────────────────────────────
const uid    = () => Math.random().toString(36).slice(2, 9);
const fmtD   = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
const dleft  = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 864e5); };
const isOv   = (d, s) => s !== 'done' && dleft(d) !== null && dleft(d) < 0;
const isSoon = (d, s) => s !== 'done' && dleft(d) !== null && dleft(d) >= 0 && dleft(d) <= 3;
const today  = () => new Date().toISOString().split('T')[0];

// ── Root ──────────────────────────────────────────────────────
export default function Home() {
  const [projects, setProjects] = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('dashboard');
  const [selProj,  setSelProj]  = useState(null);
  const [q,        setQ]        = useState('');
  const [fStatus,  setFStatus]  = useState('all');
  const [fPri,     setFPri]     = useState('all');
  const [modal,    setModal]    = useState(null);
  const [notif,    setNotif]    = useState(null);
  const [collapsed,setCollapsed]= useState(false);

  // ── Load initial data ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: t }, { data: m }] = await Promise.all([
        supabase.from('projects').select('*').order('created_at'),
        supabase.from('tasks').select('*').order('created_at'),
        supabase.from('members').select('*').order('created_at'),
      ]);
      setProjects(p || []);
      setTasks(t || []);
      setMembers(m || []);
      setLoading(false);
    }
    load();

    // ── Real-time subscriptions — all teammates see live updates
    const channel = supabase
      .channel('tracker-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },    () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' },  () => load())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const toast = (msg) => { setNotif(msg); setTimeout(() => setNotif(null), 3000); };
  const openModal  = (type, d = null) => setModal({ type, d });
  const closeModal = () => setModal(null);

  // ── CRUD: Projects ─────────────────────────────────────────
  const addProject = async (f) => {
    const { error } = await supabase.from('projects').insert({
      name: f.name, desc: f.desc, color: f.color,
      status: f.status, start_date: f.start, end_date: f.end,
      members: f.members || [],
    });
    if (!error) toast('Project created'); else toast('Error: ' + error.message);
  };

  const saveProject = async (f) => {
    const { error } = await supabase.from('projects').update({
      name: f.name, desc: f.desc, color: f.color,
      status: f.status, start_date: f.start, end_date: f.end,
      members: f.members || [],
    }).eq('id', f.id);
    if (!error) toast('Project saved'); else toast('Error: ' + error.message);
  };

  const delProject = async (id) => {
    await supabase.from('projects').delete().eq('id', id);
    if (selProj?.id === id) { setSelProj(null); setView('dashboard'); }
    toast('Project deleted');
  };

  // ── CRUD: Tasks ────────────────────────────────────────────
  const addTask = async (f) => {
    const { error } = await supabase.from('tasks').insert({
      project_id: f.pid, title: f.title, description: f.desc,
      status: f.status, priority: f.pri, assignee_id: f.aid || null,
      due_date: f.due || null, tags: f.tags || [],
    });
    if (!error) toast('Task added'); else toast('Error: ' + error.message);
  };

  const saveTask = async (f) => {
    const { error } = await supabase.from('tasks').update({
      project_id: f.pid, title: f.title, description: f.desc,
      status: f.status, priority: f.pri, assignee_id: f.aid || null,
      due_date: f.due || null, tags: f.tags || [],
    }).eq('id', f.id);
    if (!error) toast('Task saved'); else toast('Error: ' + error.message);
  };

  const delTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    toast('Task deleted');
  };

  const patchTask = async (id, patch) => {
    const map = {};
    if (patch.status)   map.status   = patch.status;
    if (patch.priority) map.priority = patch.priority;
    await supabase.from('tasks').update(map).eq('id', id);
  };

  // ── CRUD: Members ──────────────────────────────────────────
  const addMember = async (m) => {
    await supabase.from('members').insert({
      name: m.name, initials: m.initials, color: m.color, role: m.role,
    });
    toast('Member invited');
  };

  // ── Computed ───────────────────────────────────────────────
  const progress = (pid) => {
    const ts = tasks.filter(t => t.project_id === pid);
    return ts.length ? Math.round(ts.filter(t => t.status === 'done').length / ts.length * 100) : 0;
  };

  const filtered = (list) => {
    let r = list;
    if (q)           r = r.filter(t => t.title.toLowerCase().includes(q.toLowerCase()));
    if (fStatus !== 'all') r = r.filter(t => t.status === fStatus);
    if (fPri    !== 'all') r = r.filter(t => t.priority === fPri);
    return r;
  };

  // normalise DB shape to component shape
  const norm = (t) => ({
    ...t, pid: t.project_id, pri: t.priority, aid: t.assignee_id,
    due: t.due_date, desc: t.description,
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16, background:T.bg }}>
      <AcadoreLogo size={48} />
      <div style={{ fontSize:13, color:T.txt2 }}>Loading workspace…</div>
    </div>
  );

  const normTasks    = tasks.map(norm);
  const taskDetail   = modal?.type === 'task-detail' ? normTasks.find(t => t.id === modal.d) : null;

  return (
    <div style={{ display:'flex', height:'100vh', background:T.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:T.txt, overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:collapsed?64:228, flexShrink:0, background:T.sidebar, borderRight:`1px solid ${T.bd}`, display:'flex', flexDirection:'column', transition:'width .25s', overflow:'hidden', zIndex:10 }}>
        <div style={{ padding:'18px 16px 14px', borderBottom:`1px solid ${T.bd}`, display:'flex', alignItems:'center', gap:10, minHeight:65, flexShrink:0 }}>
          <AcadoreLogo size={32} />
          {!collapsed && <div><div style={{ fontSize:13, fontWeight:700, color:T.navy }}>Acadore</div><div style={{ fontSize:10, color:T.txt3, letterSpacing:'.08em', textTransform:'uppercase' }}>Skills</div></div>}
        </div>
        <nav style={{ padding:'12px 8px', flex:1, overflowY:'auto' }}>
          {!collapsed && <div style={{ fontSize:10, color:T.txt3, letterSpacing:'.14em', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Navigation</div>}
          {[
            { id:'dashboard', label:'Dashboard', icon:<LayoutGrid size={16}/> },
            { id:'board',     label:'Board',     icon:<Layers size={16}/> },
            { id:'list',      label:'All Tasks', icon:<List size={16}/> },
            { id:'timeline',  label:'Timeline',  icon:<GitBranch size={16}/> },
            { id:'team',      label:'Team',      icon:<Users size={16}/> },
          ].map(n => <NavItem key={n.id} item={n} active={view===n.id} collapsed={collapsed} onClick={()=>setView(n.id)}/>)}

          {!collapsed && <>
            <div style={{ fontSize:10, color:T.txt3, letterSpacing:'.14em', textTransform:'uppercase', padding:'16px 8px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Projects</span>
              <button onClick={()=>openModal('project')} style={ghostBtn} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.txt3}><Plus size={13}/></button>
            </div>
            {projects.map(p => {
              const prog = progress(p.id);
              const active = selProj?.id === p.id && view === 'board';
              return (
                <div key={p.id} onClick={()=>{setSelProj(p);setView('board');}}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:8, cursor:'pointer', marginBottom:2, background:active?T.primaryL:'transparent', transition:'all .15s' }}
                  onMouseEnter={e=>{if(!active)e.currentTarget.style.background=T.bg;}}
                  onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontSize:12, color:active?T.primary:T.txt, fontWeight:active?600:400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                    <div style={{ height:2, background:T.bd, borderRadius:2, marginTop:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${prog}%`, background:p.color, transition:'width .5s' }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </>}
        </nav>
        <div style={{ padding:'12px 8px', borderTop:`1px solid ${T.bd}`, display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between' }}>
          {!collapsed && members[0] && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Av m={members[0]} size={28}/>
              <div><div style={{ fontSize:12, fontWeight:500, color:T.txt }}>{members[0].name}</div><div style={{ fontSize:10, color:T.txt3 }}>{members[0].role}</div></div>
            </div>
          )}
          <button onClick={()=>setCollapsed(!collapsed)} style={ghostBtn} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.txt3}>
            <ChevronDown size={14} style={{ transform:collapsed?'rotate(-90deg)':'rotate(90deg)', transition:'transform .2s' }}/>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Top bar */}
        <header style={{ background:T.white, borderBottom:`1px solid ${T.bd}`, padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:600, color:T.navy }}>
              {view==='board'&&selProj ? selProj.name : {dashboard:'Dashboard',board:'Board',list:'All Tasks',timeline:'Timeline',team:'Team'}[view]}
            </div>
          </div>
          {/* Search */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderRadius:8, border:`1px solid ${T.bd}`, background:T.bg, width:220 }}>
            <Search size={13} color={T.txt3}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search tasks…" style={{ background:'none', border:'none', outline:'none', fontSize:13, color:T.txt, width:'100%' }}/>
          </div>
          {/* Filter */}
          <FilterBtn fStatus={fStatus} setFStatus={setFStatus} fPri={fPri} setFPri={setFPri}/>
          {/* Share */}
          <ActionBtn icon={<Share2 size={14}/>} label="Share" onClick={()=>{navigator.clipboard.writeText(window.location.href);toast('Link copied — share this URL with your team!');}}/>
          {/* Add Task */}
          <button onClick={()=>openModal('task',{pid:selProj?.id||projects[0]?.id,status:'todo'})}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, background:T.primary, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:500 }}
            onMouseEnter={e=>e.currentTarget.style.background=T.primaryD}
            onMouseLeave={e=>e.currentTarget.style.background=T.primary}>
            <Plus size={14}/>Add Task
          </button>
        </header>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {view==='dashboard' && <Dashboard projects={projects} tasks={normTasks} members={members} progress={progress} setSelProj={p=>{setSelProj(p);setView('board');}} openModal={openModal} delProject={delProject}/>}
          {view==='board'     && <Board     projects={projects} tasks={filtered(normTasks.filter(t=>selProj?t.pid===selProj.id:true))} members={members} selProj={selProj} patchTask={patchTask} delTask={delTask} openModal={openModal}/>}
          {view==='list'      && <ListView  projects={projects} tasks={filtered(normTasks)} members={members} patchTask={patchTask} delTask={delTask} openModal={openModal}/>}
          {view==='timeline'  && <Timeline  projects={projects} tasks={normTasks} members={members} progress={progress}/>}
          {view==='team'      && <TeamView  members={members} tasks={normTasks} projects={projects} progress={progress} openModal={openModal}/>}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal?.type==='project'     && <ProjectModal project={modal.d} members={members} onSave={p=>{p?.id?saveProject(p):addProject(p);closeModal();}} onClose={closeModal}/>}
      {modal?.type==='task'        && <TaskModal    task={modal.d} projects={projects} members={members} onSave={t=>{t?.id?saveTask(t):addTask(t);closeModal();}} onClose={closeModal}/>}
      {modal?.type==='task-detail' && taskDetail    && <TaskDetail task={taskDetail} members={members} projects={projects} patchTask={patchTask} onEdit={()=>openModal('task',taskDetail)} onDelete={id=>{delTask(id);closeModal();}} onClose={closeModal}/>}
      {modal?.type==='member'      && <MemberModal  onSave={m=>{addMember(m);closeModal();}} onClose={closeModal}/>}

      {notif && <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, padding:'12px 20px', borderRadius:10, background:T.primary, color:'#fff', fontSize:13, fontWeight:500, boxShadow:'0 4px 20px rgba(26,111,232,.3)', animation:'slideUp .3s ease' }}>{notif}</div>}
    </div>
  );
}

// ── Acadore Logo ──────────────────────────────────────────────
function AcadoreLogo({ size=32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
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
  );
}

function NavItem({ item, active, collapsed, onClick }) {
  const [h,setH]=useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} title={collapsed?item.label:''}
      style={{ display:'flex', alignItems:'center', gap:10, padding:collapsed?'10px':'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:2, justifyContent:collapsed?'center':'flex-start', background:active?T.primaryL:h?'#f1f5f9':'transparent', color:active?T.primary:T.txt2, fontSize:13, fontWeight:active?600:400, transition:'all .15s' }}>
      <span style={{ flexShrink:0, color:active?T.primary:h?T.navy:T.txt2 }}>{item.icon}</span>
      {!collapsed && item.label}
    </div>
  );
}

function FilterBtn({ fStatus, setFStatus, fPri, setFPri }) {
  const [open,setOpen]=useState(false);
  const active = fStatus!=='all'||fPri!=='all';
  return (
    <div style={{ position:'relative' }}>
      <ActionBtn icon={<Filter size={14}/>} label="Filter" active={active} onClick={()=>setOpen(!open)}/>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:T.white, border:`1px solid ${T.bd}`, borderRadius:12, padding:16, width:200, zIndex:100, boxShadow:'0 8px 30px rgba(0,0,0,.12)' }}>
          <DropList label="Status" options={['all',...Object.keys(STATUS)]} labels={{all:'All statuses',...Object.fromEntries(Object.entries(STATUS).map(([k,v])=>[k,v.label]))}} value={fStatus} onChange={setFStatus}/>
          <div style={{ height:1, background:T.bd, margin:'10px 0' }}/>
          <DropList label="Priority" options={['all',...Object.keys(PRIORITY)]} labels={{all:'All priorities',...Object.fromEntries(Object.entries(PRIORITY).map(([k,v])=>[k,v.label]))}} value={fPri} onChange={setFPri}/>
          <div onClick={()=>{setFStatus('all');setFPri('all');setOpen(false);}} style={{ marginTop:12, textAlign:'center', fontSize:11, color:T.txt3, cursor:'pointer', textDecoration:'underline' }}>Clear all</div>
        </div>
      )}
    </div>
  );
}

function DropList({ label, options, labels, value, onChange }) {
  return <>
    <div style={{ fontSize:10, color:T.txt3, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>{label}</div>
    {options.map(o=>(
      <div key={o} onClick={()=>onChange(o)}
        style={{ padding:'6px 8px', borderRadius:7, cursor:'pointer', fontSize:12, color:value===o?T.primary:T.txt2, background:value===o?T.primaryL:'transparent', fontWeight:value===o?500:400, marginBottom:2, transition:'all .15s' }}
        onMouseEnter={e=>{if(value!==o)e.currentTarget.style.background=T.bg;}}
        onMouseLeave={e=>{if(value!==o)e.currentTarget.style.background='transparent';}}>
        {labels[o]}
      </div>
    ))}
  </>;
}

function ActionBtn({ icon, label, onClick, active }) {
  const [h,setH]=useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8, border:`1px solid ${active||h?T.primary:T.bd}`, background:active?T.primaryL:h?'#f8fafc':T.white, color:active?T.primary:h?T.navy:T.txt2, cursor:'pointer', fontSize:13, transition:'all .15s' }}>
      {icon}{label}
    </button>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard({ projects, tasks, members, progress, setSelProj, openModal, delProject }) {
  const total   = tasks.length;
  const done    = tasks.filter(t=>t.status==='done').length;
  const blocked = tasks.filter(t=>t.status==='blocked').length;
  const overdue = tasks.filter(t=>isOv(t.due,t.status)).length;
  const upcoming= [...tasks].filter(t=>t.status!=='done'&&t.due).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,5);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {[
          { label:'Total Tasks', value:total,   color:T.primary,bg:T.primaryL, icon:<Target size={18}/> },
          { label:'Completed',   value:done,    color:T.green,  bg:T.greenL,   icon:<CheckCircle2 size={18}/> },
          { label:'Blocked',     value:blocked, color:T.violet, bg:T.violetL,  icon:<AlertCircle size={18}/> },
          { label:'Overdue',     value:overdue, color:T.red,    bg:T.redL,     icon:<Clock size={18}/> },
        ].map((s,i)=>(
          <div key={i} style={{ background:T.white, borderRadius:12, border:`1px solid ${T.bd}`, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:26, fontWeight:700, color:T.navy, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:12, color:T.txt2, marginTop:3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h2 style={{ fontSize:15, fontWeight:600, color:T.navy }}>Projects</h2>
        <button onClick={()=>openModal('project')} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:`1px solid ${T.bd}`, background:T.white, color:T.txt2, cursor:'pointer', fontSize:12 }} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.bd;e.currentTarget.style.color=T.txt2;}}><Plus size={13}/>New Project</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16, marginBottom:32 }}>
        {projects.map(p=><ProjCard key={p.id} p={p} tasks={tasks} members={members} progress={progress} setSelProj={setSelProj} openModal={openModal} delProject={delProject}/>)}
      </div>

      {upcoming.length > 0 && <>
        <h2 style={{ fontSize:15, fontWeight:600, color:T.navy, marginBottom:14 }}>Upcoming Deadlines</h2>
        <div style={{ background:T.white, borderRadius:12, border:`1px solid ${T.bd}`, overflow:'hidden' }}>
          {upcoming.map((t,i)=>{
            const proj=projects.find(p=>p.id===t.pid);
            const mem=members.find(m=>m.id===t.aid);
            const dl=dleft(t.due);
            return (
              <div key={t.id} onClick={()=>openModal('task-detail',t.id)}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', borderBottom:i<upcoming.length-1?`1px solid ${T.bd}`:'none', cursor:'pointer', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ width:3, height:36, borderRadius:2, background:isOv(t.due,t.status)?T.red:isSoon(t.due,t.status)?T.amber:proj?.color||T.primary, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{t.title}</div>
                  <div style={{ fontSize:11, color:T.txt3, marginTop:2 }}>{proj?.name}</div>
                </div>
                <div style={{ fontSize:11, color:isOv(t.due,t.status)?T.red:isSoon(t.due,t.status)?T.amber:T.txt3, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <Clock size={11}/>{dl<0?`${Math.abs(dl)}d overdue`:dl===0?'Due today':`${dl}d left`}
                </div>
                <SBadge s={t.status}/>
                {mem && <Av m={mem} size={26}/>}
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

function ProjCard({ p, tasks, members, progress, setSelProj, openModal, delProject }) {
  const [h,setH]=useState(false);
  const [menu,setMenu]=useState(false);
  const prog=progress(p.id);
  const pts=tasks.filter(t=>t.pid===p.id);
  const dl=dleft(p.end_date);
  return (
    <div onClick={()=>setSelProj(p)} style={{ background:T.white, borderRadius:12, border:`1px solid ${h?T.bdS:T.bd}`, padding:20, cursor:'pointer', position:'relative', transition:'all .2s', boxShadow:h?'0 4px 16px rgba(0,0,0,.08)':'none' }}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setMenu(false);}}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:p.color, borderRadius:'12px 12px 0 0' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, marginTop:4 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:T.navy, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
          </div>
          <div style={{ fontSize:11, color:T.txt2, marginLeft:18, lineHeight:1.4 }}>{p.desc?.slice(0,70)}{p.desc?.length>70?'…':''}</div>
        </div>
        <div onClick={e=>{e.stopPropagation();setMenu(!menu);}} style={{ color:T.txt3, cursor:'pointer', padding:4, borderRadius:6, flexShrink:0, marginLeft:8 }}>
          <MoreHorizontal size={15}/>
          {menu && (
            <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:44, right:12, background:T.white, border:`1px solid ${T.bd}`, borderRadius:10, overflow:'hidden', zIndex:50, minWidth:130, boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}>
              <div onClick={()=>{openModal('project',{...p,start:p.start_date,end:p.end_date});setMenu(false);}} style={mItem} onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Edit2 size={12}/>Edit</div>
              <div onClick={()=>{if(confirm(`Delete "${p.name}"?`)){delProject(p.id);}setMenu(false);}} style={{...mItem,color:T.red}} onMouseEnter={e=>e.currentTarget.style.background=T.redL} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Trash2 size={12}/>Delete</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11 }}>
          <span style={{ color:T.txt2 }}>Progress</span>
          <span style={{ color:p.color, fontWeight:600 }}>{prog}%</span>
        </div>
        <div style={{ height:6, background:T.bg, borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${prog}%`, background:p.color, borderRadius:99, transition:'width .5s' }}/>
        </div>
      </div>
      <div style={{ display:'flex', gap:14, marginBottom:14 }}>
        <Chip n={pts.length} label="tasks"/>
        <Chip n={pts.filter(t=>t.status==='done').length} label="done" color={T.green}/>
        {pts.filter(t=>t.status==='blocked').length>0 && <Chip n={pts.filter(t=>t.status==='blocked').length} label="blocked" color={T.red}/>}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:`1px solid ${T.bd}` }}>
        <AvatarRow ids={p.members||[]} members={members}/>
        {p.end_date && <div style={{ fontSize:11, color:dl<0?T.red:dl<7?T.amber:T.txt3, display:'flex', alignItems:'center', gap:4 }}><Clock size={11}/>{dl<0?`${Math.abs(dl)}d late`:dl===0?'Today':`${dl}d left`}</div>}
      </div>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────
function Board({ projects, tasks, members, selProj, patchTask, delTask, openModal }) {
  return (
    <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:8, minHeight:500, alignItems:'flex-start' }}>
      {Object.entries(STATUS).map(([sk,sv])=>{
        const ct=tasks.filter(t=>t.status===sk);
        return (
          <div key={sk} style={{ flexShrink:0, width:252, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:sv.col }}/>
                <span style={{ fontSize:13, color:T.navy, fontWeight:500 }}>{sv.label}</span>
                <span style={{ fontSize:11, color:T.txt3, background:T.bg, padding:'1px 7px', borderRadius:99, border:`1px solid ${T.bd}` }}>{ct.length}</span>
              </div>
              <button onClick={()=>openModal('task',{pid:selProj?.id||projects[0]?.id,status:sk})} style={ghostBtn} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.txt3}><Plus size={14}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ct.map(t=><KCard key={t.id} t={t} projects={projects} members={members} patchTask={patchTask} delTask={delTask} openModal={openModal}/>)}
              {ct.length===0 && <div style={{ padding:'20px 0', textAlign:'center', color:T.txt3, fontSize:12, border:`1.5px dashed ${T.bd}`, borderRadius:10 }}>No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KCard({ t, projects, members, patchTask, delTask, openModal }) {
  const [h,setH]=useState(false);
  const [menu,setMenu]=useState(false);
  const proj=projects.find(p=>p.id===t.pid);
  const mem=members.find(m=>m.id===t.aid);
  return (
    <div onClick={()=>openModal('task-detail',t.id)}
      style={{ background:T.white, borderRadius:10, border:`1px solid ${h?T.bdS:T.bd}`, padding:'12px 14px', cursor:'pointer', position:'relative', transition:'all .15s', boxShadow:h?'0 2px 10px rgba(0,0,0,.07)':'none', borderLeft:`3px solid ${PRIORITY[t.pri]?.col||T.bd}` }}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setMenu(false);}}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:13, color:T.navy, lineHeight:1.45, flex:1, paddingRight:6 }}>{t.title}</div>
        <div onClick={e=>{e.stopPropagation();setMenu(!menu);}} style={{ color:T.txt3, cursor:'pointer', padding:'0 2px', flexShrink:0 }}>
          <MoreHorizontal size={13}/>
          {menu && (
            <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:28, right:8, background:T.white, border:`1px solid ${T.bd}`, borderRadius:10, overflow:'hidden', zIndex:50, minWidth:140, boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}>
              {Object.entries(STATUS).map(([k,v])=>(
                <div key={k} onClick={()=>{patchTask(t.id,{status:k});setMenu(false);}}
                  style={{...mItem,color:t.status===k?v.col:T.txt2,background:t.status===k?v.bg:'transparent',fontWeight:t.status===k?500:400}}
                  onMouseEnter={e=>{if(t.status!==k)e.currentTarget.style.background=T.bg;}}
                  onMouseLeave={e=>{if(t.status!==k)e.currentTarget.style.background='transparent';}}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:v.col, flexShrink:0 }}/>{v.label}
                </div>
              ))}
              <div style={{ height:1, background:T.bd }}/>
              <div onClick={()=>{if(confirm('Delete?'))delTask(t.id);setMenu(false);}} style={{...mItem,color:T.red}} onMouseEnter={e=>e.currentTarget.style.background=T.redL} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Trash2 size={11}/>Delete</div>
            </div>
          )}
        </div>
      </div>
      {t.tags?.length>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>{t.tags.slice(0,3).map(tg=><span key={tg} style={{ fontSize:10, padding:'2px 7px', borderRadius:5, background:T.bg, color:T.txt3, border:`1px solid ${T.bd}` }}>{tg}</span>)}</div>}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {proj && <div style={{ width:6, height:6, borderRadius:'50%', background:proj.color }}/>}
          {t.due && <span style={{ fontSize:10, color:isOv(t.due,t.status)?T.red:isSoon(t.due,t.status)?T.amber:T.txt3, display:'flex', alignItems:'center', gap:3 }}><Clock size={10}/>{fmtD(t.due)}</span>}
        </div>
        {mem && <Av m={mem} size={22}/>}
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────
function ListView({ projects, tasks, members, delTask, openModal }) {
  const grouped = projects.map(p=>({p,tasks:tasks.filter(t=>t.pid===p.id)})).filter(g=>g.tasks.length>0);
  const cols = ['1fr','110px','100px','90px','105px','50px'];
  if (!tasks.length) return <Empty msg="No tasks found"/>;
  return (
    <div>
      {grouped.map(({p,tasks:pt})=>(
        <div key={p.id} style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
            <span style={{ fontSize:14, fontWeight:600, color:T.navy }}>{p.name}</span>
            <span style={{ fontSize:11, color:T.txt3 }}>{pt.length} tasks</span>
          </div>
          <div style={{ background:T.white, borderRadius:12, border:`1px solid ${T.bd}`, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:cols.join(' '), padding:'9px 18px', borderBottom:`1px solid ${T.bd}`, background:'#f8fafc' }}>
              {['Task','Status','Priority','Assignee','Due Date',''].map(h=><div key={h} style={{ fontSize:11, color:T.txt3, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:500 }}>{h}</div>)}
            </div>
            {pt.map((t,i)=>{
              const mem=members.find(m=>m.id===t.aid);
              return (
                <div key={t.id} onClick={()=>openModal('task-detail',t.id)}
                  style={{ display:'grid', gridTemplateColumns:cols.join(' '), padding:'10px 18px', borderBottom:i<pt.length-1?`1px solid ${T.bd}`:'none', cursor:'pointer', transition:'background .15s', alignItems:'center' }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ fontSize:13, color:T.navy, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>{t.title}</div>
                  <SBadge s={t.status}/>
                  <PBadge p={t.pri}/>
                  <div>{mem?<Av m={mem} size={24}/>:<span style={{ fontSize:11, color:T.txt3 }}>—</span>}</div>
                  <div style={{ fontSize:11, color:isOv(t.due,t.status)?T.red:T.txt2, fontWeight:isOv(t.due,t.status)?500:400 }}>{fmtD(t.due)||'—'}</div>
                  <div onClick={e=>{e.stopPropagation();if(confirm('Delete?'))delTask(t.id);}} style={{ color:T.txt3, cursor:'pointer', display:'flex' }} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.txt3}><Trash2 size={13}/></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────
function Timeline({ projects, tasks, members, progress }) {
  const ref=useRef(null);
  const now=new Date();
  const origin=new Date(now.getFullYear(),now.getMonth(),1);
  const DAY=26; const DAYS=90; const LW=220;
  const days=Array.from({length:DAYS},(_,i)=>{const d=new Date(origin);d.setDate(i+1);return d;});
  const todayX=Math.floor((now-origin)/864e5)*DAY;
  const px=(d)=>{if(!d)return null;return Math.max(0,Math.floor((new Date(d)-origin)/864e5))*DAY;};
  const pw=(s,e)=>{if(!s||!e)return 80;return Math.max(26,Math.floor((new Date(e)-new Date(Math.max(new Date(s),origin)))/864e5)*DAY);};
  useEffect(()=>{if(ref.current)ref.current.scrollLeft=Math.max(0,todayX-100);},[]);
  return (
    <div style={{ background:T.white, borderRadius:12, border:`1px solid ${T.bd}`, overflow:'hidden' }}>
      <div ref={ref} style={{ overflowX:'auto' }}>
        <div style={{ minWidth:LW+DAYS*DAY }}>
          <div style={{ display:'flex', borderBottom:`1px solid ${T.bd}`, position:'sticky', top:0, zIndex:5, background:T.white }}>
            <div style={{ width:LW, flexShrink:0, borderRight:`1px solid ${T.bd}`, padding:'10px 16px', fontSize:11, fontWeight:600, color:T.txt3, textTransform:'uppercase', letterSpacing:'.1em' }}>Project / Task</div>
            <div style={{ display:'flex' }}>
              {days.map((d,i)=>(
                <div key={i} style={{ width:DAY, flexShrink:0, textAlign:'center', padding:'8px 0', fontSize:9, color:d.toDateString()===now.toDateString()?T.primary:T.txt3, background:d.toDateString()===now.toDateString()?T.primaryL:'transparent', borderLeft:d.getDate()===1?`1px solid ${T.bd}`:'none', fontWeight:d.toDateString()===now.toDateString()?700:400 }}>
                  {d.getDate()===1?d.toLocaleDateString('en-US',{month:'short'}):d.getDate()%7===0?d.getDate():''}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:LW+todayX, top:0, bottom:0, width:2, background:T.primary, opacity:.3, zIndex:4, pointerEvents:'none' }}/>
            {projects.map(p=>{
              const prog=progress(p.id);
              const ptasks=tasks.filter(t=>t.pid===p.id&&t.due);
              const left=px(p.start_date);
              const width=pw(p.start_date,p.end_date);
              return (
                <div key={p.id} style={{ borderBottom:`1px solid ${T.bd}` }}>
                  <div style={{ display:'flex', alignItems:'center', height:48, background:'#fafbfc' }}>
                    <div style={{ width:LW, flexShrink:0, padding:'0 16px', display:'flex', alignItems:'center', gap:8, borderRight:`1px solid ${T.bd}`, height:'100%' }}>
                      <div style={{ width:9, height:9, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, fontWeight:600, color:T.navy, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    </div>
                    <div style={{ position:'relative', flex:1, height:'100%', overflow:'hidden' }}>
                      {p.start_date&&p.end_date&&left!==null&&(
                        <div style={{ position:'absolute', left, top:'50%', transform:'translateY(-50%)', width, height:24, borderRadius:6, background:`${p.color}20`, border:`1.5px solid ${p.color}60`, overflow:'hidden', display:'flex', alignItems:'center' }}>
                          <div style={{ height:'100%', width:`${prog}%`, background:`${p.color}50` }}/>
                          <span style={{ position:'absolute', left:8, fontSize:10, color:p.color, fontWeight:600 }}>{prog}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {ptasks.map(t=>{
                    const tLeft=px(t.due);
                    const mem=members.find(m=>m.id===t.aid);
                    return (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', height:32 }}>
                        <div style={{ width:LW, flexShrink:0, padding:'0 16px 0 32px', fontSize:11, color:T.txt2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderRight:`1px solid ${T.bd}`, height:'100%', display:'flex', alignItems:'center' }}>{t.title}</div>
                        <div style={{ position:'relative', flex:1, height:'100%', overflow:'hidden' }}>
                          {tLeft!==null&&(
                            <div style={{ position:'absolute', left:tLeft-4, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center', gap:4 }}>
                              <div style={{ width:9, height:9, borderRadius:'50%', background:isOv(t.due,t.status)?T.red:t.status==='done'?T.green:STATUS[t.status]?.col||T.primary, border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,.15)' }}/>
                              <span style={{ fontSize:9, color:isOv(t.due,t.status)?T.red:T.txt3, whiteSpace:'nowrap' }}>{fmtD(t.due)}</span>
                              {mem&&<div style={{ width:14, height:14, borderRadius:'50%', background:mem.color, fontSize:7, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>{mem.initials[0]}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────
function TeamView({ members, tasks, projects, openModal }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:15, fontWeight:600, color:T.navy }}>{members.length} Team Members</h2>
        <ActionBtn icon={<Plus size={13}/>} label="Invite Member" onClick={()=>openModal('member')}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
        {members.map(m=>{
          const mt=tasks.filter(t=>t.aid===m.id);
          const done=mt.filter(t=>t.status==='done').length;
          const over=mt.filter(t=>isOv(t.due,t.status)).length;
          const projs=[...new Set(mt.map(t=>t.pid))].map(pid=>projects.find(p=>p.id===pid)).filter(Boolean);
          return (
            <div key={m.id} style={{ background:T.white, borderRadius:12, border:`1px solid ${T.bd}`, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                <Av m={m} size={44}/>
                <div><div style={{ fontSize:15, fontWeight:600, color:T.navy }}>{m.name}</div><div style={{ fontSize:12, color:T.txt2 }}>{m.role}</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
                {[{l:'Tasks',v:mt.length,c:T.primary,bg:T.primaryL},{l:'Done',v:done,c:T.green,bg:T.greenL},{l:'Overdue',v:over,c:over>0?T.red:T.txt3,bg:over>0?T.redL:T.bg}].map(s=>(
                  <div key={s.l} style={{ textAlign:'center', padding:'10px 4px', background:s.bg, borderRadius:8 }}>
                    <div style={{ fontSize:22, fontWeight:700, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:10, color:s.c, textTransform:'uppercase', letterSpacing:'.08em', opacity:.8 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:T.txt3, marginBottom:8, textTransform:'uppercase', letterSpacing:'.1em' }}>Projects</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {projs.map(p=><span key={p.id} style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:`${p.color}15`, color:p.color, border:`1px solid ${p.color}30`, fontWeight:500 }}>{p.name}</span>)}
                {projs.length===0&&<span style={{ fontSize:12, color:T.txt3 }}>No active tasks</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task Detail ───────────────────────────────────────────────
function TaskDetail({ task, members, projects, patchTask, onEdit, onDelete, onClose }) {
  const proj=projects.find(p=>p.id===task.pid);
  const mem=members.find(m=>m.id===task.aid);
  const dl=dleft(task.due);
  return (
    <Modal onClose={onClose} width={500}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:10 }}>
            {proj&&<span style={{ fontSize:11, color:proj.color, background:`${proj.color}15`, padding:'3px 9px', borderRadius:5, fontWeight:500 }}>{proj.name}</span>}
            <SBadge s={task.status}/><PBadge p={task.pri}/>
          </div>
          <div style={{ fontSize:18, fontWeight:600, color:T.navy, lineHeight:1.3 }}>{task.title}</div>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:12 }}>
          <IBtn icon={<Edit2 size={13}/>} onClick={onEdit}/>
          <IBtn icon={<Trash2 size={13}/>} danger onClick={()=>{if(confirm('Delete?'))onDelete(task.id);}}/>
          <IBtn icon={<X size={13}/>} onClick={onClose}/>
        </div>
      </div>
      {task.desc&&<div style={{ fontSize:13, color:T.txt2, lineHeight:1.6, marginBottom:18, padding:'12px 14px', background:T.bg, borderRadius:9, border:`1px solid ${T.bd}` }}>{task.desc}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
        <DRow label="Assignee">{mem?<div style={{ display:'flex', alignItems:'center', gap:8 }}><Av m={mem} size={24}/><span style={{ fontSize:13 }}>{mem.name}</span></div>:<span style={{ fontSize:13, color:T.txt3 }}>Unassigned</span>}</DRow>
        <DRow label="Due Date"><span style={{ fontSize:13, color:isOv(task.due,task.status)?T.red:isSoon(task.due,task.status)?T.amber:T.navy, fontWeight:500 }}>{fmtD(task.due)||'—'}{dl!==null&&task.status!=='done'?` · ${dl<0?`${Math.abs(dl)}d late`:`${dl}d left`}`:''}</span></DRow>
        <DRow label="Status"><SBadge s={task.status}/></DRow>
        <DRow label="Priority"><PBadge p={task.pri}/></DRow>
      </div>
      {task.tags?.length>0&&<div style={{ marginBottom:18 }}><div style={{ fontSize:11, color:T.txt3, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>Tags</div><div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{task.tags.map(tg=><span key={tg} style={{ fontSize:12, padding:'4px 10px', borderRadius:7, background:T.bg, color:T.txt2, border:`1px solid ${T.bd}` }}>{tg}</span>)}</div></div>}
      <div>
        <div style={{ fontSize:11, color:T.txt3, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:10 }}>Change Status</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {Object.entries(STATUS).map(([k,v])=>(
            <div key={k} onClick={()=>patchTask(task.id,{status:k})} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, color:task.status===k?v.col:T.txt2, background:task.status===k?v.bg:T.bg, border:`1px solid ${task.status===k?v.col+'50':T.bd}`, fontWeight:task.status===k?500:400, transition:'all .15s' }}>{v.label}</div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Project Modal ─────────────────────────────────────────────
function ProjectModal({ project, members, onSave, onClose }) {
  const [f,setF]=useState(project||{name:'',desc:'',color:PALETTE[0],status:'active',start:today(),end:'',members:[]});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return (
    <Modal onClose={onClose} width={460} title={project?'Edit Project':'New Project'}>
      <Fld label="Project Name"><Inp value={f.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Customer Portal"/></Fld>
      <Fld label="Description"><textarea value={f.desc||''} onChange={e=>s('desc',e.target.value)} rows={2} style={{...inp,width:'100%',resize:'vertical',lineHeight:1.5}} placeholder="What's this about?"/></Fld>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Fld label="Start Date"><Inp type="date" value={f.start||''} onChange={e=>s('start',e.target.value)}/></Fld>
        <Fld label="Deadline"><Inp type="date" value={f.end||''} onChange={e=>s('end',e.target.value)}/></Fld>
      </div>
      <Fld label="Color"><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{PALETTE.map(c=><div key={c} onClick={()=>s('color',c)} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:f.color===c?'3px solid #1e2d3d':'3px solid transparent', transition:'all .15s' }}/>)}</div></Fld>
      <Fld label="Status"><select value={f.status} onChange={e=>s('status',e.target.value)} style={{...inp,width:'100%'}}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></Fld>
      <Fld label="Assign Members"><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{members.map(m=>{const sel=(f.members||[]).includes(m.id);return <div key={m.id} onClick={()=>s('members',sel?(f.members||[]).filter(x=>x!==m.id):[...(f.members||[]),m.id])} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${sel?m.color:T.bd}`, background:sel?`${m.color}12`:'transparent', transition:'all .15s' }}><Av m={m} size={18}/><span style={{ fontSize:12, color:sel?T.navy:T.txt2, fontWeight:sel?500:400 }}>{m.name.split(' ')[0]}</span></div>;})}</div></Fld>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <Btn outline onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
        <Btn primary onClick={()=>{if(f.name.trim())onSave(f);}} style={{ flex:2 }}>{project?'Save Changes':'Create Project'}</Btn>
      </div>
    </Modal>
  );
}

// ── Task Modal ────────────────────────────────────────────────
function TaskModal({ task, projects, members, onSave, onClose }) {
  const [f,setF]=useState({title:'',desc:'',pid:projects[0]?.id||'',status:'todo',pri:'medium',aid:'',due:'',tags:[],...task});
  const [ti,setTi]=useState('');
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const addTag=()=>{const t=ti.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t)){s('tags',[...(f.tags||[]),t]);setTi('');}};
  return (
    <Modal onClose={onClose} width={460} title={task?.id?'Edit Task':'New Task'}>
      <Fld label="Title"><Inp value={f.title} onChange={e=>s('title',e.target.value)} placeholder="What needs to be done?"/></Fld>
      <Fld label="Description"><textarea value={f.desc||''} onChange={e=>s('desc',e.target.value)} rows={2} style={{...inp,width:'100%',resize:'vertical',lineHeight:1.5}} placeholder="Context, notes…"/></Fld>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Fld label="Project"><select value={f.pid} onChange={e=>s('pid',e.target.value)} style={{...inp,width:'100%'}}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
        <Fld label="Assignee"><select value={f.aid||''} onChange={e=>s('aid',e.target.value)} style={{...inp,width:'100%'}}><option value="">Unassigned</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Fld>
        <Fld label="Status"><select value={f.status} onChange={e=>s('status',e.target.value)} style={{...inp,width:'100%'}}>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Fld>
        <Fld label="Priority"><select value={f.pri} onChange={e=>s('pri',e.target.value)} style={{...inp,width:'100%'}}>{Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Fld>
      </div>
      <Fld label="Due Date"><Inp type="date" value={f.due||''} onChange={e=>s('due',e.target.value)}/></Fld>
      <Fld label="Tags">
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>{(f.tags||[]).map(tg=><span key={tg} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:T.bg, color:T.txt2, border:`1px solid ${T.bd}`, display:'flex', alignItems:'center', gap:4 }}>{tg}<span onClick={()=>s('tags',(f.tags||[]).filter(x=>x!==tg))} style={{ cursor:'pointer', color:T.txt3 }}>×</span></span>)}</div>
        <div style={{ display:'flex', gap:8 }}><Inp value={ti} onChange={e=>setTi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="Add tag, press Enter…" style={{ flex:1 }}/><Btn outline onClick={addTag} style={{ padding:'8px 12px', flexShrink:0 }}>Add</Btn></div>
      </Fld>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <Btn outline onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
        <Btn primary onClick={()=>{if(f.title.trim())onSave(f);}} style={{ flex:2 }}>{task?.id?'Save Changes':'Add Task'}</Btn>
      </div>
    </Modal>
  );
}

// ── Member Modal ──────────────────────────────────────────────
function MemberModal({ onSave, onClose }) {
  const cols=PALETTE.slice(0,6);
  const [f,setF]=useState({name:'',role:'',color:cols[0]});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return (
    <Modal onClose={onClose} width={360} title="Invite Team Member">
      <Fld label="Full Name"><Inp value={f.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Rahul Sharma"/></Fld>
      <Fld label="Role"><Inp value={f.role} onChange={e=>s('role',e.target.value)} placeholder="e.g. Engineering…"/></Fld>
      <Fld label="Avatar Color"><div style={{ display:'flex', gap:8 }}>{cols.map(c=><div key={c} onClick={()=>s('color',c)} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:f.color===c?'3px solid #1e2d3d':'3px solid transparent', transition:'all .15s' }}/>)}</div></Fld>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <Btn outline onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
        <Btn primary onClick={()=>{if(f.name.trim())onSave({...f,initials:f.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)});}} style={{ flex:2 }}>Add Member</Btn>
      </div>
    </Modal>
  );
}

// ── Shared Primitives ─────────────────────────────────────────
function Modal({ children, onClose, width=480, title }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:T.white, border:`1px solid ${T.bd}`, borderRadius:16, padding:28, width:'100%', maxWidth:width, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,.18)', animation:'modalIn .25s cubic-bezier(.16,1,.3,1)', display:'flex', flexDirection:'column', gap:16 }}>
        {title&&<div style={{ fontSize:16, fontWeight:700, color:T.navy, paddingBottom:16, borderBottom:`1px solid ${T.bd}` }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function SBadge({ s }) { const v=STATUS[s]||STATUS.todo; return <span style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:v.bg, color:v.col, fontWeight:500, whiteSpace:'nowrap' }}>{v.label}</span>; }
function PBadge({ p }) { const v=PRIORITY[p]||PRIORITY.medium; return <span style={{ fontSize:10, padding:'3px 7px', borderRadius:5, background:`${v.col}14`, color:v.col, fontWeight:600 }}>{v.sym} {v.label}</span>; }
function Av({ m, size=28 }) { return <div style={{ width:size, height:size, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*.34, color:'#fff', fontWeight:700, flexShrink:0, border:'2px solid white', boxShadow:'0 1px 4px rgba(0,0,0,.15)' }} title={m.name}>{m.initials}</div>; }
function AvatarRow({ ids, members }) { return <div style={{ display:'flex' }}>{(ids||[]).slice(0,4).map(id=>{const m=members.find(x=>x.id===id);return m?<div key={id} style={{ marginLeft:-6 }}><Av m={m} size={22}/></div>:null;})}</div>; }
function Chip({ n, label, color=T.txt2 }) { return <span style={{ fontSize:11, color:T.txt2 }}><span style={{ fontWeight:600, color }}>{n}</span> {label}</span>; }
function Empty({ msg }) { return <div style={{ textAlign:'center', padding:'60px 0', color:T.txt3 }}><div style={{ fontSize:36, marginBottom:10 }}>📋</div><div style={{ fontSize:14 }}>{msg}</div></div>; }
function DRow({ label, children }) { return <div style={{ padding:'10px 12px', background:T.bg, borderRadius:9, border:`1px solid ${T.bd}` }}><div style={{ fontSize:10, color:T.txt3, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:5 }}>{label}</div>{children}</div>; }
function Fld({ label, children }) { return <div><div style={{ fontSize:12, color:T.txt2, fontWeight:500, marginBottom:6 }}>{label}</div>{children}</div>; }
function Inp({ style:s, ...p }) { return <input style={{...inp,...s}} {...p}/>; }
function IBtn({ icon, onClick, danger }) { const [h,setH]=useState(false); return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{ width:30, height:30, borderRadius:7, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:h?(danger?T.redL:T.bg):T.bg, border:`1px solid ${T.bd}`, color:h?(danger?T.red:T.primary):T.txt3, transition:'all .15s' }}>{icon}</div>; }
function Btn({ children, onClick, primary, outline, style:s }) { const [h,setH]=useState(false); return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{ padding:'9px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500, border:`1.5px solid ${primary?T.primary:T.bd}`, background:primary?(h?T.primaryD:T.primary):(h?T.bg:T.white), color:primary?'#fff':T.txt2, transition:'all .15s', ...s }}>{children}</button>; }

const inp   = { padding:'9px 12px', borderRadius:8, border:`1px solid ${T.bd}`, color:T.txt, fontSize:13, outline:'none', background:T.white };
const mItem = { padding:'8px 14px', fontSize:12, color:T.txt2, cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'background .15s' };
const ghostBtn = { background:'none', border:'none', cursor:'pointer', color:T.txt3, display:'flex', alignItems:'center', padding:4, borderRadius:4, transition:'color .15s' };
